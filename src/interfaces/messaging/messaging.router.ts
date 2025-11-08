import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { MessagingService } from '../../application/messaging/messaging.service';

const router = Router();
const messagingService = new MessagingService();

router.use(authMiddleware);

/**
 * @openapi
 * /messages:
 *   get:
 *     summary: Kullanıcının mesaj kutusunu getirir
 *     description: Oturum açmış kullanıcının DM mesaj kutusundaki thread listesini döner.
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Karşı tarafın adı, unvanı veya son mesaj içeriğinde arama yapar.
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *         description: Sadece okunmamış mesajı olan thread'leri döndürür.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Döndürülecek maksimum thread sayısı.
 *     responses:
 *       200:
 *         description: Mesaj kutusu başarıyla listelendi.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   senderName:
 *                     type: string
 *                   senderTitle:
 *                     type: string
 *                     nullable: true
 *                   senderAvatar:
 *                     type: string
 *                     nullable: true
 *                   lastMessage:
 *                     type: string
 *                     nullable: true
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                   isUnread:
 *                     type: boolean
 *                   unreadCount:
 *                     type: integer
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const unreadOnlyParam = req.query.unreadOnly;
    const unreadOnly = Array.isArray(unreadOnlyParam)
      ? unreadOnlyParam.some((value) => value === 'true')
      : unreadOnlyParam === 'true';

    let limit: number | undefined;
    if (typeof req.query.limit === 'string') {
      const parsed = parseInt(req.query.limit, 10);
      if (!Number.isNaN(parsed)) {
        limit = Math.min(Math.max(parsed, 1), 100);
      }
    }

    const inbox = await messagingService.getUserInboxMessages(String(userId), {
      search,
      unreadOnly,
      limit,
    });

    res.json(inbox);
  }),
);

export default router;

