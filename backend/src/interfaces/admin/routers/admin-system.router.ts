import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError, ValidationError } from '../../../infrastructure/errors/custom-errors';
import logger from '../../../infrastructure/logger/logger';
import { CacheService } from '../../../infrastructure/cache/cache.service';

// Import schemas
import {
  AdminActionTypesQuerySchema,
  AdminCreateActionTypeSchema,
  AdminUpdateActionTypeSchema,
  AdminUpdateSystemConfigSchema,
} from '../schemas/admin-system.schemas';

// Import DTOs
import type {
  AdminActionTypeListItem,
  AdminSystemConfigResponse,
  AdminSystemHealthResponse,
  AdminSystemMetricsResponse,
  AdminCreateActionTypeInput,
  AdminUpdateActionTypeInput,
  AdminUpdateSystemConfigInput,
} from '../dtos/admin-system.dto';

const router = Router();
const prisma = getPrisma();

/**
 * System Configuration Management Router
 * Routes are mounted at /admin/system
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

// ==================== Action Types ====================

/**
 * GET /admin/system/action-types
 * List action types
 */
router.get(
  '/action-types',
  validateQuery(AdminActionTypesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      mainAction?: string;
      search?: string;
    };

    const where: Record<string, unknown> = {};
    if (q.mainAction) where.mainAction = q.mainAction;
    if (q.search) {
      where.OR = [
        { code: { contains: q.search, mode: 'insensitive' } },
        { label: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const actionTypes = await prisma.actionType.findMany({
      where,
      orderBy: { mainAction: 'asc' },
      include: {
        _count: {
          select: { actionLogs: true },
        },
      },
    });

    const data: AdminActionTypeListItem[] = actionTypes.map((actionType) => ({
      id: actionType.id,
      mainAction: actionType.mainAction,
      code: actionType.code,
      label: actionType.label,
      usageCount: actionType._count.actionLogs,
      createdAt: actionType.createdAt.toISOString(),
      updatedAt: actionType.updatedAt.toISOString(),
    }));

    return res.json({ success: true, data });
  })
);

/**
 * POST /admin/system/action-types
 * Create action type
 */
router.post(
  '/action-types',
  validateBody(AdminCreateActionTypeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const body = req.body as AdminCreateActionTypeInput;

    // Check if action type already exists
    const existing = await prisma.actionType.findFirst({
      where: {
        mainAction: body.mainAction,
        code: body.code,
      },
    });

    if (existing) {
      throw new ValidationError('Action type with this main action and code already exists');
    }

    const actionType = await prisma.actionType.create({
      data: {
        mainAction: body.mainAction,
        code: body.code,
        label: body.label,
      },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'ACTION_TYPE_CREATE',
        description: `actionTypeId: ${actionType.id}, mainAction: ${actionType.mainAction}, code: ${actionType.code}`,
        entityType: 'action_type',
        entityId: 0,
      },
    });

    logger.info('Action type created', { actionTypeId: actionType.id, adminId });

    return res.status(201).json({ success: true, data: actionType });
  })
);

/**
 * PATCH /admin/system/action-types/:id
 * Update action type
 */
router.patch(
  '/action-types/:id',
  validateBody(AdminUpdateActionTypeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminUpdateActionTypeInput;

    const existing = await prisma.actionType.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Action type not found');
    }

    const actionType = await prisma.actionType.update({
      where: { id },
      data: body,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'ACTION_TYPE_UPDATE',
        description: `actionTypeId: ${actionType.id}, label: ${actionType.label}`,
        entityType: 'action_type',
        entityId: 0,
      },
    });

    logger.info('Action type updated', { actionTypeId: actionType.id, adminId });

    return res.json({ success: true, data: actionType });
  })
);

/**
 * DELETE /admin/system/action-types/:id
 * Delete action type
 */
router.delete(
  '/action-types/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;

    const existing = await prisma.actionType.findUnique({
      where: { id },
      include: {
        _count: { select: { actionLogs: true } },
      },
    });

    if (!existing) {
      throw new NotFoundError('Action type not found');
    }

    if (existing._count.actionLogs > 0) {
      throw new ValidationError(
        `Cannot delete action type with ${existing._count.actionLogs} action logs. Archive it instead.`
      );
    }

    await prisma.actionType.delete({ where: { id } });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'ACTION_TYPE_DELETE',
        description: `actionTypeId: ${id}, code: ${existing.code}`,
        entityType: 'action_type',
        entityId: 0,
      },
    });

    logger.info('Action type deleted', { actionTypeId: id, adminId });

    return res.json({ success: true, message: 'Action type deleted' });
  })
);

