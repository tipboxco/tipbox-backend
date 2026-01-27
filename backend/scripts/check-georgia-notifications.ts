import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import logger from '../src/infrastructure/logger/logger';

const GEORGIA_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';

async function checkGeorgiaNotifications() {
  const prisma = getPrisma();

  try {
    logger.info(`📬 Georgia (${GEORGIA_ID}) kullanıcısının bildirimleri kontrol ediliyor...`);

    const notifications = await prisma.notification.findMany({
      where: { userId: GEORGIA_ID },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        user: {
          include: {
            profile: true,
            avatars: { take: 1, orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });

    console.log(`\n📬 Toplam ${notifications.length} bildirim bulundu:\n`);

    for (const n of notifications) {
      console.log(`ID: ${n.id}`);
      console.log(`Type: ${n.type}`);
      console.log(`Title: ${n.title}`);
      console.log(`Message: ${n.message}`);
      console.log(`IsRead: ${n.isRead}`);
      console.log(`Data: ${JSON.stringify(n.data, null, 2)}`);
      console.log(`CreatedAt: ${n.createdAt.toISOString()}`);
      console.log('---\n');
    }

    // Support request ile ilgili bildirimleri filtrele
    const supportNotifications = notifications.filter(
      n => n.type === 'DM_REQUEST_ACCEPTED' || n.type === 'DM_REQUEST_RECEIVED' || n.type === 'NEW_MESSAGE'
    );

    console.log(`\n🔍 Support Request ile ilgili bildirimler: ${supportNotifications.length}\n`);
    
    for (const n of supportNotifications) {
      console.log(`Type: ${n.type}`);
      console.log(`Title: ${n.title}`);
      console.log(`Message: ${n.message}`);
      console.log(`Data: ${JSON.stringify(n.data, null, 2)}`);
      console.log('---\n');
    }

    logger.info(`✅ Bildirimler kontrol edildi`);
  } catch (error) {
    logger.error('❌ Bildirimler kontrol edilirken hata oluştu:', error);
    console.error('❌ Bildirimler kontrol edilirken hata oluştu:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  checkGeorgiaNotifications()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { checkGeorgiaNotifications };
