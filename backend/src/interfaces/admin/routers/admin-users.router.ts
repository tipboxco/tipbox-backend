import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { ProfilePrismaRepository } from '../../../infrastructure/repositories/profile-prisma.repository';
import { UserAvatarPrismaRepository } from '../../../infrastructure/repositories/user-avatar-prisma.repository';
import { resolveMediaUrl } from '../../../infrastructure/config/media.config';
import { S3Service } from '../../../infrastructure/s3/s3.service';
import { NotFoundError } from '../../../infrastructure/errors/custom-errors';
import logger from '../../../infrastructure/logger/logger';

// Import schemas from modular structure
import {
  AdminUpdateUserSchema,
  AdminPutRolesSchema,
  AdminResolveReportSchema,
  AdminKycReviewSchema,
  AdminUsersQuerySchema,
  AdminUserReportsQuerySchema,
  AdminUserKycQuerySchema,
  AdminUserTrustScoresQuerySchema,
  AdminLoginAttemptsQuerySchema,
  AdminAvatarCreateSchema,
  AdminAvatarUpdateSchema,
  AdminGrantBadgeSchema,
} from '../schemas/admin-users.schemas';

// Import DTOs from modular structure
import type {
  AdminUserListItem,
  AdminUserDetailResponse,
  AdminProfileResponse,
  AdminRolesResponse,
  AdminModerationHistoryItem,
  AdminUserReportListItem,
  AdminUserReportDetailResponse,
  AdminUserReportStatsResponse,
  AdminKycListItem,
  AdminKycDetailResponse,
  AdminUserKycStatsResponse,
  AdminTrustScoreListItem,
  AdminLoginAttemptListItem,
  AdminUsersStatsResponse,
  AdminUserBannedStatsResponse,
  AdminAvatarResponse,
  AdminUserEventListItem,
  AdminUserBadgeListItem,
  AdminWalletSummaryItem,
  AdminTipsSummaryResponse,
  AdminTipsTransactionListItem,
} from '../dtos/admin-users.dto';

import type { PaginationMeta, AdminLogListItem } from '../dtos/admin-common.dto';
import type { AdminContentPostListItem } from '../dtos/admin-content.dto';
import { AdminContentPostsQuerySchema } from '../schemas/admin-content.schemas';

const router = Router();
const prisma = getPrisma();
const s3Service = new S3Service();

const adminUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (file.mimetype && allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece JPG, PNG, GIF ve WebP desteklenir'));
    }
  },
});

const profileRepo = new ProfilePrismaRepository();
const avatarRepo = new UserAvatarPrismaRepository();

/**
 * Users Router - Handles all user management endpoints
 * Routes are mounted at /admin/users
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Number(req.query.offset) || 0;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const emailVerifiedParam = req.query.emailVerified;
    const emailVerified =
      emailVerifiedParam === 'true' ? true : emailVerifiedParam === 'false' ? false : undefined;
    const sort = req.query.sort === 'email' ? 'email' : 'createdAt';
    const order = req.query.order === 'asc' ? 'asc' : 'desc';

    const where: Record<string, unknown> = {};
    if (status !== undefined && status !== '') where.status = status;
    if (emailVerified !== undefined) where.emailVerified = emailVerified;
    if (search && search.length > 0) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' as const } },
        { profile: { displayName: { contains: search, mode: 'insensitive' as const } } },
        { profile: { userName: { contains: search, mode: 'insensitive' as const } } },
      ];
    }

    const orderBy = sort === 'email' ? { email: order as 'asc' | 'desc' } : { createdAt: order as 'asc' | 'desc' };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          status: true,
          emailVerified: true,
          createdAt: true,
          profile: { select: { displayName: true, userName: true } },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
    ]);

    const data: AdminUserListItem[] = users.map((u) => ({
      id: u.id,
      email: u.email,
      status: u.status,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt.toISOString(),
      displayName: u.profile?.displayName ?? null,
      userName: u.profile?.userName ?? null,
    }));

    const pagination: PaginationMeta = { total, limit, offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /admin/users/stats:
 *   get:
 *     summary: Users bölümü özet istatistikleri
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: total, bannedCount, emailVerifiedCount, newThisWeek
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const [total, bannedCount, emailVerifiedCount, newThisWeek] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'BANNED' } }),
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
    ]);

    const data: AdminUsersStatsResponse = {
      total,
      bannedCount,
      emailVerifiedCount,
      newThisWeek,
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/users/{id}/avatar:
 *   get:
 *     summary: Kullanıcının aktif avatar bilgisi
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Avatar bilgisi
 *       204:
 *         description: Avatar yok
 */
