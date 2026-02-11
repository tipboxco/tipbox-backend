import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError } from '../../../infrastructure/errors/custom-errors';
import { resolveMediaUrl } from '../../../infrastructure/config/media.config';
import logger from '../../../infrastructure/logger/logger';
import { generateIdForModel } from '../../../infrastructure/ids/id.strategy';

// Import schemas
import {
  AdminCreateEventSchema,
  AdminUpdateEventSchema,
  AdminEventsQuerySchema,
  AdminEventParticipantsQuerySchema,
  AdminAddEventBadgeSchema,
  AdminUpdateEventBadgeSchema,
  AdminEventRewardsQuerySchema,
} from '../schemas/admin-events.schemas';

// Import DTOs
import type {
  AdminEventStatsResponse,
  AdminEventListItem,
  AdminEventDetailResponse,
  AdminEventParticipantListItem,
  AdminEventAnalyticsResponse,
  AdminEventBadgeStatsResponse,
  AdminEventRewardStatsResponse,
  AdminEventBadgeListItem,
  AdminEventRewardListItem,
} from '../dtos/admin-events.dto';

import type { PaginationMeta } from '../dtos/admin-common.dto';

const router = Router();
const prisma = getPrisma();

/**
 * Events Router - Handles all event management endpoints
 * Routes are mounted at /admin/events
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

/* ========== Admin Events ========== */

router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [total, draft, published, closed] = await Promise.all([
      prisma.event.count(),
      prisma.event.count({ where: { status: 'DRAFT' } }),
      prisma.event.count({ where: { status: 'PUBLISHED' } }),
      prisma.event.count({ where: { status: 'CLOSED' } }),
    ]);
    const data: AdminEventStatsResponse = { total, draft, published, closed };
    return res.json({ success: true, data });
  })
);

/**
 * @swagger
 * /admin/events/badges/stats:
 *   get:
 *     tags: [Admin - Events]
 *     summary: Get event badges statistics
 *     responses:
 *       200:
 *         description: Event badges stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: number
 *                 byEventCount:
 *                   type: number
 */
router.get(
  '/badges/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const total = await prisma.eventBadge.count();

    // Count unique events that have badges
    const eventsWithBadges = await prisma.eventBadge.groupBy({
      by: ['eventId'],
      _count: { id: true },
    });
    const byEventCount = eventsWithBadges.length;

    const data: AdminEventBadgeStatsResponse = {
      total,
      byEventCount,
    };

    return res.json({ success: true, data });
  })
);

/**
 * @swagger
 * /admin/events/rewards/stats:
 *   get:
 *     tags: [Admin - Events]
 *     summary: Get event rewards statistics
 *     responses:
 *       200:
 *         description: Event rewards stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: number
 *                 byType:
 *                   type: object
 */
router.get(
  '/rewards/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const total = await prisma.eventReward.count();

    // Count by reward type
    const byTypeRaw = await prisma.eventReward.groupBy({
      by: ['rewardType'],
      _count: { id: true },
    });

    const byType: Record<string, number> = {};
    byTypeRaw.forEach((item) => {
      byType[item.rewardType] = item._count.id;
    });

    const data: AdminEventRewardStatsResponse = {
      total,
      byType,
    };

    return res.json({ success: true, data });
  })
);

router.get(
  '/',
  validateQuery(AdminEventsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      status?: string;
      feedType?: string;
      search?: string;
      sort: string;
      order: 'asc' | 'desc';
    };
    const where: { status?: string; feedType?: string; OR?: { title?: { contains: string; mode: 'insensitive' }; description?: { contains: string; mode: 'insensitive' } }[] } = {};
    if (q.status) where.status = q.status;
    if (q.feedType) where.feedType = q.feedType;
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: { _count: { select: { stats: true } } },
      }),
      prisma.event.count({ where }),
    ]);
    const data: AdminEventListItem[] = events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
      status: e.status,
      feedType: e.feedType,
      imageUrl: e.imageUrl ? resolveMediaUrl(e.imageUrl, true) : null,
      productId: e.productId,
      brandId: e.brandId,
      mainCategoryId: e.mainCategoryId,
      subCategoryId: e.subCategoryId,
      createdAt: e.createdAt.toISOString(),
      participantsCount: e._count.stats,
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

