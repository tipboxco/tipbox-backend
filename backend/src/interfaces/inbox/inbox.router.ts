import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { MessagingService } from '../../application/messaging/messaging.service';
import { SupportRequestService } from '../../application/messaging/support-request.service';
import { SupportRequestStatus } from '../../domain/messaging/support-request-status.enum';
import { SendTipsCreate, SupportRequestCreate, SupportType } from './inbox.dto';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import { getErrorMessage, hasErrorMessage, errorMessageIncludes } from '../../infrastructure/errors/error-helper';
import { S3Service } from '../../infrastructure/s3/s3.service';
import logger from '../../infrastructure/logger/logger';

const router = Router();
const messagingService = new MessagingService();
const supportRequestService = new SupportRequestService();
const userRepo = new UserPrismaRepository();
const s3Service = new S3Service();

// Multer configuration for media uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit per file
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    // Allow images, videos, audio, and files
    const allowedMimeTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (file.mimetype && allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

router.use(authMiddleware);

/**
 * @openapi
 * /inbox:
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
 *         name: threadType
 *         schema:
 *           type: string
 *           enum: [DM, SUPPORT, ALL]
 *           default: ALL
 *         description: Thread tipine göre filtreleme (DM, SUPPORT veya tümü)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Döndürülecek maksimum thread sayısı.
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Pagination cursor (timestamp) - bu timestamp'ten önceki (daha eski) thread'ler getirilir. İlk yüklemede boş bırakılır.
 *     responses:
 *       200:
 *         description: Mesaj kutusu başarıyla listelendi. Cursor-based pagination ile WhatsApp benzeri çalışır.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         description: Thread ID
 *                       recipientUserId:
 *                         type: string
 *                         format: uuid
 *                         description: Karşı tarafın (diğer kullanıcının) ID'si - MessageDetail'e navigate etmek için kullanılır
 *                       senderName:
 *                         type: string
 *                       senderTitle:
 *                         type: string
 *                         nullable: true
 *                       senderAvatar:
 *                         type: string
 *                         nullable: true
 *                       lastMessage:
 *                         type: string
 *                         nullable: true
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       isUnread:
 *                         type: boolean
 *                       unreadCount:
 *                         type: integer
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     cursor:
 *                       type: string
 *                       format: date-time
 *                       description: Sonraki sayfa için cursor (timestamp)
 *                     hasMore:
 *                       type: boolean
 *                       description: Daha fazla thread var mı?
 *                     limit:
 *                       type: integer
 *                       description: Sayfa başına thread sayısı
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
/**
 * @openapi
 * /inbox/feed:
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
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Pagination cursor (timestamp) - bu timestamp'ten önceki (daha eski) feed item'ları getirilir. İlk yüklemede boş bırakılır.
 *     responses:
 *       200:
 *         description: Message feed başarıyla getirildi. Cursor-based pagination ile WhatsApp benzeri çalışır.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MessageFeedItem'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     cursor:
 *                       type: string
 *                       format: date-time
 *                       description: Sonraki sayfa için cursor (timestamp)
 *                     hasMore:
 *                       type: boolean
 *                       description: Daha fazla feed item var mı?
 *                     limit:
 *                       type: integer
 *                       description: Sayfa başına feed item sayısı
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/feed',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
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

    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const result = await messagingService.getUserMessageFeed(String(userId), limit, cursor);
    return res.json({
      items: result.items,
      pagination: {
        cursor: result.nextCursor,
        hasMore: result.hasMore,
        limit: limit || 50,
      },
    });
  }),
);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // UUID format validation for userId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const userIdStr = String(userId).trim();
    if (!uuidRegex.test(userIdStr)) {
      logger.error(`Invalid userId format in GET /inbox: ${userIdStr}`, { userId, userPayload });
      return res.status(400).json({ 
        message: 'Invalid user ID format',
        details: `userId must be a valid UUID format, received: ${userIdStr}` 
      });
    }

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const unreadOnlyParam = req.query.unreadOnly;
    const unreadOnly = Array.isArray(unreadOnlyParam)
      ? unreadOnlyParam.some((value) => value === 'true')
      : unreadOnlyParam === 'true';

    // Parse threadType
    let threadType: 'DM' | 'SUPPORT' | 'ALL' = 'ALL';
    if (typeof req.query.threadType === 'string') {
      const threadTypeValue = req.query.threadType.toUpperCase();
      if (threadTypeValue === 'DM' || threadTypeValue === 'SUPPORT' || threadTypeValue === 'ALL') {
        threadType = threadTypeValue as 'DM' | 'SUPPORT' | 'ALL';
      }
    }

    let limit: number | undefined;
    if (typeof req.query.limit === 'string') {
      const parsed = parseInt(req.query.limit, 10);
      if (!Number.isNaN(parsed)) {
        limit = Math.min(Math.max(parsed, 1), 100);
      }
    }

    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const result = await messagingService.getUserInboxMessages(String(userId), {
      search,
      unreadOnly,
      limit,
      threadType,
      cursor,
    });

    return res.json({
      items: result.items,
      pagination: {
        cursor: result.nextCursor,
        hasMore: result.hasMore,
        limit: limit || 50,
      },
    });
  }),
);

/**
 * @openapi
 * /inbox:
 *   post:
 *     summary: Direkt mesaj gönder (mesaj + fotoğraf desteği ile)
 *     description: |
 *       Kullanıcıya direkt mesaj gönderir. Mesaj ile birlikte fotoğraf da gönderilebilir.
 *       Mesaj gönderildiğinde `new_message` ve `message_sent` socket event'leri tetiklenir.
 *       
 *       İki kullanım şekli:
 *       1. Sadece mesaj: `Content-Type: application/json` ile `{ recipientUserId, message }`
 *       2. Mesaj + fotoğraf: `Content-Type: multipart/form-data` ile `recipientUserId`, `message` (opsiyonel), `media` (file)
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [ recipientUserId ]
 *             properties:
 *               recipientUserId: { type: string }
 *               message: { type: string }
 *               media:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Mesaj gönderildi
 */
router.post(
  '/',
  upload.single('media'),
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const senderId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!senderId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // UUID format validation for senderId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const senderIdStr = String(senderId);
    if (!uuidRegex.test(senderIdStr)) {
      logger.error(`Invalid senderId format: ${senderIdStr}`, { senderId, userPayload });
      return res.status(400).json({ 
        message: 'Invalid sender ID format',
        details: `senderId must be a valid UUID format, received: ${senderIdStr}` 
      });
    }

    const file = (req as any).file;
    const isMultipart = !!file;
    
    let recipientUserId: string;
    let message: string | undefined;

    if (isMultipart) {
      // multipart/form-data
      recipientUserId = req.body.recipientUserId;
      message = req.body.message; // Opsiyonel - sadece fotoğraf da gönderilebilir
    } else {
      // application/json
      const body = req.body || {};
      recipientUserId = body.recipientUserId;
      message = body.message;
    }

    if (!recipientUserId || typeof recipientUserId !== 'string') {
      return res.status(400).json({ message: 'recipientUserId is required' });
    }

    // UUID format validation for recipientUserId
    const recipientUserIdStr = String(recipientUserId).trim();
    if (!uuidRegex.test(recipientUserIdStr)) {
      logger.error(`Invalid recipientUserId format: ${recipientUserIdStr}`, { recipientUserId, body: req.body });
      return res.status(400).json({ 
        message: 'recipientUserId must be a valid UUID format',
        details: `Received: ${recipientUserIdStr}` 
      });
    }

    // Mesaj veya media en az biri olmalı
    if ((!message || message.trim() === '') && !file) {
      return res.status(400).json({ message: 'message or media is required' });
    }

    try {
      // Eğer media varsa, önce thread oluştur, sonra S3'e yükle
      if (file) {
        // Thread oluştur veya mevcut thread'i al (thread bazlı dosya yolu için gerekli)
        const thread = await messagingService.createThreadIfNotExists(senderIdStr, recipientUserIdStr);

        // Auto-detect media type from MIME type
        let detectedMediaType: 'image' | 'video' | 'audio' | 'file' = 'file';
        if (file.mimetype.startsWith('image/')) {
          detectedMediaType = 'image';
        } else if (file.mimetype.startsWith('video/')) {
          detectedMediaType = 'video';
        } else if (file.mimetype.startsWith('audio/')) {
          detectedMediaType = 'audio';
        }

        // Determine file extension
        const mimeToExtension: Record<string, string> = {
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/png': 'png',
          'image/gif': 'gif',
          'image/webp': 'webp',
          'video/mp4': 'mp4',
          'video/webm': 'webp',
          'video/quicktime': 'mov',
          'video/x-msvideo': 'avi',
          'audio/mpeg': 'mp3',
          'audio/mp3': 'mp3',
          'audio/wav': 'wav',
        };

        let fileExtension = 'jpg';
        if (file.mimetype && mimeToExtension[file.mimetype]) {
          fileExtension = mimeToExtension[file.mimetype];
        } else if (file.originalname && file.originalname.includes('.')) {
          const parts = file.originalname.split('.');
          if (parts.length > 1) {
            fileExtension = parts[parts.length - 1].toLowerCase();
          }
        }

        // Create file path - thread bazlı
        const filePath = `messages/threads/${thread.id}/${uuidv4()}.${fileExtension}`;
        
        // Upload to S3
        const mediaUrl = await s3Service.uploadFile(filePath, file.buffer, file.mimetype);
        
        // For images and videos, use the same URL as thumbnail (could generate thumbnails later)
        const thumbnailUrl = (detectedMediaType === 'image' || detectedMediaType === 'video') ? mediaUrl : null;

        // Send message with media
        await messagingService.sendDirectMessageWithMedia(
          senderIdStr,
          recipientUserIdStr,
          message || '', // Mesaj yoksa boş string
          mediaUrl,
          detectedMediaType,
          file.originalname,
          BigInt(file.size),
          thumbnailUrl || undefined
        );

        return res.status(201).json({
          success: true,
          message: 'Message with media sent successfully',
        });
      } else {
        // Sadece text mesaj
        await messagingService.sendDirectMessage(senderIdStr, recipientUserIdStr, message!);
        return res.status(201).json({
          success: true,
          message: 'Message sent successfully',
        });
      }
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      if (hasErrorMessage(error) && (errorMessage.includes('not found') || errorMessage.includes('User not found'))) {
        return res.status(404).json({ message: 'Recipient user not found' });
      }
      logger.error('Send message error:', error);
      throw error;
    }
  }),
);

