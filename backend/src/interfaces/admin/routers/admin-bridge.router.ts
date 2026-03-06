import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError, ValidationError } from '../../../infrastructure/errors/custom-errors';
import logger from '../../../infrastructure/logger/logger';
import { z } from 'zod';

const router = Router();
const prisma = getPrisma();

/**
 * Bridge Program Management Router
 * Routes are mounted at /admin/bridge
 */

// ==================== Schemas ====================

const AdminBridgePostsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  brandId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  search: z.string().optional(),
  sort: z.enum(['createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const AdminBridgeLeaderboardsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  brandId: z.string().uuid().optional(),
  period: z.enum(['WEEKLY', 'MONTHLY']).optional(),
  sort: z.enum(['score', 'rank', 'recordedAt']).default('score'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const AdminBridgeRewardsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  brandId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  sort: z.enum(['awardedAt', 'createdAt']).default('awardedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const AdminBridgeUserStatsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  brandId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  sort: z.enum(['trustScore', 'commentsCount', 'lastInteractionAt']).default('trustScore'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const AdminCreateBridgeRewardSchema = z.object({
  userId: z.string().uuid(),
  brandId: z.string().uuid(),
  badgeId: z.string().uuid(),
});

const AdminUpdateLeaderboardSchema = z.object({
  score: z.number().min(0).optional(),
  rank: z.number().int().min(0).optional(),
});

// ==================== Stats ====================

router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [postsTotal, leaderboardEntries, rewardsTotal, activeUsers] = await Promise.all([
      prisma.bridgePost.count(),
      prisma.bridgeLeaderboard.count(),
      prisma.bridgeReward.count(),
      prisma.bridgeUserStats.count(),
    ]);

    return res.json({
      success: true,
      data: { postsTotal, leaderboardEntries, rewardsTotal, activeUsers },
    });
  }),
);

// ==================== Posts ====================

router.get(
  '/posts',
  validateQuery(AdminBridgePostsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminBridgePostsQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.brandId) where.brandId = query.brandId;
    if (query.userId) where.userId = query.userId;
    if (query.search) {
      where.content = { contains: query.search, mode: 'insensitive' };
    }

    const [posts, total] = await Promise.all([
      prisma.bridgePost.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order },
        include: {
          brand: { select: { id: true, name: true } },
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { userName: true, displayName: true } },
            },
          },
        },
      }),
      prisma.bridgePost.count({ where }),
    ]);

    const data = posts.map((p) => ({
      id: p.id,
      content: p.content,
      brandId: p.brandId,
      brandName: p.brand.name,
      userId: p.userId,
      userName: p.user.profile?.userName ?? p.user.email,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    return res.json({
      success: true,
      data,
      pagination: { total, limit: query.limit, offset: query.offset },
    });
  }),
);

router.get(
  '/posts/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const post = await prisma.bridgePost.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true } },
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { userName: true, displayName: true } },
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundError('Bridge post not found');
    }

    return res.json({
      success: true,
      data: {
        id: post.id,
        content: post.content,
        brandId: post.brandId,
        brandName: post.brand.name,
        userId: post.userId,
        userName: post.user.profile?.userName ?? post.user.email,
        displayName: post.user.profile?.displayName ?? null,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      },
    });
  }),
);

router.delete(
  '/posts/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    const post = await prisma.bridgePost.findUnique({ where: { id } });
    if (!post) {
      throw new NotFoundError('Bridge post not found');
    }

    await prisma.bridgePost.delete({ where: { id } });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'BRIDGE_POST_DELETE',
        description: `Deleted bridge post ${id}`,
        entityType: 'bridge_post',
        entityId: 0,
      },
    });

    logger.info('Admin deleted bridge post', { adminId, postId: id });

    return res.json({ success: true, message: 'Bridge post deleted successfully' });
  }),
);

// ==================== Leaderboards ====================

router.get(
  '/leaderboards',
  validateQuery(AdminBridgeLeaderboardsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminBridgeLeaderboardsQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.brandId) where.brandId = query.brandId;
    if (query.period) where.period = query.period;

    const [entries, total] = await Promise.all([
      prisma.bridgeLeaderboard.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order },
        include: {
          brand: { select: { id: true, name: true } },
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { userName: true, displayName: true } },
            },
          },
        },
      }),
      prisma.bridgeLeaderboard.count({ where }),
    ]);

    const data = entries.map((e) => ({
      id: e.id,
      brandId: e.brandId,
      brandName: e.brand.name,
      userId: e.userId,
      userName: e.user.profile?.userName ?? e.user.email,
      period: e.period,
      rank: e.rank,
      score: e.score,
      recordedAt: e.recordedAt.toISOString(),
      createdAt: e.createdAt.toISOString(),
    }));

    return res.json({
      success: true,
      data,
      pagination: { total, limit: query.limit, offset: query.offset },
    });
  }),
);

