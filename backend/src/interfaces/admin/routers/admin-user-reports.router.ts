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
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

// ==================== Schemas ====================

const AdminUserReportsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  status: z.enum(['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED']).optional(),
  reportType: z.enum(['POST', 'COMMENT', 'USER', 'MESSAGE']).optional(),
  reporterId: z.string().uuid().optional(),
  reportedUserId: z.string().uuid().optional(),
  search: z.string().optional(),
  sort: z.enum(['createdAt', 'updatedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const AdminUpdateUserReportSchema = z.object({
  status: z.enum(['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED']).optional(),
  reviewNote: z.string().max(1000).nullable().optional(),
  reviewerId: z.string().uuid().nullable().optional(),
});

// ==================== User Reports ====================

/**
 * GET /admin/user-reports/stats
 * Get user reports statistics
 */
router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [total, pending, reviewing, resolved, dismissed, byType] = await Promise.all([
      prisma.userReport.count(),
      prisma.userReport.count({ where: { status: 'PENDING' } }),
      prisma.userReport.count({ where: { status: 'REVIEWING' } }),
      prisma.userReport.count({ where: { status: 'RESOLVED' } }),
      prisma.userReport.count({ where: { status: 'DISMISSED' } }),
      prisma.userReport.groupBy({
        by: ['reportType'],
        _count: { id: true },
      }),
    ]);

    const byTypeMap = byType.reduce((acc, item) => {
      acc[item.reportType] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    return res.json({
      success: true,
      data: {
        total,
        pending,
        reviewing,
        resolved,
        dismissed,
        byType: byTypeMap,
      },
    });
  })
);

/**
 * GET /admin/user-reports
 * List user reports with pagination and filters
 */
router.get(
  '/',
  validateQuery(AdminUserReportsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminUserReportsQuerySchema.parse(req.query);

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.reportType) where.reportType = query.reportType;
    if (query.reporterId) where.reporterId = query.reporterId;
    if (query.reportedUserId) where.reportedUserId = query.reportedUserId;
    if (query.search) {
      where.OR = [
        { reason: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
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
              profile: {
                select: {
                  userName: true,
                  displayName: true,
                },
              },
            },
          },
          reportedUser: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  userName: true,
                  displayName: true,
                },
              },
            },
          },
          reviewer: {
            select: {
              id: true,
              profile: {
                select: {
                  userName: true,
                },
              },
            },
          },
        },
      }),
      prisma.userReport.count({ where }),
    ]);

    const formattedReports = reports.map((report) => ({
      id: report.id,
      reportType: report.reportType,
      reason: report.reason,
      description: report.description,
      status: report.status,
      reporterId: report.reporterId,
      reporterUsername: report.reporter?.profile?.userName || null,
      reporterDisplayName: report.reporter?.profile?.displayName || null,
      reportedUserId: report.reportedUserId,
      reportedUsername: report.reportedUser?.profile?.userName || null,
      reportedUserEmail: report.reportedUser?.email || null,
      contentId: report.contentId,
      reviewerId: report.reviewerId,
      reviewerUsername: report.reviewer?.profile?.userName || null,
      reviewNote: report.reviewNote,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    }));

    return res.json({
      success: true,
      data: formattedReports,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
      },
    });
  })
);

/**
 * GET /admin/user-reports/:id
 * Get single user report details
 */
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
            profile: {
              select: {
                userName: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        reportedUser: {
          select: {
            id: true,
            email: true,
            status: true,
            profile: {
              select: {
                userName: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        reviewer: {
          select: {
            id: true,
            profile: {
              select: {
                userName: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundError('User report not found');
    }

    const formattedReport = {
      id: report.id,
      reportType: report.reportType,
      reason: report.reason,
      description: report.description,
      status: report.status,
      contentId: report.contentId,
      reporter: {
        id: report.reporter.id,
        email: report.reporter.email,
        username: report.reporter.profile?.userName || null,
        displayName: report.reporter.profile?.displayName || null,
        avatarUrl: report.reporter.profile?.avatarUrl || null,
      },
      reportedUser: {
        id: report.reportedUser.id,
        email: report.reportedUser.email,
        status: report.reportedUser.status,
        username: report.reportedUser.profile?.userName || null,
        displayName: report.reportedUser.profile?.displayName || null,
        avatarUrl: report.reportedUser.profile?.avatarUrl || null,
      },
      reviewer: report.reviewer ? {
        id: report.reviewer.id,
        username: report.reviewer.profile?.userName || null,
        displayName: report.reviewer.profile?.displayName || null,
      } : null,
      reviewNote: report.reviewNote,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    };

    return res.json({
      success: true,
      data: formattedReport,
    });
  })
);

/**
 * PATCH /admin/user-reports/:id
 * Update user report (status, review notes)
 */
router.patch(
  '/:id',
  validateBody(AdminUpdateUserReportSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    const body = AdminUpdateUserReportSchema.parse(req.body);

    const existingReport = await prisma.userReport.findUnique({
      where: { id },
    });

    if (!existingReport) {
      throw new NotFoundError('User report not found');
    }

    const updateData: any = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.reviewNote !== undefined) updateData.reviewNote = body.reviewNote;
    if (body.reviewerId !== undefined) {
      updateData.reviewerId = body.reviewerId;
    } else if (body.status === 'REVIEWING' && !existingReport.reviewerId) {
      // Auto-assign current admin if moving to REVIEWING
      updateData.reviewerId = adminId;
    }

    const updatedReport = await prisma.userReport.update({
      where: { id },
      data: updateData,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'USER_REPORT_UPDATE',
        description: `Updated report ${id}: status=${body.status || 'unchanged'}`,
        entityType: 'user_report',
        entityId: 0, // Using string ID
      },
    });

    logger.info('Admin updated user report', {
      adminId,
      reportId: id,
      status: body.status,
    });

    return res.json({
      success: true,
      data: {
        id: updatedReport.id,
        status: updatedReport.status,
        reviewNote: updatedReport.reviewNote,
        reviewerId: updatedReport.reviewerId,
        updatedAt: updatedReport.updatedAt.toISOString(),
      },
    });
  })
);

/**
 * DELETE /admin/user-reports/:id
 * Delete user report (soft delete by setting status to DISMISSED)
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    const report = await prisma.userReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundError('User report not found');
    }

    // Soft delete by dismissing
    await prisma.userReport.update({
      where: { id },
      data: {
        status: 'DISMISSED',
        reviewerId: adminId || null,
        reviewNote: 'Deleted by admin',
      },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'USER_REPORT_DELETE',
        description: `Dismissed report ${id}`,
        entityType: 'user_report',
        entityId: 0,
      },
    });

    logger.info('Admin dismissed user report', {
      adminId,
      reportId: id,
    });

    return res.json({
      success: true,
      message: 'User report dismissed successfully',
    });
  })
);

export default router;
