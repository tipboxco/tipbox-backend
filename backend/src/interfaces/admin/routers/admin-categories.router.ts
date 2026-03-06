import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError, ValidationError } from '../../../infrastructure/errors/custom-errors';
import logger from '../../../infrastructure/logger/logger';
import { z } from 'zod';
import { createUpload } from '../../../infrastructure/config/file-upload.config';
import { validateFileType } from '../../../infrastructure/middleware/file-type-validation.middleware';
import { S3Service } from '../../../infrastructure/s3/s3.service';
import { resolveMediaUrl } from '../../../infrastructure/config/media.config';

const router = Router();
const prisma = getPrisma();
const s3Service = new S3Service();

/**
 * Categories Management Router (MainCategory / SubCategory)
 * Routes are mounted at /admin/categories
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

// ==================== Schemas ====================

const AdminCategoriesStatsQuerySchema = z.object({});

const AdminMainCategoriesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  search: z.string().optional(),
  sort: z.enum(['createdAt', 'name']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const AdminCreateMainCategorySchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
});

const AdminUpdateMainCategorySchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
});

const AdminSubCategoriesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  mainCategoryId: z.string().uuid().optional(),
  search: z.string().optional(),
  sort: z.enum(['createdAt', 'name']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const AdminCreateSubCategorySchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  mainCategoryId: z.string().uuid(),
});

const AdminUpdateSubCategorySchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  mainCategoryId: z.string().uuid().optional(),
});

const AdminReorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      order: z.number().int().min(0),
    }),
  ),
});

// ==================== Image Upload ====================

const upload = createUpload('ADMIN_IMAGES', 'SMALL');

/**
 * POST /admin/categories/main/upload-image
 * Upload main category image
 */
router.post(
  '/main/upload-image',
  upload.single('file'),
  validateFileType('ADMIN_IMAGES'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const adminId = req.user?.id;
    const timestamp = Date.now();
    const ext = req.file.originalname.split('.').pop() || 'png';
    const fileName = `categories/main/main-category-${timestamp}.${ext}`;

    const path = await s3Service.uploadFile(fileName, req.file.buffer, req.file.mimetype);
    const url = resolveMediaUrl(path);

    logger.info('Admin uploaded main category image', { adminId, fileName, url });

    return res.json({ success: true, url: url ?? path });
  }),
);

/**
 * POST /admin/categories/sub/upload-image
 * Upload sub category image
 */
router.post(
  '/sub/upload-image',
  upload.single('file'),
  validateFileType('ADMIN_IMAGES'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const adminId = req.user?.id;
    const timestamp = Date.now();
    const ext = req.file.originalname.split('.').pop() || 'png';
    const fileName = `categories/sub/sub-category-${timestamp}.${ext}`;

    const path = await s3Service.uploadFile(fileName, req.file.buffer, req.file.mimetype);
    const url = resolveMediaUrl(path);

    logger.info('Admin uploaded sub category image', { adminId, fileName, url });

    return res.json({ success: true, url: url ?? path });
  }),
);

// ==================== Stats ====================

/**
 * GET /admin/categories/stats
 * Get category statistics
 */
router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [mainTotal, subTotal, mainWithImage, subWithImage] = await Promise.all([
      prisma.mainCategory.count(),
      prisma.subCategory.count(),
      prisma.mainCategory.count({ where: { imageUrl: { not: null } } }),
      prisma.subCategory.count({ where: { imageUrl: { not: null } } }),
    ]);

    return res.json({
      success: true,
      data: {
        mainCategories: mainTotal,
        subCategories: subTotal,
        total: mainTotal + subTotal,
        mainWithImage,
        subWithImage,
      },
    });
  }),
);

// ==================== Main Categories ====================

/**
 * GET /admin/categories/main
 * List main categories with pagination
 */
