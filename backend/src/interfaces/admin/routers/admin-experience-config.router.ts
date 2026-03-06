import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError } from '../../../infrastructure/errors/custom-errors';
import logger from '../../../infrastructure/logger/logger';
import { z } from 'zod';

const router = Router();
const prisma = getPrisma();

/**
 * Experience Configuration Router (Duration / Location / Purpose)
 * Routes are mounted at /admin/experience-config
 */

// ==================== Schemas ====================

const AdminExperienceConfigQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  sort: z.enum(['createdAt', 'name']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const AdminCreateExperienceItemSchema = z.object({
  name: z.string().min(1).max(500),
  isActive: z.boolean().default(true),
});

const AdminUpdateExperienceItemSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  isActive: z.boolean().optional(),
});

// ==================== Stats ====================

router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [
      durationsTotal,
      durationsActive,
      locationsTotal,
      locationsActive,
      purposesTotal,
      purposesActive,
    ] = await Promise.all([
      prisma.experienceDuration.count(),
      prisma.experienceDuration.count({ where: { isActive: true } }),
      prisma.experienceLocation.count(),
      prisma.experienceLocation.count({ where: { isActive: true } }),
      prisma.experiencePurpose.count(),
      prisma.experiencePurpose.count({ where: { isActive: true } }),
    ]);

    return res.json({
      success: true,
      data: {
        durations: { total: durationsTotal, active: durationsActive },
        locations: { total: locationsTotal, active: locationsActive },
        purposes: { total: purposesTotal, active: purposesActive },
      },
    });
  }),
);

// ==================== Durations ====================

router.get(
  '/durations',
  validateQuery(AdminExperienceConfigQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminExperienceConfigQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      prisma.experienceDuration.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order },
        include: { _count: { select: { contentPosts: true, inventories: true } } },
      }),
      prisma.experienceDuration.count({ where }),
    ]);

    const data = items.map((item) => ({
      id: item.id,
      name: item.name,
      isActive: item.isActive,
      contentPostsCount: item._count.contentPosts,
      inventoriesCount: item._count.inventories,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));

    return res.json({
      success: true,
      data,
      pagination: { total, limit: query.limit, offset: query.offset },
    });
  }),
);

router.post(
  '/durations',
  validateBody(AdminCreateExperienceItemSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    const body = AdminCreateExperienceItemSchema.parse(req.body);

    const item = await prisma.experienceDuration.create({
      data: { name: body.name, isActive: body.isActive },
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'EXPERIENCE_DURATION_CREATE',
        description: `Created experience duration: ${body.name}`,
        entityType: 'experience_duration',
        entityId: 0,
      },
    });

    logger.info('Admin created experience duration', { adminId, id: item.id, name: body.name });

    return res.status(201).json({
      success: true,
      data: {
        id: item.id,
        name: item.name,
        isActive: item.isActive,
        createdAt: item.createdAt.toISOString(),
      },
    });
  }),
);

router.patch(
  '/durations/:id',
  validateBody(AdminUpdateExperienceItemSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    const body = AdminUpdateExperienceItemSchema.parse(req.body);

    const existing = await prisma.experienceDuration.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Experience duration not found');
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updated = await prisma.experienceDuration.update({
      where: { id },
      data: updateData,
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'EXPERIENCE_DURATION_UPDATE',
        description: `Updated experience duration ${id}`,
        entityType: 'experience_duration',
        entityId: 0,
      },
    });

    logger.info('Admin updated experience duration', { adminId, id, changes: body });

    return res.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  }),
);

router.delete(
  '/durations/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    const item = await prisma.experienceDuration.findUnique({
      where: { id },
      include: { _count: { select: { contentPosts: true, inventories: true } } },
    });

    if (!item) {
      throw new NotFoundError('Experience duration not found');
    }

    const usageCount = item._count.contentPosts + item._count.inventories;
    if (usageCount > 0) {
      // Soft delete: just deactivate instead of hard delete
      await prisma.experienceDuration.update({
        where: { id },
        data: { isActive: false },
      });

      await prisma.adminLog.create({
        data: {
          adminId: adminId || 'system',
          action: 'EXPERIENCE_DURATION_DEACTIVATE',
          description: `Deactivated experience duration ${id} (in use by ${usageCount} records)`,
          entityType: 'experience_duration',
          entityId: 0,
        },
      });

      return res.json({
        success: true,
        message: `Duration deactivated (in use by ${usageCount} records)`,
      });
    }

    await prisma.experienceDuration.delete({ where: { id } });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'EXPERIENCE_DURATION_DELETE',
        description: `Deleted experience duration: ${item.name}`,
        entityType: 'experience_duration',
        entityId: 0,
      },
    });

    logger.info('Admin deleted experience duration', { adminId, id });

    return res.json({ success: true, message: 'Experience duration deleted successfully' });
  }),
);

// ==================== Locations ====================

router.get(
  '/locations',
  validateQuery(AdminExperienceConfigQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminExperienceConfigQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      prisma.experienceLocation.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order },
        include: { _count: { select: { contentPosts: true, inventories: true } } },
      }),
      prisma.experienceLocation.count({ where }),
    ]);

    const data = items.map((item) => ({
      id: item.id,
      name: item.name,
      isActive: item.isActive,
      contentPostsCount: item._count.contentPosts,
      inventoriesCount: item._count.inventories,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));

    return res.json({
      success: true,
      data,
      pagination: { total, limit: query.limit, offset: query.offset },
    });
  }),
);

