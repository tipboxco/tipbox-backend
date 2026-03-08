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
 * AI Experience Splits Management Router
 * Routes are mounted at /admin/ai-experience-splits
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

// ==================== Schemas ====================

const AdminAiExperienceSplitsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  userId: z.string().uuid().optional(),
  productId: z.string().optional(),
  isEdited: z.coerce.boolean().optional(),
  model: z.string().optional(),
  promptVersion: z.string().optional(),
  minRating: z.coerce.number().int().min(1).max(5).optional(),
  sort: z
    .enum([
      'createdAt',
      'priceAndShoppingRating',
      'productAndUsageRating',
      'tokensUsed',
      'processingTimeMs',
    ])
    .default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const AdminUpdateAiExperienceSplitSchema = z.object({
  priceAndShopping: z.string().max(5000).nullable().optional(),
  productAndUsage: z.string().max(5000).nullable().optional(),
  priceAndShoppingRating: z.number().int().min(1).max(5).nullable().optional(),
  productAndUsageRating: z.number().int().min(1).max(5).nullable().optional(),
  isEdited: z.boolean().optional(),
});

// ==================== AI Experience Splits ====================

/**
 * GET /admin/ai-experience-splits/stats
 * Get AI experience split statistics
 */
router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [
      total,
      edited,
      avgTokensUsed,
      avgProcessingTime,
      byModel,
      avgPriceRating,
      avgProductRating,
    ] = await Promise.all([
      prisma.aiExperienceSplit.count(),
      prisma.aiExperienceSplit.count({ where: { isEdited: true } }),
      prisma.aiExperienceSplit.aggregate({
        _avg: { tokensUsed: true },
      }),
      prisma.aiExperienceSplit.aggregate({
        _avg: { processingTimeMs: true },
      }),
      prisma.aiExperienceSplit.groupBy({
        by: ['model'],
        _count: { id: true },
      }),
      prisma.aiExperienceSplit.aggregate({
        _avg: { priceAndShoppingRating: true },
      }),
      prisma.aiExperienceSplit.aggregate({
        _avg: { productAndUsageRating: true },
      }),
    ]);

    const byModelMap = byModel.reduce((acc, item) => {
      acc[item.model] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    return res.json({
      success: true,
      data: {
        total,
        edited,
        unedited: total - edited,
        avgTokensUsed: avgTokensUsed._avg.tokensUsed ?? 0,
        avgProcessingTimeMs: avgProcessingTime._avg.processingTimeMs ?? 0,
        avgPriceAndShoppingRating: avgPriceRating._avg.priceAndShoppingRating ?? 0,
        avgProductAndUsageRating: avgProductRating._avg.productAndUsageRating ?? 0,
        byModel: byModelMap,
      },
    });
  })
);

/**
 * GET /admin/ai-experience-splits
 * List AI experience splits with pagination and filters
 */
router.get(
  '/',
  validateQuery(AdminAiExperienceSplitsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminAiExperienceSplitsQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.userId) where.userId = query.userId;
    if (query.productId) where.productId = query.productId;
    if (query.isEdited !== undefined) where.isEdited = query.isEdited;
    if (query.model) where.model = query.model;
    if (query.promptVersion) where.promptVersion = query.promptVersion;
    if (query.minRating !== undefined) {
      where.OR = [
        { priceAndShoppingRating: { gte: query.minRating } },
        { productAndUsageRating: { gte: query.minRating } },
      ];
    }

    const [splits, total] = await Promise.all([
      prisma.aiExperienceSplit.findMany({
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
                  userName: true,
                  displayName: true,
                },
              },
            },
          },
          product: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.aiExperienceSplit.count({ where }),
    ]);

    const formattedSplits = splits.map((split) => ({
      id: split.id,
      userId: split.userId,
      username: split.user?.profile?.userName ?? null,
      userEmail: split.user?.email ?? null,
      productId: split.productId,
      productName: split.product?.name ?? null,
      priceAndShoppingRating: split.priceAndShoppingRating,
      productAndUsageRating: split.productAndUsageRating,
      isEdited: split.isEdited,
      model: split.model,
      promptVersion: split.promptVersion,
      tokensUsed: split.tokensUsed,
      processingTimeMs: split.processingTimeMs,
      createdAt: split.createdAt.toISOString(),
      updatedAt: split.updatedAt.toISOString(),
    }));

    return res.json({
      success: true,
      data: formattedSplits,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
      },
    });
  })
);

