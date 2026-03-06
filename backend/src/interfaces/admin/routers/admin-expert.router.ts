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
 * Expert Requests Management Router
 * Routes are mounted at /admin/expert-requests
 */

// ==================== Schemas ====================

const AdminExpertRequestsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  status: z.enum(['PENDING', 'BROADCASTING', 'EXPERT_FOUND', 'ANSWERED', 'CLOSED']).optional(),
  userId: z.string().uuid().optional(),
  search: z.string().optional(),
  sort: z.enum(['createdAt', 'updatedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const AdminUpdateExpertRequestSchema = z.object({
  status: z.enum(['PENDING', 'BROADCASTING', 'EXPERT_FOUND', 'ANSWERED', 'CLOSED']).optional(),
});

// ==================== Stats ====================

router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [total, pending, broadcasting, answered, closed] = await Promise.all([
      prisma.expertRequest.count(),
      prisma.expertRequest.count({ where: { status: 'PENDING' } }),
      prisma.expertRequest.count({ where: { status: 'BROADCASTING' } }),
      prisma.expertRequest.count({ where: { status: 'ANSWERED' } }),
      prisma.expertRequest.count({ where: { status: 'CLOSED' } }),
    ]);

    return res.json({
      success: true,
      data: { total, pending, broadcasting, answered, closed },
    });
  }),
);

// ==================== CRUD ====================

router.get(
  '/',
  validateQuery(AdminExpertRequestsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminExpertRequestsQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.userId) where.userId = query.userId;
    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { category: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [requests, total] = await Promise.all([
      prisma.expertRequest.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { userName: true, displayName: true } },
            },
          },
          _count: { select: { answers: true, media: true } },
        },
      }),
      prisma.expertRequest.count({ where }),
    ]);

    const data = requests.map((r) => ({
      id: r.id,
      description: r.description,
      category: r.category,
      tipsAmount: r.tipsAmount,
      status: r.status,
      userId: r.userId,
      userName: r.user.profile?.userName ?? r.user.email,
      displayName: r.user.profile?.displayName ?? null,
      answersCount: r._count.answers,
      mediaCount: r._count.media,
      answeredAt: r.answeredAt?.toISOString() ?? null,
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

    const request = await prisma.expertRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { userName: true, displayName: true } },
          },
        },
        media: true,
        answers: {
          include: {
            expertUser: {
              select: {
                id: true,
                email: true,
                profile: { select: { userName: true, displayName: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!request) {
      throw new NotFoundError('Expert request not found');
    }

    return res.json({
      success: true,
      data: {
        id: request.id,
        description: request.description,
        category: request.category,
        tipsAmount: request.tipsAmount,
        status: request.status,
        userId: request.userId,
        userName: request.user.profile?.userName ?? request.user.email,
        displayName: request.user.profile?.displayName ?? null,
        media: request.media.map((m) => ({
          id: m.id,
          mediaUrl: m.mediaUrl,
          mediaType: m.mediaType,
          createdAt: m.createdAt.toISOString(),
        })),
        answers: request.answers.map((a) => ({
          id: a.id,
          content: a.content,
          expertUserId: a.expertUserId,
          expertName: a.expertUser.profile?.userName ?? a.expertUser.email,
          createdAt: a.createdAt.toISOString(),
        })),
        answeredAt: request.answeredAt?.toISOString() ?? null,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
      },
    });
  }),
);

router.patch(
  '/:id',
  validateBody(AdminUpdateExpertRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    const body = AdminUpdateExpertRequestSchema.parse(req.body);

    const existing = await prisma.expertRequest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Expert request not found');
    }

    const updateData: Record<string, unknown> = {};
    if (body.status !== undefined) updateData.status = body.status;

    const updated = await prisma.expertRequest.update({
      where: { id },
      data: updateData,
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'EXPERT_REQUEST_UPDATE',
        description: `Updated expert request ${id} status to ${body.status}`,
        entityType: 'expert_request',
        entityId: 0,
      },
    });

    logger.info('Admin updated expert request', { adminId, requestId: id, changes: body });

    return res.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
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

    const request = await prisma.expertRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundError('Expert request not found');
    }

    // Delete media, answers, then request (cascade should handle but being explicit)
    await prisma.$transaction(async (tx) => {
      await tx.expertAnswer.deleteMany({ where: { requestId: id } });
      await tx.expertRequestMedia.deleteMany({ where: { requestId: id } });
      await tx.expertRequest.delete({ where: { id } });
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'EXPERT_REQUEST_DELETE',
        description: `Deleted expert request ${id}`,
        entityType: 'expert_request',
        entityId: 0,
      },
    });

    logger.info('Admin deleted expert request', { adminId, requestId: id });

    return res.json({ success: true, message: 'Expert request deleted successfully' });
  }),
);

// ==================== Answers ====================

router.get(
  '/:id/answers',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const request = await prisma.expertRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundError('Expert request not found');
    }

    const answers = await prisma.expertAnswer.findMany({
      where: { requestId: id },
      include: {
        expertUser: {
          select: {
            id: true,
            email: true,
            profile: { select: { userName: true, displayName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = answers.map((a) => ({
      id: a.id,
      content: a.content,
      expertUserId: a.expertUserId,
      expertName: a.expertUser.profile?.userName ?? a.expertUser.email,
      createdAt: a.createdAt.toISOString(),
    }));

    return res.json({ success: true, data });
  }),
);

router.delete(
  '/answers/:answerId',
  asyncHandler(async (req: Request, res: Response) => {
    const { answerId } = req.params;
    const adminId = req.user?.id;

    const answer = await prisma.expertAnswer.findUnique({ where: { id: answerId } });
    if (!answer) {
      throw new NotFoundError('Expert answer not found');
    }

    await prisma.expertAnswer.delete({ where: { id: answerId } });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'EXPERT_ANSWER_DELETE',
        description: `Deleted expert answer ${answerId} (request: ${answer.requestId})`,
        entityType: 'expert_answer',
        entityId: 0,
      },
    });

    logger.info('Admin deleted expert answer', { adminId, answerId });

    return res.json({ success: true, message: 'Expert answer deleted successfully' });
  }),
);

export default router;
