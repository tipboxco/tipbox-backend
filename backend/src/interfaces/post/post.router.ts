import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { createUpload } from '../../infrastructure/config/file-upload.config';
import { validateFileType } from '../../infrastructure/middleware/file-type-validation.middleware';
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
import { getErrorMessage } from '../../infrastructure/errors/error-helper';

const router = Router();
const postService = new PostService();
const s3Service = new S3Service();

const upload = createUpload('IMAGES', 'MEDIUM');

router.use(authMiddleware);

/**
 * Helper function: Normalize eventId by removing invalid values
 * Returns undefined for invalid values, trimmed string for valid ones
 */
function normalizeEventId(eventId: unknown): string | undefined {
  // Return undefined for falsy values
  if (!eventId) {
    return undefined;
  }
  
  // Must be a string
  if (typeof eventId !== 'string') {
    return undefined;
  }
  
  const trimmed = eventId.trim();
  
  // Return undefined for empty strings or common invalid values
  if (trimmed === '' ||
      trimmed.toLowerCase() === 'string' ||
      trimmed.toLowerCase() === 'null' ||
      trimmed.toLowerCase() === 'undefined' ||
      trimmed.toLowerCase() === 'none' ||
      trimmed === '0' ||
      trimmed === 'false') {
    return undefined;
  }
  
  return trimmed;
}

/**
 * Helper function: Upload images from multipart/form-data or use provided URLs
 */
async function processPostImages(
  req: Request,
  userId: string
): Promise<string[]> {
  // Multer files are now typed via type extension
  const files: Express.Multer.File[] = Array.isArray(req.files) 
    ? req.files 
    : (req.file ? [req.file] : []);

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
 * /api/posts/free:
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
  validateFileType('IMAGES'),
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Process images (from files or URLs)
    const images = await processPostImages(req, String(userId));

    const request: CreatePostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      description: req.body.description,
      images: images,
      eventId: normalizeEventId(req.body.eventId), // Optional event ID (normalized)
    };

    if (!request.contextType || !request.contextId || !request.description) {
      return res.status(400).json({
        success: false,
        message: 'contextType, contextId, and description are required',
      });
    }

    const result = await postService.createFreePost(String(userId), request);
    return res.status(201).json(result);
  })
);

/**
 * @openapi
 * /api/posts/tips-and-tricks:
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
  validateFileType('IMAGES'),
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Process images (from files or URLs)
    const images = await processPostImages(req, String(userId));

    const request: CreateTipsAndTricksPostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      description: req.body.description,
      benefitCategory: req.body.benefitCategory as TipsAndTricksBenefitCategory,
      images: images,
      eventId: normalizeEventId(req.body.eventId), // Optional event ID (normalized)
    };

    if (
      !request.contextType ||
      !request.contextId ||
      !request.description ||
      !request.benefitCategory
    ) {
      return res.status(400).json({
        success: false,
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
 * /api/posts/question:
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
  validateFileType('IMAGES'),
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Process images (from files or URLs)
    const images = await processPostImages(req, String(userId));

    const boostEnabledRaw = req.body.boostEnabled;
    const boostEnabled =
      boostEnabledRaw === true ||
      boostEnabledRaw === 'true' ||
      (typeof boostEnabledRaw === 'string' && boostEnabledRaw.toLowerCase() === 'true');

    const request: CreateQuestionPostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      description: req.body.description,
      images: images,
      boostEnabled: !!boostEnabled,
      selectedBoostOptionId: req.body.selectedBoostOptionId,
      eventId: normalizeEventId(req.body.eventId),
    };

    if (!request.contextType || !request.contextId || !request.description) {
      return res.status(400).json({
        success: false,
        message: 'contextType, contextId, and description are required',
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
 * /api/posts/boost-options:
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
    const userPayload = req.user;
    if (!userPayload?.id && !userPayload?.userId && !userPayload?.sub) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const boostOptions = await postService.getBoostOptions();
    return res.json(boostOptions);
  })
);

/**
 * @openapi
 * /api/posts/boost-price:
 *   get:
 *     summary: Boost fiyatını getir (TIPS)
 *     description: Soru gönderisi boost için anlık fiyat. İleride onchain/yoğunluğa göre belirlenecek; şimdilik base değer.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Fiyat ve para birimi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 price:
 *                   type: number
 *                 currency:
 *                   type: string
 *                   example: TIPS
 *                 factors:
 *                   type: object
 *                   nullable: true
 *       401:
 *         description: Kimlik doğrulaması başarısız
 */
router.get(
  '/boost-price',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    if (!userPayload?.id && !userPayload?.userId && !userPayload?.sub) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const result = await postService.getBoostPrice();
    return res.json(result);
  })
);

