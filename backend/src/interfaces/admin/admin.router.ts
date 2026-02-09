import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { v4 as uuidv4 } from 'uuid';
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
import { S3Service } from '../../infrastructure/s3/s3.service';
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
  AdminCollectionsQuerySchema,
  AdminCreateCollectionSchema,
  AdminUpdateCollectionSchema,
  AdminAddCollectionBadgeSchema,
  AdminCreateCollectionGoalSchema,
  AdminBadgesQuerySchema,
  AdminCreateBadgeSchema,
  AdminUpdateBadgeSchema,
  AdminBadgeOwnersQuerySchema,
  AdminContentPostsQuerySchema,
  AdminContentPostUpdateSchema,
  AdminContentCommentsQuerySchema,
  AdminContentCommentUpdateSchema,
  AdminFeedHighlightCreateSchema,
  AdminFeedHighlightUpdateSchema,
  AdminFeedHighlightsQuerySchema,
  AdminTrendingQuerySchema,
  AdminTrendingCreateSchema,
  AdminTrendingUpdateSchema,
  AdminTopCommunityChoicesQuerySchema,
  AdminTopCommunityChoiceCreateSchema,
  AdminTopCommunityChoiceUpdateSchema,
  AdminManualReviewFlagsQuerySchema,
  AdminManualReviewFlagUpdateSchema,
  AdminModerationActionsQuerySchema,
  AdminContentTagsQuerySchema,
} from './admin.schemas';
import type {
  AdminCreateCollectionInput,
  AdminUpdateCollectionInput,
  AdminCreateCollectionGoalInput,
  AdminCreateBadgeInput,
  AdminUpdateBadgeInput,
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
  AdminCollectionStatsResponse,
  AdminCollectionListItem,
  AdminCollectionDetailResponse,
  AdminCollectionBadgeListItem,
  AdminBadgeCategoryListItem,
  AdminBadgeStatsResponse,
  AdminBadgeListItem,
  AdminBadgeDetailResponse,
  AdminBadgeOwnerListItem,
  AdminContentPostsStatsResponse,
  AdminContentPostListItem,
  AdminContentPostDetailResponse,
  AdminContentCommentListItem,
  AdminContentCommentDetailResponse,
  AdminContentCommentStatsResponse,
  AdminFeedHighlightListItem,
  AdminTrendingPostListItem,
  AdminTopCommunityChoiceListItem,
  AdminManualReviewFlagListItem,
  AdminManualReviewFlagDetailResponse,
  AdminModerationActionListItem,
  AdminModerationActionDetailResponse,
  AdminContentTagListItem,
} from './admin.dto';
import logger from '../../infrastructure/logger/logger';
import { NotFoundError, ValidationError } from '../../infrastructure/errors/custom-errors';

const router = Router();
const prisma = getPrisma();
const authService = new AuthService();
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
 * /admin/users/{id}/posts:
 *   get:
 *     summary: Kullanıcının postları (sayfalı)
 *     tags: [Admin]
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
  '/users/:id/posts',
  authMiddleware,
  requireAdmin,
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

/* ========== Admin ActionTypes (Aktivasyon tipleri) ========== */

router.get(
  '/action-types',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const list = await prisma.actionType.findMany({
      orderBy: [{ mainAction: 'asc' }, { code: 'asc' }],
      select: { id: true, mainAction: true, code: true, label: true },
    });
    const data = list.map((a) => ({
      id: a.id,
      mainAction: a.mainAction,
      code: a.code,
      label: a.label,
    }));
    return res.json({ success: true, data });
  })
);

/* ========== Admin Collections (BadgeCollection) ========== */

router.get(
  '/collections/stats',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const total = await prisma.badgeCollection.count();
    const data: AdminCollectionStatsResponse = { total };
    return res.json({ success: true, data });
  })
);

/** Koleksiyon formu için Category ağacı: Ana (parentId null) ve Alt (parentId = ana id). Sadece 1. ve 2. seviye. */
router.get(
  '/collections/categories',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const mainCategories = await prisma.category.findMany({
      where: { parentId: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    const mainIds = mainCategories.map((m) => m.id);
    const subCategories = mainIds.length
      ? await prisma.category.findMany({
          where: { parentId: { in: mainIds } },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, parentId: true },
        })
      : [];
    const childrenByParent = new Map<string | null, Array<{ id: string; name: string }>>();
    for (const m of mainCategories) {
      childrenByParent.set(m.id, subCategories.filter((s) => s.parentId === m.id).map((s) => ({ id: s.id, name: s.name })));
    }
    const data = mainCategories.map((m) => ({
      id: m.id,
      name: m.name,
      children: childrenByParent.get(m.id) ?? [],
    }));
    return res.json({ success: true, data });
  })
);

router.get(
  '/collections',
  authMiddleware,
  requireAdmin,
  validateQuery(AdminCollectionsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      search?: string;
      categoryId?: string;
      sort: string;
      order: 'asc' | 'desc';
    };
    const where: { name?: { contains: string; mode: 'insensitive' }; categoryId?: string } = {};
    if (q.search) where.name = { contains: q.search, mode: 'insensitive' };
    if (q.categoryId) where.categoryId = q.categoryId;
    const [collections, total] = await Promise.all([
      prisma.badgeCollection.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          category: { select: { id: true, name: true } },
          _count: { select: { badges: true, achievementGoals: true } },
        },
      }),
      prisma.badgeCollection.count({ where }),
    ]);
    const data: AdminCollectionListItem[] = collections.map((c) => ({
      id: c.id,
      name: c.name,
      bannerUrl: c.bannerUrl,
      owner: c.owner,
      categoryId: c.categoryId,
      categoryName: c.category?.name ?? null,
      badgesCount: c._count.badges,
      goalsCount: c._count.achievementGoals,
      createdAt: c.createdAt.toISOString(),
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

router.get(
  '/collections/:id/badges',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const collection = await prisma.badgeCollection.findUnique({ where: { id } });
    if (!collection) throw new NotFoundError('Koleksiyon bulunamadı');
    const badges = await prisma.badge.findMany({
      where: { collectionId: id },
      orderBy: { name: 'asc' },
      include: { category: { select: { id: true, name: true } } },
    });
    const data: AdminCollectionBadgeListItem[] = badges.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      imageUrl: b.imageUrl ? resolveMediaUrl(b.imageUrl, true) : null,
      type: b.type,
      rarity: b.rarity,
      categoryId: b.categoryId,
      categoryName: b.category?.name ?? null,
      createdAt: b.createdAt.toISOString(),
    }));
    return res.json({ success: true, data });
  })
);

router.post(
  '/collections/:id/badges',
  authMiddleware,
  requireAdmin,
  validateBody(AdminAddCollectionBadgeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const body = req.body as { badgeId: string };
    const collection = await prisma.badgeCollection.findUnique({ where: { id } });
    if (!collection) throw new NotFoundError('Koleksiyon bulunamadı');
    const badge = await prisma.badge.findUnique({ where: { id: body.badgeId } });
    if (!badge) throw new NotFoundError('Badge bulunamadı');
    if (badge.collectionId === id) {
      return res.status(400).json({ success: false, message: 'Badge zaten bu koleksiyonda' });
    }
    await prisma.badge.update({
      where: { id: body.badgeId },
      data: { collectionId: id },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'COLLECTION_BADGE_ADD',
        description: `collectionId: ${id}, badgeId: ${body.badgeId}`,
        entityType: 'badge_collection',
        entityId: 0,
      },
    });
    return res.json({ success: true, message: 'Badge koleksiyona eklendi', data: { badgeId: body.badgeId } });
  })
);

