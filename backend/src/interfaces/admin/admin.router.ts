import { Router, Request, Response } from 'express';
import { authMiddleware } from '../auth/auth.middleware';
import { requireAdmin } from '../../infrastructure/middleware/rbac.middleware';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { getAdminStats } from '../../application/admin/admin-stats.service';
import { AuthService } from '../../application/auth/auth.service';
import { isAdmin } from '../../infrastructure/auth/role-checker';
import { ProfilePrismaRepository } from '../../infrastructure/repositories/profile-prisma.repository';
import { UserAvatarPrismaRepository } from '../../infrastructure/repositories/user-avatar-prisma.repository';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import { LoginSchema } from '../auth/auth.schemas';
import {
  AdminUpdateUserSchema,
  AdminPutRolesSchema,
  AdminResolveReportSchema,
  AdminKycReviewSchema,
  AdminAvatarCreateSchema,
  AdminAvatarUpdateSchema,
  AdminGrantBadgeSchema,
  AdminUsersQuerySchema,
  AdminUserReportsQuerySchema,
  AdminUserKycQuerySchema,
  AdminUserTrustScoresQuerySchema,
  AdminLoginAttemptsQuerySchema,
  AdminCreateEventSchema,
  AdminUpdateEventSchema,
  AdminEventsQuerySchema,
  AdminEventParticipantsQuerySchema,
  AdminAddEventBadgeSchema,
  AdminUpdateEventBadgeSchema,
  AdminEventRewardsQuerySchema,
} from './admin.schemas';
import { generateIdForModel } from '../../infrastructure/ids/id.strategy';
import type {
  AdminStatsResponse,
  AdminUserListItem,
  AdminUserDetailResponse,
  AdminProfileResponse,
  AdminRolesResponse,
  AdminModerationHistoryItem,
  AdminLogListItem,
  AdminUserReportListItem,
  AdminUserReportDetailResponse,
  AdminKycListItem,
  AdminKycDetailResponse,
  AdminTrustScoreListItem,
  AdminLoginAttemptListItem,
  AdminUsersStatsResponse,
  AdminAvatarResponse,
  AdminUserEventListItem,
  AdminUserBadgeListItem,
  AdminWalletSummaryItem,
  AdminTipsSummaryResponse,
  AdminTipsTransactionListItem,
  PaginationMeta,
  AdminEventStatsResponse,
  AdminEventListItem,
  AdminEventDetailResponse,
  AdminEventParticipantListItem,
  AdminEventAnalyticsResponse,
  AdminEventBadgeListItem,
  AdminEventRewardListItem,
} from './admin.dto';
import logger from '../../infrastructure/logger/logger';
import { NotFoundError } from '../../infrastructure/errors/custom-errors';

const router = Router();
const prisma = getPrisma();
const authService = new AuthService();
const profileRepo = new ProfilePrismaRepository();
const avatarRepo = new UserAvatarPrismaRepository();

/**
 * @openapi
 * /admin/login:
 *   post:
 *     summary: Admin girişi
 *     description: Sadece ADMIN rolüne sahip kullanıcılar giriş yapabilir. Başarılı yanıtta dönen token'ı Bearer olarak kullanarak diğer admin endpoint'lerine erişin.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@tipbox.co
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Başarılı giriş, token ve refreshToken döner
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 fullName:
 *                   type: string
 *                   nullable: true
 *                 avatar:
 *                   type: string
 *                   nullable: true
 *                 token:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Geçersiz email veya şifre
 *       403:
 *         description: Bu hesap admin değil
 */
router.post(
  '/login',
  validateBody(LoginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const user = await authService.authenticate(email, password);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz email veya şifre',
      });
    }

    const hasAdminRole = await isAdmin(user.id);
    if (!hasAdminRole) {
      return res.status(403).json({
        success: false,
        message: 'Bu işlem için yetkiniz yok. Gerekli roller: ADMIN',
      });
    }

    const profile = await profileRepo.findByUserId(user.id);
    const fullName = profile?.displayName ?? null;
    const activeAvatar = await avatarRepo.findActiveByUserId(user.id);
    const avatarUrl = resolveMediaUrl(activeAvatar?.imageUrl || null, true);

    const token = authService.generateToken(user);
    const refreshToken = authService.generateRefreshToken(user);

    return res.json({
      id: user.id,
      email: user.email || '',
      fullName,
      avatar: avatarUrl,
      token,
      refreshToken,
    });
  })
);

