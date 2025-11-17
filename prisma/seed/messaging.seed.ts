
import { prisma, TEST_USER_ID, TARGET_USER_ID, TRUST_USER_IDS } from './types';

type ThreadSeed = {
  userOneId: string;
  userTwoId: string;
  unreadCountUserOne: number;
  unreadCountUserTwo: number;
  messages: Array<{
    senderId: string;
    message: string;
    minutesAgo: number;
    isRead: boolean;
  }>;
};

const THREAD_SEEDS: ThreadSeed[] = [
  {
    userOneId: TEST_USER_ID,
    userTwoId: TARGET_USER_ID,
    unreadCountUserOne: 1,
    unreadCountUserTwo: 0,
    messages: [
      {
        senderId: TEST_USER_ID,
        message: 'Selam! Yeni ürün incelemesini gördün mü?',
        minutesAgo: 30,
        isRead: true,
      },
      {
        senderId: TARGET_USER_ID,
        message: 'Evet, mükemmel olmuş. Birkaç önerim olacak 👌',
        minutesAgo: 10,
        isRead: false,
      },
    ],
  },
  {
    userOneId: TRUST_USER_IDS[0],
    userTwoId: TEST_USER_ID,
    unreadCountUserOne: 0,
    unreadCountUserTwo: 2,
    messages: [
      {
        senderId: TRUST_USER_IDS[0],
        message: 'Merhaba! Mini destek görüşmesi için uygun musun?',
        minutesAgo: 45,
        isRead: false,
      },
      {
        senderId: TRUST_USER_IDS[0],
        message: 'Bu arada geçen hafta gönderdiğim TIPS için teşekkür ederim.',
        minutesAgo: 40,
        isRead: false,
      },
      {
        senderId: TEST_USER_ID,
        message: 'Ben de teşekkür ederim, çok yardımcı oldun 🙏',
        minutesAgo: 5,
        isRead: true,
      },
    ],
  },
];

const SUPPORT_REQUEST_SEEDS = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    fromUserId: TARGET_USER_ID,
    toUserId: TEST_USER_ID,
    description: 'Beta paneldeki yeni metrikler için rehberlik rica ediyorum.',
    status: 'PENDING' as const,
    type: 'GENERAL' as const,
    amount: 50,
    minutesAgo: 60,
  },
];

const TIPS_TRANSFER_SEEDS = [
  {
    id: '00000000-0000-4000-8000-000000000201',
    fromUserId: TEST_USER_ID,
    toUserId: TARGET_USER_ID,
    amount: 25,
    reason: 'Geçen destek oturumu için teşekkürler!',
    minutesAgo: 15,
  },
];

const PRIMARY_THREAD_KEY = `${TEST_USER_ID}:${TARGET_USER_ID}`;

const SUPPORT_SESSION_SEEDS = [
  {
    id: '00000000-0000-4000-8000-000000000301',
    threadKey: PRIMARY_THREAD_KEY,
    helperId: TEST_USER_ID,
    tipsAmount: 1400,
    minutesAgo: 12,
  },
];

function minutesAgoToDate(minutesAgo: number): Date {
  return new Date(Date.now() - minutesAgo * 60 * 1000);
}

export type MessagingSeedStats = {
  threads: number;
  messages: number;
  supportRequests: number;
  tipsTransfers: number;
  supportSessions: number;
};

