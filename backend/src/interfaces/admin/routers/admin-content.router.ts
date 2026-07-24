import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError } from '../../../infrastructure/errors/custom-errors';
import { z } from 'zod';
import { resolveMediaUrl } from '../../../infrastructure/config/media.config';
import { generateIdForModel } from '../../../infrastructure/ids/id.strategy';
import logger from '../../../infrastructure/logger/logger';
import { PostService, type AdminCreateOptions } from '../../../application/post/post.service';
import { ContextType } from '../../../domain/content/context-type.enum';
import { ExperienceStatus } from '../../../domain/content/experience-status.enum';
import { createUpload } from '../../../infrastructure/config/file-upload.config';
import { validateFileType } from '../../../infrastructure/middleware/file-type-validation.middleware';
import { v4 as uuidv4 } from 'uuid';
import { S3Service } from '../../../infrastructure/s3/s3.service';

/** Map schema-level UPPER_CASE context type to domain enum (lowercase). */
const toContextType = (schemaValue: string): ContextType => {
  const map: Record<string, ContextType> = {
    PRODUCT: ContextType.PRODUCT,
    PRODUCT_GROUP: ContextType.PRODUCT_GROUP,
    SUB_CATEGORY: ContextType.SUB_CATEGORY,
  };
  const result = map[schemaValue];
  if (!result) throw new Error(`Unknown context type: ${schemaValue}`);
  return result;
};

// Import schemas
import {
  AdminContentPostsQuerySchema,
  AdminContentPostCreateSchema,
  AdminContentPostUpdateSchema,
  AdminContentCommentsQuerySchema,
  AdminContentCommentUpdateSchema,
  AdminFeedHighlightCreateSchema,
  AdminFeedHighlightUpdateSchema,
  AdminFeedHighlightsQuerySchema,
  AdminTrendingQuerySchema,
  AdminTrendingCreateSchema,
  AdminTrendingUpdateSchema,
  AdminTopCommunityChoicesQuerySchema,
  AdminTopCommunityChoiceCreateSchema,
  AdminTopCommunityChoiceUpdateSchema,
  AdminManualReviewFlagsQuerySchema,
  AdminManualReviewFlagUpdateSchema,
  AdminModerationActionsQuerySchema,
  AdminContentTagsQuerySchema,
  AdminExperienceSplitSchema,
  AdminTransferOwnerSchema,
  type AdminContentPostCreateInput,
} from '../schemas/admin-content.schemas';

// Import DTOs
import type {
  AdminContentPostsStatsResponse,
  AdminContentPostListItem,
  AdminContentPostDetailResponse,
  AdminContentCommentListItem,
  AdminContentCommentDetailResponse,
  AdminContentCommentStatsResponse,
  AdminFeedHighlightListItem,
  AdminFeedHighlightStatsResponse,
  AdminTrendingPostListItem,
  AdminTrendingPostStatsResponse,
  AdminTopCommunityChoiceListItem,
  AdminManualReviewFlagListItem,
  AdminManualReviewFlagDetailResponse,
  AdminModerationActionListItem,
  AdminModerationActionDetailResponse,
  AdminContentTagListItem,
  AdminContentTagsCategoriesStatsResponse,
} from '../dtos/admin-content.dto';

import type { PaginationMeta } from '../dtos/admin-common.dto';

const router = Router();
const prisma = getPrisma();
const postService = new PostService();
const s3Service = new S3Service();
const upload = createUpload('ADMIN_IMAGES', 'SMALL');

const TRENDING_TTL_DAYS = 7;

function computeTrendingExpiry(calculatedAt: Date): { expiresAt: string; daysRemaining: number; isExpired: boolean } {
  const expiresAt = new Date(calculatedAt);
  expiresAt.setDate(expiresAt.getDate() + TRENDING_TTL_DAYS);
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  return { expiresAt: expiresAt.toISOString(), daysRemaining, isExpired: diffMs <= 0 };
}

/**
 * Content Router - Handles all content moderation & management endpoints
 * Routes are mounted at /admin/content
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

/**
 * @openapi
 * /api/admin/content/posts/stats:
 *   get:
 *     summary: İçerik post istatistikleri (toplam, türe göre, boosted, event’e bağlı)
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: İstatistikler
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/posts/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [total, byTypeRows, boostedCount, withEventCount] = await Promise.all([
      prisma.contentPost.count(),
      prisma.contentPost.groupBy({ by: ['type'], _count: { id: true } }),
      prisma.contentPost.count({ where: { isBoosted: true } }),
      prisma.contentPost.count({ where: { eventId: { not: null } } }),
    ]);
    const byType: Record<string, number> = {};
    for (const row of byTypeRows) {
      byType[row.type] = row._count.id;
    }
    const data: AdminContentPostsStatsResponse = { total, byType, boostedCount, withEventCount };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /api/admin/content/posts/search:
 *   get:
 *     summary: Lightweight post search for autocomplete (returns id, title excerpt, author avatar & name)
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string, minLength: 3 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Search results
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/posts/search',
  validateQuery(
    z.object({
      q: z.string().min(3).max(200),
      limit: z.coerce.number().int().min(1).max(30).default(10),
    }),
  ),
  asyncHandler(async (req: Request, res: Response) => {
    const { q, limit } = req.query as { q: string; limit: number };
    const posts = await prisma.contentPost.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: 'insensitive' as const } },
          { body: { contains: q, mode: 'insensitive' as const } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        body: true,
        type: true,
        user: {
          select: {
            id: true,
            profile: {
              select: {
                displayName: true,
                userName: true,
              },
            },
            avatars: {
              where: { isActive: true },
              select: { imageUrl: true },
              take: 1,
            },
          },
        },
      },
    });
    const data = posts.map((p) => {
      const bodyExcerpt = p.body.length > 80 ? p.body.slice(0, 80) + '...' : p.body;
      const activeAvatar = p.user.avatars?.[0];
      const avatarUrl = activeAvatar ? resolveMediaUrl(activeAvatar.imageUrl, true) : null;
      return {
        id: p.id,
        title: p.title.length > 60 ? p.title.slice(0, 60) + '...' : p.title,
        bodyExcerpt,
        type: p.type,
        userDisplayName: p.user.profile?.displayName ?? null,
        userName: p.user.profile?.userName ?? null,
        avatarUrl,
      };
    });
    return res.json({ success: true, data });
  }),
);

/**
 * @openapi
 * /api/admin/content/posts:
 *   get:
 *     summary: Post listesi (sayfalama, filtre, arama)
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: userId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: eventId
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [createdAt, likesCount, commentsCount, viewsCount, title] }
 *       - in: query
 *         name: order
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200:
 *         description: Post listesi
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/posts',
  validateQuery(AdminContentPostsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as {
      limit: number;
      offset: number;
      type?: string;
      userId?: string;
      eventId?: string;
      mainCategoryId?: string;
      subCategoryId?: string;
      productId?: string;
      search?: string;
      sort: 'createdAt' | 'likesCount' | 'commentsCount' | 'viewsCount' | 'title';
      order: 'asc' | 'desc';
    };
    const where: Record<string, unknown> = {};
    if (q.type) where.type = q.type;
    if (q.userId) where.userId = q.userId;
    if (q.eventId) where.eventId = q.eventId;
    if (q.mainCategoryId) where.mainCategoryId = q.mainCategoryId;
    if (q.subCategoryId) where.subCategoryId = q.subCategoryId;
    if (q.productId) where.productId = q.productId;
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' as const } },
        { body: { contains: q.search, mode: 'insensitive' as const } },
      ];
    }
    const [posts, total] = await Promise.all([
      prisma.contentPost.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          user: { include: { profile: { select: { displayName: true, userName: true } } } },
          media: { select: { mediaUrl: true, orderIndex: true }, orderBy: { orderIndex: 'asc' }, take: 1 },
        },
      }),
      prisma.contentPost.count({ where }),
    ]);
    const data: AdminContentPostListItem[] = posts.map((p) => {
      const firstMedia = p.media?.[0];
      const thumbnailUrl = firstMedia ? resolveMediaUrl(firstMedia.mediaUrl, true) : null;
      return {
        id: p.id,
        userId: p.userId,
        type: p.type,
        title: p.title,
        bodyExcerpt: p.body.length > 200 ? p.body.slice(0, 200) + '...' : p.body,
        thumbnailUrl,
        createdAt: p.createdAt.toISOString(),
        likesCount: p.likesCount,
        commentsCount: p.commentsCount,
        favoritesCount: p.favoritesCount,
        viewsCount: p.viewsCount,
        isBoosted: p.isBoosted,
        boostedUntil: p.boostedUntil?.toISOString() ?? null,
        eventId: p.eventId,
        mainCategoryId: p.mainCategoryId,
        subCategoryId: p.subCategoryId,
        productId: p.productId,
        userDisplayName: p.user.profile?.displayName ?? null,
        userName: p.user.profile?.userName ?? null,
      };
    });
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/* ---- Experience Options (Duration, Location, Purpose) ---- */
/* ---- Content Post Image Upload ---- */
router.post(
  '/posts/upload-image',
  upload.single('file'),
  validateFileType('ADMIN_IMAGES'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File required (field: file)' });
    }
    const ext = req.file.originalname?.split('.').pop()?.toLowerCase() || 'jpg';
    const allowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!allowedExt.includes(ext)) {
      return res.status(400).json({ success: false, message: 'Only JPG, PNG, GIF and WebP supported' });
    }
    const fileName = `content-posts/${uuidv4()}.${ext}`;
    const path = await s3Service.uploadFile(fileName, req.file.buffer, req.file.mimetype);
    const url = resolveMediaUrl(path);
    logger.info({
      message: 'Content post image uploaded',
      fileName,
      url,
      adminId: req.user?.id,
    });
    return res.json({ success: true, data: { url: url ?? path } });
  })
);

