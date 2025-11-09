import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Sabit kullanıcı ID'leri - her seed'de aynı ID'ler kullanılır
const TEST_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07' // omer@tipbox.co
const TARGET_USER_ID = '248cc91f-b551-4ecc-a885-db1163571330' // markettest@tipbox.co

// Trust user ID'leri (5 kullanıcı)
const TRUST_USER_IDS = [
  '11111111-1111-4111-a111-111111111111', // trust-user-0@tipbox.co
  '22222222-2222-4222-a222-222222222222', // trust-user-1@tipbox.co
  '33333333-3333-4333-a333-333333333333', // trust-user-2@tipbox.co
  '44444444-4444-4444-a444-444444444444', // trust-user-3@tipbox.co
  '55555555-5555-4555-a555-555555555555', // trust-user-4@tipbox.co
]

// Truster user ID'leri (3 kullanıcı)
const TRUSTER_USER_IDS = [
  'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', // truster-user-0@tipbox.co
  'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', // truster-user-1@tipbox.co
  'cccccccc-cccc-4ccc-cccc-cccccccccccc', // truster-user-2@tipbox.co
]

// Hash the default password for all users
const DEFAULT_PASSWORD = 'password123'
let passwordHash: string

// Simple ULID generator for seed (avoids import issues)
function generateUlid(): string {
  // ULID format: timestamp (10 chars) + randomness (16 chars) = 26 chars
  const timestamp = Date.now().toString(36).toUpperCase().padStart(10, '0')
  const randomPart = Math.random().toString(36).substring(2, 18).toUpperCase().padStart(16, '0')
  return (timestamp + randomPart).substring(0, 26)
}

