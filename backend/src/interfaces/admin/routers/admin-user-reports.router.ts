import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError } from '../../../infrastructure/errors/custom-errors';
import logger from '../../../infrastructure/logger/logger';
import { z } from 'zod';

const router = Router();
const prisma = getPrisma();

/**
 * User Reports Management Router
 * Routes are mounted at /admin/user-reports
 *
 * UserReport schema fields:
 *   id, reportedUserId, reporterId, category, description,
 *   resolved (boolean), resolvedAt, resolvedBy (UUID), adminNote,
 *   createdAt, updatedAt
 * Relations: reportedUser, reporter
 */

// ==================== Schemas ====================

const AdminUserReportsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  resolved: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  category: z.string().optional(),
  reporterId: z.string().uuid().optional(),
  reportedUserId: z.string().uuid().optional(),
  search: z.string().optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'category']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const AdminResolveReportSchema = z.object({
  adminNote: z.string().max(2000).nullable().optional(),
});

// ==================== Stats ====================

router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [total, open, resolved, byCategory] = await Promise.all([
      prisma.userReport.count(),
      prisma.userReport.count({ where: { resolved: false } }),
      prisma.userReport.count({ where: { resolved: true } }),
      prisma.userReport.groupBy({
        by: ['category'],
        _count: { id: true },
      }),
    ]);

    const byCategoryMap = byCategory.reduce(
      (acc, item) => {
        acc[item.category] = item._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    return res.json({
      success: true,
      data: { total, open, resolved, byCategory: byCategoryMap },
    });
  }),
);

// ==================== CRUD ====================

router.get(
  '/',
  validateQuery(AdminUserReportsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminUserReportsQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.resolved !== undefined) where.resolved = query.resolved;
    if (query.category) where.category = query.category;
    if (query.reporterId) where.reporterId = query.reporterId;
    if (query.reportedUserId) where.reportedUserId = query.reportedUserId;
    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { category: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [reports, total] = await Promise.all([
      prisma.userReport.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order },
        include: {
          reporter: {
            select: {
              id: true,
              email: true,
              profile: { select: { userName: true, displayName: true } },
            },
          },
          reportedUser: {
            select: {
              id: true,
              email: true,
              profile: { select: { userName: true, displayName: true } },
            },
          },
        },
      }),
      prisma.userReport.count({ where }),
    ]);

    const data = reports.map((r) => ({
      id: r.id,
      category: r.category,
      description: r.description,
      resolved: r.resolved,
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      resolvedBy: r.resolvedBy,
      adminNote: r.adminNote,
      reporterId: r.reporterId,
      reporterName: r.reporter.profile?.userName ?? r.reporter.email,
      reportedUserId: r.reportedUserId,
      reportedUserName: r.reportedUser.profile?.userName ?? r.reportedUser.email,
      reportedUserEmail: r.reportedUser.email,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
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

    const report = await prisma.userReport.findUnique({
      where: { id },
      include: {
        reporter: {
          select: {
            id: true,
            email: true,
            profile: { select: { userName: true, displayName: true } },
          },
        },
        reportedUser: {
          select: {
            id: true,
            email: true,
            status: true,
            profile: { select: { userName: true, displayName: true } },
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundError('User report not found');
    }

    return res.json({
      success: true,
      data: {
        id: report.id,
        category: report.category,
        description: report.description,
        resolved: report.resolved,
        resolvedAt: report.resolvedAt?.toISOString() ?? null,
        resolvedBy: report.resolvedBy,
        adminNote: report.adminNote,
        reporter: {
          id: report.reporter.id,
          email: report.reporter.email,
          userName: report.reporter.profile?.userName ?? null,
          displayName: report.reporter.profile?.displayName ?? null,
        },
        reportedUser: {
          id: report.reportedUser.id,
          email: report.reportedUser.email,
          status: report.reportedUser.status,
          userName: report.reportedUser.profile?.userName ?? null,
          displayName: report.reportedUser.profile?.displayName ?? null,
        },
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString(),
      },
    });
  }),
);

router.patch(
  '/:id/resolve',
  validateBody(AdminResolveReportSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    const body = AdminResolveReportSchema.parse(req.body);

    const report = await prisma.userReport.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundError('User report not found');
    }

    const updated = await prisma.userReport.update({
      where: { id },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: adminId ?? null,
        ...(body.adminNote !== undefined ? { adminNote: body.adminNote } : {}),
      },
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'USER_REPORT_RESOLVE',
        description: `Resolved user report ${id} (category: ${report.category})`,
        entityType: 'user_report',
        entityId: 0,
      },
    });

    logger.info('Admin resolved user report', { adminId, reportId: id });

    return res.json({
      success: true,
      data: {
        id: updated.id,
        resolved: updated.resolved,
        resolvedAt: updated.resolvedAt?.toISOString() ?? null,
        resolvedBy: updated.resolvedBy,
        adminNote: updated.adminNote,
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

    const report = await prisma.userReport.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundError('User report not found');
    }

    await prisma.userReport.delete({ where: { id } });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'USER_REPORT_DELETE',
        description: `Deleted user report ${id} (category: ${report.category})`,
        entityType: 'user_report',
        entityId: 0,
      },
    });

    logger.info('Admin deleted user report', { adminId, reportId: id });

    return res.json({ success: true, message: 'User report deleted successfully' });
  }),
);

export default router;
