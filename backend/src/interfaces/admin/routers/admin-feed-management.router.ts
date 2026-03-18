import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { FeedDistributionScheduler } from '../../../infrastructure/scheduler/feed-distribution.scheduler';
import { FeedCleanupScheduler } from '../../../infrastructure/scheduler/feed-cleanup.scheduler';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { FEED_CLEANUP_ENABLED_KEY } from '../../../infrastructure/workers/feed-cleanup.worker';
import { resolveMediaUrl } from '../../../infrastructure/config/media.config';
import logger from '../../../infrastructure/logger/logger';
import { z } from 'zod';

const router = Router();
const prisma = getPrisma();

/**
 * Feed Management Router
 * Routes are mounted at /admin/feed-management
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

// ==================== Schemas ====================

const TriggerDistributionSchema = z.object({
  postId: z.string().min(1),
  scoringType: z.enum(['full', 'fast']).default('fast'),
});

const TriggerUserFeedRefreshSchema = z.object({
  userId: z.string().uuid(),
});

const UserFeedLookupQuerySchema = z.object({
  search: z.string().min(1),
});

// ==================== Feed Statistics ====================

/**
 * GET /admin/feed-management/stats
 * Get comprehensive feed system statistics
 */
router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [
      totalFeeds,
      totalUnseenFeeds,
      totalUsers,
      usersWithFeeds,
      usersWithEmptyFeeds,
      avgScoreResult,
      feedsBySource,
      recentFeedsCount,
      oldFeedsCount,
    ] = await Promise.all([
      prisma.feed.count(),
      prisma.feed.count({ where: { seen: false } }),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.feed
        .groupBy({
          by: ['userId'],
          _count: { id: true },
        })
        .then((groups: Array<{ userId: string }>) => groups.length),
      // Users with 0 feeds
      prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(DISTINCT u.id) as count
         FROM users u
         LEFT JOIN feeds f ON u.id = f.user_id
         WHERE u.status = 'ACTIVE' AND f.id IS NULL`,
      ),
      prisma.feed.aggregate({
        _avg: { relevanceScore: true },
        _min: { relevanceScore: true },
        _max: { relevanceScore: true },
      }),
      prisma.feed.groupBy({
        by: ['source'],
        _count: { id: true },
        _avg: { relevanceScore: true },
      }),
      // Feeds created in last 24 hours
      prisma.feed.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      // Feeds older than 7 days
      prisma.feed.count({
        where: { createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

    const emptyFeedUsersCount = Number(usersWithEmptyFeeds[0]?.count ?? 0);

    // Score distribution brackets
    const [lowScore, mediumScore, highScore, veryHighScore] = await Promise.all([
      prisma.feed.count({ where: { relevanceScore: { lt: 10 } } }),
      prisma.feed.count({ where: { relevanceScore: { gte: 10, lt: 30 } } }),
      prisma.feed.count({ where: { relevanceScore: { gte: 30, lt: 60 } } }),
      prisma.feed.count({ where: { relevanceScore: { gte: 60 } } }),
    ]);

    const sourceDistribution = feedsBySource.map(
      (s: { source: string; _count: { id: number }; _avg: { relevanceScore: number | null } }) => ({
        source: s.source,
        count: s._count.id,
        avgScore: Math.round((s._avg.relevanceScore ?? 0) * 100) / 100,
      }),
    );

    return res.json({
      success: true,
      data: {
        overview: {
          totalFeeds,
          totalUnseenFeeds,
          totalActiveUsers: totalUsers,
          usersWithFeeds,
          usersWithEmptyFeeds: emptyFeedUsersCount,
          feedCoverage:
            totalUsers > 0 ? Math.round((usersWithFeeds / totalUsers) * 10000) / 100 : 0,
        },
        scores: {
          average: Math.round((avgScoreResult._avg.relevanceScore ?? 0) * 100) / 100,
          min: Math.round((avgScoreResult._min.relevanceScore ?? 0) * 100) / 100,
          max: Math.round((avgScoreResult._max.relevanceScore ?? 0) * 100) / 100,
        },
        scoreDistribution: {
          low: lowScore, // < 10
          medium: mediumScore, // 10-30
          high: highScore, // 30-60
          veryHigh: veryHighScore, // 60+
        },
        sourceDistribution,
        activity: {
          feedsLast24h: recentFeedsCount,
          feedsOlderThan7d: oldFeedsCount,
        },
      },
    });
  }),
);

// ==================== Queue Statistics ====================

/**
 * GET /admin/feed-management/queue-stats
 * Get BullMQ queue statistics for both distribution and cleanup
 */
router.get(
  '/queue-stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const distributionScheduler = new FeedDistributionScheduler();
    const cleanupScheduler = new FeedCleanupScheduler();

    try {
      const cleanupQueue = cleanupScheduler.getQueue();
      const [
        distributionStats,
        cleanupWaiting,
        cleanupActive,
        cleanupCompleted,
        cleanupFailed,
        cleanupDelayed,
      ] = await Promise.all([
        distributionScheduler.getQueueStats(),
        cleanupQueue.getWaitingCount(),
        cleanupQueue.getActiveCount(),
        cleanupQueue.getCompletedCount(),
        cleanupQueue.getFailedCount(),
        cleanupQueue.getDelayedCount(),
      ]);

      const cleanupStats = {
        waiting: cleanupWaiting,
        active: cleanupActive,
        completed: cleanupCompleted,
        failed: cleanupFailed,
        delayed: cleanupDelayed,
      };

      return res.json({
        success: true,
        data: {
          distribution: distributionStats,
          cleanup: cleanupStats,
        },
      });
    } finally {
      await distributionScheduler.close();
      await cleanupScheduler.close();
    }
  }),
);

// ==================== Job History ====================

/**
 * GET /admin/feed-management/job-history
 * Get recent completed/failed jobs from BullMQ (no extra DB table needed)
 */
router.get(
  '/job-history',
  asyncHandler(async (_req: Request, res: Response) => {
    const distributionScheduler = new FeedDistributionScheduler();

    try {
      const queue = distributionScheduler.getQueue();

      const [completedJobs, failedJobs] = await Promise.all([
        queue.getCompleted(0, 14),
        queue.getFailed(0, 9),
      ]);

      const formatJob = (job: {
        id?: string;
        name: string;
        data: Record<string, unknown>;
        processedOn?: number;
        finishedOn?: number;
        failedReason?: string;
        attemptsMade: number;
        returnvalue?: unknown;
      }) => ({
        id: job.id,
        name: job.name,
        postId: (job.data as { postId?: string }).postId ?? null,
        scoringType: (job.data as { scoringType?: string }).scoringType ?? null,
        processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
        duration:
          job.processedOn && job.finishedOn ? job.finishedOn - job.processedOn : null,
        attempts: job.attemptsMade,
        failedReason: job.failedReason ?? null,
      });

      const completed = completedJobs.map(formatJob);
      const failed = failedJobs.map(formatJob);

      return res.json({
        success: true,
        data: { completed, failed },
      });
    } finally {
      await distributionScheduler.close();
    }
  }),
);

// ==================== User Feed Lookup ====================

/**
 * GET /admin/feed-management/user-feed-lookup?search=email_or_username
 * Look up a specific user's feed health
 */
router.get(
  '/user-feed-lookup',
  validateQuery(UserFeedLookupQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { search } = UserFeedLookupQuerySchema.parse(req.query);

    // Find user by email, username, or userId
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { profile: { userName: { contains: search, mode: 'insensitive' } } },
          { id: search.match(/^[0-9a-f-]{36}$/i) ? search : undefined },
        ].filter((c) => Object.values(c).some((v) => v !== undefined)),
      },
      select: {
        id: true,
        email: true,
        status: true,
        createdAt: true,
        profile: {
          select: {
            userName: true,
            displayName: true,
            unseenFeedCount: true,
          },
        },
        avatars: { where: { isActive: true }, select: { imageUrl: true }, take: 1 },
      },
    });

    if (!user) {
      return res.json({ success: true, data: null });
    }

    // Get feed stats for this user
    const [feedCount, unseenCount, avgScore, feedsBySource, lastFeed, trustCount, inventoryCount, hasPreferences] =
      await Promise.all([
        prisma.feed.count({ where: { userId: user.id } }),
        prisma.feed.count({ where: { userId: user.id, seen: false } }),
        prisma.feed.aggregate({
          where: { userId: user.id },
          _avg: { relevanceScore: true },
          _min: { relevanceScore: true },
          _max: { relevanceScore: true },
        }),
        prisma.feed.groupBy({
          by: ['source'],
          where: { userId: user.id },
          _count: { id: true },
        }),
        prisma.feed.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
        prisma.trustRelation.count({ where: { trusterId: user.id } }),
        prisma.inventory.count({ where: { userId: user.id } }),
        prisma.userFeedPreferences.findUnique({
          where: { userId: user.id },
          select: { id: true, preferredCategories: true },
        }),
      ]);

    const sourceDist = feedsBySource.map(
      (s: { source: string; _count: { id: number } }) => ({
        source: s.source,
        count: s._count.id,
      }),
    );

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          status: user.status,
          username: user.profile?.userName ?? null,
          displayName: user.profile?.displayName ?? null,
          avatarUrl: user.avatars?.[0]?.imageUrl
            ? resolveMediaUrl(user.avatars[0].imageUrl, true)
            : null,
          createdAt: user.createdAt.toISOString(),
        },
        feedHealth: {
          totalFeeds: feedCount,
          unseenFeeds: unseenCount,
          denormalizedUnseenCount: user.profile?.unseenFeedCount ?? 0,
          avgScore: Math.round((avgScore._avg.relevanceScore ?? 0) * 100) / 100,
          minScore: Math.round((avgScore._min.relevanceScore ?? 0) * 100) / 100,
          maxScore: Math.round((avgScore._max.relevanceScore ?? 0) * 100) / 100,
          lastFeedAt: lastFeed?.createdAt?.toISOString() ?? null,
          sourceDistribution: sourceDist,
        },
        context: {
          trustCount,
          inventoryCount,
          hasPreferences: !!hasPreferences,
          preferredCategories: hasPreferences?.preferredCategories ?? null,
        },
      },
    });
  }),
);

// ==================== Manual Triggers ====================

/**
 * POST /admin/feed-management/trigger-cleanup
 * Manually trigger feed cleanup job
 */
router.post(
  '/trigger-cleanup',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    const cleanupScheduler = new FeedCleanupScheduler();

    try {
      await cleanupScheduler.triggerCleanup();

      await prisma.adminLog.create({
        data: {
          adminId: adminId || 'system',
          action: 'FEED_CLEANUP_TRIGGERED',
          description: 'Manual feed cleanup triggered from admin panel',
          entityType: 'feed',
          entityId: 0,
        },
      });

      logger.info('Admin triggered manual feed cleanup', { adminId });

      return res.json({
        success: true,
        message: 'Feed cleanup job has been queued successfully',
      });
    } finally {
      await cleanupScheduler.close();
    }
  }),
);

/**
 * POST /admin/feed-management/trigger-distribution
 * Manually trigger feed distribution for a specific post
 */
router.post(
  '/trigger-distribution',
  validateBody(TriggerDistributionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    const body = TriggerDistributionSchema.parse(req.body);

    const post = await prisma.contentPost.findUnique({
      where: { id: body.postId },
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

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const scheduler = new FeedDistributionScheduler();
    try {
      await scheduler.queueFeedDistribution(
        post.id,
        post.userId,
        {
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
        },
        body.scoringType,
      );

      await prisma.adminLog.create({
        data: {
          adminId: adminId || 'system',
          action: 'FEED_DISTRIBUTION_TRIGGERED',
          description: `Manual feed distribution for post ${post.id} (${body.scoringType})`,
          entityType: 'feed',
          entityId: 0,
        },
      });

      logger.info('Admin triggered manual feed distribution', {
        adminId,
        postId: post.id,
        scoringType: body.scoringType,
      });

      return res.json({
        success: true,
        message: `Feed distribution job queued for post ${post.id}`,
      });
    } finally {
      await scheduler.close();
    }
  }),
);

/**
 * POST /admin/feed-management/trigger-full-redistribution
 * Re-distribute feeds for ALL recent posts (use with caution)
 */
router.post(
  '/trigger-full-redistribution',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;

    const recentPosts = await prisma.contentPost.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      },
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
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    if (recentPosts.length === 0) {
      return res.json({
        success: true,
        message: 'No recent posts found for redistribution',
        data: { queuedCount: 0 },
      });
    }

    const scheduler = new FeedDistributionScheduler();
    let queuedCount = 0;

    try {
      for (const post of recentPosts) {
        await scheduler.queueFeedDistribution(
          post.id,
          post.userId,
          {
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
          },
          'fast',
        );
        queuedCount++;
      }

      await prisma.adminLog.create({
        data: {
          adminId: adminId || 'system',
          action: 'FEED_FULL_REDISTRIBUTION_TRIGGERED',
          description: `Full redistribution triggered for ${queuedCount} recent posts`,
          entityType: 'feed',
          entityId: 0,
        },
      });

      logger.info('Admin triggered full feed redistribution', { adminId, queuedCount });

      return res.json({
        success: true,
        message: `Feed redistribution queued for ${queuedCount} recent posts`,
        data: { queuedCount },
      });
    } finally {
      await scheduler.close();
    }
  }),
);

/**
 * POST /admin/feed-management/refresh-user-feed
 * Clear and regenerate feed for a specific user
 */
router.post(
  '/refresh-user-feed',
  validateBody(TriggerUserFeedRefreshSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    const { userId } = TriggerUserFeedRefreshSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const deleted = await prisma.feed.deleteMany({ where: { userId } });

    await prisma.profile.updateMany({
      where: { userId },
      data: { unseenFeedCount: 0 } as Parameters<typeof prisma.profile.updateMany>[0]['data'],
    });

    const recentPosts = await prisma.contentPost.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        userId: { not: userId },
      },
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
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const scheduler = new FeedDistributionScheduler();
    let queuedCount = 0;

    try {
      for (const post of recentPosts) {
        await scheduler.queueFeedDistribution(
          post.id,
          post.userId,
          {
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
          },
          'full',
        );
        queuedCount++;
      }
    } finally {
      await scheduler.close();
    }

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'FEED_USER_REFRESH',
        description: `Feed refreshed for user ${userId}. Deleted: ${deleted.count}, Queued: ${queuedCount}`,
        entityType: 'feed',
        entityId: 0,
      },
    });

    logger.info('Admin refreshed user feed', {
      adminId,
      userId,
      deletedFeeds: deleted.count,
      queuedPosts: queuedCount,
    });

    return res.json({
      success: true,
      message: `User feed refreshed. Deleted ${deleted.count} old feeds, queued ${queuedCount} posts for redistribution`,
      data: { deletedFeeds: deleted.count, queuedPosts: queuedCount },
    });
  }),
);

// ==================== Users with Empty Feeds ====================

/**
 * GET /admin/feed-management/empty-feed-users
 * Get list of active users with no feed entries (cold start problem)
 */
router.get(
  '/empty-feed-users',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    interface EmptyFeedUserRow {
      id: string;
      email: string;
      user_name: string | null;
      display_name: string | null;
      created_at: Date;
      trust_count: bigint;
      inventory_count: bigint;
      has_preferences: boolean;
    }

    const emptyFeedUsers = await prisma.$queryRawUnsafe<EmptyFeedUserRow[]>(
      `SELECT
        u.id,
        u.email,
        p.user_name,
        p.display_name,
        u.created_at,
        (SELECT COUNT(*) FROM trust_relations WHERE truster_id = u.id) as trust_count,
        (SELECT COUNT(*) FROM inventories WHERE user_id = u.id) as inventory_count,
        EXISTS(SELECT 1 FROM user_feed_preferences WHERE user_id = u.id) as has_preferences
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      LEFT JOIN feeds f ON f.user_id = u.id
      WHERE u.status = 'ACTIVE' AND f.id IS NULL
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2`,
      limit,
      offset,
    );

    const totalResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(DISTINCT u.id) as count
       FROM users u
       LEFT JOIN feeds f ON f.user_id = u.id
       WHERE u.status = 'ACTIVE' AND f.id IS NULL`,
    );

    const total = Number(totalResult[0]?.count ?? 0);

    const users = emptyFeedUsers.map((u: EmptyFeedUserRow) => ({
      id: u.id,
      email: u.email,
      username: u.user_name,
      displayName: u.display_name,
      createdAt: u.created_at,
      trustCount: Number(u.trust_count),
      inventoryCount: Number(u.inventory_count),
      hasPreferences: u.has_preferences,
    }));

    return res.json({
      success: true,
      data: users,
      pagination: { total, limit, offset },
    });
  }),
);