/**
 * @openapi
 * /api/posts/benchmark:
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
  validateFileType('IMAGES'),
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Process images (from files or URLs)
    const images = await processPostImages(req, String(userId));

    // Parse products - support multiple input formats
    let products: Array<{ productId: string; isSelected: boolean }> = [];
    
    // Format 1: Frontend sends selectedProduct1, selectedProduct2, selectedChoice
    if (req.body.selectedProduct1 || req.body.selectedProduct2) {
      const selectedProduct1 = typeof req.body.selectedProduct1 === 'string' 
        ? JSON.parse(req.body.selectedProduct1) 
        : req.body.selectedProduct1;
      const selectedProduct2 = typeof req.body.selectedProduct2 === 'string' 
        ? JSON.parse(req.body.selectedProduct2) 
        : req.body.selectedProduct2;
      const selectedChoice = req.body.selectedChoice || req.body.selectedchoice;
      
      if (!selectedProduct1 || !selectedProduct2) {
        return res.status(400).json({
          success: false,
          message: 'selectedProduct1 and selectedProduct2 are required',
        });
      }

      // Map id to productId and determine isSelected from selectedChoice
      // Support both id, productId, and externalId fields
      const product1IdOrExternalId = selectedProduct1.id || selectedProduct1.productId || selectedProduct1.externalId;
      const product2IdOrExternalId = selectedProduct2.id || selectedProduct2.productId || selectedProduct2.externalId;
      
      if (!product1IdOrExternalId || !product2IdOrExternalId) {
        return res.status(400).json({
          success: false,
          message: 'Both products must have an id, productId, or externalId field',
        });
      }

      // Resolve product IDs (supports both id and externalId)
      let product1Id: string;
      let product2Id: string;
      try {
        product1Id = await postService.resolveProductId(product1IdOrExternalId);
        product2Id = await postService.resolveProductId(product2IdOrExternalId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to resolve product ID';
        logger.error('Failed to resolve product ID', { 
          product1IdOrExternalId, 
          product2IdOrExternalId, 
          error: errorMessage 
        });
        return res.status(400).json({
          success: false,
          message: errorMessage,
        });
      }

      // Determine which product is selected based on selectedChoice
      // If selectedChoice is "product1", only product1 is selected
      // If selectedChoice is "product2", only product2 is selected
      // If no selectedChoice, both are selected (default for comparison)
      const isProduct1Selected = selectedChoice 
        ? (selectedChoice === 'product1' || selectedChoice === '1' || selectedChoice === selectedProduct1.id || selectedChoice === product1Id || selectedChoice === product1IdOrExternalId)
        : true; // Default: both selected if no choice specified
      const isProduct2Selected = selectedChoice 
        ? (selectedChoice === 'product2' || selectedChoice === '2' || selectedChoice === selectedProduct2.id || selectedChoice === product2Id || selectedChoice === product2IdOrExternalId)
        : true; // Default: both selected if no choice specified
      
      products = [
        { productId: product1Id, isSelected: isProduct1Selected },
        { productId: product2Id, isSelected: isProduct2Selected },
      ];
    }
    // Format 2: products array (legacy format)
    else if (req.body.products) {
      type ProductInput = Array<{ productId: string; isSelected: boolean } | { id: string; isSelected?: boolean }> | string | { productId: string; isSelected: boolean } | { id: string; isSelected?: boolean } | null | undefined;
      let productsInput: ProductInput = req.body.products as ProductInput;
      
      // Handle different input formats
      if (typeof productsInput === 'string') {
        try {
          productsInput = JSON.parse(productsInput);
        } catch (e) {
          logger.warn('Failed to parse products JSON', { products: productsInput, error: e });
          return res.status(400).json({
            success: false,
            message: 'products field must be a valid JSON array',
          });
        }
      }
      
      // If products is already an array, use it directly
      // If it's an object, try to convert to array
      if (!Array.isArray(productsInput)) {
        if (typeof productsInput === 'object' && productsInput !== null) {
          // Try to convert object to array
          productsInput = [productsInput];
        } else {
          logger.error('Products is not an array or object', { 
            type: typeof productsInput, 
            products: productsInput,
            bodyKeys: Object.keys(req.body),
          });
          return res.status(400).json({
            success: false,
            message: `products must be an array, got: ${typeof productsInput}`,
          });
        }
      }

      // Map products array - handle id, productId, and externalId fields
      try {
        // Resolve all product IDs in parallel (supports both id and externalId)
        const productIdPromises = productsInput.map(async (p: { productId?: string; id?: string; externalId?: string }) => {
          const productIdOrExternalId = p.productId || p.id || p.externalId;
          if (!productIdOrExternalId) {
            throw new Error('Product must have either productId, id, or externalId field');
          }
          
          // Resolve product ID (supports both id and externalId)
          const resolvedProductId = await postService.resolveProductId(productIdOrExternalId);
          
          return {
            productId: resolvedProductId,
            isSelected: p.isSelected !== undefined ? p.isSelected : true, // Default to true if not specified
          };
        });
        
        products = await Promise.all(productIdPromises);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Invalid product format';
        logger.error('Failed to resolve product IDs', { error: errorMessage });
        return res.status(400).json({
          success: false,
          message: errorMessage,
        });
      }
    }
    else {
      return res.status(400).json({
        success: false,
        message: 'Either products array or selectedProduct1/selectedProduct2 must be provided',
      });
    }

    // Validate products array structure
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'products must be a non-empty array',
      });
    }

    // Validate that at least 2 products are selected
    const selectedProducts = products.filter((p) => p.isSelected);
    if (selectedProducts.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 products must be selected for comparison',
      });
    }

    const description = (req.body.description ?? req.body.postText ?? req.body.body ?? req.body.content ?? '').trim();
    const contextTypeRaw = req.body.contextType ?? req.body.context_type;
    const contextType = contextTypeRaw && String(contextTypeRaw).toLowerCase() === 'product' ? ContextType.PRODUCT : undefined;
    const contextId = req.body.contextId ?? req.body.context_id ?? req.body.productId;

    const request: CreateBenchmarkPostRequest = {
      contextType: contextType as ContextType,
      contextId: contextId,
      products: products,
      description,
      images: images,
      eventId: normalizeEventId(req.body.eventId ?? req.body.event_id),
    };

    if (!request.contextType) {
      return res.status(400).json({
        success: false,
        message: 'contextType is required and must be "product"',
        field: 'contextType',
      });
    }
    if (!request.contextId || String(request.contextId).trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'contextId is required (product id for context)',
        field: 'contextId',
      });
    }
    if (!request.description) {
      return res.status(400).json({
        success: false,
        message: 'description is required (or postText, body, content)',
        field: 'description',
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
 * /api/posts/experience:
 *   post:
 *     summary: Deneyim paylaşımı gönderisi oluştur
 *     description: |
 *       Product için deneyim paylaşımı gönderisi oluşturur.
 *       
 *       **Context Seçenekleri:**
 *       1. Product context: `contextType: "product"`, `contextId: "prod_xxx"`
 *       2. Sub-category context + Product: `contextType: "sub_category"`, `contextId: "pcat_xxx"`, `productId: "prod_xxx"`
 *       3. Product-group context + Product: `contextType: "product_group"`, `contextId: "uuid"`, `productId: "prod_xxx"`
 *       
 *       **Not:** Experience post'lar her zaman bir ürün ile ilişkilidir. Sub-category veya product-group context'inde oluşturuluyorsa `productId` field'ı zorunludur.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateExperiencePostRequest'
 *           examples:
 *             productContext:
 *               summary: Product context (Standard)
 *               value:
 *                 contextType: "product"
 *                 contextId: "prod_01KGM792ABCD1234567890"
 *                 content: "Gayet iyi kulaklık..."
 *                 experience: [{"type": "Price and Shopping", "content": "...", "rating": 4}]
 *                 status: "tested"
 *                 selectedDurationId: "1 Month"
 *                 selectedLocationId: "Could Be Better"
 *                 selectedPurposeId: "Rarely Use"
 *                 experienceSnippetId: "uuid"
 *             subCategoryContext:
 *               summary: Sub-category context + Product
 *               value:
 *                 contextType: "sub_category"
 *                 contextId: "pcat_01KGM792MFBC397KVRRTSCR7S3"
 *                 productId: "prod_01KGM792ABCD1234567890"
 *                 content: "Gayet iyi kulaklık..."
 *                 experience: [{"type": "Price and Shopping", "content": "...", "rating": 4}]
 *                 status: "tested"
 *                 selectedDurationId: "1 Month"
 *                 selectedLocationId: "Could Be Better"
 *                 selectedPurposeId: "Rarely Use"
 *                 experienceSnippetId: "uuid"
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
  validateFileType('IMAGES'),
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
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
          success: false,
          message: 'experience field must be a valid JSON array or object',
        });
      }
    }

    // Support both new field names (selectedDurationId) and old field names (step1Duration). Duration, location, purpose zorunlu.
    const rawDurationId = req.body.selectedDurationId || req.body.step1Duration || req.body.selectedDuration || null;
    const rawLocationId = req.body.selectedLocationId || req.body.selectedCondition || req.body.selectedLocation || null;
    const rawPurposeId = req.body.selectedPurposeId || req.body.selectedFrequency || req.body.selectedPurpose || null;

    const hasDuration = rawDurationId != null && String(rawDurationId).trim() !== '';
    const hasLocation = rawLocationId != null && String(rawLocationId).trim() !== '';
    const hasPurpose = rawPurposeId != null && String(rawPurposeId).trim() !== '';
    if (!hasDuration || !hasLocation || !hasPurpose) {
      return res.status(400).json({
        success: false,
        message: 'duration, location and purpose are required. Send selectedDurationId, selectedLocationId (localization), selectedPurposeId (or legacy names: step1Duration, selectedLocation, selectedPurpose).',
        fields: {
          duration: !hasDuration ? 'missing' : 'provided',
          location: !hasLocation ? 'missing' : 'provided',
          purpose: !hasPurpose ? 'missing' : 'provided',
        },
      });
    }

    // Resolve option IDs (name to UUID conversion handled in service layer)
    const resolvedIds = await postService.resolveExperienceOptionIds({
      durationId: rawDurationId,
      locationId: rawLocationId,
      purposeId: rawPurposeId,
    });

    const selectedDurationId = resolvedIds.durationId;
    const selectedLocationId = resolvedIds.locationId;
    const selectedPurposeId = resolvedIds.purposeId;

    const experienceSnippetId =
      typeof req.body.experienceSnippetId === 'string' ? req.body.experienceSnippetId.trim() : '';

    // status = I owned / I tried (ZORUNLU). Gönderi kullanıcının envanterindeki ürün mü yoksa sadece denediği ürün mü bilgisi olmadan kabul edilmez.
    const hasStatusField = req.body.status !== undefined && req.body.status !== null && req.body.status !== '';
    const hasIsOwnedField = req.body.isOwned !== undefined && req.body.isOwned !== null;
    if (!hasStatusField && !hasIsOwnedField) {
      return res.status(400).json({
        success: false,
        message: 'status or isOwned is required. You must indicate whether the product is in your inventory (I owned) or you only tried it (I tried). Send status: "own"|"tested"|"tried" or isOwned: true|false.',
        field: 'status',
        allowedValues: { status: ['own', 'tested', 'tried'], isOwned: [true, false] },
      });
    }
    let statusRaw = req.body.status;
    if (statusRaw === undefined || statusRaw === null || statusRaw === '') {
      statusRaw = req.body.isOwned === true || req.body.isOwned === 'true' ? ExperienceStatus.OWN : ExperienceStatus.TEST;
    }
    if (typeof statusRaw === 'string') statusRaw = statusRaw.trim().toLowerCase();
    if (statusRaw === 'tried') statusRaw = ExperienceStatus.TEST;
    const status = (statusRaw === ExperienceStatus.OWN || statusRaw === ExperienceStatus.TEST ? statusRaw : null) as ExperienceStatus | null;

    const request: CreateExperiencePostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      productId: req.body.productId, // Optional: for sub-category/product-group contexts
      selectedDurationId: selectedDurationId as string | null,
      selectedLocationId: selectedLocationId as string | null,
      selectedPurposeId: selectedPurposeId as string | null,
      content: req.body.content || req.body.experienceText || '',
      experience: Array.isArray(experience) ? experience : [],
      status: status as ExperienceStatus,
      images: images,
      experienceSnippetId,
      eventId: normalizeEventId(req.body.eventId), // Optional event ID (normalized)
    };

    // Validate required fields (duration, location, purpose zorunlu). Resolution başarısızsa kabul edilen değerleri döndür.
    if (
      !request.contextType ||
      !request.contextId ||
      !request.selectedDurationId ||
      !request.selectedLocationId ||
      !request.selectedPurposeId ||
      !request.content ||
      (typeof request.content === 'string' && request.content.trim() === '') ||
      !Array.isArray(request.experience) ||
      request.experience.length === 0
      // experienceSnippetId zorunlu DEĞİL: AI split başarısız olduğunda (ör. Gemini rate limit)
      // kullanıcının kendi metniyle (experience array) gönderi oluşturulabilmeli.
    ) {
      const missingResolution =
        !request.selectedDurationId ||
        !request.selectedLocationId ||
        !request.selectedPurposeId;
      const body: Record<string, unknown> = {
        success: false,
        message:
          'Required fields: contextType, contextId, selectedDurationId (duration), selectedLocationId (location), selectedPurposeId (purpose), content, experience (array), status, experienceSnippetId. Sent values for duration/location/purpose must match an option name or UUID.',
        received: {
          contextType: request.contextType,
          contextId: request.contextId,
          selectedDurationId: request.selectedDurationId ? 'provided' : 'missing',
          selectedLocationId: request.selectedLocationId ? 'provided' : 'missing',
          selectedPurposeId: request.selectedPurposeId ? 'provided' : 'missing',
          content: request.content ? 'provided' : 'missing',
          experience: Array.isArray(request.experience) ? `array(${request.experience.length})` : typeof request.experience,
          status: request.status ?? 'missing',
          experienceSnippetId: request.experienceSnippetId ? 'provided' : 'missing',
        },
      };
      if (missingResolution) {
        try {
          const options = await postService.getExperienceOptions();
          body.availableOptions = {
            duration: options.durations.map((d) => d.name),
            location: options.locations.map((l) => l.name),
            purpose: options.purposes.map((p) => p.name),
          };
        } catch {
          // ignore
        }
      }
      return res.status(400).json(body);
    }

    // status zorunlu ve sadece 'own' (I owned) veya 'tested' (I tried) kabul et
    if (!request.status || !Object.values(ExperienceStatus).includes(request.status as ExperienceStatus)) {
      return res.status(400).json({
        success: false,
        message: 'status is required and must be "own" (I owned) or "tested" (I tried). It indicates whether the product is in the user\'s inventory or was only tried.',
        field: 'status',
        allowedValues: [ExperienceStatus.OWN, ExperienceStatus.TEST],
        received: request.status ?? 'missing',
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
 * /api/posts/experience/split:
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
    const userPayload = req.user;
    if (!userPayload?.id && !userPayload?.userId && !userPayload?.sub) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const userId = userPayload.id || userPayload.userId || userPayload.sub;

    const request: SplitExperienceRequest = {
      userId,
      productId: req.body.productId,
      content: req.body.content,
    };

    if (!request.content) {
      return res.status(400).json({ success: false, message: 'content is required' });
    }

    if (!request.productId) {
      return res.status(400).json({ success: false, message: 'productId is required' });
    }

    const result = await postService.splitExperience(request);
    return res.json(result);
  })
);

/**
 * @openapi
 * /api/posts/experience/options:
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
    const userPayload = req.user;
    if (!userPayload?.id && !userPayload?.userId && !userPayload?.sub) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const options = await postService.getExperienceOptions();
    return res.json(options);
  })
);

/**
 * @openapi
 * /api/posts/{postId}/boost:
 *   patch:
 *     summary: Post boost aç/kapa
 *     description: Soru gönderisi için boost açar veya kapatır. Açarken TIPS düşülür; kapatırken iade yok.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [enabled]
 *             properties:
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Boost durumu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 postId:
 *                   type: string
 *                 isBoosted:
 *                   type: boolean
 *                 boostPrice:
 *                   type: number
 *                   nullable: true
 *                 message:
 *                   type: string
 *                   nullable: true
 *       400:
 *         description: Yetersiz TIPS veya geçersiz istek
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       404:
 *         description: Gönderi bulunamadı
 */
