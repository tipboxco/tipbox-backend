import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { ExpertService } from '../../application/expert/expert.service';
import { TipsBalanceService } from '../../application/wallet/tips-balance.service';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { S3Service } from '../../infrastructure/s3/s3.service';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../infrastructure/logger/logger';

const router = Router();
const expertService = new ExpertService();
const tipsBalanceService = new TipsBalanceService();
const s3Service = new S3Service();

// Multer configuration for Expert Request media uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    // Image and video files allowed
    const allowedMimeTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
    ];
    
    if (file.mimetype && allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece resim (JPG, PNG, GIF, WebP) ve video (MP4, WebM, MOV, AVI) dosyaları yüklenebilir'));
    }
  },
});

/**
 * @openapi
 * /expert/balance:
 *   get:
 *     summary: Kullanıcının mevcut TIPS balance'ını getir
 *     description: Expert Request oluşturma ekranında gösterilecek kullanıcının mevcut TIPS balance'ını döndürür. 30 saniye cache'lenir.
 *     tags: [Expert]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: TIPS balance başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance:
 *                   type: number
 *                   example: 500
 *                   description: Kullanıcının mevcut TIPS balance'ı
 *                 cached:
 *                   type: boolean
 *                   example: false
 *                   description: Cache'den mi geldiği bilgisi
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  '/balance',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const balance = await tipsBalanceService.getUserTipsBalance(userId);
      res.json({
        balance,
        cached: false, // Bu bilgi şu an service'den dönmüyor, gerekirse eklenebilir
      });
    } catch (error) {
      logger.error({
        message: 'Error getting tips balance',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: 'Failed to get tips balance' });
    }
  })
);

/**
 * @openapi
 * /expert/request:
 *   post:
 *     summary: Uzman desteği almak için gönderi oluştur
 *     description: Kullanıcılar uzman desteği almak için istek oluşturabilir. İlk başta TIPS miktarı belirtilebilir veya sonradan güncellenebilir.
 *     tags: [Expert]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *             properties:
 *               description:
 *                 type: string
 *                 description: Soru veya istek açıklaması
 *               category:
 *                 type: string
 *                 description: Soru kategorisi (opsiyonel)
 *               tipsAmount:
 *                 type: string
 *                 description: İsteğe ödenecek TIPS miktarı (opsiyonel, string olarak gönderilir, number'a parse edilir)
 *                 example: "50"
 *               media:
 *                 type: array
 *                 description: Medya dosyaları (opsiyonel, birden fazla dosya yüklenebilir)
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Expert request başarıyla oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 userId:
 *                   type: string
 *                   format: uuid
 *                 description:
 *                   type: string
 *                 tipsAmount:
 *                   type: number
 *                 status:
 *                   type: string
 *                   enum: [PENDING, ANSWERED, CLOSED]
 *                 answeredAt:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/request',
  authMiddleware,
  upload.array('media', 10), // Maximum 10 media files
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { description, category, tipsAmount } = req.body;
    // Handle multer files array - upload.array() puts files in req.files as array
    const multerReq = req as any;
    const files: Express.Multer.File[] = Array.isArray(multerReq.files) ? multerReq.files : [];

    // Validation
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ message: 'Description is required and must be a non-empty string' });
    }

    // Parse tipsAmount from string to number
    let parsedTipsAmount = 0;
    if (tipsAmount !== undefined && tipsAmount !== null && tipsAmount !== '') {
      const parsed = parseFloat(String(tipsAmount));
      if (isNaN(parsed) || parsed < 0) {
        return res.status(400).json({ message: 'Tips amount must be a non-negative number' });
      }
      parsedTipsAmount = parsed;
    }

    // Upload media files to S3 and prepare mediaUrls array
    const mediaUrls: Array<{ url: string; type: 'IMAGE' | 'VIDEO' }> = [];
    
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          // Determine file type from MIME type
          const isImage = file.mimetype.startsWith('image/');
          const isVideo = file.mimetype.startsWith('video/');
          
          if (!isImage && !isVideo) {
            return res.status(400).json({ 
              message: `Unsupported file type: ${file.mimetype}. Only images and videos are allowed.` 
            });
          }

          // Determine file extension
          let fileExtension = 'jpg';
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
          };

          if (file.mimetype && mimeToExtension[file.mimetype]) {
            fileExtension = mimeToExtension[file.mimetype];
          } else if (file.originalname && file.originalname.includes('.')) {
            const parts = file.originalname.split('.');
            if (parts.length > 1) {
              fileExtension = parts[parts.length - 1].toLowerCase();
            }
          }

          // Create file path
          const fileName = `expert-requests/${userId}/${uuidv4()}.${fileExtension}`;
          
          // Upload to S3
          const mediaUrl = await s3Service.uploadFile(fileName, file.buffer, file.mimetype);
          
          // Determine media type
          const mediaType: 'IMAGE' | 'VIDEO' = isImage ? 'IMAGE' : 'VIDEO';
          
          mediaUrls.push({
            url: mediaUrl,
            type: mediaType,
          });

          logger.info({
            message: 'Expert request media uploaded',
            userId,
            fileName,
            mediaUrl,
            mediaType,
            fileSize: file.size,
          });
        } catch (error) {
          logger.error({
            message: 'Error uploading expert request media',
            userId,
            fileName: file.originalname,
            error: error instanceof Error ? error.message : String(error),
          });
          
          return res.status(500).json({ 
            message: `Media upload failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
          });
        }
      }
    }

    const result = await expertService.createExpertRequest(userId, {
      description: description.trim(),
      category: category || undefined,
      tipsAmount: parsedTipsAmount,
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
    });

    res.status(201).json(result);
  })
);

/**
 * @openapi
 * /expert/request/{requestId}/tips:
 *   patch:
 *     summary: İsteğin TIPS miktarını güncelle
 *     description: Oluşturulan uzman desteği isteğinin TIPS miktarını zaman içerisinde güncelleyebilirsiniz. Sadece PENDING durumundaki istekler için geçerlidir.
 *     tags: [Expert]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Expert request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tipsAmount
 *             properties:
 *               tipsAmount:
 *                 type: number
 *                 description: Güncellenecek TIPS miktarı
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: TIPS miktarı başarıyla güncellendi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 userId:
 *                   type: string
 *                   format: uuid
 *                 description:
 *                   type: string
 *                 tipsAmount:
 *                   type: number
 *                 status:
 *                   type: string
 *                   enum: [PENDING, ANSWERED, CLOSED]
 *                 answeredAt:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Request does not belong to user
 *       404:
 *         description: Expert request not found
 */
