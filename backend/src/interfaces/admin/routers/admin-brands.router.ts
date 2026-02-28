import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError, ValidationError } from '../../../infrastructure/errors/custom-errors';
import logger from '../../../infrastructure/logger/logger';
import multer, { FileFilterCallback } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { S3Service } from '../../../infrastructure/s3/s3.service';
import { resolveMediaUrl } from '../../../infrastructure/config/media.config';

// Import schemas
import {
  AdminBrandsQuerySchema,
  AdminCreateBrandSchema,
  AdminUpdateBrandSchema,
  AdminBrandCategoriesQuerySchema,
  AdminCreateBrandCategorySchema,
  AdminUpdateBrandCategorySchema,
  AdminBrandSurveysQuerySchema,
  AdminCreateBrandSurveySchema,
  AdminUpdateBrandSurveySchema,
} from '../schemas/admin-brands.schemas';

// Import DTOs
import type {
  AdminBrandStatsResponse,
  AdminBrandListItem,
  AdminBrandDetailResponse,
  AdminBrandCategoryListItem,
  AdminBrandCategoryDetailResponse,
  AdminBrandSurveyStatsResponse,
  AdminBrandSurveyListItem,
  AdminBrandSurveyDetailResponse,
  AdminBrandSurveyResponsesResponse,
  AdminCreateBrandInput,
  AdminUpdateBrandInput,
  AdminCreateBrandCategoryInput,
  AdminUpdateBrandCategoryInput,
  AdminCreateBrandSurveyInput,
  AdminUpdateBrandSurveyInput,
} from '../dtos/admin-brands.dto';

import type { PaginationMeta } from '../dtos/admin-common.dto';

const router = Router();
const prisma = getPrisma();
const s3Service = new S3Service();

const brandUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (file.mimetype && allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, GIF and WebP supported'));
    }
  },
});

/**
 * Brands & Bridge Management Router
 * Routes are mounted at /admin/brands
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

// ==================== Brands ====================

router.post(
  '/upload-logo',
  brandUpload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File required (field: file)' });
    }
    const ext = req.file.originalname?.split('.').pop()?.toLowerCase() || 'jpg';
    const allowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!allowedExt.includes(ext)) {
      return res.status(400).json({ success: false, message: 'Only JPG, PNG, GIF and WebP supported' });
    }
    const fileName = `brands/logos/${uuidv4()}.${ext}`;
    const path = await s3Service.uploadFile(fileName, req.file.buffer, req.file.mimetype);
    const url = resolveMediaUrl(path);
    logger.info({
      message: 'Brand logo uploaded',
      fileName,
      url,
      adminId: req.user?.id,
    });
    return res.json({ success: true, data: { url: url ?? path } });
  })
);

router.post(
  '/upload-banner',
  brandUpload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File required (field: file)' });
    }
    const ext = req.file.originalname?.split('.').pop()?.toLowerCase() || 'jpg';
    const allowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!allowedExt.includes(ext)) {
      return res.status(400).json({ success: false, message: 'Only JPG, PNG, GIF and WebP supported' });
    }
    const fileName = `brands/banners/${uuidv4()}.${ext}`;
    const path = await s3Service.uploadFile(fileName, req.file.buffer, req.file.mimetype);
    const url = resolveMediaUrl(path);
    logger.info({
      message: 'Brand banner uploaded',
      fileName,
      url,
      adminId: req.user?.id,
    });
    return res.json({ success: true, data: { url: url ?? path } });
  })
);

router.post(
  '/upload-image',
  brandUpload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File required (field: file)' });
    }
    const ext = req.file.originalname?.split('.').pop()?.toLowerCase() || 'jpg';
    const allowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!allowedExt.includes(ext)) {
      return res.status(400).json({ success: false, message: 'Only JPG, PNG, GIF and WebP supported' });
    }
    const fileName = `brands/images/${uuidv4()}.${ext}`;
    const path = await s3Service.uploadFile(fileName, req.file.buffer, req.file.mimetype);
    const url = resolveMediaUrl(path);
    logger.info({
      message: 'Brand image uploaded',
      fileName,
      url,
      adminId: req.user?.id,
    });
    return res.json({ success: true, data: { url: url ?? path } });
  })
);

/**
 * GET /admin/brands/stats
 * Get brands statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const total = await prisma.brand.count();

    // Total followers
    const totalFollowers = await prisma.bridgeFollower.count();

    // Active surveys (not ended yet)
    const now = new Date();
    const activeSurveys = await prisma.brandSurvey.count({
      where: { endsAt: { gt: now } },
    });

    // Most popular brands by followers
    const brandFollowers = await prisma.bridgeFollower.groupBy({
      by: ['brandId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const mostPopular = await Promise.all(
      brandFollowers.map(async (item) => {
        const brand = await prisma.brand.findUnique({
          where: { id: item.brandId },
          select: { id: true, name: true },
        });
        return {
          brandId: item.brandId,
          brandName: brand?.name || 'Unknown',
          followerCount: item._count.id,
        };
      })
    );

    const data: AdminBrandStatsResponse = {
      total,
      totalFollowers,
      activeSurveys,
      mostPopular,
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/brands
 * List brands with pagination and filters
 */
