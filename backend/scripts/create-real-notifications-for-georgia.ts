import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import logger from '../src/infrastructure/logger/logger';
import { TransactionService } from '../src/application/transaction/transaction.service';
import { SupportRequestService } from '../src/application/messaging/support-request.service';
import { PostService } from '../src/application/post/post.service';
import { InteractionService } from '../src/application/interaction/interaction.service';
import { GamificationService } from '../src/application/gamification/gamification.service';
import { NotificationService } from '../src/application/notification/notification.service';
import { NotificationType } from '../src/domain/notification/notification-type.enum';
import { NotificationPrismaRepository } from '../src/infrastructure/repositories/notification-prisma.repository';
import { NotificationFactory } from '../src/application/notification/notification-factory';
import { enrichNotificationData } from '../src/application/notification/notification-enricher';
import { S3Service } from '../src/infrastructure/s3/s3.service';
import { resolveMediaUrl } from '../src/infrastructure/config/media.config';
import { generateUlid } from '../src/infrastructure/ids/id.strategy';
import { ContextType } from '../src/domain/content/context-type.enum';
import * as fs from 'fs';
import * as path from 'path';

const GEORGIA_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';
const TUNA_ID = '7413549b-126e-4b41-a06b-c22600a85f67';

async function createRealNotificationsForGeorgia() {
  const prisma = getPrisma();
  const s3Service = new S3Service();
  const transactionService = new TransactionService();
  const supportRequestService = new SupportRequestService();
  const postService = new PostService();
  const interactionService = new InteractionService();
  const gamificationService = new GamificationService();
  const notificationService = new NotificationService();
  const notificationRepo = new NotificationPrismaRepository();
  const notificationFactory = new NotificationFactory();

  try {
    logger.info('🎯 Georgia için gerçek verilerle bildirimler oluşturuluyor...');

    // 1. TIPS_RECEIVED - Gerçek tips gönder veya direkt bildirim oluştur
    logger.info('💰 1. ADIM: TIPS_RECEIVED bildirimi oluşturuluyor...');
    try {
      // Önce Tuna'ya bakiye ekle
      const tunaWallet = await prisma.wallet.findFirst({
        where: { userId: TUNA_ID, isActive: true },
      });

      if (tunaWallet) {
        await prisma.wallet.update({
          where: { id: tunaWallet.id },
          data: {
            balance: { increment: 100 }, // 100 TIPS ekle
          },
        });
        logger.info('✅ Tuna\'ya bakiye eklendi');
      }

      // Tips gönder
      await transactionService.sendTip({
        fromUserId: TUNA_ID,
        toUserId: GEORGIA_ID,
        amount: 50,
        reason: 'Harika bir öneri için teşekkürler!',
      });
      logger.info('✅ TIPS_RECEIVED bildirimi oluşturuldu');
    } catch (error) {
      logger.error('❌ TIPS_RECEIVED bildirimi oluşturulamadı:', error);
      // Hata durumunda direkt bildirim oluştur
      try {
        const sender = await prisma.user.findUnique({
          where: { id: TUNA_ID },
          include: {
            profile: true,
            avatars: { take: 1, orderBy: { createdAt: 'desc' } },
          },
        });

        const notification = notificationFactory.createNotification(NotificationType.TIPS_RECEIVED, {
          amount: 50,
          senderName: sender?.profile?.displayName || sender?.profile?.userName || sender?.email || 'Kullanıcı',
          senderUserId: TUNA_ID,
          transactionId: generateUlid(),
          reason: 'Harika bir öneri için teşekkürler!',
        });

        const enrichedData = await enrichNotificationData(NotificationType.TIPS_RECEIVED, notification.data);
        const finalData = {
          ...notification.data,
          ...enrichedData,
        };

        await notificationRepo.create({
          userId: GEORGIA_ID,
          type: NotificationType.TIPS_RECEIVED,
          title: notification.title,
          message: notification.message,
          data: finalData,
        });
        logger.info('✅ TIPS_RECEIVED bildirimi direkt database\'e kaydedildi');
      } catch (fallbackError) {
        logger.error('❌ TIPS_RECEIVED fallback bildirimi oluşturulamadı:', fallbackError);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. DM_REQUEST_ACCEPTED - Gerçek support request oluştur ve accept et
    logger.info('💬 2. ADIM: DM_REQUEST_ACCEPTED bildirimi oluşturuluyor...');
    try {
      // Önce support request oluştur
      const request = await prisma.dMRequest.create({
        data: {
          fromUserId: GEORGIA_ID,
          toUserId: TUNA_ID,
          description: 'Merhaba Tuna, teknik bir konuda yardıma ihtiyacım var. API entegrasyonu hakkında danışmak istiyorum.',
          type: 'TECHNICAL',
          amount: 250,
          status: 'PENDING',
          sentAt: new Date(),
        },
      });

      // Request'i accept et - SocketHandler initialize olmadığı için direkt notification gönder
      const thread = await prisma.dMThread.create({
        data: {
          userOneId: GEORGIA_ID,
          userTwoId: TUNA_ID,
          isActive: true,
          isSupportThread: true,
          startedAt: new Date(),
        },
      });

      await prisma.dMRequest.update({
        where: { id: request.id },
        data: {
          status: 'ACCEPTED',
          threadId: thread.id,
          respondedAt: new Date(),
        },
      });

      // Participants bilgilerini al
      const [fromUser, toUser] = await Promise.all([
        prisma.user.findUnique({
          where: { id: GEORGIA_ID },
          include: {
            profile: true,
            titles: { take: 1, orderBy: { createdAt: 'desc' } },
            avatars: { take: 1, orderBy: { createdAt: 'desc' } },
          },
        }),
        prisma.user.findUnique({
          where: { id: TUNA_ID },
          include: {
            profile: true,
            titles: { take: 1, orderBy: { createdAt: 'desc' } },
            avatars: { take: 1, orderBy: { createdAt: 'desc' } },
          },
        }),
      ]);

      const fromUserName = fromUser?.profile?.displayName || fromUser?.profile?.userName || fromUser?.email || 'Unknown';
      const toUserName = toUser?.profile?.displayName || toUser?.profile?.userName || toUser?.email || 'Unknown';

      const participants = {
        userOne: {
          id: thread.userOneId,
          name: thread.userOneId === GEORGIA_ID ? fromUserName : toUserName,
          title: (thread.userOneId === GEORGIA_ID ? fromUser?.titles?.[0]?.title : toUser?.titles?.[0]?.title) ?? '',
          avatar: resolveMediaUrl(
            (thread.userOneId === GEORGIA_ID ? fromUser?.avatars?.[0]?.imageUrl : toUser?.avatars?.[0]?.imageUrl),
            true
          ) || '',
        },
        userTwo: {
          id: thread.userTwoId,
          name: thread.userTwoId === GEORGIA_ID ? fromUserName : toUserName,
          title: (thread.userTwoId === GEORGIA_ID ? fromUser?.titles?.[0]?.title : toUser?.titles?.[0]?.title) ?? '',
          avatar: resolveMediaUrl(
            (thread.userTwoId === GEORGIA_ID ? fromUser?.avatars?.[0]?.imageUrl : toUser?.avatars?.[0]?.imageUrl),
            true
          ) || '',
        },
      };

      // Bildirim oluştur ve direkt database'e kaydet (Redis queue olmadan)
      const notification = notificationFactory.createNotification(NotificationType.DM_REQUEST_ACCEPTED, {
        userId: toUser?.id || TUNA_ID,
        userName: toUserName,
        threadId: thread.id,
        participants,
      });

      const enrichedData = await enrichNotificationData(NotificationType.DM_REQUEST_ACCEPTED, notification.data);
      const finalData = {
        ...notification.data,
        ...enrichedData,
      };

      await notificationRepo.create({
        userId: GEORGIA_ID,
        type: NotificationType.DM_REQUEST_ACCEPTED,
        title: notification.title,
        message: notification.message,
        data: finalData,
      });

      logger.info(`✅ DM_REQUEST_ACCEPTED bildirimi oluşturuldu (requestId: ${request.id}, threadId: ${thread.id})`);
    } catch (error) {
      logger.error('❌ DM_REQUEST_ACCEPTED bildirimi oluşturulamadı:', error);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. EVENT_STARTED - Gerçek event oluştur ve bildirim gönder
    logger.info('🎉 3. ADIM: EVENT_STARTED bildirimi oluşturuluyor...');
    try {
      // Event görselini S3'e yükle
      const eventImagePath = path.join(__dirname, '../../tests/assets/events/event.png');
      let eventImageUrl: string | null = null;
      
      if (fs.existsSync(eventImagePath)) {
        const imageBuffer = fs.readFileSync(eventImagePath);
        eventImageUrl = await s3Service.uploadFile(
          `events/${generateUlid()}.png`,
          imageBuffer,
          'image/png'
        );
        logger.info(`✅ Event görseli yüklendi: ${eventImageUrl}`);
      }

      // Event oluştur
      const event = await prisma.event.create({
        data: {
          id: generateUlid(),
          title: 'Yeni Teknoloji Deneyimleri Paylaşım Etkinliği',
          description: 'En son teknoloji ürünleri hakkında deneyimlerinizi paylaşın ve ödüller kazanın!',
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 gün sonra
          status: 'PUBLISHED',
          imageUrl: eventImageUrl,
        } as any,
      });

      // Event bildirimi oluştur ve direkt database'e kaydet
      const notification = notificationFactory.createNotification(NotificationType.EVENT_STARTED, {
        eventId: event.id,
        eventName: event.title,
        imageUrl: eventImageUrl,
      });

      const enrichedData = await enrichNotificationData(NotificationType.EVENT_STARTED, notification.data);
      const finalData = {
        ...notification.data,
        ...enrichedData,
      };

      await notificationRepo.create({
        userId: GEORGIA_ID,
        type: NotificationType.EVENT_STARTED,
        title: notification.title,
        message: notification.message,
        data: finalData,
      });
      logger.info(`✅ EVENT_STARTED bildirimi oluşturuldu (eventId: ${event.id})`);
    } catch (error) {
      logger.error('❌ EVENT_STARTED bildirimi oluşturulamadı:', error);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. POST_LIKED - Gerçek post oluştur ve beğen
    logger.info('❤️ 4. ADIM: POST_LIKED bildirimi oluşturuluyor...');
    try {
      // Önce bir sub category bul
      const subCategory = await prisma.subCategory.findFirst({
        where: { name: { contains: 'Phone', mode: 'insensitive' } },
        include: { mainCategory: true },
      });

      if (!subCategory) {
        throw new Error('SubCategory not found');
      }

      // Post görselini S3'e yükle
      const postImagePath = path.join(__dirname, '../../tests/assets/post/post.jpg');
      let postImageUrl: string | null = null;
      
      if (fs.existsSync(postImagePath)) {
        const imageBuffer = fs.readFileSync(postImagePath);
        postImageUrl = await s3Service.uploadFile(
          `posts/${generateUlid()}.jpg`,
          imageBuffer,
          'image/jpeg'
        );
        logger.info(`✅ Post görseli yüklendi: ${postImageUrl}`);
      }

      // Post oluştur
      const post = await postService.createFreePost(GEORGIA_ID, {
        title: 'Yeni iPhone 17 Pro Deneyimim',
        body: 'iPhone 17 Pro\'yu bir haftadır kullanıyorum ve gerçekten harika bir deneyim. Kamera kalitesi mükemmel ve performans çok iyi.',
        contextType: ContextType.SUB_CATEGORY,
        contextId: subCategory.id,
        images: postImageUrl ? [postImageUrl] : [],
      });

      // Post'u beğen
      await interactionService.likePost(TUNA_ID, post.id);

      // Bildirim direkt database'e kaydet (Redis queue olmadan)
      try {
        const liker = await prisma.user.findUnique({
          where: { id: TUNA_ID },
          include: {
            profile: true,
            avatars: { take: 1, orderBy: { createdAt: 'desc' } },
          },
        });

        const postMedia = await prisma.postMedia.findFirst({
          where: { postId: post.id },
          orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
        });

        const notification = notificationFactory.createNotification(NotificationType.POST_LIKED, {
          likerName: liker?.profile?.displayName || liker?.profile?.userName || liker?.email || 'Kullanıcı',
          likerId: TUNA_ID,
          postId: post.id,
        });

        const enrichedData = await enrichNotificationData(NotificationType.POST_LIKED, {
          ...notification.data,
          imageUrl: postMedia?.mediaUrl ? resolveMediaUrl(postMedia.mediaUrl) : null,
        });
        const finalData = {
          ...notification.data,
          ...enrichedData,
        };

        await notificationRepo.create({
          userId: GEORGIA_ID,
          type: NotificationType.POST_LIKED,
          title: notification.title,
          message: notification.message,
          data: finalData,
        });
        logger.info(`✅ POST_LIKED bildirimi direkt database'e kaydedildi (postId: ${post.id})`);
      } catch (notifError) {
        logger.error('❌ POST_LIKED bildirimi direkt kaydedilemedi:', notifError);
      }
    } catch (error) {
      logger.error('❌ POST_LIKED bildirimi oluşturulamadı:', error);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 5. NEW_BADGE - Gerçek badge oluştur ve kullanıcıya ver
    logger.info('🏆 5. ADIM: NEW_BADGE bildirimi oluşturuluyor...');
    try {
      // Badge görselini S3'e yükle
      const badgeImagePath = path.join(__dirname, '../../tests/assets/badge/badge-1.png');
      let badgeImageUrl: string | null = null;
      
      if (fs.existsSync(badgeImagePath)) {
        const imageBuffer = fs.readFileSync(badgeImagePath);
        badgeImageUrl = await s3Service.uploadFile(
          `badges/${generateUlid()}.png`,
          imageBuffer,
          'image/png'
        );
        logger.info(`✅ Badge görseli yüklendi: ${badgeImageUrl}`);
      }

      // Badge kategorisi bul veya oluştur
      let badgeCategory = await prisma.badgeCategory.findFirst({
        where: { name: 'Achievement' },
      });

      if (!badgeCategory) {
        badgeCategory = await prisma.badgeCategory.create({
          data: {
            name: 'Achievement',
            description: 'Achievement badges',
            icon: '🏆',
          },
        });
      }

      // Badge oluştur
      const badge = await prisma.badge.create({
        data: {
          name: 'Early Tech Adopter',
          description: 'Yeni teknoloji ürünlerini ilk deneyenler için özel rozet',
          imageUrl: badgeImageUrl,
          categoryId: badgeCategory.id,
          type: 'ACHIEVEMENT',
          rarity: 'RARE',
        } as any,
      });

      // Badge'i kullanıcıya ver
      await prisma.userBadge.create({
        data: {
          userId: GEORGIA_ID,
          badgeId: badge.id,
          isVisible: true,
          displayOrder: null,
          visibility: 'PUBLIC',
          claimed: false,
          claimedAt: null,
        } as any,
      });

      // Badge bildirimi oluştur ve direkt database'e kaydet
      const notification = notificationFactory.createNotification(NotificationType.NEW_BADGE, {
        badgeName: badge.name,
        badgeIcon: badge.imageUrl || '🏆',
        badgeId: badge.id,
      });

      const enrichedData = await enrichNotificationData(NotificationType.NEW_BADGE, notification.data);
      const finalData = {
        ...notification.data,
        ...enrichedData,
      };

      await notificationRepo.create({
        userId: GEORGIA_ID,
        type: NotificationType.NEW_BADGE,
        title: notification.title,
        message: notification.message,
        data: finalData,
      });
      logger.info(`✅ NEW_BADGE bildirimi oluşturuldu (badgeId: ${badge.id})`);
    } catch (error) {
      logger.error('❌ NEW_BADGE bildirimi oluşturulamadı:', error);
    }

    logger.info('✅ Tüm bildirimler oluşturuldu!');
    console.log('\n✅ Tüm bildirimler oluşturuldu!');
    console.log('   - TIPS_RECEIVED');
    console.log('   - DM_REQUEST_ACCEPTED');
    console.log('   - EVENT_STARTED');
    console.log('   - POST_LIKED');
    console.log('   - NEW_BADGE');
  } catch (error) {
    logger.error('❌ Bildirimler oluşturulurken hata oluştu:', error);
    console.error('❌ Bildirimler oluşturulurken hata oluştu:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  createRealNotificationsForGeorgia()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { createRealNotificationsForGeorgia };
