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
 * User Themes Management Router
 * Routes are mounted at /admin/user-themes
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

// ==================== Schemas ====================

const AdminUserThemesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  search: z.string().optional(),
  sort: z.enum(['createdAt', 'name']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const AdminCreateUserThemeSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
});

const AdminUpdateUserThemeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
});

// ==================== User Themes ====================

/**
 * GET /admin/user-themes/stats
 * Get user theme statistics
 */
router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [totalThemes, totalUsersWithThemes] = await Promise.all([
      prisma.userTheme.count(),
      prisma.userSettings.count({
        where: {
          themeId: { not: null },
        },
      }),
    ]);

    const mostUsedThemes = await prisma.userTheme.findMany({
      take: 5,
      include: {
        _count: {
          select: {
            userSettings: true,
          },
        },
      },
      orderBy: {
        userSettings: {
          _count: 'desc',
        },
      },
    });

    return res.json({
      success: true,
      data: {
        totalThemes,
        totalUsersWithThemes,
        mostUsedThemes: mostUsedThemes.map((theme) => ({
          id: theme.id,
          name: theme.name,
          userCount: theme._count.userSettings,
        })),
      },
    });
  })
);

/**
 * GET /admin/user-themes
 * List user themes with pagination and filters
 */
router.get(
  '/',
  validateQuery(AdminUserThemesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminUserThemesQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [themes, total] = await Promise.all([
      prisma.userTheme.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order },
        include: {
          _count: {
            select: {
              userSettings: true,
            },
          },
        },
      }),
      prisma.userTheme.count({ where }),
    ]);

    const formattedThemes = themes.map((theme) => ({
      id: theme.id,
      name: theme.name,
      description: theme.description,
      userCount: theme._count.userSettings,
      createdAt: theme.createdAt.toISOString(),
      updatedAt: theme.updatedAt.toISOString(),
    }));

    return res.json({
      success: true,
      data: formattedThemes,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
      },
    });
  })
);

/**
 * GET /admin/user-themes/:id
 * Get single user theme details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const theme = await prisma.userTheme.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            userSettings: true,
          },
        },
        userSettings: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                profile: {
                  select: {
                    username: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!theme) {
      throw new NotFoundError('User theme not found');
    }

    const formattedTheme = {
      id: theme.id,
      name: theme.name,
      description: theme.description,
      userCount: theme._count.userSettings,
      recentUsers: theme.userSettings.map((setting) => ({
        userId: setting.userId,
        username: setting.user?.profile?.username ?? null,
        userEmail: setting.user?.email ?? null,
        createdAt: setting.createdAt.toISOString(),
      })),
      createdAt: theme.createdAt.toISOString(),
      updatedAt: theme.updatedAt.toISOString(),
    };

    return res.json({
      success: true,
      data: formattedTheme,
    });
  })
);

/**
 * POST /admin/user-themes
 * Create a new user theme
 */
router.post(
  '/',
  validateBody(AdminCreateUserThemeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    const body = AdminCreateUserThemeSchema.parse(req.body);

    const theme = await prisma.userTheme.create({
      data: {
        name: body.name,
        description: body.description ?? null,
      },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'USER_THEME_CREATE',
        description: `Created user theme: ${body.name}`,
        entityType: 'user_theme',
        entityId: 0,
      },
    });

    logger.info('Admin created user theme', {
      adminId,
      themeId: theme.id,
      name: body.name,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: theme.id,
        name: theme.name,
        description: theme.description,
        createdAt: theme.createdAt.toISOString(),
      },
    });
  })
);

/**
 * PATCH /admin/user-themes/:id
 * Update user theme details
 */
router.patch(
  '/:id',
  validateBody(AdminUpdateUserThemeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    const body = AdminUpdateUserThemeSchema.parse(req.body);

    const existingTheme = await prisma.userTheme.findUnique({
      where: { id },
    });

    if (!existingTheme) {
      throw new NotFoundError('User theme not found');
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description ?? null;

    const updatedTheme = await prisma.userTheme.update({
      where: { id },
      data: updateData,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'USER_THEME_UPDATE',
        description: `Updated user theme ${id}`,
        entityType: 'user_theme',
        entityId: 0,
      },
    });

    logger.info('Admin updated user theme', {
      adminId,
      themeId: id,
      changes: body,
    });

    return res.json({
      success: true,
      data: {
        id: updatedTheme.id,
        name: updatedTheme.name,
        description: updatedTheme.description,
        updatedAt: updatedTheme.updatedAt.toISOString(),
      },
    });
  })
);

/**
 * DELETE /admin/user-themes/:id
 * Delete user theme (only if not in use)
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    const theme = await prisma.userTheme.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            userSettings: true,
          },
        },
      },
    });

    if (!theme) {
      throw new NotFoundError('User theme not found');
    }

    if (theme._count.userSettings > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete theme in use by ${theme._count.userSettings} user(s)`,
      });
    }

    await prisma.userTheme.delete({
      where: { id },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'USER_THEME_DELETE',
        description: `Deleted user theme ${id}`,
        entityType: 'user_theme',
        entityId: 0,
      },
    });

    logger.info('Admin deleted user theme', {
      adminId,
      themeId: id,
    });

    return res.json({
      success: true,
      message: 'User theme deleted successfully',
    });
  })
);

export default router;
