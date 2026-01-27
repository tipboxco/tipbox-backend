import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import logger from '../src/infrastructure/logger/logger';

const GEORGIA_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';

async function clearGeorgiaAllData() {
  const prisma = getPrisma();

  try {
    console.log('\n' + '═'.repeat(60));
    console.log('  Georgia Kullanıcısına Ait Tüm Verileri Silme');
    console.log('═'.repeat(60));
    console.log(`  User ID: ${GEORGIA_USER_ID}\n`);

    logger.info(`🧹 Georgia (${GEORGIA_USER_ID}) kullanıcısına ait tüm veriler temizleniyor...`);

    // ============================================
    // 1. BİLDİRİMLER (Notifications)
    // ============================================
    console.log('📢 Bildirimler siliniyor...');
    const deletedNotifications = await prisma.notification.deleteMany({
      where: { userId: GEORGIA_USER_ID },
    });
    logger.info(`✅ ${deletedNotifications.count} bildirim silindi`);
    console.log(`   ✅ ${deletedNotifications.count} bildirim silindi\n`);

    // ============================================
    // 2. MESAJ REAKSİYONLARI (MessageReaction)
    // ============================================
    console.log('😀 Mesaj reaksiyonları siliniyor...');
    const deletedReactions = await prisma.messageReaction.deleteMany({
      where: { userId: GEORGIA_USER_ID },
    });
    logger.info(`✅ ${deletedReactions.count} mesaj reaksiyonu silindi`);
    console.log(`   ✅ ${deletedReactions.count} mesaj reaksiyonu silindi\n`);

    // ============================================
    // 3. OKUNDU BİLGİLERİ (MessageReadReceipt)
    // ============================================
    console.log('👁️  Okundu bilgileri siliniyor...');
    const deletedReadReceipts = await prisma.messageReadReceipt.deleteMany({
      where: { userId: GEORGIA_USER_ID },
    });
    logger.info(`✅ ${deletedReadReceipts.count} okundu bilgisi silindi`);
    console.log(`   ✅ ${deletedReadReceipts.count} okundu bilgisi silindi\n`);

    // ============================================
    // 4. SUPPORT REQUEST RAPORLARI (SupportRequestReport)
    // ============================================
    console.log('📋 Support request raporları siliniyor...');
    const deletedReports = await prisma.supportRequestReport.deleteMany({
      where: { reporterId: GEORGIA_USER_ID },
    });
    logger.info(`✅ ${deletedReports.count} support request report silindi`);
    console.log(`   ✅ ${deletedReports.count} support request report silindi\n`);

    // ============================================
    // 5. THREAD'LER VE MESAJLAR
    // ============================================
    console.log('💬 Thread'ler ve mesajlar siliniyor...');
    
    // Georgia'ya ait tüm thread'leri bul
    const georgiaThreads = await prisma.dMThread.findMany({
      where: {
        OR: [
          { userOneId: GEORGIA_USER_ID },
          { userTwoId: GEORGIA_USER_ID },
        ],
      },
    });

    logger.info(`📋 ${georgiaThreads.length} thread bulundu`);
    console.log(`   📋 ${georgiaThreads.length} thread bulundu`);

    const threadIds = georgiaThreads.length > 0 ? georgiaThreads.map(t => t.id) : [];
    
    if (threadIds.length > 0) {
      // Thread'lerdeki tüm mesajları bul
      const georgiaMessages = await prisma.dMMessage.findMany({
        where: {
          threadId: { in: threadIds },
        },
        select: { id: true },
      });
      const messageIds = georgiaMessages.map(m => m.id);

      if (messageIds.length > 0) {
        // Bu mesajlara ait reaksiyonları sil (eğer kalmışsa)
        const deletedMessageReactions = await prisma.messageReaction.deleteMany({
          where: {
            messageId: { in: messageIds },
          },
        });
        if (deletedMessageReactions.count > 0) {
          logger.info(`✅ ${deletedMessageReactions.count} mesaj reaksiyonu (thread mesajlarından) silindi`);
          console.log(`   ✅ ${deletedMessageReactions.count} mesaj reaksiyonu (thread mesajlarından) silindi`);
        }

        // Bu mesajlara ait okundu bilgilerini sil (eğer kalmışsa)
        const deletedMessageReadReceipts = await prisma.messageReadReceipt.deleteMany({
          where: {
            messageId: { in: messageIds },
          },
        });
        if (deletedMessageReadReceipts.count > 0) {
          logger.info(`✅ ${deletedMessageReadReceipts.count} okundu bilgisi (thread mesajlarından) silindi`);
          console.log(`   ✅ ${deletedMessageReadReceipts.count} okundu bilgisi (thread mesajlarından) silindi`);
        }
      }

      // Thread'lerdeki tüm mesajları sil
      const deletedMessages = await prisma.dMMessage.deleteMany({
        where: {
          threadId: { in: threadIds },
        },
      });
      logger.info(`✅ ${deletedMessages.count} mesaj silindi`);
      console.log(`   ✅ ${deletedMessages.count} mesaj silindi`);

      // Support session'ları sil
      const deletedSessions = await prisma.dMSupportSession.deleteMany({
        where: {
          threadId: { in: threadIds },
        },
      });
      if (deletedSessions.count > 0) {
        logger.info(`✅ ${deletedSessions.count} support session silindi`);
        console.log(`   ✅ ${deletedSessions.count} support session silindi`);
      }

      // Thread'leri sil
      const deletedThreads = await prisma.dMThread.deleteMany({
        where: {
          id: { in: threadIds },
        },
      });
      logger.info(`✅ ${deletedThreads.count} thread silindi`);
      console.log(`   ✅ ${deletedThreads.count} thread silindi\n`);
    } else {
      console.log('   ℹ️  Silinecek thread bulunamadı\n');
    }

    // ============================================
    // 6. SUPPORT REQUEST'LER (DMRequest)
    // ============================================
    console.log('🆘 Support request'ler siliniyor...');
    
    // Georgia'ya ait tüm support request'leri bul
    const georgiaRequests = await prisma.dMRequest.findMany({
      where: {
        OR: [
          { fromUserId: GEORGIA_USER_ID },
          { toUserId: GEORGIA_USER_ID },
        ],
      },
    });

    logger.info(`📋 ${georgiaRequests.length} support request bulundu`);
    console.log(`   📋 ${georgiaRequests.length} support request bulundu`);

    if (georgiaRequests.length > 0) {
      const requestIds = georgiaRequests.map(r => r.id);

      // Support request report'ları sil (eğer kalmışsa)
      const deletedRequestReports = await prisma.supportRequestReport.deleteMany({
        where: {
          requestId: { in: requestIds },
        },
      });
      if (deletedRequestReports.count > 0) {
        logger.info(`✅ ${deletedRequestReports.count} support request report (request'lerden) silindi`);
        console.log(`   ✅ ${deletedRequestReports.count} support request report (request'lerden) silindi`);
      }

      // Support request'leri sil
      const deletedRequests = await prisma.dMRequest.deleteMany({
        where: {
          id: { in: requestIds },
        },
      });
      logger.info(`✅ ${deletedRequests.count} support request silindi`);
      console.log(`   ✅ ${deletedRequests.count} support request silindi\n`);
    } else {
      console.log('   ℹ️  Silinecek support request bulunamadı\n');
    }

    // ============================================
    // 7. TIPS TRANSFERLERİ (TipsTokenTransfer)
    // ============================================
    console.log('💰 TIPS transferleri siliniyor...');
    const deletedTipsFrom = await prisma.tipsTokenTransfer.deleteMany({
      where: { fromUserId: GEORGIA_USER_ID },
    });
    const deletedTipsTo = await prisma.tipsTokenTransfer.deleteMany({
      where: { toUserId: GEORGIA_USER_ID },
    });
    const totalTips = deletedTipsFrom.count + deletedTipsTo.count;
    logger.info(`✅ ${totalTips} TIPS transferi silindi (${deletedTipsFrom.count} gönderilen, ${deletedTipsTo.count} alınan)`);
    console.log(`   ✅ ${totalTips} TIPS transferi silindi (${deletedTipsFrom.count} gönderilen, ${deletedTipsTo.count} alınan)\n`);

    // ============================================
    // ÖZET
    // ============================================
    console.log('═'.repeat(60));
    console.log('  ✅ TÜM VERİLER TEMİZLENDİ!');
    console.log('═'.repeat(60));
    console.log(`  📢 Bildirimler: ${deletedNotifications.count}`);
    console.log(`  😀 Mesaj Reaksiyonları: ${deletedReactions.count}`);
    console.log(`  👁️  Okundu Bilgileri: ${deletedReadReceipts.count}`);
    console.log(`  📋 Support Request Raporları: ${deletedReports.count}`);
    console.log(`  💬 Thread'ler: ${threadIds.length}`);
    console.log(`  🆘 Support Request'ler: ${georgiaRequests.length}`);
    console.log(`  💰 TIPS Transferleri: ${totalTips}`);
    console.log('═'.repeat(60) + '\n');

    logger.info('✅ Georgia\'ya ait tüm veriler temizlendi!');
  } catch (error) {
    logger.error('❌ Georgia verileri temizlenirken hata oluştu:', error);
    console.error('\n❌ Georgia verileri temizlenirken hata oluştu:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  clearGeorgiaAllData()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { clearGeorgiaAllData };
