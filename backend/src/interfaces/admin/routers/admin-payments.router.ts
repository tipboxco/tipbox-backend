import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError, ValidationError } from '../../../infrastructure/errors/custom-errors';
import logger from '../../../infrastructure/logger/logger';

// Import schemas
import {
  AdminSubscriptionPlansQuerySchema,
  AdminCreateSubscriptionPlanSchema,
  AdminUpdateSubscriptionPlanSchema,
  AdminReorderSubscriptionPlanSchema,
  AdminUserSubscriptionsQuerySchema,
  AdminExtendSubscriptionSchema,
  AdminInvoicesQuerySchema,
  AdminUpdateInvoiceSchema,
  AdminWalletsQuerySchema,
  AdminAdjustWalletBalanceSchema,
  AdminTransactionsQuerySchema,
  AdminTipsQuerySchema,
  AdminTipsAnalyticsQuerySchema,
} from '../schemas/admin-payments.schemas';

// Import DTOs
import type {
  AdminSubscriptionPlanStatsResponse,
  AdminSubscriptionPlanListItem,
  AdminSubscriptionPlanDetailResponse,
  AdminUserSubscriptionStatsResponse,
  AdminUserSubscriptionListItem,
  AdminUserSubscriptionDetailResponse,
  AdminInvoiceStatsResponse,
  AdminInvoiceListItem,
  AdminInvoiceDetailResponse,
  AdminWalletStatsResponse,
  AdminWalletListItem,
  AdminWalletDetailResponse,
  AdminTransactionStatsResponse,
  AdminTransactionListItem,
  AdminTransactionDetailResponse,
  AdminTipsStatsResponse,
  AdminTipsListItem,
  AdminTipsAnalyticsResponse,
  AdminCreateSubscriptionPlanInput,
  AdminUpdateSubscriptionPlanInput,
  AdminExtendSubscriptionInput,
  AdminUpdateInvoiceInput,
  AdminAdjustWalletBalanceInput,
} from '../dtos/admin-payments.dto';

import type { PaginationMeta } from '../dtos/admin-common.dto';

const router = Router();
const prisma = getPrisma();

/**
 * Payments & Subscriptions Router
 * Routes are mounted at /admin/payments and /admin/wallets
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

// ==================== Subscription Plans ====================

/**
 * GET /admin/payments/plans/stats
 * Get subscription plans statistics
 */
