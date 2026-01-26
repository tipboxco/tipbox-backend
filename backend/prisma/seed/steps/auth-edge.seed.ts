import type { PrismaClient } from '@prisma/client'
import { randomBytes } from 'crypto'

function randomCode6(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function randomToken(): string {
  return randomBytes(24).toString('hex')
}

export async function seedAuthUserEdges(prisma: PrismaClient, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return

  // 1) Roles (idempotent-ish: avoid duplicates per user-role)
  const adminUserId = userIds[0]
  const roles: Array<{ userId: string; role: string }> = [
    { userId: adminUserId, role: 'ADMIN' },
  ]

  for (const r of roles) {
    const exists = await prisma.userRole.findFirst({ where: { userId: r.userId, role: r.role } })
    if (!exists) {
      await prisma.userRole.create({ data: r })
    }
  }

  // 2) Feed preferences (unique by userId)
  for (const userId of userIds.slice(0, 10)) {
    await prisma.userFeedPreferences.upsert({
      where: { userId },
      create: {
        userId,
        preferredCategories: JSON.stringify(['Electronics', 'Beauty', 'Laptops'].slice(0, 2)),
        preferredContentTypes: JSON.stringify(['QUESTION', 'TIPS', 'EXPERIENCE'].slice(0, 2)),
        language: 'tr',
      },
      update: {
        language: 'tr',
      },
    })
  }

  // 3) Email verification codes (a few active, unused)
  for (const userId of userIds.slice(0, 5)) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    if (!user?.email) continue

    const existing = await prisma.emailVerificationCode.findFirst({
      where: { userId, email: user.email, isUsed: false, expiresAt: { gt: new Date() } },
    })
    if (existing) continue

    await prisma.emailVerificationCode.create({
      data: {
        userId,
        email: user.email,
        code: randomCode6(),
        isUsed: false,
        expiresAt: new Date(Date.now() + 1000 * 60 * 30), // 30 min
      },
    })
  }

  // 4) Password reset token (one sample)
  {
    const userId = userIds[0]
    const existing = await prisma.passwordResetToken.findFirst({
      where: { userId, isUsed: false, expiresAt: { gt: new Date() } },
    })
    if (!existing) {
      await prisma.passwordResetToken.create({
        data: {
          userId,
          token: randomToken(),
          isUsed: false,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1h
        },
      })
    }
  }

  // 5) Login attempts (mix of success/failed)
  for (const userId of userIds.slice(0, 5)) {
    const hasAny = await prisma.loginAttempt.findFirst({ where: { userId } })
    if (hasAny) continue

    await prisma.loginAttempt.createMany({
      data: [
        {
          userId,
          ipAddress: '192.168.1.10',
          userAgent: 'Mozilla/5.0 SeedBot',
          status: 'SUCCESS',
          attemptedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
        },
        {
          userId,
          ipAddress: '192.168.1.11',
          userAgent: 'Mozilla/5.0 SeedBot',
          status: 'FAILED',
          attemptedAt: new Date(Date.now() - 1000 * 60 * 20),
        },
      ],
    })
  }

  // 6) KYC record (one sample)
  {
    const userId = userIds[0]
    const existing = await prisma.userKycRecord.findFirst({ where: { userId } })
    if (!existing) {
      await prisma.userKycRecord.create({
        data: {
          userId,
          sumsubApplicantId: `seed_${userId}_${Date.now()}`,
          reviewStatus: 'INIT',
          reviewResult: 'NULL',
          provider: 'SUMSUB',
          kycLevel: 'basic',
          lastUpdatedAt: new Date(),
          lastSyncedAt: null,
        },
      })
    }
  }
}