/* IMPORTANT: Must be before /posts/:id to avoid :id capturing "experience" */
router.get(
  '/posts/experience/options',
  asyncHandler(async (_req: Request, res: Response) => {
    const options = await postService.getExperienceOptions();
    return res.json({ success: true, data: options });
  })
);

/**
 * @openapi
 * /api/admin/content/posts/{id}:
 *   get:
 *     summary: Tek post detayı
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Post detayı
 *       404:
 *         description: Post bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/posts/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const post = await prisma.contentPost.findUnique({
      where: { id },
      include: {
        user: { include: { profile: { select: { displayName: true, userName: true } } } },
        mainCategory: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
        productGroup: { select: { id: true, name: true } },
        event: { select: { id: true, title: true, status: true } },
        media: { select: { id: true, mediaUrl: true, orderIndex: true }, orderBy: { orderIndex: 'asc' } },
        question: { select: { id: true, expectedAnswerFormat: true, relatedProductId: true } },
        comparison: { select: { id: true, product1Id: true, product2Id: true, comparisonSummary: true } },
        tip: { select: { id: true, tipCategory: true, isVerified: true } },
        contentPostTags: { select: { tag: true } },
      },
    });
    if (!post) throw new NotFoundError('Post bulunamadı');
    const tags = post.contentPostTags?.map((t) => t.tag) ?? [];
    const media = post.media?.map((m) => ({ id: m.id, mediaUrl: resolveMediaUrl(m.mediaUrl, true), orderIndex: m.orderIndex })) ?? [];
    const data: AdminContentPostDetailResponse = {
      id: post.id,
      userId: post.userId,
      type: post.type,
      title: post.title,
      body: post.body,
      bodyExcerpt: post.body.length > 200 ? post.body.slice(0, 200) + '...' : post.body,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      favoritesCount: post.favoritesCount,
      viewsCount: post.viewsCount,
      sharesCount: post.sharesCount,
      isBoosted: post.isBoosted,
      boostedUntil: post.boostedUntil?.toISOString() ?? null,
      eventId: post.eventId,
      mainCategoryId: post.mainCategoryId,
      subCategoryId: post.subCategoryId,
      categoryId: post.categoryId,
      productGroupId: post.productGroupId,
      productId: post.productId,
      productStatus: post.productStatus,
      inventoryRequired: post.inventoryRequired,
      userDisplayName: post.user.profile?.displayName ?? null,
      userName: post.user.profile?.userName ?? null,
      user: {
        id: post.user.id,
        email: post.user.email,
        displayName: post.user.profile?.displayName ?? null,
        userName: post.user.profile?.userName ?? null,
      },
      mainCategory: post.mainCategory ?? undefined,
      subCategory: post.subCategory ?? undefined,
      category: post.category ?? undefined,
      product: post.product ?? undefined,
      productGroup: post.productGroup ?? undefined,
      event: post.event ?? undefined,
      media,
      tags,
      question: post.question ?? undefined,
      comparison: post.comparison ?? undefined,
      tip: post.tip ?? undefined,
      experienceDurationId: post.experienceDurationId,
      experienceLocationId: post.experienceLocationId,
      experiencePurposeId: post.experiencePurposeId,
      experienceSnippetId: post.experienceSnippetId,
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /api/admin/content/posts:
 *   post:
 *     summary: Yeni post oluştur (admin announcement/duyuru için)
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, type, title, body]
 *             properties:
 *               userId: { type: string, format: uuid }
 *               type: { type: string, enum: [FREE, TIPS, COMPARE, QUESTION, EXPERIENCE, UPDATE] }
 *               title: { type: string, minLength: 1, maxLength: 1000 }
 *               body: { type: string, minLength: 1, maxLength: 100000 }
 *               mainCategoryId: { type: string, format: uuid, nullable: true }
 *               subCategoryId: { type: string, format: uuid, nullable: true }
 *               categoryId: { type: string, nullable: true }
 *               productId: { type: string, nullable: true }
 *               productGroupId: { type: string, format: uuid, nullable: true }
 *               eventId: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Post oluşturuldu
 *       400:
 *         description: Invalid input
 *       404:
 *         description: User bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  '/posts',
  validateBody(AdminContentPostCreateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const body = req.body as AdminContentPostCreateInput;

    // Validate user exists
    const user = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!user) throw new NotFoundError('User bulunamadı');

    const adminOptions: AdminCreateOptions = {
      skipInventoryCheck: true,
      skipEventMembershipCheck: true,
      skipBoostPayment: true,
      adminId,
    };

    let result: { id: string; message: string; success: boolean };

    switch (body.type) {
      case 'FREE':
        result = await postService.createFreePost(body.userId, {
          contextType: toContextType(body.contextType),
          contextId: body.contextId,
          description: body.description,
          images: body.images,
          eventId: body.eventId ?? undefined,
        }, adminOptions);
        break;

      case 'TIPS':
        result = await postService.createTipsAndTricksPost(body.userId, {
          contextType: toContextType(body.contextType),
          contextId: body.contextId,
          description: body.description,
          benefitCategory: body.benefitCategory as import('../../../domain/content/tips-and-tricks-benefit-category.enum').TipsAndTricksBenefitCategory,
          images: body.images,
          eventId: body.eventId ?? undefined,
        }, adminOptions);
        break;

      case 'QUESTION':
        result = await postService.createQuestionPost(body.userId, {
          contextType: toContextType(body.contextType),
          contextId: body.contextId,
          description: body.description,
          boostEnabled: body.boostEnabled,
          images: body.images,
          eventId: body.eventId ?? undefined,
        }, adminOptions);
        break;

      case 'COMPARE':
        result = await postService.createBenchmarkPost(body.userId, {
          contextType: toContextType(body.contextType),
          contextId: body.contextId,
          products: body.products,
          description: body.description,
          images: body.images,
          eventId: body.eventId ?? undefined,
        }, adminOptions);
        break;

      case 'EXPERIENCE':
        result = await postService.createExperiencePost(body.userId, {
          contextType: toContextType(body.contextType),
          contextId: body.contextId,
          content: body.content,
          experience: body.experience.map((e) => ({
            type: e.type as import('../../../domain/content/experience-type.enum').ExperienceType,
            content: e.content,
            rating: e.rating,
          })),
          status: body.status as ExperienceStatus,
          selectedDurationId: body.selectedDurationId,
          selectedLocationId: body.selectedLocationId,
          selectedPurposeId: body.selectedPurposeId,
          experienceSnippetId: body.experienceSnippetId,
          images: body.images,
          eventId: body.eventId ?? undefined,
        }, adminOptions);
        break;

      case 'UPDATE':
        result = await postService.createUpdatePost(body.userId, {
          experiencePostId: body.experiencePostId,
          content: body.content,
          contextId: body.contextId,
          images: body.images,
          eventId: body.eventId ?? undefined,
        }, adminOptions);
        break;

      default:
        return res.status(400).json({ success: false, message: 'Unsupported post type' });
    }

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'CONTENT_POST_CREATE',
        description: `postId: ${result.id}, type: ${body.type}, userId: ${body.userId}`,
        entityType: 'content_post',
        entityId: 0,
      },
    });

    logger.info('Admin created content post via PostService', {
      adminId,
      postId: result.id,
      userId: body.userId,
      type: body.type,
    });

    // Fetch the created post with full details for response
    const post = await prisma.contentPost.findUnique({
      where: { id: result.id },
      include: {
        user: { include: { profile: { select: { displayName: true, userName: true } } } },
        mainCategory: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
        productGroup: { select: { id: true, name: true } },
        event: { select: { id: true, title: true, status: true } },
        media: { select: { id: true, mediaUrl: true, orderIndex: true }, orderBy: { orderIndex: 'asc' } },
        tags: { select: { tag: true } },
      },
    });

    if (!post) {
      return res.status(201).json({ success: true, data: { id: result.id, message: result.message } });
    }

    const media = post.media?.map((m) => ({ id: m.id, mediaUrl: resolveMediaUrl(m.mediaUrl, true), orderIndex: m.orderIndex })) ?? [];

    const data: AdminContentPostDetailResponse = {
      id: post.id,
      userId: post.userId,
      type: post.type,
      title: post.title,
      body: post.body,
      bodyExcerpt: post.body.length > 200 ? post.body.slice(0, 200) + '...' : post.body,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      favoritesCount: post.favoritesCount,
      viewsCount: post.viewsCount,
      sharesCount: post.sharesCount,
      isBoosted: post.isBoosted,
      boostedUntil: post.boostedUntil?.toISOString() ?? null,
      eventId: post.eventId,
      mainCategoryId: post.mainCategoryId,
      subCategoryId: post.subCategoryId,
      categoryId: post.categoryId,
      productGroupId: post.productGroupId,
      productId: post.productId,
      productStatus: post.productStatus,
      inventoryRequired: post.inventoryRequired,
      thumbnailUrl: null,
      userDisplayName: post.user.profile?.displayName ?? null,
      userName: post.user.profile?.userName ?? null,
      user: {
        id: post.user.id,
        email: post.user.email,
        displayName: post.user.profile?.displayName ?? null,
        userName: post.user.profile?.userName ?? null,
      },
      mainCategory: post.mainCategory ?? undefined,
      subCategory: post.subCategory ?? undefined,
      category: post.category ?? undefined,
      product: post.product ?? undefined,
      productGroup: post.productGroup ?? undefined,
      event: post.event ?? undefined,
      media,
      tags: post.tags?.map((t) => t.tag) ?? [],
      experienceDurationId: post.experienceDurationId,
      experienceLocationId: post.experienceLocationId,
      experiencePurposeId: post.experiencePurposeId,
      experienceSnippetId: post.experienceSnippetId,
    };

    return res.status(201).json({ success: true, data });
  })
);

/* ---- Experience Split (AI) ---- */
router.post(
  '/posts/experience/split',
  validateBody(AdminExperienceSplitSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, productId, content } = req.body;
    const result = await postService.splitExperience({ userId, productId, content });
    return res.json({ success: true, data: result });
  })
);