router.patch(
  '/request/:requestId/tips',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { requestId } = req.params;
    const { tipsAmount } = req.body;

    if (!requestId) {
      return res.status(400).json({ message: 'Request ID is required' });
    }

    if (typeof tipsAmount !== 'number' || tipsAmount < 0) {
      return res.status(400).json({ message: 'Tips amount must be a non-negative number' });
    }

    try {
      const result = await expertService.updateExpertRequestTips(userId, requestId, {
        tipsAmount,
      });
      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('Unauthorized') || error.message.includes('belong')) {
          return res.status(403).json({ message: error.message });
        }
        if (error.message.includes('Cannot update')) {
          return res.status(400).json({ message: error.message });
        }
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /expert/answered:
 *   get:
 *     summary: Cevaplanmış uzman desteği içeriklerini getir
 *     description: Uzman desteğinin yanıtlanması durumunda cevaplanmış içeriğin detaylarını gösterir. Her bir soru ve cevap eşleşmesi için detaylı bilgi döner.
 *     tags: [Expert]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cevaplanmış içerikler başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   question:
 *                     type: object
 *                     properties:
 *                       description:
 *                         type: string
 *                   answer:
 *                     type: object
 *                     properties:
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           name:
 *                             type: string
 *                           title:
 *                             type: array
 *                             items:
 *                               type: string
 *                           avatar:
 *                             type: string
 *                             format: uri
 *                             nullable: true
 *                       content:
 *                         type: string
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/answered',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await expertService.getAnsweredExpertRequests();
    res.json(result);
  })
);