router.delete(
  '/collections/:id/badges/:badgeId',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id, badgeId } = req.params;
    const collection = await prisma.badgeCollection.findUnique({ where: { id } });
    if (!collection) throw new NotFoundError('Koleksiyon bulunamadı');
    const badge = await prisma.badge.findFirst({ where: { id: badgeId, collectionId: id } });
    if (!badge) throw new NotFoundError('Badge bu koleksiyonda bulunamadı');
    await prisma.badge.update({
      where: { id: badgeId },
      data: { collectionId: null },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'COLLECTION_BADGE_REMOVE',
        description: `collectionId: ${id}, badgeId: ${badgeId}`,
        entityType: 'badge_collection',
        entityId: 0,
      },
    });
    return res.json({ success: true, message: 'Badge koleksiyondan çıkarıldı' });
  })
);

router.post(
  '/collections/:id/goals',
  authMiddleware,
  requireAdmin,
  validateBody(AdminCreateCollectionGoalSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id: collectionId } = req.params;
    const body = req.body as AdminCreateCollectionGoalInput;
    const collection = await prisma.badgeCollection.findUnique({ where: { id: collectionId } });
    if (!collection) throw new NotFoundError('Koleksiyon bulunamadı');
    const actionType = await prisma.actionType.findUnique({ where: { id: body.actionTypeId } });
    if (!actionType) throw new NotFoundError('ActionType bulunamadı');
    const badge = await prisma.badge.findUnique({ where: { id: body.rewardBadgeId } });
    if (!badge) throw new NotFoundError('Badge bulunamadı');
    if (badge.collectionId !== collectionId) throw new ValidationError('Badge bu koleksiyona ait değil');
    const title = body.title ?? badge.name;
    const requirement = body.requirement ?? `${actionType.label}: ${body.pointsRequired} adet`;
    const goal = await prisma.achievementGoal.create({
      data: {
        collectionId,
        title,
        requirement,
        mainAction: actionType.mainAction,
        actionTypeId: body.actionTypeId,
        rewardBadgeId: body.rewardBadgeId,
        pointsRequired: body.pointsRequired,
        difficulty: body.difficulty,
      },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'COLLECTION_GOAL_CREATE',
        description: `collectionId: ${collectionId}, goalId: ${goal.id}, rewardBadgeId: ${body.rewardBadgeId}`,
        entityType: 'badge_collection',
        entityId: 0,
      },
    });
    return res.status(201).json({ success: true, data: { id: goal.id } });
  })
);

router.get(
  '/collections/:id',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const collection = await prisma.badgeCollection.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { badges: true, achievementGoals: true } },
      },
    });
    if (!collection) throw new NotFoundError('Koleksiyon bulunamadı');
    const data: AdminCollectionDetailResponse = {
      id: collection.id,
      name: collection.name,
      bannerUrl: collection.bannerUrl,
      owner: collection.owner,
      categoryId: collection.categoryId,
      categoryName: collection.category?.name ?? null,
      badgesCount: collection._count.badges,
      goalsCount: collection._count.achievementGoals,
      createdAt: collection.createdAt.toISOString(),
      collectionObjective: collection.collectionObjective,
      targetVertical: collection.targetVertical,
      productScope: collection.productScope,
      collectionType: collection.collectionType,
      hookPitch: collection.hookPitch,
      visualTheme: collection.visualTheme,
      completionBonus: collection.completionBonus,
      primaryKpi: collection.primaryKpi,
      secondaryKpi: collection.secondaryKpi,
      targetAudience: collection.targetAudience,
      campaignContext: collection.campaignContext,
      successMetric: collection.successMetric,
      sponsorship: collection.sponsorship,
      unlockCondition: collection.unlockCondition,
      scheduleLaunchDate: collection.scheduleLaunchDate?.toISOString() ?? null,
      timeStockLimit: collection.timeStockLimit,
      updatedAt: collection.updatedAt.toISOString(),
      category: collection.category ? { id: collection.category.id, name: collection.category.name } : null,
    };
    return res.json({ success: true, data });
  })
);

router.post(
  '/collections',
  authMiddleware,
  requireAdmin,
  validateBody(AdminCreateCollectionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const body = req.body as AdminCreateCollectionInput;
    const collection = await prisma.badgeCollection.create({
      data: {
        name: body.name,
        bannerUrl: body.bannerUrl ?? undefined,
        owner: body.owner ?? undefined,
        collectionObjective: body.collectionObjective ?? undefined,
        targetVertical: body.targetVertical ?? undefined,
        productScope: body.productScope ?? undefined,
        collectionType: body.collectionType ?? undefined,
        hookPitch: body.hookPitch ?? undefined,
        visualTheme: body.visualTheme ?? undefined,
        completionBonus: body.completionBonus ?? undefined,
        primaryKpi: body.primaryKpi ?? undefined,
        secondaryKpi: body.secondaryKpi ?? undefined,
        targetAudience: body.targetAudience ?? undefined,
        campaignContext: body.campaignContext ?? undefined,
        successMetric: body.successMetric ?? undefined,
        sponsorship: body.sponsorship ?? undefined,
        unlockCondition: body.unlockCondition ?? undefined,
        scheduleLaunchDate: body.scheduleLaunchDate ?? undefined,
        timeStockLimit: body.timeStockLimit ?? undefined,
        categoryId: body.categoryId,
      },
      include: { category: { select: { id: true, name: true } } },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'COLLECTION_CREATE',
        description: `collectionId: ${collection.id}, name: ${collection.name}`,
        entityType: 'badge_collection',
        entityId: 0,
      },
    });
    const data: AdminCollectionDetailResponse = {
      id: collection.id,
      name: collection.name,
      bannerUrl: collection.bannerUrl,
      owner: collection.owner,
      categoryId: collection.categoryId,
      categoryName: collection.category?.name ?? null,
      badgesCount: 0,
      goalsCount: 0,
      createdAt: collection.createdAt.toISOString(),
      collectionObjective: collection.collectionObjective,
      targetVertical: collection.targetVertical,
      productScope: collection.productScope,
      collectionType: collection.collectionType,
      hookPitch: collection.hookPitch,
      visualTheme: collection.visualTheme,
      completionBonus: collection.completionBonus,
      primaryKpi: collection.primaryKpi,
      secondaryKpi: collection.secondaryKpi,
      targetAudience: collection.targetAudience,
      campaignContext: collection.campaignContext,
      successMetric: collection.successMetric,
      sponsorship: collection.sponsorship,
      unlockCondition: collection.unlockCondition,
      scheduleLaunchDate: collection.scheduleLaunchDate?.toISOString() ?? null,
      timeStockLimit: collection.timeStockLimit,
      updatedAt: collection.updatedAt.toISOString(),
      category: collection.category ? { id: collection.category.id, name: collection.category.name } : null,
    };
    return res.status(201).json({ success: true, data });
  })
);