/**
 * @openapi
 * /inbox/threads:
 *   post:
 *     summary: Thread oluştur veya mevcut thread'i getir
 *     description: |
 *       İki kullanıcı arasında thread oluşturur veya mevcut thread'i döndürür.
 *       Eğer thread zaten varsa, mevcut thread ID'sini döner.
 *       Thread oluşturulduktan sonra mesaj göndermek için bu thread ID'sini kullanabilirsiniz.
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [recipientId]
 *             properties:
 *               recipientId:
 *                 type: string
 *                 description: Mesajlaşmak istediğiniz kullanıcının ID'si
 *     responses:
 *       200:
 *         description: Thread başarıyla oluşturuldu veya mevcut thread bulundu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                   description: Thread ID (mesaj göndermek için kullanılır)
 *                 userOneId:
 *                   type: string
 *                 userTwoId:
 *                   type: string
 *                 isActive:
 *                   type: boolean
 *                 startedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: recipientId eksik veya geçersiz
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       404:
 *         description: Alıcı kullanıcı bulunamadı
 */
router.post(
  '/threads',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const senderId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!senderId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const { recipientId } = req.body || {};
    if (!recipientId || typeof recipientId !== 'string') {
      return res.status(400).json({ message: 'recipientId is required' });
    }

    // Kullanıcı kontrolü
    const recipient = await userRepo.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient user not found' });
    }

    // Thread oluştur veya mevcut thread'i al
    const thread = await messagingService.createThreadIfNotExists(String(senderId), recipientId);
    
    return res.status(200).json({
      id: thread.id,
      userOneId: thread.userOneId,
      userTwoId: thread.userTwoId,
      isActive: thread.isActive,
      startedAt: thread.startedAt,
      isSupportThread: thread.isSupportThread, // Prisma objesi, property kullan
    });
  }),
);

