import { Router, Request, Response } from 'express';
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

const router = Router();
const postService = new PostService();

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
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePostRequest'
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
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const request: CreatePostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      description: req.body.description,
      images: req.body.images || [],
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
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const request: CreateTipsAndTricksPostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      description: req.body.description,
      benefitCategory: req.body.benefitCategory as TipsAndTricksBenefitCategory,
      images: req.body.images || [],
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
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const request: CreateQuestionPostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      description: req.body.description,
      images: req.body.images || [],
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
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const request: CreateExperiencePostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      selectedDurationId: req.body.selectedDurationId,
      selectedLocationId: req.body.selectedLocationId,
      selectedPurposeId: req.body.selectedPurposeId,
      content: req.body.content,
      experience: req.body.experience,
      status: req.body.status as ExperienceStatus,
      images: req.body.images || [],
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
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const request: CreateUpdatePostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      content: req.body.content,
      images: req.body.images || [],
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

