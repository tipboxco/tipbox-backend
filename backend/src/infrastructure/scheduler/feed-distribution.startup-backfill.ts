import logger from '../logger/logger';
import { getPrisma } from '../repositories/prisma.client';
import { FeedDistributionScheduler } from './feed-distribution.scheduler';

/**
 * Backend restart sonrası "feed hiç oluşmuyor" gibi durumlarda,
 * otomatik olarak feed distribution job'larını yeniden kuyruğa ekler.
 *
 * Güvenlik:
 * - Yalnızca FEED tablosu tamamen boşsa çalışır (prod'da beklenen durum: dolu).
 * - Queue'da zaten job varsa tekrar enqueue etmez.
 * - Non-blocking olacak şekilde server boot'ta fire-and-forget çağrılmalıdır.
 */
export async function maybeBackfillFeedOnStartup(): Promise<void> {
  const prisma = getPrisma();
  const scheduler = new FeedDistributionScheduler();

  try {
    const [postCount, feedCount, queueStats] = await Promise.all([
      prisma.contentPost.count(),
      prisma.feed.count(),
      scheduler.getQueueStats(),
    ]);

    if (postCount === 0) return;

    const queueHasWork = queueStats.waiting > 0 || queueStats.active > 0 || queueStats.delayed > 0;

    // Feed zaten doluysa veya queue zaten işliyorsa hiç dokunma.
    if (feedCount > 0 || queueHasWork) {
      logger.info({
        message: 'Feed startup backfill skipped',
        postCount,
        feedCount,
        queue: queueStats,
      });
      return;
    }

    logger.warn({
      message:
        'Feed table is empty and queue is idle. Enqueuing feed distribution jobs on startup (non-blocking).',
      postCount,
      feedCount,
      queue: queueStats,
    });

    // TÜM postları al (seed sonrası/boş feed recovery için)
    const posts = await prisma.contentPost.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        mainCategoryId: true,
        subCategoryId: true,
        productGroupId: true,
        productId: true,
        likesCount: true,
        commentsCount: true,
        viewsCount: true,
        sharesCount: true,
        isBoosted: true,
        boostedUntil: true,
        createdAt: true,
      },
    });

    if (posts.length === 0) return;

    let successCount = 0;
    let errorCount = 0;

    for (const post of posts) {
      try {
        const postData = {
          mainCategoryId: post.mainCategoryId,
          subCategoryId: post.subCategoryId,
          productGroupId: post.productGroupId,
          productId: post.productId,
          likesCount: post.likesCount,
          commentsCount: post.commentsCount,
          viewsCount: post.viewsCount,
          sharesCount: post.sharesCount,
          isBoosted: post.isBoosted,
          boostedUntil: post.boostedUntil,
          createdAt: post.createdAt,
        };

        await scheduler.queueFeedDistribution(post.id, post.userId, postData, 'fast');

        successCount++;
        if (successCount % 100 === 0) {
          logger.info({
            message: 'Feed startup backfill progress',
            queued: successCount,
            total: posts.length,
          });
        }
      } catch (error) {
        errorCount++;
        if (errorCount <= 5) {
          logger.error({
            message: 'Feed startup backfill: failed to queue job for post',
            postId: post.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    logger.info({
      message: 'Feed startup backfill completed (jobs enqueued)',
      queued: successCount,
      failed: errorCount,
      totalPosts: posts.length,
    });
  } catch (error) {
    logger.error({
      message: 'Feed startup backfill failed',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  } finally {
    await scheduler.close();
  }
}