/**
 * @openapi
 * /inbox/threads/{threadId}:
 *   get:
 *     summary: Thread detay bilgisini getir
 *     description: |
 *       Belirtilen thread'in detay bilgilerini döner (userOneId, userTwoId, isSupportThread vb.).
 *       Mobil taraf thread'den diğer kullanıcıyı bulmak için bu endpoint'i kullanabilir.
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: threadId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Thread ID
 *     responses:
 *       200:
 *         description: Thread detay bilgisi başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 userOneId:
 *                   type: string
 *                   format: uuid
 *                 userTwoId:
 *                   type: string
 *                   format: uuid
 *                 isActive:
 *                   type: boolean
 *                 startedAt:
 *                   type: string
 *                   format: date-time
 *                 isSupportThread:
 *                   type: boolean
 *                   description: Support thread mi, normal DM thread mi?
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       403:
 *         description: Thread'e erişim yetkisi yok
 *       404:
 *         description: Thread bulunamadı
 */
router.get(
  '/threads/:threadId',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { threadId } = req.params;
    if (!threadId) {
      return res.status(400).json({ message: 'threadId is required' });
    }

    try {
      // Thread erişim kontrolü
      const hasAccess = await messagingService.validateThreadAccess(threadId, String(userId));
      if (!hasAccess) {
        return res.status(403).json({ message: 'User is not a participant of this thread' });
      }

      // Thread'i getir
      const thread = await messagingService.getThreadById(threadId);
      if (!thread) {
        return res.status(404).json({ message: 'Thread not found' });
      }

      return res.status(200).json({
        id: thread.id,
        userOneId: thread.userOneId,
        userTwoId: thread.userTwoId,
        isActive: thread.isActive,
        startedAt: thread.startedAt.toISOString(),
        isSupportThread: thread.isSupportContext(),
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (message === 'Thread not found') {
        return res.status(404).json({ message });
      }
      throw error;
    }
  }),
);

/**
 * @openapi
 * /inbox/support-requests:
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
 *           enum: [pending, active, awaiting_completion, completed, finalized, reported]
 *         description: Destek sohbetlerinin durumuna göre filtreleme yapar. finalized = completed (aynı durum).
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
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Pagination cursor (timestamp) - bu timestamp'ten önceki (daha eski) request'ler getirilir. İlk yüklemede boş bırakılır.
 *     responses:
 *       200:
 *         description: Birebir destek sohbetleri başarıyla listelendi. Cursor-based pagination ile WhatsApp benzeri çalışır.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       userName:
 *                         type: string
 *                       userTitle:
 *                         type: string
 *                         nullable: true
 *                       userAvatar:
 *                         type: string
 *                         nullable: true
 *                       requestDescription:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [active, pending, awaiting_completion, completed, finalized, reported]
 *                         description: finalized durumu completed ile aynıdır, frontend uyumluluğu için ayrı değer olarak döner.
 *                       threadId:
 *                         type: string
 *                         format: uuid
 *                         nullable: true
 *                     description: |
 *                       Support request'in bağlı olduğu support thread ID.
 *                       - pending: null (henüz accept edilmemiş, thread oluşturulmamış)
 *                       - accepted: support thread ID (accept edildiğinde oluşturulan unique thread ID)
 *                       - rejected: null
 *                       Her support request accept edildiğinde yeni bir unique thread oluşturulur ve threadId bu thread'e kaydedilir.
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     cursor:
 *                       type: string
 *                       format: date-time
 *                       description: Sonraki sayfa için cursor (timestamp)
 *                     hasMore:
 *                       type: boolean
 *                       description: Daha fazla request var mı?
 *                     limit:
 *                       type: integer
 *                       description: Sayfa başına request sayısı
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/support-requests',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Parse status filter
    let status: SupportRequestStatus | undefined;
    if (typeof req.query.status === 'string') {
      const statusValue = req.query.status.toLowerCase();
      // Handle finalized as completed (same status, different name for frontend compatibility)
      if (statusValue === 'finalized') {
        status = SupportRequestStatus.COMPLETED;
      } else if (Object.values(SupportRequestStatus).includes(statusValue as SupportRequestStatus)) {
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

    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const result = await supportRequestService.getUserSupportRequests(String(userId), {
      status,
      search,
      limit,
      cursor,
    });
    
    // Debug: Log results count
    if (search) {
      console.log('[Support Requests] Search results count:', result.items.length);
    }

    return res.json({
      items: result.items,
      pagination: {
        cursor: result.nextCursor,
        hasMore: result.hasMore,
        limit: limit || 50,
      },
    });
  }),
);

/**
 * @openapi
 * /inbox/support-requests:
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
    const userPayload = req.user;
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
 * /inbox/support-requests/{requestId}/accept:
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
 *       - threadId: Oluşturulan support thread ID'si (bu ID ile GET /inbox/{threadId} çağrılarak support chat mesajları yüklenir)
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
 *                   description: Oluşturulan support thread ID'si. Bu ID ile GET /inbox/{threadId} endpoint'i çağrılarak support chat mesajları yüklenir.
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
    const userPayload = req.user;
    const expertUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!expertUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { requestId } = req.params;
    if (!requestId) {
      return res.status(400).json({ message: 'requestId is required' });
    }

    try {
      logger.info(`Accept support request endpoint called: requestId=${requestId}, expertUserId=${expertUserId}`);
      const result = await supportRequestService.acceptSupportRequest(requestId, String(expertUserId));
      return res.status(200).json(result);
    } catch (error: unknown) {
      logger.error(`Accept support request error: requestId=${requestId}, expertUserId=${expertUserId}`, error);
      if (hasErrorMessage(error, 'Support request not found')) {
        return res.status(404).json({ message: getErrorMessage(error) });
      }
      if (errorMessageIncludes(error, 'Only the recipient')) {
        return res.status(403).json({ message: getErrorMessage(error) });
      }
      if (errorMessageIncludes(error, 'Only pending')) {
        return res.status(400).json({ message: getErrorMessage(error) });
      }
      throw error;
    }
  }),
);

/**
 * @openapi
 * /inbox/support-requests/{requestId}/reject:
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
    const userPayload = req.user;
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
      if (hasErrorMessage(error, 'Support request not found')) {
        return res.status(404).json({ message: getErrorMessage(error) });
      }
      if (errorMessageIncludes(error, 'Only the recipient')) {
        return res.status(403).json({ message: getErrorMessage(error) });
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
 * /inbox/support-requests/{requestId}/cancel:
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
    const userPayload = req.user;
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
      if (hasErrorMessage(error, 'Support request not found')) {
        return res.status(404).json({ message: getErrorMessage(error) });
      }
      if (errorMessageIncludes(error, 'Only the sender')) {
        return res.status(403).json({ message: getErrorMessage(error) });
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
 * /inbox/support-requests/{requestId}/close:
 *   post:
 *     summary: Support request'i kapat ve rating ver
 *     description: |
 *       Support request'i kapatır ve rating verir. İlk kullanıcı close yaptığında status AWAITING_COMPLETION olur.
 *       Karşı taraf finalize endpoint'i ile onaylayacak ve request COMPLETED olacak.
 *       
 *       **İşlem Adımları:**
 *       1. Support request status'ü AWAITING_COMPLETION olarak güncellenir
 *       2. Rating kaydedilir (fromUserRating veya toUserRating)
 *       3. Socket event: support_request_closed gönderilir (needsFinalize: true)
 *       4. Karşı taraf finalize endpoint'i ile onaylayacak
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
 *         description: Kapatılacak support request ID'si
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *                 description: 1-5 arası rating
 *                 example: 5
 *               comment:
 *                 type: string
 *                 description: Opsiyonel yorum
 *                 example: "Çok yardımcı oldu"
 *     responses:
 *       200:
 *         description: Support request başarıyla kapatıldı (AWAITING_COMPLETION durumunda)
 *       400:
 *         description: Geçersiz rating veya sadece accepted request'ler close edilebilir
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User is not part of this support request
 *       404:
 *         description: Support request not found
 */