/* ---- Transfer Post Owner ---- */
router.patch(
  '/posts/:id/transfer-owner',
  validateBody(AdminTransferOwnerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const { newUserId } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const post = await tx.contentPost.findUnique({ where: { id } });
      if (!post) throw new NotFoundError('Post not found');

      const oldUserId = post.userId;
      const newUser = await tx.user.findUnique({ where: { id: newUserId } });
      if (!newUser) throw new NotFoundError('New user not found');

      // 1. Post sahibini değiştir
      await tx.contentPost.update({ where: { id }, data: { userId: newUserId } });

      // 2. EXPERIENCE post ise inventory taşı
      if (post.type === 'EXPERIENCE' && post.productId) {
        // Eski kullanıcının bu ürün için başka experience postu var mı
        const otherExperiencePosts = await tx.contentPost.count({
          where: {
            userId: oldUserId,
            productId: post.productId,
            type: 'EXPERIENCE',
            id: { not: id },
          },
        });

        // Başka experience post yoksa, eski kullanıcının inventory'sini sil
        if (otherExperiencePosts === 0) {
          await tx.inventory.deleteMany({
            where: { userId: oldUserId, productId: post.productId },
          });
        }

        // Yeni kullanıcıya inventory upsert
        await tx.inventory.upsert({
          where: {
            userId_productId: { userId: newUserId, productId: post.productId },
          },
          create: {
            userId: newUserId,
            productId: post.productId,
            hasOwned: post.productStatus === 'own',
            experienceSnippetId: post.experienceSnippetId ?? null,
            experienceDurationId: post.experienceDurationId ?? null,
            experienceLocationId: post.experienceLocationId ?? null,
            experiencePurposeId: post.experiencePurposeId ?? null,
          },
          update: {
            hasOwned: post.productStatus === 'own',
            experienceSnippetId: post.experienceSnippetId ?? undefined,
          },
        });
      }

      // 3. AiExperienceSplit userId güncelle
      if (post.experienceSnippetId) {
        await tx.aiExperienceSplit.update({
          where: { id: post.experienceSnippetId },
          data: { userId: newUserId },
        });
      }

      // 4. Admin log
      await tx.adminLog.create({
        data: {
          adminId,
          action: 'POST_TRANSFER_OWNER',
          description: `postId: ${id}, from: ${oldUserId}, to: ${newUserId}`,
          entityType: 'content_post',
          entityId: 0,
        },
      });

      return { oldUserId, newUserId };
    });

    logger.info('Admin transferred post owner', {
      adminId,
      postId: id,
      oldUserId: result.oldUserId,
      newUserId: result.newUserId,
    });

    // Return updated post
    const updatedPost = await prisma.contentPost.findUnique({
      where: { id },
      include: {
        user: { include: { profile: { select: { displayName: true, userName: true } } } },
        mainCategory: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
        productGroup: { select: { id: true, name: true } },
        event: { select: { id: true, title: true, status: true } },
        media: { select: { id: true, mediaUrl: true, orderIndex: true }, orderBy: { orderIndex: 'asc' } },
        tags: { select: { tag: true } },
      },
    });

    return res.json({ success: true, data: updatedPost });
  })
);

