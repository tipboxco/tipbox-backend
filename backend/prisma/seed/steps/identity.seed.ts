import type { PrismaClient } from '@prisma/client'
import { getSeedMediaPath, type SeedMediaKey } from '../helpers/media.helper'

export interface SeedUserConfig {
  id: string
  name: string
  email: string
  userName: string
  avatarKey: SeedMediaKey
  bio: string
  title: string
  country: string
}

export async function seedUsersAndProfiles(args: {
  prisma: PrismaClient
  seedUsers: SeedUserConfig[]
  requiredUserIds: string[]
  targetTotal: number
  passwordHash: string
  defaultThemeId: string
}): Promise<Map<string, { id: string; email: string; name: string }>> {
  const { prisma, seedUsers, requiredUserIds, targetTotal, passwordHash, defaultThemeId } = args

  const createdUsers = new Map<string, { id: string; email: string; name: string }>()
  const bannerUrl = getSeedMediaPath('user.banner.primary', true)

  const requiredSet = new Set(requiredUserIds)
  const requiredConfigs = seedUsers.filter((u) => requiredSet.has(u.id))
  const otherConfigs = seedUsers.filter((u) => !requiredSet.has(u.id))
  const selectedUserConfigs = [...requiredConfigs, ...otherConfigs].slice(
    0,
    Math.max(0, targetTotal),
  )

  for (const userConfig of selectedUserConfigs) {
    // 1) User oluştur veya bul
    let user = await prisma.user.findUnique({ where: { id: userConfig.id } })

    if (!user) {
      user = await prisma.user.findUnique({ where: { email: userConfig.email } })

      if (!user) {
        user = await prisma.user.create({
          data: {
            id: userConfig.id,
            email: userConfig.email,
            passwordHash,
            emailVerified: true,
            status: 'ACTIVE',
          },
        })
      }
    }

    // 2) Profile oluştur/güncelle
    await prisma.profile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        displayName: userConfig.name,
        userName: userConfig.userName,
        bio: userConfig.bio,
        bannerUrl,
        country: userConfig.country,
        postsCount: 0,
        trustCount: 0,
        trusterCount: 0,
      },
      update: {
        displayName: userConfig.name,
        userName: userConfig.userName,
        bio: userConfig.bio,
        bannerUrl,
        country: userConfig.country,
      },
    })

    // 3) UserAvatar oluştur/güncelle
    let avatarUrl = getSeedMediaPath(userConfig.avatarKey, true)

    if (!avatarUrl) {
      avatarUrl = getSeedMediaPath('user.avatar.default', true)
    }

    if (avatarUrl) {
      const existingAvatar = await prisma.userAvatar.findFirst({
        where: { userId: user.id, isActive: true },
      })

      if (existingAvatar) {
        await prisma.userAvatar.update({
          where: { id: existingAvatar.id },
          data: { imageUrl: avatarUrl, isActive: true },
        })
      } else {
        await prisma.userAvatar.updateMany({
          where: { userId: user.id },
          data: { isActive: false },
        })

        await prisma.userAvatar.create({
          data: { userId: user.id, imageUrl: avatarUrl, isActive: true },
        })
      }
    }

    // 4) UserTitle (sadece yoksa)
    const existingTitle = await prisma.userTitle.findFirst({ where: { userId: user.id } })
    if (!existingTitle) {
      await prisma.userTitle.create({
        data: { userId: user.id, title: userConfig.title },
      })
    }

    // 5) UserSettings oluştur/güncelle
    await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        themeId: defaultThemeId,
        receiveNotifications: true,
        visibility: 'PUBLIC',
        trustNotifications: true,
        supportNotifications: true,
        messageNotifications: true,
        collectionNotifications: true,
        postNotifications: true,
      },
      update: { themeId: defaultThemeId },
    })

    // 6) Wallet (sadece yoksa)
    const existingWallet = await prisma.wallet.findFirst({ where: { userId: user.id } })
    if (!existingWallet) {
      const publicAddress = `0x${user.id.replace(/-/g, '').substring(0, 40)}`
      await prisma.wallet.create({
        data: {
          userId: user.id,
          publicAddress,
          provider: 'CUSTOM',
          isConnected: true,
          balance: 1000.0,
          lockedBalance: 0,
        },
      })
    }

    createdUsers.set(user.id, { id: user.id, email: userConfig.email, name: userConfig.name })
  }

  return createdUsers
}