router.patch(
  '/collections/:id',
  authMiddleware,
  requireAdmin,
  validateBody(AdminUpdateCollectionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const body = req.body as AdminUpdateCollectionInput;
    const collection = await prisma.badgeCollection.findUnique({ where: { id } });
    if (!collection) throw new NotFoundError('Koleksiyon bulunamadı');
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.bannerUrl !== undefined) updateData.bannerUrl = body.bannerUrl;
    if (body.owner !== undefined) updateData.owner = body.owner;
    if (body.collectionObjective !== undefined) updateData.collectionObjective = body.collectionObjective;
    if (body.targetVertical !== undefined) updateData.targetVertical = body.targetVertical;
    if (body.productScope !== undefined) updateData.productScope = body.productScope;
    if (body.collectionType !== undefined) updateData.collectionType = body.collectionType;
    if (body.hookPitch !== undefined) updateData.hookPitch = body.hookPitch;
    if (body.visualTheme !== undefined) updateData.visualTheme = body.visualTheme;
    if (body.completionBonus !== undefined) updateData.completionBonus = body.completionBonus;
    if (body.primaryKpi !== undefined) updateData.primaryKpi = body.primaryKpi;
    if (body.secondaryKpi !== undefined) updateData.secondaryKpi = body.secondaryKpi;
    if (body.targetAudience !== undefined) updateData.targetAudience = body.targetAudience;
    if (body.campaignContext !== undefined) updateData.campaignContext = body.campaignContext;
    if (body.successMetric !== undefined) updateData.successMetric = body.successMetric;
    if (body.sponsorship !== undefined) updateData.sponsorship = body.sponsorship;
    if (body.unlockCondition !== undefined) updateData.unlockCondition = body.unlockCondition;
    if (body.scheduleLaunchDate !== undefined) updateData.scheduleLaunchDate = body.scheduleLaunchDate;
    if (body.timeStockLimit !== undefined) updateData.timeStockLimit = body.timeStockLimit;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    const updated = await prisma.badgeCollection.update({
      where: { id },
      data: updateData,
      include: { category: { select: { id: true, name: true } }, _count: { select: { badges: true, achievementGoals: true } } },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'COLLECTION_UPDATE',
        description: `collectionId: ${id}`,
        entityType: 'badge_collection',
        entityId: 0,
      },
    });
    const data: AdminCollectionDetailResponse = {
      id: updated.id,
      name: updated.name,
      bannerUrl: updated.bannerUrl,
      owner: updated.owner,
      categoryId: updated.categoryId,
      categoryName: updated.category?.name ?? null,
      badgesCount: updated._count.badges,
      goalsCount: updated._count.achievementGoals,
      createdAt: updated.createdAt.toISOString(),
      collectionObjective: updated.collectionObjective,
      targetVertical: updated.targetVertical,
      productScope: updated.productScope,
      collectionType: updated.collectionType,
      hookPitch: updated.hookPitch,
      visualTheme: updated.visualTheme,
      completionBonus: updated.completionBonus,
      primaryKpi: updated.primaryKpi,
      secondaryKpi: updated.secondaryKpi,
      targetAudience: updated.targetAudience,
      campaignContext: updated.campaignContext,
      successMetric: updated.successMetric,
      sponsorship: updated.sponsorship,
      unlockCondition: updated.unlockCondition,
      scheduleLaunchDate: updated.scheduleLaunchDate?.toISOString() ?? null,
      timeStockLimit: updated.timeStockLimit,
      updatedAt: updated.updatedAt.toISOString(),
      category: updated.category ? { id: updated.category.id, name: updated.category.name } : null,
    };
    return res.json({ success: true, data });
  })
);

router.delete(
  '/collections/:id',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const collection = await prisma.badgeCollection.findUnique({ where: { id } });
    if (!collection) throw new NotFoundError('Koleksiyon bulunamadı');
    await prisma.badge.updateMany({ where: { collectionId: id }, data: { collectionId: null } });
    await prisma.badgeCollection.delete({ where: { id } });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'COLLECTION_DELETE',
        description: `collectionId: ${id}, name: ${collection.name}`,
        entityType: 'badge_collection',
        entityId: 0,
      },
    });
    return res.json({ success: true, message: 'Koleksiyon silindi' });
  })
);

/* ========== Admin Media (upload for banners, avatars, etc.) ========== */

router.post(
  '/media/upload',
  authMiddleware,
  requireAdmin,
  adminUpload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Dosya gerekli (field: file)' });
    }
    const ext = req.file.originalname?.split('.').pop()?.toLowerCase() || 'jpg';
    const allowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!allowedExt.includes(ext)) {
      return res.status(400).json({ success: false, message: 'Sadece JPG, PNG, GIF ve WebP desteklenir' });
    }
    const fileName = `admin/collections/${uuidv4()}.${ext}`;
    const path = await s3Service.uploadFile(fileName, req.file.buffer, req.file.mimetype);
    const url = resolveMediaUrl(path);
    return res.json({ success: true, data: { url: url ?? path } });
  })
);

/* ========== Admin Badge Categories ========== */

router.get(
  '/badge-categories',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const categories = await prisma.badgeCategory.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true },
    });
    const data: AdminBadgeCategoryListItem[] = categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
    }));
    return res.json({ success: true, data });
  })
);

/* ========== Admin Badges ========== */

router.get(
  '/badges/stats',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const [total, byType, byRarity] = await Promise.all([
      prisma.badge.count(),
      prisma.badge.groupBy({ by: ['type'], _count: { type: true } }),
      prisma.badge.groupBy({ by: ['rarity'], _count: { rarity: true } }),
    ]);
    const data: AdminBadgeStatsResponse = {
      total,
      byType: Object.fromEntries(byType.map((g) => [g.type, g._count.type])),
      byRarity: Object.fromEntries(byRarity.map((g) => [g.rarity, g._count.rarity])),
    };
    return res.json({ success: true, data });
  })
);

router.get(
  '/badges',
  authMiddleware,
  requireAdmin,
  validateQuery(AdminBadgesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      type?: string;
      rarity?: string;
      categoryId?: string;
      collectionId?: string;
      search?: string;
      sort: string;
      order: 'asc' | 'desc';
    };
    const where: {
      type?: string;
      rarity?: string;
      categoryId?: string;
      collectionId?: string | null;
      OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; description?: { contains: string; mode: 'insensitive' } }>;
    } = {};
    if (q.type) where.type = q.type;
    if (q.rarity) where.rarity = q.rarity;
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.collectionId !== undefined) where.collectionId = q.collectionId;
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [badges, total] = await Promise.all([
      prisma.badge.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: { category: { select: { id: true, name: true } }, collection: { select: { id: true, name: true } } },
      }),
      prisma.badge.count({ where }),
    ]);
    const data: AdminBadgeListItem[] = badges.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      imageUrl: b.imageUrl ? resolveMediaUrl(b.imageUrl, true) : null,
      type: b.type,
      rarity: b.rarity,
      categoryId: b.categoryId,
      categoryName: b.category?.name ?? null,
      collectionId: b.collectionId,
      collectionName: b.collection?.name ?? null,
      createdAt: b.createdAt.toISOString(),
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

router.get(
  '/badges/:id/owners',
  authMiddleware,
  requireAdmin,
  validateQuery(AdminBadgeOwnersQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const q = req.query as unknown as { limit: number; offset: number; claimed?: boolean; sort: string; order: 'asc' | 'desc' };
    const badge = await prisma.badge.findUnique({ where: { id } });
    if (!badge) throw new NotFoundError('Badge bulunamadı');
    const where: { badgeId: string; claimed?: boolean } = { badgeId: id };
    if (q.claimed !== undefined) where.claimed = q.claimed;
    const [userBadges, total] = await Promise.all([
      prisma.userBadge.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: { user: { select: { email: true }, include: { profile: { select: { displayName: true } } } } },
      }),
      prisma.userBadge.count({ where }),
    ]);
    const data: AdminBadgeOwnerListItem[] = userBadges.map((ub) => ({
      id: ub.id,
      userId: ub.userId,
      badgeId: ub.badgeId,
      claimed: ub.claimed,
      claimedAt: ub.claimedAt?.toISOString() ?? null,
      createdAt: ub.createdAt.toISOString(),
      userEmail: ub.user.email ?? null,
      userDisplayName: ub.user.profile?.displayName ?? null,
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

router.get(
  '/badges/:id',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const badge = await prisma.badge.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true } }, collection: { select: { id: true, name: true } } },
    });
    if (!badge) throw new NotFoundError('Badge bulunamadı');
    const data: AdminBadgeDetailResponse = {
      id: badge.id,
      name: badge.name,
      description: badge.description,
      imageUrl: badge.imageUrl ? resolveMediaUrl(badge.imageUrl, true) : null,
      type: badge.type,
      rarity: badge.rarity,
      categoryId: badge.categoryId,
      categoryName: badge.category?.name ?? null,
      collectionId: badge.collectionId,
      collectionName: badge.collection?.name ?? null,
      createdAt: badge.createdAt.toISOString(),
      boostMultiplier: badge.boostMultiplier,
      rewardMultiplier: badge.rewardMultiplier,
      updatedAt: (badge as { updatedAt?: Date }).updatedAt?.toISOString() ?? null,
      category: badge.category ? { id: badge.category.id, name: badge.category.name } : null,
      collection: badge.collection ? { id: badge.collection.id, name: badge.collection.name } : null,
    };
    return res.json({ success: true, data });
  })
);

