import type { PrismaClient } from '@prisma/client'
import { getSeedMediaPath } from '../helpers/media.helper'

/**
 * Ensures every seed user has at least one UserAvatar (active).
 * Main seed createSeedUsers does not populate UserAvatar; this step fills it for EP compatibility.
 */
export async function seedUserAvatars(prisma: PrismaClient): Promise<void> {
  console.log('\n   Seeding UserAvatars...')

  const defaultAvatarPath = getSeedMediaPath('user.avatar.default' as any, true)
  if (!defaultAvatarPath) {
    console.warn('   Default avatar key not found in seed-media-map, skipping UserAvatar seed')
    return
  }

  const users = await prisma.user.findMany({ take: 80, select: { id: true } })
  let created = 0

  for (const user of users) {
    const activeAvatar = await prisma.userAvatar.findFirst({
      where: { userId: user.id, isActive: true },
    })
    if (activeAvatar) continue

    await prisma.userAvatar.updateMany({
      where: { userId: user.id },
      data: { isActive: false },
    })
    await prisma.userAvatar.create({
      data: { userId: user.id, imageUrl: defaultAvatarPath, isActive: true },
    })
    created++
  }

  console.log(`   Created ${created} UserAvatar records (${users.length} users checked)`)
}