router.get(
  '/:id/avatar',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }
    const avatar = await prisma.userAvatar.findFirst({
      where: { userId: id, isActive: true },
    });
    if (!avatar) {
      const anyAvatar = await prisma.userAvatar.findFirst({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
      });
      if (!anyAvatar) {
        return res.status(204).send();
      }
      const data: AdminAvatarResponse = {
        id: anyAvatar.id,
        userId: anyAvatar.userId,
        imageUrl: resolveMediaUrl(anyAvatar.imageUrl, true),
        isActive: anyAvatar.isActive,
        createdAt: anyAvatar.createdAt.toISOString(),
        updatedAt: anyAvatar.updatedAt.toISOString(),
      };
      return res.json({ success: true, data });
    }
    const data: AdminAvatarResponse = {
      id: avatar.id,
      userId: avatar.userId,
      imageUrl: resolveMediaUrl(avatar.imageUrl, true),
      isActive: avatar.isActive,
      createdAt: avatar.createdAt.toISOString(),
      updatedAt: avatar.updatedAt.toISOString(),
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/users/{id}/avatar:
 *   patch:
 *     summary: Kullanıcı avatar güncelle (imageUrl veya aktif kayıt)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *               avatarId:
 *                 type: string
 *                 format: uuid
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Avatar güncellendi
 *       404:
 *         description: Kullanıcı veya avatar bulunamadı
 */
router.patch(
  '/:id/avatar',
  validateBody(AdminAvatarUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const body = req.body as { imageUrl?: string; avatarId?: string; isActive?: boolean };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('Kullanıcı bulunamadı');

    if (body.avatarId !== undefined) {
      const target = await prisma.userAvatar.findFirst({
        where: { id: body.avatarId, userId: id },
      });
      if (!target) throw new NotFoundError('Avatar kaydı bulunamadı');
      await prisma.$transaction([
        prisma.userAvatar.updateMany({ where: { userId: id }, data: { isActive: false } }),
        prisma.userAvatar.update({ where: { id: body.avatarId }, data: { isActive: true } }),
      ]);
      await prisma.adminLog.create({
        data: {
          adminId,
          action: 'USER_AVATAR_UPDATE',
          description: `userId: ${id}, set active avatarId: ${body.avatarId}`,
          entityType: 'user_avatar',
          entityId: 0,
        },
      });
    } else if (body.imageUrl !== undefined) {
      const active = await prisma.userAvatar.findFirst({
        where: { userId: id, isActive: true },
      });
      if (active) {
        await prisma.userAvatar.update({
          where: { id: active.id },
          data: { imageUrl: body.imageUrl },
        });
      } else {
        await prisma.userAvatar.updateMany({ where: { userId: id }, data: { isActive: false } });
        await prisma.userAvatar.create({
          data: { userId: id, imageUrl: body.imageUrl, isActive: true },
        });
      }
      await prisma.adminLog.create({
        data: {
          adminId,
          action: 'USER_AVATAR_UPDATE',
          description: `userId: ${id}, imageUrl updated`,
          entityType: 'user_avatar',
          entityId: 0,
        },
      });
    } else if (body.isActive !== undefined) {
      const avatars = await prisma.userAvatar.findMany({ where: { userId: id } });
      if (avatars.length === 0) throw new NotFoundError('Avatar kaydı yok');
      await prisma.userAvatar.updateMany({ where: { userId: id }, data: { isActive: false } });
      if (body.isActive && avatars[0]) {
        await prisma.userAvatar.update({ where: { id: avatars[0].id }, data: { isActive: true } });
      }
    }

    const updated = await prisma.userAvatar.findFirst({
      where: { userId: id, isActive: true },
    }) ?? await prisma.userAvatar.findFirst({ where: { userId: id }, orderBy: { createdAt: 'desc' } });
    if (!updated) return res.json({ success: true, message: 'Avatar güncellendi', data: null });
    const data: AdminAvatarResponse = {
      id: updated.id,
      userId: updated.userId,
      imageUrl: resolveMediaUrl(updated.imageUrl, true),
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
    return res.json({ success: true, message: 'Avatar güncellendi', data });
  })
);

/**
 * @openapi
 * /admin/users/{id}/avatar:
 *   post:
 *     summary: Kullanıcıya yeni avatar ekle
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imageUrl
 *             properties:
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Avatar eklendi
 *       404:
 *         description: Kullanıcı bulunamadı
 */
router.post(
  '/:id/avatar',
  validateBody(AdminAvatarCreateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { imageUrl } = req.body as { imageUrl: string };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('Kullanıcı bulunamadı');

    await prisma.userAvatar.updateMany({ where: { userId: id }, data: { isActive: false } });
    const avatar = await prisma.userAvatar.create({
      data: { userId: id, imageUrl, isActive: true },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'USER_AVATAR_ADD',
        description: `userId: ${id}, avatarId: ${avatar.id}`,
        entityType: 'user_avatar',
        entityId: 0,
      },
    });

    const data: AdminAvatarResponse = {
      id: avatar.id,
      userId: avatar.userId,
      imageUrl: resolveMediaUrl(avatar.imageUrl, true),
      isActive: avatar.isActive,
      createdAt: avatar.createdAt.toISOString(),
      updatedAt: avatar.updatedAt.toISOString(),
    };
    return res.json({ success: true, message: 'Avatar eklendi', data });
  })
);

/**
 * @openapi
 * /admin/users/{id}/events:
 *   get:
 *     summary: Kullanıcının katıldığı event'ler (EventStats)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *       - in: query
 *         name: offset
 *       - in: query
 *         name: sort
 *       - in: query
 *         name: order
 *     responses:
 *       200:
 *         description: Event listesi (sayfalı)
 */
