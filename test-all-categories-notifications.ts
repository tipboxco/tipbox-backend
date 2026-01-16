import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { NotificationService } from './src/application/notification/notification.service';
import { NotificationType } from './src/domain/notification/notification-type.enum';
import { MessagingService } from './src/application/messaging/messaging.service';
import { InteractionService } from './src/application/interaction/interaction.service';
import { ShareType } from './src/domain/interaction/share-type.enum';
import { ContentPostType } from './src/domain/content/content-post-type.enum';
import logger from './src/infrastructure/logger/logger';
import RedisConfigManager from './src/infrastructure/config/redis.config';
import QueueProvider from './src/infrastructure/queue/queue.provider';
import SocketManager from './src/infrastructure/realtime/socket-manager';
import http from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();
const notificationService = new NotificationService();
const messagingService = new MessagingService();
const interactionService = new InteractionService();

// Her kategoriden birer bildirim tipi (son haline göre)
const CATEGORY_NOTIFICATIONS: { type: NotificationType; category: string }[] = [
  // Post Etkileşimleri
  { type: NotificationType.POST_LIKED, category: 'Post Etkileşimleri' },
  // Yorum Etkileşimleri
  { type: NotificationType.COMMENT_LIKED, category: 'Yorum Etkileşimleri' },
  // Trust & Follow
  { type: NotificationType.NEW_TRUSTER, category: 'Trust & Follow' },
  // Mesajlaşma
  { type: NotificationType.DM_REQUEST_ACCEPTED, category: 'Mesajlaşma' },
  // Gamification
  { type: NotificationType.NEW_BADGE, category: 'Gamification' },
  // Event
  { type: NotificationType.EVENT_STARTED, category: 'Event' },
  // Expert
  { type: NotificationType.EXPERT_REQUEST_AVAILABLE, category: 'Expert' },
  // Collection
  { type: NotificationType.COLLECTION_POST_ADDED, category: 'Collection' },
  // Tips (sadece TIPS_RECEIVED)
  { type: NotificationType.TIPS_RECEIVED, category: 'Tips' },
];

let omerId: string | null = null;
let otherUserIds: string[] = [];
let createdPosts: string[] = [];
let createdComments: string[] = [];
let createdThreads: string[] = [];
let createdEvents: string[] = [];
let createdBadges: string[] = [];
let createdCollections: string[] = [];

async function findOrCreateUsers() {
  // Ömer kullanıcısını bul
  const omer = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { contains: 'omer', mode: 'insensitive' } },
        { email: { contains: 'ömer', mode: 'insensitive' } },
      ],
    },
  });

  if (!omer) {
    throw new Error('Ömer kullanıcısı bulunamadı!');
  }

  omerId = omer.id;
  console.log(`✅ Ömer kullanıcısı bulundu: ${omer.email} (${omerId})`);

  // Diğer kullanıcıları bul veya oluştur
  const trustUsers = await prisma.user.findMany({
    where: {
      email: {
        startsWith: 'trust',
        mode: 'insensitive',
      },
    },
    take: 10,
  });

  if (trustUsers.length < 3) {
    // Yeterli kullanıcı yoksa oluştur
    for (let i = trustUsers.length; i < 3; i++) {
      const newUser = await prisma.user.create({
        data: {
          email: `trustuser${i + 1}@test.com`,
          emailVerified: true,
        },
      });
      trustUsers.push(newUser);
    }
  }

  otherUserIds = trustUsers.map((u) => u.id);
  console.log(`✅ ${otherUserIds.length} kullanıcı hazır`);
}

async function createTestPost(userId: string): Promise<string> {
  const postId = `01${Date.now().toString(36).toUpperCase().padStart(24, '0')}`;
  const post = await prisma.contentPost.create({
    data: {
      id: postId,
      userId,
      type: ContentPostType.TIPS,
      title: `Test Post ${Date.now()}`,
      body: 'Bu bir test postudur.',
      inventoryRequired: false,
      isBoosted: false,
    },
  });
  createdPosts.push(post.id);
  return post.id;
}