router.get(
  '/',
  validateQuery(AdminBrandsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      search?: string;
      categoryId?: string;
      isPopular?: boolean;
      sort: string;
      order: 'asc' | 'desc';
    };

    const where: Record<string, unknown> = {};
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.isPopular !== undefined) where.isPopular = q.isPopular;
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [brands, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          _count: {
            select: { followers: true, bridgePosts: true },
          },
        },
      }),
      prisma.brand.count({ where }),
    ]);

    const data: AdminBrandListItem[] = await Promise.all(
      brands.map(async (brand) => {
        let categoryName: string | null = null;

        if (brand.categoryId) {
          const category = await prisma.brandCategory.findUnique({
            where: { id: brand.categoryId },
            select: { name: true },
          });
          categoryName = category?.name || null;
        }

        return {
          id: brand.id,
          name: brand.name,
          description: brand.description,
          logoUrl: brand.logoUrl,
          category: brand.category,
          categoryId: brand.categoryId,
          categoryName,
          isPopular: brand.isPopular,
          rank: brand.rank,
          followerCount: brand._count.followers,
          postCount: brand._count.bridgePosts,
          createdAt: brand.createdAt.toISOString(),
        };
      })
    );

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * GET /admin/brands/:id
 * Get brand details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: { followers: true, bridgePosts: true },
        },
        followers: {
          take: 10,
          orderBy: { followedAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                profile: { select: { userName: true } },
              },
            },
          },
        },
        bridgePosts: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            userId: true,
            createdAt: true,
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

    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    let categoryName: string | null = null;

    if (brand.categoryId) {
      const category = await prisma.brandCategory.findUnique({
        where: { id: brand.categoryId },
        select: { name: true },
      });
      categoryName = category?.name || null;
    }

    const data: AdminBrandDetailResponse = {
      id: brand.id,
      name: brand.name,
      description: brand.description,
      logoUrl: brand.logoUrl,
      imageUrl: brand.imageUrl,
      bannerUrl: brand.bannerUrl,
      category: brand.category,
      categoryId: brand.categoryId,
      categoryName,
      externalId: brand.externalId,
      isPopular: brand.isPopular,
      rank: brand.rank,
      tags: brand.tags,
      followerCount: brand._count.followers,
      postCount: brand._count.bridgePosts,
      createdAt: brand.createdAt.toISOString(),
      updatedAt: brand.updatedAt.toISOString(),
      recentFollowers: brand.followers.map((follower) => ({
        userId: follower.userId,
        username: follower.user.profile?.userName || null,
        followedAt: follower.followedAt.toISOString(),
      })),
      recentPosts: brand.bridgePosts.map((post) => ({
        id: post.id,
        userId: post.userId,
        username: post.user.profile?.userName || null,
        createdAt: post.createdAt.toISOString(),
      })),
    };

    return res.json({ success: true, data });
  })
);

/**
 * POST /admin/brands
 * Create brand
 */
