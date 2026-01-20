import type { PrismaClient, BadgeRarity, BadgeType, AchievementDifficulty } from '@prisma/client'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { S3Service } from '../../../src/infrastructure/s3/s3.service'
import { getSeedMediaPath, type SeedMediaKey } from '../helpers/media.helper'
import { ensureEventBadgeSystem } from '../helpers/ensure-event-badge-system'
import { ensureMarketplaceBadges } from '../helpers/ensure-marketplace-badges'

export async function seedSystem(
  prisma: PrismaClient,
): Promise<{ defaultThemeId: string }> {
  // 1) User themes (createSeedUsers için gerekli)
  const themeConfigs = [
    { name: 'Light', description: 'Açık tema - günün her saati için ideal' },
    { name: 'Dark', description: 'Koyu tema - gözleri yormaz, modern görünüm' },
    { name: 'Auto', description: 'Otomatik - sistem temasını takip eder' },
  ]

  const themes = await Promise.all(
    themeConfigs.map(async (config) => {
      const existing = await prisma.userTheme.findFirst({ where: { name: config.name } })
      if (existing) return existing
      return prisma.userTheme.create({ data: config })
    }),
  )

  const defaultTheme = themes.find((t) => t.name === 'Dark') || themes[0]

  // 2) Badge categories (English set, ladder için)
  const badgeCategoryConfigs = [
    { name: 'Achievement', description: 'Achievement badges' },
    { name: 'Event', description: 'Event badges' },
    { name: 'Bridge', description: 'Bridge participation badges' },
    { name: 'Brand', description: 'Brand-related badges' },
    { name: 'Community', description: 'Community contribution badges' },
    { name: 'Special', description: 'Special edition badges' },
    { name: 'Cosmetic', description: 'Cosmetic / profile customization badges' },
  ]

  const badgeCategories = await Promise.all(
    badgeCategoryConfigs.map(async (config) => {
      const existing = await prisma.badgeCategory.findFirst({ where: { name: config.name } })
      if (existing) return existing
      return prisma.badgeCategory.create({ data: config })
    }),
  )

  const categoryByName = new Map(badgeCategories.map((c) => [c.name, c] as const))
  const getCategoryId = (name: string): string =>
    categoryByName.get(name)?.id || badgeCategories[0].id

  // 3) Achievement Ladder chain
  let ladderChain = await prisma.achievementChain.findFirst({
    where: { name: 'Achievement Ladder', category: 'Ladder' },
  })

  if (!ladderChain) {
    ladderChain = await prisma.achievementChain.create({
      data: {
        name: 'Achievement Ladder',
        description: 'Event dışı, sürekli devam eden hedefler',
        category: 'Ladder',
      },
    })
  }

  // 4) Ladder badges + goals (idempotent)
  const ladderBadgeBaseConfigs: Array<{
    baseName: string
    baseGoalTitle: string
    description: string
    type: BadgeType
    rarity: BadgeRarity
    categoryId: string
    goalType: 'POST' | 'INVENTORY' | 'LIKE_GIVEN' | 'LIKE_RECEIVED' | 'COMMENT'
    requirement: string
    pointsRequired: number
    difficulty: AchievementDifficulty
    imageKey: SeedMediaKey
  }> = [
    {
      baseName: 'Achievement Starter',
      baseGoalTitle: 'Publish Posts',
      description: 'Complete your first achievement milestone.',
      type: 'ACHIEVEMENT',
      rarity: 'COMMON',
      categoryId: getCategoryId('Achievement'),
      goalType: 'POST',
      requirement: 'Publish 10 posts.',
      pointsRequired: 10,
      difficulty: 'EASY',
      imageKey: 'badge.badge-1',
    },
    {
      baseName: 'Event Regular',
      baseGoalTitle: 'Participate in Events',
      description: 'Stay active during events and campaigns.',
      type: 'EVENT',
      rarity: 'COMMON',
      categoryId: getCategoryId('Event'),
      goalType: 'COMMENT',
      requirement: 'Leave 10 helpful comments.',
      pointsRequired: 10,
      difficulty: 'EASY',
      imageKey: 'badge.badge-2',
    },
    {
      baseName: 'Bridge Builder',
      baseGoalTitle: 'Support Others',
      description: 'Build bridges by engaging with the community.',
      type: 'ACHIEVEMENT',
      rarity: 'RARE',
      categoryId: getCategoryId('Bridge'),
      goalType: 'LIKE_GIVEN',
      requirement: 'Give 50 likes.',
      pointsRequired: 50,
      difficulty: 'MEDIUM',
      imageKey: 'badge.badge-3',
    },
    {
      baseName: 'Brand Advocate',
      baseGoalTitle: 'Build Your Collection',
      description: 'Explore brands and curate your inventory.',
      type: 'BRAND',
      rarity: 'RARE',
      categoryId: getCategoryId('Brand'),
      goalType: 'INVENTORY',
      requirement: 'Add 15 items to your inventory.',
      pointsRequired: 15,
      difficulty: 'MEDIUM',
      imageKey: 'badge.badge-4',
    },
    {
      baseName: 'Community Helper',
      baseGoalTitle: 'Engage with the Community',
      description: 'Be present and helpful in the community.',
      type: 'ACHIEVEMENT',
      rarity: 'COMMON',
      categoryId: getCategoryId('Community'),
      goalType: 'COMMENT',
      requirement: 'Write 15 comments.',
      pointsRequired: 15,
      difficulty: 'EASY',
      imageKey: 'badge.badge-5',
    },
    {
      baseName: 'Special Star',
      baseGoalTitle: 'Earn Recognition',
      description: 'A special badge for consistent engagement.',
      type: 'ACHIEVEMENT',
      rarity: 'EPIC',
      categoryId: getCategoryId('Special'),
      goalType: 'LIKE_RECEIVED',
      requirement: 'Receive 75 likes on your posts.',
      pointsRequired: 75,
      difficulty: 'HARD',
      imageKey: 'badge.badge-6',
    },
    {
      baseName: 'Cosmetic Collector',
      baseGoalTitle: 'Customize Your Profile',
      description: 'Collect cosmetic rewards through activity.',
      type: 'COSMETIC',
      rarity: 'COMMON',
      categoryId: getCategoryId('Cosmetic'),
      goalType: 'POST',
      requirement: 'Publish 5 posts.',
      pointsRequired: 5,
      difficulty: 'EASY',
      imageKey: 'badge.badge-7',
    },
  ]

  const ladderBadgeConfigs = ladderBadgeBaseConfigs.flatMap((cfg) => {
    const make = (n: 1 | 2) => ({
      name: `${cfg.baseName} ${n}`,
      description: cfg.description,
      type: cfg.type,
      rarity: cfg.rarity,
      categoryId: cfg.categoryId,
      goalType: cfg.goalType,
      requirement:
        n === 1
          ? cfg.requirement
          : cfg.requirement.replace(/\b(\d+)\b/g, (m) => String(Number(m) * 2)),
      pointsRequired: n === 1 ? cfg.pointsRequired : cfg.pointsRequired * 2,
      difficulty:
        n === 1
          ? cfg.difficulty
          : cfg.difficulty === 'EASY'
            ? 'MEDIUM'
            : 'HARD',
      goalTitle: `${cfg.baseGoalTitle} ${n}`,
      imageKey: cfg.imageKey,
    })
    return [make(1), make(2)]
  })

  for (const cfg of ladderBadgeConfigs) {
    const imageUrl = getSeedMediaPath(cfg.imageKey, true)

    const badge =
      (await prisma.badge.findFirst({ where: { name: cfg.name } })) ||
      (await prisma.badge.create({
        data: {
          name: cfg.name,
          description: cfg.description,
          type: cfg.type,
          rarity: cfg.rarity,
          categoryId: cfg.categoryId,
          imageUrl,
        },
      }))

    const existingGoal = await prisma.achievementGoal.findFirst({
      where: { chainId: ladderChain.id, title: cfg.goalTitle },
    })

    if (!existingGoal) {
      await prisma.achievementGoal.create({
        data: {
          chainId: ladderChain.id,
          title: cfg.goalTitle,
          requirement: cfg.requirement,
          goalType: cfg.goalType as any,
          rewardBadgeId: badge.id,
          pointsRequired: cfg.pointsRequired,
          difficulty: cfg.difficulty,
        },
      })
    } else {
      await prisma.achievementGoal.update({
        where: { id: existingGoal.id },
        data: {
          requirement: cfg.requirement,
          goalType: cfg.goalType as any,
          rewardBadgeId: badge.id,
          pointsRequired: cfg.pointsRequired,
          difficulty: cfg.difficulty,
        },
      })
    }
  }

  // 5) Comparison metrics
  const metricConfigs = [
    { name: 'Fiyat', description: 'Ürünün fiyat performansı (1-10)' },
    { name: 'Kalite', description: 'Ürünün genel kalitesi (1-10)' },
    { name: 'Kullanım Kolaylığı', description: 'Ürünün ne kadar kolay kullanıldığı (1-10)' },
    { name: 'Dayanıklılık', description: 'Ürünün ne kadar uzun süre dayandığı (1-10)' },
    { name: 'Tasarım', description: 'Ürünün görsel tasarımı ve estetik (1-10)' },
    { name: 'Müşteri Hizmetleri', description: 'Markanın müşteri hizmetleri kalitesi (1-10)' },
    { name: 'Özellikler', description: 'Ürünün sahip olduğu özellikler (1-10)' },
    { name: 'Çevre Dostu', description: 'Ürünün çevreye olan etkisi (1-10)' },
  ]

  for (const cfg of metricConfigs) {
    const existing = await prisma.comparisonMetric.findFirst({ where: { name: cfg.name } })
    if (!existing) {
      await prisma.comparisonMetric.create({ data: cfg })
    }
  }

  // 6) Boost options
  const boostOptionConfigs = [
    {
      title: 'Standard Boost',
      description: 'Standard visibility boost for your question posts.',
      amount: 0,
      isPopular: false,
      isActive: true,
    },
    {
      title: 'Popular Boost',
      description: 'Increases reach for questions that need quick answers.',
      amount: 10,
      isPopular: true,
      isActive: true,
    },
    {
      title: 'Premium Boost',
      description: 'Maximum visibility and priority in the feed.',
      amount: 25,
      isPopular: true,
      isActive: true,
    },
  ]

  for (const cfg of boostOptionConfigs) {
    const existing = await prisma.boostOption.findFirst({ where: { title: cfg.title } })
    if (!existing) {
      await prisma.boostOption.create({ data: cfg })
    }
  }

  // 7) Marketplace banners (simple, idempotent)
  {
    const s3 = new S3Service()
    const localImagePath = path.join(__dirname, '../../../tests/assets/marketplace/marketplace.jpg')
    const bannerKey = 'marketplace/banners/marketplace.jpg'

    if (existsSync(localImagePath)) {
      const exists = await s3.fileExists(bannerKey)
      if (!exists) {
        const buf = readFileSync(localImagePath)
        await s3.uploadFile(bannerKey, buf, 'image/jpeg')
      }
    }

    const now = new Date()
    const banners = [
      {
        title: 'Marketplace Highlights',
        description: 'Seçili NFT ve kozmetik koleksiyonları keşfet.',
        imageUrl: bannerKey,
        linkUrl: null as string | null,
        isActive: true,
        displayOrder: 1,
        startDate: now,
        endDate: null as Date | null,
      },
      {
        title: 'New Season Drops',
        description: 'Yeni rozetler ve koleksiyonlar yayında.',
        imageUrl: bannerKey,
        linkUrl: null as string | null,
        isActive: true,
        displayOrder: 2,
        startDate: now,
        endDate: null as Date | null,
      },
      {
        title: 'Limited Offers',
        description: 'Sınırlı süreli teklifleri kaçırma.',
        imageUrl: bannerKey,
        linkUrl: null as string | null,
        isActive: true,
        displayOrder: 3,
        startDate: now,
        endDate: null as Date | null,
      },
    ]

    for (const b of banners) {
      const existing = await prisma.marketplaceBanner.findFirst({
        where: { title: b.title },
      })
      if (!existing) {
        await prisma.marketplaceBanner.create({ data: b })
      }
    }
  }

  // 8) Event + Marketplace badge systems (idempotent)
  await ensureEventBadgeSystem(prisma as any)
  await ensureMarketplaceBadges(prisma as any)

  return { defaultThemeId: defaultTheme.id }
}

