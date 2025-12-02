import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { PostService } from '../../application/post/post.service';
import {
  CreatePostRequest,
  CreateTipsAndTricksPostRequest,
  CreateQuestionPostRequest,
  CreateBenchmarkPostRequest,
  CreateExperiencePostRequest,
  CreateUpdatePostRequest,
  SplitExperienceRequest,
} from './post.dto';
import { ContextType } from '../../domain/content/context-type.enum';
import { TipsAndTricksBenefitCategory } from '../../domain/content/tips-and-tricks-benefit-category.enum';
import { ExperienceType } from '../../domain/content/experience-type.enum';
import { ExperienceStatus } from '../../domain/content/experience-status.enum';
import { S3Service } from '../../infrastructure/s3/s3.service';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../infrastructure/logger/logger';

const router = Router();
const postService = new PostService();
const s3Service = new S3Service();

// Multer configuration for Post media uploads (images only for now)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    if (file.mimetype && allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Sadece resim dosyaları yüklenebilir (JPG, PNG, GIF, WebP)'
        )
      );
    }
  },
});

const uploadPostImages = async (
  userId: string,
  files: Express.Multer.File[] | undefined | null
): Promise<string[]> => {
  if (!files || files.length === 0) {
    return [];
  }

  const imageUrls: string[] = [];

  for (const file of files) {
    try {
      // Determine file extension
      let fileExtension = 'jpg';
      const mimeToExtension: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
      };

      if (file.mimetype && mimeToExtension[file.mimetype]) {
        fileExtension = mimeToExtension[file.mimetype];
      } else if (file.originalname && file.originalname.includes('.')) {
        const parts = file.originalname.split('.');
        if (parts.length > 1) {
          fileExtension = parts[parts.length - 1].toLowerCase();
        }
      }

      const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      if (!allowedExtensions.includes(fileExtension)) {
        throw new Error(
          'Desteklenmeyen dosya formatı. Sadece JPG, PNG, GIF ve WebP formatları desteklenmektedir.'
        );
      }

      const fileName = `posts/${userId}/${uuidv4()}.${fileExtension}`;
      const imageUrl = await s3Service.uploadFile(
        fileName,
        file.buffer,
        file.mimetype
      );

      imageUrls.push(imageUrl);

      logger.info({
        message: 'Post image uploaded',
        userId,
        fileName,
        imageUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error({
        message: 'Post image upload failed',
        userId,
        fileName: file.originalname,
        error: errorMessage,
        fileSize: file.size,
        mimeType: file.mimetype,
      });

      throw new Error(
        `Image upload failed: ${errorMessage}`
      );
    }
  }

  return imageUrls;
};

router.use(authMiddleware);

/**
 * @openapi
 * /posts/free:
 *   post:
 *     summary: Serbest gönderi oluştur
 *     description: Sub Category, Product Group veya Product için serbest gönderi oluşturur.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - contextType
 *               - contextId
 *               - description
 *             properties:
 *               contextType:
 *                 $ref: '#/components/schemas/ContextType'
 *               contextId:
 *                 type: string
 *               description:
 *                 type: string
 *               images:
 *                 type: array
 *                 description: Gönderiye eklenecek görseller (opsiyonel, birden fazla dosya yüklenebilir)
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Gönderi başarıyla oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *       400:
 *         description: Geçersiz istek
 *       401:
 *         description: Kimlik doğrulaması başarısız
 */
router.post(
  '/free',
  upload.array('images', 10),
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const multerReq = req as any;
    const files: Express.Multer.File[] = Array.isArray(multerReq.files)
      ? multerReq.files
      : [];

    const images = await uploadPostImages(String(userId), files);

    const request: CreatePostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      description: req.body.description,
      images,
    };

    if (!request.contextType || !request.contextId || !request.description) {
      return res.status(400).json({
        message: 'contextType, contextId, and description are required',
      });
    }

    const result = await postService.createFreePost(String(userId), request);
    return res.status(201).json(result);
  })
);

