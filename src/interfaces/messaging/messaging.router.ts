import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { MessagingService } from '../../application/messaging/messaging.service';
import { SupportRequestService } from '../../application/messaging/support-request.service';
import { SupportRequestStatus } from '../../domain/messaging/support-request-status.enum';
import { SendTipsCreate, SupportRequestCreate, SupportType } from './messaging.dto';

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
/**
 * @openapi
 * /messages/feed:
 *   get:
 *     summary: Message Feed - Kullanıcının mesaj feed'ini getirir
 *     description: Kullanıcının mesajlarını, TIPS'leri ve 1-on-1 Support Request'lerini birleşik olarak getirir.
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Döndürülecek maksimum feed item sayısı.
 *     responses:
 *       200:
 *         description: Message feed başarıyla getirildi.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageFeed'
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/feed',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    let limit: number | undefined;
    if (typeof req.query.limit === 'string') {
      const parsed = parseInt(req.query.limit, 10);
      if (!Number.isNaN(parsed)) {
        limit = Math.min(Math.max(parsed, 1), 100);
      }
    }

    const feed = await messagingService.getUserMessageFeed(String(userId), limit);
    res.json(feed);
  }),
);

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
 *     description: Kullanıcıya direkt mesaj gönderir. Mesaj gönderildiğinde `new_message` ve `message_sent` socket event'leri tetiklenir.
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
 *                   threadId:
 *                     type: string
 *                     format: uuid
 *                     nullable: true
 *                     description: |
 *                       Support request'in bağlı olduğu support thread ID.
 *                       - pending: null (henüz accept edilmemiş, thread oluşturulmamış)
 *                       - accepted: support thread ID (accept edildiğinde oluşturulan unique thread ID)
 *                       - rejected: null
 *                       Her support request accept edildiğinde yeni bir unique thread oluşturulur ve threadId bu thread'e kaydedilir.
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
 *     description: Bir kullanıcıya 1-on-1 destek talebi oluşturur. Talep oluşturulduğunda `new_message` socket event'i tetiklenir.
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - senderUserId
 *               - recipientUserId
 *               - type
 *               - message
 *               - amount
 *               - status
 *               - timestamp
 *             properties:
 *               senderUserId:
 *                 type: string
 *                 format: uuid
 *                 description: Destek talebi gönderen kullanıcının ID'si (JWT token'daki userId ile eşleşmeli)
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               recipientUserId:
 *                 type: string
 *                 format: uuid
 *                 description: Destek talebi gönderilecek kullanıcının ID'si
 *                 example: "660e8400-e29b-41d4-a716-446655440001"
 *               type:
 *                 $ref: '#/components/schemas/SupportType'
 *                 description: Destek talebi tipi
 *                 example: "GENERAL"
 *               message:
 *                 type: string
 *                 description: Destek talebi mesajı
 *                 example: "Yardıma ihtiyacım var"
 *               amount:
 *                 type: string
 *                 description: Destek talebi için önerilen miktar (string formatında)
 *                 example: "50.00"
 *               status:
 *                 $ref: '#/components/schemas/SupportRequestStatus'
 *                 description: Destek talebi durumu (genellikle 'pending' olarak gönderilir)
 *                 example: "pending"
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: İşlem zamanı (ISO 8601 formatında)
 *                 example: "2024-01-15T10:30:00Z"
 *           example:
 *             senderUserId: "550e8400-e29b-41d4-a716-446655440000"
 *             recipientUserId: "660e8400-e29b-41d4-a716-446655440001"
 *             type: "GENERAL"
 *             message: "Yardıma ihtiyacım var"
 *             amount: "50.00"
 *             status: "pending"
 *             timestamp: "2024-01-15T10:30:00Z"
 *     responses:
 *       201:
 *         description: Destek talebi başarıyla oluşturuldu
 *       400:
 *         description: Geçersiz istek (eksik veya hatalı parametreler)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   examples:
 *                     missingSender:
 *                       value: "senderUserId is required"
 *                     missingRecipient:
 *                       value: "recipientUserId is required"
 *                     missingType:
 *                       value: "type is required"
 *                     missingMessage:
 *                       value: "message is required"
 *                     missingAmount:
 *                       value: "amount is required"
 *                     missingStatus:
 *                       value: "status is required"
 *                     missingTimestamp:
 *                       value: "timestamp is required"
 *                     invalidAmount:
 *                       value: "amount must be a valid number string"
 *                     invalidTimestamp:
 *                       value: "Invalid timestamp format. Expected ISO 8601 format (e.g., 2024-01-15T10:30:00Z)"
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       403:
 *         description: senderUserId JWT token'daki userId ile eşleşmiyor
 */