router.post(
  '/',
  validateBody(AdminCreateBrandSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const body = req.body as AdminCreateBrandInput;

    const brandData = {
      name: body.name,
      description: body.description ?? null,
      logoUrl: body.logoUrl ?? null,
      imageUrl: body.imageUrl ?? null,
      bannerUrl: body.bannerUrl ?? null,
      category: body.category ?? null,
      categoryId: body.categoryId ?? null,
      externalId: body.externalId ?? null,
      rank: body.rank,
      isPopular: body.isPopular,
    };

    if (body.tags && body.tags.length > 0) {
      Object.assign(brandData, { tags: body.tags });
    }

    const brand = await prisma.brand.create({
      data: brandData,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'BRAND_CREATE',
        description: `brandId: ${brand.id}, name: ${brand.name}`,
        entityType: 'brand',
        entityId: 0,
      },
    });

    logger.info('Brand created', { brandId: brand.id, adminId });

    return res.status(201).json({ success: true, data: brand });
  })
);

/**
 * PATCH /admin/brands/:id
 * Update brand
 */
router.patch(
  '/:id',
  validateBody(AdminUpdateBrandSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminUpdateBrandInput;

    const existing = await prisma.brand.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Brand not found');
    }

    const updateData: Record<string, unknown> = { ...body };
    if (body.tags && body.tags.length > 0) {
      updateData.tags = body.tags;
    }

    const brand = await prisma.brand.update({
      where: { id },
      data: updateData,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'BRAND_UPDATE',
        description: `brandId: ${brand.id}, name: ${brand.name}`,
        entityType: 'brand',
        entityId: 0,
      },
    });

    logger.info('Brand updated', { brandId: brand.id, adminId });

    return res.json({ success: true, data: brand });
  })
);

/**
 * DELETE /admin/brands/:id
 * Delete brand
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;

    const existing = await prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: { followers: true, bridgePosts: true, news: true, products: true, events: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError('Brand not found');
    }

    // Check if brand has dependencies
    const totalDependencies =
      existing._count.followers +
      existing._count.bridgePosts +
      existing._count.news +
      existing._count.products +
      existing._count.events;

    if (totalDependencies > 0) {
      throw new ValidationError(
        `Cannot delete brand with ${existing._count.followers} followers, ${existing._count.bridgePosts} posts, ${existing._count.news} news, ${existing._count.products} products, and ${existing._count.events} events`
      );
    }

    await prisma.brand.delete({ where: { id } });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'BRAND_DELETE',
        description: `brandId: ${id}, name: ${existing.name}`,
        entityType: 'brand',
        entityId: 0,
      },
    });

    logger.info('Brand deleted', { brandId: id, adminId });

    return res.json({ success: true, message: 'Brand deleted' });
  })
);

// ==================== Brand Categories ====================

/**
 * GET /admin/brands/categories
 * List brand categories
 */
router.get(
  '/categories',
  validateQuery(AdminBrandCategoriesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      search?: string;
    };

    const where: Record<string, unknown> = {};
    if (q.search) {
      where.name = { contains: q.search, mode: 'insensitive' };
    }

    const categories = await prisma.brandCategory.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { brands: true } },
      },
    });

    const data: AdminBrandCategoryListItem[] = await Promise.all(
      categories.map(async (cat) => {
        let categoryName: string | null = null;

        if (cat.categoryId) {
          const category = await prisma.category.findUnique({
            where: { id: cat.categoryId },
            select: { name: true },
          });
          categoryName = category?.name || null;
        }

        return {
          id: cat.id,
          name: cat.name,
          imageUrl: cat.imageUrl,
          categoryId: cat.categoryId,
          categoryName,
          brandCount: cat._count.brands,
          createdAt: cat.createdAt.toISOString(),
        };
      })
    );

    return res.json({ success: true, data });
  })
);

/**
 * POST /admin/brands/categories
 * Create brand category
 */
router.post(
  '/categories',
  validateBody(AdminCreateBrandCategorySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const body = req.body as AdminCreateBrandCategoryInput;

    const category = await prisma.brandCategory.create({
      data: {
        name: body.name,
        imageUrl: body.imageUrl ?? null,
        categoryId: body.categoryId ?? null,
      },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'BRAND_CATEGORY_CREATE',
        description: `categoryId: ${category.id}, name: ${category.name}`,
        entityType: 'brand_category',
        entityId: 0,
      },
    });

    logger.info('Brand category created', { categoryId: category.id, adminId });

    return res.status(201).json({ success: true, data: category });
  })
);

