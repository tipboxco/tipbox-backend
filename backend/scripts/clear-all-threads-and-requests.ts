import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import logger from '../src/infrastructure/logger/logger';

async function clearAllThreadsAndRequests() {
  const prisma = getPrisma();

  try {
    logger.info('🧹 Tüm thread\'leri ve support request\'leri temizleniyor...');

    // Önce mesajları sil (foreign key constraint)
    const deletedMessages = await prisma.dMMessage.deleteMany({});
    logger.info(`✅ ${deletedMessages.count} mesaj silindi`);

    // Support session'ları sil
    const deletedSessions = await prisma.dMSupportSession.deleteMany({});
    logger.info(`✅ ${deletedSessions.count} support session silindi`);

    // Support request report'ları sil
    const deletedReports = await prisma.supportRequestReport.deleteMany({});
    logger.info(`✅ ${deletedReports.count} support request report silindi`);

    // DM Request'leri sil (support request'ler dahil)
    const deletedRequests = await prisma.dMRequest.deleteMany({});
    logger.info(`✅ ${deletedRequests.count} DM request silindi`);

    // Thread'leri sil (hem DM hem support thread'ler)
    const deletedThreads = await prisma.dMThread.deleteMany({});
    logger.info(`✅ ${deletedThreads.count} thread silindi`);

    logger.info('✅ Tüm thread\'ler ve support request\'ler temizlendi!');
    console.log('\n✅ Tüm thread\'ler ve support request\'ler temizlendi!');
    console.log(`   - ${deletedMessages.count} mesaj`);
    console.log(`   - ${deletedSessions.count} support session`);
    console.log(`   - ${deletedReports.count} support request report`);
    console.log(`   - ${deletedRequests.count} DM request`);
    console.log(`   - ${deletedThreads.count} thread`);
  } catch (error) {
    logger.error('❌ Thread ve request temizlenirken hata oluştu:', error);
    console.error('❌ Thread ve request temizlenirken hata oluştu:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  clearAllThreadsAndRequests()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { clearAllThreadsAndRequests };