router.patch(
  '/leaderboards/:id',
  validateBody(AdminUpdateLeaderboardSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    const body = AdminUpdateLeaderboardSchema.parse(req.body);

    const existing = await prisma.bridgeLeaderboard.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Leaderboard entry not found');
    }

    const updateData: Record<string, unknown> = {};
    if (body.score !== undefined) updateData.score = body.score;
    if (body.rank !== undefined) updateData.rank = body.rank;

    const updated = await prisma.bridgeLeaderboard.update({
      where: { id },
      data: updateData,
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'BRIDGE_LEADERBOARD_UPDATE',
        description: `Updated bridge leaderboard ${id}`,
        entityType: 'bridge_leaderboard',
        entityId: 0,
      },
    });

    logger.info('Admin updated bridge leaderboard', { adminId, entryId: id, changes: body });

    return res.json({
      success: true,
      data: {
        id: updated.id,
        score: updated.score,
        rank: updated.rank,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  }),
);

// ==================== Rewards ====================

router.get(
  '/rewards',
  validateQuery(AdminBridgeRewardsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminBridgeRewardsQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.brandId) where.brandId = query.brandId;
    if (query.userId) where.userId = query.userId;

    const [rewards, total] = await Promise.all([
      prisma.bridgeReward.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order },
        include: {
          brand: { select: { id: true, name: true } },
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { userName: true, displayName: true } },
            },
          },
          badge: { select: { id: true, name: true, imageUrl: true } },
        },
      }),
      prisma.bridgeReward.count({ where }),
    ]);

    const data = rewards.map((r) => ({
      id: r.id,
      brandId: r.brandId,
      brandName: r.brand.name,
      userId: r.userId,
      userName: r.user.profile?.userName ?? r.user.email,
      badgeId: r.badgeId,
      badgeName: r.badge.name,
      badgeImageUrl: r.badge.imageUrl,
      awardedAt: r.awardedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    }));

    return res.json({
      success: true,
      data,
      pagination: { total, limit: query.limit, offset: query.offset },
    });
  }),
);

router.post(
  '/rewards',
  validateBody(AdminCreateBridgeRewardSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    const body = AdminCreateBridgeRewardSchema.parse(req.body);

    // Verify entities exist
    const [user, brand, badge] = await Promise.all([
      prisma.user.findUnique({ where: { id: body.userId } }),
      prisma.brand.findUnique({ where: { id: body.brandId } }),
      prisma.badge.findUnique({ where: { id: body.badgeId } }),
    ]);

    if (!user) throw new ValidationError('User not found');
    if (!brand) throw new ValidationError('Brand not found');
    if (!badge) throw new ValidationError('Badge not found');

    const reward = await prisma.bridgeReward.create({
      data: {
        userId: body.userId,
        brandId: body.brandId,
        badgeId: body.badgeId,
      },
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'BRIDGE_REWARD_CREATE',
        description: `Awarded bridge reward to user ${body.userId} (brand: ${brand.name}, badge: ${badge.name})`,
        entityType: 'bridge_reward',
        entityId: 0,
      },
    });

    logger.info('Admin created bridge reward', { adminId, rewardId: reward.id });

    return res.status(201).json({
      success: true,
      data: {
        id: reward.id,
        userId: reward.userId,
        brandId: reward.brandId,
        badgeId: reward.badgeId,
        awardedAt: reward.awardedAt.toISOString(),
        createdAt: reward.createdAt.toISOString(),
      },
    });
  }),
);

// ==================== User Stats ====================

router.get(
  '/user-stats',
  validateQuery(AdminBridgeUserStatsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminBridgeUserStatsQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.brandId) where.brandId = query.brandId;
    if (query.userId) where.userId = query.userId;

    const [stats, total] = await Promise.all([
      prisma.bridgeUserStats.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order },
        include: {
          brand: { select: { id: true, name: true } },
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { userName: true, displayName: true } },
            },
          },
        },
      }),
      prisma.bridgeUserStats.count({ where }),
    ]);

    const data = stats.map((s) => ({
      id: s.id,
      brandId: s.brandId,
      brandName: s.brand.name,
      userId: s.userId,
      userName: s.user.profile?.userName ?? s.user.email,
      commentsCount: s.commentsCount,
      surveysParticipated: s.surveysParticipated,
      trustScore: s.trustScore,
      lastInteractionAt: s.lastInteractionAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));

    return res.json({
      success: true,
      data,
      pagination: { total, limit: query.limit, offset: query.offset },
    });
  }),
);

export default router;
