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
  const expertRequestIds = new Set<string>();
  const supportRequestIds = new Set<string>();
  const commentIds = new Set<string>();

  notifications.forEach((notification) => {
    const data = notification.data || {};
    const type = notification.type as NotificationType;
    
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
    
    // Tips bildirimleri için senderId ve recipientId ekle
    if (type === NotificationType.TIPS_RECEIVED) {
      if (data.senderId) userIds.add(data.senderId);
      if (data.senderUserId) userIds.add(data.senderUserId);
    }
    if (type === NotificationType.TIPS_SENT) {
      if (data.recipientId) userIds.add(data.recipientId);
      if (data.recipientUserId) userIds.add(data.recipientUserId);
    }
    
    // Event bildirimleri için event ID'leri topla
    if (data.eventId) eventIds.add(data.eventId);
    
    // Badge bildirimleri için badge ID'leri topla
    if (data.badgeId) badgeIds.add(data.badgeId);
    
    // Post bildirimleri için post ID'leri topla
    if (data.postId) postIds.add(data.postId);
    
    // Comment bildirimleri için comment ID'leri topla (POST_COMMENTED, COMMENT_LIKED, COMMENT_REPLIED)
    if (data.commentId) commentIds.add(data.commentId);
    
    // Product bildirimleri için product ID'leri topla
    if (data.productId) productIds.add(data.productId);
    
    // Collection bildirimleri için collection ID'leri topla
    if (data.collectionId) collectionIds.add(data.collectionId);
    
    // Expert request ID'leri topla (hem AVAILABLE hem ANSWERED için)
    if (data.requestId && (
      type === NotificationType.EXPERT_REQUEST_AVAILABLE ||
      type === NotificationType.EXPERT_REQUEST_ANSWERED
    )) {
      expertRequestIds.add(data.requestId);
    }
    
    // Support request ID'leri topla (threadId'den bulunacak)
    if (data.threadId && type === NotificationType.SUPPORT_REQUEST_ACCEPTED) {
      // threadId'den request bulunacak
    }
  });

  // Batch olarak user avatar'ları ve username'leri al
  const userAvatars = new Map<string, string | null>();
  const userNames = new Map<string, string | null>();
  if (userIds.size > 0) {
    // Her kullanıcı için en son aktif avatar'ı al
    const userIdArray = Array.from(userIds);
    const [avatars, profiles] = await Promise.all([
      prisma.userAvatar.findMany({
        where: {
          userId: { in: userIdArray },
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.profile.findMany({
        where: {
          userId: { in: userIdArray },
        },
        select: {
          userId: true,
          userName: true,
          displayName: true,
        },
      }),
    ]);

    // Her kullanıcı için sadece ilk (en yeni) avatar'ı al
    avatars.forEach((avatar) => {
      if (!userAvatars.has(avatar.userId)) {
        userAvatars.set(avatar.userId, resolveMediaUrl(avatar.imageUrl, true));
      }
    });

    // Username'leri map'e ekle
    profiles.forEach((profile) => {
      userNames.set(profile.userId, profile.userName || profile.displayName || null);
    });

    // Avatar'ı olmayan kullanıcılar için default avatar
    userIdArray.forEach((userId) => {
      if (!userAvatars.has(userId)) {
        userAvatars.set(userId, resolveMediaUrl(null, true));
      }
      if (!userNames.has(userId)) {
        userNames.set(userId, null);
      }
    });
    
    // Debug: userAvatars map'ini logla
    logger.debug(`Loaded ${userAvatars.size} user avatars and ${userNames.size} usernames for ${userIds.size} users`);
  }

  // Batch olarak event görselleri, isimleri ve type'ları al
  const eventImages = new Map<string, string | null>();
  const eventNames = new Map<string, string | null>();
  const eventTypes = new Map<string, string | null>();
  if (eventIds.size > 0) {
    const events = await prisma.wishboxEvent.findMany({
      where: { id: { in: Array.from(eventIds) } },
      select: { id: true, imageUrl: true, title: true },
    });

    events.forEach((event) => {
      eventImages.set(event.id, resolveMediaUrl(event.imageUrl));
      eventNames.set(event.id, event.title || null);
      // eventType field'ı schema'da olmayabilir, şimdilik null
      // TODO: eventType field'ı schema'ya eklendiğinde burayı güncelle
      eventTypes.set(event.id, null);
    });
    
    // eventType'ı raw query ile almayı dene (field varsa)
    try {
      const eventsWithType = await prisma.$queryRaw<any[]>`
        SELECT id, event_type
        FROM wishbox_events
        WHERE id = ANY(${Array.from(eventIds)}::text[])
      `;
      eventsWithType.forEach((event) => {
        if (event.event_type) {
          eventTypes.set(event.id, event.event_type);
        }
      });
    } catch (error) {
      // eventType field'ı yoksa null kalır, sorun değil
      logger.debug('eventType field not found in wishbox_events table');
    }
  }

  // Batch olarak badge görselleri ve isimleri al
  const badgeImages = new Map<string, string | null>();
  const badgeNames = new Map<string, string | null>();
  if (badgeIds.size > 0) {
    const badges = await prisma.badge.findMany({
      where: { id: { in: Array.from(badgeIds) } },
      select: { id: true, imageUrl: true, name: true },
    });

    badges.forEach((badge) => {
      badgeImages.set(badge.id, resolveMediaUrl(badge.imageUrl));
      badgeNames.set(badge.id, badge.name || null);
    });
  }

  // Batch olarak post görselleri ve post bilgileri al (post media'dan)
  const postImages = new Map<string, string | null>();
  const postContents = new Map<string, string | null>();
  const postTypes = new Map<string, string | null>();
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

    // Post'ların content ve type bilgilerini al
    const posts = await prisma.contentPost.findMany({
      where: { id: { in: Array.from(postIds) } },
      select: { id: true, body: true, type: true },
    });

    posts.forEach((post) => {
      postContents.set(post.id, post.body);
      postTypes.set(post.id, post.type);
    });
  }

  // Batch olarak comment bilgileri al
  const commentDescriptions = new Map<string, string | null>();
  if (commentIds.size > 0) {
    const comments = await prisma.contentComment.findMany({
      where: { id: { in: Array.from(commentIds) } },
      select: { id: true, comment: true },
    });

    comments.forEach((comment) => {
      commentDescriptions.set(comment.id, comment.comment);
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

  // Batch olarak expert request bilgilerini al (expert bilgileri için)
  const expertRequestInfo = new Map<string, {
    expertUserId?: string;
    expertName?: string;
    expertTitle?: string;
    expertAvatar?: string | null;
    threadId?: string;
    requesterName?: string; // EXPERT_REQUEST_AVAILABLE için request sahibi bilgileri
    requesterTitle?: string;
    requesterAvatar?: string | null;
  }>();
  
  if (expertRequestIds.size > 0) {
    const expertRequests = await prisma.expertRequest.findMany({
      where: { id: { in: Array.from(expertRequestIds) } },
      include: {
        user: {
          include: {
            profile: true,
            titles: {
              orderBy: { earnedAt: 'desc' },
              take: 1,
            },
            avatars: {
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
        answers: {
          include: {
            expertUser: {
              include: {
                profile: true,
                titles: {
                  orderBy: { earnedAt: 'desc' },
                  take: 1,
                },
                avatars: {
                  where: { isActive: true },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
          take: 1, // İlk answer'dan expert bilgilerini al
        },
      },
    });

    expertRequests.forEach((request) => {
      // Request sahibi bilgileri (EXPERT_REQUEST_AVAILABLE için)
      const requester = request.user;
      const requesterName = requester?.profile?.displayName || requester?.profile?.userName || requester?.email || 'Expert';
      const requesterTitle = requester?.titles?.[0]?.title || '';
      const requesterAvatar = requester?.avatars?.[0]?.imageUrl 
        ? resolveMediaUrl(requester.avatars[0].imageUrl, true) 
        : resolveMediaUrl(null, true);
      
      // Expert bilgileri (EXPERT_REQUEST_ANSWERED için)
      const firstAnswer = request.answers[0];
      if (firstAnswer && firstAnswer.expertUser) {
        const expert = firstAnswer.expertUser;
        expertRequestInfo.set(request.id, {
          expertUserId: expert.id,
          expertName: expert.profile?.displayName || expert.profile?.userName || expert.email || 'Expert',
          expertTitle: expert.titles?.[0]?.title || '',
          expertAvatar: expert.avatars?.[0]?.imageUrl 
            ? resolveMediaUrl(expert.avatars[0].imageUrl, true) 
            : resolveMediaUrl(null, true),
          requesterName,
          requesterTitle,
          requesterAvatar,
        });
      } else {
        // Expert bulunamadı (henüz answer yok), request sahibi bilgilerini kullan
        expertRequestInfo.set(request.id, {
          expertName: requesterName,
          expertTitle: requesterTitle,
          expertAvatar: requesterAvatar,
          requesterName,
          requesterTitle,
          requesterAvatar,
        });
      }
    });
  }

  // Batch olarak support request ID'lerini ve expert bilgilerini thread'lerden bul
  const supportRequestMap = new Map<string, {
    requestId: string;
    expertUserId: string;
    expertName: string;
    expertTitle: string;
    expertAvatar: string | null;
  }>();
  const supportThreadIds = new Set<string>();
  
  notifications.forEach((notification) => {
    const data = notification.data || {};
    const type = notification.type as NotificationType;
    if (type === NotificationType.SUPPORT_REQUEST_ACCEPTED && data.threadId) {
      supportThreadIds.add(data.threadId);
    }
  });
  
  if (supportThreadIds.size > 0) {
    const dmRequests = await prisma.dMRequest.findMany({
      where: {
        threadId: { in: Array.from(supportThreadIds) },
        status: 'ACCEPTED',
      },
      include: {
        toUser: {
          include: {
            profile: true,
            titles: {
              orderBy: { earnedAt: 'desc' },
              take: 1,
            },
            avatars: {
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    
    dmRequests.forEach((request) => {
      if (request.threadId && request.toUser) {
        const expert = request.toUser;
        supportRequestMap.set(request.threadId, {
          requestId: request.id,
          expertUserId: expert.id,
          expertName: expert.profile?.displayName || expert.profile?.userName || expert.email || 'Expert',
          expertTitle: expert.titles?.[0]?.title || '',
          expertAvatar: expert.avatars?.[0]?.imageUrl 
            ? resolveMediaUrl(expert.avatars[0].imageUrl, true) 
            : resolveMediaUrl(null, true),
        });
      }
    });
  }

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
    // Minimal response structure (title, message, readAt, updatedAt kaldırıldı)
    const enriched: {
      id: string;
      userId?: string;
      type: NotificationType;
      avatar?: string | null;
      username?: string | null;
      description?: string | null;
      postId?: string;
      postContent?: string | null;
      postType?: string | null;
      imageUrl?: string | null;
      commentId?: string;
      amount?: number | null;
      data: any;
      read: boolean;
      createdAt: string;
    } = {
      id: notification.id,
      userId: (notification.type === NotificationType.NEW_BADGE || notification.type === NotificationType.EVENT_STARTED) ? undefined as any : notification.userId,
      type: notification.type,
      avatar: undefined,
      username: undefined,
      data: notification.data,
      read: notification.read,
      createdAt: notification.createdAt,
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
      // userId root'tan alınır (avatar ile eşleşir)
      const userId = data.likerId || data.commenterId || data.sharerId || data.userId;
      if (userId) {
        // userId'yi root'a set et (avatar ile eşleşir)
        enriched.userId = userId;
        if (!enriched.avatar) {
          enriched.avatar = userAvatars.get(userId) || randomImageCache || null;
        }
        // Username'i root'a ekle
        const username = userNames.get(userId);
        if (username) {
          enriched.username = username;
        }
      }
      // Post görseli ekle (sadece data içine)
      let postImageUrl = null;
      if (data.postId && postImages.has(data.postId)) {
        postImageUrl = postImages.get(data.postId);
      } else if (data.productId && productImages.has(data.productId)) {
        postImageUrl = productImages.get(data.productId);
      } else if (randomImageCache) {
        postImageUrl = randomImageCache;
      }
      // Data içine ekle
      if (!enriched.data) enriched.data = {};
      enriched.data.postId = data.postId;
      if (postImageUrl) enriched.data.imageUrl = postImageUrl;
      // Post content ve type ekle
      if (data.postId) {
        if (postContents.has(data.postId)) {
          enriched.data.postContent = postContents.get(data.postId);
        }
        if (postTypes.has(data.postId)) {
          enriched.data.postType = postTypes.get(data.postId);
        }
      }
      // Comment ise description ekle (POST_COMMENTED için)
      if (type === NotificationType.POST_COMMENTED) {
        // commentId'yi data'dan al veya commenterId'den bul
        const commentId = data.commentId;
        // description root seviyede olacak, data içinde olmayacak
        if (commentId && commentDescriptions.has(commentId)) {
          enriched.description = commentDescriptions.get(commentId);
        }
        // commentId'yi data'da tut (navigation için gerekli olabilir)
        // Ama commenterId ve commenterName'i kaldır (root'ta userId ve username var)
        if (enriched.data) {
          delete enriched.data.commenterId;
          delete enriched.data.commenterName;
          delete enriched.data.description; // data içinden description'ı kaldır
        }
      } else {
        // Diğer post bildirimleri için gereksiz alanları kaldır
        if (enriched.data) {
          delete enriched.data.likerId;
          delete enriched.data.sharerId;
          delete enriched.data.userId;
          delete enriched.data.likerName;
          delete enriched.data.sharerName;
          delete enriched.data.userName;
        }
      }
    }

    // Yorum ile ilgili (2)
    if (type === NotificationType.COMMENT_LIKED || type === NotificationType.COMMENT_REPLIED) {
      // userId root'tan alınır (avatar ile eşleşir)
      const userId = data.likerId || data.replierId || data.commenterId;
      if (userId) {
        enriched.userId = userId;
        if (!enriched.avatar) {
          enriched.avatar = userAvatars.get(userId) || randomImageCache || null;
        }
        // Username'i root'a ekle
        const username = userNames.get(userId);
        if (username) {
          enriched.username = username;
        }
      }
      // Post görseli ekle (sadece data içine)
      let postImageUrl = null;
      if (data.postId && postImages.has(data.postId)) {
        postImageUrl = postImages.get(data.postId);
      } else if (randomImageCache) {
        postImageUrl = randomImageCache;
      }
      // Data içine ekle
      if (!enriched.data) enriched.data = {};
      enriched.data.postId = data.postId;
      enriched.data.commentId = data.commentId;
      if (postImageUrl) enriched.data.imageUrl = postImageUrl;
      // Post content ve type ekle
      if (data.postId) {
        if (postContents.has(data.postId)) {
          enriched.data.postContent = postContents.get(data.postId);
        }
        if (postTypes.has(data.postId)) {
          enriched.data.postType = postTypes.get(data.postId);
        }
      }
      // Comment description ekle
      if (data.commentId && commentDescriptions.has(data.commentId)) {
        enriched.data.description = commentDescriptions.get(data.commentId);
      }
      // likerId, replierId, commenterId kaldırıldı (root'ta var)
    }

    // Trust/Follow ile ilgili (2) - trust listesine alan kişinin avatarı, userid, adı root seviyede
    if (type === NotificationType.NEW_TRUSTER || type === NotificationType.NEW_TRUSTED_BY) {
      // userId root'tan alınır (avatar ile eşleşir)
      const userId = data.trusterId || data.trustedId;
      if (userId) {
        enriched.userId = userId;
        if (!enriched.avatar) {
          enriched.avatar = userAvatars.get(userId) || randomImageCache || null;
        }
        // Username'i root'a ekle (trust listesine alan kişinin adı)
        const username = userNames.get(userId);
        if (username) {
          enriched.username = username;
        }
      }
      // Data içine username ekleme (root'ta var)
      if (!enriched.data) enriched.data = {};
    }

    // Mesajlaşma ile ilgili bildirimler
    // NEW_MESSAGE kaldırıldı - zaten inbox'ta görüntülenecek
    if (
      type === NotificationType.DM_REQUEST_RECEIVED ||
      type === NotificationType.DM_REQUEST_ACCEPTED ||
      type === NotificationType.DM_REQUEST_DECLINED ||
      type === NotificationType.SUPPORT_REQUEST_ACCEPTED
    ) {
      // userId root'tan alınır (avatar ile eşleşir)
      const userId = data.userId || data.requesterId || data.accepterId;
      if (userId) {
        enriched.userId = userId;
        if (!enriched.avatar) {
          enriched.avatar = userAvatars.get(userId) || randomImageCache || null;
        }
      }
      // Mesajlaşma bildirimleri için imageUrl field'ı eklenmez (root seviyede zaten yok)
      // Post ile ilgili root seviye alanları temizle
      enriched.postId = undefined;
      enriched.postContent = undefined;
      enriched.postType = undefined;
      enriched.description = undefined;
      enriched.imageUrl = undefined;
      enriched.commentId = undefined;
      
      // Data hazırla (sadece navigation için gerekli)
      if (!enriched.data) enriched.data = {};
      
      // Username ekle
      if (userId) {
        const username = userNames.get(userId);
        if (username) enriched.data.username = username;
      }
      
      if (type === NotificationType.DM_REQUEST_ACCEPTED) {
        // threadId ve participants bilgileri (thread açıldığında userOne userTwo için)
        if (data.threadId) enriched.data.threadId = data.threadId;
        if (data.participants) {
          enriched.data.participants = data.participants;
        }
        // Post ile ilgili alanları temizle
        delete enriched.data.postId;
        delete enriched.data.postContent;
        delete enriched.data.postType;
        delete enriched.data.description;
        delete enriched.data.imageUrl;
        delete enriched.data.commentId;
      } else if (type === NotificationType.SUPPORT_REQUEST_ACCEPTED) {
        // threadId, requestId ve expert bilgileri (SupportMessageDetail için gerekli)
        if (data.threadId) enriched.data.threadId = data.threadId;
        
        // Thread'den support request ve expert bilgilerini al
        const supportInfo = data.threadId ? supportRequestMap.get(data.threadId) : null;
        if (supportInfo) {
          enriched.data.requestId = supportInfo.requestId;
          enriched.data.expertName = supportInfo.expertName;
          enriched.data.expertTitle = supportInfo.expertTitle;
          enriched.data.expertAvatar = supportInfo.expertAvatar;
        } else {
          // Bulunamazsa data'dan al veya default değerler (geçici)
          enriched.data.requestId = data.requestId || 'default-request-id';
          enriched.data.expertName = data.expertName || 'Expert';
          enriched.data.expertTitle = data.expertTitle || '';
          enriched.data.expertAvatar = data.expertAvatar || resolveMediaUrl(null, true);
        }
        // Post ile ilgili alanları temizle
        delete enriched.data.postId;
        delete enriched.data.postContent;
        delete enriched.data.postType;
        delete enriched.data.description;
        delete enriched.data.imageUrl;
        delete enriched.data.commentId;
      } else if (type === NotificationType.DM_REQUEST_RECEIVED) {
        // Support request oluşturma: requesti atan kişinin avatarı, userid, username root seviyede
        // userId zaten root'ta set edildi (yukarıda)
        // Username'i root'a ekle
        if (userId) {
          const username = userNames.get(userId);
          if (username) {
            enriched.username = username;
          }
        }
        
        // Data içine sadece threadId ekle
        enriched.data = {};
        if (data.threadId) enriched.data.threadId = data.threadId;
        
        // Post ile ilgili alanları kaldır
        delete enriched.data.postId;
        delete enriched.data.postContent;
        delete enriched.data.postType;
        delete enriched.data.description;
        delete enriched.data.imageUrl;
        delete enriched.data.commentId;
        delete enriched.data.username; // Root'ta var, data'dan kaldır
      } else {
        // DM_REQUEST_DECLINED - data boş
        enriched.data = {};
      }
    }

    // Gamification ile ilgili (3)
    if (
      type === NotificationType.NEW_BADGE ||
      type === NotificationType.ACHIEVEMENT_UNLOCKED ||
      type === NotificationType.REWARD_EARNED
    ) {
      // Avatar undefined (gamification bildirimlerinde kullanıcı avatar'ı yok - badge kazanan kullanıcıya gidiyor)
      enriched.avatar = undefined;
      // userId ve username kullanılmıyor (NEW_BADGE için gereksiz - badge kazanan kullanıcıya gidiyor)
      if (enriched.userId) delete enriched.userId;
      if (enriched.username) delete enriched.username;
      
      if (!enriched.data) enriched.data = {};
      
      if (type === NotificationType.NEW_BADGE) {
        // NEW_BADGE için: sadece badge görseli ve badge adı
        if (data.badgeId) enriched.data.badgeId = data.badgeId;
        
        // badgeName ekle
        if (data.badgeId && badgeNames.has(data.badgeId)) {
          enriched.data.badgeName = badgeNames.get(data.badgeId);
        } else if (data.badgeName) {
          enriched.data.badgeName = data.badgeName;
        }
        
        // badge görseli ekle
        let badgeImageUrl = null;
        if (data.badgeId && badgeImages.has(data.badgeId)) {
          badgeImageUrl = badgeImages.get(data.badgeId);
        } else if (randomImageCache) {
          badgeImageUrl = randomImageCache;
        }
        if (badgeImageUrl) enriched.data.imageUrl = badgeImageUrl;
        
        // NEW_BADGE için tüm user ve gereksiz alanları temizle (sadece badgeId, badgeName, imageUrl kalacak)
        delete enriched.data.avatar;
        delete enriched.data.userId;
        delete enriched.data.username;
        delete enriched.data.postId;
        delete enriched.data.postContent;
        delete enriched.data.postType;
        delete enriched.data.description;
        delete enriched.data.commentId;
        delete enriched.data.badgeIcon;
        delete enriched.data.senderId;
        delete enriched.data.senderUserId;
        delete enriched.data.recipientId;
        delete enriched.data.recipientUserId;
        delete enriched.data.likerId;
        delete enriched.data.commenterId;
        delete enriched.data.replierId;
        delete enriched.data.sharerId;
        delete enriched.data.trusterId;
        delete enriched.data.trustedId;
        delete enriched.data.expertId;
        delete enriched.data.requesterId;
        delete enriched.data.accepterId;
        delete enriched.data.userName;
        delete enriched.data.amount;
        delete enriched.data.transactionId;
        delete enriched.data.reason;
        delete enriched.data.threadId;
        delete enriched.data.requestId;
        delete enriched.data.eventId;
        delete enriched.data.eventName;
        delete enriched.data.productId;
        delete enriched.data.collectionId;
        // Sadece badgeId, badgeName, imageUrl kalacak
      } else if (type === NotificationType.ACHIEVEMENT_UNLOCKED) {
        // ACHIEVEMENT_UNLOCKED için badgeId ve imageUrl (achievementId kaldırıldı)
        if (data.badgeId) enriched.data.badgeId = data.badgeId;
        let badgeImageUrl = null;
        if (data.badgeId && badgeImages.has(data.badgeId)) {
          badgeImageUrl = badgeImages.get(data.badgeId);
        } else if (randomImageCache) {
          badgeImageUrl = randomImageCache;
        }
        if (badgeImageUrl) enriched.data.imageUrl = badgeImageUrl;
      } else if (type === NotificationType.REWARD_EARNED) {
        // REWARD_EARNED için sadece amount (badgeId ve imageUrl kaldırıldı)
        if (data.amount) enriched.data.amount = data.amount;
      }
    }

    // Expert ile ilgili (2) - avatar null
    if (
      type === NotificationType.EXPERT_REQUEST_AVAILABLE ||
      type === NotificationType.EXPERT_REQUEST_ANSWERED
    ) {
      // Avatar null (expert bildirimlerinde kullanıcı avatar'ı yok)
      enriched.avatar = null;
      
      // Data içine ekle
      if (!enriched.data) enriched.data = {};
      if (data.requestId) enriched.data.requestId = data.requestId;
      
      // EXPERT_REQUEST_ANSWERED için expert bilgileri ve threadId ekle
      if (type === NotificationType.EXPERT_REQUEST_ANSWERED) {
        const expertInfo = data.requestId ? expertRequestInfo.get(data.requestId) : null;
        if (expertInfo) {
          enriched.data.expertName = expertInfo.expertName || 'Expert';
          enriched.data.expertTitle = expertInfo.expertTitle || '';
          enriched.data.expertAvatar = expertInfo.expertAvatar || resolveMediaUrl(null, true);
        } else {
          // Expert bilgisi bulunamadı, default değerler (geçici)
          enriched.data.expertName = data.expertName || 'Expert';
          enriched.data.expertTitle = data.expertTitle || '';
          enriched.data.expertAvatar = data.expertAvatar || resolveMediaUrl(null, true);
        }
        // threadId ekle (data'dan al veya null - expert request'ler thread oluşturmuyor)
        if (data.threadId) {
          enriched.data.threadId = data.threadId;
        } else {
          // ThreadId yok, null bırak (expert request'ler thread oluşturmuyor)
          enriched.data.threadId = null;
        }
      }
      
      // EXPERT_REQUEST_AVAILABLE için expert bilgileri ekle (request sahibi bilgileri - henüz expert bulunmamış)
      if (type === NotificationType.EXPERT_REQUEST_AVAILABLE) {
        const expertInfo = data.requestId ? expertRequestInfo.get(data.requestId) : null;
        if (expertInfo) {
          // Request sahibi bilgilerini expert olarak göster (henüz expert bulunmamış)
          enriched.data.expertName = expertInfo.requesterName || expertInfo.expertName || 'Expert';
          enriched.data.expertTitle = expertInfo.requesterTitle || expertInfo.expertTitle || '';
          enriched.data.expertAvatar = expertInfo.requesterAvatar || expertInfo.expertAvatar || resolveMediaUrl(null, true);
        } else {
          // Default değerler
          enriched.data.expertName = data.expertName || 'Expert';
          enriched.data.expertTitle = data.expertTitle || '';
          enriched.data.expertAvatar = data.expertAvatar || resolveMediaUrl(null, true);
        }
      }
    }

    // Sistem/Tips ile ilgili (3)
    if (
      type === NotificationType.SYSTEM_ANNOUNCEMENT ||
      type === NotificationType.TIPS_RECEIVED ||
      type === NotificationType.TIPS_SENT
    ) {
      // userId root'tan alınır (avatar ile eşleşir)
      // TIPS_RECEIVED için senderId, TIPS_SENT için recipientId kullanılır
      const userId = type === NotificationType.TIPS_RECEIVED 
        ? (data.senderId || data.senderUserId || data.userId)
        : type === NotificationType.TIPS_SENT
        ? (data.recipientId || data.recipientUserId || data.userId)
        : (data.senderId || data.userId);
      
      if (userId) {
        enriched.userId = userId;
        if (!enriched.avatar) {
          enriched.avatar = userAvatars.get(userId) || randomImageCache || null;
        }
      }
      
      // TIPS_RECEIVED için özel işlem: sadece userId, username, avatar, type ve amount (root seviyede)
      if (type === NotificationType.TIPS_RECEIVED) {
        // Post ile ilgili root seviye alanları temizle
        enriched.postId = undefined;
        enriched.postContent = undefined;
        enriched.postType = undefined;
        enriched.description = undefined;
        enriched.imageUrl = undefined;
        enriched.commentId = undefined;
        
        // Username root seviyede
        if (userId) {
          const username = userNames.get(userId);
          enriched.username = username || null;
        }
        
        // Amount root seviyede
        enriched.amount = data.amount || null;
        
        // Data objesini tamamen kaldır
        enriched.data = undefined;
      } else if (type === NotificationType.TIPS_SENT) {
        // TIPS_SENT için: amount, username (recipient'ten)
        if (!enriched.data) enriched.data = {};
        if (data.amount) enriched.data.amount = data.amount;
        if (userId) {
          const username = userNames.get(userId);
          if (username) enriched.data.username = username;
        }
      } else {
        // SYSTEM_ANNOUNCEMENT için
        if (!enriched.data) enriched.data = {};
        if (data.amount) enriched.data.amount = data.amount;
      }
    }

    // Event ile ilgili (3) - avatar undefined (user bilgileri yok)
    if (
      type === NotificationType.EVENT_STARTED ||
      type === NotificationType.EVENT_ENDING_SOON ||
      type === NotificationType.EVENT_REWARD_AVAILABLE
    ) {
      // Avatar undefined (event bildirimlerinde kullanıcı avatar'ı yok - event kazanan kullanıcıya gidiyor)
      enriched.avatar = undefined;
      // userId ve username kullanılmıyor (EVENT_STARTED için gereksiz - event kazanan kullanıcıya gidiyor)
      if (enriched.userId) delete enriched.userId;
      if (enriched.username) delete enriched.username;
      
      let eventImageUrl = null;
      if (data.eventId && eventImages.has(data.eventId)) {
        eventImageUrl = eventImages.get(data.eventId);
      } else if (randomImageCache) {
        eventImageUrl = randomImageCache;
      }
      
      // EVENT_STARTED için: sadece eventId, eventName ve imageUrl
      if (type === NotificationType.EVENT_STARTED) {
        if (!enriched.data) enriched.data = {};
        enriched.data.eventId = data.eventId;
        
        // eventName ekle
        if (data.eventId && eventNames.has(data.eventId)) {
          enriched.data.eventName = eventNames.get(data.eventId);
        } else if (data.eventName) {
          enriched.data.eventName = data.eventName;
        }
        
        // event görseli ekle
        if (eventImageUrl) enriched.data.imageUrl = eventImageUrl;
        
        // EVENT_STARTED için tüm user ve gereksiz alanları temizle (sadece eventId, eventName, imageUrl kalacak)
        delete enriched.data.eventType;
        delete enriched.data.avatar;
        delete enriched.data.userId;
        delete enriched.data.username;
        delete enriched.data.userName;
        delete enriched.data.postId;
        delete enriched.data.postContent;
        delete enriched.data.postType;
        delete enriched.data.description;
        delete enriched.data.commentId;
        delete enriched.data.senderId;
        delete enriched.data.senderUserId;
        delete enriched.data.recipientId;
        delete enriched.data.recipientUserId;
        delete enriched.data.likerId;
        delete enriched.data.commenterId;
        delete enriched.data.replierId;
        delete enriched.data.sharerId;
        delete enriched.data.trusterId;
        delete enriched.data.trustedId;
        delete enriched.data.expertId;
        delete enriched.data.requesterId;
        delete enriched.data.accepterId;
        delete enriched.data.amount;
        delete enriched.data.transactionId;
        delete enriched.data.reason;
        delete enriched.data.threadId;
        delete enriched.data.requestId;
        delete enriched.data.productId;
        delete enriched.data.collectionId;
        delete enriched.data.badgeId;
        delete enriched.data.badgeName;
        delete enriched.data.hoursRemaining;
        delete enriched.data.rewardAmount;
        // Sadece eventId, eventName, imageUrl kalacak
      } else {
        // EVENT_ENDING_SOON ve EVENT_REWARD_AVAILABLE için mevcut mantık
        if (!enriched.data) enriched.data = {};
        enriched.data.eventId = data.eventId;
        
        // eventName ekle
        if (data.eventId && eventNames.has(data.eventId)) {
          enriched.data.eventName = eventNames.get(data.eventId);
        } else if (data.eventName) {
          enriched.data.eventName = data.eventName;
        }
        
        // eventType ekle
        if (data.eventId && eventTypes.has(data.eventId)) {
          enriched.data.eventType = eventTypes.get(data.eventId);
        } else if (data.eventType) {
          enriched.data.eventType = data.eventType;
        }
        
        // event görseli ekle
        if (eventImageUrl) enriched.data.imageUrl = eventImageUrl;
        
        // EVENT_ENDING_SOON ve EVENT_REWARD_AVAILABLE için gereksiz alanları temizle
        if (type === NotificationType.EVENT_ENDING_SOON || type === NotificationType.EVENT_REWARD_AVAILABLE) {
          delete enriched.data.hoursRemaining;
          delete enriched.data.rewardAmount;
        }
      }
    }

    // Collection ile ilgili (2) - avatar null
    if (
      type === NotificationType.COLLECTION_POST_ADDED ||
      type === NotificationType.COLLECTION_SHARED
    ) {
      // Avatar null (collection bildirimlerinde kullanıcı avatar'ı yok)
      enriched.avatar = null;
      
      // Data içine ekle (sadece collectionId - postId kaldırıldı)
      if (!enriched.data) enriched.data = {};
      if (data.collectionId) enriched.data.collectionId = data.collectionId;
      // postId ve imageUrl kaldırıldı
    }

    // undefined değerleri null yap (response'da görünsün ama null olsun)
    // Avatar için: null yerine random avatar veya default avatar kullan (NEW_BADGE, EVENT_STARTED, ACHIEVEMENT_UNLOCKED, REWARD_EARNED hariç)
    if (
      enriched.avatar === undefined &&
      type !== NotificationType.NEW_BADGE &&
      type !== NotificationType.EVENT_STARTED &&
      type !== NotificationType.ACHIEVEMENT_UNLOCKED &&
      type !== NotificationType.REWARD_EARNED
    ) {
      enriched.avatar = randomImageCache || null;
    }
    // imageUrl artık sadece data içinde, root seviyede yok
    // Mesajlaşma bildirimlerinde data içinde de imageUrl yok
    const isMessagingNotification = 
      type === NotificationType.DM_REQUEST_RECEIVED ||
      type === NotificationType.DM_REQUEST_ACCEPTED ||
      type === NotificationType.DM_REQUEST_DECLINED ||
      type === NotificationType.SUPPORT_REQUEST_ACCEPTED ||
      type === NotificationType.NEW_MESSAGE;
    
    // Root seviyedeki imageUrl yok (artık sadece data içinde)
    
    // Gereksiz alanları data'dan kaldır (minimal structure için)
    if (enriched.data) {
      // Genel temizlik
      delete enriched.data.productId;
      delete enriched.data.commenterId;
      delete enriched.data.sharerId;
      delete enriched.data.likerId;
      delete enriched.data.replierId;
      delete enriched.data.senderId;
      delete enriched.data.requesterId;
      delete enriched.data.accepterId;
      delete enriched.data.expertId;
      delete enriched.data.trusterId;
      delete enriched.data.trustedId;
      delete enriched.data.userName;
      // badgeName artık data içinde olmalı (NEW_BADGE için)
      // delete enriched.data.badgeName;
      delete enriched.data.eventName;
      delete enriched.data.achievementId;
      delete enriched.data.tipsAmount;
      delete enriched.data.avatar;
      delete enriched.data.message;
      delete enriched.data.requestId; // DM_REQUEST_RECEIVED için (threadId yeterli)
      // amount genel olarak silinmemeli - sadece DM_REQUEST için silinecek
      
      // TIPS_RECEIVED için userId duplicate kaldır (root'ta var) - amount KALMALI
      if (type === NotificationType.TIPS_RECEIVED) {
        delete enriched.data.userId;
        delete enriched.data.imageUrl;
        // amount KALMALI - silme!
      }
      
      // TIPS_SENT için de amount KALMALI
      if (type === NotificationType.TIPS_SENT) {
        // amount KALMALI - silme!
      }
      
      // DM_REQUEST_ACCEPTED için userId ve userName kaldır (root'ta var)
      if (type === NotificationType.DM_REQUEST_ACCEPTED) {
        delete enriched.data.userId;
        delete enriched.data.userName;
        delete enriched.data.imageUrl;
      }
      
      // DM_REQUEST_RECEIVED için gereksiz alanlar
      if (type === NotificationType.DM_REQUEST_RECEIVED) {
        delete enriched.data.userId;
        delete enriched.data.requestId;
        delete enriched.data.message;
        delete enriched.data.amount;
        delete enriched.data.imageUrl;
      }
      
      // Collection için postId kaldır
      if (type === NotificationType.COLLECTION_POST_ADDED || type === NotificationType.COLLECTION_SHARED) {
        delete enriched.data.postId;
        delete enriched.data.imageUrl;
        delete enriched.data.avatar; // Collection bildirimlerinde avatar yok
      }
      
      // EVENT_STARTED için tüm user ve gereksiz alanları kaldır (sadece eventId, eventName, imageUrl kalacak)
      if (type === NotificationType.EVENT_STARTED) {
        delete enriched.data.avatar;
        delete enriched.data.userId;
        delete enriched.data.username;
        delete enriched.data.userName;
        delete enriched.data.postId;
        delete enriched.data.postContent;
        delete enriched.data.postType;
        delete enriched.data.description;
        delete enriched.data.commentId;
        delete enriched.data.senderId;
        delete enriched.data.senderUserId;
        delete enriched.data.recipientId;
        delete enriched.data.recipientUserId;
        delete enriched.data.likerId;
        delete enriched.data.commenterId;
        delete enriched.data.replierId;
        delete enriched.data.sharerId;
        delete enriched.data.trusterId;
        delete enriched.data.trustedId;
        delete enriched.data.expertId;
        delete enriched.data.requesterId;
        delete enriched.data.accepterId;
        delete enriched.data.amount;
        delete enriched.data.transactionId;
        delete enriched.data.reason;
        delete enriched.data.threadId;
        delete enriched.data.requestId;
        delete enriched.data.productId;
        delete enriched.data.collectionId;
        delete enriched.data.badgeId;
        delete enriched.data.badgeName;
        delete enriched.data.eventType;
        delete enriched.data.hoursRemaining;
        delete enriched.data.rewardAmount;
        // Sadece eventId, eventName, imageUrl kalacak
      } else if (
        type === NotificationType.EVENT_ENDING_SOON ||
        type === NotificationType.EVENT_REWARD_AVAILABLE
      ) {
        delete enriched.data.avatar; // Diğer event bildirimlerinde avatar yok
      }
      
      // Badge/Gamification bildirimlerinde avatar ve gereksiz alanları kaldır
      if (
        type === NotificationType.NEW_BADGE ||
        type === NotificationType.ACHIEVEMENT_UNLOCKED ||
        type === NotificationType.REWARD_EARNED
      ) {
        delete enriched.data.avatar; // Badge bildirimlerinde avatar yok
        // NEW_BADGE için tüm gereksiz alanları temizle (sadece badgeId, badgeName, imageUrl kalacak)
        if (type === NotificationType.NEW_BADGE) {
          // Tüm user ve gereksiz alanları kaldır
          delete enriched.data.userId;
          delete enriched.data.username;
          delete enriched.data.userName;
          delete enriched.data.postId;
          delete enriched.data.postContent;
          delete enriched.data.postType;
          delete enriched.data.description;
          delete enriched.data.commentId;
          delete enriched.data.badgeIcon;
          delete enriched.data.senderId;
          delete enriched.data.senderUserId;
          delete enriched.data.recipientId;
          delete enriched.data.recipientUserId;
          delete enriched.data.likerId;
          delete enriched.data.commenterId;
          delete enriched.data.replierId;
          delete enriched.data.sharerId;
          delete enriched.data.trusterId;
          delete enriched.data.trustedId;
          delete enriched.data.expertId;
          delete enriched.data.requesterId;
          delete enriched.data.accepterId;
          delete enriched.data.amount;
          delete enriched.data.transactionId;
          delete enriched.data.reason;
          delete enriched.data.threadId;
          delete enriched.data.requestId;
          delete enriched.data.eventId;
          delete enriched.data.eventName;
          delete enriched.data.productId;
          delete enriched.data.collectionId;
          // Sadece badgeId, badgeName, imageUrl kalacak
        }
      }
      
      // Expert için imageUrl kaldır
      if (type === NotificationType.EXPERT_REQUEST_AVAILABLE || type === NotificationType.EXPERT_REQUEST_ANSWERED) {
        delete enriched.data.imageUrl;
        delete enriched.data.avatar; // Expert bildirimlerinde avatar yok
      }
      
      // REWARD_EARNED için badgeId ve imageUrl kaldır
      if (type === NotificationType.REWARD_EARNED) {
        delete enriched.data.badgeId;
        delete enriched.data.imageUrl;
      }
      
      // Trust bildirimleri için username data'dan kaldır (root'ta var)
      if (type === NotificationType.NEW_TRUSTER || type === NotificationType.NEW_TRUSTED_BY) {
        delete enriched.data.username;
        delete enriched.data.trusterId;
        delete enriched.data.trustedId;
      }
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
          // Tips bildirimleri - sadece kullanıcıya gelen tips'ler (TIPS_RECEIVED)
          types = [NotificationType.TIPS_RECEIVED];
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

    // Bildirimleri grupla (backend'de gruplama)
    const { groupNotifications } = await import('../../application/notification/notification-grouper');
    const groupedNotifications = groupNotifications(enrichedNotifications);

    // Bildirimleri işle ve temizle
    const processedNotifications = groupedNotifications.map((notif: any) => {
      // EVENT_STARTED bildirimleri için root seviyede imageUrl ekle (eğer data içinde varsa)
      if (notif.type === 'EVENT_STARTED' && notif.data?.imageUrl && !notif.imageUrl) {
        notif.imageUrl = notif.data.imageUrl; // Root seviyede de ekle
      }

      // EVENT_STARTED için tüm user ve gereksiz alanları kaldır (sadece eventId, eventName, imageUrl kalacak)
      if (notif.type === 'EVENT_STARTED') {
        // Root seviyedeki tüm user ve post ile ilgili alanları kaldır
        delete notif.userId;
        delete notif.username;
        delete notif.avatar;
        delete notif.postId;
        delete notif.postContent;
        delete notif.postType;
        delete notif.description;
        delete notif.commentId;
        
        // data içinde sadece eventId, eventName, imageUrl kalacak
        if (notif.data) {
          // Tüm user ve gereksiz alanları kaldır
          delete notif.data.avatar;
          delete notif.data.userId;
          delete notif.data.username;
          delete notif.data.userName;
          delete notif.data.postId;
          delete notif.data.postContent;
          delete notif.data.postType;
          delete notif.data.description;
          delete notif.data.commentId;
          delete notif.data.senderId;
          delete notif.data.senderUserId;
          delete notif.data.recipientId;
          delete notif.data.recipientUserId;
          delete notif.data.likerId;
          delete notif.data.commenterId;
          delete notif.data.replierId;
          delete notif.data.sharerId;
          delete notif.data.trusterId;
          delete notif.data.trustedId;
          delete notif.data.expertId;
          delete notif.data.requesterId;
          delete notif.data.accepterId;
          delete notif.data.amount;
          delete notif.data.transactionId;
          delete notif.data.reason;
          delete notif.data.threadId;
          delete notif.data.requestId;
          delete notif.data.productId;
          delete notif.data.collectionId;
          delete notif.data.badgeId;
          delete notif.data.badgeName;
          delete notif.data.eventType;
          delete notif.data.hoursRemaining;
          delete notif.data.rewardAmount;
          // Sadece eventId, eventName, imageUrl kalacak
        }
      }

      // Mesajlaşma bildirimleri için post ile ilgili alanları kaldır (undefined değerleri temizle)
      if (
        notif.type === 'DM_REQUEST_RECEIVED' ||
        notif.type === 'DM_REQUEST_ACCEPTED' ||
        notif.type === 'DM_REQUEST_DECLINED' ||
        notif.type === 'SUPPORT_REQUEST_ACCEPTED'
      ) {
        // undefined değerleri kaldır
        if (notif.postId === undefined) delete notif.postId;
        if (notif.postContent === undefined) delete notif.postContent;
        if (notif.postType === undefined) delete notif.postType;
        if (notif.description === undefined) delete notif.description;
        if (notif.imageUrl === undefined) delete notif.imageUrl;
        if (notif.commentId === undefined) delete notif.commentId;
      }

      // TIPS_RECEIVED için post ile ilgili alanları ve data objesini kaldır
      if (notif.type === 'TIPS_RECEIVED') {
        // undefined değerleri kaldır
        if (notif.postId === undefined) delete notif.postId;
        if (notif.postContent === undefined) delete notif.postContent;
        if (notif.postType === undefined) delete notif.postType;
        if (notif.description === undefined) delete notif.description;
        if (notif.imageUrl === undefined) delete notif.imageUrl;
        if (notif.commentId === undefined) delete notif.commentId;
        if (notif.data === undefined) delete notif.data;
      }

      // NEW_BADGE için tüm user ve gereksiz alanları kaldır (sadece badge görseli ve badge adı kalacak)
      if (notif.type === 'NEW_BADGE') {
        // Root seviyedeki tüm user ve post ile ilgili alanları kaldır
        delete notif.userId;
        delete notif.username;
        delete notif.avatar;
        delete notif.postId;
        delete notif.postContent;
        delete notif.postType;
        delete notif.description;
        delete notif.commentId;
        
        // data içinde sadece badgeId, badgeName, imageUrl kalacak
        if (notif.data) {
          // Tüm user ve gereksiz alanları kaldır
          delete notif.data.avatar;
          delete notif.data.userId;
          delete notif.data.username;
          delete notif.data.postId;
          delete notif.data.postContent;
          delete notif.data.postType;
          delete notif.data.description;
          delete notif.data.commentId;
          delete notif.data.badgeIcon;
          delete notif.data.senderId;
          delete notif.data.senderUserId;
          delete notif.data.recipientId;
          delete notif.data.recipientUserId;
          delete notif.data.likerId;
          delete notif.data.commenterId;
          delete notif.data.replierId;
          delete notif.data.sharerId;
          delete notif.data.trusterId;
          delete notif.data.trustedId;
          delete notif.data.expertId;
          delete notif.data.requesterId;
          delete notif.data.accepterId;
          // Sadece badge ile ilgili alanlar kalacak: badgeId, badgeName, imageUrl
        }
      }

      // undefined değerleri kaldır (genel temizlik)
      Object.keys(notif).forEach((key) => {
        if (notif[key] === undefined) {
          delete notif[key];
        }
      });

      return notif;
    });

    return res.json({
      success: true,
      data: processedNotifications,
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