/**
 * @openapi
 * /posts/tips-and-tricks:
 *   post:
 *     summary: İpucu gönderisi oluştur
 *     description: Sub Category, Product Group veya Product için ipucu gönderisi oluşturur.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - contextType
 *               - contextId
 *               - description
 *               - benefitCategory
 *             properties:
 *               contextType:
 *                 $ref: '#/components/schemas/ContextType'
 *               contextId:
 *                 type: string
 *               description:
 *                 type: string
 *               benefitCategory:
 *                 $ref: '#/components/schemas/TipsAndTricksBenefitCategory'
 *               images:
 *                 type: array
 *                 description: Gönderiye eklenecek görseller (opsiyonel, birden fazla dosya yüklenebilir)
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: İpucu gönderisi başarıyla oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *       400:
 *         description: Geçersiz istek
 *       401:
 *         description: Kimlik doğrulaması başarısız
 */
router.post(
  '/tips-and-tricks',
  upload.array('images', 10),
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const multerReq = req as any;
    const files: Express.Multer.File[] = Array.isArray(multerReq.files)
      ? multerReq.files
      : [];

    const images = await uploadPostImages(String(userId), files);

    const request: CreateTipsAndTricksPostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      description: req.body.description,
      benefitCategory: req.body.benefitCategory as TipsAndTricksBenefitCategory,
      images,
    };

    if (
      !request.contextType ||
      !request.contextId ||
      !request.description ||
      !request.benefitCategory
    ) {
      return res.status(400).json({
        message:
          'contextType, contextId, description, and benefitCategory are required',
      });
    }

    const result = await postService.createTipsAndTricksPost(
      String(userId),
      request
    );
    return res.status(201).json(result);
  })
);

/**
 * @openapi
 * /posts/question:
 *   post:
 *     summary: Soru gönderisi oluştur
 *     description: Sub Category, Product Group veya Product için soru gönderisi oluşturur.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - contextType
 *               - contextId
 *               - description
 *               - selectedBoostOptionId
 *             properties:
 *               contextType:
 *                 $ref: '#/components/schemas/ContextType'
 *               contextId:
 *                 type: string
 *               description:
 *                 type: string
 *               selectedBoostOptionId:
 *                 type: string
 *               images:
 *                 type: array
 *                 description: Gönderiye eklenecek görseller (opsiyonel, birden fazla dosya yüklenebilir)
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Soru gönderisi başarıyla oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *       400:
 *         description: Geçersiz istek
 *       401:
 *         description: Kimlik doğrulaması başarısız
 */
router.post(
  '/question',
  upload.array('images', 10),
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const multerReq = req as any;
    const files: Express.Multer.File[] = Array.isArray(multerReq.files)
      ? multerReq.files
      : [];

    const images = await uploadPostImages(String(userId), files);

    const request: CreateQuestionPostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      description: req.body.description,
      images,
      selectedBoostOptionId: req.body.selectedBoostOptionId,
    };

    if (
      !request.contextType ||
      !request.contextId ||
      !request.description ||
      !request.selectedBoostOptionId
    ) {
      return res.status(400).json({
        message:
          'contextType, contextId, description, and selectedBoostOptionId are required',
      });
    }

    const result = await postService.createQuestionPost(
      String(userId),
      request
    );
    return res.status(201).json(result);
  })
);

/**
 * @openapi
 * /posts/boost-options:
 *   get:
 *     summary: Boost option listesini getir
 *     description: Soru gönderisi için kullanılabilir boost option'ları getirir.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Boost option listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/BoostOption'
 *       401:
 *         description: Kimlik doğrulaması başarısız
 */
router.get(
  '/boost-options',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    if (!userPayload?.id && !userPayload?.userId && !userPayload?.sub) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const boostOptions = await postService.getBoostOptions();
    return res.json(boostOptions);
  })
);

