import { Worker, Job } from 'bullmq';
import { getPrisma } from '../repositories/prisma.client';
import { FeedScoringService } from '../../application/feed/feed-scoring.service';
import { FeedSource } from '../../domain/admin/feed-source.enum';
import { generateIdForModel } from '../../infrastructure/ids/id.strategy';
import logger from '../logger/logger';
import RedisConfigManager from '../config/redis.config';
import QueueProvider from '../queue/queue.provider';

export interface FeedDistributionJobData {
  postId: string;
  postAuthorId: string;
  postData: {
    mainCategoryId: string | null;
    subCategoryId: string | null;
    productGroupId: string | null;
    productId: string | null;
    likesCount: number;
    commentsCount: number;
    viewsCount: number;
    sharesCount: number;
    isBoosted: boolean;
    boostedUntil: Date | null;
    createdAt: Date;
  };
  scoringType: 'full' | 'fast';
}

export interface FeedRecord {
  id: string;
  userId: string;
  postId: string;
  source: FeedSource;
  relevanceScore: number;
  seen: boolean;
}

export class FeedDistributionWorker {
  private worker: Worker;
  private prisma: ReturnType<typeof getPrisma>;
  private scoringService: FeedScoringService;

  // Konfigürasyon
  private readonly CHUNK_SIZE = 500; // Her batch'te 500 feed kaydı
  private readonly SCORE_THRESHOLD = 5; // Minimum score
  private readonly CONCURRENT_CHUNKS = 3; // Aynı anda max 3 chunk işle
  private readonly MAX_RETRIES = 3; // Başarısız chunk için max retry
  private readonly RETRY_DELAY = 5000; // Retry arası 5 saniye

  constructor() {
    this.prisma = getPrisma();
    this.scoringService = new FeedScoringService();

    const redisHost = RedisConfigManager.parseRedisHost();
    const redisPort = RedisConfigManager.parseRedisPort();

    this.worker = new Worker(
      'feed-distribution',
      async (job: Job<FeedDistributionJobData>) => {
        return this.processJob(job);
      },
      {
        connection: {
          host: redisHost,
          port: redisPort,
        },
        concurrency: 10, // Max 10 job paralel (seed için artırıldı)
        // Limiter devre dışı (seed için)
        // limiter: {
        //   max: 5, // Max 5 job
        //   duration: 60000, // 1 dakikada
        // },
      }
    );

    // Event handlers
    this.worker.on('completed', (job) => {
      logger.info({
        message: 'FeedDistributionWorker: Job completed',
        jobId: job.id,
        postId: job.data.postId,
      });
    });

    this.worker.on('failed', (job, err) => {
      logger.error({
        message: 'FeedDistributionWorker: Job failed',
        jobId: job?.id,
        postId: job?.data?.postId,
        error: err.message,
        stack: err.stack,
      });
      if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
        QueueProvider.getInstance()
          .addToDLQ('feed-distribution', job.data, err.message, job.id)
          .catch(() => {});
      }
    });

    this.worker.on('error', (err) => {
      logger.error({
        message: 'FeedDistributionWorker: Worker error',
        error: err.message,
      });
    });