router.post(
  '/badges',
  authMiddleware,
  requireAdmin,
  validateBody(AdminCreateBadgeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const body = req.body as AdminCreateBadgeInput;
    const badge = await prisma.badge.create({
      data: {
        name: body.name,
        description: body.description ?? undefined,
        imageUrl: body.imageUrl ?? undefined,
        type: body.type,
        rarity: body.rarity,
        boostMultiplier: body.boostMultiplier ?? undefined,
        rewardMultiplier: body.rewardMultiplier ?? undefined,
        categoryId: body.categoryId,
        collectionId: body.collectionId ?? undefined,
      },
      include: { category: { select: { id: true, name: true } }, collection: { select: { id: true, name: true } } },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'BADGE_CREATE',
        description: `badgeId: ${badge.id}, name: ${badge.name}`,
        entityType: 'badge',
        entityId: 0,
      },
    });
    const data: AdminBadgeDetailResponse = {
      id: badge.id,
      name: badge.name,
      description: badge.description,
      imageUrl: badge.imageUrl ? resolveMediaUrl(badge.imageUrl, true) : null,
      type: badge.type,
      rarity: badge.rarity,
      categoryId: badge.categoryId,
      categoryName: badge.category?.name ?? null,
      collectionId: badge.collectionId,
      collectionName: badge.collection?.name ?? null,
      createdAt: badge.createdAt.toISOString(),
      boostMultiplier: badge.boostMultiplier,
      rewardMultiplier: badge.rewardMultiplier,
      updatedAt: (badge as { updatedAt?: Date }).updatedAt?.toISOString() ?? null,
      category: badge.category ? { id: badge.category.id, name: badge.category.name } : null,
      collection: badge.collection ? { id: badge.collection.id, name: badge.collection.name } : null,
    };
    return res.status(201).json({ success: true, data });
  })
);

router.patch(
  '/badges/:id',
  authMiddleware,
  requireAdmin,
  validateBody(AdminUpdateBadgeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const body = req.body as AdminUpdateBadgeInput;
    const badge = await prisma.badge.findUnique({ where: { id } });
    if (!badge) throw new NotFoundError('Badge bulunamadı');
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.rarity !== undefined) updateData.rarity = body.rarity;
    if (body.boostMultiplier !== undefined) updateData.boostMultiplier = body.boostMultiplier;
    if (body.rewardMultiplier !== undefined) updateData.rewardMultiplier = body.rewardMultiplier;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.collectionId !== undefined) updateData.collectionId = body.collectionId;
    const updated = await prisma.badge.update({
      where: { id },
      data: updateData,
      include: { category: { select: { id: true, name: true } }, collection: { select: { id: true, name: true } } },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'BADGE_UPDATE',
        description: `badgeId: ${id}`,
        entityType: 'badge',
        entityId: 0,
      },
    });
    const data: AdminBadgeDetailResponse = {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      imageUrl: updated.imageUrl ? resolveMediaUrl(updated.imageUrl, true) : null,
      type: updated.type,
      rarity: updated.rarity,
      categoryId: updated.categoryId,
      categoryName: updated.category?.name ?? null,
      collectionId: updated.collectionId,
      collectionName: updated.collection?.name ?? null,
      createdAt: updated.createdAt.toISOString(),
      boostMultiplier: updated.boostMultiplier,
      rewardMultiplier: updated.rewardMultiplier,
      updatedAt: (updated as { updatedAt?: Date }).updatedAt?.toISOString() ?? null,
      category: updated.category ? { id: updated.category.id, name: updated.category.name } : null,
      collection: updated.collection ? { id: updated.collection.id, name: updated.collection.name } : null,
    };
    return res.json({ success: true, data });
  })
);

router.delete(
  '/badges/:id',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const badge = await prisma.badge.findUnique({ where: { id } });
    if (!badge) throw new NotFoundError('Badge bulunamadı');
    await prisma.badge.delete({ where: { id } });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'BADGE_DELETE',
        description: `badgeId: ${id}, name: ${badge.name}`,
        entityType: 'badge',
        entityId: 0,
      },
    });
    return res.json({ success: true, message: 'Badge silindi' });
  })
);

/* ========== Admin Content ========== */

