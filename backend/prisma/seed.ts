import { PrismaClient, Prisma } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { getSeedMediaPath, SeedMediaKey } from './seed/helpers/media.helper'
import { S3Service } from '../src/infrastructure/s3/s3.service'
import { DEFAULT_AVATAR_PATH } from '../src/infrastructure/config/media.config'
import { ProgressBar } from './seed/helpers/progress-bar'
import { seedTaxonomy } from './seed/taxonomy.seed'
import { seedConfig } from './seed/config'
import { seedSystem } from './seed/steps/system.seed'
import { seedUsersAndProfiles } from './seed/steps/identity.seed'
import { seedAuthUserEdges } from './seed/steps/auth-edge.seed'
import { seedGamificationUserState } from './seed/steps/gamification-user-state.seed'
import { pickSeedContentCommentTemplate } from './seed/helpers/content-comment-templates'
import { seedMessageReactionsAndReadReceipts } from './seed/helpers/seed-message-engagement'
import { GeminiService } from '../src/infrastructure/ai/gemini.service'
import { brandToWebsite } from '../src/data/brandToWebsite'
import { buildPairMap, pickProductFromPairMap } from './seed/helpers/product-pick-strategies'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const slugify = require('slugify')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { markSeedStart, markSeedEnd, addSeedUserId } = require('./seed/seed-metadata')

const prisma = new PrismaClient()

// Popüler marka/kategori listeleri (DB: Top N by Product Count)
// NOT: Case-insensitive eşleşme için normalize set'leri aşağıda kullanılıyor.
const POPULAR_BRAND_NAMES = [
  'HP',
  'SAMSUNG',
  'Apple',
  'Dell',
  'REVLON',
  'Sony',
  'Lenovo',
  "L'Oreal Paris",
  'NYX PROFESSIONAL MAKEUP',
  'MAYBELLINE',
  'NEEWER',
  'K&F CONCEPT',
  'ASUS',
  'Neutrogena',
  'Bath & Body Works',
]

const POPULAR_CATEGORY_NAMES = [
  'Laptops',
  'Carrier Cell Phones',
  'Desktops',
  'Accessories',
  'Selfie Sticks & Tripods',
  'Accessory Kits',
  'Sets & Kits',
  'Masks',
  'Face Moisturizers',
  'Face Mists',
  'Soaps',
  'Gels',
  'Balms & Moisturizers',
  'Lip Sunscreens',
]

const normalizedPopularBrandNames = new Set(POPULAR_BRAND_NAMES.map(name => name.toLowerCase().trim()))
const normalizedPopularCategoryNames = new Set(POPULAR_CATEGORY_NAMES.map(name => name.toLowerCase().trim()))

const PREFERRED_BRAND_CATEGORY_PAIRS = [
  { brand: 'Apple', category: 'Carrier Cell Phones' },
]

// Script (`scripts/analyze-popular-intersection-picks.ts`) ile aynı yaklaşım:
// - POPULAR intersection dışına çıkma
// - Varsayılan dağılım: %40 beauty / %60 elektronik (non-beauty)
const BEAUTY_BRAND_NAMES = ["L'Oreal Paris", 'NYX PROFESSIONAL MAKEUP', 'MAYBELLINE', 'Neutrogena', 'REVLON', 'Bath & Body Works']
const BEAUTY_CATEGORY_NAMES = [
  'Sets & Kits',
  'Masks',
  'Face Moisturizers',
  'Face Mists',
  'Soaps',
  'Gels',
  'Balms & Moisturizers',
  'Lip Sunscreens',
]
const normalizedBeautyBrandNames = new Set(BEAUTY_BRAND_NAMES.map(name => name.toLowerCase().trim()))
const normalizedBeautyCategoryNames = new Set(BEAUTY_CATEGORY_NAMES.map(name => name.toLowerCase().trim()))
const DEFAULT_BEAUTY_TARGET_RATIO = 0.4

function normalizeName(value?: string | null): string {
  return (value || '').toLowerCase().trim()
}

function isPopularIntersectionProduct(product: { brand?: { name?: string | null } | null; category?: { name?: string | null } | null }): boolean {
  const brandName = normalizeName(product.brand?.name)
  const categoryName = normalizeName(product.category?.name)
  return Boolean(brandName && categoryName && normalizedPopularBrandNames.has(brandName) && normalizedPopularCategoryNames.has(categoryName))
}

function isBeautyProduct(product: { brand?: { name?: string | null } | null; category?: { name?: string | null } | null }): boolean {
  const brandName = normalizeName(product.brand?.name)
  const categoryName = normalizeName(product.category?.name)
  return Boolean((brandName && normalizedBeautyBrandNames.has(brandName)) || (categoryName && normalizedBeautyCategoryNames.has(categoryName)))
}

function createPopularIntersectionBeautyRatioPicker<
  T extends { id: string; brand?: { name?: string | null } | null; category?: { name?: string | null } | null },
>(opts: { pool: T[]; pairMap: Map<string, T[]>; totalPicks: number; beautyTargetRatio: number; dedupe: boolean }): () => T {
  const pool = opts.pool
  const beautyPool = pool.filter(p => isBeautyProduct(p))
  const nonBeautyPool = pool.filter(p => !isBeautyProduct(p))
  const beautyTarget = Math.round(Math.max(0, opts.totalPicks) * Math.min(1, Math.max(0, opts.beautyTargetRatio)))

  let pickedCount = 0
  let beautyPicked = 0
  const seenProductIds = new Set<string>()

  const tryPickFromPool = (arr: T[]): T | null => {
    if (arr.length === 0) return null
    for (let attempt = 0; attempt < 35; attempt++) {
      const p = arr[Math.floor(Math.random() * arr.length)]!
      if (!opts.dedupe) return p
      if (!seenProductIds.has(p.id)) return p
    }
    return null
  }

  const pickBase = (): T => {
    return pickProductFromPairMap(opts.pairMap, pool, {
      preferredPairs: [],
      preferredChance: 0,
      strategy: 'uniform-pair',
      topk: 5,
    }) as T
  }

  return () => {
    const remaining = Math.max(0, opts.totalPicks - pickedCount)
    const needBeauty = Math.max(0, beautyTarget - beautyPicked)

    const mustPickBeauty = beautyPool.length > 0 && needBeauty >= remaining && remaining > 0
    const mustPickNonBeauty = nonBeautyPool.length > 0 && needBeauty <= 0

    const beautyProb = mustPickBeauty ? 1 : mustPickNonBeauty ? 0 : remaining > 0 ? needBeauty / remaining : 0
    const chooseBeauty = Math.random() < beautyProb

    let picked: T | null = null
    if (chooseBeauty) picked = tryPickFromPool(beautyPool)
    else picked = tryPickFromPool(nonBeautyPool)

    picked = picked ?? pickBase()

    pickedCount += 1
    if (opts.dedupe) seenProductIds.add(picked.id)
    if (isBeautyProduct(picked)) beautyPicked += 1
    return picked
  }
}

function buildPopularIntersectionPairMap<T extends { brand?: { name?: string | null } | null; category?: { name?: string | null } | null }>(
  products: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const p of products) {
    const brand = normalizeName(p.brand?.name)
    const category = normalizeName(p.category?.name)
    if (!brand || !category) continue
    const key = `${brand}||${category}`
    const existing = map.get(key)
    if (existing) existing.push(p)
    else map.set(key, [p])
  }
  return map
}

function pickFromPopularIntersection<T>(
  pairMap: Map<string, T[]>,
  fallback: T[],
  preferredPairs: Array<{ brand: string; category: string }> = PREFERRED_BRAND_CATEGORY_PAIRS,
): T {
  for (const pair of preferredPairs) {
    const key = `${normalizeName(pair.brand)}||${normalizeName(pair.category)}`
    const items = pairMap.get(key)
    if (items && items.length > 0) {
      return items[Math.floor(Math.random() * items.length)]
    }
  }

  // Kalan kombinasyonlar: en dolu kombinasyonlardan başla (empty denemeleri azaltır)
  const entries = Array.from(pairMap.entries()).sort((a, b) => (b[1]?.length || 0) - (a[1]?.length || 0))
  for (const [, items] of entries) {
    if (items && items.length > 0) {
      return items[Math.floor(Math.random() * items.length)]
    }
  }

  // Son fallback
  return fallback[Math.floor(Math.random() * fallback.length)]
}

// Sabit kullanıcı ID'leri - her seed'de aynı ID'ler kullanılır
const TEST_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07' // omer@tipbox.co
const TARGET_USER_ID = '10000000-0000-4000-a000-000000000018' // serkan@tipbox.co (markettest yerine)

// Trust user ID'leri (SEED_USERS array'inden)
const TRUST_USER_IDS = [
  '11111111-1111-4111-a111-111111111111', // tuna@tipbox.co
  '22222222-2222-4222-a222-222222222222', // mehmet@tipbox.co
  '33333333-3333-4333-a333-333333333333', // ibrahim@tipbox.co
  '44444444-4444-4444-a444-444444444444', // burakcan@tipbox.co
  '55555555-5555-4555-a555-555555555555', // mihrac@tipbox.co
]

// Truster user ID'leri (SEED_USERS array'inden)
const TRUSTER_USER_IDS = [
  'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', // irem@tipbox.co
  'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', // furkan@tipbox.co
  'cccccccc-cccc-4ccc-cccc-cccccccccccc', // aycan@tipbox.co
]

// Julia Havk user ID
const JULIA_USER_ID = '99999999-9999-4999-9999-999999999999' // ozan@tipbox.co
const COMMUNITY_COACH_USER_ID = '10000000-0000-4000-a000-000000000017' // ebru@tipbox.co

// Öne çıkan kullanıcılar (post/inventory gibi UGC'lerde ağırlıklı kullanılacak)
const FEATURED_USER_IDS = [
  TEST_USER_ID, // omer
  TRUST_USER_IDS[0], // tuna
  TRUST_USER_IDS[2], // ibrahim
  TRUST_USER_IDS[3], // burakcan
  TRUST_USER_IDS[4], // mihrac
  TRUSTER_USER_IDS[0], // irem
  TRUSTER_USER_IDS[1], // furkan
  TRUSTER_USER_IDS[2], // aycan
  JULIA_USER_ID, // ozan
]

// Hash the default password for all users
const DEFAULT_PASSWORD = 'password123'
let passwordHash: string

// 40 Kullanıcı Seed Data
interface SeedUserConfig {
  id: string
  name: string
  email: string
  userName: string
  avatarKey: SeedMediaKey
  bio: string
  title: string
  country: string
}

const SEED_USERS: SeedUserConfig[] = [
  {
    id: '480f5de9-b691-4d70-a6a8-2789226f4e07',
    name: 'Ömer Faruk',
    email: 'omer@tipbox.co',
    userName: 'omerfaruk',
    avatarKey: 'user.avatar.omer',
    bio: 'Tech enthusiast and gadget reviewer. Sharing honest reviews and real-life experiences.',
    title: 'Tech Explorer',
    country: 'Turkey',
  },
  {
    id: '11111111-1111-4111-a111-111111111111',
    name: 'Tuna',
    email: 'tuna@tipbox.co',
    userName: 'tuna',
    avatarKey: 'user.avatar.man1',
    bio: 'Mobile tech lover and app tester. Always looking for the next big thing.',
    title: 'Mobile Guru',
    country: 'Turkey',
  },
  {
    id: '22222222-2222-4222-a222-222222222222',
    name: 'Mehmet',
    email: 'mehmet@tipbox.co',
    userName: 'mehmet',
    avatarKey: 'user.avatar.mehmet',
    bio: 'Audio equipment expert. Passionate about high-quality sound and headphones.',
    title: 'Audio Expert',
    country: 'Turkey',
  },
  {
    id: '33333333-3333-4333-a333-333333333333',
    name: 'İbrahim',
    email: 'ibrahim@tipbox.co',
    userName: 'ibrahim',
    avatarKey: 'user.avatar.man2',
    bio: 'Beauty and skincare enthusiast. Sharing product reviews and skincare routines.',
    title: 'Skincare Specialist',
    country: 'Turkey',
  },
  {
    id: '44444444-4444-4444-a444-444444444444',
    name: 'Burakcan',
    email: 'burakcan@tipbox.co',
    userName: 'burakcan',
    avatarKey: 'user.avatar.burakcan',
    bio: 'Laptop and PC hardware reviewer. Building the perfect setup.',
    title: 'Hardware Pro',
    country: 'Turkey',
  },
  {
    id: '55555555-5555-4555-a555-555555555555',
    name: 'Mihraç',
    email: 'mihrac@tipbox.co',
    userName: 'mihrac',
    bio: 'Gaming enthusiast and streaming setup expert.',
    avatarKey: 'user.avatar.mihrac',
    title: 'Gaming Master',
    country: 'Turkey',
  },
  {
    id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    name: 'İrem',
    email: 'irem@tipbox.co',
    userName: 'irem',
    avatarKey: 'user.avatar.woman1',
    bio: 'Makeup artist and beauty product reviewer. Love trying new cosmetics.',
    title: 'Beauty Curator',
    country: 'Turkey',
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    name: 'Furkan',
    email: 'furkan@tipbox.co',
    userName: 'furkan',
    avatarKey: 'user.avatar.furkan',
    bio: 'Camera and photography gear enthusiast. Capturing life one shot at a time.',
    title: 'Photo Expert',
    country: 'Turkey',
  },
  {
    id: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
    name: 'Aycan',
    email: 'aycan@tipbox.co',
    userName: 'aycan',
    avatarKey: 'user.avatar.aycan',
    bio: 'Fragrance lover and perfume collector. Sharing scent experiences.',
    title: 'Fragrance Connoisseur',
    country: 'Turkey',
  },
  {
    id: '99999999-9999-4999-9999-999999999999',
    name: 'Ozan',
    email: 'ozan@tipbox.co',
    userName: 'ozan',
    avatarKey: 'user.avatar.ozan',
    bio: 'Smart home enthusiast and IoT explorer.',
    title: 'Smart Home Pro',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000001',
    name: 'Elif',
    email: 'elif@tipbox.co',
    userName: 'elif',
    avatarKey: 'user.avatar.elif',
    bio: 'Hair care specialist and styling expert.',
    title: 'Hair Care Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000002',
    name: 'Can',
    email: 'can@tipbox.co',
    userName: 'can',
    avatarKey: 'user.avatar.can',
    bio: 'Fitness tracker and wearable tech reviewer.',
    title: 'Fitness Tech',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000003',
    name: 'Zeynep',
    email: 'zeynep@tipbox.co',
    userName: 'zeynep',
    avatarKey: 'user.avatar.zeynep',
    bio: 'Nail art enthusiast and nail care product tester.',
    title: 'Nail Artist',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000004',
    name: 'Ahmet',
    email: 'ahmet@tipbox.co',
    userName: 'ahmet',
    avatarKey: 'user.avatar.ahmet',
    bio: 'Men grooming expert and beard care specialist.',
    title: 'Grooming Guru',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000005',
    name: 'Selin',
    email: 'selin@tipbox.co',
    userName: 'selin',
    avatarKey: 'user.avatar.selin',
    bio: 'Personal care product reviewer and wellness advocate.',
    title: 'Wellness Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000006',
    name: 'Emre',
    email: 'emre@tipbox.co',
    userName: 'emre',
    avatarKey: 'user.avatar.emre',
    bio: 'Tablet and e-reader enthusiast. Digital reading expert.',
    title: 'Digital Reader',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000007',
    name: 'Deniz',
    email: 'deniz@tipbox.co',
    userName: 'deniz',
    avatarKey: 'user.avatar.deniz',
    bio: 'Wireless earbuds collector and audio quality tester.',
    title: 'Audio Lover',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000008',
    name: 'Barış',
    email: 'baris@tipbox.co',
    userName: 'baris',
    avatarKey: 'user.avatar.baris',
    bio: 'Drone pilot and aerial photography enthusiast.',
    title: 'Drone Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000009',
    name: 'Merve',
    email: 'merve@tipbox.co',
    userName: 'merve',
    avatarKey: 'user.avatar.merve',
    bio: 'Smartwatch and fitness band reviewer.',
    title: 'Wearable Tech',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000010',
    name: 'Berkay',
    email: 'berkay@tipbox.co',
    userName: 'berkay',
    avatarKey: 'user.avatar.berkay',
    bio: 'Mechanical keyboard enthusiast and RGB lighting expert.',
    title: 'Keyboard Master',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000011',
    name: 'Aslı',
    email: 'asli@tipbox.co',
    userName: 'asli',
    avatarKey: 'user.avatar.asli',
    bio: 'Moisturizer and serum expert. Hydration is key!',
    title: 'Hydration Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000012',
    name: 'Murat',
    email: 'murat@tipbox.co',
    userName: 'murat',
    avatarKey: 'user.avatar.murat',
    bio: 'Monitor and display technology reviewer.',
    title: 'Display Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000013',
    name: 'Gizem',
    email: 'gizem@tipbox.co',
    userName: 'gizem',
    avatarKey: 'user.avatar.gizem',
    bio: 'Foundation and concealer specialist.',
    title: 'Base Makeup Pro',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000014',
    name: 'Onur',
    email: 'onur@tipbox.co',
    userName: 'onur',
    avatarKey: 'user.avatar.onur',
    bio: 'Router and networking equipment expert.',
    title: 'Network Guru',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000015',
    name: 'Burcu',
    email: 'burcu@tipbox.co',
    userName: 'burcu',
    avatarKey: 'user.avatar.burcu',
    bio: 'Lipstick and lip care enthusiast.',
    title: 'Lip Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000016',
    name: 'Tolga',
    email: 'tolga@tipbox.co',
    userName: 'tolga',
    avatarKey: 'user.avatar.tolga',
    bio: 'Power bank and charging accessories reviewer.',
    title: 'Charging Pro',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000017',
    name: 'Ebru',
    email: 'ebru@tipbox.co',
    userName: 'ebru',
    avatarKey: 'user.avatar.ebru',
    bio: 'Eyeshadow palette collector and eye makeup artist.',
    title: 'Eye Makeup Artist',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000018',
    name: 'Serkan',
    email: 'serkan@tipbox.co',
    userName: 'serkan',
    avatarKey: 'user.avatar.serkan',
    bio: 'External SSD and storage solutions expert.',
    title: 'Storage Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000019',
    name: 'Ece',
    email: 'ece@tipbox.co',
    userName: 'ece',
    avatarKey: 'user.avatar.ece',
    bio: 'Mascara and eyeliner specialist.',
    title: 'Lash Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000020',
    name: 'Kaan',
    email: 'kaan@tipbox.co',
    userName: 'kaan',
    avatarKey: 'user.avatar.kaan',
    bio: 'Mouse and gaming accessories reviewer.',
    title: 'Gaming Gear',
    country: 'Turkey',
  },
]

const DEFAULT_BANNER_URL =  getSeedMediaPath('user.banner.primary', true) || null
const PRIMARY_AVATAR_URL = getSeedMediaPath('user.avatar.primary', true) || getSeedMediaPath('user.avatar.default', true) || null
const MARKET_AVATAR_URL = getSeedMediaPath('user.avatar.market', true) || getSeedMediaPath('user.avatar.default', true) || null
const INVENTORY_MEDIA_URL = getSeedMediaPath('inventory.dyson-media', true) || null
const TRUST_USER_AVATAR_KEYS: SeedMediaKey[] = [
  'user.avatar.trust1',
  'user.avatar.trust2',
  'user.avatar.trust3',
  'user.avatar.trust4',
  'user.avatar.trust5',
]
const TRUSTER_USER_AVATAR_KEYS: SeedMediaKey[] = [
  'user.avatar.truster1',
  'user.avatar.truster2',
  'user.avatar.truster3',
]
const TRUST_USER_TITLE_OPTIONS = [
  'Smart Home Mentor',
  'Product Coach',
  'Experience Designer',
  'Gadget Reviewer',
  'Community Advisor',
]
const TRUSTER_USER_TITLE_OPTIONS = [
  'Growth Strategist',
  'AI Explorer',
  'Platform Researcher',
]
const COMMUNITY_COACH_EMAIL = 'ebru@tipbox.co'
const COMMUNITY_COACH_AVATAR_URL = getSeedMediaPath('user.avatar.coach', true) || getSeedMediaPath('user.avatar.truster3', true) || getSeedMediaPath('user.avatar.default', true) || ''
const TARGET_USER_TITLE = 'Marketplace Strategist'

const MARKETPLACE_NFT_IMAGE_KEYS: SeedMediaKey[] = [
  'badge.wish-marker',
  'badge.premium-shoper',
  'badge.hardware-expert',
  'badge.early-adapter',
  'marketplace.rainbow-border',
]

let marketplaceImageCursor = 0

const nextMarketplaceImage = (): string => {
  const key = MARKETPLACE_NFT_IMAGE_KEYS[marketplaceImageCursor % MARKETPLACE_NFT_IMAGE_KEYS.length]
  marketplaceImageCursor += 1
  return getSeedMediaPath(key, true) ?? ''
}

function generateUlid(): string {
  const timestamp = Date.now().toString(36).toUpperCase().padStart(10, '0')
  const randomPart = Math.random().toString(36).substring(2, 18).toUpperCase().padStart(16, '0')
  return (timestamp + randomPart).substring(0, 26)
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function daysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}
// ==================== PHASE 6: POST CREATION ====================

/**
 * Post oluşturma helper fonksiyonu
 */
async function createPost(data: {
  userId: string
  type: 'QUESTION' | 'TIPS' | 'FREE' | 'COMPARE'
  title: string
  body: string
  productId?: string
  categoryId?: string
  inventoryRequired?: boolean
  createdAt?: Date
}) {
  const postId = generateUlid()
  
  const post = await prisma.contentPost.create({
    data: {
      id: postId,
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body,
      productId: data.productId ?? null,
      categoryId: data.categoryId ?? null,
      inventoryRequired: data.inventoryRequired ?? false,
      isBoosted: false,
      createdAt: data.createdAt ?? new Date(),
      // Counts başlangıçta 0, Phase 7'de gerçek ilişkilerle güncellenecek
      commentsCount: 0,
      likesCount: 0,
      viewsCount: 0,
      sharesCount: 0,
      favoritesCount: 0,
    }
  })
  
  return post
}

/**
 * QUESTION post için PostQuestion kaydı oluştur
 */
async function createPostQuestion(postId: string, productId?: string) {
  const formats: Array<'SHORT' | 'LONG' | 'POLL' | 'CHOICE'> = ['SHORT', 'LONG', 'POLL', 'CHOICE']
  const randomFormat = formats[Math.floor(Math.random() * formats.length)]
  
  await prisma.postQuestion.create({
    data: {
      postId,
      expectedAnswerFormat: randomFormat,
      relatedProductId: productId ?? null,
    }
  })
}

/**
 * TIPS post için PostTip kaydı oluştur
 */
async function createPostTip(postId: string) {
  const categories: Array<'USAGE' | 'PURCHASE' | 'CARE' | 'OTHER'> = ['USAGE', 'PURCHASE', 'CARE', 'OTHER']
  const randomCategory = categories[Math.floor(Math.random() * categories.length)]
  
  await prisma.postTip.create({
    data: {
      postId,
      tipCategory: randomCategory,
      isVerified: false,
    }
  })
}

/**
 * COMPARE post için PostComparison kaydı oluştur
 */
async function createPostComparison(postId: string, product1Id: string, product2Id: string) {
  await prisma.postComparison.create({
    data: {
      postId,
      product1Id,
      product2Id,
    }
  })
}

/**
 * EXPERIENCE post için experience ilişkileri ekle
 */
async function addExperienceRelations(
  postId: string,
  durationId: string,
  locationId: string,
  purposeId: string
) {
  await prisma.contentPost.update({
    where: { id: postId },
    data: {
      experienceDurationId: durationId,
      experienceLocationId: locationId,
      experiencePurposeId: purposeId,
    }
  })
}

/**
 * Post'lara tag ekle
 */
async function seedPostTags() {
  console.log('\n🏷️  Post tagleri ekleniyor...\n')
  
  const allPosts = await prisma.contentPost.findMany()
  
  if (allPosts.length === 0) {
    console.log('⚠️  Post bulunamadı, Tag eklenemiyor!')
    return
  }
  
  // Tag pool'u
  const tagPool = [
    // Electronics tags
    'technology', 'electronics', 'smartphone', 'laptop', 'tablet', 
    'audio', 'camera', 'gaming', 'wearable', 'accessory',
    // Beauty tags
    'beauty', 'skincare', 'makeup', 'fragrance', 'haircare',
    'cosmetics', 'serum', 'moisturizer', 'cleanser', 'sunscreen',
    // General tags
    'review', 'comparison', 'tips', 'guide', 'recommendation',
    'budget', 'premium', 'trending', 'popular', 'new',
  ]
  
  let totalTags = 0
  
  for (const post of allPosts) {
    // Her post için 1-3 tag ekle (config ile)
    const minTags = Math.min(seedConfig.tags.perPostMin, seedConfig.tags.perPostMax)
    const maxTags = Math.max(seedConfig.tags.perPostMin, seedConfig.tags.perPostMax)
    const tagCount = Math.floor(Math.random() * (maxTags - minTags + 1)) + minTags
    const selectedTags = tagPool
      .sort(() => Math.random() - 0.5)
      .slice(0, tagCount)
    
    for (const tag of selectedTags) {
      try {
        await prisma.contentPostTag.create({
          data: {
            postId: post.id,
            tag,
          }
        })
        totalTags++
      } catch (e) {
        // Duplicate ignore
      }
    }
  }
  
  console.log(`✅ ${totalTags} tag eklendi (${allPosts.length} post)`)
  console.log(`   Ortalama: ${(totalTags / allPosts.length).toFixed(1)} tag/post\n`)
}

/**
 * Kullanıcıların inventory'lerine ürün ekle
 * NOT: Bu fonksiyon Products oluşturulduktan SONRA çalıştırılmalı!
 */
