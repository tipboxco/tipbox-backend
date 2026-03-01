import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError, BadRequestError } from '../../../infrastructure/errors/custom-errors';
import logger from '../../../infrastructure/logger/logger';
import { z } from 'zod';
import { createUpload } from '../../../infrastructure/config/file-upload.config';
import { validateFileType } from '../../../infrastructure/middleware/file-type-validation.middleware';
import { S3Service } from '../../../infrastructure/s3/s3.service';

const router = Router();
const prisma = getPrisma();
const s3Service = new S3Service();

/**
 * Marketplace Banners Management Router
 * Routes are mounted at /admin/marketplace-banners
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

// ==================== Schemas ====================

const AdminMarketplaceBannersQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  sort: z.enum(['createdAt', 'displayOrder', 'startDate']).default('displayOrder'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const AdminCreateMarketplaceBannerSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url(),
  linkUrl: z.string().url().nullable().optional(),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
});

const AdminUpdateMarketplaceBannerSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().optional(),
  linkUrl: z.string().url().nullable().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
});

// ==================== Image Upload ====================

const upload = createUpload('ADMIN_IMAGES', 'MEDIUM');

/**
 * POST /admin/marketplace-banners/upload-image
 * Upload banner image
 */
router.post(
  '/upload-image',
  upload.single('file'),
  validateFileType('ADMIN_IMAGES'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new BadRequestError('No file uploaded');
    }

    const adminId = req.user?.id;
    const timestamp = Date.now();
    const fileName = `banner-${timestamp}-${req.file.originalname}`;
    const filePath = `marketplace-banners/${fileName}`;

    const url = await s3Service.uploadFile(req.file.buffer, 'tipbox-platform', filePath);

    logger.info('Admin uploaded marketplace banner image', {
      adminId,
      fileName,
      url,
    });

    return res.json({
      success: true,
      url,
    });
  })
);

// ==================== Marketplace Banners ====================

/**
 * GET /admin/marketplace-banners/stats
 * Get marketplace banner statistics
 */
router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const now = new Date();

    const [total, active, scheduled, expired] = await Promise.all([
      prisma.marketplaceBanner.count(),
      prisma.marketplaceBanner.count({ where: { isActive: true } }),
      prisma.marketplaceBanner.count({
        where: {
          isActive: true,
          startDate: { gt: now },
        },
      }),
      prisma.marketplaceBanner.count({
        where: {
          isActive: true,
          endDate: { lte: now },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        total,
        active,
        inactive: total - active,
        scheduled,
        expired,
        currentlyShowing: active - scheduled - expired,
      },
    });
  })
);

/**
 * GET /admin/marketplace-banners
 * List marketplace banners with pagination and filters
 */
router.get(
  '/',
  validateQuery(AdminMarketplaceBannersQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminMarketplaceBannersQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [banners, total] = await Promise.all([
      prisma.marketplaceBanner.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order },
      }),
      prisma.marketplaceBanner.count({ where }),
    ]);

    const now = new Date();
    const formattedBanners = banners.map((banner) => {
      const isScheduled = banner.startDate && banner.startDate > now;
      const isExpired = banner.endDate && banner.endDate <= now;
      const status = !banner.isActive
        ? 'INACTIVE'
        : isScheduled
        ? 'SCHEDULED'
        : isExpired
        ? 'EXPIRED'
        : 'ACTIVE';

      return {
        id: banner.id,
        title: banner.title,
        description: banner.description,
        imageUrl: banner.imageUrl,
        linkUrl: banner.linkUrl,
        isActive: banner.isActive,
        displayOrder: banner.displayOrder,
        startDate: banner.startDate?.toISOString() ?? null,
        endDate: banner.endDate?.toISOString() ?? null,
        status,
        createdAt: banner.createdAt.toISOString(),
        updatedAt: banner.updatedAt.toISOString(),
      };
    });

    return res.json({
      success: true,
      data: formattedBanners,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
      },
    });
  })
);

/**
 * GET /admin/marketplace-banners/:id
 * Get single marketplace banner details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const banner = await prisma.marketplaceBanner.findUnique({
      where: { id },
    });

    if (!banner) {
      throw new NotFoundError('Marketplace banner not found');
    }

    const now = new Date();
    const isScheduled = banner.startDate && banner.startDate > now;
    const isExpired = banner.endDate && banner.endDate <= now;
    const status = !banner.isActive
      ? 'INACTIVE'
      : isScheduled
      ? 'SCHEDULED'
      : isExpired
      ? 'EXPIRED'
      : 'ACTIVE';

    const formattedBanner = {
      id: banner.id,
      title: banner.title,
      description: banner.description,
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl,
      isActive: banner.isActive,
      displayOrder: banner.displayOrder,
      startDate: banner.startDate?.toISOString() ?? null,
      endDate: banner.endDate?.toISOString() ?? null,
      status,
      createdAt: banner.createdAt.toISOString(),
      updatedAt: banner.updatedAt.toISOString(),
    };

    return res.json({
      success: true,
      data: formattedBanner,
    });
  })
);

/**
 * POST /admin/marketplace-banners
 * Create a new marketplace banner
 */
