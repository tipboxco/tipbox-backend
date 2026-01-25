import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import logger from '../src/infrastructure/logger/logger';

const GEORGIA_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';

async function verifyGeorgiaNotificationsComplete() {
  const prisma = getPrisma();

  try {
    logger.info(`🔍 Georgia (${GEORGIA_ID}) kullanıcısının bildirimleri kontrol ediliyor...`);

    const notifications = await prisma.notification.findMany({
      where: { userId: GEORGIA_ID },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    console.log(`\n📬 Toplam ${notifications.length} bildirim bulundu:\n`);

    let hasNullOrEmpty = false;

    for (const n of notifications) {
      const data = n.data as any;
      const nullOrEmptyFields: string[] = [];

      // Tüm alanları kontrol et
      if (!n.title || n.title.trim() === '') nullOrEmptyFields.push('title');
      if (!n.message || n.message.trim() === '') nullOrEmptyFields.push('message');
      if (!n.type) nullOrEmptyFields.push('type');

      // Data içindeki alanları kontrol et
      if (data) {
        if (data.avatar === null || data.avatar === '' || !data.avatar) nullOrEmptyFields.push('data.avatar');
        if (n.type === 'TIPS_RECEIVED' && (!data.amount || data.amount === null)) nullOrEmptyFields.push('data.amount');
        if (n.type === 'TIPS_RECEIVED' && (!data.senderName || data.senderName.trim() === '')) nullOrEmptyFields.push('data.senderName');
        if (n.type === 'TIPS_RECEIVED' && (!data.senderUserId)) nullOrEmptyFields.push('data.senderUserId');
        if (n.type === 'POST_LIKED' && (!data.postId)) nullOrEmptyFields.push('data.postId');
        if (n.type === 'POST_LIKED' && (!data.likerName || data.likerName.trim() === '')) nullOrEmptyFields.push('data.likerName');
        if (n.type === 'POST_LIKED' && (!data.imageUrl || data.imageUrl === '')) nullOrEmptyFields.push('data.imageUrl');
        if (n.type === 'EVENT_STARTED' && (!data.eventId)) nullOrEmptyFields.push('data.eventId');
        if (n.type === 'EVENT_STARTED' && (!data.eventName || data.eventName.trim() === '')) nullOrEmptyFields.push('data.eventName');
        if (n.type === 'EVENT_STARTED' && (!data.imageUrl || data.imageUrl === '')) nullOrEmptyFields.push('data.imageUrl');
        if (n.type === 'NEW_BADGE' && (!data.badgeId)) nullOrEmptyFields.push('data.badgeId');
        if (n.type === 'NEW_BADGE' && (!data.badgeName || data.badgeName.trim() === '')) nullOrEmptyFields.push('data.badgeName');
        if (n.type === 'NEW_BADGE' && (!data.imageUrl || data.imageUrl === '')) nullOrEmptyFields.push('data.imageUrl');
        if (n.type === 'DM_REQUEST_ACCEPTED' && (!data.threadId)) nullOrEmptyFields.push('data.threadId');
        if (n.type === 'DM_REQUEST_ACCEPTED' && (!data.userName || data.userName.trim() === '')) nullOrEmptyFields.push('data.userName');
        if (n.type === 'DM_REQUEST_ACCEPTED' && (!data.participants)) nullOrEmptyFields.push('data.participants');
      }

      console.log(`Type: ${n.type}`);
      console.log(`Title: ${n.title}`);
      console.log(`Message: ${n.message}`);
      if (nullOrEmptyFields.length > 0) {
        console.log(`❌ Eksik/Boş alanlar: ${nullOrEmptyFields.join(', ')}`);
        hasNullOrEmpty = true;
      } else {
        console.log(`✅ Tüm alanlar dolu`);
      }
      console.log('---\n');
    }

    if (hasNullOrEmpty) {
      console.log('⚠️  Bazı bildirimlerde eksik/boş alanlar var!');
    } else {
      console.log('✅ Tüm bildirimler tam ve eksiksiz!');
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
  verifyGeorgiaNotificationsComplete()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { verifyGeorgiaNotificationsComplete };