async function seedUserInventories() {
  console.log('\n🎒 Kullanıcı inventory\'leri oluşturuluyor...\n')
  
  const users = await prisma.user.findMany({ take: seedConfig.users.total })
  const popularBrandWhere = POPULAR_BRAND_NAMES.map((name) => ({
    name: { equals: name, mode: 'insensitive' as const },
  }))
  const popularCategoryWhere = POPULAR_CATEGORY_NAMES.map((name) => ({
    name: { equals: name, mode: 'insensitive' as const },
  }))
  const allProducts = await prisma.product.findMany({
    include: {
      category: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true } },
    },
    take: 20000,
    where: {
      AND: [
        { brand: { is: { OR: popularBrandWhere } } },
        { category: { is: { OR: popularCategoryWhere } } },
      ],
    },
  })
  
  if (allProducts.length === 0) {
    console.log('⚠️  Ürün bulunamadı, Inventory eklenemiyor!')
    return
  }

  // POPULAR_BRAND_NAMES + POPULAR_CATEGORY_NAMES dışına çıkma:
  // Inventory havuzunu da "popular intersection" ile sınırla ki UGC/post'lar alakasız ürünlere kaymasın.
  const basePool = allProducts.filter(p => Boolean(p.brand?.name) && Boolean(p.category?.name))
  const intersectionPool = basePool.filter(p => isPopularIntersectionProduct(p))
  if (intersectionPool.length === 0) {
    throw new Error(
      `❌ Inventory için popular intersection pool boş. ` +
        `POPULAR_BRAND_NAMES/POPULAR_CATEGORY_NAMES ile DB ürünleri eşleşmiyor olabilir. (basePool=${basePool.length})`,
    )
  }
  const pool = intersectionPool
  const pairMap = buildPairMap(pool)

  // Inventory media için fallback görseller (seed-media-map.json key'leri)
  const availableProductImages: SeedMediaKey[] = [
    'product.phone.phone1',
    'product.phone.samsung',
    'product.laptop.macbook',
    'product.tablet.ipad',
    'product.watch.applewatch',
  ]
  
  let totalInventories = 0
  let totalInventoryMedia = 0
  let skippedNoMedia = 0
  
  for (const user of users) {
    const isFeatured = FEATURED_USER_IDS.includes(user.id)
    const minInv = isFeatured ? seedConfig.inventories.featuredProductsMin : seedConfig.inventories.otherProductsMin
    const maxInv = isFeatured ? seedConfig.inventories.featuredProductsMax : seedConfig.inventories.otherProductsMax
    const inventoryCount = Math.floor(Math.random() * (Math.max(maxInv, minInv) - Math.min(maxInv, minInv) + 1)) + Math.min(maxInv, minInv)
    const selected: typeof pool = []

    // Kullanıcı inventory'sini global picker ile doldur (duplicate engelli)
    const targetCount = Math.min(inventoryCount, pool.length)
    const pickGlobalProduct = createPopularIntersectionBeautyRatioPicker({
      pool,
      pairMap,
      totalPicks: targetCount,
      beautyTargetRatio: DEFAULT_BEAUTY_TARGET_RATIO,
      dedupe: true,
    })
    let guard = 0
    while (selected.length < targetCount && guard < targetCount * 25) {
      guard++
      const p = pickGlobalProduct()
      if (selected.some(x => x.id === p.id)) continue
      selected.push(p)
    }
    const userProducts = selected.length > 0 ? selected : pool.slice(0, targetCount)
    
    for (const product of userProducts) {
      // Inventory kaydı oluştur
      const inventory = await prisma.inventory.upsert({
        where: {
          userId_productId: {
            userId: user.id,
            productId: product.id
          }
        },
        create: {
          userId: user.id,
          productId: product.id,
          hasOwned: true,
          experienceSummary: `Bu ${product.name} ürününü kullanıyorum. Deneyimlerimi paylaşacağım.`,
        },
        update: {
          hasOwned: true,
        }
      })
      totalInventories++
      
      // InventoryMedia ekle (config)
      if (Math.random() < seedConfig.inventories.mediaProbability) {
        const existingMedia = await prisma.inventoryMedia.findFirst({
          where: { inventoryId: inventory.id }
        })
        
        if (!existingMedia) {
          // Ürün için mevcut görseli kullan veya random product image seç
          let mediaUrl: string | null = null
          
          // Önce ürünün kendi görselini kullanmayı dene
          if (product.imageUrl) {
            mediaUrl = product.imageUrl
          } else {
            // Ürün görseli yoksa random product image seç
            const randomImageKey = availableProductImages[Math.floor(Math.random() * availableProductImages.length)]
            mediaUrl = getSeedMediaPath(randomImageKey, true)
          }
          
          if (mediaUrl) {
            try {
              await prisma.inventoryMedia.create({
                data: {
                  inventoryId: inventory.id,
                  mediaUrl,
                }
              })
              totalInventoryMedia++
            } catch (error) {
              console.log(`⚠️  Inventory media oluşturulamadı: ${error}`)
              skippedNoMedia++
            }
          } else {
            skippedNoMedia++
          }
        }
      }
    }
  }
  
  console.log('\n' + '═'.repeat(80))
  console.log('✨ USER INVENTORIES TAMAMLANDI\n')
  console.log(`   🎒 Toplam Inventory: ${totalInventories}`)
  console.log(`   📸 Toplam Inventory Media: ${totalInventoryMedia}`)
  console.log(`   ⏭️  Atlanan (görsel yok): ${skippedNoMedia}`)
  console.log(`   👥 Kullanıcı Başına Ortalama: ${(totalInventories / users.length).toFixed(1)} ürün`)
  console.log(`   📊 Media Oranı: ${((totalInventoryMedia / totalInventories) * 100).toFixed(1)}%`)
  console.log('═'.repeat(80) + '\n')
}

/**
 * 30 Persona Tanımları (GENERATE_POST_AI.md'den)
 */
const PERSONAS = {
  // Grup A: Tüketici Elektroniği Odaklılar (15 Persona)
  ELECTRONICS: [
    'Teknoloji Gurusu: En küçük teknik detaya (ms, nits, ppi) takılan uzman.',
    'Pratik Anne/Baba: "Çocuğun elinden düşmüyor, sağlammış" diyen ebeveyn.',
    'Bütçe Dostu Öğrenci: Fiyat/performans canavarı arayan genç.',
    'Minimalist Profesyonel: Sadece işini yapmasını ve şık durmasını isteyen beyaz yakalı.',
    'Hardcore Gamer: FPS değerleri ve RGB aydınlatma tutkunu.',
    'İçerik Üreticisi/Vlogger: Kamera kalitesi ve mikrofon odaklı yaşayan.',
    'Dijital Göçebe: Taşınabilirlik ve pil ömrü hastası gezgin.',
    'Ev Kuşu: Akıllı ev sistemleri ve konfor odaklı kullanıcı.',
    'Sporcu/Fitness Tutkunu: Wearable (giyilebilir) teknoloji ve dayanıklılık odaklı.',
    'Retro Sever: Modern cihazda nostalji veya sadelik arayan.',
    'Hediye Alıcı: "Eşime aldım, çok sevindi" diyen duygusal alıcı.',
    'Yaşlı Kullanıcı: "Karışık değil, kullanımı kolay" diyen emekli.',
    'Ofis Müdürü: Kurumsal verimlilik ve dayanıklılık odaklı.',
    'Yazılımcı: Fonksiyonellik ve özelleştirilebilirlik arayan.',
    'Müzik Tutkunu: Ses kalitesi ve izolasyon odaklı.',
  ],
  // Grup B: Kozmetik ve Bakım Odaklılar (15 Persona)
  COSMETICS: [
    'Skincare Minimalisti: Sadece 3 ürünle rutinini bitiren.',
    'Makyaj Artisti: Ürünün pigmentasyonu ve kalıcılığına odaklanan profesyonel.',
    'Organik Yaşam Savunucusu: İçerik listesi (temiz içerik) okuyan bilinçli tüketici.',
    'Hassas Ciltli: "Asla sivilce yapmadı" diyen temkinli kullanıcı.',
    'Lüks Marka Tutkunu: Paketleme ve prestij odaklı kullanıcı.',
    'K-Beauty Hayranı: Kore cilt bakımı trendlerini takip eden.',
    'Yoğun Çalışan Kadın: "Sabah sürdüm akşam hala duruyor" diyen pratik kullanıcı.',
    'Güzellik Influencer\'ı: Trendleri takip eden ve karşılaştırma yapan.',
    'Erkek Bakım Meraklısı: Sakal, saç veya basit cilt bakımı odaklı erkek kullanıcı.',
    'Anti-Aging Odaklı: İnce çizgiler ve sıkılaşma bekleyen 40+ kullanıcı.',
    'Genç/Ergen: Sivilce karşıtı ve uygun fiyatlı ürün arayan.',
    'Vegan/Cruelty-Free: Hayvan deneyi yapılmayan ürünleri tercih eden.',
    'Dermokozmetik Takipçisi: Eczane ürünlerini ve bilimsel içeriği seven.',
    'Koku Hassasiyeti Olan: Parfümsüz veya çok güzel kokan ürün arayan.',
    'Hızlı Hazırlanan: "5 dakikada günlük makyajımı bitiriyorum" diyen kişi.',
  ],
};

/**
 * Rastgele bir persona seç
 */
function getRandomPersona(productCategory?: string): string {
  const allPersonas = [...PERSONAS.ELECTRONICS, ...PERSONAS.COSMETICS];
  
  // Eğer kategori bilgisi varsa, uygun gruptan seç
  if (productCategory) {
    const categoryLower = productCategory.toLowerCase();
    const isElectronics = categoryLower.includes('electron') || 
                         categoryLower.includes('tech') ||
                         categoryLower.includes('phone') ||
                         categoryLower.includes('laptop') ||
                         categoryLower.includes('tablet');
    
    if (isElectronics) {
      return PERSONAS.ELECTRONICS[Math.floor(Math.random() * PERSONAS.ELECTRONICS.length)];
    } else {
      return PERSONAS.COSMETICS[Math.floor(Math.random() * PERSONAS.COSMETICS.length)];
    }
  }
  
  // Kategori bilgisi yoksa rastgele seç
  return allPersonas[Math.floor(Math.random() * allPersonas.length)];
}

/**
 * Post görsellerini S3'e yükle ve URL'lerini döndür
 */
async function uploadPostImages(): Promise<Map<string, string>> {
  const s3Service = new S3Service()
  const postImagesDir = path.join(__dirname, '../tests/assets/post-images')
  const imageUrlMap = new Map<string, string>()
  
  if (!existsSync(postImagesDir)) {
    console.warn(`⚠️  Post görselleri klasörü bulunamadı: ${postImagesDir}`)
    return imageUrlMap
  }
  
  const imageFiles = [
    'electronic-post-1.jpg', 'electronic-post-2.jpg', 'electronic-post-3.jpg',
    'electronic-post-4.jpg', 'electronic-post-5.jpg', 'electronic-post-6.jpg',
    'electronic-post-7.jpg', 'electronic-post-8.jpg', 'electronic-post-9.jpg',
    'electronic-post-10.jpg',
    'makeup-post-1.jpg', 'makeup-post-2.jpg', 'makeup-post-3.jpg',
    'makeup-post-4.jpg', 'makeup-post-5.jpg', 'makeup-post-6.jpg',
    'makeup-post-7.jpg', 'makeup-post-8.jpg', 'makeup-post-9.jpg',
    'makeup-post-10.jpg',
    'phone1.png', 'phone2.png', 'phone3.png', 'phone4.png', 'phone5.png', 'phone6.png',
    'headphone.png', 'headphone2.png',
    'macbook.png', 'smartwatch.png', 'dyson.png', 'samsun.png'
  ]
  
  console.log('📸 Post görselleri S3\'e yükleniyor...\n')
  let uploadedCount = 0
  let skippedCount = 0
  
  for (const imageFile of imageFiles) {
    const localPath = path.join(postImagesDir, imageFile)
    
    if (!existsSync(localPath)) {
      console.warn(`  ⚠️  Dosya bulunamadı: ${imageFile}`)
      continue
    }
    
    try {
      const s3Key = `posts/seed-images/${imageFile}`
      const exists = await s3Service.fileExists(s3Key)
      
      if (exists) {
        skippedCount++
        imageUrlMap.set(imageFile, s3Key)
        continue
      }
      
      const fileBuffer = readFileSync(localPath)
      const contentType = imageFile.endsWith('.png') ? 'image/png' : 'image/jpeg'
      
      await s3Service.uploadFile(s3Key, fileBuffer, contentType)
      imageUrlMap.set(imageFile, s3Key)
      uploadedCount++
      
      if (uploadedCount % 5 === 0) {
        console.log(`  ✅ ${uploadedCount} görsel yüklendi...`)
      }
    } catch (error) {
      console.warn(`  ⚠️  ${imageFile} yüklenemedi:`, error instanceof Error ? error.message : String(error))
    }
  }
  
  console.log(`  ✅ ${uploadedCount} yeni görsel yüklendi, ${skippedCount} görsel zaten mevcut\n`)
  return imageUrlMap
}

/**
 * Post için uygun görsel seç (kategori, marka veya ürün adına göre)
 */
function selectPostImage(
  productName: string,
  brandName: string | null | undefined,
  categoryName: string | null | undefined,
  imageUrlMap: Map<string, string>
): string | null {
  if (imageUrlMap.size === 0) {
    return null
  }
  
  const productLower = productName.toLowerCase()
  const brandLower = brandName?.toLowerCase() || ''
  const categoryLower = categoryName?.toLowerCase() || ''
  
  // Marka bazlı eşleştirme
  if (brandLower.includes('samsung') || productLower.includes('samsung')) {
    const samsungImage = imageUrlMap.get('samsun.png')
    if (samsungImage) return samsungImage
  }
  
  if (productLower.includes('dyson') || brandLower.includes('dyson')) {
    const dysonImage = imageUrlMap.get('dyson.png')
    if (dysonImage) return dysonImage
  }
  
  // Ürün tipi bazlı eşleştirme
  if (productLower.includes('phone') || productLower.includes('smartphone') || 
      categoryLower.includes('phone') || categoryLower.includes('smartphone')) {
    const phoneImages = ['phone1.png', 'phone2.png', 'phone3.png', 'phone4.png', 'phone5.png', 'phone6.png']
    const randomPhone = phoneImages[Math.floor(Math.random() * phoneImages.length)]
    const phoneImage = imageUrlMap.get(randomPhone)
    if (phoneImage) return phoneImage
  }
  
  if (productLower.includes('headphone') || productLower.includes('earphone') ||
      categoryLower.includes('headphone') || categoryLower.includes('audio')) {
    const headphoneImages = ['headphone.png', 'headphone2.png']
    const randomHeadphone = headphoneImages[Math.floor(Math.random() * headphoneImages.length)]
    const headphoneImage = imageUrlMap.get(randomHeadphone)
    if (headphoneImage) return headphoneImage
  }
  
  if (productLower.includes('macbook') || productLower.includes('laptop') ||
      categoryLower.includes('laptop') || categoryLower.includes('computer')) {
    const macbookImage = imageUrlMap.get('macbook.png')
    if (macbookImage) return macbookImage
  }
  
  if (productLower.includes('watch') || productLower.includes('smartwatch') ||
      categoryLower.includes('watch') || categoryLower.includes('wearable')) {
    const watchImage = imageUrlMap.get('smartwatch.png')
    if (watchImage) return watchImage
  }
  
  // Kategori bazlı eşleştirme
  if (categoryLower.includes('electronic') || categoryLower.includes('electronics') ||
      categoryLower.includes('tech') || categoryLower.includes('technology')) {
    const electronicImages = [
      'electronic-post-1.jpg', 'electronic-post-2.jpg', 'electronic-post-3.jpg',
      'electronic-post-4.jpg', 'electronic-post-5.jpg', 'electronic-post-6.jpg',
      'electronic-post-7.jpg', 'electronic-post-8.jpg', 'electronic-post-9.jpg',
      'electronic-post-10.jpg'
    ]
    const randomElectronic = electronicImages[Math.floor(Math.random() * electronicImages.length)]
    const electronicImage = imageUrlMap.get(randomElectronic)
    if (electronicImage) return electronicImage
  }
  
  if (categoryLower.includes('makeup') || categoryLower.includes('cosmetic') ||
      categoryLower.includes('beauty') || categoryLower.includes('skincare')) {
    const makeupImages = [
      'makeup-post-1.jpg', 'makeup-post-2.jpg', 'makeup-post-3.jpg',
      'makeup-post-4.jpg', 'makeup-post-5.jpg', 'makeup-post-6.jpg',
      'makeup-post-7.jpg', 'makeup-post-8.jpg', 'makeup-post-9.jpg',
      'makeup-post-10.jpg'
    ]
    const randomMakeup = makeupImages[Math.floor(Math.random() * makeupImages.length)]
    const makeupImage = imageUrlMap.get(randomMakeup)
    if (makeupImage) return makeupImage
  }
  
  // Eşleşme bulunamazsa rastgele bir elektronik görseli
  const allElectronicImages = [
    'electronic-post-1.jpg', 'electronic-post-2.jpg', 'electronic-post-3.jpg',
    'electronic-post-4.jpg', 'electronic-post-5.jpg', 'electronic-post-6.jpg',
    'electronic-post-7.jpg', 'electronic-post-8.jpg', 'electronic-post-9.jpg',
    'electronic-post-10.jpg'
  ]
  const randomFallback = allElectronicImages[Math.floor(Math.random() * allElectronicImages.length)]
  return imageUrlMap.get(randomFallback) || null
}

/**
 * Post oluştur (config ile: toplam post sayısı ve kullanıcı dağılımı kontrol edilir)
 */
async function seedPosts() {
  console.log('\n📝 Post oluşturma başlıyor...\n')
  
  // Post görsellerini S3'e yükle
  const postImageUrlMap = await uploadPostImages()

  // Kullanıcıları getir (config)
  const allUsers = await prisma.user.findMany({
    take: seedConfig.users.total,
    orderBy: { createdAt: 'asc' }
  })

  if (allUsers.length < seedConfig.users.total) {
    console.log(`⚠️ Sadece ${allUsers.length} kullanıcı bulundu, devam ediliyor...`)
  }

  // Öne çıkan kullanıcıları önce al, sonra diğerlerini ekle
  const featuredUsers = allUsers.filter(u => FEATURED_USER_IDS.includes(u.id))
  const otherUsers = allUsers.filter(u => !FEATURED_USER_IDS.includes(u.id))
  const users = [...featuredUsers, ...otherUsers].slice(0, seedConfig.users.total)

  console.log(
    `👥 Toplam ${users.length} kullanıcı (${featuredUsers.length} öne çıkan, ${otherUsers.length} diğer) | ` +
      `Post authors: ${seedConfig.posts.featuredOnly ? 'featured-only' : 'featured+others'}`,
  )
  
  // Experience taxonomy'leri getir
  const durations = await prisma.experienceDuration.findMany()
  const locations = await prisma.experienceLocation.findMany()
  const purposes = await prisma.experiencePurpose.findMany()

  // Hedef post sayısı
  const TARGET_TOTAL_POSTS = Math.max(0, seedConfig.posts.total)
  let currentPostCount = 0
  
  // Tüm ürünleri çek (brand ve category ile birlikte)
  const popularBrandWhere = POPULAR_BRAND_NAMES.map((name) => ({
    name: { equals: name, mode: 'insensitive' as const },
  }))
  const popularCategoryWhere = POPULAR_CATEGORY_NAMES.map((name) => ({
    name: { equals: name, mode: 'insensitive' as const },
  }))
  const allProducts = await prisma.product.findMany({
    include: {
      category: {
        select: {
          id: true,
          name: true,
          mpath: true,
          parentId: true
        }
      },
      brand: {
        select: {
          id: true,
          name: true
        }
      }
    },
    take: 20000, // POPULAR intersection filtresi ile gerçek adet zaten sınırlı kalıyor
    where: {
      AND: [
        { brand: { is: { OR: popularBrandWhere } } },
        { category: { is: { OR: popularCategoryWhere } } },
      ],
    },
  })

  // Çeşitlilik: tüm ürün havuzundan seç (brand+category olanlar öncelikli)
  const basePool = allProducts.filter(p => Boolean(p.brand?.name) && Boolean(p.category?.name))
  let products = basePool.length > 0 ? basePool : allProducts

  // POPULAR_BRAND_NAMES + POPULAR_CATEGORY_NAMES dışına çıkma:
  // Post'larda kullanılacak ürünleri kesin olarak "popular intersection" ile sınırla.
  const intersectionProducts = products.filter(p => isPopularIntersectionProduct(p))
  if (intersectionProducts.length === 0) {
    throw new Error(
      `❌ Post için popular intersection pool boş. ` +
        `POPULAR_BRAND_NAMES/POPULAR_CATEGORY_NAMES ile DB ürünleri eşleşmiyor olabilir. (products=${products.length})`,
    )
  }
  products = intersectionProducts

  if (products.length === 0) {
    throw new Error('❌ Ürün bulunamadı! Önce Phase 5 tamamlanmalı.')
  }

  const pairMap = buildPairMap(products)
  const pickGlobalProduct = createPopularIntersectionBeautyRatioPicker({
    pool: products,
    pairMap,
    totalPicks: TARGET_TOTAL_POSTS,
    beautyTargetRatio: DEFAULT_BEAUTY_TARGET_RATIO,
    dedupe: false,
  })
  
  console.log(`📊 ${products.length} ürün bulundu (çeşitli ürün havuzu)\n`)
  
  let totalPosts = 0
  let successfulPosts = 0
  let failedPosts = 0
  const postTypes: Array<'QUESTION' | 'TIPS' | 'FREE' | 'EXPERIENCE' | 'COMPARE' | 'UPDATE'> = [
    'QUESTION', 'TIPS', 'FREE', 'EXPERIENCE', 'COMPARE', 'UPDATE'
  ]
  
  // GeminiService instance'ı
  const geminiService = GeminiService.getInstance()
  
  // Batch processing için konfigürasyon
  const BATCH_SIZE = Math.max(1, seedConfig.posts.batchSize)
  const BATCH_DELAY = Math.max(0, seedConfig.posts.batchDelayMs)
  
  // Tüm post isteklerini topla (batch processing için)
  interface PostRequest {
    user: typeof users[0]
    postType: typeof postTypes[number]
    selectedProduct: typeof products[0] & { category?: { id: string; name: string; mpath: string | null; parentId: string | null } | null; brand?: { id: string; name: string } | null }
    persona: string
    createdAt: Date
    userInventory: Array<{ product: typeof products[0] & { category?: { id: string; name: string; mpath: string | null; parentId: string | null } | null; brand?: { id: string; name: string } | null } }>
  }
  
  const allPostRequests: PostRequest[] = []

  // Varsayılan: sadece featured user’lar post paylaşsın
  const postAuthors = seedConfig.posts.featuredOnly ? featuredUsers : users

  for (const user of postAuthors) {
    // murat ve nil için post oluşturma
    if (user.email === 'murat@tipbox.co' || user.email === 'nil@tipbox.co') {
      console.log(`  ⏭️  ${user.email} için post oluşturma atlanıyor (boş profil)`)
      continue
    }
    
    // Kullanıcının inventory'sindeki ürünleri getir (EXPERIENCE ve UPDATE için)
    const rawUserInventory = await prisma.inventory.findMany({
      where: { userId: user.id },
      include: {
        product: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                mpath: true,
                parentId: true
              }
            },
            brand: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })
    const userInventoryProducts = rawUserInventory.map(inv => inv.product)
    
    // Featured kullanıcılar: her tipten 1-3 post (toplam hedefe göre kırpılır)
    // Non-featured kullanıcılar: bu loop içinde post üretilmez (aşağıda user başına 1-2 opsiyonel)
    const isFeatured = FEATURED_USER_IDS.includes(user.id)
    const minPostsPerType = isFeatured ? 1 : 0
    const maxPostsPerType = isFeatured ? 3 : 0
    
    // Her tipten post isteği oluştur (min/max aralığı config hedefine göre seçildi)
    for (const postType of postTypes) {
      // Hedef post sayısına ulaşıldıysa dur
      if (currentPostCount >= TARGET_TOTAL_POSTS) {
        break
      }
      
      const postCountForType = Math.floor(Math.random() * (maxPostsPerType - minPostsPerType + 1)) + minPostsPerType
      
      for (let i = 1; i <= postCountForType; i++) {
        // Hedef post sayısına ulaşıldıysa dur
        if (currentPostCount >= TARGET_TOTAL_POSTS) {
          break
        }
        
        let selectedProduct

        // EXPERIENCE ve UPDATE: inventory'den seç (yoksa global havuzdan seçip inventory'ye ekle)
        if (postType === 'EXPERIENCE' || postType === 'UPDATE') {
          if (userInventoryProducts.length > 0) {
            selectedProduct = userInventoryProducts[Math.floor(Math.random() * userInventoryProducts.length)]
          } else {
            // Inventory boşsa: global havuzdan seç, inventory'ye ekle ve onu kullan
            selectedProduct = pickGlobalProduct()
            await prisma.inventory.upsert({
              where: {
                userId_productId: {
                  userId: user.id,
                  productId: selectedProduct.id,
                },
              },
              create: {
                userId: user.id,
                productId: selectedProduct.id,
                hasOwned: true,
                experienceSummary: `Bu ${selectedProduct.name} ürününü kullanıyorum. Deneyimlerimi paylaşacağım.`,
              },
              update: { hasOwned: true },
            })
            userInventoryProducts.push(selectedProduct)
          }
        } else {
          // Diğer tipler: doğrudan çeşitli havuzdan ürün seç
          selectedProduct = pickGlobalProduct()
        }
        
        const createdAt = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000) // Son 90 gün içinde
        
        // Persona seç (kategori bilgisine göre)
        const productCategory = selectedProduct.category?.name || ''
        const persona = getRandomPersona(productCategory)
        
        allPostRequests.push({
          user,
          postType,
          selectedProduct,
          persona,
          createdAt,
          userInventory: userInventoryProducts.map(product => ({ product })),
        })
        
        currentPostCount++
      }
    }
    
    // Hedef post sayısına ulaşıldıysa döngüden çık
    if (currentPostCount >= TARGET_TOTAL_POSTS) {
      break
    }
  }

  // Diğer kullanıcılar için opsiyonel 1-2 post (toplam hedefe ulaşmak için)
  if (!seedConfig.posts.featuredOnly && currentPostCount < TARGET_TOTAL_POSTS) {
    const minExtra = Math.min(seedConfig.posts.otherUsersPostsMin, seedConfig.posts.otherUsersPostsMax)
    const maxExtra = Math.max(seedConfig.posts.otherUsersPostsMin, seedConfig.posts.otherUsersPostsMax)

    for (const user of otherUsers) {
      if (currentPostCount >= TARGET_TOTAL_POSTS) break
      if (user.email === 'murat@tipbox.co' || user.email === 'nil@tipbox.co') continue

      const extraCount = Math.floor(Math.random() * (maxExtra - minExtra + 1)) + minExtra
      for (let i = 0; i < extraCount; i++) {
        if (currentPostCount >= TARGET_TOTAL_POSTS) break

        // Other users: inventory bağımlılığı olan tipleri üretme (EXPERIENCE/UPDATE)
        const otherAllowedTypes = postTypes.filter(t => t !== 'EXPERIENCE' && t !== 'UPDATE')
        const postType = otherAllowedTypes[Math.floor(Math.random() * otherAllowedTypes.length)]
        const selectedProduct = pickGlobalProduct()
        const createdAt = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000)
        const persona = getRandomPersona(selectedProduct.category?.name || '')

        allPostRequests.push({
          user,
          postType,
          selectedProduct,
          persona,
          createdAt,
          userInventory: [],
        })
        currentPostCount++
      }
    }
  }

  // Eğer hedef sayıya ulaşılmadıysa, featured kullanıcılara daha fazla post ekle
  if (currentPostCount < TARGET_TOTAL_POSTS) {
    const remainingPosts = TARGET_TOTAL_POSTS - currentPostCount
    console.log(`  📝 Hedef sayıya ulaşmak için ${remainingPosts} post daha ekleniyor (öne çıkan kullanıcılara)...`)
    
    for (const user of featuredUsers) {
      if (currentPostCount >= TARGET_TOTAL_POSTS) {
        break
      }
      
      const rawUserInventory = await prisma.inventory.findMany({
        where: { userId: user.id },
        include: {
          product: {
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  mpath: true,
                  parentId: true
                }
              },
              brand: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      })
      const userInventoryProducts = rawUserInventory.map(inv => inv.product)
      
      const additionalPosts = Math.min(remainingPosts - (TARGET_TOTAL_POSTS - currentPostCount), 5)
      
      for (let i = 0; i < additionalPosts; i++) {
        if (currentPostCount >= TARGET_TOTAL_POSTS) {
          break
        }
        
        const postType = postTypes[Math.floor(Math.random() * postTypes.length)]
        let selectedProduct

        if (postType === 'EXPERIENCE' || postType === 'UPDATE') {
          if (userInventoryProducts.length > 0) {
            selectedProduct = userInventoryProducts[Math.floor(Math.random() * userInventoryProducts.length)]
          } else {
            selectedProduct = pickGlobalProduct()
            await prisma.inventory.upsert({
              where: {
                userId_productId: {
                  userId: user.id,
                  productId: selectedProduct.id,
                },
              },
              create: {
                userId: user.id,
                productId: selectedProduct.id,
                hasOwned: true,
                experienceSummary: `Bu ${selectedProduct.name} ürününü kullanıyorum. Deneyimlerimi paylaşacağım.`,
              },
              update: { hasOwned: true },
            })
            userInventoryProducts.push(selectedProduct)
          }
        } else {
          selectedProduct = pickGlobalProduct()
        }
        
        const createdAt = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000)
        const productCategory = selectedProduct.category?.name || ''
        const persona = getRandomPersona(productCategory)
        
        allPostRequests.push({
          user,
          postType,
          selectedProduct,
          persona,
          createdAt,
          userInventory: userInventoryProducts.map(product => ({ product })),
        })
        
        currentPostCount++
      }
    }
  }
  
  console.log(`📦 Toplam ${allPostRequests.length} post isteği hazırlandı, batch processing başlıyor...\n`)
  
  // Batch'ler halinde işle
  const batches: PostRequest[][] = []
  for (let i = 0; i < allPostRequests.length; i += BATCH_SIZE) {
    batches.push(allPostRequests.slice(i, i + BATCH_SIZE))
  }
  
  console.log(`📊 ${batches.length} batch oluşturuldu (her batch'te maksimum ${BATCH_SIZE} post)\n`)
  
  // Her batch'i işle
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]
    console.log(`  🔄 Batch ${batchIndex + 1}/${batches.length} işleniyor (${batch.length} post)...`)
    
    // Batch için AI isteklerini hazırla
    const aiRequests = batch.map(req => ({
      postType: req.postType,
      persona: req.persona,
      productName: req.selectedProduct.name,
      productBrand: req.selectedProduct.brand?.name,
      productDescription: req.selectedProduct.description || undefined,
    }))
    
    // Batch AI isteği gönder
    let batchResults: Array<{ title: string; body: string; success: boolean }> = []
    
    try {
      const batchResponse = await geminiService.batchGeneratePostContent({
        requests: aiRequests,
      })
      
      batchResults = batchResponse.results.map(r => ({
        title: r.title || '', // Title boş kalacak
        body: r.body || '',
        success: r.success,
      }))
      
      successfulPosts += batchResponse.metadata.successfulRequests
      failedPosts += batchResponse.metadata.failedRequests
      
      console.log(`    ✅ Batch ${batchIndex + 1} tamamlandı: ${batchResponse.metadata.successfulRequests}/${batch.length} başarılı`)
    } catch (error) {
      console.warn(`    ⚠️  Batch ${batchIndex + 1} AI hatası:`, error instanceof Error ? error.message : String(error))
      // Hata durumunda tüm batch için fallback
      batchResults = batch.map(() => ({
        title: '',
        body: '',
        success: false,
      }))
      failedPosts += batch.length
    }
    
    // Her post için veritabanına kaydet
    for (let i = 0; i < batch.length; i++) {
      const req = batch[i]
      const aiResult = batchResults[i] || { title: '', body: '', success: false }
      
      // Fallback body (AI başarısız olursa)
      const title = '' // Title boş kalacak
      const body = aiResult.success && aiResult.body
        ? aiResult.body
        : `Bu bir ${req.postType} tipi içerik. ${req.selectedProduct.name} hakkında detaylı bilgi ve deneyimler paylaşılıyor. Ürünü kullanma deneyimim oldukça olumlu oldu. Kaliteli malzeme ve iyi tasarım dikkat çekiyor.`
      
      const post = await createPost({
        userId: req.user.id,
        type: req.postType,
        title,
        body,
        productId: req.selectedProduct.id,
        categoryId: req.selectedProduct.categoryId || undefined,
        inventoryRequired: req.postType === 'EXPERIENCE' || req.postType === 'UPDATE',
        createdAt: req.createdAt,
      })
      
      // Post tipine göre ilişkili kayıtlar oluştur
      if (req.postType === 'QUESTION') {
        await createPostQuestion(post.id, req.selectedProduct.id)
      } else if (req.postType === 'TIPS') {
        await createPostTip(post.id)
      } else if (req.postType === 'COMPARE') {
        // Aynı kategorideki ürünleri filtrele
        const sameCategoryProducts = products.filter(
          p => p.id !== req.selectedProduct.id && 
               p.category?.id === req.selectedProduct.category?.id
        )
        
        let product2: typeof products[0]
        if (sameCategoryProducts.length > 0) {
          // Aynı kategoride başka ürün varsa onlardan seç
          product2 = sameCategoryProducts[Math.floor(Math.random() * sameCategoryProducts.length)]
        } else {
          // Aynı kategoride başka ürün yoksa, farklı bir ürün seç (fallback)
          let attempts = 0
          do {
            product2 = pickGlobalProduct()
            attempts++
          } while (product2.id === req.selectedProduct.id && attempts < 10)
        }
        await createPostComparison(post.id, req.selectedProduct.id, product2.id)
      } else if (req.postType === 'EXPERIENCE' && durations.length > 0 && locations.length > 0 && purposes.length > 0) {
        const randomDuration = durations[Math.floor(Math.random() * durations.length)]
        const randomLocation = locations[Math.floor(Math.random() * locations.length)]
        const randomPurpose = purposes[Math.floor(Math.random() * purposes.length)]
        await addExperienceRelations(post.id, randomDuration.id, randomLocation.id, randomPurpose.id)
      }
      
      // PostMedia ekle (bazı postlara)
      // %10 şansla post-images klasöründeki görsellerden birini ekle
      if (Math.random() < 0.1 && postImageUrlMap.size > 0) {
        const selectedImageUrl = selectPostImage(
          req.selectedProduct.name,
          req.selectedProduct.brand?.name,
          req.selectedProduct.category?.name,
          postImageUrlMap
        )
        
        if (selectedImageUrl) {
          await prisma.postMedia.create({
            data: {
              postId: post.id,
              userId: req.user.id,
              mediaUrl: selectedImageUrl,
              orderIndex: 0,
            }
          })
        }
      } else if (Math.random() > 0.7) {
        // %30 şansla (kalan %90'ın %30'u = toplam %27) seed media'dan görsel ekle
        const mediaKeys: SeedMediaKey[] = [
          'product.phone.phone1', 'product.phone.samsung', 'product.laptop.macbook',
          'product.tablet.ipad', 'product.watch.applewatch',
        ]
        const randomMediaKey = mediaKeys[Math.floor(Math.random() * mediaKeys.length)]
        const mediaUrl = getSeedMediaPath(randomMediaKey, true)
        
        if (mediaUrl) {
          await prisma.postMedia.create({
            data: {
              postId: post.id,
              userId: req.user.id,
              mediaUrl,
              orderIndex: 0,
            }
          })
        }
      }
      
      totalPosts++
    }
    
    // Her batch sonrası ilerleme göster
    const progress = ((totalPosts / allPostRequests.length) * 100).toFixed(1)
    console.log(`    ⏳ İlerleme: ${totalPosts}/${allPostRequests.length} post (${progress}%) | Başarılı: ${successfulPosts} | Başarısız: ${failedPosts}\n`)
    
    // Batch'ler arası delay (rate limiting için)
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY))
    }
  }
  
  // Kullanıcı bazında post sayılarını güncelle
  const userPostCounts = new Map<string, number>()
  for (const req of allPostRequests) {
    userPostCounts.set(req.user.id, (userPostCounts.get(req.user.id) || 0) + 1)
  }
  
  for (const [userId, count] of userPostCounts.entries()) {
    await prisma.profile.update({
      where: { userId },
      data: { postsCount: count }
    }).catch(() => {
      // Hata durumunda sessizce devam et
    })
  }
  
  console.log(`\n✅ Tüm kullanıcılar için post sayıları güncellendi\n`)
  
  console.log(`\n✨ Toplam ${totalPosts} post oluşturuldu!\n`)
  console.log(`   📊 Kullanıcı sayısı: ${users.length}`)
  console.log(`   📝 Her kullanıcı: Her tipten 1-8 arası random sayıda post`)
  console.log(`   ✅ AI ile başarılı: ${successfulPosts}`)
  console.log(`   ❌ AI ile başarısız (fallback kullanıldı): ${failedPosts}\n`)
}

