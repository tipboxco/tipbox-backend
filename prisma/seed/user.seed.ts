import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { DEFAULT_PROFILE_BANNER_URL } from '../../src/domain/user/profile.constants'
import { getSeedMediaUrl } from './helpers/media.helper'

const prisma = new PrismaClient()
const DEFAULT_BANNER_URL = DEFAULT_PROFILE_BANNER_URL || getSeedMediaUrl('user.banner.primary')
const PRIMARY_AVATAR_URL = getSeedMediaUrl('user.avatar.primary')

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
      data: { userId: userIdToUse, imageUrl: PRIMARY_AVATAR_URL || 'https://cdn.tipbox.co/avatars/omer.jpg', isActive: true },
    })
  }
  console.log('✅ Avatar set')

  // Create or get TARGET_USER
  const TARGET_USER_ID = '248cc91f-b551-4ecc-a885-db1163571330'
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

