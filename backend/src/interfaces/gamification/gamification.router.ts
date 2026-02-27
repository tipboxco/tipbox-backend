import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { validateBody, validateQuery } from '../../infrastructure/middleware/validation.middleware';
import { GamificationService } from '../../application/gamification/gamification.service';
import { AchievementProgressService } from '../../application/gamification/achievement-progress.service';
import {
  BadgesQuerySchema,
  CollectionsQuerySchema,
  UpdateBadgeVisibilitySchema,
  UpdateBadgeDisplayOrderSchema,
  UserBadgesQuerySchema,
  UserAchievementsQuerySchema,
} from './gamification.schemas';

const router = Router();
const gamificationService = new GamificationService();
const achievementProgressService = new AchievementProgressService();

// ==================== Public Badge Endpoints ====================

/**
 * GET /api/badges
 * List all available badges with pagination and filters
 */
router.get(
  '/badges',
  validateQuery(BadgesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query;
    const badges = await gamificationService.getAllBadges(filters);

    const total = badges.length; // TODO: Get actual total count from service
    const hasMore = total >= (filters.limit || 20);

    return res.json({
      success: true,
      data: {
        badges,
        pagination: {
          total,
          limit: filters.limit || 20,
          offset: filters.offset || 0,
          hasMore,
        },
      },
    });
  })
);

/**
 * GET /api/badges/:id
 * Get detailed information about a specific badge
 */
router.get(
  '/badges/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const badgeId = req.params.id;
    const badge = await gamificationService.getBadgeById(badgeId);

    if (!badge) {
      return res.status(404).json({ success: false, message: 'Badge not found' });
    }

    return res.json({ success: true, data: badge });
  })
);

// ==================== Public Collection Endpoints ====================

/**
 * GET /api/collections
 * List all badge collections with optional user progress
 */
router.get(
  '/collections',
  validateQuery(CollectionsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      ...req.query,
      userId: req.user?.id, // Include progress if authenticated
    };

    const collections = await gamificationService.getAllCollections(filters);

    const total = collections.length;
    const hasMore = total >= (filters.limit || 20);

    return res.json({
      success: true,
      data: {
        collections,
        pagination: {
          total,
          limit: filters.limit || 20,
          offset: filters.offset || 0,
          hasMore,
        },
      },
    });
  })
);

/**
 * GET /api/collections/:id
 * Get collection details with goals and user progress.
 * Optional query: search (or q) = filter badges within this collection by name/description.
 */
router.get(
  '/collections/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const collectionId = req.params.id;
    const userId = req.user?.id;
    const search =
      typeof req.query.search === 'string'
        ? req.query.search.trim()
        : typeof req.query.q === 'string'
          ? req.query.q.trim()
          : undefined;

    const collection = await gamificationService.getCollectionById(collectionId, userId, {
      ...(search ? { badgeSearch: search } : {}),
    });

    if (!collection) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    return res.json({ success: true, data: collection });
  })
);

// ==================== User Profile Badge Endpoints (Authenticated) ====================

/**
 * GET /api/profile/badges
 * Get authenticated user's badges (claimed and unclaimed)
 */
router.get(
  '/profile/badges',
  authMiddleware,
  validateQuery(UserBadgesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const badges = await gamificationService.getUserBadges(userId);

    // Calculate summary
    const summary = {
      totalBadges: badges.length,
      claimedCount: badges.filter((b) => b.claimed).length,
      unclaimedCount: badges.filter((b) => !b.claimed).length,
      totalPoints: badges
        .filter((b) => b.claimed)
        .reduce((sum, b) => sum + b.badge.pointValue, 0),
    };

    const total = badges.length;
    const hasMore = false; // All user badges loaded

    return res.json({
      success: true,
      data: {
        badges,
        summary,
        pagination: {
          total,
          limit: req.query.limit || 50,
          offset: req.query.offset || 0,
          hasMore,
        },
      },
    });
  })
);

/**
 * POST /api/profile/badges/:badgeId/claim
 * Claim an unclaimed badge
 */
router.post(
  '/profile/badges/:badgeId/claim',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const badgeId = req.params.badgeId;

    try {
      const userBadge = await gamificationService.claimBadge(userId, badgeId);

      return res.json({
        success: true,
        message: 'Badge claimed successfully',
        data: {
          userBadgeId: userBadge.id,
          claimedAt: userBadge.claimedAt,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to claim badge';

      if (errorMessage.includes('not found')) {
        return res.status(404).json({ success: false, message: errorMessage });
      }

      if (errorMessage.includes('already claimed')) {
        return res.status(400).json({ success: false, message: errorMessage });
      }

      throw error;
    }
  })
);

/**
 * PUT /api/profile/badges/:userBadgeId/visibility
 * Update badge visibility settings
 */
router.put(
  '/profile/badges/:userBadgeId/visibility',
  authMiddleware,
  validateBody(UpdateBadgeVisibilitySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const userBadgeId = req.params.userBadgeId;
    const { visibility, isVisible } = req.body;

    try {
      await gamificationService.updateBadgeVisibility(userId, userBadgeId, visibility, isVisible);

      return res.json({ success: true, message: 'Badge visibility updated' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update visibility';

      if (errorMessage.includes('not found')) {
        return res.status(404).json({ success: false, message: errorMessage });
      }

      throw error;
    }
  })
);

/**
 * PUT /api/profile/badges/display-order
 * Update display order for profile showcase (max 6 badges)
 */
router.put(
  '/profile/badges/display-order',
  authMiddleware,
  validateBody(UpdateBadgeDisplayOrderSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { badgeOrders } = req.body;

    try {
      await gamificationService.updateBadgeDisplayOrder(userId, badgeOrders);

      return res.json({ success: true, message: 'Display order updated' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update display order';

      if (errorMessage.includes('not belong')) {
        return res.status(400).json({ success: false, message: errorMessage });
      }

      throw error;
    }
  })
);

// ==================== Achievement Progress Endpoints (Authenticated) ====================

/**
 * GET /api/profile/achievements
 * Get authenticated user's achievement progress
 */
router.get(
  '/profile/achievements',
  authMiddleware,
  validateQuery(UserAchievementsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const achievements = await gamificationService.getUserAchievements(userId);

    const summary = {
      totalAchievements: achievements.length,
      completedCount: achievements.filter((a) => a.completed).length,
      inProgressCount: achievements.filter((a) => !a.completed && a.progress > 0).length,
    };

    const total = achievements.length;
    const hasMore = false;

    return res.json({
      success: true,
      data: {
        achievements,
        summary,
        pagination: {
          total,
          limit: req.query.limit || 50,
          offset: req.query.offset || 0,
          hasMore,
        },
      },
    });
  })
);

/**
 * GET /api/profile/gamification-stats
 * Get comprehensive gamification statistics for authenticated user
 */
router.get(
  '/profile/gamification-stats',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const stats = await gamificationService.getUserGamificationStats(userId);

    return res.json({ success: true, data: stats });
  })
);

/**
 * GET /api/profile/near-completion
 * Get achievement goals near completion (80%+ progress)
 */
router.get(
  '/profile/near-completion',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const goals = await achievementProgressService.getNearCompletionGoals(userId, 0.8);

    return res.json({ success: true, data: { goals } });
  })
);

export default router;
