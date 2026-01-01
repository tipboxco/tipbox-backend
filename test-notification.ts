import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { NotificationService } from './src/application/notification/notification.service';
import { NotificationType } from './src/domain/notification/notification-type.enum';
import logger from './src/infrastructure/logger/logger';
import RedisConfigManager from './src/infrastructure/config/redis.config';
import QueueProvider from './src/infrastructure/queue/queue.provider';

const prisma = new PrismaClient();
const notificationService = new NotificationService();

async function testNotification() {
  try {
    // Redis ve Queue'yu initialize et (Socket.IO bildirimi için gerekli)
    console.log('🔧 Redis ve Queue initialize ediliyor...');
    try {
      await RedisConfigManager.getInstance().initialize();
      await QueueProvider.getInstance().initialize();
      console.log('✅ Redis ve Queue başarıyla initialize edildi!\n');
    } catch (error: any) {
      console.log(`⚠️  Redis/Queue initialize edilemedi: ${error.message}`);
      console.log('⚠️  Bildirimler queue\'ya eklenemeyecek, sadece database\'e kaydedilecek.\n');
    }

    console.log('🔍 Ömer kullanıcısı aranıyor...');
    
    // Ömer kullanıcısını bul (email veya displayName ile)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { contains: 'omer', mode: 'insensitive' } },
          { profile: { displayName: { contains: 'omer', mode: 'insensitive' } } },
          { profile: { userName: { contains: 'omer', mode: 'insensitive' } } },
        ],
      },
      include: {
        profile: true,
      },
    });

    if (!user) {
      console.log('❌ Ömer kullanıcısı bulunamadı. Tüm kullanıcılar listeleniyor...');
      const allUsers = await prisma.user.findMany({
        take: 10,
        include: {
          profile: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      
      console.log('\n📋 Son 10 kullanıcı:');
      allUsers.forEach((u) => {
        console.log(`  - ID: ${u.id}, Email: ${u.email}, DisplayName: ${u.profile?.displayName || 'N/A'}`);
      });
      
      await prisma.$disconnect();
      return;
    }

    console.log(`✅ Kullanıcı bulundu:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   DisplayName: ${user.profile?.displayName || 'N/A'}`);
    console.log(`   UserName: ${user.profile?.userName || 'N/A'}`);

    console.log('\n📨 5 adet test bildirimi gönderiliyor (10 saniye arayla)...');
    console.log('📡 Bildirimler queue\'ya eklenecek, worker Socket.IO ile gönderecek\n');
    
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    for (let i = 1; i <= 5; i++) {
      console.log(`📤 Bildirim ${i}/5 gönderiliyor...`);
      
      // NotificationService kullanarak bildirim gönder (queue üzerinden)
      await notificationService.sendNotification(
        user.id,
        NotificationType.SYSTEM_ANNOUNCEMENT,
        {
          message: `Bu ${i}. test bildirimidir. Notification servisi çalışıyor! 🎉`,
          title: `Test Bildirimi #${i}`,
        }
      );

      console.log(`✅ Bildirim ${i}/5 queue'ya eklendi! (Worker işleyecek ve Socket.IO ile gönderecek)`);
      
      // Son bildirimden sonra bekleme
      if (i < 5) {
        console.log(`⏳ 10 saniye bekleniyor...\n`);
        await delay(10000); // 10 saniye bekle
      }
    }
    
    console.log('\n✅ Tüm bildirimler queue\'ya eklendi!');
    console.log('⏳ Worker\'ın işlemesi için birkaç saniye bekleniyor...\n');
    await delay(3000); // Worker'ın işlemesi için bekle

    // Kullanıcının bildirimlerini kontrol et
    console.log('🔍 Kullanıcının son bildirimleri kontrol ediliyor...');
    const notifications = await notificationService.getUserNotifications(user.id, {
      limit: 5,
    });

    if (notifications.length > 0) {
      console.log(`\n📬 Son ${notifications.length} bildirim:`);
      notifications.forEach((notif, index) => {
        console.log(`\n${index + 1}. ${notif.title}`);
        console.log(`   Mesaj: ${notif.message}`);
        console.log(`   Tip: ${notif.type}`);
        console.log(`   Okundu: ${notif.read ? 'Evet' : 'Hayır'}`);
        console.log(`   Tarih: ${notif.createdAt}`);
      });
    } else {
      console.log('⚠️  Henüz bildirim yok. Worker çalışıyor mu kontrol edin.');
    }

    // Unread count
    const unreadCount = await notificationService.getUnreadCount(user.id);
    console.log(`\n📊 Okunmamış bildirim sayısı: ${unreadCount}`);

    console.log('\n✅ Test tamamlandı!');
  } catch (error) {
    console.error('❌ Hata:', error);
    logger.error('Notification test hatası:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

testNotification();