/**
 * @openapi
 * /expert/request/{requestId}:
 *   get:
 *     summary: Belirli bir isteğin detaylarını getir
 *     description: Belirli bir expert request'in detaylarını ve varsa cevaplarını getirir. Sadece cevaplanmış istekler için detay döner.
 *     tags: [Expert]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Expert request ID
 *     responses:
 *       200:
 *         description: İstek detayları başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 description:
 *                   type: string
 *                 category:
 *                   type: string
 *                   nullable: true
 *                 tipsAmount:
 *                   type: number
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 answeredAt:
 *                   type: string
 *                   format: date-time
 *                 media:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ExpertRequestMediaResponse'
 *                 answers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       user:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           name:
 *                             type: string
 *                           title:
 *                             type: array
 *                             items:
 *                               type: string
 *                           avatar:
 *                             type: string
 *                             format: uri
 *                             nullable: true
 *                       content:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: İstek bulunamadı veya cevaplanmamış
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/request/:requestId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { requestId } = req.params;

    if (!requestId) {
      return res.status(400).json({ message: 'Request ID is required' });
    }

    const result = await expertService.getExpertRequestDetail(requestId);

    if (!result) {
      return res.status(404).json({ message: 'Request not found or not answered' });
    }

    res.json(result);
  })
);

/**
 * @openapi
 * /expert/my-requests:
 *   get:
 *     summary: Kullanıcının kendi expert request'lerini getir
 *     description: Kullanıcının oluşturduğu tüm expert request'lerini answered ve pending olarak gruplanmış şekilde getirir.
 *     tags: [Expert]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kullanıcının request'leri başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 answered:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ExpertRequestResponse'
 *                 pending:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ExpertRequestResponse'
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/my-requests',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await expertService.getMyExpertRequests(userId);
    res.json(result);
  })
);

/**
 * @openapi
 * /expert/my-requests/answered:
 *   get:
 *     summary: Kullanıcının cevaplanmış request'lerini getir
 *     description: Kullanıcının oluşturduğu ve cevaplanmış olan expert request'lerini getirir.
 *     tags: [Expert]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cevaplanmış request'ler başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ExpertRequestResponse'
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/my-requests/answered',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await expertService.getMyAnsweredRequests(userId);
    res.json(result);
  })
);

/**
 * @openapi
 * /expert/my-requests/pending:
 *   get:
 *     summary: Kullanıcının bekleyen request'lerini getir
 *     description: Kullanıcının oluşturduğu ve henüz cevaplanmamış (PENDING) olan expert request'lerini getirir.
 *     tags: [Expert]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bekleyen request'ler başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ExpertRequestResponse'
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/my-requests/pending',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await expertService.getMyPendingRequests(userId);
    res.json(result);
  })
);

/**
 * @openapi
 * /expert/request/{requestId}/answer:
 *   post:
 *     summary: Expert bir request'e cevap ver
 *     description: Uzman bir kullanıcının expert request'ine cevap verebilir. Request ANSWERED durumuna geçer.
 *     tags: [Expert]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Expert request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Uzman cevabı
 *     responses:
 *       201:
 *         description: Cevap başarıyla oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 requestId:
 *                   type: string
 *                   format: uuid
 *                 expertUserId:
 *                   type: string
 *                   format: uuid
 *                 content:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                 request:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     description:
 *                       type: string
 *                     tipsAmount:
 *                       type: number
 *                     status:
 *                       type: string
 *                       enum: [ANSWERED]
 *                     userId:
 *                       type: string
 *                       format: uuid
 *                 expertUser:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     title:
 *                       type: array
 *                       items:
 *                         type: string
 *                     avatar:
 *                       type: string
 *                       format: uri
 *                       nullable: true
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Expert request not found
 */
router.post(
  '/request/:requestId/answer',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const expertUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!expertUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { requestId } = req.params;
    const { content } = req.body;

    if (!requestId) {
      return res.status(400).json({ message: 'Request ID is required' });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ message: 'Content is required and must be a non-empty string' });
    }

    try {
      const result = await expertService.createExpertAnswer(expertUserId, requestId, {
        content: content.trim(),
      });
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('Cannot answer') || error.message.includes('own request')) {
          return res.status(400).json({ message: error.message });
        }
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /expert/my-answers:
 *   get:
 *     summary: Expert'in verdiği cevapları getir
 *     description: Expert olarak verdiğiniz tüm cevapları ve ilgili request bilgilerini getirir.
 *     tags: [Expert]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Expert cevapları başarıyla getirildi
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
 *                   requestId:
 *                     type: string
 *                     format: uuid
 *                   expertUserId:
 *                     type: string
 *                     format: uuid
 *                   content:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *                   request:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       description:
 *                         type: string
 *                       tipsAmount:
 *                         type: number
 *                       status:
 *                         type: string
 *                       userId:
 *                         type: string
 *                         format: uuid
 *                   expertUser:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       title:
 *                         type: array
 *                         items:
 *                           type: string
 *                       avatar:
 *                         type: string
 *                         format: uri
 *                         nullable: true
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/my-answers',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const expertUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!expertUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await expertService.getMyExpertAnswers(expertUserId);
    res.json(result);
  })
);

