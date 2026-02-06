import type { PrismaClient } from '@prisma/client'
import { NotificationType } from '@prisma/client'

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

const NOTIFICATION_TEMPLATES: Array<{ type: NotificationType; title: string; message: string }> = [
  { type: 'POST_LIKED', title: 'Post beğenildi', message: 'Gönderiniz 5 kişi tarafından beğenildi.' },
  { type: 'POST_COMMENTED', title: 'Yeni yorum', message: 'Gönderinize yeni bir yorum yapıldı.' },
  { type: 'NEW_TRUSTER', title: 'Yeni güven', message: 'Size güvenen yeni bir kullanıcı var.' },
  { type: 'NEW_MESSAGE', title: 'Yeni mesaj', message: 'Size yeni bir mesaj gönderildi.' },
  { type: 'TIPS_RECEIVED', title: 'TIPS aldınız', message: 'Bir kullanıcı size 25 TIPS gönderdi.' },
  { type: 'EVENT_STARTED', title: 'Etkinlik başladı', message: 'Katıldığınız etkinlik başladı.' },
  { type: 'NEW_BADGE', title: 'Yeni rozet', message: 'Yeni bir rozet kazandınız!' },
  { type: 'SYSTEM_ANNOUNCEMENT', title: 'Duyuru', message: 'Platform güncellemesi hakkında bilgi.' },
]

/**
 * Seeds Notification and optional PushToken.
 */
export async function seedNotification(prisma: PrismaClient): Promise<void> {
  console.log('\n   Seeding Notification, PushToken...')

  const users = await prisma.user.findMany({ take: 15, select: { id: true } })
  if (users.length < 2) {
    console.warn('   Not enough users for notification seed, skipping')
    return
  }

  const shuffled = shuffleArray(users)
  const notificationCount = Math.min(getRandomInt(5, 10), NOTIFICATION_TEMPLATES.length * 2)
  let notificationsCreated = 0
  let pushTokensCreated = 0

  for (let i = 0; i < notificationCount; i++) {
    const user = shuffled[i % shuffled.length]
    if (!user) continue
    const template = NOTIFICATION_TEMPLATES[i % NOTIFICATION_TEMPLATES.length]
    const read = i % 3 === 0
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: template.type,
        title: template.title,
        message: template.message,
        read,
        readAt: read ? new Date(Date.now() - getRandomInt(1, 24) * 60 * 60 * 1000) : null,
      },
    }).catch(() => {})
    notificationsCreated++
  }

  // Optional: 1-2 PushToken for first user
  const firstUser = users[0]
  if (firstUser) {
    const existingToken = await prisma.pushToken.findFirst({
      where: { userId: firstUser.id },
    })
    if (!existingToken) {
      await prisma.pushToken.create({
        data: {
          userId: firstUser.id,
          token: `seed_push_token_${firstUser.id.replace(/-/g, '').substring(0, 20)}`,
          deviceType: 'IOS',
          isActive: true,
        },
      }).catch(() => {})
      pushTokensCreated++
    }
  }

  console.log(`   Created ${notificationsCreated} Notification, ${pushTokensCreated} PushToken`)
}
