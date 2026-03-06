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
 * Reward Claims Management Router
 * Routes are mounted at /admin/reward-claims
 */

// ==================== Schemas ====================

const AdminRewardClaimsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  status: z.enum(['PENDING', 'CLAIMED', 'EXPIRED', 'CANCELLED']).optional(),
  userId: z.string().uuid().optional(),
  rewardType: z.string().optional(),
  sourceType: z.string().optional(),
  sort: z.enum(['createdAt', 'earnedAt', 'amount', 'expiresAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const AdminExtendRewardClaimSchema = z.object({
  expiresAt: z.string().datetime(),
});

// ==================== Stats ====================

router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [total, pending, claimed, expired, cancelled] = await Promise.all([
      prisma.rewardClaim.count(),
      prisma.rewardClaim.count({ where: { status: 'PENDING' } }),
      prisma.rewardClaim.count({ where: { status: 'CLAIMED' } }),
      prisma.rewardClaim.count({ where: { status: 'EXPIRED' } }),
      prisma.rewardClaim.count({ where: { status: 'CANCELLED' } }),
    ]);

    const totalAmount = await prisma.rewardClaim.aggregate({
      _sum: { amount: true },
      where: { status: 'CLAIMED' },
    });

    return res.json({
      success: true,
      data: {
        total,
        pending,
        claimed,
        expired,
        cancelled,
        totalClaimedAmount: totalAmount._sum.amount ?? 0,
      },
    });
  }),
);

// ==================== CRUD ====================

router.get(
  '/',
  validateQuery(AdminRewardClaimsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminRewardClaimsQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.userId) where.userId = query.userId;
    if (query.rewardType) where.rewardType = query.rewardType;
    if (query.sourceType) where.sourceType = query.sourceType;

    const [claims, total] = await Promise.all([
      prisma.rewardClaim.findMany({
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
        },
      }),
      prisma.rewardClaim.count({ where }),
    ]);

    const data = claims.map((c) => ({
      id: c.id,
      userId: c.userId,
      userName: c.user.profile?.userName ?? c.user.email,
      displayName: c.user.profile?.displayName ?? null,
      amount: c.amount,
      rewardType: c.rewardType,
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      status: c.status,
      earnedAt: c.earnedAt.toISOString(),
      claimedAt: c.claimedAt?.toISOString() ?? null,
      expiresAt: c.expiresAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
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

    const claim = await prisma.rewardClaim.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { userName: true, displayName: true } },
          },
        },
        transaction: true,
      },
    });

    if (!claim) {
      throw new NotFoundError('Reward claim not found');
    }

    return res.json({
      success: true,
      data: {
        id: claim.id,
        userId: claim.userId,
        userName: claim.user.profile?.userName ?? claim.user.email,
        displayName: claim.user.profile?.displayName ?? null,
        amount: claim.amount,
        rewardType: claim.rewardType,
        sourceType: claim.sourceType,
        sourceId: claim.sourceId,
        status: claim.status,
        metadata: claim.metadata,
        transactionId: claim.transactionId,
        transaction: claim.transaction
          ? {
              id: claim.transaction.id,
              status: claim.transaction.status,
              amount: claim.transaction.amount,
            }
          : null,
        earnedAt: claim.earnedAt.toISOString(),
        claimedAt: claim.claimedAt?.toISOString() ?? null,
        expiresAt: claim.expiresAt?.toISOString() ?? null,
        createdAt: claim.createdAt.toISOString(),
        updatedAt: claim.updatedAt.toISOString(),
      },
    });
  }),
);

router.patch(
  '/:id/approve',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    const claim = await prisma.rewardClaim.findUnique({ where: { id } });
    if (!claim) {
      throw new NotFoundError('Reward claim not found');
    }

    if (claim.status !== 'PENDING') {
      throw new ValidationError(`Cannot approve: claim status is ${claim.status}`);
    }

    const updated = await prisma.rewardClaim.update({
      where: { id },
      data: { status: 'CLAIMED', claimedAt: new Date() },
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'REWARD_CLAIM_APPROVE',
        description: `Approved reward claim ${id} (amount: ${claim.amount})`,
        entityType: 'reward_claim',
        entityId: 0,
      },
    });

    logger.info('Admin approved reward claim', { adminId, claimId: id, amount: claim.amount });

    return res.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        claimedAt: updated.claimedAt?.toISOString() ?? null,
      },
    });
  }),
);

router.patch(
  '/:id/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    const claim = await prisma.rewardClaim.findUnique({ where: { id } });
    if (!claim) {
      throw new NotFoundError('Reward claim not found');
    }

    if (claim.status !== 'PENDING') {
      throw new ValidationError(`Cannot cancel: claim status is ${claim.status}`);
    }

    const updated = await prisma.rewardClaim.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'REWARD_CLAIM_CANCEL',
        description: `Cancelled reward claim ${id}`,
        entityType: 'reward_claim',
        entityId: 0,
      },
    });

    logger.info('Admin cancelled reward claim', { adminId, claimId: id });

    return res.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
      },
    });
  }),
);

router.patch(
  '/:id/extend',
  validateBody(AdminExtendRewardClaimSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    const body = AdminExtendRewardClaimSchema.parse(req.body);

    const claim = await prisma.rewardClaim.findUnique({ where: { id } });
    if (!claim) {
      throw new NotFoundError('Reward claim not found');
    }

    const updated = await prisma.rewardClaim.update({
      where: { id },
      data: {
        expiresAt: new Date(body.expiresAt),
        // If was expired, set back to pending
        ...(claim.status === 'EXPIRED' ? { status: 'PENDING' } : {}),
      },
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'REWARD_CLAIM_EXTEND',
        description: `Extended reward claim ${id} expiry to ${body.expiresAt}`,
        entityType: 'reward_claim',
        entityId: 0,
      },
    });

    logger.info('Admin extended reward claim', { adminId, claimId: id, newExpiry: body.expiresAt });

    return res.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        expiresAt: updated.expiresAt?.toISOString() ?? null,
      },
    });
  }),
);

export default router;
