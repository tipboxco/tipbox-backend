import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError, ValidationError } from '../../../infrastructure/errors/custom-errors';
import { S3Service } from '../../../infrastructure/s3/s3.service';
import { resolveMediaUrl } from '../../../infrastructure/config/media.config';
import logger from '../../../infrastructure/logger/logger';
import { generateIdForModel } from '../../../infrastructure/ids/id.strategy';

// Import schemas
import {
  AdminCollectionsQuerySchema,
  AdminCreateCollectionSchema,
  AdminUpdateCollectionSchema,
  AdminAddCollectionBadgeSchema,
  AdminCreateCollectionGoalSchema,
  AdminUpdateCollectionGoalSchema,
  AdminBadgesQuerySchema,
  AdminCreateBadgeSchema,
  AdminUpdateBadgeSchema,
  AdminBadgeOwnersQuerySchema,
} from '../schemas/admin-badges.schemas';

// Import DTOs
import type {
  AdminCollectionStatsResponse,
  AdminCollectionListItem,
  AdminCollectionDetailResponse,
  AdminCollectionBadgeListItem,
  AdminActionTypeListItem,
  AdminBadgeCategoryListItem,
  AdminBadgeStatsResponse,
  AdminBadgeListItem,
  AdminBadgeDetailResponse,
  AdminBadgeOwnerListItem,
  AdminCreateCollectionInput,
  AdminUpdateCollectionInput,
  AdminCreateCollectionGoalInput,
  AdminCreateBadgeInput,
  AdminUpdateBadgeInput,
} from '../dtos/admin-badges.dto';

import type { PaginationMeta } from '../dtos/admin-common.dto';

const router = Router();
const prisma = getPrisma();
const s3Service = new S3Service();

const adminUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (file.mimetype && allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece JPG, PNG, GIF ve WebP desteklenir'));
    }
  },
});

/**
 * Badges & Collections Router
 * Routes are mounted at /admin/badges
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

/* ========== Admin ActionTypes (Aktivasyon tipleri) ========== */

router.get(
  '/action-types',
  asyncHandler(async (_req: Request, res: Response) => {
    const list = await prisma.actionType.findMany({
      orderBy: [{ mainAction: 'asc' }, { code: 'asc' }],
      select: { id: true, mainAction: true, code: true, label: true },
    });
    const data = list.map((a) => ({
      id: a.id,
      mainAction: a.mainAction,
      code: a.code,
      label: a.label,
    }));
    return res.json({ success: true, data });
  })
);

/* ========== Admin Collections (BadgeCollection) ========== */

router.get(
  '/collections/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const total = await prisma.badgeCollection.count();
    const data: AdminCollectionStatsResponse = { total };
    return res.json({ success: true, data });
  })
);

/** Koleksiyon formu için Category ağacı: Ana (parentId null) ve Alt (parentId = ana id). Sadece 1. ve 2. seviye. */
router.get(
  '/collections/categories',
  asyncHandler(async (_req: Request, res: Response) => {
    const mainCategories = await prisma.category.findMany({
      where: { parentId: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    const mainIds = mainCategories.map((m) => m.id);
    const subCategories = mainIds.length
      ? await prisma.category.findMany({
          where: { parentId: { in: mainIds } },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, parentId: true },
        })
      : [];
    const childrenByParent = new Map<string | null, Array<{ id: string; name: string }>>();
    for (const m of mainCategories) {
      childrenByParent.set(m.id, subCategories.filter((s) => s.parentId === m.id).map((s) => ({ id: s.id, name: s.name })));
    }
    const data = mainCategories.map((m) => ({
      id: m.id,
      name: m.name,
      children: childrenByParent.get(m.id) ?? [],
    }));
    return res.json({ success: true, data });
  })
);

router.get(
  '/collections',
  validateQuery(AdminCollectionsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      search?: string;
      categoryId?: string;
      sort: string;
      order: 'asc' | 'desc';
    };
    const where: { name?: { contains: string; mode: 'insensitive' }; categoryId?: string } = {};
    if (q.search) where.name = { contains: q.search, mode: 'insensitive' };
    if (q.categoryId) where.categoryId = q.categoryId;
    const [collections, total] = await Promise.all([
      prisma.badgeCollection.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          category: { select: { id: true, name: true } },
          _count: { select: { badges: true, achievementGoals: true } },
        },
      }),
      prisma.badgeCollection.count({ where }),
    ]);
    const data: AdminCollectionListItem[] = collections.map((c) => ({
      id: c.id,
      name: c.name,
      bannerUrl: c.bannerUrl,
      owner: c.owner,
      categoryId: c.categoryId,
      categoryName: c.category?.name ?? null,
      badgesCount: c._count.badges,
      goalsCount: c._count.achievementGoals,
      createdAt: c.createdAt.toISOString(),
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

router.get(
  '/collections/:id/badges',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const collection = await prisma.badgeCollection.findUnique({ where: { id } });
    if (!collection) throw new NotFoundError('Koleksiyon bulunamadı');
    const badges = await prisma.badge.findMany({
      where: { collectionId: id },
      orderBy: { name: 'asc' },
      include: { category: { select: { id: true, name: true } } },
    });
    const data: AdminCollectionBadgeListItem[] = badges.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      imageUrl: b.imageUrl ? resolveMediaUrl(b.imageUrl, true) : null,
      type: b.type,
      rarity: b.rarity,
      categoryId: b.categoryId,
      categoryName: b.category?.name ?? null,
      createdAt: b.createdAt.toISOString(),
    }));
    return res.json({ success: true, data });
  })
);

