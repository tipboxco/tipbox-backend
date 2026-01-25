import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import logger from '../src/infrastructure/logger/logger';

const GEORGIA_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';

async function clearGeorgiaNotifications() {
  const prisma = getPrisma();

  try {
    logger.info(`🧹 Georgia (${GEORGIA_ID}) kullanıcısının tüm bildirimleri siliniyor...`);

    const deleted = await prisma.notification.deleteMany({
      where: { userId: GEORGIA_ID },
    });

    logger.info(`✅ ${deleted.count} bildirim silindi`);
    console.log(`\n✅ ${deleted.count} bildirim silindi`);
  } catch (error) {
    logger.error('❌ Bildirimler silinirken hata oluştu:', error);
    console.error('❌ Bildirimler silinirken hata oluştu:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  clearGeorgiaNotifications()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { clearGeorgiaNotifications };
