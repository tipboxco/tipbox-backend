
import { prisma, TEST_USER_ID, TARGET_USER_ID, TRUST_USER_IDS, TRUSTER_USER_IDS } from './types';
import { seedDMThreads } from './dmthread.seed';
import { seedDMRequests } from './dmrequest.seed';
import { seedMessageReactionsAndReadReceipts } from './helpers/seed-message-engagement';

// Julia user ID (from user.seed.ts)
const JULIA_USER_ID = '99999999-9999-4999-9999-999999999999';

// Gerçek kullanıcılar arasında TIPS transfer'leri
const TIPS_TRANSFER_SEEDS = [
  {
    id: '00000000-0000-4000-8000-000000000201',
    fromUserId: TEST_USER_ID,
    toUserId: TARGET_USER_ID,
    amount: 25,
    reason: 'Geçen destek oturumu için teşekkürler!',
    minutesAgo: 15,
  },
  {
    id: '00000000-0000-4000-8000-000000000202',
    fromUserId: TRUST_USER_IDS[0],
    toUserId: TEST_USER_ID,
    amount: 50,
    reason: 'Yardımın için teşekkürler!',
    minutesAgo: 20,
  },
  {
    id: '00000000-0000-4000-8000-000000000203',
    fromUserId: TEST_USER_ID,
    toUserId: TRUST_USER_IDS[1],
    amount: 30,
    reason: 'Ürün önerisi için teşekkürler',
    minutesAgo: 40,
  },
  {
    id: '00000000-0000-4000-8000-000000000204',
    fromUserId: TRUSTER_USER_IDS[0],
    toUserId: TEST_USER_ID,
    amount: 75,
    reason: 'Danışmanlık için teşekkürler',
    minutesAgo: 50,
  },
  {
    id: '00000000-0000-4000-8000-000000000205',
    fromUserId: TEST_USER_ID,
    toUserId: JULIA_USER_ID,
    amount: 100,
    reason: 'Great collaboration!',
    minutesAgo: 25,
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
  messageReactions: number;
  messageReadReceipts: number;
};

export async function seedMessaging(existingClient?: typeof prisma): Promise<MessagingSeedStats> {
  const client = existingClient ?? prisma;
  console.log('💬 Messaging seed started...');

  // Seed DM threads (normal DM threads)
  const threadStats = await seedDMThreads(client);
  
  // Seed DM requests (support requests + support threads)
  const requestStats = await seedDMRequests(client);

  // Seed reactions + read receipts for seeded threads only
  const engagement = await seedMessageReactionsAndReadReceipts({
    client,
    threadIds: [...threadStats.threadIds, ...requestStats.supportThreadIds],
  });
  
  // Get thread map for TIPS and support sessions
  const threadMap = new Map<string, string>();
  const normalThreads = await client.dMThread.findMany({
    where: { isSupportThread: false },
    select: { id: true, userOneId: true, userTwoId: true },
  });
  
  for (const thread of normalThreads) {
    const key1 = `${thread.userOneId}:${thread.userTwoId}`;
    const key2 = `${thread.userTwoId}:${thread.userOneId}`;
    threadMap.set(key1, thread.id);
    threadMap.set(key2, thread.id);
  }

  // Create TIPS transfers
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

  // Create TIPS message in primary thread
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
          context: 'DM',
          sentAt: minutesAgoToDate(TIPS_TRANSFER_SEEDS[0].minutesAgo - 1),
        },
      })
      .then(() => 1)
      .catch(() => 0);
  } else {
    console.warn('⚠️  Primary messaging thread not found, skipping TIPS message seed.');
  }

  // Remove old sessions for seeded threads
  const seededThreadIds = Array.from(threadMap.values());
  if (seededThreadIds.length) {
    await client.dMSupportSession.deleteMany({
      where: { threadId: { in: seededThreadIds } },
    });
  }

  // Create support sessions
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
    threads: threadStats.threads + requestStats.supportThreads, // Normal threads + support threads
    messages: threadStats.messages + requestStats.supportMessages + tipsMessageInserted,
    supportRequests: requestStats.supportRequests,
    tipsTransfers: TIPS_TRANSFER_SEEDS.length,
    supportSessions: supportSessionsInserted,
    messageReactions: engagement.reactionsCreated,
    messageReadReceipts: engagement.receiptsCreated,
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
