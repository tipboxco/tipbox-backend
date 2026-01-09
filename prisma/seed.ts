import { PrismaClient, Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import * as bcrypt from 'bcryptjs'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { DEFAULT_PROFILE_BANNER_URL } from '../src/domain/user/profile.constants'
import { getSeedMediaPath, SeedMediaKey } from './seed/helpers/media.helper'
import { S3Service } from '../src/infrastructure/s3/s3.service'
import { ProgressBar } from './seed/helpers/progress-bar'
import { seedTaxonomy } from './seed/taxonomy.seed'
import { seedProductCatalog } from './seed/product-catalog.seed'
// MinIO görsel yükleme artık ayrı bir script ile yapılıyor (upload-seed-media.ts)
// import { ensureSeedMediaUploaded } from './seed/helpers/ensure-seed-media'
// Import from JS file (no ts-node issues)
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
    avatarKey: 'user.avatar.primary',
    bio: 'Drone pilot and aerial photography enthusiast.',
    title: 'Drone Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000009',
    name: 'Merve',
    email: 'merve@tipbox.co',
    userName: 'merve',
    avatarKey: 'user.avatar.trust1',
    bio: 'Smartwatch and fitness band reviewer.',
    title: 'Wearable Tech',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000010',
    name: 'Berkay',
    email: 'berkay@tipbox.co',
    userName: 'berkay',
    avatarKey: 'user.avatar.trust2',
    bio: 'Mechanical keyboard enthusiast and RGB lighting expert.',
    title: 'Keyboard Master',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000011',
    name: 'Aslı',
    email: 'asli@tipbox.co',
    userName: 'asli',
    avatarKey: 'user.avatar.trust3',
    bio: 'Moisturizer and serum expert. Hydration is key!',
    title: 'Hydration Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000012',
    name: 'Murat',
    email: 'murat@tipbox.co',
    userName: 'murat',
    avatarKey: 'user.avatar.trust4',
    bio: 'Monitor and display technology reviewer.',
    title: 'Display Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000013',
    name: 'Gizem',
    email: 'gizem@tipbox.co',
    userName: 'gizem',
    avatarKey: 'user.avatar.trust5',
    bio: 'Foundation and concealer specialist.',
    title: 'Base Makeup Pro',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000014',
    name: 'Onur',
    email: 'onur@tipbox.co',
    userName: 'onur',
    avatarKey: 'user.avatar.truster1',
    bio: 'Router and networking equipment expert.',
    title: 'Network Guru',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000015',
    name: 'Burcu',
    email: 'burcu@tipbox.co',
    userName: 'burcu',
    avatarKey: 'user.avatar.truster2',
    bio: 'Lipstick and lip care enthusiast.',
    title: 'Lip Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000016',
    name: 'Tolga',
    email: 'tolga@tipbox.co',
    userName: 'tolga',
    avatarKey: 'user.avatar.truster3',
    bio: 'Power bank and charging accessories reviewer.',
    title: 'Charging Pro',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000017',
    name: 'Ebru',
    email: 'ebru@tipbox.co',
    userName: 'ebru',
    avatarKey: 'user.avatar.coach',
    bio: 'Eyeshadow palette collector and eye makeup artist.',
    title: 'Eye Makeup Artist',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000018',
    name: 'Serkan',
    email: 'serkan@tipbox.co',
    userName: 'serkan',
    avatarKey: 'user.avatar.market',
    bio: 'External SSD and storage solutions expert.',
    title: 'Storage Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000019',
    name: 'Ece',
    email: 'ece@tipbox.co',
    userName: 'ece',
    avatarKey: 'user.avatar.primary',
    bio: 'Mascara and eyeliner specialist.',
    title: 'Lash Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000020',
    name: 'Kaan',
    email: 'kaan@tipbox.co',
    userName: 'kaan',
    avatarKey: 'user.avatar.man1',
    bio: 'Mouse and gaming accessories reviewer.',
    title: 'Gaming Gear',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000021',
    name: 'Derya',
    email: 'derya@tipbox.co',
    userName: 'derya',
    avatarKey: 'user.avatar.woman1',
    bio: 'Facial cleanser and toner expert.',
    title: 'Cleansing Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000022',
    name: 'Selim',
    email: 'selim@tipbox.co',
    userName: 'selim',
    avatarKey: 'user.avatar.man2',
    bio: 'Webcam and streaming equipment specialist.',
    title: 'Streaming Pro',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000023',
    name: 'Pelin',
    email: 'pelin@tipbox.co',
    userName: 'pelin',
    avatarKey: 'user.avatar.woman2',
    bio: 'Blush and bronzer enthusiast.',
    title: 'Blush Master',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000024',
    name: 'Cem',
    email: 'cem@tipbox.co',
    userName: 'cem',
    avatarKey: 'user.avatar.man3',
    bio: 'USB hub and docking station expert.',
    title: 'Connectivity Pro',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000025',
    name: 'Duygu',
    email: 'duygu@tipbox.co',
    userName: 'duygu',
    avatarKey: 'user.avatar.woman3',
    bio: 'Sunscreen and SPF product specialist.',
    title: 'SPF Expert',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000026',
    name: 'Hakan',
    email: 'hakan@tipbox.co',
    userName: 'hakan',
    avatarKey: 'user.avatar.man4',
    bio: 'Bluetooth speaker and portable audio reviewer.',
    title: 'Portable Audio',
    country: 'Turkey',
  },
  {
    id: '10000000-0000-4000-a000-000000000027',
    name: 'Nil',
    email: 'nil@tipbox.co',
    userName: 'nil',
    avatarKey: 'user.avatar.woman4',
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

// NOT: Seed'de artık sadece path kullanılacak (full URL değil)
// DB'ye sadece bucket path yazılacak: tipbox-media/products/phone6.png
// DEFAULT_PROFILE_BANNER_URL env'den geliyor, eğer full URL ise .env'de path formatına çevrilmeli
// Şimdilik sadece path kullanıyoruz
const DEFAULT_BANNER_URL =  getSeedMediaPath('user.banner.primary', true) || null
const PRIMARY_AVATAR_URL = getSeedMediaPath('user.avatar.primary', true) || null
const MARKET_AVATAR_URL = getSeedMediaPath('user.avatar.market', true) || null
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
const COMMUNITY_COACH_AVATAR_URL = getSeedMediaPath('user.avatar.coach', true) || getSeedMediaPath('user.avatar.truster3', true) || ''
const TARGET_USER_TITLE = 'Marketplace Strategist'

const MARKETPLACE_NFT_IMAGE_KEYS: SeedMediaKey[] = [
  'badge.wish-marker',
  'badge.premium-shoper',
  'badge.hardware-expert',
  'badge.early-adapter',
  'marketplace.rainbow-border',
]

let marketplaceImageCursor = 0

// Seed görselleri için dış erişim host'u (frontend'in bağlandığı IP)
// Tüm seed URL'leri buradan üretilecek ki IP değişimi tek yerden yönetilebilsin.
// NOTE: SEED_MEDIA_HOST was previously used as a static base URL; media URLs are now
// fully managed via getSeedMediaPath / getPublicMediaBaseUrl. The old constant is
// intentionally removed to avoid unused-variable compile errors.
const nextMarketplaceImage = (): string => {
  const key = MARKETPLACE_NFT_IMAGE_KEYS[marketplaceImageCursor % MARKETPLACE_NFT_IMAGE_KEYS.length]
  marketplaceImageCursor += 1
  return getSeedMediaPath(key, true) ?? ''
}

// Simple ULID generator for seed (avoids import issues)
function generateUlid(): string {
  // ULID format: timestamp (10 chars) + randomness (16 chars) = 26 chars
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

/**
 * Taxonomy/Core veriler için idempotent seeding helper'ları
 * Bu fonksiyonlar mevcut verileri bulur, yoksa oluşturur
 * ID'lerin değişmemesini sağlar (referans bütünlüğü için kritik)
 */

// MainCategory için idempotent create/update
async function ensureMainCategory(config: { name: string; description?: string; imageKey?: SeedMediaKey }): Promise<{ id: string; name: string }> {
  // Eğer imageKey belirtilmemişse, mapping'den otomatik bul
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

// SubCategory için idempotent create/update
async function ensureSubCategory(config: { name: string; mainCategoryId: string; description?: string; imageKey?: SeedMediaKey }): Promise<{ id: string; name: string; mainCategoryId: string }> {
  // Eğer imageKey belirtilmemişse, mapping'den otomatik bul
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

// ProductGroup için idempotent create/update
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

// Product için idempotent create/update (name + brand bazlı)
async function ensureProduct(config: { name: string; brand?: string; groupId?: string; description?: string; imageKey?: SeedMediaKey }): Promise<{ id: string; name: string; brand?: string | null; groupId?: string | null }> {
  const whereClause: any = { name: config.name };
  if (config.brand) whereClause.brand = config.brand;
  
  const existing = await prisma.product.findFirst({
    where: whereClause
  });
  
  // Eğer imageKey belirtilmemişse, mapping'den otomatik bul
  let finalImageKey = config.imageKey;
  if (!finalImageKey) {
    finalImageKey = getProductImageKey(config.name, config.brand);
  }
  
  if (existing) {
    const updateData: any = {};
    if (config.description !== undefined) updateData.description = config.description;
    if (config.groupId !== undefined) updateData.groupId = config.groupId;
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
      name: config.name,
      brand: config.brand,
      groupId: config.groupId,
      description: config.description,
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
    imageKey: 'catalog.computers-tablets'
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
    imageKey: 'catalog.smart-home-devices'
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
  
  // ==================== ELECTRONICS PRODUCTS ====================
  
  // 1. PHONES
  console.log('📱 Phones kategorisi ürünleri...')
  
  // iPhone Series
  const iphoneSeries = await prisma.productGroup.findFirst({
    where: { name: 'iPhone Series' }
  })
  
  if (iphoneSeries) {
    // 25 iPhone models - basit isimlendirme
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
  
  // Samsung Galaxy
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
  
  // 2. LAPTOPS
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
  
  // 3. TABLETS
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
  
  // 4. AUDIO - 42 products
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
  
  // 5. WEARABLES - 30 products
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
  
  // 6. ACCESSORIES - 34 products
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
  
  // 7. CAMERAS - 40 products
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
  
  // ==================== BEAUTY PRODUCTS ====================
  
  // 1. SKINCARE - 100 products
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
  
  // 2. MAKEUP - 400 products
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
  
  // 3-7. Other Beauty categories - 205 products
  console.log('🌸 Diğer Beauty kategorileri ürünleri...')
  const otherBeautyStart = totalProducts
  
  // Fragrance - 45 products
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
  
  // Haircare - 40 products
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
  
  // Personal Care - 40 products
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
  
  // Nail Care - 30 products
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
  
  // Men's Grooming - 20 products
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
  
  let totalInventories = 0
  let totalInventoryMedia = 0
  
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
      
      // InventoryMedia ekle (ürünlerin %60'ına)
      if (Math.random() > 0.4) {
        const existingMedia = await prisma.inventoryMedia.findFirst({
          where: { inventoryId: inventory.id }
        })
        
        if (!existingMedia) {
          // Random product image seç (mevcut product key'lerinden)
          const productImageKeys = [
            'product.phone.phone1', 'product.phone.phone2', 'product.phone.samsung',
            'product.laptop.macbook', 'product.headphone.primary',
            'product.post.electronic-post-1', 'product.post.electronic-post-2',
            'product.post.makeup-post-1', 'product.post.makeup-post-2',
          ]
          const randomImageKey = productImageKeys[Math.floor(Math.random() * productImageKeys.length)] as SeedMediaKey
          const mediaUrl = getSeedMediaPath(randomImageKey, true)
          
          if (mediaUrl) {
            await prisma.inventoryMedia.create({
              data: {
                inventoryId: inventory.id,
                mediaUrl,
              }
            })
            totalInventoryMedia++
          }
        }
      }
    }
  }
  
  console.log('\n' + '═'.repeat(80))
  console.log('✨ USER INVENTORIES TAMAMLANDI\n')
  console.log(`   🎒 Toplam Inventory: ${totalInventories}`)
  console.log(`   📸 Toplam Inventory Media: ${totalInventoryMedia}`)
  console.log(`   👥 Kullanıcı Başına Ortalama: ${(totalInventories / users.length).toFixed(1)} ürün`)
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
  
  // Ürünleri getir
  const products = await prisma.product.findMany({ take: 500 })
  
  if (products.length === 0) {
    throw new Error('❌ Ürün bulunamadı! Önce Phase 5 tamamlanmalı.')
  }
  
  let totalPosts = 0
  const postTypes: Array<'QUESTION' | 'TIPS' | 'FREE' | 'EXPERIENCE' | 'COMPARE' | 'UPDATE'> = [
    'QUESTION', 'TIPS', 'FREE', 'EXPERIENCE', 'COMPARE', 'UPDATE'
  ]
  
  // Her kullanıcı için 60 post (6 tip x 10)
  for (const user of users) {
    console.log(`  📝 ${user.email} için postlar oluşturuluyor...`)
    
    // Kullanıcının inventory'sindeki ürünleri getir (EXPERIENCE ve UPDATE için)
    const userInventory = await prisma.inventory.findMany({
      where: { userId: user.id },
      include: { product: true }
    })
    
    for (const postType of postTypes) {
      // Her tipten 10 post
      for (let i = 1; i <= 10; i++) {
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
          productGroupId: selectedProduct.groupId ?? undefined,
          mainCategoryId: undefined,
          subCategoryId: undefined,
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
      }
    }
    
    console.log(`    ✅ ${user.email}: 60 post oluşturuldu`)
  }
  
  console.log(`\n✨ Toplam ${totalPosts} post oluşturuldu!\n`)
  console.log(`   📊 Dağılım: ${users.length} kullanıcı x 60 post`)
  console.log(`   📝 Her kullanıcı: 10 QUESTION, 10 TIPS, 10 FREE, 10 EXPERIENCE, 10 COMPARE, 10 UPDATE\n`)
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
  let totalCommentVotes = 0
  
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
  
  // 3. COMMENTS - Her post için 2-8 yorum (ortalama 5)
  console.log('💬 Comments ekleniyor...')
  const allComments: string[] = []
  
  for (const post of allPosts) {
    const commentCount = Math.floor(Math.random() * 7) + 2 // 2-8 arası
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
  
  // 4. COMMENT VOTES - Yorumların %50'sine vote
  console.log('👍👎 Comment votes ekleniyor...')
  const commentsToVote = allComments.sort(() => Math.random() - 0.5).slice(0, Math.floor(allComments.length * 0.5))
  
  for (const commentId of commentsToVote) {
    const voteCount = Math.floor(Math.random() * 10) + 1 // 1-10 vote
    const voters = users.sort(() => Math.random() - 0.5).slice(0, voteCount)
    
    for (const voter of voters) {
      const voteType: 'UPVOTE' | 'DOWNVOTE' = Math.random() > 0.3 ? 'UPVOTE' : 'DOWNVOTE'
      
      try {
        await prisma.contentCommentVote.create({
          data: {
            userId: voter.id,
            commentId,
            voteType,
          }
        })
        totalCommentVotes++
      } catch (e) {
        // Duplicate ignore
      }
    }
  }
  console.log(`  ✅ ${totalCommentVotes} comment vote eklendi`)
  
  // 5. SHARES - Her post için 3-4 paylaşım
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
  console.log(`   👍👎 Toplam Comment Votes: ${totalCommentVotes}`)
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

// ==================== PHASE 12: EVENTS ====================

/**
 * WishboxEvent oluştur (5-10 active + 3-5 upcoming)
 * Event participation, scenarios, rewards ekle
 */
async function seedEvents() {
  console.log('\n🎉 Events oluşturuluyor...\n')
  
  const users = await prisma.user.findMany({ take: 40 })
  const brands = await prisma.brand.findMany()
  
  if (users.length === 0) {
    console.log('⚠️ Kullanıcı bulunamadı, Phase 12 atlanıyor...')
    return
  }
  
  const eventTypes: Array<'SURVEY' | 'POLL' | 'CONTEST' | 'CHALLENGE' | 'PROMOTION'> = [
    'SURVEY', 'POLL', 'CONTEST', 'CHALLENGE', 'PROMOTION'
  ]
  
  const activeEvents: string[] = []
  const upcomingEvents: string[] = []
  
  // 1. ACTIVE EVENTS (5-10 etkinlik - şu anda devam ediyor)
  console.log('📅 Active events oluşturuluyor...')
  const activeCount = Math.floor(Math.random() * 6) + 5 // 5-10
  
  for (let i = 1; i <= activeCount; i++) {
    const eventId = generateUlid()
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)]
    const randomBrand = brands.length > 0 ? brands[Math.floor(Math.random() * brands.length)] : null
    
    const startDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // 0-30 gün önce başladı
    const endDate = new Date(Date.now() + Math.random() * 60 * 24 * 60 * 60 * 1000) // 0-60 gün sonra bitecek
    
    await prisma.wishboxEvent.create({
      data: {
        id: eventId,
        title: `${eventType} Event ${i} - ${randomBrand?.name || 'Community'}`,
        description: `Bu bir ${eventType} etkinliğidir. Katılımcılar deneyimlerini paylaşabilir, ödüller kazanabilir ve toplulukla etkileşime geçebilirler.`,
        startDate,
        endDate,
        status: 'PUBLISHED',
        eventType,
        brandId: randomBrand?.id ?? null,
        imageUrl: null,
      }
    })
    
    activeEvents.push(eventId)
  }
  console.log(`  ✅ ${activeCount} active event oluşturuldu`)
  
  // 2. UPCOMING EVENTS (3-5 etkinlik - henüz başlamadı)
  console.log('📅 Upcoming events oluşturuluyor...')
  const upcomingCount = Math.floor(Math.random() * 3) + 3 // 3-5
  
  for (let i = 1; i <= upcomingCount; i++) {
    const eventId = generateUlid()
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)]
    const randomBrand = brands.length > 0 ? brands[Math.floor(Math.random() * brands.length)] : null
    
    const startDate = new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000) // 0-30 gün sonra başlayacak
    const endDate = new Date(startDate.getTime() + (30 + Math.random() * 30) * 24 * 60 * 60 * 1000) // 30-60 gün sürecek
    
    await prisma.wishboxEvent.create({
      data: {
        id: eventId,
        title: `Upcoming ${eventType} ${i} - ${randomBrand?.name || 'Community'}`,
        description: `Yakında başlayacak ${eventType} etkinliği. Takipte kalın!`,
        startDate,
        endDate,
        status: 'PUBLISHED',
        eventType,
        brandId: randomBrand?.id ?? null,
        imageUrl: null,
      }
    })
    
    upcomingEvents.push(eventId)
  }
  console.log(`  ✅ ${upcomingCount} upcoming event oluşturuldu`)
  
  // 3. EVENT PARTICIPATION (WishboxStats - sadece active events için)
  console.log('👥 Event participation ekleniyor...')
  let totalParticipants = 0
  
  for (const eventId of activeEvents) {
    // Her event için 20-35 kullanıcı katılımcı
    const participantCount = Math.floor(Math.random() * 16) + 20 // 20-35
    const participants = users.sort(() => Math.random() - 0.5).slice(0, participantCount)
    
    for (const user of participants) {
      await prisma.wishboxStats.create({
        data: {
          userId: user.id,
          eventId,
          totalParticipated: Math.floor(Math.random() * 5) + 1, // 1-5 kez katıldı
          totalComments: Math.floor(Math.random() * 10) + 1, // 1-10 yorum
          helpfulVotesReceived: Math.floor(Math.random() * 20) + 5, // 5-25 helpful vote
        }
      })
      totalParticipants++
    }
  }
  console.log(`  ✅ ${totalParticipants} event participation kaydı oluşturuldu`)
  
  // 4. EVENT POSTS (Her active event için 20-30 post)
  console.log('📝 Event postları oluşturuluyor...')
  let totalEventPosts = 0
  const products = await prisma.product.findMany({ take: 200 })
  
  for (const eventId of activeEvents) {
    const postCount = Math.floor(Math.random() * 11) + 20 // 20-30 post
    
    for (let i = 0; i < postCount; i++) {
      const randomUser = users[Math.floor(Math.random() * users.length)]
      const randomProduct = products[Math.floor(Math.random() * products.length)]
      const postTypes: Array<'FREE' | 'EXPERIENCE' | 'TIPS'> = ['FREE', 'EXPERIENCE', 'TIPS']
      const postType = postTypes[Math.floor(Math.random() * postTypes.length)]
      
      await prisma.contentPost.create({
        data: {
          id: generateUlid(),
          userId: randomUser.id,
          type: postType,
          title: `Event Post ${i + 1} - ${randomProduct.name}`,
          body: `Bu event için paylaşımım: ${randomProduct.name} hakkında deneyimlerim ve düşüncelerim.`,
          productId: randomProduct.id,
          productGroupId: randomProduct.groupId ?? null,
          mainCategoryId: null,
          subCategoryId: null,
          inventoryRequired: false,
          isBoosted: false,
          eventId, // Event ile ilişkilendir
          createdAt: new Date(Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000),
        }
      })
      totalEventPosts++
    }
  }
  console.log(`  ✅ ${totalEventPosts} event post oluşturuldu`)
  
  // 5. EVENT SCENARIOS (Her active event için 2-3 senaryo)
  console.log('🎬 Event scenarios ekleniyor...')
  let totalScenarios = 0
  
  for (const eventId of activeEvents) {
    const scenarioCount = Math.floor(Math.random() * 2) + 2 // 2-3 senaryo
    
    for (let i = 1; i <= scenarioCount; i++) {
      await prisma.wishboxScenario.create({
        data: {
          eventId,
          title: `Senaryo ${i}`,
          description: `Bu senaryoda kullanıcılar belirli görevleri tamamlayarak puan kazanabilirler.`,
          orderIndex: i,
        }
      })
      totalScenarios++
    }
  }
  console.log(`  ✅ ${totalScenarios} scenario oluşturuldu`)
  
  // 6. EVENT REWARDS (Bazı kullanıcılara ödül)
  console.log('🏆 Event rewards ekleniyor...')
  let totalRewards = 0
  
  for (const eventId of activeEvents) {
    // Her event için 5-10 kullanıcıya ödül
    const rewardCount = Math.floor(Math.random() * 6) + 5 // 5-10
    const winners = users.sort(() => Math.random() - 0.5).slice(0, rewardCount)
    
    for (const winner of winners) {
      const rewardTypes: Array<'TIPS' | 'BADGE' | 'TITLE'> = ['TIPS', 'BADGE', 'TITLE']
      const rewardType = rewardTypes[Math.floor(Math.random() * rewardTypes.length)]
      
      await prisma.wishboxReward.create({
        data: {
          userId: winner.id,
          eventId,
          rewardType,
          rewardId: Math.floor(Math.random() * 1000) + 1,
          amount: Math.floor(Math.random() * 500) + 100, // 100-600
        }
      })
      totalRewards++
    }
  }
  console.log(`  ✅ ${totalRewards} reward oluşturuldu`)
  
  // Özet
  console.log('\n' + '═'.repeat(80))
  console.log('✨ PHASE 12 TAMAMLANDI - EVENTS\n')
  console.log(`   🎉 Toplam Events: ${activeCount + upcomingCount}`)
  console.log(`      📅 Active: ${activeCount}`)
  console.log(`      🔜 Upcoming: ${upcomingCount}`)
  console.log(`   👥 Total Participants: ${totalParticipants}`)
  console.log(`   📝 Event Posts: ${totalEventPosts}`)
  console.log(`   🎬 Scenarios: ${totalScenarios}`)
  console.log(`   🏆 Rewards: ${totalRewards}`)
  console.log(`\n   📊 Ortalama event başına: ${(totalParticipants / activeCount).toFixed(1)} katılımcı`)
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
      
      const nft = await prisma.nFT.create({
        data: {
          name: `${name} #${Math.floor(Math.random() * 9999) + 1}`,
          description: `A ${rarity.toLowerCase()} ${nftType.toLowerCase()} NFT with unique attributes.`,
          imageUrl: getSeedMediaPath('product.post.electronic-post-1') ?? '', // Fallback to product image
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
    const avatarUrl = getSeedMediaPath(userConfig.avatarKey, true)
    
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
  'product.phone.phone1',
  'product.phone.phone2',
  'product.phone.phone3',
  'product.phone.phone4',
  'product.phone.phone5',
  'product.phone.phone6',
  'product.phone.samsung',
  // Diğer ürün görselleri
  'product.laptop.macbook',
  'product.vacuum.dyson',
  'product.headphone.primary',
  'product.headphone.secondary',
  'product.smartwatch',
  // Post görselleri (electronic-post) - feed'de kullanılabilir
  'product.post.electronic-post-1',
  'product.post.electronic-post-2',
  'product.post.electronic-post-3',
  'product.post.electronic-post-4',
  'product.post.electronic-post-5',
  'product.post.electronic-post-6',
  'product.post.electronic-post-7',
  'product.post.electronic-post-8',
  'product.post.electronic-post-9',
  'product.post.electronic-post-10',
  // Post görselleri (makeup-post) - feed'de kullanılabilir
  'product.post.makeup-post-1',
  'product.post.makeup-post-2',
  'product.post.makeup-post-3',
  'product.post.makeup-post-4',
  'product.post.makeup-post-5',
  'product.post.makeup-post-6',
  'product.post.makeup-post-7',
  'product.post.makeup-post-8',
  'product.post.makeup-post-9',
  'product.post.makeup-post-10',
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
      const imageKey = getProductImageKey(product.name, product.brand || undefined);
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
      userId: userIdToUse,
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
          userId: userIdToUse,
          productId: product.id,
          hasOwned: true,
          experienceSummary: `Real‑life ownership experience with ${product.name}`,
        },
      }).catch(() => null)
      if (newInventory) {
        inventoryId = newInventory.id
        inventoryMap.set(product.id, inventoryId)
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
async function assignEventImages(): Promise<void> {
  const communityEventImages = [
    'communityevents-the-gaming-night.jpg',
    'communityevents-the-urban-commuter.jpg',
    'communityevents-the-rainy-day-sanctuary.jpg',
    'communityevents-the-hikers-summit.jpg',
    'communityevents-the-content-creator.jpg',
    'communityevents-the-skincare-ritual.jpg',
    'communityevents-the-digital-nomad-day.jpg',
    'communityevents-the-smart-home-geek.jpg',
    'communityevents-the-masterchef-weekend.jpg',
    'communityevents-the-road-trip-ready.jpg',
  ]

  // Event'lere görseller ata
  const events = await prisma.wishboxEvent.findMany({
    where: {
      OR: [
        { imageUrl: null },
        { imageUrl: 'events/event.png' },
      ],
    },
  })

  const communityImageKeys = communityEventImages.map(f => `events/${f}`)
  let imageIndex = 0
  let updated = 0

  for (const event of events) {
    const randomImageKey = communityImageKeys[imageIndex % communityImageKeys.length]
    imageIndex++

    await prisma.wishboxEvent.update({
      where: { id: event.id },
      data: { imageUrl: randomImageKey },
    })
    updated++
  }

  console.log(`   ✅ ${updated} event güncellendi (görseller upload-seed-media.ts ile yüklenmeli)`)
}

// ===== APPLE BRAND EVENTS EKLE =====
async function addAppleBrandEvents(): Promise<void> {
  const APPLE_BRAND_ID = '081d5660-a6d6-412a-b0ae-1557acaaa028'
  const appleBrand = await prisma.brand.findUnique({
    where: { id: APPLE_BRAND_ID },
  })

  if (!appleBrand) {
    console.warn(`   ⚠️  Apple brand bulunamadı: ${APPLE_BRAND_ID}`)
    return
  }

  const existingEvents = await prisma.wishboxEvent.findMany({
    where: { brandId: APPLE_BRAND_ID } as any,
    select: { title: true },
  })

  const existingTitles = new Set(existingEvents.map(e => e.title))
  const today = new Date()

  const surveyEvents = [
    { title: 'Apple Ürün Deneyimi Anketi', description: 'Apple ürünlerinizi kullanırken yaşadığınız deneyimleri paylaşın.', eventType: 'SURVEY' as const },
    { title: 'Apple Ekosistem Memnuniyeti', description: 'Apple ekosisteminin birlikte kullanım deneyiminizi değerlendirin.', eventType: 'SURVEY' as const },
    { title: 'Apple Watch Kullanım Anketi', description: 'Apple Watch kullanıcıları! Sağlık takibi ve özellikler hakkındaki görüşlerinizi paylaşın.', eventType: 'SURVEY' as const },
    { title: 'AirPods Deneyim Anketi', description: 'AirPods kullanıcıları! Ses kalitesi ve konfor hakkındaki görüşlerinizi paylaşın.', eventType: 'SURVEY' as const },
    { title: 'MacBook Performans Değerlendirmesi', description: 'MacBook kullanıcıları! Performans ve pil ömrü hakkındaki görüşlerinizi paylaşın.', eventType: 'SURVEY' as const },
  ]

  const otherEvents = [
    { title: 'Apple Ürün Fotoğraf Yarışması', description: 'En güzel Apple ürün fotoğrafınızı paylaşın ve ödüller kazanın!', eventType: 'CONTEST' as const },
    { title: 'Apple Kullanım İpuçları Challenge', description: 'Apple ürünlerinizle ilgili en yararlı ipuçlarınızı paylaşın.', eventType: 'CHALLENGE' as const },
    { title: 'En İyi Apple Ürünü Anketi', description: 'Hangi Apple ürününü en çok seviyorsunuz?', eventType: 'POLL' as const },
    { title: 'Apple Yeni Özellik İstekleri', description: 'Apple\'dan hangi yeni özellikleri görmek istersiniz?', eventType: 'POLL' as const },
    { title: 'Apple Ürün Karşılaştırma Challenge', description: 'Farklı Apple ürün modellerini karşılaştırın.', eventType: 'CHALLENGE' as const },
  ]

  const allEvents = [...surveyEvents, ...otherEvents]
  const communityEventImages = [
    'communityevents-the-gaming-night.jpg',
    'communityevents-the-urban-commuter.jpg',
    'communityevents-the-rainy-day-sanctuary.jpg',
    'communityevents-the-hikers-summit.jpg',
    'communityevents-the-content-creator.jpg',
  ]

  let created = 0

  for (let i = 0; i < allEvents.length; i++) {
    const eventData = allEvents[i]
    if (existingTitles.has(eventData.title)) continue

    const startDate = new Date(today)
    startDate.setDate(today.getDate() + i * 2)
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 14)

    const randomImage = communityEventImages[i % communityEventImages.length]
    const imageUrl = `events/${randomImage}`

    await prisma.wishboxEvent.create({
      data: {
        id: generateUlid(),
        title: eventData.title,
        description: eventData.description,
        eventType: eventData.eventType,
        brandId: APPLE_BRAND_ID,
        imageUrl,
        startDate,
        endDate,
        status: 'PUBLISHED',
      },
    })
    created++
  }

  console.log(`   ✅ ${created} Apple brand event eklendi`)
}

// ===== APPLE FEED IPHONE GÖRSELLERİNİ GÜNCELLE =====
// NOT: Görsel yükleme artık upload-seed-media.ts script'i ile yapılıyor
// Bu fonksiyon sadece mevcut görselleri post'lara atar
async function assignAppleFeedIphoneImages(): Promise<void> {
  const APPLE_BRAND_ID = '081d5660-a6d6-412a-b0ae-1557acaaa028'
  
  const IPHONE_IMAGES = [
    'apple-product-iphone17.png',
    'apple-product-iphone17pro.png',
    'apple-product-iphone16e.png',
    'apple-product-iphoneair.png',
  ]

  function getRandomIphoneImage(postId: string): string {
    let hash = 0
    for (let i = 0; i < postId.length; i++) {
      hash = ((hash << 5) - hash) + postId.charCodeAt(i)
      hash = hash & hash
    }
    const index = Math.abs(hash) % IPHONE_IMAGES.length
    return IPHONE_IMAGES[index]
  }

  const appleBrand = await prisma.brand.findUnique({
    where: { id: APPLE_BRAND_ID },
  })

  if (!appleBrand) {
    console.warn(`   ⚠️  Apple brand bulunamadı: ${APPLE_BRAND_ID}`)
    return
  }

  const appleProducts = await prisma.product.findMany({
    where: {
      brand: appleBrand.name,
      OR: [
        { name: { contains: 'iPhone', mode: 'insensitive' } },
        { name: { startsWith: 'Apple', mode: 'insensitive' } },
      ],
    },
  })

  if (appleProducts.length === 0) {
    console.warn('   ⚠️  Apple iPhone ürünü bulunamadı')
    return
  }

  const productIds = appleProducts.map(p => p.id)
  const posts = await prisma.contentPost.findMany({
    where: { productId: { in: productIds } },
  })

  if (posts.length === 0) {
    console.warn('   ⚠️  iPhone ürünlerine ait post bulunamadı')
    return
  }

  let updated = 0

  for (const post of posts) {
    const randomImage = getRandomIphoneImage(post.id)
    const targetKey = `products/apple/${randomImage}`

    // PostMedia'yı güncelle veya oluştur
    const existingMedia = await prisma.postMedia.findFirst({
      where: { postId: post.id },
    })

    if (existingMedia) {
      await prisma.postMedia.update({
        where: { id: existingMedia.id },
        data: { mediaUrl: targetKey },
      })
    } else {
      await prisma.postMedia.create({
        data: {
          postId: post.id,
          userId: post.userId,
          mediaUrl: targetKey,
          orderIndex: 0,
        },
      })
    }
    updated++
  }

  console.log(`   ✅ ${updated} post media güncellendi (görseller upload-seed-media.ts ile yüklenmeli)`)
}

// ===== EVENT POST'LARINA PRODUCT EKLE =====
async function addProductToEventPosts(): Promise<void> {
  // Event'e ait post'ları bul (scenario choice'lar üzerinden)
  const scenarios = await prisma.wishboxScenario.findMany({
    include: {
      choices: {
        include: {
          user: true,
        },
      },
    },
  })

  const participantUserIds = new Set<string>()
  scenarios.forEach((scenario) => {
    scenario.choices.forEach((choice) => {
      participantUserIds.add(choice.userId)
    })
  })

  if (participantUserIds.size === 0) {
    console.warn('   ⚠️  Event\'e katılan kullanıcı bulunamadı')
    return
  }

  // Bu kullanıcıların productId'si olmayan post'larını bul
  const posts = await prisma.contentPost.findMany({
    where: {
      userId: { in: Array.from(participantUserIds) },
      productId: null,
    },
  })

  if (posts.length === 0) {
    console.warn('   ⚠️  Güncellenecek post bulunamadı')
    return
  }

  // Varsayılan product'ı bul
  const targetProduct = await prisma.product.findFirst({
    include: {
      group: {
        include: {
          subCategory: {
            include: {
              mainCategory: true,
            },
          },
        },
      },
    },
  })

  if (!targetProduct) {
    console.warn('   ⚠️  Product bulunamadı')
    return
  }

  const productGroup = (targetProduct as any).group
  const subCategory = productGroup?.subCategory
  const mainCategory = subCategory?.mainCategory

  let updated = 0

  for (const post of posts) {
    await prisma.contentPost.update({
      where: { id: post.id },
      data: {
        productId: targetProduct.id,
        productGroupId: targetProduct.groupId || post.productGroupId || undefined,
        subCategoryId: productGroup?.subCategoryId || post.subCategoryId || undefined,
        mainCategoryId: mainCategory?.id || post.mainCategoryId || undefined,
      },
    })
    updated++
  }

  console.log(`   ✅ ${updated} post güncellendi`)
}

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
  
  // Kategorileri bul
  const techCategory = await prisma.mainCategory.findFirst({ where: { name: 'Teknoloji' } })
  const evYasamCategory = await prisma.mainCategory.findFirst({ where: { name: 'Ev & Yaşam' } })
  
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
          brand: brand.name,
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
            userId: userIdToUse,
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
            userId: userIdToUse,
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

  // MinIO bucket kontrolü ve oluşturma (seed başlamadan önce)
  console.log('📦 MinIO bucket kontrolü yapılıyor...\n')
  try {
    const s3Service = new S3Service()
    await s3Service.checkAndCreateBucket()
    console.log('✅ MinIO bucket hazır\n')
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

  // Progress bar oluştur (toplam 25 ana adım - PostMedia migration eklendi)
  const totalSteps = 25
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

  // 4. Product Categories (Electronics, Beauty with subcategories and product groups)
  progress.increment('Kategori yapısı oluşturuluyor...')
  await seedProductCategories()
  progress.increment('Kategori yapısı oluşturuldu')
  
  // Main categories'i sonraki fonksiyonlar için hazırla (sadece Electronics & Beauty)
  const mainCategories = await prisma.mainCategory.findMany()
  console.log(`📂 ${mainCategories.length} main category bulundu (Electronics & Beauty)`)

  // 5. Brand System (BrandCategory + Brands with logos and banners)
  progress.increment('Brand sistemi oluşturuluyor...')
  await seedBrands()
  progress.increment('Brand sistemi oluşturuldu')

  // 6. Products (~1000 meaningful products with brand relationships)
  progress.increment('Ürünler oluşturuluyor...')
  await seedProducts()
  progress.increment('Ürünler oluşturuldu')
  
  // 6.5 User Inventories (Ürünler oluşturulduktan SONRA)
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

  // 12. Events (WishboxEvent + Participation + Rewards)
  progress.increment('Events oluşturuluyor...')
  await seedEvents()
  progress.increment('Events oluşturuldu')

  // 14. Messaging (DMThread, DMMessage, DMRequest)
  progress.increment('Messaging oluşturuluyor...')
  await seedMessaging()
  progress.increment('Messaging oluşturuldu')

  // 13. NFT & Marketplace (NFT, Attributes, Transactions, Listings)
  progress.increment('NFT & Marketplace oluşturuluyor...')
  await seedNFTMarketplace()
  progress.increment('NFT & Marketplace oluşturuldu')

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
  
  // Electronics kategorisini ve subcategory'lerini test user için kullanmak üzere al
  const techCategory = mainCategories.find(c => c.name === 'Electronics') || mainCategories[0]
  const TECH_MAIN_CATEGORY_ID = techCategory.id
  const techSubCategories = await prisma.subCategory.findMany({
    where: { mainCategoryId: techCategory.id },
    take: 10
  })
  console.log(`ℹ️  Test user için Electronics kategorisi kullanılacak (${techSubCategories.length} subcategory)`)
  
  // 7. Test User için veriler
  progress.increment('Test kullanıcı oluşturuluyor...')
  console.log('\n👤 Creating test user data for Ömer Faruk...')
  
  // Check if user exists
  let testUser = await prisma.user.findUnique({
    where: { id: TEST_USER_ID }
  })

  if (!testUser) {
    // Try to find by email first
    testUser = await prisma.user.findUnique({
      where: { email: 'omer@tipbox.co' }
    })
    
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          id: TEST_USER_ID,
          email: 'omer@tipbox.co',
          passwordHash: passwordHash,
          emailVerified: true,
          status: 'ACTIVE',
        }
      })
      console.log('✅ Test user created')
    } else {
      console.log('✅ Test user found by email, using existing user')
      // Update ID if needed (if different)
      if (testUser.id !== TEST_USER_ID) {
        console.log(`⚠️  User ID mismatch. Expected: ${TEST_USER_ID}, Found: ${testUser.id}`)
        console.log(`   Continuing with found user ID: ${testUser.id}`)
      }
    }
  } else {
    console.log('✅ Test user already exists')
  }

  const userIdToUse = testUser.id

  // Helper function: ContentPost oluştur veya mevcut olanı döndür (title + userId bazlı)
  // PostMedia ekleme helper fonksiyonu
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

  // Profile
  let profile = await prisma.profile.findUnique({
    where: { userId: userIdToUse }
  })

  if (!profile) {
    profile = await prisma.profile.create({
      data: {
        userId: userIdToUse,
        displayName: 'Ömer Faruk',
        userName: 'omerfaruk',
        bio: 'Passionate about exploring the latest gadgets and digital lifestyles. Sharing honest reviews and real-life experiences with tech products.',
        bannerUrl: DEFAULT_BANNER_URL,
        country: 'Turkey',
      }
    })
    console.log('✅ Profile created')
  } else {
    // Update profile if exists
    profile = await prisma.profile.update({
      where: { userId: userIdToUse },
      data: {
        displayName: 'Ömer Faruk',
        userName: 'omerfaruk',
        bio: 'Passionate about exploring the latest gadgets and digital lifestyles. Sharing honest reviews and real-life experiences with tech products.',
        bannerUrl: DEFAULT_BANNER_URL,
        country: 'Turkey',
      }
    })
    console.log('✅ Profile updated')
  }

  // User Avatar
  const existingAvatar = await prisma.userAvatar.findFirst({
    where: { userId: userIdToUse, isActive: true }
  })

  if (existingAvatar) {
    await prisma.userAvatar.update({
      where: { id: existingAvatar.id },
      data: {
        imageUrl: PRIMARY_AVATAR_URL ?? undefined,
        isActive: true,
      }
    })
  } else {
    // Deactivate old avatars
    await prisma.userAvatar.updateMany({
      where: { userId: userIdToUse },
      data: { isActive: false }
    })
    
    await prisma.userAvatar.create({
      data: {
        userId: userIdToUse,
        imageUrl: PRIMARY_AVATAR_URL ?? '',
        isActive: true,
      }
    })
  }
  console.log('✅ User avatar created')

  // Achievement Chains & Goals (for badge tasks)
  const achievementChain = await prisma.achievementChain.create({
    data: {
      name: 'Content Creator',
      description: 'Milestones for content creation',
      category: 'Content',
    }
  })

  const welcomeBadgeForGoals = badges.find(b => b.name === 'Welcome')!;

  const achievementGoals = await Promise.all([
    prisma.achievementGoal.create({
      data: {
        chainId: achievementChain.id,
        title: 'Complete Your Profile',
        requirement: 'Complete your user profile setup',
        rewardBadgeId: welcomeBadgeForGoals.id,
        pointsRequired: 1,
        difficulty: 'EASY',
      }
    }).catch(async () => {
      return prisma.achievementGoal.findFirst({
        where: { 
          chainId: achievementChain.id,
          title: 'Complete Your Profile'
        }
      });
    }),
    prisma.achievementGoal.create({
      data: {
        chainId: achievementChain.id,
        title: 'Post 10 Comments',
        requirement: 'Write 10 comments',
        rewardBadgeId: badges.find(b => b.name === 'Community Hero')?.id,
        pointsRequired: 10,
        difficulty: 'EASY',
      }
    }).catch(async () => {
      return prisma.achievementGoal.findFirst({
        where: { 
          chainId: achievementChain.id,
          title: 'Post 10 Comments'
        }
      });
    }),
    prisma.achievementGoal.create({
      data: {
        chainId: achievementChain.id,
        title: 'Collect 50 Likes',
        requirement: 'Get 50 likes on the content you share',
        rewardBadgeId: badges.find(b => b.name === 'Tip Master')?.id,
        pointsRequired: 50,
        difficulty: 'MEDIUM',
      }
    }).catch(async () => {
      return prisma.achievementGoal.findFirst({
        where: { 
          chainId: achievementChain.id,
          title: 'Collect 50 Likes'
        }
      });
    }),
    prisma.achievementGoal.create({
      data: {
        chainId: achievementChain.id,
        title: 'Share 20 Posts',
        requirement: 'Share 20 pieces of content',
        rewardBadgeId: badges.find(b => b.name === 'First Post')?.id,
        pointsRequired: 20,
        difficulty: 'MEDIUM',
      }
    }).catch(async () => {
      return prisma.achievementGoal.findFirst({
        where: { 
          chainId: achievementChain.id,
          title: 'Share 20 Posts'
        }
      });
    }),
  ])

  // Link achievement goals to Welcome badge
  const welcomeGoals = achievementGoals.filter(
    (g): g is NonNullable<typeof g> => !!g && g.rewardBadgeId === welcomeBadgeForGoals.id
  );

  if (welcomeGoals.length > 0) {
    await prisma.badge
      .update({
        where: { id: welcomeBadgeForGoals.id },
        data: {
          achievementGoals: {
            connect: welcomeGoals.map((g) => ({ id: g.id })),
          },
        },
      })
      .catch(() => {}); // Ignore if relation doesn't exist
  }

  const advancedAchievementChain = await prisma.achievementChain.create({
    data: {
      name: 'Collection Journey',
      description: 'A series that rewards benchmark and experience sharing',
      category: 'Engagement',
    }
  })

  const advancedAchievementGoals = await Promise.all([
    prisma.achievementGoal.create({
      data: {
        chainId: advancedAchievementChain.id,
        title: 'Publish 3 Benchmark Series',
        requirement: 'Share 3 detailed benchmark comparisons',
        rewardBadgeId: benchmarkSageBadge.id,
        pointsRequired: 3,
        difficulty: 'MEDIUM',
      }
    }),
    prisma.achievementGoal.create({
      data: {
        chainId: advancedAchievementChain.id,
        title: 'Complete 15 Experience Posts',
        requirement: 'Write long-form experiences across 15 different card types',
        rewardBadgeId: experienceCuratorBadge.id,
        pointsRequired: 15,
        difficulty: 'HARD',
      }
    }),
  ])
  const priceMetric = metrics.find((metric) => metric.name === 'Fiyat')
  const qualityMetric = metrics.find((metric) => metric.name === 'Kalite')
  const usabilityMetric = metrics.find((metric) => metric.name === 'Kullanım Kolaylığı')
  const durabilityMetric = metrics.find((metric) => metric.name === 'Dayanıklılık')
  const designMetric = metrics.find((metric) => metric.name === 'Tasarım')
  if (!priceMetric || !qualityMetric || !usabilityMetric || !durabilityMetric || !designMetric) {
    throw new Error('Comparison metrics eksik; seed devam edemiyor.')
  }

  // Link achievement goals to badges (already done above)
  console.log('✅ Achievement goals created')

  // 5.c Additional achievement badges for all status states
  console.log('🎯 Creating additional achievement badges for all status states...')
  const brandBadgeKeys: SeedMediaKey[] = [
    'badge.brand.brandbadge1',
    'badge.brand.brandbadge2',
    'badge.brand.brandbadge3',
    'badge.brand.brandbadge4',
    'badge.brand.brandbadge5',
    'badge.brand.brandbadge6',
  ] as any;

  type AchievementStatus = 'not-started' | 'in_progress' | 'completed';

  const extraAchievementConfigs: Array<{
    title: string;
    description: string;
    status: AchievementStatus;
    total: number;
    current: number;
    imageKey: SeedMediaKey;
  }> = [];

  const makeTitle = (base: string, index: number) => `${base} #${index + 1}`;

  // 10 not-started
  for (let i = 0; i < 10; i++) {
    extraAchievementConfigs.push({
      title: makeTitle('Explorer', i),
      description: 'Discover new brands and products across the Tipbox community.',
      status: 'not-started',
      total: 10,
      current: 0,
      imageKey: brandBadgeKeys[i % brandBadgeKeys.length],
    });
  }

  // 10 in_progress
  for (let i = 0; i < 10; i++) {
    extraAchievementConfigs.push({
      title: makeTitle('Storyteller', i),
      description: 'Share detailed stories and experiences about your products.',
      status: 'in_progress',
      total: 20,
      current: 5 + i, // 5..14
      imageKey: brandBadgeKeys[i % brandBadgeKeys.length],
    });
  }

  // 10 completed
  for (let i = 0; i < 10; i++) {
    extraAchievementConfigs.push({
      title: makeTitle('Trusted Voice', i),
      description: 'Become a trusted voice by helping other users make decisions.',
      status: 'completed',
      total: 15,
      current: 15 + i, // >= total
      imageKey: brandBadgeKeys[i % brandBadgeKeys.length],
    });
  }

  const extraBadges = await Promise.all(
    extraAchievementConfigs.map(async (cfg) => {
      // Görsel yoksa null kullan (optional)
      const imageUrl = getSeedMediaPath(cfg.imageKey, true) || null;
      
      const badge = await prisma.badge.create({
        data: {
          name: cfg.title,
          description: cfg.description,
          type: 'ACHIEVEMENT' as any,
          rarity: 'COMMON' as any,
          boostMultiplier: 1.0,
          rewardMultiplier: 1.0,
          categoryId: achievementCategory.id,
          imageUrl,
        },
      });

      const goal = await prisma.achievementGoal.create({
        data: {
          chainId: advancedAchievementChain.id,
          title: cfg.title,
          requirement: cfg.description,
          rewardBadgeId: badge.id,
          pointsRequired: cfg.total,
          difficulty: 'EASY',
        },
      });

      await prisma.userAchievement.upsert({
        where: {
          userId_goalId: {
            userId: userIdToUse,
            goalId: goal.id,
          },
        },
        update: {
          progress: cfg.current,
          completed: cfg.current >= cfg.total,
        },
        create: {
          userId: userIdToUse,
          goalId: goal.id,
          progress: cfg.current,
          completed: cfg.current >= cfg.total,
        },
      });

      return badge;
    })
  );
  console.log(`✅ ${extraBadges.length} extra achievement badges created for all status states`)

  const advancedUserAchievementSeeds = [
    {
      goalId: advancedAchievementGoals[0].id,
      progress: 1,
      completed: false,
    },
    {
      goalId: advancedAchievementGoals[1].id,
      progress: 0,
      completed: false,
    },
  ]

  for (const seed of advancedUserAchievementSeeds) {
    await prisma.userAchievement.upsert({
      where: {
        userId_goalId: {
          userId: userIdToUse,
          goalId: seed.goalId,
        },
      },
      update: {
        progress: seed.progress,
        completed: seed.completed,
      },
      create: {
        userId: userIdToUse,
        goalId: seed.goalId,
        progress: seed.progress,
        completed: seed.completed,
      },
    })
  }
  console.log('✅ Advanced user achievements initialized')

  // User Titles
  const titles = [
    { title: 'Technology Enthusiast' },
    { title: 'Hardware Expert' },
    { title: 'Digital Surfer' },
    { title: 'Early Tech Adopter' },
  ]
  
  // Batch kontrol: Tüm mevcut title'ları tek sorguda al
  const existingTitles = await prisma.userTitle.findMany({
    where: { userId: userIdToUse },
    select: { title: true },
  }).catch(() => [])
  const existingTitleSet = new Set(existingTitles.map(t => t.title))

  let createdTitles = 0
  for (const titleData of titles) {
    // Hızlı Set kontrolü (DB sorgusu yok)
    if (existingTitleSet.has(titleData.title)) continue
    
    await prisma.userTitle.create({
      data: {
        userId: userIdToUse,
        title: titleData.title,
        earnedAt: new Date(),
      }
    }).catch(() => {})
    existingTitleSet.add(titleData.title)
    createdTitles++
  }
  console.log(`✅ ${createdTitles} user titles created (${titles.length - createdTitles} zaten mevcut)`)

  // User Badges (claimed badges for collections/ladder)
  const welcomeBadge = badges.find(b => b.name === 'Welcome')!
  const firstPostBadge = badges.find(b => b.name === 'First Post')!
  const tipMasterBadge = badges.find(b => b.name === 'Tip Master')!
  const earlyBirdBadge = badges.find(b => b.name === 'Early Bird')!
  const communityHeroBadge = badges.find(b => b.name === 'Community Hero') || null
  
  // Link achievement goals to badges
  // Connect goals where the badge is the reward
  const validAchievementGoals = achievementGoals.filter((g): g is NonNullable<typeof g> => g !== null);
  const welcomeGoal = validAchievementGoals.find(g => g.rewardBadgeId === welcomeBadgeForGoals.id);
  const communityHeroBadgeId = badges.find(b => b.name === 'Community Hero')?.id;
  const tipMasterBadgeId = badges.find(b => b.name === 'Tip Master')?.id;
  const firstPostBadgeId = badges.find(b => b.name === 'First Post')?.id;
  const communityHeroGoal = communityHeroBadgeId ? validAchievementGoals.find(g => g.rewardBadgeId === communityHeroBadgeId) : null;
  const tipMasterGoal = tipMasterBadgeId ? validAchievementGoals.find(g => g.rewardBadgeId === tipMasterBadgeId) : null;
  const firstPostGoal = firstPostBadgeId ? validAchievementGoals.find(g => g.rewardBadgeId === firstPostBadgeId) : null;

  if (welcomeGoal) {
    await prisma.badge.update({
      where: { id: welcomeBadgeForGoals.id },
      data: {
        achievementGoals: {
          connect: { id: welcomeGoal.id }
        }
      }
    }).catch(() => {}) // Ignore if no relation
  }

  if (tipMasterGoal) {
    await prisma.badge.update({
      where: { id: tipMasterBadge.id },
      data: {
        achievementGoals: {
          connect: { id: tipMasterGoal.id }
        }
      }
    }).catch(() => {}) // Ignore if no relation
  }

  if (communityHeroGoal && communityHeroBadgeId) {
    await prisma.badge.update({
      where: { id: communityHeroBadgeId },
      data: {
        achievementGoals: {
          connect: { id: communityHeroGoal.id }
        }
      }
    }).catch(() => {}) // Ignore if no relation
  }

  if (firstPostGoal && firstPostBadgeId) {
    await prisma.badge.update({
      where: { id: firstPostBadgeId },
      data: {
        achievementGoals: {
          connect: { id: firstPostGoal.id }
        }
      }
    }).catch(() => {}) // Ignore if no relation
  }

  const baseAchievementBadgeSeeds = [
    { badgeId: welcomeBadge.id, claimed: true, claimedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    { badgeId: firstPostBadge.id, claimed: true, claimedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
    { badgeId: tipMasterBadge.id, claimed: true, claimedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    { badgeId: benchmarkSageBadge.id, claimed: false, claimedAt: null },
    { badgeId: experienceCuratorBadge.id, claimed: false, claimedAt: null },
  ]

  // Toplam 15 ACHIEVEMENT rozetini garanti et (koleksiyon endpoint'i için)
  const requiredAchievementCount = 15
  const achievementsSoFar = baseAchievementBadgeSeeds.length + (communityHeroBadge ? 1 : 0)
  const neededExtraAchievements = Math.max(0, requiredAchievementCount - achievementsSoFar)
  const selectedExtraAchievementBadges = extraBadges.slice(0, neededExtraAchievements)

  const extraAchievementBadgeSeeds = selectedExtraAchievementBadges.map((badge, index) => ({
    badgeId: badge.id,
    claimed: index < 4,
    claimedAt: index < 4 ? new Date(Date.now() - (10 + index) * 24 * 60 * 60 * 1000) : null,
  }))

  const userBadgesData = [
    ...baseAchievementBadgeSeeds,
    ...(communityHeroBadge ? [{ badgeId: communityHeroBadge.id, claimed: false, claimedAt: null }] : []),
    ...extraAchievementBadgeSeeds,
    // Event badge'leri koleksiyon sayısını etkilemesin ama hesapta dursun
    { badgeId: earlyBirdBadge.id, claimed: true, claimedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
  ]

  for (const badgeData of userBadgesData) {
    await prisma.userBadge.upsert({
      where: {
        userId_badgeId: {
          userId: TEST_USER_ID,
          badgeId: badgeData.badgeId,
        }
      },
      update: {
        claimed: badgeData.claimed,
        claimedAt: badgeData.claimedAt,
      },
      create: {
        userId: userIdToUse,
        badgeId: badgeData.badgeId,
        isVisible: true,
        visibility: 'PUBLIC',
        claimed: badgeData.claimed,
        claimedAt: badgeData.claimedAt,
      }
    })
  }
  console.log(`✅ ${userBadgesData.length} user badges created`)

  // Trust Relations (create some test users first for trust or use existing)
  progress.increment('Trust ilişkileri oluşturuluyor...')
  console.log('👥 Creating trust users...')
  const trustUserIds: string[] = []
  for (let i = 0; i < 5; i++) {
    const trustUserId = TRUST_USER_IDS[i]
    const trustUserEmail = `trust-user-${i}@tipbox.co`
    
    // Try to find existing user first
    let trustUser = await prisma.user.findUnique({
      where: { id: trustUserId }
    })
    
    if (!trustUser) {
      // Also check by email
      trustUser = await prisma.user.findUnique({
        where: { email: trustUserEmail }
      })
      
      if (!trustUser) {
        trustUser = await prisma.user.create({
          data: {
            id: trustUserId,
            email: trustUserEmail,
            passwordHash: passwordHash,
            emailVerified: true,
            status: 'ACTIVE',
          }
        })
      }
    }
    trustUserIds.push(trustUser.id)
    
    // Profile oluştur veya güncelle
    await prisma.profile.upsert({
      where: { userId: trustUser.id },
      update: {
        displayName: `Trust User ${i + 1}`,
        userName: `trustuser${i + 1}`,
        bannerUrl: DEFAULT_BANNER_URL,
      },
      create: {
        userId: trustUser.id,
        displayName: `Trust User ${i + 1}`,
        userName: `trustuser${i + 1}`,
        bannerUrl: DEFAULT_BANNER_URL,
      }
    })

    const trustAvatarKey = TRUST_USER_AVATAR_KEYS[i % TRUST_USER_AVATAR_KEYS.length]
    const trustAvatarUrl = getSeedMediaPath(trustAvatarKey, true) || getSeedMediaPath('user.avatar.default', true) || null
    await prisma.userAvatar.deleteMany({ where: { userId: trustUser.id } })
    await prisma.userAvatar.create({
      data: {
        userId: trustUser.id,
        imageUrl: trustAvatarUrl || '',
        isActive: true,
      },
    })

    const trustUserTitle = TRUST_USER_TITLE_OPTIONS[i % TRUST_USER_TITLE_OPTIONS.length]
    await prisma.userTitle.deleteMany({ where: { userId: trustUser.id } })
    await prisma.userTitle.create({
      data: {
        userId: trustUser.id,
        title: trustUserTitle,
        earnedAt: new Date(Date.now() - (i + 1) * 5 * 24 * 60 * 60 * 1000),
      },
    }).catch(() => {})

    await prisma.trustRelation.create({
      data: {
        trusterId: userIdToUse,
        trustedUserId: trustUser.id,
      }
    }).catch(() => {}) // Ignore if exists
  }

  // Trusters (users who trust test user)
  console.log('👥 Creating truster users...')
  for (let i = 0; i < 3; i++) {
    const trusterUserId = TRUSTER_USER_IDS[i]
    const trusterUserEmail = `truster-user-${i}@tipbox.co`
    
    // Try to find existing user first
    let trusterUser = await prisma.user.findUnique({
      where: { id: trusterUserId }
    })
    
    if (!trusterUser) {
      // Also check by email
      trusterUser = await prisma.user.findUnique({
        where: { email: trusterUserEmail }
      })
      
      if (!trusterUser) {
        trusterUser = await prisma.user.create({
          data: {
            id: trusterUserId,
            email: trusterUserEmail,
            passwordHash: passwordHash,
            emailVerified: true,
            status: 'ACTIVE',
          }
        })
      }
    }
    
    // Profile oluştur veya güncelle
    await prisma.profile.upsert({
      where: { userId: trusterUser.id },
      update: {
        displayName: `Truster User ${i + 1}`,
        userName: `truster${i + 1}`,
        bannerUrl: DEFAULT_BANNER_URL,
      },
      create: {
        userId: trusterUser.id,
        displayName: `Truster User ${i + 1}`,
        userName: `truster${i + 1}`,
        bannerUrl: DEFAULT_BANNER_URL,
      }
    })

    const trusterAvatarKey = TRUSTER_USER_AVATAR_KEYS[i % TRUSTER_USER_AVATAR_KEYS.length]
    const trusterAvatarUrl = getSeedMediaPath(trusterAvatarKey, true) || getSeedMediaPath('user.avatar.default', true) || null
    await prisma.userAvatar.deleteMany({ where: { userId: trusterUser.id } })
    await prisma.userAvatar.create({
      data: {
        userId: trusterUser.id,
        imageUrl: trusterAvatarUrl || '',
        isActive: true,
      },
    })

    const trusterUserTitle = TRUSTER_USER_TITLE_OPTIONS[i % TRUSTER_USER_TITLE_OPTIONS.length]
    await prisma.userTitle.deleteMany({ where: { userId: trusterUser.id } })
    await prisma.userTitle.create({
      data: {
        userId: trusterUser.id,
        title: trusterUserTitle,
        earnedAt: new Date(Date.now() - (i + 1) * 4 * 24 * 60 * 60 * 1000),
      },
    }).catch(() => {})

    await prisma.trustRelation.create({
      data: {
        trusterId: trusterUser.id,
        trustedUserId: userIdToUse,
      }
    }).catch(() => {})
  }
  console.log('✅ Trust relations created')

  // Community coach user for DM seeds
  progress.increment('Community coach kullanıcısı oluşturuluyor...')
  let communityCoach = await prisma.user.findUnique({ where: { id: COMMUNITY_COACH_USER_ID } })
  if (!communityCoach) {
    communityCoach = await prisma.user.create({
      data: {
        id: COMMUNITY_COACH_USER_ID,
        email: COMMUNITY_COACH_EMAIL,
        passwordHash,
        emailVerified: true,
        status: 'ACTIVE',
      },
    })
  }

  await prisma.profile.upsert({
    where: { userId: COMMUNITY_COACH_USER_ID },
    update: {
      displayName: 'Community Coach',
      userName: 'communitycoach',
      bannerUrl: DEFAULT_BANNER_URL,
      bio: 'Coach providing one-to-one support for Tipbox users',
    },
    create: {
      userId: COMMUNITY_COACH_USER_ID,
      displayName: 'Community Coach',
      userName: 'communitycoach',
      bannerUrl: DEFAULT_BANNER_URL,
      bio: 'Coach providing one-to-one support for Tipbox users',
    },
  })

  await prisma.userAvatar.deleteMany({ where: { userId: COMMUNITY_COACH_USER_ID } })
  await prisma.userAvatar.create({
    data: {
      userId: COMMUNITY_COACH_USER_ID,
      imageUrl: COMMUNITY_COACH_AVATAR_URL,
      isActive: true,
    },
  })

  await prisma.userTitle.deleteMany({ where: { userId: COMMUNITY_COACH_USER_ID } })
  await prisma.userTitle.create({
    data: {
      userId: COMMUNITY_COACH_USER_ID,
      title: 'Support Mentor',
      earnedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    },
  }).catch(() => {})

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

  // Create posts for Julia Havk
  if (juliaUser) {
    console.log('📝 Creating posts for Julia Havk...')
    
    // Check if Julia already has TIPS posts (duplicate kontrolü)
    const existingJuliaPosts = await prisma.contentPost.count({
      where: {
        userId: juliaUser.id,
        type: 'TIPS',
      },
    })
    
    if (existingJuliaPosts >= 3) { // 5'ten 3'e düşürüldü
      console.log(`✅ Julia zaten ${existingJuliaPosts} TIPS post'una sahip, post oluşturma atlanıyor`)
    } else {
      console.log(`📝 Julia'nın ${existingJuliaPosts} TIPS post'u var, yeni post'lar oluşturuluyor...`)
    
      // Get existing products and categories
      // Önce "Technology" kategorisini ara, yoksa "Teknoloji" ara
      const techCategory = await prisma.mainCategory.findFirst({ where: { name: 'Technology' } }) 
        || await prisma.mainCategory.findFirst({ where: { name: 'Teknoloji' } })
      const evYasamCategory = await prisma.mainCategory.findFirst({ where: { name: 'Ev & Yaşam' } })
      const phoneSubCategory = await prisma.subCategory.findFirst({ where: { name: 'Akıllı Telefonlar' } })
      const evYasamSubCategory = await prisma.subCategory.findFirst({ where: { name: 'Temizlik Ürünleri' } })
      
      // Get or find products
      const iphoneProduct = await prisma.product.findFirst({ 
        where: { name: { contains: 'iPhone' } } 
      }) || await prisma.product.findFirst({ where: { brand: 'Apple' } })
      
      const dysonProduct = await prisma.product.findFirst({ 
        where: { name: { contains: 'Dyson' } } 
      })
      
      const anyProduct = await prisma.product.findFirst()
      
      const product1 = iphoneProduct || anyProduct
      const allProducts = await prisma.product.findMany({ take: 2 })
      const product2 = dysonProduct || (allProducts.length > 1 ? allProducts[1] : allProducts[0]) || anyProduct
      
      if (!product1) {
        console.warn('⚠️ No products found, skipping post creation for Julia')
      } else {
      // 1. TIPS Post - Battery Life
      const tipsPost = await createOrGetContentPost({
        userId: juliaUser.id,
        type: 'TIPS',
        title: 'Maximizing Battery Life: Essential Tips for Modern Smartphones',
        body: 'After months of testing various smartphones, I\'ve discovered several key strategies to extend battery life significantly. First, always enable adaptive brightness and use dark mode when possible - this can save up to 30% battery on OLED screens. Second, disable background app refresh for apps you don\'t actively use. Third, keep your phone between 20-80% charge when possible rather than charging to 100% every time. Finally, use Wi-Fi instead of cellular data whenever available, as it consumes less power. These simple changes have extended my daily usage by 2-3 hours consistently.',
        productId: product1.id,
        mainCategoryId: techCategory?.id || null,
        subCategoryId: phoneSubCategory?.id || null,
        inventoryRequired: true,
        isBoosted: false,
      }).catch((e) => {
        console.warn('Tips post creation failed:', e)
        return null
      })
      const tipsPostId = tipsPost?.id || generateUlid()
      
      // Duplicate kontrolü: post_id unique constraint
      const existingTip1 = await prisma.postTip.findFirst({
        where: { postId: tipsPostId }
      });
      if (!existingTip1 && tipsPost) {
        await prisma.postTip.create({
          data: { postId: tipsPostId, tipCategory: 'USAGE', isVerified: true },
        }).catch(() => {})
      }
      
      await prisma.contentPostTag.createMany({
        data: [
          { postId: tipsPostId, tag: 'Battery Life' },
          { postId: tipsPostId, tag: 'Optimization' },
        ],
        skipDuplicates: true,
      }).catch(() => {})
      
      // Create inventory for tips post if needed
      let tipsInventory = await prisma.inventory.findFirst({
        where: { userId: juliaUser.id, productId: product1.id },
      })
      if (!tipsInventory) {
        tipsInventory = await prisma.inventory.create({
          data: {
            userId: juliaUser.id,
            productId: product1.id,
            hasOwned: true,
            experienceSummary: 'Long-term user experience with smartphone optimization',
          },
        }).catch(() => null)
      }
      
      // Add PostMedia for tips post
      try {
        const s3Service = new S3Service()
        const postImagePath = path.join(__dirname, '../tests/assets/post/post.jpg')
        if (existsSync(postImagePath)) {
          const postImageBuffer = readFileSync(postImagePath)
          const postImageKey = `posts/${juliaUser.id}/${tipsPostId}/image-0.jpg`
          // uploadFile() artık sadece path döndürür (tam URL değil)
          // DB'de sadece path tutulacak, response'larda resolveMediaUrl ile tam URL'ye çevrilecek
          const postMediaPath = await s3Service.uploadFile(postImageKey, postImageBuffer, 'image/jpeg')
          
          if (postMediaPath) {
            const createdMedia = await prisma.postMedia.create({
              data: {
                postId: tipsPostId,
                userId: juliaUser.id,
                mediaUrl: postMediaPath,
                orderIndex: 0,
              },
            })
            console.log(`✅ PostMedia oluşturuldu: ${createdMedia.id} (post: ${tipsPostId})`)
          } else {
            console.warn(`⚠️ PostMedia path alınamadı (post: ${tipsPostId})`)
          }
        } else {
          console.warn(`⚠️ Post görseli bulunamadı: ${postImagePath}`)
        }
      } catch (error) {
        console.error(`❌ Post media upload failed for tips post ${tipsPostId}:`, error)
      }
      
      // 2. TIPS Post - Camera Optimization
      const tipsPost2 = await createOrGetContentPost({
        userId: juliaUser.id,
        type: 'TIPS',
        title: 'Mastering Mobile Photography: Pro Tips for Stunning Photos',
        body: 'After years of mobile photography, I\'ve learned that lighting is everything. Always shoot during golden hour (sunrise/sunset) for the most flattering natural light. Use the grid feature to apply the rule of thirds - place your subject at intersection points for more dynamic compositions. For portraits, enable portrait mode and adjust the depth effect to create beautiful bokeh. Don\'t forget to clean your lens before shooting - a simple wipe can dramatically improve image quality. Finally, shoot in RAW format when possible for maximum editing flexibility. These techniques have transformed my mobile photography from good to professional-quality.',
        productId: product1.id,
        mainCategoryId: techCategory?.id || null,
        subCategoryId: phoneSubCategory?.id || null,
        inventoryRequired: true,
        isBoosted: false,
      }).catch((e) => {
        console.warn('Tips post 2 creation failed:', e)
        return null
      })
      const tipsPost2Id = tipsPost2?.id || generateUlid()
      
      // Duplicate kontrolü: post_id unique constraint
      const existingTip2 = await prisma.postTip.findFirst({
        where: { postId: tipsPost2Id }
      });
      if (!existingTip2 && tipsPost2) {
        await prisma.postTip.create({
          data: { postId: tipsPost2Id, tipCategory: 'USAGE', isVerified: true },
        }).catch(() => {})
      }
      
      await prisma.contentPostTag.createMany({
        data: [
          { postId: tipsPost2Id, tag: 'Photography' },
          { postId: tipsPost2Id, tag: 'Camera Tips' },
        ],
        skipDuplicates: true,
      }).catch(() => {})
      
      // Add PostMedia for tips post 2
      try {
        const s3Service = new S3Service()
        const postImagePath = path.join(__dirname, '../tests/assets/post/post.jpg')
        if (existsSync(postImagePath)) {
          const postImageBuffer = readFileSync(postImagePath)
          const postImageKey = `posts/${juliaUser.id}/${tipsPost2Id}/image-0.jpg`
          const postMediaPath = await s3Service.uploadFile(postImageKey, postImageBuffer, 'image/jpeg')
          
          if (postMediaPath) {
            const createdMedia = await prisma.postMedia.create({
              data: {
                postId: tipsPost2Id,
                userId: juliaUser.id,
                mediaUrl: postMediaPath,
                orderIndex: 0,
              },
            })
            console.log(`✅ PostMedia oluşturuldu: ${createdMedia.id} (post: ${tipsPost2Id})`)
          } else {
            console.warn(`⚠️ PostMedia path alınamadı (post: ${tipsPost2Id})`)
          }
        } else {
          console.warn(`⚠️ Post görseli bulunamadı: ${postImagePath}`)
        }
      } catch (error) {
        console.error(`❌ Post media upload failed for tips post ${tipsPost2Id}:`, error)
      }
      
      // 3. TIPS Post - Storage Management
      const tipsPost3 = await createOrGetContentPost({
        userId: juliaUser.id,
        type: 'TIPS',
        title: 'Smart Storage Management: Keep Your Device Running Smoothly',
        body: 'Running out of storage is frustrating, but it\'s easily preventable. Start by enabling iCloud Photos or Google Photos backup - this automatically offloads your photos while keeping thumbnails accessible. Regularly clear app caches, especially for social media apps which can accumulate gigabytes of cached data. Use the built-in storage analyzer to identify large files and apps you no longer need. Delete old downloads, podcasts, and offline content regularly. For music lovers, consider streaming instead of downloading entire libraries. Finally, enable automatic app offloading for unused apps - they\'ll be removed but can be reinstalled instantly when needed. Following these practices, I\'ve maintained 30% free space consistently.',
        productId: product1.id,
        mainCategoryId: techCategory?.id || null,
        subCategoryId: phoneSubCategory?.id || null,
        inventoryRequired: true,
        isBoosted: false,
      }).catch((e) => {
        console.warn('Tips post 3 creation failed:', e)
        return null
      })
      const tipsPost3Id = tipsPost3?.id || generateUlid()
      
      // Duplicate kontrolü: post_id unique constraint
      const existingTip3 = await prisma.postTip.findFirst({
        where: { postId: tipsPost3Id }
      });
      if (!existingTip3 && tipsPost3) {
        await prisma.postTip.create({
          data: { postId: tipsPost3Id, tipCategory: 'CARE', isVerified: true },
        }).catch(() => {})
      }
      
      await prisma.contentPostTag.createMany({
        data: [
          { postId: tipsPost3Id, tag: 'Storage' },
          { postId: tipsPost3Id, tag: 'Device Maintenance' },
          { postId: tipsPost3Id, tag: 'Optimization' },
        ],
        skipDuplicates: true,
      }).catch(() => {})
      
      // Add PostMedia for tips post 3
      try {
        const s3Service = new S3Service()
        const postImagePath = path.join(__dirname, '../tests/assets/post/post.jpg')
        if (existsSync(postImagePath)) {
          const postImageBuffer = readFileSync(postImagePath)
          const postImageKey = `posts/${juliaUser.id}/${tipsPost3Id}/image-0.jpg`
          const postMediaPath = await s3Service.uploadFile(postImageKey, postImageBuffer, 'image/jpeg')
          
          if (postMediaPath) {
            const createdMedia = await prisma.postMedia.create({
              data: {
                postId: tipsPost3Id,
                userId: juliaUser.id,
                mediaUrl: postMediaPath,
                orderIndex: 0,
              },
            })
            console.log(`✅ PostMedia oluşturuldu: ${createdMedia.id} (post: ${tipsPost3Id})`)
          } else {
            console.warn(`⚠️ PostMedia path alınamadı (post: ${tipsPost3Id})`)
          }
        } else {
          console.warn(`⚠️ Post görseli bulunamadı: ${postImagePath}`)
        }
      } catch (error) {
        console.error(`❌ Post media upload failed for tips post ${tipsPost3Id}:`, error)
      }
      
      console.log('✅ 3 TIPS posts created for Julia Havk')
      }
    }
  }

  // Products & Product Groups
  progress.increment('Product\'lar ve product group\'lar oluşturuluyor...')
  // Ev & Yaşam kategorisi için sub category bul
  const evYasamCategory = mainCategories.find(c => c.name === 'Ev & Yaşam')!
  const evYasamSubCategory = await prisma.subCategory.findFirst({
    where: { mainCategoryId: evYasamCategory.id }
  }) || await prisma.subCategory.create({
    data: {
      name: 'Temizlik Ürünleri',
      description: 'Süpürge, temizlik robotu vb.',
      mainCategoryId: evYasamCategory.id,
      imageUrl: null // ID oluşturulduktan sonra güncellenecek
    }
  })

  // Sub category imageUrl güncelle
  if (evYasamSubCategory && !evYasamSubCategory.imageUrl) {
    await prisma.subCategory.update({
      where: { id: evYasamSubCategory.id },
      data: {
        imageUrl: getSeedMediaPath('catalog.home-appliances', true) || null
      }
    });
  }

  const productGroup = await prisma.productGroup.create({
    data: {
      name: 'Dyson Vakum Temizleyiciler',
      description: 'Dyson marka vakum temizleyiciler',
      subCategoryId: evYasamSubCategory.id,
      imageUrl: null // ID oluşturulduktan sonra güncellenecek
    }
  })

  // Product group imageUrl güncelle
  await prisma.productGroup.update({
    where: { id: productGroup.id },
    data: {
      imageUrl: getSeedMediaPath('catalog.home-appliances', true) || null
    }
  });

  const product1 = await prisma.product.create({
    data: {
      name: 'Dyson V15s Detect Submarine',
      brand: 'Dyson',
      description: 'Gelişmiş sensörlü kablosuz süpürge',
      groupId: productGroup.id,
      imageUrl: null // ID oluşturulduktan sonra güncellenecek
    }
  })

  // Product imageUrl güncelle
  await prisma.product.update({
    where: { id: product1.id },
    data: {
      imageUrl: getSeedMediaPath('catalog.home-appliances', true) || null
    }
  });

  const product2 = await prisma.product.create({
    data: {
      name: 'Dyson V12 Detect Slim',
      brand: 'Dyson',
      description: 'Hafif ve güçlü kablosuz süpürge',
      groupId: productGroup.id,
      imageUrl: null // ID oluşturulduktan sonra güncellenecek
    }
  })

  // Product imageUrl güncelle
  await prisma.product.update({
    where: { id: product2.id },
    data: {
      imageUrl: getSeedMediaPath('catalog.home-appliances', true) || null
    }
  });

  const akilliTelefonSubCat = techSubCategories.find(c => c.name === 'Akıllı Telefonlar')!
  
  // Telefon markaları ve görsel eşleştirmeleri
  const phoneBrands = [
    { name: 'Samsung', brand: 'Samsung', phoneImage: 'product.phone.phone1' },
    { name: 'iPhone', brand: 'Apple', phoneImage: 'product.phone.phone2' },
    { name: 'Redmi', brand: 'Redmi', phoneImage: 'product.phone.phone3' },
    { name: 'Oppo', brand: 'Oppo', phoneImage: 'product.phone.phone4' },
    { name: 'Nokia', brand: 'Nokia', phoneImage: 'product.phone.phone5' },
    { name: 'Blackberry', brand: 'Blackberry', phoneImage: 'product.phone.phone6' },
  ];

  // Her marka için product group oluştur
  console.log('📱 Creating phone product groups...');
  const phoneProductGroups = await Promise.all(
    phoneBrands.map(async (brand) => {
      const existing = await prisma.productGroup.findFirst({
        where: { 
          name: `${brand.name} Serisi`,
          subCategoryId: akilliTelefonSubCat.id 
        }
      }).catch(() => null);

      if (existing) {
        return existing;
      }

      const group = await prisma.productGroup.create({
        data: {
          name: `${brand.name} Serisi`,
          description: `${brand.brand} marka telefon modelleri`,
          subCategoryId: akilliTelefonSubCat.id,
          imageUrl: getSeedMediaPath(brand.phoneImage as any, true) || null,
        }
      });
      return group;
    })
  );
  console.log(`✅ ${phoneProductGroups.length} phone product groups created`);

  // Category seviyesinde: Phone kategorisine tıklayınca 24 adet telefon (rastgele görseller)
  // Bu ürünler product group'a atanmaz (groupId: null) - category view için özel
  console.log('📱 Creating 24 random phone products for category view...');
  const phoneImages = ['product.phone.phone1', 'product.phone.phone2', 'product.phone.phone3', 'product.phone.phone4', 'product.phone.phone5', 'product.phone.phone6'];
  const categoryPhoneProducts: any[] = [];
  
  for (let i = 0; i < 24; i++) {
    // Rastgele marka ve görsel seç
    const randomBrandIndex = Math.floor(Math.random() * phoneBrands.length);
    const brand = phoneBrands[randomBrandIndex];
    const randomImageIndex = Math.floor(Math.random() * phoneImages.length);
    const selectedImage = phoneImages[randomImageIndex];
    
    const product = await prisma.product.create({
      data: {
        name: `${brand.brand} Model ${String(i + 1).padStart(2, '0')}`,
        brand: brand.brand,
        description: `${brand.brand} marka telefon modeli - ${i + 1}. ürün (Category View)`,
        groupId: null, // Category view için product group yok
        imageUrl: getSeedMediaPath(selectedImage as any, true) || null,
      }
    });
    categoryPhoneProducts.push(product);
  }
  console.log(`✅ ${categoryPhoneProducts.length} random phone products created for category view (no product group)`);

  // Product Group seviyesinde: Her marka için 20 adet telefon (aynı görsel)
  console.log('📱 Creating 20 products per brand for product group view...');
  const brandPhoneProducts: any[] = [];
  
  for (let brandIdx = 0; brandIdx < phoneBrands.length; brandIdx++) {
    const brand = phoneBrands[brandIdx];
    const productGroup = phoneProductGroups[brandIdx];
    const brandImage = brand.phoneImage;
    
    for (let i = 0; i < 20; i++) {
      // Model isimleri: Samsung A4, Samsung A5, Samsung A6... gibi
      const modelNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];
      const modelName = modelNames[i % modelNames.length];
      const modelNumber = Math.floor(i / modelNames.length) + 4; // A4, A5, A6... veya B4, B5...
      
      const product = await prisma.product.create({
        data: {
          name: `${brand.brand} ${modelName}${modelNumber}`,
          brand: brand.brand,
          description: `${brand.brand} ${modelName}${modelNumber} model telefon`,
          groupId: productGroup.id,
          imageUrl: getSeedMediaPath(brandImage as any, true) || null, // Hepsi aynı görsel (markanın görseli)
        }
      });
      brandPhoneProducts.push(product);
    }
  }
  console.log(`✅ ${brandPhoneProducts.length} brand-specific phone products created (20 per brand)`);

  const samsungPhone = brandPhoneProducts.find((product) => product.brand === 'Samsung') || brandPhoneProducts[0];
  const applePhone = brandPhoneProducts.find((product) => product.brand === 'Apple') || brandPhoneProducts[1] || samsungPhone;
  const redmiPhone = brandPhoneProducts.find((product) => product.brand === 'Redmi') || brandPhoneProducts[2] || samsungPhone;

  // Eski iPhone product'ı oluştur (geriye dönük uyumluluk için)
  const product3 = await prisma.product.create({
    data: {
      name: 'iPhone 15 Pro',
      brand: 'Apple',
      description: "Apple'ın en yeni flagship telefonu",
      groupId: phoneProductGroups.find(g => g.name === 'iPhone Serisi')!.id,
      imageUrl: getSeedMediaPath('product.phone.phone2' as any, true) || null,
    }
  });

  console.log('✅ Phone products created')

  // Inventory & Product Experience (Reviews için)
  const inventory1 = await prisma.inventory.create({
    data: {
      userId: userIdToUse,
      productId: product1.id,
      hasOwned: true,
      experienceSummary:
        'A solid daily driver that makes routine cleaning feel lighter and more structured in my apartment.',
    },
  })

  await prisma.productExperience.create({
    data: {
      inventoryId: inventory1.id,
      title: 'Price and Shopping Experience',
      experienceText:
        "I paid around $949 for the Dyson V15s Detect Submarine, which clearly sits in the premium segment compared to most cordless vacuums. " +
        'The upfront price felt high at checkout, but the build quality, accessories and suction performance justify most of that gap over time. ' +
        'The in‑store buying experience was smooth as well, with staff who actually understood the product and helped me choose the right bundle. ' +
        'Overall it felt like a considered investment rather than a random impulse purchase.',
    },
  })

  await prisma.productExperience.create({
    data: {
      inventoryId: inventory1.id,
      title: 'Product and Usage Experience',
      experienceText:
        'Using the Dyson V15s Submarine every day has completely changed how I approach cleaning at home. ' +
        'The wet cleaning head is especially useful in the kitchen and bathroom where sticky spills or dried stains used to require separate tools. ' +
        'Now I can move from hard floors to rugs without constantly thinking about settings or swapping devices. ' +
        'It feels like a single tool that replaces a mop, a classic vacuum and a quick spot cleaner in one routine.',
    }
  })

  await prisma.inventoryMedia.create({
    data: {
      inventoryId: inventory1.id,
      mediaUrl: INVENTORY_MEDIA_URL ?? '',
    }
  })

  // NOT: Post görselleri artık PostMedia tablosuna yazılıyor, InventoryMedia'ya değil
  // Bu kod kaldırıldı - PostMedia tablosu kullanılıyor
  console.log('✅ Inventory & Product Experiences created')

  // Ek ürünler için inventory & görseller (context bazlı post görselleri)
  const heroInventoryConfigs = [
    {
      productId: product2.id,
      hasOwned: true,
      summary:
        'I keep the Dyson V12 Slim as my travel vacuum; its light body makes quick hotel or small‑flat cleaning sessions much easier.',
      mediaKeys: ['product.vacuum.dyson'],
    },
    {
      productId: product3.id,
      hasOwned: true,
      summary:
        'The iPhone 15 Pro is my daily driver and the main phone I use for camera and video workflow tests.',
      mediaKeys: ['product.phone.phone2'],
    },
    {
      productId: samsungPhone?.id || product2.id,
      hasOwned: true,
      summary:
        'My Samsung phone takes over office tasks when I dock it into Dex with a keyboard, mouse and an external monitor.',
      mediaKeys: ['product.phone.phone1'],
    },
    {
      productId: applePhone?.id || product3.id,
      hasOwned: true,
      summary:
        'Inside the Apple ecosystem this device is my main camera for LOG recording and day‑to‑day content production.',
      mediaKeys: ['product.phone.phone2'],
    },
    {
      productId: redmiPhone?.id || product2.id,
      hasOwned: false,
      summary:
        'This Redmi phone is my budget device for testing MIUI betas and experimental settings without risking my main phone.',
      mediaKeys: ['product.phone.phone3'],
    },
  ];

  for (const config of heroInventoryConfigs) {
    let inventory = await prisma.inventory.findUnique({
      where: {
        userId_productId: {
          userId: userIdToUse,
          productId: config.productId,
        },
      },
    });

    if (!inventory) {
      inventory = await prisma.inventory.create({
        data: {
          userId: userIdToUse,
          productId: config.productId,
          hasOwned: config.hasOwned,
          experienceSummary: config.summary,
        },
      });
    } else {
      inventory = await prisma.inventory.update({
        where: { id: inventory.id },
        data: {
          hasOwned: config.hasOwned,
          experienceSummary: config.summary,
        },
      });
    }

    await prisma.inventoryMedia.deleteMany({ where: { inventoryId: inventory.id } });
    const mediaData = config.mediaKeys
      .map((key) => {
        const mediaUrl = getSeedMediaPath(key as SeedMediaKey, true) || null;
        if (!mediaUrl) {
          return null;
        }
        return {
          inventoryId: inventory.id,
          mediaUrl,
        };
      })
      .filter((item): item is { inventoryId: string; mediaUrl: string } => !!item);

    if (mediaData.length) {
      await prisma.inventoryMedia.createMany({ data: mediaData });
    }
  }
  console.log('✅ Additional inventory media created for hero products');

  // Content Posts
  console.log('🧹 Resetting FREE posts for balanced context coverage...');
  await prisma.contentPost.deleteMany({
    where: {
      userId: userIdToUse,
      type: 'FREE',
    },
  });

  const akilliTelefonlarSubCategory = techSubCategories.find((cat) => cat.name === 'Akıllı Telefonlar');
  const laptoplarSubCategory = techSubCategories.find((cat) => cat.name === 'Laptoplar');
  const kulakliklarSubCategory = techSubCategories.find((cat) => cat.name === 'Kulaklıklar');
  const samsungGroup = phoneProductGroups.find((group) => group.name === 'Samsung Serisi');
  const iphoneGroup = phoneProductGroups.find((group) => group.name === 'iPhone Serisi');
  const redmiGroup = phoneProductGroups.find((group) => group.name === 'Redmi Serisi');

  if (!akilliTelefonlarSubCategory || !laptoplarSubCategory || !kulakliklarSubCategory) {
    throw new Error('Teknoloji alt kategorileri bulunamadı (Akıllı Telefonlar, Laptoplar, Kulaklıklar)');
  }

  if (!samsungGroup || !iphoneGroup || !redmiGroup) {
    throw new Error('Telefon product group verileri eksik (Samsung/iPhone/Redmi)');
  }

  type ContextPostSeed = {
    title: string;
    body: string;
    mainCategoryId: string;
    subCategoryId?: string | null;
    productGroupId?: string | null;
    productId?: string | null;
    inventoryRequired?: boolean;
    isBoosted?: boolean;
    tags?: string[];
  };

  const productContextPosts: ContextPostSeed[] = [
    {
      title: 'My Deep Cleaning Routine with Dyson V15s',
      body:
        'The Submarine head lifts dried stains from the kitchen floor in a single pass, which used to take multiple tools. ' +
        'With the Dyson V15s I can move from carpets to hard floors without changing settings or worrying about modes. ' +
        'It turned weekend deep cleaning into a single, predictable routine instead of a long list of separate chores. ' +
        'I now schedule one focused session and the rest of the week only needs light touch‑ups.',
      mainCategoryId: evYasamCategory.id,
      subCategoryId: evYasamSubCategory.id,
      productGroupId: productGroup.id,
      productId: product1.id,
      inventoryRequired: true,
      isBoosted: false,
      tags: ['Dyson', 'WetCleaning'],
    },
    {
      title: 'Adding Dyson V12 Slim to My Travel Kit',
      body:
        'The V12 Slim lets me keep small apartments and short‑term stays under control without dragging a full‑size vacuum around. ' +
        'It fits easily into a corner of the car trunk or travel bag and is quick to set up after long trips. ' +
        'In narrow corridors and around furniture the lighter body is noticeable, especially compared to bulkier cordless models. ' +
        'For short getaways it feels like the right compromise between power, size and convenience.',
      mainCategoryId: evYasamCategory.id,
      subCategoryId: evYasamSubCategory.id,
      productGroupId: productGroup.id,
      productId: product2.id,
      inventoryRequired: true,
      isBoosted: true,
      tags: ['Dyson', 'Travel'],
    },
    {
      title: 'My Daily Notes on the iPhone 15 Pro Camera',
      body:
        'Shooting LOG video and using the tetraprism lens at 5x zoom has made my weekend vlog footage look much cleaner. ' +
        'USB‑C with an external SSD means I can offload long clips without waiting on old‑school transfer speeds. ' +
        'I now treat the phone like a compact cinema tool rather than just a casual camera. ' +
        'Most of my travel content goes straight from the phone into the edit without needing an extra dedicated camera body.',
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      productGroupId: iphoneGroup.id,
      productId: product3.id,
      inventoryRequired: true,
      isBoosted: false,
      tags: ['iPhone', 'Camera'],
    },
  ];

  const productGroupContextPosts: ContextPostSeed[] = [
    {
      title: 'Different Use Cases Across the Dyson Vacuum Series',
      body:
        'The Dyson series covers pet hair, shiny hardwood floors and quick kitchen cleanups with different heads on the same body. ' +
        'In our home I split the attachments by role: one stays docked for daily crumbs, another for deep weekend carpet runs. ' +
        'It is easier to explain “which head for which task” to the family than to keep multiple machines plugged in. ' +
        'Over time this setup has reduced clutter in the storage closet while keeping cleaning surprisingly flexible.',
      mainCategoryId: evYasamCategory.id,
      subCategoryId: evYasamSubCategory.id,
      productGroupId: productGroup.id,
      productId: null,
      inventoryRequired: false,
      isBoosted: true,
      tags: ['Dyson', 'Attachments'],
    },
    {
      title: 'Current One UI Experience Across the Samsung Series',
      body:
        'On Samsung phones in the same product group I use Good Lock modules to turn a desk setup into a mini workstation. ' +
        'Multi‑window layouts, custom gestures and a shared theme carry nicely from one device to the next. ' +
        'Even mid‑range models feel more consistent once you mirror the same One UI profile across them. ' +
        'For people who switch phones often inside the ecosystem this makes each upgrade feel familiar on day one.',
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      productGroupId: samsungGroup.id,
      productId: null,
      inventoryRequired: false,
      isBoosted: false,
      tags: ['Samsung', 'OneUI'],
    },
    {
      title: 'Using the Redmi Series as a Budget Ecosystem',
      body:
        'We use Redmi phones as a budget friendly ecosystem that can be shared across family members. ' +
        'Automation rules, shared battery‑saving profiles and Mi Home scenes make it easy to tune each phone without micro‑managing settings. ' +
        'Older relatives still get a simple, reliable setup while power users can keep their advanced tweaks. ' +
        'For the price range it creates a surprisingly coherent multi‑device experience.',
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      productGroupId: redmiGroup.id,
      productId: null,
      inventoryRequired: false,
      isBoosted: false,
      tags: ['Redmi', 'Budget'],
    },
  ];

  const subCategoryContextPosts: ContextPostSeed[] = [
    {
      title: 'eSIM and Dual‑SIM Scenarios on Smartphones',
      body:
        'In the smartphones subcategory I walk through how I juggle eSIM profiles and physical SIM combinations on different trips. ' +
        'There is a short list of carrier setups that work especially well for frequent travelers who jump between countries. ' +
        'I also explain which phones handle profile switching smoothly and which ones still feel clunky. ' +
        'If you rely on dual numbers for work and personal life this guide can save a lot of trial and error.',
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      inventoryRequired: false,
      isBoosted: false,
      tags: ['Akıllı Telefonlar', 'eSIM'],
    },
    {
      title: 'Balancing Portability and Performance on Laptops',
      body:
        'In the laptops subcategory I compare 14‑inch and larger machines by looking at thermal design, battery life and USB4 accessory support. ' +
        'The post explains when it actually makes sense to carry a heavier device just for extra GPU power. ' +
        'There are also a few concrete travel setups showing how a single USB4 cable can replace a whole dock. ' +
        'If you commute with your laptop every day this trade‑off matters more than raw benchmark scores.',
      mainCategoryId: techCategory.id,
      subCategoryId: laptoplarSubCategory.id,
      inventoryRequired: false,
      isBoosted: true,
      tags: ['Laptoplar', 'USB4'],
    },
    {
      title: 'ANC Comparison Guide for the Headphones Subcategory',
      body:
        'In the headphones subcategory I measured active noise cancelling performance in the office, on planes and at home. ' +
        'The guide summarizes which models handle low‑frequency rumble, mid‑range chatter and high‑frequency hiss the best. ' +
        'Simple charts make it easy to see where each pair shines without reading pages of lab data. ' +
        'It is written for people who want focus in real environments rather than perfect silence in a test booth.',
      mainCategoryId: techCategory.id,
      subCategoryId: kulakliklarSubCategory.id,
      inventoryRequired: false,
      isBoosted: false,
      tags: ['Kulaklıklar', 'ANC'],
    },
  ];

  const templateReplacer = (template: string, replacements: Record<string, string>): string => {
    return Object.entries(replacements).reduce((acc, [key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      return acc.replace(regex, value);
    }, template);
  };

  const phoneNarrativeTemplates = [
    {
      title: '{product} ile gece fotoğraf turu #{index}',
      body: '{brand} ekosistemindeki {product} modeliyle İstanbul sokaklarında düşük ışık testleri yaptım. RAW çekimlerde gürültü kontrolü ve tripod kullanmadan elde edilen kareler beklentimin üstünde oldu.',
      tag: 'NightMode',
    },
    {
      title: '{brand} {product} pil dayanımı raporu #{index}',
      body: '{product} modelini 120 Hz ekran, Wi-Fi hotspot ve kamera kayıt kombosu ile 12 saatlik mobil ofis olarak kullandım. Gün sonu kalan yüzde değerleri ve şarj etme frekanslarımı tabloya döktüm.',
      tag: 'Battery',
    },
    {
      title: '{product} ile oyun performansı #{index}',
      body: '{product}, Genshin Impact ve Asphalt 9 testlerimde sıcaklık kontrolünü iyi yaptı. Dokunmatik gecikme ölçümlerini ve kare sabitliğini paylaşarak hangi aksesuarları kullandığımı anlattım.',
      tag: 'Gaming',
    },
    {
      title: '{product} kamera logbook #{index}',
      body: '{brand} cihazında LOG video + LUT kombinasyonu ile sosyal medya içerikleri üretiyorum. {product} ile hangi LUT’ların doğal ten tonu verdiğini ve post prod sürecimi aktarıyorum.',
      tag: 'Creator',
    },
  ];

  const dynamicPhoneProductSeeds: ContextPostSeed[] = brandPhoneProducts.slice(0, 36).map((product: any, index) => {
    const narrative = phoneNarrativeTemplates[index % phoneNarrativeTemplates.length];
    const replacements = {
      product: product.name,
      brand: product.brand || 'Tipbox',
      index: (index + 1).toString(),
    };

    return {
      title: templateReplacer(narrative.title, replacements),
      body: templateReplacer(narrative.body, replacements),
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      productGroupId: product.groupId || null,
      productId: product.id,
      inventoryRequired: index % 3 === 0,
      isBoosted: index % 5 === 0,
      tags: [product.brand || 'Mobile', narrative.tag],
    };
  });

  const groupStoryTemplates = [
    {
      title: '{group} community weekly highlights #{index}',
      body: 'I compared the weekly usage patterns of 40 users who follow {group}. Software update habits and accessory choices are summarized in a single table.',
      tag: 'Community',
    },
    {
      title: '{group} ecosystem guide #{index}',
      body: 'I prepared a starter setup for people who are new to the {group} ecosystem. It answers which accessory to buy first and in which scenarios a second device makes more sense.',
      tag: 'Setup',
    },
  ];

  const phoneGroupsForStories = [productGroup, ...phoneProductGroups];
  const dynamicProductGroupSeeds: ContextPostSeed[] = phoneGroupsForStories
    .flatMap((group, index) => {
      const template = groupStoryTemplates[index % groupStoryTemplates.length];
      const replacements = {
        group: group.name,
        index: (index + 1).toString(),
      };
      const isHomeCategory = group.subCategoryId === evYasamSubCategory.id;
      return {
        title: templateReplacer(template.title, replacements),
        body: templateReplacer(template.body, replacements),
        mainCategoryId: isHomeCategory ? evYasamCategory.id : techCategory.id,
        subCategoryId: group.subCategoryId,
        productGroupId: group.id,
        inventoryRequired: false,
        isBoosted: index % 4 === 0,
        tags: [group.name, template.tag],
      };
    })
    .slice(0, 12);

  const subCategoryStoryTemplates = [
    {
      subCategory: akilliTelefonlarSubCategory,
      mainCategoryId: techCategory.id,
      title: 'Akıllı Telefonlar kategorisinde trendler #{index}',
      body: 'Yeni çıkan aksesuarlar, pil performansı ve kamera karşılaştırmalarını tek listede topladım. #{index}. haftada özellikle ekran kalibrasyonu gündemdeydi.',
      tag: 'Trends',
    },
    {
      subCategory: laptoplarSubCategory,
      mainCategoryId: techCategory.id,
      title: 'Laptop kategorisinde taşınabilirlik notları #{index}',
      body: '14 inç üstü modellerde 65W GaN adaptörleriyle yaptığım seyahat testlerini paylaştım. #{index}. rota için ağırlık/ısı dengesi kritikti.',
      tag: 'Mobility',
    },
    {
      subCategory: kulakliklarSubCategory,
      mainCategoryId: techCategory.id,
      title: 'Kulaklık kategorisinde ANC laboratuvarı #{index}',
      body: 'ANC seviyelerini uçak, metro ve açık ofis ortamlarında ölçtüm. #{index}. testte özellikle orta frekans sızıntıları öne çıktı.',
      tag: 'Audio',
    },
    {
      subCategory: evYasamSubCategory,
      mainCategoryId: evYasamCategory.id,
      title: 'Ev & Yaşam kategorisinde bakım rutini #{index}',
      body: 'Kombine temizlik gündeminde robot + manuel süpürge kullanımını anlattım. #{index}. güncellemede deterjan dozajı önerilerini ekledim.',
      tag: 'HomeCare',
    },
  ];

  const subCategoryExpansionSeeds: ContextPostSeed[] = subCategoryStoryTemplates.flatMap((scenario) => {
    return Array.from({ length: 3 }).map((_, idx) => ({
      title: templateReplacer(scenario.title, { index: (idx + 1).toString() }),
      body: templateReplacer(scenario.body, { index: (idx + 1).toString() }),
      mainCategoryId: scenario.mainCategoryId,
      subCategoryId: scenario.subCategory?.id || null,
      productGroupId: null,
      productId: null,
      inventoryRequired: false,
      isBoosted: idx === 0,
      tags: [scenario.tag, scenario.subCategory?.name || 'Context'],
    }));
  });

  const contextAwarePosts: ContextPostSeed[] = [
    ...productContextPosts,
    ...productGroupContextPosts,
    ...subCategoryContextPosts,
    ...dynamicPhoneProductSeeds,
    ...dynamicProductGroupSeeds,
    ...subCategoryExpansionSeeds,
  ];

  for (const postSeed of contextAwarePosts) {
    const post = await createOrGetContentPost({
      userId: userIdToUse,
      type: 'FREE',
      title: postSeed.title,
      body: postSeed.body,
      mainCategoryId: postSeed.mainCategoryId,
      subCategoryId: postSeed.subCategoryId ?? null,
      productGroupId: postSeed.productGroupId ?? null,
      productId: postSeed.productId ?? null,
      inventoryRequired: postSeed.inventoryRequired ?? false,
      isBoosted: postSeed.isBoosted ?? false,
    }).catch(() => null)
    
    if (!post) continue
    
    const postId = post.id

    if (postSeed.tags && postSeed.tags.length) {
      // Maksimum 2 tag ekle (veritabanını şişirmemek için)
      const tagsToAdd = postSeed.tags.slice(0, 2);
      await prisma.contentPostTag.createMany({
        data: tagsToAdd.map((tag) => ({
          postId,
          tag,
        })),
        skipDuplicates: true,
      });
    }
  }

  console.log(`✅ ${contextAwarePosts.length} FREE posts created across PRODUCT, PRODUCT_GROUP, and SUB_CATEGORIES contexts`)

  // QUESTION Posts (asked by trust users, answered by test user)
  console.log('❓ Creating question posts for reply seeds...');
  type QuestionTemplate = {
    title: string;
    body: string;
    mainCategoryId: string;
    subCategoryId: string;
    productGroupId?: string | null;
    productId?: string | null;
    answerFormat: 'SHORT' | 'LONG';
  };

  const baseQuestionTemplates: QuestionTemplate[] = [
    {
      title: 'Dyson Submarine mop başlığı gerekli mi? #{index}',
      body: 'V15 sürümünde ıslak başlık #{index}. kullanımda tüyleri topluyor mu? mutfak ve banyo için önerilerin nedir?',
      mainCategoryId: evYasamCategory.id,
      subCategoryId: evYasamSubCategory.id,
      productGroupId: productGroup.id,
      productId: product1.id,
      answerFormat: 'LONG',
    },
    {
      title: 'iPhone 15 Pro USB-C senaryoları #{index}',
      body: 'ProRes kayıt + harici SSD ile #{index}. sahnede ısı yönetimi ve aksesuar önerilerin neler?',
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      productGroupId: iphoneGroup.id,
      productId: applePhone?.id || product3.id,
      answerFormat: 'LONG',
    },
    {
      title: 'Samsung Dex üretkenlik sorusu #{index}',
      body: 'Dex modunda çift ekran ve klavye kombinasyonlarında hangi aksesuarları önerirsin? #{index}. güncellemede stabilite nasıl?',
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      productGroupId: samsungGroup.id,
      productId: samsungPhone?.id || product2.id,
      answerFormat: 'SHORT',
    },
    {
      title: 'Redmi batarya kalibrasyonu #{index}',
      body: 'Budget cihazlarda MIUI arka plan ayarlarını nasıl optimize ediyorsun? #{index}. testte ekran süren kaç saat oldu?',
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      productGroupId: redmiGroup.id,
      productId: redmiPhone?.id || product2.id,
      answerFormat: 'SHORT',
    },
    {
      title: 'Kulaklık ANC kıyas sorusu #{index}',
      body: 'ANC seviyelerini uçakta ölçerken hangi filtreleri kullanıyorsun? #{index}. uçuş için önerin nedir?',
      mainCategoryId: techCategory.id,
      subCategoryId: kulakliklarSubCategory.id,
      productGroupId: null,
      productId: null,
      answerFormat: 'LONG',
    },
  ];

  const questionSeeds = Array.from({ length: 20 }).map((_, idx) => {
    const template = baseQuestionTemplates[idx % baseQuestionTemplates.length];
    return {
      askerId: TRUST_USER_IDS[idx % TRUST_USER_IDS.length],
      title: templateReplacer(template.title, { index: (idx + 1).toString() }),
      body: templateReplacer(template.body, { index: (idx + 1).toString() }),
      mainCategoryId: template.mainCategoryId,
      subCategoryId: template.subCategoryId,
      productGroupId: template.productGroupId ?? null,
      productId: template.productId ?? null,
      answerFormat: template.answerFormat,
    };
  });

  const questionPosts: Array<{ id: string }> = [];
  for (const [index, seed] of questionSeeds.entries()) {
    try {
      const questionPost = await createOrGetContentPost({
        userId: seed.askerId,
        type: 'QUESTION',
        title: seed.title,
        body: seed.body,
        mainCategoryId: seed.mainCategoryId,
        subCategoryId: seed.subCategoryId,
        productGroupId: seed.productGroupId,
        productId: seed.productId,
        inventoryRequired: false,
        isBoosted: index % 4 === 0,
      });

      // Duplicate kontrolü: post_id unique constraint
      const existingQuestion = await prisma.postQuestion.findFirst({
        where: { postId: questionPost.id }
      });
      if (!existingQuestion) {
        await prisma.postQuestion.create({
          data: {
            postId: questionPost.id,
            expectedAnswerFormat: seed.answerFormat,
            relatedProductId: seed.productId,
          },
        });
      }

      questionPosts.push({ id: questionPost.id });
    } catch (error) {
      console.warn('⚠️ Question post oluşturulamadı, devam ediliyor:', {
        index,
        title: seed.title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  console.log(`✅ ${questionPosts.length} question posts created for reply seeds (toplam seed: ${questionSeeds.length})`);

  console.log('💬 Creating question replies for test user...');
  const questionReplySeeds = [
    {
      postIndex: 0,
      comment:
        'Submarine başlığı özellikle mutfak zeminindeki kurumuş lekelerde fark yaratıyor. Temizlik sonrası hazneyi hemen boşaltırsan bakım kolay.',
    },
    {
      postIndex: 1,
      comment:
        'USB-C ile Angelbird SSD kullanıyorum; ProRes 4K60 kayıtları hiç kesilmedi. Kablo olarak Thunderbolt 4 sertifikalı olanları tercih et.',
    },
  ];

  for (const replySeed of questionReplySeeds) {
    const targetPost = questionPosts[replySeed.postIndex];
    if (!targetPost) continue;

    await prisma.contentComment.create({
      data: {
        id: generateUlid(),
        postId: targetPost.id,
        userId: userIdToUse,
        comment: replySeed.comment,
        isAnswer: true,
      },
    });

    await prisma.contentPost.update({
      where: { id: targetPost.id },
      data: { commentsCount: { increment: 1 } },
    }).catch(() => {});
  }
  console.log('✅ Question replies for test user created');

  type TipSeed = {
    title: string;
    body: string;
    productId: string | null;
    mainCategoryId: string;
    subCategoryId: string;
    productGroupId?: string | null;
    inventoryRequired?: boolean;
    isBoosted?: boolean;
    tags: string[];
    tipCategory: 'USAGE' | 'PURCHASE' | 'CARE' | 'OTHER';
  };

  const baseTipTemplates: TipSeed[] = [
    {
      title: 'Dyson bakım rutini #{index}',
      body: "Submarine modülünü #{index}. haftada nasıl temizlediğimi ve filtreleri hangi sırayla kuruttuğumu paylaşıyorum.",
      productId: product1.id,
      mainCategoryId: evYasamCategory.id,
      subCategoryId: evYasamSubCategory.id,
      inventoryRequired: true,
      isBoosted: false,
      tags: ['Maintenance', 'Care Tips'],
      tipCategory: 'CARE',
    },
    {
      title: 'Samsung pil optimizasyonu #{index}',
      body: `Good Lock + Routines ile ${samsungPhone?.name || 'Samsung'} cihazında ekran yenilemesini profil bazlı ayarlıyorum. #{index} numaralı profil akşamları otomatik devreye giriyor.`,
      productId: samsungPhone?.id || product2.id,
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      inventoryRequired: true,
      isBoosted: false,
      tags: ['Battery Care', 'Samsung'],
      tipCategory: 'USAGE',
    },
    {
      title: 'iPhone lens bakımı #{index}',
      body: `${applePhone?.name || 'iPhone'} çekimlerinden sonra mag-safe tripodları nasıl temizlediğimi ve hangi lens pen kombinasyonunu seçtiğimi anlattım.`,
      productId: applePhone?.id || product3.id,
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      inventoryRequired: false,
      isBoosted: true,
      tags: ['Camera', 'Cleaning'],
      tipCategory: 'CARE',
    },
    {
      title: 'Redmi aksesuar sepeti #{index}',
      body: `${redmiPhone?.name || 'Redmi'} için GaN adaptörleri kıyaslayıp ısı ölçümlerini paylaştım. #{index}. testte USB-C hub performansı öne çıktı.`,
      productId: redmiPhone?.id || product2.id,
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      inventoryRequired: false,
      isBoosted: false,
      tags: ['Budget', 'Accessories'],
      tipCategory: 'PURCHASE',
    },
    {
      title: 'Laptop USB4 istasyonu #{index}',
      body: 'Laptop kategorisinde seyahat ederken kullandığım USB4 hub ve kablo kombinasyonlarını listeledim. #{index}. rota için hız ölçümlerini ekledim.',
      productId: null,
      mainCategoryId: techCategory.id,
      subCategoryId: laptoplarSubCategory.id,
      inventoryRequired: false,
      isBoosted: true,
      tags: ['Productivity', 'Laptop'],
      tipCategory: 'USAGE',
    },
  ];

  const expandedTipSeeds: TipSeed[] = Array.from({ length: 20 }).map((_, idx) => {
    const template = baseTipTemplates[idx % baseTipTemplates.length];
    const replacements = { index: (idx + 1).toString() };
    return {
      title: templateReplacer(template.title, replacements),
      body: templateReplacer(template.body, replacements),
      productId: template.productId ?? null,
      mainCategoryId: template.mainCategoryId,
      subCategoryId: template.subCategoryId,
      productGroupId: template.productGroupId ?? null,
      inventoryRequired: template.inventoryRequired ?? false,
      isBoosted: template.isBoosted ?? idx % 6 === 0,
      tags: template.tags,
      tipCategory: template.tipCategory,
    };
  });

  for (const tipSeed of expandedTipSeeds) {
    const tipPost = await createOrGetContentPost({
      userId: userIdToUse,
      type: 'TIPS',
      title: tipSeed.title,
      body: tipSeed.body,
      productId: tipSeed.productId,
      mainCategoryId: tipSeed.mainCategoryId,
      subCategoryId: tipSeed.subCategoryId,
      inventoryRequired: tipSeed.inventoryRequired ?? false,
      isBoosted: tipSeed.isBoosted ?? false,
    }).catch(() => null)
    
    if (!tipPost) continue
    const tipPostId = tipPost.id

    // Duplicate kontrolü: post_id unique constraint
    const existingTip = await prisma.postTip.findFirst({
      where: { postId: tipPostId }
    });
    if (!existingTip) {
      await prisma.postTip.create({
        data: {
          postId: tipPostId,
          tipCategory: tipSeed.tipCategory,
          isVerified: true,
        },
      });
    }

    if (tipSeed.tags.length) {
      // Maksimum 2 tag ekle
      const tagsToAdd = tipSeed.tags.slice(0, 2);
      await prisma.postTag.create({
        data: {
          postId: tipPostId,
          tag: tagsToAdd[0],
        },
      }).catch(() => {});

      await prisma.contentPostTag.createMany({
        data: tagsToAdd.map((tag) => ({ postId: tipPostId, tag })),
        skipDuplicates: true,
      });
    }
  }

  // COMPARE Post (Benchmark)
  const comparePost = await createOrGetContentPost({
    userId: userIdToUse,
    type: 'COMPARE',
    title: 'Dyson V15s vs V12 Slim Comparison',
    body: 'Her iki modeli de test ettim. V15s daha güçlü ve daha fazla özellik sunuyor, V12 ise daha hafif ve manevra kabiliyeti daha iyi. Hangisini seçmeli?',
    productId: product1.id,
    mainCategoryId: evYasamCategory.id,
    subCategoryId: evYasamSubCategory.id,
    inventoryRequired: false,
    isBoosted: true,
  })
  const comparePostId = comparePost.id

  // Duplicate kontrolü: post_id unique constraint
  const existingComparison = await prisma.postComparison.findFirst({
    where: { postId: comparePostId }
  });
  const comparison = existingComparison || await prisma.postComparison.create({
    data: {
      postId: comparePostId,
      product1Id: product1.id,
      product2Id: product2.id,
      comparisonSummary: 'V15s daha güçlü ama daha ağır, V12 daha pratik ama daha az güçlü',
    }
  })

  // Comparison Scores - Duplicate kontrolü: comparison_id + metric_id unique constraint
  const existingScore1 = await prisma.postComparisonScore.findFirst({
    where: {
      comparisonId: comparison.id,
      metricId: priceMetric.id,
    }
  });
  if (!existingScore1) {
    await prisma.postComparisonScore.create({
      data: {
        comparisonId: comparison.id,
        metricId: priceMetric.id,
        scoreProduct1: 7,
        scoreProduct2: 8,
        comment: 'V12 daha uygun fiyatlı',
      }
    })
  }

  const existingScore2 = await prisma.postComparisonScore.findFirst({
    where: {
      comparisonId: comparison.id,
      metricId: qualityMetric.id,
    }
  });
  if (!existingScore2) {
    await prisma.postComparisonScore.create({
      data: {
        comparisonId: comparison.id,
        metricId: qualityMetric.id,
        scoreProduct1: 9,
        scoreProduct2: 8,
        comment: 'V15s kalite açısından daha üstün',
      }
    })
  }

  type BenchmarkSeed = {
    title: string;
    body: string;
    product1Id: string;
    product2Id: string;
    summary: string;
    mainCategoryId: string;
    subCategoryId: string;
    isBoosted?: boolean;
    metricScores: Array<{
      metricId: string;
      scoreProduct1: number;
      scoreProduct2: number;
      comment?: string;
    }>;
  };

  const baseBenchmarkTemplates: BenchmarkSeed[] = [
    {
      title: 'Samsung vs iPhone Pil Dayanımı Karşılaştırması #{index}',
      body: 'İki cihazı da 120 Hz ekran, hotspot ve kamera kaydı ile aynı rotada kullandım. Pil yüzdeleri ve şarj alışkanlıklarını #{index}. rota için tabloya döktüm.',
      product1Id: samsungPhone?.id || product2.id,
      product2Id: applePhone?.id || product3.id,
      summary: 'Galaxy daha yüksek pil kapasitesiyle günü çıkardı fakat iPhone daha stabil sıcaklık sundu (#{index}).',
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      metricScores: [
        {
          metricId: priceMetric.id,
          scoreProduct1: 7,
          scoreProduct2: 6,
          comment: 'Galaxy fiyat avantajı sağlıyor',
        },
        {
          metricId: usabilityMetric.id,
          scoreProduct1: 8,
          scoreProduct2: 9,
          comment: 'iPhone daha kararlı yazılım sunuyor',
        },
      ],
    },
    {
      title: 'Redmi vs Samsung Ekran Parlaklığı Testi #{index}',
      body: 'Güneş altında HDR içerik tüketirken ölçtüğüm nit değerlerini ve uzun kullanım sonucunda oluşan ısınmayı anlattım (#{index}).',
      product1Id: redmiPhone?.id || product2.id,
      product2Id: samsungPhone?.id || product2.id,
      summary: 'Samsung daha yüksek tepe parlaklığına sahip fakat Redmi enerji tüketiminde daha verimli kaldı.',
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      metricScores: [
        {
          metricId: qualityMetric.id,
          scoreProduct1: 8,
          scoreProduct2: 9,
          comment: 'Ekran kalitesi Samsung tarafında daha rafine',
        },
        {
          metricId: designMetric.id,
          scoreProduct1: 7,
          scoreProduct2: 8,
        },
      ],
    },
    {
      title: 'Dyson V15s vs Samsung Jet Temizlik Karşılaştırması #{index}',
      body: 'Ev & yaşam rutinimde iki cihazı da mutfak + salon kombinasyonunda karşılaştırdım. Islak başlıktaki kolaylık vs hafif gövde tercihi öne çıktı (#{index}).',
      product1Id: product1.id,
      product2Id: product2.id,
      summary: 'V15s güçte önde, Jet ise manevra kabiliyetiyle fark yaratıyor.',
      mainCategoryId: evYasamCategory.id,
      subCategoryId: evYasamSubCategory.id,
      isBoosted: true,
      metricScores: [
        {
          metricId: durabilityMetric.id,
          scoreProduct1: 9,
          scoreProduct2: 7,
        },
        {
          metricId: usabilityMetric.id,
          scoreProduct1: 8,
          scoreProduct2: 9,
        },
      ],
    },
    {
      title: 'iPhone 15 Pro vs Redmi Kamera Seçimi #{index}',
      body: 'LOG video çekimleri ve sosyal medya hazır filtreleri için iki cihazı da aynı sahnede kullandım. Lens değişim hızını ve aksesuar uyumunu anlattım (#{index}).',
      product1Id: applePhone?.id || product3.id,
      product2Id: redmiPhone?.id || product2.id,
      summary: 'iPhone video tarafında üstünken Redmi sosyal içerik üreticileri için hızlı filtre seçenekleri sunuyor.',
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      metricScores: [
        {
          metricId: qualityMetric.id,
          scoreProduct1: 9,
          scoreProduct2: 7,
        },
        {
          metricId: priceMetric.id,
          scoreProduct1: 5,
          scoreProduct2: 9,
        },
      ],
    },
  ];

  const benchmarkSeeds: BenchmarkSeed[] = Array.from({ length: 20 }).map((_, idx) => {
    const template = baseBenchmarkTemplates[idx % baseBenchmarkTemplates.length];
    const replacements = { index: (idx + 1).toString() };
    return {
      title: templateReplacer(template.title, replacements),
      body: templateReplacer(template.body, replacements),
      product1Id: template.product1Id,
      product2Id: template.product2Id,
      summary: templateReplacer(template.summary, replacements),
      mainCategoryId: template.mainCategoryId,
      subCategoryId: template.subCategoryId,
      isBoosted: template.isBoosted ?? idx % 5 === 0,
      metricScores: template.metricScores,
    };
  });

  for (const benchmarkSeed of benchmarkSeeds) {
    const post = await createOrGetContentPost({
      userId: userIdToUse,
      type: 'COMPARE',
      title: benchmarkSeed.title,
      body: benchmarkSeed.body,
      mainCategoryId: benchmarkSeed.mainCategoryId,
      subCategoryId: benchmarkSeed.subCategoryId,
      productId: benchmarkSeed.product1Id,
      inventoryRequired: false,
      isBoosted: benchmarkSeed.isBoosted ?? false,
    }).catch(() => null)
    
    if (!post) continue
    const compareId = post.id

    // Duplicate kontrolü: post_id unique constraint
    const existingComparisonEntry = await prisma.postComparison.findFirst({
      where: { postId: compareId }
    });
    if (existingComparisonEntry) continue; // Zaten varsa atla
    
    const comparisonEntry = await prisma.postComparison.create({
      data: {
        postId: compareId,
        product1Id: benchmarkSeed.product1Id,
        product2Id: benchmarkSeed.product2Id,
        comparisonSummary: benchmarkSeed.summary,
      },
    });

    for (const score of benchmarkSeed.metricScores) {
      // Duplicate kontrolü: comparison_id + metric_id unique constraint
      const existingScore = await prisma.postComparisonScore.findFirst({
        where: {
          comparisonId: comparisonEntry.id,
          metricId: score.metricId,
        }
      });
      if (!existingScore) {
        await prisma.postComparisonScore.create({
          data: {
            comparisonId: comparisonEntry.id,
            metricId: score.metricId,
            scoreProduct1: score.scoreProduct1,
            scoreProduct2: score.scoreProduct2,
            comment: score.comment,
          },
        });
      }
    }
  }

  console.log(`✅ ${benchmarkSeeds.length} benchmark posts created`)

  console.log('📝 Creating experience posts for FeedItemType.POST...');
  type ExperienceSeed = {
    title: string;
    body: string;
    mainCategoryId: string;
    subCategoryId: string;
    productId: string;
    tags: string[];
    isBoosted?: boolean;
    inventoryRequired?: boolean;
  };

  const baseExperienceTemplates: ExperienceSeed[] = [
    {
      title: 'Dyson günlük rutin #{index}',
      body: 'Islak + kuru mod arasında geçişte #{index}. gün uyguladığım temizlik sırasını ve bakım notlarını listeledim.',
      mainCategoryId: evYasamCategory.id,
      subCategoryId: evYasamSubCategory.id,
      productId: product1.id,
      tags: ['Dyson', 'Rutin'],
      inventoryRequired: true,
    },
    {
      title: 'Samsung Dex çalışma masası #{index}',
      body: 'Dex modunda iki monitör + bluetooth klavye kombinasyonuyla nasıl remote ofis kurduğumu anlattım.',
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      productId: samsungPhone?.id || product2.id,
      tags: ['Productivity', 'Samsung'],
    },
    {
      title: 'iPhone Pro video workflow #{index}',
      body: 'LOG video çekip SSD aktarırken DaVinci kurgu pipeline’ımı paylaştım. #{index}. proje için LUT notları ekledim.',
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      productId: applePhone?.id || product3.id,
      tags: ['Creator', 'Video'],
      isBoosted: true,
    },
    {
      title: 'Redmi MIUI test günlüğü #{index}',
      body: 'MIUI beta sürümlerini yüklerken aldığım hataları ve pil gözlemlerini aktardım.',
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      productId: redmiPhone?.id || product2.id,
      tags: ['MIUI', 'Beta'],
    },
    {
      title: 'Laptop seyahat çantası #{index}',
      body: 'USB4 dock, GaN adaptör ve kablosuz mouse kombinasyonunu #{index}. şehirde nasıl düzenlediğimi anlattım.',
      mainCategoryId: techCategory.id,
      subCategoryId: laptoplarSubCategory.id,
      productId: product3.id,
      tags: ['Laptop', 'Travel'],
    },
  ];

  const experienceSeeds: ExperienceSeed[] = Array.from({ length: 20 }).map((_, idx) => {
    const template = baseExperienceTemplates[idx % baseExperienceTemplates.length];
    return {
      ...template,
      title: templateReplacer(template.title, { index: (idx + 1).toString() }),
      body: templateReplacer(template.body, { index: (idx + 1).toString() }),
      isBoosted: template.isBoosted ?? idx % 4 === 0,
    };
  });

  for (const seed of experienceSeeds) {
    const post = await createOrGetContentPost({
      userId: userIdToUse,
      type: 'EXPERIENCE',
      title: seed.title,
      body: seed.body,
      mainCategoryId: seed.mainCategoryId,
      subCategoryId: seed.subCategoryId,
      productId: seed.productId,
      inventoryRequired: seed.inventoryRequired ?? false,
      isBoosted: seed.isBoosted ?? false,
    }).catch(() => null)
    
    if (!post) continue
    const postId = post.id

    if (seed.tags.length) {
      await prisma.contentPostTag.createMany({
        data: seed.tags.map((tag) => ({
          postId,
          tag,
        })),
        skipDuplicates: true,
      });
    }
  }
  console.log(`✅ ${experienceSeeds.length} experience posts created`)

  const AUDIO_MAX_BRAND_ID = 'e5c57b8e-b4ac-4de8-a12a-4d1724f8099b';
  const AUDIO_MAX_PRODUCT_ID = '018b6b88-858b-4851-8006-146386a14b63';
  
  console.log('🔍 Checking AudioMax brand and product in database...');
  console.log(`  Brand ID: ${AUDIO_MAX_BRAND_ID}`);
  console.log(`  Product ID: ${AUDIO_MAX_PRODUCT_ID}`);
  
  // 1. Brand kontrolü
  const audioMaxBrand = await prisma.brand.findUnique({ 
    where: { id: AUDIO_MAX_BRAND_ID },
    select: {
      id: true,
      name: true,
      description: true,
      categoryId: true,
    },
  });

  if (!audioMaxBrand) {
    console.error(`❌ Brand not found with ID: ${AUDIO_MAX_BRAND_ID}`);
    console.warn('⚠️ Skipping AudioMax seed data - brand does not exist in database');
  } else {
    console.log(`✅ Brand found: ${audioMaxBrand.name} (${audioMaxBrand.id})`);
    
    // 2. Product kontrolü
    const audioMaxProduct = await prisma.product.findUnique({
      where: { id: AUDIO_MAX_PRODUCT_ID },
      include: {
        group: {
          include: {
            subCategory: {
              include: {
                mainCategory: true,
              },
            },
          },
        },
      },
    });

    if (!audioMaxProduct) {
      console.error(`❌ Product not found with ID: ${AUDIO_MAX_PRODUCT_ID}`);
      console.warn('⚠️ Skipping AudioMax seed data - product does not exist in database');
    } else {
      console.log(`✅ Product found: ${audioMaxProduct.name} (${audioMaxProduct.id})`);
      
      // 3. Category ID'lerini al
      const audioMaxSubCategoryId =
        audioMaxProduct?.group?.subCategoryId ||
        audioMaxProduct?.group?.subCategory?.id ||
        null;

      const audioMaxMainCategoryId =
        audioMaxProduct?.group?.subCategory?.mainCategoryId ||
        audioMaxProduct?.group?.subCategory?.mainCategory?.id ||
        null;

      console.log(`  Main Category ID: ${audioMaxMainCategoryId || 'NOT FOUND'}`);
      console.log(`  Sub Category ID: ${audioMaxSubCategoryId || 'NOT FOUND'}`);

      // 4. Mevcut veri kontrolleri
      console.log('\n📊 Checking existing data for endpoints...');
      
      const existingExperiencesCount = await prisma.contentPost.count({
        where: {
          productId: AUDIO_MAX_PRODUCT_ID,
          type: 'EXPERIENCE',
        },
      });
      
      const existingComparisonsCount = await prisma.contentPost.count({
        where: {
          productId: AUDIO_MAX_PRODUCT_ID,
          type: 'COMPARE',
        },
      });
      
      const existingNewsCount = await prisma.contentPost.count({
        where: {
          productId: AUDIO_MAX_PRODUCT_ID,
          type: 'UPDATE',
        },
      });
      
      console.log(`  Experiences (EXPERIENCE): ${existingExperiencesCount}`);
      console.log(`  Comparisons (COMPARE): ${existingComparisonsCount}`);
      console.log(`  News (UPDATE): ${existingNewsCount}`);
      
      if (!audioMaxSubCategoryId || !audioMaxMainCategoryId) {
        console.warn('⚠️ Category information missing, cannot create posts with proper category references');
      } else {
        console.log('\n🎧 Creating dedicated AudioMax experience posts for brand endpoints...');
        
        type AudioMaxExperienceTemplate = {
      title: string;
      body: string;
      tags: string[];
      inventoryRequired?: boolean;
      isBoosted?: boolean;
    };

    const audioMaxExperienceTemplates: AudioMaxExperienceTemplate[] = [
      {
        title: '#{brand} reference mix session #{index}',
        body: 'Documented my full reference chain with #{product}, including pad swap notes and SPL meter readings.',
        tags: ['AudioMax', 'Studio'],
      },
      {
        title: 'Noise cancelling sprint #{index}',
        body: 'Tried #{product} on a 45-minute subway ride and tracked how ANC handled low rumbles vs human voices.',
        tags: ['NoiseCancelling', 'Commute'],
      },
      {
        title: 'Game night tuning #{index}',
        body: 'Configured EQ presets on #{product} for FPS footsteps and JRPG orchestral cues, sharing screenshots.',
        tags: ['Gaming', 'EQ'],
      },
      {
        title: 'Remote work comfort log #{index}',
        body: 'After #{index} days of six-hour calls with #{product}, I summarized clamp force tweaks and ear pad cooling tricks.',
        tags: ['RemoteWork', 'Comfort'],
      },
      {
        title: 'Vinyl mastering check #{index}',
        body: 'Ran my favorite vinyl masters through #{product} and compared analog warmth vs balanced output on each side.',
        tags: ['Vinyl', 'Analog'],
        isBoosted: true,
      },
    ];

    const audioMaxExperiencePosts = Array.from({ length: 20 }).map((_, idx) => {
      const template = audioMaxExperienceTemplates[idx % audioMaxExperienceTemplates.length];
      const replacements = {
        index: (idx + 1).toString(),
        brand: audioMaxBrand.name,
        product: audioMaxProduct.name,
      };

      return {
        title: templateReplacer(template.title, replacements),
        body: templateReplacer(template.body, replacements),
        tags: template.tags,
        inventoryRequired: template.inventoryRequired ?? true,
        isBoosted: template.isBoosted ?? idx % 4 === 0,
      };
    });

    for (const seed of audioMaxExperiencePosts) {
      const post = await createOrGetContentPost({
        userId: userIdToUse,
        type: 'EXPERIENCE',
        title: seed.title,
        body: seed.body,
        mainCategoryId: audioMaxMainCategoryId,
        subCategoryId: audioMaxSubCategoryId,
        productId: AUDIO_MAX_PRODUCT_ID,
        inventoryRequired: seed.inventoryRequired ?? true,
        isBoosted: seed.isBoosted ?? false,
      }).catch(() => null)
      
      if (!post) continue
      const postId = post.id

      if (seed.tags.length) {
        // Maksimum 2 tag ekle
        const tagsToAdd = seed.tags.slice(0, 2);
        await prisma.contentPostTag.createMany({
          data: tagsToAdd.map((tag) => ({
            postId,
            tag,
          })),
          skipDuplicates: true,
        });
      }
    }

        console.log(`✅ ${audioMaxExperiencePosts.length} dedicated AudioMax experience posts created`);
        
        console.log('\n🎯 Ensuring dedicated AudioMax product content for experiences / comparisons / news...');
        
        // AudioMax experiences, comparisons, news için seed ekleme
        const targetExperiencePostsPerProduct = 12;
    const existingAudioMaxExperienceCount = await prisma.contentPost.count({
      where: {
        productId: AUDIO_MAX_PRODUCT_ID,
        type: 'EXPERIENCE',
      },
    });

    if (existingAudioMaxExperienceCount < targetExperiencePostsPerProduct) {
      const postsToCreate = targetExperiencePostsPerProduct - existingAudioMaxExperienceCount;
      console.log(`📝 Creating ${postsToCreate} additional EXPERIENCE posts for AudioMax product...`);

      const experienceTemplates = [
        'Sharing my daily mixing workflow on #{product} with focus on midrange clarity.',
        'Tried #{product} for casual listening and critical sessions back-to-back, here are the differences.',
        'Testing comfort on #{product} after a full workday of calls and playlists.',
        'Walking through my EQ and gain-staging chain that works best with #{product}.',
      ];

      for (let i = 0; i < postsToCreate; i++) {
        const template =
          experienceTemplates[i % experienceTemplates.length];

        const title = `AudioMax Experience #${existingAudioMaxExperienceCount + i + 1}`;
        const body = templateReplacer(template, {
          product: audioMaxProduct.name,
        });

        const post = await createOrGetContentPost({
          userId: userIdToUse,
          type: 'EXPERIENCE',
          title,
          body,
          productId: AUDIO_MAX_PRODUCT_ID,
          mainCategoryId: audioMaxMainCategoryId,
          subCategoryId: audioMaxSubCategoryId,
          inventoryRequired: true,
          isBoosted: false,
          createdAt: daysAgo(randomBetween(1, 20)),
        }).catch((error) => {
          console.warn(`⚠️ Failed to create AudioMax experience post: ${error}`);
          return null
        })
        
        if (!post) continue
        const postId = post.id
      }

      console.log(`✅ AudioMax product now has at least ${targetExperiencePostsPerProduct} EXPERIENCE posts`);
    } else {
      console.log('ℹ️ AudioMax product already has enough EXPERIENCE posts');
    }
  }

  // AudioMax comparison posts
  if (audioMaxBrand && audioMaxProduct && audioMaxSubCategoryId && audioMaxMainCategoryId) {
    const targetComparisonPostsPerProduct = 12;
    const existingAudioMaxComparisonCount = await prisma.contentPost.count({
      where: {
        productId: AUDIO_MAX_PRODUCT_ID,
        type: 'COMPARE',
      },
    });

    const comparisonPartner = await prisma.product.findFirst({
      where: {
        brand: audioMaxBrand.name,
        id: { not: AUDIO_MAX_PRODUCT_ID },
      },
    });

    if (comparisonPartner && existingAudioMaxComparisonCount < targetComparisonPostsPerProduct) {
      const postsToCreate = targetComparisonPostsPerProduct - existingAudioMaxComparisonCount;
      console.log(`⚖️  Creating ${postsToCreate} COMPARE posts for AudioMax product...`);

      const comparisonTemplateBody =
        'Side-by-side comparison between #{productPrimary} and #{productSecondary} focused on stage, detail and comfort.';

      for (let i = 0; i < postsToCreate; i++) {
        const title = `AudioMax Comparison #${existingAudioMaxComparisonCount + i + 1}`;
        const body = templateReplacer(comparisonTemplateBody, {
          productPrimary: audioMaxProduct.name,
          productSecondary: comparisonPartner.name,
        });

        const post = await createOrGetContentPost({
          userId: userIdToUse,
          type: 'COMPARE',
          title,
          body,
          productId: AUDIO_MAX_PRODUCT_ID,
          mainCategoryId: audioMaxMainCategoryId,
          subCategoryId: audioMaxSubCategoryId,
          inventoryRequired: false,
          isBoosted: false,
          createdAt: daysAgo(randomBetween(1, 20)),
        }).catch((error) => {
          console.warn(`⚠️ Failed to create AudioMax comparison post: ${error}`);
          return null
        })
        
        if (!post) continue
        const postId = post.id

        await prisma.postComparison
          .create({
            data: {
              postId,
              product1Id: AUDIO_MAX_PRODUCT_ID,
              product2Id: comparisonPartner.id,
              comparisonSummary:
                'Practical benchmark between two AudioMax configurations for everyday listening and studio work.',
            },
          })
          .catch(() => {});
      }

      console.log(`✅ AudioMax product now has at least ${targetComparisonPostsPerProduct} COMPARE posts`);
    } else if (!comparisonPartner) {
      console.log('⚠️ No partner product found for AudioMax comparisons, skipping COMPARE seeding');
    } else {
      console.log('ℹ️ AudioMax product already has enough COMPARE posts');
    }

    // AudioMax news posts
    const targetNewsPostsPerProduct = 12;
    const existingAudioMaxNewsCount = await prisma.contentPost.count({
      where: {
        productId: AUDIO_MAX_PRODUCT_ID,
        type: 'UPDATE',
      },
    });

    if (existingAudioMaxNewsCount < targetNewsPostsPerProduct) {
      const postsToCreate = targetNewsPostsPerProduct - existingAudioMaxNewsCount;
      console.log(`📰 Creating ${postsToCreate} UPDATE news posts for AudioMax product...`);

      const newsTemplates = [
        'New firmware for #{product} improves Bluetooth stability and latency for gaming.',
        'Limited edition pads for #{product} are now available with improved comfort and isolation.',
        'AudioMax pushed a tuning update for #{product}, focusing on more neutral upper mids.',
        'A new preset pack for #{product} was released for popular streaming and DAW platforms.',
      ];

      for (let i = 0; i < postsToCreate; i++) {
        const template = newsTemplates[i % newsTemplates.length];
        const title = `AudioMax News #${existingAudioMaxNewsCount + i + 1}`;
        const body = templateReplacer(template, {
          product: audioMaxProduct.name,
        });

        const post = await createOrGetContentPost({
          userId: userIdToUse,
          type: 'UPDATE',
          title,
          body,
          productId: AUDIO_MAX_PRODUCT_ID,
          mainCategoryId: audioMaxMainCategoryId,
          subCategoryId: audioMaxSubCategoryId,
          inventoryRequired: false,
          isBoosted: false,
          createdAt: daysAgo(randomBetween(1, 20)),
        }).catch((error) => {
          console.warn(`⚠️ Failed to create AudioMax news post: ${error}`);
          return null
        })
        
        if (!post) continue
        const postId = post.id
      }

        console.log(`✅ AudioMax product now has at least ${targetNewsPostsPerProduct} UPDATE posts`);
      } else {
        console.log('ℹ️ AudioMax product already has enough UPDATE news posts');
      }
      
      // Extra diversity for AudioMax news feed: TIPS + QUESTION posts for the same product
      console.log('🎨 Ensuring diverse news feed types for AudioMax product (TIPS + QUESTION)...');

      const existingAudioMaxTipsCount = await prisma.contentPost.count({
        where: {
          productId: AUDIO_MAX_PRODUCT_ID,
          type: 'TIPS',
        },
      });

      const existingAudioMaxQuestionCount = await prisma.contentPost.count({
        where: {
          productId: AUDIO_MAX_PRODUCT_ID,
          type: 'QUESTION',
        },
      });

      const targetTipsPerProduct = 4;
      const targetQuestionsPerProduct = 4;

      if (existingAudioMaxTipsCount < targetTipsPerProduct) {
    const postsToCreate = targetTipsPerProduct - existingAudioMaxTipsCount;
    console.log(`💡 Creating ${postsToCreate} TIPS posts for AudioMax product...`);

    const tipTemplates = [
      'Best EQ curve I found for #{product} when listening at low volume late at night.',
      'Simple burn-in routine for #{product} that made the bass feel tighter after a few days.',
      'How to keep ear pads on #{product} clean without damaging the material.',
      'Quick checklist before traveling with #{product}: case, cable, and spare tips.',
    ];

    for (let i = 0; i < postsToCreate; i++) {
      const template = tipTemplates[i % tipTemplates.length];
      const title = `AudioMax Tip #${existingAudioMaxTipsCount + i + 1}`;
      const body = templateReplacer(template, {
        product: audioMaxProduct?.name || 'AudioMax Studio Headphones',
      });

        const post = await createOrGetContentPost({
          userId: userIdToUse,
          type: 'TIPS',
          title,
          body,
          productId: AUDIO_MAX_PRODUCT_ID,
          mainCategoryId: audioMaxMainCategoryId,
          subCategoryId: audioMaxSubCategoryId,
          inventoryRequired: false,
          isBoosted: false,
          createdAt: daysAgo(randomBetween(1, 20)),
        }).catch((error) => {
          console.warn(`⚠️ Failed to create AudioMax tip post: ${error}`);
          return null
        })
        
        if (!post) continue
        const postId = post.id
      }
      
      console.log(`✅ AudioMax product now has at least ${targetTipsPerProduct} TIPS posts`);
    } else {
      console.log('ℹ️ AudioMax product already has enough TIPS posts');
    }

    if (existingAudioMaxQuestionCount < targetQuestionsPerProduct) {
    const postsToCreate = targetQuestionsPerProduct - existingAudioMaxQuestionCount;
    console.log(`❓ Creating ${postsToCreate} QUESTION posts for AudioMax product...`);

    const questionTemplates = [
      'Which pad option for #{product} gives the best balance between comfort and isolation?',
      'How much gain do you usually run on #{product} with your audio interface?',
      'Any favorite genres that really shine on #{product} compared to other headphones?',
      'Does #{product} pair better with warmer or more neutral DAC/amp chains?',
    ];

    for (let i = 0; i < postsToCreate; i++) {
      const template = questionTemplates[i % questionTemplates.length];
      const title = `AudioMax Question #${existingAudioMaxQuestionCount + i + 1}`;
      const body = templateReplacer(template, {
        product: audioMaxProduct?.name || 'AudioMax Studio Headphones',
      });

        const post = await createOrGetContentPost({
          userId: userIdToUse,
          type: 'QUESTION',
          title,
          body,
          productId: AUDIO_MAX_PRODUCT_ID,
          mainCategoryId: audioMaxMainCategoryId,
          subCategoryId: audioMaxSubCategoryId,
          inventoryRequired: false,
          isBoosted: false,
          createdAt: daysAgo(randomBetween(1, 20)),
        }).catch((error) => {
          console.warn(`⚠️ Failed to create AudioMax question post: ${error}`);
          return null
        })
        
        if (!post) continue
        const postId = post.id

        await prisma.postQuestion
          .create({
            data: {
              postId,
              expectedAnswerFormat: 'SHORT',
              relatedProductId: AUDIO_MAX_PRODUCT_ID,
            },
          })
          .catch(() => {});
      }

      console.log(`✅ AudioMax product now has at least ${targetQuestionsPerProduct} QUESTION posts`);
    } else {
      console.log('ℹ️ AudioMax product already has enough QUESTION posts');
    }
      } // End of category check block
    } // End of product check block
  } // End of brand check block

  // Content Comments (Replies için)
  const comments = await prisma.contentPost.findMany({
    where: { userId: userIdToUse },
    take: 3,
  })

  for (const post of comments) {
    await prisma.contentComment.create({
      data: {
        id: generateUlid(),
        postId: post.id,
        userId: userIdToUse,
        comment: `Great post about ${post.title}! I have similar experience.`,
        isAnswer: false,
      }
    })
    // Update comment count
    await prisma.contentPost.update({
      where: { id: post.id },
      data: { commentsCount: { increment: 1 } }
    }).catch(() => {})
  }
  console.log('✅ Content comments (Replies) created')

  // Content Likes & Favorites (Stats için)
  const allPosts = await prisma.contentPost.findMany({
    where: { userId: userIdToUse },
  })

  for (const post of allPosts.slice(0, 3)) {
    await prisma.contentLike.create({
      data: {
        userId: userIdToUse,
        postId: post.id,
      }
    }).catch(() => {})
    // Update like count
    await prisma.contentPost.update({
      where: { id: post.id },
      data: { likesCount: { increment: 1 } }
    }).catch(() => {})

    if (allPosts.indexOf(post) % 2 === 0) {
      await prisma.contentFavorite.create({
        data: {
          userId: userIdToUse,
          postId: post.id,
        }
      }).catch(() => {})
      // Update favorite count
      await prisma.contentPost.update({
        where: { id: post.id },
        data: { favoritesCount: { increment: 1 } }
      }).catch(() => {})
    }
  }

  console.log('🔖 Ensuring bookmark coverage across card/context combinations...')
  type BookmarkCoverageConfig = {
    label: string
    where: Prisma.ContentPostWhereInput
  }

  const bookmarkCoverageConfigs: BookmarkCoverageConfig[] = [
    {
      label: 'FREE::product',
      where: { userId: userIdToUse, type: 'FREE', NOT: { productId: null } },
    },
    {
      label: 'FREE::productGroup',
      where: {
        userId: userIdToUse,
        type: 'FREE',
        productId: null,
        NOT: { productGroupId: null },
      },
    },
    {
      label: 'FREE::subCategory',
      where: {
        userId: userIdToUse,
        type: 'FREE',
        productId: null,
        productGroupId: null,
        NOT: { subCategoryId: null },
      },
    },
    {
      label: 'COMPARE::product',
      where: { userId: userIdToUse, type: 'COMPARE' },
    },
    {
      label: 'TIPS::product',
      where: { userId: userIdToUse, type: 'TIPS', NOT: { productId: null } },
    },
    {
      label: 'TIPS::subCategory',
      where: {
        userId: userIdToUse,
        type: 'TIPS',
        productId: null,
        NOT: { subCategoryId: null },
      },
    },
    {
      label: 'QUESTION::product',
      where: { type: 'QUESTION', NOT: { productId: null } },
    },
    {
      label: 'QUESTION::subCategory',
      where: {
        type: 'QUESTION',
        productId: null,
        NOT: { subCategoryId: null },
      },
    },
  ]

  let bookmarkCoverageCreated = 0
  for (const config of bookmarkCoverageConfigs) {
    const targetPost = await prisma.contentPost.findFirst({
      where: config.where,
      orderBy: { createdAt: 'desc' },
    })

    if (!targetPost) {
      console.warn(`⚠️  Bookmark coverage skipped for ${config.label} (no matching post)`)
      continue
    }

    const created = await ensureBookmarkFor(userIdToUse, targetPost.id)
    if (created) {
      bookmarkCoverageCreated += 1
    }
  }
  console.log(`✅ Bookmark coverage ensured (${bookmarkCoverageCreated} new favorites)`)

  // Content Post Views
  for (const post of allPosts.slice(0, 2)) {
    await prisma.contentPostView.create({
      data: {
        postId: post.id,
        userId: userIdToUse,
        viewerIp: '127.0.0.1',
      }
    }).catch(() => {})
    // Update view count
    await prisma.contentPost.update({
      where: { id: post.id },
      data: { viewsCount: { increment: 1 } }
    }).catch(() => {})
  }
  console.log('✅ Content interactions (likes, favorites, views) created')

  // Enrich stats for all posts with realistic numbers
  const statTemplates = [
    { likes: 84, comments: 18, shares: 7, bookmarks: 26 },
    { likes: 52, comments: 11, shares: 4, bookmarks: 14 },
    { likes: 67, comments: 9, shares: 3, bookmarks: 10 },
    { likes: 33, comments: 6, shares: 2, bookmarks: 6 },
    { likes: 105, comments: 22, shares: 8, bookmarks: 32 },
  ]

  for (let idx = 0; idx < allPosts.length; idx++) {
    const post = allPosts[idx]
    const template = statTemplates[idx % statTemplates.length]
    const variance = 0.7 + Math.random() * 0.9
    const likes = Math.max(6, Math.round(template.likes * variance))
    const comments = Math.max(2, Math.round(template.comments * (0.6 + Math.random() * 0.8)))
    const shares = Math.max(1, Math.round(template.shares * (0.5 + Math.random())))
    const bookmarks = Math.max(1, Math.round(template.bookmarks * (0.5 + Math.random())))
    const views = Math.max(likes * randomBetween(6, 15) + randomBetween(30, 140), likes + comments + shares + bookmarks)

    await prisma.contentPost.update({
      where: { id: post.id },
      data: {
        likesCount: likes,
        commentsCount: comments,
        sharesCount: shares,
        favoritesCount: bookmarks,
        viewsCount: views,
      },
    }).catch(() => {})
  }
  console.log('✅ Content stats enriched (likes/comments/shares/bookmarks)')

  // Ensure non-primary user posts (e.g. trust users' questions) also have non-zero stats
  const postsNeedingStats = await prisma.contentPost.findMany({
    where: { sharesCount: 0 },
  })

  if (postsNeedingStats.length) {
    console.log(`ℹ️  Found ${postsNeedingStats.length} posts with zero share stats, enriching...`)
    for (let idx = 0; idx < postsNeedingStats.length; idx++) {
      const post = postsNeedingStats[idx]
      const template = statTemplates[(idx + allPosts.length) % statTemplates.length]
      const variance = 0.65 + Math.random() * 0.85
      const likes = Math.max(4, Math.round(template.likes * variance))
      const comments = Math.max(1, Math.round(template.comments * (0.5 + Math.random() * 0.7)))
      const shares = Math.max(1, Math.round(template.shares * (0.5 + Math.random())))
      const bookmarks = Math.max(1, Math.round(template.bookmarks * (0.4 + Math.random())))
      const views = Math.max(likes * randomBetween(5, 12) + randomBetween(20, 100), likes + comments + shares + bookmarks)

      await prisma.contentPost.update({
        where: { id: post.id },
        data: {
          likesCount: likes,
          commentsCount: comments,
          sharesCount: shares,
          favoritesCount: bookmarks,
          viewsCount: views,
        },
      }).catch(() => {})
    }
    console.log('✅ Additional stats enriched for non-primary user posts')
  }

  // Zamana göre sıralanan feed'in tek tip bloklar halinde gelmemesi için
  // tüm post'ların createdAt değerlerini rastgele geçmiş zamanlara dağıtıyoruz.
  console.log('🕒 Randomizing content post timestamps for mixed feed ordering...')
  const postsForTimeline = await prisma.contentPost.findMany({
    orderBy: { createdAt: 'asc' },
  })

  if (postsForTimeline.length > 0) {
    const maxMinutes = Math.max(60, postsForTimeline.length * 3)
    for (const post of postsForTimeline) {
      const minutes = randomBetween(0, maxMinutes)
      const createdAt = new Date(Date.now() - minutes * 60 * 1000)
      await prisma.contentPost.update({
        where: { id: post.id },
        data: {
          createdAt,
          updatedAt: createdAt,
        },
      }).catch(() => {})
    }
  }
  console.log('✅ Content post timestamps randomized')

  // 23. Tüm content post'lar için 10-40 arası rastgele stats ver (event feed / brand feed tutarlılığı için)
  console.log('📊 Enriching stats for all content posts (10-40 range)...')
  const allContentPostsForStats = await prisma.contentPost.findMany()

  if (allContentPostsForStats.length > 0) {
    for (const post of allContentPostsForStats) {
      const likes = randomBetween(10, 40)
      const comments = randomBetween(10, 40)
      const shares = randomBetween(10, 40)
      const bookmarks = randomBetween(10, 40)
      const views = Math.max(
        likes * randomBetween(2, 5),
        likes + comments + shares + bookmarks,
      )

      await prisma.contentPost
        .update({
          where: { id: post.id },
          data: {
            likesCount: likes,
            commentsCount: comments,
            sharesCount: shares,
            favoritesCount: bookmarks,
            viewsCount: views,
          },
        })
        .catch(() => {})
    }
    console.log(`✅ ${allContentPostsForStats.length} content posts enriched with 10-40 stats`)
  } else {
    console.log('ℹ️  No content posts found for stats enrichment')
  }

  // Feed Entries - Kullanıcıların feed'inde görünecek post'lar
  progress.increment('Feed girişleri oluşturuluyor...')
  console.log('📰 Creating feed entries...')
  
  // Tüm post'ları al
  const allPostsForFeed = await prisma.contentPost.findMany({
    where: {},
    orderBy: { createdAt: 'desc' },
    take: 80, // Daha geniş feed testi için 80 post ekle
  })

  // Her post için test kullanıcısının feed'ine ekle
  // Farklı source'larla (TRUSTER, CATEGORY_MATCH, TRENDING, BOOSTED) ekle
  const feedSources = ['TRUSTER', 'CATEGORY_MATCH', 'TRENDING', 'BOOSTED']
  
  for (let i = 0; i < allPostsForFeed.length; i++) {
    const post = allPostsForFeed[i]
    const source = feedSources[i % feedSources.length] as 'TRUSTER' | 'CATEGORY_MATCH' | 'TRENDING' | 'BOOSTED'
    
    // Boosted post'lar için BOOSTED source kullan
    const actualSource = post.isBoosted ? 'BOOSTED' : source
    
    await prisma.feed.create({
      data: {
        id: generateUlid(),
        userId: userIdToUse,
        postId: post.id,
        source: actualSource,
        seen: false,
      }
    }).catch(() => {}) // Duplicate hatası varsa devam et
    // Update unseen feed count
    await prisma.profile.updateMany({
      where: { userId: userIdToUse },
      data: { unseenFeedCount: { increment: 1 } }
    }).catch(() => {})
  }

  // Diğer kullanıcılar varsa onlar için de feed oluştur
  const allUsers = await prisma.user.findMany({
    take: 5, // İlk 5 kullanıcı için
  })

  for (const user of allUsers) {
    if (user.id === userIdToUse) continue // Test kullanıcısını atla, zaten ekledik
    
    // Her kullanıcı için farklı post'lar ekle
    const postsForUser = allPostsForFeed.slice(
      allUsers.indexOf(user) * 3,
      (allUsers.indexOf(user) + 1) * 3
    )

    for (let i = 0; i < postsForUser.length; i++) {
      const post = postsForUser[i]
      const source = feedSources[i % feedSources.length] as 'TRUSTER' | 'CATEGORY_MATCH' | 'TRENDING' | 'BOOSTED'
      const actualSource = post.isBoosted ? 'BOOSTED' : source

      await prisma.feed.create({
        data: {
          id: generateUlid(),
          userId: user.id,
          postId: post.id,
          source: actualSource,
          seen: false,
        }
      }).catch(() => {})
      // Update unseen feed count
      await prisma.profile.updateMany({
        where: { userId: user.id },
        data: { unseenFeedCount: { increment: 1 } }
      }).catch(() => {})
    }
  }

  console.log(`✅ Feed entries created for ${allUsers.length} users`)

  // Profil istatistiklerini (post/trust/truster) senkronize et
  console.log('📈 Syncing profile stats for test user...')
  const [postCount, trustCount, trusterCount] = await Promise.all([
    prisma.contentPost.count({ where: { userId: userIdToUse } }),
    prisma.trustRelation.count({ where: { trusterId: userIdToUse } }),
    prisma.trustRelation.count({ where: { trustedUserId: userIdToUse } }),
  ])

  await prisma.profile.upsert({
    where: { userId: userIdToUse },
    update: {
      postsCount: postCount,
      trustCount,
      trusterCount,
    },
    create: {
      userId: userIdToUse,
      displayName: 'Ömer Faruk',
      userName: 'omerfaruk',
      bannerUrl: DEFAULT_BANNER_URL,
      bio: 'Passionate about exploring the latest gadgets and digital lifestyles. Sharing honest reviews and real-life experiences with tech products.',
      country: 'Turkey',
      postsCount: postCount,
      trustCount,
      trusterCount,
    },
  })
  console.log('✅ Profile stats synced')

  // NFTs and Marketplace Listings
  progress.increment('NFT\'ler ve Marketplace oluşturuluyor...')
  console.log('\n🎨 Creating comprehensive NFTs and Marketplace listings...')
  
  // Belirtilen kullanıcı ID'si için kullanıcı oluştur veya bul
  let targetUser = await prisma.user.findUnique({
    where: { id: TARGET_USER_ID }
  })

  if (!targetUser) {
    targetUser = await prisma.user.create({
      data: {
        id: TARGET_USER_ID,
        email: 'markettest@tipbox.co',
        passwordHash: passwordHash,
        emailVerified: true,
        status: 'ACTIVE',
      }
    })
    console.log(`✅ Target user created with ID: ${TARGET_USER_ID}`)
    
    // Profile oluştur
    await prisma.profile.upsert({
      where: { userId: TARGET_USER_ID },
      create: {
        userId: TARGET_USER_ID,
        displayName: 'Market Test User',
        userName: 'markettest',
        bio: 'Aktif bir NFT koleksiyoneri ve trader',
        country: 'Turkey',
        bannerUrl: DEFAULT_BANNER_URL,
      },
      update: {
        displayName: 'Market Test User',
        userName: 'markettest',
        bannerUrl: DEFAULT_BANNER_URL,
      }
    })
    
  } else {
    console.log(`✅ Target user already exists: ${TARGET_USER_ID}`)
  }
  
  await prisma.userAvatar.deleteMany({ where: { userId: TARGET_USER_ID } })
  await prisma.userAvatar.create({
    data: {
      userId: TARGET_USER_ID,
      imageUrl: MARKET_AVATAR_URL ?? '',
      isActive: true,
    }
  })

  await prisma.userTitle.deleteMany({ where: { userId: TARGET_USER_ID } })
  await prisma.userTitle.create({
    data: {
      userId: TARGET_USER_ID,
      title: TARGET_USER_TITLE,
      earnedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  }).catch(() => {})
  
  // NFT örnekleri oluştur
  // const nftTypes = ['BADGE', 'COSMETIC', 'LOOTBOX'] as const
  // const nftRarities = ['COMMON', 'RARE', 'EPIC'] as const
  
  // Mevcut NFT'leri name bazlı kontrol için al
  const existingNFTs = await prisma.nFT.findMany({
    where: {
      OR: [
        { currentOwnerId: TARGET_USER_ID },
        { currentOwnerId: userIdToUse },
      ]
    },
    select: { name: true, currentOwnerId: true }
  })
  const existingNFTMap = new Map(
    existingNFTs.map(nft => [`${nft.name}_${nft.currentOwnerId || 'null'}`, true])
  )
  
  // Helper function: NFT oluştur veya mevcut olanı döndür
  const createOrGetNFT = async (data: any) => {
    const key = `${data.name}_${data.currentOwnerId || 'null'}`
    if (existingNFTMap.has(key)) {
      // Mevcut NFT'yi bul ve döndür
      const existing = await prisma.nFT.findFirst({
        where: {
          name: data.name,
          currentOwnerId: data.currentOwnerId || null,
        }
      })
      return existing
    }
    const created = await prisma.nFT.create({ data })
    existingNFTMap.set(key, true)
    return created
  }
  
  const nfts = await Promise.all([
    // ===== BELİRTİLEN KULLANICI (248cc91f-b551-4ecc-a885-db1163571330) NFT'LERİ =====
    // Satışta OLMAYAN NFT'ler (koleksiyon)
    createOrGetNFT({
      name: 'Tipbox Pioneer Badge',
      description: 'Platformun ilk günlerinden beri burada olanlar için özel efsanevi badge. Sadece 100 adet basılmıştır.',
      imageUrl: nextMarketplaceImage(),
      type: 'BADGE',
      rarity: 'EPIC',
      isTransferable: true,
      currentOwnerId: TARGET_USER_ID,
    } as any),
    createOrGetNFT({
      name: 'Diamond Profile Frame',
      description: 'Elmas işlemeli, parlayan profil çerçevesi. Profilinize lüks bir görünüm katar.',
      imageUrl: nextMarketplaceImage(),
      type: 'COSMETIC',
      rarity: 'EPIC',
      isTransferable: true,
      currentOwnerId: TARGET_USER_ID,
    } as any),
    createOrGetNFT({
      name: 'Top Contributor Badge',
      description: 'En değerli içerik üreticilerine verilen nadir badge. Topluluğa katkılarınızdan dolayı teşekkürler!',
      imageUrl: nextMarketplaceImage(),
      type: 'BADGE',
      rarity: 'RARE',
      isTransferable: true,
      currentOwnerId: TARGET_USER_ID,
    } as any),
    createOrGetNFT({
      name: 'Neon Pulse Avatar Border',
      description: 'Neon ışıklı, nabız gibi atan avatar çerçevesi. Dikkat çekici ve modern bir görünüm.',
      imageUrl: nextMarketplaceImage(),
      type: 'COSMETIC',
      rarity: 'RARE',
      isTransferable: true,
      currentOwnerId: TARGET_USER_ID,
    } as any),
    
    // Satışta OLAN NFT'ler (bu kullanıcının listelediği)
    createOrGetNFT({
      name: 'Gold Star Badge',
      description: 'A glowing gold star badge, reserved for standout users.',
      imageUrl: nextMarketplaceImage(),
      type: 'BADGE',
      rarity: 'RARE',
      isTransferable: true,
      currentOwnerId: TARGET_USER_ID,
    } as any),
    createOrGetNFT({
      name: 'Platinum Crown Frame',
      description: 'A platinum crown-shaped profile frame. Look like a member of royalty!',
      imageUrl: nextMarketplaceImage(),
      type: 'COSMETIC',
      rarity: 'EPIC',
      isTransferable: true,
      currentOwnerId: TARGET_USER_ID,
    } as any),
    createOrGetNFT({
      name: 'Rainbow Holographic Badge',
      description: 'A rainbow-colored holographic badge with a hologram effect that changes color with the light.',
      imageUrl: nextMarketplaceImage(),
      type: 'BADGE',
      rarity: 'EPIC',
      isTransferable: true,
      currentOwnerId: TARGET_USER_ID,
    } as any),
    createOrGetNFT({
      name: 'Cyber Neon Glow Effect',
      description: 'A cyberpunk-themed neon glow effect with a blue-pink halo around your avatar.',
      imageUrl: nextMarketplaceImage(),
      type: 'COSMETIC',
      rarity: 'RARE',
      isTransferable: true,
      currentOwnerId: TARGET_USER_ID,
    } as any),
    createOrGetNFT({
      name: 'Mystery Treasure Box',
      description: 'İçinde rastgele nadir ödül bulunan gizemli hazine kutusu. Açınca ne çıkacak?',
      imageUrl: nextMarketplaceImage(),
      type: 'LOOTBOX',
      rarity: 'EPIC',
      isTransferable: true,
      currentOwnerId: TARGET_USER_ID,
    } as any),
    createOrGetNFT({
      name: 'Silver Achievement Badge',
      description: 'Gümüş başarı rozeti. Önemli milestone\'ları temsil eder.',
      imageUrl: nextMarketplaceImage(),
      type: 'BADGE',
      rarity: 'COMMON',
      isTransferable: true,
      currentOwnerId: TARGET_USER_ID,
    } as any),
    
    // ===== TEST KULLANICISI (Ömer Faruk) NFT'LERİ =====
    // Test kullanıcısına ait NFT'ler (satışta değil)
    createOrGetNFT({
      name: 'Premium Tipbox Badge',
      description: 'A rare badge for highly active users on the Tipbox platform',
      imageUrl: getSeedMediaPath('badge.premiumshoper' as any, true) || nextMarketplaceImage(),
      type: 'BADGE',
      rarity: 'EPIC',
      isTransferable: true,
      currentOwnerId: userIdToUse,
    } as any),
    createOrGetNFT({
      name: 'Early Adopter Badge',
      description: 'A badge reserved for the very first users of the platform',
      imageUrl: getSeedMediaPath('badge.earlyadapter' as any, true) || nextMarketplaceImage(),
      type: 'BADGE',
      rarity: 'RARE',
      isTransferable: true,
      currentOwnerId: userIdToUse,
    } as any),
    createOrGetNFT({
      name: 'Golden Frame',
      description: 'Profil çerçevesi için özel altın renkli cosmetic item',
      imageUrl: getSeedMediaPath('badge.hardwareexpert' as any, true) || nextMarketplaceImage(),
      type: 'COSMETIC',
      rarity: 'EPIC',
      isTransferable: true,
      currentOwnerId: userIdToUse,
    } as any),
    
    // Satışa konulacak NFT'ler (test kullanıcısına ait)
    createOrGetNFT({
      name: 'Silver Badge',
      description: 'Gümüş renkli özel badge',
      imageUrl: getSeedMediaPath('badge.wishmarker' as any, true) || nextMarketplaceImage(),
      type: 'BADGE',
      rarity: 'COMMON',
      isTransferable: true,
      currentOwnerId: userIdToUse,
    } as any),
    createOrGetNFT({
      name: 'Rainbow Avatar Border',
      description: 'Profil avatarı için renkli çerçeve',
      imageUrl: getSeedMediaPath('badge.premiumshoper' as any, true) || nextMarketplaceImage(),
      type: 'COSMETIC',
      rarity: 'RARE',
      isTransferable: true,
      currentOwnerId: userIdToUse,
    } as any),
    createOrGetNFT({
      name: 'Mystery Lootbox',
      description: 'İçinde rastgele ödül bulunan gizemli kutu',
      imageUrl: getSeedMediaPath('badge.premiumshoper' as any, true) || nextMarketplaceImage(),
      type: 'LOOTBOX',
      rarity: 'EPIC',
      isTransferable: true,
      currentOwnerId: userIdToUse,
    } as any),
    
    // Diğer kullanıcılara ait NFT'ler (satışta)
    ...(await Promise.all([
      // User 1'e ait NFT'ler
      createOrGetNFT({
        name: 'Community Helper Badge',
        description: 'Toplulukta yardımseverlik gösterenlere özel badge',
        imageUrl: nextMarketplaceImage(),
        type: 'BADGE',
        rarity: 'RARE',
        isTransferable: true,
        currentOwnerId: allUsers.length > 1 ? allUsers[1].id : userIdToUse,
      } as any),
      createOrGetNFT({
        name: 'Blue Neon Frame',
        description: 'Mavi neon efektli profil çerçevesi',
        imageUrl: nextMarketplaceImage(),
        type: 'COSMETIC',
        rarity: 'COMMON',
        isTransferable: true,
        currentOwnerId: allUsers.length > 1 ? allUsers[1].id : userIdToUse,
      } as any),
      // User 2'ye ait NFT'ler
      createOrGetNFT({
        name: 'Top Reviewer Badge',
        description: 'En çok değerlendirme yapan kullanıcılara özel badge',
        imageUrl: nextMarketplaceImage(),
        type: 'BADGE',
        rarity: 'EPIC',
        isTransferable: true,
        currentOwnerId: allUsers.length > 2 ? allUsers[2].id : userIdToUse,
      } as any),
      createOrGetNFT({
        name: 'Purple Glow Effect',
        description: 'Profil için mor ışıltı efekti',
        imageUrl: nextMarketplaceImage(),
        type: 'COSMETIC',
        rarity: 'RARE',
        isTransferable: true,
        currentOwnerId: allUsers.length > 2 ? allUsers[2].id : userIdToUse,
      } as any),
      createOrGetNFT({
        name: 'Legendary Lootbox',
        description: 'Efsanevi ödüller içeren özel kutu',
        imageUrl: nextMarketplaceImage(),
        type: 'LOOTBOX',
        rarity: 'EPIC',
        isTransferable: true,
        currentOwnerId: allUsers.length > 2 ? allUsers[2].id : userIdToUse,
      } as any),
    ]))
  ])
  
  // Null değerleri filtrele (createOrGetNFT null döndürebilir)
  const validNFTs = nfts.filter((nft): nft is NonNullable<typeof nft> => nft !== null && nft !== undefined)
  
  console.log(`✅ ${validNFTs.length} NFT oluşturuldu/güncellendi`)

  // NFT Transaction'ları oluştur (mint işlemleri) - sadece ilk batch için
  for (const nft of validNFTs) {
    await prisma.nFTTransaction.create({
      data: {
        nftId: nft.id,
        fromUserId: null, // Mint işlemi
        toUserId: (nft as any).currentOwnerId || userIdToUse,
        transactionType: 'MINT',
        price: null,
      }
    }).catch(() => {})
  }

  // ===== BELİRTİLEN KULLANICI İÇİN MARKETPLACE LİSTİNGLER =====
  // Bu kullanıcının listelediği NFT'ler (index 4-9)
  // Not: validNFTs array'inde index'ler değişmiş olabilir, bu yüzden name bazlı bulma yapıyoruz
  const getNFTByName = (name: string) => validNFTs.find(nft => nft.name === name)
  
  const targetUserListings = await Promise.all([
    getNFTByName('Gold Star Badge') ? prisma.nFTMarketListing.create({
      data: {
        nftId: getNFTByName('Gold Star Badge')!.id,
        listedByUserId: TARGET_USER_ID,
        price: 125.0,
        status: 'ACTIVE',
      }
    }).catch(() => null) : null,
    getNFTByName('Platinum Crown Frame') ? prisma.nFTMarketListing.create({
      data: {
        nftId: getNFTByName('Platinum Crown Frame')!.id,
        listedByUserId: TARGET_USER_ID,
        price: 850.0,
        status: 'ACTIVE',
      }
    }).catch(() => null) : null,
    getNFTByName('Rainbow Holographic Badge') ? prisma.nFTMarketListing.create({
      data: {
        nftId: getNFTByName('Rainbow Holographic Badge')!.id,
        listedByUserId: TARGET_USER_ID,
        price: 750.0,
        status: 'ACTIVE',
      }
    }).catch(() => null) : null,
    getNFTByName('Cyber Neon Glow Effect') ? prisma.nFTMarketListing.create({
      data: {
        nftId: getNFTByName('Cyber Neon Glow Effect')!.id,
        listedByUserId: TARGET_USER_ID,
        price: 425.0,
        status: 'ACTIVE',
      }
    }).catch(() => null) : null,
    getNFTByName('Mystery Treasure Box') ? prisma.nFTMarketListing.create({
      data: {
        nftId: getNFTByName('Mystery Treasure Box')!.id,
        listedByUserId: TARGET_USER_ID,
        price: 1500.0,
        status: 'ACTIVE',
      }
    }).catch(() => null) : null,
    getNFTByName('Silver Achievement Badge') ? prisma.nFTMarketListing.create({
      data: {
        nftId: getNFTByName('Silver Achievement Badge')!.id,
        listedByUserId: TARGET_USER_ID,
        price: 35.0,
        status: 'ACTIVE',
      }
    }).catch(() => null) : null,
  ])
  
  const validListings = targetUserListings.filter((listing): listing is NonNullable<typeof listing> => listing !== null)
  console.log(`✅ ${validListings.length} listing created for target user`)

  // Diğer kullanıcılar için NFT'ler ve listing'ler oluştur
  // Trust ve truster kullanıcılarını kullan (sabit ID'leri var)
  const otherUsers = await prisma.user.findMany({
    where: {
      id: {
        in: [...TRUST_USER_IDS, ...TRUSTER_USER_IDS]
      }
    },
    take: 5
  })

  // Diğer kullanıcılar için çeşitli NFT'ler
  const otherUserNFTs = await Promise.all([
    ...otherUsers.slice(0, 3).flatMap((user, userIdx) => [
      prisma.nFT.create({
        data: {
          name: `User${userIdx + 1} Collector Badge`,
          description: `Special collector badge for user #${userIdx + 1}`,
          imageUrl: nextMarketplaceImage(),
          type: 'BADGE',
          rarity: userIdx === 0 ? 'EPIC' : userIdx === 1 ? 'RARE' : 'COMMON',
          isTransferable: true,
          currentOwnerId: user.id,
        } as any
      }),
      prisma.nFT.create({
        data: {
          name: `Vintage Frame ${userIdx + 1}`,
          description: `Classic and elegant profile frame #${userIdx + 1}`,
          imageUrl: nextMarketplaceImage(),
          type: 'COSMETIC',
          rarity: userIdx === 0 ? 'RARE' : 'COMMON',
          isTransferable: true,
          currentOwnerId: null, // Satışta
        } as any
      }),
      prisma.nFT.create({
        data: {
          name: `Lucky Box #${userIdx + 1}`,
          description: `Lucky number ${userIdx + 1}! What's inside?`,
          imageUrl: nextMarketplaceImage(),
          type: 'LOOTBOX',
          rarity: 'RARE',
          isTransferable: true,
          currentOwnerId: null, // Satışta
        } as any
      }),
    ])
  ])

  // Diğer kullanıcıların NFT'leri için transaction'lar
  for (const nft of otherUserNFTs) {
    await prisma.nFTTransaction.create({
      data: {
        nftId: nft.id,
        fromUserId: null, // Mint işlemi
        toUserId: (nft as any).currentOwnerId || otherUsers[Math.floor(otherUserNFTs.indexOf(nft) / 3)]?.id || userIdToUse,
        transactionType: 'MINT',
        price: null,
      }
    }).catch(() => {})
  }
  console.log('✅ NFT transactions (mint) created')

  // Diğer kullanıcılar için listing'ler
  const otherUserListings = await Promise.all([
    ...otherUserNFTs.slice(1).map((nft, idx) => 
      prisma.nFTMarketListing.create({
        data: {
          nftId: nft.id,
          listedByUserId: otherUsers[Math.floor(idx / 2)].id,
          price: 50.0 + (idx * 25) + Math.random() * 100,
          status: 'ACTIVE',
        }
      })
    )
  ])

  // Test kullanıcısının eski NFT'leri için listing'ler (eğer varsa)
  const silverBadgeNFT = getNFTByName('Silver Badge')
  const rainbowAvatarBorderNFT = getNFTByName('Rainbow Avatar Border')
  
  const testUserListings = await Promise.all([
    silverBadgeNFT ? prisma.nFTMarketListing.create({
      data: {
        nftId: silverBadgeNFT.id,
        listedByUserId: userIdToUse,
        price: 50.0,
        status: 'ACTIVE',
      }
    }).catch(() => null) : null,
    rainbowAvatarBorderNFT ? prisma.nFTMarketListing.create({
      data: {
        nftId: rainbowAvatarBorderNFT.id,
        listedByUserId: userIdToUse,
        price: 150.0,
        status: 'ACTIVE',
      }
    }).catch(() => null) : null,
  ])

  const validTestListings = testUserListings.filter((listing): listing is NonNullable<typeof listing> => listing !== null)
  const marketplaceListings = [
    ...validListings,
    ...otherUserListings,
    ...validTestListings,
  ]
  
  console.log(`✅ ${marketplaceListings.length} marketplace listing oluşturuldu`)

  // NFT'lere gerçekçi attribute'lar ekle
  const allNFTs = [...validNFTs, ...otherUserNFTs]
  for (let i = 0; i < Math.min(20, allNFTs.length); i++) {
    const nft = allNFTs[i]
    if (!nft) continue
    const rarity = nft.rarity
    
    // Edition attribute
    await prisma.nFTAttribute.create({
      data: {
        nftId: nft.id,
        key: 'edition',
        value: rarity === 'EPIC' ? `Limited Edition ${i + 1}/100` : rarity === 'RARE' ? `Edition ${i + 1}/500` : `Edition ${i + 1}/1000`,
      }
    }).catch(() => {})
    
    // Special features
    if (i % 3 === 0) {
      await prisma.nFTAttribute.create({
        data: {
          nftId: nft.id,
          key: 'special_feature',
          value: 'Animated',
        }
      }).catch(() => {})
    }
    
    if (i % 4 === 0 && rarity === 'EPIC') {
      await prisma.nFTAttribute.create({
        data: {
          nftId: nft.id,
          key: 'exclusive',
          value: 'true',
        }
      }).catch(() => {})
    }
    
    if (i % 5 === 0) {
      await prisma.nFTAttribute.create({
        data: {
          nftId: nft.id,
          key: 'year',
          value: '2024',
        }
      }).catch(() => {})
    }
  }
  console.log('✅ NFT attributes created')

  // ===== SELL NFT ENDPOINT'LERİ İÇİN EK TRANSACTION'LAR =====
  // Viewer count, total owner ve earn date testleri için ek transaction'lar ekle
  console.log('🔄 Creating additional NFT transactions for Sell NFT endpoints...')
  
  // TARGET_USER_ID'ye ait ilk 4 NFT'yi al (satışta olmayan koleksiyon NFT'leri)
  const targetUserNFTs = allNFTs.filter((nft: any) => nft && nft.currentOwnerId === TARGET_USER_ID).slice(0, 4)
  
  if (targetUserNFTs.length === 0) {
    console.warn('⚠️ Target user için NFT bulunamadı, ek transaction\'lar atlanıyor')
  } else {
    console.log(`✅ ${targetUserNFTs.length} target user NFT'si bulundu, ek transaction'lar ekleniyor...`)
  }
  
  // Her NFT için farklı senaryolar oluştur
  for (let i = 0; i < Math.min(4, targetUserNFTs.length); i++) {
    const nft = targetUserNFTs[i]
    if (!nft || !nft.id) continue
    
    // İlk NFT: Çok sayıda transaction (yüksek viewer count)
    if (i === 0) {
      // 5-10 arası ek transaction ekle (viewer count için)
      const extraTransactions = 5 + Math.floor(Math.random() * 6)
      for (let j = 0; j < extraTransactions; j++) {
        await prisma.nFTTransaction.create({
          data: {
            nftId: nft.id,
            fromUserId: null,
            toUserId: TARGET_USER_ID, // Aynı kullanıcı (mint-like views)
            transactionType: 'MINT',
            price: null,
            createdAt: daysAgo(30 - j * 3), // Farklı tarihlerde
          }
        }).catch(() => {})
      }
    }
    
    // İkinci NFT: Transfer transaction'ları (totalOwner > 1 için)
    if (i === 1 && otherUsers.length > 0) {
      // İlk transfer: TARGET_USER'dan diğer kullanıcıya
      await prisma.nFTTransaction.create({
        data: {
          nftId: nft.id,
          fromUserId: TARGET_USER_ID,
          toUserId: otherUsers[0]?.id || userIdToUse,
          transactionType: 'TRANSFER',
          price: null,
          createdAt: daysAgo(20),
        }
      }).catch(() => {})
      
      // İkinci transfer: Diğer kullanıcıdan tekrar TARGET_USER'a
      await prisma.nFTTransaction.create({
        data: {
          nftId: nft.id,
          fromUserId: otherUsers[0]?.id || userIdToUse,
          toUserId: TARGET_USER_ID,
          transactionType: 'TRANSFER',
          price: null,
          createdAt: daysAgo(10),
        }
      }).catch(() => {})
      
      // Üçüncü transfer: Tekrar diğer bir kullanıcıya
      if (otherUsers.length > 1) {
        await prisma.nFTTransaction.create({
          data: {
            nftId: nft.id,
            fromUserId: TARGET_USER_ID,
            toUserId: otherUsers[1]?.id || userIdToUse,
            transactionType: 'TRANSFER',
            price: null,
            createdAt: daysAgo(5),
          }
        }).catch(() => {})
      }
      
      // Son transfer: Geri TARGET_USER'a
      await prisma.nFTTransaction.create({
        data: {
          nftId: nft.id,
          fromUserId: otherUsers[0]?.id || otherUsers[1]?.id || userIdToUse,
          toUserId: TARGET_USER_ID,
          transactionType: 'TRANSFER',
          price: null,
          createdAt: daysAgo(2),
        }
      }).catch(() => {})
    }
    
    // Üçüncü NFT: Purchase transaction'ları (fiyatlı işlemler)
    if (i === 2 && otherUsers.length > 0) {
      await prisma.nFTTransaction.create({
        data: {
          nftId: nft.id,
          fromUserId: otherUsers[0]?.id || userIdToUse,
          toUserId: TARGET_USER_ID,
          transactionType: 'PURCHASE',
          price: 100.0 + Math.random() * 200,
          createdAt: daysAgo(15),
        }
      }).catch(() => {})
      
      // İkinci purchase
      await prisma.nFTTransaction.create({
        data: {
          nftId: nft.id,
          fromUserId: TARGET_USER_ID,
          toUserId: otherUsers[0]?.id || userIdToUse,
          transactionType: 'PURCHASE',
          price: 150.0 + Math.random() * 200,
          createdAt: daysAgo(8),
        }
      }).catch(() => {})
      
      // Üçüncü purchase (tekrar TARGET_USER'a)
      await prisma.nFTTransaction.create({
        data: {
          nftId: nft.id,
          fromUserId: otherUsers[0]?.id || userIdToUse,
          toUserId: TARGET_USER_ID,
          transactionType: 'PURCHASE',
          price: 200.0 + Math.random() * 200,
          createdAt: daysAgo(3),
        }
      }).catch(() => {})
    }
    
    // Dördüncü NFT: Eski tarihli transaction (earnDate testi için)
    if (i === 3) {
      // Orijinal mint transaction'ını daha eski bir tarihe güncelle
      const firstTransaction = await prisma.nFTTransaction.findFirst({
        where: { nftId: nft.id },
        orderBy: { createdAt: 'asc' },
      })
      
      if (firstTransaction) {
        await prisma.nFTTransaction.update({
          where: { id: firstTransaction.id },
          data: {
            createdAt: daysAgo(180), // 6 ay önce
          }
        }).catch(() => {})
      }
      
      // Birkaç eski transaction daha ekle
      await prisma.nFTTransaction.create({
        data: {
          nftId: nft.id,
          fromUserId: null,
          toUserId: TARGET_USER_ID,
          transactionType: 'MINT',
          price: null,
          createdAt: daysAgo(120),
        }
      }).catch(() => {})
      
      await prisma.nFTTransaction.create({
        data: {
          nftId: nft.id,
          fromUserId: null,
          toUserId: TARGET_USER_ID,
          transactionType: 'MINT',
          price: null,
          createdAt: daysAgo(90),
        }
      }).catch(() => {})
    }
  }
  
  console.log('✅ Additional NFT transactions created for Sell NFT endpoints')

  // ===== EXPLORE SECTION - Marketplace Banners, Trending Posts, Events =====
  progress.increment('Wishbox event\'leri oluşturuluyor...')
  console.log('🔍 Creating explore data...')

  // 1. Marketplace Banners
  progress.increment('Marketplace banner\'ları oluşturuluyor...')
  console.log('\n📰 Creating marketplace banners...')
  const bannerConfigs: Array<{
    title: string;
    description: string;
    imageKey: string; // Seed media key
    linkUrl: string;
    isActive: boolean;
    displayOrder: number;
  }> = [
    { title: 'Yeni Sezon NFT Koleksiyonu', description: 'Sınırlı sayıda özel avatar ve badge NFT\'leri şimdi satışta!', imageKey: 'marketplace.marketplace', linkUrl: '/marketplace/listings?type=BADGE', isActive: true, displayOrder: 1 },
    { title: 'Epic Rarity İndirimi', description: '%30 indirimli EPIC rarity NFT\'lere göz at', imageKey: 'marketplace.marketplace', linkUrl: '/marketplace/listings?rarity=EPIC', isActive: true, displayOrder: 2 },
    { title: 'Yeni Markalar Platformda', description: 'Ünlü markalar TipBox\'a katıldı! Hemen keşfet.', imageKey: 'marketplace.marketplace', linkUrl: '/explore/brands/new', isActive: true, displayOrder: 3 }
  ]
  
  const banners = await Promise.all(
    bannerConfigs.map(async (config) => {
      // Görsel path'ini al
      const imagePath = getSeedMediaPath(config.imageKey as SeedMediaKey, true);
      
      const existing = await prisma.marketplaceBanner.findFirst({
        where: { title: config.title }
      })
      
      if (existing) {
        // Mevcut banner'ın imageUrl'si boş ise güncelle
        if (!existing.imageUrl || existing.imageUrl.trim() === '') {
          return prisma.marketplaceBanner.update({
            where: { id: existing.id },
            data: {
              imageUrl: imagePath || '',
            }
          })
        }
        return existing
      }
      
      return prisma.marketplaceBanner.create({
        data: {
          title: config.title,
          description: config.description,
          imageUrl: imagePath || '', // Görsel path'i
          linkUrl: config.linkUrl,
          isActive: config.isActive,
          displayOrder: config.displayOrder,
        }
      })
    })
  )
  console.log(`✅ ${banners.length} marketplace banner oluşturuldu/güncellendi`)

  // 2. Trending Posts - Add diverse posts by type to trending
  console.log('📈 Creating trending posts...')
  // Get posts by type to ensure diversity
  const freePosts = await prisma.contentPost.findMany({
    where: { type: 'FREE' },
    take: 8,
    orderBy: { createdAt: 'desc' },
  })
  const tipsPosts = await prisma.contentPost.findMany({
    where: { type: 'TIPS' },
    take: 6,
    orderBy: { createdAt: 'desc' },
  })
  const comparePosts = await prisma.contentPost.findMany({
    where: { type: 'COMPARE' },
    take: 6,
    orderBy: { createdAt: 'desc' },
  })
  const questionPostsForTrending = await prisma.contentPost.findMany({
    where: { type: 'QUESTION' },
    take: 5,
    orderBy: { createdAt: 'desc' },
  })
  const experiencePosts = await prisma.contentPost.findMany({
    where: { type: 'EXPERIENCE' },
    take: 5,
    orderBy: { createdAt: 'desc' },
  })

  const allPostsForTrending = [
    ...freePosts,
    ...tipsPosts,
    ...comparePosts,
    ...questionPostsForTrending,
    ...experiencePosts,
  ].slice(0, 30) // Top 30 posts will be trending

  const trendingPosts: any[] = []
  for (let i = 0; i < allPostsForTrending.length; i++) {
    const post = allPostsForTrending[i]
    try {
      const trendingPost = await prisma.trendingPost.create({
        data: {
          id: generateUlid(),
          postId: post.id,
          score: 100 - i * 3, // Descending scores
          trendPeriod: 'DAILY',
          calculatedAt: new Date(),
        },
      })
      trendingPosts.push(trendingPost)
    } catch (error) {
      // Skip if already exists (unique constraint)
    }
  }
  console.log(`✅ ${trendingPosts.length} trending post oluşturuldu (çeşitli type'larda)`)

  // 3. Wishbox Events (What's News) - Diverse event types
  progress.increment('Wishbox event\'leri oluşturuluyor...')
  console.log('\n🎪 Creating wishbox events...')

  // 3.a Ensure event images are uploaded to MinIO (event/event.png & event/eventcardbg.png)
  // ÖNEMLİ: Önce MinIO'ya yükle, sonra DB'ye yaz
  try {
    const nodeEnv = process.env.NODE_ENV || 'development'
    const s3Endpoint = process.env.S3_ENDPOINT || 'http://minio:9000'
    const containerName = s3Endpoint.includes('minio:9000') 
      ? `tipbox_minio_${nodeEnv}` 
      : 'Harici MinIO'
    
    console.log(`📦 Event görselleri MinIO'ya yükleniyor (${containerName})...`)
    
    const s3Service = new S3Service()
    await s3Service.checkAndCreateBucket()

    const eventPrimaryPath = path.join(__dirname, '../tests/assets/event/event.png')
    const eventBgPath = path.join(__dirname, '../tests/assets/event/eventcardbg.png')

    if (existsSync(eventPrimaryPath)) {
      const buf = readFileSync(eventPrimaryPath)
      await s3Service.uploadFile('event/event.png', buf, 'image/png')
      console.log(`✅ event/event.png ${containerName} container'ına yüklendi`)
    } else {
      console.warn(`⚠️  Event primary image not found at ${eventPrimaryPath}`)
    }

    if (existsSync(eventBgPath)) {
      const buf = readFileSync(eventBgPath)
      await s3Service.uploadFile('event/eventcardbg.png', buf, 'image/png')
      console.log(`✅ event/eventcardbg.png ${containerName} container'ına yüklendi`)
    } else {
      console.warn(`⚠️  Event background image not found at ${eventBgPath}`)
    }
  } catch (err: any) {
    console.error('❌ Event görselleri MinIO\'ya yüklenemedi!', err?.message || String(err))
    console.error('   Seed işlemi devam ediyor ancak event görselleri eksik olacak.')
    // Event görselleri kritik değil, devam et
  }
  const today = new Date()
  const nextWeek = new Date()
  nextWeek.setDate(today.getDate() + 7)
  const nextMonth = new Date()
  nextMonth.setMonth(today.getMonth() + 1)
  const nextTwoWeeks = new Date()
  nextTwoWeeks.setDate(today.getDate() + 14)

  const eventTemplates = [
    // SURVEY events
    { title: 'Yılbaşı Mega Ödül Anketi', description: 'Yılın en iyi ürünlerini belirle, büyük ödüller kazan! 1000 TIPS havuzu seni bekliyor.', eventType: 'SURVEY' as const, endDate: nextMonth },
    { title: 'Kullanıcı Memnuniyet Anketi', description: 'Platform deneyimini değerlendir, görüşlerini paylaş!', eventType: 'SURVEY' as const, endDate: nextTwoWeeks },
    { title: 'Ürün Tercih Anketi', description: 'Hangi ürünleri tercih ediyorsun? Tercihlerini paylaş!', eventType: 'SURVEY' as const, endDate: nextWeek },
    // POLL events
    { title: 'Teknoloji Trendleri 2024', description: '2024\'ün en çok beklenen teknoloji ürünlerini seçiyoruz. Senin tercihin ne?', eventType: 'POLL' as const, endDate: nextWeek },
    { title: 'En İyi Marka Oylaması', description: 'Hangi markayı tercih ediyorsun? Oyunu kullan!', eventType: 'POLL' as const, endDate: nextTwoWeeks },
    { title: 'Yılın Ürünü Oylaması', description: '2024\'ün en iyi ürününü belirle!', eventType: 'POLL' as const, endDate: nextMonth },
    // CONTEST events
    { title: 'Coffee Lovers Survey', description: 'Which coffee machine is the best? Coffee lovers cast their votes in this event.', eventType: 'CONTEST' as const, endDate: nextWeek },
    { title: 'Photo Contest', description: 'Share your best product photos and win rewards!', eventType: 'CONTEST' as const, endDate: nextTwoWeeks },
    { title: 'Content Challenge', description: 'Create the most creative content and win big prizes!', eventType: 'CONTEST' as const, endDate: nextMonth },
    // CHALLENGE events
    { title: '30-Day Product Experience', description: 'Share your product experience for 30 days and earn a badge!', eventType: 'CHALLENGE' as const, endDate: nextMonth },
    { title: 'Community Challenge', description: 'Compete with other users and climb the leaderboard!', eventType: 'CHALLENGE' as const, endDate: nextTwoWeeks },
    { title: 'Monthly Missions', description: 'Complete monthly missions and unlock special rewards!', eventType: 'CHALLENGE' as const, endDate: nextMonth },
    // PROMOTION events
    { title: 'Special Discount Campaign', description: 'Limited-time special discounts! Don’t miss out!', eventType: 'PROMOTION' as const, endDate: nextWeek },
    { title: 'New Member Rewards', description: 'Exclusive gifts and perks for new members!', eventType: 'PROMOTION' as const, endDate: nextTwoWeeks },
    { title: 'End-of-Season Deals', description: 'End-of-season offers and special campaigns!', eventType: 'PROMOTION' as const, endDate: nextMonth },
  ]

  const events = await Promise.all(
    eventTemplates.map((template) =>
      prisma.wishboxEvent
        .create({
          data: {
            id: generateUlid(),
            title: template.title,
            description: template.description,
            imageUrl: getSeedMediaPath('event.primary' as any, true) || null,
            startDate: today,
            endDate: template.endDate,
            status: 'PUBLISHED',
            eventType: template.eventType,
          } as any,
        })
        .catch(() => null)
    )
  )
  const createdEvents = events.filter(Boolean) as any[]
  console.log(`✅ ${createdEvents.length} wishbox event oluşturuldu (tüm eventType'larda çeşitli)`)

  // Brand-specific events (8 per brand, English, unique per brand)
  const brandEventTemplates = [
    { title: 'Launch Spotlight', description: 'Vote on this brand’s most anticipated launch of the season.', eventType: 'POLL' as const },
    { title: 'Customer Voice Pulse', description: 'Share the one improvement you want to see first.', eventType: 'SURVEY' as const },
    { title: 'Feature Priority Vote', description: 'Help us rank the next set of features to build.', eventType: 'POLL' as const },
    { title: 'Usage Deep Dive', description: 'Tell us how you actually use these products day-to-day.', eventType: 'SURVEY' as const },
    { title: 'Bug Bash Challenge', description: 'Report issues and help us harden the experience.', eventType: 'CHALLENGE' as const },
    { title: 'Beta Feedback Sprint', description: 'Try the latest beta and leave actionable feedback.', eventType: 'CONTEST' as const },
    { title: 'Community AMA Week', description: 'Ask anything to the product team and vote on answers.', eventType: 'CONTEST' as const },
    { title: 'Roadmap Checkpoint', description: 'Sanity-check the roadmap and validate our priorities.', eventType: 'SURVEY' as const },
  ]

  console.log('🎯 Creating brand-specific events (8 per brand)...')
  const brandsForEvents = await prisma.brand.findMany()
  if (brandsForEvents.length === 0) {
    console.warn('⚠️ Brand not found, skipping brand-specific event seeding')
  }
  const brandSpecificEvents = await Promise.all(
    brandsForEvents.flatMap((brand) =>
      brandEventTemplates.map((template, templateIndex) => {
        const startDate = new Date(today)
        startDate.setDate(today.getDate() + templateIndex)
        const endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 7 + templateIndex)

        return prisma.wishboxEvent
          .create({
            data: {
              id: generateUlid(),
              title: template.title,
              description: template.description,
              imageUrl: getSeedMediaPath('event.primary' as any, true) || null,
              startDate,
              endDate,
              status: 'PUBLISHED',
              eventType: template.eventType,
              brandId: brand.id,
            } as any,
          })
          .catch(() => null)
      })
    )
  )
  const createdBrandEvents = brandSpecificEvents.filter(Boolean) as any[]
  console.log(`✅ ${createdBrandEvents.length} brand-specific wishbox event oluşturuldu (${brandEventTemplates.length} per brand)`)

  // Brand 081d5660-a6d6-412a-b0ae-1557acaaa028 için özel 12 event oluştur
  const TARGET_BRAND_ID_FOR_EVENTS = '081d5660-a6d6-412a-b0ae-1557acaaa028'
  const targetBrandForEvents = await prisma.brand.findUnique({
    where: { id: TARGET_BRAND_ID_FOR_EVENTS },
    select: { id: true, name: true },
  })

  if (targetBrandForEvents) {
    const targetBrandEventTemplates = [
      { title: 'Bridge Kickoff Summit', description: 'Join the kickoff and learn what is coming next.', eventType: 'POLL' as const, offsetDays: 0, durationDays: 7 },
      { title: 'Feature Wishlist', description: 'Vote the next feature you want delivered first.', eventType: 'SURVEY' as const, offsetDays: 1, durationDays: 10 },
      { title: 'Beta Access Contest', description: 'Enter to win early beta access slots.', eventType: 'CONTEST' as const, offsetDays: 2, durationDays: 5 },
      { title: 'Usage Challenge', description: 'Complete daily tasks and climb the bridge leaderboard.', eventType: 'CHALLENGE' as const, offsetDays: 3, durationDays: 14 },
      { title: 'Creator Spotlight Vote', description: 'Pick the best creator story for this brand.', eventType: 'POLL' as const, offsetDays: 4, durationDays: 6 },
      { title: 'Support Satisfaction Pulse', description: 'Rate the latest support experience.', eventType: 'SURVEY' as const, offsetDays: 5, durationDays: 7 },
      { title: 'Roadmap Checkpoint', description: 'Validate roadmap priorities for Q3.', eventType: 'SURVEY' as const, offsetDays: 6, durationDays: 9 },
      { title: 'Bug Bash Sprint', description: 'Report bugs, earn credit and badges.', eventType: 'CHALLENGE' as const, offsetDays: 7, durationDays: 4 },
      { title: 'Launch Hype Contest', description: 'Share hype content to win merch.', eventType: 'CONTEST' as const, offsetDays: 8, durationDays: 7 },
      { title: 'Referral Boost', description: 'Invite friends and track conversions.', eventType: 'PROMOTION' as const, offsetDays: 9, durationDays: 10 },
      { title: 'Seasonal Offers', description: 'Limited seasonal bundles for the community.', eventType: 'PROMOTION' as const, offsetDays: 10, durationDays: 12 },
      { title: 'Community AMA', description: 'Ask anything to the product leads.', eventType: 'CONTEST' as const, offsetDays: 11, durationDays: 5 },
    ]

    // Batch kontrol: Tüm mevcut event'leri tek sorguda al
    // Not: brandId filtrelemesi Prisma client'ında henüz mevcut olmadığı için tüm event'leri alıyoruz
    const existingEvents = await prisma.wishboxEvent.findMany({
      where: { brandId: targetBrandForEvents.id } as any,
      select: { title: true },
    }).catch(() => [])
    const existingTitles = new Set(existingEvents.map(e => e.title))

    let createdTargetBrandEvents = 0
    for (const template of targetBrandEventTemplates) {
      // Hızlı Set kontrolü (DB sorgusu yok)
      if (existingTitles.has(template.title)) continue

      const startDate = new Date(today)
      startDate.setDate(today.getDate() + template.offsetDays)
      const endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + template.durationDays)

      await prisma.wishboxEvent
        .create({
          data: {
            id: generateUlid(),
            title: template.title,
            description: template.description,
            imageUrl: getSeedMediaPath('event.primary' as any, true) || null,
            startDate,
            endDate,
            status: 'PUBLISHED',
            eventType: template.eventType,
            brandId: targetBrandForEvents.id,
          } as any,
        })
        .catch(() => null)

      existingTitles.add(template.title) // Set'e ekle ki tekrar kontrol etmesin
      createdTargetBrandEvents++
    }
    console.log(`✅ ${createdTargetBrandEvents} wishbox event brand ${targetBrandForEvents.name ?? TARGET_BRAND_ID_FOR_EVENTS} için oluşturuldu (hedef: 12)`)

    // Aynı brand için survey sekmesinin dolu gelmesi adına 12 SURVEY ağırlıklı event
    const targetBrandSurveyTemplates = [
      { title: 'UX Feedback Pulse', description: 'Share your experience with the latest UX changes.', offsetDays: 0, durationDays: 6 },
      { title: 'Onboarding Survey', description: 'Help us improve the first-run experience.', offsetDays: 1, durationDays: 7 },
      { title: 'Performance Check', description: 'Rate app performance on your daily workflow.', offsetDays: 2, durationDays: 5 },
      { title: 'Content Relevance', description: 'Tell us if the recommendations match your interests.', offsetDays: 3, durationDays: 8 },
      { title: 'Notification Tuning', description: 'Which alerts are useful? Help us tune notifications.', offsetDays: 4, durationDays: 6 },
      { title: 'Support Quality', description: 'Evaluate your last support interaction.', offsetDays: 5, durationDays: 7 },
      { title: 'Feature Priorities', description: 'Rank the backlog items for the next release.', offsetDays: 6, durationDays: 9 },
      { title: 'Mobile vs Web', description: 'Which platform do you prefer and why?', offsetDays: 7, durationDays: 5 },
      { title: 'Accessibility Review', description: 'Rate accessibility and propose quick wins.', offsetDays: 8, durationDays: 10 },
      { title: 'Localization Survey', description: 'Are translations accurate? Report issues.', offsetDays: 9, durationDays: 6 },
      { title: 'Security Confidence', description: 'How confident are you in account security?', offsetDays: 10, durationDays: 7 },
      { title: 'Community Health', description: 'How welcoming is the community experience?', offsetDays: 11, durationDays: 8 },
    ]

    // Mevcut existingTitles Set'ini kullan (zaten yukarıda oluşturuldu)
    let createdTargetBrandSurveys = 0
    for (const template of targetBrandSurveyTemplates) {
      // Hızlı Set kontrolü (DB sorgusu yok)
      if (existingTitles.has(template.title)) continue

      const startDate = new Date(today)
      startDate.setDate(today.getDate() + template.offsetDays)
      const endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + template.durationDays)

      await prisma.wishboxEvent
        .create({
          data: {
            id: generateUlid(),
            title: template.title,
            description: template.description,
            imageUrl: getSeedMediaPath('event.primary' as any, true) || null,
            startDate,
            endDate,
            status: 'PUBLISHED',
            eventType: 'SURVEY',
            brandId: targetBrandForEvents.id,
          } as any,
        })
        .catch(() => null)

      existingTitles.add(template.title) // Set'e ekle ki tekrar kontrol etmesin
      createdTargetBrandSurveys++
    }
    console.log(`✅ ${createdTargetBrandSurveys} SURVEY event brand ${targetBrandForEvents.name ?? TARGET_BRAND_ID_FOR_EVENTS} için oluşturuldu (hedef: 12)`)
  } else {
    console.warn(`⚠️ Brand not found (ID: ${TARGET_BRAND_ID_FOR_EVENTS}), skipping target brand event seeding`)
  }

  // Brand bazlı geçmiş/survey event'leri (history & surveys endpoint'leri için)
  console.log('🗂️  Creating brand history/survey events with user stats...')
  const surveyUsers = await prisma.user.findMany({ select: { id: true }, take: 20 })
  const historySurveyEvents = await Promise.all(
    brandsForEvents.map((brand, idx) => {
      const startDate = new Date(today)
      startDate.setDate(today.getDate() - (idx + 3))
      const endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + 2)
      return prisma.wishboxEvent
        .create({
          data: {
            id: generateUlid(),
            title: `${brand.name || 'Brand'} Satisfaction Survey`,
            description: `Share your experience with ${brand.name || 'this brand'} for the history list.`,
            imageUrl: getSeedMediaPath('event.primary' as any, true) || null,
            startDate,
            endDate,
            status: 'PUBLISHED',
            eventType: 'SURVEY',
            brandId: brand.id,
          } as any,
        })
        .catch(() => null)
    })
  )
  const createdHistorySurveyEvents = historySurveyEvents.filter(Boolean) as any[]

  // Kullanıcı bazlı basit istatistikler ekle (foreign key tutarlılığı için)
  const historyStats = await Promise.all(
    createdHistorySurveyEvents.flatMap((event: any, eventIdx) =>
      surveyUsers.slice(0, 5).map((user, userIdx) =>
        prisma.wishboxStats.create({
          data: {
            id: generateUlid(),
            eventId: event.id,
            userId: user.id,
            votes: 1 + ((eventIdx + userIdx) % 3),
            impressions: 10 + eventIdx * 5 + userIdx,
            responses: 1 + (userIdx % 2),
          } as any,
        }).catch(() => null)
      )
    )
  )
  console.log(`✅ ${createdHistorySurveyEvents.length} brand history/survey event eklendi, ${historyStats.filter(Boolean).length} stats oluşturuldu`)

  // Create upcoming events (future events)
  console.log('🔮 Creating upcoming events...')
  const nextMonthPlus = new Date()
  nextMonthPlus.setMonth(today.getMonth() + 2)
  const nextThreeMonths = new Date()
  nextThreeMonths.setMonth(today.getMonth() + 3)

  const upcomingEventTemplates = [
    // SURVEY events (future)
    {
      title: 'Summer Season Product Survey',
      description: 'Help us choose the best products for the summer season!',
      eventType: 'SURVEY' as const,
      startDate: nextMonthPlus,
      endDate: nextThreeMonths,
    },
    {
      title: 'Home Appliances Satisfaction Survey',
      description: 'Rate your experience with your home appliances and share your feedback.',
      eventType: 'SURVEY' as const,
      startDate: nextMonthPlus,
      endDate: nextThreeMonths,
    },
    {
      title: 'Mobile & Gadgets Usage Survey',
      description: 'Tell us how you use your phones, headphones, and wearables in daily life.',
      eventType: 'SURVEY' as const,
      startDate: nextMonthPlus,
      endDate: nextThreeMonths,
    },
    {
      title: 'Gaming & Entertainment Survey',
      description: 'Share which gaming and entertainment products you love the most.',
      eventType: 'SURVEY' as const,
      startDate: nextMonthPlus,
      endDate: nextThreeMonths,
    },

    // POLL events (future)
    {
      title: 'Next-Gen Smartphone Poll',
      description: 'Vote for the smartphone brand you are most excited about this year.',
      eventType: 'POLL' as const,
      startDate: nextMonthPlus,
      endDate: nextThreeMonths,
    },
    {
      title: 'Smart Home Upgrade Poll',
      description: 'Which smart home upgrade would you buy first? Vote now.',
      eventType: 'POLL' as const,
      startDate: nextMonthPlus,
      endDate: nextThreeMonths,
    },
    {
      title: 'Coffee Machine Preference Poll',
      description: 'Automatic vs. manual coffee machines – cast your vote.',
      eventType: 'POLL' as const,
      startDate: nextMonthPlus,
      endDate: nextThreeMonths,
    },
    {
      title: 'Best Value-for-Money Brand Poll',
      description: 'Choose the brand that offers the best value for the price.',
      eventType: 'POLL' as const,
      startDate: nextMonthPlus,
      endDate: nextThreeMonths,
    },

    // CONTEST events (future)
    {
      title: 'Summer Product Photo Contest',
      description: 'Share your best summer-themed product photos and win rewards.',
      eventType: 'CONTEST' as const,
      startDate: nextMonthPlus,
      endDate: nextThreeMonths,
    },
    {
      title: 'Home Setup Showcase Contest',
      description: 'Show your home office or gaming setup and compete for prizes.',
      eventType: 'CONTEST' as const,
      startDate: nextMonthPlus,
      endDate: nextThreeMonths,
    },
    {
      title: 'Creative Review Contest',
      description: 'Write the most creative and helpful product review to win.',
      eventType: 'CONTEST' as const,
      startDate: nextMonthPlus,
      endDate: nextThreeMonths,
    },
    {
      title: 'Tech Collection Showcase Contest',
      description: 'Share a photo of your tech collection and join the contest.',
      eventType: 'CONTEST' as const,
      startDate: nextMonthPlus,
      endDate: nextThreeMonths,
    },

    // CHALLENGE events (future)
    {
      title: 'Summer Missions Challenge',
      description: 'Complete summer missions and unlock special badges.',
      eventType: 'CHALLENGE' as const,
      startDate: nextMonthPlus,
      endDate: nextThreeMonths,
    },
    {
      title: '30-Day Review Challenge',
      description: 'Share at least one detailed product review every day for 30 days.',
      eventType: 'CHALLENGE' as const,
      startDate: nextMonthPlus,
      endDate: nextThreeMonths,
    },
    {
      title: 'Daily Tips Sharing Challenge',
      description: 'Post useful product tips every day and help the community.',
      eventType: 'CHALLENGE' as const,
      startDate: nextMonthPlus,
      endDate: nextThreeMonths,
    },
    {
      title: 'Weekly Comparison Challenge',
      description: 'Publish one detailed product comparison every week.',
      eventType: 'CHALLENGE' as const,
      startDate: nextMonthPlus,
      endDate: nextThreeMonths,
    },
  ]

  const upcomingEvents = await Promise.all(
    upcomingEventTemplates.map((template) =>
      prisma.wishboxEvent
        .create({
          data: {
            id: generateUlid(),
            title: template.title,
            description: template.description,
            imageUrl: getSeedMediaPath('event.cardbg' as any, true) || null,
            startDate: template.startDate,
            endDate: template.endDate,
            status: 'PUBLISHED',
            eventType: template.eventType,
          } as any,
        })
        .catch(() => null)
    )
  )
  const createdUpcomingEvents = upcomingEvents.filter(Boolean) as any[]
  console.log(`✅ ${createdUpcomingEvents.length} yaklaşan event oluşturuldu`)

  // Create scenarios for events (first 3 events)
  console.log('🎯 Creating event scenarios...')
  const scenarios = await Promise.all([
    // Event 1 - New Year survey scenarios
    createdEvents[0]
      ? prisma.wishboxScenario
          .create({
            data: {
              eventId: createdEvents[0].id,
              title: 'Best Phone of the Year',
              description: 'Which phone should be the champion of 2024?',
              orderIndex: 1,
            },
          })
          .catch(() => null)
      : null,
    createdEvents[0]
      ? prisma.wishboxScenario
          .create({
            data: {
              eventId: createdEvents[0].id,
              title: 'Best Laptop of the Year',
              description: 'Which laptop delivered the best performance for you?',
              orderIndex: 2,
            },
          })
          .catch(() => null)
      : null,
    // Event 2 - Technology scenarios
    createdEvents[1]
      ? prisma.wishboxScenario
          .create({
            data: {
              eventId: createdEvents[1].id,
              title: 'Most Anticipated Smartwatch',
              description: 'Which smartwatch are you planning to buy in 2024?',
              orderIndex: 1,
            },
          })
          .catch(() => null)
      : null,
    // Event 3 - Coffee scenarios
    createdEvents[2]
      ? prisma.wishboxScenario
          .create({
            data: {
              eventId: createdEvents[2].id,
              title: 'Fully Automatic vs Manual',
              description: 'Do you prefer a fully automatic or a manual coffee machine?',
              orderIndex: 1,
            },
          })
          .catch(() => null)
      : null,
  ])
  const createdScenarios = scenarios.filter(Boolean)
  console.log(`✅ ${createdScenarios.length} scenario oluşturuldu`)

  // Add event statistics for some users
  console.log('📊 Creating event statistics...')
  const eventStatUserIds = [userIdToUse, TARGET_USER_ID, ...TRUST_USER_IDS.slice(0, 3)]
  const eventStats = await Promise.all(
    createdEvents.flatMap((event) =>
      event ? eventStatUserIds.map((userId) =>
        prisma.wishboxStats.create({
          data: {
            userId,
            eventId: event.id,
            totalParticipated: Math.floor(Math.random() * 5) + 1,
            totalComments: Math.floor(Math.random() * 10),
            helpfulVotesReceived: Math.floor(Math.random() * 20),
          },
        })
      ) : []
    )
  )
  console.log(`✅ ${eventStats.length} event stat oluşturuldu`)

  // 3.d Limited event için senaryolar ve katılımcılar (events/{id}/posts endpoint'i için)
  console.log('🧩 Creating scenarios & choices for limited-time promotion event...')
  const limitedEvent = createdEvents.find((e) => e && e.title === 'Special Discount Campaign')
  if (limitedEvent) {
    const limitedEventId = limitedEvent.id as string

    // Hottest / limited event örneğinde kullanılan kullanıcılar:
    const limitedEventUserIds = [
      TRUST_USER_IDS[2], // 3333...
      TARGET_USER_ID,    // 248c...
      TRUST_USER_IDS[1], // 2222...
      TEST_USER_ID,      // 480f...
    ]

    // Tek bir senaryo oluştur
    const scenario = await prisma.wishboxScenario.create({
      data: {
        eventId: limitedEventId,
        title: 'Special Discount Engagement',
        description: 'Users participating in the Special Discount Campaign.',
        orderIndex: 1,
      },
    })

    // Her kullanıcı için 10 adet choice oluşturalım (toplam 40 satır)
    const choicesData = limitedEventUserIds.flatMap((userId) =>
      Array.from({ length: 10 }).map((_, idx) => ({
        scenarioId: scenario.id,
        userId,
        choiceText: `Participation #${idx + 1} for user ${userId}`,
        isSelected: true,
      }))
    )

    await prisma.scenarioChoice.createMany({
      data: choicesData,
      skipDuplicates: true,
    })

    console.log(`✅ Limited event için ${choicesData.length} scenario choice oluşturuldu`)
  } else {
    console.log('⚠️ Special Discount Campaign eventi bulunamadı, limited event için ekstra scenario oluşturulmadı')
  }

  // Add badge rewards to events
  console.log('🏅 Creating event badge rewards...')
  const allEvents = [...createdEvents, ...createdUpcomingEvents].filter(Boolean)
  const eventBadges = await prisma.badge.findMany({
    where: { type: 'EVENT' },
    take: 10,
  })

  // Get achievement goals that have badge rewards (to map rewardId)
  const eventAchievementGoals = await prisma.achievementGoal.findMany({
    where: { rewardBadgeId: { not: null } },
    include: { rewardBadge: true },
    take: 20,
  })

  if (eventBadges.length > 0 && allEvents.length > 0 && eventAchievementGoals.length > 0) {
    let rewardCount = 0
    for (const event of allEvents.slice(0, 5)) {
      // Her event'e 2-3 badge reward ekle
      const goalsToAdd = eventAchievementGoals.slice(0, Math.min(3, eventAchievementGoals.length))
      for (const goal of goalsToAdd) {
        if (!goal.rewardBadgeId) continue
        try {
          // Her event için farklı kullanıcılara reward ver
          const randomUser = allUserIds[Math.floor(Math.random() * allUserIds.length)]
          // rewardId için achievement goal'un id'sini kullan (Int olarak)
          const rewardIdInt = parseInt(goal.id.replace(/-/g, '').substring(0, 8), 16) % 2147483647
          await prisma.wishboxReward.create({
            data: {
              userId: randomUser,
              eventId: event.id,
              rewardType: 'BADGE',
              rewardId: rewardIdInt,
              amount: null,
            },
          })
          rewardCount++
        } catch (error) {
          // Duplicate veya başka bir hata - devam et
        }
      }
    }
    console.log(`✅ ${rewardCount} event badge reward oluşturuldu`)
  }

  // 4. Yeni product'lar ve inventory media'ları ekle (explore/products/new için)
  console.log('📦 Creating new products with inventory media for explore...')
  const exploreTechCategory = await prisma.mainCategory.findFirst({ where: { name: 'Teknoloji' } })
  const exploreEvYasamCategory = await prisma.mainCategory.findFirst({ where: { name: 'Ev & Yaşam' } })
  
  if (exploreTechCategory && exploreEvYasamCategory) {
    const exploreTechSubCategory = await prisma.subCategory.findFirst({ where: { mainCategoryId: exploreTechCategory.id } })
    const exploreEvYasamSubCategory = await prisma.subCategory.findFirst({ where: { mainCategoryId: exploreEvYasamCategory.id } })

    if (exploreTechSubCategory && exploreEvYasamSubCategory) {
      let exploreTechGroup = await prisma.productGroup.findFirst({ where: { subCategoryId: exploreTechSubCategory.id } })
      if (!exploreTechGroup) {
        exploreTechGroup = await prisma.productGroup.create({
          data: {
            name: 'Explore Tech Products',
            description: 'Explore için teknoloji ürünleri',
            subCategoryId: exploreTechSubCategory.id,
            imageUrl: getSeedMediaPath('product.laptop.macbook', true) || null,
          },
        })
      }
      
      let exploreHomeGroup = await prisma.productGroup.findFirst({ where: { subCategoryId: exploreEvYasamSubCategory.id } })
      if (!exploreHomeGroup) {
        exploreHomeGroup = await prisma.productGroup.create({
          data: {
            name: 'Explore Home Products',
            description: 'Explore için ev ürünleri',
            subCategoryId: exploreEvYasamSubCategory.id,
            imageUrl: getSeedMediaPath('product.vacuum.dyson', true) || null,
          },
        })
      }
      
      const exploreProductGroups = [exploreTechGroup, exploreHomeGroup]

      
      const exploreProducts = [
        { name: 'FitnessTech Heart Rate Monitor', brand: 'FitnessTech', group: exploreProductGroups[0]!, mediaKey: 'product.explore.1' },
        { name: 'FitnessTech Dumbbells', brand: 'FitnessTech', group: exploreProductGroups[0]!, mediaKey: 'product.explore.2' },
        { name: 'FitnessTech Yoga Mat', brand: 'FitnessTech', group: exploreProductGroups[0]!, mediaKey: 'product.explore.3' },
        { name: 'SmartHome Pro Smart Light', brand: 'SmartHome Pro', group: exploreProductGroups[1]!, mediaKey: 'product.explore.4' },
        { name: 'SmartHome Pro Thermostat', brand: 'SmartHome Pro', group: exploreProductGroups[1]!, mediaKey: 'product.explore.5' },
        { name: 'TechVision Smart Watch', brand: 'TechVision', group: exploreProductGroups[0]!, mediaKey: 'product.explore.6' },
        { name: 'TechVision Wireless Earbuds', brand: 'TechVision', group: exploreProductGroups[0]!, mediaKey: 'product.explore.7' },
        { name: 'CoffeeDelight Espresso Machine', brand: 'CoffeeDelight', group: exploreProductGroups[1]!, mediaKey: 'product.explore.8' },
        { name: 'StyleHub Designer Lamp', brand: 'StyleHub', group: exploreProductGroups[1]!, mediaKey: 'product.explore.9' },
        { name: 'StyleHub Modern Chair', brand: 'StyleHub', group: exploreProductGroups[1]!, mediaKey: 'product.explore.10' },
      ]

      if (userIdToUse) {
        for (const productData of exploreProducts) {
          try {
            const product = await prisma.product.create({
              data: {
                name: productData.name,
                brand: productData.brand,
                description: `Yeni eklenen ${productData.name} ürünü`,
                groupId: productData.group.id,
                imageUrl: getSeedMediaPath(productData.mediaKey as any, true) || null,
              },
            })

            // Inventory oluştur
            const inventory = await prisma.inventory.create({
              data: {
                userId: userIdToUse,
                productId: product.id,
                hasOwned: true,
                experienceSummary: `${productData.name} hakkında deneyim paylaşımı`,
              },
            })

            // Inventory media ekle
            const mediaUrl = getSeedMediaPath(productData.mediaKey as any, true) || null
            if (mediaUrl) {
              await prisma.inventoryMedia.create({
                data: {
                  inventoryId: inventory.id,
                  mediaUrl,
                },
              })
            }
          } catch (error) {
            // Product zaten varsa veya hata oluşursa devam et
            console.warn(`Product oluşturulamadı: ${productData.name}`, error)
          }
        }
        console.log(`✅ Explore için ${exploreProducts.length} product ve inventory media oluşturuldu`)
      }
    }
  }

  // 5. Create brand categories
  progress.increment('Brand kategorileri oluşturuluyor...')
  console.log('\n🏷️  Creating brand categories...')
  const brandCategoryConfigs = [
    { name: 'Technology' },
    { name: 'Home & Living' },
    { name: 'Kitchen' },
    { name: 'Health & Fitness' },
    { name: 'Fashion' },
    { name: 'Electronics' },
    { name: 'Sustainability' },
    { name: 'Gaming' },
    { name: 'Beauty' },
    { name: 'Outdoor' },
    { name: 'Pets' },
    { name: 'Travel' },
    { name: 'Baby' },
    { name: 'Automotive' },
  ];

  const brandCategories = await Promise.all(
    brandCategoryConfigs.map(async (config) => {
      return ensureBrandCategory({
        name: config.name,
      });
    })
  );
  console.log(`✅ ${brandCategories.length} brand category oluşturuldu/güncellendi`);

  // 5. Create diverse brands with imageUrl
  console.log('🏢 Creating brands...')
  const TARGET_AUDIO_BRAND_ID = '081d5660-a6d6-412a-b0ae-1557acaaa028'
  const brandsData = [
    {
      name: 'TechVision',
      description: 'Yenilikçi teknoloji ürünleri ve çözümleri sunan global marka',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.computers-tablets', true) || null,
      category: 'Technology',
    },
    {
      name: 'SmartHome Pro',
      description: 'Akıllı ev sistemleri ve IoT cihazları konusunda uzman',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.home-appliances', true) || null,
      category: 'Home & Living',
    },
    {
      name: 'CoffeeDelight',
      description: 'Premium kahve makineleri ve barista ekipmanları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.home-appliances', true) || null,
      category: 'Kitchen',
    },
    {
      name: 'FitnessTech',
      description: 'Akıllı spor ekipmanları ve sağlık takip cihazları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.cameras', true) || null,
      category: 'Health & Fitness',
    },
    {
      name: 'StyleHub',
      description: 'Modern ve şık yaşam ürünleri markası',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.phones', true) || null,
      category: 'Fashion',
    },
    {
      id: TARGET_AUDIO_BRAND_ID,
      name: 'Apple',
      description: 'Apple ürünleri - iPhone, AirPods, Apple Watch ve daha fazlası',
      logoUrl: getSeedMediaPath('brand.catalog.electronic-apple', true) || null,
      imageUrl: getSeedMediaPath('brand.catalog.electronic-apple', true) || null,
      category: 'Electronics',
    },
    {
      name: 'EcoLife',
      description: 'Sürdürülebilir ve çevre dostu ürünler',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.air-conditioner', true) || null,
      category: 'Sustainability',
    },
    {
      name: 'GameZone',
      description: 'Oyun konsolları ve aksesuarları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.games', true) || null,
      category: 'Gaming',
    },
    {
      name: 'BeautyCare',
      description: 'Kişisel bakım ve güzellik ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.phones', true) || null,
      category: 'Beauty',
    },
    {
      name: 'OutdoorGear',
      description: 'Açık hava ve kamp ekipmanları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.drone', true) || null,
      category: 'Outdoor',
    },
    {
      name: 'PetCare Plus',
      description: 'Evcil hayvan bakım ürünleri ve aksesuarları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.cameras', true) || null,
      category: 'Pets',
    },
    {
      name: 'KitchenMaster',
      description: 'Profesyonel mutfak ekipmanları ve aletleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.home-appliances', true) || null,
      category: 'Kitchen',
    },
    {
      name: 'TravelEssentials',
      description: 'Seyahat ve gezi ekipmanları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.phones', true) || null,
      category: 'Travel',
    },
    {
      name: 'BabyCare',
      description: 'Bebek bakım ürünleri ve oyuncakları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.cameras', true) || null,
      category: 'Baby',
    },
    {
      name: 'AutoParts Pro',
      description: 'Otomotiv yedek parça ve aksesuarları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.otomotiv', true) || null,
      category: 'Automotive',
    },
    // Additional brands for better distribution
    {
      name: 'TechNova',
      description: 'Yeni nesil teknoloji çözümleri ve akıllı cihazlar',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.computers-tablets', true) || null,
      category: 'Technology',
    },
    {
      name: 'Samsung',
      description: 'Samsung ürünleri - Galaxy telefonlar, tabletler ve akıllı saatler',
      logoUrl: getSeedMediaPath('brand.catalog.electronic-samsung', true) || null,
      imageUrl: getSeedMediaPath('brand.catalog.electronic-samsung', true) || null,
      category: 'Electronics',
    },
    {
      name: 'FashionForward',
      description: 'Trend moda ve aksesuar koleksiyonları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.phones', true) || null,
      category: 'Fashion',
    },
    {
      name: 'PlayStation Pro',
      description: 'Gaming konsolları ve oyun aksesuarları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.games', true) || null,
      category: 'Gaming',
    },
    {
      name: 'GlowBeauty',
      description: 'Premium kozmetik ve cilt bakım ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.phones', true) || null,
      category: 'Beauty',
    },
    {
      name: 'AdventureGear',
      description: 'Doğa sporları ve macera ekipmanları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.drone', true) || null,
      category: 'Outdoor',
    },
    {
      name: 'PetParadise',
      description: 'Evcil hayvan oyuncakları ve bakım ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.cameras', true) || null,
      category: 'Pets',
    },
    {
      name: 'GreenLife',
      description: 'Organik ve sürdürülebilir yaşam ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.air-conditioner', true) || null,
      category: 'Sustainability',
    },
    {
      name: 'Wanderlust',
      description: 'Seyahat çantaları ve gezi aksesuarları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.phones', true) || null,
      category: 'Travel',
    },
    {
      name: 'CarMax',
      description: 'Otomotiv bakım ürünleri ve aksesuarları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.otomotiv', true) || null,
      category: 'Automotive',
    },
    {
      name: 'BabyBloom',
      description: 'Bebek giyim ve bakım ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.cameras', true) || null,
      category: 'Baby',
    },
    {
      name: 'FitLife',
      description: 'Spor giyim ve fitness ekipmanları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.cameras', true) || null,
      category: 'Health & Fitness',
    },
    {
      name: 'HomeStyle',
      description: 'Ev dekorasyon ve mobilya ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.home-appliances', true) || null,
      category: 'Home & Living',
    },
    {
      name: 'ChefPro',
      description: 'Profesyonel aşçı ekipmanları ve mutfak aletleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.home-appliances', true) || null,
      category: 'Kitchen',
    },
    // --- Additional brands to ensure 5 per category ---
    // Technology (need 3 more)
    {
      name: 'FutureTech',
      description: 'Geleceğin akıllı cihazları ve inovatif çözümler',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.computers-tablets', true) || null,
      category: 'Technology',
    },
    {
      name: 'NanoWorks',
      description: 'Kompakt ve verimli teknoloji ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.computers-tablets', true) || null,
      category: 'Technology',
    },
    {
      name: 'SmartCore',
      description: 'Akıllı ekosistem ve bağlantılı cihazlar',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.computers-tablets', true) || null,
      category: 'Technology',
    },
    // Home & Living (need 3 more)
    {
      name: 'CozyNest',
      description: 'Rahat ve şık ev yaşam ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.home-appliances', true) || null,
      category: 'Home & Living',
    },
    {
      name: 'LivingPlus',
      description: 'Akıllı ev konfor çözümleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.home-appliances', true) || null,
      category: 'Home & Living',
    },
    {
      name: 'CasaPrime',
      description: 'Dekorasyon ve fonksiyonel ev aksesuarları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.home-appliances', true) || null,
      category: 'Home & Living',
    },
    // Kitchen (need 2 more)
    {
      name: 'CookMasters',
      description: 'Mutfak şefleri için premium ekipmanlar',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.home-appliances', true) || null,
      category: 'Kitchen',
    },
    {
      name: 'KitchenCraft',
      description: 'Yaratıcı mutfak gereçleri ve aletleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.home-appliances', true) || null,
      category: 'Kitchen',
    },
    {
      name: 'GourmetHub',
      description: 'Gurmelere özel pişirme çözümleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.home-appliances', true) || null,
      category: 'Kitchen',
    },
    // Health & Fitness (need 3 more)
    {
      name: 'WellnessPro',
      description: 'Sağlık ve wellness teknoloji ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.cameras', true) || null,
      category: 'Health & Fitness',
    },
    {
      name: 'FitTrack',
      description: 'Akıllı takip cihazları ve fitness ekipmanları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.cameras', true) || null,
      category: 'Health & Fitness',
    },
    {
      name: 'HealthGear',
      description: 'Evde spor ve sağlık destek ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.cameras', true) || null,
      category: 'Health & Fitness',
    },
    // Fashion (need 3 more)
    {
      name: 'UrbanStyle',
      description: 'Şehirli ve modern stil koleksiyonları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.phones', true) || null,
      category: 'Fashion',
    },
    {
      name: 'ChicLane',
      description: 'Zarif ve trend moda ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.phones', true) || null,
      category: 'Fashion',
    },
    {
      name: 'TrendLine',
      description: 'Sezonun öne çıkan aksesuar ve giyim ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.phones', true) || null,
      category: 'Fashion',
    },
    // Electronics (need 3 more)
    {
      name: 'Xiaomi',
      description: 'Xiaomi ürünleri - akıllı telefonlar, akıllı ev cihazları ve aksesuarlar',
      logoUrl: getSeedMediaPath('brand.catalog.electronic-xiaomi', true) || null,
      imageUrl: getSeedMediaPath('brand.catalog.electronic-xiaomi', true) || null,
      category: 'Electronics',
    },
    {
      name: 'JBL',
      description: 'JBL ses sistemleri - kulaklıklar, hoparlörler ve profesyonel ses ekipmanları',
      logoUrl: getSeedMediaPath('brand.catalog.electronic-jbl', true) || null,
      imageUrl: getSeedMediaPath('brand.catalog.electronic-jbl', true) || null,
      category: 'Electronics',
    },
    {
      name: 'ASUS',
      description: 'ASUS teknoloji ürünleri - laptoplar, monitörler ve gaming ekipmanları',
      logoUrl: getSeedMediaPath('brand.catalog.electronic-asus', true) || null,
      imageUrl: getSeedMediaPath('brand.catalog.electronic-asus', true) || null,
      category: 'Electronics',
    },
    // Sustainability (need 3 more)
    {
      name: 'EcoWave',
      description: 'Enerji verimli ve çevre dostu ürünler',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.air-conditioner', true) || null,
      category: 'Sustainability',
    },
    {
      name: 'GreenNest',
      description: 'Geri dönüştürülebilir ve sürdürülebilir çözümler',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.air-conditioner', true) || null,
      category: 'Sustainability',
    },
    {
      name: 'PureEarth',
      description: 'Doğa dostu yaşam ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.air-conditioner', true) || null,
      category: 'Sustainability',
    },
    // Gaming (need 3 more)
    {
      name: 'ProGamer',
      description: 'E-spor ekipmanları ve performans aksesuarları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.games', true) || null,
      category: 'Gaming',
    },
    {
      name: 'ArcadeHub',
      description: 'Retro ve arcade oyun çözümleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.games', true) || null,
      category: 'Gaming',
    },
    {
      name: 'NextLevel',
      description: 'Gaming donanımı ve çevre birimleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.games', true) || null,
      category: 'Gaming',
    },
    // Beauty (need 3 more)
    {
      name: 'LuxeGlow',
      description: 'Lüks cilt bakım ve güzellik ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.phones', true) || null,
      category: 'Beauty',
    },
    {
      name: 'PureBeauty',
      description: 'Doğal içerikli kozmetik ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.phones', true) || null,
      category: 'Beauty',
    },
    {
      name: 'SkinEssence',
      description: 'Dermatolojik olarak test edilmiş bakım ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.phones', true) || null,
      category: 'Beauty',
    },
    // Outdoor (need 3 more)
    {
      name: 'TrailBlaze',
      description: 'Doğa yürüyüşü ve kamp ekipmanları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.drone', true) || null,
      category: 'Outdoor',
    },
    {
      name: 'CampPro',
      description: 'Profesyonel kampçılık çözümleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.drone', true) || null,
      category: 'Outdoor',
    },
    {
      name: 'HikeMate',
      description: 'Trekking ve tırmanış ekipmanları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.drone', true) || null,
      category: 'Outdoor',
    },
    // Pets (need 3 more)
    {
      name: 'PawPlanet',
      description: 'Evcil hayvan yaşam ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.cameras', true) || null,
      category: 'Pets',
    },
    {
      name: 'PetJoy',
      description: 'Pet oyuncak ve bakım ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.cameras', true) || null,
      category: 'Pets',
    },
    {
      name: 'FurryCare',
      description: 'Evcil dostlar için sağlık ve bakım çözümleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.cameras', true) || null,
      category: 'Pets',
    },
    // Travel (need 3 more)
    {
      name: 'GlobeTrot',
      description: 'Seyahat aksesuarları ve bavullar',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.phones', true) || null,
      category: 'Travel',
    },
    {
      name: 'TripMate',
      description: 'Konforlu seyahat çözümleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.phones', true) || null,
      category: 'Travel',
    },
    {
      name: 'VoyagePro',
      description: 'Dayanıklı seyahat ekipmanları',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.phones', true) || null,
      category: 'Travel',
    },
    // Baby (need 3 more)
    {
      name: 'TinySteps',
      description: 'Bebek giyim ve bakım çözümleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.cameras', true) || null,
      category: 'Baby',
    },
    {
      name: 'BabyNest',
      description: 'Konforlu bebek uyku ve bakım ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.cameras', true) || null,
      category: 'Baby',
    },
    {
      name: 'LittleJoy',
      description: 'Bebek oyuncakları ve gelişim ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.cameras', true) || null,
      category: 'Baby',
    },
    // Automotive (need 3 more)
    {
      name: 'DriveMax',
      description: 'Otomotiv performans ve bakım ürünleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.otomotiv', true) || null,
      category: 'Automotive',
    },
    {
      name: 'AutoGear',
      description: 'Araç içi aksesuar ve teknolojiler',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.otomotiv', true) || null,
      category: 'Automotive',
    },
    {
      name: 'MotoPro',
      description: 'Araç bakım ve güvenlik çözümleri',
      logoUrl: getSeedMediaPath('explore.event.primary', true) || null,
      imageUrl: getSeedMediaPath('catalog.otomotiv', true) || null,
      category: 'Automotive',
    },
  ]

  const brands = await Promise.all(
    brandsData.map(async (brandData) => {
      const category = brandCategories.find(c => c.name === brandData.category);
      const baseData = {
        name: brandData.name,
        description: brandData.description,
        logoUrl: brandData.logoUrl,
        imageUrl: brandData.imageUrl, // Her zaman localhost URL'si kullan
        category: brandData.category,
        categoryId: category?.id,
      }

      if (brandData.id) {
        return prisma.brand.upsert({
          where: { id: brandData.id },
          update: baseData,
          create: { id: brandData.id, ...baseData },
        }).catch(() => null)
      }

      // Mevcut brand'ı bul veya oluştur
      const existing = await prisma.brand.findFirst({
        where: { name: brandData.name }
      }).catch(() => null);

      if (existing) {
        return prisma.brand.update({
          where: { id: existing.id },
          data: baseData,
        });
      } else {
        return prisma.brand.create({
          data: baseData,
        }).catch(() => null);
      }
    })
  )
  const createdBrands = brands.filter(Boolean)
  console.log(`✅ ${createdBrands.length} brand oluşturuldu (imageUrl ile)`)

  // ===== MARKETPLACE.JPG GÖRSELLERİNİ TÜM BRAND'LARA EKLE =====
  // ÖNEMLİ: Önce MinIO'ya yükle, sonra DB'ye yaz
  console.log('🖼️ Brand catalog için marketplace.jpg görselleri yükleniyor...')
  const marketplaceImagePath = path.join(__dirname, '../tests/assets/marketplace/marketplace.jpg')
  
  // Dosya varlık kontrolü
  if (existsSync(marketplaceImagePath)) {
    try {
      const nodeEnv = process.env.NODE_ENV || 'development'
      const s3Endpoint = process.env.S3_ENDPOINT || 'http://minio:9000'
      const containerName = s3Endpoint.includes('minio:9000') 
        ? `tipbox_minio_${nodeEnv}` 
        : 'Harici MinIO'
      
      console.log(`  📁 marketplace.jpg dosyası bulundu, ${containerName} container'ına yükleniyor...`)
      const s3Service = new S3Service()
      await s3Service.checkAndCreateBucket()
      
      const marketplaceImageBuffer = readFileSync(marketplaceImagePath)
      console.log(`  📦 Görsel boyutu: ${(marketplaceImageBuffer.length / 1024 / 1024).toFixed(2)} MB`)
      
      // Tüm brand'ları al
      const allBrands = await prisma.brand.findMany()
      console.log(`  📋 ${allBrands.length} brand için görsel yükleme başlatılıyor...`)
      console.log(`  ⚠️  Önce MinIO'ya yüklenecek, sonra DB'ye yazılacak...\n`)
      
      let successCount = 0
      let failCount = 0
      
      // Her brand için marketplace.jpg'yi yükle
      for (const brand of allBrands) {
        try {
          // Her brand için unique bir object key oluştur
          const objectKey = `brands/catalog/${brand.id}/marketplace.jpg`
          
          // ÖNEMLİ: Önce MinIO'ya yükle
          // MinIO'ya yükle - artık sadece path döndürür (tam URL değil)
          // DB'de sadece path tutulacak, response'larda resolveMediaUrl ile tam URL'ye çevrilecek
          const mediaPath = await s3Service.uploadFile(
            objectKey,
            marketplaceImageBuffer,
            'image/jpeg'
          )

          // Sonra DB'ye yaz - imageUrl'e sadece path'i kaydet (tam URL değil)
          await prisma.brand.update({
            where: { id: brand.id },
            data: {
              imageUrl: mediaPath,
            },
          })
          
          successCount++
          
          // Her 10 brand'ta bir progress göster
          if (successCount % 10 === 0) {
            console.log(`    ✅ ${successCount}/${allBrands.length} brand için görsel MinIO'ya yüklendi ve DB'ye yazıldı...`)
          }
        } catch (brandError: any) {
          const errorMsg = brandError instanceof Error ? brandError.message : String(brandError)
          console.error(`    ❌ ${brand.name} için görsel yüklenemedi: ${errorMsg}`)
          failCount++
        }
      }
      
      console.log(`  ✅ ${successCount} brand için marketplace.jpg görseli başarıyla yüklendi ve DB'ye kaydedildi`)
      if (failCount > 0) {
        console.warn(`  ⚠️ ${failCount} brand için görsel yüklenemedi`)
      }
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`  ❌ Marketplace görsel yükleme hatası: ${errorMsg}`)
      console.warn('  ⚠️ Görseller yüklenemedi, brand\'lar görsel olmadan devam ediyor...')
    }
  } else {
    console.warn(`  ⚠️ marketplace.jpg dosyası bulunamadı: ${marketplaceImagePath}`)
  }

  // Brand catalog ve banner görsellerini yükle
  console.log('\n🖼️ Brand catalog ve banner görselleri yükleniyor...')
  const assetsBasePath = path.join(__dirname, '../tests/assets')
  const allBrandsForImages = await prisma.brand.findMany()
  
  // Mevcut brand'ları yeni görsellerle eşleştir (yeni brand eklenmedi, sadece görseller güncellendi)
  const brandCatalogMapping: Record<string, { category: 'electronic' | 'cosmetic'; brandName: string }> = {
    // Electronics kategorisindeki mevcut brand'lar
    'AudioMax': { category: 'electronic', brandName: 'apple' },
    'SoundWave': { category: 'electronic', brandName: 'jbl' },
    'PulseAudio': { category: 'electronic', brandName: 'marshall' },
    'VoltEdge': { category: 'electronic', brandName: 'samsung' },
    'CircuitHub': { category: 'electronic', brandName: 'xiaomi' },
    'TechVision': { category: 'electronic', brandName: 'asus' },
    'TechNova': { category: 'electronic', brandName: 'msi' },
    'FutureTech': { category: 'electronic', brandName: 'nvidia' },
    'NanoWorks': { category: 'electronic', brandName: 'canon' },
    'SmartCore': { category: 'electronic', brandName: 'steelseries' },
    // Home & Living kategorisindeki mevcut brand'lar
    'SmartHome Pro': { category: 'electronic', brandName: 'dyson' },
    // Beauty kategorisindeki mevcut brand'lar
    'BeautyCare': { category: 'cosmetic', brandName: 'chanel' },
    'GlowBeauty': { category: 'cosmetic', brandName: 'dior' },
    'LuxeGlow': { category: 'cosmetic', brandName: 'mac' },
    'PureBeauty': { category: 'cosmetic', brandName: 'lorealparis' },
    'SkinEssence': { category: 'cosmetic', brandName: 'maybelline' },
    'StyleHub': { category: 'cosmetic', brandName: 'nars' },
    'FashionForward': { category: 'cosmetic', brandName: 'esteelauder' },
    'UrbanStyle': { category: 'cosmetic', brandName: 'sephora' },
    'ChicLane': { category: 'cosmetic', brandName: 'bioderma' },
    'TrendLine': { category: 'cosmetic', brandName: 'neutrogena' },
  }
  
  // Banner görselleri sadece electronic brand'lar için
  const brandBannerMapping: Record<string, string> = {
    'AudioMax': 'apple',
    'SoundWave': 'jbl',
    'PulseAudio': 'marshall',
    'VoltEdge': 'samsung',
    'CircuitHub': 'xiaomi',
    'TechVision': 'asus',
    'TechNova': 'msi',
    'FutureTech': 'nvidia',
    'NanoWorks': 'canon',
    'SmartCore': 'steelseries',
    'SmartHome Pro': 'dyson',
  }
  
  try {
    const s3Service = new S3Service()
    await s3Service.checkAndCreateBucket()
    
    // Brand catalog görsellerini yükle
    let catalogSuccessCount = 0
    let catalogFailCount = 0
    
    for (const brand of allBrandsForImages) {
      const catalogInfo = brandCatalogMapping[brand.name]
      if (!catalogInfo) continue
      
      try {
        const catalogImagePath = path.join(
          assetsBasePath,
          'Select Brand',
          catalogInfo.category === 'electronic' ? 'Electronic' : 'Cosmetic',
          `brandcatalog-${catalogInfo.category}-${catalogInfo.brandName}.png`
        )
        
        if (!existsSync(catalogImagePath)) {
          console.warn(`    ⚠️  ${brand.name} için catalog görseli bulunamadı: ${catalogImagePath}`)
          continue
        }
        
        const catalogImageBuffer = readFileSync(catalogImagePath)
        const catalogObjectKey = `brands/catalog/${catalogInfo.category}-${catalogInfo.brandName}.png`
        
        // MinIO'ya yükle
        const catalogMediaPath = await s3Service.uploadFile(
          catalogObjectKey,
          catalogImageBuffer,
          'image/png'
        )
        
        // DB'ye yaz - logoUrl olarak kaydet (catalog görseli logo olarak kullanılabilir)
        await prisma.brand.update({
          where: { id: brand.id },
          data: {
            logoUrl: catalogMediaPath,
          },
        })
        
        catalogSuccessCount++
      } catch (catalogError: any) {
        const errorMsg = catalogError instanceof Error ? catalogError.message : String(catalogError)
        console.error(`    ❌ ${brand.name} için catalog görseli yüklenemedi: ${errorMsg}`)
        catalogFailCount++
      }
    }
    
    if (catalogSuccessCount > 0) {
      console.log(`  ✅ ${catalogSuccessCount} brand için catalog görseli yüklendi`)
    }
    if (catalogFailCount > 0) {
      console.warn(`  ⚠️ ${catalogFailCount} brand için catalog görseli yüklenemedi`)
    }
    
    // Brand banner görsellerini yükle (electronic brand'lar için)
    let bannerSuccessCount = 0
    let bannerFailCount = 0
    
    for (const brand of allBrandsForImages) {
      const bannerKey = brandBannerMapping[brand.name]
      if (!bannerKey) continue
      
      try {
        const bannerFileName = bannerKey === 'marshall' ? 'marshall.jpg' : `brandpage-electronic-${bannerKey}.jpg`
        const bannerImagePath = path.join(
          assetsBasePath,
          'Brand Page',
          'Electronic',
          'Brand Banners',
          bannerFileName
        )
        
        if (!existsSync(bannerImagePath)) {
          console.warn(`    ⚠️  ${brand.name} için banner görseli bulunamadı: ${bannerImagePath}`)
          continue
        }
        
        const bannerImageBuffer = readFileSync(bannerImagePath)
        const bannerObjectKey = `brands/banners/electronic-${bannerKey}.jpg`
        
        // MinIO'ya yükle
        const bannerMediaPath = await s3Service.uploadFile(
          bannerObjectKey,
          bannerImageBuffer,
          'image/jpeg'
        )
        
        // DB'ye yaz - imageUrl olarak kaydet (banner görseli brand sayfasında kullanılır)
        await prisma.brand.update({
          where: { id: brand.id },
          data: {
            imageUrl: bannerMediaPath,
          },
        })
        
        bannerSuccessCount++
      } catch (bannerError: any) {
        const errorMsg = bannerError instanceof Error ? bannerError.message : String(bannerError)
        console.error(`    ❌ ${brand.name} için banner görseli yüklenemedi: ${errorMsg}`)
        bannerFailCount++
      }
    }
    
    if (bannerSuccessCount > 0) {
      console.log(`  ✅ ${bannerSuccessCount} brand için banner görseli yüklendi`)
    }
    if (bannerFailCount > 0) {
      console.warn(`  ⚠️ ${bannerFailCount} brand için banner görseli yüklenemedi`)
    }
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`  ❌ Brand catalog/banner görsel yükleme hatası: ${errorMsg}`)
    console.warn('  ⚠️ Brand catalog/banner görselleri yüklenemedi, devam ediliyor...')
  }

  console.log('🏅 Creating bridge rewards for profile collections...')
  // Tüm brand'ları al (sadece belirli brand'lar değil)
  const allBrands = await prisma.brand.findMany({
    take: 10, // İlk 10 brand
  })
  const bridgeBrandMap = new Map(allBrands.map((brand) => [brand.name, brand]))

  // Mevcut bridge badge'leri bul (Bridge Ambassador, Brand Visionary gibi)
  const bridgeBadges = await prisma.badge.findMany({
    where: {
      OR: [
        { name: { contains: 'Bridge', mode: 'insensitive' } },
        { name: { contains: 'Brand', mode: 'insensitive' } },
      ],
    },
    take: 5, // İlk 5 bridge badge
  })

  // Tekrarlı bridge ödüllerini engellemek için kullanıcı-badge bazlı takip
  const bridgeRewardKey = (userId: string, badgeId: string) => `${userId}:${badgeId}`
  const existingBridgeRewardKeys = new Set<string>(
    (
      await prisma.bridgeReward.findMany({
        select: { userId: true, badgeId: true },
      })
    ).map(rw => bridgeRewardKey(rw.userId, rw.badgeId))
  )

  const createBridgeRewardIfUnique = async ({
    userId,
    badgeId,
    brandId,
    awardedAt,
  }: {
    userId: string
    badgeId: string
    brandId: string
    awardedAt: Date
  }): Promise<boolean> => {
    const key = bridgeRewardKey(userId, badgeId)
    if (existingBridgeRewardKeys.has(key)) return false

    const alreadyExists = await prisma.bridgeReward
      .findFirst({
        where: { userId, badgeId },
      })
      .catch(() => null)

    if (alreadyExists) {
      existingBridgeRewardKeys.add(key)
      return false
    }

    await prisma.bridgeReward
      .create({
        data: { userId, badgeId, brandId, awardedAt },
      })
      .catch(() => {})

    existingBridgeRewardKeys.add(key)
    return true
  }

  if (bridgeBadges.length === 0) {
    console.warn('⚠️ Bridge badge bulunamadı, bridge rewards oluşturulamadı')
  } else {
    // Her brand için kullanıcıya badge'ler ver
    const bridgeRewardSeeds: Array<{
      userId: string
      badgeId: string
      brandName: string
      daysAgoValue: number
    }> = []

    // Test kullanıcısı için her brand'den en az 1-4 badge (4 tane max badgeList için)
    for (const brand of allBrands.slice(0, 5)) {
      const badgesForBrand = bridgeBadges.slice(0, Math.min(4, bridgeBadges.length))
      for (let i = 0; i < badgesForBrand.length; i++) {
        bridgeRewardSeeds.push({
          userId: userIdToUse,
          badgeId: badgesForBrand[i].id,
          brandName: brand.name,
          daysAgoValue: randomBetween(1, 60),
        })
      }
    }

    // Diğer kullanıcılar için de bazı badge'ler
    for (const userId of [TARGET_USER_ID, ...TRUST_USER_IDS].slice(0, 3)) {
      for (const brand of allBrands.slice(0, 2)) {
        const badge = bridgeBadges[randomBetween(0, bridgeBadges.length - 1)]
        if (badge) {
          bridgeRewardSeeds.push({
            userId,
            badgeId: badge.id,
            brandName: brand.name,
            daysAgoValue: randomBetween(1, 60),
          })
        }
      }
    }

    let createdBridgeRewards = 0
    for (const seed of bridgeRewardSeeds) {
      const brand = bridgeBrandMap.get(seed.brandName)
      if (!brand) continue

      const created = await createBridgeRewardIfUnique({
        userId: seed.userId,
        badgeId: seed.badgeId,
        brandId: brand.id,
        awardedAt: daysAgo(seed.daysAgoValue),
      })
      if (created) createdBridgeRewards++
    }
    console.log(`✅ ${createdBridgeRewards} bridge rewards created`)
  }

  // AudioMax brand için özel badge rewards (history endpoint için 4 badge)
  console.log('🏅 Creating AudioMax brand badge rewards for history endpoint...')
  const AUDIO_MAX_BRAND_ID_FOR_HISTORY = 'e5c57b8e-b4ac-4de8-a12a-4d1724f8099b'
  
  const audioMaxBrandForHistory = await prisma.brand.findUnique({
    where: { id: AUDIO_MAX_BRAND_ID_FOR_HISTORY },
    select: { id: true, name: true },
  })
  
  if (audioMaxBrandForHistory) {
    // Bridge badge'leri bul (eğer yoksa genel badge'lerden al)
    let availableBadges = await prisma.badge.findMany({
      where: {
        OR: [
          { name: { contains: 'Bridge', mode: 'insensitive' } },
          { name: { contains: 'Brand', mode: 'insensitive' } },
          { name: { contains: 'Ambassador', mode: 'insensitive' } },
          { name: { contains: 'Visionary', mode: 'insensitive' } },
        ],
      },
      take: 10,
    })
    
    // Eğer bridge badge yoksa, genel badge'lerden al
    if (availableBadges.length === 0) {
      availableBadges = await prisma.badge.findMany({
        take: 10,
      })
    }
    
    if (availableBadges.length === 0) {
      console.warn('⚠️ No badges found for AudioMax brand history rewards')
    } else {
      // Test kullanıcısı için AudioMax brand'den tam 4 badge reward oluştur
      const targetBadgeCount = 4
      const badgesToUse = availableBadges.slice(0, Math.min(targetBadgeCount, availableBadges.length))
      
      let audioMaxRewardsCreated = 0
      for (let i = 0; i < badgesToUse.length; i++) {
        const badge = badgesToUse[i]
        
        const created = await createBridgeRewardIfUnique({
          userId: userIdToUse,
          brandId: AUDIO_MAX_BRAND_ID_FOR_HISTORY,
          badgeId: badge.id,
          awardedAt: daysAgo(randomBetween(1, 90)), // Son 90 gün içinde rastgele tarih
        })
        if (created) {
          audioMaxRewardsCreated++
          console.log(`  ✅ Created badge reward: ${badge.name} for AudioMax brand`)
        } else {
          console.log(`  ℹ️  Badge reward already exists: ${badge.name}`)
        }
      }
      
      // Eğer 4'ten az badge reward oluşturulduysa, mevcut badge'lerden tekrar kullanarak tamamla
      const currentRewardCount = await prisma.bridgeReward.count({
        where: {
          userId: userIdToUse,
          brandId: AUDIO_MAX_BRAND_ID_FOR_HISTORY,
        },
      })
      
      if (currentRewardCount < targetBadgeCount && availableBadges.length > 0) {
        const needed = targetBadgeCount - currentRewardCount
        const additionalBadges = availableBadges.slice(badgesToUse.length, badgesToUse.length + needed)
        
        for (const badge of additionalBadges) {
          const created = await createBridgeRewardIfUnique({
            userId: userIdToUse,
            brandId: AUDIO_MAX_BRAND_ID_FOR_HISTORY,
            badgeId: badge.id,
            awardedAt: daysAgo(randomBetween(1, 90)),
          })
          if (created) {
            audioMaxRewardsCreated++
            console.log(`  ✅ Created additional badge reward: ${badge.name} for AudioMax brand`)
          }
        }
      }
      
      const finalRewardCount = await prisma.bridgeReward.count({
        where: {
          userId: userIdToUse,
          brandId: AUDIO_MAX_BRAND_ID_FOR_HISTORY,
        },
      })
      
      console.log(`✅ AudioMax brand history badge rewards: ${finalRewardCount} badge(s) for user ${userIdToUse}`)
    }
  } else {
    console.warn(`⚠️ AudioMax brand not found (ID: ${AUDIO_MAX_BRAND_ID_FOR_HISTORY}), skipping history badge rewards`)
  }

  // Brand 9d4ede32-1e02-4165-b094-6db1dd614de8 için özel badge rewards (history endpoint için 4 badge)
  console.log('🏅 Creating brand badge rewards for history endpoint (9d4ede32-1e02-4165-b094-6db1dd614de8)...')
  const BRAND_ID_FOR_HISTORY = '9d4ede32-1e02-4165-b094-6db1dd614de8'
  
  const brandForHistory = await prisma.brand.findUnique({
    where: { id: BRAND_ID_FOR_HISTORY },
    select: { id: true, name: true },
  })
  
  if (brandForHistory) {
    // Bridge badge'leri bul (eğer yoksa genel badge'lerden al)
    let availableBadges = await prisma.badge.findMany({
      where: {
        OR: [
          { name: { contains: 'Bridge', mode: 'insensitive' } },
          { name: { contains: 'Brand', mode: 'insensitive' } },
          { name: { contains: 'Ambassador', mode: 'insensitive' } },
          { name: { contains: 'Visionary', mode: 'insensitive' } },
        ],
      },
      take: 10,
    })
    
    // Eğer bridge badge yoksa, genel badge'lerden al
    if (availableBadges.length === 0) {
      availableBadges = await prisma.badge.findMany({
        take: 10,
      })
    }
    
    if (availableBadges.length === 0) {
      console.warn('⚠️ No badges found for brand history rewards')
    } else {
      // Test kullanıcısı için bu brand'den tam 4 badge reward oluştur
      const targetBadgeCount = 4
      const badgesToUse = availableBadges.slice(0, Math.min(targetBadgeCount, availableBadges.length))
      
      let brandRewardsCreated = 0
      for (let i = 0; i < badgesToUse.length; i++) {
        const badge = badgesToUse[i]
        
        const created = await createBridgeRewardIfUnique({
          userId: userIdToUse,
          brandId: BRAND_ID_FOR_HISTORY,
          badgeId: badge.id,
          awardedAt: daysAgo(randomBetween(1, 90)), // Son 90 gün içinde rastgele tarih
        })
        if (created) {
          brandRewardsCreated++
          console.log(`  ✅ Created badge reward: ${badge.name} for brand ${brandForHistory.name}`)
        } else {
          console.log(`  ℹ️  Badge reward already exists: ${badge.name}`)
        }
      }
      
      // Eğer 4'ten az badge reward oluşturulduysa, mevcut badge'lerden tekrar kullanarak tamamla
      const currentRewardCount = await prisma.bridgeReward.count({
        where: {
          userId: userIdToUse,
          brandId: BRAND_ID_FOR_HISTORY,
        },
      })
      
      if (currentRewardCount < targetBadgeCount && availableBadges.length > 0) {
        const needed = targetBadgeCount - currentRewardCount
        const additionalBadges = availableBadges.slice(badgesToUse.length, badgesToUse.length + needed)
        
        for (const badge of additionalBadges) {
          const created = await createBridgeRewardIfUnique({
            userId: userIdToUse,
            brandId: BRAND_ID_FOR_HISTORY,
            badgeId: badge.id,
            awardedAt: daysAgo(randomBetween(1, 90)),
          })
          if (created) {
            brandRewardsCreated++
            console.log(`  ✅ Created additional badge reward: ${badge.name} for brand ${brandForHistory.name}`)
          }
        }
      }
      
      const finalRewardCount = await prisma.bridgeReward.count({
        where: {
          userId: userIdToUse,
          brandId: BRAND_ID_FOR_HISTORY,
        },
      })
      
      console.log(`✅ Brand ${brandForHistory.name} history badge rewards: ${finalRewardCount} badge(s) for user ${userIdToUse}`)
    }
  } else {
    console.warn(`⚠️ Brand not found (ID: ${BRAND_ID_FOR_HISTORY}), skipping history badge rewards`)
  }

  // Create BridgePosts for brands
  console.log('📝 Creating bridge posts for brands...')
  const bridgePostTemplates = [
    { content: 'Yeni ürün serimiz çok yakında! 🚀 Teknoloji tutkunları için özel tasarımlar hazırlıyoruz.' },
    { content: 'Kullanıcı geri bildirimleriniz sayesinde ürünlerimizi sürekli geliştiriyoruz. Teşekkürler! 💙' },
    { content: 'Bu ayın öne çıkan ürünü: Premium kalite, uygun fiyat. Kaçırmayın! ⭐' },
    { content: 'Sürdürülebilirlik odaklı yeni koleksiyonumuz yakında sizlerle. Doğaya saygı, geleceğe yatırım 🌱' },
    { content: 'Topluluk anketimiz devam ediyor! Görüşlerinizi paylaşın, ürün geliştirme sürecine katılın 📊' },
    { content: 'Yeni özellikler ve iyileştirmeler için çalışıyoruz. Yakında büyük bir sürpriz var! 🎁' },
    { content: 'Kullanıcı deneyimlerinizi okumak bizi çok mutlu ediyor. Paylaşımlarınız için teşekkürler! 🙏' },
    { content: 'Özel kampanyalar ve indirimler için bizi takip etmeye devam edin. Fırsatları kaçırmayın! 🎯' },
    { content: '2024 yılında sizlerle birlikte büyük adımlar attık. 2025\'te daha da iyisini yapacağız! 🎉' },
    { content: 'Ürün geliştirme ekibimiz sürekli çalışıyor. Yakında çok özel bir duyuru yapacağız! 🔥' },
    { content: 'Müşteri memnuniyeti bizim önceliğimiz. Her geri bildiriminiz bizim için çok değerli! 💎' },
    { content: 'Yeni nesil teknoloji ile tanışmaya hazır mısınız? Çok yakında! 🚀' },
    { content: 'Sizlerin desteği ile büyüyoruz. Topluluk olarak birlikte daha güçlüyüz! 💪' },
    { content: 'Kalite ve güvenilirlik bizim önceliğimiz. Her ürünümüzü özenle tasarlıyoruz! ✨' },
    { content: 'Yeni özellikler ve güncellemeler için bizi takip etmeye devam edin! 📱' },
  ]

  let bridgePostsCount = 0
  const allUserIdsForBridgePosts = [userIdToUse, ...TRUST_USER_IDS.slice(0, 5), ...TRUSTER_USER_IDS.slice(0, 3)]
  
  for (const brand of createdBrands.slice(0, 10)) {
    if (!brand) continue
    
    // Her brand için en az 10-15 arası BridgePost oluştur (posts[] dolu gelsin)
    const existingPosts = await prisma.bridgePost.count({
      where: { brandId: brand.id },
    })
    
    // Eğer yeterli post yoksa ekle
    const targetPostCount = 15
    const postsToCreate = Math.max(0, targetPostCount - existingPosts)
    
    if (postsToCreate > 0) {
      const selectedTemplates = bridgePostTemplates
        .sort(() => Math.random() - 0.5)
        .slice(0, postsToCreate)
      
      for (let i = 0; i < selectedTemplates.length; i++) {
        const template = selectedTemplates[i]
        const randomUser = allUserIdsForBridgePosts[Math.floor(Math.random() * allUserIdsForBridgePosts.length)]
        const daysAgoValue = Math.floor(Math.random() * 30) + 1
        
        try {
          // ULID oluştur (26 karakter)
          const ulid = generateUlid()
          
          await prisma.bridgePost.create({
            data: {
              id: ulid,
              brandId: brand.id,
              userId: randomUser,
              content: template.content,
              createdAt: daysAgo(daysAgoValue),
            }
          })
          bridgePostsCount++
        } catch (error) {
          // Duplicate veya başka bir hata - devam et
          console.warn(`BridgePost oluşturulamadı: ${error}`)
        }
      }
    }
  }

  // Generic helper to ensure badge list is populated for brand history
  const ensureBrandHistoryBadgeList = async ({
    brandId,
    brandName,
    userIds,
    badgeCount = 8,
  }: {
    brandId?: string
    brandName?: string
    userIds: string[]
    badgeCount?: number
  }): Promise<number> => {
    const brand = brandId
      ? await prisma.brand.findUnique({ where: { id: brandId } })
      : brandName
      ? await prisma.brand.findFirst({ where: { name: brandName } })
      : null

    if (!brand) {
      console.warn(`⚠️ Brand not found for history seeding: ${brandId ?? brandName}`)
      return 0
    }

    const badgePool = await prisma.badge.findMany({
      orderBy: { createdAt: 'asc' },
      take: Math.max(badgeCount, 12),
    })

    if (badgePool.length === 0) {
      console.warn('⚠️ No badges available for history seeding')
      return 0
    }

    let createdCount = 0
    for (const userId of userIds) {
      const badgesToUse = badgePool.slice(0, Math.min(badgeCount, badgePool.length))
      for (const badge of badgesToUse) {
        const created = await createBridgeRewardIfUnique({
          userId,
          brandId: brand.id,
          badgeId: badge.id,
          awardedAt: daysAgo(randomBetween(5, 120)),
        })
        if (created) createdCount++
      }
    }

    console.log(`✅ ${createdCount} badge rewards created for brand history: ${brand.name}`)
    return createdCount
  }

  // Ensure SoundWave brand history (given brandId) returns 8 badges
  await ensureBrandHistoryBadgeList({
    brandId: '5d7abaf1-4939-4a55-85c1-94ec3159ea4e',
    brandName: 'SoundWave',
    userIds: [userIdToUse],
    badgeCount: 8,
  })

  // Provide badge history seeds for a couple of other brands
  await ensureBrandHistoryBadgeList({
    brandName: 'TechNova',
    userIds: [userIdToUse, TARGET_USER_ID],
    badgeCount: 6,
  })

  await ensureBrandHistoryBadgeList({
    brandName: 'FashionForward',
    userIds: [userIdToUse],
    badgeCount: 5,
  })

  // AudioMax (Electronics) brand history için 12 badge garanti et
  await ensureBrandHistoryBadgeList({
    brandId: '081d5660-a6d6-412a-b0ae-1557acaaa028',
    brandName: 'AudioMax',
    userIds: [userIdToUse],
    badgeCount: 12,
  })
  console.log(`✅ ${bridgePostsCount} bridge post oluşturuldu`)

  // AutoParts Pro için özel bridge posts ekle
  console.log('📝 Creating bridge posts for AutoParts Pro...')
  const autopartsBrandForPosts = await prisma.brand.findFirst({
    where: { name: 'AutoParts Pro' },
  })
  
  if (autopartsBrandForPosts) {
    const autopartsPostTemplates = [
      { content: 'Yeni otomotiv yedek parça koleksiyonumuz çıktı! Motor performansını artıran premium ürünler 🚗✨' },
      { content: 'Araç bakımı için kaliteli ve uygun fiyatlı çözümler. Güvenli sürüş için doğru parçaları seçin! 🔧' },
      { content: 'Kış sezonu yaklaşıyor! Araçlarınızı kışa hazırlayın. Silecek lastikleri, antifriz ve diğer kış ekipmanları stokta! ❄️' },
      { content: 'Müşterilerimizden gelen olumlu geri bildirimler bizi çok mutlu ediyor. Kalite ve güvenilirlik önceliğimiz! 💪' },
    ]
    
    const existingAutopartsPosts = await prisma.bridgePost.count({
      where: { brandId: autopartsBrandForPosts.id },
    })
    
    // Eğer 4'ten az post varsa ekle
    const postsToCreate = Math.max(0, 4 - existingAutopartsPosts)
    
    if (postsToCreate > 0) {
      const selectedTemplates = autopartsPostTemplates.slice(0, postsToCreate)
      
      for (let i = 0; i < selectedTemplates.length; i++) {
        const template = selectedTemplates[i]
        const randomUser = allUserIdsForBridgePosts[Math.floor(Math.random() * allUserIdsForBridgePosts.length)]
        const daysAgoValue = Math.floor(Math.random() * 30) + 1
        
        try {
          const ulid = generateUlid()
          await prisma.bridgePost.create({
            data: {
              id: ulid,
              brandId: autopartsBrandForPosts.id,
              userId: randomUser,
              content: template.content,
              createdAt: daysAgo(daysAgoValue),
            }
          })
          bridgePostsCount++
        } catch (error) {
          console.warn(`AutoParts Pro BridgePost oluşturulamadı: ${error}`)
        }
      }
      console.log(`✅ AutoParts Pro için ${postsToCreate} bridge post eklendi`)
    } else {
      console.log(`✅ AutoParts Pro için zaten yeterli bridge post var (${existingAutopartsPosts} adet)`)
    }
  }

  // Add followers to brands (30-70 random followers per brand)
  console.log('👥 Adding followers to brands...')
  const allBrandsForFollowers = await prisma.brand.findMany({
    select: {
      id: true,
      name: true,
    },
  })
  const allUsersForFollowers = await prisma.user.findMany({
    select: { id: true },
  })
  
  if (allUsersForFollowers.length === 0) {
    console.warn('⚠️ No users found for brand followers')
  } else {
    let totalFollowersAdded = 0
    
    // AudioMax brand ID (known brand that needs followers)
    const AUDIO_MAX_BRAND_ID = 'e5c57b8e-b4ac-4de8-a12a-4d1724f8099b'
    
    for (const brand of allBrandsForFollowers) {
      // Mevcut follower sayısını kontrol et
      const existingFollowersCount = await prisma.bridgeFollower.count({
        where: { brandId: brand.id },
      })
      
      // Her brand için minimum 30-70 arası rastgele follower sayısı hedefle
      const targetFollowerCount = randomBetween(30, 70)
      
      // Eğer zaten yeterli follower varsa atla
      if (existingFollowersCount >= targetFollowerCount) {
        continue
      }
      
      // Eklenecek follower sayısı
      const followersToAdd = targetFollowerCount - existingFollowersCount
      
      // Rastgele kullanıcılar seç (tekrar etmemek için)
      const shuffledUsers = [...allUsersForFollowers].sort(() => Math.random() - 0.5)
      const selectedUsers = shuffledUsers.slice(0, Math.min(followersToAdd, allUsersForFollowers.length))
      
      let addedCount = 0
      for (const user of selectedUsers) {
        try {
          // Unique constraint kontrolü için önce var mı bak
          const existing = await prisma.bridgeFollower.findUnique({
            where: {
              userId_brandId: {
                userId: user.id,
                brandId: brand.id,
              },
            },
          })
          
          if (!existing) {
            await prisma.bridgeFollower.create({
              data: {
                userId: user.id,
                brandId: brand.id,
                followedAt: daysAgo(randomBetween(1, 90)), // Son 90 gün içinde rastgele takip tarihi
              },
            })
            addedCount++
          }
        } catch (error) {
          // Duplicate veya başka bir hata - devam et
        }
      }
      
      totalFollowersAdded += addedCount
      
      // AudioMax brand için özel log
      if (brand.id === AUDIO_MAX_BRAND_ID) {
        const finalCount = await prisma.bridgeFollower.count({
          where: { brandId: brand.id },
        })
        console.log(`  ✅ AudioMax (${brand.id}): ${addedCount} follower eklendi, toplam: ${finalCount}`)
      }
      
      // Her 10 brand'ta bir progress göster
      if (totalFollowersAdded % 10 === 0 && totalFollowersAdded > 0) {
        console.log(`  ✅ ${totalFollowersAdded} follower eklendi...`)
      }
    }
    
    console.log(`✅ ${totalFollowersAdded} brand follower eklendi (her brand için 30-70 arası)`)
    
    // Final check: Tüm brand'lerin en az bir follower'ı olduğundan emin ol
    const brandsWithoutFollowers = await prisma.brand.findMany({
      where: {
        followers: {
          none: {}
        }
      },
      select: {
        id: true,
        name: true,
      },
    })
    
    if (brandsWithoutFollowers.length > 0 && allUsersForFollowers.length > 0) {
      console.log(`⚠️ ${brandsWithoutFollowers.length} brand'in hiç follower'ı yok, ekleniyor...`)
      let fixedCount = 0
      for (const brand of brandsWithoutFollowers) {
        // Her brand için en az 1 follower ekle
        const randomUser = allUsersForFollowers[Math.floor(Math.random() * allUsersForFollowers.length)]
        try {
          const existing = await prisma.bridgeFollower.findUnique({
            where: {
              userId_brandId: {
                userId: randomUser.id,
                brandId: brand.id,
              },
            },
          })
          
          if (!existing) {
            await prisma.bridgeFollower.create({
              data: {
                userId: randomUser.id,
                brandId: brand.id,
                followedAt: daysAgo(randomBetween(1, 90)),
              },
            })
            fixedCount++
            
            // AudioMax brand için özel log
            if (brand.id === AUDIO_MAX_BRAND_ID) {
              console.log(`  ✅ AudioMax (${brand.id}): En az 1 follower eklendi`)
            }
          }
        } catch (error) {
          // Hata durumunda devam et
        }
      }
      console.log(`✅ ${fixedCount} brand'e en az 1 follower eklendi`)
    }
    
    // Final verification: AudioMax brand için follower sayısını kontrol et ve logla
    const audioMaxFollowersCount = await prisma.bridgeFollower.count({
      where: { brandId: AUDIO_MAX_BRAND_ID },
    })
    console.log(`📊 AudioMax brand (${AUDIO_MAX_BRAND_ID}) follower sayısı: ${audioMaxFollowersCount}`)
    
    // Eğer AudioMax'in hala yeterli follower'ı yoksa, zorla ekle
    if (audioMaxFollowersCount < 30) {
      console.log(`⚠️ AudioMax brand'in follower sayısı yetersiz (${audioMaxFollowersCount}), ek follower ekleniyor...`)
      const targetCount = randomBetween(30, 70)
      const needed = targetCount - audioMaxFollowersCount
      const shuffledUsers = [...allUsersForFollowers].sort(() => Math.random() - 0.5)
      const selectedUsers = shuffledUsers.slice(0, Math.min(needed, allUsersForFollowers.length))
      
      let audioMaxAdded = 0
      for (const user of selectedUsers) {
        try {
          const existing = await prisma.bridgeFollower.findUnique({
            where: {
              userId_brandId: {
                userId: user.id,
                brandId: AUDIO_MAX_BRAND_ID,
              },
            },
          })
          
          if (!existing) {
            await prisma.bridgeFollower.create({
              data: {
                userId: user.id,
                brandId: AUDIO_MAX_BRAND_ID,
                followedAt: daysAgo(randomBetween(1, 90)),
              },
            })
            audioMaxAdded++
          }
        } catch (error) {
          // Duplicate veya başka bir hata - devam et
        }
      }
      
      const finalAudioMaxCount = await prisma.bridgeFollower.count({
        where: { brandId: AUDIO_MAX_BRAND_ID },
      })
      console.log(`✅ AudioMax brand'e ${audioMaxAdded} ek follower eklendi, toplam: ${finalAudioMaxCount}`)
    }
  }

  // Create products for seed brands - Her brand için en az 10 adet product
  console.log('📦 Creating products for seed brands...')
  
  // Product görselleri için mapping (tests/assets/product klasöründen)
  const productImageKeys: SeedMediaKey[] = [
    'product.generic.1',
    'product.generic.2',
    'product.generic.3',
    'product.generic.4',
    'product.generic.5',
    'product.generic.6',
    'product.generic.7',
    'product.generic.8',
    'product.generic.9',
    'product.generic.10',
    'product.generic.11',
    'product.phone.phone1',
    'product.phone.phone2',
    'product.phone.phone3',
    'product.phone.phone4',
    'product.phone.phone5',
    'product.phone.phone6',
    'product.laptop.macbook',
    'product.headphone.primary',
    'product.headphone.secondary',
    'product.vacuum.dyson',
    'product.phone.samsung',
  ]

  // Her brand için product template'leri
  const brandProductTemplates: Record<string, Array<{ name: string; description: string }>> = {
    'TechVision': [
      { name: 'TechVision Pro Laptop', description: 'Yüksek performanslı iş ve oyun laptopu' },
      { name: 'TechVision SmartWatch', description: 'Akıllı saat ve sağlık takip cihazı' },
      { name: 'TechVision Wireless Earbuds', description: 'Premium ses kalitesi kulaklık' },
      { name: 'TechVision Tablet Pro', description: 'Çok amaçlı tablet cihazı' },
      { name: 'TechVision Gaming Mouse', description: 'Profesyonel oyun faresi' },
      { name: 'TechVision Mechanical Keyboard', description: 'RGB aydınlatmalı mekanik klavye' },
      { name: 'TechVision 4K Monitor', description: '27 inç 4K profesyonel monitör' },
      { name: 'TechVision Webcam Pro', description: '4K web kamerası' },
      { name: 'TechVision USB-C Hub', description: 'Çok portlu USB-C hub' },
      { name: 'TechVision Power Bank', description: '20000mAh hızlı şarj power bank' },
    ],
    'SmartHome Pro': [
      { name: 'SmartHome Hub', description: 'Merkezi akıllı ev kontrol sistemi' },
      { name: 'SmartHome Security Camera', description: '4K güvenlik kamerası' },
      { name: 'SmartHome Thermostat', description: 'Akıllı termostat ve iklim kontrolü' },
      { name: 'SmartHome Door Lock', description: 'Akıllı kilit sistemi' },
      { name: 'SmartHome Light Bulb', description: 'RGB akıllı ampul seti' },
      { name: 'SmartHome Motion Sensor', description: 'Hareket algılama sensörü' },
      { name: 'SmartHome Doorbell', description: 'Video kapı zili' },
      { name: 'SmartHome Smoke Detector', description: 'Akıllı duman dedektörü' },
      { name: 'SmartHome Water Leak Sensor', description: 'Su kaçağı algılama sensörü' },
      { name: 'SmartHome Window Sensor', description: 'Pencere açılma/kapanma sensörü' },
    ],
    'CoffeeDelight': [
      { name: 'CoffeeDelight Espresso Machine', description: 'Profesyonel espresso makinesi' },
      { name: 'CoffeeDelight Grinder', description: 'Kahve öğütücü makine' },
      { name: 'CoffeeDelight French Press', description: 'Fransız pres kahve makinesi' },
      { name: 'CoffeeDelight Cold Brew', description: 'Soğuk demleme seti' },
      { name: 'CoffeeDelight Milk Frother', description: 'Süt köpürtücü' },
      { name: 'CoffeeDelight Pour Over Set', description: 'Pour over kahve seti' },
      { name: 'CoffeeDelight AeroPress', description: 'AeroPress kahve makinesi' },
      { name: 'CoffeeDelight Coffee Scale', description: 'Dijital kahve tartısı' },
      { name: 'CoffeeDelight Tamper', description: 'Profesyonel espresso tamper' },
      { name: 'CoffeeDelight Coffee Beans', description: 'Premium kahve çekirdekleri' },
    ],
    'FitnessTech': [
      { name: 'FitnessTech Smart Scale', description: 'Akıllı tartı ve vücut analizi' },
      { name: 'FitnessTech Resistance Bands', description: 'Direnç bantları seti' },
      { name: 'FitnessTech Yoga Mat', description: 'Premium yoga matı' },
      { name: 'FitnessTech Dumbbells', description: 'Ayarlanabilir dambıl seti' },
      { name: 'FitnessTech Heart Rate Monitor', description: 'Kalp atış hızı monitörü' },
      { name: 'FitnessTech Jump Rope', description: 'Akıllı atlama ipi' },
      { name: 'FitnessTech Foam Roller', description: 'Masaj köpük silindiri' },
      { name: 'FitnessTech Kettlebell', description: 'Ayarlanabilir kettlebell' },
      { name: 'FitnessTech Pull Up Bar', description: 'Kapıya monte çekme barı' },
      { name: 'FitnessTech Ab Wheel', description: 'Karın kası egzersiz tekerleği' },
    ],
    'StyleHub': [
      { name: 'StyleHub Classic T-Shirt', description: 'Premium pamuklu klasik tişört' },
      { name: 'StyleHub Denim Jacket', description: 'Klasik denim ceket' },
      { name: 'StyleHub Sneakers', description: 'Rahat günlük spor ayakkabı' },
      { name: 'StyleHub Leather Bag', description: 'Deri çanta' },
      { name: 'StyleHub Sunglasses', description: 'UV korumalı güneş gözlüğü' },
      { name: 'StyleHub Watch', description: 'Klasik saat' },
      { name: 'StyleHub Belt', description: 'Deri kemer' },
      { name: 'StyleHub Wallet', description: 'Deri cüzdan' },
      { name: 'StyleHub Scarf', description: 'Yün atkı' },
      { name: 'StyleHub Hat', description: 'Şapka' },
    ],
    'AudioMax': [
      { name: 'AudioMax Studio Headphones', description: 'Profesyonel stüdyo kulaklığı' },
      { name: 'AudioMax Wireless Speaker', description: 'Bluetooth kablosuz hoparlör' },
      { name: 'AudioMax Soundbar', description: 'TV için ses çubuğu' },
      { name: 'AudioMax Earbuds Pro', description: 'Aktif gürültü önleme kulaklık' },
      { name: 'AudioMax Microphone', description: 'USB mikrofon' },
      { name: 'AudioMax DAC', description: 'Dijital-analog dönüştürücü' },
      { name: 'AudioMax Amplifier', description: 'Güç amplifikatörü' },
      { name: 'AudioMax Turntable', description: 'Plak çalar' },
      { name: 'AudioMax CD Player', description: 'CD çalar' },
      { name: 'AudioMax Audio Cable', description: 'Premium ses kablosu' },
    ],
    'EcoLife': [
      { name: 'EcoLife Reusable Water Bottle', description: 'Paslanmaz çelik su şişesi' },
      { name: 'EcoLife Bamboo Toothbrush', description: 'Bambu diş fırçası' },
      { name: 'EcoLife Reusable Shopping Bag', description: 'Yeniden kullanılabilir alışveriş çantası' },
      { name: 'EcoLife Solar Charger', description: 'Güneş enerjili şarj cihazı' },
      { name: 'EcoLife Compost Bin', description: 'Kompost kutusu' },
      { name: 'EcoLife LED Bulbs', description: 'Enerji tasarruflu LED ampul seti' },
      { name: 'EcoLife Reusable Straws', description: 'Paslanmaz çelik pipet seti' },
      { name: 'EcoLife Beeswax Wraps', description: 'Balmumu sargı bezi' },
      { name: 'EcoLife Laundry Detergent', description: 'Doğal çamaşır deterjanı' },
      { name: 'EcoLife Plant Pot', description: 'Bambu bitki saksısı' },
    ],
    'GameZone': [
      { name: 'GameZone Pro Controller', description: 'Profesyonel oyun kumandası' },
      { name: 'GameZone Gaming Chair', description: 'Ergonomik oyun koltuğu' },
      { name: 'GameZone RGB Keyboard', description: 'RGB aydınlatmalı oyun klavyesi' },
      { name: 'GameZone Gaming Mouse', description: 'Yüksek DPI oyun faresi' },
      { name: 'GameZone Headset', description: '7.1 surround ses kulaklık' },
      { name: 'GameZone Mouse Pad', description: 'Büyük oyun mouse pad\'i' },
      { name: 'GameZone Monitor Stand', description: 'Monitör standı' },
      { name: 'GameZone Cable Management', description: 'Kablo yönetim seti' },
      { name: 'GameZone LED Strip', description: 'RGB LED şerit' },
      { name: 'GameZone Webcam', description: '1080p oyun web kamerası' },
    ],
    'BeautyCare': [
      { name: 'BeautyCare Face Serum', description: 'Cilt bakım serumu' },
      { name: 'BeautyCare Moisturizer', description: 'Nemlendirici krem' },
      { name: 'BeautyCare Cleanser', description: 'Yüz temizleme jeli' },
      { name: 'BeautyCare Sunscreen', description: 'SPF 50 güneş kremi' },
      { name: 'BeautyCare Face Mask', description: 'Yüz maskesi seti' },
      { name: 'BeautyCare Eye Cream', description: 'Göz çevresi kremi' },
      { name: 'BeautyCare Toner', description: 'Cilt toneri' },
      { name: 'BeautyCare Exfoliator', description: 'Peeling ürünü' },
      { name: 'BeautyCare Lip Balm', description: 'Dudak nemlendirici' },
      { name: 'BeautyCare Makeup Remover', description: 'Makyaj temizleme ürünü' },
    ],
    'OutdoorGear': [
      { name: 'OutdoorGear Backpack', description: 'Dayanıklı sırt çantası' },
      { name: 'OutdoorGear Tent', description: '2 kişilik kamp çadırı' },
      { name: 'OutdoorGear Sleeping Bag', description: 'Isı yalıtımlı uyku tulumu' },
      { name: 'OutdoorGear Hiking Boots', description: 'Yürüyüş botu' },
      { name: 'OutdoorGear Water Filter', description: 'Su filtreleme cihazı' },
      { name: 'OutdoorGear Headlamp', description: 'LED kafa lambası' },
      { name: 'OutdoorGear Multi-Tool', description: 'Çok amaçlı alet' },
      { name: 'OutdoorGear Compass', description: 'Pusula' },
      { name: 'OutdoorGear Fire Starter', description: 'Ateş başlatıcı' },
      { name: 'OutdoorGear First Aid Kit', description: 'İlk yardım çantası' },
    ],
    'PetCare Plus': [
      { name: 'PetCare Plus Dog Food', description: 'Premium köpek maması' },
      { name: 'PetCare Plus Cat Litter', description: 'Kedi kumu' },
      { name: 'PetCare Plus Leash', description: 'Köpek tasması' },
      { name: 'PetCare Plus Pet Bed', description: 'Evcil hayvan yatağı' },
      { name: 'PetCare Plus Food Bowl', description: 'Yemek kabı seti' },
      { name: 'PetCare Plus Toy Set', description: 'Oyuncak seti' },
      { name: 'PetCare Plus Grooming Brush', description: 'Tımar fırçası' },
      { name: 'PetCare Plus Carrier', description: 'Taşıma çantası' },
      { name: 'PetCare Plus Treats', description: 'Ödül maması' },
      { name: 'PetCare Plus Water Fountain', description: 'Su çeşmesi' },
    ],
    'KitchenMaster': [
      { name: 'KitchenMaster Chef Knife', description: 'Profesyonel şef bıçağı' },
      { name: 'KitchenMaster Cutting Board', description: 'Kesme tahtası' },
      { name: 'KitchenMaster Mixer', description: 'Stand mikser' },
      { name: 'KitchenMaster Blender', description: 'Yüksek hızlı blender' },
      { name: 'KitchenMaster Food Processor', description: 'Mutfak robotu' },
      { name: 'KitchenMaster Pressure Cooker', description: 'Düdüklü tencere' },
      { name: 'KitchenMaster Cast Iron Pan', description: 'Döküm tava' },
      { name: 'KitchenMaster Measuring Cups', description: 'Ölçü kabı seti' },
      { name: 'KitchenMaster Spice Rack', description: 'Baharat rafı' },
      { name: 'KitchenMaster Kitchen Scale', description: 'Mutfak tartısı' },
    ],
    'TravelEssentials': [
      { name: 'TravelEssentials Suitcase', description: 'Tekerlekli bavul' },
      { name: 'TravelEssentials Packing Cubes', description: 'Paketleme küpleri' },
      { name: 'TravelEssentials Travel Pillow', description: 'Seyahat yastığı' },
      { name: 'TravelEssentials Eye Mask', description: 'Göz maskesi' },
      { name: 'TravelEssentials Adapter', description: 'Evrensel adaptör' },
      { name: 'TravelEssentials Luggage Tag', description: 'Bavul etiketi' },
      { name: 'TravelEssentials Toiletry Bag', description: 'Tuvalet çantası' },
      { name: 'TravelEssentials Passport Holder', description: 'Pasaport kılıfı' },
      { name: 'TravelEssentials Money Belt', description: 'Para kemeri' },
      { name: 'TravelEssentials Travel Lock', description: 'Seyahat kilidi' },
    ],
    'BabyCare': [
      { name: 'BabyCare Diapers', description: 'Bebek bezi' },
      { name: 'BabyCare Baby Bottle', description: 'Biberon seti' },
      { name: 'BabyCare Stroller', description: 'Bebek arabası' },
      { name: 'BabyCare Car Seat', description: 'Araba koltuğu' },
      { name: 'BabyCare High Chair', description: 'Yüksek sandalye' },
      { name: 'BabyCare Baby Monitor', description: 'Bebek monitörü' },
      { name: 'BabyCare Play Mat', description: 'Oyun matı' },
      { name: 'BabyCare Teething Toy', description: 'Diş kaşıyıcı oyuncak' },
      { name: 'BabyCare Baby Carrier', description: 'Bebek taşıyıcı' },
      { name: 'BabyCare Baby Bath', description: 'Bebek banyo küveti' },
    ],
    'AutoParts Pro': [
      { name: 'AutoParts Pro Engine Oil', description: 'Yüksek kaliteli motor yağı - motor performansını artırıyor, uzun ömürlü kullanım sağlıyor' },
      { name: 'AutoParts Pro Air Filter', description: 'Hava filtresi - motor hava kalitesini iyileştiriyor, filtreleme performansı mükemmel' },
      { name: 'AutoParts Pro Brake Pads', description: 'Fren balata seti - fren performansı çok iyi, güvenli sürüş sağlıyor' },
      { name: 'AutoParts Pro Car Battery', description: 'Araba aküsü - güvenilir ve uzun ömürlü, araç için mükemmel bir akü' },
      { name: 'AutoParts Pro Spark Plugs', description: 'Buji seti - motorun daha verimli çalışmasını sağlıyor, yakıt tasarrufu sağlıyor' },
      { name: 'AutoParts Pro Wiper Blades', description: 'Silecek lastiği - yağmur ve kar koşullarında mükemmel görüş sağlıyor' },
      { name: 'AutoParts Pro Tire Pressure Gauge', description: 'Lastik basınç ölçer - doğru lastik basıncı ile güvenli sürüş' },
      { name: 'AutoParts Pro Jump Starter', description: 'Araba çalıştırıcı - acil durumlarda araç için hayat kurtarıcı' },
      { name: 'AutoParts Pro Car Cover', description: 'Araba örtüsü - aracınızı güneş, yağmur ve tozdan korur' },
      { name: 'AutoParts Pro Floor Mats', description: 'Araba paspası - araç içini temiz tutar, dayanıklı ve kolay temizlenir' },
    ],
    'TechNova': [
      { name: 'TechNova Smartphone Pro', description: 'Yeni nesil akıllı telefon' },
      { name: 'TechNova Tablet Ultra', description: 'Ultra ince tablet' },
      { name: 'TechNova Smart TV', description: '4K akıllı TV' },
      { name: 'TechNova Smart Speaker', description: 'Sesli asistan hoparlör' },
      { name: 'TechNova Smart Display', description: 'Akıllı ekran' },
      { name: 'TechNova Smart Doorbell', description: 'Video kapı zili' },
      { name: 'TechNova Smart Lock', description: 'Akıllı kilit' },
      { name: 'TechNova Smart Thermostat', description: 'Akıllı termostat' },
      { name: 'TechNova Smart Light Switch', description: 'Akıllı ışık anahtarı' },
      { name: 'TechNova Smart Plug', description: 'Akıllı priz' },
    ],
    'SoundWave': [
      { name: 'SoundWave Studio Monitor', description: 'Stüdyo monitör hoparlör' },
      { name: 'SoundWave DJ Controller', description: 'DJ kontrol cihazı' },
      { name: 'SoundWave Audio Interface', description: 'Ses arayüzü' },
      { name: 'SoundWave MIDI Keyboard', description: 'MIDI klavye' },
      { name: 'SoundWave Drum Machine', description: 'Drum makinesi' },
      { name: 'SoundWave Synthesizer', description: 'Synthesizer' },
      { name: 'SoundWave Mixer', description: 'Mikser' },
      { name: 'SoundWave Microphone Stand', description: 'Mikrofon standı' },
      { name: 'SoundWave Pop Filter', description: 'Pop filtresi' },
      { name: 'SoundWave Audio Cable', description: 'Ses kablosu seti' },
    ],
    'FashionForward': [
      { name: 'FashionForward Denim Jeans', description: 'Klasik denim pantolon' },
      { name: 'FashionForward Blazer', description: 'Blazer ceket' },
      { name: 'FashionForward Dress', description: 'Elbise' },
      { name: 'FashionForward Heels', description: 'Topuklu ayakkabı' },
      { name: 'FashionForward Handbag', description: 'El çantası' },
      { name: 'FashionForward Jewelry Set', description: 'Takı seti' },
      { name: 'FashionForward Scarf', description: 'İpek eşarp' },
      { name: 'FashionForward Gloves', description: 'Eldiven' },
      { name: 'FashionForward Belt', description: 'Kemer' },
      { name: 'FashionForward Sunglasses', description: 'Güneş gözlüğü' },
    ],
    'PlayStation Pro': [
      { name: 'PlayStation Pro Console', description: 'Gaming konsolu' },
      { name: 'PlayStation Pro Controller', description: 'Oyun kumandası' },
      { name: 'PlayStation Pro VR Headset', description: 'VR başlığı' },
      { name: 'PlayStation Pro Camera', description: 'Oyun kamerası' },
      { name: 'PlayStation Pro Headset', description: 'Oyun kulaklığı' },
      { name: 'PlayStation Pro Charging Station', description: 'Şarj istasyonu' },
      { name: 'PlayStation Pro Game Storage', description: 'Oyun depolama' },
      { name: 'PlayStation Pro Media Remote', description: 'Medya kumandası' },
      { name: 'PlayStation Pro Racing Wheel', description: 'Yarış direksiyonu' },
      { name: 'PlayStation Pro Fight Stick', description: 'Dövüş çubuğu' },
    ],
    'GlowBeauty': [
      { name: 'GlowBeauty Face Cleanser', description: 'Yüz temizleyici' },
      { name: 'GlowBeauty Toner', description: 'Cilt toneri' },
      { name: 'GlowBeauty Serum', description: 'Cilt serumu' },
      { name: 'GlowBeauty Moisturizer', description: 'Nemlendirici' },
      { name: 'GlowBeauty Sunscreen', description: 'Güneş kremi' },
      { name: 'GlowBeauty Face Mask', description: 'Yüz maskesi' },
      { name: 'GlowBeauty Eye Cream', description: 'Göz kremi' },
      { name: 'GlowBeauty Lip Balm', description: 'Dudak nemlendirici' },
      { name: 'GlowBeauty Makeup Remover', description: 'Makyaj temizleyici' },
      { name: 'GlowBeauty Exfoliator', description: 'Peeling' },
    ],
    'HomeStyle': [
      { name: 'HomeStyle Sofa', description: 'Kanepe' },
      { name: 'HomeStyle Coffee Table', description: 'Kahve masası' },
      { name: 'HomeStyle Dining Table', description: 'Yemek masası' },
      { name: 'HomeStyle Bed Frame', description: 'Yatak çerçevesi' },
      { name: 'HomeStyle Wardrobe', description: 'Gardırop' },
      { name: 'HomeStyle Bookshelf', description: 'Kitaplık' },
      { name: 'HomeStyle Lamp', description: 'Lamba' },
      { name: 'HomeStyle Curtains', description: 'Perde seti' },
      { name: 'HomeStyle Rug', description: 'Halı' },
      { name: 'HomeStyle Pillows', description: 'Yastık seti' },
    ],
  }

  let seedBrandProductsCount = 0
  // Filter out null values explicitly
  const validBrands = createdBrands.filter(b => b !== null && b !== undefined)
  console.log(`📦 Processing ${validBrands.length} brands for product creation...`)
  
  // Brand'lar için ProductGroup'lar oluştur
  console.log('📦 Creating product groups for brands...')
  const brandProductGroupsMap = new Map<string, string>() // brandId -> productGroupId
  
  for (const brand of validBrands) {
    if (!brand || !brand.categoryId) continue
    if (brand.id === TARGET_AUDIO_BRAND_ID) {
      console.log('ℹ️ AudioMax için varsayılan product group oluşturma atlandı (özel set aşağıda).')
      continue
    }
    
    try {
      // Brand'ın category'sini bul (BrandCategory)
      const brandCategory = brand.categoryId 
        ? await prisma.brandCategory.findUnique({
            where: { id: brand.categoryId }
          })
        : null
      
      if (!brandCategory) {
        console.warn(`⚠️ BrandCategory bulunamadı brand: ${brand.name} (categoryId: ${brand.categoryId})`)
        // Category yoksa, genel bir SubCategory kullan (Teknoloji kategorisinden)
      const techCategory = mainCategories.find(c => c.id === TECH_MAIN_CATEGORY_ID)
        if (techCategory) {
          const techSubCategory = await prisma.subCategory.findFirst({
            where: { mainCategoryId: techCategory.id }
          })
          if (techSubCategory) {
            let productGroup = await prisma.productGroup.findFirst({
              where: {
                name: `${brand.name} Ürün Grubu`,
                subCategoryId: techSubCategory.id
              }
            })
            
            if (!productGroup) {
              productGroup = await prisma.productGroup.create({
                data: {
                  name: `${brand.name} Ürün Grubu`,
                  description: `${brand.name} marka ürünleri`,
                  subCategoryId: techSubCategory.id,
                  imageUrl: brand.imageUrl,
                }
              })
            }
            
            brandProductGroupsMap.set(brand.id, productGroup.id)
            continue
          }
        }
        continue
      }
      
      // BrandCategory'ye göre bir MainCategory bul (BrandCategory ile Category arasında direkt ilişki yok)
      // Bu durumda, genel bir SubCategory kullan (Teknoloji kategorisinden)
      const techCategory = mainCategories.find(c => c.id === TECH_MAIN_CATEGORY_ID)
      let subCategory: Awaited<ReturnType<typeof prisma.subCategory.findFirst>> | null = null
      
      if (techCategory) {
        subCategory = await prisma.subCategory.findFirst({
          where: { mainCategoryId: techCategory.id }
        })
        
        if (!subCategory) {
          // SubCategory yoksa oluştur
          subCategory = await prisma.subCategory.create({
            data: {
              name: `${brandCategory.name} Ürünleri`,
              description: `${brandCategory.name} kategorisi ürünleri`,
              mainCategoryId: techCategory.id,
              imageUrl: brandCategory.imageUrl,
            }
          })
        }
      }
      
      if (!subCategory) {
        console.warn(`⚠️ SubCategory oluşturulamadı brand: ${brand.name}`)
        continue
      }
      
      // Brand için ProductGroup bul veya oluştur
      let productGroup = await prisma.productGroup.findFirst({
        where: {
          name: `${brand.name} Ürün Grubu`,
          subCategoryId: subCategory.id
        }
      })
      
      if (!productGroup) {
        productGroup = await prisma.productGroup.create({
          data: {
            name: `${brand.name} Ürün Grubu`,
            description: `${brand.name} marka ürünleri`,
            subCategoryId: subCategory.id,
            imageUrl: brand.imageUrl,
          }
        })
      }
      
      brandProductGroupsMap.set(brand.id, productGroup.id)
    } catch (error) {
      console.warn(`⚠️ ProductGroup oluşturulamadı brand: ${brand.name} - ${error}`)
    }
  }
  console.log(`✅ ${brandProductGroupsMap.size} product group oluşturuldu brand'lar için`)
  
  // Product'ları oluştur ve ProductGroup'lara bağla
  for (const brand of validBrands) {
    if (!brand) continue
    if (brand.id === TARGET_AUDIO_BRAND_ID) {
      console.log('ℹ️ AudioMax için varsayılan product oluşturma atlandı (özel set aşağıda).')
      continue
    }
    
    const templates = brandProductTemplates[brand.name] || []
    // Eğer brand için template yoksa, genel product'lar oluştur
    const productsToCreate = templates.length > 0 
      ? templates 
      : Array.from({ length: 10 }, (_, i) => ({
          name: `${brand.name} Product ${i + 1}`,
          description: `${brand.name} ürün açıklaması ${i + 1}`
        }))

    const productGroupId = brandProductGroupsMap.get(brand.id) || null

    for (let i = 0; i < productsToCreate.length; i++) {
      const productData = productsToCreate[i]
      const imageKey = productImageKeys[i % productImageKeys.length]
      
      try {
        await prisma.product.create({
          data: {
            name: productData.name,
            brand: brand.name, // Product.brand field'ına brand name'i yaz
            description: productData.description,
            imageUrl: getSeedMediaPath(imageKey, true) || null,
            groupId: productGroupId, // ProductGroup'a bağla
          }
        })
        seedBrandProductsCount++
      } catch (error) {
        console.warn(`Product oluşturulamadı (${brand.name} - ${productData.name}): ${error}`)
      }
    }
  }
  console.log(`✅ ${seedBrandProductsCount} product oluşturuldu tüm brand'lar için`)

  // AudioMax brand'i için özel grup ve ürün seti (10 grup, her biri 5 ürün)
  console.log('🎯 AudioMax için özel product group ve ürün seti oluşturuluyor...')
  const audioMaxBrandV2 = await prisma.brand.findUnique({ where: { id: TARGET_AUDIO_BRAND_ID } })

  if (!audioMaxBrandV2) {
    console.warn(`⚠️ AudioMax brand bulunamadı (ID: ${TARGET_AUDIO_BRAND_ID}), özel grup atlandı`)
  } else {
    const audioMaxGroupDefinitions: Array<{
      name: string
      mainCategoryName: string
      subCategoryName: string
      imageKey: SeedMediaKey
      products: Array<{ name: string; description: string; imageKey: SeedMediaKey }>
    }> = [
      {
        name: 'Klima & İklimlendirme',
        mainCategoryName: 'Ev & Yaşam',
        subCategoryName: 'Klima & İklimlendirme',
        imageKey: 'catalog.air-conditioner',
        products: [
          { name: 'BreezeCool 9K', description: 'Sessiz inverter klima', imageKey: 'product.vacuum.dyson' },
          { name: 'BreezeCool 12K', description: 'Geniş alan için inverter', imageKey: 'product.phone.samsung' },
          { name: 'WindFree Pro', description: 'Akıllı hava yönlendirme', imageKey: 'product.laptop.macbook' },
          { name: 'Arctic Sense', description: 'Hızlı soğutan model', imageKey: 'product.headphone.primary' },
          { name: 'PureAir Duo', description: 'Filtreli iklimlendirme', imageKey: 'product.headphone.secondary' },
        ],
      },
      {
        name: 'Kamera & Lens',
        mainCategoryName: 'Technology',
        subCategoryName: 'Kamera & Lens',
        imageKey: 'catalog.cameras',
        products: [
          { name: 'ShotPro Mirrorless', description: '4K aynasız kamera', imageKey: 'product.phone.phone1' },
          { name: 'LensKit 50mm Prime', description: 'Portre için hızlı lens', imageKey: 'product.phone.phone2' },
          { name: 'VlogCam Compact', description: 'Hafif vlog kamerası', imageKey: 'product.phone.phone3' },
          { name: 'ProZoom Bridge', description: 'Uzun menzil zoom', imageKey: 'product.phone.phone4' },
          { name: 'ActionCam Mini', description: 'Dayanıklı aksiyon kamera', imageKey: 'product.phone.phone5' },
        ],
      },
      {
        name: 'Bilgisayar & Tablet',
        mainCategoryName: 'Technology',
        subCategoryName: 'Bilgisayar & Tablet',
        imageKey: 'catalog.computers-tablets',
        products: [
          { name: 'UltraBook Air', description: 'İnce ve hafif dizüstü', imageKey: 'product.laptop.macbook' },
          { name: 'Creator Station', description: 'Yaratıcılar için performans', imageKey: 'product.laptop.macbook' },
          { name: 'Tablet Flex', description: 'Kalem destekli tablet', imageKey: 'product.phone.phone6' },
          { name: 'CodePad Mini', description: 'Kompakt üretkenlik tableti', imageKey: 'product.phone.samsung' },
          { name: 'Studio Dock', description: 'Dock destekli çalışma seti', imageKey: 'product.headphone.primary' },
        ],
      },
      {
        name: 'Drone & Aksiyon',
        mainCategoryName: 'Technology',
        subCategoryName: 'Drone & Aksiyon',
        imageKey: 'catalog.drone',
        products: [
          { name: 'SkyScout Mini', description: 'Kompakt drone', imageKey: 'product.phone.phone1' },
          { name: 'AirRide 4K', description: '4K çekim için stabilizasyon', imageKey: 'product.phone.phone2' },
          { name: 'HoverCam Pro', description: 'Gelişmiş takip modu', imageKey: 'product.phone.phone3' },
          { name: 'TrackFly GPS', description: 'GPS destekli uçuş', imageKey: 'product.phone.phone4' },
          { name: 'CineWing Dual', description: 'Çift kamera desteği', imageKey: 'product.phone.phone5' },
        ],
      },
      {
        name: 'Oyun & Konsol',
        mainCategoryName: 'Hobi & Eğlence',
        subCategoryName: 'Oyun & Konsol',
        imageKey: 'catalog.games',
        products: [
          { name: 'PlayWave Konsol', description: 'Yeni nesil oyun konsolu', imageKey: 'product.headphone.secondary' },
          { name: 'GamePad Elite', description: 'Hassas tetik ve titreşim', imageKey: 'product.headphone.primary' },
          { name: 'VR Next', description: 'Sanal gerçeklik seti', imageKey: 'product.headphone.secondary' },
          { name: 'Arena Dock', description: 'Çok oyunculu istasyon', imageKey: 'product.laptop.macbook' },
          { name: 'Cloud Controller', description: 'Bulut oyun kolu', imageKey: 'product.phone.samsung' },
        ],
      },
      {
        name: 'Beyaz Eşya',
        mainCategoryName: 'Home & Living',
        subCategoryName: 'Beyaz Eşya',
        imageKey: 'catalog.home-appliances',
        products: [
          { name: 'PureWash X', description: 'Hijyen modlu çamaşır makinesi', imageKey: 'product.vacuum.dyson' },
          { name: 'DryCare Heat Pump', description: 'Isı pompalı kurutma', imageKey: 'product.vacuum.dyson' },
          { name: 'FreshCool XL', description: 'Geniş hacimli buzdolabı', imageKey: 'product.laptop.macbook' },
          { name: 'SteamWard Care', description: 'Buharlı bakım programı', imageKey: 'product.headphone.primary' },
          { name: 'EcoDish Pro', description: 'Az tüketimli bulaşık makinesi', imageKey: 'product.headphone.secondary' },
        ],
      },
      {
        name: 'Küçük Ev Aletleri',
        mainCategoryName: 'Home & Living',
        subCategoryName: 'Küçük Ev Aletleri',
        imageKey: 'catalog.kucukev',
        products: [
          { name: 'ChefMix Pro', description: 'Çok amaçlı mutfak robotu', imageKey: 'product.vacuum.dyson' },
          { name: 'BrewMaster Duo', description: 'Filtre + Türk kahvesi makinesi', imageKey: 'product.laptop.macbook' },
          { name: 'SlicePrep Compact', description: 'Dilimleme ve rende seti', imageKey: 'product.headphone.primary' },
          { name: 'QuickBlend Go', description: 'Taşınabilir blender', imageKey: 'product.headphone.secondary' },
          { name: 'SmartKettle One', description: 'Isı kontrollü kettle', imageKey: 'product.phone.samsung' },
        ],
      },
      {
        name: 'Telefon & Aksesuar',
        mainCategoryName: 'Technology',
        subCategoryName: 'Telefon & Aksesuar',
        imageKey: 'catalog.phones',
        products: [
          { name: 'Pulse Phone X', description: 'AMOLED ekranlı akıllı telefon', imageKey: 'product.phone.phone1' },
          { name: 'Pulse Phone S', description: 'Uzun pil ömürlü model', imageKey: 'product.phone.phone2' },
          { name: 'Pulse Phone Mini', description: 'Kompakt tasarım', imageKey: 'product.phone.phone3' },
          { name: 'Pulse Phone Max', description: 'Geniş ekranlı seri', imageKey: 'product.phone.phone4' },
          { name: 'Pulse Earbuds', description: 'ANC destekli kulaklık', imageKey: 'product.headphone.primary' },
        ],
      },
      {
        name: 'TV & Görüntü',
        mainCategoryName: 'Technology',
        subCategoryName: 'TV & Görüntü',
        imageKey: 'catalog.tv',
        products: [
          { name: 'VisionMax 55', description: '55 inç 4K QLED', imageKey: 'product.laptop.macbook' },
          { name: 'VisionMax 65', description: '65 inç geniş ekran', imageKey: 'product.phone.samsung' },
          { name: 'VisionMax 75', description: '75 inç sinema deneyimi', imageKey: 'product.headphone.primary' },
          { name: 'BeamBar Atmos', description: 'Dolby Atmos soundbar', imageKey: 'product.headphone.secondary' },
          { name: 'StreamBox Pro', description: 'Akış medya oynatıcı', imageKey: 'product.phone.phone1' },
        ],
      },
      {
        name: 'Akıllı Ev & Güvenlik',
        mainCategoryName: 'Technology',
        subCategoryName: 'Akıllı Ev & Güvenlik',
        imageKey: 'catalog.smart-home-devices',
        products: [
          { name: 'SmartHub Core', description: 'Merkezi otomasyon beyni', imageKey: 'product.phone.phone1' },
          { name: 'SmartCam 360', description: '360° güvenlik kamerası', imageKey: 'product.phone.phone2' },
          { name: 'DoorGuard Secure', description: 'Akıllı kapı kilidi', imageKey: 'product.phone.phone3' },
          { name: 'AirSense Mini', description: 'Hava kalitesi sensörü', imageKey: 'product.phone.phone4' },
          { name: 'PowerPlug Energy', description: 'Enerji ölçer priz', imageKey: 'product.phone.phone5' },
        ],
      },
    ]

    const findMainCategory = (name: string) =>
      mainCategories.find(c => c.name === name) || mainCategories[0]

    let createdAudioGroups = 0
    let createdAudioProducts = 0

    for (const groupDef of audioMaxGroupDefinitions) {
      const mainCategory = findMainCategory(groupDef.mainCategoryName)
      if (!mainCategory) {
        console.warn(`⚠️ Ana kategori bulunamadı: ${groupDef.mainCategoryName}, grup atlandı`)
        continue
      }

      const subCategory =
        (await prisma.subCategory.findFirst({
          where: { name: groupDef.subCategoryName, mainCategoryId: mainCategory.id },
        })) ||
        (await prisma.subCategory.create({
          data: {
            name: groupDef.subCategoryName,
            description: `${audioMaxBrandV2.name} ${groupDef.name} ürünleri`,
            imageUrl: getSeedMediaPath(groupDef.imageKey, true) || null,
            mainCategoryId: mainCategory.id,
          },
        }))

      const groupName = `${audioMaxBrandV2.name} - ${groupDef.name}`
      let productGroup = await prisma.productGroup.findFirst({
        where: { name: groupName, subCategoryId: subCategory.id },
      })

      if (!productGroup) {
        productGroup = await prisma.productGroup.create({
          data: {
            name: groupName,
            description: `${audioMaxBrandV2.name} markasının ${groupDef.name} ürünleri`,
            subCategoryId: subCategory.id,
            imageUrl: getSeedMediaPath(groupDef.imageKey, true) || null,
          },
        })
        createdAudioGroups++
      }

      for (const productDef of groupDef.products) {
        const existingProduct = await prisma.product.findFirst({
          where: {
            name: productDef.name,
            brand: audioMaxBrandV2.name,
            groupId: productGroup.id,
          },
        })

        if (existingProduct) {
          // Mevcut product'ın imageUrl'ini güncelle
          const imageUrl = getSeedMediaPath(productDef.imageKey, true);
          if (imageUrl && existingProduct.imageUrl !== imageUrl) {
            await prisma.product.update({
              where: { id: existingProduct.id },
              data: { imageUrl },
            });
          }
          continue;
        }

        await prisma.product.create({
          data: {
            name: productDef.name,
            brand: audioMaxBrandV2.name,
            description: productDef.description,
            imageUrl: getSeedMediaPath(productDef.imageKey, true) || null,
            groupId: productGroup.id,
          },
        })
        createdAudioProducts++
      }
    }

    console.log(
      `✅ AudioMax için ${audioMaxGroupDefinitions.length} grup kontrol edildi -> ${createdAudioGroups} yeni grup, ${createdAudioProducts} yeni ürün eklendi`,
    )

    // Ekstra 4 grup (her biri 5 ürün) - sabit subCategory ID ile
    const EXTRA_SUBCATEGORY_ID = '59a02135-07d7-404a-988e-386c0917017d'
    let extraSubCategory = await prisma.subCategory.findUnique({ where: { id: EXTRA_SUBCATEGORY_ID } })
    if (!extraSubCategory) {
      extraSubCategory = await prisma.subCategory.create({
        data: {
          id: EXTRA_SUBCATEGORY_ID,
          name: 'AudioMax Ekstra',
          description: 'AudioMax ek ürün grupları',
          mainCategoryId: TECH_MAIN_CATEGORY_ID,
          imageUrl: getSeedMediaPath('catalog.headphones', true) || null,
        },
      })
    }
    const extraGroups = [
      {
        name: 'Aksesuar Setleri',
        imageKey: 'catalog.phones',
        products: [
          { name: 'AudioMax Case Pro', description: 'Koruyucu kılıf', imageKey: 'product.phone.phone3' },
          { name: 'AudioMax Power Dock', description: 'Şarj standı', imageKey: 'product.phone.phone4' },
          { name: 'AudioMax USB-C Cable', description: 'Hızlı şarj kablosu', imageKey: 'product.phone.phone5' },
          { name: 'AudioMax Wall Charger', description: 'GaN adaptör', imageKey: 'product.phone.phone6' },
          { name: 'AudioMax Desk Mat', description: 'Kaymaz masa matı', imageKey: 'product.laptop.macbook' },
        ],
      },
      {
        name: 'Stüdyo Çevre Birimleri',
        imageKey: 'catalog.computers-tablets',
        products: [
          { name: 'AudioMax Monitor Stand', description: 'Ergonomik stand', imageKey: 'product.laptop.macbook' },
          { name: 'AudioMax Desk Lamp', description: 'Ayarlanabilir ışık', imageKey: 'product.headphone.primary' },
          { name: 'AudioMax USB Hub', description: '7 port USB hub', imageKey: 'product.headphone.secondary' },
          { name: 'AudioMax SD Reader', description: 'Çift yuvalı kart okuyucu', imageKey: 'product.phone.samsung' },
          { name: 'AudioMax Mic Arm', description: 'Stüdyo mikrofon kolu', imageKey: 'product.headphone.primary' },
        ],
      },
      {
        name: 'Taşınabilir Ses',
        imageKey: 'catalog.headphones',
        products: [
          { name: 'AudioMax Pocket DAC', description: 'Kompakt DAC', imageKey: 'product.headphone.secondary' },
          { name: 'AudioMax Clip Amp', description: 'Taşınabilir amfi', imageKey: 'product.headphone.primary' },
          { name: 'AudioMax Sport Buds', description: 'Suya dayanıklı kulaklık', imageKey: 'product.headphone.secondary' },
          { name: 'AudioMax Travel Case', description: 'Sert taşıma çantası', imageKey: 'product.phone.phone1' },
          { name: 'AudioMax Cable Kit', description: 'Değiştirilebilir kablo seti', imageKey: 'product.phone.phone2' },
        ],
      },
      {
        name: 'Ev Eğlence',
        imageKey: 'catalog.games',
        products: [
          { name: 'AudioMax Mini Soundbar', description: 'Kompakt soundbar', imageKey: 'product.headphone.primary' },
          { name: 'AudioMax BT Receiver', description: 'Bluetooth alıcı', imageKey: 'product.headphone.secondary' },
          { name: 'AudioMax Media Box', description: 'Medya oynatıcı', imageKey: 'product.phone.phone3' },
          { name: 'AudioMax Remote', description: 'Evrensel kumanda', imageKey: 'product.phone.phone4' },
          { name: 'AudioMax LED Strip', description: 'Ambiyans ışık seti', imageKey: 'product.phone.phone5' },
        ],
      },
    ]

    for (const grp of extraGroups) {
      let productGroup = await prisma.productGroup.findFirst({
        where: { name: `${audioMaxBrandV2.name} - ${grp.name}`, subCategoryId: EXTRA_SUBCATEGORY_ID },
      })

      if (!productGroup) {
        productGroup = await prisma.productGroup.create({
          data: {
            name: `${audioMaxBrandV2.name} - ${grp.name}`,
            description: `${audioMaxBrandV2.name} ${grp.name}`,
            subCategoryId: EXTRA_SUBCATEGORY_ID,
            imageUrl: getSeedMediaPath(grp.imageKey as SeedMediaKey, true) || null,
          },
        })
      }

      for (const productDef of grp.products) {
        const exists = await prisma.product.findFirst({
          where: { name: productDef.name, brand: audioMaxBrandV2.name, groupId: productGroup.id },
        })
        if (exists) {
          // Mevcut product'ın imageUrl'ini güncelle
          const imageUrl = getSeedMediaPath(productDef.imageKey as SeedMediaKey, true);
          if (imageUrl && exists.imageUrl !== imageUrl) {
            await prisma.product.update({
              where: { id: exists.id },
              data: { imageUrl },
            });
          }
          continue;
        }

        await prisma.product.create({
          data: {
            name: productDef.name,
            brand: audioMaxBrandV2.name,
            description: productDef.description,
            imageUrl: getSeedMediaPath(productDef.imageKey as SeedMediaKey, true) || null,
            groupId: productGroup.id,
          },
        })
      }
    }

    console.log('✅ AudioMax için ekstra 4 grup ve 20 ürün eklendi (sabit subCategory)')

    // Ana AudioMax grup (a6273598-7e60-491b-8472-63b64d73c48f) için 20 ürün (ilk 5 mevcut önizleme ile aynı)
    const mainAudioMaxGroupId = 'a6273598-7e60-491b-8472-63b64d73c48f'
    const mainGroup = await prisma.productGroup.findUnique({ where: { id: mainAudioMaxGroupId } })
    if (mainGroup) {
      const previewProducts: Array<{ name: string; description: string; imageKey: SeedMediaKey }> = [
        { name: 'AudioMax Amplifier', description: 'Güç amplifikatörü', imageKey: 'product.laptop.macbook' },
        { name: 'AudioMax CD Player', description: 'CD çalar', imageKey: 'product.headphone.secondary' },
        { name: 'AudioMax Turntable', description: 'Plak çalar', imageKey: 'product.headphone.primary' },
        { name: 'AudioMax DAC', description: 'Dijital-analog dönüştürücü', imageKey: 'product.phone.phone6' },
        { name: 'AudioMax Earbuds Pro', description: 'Aktif gürültü önleme kulaklık', imageKey: 'product.phone.phone4' },
      ]

      const extraProducts: Array<{ name: string; description: string; imageKey: SeedMediaKey }> = [
        { name: 'AudioMax Studio Mic', description: 'Kondenser mikrofon', imageKey: 'product.headphone.primary' },
        { name: 'AudioMax Wireless Speaker Mini', description: 'Kompakt BT hoparlör', imageKey: 'product.headphone.secondary' },
        { name: 'AudioMax Gaming Headset', description: '7.1 surround kulaklık', imageKey: 'product.headphone.primary' },
        { name: 'AudioMax Soundbar Plus', description: 'Sinema deneyimi için', imageKey: 'product.headphone.secondary' },
        { name: 'AudioMax Earbuds Lite', description: 'Günlük kullanım için', imageKey: 'product.headphone.primary' },
        { name: 'AudioMax Home Theater', description: '5.1 ev sineması', imageKey: 'product.headphone.secondary' },
        { name: 'AudioMax Portable Amp', description: 'Cep tipi kulaklık amfisi', imageKey: 'product.phone.phone1' },
        { name: 'AudioMax HiFi Cable', description: 'Premium ses kablosu', imageKey: 'product.phone.phone2' },
        { name: 'AudioMax DJ Mixer', description: '2 kanal DJ mikser', imageKey: 'product.phone.phone3' },
        { name: 'AudioMax Studio Monitor', description: 'Referans monitör', imageKey: 'product.phone.phone4' },
        { name: 'AudioMax Bluetooth Receiver', description: 'Kablosuz ses alıcı', imageKey: 'product.phone.phone5' },
        { name: 'AudioMax Dock Station', description: 'Çoklu bağlantı yuvası', imageKey: 'product.phone.phone3' },
        { name: 'AudioMax Travel Charger', description: '60W GaN adaptör', imageKey: 'product.phone.phone2' },
        { name: 'AudioMax ANC Headphones', description: 'Over-ear ANC kulaklık', imageKey: 'product.headphone.primary' },
        { name: 'AudioMax Reference Cable', description: 'Düşük gürültülü RCA', imageKey: 'product.headphone.secondary' },
      ]

      const ensureProducts = async (products: Array<{ name: string; description: string; imageKey: SeedMediaKey }>) => {
        for (const productDef of products) {
          const exists = await prisma.product.findFirst({
            where: { name: productDef.name, brand: audioMaxBrandV2.name, groupId: mainAudioMaxGroupId },
          })
          if (exists) {
            // Mevcut product'ın imageUrl'ini güncelle
            const imageUrl = getSeedMediaPath(productDef.imageKey as SeedMediaKey, true);
            if (imageUrl && exists.imageUrl !== imageUrl) {
              await prisma.product.update({
                where: { id: exists.id },
                data: { imageUrl },
              });
            }
            continue;
          }

          await prisma.product.create({
            data: {
              name: productDef.name,
              brand: audioMaxBrandV2.name,
              description: productDef.description,
              imageUrl: getSeedMediaPath(productDef.imageKey as SeedMediaKey, true) || null,
              groupId: mainAudioMaxGroupId,
            },
          })
        }
      }

      await ensureProducts(previewProducts)
      await ensureProducts(extraProducts)
      console.log('✅ AudioMax ana grup için toplam 20 ürün garanti edildi (ilk 5 önizleme ile aynı)')
    } else {
      console.warn(`⚠️ Ana AudioMax grup bulunamadı (ID: ${mainAudioMaxGroupId}), 20 ürün ekleme atlandı`)
    }
  }

  // Belirli grup ID için ürün sayısını 12'ye çıkar
  const TARGET_GROUP_ID = '05a7e434-a1e2-46f7-b92f-85da7a57d8f8'
  console.log(`📦 Grup ID ${TARGET_GROUP_ID} için ürün sayısı 12'ye çıkarılıyor...`)
  const targetGroup = await prisma.productGroup.findUnique({ 
    where: { id: TARGET_GROUP_ID },
    include: { products: true }
  })
  
  if (targetGroup) {
    const currentProductCount = targetGroup.products.length
    const targetCount = 12
    const productsToAdd = targetCount - currentProductCount
    
    if (productsToAdd > 0) {
      // Grubun brand bilgisini bulmak için ilk üründen brand al veya AudioMax kullan
      const firstProduct = targetGroup.products[0]
      const brandName = firstProduct?.brand || 'AudioMax'
      
      // Ürün görsel key'leri
      const productImageKeys: SeedMediaKey[] = [
        'product.generic.1', 'product.generic.2', 'product.generic.3', 'product.generic.4',
        'product.generic.5', 'product.generic.6', 'product.generic.7', 'product.generic.8',
        'product.generic.9', 'product.generic.10', 'product.generic.11', 'product.headphone.primary',
        'product.headphone.secondary', 'product.phone.phone1', 'product.phone.phone2',
        'product.laptop.macbook'
      ]
      
      // Mevcut ürün isimlerini kontrol etmek için
      const existingProductNames = new Set(targetGroup.products.map(p => p.name))
      
      for (let i = 0; i < productsToAdd; i++) {
        const productIndex = currentProductCount + i + 1
        let productName = `${brandName} Ürün ${productIndex}`
        
        // Benzersiz isim garantisi
        let counter = 1
        while (existingProductNames.has(productName)) {
          productName = `${brandName} Ürün ${productIndex} (${counter})`
          counter++
        }
        existingProductNames.add(productName)
        
        const imageKey = productImageKeys[i % productImageKeys.length]
        
        await prisma.product.create({
          data: {
            name: productName,
            brand: brandName,
            description: `${targetGroup.name} için otomatik eklenen ürün ${productIndex}`,
            imageUrl: getSeedMediaPath(imageKey, true) || null,
            groupId: TARGET_GROUP_ID,
          },
        })
      }
      
      console.log(`✅ Grup ${TARGET_GROUP_ID} için ${productsToAdd} yeni ürün eklendi (toplam: ${targetCount})`)
    } else if (productsToAdd < 0) {
      console.log(`ℹ️ Grup ${TARGET_GROUP_ID} zaten ${currentProductCount} ürüne sahip (hedef: ${targetCount})`)
    } else {
      console.log(`✅ Grup ${TARGET_GROUP_ID} zaten ${targetCount} ürüne sahip`)
    }
  } else {
    console.warn(`⚠️ Grup bulunamadı (ID: ${TARGET_GROUP_ID}), ürün ekleme atlandı`)
  }

  // Add products for specific brand ID: a8fc294b-1f6d-4f22-827b-86e75a1a7095 (AudioMax)
  console.log('📦 Adding products for specific brand ID: a8fc294b-1f6d-4f22-827b-86e75a1a7095...')
  const specificBrandId = 'a8fc294b-1f6d-4f22-827b-86e75a1a7095'
  const specificBrand = await prisma.brand.findUnique({
    where: { id: specificBrandId },
    include: { brandCategory: true }
  })
  
  if (specificBrand) {
    // Brand için ProductGroup bul veya oluştur
    let specificProductGroup = brandProductGroupsMap.get(specificBrandId)
    
    if (!specificProductGroup) {
      // Brand'ın category'sine göre SubCategory bul
      // Electronics category için Kulaklıklar subcategory'sini kullan
      const techCategory = mainCategories.find(c => c.id === TECH_MAIN_CATEGORY_ID)
      let subCategory: Awaited<ReturnType<typeof prisma.subCategory.findFirst>> | null = null
      
      if (techCategory) {
        // Kulaklıklar subcategory'sini bul (AudioMax için uygun)
        subCategory = await prisma.subCategory.findFirst({
          where: { 
            mainCategoryId: techCategory.id,
            name: { contains: 'Kulaklık', mode: 'insensitive' }
          }
        })
        
        // Eğer Kulaklıklar yoksa, herhangi bir subcategory kullan
        if (!subCategory) {
          subCategory = await prisma.subCategory.findFirst({
            where: { mainCategoryId: techCategory.id }
          })
        }
        
        // Hala yoksa oluştur
        if (!subCategory) {
          subCategory = await prisma.subCategory.create({
            data: {
              name: 'Kulaklıklar',
              description: 'Kulaklık ve ses ekipmanları',
              mainCategoryId: techCategory.id,
              imageUrl: getSeedMediaPath('catalog.headphones', true) || null,
            }
          })
        }
      }
      
      if (subCategory) {
        // ProductGroup oluştur
        const newProductGroup = await prisma.productGroup.create({
          data: {
            name: `${specificBrand.name} Ürün Grubu`,
            description: `${specificBrand.name} marka ürünleri`,
            subCategoryId: subCategory.id,
            imageUrl: specificBrand.imageUrl,
          }
        })
        
        specificProductGroup = newProductGroup.id
        brandProductGroupsMap.set(specificBrandId, specificProductGroup)
      }
    }
    
    // AudioMax için özel product template'lerini kullan
    const audioMaxTemplates = brandProductTemplates[specificBrand.name] || []
    const specificProductTemplates = audioMaxTemplates.length > 0 
      ? audioMaxTemplates 
      : [
          { name: 'AudioMax Studio Headphones', description: 'Profesyonel stüdyo kulaklığı' },
          { name: 'AudioMax Wireless Speaker', description: 'Bluetooth kablosuz hoparlör' },
          { name: 'AudioMax Soundbar', description: 'TV için ses çubuğu' },
          { name: 'AudioMax Earbuds Pro', description: 'Aktif gürültü önleme kulaklık' },
          { name: 'AudioMax Microphone', description: 'USB mikrofon' },
          { name: 'AudioMax DAC', description: 'Dijital-analog dönüştürücü' },
          { name: 'AudioMax Amplifier', description: 'Güç amplifikatörü' },
          { name: 'AudioMax Turntable', description: 'Plak çalar' },
          { name: 'AudioMax CD Player', description: 'CD çalar' },
          { name: 'AudioMax Audio Cable', description: 'Premium ses kablosu' },
        ]
    
    const specificProductImageKeys: SeedMediaKey[] = [
      'product.headphone.primary',
      'product.headphone.secondary',
      'product.headphone.primary',
      'product.headphone.secondary',
      'product.headphone.primary',
      'product.headphone.secondary',
      'product.headphone.primary',
      'product.headphone.secondary',
      'product.headphone.primary',
      'product.headphone.secondary',
    ]
    
    for (let i = 0; i < specificProductTemplates.length; i++) {
      const productData = specificProductTemplates[i]
      const imageKey = specificProductImageKeys[i % specificProductImageKeys.length]
      
      try {
        await prisma.product.create({
          data: {
            name: productData.name,
            brand: specificBrand.name,
            description: productData.description,
            imageUrl: getSeedMediaPath(imageKey, true) || null,
            groupId: specificProductGroup || null, // ProductGroup'a bağla
          }
        })
        seedBrandProductsCount++
      } catch (error) {
        console.warn(`Product oluşturulamadı (${specificBrand.name} - ${productData.name}): ${error}`)
      }
    }

    // AudioMax Audio Cable ürünlerinde imageUrl boşsa doldur
    const audioCableImage = getSeedMediaPath('product.headphone.secondary', true) || null
    const updatedAudioCables = await prisma.product.updateMany({
      where: {
        brand: specificBrand.name,
        name: 'AudioMax Audio Cable',
        OR: [{ imageUrl: null }, { imageUrl: '' }],
      },
      data: {
        imageUrl: audioCableImage,
      },
    })
    if (updatedAudioCables.count > 0) {
      console.log(`✅ ${updatedAudioCables.count} AudioMax Audio Cable ürününün görseli güncellendi`)
    }
    console.log(`✅ ${specificProductTemplates.length} product eklendi brand ID: ${specificBrandId} (${specificBrand.name})`)
  } else {
    console.warn(`⚠️ Brand bulunamadı ID: ${specificBrandId}`)
  }

  // Add products for AutoParts Pro - ID bazlı ve foreign key uyumlu
  console.log('📦 Adding products for AutoParts Pro (ID bazlı)...')
  const autopartsBrand = await prisma.brand.findFirst({
    where: { name: 'AutoParts Pro' },
    include: { brandCategory: true }
  })
  
  if (autopartsBrand) {
    // AutoParts Pro için ProductGroup bul veya oluştur
    let autopartsProductGroup = brandProductGroupsMap.get(autopartsBrand.id)
    
    if (!autopartsProductGroup) {
      // Otomotiv kategorisi için SubCategory bul veya oluştur
      // Önce "Otomotiv" main category'sini bul
      const automotiveMainCategory = mainCategories.find(c => c.name === 'Otomotiv')
      let subCategory: Awaited<ReturnType<typeof prisma.subCategory.findFirst>> | null = null
      
      if (automotiveMainCategory) {
        // Otomotiv subcategory'sini bul
        subCategory = await prisma.subCategory.findFirst({
          where: { 
            mainCategoryId: automotiveMainCategory.id,
            name: { contains: 'Otomotiv', mode: 'insensitive' }
          }
        })
        
        // Eğer yoksa oluştur
        if (!subCategory) {
          subCategory = await prisma.subCategory.create({
            data: {
              name: 'Otomotiv Ürünleri',
              description: 'Otomotiv yedek parça ve aksesuarları',
              mainCategoryId: automotiveMainCategory.id,
              imageUrl: getSeedMediaPath('catalog.otomotiv', true) || null,
            }
          })
        }
      } else {
        // Otomotiv kategori yoksa, Ev & Yaşam kategorisini kullan
        const evYasamCategory = mainCategories.find(c => c.name === 'Ev & Yaşam')
        if (evYasamCategory) {
          subCategory = await prisma.subCategory.findFirst({
            where: { mainCategoryId: evYasamCategory.id }
          })
          
          if (!subCategory) {
            subCategory = await prisma.subCategory.create({
              data: {
                name: 'Temizlik Ürünleri',
                description: 'Süpürge, temizlik robotu vb.',
                mainCategoryId: evYasamCategory.id,
                imageUrl: getSeedMediaPath('catalog.home-appliances', true) || null,
              }
            })
          }
        }
      }
      
      if (subCategory) {
        // ProductGroup bul veya oluştur
        let productGroup = await prisma.productGroup.findFirst({
          where: {
            subCategoryId: subCategory.id,
            name: { contains: 'AutoParts Pro', mode: 'insensitive' }
          }
        })
        
        if (!productGroup) {
          productGroup = await prisma.productGroup.create({
            data: {
              name: 'AutoParts Pro Ürünleri',
              description: 'AutoParts Pro markasına ait otomotiv ürünleri',
              subCategoryId: subCategory.id,
              imageUrl: autopartsBrand.imageUrl || getSeedMediaPath('catalog.otomotiv', true) || null,
            }
          })
        }
        
        autopartsProductGroup = productGroup.id
        brandProductGroupsMap.set(autopartsBrand.id, autopartsProductGroup)
      }
    }
    
    // AutoParts Pro için product template'lerini al
    const autopartsTemplates = brandProductTemplates['AutoParts Pro'] || []
    
    if (autopartsTemplates.length > 0 && autopartsProductGroup) {
      let autopartsProductCount = 0
      
      for (let i = 0; i < autopartsTemplates.length; i++) {
        const productData = autopartsTemplates[i]
        const imageKey = productImageKeys[i % productImageKeys.length]
        
        // Product'ın zaten var olup olmadığını kontrol et
        const existingProduct = await prisma.product.findFirst({
          where: {
            brand: 'AutoParts Pro',
            name: productData.name
          }
        })
        
        if (!existingProduct) {
          try {
            await prisma.product.create({
              data: {
                name: productData.name,
                brand: autopartsBrand.name,
                description: productData.description,
                imageUrl: getSeedMediaPath(imageKey, true) || null,
                groupId: autopartsProductGroup, // Foreign key ile ProductGroup'a bağla
              }
            })
            autopartsProductCount++
            seedBrandProductsCount++
          } catch (error) {
            console.warn(`Product oluşturulamadı (AutoParts Pro - ${productData.name}): ${error}`)
          }
        }
      }
      
      console.log(`✅ ${autopartsProductCount} product eklendi AutoParts Pro (Brand ID: ${autopartsBrand.id}, Group ID: ${autopartsProductGroup})`)
    } else {
      console.warn(`⚠️ AutoParts Pro için product template'leri bulunamadı veya ProductGroup oluşturulamadı`)
    }
  } else {
    console.warn(`⚠️ AutoParts Pro brand bulunamadı`)
  }

  // Create experience and news posts for seed brand products
  console.log('📰 Creating experience and news posts for seed brand products...')
  const allBrandNames = createdBrands.filter((b): b is NonNullable<typeof b> => b !== null && b !== undefined).map(b => b.name)
  const seedBrandProductsData = await prisma.product.findMany({
    where: {
      brand: { in: allBrandNames }
    },
    take: 20
  })

  let experienceNewsPostsCount = 0
  const experienceTemplates = [
    'Since I started using this product my daily routine has become much more predictable and relaxed. It quietly takes care of repetitive tasks that used to eat up chunks of my evening. Over a few weeks the small time savings add up to a noticeable difference in how much energy I have left after work. It feels less like a gadget and more like part of the way my home runs.',
    'From the very first day I could tell this device was built better than many alternatives in the same price range. Buttons, hinges and the overall finish feel reassuring instead of flimsy. Even when I push it a bit harder it continues to behave in a stable, consistent way. It has comfortably exceeded my expectations for both quality and ease of use.',
    'Looking at the product after several months of use, I am still pleasantly surprised by its long‑term performance. There are no worrying noises, big drops in battery life or obvious signs of wear yet. It simply does the same job today that it did in the first week. For a tool I reach for so often, that kind of reliability is exactly what I want.',
    'I spent some time testing the product more systematically to understand where it really shines. In everyday scenarios it delivers the same strengths I saw in early reviews, without hidden trade‑offs. The few compromises it makes are reasonable given the price and category. Overall it feels like a well‑balanced choice for most people rather than a niche, specialist device.',
    'From a user‑experience point of view this is one of those products that “just works” once you set it up. The interface is simple enough that I do not have to re‑learn it every time I come back to it. When something goes wrong, the behavior is predictable and easy to recover from. That calm, dependable feeling is ultimately what keeps it in my daily setup.',
  ]
  const newsTemplates = [
    'A new feature update has been rolled out with several small but meaningful improvements. Navigation feels a bit smoother and a couple of long‑standing edge cases have finally been fixed. Power users will appreciate the extra settings, while casual users simply notice that things break less often. It is the kind of update that rewards people who keep their devices current.',
    'The brand has launched a limited‑time campaign with special pricing and curated bundles. It is clearly designed for users who have been waiting for the right moment to upgrade. Quantities and the campaign window are both finite, so early decisions matter more than usual. If this product has been on your wish list, now is a very good time to take another look.',
    'New details about the product line have been shared, along with a clearer roadmap for the next few months. Several community‑requested improvements have been confirmed for upcoming releases. While timelines may still shift, it is reassuring to see an active commitment to iteration. Staying informed about these changes helps you decide when it makes sense to upgrade.',
    'Early information about an upcoming model has started circulating within the community. The focus seems to be on better endurance, smarter software and a more refined physical design. Nothing is official until launch day, but the direction looks promising for power users. If you enjoy testing new hardware, this is definitely a release worth tracking.',
    'A batch of refinements based on real‑world feedback has just been announced for the current generation. Many of the changes are small on their own, but together they make the product feel more polished and mature. Bugs that slipped through early versions have been addressed without adding extra complexity. It is a good sign that the brand is listening closely to everyday users.',
  ]

  for (const product of seedBrandProductsData.slice(0, 10)) {
    // Her product için 2 experience post (FREE type)
    for (let i = 0; i < 2; i++) {
      try {
        const post = await createOrGetContentPost({
          userId: userIdToUse,
          type: 'FREE',
          title: `${product.name} Deneyim Paylaşımı ${i + 1}`,
          body: experienceTemplates[i % experienceTemplates.length],
          productId: product.id,
          inventoryRequired: false,
          isBoosted: false,
          createdAt: daysAgo(Math.floor(Math.random() * 30) + 1),
        })
        if (post) experienceNewsPostsCount++
      } catch (error) {
        console.warn(`Experience post oluşturulamadı: ${error}`)
      }
    }

    // Her product için 1 news post (UPDATE type)
    try {
      const post = await createOrGetContentPost({
        userId: userIdToUse,
        type: 'UPDATE',
        title: `${product.name} Haberleri`,
        body: newsTemplates[Math.floor(Math.random() * newsTemplates.length)],
        productId: product.id,
        inventoryRequired: false,
        isBoosted: false,
        createdAt: daysAgo(Math.floor(Math.random() * 30) + 1),
      })
      if (post) experienceNewsPostsCount++
    } catch (error) {
      console.warn(`News post oluşturulamadı: ${error}`)
    }
  }
  console.log(`✅ ${experienceNewsPostsCount} experience ve news post oluşturuldu seed brand product'lar için`)

  // Brand feed'de farklı tipleri gösterebilmek için AudioMax odaklı ekstra post'lar
  console.log('📰 Creating AudioMax-specific brand feed posts...')
  const audioMaxBrandForFeed = await prisma.brand.findFirst({ where: { name: 'AudioMax' } })
  if (audioMaxBrandForFeed) {
    const audioMaxProducts = await prisma.product.findMany({
      where: { brand: audioMaxBrandForFeed.name },
      include: {
        group: {
          include: {
            subCategory: {
              include: {
                mainCategory: true,
              },
            },
          },
        },
      },
    })

    if (audioMaxProducts.length > 0) {
      // Brand feed kartlarında images[] alanını doldurmak için,
      // TEST_USER_ID envanterine AudioMax ürün görsellerini ekleyelim.
      console.log('🖼  Ensuring AudioMax inventory media for brand feed images...')
      for (const product of audioMaxProducts) {
        try {
          const inventory = await prisma.inventory.upsert({
            where: {
              userId_productId: {
                userId: TEST_USER_ID,
                productId: product.id,
              },
            },
            update: {},
            create: {
              userId: TEST_USER_ID,
              productId: product.id,
              hasOwned: true,
            },
          })

          await prisma.inventoryMedia.createMany({
            data: [
              {
                inventoryId: inventory.id,
                mediaUrl: product.imageUrl || (getSeedMediaPath('product.headphone.primary', true) ?? ''),
              },
            ],
            skipDuplicates: true,
          })
        } catch (error) {
          console.warn(`⚠️ AudioMax inventory media oluşturulamadı (${product.id}): ${error}`)
        }
      }

      type AudioMaxFeedTemplate = {
        type: 'FREE' | 'TIPS' | 'QUESTION' | 'EXPERIENCE' | 'UPDATE' | 'COMPARE'
        title: string
        body: string
        tag?: string
        tipCategory?: 'USAGE' | 'PURCHASE' | 'CARE' | 'OTHER'
        answerFormat?: 'SHORT' | 'LONG'
        comparisonSummary?: string
        comparisonMetrics?: Array<{ name: string; scoreProduct1: number; scoreProduct2: number }>
      }

      const brandFeedTitlePrefix = 'AudioMax Feed -'
      const existingAudioMaxFeedPosts = await prisma.contentPost.count({
        where: {
          title: {
            startsWith: brandFeedTitlePrefix,
          },
        },
      })

      const targetAudioMaxFeedPosts = 10 // 20'den 10'a düşürüldü
      const postsNeeded = Math.max(0, targetAudioMaxFeedPosts - existingAudioMaxFeedPosts)

      if (postsNeeded > 0) {
        const feedTemplates: AudioMaxFeedTemplate[] = [
          {
            type: 'FREE',
            title: 'Studio Headphones Deep Dive',
            body: 'We spent a full week mixing and mastering tracks only with the AudioMax Studio Headphones. The tuning is flatter than most consumer cans, so it is easier to catch harsh mids early in the process.',
            tag: 'Review',
          },
          {
            type: 'EXPERIENCE',
            title: 'Wireless Speaker Travel Notes',
            body: 'AudioMax Wireless Speaker handled three different apartment setups without needing a manual reset. Multi-room sync stayed locked even when bandwidth was terrible.',
            tag: 'Experience',
          },
          {
            type: 'TIPS',
            title: 'Earbuds Pro Fit Guide',
            body: 'Try the medium tips first, then rotate each bud slightly forward once inserted. It creates a more stable seal and the adaptive EQ immediately sounds fuller.',
            tag: 'Tips',
            tipCategory: 'USAGE',
          },
          {
            type: 'UPDATE',
            title: 'Soundbar Firmware Rollout',
            body: 'AudioMax pushed a firmware update that finally exposes granular dialog boost levels. If you watch a lot of documentaries, set it to +2 and enjoy cleaner narration.',
            tag: 'Update',
          },
          {
            type: 'QUESTION',
            title: 'Best DAC Pairing?',
            body: 'Which AudioMax DAC preset works better for jazz vinyl transfers? Looking for feedback from people who digitize their collections often.',
            tag: 'Question',
            answerFormat: 'SHORT',
          },
          {
            type: 'COMPARE',
            title: 'Speaker vs Soundbar Showdown',
            body: 'We put the Wireless Speaker next to the flagship Soundbar to see which one handles wide living rooms better.',
            tag: 'Benchmark',
            comparisonSummary: 'The Soundbar still wins on channel separation, but the Wireless Speaker is surprisingly full when positioned near a back wall.',
            comparisonMetrics: [
              { name: 'Fiyat', scoreProduct1: 7, scoreProduct2: 6 },
              { name: 'Kalite', scoreProduct1: 9, scoreProduct2: 8 },
              { name: 'Özellikler', scoreProduct1: 8, scoreProduct2: 9 },
            ],
          },
          {
            type: 'FREE',
            title: 'Microphone Workflow Notes',
            body: 'AudioMax Microphone pairs really well with the default compressor settings inside Logic. Minimal de-essing was required even on bright voices.',
            tag: 'Workflow',
          },
          {
            type: 'EXPERIENCE',
            title: 'Turntable Daily Driver',
            body: 'Using the AudioMax Turntable for a month reminded me how quiet a well-isolated motor can be. It barely transfers any vibration to the cabinet.',
            tag: 'Vinyl',
          },
        ]

        const comparisonMetrics = await prisma.comparisonMetric.findMany()
        const metricMap = new Map(comparisonMetrics.map((metric) => [metric.name, metric.id]))

        let createdAudioMaxFeedPosts = 0
        for (let i = 0; i < postsNeeded; i++) {
          const template = feedTemplates[i % feedTemplates.length]
          const product = audioMaxProducts[i % audioMaxProducts.length]
          if (!product) continue

          const subCategoryId =
            (product.group && 'subCategoryId' in product.group && (product.group as any).subCategoryId) ||
            product.group?.subCategory?.id ||
            null
          const mainCategoryId =
            product.group?.subCategory?.mainCategoryId ||
            product.group?.subCategory?.mainCategory?.id ||
            mainCategories[0]?.id ||
            null

          const postId = generateUlid()
          const postUserId = TRUST_USER_IDS[(i + createdAudioMaxFeedPosts) % TRUST_USER_IDS.length] || TEST_USER_ID

          try {
            const post = await createOrGetContentPost({
              userId: postUserId,
              type: template.type,
              title: `${brandFeedTitlePrefix} ${template.title} #${existingAudioMaxFeedPosts + i + 1}`,
              body: template.body,
              productId: product.id,
              productGroupId: product.groupId || null,
              subCategoryId,
              mainCategoryId,
              inventoryRequired: true,
              isBoosted: (existingAudioMaxFeedPosts + i) % 5 === 0,
              createdAt: daysAgo(randomBetween(1, 20)),
            })
            
            if (!post) continue
            const postId = post.id

            // Max 2-3 tag: brand + template tag (varsa)
            const tagValues = [audioMaxBrandForFeed.name]
            if (template.tag) {
              tagValues.push(template.tag)
            }
            await prisma.contentPostTag.createMany({
              data: tagValues.map((tag) => ({
                postId,
                tag,
              })),
              skipDuplicates: true,
            })

            if (template.type === 'TIPS') {
              // Duplicate kontrolü: post_id unique constraint
              const existingTip = await prisma.postTip.findFirst({
                where: { postId }
              });
              if (!existingTip) {
                await prisma.postTip.create({
                  data: {
                    postId,
                    tipCategory: template.tipCategory || 'USAGE',
                    isVerified: true,
                  },
                }).catch(() => {})
              }
            }

            if (template.type === 'QUESTION') {
              // Duplicate kontrolü: post_id unique constraint
              const existingQuestion = await prisma.postQuestion.findFirst({
                where: { postId }
              });
              if (!existingQuestion) {
                await prisma.postQuestion.create({
                  data: {
                    postId,
                    expectedAnswerFormat: template.answerFormat || 'SHORT',
                    relatedProductId: product.id,
                  },
                }).catch(() => {})
              }
            }

            if (template.type === 'COMPARE') {
              if (audioMaxProducts.length < 2) {
                console.warn('⚠️ Compare template skipped — insufficient AudioMax products')
              } else {
                const secondaryProduct = audioMaxProducts[(i + 1) % audioMaxProducts.length] || product
                // Duplicate kontrolü: post_id unique constraint
                let comparison = await prisma.postComparison.findFirst({
                  where: { postId }
                });
                if (!comparison) {
                  comparison = await prisma.postComparison.create({
                    data: {
                      postId,
                      product1Id: product.id,
                      product2Id: secondaryProduct.id,
                      comparisonSummary:
                        template.comparisonSummary ||
                        'Detailed look at how two AudioMax configurations behave in real living rooms.',
                    },
                  })
                }

                if (comparison) {
                  const scorePayload =
                    template.comparisonMetrics ||
                    [
                      { name: 'Fiyat', scoreProduct1: 7, scoreProduct2: 6 },
                      { name: 'Kalite', scoreProduct1: 9, scoreProduct2: 8 },
                    ]

                  const scoreRows = scorePayload
                    .map((metric) => {
                      const metricId = metricMap.get(metric.name)
                      if (!metricId) return null
                      return {
                        comparisonId: comparison.id,
                        metricId,
                        scoreProduct1: metric.scoreProduct1,
                        scoreProduct2: metric.scoreProduct2,
                      }
                    })
                    .filter(Boolean) as Array<Prisma.PostComparisonScoreCreateManyInput>

                  if (scoreRows.length > 0) {
                    await prisma.postComparisonScore.createMany({
                      data: scoreRows,
                      skipDuplicates: true,
                    })
                  }
                }
              }
            }

            createdAudioMaxFeedPosts++
          } catch (error) {
            console.warn(`AudioMax brand feed post'u oluşturulamadı: ${error}`)
          }
        }

        console.log(`✅ ${createdAudioMaxFeedPosts} AudioMax brand feed post'u hazırlandı`)

        // AudioMax feed post'larına trending stats ekle (yüksek engagement değerleri)
        const audioMaxFeedPosts = await prisma.contentPost.findMany({
          where: {
            title: {
              startsWith: brandFeedTitlePrefix,
            },
          },
        })

        for (const post of audioMaxFeedPosts) {
          // Trending post'lar için yüksek engagement değerleri
          const likes = randomBetween(50, 200)
          const comments = randomBetween(10, 50)
          const shares = randomBetween(5, 30)
          const bookmarks = randomBetween(15, 80)
          const views = likes * randomBetween(8, 15) + randomBetween(100, 500)

          await prisma.contentPost.update({
            where: { id: post.id },
            data: {
              likesCount: likes,
              commentsCount: comments,
              sharesCount: shares,
              favoritesCount: bookmarks,
              viewsCount: views,
            },
          }).catch(() => {})
        }
        console.log(`✅ ${audioMaxFeedPosts.length} AudioMax feed post'una trending stats eklendi`)
      } else {
        console.log('✅ AudioMax brand feed already has 20+ posts')
      }
    } else {
      console.warn('⚠️ AudioMax markası için product bulunamadı, brand feed post eklenemedi')
    }
  } else {
    console.warn('⚠️ AudioMax brand kaydı bulunamadı')
  }

  // Brand trends için diğer brand'lara da trending post'lar ekle
  console.log('🔥 Creating trending posts for other brands...')
  const otherBrands = await prisma.brand.findMany({
    where: {
      name: {
        not: 'AudioMax',
      },
    },
    take: 5, // İlk 5 brand
  })

  for (const brand of otherBrands) {
    const brandProducts = await prisma.product.findMany({
      where: { brand: brand.name },
      include: {
        group: {
          include: {
            subCategory: {
              include: {
                mainCategory: true,
              },
            },
          },
        },
      },
      take: 3, // Her brand için 3 product
    })

    if (brandProducts.length === 0) continue

    // Her brand için 2-3 trending post oluştur (5-8'den 2-3'e düşürüldü)
    const trendingPostCount = randomBetween(2, 3)
    const trendingTemplates = [
      {
        type: 'FREE' as const,
        title: `${brand.name} Ürün İncelemesi`,
        body: `${brand.name} ürünlerini kullanarak edindiğim deneyimleri paylaşıyorum. Kalite ve performans açısından gerçekten etkileyici.`,
      },
      {
        type: 'EXPERIENCE' as const,
        title: `${brand.name} Deneyim Paylaşımı`,
        body: `${brand.name} ürünlerini günlük hayatımda kullanırken edindiğim deneyimler.`,
      },
      {
        type: 'TIPS' as const,
        title: `${brand.name} Kullanım İpuçları`,
        body: `${brand.name} ürünlerinden en iyi şekilde yararlanmak için ipuçları ve püf noktaları.`,
      },
      {
        type: 'UPDATE' as const,
        title: `${brand.name} Güncellemeleri`,
        body: `${brand.name} ürünlerinde yapılan son güncellemeler ve iyileştirmeler hakkında bilgiler.`,
      },
      {
        type: 'QUESTION' as const,
        title: `${brand.name} Hakkında Soru`,
        body: `${brand.name} ürünleri hakkında merak ettiğim konular ve sorular.`,
      },
    ]

    let createdTrendingPosts = 0
    for (let i = 0; i < trendingPostCount; i++) {
      const template = trendingTemplates[i % trendingTemplates.length]
      const product = brandProducts[i % brandProducts.length]
      const postUserId = TRUST_USER_IDS[i % TRUST_USER_IDS.length] || TEST_USER_ID

      try {
        const post = await createOrGetContentPost({
          userId: postUserId,
          type: template.type,
          title: template.title,
          body: template.body,
          productId: product.id,
          productGroupId: product.groupId || null,
          subCategoryId:
            (product.group && 'subCategoryId' in product.group && (product.group as any).subCategoryId) ||
            product.group?.subCategory?.id ||
            null,
          mainCategoryId:
            product.group?.subCategory?.mainCategoryId ||
            product.group?.subCategory?.mainCategory?.id ||
            null,
          inventoryRequired: true,
          isBoosted: i % 3 === 0, // Her 3. post boosted
          createdAt: daysAgo(randomBetween(1, 30)),
        }).catch(() => null)
        
        if (!post) continue
        const postId = post.id

        // Tag ekle
        await prisma.contentPostTag.createMany({
          data: [
            { postId, tag: brand.name },
            { postId, tag: 'Trending' },
          ],
          skipDuplicates: true,
        })

        createdTrendingPosts++
      } catch (error) {
        console.warn(`⚠️ Trending post oluşturulamadı (${brand.name}): ${error}`)
      }
    }

    if (createdTrendingPosts > 0) {
        console.log(`✅ ${createdTrendingPosts} trending post oluşturuldu: ${brand.name}`)
    }
  }
  console.log('✅ Brand trends seed datası tamamlandı')

  // 5. Create Expert Requests and Answers
  progress.increment('Expert request\'leri oluşturuluyor...')
  console.log('\n💡 Creating expert requests...')
  const expertRequests = await Promise.all([
    prisma.expertRequest.create({
      data: {
        userId: TEST_USER_ID,
        description: 'iPhone 15 Pro Max ve Samsung Galaxy S24 Ultra arasındaki farkları anlayabilir miyim? Hangisi daha iyi kamera performansı sunuyor?',
        tipsAmount: 50.0,
        status: 'ANSWERED',
        answeredAt: new Date(),
      },
    }),
    prisma.expertRequest.create({
      data: {
        userId: TEST_USER_ID,
        description: 'Dell XPS 13 ve MacBook Air M3 hangisi daha iyi? Programlama ve video editing için hangisini önerirsiniz?',
        tipsAmount: 100.0,
        status: 'PENDING',
      },
    }),
    prisma.expertRequest.create({
      data: {
        userId: TARGET_USER_ID,
        description: 'Sony WH-1000XM5 ve AirPods Max arasında karar veremiyorum. Noise cancellation ve ses kalitesi açısından hangisi daha iyi?',
        tipsAmount: 75.0,
        status: 'ANSWERED',
        answeredAt: new Date(),
      },
    }),
    prisma.expertRequest.create({
      data: {
        userId: TARGET_USER_ID,
        description: 'Nespresso ve DeLonghi tam otomatik kahve makineleri arasındaki fark nedir? Ev kullanımı için hangisi daha uygun?',
        tipsAmount: 0,
        status: 'PENDING',
      },
    }),
  ])
  console.log(`✅ ${expertRequests.length} expert request oluşturuldu`)

  // Create Expert Answers for answered requests
  console.log('💬 Creating expert answers...')
  const expertAnswers = await Promise.all([
    // Answer for first request (iPhone vs Samsung)
    prisma.expertAnswer.create({
      data: {
        requestId: expertRequests[0].id,
        expertUserId: TRUST_USER_IDS[0],
        content: 'Her iki telefon da mükemmel kamera sistemlerine sahip, ancak ihtiyacınıza göre farklılık gösteriyorlar. iPhone 15 Pro Max video çekimlerde daha iyi performans sunarken, Galaxy S24 Ultra fotoğraf çekimlerde daha fazla özellik sunuyor. Video editing için iPhone\'u, fotoğrafçılık için Galaxy\'i öneririm.',
      },
    }),
    // Answer for third request (Sony vs AirPods)
    prisma.expertAnswer.create({
      data: {
        requestId: expertRequests[2].id,
        expertUserId: TRUST_USER_IDS[1],
        content: 'Sony WH-1000XM5 noise cancellation açısından kesinlikle daha üstün. Özellikle uçak yolculuklarında ve ofis ortamında çok etkili. AirPods Max ise Apple ekosistemiyle mükemmel entegrasyon sunuyor. Android kullanıyorsanız Sony\'yi, iOS kullanıyorsanız AirPods Max\'i tercih edin.',
      },
    }),
  ])
  console.log(`✅ ${expertAnswers.length} expert answer oluşturuldu`)

  // 6. DM Threads (Normal DM conversations)
  console.log('💬 Creating DM threads...')

  type ThreadSeed = {
    userOneId: string;
    userTwoId: string;
    unreadCountUserOne: number;
    unreadCountUserTwo: number;
    isSupportThread: boolean;
    messages: Array<{
      senderId: string;
      message: string;
      minutesAgo: number;
      isRead: boolean;
      context?: 'DM' | 'SUPPORT';
    }>;
  };

  // Gerçek kullanıcılar arasında karşılıklı DM thread'leri
  // Ömer (TEST_USER_ID) ile diğer gerçek kullanıcılar arasında konuşmalar
  const NORMAL_DM_THREAD_SEEDS: ThreadSeed[] = [
    // Ömer <-> Market Test User
    {
      userOneId: TEST_USER_ID,
      userTwoId: TARGET_USER_ID,
      unreadCountUserOne: 1,
      unreadCountUserTwo: 0,
      isSupportThread: false,
      messages: [
        {
          senderId: TEST_USER_ID,
          message: 'Selam! Yeni ürün incelemesini gördün mü?',
          minutesAgo: 30,
          isRead: true,
          context: 'DM',
        },
        {
          senderId: TARGET_USER_ID,
          message: 'Evet, mükemmel olmuş. Birkaç önerim olacak 👌',
          minutesAgo: 10,
          isRead: false,
          context: 'DM',
        },
      ],
    },
    // Ömer <-> Trust User 1
    {
      userOneId: TRUST_USER_IDS[0],
      userTwoId: TEST_USER_ID,
      unreadCountUserOne: 0,
      unreadCountUserTwo: 2,
      isSupportThread: false,
      messages: [
        {
          senderId: TRUST_USER_IDS[0],
          message: 'Merhaba! Mini destek görüşmesi için uygun musun?',
          minutesAgo: 45,
          isRead: false,
          context: 'DM',
        },
        {
          senderId: TRUST_USER_IDS[0],
          message: 'Bu arada geçen hafta gönderdiğim TIPS için teşekkür ederim.',
          minutesAgo: 40,
          isRead: false,
          context: 'DM',
        },
        {
          senderId: TEST_USER_ID,
          message: 'Ben de teşekkür ederim, çok yardımcı oldun 🙏',
          minutesAgo: 5,
          isRead: true,
          context: 'DM',
        },
      ],
    },
    // Ömer <-> Trust User 2
    {
      userOneId: TEST_USER_ID,
      userTwoId: TRUST_USER_IDS[1],
      unreadCountUserOne: 0,
      unreadCountUserTwo: 1,
      isSupportThread: false,
      messages: [
        {
          senderId: TEST_USER_ID,
          message: 'Merhaba! Ürün hakkında birkaç sorum var.',
          minutesAgo: 20,
          isRead: true,
          context: 'DM',
        },
        {
          senderId: TRUST_USER_IDS[1],
          message: 'Tabii, nasıl yardımcı olabilirim?',
          minutesAgo: 15,
          isRead: false,
          context: 'DM',
        },
      ],
    },
    // Ömer <-> Trust User 3
    {
      userOneId: TRUST_USER_IDS[2],
      userTwoId: TEST_USER_ID,
      unreadCountUserOne: 0,
      unreadCountUserTwo: 0,
      isSupportThread: false,
      messages: [
        {
          senderId: TRUST_USER_IDS[2],
          message: 'Yeni yazdığın post çok faydalı olmuş!',
          minutesAgo: 60,
          isRead: true,
          context: 'DM',
        },
        {
          senderId: TEST_USER_ID,
          message: 'Teşekkür ederim, beğenmene sevindim 😊',
          minutesAgo: 55,
          isRead: true,
          context: 'DM',
        },
      ],
    },
    // Ömer <-> Truster User 1
    {
      userOneId: TEST_USER_ID,
      userTwoId: TRUSTER_USER_IDS[0],
      unreadCountUserOne: 1,
      unreadCountUserTwo: 0,
      isSupportThread: false,
      messages: [
        {
          senderId: TRUSTER_USER_IDS[0],
          message: 'Selamlar! Bir konuda danışmak istiyorum.',
          minutesAgo: 25,
          isRead: true,
          context: 'DM',
        },
        {
          senderId: TEST_USER_ID,
          message: 'Tabii, dinliyorum.',
          minutesAgo: 20,
          isRead: true,
          context: 'DM',
        },
        {
          senderId: TRUSTER_USER_IDS[0],
          message: 'Yeni bir ürün almayı düşünüyorum, önerin var mı?',
          minutesAgo: 5,
          isRead: false,
          context: 'DM',
        },
      ],
    },
    // Ömer <-> Julia Havk
    {
      userOneId: TEST_USER_ID,
      userTwoId: JULIA_USER_ID,
      unreadCountUserOne: 0,
      unreadCountUserTwo: 1,
      isSupportThread: false,
      messages: [
        {
          senderId: JULIA_USER_ID,
          message: 'Hi! I saw your latest review, great work!',
          minutesAgo: 35,
          isRead: true,
          context: 'DM',
        },
        {
          senderId: TEST_USER_ID,
          message: 'Thank you! I appreciate your feedback.',
          minutesAgo: 30,
          isRead: true,
          context: 'DM',
        },
        {
          senderId: JULIA_USER_ID,
          message: 'Would you like to collaborate on a product comparison?',
          minutesAgo: 8,
          isRead: false,
          context: 'DM',
        },
      ],
    },
  ];

  function minutesAgoToDate(minutesAgo: number): Date {
    return new Date(Date.now() - minutesAgo * 60 * 1000);
  }

  let dmThreadsCount = 0;
  let dmMessagesCount = 0;
  const threadMap = new Map<string, string>();

  // Create normal DM threads (not support threads)
  for (const threadSeed of NORMAL_DM_THREAD_SEEDS) {
    // Delete existing thread and messages first
    const existingThread = await prisma.dMThread.findFirst({
      where: {
        userOneId: threadSeed.userOneId,
        userTwoId: threadSeed.userTwoId,
        isSupportThread: false as any,
      } as any,
    });
    
    if (existingThread) {
      await prisma.dMMessage.deleteMany({ where: { threadId: existingThread.id } });
      await prisma.dMThread.delete({ where: { id: existingThread.id } });
    }
    
    const thread = await prisma.dMThread.create({
      data: {
        userOneId: threadSeed.userOneId,
        userTwoId: threadSeed.userTwoId,
        isActive: true,
        isSupportThread: false as any,
        unreadCountUserOne: threadSeed.unreadCountUserOne,
        unreadCountUserTwo: threadSeed.unreadCountUserTwo,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    });
    threadMap.set(`${threadSeed.userOneId}:${threadSeed.userTwoId}`, thread.id);
    dmThreadsCount++;

    if (threadSeed.messages.length > 0) {
      const data = threadSeed.messages.map((msg) => ({
        threadId: thread.id,
        senderId: msg.senderId,
        message: msg.message,
        isRead: msg.isRead,
        context: msg.context || 'DM',
        sentAt: minutesAgoToDate(msg.minutesAgo),
      }));
      
      const batchResult = await prisma.dMMessage.createMany({ data } as any);
      dmMessagesCount += batchResult.count;
    }
  }

  console.log(`✅ ${dmThreadsCount} DM threads and ${dmMessagesCount} messages created`)

  // 7. DM Requests (Support Requests)
  progress.increment('DM request\'leri oluşturuluyor...')
  console.log('\n💌 Creating DM requests (support requests)...')

  type SupportRequestSeed = {
    id: string;
    fromUserId: string;
    toUserId: string;
    description: string;
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELED' | 'AWAITING_COMPLETION' | 'COMPLETED';
    type: 'GENERAL' | 'TECHNICAL' | 'PRODUCT';
    amount: number;
    minutesAgo: number;
    threadId: null;
  };

  // Gerçek kullanıcılar arasında farklı status ve type'larda 1-on-1 request'ler
  // Ömer (TEST_USER_ID) ile diğer gerçek kullanıcılar arasında
  const SUPPORT_REQUEST_SEEDS: SupportRequestSeed[] = [
    // PENDING - General type
    {
      id: '00000000-0000-4000-8000-000000000101',
      fromUserId: TARGET_USER_ID,
      toUserId: TEST_USER_ID,
      description: 'Beta paneldeki yeni metrikler için rehberlik rica ediyorum.',
      status: 'PENDING',
      type: 'GENERAL',
      amount: 50,
      minutesAgo: 60,
      threadId: null,
    },
    // ACCEPTED - Technical type (support thread oluşturulacak)
    {
      id: '00000000-0000-4000-8000-000000000102',
      fromUserId: TEST_USER_ID,
      toUserId: TARGET_USER_ID,
      description: 'Smartwatch kurulumu için yardıma ihtiyacım var. Hangi modeli kullanıyorsunuz?',
      status: 'ACCEPTED',
      type: 'TECHNICAL',
      amount: 100,
      minutesAgo: 120,
      threadId: null,
    },
    // DECLINED - Product type
    {
      id: '00000000-0000-4000-8000-000000000103',
      fromUserId: TRUST_USER_IDS[0],
      toUserId: TEST_USER_ID,
      description: 'Ürün önerisi için destek istiyorum.',
      status: 'DECLINED',
      type: 'PRODUCT',
      amount: 75,
      minutesAgo: 180,
      threadId: null,
    },
    // ACCEPTED - General type (support thread oluşturulacak)
    {
      id: '00000000-0000-4000-8000-000000000104',
      fromUserId: TRUST_USER_IDS[1],
      toUserId: TEST_USER_ID,
      description: 'Yazılım geliştirme konusunda danışmanlık almak istiyorum.',
      status: 'ACCEPTED',
      type: 'GENERAL',
      amount: 150,
      minutesAgo: 90,
      threadId: null,
    },
    // CANCELED - Technical type
    {
      id: '00000000-0000-4000-8000-000000000105',
      fromUserId: TEST_USER_ID,
      toUserId: TRUST_USER_IDS[2],
      description: 'Kamera ayarları konusunda yardım istiyordum ama artık gerek yok.',
      status: 'CANCELED',
      type: 'TECHNICAL',
      amount: 80,
      minutesAgo: 200,
      threadId: null,
    },
    // AWAITING_COMPLETION - Product type (support thread oluşturulacak)
    {
      id: '00000000-0000-4000-8000-000000000106',
      fromUserId: TRUST_USER_IDS[3],
      toUserId: TEST_USER_ID,
      description: 'Yeni telefon modeli hakkında detaylı bilgi almak istiyorum.',
      status: 'AWAITING_COMPLETION',
      type: 'PRODUCT',
      amount: 120,
      minutesAgo: 45,
      threadId: null,
    },
    // COMPLETED - General type (support thread oluşturulacak)
    {
      id: '00000000-0000-4000-8000-000000000107',
      fromUserId: TRUSTER_USER_IDS[0],
      toUserId: TEST_USER_ID,
      description: 'Ürün karşılaştırması konusunda danışmanlık aldım, çok faydalı oldu.',
      status: 'COMPLETED',
      type: 'GENERAL',
      amount: 200,
      minutesAgo: 300,
      threadId: null,
    },
    // PENDING - Product type
    {
      id: '00000000-0000-4000-8000-000000000108',
      fromUserId: TEST_USER_ID,
      toUserId: TRUST_USER_IDS[4],
      description: 'Yeni bir ürün almayı düşünüyorum, önerin var mı?',
      status: 'PENDING',
      type: 'PRODUCT',
      amount: 60,
      minutesAgo: 15,
      threadId: null,
    },
    // ACCEPTED - Technical type (support thread oluşturulacak)
    {
      id: '00000000-0000-4000-8000-000000000109',
      fromUserId: TRUSTER_USER_IDS[1],
      toUserId: TEST_USER_ID,
      description: 'Bilgisayar performans optimizasyonu konusunda yardıma ihtiyacım var.',
      status: 'ACCEPTED',
      type: 'TECHNICAL',
      amount: 180,
      minutesAgo: 70,
      threadId: null,
    },
    // DECLINED - General type
    {
      id: '00000000-0000-4000-8000-000000000110',
      fromUserId: TEST_USER_ID,
      toUserId: TRUSTER_USER_IDS[2],
      description: 'Genel bir soru sormak istiyordum.',
      status: 'DECLINED',
      type: 'GENERAL',
      amount: 40,
      minutesAgo: 250,
      threadId: null,
    },
    // PENDING - Technical type
    {
      id: '00000000-0000-4000-8000-000000000111',
      fromUserId: JULIA_USER_ID,
      toUserId: TEST_USER_ID,
      description: 'I need help with setting up a new device. Can you assist?',
      status: 'PENDING',
      type: 'TECHNICAL',
      amount: 90,
      minutesAgo: 30,
      threadId: null,
    },
  ];

  let supportRequestsCount = 0;
  let supportThreadsCount = 0;
  let supportMessagesCount = 0;
  
  for (const supportRequest of SUPPORT_REQUEST_SEEDS) {
    // Delete existing request if exists
    await prisma.dMRequest.deleteMany({ where: { id: supportRequest.id } });
    
    let threadId: string | null = null;
    
    // If status is ACCEPTED, AWAITING_COMPLETION, or COMPLETED, create a support thread
    const shouldCreateSupportThread = 
      supportRequest.status === 'ACCEPTED' || 
      supportRequest.status === 'AWAITING_COMPLETION' || 
      supportRequest.status === 'COMPLETED';
    
    if (shouldCreateSupportThread) {
      const supportThread = await prisma.dMThread.create({
        data: {
          userOneId: supportRequest.fromUserId,
          userTwoId: supportRequest.toUserId,
          isActive: true,
          isSupportThread: true as any,
          startedAt: minutesAgoToDate(supportRequest.minutesAgo),
          createdAt: minutesAgoToDate(supportRequest.minutesAgo),
          updatedAt: minutesAgoToDate(supportRequest.minutesAgo),
        } as any,
      });
      threadId = supportThread.id;
      supportThreadsCount++;
      
      // Create support chat messages in the support thread
      const messages: Array<{
        threadId: string;
        senderId: string;
        message: string;
        isRead: boolean;
        context: 'SUPPORT';
        sentAt: Date;
      }> = [
        {
          threadId: supportThread.id,
          senderId: supportRequest.fromUserId,
          message: supportRequest.description,
          isRead: false,
          context: 'SUPPORT',
          sentAt: minutesAgoToDate(supportRequest.minutesAgo),
        },
        {
          threadId: supportThread.id,
          senderId: supportRequest.toUserId,
          message: 'Merhaba! Size nasıl yardımcı olabilirim?',
          isRead: true,
          context: 'SUPPORT',
          sentAt: minutesAgoToDate(supportRequest.minutesAgo - 5),
        },
      ];

      // Add more messages based on status
      if (supportRequest.status === 'ACCEPTED') {
        messages.push({
          threadId: supportThread.id,
          senderId: supportRequest.fromUserId,
          message: 'Teşekkür ederim, detayları paylaşayım...',
          isRead: true,
          context: 'SUPPORT',
          sentAt: minutesAgoToDate(supportRequest.minutesAgo - 3),
        });
      } else if (supportRequest.status === 'AWAITING_COMPLETION') {
        messages.push(
          {
            threadId: supportThread.id,
            senderId: supportRequest.fromUserId,
            message: 'Teşekkür ederim, detayları paylaşayım...',
            isRead: true,
            context: 'SUPPORT',
            sentAt: minutesAgoToDate(supportRequest.minutesAgo - 3),
          },
          {
            threadId: supportThread.id,
            senderId: supportRequest.toUserId,
            message: 'Anladım, şimdi çözümü uygulayalım.',
            isRead: true,
            context: 'SUPPORT',
            sentAt: minutesAgoToDate(supportRequest.minutesAgo - 2),
          }
        );
      } else if (supportRequest.status === 'COMPLETED') {
        messages.push(
          {
            threadId: supportThread.id,
            senderId: supportRequest.fromUserId,
            message: 'Teşekkür ederim, detayları paylaşayım...',
            isRead: true,
            context: 'SUPPORT',
            sentAt: minutesAgoToDate(supportRequest.minutesAgo - 3),
          },
          {
            threadId: supportThread.id,
            senderId: supportRequest.toUserId,
            message: 'Rica ederim, başka bir konuda yardımcı olabilir miyim?',
            isRead: true,
            context: 'SUPPORT',
            sentAt: minutesAgoToDate(supportRequest.minutesAgo - 2),
          },
          {
            threadId: supportThread.id,
            senderId: supportRequest.fromUserId,
            message: 'Hayır teşekkürler, her şey tamamlandı!',
            isRead: true,
            context: 'SUPPORT',
            sentAt: minutesAgoToDate(supportRequest.minutesAgo - 1),
          }
        );
      }
      
      const supportMessages = await prisma.dMMessage.createMany({
        data: messages as any,
      });
      supportMessagesCount += supportMessages.count;
    }
    
    // Create the support request
    await prisma.dMRequest.create({
      data: {
        id: supportRequest.id,
        fromUserId: supportRequest.fromUserId,
        toUserId: supportRequest.toUserId,
        description: supportRequest.description,
        status: supportRequest.status as any,
        type: supportRequest.type,
        amount: supportRequest.amount,
        threadId: threadId,
        sentAt: minutesAgoToDate(supportRequest.minutesAgo),
        respondedAt: supportRequest.status !== 'PENDING' && supportRequest.status !== 'CANCELED' 
          ? minutesAgoToDate(supportRequest.minutesAgo - 10) 
          : null,
        createdAt: minutesAgoToDate(supportRequest.minutesAgo),
        updatedAt: minutesAgoToDate(supportRequest.minutesAgo),
      } as any,
    });
    supportRequestsCount++;
  }

  console.log(`✅ ${supportRequestsCount} support requests, ${supportThreadsCount} support threads, and ${supportMessagesCount} support messages created`)

  console.log('💸 Creating tips token transfers...')
  await prisma.tipsTokenTransfer.deleteMany({
    where: {
      OR: [
        { fromUserId: TEST_USER_ID },
        { toUserId: TEST_USER_ID },
      ],
    },
  })

  // Gerçek kullanıcılar arasında TIPS transfer'leri
  const tipsTransferSeeds = [
    {
      id: '00000000-0000-4000-8000-000000000201',
      fromUserId: TEST_USER_ID,
      toUserId: TARGET_USER_ID,
      amount: 25,
      reason: 'Geçen destek oturumu için teşekkürler!',
      minutesAgo: 15,
    },
    {
      id: '00000000-0000-4000-8000-000000000202',
      fromUserId: TRUST_USER_IDS[0],
      toUserId: TEST_USER_ID,
      amount: 50,
      reason: 'Yardımın için teşekkürler!',
      minutesAgo: 20,
    },
    {
      id: '00000000-0000-4000-8000-000000000203',
      fromUserId: TEST_USER_ID,
      toUserId: TRUST_USER_IDS[1],
      amount: 30,
      reason: 'Ürün önerisi için teşekkürler',
      minutesAgo: 40,
    },
    {
      id: '00000000-0000-4000-8000-000000000204',
      fromUserId: TRUSTER_USER_IDS[0],
      toUserId: TEST_USER_ID,
      amount: 75,
      reason: 'Danışmanlık için teşekkürler',
      minutesAgo: 50,
    },
    {
      id: '00000000-0000-4000-8000-000000000205',
      fromUserId: TEST_USER_ID,
      toUserId: JULIA_USER_ID,
      amount: 100,
      reason: 'Great collaboration!',
      minutesAgo: 25,
    },
  ]

  for (const tipsSeed of tipsTransferSeeds) {
    const createdAt = minutesAgoToDate(tipsSeed.minutesAgo)
    await prisma.tipsTokenTransfer.upsert({
      where: { id: tipsSeed.id },
      update: {
        amount: tipsSeed.amount,
        reason: tipsSeed.reason,
        updatedAt: new Date(),
      },
      create: {
        id: tipsSeed.id,
        fromUserId: tipsSeed.fromUserId,
        toUserId: tipsSeed.toUserId,
        amount: tipsSeed.amount,
        reason: tipsSeed.reason,
        createdAt,
        updatedAt: createdAt,
      } as any,
    })
  }
  console.log(`✅ ${tipsTransferSeeds.length} tips transfers created`)

  await prisma.profile.updateMany({
    where: { bannerUrl: null },
    data: { bannerUrl: DEFAULT_BANNER_URL },
  });

  // Brand Products & Experiences & News Seed
  console.log('🏷️ Creating brand products, experiences & news...')
  progress.increment('Brand product\'lar oluşturuluyor...')
  try {
    console.log('📦 Brand products seed başlatılıyor...')
    await seedBrandProducts(userIdToUse)
    console.log('✅ Brand products seeding completed')
  } catch (error) {
    console.error('❌ Brand products seed hatası:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
    throw error
  }

  // Apple brand'ı için product görsellerini güncelle
  console.log('🍎 Updating Apple brand product images...')
  try {
    const APPLE_BRAND_ID = '081d5660-a6d6-412a-b0ae-1557acaaa028'
    const appleBrand = await prisma.brand.findUnique({ where: { id: APPLE_BRAND_ID } })
    if (appleBrand) {
      const appleProducts = await prisma.product.findMany({
        where: { brand: appleBrand.name },
      })
      let updated = 0
      for (const product of appleProducts) {
        const imageKey = getProductImageKey(product.name, product.brand || undefined)
        if (imageKey) {
          try {
            const imagePath = getSeedMediaPath(imageKey, true)
            if (imagePath && product.imageUrl !== imagePath) {
              await prisma.product.update({
                where: { id: product.id },
                data: { imageUrl: imagePath },
              })
              updated++
            }
          } catch (error: any) {
            console.warn(`  ⚠️  ${product.name}: ${error.message}`)
          }
        }
      }
      console.log(`✅ ${updated} Apple product images updated`)
    } else {
      console.warn(`⚠️  Apple brand (${APPLE_BRAND_ID}) not found`)
    }
  } catch (error) {
    console.error('❌ Apple product images update error:', error)
    // Hata olsa bile devam et
  }

  // Tüm product'lar için inventory media ekle (explore/products/new için)
  console.log('🖼️ Adding inventory media for all products...')
  try {
    console.log('📸 Product görselleri yükleme başlatılıyor...')
    await ensureProductImages(userIdToUse)
    console.log('✅ Product images ensured')
  } catch (error) {
    console.error('❌ Product görselleri yükleme hatası:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
    throw error
  }

  // ===== BRAND EXPERIENCES BOOST (SPECIFIC BRAND) =====
  // Belirli bir brand için (ID: 8386190d-39ad-4f55-b994-84a753eacacf) tüm product'larda
  // /brands/{brandId}/products/{productId}/experiences endpoint'ine en az 10 FREE deneyim post'u üret
  console.log('📝 Ensuring at least 10 FREE experience posts for specific brand products...')
  const TARGET_BRAND_ID_FOR_EXPERIENCES = '8386190d-39ad-4f55-b994-84a753eacacf'

  const targetBrand = await prisma.brand.findUnique({
    where: { id: TARGET_BRAND_ID_FOR_EXPERIENCES },
  })

  if (!targetBrand) {
    console.warn(`⚠️ Brand not found for experiences boost (id: ${TARGET_BRAND_ID_FOR_EXPERIENCES})`)
  } else {
    const targetBrandName = targetBrand.name
    console.log(`✅ Experiences boost for brand: ${targetBrandName} (${targetBrand.id})`)

    // Bu brand'e ait tüm product'ları bul (Product.brand alanı isim tutuyor)
    const brandProducts = await prisma.product.findMany({
      where: { brand: targetBrandName },
      orderBy: { createdAt: 'asc' },
    })

    console.log(`  📦 Found ${brandProducts.length} products for brand ${targetBrandName}`)

    for (const product of brandProducts) {
      // Mevcut FREE deneyim post sayısını kontrol et
      const existingExperiences = await prisma.contentPost.findMany({
        where: {
          productId: product.id,
          type: 'FREE',
        },
      })

      const existingCount = existingExperiences.length
      const minRequired = 10

      if (existingCount >= minRequired) {
        console.log(`  ✅ Product "${product.name}" already has ${existingCount} FREE experiences (>= ${minRequired})`)
        continue
      }

      const toCreate = minRequired - existingCount
      console.log(`  ✏️  Creating ${toCreate} additional FREE experiences for product "${product.name}"`)

      const experienceTemplates = [
        ` I tested ${product.name} in detail during everyday use. Its performance and durability genuinely surprised me.`,
        ` My first week with ${product.name}: I shared my setup experience and the most notable pros and cons.`,
        ` A long-term ownership review of ${product.name}. In which scenarios does it shine, and where does it struggle?`,
        ` I made a price/performance evaluation for ${product.name}, including a short comparison with competitors in the same segment.`,
        ` I wrote down my observations on the accessories that come with ${product.name} and how they affect my daily routine.`,
      ]

      for (let i = 0; i < toCreate; i++) {
        const templateBody = experienceTemplates[i % experienceTemplates.length]
        const title = `${product.name} ile Deneyim Notları #${existingCount + i + 1}`

        const post = await createOrGetContentPost({
          userId: userIdToUse,
          type: 'FREE',
          title,
          body: `${templateBody} (Brand: ${targetBrandName})`,
          productId: product.id,
          inventoryRequired: false,
          isBoosted: (existingCount + i) % 3 === 0,
          createdAt: daysAgo(randomBetween(3, 45)),
        }).catch(() => null)
        
        if (!post) continue
        const experiencePostId = post.id

        // Basit istatistikler ekle (0'dan büyük değerler)
        const likes = randomBetween(3, 40)
        const comments = randomBetween(1, 12)
        const shares = randomBetween(0, 8)
        const bookmarks = randomBetween(1, 15)

        await prisma.contentPost.update({
          where: { id: experiencePostId },
          data: {
            likesCount: likes,
            commentsCount: comments,
            sharesCount: shares,
            favoritesCount: bookmarks,
            viewsCount: likes * randomBetween(5, 12) + randomBetween(20, 100),
          },
        }).catch(() => {})
      }

      console.log(`  ✅ Ensured ${minRequired} FREE experiences for product "${product.name}"`)
    }
  }

  // ===== COMPREHENSIVE BRAND SEEDING BY CATEGORY =====
  // Tüm kategorileri sırayla işle, brand'leri listele, follower ekle ve product seed data ekle
  console.log('\n🏷️ Starting comprehensive brand seeding by category...')
  
  // Kullanıcıları al (follower eklemek için)
  const allUsersForCategorySeeding = await prisma.user.findMany({
    select: { id: true },
  })
  
  // Özel brand ve kategori ID'leri
  const TARGET_CATEGORY_ID = '14caee2d-5714-4de1-9f57-8bf5f3f4ec73'
  const TARGET_BRAND_ID = 'e5c57b8e-b4ac-4de8-a12a-4d1724f8099b'
  
  if (allUsersForCategorySeeding.length === 0) {
    console.warn('⚠️ No users found for category-based brand seeding')
  } else {
    const allCategories = await prisma.brandCategory.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
      },
    })
    
    console.log(`📋 Found ${allCategories.length} brand categories to process`)
    
    for (let catIndex = 0; catIndex < allCategories.length; catIndex++) {
      const category = allCategories[catIndex]
      console.log(`\n📂 [${catIndex + 1}/${allCategories.length}] Processing category: ${category.name} (${category.id})`)
      
      // 1. Bu kategoriye ait brand'leri listele
      const categoryBrands = await prisma.brand.findMany({
        where: { categoryId: category.id },
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: 'asc' },
      })
      
      console.log(`  📦 Found ${categoryBrands.length} brands in category "${category.name}"`)
      
      if (categoryBrands.length === 0) {
        console.log(`  ⚠️  No brands found for category "${category.name}", skipping...`)
        continue
      }
      
      // 2. Her brand için follower sayılarını güncelle
      for (let brandIndex = 0; brandIndex < categoryBrands.length; brandIndex++) {
        const brand = categoryBrands[brandIndex]
        console.log(`  \n  🏢 [${brandIndex + 1}/${categoryBrands.length}] Processing brand: ${brand.name} (${brand.id})`)
        
        // Mevcut follower sayısını kontrol et
        const existingFollowersCount = await prisma.bridgeFollower.count({
          where: { brandId: brand.id },
        })
        
        // Özel brand için 30-50 arası, diğerleri için 30-70 arası
        const isTargetBrand = brand.id === TARGET_BRAND_ID && category.id === TARGET_CATEGORY_ID
        const targetFollowerCount = isTargetBrand ? randomBetween(30, 50) : randomBetween(30, 70)
        
        if (isTargetBrand) {
          console.log(`    🎯 Target brand detected! Setting follower count to 30-50 range`)
        }
        
        if (existingFollowersCount < targetFollowerCount) {
          const followersToAdd = targetFollowerCount - existingFollowersCount
          console.log(`    👥 Adding ${followersToAdd} followers (current: ${existingFollowersCount}, target: ${targetFollowerCount})`)
          
          // Rastgele kullanıcılar seç
          const shuffledUsers = [...allUsersForCategorySeeding].sort(() => Math.random() - 0.5)
          const selectedUsers = shuffledUsers.slice(0, Math.min(followersToAdd, allUsersForCategorySeeding.length))
        
        let addedCount = 0
        for (const user of selectedUsers) {
          try {
            const existing = await prisma.bridgeFollower.findUnique({
              where: {
                userId_brandId: {
                  userId: user.id,
                  brandId: brand.id,
                },
              },
            })
            
            if (!existing) {
              await prisma.bridgeFollower.create({
                data: {
                  userId: user.id,
                  brandId: brand.id,
                  followedAt: daysAgo(randomBetween(1, 90)),
                },
              })
              addedCount++
            }
          } catch (error) {
            // Duplicate veya başka bir hata - devam et
          }
        }
        
        const finalCount = await prisma.bridgeFollower.count({
          where: { brandId: brand.id },
        })
        console.log(`    ✅ Added ${addedCount} followers, total: ${finalCount}`)
      } else {
        console.log(`    ✅ Brand already has ${existingFollowersCount} followers (>= ${targetFollowerCount})`)
      }
      
      // 3. Bu brand'in product'larını bul
      const brandProducts = await prisma.product.findMany({
        where: { brand: brand.name },
        include: {
          group: {
            include: {
              subCategory: {
                include: {
                  mainCategory: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      })
      
      console.log(`    📦 Found ${brandProducts.length} products for brand "${brand.name}"`)
      
      if (brandProducts.length === 0) {
        console.log(`    ⚠️  No products found for brand "${brand.name}", skipping product seeding...`)
        continue
      }
      
      // 4. Her product için experiences, comparisons ve news seed data ekle
      // Electronics ve Cosmetics için 20 post, diğerleri için 5 post
      const isTestCategory = category.name === 'Electronics' || category.name === 'Beauty'
      const totalPostsPerProduct = isTestCategory ? 20 : 5
      
      for (let prodIndex = 0; prodIndex < brandProducts.length; prodIndex++) {
        const product = brandProducts[prodIndex]
        // Category ID'lerini product'tan veya group üzerinden al
        const mainCategoryId = product.group?.subCategory?.mainCategory?.id || null
        const subCategoryId = product.group?.subCategoryId || null
        
        if (!mainCategoryId || !subCategoryId) {
          console.log(`      ⚠️  Product "${product.name}" missing category info, skipping...`)
          continue
        }
        
        console.log(`      \n      📱 [${prodIndex + 1}/${brandProducts.length}] Processing product: ${product.name} (${product.id})`)
        console.log(`        📊 Target: ${totalPostsPerProduct} posts per product (${isTestCategory ? 'Test Category' : 'Other Category'})`)
        
        // Post type dağılımı: Electronics/Cosmetics için 20, diğerleri için 5
        const postDistribution = isTestCategory
          ? { EXPERIENCE: 6, COMPARE: 3, UPDATE: 4, QUESTION: 3, TIPS: 2, FREE: 2 }
          : { EXPERIENCE: 2, COMPARE: 1, UPDATE: 1, QUESTION: 1 }
        
        // EXPERIENCES
        const targetExperiences = postDistribution.EXPERIENCE
        const existingExperiences = await prisma.contentPost.count({
          where: {
            productId: product.id,
            type: 'EXPERIENCE',
          },
        })
        
        if (existingExperiences < targetExperiences) {
          const toCreate = targetExperiences - existingExperiences
          console.log(`        ✏️  Creating ${toCreate} EXPERIENCE posts...`)
          
          const experienceTemplates = [
            `I tested ${product.name} in detail during everyday use. Its performance and durability genuinely surprised me.`,
            `My first week with ${product.name}: I shared my setup experience and the most notable pros and cons.`,
            `A long-term ownership review of ${product.name}. In which scenarios does it shine, and where does it struggle?`,
            `I made a price/performance evaluation for ${product.name}, including a short comparison with competitors in the same segment.`,
            `I wrote down my observations on the accessories that come with ${product.name} and how they affect my daily routine.`,
            `Sharing my daily workflow with ${product.name} focusing on practical usage scenarios.`,
            `After months of use, here's my honest review of ${product.name} covering build quality and reliability.`,
            `Testing ${product.name} in different environments and sharing the results.`,
          ]
          
          for (let i = 0; i < toCreate; i++) {
            const templateBody = experienceTemplates[i % experienceTemplates.length]
            const title = `${product.name} Deneyim Paylaşımı #${existingExperiences + i + 1}`
            
            const post = await createOrGetContentPost({
              userId: userIdToUse,
              type: 'EXPERIENCE',
              title,
              body: templateBody,
              productId: product.id,
              mainCategoryId,
              subCategoryId,
              inventoryRequired: true,
              isBoosted: (existingExperiences + i) % 3 === 0,
              createdAt: daysAgo(randomBetween(1, 60)),
            }).catch(() => null)
            
            if (!post) continue
            const experiencePostId = post.id
            
            // Post tag'leri ekle (max 2-3 tag)
            await prisma.contentPostTag.createMany({
              data: [
                { postId: experiencePostId, tag: brand.name },
                { postId: experiencePostId, tag: 'Deneyim' },
              ],
              skipDuplicates: true,
            }).catch(() => {})
          }
          
          console.log(`        ✅ Created ${toCreate} EXPERIENCE posts for "${product.name}"`)
        } else {
          console.log(`        ✅ Product already has ${existingExperiences} EXPERIENCE posts (>= ${targetExperiences})`)
        }
        
        // COMPARISONS
        const targetComparisons = postDistribution.COMPARE || 0
        const existingComparisons = await prisma.contentPost.count({
          where: {
            productId: product.id,
            type: 'COMPARE',
          },
        })
        
        // Partner product bul (aynı brand'den başka bir product)
        const partnerProduct = brandProducts.find((p) => p.id !== product.id) || null
        
        if (partnerProduct && existingComparisons < targetComparisons) {
          const toCreate = targetComparisons - existingComparisons
          console.log(`        ⚖️  Creating ${toCreate} COMPARE posts...`)
          
          const comparisonTemplates = [
            `Side-by-side comparison between ${product.name} and ${partnerProduct.name} focused on performance and features.`,
            `Detailed comparison: ${product.name} vs ${partnerProduct.name} in real-world usage scenarios.`,
            `Which one to choose? ${product.name} or ${partnerProduct.name} - A comprehensive comparison.`,
          ]
          
          for (let i = 0; i < toCreate; i++) {
            const templateBody = comparisonTemplates[i % comparisonTemplates.length]
            const title = `${product.name} vs ${partnerProduct.name} Karşılaştırma #${existingComparisons + i + 1}`
            
            const post = await createOrGetContentPost({
              userId: userIdToUse,
              type: 'COMPARE',
              title,
              body: templateBody,
              productId: product.id,
              mainCategoryId,
              subCategoryId,
              inventoryRequired: false,
              isBoosted: (existingComparisons + i) % 4 === 0,
              createdAt: daysAgo(randomBetween(1, 45)),
            }).catch(() => null)
            
            if (!post) continue
            const comparePostId = post.id
            
            // Comparison relation ekle - Duplicate kontrolü: post_id unique constraint
            const existingComparison = await prisma.postComparison.findFirst({
              where: { postId: comparePostId }
            });
            if (!existingComparison) {
              await prisma.postComparison.create({
                data: {
                  postId: comparePostId,
                  product1Id: product.id,
                  product2Id: partnerProduct.id,
                  comparisonSummary: `Practical comparison between ${product.name} and ${partnerProduct.name} for everyday use.`,
                },
              }).catch(() => {})
            }
            
            // Post tag'leri ekle
            await prisma.contentPostTag.createMany({
              data: [
                { postId: comparePostId, tag: brand.name },
                { postId: comparePostId, tag: 'Karşılaştırma' },
              ],
              skipDuplicates: true,
            }).catch(() => {})
          }
          
          console.log(`        ✅ Created ${toCreate} COMPARE posts for "${product.name}"`)
        } else if (!partnerProduct) {
          console.log(`        ⚠️  No partner product found for comparisons, skipping...`)
        } else {
          console.log(`        ✅ Product already has ${existingComparisons} COMPARE posts (>= ${targetComparisons})`)
        }
        
        // NEWS (UPDATE)
        const targetNews = postDistribution.UPDATE || 0
        const existingNews = await prisma.contentPost.count({
          where: {
            productId: product.id,
            type: 'UPDATE',
          },
        })
        
        if (existingNews < targetNews) {
          const toCreate = targetNews - existingNews
          console.log(`        📰 Creating ${toCreate} UPDATE news posts...`)
          
          const newsTemplates = [
            `New firmware update for ${product.name} improves performance and adds new features.`,
            `Limited edition version of ${product.name} is now available with enhanced specifications.`,
            `${brand.name} announced a new accessory line compatible with ${product.name}.`,
            `Software update for ${product.name} brings improved user experience and bug fixes.`,
            `New color options available for ${product.name} starting this month.`,
          ]
          
          for (let i = 0; i < toCreate; i++) {
            const templateBody = newsTemplates[i % newsTemplates.length]
            const title = `${brand.name} Haberleri - ${product.name} #${existingNews + i + 1}`
            
            const post = await createOrGetContentPost({
              userId: userIdToUse,
              type: 'UPDATE',
              title,
              body: templateBody,
              productId: product.id,
              mainCategoryId,
              subCategoryId,
              inventoryRequired: false,
              isBoosted: (existingNews + i) % 5 === 0,
              createdAt: daysAgo(randomBetween(1, 30)),
            }).catch(() => null)
            
            if (!post) continue
            const newsPostId = post.id
            
            // Post tag'leri ekle
            await prisma.contentPostTag.createMany({
              data: [
                { postId: newsPostId, tag: brand.name },
                { postId: newsPostId, tag: 'Haberler' },
              ],
              skipDuplicates: true,
            }).catch(() => {})
          }
          
          console.log(`        ✅ Created ${toCreate} UPDATE news posts for "${product.name}"`)
        } else {
          console.log(`        ✅ Product already has ${existingNews} UPDATE news posts (>= ${targetNews})`)
        }

        // QUESTION posts (sadece test kategorileri için)
        if (postDistribution.QUESTION) {
          const targetQuestions = postDistribution.QUESTION
          const existingQuestions = await prisma.contentPost.count({
            where: {
              productId: product.id,
              type: 'QUESTION',
            },
          })
          
          if (existingQuestions < targetQuestions) {
            const toCreate = targetQuestions - existingQuestions
            console.log(`        ❓ Creating ${toCreate} QUESTION posts...`)
            
            const questionTemplates = [
              `What are the main differences between ${product.name} and similar products in the market?`,
              `Is ${product.name} worth the price? Looking for honest opinions.`,
              `Has anyone experienced any issues with ${product.name}? What should I watch out for?`,
              `What accessories work best with ${product.name}?`,
              `How does ${product.name} perform in real-world usage compared to reviews?`,
            ]
            
            for (let i = 0; i < toCreate; i++) {
              const templateBody = questionTemplates[i % questionTemplates.length]
              const title = `Question about ${product.name} #${existingQuestions + i + 1}`
              
              const post = await createOrGetContentPost({
                userId: userIdToUse,
                type: 'QUESTION',
                title,
                body: templateBody,
                productId: product.id,
                mainCategoryId,
                subCategoryId,
                inventoryRequired: false,
                isBoosted: false,
                createdAt: daysAgo(randomBetween(1, 30)),
              }).catch(() => null)
              
              if (!post || !post.id || typeof post.id !== 'string' || post.id.length !== 26) {
                continue;
              }
              const questionPostId = post.id
              
              // PostQuestion relation ekle (duplicate kontrolü ile)
              try {
                const existingQuestion = await prisma.postQuestion.findUnique({
                  where: { postId: questionPostId },
                });
                
                if (!existingQuestion) {
                  await prisma.postQuestion.create({
                    data: {
                      postId: questionPostId,
                      expectedAnswerFormat: 'LONG' as const,
                    },
                  });
                }
              } catch (error: any) {
                // Unique constraint hatası normal (duplicate), diğer hataları logla
                if (error?.code === 'P2002') {
                  // Duplicate, sessizce devam et
                } else if (error?.code === 'P2003') {
                  // Foreign key hatası - post mevcut değil
                  console.warn(`⚠️ PostQuestion için foreign key hatası (postId: ${questionPostId}): Post bulunamadı`);
                } else {
                  // Detaylı hata loglama
                  console.error(`⚠️ PostQuestion oluşturma hatası (postId: ${questionPostId}):`);
                  console.error(`   Code: ${error?.code || 'N/A'}`);
                  console.error(`   Message: ${error?.message || String(error)}`);
                  console.error(`   Meta:`, error?.meta || 'N/A');
                }
              }
              
              // Post tag'leri ekle
              await prisma.contentPostTag.createMany({
                data: [
                  { postId: questionPostId, tag: brand.name },
                  { postId: questionPostId, tag: 'Soru' },
                ],
                skipDuplicates: true,
              }).catch(() => {})
            }
            
            console.log(`        ✅ Created ${toCreate} QUESTION posts for "${product.name}"`)
          } else {
            console.log(`        ✅ Product already has ${existingQuestions} QUESTION posts (>= ${targetQuestions})`)
          }
        }
        
        // TIPS posts (sadece test kategorileri için)
        if (postDistribution.TIPS) {
          const targetTips = postDistribution.TIPS
          const existingTips = await prisma.contentPost.count({
            where: {
              productId: product.id,
              type: 'TIPS',
            },
          })
          
          if (existingTips < targetTips) {
            const toCreate = targetTips - existingTips
            console.log(`        💡 Creating ${toCreate} TIPS posts...`)
            
            const tipsTemplates = [
              `Pro tip: ${product.name} performs best when used in [specific scenario].`,
              `Here's a hidden feature in ${product.name} that most people don't know about.`,
              `To get the most out of ${product.name}, make sure to [specific tip].`,
              `My favorite way to use ${product.name} is [specific use case].`,
            ]
            
            for (let i = 0; i < toCreate; i++) {
              const templateBody = tipsTemplates[i % tipsTemplates.length]
              const title = `Tip for ${product.name} #${existingTips + i + 1}`
              
              const post = await createOrGetContentPost({
                userId: userIdToUse,
                type: 'TIPS',
                title,
                body: templateBody,
                productId: product.id,
                mainCategoryId,
                subCategoryId,
                inventoryRequired: false,
                isBoosted: false,
                createdAt: daysAgo(randomBetween(1, 30)),
              }).catch(() => null)
              
              if (!post || !post.id || typeof post.id !== 'string' || post.id.length !== 26) {
                continue;
              }
              const tipsPostId = post.id
              
              // PostTip relation ekle (duplicate kontrolü ile)
              try {
                const existingTip = await prisma.postTip.findUnique({
                  where: { postId: tipsPostId },
                });
                
                if (!existingTip) {
                  await prisma.postTip.create({
                    data: {
                      postId: tipsPostId,
                      tipCategory: 'USAGE' as const,
                      isVerified: false,
                    },
                  });
                }
              } catch (error: any) {
                // Unique constraint hatası normal (duplicate), diğer hataları logla
                if (error?.code === 'P2002') {
                  // Duplicate, sessizce devam et
                } else if (error?.code === 'P2003') {
                  // Foreign key hatası - post mevcut değil
                  console.warn(`⚠️ PostTip için foreign key hatası (postId: ${tipsPostId}): Post bulunamadı`);
                } else {
                  // Detaylı hata loglama
                  console.error(`⚠️ PostTip oluşturma hatası (postId: ${tipsPostId}):`);
                  console.error(`   Code: ${error?.code || 'N/A'}`);
                  console.error(`   Message: ${error?.message || String(error)}`);
                  console.error(`   Meta:`, error?.meta || 'N/A');
                }
              }
              
              // Post tag'leri ekle
              await prisma.contentPostTag.createMany({
                data: [
                  { postId: tipsPostId, tag: brand.name },
                  { postId: tipsPostId, tag: 'İpucu' },
                ],
                skipDuplicates: true,
              }).catch(() => {})
            }
            
            console.log(`        ✅ Created ${toCreate} TIPS posts for "${product.name}"`)
          } else {
            console.log(`        ✅ Product already has ${existingTips} TIPS posts (>= ${targetTips})`)
          }
        }
        
        // FREE posts (sadece test kategorileri için)
        if (postDistribution.FREE) {
          const targetFree = postDistribution.FREE
          const existingFree = await prisma.contentPost.count({
            where: {
              productId: product.id,
              type: 'FREE',
            },
          })
          
          if (existingFree < targetFree) {
            const toCreate = targetFree - existingFree
            console.log(`        🆓 Creating ${toCreate} FREE posts...`)
            
            const freeTemplates = [
              `Free resource: Complete guide to getting started with ${product.name}.`,
              `Free download: ${product.name} setup checklist and optimization tips.`,
              `Free tutorial: How to maximize ${product.name} performance.`,
            ]
            
            for (let i = 0; i < toCreate; i++) {
              const templateBody = freeTemplates[i % freeTemplates.length]
              const title = `Free Resource: ${product.name} #${existingFree + i + 1}`
              
              const post = await createOrGetContentPost({
                userId: userIdToUse,
                type: 'FREE',
                title,
                body: templateBody,
                productId: product.id,
                mainCategoryId,
                subCategoryId,
                inventoryRequired: false,
                isBoosted: false,
                createdAt: daysAgo(randomBetween(1, 30)),
              }).catch(() => null)
              
              if (!post) continue
              const freePostId = post.id
              
              // Post tag'leri ekle
              await prisma.contentPostTag.createMany({
                data: [
                  { postId: freePostId, tag: brand.name },
                  { postId: freePostId, tag: 'Ücretsiz' },
                ],
                skipDuplicates: true,
              }).catch(() => {})
            }
            
            console.log(`        ✅ Created ${toCreate} FREE posts for "${product.name}"`)
          } else {
            console.log(`        ✅ Product already has ${existingFree} FREE posts (>= ${targetFree})`)
          }
        }
      }
      
      console.log(`    ✅ Completed seeding for brand "${brand.name}"`)
    }
    
    console.log(`  ✅ Completed processing category "${category.name}"`)
  }
  }
  
  console.log('\n✨ Comprehensive brand seeding by category completed!')
  
  // ===== SPECIFIC BRAND & PRODUCT EXPERIENCES SEEDING =====
  // Belirli bir brand ve product için experiences seed data ekle
  console.log('\n🎯 Adding experiences for specific brand and product...')
  const AUDIOMAX_BRAND_ID_FOR_EXPERIENCES = 'e5c57b8e-b4ac-4de8-a12a-4d1724f8099b'
  const TARGET_PRODUCT_ID_FOR_EXPERIENCES = '018b6b88-858b-4851-8006-146386a14b63'
  
  const targetBrandForExp = await prisma.brand.findUnique({
    where: { id: AUDIOMAX_BRAND_ID_FOR_EXPERIENCES },
  })
  
  const targetProductForExp = await prisma.product.findUnique({
    where: { id: TARGET_PRODUCT_ID_FOR_EXPERIENCES },
    include: {
      group: {
        include: {
          subCategory: {
            include: {
              mainCategory: true,
            },
          },
        },
      },
    },
  })
  
  if (targetBrandForExp && targetProductForExp) {
    const mainCategoryIdForExp = targetProductForExp.group?.subCategory?.mainCategory?.id || null
    const subCategoryIdForExp = targetProductForExp.group?.subCategoryId || null
    
    if (mainCategoryIdForExp && subCategoryIdForExp) {
      // Mevcut experience sayısını kontrol et
      const existingExpCount = await prisma.contentPost.count({
        where: {
          productId: TARGET_PRODUCT_ID_FOR_EXPERIENCES,
          type: 'EXPERIENCE',
        },
      })
      
      const targetExpCount = 5 // 15'ten 5'e düşürüldü (brand experiences boost)
      
      if (existingExpCount < targetExpCount) {
        const toCreate = targetExpCount - existingExpCount
        console.log(`  ✏️  Creating ${toCreate} EXPERIENCE posts for product "${targetProductForExp.name}" (${TARGET_PRODUCT_ID_FOR_EXPERIENCES})`)
        
        const experienceTemplates = [
          `I tested ${targetProductForExp.name} in detail during everyday use. Its performance and durability genuinely surprised me.`,
          `My first week with ${targetProductForExp.name}: I shared my setup experience and the most notable pros and cons.`,
          `A long-term ownership review of ${targetProductForExp.name}. In which scenarios does it shine, and where does it struggle?`,
          `I made a price/performance evaluation for ${targetProductForExp.name}, including a short comparison with competitors in the same segment.`,
          `I wrote down my observations on the accessories that come with ${targetProductForExp.name} and how they affect my daily routine.`,
          `Sharing my daily workflow with ${targetProductForExp.name} focusing on practical usage scenarios.`,
          `After months of use, here's my honest review of ${targetProductForExp.name} covering build quality and reliability.`,
          `Testing ${targetProductForExp.name} in different environments and sharing the results.`,
          `Detailed analysis of ${targetProductForExp.name} performance metrics and real-world usage patterns.`,
          `Comparing ${targetProductForExp.name} with similar products in the market and sharing my findings.`,
          `Unboxing and initial setup experience with ${targetProductForExp.name} - first impressions matter.`,
          `Long-term durability test results for ${targetProductForExp.name} after extensive use.`,
          `Professional review of ${targetProductForExp.name} focusing on technical specifications and user experience.`,
          `Personal journey with ${targetProductForExp.name} - from purchase to daily integration.`,
          `Comprehensive evaluation of ${targetProductForExp.name} features and their practical applications.`,
        ]
        
        for (let i = 0; i < toCreate; i++) {
          const templateBody = experienceTemplates[i % experienceTemplates.length]
          const title = `${targetProductForExp.name} Deneyim Paylaşımı #${existingExpCount + i + 1}`
          
          const post = await createOrGetContentPost({
            userId: userIdToUse,
            type: 'EXPERIENCE',
            title,
            body: templateBody,
            productId: TARGET_PRODUCT_ID_FOR_EXPERIENCES,
            mainCategoryId: mainCategoryIdForExp,
            subCategoryId: subCategoryIdForExp,
            inventoryRequired: true,
            isBoosted: (existingExpCount + i) % 4 === 0,
            createdAt: daysAgo(randomBetween(1, 60)),
          }).catch(() => null)
          
          if (!post) continue
          const experiencePostId = post.id
          
          // Post tag'leri ekle
          await prisma.contentPostTag.createMany({
            data: [
              { postId: experiencePostId, tag: targetBrandForExp.name },
              { postId: experiencePostId, tag: 'Deneyim' },
            ],
            skipDuplicates: true,
          }).catch(() => {})
        }
        
        const finalExpCount = await prisma.contentPost.count({
          where: {
            productId: TARGET_PRODUCT_ID_FOR_EXPERIENCES,
            type: 'EXPERIENCE',
          },
        })
        
        console.log(`  ✅ Created ${toCreate} EXPERIENCE posts for "${targetProductForExp.name}", total: ${finalExpCount}`)
      } else {
        console.log(`  ✅ Product "${targetProductForExp.name}" already has ${existingExpCount} EXPERIENCE posts (>= ${targetExpCount})`)
      }
    } else {
      console.warn(`  ⚠️  Product "${targetProductForExp.name}" missing category info, skipping specific experiences seeding...`)
    }
  } else {
    console.warn(`  ⚠️  Brand (${AUDIOMAX_BRAND_ID_FOR_EXPERIENCES}) or Product (${TARGET_PRODUCT_ID_FOR_EXPERIENCES}) not found, skipping specific experiences seeding...`)
  }

  // Product group 035c3167-0cd0-4670-8324-c11a2eb5be97 için 12 yeni product ekle
  console.log('📦 Product group 035c3167-0cd0-4670-8324-c11a2eb5be97 için 12 yeni product ekleniyor...')
  const TARGET_PRODUCT_GROUP_ID = '035c3167-0cd0-4670-8324-c11a2eb5be97'
  const targetProductGroup = await prisma.productGroup.findUnique({
    where: { id: TARGET_PRODUCT_GROUP_ID },
    include: {
      products: {
        select: { name: true },
      },
    },
  })

  if (targetProductGroup) {
    // Brand bilgisini al (mevcut product'lardan)
    const existingProduct = await prisma.product.findFirst({
      where: { groupId: TARGET_PRODUCT_GROUP_ID },
      select: { brand: true },
    })
    const brandName = existingProduct?.brand || 'Pulse'

    // 12 yeni product template'leri
    const newProducts = [
      { name: 'Pulse Phone Pro Max', description: 'Premium flagship telefon, en yüksek performans ve kamera kalitesi' },
      { name: 'Pulse Phone Ultra', description: 'Ultra ince tasarım, güçlü işlemci ve uzun pil ömrü' },
      { name: 'Pulse Phone SE', description: 'Kompakt boyut, uygun fiyat, güvenilir performans' },
      { name: 'Pulse Phone Lite', description: 'Hafif ve dayanıklı, günlük kullanım için ideal' },
      { name: 'Pulse Watch', description: 'Akıllı saat, sağlık takibi ve fitness özellikleri' },
      { name: 'Pulse Watch Pro', description: 'Gelişmiş sensörler, GPS ve uzun pil ömrü' },
      { name: 'Pulse Tablet', description: '10 inç ekran, multimedya ve üretkenlik için' },
      { name: 'Pulse Tablet Pro', description: '12 inç ekran, profesyonel kullanım için optimize' },
      { name: 'Pulse Charger', description: 'Hızlı şarj adaptörü, tüm cihazlarla uyumlu' },
      { name: 'Pulse Power Bank', description: '20000mAh kapasiteli, hızlı şarj desteği' },
      { name: 'Pulse Case', description: 'Koruyucu kılıf, şık tasarım ve dayanıklılık' },
      { name: 'Pulse Screen Protector', description: 'Cam ekran koruyucu, çizilme ve darbelere karşı koruma' },
    ]

    // Batch kontrol: Mevcut product isimlerini tek sorguda al
    const existingNames = new Set(targetProductGroup.products.map(p => p.name))
    const productsToCreate = newProducts.filter(p => !existingNames.has(p.name))

    // Product image keys
    const productImageKeys: SeedMediaKey[] = [
      'product.phone.phone1',
      'product.phone.phone2',
      'product.phone.phone3',
      'product.phone.phone4',
      'product.phone.phone5',
      'product.phone.phone6',
      'product.headphone.headphone1',
      'product.headphone.headphone2',
      'product.laptop.macbook',
      'product.laptop.dell',
      'product.dyson.dyson',
    ]

    let createdCount = 0
    for (let i = 0; i < productsToCreate.length; i++) {
      const productData = productsToCreate[i]
      const imageKey = productImageKeys[i % productImageKeys.length]

      try {
        await prisma.product.create({
          data: {
            name: productData.name,
            brand: brandName,
            description: productData.description,
            imageUrl: getSeedMediaPath(imageKey, true) || null,
            groupId: TARGET_PRODUCT_GROUP_ID,
          },
        })
        createdCount++
      } catch (error: any) {
        console.warn(`  ⚠️  ${productData.name} oluşturulamadı: ${error.message}`)
      }
    }

    // Son kontrol
    const finalCount = await prisma.product.count({
      where: { groupId: TARGET_PRODUCT_GROUP_ID },
    })

    console.log(`✅ ${createdCount} yeni product oluşturuldu (toplam: ${finalCount})`)
  } else {
    console.warn(`⚠️  Product group bulunamadı (ID: ${TARGET_PRODUCT_GROUP_ID}), product ekleme atlandı`)
  }
  
  progress.increment('Özet hazırlanıyor...')
  progress.complete('Seed işlemi tamamlandı!')
  
  console.log('\n✨ Seed process completed successfully!')
  
  // Build summary text
  const summaryLines: string[] = []
  summaryLines.push('\n📊 SEED SUMMARY:')
  summaryLines.push(`• ${themes.length} User Themes`)
  summaryLines.push(`• ${mainCategories.length} Main Categories`)
  summaryLines.push(`• ${techSubCategories.length} Sub Categories (Technology)`)
  summaryLines.push(`• ${badgeCategories.length} Badge Categories`)
  summaryLines.push(`• ${badges.length} Default Badges`)
  summaryLines.push(`• ${metrics.length} Comparison Metrics`)
  summaryLines.push(`• ${allNFTs.length} NFTs (including ${nfts.length} for target user)`)
  summaryLines.push(`• ${marketplaceListings.length} Marketplace Listings`)
  summaryLines.push(`• ${banners.length} Marketplace Banners`)
  summaryLines.push(`• ${trendingPosts.length} Trending Posts`)
  summaryLines.push(`• ${createdEvents.length} Wishbox Events`)
  summaryLines.push(`• ${createdScenarios.length} Event Scenarios`)
  summaryLines.push(`• ${eventStats.length} Event Statistics`)
  summaryLines.push(`• ${createdBrands.length} Brands`)
  summaryLines.push(`• ${expertRequests.length} Expert Requests`)
  summaryLines.push(`• ${expertAnswers.length} Expert Answers`)
  summaryLines.push(`• ${dmThreadsCount} DM Threads, ${dmMessagesCount} DM Messages`)
  summaryLines.push(`• ${supportRequestsCount} Support Requests, ${supportThreadsCount} Support Threads, ${supportMessagesCount} Support Messages`)
  summaryLines.push(`• ${tipsTransferSeeds.length} Tips Transfers`)
  summaryLines.push(`• Target User (Market Test) - ID: ${TARGET_USER_ID}`)
  summaryLines.push(`  - Owned NFTs: 4 (not listed)`)
  summaryLines.push(`  - Listed NFTs: 6 (on marketplace)`)
  summaryLines.push(`• Test User (Ömer Faruk) - ID: ${userIdToUse}`)
  summaryLines.push('  - Profile, Avatar, Banner, Titles, Badges')
  summaryLines.push('  - Trust Relations (5 trusted, 3 trusters)')
  summaryLines.push('  - Content Posts (Feed, Tips, Benchmarks)')
  summaryLines.push('  - Reviews (Product Experiences)')
  summaryLines.push('  - Replies (Comments)')
  summaryLines.push('  - Stats (Likes, Favorites, Views)')
  summaryLines.push('  - Feed Entries (User feeds)')
  summaryLines.push('  - NFTs (owned and listed)')
  summaryLines.push('  - DM Requests (Support Requests with descriptions)')
  summaryLines.push('')
  summaryLines.push('🎉 Database is ready for development!')
  summaryLines.push('')
  summaryLines.push('🔑 Login Credentials:')
  summaryLines.push('  Primary User:')
  summaryLines.push('    Email: omer@tipbox.co')
  summaryLines.push('    Password: password123')
  summaryLines.push('    ID: ' + TEST_USER_ID)
  summaryLines.push('  ')
  summaryLines.push('  Market Test User:')
  summaryLines.push('    Email: markettest@tipbox.co')
  summaryLines.push('    Password: password123')
  summaryLines.push('    ID: ' + TARGET_USER_ID)
  summaryLines.push('  ')
  summaryLines.push('  Trust Users (0-4): trust-user-X@tipbox.co')
  summaryLines.push('  Truster Users (0-2): truster-user-X@tipbox.co')
  summaryLines.push('  (All users have the same password: password123)')
  summaryLines.push('  (All user IDs are static and will remain same on re-seed)')
  summaryLines.push('')
  summaryLines.push('🔗 Test Endpoints:')
  summaryLines.push('• Feed: GET /feed (with auth token)')
  summaryLines.push('• Filtered Feed: GET /feed/filtered?interests=<categoryId>&tags=Review&sort=recent')
  summaryLines.push(`• Profile Card: GET /users/${userIdToUse}/profile-card`)
  summaryLines.push(`• Batch Endpoint: GET /users/${userIdToUse}/profile?tabs=feed,reviews,benchmarks,tips,replies,ladder`)
  summaryLines.push(`• Trust List: GET /users/${userIdToUse}/trusts`)
  summaryLines.push(`• Truster List: GET /users/${userIdToUse}/trusters`)
  summaryLines.push(`• Collections: GET /users/${userIdToUse}/collections/achievements`)
  summaryLines.push(`• Posts: GET /users/${userIdToUse}/posts`)
  summaryLines.push(`• Reviews: GET /users/${userIdToUse}/reviews`)
  summaryLines.push(`• Benchmarks: GET /users/${userIdToUse}/benchmarks`)
  summaryLines.push(`• Tips: GET /users/${userIdToUse}/tips`)
  summaryLines.push(`• Replies: GET /users/${userIdToUse}/replies`)
  summaryLines.push(`• Ladder: GET /users/${userIdToUse}/ladder/badges`)
  summaryLines.push('')
  summaryLines.push('🏪 Marketplace Endpoints:')
  summaryLines.push('• List Active: GET /marketplace/listings')
  summaryLines.push('• Filter by Type: GET /marketplace/listings?type=BADGE&rarity=EPIC')
  summaryLines.push('• Filter by Price: GET /marketplace/listings?minPrice=100&maxPrice=500')
  summaryLines.push('• Search: GET /marketplace/listings?search=badge')
  summaryLines.push(`• My NFTs: GET /marketplace/my-nfts (use token for user ${TARGET_USER_ID})`)
  summaryLines.push('• Create Listing: POST /marketplace/listings')
  summaryLines.push('  Body: { "nftId": "...", "amount": 125.0 }')
  summaryLines.push('• Update Price: PUT /marketplace/listings/:listingId/price')
  summaryLines.push('  Body: { "amount": 150.0 }')
  summaryLines.push('• Cancel Listing: DELETE /marketplace/listings/:listingId')
  summaryLines.push('• Sell NFT Info: GET /marketplace/sell/:nftId (with auth token)')
  summaryLines.push('  Returns: viewer, rarity, price, suggestedPrice, gasFee, earningsAfterSales')
  summaryLines.push('• Sell NFT Detail: GET /marketplace/sell/:nftId/detail (with auth token)')
  summaryLines.push('  Returns: Detailed sell info including earnDate, totalOwner, ownerUser')
  summaryLines.push('')
  summaryLines.push('🔍 Explore Endpoints:')
  summaryLines.push('• Hottest/Trending: GET /explore/hottest (with auth token)')
  summaryLines.push('• Marketplace Banners: GET /explore/marketplace-banners')
  summaryLines.push('• What\'s News (Events): GET /explore/events')
  summaryLines.push('• New Brands: GET /explore/brands/new')
  summaryLines.push('• New Products: GET /explore/products/new')
  summaryLines.push('')
  summaryLines.push('🎉 Events Endpoints:')
  summaryLines.push('• Active Events: GET /events/active?limit=20&cursor=...')
  summaryLines.push('• Upcoming Events: GET /events/upcoming?limit=20&cursor=...')
  summaryLines.push('• Event Detail: GET /events/:eventId')
  summaryLines.push('• Event Posts: GET /events/:eventId/posts?limit=20&cursor=...')
  summaryLines.push('• Event Badges: GET /events/:eventId/badges?limit=20&cursor=...')
  summaryLines.push('')
  summaryLines.push('💡 Expert Endpoints:')
  summaryLines.push('• Create Request: POST /expert/request')
  summaryLines.push('  Body: { "description": "...", "tipsAmount": 50.0 }')
  summaryLines.push('• Update Tips: PATCH /expert/request/:requestId/tips')
  summaryLines.push('  Body: { "tipsAmount": 100.0 }')
  summaryLines.push('• Get Answered: GET /expert/answered')
  summaryLines.push('• Get Request Detail: GET /expert/request/:requestId')
  summaryLines.push('')
  summaryLines.push('📨 Inbox/Messaging Endpoints:')
  summaryLines.push('• Get Messages: GET /messages (with auth token)')
  summaryLines.push('• Get Support Requests: GET /messages/support-requests (with auth token)')
  summaryLines.push('  Query params: ?status=active|pending|completed&search=...&limit=50')
  summaryLines.push('  Returns: List of support requests with user info and descriptions')
  console.log(summaryLines.join('\n'))
  
  // PostMedia Migration: InventoryMedia'dan PostMedia'ya taşıma
  try {
    progress.increment('PostMedia migration yapılıyor...')
    console.log('\n🔄 PostMedia migration başlatılıyor...')
    await migratePostMediaFromInventory()
    console.log('✅ PostMedia migration tamamlandı')
  } catch (error) {
    console.error('❌ PostMedia migration hatası:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
    throw error // Seed'i durdur
  }
  
  // Eksik PostMedia kayıtlarını tamamla
  try {
    progress.increment('Eksik PostMedia kayıtları tamamlanıyor...')
    console.log('\n📸 Eksik PostMedia kayıtları kontrol ediliyor...')
    // ensureAllPostsHaveMedia() kaldırıldı - sadece görsel gerektiren post'lar için PostMedia ekleniyor
    // await ensureAllPostsHaveMedia()
    console.log('✅ PostMedia kontrolü tamamlandı')
  } catch (error) {
    console.error('❌ PostMedia kontrolü hatası:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
    throw error // Seed'i durdur
  }

  // ===== BRAND CATEGORY GÖRSELLERİNİ GÜNCELLE =====
  try {
    progress.increment('Brand category görselleri güncelleniyor...')
    console.log('\n🏷️  Brand category görselleri güncelleniyor...')
    await updateBrandCategoryImages()
    console.log('✅ Brand category görselleri güncellendi')
  } catch (error) {
    console.error('❌ Brand category görselleri güncelleme hatası:', error)
    // Hata olsa bile devam et
  }

  // ===== BRAND BANNER GÖRSELLERİNİ GÜNCELLE =====
  try {
    progress.increment('Brand banner görselleri güncelleniyor...')
    console.log('\n🎨 Brand banner görselleri güncelleniyor...')
    await updateBrandBannerImages()
    console.log('✅ Brand banner görselleri güncellendi')
  } catch (error) {
    console.error('❌ Brand banner görselleri güncelleme hatası:', error)
    // Hata olsa bile devam et
  }

  // ===== EVENT GÖRSELLERİNİ EVENT'LERE ATA =====
  // NOT: Görsel yükleme artık upload-seed-media.ts script'i ile yapılıyor
  // Burada sadece mevcut görselleri event'lere atıyoruz
  try {
    progress.increment('Event görselleri event\'lere atanıyor...')
    console.log('\n🎉 Event görselleri event\'lere atanıyor...')
    console.log('   ℹ️  Görsel yükleme upload-seed-media.ts script\'i ile yapılmalı')
    await assignEventImages()
    console.log('✅ Event görselleri atandı')
  } catch (error) {
    console.error('❌ Event görselleri atama hatası:', error)
    // Hata olsa bile devam et
  }

  // ===== APPLE BRAND EVENTS EKLE =====
  try {
    progress.increment('Apple brand events ekleniyor...')
    console.log('\n🍎 Apple brand events ekleniyor...')
    await addAppleBrandEvents()
    console.log('✅ Apple brand events eklendi')
  } catch (error) {
    console.error('❌ Apple brand events ekleme hatası:', error)
    // Hata olsa bile devam et
  }

  // ===== APPLE FEED IPHONE GÖRSELLERİNİ GÜNCELLE =====
  // NOT: Görsel yükleme artık upload-seed-media.ts script'i ile yapılıyor
  // Burada sadece mevcut görselleri post'lara atıyoruz
  try {
    progress.increment('Apple feed iPhone görselleri güncelleniyor...')
    console.log('\n📱 Apple feed iPhone görselleri güncelleniyor...')
    console.log('   ℹ️  Görsel yükleme upload-seed-media.ts script\'i ile yapılmalı')
    await assignAppleFeedIphoneImages()
    console.log('✅ Apple feed iPhone görselleri güncellendi')
  } catch (error) {
    console.error('❌ Apple feed iPhone görselleri güncelleme hatası:', error)
    // Hata olsa bile devam et
  }

  // ===== EVENT POST'LARINA PRODUCT EKLE =====
  try {
    progress.increment('Event post\'larına product ekleniyor...')
    console.log('\n📝 Event post\'larına product bilgisi ekleniyor...')
    await addProductToEventPosts()
    console.log('✅ Event post\'larına product eklendi')
  } catch (error) {
    console.error('❌ Event post\'larına product ekleme hatası:', error)
    // Hata olsa bile devam et
  }
  
  // Seed sonunu işaretle (metadata için)
  console.log('\n✅ Seed işlemi başarıyla tamamlandı!')
  markSeedEnd()
  
  // Seed sonrası feed distribution job'larını queue'ya ekle
  // FeedDistributionWorker çalıştığında bu job'lar işlenecek
  try {
    const { triggerFeedDistributionAfterSeed } = require('./seed/trigger-feed-distribution')
    await triggerFeedDistributionAfterSeed()
  } catch (error) {
    console.error('⚠️  Feed distribution tetikleme hatası (devam ediliyor):', error instanceof Error ? error.message : String(error))
    // Hata olsa bile seed başarılı sayılır
  }
}

// Unhandled promise rejection'ları yakala
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason)
  console.error('   Promise:', promise)
  console.error('   Stack:', reason instanceof Error ? reason.stack : 'No stack trace')
})

// Uncaught exception'ları yakala
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  console.error('   Stack:', error.stack)
  markSeedEnd()
  process.exit(1)
})

main()
  .catch((e) => {
    console.error('\n❌ Seed failed with error:')
    console.error('   Error:', e)
    if (e instanceof Error) {
      console.error('   Message:', e.message)
      console.error('   Stack:', e.stack)
    }
    console.error('\n💡 Seed işlemi bu noktada durdu. Yukarıdaki hata mesajını kontrol edin.')
    // Hata olsa bile metadata'yı temizle
    markSeedEnd()
    process.exit(1)
  })
  .finally(async () => {
    try {
      await prisma.$disconnect()
      console.log('✅ Database bağlantısı kapatıldı')
    } catch (error) {
      console.error('⚠️ Database bağlantısı kapatılırken hata:', error)
    }
  })