/**
 * @openapi
 * /api/admin/content/posts/{id}:
 *   patch:
 *     summary: Post güncelle (title, body, isBoosted, category vb.)
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               body: { type: string }
 *               isBoosted: { type: boolean }
 *               boostedUntil: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Post güncellendi
 *       404:
 *         description: Post bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  '/posts/:id',
  validateBody(AdminContentPostUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { id } = req.params;
    const body = req.body as {
      title?: string;
      body?: string;
      isBoosted?: boolean;
      boostedUntil?: string | null;
      mainCategoryId?: string | null;
      subCategoryId?: string | null;
      categoryId?: string | null;
      productGroupId?: string | null;
      productId?: string | null;
      eventId?: string | null;
      images?: string[];
    };
    const post = await prisma.contentPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundError('Post bulunamadı');
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.body !== undefined) updateData.body = body.body;
    if (body.isBoosted !== undefined) updateData.isBoosted = body.isBoosted;
    if (body.boostedUntil !== undefined) updateData.boostedUntil = body.boostedUntil ? new Date(body.boostedUntil) : null;
    if (body.mainCategoryId !== undefined) updateData.mainCategoryId = body.mainCategoryId;
    if (body.subCategoryId !== undefined) updateData.subCategoryId = body.subCategoryId;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.productGroupId !== undefined) updateData.productGroupId = body.productGroupId;
    if (body.productId !== undefined) updateData.productId = body.productId;
    if (body.eventId !== undefined) updateData.eventId = body.eventId;

    const changedFields = [
      ...Object.keys(updateData),
      ...(body.images !== undefined ? ['images'] : []),
    ];
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    if (Object.keys(updateData).length > 0) {
      ops.push(prisma.contentPost.update({ where: { id }, data: updateData }));
    }
    // images verildiyse mevcut medyayı tamamen değiştir (post sahibinin userId'siyle)
    if (body.images !== undefined) {
      ops.push(prisma.postMedia.deleteMany({ where: { postId: id } }));
      if (body.images.length > 0) {
        ops.push(
          prisma.postMedia.createMany({
            data: body.images.map((imageUrl, index) => ({
              postId: id,
              userId: post.userId,
              mediaUrl: imageUrl,
              orderIndex: index,
            })),
          })
        );
      }
    }
    ops.push(
      prisma.adminLog.create({
        data: {
          adminId,
          action: 'CONTENT_POST_UPDATE',
          description: `postId: ${id}, fields: ${changedFields.join(',')}`,
          entityType: 'content_post',
          entityId: 0,
        },
      })
    );
    await prisma.$transaction(ops);
    const updated = await prisma.contentPost.findUnique({
      where: { id },
      include: {
        user: { include: { profile: { select: { displayName: true, userName: true } } } },
        media: { select: { mediaUrl: true, orderIndex: true }, orderBy: { orderIndex: 'asc' }, take: 1 },
      },
    });
    const p = updated!;
    const firstMedia = p.media?.[0];
    const thumbnailUrl = firstMedia ? resolveMediaUrl(firstMedia.mediaUrl, true) : null;
    const data: AdminContentPostListItem = {
      id: p.id,
      userId: p.userId,
      type: p.type,
      title: p.title,
      bodyExcerpt: p.body.length > 200 ? p.body.slice(0, 200) + '...' : p.body,
      thumbnailUrl,
      createdAt: p.createdAt.toISOString(),
      likesCount: p.likesCount,
      commentsCount: p.commentsCount,
      favoritesCount: p.favoritesCount,
      viewsCount: p.viewsCount,
      isBoosted: p.isBoosted,
      boostedUntil: p.boostedUntil?.toISOString() ?? null,
      eventId: p.eventId,
      mainCategoryId: p.mainCategoryId,
      subCategoryId: p.subCategoryId,
      productId: p.productId,
      userDisplayName: p.user.profile?.displayName ?? null,
      userName: p.user.profile?.userName ?? null,
    };
    return res.json({ success: true, message: 'Post güncellendi', data });
  })
);

/**
 * @openapi
 * /api/admin/content/posts/{id}:
 *   delete:
 *     summary: "Post sil (cascade: yorumlar, beğeniler vb.)"
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Post silindi
 *       404:
 *         description: Post bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete(
  '/posts/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { id } = req.params;
    const post = await prisma.contentPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundError('Post bulunamadı');
    await prisma.contentPost.delete({ where: { id } });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'CONTENT_POST_DELETE',
        description: `postId: ${id}, title: ${post.title}`,
        entityType: 'content_post',
        entityId: 0,
      },
    });
    return res.json({ success: true, message: 'Post silindi', data: { id } });
  })
);

/**
 * @openapi
 * /api/admin/content/comments/stats:
 *   get:
 *     summary: Yorum istatistikleri
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: İstatistikler
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/comments/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const total = await prisma.contentComment.count();
    const data: AdminContentCommentStatsResponse = { total };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /api/admin/content/comments:
 *   get:
 *     summary: Yorum listesi (sayfalama, postId, userId filtreleri)
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: postId
 *         schema: { type: string }
 *       - in: query
 *         name: userId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Yorum listesi
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/comments',
  validateQuery(AdminContentCommentsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as {
      limit: number;
      offset: number;
      postId?: string;
      userId?: string;
      parentIdNull?: boolean;
      sort: string;
      order: 'asc' | 'desc';
    };
    const where: Record<string, unknown> = {};
    if (q.postId) where.postId = q.postId;
    if (q.userId) where.userId = q.userId;
    if (q.parentIdNull === true) where.parentId = null;
    if (q.parentIdNull === false) where.parentId = { not: null };
    const [comments, total] = await Promise.all([
      prisma.contentComment.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          user: { include: { profile: { select: { displayName: true, userName: true } } } },
          post: { select: { title: true } },
        },
      }),
      prisma.contentComment.count({ where }),
    ]);
    const data: AdminContentCommentListItem[] = comments.map((c) => ({
      id: c.id,
      postId: c.postId,
      userId: c.userId,
      parentId: c.parentId,
      comment: c.comment,
      commentExcerpt: c.comment.length > 150 ? c.comment.slice(0, 150) + '...' : c.comment,
      isAnswer: c.isAnswer,
      likesCount: c.likesCount,
      createdAt: c.createdAt.toISOString(),
      userDisplayName: c.user.profile?.displayName ?? null,
      userName: c.user.profile?.userName ?? null,
      postTitle: c.post?.title ?? null,
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /api/admin/content/comments/{id}:
 *   get:
 *     summary: Tek yorum detayı
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Yorum detayı
 *       404:
 *         description: Yorum bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/comments/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const comment = await prisma.contentComment.findUnique({
      where: { id },
      include: {
        user: { include: { profile: { select: { displayName: true, userName: true } } } },
        post: { select: { id: true, title: true, type: true } },
        _count: { select: { replies: true } },
      },
    });
    if (!comment) throw new NotFoundError('Yorum bulunamadı');
    const data: AdminContentCommentDetailResponse = {
      id: comment.id,
      postId: comment.postId,
      userId: comment.userId,
      parentId: comment.parentId,
      comment: comment.comment,
      commentExcerpt: comment.comment.length > 150 ? comment.comment.slice(0, 150) + '...' : comment.comment,
      isAnswer: comment.isAnswer,
      likesCount: comment.likesCount,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      userDisplayName: comment.user.profile?.displayName ?? null,
      userName: comment.user.profile?.userName ?? null,
      postTitle: comment.post?.title ?? null,
      post: comment.post ?? undefined,
      user: {
        id: comment.user.id,
        email: comment.user.email,
        displayName: comment.user.profile?.displayName ?? null,
        userName: comment.user.profile?.userName ?? null,
      },
      repliesCount: comment._count.replies,
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /api/admin/content/comments/{id}:
 *   patch:
 *     summary: Yorum güncelle (body)
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Yorum güncellendi
 *       404:
 *         description: Yorum bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  '/comments/:id',
  validateBody(AdminContentCommentUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { id } = req.params;
    const body = req.body as { comment?: string };
    const comment = await prisma.contentComment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundError('Yorum bulunamadı');
    if (body.comment !== undefined) {
      await prisma.contentComment.update({ where: { id }, data: { comment: body.comment } });
    }
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'CONTENT_COMMENT_UPDATE',
        description: `commentId: ${id}`,
        entityType: 'content_comment',
        entityId: 0,
      },
    });
    const updated = await prisma.contentComment.findUnique({
      where: { id },
      include: { user: { include: { profile: { select: { displayName: true, userName: true } } } }, post: { select: { title: true } } },
    });
    const c = updated!;
    const data: AdminContentCommentListItem = {
      id: c.id,
      postId: c.postId,
      userId: c.userId,
      parentId: c.parentId,
      comment: c.comment,
      commentExcerpt: c.comment.length > 150 ? c.comment.slice(0, 150) + '...' : c.comment,
      isAnswer: c.isAnswer,
      likesCount: c.likesCount,
      createdAt: c.createdAt.toISOString(),
      userDisplayName: c.user.profile?.displayName ?? null,
      userName: c.user.profile?.userName ?? null,
      postTitle: c.post?.title ?? null,
    };
    return res.json({ success: true, message: 'Yorum güncellendi', data });
  })
);

/**
 * @openapi
 * /api/admin/content/comments/{id}:
 *   delete:
 *     summary: Yorum sil
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Yorum silindi
 *       404:
 *         description: Yorum bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete(
  '/comments/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { id } = req.params;
    const comment = await prisma.contentComment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundError('Yorum bulunamadı');
    await prisma.contentComment.delete({ where: { id } });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'CONTENT_COMMENT_DELETE',
        description: `commentId: ${id}`,
        entityType: 'content_comment',
        entityId: 0,
      },
    });
    return res.json({ success: true, message: 'Yorum silindi', data: { id } });
  })
);

/**
 * @openapi
 * /api/admin/content/feed-highlights:
 *   get:
 *     summary: Feed highlight listesi
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: postId
 *         schema: { type: string }
 *       - in: query
 *         name: reason
 *         schema: { type: string, enum: [MOST_LIKED, STAFF_PICK, BOOSTED] }
 *     responses:
 *       200:
 *         description: Feed highlight listesi
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

/**
 * @swagger
 * /api/admin/content/feed-highlights/stats:
 *   get:
 *     tags: [Admin - Content]
 *     summary: Get feed highlights statistics
 *     responses:
 *       200:
 *         description: Feed highlights stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: number
 *                 active:
 *                   type: number
 */
