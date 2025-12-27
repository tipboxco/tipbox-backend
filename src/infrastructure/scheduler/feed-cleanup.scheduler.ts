import { Queue } from 'bullmq';
import logger from '../logger/logger';
import { FeedCleanupJobData } from '../workers/feed-cleanup.worker';

export class FeedCleanupScheduler {
  private queue: Queue<FeedCleanupJobData>;

  constructor() {
    this.queue = new Queue('feed-cleanup', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    });

    logger.info({ message: 'FeedCleanupScheduler initialized' });
  }

  /**
   * Günlük cleanup job'ını schedule eder (02:00'de)
   */
  async scheduleDaily(): Promise<void> {
    try {
      // Mevcut repeat job'ları temizle (duplicate önlemek için)
      const repeatableJobs = await this.queue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.name === 'daily-cleanup') {
          await this.queue.removeRepeatableByKey(job.key);
        }
      }

      // Yeni repeat job ekle
      await this.queue.add(
        'daily-cleanup',
        {
          type: 'low-score-cleanup',
        },
        {
          repeat: {
            pattern: '0 2 * * *', // Her gün 02:00'de
          },
          jobId: 'daily-cleanup',
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      logger.info({
        message: 'Daily feed cleanup scheduled',
        pattern: '0 2 * * *',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to schedule daily cleanup',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Manuel cleanup job'ı tetikler
   */
  async triggerCleanup(): Promise<void> {
    await this.queue.add(
      'manual-cleanup',
      {
        type: 'low-score-cleanup',
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    logger.info({ message: 'Manual cleanup job triggered' });
  }

  /**
   * Kullanıcı feed optimizasyonu job'ı ekler
   */
  async queueUserOptimization(userId: string): Promise<void> {
    await this.queue.add(
      'user-optimization',
      {
        type: 'user-optimization',
        userId,
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
        delay: 5000, // 5 saniye bekle (throttle)
      }
    );
    logger.debug({ message: 'User optimization job queued', userId });
  }

  /**
   * Queue'yu kapat
   */
  async close(): Promise<void> {
    await this.queue.close();
    logger.info({ message: 'FeedCleanupScheduler closed' });
  }

  getQueue(): Queue<FeedCleanupJobData> {
    return this.queue;
  }
}

