import { Router, Request, Response } from 'express';
import { InventoryService } from '../../application/inventory/inventory.service';
import { PostService } from '../../application/post/post.service';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { CreateInventoryRequest } from './inventory.dto';
import { ExperienceStatus } from '../../domain/content/experience-status.enum';

const router = Router();
const inventoryService = new InventoryService();
const postService = new PostService();

/**
 * @openapi
 * /inventory:
 *   post:
 *     summary: Inventory'ye yeni ürün ekle
 *     description: Kullanıcının sahip olduğu veya test ettiği bir ürünü inventory listesine ekler, deneyimlerini ve görsellerini kaydeder.
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - selectedDurationId
 *               - selectedLocationId
 *               - selectedPurposeId
 *               - content
 *               - experience
 *               - status
 *             properties:
 *               productId:
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
 *                   type: object
 *                   required: [type, content, rating]
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [price_and_shopping, product_and_usage]
 *                     content:
 *                       type: string
 *                     rating:
 *                       type: number
 *                       minimum: 1
 *                       maximum: 5
 *               status:
 *                 type: string
 *                 enum: [own, tested]
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Görsel URL listesi
 *     responses:
 *       201:
 *         description: Inventory item başarıyla oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItemResponse'
 *       400:
 *         description: Geçersiz istek
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const body = req.body as CreateInventoryRequest;
    const errors: string[] = [];

    if (body.userId && body.userId !== userId) {
      return res.status(403).json({ message: 'Payload userId does not match authenticated user' });
    }

    if (!body.productId || typeof body.productId !== 'string') {
      errors.push('productId is required');
    }

    if (!body.selectedDurationId || typeof body.selectedDurationId !== 'string') {
      errors.push('selectedDurationId is required');
    }

    if (!body.selectedLocationId || typeof body.selectedLocationId !== 'string') {
      errors.push('selectedLocationId is required');
    }

    if (!body.selectedPurposeId || typeof body.selectedPurposeId !== 'string') {
      errors.push('selectedPurposeId is required');
    }

    // owned (own) ise content opsiyonel: boş/eksikse backend Gemini ile Experience metni üretir
    if (typeof body.content !== 'string') {
      errors.push('content must be a string (can be empty for own status to trigger AI generation)');
    }

    if (!Array.isArray(body.experience)) {
      errors.push('experience must be an array');
    } else if (body.experience.length > 0) {
      body.experience.forEach((exp: { type?: string; content?: string; rating?: number }, index: number) => {
        if (!exp.type || typeof exp.type !== 'string') {
          errors.push(`experience[${index}].type is required`);
        }
        if (!exp.content || typeof exp.content !== 'string') {
          errors.push(`experience[${index}].content is required`);
        }
        if (
          typeof exp.rating !== 'number' ||
          Number.isNaN(exp.rating) ||
          exp.rating < 1 ||
          exp.rating > 5
        ) {
          errors.push(`experience[${index}].rating must be between 1 and 5`);
        }
      });
    }

    if (!body.status || !Object.values(ExperienceStatus).includes(body.status as ExperienceStatus)) {
      errors.push('status must be one of own or tested');
    }

    if (body.images) {
      if (!Array.isArray(body.images)) {
        errors.push('images must be an array of URLs');
      } else if (body.images.some((img) => typeof img !== 'string')) {
        errors.push('images must contain only string URLs');
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    // Resolve option IDs (name to UUID conversion - supports both UUID and string names)
    const resolvedIds = await postService.resolveExperienceOptionIds({
      durationId: body.selectedDurationId,
      locationId: body.selectedLocationId,
      purposeId: body.selectedPurposeId,
    });

    const selectedDurationId = resolvedIds.durationId;
    const selectedLocationId = resolvedIds.locationId;
    const selectedPurposeId = resolvedIds.purposeId;

    // Validation: Ensure all IDs were successfully resolved
    if (!selectedDurationId || !selectedLocationId || !selectedPurposeId) {
      const missingFields = [];
      if (!selectedDurationId) missingFields.push('selectedDurationId');
      if (!selectedLocationId) missingFields.push('selectedLocationId');
      if (!selectedPurposeId) missingFields.push('selectedPurposeId');
      
      return res.status(400).json({
        message: 'Failed to resolve experience option IDs',
        missingFields,
        hint: 'Sent values for duration/location/purpose must match an option name or UUID. Use GET /posts/experience/options to see available options.',
      });
    }

    const created = await inventoryService.createInventoryItem(String(userId), {
      ...body,
      selectedDurationId,
      selectedLocationId,
      selectedPurposeId,
      content: body.content ?? '',
      experience: Array.isArray(body.experience) ? body.experience : [],
      images: body.images || [],
    });

    return res.status(201).json(created);
  })
);

/**
 * @openapi
 * /inventory:
 *   get:
 *     summary: Kullanıcının sahip olduğu ürünlerin listesini getir
 *     description: Kullanıcının sahip olduğu tüm ürünleri brand, reviews, image ve tags bilgileriyle birlikte getirir.
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kullanıcının inventory listesi başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: Inventory item ID
 *                     example: "c505c6c2-1234-5678-90ab-cdef12345678"
 *                   productId:
 *                     type: string
 *                     description: Product ID (ULID format)
 *                     example: "01H8PRO123456789ABCDEFGH"
 *                   brand:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         description: Marka adı
 *                         example: "Apple"
 *                       model:
 *                         type: string
 *                         description: Model adı
 *                         example: "iPhone 15 Pro"
 *                       specs:
 *                         type: string
 *                         description: Ürün özellikleri
 *                         example: "256GB Storage, Titanium Blue"
 *                   image:
 *                     type: string
 *                     nullable: true
 *                     description: Ürün görseli URL
 *                     example: "https://storage.example.com/image.jpg"
 *                   reviews:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         title:
 *                           type: string
 *                         description:
 *                           type: string
 *                         rating:
 *                           type: number
 *                   tags:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: Ürün etiketleri
 *                     example: ["Recent", "Owned", "Premium"]
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await inventoryService.getUserInventoryList(userId);
    return res.json(result);
  })
);

/**
 * @openapi
 * /inventory/{inventoryId}:
 *   patch:
 *     summary: Kullanıcının sahip olduğu ürünlerin listesinde düzenleme yap
 *     description: Kullanıcının sahip olduğu bir ürünün bilgilerini günceller. hasOwned ve experienceSummary alanları güncellenebilir.
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inventoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Inventory ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hasOwned:
 *                 type: boolean
 *                 description: Ürünün sahip olunma durumu
 *               experienceSummary:
 *                 type: string
 *                 description: Ürün deneyimi özeti
 *     responses:
 *       200:
 *         description: Inventory item başarıyla güncellendi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItemResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Inventory does not belong to user
 *       404:
 *         description: Inventory item not found
 */