// ==================== PHASE 7: SOCIAL FEATURES ====================

/**
 * Social features oluştur (likes, comments, views, shares, favorites)
 * Count alanlarını gerçek verilerle güncelle
 */
async function seedSocialFeatures() {
  console.log('\n❤️ Social features oluşturuluyor...\n')

  if (!seedConfig.interactions.enabled) {
    console.log('ℹ️  Social features (interactions) kapalı: SEED_INTERACTIONS_ENABLED=false\n')
    return
  }
  
  // Tüm kullanıcıları ve postları getir
  const users = await prisma.user.findMany({ take: seedConfig.users.total })
  const allPosts = await prisma.contentPost.findMany()
  
  if (allPosts.length === 0) {
    console.log('⚠️ Post bulunamadı, Phase 7 atlanıyor...')
    return
  }
  
  console.log(`📊 ${allPosts.length} post için social features ekleniyor...\n`)
  
  let totalLikes = 0
  let totalComments = 0
  let totalViews = 0
  let totalShares = 0
  let totalFavorites = 0
  
  const randInt = (min: number, max: number) => {
    const lo = Math.min(min, max)
    const hi = Math.max(min, max)
    return Math.floor(Math.random() * (hi - lo + 1)) + lo
  }

  // 1. LIKES
  console.log('❤️ Likes ekleniyor...')
  for (const post of allPosts) {
    const likeCount = randInt(seedConfig.interactions.likesPerPostMin, seedConfig.interactions.likesPerPostMax)
    if (likeCount <= 0) continue
    const availableLikers = Math.min(likeCount, users.length)
    const likerUsers = users.sort(() => Math.random() - 0.5).slice(0, availableLikers)
    
    for (const user of likerUsers) {
      try {
        await prisma.contentLike.create({
          data: {
            userId: user.id,
            postId: post.id,
            createdAt: new Date(post.createdAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000),
          }
        })
        totalLikes++
      } catch (e) {
        // Duplicate ignore
      }
    }
    
    // Her 100 post'ta bir progress göster
    if (totalLikes % 5000 === 0) {
      console.log(`  ⏳ ${totalLikes} like eklendi...`)
    }
  }
  console.log(`  ✅ ${totalLikes} like eklendi`)
  
  // 2. VIEWS
  console.log('👁️ Views ekleniyor...')
  for (const post of allPosts) {
    const viewCount = randInt(seedConfig.interactions.viewsPerPostMin, seedConfig.interactions.viewsPerPostMax)
    if (viewCount <= 0) continue
    
    for (let i = 0; i < viewCount; i++) {
      const isAuthenticatedView = Math.random() > 0.3 // %70 authenticated
      const viewerUser = isAuthenticatedView ? users[Math.floor(Math.random() * users.length)] : null
      
      await prisma.contentPostView.create({
        data: {
          postId: post.id,
          userId: viewerUser?.id ?? null,
          viewerIp: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
          viewedAt: new Date(post.createdAt.getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000),
        }
      })
      totalViews++
    }
    
    // Her 100 post'ta bir progress göster
    if ((allPosts.indexOf(post) + 1) % 100 === 0) {
      console.log(`  ⏳ ${allPosts.indexOf(post) + 1}/${allPosts.length} post işlendi (${totalViews} view)`)
    }
  }
  console.log(`  ✅ ${totalViews} view eklendi`)
  
  // 3. COMMENTS
  console.log('💬 Comments ekleniyor...')
  const allComments: string[] = []
  
  for (const post of allPosts) {
    const commentCount = randInt(seedConfig.interactions.commentsPerPostMin, seedConfig.interactions.commentsPerPostMax)
    if (commentCount <= 0) continue
    // Post sahibine self-comment verme (daha gerçekçi)
    const eligibleUsers = users.filter((u) => u.id !== post.userId)
    const base = eligibleUsers.length ? eligibleUsers : users
    const commenters = [...base].sort(() => Math.random() - 0.5).slice(0, Math.min(commentCount, base.length))
    
    for (const user of commenters) {
      const commentId = generateUlid()
      await prisma.contentComment.create({
        data: {
          id: commentId,
          postId: post.id,
          userId: user.id,
          comment: pickSeedContentCommentTemplate(post.type),
          isAnswer: false,
          parentId: null,
          createdAt: new Date(post.createdAt.getTime() + Math.random() * 10 * 24 * 60 * 60 * 1000),
        }
      })
      allComments.push(commentId)
      totalComments++
    }
  }
  console.log(`  ✅ ${totalComments} comment eklendi`)
  
  // 4. SHARES
  console.log('🔄 Shares ekleniyor...')
  for (const post of allPosts) {
    const shareCount = randInt(seedConfig.interactions.sharesPerPostMin, seedConfig.interactions.sharesPerPostMax)
    if (shareCount <= 0) continue
    const sharers = users.sort(() => Math.random() - 0.5).slice(0, shareCount)
    
    for (const user of sharers) {
      const shareType: 'INTERNAL_REPOST' | 'EXTERNAL_SHARE' = Math.random() > 0.5 ? 'INTERNAL_REPOST' : 'EXTERNAL_SHARE'
      const platform = shareType === 'EXTERNAL_SHARE' ? ['Twitter', 'Facebook', 'WhatsApp', 'Telegram'][Math.floor(Math.random() * 4)] : null
       
      try {
        await prisma.contentShare.create({
          data: {
            userId: user.id,
            postId: post.id,
            shareType,
            platform,
            createdAt: new Date(post.createdAt.getTime() + Math.random() * 12 * 24 * 60 * 60 * 1000),
          }
        })
        totalShares++
      } catch (e) {
        // Duplicate ignore
      }
    }
  }
  console.log(`  ✅ ${totalShares} share eklendi`)
  
  // 6. FAVORITES
  console.log('⭐ Favorites ekleniyor...')
  for (const user of users) {
    const favoriteCount = randInt(seedConfig.interactions.favoritesPerUserMin, seedConfig.interactions.favoritesPerUserMax)
    if (favoriteCount <= 0) continue
    const favoritePosts = allPosts.sort(() => Math.random() - 0.5).slice(0, favoriteCount)
    
    for (const post of favoritePosts) {
      try {
        await prisma.contentFavorite.create({
          data: {
            userId: user.id,
            postId: post.id,
            createdAt: new Date(post.createdAt.getTime() + Math.random() * 15 * 24 * 60 * 60 * 1000),
          }
        })
        totalFavorites++
      } catch (e) {
        // Duplicate ignore
      }
    }
  }
  console.log(`  ✅ ${totalFavorites} favorite eklendi`)
  
  // 7. COUNT GÜNCELLEMELERI - Gerçek sayıları hesapla ve güncelle
  console.log('🔢 Count alanları güncelleniyor...')
  let updatedPosts = 0
  
  for (const post of allPosts) {
    // Gerçek sayıları hesapla
    const likesCount = await prisma.contentLike.count({ where: { postId: post.id } })
    const commentsCount = await prisma.contentComment.count({ where: { postId: post.id } })
    const viewsCount = await prisma.contentPostView.count({ where: { postId: post.id } })
    const sharesCount = await prisma.contentShare.count({ where: { postId: post.id } })
    const favoritesCount = await prisma.contentFavorite.count({ where: { postId: post.id } })
    
    // Post'u güncelle
    await prisma.contentPost.update({
      where: { id: post.id },
      data: {
        likesCount,
        commentsCount,
        viewsCount,
        sharesCount,
        favoritesCount,
      }
    })
    updatedPosts++
  }
  console.log(`  ✅ ${updatedPosts} post count alanları güncellendi`)
  
  // Comment likes count güncelle
  console.log('💬 Comment likes count güncelleniyor...')
  let updatedComments = 0
  for (const commentId of allComments) {
    const likesCount = await prisma.contentLike.count({ where: { commentId } })
    if (likesCount > 0) {
      await prisma.contentComment.update({
        where: { id: commentId },
        data: { likesCount }
      })
      updatedComments++
    }
  }
  console.log(`  ✅ ${updatedComments} comment likes count güncellendi`)

  // 8. COMMENT VOTES (missing domain) - her yorum için 0-2 vote
  console.log('👍👎 Comment votes ekleniyor...')
  let totalVotes = 0
  for (const commentId of allComments) {
    const voteCount = Math.floor(Math.random() * 3) // 0-2
    if (voteCount === 0) continue

    const voters = users.sort(() => Math.random() - 0.5).slice(0, Math.min(voteCount, users.length))
    for (const voter of voters) {
      try {
        await prisma.contentCommentVote.create({
          data: {
            userId: voter.id,
            commentId,
            voteType: Math.random() > 0.25 ? 'UPVOTE' : 'DOWNVOTE',
          },
        })
        totalVotes++
      } catch {
        // ignore duplicates
      }
    }
  }
  console.log(`  ✅ ${totalVotes} comment vote eklendi`)

  // 9. TOP COMMUNITY CHOICE (opsiyonel) - ilk 5 posttan 2 tanesini seç
  console.log('🏅 Top community choices ekleniyor...')
  let totalChoices = 0
  const choicePosts = allPosts.slice(0, 5).sort(() => Math.random() - 0.5).slice(0, 2)
  for (const post of choicePosts) {
    const exists = await prisma.topCommunityChoice.findFirst({ where: { postId: post.id } })
    if (exists) continue
    await prisma.topCommunityChoice.create({
      data: {
        postId: post.id,
        badgeLabel: 'Top Choice',
        reason: 'Topluluk tarafından öne çıkarıldı.',
        awardedAt: new Date(),
      },
    })
    totalChoices++
  }
  console.log(`  ✅ ${totalChoices} top community choice eklendi`)
  
  // Özet
  console.log('\n' + '═'.repeat(80))
  console.log('✨ PHASE 7 TAMAMLANDI - SOCIAL FEATURES\n')
  console.log(`   ❤️ Toplam Likes: ${totalLikes}`)
  console.log(`   💬 Toplam Comments: ${totalComments}`)
  console.log(`   👁️ Toplam Views: ${totalViews}`)
  console.log(`   🔄 Toplam Shares: ${totalShares}`)
  console.log(`   ⭐ Toplam Favorites: ${totalFavorites}`)
  console.log(`   👍👎 Toplam Comment Votes: ${totalVotes}`)
  console.log(`   🏅 TopCommunityChoice: ${totalChoices}`)
  console.log(`\n   📊 ${updatedPosts} post count alanları gerçek verilerle güncellendi!`)
  console.log('═'.repeat(80) + '\n')
}

// ==================== PHASE 7.5: TRENDING POSTS ====================

/**
 * Trending post'ları oluştur (Feed distribution'dan önce hazırlanmalı)
 * Engagement skorlarına göre en popüler postları seçer ve TrendingPost tablosuna ekler
 */
async function seedTrendingPosts() {
  console.log('\n🔥 Trending post\'lar oluşturuluyor...\n')
  
  try {
    // Farklı post tiplerinden en popüler postları al
    const freePosts = await prisma.contentPost.findMany({
      where: { type: 'FREE' },
      take: 10,
      orderBy: [
        { likesCount: 'desc' },
        { commentsCount: 'desc' },
        { viewsCount: 'desc' },
        { createdAt: 'desc' },
      ],
    })
    
    const tipsPosts = await prisma.contentPost.findMany({
      where: { type: 'TIPS' },
      take: 6,
      orderBy: [
        { likesCount: 'desc' },
        { commentsCount: 'desc' },
        { viewsCount: 'desc' },
        { createdAt: 'desc' },
      ],
    })
    
    const comparePosts = await prisma.contentPost.findMany({
      where: { type: 'COMPARE' },
      take: 6,
      orderBy: [
        { likesCount: 'desc' },
        { commentsCount: 'desc' },
        { viewsCount: 'desc' },
        { createdAt: 'desc' },
      ],
    })
    
    const questionPostsForTrending = await prisma.contentPost.findMany({
      where: { type: 'QUESTION' },
      take: 5,
      orderBy: [
        { likesCount: 'desc' },
        { commentsCount: 'desc' },
        { viewsCount: 'desc' },
        { createdAt: 'desc' },
      ],
    })
    
    const experiencePosts = await prisma.contentPost.findMany({
      where: { type: 'EXPERIENCE' },
      take: 5,
      orderBy: [
        { likesCount: 'desc' },
        { commentsCount: 'desc' },
        { viewsCount: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    // Tüm postları birleştir ve engagement skoruna göre sırala
    const allPostsForTrending = [
      ...freePosts,
      ...tipsPosts,
      ...comparePosts,
      ...questionPostsForTrending,
      ...experiencePosts,
    ]
    
    // Engagement skoruna göre sırala (likes + comments + views)
    allPostsForTrending.sort((a, b) => {
      const scoreA = a.likesCount + a.commentsCount * 2 + a.viewsCount * 0.1
      const scoreB = b.likesCount + b.commentsCount * 2 + b.viewsCount * 0.1
      return scoreB - scoreA
    })
    
    // Top 30 post'u seç
    const topPosts = allPostsForTrending.slice(0, 30)
    
    if (topPosts.length === 0) {
      console.log('⚠️  Trending post için yeterli post bulunamadı')
      return
    }
    
    console.log(`📊 ${topPosts.length} post trending olarak işaretleniyor...\n`)
    
    const trendingPosts: any[] = []
    for (let i = 0; i < topPosts.length; i++) {
      const post = topPosts[i]
      try {
        // Engagement skorunu hesapla (100'den başlayıp azalan)
        const engagementScore = post.likesCount + post.commentsCount * 2 + post.viewsCount * 0.1
        const baseScore = 100 - i * 3 // Descending scores
        const finalScore = Math.max(baseScore, engagementScore * 0.1) // Minimum engagement-based score
        
        const trendingPost = await prisma.trendingPost.create({
          data: {
            id: generateUlid(),
            postId: post.id,
            score: finalScore,
            trendPeriod: 'DAILY',
            calculatedAt: new Date(),
          },
        })
        trendingPosts.push(trendingPost)
      } catch (error) {
        // Skip if already exists (unique constraint)
        if (error instanceof Error && !error.message.includes('Unique constraint')) {
          console.error(`   ⚠️  Post ${post.id} için hata:`, error.message)
        }
      }
    }
    
    console.log(`✅ ${trendingPosts.length} trending post oluşturuldu (çeşitli type'larda)`)
    console.log(`   - FREE: ${freePosts.filter(p => trendingPosts.some(tp => tp.postId === p.id)).length}`)
    console.log(`   - TIPS: ${tipsPosts.filter(p => trendingPosts.some(tp => tp.postId === p.id)).length}`)
    console.log(`   - COMPARE: ${comparePosts.filter(p => trendingPosts.some(tp => tp.postId === p.id)).length}`)
    console.log(`   - QUESTION: ${questionPostsForTrending.filter(p => trendingPosts.some(tp => tp.postId === p.id)).length}`)
    console.log(`   - EXPERIENCE: ${experiencePosts.filter(p => trendingPosts.some(tp => tp.postId === p.id)).length}\n`)
  } catch (error) {
    console.error('❌ Trending post oluşturma hatası:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
    throw error
  }
}

// ==================== PHASE 8: TRUST RELATIONS ====================

/**
 * TrustRelation oluştur (her kullanıcı 5-15 kişi trust eder)
 */
async function seedTrustRelations() {
  console.log('\n🤝 Trust relations oluşturuluyor...\n')

  if (!seedConfig.trust.enabled) {
    console.log('ℹ️  Trust relations kapalı: SEED_TRUST_ENABLED=false\n')
    return
  }
  
  const users = await prisma.user.findMany({ take: seedConfig.users.total })
  
  if (users.length < 2) {
    console.log('⚠️ Yeterli kullanıcı yok, Phase 8 atlanıyor...')
    return
  }
  
  let totalTrusts = 0
  let mutualTrusts = 0
  
  for (const truster of users) {
    // Her kullanıcı için trust sayısı (config)
    const minTrust = Math.min(seedConfig.trust.perUserMin, seedConfig.trust.perUserMax)
    const maxTrust = Math.max(seedConfig.trust.perUserMin, seedConfig.trust.perUserMax)
    const trustCount = Math.floor(Math.random() * (maxTrust - minTrust + 1)) + minTrust
    
    // Kendisi hariç diğer kullanıcılardan rastgele seç
    const otherUsers = users.filter(u => u.id !== truster.id)
    const trustedUsers = otherUsers
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(trustCount, otherUsers.length))
    
    for (const trusted of trustedUsers) {
      try {
        await prisma.trustRelation.create({
          data: {
            trusterId: truster.id,
            trustedUserId: trusted.id,
            createdAt: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000), // Son 6 ay
          }
        })
        totalTrusts++
        
        // Karşılıklı trust var mı kontrol et
        const reverseTrust = await prisma.trustRelation.findUnique({
          where: {
            trusterId_trustedUserId: {
              trusterId: trusted.id,
              trustedUserId: truster.id,
            }
          }
        })
        
        if (reverseTrust) {
          mutualTrusts++
        }
      } catch (e) {
        // Duplicate ignore
      }
    }
  }
  
  // Her kullanıcının trust stats'larını hesapla
  console.log('📊 Trust istatistikleri hesaplanıyor...')
  
  const trustStats: Array<{ email: string | null; trusting: number; trustedBy: number }> = []
  for (const user of users) {
    const trusting = await prisma.trustRelation.count({
      where: { trusterId: user.id }
    })
    const trustedBy = await prisma.trustRelation.count({
      where: { trustedUserId: user.id }
    })
    
    trustStats.push({
      email: user.email,
      trusting,
      trustedBy,
    })
    
    // Profile'daki trustCount ve trusterCount'ı güncelle
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        trusterCount: trusting,    // Bu kullanıcı kaç kişiye güveniyor
        trustCount: trustedBy,      // Bu kullanıcıya kaç kişi güveniyor
      }
    }).catch(() => {
      console.warn(`⚠️ ${user.email} için profile trust count güncellenemedi`)
    })
  }

  // Trust/Safety (missing domain): trust score + block/mute + report
  console.log('🛡️ Trust/Safety seed (score, block/mute, report) ekleniyor...')
  let trustScoreCreated = 0
  let blocksCreated = 0
  let mutesCreated = 0
  let reportsCreated = 0
  let supportReportsCreated = 0

  for (const user of users) {
    const existing = await prisma.userTrustScore.findFirst({ where: { userId: user.id } })
    if (existing) continue
    await prisma.userTrustScore.create({
      data: {
        userId: user.id,
        score: Math.round((0.4 + Math.random() * 0.6) * 100) / 100,
        reason: 'Seed initial trust score',
        calculatedAt: new Date(),
      },
    })
    trustScoreCreated++
  }

  // blocks/mutes/reports: küçük sample
  const shuffled = users.sort(() => Math.random() - 0.5)
  for (let i = 0; i < Math.min(2, shuffled.length - 1); i++) {
    const a = shuffled[i]
    const b = shuffled[i + 1]
    try {
      await prisma.userBlock.create({ data: { blockerId: a.id, blockedUserId: b.id } })
      blocksCreated++
    } catch {}
    try {
      await prisma.userMute.create({ data: { muterId: a.id, mutedUserId: b.id } })
      mutesCreated++
    } catch {}
    try {
      await prisma.userReport.create({
        data: {
          reporterId: a.id,
          reportedUserId: b.id,
          category: 'Spam',
          description: 'Seed sample report',
        },
      })
      reportsCreated++
    } catch {}
  }

  const anyRequest = await prisma.dMRequest.findFirst().catch(() => null)
  if (anyRequest) {
    try {
      await prisma.supportRequestReport.create({
        data: {
          requestId: anyRequest.id,
          reporterId: users[0].id,
          category: 'Abuse',
          description: 'Seed sample support request report',
        },
      })
      supportReportsCreated++
    } catch {}
  }
  
  // Özet
  console.log('\n' + '═'.repeat(80))
  console.log('✨ PHASE 8 TAMAMLANDI - TRUST RELATIONS\n')
  console.log(`   🤝 Toplam Trust İlişkileri: ${totalTrusts}`)
  console.log(`   💚 Karşılıklı Trust: ${mutualTrusts}`)
  console.log(`   👥 Kullanıcı Başına Ortalama: ${(totalTrusts / users.length).toFixed(1)} trust`)
  console.log(`\n   🛡️ TrustScore: ${trustScoreCreated}, Block: ${blocksCreated}, Mute: ${mutesCreated}, Report: ${reportsCreated}, SupportReport: ${supportReportsCreated}`)
  console.log(`\n   📊 İlk 5 kullanıcının trust durumu:`)
  
  trustStats.slice(0, 5).forEach(stat => {
    console.log(`      ${stat.email}: ${stat.trusting} kişiye güveniyor, ${stat.trustedBy} kişi tarafından güveniliyor`)
  })
  
  console.log('═'.repeat(80) + '\n')
}