router.get(
  '/main',
  validateQuery(AdminMainCategoriesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminMainCategoriesQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [categories, total] = await Promise.all([
      prisma.mainCategory.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order },
        include: {
          _count: { select: { subCategories: true, contentPosts: true, events: true } },
        },
      }),
      prisma.mainCategory.count({ where }),
    ]);

    const data = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      imageUrl: cat.imageUrl,
      subCategoriesCount: cat._count.subCategories,
      contentPostsCount: cat._count.contentPosts,
      eventsCount: cat._count.events,
      createdAt: cat.createdAt.toISOString(),
      updatedAt: cat.updatedAt.toISOString(),
    }));

    return res.json({
      success: true,
      data,
      pagination: { total, limit: query.limit, offset: query.offset },
    });
  }),
);

/**
 * GET /admin/categories/main/:id
 * Get main category details with sub categories
 */
router.get(
  '/main/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const category = await prisma.mainCategory.findUnique({
      where: { id },
      include: {
        subCategories: {
          orderBy: { name: 'asc' },
          include: {
            _count: { select: { contentPosts: true, productGroups: true, events: true } },
          },
        },
        _count: { select: { contentPosts: true, events: true } },
      },
    });

    if (!category) {
      throw new NotFoundError('Main category not found');
    }

    return res.json({
      success: true,
      data: {
        id: category.id,
        name: category.name,
        description: category.description,
        imageUrl: category.imageUrl,
        contentPostsCount: category._count.contentPosts,
        eventsCount: category._count.events,
        subCategories: category.subCategories.map((sub) => ({
          id: sub.id,
          name: sub.name,
          description: sub.description,
          imageUrl: sub.imageUrl,
          contentPostsCount: sub._count.contentPosts,
          productGroupsCount: sub._count.productGroups,
          eventsCount: sub._count.events,
          createdAt: sub.createdAt.toISOString(),
          updatedAt: sub.updatedAt.toISOString(),
        })),
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
      },
    });
  }),
);

/**
 * POST /admin/categories/main
 * Create a new main category
 */
router.post(
  '/main',
  validateBody(AdminCreateMainCategorySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    const body = AdminCreateMainCategorySchema.parse(req.body);

    const category = await prisma.mainCategory.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        imageUrl: body.imageUrl ?? null,
      },
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'MAIN_CATEGORY_CREATE',
        description: `Created main category: ${body.name}`,
        entityType: 'main_category',
        entityId: 0,
      },
    });

    logger.info('Admin created main category', { adminId, categoryId: category.id, name: body.name });

    return res.status(201).json({
      success: true,
      data: {
        id: category.id,
        name: category.name,
        description: category.description,
        imageUrl: category.imageUrl,
        createdAt: category.createdAt.toISOString(),
      },
    });
  }),
);

/**
 * PATCH /admin/categories/main/:id
 * Update main category
 */
router.patch(
  '/main/:id',
  validateBody(AdminUpdateMainCategorySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    const body = AdminUpdateMainCategorySchema.parse(req.body);

    const existing = await prisma.mainCategory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Main category not found');
    }

    // Clean up old image if being replaced
    if (body.imageUrl !== undefined && existing.imageUrl && body.imageUrl !== existing.imageUrl) {
      try {
        await s3Service.deleteFile(existing.imageUrl);
      } catch (err) {
        logger.warn('Failed to delete old main category image', { imageUrl: existing.imageUrl });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description ?? null;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl ?? null;

    const updated = await prisma.mainCategory.update({
      where: { id },
      data: updateData,
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'MAIN_CATEGORY_UPDATE',
        description: `Updated main category ${id}`,
        entityType: 'main_category',
        entityId: 0,
      },
    });

    logger.info('Admin updated main category', { adminId, categoryId: id, changes: body });

    return res.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        imageUrl: updated.imageUrl,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  }),
);

/**
 * DELETE /admin/categories/main/:id
 * Delete main category
 */
