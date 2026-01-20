import dotenv from 'dotenv';
dotenv.config();

import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import { NotificationService } from '../src/application/notification/notification.service';
import { NotificationType } from '../src/domain/notification/notification-type.enum';
import { InteractionService } from '../src/application/interaction/interaction.service';
import { ShareType } from '../src/domain/interaction/share-type.enum';
import logger from '../src/infrastructure/logger/logger';
import RedisConfigManager from '../src/infrastructure/config/redis.config';
import QueueProvider from '../src/infrastructure/queue/queue.provider';
import SocketManager from '../src/infrastructure/realtime/socket-manager';
import http from 'http';
import { Server } from 'socket.io';

const prisma = getPrisma();
const notificationService = new NotificationService();
const interactionService = new InteractionService();

// Post bildirim tipleri
const POST_NOTIFICATION_TYPES = [
  NotificationType.POST_LIKED,
  NotificationType.POST_COMMENTED,
  NotificationType.POST_SHARED,
  NotificationType.POST_FAVORITED,
  NotificationType.COMMENT_LIKED,
  NotificationType.COMMENT_REPLIED,
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

async function findOmerUser() {
  console.log('👤 Omer kullanıcısı aranıyor...');
  
  // Ömer kullanıcısını bul
  const omer = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { contains: 'omer', mode: 'insensitive' } },
        { email: 'omer@tipbox.co' },
        { profile: { displayName: { contains: 'omer', mode: 'insensitive' } } },
        { profile: { userName: { contains: 'omer', mode: 'insensitive' } } },
      ],
    },
    include: {
      profile: {
        select: {
          displayName: true,
          userName: true,
        },
      },
      avatars: {
        where: { isActive: true },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!omer) {
    throw new Error('Omer kullanıcısı bulunamadı!');
  }

  console.log(`✅ Omer bulundu:`);
  console.log(`   ID: ${omer.id}`);
  console.log(`   Email: ${omer.email}`);
  console.log(`   Display Name: ${omer.profile?.displayName || 'N/A'}`);
  console.log(`   Username: ${omer.profile?.userName || 'N/A'}`);
  console.log(`   Avatar: ${omer.avatars[0]?.imageUrl || 'Yok'}\n`);

  return omer;
}

