import type { PrismaClient, Brand, User, Badge } from '@prisma/client'

// ============================================================================
// TYPES
// ============================================================================

type BrandWithProductCount = Brand & { _count: { products: number } }

interface SurveyTemplate {
  title: string
  description: string
  questions: Array<{
    text: string
    options: string[]
  }>
}

interface NewsTemplate {
  title: string
  tags: string[]
}

// ============================================================================
// TEMPLATES (English Content)
// ============================================================================

const SURVEY_TEMPLATES: SurveyTemplate[] = [
  {
    title: 'Product Satisfaction Survey',
    description: 'Help us improve your experience with our products',
    questions: [
      {
        text: 'How satisfied are you with the product quality?',
        options: ['Very Satisfied', 'Satisfied', 'Neutral', 'Dissatisfied'],
      },
      {
        text: 'How likely are you to recommend this brand?',
        options: ['Very Likely', 'Likely', 'Neutral', 'Unlikely'],
      },
      {
        text: 'How would you rate the value for money?',
        options: ['Excellent', 'Good', 'Average', 'Poor'],
      },
    ],
  },
  {
    title: 'Feature Preferences Survey',
    description: 'Tell us what features matter most to you',
    questions: [
      {
        text: 'Which feature is most important to you?',
        options: ['Performance', 'Design', 'Price', 'Durability'],
      },
      {
        text: 'How often do you use this product?',
        options: ['Daily', 'Weekly', 'Monthly', 'Rarely'],
      },
      {
        text: 'Where do you primarily use this product?',
        options: ['Home', 'Office', 'Outdoors', 'Travel'],
      },
    ],
  },
]

const NEWS_TEMPLATES: NewsTemplate[] = [
  { title: 'New Product Launch', tags: ['launch', 'new', 'product'] },
  { title: 'Special Promotion Announcement', tags: ['promotion', 'discount', 'offer'] },
  { title: 'Technology Innovation Update', tags: ['technology', 'innovation', 'update'] },
]

const POST_TEMPLATES: string[] = [
  'Just had an amazing experience with {brand}! Highly recommend their products.',
  'Been using {brand} products for a while now and the quality is outstanding.',
  'Sharing my thoughts on the latest {brand} release - exceeded my expectations!',
  'Customer service at {brand} was exceptional. Great support team!',
  'Comparing {brand} with competitors - they definitely stand out in quality.',
  'Really impressed with the build quality of my new {brand} product.',
  'The attention to detail in {brand} products is remarkable.',
  'Just upgraded to the latest {brand} model - worth every penny!',
  'Love how {brand} keeps innovating while maintaining quality standards.',
  'My go-to brand for reliability - {brand} never disappoints.',
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateUlid(): string {
  const timestamp = Date.now().toString(36).toUpperCase().padStart(10, '0')
  const randomPart = Math.random().toString(36).substring(2, 18).toUpperCase().padStart(16, '0')
  return (timestamp + randomPart).substring(0, 26)
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

async function getTopBrandsByProductCount(
  prisma: PrismaClient,
  limit = 5,
): Promise<BrandWithProductCount[]> {
  return prisma.brand.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { products: { _count: 'desc' } },
    take: limit,
  })
}

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

async function seedBridgeFollowers(
  prisma: PrismaClient,
  brands: BrandWithProductCount[],
  users: User[],
): Promise<void> {
  console.log('   Seeding BridgeFollowers...')

  if (users.length === 0) {
    console.warn('   No users found, skipping BridgeFollowers')
    return
  }

  let totalFollowers = 0

  for (const brand of brands) {
    const followerCount = getRandomInt(5, 15)
    const selectedUsers = shuffleArray(users).slice(0, followerCount)

    for (const user of selectedUsers) {
      await prisma.bridgeFollower
        .upsert({
          where: {
            userId_brandId: { userId: user.id, brandId: brand.id },
          },
          update: {},
          create: {
            userId: user.id,
            brandId: brand.id,
          },
        })
        .catch(() => {
          // Ignore duplicate errors
        })
      totalFollowers++
    }
  }

  console.log(`   Created ${totalFollowers} BridgeFollower records`)
}

async function seedBrandSurveys(
  prisma: PrismaClient,
  brands: BrandWithProductCount[],
  users: User[],
): Promise<void> {
  console.log('   Seeding BrandSurveys...')

  if (users.length === 0) {
    console.warn('   No users found, skipping BrandSurveys')
    return
  }

  let totalSurveys = 0
  let totalQuestions = 0
  let totalAnswers = 0

  const now = new Date()
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  for (const brand of brands) {
    for (const template of SURVEY_TEMPLATES) {
      // Check if survey already exists
      const existingSurvey = await prisma.brandSurvey.findFirst({
        where: {
          brandId: brand.id,
          title: `${brand.name} - ${template.title}`,
        },
      })

      if (existingSurvey) {
        continue
      }

      // Create survey
      const survey = await prisma.brandSurvey.create({
        data: {
          brandId: brand.id,
          title: `${brand.name} - ${template.title}`,
          description: template.description,
          startsAt: now,
          endsAt: thirtyDaysLater,
        },
      })
      totalSurveys++

      // Create questions
      for (const questionTemplate of template.questions) {
        const question = await prisma.brandSurveyQuestion.create({
          data: {
            surveyId: survey.id,
            questionText: questionTemplate.text,
            type: 'SINGLE_CHOICE',
          },
        })
        totalQuestions++

        // Create answers from random users (3-5 users per question)
        const answeringUsers = shuffleArray(users).slice(0, getRandomInt(3, 5))
        for (const user of answeringUsers) {
          const randomOption =
            questionTemplate.options[Math.floor(Math.random() * questionTemplate.options.length)]

          await prisma.brandSurveyAnswer
            .create({
              data: {
                questionId: question.id,
                userId: user.id,
                answerText: randomOption,
              },
            })
            .catch(() => {
              // Ignore duplicate errors (unique constraint on questionId + userId)
            })
          totalAnswers++
        }
      }
    }
  }

  console.log(
    `   Created ${totalSurveys} surveys, ${totalQuestions} questions, ${totalAnswers} answers`,
  )
}

