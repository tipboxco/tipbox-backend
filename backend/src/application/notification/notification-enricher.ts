import { NotificationType } from '../../domain/notification/notification-type.enum';
import { resolveMediaUrl, getPublicMediaBaseUrl } from '../../infrastructure/config/media.config';
import logger from '../../infrastructure/logger/logger';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';

const prisma = getPrisma();

// Assets'lerden rastgele görsel seç
const ASSET_PATHS = {
  avatars: [
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
  ],
  badges: [
    'badge/EarlyAdapter.png',
    'badge/HardwareExpert.png',
    'badge/PremiumShoper.png',
    'badge/WishMarker.png',
    'Badges _ Marketplace/badge-1.png',
    'Badges _ Marketplace/badge-2.png',
    'Badges _ Marketplace/badge-3.png',
    'Badges _ Marketplace/badge-4.png',
    'Badges _ Marketplace/badge-5.png',
    'Badges _ Marketplace/badge-6.png',
    'Badges _ Marketplace/badge-7.png',
    'Badges _ Marketplace/badge-8.png',
    'Badges _ Marketplace/badge-9.png',
    'Badges _ Marketplace/badge-10.png',
    'brandbadge/brandbadge1.png',
    'brandbadge/brandbadge2.png',
    'brandbadge/brandbadge3.png',
    'brandbadge/brandbadge4.png',
    'brandbadge/brandbadge5.png',
    'brandbadge/brandbadge6.png',
  ],
  events: [
    'events/communityevents-the-content-creator.jpg',
    'events/communityevents-the-digital-nomad-day.jpg',
    'events/communityevents-the-gaming-night.jpg',
    'events/communityevents-the-hikers-summit.jpg',
    'events/communityevents-the-masterchef-weekend.jpg',
    'events/communityevents-the-rainy-day-sanctuary.jpg',
    'events/communityevents-the-road-trip-ready.jpg',
    'events/communityevents-the-skincare-ritual.jpg',
    'events/communityevents-the-smart-home-geek.jpg',
    'events/communityevents-the-urban-commuter.jpg',
    'events/event.png',
    'events/new-events/event-akillisaat.png',
    'events/new-events/event-batarya.png',
    'events/new-events/event-ciltbakim.png',
    'events/new-events/event-gunestenkorunma.png',
    'events/new-events/event-kalicimakyaj.png',
    'events/new-events/event-kamera.png',
    'events/new-events/event-oyun.png',
    'events/new-events/event-sacbakim.png',
    'events/new-events/event-tablet.png',
    'events/new-events/event-yaglicilt.png',
  ],
  products: [
    'product/product-1.jpg',
    'product/product-2.jpg',
    'product/product-3.jpg',
    'product/product-4.jpg',
    'product/product-5.jpg',
    'product/product-6.jpg',
    'product/product-7.jpg',
    'product/product-8.jpg',
    'product/product-9.jpg',
    'product/product-10.jpg',
  ],
  posts: [
    'post/post.jpg',
    'post/default_image.png',
  ],
};

function getRandomAsset(category: 'avatars' | 'badges' | 'events' | 'products' | 'posts'): string {
  const assets = ASSET_PATHS[category];
  const randomIndex = Math.floor(Math.random() * assets.length);
  return assets[randomIndex];
}

function getRandomAssetUrl(category: 'avatars' | 'badges' | 'events' | 'products' | 'posts'): string {
  const assetPath = getRandomAsset(category);
  // Media config'den base URL'i al
  const baseUrl = getPublicMediaBaseUrl();
  return `${baseUrl}/${assetPath}`;
}

/**
 * Notification data'sına avatarUrl ve imageUrl ekler
 */
