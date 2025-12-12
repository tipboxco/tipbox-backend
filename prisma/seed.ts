import { PrismaClient, Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import * as bcrypt from 'bcryptjs'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { DEFAULT_PROFILE_BANNER_URL } from '../src/domain/user/profile.constants'
import { getSeedMediaUrl, SeedMediaKey } from './seed/helpers/media.helper'
import { S3Service } from '../src/infrastructure/s3/s3.service'

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
// fully managed via getSeedMediaUrl / getPublicMediaBaseUrl. The old constant is
// intentionally removed to avoid unused-variable compile errors.
const nextMarketplaceImage = (): string => {
  const key = MARKETPLACE_NFT_IMAGE_KEYS[marketplaceImageCursor % MARKETPLACE_NFT_IMAGE_KEYS.length]
  marketplaceImageCursor += 1
  return getSeedMediaUrl(key)
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

async function ensureProductImages(userIdToUse: string): Promise<void> {
  // Tüm product'ları al
  const allProducts = await prisma.product.findMany({
    where: {
      imageUrl: { not: null },
    },
    take: 100, // İlk 100 product
  })

  let addedCount = 0
  for (const product of allProducts) {
    // Product için inventory var mı kontrol et
    let inventory = await prisma.inventory.findFirst({
      where: {
        userId: userIdToUse,
        productId: product.id,
      },
    })

    // Eğer inventory yoksa oluştur
    if (!inventory) {
      inventory = await prisma.inventory.create({
        data: {
          userId: userIdToUse,
          productId: product.id,
          hasOwned: true,
          experienceSummary: `Real‑life ownership experience with ${product.name}`,
        },
      })
    }

    // Inventory media var mı kontrol et
    const existingMedia = await prisma.inventoryMedia.findFirst({
      where: {
        inventoryId: inventory.id,
        type: 'IMAGE',
      },
    })

    // Eğer media yoksa ve product'ın imageUrl'i varsa ekle
    if (!existingMedia && product.imageUrl) {
      await prisma.inventoryMedia.create({
        data: {
          inventoryId: inventory.id,
          mediaUrl: product.imageUrl,
          type: 'IMAGE',
        },
      }).catch(() => {})
      addedCount++
    }
  }

  if (addedCount > 0) {
    console.log(`✅ ${addedCount} product için inventory media eklendi`)
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

  // Sub kategorileri bul veya oluştur
  let techSubCategory = await prisma.subCategory.findFirst({ where: { mainCategoryId: techCategory.id } })
  if (!techSubCategory) {
    techSubCategory = await prisma.subCategory.create({
      data: {
        name: 'Akıllı Telefonlar',
        description: 'iPhone, Android, Samsung, Xiaomi vs.',
        mainCategoryId: techCategory.id,
        imageUrl: getSeedMediaUrl('catalog.phones'),
      },
    })
  }

  let evYasamSubCategory = await prisma.subCategory.findFirst({ where: { mainCategoryId: evYasamCategory.id } })
  if (!evYasamSubCategory) {
    evYasamSubCategory = await prisma.subCategory.create({
      data: {
        name: 'Temizlik Ürünleri',
        description: 'Süpürge, temizlik robotu vb.',
        mainCategoryId: evYasamCategory.id,
        imageUrl: getSeedMediaUrl('catalog.home-appliances'),
      },
    })
  }

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

    // Brand'a göre kategori seç
    const isTechBrand = ['TechVision', 'FitnessTech'].includes(brand.name)
    const mainCategory = isTechBrand ? techCategory : evYasamCategory
    const subCategory = isTechBrand ? techSubCategory : evYasamSubCategory

    // Product group oluştur veya bul
    let productGroup = await prisma.productGroup.findFirst({
      where: {
        subCategoryId: subCategory.id,
        name: { contains: brand.name },
      },
    })

    if (!productGroup) {
      productGroup = await prisma.productGroup.create({
        data: {
          name: `${brand.name} Ürünleri`,
          description: `${brand.name} markasına ait ürünler`,
          subCategoryId: subCategory.id,
          imageUrl: getSeedMediaUrl('product.laptop.macbook'),
        },
      })
    }

    // Brand'a özel product'lar oluştur
    const productConfigs = getProductConfigsForBrand(brand.name)
    
    // Debug: Product config kontrolü
    if (productConfigs.length === 0) {
      console.log(`⚠️ ${brand.name} için product config bulunamadı, bu brand için görsel yükleme atlanıyor`)
    } else {
      console.log(`✅ ${brand.name} için ${productConfigs.length} product config bulundu`)
    }
    
    for (const productConfig of productConfigs) {
      // Product'ı oluştur veya bul
      let product = await prisma.product.findFirst({
        where: {
          brand: brand.name,
          name: productConfig.name,
        },
      })

      if (!product) {
        product = await prisma.product.create({
          data: {
            name: productConfig.name,
            brand: brand.name,
            description: productConfig.description,
            groupId: productGroup.id,
            imageUrl: getSeedMediaUrl(productConfig.imageKey as any),
          },
        })
      }

      // Inventory oluştur (experiences için gerekli)
      let inventory = await prisma.inventory.findFirst({
        where: {
          userId: userIdToUse,
          productId: product.id,
        },
      })

      if (!inventory) {
        inventory = await prisma.inventory.create({
          data: {
            userId: userIdToUse,
            productId: product.id,
            hasOwned: true,
            experienceSummary: `Real‑life ownership experience with ${product.name}`,
          },
        })
      }

      // Inventory media kontrolü - eğer yoksa ekle
      const existingMedia = await prisma.inventoryMedia.findFirst({
        where: {
          inventoryId: inventory.id,
          type: 'IMAGE',
        },
      })

      if (!existingMedia) {
        // Product imageUrl'i kullan veya seed media'dan al
        const mediaUrl = product.imageUrl || getSeedMediaUrl(productConfig.imageKey as any)
        if (mediaUrl) {
          await prisma.inventoryMedia.create({
            data: {
              inventoryId: inventory.id,
              mediaUrl: mediaUrl,
              type: 'IMAGE',
            },
          }).catch(() => {})
        }
      }

      // EXPERIENCES için FREE type post'lar oluştur
      const existingExperiencePosts = await prisma.contentPost.findMany({
        where: {
          productId: product.id,
          type: 'FREE',
        },
      })

      // Her product için en az 5-6 experience post oluştur
      const experienceTemplates = [
        {
          title: `${product.name} – First Days of Use`,
          body:
            `${product.name} has been in my hands for only a few days, but it already feels like part of my routine. ` +
            `The setup was straightforward and I did not have to dig through manuals to start using it. ` +
            `In the first week I focused on learning how ${productConfig.experienceText.toLowerCase()} actually behaves in real life. ` +
            `So far it feels more natural and reliable than most similar products I tried before.`,
        },
        {
          title: `${product.name} – Daily Usage Experience`,
          body:
            `I use ${product.name} almost every day and it has settled into a very clear role in my home. ` +
            `It saves me a few minutes each time I reach for it, which adds up over a busy week. ` +
            `Little touches like ${productConfig.experienceText.toLowerCase()} make it feel designed for real people instead of spec sheets. ` +
            `If it disappeared tomorrow, I would immediately notice the extra friction in my daily routine.`,
        },
        {
          title: `${product.name} – In‑Depth Review`,
          body:
            `After spending several weeks with ${product.name}, I started to notice the smaller design decisions. ` +
            `The hardware feels solid, the controls are predictable and there are no hidden surprises in normal use. ` +
            `When I push it harder, ${productConfig.experienceText.toLowerCase()} still stays consistent and responsive. ` +
            `Overall it feels like a product that was tested by people who actually live with it every day.`,
        },
        {
          title: `${product.name} – Long‑Term Ownership`,
          body:
            `I have owned ${product.name} for a few months now and it still performs as well as the first week. ` +
            `Battery, materials and moving parts have not shown any obvious wear so far. ` +
            `Even after repeated use, ${productConfig.experienceText.toLowerCase()} remains stable and does not require constant tweaking. ` +
            `It is the kind of device you forget about until you need it, which is exactly what I want from a dependable tool.`,
        },
        {
          title: `${product.name} – How It Changes My Day`,
          body:
            `${product.name} genuinely changed the way I plan small tasks during the day. ` +
            `Instead of postponing things, I handle them immediately because the device is quick to start and easy to put away. ` +
            `The fact that ${productConfig.experienceText.toLowerCase()} works reliably means I do not have to double‑check its results. ` +
            `Over time that reduction in mental effort is just as valuable as the time it saves.`,
        },
        {
          title: `${product.name} – Professional Perspective`,
          body:
            `Looking at ${product.name} from a more professional angle, it balances performance and usability very well. ` +
            `In tests with different workloads it behaved predictably and did not slow me down. ` +
            `Features like ${productConfig.experienceText.toLowerCase()} translate into concrete productivity gains rather than marketing buzzwords. ` +
            `For someone who relies on their tools to get consistent results, this makes the product easy to recommend.`,
        },
      ]

      if (existingExperiencePosts.length < 5) {
        const postsToCreate = 6 - existingExperiencePosts.length
        for (let i = 0; i < postsToCreate; i++) {
          const template = experienceTemplates[i % experienceTemplates.length]
          const experiencePostId = generateUlid()
          
          await prisma.contentPost.create({
            data: {
              id: experiencePostId,
              userId: userIdToUse,
              type: 'FREE',
              title: template.title,
              body: template.body,
              productId: product.id,
              mainCategoryId: mainCategory.id,
              subCategoryId: subCategory.id,
              inventoryRequired: true,
              isBoosted: i === 0,
            },
          })

          // Post tag'leri ekle (max 2-3 tag)
          await prisma.contentPostTag.createMany({
            data: [
              { postId: experiencePostId, tag: brand.name },
              { postId: experiencePostId, tag: 'Deneyim' },
            ],
            skipDuplicates: true,
          })

          // Like ve favorite ekle (rastgele sayıda)
          if (i % 2 === 0) {
            await prisma.contentLike.create({
              data: { userId: userIdToUse, postId: experiencePostId },
            }).catch(() => {})
          }
          
          if (i % 3 === 0) {
            await prisma.contentFavorite.create({
              data: { userId: userIdToUse, postId: experiencePostId },
            }).catch(() => {})
          }
        }
        console.log(`✅ ${postsToCreate} experience post oluşturuldu: ${product.name}`)
      }

      // NEWS için farklı tip post'lar oluştur
      const existingNewsPosts = await prisma.contentPost.findMany({
        where: {
          productId: product.id,
          type: {
            in: ['TIPS', 'QUESTION', 'COMPARE', 'UPDATE', 'EXPERIENCE'],
          },
        },
      })

      // event.jpg görselini MinIO'ya yükle (10 adet news post için)
      console.log(`🖼️ [${brand.name} - ${product.name}] Görsel yükleme başlatılıyor...`)
      const eventImagePath = path.join(__dirname, '../tests/assets/WhatsNews/event.jpg')
      let eventImageUrls: string[] = []
      
      // Önce MinIO bağlantısını ve dosya varlığını kontrol et
      const fileExists = existsSync(eventImagePath)
      console.log(`  📁 Dosya kontrolü: ${fileExists ? '✅ Mevcut' : '❌ Bulunamadı'} (${eventImagePath})`)
      
      if (!fileExists) {
        console.warn(`  ⚠️ event.jpg dosyası bulunamadı: ${eventImagePath}`)
      } else {
        try {
          console.log(`  🔗 MinIO bağlantısı test ediliyor...`)
          // MinIO bağlantısını test et
          const s3Service = new S3Service()
          await s3Service.checkAndCreateBucket()
          console.log(`  ✅ MinIO bağlantısı başarılı, görseller yükleniyor...`)
          
          console.log(`  📤 MinIO'ya görsel yükleniyor: ${brand.name} - ${product.name}`)
          const eventImageBuffer = readFileSync(eventImagePath)
          console.log(`  📦 Görsel boyutu: ${(eventImageBuffer.length / 1024 / 1024).toFixed(2)} MB`)
          
          // 10 adet farklı URL için görseli yükle (önce MinIO'ya)
          for (let i = 0; i < 10; i++) {
            const objectKey = `news/${brand.name.toLowerCase().replace(/\s+/g, '-')}/${product.id}/${Date.now()}-${i}-event.jpg`
            try {
              const uploadedUrl = await s3Service.uploadFile(objectKey, eventImageBuffer, 'image/jpeg')
              // URL zaten localhost formatında dönüyor (S3Service içinde düzeltildi)
              eventImageUrls.push(uploadedUrl)
              
              // Her 5 görselden sonra progress göster
              if ((i + 1) % 5 === 0) {
                console.log(`    📤 ${i + 1}/10 görsel yüklendi...`)
              }
            } catch (uploadError: any) {
              const uploadErrorMsg = uploadError instanceof Error ? uploadError.message : String(uploadError)
              console.error(`    ❌ Görsel ${i + 1} yükleme hatası: ${uploadErrorMsg}`)
              // Tek bir görsel başarısız olsa bile devam et
            }
          }
          
          if (eventImageUrls.length > 0) {
            console.log(`  ✅ ${eventImageUrls.length}/10 adet event.jpg görseli MinIO'ya yüklendi ve URL'ler hazır`)
          } else {
            console.error(`  ❌ Hiçbir görsel yüklenemedi!`)
          }
        } catch (error: any) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          const errorStack = error instanceof Error ? error.stack : undefined
          console.error(`  ❌ MinIO'ya görsel yükleme hatası: ${errorMsg}`)
          if (errorStack) {
            console.error(`  📋 Hata detayı: ${errorStack.substring(0, 200)}...`)
          }
          console.warn(`  ⚠️ Görseller yüklenemedi, görsel olmadan devam ediliyor...`)
          // Görsel yüklenemezse boş array ile devam et
        }
      }
      
      console.log(`  🖼️ [${brand.name} - ${product.name}] Görsel yükleme tamamlandı. Toplam ${eventImageUrls.length} URL hazır.`)

      // Her product için en az 10 news post oluştur (çeşitli tipler + event.jpg görselleri)
      // NOT: Görseller yukarıda yüklendi, şimdi news post'lar oluşturulacak
      console.log(`  📰 [${brand.name} - ${product.name}] News post kontrolü: ${existingNewsPosts.length}/10 mevcut`)
      
      if (existingNewsPosts.length < 10) {
        // Mevcut post tiplerini kontrol et
        const existingTypes = existingNewsPosts.map(p => p.type)
        const newsToCreate = 10 - existingNewsPosts.length
        let createdCount = 0
        let eventImageIndex = 0

        // UPDATE post'lar (haberler için uygun)
        const updateTemplates = [
          {
            title: `${product.name} İçin Yeni Özellik Güncellemesi`,
            body: `${product.name} ürünü için yeni özellik güncellemesi yayınlandı! Artık daha fazla fonksiyon mevcut. Kullanıcılar için daha iyi bir deneyim sunuyor.`,
          },
          {
            title: `${brand.name} Yeni Kampanya Duyurusu`,
            body: `${brand.name} markası yeni kampanya duyurusu yaptı! ${product.name} ürünü için sınırlı süre özel fırsatlar mevcut. Kaçırmayın!`,
          },
          {
            title: `${product.name} Hakkında Yeni Bilgiler`,
            body: `${product.name} ürünü hakkında yeni bilgiler paylaşıldı. Detaylar için takip etmeye devam edin. Ürünün özellikleri ve performansı hakkında güncel bilgiler.`,
          },
        ]

        // UPDATE tipi post oluştur (2 adet)
        if (!existingTypes.includes('UPDATE') && createdCount < newsToCreate) {
          for (let i = 0; i < Math.min(2, newsToCreate - createdCount); i++) {
            const template = updateTemplates[i % updateTemplates.length]
            const updatePostId = generateUlid()
            
            await prisma.contentPost.create({
              data: {
                id: updatePostId,
                userId: userIdToUse,
                type: 'UPDATE',
                title: template.title,
                body: template.body,
                productId: product.id,
                mainCategoryId: mainCategory.id,
                subCategoryId: subCategory.id,
                inventoryRequired: true,
                isBoosted: i === 0,
              },
            }).catch(() => {})

            await prisma.contentPostTag.createMany({
              data: [
                { postId: updatePostId, tag: brand.name },
                { postId: updatePostId, tag: 'Haber' },
              ],
              skipDuplicates: true,
            })

            // event.jpg görselini inventory media olarak ekle
            if (inventory && eventImageUrls.length > 0 && eventImageIndex < eventImageUrls.length) {
              await prisma.inventoryMedia.create({
                data: {
                  inventoryId: inventory.id,
                  mediaUrl: eventImageUrls[eventImageIndex],
                  type: 'IMAGE',
                },
              }).catch(() => {})
              eventImageIndex++
            }
            createdCount++
          }
        }

        // EXPERIENCE tipi post oluştur
        if (!existingTypes.includes('EXPERIENCE') && createdCount < newsToCreate) {
          const experiencePostId = generateUlid()
          await prisma.contentPost.create({
            data: {
              id: experiencePostId,
              userId: userIdToUse,
              type: 'EXPERIENCE',
              title: `${product.name} - Detaylı Deneyim Paylaşımı`,
              body: `${product.name} ürünü ile ilgili detaylı bir deneyim paylaşımı. Uzun vadeli kullanım sonrası gözlemlerim ve önerilerim. ${productConfig.experienceText}`,
              productId: product.id,
              mainCategoryId: mainCategory.id,
              subCategoryId: subCategory.id,
              inventoryRequired: true,
              isBoosted: false,
            },
          }).catch(() => {})

          await prisma.contentPostTag.createMany({
            data: [
              { postId: experiencePostId, tag: brand.name },
              { postId: experiencePostId, tag: 'Deneyim' },
            ],
            skipDuplicates: true,
          })

          // event.jpg görselini inventory media olarak ekle
          if (inventory && eventImageUrls.length > 0 && eventImageIndex < eventImageUrls.length) {
            await prisma.inventoryMedia.create({
              data: {
                inventoryId: inventory.id,
                mediaUrl: eventImageUrls[eventImageIndex],
                type: 'IMAGE',
              },
            }).catch(() => {})
            eventImageIndex++
          }
          createdCount++
        }

        // TIPS post
        if (!existingTypes.includes('TIPS') && createdCount < newsToCreate) {
          const tipsPostId = generateUlid()
          await prisma.contentPost.create({
            data: {
              id: tipsPostId,
              userId: userIdToUse,
              type: 'TIPS',
              title: `${product.name} Kullanım İpuçları`,
              body: `${product.name} için faydalı kullanım ipuçları ve öneriler. Bu ürünü en iyi şekilde kullanmak için bu ipuçlarını takip edin.`,
              productId: product.id,
              mainCategoryId: mainCategory.id,
              subCategoryId: subCategory.id,
              inventoryRequired: true,
              isBoosted: false,
            },
          }).catch(() => {})

          await prisma.postTip.create({
            data: { postId: tipsPostId, tipCategory: 'USAGE', isVerified: true },
          }).catch(() => {})

          await prisma.contentPostTag.createMany({
            data: [
              { postId: tipsPostId, tag: brand.name },
              { postId: tipsPostId, tag: 'İpucu' },
            ],
            skipDuplicates: true,
          })

          // event.jpg görselini inventory media olarak ekle
          if (inventory && eventImageUrls.length > 0 && eventImageIndex < eventImageUrls.length) {
            await prisma.inventoryMedia.create({
              data: {
                inventoryId: inventory.id,
                mediaUrl: eventImageUrls[eventImageIndex],
                type: 'IMAGE',
              },
            }).catch(() => {})
            eventImageIndex++
          }
          createdCount++
        }

        // QUESTION post
        if (!existingTypes.includes('QUESTION') && createdCount < newsToCreate) {
          const questionPostId = generateUlid()
          await prisma.contentPost.create({
            data: {
              id: questionPostId,
              userId: userIdToUse,
              type: 'QUESTION',
              title: `${product.name} Hakkında Soru`,
              body: `${product.name} hakkında merak ettiğim bir şey var. Bu ürünü kullananlar deneyimlerini paylaşabilir mi?`,
              productId: product.id,
              mainCategoryId: mainCategory.id,
              subCategoryId: subCategory.id,
              inventoryRequired: false,
              isBoosted: false,
            },
          }).catch(() => {})

          await prisma.postQuestion.create({
            data: {
              postId: questionPostId,
              expectedAnswerFormat: 'SHORT',
              relatedProductId: product.id,
            },
          }).catch(() => {})

          await prisma.contentPostTag.createMany({
            data: [
              { postId: questionPostId, tag: brand.name },
              { postId: questionPostId, tag: 'Soru' },
            ],
            skipDuplicates: true,
          })

          // event.jpg görselini inventory media olarak ekle
          if (inventory && eventImageUrls.length > 0 && eventImageIndex < eventImageUrls.length) {
            await prisma.inventoryMedia.create({
              data: {
                inventoryId: inventory.id,
                mediaUrl: eventImageUrls[eventImageIndex],
                type: 'IMAGE',
              },
            }).catch(() => {})
            eventImageIndex++
          }
          createdCount++
        }

        // COMPARE post (eğer başka bir product varsa)
        if (!existingTypes.includes('COMPARE') && createdCount < newsToCreate) {
          const otherProduct = await prisma.product.findFirst({
            where: {
              brand: brand.name,
              id: { not: product.id },
            },
          })

          if (otherProduct) {
            const comparePostId = generateUlid()
            await prisma.contentPost.create({
              data: {
                id: comparePostId,
                userId: userIdToUse,
                type: 'COMPARE',
                title: `${product.name} vs ${otherProduct.name} Karşılaştırması`,
                body: `İki ürünü karşılaştırdım ve sonuçlar şöyle... ${product.name} ve ${otherProduct.name} arasındaki farkları detaylı bir şekilde inceledim.`,
                productId: product.id,
                mainCategoryId: mainCategory.id,
                subCategoryId: subCategory.id,
                inventoryRequired: false,
                isBoosted: true,
              },
            }).catch(() => {})

            const comparison = await prisma.postComparison.create({
              data: {
                postId: comparePostId,
                product1Id: product.id,
                product2Id: otherProduct.id,
                comparisonSummary: `${product.name} ve ${otherProduct.name} karşılaştırması`,
              },
            }).catch(() => null)

            if (comparison) {
              const fiyatMetric = await prisma.comparisonMetric.findFirst({ where: { name: 'Fiyat' } })
              const kaliteMetric = await prisma.comparisonMetric.findFirst({ where: { name: 'Kalite' } })
              
              if (fiyatMetric) {
                await prisma.postComparisonScore.create({
                  data: {
                    comparisonId: comparison.id,
                    metricId: fiyatMetric.id,
                    scoreProduct1: 8,
                    scoreProduct2: 7,
                    comment: 'Fiyat karşılaştırması',
                  },
                }).catch(() => {})
              }

              if (kaliteMetric) {
                await prisma.postComparisonScore.create({
                  data: {
                    comparisonId: comparison.id,
                    metricId: kaliteMetric.id,
                    scoreProduct1: 9,
                    scoreProduct2: 8,
                    comment: 'Kalite karşılaştırması',
                  },
                }).catch(() => {})
              }
            }

            await prisma.contentPostTag.createMany({
              data: [
                { postId: comparePostId, tag: brand.name },
                { postId: comparePostId, tag: 'Karşılaştırma' },
              ],
              skipDuplicates: true,
            })

            // event.jpg görselini inventory media olarak ekle
            if (inventory && eventImageUrls.length > 0 && eventImageIndex < eventImageUrls.length) {
              await prisma.inventoryMedia.create({
                data: {
                  inventoryId: inventory.id,
                  mediaUrl: eventImageUrls[eventImageIndex],
                  type: 'IMAGE',
                },
              }).catch(() => {})
              eventImageIndex++
            }
            createdCount++
          }
        }

        // Kalan sayı için ek UPDATE post'lar (10 adet toplam için)
        while (createdCount < newsToCreate) {
          const template = updateTemplates[createdCount % updateTemplates.length]
          const updatePostId = generateUlid()
          
          await prisma.contentPost.create({
            data: {
              id: updatePostId,
              userId: userIdToUse,
              type: 'UPDATE',
              title: template.title,
              body: template.body,
              productId: product.id,
              mainCategoryId: mainCategory.id,
              subCategoryId: subCategory.id,
              inventoryRequired: true,
              isBoosted: false,
            },
          }).catch(() => {})

          await prisma.contentPostTag.createMany({
            data: [
              { postId: updatePostId, tag: brand.name },
              { postId: updatePostId, tag: 'Haber' },
            ],
            skipDuplicates: true,
          })

          // event.jpg görselini inventory media olarak ekle
          if (inventory && eventImageUrls.length > 0 && eventImageIndex < eventImageUrls.length) {
            await prisma.inventoryMedia.create({
              data: {
                inventoryId: inventory.id,
                mediaUrl: eventImageUrls[eventImageIndex],
                type: 'IMAGE',
              },
            }).catch(() => {})
            eventImageIndex++
          }
          createdCount++
        }

        if (createdCount > 0) {
          console.log(`✅ ${createdCount} news post oluşturuldu: ${product.name}`)
        }
      }
    }

    // Bu brand için toplam product sayısını kontrol et, minimum 5 olmasını sağla
    const minProductsPerBrand = 5
    const currentProductCount = await prisma.product.count({
      where: { brand: brand.name },
    })

    if (currentProductCount < minProductsPerBrand) {
      const productsToCreate = minProductsPerBrand - currentProductCount
      console.log(
        `ℹ️ ${brand.name} için ek ürün oluşturuluyor: mevcut=${currentProductCount}, hedef=${minProductsPerBrand}`
      )

      for (let i = 0; i < productsToCreate; i++) {
        const genericProductName = `${brand.name} Ürün ${currentProductCount + i + 1}`

        // Product oluştur
        const genericProduct = await prisma.product.create({
          data: {
            name: genericProductName,
            brand: brand.name,
            description: `${brand.name} için otomatik oluşturulan seed ürün`,
            groupId: productGroup.id,
            imageUrl: brand.imageUrl || getSeedMediaUrl('product.laptop.macbook'),
          },
        })

        // Inventory oluştur (experiences ve news akışları için)
        let genericInventory = await prisma.inventory.findFirst({
          where: {
            userId: userIdToUse,
            productId: genericProduct.id,
          },
        })

        if (!genericInventory) {
          genericInventory = await prisma.inventory.create({
            data: {
              userId: userIdToUse,
              productId: genericProduct.id,
              hasOwned: true,
              experienceSummary: `${genericProduct.name} hakkında otomatik oluşturulan deneyim`,
            },
          })
        }

        // Inventory media ekle (brand image veya default görsel)
        const genericMediaUrl = genericProduct.imageUrl || brand.imageUrl || getSeedMediaUrl('product.laptop.macbook')
        if (genericMediaUrl) {
          await prisma.inventoryMedia
            .create({
              data: {
                inventoryId: genericInventory.id,
                mediaUrl: genericMediaUrl,
                type: 'IMAGE',
              },
            })
            .catch(() => {})
        }
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
  }

  return configs[brandName] || []
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

  // 2.a Duplicate Teknoloji kategorisini temizle ve her kategoriye min 10 subcategory ekle
  {
    const tech = await prisma.mainCategory.findFirst({ where: { name: 'Technology' } });
    const trTech = await prisma.mainCategory.findFirst({ where: { name: 'Teknoloji' } });
    if (tech && trTech && tech.id !== trTech.id) {
      await prisma.mainCategory.delete({ where: { id: trTech.id } }).catch(() => undefined);
      console.log('🧹 Duplicate "Teknoloji" kategorisi silindi (Technology mevcut olduğu için).');
    }

    const categoriesForSubs = await prisma.mainCategory.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    for (const cat of categoriesForSubs) {
      const existing = await prisma.subCategory.findMany({
        where: { mainCategoryId: cat.id },
        select: { id: true },
      });
      const need = Math.max(0, 10 - existing.length);
      if (need === 0) {
        console.log(`ℹ️ ${cat.name} kategorisinde zaten ${existing.length} subcategory var, atlanıyor.`);
        continue;
      }

      const baseIndex = existing.length;
      const creates = Array.from({ length: need }).map((_, idx) =>
        prisma.subCategory.create({
          data: {
            name: `${cat.name} Sub ${baseIndex + idx + 1}`,
            description: null,
            imageUrl: null,
            mainCategoryId: cat.id,
          },
        })
      );
      await Promise.all(creates);
      console.log(`✅ ${cat.name} kategorisine ${need} yeni subcategory eklendi (toplam ${baseIndex + need}).`);
    }
  }

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
      description: 'Welcome to Tipbox! This is your very first achievement badge.',
      type: 'ACHIEVEMENT',
      rarity: 'COMMON',
      boostMultiplier: 1.0,
      rewardMultiplier: 1.0,
      categoryId: achievementCategory.id,
      imageKey: 'badge.welcome',
    },
    {
      name: 'First Post',
      description: 'You have published your very first post on Tipbox.',
      type: 'ACHIEVEMENT',
      rarity: 'COMMON',
      boostMultiplier: 1.1,
      rewardMultiplier: 1.1,
      categoryId: achievementCategory.id,
      imageKey: 'badge.first-post',
    },
    {
      name: 'Tip Master',
      description: 'You shared 10 helpful tips. You are becoming a real expert.',
      type: 'ACHIEVEMENT',
      rarity: 'RARE',
      boostMultiplier: 1.3,
      rewardMultiplier: 1.3,
      categoryId: achievementCategory.id,
      imageKey: 'badge.tip-master',
    },
    {
      name: 'Community Hero',
      description: 'You posted 100 helpful comments for the community.',
      type: 'ACHIEVEMENT',
      rarity: 'EPIC',
      boostMultiplier: 1.5,
      rewardMultiplier: 1.5,
      categoryId: communityCategory.id,
      imageKey: 'badge.community-hero',
    },
    {
      name: 'Early Bird',
      description: "You are one of the very first users of Tipbox!",
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.2,
      rewardMultiplier: 1.4,
      categoryId: eventCategory.id,
      imageKey: 'badge.early-bird',
    },
    {
      name: 'Beta Tester',
      description: 'You helped us throughout the beta period. Thank you!',
      type: 'EVENT',
      rarity: 'EPIC',
      boostMultiplier: 1.4,
      rewardMultiplier: 1.6,
      categoryId: eventCategory.id,
      imageKey: 'badge.beta-tester',
    },
    {
      name: 'Benchmark Sage',
      description: 'Benchmark paylaşımların topluluk için referans noktası oldu.',
      type: 'ACHIEVEMENT',
      rarity: 'RARE',
      boostMultiplier: 1.35,
      rewardMultiplier: 1.35,
      categoryId: achievementCategory.id,
      imageKey: 'badge.benchmark-sage',
    },
    {
      name: 'Experience Curator',
      description: 'Birden fazla kategoride derinlemesine 15+ deneyim paylaştın.',
      type: 'ACHIEVEMENT',
      rarity: 'EPIC',
      boostMultiplier: 1.5,
      rewardMultiplier: 1.6,
      categoryId: achievementCategory.id,
      imageKey: 'badge.experience-curator',
    },
    {
      name: 'Bridge Ambassador',
      description: 'Bridge topluluk etkinliklerinde marka elçisi seçildin.',
      type: 'EVENT',
      rarity: 'RARE',
      boostMultiplier: 1.25,
      rewardMultiplier: 1.35,
      categoryId: eventCategory.id,
      imageKey: 'badge.bridge-ambassador',
    },
    {
      name: 'Brand Visionary',
      description: 'En yaratıcı bridge kampanyasını yöneterek vitrine çıktın.',
      type: 'EVENT',
      rarity: 'EPIC',
      boostMultiplier: 1.55,
      rewardMultiplier: 1.65,
      categoryId: eventCategory.id,
      imageKey: 'badge.brand-visionary',
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

  // 5.b Boost Options
  console.log('🚀 Creating boost options...')
  const existingBoostOptions = await prisma.boostOption.findMany()
  if (existingBoostOptions.length === 0) {
    await Promise.all([
      prisma.boostOption.create({
        data: {
          title: 'Standard Boost',
          description: 'Standard visibility boost for your question posts.',
          amount: 0,
          isPopular: false,
          isActive: true,
        },
      } as any),
      prisma.boostOption.create({
        data: {
          title: 'Popular Boost',
          description: 'Increases reach for questions that need quick answers.',
          amount: 10,
          isPopular: true,
          isActive: true,
        },
      } as any),
      prisma.boostOption.create({
        data: {
          title: 'Premium Boost',
          description: 'Maximum visibility and priority in the feed.',
          amount: 25,
          isPopular: true,
          isActive: true,
        },
      } as any),
    ]).catch(() => {})
    console.log('✅ 3 boost option oluşturuldu')
  } else {
    console.log(`ℹ️  ${existingBoostOptions.length} boost option zaten mevcut, yeniden oluşturulmadı`)
  }

  // 6. Sub Categories for Technology
  console.log('📁 Creating sub categories for Technology...')
  const techCategory = await prisma.mainCategory.findFirst({
    where: { name: { in: ['Technology', 'Teknoloji'] } },
  });
  if (!techCategory) {
    throw new Error('Teknoloji/Technology main category bulunamadı, seed durduruldu');
  }
  const TECH_MAIN_CATEGORY_ID = techCategory.id;
  
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
    'badge.brandbadge1',
    'badge.brandbadge2',
    'badge.brandbadge3',
    'badge.brandbadge4',
    'badge.brandbadge5',
    'badge.brandbadge6',
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
      const imageUrl = getSeedMediaUrl(cfg.imageKey);
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
    try {
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
      const postId = generateUlid();
      await prisma.contentPost.create({
        data: {
          id: postId,
          userId: userIdToUse,
          type: 'EXPERIENCE',
          title: seed.title,
          body: seed.body,
          mainCategoryId: audioMaxMainCategoryId,
          subCategoryId: audioMaxSubCategoryId,
          productId: AUDIO_MAX_PRODUCT_ID,
          inventoryRequired: seed.inventoryRequired ?? true,
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

        const postId = generateUlid();
        await prisma.contentPost.create({
          data: {
            id: postId,
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
            likesCount: randomBetween(10, 40),
            commentsCount: randomBetween(10, 40),
            sharesCount: randomBetween(10, 40),
            favoritesCount: randomBetween(10, 40),
            viewsCount: randomBetween(80, 400),
          },
        }).catch((error) => {
          console.warn(`⚠️ Failed to create AudioMax experience post: ${error}`);
        });
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
        const postId = generateUlid();
        const title = `AudioMax Comparison #${existingAudioMaxComparisonCount + i + 1}`;
        const body = templateReplacer(comparisonTemplateBody, {
          productPrimary: audioMaxProduct.name,
          productSecondary: comparisonPartner.name,
        });

        await prisma.contentPost.create({
          data: {
            id: postId,
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
            likesCount: randomBetween(10, 40),
            commentsCount: randomBetween(10, 40),
            sharesCount: randomBetween(10, 40),
            favoritesCount: randomBetween(10, 40),
            viewsCount: randomBetween(80, 400),
          },
        }).catch((error) => {
          console.warn(`⚠️ Failed to create AudioMax comparison post: ${error}`);
        });

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

        const postId = generateUlid();
        await prisma.contentPost.create({
          data: {
            id: postId,
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
            likesCount: randomBetween(10, 40),
            commentsCount: randomBetween(10, 40),
            sharesCount: randomBetween(10, 40),
            favoritesCount: randomBetween(10, 40),
            viewsCount: randomBetween(80, 400),
          },
        }).catch((error) => {
          console.warn(`⚠️ Failed to create AudioMax news post: ${error}`);
        });
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

        const postId = generateUlid();
        await prisma.contentPost.create({
          data: {
            id: postId,
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
            likesCount: randomBetween(10, 40),
            commentsCount: randomBetween(10, 40),
            sharesCount: randomBetween(10, 40),
            favoritesCount: randomBetween(10, 40),
            viewsCount: randomBetween(80, 400),
          },
        }).catch((error) => {
          console.warn(`⚠️ Failed to create AudioMax tip post: ${error}`);
        });
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

        const postId = generateUlid();
        await prisma.contentPost.create({
          data: {
            id: postId,
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
            likesCount: randomBetween(10, 40),
            commentsCount: randomBetween(10, 40),
            sharesCount: randomBetween(10, 40),
            favoritesCount: randomBetween(10, 40),
            viewsCount: randomBetween(80, 400),
          },
        }).catch((error) => {
          console.warn(`⚠️ Failed to create AudioMax question post: ${error}`);
        });

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
        imageUrl: nextMarketplaceImage(),
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
        imageUrl: nextMarketplaceImage(),
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
        imageUrl: nextMarketplaceImage(),
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
        imageUrl: nextMarketplaceImage(),
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
        description: 'A glowing gold star badge, reserved for standout users.',
        imageUrl: nextMarketplaceImage(),
        type: 'BADGE',
        rarity: 'RARE',
        isTransferable: true,
        // Satış akışını test edebilmek için owner'ı kullanıcıda tutuyoruz
        currentOwnerId: TARGET_USER_ID,
      } as any
    }),
    prisma.nFT.create({
      data: {
        name: 'Platinum Crown Frame',
        description: 'A platinum crown-shaped profile frame. Look like a member of royalty!',
        imageUrl: nextMarketplaceImage(),
        type: 'COSMETIC',
        rarity: 'EPIC',
        isTransferable: true,
        currentOwnerId: TARGET_USER_ID,
      } as any
    }),
    prisma.nFT.create({
      data: {
        name: 'Rainbow Holographic Badge',
        description: 'A rainbow-colored holographic badge with a hologram effect that changes color with the light.',
        imageUrl: nextMarketplaceImage(),
        type: 'BADGE',
        rarity: 'EPIC',
        isTransferable: true,
        currentOwnerId: TARGET_USER_ID,
      } as any
    }),
    prisma.nFT.create({
      data: {
        name: 'Cyber Neon Glow Effect',
        description: 'A cyberpunk-themed neon glow effect with a blue-pink halo around your avatar.',
        imageUrl: nextMarketplaceImage(),
        type: 'COSMETIC',
        rarity: 'RARE',
        isTransferable: true,
        currentOwnerId: TARGET_USER_ID,
      } as any
    }),
    prisma.nFT.create({
      data: {
        name: 'Mystery Treasure Box',
        description: 'İçinde rastgele nadir ödül bulunan gizemli hazine kutusu. Açınca ne çıkacak?',
        imageUrl: nextMarketplaceImage(),
        type: 'LOOTBOX',
        rarity: 'EPIC',
        isTransferable: true,
        currentOwnerId: TARGET_USER_ID,
      } as any
    }),
    prisma.nFT.create({
      data: {
        name: 'Silver Achievement Badge',
        description: 'Gümüş başarı rozeti. Önemli milestone\'ları temsil eder.',
        imageUrl: nextMarketplaceImage(),
        type: 'BADGE',
        rarity: 'COMMON',
        isTransferable: true,
        currentOwnerId: TARGET_USER_ID,
      } as any
    }),
    
    // ===== TEST KULLANICISI (Ömer Faruk) NFT'LERİ =====
    // Test kullanıcısına ait NFT'ler (satışta değil)
    prisma.nFT.create({
      data: {
        name: 'Premium Tipbox Badge',
        description: 'A rare badge for highly active users on the Tipbox platform',
        imageUrl: getSeedMediaUrl('badge.premium-shoper' as any),
        type: 'BADGE',
        rarity: 'EPIC',
        isTransferable: true,
        currentOwnerId: userIdToUse,
      } as any
    }),
    prisma.nFT.create({
      data: {
        name: 'Early Adopter Badge',
        description: 'A badge reserved for the very first users of the platform',
        imageUrl: getSeedMediaUrl('badge.early-adapter' as any),
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
        imageUrl: getSeedMediaUrl('badge.hardware-expert' as any),
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
        imageUrl: getSeedMediaUrl('badge.wish-marker' as any),
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
        imageUrl: getSeedMediaUrl('marketplace.rainbow-border' as any),
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
        imageUrl: getSeedMediaUrl('badge.premium-shoper' as any),
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
          imageUrl: nextMarketplaceImage(),
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
          imageUrl: nextMarketplaceImage(),
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
          imageUrl: nextMarketplaceImage(),
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
          imageUrl: nextMarketplaceImage(),
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
          imageUrl: nextMarketplaceImage(),
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
  console.log('🔍 Creating explore data...')

  // 1. Marketplace Banners
  console.log('📰 Creating marketplace banners...')
  const banners = await Promise.all([
    prisma.marketplaceBanner.create({
      data: {
        title: 'Yeni Sezon NFT Koleksiyonu',
        description: 'Sınırlı sayıda özel avatar ve badge NFT\'leri şimdi satışta!',
        imageUrl: getSeedMediaUrl('explore.event.primary'),
        linkUrl: '/marketplace/listings?type=BADGE',
        isActive: true,
        displayOrder: 1,
      },
    }),
    prisma.marketplaceBanner.create({
      data: {
        title: 'Epic Rarity İndirimi',
        description: '%30 indirimli EPIC rarity NFT\'lere göz at',
        imageUrl: getSeedMediaUrl('explore.event.primary'),
        linkUrl: '/marketplace/listings?rarity=EPIC',
        isActive: true,
        displayOrder: 2,
      },
    }),
    prisma.marketplaceBanner.create({
      data: {
        title: 'Yeni Markalar Platformda',
        description: 'Ünlü markalar TipBox\'a katıldı! Hemen keşfet.',
        imageUrl: getSeedMediaUrl('explore.event.primary'),
        linkUrl: '/explore/brands/new',
        isActive: true,
        displayOrder: 3,
      },
    }),
  ])
  console.log(`✅ ${banners.length} marketplace banner oluşturuldu`)

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
  console.log('🎪 Creating wishbox events...')

  // 3.a Ensure event images are uploaded to MinIO (event/event.png & event/eventcardbg.png)
  try {
    const s3Service = new S3Service()
    await s3Service.checkAndCreateBucket()

    const eventPrimaryPath = path.join(__dirname, '../tests/assets/event/event.png')
    const eventBgPath = path.join(__dirname, '../tests/assets/event/eventcardbg.png')

    if (existsSync(eventPrimaryPath)) {
      const buf = readFileSync(eventPrimaryPath)
      await s3Service.uploadFile('event/event.png', buf, 'image/png')
      console.log('✅ event/event.png uploaded to MinIO')
    } else {
      console.warn(`⚠️  Event primary image not found at ${eventPrimaryPath}`)
    }

    if (existsSync(eventBgPath)) {
      const buf = readFileSync(eventBgPath)
      await s3Service.uploadFile('event/eventcardbg.png', buf, 'image/png')
      console.log('✅ event/eventcardbg.png uploaded to MinIO')
    } else {
      console.warn(`⚠️  Event background image not found at ${eventBgPath}`)
    }
  } catch (err: any) {
    console.warn('⚠️  Failed to upload event images to MinIO (event/event*.png). Continuing without them.', err?.message || String(err))
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
            imageUrl: getSeedMediaUrl('event.primary' as any),
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
              imageUrl: getSeedMediaUrl('event.primary' as any),
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
            imageUrl: getSeedMediaUrl('event.primary' as any),
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
            imageUrl: getSeedMediaUrl('event.cardbg' as any),
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
  const allUserIds = [userIdToUse, TARGET_USER_ID, ...TRUST_USER_IDS.slice(0, 3)]
  const eventStats = await Promise.all(
    createdEvents.flatMap((event) =>
      event ? allUserIds.map((userId) =>
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
            imageUrl: getSeedMediaUrl('product.laptop.macbook'),
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
            imageUrl: getSeedMediaUrl('product.vacuum.dyson'),
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
                imageUrl: getSeedMediaUrl(productData.mediaKey as any),
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
            const mediaUrl = getSeedMediaUrl(productData.mediaKey as any)
            if (mediaUrl) {
              await prisma.inventoryMedia.create({
                data: {
                  inventoryId: inventory.id,
                  mediaUrl,
                  type: 'IMAGE',
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
  console.log('🏷️  Creating brand categories...')
  const brandCategoryConfigs = [
    { name: 'Technology', imageKey: 'brand.category.technology' },
    { name: 'Home & Living', imageKey: 'brand.category.home-living' },
    { name: 'Kitchen', imageKey: 'brand.category.kitchen' },
    { name: 'Health & Fitness', imageKey: 'brand.category.health-fitness' },
    { name: 'Fashion', imageKey: 'brand.category.fashion' },
    { name: 'Electronics', imageKey: 'brand.category.electronics' },
    { name: 'Sustainability', imageKey: 'brand.category.sustainability' },
    { name: 'Gaming', imageKey: 'brand.category.gaming' },
    { name: 'Beauty', imageKey: 'brand.category.beauty' },
    { name: 'Outdoor', imageKey: 'brand.category.outdoor' },
    { name: 'Pets', imageKey: 'brand.category.pets' },
    { name: 'Travel', imageKey: 'brand.category.travel' },
    { name: 'Baby', imageKey: 'brand.category.baby' },
    { name: 'Automotive', imageKey: 'brand.category.automotive' },
  ];

  const brandCategories = await Promise.all(
    brandCategoryConfigs.map(async (config) => {
      const existing = await prisma.brandCategory.findUnique({
        where: { name: config.name }
      }).catch(() => null);

      if (existing) {
        return prisma.brandCategory.update({
          where: { id: existing.id },
          data: {
            imageUrl: getSeedMediaUrl(config.imageKey as any),
          }
        });
      } else {
        return prisma.brandCategory.create({
          data: {
            name: config.name,
            imageUrl: getSeedMediaUrl(config.imageKey as any),
          }
        });
      }
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
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.computers-tablets'),
      category: 'Technology',
    },
    {
      name: 'SmartHome Pro',
      description: 'Akıllı ev sistemleri ve IoT cihazları konusunda uzman',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.home-appliances'),
      category: 'Home & Living',
    },
    {
      name: 'CoffeeDelight',
      description: 'Premium kahve makineleri ve barista ekipmanları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.home-appliances'),
      category: 'Kitchen',
    },
    {
      name: 'FitnessTech',
      description: 'Akıllı spor ekipmanları ve sağlık takip cihazları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.cameras'),
      category: 'Health & Fitness',
    },
    {
      name: 'StyleHub',
      description: 'Modern ve şık yaşam ürünleri markası',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.phones'),
      category: 'Fashion',
    },
    {
      id: TARGET_AUDIO_BRAND_ID,
      name: 'AudioMax',
      description: 'Premium ses sistemleri ve kulaklıklar',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.headphones'),
      category: 'Electronics',
    },
    {
      name: 'EcoLife',
      description: 'Sürdürülebilir ve çevre dostu ürünler',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.air-conditioner'),
      category: 'Sustainability',
    },
    {
      name: 'GameZone',
      description: 'Oyun konsolları ve aksesuarları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.games'),
      category: 'Gaming',
    },
    {
      name: 'BeautyCare',
      description: 'Kişisel bakım ve güzellik ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.phones'),
      category: 'Beauty',
    },
    {
      name: 'OutdoorGear',
      description: 'Açık hava ve kamp ekipmanları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.drone'),
      category: 'Outdoor',
    },
    {
      name: 'PetCare Plus',
      description: 'Evcil hayvan bakım ürünleri ve aksesuarları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.cameras'),
      category: 'Pets',
    },
    {
      name: 'KitchenMaster',
      description: 'Profesyonel mutfak ekipmanları ve aletleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.home-appliances'),
      category: 'Kitchen',
    },
    {
      name: 'TravelEssentials',
      description: 'Seyahat ve gezi ekipmanları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.phones'),
      category: 'Travel',
    },
    {
      name: 'BabyCare',
      description: 'Bebek bakım ürünleri ve oyuncakları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.cameras'),
      category: 'Baby',
    },
    {
      name: 'AutoParts Pro',
      description: 'Otomotiv yedek parça ve aksesuarları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.otomotiv'),
      category: 'Automotive',
    },
    // Additional brands for better distribution
    {
      name: 'TechNova',
      description: 'Yeni nesil teknoloji çözümleri ve akıllı cihazlar',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.computers-tablets'),
      category: 'Technology',
    },
    {
      name: 'SoundWave',
      description: 'Profesyonel ses ekipmanları ve müzik aletleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.headphones'),
      category: 'Electronics',
    },
    {
      name: 'FashionForward',
      description: 'Trend moda ve aksesuar koleksiyonları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.phones'),
      category: 'Fashion',
    },
    {
      name: 'PlayStation Pro',
      description: 'Gaming konsolları ve oyun aksesuarları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.games'),
      category: 'Gaming',
    },
    {
      name: 'GlowBeauty',
      description: 'Premium kozmetik ve cilt bakım ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.phones'),
      category: 'Beauty',
    },
    {
      name: 'AdventureGear',
      description: 'Doğa sporları ve macera ekipmanları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.drone'),
      category: 'Outdoor',
    },
    {
      name: 'PetParadise',
      description: 'Evcil hayvan oyuncakları ve bakım ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.cameras'),
      category: 'Pets',
    },
    {
      name: 'GreenLife',
      description: 'Organik ve sürdürülebilir yaşam ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.air-conditioner'),
      category: 'Sustainability',
    },
    {
      name: 'Wanderlust',
      description: 'Seyahat çantaları ve gezi aksesuarları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.phones'),
      category: 'Travel',
    },
    {
      name: 'CarMax',
      description: 'Otomotiv bakım ürünleri ve aksesuarları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.otomotiv'),
      category: 'Automotive',
    },
    {
      name: 'BabyBloom',
      description: 'Bebek giyim ve bakım ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.cameras'),
      category: 'Baby',
    },
    {
      name: 'FitLife',
      description: 'Spor giyim ve fitness ekipmanları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.cameras'),
      category: 'Health & Fitness',
    },
    {
      name: 'HomeStyle',
      description: 'Ev dekorasyon ve mobilya ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.home-appliances'),
      category: 'Home & Living',
    },
    {
      name: 'ChefPro',
      description: 'Profesyonel aşçı ekipmanları ve mutfak aletleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.home-appliances'),
      category: 'Kitchen',
    },
    // --- Additional brands to ensure 5 per category ---
    // Technology (need 3 more)
    {
      name: 'FutureTech',
      description: 'Geleceğin akıllı cihazları ve inovatif çözümler',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.computers-tablets'),
      category: 'Technology',
    },
    {
      name: 'NanoWorks',
      description: 'Kompakt ve verimli teknoloji ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.computers-tablets'),
      category: 'Technology',
    },
    {
      name: 'SmartCore',
      description: 'Akıllı ekosistem ve bağlantılı cihazlar',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.computers-tablets'),
      category: 'Technology',
    },
    // Home & Living (need 3 more)
    {
      name: 'CozyNest',
      description: 'Rahat ve şık ev yaşam ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.home-appliances'),
      category: 'Home & Living',
    },
    {
      name: 'LivingPlus',
      description: 'Akıllı ev konfor çözümleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.home-appliances'),
      category: 'Home & Living',
    },
    {
      name: 'CasaPrime',
      description: 'Dekorasyon ve fonksiyonel ev aksesuarları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.home-appliances'),
      category: 'Home & Living',
    },
    // Kitchen (need 2 more)
    {
      name: 'CookMasters',
      description: 'Mutfak şefleri için premium ekipmanlar',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.home-appliances'),
      category: 'Kitchen',
    },
    {
      name: 'KitchenCraft',
      description: 'Yaratıcı mutfak gereçleri ve aletleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.home-appliances'),
      category: 'Kitchen',
    },
    {
      name: 'GourmetHub',
      description: 'Gurmelere özel pişirme çözümleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.home-appliances'),
      category: 'Kitchen',
    },
    // Health & Fitness (need 3 more)
    {
      name: 'WellnessPro',
      description: 'Sağlık ve wellness teknoloji ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.cameras'),
      category: 'Health & Fitness',
    },
    {
      name: 'FitTrack',
      description: 'Akıllı takip cihazları ve fitness ekipmanları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.cameras'),
      category: 'Health & Fitness',
    },
    {
      name: 'HealthGear',
      description: 'Evde spor ve sağlık destek ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.cameras'),
      category: 'Health & Fitness',
    },
    // Fashion (need 3 more)
    {
      name: 'UrbanStyle',
      description: 'Şehirli ve modern stil koleksiyonları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.phones'),
      category: 'Fashion',
    },
    {
      name: 'ChicLane',
      description: 'Zarif ve trend moda ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.phones'),
      category: 'Fashion',
    },
    {
      name: 'TrendLine',
      description: 'Sezonun öne çıkan aksesuar ve giyim ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.phones'),
      category: 'Fashion',
    },
    // Electronics (need 3 more)
    {
      name: 'VoltEdge',
      description: 'Yüksek performanslı elektronik cihazlar',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.headphones'),
      category: 'Electronics',
    },
    {
      name: 'PulseAudio',
      description: 'Profesyonel ses ve müzik ekipmanları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.headphones'),
      category: 'Electronics',
    },
    {
      name: 'CircuitHub',
      description: 'Akıllı elektronik komponent ve aksesuarları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.computers-tablets'),
      category: 'Electronics',
    },
    // Sustainability (need 3 more)
    {
      name: 'EcoWave',
      description: 'Enerji verimli ve çevre dostu ürünler',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.air-conditioner'),
      category: 'Sustainability',
    },
    {
      name: 'GreenNest',
      description: 'Geri dönüştürülebilir ve sürdürülebilir çözümler',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.air-conditioner'),
      category: 'Sustainability',
    },
    {
      name: 'PureEarth',
      description: 'Doğa dostu yaşam ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.air-conditioner'),
      category: 'Sustainability',
    },
    // Gaming (need 3 more)
    {
      name: 'ProGamer',
      description: 'E-spor ekipmanları ve performans aksesuarları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.games'),
      category: 'Gaming',
    },
    {
      name: 'ArcadeHub',
      description: 'Retro ve arcade oyun çözümleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.games'),
      category: 'Gaming',
    },
    {
      name: 'NextLevel',
      description: 'Gaming donanımı ve çevre birimleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.games'),
      category: 'Gaming',
    },
    // Beauty (need 3 more)
    {
      name: 'LuxeGlow',
      description: 'Lüks cilt bakım ve güzellik ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.phones'),
      category: 'Beauty',
    },
    {
      name: 'PureBeauty',
      description: 'Doğal içerikli kozmetik ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.phones'),
      category: 'Beauty',
    },
    {
      name: 'SkinEssence',
      description: 'Dermatolojik olarak test edilmiş bakım ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.phones'),
      category: 'Beauty',
    },
    // Outdoor (need 3 more)
    {
      name: 'TrailBlaze',
      description: 'Doğa yürüyüşü ve kamp ekipmanları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.drone'),
      category: 'Outdoor',
    },
    {
      name: 'CampPro',
      description: 'Profesyonel kampçılık çözümleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.drone'),
      category: 'Outdoor',
    },
    {
      name: 'HikeMate',
      description: 'Trekking ve tırmanış ekipmanları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.drone'),
      category: 'Outdoor',
    },
    // Pets (need 3 more)
    {
      name: 'PawPlanet',
      description: 'Evcil hayvan yaşam ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.cameras'),
      category: 'Pets',
    },
    {
      name: 'PetJoy',
      description: 'Pet oyuncak ve bakım ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.cameras'),
      category: 'Pets',
    },
    {
      name: 'FurryCare',
      description: 'Evcil dostlar için sağlık ve bakım çözümleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.cameras'),
      category: 'Pets',
    },
    // Travel (need 3 more)
    {
      name: 'GlobeTrot',
      description: 'Seyahat aksesuarları ve bavullar',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.phones'),
      category: 'Travel',
    },
    {
      name: 'TripMate',
      description: 'Konforlu seyahat çözümleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.phones'),
      category: 'Travel',
    },
    {
      name: 'VoyagePro',
      description: 'Dayanıklı seyahat ekipmanları',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.phones'),
      category: 'Travel',
    },
    // Baby (need 3 more)
    {
      name: 'TinySteps',
      description: 'Bebek giyim ve bakım çözümleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.cameras'),
      category: 'Baby',
    },
    {
      name: 'BabyNest',
      description: 'Konforlu bebek uyku ve bakım ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.cameras'),
      category: 'Baby',
    },
    {
      name: 'LittleJoy',
      description: 'Bebek oyuncakları ve gelişim ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.cameras'),
      category: 'Baby',
    },
    // Automotive (need 3 more)
    {
      name: 'DriveMax',
      description: 'Otomotiv performans ve bakım ürünleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.otomotiv'),
      category: 'Automotive',
    },
    {
      name: 'AutoGear',
      description: 'Araç içi aksesuar ve teknolojiler',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.otomotiv'),
      category: 'Automotive',
    },
    {
      name: 'MotoPro',
      description: 'Araç bakım ve güvenlik çözümleri',
      logoUrl: getSeedMediaUrl('explore.event.primary'),
      imageUrl: getSeedMediaUrl('catalog.otomotiv'),
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
  console.log('🖼️ Brand catalog için marketplace.jpg görselleri yükleniyor...')
  const marketplaceImagePath = path.join(__dirname, '../tests/assets/marketplace/marketplace.jpg')
  
  // Dosya varlık kontrolü
  if (existsSync(marketplaceImagePath)) {
    try {
      console.log('  📁 marketplace.jpg dosyası bulundu, MinIO\'ya yükleniyor...')
      const s3Service = new S3Service()
      await s3Service.checkAndCreateBucket()
      
      const marketplaceImageBuffer = readFileSync(marketplaceImagePath)
      console.log(`  📦 Görsel boyutu: ${(marketplaceImageBuffer.length / 1024 / 1024).toFixed(2)} MB`)
      
      // Tüm brand'ları al
      const allBrands = await prisma.brand.findMany()
      console.log(`  📋 ${allBrands.length} brand için görsel yükleme başlatılıyor...`)
      
      let successCount = 0
      let failCount = 0
      
      // Her brand için marketplace.jpg'yi yükle
      for (const brand of allBrands) {
        try {
          // Her brand için unique bir object key oluştur
          const objectKey = `brands/catalog/${brand.id}/marketplace.jpg`
          
          // MinIO'ya yükle (URL zaten getSeedMediaUrl / getPublicMediaBaseUrl ile normalize edilir)
          const externalUrl = await s3Service.uploadFile(
            objectKey,
            marketplaceImageBuffer,
            'image/jpeg'
          )

          // Brand'ı güncelle - imageUrl'e ekle (varsa koru, yoksa ekle)
          await prisma.brand.update({
            where: { id: brand.id },
            data: {
              imageUrl: externalUrl,
            },
          })
          
          successCount++
          
          // Her 10 brand'ta bir progress göster
          if (successCount % 10 === 0) {
            console.log(`    ✅ ${successCount}/${allBrands.length} brand için görsel yüklendi...`)
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
            imageUrl: getSeedMediaUrl(imageKey),
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
          { name: 'BreezeCool 9K', description: 'Sessiz inverter klima', imageKey: 'product.generic.11' },
          { name: 'BreezeCool 12K', description: 'Geniş alan için inverter', imageKey: 'product.phone.samsung' },
          { name: 'WindFree Pro', description: 'Akıllı hava yönlendirme', imageKey: 'product.generic.5' },
          { name: 'Arctic Sense', description: 'Hızlı soğutan model', imageKey: 'product.generic.6' },
          { name: 'PureAir Duo', description: 'Filtreli iklimlendirme', imageKey: 'product.generic.10' },
        ],
      },
      {
        name: 'Kamera & Lens',
        mainCategoryName: 'Technology',
        subCategoryName: 'Kamera & Lens',
        imageKey: 'catalog.cameras',
        products: [
          { name: 'ShotPro Mirrorless', description: '4K aynasız kamera', imageKey: 'product.generic.3' },
          { name: 'LensKit 50mm Prime', description: 'Portre için hızlı lens', imageKey: 'product.generic.4' },
          { name: 'VlogCam Compact', description: 'Hafif vlog kamerası', imageKey: 'product.generic.2' },
          { name: 'ProZoom Bridge', description: 'Uzun menzil zoom', imageKey: 'product.generic.5' },
          { name: 'ActionCam Mini', description: 'Dayanıklı aksiyon kamera', imageKey: 'product.generic.1' },
        ],
      },
      {
        name: 'Bilgisayar & Tablet',
        mainCategoryName: 'Technology',
        subCategoryName: 'Bilgisayar & Tablet',
        imageKey: 'catalog.computers-tablets',
        products: [
          { name: 'UltraBook Air', description: 'İnce ve hafif dizüstü', imageKey: 'product.laptop.macbook' },
          { name: 'Creator Station', description: 'Yaratıcılar için performans', imageKey: 'product.generic.7' },
          { name: 'Tablet Flex', description: 'Kalem destekli tablet', imageKey: 'product.generic.6' },
          { name: 'CodePad Mini', description: 'Kompakt üretkenlik tableti', imageKey: 'product.generic.8' },
          { name: 'Studio Dock', description: 'Dock destekli çalışma seti', imageKey: 'product.generic.9' },
        ],
      },
      {
        name: 'Drone & Aksiyon',
        mainCategoryName: 'Technology',
        subCategoryName: 'Drone & Aksiyon',
        imageKey: 'catalog.drone',
        products: [
          { name: 'SkyScout Mini', description: 'Kompakt drone', imageKey: 'product.generic.2' },
          { name: 'AirRide 4K', description: '4K çekim için stabilizasyon', imageKey: 'product.generic.3' },
          { name: 'HoverCam Pro', description: 'Gelişmiş takip modu', imageKey: 'product.generic.4' },
          { name: 'TrackFly GPS', description: 'GPS destekli uçuş', imageKey: 'product.generic.5' },
          { name: 'CineWing Dual', description: 'Çift kamera desteği', imageKey: 'product.generic.1' },
        ],
      },
      {
        name: 'Oyun & Konsol',
        mainCategoryName: 'Hobi & Eğlence',
        subCategoryName: 'Oyun & Konsol',
        imageKey: 'catalog.games',
        products: [
          { name: 'PlayWave Konsol', description: 'Yeni nesil oyun konsolu', imageKey: 'product.generic.10' },
          { name: 'GamePad Elite', description: 'Hassas tetik ve titreşim', imageKey: 'product.generic.8' },
          { name: 'VR Next', description: 'Sanal gerçeklik seti', imageKey: 'product.generic.9' },
          { name: 'Arena Dock', description: 'Çok oyunculu istasyon', imageKey: 'product.generic.7' },
          { name: 'Cloud Controller', description: 'Bulut oyun kolu', imageKey: 'product.generic.6' },
        ],
      },
      {
        name: 'Beyaz Eşya',
        mainCategoryName: 'Home & Living',
        subCategoryName: 'Beyaz Eşya',
        imageKey: 'catalog.home-appliances',
        products: [
          { name: 'PureWash X', description: 'Hijyen modlu çamaşır makinesi', imageKey: 'product.generic.10' },
          { name: 'DryCare Heat Pump', description: 'Isı pompalı kurutma', imageKey: 'product.generic.11' },
          { name: 'FreshCool XL', description: 'Geniş hacimli buzdolabı', imageKey: 'product.generic.5' },
          { name: 'SteamWard Care', description: 'Buharlı bakım programı', imageKey: 'product.generic.4' },
          { name: 'EcoDish Pro', description: 'Az tüketimli bulaşık makinesi', imageKey: 'product.generic.3' },
        ],
      },
      {
        name: 'Küçük Ev Aletleri',
        mainCategoryName: 'Home & Living',
        subCategoryName: 'Küçük Ev Aletleri',
        imageKey: 'catalog.kucukev',
        products: [
          { name: 'ChefMix Pro', description: 'Çok amaçlı mutfak robotu', imageKey: 'product.generic.8' },
          { name: 'BrewMaster Duo', description: 'Filtre + Türk kahvesi makinesi', imageKey: 'product.generic.9' },
          { name: 'SlicePrep Compact', description: 'Dilimleme ve rende seti', imageKey: 'product.generic.10' },
          { name: 'QuickBlend Go', description: 'Taşınabilir blender', imageKey: 'product.generic.11' },
          { name: 'SmartKettle One', description: 'Isı kontrollü kettle', imageKey: 'product.generic.2' },
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
          { name: 'VisionMax 55', description: '55 inç 4K QLED', imageKey: 'product.generic.7' },
          { name: 'VisionMax 65', description: '65 inç geniş ekran', imageKey: 'product.generic.6' },
          { name: 'VisionMax 75', description: '75 inç sinema deneyimi', imageKey: 'product.generic.10' },
          { name: 'BeamBar Atmos', description: 'Dolby Atmos soundbar', imageKey: 'product.generic.8' },
          { name: 'StreamBox Pro', description: 'Akış medya oynatıcı', imageKey: 'product.generic.9' },
        ],
      },
      {
        name: 'Akıllı Ev & Güvenlik',
        mainCategoryName: 'Technology',
        subCategoryName: 'Akıllı Ev & Güvenlik',
        imageKey: 'catalog.smart-home-devices',
        products: [
          { name: 'SmartHub Core', description: 'Merkezi otomasyon beyni', imageKey: 'product.generic.2' },
          { name: 'SmartCam 360', description: '360° güvenlik kamerası', imageKey: 'product.generic.3' },
          { name: 'DoorGuard Secure', description: 'Akıllı kapı kilidi', imageKey: 'product.generic.4' },
          { name: 'AirSense Mini', description: 'Hava kalitesi sensörü', imageKey: 'product.generic.5' },
          { name: 'PowerPlug Energy', description: 'Enerji ölçer priz', imageKey: 'product.generic.1' },
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
            imageUrl: getSeedMediaUrl(groupDef.imageKey),
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
            imageUrl: getSeedMediaUrl(groupDef.imageKey),
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

        if (existingProduct) continue

        await prisma.product.create({
          data: {
            name: productDef.name,
            brand: audioMaxBrandV2.name,
            description: productDef.description,
            imageUrl: getSeedMediaUrl(productDef.imageKey),
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
          imageUrl: getSeedMediaUrl('catalog.headphones'),
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
          { name: 'AudioMax Desk Mat', description: 'Kaymaz masa matı', imageKey: 'product.generic.7' },
        ],
      },
      {
        name: 'Stüdyo Çevre Birimleri',
        imageKey: 'catalog.computers-tablets',
        products: [
          { name: 'AudioMax Monitor Stand', description: 'Ergonomik stand', imageKey: 'product.generic.8' },
          { name: 'AudioMax Desk Lamp', description: 'Ayarlanabilir ışık', imageKey: 'product.generic.9' },
          { name: 'AudioMax USB Hub', description: '7 port USB hub', imageKey: 'product.generic.10' },
          { name: 'AudioMax SD Reader', description: 'Çift yuvalı kart okuyucu', imageKey: 'product.generic.11' },
          { name: 'AudioMax Mic Arm', description: 'Stüdyo mikrofon kolu', imageKey: 'product.headphone.primary' },
        ],
      },
      {
        name: 'Taşınabilir Ses',
        imageKey: 'catalog.headphones',
        products: [
          { name: 'AudioMax Pocket DAC', description: 'Kompakt DAC', imageKey: 'product.headphone.secondary' },
          { name: 'AudioMax Clip Amp', description: 'Taşınabilir amfi', imageKey: 'product.generic.2' },
          { name: 'AudioMax Sport Buds', description: 'Suya dayanıklı kulaklık', imageKey: 'product.generic.3' },
          { name: 'AudioMax Travel Case', description: 'Sert taşıma çantası', imageKey: 'product.generic.4' },
          { name: 'AudioMax Cable Kit', description: 'Değiştirilebilir kablo seti', imageKey: 'product.generic.5' },
        ],
      },
      {
        name: 'Ev Eğlence',
        imageKey: 'catalog.games',
        products: [
          { name: 'AudioMax Mini Soundbar', description: 'Kompakt soundbar', imageKey: 'product.generic.6' },
          { name: 'AudioMax BT Receiver', description: 'Bluetooth alıcı', imageKey: 'product.generic.7' },
          { name: 'AudioMax Media Box', description: 'Medya oynatıcı', imageKey: 'product.generic.8' },
          { name: 'AudioMax Remote', description: 'Evrensel kumanda', imageKey: 'product.generic.9' },
          { name: 'AudioMax LED Strip', description: 'Ambiyans ışık seti', imageKey: 'product.generic.10' },
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
            imageUrl: getSeedMediaUrl(grp.imageKey as SeedMediaKey),
          },
        })
      }

      for (const productDef of grp.products) {
        const exists = await prisma.product.findFirst({
          where: { name: productDef.name, brand: audioMaxBrandV2.name, groupId: productGroup.id },
        })
        if (exists) continue

        await prisma.product.create({
          data: {
            name: productDef.name,
            brand: audioMaxBrandV2.name,
            description: productDef.description,
            imageUrl: getSeedMediaUrl(productDef.imageKey as SeedMediaKey),
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
        { name: 'AudioMax Studio Mic', description: 'Kondenser mikrofon', imageKey: 'product.generic.2' },
        { name: 'AudioMax Wireless Speaker Mini', description: 'Kompakt BT hoparlör', imageKey: 'product.generic.3' },
        { name: 'AudioMax Gaming Headset', description: '7.1 surround kulaklık', imageKey: 'product.generic.4' },
        { name: 'AudioMax Soundbar Plus', description: 'Sinema deneyimi için', imageKey: 'product.generic.5' },
        { name: 'AudioMax Earbuds Lite', description: 'Günlük kullanım için', imageKey: 'product.generic.6' },
        { name: 'AudioMax Home Theater', description: '5.1 ev sineması', imageKey: 'product.generic.7' },
        { name: 'AudioMax Portable Amp', description: 'Cep tipi kulaklık amfisi', imageKey: 'product.generic.8' },
        { name: 'AudioMax HiFi Cable', description: 'Premium ses kablosu', imageKey: 'product.generic.9' },
        { name: 'AudioMax DJ Mixer', description: '2 kanal DJ mikser', imageKey: 'product.generic.10' },
        { name: 'AudioMax Studio Monitor', description: 'Referans monitör', imageKey: 'product.generic.11' },
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
          if (exists) continue

          await prisma.product.create({
            data: {
              name: productDef.name,
              brand: audioMaxBrandV2.name,
              description: productDef.description,
              imageUrl: getSeedMediaUrl(productDef.imageKey as SeedMediaKey),
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
            imageUrl: getSeedMediaUrl(imageKey),
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
              imageUrl: getSeedMediaUrl('catalog.headphones'),
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
            imageUrl: getSeedMediaUrl(imageKey),
            groupId: specificProductGroup || null, // ProductGroup'a bağla
          }
        })
        seedBrandProductsCount++
      } catch (error) {
        console.warn(`Product oluşturulamadı (${specificBrand.name} - ${productData.name}): ${error}`)
      }
    }

    // AudioMax Audio Cable ürünlerinde imageUrl boşsa doldur
    const audioCableImage = getSeedMediaUrl('product.headphone.secondary')
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
              imageUrl: getSeedMediaUrl('catalog.otomotiv'),
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
                imageUrl: getSeedMediaUrl('catalog.home-appliances'),
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
              imageUrl: autopartsBrand.imageUrl || getSeedMediaUrl('catalog.otomotiv'),
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
                imageUrl: getSeedMediaUrl(imageKey),
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
        const postId = generateUlid()
        await prisma.contentPost.create({
          data: {
            id: postId,
            userId: userIdToUse,
            type: 'FREE',
            title: `${product.name} Deneyim Paylaşımı ${i + 1}`,
            body: experienceTemplates[i % experienceTemplates.length],
            productId: product.id,
            inventoryRequired: false,
            isBoosted: false,
            createdAt: daysAgo(Math.floor(Math.random() * 30) + 1),
          }
        })
        experienceNewsPostsCount++
      } catch (error) {
        console.warn(`Experience post oluşturulamadı: ${error}`)
      }
    }

    // Her product için 1 news post (UPDATE type)
    try {
      const postId = generateUlid()
      await prisma.contentPost.create({
        data: {
          id: postId,
          userId: userIdToUse,
          type: 'UPDATE',
          title: `${product.name} Haberleri`,
          body: newsTemplates[Math.floor(Math.random() * newsTemplates.length)],
          productId: product.id,
          inventoryRequired: false,
          isBoosted: false,
          createdAt: daysAgo(Math.floor(Math.random() * 30) + 1),
        }
      })
      experienceNewsPostsCount++
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
                mediaUrl: product.imageUrl || getSeedMediaUrl('product.headphone.primary'),
                type: 'IMAGE',
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

      const targetAudioMaxFeedPosts = 20
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
            await prisma.contentPost.create({
              data: {
                id: postId,
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
              },
            })

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
              await prisma.postTip.create({
                data: {
                  postId,
                  tipCategory: template.tipCategory || 'USAGE',
                  isVerified: true,
                },
              })
            }

            if (template.type === 'QUESTION') {
              await prisma.postQuestion.create({
                data: {
                  postId,
                  expectedAnswerFormat: template.answerFormat || 'SHORT',
                  relatedProductId: product.id,
                },
              })
            }

            if (template.type === 'COMPARE') {
              if (audioMaxProducts.length < 2) {
                console.warn('⚠️ Compare template skipped — insufficient AudioMax products')
              } else {
                const secondaryProduct = audioMaxProducts[(i + 1) % audioMaxProducts.length] || product
                const comparison = await prisma.postComparison.create({
                  data: {
                    postId,
                    product1Id: product.id,
                    product2Id: secondaryProduct.id,
                    comparisonSummary:
                      template.comparisonSummary ||
                      'Detailed look at how two AudioMax configurations behave in real living rooms.',
                  },
                })

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

    // Her brand için 5-8 trending post oluştur
    const trendingPostCount = randomBetween(5, 8)
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
        const postId = generateUlid()
        await prisma.contentPost.create({
          data: {
            id: postId,
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
            // Trending post'lar için yüksek engagement değerleri
            likesCount: randomBetween(40, 150),
            commentsCount: randomBetween(8, 40),
            sharesCount: randomBetween(3, 25),
            favoritesCount: randomBetween(10, 60),
            viewsCount: randomBetween(300, 1200),
          },
        })

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

  // Brand Products & Experiences & News Seed
  console.log('🏷️ Creating brand products, experiences & news...')
  await seedBrandProducts(userIdToUse)
  console.log('✅ Brand products seeding completed')

  // Tüm product'lar için inventory media ekle (explore/products/new için)
  console.log('🖼️ Adding inventory media for all products...')
  await ensureProductImages(userIdToUse)
  console.log('✅ Product images ensured')

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
        const experiencePostId = generateUlid()
        const templateBody = experienceTemplates[i % experienceTemplates.length]
        const title = `${product.name} ile Deneyim Notları #${existingCount + i + 1}`

        await prisma.contentPost.create({
          data: {
            id: experiencePostId,
            userId: userIdToUse,
            type: 'FREE',
            title,
            body: `${templateBody} (Brand: ${targetBrandName})`,
            productId: product.id,
            inventoryRequired: false,
            isBoosted: (existingCount + i) % 3 === 0,
            createdAt: daysAgo(randomBetween(3, 45)),
          },
        })

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
        
        // EXPERIENCES - Her product için en az 10-15 experience post
        const targetExperiences = 12
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
            const experiencePostId = generateUlid()
            const templateBody = experienceTemplates[i % experienceTemplates.length]
            const title = `${product.name} Deneyim Paylaşımı #${existingExperiences + i + 1}`
            
            await prisma.contentPost.create({
              data: {
                id: experiencePostId,
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
                likesCount: randomBetween(5, 35),
                commentsCount: randomBetween(2, 20),
                sharesCount: randomBetween(1, 15),
                favoritesCount: randomBetween(2, 25),
                viewsCount: randomBetween(50, 300),
              },
            })
            
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
        
        // COMPARISONS - Her product için en az 5-8 comparison post
        const targetComparisons = 6
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
            const comparePostId = generateUlid()
            const templateBody = comparisonTemplates[i % comparisonTemplates.length]
            const title = `${product.name} vs ${partnerProduct.name} Karşılaştırma #${existingComparisons + i + 1}`
            
            await prisma.contentPost.create({
              data: {
                id: comparePostId,
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
                likesCount: randomBetween(8, 40),
                commentsCount: randomBetween(5, 25),
                sharesCount: randomBetween(2, 18),
                favoritesCount: randomBetween(3, 20),
                viewsCount: randomBetween(80, 350),
              },
            })
            
            // Comparison relation ekle
            await prisma.postComparison.create({
              data: {
                postId: comparePostId,
                product1Id: product.id,
                product2Id: partnerProduct.id,
                comparisonSummary: `Practical comparison between ${product.name} and ${partnerProduct.name} for everyday use.`,
              },
            }).catch(() => {})
            
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
        
        // NEWS (UPDATE) - Her product için en az 5-8 news post
        const targetNews = 6
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
            const newsPostId = generateUlid()
            const templateBody = newsTemplates[i % newsTemplates.length]
            const title = `${brand.name} Haberleri - ${product.name} #${existingNews + i + 1}`
            
            await prisma.contentPost.create({
              data: {
                id: newsPostId,
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
                likesCount: randomBetween(5, 30),
                commentsCount: randomBetween(2, 15),
                sharesCount: randomBetween(1, 12),
                favoritesCount: randomBetween(2, 18),
                viewsCount: randomBetween(60, 250),
              },
            })
            
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

        // EXTRA: News feed formatı için en az 9 güncel haber (image + stats ile)
        const extraNewsTarget = 9
        if (existingNews < extraNewsTarget) {
          const extrasToCreate = extraNewsTarget - existingNews
          console.log(`        📰 Adding ${extrasToCreate} neutral news posts for feed format...`)
          const neutralTemplates = [
            `${product.name} receives a stability patch focusing on battery and connectivity.`,
            `${brand.name} confirms a minor feature rollout for ${product.name} users this week.`,
            `Early adopters of ${product.name} report smoother performance after the latest update.`,
            `${product.name} gets quality-of-life tweaks, improving everyday usability.`,
          ]
          for (let i = 0; i < extrasToCreate; i++) {
            const newsPostId = generateUlid()
            const templateBody = neutralTemplates[i % neutralTemplates.length]
            const title = `${product.name} News Update #${existingNews + i + 1}`
            await prisma.contentPost.create({
              data: {
                id: newsPostId,
                userId: userIdToUse,
                productId: product.id,
                type: 'UPDATE',
                title,
                body: templateBody,
                productGroupId: product.groupId || undefined,
                mainCategoryId,
                subCategoryId,
                inventoryRequired: false,
                isBoosted: false,
                likesCount: 5 + i,
                commentsCount: 2 + i,
                sharesCount: 1 + (i % 3),
                favoritesCount: 3 + i,
                viewsCount: 80 + i * 5,
                createdAt: daysAgo(randomBetween(1, 20)),
                updatedAt: new Date(),
              },
            }).catch((error) => {
              console.warn(`⚠️ Failed to create neutral news post for ${product.name}: ${error}`)
            })

            await prisma.contentPostTag.createMany({
              data: [
                { postId: newsPostId, tag: brand.name },
                { postId: newsPostId, tag: 'News' },
              ],
              skipDuplicates: true,
            }).catch(() => {})
          }
        } else {
          console.log(`        ℹ️ Product already has ${existingNews} news posts (>= ${extraNewsTarget})`)
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
      
      const targetExpCount = 15
      
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
          const experiencePostId = generateUlid()
          const templateBody = experienceTemplates[i % experienceTemplates.length]
          const title = `${targetProductForExp.name} Deneyim Paylaşımı #${existingExpCount + i + 1}`
          
          await prisma.contentPost.create({
            data: {
              id: experiencePostId,
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
              likesCount: randomBetween(5, 40),
              commentsCount: randomBetween(2, 25),
              sharesCount: randomBetween(1, 18),
              favoritesCount: randomBetween(2, 30),
              viewsCount: randomBetween(50, 350),
            },
          })
          
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
  summaryLines.push(`• ${createdEvents.length} Wishbox Events`)
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
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
