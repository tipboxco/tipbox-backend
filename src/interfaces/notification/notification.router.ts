import { Router, Request, Response } from 'express';
import { NotificationService } from '../../application/notification/notification.service';
import { PushTokenService } from '../../application/notification/push-token.service';
import { UserSettingsPrismaRepository } from '../../infrastructure/repositories/user-settings-prisma.repository';
import { RegisterPushTokenDto, UpdateNotificationSettingsDto, GetNotificationsQuery } from './notification.dto';
import { authMiddleware } from '../auth/auth.middleware';
import logger from '../../infrastructure/logger/logger';
import { parseQueryInt, parseQueryBoolean } from '../../infrastructure/utils/query-parser';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import { NotificationType } from '../../domain/notification/notification-type.enum';

const router = Router();
const notificationService = new NotificationService();
const pushTokenService = new PushTokenService();
const settingsRepo = new UserSettingsPrismaRepository();
const prisma = getPrisma();

/**
 * Notification'ları enrich eder - avatar URL'leri ve görseller ekler
 * Tüm 22 notification type'ı destekler
 */
async function enrichNotifications(notifications: any[]): Promise<any[]> {
  try {
  // Tüm user ID'leri topla
  const userIds = new Set<string>();
  const eventIds = new Set<string>();
  const badgeIds = new Set<string>();
  const postIds = new Set<string>();
  const productIds = new Set<string>();
  const collectionIds = new Set<string>();

  notifications.forEach((notification) => {
    const data = notification.data || {};
    
    // User etkileşimleri için user ID'leri topla
    if (data.trusterId) userIds.add(data.trusterId);
    if (data.trustedId) userIds.add(data.trustedId);
    if (data.likerId) userIds.add(data.likerId);
    if (data.commenterId) userIds.add(data.commenterId);
    if (data.replierId) userIds.add(data.replierId);
    if (data.sharerId) userIds.add(data.sharerId);
    if (data.senderId) userIds.add(data.senderId);
    if (data.requesterId) userIds.add(data.requesterId);
    if (data.accepterId) userIds.add(data.accepterId);
    if (data.expertId) userIds.add(data.expertId);
    if (data.userId) userIds.add(data.userId);
    
    // Event bildirimleri için event ID'leri topla
    if (data.eventId) eventIds.add(data.eventId);
    
    // Badge bildirimleri için badge ID'leri topla
    if (data.badgeId) badgeIds.add(data.badgeId);
    
    // Post bildirimleri için post ID'leri topla
    if (data.postId) postIds.add(data.postId);
    
    // Product bildirimleri için product ID'leri topla
    if (data.productId) productIds.add(data.productId);
    
    // Collection bildirimleri için collection ID'leri topla
    if (data.collectionId) collectionIds.add(data.collectionId);
  });

  // Batch olarak user avatar'ları al
  const userAvatars = new Map<string, string | null>();
  if (userIds.size > 0) {
    // Her kullanıcı için en son aktif avatar'ı al
    const userIdArray = Array.from(userIds);
    const avatars = await prisma.userAvatar.findMany({
      where: {
        userId: { in: userIdArray },
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Her kullanıcı için sadece ilk (en yeni) avatar'ı al
    avatars.forEach((avatar) => {
      if (!userAvatars.has(avatar.userId)) {
        userAvatars.set(avatar.userId, resolveMediaUrl(avatar.imageUrl, true));
      }
    });

    // Avatar'ı olmayan kullanıcılar için default avatar
    userIdArray.forEach((userId) => {
      if (!userAvatars.has(userId)) {
        userAvatars.set(userId, resolveMediaUrl(null, true));
      }
    });
    
    // Debug: userAvatars map'ini logla
    logger.debug(`Loaded ${userAvatars.size} user avatars for ${userIds.size} users`);
  }

  // Batch olarak event görselleri al
  const eventImages = new Map<string, string | null>();
  if (eventIds.size > 0) {
    const events = await prisma.wishboxEvent.findMany({
      where: { id: { in: Array.from(eventIds) } },
      select: { id: true, imageUrl: true },
    });

    events.forEach((event) => {
      eventImages.set(event.id, resolveMediaUrl(event.imageUrl));
    });
  }

  // Batch olarak badge görselleri al
  const badgeImages = new Map<string, string | null>();
  if (badgeIds.size > 0) {
    const badges = await prisma.badge.findMany({
      where: { id: { in: Array.from(badgeIds) } },
      select: { id: true, imageUrl: true },
    });

    badges.forEach((badge) => {
      badgeImages.set(badge.id, resolveMediaUrl(badge.imageUrl));
    });
  }

  // Batch olarak post görselleri al (post media'dan)
  const postImages = new Map<string, string | null>();
  if (postIds.size > 0) {
    // Post'ların media'larını al
    const postMediaList = await prisma.postMedia.findMany({
      where: {
        postId: { in: Array.from(postIds) },
      },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      select: { postId: true, mediaUrl: true },
    });

    // Her post için ilk media'yı al
    postMediaList.forEach((media) => {
      if (!postImages.has(media.postId)) {
        postImages.set(media.postId, resolveMediaUrl(media.mediaUrl));
      }
    });
  }

  // Batch olarak product görselleri al
  const productImages = new Map<string, string | null>();
  if (productIds.size > 0) {
    const products = await prisma.product.findMany({
      where: { id: { in: Array.from(productIds) } },
      select: { id: true, imageUrl: true },
    });

    products.forEach((product) => {
      productImages.set(product.id, resolveMediaUrl(product.imageUrl));
    });
  }

  // Batch olarak collection görselleri al (ContentCollection'da imageUrl yok, random image kullan)
  const collectionImages = new Map<string, string | null>();
  // Collection'lar için görsel yok, random image kullanılacak

  // Random görseli bir kez al (tüm notification'lar için cache)
  let randomImageCache: string | null = null;
  try {
    // Badge'lerden random seç
    const randomBadge = await prisma.badge.findFirst({
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { imageUrl: true },
    });
    if (randomBadge?.imageUrl) {
      randomImageCache = resolveMediaUrl(randomBadge.imageUrl);
    } else {
      // Product'lardan random seç
      const randomProduct = await prisma.product.findFirst({
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { imageUrl: true },
      });
      if (randomProduct?.imageUrl) {
        randomImageCache = resolveMediaUrl(randomProduct.imageUrl);
      } else {
        // Event'lerden random seç
        const randomEvent = await prisma.wishboxEvent.findFirst({
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { imageUrl: true },
        });
        if (randomEvent?.imageUrl) {
          randomImageCache = resolveMediaUrl(randomEvent.imageUrl);
        }
      }
    }
  } catch (error) {
    logger.error('Error getting random image:', error);
  }


  // Notification'ları enrich et
  return notifications.map((notification) => {
    // type'dan hemen sonra avatar ve imageUrl eklemek için sıralı object oluştur
    const enriched: any = {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      avatar: undefined as string | null | undefined,
      imageUrl: undefined as string | null | undefined,
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

    // Eğer data'da zaten avatar varsa (enricher'dan gelmişse), onu kullan
    if (data.avatar) {
      enriched.avatar = data.avatar;
    }

    // Avatar URL'leri ekle (tüm user etkileşimleri için)
    // Post ile ilgili (4)
    if (
      type === NotificationType.POST_LIKED ||
      type === NotificationType.POST_COMMENTED ||
      type === NotificationType.POST_SHARED ||
      type === NotificationType.POST_FAVORITED
    ) {
      const userId = data.likerId || data.commenterId || data.sharerId || data.userId;
      if (userId && !enriched.avatar) {
        // Data'da avatar yoksa, userAvatars'tan al
        enriched.avatar = userAvatars.get(userId) || randomImageCache || null;
      }
      // Post görseli ekle
      if (data.postId && postImages.has(data.postId)) {
        enriched.imageUrl = postImages.get(data.postId);
      } else if (data.productId && productImages.has(data.productId)) {
        enriched.imageUrl = productImages.get(data.productId);
      } else if (randomImageCache) {
        enriched.imageUrl = randomImageCache;
      }
    }

    // Yorum ile ilgili (2)
    if (type === NotificationType.COMMENT_LIKED || type === NotificationType.COMMENT_REPLIED) {
      const userId = data.likerId || data.replierId || data.commenterId;
      if (userId && !enriched.avatar) {
        enriched.avatar = userAvatars.get(userId) || randomImageCache || null;
      }
      // Post görseli ekle
      if (data.postId && postImages.has(data.postId)) {
        enriched.imageUrl = postImages.get(data.postId);
      } else if (randomImageCache) {
        enriched.imageUrl = randomImageCache;
      }
    }

    // Trust/Follow ile ilgili (2)
    if (type === NotificationType.NEW_TRUSTER || type === NotificationType.NEW_TRUSTED_BY) {
      const userId = data.trusterId || data.trustedId;
      if (userId && !enriched.avatar) {
        enriched.avatar = userAvatars.get(userId) || randomImageCache || null;
      }
      if (randomImageCache) {
        enriched.imageUrl = randomImageCache;
      }
    }

    // Mesajlaşma ile ilgili (3)
    if (
      type === NotificationType.NEW_MESSAGE ||
      type === NotificationType.DM_REQUEST_RECEIVED ||
      type === NotificationType.DM_REQUEST_ACCEPTED ||
      type === NotificationType.SUPPORT_REQUEST_ACCEPTED
    ) {
      const userId = data.senderId || data.requesterId || data.accepterId;
      if (userId && !enriched.avatar) {
        enriched.avatar = userAvatars.get(userId) || randomImageCache || null;
      }
      if (randomImageCache) {
        enriched.imageUrl = randomImageCache;
      }
    }

    // Gamification ile ilgili (3)
    if (
      type === NotificationType.NEW_BADGE ||
      type === NotificationType.ACHIEVEMENT_UNLOCKED ||
      type === NotificationType.REWARD_EARNED
    ) {
      if (data.badgeId && badgeImages.has(data.badgeId)) {
        enriched.imageUrl = badgeImages.get(data.badgeId);
      } else if (randomImageCache) {
        enriched.imageUrl = randomImageCache;
      }
    }

    // Expert ile ilgili (2)
    if (
      type === NotificationType.EXPERT_REQUEST_AVAILABLE ||
      type === NotificationType.EXPERT_REQUEST_ANSWERED
    ) {
      const userId = data.expertId || data.requesterId;
      if (userId && !enriched.avatar) {
        enriched.avatar = userAvatars.get(userId) || randomImageCache || null;
      }
      if (data.productId && productImages.has(data.productId)) {
        enriched.imageUrl = productImages.get(data.productId);
      } else if (randomImageCache) {
        enriched.imageUrl = randomImageCache;
      }
    }

    // Sistem/Tips ile ilgili (3)
    if (
      type === NotificationType.SYSTEM_ANNOUNCEMENT ||
      type === NotificationType.TIPS_RECEIVED ||
      type === NotificationType.TIPS_SENT
    ) {
      const userId = data.senderId || data.userId;
      if (userId && !enriched.avatar) {
        enriched.avatar = userAvatars.get(userId) || randomImageCache || null;
      }
      if (randomImageCache) {
        enriched.imageUrl = randomImageCache;
      }
    }

    // Event ile ilgili (3)
    if (
      type === NotificationType.EVENT_STARTED ||
      type === NotificationType.EVENT_ENDING_SOON ||
      type === NotificationType.EVENT_REWARD_AVAILABLE
    ) {
      if (data.eventId && eventImages.has(data.eventId)) {
        enriched.imageUrl = eventImages.get(data.eventId);
      } else if (randomImageCache) {
        enriched.imageUrl = randomImageCache;
      }
    }

    // Collection ile ilgili (2)
    if (
      type === NotificationType.COLLECTION_POST_ADDED ||
      type === NotificationType.COLLECTION_SHARED
    ) {
      // Collection için post görseli veya random image kullan
      if (data.postId && postImages.has(data.postId)) {
        enriched.imageUrl = postImages.get(data.postId);
      } else if (randomImageCache) {
        enriched.imageUrl = randomImageCache;
      }
    }

    // undefined değerleri null yap (response'da görünsün ama null olsun)
    // Avatar için: null yerine random avatar veya default avatar kullan
    if (enriched.avatar === undefined) {
      enriched.avatar = randomImageCache || null;
    }
    if (enriched.imageUrl === undefined) enriched.imageUrl = null;
    
    // Mobil uyumluluk için: avatar'ı avatarUrl olarak da ekle (backward compatibility)
    if (enriched.avatar !== undefined) {
      enriched.avatarUrl = enriched.avatar;
    }
    
    return enriched;
  });
  } catch (error) {
    logger.error('Error in enrichNotifications:', error);
    // Hata durumunda original notification'ları döndür
    return notifications;
  }
}

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags:
 *       - Notifications
 *     summary: Get user notifications
 *     description: Retrieve a paginated list of user notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of notifications to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of notifications to skip
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Filter only unread notifications
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by notification type (e.g., POST_LIKED, NEW_MESSAGE, NEW_TRUSTER)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [POST, TRUST, MESSAGE, SUPPORT, COLLECTION, GAMIFICATION, EXPERT, EVENT, SYSTEM]
 *         description: Filter by notification category
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in notification title and message
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total number of notifications
 *                     limit:
 *                       type: integer
 *                       description: Number of notifications per page
 *                     offset:
 *                       type: integer
 *                       description: Number of notifications skipped
 *                     hasMore:
 *                       type: boolean
 *                       description: Whether there are more notifications available
 *       500:
 *         description: Server error
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { limit, offset, unreadOnly, type } = req.query as unknown as GetNotificationsQuery;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;

    // Import enums and repository
    const { NotificationType } = await import('../../domain/notification/notification-type.enum');
    const { NotificationPrismaRepository } = await import('../../infrastructure/repositories/notification-prisma.repository');

    const notificationRepo = new NotificationPrismaRepository();
    
    // Mobil uygulama kategorileri: all, tips, truster, replies
    // Kategori isimlerini notification type'larına çevir
    let types: NotificationType[] | undefined = undefined;
    
    if (type) {
      const category = (type as string).toLowerCase();
      
      switch (category) {
        case 'all':
          // Tüm bildirimler
          types = undefined;
          break;
        case 'tips':
          // Tips bildirimleri
          types = [NotificationType.TIPS_RECEIVED, NotificationType.TIPS_SENT];
          break;
        case 'truster':
        case 'trust':
          // Trust/Follow bildirimleri
          types = [NotificationType.NEW_TRUSTER, NotificationType.NEW_TRUSTED_BY];
          break;
        case 'replies':
        case 'reply':
          // Yorum ve cevap bildirimleri
          types = [
            NotificationType.POST_COMMENTED,
            NotificationType.COMMENT_REPLIED,
            NotificationType.COMMENT_LIKED
          ];
          break;
        default:
          // Direkt notification type ise (örn: POST_LIKED)
          // NotificationType enum'ında var mı kontrol et
          if (Object.values(NotificationType).includes(type as NotificationType)) {
            types = [type as NotificationType];
          } else {
            // Geçersiz kategori/type, tüm bildirimleri göster
            types = undefined;
          }
      }
    }

    // Repository'de types array desteği eklendi, direkt kullanabiliriz
    const [notifications, total] = await Promise.all([
      notificationRepo.findByUserId(userId, {
        limit: parseQueryInt(limit, 20),
        offset: parseQueryInt(offset, 0),
        unreadOnly: parseQueryBoolean(unreadOnly),
        types: types, // undefined = tüm tipler
        search,
      }),
      notificationRepo.getTotalCount(userId, {
        unreadOnly: parseQueryBoolean(unreadOnly),
        types: types, // undefined = tüm tipler
        search,
      }),
    ]);

    // Notification'ları JSON'a çevir
    const notificationJSONs = notifications.map((n) => n.toJSON());
    
    // Avatar URL'leri ve görselleri ekle
    let enrichedNotifications;
    try {
      enrichedNotifications = await enrichNotifications(notificationJSONs);
    } catch (enrichError) {
      logger.error('Error enriching notifications:', enrichError);
      // Enrich hatası olsa bile notification'ları döndür
      enrichedNotifications = notificationJSONs;
    }

    return res.json({
      success: true,
      data: enrichedNotifications,
      pagination: {
        total,
        limit: parseQueryInt(limit, 20),
        offset: parseQueryInt(offset, 0),
        hasMore: parseQueryInt(offset, 0) + notifications.length < total,
      },
    });
  } catch (error) {
    logger.error('Error getting notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get notifications',
    });
  }
});

