import { Queue } from 'bullmq';
import logger from '../logger/logger';
import RedisConfigManager from '../config/redis.config';

export interface SupportRequestAutoCompleteJobData {
  type: 'auto-complete-awaiting-requests';
}

export class SupportRequestAutoCompleteScheduler {
  private queue: Queue<SupportRequestAutoCompleteJobData>;

  constructor() {
    // Redis connection - REDIS_URL'den parse et
    const redisHost = RedisConfigManager.parseRedisHost();
    const redisPort = RedisConfigManager.parseRedisPort();
    
    this.queue = new Queue('support-request-auto-complete', {
      connection: {
        host: redisHost,
        port: redisPort,
      },
    });

    logger.info({ 
      message: 'SupportRequestAutoCompleteScheduler initialized',
      redisHost,
      redisPort 
    });
  }

  /**
   * Günlük auto-complete job'ını schedule eder (her saat başı çalışır)
   * AWAITING_COMPLETION durumundaki request'leri 24 saat sonra otomatik olarak COMPLETED yapar
   */
  async scheduleHourly(): Promise<void> {
    try {
      // Mevcut repeat job'ları temizle (duplicate önlemek için)
      const repeatableJobs = await this.queue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.name === 'hourly-auto-complete') {
          await this.queue.removeRepeatableByKey(job.key);
        }
      }

      // Yeni repeat job ekle - Her saat başı çalışır (0 * * * *)
      await this.queue.add(
        'hourly-auto-complete',
        {
          type: 'auto-complete-awaiting-requests',
        },
        {
          repeat: {
            pattern: '0 * * * *', // Her saat başı (0. dakikada)
          },
          jobId: 'hourly-auto-complete',
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      logger.info({
        message: 'Hourly support request auto-complete scheduled',
        pattern: '0 * * * *',
        description: 'Her saat başı AWAITING_COMPLETION durumundaki request\'leri kontrol eder ve 24 saat geçmiş olanları otomatik olarak COMPLETED yapar',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to schedule hourly auto-complete',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Manuel auto-complete job'ı tetikler
   */
  async triggerAutoComplete(): Promise<void> {
    await this.queue.add(
      'manual-auto-complete',
      {
        type: 'auto-complete-awaiting-requests',
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    logger.info({ message: 'Manual support request auto-complete job triggered' });
  }

  /**
   * Queue'yu kapat
   */
  async close(): Promise<void> {
    await this.queue.close();
    logger.info({ message: 'SupportRequestAutoCompleteScheduler closed' });
  }

  getQueue(): Queue<SupportRequestAutoCompleteJobData> {
    return this.queue;
  }
}
