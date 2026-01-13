import dotenv from 'dotenv';
dotenv.config();

import { getPrisma } from './src/infrastructure/repositories/prisma.client';
import { NotificationService } from './src/application/notification/notification.service';
import { NotificationType } from './src/domain/notification/notification-type.enum';
import RedisConfigManager from './src/infrastructure/config/redis.config';
import QueueProvider from './src/infrastructure/queue/queue.provider';

const prisma = getPrisma();

async function sendNotificationToOmer() {
  try {
    // Initialize Redis and Queue
    console.log('🔧 Initializing Redis and Queue...');
    await RedisConfigManager.getInstance().initialize();
    await QueueProvider.getInstance().initialize();
    console.log('✅ Services initialized\n');
    // Kullanıcıyı bul
    console.log('🔍 Searching for user omer@tipbox.co...');
    const user = await prisma.user.findUnique({
      where: { email: 'omer@tipbox.co' },
      select: { id: true, email: true },
    });

    if (!user) {
      console.log('❌ User not found!');
      return;
    }

    console.log(`✅ User found: ${user.id} (${user.email})\n`);

    // Notification servisi
    const notificationService = new NotificationService();

    // Test bildirimi gönder
    console.log('📤 Sending notification...');
    await notificationService.sendNotification(
      user.id,
      NotificationType.EVENT_STARTED,
      {
        eventName: 'Test Bildirimi',
        eventId: 'test-notification-' + Date.now(),
      }
    );

    console.log('✅ Notification sent successfully!\n');

    // Bildirimi kontrol et
    console.log('🔍 Checking notification in database...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const notification = await prisma.notification.findFirst({
      where: {
        userId: user.id,
        type: NotificationType.EVENT_STARTED,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (notification) {
      console.log('✅ Notification found in database:');
      console.log(`   ID: ${notification.id}`);
      console.log(`   Title: ${notification.title}`);
      console.log(`   Message: ${notification.message}`);
      console.log(`   Type: ${notification.type}`);
      console.log(`   Created: ${notification.createdAt}`);
    } else {
      console.log('⚠️  Notification not found in database yet (may be processing)');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

sendNotificationToOmer();

