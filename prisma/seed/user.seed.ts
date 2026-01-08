import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { DEFAULT_PROFILE_BANNER_URL } from '../../src/domain/user/profile.constants'
import { getSeedMediaPath } from './helpers/media.helper'
import { S3Service } from '../../src/infrastructure/s3/s3.service'
import { readFileSync } from 'fs'
import * as path from 'path'
import { generateUlid } from './types'

const prisma = new PrismaClient()
const DEFAULT_BANNER_URL = DEFAULT_PROFILE_BANNER_URL || getSeedMediaPath('user.banner.primary')
const PRIMARY_AVATAR_URL = getSeedMediaPath('user.avatar.primary')

// Static IDs (same as in main seed)
const TEST_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07' // omer@tipbox.co
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TARGET_USER_ID = '248cc91f-b551-4ecc-a885-db1163571330' // markettest@tipbox.co
const TRUST_USER_IDS = [
  '11111111-1111-4111-a111-111111111111',
  '22222222-2222-4222-a222-222222222222',
  '33333333-3333-4333-a333-333333333333',
  '44444444-4444-4444-a444-444444444444',
  '55555555-5555-4555-a555-555555555555',
]
const TRUSTER_USER_IDS = [
  'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-cccc-cccccccccccc',
]

const DEFAULT_PASSWORD = 'password123'

async function syncProfileTrustCounters(): Promise<void> {
  console.log('🔁 Profil trust sayaçları senkronize ediliyor...')

  await prisma.$executeRaw`
    UPDATE "profiles"
    SET "trust_count" = 0,
        "truster_count" = 0
  `

  await prisma.$executeRaw`
    UPDATE "profiles" AS p
    SET "trust_count" = src.cnt
    FROM (
      SELECT "truster_id" AS user_id, COUNT(*) AS cnt
      FROM "trust_relations"
      GROUP BY "truster_id"
    ) AS src
    WHERE p."user_id" = src.user_id
  `

  await prisma.$executeRaw`
    UPDATE "profiles" AS p
    SET "truster_count" = src.cnt
    FROM (
      SELECT "trusted_user_id" AS user_id, COUNT(*) AS cnt
      FROM "trust_relations"
      GROUP BY "trusted_user_id"
    ) AS src
    WHERE p."user_id" = src.user_id
  `

  console.log('✅ Profil trust sayaçları güncellendi')
}