/**
 * PATCH /admin/brands/categories/:id
 * Update brand category
 */
router.patch(
  '/categories/:id',
  validateBody(AdminUpdateBrandCategorySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminUpdateBrandCategoryInput;

    const existing = await prisma.brandCategory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Brand category not found');
    }

    const category = await prisma.brandCategory.update({
      where: { id },
      data: body,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'BRAND_CATEGORY_UPDATE',
        description: `categoryId: ${category.id}, name: ${category.name}`,
        entityType: 'brand_category',
        entityId: 0,
      },
    });

    logger.info('Brand category updated', { categoryId: category.id, adminId });

    return res.json({ success: true, data: category });
  })
);

/**
 * DELETE /admin/brands/categories/:id
 * Delete brand category
 */
router.delete(
  '/categories/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;

    const existing = await prisma.brandCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { brands: true } },
      },
    });

    if (!existing) {
      throw new NotFoundError('Brand category not found');
    }

    if (existing._count.brands > 0) {
      throw new ValidationError(
        `Cannot delete brand category with ${existing._count.brands} brands. Reassign brands first.`
      );
    }

    await prisma.brandCategory.delete({ where: { id } });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'BRAND_CATEGORY_DELETE',
        description: `categoryId: ${id}, name: ${existing.name}`,
        entityType: 'brand_category',
        entityId: 0,
      },
    });

    logger.info('Brand category deleted', { categoryId: id, adminId });

    return res.json({ success: true, message: 'Brand category deleted' });
  })
);

// ==================== Brand Surveys ====================

/**
 * GET /admin/brands/surveys/stats
 * Get brand surveys statistics
 */
