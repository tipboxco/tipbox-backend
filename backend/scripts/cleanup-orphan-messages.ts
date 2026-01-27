import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import logger from '../src/infrastructure/logger/logger';

async function cleanupOrphanMessages() {
  const prisma = getPrisma();

  try {
    logger.info('🧹 Silinmiş thread\'lere ait orphan mesajlar temizleniyor...');

    // 1. Tüm mevcut thread'leri bul
    const allThreads = await prisma.dMThread.findMany({
      select: { id: true },
    });
    const existingThreadIds = new Set(allThreads.map(t => t.id));
    logger.info(`📋 ${existingThreadIds.size} mevcut thread bulundu`);

    // 2. Tüm mesajları bul ve threadId'leri kontrol et
    const allMessages = await prisma.dMMessage.findMany({
      select: { id: true, threadId: true },
    });
    logger.info(`📨 ${allMessages.length} toplam mesaj bulundu`);

    // 3. ThreadId'si olmayan veya mevcut olmayan thread'lere ait mesajları bul
    const orphanMessages = allMessages.filter(
      (msg) => !msg.threadId || !existingThreadIds.has(msg.threadId)
    );

    logger.info(`🔍 ${orphanMessages.length} orphan mesaj bulundu`);

    if (orphanMessages.length === 0) {
      logger.info('✅ Orphan mesaj yok, temizlik gerekmiyor');
      console.log('\n✅ Orphan mesaj yok, temizlik gerekmiyor');
      return;
    }

    const messageIds = orphanMessages.map(m => m.id);
    const orphanThreadIds = new Set(
      orphanMessages
        .map(m => m.threadId)
        .filter((id): id is string => id !== null)
    );

    logger.info(`Orphan mesajların thread ID'leri: ${Array.from(orphanThreadIds).join(', ')}`);

    // 4. Mesajlara bağlı reaksiyonları ve read receipt'leri sil
    const prismaClient = prisma as any;
    const deletedReactions = await prismaClient.messageReaction.deleteMany({
      where: {
        messageId: { in: messageIds },
      },
    });
    logger.info(`✅ ${deletedReactions.count} mesaj reaksiyonu silindi`);

    const deletedReadReceipts = await prismaClient.messageReadReceipt.deleteMany({
      where: {
        messageId: { in: messageIds },
      },
    });
    logger.info(`✅ ${deletedReadReceipts.count} okundu bilgisi silindi`);

    // 5. Orphan mesajları sil
    const deletedMessages = await prisma.dMMessage.deleteMany({
      where: {
        id: { in: messageIds },
      },
    });
    logger.info(`✅ ${deletedMessages.count} orphan mesaj silindi`);

    console.log('\n✅ Orphan mesajlar başarıyla temizlendi!');
    console.log(`   - ${orphanMessages.length} orphan mesaj`);
    console.log(`   - ${deletedMessages.count} mesaj silindi`);
    console.log(`   - ${deletedReactions.count} reaksiyon silindi`);
    console.log(`   - ${deletedReadReceipts.count} okundu bilgisi silindi`);
  } catch (error) {
    logger.error('❌ Orphan mesajlar temizlenirken hata oluştu:', error);
    console.error('❌ Orphan mesajlar temizlenirken hata oluştu:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  cleanupOrphanMessages()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { cleanupOrphanMessages };