// ==================== PHASE 12: EVENTS ====================

/**
 * WishboxEvent oluştur (10-15 kaliteli, gerçekçi event)
 * Event participation, scenarios, rewards ekle
 */
// Yeni seedEvents fonksiyonu - Elektronik ve Beauty odaklı, ürün bazlı
async function seedEvents() {
  console.log('\n🎉 Events oluşturuluyor (Elektronik & Beauty odaklı)...\n')
  
  if (!seedConfig.events.enabled) {
    console.log('ℹ️  Events kapalı: SEED_EVENTS_ENABLED=false\n')
    return
  }

  // Event entity oluşturma kullanıcı gerektirmez; user listesi sadece event-UGC için lazımdır.
  const users = await prisma.user.findMany({ take: seedConfig.users.total })
  
  // NOT: mainCategory/subCategory ilişkisi deprecated. Event'ler artık sadece Product.categoryId (hierarchical)
  // üzerinden ilerler. Category eşlemesi "popüler category" mekanizmasındaki isimlere göre yapılır.
  const popularCategories = await prisma.category.findMany({
    where: {
      OR: POPULAR_CATEGORY_NAMES.map((name) => ({
        name: { equals: name, mode: 'insensitive' as const },
      })),
    },
    select: { id: true, name: true },
  })

  const popularCategoryIdByName = new Map<string, string>(
    popularCategories.map((c) => [normalizeName(c.name), c.id] as [string, string]),
  )

  const popularCategoryNameById = new Map<string, string>(
    popularCategories.map((c) => [c.id, c.name] as [string, string]),
  )

  const getPopularCategoryIdOrUndefined = (categoryName: string): string | undefined => {
    return popularCategoryIdByName.get(normalizeName(categoryName))
  }

  // Event title -> popüler category name eşlemesi (DB'de ilgili category'nin ID'si bulunup kullanılacak)
  // NOT: Buradaki category isimleri POPULAR_CATEGORY_NAMES ile uyumlu olmalı.
  const EVENT_TITLE_TO_POPULAR_CATEGORY_NAME: Record<string, (typeof POPULAR_CATEGORY_NAMES)[number]> = {
    'Laptop ile Uzaktan Çalışma Deneyimi': 'Laptops',
    'Kablosuz Kulaklık Ses Kalitesi Testi': 'Accessories',
    'Akıllı Saat Spor Takibi Karşılaştırması': 'Accessories',
    'Tablet Kullanım Senaryoları': 'Accessories',
    'Oyun Performansı: Hangi Cihaz Daha İyi?': 'Carrier Cell Phones',
    'Kamera Performansı: Gece Çekimleri': 'Carrier Cell Phones',
    'Günlük Cilt Bakım Rutini Paylaşımı': 'Face Moisturizers',
    'Yağlı Ciltler İçin En İyi Ürünler': 'Gels',
    'Kalıcı Makyaj Ürünleri Testi': 'Sets & Kits',
    'Güneşten Korunma: En Etkili SPF Ürünleri': 'Lip Sunscreens',
    'Saç Bakım Rutini: Kuru ve Yıpranmış Saçlar': 'Balms & Moisturizers',
  }

  const resolvePopularCategoryNameForEvent = (title: string): string | undefined => {
    const direct = EVENT_TITLE_TO_POPULAR_CATEGORY_NAME[title]
    if (direct) return direct

    const t = title.toLowerCase()
    if (t.includes('laptop')) return 'Laptops'
    if (t.includes('telefon') || t.includes('iphone') || t.includes('kamera')) return 'Carrier Cell Phones'
    if (t.includes('kulaklık') || t.includes('aksesuar')) return 'Accessories'
    if (t.includes('makyaj') || t.includes('fondöten') || t.includes('ruj') || t.includes('maskara')) return 'Sets & Kits'
    if (t.includes('güneş') || t.includes('spf')) return 'Lip Sunscreens'
    if (t.includes('yağlı')) return 'Gels'
    if (t.includes('cilt') || t.includes('serum') || t.includes('bakım') || t.includes('rutin')) return 'Face Moisturizers'
    return undefined
  }
  
  const activeEvents: string[] = []
  const upcomingEvents: string[] = []
  
  type SeedWishboxEventConfig = {
    title: string
    description: string
    imageKey?: string
    startDate: Date
    endDate: Date
    status: 'PUBLISHED' | 'DRAFT'
    eventType: 'PICKS' | 'ROASTS'
    isActive: boolean
    // Popüler category mekanizması üzerinden isimle eşleme (id sonradan resolve edilir)
    popularCategoryName?: (typeof POPULAR_CATEGORY_NAMES)[number]
    // Ürünleri daha alakalı yapmak için opsiyonel filtre
    productNameIncludes?: string[]
  }

  // Kaliteli, gerçekçi event'ler - Senaryoların ta kendisi
  const eventConfigs: SeedWishboxEventConfig[] = [
    // ACTIVE EVENTS - ELEKTRONİK
    {
      title: 'Laptop ile Uzaktan Çalışma Deneyimi',
      description: 'Evden çalışırken hangi laptop daha verimli? Performans, klavye konforu, ekran kalitesi, taşınabilirlik... Tüm detayları paylaşın.',
      imageKey: 'event.event-tablet', // Laptop için tablet görselini kullan (uygun görsel)
      startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED',
      eventType: 'PICKS',
      isActive: true,
      popularCategoryName: 'Laptops',
      productNameIncludes: ['macbook', 'laptop'],
    },
    {
      title: 'Kablosuz Kulaklık Ses Kalitesi Testi',
      description: 'Hangi kulaklık en iyi ses deneyimini sunuyor? Bas performansı, gürültü engelleme, konfor, batarya ömrü... Deneyimlerinizi karşılaştırın.',
      imageKey: 'event.event-akillisaat', // Akıllı saat görseli (wearable kategorisi)
      startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED',
      eventType: 'ROASTS',
      isActive: true,
      popularCategoryName: 'Accessories',
      productNameIncludes: ['airpods', 'buds', 'earbuds', 'headphone'],
    },
    {
      title: 'Akıllı Saat Spor Takibi Karşılaştırması',
      description: 'Spor yaparken hangi akıllı saat daha doğru ölçüm yapıyor? Kalp atışı, adım sayacı, GPS doğruluğu, uyku takibi... Gerçek kullanım deneyimleriniz.',
      imageKey: 'event.event-akillisaat', // event-akillisaat.png
      startDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED',
      eventType: 'PICKS',
      isActive: true,
      popularCategoryName: 'Accessories',
      productNameIncludes: ['watch'],
    },
    {
      title: 'Tablet Kullanım Senaryoları',
      description: 'Tablet ile neler yapıyorsunuz? İzleme, okuma, çizim, not alma... Hangi tablet hangi iş için daha uygun? Deneyimlerinizi paylaşın.',
      imageKey: 'event.event-tablet', // event-tablet.png
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED',
      eventType: 'PICKS',
      isActive: true,
      popularCategoryName: 'Accessories',
      productNameIncludes: ['ipad', 'tablet'],
    },
    
    // ACTIVE EVENTS - BEAUTY
    {
      title: 'Günlük Cilt Bakım Rutini Paylaşımı',
      description: 'Sabah ve akşam cilt bakımınızda hangi ürünleri kullanıyorsunuz? Sırası, etkileri, sonuçları... Kendi rutininizi paylaşın, başkalarından ilham alın.',
      imageKey: 'event.event-ciltbakim', // event-ciltbakim.png
      startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED',
      eventType: 'PICKS',
      isActive: true,
      popularCategoryName: 'Face Moisturizers',
      productNameIncludes: ['serum', 'cream', 'moisturizer'],
    },
    {
      title: 'Yağlı Ciltler İçin En İyi Ürünler',
      description: 'Yağlı cilde sahipseniz hangi ürünler işe yarıyor? Matlaştırıcı etkisi olan, gözenekleri sıkılaştıran, yağ dengesini koruyan ürünler...',
      imageKey: 'event.event-yaglicilt', // event-yaglicilt.png
      startDate: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 19 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED',
      eventType: 'PICKS',
      isActive: true,
      popularCategoryName: 'Gels',
    },
    {
      title: 'Kalıcı Makyaj Ürünleri Testi',
      description: 'Gün boyu kalıcı kalan makyaj ürünleri hangileri? Fondöten, ruj, maskara... Yaz sıcağında, uzun iş gününde test ettiklerinizi paylaşın.',
      imageKey: 'event.event-kalicimakyaj', // event-kalicimakyaj.png
      startDate: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED',
      eventType: 'ROASTS',
      isActive: true,
      popularCategoryName: 'Sets & Kits',
      productNameIncludes: ['lipstick', 'foundation', 'mascara'],
    },
    
    // UPCOMING EVENTS - ELEKTRONİK
    {
      title: 'Oyun Performansı: Hangi Cihaz Daha İyi?',
      description: 'Mobil oyunlarda hangi telefon/tablet daha iyi performans gösteriyor? FPS, ısınma, batarya tüketimi... Oyuncuların deneyimleri.',
      imageKey: 'event.event-oyun', // event-oyun.png
      startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED',
      eventType: 'PICKS',
      isActive: false,
      popularCategoryName: 'Carrier Cell Phones',
    },
    {
      title: 'Kamera Performansı: Gece Çekimleri',
      description: 'Düşük ışıkta hangi telefon daha iyi fotoğraf çekiyor? Gece modu, HDR, detay koruma... Gerçek çekim örnekleri ile paylaşın.',
      imageKey: 'event.event-kamera', // event-kamera.png
      startDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 38 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED',
      eventType: 'ROASTS',
      isActive: false,
      popularCategoryName: 'Carrier Cell Phones',
      productNameIncludes: ['phone', 'iphone'],
    },
    
    // UPCOMING EVENTS - BEAUTY
    {
      title: 'Güneşten Korunma: En Etkili SPF Ürünleri',
      description: 'Yaz geliyor! Hangi güneş kremi gerçekten etkili? Beyaz iz bırakmayan, yağlamayan, su geçirmez... Deneyimlerinizi paylaşın.',
      imageKey: 'event.event-gunestenkorunma', // event-gunestenkorunma.png
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED',
      eventType: 'PICKS',
      isActive: false,
      popularCategoryName: 'Lip Sunscreens',
      productNameIncludes: ['sunscreen', 'spf'],
    },
    {
      title: 'Saç Bakım Rutini: Kuru ve Yıpranmış Saçlar',
      description: 'Kuru saçlar için hangi ürünler işe yarıyor? Şampuan, krem, maske, yağ... Etkili olduğunu gördüğünüz ürünleri paylaşın.',
      imageKey: 'event.event-sacbakim', // event-sacbakim.png
      startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED',
      eventType: 'PICKS',
      isActive: false,
      popularCategoryName: 'Balms & Moisturizers',
      productNameIncludes: ['hair', 'shampoo'],
    }
  ]

  // Active event sayısını config ile sınırla (fazla olanları upcoming'e çevir)
  {
    const activeMax = Math.max(0, seedConfig.events.activeMax)
    if (activeMax > 0) {
      let activeSeen = 0
      for (const cfg of eventConfigs) {
        if (!cfg.isActive) continue
        activeSeen++
        if (activeSeen <= activeMax) continue

        cfg.isActive = false
        // Tarihleri future'a taşı (upcoming gibi görünmesi için)
        const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000)
        cfg.startDate = start
        cfg.endDate = end
      }
    }
  }

  // Event config'lerini categoryId + product listesi ile zenginleştir (category name -> id -> products)
  const eventConfigsWithRelations = await Promise.all(
    eventConfigs.map(async (config) => {
      const popularCategoryName = config.popularCategoryName || resolvePopularCategoryNameForEvent(config.title)
      const categoryId = popularCategoryName ? getPopularCategoryIdOrUndefined(popularCategoryName) : undefined

      if (!popularCategoryName || !categoryId) {
        console.warn(`  ⚠️ Event category eşlemesi bulunamadı: "${config.title}" (popularCategoryName=${popularCategoryName ?? 'null'})`)
        return { ...config, categoryId: undefined as string | undefined, products: [] as any[] }
      }

      const productsInCategory = await prisma.product.findMany({
        where: { categoryId },
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
        },
        take: 200,
      })

      const includeTokens: string[] | undefined = (config as any).productNameIncludes
      const filteredProducts = includeTokens?.length
        ? productsInCategory.filter((p) => includeTokens.some((t) => p.name.toLowerCase().includes(t)))
        : productsInCategory

      // POPULAR_BRAND_NAMES + POPULAR_CATEGORY_NAMES dışına çıkma:
      // Event ürünlerini de "popular intersection" ile sınırla (category zaten popular).
      const popularIntersectionProducts = filteredProducts.filter((p) => isPopularIntersectionProduct(p))
      if (popularIntersectionProducts.length === 0) {
        console.warn(
          `  ⚠️ Event "${config.title}" için popular intersection ürün bulunamadı ` +
            `(category="${popularCategoryName}", fetched=${productsInCategory.length}). Event ürünleri boş bırakıldı.`,
        )
      }
      const finalProducts = popularIntersectionProducts

      return { ...config, categoryId, products: finalProducts }
    }),
  )
  
  // Event image'lerini Minio'ya upload et
  console.log("📸 Event görselleri Minio'ya yükleniyor...")
  const s3Service = new S3Service()
  const eventImagesDir = path.join(__dirname, '../tests/assets/events/new-events')
  
  let uploadedEventImageCount = 0
  for (const config of eventConfigsWithRelations) {
    if (!config.imageKey) continue
    
    // imageKey'den dosya adını çıkar (örn: 'event.event-batarya' -> 'event-batarya.png')
    const imageKeyParts = config.imageKey.split('.')
    const imageName = imageKeyParts[imageKeyParts.length - 1] // 'event-batarya'
    const localImagePath = path.join(eventImagesDir, `${imageName}.png`)
    
    if (existsSync(localImagePath)) {
      try {
        const imageBuffer = readFileSync(localImagePath)
        const minioPath = `events/new-events/${imageName}.png`
        await s3Service.uploadFile(minioPath, imageBuffer, 'image/png')
        uploadedEventImageCount++
      } catch (error) {
        console.warn(`  ⚠️ ${imageName}.png yüklenemedi:`, error instanceof Error ? error.message : String(error))
      }
    } else {
      console.warn(`  ⚠️ Event görseli bulunamadı: ${localImagePath}`)
    }
  }
  console.log(`  ✅ ${uploadedEventImageCount}/${eventConfigs.length} event görseli yüklendi\n`)
  
  // Event'leri oluştur
  console.log('📅 Eventler oluşturuluyor...')
  let activeCount = 0
  let upcomingCount = 0
  
  for (const config of eventConfigsWithRelations) {
    const eventId = generateUlid()
    
    // Event görselini al - Doğrudan Minio path'ini kullan
    let imageUrl: string | null = null
    if (config.imageKey) {
      const imageKeyParts = config.imageKey.split('.')
      const imageName = imageKeyParts[imageKeyParts.length - 1] // 'event-batarya'
      imageUrl = `events/new-events/${imageName}.png`
    }
    
    await prisma.wishboxEvent.create({
      data: {
        id: eventId,
        title: config.title,
        description: config.description,
        startDate: config.startDate,
        endDate: config.endDate,
        status: config.status,
        feedType: config.eventType,
        imageUrl,
        // CategoryId üzerinden seçilmiş ürünlerden bir tanesi event'e bağlanır (legacy category alanlarını kullanmamak için)
        productId: (config as any).products?.[0]?.id ?? null,
        brandId: null,
      } as any
    })
    
    if (config.isActive) {
      activeEvents.push(eventId)
      activeCount++
    } else {
    upcomingEvents.push(eventId)
      upcomingCount++
  }
  }
  
  console.log(`  ✅ ${activeCount} active event oluşturuldu`)
  console.log(`  ✅ ${upcomingCount} upcoming event oluşturuldu`)

  if (!seedConfig.events.createUgc) {
    console.log('ℹ️  Event UGC (event post/comment/stats) kapalı: SEED_EVENTS_CREATE_UGC=false\n')
    return
  }

  if (users.length === 0) {
    console.log('⚠️ Kullanıcı bulunamadı; event entity oluşturuldu ama event UGC atlandı.\n')
    return
  }
  
  // Active event'lere ContentPost ekle (FREE tipinde - Event Posts)
  console.log('📝 Event postları oluşturuluyor (ContentPost FREE tipinde)...')
  let totalEventPosts = 0
  
  // Gerçekçi post içerikleri - Event türüne göre
  const eventPostTemplates = {
    electronics: [
      {
        titleTemplate: (product: string) => `${product} - Uzun Süreli Kullanım Deneyimim`,
        bodyTemplate: (product: string) => `${product} ürününü yaklaşık 6 aydır kullanıyorum. İlk başta fiyatına göre çok fazla özellik sunuyor diye düşünmüştüm ama kullandıkça ne kadar doğru bir seçim yaptığımı anladım. Özellikle performans açısından beklentilerimin çok üstünde çıktı. Günlük işlerimde hiç sorun yaşamadım. Batarya ömrü de oldukça tatmin edici. Arkadaşlarıma da öneriyorum.`
      },
      {
        titleTemplate: (product: string) => `${product} ile 3 Aylık Gerçek Deneyim`,
        bodyTemplate: (product: string) => `${product} aldığım ilk günden beri günlük olarak kullanıyorum. Kalite açısından gerçekten başarılı bir ürün. Alternatiflerini de inceledim ama bu hem fiyat hem de özellik olarak en iyisi gibiydi. Özellikle kullanım kolaylığı çok hoşuma gitti. Hiç teknik sorun yaşamadım. Kesinlikle tavsiye ederim.`
      },
      {
        titleTemplate: (product: string) => `${product} - Beklediğimden İyi Çıktı`,
        bodyTemplate: (product: string) => `${product} için uzun süredir araştırma yapıyordum. Farklı markaları karşılaştırdım ve sonunda bunu almaya karar verdim. İlk izlenimim çok olumlu. Tasarım oldukça şık ve modern. Kullanırken de çok rahat. Henüz birkaç hafta oldu ama şimdiye kadar memnun kaldım. Umarım uzun ömürlü olur.`
      },
      {
        titleTemplate: (product: string) => `${product} Kullanıcısı Olarak Düşüncelerim`,
        bodyTemplate: (product: string) => `${product} modelini bir süredir kullanıyorum ve genel olarak memnunum. Performans açısından günlük ihtiyaçlarımı fazlasıyla karşılıyor. Sadece bazı küçük detaylarda iyileştirme yapılabilir diye düşünüyorum ama bunlar büyük sorunlar değil. Fiyat/performans dengesi gayet iyi. Bu fiyata alınabilecek en iyi ürünlerden biri bence.`
      },
      {
        titleTemplate: (product: string) => `${product} - Detaylı İnceleme ve Yorumum`,
        bodyTemplate: (product: string) => `${product} hakkında detaylı bir inceleme yazmak istedim çünkü gerçekten beğendiğim bir ürün. Hem günlük kullanımda hem de yoğun iş yükünde gayet iyi performans gösteriyor. Kalite açısından fiyatının çok üstünde bir ürün. Dayanıklılık konusunda da şimdilik herhangi bir sorun gözlemlemedim. Kullanırken keyif alıyorum.`
      },
    ],
    beauty: [
      {
        titleTemplate: (product: string) => `${product} Cilt Bakım Rutinimi Değiştirdi`,
        bodyTemplate: (product: string) => `${product} kullanmaya başladığımdan beri cildimde gerçekten fark gördüm. İlk haftada bile cildin nem dengesinin düzeldiğini hissettim. Artık sabah akşam rutinimin vazgeçilmezi oldu. Hassas ciltler için de uygun bence çünkü hiç tahriş yapmıyor. Kesinlikle denemenizi tavsiye ederim.`
      },
      {
        titleTemplate: (product: string) => `${product} İle 2 Aylık Deneyimim`,
        bodyTemplate: (product: string) => `${product} hakkında çok olumlu yorumlar okumuştum ve sonunda denedim. 2 aydır düzenli kullanıyorum ve cildimde bariz iyileşmeler var. Özellikle gözenekler küçüldü ve cilt tonu eşitlendi. Kokusu da çok hoş, sabah uyanınca uygulamak keyifli oluyor. Fiyatı biraz yüksek ama etkisine değiyor bence.`
      },
      {
        titleTemplate: (product: string) => `${product} - Yağlı Ciltler İçin Mükemmel`,
        bodyTemplate: (product: string) => `Yağlı cilde sahip biri olarak ${product} tam aradığım şeymiş. Cildi matlaştırıyor ama kurutmuyor. Gün içinde parlaklık problemi yaşamıyorum artık. Makyajın altına da harika uyum sağlıyor. Birkaç hafta içinde cildimdeki değişimi gördüm. Aynı cilt tipine sahip herkese tavsiye ederim.`
      },
      {
        titleTemplate: (product: string) => `${product} Beklentimi Karşıladı mı?`,
        bodyTemplate: (product: string) => `${product} almadan önce epey araştırma yaptım. Başlangıçta fiyatını yüksek buldum ama kullanmaya başlayınca paranın karşılığını aldığımı anladım. Cildin dokusu gerçekten yumuşadı ve nemlenme seviyesi arttı. Tek kutu bitirdim ve kesinlikle yeniden alacağım. Doğal içerikli olması da ayrı bir artı.`
      },
      {
        titleTemplate: (product: string) => `${product} - Günlük Rutinimin Favorisi`,
        bodyTemplate: (product: string) => `${product} şu an makyaj çantamın vazgeçilmezi. Hem kullanımı çok pratik hem de etkisi uzun sürüyor. Özellikle gün boyu kalıcılığı çok beğendim. Renk tonu da cilt tonuma mükemmel uydu. İçeriğindeki formül de cildi besliyor, sadece makyaj yapmakla kalmıyorum aynı zamanda cildim de bakım görüyor. Herkese gönül rahatlığıyla önerebilirim.`
      },
    ],
  };

  // Event kategorisine göre template seç
  const getTemplatesForEvent = (categoryId: string | undefined, eventTitle: string) => {
    const categoryName = categoryId ? popularCategoryNameById.get(categoryId) : undefined

    // Popüler category adına göre sınıflandır (electronics/beauty template seçimi)
    if (categoryName) {
      const n = normalizeName(categoryName)
      const looksBeauty =
        n.includes('face') ||
        n.includes('mask') ||
        n.includes('moistur') ||
        n.includes('mist') ||
        n.includes('soap') ||
        n.includes('gel') ||
        n.includes('balm') ||
        n.includes('lip')

      return looksBeauty ? eventPostTemplates.beauty : eventPostTemplates.electronics
    }
    
    // Fallback: Event title'a göre kategori tahmin et
    const titleLower = eventTitle.toLowerCase();
    if (titleLower.includes('telefon') || titleLower.includes('laptop') || 
        titleLower.includes('tablet') || titleLower.includes('kulaklık') ||
        titleLower.includes('saat') || titleLower.includes('kamera') || 
        titleLower.includes('oyun') || titleLower.includes('batarya') ||
        titleLower.includes('performans') || titleLower.includes('cihaz')) {
      return eventPostTemplates.electronics;
    }
    
    if (titleLower.includes('cilt') || titleLower.includes('makyaj') || 
        titleLower.includes('serum') || titleLower.includes('güneş') ||
        titleLower.includes('saç') || titleLower.includes('yağlı') ||
        titleLower.includes('bakım') || titleLower.includes('rutin')) {
      return eventPostTemplates.beauty;
    }
    
    // Son fallback: Random
    return Math.random() > 0.5 ? eventPostTemplates.electronics : eventPostTemplates.beauty;
  };
  
  for (let i = 0; i < activeEvents.length; i++) {
    const eventId = activeEvents[i]
    const config = eventConfigsWithRelations.filter(c => c.isActive)[i]
    const eventProducts = config.products || []
    
    if (eventProducts.length === 0) {
      console.log(`  ⚠️ Event "${config.title}" için ürün yok, post oluşturulmadı`)
      continue
    }
    
    // Her event için 1-2 post (full seed için az veri)
    const postCount = Math.floor(Math.random() * 2) + 1 // 1-2 arası
    const contributors = users.sort(() => Math.random() - 0.5).slice(0, postCount)
    
    // Event kategorisine göre template'leri seç
    const templates = getTemplatesForEvent(config.categoryId, config.title);
    const shuffledTemplates = [...templates].sort(() => Math.random() - 0.5);
    
    for (let j = 0; j < contributors.length; j++) {
      const user = contributors[j];
      
      // Her post için rastgele farklı bir ürün seç
      const baseEventPool = eventProducts.filter(p => Boolean(p.brand?.name) && Boolean(p.category?.name))
      const eventPoolRaw = baseEventPool.length > 0 ? baseEventPool : eventProducts
      const eventPool = eventPoolRaw.filter((p) => isPopularIntersectionProduct(p))
      if (eventPool.length === 0) {
        console.warn(
          `  ⚠️ Event "${config.title}" için popular intersection eventPool boş; post atlandı.`,
        )
        continue
      }
      const eventPairMap = buildPairMap(eventPool)
      const selectedProduct = pickProductFromPairMap(eventPairMap, eventPool, {
        preferredPairs: [],
        preferredChance: 0,
        strategy: 'uniform-pair',
        topk: 5,
      })
      
      // Template'i döngüsel olarak kullan (tekrar olmaması için)
      const template = shuffledTemplates[j % shuffledTemplates.length];
      const productName = selectedProduct.name;
      
      const postId = generateUlid()
      
      // ContentPost oluştur (FREE tipinde, event ile ilişkili)
      await prisma.contentPost.create({
        data: {
          id: postId,
          userId: user.id,
          type: 'FREE', // FREE tipinde ContentPost
          title: template.titleTemplate(productName),
          body: template.bodyTemplate(productName),
          productId: selectedProduct.id,
          eventId: eventId, // Event ile ilişkilendir
          inventoryRequired: false,
          isBoosted: false,
          likesCount: Math.floor(Math.random() * 25) + 3, // 3-27 like
          commentsCount: 0, // Başlangıçta 0, sonra gerçek comment'ler eklenecek
          viewsCount: Math.floor(Math.random() * 100) + 20, // 20-119 view
          favoritesCount: Math.floor(Math.random() * 10), // 0-9 favorite
          sharesCount: Math.floor(Math.random() * 5), // 0-4 share
          createdAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000), // Son 14 gün
        }
      })
      
      totalEventPosts++
      
      // WishboxStats güncelle
      await prisma.wishboxStats.upsert({
        where: {
          userId_eventId: {
            userId: user.id,
          eventId,
          }
        },
        create: {
          userId: user.id,
          eventId,
          totalParticipated: 1,
          totalComments: 0,
          helpfulVotesReceived: 0,
          eventPostsCount: 1,
          eventLikesReceived: 0,
        },
        update: {
          totalParticipated: { increment: 1 },
          eventPostsCount: { increment: 1 },
    }
      })
    }
  }
  
  console.log(`  ✅ ${totalEventPosts} ContentPost oluşturuldu (FREE tipinde, Event'lere bağlı)`)
  
  // Event post'larına comment ekle (event başına 1-2 comment, düşük veri)
  console.log("💬 Event post'larına comment ekleniyor (event bazlı, düşük veri)...")
  
  // Comment template'leri (gerçekçi yorumlar)
  const commentTemplates = {
    electronics: [
      'Detaylı ve anlaşılır olmuş; karar verirken böyle net anlatımlar çok işe yarıyor.',
      'Benzer bir senaryoda ben farklı yol izledim; yine de yaklaşımın mantıklı.',
      'Şu kısmı merak ettim: uzun vadede alışkanlık oturunca değişen bir şey oldu mu?',
      'Bence burada en kritik kısım beklenti yönetimi; herkes aynı sonucu alamayabilir.',
      'Kıyas yaparken aynı koşulları baz almak gerekiyor; yoksa yanıltıcı oluyor.',
      'Benim önceliğim konfor olduğu için bu yorumlar değerli geldi.',
      'Çok iyi özetlemişsin; “kim için uygun” kısmı netleşmiş.',
      'Ben de benzer bir sonuç gördüm ama sebebi muhtemelen kullanım şekli.',
      'İlk izlenim ile birkaç hafta sonrası farklı olabiliyor; update paylaşır mısın?',
      'Buradaki küçük nüanslar bence asıl farkı yaratıyor.',
    ],
    beauty: [
      'Rutine dahil etme kısmını güzel anlatmışsın; süreklilik bence de önemli.',
      'Benim deneyimimde küçük ayarlamalar çok etkiledi; bu paylaşım iyi oldu.',
      'Şu adımı hangi sıklıkla uyguluyorsun? Zamanla değiştiriyor musun?',
      'Bence burada en kritik şey sabır; ilk günle karar vermek zor.',
      'Detaylar net; özellikle “neden böyle yaptım” kısmı çok açıklayıcı.',
      'Benzer bir yöntemi denedim ve bende daha iyi çalıştı; kişisel farklar büyük.',
      'Adım adım yazman çok iyi; kaydedip deneyeceğim.',
      'Bu yaklaşım bence pratik; günlük hayatta sürdürülebilir duruyor.',
      'Kısa vadede etkileyip sonra düşebiliyor; birkaç hafta sonra tekrar yazar mısın?',
      'Özet çok iyi: basit, uygulanabilir ve abartısız.',
    ],
    general: [
      'Çok faydalı bir paylaşım olmuş, teşekkürler!',
      'Ben de aynı şeyi düşünüyorum, kesinlikle katılıyorum.',
      'Daha detaylı bilgi verebilir misiniz? Merak ettim.',
      'Süper paylaşım! 👏',
      'Benim için çok yararlı bilgiler, sağ olun.',
    ],
  }
  
  // Sadece active event post'larını al (UGC sadece aktif event'lerde anlamlı)
  const allEventPosts = await prisma.contentPost.findMany({
    where: { eventId: { in: activeEvents } },
    select: {
      id: true,
      eventId: true,
      userId: true,
      likesCount: true,
      createdAt: true,
    },
  })
  
  let totalComments = 0
  const postCommentCounts: Record<string, number> = {}

  // Her post için comment sayacını 0'la
  for (const post of allEventPosts) postCommentCounts[post.id] = 0

  const activeEventRows = await prisma.wishboxEvent.findMany({
    where: { id: { in: activeEvents } },
    select: { id: true, title: true },
  })
  const activeEventTitleById = new Map(activeEventRows.map((e) => [e.id, e.title] as const))

  // EventId -> post listesi
  const postsByEventId = new Map<string, Array<{ id: string; eventId: string; createdAt: Date; userId: string }>>()
  for (const post of allEventPosts) {
    if (!post.eventId) continue
    const eventId = post.eventId
    const list = postsByEventId.get(eventId) || []
    list.push({ id: post.id, eventId, createdAt: post.createdAt, userId: post.userId })
    postsByEventId.set(eventId, list)
  }

  for (const eventId of activeEvents) {
    const posts = postsByEventId.get(eventId) || []
    if (posts.length === 0) continue

    // Her active event için 1-2 comment garantile (düşük veri)
    const commentsForEvent = Math.min(2, Math.max(1, Math.floor(Math.random() * 2) + 1)) // 1-2
    const eventTitle = activeEventTitleById.get(eventId) || ''

    let templates = commentTemplates.general
    const titleLower = eventTitle.toLowerCase()
    if (
      titleLower.includes('telefon') ||
      titleLower.includes('laptop') ||
      titleLower.includes('tablet') ||
      titleLower.includes('kulaklık') ||
      titleLower.includes('saat') ||
      titleLower.includes('kamera') ||
      titleLower.includes('oyun') ||
      titleLower.includes('batarya')
    ) {
      templates = commentTemplates.electronics
    } else if (
      titleLower.includes('cilt') ||
      titleLower.includes('makyaj') ||
      titleLower.includes('serum') ||
      titleLower.includes('saç') ||
      titleLower.includes('bakım')
    ) {
      templates = commentTemplates.beauty
    }

    // 1-2 kullanıcıdan comment gelsin (event bazlı)
    const commenterCount = Math.min(users.length, Math.floor(Math.random() * 2) + 1) // 1-2
    const commenters = users.sort(() => Math.random() - 0.5).slice(0, commenterCount)

    for (let k = 0; k < commentsForEvent; k++) {
      const commenter = commenters[k % commenters.length]
      const targetPost = posts[Math.floor(Math.random() * posts.length)]

      // Post sahibi ile aynı kullanıcı seçilirse sorun değil; ama mümkünse farklı olsun
      const finalCommenter =
        targetPost.userId !== commenter.id
          ? commenter
          : users.find((u) => u.id !== targetPost.userId) || commenter

      const randomTemplate = templates[Math.floor(Math.random() * templates.length)]
      const commentId = generateUlid()

      // Comment'i post'tan sonra oluşturulmuş gibi göster
      const commentCreatedAt = new Date(targetPost.createdAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000)

      await prisma.contentComment.create({
        data: {
          id: commentId,
          postId: targetPost.id,
          userId: finalCommenter.id,
          comment: randomTemplate,
          isAnswer: false,
          createdAt: commentCreatedAt,
          likesCount: Math.floor(Math.random() * 5), // 0-4 like
        },
      })

      totalComments++
      postCommentCounts[targetPost.id] = (postCommentCounts[targetPost.id] || 0) + 1

      // WishboxStats: comment tarafını event bazlı increment et
      await prisma.wishboxStats.upsert({
        where: {
          userId_eventId: {
            userId: finalCommenter.id,
            eventId,
          },
        },
        create: {
          userId: finalCommenter.id,
          eventId,
          totalParticipated: 1,
          totalComments: 1,
          helpfulVotesReceived: 0,
          eventPostsCount: 0,
          eventLikesReceived: 0,
        },
        update: {
          totalParticipated: { increment: 1 },
          totalComments: { increment: 1 },
        },
      })
    }
  }
  
  // ContentPost'ların commentsCount'larını güncelle
  console.log("📊 Post comment count'ları güncelleniyor...")
  for (const [postId, count] of Object.entries(postCommentCounts)) {
    await prisma.contentPost.update({
      where: { id: postId },
      data: { commentsCount: count },
    })
  }
  
  console.log(`  ✅ ${totalComments} comment eklendi (max 1 per post)`)
  console.log(`  ✅ ${allEventPosts.length} post'un comment count'u güncellendi`)
  
  // ==================== WishboxStats / RewardClaim backfill (düşük veri, deterministik) ====================
  console.log('🔁 WishboxStats backfill (post/comment gerçeğine göre) + event reward claim backfill...')

  const postEventIdByPostId = new Map<string, string>(
    allEventPosts.filter((p) => Boolean(p.eventId)).map((p) => [p.id, p.eventId!] as const),
  )

  const allEventPostIds = allEventPosts.map((p) => p.id)
  const allEventComments = allEventPostIds.length
    ? await prisma.contentComment.findMany({
        where: { postId: { in: allEventPostIds } },
        select: { userId: true, postId: true },
      })
    : []

  type Agg = { userId: string; eventId: string; posts: number; comments: number; likesReceived: number }
  const aggByKey = new Map<string, Agg>()

  for (const post of allEventPosts) {
    if (!post.eventId) continue
    const key = `${post.userId}:${post.eventId}`
    const existing = aggByKey.get(key) || {
      userId: post.userId,
      eventId: post.eventId,
      posts: 0,
      comments: 0,
      likesReceived: 0,
    }
    existing.posts += 1
    existing.likesReceived += post.likesCount || 0
    aggByKey.set(key, existing)
  }

  for (const c of allEventComments) {
    const eventId = postEventIdByPostId.get(c.postId)
    if (!eventId) continue
    const key = `${c.userId}:${eventId}`
    const existing = aggByKey.get(key) || {
      userId: c.userId,
      eventId,
      posts: 0,
      comments: 0,
      likesReceived: 0,
    }
    existing.comments += 1
    aggByKey.set(key, existing)
  }

  let statsBackfilled = 0
  let rewardClaimsCreated = 0

  for (const agg of aggByKey.values()) {
    await prisma.wishboxStats.upsert({
      where: { userId_eventId: { userId: agg.userId, eventId: agg.eventId } },
      create: {
        userId: agg.userId,
        eventId: agg.eventId,
        totalParticipated: 1,
        totalComments: agg.comments,
        helpfulVotesReceived: 0,
        eventPostsCount: agg.posts,
        eventLikesReceived: agg.likesReceived,
      },
      update: {
        totalParticipated: 1,
        totalComments: agg.comments,
        eventPostsCount: agg.posts,
        eventLikesReceived: agg.likesReceived,
      },
    })
    statsBackfilled++

    // RewardClaim backfill (WishboxReward kullanmadan): event participation ödülü
    const existingClaim = await prisma.rewardClaim.findFirst({
      where: {
        userId: agg.userId,
        rewardType: 'EVENT' as any,
        sourceType: 'EVENT_PARTICIPATION' as any,
        metadata: { path: ['eventId'], equals: agg.eventId } as any,
      } as any,
    })

    if (!existingClaim) {
      const eventTitle = activeEventTitleById.get(agg.eventId) || null
      const amount = Math.min(50, 10 + agg.posts * 5 + agg.comments * 2) // düşük, ama anlamlı

      await prisma.rewardClaim.create({
        data: {
          userId: agg.userId,
          amount,
          rewardType: 'EVENT' as any,
          sourceType: 'EVENT_PARTICIPATION' as any,
          status: 'PENDING' as any,
          sourceId: null,
          earnedAt: new Date(),
          metadata: {
            eventId: agg.eventId,
            eventTitle,
            postsCount: agg.posts,
            commentsCount: agg.comments,
            description: 'Event participation reward (seed backfill)',
          } as any,
        },
      })

      rewardClaimsCreated++
    }
  }

  console.log(`  ✅ WishboxStats backfill: ${statsBackfilled} kayıt güncellendi/oluşturuldu`)
  console.log(`  ✅ RewardClaim(EVENT_PARTICIPATION): ${rewardClaimsCreated} yeni kayıt`)
  
  
  // Özet
  console.log('\n' + '═'.repeat(80))
  console.log('✨ PHASE 12 TAMAMLANDI - EVENTS (Elektronik & Beauty)\n')
  console.log(`   🎉 Toplam Events: ${activeCount + upcomingCount}`)
  console.log(`      📅 Active: ${activeCount}`)
  console.log(`      🔜 Upcoming: ${upcomingCount}`)
  console.log(`   📝 ContentPosts (FREE): ${totalEventPosts} (Event'lere bağlı, 1-2 post/event)`)
  console.log(`   💬 Comments: ${totalComments} (max 1 per post, gerçekçi içerikler)`)
  if (activeCount > 0) {
    console.log(`\n   📊 Ortalama event başına: ${(totalEventPosts / activeCount).toFixed(1)} post`)
    console.log(`   📊 Ortalama post başına: ${(totalComments / totalEventPosts).toFixed(1)} comment`)
  }
  console.log('═'.repeat(80) + '\n')
}