async function seedBridgePosts(
  prisma: PrismaClient,
  brands: BrandWithProductCount[],
  users: User[],
): Promise<void> {
  console.log('   Seeding BridgePosts...')

  if (users.length === 0) {
    console.warn('   No users found, skipping BridgePosts')
    return
  }

  let totalPosts = 0

  for (const brand of brands) {
    const postCount = getRandomInt(5, 10)

    for (let i = 0; i < postCount; i++) {
      const randomUser = users[Math.floor(Math.random() * users.length)]
      const templateIndex = i % POST_TEMPLATES.length
      const content = POST_TEMPLATES[templateIndex].replace('{brand}', brand.name)

      await prisma.bridgePost.create({
        data: {
          id: generateUlid(),
          brandId: brand.id,
          userId: randomUser.id,
          content,
        },
      })
      totalPosts++
    }
  }

  console.log(`   Created ${totalPosts} BridgePost records`)
}

async function seedBridgeRewards(
  prisma: PrismaClient,
  brands: BrandWithProductCount[],
  users: User[],
  badges: Badge[],
): Promise<void> {
  console.log('   Seeding BridgeRewards...')

  if (users.length === 0) {
    console.warn('   No users found, skipping BridgeRewards')
    return
  }

  if (badges.length === 0) {
    console.warn('   No BRAND type badges found, skipping BridgeRewards')
    return
  }

  let totalRewards = 0

  for (const brand of brands) {
    const rewardCount = getRandomInt(5, 10)
    const selectedUsers = shuffleArray(users).slice(0, rewardCount)

    for (const user of selectedUsers) {
      const randomBadge = badges[Math.floor(Math.random() * badges.length)]

      await prisma.bridgeReward
        .create({
          data: {
            userId: user.id,
            brandId: brand.id,
            badgeId: randomBadge.id,
          },
        })
        .catch(() => {
          // Ignore errors
        })
      totalRewards++
    }
  }

  console.log(`   Created ${totalRewards} BridgeReward records`)
}

async function seedBrandNews(
  prisma: PrismaClient,
  brands: BrandWithProductCount[],
): Promise<void> {
  console.log('   Seeding News...')

  let totalNews = 0

  for (const brand of brands) {
    for (const template of NEWS_TEMPLATES) {
      const title = `${brand.name} - ${template.title}`

      // Check if news already exists
      const existingNews = await prisma.news.findFirst({
        where: {
          brandId: brand.id,
          title,
        },
      })

      if (existingNews) {
        continue
      }

      await prisma.news.create({
        data: {
          brandId: brand.id,
          title,
          content: `${brand.name} is excited to announce: ${template.title.toLowerCase()}. Stay tuned for more updates and exclusive content from our team. We're committed to bringing you the best products and experiences in the industry.`,
          source: 'tipbox',
          author: 'Tipbox Editorial Team',
          tags: template.tags,
        },
      })
      totalNews++
    }
  }

  console.log(`   Created ${totalNews} News records`)
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

export async function seedBrandCatalog(prisma: PrismaClient): Promise<void> {
  console.log('\nBrand Catalog seeding starting...\n')

  // Get top 5 brands by product count
  const topBrands = await getTopBrandsByProductCount(prisma, 5)

  if (topBrands.length === 0) {
    console.warn('No brands found in database, skipping Brand Catalog seed')
    return
  }

  console.log(`Found ${topBrands.length} brands with products:`)
  topBrands.forEach((brand, index) => {
    console.log(`   ${index + 1}. ${brand.name} (${brand._count.products} products)`)
  })
  console.log('')

  // Get users and badges
  const users = await prisma.user.findMany({ take: 40 })
  const badges = await prisma.badge.findMany({ where: { type: 'BRAND' } })

  console.log(`Using ${users.length} users and ${badges.length} BRAND type badges\n`)

  // Seed all data
  await seedBridgeFollowers(prisma, topBrands, users)
  await seedBrandSurveys(prisma, topBrands, users)
  await seedBridgePosts(prisma, topBrands, users)
  await seedBridgeRewards(prisma, topBrands, users, badges)
  await seedBrandNews(prisma, topBrands)

  console.log('\nBrand Catalog seeding completed!\n')
}