router.post(
  '/collections/:id/badges',
  validateBody(AdminAddCollectionBadgeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const body = req.body as { badgeId: string };
    const collection = await prisma.badgeCollection.findUnique({ where: { id } });
    if (!collection) throw new NotFoundError('Koleksiyon bulunamadı');
    const badge = await prisma.badge.findUnique({ where: { id: body.badgeId } });
    if (!badge) throw new NotFoundError('Badge bulunamadı');
    if (badge.collectionId === id) {
      return res.status(400).json({ success: false, message: 'Badge zaten bu koleksiyonda' });
    }
    await prisma.badge.update({
      where: { id: body.badgeId },
      data: { collectionId: id },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'COLLECTION_BADGE_ADD',
        description: `collectionId: ${id}, badgeId: ${body.badgeId}`,
        entityType: 'badge_collection',
        entityId: 0,
      },
    });
    return res.json({ success: true, message: 'Badge koleksiyona eklendi', data: { badgeId: body.badgeId } });
  })
);

router.delete(
  '/collections/:id/badges/:badgeId',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id, badgeId } = req.params;
    const collection = await prisma.badgeCollection.findUnique({ where: { id } });
    if (!collection) throw new NotFoundError('Koleksiyon bulunamadı');
    const badge = await prisma.badge.findFirst({ where: { id: badgeId, collectionId: id } });
    if (!badge) throw new NotFoundError('Badge bu koleksiyonda bulunamadı');
    await prisma.badge.update({
      where: { id: badgeId },
      data: { collectionId: null },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'COLLECTION_BADGE_REMOVE',
        description: `collectionId: ${id}, badgeId: ${badgeId}`,
        entityType: 'badge_collection',
        entityId: 0,
      },
    });
    return res.json({ success: true, message: 'Badge koleksiyondan çıkarıldı' });
  })
);

router.post(
  '/collections/:id/goals',
  validateBody(AdminCreateCollectionGoalSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id: collectionId } = req.params;
    const body = req.body as AdminCreateCollectionGoalInput;
    const collection = await prisma.badgeCollection.findUnique({ where: { id: collectionId } });
    if (!collection) throw new NotFoundError('Koleksiyon bulunamadı');
    const actionType = await prisma.actionType.findUnique({ where: { id: body.actionTypeId } });
    if (!actionType) throw new NotFoundError('ActionType bulunamadı');
    const badge = await prisma.badge.findUnique({ where: { id: body.rewardBadgeId } });
    if (!badge) throw new NotFoundError('Badge bulunamadı');
    if (badge.collectionId !== collectionId) throw new ValidationError('Badge bu koleksiyona ait değil');
    const title = body.title ?? badge.name;
    const requirement = body.requirement ?? `${actionType.label}: ${body.pointsRequired} adet`;
    const goal = await prisma.achievementGoal.create({
      data: {
        collectionId,
        title,
        requirement,
        mainAction: actionType.mainAction,
        actionTypeId: body.actionTypeId,
        rewardBadgeId: body.rewardBadgeId,
        pointsRequired: body.pointsRequired,
        difficulty: body.difficulty,
      },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'COLLECTION_GOAL_CREATE',
        description: `collectionId: ${collectionId}, goalId: ${goal.id}, rewardBadgeId: ${body.rewardBadgeId}`,
        entityType: 'badge_collection',
        entityId: 0,
      },
    });
    return res.status(201).json({ success: true, data: { id: goal.id } });
  })
);

