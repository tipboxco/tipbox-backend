import { Worker, Job } from 'bullmq';
import { getPrisma } from '../repositories/prisma.client';
import { FeedScoringService } from '../../application/feed/feed-scoring.service';
import { CacheService } from '../cache/cache.service';
import { FeedSource } from '../../domain/admin/feed-source.enum';
import { generateIdForModel } from '../ids/id.strategy';
import logger from '../logger/logger';
import { TrustBackfillJobData } from '../scheduler/trust-backfill.scheduler';
import RedisConfigManager from '../config/redis.config';
import QueueProvider from '../queue/queue.provider';

export class TrustBackfillWorker {
  private worker: Worker;
  private prisma: ReturnType<typeof getPrisma>;
  private scoringService: FeedScoringService;
  private cacheService: CacheService;

  // Configurable parameters
  private readonly MAX_POSTS_TO_BACKFILL = 50; // Max 50 post geriye dönük işle
  private readonly SCORE_THRESHOLD = 0; // MVP: eşik 0 (bkz. feed-distribution.worker)

  constructor() {
    this.prisma = getPrisma();
    this.scoringService = new FeedScoringService();
    this.cacheService = CacheService.getInstance();

    const redisHost = RedisConfigManager.parseRedisHost();
    const redisPort = RedisConfigManager.parseRedisPort();

    this.worker = new Worker(
      'trust-backfill',
      async (job: Job<TrustBackfillJobData>) => {
        return this.processJob(job);
      },
      {
        connection: {
          host: redisHost,
          port: redisPort,
        },
        concurrency: 2, // Max 2 backfill job paralel
        limiter: {
          max: 5, // Max 5 job
          duration: 60000, // 1 dakikada
        },
      }
    );

    this.worker.on('completed', (job) => {
      logger.info({ message: `Trust backfill job ${job.id} completed` });
    });

    this.worker.on('failed', (job, err) => {
      logger.error({
        message: `Trust backfill job ${job?.id} failed`,
        error: err.message,
        stack: err.stack
      });
      if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
        QueueProvider.getInstance()
          .addToDLQ('trust-backfill', job.data, err.message, job.id)
          .catch(() => {});
      }
    });

    this.worker.on('error', (err) => {
      logger.error({ 
        message: 'TrustBackfillWorker error', 
        error: err.message, 
        stack: err.stack 
      });
    });

