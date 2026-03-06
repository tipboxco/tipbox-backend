import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError, ValidationError } from '../../../infrastructure/errors/custom-errors';
import logger from '../../../infrastructure/logger/logger';
import { createUpload } from '../../../infrastructure/config/file-upload.config';
import { validateFileType } from '../../../infrastructure/middleware/file-type-validation.middleware';
import { v4 as uuidv4 } from 'uuid';
import { S3Service } from '../../../infrastructure/s3/s3.service';
import { resolveMediaUrl } from '../../../infrastructure/config/media.config';

// Import schemas
import {
  AdminNewsQuerySchema,
  AdminCreateNewsSchema,
  AdminUpdateNewsSchema,
  AdminNewsCommentsQuerySchema,
} from '../schemas/admin-news.schemas';

// Import DTOs
import type {
  AdminNewsStatsResponse,
  AdminNewsListItem,
  AdminNewsDetailResponse,
  AdminNewsCommentListItem,
  AdminNewsAnalyticsResponse,
  AdminCreateNewsInput,
  AdminUpdateNewsInput,
} from '../dtos/admin-news.dto';

import type { PaginationMeta } from '../dtos/admin-common.dto';

const router = Router();
const prisma = getPrisma();
const s3Service = new S3Service();

const upload = createUpload('ADMIN_IMAGES', 'SMALL');

/**
 * News Management Router
 * Routes are mounted at /admin/news
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

// ==================== News ====================

/**
 * @openapi
 * /admin/news/upload-image:
 *   post:
 *     summary: Upload news banner image to MinIO (news/ folder)
 *     tags: [Admin - News]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: News banner (JPG, PNG, GIF, WebP - max 5MB)
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *       400:
 *         description: File required or unsupported format
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin required)
 */
router.post(
  '/upload-image',
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
    const fileName = `news/${uuidv4()}.${ext}`;
    const path = await s3Service.uploadFile(fileName, req.file.buffer, req.file.mimetype);
    const url = resolveMediaUrl(path);
    logger.info({
      message: 'News banner uploaded',
      fileName,
      url,
      adminId: req.user?.id,
    });
    return res.json({ success: true, data: { url: url ?? path } });
  })
);

/**
 * GET /admin/news/stats
 * Get news statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const total = await prisma.news.count();

    // Total views this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const totalViewsThisMonth = await prisma.news.aggregate({
      where: { createdAt: { gte: startOfMonth } },
      _sum: { viewsCount: true },
    });

    // Most popular news (top 10 by views)
    const topNews = await prisma.news.findMany({
      orderBy: { viewsCount: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        viewsCount: true,
      },
    });

    const mostPopular = topNews.map((news) => ({
      newsId: news.id,
      title: news.title,
      viewsCount: news.viewsCount,
    }));

    // Average comments per news
    const avgCommentsResult = await prisma.news.aggregate({
      _avg: { commentsCount: true },
    });

    const data: AdminNewsStatsResponse = {
      total,
      totalViewsThisMonth: totalViewsThisMonth._sum.viewsCount || 0,
      mostPopular,
      avgComments: avgCommentsResult._avg.commentsCount || 0,
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/news
 * List news with pagination and filters
 */