router.patch(
  '/collections/:collectionId/goals/:goalId',
  validateBody(AdminUpdateCollectionGoalSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const { collectionId, goalId } = req.params;
    const body = req.body as Partial<AdminCreateCollectionGoalInput>;

    const goal = await prisma.achievementGoal.findUnique({ where: { id: goalId } });
    if (!goal) throw new NotFoundError('Achievement goal not found');
    if (goal.collectionId !== collectionId) {
      throw new ValidationError('Goal does not belong to this collection');
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.requirement !== undefined) updateData.requirement = body.requirement;
    if (body.pointsRequired !== undefined) updateData.pointsRequired = body.pointsRequired;
    if (body.difficulty !== undefined) updateData.difficulty = body.difficulty;

    if (body.actionTypeId !== undefined) {
      const actionType = await prisma.actionType.findUnique({ where: { id: body.actionTypeId } });
      if (!actionType) throw new NotFoundError('ActionType not found');
      updateData.actionTypeId = body.actionTypeId;
      updateData.mainAction = actionType.mainAction;
    }

    if (body.rewardBadgeId !== undefined) {
      const badge = await prisma.badge.findUnique({ where: { id: body.rewardBadgeId } });
      if (!badge) throw new NotFoundError('Badge not found');
      if (badge.collectionId !== collectionId) {
        throw new ValidationError('Badge does not belong to this collection');
      }
      updateData.rewardBadgeId = body.rewardBadgeId;
    }

    const updated = await prisma.achievementGoal.update({
      where: { id: goalId },
      data: updateData,
    });

    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'COLLECTION_GOAL_UPDATE',
        description: `goalId: ${goalId}, collectionId: ${collectionId}`,
        entityType: 'achievement_goal',
        entityId: 0,
      },
    });

    return res.json({ success: true, data: { id: updated.id } });
  })
);

router.delete(
  '/collections/:collectionId/goals/:goalId',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const { collectionId, goalId } = req.params;

    const goal = await prisma.achievementGoal.findUnique({ where: { id: goalId } });
    if (!goal) throw new NotFoundError('Achievement goal not found');
    if (goal.collectionId !== collectionId) {
      throw new ValidationError('Goal does not belong to this collection');
    }

    await prisma.achievementGoal.delete({ where: { id: goalId } });

    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'COLLECTION_GOAL_DELETE',
        description: `goalId: ${goalId}, collectionId: ${collectionId}`,
        entityType: 'achievement_goal',
        entityId: 0,
      },
    });

    return res.json({ success: true, message: 'Achievement goal deleted' });
  })
);

router.get(
  '/collections/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const collection = await prisma.badgeCollection.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { badges: true, achievementGoals: true } },
      },
    });
    if (!collection) throw new NotFoundError('Koleksiyon bulunamadı');
    const data: AdminCollectionDetailResponse = {
      id: collection.id,
      name: collection.name,
      bannerUrl: collection.bannerUrl,
      owner: collection.owner,
      categoryId: collection.categoryId ?? undefined,
      categoryName: collection.category?.name ?? null,
      badgesCount: collection._count.badges,
      goalsCount: collection._count.achievementGoals,
      createdAt: collection.createdAt.toISOString(),
      focusSector: collection.focusSector,
      targetGroup: collection.targetGroup,
      shortDescription: collection.shortDescription,
      longDescription: collection.longDescription,
      unlockCondition: collection.unlockCondition,
      completionBonus: collection.completionBonus,
      updatedAt: collection.updatedAt.toISOString(),
      category: collection.category ? { id: collection.category.id, name: collection.category.name } : null,
    };
    return res.json({ success: true, data });
  })
);

