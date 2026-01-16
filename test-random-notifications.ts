import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { NotificationService } from './src/application/notification/notification.service';
import { NotificationType } from './src/domain/notification/notification-type.enum';
import { MessagingService } from './src/application/messaging/messaging.service';
import { InteractionService } from './src/application/interaction/interaction.service';
import { ShareType } from './src/domain/interaction/share-type.enum';
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

// Rastgele bildirim mesajları
const randomMessages = {
  POST_LIKED: [
    'Harika bir paylaşım! ❤️',
    'Çok beğendim! 👍',
    'Mükemmel içerik! ⭐',
    'Süper bir post! 🔥',
    'Harika! 👏',
  ],
  POST_COMMENTED: [
    'Çok güzel bir paylaşım! 💬',
    'Harika bilgiler, teşekkürler! 🙏',
    'Çok faydalı oldu! 💡',
    'Mükemmel! 🎉',
    'Harika bir içerik! ✨',
  ],
  POST_SHARED: [
    'Paylaşımını paylaştım! 📤',
    'Harika içerik, paylaştım! 🔄',
    'Güzel paylaşım, paylaştım! 📢',
  ],
  POST_FAVORITED: [
    'Favorilerime ekledim! ⭐',
    'Harika içerik, favorilere ekledim! 💾',
    'Sakladım! 📌',
  ],
  NEW_MESSAGE: [
    'Merhaba! Nasılsın? 👋',
    'Harika bir gün! ☀️',
    'Merhaba, bir sorum var! 💬',
    'Selam! 🎉',
    'Merhaba, nasıl gidiyor? 🚀',
  ],
  NEW_TRUSTER: [
    'Seni güveniyorum! 🤝',
    'Harika bir kullanıcısın! ⭐',
    'Güveniyorum! 💪',
  ],
  EVENT_STARTED: [
    'Yeni bir etkinlik başladı! 🎉',
    'Etkinlik başladı, katıl! 🚀',
    'Harika bir etkinlik başladı! ✨',
  ],
  NEW_BADGE: [
    'Yeni bir rozet kazandın! 🏆',
    'Tebrikler, rozet kazandın! 🎖️',
    'Harika, rozet kazandın! ⭐',
  ],
  SYSTEM_ANNOUNCEMENT: [
    'Yeni özellikler eklendi! 🎊',
    'Sistem güncellemesi yapıldı! 🔄',
    'Yeni güncellemeler mevcut! ✨',
  ],
};

// Rastgele bir değer seç
function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Rastgele bir bildirim tipi seç
function getRandomNotificationType(): NotificationType {
  const types = [
    NotificationType.POST_LIKED,
    NotificationType.POST_COMMENTED,
    NotificationType.POST_SHARED,
    NotificationType.POST_FAVORITED,
    NotificationType.NEW_MESSAGE,
    NotificationType.NEW_TRUSTER,
    NotificationType.EVENT_STARTED,
    NotificationType.NEW_BADGE,
    NotificationType.SYSTEM_ANNOUNCEMENT,
    NotificationType.COMMENT_LIKED,
    NotificationType.COMMENT_REPLIED,
    NotificationType.ACHIEVEMENT_UNLOCKED,
    NotificationType.LEVEL_UP,
    NotificationType.REWARD_EARNED,
  ];
  return randomChoice(types);
}

