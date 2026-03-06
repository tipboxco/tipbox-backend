import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError } from '../../../infrastructure/errors/custom-errors';
import logger from '../../../infrastructure/logger/logger';

import type { PaginationMeta } from '../dtos/admin-common.dto';
import type { AdminUserProgressListItem } from '../dtos/admin-badges.dto';
import { AdminUserProgressQuerySchema } from '../schemas/admin-badges.schemas';

const router = Router();
const prisma = getPrisma();

/**
 * Gamification Router - Handles gamification analytics and progress
 * Routes are mounted at /admin/gamification
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

// ==================== Gamification Admin Endpoints ====================

/**
 * GET /admin/action-logs
 * View user action history (audit trail)
 */
router.get(
  '/action-logs',
  asyncHandler(async (req: Request, res: Response) => {
    const { ActionLogService } = await import('../../../application/gamification/action-log.service');
    const { MainAction } = await import('../../../domain/gamification/main-action.enum');

    const actionLogService = new ActionLogService();
    const filters = {
      userId: req.query.userId as string,
      mainAction: req.query.mainAction as typeof MainAction[keyof typeof MainAction],
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const logs = await actionLogService.getUserActionHistory(filters.userId, filters);

    return res.json({ success: true, data: { logs } });
  })
);

/**
 * GET /admin/users/:userId/progress
 * View user's complete achievement progress
 */
router.get(
  '/users/:userId/progress',
  asyncHandler(async (req: Request, res: Response) => {
    const { GamificationService } = await import('../../../application/gamification/gamification.service');

    const userId = req.params.userId;
    const gamificationService = new GamificationService();

    const achievements = await gamificationService.getUserAchievements(userId);
    const stats = await gamificationService.getUserGamificationStats(userId);

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        profile: { select: { username: true } },
        email: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.profile?.username || 'Unknown',
          email: user.email,
        },
        achievements,
        stats: {
          totalBadges: stats.badges.total,
          totalAchievements: stats.achievements.total,
          completionRate:
            stats.achievements.total > 0
              ? (stats.achievements.completed / stats.achievements.total) * 100
              : 0,
        },
      },
    });
  })
);

/**
 * POST /admin/users/:userId/backfill-progress
 * Backfill achievement progress from existing data
 */
router.post(
  '/users/:userId/backfill-progress',
  asyncHandler(async (req: Request, res: Response) => {
    const { ActionLogService } = await import('../../application/gamification/action-log.service');

    const userId = req.params.userId;
    const actionLogService = new ActionLogService();

    const achievementsUpdated = await actionLogService.backfillActionsFromExistingData(userId);

    // Log admin action
    const prisma = getPrisma();
    await prisma.adminLog.create({
      data: {
        adminId: req.user!.id,
        action: 'USER_PROGRESS_BACKFILL',
        description: `userId: ${userId}`,
        entityType: 'user',
        entityId: 0,
      },
    });

    return res.json({
      success: true,
      message: 'Progress backfilled successfully',
      data: { achievementsUpdated, badgesGranted: 0 },
    });
  })
);

/**
 * POST /admin/badges/bulk-grant
 * Grant badge to multiple users at once
 */
router.post(
  '/bulk-grant',
  asyncHandler(async (req: Request, res: Response) => {
    const { GamificationService } = await import('../../../application/gamification/gamification.service');
    const { getErrorMessage } = await import('../../infrastructure/errors/error-helper');

    const { badgeId, userIds, claimed, visibility } = req.body;
    const gamificationService = new GamificationService();
    const prisma = getPrisma();

    let successful = 0;
    let failed = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    for (const userId of userIds) {
      try {
        await gamificationService.grantBadgeToUser(userId, badgeId);

        // Update claim status and visibility if specified
        if (claimed !== undefined || visibility !== undefined) {
          const userBadge = await prisma.userBadge.findFirst({
            where: { userId, badgeId },
          });

          if (userBadge) {
            await prisma.userBadge.update({
              where: { id: userBadge.id },
              data: {
                ...(claimed !== undefined && {
                  claimed,
                  claimedAt: claimed ? new Date() : null,
                }),
                ...(visibility !== undefined && { visibility }),
              },
            });
          }
        }

        successful++;
      } catch (error) {
        failed++;
        errors.push({
          userId,
          error: getErrorMessage(error),
        });
      }
    }

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: req.user!.id,
        action: 'BADGE_BULK_GRANT',
        description: `badgeId: ${badgeId}, users: ${successful}/${userIds.length}`,
        entityType: 'badge',
        entityId: 0,
      },
    });

    return res.json({
      success: true,
      message: `Badge granted to ${successful} users`,
      data: { successful, failed, errors },
    });
  })
);