router.patch(
  '/:inventoryId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { inventoryId } = req.params;
    const { hasOwned, experienceSummary } = req.body;

    if (!inventoryId) {
      return res.status(400).json({ message: 'Inventory ID is required' });
    }

    try {
      const result = await inventoryService.updateInventoryItem(userId, inventoryId, {
        hasOwned,
        experienceSummary,
      });
      return res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('Unauthorized') || error.message.includes('belong')) {
          return res.status(403).json({ message: error.message });
        }
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /inventory/{inventoryId}:
 *   delete:
 *     summary: Kullanıcının sahip olduğu ürünlerin içerisinden ürün kaldır
 *     description: Kullanıcının sahip olduğu bir ürünü inventory'den kaldırır.
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inventoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Inventory ID
 *     responses:
 *       200:
 *         description: Inventory item başarıyla silindi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Inventory does not belong to user
 *       404:
 *         description: Inventory item not found
 */
router.delete(
  '/:inventoryId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { inventoryId } = req.params;

    if (!inventoryId) {
      return res.status(400).json({ message: 'Inventory ID is required' });
    }

    try {
      const success = await inventoryService.deleteInventoryItem(userId, inventoryId);
      if (success) {
        return res.json({ success: true, message: 'Inventory item deleted successfully' });
      } else {
        return res.status(500).json({ success: false, message: 'Failed to delete inventory item' });
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('Unauthorized') || error.message.includes('belong')) {
          return res.status(403).json({ message: error.message });
        }
      }
      throw error;
    }
  })
);

