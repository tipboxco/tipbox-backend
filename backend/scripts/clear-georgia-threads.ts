import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import logger from '../src/infrastructure/logger/logger';

const GEORGIA_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';

async function clearGeorgiaThreads() {
  const prisma = getPrisma();

  try {
    logger.info(`🧹 Georgia (${GEORGIA_USER_ID}) kullanıcısına ait tüm mesajlar ve ilişkili veriler temizleniyor...`);

    // 1. Georgia'ya ait tüm thread'leri bul
    const georgiaThreads = await prisma.dMThread.findMany({
      where: {
        OR: [
          { userOneId: GEORGIA_USER_ID },
          { userTwoId: GEORGIA_USER_ID },
        ],
      },
    });

    logger.info(`📋 ${georgiaThreads.length} thread bulundu`);

    const threadIds = georgiaThreads.length > 0 ? georgiaThreads.map(t => t.id) : [];
    
    if (threadIds.length > 0) {
      logger.info(`Thread ID'leri: ${threadIds.join(', ')}`);

      // 2. Mesaj reaksiyonlarını sil (mesajlardan önce)
      const georgiaMessages = await prisma.dMMessage.findMany({
        where: {
          threadId: { in: threadIds },
        },
        select: { id: true },
      });
      const messageIds = georgiaMessages.map(m => m.id);

      if (messageIds.length > 0) {
        // MessageReaction sil
        const deletedReactions = await prisma.messageReaction.deleteMany({
          where: {
            messageId: { in: messageIds },
          },
        });
        logger.info(`✅ ${deletedReactions.count} mesaj reaksiyonu silindi`);

        // MessageReadReceipt sil
        const deletedReadReceipts = await prisma.messageReadReceipt.deleteMany({
          where: {
            messageId: { in: messageIds },
          },
        });
        logger.info(`✅ ${deletedReadReceipts.count} okundu bilgisi silindi`);
      }

      // 3. Bu thread'lerdeki tüm mesajları sil
      const deletedMessages = await prisma.dMMessage.deleteMany({
        where: {
          threadId: { in: threadIds },
        },
      });
      logger.info(`✅ ${deletedMessages.count} mesaj silindi`);

      // 4. Support session'ları sil
      const deletedSessions = await prisma.dMSupportSession.deleteMany({
        where: {
          threadId: { in: threadIds },
        },
      });
      logger.info(`✅ ${deletedSessions.count} support session silindi`);

      // 5. Thread'leri sil
      const deletedThreads = await prisma.dMThread.deleteMany({
        where: {
          id: { in: threadIds },
        },
      });
      logger.info(`✅ ${deletedThreads.count} thread silindi`);
    }

    // 6. Georgia'ya ait tüm support request'leri bul ve sil
    const georgiaRequests = await prisma.dMRequest.findMany({
      where: {
        OR: [
          { fromUserId: GEORGIA_USER_ID },
          { toUserId: GEORGIA_USER_ID },
        ],
      },
    });

    logger.info(`📋 ${georgiaRequests.length} support request bulundu`);

    if (georgiaRequests.length > 0) {
      const requestIds = georgiaRequests.map(r => r.id);

      // Support request report'ları sil
      const deletedReports = await prisma.supportRequestReport.deleteMany({
        where: {
          requestId: { in: requestIds },
        },
      });
      logger.info(`✅ ${deletedReports.count} support request report silindi`);

      // Support request'leri sil
      const deletedRequests = await prisma.dMRequest.deleteMany({
        where: {
          id: { in: requestIds },
        },
      });
      logger.info(`✅ ${deletedRequests.count} support request silindi`);
    }

    logger.info('✅ Georgia\'ya ait tüm mesajlar ve ilişkili veriler temizlendi!');
    console.log('\n✅ Georgia\'ya ait tüm mesajlar ve ilişkili veriler temizlendi!');
    if (threadIds.length > 0) {
      console.log(`   - ${threadIds.length} thread`);
      const messageCount = await prisma.dMMessage.count({
        where: {
          threadId: { in: threadIds },
        },
      });
      console.log(`   - ${messageCount} mesaj (kalan)`);
    }
    console.log(`   - ${georgiaRequests.length} support request`);
  } catch (error) {
    logger.error('❌ Georgia mesajları temizlenirken hata oluştu:', error);
    console.error('❌ Georgia mesajları temizlenirken hata oluştu:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  clearGeorgiaThreads()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { clearGeorgiaThreads };
