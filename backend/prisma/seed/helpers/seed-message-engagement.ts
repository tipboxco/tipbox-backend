import { PrismaClient } from '@prisma/client'

const EMOJI_POOL = ['👍', '❤️', '🔥', '😂', '🙏', '🎉', '😮', '👏'] as const

function stableHash(input: string): number {
  // DJB2 (stable, fast)
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i)
  }
  return Math.abs(hash) >>> 0
}

function minutesAfter(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

export type MessageEngagementSeedStats = {
  messagesConsidered: number
  receiptsCreated: number
  reactionsCreated: number
}

export async function seedMessageReactionsAndReadReceipts(params: {
  client: PrismaClient
  threadIds: string[]
  maxMessages?: number
}): Promise<MessageEngagementSeedStats> {
  const { client, threadIds, maxMessages = 800 } = params

  if (!threadIds.length) {
    return { messagesConsidered: 0, receiptsCreated: 0, reactionsCreated: 0 }
  }

  const threads = await client.dMThread.findMany({
    where: { id: { in: threadIds } },
    select: { id: true, userOneId: true, userTwoId: true },
  })

  const threadById = new Map(threads.map((t) => [t.id, t] as const))

  const messages = await client.dMMessage.findMany({
    where: { threadId: { in: threadIds } },
    select: { id: true, threadId: true, senderId: true, sentAt: true, isRead: true },
    orderBy: { sentAt: 'desc' },
    take: maxMessages,
  })

  const receiptsData: Array<{ messageId: string; userId: string; readAt: Date }> = []
  const reactionsData: Array<{ messageId: string; userId: string; emoji: string; createdAt: Date }> = []

  for (const m of messages) {
    const thread = threadById.get(m.threadId)
    if (!thread) continue

    const receiverId =
      m.senderId === thread.userOneId
        ? thread.userTwoId
        : m.senderId === thread.userTwoId
          ? thread.userOneId
          : null

    if (!receiverId) continue

    const h = stableHash(m.id)

    // Read receipt: only for read messages, deterministic offset 1-9 minutes
    if (m.isRead) {
      receiptsData.push({
        messageId: m.id,
        userId: receiverId,
        readAt: minutesAfter(m.sentAt, (h % 9) + 1),
      })
    }

    // Reaction: around ~25% of messages, deterministic
    if (h % 4 === 0) {
      const emoji = EMOJI_POOL[h % EMOJI_POOL.length]
      reactionsData.push({
        messageId: m.id,
        userId: receiverId,
        emoji,
        createdAt: minutesAfter(m.sentAt, (h % 6) + 1),
      })
    }
  }

  const [receiptsResult, reactionsResult] = await Promise.all([
    receiptsData.length
      ? client.messageReadReceipt.createMany({ data: receiptsData, skipDuplicates: true })
      : Promise.resolve({ count: 0 }),
    reactionsData.length
      ? client.messageReaction.createMany({ data: reactionsData, skipDuplicates: true })
      : Promise.resolve({ count: 0 }),
  ])

  return {
    messagesConsidered: messages.length,
    receiptsCreated: receiptsResult.count,
    reactionsCreated: reactionsResult.count,
  }
}