router.get(
  '/:id/events',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Number(req.query.offset) || 0;
    const sort = req.query.sort === 'eventPostsCount' ? 'eventPostsCount' : req.query.sort === 'eventLikesReceived' ? 'eventLikesReceived' : 'createdAt';
    const order = req.query.order === 'asc' ? 'asc' : 'desc';

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new NotFoundError('Kullanıcı bulunamadı');

    const [stats, total] = await Promise.all([
      prisma.eventStats.findMany({
        where: { userId: id },
        orderBy: { [sort]: order },
        take: limit,
        skip: offset,
        include: { event: { select: { id: true, title: true, status: true, startDate: true, endDate: true } } },
      }),
      prisma.eventStats.count({ where: { userId: id } }),
    ]);

    const data: AdminUserEventListItem[] = stats.map((s) => ({
      id: s.id,
      userId: s.userId,
      eventId: s.eventId,
      eventTitle: s.event.title,
      eventStatus: s.event.status,
      eventStartDate: s.event.startDate.toISOString(),
      eventEndDate: s.event.endDate.toISOString(),
      eventPostsCount: s.eventPostsCount,
      eventLikesReceived: s.eventLikesReceived,
      totalParticipated: s.totalParticipated,
      totalComments: s.totalComments,
      createdAt: s.createdAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit, offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /admin/users/{id}/badges:
 *   get:
 *     summary: Kullanıcının badge'leri (UserBadge + Badge)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *       - in: query
 *         name: offset
 *       - in: query
 *         name: claimed
 *     responses:
 *       200:
 *         description: Badge listesi (sayfalı)
 */
router.get(
  '/:id/badges',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Number(req.query.offset) || 0;
    const claimedParam = req.query.claimed;
    const claimed = claimedParam === 'true' ? true : claimedParam === 'false' ? false : undefined;

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new NotFoundError('Kullanıcı bulunamadı');

    const where: { userId: string; claimed?: boolean } = { userId: id };
    if (claimed !== undefined) where.claimed = claimed;

    const [userBadges, total] = await Promise.all([
      prisma.userBadge.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { badge: { include: { category: { select: { name: true } } } } },
      }),
      prisma.userBadge.count({ where }),
    ]);

    const data: AdminUserBadgeListItem[] = userBadges.map((ub) => ({
      id: ub.id,
      userId: ub.userId,
      badgeId: ub.badgeId,
      badgeName: ub.badge.name,
      badgeImageUrl: ub.badge.imageUrl,
      badgeRarity: ub.badge.rarity,
      badgeCategoryName: ub.badge.category?.name ?? null,
      isVisible: ub.isVisible,
      displayOrder: ub.displayOrder,
      visibility: ub.visibility,
      claimed: ub.claimed,
      claimedAt: ub.claimedAt?.toISOString() ?? null,
      createdAt: ub.createdAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit, offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /admin/users/{id}/badges:
 *   post:
 *     summary: Kullanıcıya badge ver
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - badgeId
 *             properties:
 *               badgeId:
 *                 type: string
 *                 format: uuid
 *               isVisible:
 *                 type: boolean
 *               displayOrder:
 *                 type: integer
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, PRIVATE, HIDDEN]
 *     responses:
 *       200:
 *         description: Badge verildi
 *       404:
 *         description: Kullanıcı veya badge bulunamadı
 */
router.post(
  '/:id/badges',
  validateBody(AdminGrantBadgeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const body = req.body as { badgeId: string; isVisible?: boolean; displayOrder?: number; visibility?: string };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('Kullanıcı bulunamadı');

    const badge = await prisma.badge.findUnique({ where: { id: body.badgeId } });
    if (!badge) throw new NotFoundError('Badge bulunamadı');

    const existing = await prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId: id, badgeId: body.badgeId } },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Kullanıcı zaten bu badge\'e sahip' });
    }

    const userBadge = await prisma.userBadge.create({
      data: {
        userId: id,
        badgeId: body.badgeId,
        isVisible: body.isVisible ?? true,
        displayOrder: body.displayOrder ?? undefined,
        visibility: (body.visibility as 'PUBLIC' | 'FRIENDS' | 'TRUSTERS' | 'PRIVATE') ?? 'PUBLIC',
      },
    });

    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'USER_BADGE_GRANT',
        description: `userId: ${id}, badgeId: ${body.badgeId}`,
        entityType: 'user_badge',
        entityId: 0,
      },
    });

    logger.info({ message: 'Admin granted badge to user', adminId, userId: id, badgeId: body.badgeId });

    const withBadge = await prisma.userBadge.findUnique({
      where: { id: userBadge.id },
      include: { badge: { include: { category: { select: { name: true } } } } },
    });
    const data: AdminUserBadgeListItem = {
      id: withBadge!.id,
      userId: withBadge!.userId,
      badgeId: withBadge!.badgeId,
      badgeName: withBadge!.badge.name,
      badgeImageUrl: withBadge!.badge.imageUrl,
      badgeRarity: withBadge!.badge.rarity,
      badgeCategoryName: withBadge!.badge.category?.name ?? null,
      isVisible: withBadge!.isVisible,
      displayOrder: withBadge!.displayOrder,
      visibility: withBadge!.visibility,
      claimed: withBadge!.claimed,
      claimedAt: withBadge!.claimedAt?.toISOString() ?? null,
      createdAt: withBadge!.createdAt.toISOString(),
    };
    return res.json({ success: true, message: 'Badge verildi', data });
  })
);

/**
 * @openapi
 * /admin/users/{id}/badges/{userBadgeId}:
 *   delete:
 *     summary: Kullanıcıdan badge al
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: userBadgeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Badge alındı
 *       404:
 *         description: Kullanıcı veya user badge bulunamadı
 */
router.delete(
  '/:id/badges/:userBadgeId',
  asyncHandler(async (req: Request, res: Response) => {
    const { id, userBadgeId } = req.params;
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const userBadge = await prisma.userBadge.findFirst({
      where: { id: userBadgeId, userId: id },
    });
    if (!userBadge) throw new NotFoundError('Kullanıcı badge kaydı bulunamadı');

    await prisma.userBadge.delete({ where: { id: userBadgeId } });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'USER_BADGE_REVOKE',
        description: `userId: ${id}, userBadgeId: ${userBadgeId}, badgeId: ${userBadge.badgeId}`,
        entityType: 'user_badge',
        entityId: 0,
      },
    });

    logger.info({ message: 'Admin revoked badge from user', adminId, userId: id, userBadgeId });
    return res.json({ success: true, message: 'Badge kullanıcıdan alındı', data: { userBadgeId } });
  })
);

/**
 * @openapi
 * /admin/users/{id}/wallet:
 *   get:
 *     summary: Kullanıcının cüzdan özeti
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Cüzdan listesi (genelde tek)
 */