router.get(
  '/:id/participants',
  validateQuery(AdminEventParticipantsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id: eventId } = req.params;
    const q = req.query as unknown as { limit: number; offset: number; sort: string; order: 'asc' | 'desc' };
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event bulunamadı');
    const [stats, total] = await Promise.all([
      prisma.eventStats.findMany({
        where: { eventId },
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: { user: { select: { email: true }, include: { profile: { select: { displayName: true } } } } },
      }),
      prisma.eventStats.count({ where: { eventId } }),
    ]);
    const data: AdminEventParticipantListItem[] = stats.map((s) => ({
      id: s.id,
      userId: s.userId,
      eventId: s.eventId,
      totalParticipated: s.totalParticipated,
      totalComments: s.totalComments,
      helpfulVotesReceived: s.helpfulVotesReceived,
      eventPostsCount: s.eventPostsCount,
      eventLikesReceived: s.eventLikesReceived,
      createdAt: s.createdAt.toISOString(),
      userEmail: s.user.email,
      userDisplayName: s.user.profile?.displayName ?? null,
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

router.get(
  '/:id/analytics',
  asyncHandler(async (req: Request, res: Response) => {
    const { id: eventId } = req.params;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event bulunamadı');
    const [participantCount, totalPosts, totalRewardsGranted, badgesCount] = await Promise.all([
      prisma.eventStats.count({ where: { eventId } }),
      prisma.contentPost.count({ where: { eventId } }),
      prisma.eventReward.count({ where: { eventId } }),
      prisma.eventBadge.count({ where: { eventId } }),
    ]);
    const data: AdminEventAnalyticsResponse = {
      participantCount,
      totalPosts,
      totalRewardsGranted,
      badgesCount,
    };
    return res.json({ success: true, data });
  })
);

router.get(
  '/:id/badges',
  asyncHandler(async (req: Request, res: Response) => {
    const { id: eventId } = req.params;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event bulunamadı');
    const rows = await prisma.eventBadge.findMany({
      where: { eventId },
      orderBy: [{ rank: 'asc' }, { displayOrder: 'asc' }],
      include: { badge: { include: { category: { select: { name: true } } } } },
    });
    const data: AdminEventBadgeListItem[] = rows.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      badgeId: r.badgeId,
      rank: r.rank,
      displayOrder: r.displayOrder,
      enabled: r.enabled,
      createdAt: r.createdAt.toISOString(),
      badgeName: r.badge.name,
      badgeImageUrl: r.badge.imageUrl ? resolveMediaUrl(r.badge.imageUrl, true) : null,
      badgeRarity: r.badge.rarity,
      badgeCategoryName: r.badge.category?.name ?? null,
    }));
    return res.json({ success: true, data });
  })
);

router.post(
  '/:id/badges',
  validateBody(AdminAddEventBadgeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id: eventId } = req.params;
    const body = req.body as { badgeId: string; rank: number; displayOrder?: number | null };
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event bulunamadı');
    const badge = await prisma.badge.findUnique({ where: { id: body.badgeId } });
    if (!badge) throw new NotFoundError('Badge bulunamadı');
    const eb = await prisma.eventBadge.create({
      data: { eventId, badgeId: body.badgeId, rank: body.rank, displayOrder: body.displayOrder ?? undefined },
      include: { badge: { include: { category: { select: { name: true } } } } },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'EVENT_BADGE_ADD',
        description: `eventId: ${eventId}, badgeId: ${body.badgeId}, rank: ${body.rank}`,
        entityType: 'event_badge',
        entityId: 0,
      },
    });
    const data: AdminEventBadgeListItem = {
      id: eb.id,
      eventId: eb.eventId,
      badgeId: eb.badgeId,
      rank: eb.rank,
      displayOrder: eb.displayOrder,
      enabled: eb.enabled,
      createdAt: eb.createdAt.toISOString(),
      badgeName: eb.badge.name,
      badgeImageUrl: eb.badge.imageUrl ? resolveMediaUrl(eb.badge.imageUrl, true) : null,
      badgeRarity: eb.badge.rarity,
      badgeCategoryName: eb.badge.category?.name ?? null,
    };
    return res.status(201).json({ success: true, data });
  })
);