export async function seedMessaging(existingClient?: typeof prisma): Promise<MessagingSeedStats> {
  const client = existingClient ?? prisma;
  console.log('💬 Messaging seed started...');
  let insertedMessages = 0;
  const threadMap = new Map<string, string>();

  for (const threadSeed of THREAD_SEEDS) {
    const thread = await client.dMThread.upsert({
      where: {
        userOneId_userTwoId: {
          userOneId: threadSeed.userOneId,
          userTwoId: threadSeed.userTwoId,
        },
      },
      update: {
        unreadCountUserOne: threadSeed.unreadCountUserOne,
        unreadCountUserTwo: threadSeed.unreadCountUserTwo,
        updatedAt: new Date(),
      },
      create: {
        userOneId: threadSeed.userOneId,
        userTwoId: threadSeed.userTwoId,
        isActive: true,
        unreadCountUserOne: threadSeed.unreadCountUserOne,
        unreadCountUserTwo: threadSeed.unreadCountUserTwo,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    threadMap.set(`${threadSeed.userOneId}:${threadSeed.userTwoId}`, thread.id);

    await client.dMMessage.deleteMany({ where: { threadId: thread.id } });

    if (threadSeed.messages.length > 0) {
      const data = threadSeed.messages.map((msg) => ({
        threadId: thread.id,
        senderId: msg.senderId,
        message: msg.message,
        isRead: msg.isRead,
        sentAt: minutesAgoToDate(msg.minutesAgo),
      }));
      
      const batchResult = await client.dMMessage.createMany({ data } as any);
      insertedMessages += batchResult.count;
    }
  }

  for (const supportRequest of SUPPORT_REQUEST_SEEDS) {
    await client.dMRequest.upsert({
      where: {
        fromUserId_toUserId: {
          fromUserId: supportRequest.fromUserId,
          toUserId: supportRequest.toUserId,
        },
      },
      update: {
        description: supportRequest.description,
        status: supportRequest.status,
        type: supportRequest.type,
        amount: supportRequest.amount,
        sentAt: minutesAgoToDate(supportRequest.minutesAgo),
      },
      create: {
        id: supportRequest.id,
        fromUserId: supportRequest.fromUserId,
        toUserId: supportRequest.toUserId,
        description: supportRequest.description,
        status: supportRequest.status,
        type: supportRequest.type,
        amount: supportRequest.amount,
        sentAt: minutesAgoToDate(supportRequest.minutesAgo),
      },
    });
  }

  for (const transfer of TIPS_TRANSFER_SEEDS) {
    await client.tipsTokenTransfer.upsert({
      where: { id: transfer.id },
      update: {
        amount: transfer.amount,
        reason: transfer.reason,
        updatedAt: new Date(),
      },
      create: {
        id: transfer.id,
        fromUserId: transfer.fromUserId,
        toUserId: transfer.toUserId,
        amount: transfer.amount,
        reason: transfer.reason,
        createdAt: minutesAgoToDate(transfer.minutesAgo),
        updatedAt: minutesAgoToDate(transfer.minutesAgo),
      },
    });
  }

  let tipsMessageInserted = 0;
  const primaryThreadId = threadMap.get(PRIMARY_THREAD_KEY);
  if (primaryThreadId) {
    tipsMessageInserted = await client.dMMessage
      .create({
        data: {
          threadId: primaryThreadId,
          senderId: TEST_USER_ID,
          message: `Sent ${TIPS_TRANSFER_SEEDS[0].amount} TIPS: ${TIPS_TRANSFER_SEEDS[0].reason}`,
          isRead: false,
          sentAt: minutesAgoToDate(TIPS_TRANSFER_SEEDS[0].minutesAgo - 1),
        },
      } as any)
      .then(() => 1)
      .catch(() => 0);
  } else {
    console.warn('⚠️  Primary messaging thread not found, skipping TIPS message seed.');
  }

  insertedMessages += tipsMessageInserted;

  // Remove old sessions for seeded threads
  const seededThreadIds = Array.from(threadMap.values());
  if (seededThreadIds.length) {
    await client.dMSupportSession.deleteMany({
      where: { threadId: { in: seededThreadIds } },
    });
  }

  let supportSessionsInserted = 0;
  for (const session of SUPPORT_SESSION_SEEDS) {
    const threadId = threadMap.get(session.threadKey);
    if (!threadId) continue;

    await client.dMSupportSession.upsert({
      where: { id: session.id },
      update: {
        threadId,
        helperId: session.helperId,
        tipsAmount: session.tipsAmount,
        supportedAt: minutesAgoToDate(session.minutesAgo),
        updatedAt: new Date(),
      },
      create: {
        id: session.id,
        threadId,
        helperId: session.helperId,
        tipsAmount: session.tipsAmount,
        supportedAt: minutesAgoToDate(session.minutesAgo),
        createdAt: minutesAgoToDate(session.minutesAgo),
        updatedAt: minutesAgoToDate(session.minutesAgo),
      },
    });
    supportSessionsInserted += 1;
  }

  console.log('✅ Messaging seed completed');
  return {
    threads: THREAD_SEEDS.length,
    messages: insertedMessages,
    supportRequests: SUPPORT_REQUEST_SEEDS.length,
    tipsTransfers: TIPS_TRANSFER_SEEDS.length,
    supportSessions: supportSessionsInserted,
  };
}

if (require.main === module) {
  seedMessaging()
    .then((stats) => {
      console.log('📨 Messaging seed stats:', stats);
    })
    .catch((e) => {
      console.error('❌ Messaging seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