/**
 * GET /admin/gamification/analytics
 * Overall gamification analytics dashboard
 */
router.get(
  '/analytics',
  asyncHandler(async (req: Request, res: Response) => {
    const prisma = getPrisma();

    // Badge stats
    const totalBadges = await prisma.badge.count();
    const badgesByType = await prisma.badge.groupBy({
      by: ['type'],
      _count: { id: true },
    });
    const badgesByRarity = await prisma.badge.groupBy({
      by: ['rarity'],
      _count: { id: true },
    });
    const totalEarned = await prisma.userBadge.count();
    const claimedCount = await prisma.userBadge.count({ where: { claimed: true } });

    // Collection stats
    const totalCollections = await prisma.badgeCollection.count();
    const collectionGoals = await prisma.achievementGoal.groupBy({
      by: ['collectionId'],
      _count: { id: true },
    });
    const avgGoalsPerCollection =
      collectionGoals.length > 0
        ? collectionGoals.reduce((sum, c) => sum + c._count.id, 0) / collectionGoals.length
        : 0;

    // Achievement stats
    const totalAchievements = await prisma.userAchievement.count();
    const completedAchievements = await prisma.userAchievement.count({
      where: { completed: true },
    });

    // Top badges
    const topBadges = await prisma.badge.findMany({
      include: {
        _count: { select: { userBadges: true } },
      },
      orderBy: {
        userBadges: { _count: 'desc' },
      },
      take: 10,
    });

    // Recent activity
    const recentBadges = await prisma.userBadge.findMany({
      where: { claimedAt: { not: null } },
      include: {
        user: { include: { profile: true } },
        badge: true,
      },
      orderBy: { claimedAt: 'desc' },
      take: 20,
    });

    const recentActivity = recentBadges.map((ub) => ({
      userId: ub.userId,
      username: ub.user.profile?.username || 'Unknown',
      action: 'earned_badge',
      entityName: ub.badge.name,
      timestamp: ub.claimedAt!,
    }));

    return res.json({
      success: true,
      data: {
        badges: {
          total: totalBadges,
          byType: Object.fromEntries(badgesByType.map((b) => [b.type, b._count.id])),
          byRarity: Object.fromEntries(badgesByRarity.map((b) => [b.rarity, b._count.id])),
          totalEarned,
          claimRate: totalEarned > 0 ? (claimedCount / totalEarned) * 100 : 0,
        },
        collections: {
          total: totalCollections,
          avgGoalsPerCollection,
          avgBadgesPerCollection: 0,
        },
        achievements: {
          total: totalAchievements,
          completed: completedAchievements,
          completionRate:
            totalAchievements > 0 ? (completedAchievements / totalAchievements) * 100 : 0,
        },
        topBadges: topBadges.map((b) => ({
          badgeId: b.id,
          badgeName: b.name,
          earnedCount: b._count.userBadges,
        })),
        topCollections: [],
        recentActivity,
      },
    });
  })
);

/**
 * DELETE /admin/users/:userId/progress/reset
 * Reset user's achievement progress
 */