async function createTestComment(postId: string, userId: string): Promise<string> {
  const commentId = `01${Date.now().toString(36).toUpperCase().padStart(24, '0')}`;
  const comment = await prisma.contentComment.create({
    data: {
      id: commentId,
      postId,
      userId,
      comment: `Test yorumu ${Date.now()}`,
      isAnswer: false,
      likesCount: 0,
    },
  });
  createdComments.push(comment.id);
  return comment.id;
}

async function createTestEvent(): Promise<string> {
  // Aktif bir event bul veya oluştur
  let event = await prisma.wishboxEvent.findFirst({
    where: {
      status: 'PUBLISHED',
    },
  });

  if (!event) {
    const eventId = uuidv4();
    event = await prisma.wishboxEvent.create({
      data: {
        id: eventId,
        title: `Test Event ${Date.now()}`,
        description: 'Test event açıklaması',
        status: 'PUBLISHED',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  createdEvents.push(event.id);
  return event.id;
}

async function createTestBadge(): Promise<string> {
  // Badge category bul veya oluştur
  let category = await prisma.badgeCategory.findFirst({
    where: { name: 'CUSTOM' },
  });

  if (!category) {
    category = await prisma.badgeCategory.create({
      data: {
        name: 'CUSTOM',
        description: 'Custom badges',
      },
    });
  }

  // Badge bul veya oluştur
  let badge = await prisma.badge.findFirst({
    where: {
      categoryId: category.id,
    },
  });

  if (!badge) {
    badge = await prisma.badge.create({
      data: {
        name: `Test Badge ${Date.now()}`,
        description: 'Test badge açıklaması',
        categoryId: category.id,
        type: 'COSMETIC',
        rarity: 'COMMON',
        imageUrl: 'badges/brand/brandbadge1.png',
      },
    });
  }

  createdBadges.push(badge.id);
  return badge.id;
}

async function createTestCollection(userId: string): Promise<string> {
  const collectionId = uuidv4();
  const collection = await prisma.contentCollection.create({
    data: {
      id: collectionId,
      userId,
      name: `Test Collection ${Date.now()}`,
      description: 'Test collection açıklaması',
    },
  });
  createdCollections.push(collection.id);
  return collection.id;
}

async function sendNotificationForType(
  type: NotificationType,
  category: string
) {
  if (!omerId || otherUserIds.length === 0) {
    throw new Error('Kullanıcılar hazır değil!');
  }

  const otherUserId = otherUserIds[Math.floor(Math.random() * otherUserIds.length)];

  console.log(`\n📨 [${category}] ${type} bildirimi gönderiliyor...`);

  try {
    let data: any = {};

    switch (type) {
      // Post Etkileşimleri
      case NotificationType.POST_LIKED: {
        let postId = createdPosts[createdPosts.length - 1];
        if (!postId) {
          postId = await createTestPost(omerId);
        }
        await interactionService.likePost(otherUserId, postId);
        data = {
          postId,
          likerId: otherUserId,
        };
        break;
      }

      // Yorum Etkileşimleri
      case NotificationType.COMMENT_LIKED: {
        let postId = createdPosts[createdPosts.length - 1];
        if (!postId) {
          postId = await createTestPost(omerId);
        }
        let commentId = createdComments[createdComments.length - 1];
        if (!commentId) {
          commentId = await createTestComment(postId, otherUserId);
        }
        await interactionService.likeComment(otherUserId, commentId);
        data = {
          postId,
          commentId,
          likerId: otherUserId,
        };
        break;
      }

      // Trust & Follow
      case NotificationType.NEW_TRUSTER: {
        // Trust relationship oluştur
        await prisma.trustRelation.create({
          data: {
            trusterId: otherUserId,
            trustedUserId: omerId,
          },
        }).catch(() => {
          // Zaten varsa hata vermesin
        });
        data = {
          trusterId: otherUserId,
        };
        break;
      }

      // Mesajlaşma
      case NotificationType.DM_REQUEST_ACCEPTED: {
        // Önce bir request oluştur, sonra accept et
        const request = await prisma.dMRequest.create({
          data: {
            fromUserId: omerId,
            toUserId: otherUserId,
            status: 'PENDING',
            type: 'GENERAL',
            amount: 50,
            description: 'Test request',
          },
        });

        // Thread oluştur
        const thread = await prisma.dMThread.create({
          data: {
            userOneId: omerId,
            userTwoId: otherUserId,
            isActive: true,
            isSupportThread: true,
            startedAt: new Date(),
          },
        });

        // Request'i accept et
        await prisma.dMRequest.update({
          where: { id: request.id },
          data: {
            status: 'ACCEPTED',
            threadId: thread.id,
            respondedAt: new Date(),
          },
        });

        const expert = await prisma.user.findUnique({
          where: { id: otherUserId },
        });

        data = {
          userId: otherUserId,
          threadId: thread.id,
        };
        break;
      }

      // Gamification
      case NotificationType.NEW_BADGE: {
        const badgeId = await createTestBadge();
        data = {
          badgeId,
          badgeName: `Test Badge ${Date.now()}`,
        };
        break;
      }

      // Event
      case NotificationType.EVENT_STARTED: {
        const eventId = await createTestEvent();
        const event = await prisma.wishboxEvent.findUnique({
          where: { id: eventId },
        });
        data = {
          eventId,
          eventName: event?.title || 'Test Event',
        };
        break;
      }

      // Expert
      case NotificationType.EXPERT_REQUEST_AVAILABLE: {
        // Expert request oluştur
        const expertRequest = await prisma.expertRequest.create({
          data: {
            userId: otherUserId,
            description: 'Test expert sorusu',
            status: 'BROADCASTING',
            tipsAmount: 200,
          },
        });
        data = {
          requestId: expertRequest.id,
          expertId: otherUserId,
          tipsAmount: 200,
        };
        break;
      }

      // Collection
      case NotificationType.COLLECTION_POST_ADDED: {
        const collectionId = await createTestCollection(otherUserId);
        let postId = createdPosts[createdPosts.length - 1];
        if (!postId) {
          postId = await createTestPost(omerId);
        }
        // Collection'a post ekle (eğer ContentCollectionPost modeli varsa)
        // Şimdilik sadece notification gönder, collection-post ilişkisi opsiyonel
        data = {
          collectionId,
          postId,
        };
        break;
      }

      // Tips
      case NotificationType.TIPS_RECEIVED: {
        const amount = Math.floor(Math.random() * 1000) + 100;
        // TIPS_RECEIVED için sadece userId ve amount
        data = {
          userId: otherUserId,
          amount,
        };
        break;
      }
    }

    // Bildirimi gönder
    await notificationService.sendNotification(omerId, type, data);

    console.log(`✅ [${category}] ${type} bildirimi gönderildi!`);

  } catch (error: any) {
    console.error(`❌ [${category}] ${type} bildirimi gönderilirken hata:`, error.message);
    logger.error(`Error sending ${type} notification:`, error);
  }
}

async function initializeServices() {
  try {
    console.log('🔧 Servisler başlatılıyor...');
    await RedisConfigManager.getInstance().initialize();
    await QueueProvider.getInstance().initialize();
    
    const httpServer = http.createServer();
    const io = new Server(httpServer, {
      cors: { origin: '*' },
      transports: ['websocket', 'polling'],
    });
    SocketManager.getInstance().initialize(io);
    
    console.log('✅ Servisler başlatıldı!\n');
  } catch (error: any) {
    console.log(`⚠️  Servis uyarısı: ${error.message}\n`);
  }
}

async function startCategoryNotifications() {
  try {
    console.log('🚀 Tüm kategorilerden bildirim gönderme başlatılıyor...\n');

    await initializeServices();
    await findOrCreateUsers();

    console.log(`\n📋 Toplam ${CATEGORY_NOTIFICATIONS.length} kategori bildirimi gönderilecek\n`);

    for (let i = 0; i < CATEGORY_NOTIFICATIONS.length; i++) {
      const { type, category } = CATEGORY_NOTIFICATIONS[i];
      
      await sendNotificationForType(type, category);

      // Son bildirim değilse 5 saniye bekle
      if (i < CATEGORY_NOTIFICATIONS.length - 1) {
        console.log(`\n⏳ 5 saniye bekleniyor...\n`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    console.log(`\n✅ Tüm kategorilerden bildirimler gönderildi!`);
    console.log(`📊 Toplam: ${CATEGORY_NOTIFICATIONS.length} bildirim\n`);

  } catch (error: any) {
    console.error('❌ Hata:', error.message);
    logger.error('Error in startCategoryNotifications:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Script'i çalıştır
startCategoryNotifications().catch(console.error);