async function findOtherUser(omerId: string) {
  console.log('👤 Diğer kullanıcı aranıyor...');
  
  // Omer dışında başka bir kullanıcı bul
  const otherUser = await prisma.user.findFirst({
    where: {
      id: { not: omerId },
      email: { not: null },
    },
    include: {
      profile: {
        select: {
          displayName: true,
          userName: true,
        },
      },
      avatars: {
        where: { isActive: true },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otherUser) {
    throw new Error('Diğer kullanıcı bulunamadı!');
  }

  console.log(`✅ Diğer kullanıcı bulundu:`);
  console.log(`   ID: ${otherUser.id}`);
  console.log(`   Email: ${otherUser.email}`);
  console.log(`   Display Name: ${otherUser.profile?.displayName || 'N/A'}`);
  console.log(`   Username: ${otherUser.profile?.userName || 'N/A'}\n`);

  return otherUser;
}

async function getOmerPosts(omerId: string) {
  console.log('📝 Omer\'in postları aranıyor...');
  
  const posts = await prisma.contentPost.findMany({
    where: {
      userId: omerId,
    },
    include: {
      media: {
        take: 1,
        orderBy: { orderIndex: 'asc' },
      },
      likes: {
        take: 5,
        include: {
          user: {
            include: {
              profile: {
                select: {
                  displayName: true,
                  userName: true,
                },
              },
            },
          },
        },
      },
      comments: {
        take: 5,
        include: {
          user: {
            include: {
              profile: {
                select: {
                  displayName: true,
                  userName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: {
          likes: true,
          comments: true,
          favorites: true,
          shares: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10, // En son 10 post
  });

  if (posts.length === 0) {
    throw new Error('Omer\'in hiç postu bulunamadı!');
  }

  console.log(`✅ ${posts.length} adet post bulundu:\n`);
  
  posts.forEach((post, index) => {
    console.log(`   ${index + 1}. Post ID: ${post.id}`);
    console.log(`      Type: ${post.type}`);
    console.log(`      Title: ${post.title.substring(0, 50)}${post.title.length > 50 ? '...' : ''}`);
    console.log(`      Body: ${post.body.substring(0, 50)}${post.body.length > 50 ? '...' : ''}`);
    console.log(`      Likes: ${post._count.likes}, Comments: ${post._count.comments}, Favorites: ${post._count.favorites}, Shares: ${post._count.shares}`);
    console.log(`      Created: ${post.createdAt.toLocaleString('tr-TR')}\n`);
  });

  return posts;
}

async function sendPostNotification(
  type: NotificationType,
  omerId: string,
  otherUserId: string,
  postId: string,
  commentId?: string
) {
  try {
    console.log(`\n📨 ${type} bildirimi gönderiliyor...`);
    console.log(`   Post ID: ${postId}`);

    switch (type) {
      case NotificationType.POST_LIKED: {
        // Önce beğeniyi kaldır (varsa)
        const existingLike = await prisma.contentLike.findFirst({
          where: { userId: otherUserId, postId },
        });
        if (existingLike) {
          await interactionService.unlikePost(otherUserId, postId);
          console.log(`   ⚠️  Mevcut beğeni kaldırıldı`);
        }
        
        // Gerçek beğeni oluştur
        await interactionService.likePost(otherUserId, postId);
        console.log(`   ✅ Post beğenildi (gerçek etkileşim)`);
        break;
      }

      case NotificationType.POST_COMMENTED: {
        const commentText = COMMENT_TEXTS[Math.floor(Math.random() * COMMENT_TEXTS.length)];
        const newCommentId = `01${Date.now().toString(36).toUpperCase().padStart(24, '0')}`;
        
        await prisma.contentComment.create({
          data: {
            id: newCommentId,
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
        console.log(`   Comment ID: ${newCommentId}`);
        break;
      }

      case NotificationType.POST_SHARED: {
        // Önce paylaşımı kaldır (varsa)
        const existingShare = await prisma.contentShare.findFirst({
          where: { userId: otherUserId, postId },
        });
        if (existingShare) {
          // Share silme işlemi için interaction service kullanılabilir
          await prisma.contentShare.delete({
            where: { id: existingShare.id },
          });
          await prisma.contentPost.update({
            where: { id: postId },
            data: { sharesCount: { decrement: 1 } },
          });
          console.log(`   ⚠️  Mevcut paylaşım kaldırıldı`);
        }
        
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
          console.log(`   ⚠️  Mevcut favori kaldırıldı`);
        }
        
        // Gerçek favori oluştur
        await interactionService.favoritePost(otherUserId, postId);
        console.log(`   ✅ Post favorilere eklendi (gerçek etkileşim)`);
        break;
      }

      case NotificationType.COMMENT_LIKED: {
        if (!commentId) {
          // Post'un bir yorumunu bul veya oluştur
          const postComment = await prisma.contentComment.findFirst({
            where: { postId },
            orderBy: { createdAt: 'desc' },
          });
          
          if (!postComment) {
            // Yorum yoksa önce bir yorum oluştur
            const newCommentId = `01${Date.now().toString(36).toUpperCase().padStart(24, '0')}`;
            await prisma.contentComment.create({
              data: {
                id: newCommentId,
                postId,
                userId: otherUserId,
                comment: 'Test yorumu',
                isAnswer: false,
                likesCount: 0,
              },
            });
            commentId = newCommentId;
            console.log(`   ⚠️  Yorum bulunamadı, yeni yorum oluşturuldu: ${commentId}`);
          } else {
            commentId = postComment.id;
          }
        }

        // Yorum beğenisi oluştur
        const existingCommentLike = await prisma.contentLike.findFirst({
          where: { userId: otherUserId, commentId },
        });
        if (existingCommentLike) {
          await prisma.contentLike.delete({
            where: { id: existingCommentLike.id },
          });
          await prisma.contentComment.update({
            where: { id: commentId },
            data: { likesCount: { decrement: 1 } },
          });
          console.log(`   ⚠️  Mevcut yorum beğenisi kaldırıldı`);
        }

        await prisma.contentLike.create({
          data: {
            userId: otherUserId,
            commentId,
            postId: null,
          },
        });

        await prisma.contentComment.update({
          where: { id: commentId },
          data: { likesCount: { increment: 1 } },
        });

        console.log(`   ✅ Yorum beğenildi (Comment ID: ${commentId})`);
        break;
      }

      case NotificationType.COMMENT_REPLIED: {
        // Post'un bir yorumunu bul
        const parentComment = await prisma.contentComment.findFirst({
          where: { postId, parentId: null },
          orderBy: { createdAt: 'desc' },
        });
        
        if (!parentComment) {
          // Parent yorum yoksa önce bir yorum oluştur
          const parentCommentId = `01${Date.now().toString(36).toUpperCase().padStart(24, '0')}`;
          await prisma.contentComment.create({
            data: {
              id: parentCommentId,
              postId,
              userId: omerId, // Omer'in kendi yorumu
              comment: 'Ana yorum',
              isAnswer: false,
              likesCount: 0,
            },
          });
          
          // Reply oluştur
          const replyId = `01${(Date.now() + 1).toString(36).toUpperCase().padStart(24, '0')}`;
          await prisma.contentComment.create({
            data: {
              id: replyId,
              postId,
              userId: otherUserId,
              parentId: parentCommentId,
              comment: COMMENT_TEXTS[Math.floor(Math.random() * COMMENT_TEXTS.length)],
              isAnswer: false,
              likesCount: 0,
            },
          });
          
          await prisma.contentPost.update({
            where: { id: postId },
            data: { commentsCount: { increment: 2 } },
          });
          
          console.log(`   ✅ Reply eklendi (Parent: ${parentCommentId}, Reply: ${replyId})`);
        } else {
          // Reply oluştur
          const replyId = `01${Date.now().toString(36).toUpperCase().padStart(24, '0')}`;
          await prisma.contentComment.create({
            data: {
              id: replyId,
              postId,
              userId: otherUserId,
              parentId: parentComment.id,
              comment: COMMENT_TEXTS[Math.floor(Math.random() * COMMENT_TEXTS.length)],
              isAnswer: false,
              likesCount: 0,
            },
          });
          
          await prisma.contentPost.update({
            where: { id: postId },
            data: { commentsCount: { increment: 1 } },
          });
          
          console.log(`   ✅ Reply eklendi (Parent: ${parentComment.id}, Reply: ${replyId})`);
        }
        break;
      }
    }

    console.log(`   ✅ ${type} bildirimi gönderildi!`);
    
  } catch (error: any) {
    console.error(`   ❌ ${type} bildirimi gönderilirken hata:`, error.message);
    logger.error(`Error sending ${type} notification:`, error);
  }
}

async function startOmerPostNotifications() {
  try {
    await initializeServices();
    
    const omer = await findOmerUser();
    const otherUser = await findOtherUser(omer.id);
    const posts = await getOmerPosts(omer.id);

    console.log('🚀 Omer\'in post bildirim testi başlatılıyor...');
    console.log(`📊 Toplam ${POST_NOTIFICATION_TYPES.length} farklı tip bildirim gönderilecek\n`);
    console.log('⏰ Her 3 saniyede bir bildirim gönderilecek\n');

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Her post tipi için bir bildirim gönder
    let postIndex = 0;
    for (let i = 0; i < POST_NOTIFICATION_TYPES.length; i++) {
      const type = POST_NOTIFICATION_TYPES[i];
      const post = posts[postIndex % posts.length];
      postIndex++;

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📌 Bildirim ${i + 1}/${POST_NOTIFICATION_TYPES.length}: ${type}`);
      console.log(`${'='.repeat(60)}`);

      // Comment işlemleri için commentId gerekebilir
      let commentId: string | undefined;
      if (type === NotificationType.COMMENT_LIKED || type === NotificationType.COMMENT_REPLIED) {
        const existingComment = await prisma.contentComment.findFirst({
          where: { postId: post.id },
          orderBy: { createdAt: 'desc' },
        });
        commentId = existingComment?.id;
      }

      await sendPostNotification(type, omer.id, otherUser.id, post.id, commentId);
      
      if (i < POST_NOTIFICATION_TYPES.length - 1) {
        console.log(`\n⏳ 3 saniye bekleniyor...\n`);
        await delay(3000);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Tüm post bildirimleri gönderildi!');
    console.log('='.repeat(60));
    console.log(`📊 Özet:`);
    console.log(`   - Toplam bildirim: ${POST_NOTIFICATION_TYPES.length}`);
    console.log(`   - Kullanılan post sayısı: ${Math.min(posts.length, POST_NOTIFICATION_TYPES.length)}`);
    console.log(`   - Bildirim tipleri:`);
    POST_NOTIFICATION_TYPES.forEach((type, index) => {
      console.log(`     ${index + 1}. ${type}`);
    });
    console.log('');

    // Bildirimleri kontrol et
    console.log('🔍 Gönderilen bildirimler kontrol ediliyor...\n');
    const notifications = await prisma.notification.findMany({
      where: {
        userId: omer.id,
        type: { in: POST_NOTIFICATION_TYPES as any },
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // Son 5 dakika
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    console.log(`✅ ${notifications.length} adet bildirim bulundu:\n`);
    notifications.forEach((notif, index) => {
      console.log(`   ${index + 1}. ${notif.type}`);
      console.log(`      ID: ${notif.id}`);
      console.log(`      Created: ${notif.createdAt.toLocaleString('tr-TR')}`);
      console.log(`      Read: ${notif.read}`);
      if (notif.data) {
        const data = notif.data as any;
        if (data.postId) console.log(`      Post ID: ${data.postId}`);
        if (data.commentId) console.log(`      Comment ID: ${data.commentId}`);
      }
      console.log('');
    });

    await prisma.$disconnect();
    process.exit(0);

  } catch (error: any) {
    console.error('❌ Hata:', error);
    logger.error('Omer post notification test error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Script'i çalıştır
startOmerPostNotifications().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
