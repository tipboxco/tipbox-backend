import { Worker, Job } from 'bullmq';
import RedisConfigManager from '../config/redis.config';
import QueueProvider, { NotificationJobData } from '../queue/queue.provider';
import { NotificationPrismaRepository } from '../repositories/notification-prisma.repository';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import logger from '../logger/logger';

export class NotificationWorker {
  private worker!: Worker;
  private redisConfig: RedisConfigManager;
  private notificationRepo: NotificationPrismaRepository;

  constructor() {
    this.redisConfig = RedisConfigManager.getInstance();
    this.notificationRepo = new NotificationPrismaRepository();
  }

  /**
   * Notification worker'ı başlatır
   */
  public async start(): Promise<void> {
    try {
      await this.redisConfig.initialize();
      const redisConfig = this.redisConfig.getConfig();

      const redisHost = RedisConfigManager.parseRedisHost(redisConfig.url);
      const redisPort = RedisConfigManager.parseRedisPort(redisConfig.url);

      this.worker = new Worker(
        'notifications',
        this.processNotificationJob.bind(this),
        {
          connection: {
            host: redisHost,
            port: redisPort,
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
        if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
          QueueProvider.getInstance()
            .addToDLQ('notifications', job.data, err.message, job.id)
            .catch(() => {});
        }
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
   */
  private async processNotificationJob(job: Job<NotificationJobData>): Promise<void> {
    const { type, userId, title, message, data, sendEmail, sendPush, sendInApp } = job.data;

    try {
      logger.info(`Processing notification: ${type} for user ${userId}`);

      // 1. Save to database
      await this.notificationRepo.create({
        userId,
        type: type as NotificationType,
        title,
        message,
        data,
      });

      // 2. Send realtime notification via Socket.IO (if enabled)
      if (sendInApp !== false) {
        // Get current unread count for the user
        const unreadCount = await this.notificationRepo.getUnreadCount(userId);
        
        // Extract avatar and imageUrl from data for socket notification
        const socketNotification = {
          type,
          title,
          message,
          data,
          avatar: data.avatar || null,
          imageUrl: data.imageUrl || null,
          unreadCount: unreadCount, // ✅ Mobil için: Unread count ekle
          timestamp: new Date().toISOString(),
        };
        await this.sendSocketNotification(userId, socketNotification);
      }

      // 3. Send push notification (if enabled)
      // Note: Push notification service removed (Expo not used)
      if (sendPush !== false) {
        logger.debug(`Push notification for ${type} to user ${userId} (push service not implemented)`);
      }

      // 4. Send email (if enabled and implemented)
      if (sendEmail === true) {
        // TODO: Implement email service integration
        logger.debug(`Email notification for ${type} to user ${userId} (not implemented)`);
      }

      logger.info(`Notification ${type} processed successfully for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to process notification ${type} for user ${userId}:`, error);
      throw error; // Job'u retry için fail et
    }
  }

  /**
   * Socket.IO ile bildirim gönderir
   */
  private async sendSocketNotification(userId: string, notification: Record<string, unknown>): Promise<void> {
    try {
      const { default: SocketManager } = await import('../realtime/socket-manager');
      const socketManager = SocketManager.getInstance();
      const socketHandler = socketManager.getSocketHandler();
      
      socketHandler.sendMessageToUser(userId, 'notification', notification);
    } catch (error) {
      logger.error(`Failed to send socket notification to user ${userId}:`, error);
      // Socket hatası durumunda job'u fail etme, sadece log'la
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
