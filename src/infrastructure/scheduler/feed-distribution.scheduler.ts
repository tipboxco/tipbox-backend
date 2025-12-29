import { Queue, QueueEvents } from 'bullmq';
import logger from '../logger/logger';
import { FeedDistributionJobData } from '../workers/feed-distribution.worker';

export class FeedDistributionScheduler {
  private queue: Queue<FeedDistributionJobData>;
  private queueEvents: QueueEvents;

  constructor() {
    const redisHost =
      process.env.REDIS_HOST ||
      (process.env.DOCKER_CONTAINER === 'true' ? 'redis' : 'localhost');
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

    this.queue = new Queue('feed-distribution', {
      connection: {
        host: redisHost,
        port: redisPort,
      },
      defaultJobOptions: {
        attempts: 3, // Max 3 retry
        backoff: {
          type: 'exponential',
          delay: 5000, // 5 saniye başlangıç delay
        },
        removeOnComplete: {
          age: 24 * 3600, // 24 saat sonra completed job'ları sil
          count: 1000, // Max 1000 completed job sakla
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // 7 gün sonra failed job'ları sil
        },
      },
    });

    this.queueEvents = new QueueEvents('feed-distribution', {
      connection: {
        host: redisHost,
        port: redisPort,
      },
    });

    // Queue events
    this.queueEvents.on('completed', ({ jobId }) => {
      logger.info({
        message: 'FeedDistributionScheduler: Job completed',
        jobId,
      });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error({
        message: 'FeedDistributionScheduler: Job failed',
        jobId,
        failedReason,
      });
    });

    logger.info({
      message: 'FeedDistributionScheduler initialized',
      redisHost,
      redisPort,
    });
  }

  /**
   * Yeni bir feed distribution job'ı queue'ya ekle
   * Post oluşturulduğunda çağrılır
   */
  public async queueFeedDistribution(
    postId: string,
    postAuthorId: string,
    postData: FeedDistributionJobData['postData'],
    scoringType: 'full' | 'fast' = 'fast'
  ): Promise<void> {
    try {
      const job = await this.queue.add(
        'distribute-feed',
        {
          postId,
          postAuthorId,
          postData,
          scoringType,
        },
        {
          priority: scoringType === 'full' ? 5 : 10, // Full scoring daha yüksek priority
        }
      );

      logger.info({
        message: 'FeedDistributionScheduler: Feed distribution job queued',
        jobId: job.id,
        postId,
        scoringType,
      });
    } catch (error) {
      logger.error({
        message: 'FeedDistributionScheduler: Failed to queue feed distribution',
        postId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Queue istatistiklerini getir
   */
  public async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Belirli bir job'ın durumunu getir
   */
  public async getJobStatus(jobId: string): Promise<any> {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
    };
  }

  /**
   * Queue'yu temizle
   */
  public async cleanQueue(): Promise<void> {
    await this.queue.drain(); // Waiting job'ları sil
    await this.queue.clean(0, 1000, 'completed'); // Completed job'ları sil
    await this.queue.clean(0, 1000, 'failed'); // Failed job'ları sil

    logger.info({
      message: 'FeedDistributionScheduler: Queue cleaned',
    });
  }

  /**
   * Scheduler'ı kapat
   */
  public async close(): Promise<void> {
    await this.queueEvents.close();
    await this.queue.close();
    logger.info('FeedDistributionScheduler closed');
  }

  /**
   * Queue instance'ını döndür (test için)
   */
  public getQueue(): Queue<FeedDistributionJobData> {
    return this.queue;
  }
}

