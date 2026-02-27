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
 * User Feed Preferences Management Router
 * Routes are mounted at /admin/user-feed-preferences
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

// ==================== Schemas ====================

const AdminUserFeedPreferencesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
  userId: z.string().uuid().optional(),
  language: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(['createdAt', 'updatedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const AdminUpdateUserFeedPreferenceSchema = z.object({
  preferredCategories: z.string().nullable().optional(),
  preferredContentTypes: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
});

// ==================== User Feed Preferences ====================

/**
 * GET /admin/user-feed-preferences/stats
 * Get user feed preference statistics
 */
router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [totalPreferences, byLanguage, withCategories, withContentTypes] = await Promise.all([
      prisma.userFeedPreferences.count(),
      prisma.userFeedPreferences.groupBy({
        by: ['language'],
        _count: { id: true },
        where: { language: { not: null } },
      }),
      prisma.userFeedPreferences.count({
        where: { preferredCategories: { not: null } },
      }),
      prisma.userFeedPreferences.count({
        where: { preferredContentTypes: { not: null } },
      }),
    ]);

    const byLanguageMap = byLanguage.reduce((acc, item) => {
      if (item.language) {
        acc[item.language] = item._count.id;
      }
      return acc;
    }, {} as Record<string, number>);

    return res.json({
      success: true,
      data: {
        totalPreferences,
        withCategories,
        withContentTypes,
        byLanguage: byLanguageMap,
      },
    });
  })
);

/**
 * GET /admin/user-feed-preferences
 * List user feed preferences with pagination and filters
 */
router.get(
  '/',
  validateQuery(AdminUserFeedPreferencesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminUserFeedPreferencesQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.userId) where.userId = query.userId;
    if (query.language) where.language = query.language;

    const [preferences, total] = await Promise.all([
      prisma.userFeedPreferences.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order },
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
      }),
      prisma.userFeedPreferences.count({ where }),
    ]);

    const formattedPreferences = preferences.map((pref) => ({
      id: pref.id,
      userId: pref.userId,
      username: pref.user?.profile?.username ?? null,
      userEmail: pref.user?.email ?? null,
      preferredCategories: pref.preferredCategories,
      preferredContentTypes: pref.preferredContentTypes,
      language: pref.language,
      createdAt: pref.createdAt.toISOString(),
      updatedAt: pref.updatedAt.toISOString(),
    }));

    return res.json({
      success: true,
      data: formattedPreferences,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
      },
    });
  })
);

/**
 * GET /admin/user-feed-preferences/:id
 * Get single user feed preference details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const preference = await prisma.userFeedPreferences.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            profile: {
              select: {
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!preference) {
      throw new NotFoundError('User feed preference not found');
    }

    const formattedPreference = {
      id: preference.id,
      userId: preference.userId,
      user: {
        id: preference.user.id,
        email: preference.user.email,
        status: preference.user.status,
        username: preference.user.profile?.username ?? null,
        displayName: preference.user.profile?.displayName ?? null,
        avatarUrl: preference.user.profile?.avatarUrl ?? null,
      },
      preferredCategories: preference.preferredCategories,
      preferredContentTypes: preference.preferredContentTypes,
      language: preference.language,
      createdAt: preference.createdAt.toISOString(),
      updatedAt: preference.updatedAt.toISOString(),
    };

    return res.json({
      success: true,
      data: formattedPreference,
    });
  })
);

/**
 * PATCH /admin/user-feed-preferences/:id
 * Update user feed preference
 */
router.patch(
  '/:id',
  validateBody(AdminUpdateUserFeedPreferenceSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    const body = AdminUpdateUserFeedPreferenceSchema.parse(req.body);

    const existingPreference = await prisma.userFeedPreferences.findUnique({
      where: { id },
    });

    if (!existingPreference) {
      throw new NotFoundError('User feed preference not found');
    }

    const updateData: Record<string, unknown> = {};
    if (body.preferredCategories !== undefined) {
      updateData.preferredCategories = body.preferredCategories ?? null;
    }
    if (body.preferredContentTypes !== undefined) {
      updateData.preferredContentTypes = body.preferredContentTypes ?? null;
    }
    if (body.language !== undefined) {
      updateData.language = body.language ?? null;
    }

    const updatedPreference = await prisma.userFeedPreferences.update({
      where: { id },
      data: updateData,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'USER_FEED_PREFERENCE_UPDATE',
        description: `Updated feed preferences for user ${existingPreference.userId}`,
        entityType: 'user_feed_preference',
        entityId: 0,
      },
    });

    logger.info('Admin updated user feed preferences', {
      adminId,
      preferenceId: id,
      userId: existingPreference.userId,
    });

    return res.json({
      success: true,
      data: {
        id: updatedPreference.id,
        preferredCategories: updatedPreference.preferredCategories,
        preferredContentTypes: updatedPreference.preferredContentTypes,
        language: updatedPreference.language,
        updatedAt: updatedPreference.updatedAt.toISOString(),
      },
    });
  })
);

/**
 * DELETE /admin/user-feed-preferences/:id
 * Delete user feed preference (reset to defaults)
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    const preference = await prisma.userFeedPreferences.findUnique({
      where: { id },
    });

    if (!preference) {
      throw new NotFoundError('User feed preference not found');
    }

    await prisma.userFeedPreferences.delete({
      where: { id },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'USER_FEED_PREFERENCE_DELETE',
        description: `Reset feed preferences for user ${preference.userId}`,
        entityType: 'user_feed_preference',
        entityId: 0,
      },
    });

    logger.info('Admin reset user feed preferences', {
      adminId,
      preferenceId: id,
      userId: preference.userId,
    });

    return res.json({
      success: true,
      message: 'User feed preferences reset successfully',
    });
  })
);

export default router;