async function main() {
  console.error('🌱 Starting seed process...') // Using stderr to ensure output
  console.log('🌱 Starting seed process...')

  // Hash password once for all users
  console.log('🔐 Hashing default password...')
  passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)
  console.log('✅ Password hashed')

  // 1. User Themes
  console.log('📱 Creating user themes...')
  const themes = await Promise.all([
    prisma.userTheme.create({
      data: {
        name: 'Light',
        description: 'Açık tema - günün her saati için ideal'
      }
    }),
    prisma.userTheme.create({
      data: {
        name: 'Dark',
        description: 'Koyu tema - gözleri yormaz, modern görünüm'
      }
    }),
    prisma.userTheme.create({
      data: {
        name: 'Auto',
        description: 'Otomatik - sistem temasını takip eder'
      }
    })
  ])
  console.log(`✅ ${themes.length} tema oluşturuldu`)

  // 2. Main Categories
  console.log('📂 Creating main categories...')
  const mainCategories = await Promise.all([
    prisma.mainCategory.create({
      data: {
        name: 'Teknoloji',
        description: 'Elektronik cihazlar, yazılım, mobil uygulamalar'
      }
    }),
    prisma.mainCategory.create({
      data: {
        name: 'Ev & Yaşam',
        description: 'Ev eşyaları, dekorasyon, temizlik ürünleri'
      }
    }),
    prisma.mainCategory.create({
      data: {
        name: 'Gıda & İçecek',
        description: 'Yiyecek, içecek, gıda takviyesi ürünleri'
      }
    }),
    prisma.mainCategory.create({
      data: {
        name: 'Moda & Aksesuar',
        description: 'Giyim, ayakkabı, çanta, takı ve aksesuarlar'
      }
    }),
    prisma.mainCategory.create({
      data: {
        name: 'Sağlık & Güzellik',
        description: 'Kişisel bakım, kozmetik, sağlık ürünleri'
      }
    }),
    prisma.mainCategory.create({
      data: {
        name: 'Spor & Outdoor',
        description: 'Spor ekipmanları, outdoor aktiviteler, fitness'
      }
    }),
    prisma.mainCategory.create({
      data: {
        name: 'Hobi & Eğlence',
        description: 'Kitap, oyun, müzik, sanat malzemeleri'
      }
    }),
    prisma.mainCategory.create({
      data: {
        name: 'Otomotiv',
        description: 'Araç aksesuarları, bakım ürünleri, parçalar'
      }
    })
  ])
  console.log(`✅ ${mainCategories.length} ana kategori oluşturuldu`)

  // 3. Badge Categories
  console.log('🏆 Creating badge categories...')
  const badgeCategories = await Promise.all([
    prisma.badgeCategory.create({
      data: {
        name: 'Achievement',
        description: 'Başarı rozetleri - belirli hedeflere ulaşma'
      }
    }),
    prisma.badgeCategory.create({
      data: {
        name: 'Event',
        description: 'Etkinlik rozetleri - özel günler ve kampanyalar'
      }
    }),
    prisma.badgeCategory.create({
      data: {
        name: 'Cosmetic',
        description: 'Kozmetik rozetler - görsel özelleştirme'
      }
    }),
    prisma.badgeCategory.create({
      data: {
        name: 'Community',
        description: 'Topluluk rozetleri - sosyal aktiviteler'
      }
    })
  ])
  console.log(`✅ ${badgeCategories.length} badge kategorisi oluşturuldu`)

  // 4. Default Badges
  console.log('🎖️ Creating default badges...')
  const achievementCategory = badgeCategories.find(c => c.name === 'Achievement')!
  const eventCategory = badgeCategories.find(c => c.name === 'Event')!
  const communityCategory = badgeCategories.find(c => c.name === 'Community')!

  const badges = await Promise.all([
    // Achievement Badges
    prisma.badge.create({
      data: {
        name: 'Welcome',
        description: 'Tipbox\'a hoş geldin! İlk kayıt rozetin.',
        type: 'ACHIEVEMENT',
        rarity: 'COMMON',
        boostMultiplier: 1.0,
        rewardMultiplier: 1.0,
        categoryId: achievementCategory.id
      }
    }),
    prisma.badge.create({
      data: {
        name: 'First Post',
        description: 'İlk gönderini paylaştın! İyi başlangıç.',
        type: 'ACHIEVEMENT',
        rarity: 'COMMON',
        boostMultiplier: 1.1,
        rewardMultiplier: 1.1,
        categoryId: achievementCategory.id
      }
    }),
    prisma.badge.create({
      data: {
        name: 'Tip Master',
        description: '10 faydalı ipucu paylaştın. Sen bir uzman!',
        type: 'ACHIEVEMENT',
        rarity: 'RARE',
        boostMultiplier: 1.3,
        rewardMultiplier: 1.3,
        categoryId: achievementCategory.id
      }
    }),
    prisma.badge.create({
      data: {
        name: 'Community Hero',
        description: '100 faydalı yorum yaptın. Topluluk kahramanı!',
        type: 'ACHIEVEMENT',
        rarity: 'EPIC',
        boostMultiplier: 1.5,
        rewardMultiplier: 1.5,
        categoryId: communityCategory.id
      }
    }),
    // Event Badges
    prisma.badge.create({
      data: {
        name: 'Early Bird',
        description: 'Tipbox\'un ilk kullanıcılarından birisin!',
        type: 'EVENT',
        rarity: 'RARE',
        boostMultiplier: 1.2,
        rewardMultiplier: 1.4,
        categoryId: eventCategory.id
      }
    }),
    prisma.badge.create({
      data: {
        name: 'Beta Tester',
        description: 'Beta sürecinde bize yardım ettin. Teşekkürler!',
        type: 'EVENT',
        rarity: 'EPIC',
        boostMultiplier: 1.4,
        rewardMultiplier: 1.6,
        categoryId: eventCategory.id
      }
    })
  ])
  console.log(`✅ ${badges.length} varsayılan badge oluşturuldu`)

  // 5. Comparison Metrics
  console.log('📊 Creating comparison metrics...')
  const metrics = await Promise.all([
    prisma.comparisonMetric.create({
      data: {
        name: 'Fiyat',
        description: 'Ürünün fiyat performansı (1-10)'
      }
    }),
    prisma.comparisonMetric.create({
      data: {
        name: 'Kalite',
        description: 'Ürünün genel kalitesi (1-10)'
      }
    }),
    prisma.comparisonMetric.create({
      data: {
        name: 'Kullanım Kolaylığı',
        description: 'Ürünün ne kadar kolay kullanıldığı (1-10)'
      }
    }),
    prisma.comparisonMetric.create({
      data: {
        name: 'Dayanıklılık',
        description: 'Ürünün ne kadar uzun süre dayandığı (1-10)'
      }
    }),
    prisma.comparisonMetric.create({
      data: {
        name: 'Tasarım',
        description: 'Ürünün görsel tasarımı ve estetik (1-10)'
      }
    }),
    prisma.comparisonMetric.create({
      data: {
        name: 'Müşteri Hizmetleri',
        description: 'Markanın müşteri hizmetleri kalitesi (1-10)'
      }
    }),
    prisma.comparisonMetric.create({
      data: {
        name: 'Özellikler',
        description: 'Ürünün sahip olduğu özellikler (1-10)'
      }
    }),
    prisma.comparisonMetric.create({
      data: {
        name: 'Çevre Dostu',
        description: 'Ürünün çevreye olan etkisi (1-10)'
      }
    })
  ])
  console.log(`✅ ${metrics.length} karşılaştırma metriği oluşturuldu`)

  // 6. Sub Categories for Technology
  console.log('📁 Creating sub categories for Technology...')
  const techCategory = mainCategories.find(c => c.name === 'Teknoloji')!
  const techSubCategories = await Promise.all([
    prisma.subCategory.create({
      data: {
        name: 'Akıllı Telefonlar',
        description: 'iPhone, Android, Samsung, Xiaomi vs.',
        mainCategoryId: techCategory.id
      }
    }),
    prisma.subCategory.create({
      data: {
        name: 'Laptoplar',
        description: 'Dizüstü bilgisayarlar, ultrabook, gaming laptop',
        mainCategoryId: techCategory.id
      }
    }),
    prisma.subCategory.create({
      data: {
        name: 'Kulaklıklar',
        description: 'Kablosuz, kablolu, gaming, studio kulaklık',
        mainCategoryId: techCategory.id
      }
    }),
    prisma.subCategory.create({
      data: {
        name: 'Akıllı Saatler',
        description: 'Apple Watch, Samsung Galaxy Watch, fitness tracker',
        mainCategoryId: techCategory.id
      }
    })
  ])
  console.log(`✅ ${techSubCategories.length} teknoloji alt kategorisi oluşturuldu`)

  // 7. Test User için veriler
  console.log('👤 Creating test user data for Ömer Faruk...')
  
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
        bannerUrl: 'https://cdn.tipbox.co/banners/omer-banner.jpg',
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
        bannerUrl: 'https://cdn.tipbox.co/banners/omer-banner.jpg',
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
        imageUrl: 'https://cdn.tipbox.co/avatars/omer.jpg',
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
        imageUrl: 'https://cdn.tipbox.co/avatars/omer.jpg',
        isActive: true,
      }
    })
  }
  console.log('✅ User avatar created')

  // Achievement Chains & Goals (for badge tasks)
  const achievementChain = await prisma.achievementChain.create({
    data: {
      name: 'Content Creator',
      description: 'İçerik oluşturma başarıları',
      category: 'Content',
    }
  })

  const achievementGoals = await Promise.all([
    prisma.achievementGoal.create({
      data: {
        chainId: achievementChain.id,
        title: '10 Yorum Yap',
        requirement: '10 adet yorum yap',
        rewardBadgeId: badges.find(b => b.name === 'Community Hero')?.id,
        pointsRequired: 10,
        difficulty: 'EASY',
      }
    }),
    prisma.achievementGoal.create({
      data: {
        chainId: achievementChain.id,
        title: '50 Beğeni Topla',
        requirement: 'Paylaştığın içeriklere 50 beğeni al',
        rewardBadgeId: badges.find(b => b.name === 'Tip Master')?.id,
        pointsRequired: 50,
        difficulty: 'MEDIUM',
      }
    }),
    prisma.achievementGoal.create({
      data: {
        chainId: achievementChain.id,
        title: '20 Paylaşma Yap',
        requirement: '20 içerik paylaş',
        rewardBadgeId: badges.find(b => b.name === 'First Post')?.id,
        pointsRequired: 20,
        difficulty: 'MEDIUM',
      }
    }),
  ])

  // Link achievement goals to badges (already done above)
  console.log('✅ Achievement goals created')

  // User Titles
  const titles = [
    { title: 'Technology Enthusiast' },
    { title: 'Hardware Expert' },
    { title: 'Digital Surfer' },
    { title: 'Early Tech Adopter' },
  ]
  
  for (const titleData of titles) {
    const existing = await prisma.userTitle.findFirst({
      where: { userId: userIdToUse, title: titleData.title }
    })
    
    if (!existing) {
      await prisma.userTitle.create({
        data: {
          userId: userIdToUse,
          title: titleData.title,
          earnedAt: new Date(),
        }
      })
    }
  }
  console.log(`✅ ${titles.length} user titles created`)

  // User Badges (claimed badges for collections/ladder)
  const welcomeBadge = badges.find(b => b.name === 'Welcome')!
  const firstPostBadge = badges.find(b => b.name === 'First Post')!
  const tipMasterBadge = badges.find(b => b.name === 'Tip Master')!
  const earlyBirdBadge = badges.find(b => b.name === 'Early Bird')!
  
  // Link achievement goals to badges
  await prisma.badge.update({
    where: { id: tipMasterBadge.id },
    data: {
      achievementGoals: {
        connect: achievementGoals.map(g => ({ id: g.id }))
      }
    }
  }).catch(() => {}) // Ignore if no relation

  const userBadgesData = [
    { badgeId: welcomeBadge.id, claimed: true, claimedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    { badgeId: firstPostBadge.id, claimed: true, claimedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
    { badgeId: tipMasterBadge.id, claimed: true, claimedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
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
      },
      create: {
        userId: trustUser.id,
        displayName: `Trust User ${i + 1}`,
        userName: `trustuser${i + 1}`,
      }
    })

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
      },
      create: {
        userId: trusterUser.id,
        displayName: `Truster User ${i + 1}`,
        userName: `truster${i + 1}`,
      }
    })

    await prisma.trustRelation.create({
      data: {
        trusterId: trusterUser.id,
        trustedUserId: userIdToUse,
      }
    }).catch(() => {})
  }
  console.log('✅ Trust relations created')

  // Products & Product Groups
  // Ev & Yaşam kategorisi için sub category bul
  const evYasamCategory = mainCategories.find(c => c.name === 'Ev & Yaşam')!
  const evYasamSubCategory = await prisma.subCategory.findFirst({
    where: { mainCategoryId: evYasamCategory.id }
  }) || await prisma.subCategory.create({
    data: {
      name: 'Temizlik Ürünleri',
      description: 'Süpürge, temizlik robotu vb.',
      mainCategoryId: evYasamCategory.id,
    }
  })

  const productGroup = await prisma.productGroup.create({
    data: {
      name: 'Dyson Vakum Temizleyiciler',
      description: 'Dyson marka vakum temizleyiciler',
      subCategoryId: evYasamSubCategory.id,
    }
  })

  const product1 = await prisma.product.create({
    data: {
      name: 'Dyson V15s Detect Submarine',
      brand: 'Dyson',
      description: 'Gelişmiş sensörlü kablosuz süpürge',
      groupId: productGroup.id,
    }
  })

  const product2 = await prisma.product.create({
    data: {
      name: 'Dyson V12 Detect Slim',
      brand: 'Dyson',
      description: 'Hafif ve güçlü kablosuz süpürge',
      groupId: productGroup.id,
    }
  })

  const akilliTelefonSubCat = techSubCategories.find(c => c.name === 'Akıllı Telefonlar')!
  const phoneProductGroup = await prisma.productGroup.create({
    data: {
      name: 'Apple iPhone Serisi',
      description: 'Apple iPhone modelleri',
      subCategoryId: akilliTelefonSubCat.id,
    }
  })

  const product3 = await prisma.product.create({
    data: {
      name: 'iPhone 15 Pro',
      brand: 'Apple',
      description: 'Apple\'ın en yeni flagship telefonu',
      groupId: phoneProductGroup.id,
    }
  })
  console.log('✅ Products created')

  // Inventory & Product Experience (Reviews için)
  const inventory1 = await prisma.inventory.create({
    data: {
      userId: userIdToUse,
      productId: product1.id,
      hasOwned: true,
      experienceSummary: 'Mükemmel bir ürün, günlük kullanımda çok etkili',
    }
  })

  await prisma.productExperience.create({
    data: {
      inventoryId: inventory1.id,
      title: 'Price and Shopping Experience',
      experienceText: 'Dyson V15s Detect Submarine\'i $949\'a aldım. Premium fiyat diğer kablosuz süpürgelere göre ama kalitesi buna değer. Alışveriş deneyimi çok profesyonel.',
    }
  })

  await prisma.productExperience.create({
    data: {
      inventoryId: inventory1.id,
      title: 'Product and Usage Experience',
      experienceText: 'Günlük kullanımda Dyson V15s Submarine ev temizliğimi tamamen değiştirdi. Islak temizlik başlığı mutfak ve banyo zeminleri için mükemmel çalışıyor, döküntüleri hemen topluyor.',
    }
  })

  await prisma.inventoryMedia.create({
    data: {
      inventoryId: inventory1.id,
      mediaUrl: 'https://cdn.tipbox.co/inventory/dyson-1.jpg',
      type: 'IMAGE',
    }
  })
  console.log('✅ Inventory & Product Experiences created')

  // Content Posts
  // FREE Post (Feed)
  const freePostId = generateUlid()
  const feedPost = await prisma.contentPost.create({
    data: {
      id: freePostId,
      userId: userIdToUse,
      type: 'FREE',
      title: 'Dyson V15s Daily Experience',
      body: 'Using the Dyson V15s Submarine daily has completely changed how I clean my home. The wet cleaning head works brilliantly for kitchen and bathroom floors, picking up spills and dirt effortlessly.',
      productId: product1.id,
      mainCategoryId: evYasamCategory.id,
      subCategoryId: evYasamSubCategory.id,
      inventoryRequired: true,
      isBoosted: false,
    }
  })

  // Add tags for feed post
  await prisma.contentPostTag.createMany({
    data: [
      { postId: freePostId, tag: 'Dyson' },
      { postId: freePostId, tag: 'Vacuum Cleaner' },
      { postId: freePostId, tag: 'Home Cleaning' },
    ],
    skipDuplicates: true,
  })

  // TIPS Post (Tips&Tricks)
  const tipsPostId = generateUlid()
  await prisma.contentPost.create({
    data: {
      id: tipsPostId,
      userId: userIdToUse,
      type: 'TIPS',
      title: 'Dyson Maintenance Tips',
      body: 'Dyson V15s\'i uzun süre kullanmak için düzenli olarak filtreleri temizlemek ve şarj ederken tamamen boşaltmamak önemli. Ayrıca fırçaları ayda bir kez yıkamak performansı artırır.',
      productId: product1.id,
      mainCategoryId: evYasamCategory.id,
      subCategoryId: evYasamSubCategory.id,
      inventoryRequired: true,
      isBoosted: false,
    }
  })

  await prisma.postTip.create({
    data: {
      postId: tipsPostId,
      tipCategory: 'CARE',
      isVerified: true,
    }
  })

  await prisma.postTag.create({
    data: {
      postId: tipsPostId,
      tag: 'Maintenance',
    }
  })

  await prisma.contentPostTag.createMany({
    data: [
      { postId: tipsPostId, tag: 'Maintenance' },
      { postId: tipsPostId, tag: 'Care Tips' },
    ],
    skipDuplicates: true,
  })

  // COMPARE Post (Benchmark)
  const comparePostId = generateUlid()
  await prisma.contentPost.create({
    data: {
      id: comparePostId,
      userId: userIdToUse,
      type: 'COMPARE',
      title: 'Dyson V15s vs V12 Slim Comparison',
      body: 'Her iki modeli de test ettim. V15s daha güçlü ve daha fazla özellik sunuyor, V12 ise daha hafif ve manevra kabiliyeti daha iyi. Hangisini seçmeli?',
      productId: product1.id,
      mainCategoryId: evYasamCategory.id,
      subCategoryId: evYasamSubCategory.id,
      inventoryRequired: false,
      isBoosted: true,
    }
  })

  const comparison = await prisma.postComparison.create({
    data: {
      postId: comparePostId,
      product1Id: product1.id,
      product2Id: product2.id,
      comparisonSummary: 'V15s daha güçlü ama daha ağır, V12 daha pratik ama daha az güçlü',
    }
  })

  // Comparison Scores
  const fiyatMetric = metrics.find(m => m.name === 'Fiyat')!
  const kaliteMetric = metrics.find(m => m.name === 'Kalite')!

  await prisma.postComparisonScore.create({
    data: {
      comparisonId: comparison.id,
      metricId: fiyatMetric.id,
      scoreProduct1: 7,
      scoreProduct2: 8,
      comment: 'V12 daha uygun fiyatlı',
    }
  })

  await prisma.postComparisonScore.create({
    data: {
      comparisonId: comparison.id,
      metricId: kaliteMetric.id,
      scoreProduct1: 9,
      scoreProduct2: 8,
      comment: 'V15s kalite açısından daha üstün',
    }
  })

  // More FREE posts for feed
  for (let i = 0; i < 5; i++) {
    const postId = generateUlid()
    await prisma.contentPost.create({
      data: {
        id: postId,
        userId: userIdToUse,
        type: 'FREE',
        title: `Tech Review Post ${i + 1}`,
        body: `This is a sample review post ${i + 1}. Sharing my experience with various tech products and how they fit into my daily life.`,
        productId: i % 2 === 0 ? product1.id : product3.id,
        mainCategoryId: i % 2 === 0 ? evYasamCategory.id : techCategory.id,
        subCategoryId: i % 2 === 0 ? evYasamSubCategory.id : techSubCategories[0].id,
        inventoryRequired: i % 2 === 0,
        isBoosted: i === 0,
      }
    })
  }
  console.log('✅ Content posts created (Feed, Tips, Benchmarks)')

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

  // Feed Entries - Kullanıcıların feed'inde görünecek post'lar
  console.log('📰 Creating feed entries...')
  
  // Tüm post'ları al
  const allPostsForFeed = await prisma.contentPost.findMany({
    where: {},
    take: 20, // İlk 20 post'u feed'e ekle
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

  // NFTs and Marketplace Listings
  console.log('🎨 Creating comprehensive NFTs and Marketplace listings...')
  
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
      },
      update: {
        displayName: 'Market Test User',
        userName: 'markettest',
      }
    })
    
    // Avatar oluştur
    await prisma.userAvatar.create({
      data: {
        userId: TARGET_USER_ID,
        imageUrl: 'https://cdn.tipbox.co/avatars/market-test.jpg',
        isActive: true,
      }
    }).catch(() => {})
  } else {
    console.log(`✅ Target user already exists: ${TARGET_USER_ID}`)
  }
  
  // NFT örnekleri oluştur
  const nftTypes = ['BADGE', 'COSMETIC', 'LOOTBOX'] as const
  const nftRarities = ['COMMON', 'RARE', 'EPIC'] as const
  
  const nfts = await Promise.all([
    // ===== BELİRTİLEN KULLANICI (248cc91f-b551-4ecc-a885-db1163571330) NFT'LERİ =====
    // Satışta OLMAYAN NFT'ler (koleksiyon)
    prisma.nFT.create({
      data: {
        name: 'Tipbox Pioneer Badge',
        description: 'Platformun ilk günlerinden beri burada olanlar için özel efsanevi badge. Sadece 100 adet basılmıştır.',
        imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/pioneer-badge.png',
        type: 'BADGE',
        rarity: 'EPIC',
        isTransferable: true,
        currentOwnerId: TARGET_USER_ID,
      } as any
    }),
    prisma.nFT.create({
      data: {
        name: 'Diamond Profile Frame',
        description: 'Elmas işlemeli, parlayan profil çerçevesi. Profilinize lüks bir görünüm katar.',
        imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/diamond-frame.png',
        type: 'COSMETIC',
        rarity: 'EPIC',
        isTransferable: true,
        currentOwnerId: TARGET_USER_ID,
      } as any
    }),
    prisma.nFT.create({
      data: {
        name: 'Top Contributor Badge',
        description: 'En değerli içerik üreticilerine verilen nadir badge. Topluluğa katkılarınızdan dolayı teşekkürler!',
        imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/contributor-badge.png',
        type: 'BADGE',
        rarity: 'RARE',
        isTransferable: true,
        currentOwnerId: TARGET_USER_ID,
      } as any
    }),
    prisma.nFT.create({
      data: {
        name: 'Neon Pulse Avatar Border',
        description: 'Neon ışıklı, nabız gibi atan avatar çerçevesi. Dikkat çekici ve modern bir görünüm.',
        imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/neon-pulse-border.png',
        type: 'COSMETIC',
        rarity: 'RARE',
        isTransferable: true,
        currentOwnerId: TARGET_USER_ID,
      } as any
    }),
    
    // Satışta OLAN NFT'ler (bu kullanıcının listelediği)
    prisma.nFT.create({
      data: {
        name: 'Gold Star Badge',
        description: 'Altın yıldız şeklinde parlayan badge. Başarılı kullanıcılara özel.',
        imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/gold-star-badge.png',
        type: 'BADGE',
        rarity: 'RARE',
        isTransferable: true,
        currentOwnerId: null, // Satışta olduğu için owner yok
      } as any
    }),
    prisma.nFT.create({
      data: {
        name: 'Platinum Crown Frame',
        description: 'Platin taç şeklinde profil çerçevesi. Kraliyet ailesi üyesi gibi görünün!',
        imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/platinum-crown.png',
        type: 'COSMETIC',
        rarity: 'EPIC',
        isTransferable: true,
        currentOwnerId: null,
      } as any
    }),
    prisma.nFT.create({
      data: {
        name: 'Rainbow Holographic Badge',
        description: 'Gökkuşağı renklerinde, hologram efektli badge. Işığa göre renk değiştirir.',
        imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/rainbow-holographic.png',
        type: 'BADGE',
        rarity: 'EPIC',
        isTransferable: true,
        currentOwnerId: null,
      } as any
    }),
    prisma.nFT.create({
      data: {
        name: 'Cyber Neon Glow Effect',
        description: 'Siberpunk temalı neon ışıltı efekti. Avatarınızın etrafında mavi-pembe neon hale.',
        imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/cyber-neon-glow.png',
        type: 'COSMETIC',
        rarity: 'RARE',
        isTransferable: true,
        currentOwnerId: null,
      } as any
    }),
    prisma.nFT.create({
      data: {
        name: 'Mystery Treasure Box',
        description: 'İçinde rastgele nadir ödül bulunan gizemli hazine kutusu. Açınca ne çıkacak?',
        imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/treasure-box.png',
        type: 'LOOTBOX',
        rarity: 'EPIC',
        isTransferable: true,
        currentOwnerId: null,
      } as any
    }),
    prisma.nFT.create({
      data: {
        name: 'Silver Achievement Badge',
        description: 'Gümüş başarı rozeti. Önemli milestone\'ları temsil eder.',
        imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/silver-achievement.png',
        type: 'BADGE',
        rarity: 'COMMON',
        isTransferable: true,
        currentOwnerId: null,
      } as any
    }),
    
    // ===== TEST KULLANICISI (Ömer Faruk) NFT'LERİ =====
    // Test kullanıcısına ait NFT'ler (satışta değil)
    prisma.nFT.create({
      data: {
        name: 'Premium Tipbox Badge',
        description: 'Tipbox platformunda aktif olan kullanıcılara özel nadir badge',
        imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/premium-badge.png',
        type: 'BADGE',
        rarity: 'EPIC',
        isTransferable: true,
        currentOwnerId: userIdToUse,
      } as any
    }),
    prisma.nFT.create({
      data: {
        name: 'Early Adopter Badge',
        description: 'Platformun ilk kullanıcılarına özel badge',
        imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/early-adopter.png',
        type: 'BADGE',
        rarity: 'RARE',
        isTransferable: true,
        currentOwnerId: userIdToUse,
      } as any
    }),
    prisma.nFT.create({
      data: {
        name: 'Golden Frame',
        description: 'Profil çerçevesi için özel altın renkli cosmetic item',
        imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/golden-frame.png',
        type: 'COSMETIC',
        rarity: 'EPIC',
        isTransferable: true,
        currentOwnerId: userIdToUse,
      } as any
    }),
    
    // Satışa konulacak NFT'ler (test kullanıcısına ait)
    prisma.nFT.create({
      data: {
        name: 'Silver Badge',
        description: 'Gümüş renkli özel badge',
        imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/silver-badge.png',
        type: 'BADGE',
        rarity: 'COMMON',
        isTransferable: true,
        currentOwnerId: userIdToUse,
      } as any
    }),
    prisma.nFT.create({
      data: {
        name: 'Rainbow Avatar Border',
        description: 'Profil avatarı için renkli çerçeve',
        imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/rainbow-border.png',
        type: 'COSMETIC',
        rarity: 'RARE',
        isTransferable: true,
        currentOwnerId: userIdToUse,
      } as any
    }),
    prisma.nFT.create({
      data: {
        name: 'Mystery Lootbox',
        description: 'İçinde rastgele ödül bulunan gizemli kutu',
        imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/mystery-lootbox.png',
        type: 'LOOTBOX',
        rarity: 'EPIC',
        isTransferable: true,
        currentOwnerId: userIdToUse,
      } as any
    }),
    
    // Diğer kullanıcılara ait NFT'ler (satışta)
    ...(await Promise.all([
      // User 1'e ait NFT'ler
      prisma.nFT.create({
        data: {
          name: 'Community Helper Badge',
          description: 'Toplulukta yardımseverlik gösterenlere özel badge',
          imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/helper-badge.png',
          type: 'BADGE',
          rarity: 'RARE',
          isTransferable: true,
          currentOwnerId: allUsers.length > 1 ? allUsers[1].id : userIdToUse,
        } as any
      }),
      prisma.nFT.create({
        data: {
          name: 'Blue Neon Frame',
          description: 'Mavi neon efektli profil çerçevesi',
          imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/blue-neon-frame.png',
          type: 'COSMETIC',
          rarity: 'COMMON',
          isTransferable: true,
          currentOwnerId: allUsers.length > 1 ? allUsers[1].id : userIdToUse,
        } as any
      }),
      // User 2'ye ait NFT'ler
      prisma.nFT.create({
        data: {
          name: 'Top Reviewer Badge',
          description: 'En çok değerlendirme yapan kullanıcılara özel badge',
          imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/reviewer-badge.png',
          type: 'BADGE',
          rarity: 'EPIC',
          isTransferable: true,
          currentOwnerId: allUsers.length > 2 ? allUsers[2].id : userIdToUse,
        } as any
      }),
      prisma.nFT.create({
        data: {
          name: 'Purple Glow Effect',
          description: 'Profil için mor ışıltı efekti',
          imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/purple-glow.png',
          type: 'COSMETIC',
          rarity: 'RARE',
          isTransferable: true,
          currentOwnerId: allUsers.length > 2 ? allUsers[2].id : userIdToUse,
        } as any
      }),
      prisma.nFT.create({
        data: {
          name: 'Legendary Lootbox',
          description: 'Efsanevi ödüller içeren özel kutu',
          imageUrl: 'https://tipbox-assets.s3.amazonaws.com/nfts/legendary-lootbox.png',
          type: 'LOOTBOX',
          rarity: 'EPIC',
          isTransferable: true,
          currentOwnerId: allUsers.length > 2 ? allUsers[2].id : userIdToUse,
        } as any
      }),
    ]))
  ])
  
  console.log(`✅ ${nfts.length} NFT oluşturuldu`)

  // NFT Transaction'ları oluştur (mint işlemleri) - sadece ilk batch için
  for (const nft of nfts) {
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
  const targetUserListings = await Promise.all([
    prisma.nFTMarketListing.create({
      data: {
        nftId: nfts[4].id, // Gold Star Badge
        listedByUserId: TARGET_USER_ID,
        price: 125.0,
        status: 'ACTIVE',
      }
    }),
    prisma.nFTMarketListing.create({
      data: {
        nftId: nfts[5].id, // Platinum Crown Frame
        listedByUserId: TARGET_USER_ID,
        price: 850.0,
        status: 'ACTIVE',
      }
    }),
    prisma.nFTMarketListing.create({
      data: {
        nftId: nfts[6].id, // Rainbow Holographic Badge
        listedByUserId: TARGET_USER_ID,
        price: 750.0,
        status: 'ACTIVE',
      }
    }),
    prisma.nFTMarketListing.create({
      data: {
        nftId: nfts[7].id, // Cyber Neon Glow Effect
        listedByUserId: TARGET_USER_ID,
        price: 425.0,
        status: 'ACTIVE',
      }
    }),
    prisma.nFTMarketListing.create({
      data: {
        nftId: nfts[8].id, // Mystery Treasure Box
        listedByUserId: TARGET_USER_ID,
        price: 1500.0,
        status: 'ACTIVE',
      }
    }),
    prisma.nFTMarketListing.create({
      data: {
        nftId: nfts[9].id, // Silver Achievement Badge
        listedByUserId: TARGET_USER_ID,
        price: 35.0,
        status: 'ACTIVE',
      }
    }),
  ])
  console.log(`✅ ${targetUserListings.length} listing created for target user`)

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
          description: `${userIdx + 1}. kullanıcının özel koleksiyoner badge'i`,
          imageUrl: `https://tipbox-assets.s3.amazonaws.com/nfts/collector-${userIdx + 1}.png`,
          type: 'BADGE',
          rarity: userIdx === 0 ? 'EPIC' : userIdx === 1 ? 'RARE' : 'COMMON',
          isTransferable: true,
          currentOwnerId: user.id,
        } as any
      }),
      prisma.nFT.create({
        data: {
          name: `Vintage Frame ${userIdx + 1}`,
          description: `Klasik ve şık görünümlü profil çerçevesi #${userIdx + 1}`,
          imageUrl: `https://tipbox-assets.s3.amazonaws.com/nfts/vintage-frame-${userIdx + 1}.png`,
          type: 'COSMETIC',
          rarity: userIdx === 0 ? 'RARE' : 'COMMON',
          isTransferable: true,
          currentOwnerId: null, // Satışta
        } as any
      }),
      prisma.nFT.create({
        data: {
          name: `Lucky Box #${userIdx + 1}`,
          description: `Şanslı numara ${userIdx + 1}! İçinde ne var?`,
          imageUrl: `https://tipbox-assets.s3.amazonaws.com/nfts/lucky-box-${userIdx + 1}.png`,
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
  const testUserListings = await Promise.all([
    ...(nfts.length > 10 ? [
      prisma.nFTMarketListing.create({
        data: {
          nftId: nfts[13]?.id, // Silver Badge (eski index)
          listedByUserId: userIdToUse,
          price: 50.0,
          status: 'ACTIVE',
        }
      }).catch(() => null),
      prisma.nFTMarketListing.create({
        data: {
          nftId: nfts[14]?.id, // Rainbow Avatar Border
          listedByUserId: userIdToUse,
          price: 150.0,
          status: 'ACTIVE',
        }
      }).catch(() => null),
    ] : [])
  ])

  const marketplaceListings = [
    ...targetUserListings,
    ...otherUserListings,
    ...testUserListings.filter(Boolean),
  ]
  
  console.log(`✅ ${marketplaceListings.length} marketplace listing oluşturuldu`)

  // NFT'lere gerçekçi attribute'lar ekle
  const allNFTs = [...nfts, ...otherUserNFTs]
  for (let i = 0; i < Math.min(20, allNFTs.length); i++) {
    const nft = allNFTs[i]
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

  // ===== EXPLORE SECTION - Marketplace Banners, Trending Posts, Events =====
  console.log('🔍 Creating explore data...')

  // 1. Marketplace Banners
  console.log('📰 Creating marketplace banners...')
  const banners = await Promise.all([
    prisma.marketplaceBanner.create({
      data: {
        title: 'Yeni Sezon NFT Koleksiyonu',
        description: 'Sınırlı sayıda özel avatar ve badge NFT\'leri şimdi satışta!',
        imageUrl: 'https://images.unsplash.com/photo-1634193295627-1cdddf751ebf?w=800',
        linkUrl: '/marketplace/listings?type=BADGE',
        isActive: true,
        displayOrder: 1,
      },
    }),
    prisma.marketplaceBanner.create({
      data: {
        title: 'Epic Rarity İndirimi',
        description: '%30 indirimli EPIC rarity NFT\'lere göz at',
        imageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800',
        linkUrl: '/marketplace/listings?rarity=EPIC',
        isActive: true,
        displayOrder: 2,
      },
    }),
    prisma.marketplaceBanner.create({
      data: {
        title: 'Yeni Markalar Platformda',
        description: 'Ünlü markalar TipBox\'a katıldı! Hemen keşfet.',
        imageUrl: 'https://images.unsplash.com/photo-1556742400-b5a9d4555f7c?w=800',
        linkUrl: '/explore/brands/new',
        isActive: true,
        displayOrder: 3,
      },
    }),
  ])
  console.log(`✅ ${banners.length} marketplace banner oluşturuldu`)

  // 2. Trending Posts - Add some posts to trending
  console.log('📈 Creating trending posts...')
  const allContentPosts = await prisma.contentPost.findMany({ take: 10 })
  const postsForTrending = allContentPosts.slice(0, 8) // Top 8 posts will be trending
  const trendingPosts: any[] = []
  for (const post of postsForTrending) {
    const index = postsForTrending.indexOf(post)
    try {
      const trendingPost = await prisma.trendingPost.create({
        data: {
          id: generateUlid(),
          postId: post.id,
          score: 100 - index * 10, // Descending scores
          trendPeriod: 'DAILY',
          calculatedAt: new Date(),
        },
      })
      trendingPosts.push(trendingPost)
    } catch (error) {
      // Skip if already exists (unique constraint)
      console.log(`⚠️  Trending post for ${post.id} already exists, skipping...`)
    }
  }
  console.log(`✅ ${trendingPosts.length} trending post oluşturuldu`)

  // 3. Wishbox Events (What's News)
  console.log('🎪 Creating wishbox events...')
  const today = new Date()
  const nextWeek = new Date()
  nextWeek.setDate(today.getDate() + 7)
  const nextMonth = new Date()
  nextMonth.setMonth(today.getMonth() + 1)

  const events = await Promise.all([
    prisma.wishboxEvent.create({
      data: {
        id: generateUlid(),
        title: 'Yılbaşı Mega Ödül Anketi',
        description: 'Yılın en iyi ürünlerini belirle, büyük ödüller kazan! 1000 TIPS havuzu seni bekliyor.',
        startDate: today,
        endDate: nextMonth,
        status: 'PUBLISHED',
      },
    }),
    prisma.wishboxEvent.create({
      data: {
        id: generateUlid(),
        title: 'Teknoloji Trendleri 2024',
        description: '2024\'ün en çok beklenen teknoloji ürünlerini seçiyoruz. Senin tercihin ne?',
        startDate: today,
        endDate: nextWeek,
        status: 'PUBLISHED',
      },
    }),
    prisma.wishboxEvent.create({
      data: {
        id: generateUlid(),
        title: 'Kahve Tutkunlarının Anketi',
        description: 'En iyi kahve makinesi hangisi? Kahve severlerin tercihleri bu etkinlikte belirleniyor.',
        startDate: today,
        endDate: nextWeek,
        status: 'PUBLISHED',
      },
    }),
  ])
  console.log(`✅ ${events.length} wishbox event oluşturuldu`)

  // Create scenarios for events
  console.log('🎯 Creating event scenarios...')
  const scenarios = await Promise.all([
    // Event 1 - Yılbaşı scenarios
    prisma.wishboxScenario.create({
      data: {
        eventId: events[0].id,
        title: 'Yılın En İyi Telefonu',
        description: 'Hangi telefon 2024\'ün şampiyonu olmalı?',
        orderIndex: 1,
      },
    }),
    prisma.wishboxScenario.create({
      data: {
        eventId: events[0].id,
        title: 'Yılın En İyi Laptop\'u',
        description: 'En iyi performansı hangi laptop verdi?',
        orderIndex: 2,
      },
    }),
    // Event 2 - Technology scenarios
    prisma.wishboxScenario.create({
      data: {
        eventId: events[1].id,
        title: 'En Beklenen Akıllı Saat',
        description: '2024\'te hangi akıllı saati almayı düşünüyorsun?',
        orderIndex: 1,
      },
    }),
    // Event 3 - Coffee scenarios
    prisma.wishboxScenario.create({
      data: {
        eventId: events[2].id,
        title: 'Tam Otomatik vs Manuel',
        description: 'Tam otomatik mı, manuel kahve makinesi mi?',
        orderIndex: 1,
      },
    }),
  ])
  console.log(`✅ ${scenarios.length} scenario oluşturuldu`)

  // Add event statistics for some users
  console.log('📊 Creating event statistics...')
  const allUserIds = [userIdToUse, TARGET_USER_ID, ...TRUST_USER_IDS.slice(0, 3)]
  const eventStats = await Promise.all(
    events.flatMap((event) =>
      allUserIds.map((userId, index) =>
        prisma.wishboxStats.create({
          data: {
            userId,
            eventId: event.id,
            totalParticipated: Math.floor(Math.random() * 5) + 1,
            totalComments: Math.floor(Math.random() * 10),
            helpfulVotesReceived: Math.floor(Math.random() * 20),
          },
        })
      )
    )
  )
  console.log(`✅ ${eventStats.length} event stat oluşturuldu`)

  // 4. Create some brands (if not exist)
  console.log('🏢 Creating brands...')
  const brandsData = [
    {
      name: 'TechVision',
      description: 'Yenilikçi teknoloji ürünleri ve çözümleri sunan global marka',
      logoUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=200',
      category: 'Technology',
    },
    {
      name: 'SmartHome Pro',
      description: 'Akıllı ev sistemleri ve IoT cihazları konusunda uzman',
      logoUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200',
      category: 'Home & Living',
    },
    {
      name: 'CoffeeDelight',
      description: 'Premium kahve makineleri ve barista ekipmanları',
      logoUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=200',
      category: 'Kitchen',
    },
    {
      name: 'FitnessTech',
      description: 'Akıllı spor ekipmanları ve sağlık takip cihazları',
      logoUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=200',
      category: 'Health & Fitness',
    },
    {
      name: 'StyleHub',
      description: 'Modern ve şık yaşam ürünleri markası',
      logoUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200',
      category: 'Fashion',
    },
  ]

  const brands = await Promise.all(
    brandsData.map((brandData) =>
      prisma.brand.create({
        data: brandData,
      }).catch(() => null)
    )
  )
  const createdBrands = brands.filter(Boolean)
  console.log(`✅ ${createdBrands.length} brand oluşturuldu`)

  // 5. Create Expert Requests and Answers
  console.log('💡 Creating expert requests...')
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

  // 6. Create DM Requests (Support Requests)
  console.log('💌 Creating DM requests (support requests)...')
  
  // DM Request descriptions (support request scenarios)
  const dmRequestDescriptions = [
    'Merhaba! iPhone 15 Pro hakkında birkaç sorum var. Özellikle kamera performansı ve pil ömrü konusunda deneyimlerinizi paylaşabilir misiniz?',
    'Dyson V15s kullanıyor musunuz? Islak temizlik özelliği gerçekten işe yarıyor mu? Ev temizliği için önerir misiniz?',
    'MacBook Air M3 ile programlama yapıyorum. Xcode ve Visual Studio Code performansı nasıl? Önerir misiniz?',
    'Sony WH-1000XM5 kulaklık kullanıyorum ama AirPods Max\'i de merak ediyorum. Noise cancellation karşılaştırması yapabilir miyiz?',
    'Nespresso ve DeLonghi tam otomatik kahve makineleri arasında karar veremiyorum. Hangisini önerirsiniz?',
    'Dyson V12 ve V15s arasındaki farklar nelerdir? Hangi modeli almalıyım?',
    'iPhone kamera ayarları konusunda yardıma ihtiyacım var. Profesyonel fotoğraf çekimi için ipuçlarınız var mı?',
    'Laptop alışverişi yapıyorum. Dell XPS 13 ve MacBook Air M3 arasında karar veremiyorum. Hangisi daha iyi?',
    'Akıllı saat önerisi arıyorum. Apple Watch ve Samsung Galaxy Watch karşılaştırması yapabilir misiniz?',
    'Kablosuz kulaklık arıyorum. Noise cancellation özelliği olan, günlük kullanım için uygun bir model önerebilir misiniz?',
  ]

  const dmRequests: any[] = []
  const now = new Date()
  
  // 1. Test user'dan trust user'lara PENDING request'ler (description ile)
  for (let i = 0; i < Math.min(3, trustUserIds.length); i++) {
    const trustUserId = trustUserIds[i]
    const description = dmRequestDescriptions[i % dmRequestDescriptions.length]
    
    try {
      const dmRequest = await prisma.dMRequest.create({
        data: {
          fromUserId: userIdToUse,
          toUserId: trustUserId,
          status: 'PENDING',
          description: description,
          sentAt: new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000), // 1, 2, 3 gün önce
        },
      })
      dmRequests.push(dmRequest)
    } catch (error) {
      // Skip if already exists (unique constraint)
      console.log(`⚠️  DM request from ${userIdToUse} to ${trustUserId} already exists, skipping...`)
    }
  }

  // 2. Test user'dan target user'a ACCEPTED request (description ile)
  try {
    const acceptedRequest = await prisma.dMRequest.create({
      data: {
        fromUserId: userIdToUse,
        toUserId: TARGET_USER_ID,
        status: 'ACCEPTED',
        description: dmRequestDescriptions[3],
        sentAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 gün önce
        respondedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), // 4 gün önce kabul edildi
      },
    })
    dmRequests.push(acceptedRequest)
  } catch (error) {
    console.log(`⚠️  DM request from ${userIdToUse} to ${TARGET_USER_ID} already exists, skipping...`)
  }

  // 3. Target user'dan test user'a DECLINED request
  try {
    const declinedRequest = await prisma.dMRequest.create({
      data: {
        fromUserId: TARGET_USER_ID,
        toUserId: userIdToUse,
        status: 'DECLINED',
        description: dmRequestDescriptions[4],
        sentAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 gün önce
        respondedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), // 6 gün önce reddedildi
      },
    })
    dmRequests.push(declinedRequest)
  } catch (error) {
    console.log(`⚠️  DM request from ${TARGET_USER_ID} to ${userIdToUse} already exists, skipping...`)
  }

  // 4. Trust user'lardan test user'a PENDING request'ler
  for (let i = 0; i < Math.min(2, trustUserIds.length); i++) {
    const trustUserId = trustUserIds[i]
    const description = dmRequestDescriptions[(i + 5) % dmRequestDescriptions.length]
    
    try {
      const dmRequest = await prisma.dMRequest.create({
        data: {
          fromUserId: trustUserId,
          toUserId: userIdToUse,
          status: 'PENDING',
          description: description,
          sentAt: new Date(now.getTime() - (i + 2) * 24 * 60 * 60 * 1000), // 2, 3 gün önce
        },
      })
      dmRequests.push(dmRequest)
    } catch (error) {
      console.log(`⚠️  DM request from ${trustUserId} to ${userIdToUse} already exists, skipping...`)
    }
  }

  // 5. Trust user'lar arasında ACCEPTED request'ler
  if (trustUserIds.length >= 2) {
    try {
      const acceptedRequestBetweenTrustUsers = await prisma.dMRequest.create({
        data: {
          fromUserId: trustUserIds[0],
          toUserId: trustUserIds[1],
          status: 'ACCEPTED',
          description: dmRequestDescriptions[6],
          sentAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 gün önce
          respondedAt: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000), // 9 gün önce kabul edildi
        },
      })
      dmRequests.push(acceptedRequestBetweenTrustUsers)
    } catch (error) {
      console.log(`⚠️  DM request from ${trustUserIds[0]} to ${trustUserIds[1]} already exists, skipping...`)
    }
  }

  // 6. Truster user'lardan test user'a ACCEPTED request'ler
  for (let i = 0; i < Math.min(2, TRUSTER_USER_IDS.length); i++) {
    const trusterUserId = TRUSTER_USER_IDS[i]
    const description = dmRequestDescriptions[(i + 7) % dmRequestDescriptions.length]
    
    try {
      const dmRequest = await prisma.dMRequest.create({
        data: {
          fromUserId: trusterUserId,
          toUserId: userIdToUse,
          status: 'ACCEPTED',
          description: description,
          sentAt: new Date(now.getTime() - (i + 8) * 24 * 60 * 60 * 1000), // 8, 9 gün önce
          respondedAt: new Date(now.getTime() - (i + 7) * 24 * 60 * 60 * 1000), // 7, 8 gün önce kabul edildi
        },
      })
      dmRequests.push(dmRequest)
    } catch (error) {
      console.log(`⚠️  DM request from ${trusterUserId} to ${userIdToUse} already exists, skipping...`)
    }
  }

  // 7. Target user'dan trust user'lara PENDING request'ler
  for (let i = 0; i < Math.min(2, trustUserIds.length); i++) {
    const trustUserId = trustUserIds[i]
    const description = dmRequestDescriptions[(i + 8) % dmRequestDescriptions.length]
    
    try {
      const dmRequest = await prisma.dMRequest.create({
        data: {
          fromUserId: TARGET_USER_ID,
          toUserId: trustUserId,
          status: 'PENDING',
          description: description,
          sentAt: new Date(now.getTime() - (i + 1) * 12 * 60 * 60 * 1000), // 12, 24 saat önce
        },
      })
      dmRequests.push(dmRequest)
    } catch (error) {
      console.log(`⚠️  DM request from ${TARGET_USER_ID} to ${trustUserId} already exists, skipping...`)
    }
  }

  console.log(`✅ ${dmRequests.length} DM request (support request) oluşturuldu`)

  // Create threads for ACCEPTED requests (for active status)
  console.log('💬 Creating DM threads for ACCEPTED requests...')
  const acceptedRequests = await prisma.dMRequest.findMany({
    where: {
      status: 'ACCEPTED',
      description: { not: null },
    },
  })

  let threadsCreated = 0
  for (const request of acceptedRequests) {
    try {
      // Check if thread already exists
      const existingThread = await prisma.dMThread.findFirst({
        where: {
          OR: [
            { userOneId: request.fromUserId, userTwoId: request.toUserId },
            { userOneId: request.toUserId, userTwoId: request.fromUserId },
          ],
        },
      })

      if (!existingThread) {
        await prisma.dMThread.create({
          data: {
            userOneId: request.fromUserId,
            userTwoId: request.toUserId,
            isActive: true, // Active threads for support requests
            startedAt: request.respondedAt || request.sentAt,
          },
        })
        threadsCreated++
      } else {
        // Update existing thread to active if it's not active
        if (!existingThread.isActive) {
          await prisma.dMThread.update({
            where: { id: existingThread.id },
            data: { isActive: true },
          })
          threadsCreated++
        }
      }
    } catch (error) {
      console.log(`⚠️  Thread creation failed for request ${request.id}:`, error)
    }
  }
  console.log(`✅ ${threadsCreated} DM thread oluşturuldu/güncellendi (ACCEPTED requests için)`)

  console.log('✨ Seed process completed successfully!')
  
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
  summaryLines.push(`• ${events.length} Wishbox Events`)
  summaryLines.push(`• ${scenarios.length} Event Scenarios`)
  summaryLines.push(`• ${eventStats.length} Event Statistics`)
  summaryLines.push(`• ${createdBrands.length} Brands`)
  summaryLines.push(`• ${expertRequests.length} Expert Requests`)
  summaryLines.push(`• ${expertAnswers.length} Expert Answers`)
  summaryLines.push(`• ${dmRequests.length} DM Requests (Support Requests)`)
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
  summaryLines.push('• Filtered Feed: GET /feed/filtered?types=feed,benchmark,post,question,tipsAndTricks')
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
  summaryLines.push('')
  summaryLines.push('🔍 Explore Endpoints:')
  summaryLines.push('• Hottest/Trending: GET /explore/hottest (with auth token)')
  summaryLines.push('• Marketplace Banners: GET /explore/marketplace-banners')
  summaryLines.push('• What\'s News (Events): GET /explore/events')
  summaryLines.push('• New Brands: GET /explore/brands/new')
  summaryLines.push('• New Products: GET /explore/products/new')
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
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