router.get(
  '/feed-highlights/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const total = await prisma.feedHighlight.count();

    // Active highlights (highlighted within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const active = await prisma.feedHighlight.count({
      where: { highlightedAt: { gte: thirtyDaysAgo } },
    });

    const data: AdminFeedHighlightStatsResponse = {
      total,
      active,
    };

    return res.json({ success: true, data });
  })
);

router.get(
  '/feed-highlights',
  validateQuery(AdminFeedHighlightsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as { limit: number; offset: number; postId?: string; reason?: string; sort: string; order: 'asc' | 'desc' };
    const where: Record<string, unknown> = {};
    if (q.postId) where.postId = q.postId;
    if (q.reason) where.reason = q.reason;
    const [rows, total] = await Promise.all([
      prisma.feedHighlight.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          post: {
            include: {
              user: {
                include: {
                  profile: { select: { displayName: true } },
                  avatars: { where: { isActive: true }, select: { imageUrl: true }, take: 1 },
                },
              },
            },
          },
        },
      }),
      prisma.feedHighlight.count({ where }),
    ]);
    const data: AdminFeedHighlightListItem[] = rows.map((r) => {
      const activeAvatar = r.post?.user?.avatars?.[0];
      return {
        id: r.id,
        postId: r.postId,
        reason: r.reason,
        highlightedAt: r.highlightedAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        postTitle: r.post?.title ?? null,
        postType: r.post?.type ?? null,
        bodyExcerpt: r.post?.body ? (r.post.body.length > 100 ? r.post.body.slice(0, 100) + '...' : r.post.body) : null,
        userDisplayName: r.post?.user?.profile?.displayName ?? null,
        avatarUrl: activeAvatar ? resolveMediaUrl(activeAvatar.imageUrl, true) : null,
      };
    });
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /api/admin/content/feed-highlights:
 *   post:
 *     summary: Feed highlight ekle
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [postId, reason]
 *             properties:
 *               postId: { type: string }
 *               reason: { type: string, enum: [MOST_LIKED, STAFF_PICK, BOOSTED] }
 *     responses:
 *       201:
 *         description: Feed highlight oluşturuldu
 *       404:
 *         description: Post bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  '/feed-highlights',
  validateBody(AdminFeedHighlightCreateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const body = req.body as { postId: string; reason: string };
    const post = await prisma.contentPost.findUnique({ where: { id: body.postId } });
    if (!post) throw new NotFoundError('Post bulunamadı');
    const id = generateIdForModel('FeedHighlight');
    const created = await prisma.feedHighlight.create({
      data: { id, postId: body.postId, reason: body.reason as 'MOST_LIKED' | 'STAFF_PICK' | 'BOOSTED' },
      include: { post: { include: { user: { include: { profile: { select: { displayName: true } }, avatars: { where: { isActive: true }, select: { imageUrl: true }, take: 1 } } } } } },
    });
    await prisma.adminLog.create({
      data: { adminId, action: 'FEED_HIGHLIGHT_CREATE', description: `postId: ${body.postId}, reason: ${body.reason}`, entityType: 'feed_highlight', entityId: 0 },
    });
    const createdAvatar = created.post?.user?.avatars?.[0];
    const data: AdminFeedHighlightListItem = {
      id: created.id,
      postId: created.postId,
      reason: created.reason,
      highlightedAt: created.highlightedAt.toISOString(),
      createdAt: created.createdAt.toISOString(),
      postTitle: created.post?.title ?? null,
      postType: created.post?.type ?? null,
      bodyExcerpt: created.post?.body ? (created.post.body.length > 100 ? created.post.body.slice(0, 100) + '...' : created.post.body) : null,
      userDisplayName: created.post?.user?.profile?.displayName ?? null,
      avatarUrl: createdAvatar ? resolveMediaUrl(createdAvatar.imageUrl, true) : null,
    };
    return res.status(201).json({ success: true, data });
  })
);

/**
 * @openapi
 * /api/admin/content/feed-highlights/{id}:
 *   patch:
 *     summary: Feed highlight güncelle (reason)
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Güncellendi
 *       404:
 *         description: Feed highlight bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  '/feed-highlights/:id',
  validateBody(AdminFeedHighlightUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { id } = req.params;
    const body = req.body as { reason?: string };
    const existing = await prisma.feedHighlight.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Feed highlight bulunamadı');
    const updated = await prisma.feedHighlight.update({
      where: { id },
      data: body.reason ? { reason: body.reason as 'MOST_LIKED' | 'STAFF_PICK' | 'BOOSTED' } : undefined,
      include: { post: { include: { user: { include: { profile: { select: { displayName: true } }, avatars: { where: { isActive: true }, select: { imageUrl: true }, take: 1 } } } } } },
    });
    await prisma.adminLog.create({
      data: { adminId, action: 'FEED_HIGHLIGHT_UPDATE', description: `id: ${id}`, entityType: 'feed_highlight', entityId: 0 },
    });
    const updatedAvatar = updated.post?.user?.avatars?.[0];
    const data: AdminFeedHighlightListItem = {
      id: updated.id,
      postId: updated.postId,
      reason: updated.reason,
      highlightedAt: updated.highlightedAt.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      postTitle: updated.post?.title ?? null,
      postType: updated.post?.type ?? null,
      bodyExcerpt: updated.post?.body ? (updated.post.body.length > 100 ? updated.post.body.slice(0, 100) + '...' : updated.post.body) : null,
      userDisplayName: updated.post?.user?.profile?.displayName ?? null,
      avatarUrl: updatedAvatar ? resolveMediaUrl(updatedAvatar.imageUrl, true) : null,
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /api/admin/content/feed-highlights/{id}:
 *   delete:
 *     summary: Feed highlight kaldır
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Kaldırıldı
 *       404:
 *         description: Feed highlight bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete(
  '/feed-highlights/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { id } = req.params;
    const existing = await prisma.feedHighlight.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Feed highlight bulunamadı');
    await prisma.feedHighlight.delete({ where: { id } });
    await prisma.adminLog.create({
      data: { adminId, action: 'FEED_HIGHLIGHT_DELETE', description: `id: ${id}`, entityType: 'feed_highlight', entityId: 0 },
    });
    return res.json({ success: true, message: 'Feed highlight kaldırıldı' });
  })
);

/**
 * @swagger
 * /api/admin/content/trending/stats:
 *   get:
 *     tags: [Admin - Content]
 *     summary: Get trending posts statistics
 *     responses:
 *       200:
 *         description: Trending posts stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: number
 *                 thisWeek:
 *                   type: number
 */
