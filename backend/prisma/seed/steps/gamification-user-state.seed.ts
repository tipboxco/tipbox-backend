import type { PrismaClient } from '@prisma/client'

export async function seedGamificationUserState(prisma: PrismaClient, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return
  const seededAt = new Date()

  // Goal -> rewardBadgeId üzerinden deterministik user state üretelim
  // Not: "öne çıkan" badge'leri seed'lememek için sadece ACHIEVEMENT + COMMON/RARE hedeflerini dikkate alıyoruz.
  const goals = await prisma.achievementGoal.findMany({
    where: {
      rewardBadgeId: { not: null },
      rewardBadge: {
        is: {
          type: 'ACHIEVEMENT',
          rarity: { in: ['COMMON', 'RARE'] },
        },
      },
    },
    select: { id: true, rewardBadgeId: true, pointsRequired: true },
  })

  if (goals.length === 0) return

  // Basit deterministik hash (FNV-1a 32bit)
  const hash32 = (value: string): number => {
    let h = 0x811c9dc5
    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    return h >>> 0
  }

  const sortedGoals = goals.slice().sort((a, b) => a.id.localeCompare(b.id))

  const pickGoalsForUser = (userId: string): typeof goals => {
    const h = hash32(userId)
    const perUser = (h % 2) + 1 // 1-2
    const start = h % sortedGoals.length
    const selected: (typeof goals)[number][] = []
    for (let i = 0; i < Math.min(perUser, sortedGoals.length); i++) {
      selected.push(sortedGoals[(start + i) % sortedGoals.length])
    }
    return selected
  }

  for (const userId of userIds) {
    const selectedGoals = pickGoalsForUser(userId)

    for (let i = 0; i < selectedGoals.length; i++) {
      const g = selectedGoals[i]
      const badgeId = g.rewardBadgeId!

      await prisma.userAchievement.upsert({
        where: { userId_goalId: { userId, goalId: g.id } },
        create: {
          userId,
          goalId: g.id,
          progress: g.pointsRequired,
          completed: true,
          completedAt: seededAt,
        },
        update: {
          progress: g.pointsRequired,
          completed: true,
          completedAt: seededAt,
        },
      })

      await prisma.userBadge.upsert({
        where: { userId_badgeId: { userId, badgeId } },
        create: {
          userId,
          badgeId,
          isVisible: true,
          visibility: 'PUBLIC',
          claimed: true,
          claimedAt: seededAt,
          displayOrder: i + 1,
        },
        update: {
          isVisible: true,
          visibility: 'PUBLIC',
          claimed: true,
          claimedAt: seededAt,
          displayOrder: i + 1,
        },
      })
    }
  }
}

