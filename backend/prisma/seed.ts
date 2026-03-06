import { PrismaClient, Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import * as bcrypt from 'bcryptjs'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { DEFAULT_PROFILE_BANNER_URL } from '../src/domain/user/profile.constants'
import { getSeedMediaPath, SeedMediaKey } from './seed/helpers/media.helper'
import { S3Service } from '../src/infrastructure/s3/s3.service'
import { DEFAULT_AVATAR_PATH } from '../src/infrastructure/config/media.config'
import { ProgressBar } from './seed/helpers/progress-bar'
import { seedTaxonomy } from './seed/taxonomy.seed'
import { seedProductCatalog } from './seed/product-catalog.seed'
import { ensureEventBadgeSystem } from './seed/helpers/ensure-event-badge-system'
import { ensureMarketplaceBadges } from './seed/helpers/ensure-marketplace-badges'
import { seedBrandCatalog } from './seed/steps/brand-catalog.seed'
import { seedUserAvatars } from './seed/steps/user-avatar.seed'
import { seedSocialAndPreferences } from './seed/steps/social-and-preferences.seed'
import { seedPayment } from './seed/steps/payment.seed'
import { seedTipsTransfers } from './seed/steps/tips-transfer.seed'
import { seedExpert } from './seed/steps/expert.seed'
import { seedNotification } from './seed/steps/notification.seed'
import { ensureAdminUser } from './seed/steps/admin-user.seed'
import { seedGamificationCollections } from './seed/steps/gamification-collections.seed'
import { GeminiService } from '../src/infrastructure/ai/gemini.service'
import { brandToWebsite } from '../src/data/brandToWebsite'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const slugify = require('slugify')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { markSeedStart, markSeedEnd, addSeedUserId } = require('./seed/seed-metadata')

const prisma = new PrismaClient()

// Julia Havk user ID (platform mascot — created separately)
const JULIA_USER_ID = 'f0000000-0000-4000-a000-000000000001' // julia.havk@tipbox.co
const COMMUNITY_COACH_USER_ID = '10000000-0000-4000-a000-000000000017' // ebru@tipbox.co

/** Featured users: only these get posts and inventory (when SEED_FEATURED_ONLY=true) */
const FEATURED_USER_IDS = [
  '10000000-0000-4000-a000-000000000001', // elif@tipbox.co
  '10000000-0000-4000-a000-000000000002', // can@tipbox.co
  '10000000-0000-4000-a000-000000000003', // zeynep@tipbox.co
  '10000000-0000-4000-a000-000000000005', // selin@tipbox.co
  '10000000-0000-4000-a000-000000000006', // emre@tipbox.co
  '10000000-0000-4000-a000-000000000007', // deniz@tipbox.co
  '10000000-0000-4000-a000-000000000008', // baris@tipbox.co
  '10000000-0000-4000-a000-000000000010', // berkay@tipbox.co
  '10000000-0000-4000-a000-000000000011', // asli@tipbox.co
]

function isFeaturedOnlyMode(): boolean {
  const v = process.env.SEED_FEATURED_ONLY
  if (v == null || v === '') return true
  return ['1', 'true', 'yes', 'y'].includes(v.trim().toLowerCase())
}

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
    id: '10000000-0000-4000-a000-000000000001',
    name: 'Elif',
    email: 'elif@tipbox.co',
    userName: 'elif',
    avatarKey: 'user.avatar.woman2',
    bio: 'Hair care specialist and styling expert.',
    title: 'Hair Care Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000002',
    name: 'Can',
    email: 'can@tipbox.co',
    userName: 'can',
    avatarKey: 'user.avatar.man3',
    bio: 'Fitness tracker and wearable tech reviewer.',
    title: 'Fitness Tech',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000003',
    name: 'Zeynep',
    email: 'zeynep@tipbox.co',
    userName: 'zeynep',
    avatarKey: 'user.avatar.woman3',
    bio: 'Nail art enthusiast and nail care product tester.',
    title: 'Nail Artist',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000004',
    name: 'Ahmet',
    email: 'ahmet@tipbox.co',
    userName: 'ahmet',
    avatarKey: 'user.avatar.man4',
    bio: 'Men grooming expert and beard care specialist.',
    title: 'Grooming Guru',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000005',
    name: 'Selin',
    email: 'selin@tipbox.co',
    userName: 'selin',
    avatarKey: 'user.avatar.woman4',
    bio: 'Personal care product reviewer and wellness advocate.',
    title: 'Wellness Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000006',
    name: 'Emre',
    email: 'emre@tipbox.co',
    userName: 'emre',
    avatarKey: 'user.avatar.man5',
    bio: 'Tablet and e-reader enthusiast. Digital reading expert.',
    title: 'Digital Reader',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000007',
    name: 'Deniz',
    email: 'deniz@tipbox.co',
    userName: 'deniz',
    avatarKey: 'user.avatar.woman5',
    bio: 'Wireless earbuds collector and audio quality tester.',
    title: 'Audio Lover',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000008',
    name: 'Barış',
    email: 'baris@tipbox.co',
    userName: 'baris',
    avatarKey: 'user.avatar.man1',
    bio: 'Drone pilot and aerial photography enthusiast.',
    title: 'Drone Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000009',
    name: 'Merve',
    email: 'merve@tipbox.co',
    userName: 'merve',
    avatarKey: 'user.avatar.woman1',
    bio: 'Smartwatch and fitness band reviewer.',
    title: 'Wearable Tech',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000010',
    name: 'Berkay',
    email: 'berkay@tipbox.co',
    userName: 'berkay',
    avatarKey: 'user.avatar.man2',
    bio: 'Mechanical keyboard enthusiast and RGB lighting expert.',
    title: 'Keyboard Master',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000011',
    name: 'Aslı',
    email: 'asli@tipbox.co',
    userName: 'asli',
    avatarKey: 'user.avatar.woman2',
    bio: 'Moisturizer and serum expert. Hydration is key!',
    title: 'Hydration Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000012',
    name: 'Murat',
    email: 'murat@tipbox.co',
    userName: 'murat',
    avatarKey: 'user.avatar.man3',
    bio: 'Monitor and display technology reviewer.',
    title: 'Display Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000013',
    name: 'Gizem',
    email: 'gizem@tipbox.co',
    userName: 'gizem',
    avatarKey: 'user.avatar.woman3',
    bio: 'Foundation and concealer specialist.',
    title: 'Base Makeup Pro',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000014',
    name: 'Onur',
    email: 'onur@tipbox.co',
    userName: 'onur',
    avatarKey: 'user.avatar.man4',
    bio: 'Router and networking equipment expert.',
    title: 'Network Guru',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000015',
    name: 'Burcu',
    email: 'burcu@tipbox.co',
    userName: 'burcu',
    avatarKey: 'user.avatar.woman4',
    bio: 'Lipstick and lip care enthusiast.',
    title: 'Lip Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000016',
    name: 'Tolga',
    email: 'tolga@tipbox.co',
    userName: 'tolga',
    avatarKey: 'user.avatar.man5',
    bio: 'Power bank and charging accessories reviewer.',
    title: 'Charging Pro',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000017',
    name: 'Ebru',
    email: 'ebru@tipbox.co',
    userName: 'ebru',
    avatarKey: 'user.avatar.woman5',
    bio: 'Eyeshadow palette collector and eye makeup artist.',
    title: 'Eye Makeup Artist',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000018',
    name: 'Serkan',
    email: 'serkan@tipbox.co',
    userName: 'serkan',
    avatarKey: 'user.avatar.man1',
    bio: 'External SSD and storage solutions expert.',
    title: 'Storage Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000019',
    name: 'Ece',
    email: 'ece@tipbox.co',
    userName: 'ece',
    avatarKey: 'user.avatar.woman1',
    bio: 'Mascara and eyeliner specialist.',
    title: 'Lash Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000020',
    name: 'Kaan',
    email: 'kaan@tipbox.co',
    userName: 'kaan',
    avatarKey: 'user.avatar.man2',
    bio: 'Mouse and gaming accessories reviewer.',
    title: 'Gaming Gear',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000021',
    name: 'Derya',
    email: 'derya@tipbox.co',
    userName: 'derya',
    avatarKey: 'user.avatar.woman2',
    bio: 'Facial cleanser and toner expert.',
    title: 'Cleansing Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000022',
    name: 'Selim',
    email: 'selim@tipbox.co',
    userName: 'selim',
    avatarKey: 'user.avatar.man3',
    bio: 'Webcam and streaming equipment specialist.',
    title: 'Streaming Pro',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000023',
    name: 'Pelin',
    email: 'pelin@tipbox.co',
    userName: 'pelin',
    avatarKey: 'user.avatar.woman3',
    bio: 'Blush and bronzer enthusiast.',
    title: 'Blush Master',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000024',
    name: 'Cem',
    email: 'cem@tipbox.co',
    userName: 'cem',
    avatarKey: 'user.avatar.man4',
    bio: 'USB hub and docking station expert.',
    title: 'Connectivity Pro',
    country: 'Turkey',
  },
]