router.patch(
  '/:postId/boost',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const postId = req.params.postId;
    if (!postId) {
      return res.status(400).json({ success: false, message: 'postId is required' });
    }

    const enabled = req.body.enabled === true || req.body.enabled === 'true';
    const result = await postService.togglePostBoost(postId, String(userId), enabled);
    return res.json(result);
  })
);

/**
 * @openapi
 * /api/posts/{id}:
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
    const userPayload = req.user;
    if (!userPayload?.id && !userPayload?.userId && !userPayload?.sub) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'id is required' });
    }

    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const post = await postService.getPostById(id, userId ? String(userId) : undefined);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    return res.json(post);
  })
);

/**
 * @openapi
 * /api/posts/{id}/likes:
 *   get:
 *     summary: Post beğenenlerini listele
 *     description: Belirli bir post'a beğeni atan kullanıcıları listeler. Instagram gibi bottom sheet'te gösterilmek için tasarlanmıştır.
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
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Sayfa başına kullanıcı sayısı
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Atlanacak kullanıcı sayısı
 *     responses:
 *       200:
 *         description: Post beğenenleri başarıyla getirildi
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
 *                         description: Kullanıcı ID'si
 *                       username:
 *                         type: string
 *                         nullable: true
 *                         description: Kullanıcı adı
 *                       avatar:
 *                         type: string
 *                         nullable: true
 *                         description: Kullanıcı avatar URL'i
 *                       tags:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             type:
 *                               type: string
 *                               enum: [verified, expert, cosmetic, title]
 *                             label:
 *                               type: string
 *                               description: Tag etiketi (badge adı, title adı vb.)
 *                             imageUrl:
 *                               type: string
 *                               nullable: true
 *                               description: Tag görseli (badge görseli vb.)
 *                       likedAt:
 *                         type: string
 *                         format: date-time
 *                         description: Beğeni tarihi
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       404:
 *         description: Post bulunamadı
 */