/**
 * @openapi
 * /inventory/experience/options:
 *   get:
 *     summary: Deneyim seçeneklerini getir
 *     description: Duration, Location ve Purpose seçeneklerini getirir.
 *     tags: [Inventory]
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
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await inventoryService.getExperienceOptions();
    return res.json(result);
  })
);

/**
 * @openapi
 * /inventory/split-experience:
 *   post:
 *     summary: Deneyim metnini AI ile kategorilere ayır
 *     description: Kullanıcının yazdığı deneyim metnini Gemini AI kullanarak "Price and Shopping Experience" ve "Product and Usage Experience" kategorilerine ayırır.
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - experienceText
 *             properties:
 *               productId:
 *                 type: string
 *                 description: Ürün ID
 *               experienceText:
 *                 type: string
 *                 description: Kullanıcının yazdığı deneyim metni
 *     responses:
 *       200:
 *         description: Deneyim başarıyla ayrıştırıldı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 priceAndShopping:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     content:
 *                       type: string
 *                     rating:
 *                       type: number
 *                       minimum: 1
 *                       maximum: 5
 *                 productAndUsage:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     content:
 *                       type: string
 *                     rating:
 *                       type: number
 *                       minimum: 1
 *                       maximum: 5
 *       400:
 *         description: Geçersiz istek
 *       401:
 *         description: Unauthorized
 *       503:
 *         description: AI servisi hatası
 */
/**
 * @openapi
 * /inventory/experiences/search:
 *   get:
 *     summary: Product experience'larda arama yap
 *     description: Experience başlığı ve metninde arama yapar
 *     tags: [Inventory]
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
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       experienceText:
 *                         type: string
 *                       inventory:
 *                         type: object
 *                         nullable: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
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
  '/experiences/search',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const query = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
    if (!query) {
      return res.status(400).json({ message: 'Search query (q) is required' });
    }

    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) && limitParam > 0 && limitParam <= 50 ? limitParam : 20;

    const result = await inventoryService.searchExperiences(query, { cursor, limit });
    return res.json(result);
  })
);

router.post(
  '/split-experience',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { productId, experienceText } = req.body;

    if (!productId || typeof productId !== 'string') {
      return res.status(400).json({ message: 'productId is required' });
    }

    if (!experienceText || typeof experienceText !== 'string') {
      return res.status(400).json({ message: 'experienceText is required' });
    }

    if (experienceText.trim().length < 10) {
      return res.status(400).json({ message: 'experienceText must be at least 10 characters' });
    }

    const result = await inventoryService.splitExperienceWithAI(userId, productId, experienceText);
    return res.json(result);
  })
);

/**
 * @openapi
 * /inventory/cache/clear:
 *   post:
 *     summary: Inventory cache'ini temizle
 *     description: Belirli bir kullanıcının veya tüm kullanıcıların inventory cache'ini temizler
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 description: Belirli bir kullanıcının cache'ini temizlemek için (boş bırakılırsa mevcut kullanıcının cache'i temizlenir)
 *               all:
 *                 type: boolean
 *                 description: true ise tüm inventory cache'lerini temizler
 *     responses:
 *       200:
 *         description: Cache başarıyla temizlendi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 cleared:
 *                   type: number
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/cache/clear',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const currentUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { userId, all } = req.body;

    const result = await inventoryService.clearInventoryCache(
      userId || String(currentUserId),
      all || false
    );

    return res.json(result);
  })
);

export default router;