/**
 * @openapi
 * /expert/request/{requestId}/accept-answer:
 *   post:
 *     summary: Expert cevabını kabul et
 *     description: Kullanıcı, uzmanın verdiği cevabı kabul ederek talebi sonlandırır. Request CLOSED durumuna geçer.
 *     tags: [Expert]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Expert request ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               answerId:
 *                 type: string
 *                 format: uuid
 *                 description: Belirli bir cevabı kabul etmek için (opsiyonel, birden fazla cevap varsa)
 *     responses:
 *       200:
 *         description: Cevap başarıyla kabul edildi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExpertRequestResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Request does not belong to user
 *       404:
 *         description: Expert request not found or not answered
 */
router.post(
  '/request/:requestId/accept-answer',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { requestId } = req.params;
    const { answerId } = req.body;

    if (!requestId) {
      return res.status(400).json({ message: 'Request ID is required' });
    }

    try {
      const result = await expertService.acceptExpertAnswer(userId, requestId, {
        answerId,
      });
      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('Unauthorized') || error.message.includes('belong')) {
          return res.status(403).json({ message: error.message });
        }
        if (error.message.includes('Cannot accept') || error.message.includes('not been answered')) {
          return res.status(400).json({ message: error.message });
        }
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /expert/categories:
 *   get:
 *     summary: Expert kategorileri listesini getir
 *     description: Expert request oluştururken kullanılacak statik kategori listesini döndürür.
 *     tags: [Expert]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kategori listesi başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 categories:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       value:
 *                         type: string
 *                         example: "ELECTRONICS"
 *                       label:
 *                         type: string
 *                         example: "Elektronik"
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/categories',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { EXPERT_CATEGORIES, EXPERT_CATEGORY_NAMES } = await import(
      '../../domain/expert/expert-category.enum'
    );

    const categories = EXPERT_CATEGORIES.map((category) => ({
      value: category,
      label: EXPERT_CATEGORY_NAMES[category],
    }));

    res.json({ categories });
  })
);

/**
 * @openapi
 * /expert/request/{requestId}/status:
 *   get:
 *     summary: Expert request status'ünü getir
 *     description: Expert request'in mevcut durumunu, tahmini bekleme süresini ve expert bulunduysa expert bilgilerini döndürür. Frontend polling için kullanılır.
 *     tags: [Expert]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Expert request ID
 *     responses:
 *       200:
 *         description: Request status başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExpertRequestStatusResponse'
 *       404:
 *         description: Expert request not found
 */
router.get(
  '/request/:requestId/status',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { requestId } = req.params;
    const status = await expertService.getExpertRequestStatus(requestId);

    res.json({
      id: status.id,
      status: status.status,
      description: status.description,
      category: status.category,
      tipsAmount: status.tipsAmount,
      estimatedWaitTimeMinutes: status.estimatedWaitTimeMinutes,
      expertFound: status.expertFound,
      createdAt: status.createdAt.toISOString(),
      updatedAt: status.updatedAt.toISOString(),
    });
  })
);

/**
 * @openapi
 * /expert/request/{requestId}/accept:
 *   post:
 *     summary: Expert bir soruyu yanıtlamayı onaylar
 *     description: Expert, kendisine düşen bir soruyu yanıtlamayı onaylar. Request EXPERT_FOUND durumuna geçer ve request sahibine bildirim gönderilir.
 *     tags: [Expert]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Expert request ID
 *     responses:
 *       200:
 *         description: Expert başarıyla soruyu yanıtlamayı onayladı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExpertRequestResponse'
 *       400:
 *         description: Bad request - Request is not available or already answered
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Expert request not found
 */
router.post(
  '/request/:requestId/accept',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const expertUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!expertUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { requestId } = req.params;

    try {
      const result = await expertService.acceptToAnswer(expertUserId, requestId);
      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('Cannot accept') || error.message.includes('already answered')) {
          return res.status(400).json({ message: error.message });
        }
      }
      throw error;
    }
  })
);

export default router;

