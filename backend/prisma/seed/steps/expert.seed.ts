import type { PrismaClient } from '@prisma/client'
import { ExpertRequestStatus } from '@prisma/client'

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

const DESCRIPTIONS = [
  'Looking for recommendations for a good wireless earbud under $150 with ANC.',
  'Which smartphone has the best battery life in 2025?',
  'Need advice on skincare routine for sensitive skin.',
  'Best laptop for software development and light gaming?',
  'Comparing iPhone 17 Pro vs Samsung S25 - which would you pick and why?',
  'What moisturizer works best for dry skin in winter?',
  'Is the MacBook Air M4 worth it for students?',
  'Recommendations for a durable fitness tracker with GPS.',
  'Best foundation for oily skin that lasts all day?',
  'Looking for a good mechanical keyboard for programming.',
]

const ANSWERS = [
  'I would recommend the Sony WF-1000XM5 for ANC and sound quality in that range.',
  'Based on my experience, the iPhone 17 Pro Max has excellent battery life this year.',
  'For sensitive skin, stick to fragrance-free and patch test. CeraVe is a safe bet.',
  'The M4 MacBook Pro 14" is a great balance if you need both dev and light gaming.',
  'It depends on your ecosystem - both are great. I prefer iPhone for longevity.',
  'La Roche-Posay Toleriane Double Repair has worked well for me in winter.',
  'Yes, for students the Air M4 is plenty and the battery is fantastic.',
  'Garmin Forerunner 265 is accurate and durable for running.',
  'Estée Lauder Double Wear stays put on oily skin - worth the price.',
  'Keychron K2 or K8 are solid for programming and not too loud.',
]

/**
 * Seeds ExpertRequest, ExpertRequestMedia (optional), ExpertAnswer.
 */
export async function seedExpert(prisma: PrismaClient): Promise<void> {
  console.log('\n   Seeding ExpertRequest, ExpertAnswer...')

  const users = await prisma.user.findMany({ take: 15, select: { id: true } })
  if (users.length < 3) {
    console.warn('   Not enough users for expert seed, skipping')
    return
  }

  const shuffled = shuffleArray(users)
  const requestCount = Math.min(getRandomInt(5, 10), DESCRIPTIONS.length, users.length)
  let requestsCreated = 0
  let answersCreated = 0

  for (let i = 0; i < requestCount; i++) {
    const asker = shuffled[i % shuffled.length]
    const description = DESCRIPTIONS[i % DESCRIPTIONS.length]
    if (!asker) continue

    const request = await prisma.expertRequest.create({
      data: {
        userId: asker.id,
        description,
        category: i % 2 === 0 ? 'Electronics' : 'Beauty',
        tipsAmount: getRandomInt(10, 50) * 10,
        status: i % 3 === 0 ? ExpertRequestStatus.PENDING : ExpertRequestStatus.ANSWERED,
      },
    }).catch(() => null)
    if (!request) continue
    requestsCreated++

    if (request.status === ExpertRequestStatus.ANSWERED) {
      const expertUser = shuffled[(i + 1) % shuffled.length]
      if (expertUser && expertUser.id !== asker.id) {
        const answerContent = ANSWERS[i % ANSWERS.length]
        await prisma.expertAnswer.create({
          data: {
            requestId: request.id,
            expertUserId: expertUser.id,
            content: answerContent,
          },
        }).catch(() => {})
        answersCreated++
      }
    }
  }

  console.log(`   Created ${requestsCreated} ExpertRequest, ${answersCreated} ExpertAnswer`)
}