router.delete(
  '/users/:userId/progress/reset',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.userId;
    const goalId = req.query.goalId as string | undefined;
    const collectionId = req.query.collectionId as string | undefined;

    const prisma = getPrisma();

    if (goalId) {
      // Reset specific goal
      await prisma.userAchievement.deleteMany({
        where: { userId, goalId },
      });
    } else if (collectionId) {
      // Reset all goals in collection
      const goals = await prisma.achievementGoal.findMany({
        where: { collectionId },
        select: { id: true },
      });
      const goalIds = goals.map((g) => g.id);

      await prisma.userAchievement.deleteMany({
        where: { userId, goalId: { in: goalIds } },
      });
    } else {
      // Reset ALL progress
      await prisma.userAchievement.deleteMany({
        where: { userId },
      });
    }

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: req.user!.id,
        action: 'USER_PROGRESS_RESET',
        description: `userId: ${userId}, goalId: ${goalId || 'all'}, collectionId: ${
          collectionId || 'none'
        }`,
        entityType: 'user',
        entityId: 0,
      },
    });

    return res.json({ success: true, message: 'Progress reset successfully' });
  })
);

// ==================== Stats Endpoints ====================

/**
 * @swagger
 * /api/admin/gamification/user-progress/stats:
 *   get:
 *     tags: [Admin - Gamification]
 *     summary: Get user progress statistics
 *     responses:
 *       200:
 *         description: User progress stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: number
 *                       description: Total users with achievement progress
 *                     activeUsers:
 *                       type: number
 *                       description: Users with progress updated in last 30 days
 */
router.get(
  '/user-progress/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const prisma = getPrisma();

    // Count users with at least one achievement
    const totalUsers = await prisma.userAchievement
      .groupBy({
        by: ['userId'],
      })
      .then((results) => results.length);

    // Count users with progress in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeUsers = await prisma.userAchievement
      .groupBy({
        by: ['userId'],
        where: {
          completedAt: {
            gte: thirtyDaysAgo,
          },
        },
      })
      .then((results) => results.length);

    // Count users with badges
    const totalUsersWithBadges = await prisma.userBadge
      .groupBy({ by: ['userId'] })
      .then((results) => results.length);

    // Calculate average badges per user
    const totalBadges = await prisma.userBadge.count();
    const averageBadgesPerUser =
      totalUsersWithBadges > 0 ? Math.round(totalBadges / totalUsersWithBadges) : 0;

    const data = {
      totalUsers,
      activeUsers,
      totalUsersWithBadges,
      averageBadgesPerUser,
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/gamification/user-progress
 * List all users with badge ownership and achievement progress
 */
router.get(
  '/user-progress',
  validateQuery(AdminUserProgressQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const prisma = getPrisma();
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      search?: string;
      claimStatus: 'all' | 'claimed' | 'unclaimed';
      sort: string;
      order: 'asc' | 'desc';
    };

    // Build search filter
    const userWhere: { OR?: unknown[] } = {};
    if (q.search && q.search.length > 0) {
      userWhere.OR = [
        { email: { contains: q.search, mode: 'insensitive' as const } },
        { profile: { userName: { contains: q.search, mode: 'insensitive' as const } } },
        { profile: { displayName: { contains: q.search, mode: 'insensitive' as const } } },
      ];
    }

    // Fetch users with badge and achievement data
    const users = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        email: true,
        profile: {
          select: {
            userName: true,
            displayName: true,
          },
        },
        userBadges: {
          select: {
            id: true,
            claimed: true,
            claimedAt: true,
            createdAt: true,
          },
        },
        userAchievements: {
          select: {
            id: true,
            completed: true,
            completedAt: true,
          },
        },
      },
      take: q.limit,
      skip: q.offset,
    });

    // Calculate aggregates for each user
    let data: AdminUserProgressListItem[] = users.map((user) => {
      const totalBadges = user.userBadges.length;
      const claimedBadges = user.userBadges.filter((ub) => ub.claimed).length;
      const unclaimedBadges = totalBadges - claimedBadges;

      const totalAchievements = user.userAchievements.length;
      const completedAchievements = user.userAchievements.filter((ua) => ua.completed).length;
      const progressPercent =
        totalAchievements > 0 ? Math.round((completedAchievements / totalAchievements) * 100) : 0;

      // Find most recent activity
      const badgeActivities = user.userBadges
        .filter((ub) => ub.claimedAt)
        .map((ub) => ub.claimedAt!);
      const achievementActivities = user.userAchievements
        .filter((ua) => ua.completedAt)
        .map((ua) => ua.completedAt!);
      const allActivities = [...badgeActivities, ...achievementActivities];
      const lastActivity =
        allActivities.length > 0
          ? new Date(Math.max(...allActivities.map((d) => d.getTime())))
          : null;

      return {
        userId: user.id,
        email: user.email,
        userName: user.profile?.userName ?? null,
        displayName: user.profile?.displayName ?? null,
        totalBadges,
        claimedBadges,
        unclaimedBadges,
        totalAchievements,
        completedAchievements,
        progressPercent,
        lastActivity: lastActivity?.toISOString() ?? null,
      };
    });

    // Apply claim status filter
    if (q.claimStatus === 'claimed') {
      data = data.filter((u) => u.claimedBadges > 0);
    } else if (q.claimStatus === 'unclaimed') {
      data = data.filter((u) => u.unclaimedBadges > 0);
    }

    // Apply sorting
    data.sort((a, b) => {
      let comparison = 0;
      switch (q.sort) {
        case 'username':
          comparison = (a.userName ?? '').localeCompare(b.userName ?? '');
          break;
        case 'totalBadges':
          comparison = a.totalBadges - b.totalBadges;
          break;
        case 'progressPercent':
          comparison = a.progressPercent - b.progressPercent;
          break;
        case 'lastActivity':
          const aTime = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
          const bTime = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
          comparison = aTime - bTime;
          break;
      }
      return q.order === 'asc' ? comparison : -comparison;
    });

    const total = await prisma.user.count({ where: userWhere });
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };

    return res.json({ success: true, data, pagination });
  })
);