router.get(
  '/:id/wallet',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new NotFoundError('Kullanıcı bulunamadı');

    const wallets = await prisma.wallet.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
    });

    const data: AdminWalletSummaryItem[] = wallets.map((w) => ({
      id: w.id,
      userId: w.userId,
      provider: w.provider,
      publicAddress: w.publicAddress,
      balance: w.balance,
      lockedBalance: w.lockedBalance,
      isConnected: w.isConnected,
      createdAt: w.createdAt.toISOString(),
    }));

    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/users/{id}/tips-summary:
 *   get:
 *     summary: Kullanıcının tips özeti (toplam gönderilen/alınan)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Tips özeti
 */
router.get(
  '/:id/tips-summary',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new NotFoundError('Kullanıcı bulunamadı');

    const [sentAgg, receivedAgg, sentCount, receivedCount] = await Promise.all([
      prisma.tipsTokenTransfer.aggregate({ where: { fromUserId: id }, _sum: { amount: true } }),
      prisma.tipsTokenTransfer.aggregate({ where: { toUserId: id }, _sum: { amount: true } }),
      prisma.tipsTokenTransfer.count({ where: { fromUserId: id } }),
      prisma.tipsTokenTransfer.count({ where: { toUserId: id } }),
    ]);

    const data: AdminTipsSummaryResponse = {
      totalSent: sentAgg._sum.amount ?? 0,
      totalReceived: receivedAgg._sum.amount ?? 0,
      sentCount,
      receivedCount,
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/users/{id}/tips-transactions:
 *   get:
 *     summary: Kullanıcının tips işlem listesi (sayfalı)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *       - in: query
 *         name: offset
 *       - in: query
 *         name: direction
 *       - in: query
 *         name: sort
 *       - in: query
 *         name: order
 *     responses:
 *       200:
 *         description: İşlem listesi
 */
router.get(
  '/:id/tips-transactions',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Number(req.query.offset) || 0;
    const direction = req.query.direction === 'sent' ? 'sent' : req.query.direction === 'received' ? 'received' : 'all';
    const sort = req.query.sort === 'amount' ? 'amount' : 'createdAt';
    const order = req.query.order === 'asc' ? 'asc' : 'desc';

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new NotFoundError('Kullanıcı bulunamadı');

    const where: { fromUserId?: string; toUserId?: string } =
      direction === 'sent' ? { fromUserId: id } : direction === 'received' ? { toUserId: id } : { OR: [{ fromUserId: id }, { toUserId: id }] };

    const [transfers, total] = await Promise.all([
      prisma.tipsTokenTransfer.findMany({
        where,
        orderBy: { [sort]: order },
        take: limit,
        skip: offset,
        include: {
          fromUser: { select: { email: true }, include: { profile: { select: { displayName: true } } } },
          toUser: { select: { email: true }, include: { profile: { select: { displayName: true } } } },
        },
      }),
      prisma.tipsTokenTransfer.count({ where }),
    ]);

    const data: AdminTipsTransactionListItem[] = transfers.map((t) => ({
      id: t.id,
      fromUserId: t.fromUserId,
      toUserId: t.toUserId,
      amount: t.amount,
      reason: t.reason,
      createdAt: t.createdAt.toISOString(),
      fromUserEmail: t.fromUser.email,
      fromUserDisplayName: t.fromUser.profile?.displayName ?? null,
      toUserEmail: t.toUser.email,
      toUserDisplayName: t.toUser.profile?.displayName ?? null,
    }));

    const pagination: PaginationMeta = { total, limit, offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /admin/users/{id}/profile:
 *   get:
 *     summary: Kullanıcı profil bilgisi (admin görünümü)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Profil detayı
 *       404:
 *         description: Kullanıcı veya profil bulunamadı
 */
router.get(
  '/:id/profile',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const profile = await prisma.profile.findUnique({
      where: { userId: id },
    });
    if (!profile) {
      throw new NotFoundError('Profil bulunamadı');
    }
    const data: AdminProfileResponse = {
      id: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      userName: profile.userName,
      bio: profile.bio,
      bannerUrl: profile.bannerUrl,
      country: profile.country,
      birthDate: profile.birthDate ? profile.birthDate.toISOString().slice(0, 10) : null,
      postsCount: profile.postsCount,
      trustCount: profile.trustCount,
      trusterCount: profile.trusterCount,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/users/{id}/roles:
 *   get:
 *     summary: Kullanıcı rolleri
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Roller listesi
 *       404:
 *         description: Kullanıcı bulunamadı
 */
router.get(
  '/:id/roles',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }
    const roles = await prisma.userRole.findMany({
      where: { userId: id },
      select: { role: true },
    });
    const data: AdminRolesResponse = {
      roles: roles.map((r) => r.role),
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/users/{id}/moderation-history:
 *   get:
 *     summary: Kullanıcı moderation geçmişi (ban/warn/mute)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *       - in: query
 *         name: offset
 *     responses:
 *       200:
 *         description: Moderation geçmişi listesi
 *       404:
 *         description: Kullanıcı bulunamadı
 */
router.get(
  '/:id/moderation-history',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Number(req.query.offset) || 0;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    const [actions, total] = await Promise.all([
      prisma.moderationAction.findMany({
        where: { targetUserId: id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { moderator: { select: { email: true } } },
      }),
      prisma.moderationAction.count({ where: { targetUserId: id } }),
    ]);

    const data: AdminModerationHistoryItem[] = actions.map((a) => ({
      id: a.id,
      moderatorId: a.moderatorId,
      moderatorEmail: a.moderator.email,
      targetUserId: a.targetUserId,
      actionType: a.actionType,
      reason: a.reason,
      contentType: a.contentType,
      contentId: a.contentId,
      createdAt: a.createdAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit, offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /admin/users/{id}/trust-scores:
 *   get:
 *     summary: Kullanıcının trust score geçmişi
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *       - in: query
 *         name: offset
 *     responses:
 *       200:
 *         description: Trust score listesi
 *       404:
 *         description: Kullanıcı bulunamadı
 */
router.get(
  '/:id/trust-scores',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Number(req.query.offset) || 0;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    const [scores, total] = await Promise.all([
      prisma.userTrustScore.findMany({
        where: { userId: id },
        orderBy: { calculatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.userTrustScore.count({ where: { userId: id } }),
    ]);

    const data: AdminTrustScoreListItem[] = scores.map((s) => ({
      id: s.id,
      userId: s.userId,
      score: s.score,
      reason: s.reason,
      calculatedAt: s.calculatedAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit, offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /admin/users/{id}/login-attempts:
 *   get:
 *     summary: Kullanıcının giriş denemeleri (güvenlik)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *       - in: query
 *         name: offset
 *       - in: query
 *         name: status
 *     responses:
 *       200:
 *         description: Login attempt listesi
 *       404:
 *         description: Kullanıcı bulunamadı
 */
router.get(
  '/:id/login-attempts',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Number(req.query.offset) || 0;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    const where: { userId: string; status?: 'SUCCESS' | 'FAILED' | 'LOCKED' } = { userId: id };
    if (status === 'SUCCESS' || status === 'FAILED' || status === 'LOCKED') {
      where.status = status;
    }

    const [attempts, total] = await Promise.all([
      prisma.loginAttempt.findMany({
        where,
        orderBy: { attemptedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.loginAttempt.count({ where }),
    ]);

    const data: AdminLoginAttemptListItem[] = attempts.map((a) => ({
      id: a.id,
      userId: a.userId,
      ipAddress: a.ipAddress,
      userAgent: a.userAgent,
      status: a.status,
      attemptedAt: a.attemptedAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit, offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /admin/users/{id}/posts:
 *   get:
 *     summary: Kullanıcının postları (sayfalı)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
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
 *         name: sort
 *         schema: { type: string }
 *       - in: query
 *         name: order
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200:
 *         description: Kullanıcının post listesi (AdminContentPostListItem formatında)
 *       404:
 *         description: Kullanıcı bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/:id/posts',
  validateQuery(AdminContentPostsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id: userId } = req.params;
    const q = req.query as {
      limit: number;
      offset: number;
      type?: string;
      sort: string;
      order: 'asc' | 'desc';
    };
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundError('Kullanıcı bulunamadı');
    const where = { userId };
    if (q.type) (where as Record<string, unknown>).type = q.type;
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
 * /admin/users/{id}:
 *   get:
 *     summary: Tek kullanıcı detayı (admin görünümü)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Kullanıcı detayı
 *       404:
 *         description: Kullanıcı bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        status: true,
        emailVerified: true,
        auth0Id: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
        roles: { select: { role: true } },
      },
    });
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }
    const lastBan = await prisma.moderationAction.findFirst({
      where: { targetUserId: id, actionType: 'BAN' },
      orderBy: { createdAt: 'desc' },
      include: { moderator: { select: { email: true } } },
    });
    const profileData: AdminProfileResponse | null = user.profile
      ? {
          id: user.profile.id,
          userId: user.profile.userId,
          displayName: user.profile.displayName,
          userName: user.profile.userName,
          bio: user.profile.bio,
          bannerUrl: user.profile.bannerUrl,
          country: user.profile.country,
          birthDate: user.profile.birthDate ? user.profile.birthDate.toISOString().slice(0, 10) : null,
          postsCount: user.profile.postsCount,
          trustCount: user.profile.trustCount,
          trusterCount: user.profile.trusterCount,
          createdAt: user.profile.createdAt.toISOString(),
          updatedAt: user.profile.updatedAt.toISOString(),
        }
      : null;
    const data: AdminUserDetailResponse = {
      id: user.id,
      email: user.email,
      status: user.status,
      emailVerified: user.emailVerified,
      auth0Id: user.auth0Id,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      displayName: user.profile?.displayName ?? null,
      userName: user.profile?.userName ?? null,
      profile: profileData ?? undefined,
      roles: user.roles.map((r) => r.role),
      lastBan: lastBan
        ? {
            id: lastBan.id,
            moderatorId: lastBan.moderatorId,
            moderatorEmail: lastBan.moderator.email,
            targetUserId: lastBan.targetUserId,
            actionType: lastBan.actionType,
            reason: lastBan.reason,
            contentType: lastBan.contentType,
            contentId: lastBan.contentId,
            createdAt: lastBan.createdAt.toISOString(),
          }
        : null,
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/users/{id}:
 *   patch:
 *     summary: Kullanıcı bilgilerini güncelle (email, status, emailVerified)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               status:
 *                 type: string
 *                 nullable: true
 *               emailVerified:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Kullanıcı güncellendi
 *       404:
 *         description: Kullanıcı bulunamadı
 */
router.patch(
  '/:id',
  validateBody(AdminUpdateUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const body = req.body as { email?: string; status?: string | null; emailVerified?: boolean };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    const updateData: Record<string, unknown> = {};
    if (body.email !== undefined) {
      const existing = await prisma.user.findUnique({ where: { email: body.email } });
      if (existing && existing.id !== id) {
        return res.status(400).json({ success: false, message: 'Bu email adresi başka bir kullanıcı tarafından kullanılıyor' });
      }
      updateData.email = body.email;
    }
    if (body.status !== undefined) updateData.status = body.status;
    if (body.emailVerified !== undefined) updateData.emailVerified = body.emailVerified;

    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: updateData,
      }),
      prisma.adminLog.create({
        data: {
          adminId,
          action: 'USER_UPDATE',
          description: `userId: ${id}, fields: ${Object.keys(updateData).join(',')}`,
          entityType: 'user',
          entityId: 0,
        },
      }),
    ]);

    logger.info({
      message: 'User updated by admin',
      adminId,
      userId: id,
    });

    const updated = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, status: true, emailVerified: true, auth0Id: true, createdAt: true, updatedAt: true },
    });
    const data: AdminUserDetailResponse = {
      id: updated!.id,
      email: updated!.email,
      status: updated!.status,
      emailVerified: updated!.emailVerified,
      auth0Id: updated!.auth0Id,
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
    };
    return res.json({ success: true, message: 'Kullanıcı güncellendi', data });
  })
);

/**
 * @openapi
 * /admin/users/{id}/roles:
 *   put:
 *     summary: Kullanıcı rollerini güncelle (tamamen değiştirir)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roles
 *             properties:
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Roller güncellendi
 *       404:
 *         description: Kullanıcı bulunamadı
 */
router.put(
  '/:id/roles',
  validateBody(AdminPutRolesSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { roles } = req.body as { roles: string[] };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    await prisma.userRole.deleteMany({ where: { userId: id } });
    for (const role of roles) {
      await prisma.userRole.create({ data: { userId: id, role } });
    }
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'USER_ROLES_UPDATE',
        description: `userId: ${id}, roles: ${roles.join(',')}`,
        entityType: 'user',
        entityId: 0,
      },
    });

    logger.info({
      message: 'User roles updated by admin',
      adminId,
      userId: id,
      roles,
    });

    const updatedRoles = await prisma.userRole.findMany({
      where: { userId: id },
      select: { role: true },
    });
    const data: AdminRolesResponse = {
      roles: updatedRoles.map((r) => r.role),
    };
    return res.json({ success: true, message: 'Roller güncellendi', data });
  })
);

/**
 * @openapi
 * /admin/users/{id}/ban:
 *   patch:
 *     summary: Kullanıcıyı yasakla
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Kullanıcı yasaklandı
 *       404:
 *         description: Kullanıcı bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  '/:id/ban',
  asyncHandler(async (req: Request, res: Response) => {
    const { id: targetUserId } = req.params;
    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const body = (req.body || {}) as { reason?: string };
    const reason = typeof body.reason === 'string' ? body.reason : 'Admin ban';

    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUserId },
        data: { status: 'BANNED' },
      }),
      prisma.moderationAction.create({
        data: {
          moderatorId: adminId,
          targetUserId,
          reason,
          actionType: 'BAN',
        },
      }),
      prisma.adminLog.create({
        data: {
          adminId,
          action: 'USER_BAN',
          description: `userId: ${targetUserId}, reason: ${reason}`,
          entityType: 'user',
          entityId: 0,
        },
      }),
    ]);

    logger.info({
      message: 'User banned by admin',
      adminId,
      targetUserId,
      reason,
    });

    return res.json({
      success: true,
      message: 'Kullanıcı yasaklandı',
      data: { userId: targetUserId, status: 'BANNED' },
    });
  })
);

/**
 * @openapi
 * /admin/users/{id}/unban:
 *   patch:
 *     summary: Kullanıcı yasağını kaldır
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Yasak kaldırıldı
 *       404:
 *         description: Kullanıcı bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  '/:id/unban',
  asyncHandler(async (req: Request, res: Response) => {
    const { id: targetUserId } = req.params;
    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUserId },
        data: { status: null },
      }),
      prisma.adminLog.create({
        data: {
          adminId,
          action: 'USER_UNBAN',
          description: `userId: ${targetUserId}`,
          entityType: 'user',
          entityId: 0,
        },
      }),
    ]);

    logger.info({
      message: 'User unbanned by admin',
      adminId,
      targetUserId,
    });

    return res.json({
      success: true,
      message: 'Yasak kaldırıldı',
      data: { userId: targetUserId, status: null },
    });
  })
);

/**
 * @swagger
 * /admin/users/banned/stats:
 *   get:
 *     tags: [Admin - Users]
 *     summary: Get banned users statistics
 *     responses:
 *       200:
 *         description: Banned users stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: number
 *                 thisMonth:
 *                   type: number
 */
router.get(
  '/banned/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const total = await prisma.user.count({
      where: { status: 'BANNED' },
    });

    // Banned this month (via ModerationAction)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = await prisma.moderationAction.count({
      where: {
        actionType: 'BAN',
        createdAt: { gte: startOfMonth },
      },
    });

    const data: AdminUserBannedStatsResponse = {
      total,
      thisMonth,
    };

    return res.json({ success: true, data });
  })
);

/**
 * @swagger
 * /admin/users/reports/stats:
 *   get:
 *     tags: [Admin - Reports & KYC]
 *     summary: Get user reports statistics
 *     responses:
 *       200:
 *         description: Reports stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: number
 *                 open:
 *                   type: number
 *                 resolved:
 *                   type: number
 */
router.get(
  '/reports/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [total, open, resolved] = await Promise.all([
      prisma.userReport.count(),
      prisma.userReport.count({ where: { resolved: false } }),
      prisma.userReport.count({ where: { resolved: true } }),
    ]);

    const data: AdminUserReportStatsResponse = {
      total,
      open,
      resolved,
    };

    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/user-reports:
 *   get:
 *     summary: Kullanıcı şikayetleri listesi
 *     tags: [Admin - Reports & KYC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *       - in: query
 *         name: offset
 *       - in: query
 *         name: reportedUserId
 *       - in: query
 *         name: reporterId
 *       - in: query
 *         name: category
 *       - in: query
 *         name: sort
 *       - in: query
 *         name: order
 *     responses:
 *       200:
 *         description: Şikayet listesi
 */
router.get(
  '/reports',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Number(req.query.offset) || 0;
    const reportedUserId = typeof req.query.reportedUserId === 'string' ? req.query.reportedUserId : undefined;
    const reporterId = typeof req.query.reporterId === 'string' ? req.query.reporterId : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const sort = req.query.sort === 'category' ? 'category' : 'createdAt';
    const order = req.query.order === 'asc' ? 'asc' : 'desc';

    const where: Record<string, unknown> = {};
    if (reportedUserId) where.reportedUserId = reportedUserId;
    if (reporterId) where.reporterId = reporterId;
    if (category) where.category = category;

    const [reports, total] = await Promise.all([
      prisma.userReport.findMany({
        where,
        orderBy: { [sort]: order },
        take: limit,
        skip: offset,
        include: {
          reportedUser: { select: { email: true, profile: { select: { displayName: true } } } },
          reporter: { select: { email: true, profile: { select: { displayName: true } } } },
        },
      }),
      prisma.userReport.count({ where }),
    ]);

    const data: AdminUserReportListItem[] = reports.map((r) => ({
      id: r.id,
      reportedUserId: r.reportedUserId,
      reporterId: r.reporterId,
      category: r.category,
      description: r.description,
      createdAt: r.createdAt.toISOString(),
      reportedUserEmail: r.reportedUser.email,
      reportedUserDisplayName: r.reportedUser.profile?.displayName ?? null,
      reporterEmail: r.reporter.email,
      reporterDisplayName: r.reporter.profile?.displayName ?? null,
      resolved: r.resolved,
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
    }));

    const pagination: PaginationMeta = { total, limit, offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /admin/user-reports/{id}:
 *   get:
 *     summary: Tek şikayet detayı
 *     tags: [Admin - Reports & KYC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Şikayet detayı
 *       404:
 *         description: Şikayet bulunamadı
 */
router.get(
  '/reports/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const report = await prisma.userReport.findUnique({
      where: { id },
      include: {
        reportedUser: { select: { id: true, email: true, profile: { select: { displayName: true } } } },
        reporter: { select: { id: true, email: true, profile: { select: { displayName: true } } } },
      },
    });
    if (!report) {
      throw new NotFoundError('Şikayet bulunamadı');
    }
    const data: AdminUserReportDetailResponse = {
      id: report.id,
      reportedUserId: report.reportedUserId,
      reporterId: report.reporterId,
      category: report.category,
      description: report.description,
      createdAt: report.createdAt.toISOString(),
      reportedUserEmail: report.reportedUser.email,
      reportedUserDisplayName: report.reportedUser.profile?.displayName ?? null,
      reporterEmail: report.reporter.email,
      reporterDisplayName: report.reporter.profile?.displayName ?? null,
      resolved: report.resolved,
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
      reportedUser: {
        id: report.reportedUser.id,
        email: report.reportedUser.email,
        displayName: report.reportedUser.profile?.displayName ?? null,
      },
      reporter: {
        id: report.reporter.id,
        email: report.reporter.email,
        displayName: report.reporter.profile?.displayName ?? null,
      },
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/user-reports/{id}/resolve:
 *   patch:
 *     summary: Şikayeti çözüldü olarak işaretle
 *     tags: [Admin - Reports & KYC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resolved
 *             properties:
 *               resolved:
 *                 type: boolean
 *               adminNote:
 *                 type: string
 *     responses:
 *       200:
 *         description: Şikayet güncellendi
 *       404:
 *         description: Şikayet bulunamadı
 */
router.patch(
  '/reports/:id/resolve',
  validateBody(AdminResolveReportSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { resolved, adminNote } = req.body as { resolved: boolean; adminNote?: string };

    const report = await prisma.userReport.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundError('Şikayet bulunamadı');
    }

    await prisma.$transaction([
      prisma.userReport.update({
        where: { id },
        data: {
          resolved,
          resolvedAt: resolved ? new Date() : null,
          resolvedBy: resolved ? adminId : null,
          adminNote: adminNote ?? report.adminNote,
        },
      }),
      prisma.adminLog.create({
        data: {
          adminId,
          action: 'USER_REPORT_RESOLVE',
          description: `reportId: ${id}, resolved: ${resolved}${adminNote ? `, note: ${adminNote}` : ''}`,
          entityType: 'user_report',
          entityId: 0,
        },
      }),
    ]);

    logger.info({
      message: 'User report resolve updated by admin',
      adminId,
      reportId: id,
      resolved,
    });

    return res.json({
      success: true,
      message: resolved ? 'Şikayet çözüldü olarak işaretlendi' : 'Şikayet güncellendi',
      data: { reportId: id, resolved },
    });
  })
);

/**
 * @swagger
 * /admin/users/kyc/stats:
 *   get:
 *     tags: [Admin - Reports & KYC]
 *     summary: Get KYC statistics
 *     responses:
 *       200:
 *         description: KYC stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: number
 *                 pending:
 *                   type: number
 *                 approved:
 *                   type: number
 *                 rejected:
 *                   type: number
 */
router.get(
  '/kyc/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [total, pending, approved, rejected] = await Promise.all([
      prisma.userKycRecord.count(),
      prisma.userKycRecord.count({ where: { reviewStatus: 'PENDING' } }),
      prisma.userKycRecord.count({ where: { reviewResult: 'GREEN' } }),
      prisma.userKycRecord.count({ where: { reviewResult: 'RED' } }),
    ]);

    const data: AdminUserKycStatsResponse = {
      total,
      pending,
      approved,
      rejected,
    };

    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/user-kyc:
 *   get:
 *     summary: KYC kayıtları listesi
 *     tags: [Admin - Reports & KYC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *       - in: query
 *         name: offset
 *       - in: query
 *         name: userId
 *       - in: query
 *         name: reviewStatus
 *       - in: query
 *         name: reviewResult
 *     responses:
 *       200:
 *         description: KYC listesi
 */
router.get(
  '/kyc',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Number(req.query.offset) || 0;
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const reviewStatus = typeof req.query.reviewStatus === 'string' ? req.query.reviewStatus : undefined;
    const reviewResult = typeof req.query.reviewResult === 'string' ? req.query.reviewResult : undefined;

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (reviewStatus) where.reviewStatus = reviewStatus;
    if (reviewResult) where.reviewResult = reviewResult;

    const [records, total] = await Promise.all([
      prisma.userKycRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { user: { select: { email: true } } },
      }),
      prisma.userKycRecord.count({ where }),
    ]);

    const data: AdminKycListItem[] = records.map((r) => ({
      id: r.id,
      userId: r.userId,
      userEmail: r.user.email,
      sumsubApplicantId: r.sumsubApplicantId,
      reviewStatus: r.reviewStatus,
      reviewResult: r.reviewResult,
      reviewReason: r.reviewReason,
      kycLevel: r.kycLevel,
      createdAt: r.createdAt.toISOString(),
      lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
    }));

    const pagination: PaginationMeta = { total, limit, offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /admin/user-kyc/{userId}:
 *   get:
 *     summary: Kullanıcının KYC kaydı (en güncel)
 *     tags: [Admin - Reports & KYC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: KYC kaydı
 *       404:
 *         description: KYC kaydı bulunamadı
 */
router.get(
  '/kyc/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const record = await prisma.userKycRecord.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { user: { select: { email: true } } },
    });
    if (!record) {
      throw new NotFoundError('KYC kaydı bulunamadı');
    }
    const data: AdminKycDetailResponse = {
      id: record.id,
      userId: record.userId,
      userEmail: record.user.email,
      sumsubApplicantId: record.sumsubApplicantId,
      reviewStatus: record.reviewStatus,
      reviewResult: record.reviewResult,
      reviewReason: record.reviewReason,
      kycLevel: record.kycLevel,
      createdAt: record.createdAt.toISOString(),
      lastSyncedAt: record.lastSyncedAt?.toISOString() ?? null,
      updatedAt: record.updatedAt.toISOString(),
      lastUpdatedAt: record.lastUpdatedAt.toISOString(),
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/user-kyc/{recordId}/review:
 *   patch:
 *     summary: KYC inceleme sonucu (approve/decline/on_hold)
 *     tags: [Admin - Reports & KYC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recordId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reviewStatus:
 *                 type: string
 *                 enum: [INIT, PENDING, COMPLETED, DECLINED, ON_HOLD]
 *               reviewResult:
 *                 type: string
 *                 enum: [NULL, GREEN, YELLOW, RED]
 *               reviewReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: KYC kaydı güncellendi
 *       404:
 *         description: KYC kaydı bulunamadı
 */
router.patch(
  '/kyc/:recordId/review',
  validateBody(AdminKycReviewSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { recordId } = req.params;
    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const body = req.body as { reviewStatus?: string; reviewResult?: string; reviewReason?: string };

    const record = await prisma.userKycRecord.findUnique({ where: { id: recordId } });
    if (!record) {
      throw new NotFoundError('KYC kaydı bulunamadı');
    }

    const updateData: Record<string, unknown> = {};
    if (body.reviewStatus !== undefined) updateData.reviewStatus = body.reviewStatus;
    if (body.reviewResult !== undefined) updateData.reviewResult = body.reviewResult;
    if (body.reviewReason !== undefined) updateData.reviewReason = body.reviewReason;

    await prisma.$transaction([
      prisma.userKycRecord.update({
        where: { id: recordId },
        data: updateData,
      }),
      prisma.adminLog.create({
        data: {
          adminId,
          action: 'KYC_REVIEW',
          description: `recordId: ${recordId}, userId: ${record.userId}, status: ${body.reviewStatus ?? record.reviewStatus}, result: ${body.reviewResult ?? record.reviewResult}`,
          entityType: 'user_kyc',
          entityId: 0,
        },
      }),
    ]);

    logger.info({
      message: 'KYC review updated by admin',
      adminId,
      recordId,
      userId: record.userId,
    });

    return res.json({
      success: true,
      message: 'KYC inceleme sonucu güncellendi',
      data: { recordId, userId: record.userId },
    });
  })
);

/**
 * @openapi
 * /admin/user-trust-scores:
 *   get:
 *     summary: Trust score listesi (kullanıcı bazlı veya genel)
 *     tags: [Admin - Reports & KYC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *       - in: query
 *         name: offset
 *       - in: query
 *         name: userId
 *       - in: query
 *         name: sort
 *       - in: query
 *         name: order
 *     responses:
 *       200:
 *         description: Trust score listesi
 */
router.get(
  '/trust-scores',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Number(req.query.offset) || 0;
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const sort = req.query.sort === 'score' ? 'score' : req.query.sort === 'createdAt' ? 'createdAt' : 'calculatedAt';
    const order = req.query.order === 'asc' ? 'asc' : 'desc';

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;

    const [scores, total] = await Promise.all([
      prisma.userTrustScore.findMany({
        where,
        orderBy: { [sort]: order },
        take: limit,
        skip: offset,
        include: { user: { select: { email: true } } },
      }),
      prisma.userTrustScore.count({ where }),
    ]);

    const data: AdminTrustScoreListItem[] = scores.map((s) => ({
      id: s.id,
      userId: s.userId,
      userEmail: s.user.email,
      score: s.score,
      reason: s.reason,
      calculatedAt: s.calculatedAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit, offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /admin/logs:
 *   get:
 *     summary: Admin işlem logları listesi (sayfalama)
 *     tags: [Admin - Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Log listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       adminId:
 *                         type: string
 *                       action:
 *                         type: string
 *                       description:
 *                         type: string
 *                       entityType:
 *                         type: string
 *                       entityId:
 *                         type: integer
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

export default router;
