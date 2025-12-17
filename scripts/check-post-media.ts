/**
 * PostMedia tablosunu kontrol eden script
 * Kullanım: npx tsx scripts/check-post-media.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPostMedia() {
  console.log('🔍 PostMedia tablosu kontrol ediliyor...\n')

  try {
    // Toplam PostMedia sayısı
    const totalCount = await prisma.postMedia.count()
    console.log(`📊 Toplam PostMedia kayıt sayısı: ${totalCount}\n`)

    if (totalCount === 0) {
      console.log('⚠️  PostMedia tablosunda hiç veri yok!')
      return
    }

    // Julia kullanıcısının PostMedia'ları
    const JULIA_USER_ID = '99999999-9999-4999-9999-999999999999'
    const juliaMedia = await prisma.postMedia.findMany({
      where: {
        userId: JULIA_USER_ID,
      },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            type: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    console.log(`👤 Julia kullanıcısının PostMedia sayısı: ${juliaMedia.length}\n`)

    if (juliaMedia.length > 0) {
      console.log('📸 Julia\'nın Post Media\'ları:\n')
      juliaMedia.forEach((media, index) => {
        console.log(`${index + 1}. Post: ${media.post.title}`)
        console.log(`   Post ID: ${media.postId}`)
        console.log(`   Post Type: ${media.post.type}`)
        console.log(`   Media URL (Path): ${media.mediaUrl}`)
        console.log(`   Order Index: ${media.orderIndex}`)
        console.log(`   Created At: ${media.createdAt.toISOString()}`)
        console.log('')
      })
    } else {
      console.log('⚠️  Julia kullanıcısı için PostMedia bulunamadı!')
    }

    // Tüm kullanıcıların PostMedia istatistikleri
    const mediaByUser = await prisma.postMedia.groupBy({
      by: ['userId'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    })

    console.log('\n📊 Kullanıcı bazında PostMedia istatistikleri:')
    console.log('─'.repeat(80))
    
    for (const item of mediaByUser.slice(0, 10)) {
      const user = await prisma.user.findUnique({
        where: { id: item.userId },
        select: { email: true, id: true },
      })
      const userName = user?.email || item.userId
      console.log(`   ${userName}: ${item._count.id} media`)
    }
    
    if (mediaByUser.length > 10) {
      console.log(`   ... ve ${mediaByUser.length - 10} kullanıcı daha`)
    }

    // PostMedia format kontrolü (path vs URL)
    const sampleMedia = await prisma.postMedia.findMany({
      take: 10,
      select: {
        mediaUrl: true,
        postId: true,
      },
    })

    console.log('\n📋 Media URL format kontrolü (ilk 10 kayıt):')
    console.log('─'.repeat(80))
    sampleMedia.forEach((media, index) => {
      const isFullUrl = media.mediaUrl.startsWith('http://') || media.mediaUrl.startsWith('https://')
      const format = isFullUrl ? '❌ Full URL (Yanlış!)' : '✅ Path (Doğru!)'
      console.log(`${index + 1}. ${format} - ${media.mediaUrl.substring(0, 60)}${media.mediaUrl.length > 60 ? '...' : ''}`)
    })

    // Path formatında olanların yüzdesi
    const pathFormatCount = await prisma.postMedia.count({
      where: {
        AND: [
          { mediaUrl: { not: { startsWith: 'http://' } } },
          { mediaUrl: { not: { startsWith: 'https://' } } },
        ],
      },
    })

    const pathPercentage = totalCount > 0 ? ((pathFormatCount / totalCount) * 100).toFixed(1) : '0'
    console.log(`\n✅ Path formatında: ${pathFormatCount}/${totalCount} (${pathPercentage}%)`)
    console.log(`❌ Full URL formatında: ${totalCount - pathFormatCount}/${totalCount} (${(100 - parseFloat(pathPercentage)).toFixed(1)}%)`)

  } catch (error) {
    console.error('❌ Hata oluştu:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

checkPostMedia()
  .catch((e) => {
    console.error('❌ Script hatası:', e)
    process.exit(1)
  })