/**
 * @swagger
 * /api/admin/gamification/brand-badges/stats:
 *   get:
 *     tags: [Admin - Gamification]
 *     summary: Get brand badges statistics
 *     responses:
 *       200:
 *         description: Brand badges stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalBadges:
 *                       type: number
 *                     totalAwarded:
 *                       type: number
 */
router.get(
  '/brand-badges/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const prisma = getPrisma();

    const [totalBadges, totalAwarded] = await Promise.all([
      prisma.badge.count({
        where: { type: 'BRAND' },
      }),
      prisma.userBadge.count({
        where: {
          badge: { type: 'BRAND' },
        },
      }),
    ]);

    const data = {
      totalBadges,
      totalAwarded,
    };

    return res.json({ success: true, data });
  })
);

/**
 * @swagger
 * /api/admin/gamification/event-badges/stats:
 *   get:
 *     tags: [Admin - Gamification]
 *     summary: Get event badges statistics
 *     responses:
 *       200:
 *         description: Event badges stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalBadges:
 *                       type: number
 *                     totalAwarded:
 *                       type: number
 */
router.get(
  '/event-badges/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const prisma = getPrisma();

    const [totalBadges, totalAwarded] = await Promise.all([
      prisma.badge.count({
        where: { type: 'EVENT' },
      }),
      prisma.userBadge.count({
        where: {
          badge: { type: 'EVENT' },
        },
      }),
    ]);

    const data = {
      totalBadges,
      totalAwarded,
    };

    return res.json({ success: true, data });
  })
);

/**
 * @swagger
 * /api/admin/gamification/cosmetic-badges/stats:
 *   get:
 *     tags: [Admin - Gamification]
 *     summary: Get cosmetic badges statistics
 *     responses:
 *       200:
 *         description: Cosmetic badges stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalBadges:
 *                       type: number
 *                     totalOwned:
 *                       type: number
 */
router.get(
  '/cosmetic-badges/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const prisma = getPrisma();

    const [totalBadges, totalOwned] = await Promise.all([
      prisma.badge.count({
        where: { type: 'COSMETIC' },
      }),
      prisma.userBadge.count({
        where: {
          badge: { type: 'COSMETIC' },
        },
      }),
    ]);

    const data = {
      totalBadges,
      totalOwned,
    };

    return res.json({ success: true, data });
  })
);

export default router;