router.get(
  '/plans/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const [total, active, totalSubscriptions] = await Promise.all([
      prisma.subscriptionPlan.count(),
      prisma.subscriptionPlan.count({ where: { isActive: true } }),
      prisma.userSubscription.count({ where: { status: 'active' } }),
    ]);

    // Calculate revenue this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const invoicesThisMonth = await prisma.invoice.findMany({
      where: {
        status: 'Paid',
        paidAt: { gte: startOfMonth },
      },
      select: { amount: true },
    });
    const revenueThisMonth = invoicesThisMonth.reduce((sum, inv) => sum + inv.amount, 0);

    // Most popular plan
    const planSubscriberCounts = await prisma.userSubscription.groupBy({
      by: ['planId'],
      _count: { id: true },
      where: { status: 'active' },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    });
    const mostPopularPlanId = planSubscriberCounts[0]?.planId || null;

    const data: AdminSubscriptionPlanStatsResponse = {
      total,
      active,
      inactive: total - active,
      totalSubscribers: totalSubscriptions,
      revenueThisMonth,
      mostPopularPlanId,
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/payments/plans
 * List subscription plans with pagination and filters
 */
router.get(
  '/plans',
  validateQuery(AdminSubscriptionPlansQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      isActive?: boolean;
      period?: string;
      sort: string;
      order: 'asc' | 'desc';
    };

    const where: Record<string, unknown> = {};
    if (q.isActive !== undefined) where.isActive = q.isActive;
    if (q.period) where.period = q.period;

    const [plans, total] = await Promise.all([
      prisma.subscriptionPlan.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          _count: {
            select: { userSubscriptions: { where: { status: 'active' } } },
          },
        },
      }),
      prisma.subscriptionPlan.count({ where }),
    ]);

    // Calculate revenue per plan
    const planRevenues = await Promise.all(
      plans.map(async (plan) => {
        const invoices = await prisma.invoice.findMany({
          where: { planId: plan.id, status: 'Paid' },
          select: { amount: true },
        });
        return invoices.reduce((sum, inv) => sum + inv.amount, 0);
      })
    );

    const data: AdminSubscriptionPlanListItem[] = plans.map((plan, idx) => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      currency: plan.currency,
      period: plan.period,
      benefits: Array.isArray(plan.benefits) ? (plan.benefits as string[]) : [],
      isActive: plan.isActive,
      displayOrder: plan.displayOrder,
      subscriberCount: plan._count.userSubscriptions,
      revenueTotal: planRevenues[idx],
      createdAt: plan.createdAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * GET /admin/payments/plans/:id
 * Get subscription plan details
 */
router.get(
  '/plans/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: { userSubscriptions: { where: { status: 'active' } } },
        },
      },
    });

    if (!plan) {
      throw new NotFoundError('Subscription plan not found');
    }

    // Calculate total revenue
    const invoices = await prisma.invoice.findMany({
      where: { planId: plan.id, status: 'Paid' },
      select: { amount: true },
    });
    const revenueTotal = invoices.reduce((sum, inv) => sum + inv.amount, 0);

    // Recent subscribers
    const recentSubs = await prisma.userSubscription.findMany({
      where: { planId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { userName: true } },
          },
        },
      },
    });

    const data: AdminSubscriptionPlanDetailResponse = {
      id: plan.id,
      name: plan.name,
      price: plan.price,
      currency: plan.currency,
      period: plan.period,
      benefits: Array.isArray(plan.benefits) ? (plan.benefits as string[]) : [],
      isActive: plan.isActive,
      displayOrder: plan.displayOrder,
      subscriberCount: plan._count.userSubscriptions,
      revenueTotal,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      recentSubscribers: recentSubs.map((sub) => ({
        userId: sub.userId,
        username: sub.user.profile?.userName || null,
        email: sub.user.email,
        subscribedAt: sub.createdAt.toISOString(),
      })),
    };

    return res.json({ success: true, data });
  })
);

/**
 * POST /admin/payments/plans
 * Create new subscription plan
 */
router.post(
  '/plans',
  validateBody(AdminCreateSubscriptionPlanSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const body = req.body as AdminCreateSubscriptionPlanInput;

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
        adminId,
        action: 'SUBSCRIPTION_PLAN_CREATE',
        description: `planId: ${plan.id}, name: ${plan.name}, price: ${plan.price}`,
        entityType: 'subscription_plan',
        entityId: 0,
      },
    });

    logger.info('Subscription plan created', { planId: plan.id, adminId });

    return res.status(201).json({ success: true, data: plan });
  })
);

/**
 * PATCH /admin/payments/plans/:id
 * Update subscription plan
 */
router.patch(
  '/plans/:id',
  validateBody(AdminUpdateSubscriptionPlanSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminUpdateSubscriptionPlanInput;

    const existing = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Subscription plan not found');
    }

    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: body,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'SUBSCRIPTION_PLAN_UPDATE',
        description: `planId: ${plan.id}, name: ${plan.name}`,
        entityType: 'subscription_plan',
        entityId: 0,
      },
    });

    logger.info('Subscription plan updated', { planId: plan.id, adminId });

    return res.json({ success: true, data: plan });
  })
);

/**
 * DELETE /admin/payments/plans/:id
 * Delete subscription plan (soft delete by setting isActive=false)
 */
router.delete(
  '/plans/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;

    const existing = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Subscription plan not found');
    }

    // Check if there are active subscriptions
    const activeSubsCount = await prisma.userSubscription.count({
      where: { planId: id, status: 'active' },
    });

    if (activeSubsCount > 0) {
      throw new ValidationError(
        `Cannot delete plan with ${activeSubsCount} active subscriptions. Set isActive=false instead.`
      );
    }

    await prisma.subscriptionPlan.delete({ where: { id } });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'SUBSCRIPTION_PLAN_DELETE',
        description: `planId: ${id}, name: ${existing.name}`,
        entityType: 'subscription_plan',
        entityId: 0,
      },
    });

    logger.info('Subscription plan deleted', { planId: id, adminId });

    return res.json({ success: true, message: 'Subscription plan deleted' });
  })
);

