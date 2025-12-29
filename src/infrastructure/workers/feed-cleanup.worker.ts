import { Worker, Job } from 'bullmq';
import { FeedCleanupService } from '../../application/feed/feed-cleanup.service';
import logger from '../logger/logger';
import RedisConfigManager from '../config/redis.config';

export interface FeedCleanupJobData {
  type: 'low-score-cleanup' | 'user-optimization';
  userId?: string; // user-optimization için gerekli
}

export class FeedCleanupWorker {
  private worker: Worker;
  private cleanupService: FeedCleanupService;

  constructor() {
    this.cleanupService = new FeedCleanupService();

    // Redis connection - REDIS_URL'den parse et
    const redisHost = RedisConfigManager.parseRedisHost();
    const redisPort = RedisConfigManager.parseRedisPort();

    this.worker = new Worker(
      'feed-cleanup',
      async (job: Job<FeedCleanupJobData>) => {
        return this.processJob(job);
      },
      {
        connection: {
          host: redisHost,
          port: redisPort,
        },
        concurrency: 5, // Max 5 job paralel
        limiter: {
          max: 10, // Max 10 job
          duration: 60000, // 1 dakikada
        },
      }
    );

    this.worker.on('completed', (job) => {
      logger.info({
        message: 'Feed cleanup job completed',
        jobId: job.id,
        jobType: job.data.type,
        result: job.returnvalue,
      });
    });

    this.worker.on('failed', (job, err) => {
      logger.error({
        message: 'Feed cleanup job failed',
        jobId: job?.id,
        jobType: job?.data.type,
        error: err.message,
      });
    });

    logger.info({ 
      message: 'FeedCleanupWorker initialized',
      redisHost,
      redisPort
    });
  }

  private async processJob(job: Job<FeedCleanupJobData>): Promise<any> {
    const { type, userId } = job.data;

    try {
      switch (type) {
        case 'low-score-cleanup':
          logger.info({ message: 'Starting low score cleanup job' });
          const cleanupStats = await this.cleanupService.cleanupLowScoreFeeds();
          return cleanupStats;

        case 'user-optimization':
          if (!userId) {
            throw new Error('userId is required for user-optimization job');
          }
          logger.info({ message: 'Starting user optimization job', userId });
          const deletedCount = await this.cleanupService.optimizeUserFeeds(userId);
          return { userId, deletedCount };

        default:
          throw new Error(`Unknown job type: ${type}`);
      }
    } catch (error) {
      logger.error({
        message: 'Feed cleanup job processing error',
        jobId: job.id,
        type,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    await this.worker.close();
    logger.info({ message: 'FeedCleanupWorker stopped' });
  }

  getWorker(): Worker {
    return this.worker;
  }
}