/**
 * @openapi
 * /admin/stats:
 *   get:
 *     summary: Genel istatistikler (kullanıcı, post, ban, admin log sayıları)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: İstatistikler
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
 *                     users:
 *                       type: integer
 *                     posts:
 *                       type: integer
 *                     bannedUsers:
 *                       type: integer
 *                     adminLogs:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin required)
 */
router.get(
  '/stats',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await getAdminStats();
    const data: AdminStatsResponse = stats;
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/users:
 *   get:
 *     summary: Kullanıcı listesi (sayfalama)
 *     tags: [Admin]
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
 *         description: Kullanıcı listesi
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
 *                       email:
 *                         type: string
 *                       status:
 *                         type: string
 *                       emailVerified:
 *                         type: boolean
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
router.get(
  '/users',
  authMiddleware,
  requireAdmin,
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
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: total, bannedCount, emailVerifiedCount, newThisWeek
 */
router.get(
  '/users/stats',
  authMiddleware,
  requireAdmin,
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
 *     tags: [Admin]
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
  '/users/:id/avatar',
  authMiddleware,
  requireAdmin,
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
 *     tags: [Admin]
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
  '/users/:id/avatar',
  authMiddleware,
  requireAdmin,
  validateBody(AdminAvatarUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
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
 *     tags: [Admin]
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
  '/users/:id/avatar',
  authMiddleware,
  requireAdmin,
  validateBody(AdminAvatarCreateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
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
 *     tags: [Admin]
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
  '/users/:id/events',
  authMiddleware,
  requireAdmin,
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
 *     tags: [Admin]
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
  '/users/:id/badges',
  authMiddleware,
  requireAdmin,
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
 *     tags: [Admin]
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
  '/users/:id/badges',
  authMiddleware,
  requireAdmin,
  validateBody(AdminGrantBadgeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
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
 *     tags: [Admin]
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
  '/users/:id/badges/:userBadgeId',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id, userBadgeId } = req.params;
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

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
 *     tags: [Admin]
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
  '/users/:id/wallet',
  authMiddleware,
  requireAdmin,
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
 *     tags: [Admin]
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
  '/users/:id/tips-summary',
  authMiddleware,
  requireAdmin,
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
 *     tags: [Admin]
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
  '/users/:id/tips-transactions',
  authMiddleware,
  requireAdmin,
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
 *     tags: [Admin]
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
  '/users/:id/profile',
  authMiddleware,
  requireAdmin,
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
 *     tags: [Admin]
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
  '/users/:id/roles',
  authMiddleware,
  requireAdmin,
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
 *     tags: [Admin]
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
  '/users/:id/moderation-history',
  authMiddleware,
  requireAdmin,
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
 *     tags: [Admin]
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
  '/users/:id/trust-scores',
  authMiddleware,
  requireAdmin,
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
 *     tags: [Admin]
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
  '/users/:id/login-attempts',
  authMiddleware,
  requireAdmin,
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
 * /admin/users/{id}:
 *   get:
 *     summary: Tek kullanıcı detayı (admin görünümü)
 *     tags: [Admin]
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
  '/users/:id',
  authMiddleware,
  requireAdmin,
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
 *     tags: [Admin]
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
  '/users/:id',
  authMiddleware,
  requireAdmin,
  validateBody(AdminUpdateUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized' });
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
 *     tags: [Admin]
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
  '/users/:id/roles',
  authMiddleware,
  requireAdmin,
  validateBody(AdminPutRolesSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized' });
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
 *     tags: [Admin]
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
  '/users/:id/ban',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id: targetUserId } = req.params;
    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized' });
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
 *     tags: [Admin]
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
  '/users/:id/unban',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id: targetUserId } = req.params;
    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized' });
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
 * @openapi
 * /admin/user-reports:
 *   get:
 *     summary: Kullanıcı şikayetleri listesi
 *     tags: [Admin]
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
  '/user-reports',
  authMiddleware,
  requireAdmin,
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
          reportedUser: { select: { email: true }, include: { profile: { select: { displayName: true } } } },
          reporter: { select: { email: true }, include: { profile: { select: { displayName: true } } } },
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
 *     tags: [Admin]
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
  '/user-reports/:id',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const report = await prisma.userReport.findUnique({
      where: { id },
      include: {
        reportedUser: { select: { id: true, email: true }, include: { profile: { select: { displayName: true } } } },
        reporter: { select: { id: true, email: true }, include: { profile: { select: { displayName: true } } } },
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
 *     tags: [Admin]
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
  '/user-reports/:id/resolve',
  authMiddleware,
  requireAdmin,
  validateBody(AdminResolveReportSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized' });
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
 * @openapi
 * /admin/user-kyc:
 *   get:
 *     summary: KYC kayıtları listesi
 *     tags: [Admin]
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
  '/user-kyc',
  authMiddleware,
  requireAdmin,
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
 *     tags: [Admin]
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
  '/user-kyc/:userId',
  authMiddleware,
  requireAdmin,
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
 *     tags: [Admin]
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
  '/user-kyc/:recordId/review',
  authMiddleware,
  requireAdmin,
  validateBody(AdminKycReviewSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { recordId } = req.params;
    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized' });
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
 *     tags: [Admin]
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
  '/user-trust-scores',
  authMiddleware,
  requireAdmin,
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
 *     tags: [Admin]
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
router.get(
  '/logs',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Number(req.query.offset) || 0;

    const [logs, total] = await Promise.all([
      prisma.adminLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.adminLog.count(),
    ]);

    const data: AdminLogListItem[] = logs.map((l) => ({
      id: l.id,
      adminId: l.adminId,
      action: l.action,
      description: l.description,
      entityType: l.entityType,
      entityId: l.entityId,
      createdAt: l.createdAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit, offset };
    return res.json({ success: true, data, pagination });
  })
);

/* ========== Admin Events ========== */

router.get(
  '/events/stats',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const [total, draft, published, closed] = await Promise.all([
      prisma.event.count(),
      prisma.event.count({ where: { status: 'DRAFT' } }),
      prisma.event.count({ where: { status: 'PUBLISHED' } }),
      prisma.event.count({ where: { status: 'CLOSED' } }),
    ]);
    const data: AdminEventStatsResponse = { total, draft, published, closed };
    return res.json({ success: true, data });
  })
);

router.get(
  '/events',
  authMiddleware,
  requireAdmin,
  validateQuery(AdminEventsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      status?: string;
      feedType?: string;
      search?: string;
      sort: string;
      order: 'asc' | 'desc';
    };
    const where: { status?: string; feedType?: string; OR?: { title?: { contains: string; mode: 'insensitive' }; description?: { contains: string; mode: 'insensitive' } }[] } = {};
    if (q.status) where.status = q.status;
    if (q.feedType) where.feedType = q.feedType;
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: { _count: { select: { stats: true } } },
      }),
      prisma.event.count({ where }),
    ]);
    const data: AdminEventListItem[] = events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
      status: e.status,
      feedType: e.feedType,
      imageUrl: e.imageUrl ? resolveMediaUrl(e.imageUrl, true) : null,
      productId: e.productId,
      brandId: e.brandId,
      mainCategoryId: e.mainCategoryId,
      subCategoryId: e.subCategoryId,
      createdAt: e.createdAt.toISOString(),
      participantsCount: e._count.stats,
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

router.get(
  '/events/:id/participants',
  authMiddleware,
  requireAdmin,
  validateQuery(AdminEventParticipantsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id: eventId } = req.params;
    const q = req.query as unknown as { limit: number; offset: number; sort: string; order: 'asc' | 'desc' };
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event bulunamadı');
    const [stats, total] = await Promise.all([
      prisma.eventStats.findMany({
        where: { eventId },
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: { user: { select: { email: true }, include: { profile: { select: { displayName: true } } } } },
      }),
      prisma.eventStats.count({ where: { eventId } }),
    ]);
    const data: AdminEventParticipantListItem[] = stats.map((s) => ({
      id: s.id,
      userId: s.userId,
      eventId: s.eventId,
      totalParticipated: s.totalParticipated,
      totalComments: s.totalComments,
      helpfulVotesReceived: s.helpfulVotesReceived,
      eventPostsCount: s.eventPostsCount,
      eventLikesReceived: s.eventLikesReceived,
      createdAt: s.createdAt.toISOString(),
      userEmail: s.user.email,
      userDisplayName: s.user.profile?.displayName ?? null,
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

router.get(
  '/events/:id/analytics',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id: eventId } = req.params;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event bulunamadı');
    const [participantCount, totalPosts, totalRewardsGranted, badgesCount] = await Promise.all([
      prisma.eventStats.count({ where: { eventId } }),
      prisma.contentPost.count({ where: { eventId } }),
      prisma.eventReward.count({ where: { eventId } }),
      prisma.eventBadge.count({ where: { eventId } }),
    ]);
    const data: AdminEventAnalyticsResponse = {
      participantCount,
      totalPosts,
      totalRewardsGranted,
      badgesCount,
    };
    return res.json({ success: true, data });
  })
);

router.get(
  '/events/:id/badges',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id: eventId } = req.params;
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event bulunamadı');
    const rows = await prisma.eventBadge.findMany({
      where: { eventId },
      orderBy: [{ rank: 'asc' }, { displayOrder: 'asc' }],
      include: { badge: { include: { category: { select: { name: true } } } } },
    });
    const data: AdminEventBadgeListItem[] = rows.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      badgeId: r.badgeId,
      rank: r.rank,
      displayOrder: r.displayOrder,
      enabled: r.enabled,
      createdAt: r.createdAt.toISOString(),
      badgeName: r.badge.name,
      badgeImageUrl: r.badge.imageUrl ? resolveMediaUrl(r.badge.imageUrl, true) : null,
      badgeRarity: r.badge.rarity,
      badgeCategoryName: r.badge.category?.name ?? null,
    }));
    return res.json({ success: true, data });
  })
);