router.post(
  '/support-requests/:requestId/close',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { requestId } = req.params;
    if (!requestId) {
      return res.status(400).json({ message: 'requestId is required' });
    }

    const { rating, comment } = req.body;

    if (!rating || typeof rating !== 'number') {
      return res.status(400).json({ message: 'rating is required and must be a number' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'rating must be between 1 and 5' });
    }

    try {
      await supportRequestService.closeSupportRequest(requestId, String(userId), rating);
      return res.status(200).json({ 
        status: 'awaiting_completion',
        message: 'Support request closed. Waiting for other user to finalize.' 
      });
    } catch (error: unknown) {
      if (hasErrorMessage(error, 'Support request not found')) {
        return res.status(404).json({ message: getErrorMessage(error) });
      }
      if (errorMessageIncludes(error, 'not part of this support request')) {
        return res.status(403).json({ message: getErrorMessage(error) });
      }
      if (errorMessageIncludes(error, 'Only accepted support requests can be closed')) {
        return res.status(400).json({ message: getErrorMessage(error) });
      }
      if (errorMessageIncludes(error, 'already closed')) {
        return res.status(400).json({ message: getErrorMessage(error) });
      }
      throw error;
    }
  }),
);

/**
 * @openapi
 * /inbox/support-requests/{requestId}/finalize:
 *   post:
 *     summary: Support request'i finalize et (karşı tarafın close'unu onayla)
 *     description: |
 *       AWAITING_COMPLETION durumundaki support request'i finalize eder ve COMPLETED yapar.
 *       Karşı taraf close yaptıktan sonra, bu endpoint ile onaylanır ve sohbet sonlanır.
 *       
 *       **İşlem Adımları:**
 *       1. Support request status'ü COMPLETED olarak güncellenir
 *       2. Rating kaydedilir (fromUserRating veya toUserRating)
 *       3. Socket event: support_request_finalized gönderilir
 *       4. Thread mesajlaşması sonlanır (status: COMPLETED)
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
 *         description: Finalize edilecek support request ID'si
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *                 description: 1-5 arası rating
 *                 example: 5
 *               comment:
 *                 type: string
 *                 description: Opsiyonel yorum
 *                 example: "Mükemmel destek"
 *     responses:
 *       200:
 *         description: Support request başarıyla finalize edildi (COMPLETED durumunda)
 *       400:
 *         description: Geçersiz rating, sadece awaiting_completion request'ler finalize edilebilir, veya karşı taraf henüz close yapmadı
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User is not part of this support request
 *       404:
 *         description: Support request not found
 */
router.post(
  '/support-requests/:requestId/finalize',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { requestId } = req.params;
    if (!requestId) {
      return res.status(400).json({ message: 'requestId is required' });
    }

    const { rating, comment } = req.body;

    if (!rating || typeof rating !== 'number') {
      return res.status(400).json({ message: 'rating is required and must be a number' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'rating must be between 1 and 5' });
    }

    try {
      await supportRequestService.finalizeSupportRequest(requestId, String(userId), rating);
      return res.status(200).json({ 
        status: 'completed',
        message: 'Support request finalized. Chat completed.' 
      });
    } catch (error: unknown) {
      if (hasErrorMessage(error, 'Support request not found')) {
        return res.status(404).json({ message: getErrorMessage(error) });
      }
      if (errorMessageIncludes(error, 'not part of this support request')) {
        return res.status(403).json({ message: getErrorMessage(error) });
      }
      if (errorMessageIncludes(error, 'Only awaiting_completion support requests can be finalized')) {
        return res.status(400).json({ message: getErrorMessage(error) });
      }
      if (errorMessageIncludes(error, 'Other user has not closed the request yet')) {
        return res.status(400).json({ message: getErrorMessage(error) });
      }
      if (errorMessageIncludes(error, 'already closed')) {
        return res.status(400).json({ message: getErrorMessage(error) });
      }
      throw error;
    }
  }),
);

