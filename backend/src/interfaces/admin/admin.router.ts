import { Router, Request, Response } from 'express';
import { authMiddleware } from '../auth/auth.middleware';
import { requireAdmin } from '../../infrastructure/middleware/rbac.middleware';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { getAdminStats } from '../../application/admin/admin-stats.service';
import type {
  AdminStatsResponse,
  AdminUserListItem,
  AdminUserDetailResponse,
  AdminLogListItem,
  PaginationMeta,
} from './admin.dto';
import logger from '../../infrastructure/logger/logger';
import { NotFoundError } from '../../infrastructure/errors/custom-errors';

const router = Router();
const prisma = getPrisma();

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

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          status: true,
          emailVerified: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.user.count(),
    ]);

    const data: AdminUserListItem[] = users.map((u) => ({
      id: u.id,
      email: u.email,
      status: u.status,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt.toISOString(),
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
      },
    });
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }
    const data: AdminUserDetailResponse = {
      id: user.id,
      email: user.email,
      status: user.status,
      emailVerified: user.emailVerified,
      auth0Id: user.auth0Id,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
    return res.json({ success: true, data });
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

export default router;