export async function enrichNotificationData(
  type: NotificationType,
  data: Record<string, unknown>
): Promise<{ avatar?: string | null; imageUrl?: string | null }> {
  const result: { avatar?: string | null; imageUrl?: string | null } = {};

  try {
    // Avatar URL'i bul
    let userIdForAvatar: string | undefined;
    
    if (data.userId) userIdForAvatar = String(data.userId);
    else if (data.requesterId) userIdForAvatar = String(data.requesterId); // DM_REQUEST_RECEIVED için
    else if (data.accepterId) userIdForAvatar = String(data.accepterId); // SUPPORT_REQUEST_ACCEPTED için
    else if (data.likerId) userIdForAvatar = String(data.likerId);
    else if (data.commenterId) userIdForAvatar = String(data.commenterId);
    // Tip transfer: gönderenin (from) avatar'ı gösterilir (TIPS_RECEIVED, DEPOSIT)
    else if (data.senderUserId) userIdForAvatar = String(data.senderUserId);
    else if (data.senderId) userIdForAvatar = String(data.senderId);
    else if (data.trusterId) userIdForAvatar = String(data.trusterId);
    else if (data.sharerId) userIdForAvatar = String(data.sharerId);
    else if (data.replierId) userIdForAvatar = String(data.replierId);

    if (userIdForAvatar) {
      try {
        const avatar = await prisma.userAvatar.findFirst({
          where: {
            userId: userIdForAvatar,
            isActive: true,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (avatar?.imageUrl) {
          // Veritabanından gelen avatar path'ini resolve et
          // imageUrl formatı: profile-pictures/{userId}/{filename} veya tam URL olabilir
          result.avatar = resolveMediaUrl(avatar.imageUrl, true);
        } else {
          // Avatar yoksa default avatar kullan (resolveMediaUrl null durumunda default döner)
          result.avatar = resolveMediaUrl(null, true);
        }
      } catch (error) {
        logger.debug(`Error fetching avatar for user ${userIdForAvatar}:`, error);
        result.avatar = resolveMediaUrl(null, true); // Default avatar döner
      }
    } else {
      // User ID yoksa default avatar kullan
      result.avatar = resolveMediaUrl(null, true); // Default avatar döner
    }

    // Image URL'i bul (notification tipine göre)
    switch (type) {
      // Post ile ilgili bildirimler
      case NotificationType.POST_LIKED:
      case NotificationType.POST_COMMENTED:
      case NotificationType.POST_SHARED:
      case NotificationType.POST_FAVORITED:
      case NotificationType.COMMENT_LIKED:
      case NotificationType.COMMENT_REPLIED: {
        if (data.postId) {
          try {
            const postMedia = await prisma.postMedia.findFirst({
              where: { postId: String(data.postId) },
              orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
            });

            if (postMedia?.mediaUrl) {
              result.imageUrl = resolveMediaUrl(postMedia.mediaUrl);
            } else {
              result.imageUrl = getRandomAssetUrl('posts');
            }
          } catch (error) {
            logger.debug(`Error fetching post media for ${String(data.postId)}:`, error);
            result.imageUrl = getRandomAssetUrl('posts');
          }
        } else {
          result.imageUrl = getRandomAssetUrl('posts');
        }
        break;
      }

      // Event ile ilgili bildirimler
      case NotificationType.EVENT_STARTED:
      case NotificationType.EVENT_ENDING_SOON:
      case NotificationType.EVENT_REWARD_AVAILABLE: {
        if (data.eventId) {
          try {
            const event = await prisma.event.findUnique({
              where: { id: String(data.eventId) },
              select: { imageUrl: true },
            });

            if (event?.imageUrl) {
              result.imageUrl = resolveMediaUrl(event.imageUrl);
            } else {
              result.imageUrl = getRandomAssetUrl('events');
            }
          } catch (error) {
            logger.debug(`Error fetching event image for ${String(data.eventId)}:`, error);
            result.imageUrl = getRandomAssetUrl('events');
          }
        } else {
          result.imageUrl = getRandomAssetUrl('events');
        }
        break;
      }

      // Badge ile ilgili bildirimler
      case NotificationType.NEW_BADGE:
      case NotificationType.ACHIEVEMENT_UNLOCKED: {
        if (data.badgeId) {
          try {
            const badge = await prisma.badge.findUnique({
              where: { id: String(data.badgeId) },
              select: { imageUrl: true },
            });

            if (badge?.imageUrl) {
              result.imageUrl = resolveMediaUrl(badge.imageUrl);
            } else {
              result.imageUrl = getRandomAssetUrl('badges');
            }
          } catch (error) {
            logger.debug(`Error fetching badge image for ${String(data.badgeId)}:`, error);
            result.imageUrl = getRandomAssetUrl('badges');
          }
        } else {
          result.imageUrl = getRandomAssetUrl('badges');
        }
        break;
      }

      // Product ile ilgili bildirimler
      case NotificationType.REWARD_EARNED:
      case NotificationType.REWARD_CLAIMABLE:
      case NotificationType.REWARD_CLAIMED: {
        if (data.productId) {
          try {
            const product = await prisma.product.findUnique({
              where: { id: String(data.productId) },
              select: { imageUrl: true },
            });

            if (product?.imageUrl) {
              result.imageUrl = resolveMediaUrl(product.imageUrl);
            } else {
              result.imageUrl = getRandomAssetUrl('products');
            }
          } catch (error) {
            logger.debug(`Error fetching product image for ${String(data.productId)}:`, error);
            result.imageUrl = getRandomAssetUrl('products');
          }
        } else {
          result.imageUrl = getRandomAssetUrl('badges'); // Reward için badge görseli
        }
        break;
      }

      // Collection ile ilgili bildirimler
      case NotificationType.COLLECTION_POST_ADDED:
      case NotificationType.COLLECTION_SHARED: {
        if (data.postId) {
          try {
            const postMedia = await prisma.postMedia.findFirst({
              where: { postId: String(data.postId) },
              orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
            });

            if (postMedia?.mediaUrl) {
              result.imageUrl = resolveMediaUrl(postMedia.mediaUrl);
            } else {
              result.imageUrl = getRandomAssetUrl('posts');
            }
          } catch (error) {
            logger.debug(`Error fetching collection post image:`, error);
            result.imageUrl = getRandomAssetUrl('posts');
          }
        } else {
          result.imageUrl = getRandomAssetUrl('posts');
        }
        break;
      }

      // Mesaj bildirimleri
      case NotificationType.NEW_MESSAGE:
      case NotificationType.DM_REQUEST_RECEIVED:
      case NotificationType.DM_REQUEST_ACCEPTED:
      case NotificationType.DM_REQUEST_DECLINED:
      case NotificationType.SUPPORT_REQUEST_ACCEPTED: {
        // Mesaj için avatar yeterli, imageUrl field'ı eklenmez (undefined kalır)
        // imageUrl sadece event ve badge bildirimleri için kullanılır
        break;
      }

      // Tips bildirimleri (avatar = gönderen için enricher yukarıda senderUserId ile çözer)
      case NotificationType.TIPS_RECEIVED:
      case NotificationType.TIPS_SENT: {
        break;
      }

      // Transaction (DEPOSIT vb.): avatar = gönderen (senderUserId) yukarıda çözülür
      case NotificationType.TRANSACTION_CONFIRMED:
      case NotificationType.TRANSACTION_FAILED:
      case NotificationType.TRANSACTION_PENDING: {
        break;
      }

      // Diğer bildirimler için rastgele badge görseli
      default: {
        result.imageUrl = getRandomAssetUrl('badges');
        break;
      }
    }
  } catch (error) {
    logger.error('Error enriching notification data:', error);
    // Hata durumunda fallback değerler
    if (!result.avatar) result.avatar = getRandomAssetUrl('avatars');
    if (!result.imageUrl) result.imageUrl = getRandomAssetUrl('badges');
  }

  return result;
}