/**
 * PUT /admin/payments/plans/:id/reorder
 * Reorder subscription plan
 */
router.put(
  '/plans/:id/reorder',
  validateBody(AdminReorderSubscriptionPlanSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const { displayOrder } = req.body as { displayOrder: number };

    const existing = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Subscription plan not found');
    }

    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: { displayOrder },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'SUBSCRIPTION_PLAN_REORDER',
        description: `planId: ${id}, displayOrder: ${displayOrder}`,
        entityType: 'subscription_plan',
        entityId: 0,
      },
    });

    logger.info('Subscription plan reordered', { planId: id, displayOrder, adminId });

    return res.json({ success: true, data: plan });
  })
);

// ==================== User Subscriptions ====================

/**
 * GET /admin/payments/subscriptions/stats
 * Get user subscriptions statistics
 */
router.get(
  '/subscriptions/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const [total, active, trialing, canceled, pastDue] = await Promise.all([
      prisma.userSubscription.count(),
      prisma.userSubscription.count({ where: { status: 'active' } }),
      prisma.userSubscription.count({ where: { status: 'trialing' } }),
      prisma.userSubscription.count({ where: { status: 'canceled' } }),
      prisma.userSubscription.count({ where: { status: 'past_due' } }),
    ]);

    // Revenue this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const invoicesThisMonth = await prisma.invoice.findMany({
      where: {
        status: 'Paid',
        paidAt: { gte: startOfMonth },
      },
      select: { amount: true },
    });
    const revenueThisMonth = invoicesThisMonth.reduce((sum, inv) => sum + inv.amount, 0);

    // Churn rate (canceled in last 30 days / total active 30 days ago)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const canceledLast30Days = await prisma.userSubscription.count({
      where: {
        status: 'canceled',
        canceledAt: { gte: thirtyDaysAgo },
      },
    });
    const activeBefore30Days = await prisma.userSubscription.count({
      where: {
        createdAt: { lt: thirtyDaysAgo },
        status: 'active',
      },
    });
    const churnRate = activeBefore30Days > 0 ? (canceledLast30Days / activeBefore30Days) * 100 : 0;

    const data: AdminUserSubscriptionStatsResponse = {
      total,
      active,
      trialing,
      canceled,
      pastDue,
      revenueThisMonth,
      churnRate,
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/payments/subscriptions
 * List user subscriptions with pagination and filters
 */
router.get(
  '/subscriptions',
  validateQuery(AdminUserSubscriptionsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      userId?: string;
      planId?: string;
      status?: string;
      search?: string;
      sort: string;
      order: 'asc' | 'desc';
    };

    const where: Record<string, unknown> = {};
    if (q.userId) where.userId = q.userId;
    if (q.planId) where.planId = q.planId;
    if (q.status) where.status = q.status;

    // Search by user email or username
    if (q.search) {
      where.OR = [
        { user: { email: { contains: q.search, mode: 'insensitive' } } },
        { user: { profile: { username: { contains: q.search, mode: 'insensitive' } } } },
      ];
    }

    const [subscriptions, total] = await Promise.all([
      prisma.userSubscription.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { userName: true } },
            },
          },
          plan: { select: { id: true, name: true } },
        },
      }),
      prisma.userSubscription.count({ where }),
    ]);

    const data: AdminUserSubscriptionListItem[] = subscriptions.map((sub) => ({
      id: sub.id,
      userId: sub.userId,
      userEmail: sub.user.email,
      username: sub.user.profile?.userName || null,
      planId: sub.planId,
      planName: sub.plan.name,
      status: sub.status,
      currentPeriodStart: sub.currentPeriodStart.toISOString(),
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      paymentMethodId: sub.paymentMethodId,
      canceledAt: sub.canceledAt?.toISOString() || null,
      createdAt: sub.createdAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * GET /admin/payments/subscriptions/:id
 * Get subscription details
 */
router.get(
  '/subscriptions/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const subscription = await prisma.userSubscription.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { userName: true } },
          },
        },
        plan: { select: { id: true, name: true } },
        invoices: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            invoiceDate: true,
            paidAt: true,
          },
          orderBy: { invoiceDate: 'desc' },
          take: 10,
        },
      },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    const data: AdminUserSubscriptionDetailResponse = {
      id: subscription.id,
      userId: subscription.userId,
      userEmail: subscription.user.email,
      username: subscription.user.profile?.userName || null,
      planId: subscription.planId,
      planName: subscription.plan.name,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      paymentMethodId: subscription.paymentMethodId,
      canceledAt: subscription.canceledAt?.toISOString() || null,
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
      invoices: subscription.invoices.map((inv) => ({
        id: inv.id,
        amount: inv.amount,
        currency: inv.currency,
        status: inv.status,
        invoiceDate: inv.invoiceDate.toISOString(),
        paidAt: inv.paidAt?.toISOString() || null,
      })),
    };

    return res.json({ success: true, data });
  })
);