router.post(
  '/support-requests',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const senderId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!senderId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { senderUserId, recipientUserId, type, message, amount, status, timestamp } = req.body as SupportRequestCreate;
    
    // Validate required fields
    if (!senderUserId || typeof senderUserId !== 'string') {
      return res.status(400).json({ message: 'senderUserId is required' });
    }
    
    // Security check: senderUserId must match JWT token
    if (String(senderId) !== String(senderUserId)) {
      return res.status(403).json({ message: 'senderUserId does not match authenticated user' });
    }
    
    if (!recipientUserId || typeof recipientUserId !== 'string') {
      return res.status(400).json({ message: 'recipientUserId is required' });
    }
    
    if (!type || typeof type !== 'string') {
      return res.status(400).json({ message: 'type is required' });
    }
    
    const supportType = type.toUpperCase();
    if (supportType !== 'GENERAL' && supportType !== 'TECHNICAL' && supportType !== 'PRODUCT') {
      return res.status(400).json({ message: 'type must be one of: GENERAL, TECHNICAL, PRODUCT' });
    }
    
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ message: 'message is required' });
    }
    
    if (!amount || typeof amount !== 'string') {
      return res.status(400).json({ message: 'amount is required and must be a string' });
    }
    
    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount < 0) {
      return res.status(400).json({ message: 'amount must be a valid number string' });
    }
    
    if (!status || typeof status !== 'string') {
      return res.status(400).json({ message: 'status is required' });
    }
    
    const requestStatus = status.toLowerCase();
    if (requestStatus !== 'pending' && requestStatus !== 'accepted' && requestStatus !== 'rejected') {
      return res.status(400).json({ message: 'status must be one of: pending, accepted, rejected' });
    }
    
    // Note: Backend will set status to PENDING regardless of what's sent, but we validate it
    // The actual status is managed by the backend (PENDING initially)
    
    if (!timestamp || typeof timestamp !== 'string') {
      return res.status(400).json({ message: 'timestamp is required' });
    }
    
    // Validate timestamp format
    const timestampDate = new Date(timestamp);
    if (isNaN(timestampDate.getTime())) {
      return res.status(400).json({ message: 'Invalid timestamp format. Expected ISO 8601 format (e.g., 2024-01-15T10:30:00Z)' });
    }

    await supportRequestService.createSupportRequest(String(senderId), {
      recipientUserId,
      type: supportType as SupportType,
      message,
      amount: numericAmount,
    });

    return res.status(201).end();
  }),
);

/**
 * @openapi
 * /messages/support-requests/{requestId}/accept:
 *   post:
 *     summary: Support request'i accept et
 *     description: |
 *       Expert, support request'i accept eder ve yeni bir support thread oluşturulur.
 *       
 *       **İşlem Adımları:**
 *       1. Support request status'u "accepted" olarak güncellenir
 *       2. Yeni bir support thread oluşturulur (is_support_thread=true)
 *       3. Oluşturulan thread ID'si DMRequest.threadId field'ına kaydedilir
 *       4. Her support request için unique thread oluşturulur (aynı kullanıcılar arasında birden fazla request varsa her biri için ayrı thread)
 *       
 *       **Response:**
 *       - requestId: Accept edilen support request ID'si
 *       - threadId: Oluşturulan support thread ID'si (bu ID ile GET /messages/{threadId} çağrılarak support chat mesajları yüklenir)
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Accept edilecek support request ID'si
 *     responses:
 *       200:
 *         description: Support request başarıyla accept edildi ve unique support thread oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requestId:
 *                   type: string
 *                   format: uuid
 *                   description: Accept edilen support request ID'si
 *                 threadId:
 *                   type: string
 *                   format: uuid
 *                   description: Oluşturulan support thread ID'si. Bu ID ile GET /messages/{threadId} endpoint'i çağrılarak support chat mesajları yüklenir.
 *             example:
 *               requestId: "ccef8c37-cc75-4141-8b99-573ca8d277bb"
 *               threadId: "1f2d6cb7-aef1-4221-8dba-2cd0601faae3"
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only recipient can accept
 *       404:
 *         description: Support request not found
 */
