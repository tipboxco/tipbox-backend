import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError } from '../../../infrastructure/errors/custom-errors';
import { resolveMediaUrl } from '../../../infrastructure/config/media.config';
import { generateIdForModel } from '../../../infrastructure/ids/id.strategy';
import logger from '../../../infrastructure/logger/logger';

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

/**
 * Content Router - Handles all content moderation & management endpoints
 * Routes are mounted at /admin/content
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

/**
 * @openapi
 * /admin/content/posts/stats:
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
 * /admin/content/posts:
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

/**
 * @openapi
 * /admin/content/posts/{id}:
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
 * /admin/content/posts:
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

    const postId = generateIdForModel('ContentPost');

    const post = await prisma.contentPost.create({
      data: {
        id: postId,
        userId: body.userId,
        type: body.type,
        title: body.title,
        body: body.body,
        mainCategoryId: body.mainCategoryId ?? null,
        subCategoryId: body.subCategoryId ?? null,
        categoryId: body.categoryId ?? null,
        productId: body.productId ?? null,
        productGroupId: body.productGroupId ?? null,
        eventId: body.eventId ?? null,
        inventoryRequired: false,
        isBoosted: false,
      },
      include: {
        user: { include: { profile: { select: { displayName: true, userName: true } } } },
        mainCategory: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
        productGroup: { select: { id: true, name: true } },
        event: { select: { id: true, title: true, status: true } },
        media: { select: { id: true, mediaUrl: true, orderIndex: true }, orderBy: { orderIndex: 'asc' } },
      },
    });

    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'CONTENT_POST_CREATE',
        description: `postId: ${post.id}, title: ${post.title}`,
        entityType: 'content_post',
        entityId: 0,
      },
    });

    logger.info('Admin created content post', {
      adminId,
      postId: post.id,
      userId: body.userId,
      type: body.type,
      title: body.title,
    });

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
      tags: [],
      experienceDurationId: post.experienceDurationId,
      experienceLocationId: post.experienceLocationId,
      experiencePurposeId: post.experiencePurposeId,
      experienceSnippetId: post.experienceSnippetId,
    };

    return res.status(201).json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/content/posts/{id}:
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
    await prisma.$transaction([
      prisma.contentPost.update({ where: { id }, data: updateData }),
      prisma.adminLog.create({
        data: {
          adminId,
          action: 'CONTENT_POST_UPDATE',
          description: `postId: ${id}, fields: ${Object.keys(updateData).join(',')}`,
          entityType: 'content_post',
          entityId: 0,
        },
      }),
    ]);
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
 * /admin/content/posts/{id}:
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
 * /admin/content/comments/stats:
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
 * /admin/content/comments:
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
 * /admin/content/comments/{id}:
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
 * /admin/content/comments/{id}:
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
 * /admin/content/comments/{id}:
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
 * /admin/content/feed-highlights:
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
 * /admin/content/feed-highlights/stats:
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
        include: { post: { include: { user: { include: { profile: { select: { displayName: true } } } } } } },
      }),
      prisma.feedHighlight.count({ where }),
    ]);
    const data: AdminFeedHighlightListItem[] = rows.map((r) => ({
      id: r.id,
      postId: r.postId,
      reason: r.reason,
      highlightedAt: r.highlightedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      postTitle: r.post?.title ?? null,
      userDisplayName: r.post?.user?.profile?.displayName ?? null,
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /admin/content/feed-highlights:
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
      include: { post: { include: { user: { include: { profile: { select: { displayName: true } } } } } } },
    });
    await prisma.adminLog.create({
      data: { adminId, action: 'FEED_HIGHLIGHT_CREATE', description: `postId: ${body.postId}, reason: ${body.reason}`, entityType: 'feed_highlight', entityId: 0 },
    });
    const data: AdminFeedHighlightListItem = {
      id: created.id,
      postId: created.postId,
      reason: created.reason,
      highlightedAt: created.highlightedAt.toISOString(),
      createdAt: created.createdAt.toISOString(),
      postTitle: created.post?.title ?? null,
      userDisplayName: created.post?.user?.profile?.displayName ?? null,
    };
    return res.status(201).json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/content/feed-highlights/{id}:
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
      include: { post: { include: { user: { include: { profile: { select: { displayName: true } } } } } } },
    });
    await prisma.adminLog.create({
      data: { adminId, action: 'FEED_HIGHLIGHT_UPDATE', description: `id: ${id}`, entityType: 'feed_highlight', entityId: 0 },
    });
    const data: AdminFeedHighlightListItem = {
      id: updated.id,
      postId: updated.postId,
      reason: updated.reason,
      highlightedAt: updated.highlightedAt.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      postTitle: updated.post?.title ?? null,
      userDisplayName: updated.post?.user?.profile?.displayName ?? null,
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/content/feed-highlights/{id}:
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
 * /admin/content/trending/stats:
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
 * /admin/content/trending:
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
        include: { post: { include: { user: { include: { profile: { select: { displayName: true } } } } } } },
      }),
      prisma.trendingPost.count({ where }),
    ]);
    const data: AdminTrendingPostListItem[] = rows.map((r) => ({
      id: r.id,
      postId: r.postId,
      score: r.score,
      trendPeriod: r.trendPeriod,
      calculatedAt: r.calculatedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      postTitle: r.post?.title ?? null,
      userDisplayName: r.post?.user?.profile?.displayName ?? null,
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /admin/content/trending:
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
      include: { post: { include: { user: { include: { profile: { select: { displayName: true } } } } } } },
    });
    await prisma.adminLog.create({
      data: { adminId, action: 'TRENDING_POST_CREATE', description: `postId: ${body.postId}, period: ${body.trendPeriod}`, entityType: 'trending_post', entityId: 0 },
    });
    const data: AdminTrendingPostListItem = {
      id: created.id,
      postId: created.postId,
      score: created.score,
      trendPeriod: created.trendPeriod,
      calculatedAt: created.calculatedAt.toISOString(),
      createdAt: created.createdAt.toISOString(),
      postTitle: created.post?.title ?? null,
      userDisplayName: created.post?.user?.profile?.displayName ?? null,
    };
    return res.status(201).json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/content/trending/{id}:
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
    const body = req.body as { score?: number; trendPeriod?: string };
    const existing = await prisma.trendingPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Trending post bulunamadı');
    const updateData: Record<string, unknown> = {};
    if (body.score !== undefined) updateData.score = body.score;
    if (body.trendPeriod !== undefined) updateData.trendPeriod = body.trendPeriod;
    const updated = await prisma.trendingPost.update({
      where: { id },
      data: updateData,
      include: { post: { include: { user: { include: { profile: { select: { displayName: true } } } } } } },
    });
    await prisma.adminLog.create({
      data: { adminId, action: 'TRENDING_POST_UPDATE', description: `id: ${id}`, entityType: 'trending_post', entityId: 0 },
    });
    const data: AdminTrendingPostListItem = {
      id: updated.id,
      postId: updated.postId,
      score: updated.score,
      trendPeriod: updated.trendPeriod,
      calculatedAt: updated.calculatedAt.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      postTitle: updated.post?.title ?? null,
      userDisplayName: updated.post?.user?.profile?.displayName ?? null,
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/content/trending/{id}:
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
 * /admin/content/top-community-choices:
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
 * /admin/content/top-community-choices:
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
 * /admin/content/top-community-choices/{id}:
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
 * /admin/content/top-community-choices/{id}:
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
 * /admin/content/manual-review-flags:
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
        include: { flaggedByUser: { select: { email: true }, include: { profile: { select: { displayName: true } } } } },
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
 * /admin/content/manual-review-flags/{id}:
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
      include: { flaggedByUser: { select: { email: true }, include: { profile: { select: { displayName: true } } } } },
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
 * /admin/content/manual-review-flags/{id}:
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
 * /admin/content/moderation-actions:
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
 * /admin/content/moderation-actions/{id}:
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
 * /admin/content/tags:
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
 * /admin/content/tags-categories/stats:
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

export default router;