/**
 * PATCH /admin/payments/subscriptions/:id/cancel
 * Cancel user subscription
 */
router.patch(
  '/subscriptions/:id/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;

    const existing = await prisma.userSubscription.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Subscription not found');
    }

    if (existing.status === 'canceled') {
      throw new ValidationError('Subscription already canceled');
    }

    const subscription = await prisma.userSubscription.update({
      where: { id },
      data: {
        status: 'canceled',
        canceledAt: new Date(),
      },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'SUBSCRIPTION_CANCEL',
        description: `subscriptionId: ${id}, userId: ${subscription.userId}`,
        entityType: 'user_subscription',
        entityId: 0,
      },
    });

    logger.info('Subscription canceled by admin', { subscriptionId: id, adminId });

    return res.json({ success: true, data: subscription });
  })
);

/**
 * PATCH /admin/payments/subscriptions/:id/extend
 * Extend user subscription period
 */
router.patch(
  '/subscriptions/:id/extend',
  validateBody(AdminExtendSubscriptionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const { days } = req.body as AdminExtendSubscriptionInput;

    const existing = await prisma.userSubscription.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Subscription not found');
    }

    const newPeriodEnd = new Date(existing.currentPeriodEnd);
    newPeriodEnd.setDate(newPeriodEnd.getDate() + days);

    const subscription = await prisma.userSubscription.update({
      where: { id },
      data: { currentPeriodEnd: newPeriodEnd },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'SUBSCRIPTION_EXTEND',
        description: `subscriptionId: ${id}, days: ${days}, newEnd: ${newPeriodEnd.toISOString()}`,
        entityType: 'user_subscription',
        entityId: 0,
      },
    });

    logger.info('Subscription extended by admin', { subscriptionId: id, days, adminId });

    return res.json({ success: true, data: subscription });
  })
);

// ==================== Invoices ====================

/**
 * GET /admin/payments/invoices/stats
 * Get invoices statistics
 */