router.get(
  '/trending/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const total = await prisma.trendingPost.count();

    // Trending posts calculated this week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);
    const thisWeek = await prisma.trendingPost.count({
      where: { calculatedAt: { gte: startOfWeek } },
    });

    const data: AdminTrendingPostStatsResponse = {
      total,
      thisWeek,
    };

    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /api/admin/content/trending:
 *   get:
 *     summary: Trending post listesi
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: trendPeriod
 *         schema: { type: string, enum: [DAILY, WEEKLY] }
 *     responses:
 *       200:
 *         description: Trending listesi
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/trending',
  validateQuery(AdminTrendingQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as { limit: number; offset: number; trendPeriod?: string; sort: string; order: 'asc' | 'desc' };
    const where: Record<string, unknown> = {};
    if (q.trendPeriod) where.trendPeriod = q.trendPeriod;
    const [rows, total] = await Promise.all([
      prisma.trendingPost.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          post: {
            include: {
              user: {
                include: {
                  profile: { select: { displayName: true } },
                  avatars: { where: { isActive: true }, select: { imageUrl: true }, take: 1 },
                },
              },
            },
          },
        },
      }),
      prisma.trendingPost.count({ where }),
    ]);
    const data: AdminTrendingPostListItem[] = rows.map((r) => {
      const avatar = r.post?.user?.avatars?.[0];
      const expiry = computeTrendingExpiry(r.calculatedAt);
      return {
        id: r.id,
        postId: r.postId,
        score: r.score,
        trendPeriod: r.trendPeriod,
        calculatedAt: r.calculatedAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        ...expiry,
        postTitle: r.post?.title ?? null,
        postType: r.post?.type ?? null,
        bodyExcerpt: r.post?.body ? (r.post.body.length > 100 ? r.post.body.slice(0, 100) + '...' : r.post.body) : null,
        userDisplayName: r.post?.user?.profile?.displayName ?? null,
        avatarUrl: avatar ? resolveMediaUrl(avatar.imageUrl, true) : null,
      };
    });
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /api/admin/content/trending:
 *   post:
 *     summary: Trending’e post ekle
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [postId, trendPeriod]
 *             properties:
 *               postId: { type: string }
 *               trendPeriod: { type: string, enum: [DAILY, WEEKLY] }
 *               score: { type: number }
 *     responses:
 *       201:
 *         description: Eklendi
 *       404:
 *         description: Post bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  '/trending',
  validateBody(AdminTrendingCreateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const body = req.body as { postId: string; trendPeriod: string; score?: number };
    const post = await prisma.contentPost.findUnique({ where: { id: body.postId } });
    if (!post) throw new NotFoundError('Post bulunamadı');
    const id = generateIdForModel('TrendingPost');
    const created = await prisma.trendingPost.create({
      data: {
        id,
        postId: body.postId,
        trendPeriod: body.trendPeriod as 'DAILY' | 'WEEKLY',
        score: body.score ?? 0,
      },
      include: { post: { include: { user: { include: { profile: { select: { displayName: true } }, avatars: { where: { isActive: true }, select: { imageUrl: true }, take: 1 } } } } } },
    });
    await prisma.adminLog.create({
      data: { adminId, action: 'TRENDING_POST_CREATE', description: `postId: ${body.postId}, period: ${body.trendPeriod}`, entityType: 'trending_post', entityId: 0 },
    });
    const createdTrendAvatar = created.post?.user?.avatars?.[0];
    const createdExpiry = computeTrendingExpiry(created.calculatedAt);
    const data: AdminTrendingPostListItem = {
      id: created.id,
      postId: created.postId,
      score: created.score,
      trendPeriod: created.trendPeriod,
      calculatedAt: created.calculatedAt.toISOString(),
      createdAt: created.createdAt.toISOString(),
      ...createdExpiry,
      postTitle: created.post?.title ?? null,
      postType: created.post?.type ?? null,
      bodyExcerpt: created.post?.body ? (created.post.body.length > 100 ? created.post.body.slice(0, 100) + '...' : created.post.body) : null,
      userDisplayName: created.post?.user?.profile?.displayName ?? null,
      avatarUrl: createdTrendAvatar ? resolveMediaUrl(createdTrendAvatar.imageUrl, true) : null,
    };
    return res.status(201).json({ success: true, data });
  })
);

