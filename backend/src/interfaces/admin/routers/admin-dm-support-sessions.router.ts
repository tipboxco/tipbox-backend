import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError } from '../../../infrastructure/errors/custom-errors';
import logger from '../../../infrastructure/logger/logger';
import { z } from 'zod';

const router = Router();
const prisma = getPrisma();

/**
 * DM Support Sessions Management Router
 * Routes are mounted at /admin/dm-support-sessions
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

// ==================== Schemas ====================

const AdminDMSupportSessionsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  threadId: z.string().uuid().optional(),
  helperId: z.string().uuid().optional(),
  minTipsAmount: z.coerce.number().min(0).optional(),
  sort: z.enum(['createdAt', 'supportedAt', 'tipsAmount']).default('supportedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// ==================== DM Support Sessions ====================

/**
 * GET /admin/dm-support-sessions/stats
 * Get DM support session statistics
 */
router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [totalSessions, totalTipsAmount, avgTipsAmount, topHelpers] = await Promise.all([
      prisma.dMSupportSession.count(),
      prisma.dMSupportSession.aggregate({
        _sum: { tipsAmount: true },
      }),
      prisma.dMSupportSession.aggregate({
        _avg: { tipsAmount: true },
      }),
      prisma.dMSupportSession.groupBy({
        by: ['helperId'],
        _count: { id: true },
        _sum: { tipsAmount: true },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 5,
      }),
    ]);

    // Get helper details for top helpers
    const helperIds = topHelpers.map((h) => h.helperId);
    const helpers = await prisma.user.findMany({
      where: { id: { in: helperIds } },
      select: {
        id: true,
        email: true,
        profile: {
          select: {
            username: true,
            displayName: true,
          },
        },
      },
    });

    const helperMap = new Map(helpers.map((h) => [h.id, h]));

    const topHelpersFormatted = topHelpers.map((helper) => {
      const user = helperMap.get(helper.helperId);
      return {
        helperId: helper.helperId,
        username: user?.profile?.username ?? null,
        sessionCount: helper._count.id,
        totalTips: helper._sum.tipsAmount ?? 0,
      };
    });

    return res.json({
      success: true,
      data: {
        totalSessions,
        totalTipsAmount: totalTipsAmount._sum.tipsAmount ?? 0,
        avgTipsAmount: avgTipsAmount._avg.tipsAmount ?? 0,
        topHelpers: topHelpersFormatted,
      },
    });
  })
);

/**
 * GET /admin/dm-support-sessions
 * List DM support sessions with pagination and filters
 */
router.get(
  '/',
  validateQuery(AdminDMSupportSessionsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminDMSupportSessionsQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.threadId) where.threadId = query.threadId;
    if (query.helperId) where.helperId = query.helperId;
    if (query.minTipsAmount !== undefined) {
      where.tipsAmount = { gte: query.minTipsAmount };
    }

    const [sessions, total] = await Promise.all([
      prisma.dMSupportSession.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order },
        include: {
          helper: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  username: true,
                  displayName: true,
                },
              },
            },
          },
          thread: {
            select: {
              id: true,
              participants: {
                select: {
                  user: {
                    select: {
                      id: true,
                      profile: {
                        select: {
                          username: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              feedbacks: true,
            },
          },
        },
      }),
      prisma.dMSupportSession.count({ where }),
    ]);

    const formattedSessions = sessions.map((session) => ({
      id: session.id,
      threadId: session.threadId,
      helperId: session.helperId,
      helperUsername: session.helper?.profile?.username ?? null,
      helperEmail: session.helper?.email ?? null,
      tipsAmount: session.tipsAmount,
      feedbackCount: session._count.feedbacks,
      participantCount: session.thread?.participants.length ?? 0,
      supportedAt: session.supportedAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
    }));

    return res.json({
      success: true,
      data: formattedSessions,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
      },
    });
  })
);

/**
 * GET /admin/dm-support-sessions/:id
 * Get single DM support session details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const session = await prisma.dMSupportSession.findUnique({
      where: { id },
      include: {
        helper: {
          select: {
            id: true,
            email: true,
            status: true,
            profile: {
              select: {
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        thread: {
          select: {
            id: true,
            createdAt: true,
            participants: {
              select: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    profile: {
                      select: {
                        username: true,
                        displayName: true,
                        avatarUrl: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        feedbacks: {
          include: {
            user: {
              select: {
                id: true,
                profile: {
                  select: {
                    username: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundError('DM support session not found');
    }

    const formattedSession = {
      id: session.id,
      threadId: session.threadId,
      helper: {
        id: session.helper.id,
        email: session.helper.email,
        status: session.helper.status,
        username: session.helper.profile?.username ?? null,
        displayName: session.helper.profile?.displayName ?? null,
        avatarUrl: session.helper.profile?.avatarUrl ?? null,
      },
      thread: {
        id: session.thread.id,
        createdAt: session.thread.createdAt.toISOString(),
        participants: session.thread.participants.map((p) => ({
          userId: p.user.id,
          username: p.user.profile?.username ?? null,
          email: p.user.email,
        })),
      },
      tipsAmount: session.tipsAmount,
      supportedAt: session.supportedAt.toISOString(),
      feedbacks: session.feedbacks.map((feedback) => ({
        id: feedback.id,
        userId: feedback.userId,
        username: feedback.user?.profile?.username ?? null,
        rating: feedback.rating,
        comment: feedback.comment,
        createdAt: feedback.createdAt.toISOString(),
      })),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };

    return res.json({
      success: true,
      data: formattedSession,
    });
  })
);

/**
 * DELETE /admin/dm-support-sessions/:id
 * Delete DM support session
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    const session = await prisma.dMSupportSession.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundError('DM support session not found');
    }

    await prisma.dMSupportSession.delete({
      where: { id },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'DM_SUPPORT_SESSION_DELETE',
        description: `Deleted DM support session ${id}`,
        entityType: 'dm_support_session',
        entityId: 0,
      },
    });

    logger.info('Admin deleted DM support session', {
      adminId,
      sessionId: id,
    });

    return res.json({
      success: true,
      message: 'DM support session deleted successfully',
    });
  })
);

export default router;