router.get(
  '/invoices/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const [total, pending, paid, failed] = await Promise.all([
      prisma.invoice.count(),
      prisma.invoice.count({ where: { status: 'Pending' } }),
      prisma.invoice.count({ where: { status: 'Paid' } }),
      prisma.invoice.count({ where: { status: 'Failed' } }),
    ]);

    // Total revenue
    const paidInvoices = await prisma.invoice.findMany({
      where: { status: 'Paid' },
      select: { amount: true },
    });
    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

    // Revenue this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const invoicesThisMonth = await prisma.invoice.findMany({
      where: {
        status: 'Paid',
        paidAt: { gte: startOfMonth },
      },
      select: { amount: true },
    });
    const revenueThisMonth = invoicesThisMonth.reduce((sum, inv) => sum + inv.amount, 0);

    const data: AdminInvoiceStatsResponse = {
      total,
      pending,
      paid,
      failed,
      totalRevenue,
      revenueThisMonth,
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/payments/invoices
 * List invoices with pagination and filters
 */
router.get(
  '/invoices',
  validateQuery(AdminInvoicesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      userId?: string;
      planId?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
      sort: string;
      order: 'asc' | 'desc';
    };

    const where: Record<string, unknown> = {};
    if (q.userId) where.userId = q.userId;
    if (q.planId) where.planId = q.planId;
    if (q.status) where.status = q.status;
    if (q.startDate || q.endDate) {
      where.invoiceDate = {};
      if (q.startDate) (where.invoiceDate as Record<string, unknown>).gte = q.startDate;
      if (q.endDate) (where.invoiceDate as Record<string, unknown>).lte = q.endDate;
    }

    // Search by user email or username
    if (q.search) {
      where.OR = [
        { user: { email: { contains: q.search, mode: 'insensitive' } } },
        { user: { profile: { username: { contains: q.search, mode: 'insensitive' } } } },
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { userName: true } },
            },
          },
          plan: { select: { id: true, name: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    const data: AdminInvoiceListItem[] = invoices.map((inv) => ({
      id: inv.id,
      userId: inv.userId,
      userEmail: inv.user.email,
      username: inv.user.profile?.userName || null,
      subscriptionId: inv.subscriptionId,
      planId: inv.planId,
      planName: inv.plan?.name || null,
      amount: inv.amount,
      currency: inv.currency,
      status: inv.status,
      description: inv.description,
      invoiceDate: inv.invoiceDate.toISOString(),
      paidAt: inv.paidAt?.toISOString() || null,
      createdAt: inv.createdAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * GET /admin/payments/invoices/:id
 * Get invoice details
 */
router.get(
  '/invoices/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { userName: true } },
          },
        },
        plan: { select: { id: true, name: true } },
        subscription: {
          select: {
            id: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    const data: AdminInvoiceDetailResponse = {
      id: invoice.id,
      userId: invoice.userId,
      userEmail: invoice.user.email,
      username: invoice.user.profile?.userName || null,
      subscriptionId: invoice.subscriptionId,
      planId: invoice.planId,
      planName: invoice.plan?.name || null,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
      description: invoice.description,
      invoiceDate: invoice.invoiceDate.toISOString(),
      paidAt: invoice.paidAt?.toISOString() || null,
      createdAt: invoice.createdAt.toISOString(),
      externalId: invoice.externalId,
      updatedAt: invoice.updatedAt.toISOString(),
      user: {
        id: invoice.user.id,
        email: invoice.user.email,
        username: invoice.user.profile?.userName || null,
      },
      subscription: invoice.subscription
        ? {
            id: invoice.subscription.id,
            status: invoice.subscription.status,
            currentPeriodStart: invoice.subscription.currentPeriodStart.toISOString(),
            currentPeriodEnd: invoice.subscription.currentPeriodEnd.toISOString(),
          }
        : null,
    };

    return res.json({ success: true, data });
  })
);

/**
 * PATCH /admin/payments/invoices/:id
 * Update invoice status
 */
router.patch(
  '/invoices/:id',
  validateBody(AdminUpdateInvoiceSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminUpdateInvoiceInput;

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Invoice not found');
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: body.status,
        paidAt: body.status === 'Paid' && !existing.paidAt ? new Date() : body.paidAt,
      },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'INVOICE_UPDATE',
        description: `invoiceId: ${id}, status: ${body.status}`,
        entityType: 'invoice',
        entityId: 0,
      },
    });

    logger.info('Invoice updated by admin', { invoiceId: id, status: body.status, adminId });

    return res.json({ success: true, data: invoice });
  })
);

/**
 * POST /admin/payments/invoices/:id/resend
 * Resend invoice (placeholder - requires email service)
 */
router.post(
  '/invoices/:id/resend',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { user: { select: { email: true } } },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // TODO: Implement email service integration
    logger.info('Invoice resend requested (email not implemented)', {
      invoiceId: id,
      userEmail: invoice.user.email,
      adminId,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'INVOICE_RESEND',
        description: `invoiceId: ${id}`,
        entityType: 'invoice',
        entityId: 0,
      },
    });

    return res.json({
      success: true,
      message: 'Invoice resend queued (email service not yet implemented)',
    });
  })
);

// ==================== Stats Endpoints ====================

/**
 * @swagger
 * /api/admin/payments/rewards/stats:
 *   get:
 *     tags: [Admin - Payments]
 *     summary: Get rewards statistics
 *     responses:
 *       200:
 *         description: Rewards stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     distributed:
 *                       type: number
 *                     pending:
 *                       type: number
 */
router.get(
  '/rewards/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [total, distributed, pending] = await Promise.all([
      prisma.rewardClaim.count(),
      prisma.rewardClaim.count({
        where: { status: 'DISTRIBUTED' },
      }),
      prisma.rewardClaim.count({
        where: { status: 'PENDING' },
      }),
    ]);

    const data = {
      total,
      distributed,
      pending,
    };

    return res.json({ success: true, data });
  })
);

export default router;
