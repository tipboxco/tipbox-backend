
import { prisma, TEST_USER_ID, TARGET_USER_ID, TRUST_USER_IDS } from './types';

type SupportRequestSeed = {
  id: string;
  fromUserId: string;
  toUserId: string;
  description: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  type: 'GENERAL' | 'TECHNICAL' | 'PRODUCT';
  amount: number;
  minutesAgo: number;
  threadId: null; // Will be set after support thread creation
};

const SUPPORT_REQUEST_SEEDS: SupportRequestSeed[] = [
  // Pending request - threadId yok
  {
    id: '00000000-0000-4000-8000-000000000101',
    fromUserId: TARGET_USER_ID,
    toUserId: TEST_USER_ID,
    description: 'Beta paneldeki yeni metrikler için rehberlik rica ediyorum.',
    status: 'PENDING',
    type: 'GENERAL',
    amount: 50,
    minutesAgo: 60,
    threadId: null,
  },
  // Accepted request - threadId var, support thread oluşturulacak
  {
    id: '00000000-0000-4000-8000-000000000102',
    fromUserId: TEST_USER_ID,
    toUserId: TARGET_USER_ID,
    description: 'Smartwatch kurulumu için yardıma ihtiyacım var. Hangi modeli kullanıyorsunuz?',
    status: 'ACCEPTED',
    type: 'TECHNICAL',
    amount: 100,
    minutesAgo: 120,
    threadId: null, // Will be set after support thread creation
  },
  // Declined request - threadId yok
  {
    id: '00000000-0000-4000-8000-000000000103',
    fromUserId: TRUST_USER_IDS[0],
    toUserId: TEST_USER_ID,
    description: 'Ürün önerisi için destek istiyorum.',
    status: 'DECLINED',
    type: 'PRODUCT',
    amount: 75,
    minutesAgo: 180,
    threadId: null,
  },
  // Another accepted request - farklı kullanıcılar arasında
  {
    id: '00000000-0000-4000-8000-000000000104',
    fromUserId: TRUST_USER_IDS[1],
    toUserId: TEST_USER_ID,
    description: 'Yazılım geliştirme konusunda danışmanlık almak istiyorum.',
    status: 'ACCEPTED',
    type: 'GENERAL',
    amount: 150,
    minutesAgo: 90,
    threadId: null, // Will be set after support thread creation
  },
];

function minutesAgoToDate(minutesAgo: number): Date {
  return new Date(Date.now() - minutesAgo * 60 * 1000);
}

export type DMRequestSeedStats = {
  supportRequests: number;
  supportThreads: number;
  supportMessages: number;
};

export async function seedDMRequests(existingClient?: typeof prisma): Promise<DMRequestSeedStats> {
  const client = existingClient ?? prisma;
  console.log('💌 DM Request seed started...');
  let supportThreadsCount = 0;
  let supportMessagesCount = 0;
  const supportRequestMap = new Map<string, { requestId: string; threadId: string | null }>();
  
  for (const supportRequest of SUPPORT_REQUEST_SEEDS) {
    // Delete existing request if exists
    await client.dMRequest.deleteMany({ where: { id: supportRequest.id } });
    
    let threadId: string | null = null;
    
    // If status is ACCEPTED, create a support thread
    if (supportRequest.status === 'ACCEPTED') {
      const supportThread = await client.dMThread.create({
        data: {
          userOneId: supportRequest.fromUserId,
          userTwoId: supportRequest.toUserId,
          isActive: true,
          isSupportThread: true as any, // Support thread
          startedAt: minutesAgoToDate(supportRequest.minutesAgo),
          createdAt: minutesAgoToDate(supportRequest.minutesAgo),
          updatedAt: minutesAgoToDate(supportRequest.minutesAgo),
        } as any,
      });
      threadId = supportThread.id;
      supportThreadsCount++;
      
      // Create some support chat messages in the support thread
      const supportMessages = await client.dMMessage.createMany({
        data: [
          {
            threadId: supportThread.id,
            senderId: supportRequest.fromUserId,
            message: supportRequest.description,
            isRead: false,
            context: 'SUPPORT',
            sentAt: minutesAgoToDate(supportRequest.minutesAgo),
          },
          {
            threadId: supportThread.id,
            senderId: supportRequest.toUserId,
            message: 'Merhaba! Size nasıl yardımcı olabilirim?',
            isRead: true,
            context: 'SUPPORT',
            sentAt: minutesAgoToDate(supportRequest.minutesAgo - 5),
          },
          {
            threadId: supportThread.id,
            senderId: supportRequest.fromUserId,
            message: 'Teşekkür ederim, detayları paylaşayım...',
            isRead: true,
            context: 'SUPPORT',
            sentAt: minutesAgoToDate(supportRequest.minutesAgo - 3),
          },
        ] as any,
      });
      supportMessagesCount += supportMessages.count;
    }
    
    // Create the support request
    const createdRequest = await client.dMRequest.create({
      data: {
        id: supportRequest.id,
        fromUserId: supportRequest.fromUserId,
        toUserId: supportRequest.toUserId,
        description: supportRequest.description,
        status: supportRequest.status as any,
        type: supportRequest.type,
        amount: supportRequest.amount,
        threadId: threadId,
        sentAt: minutesAgoToDate(supportRequest.minutesAgo),
        respondedAt: supportRequest.status !== 'PENDING' ? minutesAgoToDate(supportRequest.minutesAgo - 10) : null,
        createdAt: minutesAgoToDate(supportRequest.minutesAgo),
        updatedAt: minutesAgoToDate(supportRequest.minutesAgo),
      } as any,
    });
    
    supportRequestMap.set(supportRequest.id, { requestId: supportRequest.id, threadId });
  }

  console.log('✅ DM Request seed completed');
  return {
    supportRequests: SUPPORT_REQUEST_SEEDS.length,
    supportThreads: supportThreadsCount,
    supportMessages: supportMessagesCount,
  };
}

if (require.main === module) {
  seedDMRequests()
    .then((stats) => {
      console.log('📨 DM Request seed stats:', stats);
    })
    .catch((e) => {
      console.error('❌ DM Request seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

