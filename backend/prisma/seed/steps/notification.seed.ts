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

/** Comprehensive notification templates covering all major types */
const NOTIFICATION_TEMPLATES: Array<{ type: NotificationType; title: string; message: string }> = [
  // Interaction
  { type: 'POST_LIKED', title: 'Post liked', message: 'Your post was liked by 5 people.' },
  { type: 'POST_COMMENTED', title: 'New comment', message: 'Someone commented on your post.' },
  { type: 'POST_SHARED', title: 'Post shared', message: 'Your post was shared by a user.' },
  { type: 'POST_FAVORITED', title: 'Post saved', message: 'Someone saved your post to favorites.' },
  { type: 'COMMENT_LIKED', title: 'Comment liked', message: 'Your comment received a like.' },
  { type: 'COMMENT_REPLIED', title: 'New reply', message: 'Someone replied to your comment.' },
  // Trust & Follow
  { type: 'NEW_TRUSTER', title: 'New trust', message: 'A new user trusts you.' },
  { type: 'NEW_TRUSTED_BY', title: 'Trust confirmed', message: 'Someone you trust now trusts you back.' },
  // Messaging
  { type: 'NEW_MESSAGE', title: 'New message', message: 'You have a new direct message.' },
  { type: 'DM_REQUEST_RECEIVED', title: 'DM request', message: 'You received a new DM request.' },
  { type: 'DM_REQUEST_ACCEPTED', title: 'Request accepted', message: 'Your DM request was accepted.' },
  { type: 'SUPPORT_REQUEST_ACCEPTED', title: 'Support accepted', message: 'Your support request has been accepted.' },
  // Gamification
  { type: 'NEW_BADGE', title: 'New badge earned', message: 'You earned a new badge!' },
  { type: 'ACHIEVEMENT_UNLOCKED', title: 'Achievement unlocked', message: 'You unlocked a new achievement!' },
  { type: 'LEVEL_UP', title: 'Level up', message: 'Congratulations! You leveled up.' },
  { type: 'REWARD_EARNED', title: 'Reward available', message: 'You have a new reward to claim.' },
  // Expert
  { type: 'EXPERT_REQUEST_AVAILABLE', title: 'Expert request', message: 'A new expert request is available for you.' },
  { type: 'EXPERT_REQUEST_ANSWERED', title: 'Expert answer', message: 'Your expert request received an answer.' },
  // Events
  { type: 'EVENT_STARTED', title: 'Event started', message: 'An event you joined has started.' },
  { type: 'EVENT_ENDING_SOON', title: 'Event ending soon', message: 'An event you joined is ending in 24 hours.' },
  { type: 'EVENT_REWARD_AVAILABLE', title: 'Event reward', message: 'You can now claim your event reward.' },
  // Financial
  { type: 'TIPS_RECEIVED', title: 'TIPS received', message: 'A user sent you 25 TIPS.' },
  { type: 'TIPS_SENT', title: 'TIPS sent', message: 'You sent 10 TIPS successfully.' },
  { type: 'WALLET_CONNECTED', title: 'Wallet connected', message: 'Your wallet has been connected successfully.' },
  // System
  { type: 'SYSTEM_ANNOUNCEMENT', title: 'Announcement', message: 'Check out the latest platform updates.' },
  { type: 'ACCOUNT_SECURITY', title: 'Security alert', message: 'A new login was detected on your account.' },
]

/**
 * Seeds Notification and optional PushToken.
 * Creates one notification per type for comprehensive coverage.
 */
export async function seedNotification(prisma: PrismaClient): Promise<void> {
  console.log('\n   Seeding Notification, PushToken...')

  const users = await prisma.user.findMany({ take: 20, select: { id: true } })
  if (users.length < 2) {
    console.warn('   Not enough users for notification seed, skipping')
    return
  }

  const shuffled = shuffleArray(users)
  let notificationsCreated = 0
  let pushTokensCreated = 0

  // Create one notification per template type — ensures every type is represented
  for (let i = 0; i < NOTIFICATION_TEMPLATES.length; i++) {
    const user = shuffled[i % shuffled.length]
    if (!user) continue
    const template = NOTIFICATION_TEMPLATES[i]
    const read = i % 3 === 0

    await prisma.notification.create({
      data: {
        userId: user.id,
        type: template.type,
        title: template.title,
        message: template.message,
        read,
        readAt: read ? new Date(Date.now() - getRandomInt(1, 48) * 60 * 60 * 1000) : null,
      },
    }).catch(() => {})
    notificationsCreated++
  }

  // Optional: PushToken for first 2 users (iOS + Android)
  const deviceTypes: Array<'IOS' | 'ANDROID'> = ['IOS', 'ANDROID']
  for (let i = 0; i < Math.min(2, users.length); i++) {
    const user = users[i]
    if (!user) continue
    const existingToken = await prisma.pushToken.findFirst({
      where: { userId: user.id },
    })
    if (!existingToken) {
      await prisma.pushToken.create({
        data: {
          userId: user.id,
          token: `seed_push_token_${user.id.replace(/-/g, '').substring(0, 20)}`,
          deviceType: deviceTypes[i % 2],
          isActive: true,
        },
      }).catch(() => {})
      pushTokensCreated++
    }
  }

  console.log(`   Created ${notificationsCreated} Notification (${NOTIFICATION_TEMPLATES.length} types), ${pushTokensCreated} PushToken`)
}