export async function seedUsersAndProfiles(): Promise<void> {
  console.log('👤 User seeding started...')

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)
  
  // Not: Tüm seed kullanıcı ID'leri (TEST_USER_ID, TARGET_USER_ID, TRUST_USER_IDS, TRUSTER_USER_IDS)
  // artık seed/index.ts'de markSeedStart() sonrası otomatik olarak metadata'ya ekleniyor
  // Burada sadece kullanıcıları oluşturuyoruz, metadata'ya ekleme işlemi index.ts'de yapılıyor
  
  // Create or get primary test user
  let testUser = await prisma.user.findUnique({ where: { id: TEST_USER_ID } })
  if (!testUser) {
    testUser = (await prisma.user.findUnique({ where: { email: 'omer@tipbox.co' } })) || null
  }
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: 'omer@tipbox.co',
        passwordHash,
        emailVerified: true,
        status: 'ACTIVE',
      },
    })
    console.log('✅ Test user created')
  } else {
    console.log('✅ Test user exists')
  }

  const userIdToUse = testUser.id

  // Profile upsert
  await prisma.profile.upsert({
    where: { userId: userIdToUse },
    update: {
      displayName: 'Ömer Faruk',
      userName: 'omerfaruk',
      bio: 'Passionate about exploring the latest gadgets and digital lifestyles. Sharing honest reviews and real-life experiences with tech products.',
      bannerUrl: DEFAULT_BANNER_URL,
      country: 'Turkey',
    },
    create: {
      userId: userIdToUse,
      displayName: 'Ömer Faruk',
      userName: 'omerfaruk',
      bio: 'Passionate about exploring the latest gadgets and digital lifestyles. Sharing honest reviews and real-life experiences with tech products.',
      bannerUrl: DEFAULT_BANNER_URL,
      country: 'Turkey',
    },
  })
  console.log('✅ Profile upserted')

  // Avatar
  const existingAvatar = await prisma.userAvatar.findFirst({ where: { userId: userIdToUse, isActive: true } })
  if (existingAvatar) {
    await prisma.userAvatar.update({
      where: { id: existingAvatar.id },
        data: { imageUrl: PRIMARY_AVATAR_URL, isActive: true },
    })
  } else {
    await prisma.userAvatar.updateMany({ where: { userId: userIdToUse }, data: { isActive: false } })
    await prisma.userAvatar.create({
      data: { userId: userIdToUse, imageUrl: PRIMARY_AVATAR_URL || 'users/default-avatar.jpg', isActive: true },
    })
  }
  console.log('✅ Avatar set')

  // Create or get TARGET_USER
  let targetUser = await prisma.user.findUnique({ where: { id: TARGET_USER_ID } })
  if (!targetUser) {
    targetUser = (await prisma.user.findUnique({ where: { email: 'markettest@tipbox.co' } })) || null
  }
  if (!targetUser) {
    targetUser = await prisma.user.create({
      data: {
        id: TARGET_USER_ID,
        email: 'markettest@tipbox.co',
        passwordHash,
        emailVerified: true,
        status: 'ACTIVE',
      },
    })
  }
  await prisma.profile.upsert({
    where: { userId: targetUser.id },
    update: { displayName: 'Market Test User', userName: 'markettest' },
    create: { userId: targetUser.id, displayName: 'Market Test User', userName: 'markettest' },
  })
  console.log('✅ Target user created')

  // Trust users (5) and trust relations (test user trusts them)
  const trustUserIds: string[] = []
  for (let i = 0; i < 5; i++) {
    const trustUserId = TRUST_USER_IDS[i]
    const trustUserEmail = `trust-user-${i}@tipbox.co`
    let trustUser = await prisma.user.findUnique({ where: { id: trustUserId } })
    if (!trustUser) {
      trustUser = (await prisma.user.findUnique({ where: { email: trustUserEmail } })) || null
    }
    if (!trustUser) {
      trustUser = await prisma.user.create({
        data: { id: trustUserId, email: trustUserEmail, passwordHash, emailVerified: true, status: 'ACTIVE' },
      })
    }
    // Not: Seed kullanıcı ID'leri artık seed/index.ts'de otomatik olarak metadata'ya ekleniyor
    trustUserIds.push(trustUser.id)
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
      },
    })
    await prisma.trustRelation.create({ data: { trusterId: userIdToUse, trustedUserId: trustUser.id } }).catch(() => {})
  }
  console.log('✅ Trust users and relations created')

  // Truster users (3) and relations (they trust test user)
  for (let i = 0; i < 3; i++) {
    const trusterUserId = TRUSTER_USER_IDS[i]
    const trusterUserEmail = `truster-user-${i}@tipbox.co`
    let trusterUser = await prisma.user.findUnique({ where: { id: trusterUserId } })
    if (!trusterUser) {
      trusterUser = (await prisma.user.findUnique({ where: { email: trusterUserEmail } })) || null
    }
    if (!trusterUser) {
      trusterUser = await prisma.user.create({
        data: { id: trusterUserId, email: trusterUserEmail, passwordHash, emailVerified: true, status: 'ACTIVE' },
      })
    }
    // Not: Seed kullanıcı ID'leri artık seed/index.ts'de otomatik olarak metadata'ya ekleniyor
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
      },
    })
    await prisma.trustRelation.create({ data: { trusterId: trusterUser.id, trustedUserId: userIdToUse } }).catch(() => {})
  }
  console.log('✅ Truster users and relations created')

  await syncProfileTrustCounters()

  // User titles
  const titles = [
    { title: 'Technology Enthusiast' },
    { title: 'Hardware Expert' },
    { title: 'Digital Surfer' },
    { title: 'Early Tech Adopter' },
  ]
  for (const t of titles) {
    const exists = await prisma.userTitle.findFirst({ where: { userId: userIdToUse, title: t.title } })
    if (!exists) {
      await prisma.userTitle.create({ data: { userId: userIdToUse, title: t.title, earnedAt: new Date() } })
    }
  }
  console.log('✅ User titles set')

  // User badges (best-effort; requires badges to exist)
  const badgeNames = ['Welcome', 'First Post', 'Tip Master', 'Early Bird']
  for (const name of badgeNames) {
    const badge = await prisma.badge.findFirst({ where: { name } }).catch(() => null)
    if (badge) {
      await prisma.userBadge
        .upsert({
          where: { userId_badgeId: { userId: userIdToUse, badgeId: badge.id } },
          update: { claimed: true, claimedAt: new Date() },
          create: {
            userId: userIdToUse,
            badgeId: badge.id,
            isVisible: true,
            visibility: 'PUBLIC',
            claimed: true,
            claimedAt: new Date(),
          },
        })
        .catch(() => {})
    }
  }
  console.log('✅ User badges linked (if badges exist)')

  await prisma.profile.updateMany({
    where: { bannerUrl: null },
    data: { bannerUrl: DEFAULT_PROFILE_BANNER_URL },
  })

  // Create Julia Havk user
  const JULIA_USER_ID = '99999999-9999-4999-9999-999999999999'
  const juliaEmail = 'julia.havk@tipbox.co'
  
  let juliaUser = await prisma.user.findUnique({ where: { id: JULIA_USER_ID } })
  if (!juliaUser) {
    juliaUser = (await prisma.user.findUnique({ where: { email: juliaEmail } })) || null
  }
  
  if (!juliaUser) {
    // Upload avatar and banner to MinIO
    let juliaAvatarUrl = ''
    let juliaBannerUrl = ''
    
    try {
      const s3Service = new S3Service()
      await s3Service.checkAndCreateBucket()
      
      // Upload avatar (use useravatar.jpg from assets)
      const avatarPath = path.join(__dirname, '../../tests/assets/userprofile/useravatar.jpg')
      try {
        const avatarBuffer = readFileSync(avatarPath)
        const avatarObjectKey = `users/${JULIA_USER_ID}/avatar.jpg`
        juliaAvatarUrl = await s3Service.uploadFile(avatarObjectKey, avatarBuffer, 'image/jpeg')
        console.log(`✅ Julia avatar yüklendi: ${juliaAvatarUrl}`)
      } catch (error) {
        console.warn('⚠️ Avatar yüklenemedi, varsayılan kullanılıyor:', error)
        juliaAvatarUrl = getSeedMediaPath('user.avatar.primary') || 'users/default-avatar.jpg'
      }
      
      // Upload banner
      const bannerPath = path.join(__dirname, '../../tests/assets/userprofile/banner.png')
      try {
        const bannerBuffer = readFileSync(bannerPath)
        const bannerObjectKey = `users/${JULIA_USER_ID}/banner.png`
        juliaBannerUrl = await s3Service.uploadFile(bannerObjectKey, bannerBuffer, 'image/png')
        console.log(`✅ Julia banner yüklendi: ${juliaBannerUrl}`)
      } catch (error) {
        console.warn('⚠️ Banner yüklenemedi, varsayılan kullanılıyor:', error)
        juliaBannerUrl = DEFAULT_BANNER_URL
      }
    } catch (error) {
      console.warn('⚠️ MinIO bağlantı hatası, varsayılan görseller kullanılıyor:', error)
      juliaAvatarUrl = getSeedMediaPath('user.avatar.primary') || 'users/default-avatar.jpg'
      juliaBannerUrl = DEFAULT_BANNER_URL
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
        bannerUrl: juliaBannerUrl,
        country: 'United States',
      },
      create: {
        userId: juliaUser.id,
        displayName: 'Julia Havk',
        userName: 'juliahavk',
        bio: 'Tech enthusiast and lifestyle blogger. Passionate about discovering innovative products and sharing authentic experiences. Love exploring the latest gadgets and digital solutions.',
        bannerUrl: juliaBannerUrl,
        country: 'United States',
      },
    })
    console.log('✅ Julia Havk profile created')
    
    // Set avatar
    await prisma.userAvatar.updateMany({ where: { userId: juliaUser.id }, data: { isActive: false } })
    await prisma.userAvatar.create({
      data: {
        userId: juliaUser.id,
        imageUrl: juliaAvatarUrl,
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
    
    // Get existing products and categories
    const techCategory = await prisma.mainCategory.findFirst({ where: { name: 'Teknoloji' } })
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
      console.warn('⚠️ No products found, skipping post creation')
    } else {
      // 1. TIPS Post
      const tipsPostId = generateUlid()
      await prisma.contentPost.create({
        data: {
          id: tipsPostId,
          userId: juliaUser.id,
          type: 'TIPS',
          title: 'Maximizing Battery Life: Essential Tips for Modern Smartphones',
          body: 'After months of testing various smartphones, I\'ve discovered several key strategies to extend battery life significantly. First, always enable adaptive brightness and use dark mode when possible - this can save up to 30% battery on OLED screens. Second, disable background app refresh for apps you don\'t actively use. Third, keep your phone between 20-80% charge when possible rather than charging to 100% every time. Finally, use Wi-Fi instead of cellular data whenever available, as it consumes less power. These simple changes have extended my daily usage by 2-3 hours consistently.',
          productId: product1.id,
          mainCategoryId: techCategory?.id || null,
          subCategoryId: phoneSubCategory?.id || null,
          inventoryRequired: true,
          isBoosted: false,
        },
      }).catch((e) => console.warn('Tips post creation failed:', e))
      
      await prisma.postTip.create({
        data: { postId: tipsPostId, tipCategory: 'USAGE', isVerified: true },
      }).catch(() => {})
      
      await prisma.contentPostTag.createMany({
        data: [
          { postId: tipsPostId, tag: 'Battery Life' },
          { postId: tipsPostId, tag: 'Smartphone Tips' },
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
        const postImagePath = path.join(__dirname, '../../tests/assets/post/post.jpg')
        if (require('fs').existsSync(postImagePath)) {
          const postImageBuffer = readFileSync(postImagePath)
          const postImageKey = `posts/${juliaUser.id}/${tipsPostId}/image-0.jpg`
          // uploadFile() artık sadece path döndürür (tam URL değil)
          // DB'de sadece path tutulacak, response'larda resolveMediaUrl ile tam URL'ye çevrilecek
          const postMediaPath = await s3Service.uploadFile(postImageKey, postImageBuffer, 'image/jpeg')
          
          await prisma.postMedia.create({
            data: {
              postId: tipsPostId,
              userId: juliaUser.id,
              mediaUrl: postMediaPath,
              orderIndex: 0,
            },
          }).catch(() => {})
        }
      } catch (error) {
        console.warn('⚠️ Post media upload failed for tips post:', error)
      }
      
      // 2. TIPS Post - Camera Optimization
      const tipsPost2Id = generateUlid()
      await prisma.contentPost.create({
        data: {
          id: tipsPost2Id,
          userId: juliaUser.id,
          type: 'TIPS',
          title: 'Mastering Mobile Photography: Pro Tips for Stunning Photos',
          body: 'After years of mobile photography, I\'ve learned that lighting is everything. Always shoot during golden hour (sunrise/sunset) for the most flattering natural light. Use the grid feature to apply the rule of thirds - place your subject at intersection points for more dynamic compositions. For portraits, enable portrait mode and adjust the depth effect to create beautiful bokeh. Don\'t forget to clean your lens before shooting - a simple wipe can dramatically improve image quality. Finally, shoot in RAW format when possible for maximum editing flexibility. These techniques have transformed my mobile photography from good to professional-quality.',
          productId: product1.id,
          mainCategoryId: techCategory?.id || null,
          subCategoryId: phoneSubCategory?.id || null,
          inventoryRequired: true,
          isBoosted: false,
        },
      }).catch((e) => console.warn('Tips post 2 creation failed:', e))
      
      await prisma.postTip.create({
        data: { postId: tipsPost2Id, tipCategory: 'USAGE', isVerified: true },
      }).catch(() => {})
      
      await prisma.contentPostTag.createMany({
        data: [
          { postId: tipsPost2Id, tag: 'Photography' },
          { postId: tipsPost2Id, tag: 'Camera Tips' },
          { postId: tipsPost2Id, tag: 'Mobile Photography' },
        ],
        skipDuplicates: true,
      }).catch(() => {})
      
      // Add PostMedia for tips post 2
      try {
        const s3Service = new S3Service()
        const postImagePath = path.join(__dirname, '../../tests/assets/post/post.jpg')
        if (require('fs').existsSync(postImagePath)) {
          const postImageBuffer = readFileSync(postImagePath)
          const postImageKey = `posts/${juliaUser.id}/${tipsPost2Id}/image-0.jpg`
          const postMediaPath = await s3Service.uploadFile(postImageKey, postImageBuffer, 'image/jpeg')
          
          await prisma.postMedia.create({
            data: {
              postId: tipsPost2Id,
              userId: juliaUser.id,
              mediaUrl: postMediaPath,
              orderIndex: 0,
            },
          }).catch(() => {})
        }
      } catch (error) {
        console.warn('⚠️ Post media upload failed for tips post 2:', error)
      }
      
      // 3. TIPS Post - Storage Management
      const tipsPost3Id = generateUlid()
      await prisma.contentPost.create({
        data: {
          id: tipsPost3Id,
          userId: juliaUser.id,
          type: 'TIPS',
          title: 'Smart Storage Management: Keep Your Device Running Smoothly',
          body: 'Running out of storage is frustrating, but it\'s easily preventable. Start by enabling iCloud Photos or Google Photos backup - this automatically offloads your photos while keeping thumbnails accessible. Regularly clear app caches, especially for social media apps which can accumulate gigabytes of cached data. Use the built-in storage analyzer to identify large files and apps you no longer need. Delete old downloads, podcasts, and offline content regularly. For music lovers, consider streaming instead of downloading entire libraries. Finally, enable automatic app offloading for unused apps - they\'ll be removed but can be reinstalled instantly when needed. Following these practices, I\'ve maintained 30% free space consistently.',
          productId: product1.id,
          mainCategoryId: techCategory?.id || null,
          subCategoryId: phoneSubCategory?.id || null,
          inventoryRequired: true,
          isBoosted: false,
        },
      }).catch((e) => console.warn('Tips post 3 creation failed:', e))
      
      await prisma.postTip.create({
        data: { postId: tipsPost3Id, tipCategory: 'CARE', isVerified: true },
      }).catch(() => {})
      
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
        const postImagePath = path.join(__dirname, '../../tests/assets/post/post.jpg')
        if (require('fs').existsSync(postImagePath)) {
          const postImageBuffer = readFileSync(postImagePath)
          const postImageKey = `posts/${juliaUser.id}/${tipsPost3Id}/image-0.jpg`
          const postMediaPath = await s3Service.uploadFile(postImageKey, postImageBuffer, 'image/jpeg')
          
          await prisma.postMedia.create({
            data: {
              postId: tipsPost3Id,
              userId: juliaUser.id,
              mediaUrl: postMediaPath,
              orderIndex: 0,
            },
          }).catch(() => {})
        }
      } catch (error) {
        console.warn('⚠️ Post media upload failed for tips post 3:', error)
      }
      
      // 4. TIPS Post - Security & Privacy
      const tipsPost4Id = generateUlid()
      await prisma.contentPost.create({
        data: {
          id: tipsPost4Id,
          userId: juliaUser.id,
          type: 'TIPS',
          title: 'Essential Security Tips: Protect Your Digital Life',
          body: 'In today\'s digital world, security should be your top priority. Always enable two-factor authentication (2FA) on all important accounts - this single step prevents 99% of unauthorized access attempts. Use a password manager to generate and store unique, strong passwords for each account. Regularly review app permissions and revoke access for apps you no longer use. Enable Find My Device features and set up remote wipe capabilities. Be cautious with public Wi-Fi - use a VPN when accessing sensitive information. Finally, keep your device and apps updated - security patches are released regularly to fix vulnerabilities. These practices have kept my accounts secure for years without a single breach.',
          productId: product1.id,
          mainCategoryId: techCategory?.id || null,
          subCategoryId: phoneSubCategory?.id || null,
          inventoryRequired: true,
          isBoosted: false,
        },
      }).catch((e) => console.warn('Tips post 4 creation failed:', e))
      
      await prisma.postTip.create({
        data: { postId: tipsPost4Id, tipCategory: 'OTHER', isVerified: true },
      }).catch(() => {})
      
      await prisma.contentPostTag.createMany({
        data: [
          { postId: tipsPost4Id, tag: 'Security' },
          { postId: tipsPost4Id, tag: 'Privacy' },
          { postId: tipsPost4Id, tag: 'Digital Safety' },
        ],
        skipDuplicates: true,
      }).catch(() => {})
      
      // Add PostMedia for tips post 4
      try {
        const s3Service = new S3Service()
        const postImagePath = path.join(__dirname, '../../tests/assets/post/post.jpg')
        if (require('fs').existsSync(postImagePath)) {
          const postImageBuffer = readFileSync(postImagePath)
          const postImageKey = `posts/${juliaUser.id}/${tipsPost4Id}/image-0.jpg`
          const postMediaPath = await s3Service.uploadFile(postImageKey, postImageBuffer, 'image/jpeg')
          
          await prisma.postMedia.create({
            data: {
              postId: tipsPost4Id,
              userId: juliaUser.id,
              mediaUrl: postMediaPath,
              orderIndex: 0,
            },
          }).catch(() => {})
        }
      } catch (error) {
        console.warn('⚠️ Post media upload failed for tips post 4:', error)
      }
      
      // 5. TIPS Post - Performance Optimization
      const tipsPost5Id = generateUlid()
      await prisma.contentPost.create({
        data: {
          id: tipsPost5Id,
          userId: juliaUser.id,
          type: 'TIPS',
          title: 'Speed Up Your Device: Performance Optimization Guide',
          body: 'Is your device feeling sluggish? These optimization tips will bring back that snappy performance. First, restart your device weekly - this clears memory leaks and refreshes system processes. Disable unnecessary animations and transitions in accessibility settings for instant responsiveness. Clear Safari/Chrome browsing data regularly - accumulated cache can slow down web browsing significantly. Limit background app refresh to only essential apps. Close unused apps from the app switcher, but don\'t force-quit everything - the system manages memory efficiently. Finally, if performance issues persist, consider a factory reset after backing up your data - this often resolves deep-seated software issues. After applying these tips, my device feels as fast as the day I bought it.',
          productId: product1.id,
          mainCategoryId: techCategory?.id || null,
          subCategoryId: phoneSubCategory?.id || null,
          inventoryRequired: true,
          isBoosted: false,
        },
      }).catch((e) => console.warn('Tips post 5 creation failed:', e))
      
      await prisma.postTip.create({
        data: { postId: tipsPost5Id, tipCategory: 'USAGE', isVerified: true },
      }).catch(() => {})
      
      await prisma.contentPostTag.createMany({
        data: [
          { postId: tipsPost5Id, tag: 'Performance' },
          { postId: tipsPost5Id, tag: 'Optimization' },
          { postId: tipsPost5Id, tag: 'Speed' },
        ],
        skipDuplicates: true,
      }).catch(() => {})
      
      // Add PostMedia for tips post 5
      try {
        const s3Service = new S3Service()
        const postImagePath = path.join(__dirname, '../../tests/assets/post/post.jpg')
        if (require('fs').existsSync(postImagePath)) {
          const postImageBuffer = readFileSync(postImagePath)
          const postImageKey = `posts/${juliaUser.id}/${tipsPost5Id}/image-0.jpg`
          const postMediaPath = await s3Service.uploadFile(postImageKey, postImageBuffer, 'image/jpeg')
          
          await prisma.postMedia.create({
            data: {
              postId: tipsPost5Id,
              userId: juliaUser.id,
              mediaUrl: postMediaPath,
              orderIndex: 0,
            },
          }).catch(() => {})
        }
      } catch (error) {
        console.warn('⚠️ Post media upload failed for tips post 5:', error)
      }
      
      // 2. UPDATE Post
      const updatePostId = generateUlid()
      await prisma.contentPost.create({
        data: {
          id: updatePostId,
          userId: juliaUser.id,
          type: 'UPDATE',
          title: 'Latest Software Update: Performance Improvements and New Features',
          body: 'The recent software update has brought significant improvements to overall system performance. Apps launch 15% faster, and battery optimization algorithms have been refined. The new update also introduces enhanced privacy controls and improved camera processing algorithms. I\'ve noticed smoother animations and better thermal management during extended use. The update is available now and I highly recommend installing it for the best experience.',
          productId: product1.id,
          mainCategoryId: techCategory?.id || null,
          subCategoryId: phoneSubCategory?.id || null,
          inventoryRequired: true,
          isBoosted: true,
        },
      }).catch((e) => console.warn('Update post creation failed:', e))
      
      await prisma.contentPostTag.createMany({
        data: [
          { postId: updatePostId, tag: 'Software Update' },
          { postId: updatePostId, tag: 'Performance' },
          { postId: updatePostId, tag: 'News' },
        ],
        skipDuplicates: true,
      }).catch(() => {})
      
      // Add PostMedia for update post
      try {
        const s3Service = new S3Service()
        const postImagePath = path.join(__dirname, '../../tests/assets/post/post.jpg')
        const fs = require('fs')
        if (fs.existsSync(postImagePath)) {
          const postImageBuffer = readFileSync(postImagePath)
          const postImageKey = `posts/${juliaUser.id}/${updatePostId}/image-0.jpg`
          const postImageUrl = await s3Service.uploadFile(postImageKey, postImageBuffer, 'image/jpeg')
          
          await prisma.postMedia.create({
            data: {
              postId: updatePostId,
              userId: juliaUser.id,
              mediaUrl: postImageUrl,
              orderIndex: 0,
            },
          }).catch(() => {})
        }
      } catch (error) {
        console.warn('⚠️ Post media upload failed for update post:', error)
      }
      
      // 3. COMPARE Post (Benchmark)
      const comparePostId = generateUlid()
      if (product2 && product1.id !== product2.id) {
        await prisma.contentPost.create({
          data: {
            id: comparePostId,
            userId: juliaUser.id,
            type: 'COMPARE',
            title: 'Head-to-Head Comparison: Performance and Value Analysis',
            body: 'I\'ve spent the past month testing both products side by side to give you an honest comparison. In terms of performance, Product A excels in speed and responsiveness, while Product B offers better battery life and thermal management. For value, Product B provides more features at a lower price point, making it the better choice for budget-conscious users. However, if you prioritize premium build quality and cutting-edge features, Product A is worth the extra investment. Both are excellent choices depending on your priorities.',
            productId: product1.id,
            mainCategoryId: techCategory?.id || evYasamCategory?.id || null,
            subCategoryId: phoneSubCategory?.id || evYasamSubCategory?.id || null,
            inventoryRequired: false,
            isBoosted: true,
          },
        }).catch((e) => console.warn('Compare post creation failed:', e))
        
        const comparison = await prisma.postComparison.create({
          data: {
            postId: comparePostId,
            product1Id: product1.id,
            product2Id: product2.id,
            comparisonSummary: 'Comprehensive performance and value comparison between two leading products',
          },
        }).catch(() => null)
        
        if (comparison) {
          const priceMetric = await prisma.comparisonMetric.findFirst({ where: { name: 'Fiyat' } })
          const qualityMetric = await prisma.comparisonMetric.findFirst({ where: { name: 'Kalite' } })
          
          if (priceMetric) {
            await prisma.postComparisonScore.create({
              data: {
                comparisonId: comparison.id,
                metricId: priceMetric.id,
                scoreProduct1: 7,
                scoreProduct2: 9,
                comment: 'Product 2 offers better value for money',
              },
            }).catch(() => {})
          }
          if (qualityMetric) {
            await prisma.postComparisonScore.create({
              data: {
                comparisonId: comparison.id,
                metricId: qualityMetric.id,
                scoreProduct1: 9,
                scoreProduct2: 8,
                comment: 'Product 1 has superior build quality',
              },
            }).catch(() => {})
          }
        }
        
        await prisma.contentPostTag.createMany({
          data: [
            { postId: comparePostId, tag: 'Comparison' },
            { postId: comparePostId, tag: 'Benchmark' },
          ],
          skipDuplicates: true,
        }).catch(() => {})
      }
      
      // 4. EXPERIENCE Post
      const experiencePostId = generateUlid()
      await prisma.contentPost.create({
        data: {
          id: experiencePostId,
          userId: juliaUser.id,
          type: 'EXPERIENCE',
          title: 'My 6-Month Journey: Real-World Usage and Long-Term Impressions',
          body: 'After six months of daily use, I can confidently share my comprehensive experience. The initial setup was seamless, and the learning curve was minimal. Daily performance has been consistently excellent, with no major issues or slowdowns. The build quality has held up remarkably well despite regular use. Battery life remains strong, and I appreciate the attention to detail in the user interface. The only minor drawback is the occasional software hiccup, but these are rare and don\'t significantly impact the overall experience. I would definitely recommend this product to anyone looking for reliable, high-quality technology.',
          productId: product1.id,
          mainCategoryId: techCategory?.id || null,
          subCategoryId: phoneSubCategory?.id || null,
          inventoryRequired: true,
          isBoosted: false,
        },
      }).catch((e) => console.warn('Experience post creation failed:', e))
      
      await prisma.contentPostTag.createMany({
        data: [
          { postId: experiencePostId, tag: 'Long-Term Review' },
          { postId: experiencePostId, tag: 'Experience' },
          { postId: experiencePostId, tag: 'Real-World Usage' },
        ],
        skipDuplicates: true,
      }).catch(() => {})
      
      // Add PostMedia for experience post
      try {
        const s3Service = new S3Service()
        const postImagePath = path.join(__dirname, '../../tests/assets/post/post.jpg')
        const fs = require('fs')
        if (fs.existsSync(postImagePath)) {
          const postImageBuffer = readFileSync(postImagePath)
          const postImageKey = `posts/${juliaUser.id}/${experiencePostId}/image-0.jpg`
          const postImageUrl = await s3Service.uploadFile(postImageKey, postImageBuffer, 'image/jpeg')
          
          await prisma.postMedia.create({
            data: {
              postId: experiencePostId,
              userId: juliaUser.id,
              mediaUrl: postImageUrl,
              orderIndex: 0,
            },
          }).catch(() => {})
        }
      } catch (error) {
        console.warn('⚠️ Post media upload failed for experience post:', error)
      }
      
      // Create inventory for experience post if needed
      if (!tipsInventory) {
        await prisma.inventory.create({
          data: {
            userId: juliaUser.id,
            productId: product1.id,
            hasOwned: true,
            experienceSummary: 'Six months of daily usage experience',
          },
        }).catch(() => {})
      }
      
      // 5. QUESTION Post
      const questionPostId = generateUlid()
      await prisma.contentPost.create({
        data: {
          id: questionPostId,
          userId: juliaUser.id,
          type: 'QUESTION',
          title: 'What are the best accessories to enhance your experience?',
          body: 'I\'ve been using this product for a while now and I\'m curious about what accessories other users recommend. Are there any must-have add-ons that significantly improve functionality or convenience? I\'m particularly interested in protective cases, charging solutions, and any productivity-enhancing accessories. What has worked best for you in your experience?',
          productId: product1.id,
          mainCategoryId: techCategory?.id || null,
          subCategoryId: phoneSubCategory?.id || null,
          inventoryRequired: false,
          isBoosted: false,
        },
      }).catch((e) => console.warn('Question post creation failed:', e))
      
      await prisma.postQuestion.create({
        data: {
          postId: questionPostId,
          expectedAnswerFormat: 'LONG',
          relatedProductId: product1.id,
        },
      }).catch(() => {})
      
      await prisma.contentPostTag.createMany({
        data: [
          { postId: questionPostId, tag: 'Question' },
          { postId: questionPostId, tag: 'Accessories' },
          { postId: questionPostId, tag: 'Recommendations' },
        ],
        skipDuplicates: true,
      }).catch(() => {})
      
      console.log('✅ 5 TIPS posts created for Julia Havk')
    }
  }

  // Create 5 different types of posts for all other users
  const allUsersToCreatePosts = [
    { id: TEST_USER_ID, name: 'Ömer Faruk' },
    { id: TARGET_USER_ID, name: 'Market Test User' },
    ...TRUST_USER_IDS.map((id, i) => ({ id, name: `Trust User ${i + 1}` })),
    ...TRUSTER_USER_IDS.map((id, i) => ({ id, name: `Truster User ${i + 1}` })),
  ]

  console.log('📝 Creating 5 different types of posts for all users...')
  
  // Get categories and products for posts
  const techCategory = await prisma.mainCategory.findFirst({ where: { name: 'Teknoloji' } })
  const evYasamCategory = await prisma.mainCategory.findFirst({ where: { name: 'Ev & Yaşam' } })
  const phoneSubCategory = await prisma.subCategory.findFirst({ where: { name: 'Akıllı Telefonlar' } })
  const evYasamSubCategory = await prisma.subCategory.findFirst({ where: { name: 'Temizlik Ürünleri' } })
  
  const allProducts = await prisma.product.findMany({ take: 5 })
  if (allProducts.length === 0) {
    console.warn('⚠️ No products found, skipping post creation for other users')
  } else {
    for (const userInfo of allUsersToCreatePosts) {
      const user = await prisma.user.findUnique({ where: { id: userInfo.id } })
      if (!user) {
        console.warn(`⚠️ User ${userInfo.name} (${userInfo.id}) not found, skipping`)
        continue
      }

      const product1 = allProducts[0]
      const product2 = allProducts.length > 1 ? allProducts[1] : allProducts[0]
      const mainCategory = techCategory || evYasamCategory
      const subCategory = phoneSubCategory || evYasamSubCategory

      console.log(`📝 Creating posts for ${userInfo.name}...`)

      // Check if posts already exist for this user
      const existingPosts = await prisma.contentPost.findMany({
        where: { userId: user.id },
        take: 5,
      })

      if (existingPosts.length >= 5) {
        console.log(`✅ ${userInfo.name} already has ${existingPosts.length} posts, skipping`)
        continue
      }

      // 1. FREE Post
      const existingFreePost = await prisma.contentPost.findFirst({
        where: { userId: user.id, type: 'FREE' },
      })
      
      if (!existingFreePost) {
        const freePostId = generateUlid()
        await prisma.contentPost.create({
        data: {
          id: freePostId,
          userId: user.id,
          type: 'FREE',
          title: `${userInfo.name}'s Free Post: Product Insights and Thoughts`,
          body: `This is a free-form post about my experience with ${product1.name}. I've been using it for a while now and wanted to share my honest thoughts. The build quality is impressive, and the user interface is intuitive. There are some areas that could be improved, but overall it's a solid product that I would recommend to others.`,
          productId: product1.id,
          mainCategoryId: mainCategory?.id || null,
          subCategoryId: subCategory?.id || null,
          inventoryRequired: false,
          isBoosted: false,
        },
      }).catch((e) => console.warn(`Free post creation failed for ${userInfo.name}:`, e))

        await prisma.contentPostTag.createMany({
          data: [
            { postId: freePostId, tag: 'Review' },
            { postId: freePostId, tag: 'Experience' },
          ],
          skipDuplicates: true,
        }).catch(() => {})
      }

      // 2. TIPS Post
      const existingTipsPost = await prisma.contentPost.findFirst({
        where: { userId: user.id, type: 'TIPS' },
      })
      
      if (!existingTipsPost) {
        const tipsPostId = generateUlid()
        await prisma.contentPost.create({
        data: {
          id: tipsPostId,
          userId: user.id,
          type: 'TIPS',
          title: `Pro Tips: Getting the Most Out of ${product1.name}`,
          body: `After extensive use of ${product1.name}, I've discovered several tips that significantly enhance the experience. First, always keep the device updated to the latest software version for optimal performance. Second, customize the settings to match your usage patterns - this can improve battery life by up to 20%. Third, use the built-in optimization features regularly to maintain peak performance. These simple adjustments have made a huge difference in my daily usage.`,
          productId: product1.id,
          mainCategoryId: mainCategory?.id || null,
          subCategoryId: subCategory?.id || null,
          inventoryRequired: true,
          isBoosted: false,
        },
      }).catch((e) => console.warn(`Tips post creation failed for ${userInfo.name}:`, e))

        await prisma.postTip.create({
          data: { postId: tipsPostId, tipCategory: 'USAGE', isVerified: true },
        }).catch(() => {})

        await prisma.contentPostTag.createMany({
          data: [
            { postId: tipsPostId, tag: 'Tips' },
            { postId: tipsPostId, tag: 'Optimization' },
          ],
          skipDuplicates: true,
        }).catch(() => {})

        // Create inventory for tips post
        await prisma.inventory.create({
          data: {
            userId: user.id,
            productId: product1.id,
            hasOwned: true,
            experienceSummary: 'Long-term user with optimization experience',
          },
        }).catch(() => {})
      }

      // 3. QUESTION Post
      const existingQuestionPost = await prisma.contentPost.findFirst({
        where: { userId: user.id, type: 'QUESTION' },
      })
      
      if (!existingQuestionPost) {
        const questionPostId = generateUlid()
        await prisma.contentPost.create({
        data: {
          id: questionPostId,
          userId: user.id,
          type: 'QUESTION',
          title: `What are the best features of ${product1.name}?`,
          body: `I'm considering purchasing ${product1.name} and would love to hear from other users. What features do you find most valuable? Are there any hidden features or settings that enhance the experience? What would you recommend to someone new to this product?`,
          productId: product1.id,
          mainCategoryId: mainCategory?.id || null,
          subCategoryId: subCategory?.id || null,
          inventoryRequired: false,
          isBoosted: false,
        },
      }).catch((e) => console.warn(`Question post creation failed for ${userInfo.name}:`, e))

        await prisma.postQuestion.create({
          data: {
            postId: questionPostId,
            expectedAnswerFormat: 'LONG',
            relatedProductId: product1.id,
          },
        }).catch(() => {})

        await prisma.contentPostTag.createMany({
          data: [
            { postId: questionPostId, tag: 'Question' },
            { postId: questionPostId, tag: 'Help' },
          ],
          skipDuplicates: true,
        }).catch(() => {})
      }

      // 4. EXPERIENCE Post
      const existingExperiencePost = await prisma.contentPost.findFirst({
        where: { userId: user.id, type: 'EXPERIENCE' },
      })
      
      if (!existingExperiencePost) {
        const experiencePostId = generateUlid()
        await prisma.contentPost.create({
        data: {
          id: experiencePostId,
          userId: user.id,
          type: 'EXPERIENCE',
          title: `My Experience with ${product1.name}: Long-Term Review`,
          body: `I've been using ${product1.name} for several months now, and I wanted to share my comprehensive experience. The initial setup was straightforward, and the learning curve was minimal. Daily performance has been consistently reliable, with excellent build quality that has held up well over time. The user interface is intuitive, and I appreciate the attention to detail in the design. Battery life has remained strong, and the overall experience has been very positive. I would definitely recommend this product to others looking for quality and reliability.`,
          productId: product1.id,
          mainCategoryId: mainCategory?.id || null,
          subCategoryId: subCategory?.id || null,
          inventoryRequired: true,
          isBoosted: false,
        },
      }).catch((e) => console.warn(`Experience post creation failed for ${userInfo.name}:`, e))

        await prisma.contentPostTag.createMany({
          data: [
            { postId: experiencePostId, tag: 'Experience' },
            { postId: experiencePostId, tag: 'Long-Term Review' },
          ],
          skipDuplicates: true,
        }).catch(() => {})
      }

      // 5. COMPARE Post (if we have 2 products) or UPDATE Post
      const existingComparePost = await prisma.contentPost.findFirst({
        where: { userId: user.id, type: 'COMPARE' },
      })
      const existingUpdatePost = await prisma.contentPost.findFirst({
        where: { userId: user.id, type: 'UPDATE' },
      })
      
      if (!existingComparePost && !existingUpdatePost) {
        if (product2 && product1.id !== product2.id) {
          const comparePostId = generateUlid()
          await prisma.contentPost.create({
            data: {
              id: comparePostId,
              userId: user.id,
              type: 'COMPARE',
              title: `Comparison: ${product1.name} vs ${product2.name}`,
              body: `I've had the opportunity to test both ${product1.name} and ${product2.name} side by side. Here's my honest comparison: ${product1.name} excels in performance and build quality, while ${product2.name} offers better value and more features at a competitive price. Both are excellent choices depending on your priorities and budget.`,
              productId: product1.id,
              mainCategoryId: mainCategory?.id || null,
              subCategoryId: subCategory?.id || null,
              inventoryRequired: false,
              isBoosted: false,
            },
          }).catch((e) => console.warn(`Compare post creation failed for ${userInfo.name}:`, e))

          const comparison = await prisma.postComparison.create({
            data: {
              postId: comparePostId,
              product1Id: product1.id,
              product2Id: product2.id,
              comparisonSummary: `Detailed comparison between ${product1.name} and ${product2.name}`,
            },
          }).catch(() => null)

          if (comparison) {
            const priceMetric = await prisma.comparisonMetric.findFirst({ where: { name: 'Fiyat' } })
            const qualityMetric = await prisma.comparisonMetric.findFirst({ where: { name: 'Kalite' } })

            if (priceMetric) {
              await prisma.postComparisonScore.create({
                data: {
                  comparisonId: comparison.id,
                  metricId: priceMetric.id,
                  scoreProduct1: 8,
                  scoreProduct2: 7,
                  comment: 'Product 1 offers better value',
                },
              }).catch(() => {})
            }
            if (qualityMetric) {
              await prisma.postComparisonScore.create({
                data: {
                  comparisonId: comparison.id,
                  metricId: qualityMetric.id,
                  scoreProduct1: 9,
                  scoreProduct2: 8,
                  comment: 'Product 1 has superior quality',
                },
              }).catch(() => {})
            }
          }

          await prisma.contentPostTag.createMany({
            data: [
              { postId: comparePostId, tag: 'Comparison' },
              { postId: comparePostId, tag: 'Benchmark' },
            ],
            skipDuplicates: true,
          }).catch(() => {})
        } else {
          // UPDATE Post as fallback
          const updatePostId = generateUlid()
          await prisma.contentPost.create({
            data: {
              id: updatePostId,
              userId: user.id,
              type: 'UPDATE',
              title: `Latest Update: ${product1.name} Software Improvements`,
              body: `The recent software update for ${product1.name} has brought significant improvements. Performance is noticeably faster, battery optimization has been enhanced, and several new features have been added. The update is available now and I highly recommend installing it for the best experience.`,
              productId: product1.id,
              mainCategoryId: mainCategory?.id || null,
              subCategoryId: subCategory?.id || null,
              inventoryRequired: true,
              isBoosted: false,
            },
          }).catch((e) => console.warn(`Update post creation failed for ${userInfo.name}:`, e))

          await prisma.contentPostTag.createMany({
            data: [
              { postId: updatePostId, tag: 'Update' },
              { postId: updatePostId, tag: 'News' },
            ],
            skipDuplicates: true,
          }).catch(() => {})
        }
      }

      const finalPostCount = await prisma.contentPost.count({
        where: { userId: user.id },
      })
      console.log(`✅ Posts for ${userInfo.name}: ${finalPostCount} total`)
    }
  }

  console.log('🎉 User seeding completed')
}

// Eğer doğrudan çalıştırılıyorsa
if (require.main === module) {
  seedUsersAndProfiles()
    .catch((e) => {
      console.error('❌ User seed failed:', e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}

