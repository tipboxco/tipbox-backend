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

// Tüm 22 notification type'ı sırayla göndermek için
const ALL_NOTIFICATION_TYPES: NotificationType[] = [
  // Interaction Notifications (6)
  NotificationType.POST_LIKED,
  NotificationType.POST_COMMENTED,
  NotificationType.POST_SHARED,
  NotificationType.POST_FAVORITED,
  NotificationType.COMMENT_LIKED,
  NotificationType.COMMENT_REPLIED,
  
  // Trust & Follow Notifications (2)
  NotificationType.NEW_TRUSTER,
  NotificationType.NEW_TRUSTED_BY,
  
  // Messaging Notifications (4)
  NotificationType.NEW_MESSAGE,
  NotificationType.DM_REQUEST_RECEIVED,
  NotificationType.DM_REQUEST_ACCEPTED,
  NotificationType.SUPPORT_REQUEST_ACCEPTED,
  
  // Collection Notifications (2)
  NotificationType.COLLECTION_POST_ADDED,
  NotificationType.COLLECTION_SHARED,
  
  // Gamification Notifications (4)
  NotificationType.NEW_BADGE,
  NotificationType.ACHIEVEMENT_UNLOCKED,
  NotificationType.LEVEL_UP,
  NotificationType.REWARD_EARNED,
  
  // Expert Notifications (2)
  NotificationType.EXPERT_REQUEST_AVAILABLE,
  NotificationType.EXPERT_REQUEST_ANSWERED,
  
  // Event Notifications (3)
  NotificationType.EVENT_STARTED,
  NotificationType.EVENT_ENDING_SOON,
  NotificationType.EVENT_REWARD_AVAILABLE,
  
  // System Notifications (3)
  NotificationType.SYSTEM_ANNOUNCEMENT,
  NotificationType.ACCOUNT_SECURITY,
  NotificationType.TIPS_RECEIVED,
  NotificationType.TIPS_SENT,
  
  // Wallet & Transaction Notifications (5)
  NotificationType.WALLET_CONNECTED,
  NotificationType.WALLET_DISCONNECTED,
  NotificationType.TRANSACTION_CONFIRMED,
  NotificationType.TRANSACTION_FAILED,
  NotificationType.TRANSACTION_PENDING,
  
  // Reward Notifications (4)
  NotificationType.REWARD_CLAIMABLE,
  NotificationType.REWARD_CLAIMED,
  NotificationType.REWARD_EXPIRED,
  NotificationType.MULTIPLE_REWARDS_AVAILABLE,
  
  // NFT Notifications (6)
  NotificationType.NFT_RECEIVED,
  NotificationType.NFT_SENT,
  NotificationType.NFT_SOLD,
  NotificationType.NFT_PURCHASED,
  NotificationType.NFT_LISTED,
  NotificationType.NFT_LISTING_SOLD,
];

