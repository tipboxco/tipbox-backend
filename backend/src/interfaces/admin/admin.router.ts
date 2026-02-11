import { Router, Request, Response } from 'express';
import { authMiddleware } from '../auth/auth.middleware';
import { requireAdmin } from '../../infrastructure/middleware/rbac.middleware';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { validateBody } from '../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { getAdminStats } from '../../application/admin/admin-stats.service';
import { AuthService } from '../../application/auth/auth.service';
import { isAdmin } from '../../infrastructure/auth/role-checker';
import { ProfilePrismaRepository } from '../../infrastructure/repositories/profile-prisma.repository';
import { UserAvatarPrismaRepository } from '../../infrastructure/repositories/user-avatar-prisma.repository';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import { LoginSchema } from '../auth/auth.schemas';
import type { AdminStatsResponse, AdminLogListItem, PaginationMeta } from './dtos/admin-common.dto';

// Import sub-routers
import adminUsersRouter from './routers/admin-users.router';
import adminEventsRouter from './routers/admin-events.router';
import adminBadgesRouter from './routers/admin-badges.router';
import adminContentRouter from './routers/admin-content.router';
import adminGamificationRouter from './routers/admin-gamification.router';
import adminPaymentsRouter from './routers/admin-payments.router';
import adminWalletsRouter from './routers/admin-wallets.router';

const router = Router();
const prisma = getPrisma();
const authService = new AuthService();
const profileRepo = new ProfilePrismaRepository();
const avatarRepo = new UserAvatarPrismaRepository();

/**
 * @openapi
 * /admin/login:
 *   post:
 *     summary: Admin login
 *     tags: [Admin - Auth]
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
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
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
 *     tags: [Admin - Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: İstatistikler
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

    const data: AdminLogListItem[] = logs.map((log) => ({
      id: log.id,
      adminId: log.adminId,
      action: log.action,
      description: log.description,
      entityType: log.entityType,
      entityId: log.entityId,
      createdAt: log.createdAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit, offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * Mount sub-routers
 * Each sub-router handles a specific domain with auth middleware applied here
 */
router.use('/users', authMiddleware, requireAdmin, adminUsersRouter);
router.use('/events', authMiddleware, requireAdmin, adminEventsRouter);
router.use('/badges', authMiddleware, requireAdmin, adminBadgesRouter);
router.use('/collections', authMiddleware, requireAdmin, adminBadgesRouter); // Collections use badges router
router.use('/content', authMiddleware, requireAdmin, adminContentRouter);
router.use('/gamification', authMiddleware, requireAdmin, adminGamificationRouter);
router.use('/action-logs', authMiddleware, requireAdmin, adminGamificationRouter); // Action logs in gamification
router.use('/payments', authMiddleware, requireAdmin, adminPaymentsRouter);
router.use('/wallets', authMiddleware, requireAdmin, adminWalletsRouter);

export default router;
