import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { MessagingService } from '../../application/messaging/messaging.service';
import { SupportRequestService } from '../../application/messaging/support-request.service';
import { SupportRequestStatus } from '../../domain/messaging/support-request-status.enum';

const router = Router();
const messagingService = new MessagingService();
const supportRequestService = new SupportRequestService();

router.use(authMiddleware);

/**
 * @openapi
 * /messages:
 *   get:
 *     summary: Messages - Kullanıcının mesaj kutusunu getirir
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

/**
 * @openapi
 * /messages:
 *   post:
 *     summary: Direkt mesaj gönder
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ recipientUserId, message ]
 *             properties:
 *               recipientUserId: { type: string }
 *               message: { type: string }
 *     responses:
 *       201:
 *         description: Mesaj gönderildi
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const senderId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!senderId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const { recipientUserId, message } = req.body || {};
    if (!recipientUserId || typeof recipientUserId !== 'string') {
      return res.status(400).json({ message: 'recipientUserId is required' });
    }
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ message: 'message is required' });
    }
    await messagingService.sendDirectMessage(String(senderId), recipientUserId, message);
    return res.status(201).end();
  }),
);

/**
 * @openapi
 * /messages/support-requests:
 *   get:
 *     summary: 1-On-1 Support Request - Kullanıcının birebir destek sohbetlerini getirir
 *     description: Oturum açmış kullanıcının geçmiş ve devam eden birebir destek sohbetlerinin listesini döner.
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, active, completed]
 *         description: Destek sohbetlerinin durumuna göre filtreleme yapar.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Kullanıcı adı, unvanı veya istek açıklamasında arama yapar.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Döndürülecek maksimum destek sohbeti sayısı.
 *     responses:
 *       200:
 *         description: Birebir destek sohbetleri başarıyla listelendi.
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
 *                   userName:
 *                     type: string
 *                   userTitle:
 *                     type: string
 *                     nullable: true
 *                   userAvatar:
 *                     type: string
 *                     nullable: true
 *                   requestDescription:
 *                     type: string
 *                   status:
 *                     type: string
 *                     enum: [active, pending, completed]
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/support-requests',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Parse status filter
    let status: SupportRequestStatus | undefined;
    if (typeof req.query.status === 'string') {
      const statusValue = req.query.status.toLowerCase();
      if (Object.values(SupportRequestStatus).includes(statusValue as SupportRequestStatus)) {
        status = statusValue as SupportRequestStatus;
      }
    }

    // Parse search query
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    
    // Debug: Log search parameter
    if (search) {
      console.log('[Support Requests] Search parameter received:', search);
    }

    // Parse limit
    let limit: number | undefined;
    if (typeof req.query.limit === 'string') {
      const parsed = parseInt(req.query.limit, 10);
      if (!Number.isNaN(parsed)) {
        limit = Math.min(Math.max(parsed, 1), 100);
      }
    }

    const supportRequests = await supportRequestService.getUserSupportRequests(String(userId), {
      status,
      search,
      limit,
    });
    
    // Debug: Log results count
    if (search) {
      console.log('[Support Requests] Search results count:', supportRequests.length);
    }

    res.json(supportRequests);
  }),
);

/**
 * @openapi
 * /messages/support-requests:
 *   post:
 *     summary: 1-on-1 destek talebi oluştur
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ recipientUserId, message, amount ]
 *             properties:
 *               recipientUserId: { type: string }
 *               type: { type: string }
 *               message: { type: string }
 *               amount: { type: number }
 *     responses:
 *       201:
 *         description: Talep oluşturuldu
 */
router.post(
  '/support-requests',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const senderId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!senderId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { recipientUserId, type, message, amount } = req.body || {};
    if (!recipientUserId || typeof recipientUserId !== 'string') {
      return res.status(400).json({ message: 'recipientUserId is required' });
    }
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ message: 'message is required' });
    }
    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount < 0) {
      return res.status(400).json({ message: 'amount must be a non-negative number' });
    }

    await supportRequestService.createSupportRequest(String(senderId), {
      recipientUserId,
      type: typeof type === 'string' ? type : 'GENERAL',
      message,
      amount: numericAmount,
    });

    return res.status(201).end();
  }),
);

/**
 * @openapi
 * /messages/tips:
 *   post:
 *     summary: Kullanıcıya TIPS gönder
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ recipientUserId, amount ]
 *             properties:
 *               recipientUserId: { type: string }
 *               message: { type: string }
 *               amount: { type: number }
 *     responses:
 *       201:
 *         description: TIPS gönderildi
 */
router.post(
  '/tips',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const senderId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!senderId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { recipientUserId, amount, message } = req.body || {};
    if (!recipientUserId || typeof recipientUserId !== 'string') {
      return res.status(400).json({ message: 'recipientUserId is required' });
    }
    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: 'amount must be a positive number' });
    }

    await messagingService.sendTips(
      String(senderId),
      recipientUserId,
      numericAmount,
      typeof message === 'string' ? message : undefined,
    );

    return res.status(201).end();
  }),
);

export default router;