router.post(
  '/support-requests/:requestId/accept',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const expertUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!expertUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { requestId } = req.params;
    if (!requestId) {
      return res.status(400).json({ message: 'requestId is required' });
    }

    try {
      const result = await supportRequestService.acceptSupportRequest(requestId, String(expertUserId));
      return res.status(200).json(result);
    } catch (error: any) {
      if (error.message === 'Support request not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message.includes('Only the recipient')) {
        return res.status(403).json({ message: error.message });
      }
      if (error.message.includes('Only pending')) {
        return res.status(400).json({ message: error.message });
      }
      throw error;
    }
  }),
);

/**
 * @openapi
 * /messages/support-requests/{requestId}/reject:
 *   post:
 *     summary: Support request'i reject et
 *     description: Expert, support request'i reject eder.
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Support request başarıyla reject edildi
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only recipient can reject
 *       404:
 *         description: Support request not found
 */
router.post(
  '/support-requests/:requestId/reject',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const expertUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!expertUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { requestId } = req.params;
    if (!requestId) {
      return res.status(400).json({ message: 'requestId is required' });
    }

    try {
      await supportRequestService.rejectSupportRequest(requestId, String(expertUserId));
      return res.status(200).json({ message: 'Support request rejected' });
    } catch (error: any) {
      if (error.message === 'Support request not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message.includes('Only the recipient')) {
        return res.status(403).json({ message: error.message });
      }
      if (error.message.includes('Only pending')) {
        return res.status(400).json({ message: error.message });
      }
      throw error;
    }
  }),
);

/**
 * @openapi
 * /messages/support-requests/{requestId}/cancel:
 *   post:
 *     summary: Support request'i iptal et (sender)
 *     description: Destek talebini gönderen kullanıcı, talep kabul edilmeden önce iptal edebilir.
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Support request başarıyla iptal edildi
 *       400:
 *         description: Sadece pending talepler iptal edilebilir
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only sender can cancel
 *       404:
 *         description: Support request not found
 */
router.post(
  '/support-requests/:requestId/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const senderId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!senderId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { requestId } = req.params;
    if (!requestId) {
      return res.status(400).json({ message: 'requestId is required' });
    }

    try {
      await supportRequestService.cancelSupportRequest(requestId, String(senderId));
      return res.status(200).json({ message: 'Support request cancelled' });
    } catch (error: any) {
      if (error.message === 'Support request not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message.includes('Only the sender')) {
        return res.status(403).json({ message: error.message });
      }
      if (error.message.includes('Only pending')) {
        return res.status(400).json({ message: error.message });
      }
      throw error;
    }
  }),
);

/**
 * @openapi
 * /messages/tips:
 *   post:
 *     summary: Kullanıcıya TIPS gönder
 *     description: Bir kullanıcıya TIPS gönderir. TIPS gönderildiğinde `new_message` socket event'i messageType alanı "send-tips" olacak şekilde tetiklenir.
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - senderUserId
 *               - recipientUserId
 *               - message
 *               - amount
 *               - timestamp
 *             properties:
 *               senderUserId:
 *                 type: string
 *                 format: uuid
 *                 description: TIPS gönderen kullanıcının ID'si (JWT token'daki userId ile eşleşmeli)
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               recipientUserId:
 *                 type: string
 *                 format: uuid
 *                 description: TIPS gönderilecek kullanıcının ID'si
 *                 example: "660e8400-e29b-41d4-a716-446655440001"
 *               message:
 *                 type: string
 *                 description: TIPS ile birlikte gönderilecek mesaj
 *                 example: "Teşekkürler!"
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 description: Gönderilecek TIPS miktarı (pozitif sayı olmalı)
 *                 example: 100.50
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: İşlem zamanı (ISO 8601 formatında)
 *                 example: "2024-01-15T10:30:00Z"
 *           example:
 *             senderUserId: "550e8400-e29b-41d4-a716-446655440000"
 *             recipientUserId: "660e8400-e29b-41d4-a716-446655440001"
 *             message: "Teşekkürler!"
 *             amount: 100.50
 *             timestamp: "2024-01-15T10:30:00Z"
 *     responses:
 *       201:
 *         description: TIPS başarıyla gönderildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "TIPS sent successfully"
 *       400:
 *         description: Geçersiz istek (eksik veya hatalı parametreler)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   examples:
 *                     missingRecipient:
 *                       value: "recipientUserId is required"
 *                     invalidAmount:
 *                       value: "amount must be a positive number"
 *                     missingMessage:
 *                       value: "message is required"
 *                     missingTimestamp:
 *                       value: "timestamp is required"
 *                     invalidTimestamp:
 *                       value: "Invalid timestamp format. Expected ISO 8601 format (e.g., 2024-01-15T10:30:00Z)"
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       403:
 *         description: senderUserId JWT token'daki userId ile eşleşmiyor
 */
