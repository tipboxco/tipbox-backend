
import { prisma, TEST_USER_ID, TARGET_USER_ID, TRUST_USER_IDS, TRUSTER_USER_IDS } from './types';

// Julia user ID (from user.seed.ts)
const JULIA_USER_ID = '99999999-9999-4999-9999-999999999999';

type SupportRequestSeed = {
  id: string;
  fromUserId: string;
  toUserId: string;
  description: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELED' | 'AWAITING_COMPLETION' | 'COMPLETED';
  type: 'GENERAL' | 'TECHNICAL' | 'PRODUCT';
  amount: number;
  minutesAgo: number;
  threadId: null; // Will be set after support thread creation
};

// Gerçek kullanıcılar arasında farklı status ve type'larda 1-on-1 request'ler
// Ömer (TEST_USER_ID) ile diğer gerçek kullanıcılar arasında
const SUPPORT_REQUEST_SEEDS: SupportRequestSeed[] = [
  // PENDING - General type
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
  // ACCEPTED - Technical type (support thread oluşturulacak)
  {
    id: '00000000-0000-4000-8000-000000000102',
    fromUserId: TEST_USER_ID,
    toUserId: TARGET_USER_ID,
    description: 'Smartwatch kurulumu için yardıma ihtiyacım var. Hangi modeli kullanıyorsunuz?',
    status: 'ACCEPTED',
    type: 'TECHNICAL',
    amount: 100,
    minutesAgo: 120,
    threadId: null,
  },
  // DECLINED - Product type
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
  // ACCEPTED - General type (support thread oluşturulacak)
  {
    id: '00000000-0000-4000-8000-000000000104',
    fromUserId: TRUST_USER_IDS[1],
    toUserId: TEST_USER_ID,
    description: 'Yazılım geliştirme konusunda danışmanlık almak istiyorum.',
    status: 'ACCEPTED',
    type: 'GENERAL',
    amount: 150,
    minutesAgo: 90,
    threadId: null,
  },
  // CANCELED - Technical type
  {
    id: '00000000-0000-4000-8000-000000000105',
    fromUserId: TEST_USER_ID,
    toUserId: TRUST_USER_IDS[2],
    description: 'Kamera ayarları konusunda yardım istiyordum ama artık gerek yok.',
    status: 'CANCELED',
    type: 'TECHNICAL',
    amount: 80,
    minutesAgo: 200,
    threadId: null,
  },
  // AWAITING_COMPLETION - Product type (support thread oluşturulacak)
  {
    id: '00000000-0000-4000-8000-000000000106',
    fromUserId: TRUST_USER_IDS[3],
    toUserId: TEST_USER_ID,
    description: 'Yeni telefon modeli hakkında detaylı bilgi almak istiyorum.',
    status: 'AWAITING_COMPLETION',
    type: 'PRODUCT',
    amount: 120,
    minutesAgo: 45,
    threadId: null,
  },
  // COMPLETED - General type (support thread oluşturulacak)
  {
    id: '00000000-0000-4000-8000-000000000107',
    fromUserId: TRUSTER_USER_IDS[0],
    toUserId: TEST_USER_ID,
    description: 'Ürün karşılaştırması konusunda danışmanlık aldım, çok faydalı oldu.',
    status: 'COMPLETED',
    type: 'GENERAL',
    amount: 200,
    minutesAgo: 300,
    threadId: null,
  },
  // PENDING - Product type
  {
    id: '00000000-0000-4000-8000-000000000108',
    fromUserId: TEST_USER_ID,
    toUserId: TRUST_USER_IDS[4],
    description: 'Yeni bir ürün almayı düşünüyorum, önerin var mı?',
    status: 'PENDING',
    type: 'PRODUCT',
    amount: 60,
    minutesAgo: 15,
    threadId: null,
  },
  // ACCEPTED - Technical type (support thread oluşturulacak)
  {
    id: '00000000-0000-4000-8000-000000000109',
    fromUserId: TRUSTER_USER_IDS[1],
    toUserId: TEST_USER_ID,
    description: 'Bilgisayar performans optimizasyonu konusunda yardıma ihtiyacım var.',
    status: 'ACCEPTED',
    type: 'TECHNICAL',
    amount: 180,
    minutesAgo: 70,
    threadId: null,
  },
  // DECLINED - General type
  {
    id: '00000000-0000-4000-8000-000000000110',
    fromUserId: TEST_USER_ID,
    toUserId: TRUSTER_USER_IDS[2],
    description: 'Genel bir soru sormak istiyordum.',
    status: 'DECLINED',
    type: 'GENERAL',
    amount: 40,
    minutesAgo: 250,
    threadId: null,
  },
  // PENDING - Technical type
  {
    id: '00000000-0000-4000-8000-000000000111',
    fromUserId: JULIA_USER_ID,
    toUserId: TEST_USER_ID,
    description: 'I need help with setting up a new device. Can you assist?',
    status: 'PENDING',
    type: 'TECHNICAL',
    amount: 90,
    minutesAgo: 30,
    threadId: null,
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
    
    // If status is ACCEPTED, AWAITING_COMPLETION, or COMPLETED, create a support thread
    const shouldCreateSupportThread = 
      supportRequest.status === 'ACCEPTED' || 
      supportRequest.status === 'AWAITING_COMPLETION' || 
      supportRequest.status === 'COMPLETED';
    
    if (shouldCreateSupportThread) {
      const supportThread = await client.dMThread.create({
        data: {
          userOneId: supportRequest.fromUserId,
          userTwoId: supportRequest.toUserId,
          isActive: true,
          isSupportThread: true, // Support thread
          startedAt: minutesAgoToDate(supportRequest.minutesAgo),
          createdAt: minutesAgoToDate(supportRequest.minutesAgo),
          updatedAt: minutesAgoToDate(supportRequest.minutesAgo),
        },
      });
      threadId = supportThread.id;
      supportThreadsCount++;
      
      // Create support chat messages in the support thread
      const messages: Array<{
        threadId: string;
        senderId: string;
        message: string;
        isRead: boolean;
        context: 'SUPPORT';
        sentAt: Date;
      }> = [
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
      ];

      // Add more messages based on status
      if (supportRequest.status === 'ACCEPTED') {
        messages.push({
          threadId: supportThread.id,
          senderId: supportRequest.fromUserId,
          message: 'Teşekkür ederim, detayları paylaşayım...',
          isRead: true,
          context: 'SUPPORT',
          sentAt: minutesAgoToDate(supportRequest.minutesAgo - 3),
        });
      } else if (supportRequest.status === 'AWAITING_COMPLETION') {
        messages.push(
          {
            threadId: supportThread.id,
            senderId: supportRequest.fromUserId,
            message: 'Teşekkür ederim, detayları paylaşayım...',
            isRead: true,
            context: 'SUPPORT',
            sentAt: minutesAgoToDate(supportRequest.minutesAgo - 3),
          },
          {
            threadId: supportThread.id,
            senderId: supportRequest.toUserId,
            message: 'Anladım, şimdi çözümü uygulayalım.',
            isRead: true,
            context: 'SUPPORT',
            sentAt: minutesAgoToDate(supportRequest.minutesAgo - 2),
          }
        );
      } else if (supportRequest.status === 'COMPLETED') {
        messages.push(
          {
            threadId: supportThread.id,
            senderId: supportRequest.fromUserId,
            message: 'Teşekkür ederim, detayları paylaşayım...',
            isRead: true,
            context: 'SUPPORT',
            sentAt: minutesAgoToDate(supportRequest.minutesAgo - 3),
          },
          {
            threadId: supportThread.id,
            senderId: supportRequest.toUserId,
            message: 'Rica ederim, başka bir konuda yardımcı olabilir miyim?',
            isRead: true,
            context: 'SUPPORT',
            sentAt: minutesAgoToDate(supportRequest.minutesAgo - 2),
          },
          {
            threadId: supportThread.id,
            senderId: supportRequest.fromUserId,
            message: 'Hayır teşekkürler, her şey tamamlandı!',
            isRead: true,
            context: 'SUPPORT',
            sentAt: minutesAgoToDate(supportRequest.minutesAgo - 1),
          }
        );
      }
      
      const supportMessages = await client.dMMessage.createMany({
        data: messages,
      });
      supportMessagesCount += supportMessages.count;
    }
    
    // Create the support request
    await client.dMRequest.create({
      data: {
        id: supportRequest.id,
        fromUserId: supportRequest.fromUserId,
        toUserId: supportRequest.toUserId,
        description: supportRequest.description,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: supportRequest.status as any,
        type: supportRequest.type,
        amount: supportRequest.amount,
        threadId: threadId,
        sentAt: minutesAgoToDate(supportRequest.minutesAgo),
        respondedAt: supportRequest.status !== 'PENDING' && supportRequest.status !== 'CANCELED' 
          ? minutesAgoToDate(supportRequest.minutesAgo - 10) 
          : null,
        createdAt: minutesAgoToDate(supportRequest.minutesAgo),
        updatedAt: minutesAgoToDate(supportRequest.minutesAgo),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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