router.post(
  '/locations',
  validateBody(AdminCreateExperienceItemSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    const body = AdminCreateExperienceItemSchema.parse(req.body);

    const item = await prisma.experienceLocation.create({
      data: { name: body.name, isActive: body.isActive },
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'EXPERIENCE_LOCATION_CREATE',
        description: `Created experience location: ${body.name}`,
        entityType: 'experience_location',
        entityId: 0,
      },
    });

    logger.info('Admin created experience location', { adminId, id: item.id, name: body.name });

    return res.status(201).json({
      success: true,
      data: {
        id: item.id,
        name: item.name,
        isActive: item.isActive,
        createdAt: item.createdAt.toISOString(),
      },
    });
  }),
);

router.patch(
  '/locations/:id',
  validateBody(AdminUpdateExperienceItemSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    const body = AdminUpdateExperienceItemSchema.parse(req.body);

    const existing = await prisma.experienceLocation.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Experience location not found');
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updated = await prisma.experienceLocation.update({
      where: { id },
      data: updateData,
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'EXPERIENCE_LOCATION_UPDATE',
        description: `Updated experience location ${id}`,
        entityType: 'experience_location',
        entityId: 0,
      },
    });

    logger.info('Admin updated experience location', { adminId, id, changes: body });

    return res.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  }),
);

router.delete(
  '/locations/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    const item = await prisma.experienceLocation.findUnique({
      where: { id },
      include: { _count: { select: { contentPosts: true, inventories: true } } },
    });

    if (!item) {
      throw new NotFoundError('Experience location not found');
    }

    const usageCount = item._count.contentPosts + item._count.inventories;
    if (usageCount > 0) {
      await prisma.experienceLocation.update({
        where: { id },
        data: { isActive: false },
      });

      await prisma.adminLog.create({
        data: {
          adminId: adminId || 'system',
          action: 'EXPERIENCE_LOCATION_DEACTIVATE',
          description: `Deactivated experience location ${id} (in use by ${usageCount} records)`,
          entityType: 'experience_location',
          entityId: 0,
        },
      });

      return res.json({
        success: true,
        message: `Location deactivated (in use by ${usageCount} records)`,
      });
    }

    await prisma.experienceLocation.delete({ where: { id } });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'EXPERIENCE_LOCATION_DELETE',
        description: `Deleted experience location: ${item.name}`,
        entityType: 'experience_location',
        entityId: 0,
      },
    });

    logger.info('Admin deleted experience location', { adminId, id });

    return res.json({ success: true, message: 'Experience location deleted successfully' });
  }),
);

// ==================== Purposes ====================

router.get(
  '/purposes',
  validateQuery(AdminExperienceConfigQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminExperienceConfigQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      prisma.experiencePurpose.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order },
        include: { _count: { select: { contentPosts: true, inventories: true } } },
      }),
      prisma.experiencePurpose.count({ where }),
    ]);

    const data = items.map((item) => ({
      id: item.id,
      name: item.name,
      isActive: item.isActive,
      contentPostsCount: item._count.contentPosts,
      inventoriesCount: item._count.inventories,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));

    return res.json({
      success: true,
      data,
      pagination: { total, limit: query.limit, offset: query.offset },
    });
  }),
);

router.post(
  '/purposes',
  validateBody(AdminCreateExperienceItemSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    const body = AdminCreateExperienceItemSchema.parse(req.body);

    const item = await prisma.experiencePurpose.create({
      data: { name: body.name, isActive: body.isActive },
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'EXPERIENCE_PURPOSE_CREATE',
        description: `Created experience purpose: ${body.name}`,
        entityType: 'experience_purpose',
        entityId: 0,
      },
    });

    logger.info('Admin created experience purpose', { adminId, id: item.id, name: body.name });

    return res.status(201).json({
      success: true,
      data: {
        id: item.id,
        name: item.name,
        isActive: item.isActive,
        createdAt: item.createdAt.toISOString(),
      },
    });
  }),
);

router.patch(
  '/purposes/:id',
  validateBody(AdminUpdateExperienceItemSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    const body = AdminUpdateExperienceItemSchema.parse(req.body);

    const existing = await prisma.experiencePurpose.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Experience purpose not found');
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updated = await prisma.experiencePurpose.update({
      where: { id },
      data: updateData,
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'EXPERIENCE_PURPOSE_UPDATE',
        description: `Updated experience purpose ${id}`,
        entityType: 'experience_purpose',
        entityId: 0,
      },
    });

    logger.info('Admin updated experience purpose', { adminId, id, changes: body });

    return res.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  }),
);

router.delete(
  '/purposes/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    const item = await prisma.experiencePurpose.findUnique({
      where: { id },
      include: { _count: { select: { contentPosts: true, inventories: true } } },
    });

    if (!item) {
      throw new NotFoundError('Experience purpose not found');
    }

    const usageCount = item._count.contentPosts + item._count.inventories;
    if (usageCount > 0) {
      await prisma.experiencePurpose.update({
        where: { id },
        data: { isActive: false },
      });

      await prisma.adminLog.create({
        data: {
          adminId: adminId || 'system',
          action: 'EXPERIENCE_PURPOSE_DEACTIVATE',
          description: `Deactivated experience purpose ${id} (in use by ${usageCount} records)`,
          entityType: 'experience_purpose',
          entityId: 0,
        },
      });

      return res.json({
        success: true,
        message: `Purpose deactivated (in use by ${usageCount} records)`,
      });
    }

    await prisma.experiencePurpose.delete({ where: { id } });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'EXPERIENCE_PURPOSE_DELETE',
        description: `Deleted experience purpose: ${item.name}`,
        entityType: 'experience_purpose',
        entityId: 0,
      },
    });

    logger.info('Admin deleted experience purpose', { adminId, id });

    return res.json({ success: true, message: 'Experience purpose deleted successfully' });
  }),
);

export default router;