// ==================== PHASE 14: MESSAGING (DM) ====================

/**
 * Messaging system oluştur (DMThread, DMMessage, DMRequest)
 */
async function seedMessaging() {
  console.log('\n💬 Messaging system oluşturuluyor...\n')
  
  if (!seedConfig.messaging.enabled) {
    console.log('ℹ️  Messaging kapalı: SEED_MESSAGING_ENABLED=false\n')
    return
  }

  const users = await prisma.user.findMany({ take: seedConfig.users.total })
  
  if (users.length < 2) {
    console.log('⚠️ Yeterli kullanıcı yok, Phase 14 atlanıyor...')
    return
  }
  
  const threads: string[] = []
  const engagementThreadIds: string[] = []
  let totalMessages = 0
  let totalRequests = 0
  
  // 1. DM THREADS (30-50 thread)
  console.log('💬 DM Threads oluşturuluyor...')
  const minThreads = Math.min(seedConfig.messaging.threadsMin, seedConfig.messaging.threadsMax)
  const maxThreads = Math.max(seedConfig.messaging.threadsMin, seedConfig.messaging.threadsMax)
  const threadCount = Math.floor(Math.random() * (maxThreads - minThreads + 1)) + minThreads
  
  for (let i = 0; i < threadCount; i++) {
    // Random iki kullanıcı seç (farklı olmalı)
    const userOne = users[Math.floor(Math.random() * users.length)]
    let userTwo = users[Math.floor(Math.random() * users.length)]
    
    // userOne ile userTwo aynı olmasın
    while (userTwo.id === userOne.id) {
      userTwo = users[Math.floor(Math.random() * users.length)]
    }
    
    const thread = await prisma.dMThread.create({
      data: {
        userOneId: userOne.id,
        userTwoId: userTwo.id,
        isActive: Math.random() > 0.2, // %80 active
        isSupportThread: false,
        unreadCountUserOne: Math.floor(Math.random() * 3), // 0-2 unread
        unreadCountUserTwo: Math.floor(Math.random() * 3), // 0-2 unread
        startedAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000), // Son 60 gün
      }
    })
    
    threads.push(thread.id)
    engagementThreadIds.push(thread.id)
  }
  console.log(`  ✅ ${threadCount} DM thread oluşturuldu`)
  
  // 2. DM MESSAGES
  console.log('📨 DM Messages oluşturuluyor...')
  
  const conversationStarters = [
    'Merhaba! Bu ürün hakkında sormak istediğim bir şey var.',
    'Selam, profilini gördüm çok güzel içerikler paylaşmışsın.',
    'Hey! Şu ürünü kullanıyor musun? Nasıl buldun?',
    'Merhaba, yardımına ihtiyacım var.',
    'Selam! Son paylaşımını gördüm, çok faydalıydı teşekkürler.',
  ]
  
  const responses = [
    'Teşekkür ederim! Ne sormak istiyordun?',
    'Merhaba! Tabii ki, nasıl yardımcı olabilirim?',
    'Evet kullanıyorum, çok memnunum. Detaylı anlatayım mı?',
    'Hey! Rica ederim, ne zaman istersen yazabilirsin.',
    'Selam! Çok teşekkür ederim, yardımcı olabildiysem ne mutlu.',
  ]
  
  const followUps = [
    'Anladım, çok faydalı oldu. Teşekkürler!',
    'Harika bilgiler, çok yardımcı oldun.',
    'Tamam, düşüneceğim. Tekrar yazabilirim değil mi?',
    'Süper! Başka soracak bir şey olursa yazarım.',
    'Çok sağol, gerçekten işime yaradı bu bilgiler.',
  ]
  
  for (const threadId of threads) {
    const thread = await prisma.dMThread.findUnique({
      where: { id: threadId },
      include: { userOne: true, userTwo: true }
    })
    
    if (!thread) continue
    
    const minMsgs = Math.min(seedConfig.messaging.messagesPerThreadMin, seedConfig.messaging.messagesPerThreadMax)
    const maxMsgs = Math.max(seedConfig.messaging.messagesPerThreadMin, seedConfig.messaging.messagesPerThreadMax)
    const messageCount = Math.floor(Math.random() * (maxMsgs - minMsgs + 1)) + minMsgs
    let currentSender = Math.random() > 0.5 ? thread.userOneId : thread.userTwoId
    
    for (let i = 0; i < messageCount; i++) {
      let messageText = ''
      
      // İlk mesaj conversation starter
      if (i === 0) {
        messageText = conversationStarters[Math.floor(Math.random() * conversationStarters.length)]
      } else if (i === 1) {
        messageText = responses[Math.floor(Math.random() * responses.length)]
      } else if (i === messageCount - 1) {
        messageText = followUps[Math.floor(Math.random() * followUps.length)]
      } else {
        // Diğer mesajlar
        messageText = `Evet ben de öyle düşünüyorum. Bu konuda deneyimim oldukça fazla. Detayları anlatayım mı?`
      }
      
      await prisma.dMMessage.create({
        data: {
          threadId,
          senderId: currentSender,
          message: messageText,
          isRead: Math.random() > 0.3, // %70 okunmuş
          context: 'DM',
          sentAt: new Date(thread.startedAt.getTime() + i * 60 * 60 * 1000), // Her saat 1 mesaj
        }
      })
      
      totalMessages++
      
      // Sender değiştir (konuşma mantığı)
      currentSender = currentSender === thread.userOneId ? thread.userTwoId : thread.userOneId
    }
  }
  console.log(`  ✅ ${totalMessages} mesaj oluşturuldu`)
  
  // 3. SUPPORT THREADS & REQUESTS
  console.log('🎫 Support requests oluşturuluyor...')
  const minReq = Math.min(seedConfig.messaging.supportRequestsMin, seedConfig.messaging.supportRequestsMax)
  const maxReq = Math.max(seedConfig.messaging.supportRequestsMin, seedConfig.messaging.supportRequestsMax)
  const requestCount = Math.floor(Math.random() * (maxReq - minReq + 1)) + minReq
  
  const supportStatuses: Array<'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELED' | 'AWAITING_COMPLETION' | 'COMPLETED' | 'REPORTED'> = [
    'PENDING', 'ACCEPTED', 'AWAITING_COMPLETION', 'COMPLETED', 'DECLINED', 'CANCELED'
  ]
  
  const supportTypes: Array<'GENERAL' | 'TECHNICAL' | 'PRODUCT'> = ['GENERAL', 'TECHNICAL', 'PRODUCT']
  
  for (let i = 0; i < requestCount; i++) {
    const fromUser = users[Math.floor(Math.random() * users.length)]
    let toUser = users[Math.floor(Math.random() * users.length)]
    
    while (toUser.id === fromUser.id) {
      toUser = users[Math.floor(Math.random() * users.length)]
    }
    
    const status = supportStatuses[Math.floor(Math.random() * supportStatuses.length)]
    const supportType = supportTypes[Math.floor(Math.random() * supportTypes.length)]
    
    // Eğer ACCEPTED veya sonrası ise thread oluştur
    let threadId: string | null = null
    if (status !== 'PENDING' && status !== 'DECLINED' && status !== 'CANCELED') {
      const supportThread = await prisma.dMThread.create({
        data: {
          userOneId: fromUser.id,
          userTwoId: toUser.id,
          isActive: status !== 'COMPLETED',
          isSupportThread: true,
          unreadCountUserOne: 0,
          unreadCountUserTwo: 0,
          startedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        }
      })
      engagementThreadIds.push(supportThread.id)
      
      // Support thread için birkaç mesaj ekle
      const supportMessages = [
        'Merhaba, yardıma ihtiyacım var.',
        'Tabii, size nasıl yardımcı olabilirim?',
        'Bu konuda destek alabilir miyim?',
        'Elbette, hemen yardımcı oluyorum.',
      ]
      
      for (let j = 0; j < Math.min(4, supportMessages.length); j++) {
        await prisma.dMMessage.create({
          data: {
            threadId: supportThread.id,
            senderId: j % 2 === 0 ? fromUser.id : toUser.id,
            message: supportMessages[j],
            isRead: true,
            context: 'SUPPORT',
            sentAt: new Date(Date.now() - (supportMessages.length - j) * 60 * 60 * 1000),
          }
        })
        totalMessages++
      }
      
      threadId = supportThread.id
    }
    
    await prisma.dMRequest.create({
      data: {
        fromUserId: fromUser.id,
        toUserId: toUser.id,
        status,
        type: supportType,
        description: `${supportType} desteği için talep`,
        amount: Math.random() * 100,
        threadId,
        respondedAt: status !== 'PENDING' ? new Date(Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000) : null,
        fromUserRating: status === 'COMPLETED' ? Math.floor(Math.random() * 3) + 3 : null, // 3-5 rating
        toUserRating: status === 'COMPLETED' ? Math.floor(Math.random() * 3) + 3 : null, // 3-5 rating
        closedByFromUserAt: status === 'COMPLETED' ? new Date() : null,
        closedByToUserAt: status === 'COMPLETED' ? new Date() : null,
      }
    })
    
    totalRequests++
  }
  console.log(`  ✅ ${requestCount} support request oluşturuldu`)

  // 4. Messaging reactions + read receipts (missing domain)
  console.log('✅ Message reactions/read receipts ekleniyor...')
  const engagement = await seedMessageReactionsAndReadReceipts({
    client: prisma,
    threadIds: engagementThreadIds,
  })

  // 5. Support session + feedback (opsiyonel)
  const supportThreads = await prisma.dMThread.findMany({
    where: { isSupportThread: true },
    take: 5,
  })
  let supportSessionsCreated = 0
  let feedbacksCreated = 0

  for (const t of supportThreads) {
    const existing = await prisma.dMSupportSession.findFirst({ where: { threadId: t.id } })
    if (existing) continue

    const helperId = Math.random() > 0.5 ? t.userOneId : t.userTwoId
    const session = await prisma.dMSupportSession.create({
      data: {
        threadId: t.id,
        helperId,
        tipsAmount: Math.round((10 + Math.random() * 90) * 100) / 100,
        supportedAt: new Date(),
      },
    })
    supportSessionsCreated++

    await prisma.dMFeedback.create({
      data: {
        sessionId: session.id,
        rating: Math.floor(Math.random() * 2) + 4, // 4-5
        comment: 'Seed feedback',
        submittedAt: new Date(),
      },
    })
    feedbacksCreated++
  }
  console.log(
    `  ✅ Reactions: ${engagement.reactionsCreated}, ReadReceipts: ${engagement.receiptsCreated}, SupportSessions: ${supportSessionsCreated}, Feedbacks: ${feedbacksCreated}`,
  )
  
  // Özet
  console.log('\n' + '═'.repeat(80))
  console.log('✨ PHASE 14 TAMAMLANDI - MESSAGING\n')
  console.log(`   💬 DM Threads: ${threadCount}`)
  console.log(`      🟢 Active: ${Math.floor(threadCount * 0.8)}`)
  console.log(`      🔴 Inactive: ${Math.floor(threadCount * 0.2)}`)
  console.log(`   📨 Total Messages: ${totalMessages}`)
  console.log(`      📩 DM Messages: ${totalMessages - requestCount * 4}`)
  console.log(`      🎫 Support Messages: ${requestCount * 4}`)
  console.log(`   🎫 Support Requests: ${totalRequests}`)
  console.log(`\n   📊 Ortalama thread başına: ${(totalMessages / (threadCount + requestCount)).toFixed(1)} mesaj`)
  console.log('═'.repeat(80) + '\n')
}

// ==================== PHASE 13: NFT & MARKETPLACE ====================