/**
 * @openapi
 * /inbox/support-requests/{requestId}/report:
 *   post:
 *     summary: Support request'i raporla
 *     description: |
 *       Support request'i raporlar. Request status'ü COMPLETED olarak güncellenir ve thread kapatılır.
 *       
 *       **İşlem Adımları:**
 *       1. Rapor kaydedilir
 *       2. Thread kapatılır (isActive = false) - mesaj geçmişi görünmeye devam eder ama yeni mesaj gönderilemez
 *       3. Support request status'ü COMPLETED olarak güncellenir
 *       4. Socket event: support_request_reported gönderilir
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
 *         description: Raporlanacak support request ID'si
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [SPAM, HARASSMENT, SCAM]
 *                 description: Raporlama nedeni
 *                 example: "SPAM"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: Opsiyonel açıklama
 *                 example: "İstenmeyen mesajlar gönderiyor"
 *     responses:
 *       200:
 *         description: Support request başarıyla raporlandı
 *       400:
 *         description: Geçersiz reason veya zaten raporlanmış
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only participants can report
 *       404:
 *         description: Support request not found
 */
router.post(
  '/support-requests/:requestId/report',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { requestId } = req.params;
    if (!requestId) {
      return res.status(400).json({ message: 'requestId is required' });
    }

    const { reason, description } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ message: 'reason is required and must be a string' });
    }

    // Validate reason is one of the valid categories
    const validReasons = ['SPAM', 'HARASSMENT', 'SCAM'];
    const normalizedReason = reason.toUpperCase();
    if (!validReasons.includes(normalizedReason)) {
      return res.status(400).json({ message: `reason must be one of: ${validReasons.join(', ')}` });
    }

    if (description && typeof description === 'string' && description.length > 500) {
      return res.status(400).json({ message: 'description must be 500 characters or less' });
    }

    try {
      await supportRequestService.reportSupportRequest(
        requestId,
        String(userId),
        normalizedReason as any,
        description || null
      );
      return res.status(200).end();
    } catch (error: unknown) {
      if (hasErrorMessage(error, 'Support request not found')) {
        return res.status(404).json({ message: getErrorMessage(error) });
      }
      if (errorMessageIncludes(error, 'Only participants can report')) {
        return res.status(403).json({ message: getErrorMessage(error) });
      }
      if (errorMessageIncludes(error, 'zaten raporlanmış') || errorMessageIncludes(error, 'already reported')) {
        return res.status(400).json({ message: getErrorMessage(error) });
      }
      if (errorMessageIncludes(error, 'Invalid report category')) {
        return res.status(400).json({ message: getErrorMessage(error) });
      }
      throw error;
    }
  }),
);

/**
 * @openapi
 * /inbox/tips:
 *   post:
 *     summary: Kullanıcıya TIPS gönder
 *     description: |
 *       Oturum açmış kullanıcı (JWT'deki userId) bir kullanıcıya TIPS gönderir.
 *       - **Gönderen (sender):** JWT'deki userId; wallet olarak bu kullanıcının **smartAccountAddress** (ERC-4337) kullanılır.
 *       - **Alıcı (recipient):** Body'deki recipientUserId; wallet olarak bu kullanıcının **smartAccountAddress** (ERC-4337) kullanılır.
 *       TIPS gönderildiğinde `new_message` socket event'i messageType "send-tips" olacak şekilde tetiklenir.
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
 *               - recipientUserId
 *               - message
 *               - amount
 *               - timestamp
 *             properties:
 *               recipientUserId:
 *                 type: string
 *                 format: uuid
 *                 description: TIPS gönderilecek kullanıcının ID'si (alıcının smartAccountAddress kullanılır)
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
 */
router.post(
  '/tips',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const senderId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!senderId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { recipientUserId, message, amount, timestamp } = req.body as SendTipsCreate;

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

    const timestampDate = new Date(timestamp);
    if (isNaN(timestampDate.getTime())) {
      return res.status(400).json({ message: 'Invalid timestamp format. Expected ISO 8601 format (e.g., 2024-01-15T10:30:00Z)' });
    }

    try {
      await messagingService.sendTips(
        String(senderId),
        recipientUserId,
        numericAmount,
        message,
      );

      return res.status(201).end();
    } catch (error: unknown) {
      if (errorMessageIncludes(error, 'not found')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: getErrorMessage(error),
            path: '/inbox/tips',
            timestamp: new Date().toISOString(),
          },
        });
      }
      throw error;
    }
  }),
);