router.get(
  '/:id/likes',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    if (!userPayload?.id && !userPayload?.userId && !userPayload?.sub) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id: rawPostId } = req.params;
    if (!rawPostId) {
      return res.status(400).json({ success: false, message: 'Post ID is required' });
    }

    const postId = await postService.resolvePostId(rawPostId.trim());
    if (!postId) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const { getPrisma } = await import('../../infrastructure/repositories/prisma.client');
    const prisma = getPrisma();
    const post = await prisma.contentPost.findUnique({
      where: { id: postId },
      select: { id: true },
    });

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Pagination parametreleri
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offsetParam = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const limit = Math.min(Math.max(limitParam, 1), 100);
    const offset = Math.max(offsetParam, 0);

    // Media URL resolver
    const { resolveMediaUrl } = await import('../../infrastructure/config/media.config');

    // Post beğenilerini getir (user bilgileri ile)
    const [likes, total] = await Promise.all([
      prisma.contentLike.findMany({
        where: {
          postId,
          commentId: null, // Sadece post beğenileri
        },
        include: {
          user: {
            include: {
              profile: {
                select: {
                  userName: true,
                  displayName: true,
                  cosmeticBadgeId: true,
                  cosmeticBadge: {
                    select: {
                      id: true,
                      name: true,
                      imageUrl: true,
                      type: true,
                    },
                  },
                },
              },
              avatars: {
                where: { isActive: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
              titles: {
                orderBy: { earnedAt: 'desc' },
                take: 1,
              },
              userBadges: {
                where: {
                  claimed: true,
                  visibility: 'public',
                },
                include: {
                  badge: {
                    select: {
                      id: true,
                      name: true,
                      imageUrl: true,
                      type: true,
                    },
                  },
                },
                orderBy: { claimedAt: 'desc' },
                take: 5, // En fazla 5 badge göster
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.contentLike.count({
        where: {
          postId,
          commentId: null,
        },
      }),
    ]);

    // Kullanıcı bilgilerini formatla
    const users = likes.map((like) => {
      const user = like.user;
      const profile = user.profile;
      const avatar = user.avatars[0];
      const title = user.titles[0];
      const cosmeticBadge = profile?.cosmeticBadge || null;
      const expertBadges = user.userBadges
        .filter((ub) => ub.badge.type === 'ACHIEVEMENT' || ub.badge.type === 'EVENT')
        .map((ub) => ub.badge);

      // Tags oluştur
      const tags: Array<{
        type: 'verified' | 'expert' | 'cosmetic' | 'title';
        label: string;
        imageUrl: string | null;
      }> = [];

      // Cosmetic badge (profil badge'i)
      if (cosmeticBadge) {
        tags.push({
          type: 'cosmetic',
          label: cosmeticBadge.name,
          imageUrl: resolveMediaUrl(cosmeticBadge.imageUrl),
        });
      }

      // Expert badges (achievement/event badges)
      expertBadges.forEach((badge) => {
        tags.push({
          type: 'expert',
          label: badge.name,
          imageUrl: resolveMediaUrl(badge.imageUrl),
        });
      });

      // User title
      if (title) {
        tags.push({
          type: 'title',
          label: title.title,
          imageUrl: null,
        });
      }

      // Verified tag (eğer verified badge varsa)
      const verifiedBadge = user.userBadges.find((ub) =>
        ub.badge.name.toLowerCase().includes('verified')
      );
      if (verifiedBadge) {
        tags.push({
          type: 'verified',
          label: verifiedBadge.badge.name,
          imageUrl: resolveMediaUrl(verifiedBadge.badge.imageUrl),
        });
      }

      return {
        id: user.id,
        username: profile?.userName || null,
        avatar: resolveMediaUrl(avatar?.imageUrl || null, true),
        tags,
        likedAt: like.createdAt.toISOString(),
      };
    });

    return res.json({
      success: true,
      data: users,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + users.length < total,
      },
    });
  })
);

/**
 * @openapi
 * /api/posts/{id}:
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
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'id is required' });
    }

    try {
      const deleted = await postService.deletePost(String(userId), id.trim());
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Post not found' });
      }
      return res.status(204).send();
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (error instanceof Error && message.startsWith('Forbidden')) {
        return res.status(403).json({ success: false, message: 'You are not allowed to delete this post' });
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /api/posts/update:
 *   post:
 *     summary: Güncelleme gönderisi oluştur
 *     description: |
 *       Product için güncelleme gönderisi oluşturur.
 *       Zorunlu alanlar experiencePostId ve content. contextType/contextId opsiyoneldir;
 *       boşsa experience post'taki productId kullanılır (Medusa'da tek category tablosu ile category/subcategory/product group aynı yapıda, contextId zorunlu değil).
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
  validateFileType('IMAGES'),
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Process images (from files or URLs)
    const images = await processPostImages(req, String(userId));

    const request: CreateUpdatePostRequest = {
      // Update posts are always for products, ignore sent contextType
      contextType: ContextType.PRODUCT,
      contextId: req.body.contextId != null && req.body.contextId !== '' ? String(req.body.contextId).trim() : undefined,
      experiencePostId: (req.body.experiencePostId ?? '').toString().trim(),
      content: req.body.content,
      images: images,
      eventId: normalizeEventId(req.body.eventId),
    };

    if (!request.experiencePostId || !request.content) {
      return res.status(400).json({
        success: false,
        message: 'experiencePostId and content are required. contextType/contextId are optional (derived from experience post when missing).',
      });
    }

    try {
      const result = await postService.createUpdatePost(String(userId), request);
      return res.status(201).json(result);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg === 'LEGACY_INVENTORY_NO_POST') {
        return res.status(400).json({
          success: false,
          message: 'This is a legacy inventory item without an associated experience post',
          code: 'LEGACY_INVENTORY_NO_POST',
          hint: 'Update posts can only be created for experience posts. This inventory item was created before the new post system and does not have a corresponding post. Please create a new experience post for this product first.',
        });
      }
      if (errMsg === 'Experience post not found') {
        return res.status(404).json({
          success: false,
          message: errMsg,
          code: 'EXPERIENCE_POST_NOT_FOUND',
          hint: 'experiencePostId must be the experience post id (ULID, 26 chars from post detail or feed item id). If opening from bookmarks, use the post id from the item (item.id), not the bookmark id.',
        });
      }
      if (errMsg?.includes('legacy inventory-based reviews')) {
        return res.status(400).json({
          success: false,
          message: errMsg,
          code: 'LEGACY_REVIEW_NOT_SUPPORTED',
          hint: 'Update posts cannot be created for old inventory-based reviews. The review must be a ContentPost (experience post). Please create a new experience post for this product first.',
        });
      }
      throw err;
    }
  })
);

/**
 * @openapi
 * /api/posts/update/reviews/{productId}:
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
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { productId } = req.params;
    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required' });
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
 * /api/posts/split-experience:
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
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const request: SplitExperienceRequest = {
      userId: String(userId),
      productId: req.body.productId,
      content: req.body.content,
    };

    if (!request.productId || !request.content) {
      return res.status(400).json({
        success: false,
        message: 'productId and content are required',
      });
    }

    if (request.content.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'content must be at least 10 characters',
      });
    }

    const result = await postService.splitExperience(request);
    return res.json(result);
  })
);

/**
 * @openapi
 * /api/posts/search:
 *   get:
 *     summary: Post'larda arama yap
 *     description: Post başlığı ve içeriğinde arama yapar
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Arama terimi
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Sayfa başına item sayısı
 *     responses:
 *       200:
 *         description: Arama sonuçları
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     cursor:
 *                       type: string
 *                       nullable: true
 *                     hasMore:
 *                       type: boolean
 *                     limit:
 *                       type: integer
 *       400:
 *         description: Arama terimi gerekli
 *       401:
 *         description: Kimlik doğrulaması başarısız
 */
router.get(
  '/search',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    if (!userPayload?.id && !userPayload?.userId && !userPayload?.sub) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const query = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query (q) is required' });
    }

    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) && limitParam > 0 && limitParam <= 50 ? limitParam : 20;

    const result = await postService.searchPosts(query, { cursor, limit });
    return res.json(result);
  })
);