router.post(
  '/',
  validateBody(AdminCreateMarketplaceBannerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    const body = AdminCreateMarketplaceBannerSchema.parse(req.body);

    // Validate date range
    if (body.startDate && body.endDate) {
      const start = new Date(body.startDate);
      const end = new Date(body.endDate);
      if (start >= end) {
        throw new BadRequestError('Start date must be before end date');
      }
    }

    const banner = await prisma.marketplaceBanner.create({
      data: {
        title: body.title,
        description: body.description ?? null,
        imageUrl: body.imageUrl,
        linkUrl: body.linkUrl ?? null,
        isActive: body.isActive,
        displayOrder: body.displayOrder,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
      },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'MARKETPLACE_BANNER_CREATE',
        description: `Created marketplace banner: ${body.title}`,
        entityType: 'marketplace_banner',
        entityId: 0,
      },
    });

    logger.info('Admin created marketplace banner', {
      adminId,
      bannerId: banner.id,
      title: body.title,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: banner.id,
        title: banner.title,
        description: banner.description,
        imageUrl: banner.imageUrl,
        linkUrl: banner.linkUrl,
        isActive: banner.isActive,
        displayOrder: banner.displayOrder,
        startDate: banner.startDate?.toISOString() ?? null,
        endDate: banner.endDate?.toISOString() ?? null,
        createdAt: banner.createdAt.toISOString(),
      },
    });
  })
);

/**
 * PATCH /admin/marketplace-banners/:id
 * Update marketplace banner details
 */
router.patch(
  '/:id',
  validateBody(AdminUpdateMarketplaceBannerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    const body = AdminUpdateMarketplaceBannerSchema.parse(req.body);

    const existingBanner = await prisma.marketplaceBanner.findUnique({
      where: { id },
    });

    if (!existingBanner) {
      throw new NotFoundError('Marketplace banner not found');
    }

    // Validate date range if both are provided
    const startDate = body.startDate
      ? new Date(body.startDate)
      : existingBanner.startDate;
    const endDate = body.endDate ? new Date(body.endDate) : existingBanner.endDate;

    if (startDate && endDate && startDate >= endDate) {
      throw new BadRequestError('Start date must be before end date');
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description ?? null;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.linkUrl !== undefined) updateData.linkUrl = body.linkUrl ?? null;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.displayOrder !== undefined) updateData.displayOrder = body.displayOrder;
    if (body.startDate !== undefined) {
      updateData.startDate = body.startDate ? new Date(body.startDate) : null;
    }
    if (body.endDate !== undefined) {
      updateData.endDate = body.endDate ? new Date(body.endDate) : null;
    }

    const updatedBanner = await prisma.marketplaceBanner.update({
      where: { id },
      data: updateData,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'MARKETPLACE_BANNER_UPDATE',
        description: `Updated marketplace banner ${id}`,
        entityType: 'marketplace_banner',
        entityId: 0,
      },
    });

    logger.info('Admin updated marketplace banner', {
      adminId,
      bannerId: id,
      changes: body,
    });

    return res.json({
      success: true,
      data: {
        id: updatedBanner.id,
        title: updatedBanner.title,
        description: updatedBanner.description,
        imageUrl: updatedBanner.imageUrl,
        linkUrl: updatedBanner.linkUrl,
        isActive: updatedBanner.isActive,
        displayOrder: updatedBanner.displayOrder,
        startDate: updatedBanner.startDate?.toISOString() ?? null,
        endDate: updatedBanner.endDate?.toISOString() ?? null,
        updatedAt: updatedBanner.updatedAt.toISOString(),
      },
    });
  })
);

/**
 * DELETE /admin/marketplace-banners/:id
 * Delete marketplace banner
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    const banner = await prisma.marketplaceBanner.findUnique({
      where: { id },
    });

    if (!banner) {
      throw new NotFoundError('Marketplace banner not found');
    }

    await prisma.marketplaceBanner.delete({
      where: { id },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'MARKETPLACE_BANNER_DELETE',
        description: `Deleted marketplace banner ${id}`,
        entityType: 'marketplace_banner',
        entityId: 0,
      },
    });

    logger.info('Admin deleted marketplace banner', {
      adminId,
      bannerId: id,
    });

    return res.json({
      success: true,
      message: 'Marketplace banner deleted successfully',
    });
  })
);

export default router;