/**
 * @openapi
 * /notifications/unread-count:
 *   get:
 *     tags:
 *       - Notifications
 *     summary: Get unread notifications count
 *     description: Get the total count of unread notifications for the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *       500:
 *         description: Server error
 */
router.get('/unread-count', authMiddleware, async (req: Request, res: Response) => {
  // Timeout kontrolü için timer
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      logger.warn('Unread count endpoint timeout - request taking too long');
      res.status(504).json({
        success: false,
        message: 'Request timeout - please try again',
      });
    }
  }, 8000); // 8 saniye timeout (mobil client 10 saniye bekliyor)

  try {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    
    if (!userId) {
      clearTimeout(timeout);
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const count = await notificationService.getUnreadCount(userId);

    clearTimeout(timeout);
    return res.json({
      success: true,
      data: { count },
    });
  } catch (error: any) {
    clearTimeout(timeout);
    logger.error('Error getting unread count:', error);
    
    // Timeout hatası için özel mesaj
    if (error.code === 'P2024' || error.message?.includes('timeout')) {
      return res.status(504).json({
        success: false,
        message: 'Database query timeout - please try again',
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
    });
  }
});

/**
 * @openapi
 * /notifications/{id}/read:
 *   put:
 *     tags:
 *       - Notifications
 *     summary: Mark notification as read
 *     description: Mark a specific notification as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       500:
 *         description: Server error
 */