    logger.info({ message: 'TrustBackfillWorker initialized', redisHost, redisPort });
  }

  /**
   * Ana job processing mantığı
   */
  private async processJob(job: Job<TrustBackfillJobData>): Promise<void> {
    const { trusterId, trustedUserId, timeWindowDays } = job.data;

    logger.info({
      message: 'TrustBackfillWorker: Processing trust backfill',
      jobId: job.id,
      trusterId,
      trustedUserId,
      timeWindowDays,
    });

    const startTime = Date.now();

    try {
      // 1. Trust relation hala var mı kontrol et
      const trustRelation = await this.prisma.trustRelation.findUnique({
        where: {
          trusterId_trustedUserId: {
            trusterId,
            trustedUserId,
          },
        },
      });

      if (!trustRelation) {
        logger.info({
          message: 'Trust relation not found, skipping backfill',
          jobId: job.id,
          trusterId,
          trustedUserId,
        });
        return;
      }

      // 2. Trusted user'ın son N günlük postlarını al
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - timeWindowDays);

      const recentPosts = await this.prisma.contentPost.findMany({
        where: {
          userId: trustedUserId,
          createdAt: { gte: cutoffDate },
        },
        include: {
          user: true,
          product: true,
          productGroup: true,
          subCategory: true,
          mainCategory: true,
        },
        orderBy: { createdAt: 'desc' },
        take: this.MAX_POSTS_TO_BACKFILL,
      });

      logger.info({
        message: 'TrustBackfillWorker: Recent posts fetched',
        jobId: job.id,
        postCount: recentPosts.length,
      });

      if (recentPosts.length === 0) {
        logger.info({ message: 'No recent posts to backfill', jobId: job.id });
        await job.updateProgress(100);
        return;
      }

      // 3. Her post için feed'de var mı kontrol et ve score güncelle
      await job.updateProgress(20);
      const results = await this.backfillPosts(trusterId, trustedUserId, recentPosts, job);

      // 4. Cache'i invalidate et
      await job.updateProgress(90);
      await this.invalidateTrusterCache(trusterId);

      const duration = Date.now() - startTime;

      logger.info({
        message: 'TrustBackfillWorker: Backfill completed',
        jobId: job.id,
        trusterId,
        trustedUserId,
        postsProcessed: recentPosts.length,
        newFeedsCreated: results.created,
        existingFeedsUpdated: results.updated,
        belowThreshold: results.belowThreshold,
        duration: `${duration}ms`,
      });

      await job.updateProgress(100);
    } catch (error) {
      logger.error({
        message: 'TrustBackfillWorker: Failed to process job',
        jobId: job.id,
        trusterId,
        trustedUserId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Postları backfill et (score hesapla ve feed'e ekle veya güncelle)
   */
  private async backfillPosts(
    trusterId: string,
    trustedUserId: string,
    posts: Awaited<ReturnType<typeof this.prisma.contentPost.findMany>>,
    job: Job<TrustBackfillJobData>
  ): Promise<{ created: number; updated: number; belowThreshold: number }> {
    let created = 0;
    let updated = 0;
    let belowThreshold = 0;

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];

      try {
        // 1. Score hesapla (full scoring - trust dahil)
        const scoringResult = await this.scoringService.calculateFullScore(
          trusterId,
          post.id,
          trustedUserId,
          {
            mainCategoryId: post.mainCategoryId,
            subCategoryId: post.subCategoryId,
            productGroupId: post.productGroupId,
            productId: post.productId,
            likesCount: post.likesCount || 0,
            commentsCount: post.commentsCount || 0,
            viewsCount: post.viewsCount || 0,
            sharesCount: post.sharesCount || 0,
            isBoosted: post.isBoosted,
            boostedUntil: post.boostedUntil,
            createdAt: post.createdAt,
          }
        );

        // 2. Threshold kontrolü
        if (scoringResult.score < this.SCORE_THRESHOLD) {
          belowThreshold++;
          continue;
        }

        // 3. Feed'de zaten var mı kontrol et
        const existingFeed = await this.prisma.feed.findFirst({
          where: {
            userId: trusterId,
            postId: post.id,
          },
        });

        if (existingFeed) {
          // 4a. Varsa: Score ve source güncelle
          await this.prisma.feed.update({
            where: { id: existingFeed.id },
            data: {
              relevanceScore: scoringResult.score,
              source: scoringResult.source, // TRUSTER source olabilir
            },
          });
          updated++;
        } else {
          // 4b. Yoksa: Yeni feed item oluştur
          await this.prisma.feed.create({
            data: {
              id: generateIdForModel('Feed'),
              userId: trusterId,
              postId: post.id,
              source: scoringResult.source,
              relevanceScore: scoringResult.score,
              seen: false,
            },
          });

          // Unseen count artır
          await this.prisma.profile.updateMany({
            where: { userId: trusterId },
            data: {
              unseenFeedCount: {
                increment: 1,
              },
            } as Parameters<typeof this.prisma.profile.updateMany>[0]['data'],
          });

          created++;
        }

        // Progress güncelle
        const progress = 20 + Math.floor(((i + 1) / posts.length) * 70); // 20% -> 90%
        await job.updateProgress(progress);
      } catch (error) {
        logger.warn({
          message: 'Failed to backfill post',
          postId: post.id,
          trusterId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { created, updated, belowThreshold };
  }

  /**
   * Truster'ın feed cache'ini invalidate et
   */
  private async invalidateTrusterCache(trusterId: string): Promise<void> {
    try {
      const cachePattern = `feed:${trusterId}:*`;
      await this.cacheService.delPattern(cachePattern);
      logger.info({ message: 'Truster feed cache invalidated', trusterId });
    } catch (error) {
      logger.warn({
        message: 'Failed to invalidate truster cache',
        trusterId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async start(): Promise<void> {
    logger.info('TrustBackfillWorker started');
  }

  public async stop(): Promise<void> {
    await this.worker.close();
    logger.info('TrustBackfillWorker stopped');
  }

  public getWorker(): Worker {
    return this.worker;
  }
}

