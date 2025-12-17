import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const JULIA_USER_ID = '99999999-9999-4999-9999-999999999999'

async function checkJuliaTipsPosts() {
  try {
    console.log('🔍 Julia kullanıcısının TIPS post\'larını kontrol ediliyor...\n')

    // Julia kullanıcısını bul
    const juliaUser = await prisma.user.findUnique({
      where: { id: JULIA_USER_ID },
      include: {
        profile: true,
      },
    })

    if (!juliaUser) {
      console.log('❌ Julia kullanıcısı bulunamadı!')
      return
    }

    console.log(`✅ Julia kullanıcısı bulundu:`)
    console.log(`   ID: ${juliaUser.id}`)
    console.log(`   Email: ${juliaUser.email}`)
    console.log(`   Name: ${juliaUser.profile?.displayName || 'N/A'}\n`)

    // TIPS post'larını getir
    const tipsPosts = await prisma.contentPost.findMany({
      where: {
        userId: JULIA_USER_ID,
        type: 'TIPS',
      },
      include: {
        tip: true,
        tags: true,
        media: {
          orderBy: { orderIndex: 'asc' },
        },
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    console.log(`📊 Toplam TIPS post sayısı: ${tipsPosts.length}\n`)

    if (tipsPosts.length === 0) {
      console.log('⚠️  Hiç TIPS post bulunamadı!')
      return
    }

    // Her post için detayları göster
    tipsPosts.forEach((post, index) => {
      console.log(`\n${'='.repeat(80)}`)
      console.log(`📝 Post ${index + 1}:`)
      console.log(`   ID: ${post.id}`)
      console.log(`   Başlık: ${post.title}`)
      console.log(`   Tip Kategorisi: ${post.tip?.tipCategory || 'N/A'}`)
      console.log(`   Doğrulanmış: ${post.tip?.isVerified ? '✅' : '❌'}`)
      console.log(`   Ürün: ${post.product?.name || 'N/A'} (${post.product?.brand || 'N/A'})`)
      console.log(`   Oluşturulma: ${post.createdAt.toISOString()}`)
      
      // Tag'ler
      if (post.tags && post.tags.length > 0) {
        const tagNames = post.tags.map(t => t.tag).join(', ')
        console.log(`   Tag'ler: ${tagNames}`)
      }

      // Media
      if (post.media && post.media.length > 0) {
        console.log(`   Görseller (${post.media.length} adet):`)
        post.media.forEach((media, mediaIndex) => {
          console.log(`      ${mediaIndex + 1}. ${media.mediaUrl} (orderIndex: ${media.orderIndex})`)
        })
      } else {
        console.log(`   ⚠️  Görsel bulunamadı!`)
      }
    })

    console.log(`\n${'='.repeat(80)}`)
    console.log(`\n✅ Kontrol tamamlandı!`)
    console.log(`📊 Özet:`)
    console.log(`   - Toplam TIPS post: ${tipsPosts.length}`)
    console.log(`   - Görseli olan post: ${tipsPosts.filter(p => p.media && p.media.length > 0).length}`)
    console.log(`   - Görseli olmayan post: ${tipsPosts.filter(p => !p.media || p.media.length === 0).length}`)

  } catch (error) {
    console.error('❌ Hata:', error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:')
      console.error(error.stack)
    }
  } finally {
    await prisma.$disconnect()
  }
}

// Script çalıştır
checkJuliaTipsPosts()
  .catch((error) => {
    console.error('❌ Script hatası:', error)
    process.exit(1)
  })

