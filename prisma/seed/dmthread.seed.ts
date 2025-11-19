
import { prisma, TEST_USER_ID, TARGET_USER_ID, TRUST_USER_IDS } from './types';

type ThreadSeed = {
  userOneId: string;
  userTwoId: string;
  unreadCountUserOne: number;
  unreadCountUserTwo: number;
  isSupportThread: boolean;
  messages: Array<{
    senderId: string;
    message: string;
    minutesAgo: number;
    isRead: boolean;
    context?: 'DM' | 'SUPPORT';
  }>;
};

const NORMAL_DM_THREAD_SEEDS: ThreadSeed[] = [
  {
    userOneId: TEST_USER_ID,
    userTwoId: TARGET_USER_ID,
    unreadCountUserOne: 1,
    unreadCountUserTwo: 0,
    isSupportThread: false,
    messages: [
      {
        senderId: TEST_USER_ID,
        message: 'Selam! Yeni ürün incelemesini gördün mü?',
        minutesAgo: 30,
        isRead: true,
        context: 'DM',
      },
      {
        senderId: TARGET_USER_ID,
        message: 'Evet, mükemmel olmuş. Birkaç önerim olacak 👌',
        minutesAgo: 10,
        isRead: false,
        context: 'DM',
      },
    ],
  },
  {
    userOneId: TRUST_USER_IDS[0],
    userTwoId: TEST_USER_ID,
    unreadCountUserOne: 0,
    unreadCountUserTwo: 2,
    isSupportThread: false,
    messages: [
      {
        senderId: TRUST_USER_IDS[0],
        message: 'Merhaba! Mini destek görüşmesi için uygun musun?',
        minutesAgo: 45,
        isRead: false,
        context: 'DM',
      },
      {
        senderId: TRUST_USER_IDS[0],
        message: 'Bu arada geçen hafta gönderdiğim TIPS için teşekkür ederim.',
        minutesAgo: 40,
        isRead: false,
        context: 'DM',
      },
      {
        senderId: TEST_USER_ID,
        message: 'Ben de teşekkür ederim, çok yardımcı oldun 🙏',
        minutesAgo: 5,
        isRead: true,
        context: 'DM',
      },
    ],
  },
];

function minutesAgoToDate(minutesAgo: number): Date {
  return new Date(Date.now() - minutesAgo * 60 * 1000);
}

export type DMThreadSeedStats = {
  threads: number;
  messages: number;
};

export async function seedDMThreads(existingClient?: typeof prisma): Promise<DMThreadSeedStats> {
  const client = existingClient ?? prisma;
  console.log('💬 DM Thread seed started...');
  let insertedMessages = 0;
  const threadMap = new Map<string, string>();

  // Create normal DM threads (not support threads)
  for (const threadSeed of NORMAL_DM_THREAD_SEEDS) {
    // Delete existing thread and messages first
    const existingThread = await client.dMThread.findFirst({
      where: {
        userOneId: threadSeed.userOneId,
        userTwoId: threadSeed.userTwoId,
        isSupportThread: false as any, // Only normal DM threads
      } as any,
    });
    
    if (existingThread) {
      await client.dMMessage.deleteMany({ where: { threadId: existingThread.id } });
      await client.dMThread.delete({ where: { id: existingThread.id } });
    }
    
    const thread = await client.dMThread.create({
      data: {
        userOneId: threadSeed.userOneId,
        userTwoId: threadSeed.userTwoId,
        isActive: true,
        isSupportThread: false as any, // Normal DM thread
        unreadCountUserOne: threadSeed.unreadCountUserOne,
        unreadCountUserTwo: threadSeed.unreadCountUserTwo,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    });
    threadMap.set(`${threadSeed.userOneId}:${threadSeed.userTwoId}`, thread.id);

    if (threadSeed.messages.length > 0) {
      const data = threadSeed.messages.map((msg) => ({
        threadId: thread.id,
        senderId: msg.senderId,
        message: msg.message,
        isRead: msg.isRead,
        context: msg.context || 'DM',
        sentAt: minutesAgoToDate(msg.minutesAgo),
      }));
      
      const batchResult = await client.dMMessage.createMany({ data } as any);
      insertedMessages += batchResult.count;
    }
  }

  console.log('✅ DM Thread seed completed');
  return {
    threads: NORMAL_DM_THREAD_SEEDS.length,
    messages: insertedMessages,
  };
}

if (require.main === module) {
  seedDMThreads()
    .then((stats) => {
      console.log('📨 DM Thread seed stats:', stats);
    })
    .catch((e) => {
      console.error('❌ DM Thread seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