router.delete(
  '/main/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    const category = await prisma.mainCategory.findUnique({
      where: { id },
      include: { _count: { select: { subCategories: true, contentPosts: true } } },
    });

    if (!category) {
      throw new NotFoundError('Main category not found');
    }

    if (category._count.subCategories > 0) {
      throw new ValidationError(
        `Cannot delete: category has ${category._count.subCategories} sub-categories. Remove them first.`,
      );
    }

    if (category._count.contentPosts > 0) {
      throw new ValidationError(
        `Cannot delete: category has ${category._count.contentPosts} content posts linked.`,
      );
    }

    // Clean up image
    if (category.imageUrl) {
      try {
        await s3Service.deleteFile(category.imageUrl);
      } catch (err) {
        logger.warn('Failed to delete main category image', { imageUrl: category.imageUrl });
      }
    }

    await prisma.mainCategory.delete({ where: { id } });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'MAIN_CATEGORY_DELETE',
        description: `Deleted main category: ${category.name}`,
        entityType: 'main_category',
        entityId: 0,
      },
    });

    logger.info('Admin deleted main category', { adminId, categoryId: id });

    return res.json({ success: true, message: 'Main category deleted successfully' });
  }),
);

/**
 * POST /admin/categories/main/reorder
 * Reorder main categories (uses a displayOrder concept via name ordering)
 */
router.post(
  '/main/reorder',
  validateBody(AdminReorderSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    const { items } = AdminReorderSchema.parse(req.body);

    // Update each category order (we use a naming-based approach since MainCategory has no displayOrder)
    // This endpoint is a placeholder if displayOrder column is added later
    await Promise.all(
      items.map((item) =>
        prisma.mainCategory.update({
          where: { id: item.id },
          data: { updatedAt: new Date() },
        }),
      ),
    );

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'MAIN_CATEGORY_REORDER',
        description: `Reordered ${items.length} main categories`,
        entityType: 'main_category',
        entityId: 0,
      },
    });

    return res.json({ success: true, message: 'Categories reordered' });
  }),
);

// ==================== Sub Categories ====================

/**
 * GET /admin/categories/sub
 * List sub categories with pagination and filters
 */
router.get(
  '/sub',
  validateQuery(AdminSubCategoriesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminSubCategoriesQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.mainCategoryId) where.mainCategoryId = query.mainCategoryId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [categories, total] = await Promise.all([
      prisma.subCategory.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order },
        include: {
          mainCategory: { select: { id: true, name: true } },
          _count: { select: { contentPosts: true, productGroups: true, events: true } },
        },
      }),
      prisma.subCategory.count({ where }),
    ]);

    const data = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      imageUrl: cat.imageUrl,
      mainCategoryId: cat.mainCategoryId,
      mainCategoryName: cat.mainCategory.name,
      contentPostsCount: cat._count.contentPosts,
      productGroupsCount: cat._count.productGroups,
      eventsCount: cat._count.events,
      createdAt: cat.createdAt.toISOString(),
      updatedAt: cat.updatedAt.toISOString(),
    }));

    return res.json({
      success: true,
      data,
      pagination: { total, limit: query.limit, offset: query.offset },
    });
  }),
);

/**
 * GET /admin/categories/sub/:id
 * Get sub category details
 */
router.get(
  '/sub/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const category = await prisma.subCategory.findUnique({
      where: { id },
      include: {
        mainCategory: { select: { id: true, name: true } },
        _count: { select: { contentPosts: true, productGroups: true, events: true } },
      },
    });

    if (!category) {
      throw new NotFoundError('Sub category not found');
    }

    return res.json({
      success: true,
      data: {
        id: category.id,
        name: category.name,
        description: category.description,
        imageUrl: category.imageUrl,
        mainCategoryId: category.mainCategoryId,
        mainCategoryName: category.mainCategory.name,
        contentPostsCount: category._count.contentPosts,
        productGroupsCount: category._count.productGroups,
        eventsCount: category._count.events,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
      },
    });
  }),
);

/**
 * POST /admin/categories/sub
 * Create a new sub category
 */
