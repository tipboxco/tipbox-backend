import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { NotificationService } from './src/application/notification/notification.service';
import { NotificationType } from './src/domain/notification/notification-type.enum';
import { MessagingService } from './src/application/messaging/messaging.service';
import { InteractionService } from './src/application/interaction/interaction.service';
import logger from './src/infrastructure/logger/logger';
import RedisConfigManager from './src/infrastructure/config/redis.config';
import QueueProvider from './src/infrastructure/queue/queue.provider';
import SocketManager from './src/infrastructure/realtime/socket-manager';
import http from 'http';
import { Server } from 'socket.io';

const prisma = new PrismaClient();
const notificationService = new NotificationService();
const messagingService = new MessagingService();
const interactionService = new InteractionService();

async function sendRealNotifications() {
  try {
    // Redis ve Queue'yu initialize et
    console.log('🔧 Redis ve Queue initialize ediliyor...');
    try {
      await RedisConfigManager.getInstance().initialize();
      await QueueProvider.getInstance().initialize();
      
      // Socket.IO için HTTP server ve Socket.IO instance oluştur
      const httpServer = http.createServer();
      const io = new Server(httpServer, {
        cors: { origin: '*' },
        transports: ['websocket', 'polling'],
      });
      SocketManager.getInstance().initialize(io);
      
      console.log('✅ Redis, Queue ve Socket.IO başarıyla initialize edildi!\n');
    } catch (error: any) {
      console.log(`⚠️  Services initialize edilemedi: ${error.message}`);
      console.log('⚠️  Devam ediliyor...\n');
    }

    // Ömer kullanıcısını bul
    console.log('🔍 Ömer kullanıcısı aranıyor...');
    const omer = await prisma.user.findFirst({
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

    if (!omer) {
      console.log('❌ Ömer kullanıcısı bulunamadı.');
      await prisma.$disconnect();
      return;
    }

    console.log(`✅ Ömer bulundu: ${omer.profile?.displayName || omer.email}`);

    // Ömer'e avatar ekle (yoksa)
    const omerAvatar = await prisma.userAvatar.findFirst({
      where: { userId: omer.id, isActive: true },
    });
    if (!omerAvatar) {
      const { getPublicMediaBaseUrl } = await import('./src/infrastructure/config/media.config');
      const baseUrl = getPublicMediaBaseUrl();
      const avatarPaths = [
        'userprofile/omer.png',
        'userprofile/aycan.png',
        'userprofile/burakcan.png',
        'userprofile/man-user.jpg',
      ];
      const randomAvatar = avatarPaths[Math.floor(Math.random() * avatarPaths.length)];
      await prisma.userAvatar.create({
        data: {
          userId: omer.id,
          imageUrl: `${baseUrl}/${randomAvatar}`,
          isActive: true,
        },
      });
      console.log(`   ✅ Avatar eklendi: ${randomAvatar}`);
    }
    console.log('');

    // Farklı bir kullanıcı bul (mesaj göndermek için)
    console.log('🔍 Farklı bir kullanıcı aranıyor (mesaj göndermek için)...');
    const otherUser = await prisma.user.findFirst({
      where: {
        id: { not: omer.id },
      },
      include: {
        profile: true,
      },
    });

    if (!otherUser) {
      console.log('❌ Farklı kullanıcı bulunamadı.');
      await prisma.$disconnect();
      return;
    }

    console.log(`✅ Kullanıcı bulundu: ${otherUser.profile?.displayName || otherUser.email}`);

    // OtherUser'a avatar ekle (yoksa)
    const otherUserAvatar = await prisma.userAvatar.findFirst({
      where: { userId: otherUser.id, isActive: true },
    });
    if (!otherUserAvatar) {
      const { getPublicMediaBaseUrl } = await import('./src/infrastructure/config/media.config');
      const baseUrl = getPublicMediaBaseUrl();
      const avatarPaths = [
        'userprofile/woman-user.jpg',
        'userprofile/man-user-2.png',
        'userprofile/furkan.png',
        'userprofile/mehmet.png',
      ];
      const randomAvatar = avatarPaths[Math.floor(Math.random() * avatarPaths.length)];
      await prisma.userAvatar.create({
        data: {
          userId: otherUser.id,
          imageUrl: `${baseUrl}/${randomAvatar}`,
          isActive: true,
        },
      });
      console.log(`   ✅ Avatar eklendi: ${randomAvatar}`);
    }
    console.log('');

    // Ömer'in bir postunu bul
    console.log('🔍 Ömer\'in postları aranıyor...');
    const omerPost = await prisma.contentPost.findFirst({
      where: {
        userId: omer.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!omerPost) {
      console.log('⚠️  Ömer\'in postu bulunamadı, yeni post oluşturulacak...');
    } else {
      console.log(`✅ Post bulundu: ${omerPost.id}\n`);
    }

    // Event bul (WishboxEvent)
    console.log('🔍 Event aranıyor...');
    const event = await prisma.wishboxEvent.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
    });

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // 1. MESAJ BİLDİRİMİ
    console.log('\n📨 1. MESAJ BİLDİRİMİ gönderiliyor...');
    try {
      await messagingService.sendDirectMessage(
        otherUser.id,
        omer.id,
        'Merhaba! Bu gerçek bir test mesajıdır. Notification sistemini test ediyoruz. 🚀'
      );
      console.log('✅ Mesaj gönderildi, NEW_MESSAGE bildirimi oluşturulacak\n');
      await delay(2000);
    } catch (error: any) {
      console.log(`❌ Mesaj gönderme hatası: ${error.message}\n`);
    }

    // 2. POST BEĞENİ BİLDİRİMİ
    if (omerPost) {
      console.log('👍 2. POST BEĞENİ BİLDİRİMİ gönderiliyor...');
      try {
        // Önce beğeniyi geri al (varsa)
        const existingLike = await prisma.contentLike.findFirst({
          where: {
            userId: otherUser.id,
            postId: omerPost.id,
          },
        });
        
        if (existingLike) {
          await interactionService.unlikePost(otherUser.id, omerPost.id);
          await delay(1000);
        }

        await interactionService.likePost(otherUser.id, omerPost.id);
        console.log('✅ Post beğenildi, POST_LIKED bildirimi oluşturulacak\n');
        await delay(2000);
      } catch (error: any) {
        console.log(`❌ Post beğeni hatası: ${error.message}\n`);
      }
    } else {
      console.log('⚠️  Post bulunamadı, beğeni bildirimi atlanıyor\n');
    }

    // 3. POST YORUM BİLDİRİMİ
    if (omerPost) {
      console.log('💬 3. POST YORUM BİLDİRİMİ gönderiliyor...');
      try {
        await interactionService.createComment(
          otherUser.id,
          omerPost.id,
          'Harika bir paylaşım! Gerçek veritabanından test ediyoruz. 🎉'
        );
        console.log('✅ Yorum eklendi, POST_COMMENTED bildirimi oluşturulacak\n');
        await delay(2000);
      } catch (error: any) {
        console.log(`❌ Yorum ekleme hatası: ${error.message}\n`);
      }
    } else {
      console.log('⚠️  Post bulunamadı, yorum bildirimi atlanıyor\n');
    }

    // 4. EVENT BİLDİRİMİ
    if (event) {
      console.log('🎉 4. EVENT BİLDİRİMİ gönderiliyor...');
      try {
        await notificationService.sendNotification(
          omer.id,
          NotificationType.EVENT_STARTED,
          {
            eventName: event.title || 'Test Event',
            eventId: event.id,
          }
        );
        console.log('✅ Event bildirimi gönderildi\n');
        await delay(2000);
      } catch (error: any) {
        console.log(`❌ Event bildirimi hatası: ${error.message}\n`);
      }
    } else {
      console.log('⚠️  Event bulunamadı, event bildirimi atlanıyor\n');
    }

    // 5. POST FAVORİ BİLDİRİMİ
    if (omerPost) {
      console.log('⭐ 5. POST FAVORİ BİLDİRİMİ gönderiliyor...');
      try {
        // Önce favoriden çıkar (varsa)
        const existingFavorite = await prisma.contentFavorite.findFirst({
          where: {
            userId: otherUser.id,
            postId: omerPost.id,
          },
        });
        
        if (existingFavorite) {
          await interactionService.unfavoritePost(otherUser.id, omerPost.id);
          await delay(1000);
        }

        await interactionService.favoritePost(otherUser.id, omerPost.id);
        console.log('✅ Post favorilere eklendi, POST_FAVORITED bildirimi oluşturulacak\n');
        await delay(2000);
      } catch (error: any) {
        console.log(`❌ Post favori hatası: ${error.message}\n`);
      }
    } else {
      console.log('⚠️  Post bulunamadı, favori bildirimi atlanıyor\n');
    }

    // Worker'ın işlemesi için bekle
    console.log('⏳ Worker\'ın bildirimleri işlemesi için bekleniyor...\n');
    await delay(5000);

    // Bildirimleri kontrol et
    console.log('🔍 Ömer\'in son bildirimleri kontrol ediliyor...');
    const result = await notificationService.getUserNotifications(omer.id, {
      limit: 10,
    });

    if (result.notifications.length > 0) {
      console.log(`\n📬 Son ${result.notifications.length} bildirim (Toplam: ${result.pagination.total}):\n`);
      result.notifications.forEach((notif, index) => {
        console.log(`${index + 1}. ${notif.title}`);
        console.log(`   Tip: ${notif.type}`);
        console.log(`   Mesaj: ${notif.message}`);
        console.log(`   Okundu: ${notif.read ? 'Evet' : 'Hayır'}`);
        console.log(`   Tarih: ${new Date(notif.createdAt).toLocaleString('tr-TR')}\n`);
      });
    } else {
      console.log('⚠️  Henüz bildirim yok.\n');
    }

    // Okunmamış sayısı
    const unreadCount = await notificationService.getUnreadCount(omer.id);
    console.log(`📊 Okunmamış bildirim sayısı: ${unreadCount}`);

    console.log('\n✅ Tüm bildirimler gönderildi!');
  } catch (error) {
    console.error('❌ Hata:', error);
    logger.error('Real notification test hatası:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

sendRealNotifications();