router.post(
  '/tips',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const senderId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!senderId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { senderUserId, recipientUserId, message, amount, timestamp } = req.body as SendTipsCreate;
    
    // Validate required fields
    if (!senderUserId || typeof senderUserId !== 'string') {
      return res.status(400).json({ message: 'senderUserId is required' });
    }
    
    // Security check: senderUserId must match JWT token
    if (String(senderId) !== String(senderUserId)) {
      return res.status(403).json({ message: 'senderUserId does not match authenticated user' });
    }
    
    if (!recipientUserId || typeof recipientUserId !== 'string') {
      return res.status(400).json({ message: 'recipientUserId is required' });
    }
    
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ message: 'message is required' });
    }
    
    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: 'amount must be a positive number' });
    }
    
    if (!timestamp || typeof timestamp !== 'string') {
      return res.status(400).json({ message: 'timestamp is required' });
    }
    
    // Validate timestamp format
    const timestampDate = new Date(timestamp);
    if (isNaN(timestampDate.getTime())) {
      return res.status(400).json({ message: 'Invalid timestamp format. Expected ISO 8601 format (e.g., 2024-01-15T10:30:00Z)' });
    }

    await messagingService.sendTips(
      String(senderId),
      recipientUserId,
      numericAmount,
      message,
    );

    return res.status(201).end();
  }),
);

/**
 * @openapi
 * /messages/{messageId}/read:
 *   post:
 *     summary: Mesajı okundu olarak işaretle
 *     description: Belirtilen mesajı okundu olarak işaretler. Mesaj okundu olarak işaretlendiğinde `message_read` socket event'i tetiklenir.
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Mesaj ID
 *     responses:
 *       200:
 *         description: Mesaj başarıyla okundu olarak işaretlendi.
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       403:
 *         description: Mesaj thread'ine erişim yetkisi yok.
 *       404:
 *         description: Mesaj bulunamadı.
 */
router.post(
  '/:messageId/read',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { messageId } = req.params;
    if (!messageId) {
      return res.status(400).json({ message: 'messageId is required' });
    }

    try {
      await messagingService.markMessageAsRead(messageId, String(userId));
      return res.status(200).json({ message: 'Message marked as read' });
    } catch (error: any) {
      if (error.message === 'Message not found' || error.message === 'Thread not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'User is not a participant of this thread') {
        return res.status(403).json({ message: error.message });
      }
      throw error;
    }
  }),
);

// DEPRECATED ENDPOINTS (Removed):
// - GET /messages/:supportThreadId/support-chat
//   → Artık GET /messages/:threadId kullanılıyor (thread tipine göre otomatik olarak doğru veri döndürülüyor)
// - POST /messages/:supportThreadId/support-chat
//   → Artık socket üzerinden send_support_message event'i kullanılıyor