/**
 * @openapi
 * /api/posts/{eventId}/post:
 *   post:
 *     summary: Event için post oluştur
 *     description: Belirli bir event için post oluşturur. InventoryId ile productId otomatik olarak çözümlenir.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID (ULID format)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - body
 *               - contextType
 *             properties:
 *               body:
 *                 type: string
 *                 maxLength: 2000
 *                 description: Post içeriği/açıklaması
 *               contextType:
 *                 type: string
 *                 enum: [product, sub_category]
 *                 description: Context tipi
 *               contextId:
 *                 type: string
 *                 description: Product ID veya Sub-category ID (ULID format). inventoryId ile birlikte kullanılamaz.
 *               inventoryId:
 *                 type: string
 *                 description: Inventory ID (UUID format). Belirtilirse productId otomatik olarak inventory'den çekilir.
 *               productStatus:
 *                 type: string
 *                 enum: [own, tried]
 *                 description: (Roasts) Product status for the event post
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Post görselleri (maksimum 10, her biri max 5MB)
 *     responses:
 *       201:
 *         description: Post başarıyla oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: Oluşturulan post'un ID'si (ULID format)
 *                 message:
 *                   type: string
 *                   description: Başarı mesajı
 *       400:
 *         description: Geçersiz istek
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       403:
 *         description: Event'e katılmamış
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: NOT_JOINED
 *                     message:
 *                       type: string
 *                       example: You must join this event before sharing a post
 *       404:
 *         description: Event veya context bulunamadı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                     message:
 *                       type: string
 *       413:
 *         description: Dosya boyutu limiti aşıldı
 */