router.post(
  '/events/:id/badges',
  authMiddleware,
  requireAdmin,
  validateBody(AdminAddEventBadgeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id: eventId } = req.params;
    const body = req.body as { badgeId: string; rank: number; displayOrder?: number | null };
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event bulunamadı');
    const badge = await prisma.badge.findUnique({ where: { id: body.badgeId } });
    if (!badge) throw new NotFoundError('Badge bulunamadı');
    const eb = await prisma.eventBadge.create({
      data: { eventId, badgeId: body.badgeId, rank: body.rank, displayOrder: body.displayOrder ?? undefined },
      include: { badge: { include: { category: { select: { name: true } } } } },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'EVENT_BADGE_ADD',
        description: `eventId: ${eventId}, badgeId: ${body.badgeId}, rank: ${body.rank}`,
        entityType: 'event_badge',
        entityId: 0,
      },
    });
    const data: AdminEventBadgeListItem = {
      id: eb.id,
      eventId: eb.eventId,
      badgeId: eb.badgeId,
      rank: eb.rank,
      displayOrder: eb.displayOrder,
      enabled: eb.enabled,
      createdAt: eb.createdAt.toISOString(),
      badgeName: eb.badge.name,
      badgeImageUrl: eb.badge.imageUrl ? resolveMediaUrl(eb.badge.imageUrl, true) : null,
      badgeRarity: eb.badge.rarity,
      badgeCategoryName: eb.badge.category?.name ?? null,
    };
    return res.status(201).json({ success: true, data });
  })
);

