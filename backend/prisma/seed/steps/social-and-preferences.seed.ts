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

/**
 * Seeds UserBlock, UserMute, UserFeedPreferences for test/demo.
 */
export async function seedSocialAndPreferences(prisma: PrismaClient): Promise<void> {
  console.log('\n   Seeding UserBlock, UserMute, UserFeedPreferences...')

  const users = await prisma.user.findMany({ take: 40, select: { id: true } })
  if (users.length < 4) {
    console.warn('   Not enough users for social seed, skipping')
    return
  }

  const shuffled = shuffleArray(users)
  let blocksCreated = 0
  let mutesCreated = 0
  let prefsCreated = 0

  // UserBlock: 2-5 pairs (blocker, blocked)
  const blockCount = Math.min(getRandomInt(2, 5), Math.floor(shuffled.length / 2))
  for (let i = 0; i < blockCount; i++) {
    const blocker = shuffled[i * 2]
    const blocked = shuffled[i * 2 + 1]
    if (!blocker || !blocked || blocker.id === blocked.id) continue
    await prisma.userBlock.upsert({
      where: { blockerId_blockedUserId: { blockerId: blocker.id, blockedUserId: blocked.id } },
      update: {},
      create: { blockerId: blocker.id, blockedUserId: blocked.id },
    }).catch(() => {})
    blocksCreated++
  }

  // UserMute: 2-5 pairs
  const muteCount = Math.min(getRandomInt(2, 5), Math.floor(shuffled.length / 2))
  for (let i = 0; i < muteCount; i++) {
    const muter = shuffled[muteCount + i * 2]
    const muted = shuffled[muteCount + i * 2 + 1]
    if (!muter || !muted || muter.id === muted.id) continue
    await prisma.userMute.upsert({
      where: { muterId_mutedUserId: { muterId: muter.id, mutedUserId: muted.id } },
      update: {},
      create: { muterId: muter.id, mutedUserId: muted.id },
    }).catch(() => {})
    mutesCreated++
  }

  // UserFeedPreferences: 3-5 users (first N users)
  const prefsCount = Math.min(getRandomInt(3, 5), users.length)
  const prefCategories = ['Electronics', 'Beauty', 'Electronics,Beauty']
  const prefContentTypes = ['EXPERIENCE,TIPS', 'COMPARE,QUESTION', 'EXPERIENCE,TIPS,UPDATE']
  for (let i = 0; i < prefsCount; i++) {
    const user = users[i]
    if (!user) continue
    await prisma.userFeedPreferences.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        preferredCategories: prefCategories[i % prefCategories.length],
        preferredContentTypes: prefContentTypes[i % prefContentTypes.length],
        language: 'tr',
      },
    }).catch(() => {})
    prefsCreated++
  }

  console.log(`   Created ${blocksCreated} UserBlock, ${mutesCreated} UserMute, ${prefsCreated} UserFeedPreferences`)
}