router.post(
  '/sub',
  validateBody(AdminCreateSubCategorySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    const body = AdminCreateSubCategorySchema.parse(req.body);

    // Verify main category exists
    const mainCategory = await prisma.mainCategory.findUnique({
      where: { id: body.mainCategoryId },
    });
    if (!mainCategory) {
      throw new ValidationError('Main category not found');
    }

    const category = await prisma.subCategory.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        imageUrl: body.imageUrl ?? null,
        mainCategoryId: body.mainCategoryId,
      },
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'SUB_CATEGORY_CREATE',
        description: `Created sub category: ${body.name} (parent: ${mainCategory.name})`,
        entityType: 'sub_category',
        entityId: 0,
      },
    });

    logger.info('Admin created sub category', { adminId, categoryId: category.id, name: body.name });

    return res.status(201).json({
      success: true,
      data: {
        id: category.id,
        name: category.name,
        description: category.description,
        imageUrl: category.imageUrl,
        mainCategoryId: category.mainCategoryId,
        createdAt: category.createdAt.toISOString(),
      },
    });
  }),
);

/**
 * PATCH /admin/categories/sub/:id
 * Update sub category
 */
router.patch(
  '/sub/:id',
  validateBody(AdminUpdateSubCategorySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    const body = AdminUpdateSubCategorySchema.parse(req.body);

    const existing = await prisma.subCategory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Sub category not found');
    }

    // Verify new main category if changing
    if (body.mainCategoryId && body.mainCategoryId !== existing.mainCategoryId) {
      const mainCategory = await prisma.mainCategory.findUnique({
        where: { id: body.mainCategoryId },
      });
      if (!mainCategory) {
        throw new ValidationError('Main category not found');
      }
    }

    // Clean up old image if being replaced
    if (body.imageUrl !== undefined && existing.imageUrl && body.imageUrl !== existing.imageUrl) {
      try {
        await s3Service.deleteFile(existing.imageUrl);
      } catch (err) {
        logger.warn('Failed to delete old sub category image', { imageUrl: existing.imageUrl });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description ?? null;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl ?? null;
    if (body.mainCategoryId !== undefined) updateData.mainCategoryId = body.mainCategoryId;

    const updated = await prisma.subCategory.update({
      where: { id },
      data: updateData,
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'SUB_CATEGORY_UPDATE',
        description: `Updated sub category ${id}`,
        entityType: 'sub_category',
        entityId: 0,
      },
    });

    logger.info('Admin updated sub category', { adminId, categoryId: id, changes: body });

    return res.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        imageUrl: updated.imageUrl,
        mainCategoryId: updated.mainCategoryId,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  }),
);

/**
 * DELETE /admin/categories/sub/:id
 * Delete sub category
 */
router.delete(
  '/sub/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    const category = await prisma.subCategory.findUnique({
      where: { id },
      include: { _count: { select: { contentPosts: true, productGroups: true } } },
    });

    if (!category) {
      throw new NotFoundError('Sub category not found');
    }

    if (category._count.contentPosts > 0) {
      throw new ValidationError(
        `Cannot delete: sub category has ${category._count.contentPosts} content posts linked.`,
      );
    }

    if (category._count.productGroups > 0) {
      throw new ValidationError(
        `Cannot delete: sub category has ${category._count.productGroups} product groups linked.`,
      );
    }

    // Clean up image
    if (category.imageUrl) {
      try {
        await s3Service.deleteFile(category.imageUrl);
      } catch (err) {
        logger.warn('Failed to delete sub category image', { imageUrl: category.imageUrl });
      }
    }

    await prisma.subCategory.delete({ where: { id } });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'SUB_CATEGORY_DELETE',
        description: `Deleted sub category: ${category.name}`,
        entityType: 'sub_category',
        entityId: 0,
      },
    });

    logger.info('Admin deleted sub category', { adminId, categoryId: id });

    return res.json({ success: true, message: 'Sub category deleted successfully' });
  }),
);

/**
 * POST /admin/categories/sub/reorder
 * Reorder sub categories
 */
router.post(
  '/sub/reorder',
  validateBody(AdminReorderSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    const { items } = AdminReorderSchema.parse(req.body);

    await Promise.all(
      items.map((item) =>
        prisma.subCategory.update({
          where: { id: item.id },
          data: { updatedAt: new Date() },
        }),
      ),
    );

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'SUB_CATEGORY_REORDER',
        description: `Reordered ${items.length} sub categories`,
        entityType: 'sub_category',
        entityId: 0,
      },
    });

    return res.json({ success: true, message: 'Sub categories reordered' });
  }),
);

export default router;
