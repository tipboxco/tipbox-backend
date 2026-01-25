import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import logger from '../src/infrastructure/logger/logger';

const GEORGIA_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';

async function deleteGeorgiaThreadsComplete() {
  const prisma = getPrisma();

  try {
    console.log('\n' + '═'.repeat(60));
    console.log('  Georgia Kullanıcısına Ait Tüm Thread\'leri Silme');
    console.log('═'.repeat(60));
    console.log(`  User ID: ${GEORGIA_USER_ID}\n`);

    logger.info(`🗑️  Georgia (${GEORGIA_USER_ID}) kullanıcısına ait tüm thread'ler siliniyor...`);

    // 1. Georgia'ya ait tüm thread'leri bul
    const georgiaThreads = await prisma.dMThread.findMany({
      where: {
        OR: [
          { userOneId: GEORGIA_USER_ID },
          { userTwoId: GEORGIA_USER_ID },
        ],
      },
      select: {
        id: true,
        userOneId: true,
        userTwoId: true,
        isActive: true,
      },
    });

    console.log(`📋 ${georgiaThreads.length} thread bulundu\n`);

    // Değişkenleri başlat
    let deletedReactions = { count: 0 };
    let deletedReadReceipts = { count: 0 };
    let deletedMessages = { count: 0 };
    let deletedSessions = { count: 0 };
    let deletedThreads = { count: 0 };
    let messageIds: string[] = [];

    if (georgiaThreads.length > 0) {
      const threadIds = georgiaThreads.map(t => t.id);
      
      console.log('Thread ID\'leri:');
      georgiaThreads.forEach((thread, index) => {
        console.log(`  ${index + 1}. ${thread.id} (userOne: ${thread.userOneId}, userTwo: ${thread.userTwoId}, isActive: ${thread.isActive})`);
      });
      console.log('');

      // 2. Thread'lerdeki tüm mesajları bul
      const allMessages = await prisma.dMMessage.findMany({
        where: {
          threadId: { in: threadIds },
        },
        select: { id: true },
      });
      messageIds = allMessages.map(m => m.id);

      console.log(`📨 ${messageIds.length} mesaj bulundu\n`);

      // 3. Mesajlara bağlı tüm ilişkili verileri sil
      if (messageIds.length > 0) {
        // MessageReaction sil
        deletedReactions = await prisma.messageReaction.deleteMany({
          where: {
            messageId: { in: messageIds },
          },
        });
        console.log(`✅ ${deletedReactions.count} mesaj reaksiyonu silindi`);

        // MessageReadReceipt sil
        deletedReadReceipts = await prisma.messageReadReceipt.deleteMany({
          where: {
            messageId: { in: messageIds },
          },
        });
        console.log(`✅ ${deletedReadReceipts.count} okundu bilgisi silindi\n`);
      }

      // 4. Thread'lerdeki tüm mesajları sil
      if (messageIds.length > 0) {
        deletedMessages = await prisma.dMMessage.deleteMany({
          where: {
            threadId: { in: threadIds },
          },
        });
        console.log(`✅ ${deletedMessages.count} mesaj silindi\n`);
      }

      // 5. Support session'ları sil
      deletedSessions = await prisma.dMSupportSession.deleteMany({
        where: {
          threadId: { in: threadIds },
        },
      });
      if (deletedSessions.count > 0) {
        console.log(`✅ ${deletedSessions.count} support session silindi\n`);
      }

      // 6. Thread'leri TAMAMEN SİL (soft delete değil, hard delete)
      deletedThreads = await prisma.dMThread.deleteMany({
        where: {
          id: { in: threadIds },
        },
      });
      console.log(`✅ ${deletedThreads.count} thread TAMAMEN silindi (hard delete)\n`);
    } else {
      console.log('✅ Silinecek thread bulunamadı!\n');
    }

    // 7. Kontrol et - kalan thread var mı?
    const remainingThreads = await prisma.dMThread.findMany({
      where: {
        OR: [
          { userOneId: GEORGIA_USER_ID },
          { userTwoId: GEORGIA_USER_ID },
        ],
      },
      select: { id: true },
    });

    if (remainingThreads.length > 0) {
      console.log(`⚠️  UYARI: ${remainingThreads.length} thread hala mevcut!`);
      remainingThreads.forEach((thread, index) => {
        console.log(`  ${index + 1}. ${thread.id}`);
      });
      console.log('');
    } else {
      console.log('✅ Georgia\'ya ait hiç thread kalmadı!\n');
    }

    // 8. Kontrol et - kalan mesaj var mı?
    const remainingMessages = await prisma.dMMessage.count({
      where: {
        OR: [
          { senderId: GEORGIA_USER_ID },
          {
            thread: {
              OR: [
                { userOneId: GEORGIA_USER_ID },
                { userTwoId: GEORGIA_USER_ID },
              ],
            },
          },
        ],
      },
    });

    if (remainingMessages > 0) {
      console.log(`⚠️  UYARI: ${remainingMessages} mesaj hala mevcut!\n`);
    } else {
      console.log('✅ Georgia\'ya ait hiç mesaj kalmadı!\n');
    }

    // 9. Support Request'leri sil
    console.log('🆘 Support Request\'ler siliniyor...');
    
    const georgiaRequests = await prisma.dMRequest.findMany({
      where: {
        OR: [
          { fromUserId: GEORGIA_USER_ID },
          { toUserId: GEORGIA_USER_ID },
        ],
      },
      select: { id: true },
    });

    console.log(`📋 ${georgiaRequests.length} support request bulundu\n`);

    if (georgiaRequests.length > 0) {
      const requestIds = georgiaRequests.map(r => r.id);

      // Support request report'ları sil
      const deletedRequestReports = await prisma.supportRequestReport.deleteMany({
        where: {
          requestId: { in: requestIds },
        },
      });
      if (deletedRequestReports.count > 0) {
        console.log(`✅ ${deletedRequestReports.count} support request report silindi`);
      }

      // Support request'leri sil
      const deletedRequests = await prisma.dMRequest.deleteMany({
        where: {
          id: { in: requestIds },
        },
      });
      console.log(`✅ ${deletedRequests.count} support request silindi\n`);

      // Kontrol et - kalan support request var mı?
      const remainingRequests = await prisma.dMRequest.count({
        where: {
          OR: [
            { fromUserId: GEORGIA_USER_ID },
            { toUserId: GEORGIA_USER_ID },
          ],
        },
      });

      if (remainingRequests > 0) {
        console.log(`⚠️  UYARI: ${remainingRequests} support request hala mevcut!\n`);
      } else {
        console.log('✅ Georgia\'ya ait hiç support request kalmadı!\n');
      }
    } else {
      console.log('✅ Silinecek support request bulunamadı!\n');
    }

    // ============================================
    // ÖZET
    // ============================================
    // Support request sayısını hesapla
    let deletedRequestsCount = 0;
    if (georgiaRequests.length > 0) {
      const remainingAfterDelete = await prisma.dMRequest.count({
        where: {
          OR: [
            { fromUserId: GEORGIA_USER_ID },
            { toUserId: GEORGIA_USER_ID },
          ],
        },
      });
      deletedRequestsCount = georgiaRequests.length - remainingAfterDelete;
    }

    console.log('═'.repeat(60));
    console.log('  ✅ SİLME İŞLEMİ TAMAMLANDI!');
    console.log('═'.repeat(60));
    console.log(`  💬 Thread'ler: ${deletedThreads.count} silindi`);
    console.log(`  📨 Mesajlar: ${deletedMessages.count} silindi`);
    console.log(`  😀 Reaksiyonlar: ${deletedReactions.count} silindi`);
    console.log(`  👁️  Okundu Bilgileri: ${deletedReadReceipts.count} silindi`);
    console.log(`  🆘 Support Session'lar: ${deletedSessions.count} silindi`);
    if (deletedRequestsCount > 0) {
      console.log(`  🆘 Support Request'ler: ${deletedRequestsCount} silindi`);
    }
    console.log('═'.repeat(60) + '\n');

    logger.info(`✅ Georgia'ya ait ${deletedThreads.count} thread tamamen silindi!`);
  } catch (error) {
    logger.error('❌ Georgia threadleri silinirken hata oluştu:', error);
    console.error('\n❌ Georgia threadleri silinirken hata oluştu:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  deleteGeorgiaThreadsComplete()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { deleteGeorgiaThreadsComplete };
