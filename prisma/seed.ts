import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import * as bcrypt from 'bcryptjs'
import { DEFAULT_PROFILE_BANNER_URL } from '../src/domain/user/profile.constants'
import { getSeedMediaUrl, SeedMediaKey } from './seed/helpers/media.helper'

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

const DEFAULT_BANNER_URL = DEFAULT_PROFILE_BANNER_URL || getSeedMediaUrl('user.banner.primary')
const PRIMARY_AVATAR_URL = getSeedMediaUrl('user.avatar.primary')
const MARKET_AVATAR_URL = getSeedMediaUrl('user.avatar.market')
const INVENTORY_MEDIA_URL = getSeedMediaUrl('inventory.dyson-media', 'https://cdn.tipbox.co/inventory/dyson-1.jpg')
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
const COMMUNITY_COACH_USER_ID = '66666666-6666-4666-a666-666666666666'
const COMMUNITY_COACH_EMAIL = 'coach@tipbox.co'
const COMMUNITY_COACH_AVATAR_URL = getSeedMediaUrl('user.avatar.truster3')
const TARGET_USER_TITLE = 'Marketplace Strategist'

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
  // Görsel eşleştirmeleri: kategori isimlerine göre assets/catalog görselleri
  const categoryConfigs = [
    { name: 'Teknoloji', description: 'Elektronik cihazlar, yazılım, mobil uygulamalar', imageKey: 'catalog.computers-tablets' },
    { name: 'Ev & Yaşam', description: 'Ev eşyaları, dekorasyon, temizlik ürünleri', imageKey: 'catalog.home-appliances' },
    { name: 'Gıda & İçecek', description: 'Yiyecek, içecek, gıda takviyesi ürünleri', imageKey: 'catalog.air-conditioner' },
    { name: 'Moda & Aksesuar', description: 'Giyim, ayakkabı, çanta, takı ve aksesuarlar', imageKey: 'catalog.printers' },
    { name: 'Sağlık & Güzellik', description: 'Kişisel bakım, kozmetik, sağlık ürünleri', imageKey: 'catalog.smart-home-devices' },
    { name: 'Spor & Outdoor', description: 'Spor ekipmanları, outdoor aktiviteler, fitness', imageKey: 'catalog.drone' },
    { name: 'Hobi & Eğlence', description: 'Kitap, oyun, müzik, sanat malzemeleri', imageKey: 'catalog.games' },
    { name: 'Otomotiv', description: 'Araç aksesuarları, bakım ürünleri, parçalar', imageKey: 'catalog.otomotiv' },
    { name: 'Technology', description: 'Consumer electronics, gadgets and digital services', imageKey: 'catalog.computers-tablets' },
    { name: 'Fashion', description: 'Lifestyle, apparel and accessory brands', imageKey: 'catalog.games' },
    { name: 'Health & Fitness', description: 'Health monitoring, wellness and fitness devices', imageKey: 'catalog.smart-home-devices' },
    { name: 'Kitchen', description: 'Kitchen appliances and coffee/brewing equipment', imageKey: 'catalog.home-appliances' },
    { name: 'Home & Living', description: 'Home comfort, living and decoration products', imageKey: 'catalog.kucukev' },
  ];

  // Mevcut kategorileri bul veya oluştur (tekrar önleme)
  const mainCategories = await Promise.all(
    categoryConfigs.map(async (config) => {
      // Önce mevcut kategoriyi bul
      const existing = await prisma.mainCategory.findFirst({
        where: { name: config.name }
      });

      if (existing) {
        // Mevcut kategoriyi güncelle
        const imageUrl = getSeedMediaUrl(config.imageKey as any);
        return prisma.mainCategory.update({
          where: { id: existing.id },
          data: {
            description: config.description,
            imageUrl: imageUrl,
          }
        });
      } else {
        // Yeni kategori oluştur
        const imageUrl = getSeedMediaUrl(config.imageKey as any);
        return prisma.mainCategory.create({
          data: {
            name: config.name,
            description: config.description,
            imageUrl: imageUrl,
          }
        });
      }
    })
  );

  console.log(`✅ ${mainCategories.length} ana kategori oluşturuldu/güncellendi`)

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
      description: 'Tipbox\'a hoş geldin! İlk kayıt rozetin.',
      type: 'ACHIEVEMENT',
      rarity: 'COMMON',
      boostMultiplier: 1.0,
      rewardMultiplier: 1.0,
      categoryId: achievementCategory.id,
      imageKey: 'badge.welcome',
    },
    {
      name: 'First Post',
      description: 'İlk gönderini paylaştın! İyi başlangıç.',
      type: 'ACHIEVEMENT',
      rarity: 'COMMON',
      boostMultiplier: 1.1,
      rewardMultiplier: 1.1,
      categoryId: achievementCategory.id,
      imageKey: 'badge.first-post',
    },
    {
      name: 'Tip Master',
      description: '10 faydalı ipucu paylaştın. Sen bir uzman!',
      type: 'ACHIEVEMENT',
      rarity: 'RARE',
      boostMultiplier: 1.3,
      rewardMultiplier: 1.3,
      categoryId: achievementCategory.id,
      imageKey: 'badge.tip-master',
    },
    {
      name: 'Community Hero',
      description: '100 faydalı yorum yaptın. Topluluk kahramanı!',
      type: 'ACHIEVEMENT',
      rarity: 'EPIC',
      boostMultiplier: 1.5,
      rewardMultiplier: 1.5,
      categoryId: communityCategory.id,
    },
    {
      name: 'Early Bird',
      description: 'Tipbox\'un ilk kullanıcılarından birisin!',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.2,
      rewardMultiplier: 1.4,
      categoryId: eventCategory.id,
      imageKey: 'badge.early-bird',
    },
    {
      name: 'Beta Tester',
      description: 'Beta sürecinde bize yardım ettin. Teşekkürler!',
      type: 'EVENT',
      rarity: 'EPIC',
      boostMultiplier: 1.4,
      rewardMultiplier: 1.6,
      categoryId: eventCategory.id,
    },
    {
      name: 'Benchmark Sage',
      description: 'Benchmark paylaşımların topluluk için referans noktası oldu.',
      type: 'ACHIEVEMENT',
      rarity: 'RARE',
      boostMultiplier: 1.35,
      rewardMultiplier: 1.35,
      categoryId: achievementCategory.id,
    },
    {
      name: 'Experience Curator',
      description: 'Birden fazla kategoride derinlemesine 15+ deneyim paylaştın.',
      type: 'ACHIEVEMENT',
      rarity: 'EPIC',
      boostMultiplier: 1.5,
      rewardMultiplier: 1.6,
      categoryId: achievementCategory.id,
    },
    {
      name: 'Bridge Ambassador',
      description: 'Bridge topluluk etkinliklerinde marka elçisi seçildin.',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.25,
      rewardMultiplier: 1.35,
      categoryId: eventCategory.id,
    },
    {
      name: 'Brand Visionary',
      description: 'En yaratıcı bridge kampanyasını yöneterek vitrine çıktın.',
      type: 'EVENT',
      rarity: 'EPIC',
      boostMultiplier: 1.55,
      rewardMultiplier: 1.65,
      categoryId: eventCategory.id,
    },
  ];

  const badges = await Promise.all(
    badgeConfigs.map(async ({ imageKey, ...config }) => {
      const imageUrl = imageKey ? getSeedMediaUrl(imageKey) : null;
      const existing = await prisma.badge.findFirst({
        where: { name: config.name }
      }).catch(() => null);

      if (existing) {
        // Mevcut badge'i senkronize et
        return prisma.badge.update({
          where: { id: existing.id },
          data: {
            description: config.description,
            type: config.type as any,
            rarity: config.rarity as any,
            boostMultiplier: config.boostMultiplier,
            rewardMultiplier: config.rewardMultiplier,
            categoryId: config.categoryId,
            imageUrl: imageUrl ?? existing.imageUrl,
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
  
  // SubCategory konfigürasyonları
  const subCategoryConfigs = [
    { name: 'Akıllı Telefonlar', description: 'iPhone, Android, Samsung, Xiaomi vs.', imageKey: 'catalog.phones' },
    { name: 'Laptoplar', description: 'Dizüstü bilgisayarlar, ultrabook, gaming laptop', imageKey: 'catalog.computers-tablets' },
    { name: 'Kulaklıklar', description: 'Kablosuz, kablolu, gaming, studio kulaklık', imageKey: 'catalog.headphones' },
    { name: 'Akıllı Saatler', description: 'Apple Watch, Samsung Galaxy Watch, fitness tracker', imageKey: 'catalog.tv' },
  ];

  // Mevcut sub kategorileri bul veya oluştur (tekrar önleme)
  const techSubCategories = await Promise.all(
    subCategoryConfigs.map(async (config) => {
      // Önce mevcut sub category'yi bul (aynı isim ve main category'de)
      const existing = await prisma.subCategory.findFirst({
        where: { 
          name: config.name,
          mainCategoryId: techCategory.id
        }
      });

      if (existing) {
        // Mevcut sub category'yi güncelle
        const imageUrl = getSeedMediaUrl(config.imageKey as any);
        return prisma.subCategory.update({
          where: { id: existing.id },
          data: {
            description: config.description,
            imageUrl: imageUrl,
          }
        });
      } else {
        // Yeni sub category oluştur
        const imageUrl = getSeedMediaUrl(config.imageKey as any);
        return prisma.subCategory.create({
          data: {
            name: config.name,
            description: config.description,
            mainCategoryId: techCategory.id,
            imageUrl: imageUrl,
          }
        });
      }
    })
  );

  console.log(`✅ ${techSubCategories.length} teknoloji alt kategorisi oluşturuldu/güncellendi`)

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
        imageUrl: PRIMARY_AVATAR_URL,
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
        imageUrl: PRIMARY_AVATAR_URL,
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

  const advancedAchievementChain = await prisma.achievementChain.create({
    data: {
      name: 'Collection Journey',
      description: 'Benchmark ve deneyim paylaşımlarını ödüllendiren seri',
      category: 'Engagement',
    }
  })

  const advancedAchievementGoals = await Promise.all([
    prisma.achievementGoal.create({
      data: {
        chainId: advancedAchievementChain.id,
        title: '3 Benchmark Serisi Yayınla',
        requirement: '3 detaylı benchmark karşılaştırması paylaş',
        rewardBadgeId: benchmarkSageBadge.id,
        pointsRequired: 3,
        difficulty: 'MEDIUM',
      }
    }),
    prisma.achievementGoal.create({
      data: {
        chainId: advancedAchievementChain.id,
        title: '15 Deneyim Yazısı Tamamla',
        requirement: '15 farklı kart tipinde uzun deneyim yaz',
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
    { badgeId: benchmarkSageBadge.id, claimed: false, claimedAt: null },
    { badgeId: experienceCuratorBadge.id, claimed: false, claimedAt: null },
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
    const trustAvatarUrl = getSeedMediaUrl(trustAvatarKey)
    await prisma.userAvatar.deleteMany({ where: { userId: trustUser.id } })
    await prisma.userAvatar.create({
      data: {
        userId: trustUser.id,
        imageUrl: trustAvatarUrl,
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
    const trusterAvatarUrl = getSeedMediaUrl(trusterAvatarKey)
    await prisma.userAvatar.deleteMany({ where: { userId: trusterUser.id } })
    await prisma.userAvatar.create({
      data: {
        userId: trusterUser.id,
        imageUrl: trusterAvatarUrl,
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
      bio: 'Tipbox kullanıcılarına birebir destek veren koç',
    },
    create: {
      userId: COMMUNITY_COACH_USER_ID,
      displayName: 'Community Coach',
      userName: 'communitycoach',
      bannerUrl: DEFAULT_BANNER_URL,
      bio: 'Tipbox kullanıcılarına birebir destek veren koç',
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
      imageUrl: null // ID oluşturulduktan sonra güncellenecek
    }
  })

  // Sub category imageUrl güncelle
  if (evYasamSubCategory && !evYasamSubCategory.imageUrl) {
    await prisma.subCategory.update({
      where: { id: evYasamSubCategory.id },
      data: {
        imageUrl: getSeedMediaUrl('catalog.home-appliances')
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
      imageUrl: getSeedMediaUrl('catalog.home-appliances')
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
      imageUrl: getSeedMediaUrl('catalog.home-appliances')
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
      imageUrl: getSeedMediaUrl('catalog.home-appliances')
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
          imageUrl: getSeedMediaUrl(brand.phoneImage as any),
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
        imageUrl: getSeedMediaUrl(selectedImage as any),
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
          imageUrl: getSeedMediaUrl(brandImage as any), // Hepsi aynı görsel (markanın görseli)
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
      imageUrl: getSeedMediaUrl('product.phone.phone2' as any),
    }
  });

  console.log('✅ Phone products created')

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
      mediaUrl: INVENTORY_MEDIA_URL,
      type: 'IMAGE',
    }
  })

  // Post görseli için de aynı inventory'ye ekle (post görselleri InventoryMedia'dan çekiliyor)
  const postImageUrl = getSeedMediaUrl('post.image.primary');
  if (postImageUrl) {
    await prisma.inventoryMedia.create({
      data: {
        inventoryId: inventory1.id,
        mediaUrl: postImageUrl,
        type: 'IMAGE',
      }
    })
  }
  console.log('✅ Inventory & Product Experiences created')

  // Ek ürünler için inventory & görseller (context bazlı post görselleri)
  const heroInventoryConfigs = [
    {
      productId: product2.id,
      hasOwned: true,
      summary: 'Dyson V12 Slim\'i seyahatlerde yanımda taşıyorum; hafif yapısı kısa temizlikler için ideal.',
      mediaKeys: ['product.vacuum.dyson'],
    },
    {
      productId: product3.id,
      hasOwned: true,
      summary: 'iPhone 15 Pro günlük sürücüm, fotoğraf ve video testlerini bununla yapıyorum.',
      mediaKeys: ['product.phone.phone2'],
    },
    {
      productId: samsungPhone?.id || product2.id,
      hasOwned: true,
      summary: 'Samsung cihazı Dex + üretkenlik modunda ofis görevlerini üstleniyor.',
      mediaKeys: ['product.phone.phone1'],
    },
    {
      productId: applePhone?.id || product3.id,
      hasOwned: true,
      summary: 'Apple ekosisteminde LOG çekim ve içerik üretimi için temel cihazım.',
      mediaKeys: ['product.phone.phone2'],
    },
    {
      productId: redmiPhone?.id || product2.id,
      hasOwned: false,
      summary: 'MIUI betalarını test ettiğim bütçe dostu cihaz.',
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
        const mediaUrl = getSeedMediaUrl(key as SeedMediaKey);
        if (!mediaUrl) {
          return null;
        }
        return {
          inventoryId: inventory.id,
          mediaUrl,
          type: 'IMAGE' as const,
        };
      })
      .filter((item): item is { inventoryId: string; mediaUrl: string; type: 'IMAGE' } => !!item);

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
      title: 'Dyson V15s ile Derin Temizlik Rutinim',
      body: 'Submarine başlığı mutfak zeminindeki kurumuş lekeleri tek geçişte aldı. Dyson V15s ile halıdan sert zemine geçişte hiçbir ayar yapmadan devam etmek büyük konfor sağlıyor.',
      mainCategoryId: evYasamCategory.id,
      subCategoryId: evYasamSubCategory.id,
      productGroupId: productGroup.id,
      productId: product1.id,
      inventoryRequired: true,
      isBoosted: false,
      tags: ['Dyson', 'Submarine', 'WetCleaning'],
    },
    {
      title: 'Dyson V12 Slim’i Seyahat Ekipmanına Eklemek',
      body: 'V12 Slim, küçük apartmanlarda veya kısa konaklamalarda büyük cihaz taşımadan derli toplu bir temizlik yapmama izin veriyor. Özellikle dar alanlarda ağırlığı hissedilmiyor.',
      mainCategoryId: evYasamCategory.id,
      subCategoryId: evYasamSubCategory.id,
      productGroupId: productGroup.id,
      productId: product2.id,
      inventoryRequired: true,
      isBoosted: true,
      tags: ['Dyson', 'Slim', 'Travel'],
    },
    {
      title: 'iPhone 15 Pro Kamera Günlük Notlarım',
      body: 'Doğal log video çekimleri ve tetraprism lensle 5x zoom, hafta sonu vlog’larını çok daha temiz hale getirdi. USB-C ile SSD’ye aktarmak workflow’u hızlandırdı.',
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      productGroupId: iphoneGroup.id,
      productId: product3.id,
      inventoryRequired: true,
      isBoosted: false,
      tags: ['iPhone', 'Camera', 'USB-C'],
    },
  ];

  const productGroupContextPosts: ContextPostSeed[] = [
    {
      title: 'Dyson Vakum Serisinin Farklı Kullanım Alanları',
      body: 'Dyson serisi; evcil hayvan tüyü, parke parlaklığı veya hızlı mutfak toplama gibi farklı görevler için tek gövdede çok başlık sunuyor. Seriyi aile içi kullanım rolleriyle paylaştırdım.',
      mainCategoryId: evYasamCategory.id,
      subCategoryId: evYasamSubCategory.id,
      productGroupId: productGroup.id,
      productId: null,
      inventoryRequired: false,
      isBoosted: true,
      tags: ['Dyson', 'ProductGroup', 'Attachments'],
    },
    {
      title: 'Samsung Serisi İçin Güncel One UI Deneyimi',
      body: 'Samsung Serisi cihazlarda Good Lock modülleri ile çok ekranlı kullanımda üretkenliği artıran kurulumlar paylaşıyorum. Aynı gruptaki farklı modellerde bile aynı tema akıyor.',
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      productGroupId: samsungGroup.id,
      productId: null,
      inventoryRequired: false,
      isBoosted: false,
      tags: ['Samsung', 'OneUI', 'GoodLock'],
    },
    {
      title: 'Redmi Serisini Uygun Fiyatlı Ekosistem Olarak Kullanmak',
      body: 'Redmi Serisi ürünleri aile üyeleri arasında paylaştırırken otomasyon, paylaşılabilir pil tasarruf profilleri ve Mi Home sahneleri oluşturmak çok pratik oldu.',
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      productGroupId: redmiGroup.id,
      productId: null,
      inventoryRequired: false,
      isBoosted: false,
      tags: ['Redmi', 'Automation', 'Budget'],
    },
  ];

  const subCategoryContextPosts: ContextPostSeed[] = [
    {
      title: 'Akıllı Telefonlarda eSIM ve Dual-SIM Senaryoları',
      body: 'Akıllı Telefonlar alt kategorisinde eSIM profil değişimleri ve fiziksel SIM kombinasyonlarını anlatıyorum. Özellikle sık seyahat edenler için ideal tarifeler listesi var.',
      mainCategoryId: techCategory.id,
      subCategoryId: akilliTelefonlarSubCategory.id,
      inventoryRequired: false,
      isBoosted: false,
      tags: ['Akıllı Telefonlar', 'eSIM', 'Roaming'],
    },
    {
      title: 'Laptoplarda Taşınabilirlik vs Performans Dengesi',
      body: 'Laptoplar alt kategorisinde 14 inç üstü cihazlarda termal tasarım, batarya dayanımı ve USB4 aksesuar ekosistemi arasında nasıl seçim yaptığımı paylaştım.',
      mainCategoryId: techCategory.id,
      subCategoryId: laptoplarSubCategory.id,
      inventoryRequired: false,
      isBoosted: true,
      tags: ['Laptoplar', 'USB4', 'Thermals'],
    },
    {
      title: 'Kulaklıklar Alt Kategorisinde ANC Karşılaştırma Rehberi',
      body: 'Kulaklıklar kategorisinde ANC seviyelerini ofis, uçak ve ev ortamında ölçtüm. Hangi modelin hangi frekansları daha iyi bastırdığını grafikli şekilde özetledim.',
      mainCategoryId: techCategory.id,
      subCategoryId: kulakliklarSubCategory.id,
      inventoryRequired: false,
      isBoosted: false,
      tags: ['Kulaklıklar', 'ANC', 'Focus'],
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
      tags: [product.brand || 'Mobile', narrative.tag, 'Feed'],
    };
  });

  const groupStoryTemplates = [
    {
      title: '{group} topluluğu haftalık öne çıkanlar #{index}',
      body: '{group} takibinde olan 40 kullanıcının haftalık kullanım alışkanlıklarını karşılaştırdım. Yazılım güncellemeleri ve aksesuar tercihleri tek tabloda.',
      tag: 'Community',
    },
    {
      title: '{group} ekosistem rehberi #{index}',
      body: '{group} ailesinde yeni olanlar için başlangıç düzeni hazırladım. Hangi aksesuar önce alınmalı, hangi senaryoda ikinci cihaz daha anlamlı olur sorularına yanıt verdim.',
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
        tags: [group.name, template.tag, 'Series'],
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
      tags: [scenario.tag, 'Category', scenario.subCategory?.name || 'Context'],
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
    const postId = generateUlid();
    await prisma.contentPost.create({
      data: {
        id: postId,
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
      },
    });

    if (postSeed.tags && postSeed.tags.length) {
      await prisma.contentPostTag.createMany({
        data: postSeed.tags.map((tag) => ({
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
    const questionPost = await prisma.contentPost.create({
      data: {
        id: generateUlid(),
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
      },
    });

    await prisma.postQuestion.create({
      data: {
        postId: questionPost.id,
        expectedAnswerFormat: seed.answerFormat,
        relatedProductId: seed.productId,
      },
    });

    questionPosts.push({ id: questionPost.id });
  }
  console.log(`✅ ${questionPosts.length} question posts created for reply seeds`);

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
    const tipPostId = generateUlid();
    await prisma.contentPost.create({
      data: {
        id: tipPostId,
        userId: userIdToUse,
        type: 'TIPS',
        title: tipSeed.title,
        body: tipSeed.body,
        productId: tipSeed.productId,
        mainCategoryId: tipSeed.mainCategoryId,
        subCategoryId: tipSeed.subCategoryId,
        inventoryRequired: tipSeed.inventoryRequired ?? false,
        isBoosted: tipSeed.isBoosted ?? false,
      },
    });

    await prisma.postTip.create({
      data: {
        postId: tipPostId,
        tipCategory: tipSeed.tipCategory,
        isVerified: true,
      },
    });

    if (tipSeed.tags.length) {
      await prisma.postTag.create({
        data: {
          postId: tipPostId,
          tag: tipSeed.tags[0],
        },
      }).catch(() => {});

      await prisma.contentPostTag.createMany({
        data: tipSeed.tags.map((tag) => ({ postId: tipPostId, tag })),
        skipDuplicates: true,
      });
    }
  }

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
  await prisma.postComparisonScore.create({
    data: {
      comparisonId: comparison.id,
      metricId: priceMetric.id,
      scoreProduct1: 7,
      scoreProduct2: 8,
      comment: 'V12 daha uygun fiyatlı',
    }
  })

  await prisma.postComparisonScore.create({
    data: {
      comparisonId: comparison.id,
      metricId: qualityMetric.id,
      scoreProduct1: 9,
      scoreProduct2: 8,
      comment: 'V15s kalite açısından daha üstün',
    }
  })

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
    const compareId = generateUlid();
    await prisma.contentPost.create({
      data: {
        id: compareId,
        userId: userIdToUse,
        type: 'COMPARE',
        title: benchmarkSeed.title,
        body: benchmarkSeed.body,
        mainCategoryId: benchmarkSeed.mainCategoryId,
        subCategoryId: benchmarkSeed.subCategoryId,
        productId: benchmarkSeed.product1Id,
        inventoryRequired: false,
        isBoosted: benchmarkSeed.isBoosted ?? false,
      },
    });

    const comparisonEntry = await prisma.postComparison.create({
      data: {
        postId: compareId,
        product1Id: benchmarkSeed.product1Id,
        product2Id: benchmarkSeed.product2Id,
        comparisonSummary: benchmarkSeed.summary,
      },
    });

    for (const score of benchmarkSeed.metricScores) {
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
    const postId = generateUlid();
    await prisma.contentPost.create({
      data: {
        id: postId,
        userId: userIdToUse,
        type: 'EXPERIENCE',
        title: seed.title,
        body: seed.body,
        mainCategoryId: seed.mainCategoryId,
        subCategoryId: seed.subCategoryId,
        productId: seed.productId,
        inventoryRequired: seed.inventoryRequired ?? false,
        isBoosted: seed.isBoosted ?? false,
      },
    });

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

  console.log('✅ Content posts created (Free context mix, Tips, Benchmarks, Experience)')

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

  // Feed Entries - Kullanıcıların feed'inde görünecek post'lar
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
      imageUrl: MARKET_AVATAR_URL,
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
      allUserIds.map((userId) =>
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

  console.log('🏅 Creating bridge rewards for profile collections...')
  const bridgeBrandNames = ['TechVision', 'SmartHome Pro', 'CoffeeDelight']
  const bridgeBrandRecords = await prisma.brand.findMany({
    where: { name: { in: bridgeBrandNames } }
  })
  const bridgeBrandMap = new Map(bridgeBrandRecords.map((brand) => [brand.name, brand]))

  const bridgeRewardSeeds = [
    { userId: userIdToUse, badgeId: bridgeAmbassadorBadge.id, brandName: 'TechVision', daysAgoValue: 45 },
    { userId: userIdToUse, badgeId: brandVisionaryBadge.id, brandName: 'SmartHome Pro', daysAgoValue: 12 },
    { userId: TARGET_USER_ID, badgeId: bridgeAmbassadorBadge.id, brandName: 'SmartHome Pro', daysAgoValue: 30 },
    { userId: TRUST_USER_IDS[0], badgeId: bridgeAmbassadorBadge.id, brandName: 'CoffeeDelight', daysAgoValue: 20 },
    { userId: TRUST_USER_IDS[1], badgeId: brandVisionaryBadge.id, brandName: 'TechVision', daysAgoValue: 8 },
  ]

  let createdBridgeRewards = 0
  for (const seed of bridgeRewardSeeds) {
    const brand = bridgeBrandMap.get(seed.brandName)
    if (!brand) continue

    const existingReward = await prisma.bridgeReward.findFirst({
      where: {
        userId: seed.userId,
        badgeId: seed.badgeId,
        brandId: brand.id,
      }
    }).catch(() => null)

    if (existingReward) continue

    await prisma.bridgeReward.create({
      data: {
        userId: seed.userId,
        brandId: brand.id,
        badgeId: seed.badgeId,
        awardedAt: daysAgo(seed.daysAgoValue),
      }
    })
    createdBridgeRewards++
  }
  console.log(`✅ ${createdBridgeRewards} bridge rewards created`)

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

  const DM_PARTNER_IDS = [
    TARGET_USER_ID,
    ...TRUST_USER_IDS,
    ...TRUSTER_USER_IDS,
    COMMUNITY_COACH_USER_ID,
  ];

  const dmConversationTemplates = [
    {
      partnerOpening: 'Selam! Yeni Dyson karşılaştırmanı okudum.',
      testReply: 'Çok sevindim, sorularını gönderebilirsin.',
      partnerFollow: 'Boost modu bataryayı çok tüketiyor mu?',
      testFollow: 'Yoğun kullanımda evet, eco modda daha dengeli.',
    },
    {
      partnerOpening: 'Marketplace’deki yeni badge’i inceledim.',
      testReply: 'Feedback gönderirsen geliştirme listesine eklerim.',
      partnerFollow: 'Elbette, screenshot ile yollarım.',
      testFollow: 'Harika, bekliyorum.',
    },
    {
      partnerOpening: 'Smartwatch rehberini paylaştığın için teşekkürler!',
      testReply: 'Rica ederim, hangi modeli düşünüyorsun?',
      partnerFollow: 'Galaxy Watch 7 ile Pixel Watch arasında kaldım.',
      testFollow: 'Android kullanıyorsan Galaxy öneririm.',
    },
    {
      partnerOpening: 'Yeni kulaklık benchmark’ı efsane olmuş.',
      testReply: 'Ses profillerini karşılaştırmak epey sürdü.',
      partnerFollow: 'Noise-cancel testleri için metodun neydi?',
      testFollow: 'Standart 70db fan + metro kaydı kullanıyorum.',
    },
    {
      partnerOpening: 'Subcategory feed’deki yeni formatı beğendim.',
      testReply: 'UI ekibi çok emek verdi, paylaştığın için sağ ol.',
      partnerFollow: 'Belki dark mode varyantı da eklenebilir.',
      testFollow: 'Çalışıyoruz, roadmap’te var.',
    },
  ];

  const NORMAL_DM_THREAD_SEEDS: ThreadSeed[] = DM_PARTNER_IDS.slice(0, 10).map((partnerId, index) => {
    const template = dmConversationTemplates[index % dmConversationTemplates.length];
    const baseMinutes = 35 + index * 6;
    const unreadForTestUser = index < 5;
    const messages = [
      {
        senderId: partnerId,
        message: template.partnerOpening,
        minutesAgo: baseMinutes + 15,
        isRead: true,
        context: 'DM' as const,
      },
      {
        senderId: TEST_USER_ID,
        message: template.testReply,
        minutesAgo: baseMinutes + 8,
        isRead: true,
        context: 'DM' as const,
      },
    ];

    if (unreadForTestUser) {
      messages.push({
        senderId: partnerId,
        message: template.partnerFollow,
        minutesAgo: baseMinutes,
        isRead: false,
        context: 'DM' as const,
      });
    } else {
      messages.push({
        senderId: TEST_USER_ID,
        message: template.testFollow,
        minutesAgo: baseMinutes,
        isRead: true,
        context: 'DM' as const,
      });
    }

    return {
      userOneId: TEST_USER_ID,
      userTwoId: partnerId,
      unreadCountUserOne: unreadForTestUser ? 2 : 0,
      unreadCountUserTwo: unreadForTestUser ? 0 : 1,
      isSupportThread: false,
      messages,
    };
  });

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
  console.log('💌 Creating DM requests (support requests)...')

  type SupportRequestSeed = {
    id: string;
    fromUserId: string;
    toUserId: string;
    description: string;
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELED' | 'AWAITING_COMPLETION' | 'COMPLETED' | 'REPORTED';
    type: 'GENERAL' | 'TECHNICAL' | 'PRODUCT';
    amount: number;
    minutesAgo: number;
    threadId: null;
  };

  const supportStatusCycle: SupportRequestSeed['status'][] = [
    'PENDING',
    'ACCEPTED',
    'AWAITING_COMPLETION',
    'COMPLETED',
    'CANCELED',
    'ACCEPTED',
    'PENDING',
    'AWAITING_COMPLETION',
    'DECLINED',
    'COMPLETED',
  ];

  const supportSecondaryStatusCycle: SupportRequestSeed['status'][] = [
    'ACCEPTED',
    'CANCELED',
    'AWAITING_COMPLETION',
    'COMPLETED',
    'REPORTED',
    'ACCEPTED',
    'PENDING',
    'COMPLETED',
    'AWAITING_COMPLETION',
    'CANCELED',
  ];

  const supportTypeCycle: SupportRequestSeed['type'][] = ['GENERAL', 'TECHNICAL', 'PRODUCT'];

  const SUPPORT_REQUEST_SEEDS: SupportRequestSeed[] = [];

  DM_PARTNER_IDS.slice(0, 10).forEach((partnerId, index) => {
    const primaryStatus = supportStatusCycle[index % supportStatusCycle.length];
    const secondaryStatus = supportSecondaryStatusCycle[index % supportSecondaryStatusCycle.length];
    const primaryType = supportTypeCycle[index % supportTypeCycle.length];
    const secondaryType = supportTypeCycle[(index + 1) % supportTypeCycle.length];

    SUPPORT_REQUEST_SEEDS.push({
      id: randomUUID(),
      fromUserId: partnerId,
      toUserId: TEST_USER_ID,
      description: `(${index + 1}A) ${primaryType} desteği için hızlı görüşme talebi.`,
      status: primaryStatus,
      type: primaryType,
      amount: 40 + index * 5,
      minutesAgo: 70 + index * 9,
      threadId: null,
    });

    SUPPORT_REQUEST_SEEDS.push({
      id: randomUUID(),
      fromUserId: TEST_USER_ID,
      toUserId: partnerId,
      description: `(${index + 1}B) Son seans sonrası geri bildirimin var mı?`,
      status: secondaryStatus,
      type: secondaryType,
      amount: 55 + index * 6,
      minutesAgo: 45 + index * 7,
      threadId: null,
    });
  });

  let supportRequestsCount = 0;
  let supportThreadsCount = 0;
  let supportMessagesCount = 0;
  
  for (const supportRequest of SUPPORT_REQUEST_SEEDS) {
    // Delete existing request if exists
    await prisma.dMRequest.deleteMany({ where: { id: supportRequest.id } });
    
    let threadId: string | null = null;
    
    // If status is ACCEPTED, create a support thread
    const shouldCreateSupportThread = ['ACCEPTED', 'AWAITING_COMPLETION', 'COMPLETED'].includes(supportRequest.status);
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
      
      // Create some support chat messages in the support thread
      const supportMessages = await prisma.dMMessage.createMany({
        data: [
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
          {
            threadId: supportThread.id,
            senderId: supportRequest.fromUserId,
            message: 'Teşekkür ederim, detayları paylaşayım...',
            isRead: true,
            context: 'SUPPORT',
            sentAt: minutesAgoToDate(supportRequest.minutesAgo - 3),
          },
        ] as any,
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
        respondedAt: supportRequest.status !== 'PENDING' ? minutesAgoToDate(supportRequest.minutesAgo - 10) : null,
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

  const tipsTransferSeeds = DM_PARTNER_IDS.slice(0, 6).map((partnerId, index) => ({
    fromUserId: partnerId,
    toUserId: TEST_USER_ID,
    amount: 25 + index * 8,
    reason: `Teşekkürler, ${index + 1}. destek için`,
    minutesAgo: 30 + index * 4,
  }))

  for (const tipsSeed of tipsTransferSeeds) {
    const createdAt = minutesAgoToDate(tipsSeed.minutesAgo)
    await prisma.tipsTokenTransfer.create({
      data: {
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
