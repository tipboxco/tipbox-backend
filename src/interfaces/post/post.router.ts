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

// Multer configuration for post image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    // Only image files allowed (including HEIC for iOS devices)
    const allowedMimeTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'image/heic', 'image/heif' // HEIC/HEIF support for iOS
    ];
    
    // Check MIME type
    if (file.mimetype && allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else if (file.originalname) {
      // Fallback: Check file extension if MIME type is not available
      const ext = file.originalname.split('.').pop()?.toLowerCase();
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
      if (ext && allowedExtensions.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`Desteklenmeyen dosya formatı: ${file.mimetype || ext || 'bilinmeyen'}. Sadece resim dosyaları yüklenebilir (JPG, PNG, GIF, WebP, HEIC)`));
      }
    } else {
      cb(new Error('Dosya formatı algılanamadı. Sadece resim dosyaları yüklenebilir (JPG, PNG, GIF, WebP, HEIC)'));
    }
  },
});

router.use(authMiddleware);

/**
 * Helper function: Upload images from multipart/form-data or use provided URLs
 */
async function processPostImages(
  req: Request,
  userId: string
): Promise<string[]> {
  const multerReq = req as any;
  const files: Express.Multer.File[] = Array.isArray(multerReq.files) 
    ? multerReq.files 
    : (multerReq.file ? [multerReq.file] : []);

  // If files are uploaded via multipart/form-data
  if (files && files.length > 0) {
    const imageUrls: string[] = [];
    
    for (const file of files) {
      try {
        // Determine file extension from MIME type
        const mimeToExtension: Record<string, string> = {
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/png': 'png',
          'image/gif': 'gif',
          'image/webp': 'webp',
          'image/heic': 'heic', // HEIC support for iOS
          'image/heif': 'heif', // HEIF support for iOS
        };

        let fileExtension = 'jpg'; // Default
        if (file.mimetype && mimeToExtension[file.mimetype]) {
          fileExtension = mimeToExtension[file.mimetype];
        } else if (file.originalname && file.originalname.includes('.')) {
          const parts = file.originalname.split('.');
          if (parts.length > 1) {
            const ext = parts[parts.length - 1].toLowerCase();
            // Validate extension (including HEIC/HEIF for iOS)
            const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
            if (allowedExtensions.includes(ext)) {
              fileExtension = ext;
            }
          }
        }

        // Create file path
        const fileName = `posts/${userId}/${uuidv4()}.${fileExtension}`;
        
        // Upload to S3
        const imageUrl = await s3Service.uploadFile(fileName, file.buffer, file.mimetype);
        imageUrls.push(imageUrl);

        logger.info({
          message: 'Post image uploaded',
          userId,
          fileName,
          fileSize: file.size,
          mimeType: file.mimetype,
        });
      } catch (error) {
        logger.error({
          message: `Failed to upload post image: ${error instanceof Error ? error.message : 'Unknown error'}`,
          userId,
          error,
        });
        throw new Error(`Image upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return imageUrls;
  }

  // If images are provided as URLs (JSON request)
  if (req.body.images && Array.isArray(req.body.images)) {
    return req.body.images;
  }

  return [];
}

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
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePostRequest'
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - contextType
 *               - contextId
 *               - description
 *             properties:
 *               contextType:
 *                 type: string
 *                 enum: [product_group, product, sub_category]
 *               contextId:
 *                 type: string
 *               description:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               eventId:
 *                 type: string
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
  upload.array('images', 10), // Support up to 10 images via multipart/form-data
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Process images (from files or URLs)
    const images = await processPostImages(req, String(userId));

    const request: CreatePostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      description: req.body.description,
      images: images,
      eventId: req.body.eventId, // Optional event ID
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
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTipsAndTricksPostRequest'
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
  upload.array('images', 10), // Support up to 10 images via multipart/form-data
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Process images (from files or URLs)
    const images = await processPostImages(req, String(userId));

    const request: CreateTipsAndTricksPostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      description: req.body.description,
      benefitCategory: req.body.benefitCategory as TipsAndTricksBenefitCategory,
      images: images,
      eventId: req.body.eventId, // Optional event ID
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
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateQuestionPostRequest'
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
  upload.array('images', 10), // Support up to 10 images via multipart/form-data
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Process images (from files or URLs)
    const images = await processPostImages(req, String(userId));

    const request: CreateQuestionPostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      description: req.body.description,
      images: images,
      selectedBoostOptionId: req.body.selectedBoostOptionId,
      eventId: req.body.eventId, // Optional event ID
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
  upload.array('images', 10), // Support up to 10 images via multipart/form-data
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Process images (from files or URLs)
    const images = await processPostImages(req, String(userId));

    // Parse products if it's a JSON string (from multipart/form-data)
    let products: any = req.body.products;
    
    // Handle different input formats
    if (typeof products === 'string') {
      try {
        products = JSON.parse(products);
      } catch (e) {
        logger.warn('Failed to parse products JSON', { products, error: e });
        return res.status(400).json({
          message: 'products field must be a valid JSON array',
        });
      }
    }
    
    // If products is already an array, use it directly
    // If it's an object, try to convert to array
    if (!Array.isArray(products)) {
      if (typeof products === 'object' && products !== null) {
        // Try to convert object to array
        products = [products];
      } else {
        logger.error('Products is not an array or object', { 
          type: typeof products, 
          products,
          bodyKeys: Object.keys(req.body),
        });
        return res.status(400).json({
          message: `products must be an array, got: ${typeof products}`,
        });
      }
    }

    // Validate products array structure
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        message: 'products must be a non-empty array',
      });
    }

    const request: CreateBenchmarkPostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      products: products as Array<{ productId: string; isSelected: boolean }>,
      description: req.body.description,
      images: images,
      eventId: req.body.eventId,
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
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateExperiencePostRequest'
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
  upload.array('images', 10), // Support up to 10 images via multipart/form-data
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Process images (from files or URLs)
    const images = await processPostImages(req, String(userId));

    // Parse experience if it's a JSON string
    let experience = req.body.experience;
    if (typeof experience === 'string') {
      try {
        experience = JSON.parse(experience);
      } catch (e) {
        return res.status(400).json({
          message: 'experience field must be a valid JSON array or object',
        });
      }
    }

    // Support both new field names (selectedDurationId) and old field names (step1Duration)
    const rawDurationId = req.body.selectedDurationId || req.body.step1Duration || req.body.selectedDuration || null;
    const rawLocationId = req.body.selectedLocationId || req.body.selectedCondition || req.body.selectedLocation || null;
    const rawPurposeId = req.body.selectedPurposeId || req.body.selectedFrequency || req.body.selectedPurpose || null;

    // Resolve option IDs (name to UUID conversion handled in service layer)
    const resolvedIds = await postService.resolveExperienceOptionIds({
      durationId: rawDurationId,
      locationId: rawLocationId,
      purposeId: rawPurposeId,
    });

    const selectedDurationId = resolvedIds.durationId;
    const selectedLocationId = resolvedIds.locationId;
    const selectedPurposeId = resolvedIds.purposeId;

    const request: CreateExperiencePostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      selectedDurationId: selectedDurationId as string | null,
      selectedLocationId: selectedLocationId as string | null,
      selectedPurposeId: selectedPurposeId as string | null,
      content: req.body.content || req.body.experienceText || '',
      experience: Array.isArray(experience) ? experience : [],
      status: req.body.status as ExperienceStatus,
      images: images,
      experienceSnippetId: req.body.experienceSnippetId,
      eventId: req.body.eventId, // Optional event ID
    };

    // Validate required fields
    if (
      !request.contextType ||
      !request.contextId ||
      !request.content ||
      (typeof request.content === 'string' && request.content.trim() === '') ||
      !Array.isArray(request.experience) ||
      request.experience.length === 0 ||
      !request.status
    ) {
      return res.status(400).json({
        message:
          'Required fields: contextType, contextId, content, experience (array), status',
        received: {
          contextType: request.contextType,
          contextId: request.contextId,
          selectedDurationId: request.selectedDurationId || null,
          selectedLocationId: request.selectedLocationId || null,
          selectedPurposeId: request.selectedPurposeId || null,
          content: request.content ? 'provided' : 'missing',
          experience: Array.isArray(request.experience) ? `array(${request.experience.length})` : typeof request.experience,
          status: request.status,
        },
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

    const userId = userPayload.id || userPayload.userId || userPayload.sub;

    const request: SplitExperienceRequest = {
      userId,
      productId: req.body.productId,
      content: req.body.content,
    };

    if (!request.content) {
      return res.status(400).json({ message: 'content is required' });
    }

    if (!request.productId) {
      return res.status(400).json({ message: 'productId is required' });
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
 *   get:
 *     summary: Gönderi detayını getir
 *     description: Post ID'sine göre gönderi detayını getirir.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID'si
 *     responses:
 *       200:
 *         description: Gönderi detayı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       404:
 *         description: Gönderi bulunamadı
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    if (!userPayload?.id && !userPayload?.userId && !userPayload?.sub) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: 'id is required' });
    }

    const post = await postService.getPostById(id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    return res.json(post);
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
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUpdatePostRequest'
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
  upload.array('images', 10), // Support up to 10 images via multipart/form-data
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Process images (from files or URLs)
    const images = await processPostImages(req, String(userId));

    const request: CreateUpdatePostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      content: req.body.content,
      images: images,
      eventId: req.body.eventId, // Optional event ID
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

/**
 * @openapi
 * /posts/split-experience:
 *   post:
 *     summary: Deneyim metnini AI ile kategorilere ayır
 *     description: Kullanıcının yazdığı deneyim metnini Gemini AI kullanarak "Price and Shopping Experience" ve "Product and Usage Experience" kategorilerine ayırır.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SplitExperienceRequest'
 *     responses:
 *       200:
 *         description: Deneyim başarıyla ayrıştırıldı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SplitExperienceResponse'
 *       400:
 *         description: Geçersiz istek
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       503:
 *         description: AI servisi hatası
 */
router.post(
  '/split-experience',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const request: SplitExperienceRequest = {
      userId: String(userId),
      productId: req.body.productId,
      content: req.body.content,
    };

    if (!request.productId || !request.content) {
      return res.status(400).json({
        message: 'productId and content are required',
      });
    }

    if (request.content.trim().length < 10) {
      return res.status(400).json({
        message: 'content must be at least 10 characters',
      });
    }

    const result = await postService.splitExperience(request);
    return res.json(result);
  })
);

export default router;

