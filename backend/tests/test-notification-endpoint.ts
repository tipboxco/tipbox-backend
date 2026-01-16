import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { NotificationService } from './src/application/notification/notification.service';
import { NotificationType } from './src/domain/notification/notification-type.enum';
import { resolveMediaUrl } from './src/infrastructure/config/media.config';
import { getPrisma } from './src/infrastructure/repositories/prisma.client';

const prisma = getPrisma();
const notificationService = new NotificationService();

async function testEndpoint() {
  try {
    // Ömer kullanıcısını bul
    const omer = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { contains: 'omer', mode: 'insensitive' } },
        ],
      },
    });

    if (!omer) {
      console.log('❌ Ömer kullanıcısı bulunamadı');
      await prisma.$disconnect();
      return;
    }

    console.log(`✅ Ömer bulundu: ${omer.id}\n`);

    // Notification'ları al (router'daki enrich fonksiyonunu simüle et)
    const notifications = await notificationService.getUserNotifications(omer.id, {
      limit: 5,
    });

    console.log(`📬 ${notifications.notifications.length} bildirim bulundu\n`);

    // Enrich fonksiyonunu manuel test et
    const notificationJSONs = notifications.notifications.map((n) => (n as any).toJSON ? (n as any).toJSON() : n);
    
    // Enrich işlemi
    const userIds = new Set<string>();
    notificationJSONs.forEach((notification: any) => {
      const data = notification.data || {};
      if (data.userId) userIds.add(data.userId);
      if (data.likerId) userIds.add(data.likerId);
      if (data.commenterId) userIds.add(data.commenterId);
      if (data.senderId) userIds.add(data.senderId);
    });

    // Avatar'ları al
    const userAvatars = new Map<string, string | null>();
    if (userIds.size > 0) {
      const avatars = await prisma.userAvatar.findMany({
        where: {
          userId: { in: Array.from(userIds) },
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      avatars.forEach((avatar) => {
        if (!userAvatars.has(avatar.userId)) {
          userAvatars.set(avatar.userId, resolveMediaUrl(avatar.imageUrl, true));
        }
      });

      Array.from(userIds).forEach((userId) => {
        if (!userAvatars.has(userId)) {
          userAvatars.set(userId, resolveMediaUrl(null, true));
        }
      });
    }

    // Post görselleri
    const postIds = new Set<string>();
    notificationJSONs.forEach((notification: any) => {
      const data = notification.data || {};
      if (data.postId) postIds.add(data.postId);
    });

    const postImages = new Map<string, string | null>();
    if (postIds.size > 0) {
      const postMediaList = await prisma.postMedia.findMany({
        where: {
          postId: { in: Array.from(postIds) },
        },
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
        select: { postId: true, mediaUrl: true },
      });

      postMediaList.forEach((media) => {
        if (!postImages.has(media.postId)) {
          postImages.set(media.postId, resolveMediaUrl(media.mediaUrl));
        }
      });
    }

    // Random image
    let randomImageCache: string | null = null;
    try {
      const randomBadge = await prisma.badge.findFirst({
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { imageUrl: true },
      });
      if (randomBadge?.imageUrl) {
        randomImageCache = resolveMediaUrl(randomBadge.imageUrl);
      }
    } catch (error) {
      // Ignore
    }

    // Enrich et
    const enriched = notificationJSONs.map((notification: any) => {
      const enriched: any = {
        id: notification.id,
        userId: notification.userId,
        type: notification.type,
        avatarUrl: null,
        imageUrl: null,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        read: notification.read,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt,
      };

      const data = notification.data || {};
      const type = notification.type as NotificationType;

      // POST_FAVORITED için
      if (type === NotificationType.POST_FAVORITED) {
        const userId = data.userId || data.likerId || data.commenterId || data.sharerId;
        if (userId) {
          enriched.avatarUrl = userAvatars.get(userId) || null;
        }
        if (data.postId && postImages.has(data.postId)) {
          enriched.imageUrl = postImages.get(data.postId);
        } else if (randomImageCache) {
          enriched.imageUrl = randomImageCache;
        }
      }

      // POST_LIKED için
      if (type === NotificationType.POST_LIKED) {
        const userId = data.likerId || data.userId;
        if (userId) {
          enriched.avatarUrl = userAvatars.get(userId) || null;
        }
        if (data.postId && postImages.has(data.postId)) {
          enriched.imageUrl = postImages.get(data.postId);
        } else if (randomImageCache) {
          enriched.imageUrl = randomImageCache;
        }
      }

      // POST_COMMENTED için
      if (type === NotificationType.POST_COMMENTED) {
        const userId = data.commenterId || data.userId;
        if (userId) {
          enriched.avatarUrl = userAvatars.get(userId) || null;
        }
        if (data.postId && postImages.has(data.postId)) {
          enriched.imageUrl = postImages.get(data.postId);
        } else if (randomImageCache) {
          enriched.imageUrl = randomImageCache;
        }
      }

      // NEW_MESSAGE için
      if (type === NotificationType.NEW_MESSAGE) {
        const userId = data.senderId || data.userId;
        if (userId) {
          enriched.avatarUrl = userAvatars.get(userId) || null;
        }
        if (randomImageCache) {
          enriched.imageUrl = randomImageCache;
        }
      }

      // EVENT_STARTED için
      if (type === NotificationType.EVENT_STARTED) {
        if (randomImageCache) {
          enriched.imageUrl = randomImageCache;
        }
      }

      return enriched;
    });

    console.log('📋 Enriched Bildirimler:\n');
    enriched.forEach((notif: any, index: number) => {
      console.log(`${index + 1}. ${notif.type}`);
      console.log(`   Title: ${notif.title}`);
      console.log(`   AvatarUrl: ${notif.avatarUrl || 'YOK'}`);
      console.log(`   ImageUrl: ${notif.imageUrl || 'YOK'}`);
      console.log(`   Data: ${JSON.stringify(notif.data)}\n`);
    });

    console.log('\n✅ Test tamamlandı!');
  } catch (error) {
    console.error('❌ Hata:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

testEndpoint();