async function sendRandomNotification(omerId: string, otherUserId: string) {
  const type = getRandomNotificationType();
  const timestamp = new Date().toLocaleTimeString('tr-TR');

  try {
    switch (type) {
      case NotificationType.POST_LIKED:
      case NotificationType.POST_COMMENTED:
      case NotificationType.POST_SHARED:
      case NotificationType.POST_FAVORITED: {
        // Ömer'in bir postunu bul
        const post = await prisma.contentPost.findFirst({
          where: { userId: omerId },
          orderBy: { createdAt: 'desc' },
        });

        if (post) {
          if (type === NotificationType.POST_LIKED) {
            // Önce unlike yap (varsa)
            const existingLike = await prisma.contentLike.findFirst({
              where: { userId: otherUserId, postId: post.id },
            });
            if (existingLike) {
              await interactionService.unlikePost(otherUserId, post.id);
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            await interactionService.likePost(otherUserId, post.id);
          } else if (type === NotificationType.POST_COMMENTED) {
            await interactionService.createComment(
              otherUserId,
              post.id,
              randomChoice(randomMessages.POST_COMMENTED)
            );
          } else if (type === NotificationType.POST_SHARED) {
            await interactionService.sharePost(otherUserId, post.id, ShareType.EXTERNAL_SHARE, 'Twitter');
          } else if (type === NotificationType.POST_FAVORITED) {
            const existingFavorite = await prisma.contentFavorite.findFirst({
              where: { userId: otherUserId, postId: post.id },
            });
            if (existingFavorite) {
              await interactionService.unfavoritePost(otherUserId, post.id);
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            await interactionService.favoritePost(otherUserId, post.id);
          }
          console.log(`✅ [${timestamp}] ${type} bildirimi gönderildi`);
        } else {
          console.log(`⚠️  [${timestamp}] Post bulunamadı, ${type} atlandı`);
        }
        break;
      }

      case NotificationType.NEW_MESSAGE: {
        await messagingService.sendDirectMessage(
          otherUserId,
          omerId,
          randomChoice(randomMessages.NEW_MESSAGE)
        );
        console.log(`✅ [${timestamp}] ${type} bildirimi gönderildi`);
        break;
      }

      case NotificationType.NEW_TRUSTER: {
        await notificationService.sendNotification(
          omerId,
          type,
          {
            trusterId: otherUserId,
            trusterName: 'Test User',
          }
        );
        console.log(`✅ [${timestamp}] ${type} bildirimi gönderildi`);
        break;
      }

      case NotificationType.EVENT_STARTED: {
        const event = await prisma.wishboxEvent.findFirst({
          orderBy: { createdAt: 'desc' },
        });
        if (event) {
          await notificationService.sendNotification(
            omerId,
            type,
            {
              eventId: event.id,
              eventName: event.title || 'Test Event',
            }
          );
          console.log(`✅ [${timestamp}] ${type} bildirimi gönderildi`);
        } else {
          console.log(`⚠️  [${timestamp}] Event bulunamadı, ${type} atlandı`);
        }
        break;
      }

      case NotificationType.NEW_BADGE:
      case NotificationType.ACHIEVEMENT_UNLOCKED:
      case NotificationType.LEVEL_UP:
      case NotificationType.REWARD_EARNED: {
        const badge = await prisma.badge.findFirst({
          orderBy: { createdAt: 'desc' },
        });
        if (badge) {
          await notificationService.sendNotification(
            omerId,
            type,
            {
              badgeId: badge.id,
              badgeName: badge.name || 'Test Badge',
            }
          );
          console.log(`✅ [${timestamp}] ${type} bildirimi gönderildi`);
        } else {
          console.log(`⚠️  [${timestamp}] Badge bulunamadı, ${type} atlandı`);
        }
        break;
      }

      case NotificationType.COMMENT_LIKED:
      case NotificationType.COMMENT_REPLIED: {
        const post = await prisma.contentPost.findFirst({
          where: { userId: omerId },
          orderBy: { createdAt: 'desc' },
        });
        if (post) {
          const comment = await prisma.contentComment.findFirst({
            where: { postId: post.id, userId: omerId },
            orderBy: { createdAt: 'desc' },
          });
          if (comment) {
            if (type === NotificationType.COMMENT_LIKED) {
              const existingLike = await prisma.contentLike.findFirst({
                where: { userId: otherUserId, commentId: comment.id },
              });
              if (existingLike) {
                await interactionService.unlikeComment(otherUserId, comment.id);
                await new Promise(resolve => setTimeout(resolve, 500));
              }
              await interactionService.likeComment(otherUserId, comment.id);
            } else {
              await interactionService.createComment(
                otherUserId,
                post.id,
                randomChoice(randomMessages.POST_COMMENTED),
                comment.id
              );
            }
            console.log(`✅ [${timestamp}] ${type} bildirimi gönderildi`);
          } else {
            console.log(`⚠️  [${timestamp}] Comment bulunamadı, ${type} atlandı`);
          }
        } else {
          console.log(`⚠️  [${timestamp}] Post bulunamadı, ${type} atlandı`);
        }
        break;
      }

      case NotificationType.SYSTEM_ANNOUNCEMENT: {
        await notificationService.sendNotification(
          omerId,
          type,
          {
            message: randomChoice(randomMessages.SYSTEM_ANNOUNCEMENT),
          }
        );
        console.log(`✅ [${timestamp}] ${type} bildirimi gönderildi`);
        break;
      }

      default: {
        await notificationService.sendNotification(
          omerId,
          type,
          {
            message: `Test bildirimi: ${type}`,
          }
        );
        console.log(`✅ [${timestamp}] ${type} bildirimi gönderildi`);
        break;
      }
    }
  } catch (error: any) {
    console.error(`❌ [${timestamp}] ${type} gönderilirken hata: ${error.message}`);
  }
}

// Assets'lerden rastgele avatar seç
function getRandomAvatarPath(): string {
  const avatars = [
    'userprofile/aycan.png',
    'userprofile/burakcan.png',
    'userprofile/furkan.png',
    'userprofile/mehmet.png',
    'userprofile/mihrac.png',
    'userprofile/omer.png',
    'userprofile/ozan.jpg',
    'userprofile/ozan.png',
    'userprofile/man-user.jpg',
    'userprofile/man-user-2.png',
    'userprofile/man-user-3.jpg',
    'userprofile/man-user-4.jpg',
    'userprofile/man-user-5.jpg',
    'userprofile/woman-user.jpg',
    'userprofile/woman-user-2.jpg',
    'userprofile/woman-user-3.jpg',
    'userprofile/woman-user-4.jpg',
    'userprofile/woman-user-5.jpg',
  ];
  return avatars[Math.floor(Math.random() * avatars.length)];
}

// Kullanıcıya avatar ekle (yoksa)
async function ensureUserHasAvatar(userId: string): Promise<void> {
  try {
    const existingAvatar = await prisma.userAvatar.findFirst({
      where: {
        userId,
        isActive: true,
      },
    });

    if (!existingAvatar) {
      const avatarPath = getRandomAvatarPath();
      const { getPublicMediaBaseUrl } = await import('./src/infrastructure/config/media.config');
      const baseUrl = getPublicMediaBaseUrl();
      const avatarUrl = `${baseUrl}/${avatarPath}`;

      await prisma.userAvatar.create({
        data: {
          userId,
          imageUrl: avatarUrl,
          isActive: true,
        },
      });
      console.log(`   ✅ Avatar eklendi: ${avatarUrl}`);
    }
  } catch (error: any) {
    console.log(`   ⚠️  Avatar eklenirken hata: ${error.message}`);
  }
}

async function startRandomNotifications() {
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
        ],
      },
    });

    if (!omer) {
      console.log('❌ Ömer kullanıcısı bulunamadı.');
      await prisma.$disconnect();
      return;
    }

    console.log(`✅ Ömer bulundu: ${omer.id}`);
    await ensureUserHasAvatar(omer.id);
    console.log('');

    // Farklı bir kullanıcı bul
    const otherUser = await prisma.user.findFirst({
      where: { id: { not: omer.id } },
    });

    if (!otherUser) {
      console.log('❌ Farklı kullanıcı bulunamadı.');
      await prisma.$disconnect();
      return;
    }

    console.log(`✅ Test kullanıcısı bulundu: ${otherUser.id}`);
    await ensureUserHasAvatar(otherUser.id);
    console.log('');

    console.log('🚀 Rastgele bildirimler başlatılıyor...');
    console.log('📬 Her 5 saniyede bir rastgele bildirim gönderilecek.\n');
    console.log('⏹️  Durdurmak için Ctrl+C tuşlarına basın.\n');

    let count = 0;
    const interval = setInterval(async () => {
      count++;
      console.log(`\n📨 Bildirim #${count} gönderiliyor...`);
      await sendRandomNotification(omer.id, otherUser.id);
    }, 5000); // 5 saniye

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n⏹️  Durduruluyor...');
      clearInterval(interval);
      await prisma.$disconnect();
      console.log('✅ Bağlantılar kapatıldı. Çıkılıyor...');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Hata:', error);
    logger.error('Random notification test hatası:', error);
  }
}

startRandomNotifications();
