import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { NotificationService } from '../src/application/notification/notification.service';
import { NotificationType } from '../src/domain/notification/notification-type.enum';
import logger from '../src/infrastructure/logger/logger';
import RedisConfigManager from '../src/infrastructure/config/redis.config';
import QueueProvider from '../src/infrastructure/queue/queue.provider';
import { getPrisma } from '../src/infrastructure/repositories/prisma.client';

const prisma = getPrisma();

async function sendNotificationToUser() {
  try {
    console.log('📤 Kullanıcıya Bildirim Gönderme\n');
    console.log('='.repeat(50));

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
    const selectedUser = await prisma.user.findUnique({
      where: {
        email: 'omer@tipbox.co',
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    if (!selectedUser) {
      console.log('❌ omer@tipbox.co kullanıcısı bulunamadı.');
      process.exit(1);
    }

    console.log(`✅ Kullanıcı bulundu:`);
    console.log(`   ID: ${selectedUser.id}`);
    console.log(`   Email: ${selectedUser.email}`);
    console.log(`   Oluşturulma: ${selectedUser.createdAt.toISOString()}\n`);

    // Notification service
    const notificationService = new NotificationService();

    // Event notification'ları gönder
    console.log('📨 Bildirimler gönderiliyor...\n');

    // 1. EVENT_STARTED
    console.log('1️⃣  EVENT_STARTED bildirimi gönderiliyor...');
    await notificationService.sendNotification(
      selectedUser.id,
      NotificationType.EVENT_STARTED,
      {
        eventName: 'Test Event',
        eventId: 'test-event-' + Date.now(),
      }
    );
    console.log('   ✅ EVENT_STARTED gönderildi\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 2. EVENT_ENDING_SOON
    console.log('2️⃣  EVENT_ENDING_SOON bildirimi gönderiliyor...');
    await notificationService.sendNotification(
      selectedUser.id,
      NotificationType.EVENT_ENDING_SOON,
      {
        eventName: 'Test Event',
        eventId: 'test-event-' + Date.now(),
        hoursRemaining: 24,
      }
    );
    console.log('   ✅ EVENT_ENDING_SOON gönderildi\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. EVENT_REWARD_AVAILABLE
    console.log('3️⃣  EVENT_REWARD_AVAILABLE bildirimi gönderiliyor...');
    await notificationService.sendNotification(
      selectedUser.id,
      NotificationType.EVENT_REWARD_AVAILABLE,
      {
        eventName: 'Test Event',
        eventId: 'test-event-' + Date.now(),
        rewardAmount: 500,
      }
    );
    console.log('   ✅ EVENT_REWARD_AVAILABLE gönderildi\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Bildirimleri kontrol et
    console.log('🔍 Bildirimler kontrol ediliyor...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const notifications = await prisma.notification.findMany({
      where: {
        userId: selectedUser.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    console.log(`\n✅ ${notifications.length} bildirim bulundu:\n`);
    notifications.forEach((notif, index) => {
      console.log(`   ${index + 1}. ${notif.type}`);
      console.log(`      Başlık: ${notif.title}`);
      console.log(`      Mesaj: ${notif.message}`);
      console.log(`      Oluşturulma: ${notif.createdAt.toISOString()}`);
      console.log(`      Okundu: ${notif.read ? 'Evet' : 'Hayır'}`);
      console.log('');
    });

    console.log('='.repeat(50));
    console.log(`\n✅ Bildirimler başarıyla gönderildi!`);
    console.log(`\n💡 Swagger'da bu kullanıcı ile authenticate olun:`);
    console.log(`   User ID: ${selectedUser.id}`);
    console.log(`   Email: ${selectedUser.email || 'N/A'}\n`);

  } catch (error) {
    console.error('❌ Hata:', error);
    logger.error('Send notification to user error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

sendNotificationToUser();