router.patch(
  '/:id/badges/:eventBadgeId',
  validateBody(AdminUpdateEventBadgeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id: eventId, eventBadgeId } = req.params;
    const body = req.body as { rank?: number; displayOrder?: number | null; enabled?: boolean };
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event bulunamadı');
    const existing = await prisma.eventBadge.findFirst({ where: { id: eventBadgeId, eventId } });
    if (!existing) throw new NotFoundError('Event badge bulunamadı');
    const updateData: { rank?: number; displayOrder?: number | null; enabled?: boolean } = {};
    if (body.rank !== undefined) updateData.rank = body.rank;
    if (body.displayOrder !== undefined) updateData.displayOrder = body.displayOrder;
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    const eb = await prisma.eventBadge.update({
      where: { id: eventBadgeId },
      data: updateData,
      include: { badge: { include: { category: { select: { name: true } } } } },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'EVENT_BADGE_UPDATE',
        description: `eventId: ${eventId}, eventBadgeId: ${eventBadgeId}`,
        entityType: 'event_badge',
        entityId: 0,
      },
    });
    const data: AdminEventBadgeListItem = {
      id: eb.id,
      eventId: eb.eventId,
      badgeId: eb.badgeId,
      rank: eb.rank,
      displayOrder: eb.displayOrder,
      enabled: eb.enabled,
      createdAt: eb.createdAt.toISOString(),
      badgeName: eb.badge.name,
      badgeImageUrl: eb.badge.imageUrl ? resolveMediaUrl(eb.badge.imageUrl, true) : null,
      badgeRarity: eb.badge.rarity,
      badgeCategoryName: eb.badge.category?.name ?? null,
    };
    return res.json({ success: true, data });
  })
);

router.delete(
  '/:id/badges/:eventBadgeId',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id: eventId, eventBadgeId } = req.params;
    const existing = await prisma.eventBadge.findFirst({ where: { id: eventBadgeId, eventId } });
    if (!existing) throw new NotFoundError('Event badge bulunamadı');
    await prisma.eventBadge.delete({ where: { id: eventBadgeId } });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'EVENT_BADGE_REMOVE',
        description: `eventId: ${eventId}, eventBadgeId: ${eventBadgeId}`,
        entityType: 'event_badge',
        entityId: 0,
      },
    });
    return res.json({ success: true, message: "Badge event'ten kaldırıldı" });
  })
);

router.get(
  '/:id/rewards',
  validateQuery(AdminEventRewardsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id: eventId } = req.params;
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      userId?: string;
      rewardType?: string;
      sort: string;
      order: 'asc' | 'desc';
    };
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event bulunamadı');
    const where: { eventId: string; userId?: string; rewardType?: string } = { eventId };
    if (q.userId) where.userId = q.userId;
    if (q.rewardType) where.rewardType = q.rewardType as 'TIPS' | 'BADGE' | 'TITLE';
    const [rewards, total] = await Promise.all([
      prisma.eventReward.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: { user: { select: { email: true }, include: { profile: { select: { displayName: true } } } } },
      }),
      prisma.eventReward.count({ where }),
    ]);
    const data: AdminEventRewardListItem[] = rewards.map((r) => ({
      id: r.id,
      userId: r.userId,
      eventId: r.eventId,
      rewardType: r.rewardType,
      rewardId: r.rewardId,
      amount: r.amount,
      awardedAt: r.awardedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      userEmail: r.user.email,
      userDisplayName: r.user.profile?.displayName ?? null,
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        mainCategory: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
      },
    });
    if (!event) throw new NotFoundError('Event bulunamadı');
    const data: AdminEventDetailResponse = {
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      status: event.status,
      feedType: event.feedType,
      imageUrl: event.imageUrl ? resolveMediaUrl(event.imageUrl, true) : null,
      productId: event.productId,
      brandId: event.brandId,
      mainCategoryId: event.mainCategoryId,
      subCategoryId: event.subCategoryId,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      product: event.product ? { id: event.product.id, name: event.product.name } : null,
      brand: event.brand ? { id: event.brand.id, name: event.brand.name } : null,
      mainCategory: event.mainCategory ? { id: event.mainCategory.id, name: event.mainCategory.name } : null,
      subCategory: event.subCategory ? { id: event.subCategory.id, name: event.subCategory.name } : null,
    };
    return res.json({ success: true, data });
  })
);