router.patch(
  '/events/:id/badges/:eventBadgeId',
  authMiddleware,
  requireAdmin,
  validateBody(AdminUpdateEventBadgeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id: eventId, eventBadgeId } = req.params;
    const body = req.body as { rank?: number; displayOrder?: number | null; enabled?: boolean };
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event bulunamadı');
    const existing = await prisma.eventBadge.findFirst({ where: { id: eventBadgeId, eventId } });
    if (!existing) throw new NotFoundError('Event badge bulunamadı');
    const updateData: { rank?: number; displayOrder?: number | null; enabled?: boolean } = {};
    if (body.rank !== undefined) updateData.rank = body.rank;
    if (body.displayOrder !== undefined) updateData.displayOrder = body.displayOrder;
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    const eb = await prisma.eventBadge.update({
      where: { id: eventBadgeId },
      data: updateData,
      include: { badge: { include: { category: { select: { name: true } } } } },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'EVENT_BADGE_UPDATE',
        description: `eventId: ${eventId}, eventBadgeId: ${eventBadgeId}`,
        entityType: 'event_badge',
        entityId: 0,
      },
    });
    const data: AdminEventBadgeListItem = {
      id: eb.id,
      eventId: eb.eventId,
      badgeId: eb.badgeId,
      rank: eb.rank,
      displayOrder: eb.displayOrder,
      enabled: eb.enabled,
      createdAt: eb.createdAt.toISOString(),
      badgeName: eb.badge.name,
      badgeImageUrl: eb.badge.imageUrl ? resolveMediaUrl(eb.badge.imageUrl, true) : null,
      badgeRarity: eb.badge.rarity,
      badgeCategoryName: eb.badge.category?.name ?? null,
    };
    return res.json({ success: true, data });
  })
);