router.get(
  '/',
  validateQuery(AdminNewsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      search?: string;
      brandId?: string;
      tags?: string;
      source?: string;
      sort: string;
      order: 'asc' | 'desc';
    };

    const where: Record<string, unknown> = {};
    if (q.brandId) where.brandId = q.brandId;
    if (q.source) where.source = q.source;
    if (q.tags) {
      const tagList = q.tags.split(',').map((t) => t.trim());
      where.tags = { hasSome: tagList };
    }
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { content: { contains: q.search, mode: 'insensitive' } },
        { author: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [newsList, total] = await Promise.all([
      prisma.news.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          brand: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.news.count({ where }),
    ]);

    const data: AdminNewsListItem[] = newsList.map((news) => ({
      id: news.id,
      brandId: news.brandId,
      brandName: news.brand.name,
      title: news.title,
      content: news.content,
      bannerImageUrl: news.bannerImageUrl,
      source: news.source,
      author: news.author,
      tags: news.tags,
      likesCount: news.likesCount,
      commentsCount: news.commentsCount,
      sharesCount: news.sharesCount,
      viewsCount: news.viewsCount,
      createdAt: news.createdAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * GET /admin/news/:id
 * Get news details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const news = await prisma.news.findUnique({
      where: { id },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
        comments: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                profile: { select: { userName: true } },
              },
            },
          },
        },
      },
    });

    if (!news) {
      throw new NotFoundError('News not found');
    }

    const data: AdminNewsDetailResponse = {
      id: news.id,
      brandId: news.brandId,
      brandName: news.brand.name,
      title: news.title,
      content: news.content,
      bannerImageUrl: news.bannerImageUrl,
      source: news.source,
      author: news.author,
      tags: news.tags,
      likesCount: news.likesCount,
      commentsCount: news.commentsCount,
      sharesCount: news.sharesCount,
      viewsCount: news.viewsCount,
      createdAt: news.createdAt.toISOString(),
      updatedAt: news.updatedAt.toISOString(),
      brand: {
        id: news.brand.id,
        name: news.brand.name,
        logoUrl: news.brand.logoUrl,
      },
      recentComments: news.comments.map((comment) => ({
        id: comment.id,
        userId: comment.userId,
        username: comment.user.profile?.userName || null,
        comment: comment.comment,
        createdAt: comment.createdAt.toISOString(),
      })),
    };

    return res.json({ success: true, data });
  })
);

/**
 * POST /admin/news
 * Create news article
 */
router.post(
  '/',
  validateBody(AdminCreateNewsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const body = req.body as AdminCreateNewsInput;

    const news = await prisma.news.create({
      data: {
        brandId: body.brandId,
        title: body.title,
        content: body.content,
        bannerImageUrl: body.bannerImageUrl ?? null,
        source: body.source,
        author: body.author ?? null,
        tags: body.tags,
      },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'NEWS_CREATE',
        description: `newsId: ${news.id}, title: ${news.title}, brandId: ${news.brandId}`,
        entityType: 'news',
        entityId: 0,
      },
    });

    logger.info('News created', { newsId: news.id, adminId });

    return res.status(201).json({ success: true, data: news });
  })
);

/**
 * PATCH /admin/news/:id
 * Update news article
 */
router.patch(
  '/:id',
  validateBody(AdminUpdateNewsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminUpdateNewsInput;

    const existing = await prisma.news.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('News not found');
    }

    const updateData: Record<string, unknown> = { ...body };

    // Clean up old images from S3 if being replaced
    if (body.imageUrl !== undefined && existing.imageUrl && body.imageUrl !== existing.imageUrl) {
      try { await s3Service.deleteFile(existing.imageUrl); } catch { /* ignore */ }
    }
    if (body.thumbnailUrl !== undefined && existing.thumbnailUrl && body.thumbnailUrl !== existing.thumbnailUrl) {
      try { await s3Service.deleteFile(existing.thumbnailUrl); } catch { /* ignore */ }
    }

    const news = await prisma.news.update({
      where: { id },
      data: updateData,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'NEWS_UPDATE',
        description: `newsId: ${news.id}, title: ${news.title}`,
        entityType: 'news',
        entityId: 0,
      },
    });

    logger.info('News updated', { newsId: news.id, adminId });

    return res.json({ success: true, data: news });
  })
);

/**
 * DELETE /admin/news/:id
 * Delete news article
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;

    const existing = await prisma.news.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('News not found');
    }

    // Check if news has many engagements
    if (
      existing.likesCount > 100 ||
      existing.commentsCount > 50 ||
      existing.viewsCount > 1000
    ) {
      logger.warn('Attempting to delete highly-engaged news', {
        newsId: id,
        likesCount: existing.likesCount,
        commentsCount: existing.commentsCount,
        viewsCount: existing.viewsCount,
        adminId,
      });
    }

    await prisma.news.delete({ where: { id } });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'NEWS_DELETE',
        description: `newsId: ${id}, title: ${existing.title}, brandId: ${existing.brandId}`,
        entityType: 'news',
        entityId: 0,
      },
    });

    logger.info('News deleted', { newsId: id, adminId });

    return res.json({ success: true, message: 'News deleted' });
  })
);

// ==================== News Comments ====================

/**
 * GET /admin/news/:id/comments
 * Get comments for a specific news article
 */