router.post(
  '/collections',
  validateBody(AdminCreateCollectionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const body = req.body as AdminCreateCollectionInput;
    const collection = await prisma.badgeCollection.create({
      data: {
        name: body.name,
        bannerUrl: body.bannerUrl ?? null,
        owner: body.owner ?? null,
        focusSector: body.focusSector ?? null,
        targetGroup: body.targetGroup ?? null,
        shortDescription: body.shortDescription ?? null,
        longDescription: body.longDescription ?? null,
        unlockCondition: body.unlockCondition ?? null,
        completionBonus: body.completionBonus ?? null,
        categoryId: body.categoryId ?? null,
      },
      include: { category: { select: { id: true, name: true } } },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'COLLECTION_CREATE',
        description: `collectionId: ${collection.id}, name: ${collection.name}`,
        entityType: 'badge_collection',
        entityId: 0,
      },
    });
    const data: AdminCollectionDetailResponse = {
      id: collection.id,
      name: collection.name,
      bannerUrl: collection.bannerUrl,
      owner: collection.owner,
      categoryId: collection.categoryId ?? undefined,
      categoryName: collection.category?.name ?? null,
      badgesCount: 0,
      goalsCount: 0,
      createdAt: collection.createdAt.toISOString(),
      focusSector: collection.focusSector,
      targetGroup: collection.targetGroup,
      shortDescription: collection.shortDescription,
      longDescription: collection.longDescription,
      unlockCondition: collection.unlockCondition,
      completionBonus: collection.completionBonus,
      updatedAt: collection.updatedAt.toISOString(),
      category: collection.category ? { id: collection.category.id, name: collection.category.name } : null,
    };
    return res.status(201).json({ success: true, data });
  })
);

router.patch(
  '/collections/:id',
  validateBody(AdminUpdateCollectionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const body = req.body as AdminUpdateCollectionInput;
    const collection = await prisma.badgeCollection.findUnique({ where: { id } });
    if (!collection) throw new NotFoundError('Koleksiyon bulunamadı');
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.bannerUrl !== undefined) updateData.bannerUrl = body.bannerUrl;
    if (body.owner !== undefined) updateData.owner = body.owner;
    if (body.focusSector !== undefined) updateData.focusSector = body.focusSector;
    if (body.targetGroup !== undefined) updateData.targetGroup = body.targetGroup;
    if (body.shortDescription !== undefined) updateData.shortDescription = body.shortDescription;
    if (body.longDescription !== undefined) updateData.longDescription = body.longDescription;
    if (body.completionBonus !== undefined) updateData.completionBonus = body.completionBonus;
    if (body.unlockCondition !== undefined) updateData.unlockCondition = body.unlockCondition;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    const updated = await prisma.badgeCollection.update({
      where: { id },
      data: updateData,
      include: { category: { select: { id: true, name: true } }, _count: { select: { badges: true, achievementGoals: true } } },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'COLLECTION_UPDATE',
        description: `collectionId: ${id}`,
        entityType: 'badge_collection',
        entityId: 0,
      },
    });
    const data: AdminCollectionDetailResponse = {
      id: updated.id,
      name: updated.name,
      bannerUrl: updated.bannerUrl,
      owner: updated.owner,
      categoryId: updated.categoryId ?? undefined,
      categoryName: updated.category?.name ?? null,
      badgesCount: updated._count.badges,
      goalsCount: updated._count.achievementGoals,
      createdAt: updated.createdAt.toISOString(),
      focusSector: updated.focusSector,
      targetGroup: updated.targetGroup,
      shortDescription: updated.shortDescription,
      longDescription: updated.longDescription,
      unlockCondition: updated.unlockCondition,
      completionBonus: updated.completionBonus,
      updatedAt: updated.updatedAt.toISOString(),
      category: updated.category ? { id: updated.category.id, name: updated.category.name } : null,
    };
    return res.json({ success: true, data });
  })
);

router.delete(
  '/collections/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const collection = await prisma.badgeCollection.findUnique({ where: { id } });
    if (!collection) throw new NotFoundError('Koleksiyon bulunamadı');
    await prisma.badge.updateMany({ where: { collectionId: id }, data: { collectionId: null } });
    await prisma.badgeCollection.delete({ where: { id } });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'COLLECTION_DELETE',
        description: `collectionId: ${id}, name: ${collection.name}`,
        entityType: 'badge_collection',
        entityId: 0,
      },
    });
    return res.json({ success: true, message: 'Koleksiyon silindi' });
  })
);

/* ========== Admin Media (upload for banners, avatars, etc.) ========== */

