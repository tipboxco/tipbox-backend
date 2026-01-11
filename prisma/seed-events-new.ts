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
      startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
      status: 'PUBLISHED' as const,
      isActive: false,
      products: beautyProducts.filter(p => p.name.toLowerCase().includes('hair') || p.name.toLowerCase().includes('shampoo'))
    }
  ]
  
  // Event'leri oluştur
  console.log('📅 Event'ler oluşturuluyor...')
  let activeCount = 0
  let upcomingCount = 0
  
  for (const config of eventConfigs) {
    const eventId = generateUlid()
    
    await prisma.wishboxEvent.create({
      data: {
        id: eventId,
        title: config.title,
        description: config.description,
        startDate: config.startDate,
        endDate: config.endDate,
        status: config.status,
        eventType: 'SURVEY',
        mainCategoryId: config.categoryId,
        imageUrl: null,
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
  
  // Active event'lere EventPost ekle (ÜRÜN BAZLI)
  console.log('📝 Event postları oluşturuluyor (ÜRÜN BAZLI)...')
  let totalEventPosts = 0
  
  for (let i = 0; i < activeEvents.length; i++) {
    const eventId = activeEvents[i]
    const config = eventConfigs.filter(c => c.isActive)[i]
    const eventProducts = config.products || []
    
    // Her event için 15-25 post
    const postCount = Math.floor(Math.random() * 11) + 15
    const contributors = users.sort(() => Math.random() - 0.5).slice(0, postCount)
    
    for (const user of contributors) {
      // Rastgele bir ürün seç
      const selectedProduct = eventProducts.length > 0 
        ? eventProducts[Math.floor(Math.random() * eventProducts.length)]
        : null
      
      const postId = generateUlid()
      const productName = selectedProduct?.name || 'Genel Deneyim'
      
      // Ürün bazlı title ve body
      const titles = [
        `${productName} ile deneyimim`,
        `${productName} hakkında düşüncelerim`,
        `${productName} kullanım deneyimi`,
        `${productName} - Detaylı İnceleme`,
        `${productName} uzun süreli kullanım`,
      ]
      
      const bodies = [
        `${productName} ürününü ${Math.floor(Math.random() * 12) + 1} aydır kullanıyorum. Genel olarak memnunum. Özellikle ${['performans', 'kalite', 'dayanıklılık', 'kullanım kolaylığı'][Math.floor(Math.random() * 4)]} açısından beklentilerimi karşıladı. Fiyat performans oranı gayet iyi.`,
        `${productName} için uzun süredir araştırma yaptım ve sonunda aldım. İlk izlenimlerim oldukça olumlu. ${['Tasarım', 'Kullanım', 'Özellikler', 'Kalite'][Math.floor(Math.random() * 4)]} açısından çok başarılı. Arkadaşlarıma da tavsiye ediyorum.`,
        `${productName} günlük kullanımda gerçekten işimi görüyor. ${['Pratiklik', 'Verimlilik', 'Dayanıklılık', 'Kullanım kolaylığı'][Math.floor(Math.random() * 4)]} konusunda çok memnunum. Alternatiflerini de denedim ama bu benim favorim oldu.`,
        `${productName} ürününü farklı senaryolarda test ettim. Hem ${['günlük kullanımda', 'yoğun kullanımda', 'farklı ortamlarda', 'uzun süreli kullanımda'][Math.floor(Math.random() * 4)]} sorunsuz çalışıyor. Kalite açısından çok başarılı buldum.`,
      ]
      
      await prisma.eventPost.create({
        data: {
          id: postId,
          eventId,
          userId: user.id,
          productId: selectedProduct?.id,
          title: titles[Math.floor(Math.random() * titles.length)],
          body: bodies[Math.floor(Math.random() * bodies.length)],
          likesCount: Math.floor(Math.random() * 30) + 5,
          commentsCount: Math.floor(Math.random() * 15) + 2,
          createdAt: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000),
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
          totalComments: Math.floor(Math.random() * 5) + 1,
          helpfulVotesReceived: Math.floor(Math.random() * 10) + 1,
        },
        update: {
          totalParticipated: { increment: 1 },
        }
      })
    }
  }
  
  console.log(`  ✅ ${totalEventPosts} event post oluşturuldu (ÜRÜN BAZLI)`)
  
  // Özet
  console.log('\n' + '═'.repeat(80))
  console.log('✨ PHASE 12 TAMAMLANDI - EVENTS (Elektronik & Beauty)\n')
  console.log(`   🎉 Toplam Events: ${activeCount + upcomingCount}`)
  console.log(`      📅 Active: ${activeCount}`)
  console.log(`      🔜 Upcoming: ${upcomingCount}`)
  console.log(`   📝 Event Posts: ${totalEventPosts} (ÜRÜN BAZLI)`)
  if (activeCount > 0) {
    console.log(`\n   📊 Ortalama event başına: ${(totalEventPosts / activeCount).toFixed(1)} post`)
  }
  console.log('═'.repeat(80) + '\n')
}