router.get(
  '/:id/comments',
  validateQuery(AdminNewsCommentsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      search?: string;
      sort: string;
      order: 'asc' | 'desc';
    };

    // Check if news exists
    const news = await prisma.news.findUnique({ where: { id } });
    if (!news) {
      throw new NotFoundError('News not found');
    }

    const where: Record<string, unknown> = { newsId: id };
    if (q.search) {
      where.comment = { contains: q.search, mode: 'insensitive' };
    }

    const [comments, total] = await Promise.all([
      prisma.newsComment.findMany({
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
        },
      }),
      prisma.newsComment.count({ where }),
    ]);

    const data: AdminNewsCommentListItem[] = comments.map((comment) => ({
      id: comment.id,
      newsId: comment.newsId,
      newsTitle: news.title,
      userId: comment.userId,
      userEmail: comment.user.email,
      username: comment.user.profile?.userName || null,
      comment: comment.comment,
      likesCount: comment.likesCount,
      createdAt: comment.createdAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * DELETE /admin/news/comments/:id
 * Delete news comment
 */
router.delete(
  '/comments/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;

    const existing = await prisma.newsComment.findUnique({
      where: { id },
      include: {
        news: { select: { title: true } },
      },
    });

    if (!existing) {
      throw new NotFoundError('Comment not found');
    }

    // Delete comment (cascade will handle replies)
    await prisma.newsComment.delete({ where: { id } });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'NEWS_COMMENT_DELETE',
        description: `commentId: ${id}, newsTitle: ${existing.news.title}, userId: ${existing.userId}`,
        entityType: 'news_comment',
        entityId: 0,
      },
    });

    logger.info('News comment deleted', { commentId: id, adminId });

    return res.json({ success: true, message: 'Comment deleted' });
  })
);

// ==================== News Analytics ====================

/**
 * GET /admin/news/analytics
 * Get news analytics
 */
router.get(
  '/analytics',
  asyncHandler(async (req: Request, res: Response) => {
    // Top news by views
    const topByViews = await prisma.news.findMany({
      orderBy: { viewsCount: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        viewsCount: true,
      },
    });

    const topNewsByViews = topByViews.map((news) => ({
      newsId: news.id,
      title: news.title,
      viewsCount: news.viewsCount,
    }));

    // Top news by engagement (likes + comments + shares)
    const allNews = await prisma.news.findMany({
      select: {
        id: true,
        title: true,
        likesCount: true,
        commentsCount: true,
        sharesCount: true,
      },
    });

    const topNewsByEngagement = allNews
      .map((news) => ({
        newsId: news.id,
        title: news.title,
        engagementScore: news.likesCount + news.commentsCount + news.sharesCount,
      }))
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 10);

    // Brand performance
    const brandStats = await prisma.brand.findMany({
      include: {
        _count: { select: { news: true } },
        news: {
          select: {
            viewsCount: true,
            likesCount: true,
            commentsCount: true,
            sharesCount: true,
          },
        },
      },
    });

    const brandPerformance = brandStats
      .filter((brand) => brand._count.news > 0)
      .map((brand) => {
        const totalViews = brand.news.reduce((sum, n) => sum + n.viewsCount, 0);
        const totalEngagement = brand.news.reduce(
          (sum, n) => sum + n.likesCount + n.commentsCount + n.sharesCount,
          0
        );
        const avgEngagement = brand._count.news > 0 ? totalEngagement / brand._count.news : 0;

        return {
          brandId: brand.id,
          brandName: brand.name,
          newsCount: brand._count.news,
          totalViews,
          avgEngagement: Math.round(avgEngagement * 100) / 100,
        };
      })
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, 10);

    const data: AdminNewsAnalyticsResponse = {
      topNewsByViews,
      topNewsByEngagement,
      brandPerformance,
    };

    return res.json({ success: true, data });
  })
);

export default router;
