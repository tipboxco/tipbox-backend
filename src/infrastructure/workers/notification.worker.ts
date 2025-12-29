import { Worker, Job } from 'bullmq';
import RedisConfigManager from '../config/redis.config';
import { NotificationJobData } from '../queue/queue.provider';
import logger from '../logger/logger';

export class NotificationWorker {
  private worker!: Worker;
  private redisConfig: RedisConfigManager;

  constructor() {
    this.redisConfig = RedisConfigManager.getInstance();
  }

  /**
   * Notification worker'ı başlatır
   */
  public async start(): Promise<void> {
    try {
      await this.redisConfig.initialize();
      const redisConfig = this.redisConfig.getConfig();

      this.worker = new Worker(
        'notifications',
        this.processNotificationJob.bind(this),
        {
          connection: {
            host: redisConfig.url.includes('://') 
              ? redisConfig.url.split('://')[1].split(':')[0]
              : 'localhost',
            port: redisConfig.url.includes(':') 
              ? parseInt(redisConfig.url.split(':').pop() || '6379')
              : 6379,
          },
          concurrency: 5, // Aynı anda 5 iş işle
        }
      );

      // Worker event listeners
      this.worker.on('ready', () => {
        logger.info('Notification worker is ready');
      });

      this.worker.on('active', (job) => {
        logger.debug(`Processing notification job ${job.id}`, { jobData: job.data });
      });

      this.worker.on('completed', (job) => {
        logger.debug(`Notification job ${job.id} completed successfully`);
      });

      this.worker.on('failed', (job, err) => {
        logger.error(`Notification job ${job?.id} failed:`, err);
      });

      this.worker.on('error', (err) => {
        logger.error('Notification worker error:', err);
      });

      logger.info('Notification worker started successfully');
    } catch (error) {
      logger.error('Failed to start notification worker:', error);
      throw error;
    }
  }

  /**
   * Bildirim işini işler
   * @param job - İş nesnesi
   */
  private async processNotificationJob(job: Job<NotificationJobData>): Promise<void> {
    const { type, userId, ...data } = job.data;

    try {
      logger.info(`Processing notification: ${type} for user ${userId}`, { jobData: job.data });

      switch (type) {
        case 'NEW_BADGE':
          await this.handleNewBadgeNotification(userId, data);
          break;
        case 'ACHIEVEMENT_UNLOCKED':
          await this.handleAchievementNotification(userId, data);
          break;
        case 'NEW_FOLLOWER':
          await this.handleNewFollowerNotification(userId, data);
          break;
        case 'POST_LIKED':
          await this.handlePostLikedNotification(userId, data);
          break;
        case 'COMMENT_ADDED':
          await this.handleCommentNotification(userId, data);
          break;
        case 'POST_SHARED':
          await this.handlePostSharedNotification(userId, data);
          break;
        case 'COMMENT_LIKED':
          await this.handleCommentLikedNotification(userId, data);
          break;
        case 'COMMENT_REPLIED':
          await this.handleCommentRepliedNotification(userId, data);
          break;
        case 'SYSTEM_ANNOUNCEMENT':
          await this.handleSystemAnnouncement(userId, data);
          break;
        default:
          logger.warn(`Unknown notification type: ${type}`);
      }

      logger.info(`Notification ${type} processed successfully for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to process notification ${type} for user ${userId}:`, error);
      throw error; // Job'u retry için fail et
    }
  }

  /**
   * Yeni rozet bildirimi işler
   */
  private async handleNewBadgeNotification(userId: string, data: any): Promise<void> {
    // Socket.IO ile gerçek zamanlı bildirim gönder
    await this.sendSocketNotification(userId, {
      type: 'NEW_BADGE',
      title: 'Yeni Rozet Kazandınız! 🏆',
      message: `${data.badgeName} rozetini kazandınız!`,
      badgeName: data.badgeName,
      badgeIcon: data.badgeIcon,
      timestamp: new Date().toISOString(),
    });

    // Gelecekte push notification, email vb. eklenebilir
    logger.info(`New badge notification sent to user ${userId}: ${data.badgeName}`);
  }