router.put('/:id/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    
    await notificationService.markAsRead(id);

    // Mobil için: Socket ile unread count güncellemesi gönder
    if (userId) {
      try {
        const { default: SocketManager } = await import('../../infrastructure/realtime/socket-manager');
        const socketManager = SocketManager.getInstance();
        const socketHandler = socketManager.getSocketHandler();
        
        const unreadCount = await notificationService.getUnreadCount(userId);
        socketHandler.sendMessageToUser(userId, 'notification_count_updated', {
          unreadCount,
        });
      } catch (socketError) {
        // Socket hatası durumunda devam et, sadece log'la
        logger.debug('Failed to send unread count update via socket:', socketError);
      }
    }

    return res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
    });
  }
});

/**
 * @openapi
 * /notifications/mark-all-read:
 *   put:
 *     tags:
 *       - Notifications
 *     summary: Mark all notifications as read
 *     description: Mark all user notifications as read
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *       500:
 *         description: Server error
 */
router.put('/mark-all-read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const count = await notificationService.markAllAsRead(userId);

    // Mobil için: Socket ile unread count güncellemesi gönder (0 olmalı)
    try {
      const { default: SocketManager } = await import('../../infrastructure/realtime/socket-manager');
      const socketManager = SocketManager.getInstance();
      const socketHandler = socketManager.getSocketHandler();
      
      const unreadCount = await notificationService.getUnreadCount(userId);
      socketHandler.sendMessageToUser(userId, 'notification_count_updated', {
        unreadCount,
      });
    } catch (socketError) {
      // Socket hatası durumunda devam et, sadece log'la
      logger.debug('Failed to send unread count update via socket:', socketError);
    }

    return res.json({
      success: true,
      message: `${count} notifications marked as read`,
      data: { count },
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
    });
  }
});

