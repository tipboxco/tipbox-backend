import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SHOULD_WIPE = true
const DEFAULT_PASSWORD = 'password123'
const ASSET_BASE = '/tests/assets'

// Primary users (kept) + 3 extra (3M,2F total 5)
const TEST_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07'
const TARGET_USER_ID = '248cc91f-b551-4ecc-a885-db1163571330'
const EXTRA_USERS = [
  { id: '11111111-aaaa-4aaa-aaaa-111111111111', email: 'john.dawson@tipbox.co', gender: 'M', first: 'John', last: 'Dawson' },
  { id: '22222222-bbbb-4bbb-bbbb-222222222222', email: 'marcus.taylor@tipbox.co', gender: 'M', first: 'Marcus', last: 'Taylor' },
  { id: '33333333-cccc-4ccc-cccc-333333333333', email: 'liam.henderson@tipbox.co', gender: 'M', first: 'Liam', last: 'Henderson' },
  { id: '44444444-dddd-4ddd-dddd-444444444444', email: 'emma.rivers@tipbox.co', gender: 'F', first: 'Emma', last: 'Rivers' },
  { id: '55555555-eeee-4eee-eeee-555555555555', email: 'sophia.lee@tipbox.co', gender: 'F', first: 'Sophia', last: 'Lee' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const seedClock = (() => {
  const start = new Date()
  let offsetMinutes = 0
  return {
    next: (step = 1) => {
      offsetMinutes += step
      const jitterMs = Math.floor(Math.random() * 20) * 1000 // up to 20s jitter
      return new Date(start.getTime() + offsetMinutes * 60_000 + jitterMs)
    },
  }
})()

function longText(topic: string): string {
  const parts = [
    `This ${topic} walkthrough captures real usage in daily routines, travel packing, and desk setups with accessories.`,
    `It documents surprises, edge cases, and trade offs that appear only after weeks of testing instead of launch day hype.`,
    `Battery endurance, ergonomics, accessory fit, and support experiences are spelled out with measurable expectations.`,
    `There are maintenance and cleaning tips plus workflow tweaks that keep the item reliable over time.`,
    `The goal is to mimic authentic user language so feed pagination and recency sorting feel realistic during QA.`,
  ]
  return parts.join(' ')
}

async function wipeDatabase() {
  if (!SHOULD_WIPE) return
  const tables = [
    'ContentPostTag',
    'ContentPostView',
    'ContentFavorite',
    'ContentLike',
    'ContentComment',
    'PostComparisonScore',
    'PostComparison',
    'PostTip',
    'PostQuestion',
    'ProductExperience',
    'InventoryMedia',
    'Inventory',
    'Product',
    'ProductGroup',
    'SubCategory',
    'MainCategory',
    'Brand',
    'Badge',
    'BadgeCategory',
    'AchievementGoal',
    'AchievementChain',
    'UserBadge',
    'UserTitle',
    'UserAvatar',
    'Profile',
    'User',
    'ComparisonMetric',
    'MarketplaceBanner',
    'TrendingPost',
    'WishboxStats',
    'WishboxScenarioChoice',
    'WishboxScenario',
    'WishboxEvent',
    'NFTMarketListing',
    'NFTAttribute',
    'NFTTransaction',
    'NFT',
    'DMMessage',
    'DMThread',
    'DMRequest',
    'ExpertAnswer',
    'ExpertRequest',
    'TrustRelation',
    'UserTheme',
  ]
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`).catch(() => {})
  }
}

async function ensureUserThemes() {
  const themes = ['Light', 'Dark', 'Auto']
  const created = []
  for (const name of themes) {
    const rec = await prisma.userTheme.upsert({
      where: { name },
      update: {},
      create: { name, description: `${name} theme for all-day use` },
    })
    created.push(rec)
  }
  return created
}

async function ensureComparisonMetrics() {
  const metrics = [
    { name: 'Price', description: 'Cost efficiency (1-10)' },
    { name: 'Quality', description: 'Build and materials (1-10)' },
    { name: 'Ease of Use', description: 'Learning curve and ergonomics (1-10)' },
    { name: 'Durability', description: 'Long term reliability (1-10)' },
    { name: 'Design', description: 'Look and feel (1-10)' },
    { name: 'Customer Support', description: 'Support experience (1-10)' },
    { name: 'Features', description: 'Feature richness (1-10)' },
    { name: 'Eco Friendly', description: 'Environmental impact (1-10)' },
  ]
  const created = []
  for (const m of metrics) {
    const rec = await prisma.comparisonMetric.upsert({
      where: { name: m.name },
      update: { description: m.description },
      create: m,
    })
    created.push(rec)
  }
  return created
}

async function ensureBadgeCategoriesAndBadges() {
  const categories = ['Achievement', 'Event', 'Cosmetic', 'Community']
  const catMap: Record<string, any> = {}
  for (const name of categories) {
    catMap[name] = await prisma.badgeCategory.upsert({
      where: { name },
      update: {},
      create: { name, description: `${name} badges` },
    })
  }
  const badgeDefs = [
    { name: 'Welcome', type: 'ACHIEVEMENT', rarity: 'COMMON', category: 'Achievement' },
    { name: 'First Post', type: 'ACHIEVEMENT', rarity: 'COMMON', category: 'Achievement' },
    { name: 'Tip Master', type: 'ACHIEVEMENT', rarity: 'RARE', category: 'Achievement' },
    { name: 'Community Hero', type: 'ACHIEVEMENT', rarity: 'EPIC', category: 'Community' },
    { name: 'Early Bird', type: 'EVENT', rarity: 'RARE', category: 'Event' },
    { name: 'Beta Tester', type: 'EVENT', rarity: 'EPIC', category: 'Event' },
  ]
  const badges = []
  for (const b of badgeDefs) {
    const rec = await prisma.badge.upsert({
      where: { name: b.name },
      update: { type: b.type, rarity: b.rarity, categoryId: catMap[b.category].id },
      create: {
        name: b.name,
        description: `${b.name} badge`,
        type: b.type as any,
        rarity: b.rarity as any,
        categoryId: catMap[b.category].id,
        imageUrl: `${ASSET_BASE}/badge/${b.name.toLowerCase().replace(/ /g, '-')}.png`,
        boostMultiplier: 1,
        rewardMultiplier: 1,
      },
    })
    badges.push(rec)
  }
  return { categories: catMap, badges }
}

async function ensureUsers(passwordHash: string, badges: any[]) {
  const baseUsers = [
    { id: TEST_USER_ID, email: 'primary@tipbox.co', first: 'Ethan', last: 'Cole', gender: 'M' },
    { id: TARGET_USER_ID, email: 'markettest@tipbox.co', first: 'Mia', last: 'Patel', gender: 'F' },
    ...EXTRA_USERS,
  ]
  const created = []
  for (const u of baseUsers) {
    const user = await prisma.user.upsert({
      where: { id: u.id },
      update: { email: u.email, passwordHash, status: 'ACTIVE', emailVerified: true },
      create: {
        id: u.id,
        email: u.email,
        passwordHash,
        status: 'ACTIVE',
        emailVerified: true,
      },
    })
    const displayName = `${u.first} ${u.last}`
    const userName = `${u.first.toLowerCase()}${u.last.toLowerCase()}`
    await prisma.profile.upsert({
      where: { userId: u.id },
      update: {
        displayName,
        userName,
        bio: `${displayName} shares detailed product notes and benchmarks for real-world scenarios.`,
        bannerUrl: `${ASSET_BASE}/userprofile/banner-${u.gender.toLowerCase()}.jpg`,
        country: 'United States',
        unseenFeedCount: 0,
      },
      create: {
        userId: u.id,
        displayName,
        userName,
        bio: `${displayName} shares detailed product notes and benchmarks for real-world scenarios.`,
        bannerUrl: `${ASSET_BASE}/userprofile/banner-${u.gender.toLowerCase()}.jpg`,
        country: 'United States',
      },
    })
    await prisma.userAvatar.upsert({
      where: { userId: u.id },
      update: { imageUrl: `${ASSET_BASE}/userprofile/avatar-${u.gender.toLowerCase()}.png`, isActive: true },
      create: {
        userId: u.id,
        imageUrl: `${ASSET_BASE}/userprofile/avatar-${u.gender.toLowerCase()}.png`,
        isActive: true,
      },
    })
    const titles = ['Tech Explorer', 'Hands-on Reviewer']
    for (const t of titles) {
      await prisma.userTitle.upsert({
        where: { userId_title: { userId: u.id, title: t } },
        update: { earnedAt: seedClock.next() },
        create: { userId: u.id, title: t, earnedAt: seedClock.next() },
      })
    }
    const welcome = badges.find((b) => b.name === 'Welcome')
    if (welcome) {
      await prisma.userBadge.upsert({
        where: { userId_badgeId: { userId: u.id, badgeId: welcome.id } },
        update: { claimed: true, claimedAt: seedClock.next() },
        create: {
          userId: u.id,
          badgeId: welcome.id,
          claimed: true,
          claimedAt: seedClock.next(),
          isVisible: true,
          visibility: 'PUBLIC',
        },
      })
    }
    created.push(user)
  }
  const trustPairs = [
    { trusterId: TEST_USER_ID, trustedUserId: TARGET_USER_ID },
    { trusterId: TEST_USER_ID, trustedUserId: EXTRA_USERS[0].id },
    { trusterId: EXTRA_USERS[1].id, trustedUserId: TEST_USER_ID },
    { trusterId: EXTRA_USERS[2].id, trustedUserId: TARGET_USER_ID },
    { trusterId: EXTRA_USERS[3].id, trustedUserId: EXTRA_USERS[4].id },
  ]
  for (const pair of trustPairs) {
    await prisma.trustRelation.upsert({
      where: {
        trusterId_trustedUserId: {
          trusterId: pair.trusterId,
          trustedUserId: pair.trustedUserId,
        },
      },
      update: {},
      create: pair,
    })
  }
  return created
}

function categorySeeds() {
  const categories = [
    'Technology',
    'Home & Living',
    'Health & Fitness',
    'Kitchen',
    'Fashion',
    'Beauty',
    'Outdoors',
    'Automotive',
    'Gaming',
    'Audio',
  ]
  return categories.map((name, idx) => ({
    name,
    description: `${name} catalog category`,
    imageUrl: `${ASSET_BASE}/catalog/category-${(idx % 4) + 1}.png`,
  }))
}

async function buildCatalog() {
  const cats = []
  for (const cfg of categorySeeds()) {
    const cat = await prisma.mainCategory.upsert({
      where: { name: cfg.name },
      update: { description: cfg.description, imageUrl: cfg.imageUrl },
      create: cfg,
    })
    cats.push(cat)
  }
  const subcats = []
  for (const cat of cats) {
    const subCount = cat.name === 'Technology' || cat.name === 'Home & Living' ? 3 : 1
    for (let i = 0; i < subCount; i++) {
      const sub = await prisma.subCategory.upsert({
        where: { name_mainCategoryId: { name: `${cat.name} Sub ${i + 1}`, mainCategoryId: cat.id } },
        update: { description: `${cat.name} subcategory ${i + 1}`, imageUrl: `${ASSET_BASE}/catalog/sub-${(i % 3) + 1}.png` },
        create: {
          name: `${cat.name} Sub ${i + 1}`,
          description: `${cat.name} subcategory ${i + 1}`,
          imageUrl: `${ASSET_BASE}/catalog/sub-${(i % 3) + 1}.png`,
          mainCategoryId: cat.id,
        },
      })
      subcats.push(sub)
    }
  }
  const brands = []
  const productGroups = []
  const products = []
  for (const cat of cats) {
    const isDenseCategory = ['Technology', 'Home & Living'].includes(cat.name)
    const brandCount = isDenseCategory ? 12 : 4
    for (let b = 0; b < brandCount; b++) {
      const brand = await prisma.brand.upsert({
        where: { name: `${cat.name} Brand ${b + 1}` },
        update: { description: `${cat.name} brand ${b + 1}`, logoUrl: `${ASSET_BASE}/brandbadge/brand-${(b % 4) + 1}.png` },
        create: {
          name: `${cat.name} Brand ${b + 1}`,
          description: `${cat.name} brand ${b + 1}`,
          logoUrl: `${ASSET_BASE}/brandbadge/brand-${(b % 4) + 1}.png`,
          category: cat.name,
        },
      })
      brands.push(brand)
      const denseBrand = isDenseCategory && b < 2
      const groupCount = denseBrand ? 12 : 4
      const subForBrand = subcats.find((s) => s.mainCategoryId === cat.id) || subcats[0]
      for (let g = 0; g < groupCount; g++) {
        const group = await prisma.productGroup.upsert({
          where: { name_subCategoryId: { name: `${brand.name} Group ${g + 1}`, subCategoryId: subForBrand.id } },
          update: { description: `${brand.name} product group ${g + 1}`, imageUrl: `${ASSET_BASE}/catalog/group-${(g % 3) + 1}.png` },
          create: {
            name: `${brand.name} Group ${g + 1}`,
            description: `${brand.name} product group ${g + 1}`,
            subCategoryId: subForBrand.id,
            imageUrl: `${ASSET_BASE}/catalog/group-${(g % 3) + 1}.png`,
          },
        })
        productGroups.push(group)
        const denseGroup = denseBrand && g < 2
        const productCount = denseGroup ? 20 : 4
        for (let p = 0; p < productCount; p++) {
          const prod = await prisma.product.create({
            data: {
              id: randomUUID(),
              name: `${brand.name} Product ${g + 1}-${p + 1}`,
              brand: brand.name,
              description: longText('product'),
              groupId: group.id,
              imageUrl: `${ASSET_BASE}/product/phone${((p % 6) + 1)}.png`,
              createdAt: seedClock.next(),
            },
          }).catch(async () => {
            return prisma.product.findFirst({
              where: { name: `${brand.name} Product ${g + 1}-${p + 1}`, groupId: group.id },
            })
          })
          if (prod) products.push(prod)
        }
      }
    }
  }
  return { categories: cats, subcategories: subcats, brands, productGroups, products }
}

type ContentSeed = {
  type: 'FREE' | 'EXPERIENCE' | 'COMPARE' | 'TIPS' | 'QUESTION' | 'UPDATE'
  userId: string
  mainCategoryId: string
  subCategoryId: string
  productGroupId?: string | null
  productId?: string | null
  title: string
  body: string
  isBoosted?: boolean
  inventoryRequired?: boolean
}

async function seedContentForUsers(users: any[], products: any[], productGroups: any[], categories: any[], subcategories: any[], metrics: any[]) {
  const seeds: ContentSeed[] = []
  const primary = users[0]
  const fallbackProduct = products[0]
  const techCat = categories.find((c) => c.name === 'Technology') || categories[0]
  const techSub = subcategories.find((s) => s.mainCategoryId === techCat.id) || subcategories[0]
  const primaryGroup = productGroups.find((g) => g.subCategoryId === techSub.id) || productGroups[0]

  const baseTypes: ContentSeed['type'][] = ['FREE', 'EXPERIENCE', 'COMPARE', 'TIPS', 'QUESTION', 'UPDATE']
  const makeBody = (topic: string) => longText(topic)

  for (let i = 0; i < 12; i++) {
    const t = baseTypes[i % baseTypes.length]
    seeds.push({
      type: t,
      userId: primary.id,
      mainCategoryId: techCat.id,
      subCategoryId: techSub.id,
      productGroupId: primaryGroup?.id,
      productId: products[i % products.length]?.id || fallbackProduct.id,
      title: `${t} note ${i + 1}`,
      body: makeBody('content post'),
      isBoosted: i % 5 === 0,
      inventoryRequired: t === 'EXPERIENCE',
    })
  }

  for (const u of users.slice(1)) {
    const count = 5
    for (let i = 0; i < count; i++) {
      const t = baseTypes[(i + 1) % baseTypes.length]
      const cat = categories[(i + 1) % categories.length]
      const sub = subcategories.find((s) => s.mainCategoryId === cat.id) || techSub
      const pg = productGroups.find((g) => g.subCategoryId === sub.id) || primaryGroup
      seeds.push({
        type: t,
        userId: u.id,
        mainCategoryId: cat.id,
        subCategoryId: sub.id,
        productGroupId: pg?.id,
        productId: products[(i + 3) % products.length]?.id || fallbackProduct.id,
        title: `${t} insight ${i + 1}`,
        body: makeBody('user post'),
        isBoosted: i === 0,
        inventoryRequired: t === 'EXPERIENCE',
      })
    }
  }

  const contentIds: string[] = []
  for (const seed of seeds) {
    const id = randomUUID()
    await prisma.contentPost.create({
      data: {
        id,
        userId: seed.userId,
        type: seed.type,
        title: seed.title,
        body: seed.body,
        mainCategoryId: seed.mainCategoryId,
        subCategoryId: seed.subCategoryId,
        productGroupId: seed.productGroupId,
        productId: seed.productId,
        inventoryRequired: seed.inventoryRequired ?? false,
        isBoosted: seed.isBoosted ?? false,
        createdAt: seedClock.next(),
      },
    })
    contentIds.push(id)
    await prisma.contentPostTag.createMany({
      data: [
        { postId: id, tag: 'testing' },
        { postId: id, tag: 'seed' },
      ],
      skipDuplicates: true,
    })
    if (seed.type === 'TIPS') {
      await prisma.postTip.create({
        data: { postId: id, tipCategory: 'USAGE', isVerified: true },
      })
    }
    if (seed.type === 'QUESTION') {
      await prisma.postQuestion.create({
        data: { postId: id, expectedAnswerFormat: 'LONG', relatedProductId: seed.productId },
      })
    }
    if (seed.type === 'COMPARE') {
      const p1 = seed.productId
      const p2 = products[(contentIds.length + 2) % products.length]?.id || fallbackProduct.id
      const cmp = await prisma.postComparison.create({
        data: {
          postId: id,
          product1Id: p1,
          product2Id: p2,
          comparisonSummary: 'Side by side notes focused on handling and value.',
        },
      })
      const metricA = metrics[0]
      const metricB = metrics[1]
      await prisma.postComparisonScore.create({
        data: {
          comparisonId: cmp.id,
          metricId: metricA.id,
          scoreProduct1: 7,
          scoreProduct2: 8,
          comment: 'Balanced pricing difference',
        },
      })
      await prisma.postComparisonScore.create({
        data: {
          comparisonId: cmp.id,
          metricId: metricB.id,
          scoreProduct1: 8,
          scoreProduct2: 7,
          comment: 'Quality favors the first pick',
        },
      })
    }
  }

  for (const postId of contentIds.slice(0, 10)) {
    await prisma.contentLike.create({ data: { postId, userId: primary.id } }).catch(() => {})
    await prisma.contentPost.update({ where: { id: postId }, data: { likesCount: { increment: 1 } } }).catch(() => {})
    await prisma.contentFavorite.create({ data: { postId, userId: primary.id } }).catch(() => {})
    await prisma.contentPost.update({ where: { id: postId }, data: { favoritesCount: { increment: 1 } } }).catch(() => {})
    await prisma.contentPostView.create({ data: { postId, userId: primary.id, viewerIp: '127.0.0.1' } }).catch(() => {})
    await prisma.contentPost.update({ where: { id: postId }, data: { viewsCount: { increment: 1 } } }).catch(() => {})
  }

  for (const postId of contentIds.slice(0, 4)) {
    await prisma.contentFavorite.create({ data: { userId: primary.id, postId } }).catch(() => {})
  }

  return contentIds
}

async function seedQuestionsReplies(contentIds: string[], users: any[]) {
  const questions = await prisma.contentPost.findMany({ where: { id: { in: contentIds }, type: 'QUESTION' } })
  for (const q of questions.slice(0, 4)) {
    await prisma.contentComment.create({
      data: {
        id: randomUUID(),
        postId: q.id,
        userId: users[1].id,
        comment: 'Here is a thorough answer based on weeks of usage with accessories and firmware updates considered.',
        isAnswer: true,
        createdAt: seedClock.next(),
      },
    })
    await prisma.contentPost.update({ where: { id: q.id }, data: { commentsCount: { increment: 1 } } })
  }
}

async function seedDMAndSupport(users: any[]) {
  const [u1, u2, u3] = users
  const threads = [
    {
      userOneId: u1.id,
      userTwoId: u2.id,
      isSupportThread: false,
      messages: [
        { senderId: u1.id, text: 'Hey, did you check the latest benchmark draft?', minutesAgo: 25 },
        { senderId: u2.id, text: 'Yes, scores look realistic. Add thermal notes.', minutesAgo: 20 },
      ],
    },
    {
      userOneId: u1.id,
      userTwoId: u3.id,
      isSupportThread: true,
      messages: [
        { senderId: u3.id, text: 'I need a quick setup guide for the new smartwatch.', minutesAgo: 40 },
        { senderId: u1.id, text: 'Sure, check the tips section and enable dual band GPS.', minutesAgo: 35 },
      ],
    },
  ]
  for (const t of threads) {
    const thread = await prisma.dMThread.create({
      data: {
        userOneId: t.userOneId,
        userTwoId: t.userTwoId,
        isSupportThread: t.isSupportThread as any,
        isActive: true,
        startedAt: seedClock.next(),
        createdAt: seedClock.next(),
        updatedAt: seedClock.next(),
        unreadCountUserOne: 0,
        unreadCountUserTwo: 0,
      },
    })
    for (const m of t.messages) {
      await prisma.dMMessage.create({
        data: {
          threadId: thread.id,
          senderId: m.senderId,
          message: m.text,
          isRead: true,
          context: t.isSupportThread ? 'SUPPORT' : 'DM',
          sentAt: seedClock.next(),
        },
      })
    }
  }

  const supportSeeds = [
    {
      id: randomUUID(),
      fromUserId: users[4].id,
      toUserId: users[0].id,
      description: 'Looking for guidance on tuning ANC profiles for commuting and office hours.',
      status: 'ACCEPTED',
      type: 'PRODUCT',
      amount: 60,
    },
    {
      id: randomUUID(),
      fromUserId: users[1].id,
      toUserId: users[0].id,
      description: 'Need a checklist to prepare benchmark scenes consistently.',
      status: 'PENDING',
      type: 'GENERAL',
      amount: 30,
    },
  ]
  for (const s of supportSeeds) {
    const thread = s.status === 'ACCEPTED'
      ? await prisma.dMThread.create({
          data: {
            userOneId: s.fromUserId,
            userTwoId: s.toUserId,
            isSupportThread: true as any,
            isActive: true,
            startedAt: seedClock.next(),
            createdAt: seedClock.next(),
            updatedAt: seedClock.next(),
          },
        })
      : null
    await prisma.dMRequest.create({
      data: {
        id: s.id,
        fromUserId: s.fromUserId,
        toUserId: s.toUserId,
        description: s.description,
        status: s.status as any,
        type: s.type as any,
        amount: s.amount,
        threadId: thread?.id ?? null,
        sentAt: seedClock.next(),
        respondedAt: s.status === 'PENDING' ? null : seedClock.next(),
        createdAt: seedClock.next(),
        updatedAt: seedClock.next(),
      },
    })
    if (thread) {
      await prisma.dMMessage.createMany({
        data: [
          {
            threadId: thread.id,
            senderId: s.fromUserId,
            message: s.description,
            isRead: true,
            context: 'SUPPORT',
            sentAt: seedClock.next(),
          },
          {
            threadId: thread.id,
            senderId: s.toUserId,
            message: 'I can help. Share your current setup and I will respond with steps.',
            isRead: true,
            context: 'SUPPORT',
            sentAt: seedClock.next(),
          },
        ],
      })
    }
  }
}

async function seedNFTsAndMarketplace(users: any[]) {
  const owner = users[1]
  const listingOwner = users[0]
  const nftDefs = [
    { name: 'Aurora Badge', rarity: 'EPIC', type: 'BADGE', owner: owner.id },
    { name: 'Pulse Frame', rarity: 'RARE', type: 'COSMETIC', owner: owner.id },
    { name: 'Holo Box', rarity: 'EPIC', type: 'LOOTBOX', owner: null },
    { name: 'Skyline Badge', rarity: 'COMMON', type: 'BADGE', owner: listingOwner.id },
  ]
  const nfts = []
  for (const d of nftDefs) {
    const nft = await prisma.nFT.create({
      data: {
        name: d.name,
        description: longText('nft'),
        imageUrl: `${ASSET_BASE}/marketplace/${d.name.toLowerCase().replace(/ /g, '-')}.png`,
        type: d.type as any,
        rarity: d.rarity as any,
        isTransferable: true,
        currentOwnerId: d.owner,
      } as any,
    })
    nfts.push(nft)
    await prisma.nFTTransaction.create({
      data: {
        nftId: nft.id,
        fromUserId: null,
        toUserId: d.owner,
        transactionType: 'MINT',
        price: null,
        createdAt: seedClock.next(),
      },
    })
  }
  for (const nft of nfts.slice(2)) {
    await prisma.nFTMarketListing.create({
      data: {
        nftId: nft.id,
        listedByUserId: listingOwner.id,
        price: 120 + Math.random() * 200,
        status: 'ACTIVE',
        createdAt: seedClock.next(),
      },
    })
  }
}

async function seedExploreAndEvents(posts: string[]) {
  const banners = [
    { title: 'Fresh Drops', description: 'New collectibles with verified creators', linkUrl: '/marketplace/listings', img: `${ASSET_BASE}/marketplace/banner1.png`, order: 1 },
    { title: 'Creator Spotlight', description: 'Hand-picked frames for profile upgrades', linkUrl: '/marketplace/listings?type=COSMETIC', img: `${ASSET_BASE}/marketplace/banner2.png`, order: 2 },
    { title: 'Badge Week', description: 'Rare badges at friendly prices', linkUrl: '/marketplace/listings?type=BADGE', img: `${ASSET_BASE}/marketplace/banner3.png`, order: 3 },
  ]
  for (const b of banners) {
    await prisma.marketplaceBanner.create({
      data: {
        title: b.title,
        description: b.description,
        imageUrl: b.img,
        linkUrl: b.linkUrl,
        isActive: true,
        displayOrder: b.order,
        createdAt: seedClock.next(),
      },
    })
  }
  for (let i = 0; i < Math.min(5, posts.length); i++) {
    await prisma.trendingPost.create({
      data: {
        id: randomUUID(),
        postId: posts[i],
        score: 95 - i * 5,
        trendPeriod: 'DAILY',
        calculatedAt: seedClock.next(),
      },
    }).catch(() => {})
  }
  const event = await prisma.wishboxEvent.create({
    data: {
      id: randomUUID(),
      title: 'Community Choice Awards',
      description: longText('event'),
      startDate: seedClock.next(),
      endDate: seedClock.next(),
      status: 'PUBLISHED',
    },
  })
  const scenario = await prisma.wishboxScenario.create({
    data: {
      eventId: event.id,
      title: 'Best Daily Driver Phone',
      description: 'Vote for balanced performance and reliability.',
      orderIndex: 1,
    },
  })
  await prisma.wishboxStats.create({
    data: {
      userId: EXTRA_USERS[0].id,
      eventId: event.id,
      totalParticipated: 3,
      totalComments: 4,
      helpfulVotesReceived: 6,
    },
  })
  await prisma.wishboxScenarioChoice.create({
    data: {
      scenarioId: scenario.id,
      choice: 'Flagship',
      votes: 12,
    },
  }).catch(() => {})
}

async function main() {
  console.log('🌱 Starting seed process (compact English, 5 users)...')
  if (SHOULD_WIPE) {
    console.log('🧹 Wiping existing data...')
    await wipeDatabase()
  }

  console.log('🔐 Hashing password...')
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)

  console.log('🎨 User themes...')
  const themes = await ensureUserThemes()

  console.log('🏆 Badges...')
  const { badges } = await ensureBadgeCategoriesAndBadges()

  console.log('📊 Metrics...')
  const metrics = await ensureComparisonMetrics()

  console.log('👤 Users...')
  const users = await ensureUsers(passwordHash, badges)

  console.log('🗂 Catalog...')
  const { categories, subcategories, productGroups, products } = await buildCatalog()

  console.log('📝 Content...')
  const contentIds = await seedContentForUsers(users, products, productGroups, categories, subcategories, metrics)

  console.log('💬 Q&A...')
  await seedQuestionsReplies(contentIds, users)

  console.log('📨 DM & Support...')
  await seedDMAndSupport(users)

  console.log('🪙 NFT & Marketplace...')
  await seedNFTsAndMarketplace(users)

  console.log('🔍 Explore & Events...')
  await seedExploreAndEvents(contentIds)

  console.log('✨ Seed completed successfully')
  console.log(`Users: ${users.length}, Categories: ${categories.length}, Products: ${products.length}, Posts: ${contentIds.length}`)
  console.log('Ready for Swagger verification (users -> catalog -> content -> extras).')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
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
  await prisma.contentPost.create({
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

  const NORMAL_DM_THREAD_SEEDS: ThreadSeed[] = [
    {
      userOneId: TEST_USER_ID,
      userTwoId: TARGET_USER_ID,
      unreadCountUserOne: 1,
      unreadCountUserTwo: 0,
      isSupportThread: false,
      messages: [
        {
          senderId: TEST_USER_ID,
          message: 'Selam! Yeni ürün incelemesini gördün mü?',
          minutesAgo: 30,
          isRead: true,
          context: 'DM',
        },
        {
          senderId: TARGET_USER_ID,
          message: 'Evet, mükemmel olmuş. Birkaç önerim olacak 👌',
          minutesAgo: 10,
          isRead: false,
          context: 'DM',
        },
      ],
    },
    {
      userOneId: TRUST_USER_IDS[0],
      userTwoId: TEST_USER_ID,
      unreadCountUserOne: 0,
      unreadCountUserTwo: 2,
      isSupportThread: false,
      messages: [
        {
          senderId: TRUST_USER_IDS[0],
          message: 'Merhaba! Mini destek görüşmesi için uygun musun?',
          minutesAgo: 45,
          isRead: false,
          context: 'DM',
        },
        {
          senderId: TRUST_USER_IDS[0],
          message: 'Bu arada geçen hafta gönderdiğim TIPS için teşekkür ederim.',
          minutesAgo: 40,
          isRead: false,
          context: 'DM',
        },
        {
          senderId: TEST_USER_ID,
          message: 'Ben de teşekkür ederim, çok yardımcı oldun 🙏',
          minutesAgo: 5,
          isRead: true,
          context: 'DM',
        },
      ],
    },
  ];

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
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
    type: 'GENERAL' | 'TECHNICAL' | 'PRODUCT';
    amount: number;
    minutesAgo: number;
    threadId: null;
  };

  const SUPPORT_REQUEST_SEEDS: SupportRequestSeed[] = [
    // Pending request - threadId yok
    {
      id: '00000000-0000-4000-8000-000000000101',
      fromUserId: TARGET_USER_ID,
      toUserId: TEST_USER_ID,
      description: 'Beta paneldeki yeni metrikler için rehberlik rica ediyorum.',
      status: 'PENDING',
      type: 'GENERAL',
      amount: 50,
      minutesAgo: 60,
      threadId: null,
    },
    // Accepted request - threadId var, support thread oluşturulacak
    {
      id: '00000000-0000-4000-8000-000000000102',
      fromUserId: TEST_USER_ID,
      toUserId: TARGET_USER_ID,
      description: 'Smartwatch kurulumu için yardıma ihtiyacım var. Hangi modeli kullanıyorsunuz?',
      status: 'ACCEPTED',
      type: 'TECHNICAL',
      amount: 100,
      minutesAgo: 120,
      threadId: null,
    },
    // Declined request - threadId yok
    {
      id: '00000000-0000-4000-8000-000000000103',
      fromUserId: TRUST_USER_IDS[0],
      toUserId: TEST_USER_ID,
      description: 'Ürün önerisi için destek istiyorum.',
      status: 'DECLINED',
      type: 'PRODUCT',
      amount: 75,
      minutesAgo: 180,
      threadId: null,
    },
    // Another accepted request - farklı kullanıcılar arasında
    {
      id: '00000000-0000-4000-8000-000000000104',
      fromUserId: TRUST_USER_IDS[1],
      toUserId: TEST_USER_ID,
      description: 'Yazılım geliştirme konusunda danışmanlık almak istiyorum.',
      status: 'ACCEPTED',
      type: 'GENERAL',
      amount: 150,
      minutesAgo: 90,
      threadId: null,
    },
  ];

  let supportRequestsCount = 0;
  let supportThreadsCount = 0;
  let supportMessagesCount = 0;
  
  for (const supportRequest of SUPPORT_REQUEST_SEEDS) {
    // Delete existing request if exists
    await prisma.dMRequest.deleteMany({ where: { id: supportRequest.id } });
    
    let threadId: string | null = null;
    
    // If status is ACCEPTED, create a support thread
    if (supportRequest.status === 'ACCEPTED') {
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