/**
 * @openapi
 * /api/admin/content/trending/{id}:
 *   patch:
 *     summary: Trending kaydı güncelle (score, trendPeriod)
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Güncellendi
 *       404:
 *         description: Trending post bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  '/trending/:id',
  validateBody(AdminTrendingUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { id } = req.params;
    const body = req.body as { score?: number; trendPeriod?: string; refresh?: boolean };
    const existing = await prisma.trendingPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Trending post bulunamadı');
    const updateData: Record<string, unknown> = {};
    if (body.score !== undefined) updateData.score = body.score;
    if (body.trendPeriod !== undefined) updateData.trendPeriod = body.trendPeriod;
    if (body.refresh) updateData.calculatedAt = new Date();
    const updated = await prisma.trendingPost.update({
      where: { id },
      data: updateData,
      include: { post: { include: { user: { include: { profile: { select: { displayName: true } }, avatars: { where: { isActive: true }, select: { imageUrl: true }, take: 1 } } } } } },
    });
    await prisma.adminLog.create({
      data: { adminId, action: 'TRENDING_POST_UPDATE', description: `id: ${id}`, entityType: 'trending_post', entityId: 0 },
    });
    const updatedTrendAvatar = updated.post?.user?.avatars?.[0];
    const updatedExpiry = computeTrendingExpiry(updated.calculatedAt);
    const data: AdminTrendingPostListItem = {
      id: updated.id,
      postId: updated.postId,
      score: updated.score,
      trendPeriod: updated.trendPeriod,
      calculatedAt: updated.calculatedAt.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      ...updatedExpiry,
      postTitle: updated.post?.title ?? null,
      postType: updated.post?.type ?? null,
      bodyExcerpt: updated.post?.body ? (updated.post.body.length > 100 ? updated.post.body.slice(0, 100) + '...' : updated.post.body) : null,
      userDisplayName: updated.post?.user?.profile?.displayName ?? null,
      avatarUrl: updatedTrendAvatar ? resolveMediaUrl(updatedTrendAvatar.imageUrl, true) : null,
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /api/admin/content/trending/{id}:
 *   delete:
 *     summary: Trending’den kaldır
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Kaldırıldı
 *       404:
 *         description: Trending post bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete(
  '/trending/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { id } = req.params;
    const existing = await prisma.trendingPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Trending post bulunamadı');
    await prisma.trendingPost.delete({ where: { id } });
    await prisma.adminLog.create({
      data: { adminId, action: 'TRENDING_POST_DELETE', description: `id: ${id}`, entityType: 'trending_post', entityId: 0 },
    });
    return res.json({ success: true, message: 'Trending\'den kaldırıldı' });
  })
);

/**
 * @openapi
 * /api/admin/content/top-community-choices:
 *   get:
 *     summary: Top community choice listesi
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: postId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Liste
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/top-community-choices',
  validateQuery(AdminTopCommunityChoicesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as { limit: number; offset: number; postId?: string; sort: string; order: 'asc' | 'desc' };
    const where: Record<string, unknown> = {};
    if (q.postId) where.postId = q.postId;
    const [rows, total] = await Promise.all([
      prisma.topCommunityChoice.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: { post: { select: { title: true } } },
      }),
      prisma.topCommunityChoice.count({ where }),
    ]);
    const data: AdminTopCommunityChoiceListItem[] = rows.map((r) => ({
      id: r.id,
      postId: r.postId,
      reason: r.reason,
      badgeLabel: r.badgeLabel,
      awardedAt: r.awardedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      postTitle: r.post?.title ?? null,
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /api/admin/content/top-community-choices:
 *   post:
 *     summary: Top community choice ekle
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [postId, badgeLabel]
 *             properties:
 *               postId: { type: string }
 *               reason: { type: string, nullable: true }
 *               badgeLabel: { type: string }
 *     responses:
 *       201:
 *         description: Eklendi
 *       404:
 *         description: Post bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  '/top-community-choices',
  validateBody(AdminTopCommunityChoiceCreateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const body = req.body as { postId: string; reason?: string | null; badgeLabel: string };
    const post = await prisma.contentPost.findUnique({ where: { id: body.postId } });
    if (!post) throw new NotFoundError('Post bulunamadı');
    const created = await prisma.topCommunityChoice.create({
      data: { postId: body.postId, reason: body.reason ?? null, badgeLabel: body.badgeLabel },
      include: { post: { select: { title: true } } },
    });
    await prisma.adminLog.create({
      data: { adminId, action: 'TOP_COMMUNITY_CHOICE_CREATE', description: `postId: ${body.postId}`, entityType: 'top_community_choice', entityId: 0 },
    });
    const data: AdminTopCommunityChoiceListItem = {
      id: created.id,
      postId: created.postId,
      reason: created.reason,
      badgeLabel: created.badgeLabel,
      awardedAt: created.awardedAt.toISOString(),
      createdAt: created.createdAt.toISOString(),
      postTitle: created.post?.title ?? null,
    };
    return res.status(201).json({ success: true, data });
  })
);

/**
 * @openapi
 * /api/admin/content/top-community-choices/{id}:
 *   patch:
 *     summary: Top community choice güncelle (reason, badgeLabel)
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Güncellendi
 *       404:
 *         description: Bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  '/top-community-choices/:id',
  validateBody(AdminTopCommunityChoiceUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { id } = req.params;
    const body = req.body as { reason?: string | null; badgeLabel?: string };
    const existing = await prisma.topCommunityChoice.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Top community choice bulunamadı');
    const updateData: Record<string, unknown> = {};
    if (body.reason !== undefined) updateData.reason = body.reason;
    if (body.badgeLabel !== undefined) updateData.badgeLabel = body.badgeLabel;
    const updated = await prisma.topCommunityChoice.update({
      where: { id },
      data: updateData,
      include: { post: { select: { title: true } } },
    });
    await prisma.adminLog.create({
      data: { adminId, action: 'TOP_COMMUNITY_CHOICE_UPDATE', description: `id: ${id}`, entityType: 'top_community_choice', entityId: 0 },
    });
    const data: AdminTopCommunityChoiceListItem = {
      id: updated.id,
      postId: updated.postId,
      reason: updated.reason,
      badgeLabel: updated.badgeLabel,
      awardedAt: updated.awardedAt.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      postTitle: updated.post?.title ?? null,
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /api/admin/content/top-community-choices/{id}:
 *   delete:
 *     summary: Top community choice kaldır
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Kaldırıldı
 *       404:
 *         description: Bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete(
  '/top-community-choices/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { id } = req.params;
    const existing = await prisma.topCommunityChoice.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Top community choice bulunamadı');
    await prisma.topCommunityChoice.delete({ where: { id } });
    await prisma.adminLog.create({
      data: { adminId, action: 'TOP_COMMUNITY_CHOICE_DELETE', description: `id: ${id}`, entityType: 'top_community_choice', entityId: 0 },
    });
    return res.json({ success: true, message: 'Kaldırıldı' });
  })
);

/**
 * @openapi
 * /api/admin/content/manual-review-flags:
 *   get:
 *     summary: Manual review flag listesi
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: contentType
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Liste
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/manual-review-flags',
  validateQuery(AdminManualReviewFlagsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as { limit: number; offset: number; status?: string; contentType?: string; sort: string; order: 'asc' | 'desc' };
    const where: Record<string, unknown> = {};
    if (q.status) where.status = q.status;
    if (q.contentType) where.contentType = q.contentType;
    const [rows, total] = await Promise.all([
      prisma.manualReviewFlag.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: { flaggedByUser: { select: { id: true, email: true, profile: { select: { displayName: true, userName: true } } } } },
      }),
      prisma.manualReviewFlag.count({ where }),
    ]);
    const data: AdminManualReviewFlagListItem[] = rows.map((r) => ({
      id: r.id,
      flaggedByUserId: r.flaggedByUserId,
      contentType: r.contentType,
      contentId: r.contentId,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      flaggedByUserEmail: r.flaggedByUser.email ?? null,
      flaggedByUserDisplayName: r.flaggedByUser.profile?.displayName ?? null,
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /api/admin/content/manual-review-flags/{id}:
 *   get:
 *     summary: Tek manual review flag detayı
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Flag detayı
 *       404:
 *         description: Bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/manual-review-flags/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const flag = await prisma.manualReviewFlag.findUnique({
      where: { id },
      include: { flaggedByUser: { select: { id: true, email: true, profile: { select: { displayName: true, userName: true } } } } },
    });
    if (!flag) throw new NotFoundError('Manual review flag bulunamadı');
    const data: AdminManualReviewFlagDetailResponse = {
      id: flag.id,
      flaggedByUserId: flag.flaggedByUserId,
      contentType: flag.contentType,
      contentId: flag.contentId,
      reason: flag.reason,
      status: flag.status,
      createdAt: flag.createdAt.toISOString(),
      updatedAt: flag.updatedAt.toISOString(),
      flaggedByUserEmail: flag.flaggedByUser.email ?? null,
      flaggedByUserDisplayName: flag.flaggedByUser.profile?.displayName ?? null,
      contentSummary: `${flag.contentType}#${flag.contentId}`,
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /api/admin/content/manual-review-flags/{id}:
 *   patch:
 *     summary: Manual review flag güncelle (status)
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string }
 *     responses:
 *       200:
 *         description: Güncellendi
 *       404:
 *         description: Bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  '/manual-review-flags/:id',
  validateBody(AdminManualReviewFlagUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { id } = req.params;
    const body = req.body as { status?: string };
    const flag = await prisma.manualReviewFlag.findUnique({ where: { id } });
    if (!flag) throw new NotFoundError('Manual review flag bulunamadı');
    const updateData: Record<string, unknown> = {};
    if (body.status !== undefined) updateData.status = body.status;
    await prisma.manualReviewFlag.update({ where: { id }, data: updateData });
    await prisma.adminLog.create({
      data: { adminId, action: 'MANUAL_REVIEW_FLAG_UPDATE', description: `id: ${id}, status: ${body.status ?? flag.status}`, entityType: 'manual_review_flag', entityId: 0 },
    });
    const updated = await prisma.manualReviewFlag.findUnique({
      where: { id },
      include: { flaggedByUser: { select: { email: true }, include: { profile: { select: { displayName: true } } } } },
    });
    const r = updated!;
    const data: AdminManualReviewFlagListItem = {
      id: r.id,
      flaggedByUserId: r.flaggedByUserId,
      contentType: r.contentType,
      contentId: r.contentId,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      flaggedByUserEmail: r.flaggedByUser.email ?? null,
      flaggedByUserDisplayName: r.flaggedByUser.profile?.displayName ?? null,
    };
    return res.json({ success: true, message: 'Güncellendi', data });
  })
);

/**
 * @openapi
 * /api/admin/content/moderation-actions:
 *   get:
 *     summary: Moderation action listesi
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: targetUserId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: contentType
 *         schema: { type: string }
 *       - in: query
 *         name: actionType
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Liste
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/moderation-actions',
  validateQuery(AdminModerationActionsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as { limit: number; offset: number; targetUserId?: string; contentType?: string; actionType?: string; sort: string; order: 'asc' | 'desc' };
    const where: Record<string, unknown> = {};
    if (q.targetUserId) where.targetUserId = q.targetUserId;
    if (q.contentType) where.contentType = q.contentType;
    if (q.actionType) where.actionType = q.actionType;
    const [rows, total] = await Promise.all([
      prisma.moderationAction.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          moderator: { select: { email: true } },
          targetUser: { select: { email: true }, include: { profile: { select: { displayName: true } } } },
        },
      }),
      prisma.moderationAction.count({ where }),
    ]);
    const data: AdminModerationActionListItem[] = rows.map((r) => ({
      id: r.id,
      moderatorId: r.moderatorId,
      targetUserId: r.targetUserId,
      actionType: r.actionType,
      reason: r.reason,
      contentType: r.contentType,
      contentId: r.contentId,
      createdAt: r.createdAt.toISOString(),
      moderatorEmail: r.moderator.email ?? null,
      targetUserEmail: r.targetUser.email ?? null,
      targetUserDisplayName: r.targetUser.profile?.displayName ?? null,
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /api/admin/content/moderation-actions/{id}:
 *   get:
 *     summary: Tek moderation action detayı
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Detay
 *       404:
 *         description: Bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/moderation-actions/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const action = await prisma.moderationAction.findUnique({
      where: { id },
      include: {
        moderator: { select: { email: true } },
        targetUser: { select: { email: true }, include: { profile: { select: { displayName: true } } } },
      },
    });
    if (!action) throw new NotFoundError('Moderation action bulunamadı');
    const data: AdminModerationActionDetailResponse = {
      id: action.id,
      moderatorId: action.moderatorId,
      targetUserId: action.targetUserId,
      actionType: action.actionType,
      reason: action.reason,
      contentType: action.contentType,
      contentId: action.contentId,
      createdAt: action.createdAt.toISOString(),
      updatedAt: action.updatedAt.toISOString(),
      moderatorEmail: action.moderator.email ?? null,
      targetUserEmail: action.targetUser.email ?? null,
      targetUserDisplayName: action.targetUser.profile?.displayName ?? null,
      contentSummary: action.contentType && action.contentId != null ? `${action.contentType}#${action.contentId}` : null,
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /api/admin/content/tags:
 *   get:
 *     summary: İçerik tag listesi (aggregate veya postId’ye göre)
 *     tags: [Admin - Content]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: postId
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Tag listesi (tag, count)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

/**
 * @swagger
 * /api/admin/content/tags-categories/stats:
 *   get:
 *     tags: [Admin - Content]
 *     summary: Get tags and categories statistics
 *     responses:
 *       200:
 *         description: Tags and categories stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalTags:
 *                   type: number
 *                 totalCategories:
 *                   type: number
 */