router.get(
  '/surveys/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const total = await prisma.brandSurvey.count();

    // Active surveys (started but not ended)
    const now = new Date();
    const active = await prisma.brandSurvey.count({
      where: {
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
    });

    // Total responses
    const totalResponses = await prisma.brandSurveyAnswer.count();

    // Average response rate (responses / questions)
    const totalQuestions = await prisma.brandSurveyQuestion.count();
    const avgResponseRate = totalQuestions > 0 ? (totalResponses / totalQuestions) * 100 : 0;

    // Ending soon (within 7 days)
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const endingSoonSurveys = await prisma.brandSurvey.findMany({
      where: {
        endsAt: {
          gt: now,
          lte: sevenDaysFromNow,
        },
      },
      take: 5,
      orderBy: { endsAt: 'asc' },
      include: {
        brand: { select: { name: true } },
      },
    });

    const endingSoon = endingSoonSurveys.map((survey) => ({
      surveyId: survey.id,
      title: survey.title,
      brandName: survey.brand.name,
      endsAt: survey.endsAt.toISOString(),
    }));

    const data: AdminBrandSurveyStatsResponse = {
      total,
      active,
      totalResponses,
      avgResponseRate: Math.round(avgResponseRate * 100) / 100,
      endingSoon,
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/brands/surveys
 * List brand surveys with pagination and filters
 */
router.get(
  '/surveys',
  validateQuery(AdminBrandSurveysQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      brandId?: string;
      status?: string;
      search?: string;
      sort: string;
      order: 'asc' | 'desc';
    };

    const where: Record<string, unknown> = {};
    if (q.brandId) where.brandId = q.brandId;
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    // Filter by status
    const now = new Date();
    if (q.status === 'ACTIVE') {
      where.startsAt = { lte: now };
      where.endsAt = { gt: now };
    } else if (q.status === 'UPCOMING') {
      where.startsAt = { gt: now };
    } else if (q.status === 'ENDED') {
      where.endsAt = { lte: now };
    }

    const [surveys, total] = await Promise.all([
      prisma.brandSurvey.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          brand: { select: { name: true } },
          _count: { select: { questions: true } },
          questions: {
            include: {
              _count: { select: { answers: true } },
            },
          },
        },
      }),
      prisma.brandSurvey.count({ where }),
    ]);

    const data: AdminBrandSurveyListItem[] = surveys.map((survey) => {
      const totalResponseCount = survey.questions.reduce(
        (sum, q) => sum + q._count.answers,
        0
      );

      let status = 'UPCOMING';
      if (survey.startsAt <= now && survey.endsAt > now) {
        status = 'ACTIVE';
      } else if (survey.endsAt <= now) {
        status = 'ENDED';
      }

      return {
        id: survey.id,
        brandId: survey.brandId,
        brandName: survey.brand.name,
        title: survey.title,
        description: survey.description,
        startsAt: survey.startsAt.toISOString(),
        endsAt: survey.endsAt.toISOString(),
        status,
        questionCount: survey._count.questions,
        responseCount: totalResponseCount,
        createdAt: survey.createdAt.toISOString(),
      };
    });

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * GET /admin/brands/surveys/:id
 * Get survey details
 */
router.get(
  '/surveys/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const survey = await prisma.brandSurvey.findUnique({
      where: { id },
      include: {
        brand: { select: { name: true } },
        questions: {
          include: {
            _count: { select: { answers: true } },
          },
        },
      },
    });

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    const now = new Date();
    let status = 'UPCOMING';
    if (survey.startsAt <= now && survey.endsAt > now) {
      status = 'ACTIVE';
    } else if (survey.endsAt <= now) {
      status = 'ENDED';
    }

    const totalResponseCount = survey.questions.reduce(
      (sum, q) => sum + q._count.answers,
      0
    );

    const data: AdminBrandSurveyDetailResponse = {
      id: survey.id,
      brandId: survey.brandId,
      brandName: survey.brand.name,
      title: survey.title,
      description: survey.description,
      startsAt: survey.startsAt.toISOString(),
      endsAt: survey.endsAt.toISOString(),
      status,
      questionCount: survey.questions.length,
      responseCount: totalResponseCount,
      createdAt: survey.createdAt.toISOString(),
      updatedAt: survey.updatedAt.toISOString(),
      questions: survey.questions.map((q) => ({
        id: q.id,
        questionText: q.questionText,
        type: q.type,
        answerCount: q._count.answers,
      })),
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/brands/surveys/:id/responses
 * Get survey responses
 */
router.get(
  '/surveys/:id/responses',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const survey = await prisma.brandSurvey.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            answers: {
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
        },
      },
    });

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    const totalResponses = survey.questions.reduce(
      (sum, q) => sum + q.answers.length,
      0
    );

    const data: AdminBrandSurveyResponsesResponse = {
      surveyId: survey.id,
      surveyTitle: survey.title,
      totalResponses,
      questions: survey.questions.map((q) => ({
        id: q.id,
        questionText: q.questionText,
        type: q.type,
        answers: q.answers.map((a) => ({
          id: a.id,
          userId: a.userId,
          username: a.user.profile?.userName || null,
          answerText: a.answerText,
          createdAt: a.createdAt.toISOString(),
        })),
      })),
    };

    return res.json({ success: true, data });
  })
);

/**
 * POST /admin/brands/surveys
 * Create brand survey
 */
router.post(
  '/surveys',
  validateBody(AdminCreateBrandSurveySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const body = req.body as AdminCreateBrandSurveyInput;

    // Validate dates
    if (new Date(body.startsAt) >= new Date(body.endsAt)) {
      throw new ValidationError('Start date must be before end date');
    }

    // Create survey with questions in transaction
    const survey = await prisma.$transaction(async (tx) => {
      const newSurvey = await tx.brandSurvey.create({
        data: {
          brandId: body.brandId,
          title: body.title,
          description: body.description ?? null,
          startsAt: new Date(body.startsAt),
          endsAt: new Date(body.endsAt),
        },
      });

      // Create questions
      await tx.brandSurveyQuestion.createMany({
        data: body.questions.map((q) => ({
          surveyId: newSurvey.id,
          questionText: q.questionText,
          type: q.type,
        })),
      });

      return newSurvey;
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'BRAND_SURVEY_CREATE',
        description: `surveyId: ${survey.id}, title: ${survey.title}, brandId: ${survey.brandId}, questions: ${body.questions.length}`,
        entityType: 'brand_survey',
        entityId: 0,
      },
    });

    logger.info('Brand survey created', { surveyId: survey.id, adminId });

    return res.status(201).json({ success: true, data: survey });
  })
);