const DEFAULT_BANNER_URL =  getSeedMediaPath('user.banner.primary', true) || null
const PRIMARY_AVATAR_URL = getSeedMediaPath('user.avatar.man1', true) || getSeedMediaPath('user.avatar.default', true) || null
const MARKET_AVATAR_URL = getSeedMediaPath('user.avatar.man2', true) || getSeedMediaPath('user.avatar.default', true) || null
const INVENTORY_MEDIA_URL = getSeedMediaPath('product.dyson', true) || null
const TRUST_USER_AVATAR_KEYS: SeedMediaKey[] = [
  'user.avatar.man1',
  'user.avatar.man2',
  'user.avatar.man3',
  'user.avatar.man4',
  'user.avatar.man5',
]
const TRUSTER_USER_AVATAR_KEYS: SeedMediaKey[] = [
  'user.avatar.woman1',
  'user.avatar.woman2',
  'user.avatar.woman3',
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
const COMMUNITY_COACH_AVATAR_URL = getSeedMediaPath('user.avatar.woman5', true) || getSeedMediaPath('user.avatar.default', true) || ''
const TARGET_USER_TITLE = 'Marketplace Strategist'

const MARKETPLACE_NFT_IMAGE_KEYS: SeedMediaKey[] = [
  'badge.wishmarker',
  'badge.premiumshoper',
  'badge.hardwareexpert',
  'badge.earlyadapter',
  'marketplace.marketplace',
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

async function ensureMainCategory(config: { name: string; description?: string; imageKey?: SeedMediaKey }): Promise<{ id: string; name: string }> {
  let finalImageKey = config.imageKey;
  if (!finalImageKey) {
    finalImageKey = getMainCategoryImageKey(config.name);
  }
  
  const existing = await prisma.mainCategory.findFirst({
    where: { name: config.name }
  });
  
  if (existing) {
    const updateData: any = {};
    if (config.description !== undefined) updateData.description = config.description;
    if (finalImageKey) {
      const imageUrl = getSeedMediaPath(finalImageKey, true);
      if (imageUrl) updateData.imageUrl = imageUrl;
    }
    
    if (Object.keys(updateData).length > 0) {
      return prisma.mainCategory.update({
        where: { id: existing.id },
        data: updateData
      });
    }
    return existing;
  }
  
  return prisma.mainCategory.create({
    data: {
      name: config.name,
      description: config.description,
      imageUrl: finalImageKey ? (getSeedMediaPath(finalImageKey, true) || null) : null,
    }
  });
}

async function ensureSubCategory(config: { name: string; mainCategoryId: string; description?: string; imageKey?: SeedMediaKey }): Promise<{ id: string; name: string; mainCategoryId: string }> {
  let finalImageKey = config.imageKey;
  if (!finalImageKey) {
    finalImageKey = getSubCategoryImageKey(config.name);
  }
  
  const existing = await prisma.subCategory.findFirst({
    where: { 
      name: config.name,
      mainCategoryId: config.mainCategoryId
    }
  });
  
  if (existing) {
    const updateData: any = {};
    if (config.description !== undefined) updateData.description = config.description;
    if (finalImageKey) {
      const imageUrl = getSeedMediaPath(finalImageKey, true);
      if (imageUrl) updateData.imageUrl = imageUrl;
    }
    
    if (Object.keys(updateData).length > 0) {
      return prisma.subCategory.update({
        where: { id: existing.id },
        data: updateData
      });
    }
    return existing;
  }
  
  return prisma.subCategory.create({
    data: {
      name: config.name,
      mainCategoryId: config.mainCategoryId,
      description: config.description,
      imageUrl: finalImageKey ? (getSeedMediaPath(finalImageKey, true) || null) : null,
    }
  });
}

async function ensureProductGroup(config: { name: string; subCategoryId: string; description?: string; imageKey?: SeedMediaKey }): Promise<{ id: string; name: string; subCategoryId: string }> {
  const existing = await prisma.productGroup.findFirst({
    where: { 
      name: config.name,
      subCategoryId: config.subCategoryId
    }
  });
  
  if (existing) {
    const updateData: any = {};
    if (config.description !== undefined) updateData.description = config.description;
    if (config.imageKey) {
      const imageUrl = getSeedMediaPath(config.imageKey, true);
      if (imageUrl) updateData.imageUrl = imageUrl;
    }
    
    if (Object.keys(updateData).length > 0) {
      return prisma.productGroup.update({
        where: { id: existing.id },
        data: updateData
      });
    }
    return existing;
  }
  
  return prisma.productGroup.create({
    data: {
      name: config.name,
      subCategoryId: config.subCategoryId,
      description: config.description,
      imageUrl: config.imageKey ? (getSeedMediaPath(config.imageKey, true) || null) : null,
    }
  });
}

async function ensureProduct(config: { name: string; brand?: string; groupId?: string; description?: string; imageKey?: SeedMediaKey }): Promise<{ id: string; name: string; brandId?: string | null; groupId?: string | null }> {
  const whereClause: any = { name: config.name };
  
  // Brand name'den brandId'yi bul
  let brandId: string | undefined = undefined;
  if (config.brand) {
    const foundBrand = await prisma.brand.findFirst({
      where: { name: config.brand }
    });
    if (foundBrand) {
      brandId = foundBrand.id;
      whereClause.brandId = brandId;
    }
  }
  
  const existing = await prisma.product.findFirst({
    where: whereClause
  });
  
  let finalImageKey = config.imageKey;
  if (!finalImageKey) {
    finalImageKey = getProductImageKey(config.name, config.brand);
  }
  
  if (existing) {
    const updateData: any = {};
    if (config.description !== undefined) updateData.description = config.description;
    if (config.groupId !== undefined) updateData.groupId = config.groupId;
    if (brandId !== undefined) updateData.brandId = brandId;
    if (finalImageKey) {
      const imageUrl = getSeedMediaPath(finalImageKey, true);
      if (imageUrl) updateData.imageUrl = imageUrl;
    }
    
    if (Object.keys(updateData).length > 0) {
      return prisma.product.update({
        where: { id: existing.id },
        data: updateData
      });
    }
    return existing;
  }
  
  return prisma.product.create({
    data: {
      id: randomUUID(), // UUID oluştur
      name: config.name,
      brandId: brandId || null,
      groupId: config.groupId || null,
      description: config.description || null,
      imageUrl: finalImageKey ? (getSeedMediaPath(finalImageKey, true) || null) : null,
    }
  });
}

// ==================== DEPRECATED: seedProductCategories, seedBrands, seedProducts removed ====================
// These functions are now handled by catalog-service.

// ==================== PHASE 6: POST CREATION ====================

/**
 * Post oluşturma helper fonksiyonu
 */
async function createPost(data: {
  userId: string
  type: 'QUESTION' | 'TIPS' | 'FREE' | 'EXPERIENCE' | 'COMPARE' | 'UPDATE'
  title: string
  body: string
  productId?: string
  productGroupId?: string
  mainCategoryId?: string
  subCategoryId?: string
  categoryId?: string // Yeni hierarchical category ID
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
      productGroupId: data.productGroupId ?? null,
      mainCategoryId: data.mainCategoryId ?? null,
      subCategoryId: data.subCategoryId ?? null,
      categoryId: data.categoryId ?? null, // Yeni categoryId field'ı
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
    // Her post için 2-5 tag ekle
    const tagCount = Math.floor(Math.random() * 4) + 2 // 2-5
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

  const featuredOnly = isFeaturedOnlyMode()
  const users = featuredOnly
    ? await prisma.user.findMany({ where: { id: { in: FEATURED_USER_IDS } } })
    : await prisma.user.findMany({ take: 40 })
  if (featuredOnly) {
    console.log(`   📌 Sadece öne çıkan kullanıcılar için inventory (${users.length} kullanıcı). SEED_FEATURED_ONLY=false ile tüm kullanıcılar kullanılır.\n`)
  }
  const allProducts = await prisma.product.findMany({ take: 500 })
  
  if (allProducts.length === 0) {
    console.log('⚠️  Ürün bulunamadı, Inventory eklenemiyor!')
    return
  }
  
  // Kullanılabilir tüm product görselleri (seed-media-map.json'dan)
  const availableProductImages: SeedMediaKey[] = [
    'product.dyson',
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
    'product.headphone',
    'product.headphone2',
    'product.macbook',
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
    'product.phone1',
    'product.phone2',
    'product.phone3',
    'product.phone4',
    'product.phone5',
    'product.phone6',
    'product.samsun',
    'product.smartwatch',
  ]
  
  let totalInventories = 0
  let totalInventoryMedia = 0
  let skippedNoMedia = 0
  
  for (const user of users) {
    // Her kullanıcı 5-15 ürüne sahip olsun
    const inventoryCount = Math.floor(Math.random() * 11) + 5 // 5-15
    const userProducts = allProducts
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(inventoryCount, allProducts.length))
    
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
      
      // InventoryMedia ekle (ürünlerin %80'ine - daha fazla media)
      if (Math.random() > 0.2) {
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
 * AiExperienceSplit seed: Her aşamada AI veri üretir.
 * 1) Gemini generatePostContent(EXPERIENCE) → ürün hakkında ContentPost için post metni.
 * 2) Gemini splitExperience(experienceText) → priceAndShopping / productAndUsage ayrıştırması.
 * 3) AiExperienceSplit + inventory güncellemesi.
 */
async function seedAiExperienceSplits() {
  const limit = 8
  const ownedInventories = await prisma.inventory.findMany({
    where: { hasOwned: true, experienceSnippetId: null },
    include: {
      product: {
        include: { brand: { select: { name: true } } },
      },
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  })
  if (ownedInventories.length === 0) {
    return
  }
  const geminiService = GeminiService.getInstance()
  const createdSplitIds: string[] = []
  for (const inv of ownedInventories) {
    try {
      // 1) ContentPost için ürün hakkında Experience metni üret (Gemini) — script ile aynı akış
      let original = ''
      try {
        const genResult = await geminiService.generatePostContent({
          postType: 'EXPERIENCE',
          persona: 'product reviewer',
          productName: inv.product.name,
          productBrand: inv.product.brand?.name ?? undefined,
          productDescription: inv.product.description ?? undefined,
        })
        if (genResult?.body?.trim()) {
          original = genResult.body.trim()
        }
      } catch (genErr) {
        console.warn(`   ⚠️  Gemini generate (${inv.product.name}) atlandı:`, genErr instanceof Error ? genErr.message : genErr)
        continue
      }
      if (!original) continue

      // 2) Üretilen metni Gemini ile split et (priceAndShopping / productAndUsage) — script ile aynı
      let splitResult: Awaited<ReturnType<typeof geminiService.splitExperience>>
      try {
        splitResult = await geminiService.splitExperience({
          productId: inv.productId ?? undefined,
          productName: inv.product.name,
          productBrand: inv.product.brand?.name ?? undefined,
          productDescription: inv.product.description ?? undefined,
          experienceText: original,
        })
      } catch (splitErr) {
        console.warn(`   ⚠️  Gemini split (${inv.product.name}) atlandı:`, splitErr instanceof Error ? splitErr.message : splitErr)
        continue
      }

      // 3) AiExperienceSplit kaydı (tüm alanlar AI çıktısı) — script'teki createInventoryItem ile aynı veri yapısı
      const split = await prisma.aiExperienceSplit.create({
        data: {
          userId: inv.userId,
          productId: inv.productId,
          originalExperience: original,
          priceAndShopping: splitResult.priceAndShopping?.content ?? null,
          productAndUsage: splitResult.productAndUsage?.content ?? null,
          priceAndShoppingRating: splitResult.priceAndShopping?.rating ?? null,
          productAndUsageRating: splitResult.productAndUsage?.rating ?? null,
          priceAndShoppingPlaceholder: splitResult.priceAndShopping?.placeholder ?? null,
          productAndUsagePlaceholder: splitResult.productAndUsage?.placeholder ?? null,
          priceAndShoppingIsEnhanced: splitResult.priceAndShopping?.isEnhanced ?? null,
          productAndUsageIsEnhanced: splitResult.productAndUsage?.isEnhanced ?? null,
          isEdited: false,
          model: splitResult.metadata?.model ?? 'gemini-2.5-pro',
          promptVersion: splitResult.metadata?.promptVersion ?? 'v1.0',
          tokensUsed: splitResult.metadata?.tokensUsed ?? null,
          processingTimeMs: splitResult.metadata?.processingTimeMs ?? null,
        },
      })
      await prisma.inventory.update({
        where: { id: inv.id },
        data: { experienceSnippetId: split.id, experienceSummary: original.substring(0, 200) },
      })
      createdSplitIds.push(split.id)
    } catch (e) {
      // skip duplicate or constraint errors
    }
  }

  // Doğrulama: ai_experience_splits tablosuna yazılan kayıtlar DB'de mevcut mu? (script ile aynı doğruluk)
  if (createdSplitIds.length > 0) {
    const verifiedCount = await prisma.aiExperienceSplit.count({
      where: { id: { in: createdSplitIds } },
    })
    if (verifiedCount !== createdSplitIds.length) {
      console.warn(`   ⚠️  AiExperienceSplit doğrulama: beklenen ${createdSplitIds.length}, DB'de ${verifiedCount} kayıt.`)
    } else {
      console.log(`✅ AiExperienceSplit: ${createdSplitIds.length} adet (Gemini: post metni + split, inventory'ye bağlandı, tabloda doğrulandı)\n`)
    }
  }
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
  const postImagesDir = path.join(__dirname, '../tests/assets/post/post-images')
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
 * 500 Post oluştur (30 kullanıcı, öne çıkan kullanıcılar öncelikli)
 */
async function seedPosts() {
  console.log('\n📝 Post oluşturma başlıyor...\n')
  
  // Post görsellerini S3'e yükle
  const postImageUrlMap = await uploadPostImages()
  
  // Öne çıkan kullanıcılar (daha fazla post paylaşacaklar) — non-internal users
  const featuredUserIds = FEATURED_USER_IDS
  
  // Kullanıcıları getir (30 kullanıcı)
  const allUsers = await prisma.user.findMany({
    take: 30,
    orderBy: { createdAt: 'asc' }
  })
  
  if (allUsers.length < 30) {
    console.log(`⚠️ Sadece ${allUsers.length} kullanıcı bulundu, devam ediliyor...`)
  }
  
  // Öne çıkan kullanıcıları önce al; SEED_FEATURED_ONLY=true ise sadece onlar post paylaşır
  const featuredUsers = allUsers.filter(u => featuredUserIds.includes(u.id))
  const otherUsers = allUsers.filter(u => !featuredUserIds.includes(u.id))
  const featuredOnly = isFeaturedOnlyMode()
  let users = featuredOnly
    ? featuredUsers
    : [...featuredUsers, ...otherUsers].slice(0, 30)
  if (featuredOnly && users.length === 0) {
    console.warn('   ⚠️ Öne çıkan kullanıcı bulunamadı, ilk 5 kullanıcı kullanılıyor.')
    users = allUsers.slice(0, 5)
  }
  if (featuredOnly && users.length > 0) {
    console.log(`   📌 Sadece öne çıkan kullanıcılar için post (${users.length} kullanıcı). SEED_FEATURED_ONLY=false ile daha fazla kullanıcı eklenir.\n`)
  }
  console.log(`👥 Toplam ${users.length} kullanıcı (${featuredUsers.length} öne çıkan, ${otherUsers.length} diğer)`)
  
  // Experience taxonomy'leri getir
  const durations = await prisma.experienceDuration.findMany()
  const locations = await prisma.experienceLocation.findMany()
  const purposes = await prisma.experiencePurpose.findMany()
  
  // Popüler marka ve kategori tanımları (case-insensitive eşleşme için normalize edilmiş)
  const POPULAR_BRAND_NAMES = [
    // Elektronik
    'Apple', 'Samsung', 'Sony', 'LG', 'Microsoft', 'HP', 'Dell', 'Lenovo',
    'ASUS', 'Acer', 'MSI', 'NVIDIA', 'Intel', 'AMD', 'Canon', 'Nikon',
    'Logitech', 'Razer', 'Corsair', 'Gigabyte', 'Panasonic', 'Philips',
    'Xiaomi', 'Huawei', 'OnePlus', 'Google', 'Amazon', 'Bose', 'JBL',
    'Sennheiser', 'Beats', 'SteelSeries', 'HyperX', 'ROG', 'Alienware'
  ]

  const POPULAR_CATEGORY_NAMES = [
    'Electronics', 'Cosmetics', 'Beauty', 'Skincare', 'Makeup',
    'Phones', 'Laptops', 'Tablets', 'Cameras', 'Headphones',
    'Watches', 'Gaming', 'Home & Kitchen', 'Fashion', 'Accessories',
    'Smartphones', 'Computers', 'Audio', 'Wearables', 'Smart Home'
  ]

  // Normalize edilmiş listeler (case-insensitive karşılaştırma için)
  const normalizedBrandNames = new Set(
    POPULAR_BRAND_NAMES.map(name => name.toLowerCase().trim())
  )
  const normalizedCategoryNames = new Set(
    POPULAR_CATEGORY_NAMES.map(name => name.toLowerCase().trim())
  )

  // Tüm ürünleri çek (brand ve category ile birlikte)
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
    take: 2000 // Daha fazla çek ki filtreleme sonrası yeterli ürün olsun
  })

  // Case-insensitive filtreleme (popüler markalar veya kategoriler)
  let products = allProducts.filter(product => {
    const brandName = product.brand?.name?.toLowerCase().trim() || ''
    const categoryName = product.category?.name?.toLowerCase().trim() || ''
    
    // Marka veya kategori popüler listede mi kontrol et
    const isPopularBrand = brandName && normalizedBrandNames.has(brandName)
    const isPopularCategory = categoryName && normalizedCategoryNames.has(categoryName)
    
    return isPopularBrand || isPopularCategory
  })

  // İlk 500 popüler ürünü al
  products = products.slice(0, 500)
  
  // Eğer popüler ürün bulunamazsa fallback
  if (products.length === 0) {
    console.warn('⚠️ Popüler ürün bulunamadı, tüm ürünler kullanılacak...')
    const fallbackProducts = await prisma.product.findMany({
      take: 500,
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
    })
    
    if (fallbackProducts.length === 0) {
      throw new Error('❌ Ürün bulunamadı! Önce Phase 5 tamamlanmalı.')
    }
    
    products = fallbackProducts
  }
  
  console.log(`📊 ${products.length} popüler ürün bulundu (popüler markalar/kategoriler)\n`)
  
  let totalPosts = 0
  let successfulPosts = 0
  let failedPosts = 0
  const postTypes: Array<'QUESTION' | 'TIPS' | 'FREE' | 'EXPERIENCE' | 'COMPARE' | 'UPDATE'> = [
    'QUESTION', 'TIPS', 'FREE', 'EXPERIENCE', 'COMPARE', 'UPDATE'
  ]
  
  // GeminiService instance'ı
  const geminiService = GeminiService.getInstance()
  
  // Batch processing için konfigürasyon
  const BATCH_SIZE = 4 // Her batch'te maksimum 4 post içeriği üret (timeout'u önlemek için küçültüldü)
  const BATCH_DELAY = 1000 // Batch'ler arası delay (ms) - rate limiting için artırıldı
  
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
  
  // Her kullanıcı için post isteklerini hazırla
  const TARGET_TOTAL_POSTS = 100 // TestFlight: reduced from 500
  let currentPostCount = 0
  
  for (const user of users) {
    // murat ve nil için post oluşturma
    if (user.email === 'murat@tipbox.co' || user.email === 'nil@tipbox.co') {
      console.log(`  ⏭️  ${user.email} için post oluşturma atlanıyor (boş profil)`)
      continue
    }
    
    // Kullanıcının inventory'sindeki ürünleri getir (EXPERIENCE ve UPDATE için)
    const userInventory = await prisma.inventory.findMany({
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
    
    // Öne çıkan kullanıcılar için daha fazla post (her tipten 2-4 post)
    // Diğer kullanıcılar için daha az post (her tipten 1-2 post)
    const isFeatured = featuredUserIds.includes(user.id)
    const minPostsPerType = isFeatured ? 2 : 1
    const maxPostsPerType = isFeatured ? 4 : 2
    
    // Her tipten post isteği oluştur (her kullanıcı her tipten en az 1 post paylaşacak)
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
        
        // EXPERIENCE ve UPDATE için SADECE inventory'deki ürünler
        if ((postType === 'EXPERIENCE' || postType === 'UPDATE') && userInventory.length > 0) {
          const randomInventory = userInventory[Math.floor(Math.random() * userInventory.length)]
          selectedProduct = randomInventory.product
        } else {
          // Diğer tipler için herhangi bir ürün
          selectedProduct = products[Math.floor(Math.random() * products.length)]
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
          userInventory,
        })
        
        currentPostCount++
      }
    }
    
    // Hedef post sayısına ulaşıldıysa döngüden çık
    if (currentPostCount >= TARGET_TOTAL_POSTS) {
      break
    }
  }
  
  // Eğer hedef sayıya ulaşılmadıysa, öne çıkan kullanıcılara daha fazla post ekle
  if (currentPostCount < TARGET_TOTAL_POSTS) {
    const remainingPosts = TARGET_TOTAL_POSTS - currentPostCount
    console.log(`  📝 Hedef sayıya ulaşmak için ${remainingPosts} post daha ekleniyor (öne çıkan kullanıcılara)...`)
    
    for (const user of featuredUsers) {
      if (currentPostCount >= TARGET_TOTAL_POSTS) {
        break
      }
      
      const userInventory = await prisma.inventory.findMany({
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
      
      const additionalPosts = Math.min(remainingPosts - (TARGET_TOTAL_POSTS - currentPostCount), 5)
      
      for (let i = 0; i < additionalPosts; i++) {
        if (currentPostCount >= TARGET_TOTAL_POSTS) {
          break
        }
        
        const postType = postTypes[Math.floor(Math.random() * postTypes.length)]
        let selectedProduct
        
        if ((postType === 'EXPERIENCE' || postType === 'UPDATE') && userInventory.length > 0) {
          const randomInventory = userInventory[Math.floor(Math.random() * userInventory.length)]
          selectedProduct = randomInventory.product
        } else {
          selectedProduct = products[Math.floor(Math.random() * products.length)]
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
          userInventory,
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
      
      // Fallback body (when AI generation fails)
      const title = ''
      const body = aiResult.success && aiResult.body
        ? aiResult.body
        : `This is a ${req.postType} type post about ${req.selectedProduct.name}. Sharing detailed information and experiences about this product. My experience using it has been quite positive. Quality materials and good design stand out.`
      
      const post = await createPost({
        userId: req.user.id,
        type: req.postType,
        title,
        body,
        productId: req.selectedProduct.id,
        categoryId: req.selectedProduct.categoryId || undefined,
        productGroupId: req.selectedProduct.groupId ?? undefined,
        mainCategoryId: undefined, // Legacy - deprecated
        subCategoryId: undefined, // Legacy - deprecated
        inventoryRequired: req.postType === 'EXPERIENCE' || req.postType === 'UPDATE',
        createdAt: req.createdAt,
      })
      
      // Post tipine göre ilişkili kayıtlar oluştur
      if (req.postType === 'QUESTION') {
        await createPostQuestion(post.id, req.selectedProduct.id)
      } else if (req.postType === 'TIPS') {
        await createPostTip(post.id)
      } else if (req.postType === 'COMPARE') {
        const product2 = products[Math.floor(Math.random() * products.length)]
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
          'product.phone1', 'product.samsun', 'product.macbook',
          'product.smartwatch', 'product.headphone',
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
  
  // Tüm kullanıcıları ve postları getir
  const users = await prisma.user.findMany({ take: 40 })
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
  
  // 1. LIKES - Her post için 3-15 like (ortalama 9)
  console.log('❤️ Likes ekleniyor...')
  for (const post of allPosts) {
    const likeCount = Math.floor(Math.random() * 13) + 3 // 3-15 arası
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
  
  // 2. VIEWS - Her post için 10-50 view (ortalama 30)
  console.log('👁️ Views ekleniyor...')
  for (const post of allPosts) {
    const viewCount = Math.floor(Math.random() * 41) + 10 // 10-50 arası
    
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
  
  // 3. COMMENTS - Her post için 1-5 yorum (ortalama ~3.5) - %30 azaltılmış
  console.log('💬 Comments ekleniyor...')
  const allComments: string[] = []
  
  for (const post of allPosts) {
    const commentCount = Math.floor(Math.random() * 5) + 1 // 1-5 arası
    const commenters = users.sort(() => Math.random() - 0.5).slice(0, Math.min(commentCount, users.length))
    
    for (const user of commenters) {
      const commentId = generateUlid()
      await prisma.contentComment.create({
        data: {
          id: commentId,
          postId: post.id,
          userId: user.id,
          comment: `Bu ürün hakkında düşüncelerim: Kullanımı kolay ve kaliteli. ${Math.random() > 0.5 ? 'Kesinlikle tavsiye ederim!' : 'Bazı eksiklikleri var ama genel olarak memnunum.'}`,
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
  
  // 4. SHARES - Her post için 3-4 paylaşım
  console.log('🔄 Shares ekleniyor...')
  for (const post of allPosts) {
    const shareCount = Math.floor(Math.random() * 2) + 3 // 3-4 arası
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
  
  // 6. FAVORITES - Her kullanıcı ~10 post favori
  console.log('⭐ Favorites ekleniyor...')
  for (const user of users) {
    const favoriteCount = Math.floor(Math.random() * 6) + 8 // 8-13 arası
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
  
  // Özet
  console.log('\n' + '═'.repeat(80))
  console.log('✨ PHASE 7 TAMAMLANDI - SOCIAL FEATURES\n')
  console.log(`   ❤️ Toplam Likes: ${totalLikes}`)
  console.log(`   💬 Toplam Comments: ${totalComments}`)
  console.log(`   👁️ Toplam Views: ${totalViews}`)
  console.log(`   🔄 Toplam Shares: ${totalShares}`)
  console.log(`   ⭐ Toplam Favorites: ${totalFavorites}`)
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
  
  const users = await prisma.user.findMany({ take: 40 })
  
  if (users.length < 2) {
    console.log('⚠️ Yeterli kullanıcı yok, Phase 8 atlanıyor...')
    return
  }
  
  let totalTrusts = 0
  let mutualTrusts = 0
  
  for (const truster of users) {
    // Her kullanıcı 5-20 kişiyi trust eder
    const trustCount = Math.floor(Math.random() * 16) + 5 // 5-20 arası
    
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
  
  // Özet
  console.log('\n' + '═'.repeat(80))
  console.log('✨ PHASE 8 TAMAMLANDI - TRUST RELATIONS\n')
  console.log(`   🤝 Toplam Trust İlişkileri: ${totalTrusts}`)
  console.log(`   💚 Karşılıklı Trust: ${mutualTrusts}`)
  console.log(`   👥 Kullanıcı Başına Ortalama: ${(totalTrusts / users.length).toFixed(1)} trust`)
  console.log(`\n   📊 İlk 5 kullanıcının trust durumu:`)
  
  trustStats.slice(0, 5).forEach(stat => {
    console.log(`      ${stat.email}: ${stat.trusting} kişiye güveniyor, ${stat.trustedBy} kişi tarafından güveniliyor`)
  })
  
  console.log('═'.repeat(80) + '\n')
}

// ==================== PHASE 9: WALLET TRANSACTIONS ====================

/**
 * Her kullanıcı için sample transaction'lar oluştur
 */
async function seedTransactions() {
  console.log('\n💰 Wallet transaction\'ları oluşturuluyor...\n')
  
  const users = await prisma.user.findMany({
    take: 40,
    include: {
      wallets: true // wallets (çoğul) ilişkisini kullan
    }
  })
  
  if (users.length === 0) {
    console.log('⚠️ Kullanıcı bulunamadı, transaction seeding atlanıyor...')
    return
  }
  
  let totalTransactions = 0
  const transactionTypes: Array<'TIP_SEND' | 'TIP_RECEIVE' | 'CLAIM_REWARD' | 'CLAIM_BADGE' | 'NFT_BUY' | 'NFT_SELL' | 'SWAP_TIP_TO_SOL' | 'SWAP_SOL_TO_TIP' | 'AIRDROP' | 'FEE'> = [
    'TIP_SEND',
    'TIP_RECEIVE',
    'CLAIM_REWARD',
    'CLAIM_BADGE',
    'NFT_BUY',
    'NFT_SELL',
    'AIRDROP',
  ]
  
  for (const user of users) {
    if (!user.wallets || user.wallets.length === 0) {
      console.log(`   ⚠️  ${user.email} için wallet bulunamadı, atlanıyor...`)
      continue
    }
    
    const wallet = user.wallets[0]
    
    // Her kullanıcı için 5-15 arası transaction
    const transactionCount = Math.floor(Math.random() * 11) + 5 // 5-15 arası
    
    for (let i = 0; i < transactionCount; i++) {
      const actionType = transactionTypes[Math.floor(Math.random() * transactionTypes.length)]
      const amount = parseFloat((Math.random() * 50 + 10).toFixed(2)) // 10-60 arası
      const status = Math.random() > 0.1 ? 'confirmed' : 'failed' // %90 başarılı
      
      const createdAt = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000) // Son 90 gün
      const confirmedAt = status === 'confirmed' ? new Date(createdAt.getTime() + Math.random() * 5 * 60 * 1000) : null // 0-5 dakika sonra
      const failedAt = status === 'failed' ? new Date(createdAt.getTime() + Math.random() * 5 * 60 * 1000) : null
      
      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          actionType: actionType,
          status: status as any,
          amount: amount,
          fromAddress: actionType === 'TIP_RECEIVE' || actionType === 'CLAIM_REWARD' || actionType === 'AIRDROP' ? 'SYSTEM' : wallet.publicAddress,
          toAddress: wallet.publicAddress,
          provider: 'backend', // lowercase string for provider
          txHash: status === 'confirmed' ? `0x${Math.random().toString(16).substring(2, 66)}` : null,
          errorMessage: status === 'failed' ? 'Transaction failed' : null,
          createdAt: createdAt,
          confirmedAt: confirmedAt,
          failedAt: failedAt,
          metadata: {
            actionType: actionType,
            userId: user.id,
            timestamp: createdAt.toISOString()
          }
        }
      })
      
      totalTransactions++
    }
  }
  
  console.log(`✅ ${totalTransactions} transaction oluşturuldu`)
  console.log(`   Ortalama: ${Math.round(totalTransactions / users.length)} transaction/kullanıcı\n`)
}

// ==================== PHASE 12: EVENTS ====================

/**
 * Event oluştur (10-15 kaliteli, gerçekçi event)
 * Event participation, scenarios, rewards ekle
 */
// Yeni seedEvents fonksiyonu - Elektronik ve Beauty odaklı, ürün bazlı
async function seedEvents() {
  console.log('\n🎉 Events oluşturuluyor (Elektronik & Beauty odaklı)...\n')
  
  const users = await prisma.user.findMany({ take: 40 })
  const mainCategories = await prisma.mainCategory.findMany()
  
  if (users.length === 0) {
    console.log('⚠️ Kullanıcı bulunamadı, Phase 12 atlanıyor...')
    return
  }
  
  // Elektronik ve Beauty kategorilerini bul
  const electronicsCategory = mainCategories.find(c => c.name === 'Electronics')
  const beautyCategory = mainCategories.find(c => c.name === 'Beauty' || c.name === 'Cosmetics')
  
  // Kategoriye göre ürünleri al
  const electronicsProducts = electronicsCategory 
    ? await prisma.product.findMany({
        where: {
          group: {
            subCategory: {
              mainCategoryId: electronicsCategory.id
            }
          }
        },
        take: 30
      })
    : []
    
  const beautyProducts = beautyCategory
    ? await prisma.product.findMany({
        where: {
          group: {
            subCategory: {
              mainCategoryId: beautyCategory.id
            }
          }
        },
        take: 30
      })
    : []
  
  console.log(`📦 ${electronicsProducts.length} elektronik ürün bulundu`)
  console.log(`💄 ${beautyProducts.length} beauty ürün bulundu`)
  
  const activeEvents: string[] = []
  const upcomingEvents: string[] = []
  
  // Kaliteli, gerçekçi event'ler - Senaryoların ta kendisi
  const eventConfigs = [
    // ACTIVE EVENTS - ELECTRONICS
    {
      title: 'Remote Work Laptop Experience',
      description: 'Which laptop boosts your productivity when working from home? Performance, keyboard comfort, display quality, portability... Share all the details.',
      categoryId: electronicsCategory?.id,
      imageKey: 'event.event-tablet',
      startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: true,
      products: electronicsProducts.filter(p => p.name.toLowerCase().includes('macbook') || p.name.toLowerCase().includes('laptop'))
    },
    {
      title: 'Wireless Headphone Sound Quality Test',
      description: 'Which headphones deliver the best audio experience? Bass performance, noise cancellation, comfort, battery life... Compare your experiences.',
      categoryId: electronicsCategory?.id,
      imageKey: 'event.event-akillisaat',
      startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: true,
      products: electronicsProducts.filter(p => p.name.toLowerCase().includes('airpods') || p.name.toLowerCase().includes('buds') || p.name.toLowerCase().includes('earbuds'))
    },
    {
      title: 'Smartwatch Fitness Tracking Comparison',
      description: 'Which smartwatch gives the most accurate readings during workouts? Heart rate, step counter, GPS accuracy, sleep tracking... Share your real-world experiences.',
      categoryId: electronicsCategory?.id,
      imageKey: 'event.event-akillisaat',
      startDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: true,
      products: electronicsProducts.filter(p => p.name.toLowerCase().includes('watch'))
    },
    {
      title: 'Tablet Use Cases & Scenarios',
      description: 'What do you use your tablet for? Streaming, reading, drawing, note-taking... Which tablet is best for each task? Share your experiences.',
      categoryId: electronicsCategory?.id,
      imageKey: 'event.event-tablet',
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: true,
      products: electronicsProducts.filter(p => p.name.toLowerCase().includes('ipad') || p.name.toLowerCase().includes('tablet'))
    },

    // ACTIVE EVENTS - BEAUTY
    {
      title: 'Daily Skincare Routine Sharing',
      description: 'What products do you use in your morning and evening skincare routine? Order of application, effects, results... Share your routine and get inspired by others.',
      categoryId: beautyCategory?.id,
      imageKey: 'event.event-ciltbakim',
      startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: true,
      products: beautyProducts.filter(p => p.name.toLowerCase().includes('serum') || p.name.toLowerCase().includes('cream') || p.name.toLowerCase().includes('moisturizer'))
    },
    {
      title: 'Best Products for Oily Skin',
      description: 'If you have oily skin, which products actually work? Mattifying formulas, pore minimizers, oil-balancing treatments... Share your findings.',
      categoryId: beautyCategory?.id,
      imageKey: 'event.event-yaglicilt',
      startDate: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 19 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: true,
      products: beautyProducts.slice(0, 10)
    },
    {
      title: 'Long-Lasting Makeup Products Test',
      description: 'Which makeup products truly last all day? Foundation, lipstick, mascara... Share what held up during summer heat and long work days.',
      categoryId: beautyCategory?.id,
      imageKey: 'event.event-kalicimakyaj',
      startDate: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: true,
      products: beautyProducts.filter(p => p.name.toLowerCase().includes('lipstick') || p.name.toLowerCase().includes('foundation') || p.name.toLowerCase().includes('mascara'))
    },

    // UPCOMING EVENTS - ELECTRONICS
    {
      title: 'Gaming Performance: Which Device Wins?',
      description: 'Which phone or tablet delivers the best mobile gaming performance? FPS, thermal throttling, battery drain... Share your gaming experiences.',
      categoryId: electronicsCategory?.id,
      imageKey: 'event.event-oyun',
      startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: false,
      products: electronicsProducts.slice(0, 10)
    },
    {
      title: 'Camera Performance: Night Photography',
      description: 'Which phone takes the best low-light photos? Night mode, HDR, detail preservation... Share real-world photo samples and comparisons.',
      categoryId: electronicsCategory?.id,
      imageKey: 'event.event-kamera',
      startDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 38 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: false,
      products: electronicsProducts.filter(p => p.name.toLowerCase().includes('phone') || p.name.toLowerCase().includes('iphone'))
    },

    // UPCOMING EVENTS - BEAUTY
    {
      title: 'Sun Protection: Best SPF Products',
      description: 'Summer is coming! Which sunscreen truly works? No white cast, non-greasy, waterproof... Share your experiences.',
      categoryId: beautyCategory?.id,
      imageKey: 'event.event-gunestenkorunma',
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: false,
      products: beautyProducts.filter(p => p.name.toLowerCase().includes('sunscreen') || p.name.toLowerCase().includes('spf'))
    },
    {
      title: 'Hair Care Routine: Dry & Damaged Hair',
      description: 'Which products work best for dry hair? Shampoo, conditioner, masks, oils... Share what made a real difference for you.',
      categoryId: beautyCategory?.id,
      imageKey: 'event.event-sacbakim',
      startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: false,
      products: beautyProducts.filter(p => p.name.toLowerCase().includes('hair') || p.name.toLowerCase().includes('shampoo'))
    }
  ]
  
  // Event image'lerini Minio'ya upload et
  console.log("📸 Event görselleri Minio'ya yükleniyor...")
  const s3Service = new S3Service()
  const eventImagesDir = path.join(__dirname, '../tests/assets/events')
  
  let uploadedEventImageCount = 0
  for (const config of eventConfigs) {
    if (!config.imageKey) continue
    
    // imageKey'den dosya adını çıkar (örn: 'event.event-batarya' -> 'event-batarya.png')
    const imageKeyParts = config.imageKey.split('.')
    const imageName = imageKeyParts[imageKeyParts.length - 1] // 'event-batarya'
    const localImagePath = path.join(eventImagesDir, `${imageName}.png`)
    
    if (existsSync(localImagePath)) {
      try {
        const imageBuffer = readFileSync(localImagePath)
        const minioPath = `events/${imageName}.png`
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
  
  for (const config of eventConfigs) {
    const eventId = generateUlid()
    
    // Event görselini al - Doğrudan Minio path'ini kullan
    let imageUrl: string | null = null
    if (config.imageKey) {
      const imageKeyParts = config.imageKey.split('.')
      const imageName = imageKeyParts[imageKeyParts.length - 1] // 'event-batarya'
      imageUrl = `events/${imageName}.png`
    }
    
    const eventDelegate = (prisma as any).event;
    await eventDelegate.create({
      data: {
        id: eventId,
        title: config.title,
        description: config.description,
        startDate: config.startDate,
        endDate: config.endDate,
        status: config.status,
        imageUrl,
        brandId: null,
      }
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
  
  // Active event'lere ContentPost ekle (FREE tipinde - Event Posts)
  console.log('📝 Event postları oluşturuluyor (ContentPost FREE tipinde)...')
  let totalEventPosts = 0
  
  // Gerçekçi post içerikleri - Event türüne göre
  const eventPostTemplates = {
    electronics: [
      {
        titleTemplate: (product: string) => `${product} - My Long-Term Usage Experience`,
        bodyTemplate: (product: string) => `I've been using the ${product} for about 6 months now. At first I thought it offered a lot of features for its price, but as I kept using it I realized what a great choice I made. Performance exceeded my expectations. I haven't had any issues in my daily workflow. Battery life is also quite satisfying. Definitely recommending it to friends.`
      },
      {
        titleTemplate: (product: string) => `${product} - 3 Months Real-World Experience`,
        bodyTemplate: (product: string) => `I've been using the ${product} daily since the day I got it. Quality-wise, it's a really impressive product. I checked the alternatives too, but this one seemed like the best in terms of both price and features. The ease of use really stood out to me. Haven't had any technical issues at all. Highly recommended.`
      },
      {
        titleTemplate: (product: string) => `${product} - Better Than Expected`,
        bodyTemplate: (product: string) => `I'd been researching the ${product} for a while. Compared different brands and finally decided on this one. First impression was very positive. The design is sleek and modern. Very comfortable to use as well. It's only been a few weeks but I'm satisfied so far. Hoping it lasts a long time.`
      },
      {
        titleTemplate: (product: string) => `My Thoughts as a ${product} User`,
        bodyTemplate: (product: string) => `I've been using the ${product} for a while and I'm generally satisfied. Performance-wise it more than covers my daily needs. There are some minor details that could be improved, but nothing major. Price-to-performance ratio is quite good. One of the best products you can get at this price point in my opinion.`
      },
      {
        titleTemplate: (product: string) => `${product} - Detailed Review & My Verdict`,
        bodyTemplate: (product: string) => `I wanted to write a detailed review of the ${product} because I genuinely like this product. It performs well both in daily use and under heavy workloads. Quality-wise it punches well above its price. I haven't observed any durability issues so far either. Really enjoying using it.`
      },
    ],
    beauty: [
      {
        titleTemplate: (product: string) => `${product} Changed My Skincare Routine`,
        bodyTemplate: (product: string) => `Since I started using ${product}, I've genuinely noticed a difference in my skin. Even in the first week I could feel my skin's moisture balance improving. It's now an essential part of my morning and evening routine. I think it's suitable for sensitive skin too since it causes no irritation at all. Definitely recommend trying it.`
      },
      {
        titleTemplate: (product: string) => `My 2-Month Experience with ${product}`,
        bodyTemplate: (product: string) => `I'd read many positive reviews about ${product} and finally gave it a try. I've been using it regularly for 2 months and I can see clear improvements in my skin. Pores have visibly reduced and skin tone has evened out. The scent is lovely too - it's a pleasure to apply in the morning. Price is a bit steep but totally worth the results.`
      },
      {
        titleTemplate: (product: string) => `${product} - Perfect for Oily Skin`,
        bodyTemplate: (product: string) => `As someone with oily skin, ${product} is exactly what I was looking for. It mattifies without drying out the skin. I no longer have shine issues throughout the day. Works beautifully under makeup too. I noticed the change in my skin within a few weeks. Highly recommend for anyone with the same skin type.`
      },
      {
        titleTemplate: (product: string) => `Did ${product} Meet My Expectations?`,
        bodyTemplate: (product: string) => `I did quite a bit of research before buying ${product}. Initially I thought the price was high, but once I started using it I realized I was getting my money's worth. Skin texture genuinely softened and hydration levels increased. I've finished one jar and will definitely repurchase. The natural ingredients are a big plus.`
      },
      {
        titleTemplate: (product: string) => `${product} - My Daily Routine Favorite`,
        bodyTemplate: (product: string) => `${product} is now a must-have in my makeup bag. It's both very practical to use and the effects last all day. I especially love how long-lasting it is. The shade matched my skin tone perfectly. The formula also nourishes the skin - it's not just about the look, it's skincare too. Can wholeheartedly recommend to everyone.`
      },
    ],
  };

  // Event kategorisine göre template seç
  const getTemplatesForEvent = (categoryId: string | undefined, eventTitle: string) => {
    // Elektronik kategorisi kontrolü
    if (categoryId === electronicsCategory?.id) {
      return eventPostTemplates.electronics;
    }
    
    // Beauty kategorisi kontrolü
    if (categoryId === beautyCategory?.id) {
      return eventPostTemplates.beauty;
    }
    
    // Fallback: Guess category from event title keywords
    const titleLower = eventTitle.toLowerCase();
    if (titleLower.includes('laptop') || titleLower.includes('headphone') ||
        titleLower.includes('tablet') || titleLower.includes('wireless') ||
        titleLower.includes('watch') || titleLower.includes('camera') ||
        titleLower.includes('gaming') || titleLower.includes('battery') ||
        titleLower.includes('performance') || titleLower.includes('device')) {
      return eventPostTemplates.electronics;
    }

    if (titleLower.includes('skin') || titleLower.includes('makeup') ||
        titleLower.includes('serum') || titleLower.includes('sun') ||
        titleLower.includes('hair') || titleLower.includes('oily') ||
        titleLower.includes('care') || titleLower.includes('routine')) {
      return eventPostTemplates.beauty;
    }
    
    // Son fallback: Random
    return Math.random() > 0.5 ? eventPostTemplates.electronics : eventPostTemplates.beauty;
  };
  
  for (let i = 0; i < activeEvents.length; i++) {
    const eventId = activeEvents[i]
    const config = eventConfigs.filter(c => c.isActive)[i]
    const eventProducts = config.products || []
    
    if (eventProducts.length === 0) {
      console.log(`  ⚠️ Event "${config.title}" için ürün yok, post oluşturulmadı`)
      continue
    }
    
    // Her event için 5-8 post
    const postCount = Math.floor(Math.random() * 4) + 5 // 5-8 arası
    const contributors = users.sort(() => Math.random() - 0.5).slice(0, postCount)
    
    // Event kategorisine göre template'leri seç
    const templates = getTemplatesForEvent(config.categoryId, config.title);
    const shuffledTemplates = [...templates].sort(() => Math.random() - 0.5);
    
    for (let j = 0; j < contributors.length; j++) {
      const user = contributors[j];
      
      // Her post için rastgele farklı bir ürün seç
      const selectedProduct = eventProducts[Math.floor(Math.random() * eventProducts.length)]
      
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
      
      // EventStats güncelle
      await (prisma as unknown as { eventStats: { upsert: (arg: { where: { userId_eventId: { userId: string; eventId: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown> } }).eventStats.upsert({
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
          totalComments: Math.floor(Math.random() * 3) + 1,
          helpfulVotesReceived: Math.floor(Math.random() * 5) + 1,
        },
        update: {
          totalParticipated: { increment: 1 },
        }
      })
    }
  }
  
  console.log(`  ✅ ${totalEventPosts} ContentPost oluşturuldu (FREE tipinde, Event'lere bağlı)`)
  
  // Event post'larına comment ekle (max 3 comment per post)
  console.log("💬 Event post'larına comment ekleniyor...")
  
  // Comment template'leri (gerçekçi yorumlar)
  const commentTemplates = {
    electronics: [
      'I use the same product and I\'m very happy with it. You can really tell the difference in performance right away.',
      'Very detailed review, thanks! I was thinking about buying this and your post helped me decide.',
      'Is the price-to-performance ratio really that good? I\'ve been looking at alternatives but can\'t decide.',
      'Agree on the battery life. Same experience here - it\'s more than enough for daily use.',
      'Which color did you get? Would love to hear more about the color options.',
      'How long is the warranty? Do you know anything about their service quality?',
      'What other models would you recommend at this price point? Would love to see a comparison.',
      'Great write-up! I just placed my order - hope I won\'t regret it!',
      'Have you had any issues with long-term use? First impressions are always positive.',
      'What do you think about the camera quality? Photography is important to me.',
    ],
    beauty: [
      'I use this product too and the change in my skin has been amazing. Highly recommend.',
      'Is it suitable for sensitive skin? Did it cause any irritation for you?',
      'How\'s the scent? Some products can be way too strong.',
      'Do you use it morning or evening? Does the order of application matter?',
      'Is it really worth the price? Seems like there are cheaper alternatives.',
      'How long until you started seeing results? I want to try it but I\'m curious.',
      'What age group is it best for? Would it make sense to use in your 30s?',
      'Such a great post, thanks for the detailed review. Getting it right away!',
      'Does it work for oily skin too? Does it mess with the oil balance?',
      'Is it practical for daily use? Can it be easily added to a routine?',
    ],
    general: [
      'Very helpful post, thanks!',
      'I think the same way, totally agree.',
      'Could you share more details? I\'m curious.',
      'Great post!',
      'This was very useful info, thank you.',
    ],
  }
  
  // Tüm event post'larını al
  const allEventPosts = await prisma.contentPost.findMany({
    where: { eventId: { not: null } },
    select: { 
      id: true, 
      eventId: true,
      createdAt: true,
    },
  })
  
  let totalComments = 0
  const postCommentCounts: Record<string, number> = {}
  
  for (const post of allEventPosts) {
    // Her post için 0-3 arası random comment
    const commentCount = Math.floor(Math.random() * 4) // 0, 1, 2, veya 3
    
    if (commentCount === 0) {
      postCommentCounts[post.id] = 0
      continue
    }
    
    // Event'in kategorisine göre template seç
    const event = await (prisma as unknown as { event: { findUnique: (args: { where: { id: string }; select?: { title: boolean } }) => Promise<{ title: string } | null> } }).event.findUnique({
      where: { id: post.eventId! },
      select: { title: true },
    })
    
    let templates = commentTemplates.general
    if (event) {
      const titleLower = event.title.toLowerCase()
      if (titleLower.includes('laptop') || titleLower.includes('headphone') ||
          titleLower.includes('tablet') || titleLower.includes('wireless') ||
          titleLower.includes('watch') || titleLower.includes('camera') ||
          titleLower.includes('gaming') || titleLower.includes('battery')) {
        templates = commentTemplates.electronics
      } else if (titleLower.includes('skin') || titleLower.includes('makeup') ||
                 titleLower.includes('serum') || titleLower.includes('hair') ||
                 titleLower.includes('care')) {
        templates = commentTemplates.beauty
      }
    }
    
    // Random kullanıcılardan comment ekle
    const commenters = users.sort(() => Math.random() - 0.5).slice(0, commentCount)
    
    for (const commenter of commenters) {
      const randomTemplate = templates[Math.floor(Math.random() * templates.length)]
      const commentId = generateUlid()
      
      // Comment'i post'tan sonra oluşturulmuş gibi göster
      const commentCreatedAt = new Date(post.createdAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000)
      
      await prisma.contentComment.create({
        data: {
          id: commentId,
          postId: post.id,
          userId: commenter.id,
          comment: randomTemplate,
          isAnswer: false,
          createdAt: commentCreatedAt,
          likesCount: Math.floor(Math.random() * 5), // 0-4 like
        },
      })
      
      totalComments++
    }
    
    postCommentCounts[post.id] = commentCount
  }
  
  // ContentPost'ların commentsCount'larını güncelle
  console.log("📊 Post comment count'ları güncelleniyor...")
  for (const [postId, count] of Object.entries(postCommentCounts)) {
    await prisma.contentPost.update({
      where: { id: postId },
      data: { commentsCount: count },
    })
  }
  
  console.log(`  ✅ ${totalComments} comment eklendi (max 3 per post)`)
  console.log(`  ✅ ${allEventPosts.length} post'un comment count'u güncellendi`)
  
  
  // Özet
  console.log('\n' + '═'.repeat(80))
  console.log('✨ PHASE 12 TAMAMLANDI - EVENTS (Elektronik & Beauty)\n')
  console.log(`   🎉 Toplam Events: ${activeCount + upcomingCount}`)
  console.log(`      📅 Active: ${activeCount}`)
  console.log(`      🔜 Upcoming: ${upcomingCount}`)
  console.log(`   📝 ContentPosts (FREE): ${totalEventPosts} (Event'lere bağlı, 5-8 post/event)`)
  console.log(`   💬 Comments: ${totalComments} (max 3 per post, gerçekçi içerikler)`)
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
  
  const users = await prisma.user.findMany({ take: 40 })
  
  if (users.length < 2) {
    console.log('⚠️ Yeterli kullanıcı yok, Phase 14 atlanıyor...')
    return
  }
  
  const threads: string[] = []
  let totalMessages = 0
  let totalRequests = 0
  
  // 1. DM THREADS (30-50 thread)
  console.log('💬 DM Threads oluşturuluyor...')
  const threadCount = Math.floor(Math.random() * 21) + 30 // 30-50
  
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
  }
  console.log(`  ✅ ${threadCount} DM thread oluşturuldu`)
  
  // 2. DM MESSAGES (Her thread için 3-15 mesaj)
  console.log('📨 DM Messages oluşturuluyor...')
  
  const conversationStarters = [
    'Hey! I have a question about this product.',
    'Hi, I saw your profile - you share really great content!',
    'Hey! Do you use this product? How do you like it?',
    'Hi, I could use some help with something.',
    'Hey! Saw your latest post, super helpful - thanks!',
  ]

  const responses = [
    'Thanks! What did you want to ask?',
    'Hi! Of course, how can I help?',
    'Yes I use it, really happy with it. Want me to go into detail?',
    'Hey! No problem, feel free to message anytime.',
    'Hi! Thank you, glad I could help!',
  ]

  const followUps = [
    'Got it, that was really helpful. Thanks!',
    'Great info, you were super helpful.',
    'Okay, I\'ll think about it. Can I reach out again?',
    'Awesome! I\'ll message you if I have more questions.',
    'Thanks so much, that info was really useful.',
  ]
  
  for (const threadId of threads) {
    const thread = await prisma.dMThread.findUnique({
      where: { id: threadId },
      include: { userOne: true, userTwo: true }
    })
    
    if (!thread) continue
    
    const messageCount = Math.floor(Math.random() * 13) + 3 // 3-15 mesaj
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
        messageText = `Yeah I think so too. I have quite a bit of experience with this. Want me to share the details?`
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
  
  // 3. SUPPORT THREADS & REQUESTS (10-20 support request)
  console.log('🎫 Support requests oluşturuluyor...')
  const requestCount = Math.floor(Math.random() * 11) + 10 // 10-20
  
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
      
      // Support thread için birkaç mesaj ekle
      const supportMessages = [
        'Hi, I need some help.',
        'Of course, how can I assist you?',
        'Could I get some support on this?',
        'Sure, I\'ll help you right away.',
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
        description: `Request for ${supportType.toLowerCase()} support`,
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
  
  const users = await prisma.user.findMany({ take: 40 })
  
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
  
  const nftTypes: Array<'BADGE' | 'COSMETIC' | 'LOOTBOX'> = ['BADGE', 'COSMETIC', 'LOOTBOX']
  const nftRarities: Array<'COMMON' | 'RARE' | 'EPIC'> = ['COMMON', 'RARE', 'EPIC']
  
  const nftNames = {
    BADGE: ['Pioneer Badge', 'Expert Badge', 'Contributor Badge', 'Elite Badge', 'Champion Badge'],
    COSMETIC: ['Golden Frame', 'Diamond Border', 'Neon Glow', 'Crystal Shine', 'Rainbow Aura'],
    LOOTBOX: ['Mystery Box', 'Treasure Chest', 'Lucky Pack', 'Premium Box', 'Legendary Crate']
  }
  
  for (const user of users) {
    const nftCount = Math.floor(Math.random() * 2) + 1 // 1-2 NFT (TestFlight: reduced)
    
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
  
  const users = await prisma.user.findMany({ take: 40 })
  
  if (users.length === 0) {
    console.log('⚠️ Kullanıcı bulunamadı, atlanıyor...')
    return
  }
  
  let totalBadges = 0
  let totalUserBadges = 0
  
  // 1. BADGE CATEGORIES
  console.log('📁 Badge categories oluşturuluyor...')
  
  const categories = [
    { name: 'Achievement Badges', description: 'Badges earned through accomplishments and milestones' },
    { name: 'Event Badges', description: 'Badges earned by participating in events' },
    { name: 'Community Badges', description: 'Badges for community engagement and contribution' },
    { name: 'Special Badges', description: 'Limited edition and exclusive badges' },
  ]
  
  const createdCategories: string[] = []
  
  for (const cat of categories) {
    const category = await prisma.badgeCategory.create({
      data: {
        name: cat.name,
        description: cat.description,
      }
    })
    createdCategories.push(category.id)
  }
  
  console.log(`  ✅ ${categories.length} badge category oluşturuldu`)
  
  // 2. BADGES
  console.log('🏅 Badges oluşturuluyor...')
  
  // Badge isimleri ve yapılandırmaları
  // Özel isimli badge'ler (görsel dosyasından çıkarılan isimler)
  const badgeConfigs: Array<{ name: string; type: 'COLLECTION' | 'EVENT' | 'COSMETIC' | 'BRAND'; rarity: 'COMMON' | 'RARE' | 'EPIC' }> = [
    // Özel badge'ler
    { name: 'Early Adapter', type: 'COLLECTION', rarity: 'EPIC' },
    { name: 'Hardware Expert', type: 'COLLECTION', rarity: 'EPIC' },
    { name: 'Premium Shopper', type: 'COLLECTION', rarity: 'RARE' },
    { name: 'Wish Marker', type: 'COLLECTION', rarity: 'RARE' },
    // Numaralı badge'ler (1-10)
    { name: 'Tech Enthusiast', type: 'COLLECTION', rarity: 'COMMON' },
    { name: 'Beauty Guru', type: 'COSMETIC', rarity: 'COMMON' },
    { name: 'Gadget Master', type: 'COLLECTION', rarity: 'RARE' },
    { name: 'Style Curator', type: 'COSMETIC', rarity: 'COMMON' },
    { name: 'Smart Buyer', type: 'COLLECTION', rarity: 'COMMON' },
    { name: 'Product Expert', type: 'COLLECTION', rarity: 'RARE' },
    { name: 'Review Pro', type: 'COLLECTION', rarity: 'RARE' },
    { name: 'Content Creator', type: 'COLLECTION', rarity: 'COMMON' },
    { name: 'Community Star', type: 'COLLECTION', rarity: 'RARE' },
    { name: 'Trend Spotter', type: 'COSMETIC', rarity: 'COMMON' },
    // İsimli badge'ler (11-22) - görsel dosyalarından alınan isimler
    { name: 'Crimson Roast', type: 'COLLECTION', rarity: 'EPIC' },
    { name: 'Golden Pick', type: 'COLLECTION', rarity: 'EPIC' },
    { name: 'Trendsetter', type: 'COSMETIC', rarity: 'RARE' },
    { name: 'Web3 Architect', type: 'COLLECTION', rarity: 'EPIC' },
    { name: 'Deal Maven', type: 'COLLECTION', rarity: 'RARE' },
    { name: 'Ladder Vanguard', type: 'COLLECTION', rarity: 'EPIC' },
    { name: 'Top Picks', type: 'COLLECTION', rarity: 'RARE' },
    { name: 'Product Roast', type: 'COLLECTION', rarity: 'EPIC' },
    { name: 'Ladder Ranker', type: 'COLLECTION', rarity: 'RARE' },
    { name: 'Genesis Member', type: 'COLLECTION', rarity: 'EPIC' },
    { name: 'Outdoor Explorer', type: 'COSMETIC', rarity: 'RARE' },
    { name: 'Critical Review', type: 'COLLECTION', rarity: 'EPIC' },
    // Brand badge'ler (brandbadges/ klasöründen) - BRAND tipi
    { name: 'Brand Badge 1', type: 'BRAND', rarity: 'RARE' },
    { name: 'Brand Badge 2', type: 'BRAND', rarity: 'RARE' },
    { name: 'Brand Badge 3', type: 'BRAND', rarity: 'EPIC' },
    { name: 'Brand Badge 4', type: 'BRAND', rarity: 'RARE' },
    { name: 'Brand Badge 5', type: 'BRAND', rarity: 'EPIC' },
    { name: 'Brand Badge 6', type: 'BRAND', rarity: 'EPIC' },
  ]
  
  const createdBadges: string[] = []
  
  for (const config of badgeConfigs) {
    const randomCategory = createdCategories[Math.floor(Math.random() * createdCategories.length)]
    
    // Görsel mapping'den al
    const imageKey = getBadgeImageKey(config.name);
    const imageUrl = imageKey ? getSeedMediaPath(imageKey, true) : null;
    
    // Mevcut badge kontrolü
    const existingBadge = await prisma.badge.findFirst({
      where: { name: config.name }
    });
    
    if (existingBadge) {
      // Güncelle
      await prisma.badge.update({
        where: { id: existingBadge.id },
        data: {
          type: config.type,
          rarity: config.rarity,
          imageUrl: imageUrl || existingBadge.imageUrl,
          boostMultiplier: config.rarity === 'EPIC' ? 2.0 : (config.rarity === 'RARE' ? 1.5 : 1.0),
          rewardMultiplier: config.rarity === 'EPIC' ? 3.0 : (config.rarity === 'RARE' ? 2.0 : 1.0),
        }
      });
      createdBadges.push(existingBadge.id);
    } else {
      // Yeni oluştur
      const badge = await prisma.badge.create({
        data: {
          name: config.name,
          description: `${config.name} - ${config.rarity} ${config.type.toLowerCase()} badge`,
          imageUrl,
          type: config.type,
          rarity: config.rarity,
          boostMultiplier: config.rarity === 'EPIC' ? 2.0 : (config.rarity === 'RARE' ? 1.5 : 1.0),
          rewardMultiplier: config.rarity === 'EPIC' ? 3.0 : (config.rarity === 'RARE' ? 2.0 : 1.0),
          categoryId: randomCategory,
        }
      });
      createdBadges.push(badge.id);
    }
    totalBadges++;
  }
  
  console.log(`  ✅ ${totalBadges} badge oluşturuldu`)
  
  // 3. USER BADGES (Her kullanıcı 2-5 badge)
  console.log('🎖️ UserBadges oluşturuluyor...')
  
  const visibilities: Array<'PUBLIC' | 'FRIENDS' | 'TRUSTERS' | 'PRIVATE'> = ['PUBLIC', 'FRIENDS', 'TRUSTERS', 'PRIVATE']
  
  for (const user of users) {
    const badgeCount = Math.floor(Math.random() * 4) + 2 // 2-5 badge
    const userBadges = createdBadges
      .sort(() => Math.random() - 0.5)
      .slice(0, badgeCount)
    
    for (let i = 0; i < userBadges.length; i++) {
      const badgeId = userBadges[i]
      const visibility = visibilities[Math.floor(Math.random() * visibilities.length)]
      
      await prisma.userBadge.upsert({
        where: { userId_badgeId: { userId: user.id, badgeId } },
        update: {
          isVisible: Math.random() > 0.2,
          displayOrder: i + 1,
          visibility,
          claimed: Math.random() > 0.3,
          claimedAt: Math.random() > 0.3 ? new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000) : null,
        },
        create: {
          userId: user.id,
          badgeId,
          isVisible: Math.random() > 0.2,
          displayOrder: i + 1,
          visibility,
          claimed: Math.random() > 0.3,
          claimedAt: Math.random() > 0.3 ? new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000) : null,
        },
      })
      totalUserBadges++
    }
  }
  
  console.log(`  ✅ ${totalUserBadges} user badge oluşturuldu`)
  
  // Özet
  console.log('\n' + '═'.repeat(80))
  console.log('✨ KALAN SİSTEMLER TAMAMLANDI\n')
  console.log(`   📁 Badge Categories: ${categories.length}`)
  console.log(`   🏅 Badges: ${totalBadges}`)
  console.log(`   🎖️ User Badges: ${totalUserBadges}`)
  console.log(`      👤 Kullanıcı başına ortalama: ${(totalUserBadges / users.length).toFixed(1)} badge`)
  console.log('═'.repeat(80) + '\n')
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
  // Not: Apple_Products klasörü kaldırıldı, mevcut post-images görselleri kullanılıyor
  product: {
    // Apple ürünleri - phone görselleri ile eşleştiriliyor
    'iPhone 17': 'product.phone1',
    'iPhone 17 Pro': 'product.phone2',
    'iPhone 16e': 'product.phone3',
    'iPhone Air': 'product.phone4',
    'iPhone 15 Pro': 'product.phone5',
    'AirPods 4': 'product.headphone',
    'AirPods 4 ANC': 'product.headphone',
    'AirPods Max': 'product.headphone2',
    'AirPods Pro 3': 'product.headphone',
    'Watch SE 3': 'product.smartwatch',
    'Watch Series 11': 'product.smartwatch',
    'Watch Ultra 3': 'product.smartwatch',
    // Brand + Product kombinasyonları
    'Apple iPhone 17': 'product.phone1',
    'Apple iPhone 17 Pro': 'product.phone2',
    'Apple iPhone 16e': 'product.phone3',
    'Apple iPhone Air': 'product.phone4',
    'Apple AirPods 4': 'product.headphone',
    'Apple AirPods 4 ANC': 'product.headphone',
    'Apple AirPods Max': 'product.headphone2',
    'Apple AirPods Pro 3': 'product.headphone',
    'Apple Watch SE 3': 'product.smartwatch',
    'Apple Watch Series 11': 'product.smartwatch',
    'Apple Watch Ultra 3': 'product.smartwatch',
    // Diğer ürün görselleri (feed akışında kullanılacak)
    'Smartwatch': 'product.smartwatch',
    'Smart Watch': 'product.smartwatch',
    'Watch': 'product.smartwatch',
    'Dyson V15s': 'product.dyson',
    'Dyson V12': 'product.dyson',
    'Dyson': 'product.dyson',
    'MacBook': 'product.macbook',
    'MacBook Pro': 'product.macbook',
    'MacBook Air': 'product.macbook',
    'Laptop': 'product.macbook',
    'Headphone': 'product.headphone',
    'Headphones': 'product.headphone',
    'Earbuds': 'product.headphone2',
    'Wireless Earbuds': 'product.headphone2',
    'Samsung Phone': 'product.samsun',
    'Samsung': 'product.samsun',
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
  // User avatar görselleri (tests/assets/userprofile klasöründen)
  // Not: Mevcut avatarlar man1-5 ve woman1-5 olarak rotasyonlu kullanılıyor
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
    'baris': 'user.avatar.man1',
    'merve': 'user.avatar.woman1',
    'berkay': 'user.avatar.man2',
    'asli': 'user.avatar.woman2',
    'murat': 'user.avatar.man3',
    'gizem': 'user.avatar.woman3',
    'onur': 'user.avatar.man4',
    'burcu': 'user.avatar.woman4',
    'tolga': 'user.avatar.man5',
    'ebru': 'user.avatar.woman5',
    'serkan': 'user.avatar.man1',
    'ece': 'user.avatar.woman1',
    'kaan': 'user.avatar.man2',
    'derya': 'user.avatar.woman2',
    'selim': 'user.avatar.man3',
    'pelin': 'user.avatar.woman3',
    'cem': 'user.avatar.man4',
    'duygu': 'user.avatar.woman4',
    'hakan': 'user.avatar.man5',
    'nil': 'user.avatar.woman5',
    'utku': 'user.avatar.man1',
    'ceren': 'user.avatar.woman1',
    'yigit': 'user.avatar.man2',
    'sude': 'user.avatar.woman2',
    'alper': 'user.avatar.man3',
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
  
  // 4. Apple brand'ı için mevcut görseller arasından seç
  if (brand === 'Apple' || brand?.toLowerCase() === 'apple') {
    const appleImageKeys: SeedMediaKey[] = [
      'product.phone1',
      'product.phone2',
      'product.phone3',
      'product.phone4',
      'product.phone5',
      'product.phone6',
      'product.headphone',
      'product.headphone2',
      'product.smartwatch',
      'product.macbook',
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
 * MainCategory için görsel key'ini bul
 */
function getMainCategoryImageKey(categoryName: string): SeedMediaKey | undefined {
  return MEDIA_IMAGE_MAPPING.mainCategory?.[categoryName];
}

/**
 * SubCategory için görsel key'ini bul
 */
function getSubCategoryImageKey(categoryName: string): SeedMediaKey | undefined {
  return MEDIA_IMAGE_MAPPING.subCategory?.[categoryName];
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
 * Badge için görsel key'ini bul (deprecated - badges no longer seeded)
 */
function getBadgeImageKey(badgeName: string): SeedMediaKey | undefined {
  return undefined; // Badge images removed from seed
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
 * 40 seed kullanıcısını oluşturur
 * Her kullanıcı için User, Profile, UserAvatar, UserTitle, UserSettings oluşturulur
 */
async function createSeedUsers(defaultThemeId: string): Promise<Map<string, { id: string; email: string; name: string }>> {
  console.log('\n👥 40 Seed kullanıcısı oluşturuluyor...')
  
  const createdUsers = new Map<string, { id: string; email: string; name: string }>()
  const bannerUrl = getSeedMediaPath('user.banner.primary', true)
  
  for (const userConfig of SEED_USERS) {
    // 1. User oluştur veya bul
    let user = await prisma.user.findUnique({
      where: { id: userConfig.id }
    })
    
    if (!user) {
      // Email ile de kontrol et
      user = await prisma.user.findUnique({
        where: { email: userConfig.email }
      })
      
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: userConfig.id,
            email: userConfig.email,
            passwordHash: passwordHash,
            emailVerified: true,
            status: 'ACTIVE',
          }
        })
      }
    }
    
    // 2. Profile oluştur/güncelle
    await prisma.profile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        displayName: userConfig.name,
        userName: userConfig.userName,
        bio: userConfig.bio,
        bannerUrl: bannerUrl,
        country: userConfig.country,
        postsCount: 0,
        trustCount: 0,
        trusterCount: 0,
      },
      update: {
        displayName: userConfig.name,
        userName: userConfig.userName,
        bio: userConfig.bio,
        bannerUrl: bannerUrl,
        country: userConfig.country,
      }
    })
    
    // 3. UserAvatar oluştur/güncelle
    let avatarUrl = getSeedMediaPath(userConfig.avatarKey, true)
    
    // Eğer avatar bulunamazsa default avatar kullan
    if (!avatarUrl) {
      console.log(`   ⚠️  Avatar bulunamadı (${userConfig.avatarKey}), default avatar kullanılıyor`)
      avatarUrl = getSeedMediaPath('user.avatar.default', true)
    }
    
    if (avatarUrl) {
      const existingAvatar = await prisma.userAvatar.findFirst({
        where: { userId: user.id, isActive: true }
      })
      
      if (existingAvatar) {
        await prisma.userAvatar.update({
          where: { id: existingAvatar.id },
          data: {
            imageUrl: avatarUrl,
            isActive: true,
          }
        })
      } else {
        // Eski avatarları deaktif et
        await prisma.userAvatar.updateMany({
          where: { userId: user.id },
          data: { isActive: false }
        })
        
        await prisma.userAvatar.create({
          data: {
            userId: user.id,
            imageUrl: avatarUrl,
            isActive: true,
          }
        })
      }
    } else {
      console.log(`   ⚠️  Default avatar bile bulunamadı! ${user.email} için avatar atlanıyor`)
    }
    
    // 4. UserTitle oluştur (sadece yoksa)
    const existingTitle = await prisma.userTitle.findFirst({
      where: { userId: user.id }
    })
    
    if (!existingTitle) {
      await prisma.userTitle.create({
        data: {
          userId: user.id,
          title: userConfig.title,
        }
      })
    }
    
    // 5. UserSettings oluştur/güncelle
    await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        themeId: defaultThemeId,
        receiveNotifications: true,
        visibility: 'PUBLIC',
        trustNotifications: true,
        supportNotifications: true,
        messageNotifications: true,
        collectionNotifications: true,
        postNotifications: true,
      },
      update: {
        themeId: defaultThemeId,
      }
    })
    
    // 6. Wallet oluştur (her kullanıcı için bir wallet)
    const existingWallet = await prisma.wallet.findFirst({
      where: { userId: user.id }
    })
    
    if (!existingWallet) {
      // Public address oluştur (seed için basit UUID kullanabiliriz)
      const publicAddress = `0x${user.id.replace(/-/g, '').substring(0, 40)}`
      
      await prisma.wallet.create({
        data: {
          userId: user.id,
          publicAddress: publicAddress,
          provider: 'CUSTOM', // Enum: METAMASK, WALLETCONNECT, CUSTOM
          isConnected: true,
          balance: 1000.0, // Başlangıç bakiyesi (seed için)
          lockedBalance: 0,
        }
      })
    }
    
    // NOT: Inventory eklemesi Products oluşturulduktan SONRA yapılacak
    // Şu anda henüz ürün yok, bu yüzden bu adımı atlıyoruz
    
    // Map'e ekle
    createdUsers.set(user.id, {
      id: user.id,
      email: userConfig.email,
      name: userConfig.name,
    })
  }
  
  console.log(`✅ ${createdUsers.size} kullanıcı oluşturuldu/güncellendi`)
  console.log(`ℹ️  Inventory ekleme Products'tan sonra yapılacak`)
  
  // Metadata'ya ekle
  for (const userId of createdUsers.keys()) {
    addSeedUserId(userId)
  }
  
  return createdUsers
}

/**
 * Feed akışında kullanılacak product görselleri pool'u
 * Post media için rastgele görsel seçiminde kullanılır
 * tests/assets/post/post-images/ klasöründeki görseller kullanılır
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
async function updateAllEntityImages(): Promise<void> {
  console.log('🖼️  Tüm entity görselleri güncelleniyor (mapping\'de belirtilenler)...\n');
  
  let totalUpdated = 0;
  
  // Products
  if (MEDIA_IMAGE_MAPPING.product) {
    console.log('📦 Product görselleri güncelleniyor...');
    const products = await prisma.product.findMany();
    let updated = 0;
    
    for (const product of products) {
      const imageKey = getProductImageKey(product.name, product.brandId || undefined);
      if (imageKey) {
        try {
          const imagePath = getSeedMediaPath(imageKey, true);
          if (imagePath && product.imageUrl !== imagePath) {
            await prisma.product.update({
              where: { id: product.id },
              data: { imageUrl: imagePath },
            });
            updated++;
          }
        } catch (error: any) {
          console.warn(`  ⚠️  ${product.name}: ${error.message}`);
        }
      }
    }
    console.log(`  ✅ ${updated} product görseli güncellendi\n`);
    totalUpdated += updated;
  }
  
  // MainCategories
  if (MEDIA_IMAGE_MAPPING.mainCategory) {
    console.log('📁 MainCategory görselleri güncelleniyor...');
    const categories = await prisma.mainCategory.findMany();
    let updated = 0;
    
    for (const category of categories) {
      const imageKey = getMainCategoryImageKey(category.name);
      if (imageKey) {
        try {
          const imagePath = getSeedMediaPath(imageKey, true);
          if (imagePath && category.imageUrl !== imagePath) {
            await prisma.mainCategory.update({
              where: { id: category.id },
              data: { imageUrl: imagePath },
            });
            updated++;
          }
        } catch (error: any) {
          console.warn(`  ⚠️  ${category.name}: ${error.message}`);
        }
      }
    }
    console.log(`  ✅ ${updated} mainCategory görseli güncellendi\n`);
    totalUpdated += updated;
  }
  
  // SubCategories
  if (MEDIA_IMAGE_MAPPING.subCategory) {
    console.log('📁 SubCategory görselleri güncelleniyor...');
    const categories = await prisma.subCategory.findMany();
    let updated = 0;
    
    for (const category of categories) {
      const imageKey = getSubCategoryImageKey(category.name);
      if (imageKey) {
        try {
          const imagePath = getSeedMediaPath(imageKey, true);
          if (imagePath && category.imageUrl !== imagePath) {
            await prisma.subCategory.update({
              where: { id: category.id },
              data: { imageUrl: imagePath },
            });
            updated++;
          }
        } catch (error: any) {
          console.warn(`  ⚠️  ${category.name}: ${error.message}`);
        }
      }
    }
    console.log(`  ✅ ${updated} subCategory görseli güncellendi\n`);
    totalUpdated += updated;
  }
  
  // BrandCategories
  if (MEDIA_IMAGE_MAPPING.brandCategory) {
    console.log('🏷️  BrandCategory görselleri güncelleniyor...');
    const categories = await prisma.brandCategory.findMany();
    let updated = 0;
    
    for (const category of categories) {
      const imageKey = getBrandCategoryImageKey(category.name);
      if (imageKey) {
        try {
          const imagePath = getSeedMediaPath(imageKey, true);
          if (imagePath && category.imageUrl !== imagePath) {
            await prisma.brandCategory.update({
              where: { id: category.id },
              data: { imageUrl: imagePath },
            });
            updated++;
          }
        } catch (error: any) {
          console.warn(`  ⚠️  ${category.name}: ${error.message}`);
        }
      }
    }
    console.log(`  ✅ ${updated} brandCategory görseli güncellendi\n`);
    totalUpdated += updated;
  }
  
  // Brands
  if (MEDIA_IMAGE_MAPPING.brand) {
    console.log('🏢 Brand görselleri güncelleniyor...');
    const brands = await prisma.brand.findMany();
    let updated = 0;
    
    for (const brand of brands) {
      const imageKey = getBrandImageKey(brand.name);
      if (imageKey) {
        try {
          const imagePath = getSeedMediaPath(imageKey, true);
          if (imagePath && brand.imageUrl !== imagePath) {
            await prisma.brand.update({
              where: { id: brand.id },
              data: { imageUrl: imagePath },
            });
            updated++;
          }
        } catch (error: any) {
          console.warn(`  ⚠️  ${brand.name}: ${error.message}`);
        }
      }
    }
    console.log(`  ✅ ${updated} brand görseli güncellendi\n`);
    totalUpdated += updated;
  }
  
  // Badges
  if (MEDIA_IMAGE_MAPPING.badge) {
    console.log('🏆 Badge görselleri güncelleniyor...');
    const badges = await prisma.badge.findMany();
    let updated = 0;
    
    for (const badge of badges) {
      const imageKey = getBadgeImageKey(badge.name);
      if (imageKey) {
        try {
          const imagePath = getSeedMediaPath(imageKey, true) || null;
          // Eğer mevcut imageUrl cdn.tipbox.co içeriyorsa veya farklıysa güncelle
          const needsUpdate = imagePath && (
            !badge.imageUrl || 
            badge.imageUrl.includes('cdn.tipbox.co') || 
            badge.imageUrl !== imagePath
          );
          if (needsUpdate) {
            await prisma.badge.update({
              where: { id: badge.id },
              data: { imageUrl: imagePath },
            });
            updated++;
          }
        } catch (error: any) {
          console.warn(`  ⚠️  ${badge.name}: ${error.message}`);
        }
      } else {
        // imageKey bulunamazsa, eğer cdn.tipbox.co içeriyorsa default badge görseli kullan
        if (badge.imageUrl && badge.imageUrl.includes('cdn.tipbox.co')) {
          try {
            const defaultImagePath = getSeedMediaPath('badge.hardwareexpert', true) || null;
            if (defaultImagePath) {
              await prisma.badge.update({
                where: { id: badge.id },
                data: { imageUrl: defaultImagePath },
              });
              updated++;
            }
          } catch (error: any) {
            console.warn(`  ⚠️  ${badge.name} (default): ${error.message}`);
          }
        }
      }
    }
    console.log(`  ✅ ${updated} badge görseli güncellendi\n`);
    totalUpdated += updated;
  }
  
  if (totalUpdated > 0) {
    console.log(`✅ Toplam ${totalUpdated} entity görseli güncellendi`);
  } else {
    console.log('ℹ️  Güncellenecek görsel bulunamadı (mapping boş veya tüm görseller güncel)');
  }
}

/**
 * Product görsellerini güncelle (eski fonksiyon, geriye uyumluluk için)
 * @deprecated updateAllEntityImages() kullanın
 */
async function updateProductImages(): Promise<void> {
  await updateAllEntityImages();
}

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
        logoUrl = `https://img.logo.dev/name/${website}?token=${process.env.LOGO_DEV_API_TOKEN}`
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

async function ensureBrandCategory(config: { name: string; description?: string; imageKey?: SeedMediaKey }): Promise<{ id: string; name: string }> {
  // Medusa Category (pcat_...) name ile eşle - BrandCategory.categoryId doğru pcat_ ile dolsun
  const medusaCategory = await prisma.category.findFirst({
    where: { name: config.name },
    select: { id: true },
  }).catch(() => null);
  const categoryId = medusaCategory?.id ?? null;

  let finalImageKey = config.imageKey;
  if (!finalImageKey) {
    finalImageKey = getBrandCategoryImageKey(config.name);
  }

  const existing = await prisma.brandCategory.findUnique({
    where: { name: config.name }
  }).catch(() => null);

  if (existing) {
    let imageUrl: string | null = null;
    if (finalImageKey) {
      imageUrl = getSeedMediaPath(finalImageKey, true);
    }
    if (!imageUrl) {
      const mappingKey = getBrandCategoryImageKey(config.name);
      if (mappingKey) {
        imageUrl = getSeedMediaPath(mappingKey, true);
      }
    }

    const updateData: Record<string, unknown> = {};
    if (imageUrl) updateData.imageUrl = imageUrl;
    if (categoryId) updateData.categoryId = categoryId;

    if (Object.keys(updateData).length > 0) {
      return prisma.brandCategory.update({
        where: { id: existing.id },
        data: updateData
      });
    }
    return existing;
  }

  let imageUrl: string | null = null;
  if (finalImageKey) {
    imageUrl = getSeedMediaPath(finalImageKey, true);
  }
  if (!imageUrl) {
    const mappingKey = getBrandCategoryImageKey(config.name);
    if (mappingKey) {
      imageUrl = getSeedMediaPath(mappingKey, true);
    }
  }

  return prisma.brandCategory.create({
    data: {
      name: config.name,
      imageUrl,
      ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
    }
  });
}

// Brand için idempotent create/update
async function ensureBrand(config: { 
  name: string; 
  categoryId?: string; 
  description?: string; 
  logoUrl?: string; 
  imageUrl?: string; 
  logoKey?: SeedMediaKey; 
  bannerKey?: SeedMediaKey; 
  imageKey?: SeedMediaKey;
  category?: string;
}) {
  // Logo URL'yi oluştur
  let finalLogoUrl: string | undefined = config.logoUrl;
  if (config.logoKey) {
    finalLogoUrl = getSeedMediaPath(config.logoKey, true) || undefined;
  }
  
  // Banner/Image URL'yi oluştur (öncelik: bannerKey > imageKey > imageUrl)
  let finalImageUrl: string | undefined = config.imageUrl;
  if (config.bannerKey) {
    finalImageUrl = getSeedMediaPath(config.bannerKey, true) || undefined;
  } else if (config.imageKey) {
    finalImageUrl = getSeedMediaPath(config.imageKey, true) || undefined;
  } else if (!finalImageUrl) {
    // Mapping'den otomatik bul
    const imageKey = getBrandImageKey(config.name);
    if (imageKey) {
      finalImageUrl = getSeedMediaPath(imageKey, true) || undefined;
    }
  }
  
  const existing = await prisma.brand.findFirst({
    where: { name: config.name }
  });
  
  if (existing) {
    const updateData: any = {};
    if (config.description !== undefined) updateData.description = config.description;
    if (config.categoryId !== undefined) updateData.categoryId = config.categoryId;
    if (finalLogoUrl !== undefined) updateData.logoUrl = finalLogoUrl;
    if (finalImageUrl !== undefined && finalImageUrl !== null) updateData.imageUrl = finalImageUrl;
    
    if (Object.keys(updateData).length > 0) {
      return prisma.brand.update({
        where: { id: existing.id },
        data: updateData
      });
    }
    return existing;
  }
  
  return prisma.brand.create({
    data: {
      name: config.name,
      description: config.description,
      categoryId: config.categoryId,
      logoUrl: finalLogoUrl,
      imageUrl: finalImageUrl,
    }
  });
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

// ActionType için idempotent create/update
async function ensureActionType(config: { mainAction: string; code: string; label: string }): Promise<{ id: string; mainAction: string; code: string }> {
  const existing = await prisma.actionType.findFirst({
    where: {
      mainAction: config.mainAction as any,
      code: config.code
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.actionType.create({
    data: {
      mainAction: config.mainAction as any,
      code: config.code,
      label: config.label
    }
  });
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

/**
 * Tüm ContentPost'lar için PostMedia kontrolü yapıp eksik olanları ekler
 */

// ===== BRAND CATEGORY GÖRSELLERİNİ GÜNCELLE =====
async function updateBrandCategoryImages(): Promise<void> {
  const s3Service = new S3Service()
  const catalogImagesDir = path.join(__dirname, '../tests/assets/catalog')
  
  const categoryImageMap: Record<string, string> = {
    'Automotive': 'otomotiv.png',
    'Baby': 'kucukev.png',
    'Beauty': 'cameras.png',
    'Electronics': 'phones.png',
    'Fashion': 'headphones.png',
    'Gaming': 'games.png',
    'Health & Fitness': 'headphones.png',
    'Home & Living': 'home appliances.png',
    'Kitchen': 'home appliances.png',
    'Outdoor': 'drone.png',
    'Pets': 'kucukev.png',
    'Sustainability': 'smart home devices.png',
    'Technology': 'computers-tablets.png',
    'Travel': 'cameras.png',
  }

  const categories = await prisma.brandCategory.findMany()
  let updated = 0
  let uploaded = 0

  for (const category of categories) {
    const imageFileName = categoryImageMap[category.name]
    if (!imageFileName) continue

    const imagePath = path.join(catalogImagesDir, imageFileName)
    if (!existsSync(imagePath)) continue

    const targetKey = `brand-categories/${imageFileName}`
    
    // MinIO'ya yükle
    const fileExists = await s3Service.fileExists(targetKey)
    if (!fileExists) {
      const fileBuffer = readFileSync(imagePath)
      const contentType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg'
      await s3Service.uploadFile(targetKey, fileBuffer, contentType)
      uploaded++
    }

    // DB'yi güncelle
    if (category.imageUrl !== targetKey) {
      await prisma.brandCategory.update({
        where: { id: category.id },
        data: { imageUrl: targetKey },
      })
      updated++
    }
  }

  console.log(`   ✅ ${uploaded} görsel yüklendi, ${updated} kategori güncellendi`)
}

// ===== BRAND BANNER GÖRSELLERİNİ GÜNCELLE =====
async function updateBrandBannerImages(): Promise<void> {
  const s3Service = new S3Service()
  const brandBannersDir = path.join(__dirname, '../tests/assets/brands/banners')
  
  const brandBannerMap: Record<string, string> = {
    'Apple': 'brandpage-electronic-apple.jpg',
    'ASUS': 'brandpage-electronic-asus.jpg',
    'Canon': 'brandpage-electronic-canon.jpg',
    'Dyson': 'brandpage-electronic-dyson.jpg',
    'JBL': 'brandpage-electronic-jbl.jpg',
    'MSI': 'brandpage-electronic-msi.jpg',
    'NVIDIA': 'brandpage-electronic-nvidia.jpg',
    'Samsung': 'brandpage-electronic-samsung.jpg',
    'Shark': 'brandpage-electronic-shark.jpg',
    'SteelSeries': 'brandpage-electronic-steelseries.jpg',
    'Xiaomi': 'brandpage-electronic-xiaomi.jpg',
  }

  const electronicsCategory = await prisma.brandCategory.findFirst({
    where: { name: 'Electronics' },
  })

  if (!electronicsCategory) {
    console.warn('   ⚠️  Electronics kategorisi bulunamadı')
    return
  }

  const brands = await prisma.brand.findMany({
    where: { categoryId: electronicsCategory.id },
  })

  let updated = 0
  let uploaded = 0

  for (const brand of brands) {
    const bannerFileName = brandBannerMap[brand.name]
    if (!bannerFileName) continue

    const bannerPath = path.join(brandBannersDir, bannerFileName)
    if (!existsSync(bannerPath)) continue

    const targetKey = `brands/banners/${bannerFileName}`
    
    // MinIO'ya yükle
    const fileExists = await s3Service.fileExists(targetKey)
    if (!fileExists) {
      const fileBuffer = readFileSync(bannerPath)
      await s3Service.uploadFile(targetKey, fileBuffer, 'image/jpeg')
      uploaded++
    }

    // DB'yi güncelle
    if (brand.imageUrl !== targetKey) {
      await prisma.brand.update({
        where: { id: brand.id },
        data: { imageUrl: targetKey },
      })
      updated++
    }
  }

  console.log(`   ✅ ${uploaded} görsel yüklendi, ${updated} brand güncellendi`)
}

// ===== EVENT GÖRSELLERİNİ EVENT'LERE ATA =====
// NOT: Görsel yükleme artık upload-seed-media.ts script'i ile yapılıyor
// Bu fonksiyon sadece mevcut görselleri event'lere atar
// ===== ESKI FONKSIYONLAR - ARTIK KULLANILMIYOR =====
async function assignEventImages(): Promise<void> {
  console.log('⚠️ assignEventImages fonksiyonu devre dışı')
  return
}

async function addAppleBrandEvents(): Promise<void> {
  console.log('⚠️ addAppleBrandEvents fonksiyonu devre dışı')
  return
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

  // Non-internal featured users get NFTs
  const priorityUserIds = FEATURED_USER_IDS;

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
    // Give each user 1-2 random NFTs (TestFlight: ~10-15 total)
    const nftCountForUser = Math.floor(Math.random() * 2) + 1; // 1-2 NFT
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
    const defaultAvatarFilePath = path.join(__dirname, '../tests/assets/avatars/default-useravatar.png')
    
    if (existsSync(defaultAvatarFilePath)) {
      const defaultAvatarBuffer = readFileSync(defaultAvatarFilePath)
      await s3Service.uploadFile(DEFAULT_AVATAR_PATH, defaultAvatarBuffer, 'image/png')
      console.log(`✅ Default avatar yüklendi: ${DEFAULT_AVATAR_PATH}\n`)
    } else {
      console.warn(`⚠️  Default avatar dosyası bulunamadı: ${defaultAvatarFilePath}\n`)
    }

    // Setup Profile için 12 temsili avatar'ı MinIO'ya yükle (GET /users/avatars path'leri ile uyumlu)
    const avatarsDir = path.join(__dirname, '../tests/assets/avatars')
    if (existsSync(avatarsDir)) {
      let uploaded = 0
      for (let i = 1; i <= 12; i++) {
        const avatarName = `avatar-${i}.png`
        const avatarPath = path.join(avatarsDir, avatarName)
        if (existsSync(avatarPath)) {
          const objectKey = `avatars/${avatarName}`
          const buf = readFileSync(avatarPath)
          await s3Service.uploadFile(objectKey, buf, 'image/png')
          uploaded++
        }
      }
      if (uploaded > 0) {
        console.log(`✅ Setup Profile avatarları yüklendi: ${uploaded}/12 (avatars/avatar-1.png … avatar-12.png)\n`)
      }
    } else {
      console.warn(`⚠️  Avatarlar klasörü bulunamadı: ${avatarsDir}\n`)
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
  const totalSteps = 32 // Includes 8.1 steps: UserAvatar, Social&Preferences, Payment, TipsTransfer, Expert, Notification
  const progress = new ProgressBar(totalSteps, 50)

  // Seed başlangıcını işaretle (metadata için)
  markSeedStart()
  progress.increment('Metadata başlatılıyor...')
  
  // Seed kullanıcı ID'lerini metadata'ya ekle
  const allSeedUserIds = [
    ...FEATURED_USER_IDS,
    JULIA_USER_ID,
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

  // 1. User Themes (ÖNCE - createSeedUsers için gerekli)
  console.log('📱 Creating user themes...')
  const themeConfigs = [
    { name: 'Light', description: 'Light theme - ideal for daytime use' },
    { name: 'Dark', description: 'Dark theme - easy on the eyes, modern look' },
    { name: 'Auto', description: 'Automatic - follows system theme preference' }
  ]
  
  const themes = await Promise.all(
    themeConfigs.map(async (config) => {
      const existing = await prisma.userTheme.findFirst({
        where: { name: config.name }
      })
      
      if (existing) {
        return existing
      }
      
      return prisma.userTheme.create({
        data: config
      })
    })
  )
  console.log(`✅ ${themes.length} tema oluşturuldu/güncellendi`)

  // 2. Seed Users (40 isimlendirilmiş kullanıcı - DİĞER HER ŞEYDEN ÖNCE!)
  progress.increment('40 seed kullanıcısı oluşturuluyor...')
  const defaultTheme = themes.find(t => t.name === 'Dark') || themes[0]
  const seedUsers = await createSeedUsers(defaultTheme.id)
  const allUserIds = Array.from(seedUsers.keys())
  console.log(`✅ ${seedUsers.size} kullanıcı oluşturuldu`)
  progress.increment('Seed kullanıcıları oluşturuldu')

  // 2a. Admin user (admin@tipbox.co, ADMIN rolü)
  progress.increment('Admin kullanıcı oluşturuluyor...')
  await ensureAdminUser(prisma, passwordHash)
  console.log('✅ Admin kullanıcı (admin@tipbox.co) hazır')
  progress.increment('Admin kullanıcı oluşturuldu')

  // 2b. UserAvatar (ensure every seed user has active avatar for EP compatibility)
  progress.increment('UserAvatar step...')
  try {
    await seedUserAvatars(prisma)
    progress.increment('UserAvatar step tamamlandı')
  } catch (error) {
    console.warn('⚠️  UserAvatar step atlandı:', error instanceof Error ? error.message : error)
    progress.increment('UserAvatar step atlandı')
  }

  // 3. Experience Taxonomy (Duration, Location, Purpose - for Experience posts)
  await seedTaxonomy()
  progress.increment('Experience Taxonomy oluşturuldu')

  // Categories'i sonraki fonksiyonlar için hazırla (root kategoriler)
  const mainCategories = await prisma.category.findMany({ where: { parentId: null } })
  console.log(`📂 ${mainCategories.length} root category kullanılabilir\n`)

  // 5. User Inventories (Catalog'daki ürünlerle oluşturulacak)
  progress.increment('Kullanıcı inventory\'leri oluşturuluyor...')
  await seedUserInventories()
  progress.increment('Kullanıcı inventory\'leri oluşturuldu')

  // 5b. AiExperienceSplit (owned inventory'ler için statik split kayıtları; Gemini çağrılmaz)
  progress.increment('AiExperienceSplit seed...')
  await seedAiExperienceSplits()
  progress.increment('AiExperienceSplit seed tamamlandı')

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

  // 8b. Social & Preferences (UserBlock, UserMute, UserFeedPreferences)
  progress.increment('Social & Preferences step...')
  try {
    await seedSocialAndPreferences(prisma)
    progress.increment('Social & Preferences step tamamlandı')
  } catch (error) {
    console.warn('⚠️  Social & Preferences step atlandı:', error instanceof Error ? error.message : error)
    progress.increment('Social & Preferences step atlandı')
  }

  // 8.5. Trending Posts (Feed distribution'dan önce hazırlanmalı)
  progress.increment('Trending post\'lar oluşturuluyor...')
  await seedTrendingPosts()
  progress.increment('Trending post\'lar oluşturuldu')

  // 9. Wallet Transactions
  progress.increment('Wallet transactions oluşturuluyor...')
  await seedTransactions()
  progress.increment('Wallet transactions oluşturuldu')

  // 9b. Payment step (SubscriptionPlan, PaymentMethod, UserSubscription, Invoice)
  progress.increment('Payment step...')
  try {
    await seedPayment(prisma, { testUserEmail: 'elif@tipbox.co' })
    progress.increment('Payment step tamamlandı')
  } catch (error) {
    console.warn('⚠️  Payment step atlandı:', error instanceof Error ? error.message : error)
    progress.increment('Payment step atlandı')
  }

  // 9c. TipsTokenTransfer step
  progress.increment('TipsTransfer step...')
  try {
    await seedTipsTransfers(prisma)
    progress.increment('TipsTransfer step tamamlandı')
  } catch (error) {
    console.warn('⚠️  TipsTransfer step atlandı:', error instanceof Error ? error.message : error)
    progress.increment('TipsTransfer step atlandı')
  }

  // 12. Events (Event + Participation + Rewards)
  progress.increment('Events oluşturuluyor...')
  try {
    await seedEvents()
    progress.increment('Events oluşturuldu')
  } catch (error) {
    console.error('⚠️  seedEvents() hatası (SubCategory/ProductGroup uyumsuzluğu olabilir):', error)
    console.log('   Devam ediliyor...')
    progress.increment('Events atlandı (hata)')
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

  // Badge Categories
  progress.increment('Badge kategorileri oluşturuluyor...')
  console.log('\n🏆 Creating badge categories...')
  const badgeCategoryConfigs = [
    { name: 'Cosmetic', description: 'Badges available for purchase in the marketplace.' },
    { name: 'Event', description: 'Badges earned during events (e.g. by upvote ranking).' },
    { name: 'Collection', description: 'Badges earned by completing action-based goals in collections.' },
    { name: 'Brand', description: 'Badges associated with brands.' }
  ]
  
  const badgeCategories = await Promise.all(
    badgeCategoryConfigs.map(async (config) => {
      return ensureBadgeCategory(config)
    })
  )
  console.log(`✅ ${badgeCategories.length} badge kategorisi oluşturuldu/güncellendi`)

  // Action Types (for Collection badge goals)
  progress.increment('Action Types oluşturuluyor...')
  console.log('\n⚡ Creating action types...')
  const actionTypeConfigs = [
    // POST actions
    { mainAction: 'POST', code: 'EXPERIENCE', label: 'Experience Post' },
    { mainAction: 'POST', code: 'TIPS', label: 'Tips Post' },
    { mainAction: 'POST', code: 'REVIEW', label: 'Review Post' },
    { mainAction: 'POST', code: 'GENERAL', label: 'General Post' },
    // LIKE actions
    { mainAction: 'LIKE', code: 'ALL', label: 'Like Action' },
    // COMMENT actions
    { mainAction: 'COMMENT', code: 'ALL', label: 'Comment Action' },
    // BOOKMARK actions
    { mainAction: 'BOOKMARK', code: 'ALL', label: 'Bookmark Action' },
    // JOIN actions
    { mainAction: 'JOIN', code: 'ALL', label: 'Join Action' },
    { mainAction: 'JOIN', code: 'BRAND', label: 'Join Brand' },
    // SYSTEM actions
    { mainAction: 'SYSTEM', code: 'PROFILE_COMPLETE', label: 'Complete Profile' },
    { mainAction: 'SYSTEM', code: 'BIO_ADD', label: 'Add Bio' },
    { mainAction: 'SYSTEM', code: 'INVENTORY_ADD', label: 'Add Inventory Item' },
    { mainAction: 'SYSTEM', code: 'PROFILE_PHOTO', label: 'Add Profile Photo' },
    { mainAction: 'SYSTEM', code: 'TRUST', label: 'Trust User' },
    { mainAction: 'SYSTEM', code: 'UPVOTE', label: 'Upvote Event Post' },
  ]

  const actionTypes = await Promise.all(
    actionTypeConfigs.map(async (config) => {
      return ensureActionType(config)
    })
  )
  console.log(`✅ ${actionTypes.length} action type oluşturuldu/güncellendi`)

  // 4. Default Badges
  // NOT: Ana badge'ler (17 badge) artık setup-badges.ts script'i ile oluşturuluyor
  // Event badge'leri ise ensureEventBadgeSystem tarafından yönetiliyor
  // Bu kısım kaldırıldı çünkü yeni sistem badge'leri zaten oluşturuyor
  console.log('\n🎖️ Badge oluşturma:')
  console.log('   - Ana badge\'ler (17 adet): setup-badges.ts script\'i ile yapılıyor')
  console.log('   - Event badge\'leri: ensureEventBadgeSystem tarafından yönetiliyor')
  console.log('   - Kullanıcı atamaları: setup-badges.ts tarafından yapılıyor\n')

  // 5. Comparison Metrics
  progress.increment('Karşılaştırma metrikleri oluşturuluyor...')
  console.log('\n📊 Creating comparison metrics...')
  const metricConfigs = [
    { name: 'Price', description: 'Price-to-performance ratio (1-10)' },
    { name: 'Quality', description: 'Overall build and material quality (1-10)' },
    { name: 'Ease of Use', description: 'How easy the product is to use (1-10)' },
    { name: 'Durability', description: 'How long the product lasts (1-10)' },
    { name: 'Design', description: 'Visual design and aesthetics (1-10)' },
    { name: 'Customer Service', description: 'Quality of brand customer support (1-10)' },
    { name: 'Features', description: 'Feature set and functionality (1-10)' },
    { name: 'Eco-Friendly', description: 'Environmental impact and sustainability (1-10)' }
  ]
  
  const metrics = await Promise.all(
    metricConfigs.map(async (config) => {
      return ensureComparisonMetric(config)
    })
  )
  console.log(`✅ ${metrics.length} karşılaştırma metriği oluşturuldu/güncellendi`)

  // 5.b Boost Options
  progress.increment('Boost seçenekleri oluşturuluyor...')
  console.log('\n🚀 Creating boost options...')
  const boostOptionConfigs = [
    { title: 'Standard Boost', description: 'Standard visibility boost for your question posts.', amount: 0, isPopular: false, isActive: true },
    { title: 'Popular Boost', description: 'Increases reach for questions that need quick answers.', amount: 10, isPopular: true, isActive: true },
    { title: 'Premium Boost', description: 'Maximum visibility and priority in the feed.', amount: 25, isPopular: true, isActive: true }
  ]
  
  const boostOptions = await Promise.all(
    boostOptionConfigs.map(async (config) => {
      const existing = await prisma.boostOption.findFirst({
        where: { title: config.title }
      })
      
      if (existing) {
        return existing
      }
      
      return prisma.boostOption.create({
        data: config
      })
    })
  )
  console.log(`✅ ${boostOptions.length} boost seçeneği oluşturuldu/güncellendi`)

  // Bridge badge configs and achievement chain code removed (deprecated)
  // seedProductCategories/seedBrands/seedProducts also removed (handled by catalog-service)

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
  
  // Helper function: createOrGetContentPost (yorum bloğu dışına taşındı)
  const createOrGetContentPost = async (data: {
    id?: string
    userId: string
    type: string
    title: string
    body: string
    productId?: string | null
    productGroupId?: string | null
    mainCategoryId?: string | null
    subCategoryId?: string | null
    inventoryRequired?: boolean
    isBoosted?: boolean
    createdAt?: Date
  }) => {
    // Önce mevcut post'u kontrol et (title + userId)
    const existing = await prisma.contentPost.findFirst({
      where: {
        title: data.title,
        userId: data.userId,
      }
    })
    
    if (existing) {
      // Mevcut post için PostMedia kontrolü yap
      await ensurePostMedia(existing.id, existing.userId, existing.type, existing.productId)
      return existing
    }
    
    // Yeni post oluştur
    const newPost = await prisma.contentPost.create({
      data: {
        id: data.id || generateUlid(),
        userId: data.userId,
        type: data.type as any, // Type assertion for ContentPostType
        title: data.title,
        body: data.body,
        productId: data.productId ?? null,
        productGroupId: data.productGroupId ?? null,
        mainCategoryId: data.mainCategoryId ?? null,
        subCategoryId: data.subCategoryId ?? null,
        inventoryRequired: data.inventoryRequired ?? false,
        isBoosted: data.isBoosted ?? false,
        createdAt: data.createdAt,
      }
    })
    
    // Yeni post için PostMedia ekle
    await ensurePostMedia(newPost.id, newPost.userId, newPost.type, newPost.productId)
    
    return newPost
  }
  
  // Create Julia Havk user
  const juliaEmail = 'julia.havk@tipbox.co'
  
  let juliaUser = await prisma.user.findUnique({ where: { id: JULIA_USER_ID } })
  if (!juliaUser) {
    juliaUser = (await prisma.user.findUnique({ where: { email: juliaEmail } })) || null
  }
  
  if (!juliaUser) {
    // Upload avatar and banner to MinIO
    // ÖNEMLİ: Önce MinIO'ya yükle, sonra DB'ye yaz
    let juliaAvatarPath = ''
    let juliaBannerPath = ''
    
    try {
      const nodeEnv = process.env.NODE_ENV || 'development'
      const s3Endpoint = process.env.S3_ENDPOINT || 'http://minio:9000'
      const containerName = s3Endpoint.includes('minio:9000') 
        ? `tipbox_minio_${nodeEnv}` 
        : 'Harici MinIO'
      
      console.log(`📦 Julia user görselleri MinIO'ya yükleniyor (${containerName})...`)
      
      const s3Service = new S3Service()
      await s3Service.checkAndCreateBucket()
      
      // Upload avatar (use useravatar.jpg from assets)
      const avatarPath = path.join(__dirname, '../tests/assets/userprofile/ozan.jpg')
      try {
        const avatarBuffer = readFileSync(avatarPath)
        const avatarObjectKey = `users/${JULIA_USER_ID}/avatar.jpg`
        // ÖNEMLİ: Önce MinIO'ya yükle
        // uploadFile() artık sadece path döndürür (tam URL değil)
        // DB'de sadece path tutulacak, response'larda resolveMediaUrl ile tam URL'ye çevrilecek
        juliaAvatarPath = await s3Service.uploadFile(avatarObjectKey, avatarBuffer, 'image/jpeg')
        console.log(`✅ Julia avatar ${containerName} container'ına yüklendi: ${juliaAvatarPath}`)
      } catch (error) {
        console.warn('⚠️ Avatar yüklenemedi, varsayılan kullanılıyor:', error)
        juliaAvatarPath = PRIMARY_AVATAR_URL || ''
      }
      
      // Upload banner
      const bannerPath = path.join(__dirname, '../tests/assets/userprofile/banner.png')
      try {
        const bannerBuffer = readFileSync(bannerPath)
        const bannerObjectKey = `users/${JULIA_USER_ID}/banner.png`
        // ÖNEMLİ: Önce MinIO'ya yükle
        // uploadFile() artık sadece path döndürür (tam URL değil)
        juliaBannerPath = await s3Service.uploadFile(bannerObjectKey, bannerBuffer, 'image/png')
        console.log(`✅ Julia banner ${containerName} container'ına yüklendi: ${juliaBannerPath}`)
      } catch (error) {
        console.warn('⚠️ Banner yüklenemedi, varsayılan kullanılıyor:', error)
        juliaBannerPath = DEFAULT_BANNER_URL || ''
      }
    } catch (error) {
      console.error('❌ MinIO bağlantı hatası, varsayılan görseller kullanılıyor:', error)
      juliaAvatarPath = PRIMARY_AVATAR_URL || ''
      juliaBannerPath = DEFAULT_BANNER_URL || ''
    }
    
    // Create user
    juliaUser = await prisma.user.create({
      data: {
        id: JULIA_USER_ID,
        email: juliaEmail,
        passwordHash,
        emailVerified: true,
        status: 'ACTIVE',
      },
    })
    console.log('✅ Julia Havk user created')
    
    // Create profile
    await prisma.profile.upsert({
      where: { userId: juliaUser.id },
      update: {
        displayName: 'Julia Havk',
        userName: 'juliahavk',
        bio: 'Tech enthusiast and lifestyle blogger. Passionate about discovering innovative products and sharing authentic experiences. Love exploring the latest gadgets and digital solutions.',
        bannerUrl: juliaBannerPath,
        country: 'United States',
      },
      create: {
        userId: juliaUser.id,
        displayName: 'Julia Havk',
        userName: 'juliahavk',
        bio: 'Tech enthusiast and lifestyle blogger. Passionate about discovering innovative products and sharing authentic experiences. Love exploring the latest gadgets and digital solutions.',
        bannerUrl: juliaBannerPath,
        country: 'United States',
      },
    })
    console.log('✅ Julia Havk profile created')
    
    // Set avatar
    await prisma.userAvatar.updateMany({ where: { userId: juliaUser.id }, data: { isActive: false } })
    await prisma.userAvatar.create({
      data: {
        userId: juliaUser.id,
        imageUrl: juliaAvatarPath,
        isActive: true,
      },
    })
    console.log('✅ Julia Havk avatar set')
  } else {
    console.log('✅ Julia Havk user already exists')
  }

  // Create posts for Julia Havk - DEVRE DIŞI
  // Julia has a separate user ID (JULIA_USER_ID) and gets posts via SEED_USERS
  console.log('⚠️  Julia Havk extra posts disabled (gets posts from SEED_USERS list)\n')

  // ===== FEED DISTRIBUTION =====
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

  // ===== EVENT BADGES & MARKETPLACE BADGES SEEDING =====
  console.log('\n🏆 Event Badge Sistemi ve Marketplace Badge\'leri (Deprecated - Skipped)')
  progress.increment('Event & Marketplace badges (skipped)...')

  try {
    // Event badge sistemi (badge + event + EventBadge join table)
    // DEPRECATED: Old event badge system disabled - now using EventBadgeDistributorService with rank-based distribution
    // await ensureEventBadgeSystem(prisma)

    // Marketplace badge'leri
    // DEPRECATED: Badge seeding removed - badges are now created via admin panel or scripts
    // await ensureMarketplaceBadges(prisma)

    progress.increment('Event & Marketplace badges (skipped)')
    console.log('✅ Event & Marketplace badges seeding skipped (deprecated)')
  } catch (error) {
    console.error('❌ Event/Marketplace badges seeding hatası:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
    console.log('⚠️  Seed devam ediyor ama event/marketplace badges oluşturulamadı')
  }

  // ===== GAMIFICATION COLLECTIONS SEEDING =====
  console.log('\n🎮 Gamification Collections seeding başlatılıyor...')
  progress.increment('Gamification Collections oluşturuluyor...')

  try {
    await seedGamificationCollections(prisma)
    progress.increment('Gamification Collections tamamlandı')
    console.log('✅ Gamification Collections seeding completed')
  } catch (error) {
    console.error('❌ Gamification Collections seeding hatası:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
    console.log('⚠️  Seed devam ediyor ama Gamification Collections oluşturulamadı')
  }

  // ===== BRAND CATALOG DATA SEEDING =====
  console.log('\n📦 Brand Catalog data seeding starting...')
  progress.increment('Brand Catalog verileri oluşturuluyor...')
  
  try {
    await seedBrandCatalog(prisma)
    progress.increment('Brand Catalog seeding tamamlandı')
    console.log('✅ Brand Catalog data seeding completed')
  } catch (error) {
    console.error('❌ Brand Catalog seeding hatası:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
    console.log('⚠️  Seed devam ediyor ama Brand Catalog verileri oluşturulamadı')
  }

  // ===== EXPERT & NOTIFICATION STEPS (8.1) =====
  progress.increment('Expert step...')
  try {
    await seedExpert(prisma)
    progress.increment('Expert step tamamlandı')
    console.log('✅ Expert (ExpertRequest, ExpertAnswer) seeding completed')
  } catch (error) {
    console.warn('⚠️  Expert step atlandı:', error instanceof Error ? error.message : error)
    progress.increment('Expert step atlandı')
  }

  progress.increment('Notification step...')
  try {
    await seedNotification(prisma)
    progress.increment('Notification step tamamlandı')
    console.log('✅ Notification & PushToken seeding completed')
  } catch (error) {
    console.warn('⚠️  Notification step atlandı:', error instanceof Error ? error.message : error)
    progress.increment('Notification step atlandı')
  }

  // ===== NFT SEEDING FOR PRIORITY USERS =====
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