router.post(
  '/:eventId/post',
  upload.array('images', 10), // Max 10 images per spec
  validateFileType('IMAGES'),
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const eventId = req.params.eventId;
    if (!eventId) {
      return res.status(400).json({ success: false, message: 'Event ID is required' });
    }

    // Validate required fields before processing images
    let { body, contextType, contextId, inventoryId, productStatus } = req.body;

    // ✅ Auto-detect contextType from inventoryId (inventory items are always products)
    if (inventoryId && !contextType) {
      contextType = 'product';
      logger.info('Auto-detected contextType as product from inventoryId', { 
        inventoryId, 
        userId 
      });
    }

    if (!body || !contextType) {
      return res.status(400).json({
        success: false,
        message: 'body and contextType are required'
      });
    }

    // contextId OR inventoryId gerekli (en az biri)
    if (!contextId && !inventoryId) {
      return res.status(400).json({
        success: false,
        message: 'Either contextId or inventoryId is required'
      });
    }

    // Validate body - must not be empty after trim
    const trimmedBody = typeof body === 'string' ? body.trim() : '';
    if (trimmedBody.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'body must be at least 1 character'
      });
    }

    // Validate body length (max 2000 chars)
    if (trimmedBody.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'body must be at most 2000 characters'
      });
    }

    // Validate contextType
    if (contextType !== 'product' && contextType !== 'sub_category') {
      return res.status(400).json({
        success: false,
        message: "contextType must be 'product' or 'sub_category'"
      });
    }

    // Validate image count
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 10 images allowed'
      });
    }

    try {
      // Process images first
      const imageUrls = await processPostImages(req, String(userId));

      // Create post request - service will handle all validations
      const postData: CreatePostRequest = {
        body: trimmedBody,
        contextType: contextType as ContextType,
        contextId: contextId || '', // Will be overridden by inventoryId if provided
        inventoryId: inventoryId, // ✅ YENİ: InventoryId'yi service'e gönder
        images: imageUrls,
        eventId: eventId,
        productStatus: typeof productStatus === 'string' ? (productStatus as 'own' | 'tried') : undefined,
      };

      const result = await postService.createFreePost(String(userId), postData);
      
      // Return only id and message per spec
      return res.status(201).json({
        id: result.id,
        message: 'Post created successfully'
      });
    } catch (error) {
      const message = getErrorMessage(error);
      
      logger.error('Error creating event post:', { 
        error, 
        userId, 
        eventId, 
        contextType, 
        contextId: req.body.contextId,
        inventoryId: req.body.inventoryId 
      });
      
      // Parse error message to return appropriate response
      if (message.includes('Event not found')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'EVENT_NOT_FOUND',
            message: 'Event not found'
          }
        });
      }
      
      if (message.includes('must join this event')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'NOT_JOINED',
            message: 'You must join this event before sharing a post'
          }
        });
      }

      // ✅ YENİ: Inventory not found error
      if (message.includes('Inventory item not found')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'INVENTORY_NOT_FOUND',
            message: message
          }
        });
      }

      // ✅ YENİ: Inventory ownership error
      if (message.includes('does not belong to you')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INVENTORY_FORBIDDEN',
            message: message
          }
        });
      }
      
      if (message.includes('does not exist or has been deleted')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CONTEXT_NOT_FOUND',
            message: message // User-friendly message from service
          }
        });
      }
      
      if (message.includes('not found') || message.includes('does not exist')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CONTEXT_NOT_FOUND',
            message: 'Product or sub-category not found'
          }
        });
      }
      
      // Generic error response
      return res.status(400).json({
        success: false,
        message: message || 'Failed to create post'
      });
    }
  })
);

export default router;

