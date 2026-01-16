import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { NotificationService } from './src/application/notification/notification.service';
import { NotificationType } from './src/domain/notification/notification-type.enum';
import { MessagingService } from './src/application/messaging/messaging.service';
import { InteractionService } from './src/application/interaction/interaction.service';
import { UserService } from './src/application/user/user.service';
import { GamificationService } from './src/application/gamification/gamification.service';
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
const userService = new UserService();
const gamificationService = new GamificationService();

async function sendJuliaNotifications() {
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

    // Julia kullanıcısını bul
    console.log('🔍 Julia kullanıcısı aranıyor...');
    const julia = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { contains: 'julia', mode: 'insensitive' } },
          { profile: { displayName: { contains: 'julia', mode: 'insensitive' } } },
          { profile: { userName: { contains: 'julia', mode: 'insensitive' } } },
        ],
      },
      include: {
        profile: true,
      },
    });

    if (!julia) {
      console.log('❌ Julia kullanıcısı bulunamadı.');
      await prisma.$disconnect();
      return;
    }

    console.log(`✅ Julia bulundu: ${julia.profile?.displayName || julia.email} (ID: ${julia.id})\n`);

    // Farklı bir kullanıcı bul (etkileşimler için)
    console.log('🔍 Farklı bir kullanıcı aranıyor...');
    const otherUser = await prisma.user.findFirst({
      where: {
        id: { not: julia.id },
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

    console.log(`✅ Kullanıcı bulundu: ${otherUser.profile?.displayName || otherUser.email}\n`);

    // Julia'nın bir postunu bul veya oluştur
    console.log('🔍 Julia\'nın postları aranıyor...');
    let juliaPost = await prisma.contentPost.findFirst({
      where: {
        userId: julia.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!juliaPost) {
      console.log('⚠️  Julia\'nın postu bulunamadı, yeni post oluşturulacak...');
      // Basit bir post oluştur
      const { ContentPostType } = await import('./src/domain/content/content-post-type.enum');
      juliaPost = await prisma.contentPost.create({
        data: {
          id: `01${Date.now().toString(36).toUpperCase().padStart(24, '0')}`,
          userId: julia.id,
          type: ContentPostType.TIPS,
          title: 'Test Post for Notifications',
          body: 'This is a test post for notification testing.',
          inventoryRequired: false,
          isBoosted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      console.log(`✅ Post oluşturuldu: ${juliaPost.id}\n`);
    } else {
      console.log(`✅ Post bulundu: ${juliaPost.id}\n`);
    }

    // Event bul
    console.log('🔍 Event aranıyor...');
    const event = await prisma.wishboxEvent.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Badge bul
    console.log('🔍 Badge aranıyor...');
    const badge = await prisma.badge.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
    });

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    console.log('\n📨 TÜM NOTIFICATION TİPLERİ GÖNDERİLİYOR...\n');

    // 1. POST_LIKED
    console.log('1️⃣  POST_LIKED bildirimi gönderiliyor...');
    try {
      const existingLike = await prisma.contentLike.findFirst({
        where: { userId: otherUser.id, postId: juliaPost.id },
      });
      if (existingLike) {
        await interactionService.unlikePost(otherUser.id, juliaPost.id);
        await delay(500);
      }
      await interactionService.likePost(otherUser.id, juliaPost.id);
      console.log('✅ POST_LIKED gönderildi\n');
      await delay(2000);
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 2. POST_COMMENTED
    console.log('2️⃣  POST_COMMENTED bildirimi gönderiliyor...');
    try {
      await interactionService.createComment(
        otherUser.id,
        juliaPost.id,
        'Harika bir paylaşım! 🎉'
      );
      console.log('✅ POST_COMMENTED gönderildi\n');
      await delay(2000);
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 3. POST_SHARED
    console.log('3️⃣  POST_SHARED bildirimi gönderiliyor...');
    try {
      const { ShareType } = await import('./src/domain/interaction/share-type.enum');
      await interactionService.sharePost(otherUser.id, juliaPost.id, ShareType.INTERNAL_REPOST);
      console.log('✅ POST_SHARED gönderildi\n');
      await delay(2000);
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 4. POST_FAVORITED
    console.log('4️⃣  POST_FAVORITED bildirimi gönderiliyor...');
    try {
      const existingFavorite = await prisma.contentFavorite.findFirst({
        where: { userId: otherUser.id, postId: juliaPost.id },
      });
      if (existingFavorite) {
        await interactionService.unfavoritePost(otherUser.id, juliaPost.id);
        await delay(500);
      }
      await interactionService.favoritePost(otherUser.id, juliaPost.id);
      console.log('✅ POST_FAVORITED gönderildi\n');
      await delay(2000);
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 5. COMMENT_LIKED
    console.log('5️⃣  COMMENT_LIKED bildirimi gönderiliyor...');
    try {
      const comment = await prisma.contentComment.findFirst({
        where: { postId: juliaPost.id },
        orderBy: { createdAt: 'desc' },
      });
      if (comment) {
        await interactionService.likeComment(otherUser.id, comment.id);
        console.log('✅ COMMENT_LIKED gönderildi\n');
        await delay(2000);
      } else {
        console.log('⚠️  Yorum bulunamadı\n');
      }
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 6. COMMENT_REPLIED
    console.log('6️⃣  COMMENT_REPLIED bildirimi gönderiliyor...');
    try {
      const comment = await prisma.contentComment.findFirst({
        where: { postId: juliaPost.id },
        orderBy: { createdAt: 'desc' },
      });
      if (comment) {
        await interactionService.createComment(
          otherUser.id,
          juliaPost.id,
          'Teşekkürler! 👍',
          comment.id
        );
        console.log('✅ COMMENT_REPLIED gönderildi\n');
        await delay(2000);
      } else {
        console.log('⚠️  Yorum bulunamadı\n');
      }
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 7. NEW_TRUSTER
    console.log('7️⃣  NEW_TRUSTER bildirimi gönderiliyor...');
    try {
      const existingTrust = await prisma.trustRelation.findFirst({
        where: { trusterId: otherUser.id, trustedUserId: julia.id },
      });
      if (existingTrust) {
        await userService.removeTrust(otherUser.id, julia.id);
        await delay(500);
      }
      await userService.addTrust(otherUser.id, julia.id);
      console.log('✅ NEW_TRUSTER gönderildi\n');
      await delay(2000);
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 8. NEW_TRUSTED_BY
    console.log('8️⃣  NEW_TRUSTED_BY bildirimi gönderiliyor...');
    try {
      const existingTrust = await prisma.trustRelation.findFirst({
        where: { trusterId: julia.id, trustedUserId: otherUser.id },
      });
      if (existingTrust) {
        await userService.removeTrust(julia.id, otherUser.id);
        await delay(500);
      }
      await userService.addTrust(julia.id, otherUser.id);
      console.log('✅ NEW_TRUSTED_BY gönderildi\n');
      await delay(2000);
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 9. NEW_MESSAGE
    console.log('9️⃣  NEW_MESSAGE bildirimi gönderiliyor...');
    try {
      await messagingService.sendDirectMessage(
        otherUser.id,
        julia.id,
        'Merhaba Julia! Test mesajı gönderiyorum. 🚀'
      );
      console.log('✅ NEW_MESSAGE gönderildi\n');
      await delay(2000);
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 10. DM_REQUEST_RECEIVED (Support Request ile)
    console.log('🔟 DM_REQUEST_RECEIVED bildirimi gönderiliyor...');
    try {
      const { SupportRequestService } = await import('./src/application/messaging/support-request.service');
      const supportRequestService = new SupportRequestService();
      await supportRequestService.createSupportRequest(otherUser.id, {
        recipientUserId: julia.id,
        type: 'GENERAL',
        message: 'Test support request',
        amount: 100,
      });
      console.log('✅ DM_REQUEST_RECEIVED gönderildi\n');
      await delay(2000);
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 11. DM_REQUEST_ACCEPTED (Support Request Accept ile)
    console.log('1️⃣1️⃣ DM_REQUEST_ACCEPTED bildirimi gönderiliyor...');
    try {
      const { SupportRequestService } = await import('./src/application/messaging/support-request.service');
      const supportRequestService = new SupportRequestService();
      const request = await prisma.dMRequest.findFirst({
        where: {
          fromUserId: otherUser.id,
          toUserId: julia.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (request) {
        await supportRequestService.acceptSupportRequest(request.id, julia.id);
        console.log('✅ DM_REQUEST_ACCEPTED gönderildi\n');
        await delay(2000);
      } else {
        console.log('⚠️  Request bulunamadı\n');
      }
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 12. NEW_BADGE
    console.log('1️⃣2️⃣ NEW_BADGE bildirimi gönderiliyor...');
    try {
      if (badge) {
        await notificationService.sendNotification(
          julia.id,
          NotificationType.NEW_BADGE,
          {
            badgeName: badge.name || 'Test Badge',
            badgeId: badge.id,
          }
        );
        console.log('✅ NEW_BADGE gönderildi\n');
        await delay(2000);
      } else {
        console.log('⚠️  Badge bulunamadı\n');
      }
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 13. ACHIEVEMENT_UNLOCKED
    console.log('1️⃣3️⃣ ACHIEVEMENT_UNLOCKED bildirimi gönderiliyor...');
    try {
      const achievementId = 'test-achievement-' + Date.now();
      await gamificationService.grantAchievementToUser(julia.id, achievementId);
      console.log('✅ ACHIEVEMENT_UNLOCKED gönderildi\n');
      await delay(2000);
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 14. REWARD_EARNED
    console.log('1️⃣4️⃣ REWARD_EARNED bildirimi gönderiliyor...');
    try {
      await notificationService.sendNotification(
        julia.id,
        NotificationType.REWARD_EARNED,
        {
          rewardAmount: 500,
          rewardType: 'TIPS',
        }
      );
      console.log('✅ REWARD_EARNED gönderildi\n');
      await delay(2000);
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 15. EXPERT_REQUEST_AVAILABLE
    console.log('1️⃣5️⃣ EXPERT_REQUEST_AVAILABLE bildirimi gönderiliyor...');
    try {
      await notificationService.sendNotification(
        julia.id,
        NotificationType.EXPERT_REQUEST_AVAILABLE,
        {
          category: 'ELECTRONICS',
          requestId: 'test-request-' + Date.now(),
        }
      );
      console.log('✅ EXPERT_REQUEST_AVAILABLE gönderildi\n');
      await delay(2000);
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 16. EXPERT_REQUEST_ANSWERED
    console.log('1️⃣6️⃣ EXPERT_REQUEST_ANSWERED bildirimi gönderiliyor...');
    try {
      await notificationService.sendNotification(
        julia.id,
        NotificationType.EXPERT_REQUEST_ANSWERED,
        {
          expertName: otherUser.profile?.displayName || 'Expert',
          expertId: otherUser.id,
          requestId: 'test-request-' + Date.now(),
        }
      );
      console.log('✅ EXPERT_REQUEST_ANSWERED gönderildi\n');
      await delay(2000);
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 17. SYSTEM_ANNOUNCEMENT
    console.log('1️⃣7️⃣ SYSTEM_ANNOUNCEMENT bildirimi gönderiliyor...');
    try {
      await notificationService.sendNotification(
        julia.id,
        NotificationType.SYSTEM_ANNOUNCEMENT,
        {
          title: 'Sistem Duyurusu',
          message: 'Bu bir test sistem duyurusudur.',
        }
      );
      console.log('✅ SYSTEM_ANNOUNCEMENT gönderildi\n');
      await delay(2000);
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 18. TIPS_RECEIVED
    console.log('1️⃣8️⃣ TIPS_RECEIVED bildirimi gönderiliyor...');
    try {
      await notificationService.sendNotification(
        julia.id,
        NotificationType.TIPS_RECEIVED,
        {
          senderName: otherUser.profile?.displayName || 'User',
          senderId: otherUser.id,
          amount: 100,
        }
      );
      console.log('✅ TIPS_RECEIVED gönderildi\n');
      await delay(2000);
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 19. TIPS_SENT
    console.log('1️⃣9️⃣ TIPS_SENT bildirimi gönderiliyor...');
    try {
      await notificationService.sendNotification(
        otherUser.id,
        NotificationType.TIPS_SENT,
        {
          recipientName: julia.profile?.displayName || 'Julia',
          recipientId: julia.id,
          amount: 100,
        }
      );
      console.log('✅ TIPS_SENT gönderildi\n');
      await delay(2000);
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 20. EVENT_STARTED
    console.log('2️⃣0️⃣ EVENT_STARTED bildirimi gönderiliyor...');
    try {
      if (event) {
        await notificationService.sendNotification(
          julia.id,
          NotificationType.EVENT_STARTED,
          {
            eventName: event.title || 'Test Event',
            eventId: event.id,
          }
        );
        console.log('✅ EVENT_STARTED gönderildi\n');
        await delay(2000);
      } else {
        console.log('⚠️  Event bulunamadı\n');
      }
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 21. EVENT_ENDING_SOON
    console.log('2️⃣1️⃣ EVENT_ENDING_SOON bildirimi gönderiliyor...');
    try {
      if (event) {
        await notificationService.sendNotification(
          julia.id,
          NotificationType.EVENT_ENDING_SOON,
          {
            eventName: event.title || 'Test Event',
            eventId: event.id,
            hoursRemaining: 24,
          }
        );
        console.log('✅ EVENT_ENDING_SOON gönderildi\n');
        await delay(2000);
      } else {
        console.log('⚠️  Event bulunamadı\n');
      }
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // 22. EVENT_REWARD_AVAILABLE
    console.log('2️⃣2️⃣ EVENT_REWARD_AVAILABLE bildirimi gönderiliyor...');
    try {
      if (event) {
        await notificationService.sendNotification(
          julia.id,
          NotificationType.EVENT_REWARD_AVAILABLE,
          {
            eventName: event.title || 'Test Event',
            eventId: event.id,
            rewardAmount: 500,
          }
        );
        console.log('✅ EVENT_REWARD_AVAILABLE gönderildi\n');
        await delay(2000);
      } else {
        console.log('⚠️  Event bulunamadı\n');
      }
    } catch (error: any) {
      console.log(`❌ Hata: ${error.message}\n`);
    }

    // Worker'ın işlemesi için bekle
    console.log('⏳ Worker\'ın bildirimleri işlemesi için bekleniyor...\n');
    await delay(5000);

    // Bildirimleri kontrol et
    console.log('🔍 Julia\'nın son bildirimleri kontrol ediliyor...');
    const result = await notificationService.getUserNotifications(julia.id, {
      limit: 25,
    });

    if (result.notifications.length > 0) {
      console.log(`\n📬 Son ${result.notifications.length} bildirim (Toplam: ${result.pagination.total}):\n`);
      result.notifications.forEach((notif: any, index) => {
        console.log(`${index + 1}. ${notif.type} - ${notif.title}`);
        if (notif.avatarUrl) console.log(`   Avatar: ${notif.avatarUrl}`);
        if (notif.imageUrl) console.log(`   Image: ${notif.imageUrl}`);
      });
    } else {
      console.log('⚠️  Henüz bildirim yok.\n');
    }

    // Okunmamış sayısı
    const unreadCount = await notificationService.getUnreadCount(julia.id);
    console.log(`\n📊 Okunmamış bildirim sayısı: ${unreadCount}`);

    console.log('\n✅ Tüm bildirimler gönderildi!');
  } catch (error) {
    console.error('❌ Hata:', error);
    logger.error('Julia notification test hatası:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

sendJuliaNotifications();
