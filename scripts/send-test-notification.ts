import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { NotificationService } from '../src/application/notification/notification.service';
import { NotificationType } from '../src/domain/notification/notification-type.enum';
import logger from '../src/infrastructure/logger/logger';
import RedisConfigManager from '../src/infrastructure/config/redis.config';
import QueueProvider from '../src/infrastructure/queue/queue.provider';

const prisma = new PrismaClient();

async function sendTestNotification() {
  try {
    console.log('📤 Basit Bildirim Gönderme Testi\n');
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

    // İlk kullanıcıyı bul veya oluştur
    console.log('👤 Kullanıcı bulunuyor...');
    let user = await prisma.user.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!user) {
      console.log('❌ Kullanıcı bulunamadı. Lütfen önce bir kullanıcı oluşturun.');
      process.exit(1);
    }

    console.log(`✅ Kullanıcı bulundu: ${user.email || user.id}\n`);

    // Notification service
    const notificationService = new NotificationService();

    // Basit bir bildirim gönder
    console.log('📨 Bildirim gönderiliyor...');
    await notificationService.sendNotification(
      user.id,
      NotificationType.SYSTEM_ANNOUNCEMENT,
      {
        title: 'Test Bildirimi',
        message: 'Bu bir test bildirimidir. Her şey çalışıyor! 🎉',
      }
    );

    console.log('✅ Bildirim kuyruğa eklendi\n');

    // Kısa bir bekleme
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Bildirimi kontrol et
    console.log('🔍 Bildirim kontrol ediliyor...');
    const notification = await prisma.notification.findFirst({
      where: {
        userId: user.id,
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (notification) {
      console.log('✅ Bildirim başarıyla oluşturuldu!\n');
      console.log('📋 Bildirim Detayları:');
      console.log(`   ID: ${notification.id}`);
      console.log(`   Tip: ${notification.type}`);
      console.log(`   Başlık: ${notification.title}`);
      console.log(`   Mesaj: ${notification.message}`);
      console.log(`   Oluşturulma: ${notification.createdAt.toISOString()}`);
      console.log(`   Okundu: ${notification.read ? 'Evet' : 'Hayır'}`);
    } else {
      console.log('⚠️  Bildirim henüz oluşturulmadı (worker işliyor olabilir)');
      console.log('💡 Birkaç saniye bekleyip tekrar kontrol edin\n');
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Test tamamlandı\n');

  } catch (error) {
    console.error('❌ Hata:', error);
    logger.error('Test notification error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

sendTestNotification();