/**
 * @openapi
 * /inbox/{messageId}/read:
 *   post:
 *     summary: [DEPRECATED] Mesajı okundu olarak işaretle
 *     description: |
 *       **DEPRECATED:** Bu endpoint artık kullanılmamalıdır. Bunun yerine socket event'i kullanın: `mark_message_read`
 *       
 *       Belirtilen mesajı okundu olarak işaretler. Mesaj okundu olarak işaretlendiğinde `message_read` socket event'i tetiklenir.
 *       
 *       **Yeni Kullanım:** Socket üzerinden `mark_message_read` event'i gönderin:
 *       ```javascript
 *       socket.emit('mark_message_read', { messageId: '...' }, (response) => {
 *         if (response.success) {
 *           // Mesaj okundu olarak işaretlendi
 *         } else {
 *           // Hata: response.error
 *         }
 *       });
 *       ```
 *     deprecated: true
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
    const userPayload = req.user;
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
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (message === 'Message not found' || message === 'Thread not found') {
        return res.status(404).json({ message });
      }
      if (message === 'User is not a participant of this thread') {
        return res.status(403).json({ message });
      }
      throw error;
    }
  }),
);

// DEPRECATED ENDPOINTS (Removed):
// - GET /inbox/:supportThreadId/support-chat
//   → Artık GET /inbox/:threadId kullanılıyor (thread tipine göre otomatik olarak doğru veri döndürülüyor)
// - POST /inbox/:supportThreadId/support-chat
//   → Artık socket üzerinden send_support_message event'i kullanılıyor

/**
 * @openapi
 * /inbox/{threadId}:
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
 *         name: cursor
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Pagination cursor (timestamp) - bu timestamp'ten önceki (daha eski) mesajlar getirilir. İlk yüklemede boş bırakılır.
 *     responses:
 *       200:
 *         description: Thread mesajları başarıyla getirildi. Thread tipine göre farklı içerik döner. Cursor-based pagination ile WhatsApp benzeri çalışır.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MessageFeedItem'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     cursor:
 *                       type: string
 *                       format: date-time
 *                       description: Sonraki sayfa için cursor (timestamp)
 *                     hasMore:
 *                       type: boolean
 *                       description: Daha fazla mesaj var mı?
 *                     limit:
 *                       type: integer
 *                       description: Sayfa başına mesaj sayısı
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
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    let { threadId } = req.params;
    if (!threadId) {
      return res.status(400).json({ message: 'threadId is required' });
    }

    // URL encoding sorunlarını düzelt (tırnak işaretleri, boşluklar vb.)
    threadId = threadId.trim().replace(/^["']|["']$/g, ''); // Başta ve sonda tırnak işaretlerini temizle
    
    // UUID format kontrolü
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(threadId)) {
      return res.status(400).json({ 
        message: 'Invalid threadId format',
        details: `threadId must be a valid UUID format, received: ${threadId}` 
      });
    }

    let limit: number | undefined;
    if (typeof req.query.limit === 'string') {
      const parsed = parseInt(req.query.limit, 10);
      if (!Number.isNaN(parsed)) {
        limit = Math.min(Math.max(parsed, 1), 100);
      }
    }

    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    try {
      // Thread mesajlarını getir (cursor-based pagination)
      const result = await messagingService.getThreadMessages(
        threadId,
        String(userId),
        limit || 50,
        cursor
      );

      // Thread açıldığında tüm okunmamış mesajları otomatik olarak okundu işaretle
      // WhatsApp mantığı: Mesaj listesinde mesaja tıklandığında thread açılır ve tüm mesajlar okundu olur
      // Bu sayede mesaj listesindeki yeşil nokta (unread indicator) anında kaybolur
      try {
        await messagingService.markAllMessagesAsReadInThread(threadId, String(userId));
      } catch (markReadError) {
        // Okundu işaretleme hatası mesaj getirmeyi engellemez, sadece logla
        // Bu sayede thread açılmaya devam eder, sadece okundu işaretleme başarısız olur
        logger.warn(`Failed to mark messages as read in thread ${threadId} for user ${userId}:`, markReadError);
      }

      return res.status(200).json({
        participants: result.participants ? {
          userOne: result.participants.userOne,
          userTwo: result.participants.userTwo,
        } : undefined,
        items: result.items,
        totalTipsAmount: result.totalTipsAmount,
        supportRequestMessages: result.supportRequestMessages,
        supportRequestType: result.supportRequestType,
        supportRequestAmount: result.supportRequestAmount,
        pagination: {
          cursor: result.nextCursor,
          hasMore: result.hasMore,
          limit: limit || 50,
        },
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (message === 'Thread not found') {
        return res.status(404).json({ message });
      }
      if (message === 'User is not a participant of this thread') {
        return res.status(403).json({ message });
      }
      throw error;
    }
  }),
);

/**
 * @openapi
 * /messaging/inbox/{messageId}:
 *   put:
 *     summary: Mesaj güncelle
 *     description: Sadece mesajın göndereni, mesajı gönderdikten sonra 5 dakika içinde güncelleyebilir.
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Güncellenecek mesaj ID'si
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: Yeni mesaj içeriği
 *     responses:
 *       200:
 *         description: Mesaj başarıyla güncellendi
 *       400:
 *         description: Geçersiz istek veya zaman aşımı
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       403:
 *         description: Kullanıcının bu mesajı güncelleme yetkisi yok
 *       404:
 *         description: Mesaj bulunamadı
 */
