import { Queue, QueueOptions } from 'bullmq';
import RedisConfigManager from '../config/redis.config';
import logger from '../logger/logger';

export interface JobData {
  [key: string]: any;
}

export interface NotificationJobData extends JobData {
  type: string;
  userId: number;
  [key: string]: any;
}

export interface AnalyticsJobData extends JobData {
  event: string;
  userId?: number;
  data: any;
}

class QueueProvider {
  private static instance: QueueProvider;
  private queues: Map<string, Queue> = new Map();
  private redisConfig: RedisConfigManager;

  private constructor() {
    this.redisConfig = RedisConfigManager.getInstance();
  }

  public static getInstance(): QueueProvider {
    if (!QueueProvider.instance) {
      QueueProvider.instance = new QueueProvider();
    }
    return QueueProvider.instance;
  }

  /**
   * Queue provider'ı başlatır
   */
  public async initialize(): Promise<void> {
    try {
      await this.redisConfig.initialize();
      logger.info('Queue provider initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize queue provider:', error);
      throw error;
    }
  }

  /**
   * Belirtilen isimde bir kuyruk oluşturur veya mevcut olanı döndürür
   * @param queueName - Kuyruk adı
   * @returns Queue instance
   */
  private getQueue(queueName: string): Queue {
    if (this.queues.has(queueName)) {
      return this.queues.get(queueName)!;
    }

    const redisConfig = this.redisConfig.getConfig();
    const queueOptions: QueueOptions = {
      connection: {
        host: redisConfig.url.includes('://') 
          ? redisConfig.url.split('://')[1].split(':')[0]
          : 'localhost',
        port: redisConfig.url.includes(':') 
          ? parseInt(redisConfig.url.split(':').pop() || '6379')
          : 6379,
      },
      defaultJobOptions: {
        removeOnComplete: 100, // Tamamlanan işleri 100 adet tut
        removeOnFail: 50, // Başarısız işleri 50 adet tut
        attempts: 3, // 3 kez dene
        backoff: {
          type: 'exponential',
          delay: 2000, // 2 saniye ile başla
        },
      },
    };

    const queue = new Queue(queueName, queueOptions);
    this.queues.set(queueName, queue);

    // Queue event listeners
    queue.on('error', (error) => {
      logger.error(`Queue ${queueName} error:`, error);
    });

    // Event listeners removed for BullMQ compatibility

    logger.info(`Queue ${queueName} created successfully`);
    return queue;
  }

  /**
   * Kuyruğa yeni bir iş ekler
   * @param queueName - Kuyruk adı
   * @param jobData - İş verisi
   * @param options - İş seçenekleri
   * @returns Eklenen iş
   */
  public async addJob(
    queueName: string, 
    jobData: JobData, 
    options?: {
      delay?: number;
      priority?: number;
      attempts?: number;
    }
  ) {
    try {
      const queue = this.getQueue(queueName);
      const job = await queue.add(queueName, jobData, options);
      
      logger.debug(`Job ${job.id} added to queue ${queueName}`, { jobData });
      return job;
    } catch (error) {
      logger.error(`Failed to add job to queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Bildirim kuyruğuna iş ekler
   * @param jobData - Bildirim iş verisi
   * @param options - İş seçenekleri
   */
  public async addNotificationJob(
    jobData: NotificationJobData, 
    options?: { delay?: number; priority?: number }
  ) {
    return this.addJob('notifications', jobData, options);
  }

  /**
   * Analitik kuyruğuna iş ekler
   * @param jobData - Analitik iş verisi
   * @param options - İş seçenekleri
   */
  public async addAnalyticsJob(
    jobData: AnalyticsJobData, 
    options?: { delay?: number; priority?: number }
  ) {
    return this.addJob('analytics', jobData, options);
  }

  /**
   * Belirtilen kuyruğun durumunu getirir
   * @param queueName - Kuyruk adı
   * @returns Kuyruk durumu
   */
  public async getQueueStatus(queueName: string) {
    try {
      const queue = this.getQueue(queueName);
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      };
    } catch (error) {
      logger.error(`Failed to get queue status for ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Tüm kuyrukları temizler
   */
  public async clearAllQueues(): Promise<void> {
    try {
      for (const [queueName, queue] of this.queues) {
        await queue.obliterate({ force: true });
        logger.info(`Queue ${queueName} cleared`);
      }
    } catch (error) {
      logger.error('Failed to clear queues:', error);
      throw error;
    }
  }

  /**
   * Tüm kuyrukları kapatır
   */
  public async closeAllQueues(): Promise<void> {
    try {
      for (const [queueName, queue] of this.queues) {
        await queue.close();
        logger.info(`Queue ${queueName} closed`);
      }
      this.queues.clear();
    } catch (error) {
      logger.error('Failed to close queues:', error);
      throw error;
    }
  }
}

export default QueueProvider;