/**
 * PATCH /admin/brands/surveys/:id
 * Update brand survey (title, description, dates only - not questions)
 */
router.patch(
  '/surveys/:id',
  validateBody(AdminUpdateBrandSurveySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminUpdateBrandSurveyInput;

    const existing = await prisma.brandSurvey.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Survey not found');
    }

    // Validate dates if both provided
    if (body.startsAt && body.endsAt) {
      if (new Date(body.startsAt) >= new Date(body.endsAt)) {
        throw new ValidationError('Start date must be before end date');
      }
    }

    const updateData: Record<string, unknown> = { ...body };
    if (body.startsAt) updateData.startsAt = new Date(body.startsAt);
    if (body.endsAt) updateData.endsAt = new Date(body.endsAt);

    const survey = await prisma.brandSurvey.update({
      where: { id },
      data: updateData,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'BRAND_SURVEY_UPDATE',
        description: `surveyId: ${survey.id}, title: ${survey.title}`,
        entityType: 'brand_survey',
        entityId: 0,
      },
    });

    logger.info('Brand survey updated', { surveyId: survey.id, adminId });

    return res.json({ success: true, data: survey });
  })
);

/**
 * DELETE /admin/brands/surveys/:id
 * Delete brand survey
 */
router.delete(
  '/surveys/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;

    const existing = await prisma.brandSurvey.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            _count: { select: { answers: true } },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError('Survey not found');
    }

    // Warning if survey has responses
    const totalResponses = existing.questions.reduce(
      (sum, q) => sum + q._count.answers,
      0
    );

    if (totalResponses > 0) {
      logger.warn('Deleting survey with responses', {
        surveyId: id,
        responseCount: totalResponses,
        adminId,
      });
    }

    await prisma.brandSurvey.delete({ where: { id } });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'BRAND_SURVEY_DELETE',
        description: `surveyId: ${id}, title: ${existing.title}, responses: ${totalResponses}`,
        entityType: 'brand_survey',
        entityId: 0,
      },
    });

    logger.info('Brand survey deleted', { surveyId: id, adminId });

    return res.json({ success: true, message: 'Survey deleted' });
  })
);

// ==================== Stats Endpoints ====================

/**
 * @swagger
 * /admin/brands/bridge-program/stats:
 *   get:
 *     tags: [Admin - Brands]
 *     summary: Get bridge program statistics
 *     responses:
 *       200:
 *         description: Bridge program stats
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
 *                     totalFollowers:
 *                       type: number
 *                     totalPosts:
 *                       type: number
 *                     activeBrands:
 *                       type: number
 */
router.get(
  '/bridge-program/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [totalFollowers, totalPosts, activeBrands] = await Promise.all([
      prisma.bridgeFollower.count(),
      prisma.bridgePost.count(),
      prisma.brand.count({
        where: {
          followers: {
            some: {},
          },
        },
      }),
    ]);

    const data = {
      totalFollowers,
      totalPosts,
      activeBrands,
    };

    return res.json({ success: true, data });
  })
);

/**
 * @swagger
 * /admin/brands/leaderboards/stats:
 *   get:
 *     tags: [Admin - Brands]
 *     summary: Get brand leaderboards statistics
 *     responses:
 *       200:
 *         description: Brand leaderboards stats
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
 *                     active:
 *                       type: number
 */
router.get(
  '/leaderboards/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const now = new Date();

    const [total, active] = await Promise.all([
      prisma.bridgeLeaderboard.count(),
      prisma.bridgeLeaderboard.count({
        where: {
          startDate: { lte: now },
          endDate: { gte: now },
        },
      }),
    ]);

    const data = {
      total,
      active,
    };

    return res.json({ success: true, data });
  })
);

export default router;
