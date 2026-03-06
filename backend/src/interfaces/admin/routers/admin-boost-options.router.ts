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
 * Boost Options Management Router
 * Routes are mounted at /admin/boost-options
 */

// ==================== Schemas ====================

const AdminBoostOptionsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  sort: z.enum(['createdAt', 'amount', 'title']).default('amount'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const AdminCreateBoostOptionSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).nullable().optional(),
  image: z.string().url().nullable().optional(),
  amount: z.number().min(0),
  isPopular: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

const AdminUpdateBoostOptionSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  image: z.string().url().nullable().optional(),
  amount: z.number().min(0).optional(),
  isPopular: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// ==================== Image Upload ====================

const upload = createUpload('ADMIN_IMAGES', 'SMALL');

router.post(
  '/upload-image',
  upload.single('file'),
  validateFileType('ADMIN_IMAGES'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const adminId = req.user?.id;
    const timestamp = Date.now();
    const ext = req.file.originalname.split('.').pop() || 'png';
    const fileName = `boost-options/boost-option-${timestamp}.${ext}`;

    const path = await s3Service.uploadFile(fileName, req.file.buffer, req.file.mimetype);
    const url = resolveMediaUrl(path);

    logger.info('Admin uploaded boost option image', { adminId, fileName, url });

    return res.json({ success: true, url: url ?? path });
  }),
);

// ==================== Stats ====================

router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [total, active, popular] = await Promise.all([
      prisma.boostOption.count(),
      prisma.boostOption.count({ where: { isActive: true } }),
      prisma.boostOption.count({ where: { isPopular: true } }),
    ]);

    return res.json({
      success: true,
      data: {
        total,
        active,
        inactive: total - active,
        popular,
      },
    });
  }),
);

// ==================== CRUD ====================

router.get(
  '/',
  validateQuery(AdminBoostOptionsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminBoostOptionsQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [options, total] = await Promise.all([
      prisma.boostOption.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order },
      }),
      prisma.boostOption.count({ where }),
    ]);

    const data = options.map((opt) => ({
      id: opt.id,
      title: opt.title,
      description: opt.description,
      image: opt.image,
      amount: opt.amount,
      isPopular: opt.isPopular,
      isActive: opt.isActive,
      createdAt: opt.createdAt.toISOString(),
      updatedAt: opt.updatedAt.toISOString(),
    }));

    return res.json({
      success: true,
      data,
      pagination: { total, limit: query.limit, offset: query.offset },
    });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const option = await prisma.boostOption.findUnique({ where: { id } });
    if (!option) {
      throw new NotFoundError('Boost option not found');
    }

    return res.json({
      success: true,
      data: {
        id: option.id,
        title: option.title,
        description: option.description,
        image: option.image,
        amount: option.amount,
        isPopular: option.isPopular,
        isActive: option.isActive,
        createdAt: option.createdAt.toISOString(),
        updatedAt: option.updatedAt.toISOString(),
      },
    });
  }),
);

router.post(
  '/',
  validateBody(AdminCreateBoostOptionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    const body = AdminCreateBoostOptionSchema.parse(req.body);

    const option = await prisma.boostOption.create({
      data: {
        title: body.title,
        description: body.description ?? null,
        image: body.image ?? null,
        amount: body.amount,
        isPopular: body.isPopular,
        isActive: body.isActive,
      },
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'BOOST_OPTION_CREATE',
        description: `Created boost option: ${body.title}`,
        entityType: 'boost_option',
        entityId: 0,
      },
    });

    logger.info('Admin created boost option', { adminId, optionId: option.id, title: body.title });

    return res.status(201).json({
      success: true,
      data: {
        id: option.id,
        title: option.title,
        description: option.description,
        image: option.image,
        amount: option.amount,
        isPopular: option.isPopular,
        isActive: option.isActive,
        createdAt: option.createdAt.toISOString(),
      },
    });
  }),
);

router.patch(
  '/:id',
  validateBody(AdminUpdateBoostOptionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    const body = AdminUpdateBoostOptionSchema.parse(req.body);

    const existing = await prisma.boostOption.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Boost option not found');
    }

    // Clean up old image if being replaced
    if (body.image !== undefined && existing.image && body.image !== existing.image) {
      try {
        await s3Service.deleteFile(existing.image);
      } catch (err) {
        logger.warn('Failed to delete old boost option image', { image: existing.image });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description ?? null;
    if (body.image !== undefined) updateData.image = body.image ?? null;
    if (body.amount !== undefined) updateData.amount = body.amount;
    if (body.isPopular !== undefined) updateData.isPopular = body.isPopular;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updated = await prisma.boostOption.update({
      where: { id },
      data: updateData,
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'BOOST_OPTION_UPDATE',
        description: `Updated boost option ${id}`,
        entityType: 'boost_option',
        entityId: 0,
      },
    });

    logger.info('Admin updated boost option', { adminId, optionId: id, changes: body });

    return res.json({
      success: true,
      data: {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        image: updated.image,
        amount: updated.amount,
        isPopular: updated.isPopular,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    const option = await prisma.boostOption.findUnique({ where: { id } });
    if (!option) {
      throw new NotFoundError('Boost option not found');
    }

    if (option.image) {
      try {
        await s3Service.deleteFile(option.image);
      } catch (err) {
        logger.warn('Failed to delete boost option image', { image: option.image });
      }
    }

    await prisma.boostOption.delete({ where: { id } });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'BOOST_OPTION_DELETE',
        description: `Deleted boost option: ${option.title}`,
        entityType: 'boost_option',
        entityId: 0,
      },
    });

    logger.info('Admin deleted boost option', { adminId, optionId: id });

    return res.json({ success: true, message: 'Boost option deleted successfully' });
  }),
);

export default router;
