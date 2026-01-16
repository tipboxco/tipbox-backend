import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { NotificationService } from './src/application/notification/notification.service';
import { NotificationType } from './src/domain/notification/notification-type.enum';
import { InteractionService } from './src/application/interaction/interaction.service';
import { ShareType } from './src/domain/interaction/share-type.enum';
import { ContentPostType } from './src/domain/content/content-post-type.enum';
import logger from './src/infrastructure/logger/logger';
import RedisConfigManager from './src/infrastructure/config/redis.config';
import QueueProvider from './src/infrastructure/queue/queue.provider';
import SocketManager from './src/infrastructure/realtime/socket-manager';
import http from 'http';
import { Server } from 'socket.io';

const prisma = new PrismaClient();
const notificationService = new NotificationService();
const interactionService = new InteractionService();

// Post bildirim tipleri
const POST_NOTIFICATION_TYPES = [
  NotificationType.POST_LIKED,
  NotificationType.POST_COMMENTED,
  NotificationType.POST_SHARED,
  NotificationType.POST_FAVORITED,
];

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
      profile: true,
      avatars: {
        where: { isActive: true },
        take: 1,
      },
    },
  });

  if (!omer) {
    throw new Error('Ömer kullanıcısı bulunamadı!');
  }

  console.log(`✅ Ömer bulundu: ${omer.profile?.displayName || omer.email} (${omer.id})`);

  // Diğer kullanıcıyı bul (Trust User 1)
  const otherUser = await prisma.user.findFirst({
    where: {
      id: { not: omer.id },
      email: { contains: 'trust', mode: 'insensitive' },
    },
    include: {
      profile: true,
      avatars: {
        where: { isActive: true },
        take: 1,
      },
    },
  });

  if (!otherUser) {
    throw new Error('Diğer kullanıcı bulunamadı!');
  }

  console.log(`✅ Diğer kullanıcı bulundu: ${otherUser.profile?.displayName || otherUser.email} (${otherUser.id})\n`);

  return { omer, otherUser };
}

async function createTestPost(userId: string): Promise<string> {
  const postId = `01${Date.now().toString(36).toUpperCase().padStart(24, '0')}`;
  
  const post = await prisma.contentPost.create({
    data: {
      id: postId,
      userId,
      type: ContentPostType.TIPS,
      title: `Test Post - ${new Date().toLocaleString('tr-TR')}`,
      body: 'Bu bir test postudur. Bildirim testleri için oluşturulmuştur. Gerçek kullanıcı etkileşimleri test edilecektir.',
      inventoryRequired: false,
      isBoosted: false,
    },
  });

  console.log(`   📝 Post oluşturuldu: ${postId}`);
  return postId;
}

async function sendPostNotification(
  type: NotificationType,
  omerId: string,
  otherUserId: string,
  postId: string
) {
  try {
    console.log(`\n📨 ${type} bildirimi gönderiliyor...`);

    switch (type) {
      case NotificationType.POST_LIKED: {
        // Önce beğeniyi kaldır (varsa)
        const existingLike = await prisma.contentLike.findFirst({
          where: { userId: otherUserId, postId },
        });
        if (existingLike) {
          await interactionService.unlikePost(otherUserId, postId);
        }
        
        // Gerçek beğeni oluştur
        await interactionService.likePost(otherUserId, postId);
        console.log(`   ✅ Post beğenildi (gerçek etkileşim)`);
        break;
      }

      case NotificationType.POST_COMMENTED: {
        const commentText = COMMENT_TEXTS[Math.floor(Math.random() * COMMENT_TEXTS.length)];
        const commentId = `01${Date.now().toString(36).toUpperCase().padStart(24, '0')}`;
        
        await prisma.contentComment.create({
          data: {
            id: commentId,
            postId,
            userId: otherUserId,
            comment: commentText,
            isAnswer: false,
            likesCount: 0,
          },
        });
        
        // Post comment count'u güncelle
        await prisma.contentPost.update({
          where: { id: postId },
          data: { commentsCount: { increment: 1 } },
        });
        
        console.log(`   ✅ Yorum eklendi: "${commentText.substring(0, 50)}..."`);
        break;
      }

      case NotificationType.POST_SHARED: {
        // Gerçek paylaşım oluştur
        await interactionService.sharePost(otherUserId, postId, ShareType.EXTERNAL_SHARE, 'Twitter');
        console.log(`   ✅ Post paylaşıldı (gerçek etkileşim)`);
        break;
      }

      case NotificationType.POST_FAVORITED: {
        // Önce favoriden kaldır (varsa)
        const existingFavorite = await prisma.contentFavorite.findFirst({
          where: { userId: otherUserId, postId },
        });
        if (existingFavorite) {
          await interactionService.unfavoritePost(otherUserId, postId);
        }
        
        // Gerçek favori oluştur
        await interactionService.favoritePost(otherUserId, postId);
        console.log(`   ✅ Post favorilere eklendi (gerçek etkileşim)`);
        break;
      }
    }

    console.log(`   ✅ ${type} bildirimi gönderildi!`);
    
  } catch (error: any) {
    console.error(`   ❌ ${type} bildirimi gönderilirken hata:`, error.message);
    logger.error(`Error sending ${type} notification:`, error);
  }
}

async function startPostNotifications() {
  try {
    await initializeServices();
    const { omer, otherUser } = await ensureUsers();

    console.log('🚀 Post bildirim testi başlatılıyor...');
    console.log(`📊 Toplam 10 adet post bildirimi gönderilecek\n`);
    console.log('⏰ Her 5 saniyede bir bildirim gönderilecek\n');

    // Ömer için bir post oluştur
    const postId = await createTestPost(omer.id);
    console.log(`\n✅ Test postu hazır: ${postId}\n`);

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // 10 adet bildirim gönder (her tip 2-3 kez)
    for (let i = 0; i < 10; i++) {
      const type = POST_NOTIFICATION_TYPES[i % POST_NOTIFICATION_TYPES.length];
      
      await sendPostNotification(type, omer.id, otherUser.id, postId);
      
      if (i < 9) {
        console.log(`\n⏳ 5 saniye bekleniyor...\n`);
        await delay(5000);
      }
    }

    console.log('\n✅ Tüm post bildirimleri gönderildi!');
    console.log(`📊 Toplam: 10 bildirim`);
    console.log(`   - POST_LIKED: ${Math.ceil(10 / 4)} adet`);
    console.log(`   - POST_COMMENTED: ${Math.ceil(10 / 4)} adet`);
    console.log(`   - POST_SHARED: ${Math.floor(10 / 4)} adet`);
    console.log(`   - POST_FAVORITED: ${Math.floor(10 / 4)} adet\n`);

    await prisma.$disconnect();
    process.exit(0);

  } catch (error: any) {
    console.error('❌ Hata:', error);
    logger.error('Post notification test error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Script'i çalıştır
startPostNotifications().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