/**
 * @openapi
 * /notifications/{id}:
 *   delete:
 *     tags:
 *       - Notifications
 *     summary: Delete a notification
 *     description: Delete a specific notification
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 *       500:
 *         description: Server error
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await notificationService.deleteNotification(id);

    return res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
    });
  }
});

/**
 * @openapi
 * /notifications/settings:
 *   get:
 *     tags:
 *       - Notifications
 *     summary: Get notification settings
 *     description: Get user's notification preferences
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/NotificationSettings'
 *       500:
 *         description: Server error
 */
router.get('/settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const settings = await settingsRepo.findByUserId(userId);

    if (!settings) {
      return res.json({
        success: true,
        data: {
          trustNotifications: true,
          supportNotifications: true,
          messageNotifications: true,
          collectionNotifications: true,
          postNotifications: true,
          notificationEmailEnabled: true,
          notificationPushEnabled: true,
          notificationInAppEnabled: true,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        trustNotifications: settings.trustNotifications,
        supportNotifications: settings.supportNotifications,
        messageNotifications: settings.messageNotifications,
        collectionNotifications: settings.collectionNotifications,
        postNotifications: settings.postNotifications,
        notificationEmailEnabled: settings.notificationEmailEnabled,
        notificationPushEnabled: settings.notificationPushEnabled,
        notificationInAppEnabled: settings.notificationInAppEnabled,
      },
    });
  } catch (error) {
    logger.error('Error getting notification settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get notification settings',
    });
  }
});