router.post(
  '/media/upload',
  adminUpload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Dosya gerekli (field: file)' });
    }
    const ext = req.file.originalname?.split('.').pop()?.toLowerCase() || 'jpg';
    const allowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!allowedExt.includes(ext)) {
      return res.status(400).json({ success: false, message: 'Sadece JPG, PNG, GIF ve WebP desteklenir' });
    }
    const fileName = `admin/collections/${uuidv4()}.${ext}`;
    const path = await s3Service.uploadFile(fileName, req.file.buffer, req.file.mimetype);
    const url = resolveMediaUrl(path);
    return res.json({ success: true, data: { url: url ?? path } });
  })
);

/* ========== Admin Badge Categories ========== */

router.get(
  '/categories',
  asyncHandler(async (_req: Request, res: Response) => {
    const categories = await prisma.badgeCategory.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true },
    });
    const data: AdminBadgeCategoryListItem[] = categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
    }));
    return res.json({ success: true, data });
  })
);

/* ========== Admin Badges ========== */

router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [total, byType, byRarity] = await Promise.all([
      prisma.badge.count(),
      prisma.badge.groupBy({ by: ['type'], _count: { type: true } }),
      prisma.badge.groupBy({ by: ['rarity'], _count: { rarity: true } }),
    ]);
    const data: AdminBadgeStatsResponse = {
      total,
      byType: Object.fromEntries(byType.map((g) => [g.type, g._count.type])),
      byRarity: Object.fromEntries(byRarity.map((g) => [g.rarity, g._count.rarity])),
    };
    return res.json({ success: true, data });
  })
);

router.get(
  '/',
  validateQuery(AdminBadgesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      type?: string;
      rarity?: string;
      categoryId?: string;
      collectionId?: string;
      search?: string;
      sort: string;
      order: 'asc' | 'desc';
    };
    const where: {
      type?: string;
      rarity?: string;
      categoryId?: string;
      collectionId?: string | null;
      OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; description?: { contains: string; mode: 'insensitive' } }>;
    } = {};
    if (q.type) where.type = q.type;
    if (q.rarity) where.rarity = q.rarity;
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.collectionId !== undefined) where.collectionId = q.collectionId;
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [badges, total] = await Promise.all([
      prisma.badge.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: { category: { select: { id: true, name: true } }, collection: { select: { id: true, name: true } } },
      }),
      prisma.badge.count({ where }),
    ]);
    const data: AdminBadgeListItem[] = badges.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      imageUrl: b.imageUrl ? resolveMediaUrl(b.imageUrl, true) : null,
      type: b.type,
      rarity: b.rarity,
      categoryId: b.categoryId,
      categoryName: b.category?.name ?? null,
      collectionId: b.collectionId,
      collectionName: b.collection?.name ?? null,
      createdAt: b.createdAt.toISOString(),
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

router.get(
  '/:id/owners',
  validateQuery(AdminBadgeOwnersQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const q = req.query as unknown as { limit: number; offset: number; claimed?: boolean; sort: string; order: 'asc' | 'desc' };
    const badge = await prisma.badge.findUnique({ where: { id } });
    if (!badge) throw new NotFoundError('Badge bulunamadı');
    const where: { badgeId: string; claimed?: boolean } = { badgeId: id };
    if (q.claimed !== undefined) where.claimed = q.claimed;
    const [userBadges, total] = await Promise.all([
      prisma.userBadge.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: { user: { select: { email: true }, include: { profile: { select: { displayName: true } } } } },
      }),
      prisma.userBadge.count({ where }),
    ]);
    const data: AdminBadgeOwnerListItem[] = userBadges.map((ub) => ({
      id: ub.id,
      userId: ub.userId,
      badgeId: ub.badgeId,
      claimed: ub.claimed,
      claimedAt: ub.claimedAt?.toISOString() ?? null,
      createdAt: ub.createdAt.toISOString(),
      userEmail: ub.user.email ?? null,
      userDisplayName: ub.user.profile?.displayName ?? null,
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const badge = await prisma.badge.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true } }, collection: { select: { id: true, name: true } } },
    });
    if (!badge) throw new NotFoundError('Badge bulunamadı');
    const data: AdminBadgeDetailResponse = {
      id: badge.id,
      name: badge.name,
      description: badge.description,
      imageUrl: badge.imageUrl ? resolveMediaUrl(badge.imageUrl, true) : null,
      type: badge.type,
      rarity: badge.rarity,
      categoryId: badge.categoryId,
      categoryName: badge.category?.name ?? null,
      collectionId: badge.collectionId,
      collectionName: badge.collection?.name ?? null,
      createdAt: badge.createdAt.toISOString(),
      boostMultiplier: badge.boostMultiplier,
      rewardMultiplier: badge.rewardMultiplier,
      updatedAt: (badge as { updatedAt?: Date }).updatedAt?.toISOString() ?? null,
      category: badge.category ? { id: badge.category.id, name: badge.category.name } : null,
      collection: badge.collection ? { id: badge.collection.id, name: badge.collection.name } : null,
    };
    return res.json({ success: true, data });
  })
);

