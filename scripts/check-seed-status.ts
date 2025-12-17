/**
 * Seed durumunu kontrol eden script
 */

import { PrismaClient } from '@prisma/client'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getLastSeedRunTime, getSeedUserIds, hasSeedData } = require('../prisma/seed/seed-metadata')

const prisma = new PrismaClient()

async function checkSeedStatus() {
  console.log('🔍 Seed durumu kontrol ediliyor...\n')

  // Metadata kontrolü
  const hasMetadata = hasSeedData()
  const lastSeedRun = getLastSeedRunTime()
  const seedUserIds = getSeedUserIds()

  console.log('📋 Metadata Durumu:')
  console.log(`   Seed çalıştırıldı mı: ${hasMetadata ? '✅ Evet' : '❌ Hayır'}`)
  if (lastSeedRun) {
    console.log(`   Son seed zamanı: ${lastSeedRun.toISOString()}`)
  } else {
    console.log(`   Son seed zamanı: ❌ Yok`)
  }
  console.log(`   Seed kullanıcı sayısı: ${seedUserIds.length}`)
  if (seedUserIds.length > 0) {
    console.log(`   Seed kullanıcı ID'leri: ${seedUserIds.slice(0, 3).join(', ')}${seedUserIds.length > 3 ? '...' : ''}`)
  }
  console.log('')

  // DB kontrolü
  const userCount = await prisma.user.count()
  const postCount = await prisma.contentPost.count()
  const postMediaCount = await prisma.postMedia.count()
  const juliaUserId = '99999999-9999-4999-9999-999999999999'
  
  const juliaUser = await prisma.user.findUnique({
    where: { id: juliaUserId },
    select: { id: true, email: true },
  })

  const juliaPosts = await prisma.contentPost.count({
    where: { userId: juliaUserId },
  })

  const juliaPostMedia = await prisma.postMedia.count({
    where: { userId: juliaUserId },
  })

  console.log('📊 Veritabanı Durumu:')
  console.log(`   Toplam kullanıcı: ${userCount}`)
  console.log(`   Toplam post: ${postCount}`)
  console.log(`   Toplam PostMedia: ${postMediaCount}`)
  console.log('')
  console.log('👤 Julia Kullanıcısı:')
  console.log(`   Kullanıcı var mı: ${juliaUser ? '✅ Evet' : '❌ Hayır'}`)
  if (juliaUser) {
    console.log(`   Email: ${juliaUser.email}`)
  }
  console.log(`   Post sayısı: ${juliaPosts}`)
  console.log(`   PostMedia sayısı: ${juliaPostMedia}`)

  await prisma.$disconnect()
}

checkSeedStatus()
  .catch((e) => {
    console.error('❌ Hata:', e)
    process.exit(1)
  })