/**
 * @openapi
 * /admin/content/posts/stats:
 *   get:
 *     summary: İçerik post istatistikleri (toplam, türe göre, boosted, event’e bağlı)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: İstatistikler
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/content/posts/stats',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const [total, byTypeRows, boostedCount, withEventCount] = await Promise.all([
      prisma.contentPost.count(),
      prisma.contentPost.groupBy({ by: ['type'], _count: { id: true } }),
      prisma.contentPost.count({ where: { isBoosted: true } }),
      prisma.contentPost.count({ where: { eventId: { not: null } } }),
    ]);
    const byType: Record<string, number> = {};
    for (const row of byTypeRows) {
      byType[row.type] = row._count.id;
    }
    const data: AdminContentPostsStatsResponse = { total, byType, boostedCount, withEventCount };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/content/posts:
 *   get:
 *     summary: Post listesi (sayfalama, filtre, arama)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         name: userId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: eventId
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [createdAt, likesCount, commentsCount, viewsCount, title] }
 *       - in: query
 *         name: order
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200:
 *         description: Post listesi
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/content/posts',
  authMiddleware,
  requireAdmin,
  validateQuery(AdminContentPostsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as {
      limit: number;
      offset: number;
      type?: string;
      userId?: string;
      eventId?: string;
      mainCategoryId?: string;
      subCategoryId?: string;
      productId?: string;
      search?: string;
      sort: 'createdAt' | 'likesCount' | 'commentsCount' | 'viewsCount' | 'title';
      order: 'asc' | 'desc';
    };
    const where: Record<string, unknown> = {};
    if (q.type) where.type = q.type;
    if (q.userId) where.userId = q.userId;
    if (q.eventId) where.eventId = q.eventId;
    if (q.mainCategoryId) where.mainCategoryId = q.mainCategoryId;
    if (q.subCategoryId) where.subCategoryId = q.subCategoryId;
    if (q.productId) where.productId = q.productId;
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' as const } },
        { body: { contains: q.search, mode: 'insensitive' as const } },
      ];
    }
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
 * /admin/content/posts/{id}:
 *   get:
 *     summary: Tek post detayı
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Post detayı
 *       404:
 *         description: Post bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/content/posts/:id',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const post = await prisma.contentPost.findUnique({
      where: { id },
      include: {
        user: { include: { profile: { select: { displayName: true, userName: true } } } },
        mainCategory: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
        productGroup: { select: { id: true, name: true } },
        event: { select: { id: true, title: true, status: true } },
        media: { select: { id: true, mediaUrl: true, orderIndex: true }, orderBy: { orderIndex: 'asc' } },
        question: { select: { id: true, expectedAnswerFormat: true, relatedProductId: true } },
        comparison: { select: { id: true, product1Id: true, product2Id: true, comparisonSummary: true } },
        tip: { select: { id: true, tipCategory: true, isVerified: true } },
        contentPostTags: { select: { tag: true } },
      },
    });
    if (!post) throw new NotFoundError('Post bulunamadı');
    const tags = post.contentPostTags?.map((t) => t.tag) ?? [];
    const media = post.media?.map((m) => ({ id: m.id, mediaUrl: resolveMediaUrl(m.mediaUrl, true), orderIndex: m.orderIndex })) ?? [];
    const data: AdminContentPostDetailResponse = {
      id: post.id,
      userId: post.userId,
      type: post.type,
      title: post.title,
      body: post.body,
      bodyExcerpt: post.body.length > 200 ? post.body.slice(0, 200) + '...' : post.body,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      favoritesCount: post.favoritesCount,
      viewsCount: post.viewsCount,
      sharesCount: post.sharesCount,
      isBoosted: post.isBoosted,
      boostedUntil: post.boostedUntil?.toISOString() ?? null,
      eventId: post.eventId,
      mainCategoryId: post.mainCategoryId,
      subCategoryId: post.subCategoryId,
      categoryId: post.categoryId,
      productGroupId: post.productGroupId,
      productId: post.productId,
      productStatus: post.productStatus,
      inventoryRequired: post.inventoryRequired,
      userDisplayName: post.user.profile?.displayName ?? null,
      userName: post.user.profile?.userName ?? null,
      user: {
        id: post.user.id,
        email: post.user.email,
        displayName: post.user.profile?.displayName ?? null,
        userName: post.user.profile?.userName ?? null,
      },
      mainCategory: post.mainCategory ?? undefined,
      subCategory: post.subCategory ?? undefined,
      category: post.category ?? undefined,
      product: post.product ?? undefined,
      productGroup: post.productGroup ?? undefined,
      event: post.event ?? undefined,
      media,
      tags,
      question: post.question ?? undefined,
      comparison: post.comparison ?? undefined,
      tip: post.tip ?? undefined,
      experienceDurationId: post.experienceDurationId,
      experienceLocationId: post.experienceLocationId,
      experiencePurposeId: post.experiencePurposeId,
      experienceSnippetId: post.experienceSnippetId,
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/content/posts/{id}:
 *   patch:
 *     summary: Post güncelle (title, body, isBoosted, category vb.)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               body: { type: string }
 *               isBoosted: { type: boolean }
 *               boostedUntil: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Post güncellendi
 *       404:
 *         description: Post bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  '/content/posts/:id',
  authMiddleware,
  requireAdmin,
  validateBody(AdminContentPostUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const body = req.body as {
      title?: string;
      body?: string;
      isBoosted?: boolean;
      boostedUntil?: string | null;
      mainCategoryId?: string | null;
      subCategoryId?: string | null;
      categoryId?: string | null;
      productGroupId?: string | null;
      productId?: string | null;
    };
    const post = await prisma.contentPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundError('Post bulunamadı');
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.body !== undefined) updateData.body = body.body;
    if (body.isBoosted !== undefined) updateData.isBoosted = body.isBoosted;
    if (body.boostedUntil !== undefined) updateData.boostedUntil = body.boostedUntil ? new Date(body.boostedUntil) : null;
    if (body.mainCategoryId !== undefined) updateData.mainCategoryId = body.mainCategoryId;
    if (body.subCategoryId !== undefined) updateData.subCategoryId = body.subCategoryId;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.productGroupId !== undefined) updateData.productGroupId = body.productGroupId;
    if (body.productId !== undefined) updateData.productId = body.productId;
    await prisma.$transaction([
      prisma.contentPost.update({ where: { id }, data: updateData }),
      prisma.adminLog.create({
        data: {
          adminId,
          action: 'CONTENT_POST_UPDATE',
          description: `postId: ${id}, fields: ${Object.keys(updateData).join(',')}`,
          entityType: 'content_post',
          entityId: 0,
        },
      }),
    ]);
    const updated = await prisma.contentPost.findUnique({
      where: { id },
      include: {
        user: { include: { profile: { select: { displayName: true, userName: true } } } },
        media: { select: { mediaUrl: true, orderIndex: true }, orderBy: { orderIndex: 'asc' }, take: 1 },
      },
    });
    const p = updated!;
    const firstMedia = p.media?.[0];
    const thumbnailUrl = firstMedia ? resolveMediaUrl(firstMedia.mediaUrl, true) : null;
    const data: AdminContentPostListItem = {
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
    return res.json({ success: true, message: 'Post güncellendi', data });
  })
);

/**
 * @openapi
 * /admin/content/posts/{id}:
 *   delete:
 *     summary: Post sil (cascade: yorumlar, beğeniler vb.)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Post silindi
 *       404:
 *         description: Post bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete(
  '/content/posts/:id',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const post = await prisma.contentPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundError('Post bulunamadı');
    await prisma.contentPost.delete({ where: { id } });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'CONTENT_POST_DELETE',
        description: `postId: ${id}, title: ${post.title}`,
        entityType: 'content_post',
        entityId: 0,
      },
    });
    return res.json({ success: true, message: 'Post silindi', data: { id } });
  })
);

/**
 * @openapi
 * /admin/content/comments/stats:
 *   get:
 *     summary: Yorum istatistikleri
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: İstatistikler
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/content/comments/stats',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const total = await prisma.contentComment.count();
    const data: AdminContentCommentStatsResponse = { total };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/content/comments:
 *   get:
 *     summary: Yorum listesi (sayfalama, postId, userId filtreleri)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: postId
 *         schema: { type: string }
 *       - in: query
 *         name: userId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Yorum listesi
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/content/comments',
  authMiddleware,
  requireAdmin,
  validateQuery(AdminContentCommentsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as {
      limit: number;
      offset: number;
      postId?: string;
      userId?: string;
      parentIdNull?: boolean;
      sort: string;
      order: 'asc' | 'desc';
    };
    const where: Record<string, unknown> = {};
    if (q.postId) where.postId = q.postId;
    if (q.userId) where.userId = q.userId;
    if (q.parentIdNull === true) where.parentId = null;
    if (q.parentIdNull === false) where.parentId = { not: null };
    const [comments, total] = await Promise.all([
      prisma.contentComment.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          user: { include: { profile: { select: { displayName: true, userName: true } } } },
          post: { select: { title: true } },
        },
      }),
      prisma.contentComment.count({ where }),
    ]);
    const data: AdminContentCommentListItem[] = comments.map((c) => ({
      id: c.id,
      postId: c.postId,
      userId: c.userId,
      parentId: c.parentId,
      comment: c.comment,
      commentExcerpt: c.comment.length > 150 ? c.comment.slice(0, 150) + '...' : c.comment,
      isAnswer: c.isAnswer,
      likesCount: c.likesCount,
      createdAt: c.createdAt.toISOString(),
      userDisplayName: c.user.profile?.displayName ?? null,
      userName: c.user.profile?.userName ?? null,
      postTitle: c.post?.title ?? null,
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /admin/content/comments/{id}:
 *   get:
 *     summary: Tek yorum detayı
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Yorum detayı
 *       404:
 *         description: Yorum bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/content/comments/:id',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const comment = await prisma.contentComment.findUnique({
      where: { id },
      include: {
        user: { include: { profile: { select: { displayName: true, userName: true } } } },
        post: { select: { id: true, title: true, type: true } },
        _count: { select: { replies: true } },
      },
    });
    if (!comment) throw new NotFoundError('Yorum bulunamadı');
    const data: AdminContentCommentDetailResponse = {
      id: comment.id,
      postId: comment.postId,
      userId: comment.userId,
      parentId: comment.parentId,
      comment: comment.comment,
      commentExcerpt: comment.comment.length > 150 ? comment.comment.slice(0, 150) + '...' : comment.comment,
      isAnswer: comment.isAnswer,
      likesCount: comment.likesCount,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      userDisplayName: comment.user.profile?.displayName ?? null,
      userName: comment.user.profile?.userName ?? null,
      postTitle: comment.post?.title ?? null,
      post: comment.post ?? undefined,
      user: {
        id: comment.user.id,
        email: comment.user.email,
        displayName: comment.user.profile?.displayName ?? null,
        userName: comment.user.profile?.userName ?? null,
      },
      repliesCount: comment._count.replies,
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/content/comments/{id}:
 *   patch:
 *     summary: Yorum güncelle (body)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Yorum güncellendi
 *       404:
 *         description: Yorum bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  '/content/comments/:id',
  authMiddleware,
  requireAdmin,
  validateBody(AdminContentCommentUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const body = req.body as { comment?: string };
    const comment = await prisma.contentComment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundError('Yorum bulunamadı');
    if (body.comment !== undefined) {
      await prisma.contentComment.update({ where: { id }, data: { comment: body.comment } });
    }
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'CONTENT_COMMENT_UPDATE',
        description: `commentId: ${id}`,
        entityType: 'content_comment',
        entityId: 0,
      },
    });
    const updated = await prisma.contentComment.findUnique({
      where: { id },
      include: { user: { include: { profile: { select: { displayName: true, userName: true } } } }, post: { select: { title: true } } },
    });
    const c = updated!;
    const data: AdminContentCommentListItem = {
      id: c.id,
      postId: c.postId,
      userId: c.userId,
      parentId: c.parentId,
      comment: c.comment,
      commentExcerpt: c.comment.length > 150 ? c.comment.slice(0, 150) + '...' : c.comment,
      isAnswer: c.isAnswer,
      likesCount: c.likesCount,
      createdAt: c.createdAt.toISOString(),
      userDisplayName: c.user.profile?.displayName ?? null,
      userName: c.user.profile?.userName ?? null,
      postTitle: c.post?.title ?? null,
    };
    return res.json({ success: true, message: 'Yorum güncellendi', data });
  })
);

/**
 * @openapi
 * /admin/content/comments/{id}:
 *   delete:
 *     summary: Yorum sil
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Yorum silindi
 *       404:
 *         description: Yorum bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete(
  '/content/comments/:id',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const comment = await prisma.contentComment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundError('Yorum bulunamadı');
    await prisma.contentComment.delete({ where: { id } });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'CONTENT_COMMENT_DELETE',
        description: `commentId: ${id}`,
        entityType: 'content_comment',
        entityId: 0,
      },
    });
    return res.json({ success: true, message: 'Yorum silindi', data: { id } });
  })
);

/**
 * @openapi
 * /admin/content/feed-highlights:
 *   get:
 *     summary: Feed highlight listesi
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: postId
 *         schema: { type: string }
 *       - in: query
 *         name: reason
 *         schema: { type: string, enum: [MOST_LIKED, STAFF_PICK, BOOSTED] }
 *     responses:
 *       200:
 *         description: Feed highlight listesi
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/content/feed-highlights',
  authMiddleware,
  requireAdmin,
  validateQuery(AdminFeedHighlightsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as { limit: number; offset: number; postId?: string; reason?: string; sort: string; order: 'asc' | 'desc' };
    const where: Record<string, unknown> = {};
    if (q.postId) where.postId = q.postId;
    if (q.reason) where.reason = q.reason;
    const [rows, total] = await Promise.all([
      prisma.feedHighlight.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: { post: { include: { user: { include: { profile: { select: { displayName: true } } } } } } },
      }),
      prisma.feedHighlight.count({ where }),
    ]);
    const data: AdminFeedHighlightListItem[] = rows.map((r) => ({
      id: r.id,
      postId: r.postId,
      reason: r.reason,
      highlightedAt: r.highlightedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      postTitle: r.post?.title ?? null,
      userDisplayName: r.post?.user?.profile?.displayName ?? null,
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /admin/content/feed-highlights:
 *   post:
 *     summary: Feed highlight ekle
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [postId, reason]
 *             properties:
 *               postId: { type: string }
 *               reason: { type: string, enum: [MOST_LIKED, STAFF_PICK, BOOSTED] }
 *     responses:
 *       201:
 *         description: Feed highlight oluşturuldu
 *       404:
 *         description: Post bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  '/content/feed-highlights',
  authMiddleware,
  requireAdmin,
  validateBody(AdminFeedHighlightCreateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const body = req.body as { postId: string; reason: string };
    const post = await prisma.contentPost.findUnique({ where: { id: body.postId } });
    if (!post) throw new NotFoundError('Post bulunamadı');
    const id = generateIdForModel('FeedHighlight');
    const created = await prisma.feedHighlight.create({
      data: { id, postId: body.postId, reason: body.reason as 'MOST_LIKED' | 'STAFF_PICK' | 'BOOSTED' },
      include: { post: { include: { user: { include: { profile: { select: { displayName: true } } } } } } },
    });
    await prisma.adminLog.create({
      data: { adminId, action: 'FEED_HIGHLIGHT_CREATE', description: `postId: ${body.postId}, reason: ${body.reason}`, entityType: 'feed_highlight', entityId: 0 },
    });
    const data: AdminFeedHighlightListItem = {
      id: created.id,
      postId: created.postId,
      reason: created.reason,
      highlightedAt: created.highlightedAt.toISOString(),
      createdAt: created.createdAt.toISOString(),
      postTitle: created.post?.title ?? null,
      userDisplayName: created.post?.user?.profile?.displayName ?? null,
    };
    return res.status(201).json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/content/feed-highlights/{id}:
 *   patch:
 *     summary: Feed highlight güncelle (reason)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Güncellendi
 *       404:
 *         description: Feed highlight bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  '/content/feed-highlights/:id',
  authMiddleware,
  requireAdmin,
  validateBody(AdminFeedHighlightUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const body = req.body as { reason?: string };
    const existing = await prisma.feedHighlight.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Feed highlight bulunamadı');
    const updated = await prisma.feedHighlight.update({
      where: { id },
      data: body.reason ? { reason: body.reason as 'MOST_LIKED' | 'STAFF_PICK' | 'BOOSTED' } : undefined,
      include: { post: { include: { user: { include: { profile: { select: { displayName: true } } } } } } },
    });
    await prisma.adminLog.create({
      data: { adminId, action: 'FEED_HIGHLIGHT_UPDATE', description: `id: ${id}`, entityType: 'feed_highlight', entityId: 0 },
    });
    const data: AdminFeedHighlightListItem = {
      id: updated.id,
      postId: updated.postId,
      reason: updated.reason,
      highlightedAt: updated.highlightedAt.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      postTitle: updated.post?.title ?? null,
      userDisplayName: updated.post?.user?.profile?.displayName ?? null,
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/content/feed-highlights/{id}:
 *   delete:
 *     summary: Feed highlight kaldır
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Kaldırıldı
 *       404:
 *         description: Feed highlight bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete(
  '/content/feed-highlights/:id',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const existing = await prisma.feedHighlight.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Feed highlight bulunamadı');
    await prisma.feedHighlight.delete({ where: { id } });
    await prisma.adminLog.create({
      data: { adminId, action: 'FEED_HIGHLIGHT_DELETE', description: `id: ${id}`, entityType: 'feed_highlight', entityId: 0 },
    });
    return res.json({ success: true, message: 'Feed highlight kaldırıldı' });
  })
);

/**
 * @openapi
 * /admin/content/trending:
 *   get:
 *     summary: Trending post listesi
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: trendPeriod
 *         schema: { type: string, enum: [DAILY, WEEKLY] }
 *     responses:
 *       200:
 *         description: Trending listesi
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/content/trending',
  authMiddleware,
  requireAdmin,
  validateQuery(AdminTrendingQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as { limit: number; offset: number; trendPeriod?: string; sort: string; order: 'asc' | 'desc' };
    const where: Record<string, unknown> = {};
    if (q.trendPeriod) where.trendPeriod = q.trendPeriod;
    const [rows, total] = await Promise.all([
      prisma.trendingPost.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: { post: { include: { user: { include: { profile: { select: { displayName: true } } } } } } },
      }),
      prisma.trendingPost.count({ where }),
    ]);
    const data: AdminTrendingPostListItem[] = rows.map((r) => ({
      id: r.id,
      postId: r.postId,
      score: r.score,
      trendPeriod: r.trendPeriod,
      calculatedAt: r.calculatedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      postTitle: r.post?.title ?? null,
      userDisplayName: r.post?.user?.profile?.displayName ?? null,
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /admin/content/trending:
 *   post:
 *     summary: Trending’e post ekle
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [postId, trendPeriod]
 *             properties:
 *               postId: { type: string }
 *               trendPeriod: { type: string, enum: [DAILY, WEEKLY] }
 *               score: { type: number }
 *     responses:
 *       201:
 *         description: Eklendi
 *       404:
 *         description: Post bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  '/content/trending',
  authMiddleware,
  requireAdmin,
  validateBody(AdminTrendingCreateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const body = req.body as { postId: string; trendPeriod: string; score?: number };
    const post = await prisma.contentPost.findUnique({ where: { id: body.postId } });
    if (!post) throw new NotFoundError('Post bulunamadı');
    const id = generateIdForModel('TrendingPost');
    const created = await prisma.trendingPost.create({
      data: {
        id,
        postId: body.postId,
        trendPeriod: body.trendPeriod as 'DAILY' | 'WEEKLY',
        score: body.score ?? 0,
      },
      include: { post: { include: { user: { include: { profile: { select: { displayName: true } } } } } } },
    });
    await prisma.adminLog.create({
      data: { adminId, action: 'TRENDING_POST_CREATE', description: `postId: ${body.postId}, period: ${body.trendPeriod}`, entityType: 'trending_post', entityId: 0 },
    });
    const data: AdminTrendingPostListItem = {
      id: created.id,
      postId: created.postId,
      score: created.score,
      trendPeriod: created.trendPeriod,
      calculatedAt: created.calculatedAt.toISOString(),
      createdAt: created.createdAt.toISOString(),
      postTitle: created.post?.title ?? null,
      userDisplayName: created.post?.user?.profile?.displayName ?? null,
    };
    return res.status(201).json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/content/trending/{id}:
 *   patch:
 *     summary: Trending kaydı güncelle (score, trendPeriod)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Güncellendi
 *       404:
 *         description: Trending post bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  '/content/trending/:id',
  authMiddleware,
  requireAdmin,
  validateBody(AdminTrendingUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const body = req.body as { score?: number; trendPeriod?: string };
    const existing = await prisma.trendingPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Trending post bulunamadı');
    const updateData: Record<string, unknown> = {};
    if (body.score !== undefined) updateData.score = body.score;
    if (body.trendPeriod !== undefined) updateData.trendPeriod = body.trendPeriod;
    const updated = await prisma.trendingPost.update({
      where: { id },
      data: updateData,
      include: { post: { include: { user: { include: { profile: { select: { displayName: true } } } } } } },
    });
    await prisma.adminLog.create({
      data: { adminId, action: 'TRENDING_POST_UPDATE', description: `id: ${id}`, entityType: 'trending_post', entityId: 0 },
    });
    const data: AdminTrendingPostListItem = {
      id: updated.id,
      postId: updated.postId,
      score: updated.score,
      trendPeriod: updated.trendPeriod,
      calculatedAt: updated.calculatedAt.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      postTitle: updated.post?.title ?? null,
      userDisplayName: updated.post?.user?.profile?.displayName ?? null,
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/content/trending/{id}:
 *   delete:
 *     summary: Trending’den kaldır
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Kaldırıldı
 *       404:
 *         description: Trending post bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete(
  '/content/trending/:id',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const existing = await prisma.trendingPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Trending post bulunamadı');
    await prisma.trendingPost.delete({ where: { id } });
    await prisma.adminLog.create({
      data: { adminId, action: 'TRENDING_POST_DELETE', description: `id: ${id}`, entityType: 'trending_post', entityId: 0 },
    });
    return res.json({ success: true, message: 'Trending\'den kaldırıldı' });
  })
);

/**
 * @openapi
 * /admin/content/top-community-choices:
 *   get:
 *     summary: Top community choice listesi
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: postId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Liste
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/content/top-community-choices',
  authMiddleware,
  requireAdmin,
  validateQuery(AdminTopCommunityChoicesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as { limit: number; offset: number; postId?: string; sort: string; order: 'asc' | 'desc' };
    const where: Record<string, unknown> = {};
    if (q.postId) where.postId = q.postId;
    const [rows, total] = await Promise.all([
      prisma.topCommunityChoice.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: { post: { select: { title: true } } },
      }),
      prisma.topCommunityChoice.count({ where }),
    ]);
    const data: AdminTopCommunityChoiceListItem[] = rows.map((r) => ({
      id: r.id,
      postId: r.postId,
      reason: r.reason,
      badgeLabel: r.badgeLabel,
      awardedAt: r.awardedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      postTitle: r.post?.title ?? null,
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /admin/content/top-community-choices:
 *   post:
 *     summary: Top community choice ekle
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [postId, badgeLabel]
 *             properties:
 *               postId: { type: string }
 *               reason: { type: string, nullable: true }
 *               badgeLabel: { type: string }
 *     responses:
 *       201:
 *         description: Eklendi
 *       404:
 *         description: Post bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  '/content/top-community-choices',
  authMiddleware,
  requireAdmin,
  validateBody(AdminTopCommunityChoiceCreateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const body = req.body as { postId: string; reason?: string | null; badgeLabel: string };
    const post = await prisma.contentPost.findUnique({ where: { id: body.postId } });
    if (!post) throw new NotFoundError('Post bulunamadı');
    const created = await prisma.topCommunityChoice.create({
      data: { postId: body.postId, reason: body.reason ?? null, badgeLabel: body.badgeLabel },
      include: { post: { select: { title: true } } },
    });
    await prisma.adminLog.create({
      data: { adminId, action: 'TOP_COMMUNITY_CHOICE_CREATE', description: `postId: ${body.postId}`, entityType: 'top_community_choice', entityId: 0 },
    });
    const data: AdminTopCommunityChoiceListItem = {
      id: created.id,
      postId: created.postId,
      reason: created.reason,
      badgeLabel: created.badgeLabel,
      awardedAt: created.awardedAt.toISOString(),
      createdAt: created.createdAt.toISOString(),
      postTitle: created.post?.title ?? null,
    };
    return res.status(201).json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/content/top-community-choices/{id}:
 *   patch:
 *     summary: Top community choice güncelle (reason, badgeLabel)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Güncellendi
 *       404:
 *         description: Bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  '/content/top-community-choices/:id',
  authMiddleware,
  requireAdmin,
  validateBody(AdminTopCommunityChoiceUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const body = req.body as { reason?: string | null; badgeLabel?: string };
    const existing = await prisma.topCommunityChoice.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Top community choice bulunamadı');
    const updateData: Record<string, unknown> = {};
    if (body.reason !== undefined) updateData.reason = body.reason;
    if (body.badgeLabel !== undefined) updateData.badgeLabel = body.badgeLabel;
    const updated = await prisma.topCommunityChoice.update({
      where: { id },
      data: updateData,
      include: { post: { select: { title: true } } },
    });
    await prisma.adminLog.create({
      data: { adminId, action: 'TOP_COMMUNITY_CHOICE_UPDATE', description: `id: ${id}`, entityType: 'top_community_choice', entityId: 0 },
    });
    const data: AdminTopCommunityChoiceListItem = {
      id: updated.id,
      postId: updated.postId,
      reason: updated.reason,
      badgeLabel: updated.badgeLabel,
      awardedAt: updated.awardedAt.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      postTitle: updated.post?.title ?? null,
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/content/top-community-choices/{id}:
 *   delete:
 *     summary: Top community choice kaldır
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Kaldırıldı
 *       404:
 *         description: Bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete(
  '/content/top-community-choices/:id',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const existing = await prisma.topCommunityChoice.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Top community choice bulunamadı');
    await prisma.topCommunityChoice.delete({ where: { id } });
    await prisma.adminLog.create({
      data: { adminId, action: 'TOP_COMMUNITY_CHOICE_DELETE', description: `id: ${id}`, entityType: 'top_community_choice', entityId: 0 },
    });
    return res.json({ success: true, message: 'Kaldırıldı' });
  })
);

/**
 * @openapi
 * /admin/content/manual-review-flags:
 *   get:
 *     summary: Manual review flag listesi
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: contentType
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Liste
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/content/manual-review-flags',
  authMiddleware,
  requireAdmin,
  validateQuery(AdminManualReviewFlagsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as { limit: number; offset: number; status?: string; contentType?: string; sort: string; order: 'asc' | 'desc' };
    const where: Record<string, unknown> = {};
    if (q.status) where.status = q.status;
    if (q.contentType) where.contentType = q.contentType;
    const [rows, total] = await Promise.all([
      prisma.manualReviewFlag.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: { flaggedByUser: { select: { email: true }, include: { profile: { select: { displayName: true } } } } },
      }),
      prisma.manualReviewFlag.count({ where }),
    ]);
    const data: AdminManualReviewFlagListItem[] = rows.map((r) => ({
      id: r.id,
      flaggedByUserId: r.flaggedByUserId,
      contentType: r.contentType,
      contentId: r.contentId,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      flaggedByUserEmail: r.flaggedByUser.email ?? null,
      flaggedByUserDisplayName: r.flaggedByUser.profile?.displayName ?? null,
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /admin/content/manual-review-flags/{id}:
 *   get:
 *     summary: Tek manual review flag detayı
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Flag detayı
 *       404:
 *         description: Bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/content/manual-review-flags/:id',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const flag = await prisma.manualReviewFlag.findUnique({
      where: { id },
      include: { flaggedByUser: { select: { email: true }, include: { profile: { select: { displayName: true } } } } },
    });
    if (!flag) throw new NotFoundError('Manual review flag bulunamadı');
    const data: AdminManualReviewFlagDetailResponse = {
      id: flag.id,
      flaggedByUserId: flag.flaggedByUserId,
      contentType: flag.contentType,
      contentId: flag.contentId,
      reason: flag.reason,
      status: flag.status,
      createdAt: flag.createdAt.toISOString(),
      updatedAt: flag.updatedAt.toISOString(),
      flaggedByUserEmail: flag.flaggedByUser.email ?? null,
      flaggedByUserDisplayName: flag.flaggedByUser.profile?.displayName ?? null,
      contentSummary: `${flag.contentType}#${flag.contentId}`,
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/content/manual-review-flags/{id}:
 *   patch:
 *     summary: Manual review flag güncelle (status)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string }
 *     responses:
 *       200:
 *         description: Güncellendi
 *       404:
 *         description: Bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  '/content/manual-review-flags/:id',
  authMiddleware,
  requireAdmin,
  validateBody(AdminManualReviewFlagUpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const body = req.body as { status?: string };
    const flag = await prisma.manualReviewFlag.findUnique({ where: { id } });
    if (!flag) throw new NotFoundError('Manual review flag bulunamadı');
    const updateData: Record<string, unknown> = {};
    if (body.status !== undefined) updateData.status = body.status;
    await prisma.manualReviewFlag.update({ where: { id }, data: updateData });
    await prisma.adminLog.create({
      data: { adminId, action: 'MANUAL_REVIEW_FLAG_UPDATE', description: `id: ${id}, status: ${body.status ?? flag.status}`, entityType: 'manual_review_flag', entityId: 0 },
    });
    const updated = await prisma.manualReviewFlag.findUnique({
      where: { id },
      include: { flaggedByUser: { select: { email: true }, include: { profile: { select: { displayName: true } } } } },
    });
    const r = updated!;
    const data: AdminManualReviewFlagListItem = {
      id: r.id,
      flaggedByUserId: r.flaggedByUserId,
      contentType: r.contentType,
      contentId: r.contentId,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      flaggedByUserEmail: r.flaggedByUser.email ?? null,
      flaggedByUserDisplayName: r.flaggedByUser.profile?.displayName ?? null,
    };
    return res.json({ success: true, message: 'Güncellendi', data });
  })
);

/**
 * @openapi
 * /admin/content/moderation-actions:
 *   get:
 *     summary: Moderation action listesi
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: targetUserId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: contentType
 *         schema: { type: string }
 *       - in: query
 *         name: actionType
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Liste
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/content/moderation-actions',
  authMiddleware,
  requireAdmin,
  validateQuery(AdminModerationActionsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as { limit: number; offset: number; targetUserId?: string; contentType?: string; actionType?: string; sort: string; order: 'asc' | 'desc' };
    const where: Record<string, unknown> = {};
    if (q.targetUserId) where.targetUserId = q.targetUserId;
    if (q.contentType) where.contentType = q.contentType;
    if (q.actionType) where.actionType = q.actionType;
    const [rows, total] = await Promise.all([
      prisma.moderationAction.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          moderator: { select: { email: true } },
          targetUser: { select: { email: true }, include: { profile: { select: { displayName: true } } } },
        },
      }),
      prisma.moderationAction.count({ where }),
    ]);
    const data: AdminModerationActionListItem[] = rows.map((r) => ({
      id: r.id,
      moderatorId: r.moderatorId,
      targetUserId: r.targetUserId,
      actionType: r.actionType,
      reason: r.reason,
      contentType: r.contentType,
      contentId: r.contentId,
      createdAt: r.createdAt.toISOString(),
      moderatorEmail: r.moderator.email ?? null,
      targetUserEmail: r.targetUser.email ?? null,
      targetUserDisplayName: r.targetUser.profile?.displayName ?? null,
    }));
    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * @openapi
 * /admin/content/moderation-actions/{id}:
 *   get:
 *     summary: Tek moderation action detayı
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Detay
 *       404:
 *         description: Bulunamadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/content/moderation-actions/:id',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const action = await prisma.moderationAction.findUnique({
      where: { id },
      include: {
        moderator: { select: { email: true } },
        targetUser: { select: { email: true }, include: { profile: { select: { displayName: true } } } },
      },
    });
    if (!action) throw new NotFoundError('Moderation action bulunamadı');
    const data: AdminModerationActionDetailResponse = {
      id: action.id,
      moderatorId: action.moderatorId,
      targetUserId: action.targetUserId,
      actionType: action.actionType,
      reason: action.reason,
      contentType: action.contentType,
      contentId: action.contentId,
      createdAt: action.createdAt.toISOString(),
      updatedAt: action.updatedAt.toISOString(),
      moderatorEmail: action.moderator.email ?? null,
      targetUserEmail: action.targetUser.email ?? null,
      targetUserDisplayName: action.targetUser.profile?.displayName ?? null,
      contentSummary: action.contentType && action.contentId != null ? `${action.contentType}#${action.contentId}` : null,
    };
    return res.json({ success: true, data });
  })
);

/**
 * @openapi
 * /admin/content/tags:
 *   get:
 *     summary: İçerik tag listesi (aggregate veya postId’ye göre)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: postId
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Tag listesi (tag, count)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/content/tags',
  authMiddleware,
  requireAdmin,
  validateQuery(AdminContentTagsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as { limit: number; offset: number; postId?: string; search?: string };
    if (q.postId) {
      const tags = await prisma.contentPostTag.findMany({
        where: { postId: q.postId },
        select: { tag: true },
        distinct: ['tag'],
      });
      const data: AdminContentTagListItem[] = tags.map((t) => ({ tag: t.tag, count: 1 }));
      return res.json({ success: true, data });
    }
    const aggregated = await prisma.contentPostTag.groupBy({
      by: ['tag'],
      _count: { tag: true },
      orderBy: { _count: { tag: 'desc' } },
      take: q.limit,
      skip: q.offset,
    });
    if (q.search) {
      const filtered = aggregated.filter((r) => r.tag.toLowerCase().includes(q.search!.toLowerCase()));
      const data: AdminContentTagListItem[] = filtered.slice(0, q.limit).map((r) => ({ tag: r.tag, count: r._count.tag }));
      return res.json({ success: true, data });
    }
    const data: AdminContentTagListItem[] = aggregated.map((r) => ({ tag: r.tag, count: r._count.tag }));
    return res.json({ success: true, data });
  })
);

export default router;