// Gerçekçi başlık ve mesajlar
const NOTIFICATION_CONTENT: Record<NotificationType, { title: string; message: string }> = {
  [NotificationType.POST_LIKED]: {
    title: 'Postunuz Beğenildi! ❤️',
    message: '{{userName}} postunuzu beğendi',
  },
  [NotificationType.POST_COMMENTED]: {
    title: 'Yeni Yorum! 💬',
    message: '{{userName}} postunuza yorum yaptı: "{{commentPreview}}"',
  },
  [NotificationType.POST_SHARED]: {
    title: 'Postunuz Paylaşıldı! 📤',
    message: '{{userName}} postunuzu paylaştı',
  },
  [NotificationType.POST_FAVORITED]: {
    title: 'Favorilere Eklendi! ⭐',
    message: '{{userName}} postunuzu favorilerine ekledi',
  },
  [NotificationType.COMMENT_LIKED]: {
    title: 'Yorumunuz Beğenildi! 👍',
    message: '{{userName}} yorumunuzu beğendi',
  },
  [NotificationType.COMMENT_REPLIED]: {
    title: 'Yorumunuza Cevap! 💭',
    message: '{{userName}} yorumunuza cevap verdi: "{{replyPreview}}"',
  },
  [NotificationType.NEW_TRUSTER]: {
    title: 'Yeni Takipçi! 👥',
    message: '{{userName}} sizi takip etmeye başladı',
  },
  [NotificationType.NEW_TRUSTED_BY]: {
    title: 'Takip Edildiniz! 🤝',
    message: '{{userName}} sizi takip ediyor',
  },
  [NotificationType.NEW_MESSAGE]: {
    title: 'Yeni Mesaj! 💬',
    message: '{{userName}}: {{messagePreview}}',
  },
  [NotificationType.DM_REQUEST_RECEIVED]: {
    title: 'Mesaj İsteği! 📩',
    message: '{{userName}} size mesaj göndermek istiyor',
  },
  [NotificationType.DM_REQUEST_ACCEPTED]: {
    title: 'Mesaj İsteği Kabul Edildi! ✅',
    message: '{{userName}} mesaj isteğinizi kabul etti',
  },
  [NotificationType.SUPPORT_REQUEST_ACCEPTED]: {
    title: 'Destek Talebi Kabul Edildi! 🎉',
    message: '{{userName}} destek talebinizi kabul etti',
  },
  [NotificationType.COLLECTION_POST_ADDED]: {
    title: 'Koleksiyona Eklendi! 📚',
    message: '{{userName}} postunuzu koleksiyonuna ekledi',
  },
  [NotificationType.COLLECTION_SHARED]: {
    title: 'Koleksiyon Paylaşıldı! 🔄',
    message: '{{userName}} koleksiyonunu paylaştı',
  },
  [NotificationType.NEW_BADGE]: {
    title: 'Yeni Rozet! 🏆',
    message: '{{badgeName}} rozetini kazandınız!',
  },
  [NotificationType.ACHIEVEMENT_UNLOCKED]: {
    title: 'Başarı Açıldı! 🎯',
    message: '{{achievementName}} başarımını tamamladınız!',
  },
  [NotificationType.LEVEL_UP]: {
    title: 'Seviye Atladınız! ⬆️',
    message: 'Seviye {{level}} oldunuz! Tebrikler!',
  },
  [NotificationType.REWARD_EARNED]: {
    title: 'Ödül Kazandınız! 🎁',
    message: '{{amount}} TIPS kazandınız!',
  },
  [NotificationType.EXPERT_REQUEST_AVAILABLE]: {
    title: 'Uzman Sorusu Mevcut! 💡',
    message: '{{productName}} için yeni uzman sorusu var',
  },
  [NotificationType.EXPERT_REQUEST_ANSWERED]: {
    title: 'Uzman Sorusu Cevaplandı! ✅',
    message: '{{userName}} uzman sorusunu cevapladı',
  },
  [NotificationType.EVENT_STARTED]: {
    title: 'Etkinlik Başladı! 🎉',
    message: '{{eventName}} etkinliği başladı, katılın!',
  },
  [NotificationType.EVENT_ENDING_SOON]: {
    title: 'Etkinlik Bitiyor! ⏰',
    message: '{{eventName}} etkinliği {{hoursRemaining}} saat içinde bitiyor',
  },
  [NotificationType.EVENT_REWARD_AVAILABLE]: {
    title: 'Etkinlik Ödülü! 🎁',
    message: '{{eventName}} etkinliğinden {{rewardAmount}} TIPS ödülü kazandınız',
  },
  [NotificationType.SYSTEM_ANNOUNCEMENT]: {
    title: 'Sistem Duyurusu! 📢',
    message: '{{announcement}}',
  },
  [NotificationType.ACCOUNT_SECURITY]: {
    title: 'Güvenlik Uyarısı! 🔒',
    message: 'Hesabınızda yeni bir giriş tespit edildi',
  },
  [NotificationType.TIPS_RECEIVED]: {
    title: 'TIPS Aldınız! 💰',
    message: '{{userName}} size {{amount}} TIPS gönderdi',
  },
  [NotificationType.TIPS_SENT]: {
    title: 'TIPS Gönderildi! 💸',
    message: '{{userName}} kullanıcısına {{amount}} TIPS gönderdiniz',
  },
  [NotificationType.WALLET_CONNECTED]: {
    title: 'Cüzdan Bağlandı! 🔗',
    message: 'Cüzdanınız başarıyla bağlandı',
  },
  [NotificationType.WALLET_DISCONNECTED]: {
    title: 'Cüzdan Bağlantısı Kesildi! 🔌',
    message: 'Cüzdanınızın bağlantısı kesildi',
  },
  [NotificationType.TRANSACTION_CONFIRMED]: {
    title: 'İşlem Onaylandı! ✅',
    message: '{{amount}} TIPS işleminiz onaylandı',
  },
  [NotificationType.TRANSACTION_FAILED]: {
    title: 'İşlem Başarısız! ❌',
    message: '{{amount}} TIPS işleminiz başarısız oldu',
  },
  [NotificationType.TRANSACTION_PENDING]: {
    title: 'İşlem Beklemede! ⏳',
    message: '{{amount}} TIPS işleminiz onay bekliyor',
  },
  [NotificationType.REWARD_CLAIMABLE]: {
    title: 'Ödül Talep Edilebilir! 🎁',
    message: '{{rewardName}} ödülünüzü talep edebilirsiniz',
  },
  [NotificationType.REWARD_CLAIMED]: {
    title: 'Ödül Talep Edildi! ✅',
    message: '{{rewardName}} ödülünüz talep edildi',
  },
  [NotificationType.REWARD_EXPIRED]: {
    title: 'Ödül Süresi Doldu! ⏰',
    message: '{{rewardName}} ödülünüzün süresi doldu',
  },
  [NotificationType.MULTIPLE_REWARDS_AVAILABLE]: {
    title: 'Çoklu Ödüller! 🎁',
    message: '{{count}} adet ödülünüz talep edilebilir',
  },
  [NotificationType.NFT_RECEIVED]: {
    title: 'NFT Aldınız! 🖼️',
    message: '{{userName}} size {{nftName}} NFT\'sini gönderdi',
  },
  [NotificationType.NFT_SENT]: {
    title: 'NFT Gönderildi! 📤',
    message: '{{userName}} kullanıcısına {{nftName}} NFT\'sini gönderdiniz',
  },
  [NotificationType.NFT_SOLD]: {
    title: 'NFT Satıldı! 💰',
    message: '{{nftName}} NFT\'niz {{amount}} TIPS karşılığında satıldı',
  },
  [NotificationType.NFT_PURCHASED]: {
    title: 'NFT Satın Alındı! 🛒',
    message: '{{nftName}} NFT\'sini {{amount}} TIPS karşılığında satın aldınız',
  },
  [NotificationType.NFT_LISTED]: {
    title: 'NFT Listelendi! 📋',
    message: '{{nftName}} NFT\'niz {{amount}} TIPS fiyatıyla listelendi',
  },
  [NotificationType.NFT_LISTING_SOLD]: {
    title: 'Listelenen NFT Satıldı! ✅',
    message: '{{nftName}} NFT\'niz {{amount}} TIPS karşılığında satıldı',
  },
};

