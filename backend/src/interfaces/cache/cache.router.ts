import { Router, Request, Response } from 'express';
import { authMiddleware } from '../auth/auth.middleware';
import { requireRole } from '../../infrastructure/middleware/rbac.middleware';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { cacheMetrics } from '../../infrastructure/cache/cache-metrics';
import { CacheService } from '../../infrastructure/cache/cache.service';
import {
  invalidateUserCache,
  invalidatePostCache,
  invalidateUserFeedCache,
  invalidateTrendingCache,
  invalidateCategoryCache,
  invalidateAllUserCache,
} from '../../infrastructure/cache/cache-invalidation';
import logger from '../../infrastructure/logger/logger';

const router = Router();
const cacheService = CacheService.getInstance();

/**
 * @openapi
 * /api/cache/metrics:
 *   get:
 *     summary: Cache metrics'lerini döndürür (Admin only)
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache metrics
 */
router.get(
  '/metrics',
  authMiddleware,
  requireRole('ADMIN'),
  (req: Request, res: Response) => {
    const metrics = cacheMetrics.getMetrics();
    
    return res.json({
      success: true,
      data: {
        ...metrics,
        cacheConnected: cacheService.isCacheConnected(),
        timestamp: new Date().toISOString(),
      },
    });
  }
);

/**
 * @openapi
 * /api/cache/metrics/reset:
 *   post:
 *     summary: Cache metrics'lerini sıfırlar (Admin only)
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics reset edildi
 */
router.post(
  '/metrics/reset',
  authMiddleware,
  requireRole('ADMIN'),
  (req: Request, res: Response) => {
    cacheMetrics.reset();
    
    logger.info({
      message: 'Cache metrics reset',
      adminId: req.user?.id,
    });
    
    return res.json({
      success: true,
      message: 'Cache metrics reset successfully',
    });
  }
);

/**
 * @openapi
 * /api/cache/invalidate/user/{userId}:
 *   delete:
 *     summary: Belirli bir user'ın cache'ini temizler (Admin only)
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User cache temizlendi
 */
router.delete(
  '/invalidate/user/:userId',
  authMiddleware,
  requireRole('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    
    await invalidateUserCache(userId);
    
    logger.info({
      message: 'User cache invalidated by admin',
      userId,
      adminId: req.user?.id,
    });
    
    return res.json({
      success: true,
      message: `User cache invalidated for userId: ${userId}`,
    });
  })
);

/**
 * @openapi
 * /api/cache/invalidate/post/{postId}:
 *   delete:
 *     summary: Belirli bir post'un cache'ini temizler (Admin only)
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post cache temizlendi
 */
router.delete(
  '/invalidate/post/:postId',
  authMiddleware,
  requireRole('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { postId } = req.params;
    
    await invalidatePostCache(postId);
    
    logger.info({
      message: 'Post cache invalidated by admin',
      postId,
      adminId: req.user?.id,
    });
    
    return res.json({
      success: true,
      message: `Post cache invalidated for postId: ${postId}`,
    });
  })
);

/**
 * @openapi
 * /api/cache/invalidate/feed/{userId}:
 *   delete:
 *     summary: Belirli bir user'ın feed cache'ini temizler (Admin only)
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Feed cache temizlendi
 */
router.delete(
  '/invalidate/feed/:userId',
  authMiddleware,
  requireRole('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    
    await invalidateUserFeedCache(userId);
    
    logger.info({
      message: 'Feed cache invalidated by admin',
      userId,
      adminId: req.user?.id,
    });
    
    return res.json({
      success: true,
      message: `Feed cache invalidated for userId: ${userId}`,
    });
  })
);

/**
 * @openapi
 * /api/cache/invalidate/trending:
 *   delete:
 *     summary: Trending cache'ini temizler (Admin only)
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trending cache temizlendi
 */
router.delete(
  '/invalidate/trending',
  authMiddleware,
  requireRole('ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    await invalidateTrendingCache();

    logger.info({
      message: 'Trending cache invalidated by admin',
      adminId: req.user?.id,
    });

    return res.json({
      success: true,
      message: 'Trending cache invalidated',
    });
  })
);

/**
 * @openapi
 * /api/cache/status:
 *   get:
 *     summary: Cache connection durumunu döndürür
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache status
 */
router.get(
  '/status',
  authMiddleware,
  requireRole('ADMIN'),
  (req: Request, res: Response) => {
    const isConnected = cacheService.isCacheConnected();
    
    return res.json({
      success: true,
      data: {
        connected: isConnected,
        status: isConnected ? 'healthy' : 'disconnected',
        timestamp: new Date().toISOString(),
      },
    });
  }
);

export default router;

