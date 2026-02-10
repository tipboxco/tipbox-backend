import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { NotificationService } from '../../application/notification/notification.service';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';

const router = Router();
const notificationService = new NotificationService();

router.use(authMiddleware);

/**
 * @openapi
 * /collections/badges/{badgeId}/reminder:
 *   post:
 *     summary: Badge için hatırlatma ayarla
 *     description: Belirtilen zamanda (veya varsayılan 1 gün sonra) badge görevi tamamlama hatırlatması gönderilir. Aynı badge için mevcut hatırlatma varsa güncellenir.
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: badgeId
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
 *               remindAt:
 *                 type: string
 *                 format: date-time
 *                 description: Hatırlatma zamanı (ISO 8601). Yoksa varsayılan 1 gün sonra.
 *     responses:
 *       200:
 *         description: Hatırlatma ayarlandı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 remindAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Geçersiz badgeId veya remindAt
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       404:
 *         description: Badge bulunamadı
 */
router.post(
  '/badges/:badgeId/reminder',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const badgeId = req.params.badgeId;
    if (!badgeId) {
      return res.status(400).json({ message: 'badgeId is required' });
    }

    const prisma = getPrisma();
    const badge = await prisma.badge.findUnique({
      where: { id: badgeId },
      select: { id: true },
    });
    if (!badge) {
      return res.status(404).json({ message: 'Badge not found' });
    }

    let remindAt: Date;
    const remindAtRaw = req.body.remindAt;
    if (remindAtRaw && typeof remindAtRaw === 'string') {
      remindAt = new Date(remindAtRaw);
      if (Number.isNaN(remindAt.getTime())) {
        return res.status(400).json({ message: 'remindAt must be a valid ISO date string' });
      }
      if (remindAt <= new Date()) {
        return res.status(400).json({ message: 'remindAt must be in the future' });
      }
    } else {
      remindAt = new Date();
      remindAt.setDate(remindAt.getDate() + 1);
    }

    const result = await notificationService.setBadgeReminder(
      String(userId),
      badgeId,
      remindAt
    );
    return res.json(result);
  })
);

export default router;