    logger.info({
      message: 'FeedDistributionWorker initialized',
      redisHost,
      redisPort,
      chunkSize: this.CHUNK_SIZE,
      concurrentChunks: this.CONCURRENT_CHUNKS,
    });
  }

  /**
   * Ana job processing mantığı
   */
  private async processJob(job: Job<FeedDistributionJobData>): Promise<void> {
    const { postId, postAuthorId, postData, scoringType } = job.data;

    logger.info({
      message: 'FeedDistributionWorker: Processing feed distribution',
      jobId: job.id,
      postId,
      scoringType,
    });

    const startTime = Date.now();

    try {
      // 0. Post'un var olduğunu kontrol et
      const postExists = await this.prisma.contentPost.findUnique({
        where: { id: postId },
        select: { id: true },
      });

      if (!postExists) {
        logger.warn({
          message: 'FeedDistributionWorker: Post not found, skipping',
          jobId: job.id,
          postId,
          postAuthorId,
        });
        // Post'u tekrar kontrol et (belki transaction sırasında silinmiş)
        const postCheck = await this.prisma.contentPost.findFirst({
          where: { id: postId },
          select: { id: true, userId: true },
        });
        if (!postCheck) {
          logger.warn({
            message: 'FeedDistributionWorker: Post confirmed missing',
            jobId: job.id,
            postId,
          });
          return; // Post gerçekten yoksa job'ı atla
        }
        // Post bulundu, devam et
      }

      // 1. Tüm aktif kullanıcıları al
      const allActiveUsers = await this.prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          id: { not: postAuthorId }, // Post sahibini hariç tut
        },
        select: { id: true },
      });

      logger.info({
        message: 'FeedDistributionWorker: Active users fetched',
        jobId: job.id,
        userCount: allActiveUsers.length,
      });

      // 2. Her kullanıcı için score hesapla (paralel)
      await job.updateProgress(10);
      const feedRecords = await this.calculateScoresForUsers(
        allActiveUsers.map((u) => u.id),
        postId,
        postAuthorId,
        postData,
        scoringType,
        job
      );

      logger.info({
        message: 'FeedDistributionWorker: Scores calculated',
        jobId: job.id,
        totalUsers: allActiveUsers.length,
        qualifiedFeeds: feedRecords.length,
        filteredOut: allActiveUsers.length - feedRecords.length,
      });

      // 3. Score threshold'u geçen kullanıcıları filtrele (zaten calculateScoresForUsers'da yapılıyor)
      await job.updateProgress(50);

      // 4. Chunk'lara ayır ve batch insert yap
      if (feedRecords.length > 0) {
        await this.insertFeedsInChunks(feedRecords, job);
      } else {
        logger.info({
          message: 'FeedDistributionWorker: No feeds to insert (all below threshold)',
          jobId: job.id,
          postId,
        });
      }

      await job.updateProgress(100);

      const duration = Date.now() - startTime;
      logger.info({
        message: 'FeedDistributionWorker: Feed distribution completed',
        jobId: job.id,
        postId,
        feedCount: feedRecords.length,
        duration: `${duration}ms`,
        avgScore:
          feedRecords.length > 0
            ? Math.round(
                (feedRecords.reduce((sum, r) => sum + r.relevanceScore, 0) /
                  feedRecords.length) *
                  100
              ) / 100
            : 0,
      });
    } catch (error) {
      logger.error({
        message: 'FeedDistributionWorker: Job processing failed',
        jobId: job.id,
        postId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error; // BullMQ retry mekanizması devreye girer
    }
  }

  /**
   * Kullanıcılar için score hesapla (paralel batch processing)
   */
  private async calculateScoresForUsers(
    userIds: string[],
    postId: string,
    postAuthorId: string,
    postData: FeedDistributionJobData['postData'],
    scoringType: 'full' | 'fast',
    job: Job<FeedDistributionJobData>
  ): Promise<FeedRecord[]> {
    const feedRecords: FeedRecord[] = [];
    const BATCH_SIZE = 100; // 100'er kullanıcı için score hesapla
    const totalBatches = Math.ceil(userIds.length / BATCH_SIZE);

    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

      // Her batch'i paralel işle
      const batchResults = await Promise.allSettled(
        batch.map(async (userId) => {
          try {
            let scoringResult;

            if (scoringType === 'full') {
              // BullMQ job'dan gelen string date'leri Date objesine dönüştür
              scoringResult = await this.scoringService.calculateFullScore(
                userId,
                postId,
                postAuthorId,
                {
                  ...postData,
                  boostedUntil: postData.boostedUntil ? new Date(postData.boostedUntil) : null,
                  createdAt: new Date(postData.createdAt),
                }
              );
            } else {
              scoringResult = await this.scoringService.calculateFastScore(userId, {
                mainCategoryId: postData.mainCategoryId,
                subCategoryId: postData.subCategoryId,
                isBoosted: postData.isBoosted,
                boostedUntil: postData.boostedUntil ? new Date(postData.boostedUntil) : null,
                createdAt: new Date(postData.createdAt), // String'i Date'e dönüştür
              });
            }

            // Threshold kontrolü
            if (scoringResult.score < this.SCORE_THRESHOLD) {
              return null; // Threshold'u geçemedi
            }

            // Post'un hala var olduğunu kontrol et (paralel işlem sırasında silinmiş olabilir)
            const postStillExists = await this.prisma.contentPost.findUnique({
              where: { id: postId },
              select: { id: true },
            });

            if (!postStillExists) {
              return null; // Post artık yoksa feed oluşturma
            }

            return {
              id: generateIdForModel('Feed'),
              userId,
              postId,
              source: scoringResult.source,
              relevanceScore: scoringResult.score,
              seen: false,
            };
          } catch (error) {
            logger.error({
              message: 'FeedDistributionWorker: Score calculation failed for user',
              userId,
              postId,
              error: error instanceof Error ? error.message : String(error),
            });
            return null; // Hata durumunda skip
          }
        })
      );

      // Başarılı sonuçları topla
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value !== null) {
          feedRecords.push(result.value);
        }
      }

      // Progress güncelle (10-50 arası)
      const progress = 10 + Math.floor((batchNumber / totalBatches) * 40);
      await job.updateProgress(progress);

      logger.debug({
        message: 'FeedDistributionWorker: Batch scoring completed',
        jobId: job.id,
        batch: `${batchNumber}/${totalBatches}`,
        batchResults: feedRecords.length,
        progress: `${progress}%`,
      });
    }

    return feedRecords;
  }

  /**
   * Feed kayıtlarını chunk'lara ayırarak insert et
   * Kontrollü asenkron işlem + retry mekanizması
   */
  private async insertFeedsInChunks(
    feedRecords: FeedRecord[],
    job: Job<FeedDistributionJobData>
  ): Promise<void> {
    const chunks: FeedRecord[][] = [];
    for (let i = 0; i < feedRecords.length; i += this.CHUNK_SIZE) {
      chunks.push(feedRecords.slice(i, i + this.CHUNK_SIZE));
    }

    logger.info({
      message: 'FeedDistributionWorker: Starting chunked insert',
      jobId: job.id,
      totalRecords: feedRecords.length,
      totalChunks: chunks.length,
      chunkSize: this.CHUNK_SIZE,
    });

    let successCount = 0;
    let failureCount = 0;
    const failedChunks: { index: number; chunk: FeedRecord[]; error: string }[] = [];

    // Chunk'ları kontrollü şekilde işle (CONCURRENT_CHUNKS kadar paralel)
    for (let i = 0; i < chunks.length; i += this.CONCURRENT_CHUNKS) {
      const currentChunks = chunks.slice(i, i + this.CONCURRENT_CHUNKS);
      const chunkPromises = currentChunks.map((chunk, idx) =>
        this.insertChunkWithRetry(chunk, i + idx, job)
      );

      const results = await Promise.allSettled(chunkPromises);

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const chunkIndex = i + j;

        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
        } else {
          failureCount++;
          const error =
            result.status === 'rejected'
              ? result.reason
              : result.value.error || 'Unknown error';
          failedChunks.push({
            index: chunkIndex,
            chunk: currentChunks[j],
            error,
          });

          logger.error({
            message: 'FeedDistributionWorker: Chunk insert failed',
            jobId: job.id,
            chunkIndex,
            chunkSize: currentChunks[j].length,
            error,
          });
        }
      }

      // Progress güncelle (50-90 arası)
      const progress = 50 + Math.floor(((i + currentChunks.length) / chunks.length) * 40);
      await job.updateProgress(progress);
    }

    // Başarısız chunk'ları logla
    if (failedChunks.length > 0) {
      logger.warn({
        message: 'FeedDistributionWorker: Some chunks failed',
        jobId: job.id,
        successCount,
        failureCount,
        failedChunks: failedChunks.map((fc) => ({
          index: fc.index,
          size: fc.chunk.length,
          error: fc.error,
        })),
      });
    }

    // UnseenFeedCount ve cache invalidation (batch)
    await this.updateUserStatsAndCache(feedRecords, job);

    logger.info({
      message: 'FeedDistributionWorker: Chunked insert completed',
      jobId: job.id,
      totalChunks: chunks.length,
      successCount,
      failureCount,
      insertedRecords: successCount * this.CHUNK_SIZE,
    });
  }

  /**
   * Tek bir chunk'ı retry mekanizması ile insert et
   */
  private async insertChunkWithRetry(
    chunk: FeedRecord[],
    chunkIndex: number,
    job: Job<FeedDistributionJobData>,
    retryCount: number = 0
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.prisma.feed.createMany({
        data: chunk as NonNullable<Parameters<typeof this.prisma.feed.createMany>[0]>['data'],
        skipDuplicates: true,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Retry logic
      if (retryCount < this.MAX_RETRIES) {
        logger.warn({
          message: 'FeedDistributionWorker: Chunk insert failed, retrying',
          jobId: job.id,
          chunkIndex,
          retryCount: retryCount + 1,
          maxRetries: this.MAX_RETRIES,
          error: errorMessage,
        });

        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, this.RETRY_DELAY * Math.pow(2, retryCount))
        );

        return this.insertChunkWithRetry(chunk, chunkIndex, job, retryCount + 1);
      }

      // Max retry aşıldı
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Kullanıcı istatistiklerini ve cache'i güncelle
   */
  private async updateUserStatsAndCache(
    feedRecords: FeedRecord[],
    job: Job<FeedDistributionJobData>
  ): Promise<void> {
    await job.updateProgress(90);

    const uniqueUserIds = Array.from(new Set(feedRecords.map((r) => r.userId)));

    logger.info({
      message: 'FeedDistributionWorker: Updating user stats and cache',
      jobId: job.id,
      affectedUsers: uniqueUserIds.length,
    });

    // Batch update unseen counts (her kullanıcı için 1 artır)
    const updatePromises = uniqueUserIds.map(async (userId) => {
      try {
        // Unseen count artır
        await this.prisma.profile.updateMany({
          where: { userId },
          data: {
            unseenFeedCount: {
              increment: feedRecords.filter((r) => r.userId === userId).length,
            },
          } as Parameters<typeof this.prisma.profile.updateMany>[0]['data'],
        });
      } catch (error) {
        logger.warn({
          message: 'FeedDistributionWorker: Failed to update unseen count',
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.allSettled(updatePromises);

    // Cache invalidation (background task, hata olsa bile devam)
    this.invalidateCacheForUsers(uniqueUserIds, job.id || 'unknown');
  }

  /**
   * Kullanıcı cache'lerini invalidate et (fire and forget)
   */
  private invalidateCacheForUsers(userIds: string[], jobId: string): void {
    // Fire and forget - hata olsa bile job başarısız sayılmaz
    Promise.allSettled(
      userIds.map(async (userId) => {
        try {
          const CacheService = (await import('../cache/cache.service')).CacheService;
          const cacheService = CacheService.getInstance();
          const cachePattern = `feed:${userId}:*`;
          await cacheService.delPattern(cachePattern);
        } catch (error) {
          // Ignore cache errors
        }
      })
    ).catch(() => {
      // Ignore
    });
  }

  /**
   * Worker'ı başlat
   */
  public async start(): Promise<void> {
    logger.info('FeedDistributionWorker started');
  }

  /**
   * Worker'ı durdur
   */
  public async stop(): Promise<void> {
    await this.worker.close();
    await this.prisma.$disconnect();
    logger.info('FeedDistributionWorker stopped');
  }

  /**
   * Worker instance'ını döndür (test için)
   */
  public getWorker(): Worker {
    return this.worker;
  }
}

