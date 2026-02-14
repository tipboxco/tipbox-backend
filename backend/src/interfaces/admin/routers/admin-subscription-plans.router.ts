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
 * Subscription Plans Management Router
 * Routes are mounted at /admin/subscription-plans
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

// ==================== Schemas ====================

const AdminSubscriptionPlansQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  isActive: z.coerce.boolean().optional(),
  period: z.enum(['MONTHLY', 'YEARLY']).optional(),
  sort: z.enum(['createdAt', 'displayOrder', 'price']).default('displayOrder'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const AdminCreateSubscriptionPlanSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().min(0),
  currency: z.string().length(3).default('USD'),
  period: z.enum(['MONTHLY', 'YEARLY']),
  benefits: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
});

const AdminUpdateSubscriptionPlanSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  price: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  period: z.enum(['MONTHLY', 'YEARLY']).optional(),
  benefits: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

// ==================== Subscription Plans ====================

/**
 * GET /admin/subscription-plans/stats
 * Get subscription plan statistics
 */
router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [total, active, byPeriod, totalSubscriptions] = await Promise.all([
      prisma.subscriptionPlan.count(),
      prisma.subscriptionPlan.count({ where: { isActive: true } }),
      prisma.subscriptionPlan.groupBy({
        by: ['period'],
        _count: { id: true },
      }),
      prisma.userSubscription.count(),
    ]);

    const byPeriodMap = byPeriod.reduce((acc, item) => {
      acc[item.period] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    return res.json({
      success: true,
      data: {
        total,
        active,
        inactive: total - active,
        byPeriod: byPeriodMap,
        totalSubscriptions,
      },
    });
  })
);

/**
 * GET /admin/subscription-plans
 * List subscription plans with pagination and filters
 */
router.get(
  '/',
  validateQuery(AdminSubscriptionPlansQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminSubscriptionPlansQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.period) where.period = query.period;

    const [plans, total] = await Promise.all([
      prisma.subscriptionPlan.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order },
        include: {
          _count: {
            select: {
              userSubscriptions: true,
              invoices: true,
            },
          },
        },
      }),
      prisma.subscriptionPlan.count({ where }),
    ]);

    const formattedPlans = plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      currency: plan.currency,
      period: plan.period,
      benefits: plan.benefits,
      isActive: plan.isActive,
      displayOrder: plan.displayOrder,
      subscriptionCount: plan._count.userSubscriptions,
      invoiceCount: plan._count.invoices,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    }));

    return res.json({
      success: true,
      data: formattedPlans,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
      },
    });
  })
);

/**
 * GET /admin/subscription-plans/:id
 * Get single subscription plan details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            userSubscriptions: true,
            invoices: true,
          },
        },
        userSubscriptions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
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
        },
      },
    });

    if (!plan) {
      throw new NotFoundError('Subscription plan not found');
    }

    const formattedPlan = {
      id: plan.id,
      name: plan.name,
      price: plan.price,
      currency: plan.currency,
      period: plan.period,
      benefits: plan.benefits,
      isActive: plan.isActive,
      displayOrder: plan.displayOrder,
      subscriptionCount: plan._count.userSubscriptions,
      invoiceCount: plan._count.invoices,
      recentSubscriptions: plan.userSubscriptions.map((sub) => ({
        id: sub.id,
        userId: sub.userId,
        username: sub.user?.profile?.username ?? null,
        userEmail: sub.user?.email ?? null,
        status: sub.status,
        startDate: sub.startDate.toISOString(),
        endDate: sub.endDate?.toISOString() ?? null,
        createdAt: sub.createdAt.toISOString(),
      })),
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };

    return res.json({
      success: true,
      data: formattedPlan,
    });
  })
);

/**
 * POST /admin/subscription-plans
 * Create a new subscription plan
 */
router.post(
  '/',
  validateBody(AdminCreateSubscriptionPlanSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    const body = AdminCreateSubscriptionPlanSchema.parse(req.body);

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: body.name,
        price: body.price,
        currency: body.currency,
        period: body.period,
        benefits: body.benefits,
        isActive: body.isActive,
        displayOrder: body.displayOrder,
      },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'SUBSCRIPTION_PLAN_CREATE',
        description: `Created subscription plan: ${body.name} (${body.period}) - ${body.price} ${body.currency}`,
        entityType: 'subscription_plan',
        entityId: 0,
      },
    });

    logger.info('Admin created subscription plan', {
      adminId,
      planId: plan.id,
      name: body.name,
      price: body.price,
      period: body.period,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
        period: plan.period,
        benefits: plan.benefits,
        isActive: plan.isActive,
        displayOrder: plan.displayOrder,
        createdAt: plan.createdAt.toISOString(),
      },
    });
  })
);

/**
 * PATCH /admin/subscription-plans/:id
 * Update subscription plan details
 */
router.patch(
  '/:id',
  validateBody(AdminUpdateSubscriptionPlanSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    const body = AdminUpdateSubscriptionPlanSchema.parse(req.body);

    const existingPlan = await prisma.subscriptionPlan.findUnique({
      where: { id },
    });

    if (!existingPlan) {
      throw new NotFoundError('Subscription plan not found');
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.price !== undefined) updateData.price = body.price;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.period !== undefined) updateData.period = body.period;
    if (body.benefits !== undefined) updateData.benefits = body.benefits;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.displayOrder !== undefined) updateData.displayOrder = body.displayOrder;

    const updatedPlan = await prisma.subscriptionPlan.update({
      where: { id },
      data: updateData,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'SUBSCRIPTION_PLAN_UPDATE',
        description: `Updated subscription plan ${id}`,
        entityType: 'subscription_plan',
        entityId: 0,
      },
    });

    logger.info('Admin updated subscription plan', {
      adminId,
      planId: id,
      changes: body,
    });

    return res.json({
      success: true,
      data: {
        id: updatedPlan.id,
        name: updatedPlan.name,
        price: updatedPlan.price,
        currency: updatedPlan.currency,
        period: updatedPlan.period,
        benefits: updatedPlan.benefits,
        isActive: updatedPlan.isActive,
        displayOrder: updatedPlan.displayOrder,
        updatedAt: updatedPlan.updatedAt.toISOString(),
      },
    });
  })
);

/**
 * DELETE /admin/subscription-plans/:id
 * Delete subscription plan (only if no active subscriptions)
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            userSubscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundError('Subscription plan not found');
    }

    if (plan._count.userSubscriptions > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete subscription plan with ${plan._count.userSubscriptions} active subscription(s). Deactivate it instead.`,
      });
    }

    await prisma.subscriptionPlan.delete({
      where: { id },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'SUBSCRIPTION_PLAN_DELETE',
        description: `Deleted subscription plan ${id}`,
        entityType: 'subscription_plan',
        entityId: 0,
      },
    });

    logger.info('Admin deleted subscription plan', {
      adminId,
      planId: id,
    });

    return res.json({
      success: true,
      message: 'Subscription plan deleted successfully',
    });
  })
);

export default router;
