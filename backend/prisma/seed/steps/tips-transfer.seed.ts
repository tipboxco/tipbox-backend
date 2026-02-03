import type { PrismaClient } from '@prisma/client'

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

const REASONS = [
  'Thanks for the great review!',
  'Tip for helpful content',
  'Appreciation for expert answer',
  'Support for the community',
]

/**
 * Seeds TipsTokenTransfer between seed users.
 */
export async function seedTipsTransfers(prisma: PrismaClient): Promise<void> {
  console.log('\n   Seeding TipsTokenTransfer...')

  const users = await prisma.user.findMany({ take: 20, select: { id: true } })
  if (users.length < 2) {
    console.warn('   Not enough users for tips transfer seed, skipping')
    return
  }

  const shuffled = shuffleArray(users)
  const count = Math.min(getRandomInt(5, 12), shuffled.length * (shuffled.length - 1))
  let created = 0

  const used = new Set<string>()
  for (let i = 0; i < count; i++) {
    const fromUser = shuffled[i % shuffled.length]
    const toUser = shuffled[(i + 1) % shuffled.length]
    if (!fromUser || !toUser || fromUser.id === toUser.id) continue
    const key = `${fromUser.id}-${toUser.id}`
    if (used.has(key)) continue
    used.add(key)

    const amount = parseFloat((getRandomInt(5, 50) + Math.random()).toFixed(2))
    const reason = REASONS[getRandomInt(0, REASONS.length - 1)]

    await prisma.tipsTokenTransfer.create({
      data: {
        fromUserId: fromUser.id,
        toUserId: toUser.id,
        amount,
        reason,
      },
    }).catch(() => {})
    created++
  }

  console.log(`   Created ${created} TipsTokenTransfer records`)
}