/**
 * NFT & Marketplace sistemi oluştur
 */
async function seedNFTMarketplace() {
  console.log('\n🎨 NFT & Marketplace oluşturuluyor...\n')
  
  if (!seedConfig.nft.enabled) {
    console.log('ℹ️  NFT & Marketplace kapalı: SEED_NFT_ENABLED=false\n')
    return
  }

  const users = await prisma.user.findMany({ take: seedConfig.users.total })
  
  if (users.length === 0) {
    console.log('⚠️ Kullanıcı bulunamadı, Phase 13 atlanıyor...')
    return
  }
  
  const nfts: string[] = []
  let totalAttributes = 0
  let totalTransactions = 0
  let totalListings = 0
  
  // 1. NFT OLUŞTURMA (Her kullanıcı 2-5 NFT)
  console.log('🎨 NFT\'ler oluşturuluyor...')
  
  // LOOTBOX kaldırıldı (artık seed'lenmiyor)
  const nftTypes: Array<'BADGE' | 'COSMETIC'> = ['BADGE', 'COSMETIC']
  const nftRarities: Array<'COMMON' | 'RARE' | 'EPIC'> = ['COMMON', 'RARE', 'EPIC']
  
  const nftNames = {
    BADGE: ['Pioneer Badge', 'Expert Badge', 'Contributor Badge', 'Elite Badge', 'Champion Badge'],
    COSMETIC: ['Golden Frame', 'Diamond Border', 'Neon Glow', 'Crystal Shine', 'Rainbow Aura'],
  }
  
  for (const user of users) {
    const minNfts = Math.min(seedConfig.nft.perUserMin, seedConfig.nft.perUserMax)
    const maxNfts = Math.max(seedConfig.nft.perUserMin, seedConfig.nft.perUserMax)
    const nftCount = Math.floor(Math.random() * (maxNfts - minNfts + 1)) + minNfts
    if (nftCount <= 0) continue
    
    for (let i = 0; i < nftCount; i++) {
      const nftType = nftTypes[Math.floor(Math.random() * nftTypes.length)]
      const rarity = nftRarities[Math.floor(Math.random() * nftRarities.length)]
      const nameOptions = nftNames[nftType]
      const name = nameOptions[Math.floor(Math.random() * nameOptions.length)]
      
      // NFT görseli için fallback (seed-media-map.json'da yoksa product/badge image kullan)
      let nftImageUrl = '';
      try {
        nftImageUrl = getSeedMediaPath('nft.marketplace.1') || getSeedMediaPath('product.headphone') || getSeedMediaPath('badge.earlyadapter') || '';
      } catch (error) {
        // Son fallback: badge veya product kullan
        try {
          nftImageUrl = getSeedMediaPath('badge.earlyadapter') || '';
        } catch {
          nftImageUrl = getSeedMediaPath('product.headphone') || '';
        }
      }
      
      const nft = await prisma.nFT.create({
        data: {
          name: `${name} #${Math.floor(Math.random() * 9999) + 1}`,
          description: `A ${rarity.toLowerCase()} ${nftType.toLowerCase()} NFT with unique attributes.`,
          imageUrl: nftImageUrl,
          type: nftType,
          rarity,
          isTransferable: Math.random() > 0.2, // %80 transferable
          currentOwnerId: user.id,
        }
      })
      
      nfts.push(nft.id)
      
      // Her NFT için MINT transaction
      await prisma.nFTTransaction.create({
        data: {
          nftId: nft.id,
          fromUserId: null, // System mint
          toUserId: user.id,
          price: null,
          transactionType: 'MINT',
        }
      })
      totalTransactions++
      
      // 2. NFT ATTRIBUTES (Her NFT için 3-5 attribute)
      const attributeCount = Math.floor(Math.random() * 3) + 3 // 3-5
      const attributeKeys = ['Power', 'Rarity Score', 'Edition', 'Creator', 'Collection', 'Level']
      
      for (let j = 0; j < attributeCount; j++) {
        const key = attributeKeys[j % attributeKeys.length]
        let value = ''
        
        switch (key) {
          case 'Power':
            value = `${Math.floor(Math.random() * 100) + 1}`
            break
          case 'Rarity Score':
            value = `${(Math.random() * 10).toFixed(2)}`
            break
          case 'Edition':
            value = `${Math.floor(Math.random() * 1000) + 1}/1000`
            break
          case 'Creator':
            value = 'Tipbox Official'
            break
          case 'Collection':
            value = `${nftType} Collection`
            break
          case 'Level':
            value = `${Math.floor(Math.random() * 10) + 1}`
            break
        }
        
        await prisma.nFTAttribute.create({
          data: {
            nftId: nft.id,
            key,
            value,
          }
        })
        totalAttributes++
      }
    }
  }
  
  console.log(`  ✅ ${nfts.length} NFT oluşturuldu`)
  console.log(`  ✅ ${totalAttributes} attribute eklendi`)
  console.log(`  ✅ ${totalTransactions} MINT transaction oluşturuldu`)
  
  // 3. NFT TRANSFERS (Bazı NFT'ler el değiştirmiş)
  console.log('🔄 NFT transfer işlemleri oluşturuluyor...')
  
  const transferCount = Math.floor(nfts.length * 0.2) // %20'si transfer olmuş
  const nftsToTransfer = nfts.sort(() => Math.random() - 0.5).slice(0, transferCount)
  
  for (const nftId of nftsToTransfer) {
    const nft = await prisma.nFT.findUnique({ where: { id: nftId } })
    if (!nft || !nft.isTransferable) continue
    
    // Random yeni sahip
    const newOwner = users[Math.floor(Math.random() * users.length)]
    const price = Math.random() > 0.5 ? (Math.random() * 500 + 50) : null // %50 bedava transfer
    
    await prisma.nFTTransaction.create({
      data: {
        nftId: nft.id,
        fromUserId: nft.currentOwnerId,
        toUserId: newOwner.id,
        price,
        transactionType: price ? 'PURCHASE' : 'TRANSFER',
      }
    })
    
    // NFT owner'ını güncelle
    await prisma.nFT.update({
      where: { id: nft.id },
      data: { currentOwnerId: newOwner.id }
    })
    
    totalTransactions++
  }
  
  console.log(`  ✅ ${transferCount} transfer işlemi oluşturuldu`)
  
  // 4. MARKET LISTINGS (20-30 aktif liste)
  console.log('🏪 Market listings oluşturuluyor...')
  
  const listingCount = Math.floor(Math.random() * 11) + 20 // 20-30
  const nftsForListing = nfts
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(listingCount, nfts.length))
  
  for (const nftId of nftsForListing) {
    const nft = await prisma.nFT.findUnique({ where: { id: nftId } })
    if (!nft || !nft.isTransferable || !nft.currentOwnerId) continue
    
    // Rarity'ye göre fiyat
    let basePrice = 100
    if (nft.rarity === 'RARE') basePrice = 300
    if (nft.rarity === 'EPIC') basePrice = 800
    
    const price = basePrice + Math.random() * basePrice
    const status: 'ACTIVE' | 'SOLD' | 'CANCELLED' = 
      Math.random() > 0.7 ? (Math.random() > 0.5 ? 'SOLD' : 'CANCELLED') : 'ACTIVE'
    
    await prisma.nFTMarketListing.create({
      data: {
        nftId: nft.id,
        listedByUserId: nft.currentOwnerId,
        price,
        status,
        listedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Son 30 gün
      }
    })
    
    totalListings++
  }
  
  console.log(`  ✅ ${totalListings} market listing oluşturuldu`)
  
  // İstatistikler hesapla
  const activeListings = await prisma.nFTMarketListing.count({ where: { status: 'ACTIVE' } })
  const soldListings = await prisma.nFTMarketListing.count({ where: { status: 'SOLD' } })
  const commonNFTs = await prisma.nFT.count({ where: { rarity: 'COMMON' } })
  const rareNFTs = await prisma.nFT.count({ where: { rarity: 'RARE' } })
  const epicNFTs = await prisma.nFT.count({ where: { rarity: 'EPIC' } })
  
  // Özet
  console.log('\n' + '═'.repeat(80))
  console.log('✨ PHASE 13 TAMAMLANDI - NFT & MARKETPLACE\n')
  console.log(`   🎨 Total NFTs: ${nfts.length}`)
  console.log(`      👤 Kullanıcı başına ortalama: ${(nfts.length / users.length).toFixed(1)} NFT`)
  console.log(`      🔹 COMMON: ${commonNFTs}`)
  console.log(`      💎 RARE: ${rareNFTs}`)
  console.log(`      ⭐ EPIC: ${epicNFTs}`)
  console.log(`   🏷️ Attributes: ${totalAttributes}`)
  console.log(`   🔄 Transactions: ${totalTransactions}`)
  console.log(`      🆕 MINT: ${nfts.length}`)
  console.log(`      📤 TRANSFER/PURCHASE: ${totalTransactions - nfts.length}`)
  console.log(`   🏪 Market Listings: ${totalListings}`)
  console.log(`      🟢 ACTIVE: ${activeListings}`)
  console.log(`      ✅ SOLD: ${soldListings}`)
  console.log(`      ❌ CANCELLED: ${totalListings - activeListings - soldListings}`)
  console.log('═'.repeat(80) + '\n')
}

// ==================== REMAINING PHASES: BADGES, SYSTEM TABLES ====================

/**
 * Kalan tüm sistemleri oluştur (Badges, System Tables)
 */
async function seedRemainingSystemTables() {
  console.log('\n🏅 Kalan sistem tabloları oluşturuluyor...\n')
  console.log(
    "ℹ️  Legacy badge seeding (badgeNames / random categories) devre dışı bırakıldı.\n" +
      "   Badge kategorileri + ladder badge'ler aşağıdaki idempotent akışta seed'leniyor.\n"
  )
  return
}

/**
 * Genel görsel mapping sistemi
 * Tüm görsel tipleri için merkezi yönetim
 * 
 * Kullanım:
 * - Yeni görsel eklemek için: 'Entity Name': 'media.key'
 * - Mevcut görseli değiştirmek için: 'Entity Name': 'media.new-key'
 */
const MEDIA_IMAGE_MAPPING: {
  product?: Record<string, SeedMediaKey>;
  mainCategory?: Record<string, SeedMediaKey>;
  subCategory?: Record<string, SeedMediaKey>;
  brandCategory?: Record<string, SeedMediaKey>;
  brand?: Record<string, SeedMediaKey>;
  brandBanner?: Record<string, SeedMediaKey>; // Brand banner görselleri
  badge?: Record<string, SeedMediaKey>;
  post?: Record<string, SeedMediaKey>; // Post type bazlı
  marketplaceBanner?: Record<string, SeedMediaKey>;
  userAvatar?: Record<string, SeedMediaKey>; // User identifier bazlı
  userBanner?: Record<string, SeedMediaKey>; // User identifier bazlı
} = {
  // Gerçek brand isimleri ile görsel eşleştirmeleri
  brand: {
    // Electronics brand'ları
    'Apple': 'brand.catalog.electronic-apple',
    'Samsung': 'brand.catalog.electronic-samsung',
    'Xiaomi': 'brand.catalog.electronic-xiaomi',
    'JBL': 'brand.catalog.electronic-jbl',
    'Marshall': 'brand.catalog.electronic-marshall',
    'ASUS': 'brand.catalog.electronic-asus',
    'MSI': 'brand.catalog.electronic-msi',
    'Nvidia': 'brand.catalog.electronic-nvidia',
    'Canon': 'brand.catalog.electronic-canon',
    'SteelSeries': 'brand.catalog.electronic-steelseries',
    'Dyson': 'brand.catalog.electronic-dyson',
    'Shark': 'brand.catalog.electronic-shark',
    // Cosmetic brand'ları
    'Chanel': 'brand.catalog.cosmetic-chanel',
    'Dior': 'brand.catalog.cosmetic-dior',
    'MAC': 'brand.catalog.cosmetic-mac',
    'L\'Oreal Paris': 'brand.catalog.cosmetic-lorealparis',
    'Maybelline': 'brand.catalog.cosmetic-maybelline',
    'NARS': 'brand.catalog.cosmetic-nars',
    'Estée Lauder': 'brand.catalog.cosmetic-esteelauder',
    'Sephora': 'brand.catalog.cosmetic-sephora',
    'Bioderma': 'brand.catalog.cosmetic-bioderma',
    'Neutrogena': 'brand.catalog.cosmetic-neutrogena',
    'Farmasi': 'brand.catalog.cosmetic-farmasi',
    'Flormar': 'brand.catalog.cosmetic-flormar',
    // Fake brand'lar için de mapping (geriye dönük uyumluluk)
    'AudioMax': 'brand.catalog.electronic-apple',
    'SoundWave': 'brand.catalog.electronic-jbl',
    'PulseAudio': 'brand.catalog.electronic-marshall',
    'VoltEdge': 'brand.catalog.electronic-samsung',
    'CircuitHub': 'brand.catalog.electronic-xiaomi',
    'TechVision': 'brand.catalog.electronic-asus',
    'TechNova': 'brand.catalog.electronic-msi',
    'FutureTech': 'brand.catalog.electronic-nvidia',
    'NanoWorks': 'brand.catalog.electronic-canon',
    'SmartCore': 'brand.catalog.electronic-steelseries',
    'SmartHome Pro': 'brand.catalog.electronic-dyson',
    'BeautyCare': 'brand.catalog.cosmetic-chanel',
    'GlowBeauty': 'brand.catalog.cosmetic-dior',
    'LuxeGlow': 'brand.catalog.cosmetic-mac',
    'PureBeauty': 'brand.catalog.cosmetic-lorealparis',
    'SkinEssence': 'brand.catalog.cosmetic-maybelline',
    'StyleHub': 'brand.catalog.cosmetic-nars',
    'FashionForward': 'brand.catalog.cosmetic-esteelauder',
    'UrbanStyle': 'brand.catalog.cosmetic-sephora',
    'ChicLane': 'brand.catalog.cosmetic-bioderma',
    'TrendLine': 'brand.catalog.cosmetic-neutrogena',
  },
  // Brand banner görselleri
  brandBanner: {
    'Apple': 'brand.banner.electronic-apple',
    'Samsung': 'brand.banner.electronic-samsung',
    'Xiaomi': 'brand.banner.electronic-xiaomi',
    'JBL': 'brand.banner.electronic-jbl',
    'Marshall': 'brand.banner.electronic-marshall',
    'ASUS': 'brand.banner.electronic-asus',
    'MSI': 'brand.banner.electronic-msi',
    'Nvidia': 'brand.banner.electronic-nvidia',
    'Canon': 'brand.banner.electronic-canon',
    'SteelSeries': 'brand.banner.electronic-steelseries',
    'Dyson': 'brand.banner.electronic-dyson',
    'Shark': 'brand.banner.electronic-shark',
  },
  // Product görselleri - Feed akışında kullanılacak tüm görseller
  product: {
    // Apple ürünleri
    'iPhone 17': 'product.apple.iphone17',
    'iPhone 17 Pro': 'product.apple.iphone17pro',
    'iPhone 16e': 'product.apple.iphone16e',
    'iPhone Air': 'product.apple.iphoneair',
    'iPhone 15 Pro': 'product.apple.iphone17pro', // Geriye dönük uyumluluk
    'AirPods 4': 'product.apple.airpods4',
    'AirPods 4 ANC': 'product.apple.airpods4anc',
    'AirPods Max': 'product.apple.airpodsmax',
    'AirPods Pro 3': 'product.apple.airpodspro3',
    'Watch SE 3': 'product.apple.watchse3',
    'Watch Series 11': 'product.apple.watchseries11',
    'Watch Ultra 3': 'product.apple.watchultra3',
    // Brand + Product kombinasyonları
    'Apple iPhone 17': 'product.apple.iphone17',
    'Apple iPhone 17 Pro': 'product.apple.iphone17pro',
    'Apple iPhone 16e': 'product.apple.iphone16e',
    'Apple iPhone Air': 'product.apple.iphoneair',
    'Apple AirPods 4': 'product.apple.airpods4',
    'Apple AirPods 4 ANC': 'product.apple.airpods4anc',
    'Apple AirPods Max': 'product.apple.airpodsmax',
    'Apple AirPods Pro 3': 'product.apple.airpodspro3',
    'Apple Watch SE 3': 'product.apple.watchse3',
    'Apple Watch Series 11': 'product.apple.watchseries11',
    'Apple Watch Ultra 3': 'product.apple.watchultra3',
    // Diğer ürün görselleri (feed akışında kullanılacak)
    'Smartwatch': 'product.smartwatch',
    'Smart Watch': 'product.smartwatch',
    'Watch': 'product.smartwatch',
    'Dyson V15s': 'product.vacuum.dyson',
    'Dyson V12': 'product.vacuum.dyson',
    'Dyson': 'product.vacuum.dyson',
    'MacBook': 'product.laptop.macbook',
    'MacBook Pro': 'product.laptop.macbook',
    'MacBook Air': 'product.laptop.macbook',
    'Laptop': 'product.laptop.macbook',
    'Headphone': 'product.headphone.primary',
    'Headphones': 'product.headphone.primary',
    'Earbuds': 'product.headphone.secondary',
    'Wireless Earbuds': 'product.headphone.secondary',
    'Samsung Phone': 'product.phone.samsung',
    'Samsung': 'product.phone.samsung',
  },
  // Brand category görselleri (mevcut catalog görsellerini kullan)
  brandCategory: {
    'Technology': 'brand.category.computers-tablets',
    'Home & Living': 'brand.category.home-appliances',
    'Kitchen': 'brand.category.home-appliances',
    'Health & Fitness': 'brand.category.headphones',
    'Fashion': 'brand.category.headphones',
    'Electronics': 'brand.category.phones',
    'Sustainability': 'brand.category.smart-home-devices',
    'Gaming': 'brand.category.games',
    'Beauty': 'brand.category.cameras',
    'Outdoor': 'brand.category.drone',
    'Pets': 'brand.category.kucukev',
    'Travel': 'brand.category.cameras',
    'Baby': 'brand.category.kucukev',
    'Automotive': 'brand.category.otomotiv',
  },
  // Badge görselleri (tests/assets/badge klasöründen)
  badge: {
    // Ana badge'ler
    'Early Adapter': 'badge.earlyadapter',
    'Hardware Expert': 'badge.hardwareexpert',
    'Premium Shopper': 'badge.premiumshoper',
    'Wish Marker': 'badge.wishmarker',
    'Tech Enthusiast': 'badge.badge-1',
    'Beauty Guru': 'badge.badge-2',
    'Gadget Master': 'badge.badge-3',
    'Style Curator': 'badge.badge-4',
    'Smart Buyer': 'badge.badge-5',
    'Product Expert': 'badge.badge-6',
    'Review Pro': 'badge.badge-7',
    // Brand badge'ler
    'Brand Badge 1': 'badge.brand.brandbadge1',
    'Brand Badge 2': 'badge.brand.brandbadge2',
    'Brand Badge 3': 'badge.brand.brandbadge3',
    'Brand Badge 4': 'badge.brand.brandbadge4',
    'Brand Badge 5': 'badge.brand.brandbadge5',
    'Brand Badge 6': 'badge.brand.brandbadge6',
  },
  // User avatar görselleri (tests/assets/userprofile klasöründen)
  userAvatar: {
    'omer': 'user.avatar.omer',
    'tuna': 'user.avatar.man1',
    'mehmet': 'user.avatar.mehmet',
    'ibrahim': 'user.avatar.man2',
    'burakcan': 'user.avatar.burakcan',
    'mihrac': 'user.avatar.mihrac',
    'irem': 'user.avatar.woman1',
    'furkan': 'user.avatar.furkan',
    'aycan': 'user.avatar.aycan',
    'ozan': 'user.avatar.ozan',
    'elif': 'user.avatar.woman2',
    'can': 'user.avatar.man3',
    'zeynep': 'user.avatar.woman3',
    'ahmet': 'user.avatar.man4',
    'selin': 'user.avatar.woman4',
    'emre': 'user.avatar.man5',
    'deniz': 'user.avatar.woman5',
    'baris': 'user.avatar.primary',
    'merve': 'user.avatar.trust1',
    'berkay': 'user.avatar.trust2',
    'asli': 'user.avatar.trust3',
    'murat': 'user.avatar.trust4',
    'gizem': 'user.avatar.trust5',
    'onur': 'user.avatar.truster1',
    'burcu': 'user.avatar.truster2',
    'tolga': 'user.avatar.truster3',
    'ebru': 'user.avatar.coach',
    'serkan': 'user.avatar.market',
    'ece': 'user.avatar.primary',
    'kaan': 'user.avatar.man1',
    'derya': 'user.avatar.woman1',
    'selim': 'user.avatar.man2',
    'pelin': 'user.avatar.woman2',
    'cem': 'user.avatar.man3',
    'duygu': 'user.avatar.woman3',
    'hakan': 'user.avatar.man4',
    'nil': 'user.avatar.woman4',
    'utku': 'user.avatar.man5',
    'ceren': 'user.avatar.woman5',
    'yigit': 'user.avatar.primary',
    'sude': 'user.avatar.trust1',
    'alper': 'user.avatar.trust2',
  },
  // User banner görselleri
  userBanner: {
    'default': 'user.banner.primary',
  },
};

/**
 * Product için görsel key'ini bul
 */
function getProductImageKey(productName: string, brand?: string | null): SeedMediaKey | undefined {
  const mapping = MEDIA_IMAGE_MAPPING.product;
  if (!mapping) return undefined;
  
  // 1. Product name ile bak
  if (mapping[productName]) return mapping[productName];
  
  // 2. Brand + name kombinasyonu
  if (brand && mapping[`${brand} ${productName}`]) {
    return mapping[`${brand} ${productName}`];
  }
  
  // 3. Sadece brand ile
  if (brand && mapping[brand]) return mapping[brand];
  
  // 4. Apple brand'ı için rastgele Apple görseli seç
  if (brand === 'Apple' || brand?.toLowerCase() === 'apple') {
    const appleImageKeys: SeedMediaKey[] = [
      'product.apple.iphone17',
      'product.apple.iphone17pro',
      'product.apple.iphone16e',
      'product.apple.iphoneair',
      'product.apple.airpods4',
      'product.apple.airpods4anc',
      'product.apple.airpodsmax',
      'product.apple.airpodspro3',
      'product.apple.watchse3',
      'product.apple.watchseries11',
      'product.apple.watchultra3',
    ];
    // Product name'e göre deterministik rastgele seçim (aynı product için aynı görsel)
    if (appleImageKeys.length > 0) {
      let hash = 0;
      for (let i = 0; i < productName.length; i++) {
        hash = ((hash << 5) - hash) + productName.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
      }
      const index = Math.abs(hash) % appleImageKeys.length;
      return appleImageKeys[index];
    }
  }
  
  return undefined;
}

/**
 * BrandCategory için görsel key'ini bul
 */
function getBrandCategoryImageKey(categoryName: string): SeedMediaKey | undefined {
  return MEDIA_IMAGE_MAPPING.brandCategory?.[categoryName];
}

/**
 * Brand için görsel key'ini bul
 */
function getBrandImageKey(brandName: string): SeedMediaKey | undefined {
  return MEDIA_IMAGE_MAPPING.brand?.[brandName];
}

/**
 * Badge için görsel key'ini bul
 */
function getBadgeImageKey(badgeName: string): SeedMediaKey | undefined {
  return MEDIA_IMAGE_MAPPING.badge?.[badgeName];
}

/**
 * Post için görsel key'ini bul (type bazlı)
 */
function getPostImageKey(postType: string): SeedMediaKey | undefined {
  return MEDIA_IMAGE_MAPPING.post?.[postType];
}

/**
 * Brand banner için görsel key'ini bul
 */
function getBrandBannerImageKey(brandName: string): SeedMediaKey | undefined {
  return MEDIA_IMAGE_MAPPING.brandBanner?.[brandName];
}

/**
 * Marketplace banner için görsel key'ini bul
 */
function getMarketplaceBannerImageKey(bannerName: string): SeedMediaKey | undefined {
  return MEDIA_IMAGE_MAPPING.marketplaceBanner?.[bannerName];
}

/**
 * User avatar için görsel key'ini bul
 */
function getUserAvatarImageKey(userIdentifier: string): SeedMediaKey | undefined {
  return MEDIA_IMAGE_MAPPING.userAvatar?.[userIdentifier];
}

/**
 * User banner için görsel key'ini bul
 */
function getUserBannerImageKey(userIdentifier: string): SeedMediaKey | undefined {
  return MEDIA_IMAGE_MAPPING.userBanner?.[userIdentifier];
}

/**
 * Feed akışında kullanılacak product görselleri pool'u
 * Post media için rastgele görsel seçiminde kullanılır
 * tests/assets/product/ klasöründeki tüm görseller burada listelenir
 */
const FEED_PRODUCT_IMAGE_POOL: SeedMediaKey[] = [
  // Telefon görselleri
  'product.phone1',
  'product.phone2',
  'product.phone3',
  'product.phone4',
  'product.phone5',
  'product.phone6',
  'product.samsun',
  // Diğer ürün görselleri
  'product.macbook',
  'product.dyson',
  'product.headphone',
  'product.headphone2',
  'product.smartwatch',
  // Post görselleri (electronic-post) - feed'de kullanılabilir
  'product.electronic-post-1',
  'product.electronic-post-2',
  'product.electronic-post-3',
  'product.electronic-post-4',
  'product.electronic-post-5',
  'product.electronic-post-6',
  'product.electronic-post-7',
  'product.electronic-post-8',
  'product.electronic-post-9',
  'product.electronic-post-10',
  // Post görselleri (makeup-post) - feed'de kullanılabilir
  'product.makeup-post-1',
  'product.makeup-post-2',
  'product.makeup-post-3',
  'product.makeup-post-4',
  'product.makeup-post-5',
  'product.makeup-post-6',
  'product.makeup-post-7',
  'product.makeup-post-8',
  'product.makeup-post-9',
  'product.makeup-post-10',
]

/**
 * Tüm entity'lerin görsellerini güncelle (sadece mapping'de belirtilenler)
 * 
 * NOT: Bu fonksiyon manuel olarak çağrılmalıdır (seed otomatik çalışmaz)
 * 
 * Kullanım:
 * await updateAllEntityImages();
 */


// BrandCategory için idempotent create/update
/**
 * Marka logolarını img.logo.dev API'sinden çekerek Brand tablosundaki logoUrl alanını günceller
 * brand.service.ts'deki mantığı kullanır:
 * - Eğer brand.imageUrl varsa ve "NULL" değilse, resolveMediaUrl ile çözümlenir
 * - Yoksa, website varsa img.logo.dev API'sinden logo çekilir
 * - Hiçbiri yoksa boş string kalır
 */
