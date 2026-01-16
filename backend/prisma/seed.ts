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
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { markSeedStart, markSeedEnd, addSeedUserId } = require('./seed/seed-metadata')

const prisma = new PrismaClient()

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
  {
    id: '10000000-0000-4000-a000-000000000021',
    name: 'Derya',
    email: 'derya@tipbox.co',
    userName: 'derya',
    avatarKey: 'user.avatar.derya',
    bio: 'Facial cleanser and toner expert.',
    title: 'Cleansing Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000022',
    name: 'Selim',
    email: 'selim@tipbox.co',
    userName: 'selim',
    avatarKey: 'user.avatar.selim',
    bio: 'Webcam and streaming equipment specialist.',
    title: 'Streaming Pro',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000023',
    name: 'Pelin',
    email: 'pelin@tipbox.co',
    userName: 'pelin',
    avatarKey: 'user.avatar.pelin',
    bio: 'Blush and bronzer enthusiast.',
    title: 'Blush Master',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000024',
    name: 'Cem',
    email: 'cem@tipbox.co',
    userName: 'cem',
    avatarKey: 'user.avatar.cem',
    bio: 'USB hub and docking station expert.',
    title: 'Connectivity Pro',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000025',
    name: 'Duygu',
    email: 'duygu@tipbox.co',
    userName: 'duygu',
    avatarKey: 'user.avatar.duygu',
    bio: 'Sunscreen and SPF product specialist.',
    title: 'SPF Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000026',
    name: 'Hakan',
    email: 'hakan@tipbox.co',
    userName: 'hakan',
    avatarKey: 'user.avatar.hakan',
    bio: 'Bluetooth speaker and portable audio reviewer.',
    title: 'Portable Audio',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000027',
    name: 'Nil',
    email: 'nil@tipbox.co',
    userName: 'nil',
    avatarKey: 'user.avatar.nil',
    bio: 'Shampoo and conditioner expert.',
    title: 'Hair Care Pro',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000028',
    name: 'Utku',
    email: 'utku@tipbox.co',
    userName: 'utku',
    avatarKey: 'user.avatar.man5',
    bio: 'Graphics card and PC building enthusiast.',
    title: 'PC Builder',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000029',
    name: 'Ceren',
    email: 'ceren@tipbox.co',
    userName: 'ceren',
    avatarKey: 'user.avatar.woman5',
    bio: 'Face mask and treatment specialist.',
    title: 'Mask Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000030',
    name: 'Yiğit',
    email: 'yigit@tipbox.co',
    userName: 'yigit',
    avatarKey: 'user.avatar.primary',
    bio: 'Printer and scanner technology reviewer.',
    title: 'Print Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000031',
    name: 'Sude',
    email: 'sude@tipbox.co',
    userName: 'sude',
    avatarKey: 'user.avatar.trust1',
    bio: 'Body lotion and body care product enthusiast.',
    title: 'Body Care Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000032',
    name: 'Alper',
    email: 'alper@tipbox.co',
    userName: 'alper',
    avatarKey: 'user.avatar.trust2',
    bio: 'Smart light and home automation expert.',
    title: 'Smart Lighting',
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

/**
 * Seed Product Categories - Electronics ve Beauty kategorileri
 * Her kategori altında 5-7 subcategory ve 3-5 product group oluşturur
 */
async function seedProductCategories(): Promise<void> {
  console.log('\n📂 Ürün Kategorileri Oluşturuluyor...\n')
  
  // 1. ELECTRONICS Ana Kategorisi
  const electronics = await ensureMainCategory({
    name: 'Electronics',
    description: 'Consumer electronics, gadgets and digital devices',
    imageKey: 'catalog.electronic-main'
  })
  console.log(`✅ Ana Kategori: ${electronics.name}`)
  
  // Electronics > Phones
  const phones = await ensureSubCategory({
    name: 'Phones',
    mainCategoryId: electronics.id,
    description: 'Smartphones and mobile devices',
    imageKey: 'catalog.computers-tablets'
  })
  
  const phonesGroups = [
    { name: 'iPhone Series', description: 'Apple iPhone models' },
    { name: 'Samsung Galaxy', description: 'Samsung Galaxy smartphones' },
    { name: 'Google Pixel', description: 'Google Pixel smartphones' },
    { name: 'OnePlus Devices', description: 'OnePlus smartphones' },
  ]
  
  for (const group of phonesGroups) {
    await ensureProductGroup({
      name: group.name,
      subCategoryId: phones.id,
      description: group.description
    })
  }
  console.log(`  ✅ ${phones.name} - ${phonesGroups.length} product group`)
  
  // Electronics > Laptops
  const laptops = await ensureSubCategory({
    name: 'Laptops',
    mainCategoryId: electronics.id,
    description: 'Laptop computers and notebooks',
  })
  
  const laptopGroups = [
    { name: 'MacBook', description: 'Apple MacBook laptops' },
    { name: 'Dell Laptops', description: 'Dell laptop computers' },
    { name: 'HP Laptops', description: 'HP laptop computers' },
    { name: 'Lenovo Laptops', description: 'Lenovo laptop computers' },
  ]
  
  for (const group of laptopGroups) {
    await ensureProductGroup({
      name: group.name,
      subCategoryId: laptops.id,
      description: group.description
    })
  }
  console.log(`  ✅ ${laptops.name} - ${laptopGroups.length} product group`)
  
  // Electronics > Tablets
  const tablets = await ensureSubCategory({
    name: 'Tablets',
    mainCategoryId: electronics.id,
    description: 'Tablet computers and iPads',
  })
  
  const tabletGroups = [
    { name: 'iPad', description: 'Apple iPad tablets' },
    { name: 'Samsung Tab', description: 'Samsung tablet computers' },
    { name: 'Surface', description: 'Microsoft Surface tablets' },
  ]
  
  for (const group of tabletGroups) {
    await ensureProductGroup({
      name: group.name,
      subCategoryId: tablets.id,
      description: group.description
    })
  }
  console.log(`  ✅ ${tablets.name} - ${tabletGroups.length} product group`)
  
  // Electronics > Audio
  const audio = await ensureSubCategory({
    name: 'Audio',
    mainCategoryId: electronics.id,
    description: 'Headphones, earbuds, speakers and audio devices',
  })
  
  const audioGroups = [
    { name: 'Headphones', description: 'Over-ear and on-ear headphones' },
    { name: 'Earbuds', description: 'In-ear wireless earbuds' },
    { name: 'Speakers', description: 'Bluetooth and smart speakers' },
    { name: 'Soundbars', description: 'TV soundbars and home audio' },
  ]
  
  for (const group of audioGroups) {
    await ensureProductGroup({
      name: group.name,
      subCategoryId: audio.id,
      description: group.description
    })
  }
  console.log(`  ✅ ${audio.name} - ${audioGroups.length} product group`)
  
  // Electronics > Wearables
  const wearables = await ensureSubCategory({
    name: 'Wearables',
    mainCategoryId: electronics.id,
    description: 'Smartwatches and fitness trackers',
  })
  
  const wearableGroups = [
    { name: 'Apple Watch', description: 'Apple smartwatches' },
    { name: 'Samsung Galaxy Watch', description: 'Samsung smartwatches' },
    { name: 'Fitness Trackers', description: 'Fitness bands and trackers' },
  ]
  
  for (const group of wearableGroups) {
    await ensureProductGroup({
      name: group.name,
      subCategoryId: wearables.id,
      description: group.description
    })
  }
  console.log(`  ✅ ${wearables.name} - ${wearableGroups.length} product group`)
  
  // Electronics > Accessories
  const accessories = await ensureSubCategory({
    name: 'Accessories',
    mainCategoryId: electronics.id,
    description: 'Chargers, cases, cables and accessories',
  })
  
  const accessoryGroups = [
    { name: 'Chargers', description: 'Phone and laptop chargers' },
    { name: 'Cases', description: 'Phone and tablet cases' },
    { name: 'Cables', description: 'USB-C, Lightning and other cables' },
    { name: 'Screen Protectors', description: 'Screen guards and protectors' },
  ]
  
  for (const group of accessoryGroups) {
    await ensureProductGroup({
      name: group.name,
      subCategoryId: accessories.id,
      description: group.description
    })
  }
  console.log(`  ✅ ${accessories.name} - ${accessoryGroups.length} product group`)
  
  // Electronics > Cameras
  const cameras = await ensureSubCategory({
    name: 'Cameras',
    mainCategoryId: electronics.id,
    description: 'Digital cameras and photography equipment',
  })
  
  const cameraGroups = [
    { name: 'DSLR Cameras', description: 'Digital SLR cameras' },
    { name: 'Mirrorless Cameras', description: 'Mirrorless digital cameras' },
    { name: 'Action Cameras', description: 'GoPro and action cameras' },
    { name: 'Drones', description: 'Camera drones and quadcopters' },
  ]
  
  for (const group of cameraGroups) {
    await ensureProductGroup({
      name: group.name,
      subCategoryId: cameras.id,
      description: group.description
    })
  }
  console.log(`  ✅ ${cameras.name} - ${cameraGroups.length} product group`)
  
  console.log(`\n✅ ${electronics.name}: 7 subcategory, 27 product group oluşturuldu\n`)
  
  // 2. BEAUTY Ana Kategorisi
  const beauty = await ensureMainCategory({
    name: 'Beauty',
    description: 'Cosmetics, skincare, haircare and personal care products',
    imageKey: 'catalog.beauty-main'
  })
  console.log(`✅ Ana Kategori: ${beauty.name}`)
  
  // Beauty > Skincare
  const skincare = await ensureSubCategory({
    name: 'Skincare',
    mainCategoryId: beauty.id,
    description: 'Facial skincare and treatments',
  })
  
  const skincareGroups = [
    { name: 'Cleansers', description: 'Face wash and cleansing products' },
    { name: 'Moisturizers', description: 'Face creams and moisturizers' },
    { name: 'Serums', description: 'Facial serums and treatments' },
    { name: 'Sunscreen', description: 'SPF and sun protection' },
    { name: 'Masks', description: 'Face masks and treatments' },
  ]
  
  for (const group of skincareGroups) {
    await ensureProductGroup({
      name: group.name,
      subCategoryId: skincare.id,
      description: group.description
    })
  }
  console.log(`  ✅ ${skincare.name} - ${skincareGroups.length} product group`)
  
  // Beauty > Makeup
  const makeup = await ensureSubCategory({
    name: 'Makeup',
    mainCategoryId: beauty.id,
    description: 'Cosmetics and makeup products',
  })
  
  const makeupGroups = [
    { name: 'Foundation', description: 'Face foundation and base' },
    { name: 'Lipstick', description: 'Lipsticks and lip colors' },
    { name: 'Mascara', description: 'Eye mascara products' },
    { name: 'Eyeshadow', description: 'Eye shadow palettes' },
    { name: 'Blush', description: 'Cheek blush and bronzer' },
  ]
  
  for (const group of makeupGroups) {
    await ensureProductGroup({
      name: group.name,
      subCategoryId: makeup.id,
      description: group.description
    })
  }
  console.log(`  ✅ ${makeup.name} - ${makeupGroups.length} product group`)
  
  // Beauty > Fragrance
  const fragrance = await ensureSubCategory({
    name: 'Fragrance',
    mainCategoryId: beauty.id,
    description: 'Perfumes and fragrances',
  })
  
  const fragranceGroups = [
    { name: 'Perfume', description: "Women's perfumes" },
    { name: 'Cologne', description: "Men's cologne" },
    { name: 'Body Spray', description: 'Body mists and sprays' },
  ]
  
  for (const group of fragranceGroups) {
    await ensureProductGroup({
      name: group.name,
      subCategoryId: fragrance.id,
      description: group.description
    })
  }
  console.log(`  ✅ ${fragrance.name} - ${fragranceGroups.length} product group`)
  
  // Beauty > Haircare
  const haircare = await ensureSubCategory({
    name: 'Haircare',
    mainCategoryId: beauty.id,
    description: 'Hair products and treatments',
  })
  
  const haircareGroups = [
    { name: 'Shampoo', description: 'Hair shampoo products' },
    { name: 'Conditioner', description: 'Hair conditioners' },
    { name: 'Styling Products', description: 'Hair gels, mousses and sprays' },
    { name: 'Hair Treatments', description: 'Hair masks and treatments' },
  ]
  
  for (const group of haircareGroups) {
    await ensureProductGroup({
      name: group.name,
      subCategoryId: haircare.id,
      description: group.description
    })
  }
  console.log(`  ✅ ${haircare.name} - ${haircareGroups.length} product group`)
  
  // Beauty > Personal Care
  const personalCare = await ensureSubCategory({
    name: 'Personal Care',
    mainCategoryId: beauty.id,
    description: 'Body care and hygiene products',
  })
  
  const personalCareGroups = [
    { name: 'Deodorant', description: 'Antiperspirants and deodorants' },
    { name: 'Body Wash', description: 'Shower gels and body wash' },
    { name: 'Hand Cream', description: 'Hand lotions and creams' },
    { name: 'Body Lotion', description: 'Body moisturizers' },
  ]
  
  for (const group of personalCareGroups) {
    await ensureProductGroup({
      name: group.name,
      subCategoryId: personalCare.id,
      description: group.description
    })
  }
  console.log(`  ✅ ${personalCare.name} - ${personalCareGroups.length} product group`)
  
  // Beauty > Nail Care
  const nailCare = await ensureSubCategory({
    name: 'Nail Care',
    mainCategoryId: beauty.id,
    description: 'Nail polish and care products',
  })
  
  const nailCareGroups = [
    { name: 'Nail Polish', description: 'Nail lacquer and polish' },
    { name: 'Nail Treatment', description: 'Nail strengtheners and treatments' },
    { name: 'Nail Tools', description: 'Nail files and care tools' },
  ]
  
  for (const group of nailCareGroups) {
    await ensureProductGroup({
      name: group.name,
      subCategoryId: nailCare.id,
      description: group.description
    })
  }
  console.log(`  ✅ ${nailCare.name} - ${nailCareGroups.length} product group`)
  
  // Beauty > Men's Grooming
  const mensGrooming = await ensureSubCategory({
    name: "Men's Grooming",
    mainCategoryId: beauty.id,
    description: 'Grooming products for men',
  })
  
  const mensGroomingGroups = [
    { name: 'Shaving Products', description: 'Razors, creams and aftershave' },
    { name: "Men's Skincare", description: 'Face care for men' },
    { name: "Men's Haircare", description: 'Hair products for men' },
  ]
  
  for (const group of mensGroomingGroups) {
    await ensureProductGroup({
      name: group.name,
      subCategoryId: mensGrooming.id,
      description: group.description
    })
  }
  console.log(`  ✅ ${mensGrooming.name} - ${mensGroomingGroups.length} product group`)
  
  console.log(`\n✅ ${beauty.name}: 7 subcategory, 30 product group oluşturuldu\n`)
  console.log('═'.repeat(80))
  console.log('\n✨ Toplam: 2 ana kategori, 14 alt kategori, 57 product group\n')
}

/**
 * Seed Brands - Electronics ve Beauty brand'leri
 * Her brand için BrandCategory ilişkisi, logo ve banner oluşturur
 */
async function seedBrands(): Promise<void> {
  console.log('\n🏷️  Brand Sistemi Oluşturuluyor...\n')
  
  // 1. Brand Categories
  const electronicsBrandCat = await ensureBrandCategory({
    name: 'Electronics'
  })
  
  const beautyBrandCat = await ensureBrandCategory({
    name: 'Beauty'
  })
  
  console.log(`✅ Brand Categories: ${electronicsBrandCat.name}, ${beautyBrandCat.name}`)
  
  // 2. Electronics Brands
  const electronicsBrands = [
    {
      name: 'Apple',
      description: 'Premium consumer electronics and software',
      logoKey: 'brand.apple.logo' as SeedMediaKey,
      bannerKey: 'brand.apple.banner' as SeedMediaKey
    },
    {
      name: 'Samsung',
      description: 'Global leader in consumer electronics',
      logoKey: 'brand.samsung.logo' as SeedMediaKey,
      bannerKey: 'brand.samsung.banner' as SeedMediaKey
    },
    {
      name: 'Google',
      description: 'Technology and software company',
      logoKey: 'brand.google.logo' as SeedMediaKey,
      bannerKey: 'brand.google.banner' as SeedMediaKey
    },
    {
      name: 'Sony',
      description: 'Audio, video and gaming electronics',
      logoKey: 'brand.sony.logo' as SeedMediaKey,
      bannerKey: 'brand.sony.banner' as SeedMediaKey
    },
    {
      name: 'Bose',
      description: 'Premium audio equipment manufacturer',
      logoKey: 'brand.bose.logo' as SeedMediaKey,
      bannerKey: 'brand.bose.banner' as SeedMediaKey
    },
    {
      name: 'Logitech',
      description: 'Computer peripherals and accessories',
      logoKey: 'brand.logitech.logo' as SeedMediaKey,
      bannerKey: 'brand.logitech.banner' as SeedMediaKey
    },
    {
      name: 'Canon',
      description: 'Imaging and optical products',
      logoKey: 'brand.canon.logo' as SeedMediaKey,
      bannerKey: 'brand.canon.banner' as SeedMediaKey
    },
    {
      name: 'DJI',
      description: 'Drone and camera technology',
      logoKey: 'brand.dji.logo' as SeedMediaKey,
      bannerKey: 'brand.dji.banner' as SeedMediaKey
    },
  ]
  
  for (const brandConfig of electronicsBrands) {
    await ensureBrand({
      name: brandConfig.name,
      categoryId: electronicsBrandCat.id,
      description: brandConfig.description,
      logoKey: brandConfig.logoKey,
      bannerKey: brandConfig.bannerKey
    })
  }
  
  console.log(`  ✅ Electronics: ${electronicsBrands.length} brand oluşturuldu`)
  
  // 3. Beauty Brands
  const beautyBrands = [
    {
      name: 'CeraVe',
      description: 'Dermatologist-developed skincare',
      logoKey: 'brand.cerave.logo' as SeedMediaKey,
      bannerKey: 'brand.cerave.banner' as SeedMediaKey
    },
    {
      name: 'La Roche-Posay',
      description: 'Dermatological skincare brand',
      logoKey: 'brand.laroche.logo' as SeedMediaKey,
      bannerKey: 'brand.laroche.banner' as SeedMediaKey
    },
    {
      name: 'The Ordinary',
      description: 'Clinical skincare formulations',
      logoKey: 'brand.ordinary.logo' as SeedMediaKey,
      bannerKey: 'brand.ordinary.banner' as SeedMediaKey
    },
    {
      name: 'MAC',
      description: 'Professional makeup and cosmetics',
      logoKey: 'brand.mac.logo' as SeedMediaKey,
      bannerKey: 'brand.mac.banner' as SeedMediaKey
    },
    {
      name: 'Maybelline',
      description: 'Affordable makeup and beauty',
      logoKey: 'brand.maybelline.logo' as SeedMediaKey,
      bannerKey: 'brand.maybelline.banner' as SeedMediaKey
    },
    {
      name: "L'Oréal",
      description: 'Beauty and personal care',
      logoKey: 'brand.loreal.logo' as SeedMediaKey,
      bannerKey: 'brand.loreal.banner' as SeedMediaKey
    },
    {
      name: 'NYX',
      description: 'Professional makeup brand',
      logoKey: 'brand.nyx.logo' as SeedMediaKey,
      bannerKey: 'brand.nyx.banner' as SeedMediaKey
    },
    {
      name: 'Flormar',
      description: 'Trendy cosmetics and makeup',
      logoKey: 'brand.flormar.logo' as SeedMediaKey,
      bannerKey: 'brand.flormar.banner' as SeedMediaKey
    },
    {
      name: 'Chanel',
      description: 'Luxury fashion and beauty',
      logoKey: 'brand.chanel.logo' as SeedMediaKey,
      bannerKey: 'brand.chanel.banner' as SeedMediaKey
    },
    {
      name: 'Dior',
      description: 'Luxury cosmetics and fragrance',
      logoKey: 'brand.dior.logo' as SeedMediaKey,
      bannerKey: 'brand.dior.banner' as SeedMediaKey
    },
    {
      name: 'Pantene',
      description: 'Haircare and styling products',
      logoKey: 'brand.pantene.logo' as SeedMediaKey,
      bannerKey: 'brand.pantene.banner' as SeedMediaKey
    },
    {
      name: 'Dove',
      description: 'Personal care and beauty',
      logoKey: 'brand.dove.logo' as SeedMediaKey,
      bannerKey: 'brand.dove.banner' as SeedMediaKey
    },
    {
      name: 'Nivea',
      description: 'Skincare and body care',
      logoKey: 'brand.nivea.logo' as SeedMediaKey,
      bannerKey: 'brand.nivea.banner' as SeedMediaKey
    },
  ]
  
  for (const brandConfig of beautyBrands) {
    await ensureBrand({
      name: brandConfig.name,
      categoryId: beautyBrandCat.id,
      description: brandConfig.description,
      logoKey: brandConfig.logoKey,
      bannerKey: brandConfig.bannerKey
    })
  }
  
  console.log(`  ✅ Beauty: ${beautyBrands.length} brand oluşturuldu`)
  
  console.log('\n═'.repeat(80))
  console.log(`\n✨ Toplam: 2 brand category, ${electronicsBrands.length + beautyBrands.length} brand\n`)
}

/**
 * Seed Products - Her ProductGroup için anlamlı ürünler oluşturur
 * ~1000 ürün, her biri brand ilişkili
 */
async function seedProducts(): Promise<void> {
  console.log('\n📦 Ürünler Oluşturuluyor...\n')
  
  let totalProducts = 0
  
  console.log('📱 Phones kategorisi ürünleri...')
  
  const iphoneSeries = await prisma.productGroup.findFirst({
    where: { name: 'iPhone Series' }
  })
  
  if (iphoneSeries) {
    for (let i = 1; i <= 25; i++) {
      await ensureProduct({
        name: `iPhone Pro Model ${i}`,
        brand: 'Apple',
        groupId: iphoneSeries.id,
        description: `Premium smartphone model ${i}`
      })
      totalProducts++
    }
  }
  
  const samsungGalaxy = await prisma.productGroup.findFirst({
    where: { name: 'Samsung Galaxy' }
  })
  
  if (samsungGalaxy) {
    for (let i = 1; i <= 25; i++) {
      await ensureProduct({
        name: `Galaxy Premium Model ${i}`,
        brand: 'Samsung',
        groupId: samsungGalaxy.id,
        description: `Samsung flagship smartphone ${i}`
      })
      totalProducts++
    }
  }
  
  const googlePixel = await prisma.productGroup.findFirst({
    where: { name: 'Google Pixel' }
  })
  
  if (googlePixel) {
    for (let i = 1; i <= 20; i++) {
      await ensureProduct({
        name: `Pixel Smart Model ${i}`,
        brand: 'Google',
        groupId: googlePixel.id,
        description: `Google Pixel smartphone ${i}`
      })
      totalProducts++
    }
  }
  
  const onePlus = await prisma.productGroup.findFirst({
    where: { name: 'OnePlus Devices' }
  })
  
  if (onePlus) {
    for (let i = 1; i <= 15; i++) {
      await ensureProduct({
        name: `OnePlus Performance ${i}`,
        brand: 'OnePlus',
        groupId: onePlus.id,
        description: `OnePlus device model ${i}`
      })
      totalProducts++
    }
  }
  
  console.log(`  ✅ Phones: ${totalProducts} ürün`)
  
  console.log('💻 Laptops kategorisi ürünleri...')
  const laptopStart = totalProducts
  
  const macbook = await prisma.productGroup.findFirst({ where: { name: 'MacBook' } })
  if (macbook) {
    for (let i = 1; i <= 20; i++) {
      await ensureProduct({ name: `MacBook Pro Model ${i}`, brand: 'Apple', groupId: macbook.id, description: `Premium Apple laptop ${i}` })
      totalProducts++
    }
  }
  
  const dell = await prisma.productGroup.findFirst({ where: { name: 'Dell Laptops' } })
  if (dell) {
    for (let i = 1; i <= 18; i++) {
      await ensureProduct({ name: `Dell Workstation ${i}`, brand: 'Dell', groupId: dell.id, description: `Dell laptop model ${i}` })
      totalProducts++
    }
  }
  
  const hp = await prisma.productGroup.findFirst({ where: { name: 'HP Laptops' } })
  if (hp) {
    for (let i = 1; i <= 15; i++) {
      await ensureProduct({ name: `HP Performance ${i}`, brand: 'HP', groupId: hp.id, description: `HP laptop ${i}` })
      totalProducts++
    }
  }
  
  const lenovo = await prisma.productGroup.findFirst({ where: { name: 'Lenovo Laptops' } })
  if (lenovo) {
    for (let i = 1; i <= 17; i++) {
      await ensureProduct({ name: `Lenovo ThinkBook ${i}`, brand: 'Lenovo', groupId: lenovo.id, description: `Lenovo laptop ${i}` })
      totalProducts++
    }
  }
  
  console.log(`  ✅ Laptops: ${totalProducts - laptopStart} ürün`)
  
  console.log('📱 Tablets kategorisi ürünleri...')
  const tabletStart = totalProducts
  
  const ipad = await prisma.productGroup.findFirst({ where: { name: 'iPad' } })
  if (ipad) {
    for (let i = 1; i <= 20; i++) {
      await ensureProduct({ name: `iPad Pro ${i}`, brand: 'Apple', groupId: ipad.id, description: `Apple tablet model ${i}` })
      totalProducts++
    }
  }
  
  const samsungTab = await prisma.productGroup.findFirst({ where: { name: 'Samsung Tab' } })
  if (samsungTab) {
    for (let i = 1; i <= 15; i++) {
      await ensureProduct({ name: `Galaxy Tab ${i}`, brand: 'Samsung', groupId: samsungTab.id, description: `Samsung tablet ${i}` })
      totalProducts++
    }
  }
  
  const surface = await prisma.productGroup.findFirst({ where: { name: 'Surface' } })
  if (surface) {
    for (let i = 1; i <= 12; i++) {
      await ensureProduct({ name: `Surface Device ${i}`, brand: 'Microsoft', groupId: surface.id, description: `Microsoft tablet ${i}` })
      totalProducts++
    }
  }
  
  console.log(`  ✅ Tablets: ${totalProducts - tabletStart} ürün`)
  
  console.log('🎧 Audio kategorisi ürünleri...')
  const audioStart = totalProducts
  
  const headphones = await prisma.productGroup.findFirst({ where: { name: 'Headphones' } })
  if (headphones) {
    for (let i = 1; i <= 12; i++) {
      const brand = i % 2 === 0 ? 'Sony' : 'Bose'
      await ensureProduct({ name: `Premium Headphones ${i}`, brand, groupId: headphones.id, description: `Noise canceling headphones ${i}` })
      totalProducts++
    }
  }
  
  const earbuds = await prisma.productGroup.findFirst({ where: { name: 'Earbuds' } })
  if (earbuds) {
    for (let i = 1; i <= 12; i++) {
      const brand = i <= 4 ? 'Apple' : (i <= 8 ? 'Samsung' : 'Sony')
      await ensureProduct({ name: `Wireless Earbuds ${i}`, brand, groupId: earbuds.id, description: `True wireless earbuds ${i}` })
      totalProducts++
    }
  }
  
  const speakers = await prisma.productGroup.findFirst({ where: { name: 'Speakers' } })
  if (speakers) {
    for (let i = 1; i <= 10; i++) {
      const brand = i % 2 === 0 ? 'Bose' : 'Sony'
      await ensureProduct({ name: `Bluetooth Speaker ${i}`, brand, groupId: speakers.id, description: `Portable speaker ${i}` })
      totalProducts++
    }
  }
  
  const soundbars = await prisma.productGroup.findFirst({ where: { name: 'Soundbars' } })
  if (soundbars) {
    for (let i = 1; i <= 8; i++) {
      const brand = i % 2 === 0 ? 'Bose' : 'Sony'
      await ensureProduct({ name: `Home Soundbar ${i}`, brand, groupId: soundbars.id, description: `Dolby Atmos soundbar ${i}` })
      totalProducts++
    }
  }
  
  console.log(`  ✅ Audio: ${totalProducts - audioStart} ürün`)
  
  console.log('⌚ Wearables kategorisi ürünleri...')
  const wearableStart = totalProducts
  
  const appleWatch = await prisma.productGroup.findFirst({ where: { name: 'Apple Watch' } })
  if (appleWatch) {
    for (let i = 1; i <= 12; i++) {
      await ensureProduct({ name: `Apple Watch Series ${i}`, brand: 'Apple', groupId: appleWatch.id, description: `Smartwatch model ${i}` })
      totalProducts++
    }
  }
  
  const galaxyWatch = await prisma.productGroup.findFirst({ where: { name: 'Samsung Galaxy Watch' } })
  if (galaxyWatch) {
    for (let i = 1; i <= 10; i++) {
      await ensureProduct({ name: `Galaxy Watch ${i}`, brand: 'Samsung', groupId: galaxyWatch.id, description: `Samsung smartwatch ${i}` })
      totalProducts++
    }
  }
  
  const fitnessTrackers = await prisma.productGroup.findFirst({ where: { name: 'Fitness Trackers' } })
  if (fitnessTrackers) {
    for (let i = 1; i <= 8; i++) {
      await ensureProduct({ name: `Fitness Band ${i}`, brand: 'Fitbit', groupId: fitnessTrackers.id, description: `Fitness tracker ${i}` })
      totalProducts++
    }
  }
  
  console.log(`  ✅ Wearables: ${totalProducts - wearableStart} ürün`)
  
  console.log('🔌 Accessories kategorisi ürünleri...')
  const accessoryStart = totalProducts
  
  const chargers = await prisma.productGroup.findFirst({ where: { name: 'Chargers' } })
  if (chargers) {
    for (let i = 1; i <= 10; i++) {
      const brand = i <= 5 ? 'Apple' : 'Samsung'
      await ensureProduct({ name: `Fast Charger ${i}W`, brand, groupId: chargers.id, description: `USB-C charger ${i}` })
      totalProducts++
    }
  }
  
  const cases = await prisma.productGroup.findFirst({ where: { name: 'Cases' } })
  if (cases) {
    for (let i = 1; i <= 10; i++) {
      await ensureProduct({ name: `Protective Case ${i}`, brand: 'Apple', groupId: cases.id, description: `Phone case model ${i}` })
      totalProducts++
    }
  }
  
  const cables = await prisma.productGroup.findFirst({ where: { name: 'Cables' } })
  if (cables) {
    for (let i = 1; i <= 8; i++) {
      await ensureProduct({ name: `USB-C Cable ${i}m`, brand: 'Apple', groupId: cables.id, description: `Charging cable ${i}` })
      totalProducts++
    }
  }
  
  const screenProtectors = await prisma.productGroup.findFirst({ where: { name: 'Screen Protectors' } })
  if (screenProtectors) {
    for (let i = 1; i <= 6; i++) {
      await ensureProduct({ name: `Screen Guard ${i}`, brand: 'Generic', groupId: screenProtectors.id, description: `Tempered glass ${i}` })
      totalProducts++
    }
  }
  
  console.log(`  ✅ Accessories: ${totalProducts - accessoryStart} ürün`)
  
  console.log('📷 Cameras kategorisi ürünleri...')
  const cameraStart = totalProducts
  
  const dslr = await prisma.productGroup.findFirst({ where: { name: 'DSLR Cameras' } })
  if (dslr) {
    for (let i = 1; i <= 10; i++) {
      const brand = i % 2 === 0 ? 'Canon' : 'Sony'
      await ensureProduct({ name: `DSLR Camera ${i}`, brand, groupId: dslr.id, description: `Professional DSLR ${i}` })
      totalProducts++
    }
  }
  
  const mirrorless = await prisma.productGroup.findFirst({ where: { name: 'Mirrorless Cameras' } })
  if (mirrorless) {
    for (let i = 1; i <= 10; i++) {
      const brand = i % 2 === 0 ? 'Canon' : 'Sony'
      await ensureProduct({ name: `Mirrorless Camera ${i}`, brand, groupId: mirrorless.id, description: `Mirrorless model ${i}` })
      totalProducts++
    }
  }
  
  const actionCam = await prisma.productGroup.findFirst({ where: { name: 'Action Cameras' } })
  if (actionCam) {
    for (let i = 1; i <= 10; i++) {
      await ensureProduct({ name: `Action Cam ${i}`, brand: 'GoPro', groupId: actionCam.id, description: `Action camera ${i}` })
      totalProducts++
    }
  }
  
  const drones = await prisma.productGroup.findFirst({ where: { name: 'Drones' } })
  if (drones) {
    for (let i = 1; i <= 10; i++) {
      await ensureProduct({ name: `Drone Model ${i}`, brand: 'DJI', groupId: drones.id, description: `Camera drone ${i}` })
      totalProducts++
    }
  }
  
  console.log(`  ✅ Cameras: ${totalProducts - cameraStart} ürün`)
  
  const electronicsTotal = totalProducts
  console.log(`\n📱 Electronics Toplam: ${electronicsTotal} ürün\n`)
  console.log('💄 Beauty ürünleri ekleniyor...\n')
  
  console.log('🧴 Skincare kategorisi ürünleri...')
  const skincareStart = totalProducts
  
  const cleansers = await prisma.productGroup.findFirst({ where: { name: 'Cleansers' } })
  if (cleansers) {
    for (let i = 1; i <= 20; i++) {
      const brand = i <= 7 ? 'CeraVe' : (i <= 14 ? 'La Roche-Posay' : 'The Ordinary')
      await ensureProduct({ name: `Facial Cleanser ${i}`, brand, groupId: cleansers.id, description: `Gentle cleanser ${i}` })
      totalProducts++
    }
  }
  
  const moisturizers = await prisma.productGroup.findFirst({ where: { name: 'Moisturizers' } })
  if (moisturizers) {
    for (let i = 1; i <= 20; i++) {
      const brand = i <= 7 ? 'CeraVe' : (i <= 14 ? 'La Roche-Posay' : 'The Ordinary')
      await ensureProduct({ name: `Face Moisturizer ${i}`, brand, groupId: moisturizers.id, description: `Hydrating cream ${i}` })
      totalProducts++
    }
  }
  
  const serums = await prisma.productGroup.findFirst({ where: { name: 'Serums' } })
  if (serums) {
    for (let i = 1; i <= 25; i++) {
      const brand = i <= 18 ? 'The Ordinary' : 'La Roche-Posay'
      await ensureProduct({ name: `Serum Formula ${i}`, brand, groupId: serums.id, description: `Treatment serum ${i}` })
      totalProducts++
    }
  }
  
  const sunscreen = await prisma.productGroup.findFirst({ where: { name: 'Sunscreen' } })
  if (sunscreen) {
    for (let i = 1; i <= 20; i++) {
      const brand = i % 2 === 0 ? 'La Roche-Posay' : 'CeraVe'
      await ensureProduct({ name: `SPF ${30 + i} Sunscreen`, brand, groupId: sunscreen.id, description: `Sun protection ${i}` })
      totalProducts++
    }
  }
  
  const masks = await prisma.productGroup.findFirst({ where: { name: 'Masks' } })
  if (masks) {
    for (let i = 1; i <= 15; i++) {
      await ensureProduct({ name: `Face Mask ${i}`, brand: 'The Ordinary', groupId: masks.id, description: `Treatment mask ${i}` })
      totalProducts++
    }
  }
  
  console.log(`  ✅ Skincare: ${totalProducts - skincareStart} ürün`)
  
  console.log('💄 Makeup kategorisi ürünleri...')
  const makeupStart = totalProducts
  
  const foundation = await prisma.productGroup.findFirst({ where: { name: 'Foundation' } })
  if (foundation) {
    for (let i = 1; i <= 120; i++) {
      const brand = i <= 40 ? 'MAC' : (i <= 80 ? 'Maybelline' : "L'Oréal")
      await ensureProduct({ name: `Foundation Shade ${i}`, brand, groupId: foundation.id, description: `Foundation tone ${i}` })
      totalProducts++
    }
  }
  
  const lipstick = await prisma.productGroup.findFirst({ where: { name: 'Lipstick' } })
  if (lipstick) {
    for (let i = 1; i <= 100; i++) {
      const brand = i <= 30 ? 'MAC' : (i <= 60 ? 'Maybelline' : (i <= 85 ? "L'Oréal" : 'NYX'))
      await ensureProduct({ name: `Lipstick Color ${i}`, brand, groupId: lipstick.id, description: `Lip color ${i}` })
      totalProducts++
    }
  }
  
  const mascara = await prisma.productGroup.findFirst({ where: { name: 'Mascara' } })
  if (mascara) {
    for (let i = 1; i <= 60; i++) {
      const brand = i <= 25 ? 'Maybelline' : (i <= 45 ? "L'Oréal" : 'NYX')
      await ensureProduct({ name: `Mascara Formula ${i}`, brand, groupId: mascara.id, description: `Volumizing mascara ${i}` })
      totalProducts++
    }
  }
  
  const eyeshadow = await prisma.productGroup.findFirst({ where: { name: 'Eyeshadow' } })
  if (eyeshadow) {
    for (let i = 1; i <= 80; i++) {
      const brand = i <= 40 ? 'NYX' : "L'Oréal"
      await ensureProduct({ name: `Eyeshadow Palette ${i}`, brand, groupId: eyeshadow.id, description: `Eye color ${i}` })
      totalProducts++
    }
  }
  
  const blush = await prisma.productGroup.findFirst({ where: { name: 'Blush' } })
  if (blush) {
    for (let i = 1; i <= 40; i++) {
      const brand = i <= 15 ? 'MAC' : (i <= 28 ? 'Maybelline' : 'NYX')
      await ensureProduct({ name: `Blush Shade ${i}`, brand, groupId: blush.id, description: `Cheek color ${i}` })
      totalProducts++
    }
  }
  
  console.log(`  ✅ Makeup: ${totalProducts - makeupStart} ürün`)
  
  console.log('🌸 Diğer Beauty kategorileri ürünleri...')
  const otherBeautyStart = totalProducts
  
  const perfume = await prisma.productGroup.findFirst({ where: { name: 'Perfume' } })
  if (perfume) {
    for (let i = 1; i <= 20; i++) {
      const brand = i % 2 === 0 ? 'Chanel' : 'Dior'
      await ensureProduct({ name: `Perfume ${i}`, brand, groupId: perfume.id, description: `Fragrance ${i}` })
      totalProducts++
    }
  }
  
  const cologne = await prisma.productGroup.findFirst({ where: { name: 'Cologne' } })
  if (cologne) {
    for (let i = 1; i <= 15; i++) {
      const brand = i % 2 === 0 ? 'Chanel' : 'Dior'
      await ensureProduct({ name: `Cologne ${i}`, brand, groupId: cologne.id, description: `Men's fragrance ${i}` })
      totalProducts++
    }
  }
  
  const bodySpray = await prisma.productGroup.findFirst({ where: { name: 'Body Spray' } })
  if (bodySpray) {
    for (let i = 1; i <= 10; i++) {
      await ensureProduct({ name: `Body Mist ${i}`, brand: 'Flormar', groupId: bodySpray.id, description: `Body spray ${i}` })
      totalProducts++
    }
  }
  
  const shampoo = await prisma.productGroup.findFirst({ where: { name: 'Shampoo' } })
  if (shampoo) {
    for (let i = 1; i <= 15; i++) {
      const brand = i % 2 === 0 ? 'Pantene' : "L'Oréal"
      await ensureProduct({ name: `Shampoo ${i}`, brand, groupId: shampoo.id, description: `Hair shampoo ${i}` })
      totalProducts++
    }
  }
  
  const conditioner = await prisma.productGroup.findFirst({ where: { name: 'Conditioner' } })
  if (conditioner) {
    for (let i = 1; i <= 12; i++) {
      await ensureProduct({ name: `Conditioner ${i}`, brand: 'Pantene', groupId: conditioner.id, description: `Hair conditioner ${i}` })
      totalProducts++
    }
  }
  
  const stylingProducts = await prisma.productGroup.findFirst({ where: { name: 'Styling Products' } })
  if (stylingProducts) {
    for (let i = 1; i <= 8; i++) {
      await ensureProduct({ name: `Hair Gel ${i}`, brand: "L'Oréal", groupId: stylingProducts.id, description: `Styling product ${i}` })
      totalProducts++
    }
  }
  
  const hairTreatments = await prisma.productGroup.findFirst({ where: { name: 'Hair Treatments' } })
  if (hairTreatments) {
    for (let i = 1; i <= 5; i++) {
      await ensureProduct({ name: `Hair Mask ${i}`, brand: 'Pantene', groupId: hairTreatments.id, description: `Hair treatment ${i}` })
      totalProducts++
    }
  }
  
  const deodorant = await prisma.productGroup.findFirst({ where: { name: 'Deodorant' } })
  if (deodorant) {
    for (let i = 1; i <= 15; i++) {
      const brand = i % 2 === 0 ? 'Dove' : 'Nivea'
      await ensureProduct({ name: `Deodorant ${i}`, brand, groupId: deodorant.id, description: `Antiperspirant ${i}` })
      totalProducts++
    }
  }
  
  const bodyWash = await prisma.productGroup.findFirst({ where: { name: 'Body Wash' } })
  if (bodyWash) {
    for (let i = 1; i <= 12; i++) {
      const brand = i % 2 === 0 ? 'Dove' : 'Nivea'
      await ensureProduct({ name: `Body Wash ${i}`, brand, groupId: bodyWash.id, description: `Shower gel ${i}` })
      totalProducts++
    }
  }
  
  const handCream = await prisma.productGroup.findFirst({ where: { name: 'Hand Cream' } })
  if (handCream) {
    for (let i = 1; i <= 8; i++) {
      await ensureProduct({ name: `Hand Cream ${i}`, brand: 'Nivea', groupId: handCream.id, description: `Hand lotion ${i}` })
      totalProducts++
    }
  }
  
  const bodyLotion = await prisma.productGroup.findFirst({ where: { name: 'Body Lotion' } })
  if (bodyLotion) {
    for (let i = 1; i <= 5; i++) {
      await ensureProduct({ name: `Body Lotion ${i}`, brand: 'Dove', groupId: bodyLotion.id, description: `Body moisturizer ${i}` })
      totalProducts++
    }
  }
  
  const nailPolish = await prisma.productGroup.findFirst({ where: { name: 'Nail Polish' } })
  if (nailPolish) {
    for (let i = 1; i <= 25; i++) {
      await ensureProduct({ name: `Nail Polish Color ${i}`, brand: 'Flormar', groupId: nailPolish.id, description: `Nail enamel ${i}` })
      totalProducts++
    }
  }
  
  const nailTreatment = await prisma.productGroup.findFirst({ where: { name: 'Nail Treatment' } })
  if (nailTreatment) {
    for (let i = 1; i <= 3; i++) {
      await ensureProduct({ name: `Nail Treatment ${i}`, brand: 'Flormar', groupId: nailTreatment.id, description: `Nail care ${i}` })
      totalProducts++
    }
  }
  
  const nailTools = await prisma.productGroup.findFirst({ where: { name: 'Nail Tools' } })
  if (nailTools) {
    for (let i = 1; i <= 2; i++) {
      await ensureProduct({ name: `Nail Tool Set ${i}`, brand: 'Generic', groupId: nailTools.id, description: `Nail tools ${i}` })
      totalProducts++
    }
  }
  
  const shavingProducts = await prisma.productGroup.findFirst({ where: { name: 'Shaving Products' } })
  if (shavingProducts) {
    for (let i = 1; i <= 10; i++) {
      await ensureProduct({ name: `Shaving Product ${i}`, brand: 'Nivea', groupId: shavingProducts.id, description: `Shaving care ${i}` })
      totalProducts++
    }
  }
  
  const mensSkincare = await prisma.productGroup.findFirst({ where: { name: "Men's Skincare" } })
  if (mensSkincare) {
    for (let i = 1; i <= 6; i++) {
      await ensureProduct({ name: `Men's Face Care ${i}`, brand: 'Nivea', groupId: mensSkincare.id, description: `Men's skincare ${i}` })
      totalProducts++
    }
  }
  
  const mensHaircare = await prisma.productGroup.findFirst({ where: { name: "Men's Haircare" } })
  if (mensHaircare) {
    for (let i = 1; i <= 4; i++) {
      const brand = i % 2 === 0 ? "L'Oréal" : 'Dove'
      await ensureProduct({ name: `Men's Hair Product ${i}`, brand, groupId: mensHaircare.id, description: `Men's haircare ${i}` })
      totalProducts++
    }
  }
  
  console.log(`  ✅ Diğer Beauty: ${totalProducts - otherBeautyStart} ürün`)
  
  const beautyTotal = totalProducts - electronicsTotal
  console.log(`\n💄 Beauty Toplam: ${beautyTotal} ürün\n`)
  
  console.log('═'.repeat(80))
  console.log(`\n✨ TOPLAM: ${totalProducts} ürün oluşturuldu`)
  console.log(`   📱 Electronics: ${electronicsTotal} ürün`)
  console.log(`   💄 Beauty: ${beautyTotal} ürün\n`)
}

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
  
  const users = await prisma.user.findMany({ take: 40 })
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
 * 2800 Post oluştur (40 kullanıcı x 70 post)
 */
async function seedPosts() {
  console.log('\n📝 Post oluşturma başlıyor...\n')
  
  // Kullanıcıları getir
  const users = await prisma.user.findMany({
    take: 40,
    orderBy: { createdAt: 'asc' }
  })
  
  if (users.length < 40) {
    console.log(`⚠️ Sadece ${users.length} kullanıcı bulundu, devam ediliyor...`)
  }
  
  // Experience taxonomy'leri getir
  const durations = await prisma.experienceDuration.findMany()
  const locations = await prisma.experienceLocation.findMany()
  const purposes = await prisma.experiencePurpose.findMany()
  
  // Ürünleri getir (category bilgileri ile birlikte - yeni hierarchical Category yapısı)
  const products = await prisma.product.findMany({
    take: 500,
    include: {
      category: {
        select: {
          id: true,
          name: true,
          mpath: true,
          parentId: true
        }
      }
    }
  })
  
  if (products.length === 0) {
    throw new Error('❌ Ürün bulunamadı! Önce Phase 5 tamamlanmalı.')
  }
  
  let totalPosts = 0
  const postTypes: Array<'QUESTION' | 'TIPS' | 'FREE' | 'EXPERIENCE' | 'COMPARE' | 'UPDATE'> = [
    'QUESTION', 'TIPS', 'FREE', 'EXPERIENCE', 'COMPARE', 'UPDATE'
  ]
  
  // Her kullanıcı için random sayıda post
  for (const user of users) {
    // murat ve nil için post oluşturma
    if (user.email === 'murat@tipbox.co' || user.email === 'nil@tipbox.co') {
      console.log(`  ⏭️  ${user.email} için post oluşturma atlanıyor (boş profil)`)
      continue
    }
    
    console.log(`  📝 ${user.email} için postlar oluşturuluyor...`)
    
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
            }
          }
        }
      }
    })
    
    let userPostCount = 0
    
    // Her tipten random sayıda post oluştur
    for (const postType of postTypes) {
      // Her tipten 1-8 arası random sayıda post
      const postCountForType = Math.floor(Math.random() * 8) + 1 // 1-8 arası
      
      for (let i = 1; i <= postCountForType; i++) {
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
        
        const post = await createPost({
          userId: user.id,
          type: postType,
          title: `${postType} Post ${i} - ${selectedProduct.name}`,
          body: `Bu bir ${postType} tipi içerik. ${selectedProduct.name} hakkında detaylı bilgi ve deneyimler paylaşılıyor. Ürünü kullanma deneyimim oldukça olumlu oldu. Kaliteli malzeme ve iyi tasarım dikkat çekiyor.`,
          productId: selectedProduct.id,
          categoryId: selectedProduct.categoryId || undefined, // Product'ın categoryId'sini ekle
          productGroupId: selectedProduct.groupId ?? undefined,
          mainCategoryId: undefined, // Legacy - deprecated
          subCategoryId: undefined, // Legacy - deprecated
          inventoryRequired: postType === 'EXPERIENCE' || postType === 'UPDATE',
          createdAt,
        })
        
        // Post tipine göre ilişkili kayıtlar oluştur
        if (postType === 'QUESTION') {
          await createPostQuestion(post.id, selectedProduct.id)
        } else if (postType === 'TIPS') {
          await createPostTip(post.id)
        } else if (postType === 'COMPARE') {
          const product2 = products[Math.floor(Math.random() * products.length)]
          await createPostComparison(post.id, selectedProduct.id, product2.id)
        } else if (postType === 'EXPERIENCE' && durations.length > 0 && locations.length > 0 && purposes.length > 0) {
          const randomDuration = durations[Math.floor(Math.random() * durations.length)]
          const randomLocation = locations[Math.floor(Math.random() * locations.length)]
          const randomPurpose = purposes[Math.floor(Math.random() * purposes.length)]
          await addExperienceRelations(post.id, randomDuration.id, randomLocation.id, randomPurpose.id)
        }
        
        // PostMedia ekle (bazı postlara)
        if (Math.random() > 0.7) { // %30 şansla media ekle
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
                userId: user.id,
                mediaUrl,
                orderIndex: 1,
              }
            })
          }
        }
        
        totalPosts++
        userPostCount++
      }
    }
    
    console.log(`    ✅ ${user.email}: ${userPostCount} post oluşturuldu`)
    
    // Kullanıcının profile postsCount'unu güncelle
    await prisma.profile.update({
      where: { userId: user.id },
      data: { postsCount: userPostCount }
    }).catch(() => {
      console.warn(`⚠️ ${user.email} için profile postsCount güncellenemedi`)
    })
  }
  
  console.log(`\n✨ Toplam ${totalPosts} post oluşturuldu!\n`)
  console.log(`   📊 Kullanıcı sayısı: ${users.length}`)
  console.log(`   📝 Her kullanıcı: Her tipten 1-8 arası random sayıda post\n`)
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
 * WishboxEvent oluştur (10-15 kaliteli, gerçekçi event)
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
    // ACTIVE EVENTS - ELEKTRONİK
    {
      title: 'Akıllı Telefon Batarya Performansı',
      description: 'Hangi telefon en uzun süre dayanıyor? Günlük kullanımda gerçek batarya deneyiminizi paylaşın. Normal kullanımda kaç saat?, yoğun kullanımda ne kadar?, hızlı şarj var mı?',
      categoryId: electronicsCategory?.id,
      imageKey: 'event.event-batarya', // event-batarya.png
      startDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: true,
      products: electronicsProducts.filter(p => p.name.toLowerCase().includes('phone') || p.name.toLowerCase().includes('iphone') || p.name.toLowerCase().includes('galaxy'))
    },
    {
      title: 'Laptop ile Uzaktan Çalışma Deneyimi',
      description: 'Evden çalışırken hangi laptop daha verimli? Performans, klavye konforu, ekran kalitesi, taşınabilirlik... Tüm detayları paylaşın.',
      categoryId: electronicsCategory?.id,
      imageKey: 'event.event-tablet', // Laptop için tablet görselini kullan (uygun görsel)
      startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: true,
      products: electronicsProducts.filter(p => p.name.toLowerCase().includes('macbook') || p.name.toLowerCase().includes('laptop'))
    },
    {
      title: 'Kablosuz Kulaklık Ses Kalitesi Testi',
      description: 'Hangi kulaklık en iyi ses deneyimini sunuyor? Bas performansı, gürültü engelleme, konfor, batarya ömrü... Deneyimlerinizi karşılaştırın.',
      categoryId: electronicsCategory?.id,
      imageKey: 'event.event-akillisaat', // Akıllı saat görseli (wearable kategorisi)
      startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: true,
      products: electronicsProducts.filter(p => p.name.toLowerCase().includes('airpods') || p.name.toLowerCase().includes('buds') || p.name.toLowerCase().includes('earbuds'))
    },
    {
      title: 'Akıllı Saat Spor Takibi Karşılaştırması',
      description: 'Spor yaparken hangi akıllı saat daha doğru ölçüm yapıyor? Kalp atışı, adım sayacı, GPS doğruluğu, uyku takibi... Gerçek kullanım deneyimleriniz.',
      categoryId: electronicsCategory?.id,
      imageKey: 'event.event-akillisaat', // event-akillisaat.png
      startDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: true,
      products: electronicsProducts.filter(p => p.name.toLowerCase().includes('watch'))
    },
    {
      title: 'Tablet Kullanım Senaryoları',
      description: 'Tablet ile neler yapıyorsunuz? İzleme, okuma, çizim, not alma... Hangi tablet hangi iş için daha uygun? Deneyimlerinizi paylaşın.',
      categoryId: electronicsCategory?.id,
      imageKey: 'event.event-tablet', // event-tablet.png
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: true,
      products: electronicsProducts.filter(p => p.name.toLowerCase().includes('ipad') || p.name.toLowerCase().includes('tablet'))
    },
    
    // ACTIVE EVENTS - BEAUTY
    {
      title: 'Günlük Cilt Bakım Rutini Paylaşımı',
      description: 'Sabah ve akşam cilt bakımınızda hangi ürünleri kullanıyorsunuz? Sırası, etkileri, sonuçları... Kendi rutininizi paylaşın, başkalarından ilham alın.',
      categoryId: beautyCategory?.id,
      imageKey: 'event.event-ciltbakim', // event-ciltbakim.png
      startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: true,
      products: beautyProducts.filter(p => p.name.toLowerCase().includes('serum') || p.name.toLowerCase().includes('cream') || p.name.toLowerCase().includes('moisturizer'))
    },
    {
      title: 'Yağlı Ciltler İçin En İyi Ürünler',
      description: 'Yağlı cilde sahipseniz hangi ürünler işe yarıyor? Matlaştırıcı etkisi olan, gözenekleri sıkılaştıran, yağ dengesini koruyan ürünler...',
      categoryId: beautyCategory?.id,
      imageKey: 'event.event-yaglicilt', // event-yaglicilt.png
      startDate: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 19 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: true,
      products: beautyProducts.slice(0, 10)
    },
    {
      title: 'Kalıcı Makyaj Ürünleri Testi',
      description: 'Gün boyu kalıcı kalan makyaj ürünleri hangileri? Fondöten, ruj, maskara... Yaz sıcağında, uzun iş gününde test ettiklerinizi paylaşın.',
      categoryId: beautyCategory?.id,
      imageKey: 'event.event-kalicimakyaj', // event-kalicimakyaj.png
      startDate: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: true,
      products: beautyProducts.filter(p => p.name.toLowerCase().includes('lipstick') || p.name.toLowerCase().includes('foundation') || p.name.toLowerCase().includes('mascara'))
    },
    
    // UPCOMING EVENTS - ELEKTRONİK
    {
      title: 'Oyun Performansı: Hangi Cihaz Daha İyi?',
      description: 'Mobil oyunlarda hangi telefon/tablet daha iyi performans gösteriyor? FPS, ısınma, batarya tüketimi... Oyuncuların deneyimleri.',
      categoryId: electronicsCategory?.id,
      imageKey: 'event.event-oyun', // event-oyun.png
      startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: false,
      products: electronicsProducts.slice(0, 10)
    },
    {
      title: 'Kamera Performansı: Gece Çekimleri',
      description: 'Düşük ışıkta hangi telefon daha iyi fotoğraf çekiyor? Gece modu, HDR, detay koruma... Gerçek çekim örnekleri ile paylaşın.',
      categoryId: electronicsCategory?.id,
      imageKey: 'event.event-kamera', // event-kamera.png
      startDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 38 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: false,
      products: electronicsProducts.filter(p => p.name.toLowerCase().includes('phone') || p.name.toLowerCase().includes('iphone'))
    },
    
    // UPCOMING EVENTS - BEAUTY
    {
      title: 'Güneşten Korunma: En Etkili SPF Ürünleri',
      description: 'Yaz geliyor! Hangi güneş kremi gerçekten etkili? Beyaz iz bırakmayan, yağlamayan, su geçirmez... Deneyimlerinizi paylaşın.',
      categoryId: beautyCategory?.id,
      imageKey: 'event.event-gunestenkorunma', // event-gunestenkorunma.png
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: false,
      products: beautyProducts.filter(p => p.name.toLowerCase().includes('sunscreen') || p.name.toLowerCase().includes('spf'))
    },
    {
      title: 'Saç Bakım Rutini: Kuru ve Yıpranmış Saçlar',
      description: 'Kuru saçlar için hangi ürünler işe yarıyor? Şampuan, krem, maske, yağ... Etkili olduğunu gördüğünüz ürünleri paylaşın.',
      categoryId: beautyCategory?.id,
      imageKey: 'event.event-sacbakim', // event-sacbakim.png
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
  const eventImagesDir = path.join(__dirname, '../tests/assets/events/new-events')
  
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
  
  for (const config of eventConfigs) {
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
    // Elektronik kategorisi kontrolü
    if (categoryId === electronicsCategory?.id) {
      return eventPostTemplates.electronics;
    }
    
    // Beauty kategorisi kontrolü
    if (categoryId === beautyCategory?.id) {
      return eventPostTemplates.beauty;
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
      'Ben de aynı ürünü kullanıyorum, çok memnunum. Özellikle performans konusunda farkı hemen fark ediyorsunuz.',
      'Çok detaylı bir paylaşım olmuş, teşekkürler. Ben almayı düşünüyordum, karar vermeme yardımcı oldu.',
      'Fiyat/performans dengesi gerçekten iyi mi? Alternatiflerini de inceledim ama tam kararsızım.',
      'Batarya ömrü konusunda katılıyorum. Bende de aynı deneyim var, günlük kullanımda gerçekten yeterli.',
      'Hangi renkten aldınız? Renk seçenekleri hakkında da bilgi verirseniz çok sevinirim.',
      'Garantisi kaç yıl? Servis hizmetleri hakkında bir fikriniz var mı?',
      'Aynı fiyata başka hangi modelleri önerirsiniz? Karşılaştırma yapabilir miyiz?',
      'Çok güzel anlatmışsınız. Ben de sipariş vermeye karar verdim, umarım pişman olmam 😊',
      'Uzun süreli kullanımda herhangi bir sorun yaşadınız mı? İlk izlenim her zaman olumlu oluyor.',
      'Kamera kalitesi hakkında ne düşünüyorsunuz? Fotoğraf çekmek için önemli benim için.',
    ],
    beauty: [
      'Bu ürünü ben de kullanıyorum ve cildimdeki değişim gerçekten çok iyi. Tavsiye ederim.',
      'Hassas ciltler için uygun mu? Cildinizde herhangi bir tahrişe neden oldu mu?',
      'Kokusu nasıl? Bazı ürünler çok keskin kokabiliyor, dayanılmaz oluyor.',
      'Sabah mı akşam mı kullanıyorsunuz? Kullanım sırasına dikkat etmek gerekiyor mu?',
      'Fiyatına göre gerçekten değer mi? Daha ucuz alternatifleri de var gibi.',
      'Ne kadar sürede etkisini görmeye başladınız? Ben de denemek istiyorum ama merak ediyorum.',
      "Hangi yaş grubu için uygun? 30'lu yaşlarda kullanmak mantıklı mı?",
      'Çok güzel bir paylaşım olmuş, detaylı anlatım için teşekkürler. Hemen alıyorum 💕',
      'Yağlı ciltler için de uygun mu? Cildin yağ dengesini bozuyor mu?',
      'Günlük kullanım için pratik mi? Rutine kolayca dahil edilebiliyor mu?',
    ],
    general: [
      'Çok faydalı bir paylaşım olmuş, teşekkürler!',
      'Ben de aynı şeyi düşünüyorum, kesinlikle katılıyorum.',
      'Daha detaylı bilgi verebilir misiniz? Merak ettim.',
      'Süper paylaşım! 👏',
      'Benim için çok yararlı bilgiler, sağ olun.',
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
    const event = await prisma.wishboxEvent.findUnique({
      where: { id: post.eventId! },
      select: { title: true },
    })
    
    let templates = commentTemplates.general
    if (event) {
      const titleLower = event.title.toLowerCase()
      if (titleLower.includes('telefon') || titleLower.includes('laptop') || 
          titleLower.includes('tablet') || titleLower.includes('kulaklık') ||
          titleLower.includes('saat') || titleLower.includes('kamera') || 
          titleLower.includes('oyun') || titleLower.includes('batarya')) {
        templates = commentTemplates.electronics
      } else if (titleLower.includes('cilt') || titleLower.includes('makyaj') || 
                 titleLower.includes('serum') || titleLower.includes('saç') ||
                 titleLower.includes('bakım')) {
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
    const nftCount = Math.floor(Math.random() * 4) + 2 // 2-5 NFT
    
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
    { name: 'Achievement Badges', description: 'Başarı rozetleri' },
    { name: 'Event Badges', description: 'Etkinlik rozetleri' },
    { name: 'Community Badges', description: 'Topluluk rozetleri' },
    { name: 'Special Badges', description: 'Özel rozetler' },
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
  
  const badgeTypes: Array<'ACHIEVEMENT' | 'EVENT' | 'COSMETIC'> = ['ACHIEVEMENT', 'EVENT', 'COSMETIC']
  const badgeRarities: Array<'COMMON' | 'RARE' | 'EPIC'> = ['COMMON', 'RARE', 'EPIC']
  
  const badgeNames = [
    'First Post', 'Power User', 'Trusted Member', 'Event Champion', 'Community Hero',
    'Expert Reviewer', 'Influencer', 'Early Adopter', 'Beta Tester', 'Top Contributor',
    'Golden User', 'Diamond Tier', 'Platinum Member', 'Elite User', 'VIP Member'
  ]
  
  const createdBadges: string[] = []
  
  for (const name of badgeNames) {
    const randomType = badgeTypes[Math.floor(Math.random() * badgeTypes.length)]
    const randomRarity = badgeRarities[Math.floor(Math.random() * badgeRarities.length)]
    const randomCategory = createdCategories[Math.floor(Math.random() * createdCategories.length)]
    
    const badge = await prisma.badge.create({
      data: {
        name,
        description: `${name} badge - ${randomRarity}`,
        imageUrl: null,
        type: randomType,
        rarity: randomRarity,
        boostMultiplier: randomRarity === 'EPIC' ? 2.0 : (randomRarity === 'RARE' ? 1.5 : 1.0),
        rewardMultiplier: randomRarity === 'EPIC' ? 3.0 : (randomRarity === 'RARE' ? 2.0 : 1.0),
        categoryId: randomCategory,
      }
    })
    
    createdBadges.push(badge.id)
    totalBadges++
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
      
      await prisma.userBadge.create({
        data: {
          userId: user.id,
          badgeId,
          isVisible: Math.random() > 0.2, // %80 visible
          displayOrder: i + 1,
          visibility,
          claimed: Math.random() > 0.3, // %70 claimed
          claimedAt: Math.random() > 0.3 ? new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000) : null,
        }
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
    'Welcome': 'badge.hardwareexpert',
    'First Post': 'badge.wishmarker',
    'Tip Master': 'badge.premiumshoper',
    'Community Hero': 'badge.hardwareexpert',
    'Early Bird': 'badge.earlyadapter',
    'Beta Tester': 'badge.premiumshoper',
    'Benchmark Sage': 'badge.hardwareexpert',
    'Experience Curator': 'badge.premiumshoper',
    'Bridge Ambassador': 'badge.wishmarker',
    'Brand Visionary': 'badge.earlyadapter',
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
async function ensureBrandCategory(config: { name: string; description?: string; imageKey?: SeedMediaKey }): Promise<{ id: string; name: string }> {
  // Eğer imageKey belirtilmemişse, mapping'den otomatik bul
  let finalImageKey = config.imageKey;
  if (!finalImageKey) {
    finalImageKey = getBrandCategoryImageKey(config.name);
  }
  
  const existing = await prisma.brandCategory.findUnique({
    where: { name: config.name }
  }).catch(() => null);
  
  if (existing) {
    // imageUrl için fallback: eğer key bulunamazsa, mapping'den bak
    let imageUrl: string | null = null;
    if (finalImageKey) {
      imageUrl = getSeedMediaPath(finalImageKey, true);
    }
    
    // Eğer hala null ise, mapping'den otomatik bul
    if (!imageUrl) {
      const mappingKey = getBrandCategoryImageKey(config.name);
      if (mappingKey) {
        imageUrl = getSeedMediaPath(mappingKey, true);
      }
    }
    
    const updateData: any = {};
    if (config.description !== undefined) updateData.description = config.description;
    if (imageUrl) updateData.imageUrl = imageUrl;
    
    if (Object.keys(updateData).length > 0) {
      return prisma.brandCategory.update({
        where: { id: existing.id },
        data: updateData
      });
    }
    return existing;
  }
  
  // imageUrl için fallback: eğer key bulunamazsa, mapping'den bak
  let imageUrl: string | null = null;
  if (finalImageKey) {
    imageUrl = getSeedMediaPath(finalImageKey, true);
  }
  
  // Eğer hala null ise, mapping'den otomatik bul
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
async function ensureAchievementGoal(config: { chainId: string; title: string; requirement: string; rewardBadgeId?: string; pointsRequired: number; difficulty: string }): Promise<{ id: string; chainId: string; title: string }> {
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
      ...config,
      difficulty: config.difficulty as any,
    }
  });
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
  const brandBannersDir = path.join(__dirname, '../tests/assets/Brand_Banners')
  
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

async function seedBrandProducts(userIdToUse: string): Promise<void> {
  console.log('🏷️ [seedBrandProducts] Fonksiyon başlatılıyor...')
  
  // Kategorileri bul (yeni kategori isimleriyle)
  const techCategory = await prisma.mainCategory.findFirst({ where: { name: 'Electronics' } })
  const evYasamCategory = await prisma.mainCategory.findFirst({ where: { name: 'Beauty' } })
  
  if (!techCategory || !evYasamCategory) {
    console.warn('⚠️ Kategoriler bulunamadı, brand products seed atlanıyor')
    return
  }
  
  console.log('✅ Kategoriler bulundu')

  // Sub kategorileri bul veya oluştur (idempotent - ID korunur)
  const techSubCategory = await ensureSubCategory({
    name: 'Akıllı Telefonlar',
    mainCategoryId: techCategory.id,
    description: 'iPhone, Android, Samsung, Xiaomi vs.',
    imageKey: 'catalog.phones',
  })

  const evYasamSubCategory = await ensureSubCategory({
    name: 'Temizlik Ürünleri',
    mainCategoryId: evYasamCategory.id,
    description: 'Süpürge, temizlik robotu vb.',
    imageKey: 'catalog.home-appliances',
  })

  // Brand'ları bul (tüm brand'ları al)
  const brands = await prisma.brand.findMany()

  if (brands.length === 0) {
    console.warn('⚠️ Brand\'lar bulunamadı, brand products seed atlanıyor')
    return
  }
  
  console.log(`📦 ${brands.length} brand bulundu. İşlenecek brand'lar:`)
  brands.forEach((brand, index) => {
    const configCount = getProductConfigsForBrand(brand.name).length
    const configStatus = configCount > 0 ? `✅ ${configCount} config` : '❌ Config yok'
    console.log(`  ${index + 1}. ${brand.name} - ${configStatus}`)
  })

  // Her brand için product'lar ve post'lar oluştur
  for (const brand of brands) {
    console.log(`📦 Brand için product'lar oluşturuluyor: ${brand.name}`)

    // Brand category'yi kontrol et (Electronics veya Beauty/Cosmetics için özel işlem)
    const brandCategory = brand.categoryId ? await prisma.brandCategory.findUnique({
      where: { id: brand.categoryId },
      select: { name: true },
    }).catch(() => null) : null
    
    const isTestCategory = brandCategory?.name === 'Electronics' || brandCategory?.name === 'Beauty'
    
    // Brand'a göre kategori seç
    const isTechBrand = ['TechVision', 'FitnessTech'].includes(brand.name)
    const subCategory = isTechBrand ? techSubCategory : evYasamSubCategory

    // Product group oluştur veya bul (idempotent - ID korunur)
    const productGroup = await ensureProductGroup({
      name: `${brand.name} Ürünleri`,
      subCategoryId: subCategory.id,
      description: `${brand.name} markasına ait ürünler`,
      imageKey: 'product.laptop.macbook',
    })

    // Brand'a özel product'lar oluştur
    let productConfigs = getProductConfigsForBrand(brand.name)
    
    // Test kategorisi değilse, sadece ilk 1-2 product'ı al
    if (!isTestCategory && productConfigs.length > 2) {
      productConfigs = productConfigs.slice(0, 2)
      console.log(`  ⚠️  Non-test category: Limiting to ${productConfigs.length} products for ${brand.name}`)
    } else if (isTestCategory) {
      console.log(`  ✅ Test category: Using all ${productConfigs.length} products for ${brand.name}`)
    }
    
    // Debug: Product config kontrolü
    if (productConfigs.length === 0) {
      console.log(`⚠️ ${brand.name} için product config bulunamadı, bu brand için görsel yükleme atlanıyor`)
    } else {
      console.log(`✅ ${brand.name} için ${productConfigs.length} product config bulundu`)
    }
    
    if (productConfigs.length > 0) {
      // Batch kontrol: Tüm mevcut product'ları tek sorguda al
      const productNames = productConfigs.map(pc => pc.name)
      const existingProducts = await prisma.product.findMany({
        where: {
          brand: { name: brand.name },
          name: { in: productNames },
        },
        select: { id: true, name: true },
      }).catch(() => [])
      const productMap = new Map<string, string>(existingProducts.map(p => [p.name, p.id] as [string, string]))
      
      // Yeni oluşturulacak product'ları topla
      const productsToCreate: Array<{
        name: string
        brand: string
        description: string
        groupId: string
        imageKey: SeedMediaKey
      }> = []
      
      for (const productConfig of productConfigs) {
        if (!productMap.has(productConfig.name)) {
          productsToCreate.push({
            name: productConfig.name,
            brand: brand.name,
            description: productConfig.description,
            groupId: productGroup.id,
            imageKey: productConfig.imageKey as any,
          })
        }
      }
      
      // Yeni product'ları toplu oluştur
      if (productsToCreate.length > 0) {
        const createdProducts = await Promise.all(
          productsToCreate.map(config => ensureProduct(config))
        )
        createdProducts.forEach(product => {
          if (product) {
            productMap.set(product.name, product.id)
          }
        })
        }

      // Batch kontrol: Tüm mevcut inventory'leri tek sorguda al
      const allProductIds = Array.from(productMap.values())
      const existingInventories = allProductIds.length > 0
        ? await prisma.inventory.findMany({
            where: {
            userId: TEST_USER_ID,
              productId: { in: allProductIds },
            },
            select: { productId: true },
          }).catch(() => [])
        : []
      const inventoryProductSet = new Set<string>(existingInventories.map(inv => inv.productId as string))
      
      // Yeni oluşturulacak inventory'leri topla
      const inventoriesToCreate: Array<{
        userId: string
        productId: string
        hasOwned: boolean
        experienceSummary: string
      }> = []
      
      for (const productConfig of productConfigs) {
        const productId = productMap.get(productConfig.name)
        if (productId && !inventoryProductSet.has(productId)) {
          inventoriesToCreate.push({
            userId: TEST_USER_ID,
            productId: productId,
            hasOwned: true,
            experienceSummary: `Real‑life ownership experience with ${productConfig.name}`,
          })
        }
      }
      
      // Yeni inventory'leri toplu oluştur
      if (inventoriesToCreate.length > 0) {
        await prisma.inventory.createMany({
          data: inventoriesToCreate,
          skipDuplicates: true,
        }).catch(() => {
          // createMany başarısız olursa (örneğin unique constraint), tek tek dene
          return Promise.all(
            inventoriesToCreate.map(inv => 
              prisma.inventory.create({ data: inv }).catch(() => null)
            )
          )
        })
      }
    }
  }
}

function getProductConfigsForBrand(brandName: string): Array<{
  name: string
  description: string
  imageKey: string
  experienceText: string
}> {
  const configs: Record<string, Array<{
    name: string
    description: string
    imageKey: string
    experienceText: string
  }>> = {
    'TechVision': [
      {
        name: 'TechVision Smart Watch Pro',
        description: 'Gelişmiş özelliklere sahip akıllı saat',
        imageKey: 'product.laptop.macbook',
        experienceText: 'Günlük kullanımda çok pratik, sağlık takibi özellikleri harika.',
      },
      {
        name: 'TechVision Wireless Earbuds X1',
        description: 'Yüksek kaliteli kablosuz kulaklık',
        imageKey: 'product.laptop.macbook',
        experienceText: 'Ses kalitesi mükemmel, pil ömrü de çok iyi.',
      },
    ],
    'SmartHome Pro': [
      {
        name: 'SmartHome Pro Smart Light System',
        description: 'Akıllı ev aydınlatma sistemi',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Ev otomasyonu için mükemmel bir çözüm, uygulama kullanımı çok kolay.',
      },
      {
        name: 'SmartHome Pro Thermostat',
        description: 'Akıllı termostat sistemi',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Enerji tasarrufu sağlıyor ve kullanımı çok basit.',
      },
    ],
    'CoffeeDelight': [
      {
        name: 'CoffeeDelight Espresso Machine',
        description: 'Profesyonel espresso makinesi',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Kahve kalitesi harika, barista kalitesinde espresso yapabiliyorum.',
      },
      {
        name: 'CoffeeDelight Grinder Pro',
        description: 'Profesyonel kahve öğütücü',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Öğütme ayarları çok hassas, tutarlı sonuçlar alıyorum.',
      },
    ],
    'FitnessTech': [
      {
        name: 'FitnessTech Heart Rate Monitor',
        description: 'Gelişmiş kalp atışı monitörü',
        imageKey: 'product.laptop.macbook',
        experienceText: 'Antrenman sırasında çok doğru veriler veriyor, dayanıklılığı da iyi.',
      },
      {
        name: 'FitnessTech Dumbbells Set',
        description: 'Akıllı ağırlık seti',
        imageKey: 'product.laptop.macbook',
        experienceText: 'Evde antrenman için mükemmel, uygulama entegrasyonu harika.',
      },
    ],
    'StyleHub': [
      {
        name: 'StyleHub Designer Lamp',
        description: 'Modern tasarım masa lambası',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Tasarımı çok şık, ev dekorasyonuna mükemmel uyuyor.',
      },
      {
        name: 'StyleHub Modern Chair',
        description: 'Ergonomik ofis koltuğu',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Uzun süre otururken çok rahat, sırt desteği mükemmel.',
      },
    ],
    'AutoParts Pro': [
      {
        name: 'AutoParts Pro Engine Oil',
        description: 'Yüksek kaliteli motor yağı - motor performansını artırıyor, uzun ömürlü kullanım sağlıyor',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Motor performansını artırıyor, uzun ömürlü kullanım sağlıyor.',
      },
      {
        name: 'AutoParts Pro Air Filter',
        description: 'Hava filtresi - motor hava kalitesini iyileştiriyor, filtreleme performansı mükemmel',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Motor hava kalitesini iyileştiriyor, filtreleme performansı mükemmel.',
      },
      {
        name: 'AutoParts Pro Brake Pads',
        description: 'Fren balata seti - fren performansı çok iyi, güvenli sürüş sağlıyor',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Fren performansı çok iyi, güvenli sürüş sağlıyor.',
      },
      {
        name: 'AutoParts Pro Car Battery',
        description: 'Araba aküsü - güvenilir ve uzun ömürlü, araç için mükemmel bir akü',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Güvenilir ve uzun ömürlü, araç için mükemmel bir akü.',
      },
      {
        name: 'AutoParts Pro Spark Plugs',
        description: 'Buji seti - motorun daha verimli çalışmasını sağlıyor, yakıt tasarrufu sağlıyor',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Motorun daha verimli çalışmasını sağlıyor, yakıt tasarrufu sağlıyor.',
      },
      {
        name: 'AutoParts Pro Wiper Blades',
        description: 'Silecek lastiği - yağmur ve kar koşullarında mükemmel görüş sağlıyor',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Yağmur ve kar koşullarında mükemmel görüş sağlıyor, silecek performansı çok iyi.',
      },
      {
        name: 'AutoParts Pro Tire Pressure Gauge',
        description: 'Lastik basınç ölçer - doğru lastik basıncı ile güvenli sürüş',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Doğru lastik basıncı ile güvenli sürüş sağlıyor, kullanımı çok kolay.',
      },
      {
        name: 'AutoParts Pro Jump Starter',
        description: 'Araba çalıştırıcı - acil durumlarda araç için hayat kurtarıcı',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Acil durumlarda araç için hayat kurtarıcı, güçlü ve güvenilir.',
      },
      {
        name: 'AutoParts Pro Car Cover',
        description: 'Araba örtüsü - aracınızı güneş, yağmur ve tozdan korur',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Aracınızı güneş, yağmur ve tozdan korur, dayanıklı malzeme kullanılmış.',
      },
      {
        name: 'AutoParts Pro Floor Mats',
        description: 'Araba paspası - araç içini temiz tutar, dayanıklı ve kolay temizlenir',
        imageKey: 'product.vacuum.dyson',
        experienceText: 'Araç içini temiz tutar, dayanıklı ve kolay temizlenir, mükemmel fit.',
      },
    ],
    'Apple': [
      {
        name: 'iPhone 17',
        description: 'Apple\'ın en yeni iPhone modeli - gelişmiş kamera, güçlü performans ve uzun pil ömrü',
        imageKey: 'product.apple.iphone17',
        experienceText: 'Kamera kalitesi harika, performans çok hızlı ve pil ömrü gün boyu yetiyor.',
      },
      {
        name: 'iPhone 17 Pro',
        description: 'Pro seviye iPhone - profesyonel kamera sistemi, A18 Pro çip ve ProMotion ekran',
        imageKey: 'product.apple.iphone17pro',
        experienceText: 'Pro kamera sistemi mükemmel, video çekimi çok kaliteli ve ekran çok akıcı.',
      },
      {
        name: 'AirPods 4',
        description: 'Yeni nesil AirPods - gelişmiş ses kalitesi ve uzun pil ömrü',
        imageKey: 'product.apple.airpods4',
        experienceText: 'Ses kalitesi çok iyi, kullanımı rahat ve pil ömrü gün boyu yetiyor.',
      },
      {
        name: 'AirPods 4 ANC',
        description: 'Aktif gürültü engelleme özellikli AirPods - sessiz ortam için ideal',
        imageKey: 'product.apple.airpods4anc',
        experienceText: 'Gürültü engelleme özelliği harika, dış sesleri tamamen kesiyor.',
      },
      {
        name: 'AirPods Max',
        description: 'Premium over-ear kulaklık - üstün ses kalitesi ve konfor',
        imageKey: 'product.apple.airpodsmax',
        experienceText: 'Ses kalitesi profesyonel seviyede, konforu mükemmel ve uzun süre kullanımda rahat.',
      },
      {
        name: 'Apple Watch Series 11',
        description: 'En gelişmiş Apple Watch - sağlık takibi, fitness özellikleri ve uzun pil ömrü',
        imageKey: 'product.apple.watchseries11',
        experienceText: 'Sağlık takibi çok detaylı, fitness özellikleri harika ve pil ömrü 2 gün yetiyor.',
      },
      {
        name: 'Apple Watch Ultra 3',
        description: 'Ultra dayanıklı Apple Watch - outdoor aktiviteler için ideal',
        imageKey: 'product.apple.watchultra3',
        experienceText: 'Dayanıklılığı mükemmel, outdoor aktivitelerde çok güvenilir ve ekran çok parlak.',
      },
    ],
  }

  return configs[brandName] || []
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

  // Progress bar oluştur (toplam 25 ana adım - Feed distribution eklendi)
  const totalSteps = 25 // Updated: Added feed distribution step
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

  // 1. User Themes (ÖNCE - createSeedUsers için gerekli)
  console.log('📱 Creating user themes...')
  const themeConfigs = [
    { name: 'Light', description: 'Açık tema - günün her saati için ideal' },
    { name: 'Dark', description: 'Koyu tema - gözleri yormaz, modern görünüm' },
    { name: 'Auto', description: 'Otomatik - sistem temasını takip eder' }
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

  // 3. Experience Taxonomy (Duration, Location, Purpose - for Experience posts)
  await seedTaxonomy()
  progress.increment('Experience Taxonomy oluşturuldu')

  // Categories'i sonraki fonksiyonlar için hazırla (root kategoriler)
  const mainCategories = await prisma.category.findMany({ where: { parentId: null } })
  console.log(`📂 ${mainCategories.length} root category kullanılabilir\n`)

  // DEPRECATED: seedProductCategories, seedBrands, seedProducts - catalog-service tarafından yapılmalı
  /*
  progress.increment('Kategori yapısı oluşturuluyor...')
  await seedProductCategories()
  progress.increment('Kategori yapısı oluşturuldu')

  progress.increment('Brand sistemi oluşturuluyor...')
  await seedBrands()
  progress.increment('Brand sistemi oluşturuldu')

  progress.increment('Ürünler oluşturuluyor...')
  await seedProducts()
  progress.increment('Ürünler oluşturuldu')
  */
  
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

  // 9. Wallet Transactions
  progress.increment('Wallet transactions oluşturuluyor...')
  await seedTransactions()
  progress.increment('Wallet transactions oluşturuldu')

  // 12. Events (WishboxEvent + Participation + Rewards)
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
    { name: 'Achievement', description: 'Başarı rozetleri - belirli hedeflere ulaşma' },
    { name: 'Event', description: 'Etkinlik rozetleri - özel günler ve kampanyalar' },
    { name: 'Cosmetic', description: 'Kozmetik rozetler - görsel özelleştirme' },
    { name: 'Community', description: 'Topluluk rozetleri - sosyal aktiviteler' }
  ]
  
  const badgeCategories = await Promise.all(
    badgeCategoryConfigs.map(async (config) => {
      return ensureBadgeCategory(config)
    })
  )
  console.log(`✅ ${badgeCategories.length} badge kategorisi oluşturuldu/güncellendi`)

  // 4. Default Badges
  progress.increment('Varsayılan badge\'ler oluşturuluyor...')
  console.log('\n🎖️ Creating default badges...')
  const achievementCategory = badgeCategories.find(c => c.name === 'Achievement')!
  const eventCategory = badgeCategories.find(c => c.name === 'Event')!
  const communityCategory = badgeCategories.find(c => c.name === 'Community')!

  type BadgeSeedConfig = {
    name: string;
    description: string;
    type: 'ACHIEVEMENT' | 'EVENT';
    rarity: 'COMMON' | 'RARE' | 'EPIC';
    boostMultiplier: number;
    rewardMultiplier: number;
    categoryId: string;
    imageKey?: SeedMediaKey;
  };

  const badgeConfigs: BadgeSeedConfig[] = [
    {
      name: 'Welcome',
      description: 'Welcome to Tipbox! This is your very first achievement badge.',
      type: 'ACHIEVEMENT',
      rarity: 'COMMON',
      boostMultiplier: 1.0,
      rewardMultiplier: 1.0,
      categoryId: achievementCategory.id,
      imageKey: 'badge.hardwareexpert',
    },
    {
      name: 'First Post',
      description: 'You have published your very first post on Tipbox.',
      type: 'ACHIEVEMENT',
      rarity: 'COMMON',
      boostMultiplier: 1.1,
      rewardMultiplier: 1.1,
      categoryId: achievementCategory.id,
      imageKey: 'badge.wishmarker',
    },
    {
      name: 'Tip Master',
      description: 'You shared 10 helpful tips. You are becoming a real expert.',
      type: 'ACHIEVEMENT',
      rarity: 'RARE',
      boostMultiplier: 1.3,
      rewardMultiplier: 1.3,
      categoryId: achievementCategory.id,
      imageKey: 'badge.premiumshoper',
    },
    {
      name: 'Community Hero',
      description: 'You posted 100 helpful comments for the community.',
      type: 'ACHIEVEMENT',
      rarity: 'EPIC',
      boostMultiplier: 1.5,
      rewardMultiplier: 1.5,
      categoryId: communityCategory.id,
      imageKey: 'badge.hardwareexpert',
    },
    {
      name: 'Early Bird',
      description: "You are one of the very first users of Tipbox!",
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.2,
      rewardMultiplier: 1.4,
      categoryId: eventCategory.id,
      imageKey: 'badge.earlyadapter',
    },
    {
      name: 'Beta Tester',
      description: 'You helped us throughout the beta period. Thank you!',
      type: 'EVENT',
      rarity: 'EPIC',
      boostMultiplier: 1.4,
      rewardMultiplier: 1.6,
      categoryId: eventCategory.id,
      imageKey: 'badge.premiumshoper',
    },
    {
      name: 'Benchmark Sage',
      description: 'Benchmark paylaşımların topluluk için referans noktası oldu.',
      type: 'ACHIEVEMENT',
      rarity: 'RARE',
      boostMultiplier: 1.35,
      rewardMultiplier: 1.35,
      categoryId: achievementCategory.id,
      imageKey: 'badge.hardwareexpert',
    },
    {
      name: 'Experience Curator',
      description: 'Birden fazla kategoride derinlemesine 15+ deneyim paylaştın.',
      type: 'ACHIEVEMENT',
      rarity: 'EPIC',
      boostMultiplier: 1.5,
      rewardMultiplier: 1.6,
      categoryId: achievementCategory.id,
      imageKey: 'badge.premiumshoper',
    },
    {
      name: 'Bridge Ambassador',
      description: 'Bridge topluluk etkinliklerinde marka elçisi seçildin.',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.25,
      rewardMultiplier: 1.35,
      categoryId: eventCategory.id,
      imageKey: 'badge.wishmarker',
    },
    {
      name: 'Brand Visionary',
      description: 'En yaratıcı bridge kampanyasını yöneterek vitrine çıktın.',
      type: 'EVENT',
      rarity: 'EPIC',
      boostMultiplier: 1.55,
      rewardMultiplier: 1.65,
      categoryId: eventCategory.id,
      imageKey: 'badge.earlyadapter',
    },
    // EVENT-SPECIFIC BADGES (Her event için 5 badge)
    // Batarya Event Badges
    {
      name: 'Batarya Uzmanı',
      description: 'Akıllı Telefon Batarya Performansı etkinliğinde deneyimlerinizi paylaştınız',
      type: 'EVENT',
      rarity: 'COMMON',
      boostMultiplier: 1.1,
      rewardMultiplier: 1.1,
      categoryId: eventCategory.id,
    },
    {
      name: 'Şarj Kahramanı',
      description: 'Batarya testi etkinliğinde en fazla katkıyı yaptınız',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.3,
      rewardMultiplier: 1.3,
      categoryId: eventCategory.id,
    },
    {
      name: 'Enerji Efendi',
      description: 'Batarya performansı konusunda topluma öncülük ettiniz',
      type: 'EVENT',
      rarity: 'EPIC',
      boostMultiplier: 1.5,
      rewardMultiplier: 1.5,
      categoryId: eventCategory.id,
    },
    {
      name: 'Güç Yöneticisi',
      description: 'Batarya tasarrufu ipuçlarınız çok beğenildi',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.25,
      rewardMultiplier: 1.25,
      categoryId: eventCategory.id,
    },
    {
      name: 'Şarj Savaşçısı',
      description: 'Hızlı şarj teknolojilerini en iyi anlatan kişisiniz',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.2,
      rewardMultiplier: 1.2,
      categoryId: eventCategory.id,
    },
    // Laptop Event Badges
    {
      name: 'Uzaktan Çalışma Gurusu',
      description: 'Laptop ile Uzaktan Çalışma etkinliğine katıldınız',
      type: 'EVENT',
      rarity: 'COMMON',
      boostMultiplier: 1.1,
      rewardMultiplier: 1.1,
      categoryId: eventCategory.id,
    },
    {
      name: 'Verimlilik Uzmanı',
      description: 'Uzaktan çalışma ipuçlarınız topluma ilham verdi',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.3,
      rewardMultiplier: 1.3,
      categoryId: eventCategory.id,
    },
    {
      name: 'Home Office Kahramanı',
      description: 'En iyi laptop kurulum deneyimini paylaştınız',
      type: 'EVENT',
      rarity: 'EPIC',
      boostMultiplier: 1.5,
      rewardMultiplier: 1.5,
      categoryId: eventCategory.id,
    },
    {
      name: 'Klavye Ustası',
      description: 'Klavye konforu konusunda en detaylı analizleri yaptınız',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.25,
      rewardMultiplier: 1.25,
      categoryId: eventCategory.id,
    },
    {
      name: 'Ekran Yorumcusu',
      description: 'Ekran kalitesi değerlendirmeleriniz referans oldu',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.2,
      rewardMultiplier: 1.2,
      categoryId: eventCategory.id,
    },
    // Kulaklık Event Badges
    {
      name: 'Ses Mühendisi',
      description: 'Kablosuz Kulaklık Ses Kalitesi etkinliğine katıldınız',
      type: 'EVENT',
      rarity: 'COMMON',
      boostMultiplier: 1.1,
      rewardMultiplier: 1.1,
      categoryId: eventCategory.id,
    },
    {
      name: 'Audio Gurusu',
      description: 'Ses kalitesi analizleriniz profesyonel seviyede',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.3,
      rewardMultiplier: 1.3,
      categoryId: eventCategory.id,
    },
    {
      name: 'Gürültü Avcısı',
      description: 'Gürültü engelleme teknolojilerini en iyi anlattınız',
      type: 'EVENT',
      rarity: 'EPIC',
      boostMultiplier: 1.5,
      rewardMultiplier: 1.5,
      categoryId: eventCategory.id,
    },
    {
      name: 'Bas Uzmanı',
      description: 'Bas performansı değerlendirmeleriniz çok detaylı',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.25,
      rewardMultiplier: 1.25,
      categoryId: eventCategory.id,
    },
    {
      name: 'Konfor Uzmanı',
      description: 'Kulak konforu konusunda en faydalı paylaşımları yaptınız',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.2,
      rewardMultiplier: 1.2,
      categoryId: eventCategory.id,
    },
    // Akıllı Saat Event Badges
    {
      name: 'Fitness Takipçisi',
      description: 'Akıllı Saat Spor Takibi etkinliğine katıldınız',
      type: 'EVENT',
      rarity: 'COMMON',
      boostMultiplier: 1.1,
      rewardMultiplier: 1.1,
      categoryId: eventCategory.id,
    },
    {
      name: 'Sağlık Danışmanı',
      description: 'Sağlık takibi özelliklerini en iyi anlattınız',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.3,
      rewardMultiplier: 1.3,
      categoryId: eventCategory.id,
    },
    {
      name: 'GPS Navigatörü',
      description: 'GPS doğruluğu testleriniz referans oldu',
      type: 'EVENT',
      rarity: 'EPIC',
      boostMultiplier: 1.5,
      rewardMultiplier: 1.5,
      categoryId: eventCategory.id,
    },
    {
      name: 'Uyku Analisti',
      description: 'Uyku takibi karşılaştırmalarınız çok faydalı',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.25,
      rewardMultiplier: 1.25,
      categoryId: eventCategory.id,
    },
    {
      name: 'Kalp Atışı Uzmanı',
      description: 'Kalp atışı ölçüm doğruluğu konusunda öncüsünüz',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.2,
      rewardMultiplier: 1.2,
      categoryId: eventCategory.id,
    },
    // Tablet Event Badges
    {
      name: 'Dijital Sanatçı',
      description: 'Tablet Kullanım Senaryoları etkinliğine katıldınız',
      type: 'EVENT',
      rarity: 'COMMON',
      boostMultiplier: 1.1,
      rewardMultiplier: 1.1,
      categoryId: eventCategory.id,
    },
    {
      name: 'Çizim Ustası',
      description: 'Dijital çizim deneyimleriniz ilham verici',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.3,
      rewardMultiplier: 1.3,
      categoryId: eventCategory.id,
    },
    {
      name: 'Not Alma Kahramanı',
      description: 'Not alma uygulamaları konusunda en detaylı analizi yaptınız',
      type: 'EVENT',
      rarity: 'EPIC',
      boostMultiplier: 1.5,
      rewardMultiplier: 1.5,
      categoryId: eventCategory.id,
    },
    {
      name: 'İzleme Deneyimi Gurusu',
      description: 'Video izleme deneyimi paylaşımlarınız çok beğenildi',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.25,
      rewardMultiplier: 1.25,
      categoryId: eventCategory.id,
    },
    {
      name: 'Okuma Tutkunu',
      description: 'E-kitap okuma deneyimleri konusunda referanssınız',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.2,
      rewardMultiplier: 1.2,
      categoryId: eventCategory.id,
    },
    // Cilt Bakım Event Badges
    {
      name: 'Cilt Bakım Uzmanı',
      description: 'Günlük Cilt Bakım Rutini etkinliğine katıldınız',
      type: 'EVENT',
      rarity: 'COMMON',
      boostMultiplier: 1.1,
      rewardMultiplier: 1.1,
      categoryId: eventCategory.id,
    },
    {
      name: 'Rutin Mimarı',
      description: 'Cilt bakım rutininiz örnek teşkil etti',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.3,
      rewardMultiplier: 1.3,
      categoryId: eventCategory.id,
    },
    {
      name: 'Serum Gurusu',
      description: 'Serum kullanımı konusunda en detaylı bilgileri paylaştınız',
      type: 'EVENT',
      rarity: 'EPIC',
      boostMultiplier: 1.5,
      rewardMultiplier: 1.5,
      categoryId: eventCategory.id,
    },
    {
      name: 'Nem Dengesi Ustası',
      description: 'Nemlendirici ürün tavsiyeleri çok faydalı',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.25,
      rewardMultiplier: 1.25,
      categoryId: eventCategory.id,
    },
    {
      name: 'Sabah Rutini Kahramanı',
      description: 'Sabah cilt bakım rutininiz ilham verdi',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.2,
      rewardMultiplier: 1.2,
      categoryId: eventCategory.id,
    },
    // Yağlı Cilt Event Badges
    {
      name: 'Matlaştırma Uzmanı',
      description: 'Yağlı Ciltler İçin En İyi Ürünler etkinliğine katıldınız',
      type: 'EVENT',
      rarity: 'COMMON',
      boostMultiplier: 1.1,
      rewardMultiplier: 1.1,
      categoryId: eventCategory.id,
    },
    {
      name: 'Gözenek Savaşçısı',
      description: 'Gözenek bakımı konusunda en iyi tavsiyeleri verdiniz',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.3,
      rewardMultiplier: 1.3,
      categoryId: eventCategory.id,
    },
    {
      name: 'Yağ Dengesi Gurusu',
      description: 'Yağ dengeleme ürünleri konusunda referanssınız',
      type: 'EVENT',
      rarity: 'EPIC',
      boostMultiplier: 1.5,
      rewardMultiplier: 1.5,
      categoryId: eventCategory.id,
    },
    {
      name: 'Parlama Kontrolcüsü',
      description: 'Parlama kontrolü ipuçlarınız çok işe yaradı',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.25,
      rewardMultiplier: 1.25,
      categoryId: eventCategory.id,
    },
    {
      name: 'T-Bölgesi Ustası',
      description: 'T-bölgesi bakımı konusunda en detaylı analizleri yaptınız',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.2,
      rewardMultiplier: 1.2,
      categoryId: eventCategory.id,
    },
    // Makyaj Event Badges
    {
      name: 'Kalıcılık Testi Uzmanı',
      description: 'Kalıcı Makyaj Ürünleri Testi etkinliğine katıldınız',
      type: 'EVENT',
      rarity: 'COMMON',
      boostMultiplier: 1.1,
      rewardMultiplier: 1.1,
      categoryId: eventCategory.id,
    },
    {
      name: 'Fondöten Gurusu',
      description: 'Fondöten değerlendirmeleriniz profesyonel seviyede',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.3,
      rewardMultiplier: 1.3,
      categoryId: eventCategory.id,
    },
    {
      name: 'Ruj Koleksiyoncusu',
      description: 'Ruj testleriniz çok kapsamlı ve detaylı',
      type: 'EVENT',
      rarity: 'EPIC',
      boostMultiplier: 1.5,
      rewardMultiplier: 1.5,
      categoryId: eventCategory.id,
    },
    {
      name: 'Maskara Ustası',
      description: 'Maskara karşılaştırmalarınız referans oldu',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.25,
      rewardMultiplier: 1.25,
      categoryId: eventCategory.id,
    },
    {
      name: 'Yaz Sıcağı Kahramanı',
      description: 'Sıcak havada makyaj ipuçlarınız çok faydalı',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.2,
      rewardMultiplier: 1.2,
      categoryId: eventCategory.id,
    },
  ];

  const badges = await Promise.all(
    badgeConfigs.map(async ({ imageKey, ...config }) => {
      const imageUrl = imageKey ? getSeedMediaPath(imageKey, true) || null : null;
      const existing = await prisma.badge.findFirst({
        where: { name: config.name }
      }).catch(() => null);

      if (existing) {
        // Mevcut badge'i senkronize et
        // Eğer mevcut imageUrl cdn.tipbox.co içeriyorsa veya yeni imageUrl varsa güncelle
        const shouldUpdateImage = imageUrl && (
          !existing.imageUrl || 
          existing.imageUrl.includes('cdn.tipbox.co') || 
          existing.imageUrl !== imageUrl
        );
        return prisma.badge.update({
          where: { id: existing.id },
          data: {
            description: config.description,
            type: config.type as any,
            rarity: config.rarity as any,
            boostMultiplier: config.boostMultiplier,
            rewardMultiplier: config.rewardMultiplier,
            categoryId: config.categoryId,
            imageUrl: shouldUpdateImage ? imageUrl : existing.imageUrl,
          }
        });
      } else {
        // Yeni badge oluştur
        return prisma.badge.create({
          data: {
            ...config,
            imageUrl,
            type: config.type as any,
            rarity: config.rarity as any,
          }
        });
      }
    })
  );
  console.log(`✅ ${badges.length} varsayılan badge oluşturuldu/güncellendi`)

  const benchmarkSageBadge = badges.find(b => b.name === 'Benchmark Sage')
  const experienceCuratorBadge = badges.find(b => b.name === 'Experience Curator')
  const bridgeAmbassadorBadge = badges.find(b => b.name === 'Bridge Ambassador')
  const brandVisionaryBadge = badges.find(b => b.name === 'Brand Visionary')

  if (!benchmarkSageBadge || !experienceCuratorBadge || !bridgeAmbassadorBadge || !brandVisionaryBadge) {
    throw new Error('Beklenen varsayılan badge tanımları oluşturulamadı')
  }

  // Create bridge achievement chain for bridge badges
  let bridgeAchievementChain = await prisma.achievementChain.findFirst({
    where: { name: 'Bridge Engagement' }
  });
  
  if (!bridgeAchievementChain) {
    bridgeAchievementChain = await prisma.achievementChain.create({
      data: {
        name: 'Bridge Engagement',
        description: 'A series that rewards bridge community participation',
        category: 'Bridge',
      }
    });
  }

  if (!bridgeAchievementChain) {
    throw new Error('Bridge achievement chain could not be created');
  }

  // Create achievement goals for Bridge Ambassador badge
  const bridgeAmbassadorGoals = await Promise.all([
    prisma.achievementGoal.create({
      data: {
        chainId: bridgeAchievementChain.id,
        title: 'Join 3 Bridge Events',
        requirement: 'Participate in 3 bridge community events',
        rewardBadgeId: bridgeAmbassadorBadge.id,
        pointsRequired: 3,
        difficulty: 'MEDIUM',
      }
    }).catch(async () => {
      return prisma.achievementGoal.findFirst({
        where: { 
          chainId: bridgeAchievementChain.id,
          title: 'Join 3 Bridge Events'
        }
      });
    }),
    prisma.achievementGoal.create({
      data: {
        chainId: bridgeAchievementChain.id,
        title: 'Share 5 Bridge Posts',
        requirement: 'Share 5 posts in bridge community',
        rewardBadgeId: bridgeAmbassadorBadge.id,
        pointsRequired: 5,
        difficulty: 'EASY',
      }
    }).catch(async () => {
      return prisma.achievementGoal.findFirst({
        where: { 
          chainId: bridgeAchievementChain.id,
          title: 'Share 5 Bridge Posts'
        }
      });
    }),
    prisma.achievementGoal.create({
      data: {
        chainId: bridgeAchievementChain.id,
        title: 'Complete Bridge Survey',
        requirement: 'Complete a bridge community survey',
        rewardBadgeId: bridgeAmbassadorBadge.id,
        pointsRequired: 1,
        difficulty: 'EASY',
      }
    }).catch(async () => {
      return prisma.achievementGoal.findFirst({
        where: { 
          chainId: bridgeAchievementChain.id,
          title: 'Complete Bridge Survey'
        }
      });
    }),
  ])

  // Link achievement goals to Bridge Ambassador badge
  const validBridgeAmbassadorGoals = bridgeAmbassadorGoals.filter((g): g is NonNullable<typeof g> => g !== null);
  if (validBridgeAmbassadorGoals.length > 0) {
    await prisma.badge.update({
      where: { id: bridgeAmbassadorBadge.id },
      data: {
        achievementGoals: {
          connect: validBridgeAmbassadorGoals.map(g => ({ id: g.id }))
        }
      }
    }).catch(() => {}) // Ignore if relation doesn't exist
  }

  // Create achievement goals for Brand Visionary badge
  const brandVisionaryGoals = await Promise.all([
    prisma.achievementGoal.create({
      data: {
        chainId: bridgeAchievementChain.id,
        title: 'Create Brand Campaign',
        requirement: 'Create and manage a successful brand campaign',
        rewardBadgeId: brandVisionaryBadge.id,
        pointsRequired: 1,
        difficulty: 'HARD',
      }
    }).catch(async () => {
      return prisma.achievementGoal.findFirst({
        where: { 
          chainId: bridgeAchievementChain.id,
          title: 'Create Brand Campaign'
        }
      });
    }),
    prisma.achievementGoal.create({
      data: {
        chainId: bridgeAchievementChain.id,
        title: 'Get 100 Campaign Engagements',
        requirement: 'Get 100 total engagements on your bridge campaigns',
        rewardBadgeId: brandVisionaryBadge.id,
        pointsRequired: 100,
        difficulty: 'HARD',
      }
    }).catch(async () => {
      return prisma.achievementGoal.findFirst({
        where: { 
          chainId: bridgeAchievementChain.id,
          title: 'Get 100 Campaign Engagements'
        }
      });
    }),
    prisma.achievementGoal.create({
      data: {
        chainId: bridgeAchievementChain.id,
        title: 'Lead 5 Bridge Discussions',
        requirement: 'Start and lead 5 bridge community discussions',
        rewardBadgeId: brandVisionaryBadge.id,
        pointsRequired: 5,
        difficulty: 'MEDIUM',
      }
    }).catch(async () => {
      return prisma.achievementGoal.findFirst({
        where: { 
          chainId: bridgeAchievementChain.id,
          title: 'Lead 5 Bridge Discussions'
        }
      });
    }),
  ])

  // Link achievement goals to Brand Visionary badge
  const validBrandVisionaryGoals = brandVisionaryGoals.filter((g): g is NonNullable<typeof g> => g !== null);
  if (validBrandVisionaryGoals.length > 0) {
    await prisma.badge.update({
      where: { id: brandVisionaryBadge.id },
      data: {
        achievementGoals: {
          connect: validBrandVisionaryGoals.map(g => ({ id: g.id }))
        }
      }
    }).catch(() => {}) // Ignore if relation doesn't exist
  }

  console.log('✅ Bridge badge achievement goals created')

  // 5. Comparison Metrics
  progress.increment('Karşılaştırma metrikleri oluşturuluyor...')
  console.log('\n📊 Creating comparison metrics...')
  const metricConfigs = [
    { name: 'Fiyat', description: 'Ürünün fiyat performansı (1-10)' },
    { name: 'Kalite', description: 'Ürünün genel kalitesi (1-10)' },
    { name: 'Kullanım Kolaylığı', description: 'Ürünün ne kadar kolay kullanıldığı (1-10)' },
    { name: 'Dayanıklılık', description: 'Ürünün ne kadar uzun süre dayandığı (1-10)' },
    { name: 'Tasarım', description: 'Ürünün görsel tasarımı ve estetik (1-10)' },
    { name: 'Müşteri Hizmetleri', description: 'Markanın müşteri hizmetleri kalitesi (1-10)' },
    { name: 'Özellikler', description: 'Ürünün sahip olduğu özellikler (1-10)' },
    { name: 'Çevre Dostu', description: 'Ürünün çevreye olan etkisi (1-10)' }
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
        data: config as any
      })
    })
  )
  console.log(`✅ ${boostOptions.length} boost option oluşturuldu/güncellendi`)

  // NOT: Sub Categories artık seedProductCategories() içinde oluşturuluyor
  // Electronics ve Beauty için tüm subcategory/product group yapısı orada
  
  // DEPRECATED: SubCategory artık yok, sadece Category var (hierarchical)
  /*
  // Electronics kategorisini ve subcategory'lerini test user için kullanmak üzere al
  const techCategory = mainCategories.find(c => c.name === 'Electronics') || mainCategories[0]
  const TECH_MAIN_CATEGORY_ID = techCategory.id
  const techSubCategories = await prisma.subCategory.findMany({
    where: { mainCategoryId: techCategory.id },
    take: 10
  })
  console.log(`ℹ️  Test user için Electronics kategorisi kullanılacak (${techSubCategories.length} subcategory)`)
  */
  console.log('\nℹ️  Test user electronics kategori kodu atlandı (SubCategory deprecated)')
  
  // 7. Test User Data - DEVRE DIŞI (Post sayısını kontrol altında tutmak için)
  // Test kullanıcısı (480f5de9...) zaten SEED_USERS içinde var ve 60 post alıyor
  // Ekstra test data postları devre dışı bırakıldı
  console.log('\n⚠️  Test user ekstra postları devre dışı (40 kullanıcı x 60 post = 2400 hedefine ulaşmak için)')
  console.log('   Test kullanıcısı (omer@tipbox.co) zaten SEED_USERS listesinde ve 60 post alacak\n')
  
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
      const avatarPath = path.join(__dirname, '../tests/assets/userprofile/useravatar.jpg')
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
  // Julia (ozan@tipbox.co) zaten SEED_USERS listesinde ve 60 post alıyor
  console.log('⚠️  Julia Havk ekstra postları devre dışı (SEED_USERS listesinden 60 post alacak)\n')

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
  console.log('\n🏆 Event Badge Sistemi ve Marketplace Badge\'leri oluşturuluyor...')
  progress.increment('Event & Marketplace badges seeding...')
  
  try {
    // Event badge sistemi (badge + event + EventBadge join table)
    await ensureEventBadgeSystem(prisma)
    
    // Marketplace badge'leri
    await ensureMarketplaceBadges(prisma)
    
    progress.increment('Event & Marketplace badges tamamlandı')
    console.log('✅ Event & Marketplace badges seeding completed')
  } catch (error) {
    console.error('❌ Event/Marketplace badges seeding hatası:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
    console.log('⚠️  Seed devam ediyor ama event/marketplace badges oluşturulamadı')
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