// ==================== System Configuration ====================

/**
 * GET /admin/system/config
 * Get system configuration
 */
router.get(
  '/config',
  asyncHandler(async (req: Request, res: Response) => {
    // In a real system, this would fetch from a SystemConfig table
    // For now, return placeholder config
    const configs = [
      {
        key: 'MAX_UPLOAD_SIZE',
        value: '10485760', // 10MB
        description: 'Maximum file upload size in bytes',
      },
      {
        key: 'MAINTENANCE_MODE',
        value: 'false',
        description: 'Enable maintenance mode',
      },
      {
        key: 'REGISTRATION_ENABLED',
        value: 'true',
        description: 'Allow new user registration',
      },
    ];

    const data: AdminSystemConfigResponse = {
      configs,
    };

    return res.json({ success: true, data });
  })
);

/**
 * PATCH /admin/system/config
 * Update system configuration
 */
router.patch(
  '/config',
  validateBody(AdminUpdateSystemConfigSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const body = req.body as AdminUpdateSystemConfigInput;

    // In a real system, this would update a SystemConfig table
    // For now, just log the action

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'SYSTEM_CONFIG_UPDATE',
        description: `key: ${body.key}, value: ${body.value}`,
        entityType: 'system_config',
        entityId: 0,
      },
    });

    logger.info('System config updated', {
      key: body.key,
      value: body.value,
      adminId,
    });

    return res.json({
      success: true,
      message: `System config ${body.key} updated`,
      data: { key: body.key, value: body.value },
    });
  })
);

// ==================== System Health & Metrics ====================

/**
 * GET /admin/system/health
 * System health check
 */
router.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();

    // Check database
    let dbStatus: 'connected' | 'disconnected' = 'connected';
    let dbResponseTime = 0;
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbResponseTime = Date.now() - dbStart;
    } catch (error) {
      dbStatus = 'disconnected';
    }

    // Check Redis
    let redisStatus: 'connected' | 'disconnected' = 'connected';
    let redisResponseTime = 0;
    try {
      const cacheService = CacheService.getInstance();
      const redisStart = Date.now();
      await cacheService.ping();
      redisResponseTime = Date.now() - redisStart;
    } catch (error) {
      redisStatus = 'disconnected';
    }

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (dbStatus === 'disconnected' && redisStatus === 'disconnected') {
      status = 'down';
    } else if (dbStatus === 'disconnected' || redisStatus === 'disconnected') {
      status = 'degraded';
    }

    const data: AdminSystemHealthResponse = {
      status,
      uptime: process.uptime(),
      database: {
        status: dbStatus,
        responseTime: dbResponseTime,
      },
      redis: {
        status: redisStatus,
        responseTime: redisResponseTime,
      },
      timestamp: new Date().toISOString(),
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/system/metrics
 * System metrics (Prometheus-style)
 */
router.get(
  '/metrics',
  asyncHandler(async (req: Request, res: Response) => {
    // Get counts
    const [
      totalUsers,
      totalPosts,
      totalComments,
      totalTransactions,
      newUsersToday,
      postsToday,
      transactionsToday,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.contentPost.count(),
      prisma.contentComment.count(),
      prisma.nFTTransaction.count(),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.contentPost.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.nFTTransaction.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    // Active users (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers = await prisma.user.count({
      where: {
        updatedAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    // Transaction volume
    const transactionVolume = await prisma.nFTTransaction.aggregate({
      _sum: { price: true },
    });

    const data: AdminSystemMetricsResponse = {
      users: {
        total: totalUsers,
        active: activeUsers,
        newToday: newUsersToday,
      },
      content: {
        totalPosts,
        postsToday,
        totalComments,
      },
      transactions: {
        totalVolume: transactionVolume._sum.price || 0,
        transactionsToday,
      },
      performance: {
        avgResponseTime: 0, // Would need request tracking
        requestCount: 0, // Would need request tracking
      },
    };

    return res.json({ success: true, data });
  })
);

export default router;