router.post(
  '/',
  validateBody(AdminCreateEventSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const body = req.body as {
      title: string;
      description?: string | null;
      startDate: string;
      endDate: string;
      status?: string;
      feedType?: string;
      productId?: string | null;
      brandId?: string | null;
      mainCategoryId?: string | null;
      subCategoryId?: string | null;
      imageUrl?: string | null;
    };
    const eventId = generateIdForModel('Event');
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    const event = await prisma.event.create({
      data: {
        id: eventId,
        title: body.title,
        description: body.description ?? null,
        startDate,
        endDate,
        status: (body.status as 'DRAFT' | 'PUBLISHED' | 'CLOSED') ?? 'DRAFT',
        feedType: (body.feedType as 'PICKS' | 'ROASTS') ?? 'PICKS',
        productId: body.productId ?? null,
        brandId: body.brandId ?? null,
        mainCategoryId: body.mainCategoryId ?? null,
        subCategoryId: body.subCategoryId ?? null,
        imageUrl: body.imageUrl ?? null,
      },
      include: {
        product: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        mainCategory: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
      },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'EVENT_CREATE',
        description: `eventId: ${event.id}, title: ${event.title}`,
        entityType: 'event',
        entityId: 0,
      },
    });
    const data: AdminEventDetailResponse = {
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      status: event.status,
      feedType: event.feedType,
      imageUrl: event.imageUrl ? resolveMediaUrl(event.imageUrl, true) : null,
      productId: event.productId,
      brandId: event.brandId,
      mainCategoryId: event.mainCategoryId,
      subCategoryId: event.subCategoryId,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      product: event.product ? { id: event.product.id, name: event.product.name } : null,
      brand: event.brand ? { id: event.brand.id, name: event.brand.name } : null,
      mainCategory: event.mainCategory ? { id: event.mainCategory.id, name: event.mainCategory.name } : null,
      subCategory: event.subCategory ? { id: event.subCategory.id, name: event.subCategory.name } : null,
    };
    return res.status(201).json({ success: true, data });
  })
);

router.patch(
  '/:id',
  validateBody(AdminUpdateEventSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const body = req.body as {
      title?: string;
      description?: string | null;
      startDate?: string;
      endDate?: string;
      status?: string;
      feedType?: string;
      productId?: string | null;
      brandId?: string | null;
      mainCategoryId?: string | null;
      subCategoryId?: string | null;
      imageUrl?: string | null;
    };
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundError('Event bulunamadı');
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) updateData.endDate = new Date(body.endDate);
    if (body.status !== undefined) updateData.status = body.status;
    if (body.feedType !== undefined) updateData.feedType = body.feedType;
    if (body.productId !== undefined) updateData.productId = body.productId;
    if (body.brandId !== undefined) updateData.brandId = body.brandId;
    if (body.mainCategoryId !== undefined) updateData.mainCategoryId = body.mainCategoryId;
    if (body.subCategoryId !== undefined) updateData.subCategoryId = body.subCategoryId;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    const updated = await prisma.event.update({
      where: { id },
      data: updateData,
      include: {
        product: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        mainCategory: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
      },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'EVENT_UPDATE',
        description: `eventId: ${id}, fields: ${Object.keys(updateData).join(',')}`,
        entityType: 'event',
        entityId: 0,
      },
    });
    const data: AdminEventDetailResponse = {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      startDate: updated.startDate.toISOString(),
      endDate: updated.endDate.toISOString(),
      status: updated.status,
      feedType: updated.feedType,
      imageUrl: updated.imageUrl ? resolveMediaUrl(updated.imageUrl, true) : null,
      productId: updated.productId,
      brandId: updated.brandId,
      mainCategoryId: updated.mainCategoryId,
      subCategoryId: updated.subCategoryId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      product: updated.product ? { id: updated.product.id, name: updated.product.name } : null,
      brand: updated.brand ? { id: updated.brand.id, name: updated.brand.name } : null,
      mainCategory: updated.mainCategory ? { id: updated.mainCategory.id, name: updated.mainCategory.name } : null,
      subCategory: updated.subCategory ? { id: updated.subCategory.id, name: updated.subCategory.name } : null,
    };
    return res.json({ success: true, data });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundError('Event bulunamadı');
    await prisma.event.delete({ where: { id } });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'EVENT_DELETE',
        description: `eventId: ${id}, title: ${event.title}`,
        entityType: 'event',
        entityId: 0,
      },
    });
    return res.json({ success: true, message: 'Event silindi' });
  })
);

export default router;