/**
 * @openapi
 * /notifications/settings:
 *   put:
 *     tags:
 *       - Notifications
 *     summary: Update notification settings
 *     description: Update user's notification preferences
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateNotificationSettings'
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *       500:
 *         description: Server error
 */
router.put('/settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const updates: UpdateNotificationSettingsDto = req.body;

    let settings = await settingsRepo.findByUserId(userId);

    if (!settings) {
      settings = await settingsRepo.create(userId);
    }

    await settingsRepo.updateByUserId(userId, updates);

    return res.json({
      success: true,
      message: 'Notification settings updated',
    });
  } catch (error) {
    logger.error('Error updating notification settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update notification settings',
    });
  }
});

/**
 * @openapi
 * /notifications/push-token:
 *   post:
 *     tags:
 *       - Notifications
 *     summary: Register push token
 *     description: Register an Expo push notification token for the current user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - deviceType
 *             properties:
 *               token:
 *                 type: string
 *                 description: Expo push notification token
 *               deviceType:
 *                 type: string
 *                 enum: [ios, android, web]
 *                 description: Device type
 *     responses:
 *       200:
 *         description: Push token registered successfully
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Server error
 */
router.post('/push-token', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { token, deviceType }: RegisterPushTokenDto = req.body;

    if (!token || !deviceType) {
      return res.status(400).json({
        success: false,
        message: 'Token and deviceType are required',
      });
    }

    const pushToken = await pushTokenService.registerPushToken(userId, token, deviceType);

    return res.json({
      success: true,
      message: 'Push token registered successfully',
      data: pushToken.toJSON(),
    });
  } catch (error) {
    logger.error('Error registering push token:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register push token',
    });
  }
});

/**
 * @openapi
    * /notifications/push-token:
 *   delete:
 *     tags:
 *       - Notifications
 *     summary: Delete push token
 *     description: Remove a registered push notification token
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Expo push notification token to remove
 *     responses:
 *       200:
 *         description: Push token deleted successfully
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Server error
 */
router.delete('/push-token', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required',
      });
    }

    await pushTokenService.deletePushToken(token);

    return res.json({
      success: true,
      message: 'Push token deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting push token:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete push token',
    });
  }
});

export default router;