// Gerçekçi yorum metinleri
const COMMENT_TEXTS = [
  'Harika bir paylaşım! Çok faydalı oldu.',
  'Mükemmel bilgiler, teşekkürler!',
  'Çok güzel bir içerik, beğendim.',
  'Bu konuda daha fazla bilgi paylaşabilir misin?',
  'Harika! Benzer bir deneyimim var.',
  'Çok yararlı, paylaşım için teşekkürler.',
  'Güzel bir paylaşım, devamını bekliyorum.',
  'Çok faydalı bilgiler, not aldım.',
];

// Gerçekçi mesaj metinleri
const MESSAGE_TEXTS = [
  'Merhaba! Nasılsın?',
  'Harika bir gün!',
  'Bir sorum var, yardımcı olabilir misin?',
  'Selam! Nasıl gidiyor?',
  'Merhaba, nasılsın?',
  'Harika bir paylaşım yaptın!',
  'Teşekkürler!',
  'Çok faydalı oldu.',
];

// Gerçekçi ürün isimleri
const PRODUCT_NAMES = [
  'iPhone 15 Pro',
  'Samsung Galaxy S24',
  'MacBook Pro M3',
  'AirPods Pro',
  'iPad Air',
  'Sony WH-1000XM5',
  'Nintendo Switch',
  'PlayStation 5',
];

