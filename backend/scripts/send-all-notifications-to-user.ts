import dotenv from 'dotenv';
dotenv.config();

import { NotificationService } from '../src/application/notification/notification.service';
import { NotificationType } from '../src/domain/notification/notification-type.enum';
import logger from '../src/infrastructure/logger/logger';
import RedisConfigManager from '../src/infrastructure/config/redis.config';
import QueueProvider from '../src/infrastructure/queue/queue.provider';
import { getPrisma } from '../src/infrastructure/repositories/prisma.client';

const prisma = getPrisma();

async function sendAllNotificationsToUser() {
  try {
    console.log('📤 Tüm Bildirim Tiplerini Gönderme\n');
    console.log('='.repeat(60));

    // Services initialize
    console.log('\n🔧 Servisler başlatılıyor...');
    try {
      await RedisConfigManager.getInstance().initialize();
      await QueueProvider.getInstance().initialize();
      console.log('✅ Servisler başlatıldı\n');
    } catch (error: any) {
      console.log(`⚠️  Servis uyarısı: ${error.message}\n`);
    }

    // omer@tipbox.co kullanıcısını bul
    console.log('👤 omer@tipbox.co kullanıcısı aranıyor...');
    const user = await prisma.user.findUnique({
      where: {
        email: 'omer@tipbox.co',
      },
    });

    if (!user) {
      console.log('❌ omer@tipbox.co kullanıcısı bulunamadı.');
      process.exit(1);
    }

    console.log(`✅ Kullanıcı bulundu: ${user.id}\n`);

    // Notification service
    const notificationService = new NotificationService();

    // Tüm bildirim tiplerini gönder
    const notifications = [
      // Event Notifications
      {
        type: NotificationType.EVENT_STARTED,
        data: { eventName: 'Test Event', eventId: 'test-event-' + Date.now() },
        name: 'EVENT_STARTED',
      },
      {
        type: NotificationType.EVENT_ENDING_SOON,
        data: { eventName: 'Test Event', eventId: 'test-event-' + Date.now(), hoursRemaining: 24 },
        name: 'EVENT_ENDING_SOON',
      },
      {
        type: NotificationType.EVENT_REWARD_AVAILABLE,
        data: { eventName: 'Test Event', eventId: 'test-event-' + Date.now(), rewardAmount: 500 },
        name: 'EVENT_REWARD_AVAILABLE',
      },
      // Post Interaction Notifications
      {
        type: NotificationType.POST_LIKED,
        data: { likerName: 'Test User', postId: 'test-post-' + Date.now() },
        name: 'POST_LIKED',
      },
      {
        type: NotificationType.POST_COMMENTED,
        data: { commenterName: 'Test User', postId: 'test-post-' + Date.now() },
        name: 'POST_COMMENTED',
      },
      {
        type: NotificationType.POST_SHARED,
        data: { sharerName: 'Test User', postId: 'test-post-' + Date.now() },
        name: 'POST_SHARED',
      },
      {
        type: NotificationType.POST_FAVORITED,
        data: { userName: 'Test User', postId: 'test-post-' + Date.now() },
        name: 'POST_FAVORITED',
      },
      // Comment Notifications
      {
        type: NotificationType.COMMENT_LIKED,
        data: { likerName: 'Test User', commentId: 'test-comment-' + Date.now() },
        name: 'COMMENT_LIKED',
      },
      {
        type: NotificationType.COMMENT_REPLIED,
        data: { replierName: 'Test User', commentId: 'test-comment-' + Date.now() },
        name: 'COMMENT_REPLIED',
      },
      // Trust Notifications
      {
        type: NotificationType.NEW_TRUSTER,
        data: { trusterName: 'Test User' },
        name: 'NEW_TRUSTER',
      },
      {
        type: NotificationType.NEW_TRUSTED_BY,
        data: { trustedName: 'Test User' },
        name: 'NEW_TRUSTED_BY',
      },
      // Messaging Notifications
      {
        type: NotificationType.NEW_MESSAGE,
        data: { senderName: 'Test User', messagePreview: 'Merhaba, bu bir test mesajıdır.' },
        name: 'NEW_MESSAGE',
      },
      {
        type: NotificationType.DM_REQUEST_RECEIVED,
        data: { requesterName: 'Test User' },
        name: 'DM_REQUEST_RECEIVED',
      },
      {
        type: NotificationType.DM_REQUEST_ACCEPTED,
        data: { accepterName: 'Test User' },
        name: 'DM_REQUEST_ACCEPTED',
      },
      // Collection Notifications (template yoksa atlanacak)
      {
        type: NotificationType.COLLECTION_POST_ADDED,
        data: { collectionName: 'Test Collection', postId: 'test-post-' + Date.now() },
        name: 'COLLECTION_POST_ADDED',
      },
      {
        type: NotificationType.COLLECTION_SHARED,
        data: { sharerName: 'Test User', collectionName: 'Test Collection' },
        name: 'COLLECTION_SHARED',
      },
      // Gamification Notifications
      {
        type: NotificationType.NEW_BADGE,
        data: { badgeName: 'Test Rozeti' },
        name: 'NEW_BADGE',
      },
      {
        type: NotificationType.ACHIEVEMENT_UNLOCKED,
        data: { achievementName: 'Test Başarısı' },
        name: 'ACHIEVEMENT_UNLOCKED',
      },
      {
        type: NotificationType.REWARD_EARNED,
        data: { amount: 200 },
        name: 'REWARD_EARNED',
      },
      // Expert Notifications
      {
        type: NotificationType.EXPERT_REQUEST_AVAILABLE,
        data: { tipsAmount: 500 },
        name: 'EXPERT_REQUEST_AVAILABLE',
      },
      {
        type: NotificationType.EXPERT_REQUEST_ANSWERED,
        data: { expertName: 'Test Expert' },
        name: 'EXPERT_REQUEST_ANSWERED',
      },
      // System Notifications
      {
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        data: { title: 'Test Duyurusu', message: 'Bu bir test duyurusudur.' },
        name: 'SYSTEM_ANNOUNCEMENT',
      },
      {
        type: NotificationType.TIPS_RECEIVED,
        data: { senderName: 'Test User', amount: 100 },
        name: 'TIPS_RECEIVED',
      },
    ];

    console.log(`📨 ${notifications.length} bildirim gönderiliyor...\n`);

    const results: Array<{ name: string; success: boolean; error?: string }> = [];

    for (let i = 0; i < notifications.length; i++) {
      const notif = notifications[i];
      try {
        console.log(`${i + 1}/${notifications.length} - ${notif.name} gönderiliyor...`);
        await notificationService.sendNotification(user.id, notif.type, notif.data);
        results.push({ name: notif.name, success: true });
        console.log(`   ✅ ${notif.name} gönderildi\n`);
        
        // Her bildirim arasında 2 saniye bekle
        if (i < notifications.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        results.push({ name: notif.name, success: false, error: error.message });
        console.log(`   ❌ ${notif.name} gönderilemedi: ${error.message}\n`);
      }
    }

    // Bildirimleri kontrol et
    console.log('🔍 Bildirimler kontrol ediliyor...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const dbNotifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    console.log(`\n✅ ${dbNotifications.length} bildirim veritabanında bulundu:\n`);
    dbNotifications.forEach((notif, index) => {
      console.log(`   ${index + 1}. ${notif.type}`);
      console.log(`      Başlık: ${notif.title}`);
      console.log(`      Mesaj: ${notif.message}`);
      console.log(`      Oluşturulma: ${notif.createdAt.toISOString()}`);
      console.log(`      Okundu: ${notif.read ? 'Evet' : 'Hayır'}`);
      console.log('');
    });

    // Özet
    console.log('\n' + '='.repeat(60));
    console.log('📊 Özet:');
    console.log('='.repeat(60));
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    console.log(`✅ Başarılı: ${successCount}`);
    console.log(`❌ Başarısız: ${failCount}`);
    console.log(`📝 Toplam: ${results.length}\n`);

    if (failCount > 0) {
      console.log('❌ Başarısız Bildirimler:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`   - ${r.name}: ${r.error}`);
      });
      console.log('');
    }

    console.log('='.repeat(60));
    console.log(`\n✅ İşlem tamamlandı!`);
    console.log(`\n💡 Swagger'da kontrol edin:`);
    console.log(`   GET /notifications?limit=20&offset=0&unreadOnly=false`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Email: omer@tipbox.co\n`);

  } catch (error) {
    console.error('❌ Hata:', error);
    logger.error('Send all notifications error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

sendAllNotificationsToUser();