async function updateBrandLogosFromLogoDev(): Promise<void> {
  console.log('\n🖼️  Marka logoları güncelleniyor (img.logo.dev)...\n')
  
  const slugifyOptions = {
    lower: true,
    strict: true,
    locale: 'tr',
    trim: true,
  }
  
  // brandToWebsite mapping'ini oluştur
  const brandMap: { [key: string]: { brand: string; website: string } } = {}
  brandToWebsite.forEach((brand) => {
    const slug = slugify(brand.brand, slugifyOptions)
    // Aynı slug için ilk eşleşmeyi kullan (daha sonraki eşleşmeleri override etme)
    if (!brandMap[slug]) {
      brandMap[slug] = brand
    }
  })
  
  // Tüm brand'leri çek
  const allBrands = await prisma.brand.findMany({
    select: {
      id: true,
      name: true,
      logoUrl: true,
      imageUrl: true,
    },
  })
  
  let updatedCount = 0
  let skippedCount = 0
  let errorCount = 0
  
  for (const brand of allBrands) {
    try {
      // Eğer logoUrl zaten varsa ve boş değilse, atla
      if (brand.logoUrl && brand.logoUrl.length > 0 && brand.logoUrl !== 'NULL') {
        skippedCount++
        continue
      }
      
      // Brand adını slugify et
      const slugBrand = slugify(brand.name, slugifyOptions)
      
      // brandToWebsite mapping'inden website'i bul
      const brandData = brandMap[slugBrand]
      const website = brandData?.website
      
      // Logo URL'ini belirle (brand.service.ts mantığına göre)
      // brand.service.ts'de: imageUrl varsa resolveMediaUrl kullanılır, yoksa website varsa img.logo.dev kullanılır
      // Biz logoUrl'e yazıyoruz, o yüzden website varsa img.logo.dev'den çekiyoruz
      let logoUrl: string | null = null
      
      if (website) {
        // website varsa, img.logo.dev API'sinden logo çek
        logoUrl = `https://img.logo.dev/name/${website}?token=pk_WgZMkY5cTXCH41Z0yJ_Txw`
      }
      
      // Eğer logoUrl bulunduysa, güncelle
      if (logoUrl) {
        await prisma.brand.update({
          where: { id: brand.id },
          data: { logoUrl },
        })
        updatedCount++
        
        // Her 10 brand'ta bir progress göster
        if (updatedCount % 10 === 0) {
          console.log(`    ✅ ${updatedCount}/${allBrands.length} marka için logo güncellendi...`)
        }
      } else {
        skippedCount++
      }
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`    ❌ ${brand.name} için logo güncellenemedi: ${errorMsg}`)
      errorCount++
    }
  }
  
  console.log(`\n✅ Marka logoları güncelleme tamamlandı:`)
  console.log(`   📝 Güncellenen: ${updatedCount}`)
  console.log(`   ⏭️  Atlanan: ${skippedCount}`)
  if (errorCount > 0) {
    console.log(`   ❌ Hatalar: ${errorCount}`)
  }
  console.log('')
}

// BadgeCategory için idempotent create/update
async function ensureBadgeCategory(config: { name: string; description?: string }): Promise<{ id: string; name: string }> {
  const existing = await prisma.badgeCategory.findFirst({
    where: { name: config.name }
  });
  
  if (existing) {
    return existing;
  }
  
  return prisma.badgeCategory.create({
    data: config
  });
}

// Badge için idempotent create/update
async function ensureBadge(config: { name: string; categoryId: string; description?: string; type: string; rarity: string; boostMultiplier?: number; rewardMultiplier?: number; imageKey?: SeedMediaKey }): Promise<{ id: string; name: string; categoryId: string }> {
  // Eğer imageKey belirtilmemişse, mapping'den otomatik bul
  let finalImageKey = config.imageKey;
  if (!finalImageKey) {
    finalImageKey = getBadgeImageKey(config.name);
  }
  
  const existing = await prisma.badge.findFirst({
    where: { name: config.name }
  });
  
  if (existing) {
    const updateData: any = {};
    if (config.description !== undefined) updateData.description = config.description;
    if (config.type) updateData.type = config.type as any;
    if (config.rarity) updateData.rarity = config.rarity as any;
    if (config.boostMultiplier !== undefined) updateData.boostMultiplier = config.boostMultiplier;
    if (config.rewardMultiplier !== undefined) updateData.rewardMultiplier = config.rewardMultiplier;
    if (config.categoryId) updateData.categoryId = config.categoryId;
    if (finalImageKey) {
      const imageUrl = getSeedMediaPath(finalImageKey, true);
      if (imageUrl) updateData.imageUrl = imageUrl;
    }
    
    if (Object.keys(updateData).length > 0) {
      return prisma.badge.update({
        where: { id: existing.id },
        data: updateData
      });
    }
    return existing;
  }
  
  return prisma.badge.create({
    data: {
      name: config.name,
      description: config.description,
      categoryId: config.categoryId,
      type: config.type as any,
      rarity: config.rarity as any,
      boostMultiplier: config.boostMultiplier,
      rewardMultiplier: config.rewardMultiplier,
      imageUrl: finalImageKey ? (getSeedMediaPath(finalImageKey, true) || null) : null,
    }
  });
}

/**
 * Badge'leri kullanıcılara atar
 * - Öne çıkan olmayan kullanıcılara: Early Adapter
 * - Öne çıkan kullanıcılara: Early Adapter + 3 ACHIEVEMENT + 1 BRAND (Event badge'leri yok)
 */
async function assignBadgesToUsers(badges: Array<{ id: string; name: string; type: string }>): Promise<void> {
  console.log('\n🎖️  Badgeler kullanıcılara atanıyor...\n')

  // Öne çıkan kullanıcı ID'leri
  const featuredUserIds = [
    TEST_USER_ID, // omer
    TRUST_USER_IDS[0], // tuna
    TRUST_USER_IDS[2], // ibrahim
    TRUST_USER_IDS[3], // burakcan
    TRUST_USER_IDS[4], // mihrac
    TRUSTER_USER_IDS[1], // furkan
    TRUSTER_USER_IDS[2], // aycan
    TRUSTER_USER_IDS[0], // irem
    JULIA_USER_ID, // ozan
  ]

  // Tüm kullanıcıları al
  const allUsers = await prisma.user.findMany({
    select: { id: true }
  })

  if (allUsers.length === 0) {
    console.log('⚠️  Kullanıcı bulunamadı, badge atama atlanıyor')
    return
  }

  // Badge'leri type'a göre filtrele
  const earlyAdapterBadge = badges.find(b => b.name === 'Early Adapter')
  const achievementBadges = badges.filter(b => 
    b.type === 'ACHIEVEMENT' && b.name !== 'Early Adapter'
  )
  const brandBadges = badges.filter(b => b.type === 'BRAND')

  if (!earlyAdapterBadge) {
    console.log('⚠️  Early Adapter badge bulunamadı, atlanıyor')
    return
  }

  let assignedCount = 0
  let featuredAssignedCount = 0
  let nonFeaturedAssignedCount = 0

  // Her kullanıcı için badge atama
  for (const user of allUsers) {
    const isFeatured = featuredUserIds.includes(user.id)
    
    // Mevcut UserBadge'leri kontrol et (duplicate önlemek için)
    const existingUserBadges = await prisma.userBadge.findMany({
      where: { userId: user.id },
      select: { badgeId: true }
    })
    const existingBadgeIds = new Set(existingUserBadges.map(ub => ub.badgeId))

    if (isFeatured) {
      // Öne çıkan kullanıcılar: Early Adapter + 3 ACHIEVEMENT + 1 BRAND
      const badgesToAssign: string[] = []

      // Early Adapter (her zaman)
      if (!existingBadgeIds.has(earlyAdapterBadge.id)) {
        badgesToAssign.push(earlyAdapterBadge.id)
      }

      // 3 random ACHIEVEMENT badge (Early Adapter hariç)
      const availableAchievementBadges = achievementBadges.filter(b => !existingBadgeIds.has(b.id))
      const shuffledAchievements = [...availableAchievementBadges].sort(() => Math.random() - 0.5)
      const selectedAchievements = shuffledAchievements.slice(0, 3)
      badgesToAssign.push(...selectedAchievements.map(b => b.id))

      // 1 random BRAND badge
      const availableBrandBadges = brandBadges.filter(b => !existingBadgeIds.has(b.id))
      if (availableBrandBadges.length > 0) {
        const randomBrandBadge = availableBrandBadges[Math.floor(Math.random() * availableBrandBadges.length)]
        badgesToAssign.push(randomBrandBadge.id)
      }

      // UserBadge'leri oluştur
      for (let i = 0; i < badgesToAssign.length; i++) {
        const badgeId = badgesToAssign[i]
        if (!existingBadgeIds.has(badgeId)) {
          await prisma.userBadge.create({
            data: {
              userId: user.id,
              badgeId,
              isVisible: true,
              visibility: 'PUBLIC',
              claimed: true,
              claimedAt: new Date(),
              displayOrder: i + 1,
            }
          })
          assignedCount++
        }
      }
      featuredAssignedCount += badgesToAssign.length
    } else {
      // Öne çıkan olmayan kullanıcılar: Sadece Early Adapter
      if (!existingBadgeIds.has(earlyAdapterBadge.id)) {
        await prisma.userBadge.create({
          data: {
            userId: user.id,
            badgeId: earlyAdapterBadge.id,
            isVisible: true,
            visibility: 'PUBLIC',
            claimed: true,
            claimedAt: new Date(),
            displayOrder: 1,
          }
        })
        assignedCount++
        nonFeaturedAssignedCount++
      }
    }
  }

  console.log(`✅ ${assignedCount} badge atandı`)
  console.log(`   Öne çıkan kullanıcılar: ${featuredAssignedCount} badge`)
  console.log(`   Diğer kullanıcılar: ${nonFeaturedAssignedCount} badge (Early Adapter)`)
}

// UserTheme için idempotent create/update
async function ensureUserTheme(config: { name: string; description?: string }): Promise<{ id: string; name: string }> {
  const existing = await prisma.userTheme.findFirst({
    where: { name: config.name }
  });
  
  if (existing) {
    return existing;
  }
  
  return prisma.userTheme.create({
    data: config
  });
}

// ComparisonMetric için idempotent create/update
async function ensureComparisonMetric(config: { name: string; description?: string }): Promise<{ id: string; name: string }> {
  const existing = await prisma.comparisonMetric.findFirst({
    where: { name: config.name }
  });
  
  if (existing) {
    return existing;
  }
  
  return prisma.comparisonMetric.create({
    data: config
  });
}

// BoostOption için idempotent create/update
async function ensureBoostOption(config: { title: string; description?: string; amount: number; isPopular?: boolean; isActive?: boolean; image?: string }): Promise<{ id: string; title: string }> {
  const existing = await prisma.boostOption.findFirst({
    where: { title: config.title }
  });
  
  if (existing) {
    return existing;
  }
  
  return prisma.boostOption.create({
    data: config as any
  });
}

// AchievementChain için idempotent create/update
async function ensureAchievementChain(config: { name: string; description?: string; category: string }): Promise<{ id: string; name: string }> {
  const existing = await prisma.achievementChain.findFirst({
    where: { name: config.name }
  });
  
  if (existing) {
    return existing;
  }
  
  return prisma.achievementChain.create({
    data: config
  });
}

// AchievementGoal için idempotent create/update
async function ensureAchievementGoal(config: { chainId: string; title: string; requirement: string; goalType?: any; rewardBadgeId?: string; pointsRequired: number; difficulty: string }): Promise<{ id: string; chainId: string; title: string }> {
  const existing = await prisma.achievementGoal.findFirst({
    where: { 
      chainId: config.chainId,
      title: config.title
    }
  });
  
  if (existing) {
    return existing;
  }
  
  return prisma.achievementGoal.create({
    data: {
      chainId: config.chainId,
      title: config.title,
      requirement: config.requirement,
      goalType: config.goalType ? (config.goalType as any) : undefined,
      rewardBadgeId: config.rewardBadgeId,
      pointsRequired: config.pointsRequired,
      difficulty: config.difficulty as any,
    } as any,
  });
}

/**
 * Seed tamamlandıktan sonra kullanıcıların achievement progress'ini hesaplayıp yazar.
 * - `achievement_goals.goal_type` dolu olan hedefler için çalışır
 * - `user_achievements` tablosuna progress/completed yazar (geriye düşürmez)
 * - Tamamlananlarda `user_badges` kaydı oluşturur (claimed=false)
 */
async function backfillAchievementProgressForSeed(): Promise<void> {
  console.log('\n🧮 Backfilling achievement progress (seed)...')

  // Tipli goal'ları al (SQL ile; prisma type drift'lerinden etkilenmesin)
  const typedGoals = await prisma.$queryRawUnsafe<
    Array<{ id: string; goal_type: string; points_required: number; reward_badge_id: string | null }>
  >(
    `select id, goal_type, points_required, reward_badge_id
     from achievement_goals
     where goal_type is not null`
  )

  if (!typedGoals.length) {
    console.log('⚠️  goalType olan AchievementGoal bulunamadı, progress backfill atlandı')
    return
  }

  const goalsByType = new Map<string, Array<{ id: string; pointsRequired: number; rewardBadgeId: string | null }>>()
  for (const g of typedGoals as any[]) {
    const typeKey = String(g.goal_type)
    const list = goalsByType.get(typeKey) ?? []
    list.push({
      id: String(g.id),
      pointsRequired: Number(g.points_required) || 0,
      rewardBadgeId: g.reward_badge_id ? String(g.reward_badge_id) : null,
    })
    goalsByType.set(typeKey, list)
  }

  const users = await prisma.user.findMany({ select: { id: true } })
  if (!users.length) {
    console.log('⚠️  Kullanıcı bulunamadı, progress backfill atlandı')
    return
  }

  const grantBadgeIfNeeded = async (userId: string, badgeId: string) => {
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId, badgeId } },
      update: {},
      create: {
        userId,
        badgeId,
        isVisible: true,
        displayOrder: null,
        visibility: 'PUBLIC',
        claimed: false,
        claimedAt: null,
      },
    })
  }

  const upsertUserAchievement = async (args: {
    userId: string
    goalId: string
    total: number
    pointsRequired: number
    rewardBadgeId: string | null
  }) => {
    const { userId, goalId, total, pointsRequired, rewardBadgeId } = args
    if (pointsRequired <= 0) return
    if (!Number.isFinite(total) || total < 0) return

    await prisma.$transaction(async (tx) => {
      const existing = await tx.userAchievement.findUnique({
        where: { userId_goalId: { userId, goalId } },
      })

      if (existing?.completed) return
      const prev = existing?.progress ?? 0
      if (prev >= total) return

      const completedNow = total >= pointsRequired
      const completedAt = completedNow ? existing?.completedAt ?? new Date() : null

      if (existing) {
        await tx.userAchievement.update({
          where: { id: existing.id },
          data: {
            progress: total,
            completed: completedNow,
            completedAt,
          },
        })
      } else {
        await tx.userAchievement.create({
          data: {
            userId,
            goalId,
            progress: total,
            completed: completedNow,
            completedAt,
          },
        })
      }
    })

    if (total >= pointsRequired && rewardBadgeId) {
      await grantBadgeIfNeeded(userId, rewardBadgeId)
    }
  }

  let processed = 0
  for (const u of users) {
    const userId = String(u.id)

    const [postCount, inventoryCount, likeGivenCount, likeReceivedCount] = await Promise.all([
      prisma.contentPost.count({ where: { userId, type: 'EXPERIENCE' } as any }),
      prisma.inventory.count({ where: { userId } }),
      prisma.contentLike.count({ where: { userId, postId: { not: null } } as any }),
      prisma.contentLike.count({ where: { postId: { not: null }, post: { userId } } as any }),
    ])

    const typeTotals: Record<string, number> = {
      POST: postCount,
      INVENTORY: inventoryCount,
      LIKE_GIVEN: likeGivenCount,
      LIKE_RECEIVED: likeReceivedCount,
    }

    for (const [typeKey, total] of Object.entries(typeTotals)) {
      const goals = goalsByType.get(typeKey) ?? []
      for (const g of goals) {
        await upsertUserAchievement({
          userId,
          goalId: g.id,
          total,
          pointsRequired: g.pointsRequired,
          rewardBadgeId: g.rewardBadgeId,
        })
      }
    }

    processed += 1
    if (processed % 200 === 0) {
      console.log(`✅ Backfill processed users: ${processed}`)
    }
  }

  console.log(`✅ Achievement progress backfill tamamlandı. Users: ${processed}`)
}

async function ensureProductImages(userIdToUse: string): Promise<void> {
  // Tüm product'ları al
  const allProducts = await prisma.product.findMany({
    where: {
      imageUrl: { not: null },
    },
    take: 100, // İlk 100 product
  })

  if (allProducts.length === 0) return

  // Batch kontrol: Tüm mevcut inventory'leri tek sorguda al
  const productIds = allProducts.map(p => p.id)
  const existingInventories = await prisma.inventory.findMany({
    where: {
      userId: TEST_USER_ID,
      productId: { in: productIds },
    },
    select: { productId: true, id: true },
  }).catch(() => [])
  const inventoryMap = new Map<string, string>(existingInventories.map(inv => [inv.productId, inv.id] as [string, string]))
  const existingInventoryIds = new Set(existingInventories.map(inv => inv.id))

  // Batch kontrol: Tüm mevcut inventory media'ları tek sorguda al
  const existingMediaList = existingInventoryIds.size > 0
    ? await prisma.inventoryMedia.findMany({
        where: {
          inventoryId: { in: Array.from(existingInventoryIds) },
        },
        select: { inventoryId: true },
      }).catch(() => [])
    : []
  const mediaInventorySet = new Set(existingMediaList.map(m => m.inventoryId))

  let addedCount = 0
  for (const product of allProducts) {
    // Hızlı Map kontrolü (DB sorgusu yok)
    let inventoryId = inventoryMap.get(product.id)
    
    // Eğer inventory yoksa oluştur
    if (!inventoryId) {
      const newInventory = await prisma.inventory.create({
        data: {
          userId: TEST_USER_ID,
          productId: product.id,
          hasOwned: true,
          experienceSummary: `Real‑life ownership experience with ${product.name}`,
        },
      }).catch(() => null)
      if (newInventory) {
        inventoryId = newInventory.id
        inventoryMap.set(product.id, inventoryId!)
      }
    }

    // Hızlı Set kontrolü (DB sorgusu yok)
    if (!inventoryId || mediaInventorySet.has(inventoryId) || !product.imageUrl) continue

    await prisma.inventoryMedia.create({
      data: {
        inventoryId,
        mediaUrl: product.imageUrl,
      },
    }).catch(() => {})
    mediaInventorySet.add(inventoryId)
    addedCount++
  }

  if (addedCount > 0) {
    console.log(`✅ ${addedCount} product için inventory media eklendi`)
  }
}

/**
 * PostMedia Migration: InventoryMedia'dan PostMedia'ya taşıma
 * Tüm mevcut post'lar için InventoryMedia'daki görselleri PostMedia'ya taşır
 */
async function migratePostMediaFromInventory(): Promise<void> {
  interface MigrationStats {
    postsProcessed: number
    mediaMigrated: number
    mediaSkipped: number
    errors: string[]
  }

  const stats: MigrationStats = {
    postsProcessed: 0,
    mediaMigrated: 0,
    mediaSkipped: 0,
    errors: [],
  }

  try {
    // 1. ProductId'si olan tüm postları bul
    const postsWithProduct = await prisma.contentPost.findMany({
      where: {
        productId: { not: null },
      },
      select: {
        id: true,
        userId: true,
        productId: true,
        createdAt: true,
      },
    })

    console.log(`📊 ${postsWithProduct.length} adet product bağlantılı post bulundu`)

    // 2. Her post için inventory'deki görselleri kontrol et
    for (const post of postsWithProduct) {
      if (!post.productId) continue

      try {
        // Post'un userId ve productId'si ile eşleşen inventory'yi bul
        const inventory = await prisma.inventory.findUnique({
          where: {
            userId_productId: {
              userId: post.userId,
              productId: post.productId,
            },
          },
          include: {
            media: {
              orderBy: { createdAt: 'asc' },
            },
          },
        })

        if (!inventory || inventory.media.length === 0) {
          continue
        }

        // Post oluşturulduktan sonra eklenen görselleri bul
        // (Post'dan sonra eklenen görseller muhtemelen post için eklenmiştir)
        const postMedia = inventory.media.filter(
          (media) => media.createdAt >= post.createdAt
        )

        if (postMedia.length === 0) {
          // Eğer post'tan sonra görsel yoksa, tüm görselleri kontrol et
          // Ama bu riskli, bu yüzden sadece atlıyoruz
          stats.mediaSkipped += inventory.media.length
          continue
        }

        // PostMedia'da zaten var mı kontrol et
        const existingMedia = await prisma.postMedia.findMany({
          where: { postId: post.id },
        })

        if (existingMedia.length > 0) {
          // Zaten PostMedia'da görsel varsa atla
          stats.mediaSkipped += postMedia.length
          continue
        }

        // PostMedia'ya taşı
        const mediaToMigrate = postMedia.map((media, index) => ({
          postId: post.id,
          userId: post.userId,
          mediaUrl: media.mediaUrl,
          orderIndex: index,
          createdAt: media.createdAt,
          updatedAt: media.updatedAt,
        }))

        await prisma.postMedia.createMany({
          data: mediaToMigrate,
          skipDuplicates: true,
        })

        stats.postsProcessed++
        stats.mediaMigrated += mediaToMigrate.length
      } catch (error) {
        const errorMsg = `Post ${post.id} işlenirken hata: ${
          error instanceof Error ? error.message : String(error)
        }`
        console.warn(`⚠️ ${errorMsg}`)
        stats.errors.push(errorMsg)
      }
    }

    console.log(`📈 Migration İstatistikleri:`)
    console.log(`   - İşlenen Post: ${stats.postsProcessed}`)
    console.log(`   - Taşınan Görsel: ${stats.mediaMigrated}`)
    console.log(`   - Atlanan Görsel: ${stats.mediaSkipped}`)
    if (stats.errors.length > 0) {
      console.log(`   - Hata: ${stats.errors.length}`)
      stats.errors.slice(0, 5).forEach((error) => console.log(`     - ${error}`))
      if (stats.errors.length > 5) {
        console.log(`     ... ve ${stats.errors.length - 5} hata daha`)
      }
    }
  } catch (error) {
    console.error('❌ PostMedia migration hatası:', error)
    // Hata olsa bile devam et, seed'i durdurma
  }
}


// ===== SEED TAXONOMY ===== 

async function ensureAllPostsHaveMedia(): Promise<void> {
  interface Stats {
    totalPosts: number
    postsWithMedia: number
    postsWithoutMedia: number
    addedMedia: number
    errors: number
  }

  const stats: Stats = {
    totalPosts: 0,
    postsWithMedia: 0,
    postsWithoutMedia: 0,
    addedMedia: 0,
    errors: 0,
  }

  try {
    // Toplam post sayısı
    stats.totalPosts = await prisma.contentPost.count()
    console.log(`📊 Toplam ContentPost sayısı: ${stats.totalPosts}`)

    // PostMedia'sı olan post sayısı
    const postsWithMediaIds = await prisma.postMedia.findMany({
      select: { postId: true },
      distinct: ['postId'],
    })
    stats.postsWithMedia = postsWithMediaIds.length
    console.log(`✅ PostMedia'sı olan post sayısı: ${stats.postsWithMedia}`)

    // PostMedia'sı olmayan post'ları bul
    const postsWithMediaIdSet = new Set(postsWithMediaIds.map((m) => m.postId))
    
    const allPosts = await prisma.contentPost.findMany({
      select: {
        id: true,
        userId: true,
        type: true,
        productId: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
    
    const postsWithoutMedia = allPosts.filter((post) => !postsWithMediaIdSet.has(post.id))
    stats.postsWithoutMedia = postsWithoutMedia.length

    console.log(`❌ PostMedia'sı olmayan post sayısı: ${stats.postsWithoutMedia}`)

    if (postsWithoutMedia.length === 0) {
      console.log('✅ Tüm postların PostMedia kaydı var!')
      return
    }

    // PostMedia ekle
    console.log('📸 PostMedia kayıtları ekleniyor...')
    
    const batchSize = 100
    let processed = 0

    for (let i = 0; i < postsWithoutMedia.length; i += batchSize) {
      const batch = postsWithoutMedia.slice(i, i + batchSize)
      
      // Batch içindeki product'ları toplu olarak çek
      const productIds = batch
        .map((post) => post.productId)
        .filter((id): id is string => id !== null)
      
      const productsMap = new Map<string, string>()
      if (productIds.length > 0) {
        const products = await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, imageUrl: true },
        })
        products.forEach((p) => {
          if (p.imageUrl) {
            productsMap.set(p.id, p.imageUrl)
          }
        })
      }

      // Post type'a göre varsayılan görsel seç (product görselleriyle zenginleştirilmiş)
      // Feed akışında daha fazla çeşitlilik için product görselleri kullanılıyor
      const defaultMediaKeys: Record<string, SeedMediaKey> = {
        'FREE': 'catalog.phones',
        'TIPS': 'catalog.phones',
        'COMPARE': 'catalog.computers-tablets',
        'QUESTION': 'catalog.phones',
        'EXPERIENCE': 'catalog.home-appliances',
        'UPDATE': 'catalog.phones',
      }

      const mediaData = batch.map((post, index) => {
        // Önce product'ın imageUrl'ini kontrol et
        let mediaUrl: string
        if (post.productId && productsMap.has(post.productId)) {
          mediaUrl = productsMap.get(post.productId)!
        } else {
          // Post type'a göre varsayılan görsel kullan
          // Feed akışında çeşitlilik için bazen product görselleri kullan
          const useProductImage = Math.random() > 0.5 // %50 şans
          if (useProductImage && FEED_PRODUCT_IMAGE_POOL.length > 0) {
            const randomIndex = (index + Math.floor(Math.random() * FEED_PRODUCT_IMAGE_POOL.length)) % FEED_PRODUCT_IMAGE_POOL.length
            const randomProductKey = FEED_PRODUCT_IMAGE_POOL[randomIndex]
            const productImageUrl = getSeedMediaPath(randomProductKey, true)
            if (productImageUrl) {
              mediaUrl = productImageUrl
            } else {
              const mediaKey = defaultMediaKeys[post.type] || 'catalog.phones'
              mediaUrl = getSeedMediaPath(mediaKey, true) || ''
            }
          } else {
            const mediaKey = defaultMediaKeys[post.type] || 'catalog.phones'
            mediaUrl = getSeedMediaPath(mediaKey, true) || ''
          }
        }

        return {
          postId: post.id,
          userId: post.userId,
          mediaUrl,
          orderIndex: 0,
        }
      })

      try {
        await prisma.postMedia.createMany({
          data: mediaData,
          skipDuplicates: true,
        })

        processed += batch.length
        stats.addedMedia += batch.length
        
        const percentage = ((processed / postsWithoutMedia.length) * 100).toFixed(1)
        console.log(`✅ ${processed}/${postsWithoutMedia.length} post için PostMedia eklendi (${percentage}%)`)
      } catch (error: any) {
        console.error(`❌ Batch hatası (${i}-${i + batch.length}):`, error.message)
        stats.errors += batch.length
      }
    }

    console.log(`\n📊 PostMedia Tamamlama İstatistikleri:`)
    console.log(`   - Toplam Post: ${stats.totalPosts}`)
    console.log(`   - PostMedia'sı olan: ${stats.postsWithMedia}`)
    console.log(`   - PostMedia'sı olmayan: ${stats.postsWithoutMedia}`)
    console.log(`   - Eklenen PostMedia: ${stats.addedMedia}`)
    if (stats.errors > 0) {
      console.log(`   - Hatalar: ${stats.errors}`)
    }

    if (stats.addedMedia > 0) {
      console.log(`\n✅ ${stats.addedMedia} adet PostMedia kaydı başarıyla eklendi!`)
    }
  } catch (error) {
    console.error('❌ PostMedia tamamlama hatası:', error)
    // Hata olsa bile devam et, seed'i durdurma
  }
}