// Gerçekçi etkinlik isimleri
const EVENT_NAMES = [
  'Yılbaşı Özel Etkinliği',
  'Teknoloji Festivali',
  'Yaz Kampanyası',
  'Kış İndirimleri',
  'Bahar Şenliği',
  'Yaz Fırsatları',
  'Sonbahar Kampanyası',
];

// Gerçekçi rozet isimleri
const BADGE_NAMES = [
  'Güvenilir Ses',
  'Aktif Kullanıcı',
  'Topluluk Lideri',
  'İçerik Üreticisi',
  'Yardımsever',
  'Uzman',
  'Yıldız Kullanıcı',
];

// Gerçekçi başarı isimleri
const ACHIEVEMENT_NAMES = [
  'İlk Post',
  '10 Beğeni',
  '100 Takipçi',
  '50 Yorum',
  'İlk Rozet',
  'Topluluk Üyesi',
];

let currentTypeIndex = 0;
let omerId: string | null = null;
let otherUserId: string | null = null;
let createdPosts: string[] = [];
let createdComments: string[] = [];
let createdEvents: string[] = [];
let createdBadges: string[] = [];

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

async function ensureUsers() {
  console.log('👤 Kullanıcılar kontrol ediliyor...');
  
  // Ömer kullanıcısını bul
  const omer = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { contains: 'omer', mode: 'insensitive' } },
        { profile: { displayName: { contains: 'omer', mode: 'insensitive' } } },
      ],
    },
    include: {
      avatars: {
        where: { isActive: true },
        take: 1,
      },
    },
  });

  if (!omer) {
    throw new Error('Ömer kullanıcısı bulunamadı!');
  }

  omerId = omer.id;
  console.log(`✅ Ömer bulundu: ${omer.id}`);

  // Diğer kullanıcıyı bul veya oluştur
  const otherUser = await prisma.user.findFirst({
    where: {
      id: { not: omer.id },
      email: { contains: 'trust', mode: 'insensitive' },
    },
    include: {
      avatars: {
        where: { isActive: true },
        take: 1,
      },
    },
  });

  if (!otherUser) {
    throw new Error('Diğer kullanıcı bulunamadı!');
  }

  otherUserId = otherUser.id;
  console.log(`✅ Diğer kullanıcı bulundu: ${otherUser.id}\n`);
}