router.delete(
  '/events/:id/badges/:eventBadgeId',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id: eventId, eventBadgeId } = req.params;
    const existing = await prisma.eventBadge.findFirst({ where: { id: eventBadgeId, eventId } });
    if (!existing) throw new NotFoundError('Event badge bulunamadı');
    await prisma.eventBadge.delete({ where: { id: eventBadgeId } });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'EVENT_BADGE_REMOVE',
        description: `eventId: ${eventId}, eventBadgeId: ${eventBadgeId}`,
        entityType: 'event_badge',
        entityId: 0,
      },
    });
    return res.json({ success: true, message: "Badge event'ten kaldırıldı" });
  })
);

router.get(
  '/events/:id/rewards',
  authMiddleware,
  requireAdmin,
  validateQuery(AdminEventRewardsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id: eventId } = req.params;
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      userId?: string;
      rewardType?: string;
      sort: string;
      order: 'asc' | 'desc';
    };
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event bulunamadı');
    const where: { eventId: string; userId?: string; rewardType?: string } = { eventId };
    if (q.userId) where.userId = q.userId;
    if (q.rewardType) where.rewardType = q.rewardType as 'TIPS' | 'BADGE' | 'TITLE';
    const [rewards, total] = await Promise.all([
      prisma.eventReward.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: { user: { select: { email: true }, include: { profile: { select: { displayName: true } } } } },
      }),
      prisma.eventReward.count({ where }),
    ]);
    const data: AdminEventRewardListItem[] = rewards.map((r) => ({
      id: r.id,
      userId: r.userId,
      eventId: r.eventId,
      rewardType: r.rewardType,
      rewardId: r.rewardId,
      amount: r.amount,
      awardedAt: r.awardedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      userEmail: r.user.email,
      userDisplayName: r.user.profile?.displayName ?? null,
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

router.get(
  '/events/:id',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        mainCategory: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
      },
    });
    if (!event) throw new NotFoundError('Event bulunamadı');
    const data: AdminEventDetailResponse = {
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      status: event.status,
      feedType: event.feedType,
      imageUrl: event.imageUrl ? resolveMediaUrl(event.imageUrl, true) : null,
      productId: event.productId,
      brandId: event.brandId,
      mainCategoryId: event.mainCategoryId,
      subCategoryId: event.subCategoryId,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      product: event.product ? { id: event.product.id, name: event.product.name } : null,
      brand: event.brand ? { id: event.brand.id, name: event.brand.name } : null,
      mainCategory: event.mainCategory ? { id: event.mainCategory.id, name: event.mainCategory.name } : null,
      subCategory: event.subCategory ? { id: event.subCategory.id, name: event.subCategory.name } : null,
    };
    return res.json({ success: true, data });
  })
);