router.post(
  '/',
  validateBody(AdminCreateBadgeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const body = req.body as AdminCreateBadgeInput;
    const badge = await prisma.badge.create({
      data: {
        name: body.name,
        description: body.description ?? undefined,
        imageUrl: body.imageUrl ?? undefined,
        type: body.type,
        rarity: body.rarity,
        boostMultiplier: body.boostMultiplier ?? undefined,
        rewardMultiplier: body.rewardMultiplier ?? undefined,
        categoryId: body.categoryId,
        collectionId: body.collectionId ?? undefined,
      },
      include: { category: { select: { id: true, name: true } }, collection: { select: { id: true, name: true } } },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'BADGE_CREATE',
        description: `badgeId: ${badge.id}, name: ${badge.name}`,
        entityType: 'badge',
        entityId: 0,
      },
    });
    const data: AdminBadgeDetailResponse = {
      id: badge.id,
      name: badge.name,
      description: badge.description,
      imageUrl: badge.imageUrl ? resolveMediaUrl(badge.imageUrl, true) : null,
      type: badge.type,
      rarity: badge.rarity,
      categoryId: badge.categoryId,
      categoryName: badge.category?.name ?? null,
      collectionId: badge.collectionId,
      collectionName: badge.collection?.name ?? null,
      createdAt: badge.createdAt.toISOString(),
      boostMultiplier: badge.boostMultiplier,
      rewardMultiplier: badge.rewardMultiplier,
      updatedAt: (badge as { updatedAt?: Date }).updatedAt?.toISOString() ?? null,
      category: badge.category ? { id: badge.category.id, name: badge.category.name } : null,
      collection: badge.collection ? { id: badge.collection.id, name: badge.collection.name } : null,
    };
    return res.status(201).json({ success: true, data });
  })
);

router.patch(
  '/:id',
  validateBody(AdminUpdateBadgeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const body = req.body as AdminUpdateBadgeInput;
    const badge = await prisma.badge.findUnique({ where: { id } });
    if (!badge) throw new NotFoundError('Badge bulunamadı');
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.rarity !== undefined) updateData.rarity = body.rarity;
    if (body.boostMultiplier !== undefined) updateData.boostMultiplier = body.boostMultiplier;
    if (body.rewardMultiplier !== undefined) updateData.rewardMultiplier = body.rewardMultiplier;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.collectionId !== undefined) updateData.collectionId = body.collectionId;
    const updated = await prisma.badge.update({
      where: { id },
      data: updateData,
      include: { category: { select: { id: true, name: true } }, collection: { select: { id: true, name: true } } },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'BADGE_UPDATE',
        description: `badgeId: ${id}`,
        entityType: 'badge',
        entityId: 0,
      },
    });
    const data: AdminBadgeDetailResponse = {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      imageUrl: updated.imageUrl ? resolveMediaUrl(updated.imageUrl, true) : null,
      type: updated.type,
      rarity: updated.rarity,
      categoryId: updated.categoryId,
      categoryName: updated.category?.name ?? null,
      collectionId: updated.collectionId,
      collectionName: updated.collection?.name ?? null,
      createdAt: updated.createdAt.toISOString(),
      boostMultiplier: updated.boostMultiplier,
      rewardMultiplier: updated.rewardMultiplier,
      updatedAt: (updated as { updatedAt?: Date }).updatedAt?.toISOString() ?? null,
      category: updated.category ? { id: updated.category.id, name: updated.category.name } : null,
      collection: updated.collection ? { id: updated.collection.id, name: updated.collection.name } : null,
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
    const badge = await prisma.badge.findUnique({ where: { id } });
    if (!badge) throw new NotFoundError('Badge bulunamadı');
    await prisma.badge.delete({ where: { id } });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'BADGE_DELETE',
        description: `badgeId: ${id}, name: ${badge.name}`,
        entityType: 'badge',
        entityId: 0,
      },
    });
    return res.json({ success: true, message: 'Badge silindi' });
  })
);

export default router;
