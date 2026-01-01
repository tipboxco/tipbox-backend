import { Queue } from 'bullmq';
import logger from '../logger/logger';
import RedisConfigManager from '../config/redis.config';

export interface TrustBackfillJobData {
  trusterId: string;
  trustedUserId: string;
  timeWindowDays: number; // Kaç günlük geçmişe bakılacak
}

export class TrustBackfillScheduler {
  private queue: Queue<TrustBackfillJobData>;

  constructor() {
    const redisHost = RedisConfigManager.parseRedisHost();
    const redisPort = RedisConfigManager.parseRedisPort();

    this.queue = new Queue<TrustBackfillJobData>('trust-backfill', {
      connection: {
        host: redisHost,
        port: redisPort,
      },
      defaultJobOptions: {
        attempts: 3, // 3 deneme
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s, 10s, 20s
        },
        removeOnComplete: {
          age: 24 * 3600, // 24 saat sonra tamamlanan job'ları sil
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // 7 gün sonra başarısız job'ları sil
        },
      },
    });

    logger.info({ message: 'TrustBackfillScheduler initialized', redisHost, redisPort });
  }

  /**
   * Yeni bir trust relation oluşturulduğunda backfill job'ı kuyruğa ekler
   * @param trusterId - Trust eden kullanıcının ID'si
   * @param trustedUserId - Trust edilen kullanıcının ID'si
   * @param timeWindowDays - Kaç günlük geçmiş için backfill yapılacak (default: 14)
   * @returns Job ID
   */
  async queueTrustBackfill(
    trusterId: string,
    trustedUserId: string,
    timeWindowDays: number = 14
  ): Promise<string> {
    const jobName = `trust-backfill-${trusterId}-${trustedUserId}`;
    
    const job = await this.queue.add(
      jobName,
      { 
        trusterId, 
        trustedUserId, 
        timeWindowDays 
      },
      {
        jobId: jobName, // Aynı trust için birden fazla job olmaması için
        priority: 5, // Orta öncelik
      }
    );
    
    logger.info({ 
      message: 'Trust backfill job queued', 
      jobId: job.id, 
      trusterId, 
      trustedUserId,
      timeWindowDays 
    });
    
    return job.id!;
  }

  /**
   * Trust relation silindiğinde cleanup job'ı kuyruğa ekler
   * @param trusterId - Trust eden kullanıcının ID'si
   * @param trustedUserId - Trust edilen kullanıcının ID'si
   * @returns Job ID
   */
  async queueTrustCleanup(
    trusterId: string,
    trustedUserId: string
  ): Promise<string> {
    const jobName = `trust-cleanup-${trusterId}-${trustedUserId}`;
    
    const job = await this.queue.add(
      jobName,
      { 
        trusterId, 
        trustedUserId, 
        timeWindowDays: 0 // Cleanup için 0
      },
      {
        jobId: jobName,
        priority: 10, // Düşük öncelik
      }
    );
    
    logger.info({ 
      message: 'Trust cleanup job queued', 
      jobId: job.id, 
      trusterId, 
      trustedUserId 
    });
    
    return job.id!;
  }

  /**
   * Kuyruğu kapatır
   */
  async close(): Promise<void> {
    await this.queue.close();
    logger.info('TrustBackfillScheduler closed');
  }

  public getQueue(): Queue<TrustBackfillJobData> {
    return this.queue;
  }
}