/**
 * @openapi
 * /messages/{threadId}:
 *   get:
 *     summary: Thread mesajlarını getir (DM veya Support Chat)
 *     description: |
 *       Belirtilen thread'deki mesajları getirir. Thread tipine göre otomatik olarak doğru veri döndürülür:
 *       
 *       **DM Thread (is_support_thread=false):**
 *       - type: "message" - DM context'li mesajlar
 *       - type: "send-tips" - TIPS transferleri
 *       - type: "support-request" - Support request'ler (pending/accepted/rejected)
 *         - pending: threadId = null (henüz accept edilmemiş)
 *         - accepted: threadId = support thread ID (accept edildiğinde oluşturulan unique thread ID)
 *         - rejected: threadId = null
 *       
 *       **Support Chat Thread (is_support_thread=true):**
 *       - type: "message" - Sadece SUPPORT context'li mesajlar (TIPS ve support-request yok)
 *       - Her support request accept edildiğinde yeni bir unique thread oluşturulur
 *       
 *       Kullanıcının thread'e erişim yetkisi olmalıdır.
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: threadId
 *         required: true
 *         schema:
 *           type: string
 *         description: Thread ID (DM thread veya Support Chat thread ID'si)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Döndürülecek maksimum mesaj sayısı.
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Atlanacak mesaj sayısı (pagination için).
 *     responses:
 *       200:
 *         description: Thread mesajları başarıyla getirildi. Thread tipine göre farklı içerik döner.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MessageFeedItem'
 *             examples:
 *               dm-thread:
 *                 summary: DM Thread örneği
 *                 value:
 *                   - id: "msg-123"
 *                     type: "message"
 *                     data:
 *                       id: "msg-123"
 *                       sender:
 *                         id: "user-1"
 *                         senderName: "Ahmet Yılmaz"
 *                         senderTitle: "Expert"
 *                         senderAvatar: "https://example.com/avatar.jpg"
 *                       lastMessage: "Merhaba!"
 *                       timestamp: "2024-01-15T10:30:00Z"
 *                       isUnread: false
 *                   - id: "tips-456"
 *                     type: "send-tips"
 *                     data:
 *                       id: "tips-456"
 *                       sender:
 *                         id: "user-1"
 *                         senderName: "Ahmet Yılmaz"
 *                         senderTitle: "Expert"
 *                         senderAvatar: "https://example.com/avatar.jpg"
 *                       amount: 100.50
 *                       message: "Teşekkürler!"
 *                       timestamp: "2024-01-15T10:25:00Z"
 *                   - id: "req-789"
 *                     type: "support-request"
 *                     data:
 *                       id: "req-789"
 *                       sender:
 *                         id: "user-1"
 *                         senderName: "Ahmet Yılmaz"
 *                         senderTitle: "Expert"
 *                         senderAvatar: "https://example.com/avatar.jpg"
 *                       type: "GENERAL"
 *                       message: "Yardıma ihtiyacım var"
 *                       amount: 50
 *                       status: "accepted"
 *                       timestamp: "2024-01-15T10:20:00Z"
 *                       threadId: "1f2d6cb7-aef1-4221-8dba-2cd0601faae3"
 *                   - id: "req-790"
 *                     type: "support-request"
 *                     data:
 *                       id: "req-790"
 *                       sender:
 *                         id: "user-1"
 *                         senderName: "Ahmet Yılmaz"
 *                         senderTitle: "Expert"
 *                         senderAvatar: "https://example.com/avatar.jpg"
 *                       type: "TECHNICAL"
 *                       message: "Teknik destek istiyorum"
 *                       amount: 100
 *                       status: "pending"
 *                       timestamp: "2024-01-15T10:15:00Z"
 *                       threadId: null
 *               support-chat-thread:
 *                 summary: Support Chat Thread örneği
 *                 value:
 *                   - id: "msg-456"
 *                     type: "message"
 *                     data:
 *                       id: "msg-456"
 *                       sender:
 *                         id: "user-1"
 *                         senderName: "Ahmet Yılmaz"
 *                         senderTitle: "Expert"
 *                         senderAvatar: "https://example.com/avatar.jpg"
 *                       lastMessage: "Smartwatch kurulumu için yardıma ihtiyacım var."
 *                       timestamp: "2024-01-15T10:30:00Z"
 *                       isUnread: false
 *                   - id: "msg-457"
 *                     type: "message"
 *                     data:
 *                       id: "msg-457"
 *                       sender:
 *                         id: "user-2"
 *                         senderName: "Ayşe Demir"
 *                         senderTitle: "Support Expert"
 *                         senderAvatar: "https://example.com/avatar2.jpg"
 *                       lastMessage: "Size yardımcı olabilirim. Hangi model?"
 *                       timestamp: "2024-01-15T10:31:00Z"
 *                       isUnread: false
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       403:
 *         description: Thread'e erişim yetkisi yok.
 *       404:
 *         description: Thread bulunamadı.
 */
router.get(
  '/:threadId',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { threadId } = req.params;
    if (!threadId) {
      return res.status(400).json({ message: 'threadId is required' });
    }

    let limit: number | undefined;
    if (typeof req.query.limit === 'string') {
      const parsed = parseInt(req.query.limit, 10);
      if (!Number.isNaN(parsed)) {
        limit = Math.min(Math.max(parsed, 1), 100);
      }
    }

    let offset: number | undefined;
    if (typeof req.query.offset === 'string') {
      const parsed = parseInt(req.query.offset, 10);
      if (!Number.isNaN(parsed)) {
        offset = Math.max(parsed, 0);
      }
    }

    try {
      const feedItems = await messagingService.getThreadMessages(
        threadId,
        String(userId),
        limit || 100,
        offset || 0
      );
      return res.status(200).json(feedItems);
    } catch (error: any) {
      if (error.message === 'Thread not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === 'User is not a participant of this thread') {
        return res.status(403).json({ message: error.message });
      }
      throw error;
    }
  }),
);

export default router;
