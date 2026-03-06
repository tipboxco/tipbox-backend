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
 * Comparison Metrics Management Router
 * Routes are mounted at /admin/comparison-metrics
 */

// ==================== Schemas ====================

const AdminComparisonMetricsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  search: z.string().optional(),
  sort: z.enum(['createdAt', 'name']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const AdminCreateComparisonMetricSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(2000).nullable().optional(),
});

const AdminUpdateComparisonMetricSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
});

// ==================== CRUD ====================

router.get(
  '/',
  validateQuery(AdminComparisonMetricsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminComparisonMetricsQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [metrics, total] = await Promise.all([
      prisma.comparisonMetric.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order },
        include: { _count: { select: { comparisonScores: true } } },
      }),
      prisma.comparisonMetric.count({ where }),
    ]);

    const data = metrics.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      usageCount: m._count.comparisonScores,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }));

    return res.json({
      success: true,
      data,
      pagination: { total, limit: query.limit, offset: query.offset },
    });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const metric = await prisma.comparisonMetric.findUnique({
      where: { id },
      include: { _count: { select: { comparisonScores: true } } },
    });

    if (!metric) {
      throw new NotFoundError('Comparison metric not found');
    }

    return res.json({
      success: true,
      data: {
        id: metric.id,
        name: metric.name,
        description: metric.description,
        usageCount: metric._count.comparisonScores,
        createdAt: metric.createdAt.toISOString(),
        updatedAt: metric.updatedAt.toISOString(),
      },
    });
  }),
);

router.post(
  '/',
  validateBody(AdminCreateComparisonMetricSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    const body = AdminCreateComparisonMetricSchema.parse(req.body);

    const metric = await prisma.comparisonMetric.create({
      data: {
        name: body.name,
        description: body.description ?? null,
      },
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'COMPARISON_METRIC_CREATE',
        description: `Created comparison metric: ${body.name}`,
        entityType: 'comparison_metric',
        entityId: 0,
      },
    });

    logger.info('Admin created comparison metric', { adminId, metricId: metric.id, name: body.name });

    return res.status(201).json({
      success: true,
      data: {
        id: metric.id,
        name: metric.name,
        description: metric.description,
        createdAt: metric.createdAt.toISOString(),
      },
    });
  }),
);

router.patch(
  '/:id',
  validateBody(AdminUpdateComparisonMetricSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    const body = AdminUpdateComparisonMetricSchema.parse(req.body);

    const existing = await prisma.comparisonMetric.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Comparison metric not found');
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description ?? null;

    const updated = await prisma.comparisonMetric.update({
      where: { id },
      data: updateData,
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'COMPARISON_METRIC_UPDATE',
        description: `Updated comparison metric ${id}`,
        entityType: 'comparison_metric',
        entityId: 0,
      },
    });

    logger.info('Admin updated comparison metric', { adminId, metricId: id, changes: body });

    return res.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    const metric = await prisma.comparisonMetric.findUnique({
      where: { id },
      include: { _count: { select: { comparisonScores: true } } },
    });

    if (!metric) {
      throw new NotFoundError('Comparison metric not found');
    }

    if (metric._count.comparisonScores > 0) {
      throw new ValidationError(
        `Cannot delete: metric is used in ${metric._count.comparisonScores} comparison scores.`,
      );
    }

    await prisma.comparisonMetric.delete({ where: { id } });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'COMPARISON_METRIC_DELETE',
        description: `Deleted comparison metric: ${metric.name}`,
        entityType: 'comparison_metric',
        entityId: 0,
      },
    });

    logger.info('Admin deleted comparison metric', { adminId, metricId: id });

    return res.json({ success: true, message: 'Comparison metric deleted successfully' });
  }),
);

export default router;