/**
 * POST /admin/feed-management/seed-empty-feeds
 * Seed feeds for all users that currently have empty feeds
 */
router.post(
  '/seed-empty-feeds',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;

    const emptyFeedUserIds = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT u.id
       FROM users u
       LEFT JOIN feeds f ON f.user_id = u.id
       WHERE u.status = 'ACTIVE' AND f.id IS NULL
       LIMIT 500`,
    );

    if (emptyFeedUserIds.length === 0) {
      return res.json({
        success: true,
        message: 'No users with empty feeds found',
        data: { usersProcessed: 0, postsQueued: 0 },
      });
    }

    const recentPosts = await prisma.contentPost.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
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
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (recentPosts.length === 0) {
      return res.json({
        success: true,
        message: 'No recent posts available for seeding',
        data: { usersProcessed: emptyFeedUserIds.length, postsQueued: 0 },
      });
    }

    const scheduler = new FeedDistributionScheduler();
    let queuedCount = 0;

    try {
      for (const post of recentPosts) {
        await scheduler.queueFeedDistribution(
          post.id,
          post.userId,
          {
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
          },
          'full',
        );
        queuedCount++;
      }
    } finally {
      await scheduler.close();
    }

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'FEED_SEED_EMPTY_FEEDS',
        description: `Seeded feeds for ${emptyFeedUserIds.length} users with ${queuedCount} posts`,
        entityType: 'feed',
        entityId: 0,
      },
    });

    logger.info('Admin seeded empty feeds', {
      adminId,
      usersProcessed: emptyFeedUserIds.length,
      postsQueued: queuedCount,
    });

    return res.json({
      success: true,
      message: `Feed seeding queued: ${queuedCount} posts will be distributed to ${emptyFeedUserIds.length} users`,
      data: { usersProcessed: emptyFeedUserIds.length, postsQueued: queuedCount },
    });
  }),
);

/**
 * POST /admin/feed-management/clean-queue
 * Clean feed distribution queue (remove waiting/completed/failed jobs)
 */
router.post(
  '/clean-queue',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    const scheduler = new FeedDistributionScheduler();

    try {
      await scheduler.cleanQueue();

      await prisma.adminLog.create({
        data: {
          adminId: adminId || 'system',
          action: 'FEED_QUEUE_CLEANED',
          description: 'Feed distribution queue cleaned from admin panel',
          entityType: 'feed',
          entityId: 0,
        },
      });

      logger.info('Admin cleaned feed queue', { adminId });

      return res.json({
        success: true,
        message: 'Feed distribution queue has been cleaned',
      });
    } finally {
      await scheduler.close();
    }
  }),
);

// ==================== Cleanup Toggle ====================

/**
 * GET /admin/feed-management/cleanup-status
 * Get the current status of the automatic feed cleanup
 */
router.get(
  '/cleanup-status',
  asyncHandler(async (_req: Request, res: Response) => {
    const cacheService = CacheService.getInstance();
    const enabled = await cacheService.get<string>(FEED_CLEANUP_ENABLED_KEY);
    const isEnabled = enabled !== 'false';

    return res.json({
      success: true,
      data: { cleanupEnabled: isEnabled },
    });
  }),
);

/**
 * POST /admin/feed-management/toggle-cleanup
 * Enable or disable the automatic daily feed cleanup
 */
router.post(
  '/toggle-cleanup',
  validateBody(z.object({ enabled: z.boolean() })),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);

    const cacheService = CacheService.getInstance();
    await cacheService.set(FEED_CLEANUP_ENABLED_KEY, enabled ? 'true' : 'false', 30 * 24 * 3600);

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: enabled ? 'FEED_CLEANUP_ENABLED' : 'FEED_CLEANUP_DISABLED',
        description: `Automatic feed cleanup ${enabled ? 'enabled' : 'disabled'} from admin panel`,
        entityType: 'feed',
        entityId: 0,
      },
    });

    logger.info('Admin toggled feed cleanup', { adminId, enabled });

    return res.json({
      success: true,
      message: `Automatic feed cleanup has been ${enabled ? 'enabled' : 'disabled'}`,
      data: { cleanupEnabled: enabled },
    });
  }),
);

export default router;