/**
 * @openapi
 * /posts/benchmark:
 *   post:
 *     summary: Karşılaştırma gönderisi oluştur
 *     description: Product için karşılaştırma gönderisi oluşturur. En az 2 ürün seçilmelidir.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBenchmarkPostRequest'
 *     responses:
 *       201:
 *         description: Karşılaştırma gönderisi başarıyla oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *       400:
 *         description: Geçersiz istek
 *       401:
 *         description: Kimlik doğrulaması başarısız
 */
router.post(
  '/benchmark',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const request: CreateBenchmarkPostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      products: req.body.products,
      description: req.body.description,
    };

    if (
      !request.contextType ||
      !request.contextId ||
      !request.products ||
      !request.description
    ) {
      return res.status(400).json({
        message:
          'contextType, contextId, products, and description are required',
      });
    }

    const result = await postService.createBenchmarkPost(
      String(userId),
      request
    );
    return res.status(201).json(result);
  })
);

/**
 * @openapi
 * /posts/experience:
 *   post:
 *     summary: Deneyim paylaşımı gönderisi oluştur
 *     description: Product için deneyim paylaşımı gönderisi oluşturur.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - contextType
 *               - contextId
 *               - selectedDurationId
 *               - selectedLocationId
 *               - selectedPurposeId
 *               - content
 *               - experience
 *               - status
 *             properties:
 *               contextType:
 *                 $ref: '#/components/schemas/ContextType'
 *               contextId:
 *                 type: string
 *               selectedDurationId:
 *                 type: string
 *               selectedLocationId:
 *                 type: string
 *               selectedPurposeId:
 *                 type: string
 *               content:
 *                 type: string
 *               experience:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Experience'
 *               status:
 *                 $ref: '#/components/schemas/ExperienceStatus'
 *               images:
 *                 type: array
 *                 description: Gönderiye eklenecek görseller (opsiyonel, birden fazla dosya yüklenebilir)
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Deneyim paylaşımı gönderisi başarıyla oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *       400:
 *         description: Geçersiz istek
 *       401:
 *         description: Kimlik doğrulaması başarısız
 */
router.post(
  '/experience',
  upload.array('images', 10),
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const multerReq = req as any;
    const files: Express.Multer.File[] = Array.isArray(multerReq.files)
      ? multerReq.files
      : [];

    const images = await uploadPostImages(String(userId), files);

    const request: CreateExperiencePostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      selectedDurationId: req.body.selectedDurationId,
      selectedLocationId: req.body.selectedLocationId,
      selectedPurposeId: req.body.selectedPurposeId,
      content: req.body.content,
      experience: req.body.experience,
      status: req.body.status as ExperienceStatus,
      images,
    };

    if (
      !request.contextType ||
      !request.contextId ||
      !request.selectedDurationId ||
      !request.selectedLocationId ||
      !request.selectedPurposeId ||
      !request.content ||
      !request.experience ||
      !request.status
    ) {
      return res.status(400).json({
        message:
          'All fields are required: contextType, contextId, selectedDurationId, selectedLocationId, selectedPurposeId, content, experience, status',
      });
    }

    const result = await postService.createExperiencePost(
      String(userId),
      request
    );
    return res.status(201).json(result);
  })
);

/**
 * @openapi
 * /posts/experience/split:
 *   post:
 *     summary: Deneyimi AI ile ayır
 *     description: Kullanıcının girdiği deneyimi Price and Shopping Experience ve Product and Usage Experience olarak ayırır.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
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
 *     responses:
 *       200:
 *         description: Deneyim başarıyla ayrıldı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 experiences:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Experience'
 *       400:
 *         description: Geçersiz istek
 *       401:
 *         description: Kimlik doğrulaması başarısız
 */