/**
 * GET /admin/ai-experience-splits/:id
 * Get single AI experience split details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const split = await prisma.aiExperienceSplit.findUnique({
      where: { id },
      include: {
        user: {
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
        product: {
          select: {
            id: true,
            name: true,
            subName: true,
            imageUrl: true,
          },
        },
      },
    });

    if (!split) {
      throw new NotFoundError('AI experience split not found');
    }

    const formattedSplit = {
      id: split.id,
      user: {
        id: split.user.id,
        email: split.user.email,
        status: split.user.status,
        username: split.user.profile?.userName ?? null,
        displayName: split.user.profile?.displayName ?? null,
        avatarUrl: split.user.profile?.avatarUrl ?? null,
      },
      product: split.product
        ? {
            id: split.product.id,
            name: split.product.name,
            subName: split.product.subName,
            imageUrl: split.product.imageUrl,
          }
        : null,
      originalExperience: split.originalExperience,
      priceAndShopping: split.priceAndShopping,
      productAndUsage: split.productAndUsage,
      priceAndShoppingRating: split.priceAndShoppingRating,
      productAndUsageRating: split.productAndUsageRating,
      isEdited: split.isEdited,
      model: split.model,
      promptVersion: split.promptVersion,
      tokensUsed: split.tokensUsed,
      processingTimeMs: split.processingTimeMs,
      createdAt: split.createdAt.toISOString(),
      updatedAt: split.updatedAt.toISOString(),
    };

    return res.json({
      success: true,
      data: formattedSplit,
    });
  })
);

/**
 * PATCH /admin/ai-experience-splits/:id
 * Update AI experience split (for manual corrections)
 */
router.patch(
  '/:id',
  validateBody(AdminUpdateAiExperienceSplitSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    const body = AdminUpdateAiExperienceSplitSchema.parse(req.body);

    const existingSplit = await prisma.aiExperienceSplit.findUnique({
      where: { id },
    });

    if (!existingSplit) {
      throw new NotFoundError('AI experience split not found');
    }

    const updateData: Record<string, unknown> = {};
    if (body.priceAndShopping !== undefined) {
      updateData.priceAndShopping = body.priceAndShopping ?? null;
    }
    if (body.productAndUsage !== undefined) {
      updateData.productAndUsage = body.productAndUsage ?? null;
    }
    if (body.priceAndShoppingRating !== undefined) {
      updateData.priceAndShoppingRating = body.priceAndShoppingRating ?? null;
    }
    if (body.productAndUsageRating !== undefined) {
      updateData.productAndUsageRating = body.productAndUsageRating ?? null;
    }
    if (body.isEdited !== undefined) updateData.isEdited = body.isEdited;

    // Mark as edited if any content was changed
    if (
      body.priceAndShopping !== undefined ||
      body.productAndUsage !== undefined ||
      body.priceAndShoppingRating !== undefined ||
      body.productAndUsageRating !== undefined
    ) {
      updateData.isEdited = true;
    }

    const updatedSplit = await prisma.aiExperienceSplit.update({
      where: { id },
      data: updateData,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'AI_EXPERIENCE_SPLIT_UPDATE',
        description: `Updated AI experience split ${id}`,
        entityType: 'ai_experience_split',
        entityId: 0,
      },
    });

    logger.info('Admin updated AI experience split', {
      adminId,
      splitId: id,
      userId: existingSplit.userId,
    });

    return res.json({
      success: true,
      data: {
        id: updatedSplit.id,
        priceAndShopping: updatedSplit.priceAndShopping,
        productAndUsage: updatedSplit.productAndUsage,
        priceAndShoppingRating: updatedSplit.priceAndShoppingRating,
        productAndUsageRating: updatedSplit.productAndUsageRating,
        isEdited: updatedSplit.isEdited,
        updatedAt: updatedSplit.updatedAt.toISOString(),
      },
    });
  })
);

/**
 * DELETE /admin/ai-experience-splits/:id
 * Delete AI experience split
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    const split = await prisma.aiExperienceSplit.findUnique({
      where: { id },
    });

    if (!split) {
      throw new NotFoundError('AI experience split not found');
    }

    await prisma.aiExperienceSplit.delete({
      where: { id },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'AI_EXPERIENCE_SPLIT_DELETE',
        description: `Deleted AI experience split ${id}`,
        entityType: 'ai_experience_split',
        entityId: 0,
      },
    });

    logger.info('Admin deleted AI experience split', {
      adminId,
      splitId: id,
    });

    return res.json({
      success: true,
      message: 'AI experience split deleted successfully',
    });
  })
);

export default router;