  /**
   * Başarı bildirimi işler
   */
  private async handleAchievementNotification(userId: string, data: any): Promise<void> {
    await this.sendSocketNotification(userId, {
      type: 'ACHIEVEMENT_UNLOCKED',
      title: 'Başarı Açıldı! 🎯',
      message: `${data.achievementName} başarısını tamamladınız!`,
      achievementName: data.achievementName,
      achievementIcon: data.achievementIcon,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Achievement notification sent to user ${userId}: ${data.achievementName}`);
  }

  /**
   * Yeni takipçi bildirimi işler
   */
  private async handleNewFollowerNotification(userId: string, data: any): Promise<void> {
    await this.sendSocketNotification(userId, {
      type: 'NEW_FOLLOWER',
      title: 'Yeni Takipçi! 👥',
      message: `${data.followerName} sizi takip etmeye başladı`,
      followerName: data.followerName,
      followerId: data.followerId,
      timestamp: new Date().toISOString(),
    });

    logger.info(`New follower notification sent to user ${userId}: ${data.followerName}`);
  }

  /**
   * Post beğeni bildirimi işler
   */
  private async handlePostLikedNotification(userId: string, data: any): Promise<void> {
    await this.sendSocketNotification(userId, {
      type: 'POST_LIKED',
      title: 'Postunuz Beğenildi! ❤️',
      message: `${data.likerName} postunuzu beğendi`,
      likerName: data.likerName,
      likerId: data.likerId,
      postId: data.postId,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Post liked notification sent to user ${userId}: ${data.likerName}`);
  }

  /**
   * Yorum bildirimi işler
   */
  private async handleCommentNotification(userId: string, data: any): Promise<void> {
    await this.sendSocketNotification(userId, {
      type: 'COMMENT_ADDED',
      title: 'Yeni Yorum! 💬',
      message: `${data.commenterName} postunuza yorum yaptı`,
      commenterName: data.commenterName,
      commenterId: data.commenterId,
      postId: data.postId,
      commentId: data.commentId,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Comment notification sent to user ${userId}: ${data.commenterName}`);
  }

  /**
   * Post paylaşım bildirimi işler
   */
  private async handlePostSharedNotification(userId: string, data: any): Promise<void> {
    await this.sendSocketNotification(userId, {
      type: 'POST_SHARED',
      title: 'Postunuz Paylaşıldı! 🔄',
      message: `${data.sharerName} postunuzu paylaştı`,
      sharerName: data.sharerName,
      sharerId: data.sharerId,
      postId: data.postId,
      shareType: data.shareType,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Post shared notification sent to user ${userId}: ${data.sharerName}`);
  }

  /**
   * Yorum beğeni bildirimi işler
   */
  private async handleCommentLikedNotification(userId: string, data: any): Promise<void> {
    await this.sendSocketNotification(userId, {
      type: 'COMMENT_LIKED',
      title: 'Yorumunuz Beğenildi! 💙',
      message: `${data.likerName} yorumunuzu beğendi`,
      likerName: data.likerName,
      likerId: data.likerId,
      commentId: data.commentId,
      postId: data.postId,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Comment liked notification sent to user ${userId}: ${data.likerName}`);
  }

  /**
   * Yorum yanıt bildirimi işler
   */
  private async handleCommentRepliedNotification(userId: string, data: any): Promise<void> {
    await this.sendSocketNotification(userId, {
      type: 'COMMENT_REPLIED',
      title: 'Yorumunuza Yanıt Verildi! 💬',
      message: `${data.replierName} yorumunuza yanıt verdi`,
      replierName: data.replierName,
      replierId: data.replierId,
      commentId: data.commentId,
      parentCommentId: data.parentCommentId,
      postId: data.postId,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Comment reply notification sent to user ${userId}: ${data.replierName}`);
  }

  /**
   * Sistem duyurusu işler
   */
  private async handleSystemAnnouncement(userId: string, data: any): Promise<void> {
    await this.sendSocketNotification(userId, {
      type: 'SYSTEM_ANNOUNCEMENT',
      title: data.title || 'Sistem Duyurusu',
      message: data.message,
      priority: data.priority || 'normal',
      timestamp: new Date().toISOString(),
    });

    logger.info(`System announcement sent to user ${userId}`);
  }

  /**
   * Socket.IO ile bildirim gönderir
   * @param userId - Hedef kullanıcı ID'si
   * @param notification - Bildirim verisi
   */
  private async sendSocketNotification(userId: string, notification: any): Promise<void> {
    try {
      // SocketManager üzerinden SocketHandler'a eriş
      const { default: SocketManager } = await import('../realtime/socket-manager');
      const socketManager = SocketManager.getInstance();
      const socketHandler = socketManager.getSocketHandler();
      
      socketHandler.sendMessageToUser(userId, 'notification', notification);
    } catch (error) {
      logger.error(`Failed to send socket notification to user ${userId}:`, error);
      // Socket hatası durumunda job'u fail etme, sadece log'la
      // Çünkü bu geçici bir ağ sorunu olabilir
    }
  }

  /**
   * Worker'ı durdurur
   */
  public async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      logger.info('Notification worker stopped');
    }
  }
}

export default NotificationWorker;
