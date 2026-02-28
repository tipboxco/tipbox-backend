import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { Prisma } from '@prisma/client';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError } from '../../../infrastructure/errors/custom-errors';
import logger from '../../../infrastructure/logger/logger';
import { z } from 'zod';

const router = Router();
const prisma = getPrisma();

/**
 * Lootbox Management Router
 * Routes are mounted at /admin/lootboxes
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

// ==================== Schemas ====================

const AdminLootboxesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  userId: z.string().uuid().optional(),
  type: z.string().optional(),
  opened: z.coerce.boolean().optional(),
  search: z.string().optional(),
  sort: z.enum(['createdAt', 'openedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const AdminCreateLootboxSchema = z.object({
  userId: z.string().uuid(),
  type: z.string().min(1).max(50),
  tier: z.enum(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']).default('COMMON'),
  expiresAt: z.string().datetime().nullable().optional(),
});

const AdminUpdateLootboxSchema = z.object({
  type: z.string().min(1).max(50).optional(),
  tier: z.enum(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

// ==================== Lootboxes ====================

/**
 * GET /admin/lootboxes/stats
 * Get lootbox statistics
 */
router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [total, unopened, opened, byType, byTier] = await Promise.all([
      prisma.lootbox.count(),
      prisma.lootbox.count({ where: { opened: false } }),
      prisma.lootbox.count({ where: { opened: true } }),
      prisma.lootbox.groupBy({
        by: ['type'],
        _count: { id: true },
      }),
      prisma.lootbox.groupBy({
        by: ['tier'],
        _count: { id: true },
      }),
    ]);

    const byTypeMap = byType.reduce((acc, item) => {
      acc[item.type] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    const byTierMap = byTier.reduce((acc, item) => {
      acc[item.tier] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    return res.json({
      success: true,
      data: {
        total,
        unopened,
        opened,
        byType: byTypeMap,
        byTier: byTierMap,
      },
    });
  })
);

/**
 * GET /admin/lootboxes
 * List lootboxes with pagination and filters
 */
router.get(
  '/',
  validateQuery(AdminLootboxesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminLootboxesQuerySchema.parse(req.query);

    const where: Prisma.LootboxWhereInput = {};
    if (query.userId) where.userId = query.userId;
    if (query.type) where.type = query.type;
    if (query.opened !== undefined) where.opened = query.opened;

    const [lootboxes, total] = await Promise.all([
      prisma.lootbox.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order },
        include: {
          user: {
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
        },
      }),
      prisma.lootbox.count({ where }),
    ]);

    const formattedLootboxes = lootboxes.map((lootbox) => ({
      id: lootbox.id,
      userId: lootbox.userId,
      username: lootbox.user?.profile?.username || null,
      userEmail: lootbox.user?.email || null,
      type: lootbox.type,
      tier: lootbox.tier,
      opened: lootbox.opened,
      openedAt: lootbox.openedAt?.toISOString() || null,
      expiresAt: lootbox.expiresAt?.toISOString() || null,
      createdAt: lootbox.createdAt.toISOString(),
    }));

    return res.json({
      success: true,
      data: formattedLootboxes,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
      },
    });
  })
);

/**
 * GET /admin/lootboxes/:id
 * Get single lootbox details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const lootbox = await prisma.lootbox.findUnique({
      where: { id },
      include: {
        user: {
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
      },
    });

    if (!lootbox) {
      throw new NotFoundError('Lootbox not found');
    }

    const formattedLootbox = {
      id: lootbox.id,
      type: lootbox.type,
      tier: lootbox.tier,
      opened: lootbox.opened,
      openedAt: lootbox.openedAt?.toISOString() || null,
      expiresAt: lootbox.expiresAt?.toISOString() || null,
      user: {
        id: lootbox.user.id,
        email: lootbox.user.email,
        status: lootbox.user.status,
        username: lootbox.user.profile?.username || null,
        displayName: lootbox.user.profile?.displayName || null,
        avatarUrl: lootbox.user.profile?.avatarUrl || null,
      },
      createdAt: lootbox.createdAt.toISOString(),
      updatedAt: lootbox.updatedAt.toISOString(),
    };

    return res.json({
      success: true,
      data: formattedLootbox,
    });
  })
);

/**
 * POST /admin/lootboxes
 * Create a new lootbox for a user
 */
router.post(
  '/',
  validateBody(AdminCreateLootboxSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    const body = AdminCreateLootboxSchema.parse(req.body);

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: body.userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const lootbox = await prisma.lootbox.create({
      data: {
        userId: body.userId,
        type: body.type,
        tier: body.tier,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        opened: false,
      },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'LOOTBOX_CREATE',
        description: `Created ${body.tier} lootbox (${body.type}) for user ${body.userId}`,
        entityType: 'lootbox',
        entityId: 0,
      },
    });

    logger.info('Admin created lootbox', {
      adminId,
      lootboxId: lootbox.id,
      userId: body.userId,
      type: body.type,
      tier: body.tier,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: lootbox.id,
        userId: lootbox.userId,
        type: lootbox.type,
        tier: lootbox.tier,
        opened: lootbox.opened,
        expiresAt: lootbox.expiresAt?.toISOString() || null,
        createdAt: lootbox.createdAt.toISOString(),
      },
    });
  })
);

/**
 * PATCH /admin/lootboxes/:id
 * Update lootbox details
 */
router.patch(
  '/:id',
  validateBody(AdminUpdateLootboxSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    const body = AdminUpdateLootboxSchema.parse(req.body);

    const existingLootbox = await prisma.lootbox.findUnique({
      where: { id },
    });

    if (!existingLootbox) {
      throw new NotFoundError('Lootbox not found');
    }

    if (existingLootbox.opened) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify an already opened lootbox',
      });
    }

    const updateData: Prisma.LootboxUpdateInput = {};
    if (body.type !== undefined) updateData.type = body.type;
    if (body.tier !== undefined) updateData.tier = body.tier;
    if (body.expiresAt !== undefined) {
      updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    }

    const updatedLootbox = await prisma.lootbox.update({
      where: { id },
      data: updateData,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'LOOTBOX_UPDATE',
        description: `Updated lootbox ${id}`,
        entityType: 'lootbox',
        entityId: 0,
      },
    });

    logger.info('Admin updated lootbox', {
      adminId,
      lootboxId: id,
      changes: body,
    });

    return res.json({
      success: true,
      data: {
        id: updatedLootbox.id,
        type: updatedLootbox.type,
        tier: updatedLootbox.tier,
        expiresAt: updatedLootbox.expiresAt?.toISOString() || null,
        updatedAt: updatedLootbox.updatedAt.toISOString(),
      },
    });
  })
);

/**
 * DELETE /admin/lootboxes/:id
 * Delete lootbox (only if unopened)
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    const lootbox = await prisma.lootbox.findUnique({
      where: { id },
    });

    if (!lootbox) {
      throw new NotFoundError('Lootbox not found');
    }

    if (lootbox.opened) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete an already opened lootbox',
      });
    }

    await prisma.lootbox.delete({
      where: { id },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'LOOTBOX_DELETE',
        description: `Deleted lootbox ${id}`,
        entityType: 'lootbox',
        entityId: 0,
      },
    });

    logger.info('Admin deleted lootbox', {
      adminId,
      lootboxId: id,
    });

    return res.json({
      success: true,
      message: 'Lootbox deleted successfully',
    });
  })
);

export default router;