router.post(
  '/events',
  authMiddleware,
  requireAdmin,
  validateBody(AdminCreateEventSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const body = req.body as {
      title: string;
      description?: string | null;
      startDate: string;
      endDate: string;
      status?: string;
      feedType?: string;
      productId?: string | null;
      brandId?: string | null;
      mainCategoryId?: string | null;
      subCategoryId?: string | null;
      imageUrl?: string | null;
    };
    const eventId = generateIdForModel('Event');
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    const event = await prisma.event.create({
      data: {
        id: eventId,
        title: body.title,
        description: body.description ?? null,
        startDate,
        endDate,
        status: (body.status as 'DRAFT' | 'PUBLISHED' | 'CLOSED') ?? 'DRAFT',
        feedType: (body.feedType as 'PICKS' | 'ROASTS') ?? 'PICKS',
        productId: body.productId ?? null,
        brandId: body.brandId ?? null,
        mainCategoryId: body.mainCategoryId ?? null,
        subCategoryId: body.subCategoryId ?? null,
        imageUrl: body.imageUrl ?? null,
      },
      include: {
        product: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        mainCategory: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
      },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'EVENT_CREATE',
        description: `eventId: ${event.id}, title: ${event.title}`,
        entityType: 'event',
        entityId: 0,
      },
    });
    const data: AdminEventDetailResponse = {
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      status: event.status,
      feedType: event.feedType,
      imageUrl: event.imageUrl ? resolveMediaUrl(event.imageUrl, true) : null,
      productId: event.productId,
      brandId: event.brandId,
      mainCategoryId: event.mainCategoryId,
      subCategoryId: event.subCategoryId,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      product: event.product ? { id: event.product.id, name: event.product.name } : null,
      brand: event.brand ? { id: event.brand.id, name: event.brand.name } : null,
      mainCategory: event.mainCategory ? { id: event.mainCategory.id, name: event.mainCategory.name } : null,
      subCategory: event.subCategory ? { id: event.subCategory.id, name: event.subCategory.name } : null,
    };
    return res.status(201).json({ success: true, data });
  })
);

router.patch(
  '/events/:id',
  authMiddleware,
  requireAdmin,
  validateBody(AdminUpdateEventSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const body = req.body as {
      title?: string;
      description?: string | null;
      startDate?: string;
      endDate?: string;
      status?: string;
      feedType?: string;
      productId?: string | null;
      brandId?: string | null;
      mainCategoryId?: string | null;
      subCategoryId?: string | null;
      imageUrl?: string | null;
    };
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundError('Event bulunamadı');
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) updateData.endDate = new Date(body.endDate);
    if (body.status !== undefined) updateData.status = body.status;
    if (body.feedType !== undefined) updateData.feedType = body.feedType;
    if (body.productId !== undefined) updateData.productId = body.productId;
    if (body.brandId !== undefined) updateData.brandId = body.brandId;
    if (body.mainCategoryId !== undefined) updateData.mainCategoryId = body.mainCategoryId;
    if (body.subCategoryId !== undefined) updateData.subCategoryId = body.subCategoryId;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    const updated = await prisma.event.update({
      where: { id },
      data: updateData,
      include: {
        product: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        mainCategory: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
      },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'EVENT_UPDATE',
        description: `eventId: ${id}, fields: ${Object.keys(updateData).join(',')}`,
        entityType: 'event',
        entityId: 0,
      },
    });
    const data: AdminEventDetailResponse = {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      startDate: updated.startDate.toISOString(),
      endDate: updated.endDate.toISOString(),
      status: updated.status,
      feedType: updated.feedType,
      imageUrl: updated.imageUrl ? resolveMediaUrl(updated.imageUrl, true) : null,
      productId: updated.productId,
      brandId: updated.brandId,
      mainCategoryId: updated.mainCategoryId,
      subCategoryId: updated.subCategoryId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      product: updated.product ? { id: updated.product.id, name: updated.product.name } : null,
      brand: updated.brand ? { id: updated.brand.id, name: updated.brand.name } : null,
      mainCategory: updated.mainCategory ? { id: updated.mainCategory.id, name: updated.mainCategory.name } : null,
      subCategory: updated.subCategory ? { id: updated.subCategory.id, name: updated.subCategory.name } : null,
    };
    return res.json({ success: true, data });
  })
);

router.delete(
  '/events/:id',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundError('Event bulunamadı');
    await prisma.event.delete({ where: { id } });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'EVENT_DELETE',
        description: `eventId: ${id}, title: ${event.title}`,
        entityType: 'event',
        entityId: 0,
      },
    });
    return res.json({ success: true, message: 'Event silindi' });
  })
);

export default router;
