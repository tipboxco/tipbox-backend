/**
 * Badge Setup Script
 * 
 * Bu script:
 * 1. Eski badge'leri siler
 * 2. Yeni 17 badge'i veritabanına ekler
 * 3. MinIO'ya görselleri yükler
 * 4. Kullanıcılara badge'leri atar
 * 
 * Kullanım: npx ts-node scripts/setup-badges.ts
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { S3Service } from '../src/infrastructure/s3/s3.service'
import { getSeedMediaPath } from '../prisma/seed/helpers/media.helper'

type SeedMediaKey = string

const prisma = new PrismaClient()

// Öne çıkan kullanıcı ID'leri
const TEST_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07' // omer
const TRUST_USER_IDS = [
  '11111111-1111-4111-a111-111111111111', // tuna
  '22222222-2222-4222-a222-222222222222', // mehmet
  '33333333-3333-4333-a333-333333333333', // ibrahim
  '44444444-4444-4444-a444-444444444444', // burakcan
  '55555555-5555-4555-a555-555555555555', // mihrac
]
const TRUSTER_USER_IDS = [
  'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', // irem
  'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', // furkan
  'cccccccc-cccc-4ccc-cccc-cccccccccccc', // aycan
]
const JULIA_USER_ID = '99999999-9999-4999-9999-999999999999' // ozan

const featuredUserIds = [
  TEST_USER_ID,
  TRUST_USER_IDS[0],
  TRUST_USER_IDS[2],
  TRUST_USER_IDS[3],
  TRUST_USER_IDS[4],
  TRUSTER_USER_IDS[1],
  TRUSTER_USER_IDS[2],
  TRUSTER_USER_IDS[0],
  JULIA_USER_ID,
]

// Eski badge isimleri (silinecek)
const OLD_BADGE_NAMES = [
  'Welcome',
  'First Post',
  'Tip Master',
  'Community Hero',
  'Early Bird',
  'Beta Tester',
  'Benchmark Sage',
  'Experience Curator',
  'Bridge Ambassador',
  'Brand Visionary',
]

// Yeni badge konfigürasyonları
type BadgeConfig = {
  name: string
  description: string
  type: 'ACHIEVEMENT' | 'EVENT' | 'BRAND'
  rarity: 'COMMON' | 'RARE' | 'EPIC'
  boostMultiplier: number
  rewardMultiplier: number
  imageKey: SeedMediaKey
}

const NEW_BADGE_CONFIGS: BadgeConfig[] = [
  // Ana Badge'ler (11 adet)
  {
    name: 'Early Adapter',
    description: 'You are one of the very first users of Tipbox! Welcome to our community.',
    type: 'ACHIEVEMENT',
    rarity: 'RARE',
    boostMultiplier: 1.2,
    rewardMultiplier: 1.4,
    imageKey: 'badge.earlyadapter',
  },
  {
    name: 'Hardware Expert',
    description: 'You have deep knowledge and expertise in hardware and electronics.',
    type: 'ACHIEVEMENT',
    rarity: 'RARE',
    boostMultiplier: 1.3,
    rewardMultiplier: 1.3,
    imageKey: 'badge.hardwareexpert',
  },
  {
    name: 'Premium Shopper',
    description: 'You know how to find the best products and make smart purchasing decisions.',
    type: 'ACHIEVEMENT',
    rarity: 'RARE',
    boostMultiplier: 1.3,
    rewardMultiplier: 1.3,
    imageKey: 'badge.premiumshoper',
  },
  {
    name: 'Wish Marker',
    description: 'You actively mark and track products you want, showing your passion for quality.',
    type: 'ACHIEVEMENT',
    rarity: 'COMMON',
    boostMultiplier: 1.1,
    rewardMultiplier: 1.1,
    imageKey: 'badge.wishmarker',
  },
  {
    name: 'Tech Enthusiast',
    description: 'You love technology and stay updated with the latest innovations in electronics.',
    type: 'ACHIEVEMENT',
    rarity: 'COMMON',
    boostMultiplier: 1.1,
    rewardMultiplier: 1.1,
    imageKey: 'badge.badge-1',
  },
  {
    name: 'Beauty Guru',
    description: 'You are an expert in beauty products and skincare routines.',
    type: 'ACHIEVEMENT',
    rarity: 'RARE',
    boostMultiplier: 1.3,
    rewardMultiplier: 1.3,
    imageKey: 'badge.badge-2',
  },
  {
    name: 'Gadget Master',
    description: 'You master the latest gadgets and know how to get the most out of them.',
    type: 'ACHIEVEMENT',
    rarity: 'RARE',
    boostMultiplier: 1.3,
    rewardMultiplier: 1.3,
    imageKey: 'badge.badge-3',
  },
  {
    name: 'Style Curator',
    description: 'You have an eye for style and help others discover beautiful products.',
    type: 'ACHIEVEMENT',
    rarity: 'COMMON',
    boostMultiplier: 1.1,
    rewardMultiplier: 1.1,
    imageKey: 'badge.badge-4',
  },
  {
    name: 'Smart Buyer',
    description: 'You make informed purchasing decisions and share valuable buying insights.',
    type: 'ACHIEVEMENT',
    rarity: 'COMMON',
    boostMultiplier: 1.1,
    rewardMultiplier: 1.1,
    imageKey: 'badge.badge-5',
  },
  {
    name: 'Product Expert',
    description: 'You have extensive knowledge about products and help others make better choices.',
    type: 'ACHIEVEMENT',
    rarity: 'EPIC',
    boostMultiplier: 1.5,
    rewardMultiplier: 1.5,
    imageKey: 'badge.badge-6',
  },
  {
    name: 'Review Pro',
    description: 'Your detailed reviews help the community make better purchasing decisions.',
    type: 'ACHIEVEMENT',
    rarity: 'EPIC',
    boostMultiplier: 1.5,
    rewardMultiplier: 1.5,
    imageKey: 'badge.badge-7',
  },
  // Brand Badge'ler (6 adet)
  {
    name: 'Brand Badge 1',
    description: 'Exclusive brand recognition badge for trusted community members.',
    type: 'BRAND',
    rarity: 'RARE',
    boostMultiplier: 1.3,
    rewardMultiplier: 1.3,
    imageKey: 'badge.brand.brandbadge1',
  },
  {
    name: 'Brand Badge 2',
    description: 'Exclusive brand recognition badge for trusted community members.',
    type: 'BRAND',
    rarity: 'RARE',
    boostMultiplier: 1.3,
    rewardMultiplier: 1.3,
    imageKey: 'badge.brand.brandbadge2',
  },
  {
    name: 'Brand Badge 3',
    description: 'Exclusive brand recognition badge for trusted community members.',
    type: 'BRAND',
    rarity: 'RARE',
    boostMultiplier: 1.3,
    rewardMultiplier: 1.3,
    imageKey: 'badge.brand.brandbadge3',
  },
  {
    name: 'Brand Badge 4',
    description: 'Exclusive brand recognition badge for trusted community members.',
    type: 'BRAND',
    rarity: 'RARE',
    boostMultiplier: 1.3,
    rewardMultiplier: 1.3,
    imageKey: 'badge.brand.brandbadge4',
  },
  {
    name: 'Brand Badge 5',
    description: 'Exclusive brand recognition badge for trusted community members.',
    type: 'BRAND',
    rarity: 'RARE',
    boostMultiplier: 1.3,
    rewardMultiplier: 1.3,
    imageKey: 'badge.brand.brandbadge5',
  },
  {
    name: 'Brand Badge 6',
    description: 'Exclusive brand recognition badge for trusted community members.',
    type: 'BRAND',
    rarity: 'RARE',
    boostMultiplier: 1.3,
    rewardMultiplier: 1.3,
    imageKey: 'badge.brand.brandbadge6',
  },
]

async function uploadBadgeImages(): Promise<void> {
  console.log('\n📤 Badge görselleri MinIO\'ya yükleniyor...\n')
  
  const s3Service = new S3Service()
  await s3Service.checkAndCreateBucket()
  
  const assetsBasePath = path.join(__dirname, '../tests/assets')
  let uploadedCount = 0
  let skippedCount = 0
  
  for (const config of NEW_BADGE_CONFIGS) {
    try {
      // Image key'den dosya adını çıkar
      let fileName = ''
      let localDir = ''
      
      if (config.imageKey.startsWith('badge.brand.')) {
        // Brand badge: badge.brand.brandbadge1 -> brandbadge/brandbadge1.png
        fileName = config.imageKey.replace('badge.brand.', '') + '.png'
        localDir = path.join(assetsBasePath, 'brandbadge')
      } else if (config.imageKey.startsWith('badge.')) {
        // Ana badge: badge.earlyadapter -> badge/EarlyAdapter.png veya badge/badge-1.png
        const keyPart = config.imageKey.replace('badge.', '')
        if (keyPart === 'earlyadapter') {
          fileName = 'EarlyAdapter.png'
        } else if (keyPart === 'hardwareexpert') {
          fileName = 'HardwareExpert.png'
        } else if (keyPart === 'premiumshoper') {
          fileName = 'PremiumShoper.png'
        } else if (keyPart === 'wishmarker') {
          fileName = 'WishMarker.png'
        } else if (keyPart.startsWith('badge-')) {
          fileName = keyPart + '.png'
        } else {
          fileName = keyPart + '.png'
        }
        localDir = path.join(assetsBasePath, 'badge')
      }
      
      const imagePath = path.join(localDir, fileName)
      
      if (!existsSync(imagePath)) {
        console.warn(`⚠️  Görsel bulunamadı: ${imagePath} (${config.name})`)
        continue
      }
      
      // Target key'i belirle
      let targetKey = ''
      if (config.imageKey.startsWith('badge.brand.')) {
        targetKey = `badges/brand/${fileName}`
      } else {
        targetKey = `badges/custom/${fileName}`
      }
      
      const exists = await s3Service.fileExists(targetKey)
      
      if (exists) {
        console.log(`⏭️  Zaten mevcut: ${config.name} (${targetKey})`)
        skippedCount++
        continue
      }
      
      // Dosyayı oku ve yükle
      const fileBuffer = readFileSync(imagePath)
      const contentType = 'image/png'
      
      await s3Service.uploadFile(targetKey, fileBuffer, contentType)
      console.log(`✅ Yüklendi: ${config.name} → ${targetKey}`)
      uploadedCount++
    } catch (error) {
      console.error(`❌ Hata (${config.name}):`, error instanceof Error ? error.message : String(error))
    }
  }
  
  console.log(`\n📊 Özet: ${uploadedCount} yeni yüklendi, ${skippedCount} zaten mevcut\n`)
}

async function deleteOldBadges(): Promise<void> {
  console.log('\n🗑️  Eski badge\'ler siliniyor...\n')
  
  for (const badgeName of OLD_BADGE_NAMES) {
    try {
      const badge = await prisma.badge.findFirst({
        where: { name: badgeName }
      })
      
      if (badge) {
        // Önce UserBadge'leri sil
        await prisma.userBadge.deleteMany({
          where: { badgeId: badge.id }
        })
        
        // Sonra badge'i sil
        await prisma.badge.delete({
          where: { id: badge.id }
        })
        
        console.log(`✅ Silindi: ${badgeName}`)
      } else {
        console.log(`⏭️  Bulunamadı: ${badgeName}`)
      }
    } catch (error) {
      console.error(`❌ Hata (${badgeName}):`, error instanceof Error ? error.message : String(error))
    }
  }
  
  console.log('')
}

async function createNewBadges(): Promise<Array<{ id: string; name: string; type: string }>> {
  console.log('\n🎖️  Yeni badge\'ler oluşturuluyor...\n')
  
  // Badge category'leri al
  const achievementCategory = await prisma.badgeCategory.findFirst({
    where: { name: 'Achievement' }
  })
  
  if (!achievementCategory) {
    throw new Error('Achievement badge category bulunamadı!')
  }
  
  const createdBadges: Array<{ id: string; name: string; type: string }> = []
  
  for (const config of NEW_BADGE_CONFIGS) {
    try {
      // Mevcut badge'i kontrol et
      const existing = await prisma.badge.findFirst({
        where: { name: config.name }
      })
      
      // Image URL'i oluştur (sadece path formatı: badges/brand/brandbadge1.png)
      let imageUrl: string | null = null
      
      if (config.imageKey.startsWith('badge.brand.')) {
        const fileName = config.imageKey.replace('badge.brand.', '') + '.png'
        imageUrl = `badges/brand/${fileName}`
      } else {
        let fileName = ''
        if (config.imageKey === 'badge.earlyadapter') fileName = 'EarlyAdapter.png'
        else if (config.imageKey === 'badge.hardwareexpert') fileName = 'HardwareExpert.png'
        else if (config.imageKey === 'badge.premiumshoper') fileName = 'PremiumShoper.png'
        else if (config.imageKey === 'badge.wishmarker') fileName = 'WishMarker.png'
        else if (config.imageKey.startsWith('badge.badge-')) fileName = config.imageKey.replace('badge.', '') + '.png'
        else fileName = config.imageKey.replace('badge.', '') + '.png'
        
        imageUrl = `badges/custom/${fileName}`
      }
      
      if (existing) {
        // Mevcut badge'i güncelle
        const updated = await prisma.badge.update({
          where: { id: existing.id },
          data: {
            description: config.description,
            type: config.type as any,
            rarity: config.rarity as any,
            boostMultiplier: config.boostMultiplier,
            rewardMultiplier: config.rewardMultiplier,
            categoryId: achievementCategory.id,
            imageUrl: imageUrl || existing.imageUrl,
          }
        })
        createdBadges.push({ id: updated.id, name: updated.name, type: updated.type })
        console.log(`✅ Güncellendi: ${config.name}`)
      } else {
        // Yeni badge oluştur
        const created = await prisma.badge.create({
          data: {
            name: config.name,
            description: config.description,
            type: config.type as any,
            rarity: config.rarity as any,
            boostMultiplier: config.boostMultiplier,
            rewardMultiplier: config.rewardMultiplier,
            categoryId: achievementCategory.id,
            imageUrl,
          }
        })
        createdBadges.push({ id: created.id, name: created.name, type: created.type })
        console.log(`✅ Oluşturuldu: ${config.name}`)
      }
    } catch (error) {
      console.error(`❌ Hata (${config.name}):`, error instanceof Error ? error.message : String(error))
    }
  }
  
  console.log(`\n✅ Toplam ${createdBadges.length} badge hazır\n`)
  return createdBadges
}

async function assignBadgesToUsers(badges: Array<{ id: string; name: string; type: string }>): Promise<void> {
  console.log('\n🎖️  Badge\'ler kullanıcılara atanıyor...\n')
  
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

async function main() {
  try {
    console.log('🚀 Badge Setup Script Başlatılıyor...\n')
    console.log('═══════════════════════════════════════════════════════════\n')
    
    // 1. Eski badge'leri sil
    await deleteOldBadges()
    
    // 2. MinIO'ya görselleri yükle
    await uploadBadgeImages()
    
    // 3. Yeni badge'leri oluştur
    const badges = await createNewBadges()
    
    // 4. Kullanıcılara badge'leri ata
    await assignBadgesToUsers(badges)
    
    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('✅ Badge setup tamamlandı!')
    console.log('═══════════════════════════════════════════════════════════\n')
  } catch (error) {
    console.error('\n❌ Hata:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('❌ Script başarısız:', error)
      process.exit(1)
    })
}