async function ensureBookmarkFor(userId: string, postId: string): Promise<boolean> {
  const existingFavorite = await prisma.contentFavorite.findFirst({
    where: { userId, postId },
  })

  if (existingFavorite) {
    return false
  }

  await prisma.contentFavorite.create({
    data: {
      userId,
      postId,
    },
  }).catch(() => {})

  await prisma.contentPost.update({
    where: { id: postId },
    data: { favoritesCount: { increment: 1 } },
  }).catch(() => {})

  return true
}

/**
 * Priority kullanıcılar için NFT'ler oluştur ve bazılarını marketplace'e listele
 */
async function seedPriorityUserNFTs() {
  console.log('🖼️  Creating NFTs for priority users...');

  // Priority kullanıcı ID'leri
  const priorityUserIds = [
    '480f5de9-b691-4d70-a6a8-2789226f4e07', // omer
    '11111111-1111-4111-a111-111111111111', // tuna
    '22222222-2222-4222-a222-222222222222', // mehmet
    '33333333-3333-4333-a333-333333333333', // ibrahim
    '44444444-4444-4444-a444-444444444444', // burakcan
    '55555555-5555-4555-a555-555555555555', // mihrac
    'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', // irem
    'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', // furkan
    'cccccccc-cccc-4ccc-cccc-cccccccccccc', // aycan
    '99999999-9999-4999-9999-999999999999', // ozan
  ];

  // NFT templates
  const nftTemplates = [
    { type: 'BADGE', rarity: 'COMMON', name: 'Early Adopter Badge', description: 'Awarded to early platform members', imageUrl: 'https://images.unsplash.com/photo-1634193295627-1cdddf751ebf?w=800' },
    { type: 'BADGE', rarity: 'RARE', name: 'Verified Reviewer Badge', description: 'Given to trusted reviewers', imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800' },
    { type: 'BADGE', rarity: 'EPIC', name: 'Community Leader Badge', description: 'Top contributors to the community', imageUrl: 'https://images.unsplash.com/photo-1614624532983-4ce03382d63d?w=800' },
    { type: 'COSMETIC', rarity: 'COMMON', name: 'Blue Avatar Frame', description: 'A cool blue frame for your avatar', imageUrl: 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=800' },
    { type: 'COSMETIC', rarity: 'RARE', name: 'Golden Profile Theme', description: 'Exclusive golden theme', imageUrl: 'https://images.unsplash.com/photo-1557672199-6414e6bfa3b6?w=800' },
    { type: 'COSMETIC', rarity: 'EPIC', name: 'Animated Background', description: 'Dynamic animated profile background', imageUrl: 'https://images.unsplash.com/photo-1557672199-6414e6bfa3b6?w=800' },
  ];

  let nftCount = 0;
  let listingCount = 0;

  for (const userId of priorityUserIds) {
    // Her kullanıcıya 2-4 random NFT ver
    const nftCountForUser = Math.floor(Math.random() * 3) + 2; // 2-4 NFT
    const selectedTemplates = nftTemplates
      .sort(() => Math.random() - 0.5)
      .slice(0, nftCountForUser);

    for (const template of selectedTemplates) {
      try {
        // NFT oluştur
        const nft = await prisma.nFT.create({
          data: {
            name: template.name,
            description: template.description,
            imageUrl: template.imageUrl,
            type: template.type as any,
            rarity: template.rarity as any,
            currentOwnerId: userId,
            isTransferable: true, // NFT transfer edilebilir
            viewCount: Math.floor(Math.random() * 100), // Random view count
          },
        });

        nftCount++;

        // NFT Transaction kaydet (MINT)
        await prisma.nFTTransaction.create({
          data: {
            nftId: nft.id,
            fromUserId: null, // Mint için fromUserId null
            toUserId: userId,
            transactionType: 'MINT',
            price: null,
          },
        });

        // %40 ihtimalle marketplace'e listele
        if (Math.random() < 0.4) {
          const price = Math.floor(Math.random() * 450) + 50; // 50-500 TIPS

          await prisma.nFTMarketListing.create({
            data: {
              nftId: nft.id,
              listedByUserId: userId,
              price,
              status: 'ACTIVE',
              listedAt: new Date(),
            },
          });

          listingCount++;
          console.log(`   ✅ NFT listed: ${template.name} by user ${userId.substring(0, 8)}... for ${price} TIPS`);
        }

      } catch (error) {
        console.error(`   ❌ Error creating NFT for user ${userId}:`, error);
      }
    }
  }

  console.log(`✅ Created ${nftCount} NFTs for ${priorityUserIds.length} priority users`);
  console.log(`   📊 ${listingCount} NFTs listed on marketplace`);
}

async function main() {
  console.error('🌱 Starting seed process...') // Using stderr to ensure output
  
  // Ortam bilgisini belirle ve logla
  const nodeEnv = process.env.NODE_ENV || 'development'
  const dockerContainer = process.env.DOCKER_CONTAINER === 'true'
  const s3Endpoint = process.env.S3_ENDPOINT || 'http://minio:9000'
  const s3BucketName = process.env.S3_BUCKET_NAME || 'tipbox-media'
  
  // Ortam adını belirle
  let environmentName = 'Development'
  if (nodeEnv === 'test') {
    environmentName = 'Test'
  } else if (nodeEnv === 'production') {
    environmentName = 'Production'
  }
  
  // Container bilgisini belirle
  const containerInfo = dockerContainer 
    ? `Container içinde (${environmentName.toLowerCase()} container)` 
    : 'Container dışında (local)'
  
  console.log('🌱 Starting seed process...\n')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`📋 Ortam Bilgisi:`)
  console.log(`   Ortam: ${environmentName} (NODE_ENV=${nodeEnv})`)
  console.log(`   Çalışma Modu: ${containerInfo}`)
  console.log(`   MinIO Endpoint: ${s3Endpoint}`)
  console.log(`   MinIO Bucket: ${s3BucketName}`)
  console.log(`   MinIO Container: ${s3Endpoint.includes('minio:9000') ? 'tipbox_minio_' + nodeEnv : 'Harici MinIO'}`)
  console.log('═══════════════════════════════════════════════════════════\n')

  // ===== CATALOG DATA CHECK (EN ÖNCE!) =====
  console.log('📦 Catalog verileri kontrol ediliyor...\n')
  const productCount = await prisma.product.count({})
  const categoryCount = await prisma.category.count({});
  const brandCount = await prisma.brand.count({});

  const response  = await prisma.category.findMany({select:{_count:{select:{products:true}},name:true}});
  console.log({categories:response.map(x=>({name:x.name,productCount:x._count.products}))});
  

  console.log(`   📊 Mevcut Durum:`)
  console.log(`      Products: ${productCount.toLocaleString()}`)
  console.log(`      Categories: ${categoryCount.toLocaleString()}`)
  console.log(`      Brands: ${brandCount.toLocaleString()}\n`)

  if (productCount === 0 || categoryCount === 0) {
    console.log('=' .repeat(80))
    console.log('⚠️  CATALOG VERİLERİ BULUNAMADI!')
    console.log('=' .repeat(80))
    console.log('')
    console.log('📋 Seed işlemine devam etmek için önce Product ve Category verileri gereklidir.')
    console.log('')
    console.log('🔧 Catalog-service\'i çalıştırarak bu verileri ekleyebilirsiniz:')
    console.log('')
    console.log('   1️⃣  Catalog-service\'i başlatın:')
    console.log('      docker-compose up catalog-service')
    console.log('')
    console.log('   2️⃣  Veya manuel olarak çalıştırın:')
    console.log('      docker-compose exec catalog-service npm run start')
    console.log('')
    console.log('   3️⃣  Catalog-service Product ve Category\'leri oluşturduktan sonra,')
    console.log('      seed\'i tekrar çalıştırabilirsiniz.')
    console.log('')
    console.log('=' .repeat(80))
    console.log('💡 Seed işlemi durduruldu (hata değil, catalog verileri bekleniyor)')
    console.log('=' .repeat(80))
    console.log('')
    
    await prisma.$disconnect()
    process.exit(0) // Graceful exit, hata değil
  }

  // Brand'ler opsiyonel (şimdilik)
  if (brandCount === 0) {
    console.log('⚠️  Brand verisi bulunamadı (opsiyonel, devam ediliyor)\n')
  }

  console.log('✅ Catalog verileri hazır!')
  console.log(`   📦 ${productCount.toLocaleString()} ürün`)
  console.log(`   📂 ${categoryCount.toLocaleString()} kategori`)
  if (brandCount > 0) {
    console.log(`   🏷️  ${brandCount.toLocaleString()} brand`)
  }
  console.log('')

  // MinIO bucket kontrolü ve oluşturma (seed başlamadan önce)
  console.log('📦 MinIO bucket kontrolü yapılıyor...\n')
  try {
    const s3Service = new S3Service()
    await s3Service.checkAndCreateBucket()
    console.log('✅ MinIO bucket hazır\n')
    
    // Default avatar'ı MinIO'ya yükle
    console.log('📸 Default avatar yükleniyor...')
    const defaultAvatarFilePath = path.join(__dirname, '../tests/assets/defaultavatar/default-useravatar.png')
    
    if (existsSync(defaultAvatarFilePath)) {
      const defaultAvatarBuffer = readFileSync(defaultAvatarFilePath)
      await s3Service.uploadFile(DEFAULT_AVATAR_PATH, defaultAvatarBuffer, 'image/png')
      console.log(`✅ Default avatar yüklendi: ${DEFAULT_AVATAR_PATH}\n`)
    } else {
      console.warn(`⚠️  Default avatar dosyası bulunamadı: ${defaultAvatarFilePath}\n`)
    }
  } catch (error: any) {
    console.error('❌ MinIO bucket kontrolü başarısız!')
    console.error('   Hata:', error instanceof Error ? error.message : String(error))
    console.error('   ⚠️  Seed işlemi bucket olmadan devam edemez!')
    process.exit(1)
  }

  // Veri temizleme: Mevcut post ve PostMedia kayıtlarını sil
  console.log('🧹 Mevcut post ve PostMedia kayıtları temizleniyor...')
  try {
    // İlişkili tabloları önce sil (foreign key constraint'leri nedeniyle)
    await prisma.contentCommentVote.deleteMany({})
    await prisma.contentComment.deleteMany({})
    await prisma.contentLike.deleteMany({})
    await prisma.contentFavorite.deleteMany({})
    await prisma.contentPostView.deleteMany({})
    await prisma.contentPostTag.deleteMany({})
    await prisma.postComparisonScore.deleteMany({})
    await prisma.postComparison.deleteMany({})
    await prisma.postQuestion.deleteMany({})
    await prisma.postTip.deleteMany({})
    await prisma.postTag.deleteMany({})
    await prisma.feedHighlight.deleteMany({})
    await prisma.trendingPost.deleteMany({})
    await prisma.topCommunityChoice.deleteMany({})
    
    // PostMedia'yı sil
    await prisma.postMedia.deleteMany({})
    
    // ContentPost'ları sil
    await prisma.contentPost.deleteMany({})
    
    console.log('✅ Mevcut post ve PostMedia kayıtları temizlendi\n')
  } catch (error) {
    console.error('⚠️  Veri temizleme sırasında hata:', error)
    throw error
  }

  // Progress bar oluştur (toplam 26 ana adım - Trending posts ve Feed distribution eklendi)
  const totalSteps = 26 // Updated: Added trending posts and feed distribution steps
  const progress = new ProgressBar(totalSteps, 50)

  // Seed başlangıcını işaretle (metadata için)
  markSeedStart()
  progress.increment('Metadata başlatılıyor...')
  
  // Seed kullanıcı ID'lerini metadata'ya ekle
  const allSeedUserIds = [
    TEST_USER_ID,
    TARGET_USER_ID,
    ...TRUST_USER_IDS,
    ...TRUSTER_USER_IDS,
    '99999999-9999-4999-9999-999999999999', // JULIA_USER_ID
    COMMUNITY_COACH_USER_ID,
  ]
  
  console.log(`📝 Seed kullanıcı ID'leri metadata'ya ekleniyor: ${allSeedUserIds.length} kullanıcı`)
  for (const userId of allSeedUserIds) {
    addSeedUserId(userId)
  }

  // Seed görsellerini MinIO'ya yükle (opsiyonel - SKIP_SEED_MEDIA_UPLOAD=true ile atlanabilir)
  // MinIO görsel yükleme artık ayrı bir script ile yapılıyor (upload-seed-media.ts)
  // Görselleri önce yüklemek için: docker-compose exec backend npx ts-node scripts/upload-seed-media.ts
  // Veya: npm run db:upload-media (eğer package.json'da tanımlıysa)
  console.log('ℹ️  MinIO görsel yükleme ayrı bir script ile yapılmalı')
  console.log('   💡 Görselleri yüklemek için: docker-compose exec backend npx ts-node scripts/upload-seed-media.ts\n')
  progress.increment('MinIO görsel yükleme bilgisi gösterildi...')

  // Hash password once for all users
  progress.increment('Şifre hashleniyor...')
  passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)

  // 1. System/Admin seed (kullanıcıdan önce)
  progress.increment('System/Admin verileri oluşturuluyor...')
  const { defaultThemeId } = await seedSystem(prisma as any)
  progress.increment('System/Admin verileri oluşturuldu')

  // 1.1 Wishbox Events (entity) - kullanıcıdan önce (UGC opsiyonel)
  progress.increment('Wishbox events oluşturuluyor...')
  try {
    await seedEvents()
    progress.increment('Wishbox events oluşturuldu')
  } catch (error) {
    console.error('⚠️  seedEvents() hatası:', error)
    console.log('   Devam ediliyor...')
    progress.increment('Wishbox events atlandı (hata)')
  }

  // 2. Seed Users
  progress.increment('Seed kullanıcıları oluşturuluyor...')
  const seedUsers = await seedUsersAndProfiles({
    prisma: prisma as any,
    seedUsers: SEED_USERS,
    requiredUserIds: [...FEATURED_USER_IDS, TARGET_USER_ID, COMMUNITY_COACH_USER_ID],
    targetTotal: seedConfig.users.total,
    passwordHash,
    defaultThemeId,
  })
  const allUserIds = Array.from(seedUsers.keys())
  console.log(`✅ ${seedUsers.size} kullanıcı oluşturuldu`)
  progress.increment('Seed kullanıcıları oluşturuldu')

  // Metadata'ya ekle
  for (const userId of seedUsers.keys()) {
    addSeedUserId(userId)
  }

  // 2.1 Auth/User edge-case seed (roles, feed prefs, verification codes, etc.)
  progress.increment('Auth/User edge verileri oluşturuluyor...')
  await seedAuthUserEdges(prisma as any, Array.from(seedUsers.keys()))
  progress.increment('Auth/User edge verileri oluşturuldu')

  // 2.2 Gamification user-state (non-featured: 1-2 badge) + UserAchievement
  progress.increment('Gamification user-state oluşturuluyor...')
  const nonFeaturedUserIds = Array.from(seedUsers.keys()).filter(id => !FEATURED_USER_IDS.includes(id))
  await seedGamificationUserState(prisma as any, nonFeaturedUserIds)
  progress.increment('Gamification user-state oluşturuldu')

  // 3. Experience Taxonomy (Duration, Location, Purpose - for Experience posts)
  await seedTaxonomy()
  progress.increment('Experience Taxonomy oluşturuldu')

  // Categories'i sonraki fonksiyonlar için hazırla (root kategoriler)
  const mainCategories = await prisma.category.findMany({ where: { parentId: null } })
  console.log(`📂 ${mainCategories.length} root category kullanılabilir\n`)

  // NOT: Category / Brand / Product catalog seed'i catalog-service tarafından yönetilir.
  
  // 5. User Inventories (Catalog'daki ürünlerle oluşturulacak)
  progress.increment('Kullanıcı inventory\'leri oluşturuluyor...')
  await seedUserInventories()
  progress.increment('Kullanıcı inventory\'leri oluşturuldu')

  // 7. Posts (40 users × 70 posts = 2800 posts)
  progress.increment('Post\'lar oluşturuluyor...')
  await seedPosts()
  progress.increment('Post\'lar oluşturuldu')
  
  // 7.5 Post Tags
  progress.increment('Post tag\'leri ekleniyor...')
  await seedPostTags()
  progress.increment('Post tag\'leri eklendi')

  // 8. Social Features (Likes, Comments, Views, Shares, Favorites)
  progress.increment('Social features oluşturuluyor...')
  await seedSocialFeatures()
  progress.increment('Social features oluşturuldu')

  // 8. Trust Relations
  progress.increment('Trust relations oluşturuluyor...')
  await seedTrustRelations()
  progress.increment('Trust relations oluşturuldu')

  // 8.5. Trending Posts (Feed distribution'dan önce hazırlanmalı)
  if (seedConfig.derived.trendingEnabled) {
    progress.increment('Trending post\'lar oluşturuluyor...')
    await seedTrendingPosts()
    progress.increment('Trending post\'lar oluşturuldu')
  } else {
    console.log('ℹ️  Trending post atlandı: SEED_TRENDING_ENABLED=false')
  }

  // 14. Messaging (DMThread, DMMessage, DMRequest)
  progress.increment('Messaging oluşturuluyor...')
  await seedMessaging()
  progress.increment('Messaging oluşturuldu')

  // 13. NFT & Marketplace (NFT, Attributes, Transactions, Listings)
  progress.increment('NFT & Marketplace oluşturuluyor...')
  try {
    await seedNFTMarketplace()
    progress.increment('NFT & Marketplace oluşturuldu')
  } catch (error) {
    console.error('⚠️  seedNFTMarketplace() hatası (SubCategory/ProductGroup uyumsuzluğu olabilir):', error)
    console.log('   Devam ediliyor...')
    progress.increment('NFT & Marketplace atlandı (hata)')
  }

  // 10. Badges & System Tables
  progress.increment('Badges & System Tables oluşturuluyor...')
  await seedRemainingSystemTables()
  progress.increment('Badges & System Tables oluşturuldu')

  // Helper function: PostMedia ekleme (yorum bloğu dışına taşındı)
  const ensurePostMedia = async (postId: string, userId: string, postType: string, productId?: string | null): Promise<void> => {
    try {
      // PostMedia zaten var mı kontrol et
      const existingMedia = await prisma.postMedia.findFirst({
        where: { postId }
      })
      
      if (existingMedia) {
        return // Zaten PostMedia var
      }
      
      // Görsel URL'ini belirle
      let mediaUrl: string | null = null
      
      // Önce product'ın imageUrl'ini kontrol et
      if (productId) {
        const product = await prisma.product.findUnique({
          where: { id: productId },
          select: { imageUrl: true }
        })
        if (product?.imageUrl) {
          mediaUrl = product.imageUrl
        }
      }
      
      // Product imageUrl yoksa, post type'a göre varsayılan görsel kullan
      if (!mediaUrl) {
        // Post type'a göre varsayılan görsel seç
        const defaultMediaKeys: Record<string, SeedMediaKey> = {
          'FREE': 'catalog.phones',
          'TIPS': 'catalog.phones',
          'COMPARE': 'catalog.computers-tablets',
          'QUESTION': 'catalog.phones',
          'EXPERIENCE': 'catalog.home-appliances',
          'UPDATE': 'catalog.phones',
        }
        
        // Feed akışında çeşitlilik için bazen product görselleri kullan
        const useProductImage = Math.random() > 0.4 // %40 şans
        if (useProductImage && FEED_PRODUCT_IMAGE_POOL.length > 0) {
          const randomIndex = Math.floor(Math.random() * FEED_PRODUCT_IMAGE_POOL.length)
          const randomProductKey = FEED_PRODUCT_IMAGE_POOL[randomIndex]
          const productImageUrl = getSeedMediaPath(randomProductKey, true)
          if (productImageUrl) {
            mediaUrl = productImageUrl
          } else {
            const mediaKey = defaultMediaKeys[postType] || 'catalog.phones'
            mediaUrl = getSeedMediaPath(mediaKey, true) || ''
          }
        } else {
          const mediaKey = defaultMediaKeys[postType] || 'catalog.phones'
          mediaUrl = getSeedMediaPath(mediaKey, true) || ''
        }
      }
      
      // PostMedia oluştur
      await prisma.postMedia.create({
        data: {
          postId,
          userId,
          mediaUrl,
          orderIndex: 0,
        }
      })
    } catch (error) {
      // Hata olsa bile seed devam etsin
      console.warn(`⚠️ PostMedia eklenirken hata (postId: ${postId}):`, error)
    }
  }

  // ===== FEED DISTRIBUTION =====
  if (seedConfig.derived.feedDistributionEnabled) {
    console.log('\n📡 Feed distribution tetikleniyor...')
    progress.increment('Feed job\'ları oluşturuluyor...')
    
    try {
      const { triggerFeedDistributionAfterSeed } = await import('./seed/trigger-feed-distribution')
      
      // Feed distribution job'larını queue'ya ekle ama tamamlanmasını bekleme
      // Worker'lar arka planda feed'leri oluşturmaya devam edecek
      console.log('ℹ️  Feed job\'ları queue\'ya ekleniyor (arka planda işlenecek)...')
      
      await triggerFeedDistributionAfterSeed(false) // false = bekleme, hemen devam et
      
      progress.increment('Feed job\'ları queue\'ya eklendi')
      console.log('✅ Feed job\'ları oluşturuldu (arka planda işlenecek)')
      console.log('💡 Feed worker çalıştığında bu job\'lar otomatik olarak işlenecek')
    } catch (error) {
      console.error('❌ Feed distribution tetikleme hatası:', error)
      console.log('⚠️  Seed tamamlandı ama feed job\'ları oluşturulamadı. Manuel olarak tetikleyebilirsiniz:')
      console.log('   npx ts-node prisma/seed/trigger-feed-distribution.ts')
    }
  } else {
    console.log('\nℹ️  Feed distribution atlandı: SEED_FEED_DISTRIBUTION_ENABLED=false\n')
  }

  // ===== TRANSACTION SEEDING =====
  console.log('\n💰 Transaction ve Wallet seeding başlatılıyor...')
  progress.increment('Transaction ve wallet verileri oluşturuluyor...')
  
  try {
    const { seedTransactions } = await import('./seed/transaction-seed')
    const transactionResult = await seedTransactions()
    
    progress.increment('Transaction seeding tamamlandı')
    console.log('✅ Transaction seeding completed')
    console.log(`   📊 ${transactionResult.totalWallets} wallet oluşturuldu`)
    console.log(`   💳 ${transactionResult.totalTransactions} transaction oluşturuldu`)
    console.log(`   📈 İstatistikler:`)
    console.log(`      - Type: ${JSON.stringify(transactionResult.byType, null, 2)}`)
    console.log(`      - Status: ${JSON.stringify(transactionResult.byStatus, null, 2)}`)
  } catch (error) {
    console.error('❌ Transaction seeding hatası:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
    console.log('⚠️  Seed devam ediyor ama transaction verileri oluşturulamadı')
  }

  // ===== REWARD CLAIM SEEDING =====
  console.log('\n🎁 Reward Claim seeding başlatılıyor...')
  progress.increment('Reward claim verileri oluşturuluyor...')
  
  try {
    const { seedRewardClaims } = await import('./seed/reward-claim-seed')
    await seedRewardClaims()
    
    progress.increment('Reward claim seeding tamamlandı')
    console.log('✅ Reward claim seeding completed')
  } catch (error) {
    console.error('❌ Reward claim seeding hatası:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
    console.log('⚠️  Seed devam ediyor ama reward claim verileri oluşturulamadı')
  }

  // ===== NFT SEEDING FOR PRIORITY USERS =====
  if (seedConfig.nft.enabled) {
    console.log('\n🖼️  NFT seeding başlatılıyor (priority users)...')
    progress.increment('NFT verileri oluşturuluyor...')
    
    try {
      await seedPriorityUserNFTs()
      progress.increment('NFT seeding tamamlandı')
      console.log('✅ NFT seeding completed')
    } catch (error) {
      console.error('❌ NFT seeding hatası:', error)
      if (error instanceof Error) {
        console.error('   Message:', error.message)
        console.error('   Stack:', error.stack)
      }
      console.log('⚠️  Seed devam ediyor ama NFT verileri oluşturulamadı')
    }
  } else {
    console.log('\nℹ️  NFT seeding atlandı: SEED_NFT_ENABLED=false\n')
  }

  // ===== BRAND LOGO UPDATE FROM LOGO.DEV =====
  console.log('\n🏷️  Marka logoları güncelleniyor (img.logo.dev)...')
  progress.increment('Marka logoları güncelleniyor...')
  
  try {
    await updateBrandLogosFromLogoDev()
    progress.increment('Marka logoları güncellendi')
    console.log('✅ Marka logoları güncelleme tamamlandı')
  } catch (error) {
    console.error('❌ Marka logoları güncelleme hatası:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
    console.log('⚠️  Seed devam ediyor ama marka logoları güncellenemedi')
  }

  // ===== ACHIEVEMENT PROGRESS BACKFILL (AFTER ALL CONTENT SEEDED) =====
  if (seedConfig.derived.achievementBackfillEnabled) {
    progress.increment('Achievement progress backfill...')
    try {
      await backfillAchievementProgressForSeed()
      progress.increment('Achievement progress backfill tamamlandı')
    } catch (error) {
      console.error('❌ Achievement progress backfill hatası:', error)
      if (error instanceof Error) {
        console.error('   Message:', error.message)
        console.error('   Stack:', error.stack)
      }
      console.log('⚠️  Seed devam ediyor ama achievement progress backfill yapılamadı')
    }
  } else {
    console.log('ℹ️  Achievement progress backfill atlandı: SEED_ACHIEVEMENT_BACKFILL_ENABLED=false')
  }

  // ===== SUMMARY =====
  console.log('\n🎉 Seed process completed successfully!')
} // main() closing brace

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
