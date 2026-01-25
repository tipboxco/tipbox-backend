import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import logger from '../src/infrastructure/logger/logger';
import { NotificationType } from '../src/domain/notification/notification-type.enum';
import { groupNotifications } from '../src/application/notification/notification-grouper';

const GEORGIA_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';

async function verifyBadgeNotificationsClean() {
  const prisma = getPrisma();

  try {
    logger.info(`🔍 Georgia (${GEORGIA_ID}) kullanıcısının NEW_BADGE bildirimleri kontrol ediliyor...`);

    const notifications = await prisma.notification.findMany({
      where: { 
        userId: GEORGIA_ID,
        type: 'NEW_BADGE' as any,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    console.log(`\n📬 Toplam ${notifications.length} NEW_BADGE bildirimi bulundu:\n`);

    // Notification'ları JSON'a çevir
    const notificationJSONs = notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      data: n.data,
      createdAt: n.createdAt,
      read: n.read,
      userId: n.userId,
    }));

    // Gruplama işlemini simüle et
    const groupedNotifications = groupNotifications(notificationJSONs);

    // NEW_BADGE bildirimlerini filtrele
    const badgeNotifications = groupedNotifications.filter((n: any) => n.type === NotificationType.NEW_BADGE);

    badgeNotifications.forEach((notif: any, index: number) => {
      console.log(`Bildirim ${index + 1}:`);
      console.log(`  ID: ${notif.id}`);
      console.log(`  Type: ${notif.type}`);
      console.log(`  Title: ${notif.title || 'undefined'}`);
      console.log(`  Message: ${notif.message || 'undefined'}`);
      console.log(`  Data:`, JSON.stringify(notif.data, null, 2));
      console.log(`  userId: ${notif.userId !== undefined ? notif.userId : 'undefined (temiz ✓)'}`);
      console.log(`  username: ${notif.username !== undefined ? notif.username : 'undefined (temiz ✓)'}`);
      console.log(`  avatar: ${notif.avatar !== undefined && notif.avatar !== null ? notif.avatar : 'undefined/null (temiz ✓)'}`);
      console.log(`  postId: ${notif.postId !== undefined ? notif.postId : 'undefined (temiz ✓)'}`);
      console.log(`  commentId: ${notif.commentId !== undefined ? notif.commentId : 'undefined (temiz ✓)'}`);
      console.log(`  imageUrl: ${notif.imageUrl || 'null'}`);
      
      // Data içindeki gereksiz alanları kontrol et
      if (notif.data) {
        console.log(`  data.avatar: ${notif.data.avatar !== undefined ? notif.data.avatar : 'undefined (temiz ✓)'}`);
        console.log(`  data.userId: ${notif.data.userId !== undefined ? notif.data.userId : 'undefined (temiz ✓)'}`);
        console.log(`  data.username: ${notif.data.username !== undefined ? notif.data.username : 'undefined (temiz ✓)'}`);
        console.log(`  data.badgeIcon: ${notif.data.badgeIcon !== undefined ? notif.data.badgeIcon : 'undefined (temiz ✓)'}`);
      }
      
      console.log('---\n');
    });

    // Gereksiz alanları kontrol et
    const hasUnnecessaryFields = badgeNotifications.some((n: any) => 
      n.userId !== undefined || 
      n.username !== undefined || 
      (n.avatar !== undefined && n.avatar !== null) || 
      n.postId !== undefined || 
      n.commentId !== undefined ||
      (n.data && (
        n.data.avatar !== undefined ||
        n.data.userId !== undefined ||
        n.data.username !== undefined ||
        n.data.postId !== undefined ||
        n.data.commentId !== undefined ||
        n.data.badgeIcon !== undefined
      ))
    );

    if (hasUnnecessaryFields) {
      console.log('❌ NEW_BADGE bildirimlerinde gereksiz alanlar var!');
    } else {
      console.log('✅ NEW_BADGE bildirimleri temiz! Gereksiz alanlar kaldırıldı.');
      console.log('   Sadece şu alanlar mevcut:');
      console.log('   - id, type, title, message');
      console.log('   - data: { badgeId, badgeName, imageUrl }');
      console.log('   - imageUrl (root seviyede)');
      console.log('   - createdAt, read');
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
  verifyBadgeNotificationsClean()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { verifyBadgeNotificationsClean };