async function createTestPost(userId: string): Promise<string> {
  const postId = `01${Date.now().toString(36).toUpperCase().padStart(24, '0')}`;
  
  const post = await prisma.contentPost.create({
    data: {
      id: postId,
      userId,
      type: ContentPostType.TIPS,
      title: 'Test Post - ' + new Date().toLocaleString('tr-TR'),
      body: 'Bu bir test postudur. Bildirim testleri için oluşturulmuştur.',
      inventoryRequired: false,
      isBoosted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  createdPosts.push(postId);
  return postId;
}

async function createTestComment(postId: string, userId: string): Promise<string> {
  const commentId = `01${Date.now().toString(36).toUpperCase().padStart(24, '0')}`;
  const commentText = COMMENT_TEXTS[Math.floor(Math.random() * COMMENT_TEXTS.length)];
  
  const comment = await prisma.contentComment.create({
    data: {
      id: commentId,
      postId,
      userId,
      comment: commentText,
      isAnswer: false,
      likesCount: 0,
    },
  });

  createdComments.push(commentId);
  return commentId;
}

async function createTestEvent(): Promise<string> {
  const eventId = uuidv4();
  const eventName = EVENT_NAMES[Math.floor(Math.random() * EVENT_NAMES.length)];
  
  // Mevcut bir event bul veya oluştur
  let event = await prisma.wishboxEvent.findFirst({
    where: { status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
  });

  if (!event) {
    // Basit bir event oluştur
    event = await prisma.wishboxEvent.create({
      data: {
        id: eventId,
        title: eventName,
        status: 'PUBLISHED',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 gün sonra
      },
    });
  }

  createdEvents.push(event.id);
  return event.id;
}

async function createTestBadge(): Promise<string> {
  // Mevcut bir badge bul
  let badge = await prisma.badge.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!badge) {
    // BadgeCategory bul veya oluştur
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

    const badgeId = uuidv4();
    const badgeName = BADGE_NAMES[Math.floor(Math.random() * BADGE_NAMES.length)];
    
    badge = await prisma.badge.create({
      data: {
        id: badgeId,
        name: badgeName,
        description: 'Test rozeti - Bildirim testleri için',
        imageUrl: `badges/brand/brandbadge${Math.floor(Math.random() * 5) + 1}.png`,
        categoryId: category.id,
        type: 'COSMETIC', // BadgeType enum: ACHIEVEMENT, EVENT, COSMETIC
        rarity: 'COMMON', // BadgeRarity enum: COMMON, RARE, EPIC
      },
    });
  }

  createdBadges.push(badge.id);
  return badge.id;
}

async function sendNotificationForType(type: NotificationType) {
  if (!omerId || !otherUserId) {
    throw new Error('Kullanıcılar bulunamadı!');
  }

  const content = NOTIFICATION_CONTENT[type];
  if (!content) {
    console.log(`⚠️  ${type} için içerik bulunamadı, atlanıyor...`);
    return;
  }

  console.log(`\n📨 ${type} bildirimi gönderiliyor...`);

  try {
    let data: any = {};

    switch (type) {
      // Post Interaction Notifications
      case NotificationType.POST_LIKED:
      case NotificationType.POST_FAVORITED:
      case NotificationType.POST_SHARED: {
        let postId = createdPosts[createdPosts.length - 1];
        if (!postId) {
          postId = await createTestPost(omerId);
        }
        
        // Gerçek etkileşim oluştur
        if (type === NotificationType.POST_LIKED) {
          await interactionService.likePost(otherUserId, postId);
        } else if (type === NotificationType.POST_FAVORITED) {
          await interactionService.favoritePost(otherUserId, postId);
        } else if (type === NotificationType.POST_SHARED) {
          await interactionService.sharePost(otherUserId, postId, ShareType.EXTERNAL_SHARE, 'Twitter');
        }
        
        const user = await prisma.user.findUnique({
          where: { id: otherUserId },
          include: { profile: true },
        });
        
        data = {
          postId,
          likerId: type === NotificationType.POST_LIKED ? otherUserId : undefined,
          userId: type === NotificationType.POST_FAVORITED ? otherUserId : undefined,
          sharerId: type === NotificationType.POST_SHARED ? otherUserId : undefined,
          userName: user?.profile?.displayName || user?.email || 'Kullanıcı',
        };
        break;
      }

      case NotificationType.POST_COMMENTED: {
        let postId = createdPosts[createdPosts.length - 1];
        if (!postId) {
          postId = await createTestPost(omerId);
        }
        
        const commentId = await createTestComment(postId, otherUserId);
        const comment = await prisma.contentComment.findUnique({
          where: { id: commentId },
        });
        
        const user = await prisma.user.findUnique({
          where: { id: otherUserId },
          include: { profile: true },
        });
        
        data = {
          postId,
          commentId,
          commenterId: otherUserId,
          userName: user?.profile?.displayName || user?.email || 'Kullanıcı',
          commentPreview: comment?.comment?.substring(0, 50) || 'Yorum yapıldı',
        };
        break;
      }

      case NotificationType.COMMENT_LIKED:
      case NotificationType.COMMENT_REPLIED: {
        let postId = createdPosts[createdPosts.length - 1];
        if (!postId) {
          postId = await createTestPost(omerId);
        }
        
        // Ömer'in bir yorumunu bul veya oluştur
        let omerComment = await prisma.contentComment.findFirst({
          where: { postId, userId: omerId },
        });
        
        if (!omerComment) {
          const commentId = await createTestComment(postId, omerId);
          omerComment = await prisma.contentComment.findUnique({
            where: { id: commentId },
          });
        }
        
        if (!omerComment) {
          throw new Error('Ömer yorumu oluşturulamadı!');
        }
        
        if (type === NotificationType.COMMENT_LIKED) {
          await interactionService.likeComment(otherUserId, omerComment.id);
        } else {
          const replyId = await createTestComment(postId, otherUserId);
          const reply = await prisma.contentComment.findUnique({
            where: { id: replyId },
          });
          
          data.replyPreview = reply?.comment?.substring(0, 50) || 'Cevap verildi';
        }
        
        const user = await prisma.user.findUnique({
          where: { id: otherUserId },
          include: { profile: true },
        });
        
        data = {
          ...data,
          postId,
          commentId: omerComment.id,
          likerId: type === NotificationType.COMMENT_LIKED ? otherUserId : undefined,
          replierId: type === NotificationType.COMMENT_REPLIED ? otherUserId : undefined,
          userName: user?.profile?.displayName || user?.email || 'Kullanıcı',
        };
        break;
      }

      // Trust Notifications
      case NotificationType.NEW_TRUSTER:
      case NotificationType.NEW_TRUSTED_BY: {
        const user = await prisma.user.findUnique({
          where: { id: otherUserId },
          include: { profile: true },
        });
        
        data = {
          trusterId: type === NotificationType.NEW_TRUSTER ? otherUserId : undefined,
          trustedId: type === NotificationType.NEW_TRUSTED_BY ? otherUserId : undefined,
          userName: user?.profile?.displayName || user?.email || 'Kullanıcı',
        };
        break;
      }

      // Messaging Notifications
      case NotificationType.NEW_MESSAGE: {
        const messageText = MESSAGE_TEXTS[Math.floor(Math.random() * MESSAGE_TEXTS.length)];
        await messagingService.sendDirectMessage(otherUserId, omerId, messageText);
        
        const user = await prisma.user.findUnique({
          where: { id: otherUserId },
          include: { profile: true },
        });
        
        data = {
          senderId: otherUserId,
          userName: user?.profile?.displayName || user?.email || 'Kullanıcı',
          messagePreview: messageText.substring(0, 50),
        };
        break;
      }

      case NotificationType.DM_REQUEST_RECEIVED:
      case NotificationType.DM_REQUEST_ACCEPTED:
      case NotificationType.SUPPORT_REQUEST_ACCEPTED: {
        const user = await prisma.user.findUnique({
          where: { id: otherUserId },
          include: { profile: true },
        });
        
        data = {
          requesterId: otherUserId,
          accepterId: type === NotificationType.DM_REQUEST_ACCEPTED ? otherUserId : undefined,
          userName: user?.profile?.displayName || user?.email || 'Kullanıcı',
        };
        break;
      }

      // Collection Notifications
      case NotificationType.COLLECTION_POST_ADDED:
      case NotificationType.COLLECTION_SHARED: {
        let postId = createdPosts[createdPosts.length - 1];
        if (!postId) {
          postId = await createTestPost(omerId);
        }
        
        const user = await prisma.user.findUnique({
          where: { id: otherUserId },
          include: { profile: true },
        });
        
        data = {
          postId,
          collectionId: uuidv4(),
          userName: user?.profile?.displayName || user?.email || 'Kullanıcı',
        };
        break;
      }

      // Gamification Notifications
      case NotificationType.NEW_BADGE: {
        const badgeId = await createTestBadge();
        const badge = await prisma.badge.findUnique({
          where: { id: badgeId },
        });
        
        data = {
          badgeId,
          badgeName: badge?.name || 'Test Rozeti',
          imageUrl: badge?.imageUrl || 'badges/brand/brandbadge1.png',
        };
        break;
      }

      case NotificationType.ACHIEVEMENT_UNLOCKED: {
        const achievementName = ACHIEVEMENT_NAMES[Math.floor(Math.random() * ACHIEVEMENT_NAMES.length)];
        data = {
          achievementId: uuidv4(),
          achievementName,
        };
        break;
      }

      case NotificationType.LEVEL_UP: {
        const level = Math.floor(Math.random() * 10) + 2;
        data = {
          level,
          previousLevel: level - 1,
        };
        break;
      }

      case NotificationType.REWARD_EARNED: {
        const amount = Math.floor(Math.random() * 1000) + 100;
        data = {
          amount,
          currency: 'TIPS',
        };
        break;
      }

      // Expert Notifications
      case NotificationType.EXPERT_REQUEST_AVAILABLE:
      case NotificationType.EXPERT_REQUEST_ANSWERED: {
        const productName = PRODUCT_NAMES[Math.floor(Math.random() * PRODUCT_NAMES.length)];
        const user = await prisma.user.findUnique({
          where: { id: otherUserId },
          include: { profile: true },
        });
        
        data = {
          requestId: uuidv4(),
          productId: uuidv4(),
          productName,
          expertId: type === NotificationType.EXPERT_REQUEST_ANSWERED ? otherUserId : undefined,
          userName: user?.profile?.displayName || user?.email || 'Kullanıcı',
        };
        break;
      }

      // Event Notifications
      case NotificationType.EVENT_STARTED:
      case NotificationType.EVENT_ENDING_SOON:
      case NotificationType.EVENT_REWARD_AVAILABLE: {
        const eventId = await createTestEvent();
        const event = await prisma.wishboxEvent.findUnique({
          where: { id: eventId },
        });
        
        data = {
          eventId,
          eventName: event?.title || 'Test Etkinliği',
          hoursRemaining: type === NotificationType.EVENT_ENDING_SOON ? 24 : undefined,
          rewardAmount: type === NotificationType.EVENT_REWARD_AVAILABLE ? 500 : undefined,
        };
        break;
      }

      // System Notifications
      case NotificationType.SYSTEM_ANNOUNCEMENT: {
        data = {
          announcement: 'Yeni özellikler eklendi! Uygulamayı güncelleyin.',
        };
        break;
      }

      case NotificationType.ACCOUNT_SECURITY: {
        data = {
          device: 'iPhone 15 Pro',
          location: 'İstanbul, Türkiye',
          timestamp: new Date().toISOString(),
        };
        break;
      }

      case NotificationType.TIPS_RECEIVED:
      case NotificationType.TIPS_SENT: {
        const amount = Math.floor(Math.random() * 1000) + 100;
        const user = await prisma.user.findUnique({
          where: { id: otherUserId },
          include: { profile: true },
        });
        
        data = {
          amount,
          currency: 'TIPS',
          transactionId: uuidv4(),
          userId: type === NotificationType.TIPS_RECEIVED ? otherUserId : undefined,
          userName: user?.profile?.displayName || user?.email || 'Kullanıcı',
        };
        break;
      }

      // Wallet & Transaction Notifications
      case NotificationType.WALLET_CONNECTED:
      case NotificationType.WALLET_DISCONNECTED: {
        data = {
          walletAddress: '0x' + Math.random().toString(16).substring(2, 42),
          provider: 'MetaMask',
        };
        break;
      }

      case NotificationType.TRANSACTION_CONFIRMED:
      case NotificationType.TRANSACTION_FAILED:
      case NotificationType.TRANSACTION_PENDING: {
        const amount = Math.floor(Math.random() * 1000) + 100;
        data = {
          amount,
          currency: 'TIPS',
          transactionId: uuidv4(),
          hash: '0x' + Math.random().toString(16).substring(2, 66),
        };
        break;
      }

      // Reward Notifications
      case NotificationType.REWARD_CLAIMABLE:
      case NotificationType.REWARD_CLAIMED:
      case NotificationType.REWARD_EXPIRED: {
        const rewardName = 'Özel Ödül #' + Math.floor(Math.random() * 100);
        data = {
          rewardId: uuidv4(),
          rewardName,
          amount: Math.floor(Math.random() * 1000) + 100,
        };
        break;
      }

      case NotificationType.MULTIPLE_REWARDS_AVAILABLE: {
        const count = Math.floor(Math.random() * 5) + 2;
        data = {
          count,
          rewardIds: Array.from({ length: count }, () => uuidv4()),
        };
        break;
      }

      // NFT Notifications
      case NotificationType.NFT_RECEIVED:
      case NotificationType.NFT_SENT: {
        const nftName = 'Özel NFT #' + Math.floor(Math.random() * 1000);
        const user = await prisma.user.findUnique({
          where: { id: otherUserId },
          include: { profile: true },
        });
        
        data = {
          nftId: uuidv4(),
          nftName,
          senderId: type === NotificationType.NFT_RECEIVED ? otherUserId : undefined,
          recipientId: type === NotificationType.NFT_SENT ? otherUserId : undefined,
          userName: user?.profile?.displayName || user?.email || 'Kullanıcı',
        };
        break;
      }

      case NotificationType.NFT_SOLD:
      case NotificationType.NFT_PURCHASED:
      case NotificationType.NFT_LISTED:
      case NotificationType.NFT_LISTING_SOLD: {
        const nftName = 'Özel NFT #' + Math.floor(Math.random() * 1000);
        const amount = Math.floor(Math.random() * 5000) + 1000;
        
        data = {
          nftId: uuidv4(),
          nftName,
          amount,
          currency: 'TIPS',
          buyerId: type === NotificationType.NFT_PURCHASED ? otherUserId : undefined,
          sellerId: type === NotificationType.NFT_SOLD ? otherUserId : undefined,
        };
        break;
      }
    }

    // Bildirimi gönder
    await notificationService.sendNotification(omerId, type, data);
    
    console.log(`✅ ${type} bildirimi gönderildi!`);
    console.log(`   Başlık: ${content.title}`);
    console.log(`   Mesaj: ${content.message}`);
    
  } catch (error: any) {
    console.error(`❌ ${type} bildirimi gönderilirken hata:`, error.message);
    logger.error(`Error sending ${type} notification:`, error);
  }
}

async function startComprehensiveNotifications() {
  try {
    await initializeServices();
    await ensureUsers();

    console.log('🚀 Kapsamlı bildirim testi başlatılıyor...');
    console.log(`📊 Toplam ${ALL_NOTIFICATION_TYPES.length} farklı bildirim tipi gönderilecek\n`);
    console.log('⏰ Her 5 saniyede bir bildirim gönderilecek\n');

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    while (true) {
      const type = ALL_NOTIFICATION_TYPES[currentTypeIndex % ALL_NOTIFICATION_TYPES.length];
      currentTypeIndex++;

      await sendNotificationForType(type);
      
      console.log(`\n⏳ 5 saniye bekleniyor...\n`);
      await delay(5000);
    }

  } catch (error: any) {
    console.error('❌ Hata:', error);
    logger.error('Comprehensive notification test error:', error);
    process.exit(1);
  }
}

// Script'i çalıştır
startComprehensiveNotifications().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