router.put(
  '/inbox/:messageId',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { messageId } = req.params;
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ message: 'message is required and must be a non-empty string' });
    }
    try {
      await messagingService.updateMessage(String(userId), messageId, message.trim());
      return res.status(200).json({ success: true, message: 'Message updated successfully' });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (hasErrorMessage(error) && (message.includes('not found') || message.includes('Message not found'))) {
        return res.status(404).json({ message: 'Message not found' });
      }
      if (hasErrorMessage(error) && (message.includes('Forbidden') || message.includes('does not own'))) {
        return res.status(403).json({ message: 'You are not allowed to update this message' });
      }
      if (hasErrorMessage(error) && message.includes('5 minutes')) {
        return res.status(400).json({ message: 'Message can only be updated within 5 minutes of sending' });
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /messaging/inbox/{messageId}:
 *   delete:
 *     summary: Mesaj sil
 *     description: Sadece mesajın göndereni kendi mesajını silebilir.
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Silinecek mesaj ID'si
 *     responses:
 *       204:
 *         description: Mesaj başarıyla silindi
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       403:
 *         description: Kullanıcının bu mesajı silme yetkisi yok
 *       404:
 *         description: Mesaj bulunamadı
 */
// Bu endpoint kaldırıldı - aşağıdaki /:messageId endpoint'i kullanılıyor
// router.delete('/inbox/:messageId', ...) - YANLIŞ PATH, router zaten /inbox base path'inde

/**
 * @openapi
 * /messaging/threads/{threadId}:
 *   delete:
 *     summary: Thread sil
 *     description: Thread'deki kullanıcılardan biri thread'i silebilir. Thread soft delete yapılır (isActive = false).
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: threadId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Silinecek thread ID'si
 *     responses:
 *       204:
 *         description: Thread başarıyla silindi
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       403:
 *         description: Kullanıcı bu thread'in parçası değil
 *       404:
 *         description: Thread bulunamadı
 */
router.delete(
  '/threads/:threadId',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { threadId } = req.params;

    try {
      await messagingService.deleteThread(String(userId), threadId);
      return res.status(204).send();
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (hasErrorMessage(error) && (message.includes('not found') || message.includes('Thread not found'))) {
        return res.status(404).json({ message: 'Thread not found' });
      }
      if (hasErrorMessage(error) && (message.includes('Forbidden') || message.includes('not part of'))) {
        return res.status(403).json({ message: 'You are not part of this thread' });
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /inbox/{messageId}:
 *   patch:
 *     summary: Mesajı düzenle
 *     description: Mesajı düzenler (15 dakika limit ile)
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Mesaj başarıyla düzenlendi
 *       400:
 *         description: Geçersiz request veya zaman limiti aşıldı
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       403:
 *         description: Mesaj sahibi değilsiniz
 *       404:
 *         description: Mesaj bulunamadı
 */
router.patch(
  '/:messageId',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { messageId } = req.params;
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ message: 'message is required' });
    }

    try {
      await messagingService.editMessage(messageId, String(userId), message);
      const { DmMessagePrismaRepository } = await import('../../infrastructure/repositories/dm-message-prisma.repository');
      const messageRepo = new DmMessagePrismaRepository();
      const updatedMessage = await messageRepo.findById(messageId);
      return res.status(200).json({
        messageId,
        message,
        editedAt: updatedMessage?.editedAt?.toISOString() || new Date().toISOString()
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (hasErrorMessage(error) && (message.includes('not found') || message.includes('Message not found'))) {
        return res.status(404).json({ message: 'Message not found' });
      }
      if (hasErrorMessage(error) && (message.includes('Forbidden') || message.includes('own messages'))) {
        return res.status(403).json({ message: 'You can only edit your own messages' });
      }
      if (hasErrorMessage(error) && message.includes('15 minutes')) {
        return res.status(400).json({ message: 'Message cannot be edited after 15 minutes' });
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /inbox/messages/{messageId}:
 *   delete:
 *     summary: Mesajı sil
 *     description: Mesajı soft delete yapar. Sadece mesajın göndereni kendi mesajını silebilir.
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Silinecek mesaj ID'si
 *     responses:
 *       200:
 *         description: Mesaj başarıyla silindi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messageId:
 *                   type: string
 *                   format: uuid
 *                 deletedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       403:
 *         description: Mesaj sahibi değilsiniz
 *       404:
 *         description: Mesaj bulunamadı
 */
router.delete(
  '/messages/:messageId',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { messageId } = req.params;

    try {
      await messagingService.deleteMessage(messageId, String(userId));
      return res.status(200).json({
        messageId,
        deletedAt: new Date().toISOString()
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (hasErrorMessage(error) && (message.includes('not found') || message.includes('Message not found'))) {
        return res.status(404).json({ message: 'Message not found' });
      }
      if (hasErrorMessage(error) && (message.includes('Forbidden') || message.includes('own messages'))) {
        return res.status(403).json({ message: 'You can only delete your own messages' });
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /inbox/{messageId}:
 *   delete:
 *     summary: Mesajı sil (alternatif endpoint)
 *     description: Mesajı soft delete yapar. Frontend /inbox/messages/{messageId} kullanmalı.
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Mesaj başarıyla silindi
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       403:
 *         description: Mesaj sahibi değilsiniz
 *       404:
 *         description: Mesaj bulunamadı
 */
router.delete(
  '/:messageId',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { messageId } = req.params;

    try {
      await messagingService.deleteMessage(messageId, String(userId));
      return res.status(200).json({
        messageId,
        deletedAt: new Date().toISOString()
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (hasErrorMessage(error) && (message.includes('not found') || message.includes('Message not found'))) {
        return res.status(404).json({ message: 'Message not found' });
      }
      if (hasErrorMessage(error) && (message.includes('Forbidden') || message.includes('own messages'))) {
        return res.status(403).json({ message: 'You can only delete your own messages' });
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /inbox/{messageId}/reactions:
 *   post:
 *     summary: Mesaja reaksiyon ekle
 *     description: Mesaja emoji reaksiyon ekler
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emoji]
 *             properties:
 *               emoji:
 *                 type: string
 *     responses:
 *       201:
 *         description: Reaksiyon başarıyla eklendi
 *       400:
 *         description: Geçersiz request veya zaten reaksiyon var
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       404:
 *         description: Mesaj bulunamadı
 */
router.post(
  '/:messageId/reactions',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== 'string' || emoji.trim() === '') {
      return res.status(400).json({ message: 'emoji is required' });
    }

    try {
      await messagingService.addReaction(messageId, String(userId), emoji.trim());
      return res.status(201).json({
        messageId,
        userId: String(userId),
        emoji: emoji.trim(),
        createdAt: new Date().toISOString()
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (hasErrorMessage(error) && (message.includes('not found') || message.includes('Message not found'))) {
        return res.status(404).json({ message: 'Message not found' });
      }
      if (hasErrorMessage(error) && message.includes('Already reacted')) {
        return res.status(400).json({ message: 'Already reacted with this emoji' });
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /inbox/{messageId}/reactions:
 *   get:
 *     summary: Mesajın reaksiyonlarını getir
 *     description: Mesajın tüm reaksiyonlarını gruplu olarak getirir
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Reaksiyonlar başarıyla getirildi
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       404:
 *         description: Mesaj bulunamadı
 */
router.get(
  '/:messageId/reactions',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    if (!userPayload?.id && !userPayload?.userId && !userPayload?.sub) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { messageId } = req.params;

    try {
      const reactions = await messagingService.getMessageReactions(messageId);
      return res.status(200).json({
        messageId,
        reactions
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (hasErrorMessage(error) && (message.includes('not found') || message.includes('Message not found'))) {
        return res.status(404).json({ message: 'Message not found' });
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /inbox/{messageId}/reactions/{reactionId}:
 *   delete:
 *     summary: Reaksiyonu kaldır
 *     description: Mesajdan reaksiyon kaldırır
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: reactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Reaksiyon başarıyla kaldırıldı
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       403:
 *         description: Reaksiyon sahibi değilsiniz
 *       404:
 *         description: Reaksiyon bulunamadı
 */
router.delete(
  '/:messageId/reactions/:reactionId',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { messageId, reactionId } = req.params;

    // Get reaction to find emoji
    const { MessageReactionPrismaRepository } = await import('../../infrastructure/repositories/message-reaction-prisma.repository');
    const reactionRepo = new MessageReactionPrismaRepository();
    const reaction = await reactionRepo.findById(reactionId);

    if (!reaction) {
      return res.status(404).json({ message: 'Reaction not found' });
    }

    if (reaction.userId !== String(userId)) {
      return res.status(403).json({ message: 'You can only remove your own reactions' });
    }

    try {
      await messagingService.removeReaction(messageId, String(userId), reaction.emoji);
      return res.status(200).json({
        messageId,
        reactionId,
        deletedAt: new Date().toISOString()
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (hasErrorMessage(error) && (message.includes('not found') || message.includes('Message not found'))) {
        return res.status(404).json({ message: 'Message not found' });
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /inbox/threads/{threadId}/search:
 *   get:
 *     summary: Thread içinde mesaj ara
 *     description: Thread içinde full-text search yapar
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: threadId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Arama sorgusu
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maksimum sonuç sayısı
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Atlanacak sonuç sayısı
 *     responses:
 *       200:
 *         description: Arama sonuçları başarıyla getirildi
 *       400:
 *         description: Query parametresi eksik
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       403:
 *         description: Thread'e erişim yok
 */
router.get(
  '/threads/:threadId/search',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    if (!userPayload?.id && !userPayload?.userId && !userPayload?.sub) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { threadId } = req.params;
    const { q, limit = 50, offset = 0 } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({ message: 'Query parameter (q) is required' });
    }

    try {
      const messages = await messagingService.searchMessages(
        threadId,
        q.trim(),
        parseInt(limit as string) || 50,
        parseInt(offset as string) || 0
      );
      return res.status(200).json({
        messages: messages.map(m => ({
          id: m.id,
          threadId: m.threadId,
          senderId: m.senderId,
          message: m.message,
          sentAt: m.sentAt.toISOString(),
          sender: {
            id: m.senderId,
            senderName: '',
            senderTitle: '',
            senderAvatar: ''
          }
        })),
        total: messages.length,
        hasMore: messages.length >= (parseInt(limit as string) || 50)
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (hasErrorMessage(error) && (message.includes('not found') || message.includes('Thread not found'))) {
        return res.status(404).json({ message: 'Thread not found' });
      }
      if (hasErrorMessage(error) && (message.includes('Forbidden') || message.includes('not part of'))) {
        return res.status(403).json({ message: 'Access denied' });
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /inbox/threads/{threadId}/media:
 *   post:
 *     summary: Thread'e medya yükle
 *     description: Thread'e görsel, video, ses veya dosya yükler
 *     tags: [Inbox]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: threadId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [media]
 *             properties:
 *               media:
 *                 type: string
 *                 format: binary
 *               mediaType:
 *                 type: string
 *                 enum: [image, video, audio, file]
 *               caption:
 *                 type: string
 *               fileName:
 *                 type: string
 *               fileSize:
 *                 type: number
 *     responses:
 *       201:
 *         description: Medya başarıyla yüklendi
 *       400:
 *         description: Geçersiz dosya veya format
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       403:
 *         description: Thread'e erişim yok
 *       413:
 *         description: Dosya çok büyük
 */
router.post(
  '/threads/:threadId/media',
  upload.single('media'),
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { threadId } = req.params;
    const { mediaType, caption, fileName, fileSize } = req.body;
    const file = (req as any).file;

    if (!file) {
      return res.status(400).json({ message: 'Media file is required' });
    }

    // Validate media type
    const validMediaTypes = ['image', 'video', 'audio', 'file'];
    let detectedMediaType = mediaType;
    
    if (!detectedMediaType) {
      // Auto-detect from MIME type
      if (file.mimetype.startsWith('image/')) {
        detectedMediaType = 'image';
      } else if (file.mimetype.startsWith('video/')) {
        detectedMediaType = 'video';
      } else if (file.mimetype.startsWith('audio/')) {
        detectedMediaType = 'audio';
      } else {
        detectedMediaType = 'file';
      }
    }

    if (!validMediaTypes.includes(detectedMediaType)) {
      return res.status(400).json({ message: 'Invalid mediaType. Must be one of: image, video, audio, file' });
    }

    try {
      // Determine file extension
      const mimeToExtension: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'video/quicktime': 'mov',
        'video/x-msvideo': 'avi',
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/wav': 'wav',
        'audio/ogg': 'ogg',
      };

      let fileExtension = 'jpg';
      if (file.mimetype && mimeToExtension[file.mimetype]) {
        fileExtension = mimeToExtension[file.mimetype];
      } else if (file.originalname && file.originalname.includes('.')) {
        const parts = file.originalname.split('.');
        if (parts.length > 1) {
          fileExtension = parts[parts.length - 1].toLowerCase();
        }
      }

      // Create file path - thread bazlı (thread silindiğinde tüm medyaları da silmek kolay olur)
      const filePath = `messages/threads/${threadId}/${uuidv4()}.${fileExtension}`;
      
      // Upload to S3
      const mediaUrl = await s3Service.uploadFile(filePath, file.buffer, file.mimetype);
      
      // For images and videos, we could generate thumbnails here
      // For now, we'll use the same URL as thumbnail
      const thumbnailUrl = (detectedMediaType === 'image' || detectedMediaType === 'video') ? mediaUrl : null;

      // Upload media message
      const message = await messagingService.uploadMedia(
        threadId,
        String(userId),
        mediaUrl,
        detectedMediaType as 'image' | 'video' | 'audio' | 'file',
        fileName || file.originalname,
        BigInt(fileSize || file.size),
        thumbnailUrl || undefined,
        caption
      );

      return res.status(201).json({
        messageId: message.id,
        threadId,
        mediaUrl,
        thumbnailUrl,
        mediaType: detectedMediaType,
        caption: caption || null,
        sentAt: message.sentAt.toISOString()
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (hasErrorMessage(error) && (message.includes('not found') || message.includes('Thread not found'))) {
        return res.status(404).json({ message: 'Thread not found' });
      }
      if (hasErrorMessage(error) && (message.includes('Forbidden') || message.includes('not part of'))) {
        return res.status(403).json({ message: 'Access denied' });
      }
      logger.error('Media upload error:', error);
      throw error;
    }
  })
);

export default router;