router.post(
  '/experience/split',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    if (!userPayload?.id && !userPayload?.userId && !userPayload?.sub) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const request: SplitExperienceRequest = {
      content: req.body.content,
    };

    if (!request.content) {
      return res.status(400).json({ message: 'content is required' });
    }

    const result = await postService.splitExperience(request);
    return res.json(result);
  })
);

/**
 * @openapi
 * /posts/experience/options:
 *   get:
 *     summary: Deneyim seçeneklerini getir
 *     description: Duration, Location ve Purpose seçeneklerini getirir.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deneyim seçenekleri
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 durations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                 locations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                 purposes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *       401:
 *         description: Kimlik doğrulaması başarısız
 */
router.get(
  '/experience/options',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    if (!userPayload?.id && !userPayload?.userId && !userPayload?.sub) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const options = await postService.getExperienceOptions();
    return res.json(options);
  })
);

/**
 * @openapi
 * /posts/{id}:
 *   delete:
 *     summary: Gönderi sil
 *     description: Sadece gönderinin sahibi kendi gönderisini silebilir.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Silinecek post ID'si
 *     responses:
 *       204:
 *         description: Gönderi başarıyla silindi
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       403:
 *         description: Kullanıcının bu gönderiyi silme yetkisi yok
 *       404:
 *         description: Gönderi bulunamadı
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: 'id is required' });
    }

    try {
      const deleted = await postService.deletePost(String(userId), id);
      if (!deleted) {
        return res.status(404).json({ message: 'Post not found' });
      }
      return res.status(204).send();
    } catch (error: any) {
      if (error instanceof Error && error.message.startsWith('Forbidden')) {
        return res.status(403).json({ message: 'You are not allowed to delete this post' });
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /posts/update:
 *   post:
 *     summary: Güncelleme gönderisi oluştur
 *     description: Product için güncelleme gönderisi oluşturur.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - contextType
 *               - contextId
 *               - content
 *             properties:
 *               contextType:
 *                 $ref: '#/components/schemas/ContextType'
 *               contextId:
 *                 type: string
 *               content:
 *                 type: string
 *               images:
 *                 type: array
 *                 description: Gönderiye eklenecek görseller (opsiyonel, birden fazla dosya yüklenebilir)
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Güncelleme gönderisi başarıyla oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *       400:
 *         description: Geçersiz istek
 *       401:
 *         description: Kimlik doğrulaması başarısız
 */
router.post(
  '/update',
  upload.array('images', 10),
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const multerReq = req as any;
    const files: Express.Multer.File[] = Array.isArray(multerReq.files)
      ? multerReq.files
      : [];

    const images = await uploadPostImages(String(userId), files);

    const request: CreateUpdatePostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      content: req.body.content,
      images,
    };

    if (!request.contextType || !request.contextId || !request.content) {
      return res.status(400).json({
        message: 'contextType, contextId, and content are required',
      });
    }

    const result = await postService.createUpdatePost(String(userId), request);
    return res.status(201).json(result);
  })
);

/**
 * @openapi
 * /posts/update/reviews/{productId}:
 *   get:
 *     summary: Ürün için review bilgilerini getir
 *     description: Kullanıcının belirtilen ürün için yapmış olduğu review bilgilerini getirir.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: Ürün ID
 *     responses:
 *       200:
 *         description: Review bilgileri
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   inventoryId:
 *                     type: string
 *                   hasOwned:
 *                     type: boolean
 *                   experienceSummary:
 *                     type: string
 *                   experiences:
 *                     type: array
 *                     items:
 *                       type: object
 *                   media:
 *                     type: array
 *                     items:
 *                       type: object
 *       401:
 *         description: Kimlik doğrulaması başarısız
 */
router.get(
  '/update/reviews/:productId',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { productId } = req.params;
    if (!productId) {
      return res.status(400).json({ message: 'productId is required' });
    }

    const reviews = await postService.getUserProductReviews(
      String(userId),
      productId
    );
    return res.json(reviews);
  })
);

export default router;