router.get(
  '/tags-categories/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    // Count unique tags
    const uniqueTags = await prisma.contentPostTag.groupBy({
      by: ['tag'],
      _count: { tag: true },
    });
    const totalTags = uniqueTags.length;

    // Count categories
    const totalCategories = await prisma.category.count();

    const data: AdminContentTagsCategoriesStatsResponse = {
      totalTags,
      totalCategories,
    };

    return res.json({ success: true, data });
  })
);

router.get(
  '/tags',
  validateQuery(AdminContentTagsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as { limit: number; offset: number; postId?: string; search?: string };
    if (q.postId) {
      const tags = await prisma.contentPostTag.findMany({
        where: { postId: q.postId },
        select: { tag: true },
        distinct: ['tag'],
      });
      const data: AdminContentTagListItem[] = tags.map((t) => ({ tag: t.tag, count: 1 }));
      return res.json({ success: true, data });
    }
    const aggregated = await prisma.contentPostTag.groupBy({
      by: ['tag'],
      _count: { tag: true },
      orderBy: { _count: { tag: 'desc' } },
      take: q.limit,
      skip: q.offset,
    });
    if (q.search) {
      const filtered = aggregated.filter((r) => r.tag.toLowerCase().includes(q.search!.toLowerCase()));
      const data: AdminContentTagListItem[] = filtered.slice(0, q.limit).map((r) => ({ tag: r.tag, count: r._count.tag }));
      return res.json({ success: true, data });
    }
    const data: AdminContentTagListItem[] = aggregated.map((r) => ({ tag: r.tag, count: r._count.tag }));
    return res.json({ success: true, data });
  })
);

// ==================== Content Collections ====================

const AdminContentCollectionsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  userId: z.string().uuid().optional(),
  search: z.string().optional(),
  sort: z.enum(['createdAt', 'name']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const AdminUpdateContentCollectionSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
});

/**
 * GET /admin/content/collections
 * List content collections
 */
router.get(
  '/collections',
  validateQuery(AdminContentCollectionsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminContentCollectionsQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.userId) where.userId = query.userId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [collections, total] = await Promise.all([
      prisma.contentCollection.findMany({
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
      prisma.contentCollection.count({ where }),
    ]);

    const data = collections.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      userId: c.userId,
      userName: c.user.profile?.userName ?? c.user.email,
      displayName: c.user.profile?.displayName ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    return res.json({
      success: true,
      data,
      pagination: { total, limit: query.limit, offset: query.offset },
    });
  })
);

/**
 * GET /admin/content/collections/:id
 * Get collection details
 */
router.get(
  '/collections/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const collection = await prisma.contentCollection.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { userName: true, displayName: true } },
          },
        },
      },
    });

    if (!collection) {
      throw new NotFoundError('Content collection not found');
    }

    return res.json({
      success: true,
      data: {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        userId: collection.userId,
        userName: collection.user.profile?.userName ?? collection.user.email,
        displayName: collection.user.profile?.displayName ?? null,
        createdAt: collection.createdAt.toISOString(),
        updatedAt: collection.updatedAt.toISOString(),
      },
    });
  })
);

/**
 * PATCH /admin/content/collections/:id
 * Update/moderate a collection
 */
router.patch(
  '/collections/:id',
  validateBody(AdminUpdateContentCollectionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    const body = AdminUpdateContentCollectionSchema.parse(req.body);

    const existing = await prisma.contentCollection.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Content collection not found');
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description ?? null;

    const updated = await prisma.contentCollection.update({
      where: { id },
      data: updateData,
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'CONTENT_COLLECTION_UPDATE',
        description: `Updated content collection ${id}`,
        entityType: 'content_collection',
        entityId: 0,
      },
    });

    logger.info('Admin updated content collection', { adminId, collectionId: id, changes: body });

    return res.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  })
);

/**
 * DELETE /admin/content/collections/:id
 * Delete a content collection
 */
router.delete(
  '/collections/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    const collection = await prisma.contentCollection.findUnique({ where: { id } });
    if (!collection) {
      throw new NotFoundError('Content collection not found');
    }

    await prisma.contentCollection.delete({ where: { id } });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'CONTENT_COLLECTION_DELETE',
        description: `Deleted content collection: ${collection.name}`,
        entityType: 'content_collection',
        entityId: 0,
      },
    });

    logger.info('Admin deleted content collection', { adminId, collectionId: id });

    return res.json({ success: true, message: 'Content collection deleted successfully' });
  })
);

export default router;
