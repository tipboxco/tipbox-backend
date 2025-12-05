import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { BrandService } from '../../application/brand/brand.service';

const router = Router();
const brandService = new BrandService();

router.use(authMiddleware);

/**
 * @openapi
 * /brands/categories:
 *   get:
 *     summary: Tüm brand kategorilerini listele
 *     description: Kullanıcının app içerisindeki tüm brand categorilerini görüntülediği endpoint.
 *     tags: [Brand]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Brand kategorileri başarıyla listelendi.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   categoryId:
 *                     type: string
 *                   name:
 *                     type: string
 *                   image:
 *                     type: string
 *                     nullable: true
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/categories',
  asyncHandler(async (req: Request, res: Response) => {
    const categories = await brandService.getAllBrandCategories();
    res.json(categories);
  }),
);

/**
 * @openapi
 * /brands/categories/{categoryId}/brands:
 *   get:
 *     summary: Kategoriye göre markaları listele
 *     description: Kullanıcının seçtiği categorye bağlı olarak markaların listelendiği endpoint.
 *     tags: [Brand]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *         description: Brand kategori ID'si
 *     responses:
 *       200:
 *         description: Markalar başarıyla listelendi.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   brandId:
 *                     type: string
 *                     format: uuid
 *                   name:
 *                     type: string
 *                   image:
 *                     type: string
 *                     nullable: true
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/categories/:categoryId/brands',
  asyncHandler(async (req: Request, res: Response) => {
    const { categoryId } = req.params;
    const brands = await brandService.getBrandsByCategoryId(categoryId);
    res.json(brands);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/catalog:
 *   get:
 *     summary: Brand catalog detayları
 *     description: Kullanıcının seçtiği markanın katalog sayfasının detaylarını listelendiği endpoint.
 *     tags: [Brand]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Brand ID'si
 *     responses:
 *       200:
 *         description: Brand catalog başarıyla getirildi.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 brandId:
 *                   type: string
 *                   format: uuid
 *                 name:
 *                   type: string
 *                 description:
 *                   type: string
 *                   nullable: true
 *                 followers:
 *                   type: integer
 *                 isJoined:
 *                   type: boolean
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Brand bulunamadı.
 */
router.get(
  '/:brandId/catalog',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const catalog = await brandService.getBrandCatalog(brandId, userId);
    res.json(catalog);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/feed:
 *   get:
 *     summary: Brand feed'ini getir
 *     description: Seçili marka için bridge post'lardan oluşan feed listesini döner.
 *     tags: [Brand]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Brand ID'si
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Sayfa başına dönecek kayıt sayısı (varsayılan 20)
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Bir sonraki sayfa için kullanılacak cursor (önceki sayfanın son post ID'si)
 *     responses:
 *       200:
 *         description: Brand feed'i başarıyla getirildi.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 brandId:
 *                   type: string
 *                   format: uuid
 *                 name:
 *                   type: string
 *                 posts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: ['benchmark', 'post', 'question', 'tipsAndTricks', 'experience', 'update']
 *                       data:
 *                         type: object
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
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Brand bulunamadı.
 */
router.get(
  '/:brandId/feed',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? limitParam : undefined;

    const feed = await brandService.getBrandFeed(brandId, {
      cursor,
      limit,
      userId,
    });
    res.json(feed);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/products/groups:
 *   get:
 *     summary: Markaya ait product group'ları listele
 *     description: Markaya ait product group'ların listelendiği endpoint (sadece group bilgileri).
 *     tags: [Brand]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Brand ID'si
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Sayfa başına dönecek group sayısı (varsayılan 20)
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Bir sonraki sayfa için cursor (önceki sayfanın son group ID'si)
 *     responses:
 *       200:
 *         description: Product group'ları başarıyla listelendi.
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
 *                       productGroupId:
 *                         type: string
 *                         format: uuid
 *                       productGroupName:
 *                         type: string
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
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Brand bulunamadı.
 */
router.get(
  '/:brandId/products/groups',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;

    const result = await brandService.getBrandProductGroups(brandId, {
      cursor,
      limit,
    });
    res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/products/groups/{productGroupId}:
 *   get:
 *     summary: Belirli bir product group için products listesi
 *     description: Belirli bir product group içindeki products'ların pagination ile listelendiği endpoint.
 *     tags: [Brand]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Brand ID'si
 *       - in: path
 *         name: productGroupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product Group ID'si
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Sayfa başına dönecek product sayısı (varsayılan 20)
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Bir sonraki sayfa için cursor (önceki sayfanın son product ID'si)
 *     responses:
 *       200:
 *         description: Products başarıyla listelendi.
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
 *                       productId:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       image:
 *                         type: string
 *                         nullable: true
 *                       stats:
 *                         type: object
 *                         properties:
 *                           reviews:
 *                             type: integer
 *                           likes:
 *                             type: integer
 *                           share:
 *                             type: integer
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
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Brand veya product group bulunamadı.
 */
router.get(
  '/:brandId/products/groups/:productGroupId',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId, productGroupId } = req.params;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;

    const result = await brandService.getBrandProductsByGroup(brandId, productGroupId, {
      cursor,
      limit,
    });
    res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/products:
 *   get:
 *     summary: Markaya ait ürünleri batch endpoint ile listele
 *     description: Product groups ve products'ı tek istekte döner. İki ayrı endpoint'i birleştirir.
 *     tags: [Brand]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Brand ID'si
 *       - in: query
 *         name: groupCursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Product groups için cursor
 *       - in: query
 *         name: groupLimit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Sayfa başına dönecek group sayısı (varsayılan 20)
 *       - in: query
 *         name: productGroupIds
 *         required: false
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Products'ları getirilecek product group ID'leri (virgülle ayrılmış)
 *       - in: query
 *         name: productLimit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Her product group için dönecek product sayısı (varsayılan 20)
 *     responses:
 *       200:
 *         description: Brand ürünleri batch olarak başarıyla listelendi.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 groups:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productGroupId:
 *                         type: string
 *                         format: uuid
 *                       productGroupName:
 *                         type: string
 *                 products:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productGroupId:
 *                         type: string
 *                         format: uuid
 *                       productGroupName:
 *                         type: string
 *                       products:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             productId:
 *                               type: string
 *                               format: uuid
 *                             name:
 *                               type: string
 *                             image:
 *                               type: string
 *                               nullable: true
 *                             stats:
 *                               type: object
 *                               properties:
 *                                 reviews:
 *                                   type: integer
 *                                 likes:
 *                                   type: integer
 *                                 share:
 *                                   type: integer
 *                       pagination:
 *                         type: object
 *                         properties:
 *                           cursor:
 *                             type: string
 *                             nullable: true
 *                           hasMore:
 *                             type: boolean
 *                           limit:
 *                             type: integer
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
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Brand bulunamadı.
 */
router.get(
  '/:brandId/products',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const groupCursor = req.query.groupCursor ? String(req.query.groupCursor) : undefined;
    const groupLimitParam = req.query.groupLimit ? Number(req.query.groupLimit) : undefined;
    const groupLimit = groupLimitParam && !Number.isNaN(groupLimitParam) ? Math.min(groupLimitParam, 50) : 20;
    const productLimitParam = req.query.productLimit ? Number(req.query.productLimit) : undefined;
    const productLimit = productLimitParam && !Number.isNaN(productLimitParam) ? Math.min(productLimitParam, 50) : 20;
    
    // productGroupIds query parametresini parse et (virgülle ayrılmış veya array)
    let productGroupIds: string[] | undefined = undefined;
    if (req.query.productGroupIds) {
      if (Array.isArray(req.query.productGroupIds)) {
        productGroupIds = req.query.productGroupIds.map(String);
      } else {
        productGroupIds = String(req.query.productGroupIds).split(',').map(s => s.trim());
      }
    }

    // productCursors query parametresini parse et (JSON string veya object)
    let productCursors: Record<string, string> | undefined = undefined;
    if (req.query.productCursors) {
      try {
        if (typeof req.query.productCursors === 'string') {
          productCursors = JSON.parse(req.query.productCursors);
        } else if (typeof req.query.productCursors === 'object') {
          productCursors = req.query.productCursors as Record<string, string>;
        }
      } catch (e) {
        // Invalid JSON, ignore
      }
    }

    const result = await brandService.getBrandProductsBatch(brandId, {
      groupCursor,
      groupLimit,
      productGroupIds,
      productCursors,
      productLimit,
    });
    res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/surveys:
 *   get:
 *     summary: Brand Survey & Gamification - Anketler
 *     description: Seçili marka için survey/gamification kartlarını pagination ile döner. Brand bilgileri store'dan alınır, sadece surveyList döner.
 *     tags: [Brand]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Brand ID'si
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Sayfa başına dönecek survey kartı sayısı (varsayılan 20)
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Bir sonraki sayfa için cursor (önceki sayfanın son event ID'si)
 *     responses:
 *       200:
 *         description: Survey listesi başarıyla getirildi.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 surveyList:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       type:
 *                         type: string
 *                       duration:
 *                         type: string
 *                       points:
 *                         type: integer
 *                       status:
 *                         type: string
 *                         enum: [start, continue, viewresults]
 *                       progress:
 *                         type: integer
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
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/:brandId/surveys',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;

    const result = await brandService.getBrandSurveys(brandId, userId, {
      cursor,
      limit,
    });
    res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/events:
 *   get:
 *     summary: Brand Survey & Gamification - Eventler
 *     description: Seçili marka için event kartlarını pagination ile döner.
 *     tags: [Brand]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Brand ID'si
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Sayfa başına dönecek event kartı sayısı (varsayılan 20)
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Bir sonraki sayfa için cursor (önceki sayfanın son event ID'si)
 *     responses:
 *       200:
 *         description: Event listesi başarıyla getirildi.
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
 *                       description:
 *                         type: string
 *                       type:
 *                         type: string
 *                       startDate:
 *                         type: string
 *                         format: date-time
 *                       endDate:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                         enum: [joined, join]
 *                       image:
 *                         type: string
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
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/:brandId/events',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;

    const result = await brandService.getBrandEvents(brandId, userId, {
      cursor,
      limit,
    });
    res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/events/{eventId}:
 *   get:
 *     summary: Brand Survey & Gamification - Event detayı
 *     description: Seçili marka için belirli bir event'in detaylarını döner.
 *     tags: [Brand]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID'si
 *     responses:
 *       200:
 *         description: Event detayı başarıyla getirildi.
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Event bulunamadı.
 */
router.get(
  '/:brandId/events/:eventId',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId, eventId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const result = await brandService.getBrandEventDetail(brandId, eventId, userId);
    res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/trends:
 *   get:
 *     summary: Brand Survey & Gamification - Trendler
 *     description: Brand'e ait trend içerikleri (feed formatında) pagination ile döner.
 *     tags: [Brand]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Sayfa başına dönecek kayıt sayısı (varsayılan 20)
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Bir sonraki sayfa için cursor (önceki sayfanın son post ID'si)
 *     responses:
 *       200:
 *         description: Trend içerikleri başarıyla getirildi.
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
 *                       type:
 *                         type: string
 *                         enum: ['benchmark', 'post', 'question', 'tipsAndTricks', 'experience', 'update']
 *                       data:
 *                         type: object
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
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/:brandId/trends',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;

    const result = await brandService.getBrandTrends(brandId, userId, {
      cursor,
      limit,
    });
    res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/history:
 *   get:
 *     summary: Marka geçmişi ana sayfa bilgilerini getir
 *     description: Kullanıcının seçtiği markaya ait geçmiş (puanlar, rozetler, istatistikler) bilgisini pagination ile döner.
 *     tags: [Brand]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Brand ID'si
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Sayfa başına dönecek badge sayısı (varsayılan 20)
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Bir sonraki sayfa için cursor (önceki sayfanın son badge ID'si)
 *     responses:
 *       200:
 *         description: Marka geçmişi başarıyla getirildi.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 category:
 *                   type: string
 *                 image:
 *                   type: string
 *                 totalPoints:
 *                   type: integer
 *                 stats:
 *                   type: object
 *                   properties:
 *                     surveys:
 *                       type: integer
 *                     shares:
 *                       type: integer
 *                     events:
 *                       type: integer
 *                 badgeList:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       image:
 *                         type: string
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
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/:brandId/history',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;

    const result = await brandService.getBrandHistory(brandId, userId, {
      cursor,
      limit,
    });
    res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/history/points:
 *   get:
 *     summary: Marka geçmişine ait puan geçmişini getir
 *     description: Kullanıcının bu marka için kazandığı puanların pagination ile listelenmesi.
 *     tags: [Brand]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Sayfa başına dönecek kayıt sayısı (varsayılan 20)
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Bir sonraki sayfa için cursor (önceki sayfanın son reward ID'si)
 *     responses:
 *       200:
 *         description: Puan geçmişi başarıyla getirildi.
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
 *                       image:
 *                         type: string
 *                       points:
 *                         type: integer
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
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/:brandId/history/points',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;

    const result = await brandService.getBrandHistoryPoints(brandId, userId, {
      cursor,
      limit,
    });
    res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/history/surveys:
 *   get:
 *     summary: Marka geçmişine ait anketleri getir
 *     description: Geçmişteki survey kartlarını döner.
 *     tags: [Brand]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Sayfa başına dönecek survey kartı sayısı (varsayılan 20)
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Bir sonraki sayfa için cursor (önceki sayfanın son event ID'si)
 *     responses:
 *       200:
 *         description: Marka geçmişi anketleri başarıyla getirildi.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 surveyList:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       type:
 *                         type: string
 *                       duration:
 *                         type: string
 *                       points:
 *                         type: integer
 *                       status:
 *                         type: string
 *                         enum: [start, continue, viewresults]
 *                       progress:
 *                         type: integer
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
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/:brandId/history/surveys',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? limitParam : undefined;

    const result = await brandService.getBrandHistorySurveys(brandId, userId, {
      cursor,
      limit,
    });
    res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/history/feed:
 *   get:
 *     summary: Marka geçmişine ait paylaşımları getir
 *     description: Marka geçmişi için feed formatında paylaşımları pagination ile döner.
 *     tags: [Brand]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Sayfa başına dönecek kayıt sayısı (varsayılan 20)
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Bir sonraki sayfa için cursor (önceki sayfanın son post ID'si)
 *     responses:
 *       200:
 *         description: Marka geçmişi paylaşımları başarıyla getirildi.
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
 *                       type:
 *                         type: string
 *                         enum: ['benchmark', 'post', 'question', 'tipsAndTricks', 'experience', 'update']
 *                       data:
 *                         type: object
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
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/:brandId/history/feed',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;

    const result = await brandService.getBrandHistoryPosts(brandId, userId, {
      cursor,
      limit,
    });
    res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/history/events:
 *   get:
 *     summary: Marka geçmişine ait event'leri getir
 *     description: Marka geçmişi ekranı için event kartlarını pagination ile döner.
 *     tags: [Brand]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Sayfa başına dönecek event kartı sayısı (varsayılan 20)
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Bir sonraki sayfa için cursor (önceki sayfanın son event ID'si)
 *     responses:
 *       200:
 *         description: Marka geçmişi event'leri başarıyla getirildi.
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
 *                       description:
 *                         type: string
 *                       type:
 *                         type: string
 *                       startDate:
 *                         type: string
 *                         format: date-time
 *                       endDate:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                         enum: [joined, join]
 *                       image:
 *                         type: string
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
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/:brandId/history/events',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;

    const result = await brandService.getBrandHistoryEvents(brandId, userId, {
      cursor,
      limit,
    });
    res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/products/{productId}/experiences:
 *   get:
 *     summary: Marka ürününe ait deneyim paylaşımlarını listele
 *     description: Marka ürününe ait deneyim paylaşımlarının pagination ile listelendiği endpoint.
 *     tags: [Brand]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Brand ID'si
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID'si
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Sayfa başına dönecek kayıt sayısı (varsayılan 20)
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Bir sonraki sayfa için cursor (önceki sayfanın son post ID'si)
 *     responses:
 *       200:
 *         description: Deneyim paylaşımları başarıyla listelendi.
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
 *                       type:
 *                         type: string
 *                         enum: ['benchmark', 'post', 'question', 'tipsAndTricks', 'experience', 'update']
 *                       data:
 *                         type: object
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
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Brand veya product bulunamadı.
 */
router.get(
  '/:brandId/products/:productId/experiences',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId, productId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;
    const experiences = await brandService.getBrandProductExperiences(brandId, productId, userId, {
      cursor,
      limit,
    });
    res.json(experiences);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/products/{productId}/comparisons:
 *   get:
 *     summary: Marka ürününe ait karşılaştırma gönderilerini listele
 *     description: Marka ürününe ait karşılaştırma gönderilerinin listelendiği endpoint.
 *     tags: [Brand]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Brand ID'si
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID'si
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Sayfa numarası (1 tabanlı)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 12
 *         description: Sayfa başına gönderi sayısı
 *     responses:
 *       200:
 *         description: Karşılaştırma gönderileri başarıyla listelendi.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: ['benchmark', 'post', 'question', 'tipsAndTricks', 'experience', 'update']
 *                   data:
 *                     type: object
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Brand veya product bulunamadı.
 */
router.get(
  '/:brandId/products/:productId/comparisons',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId, productId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 12;
    const comparisons = await brandService.getBrandProductComparisons(brandId, productId, userId, page, limit);
    res.json(comparisons);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/products/{productId}/news:
 *   get:
 *     summary: Marka ürünlerine dair haberleri listele
 *     description: Marka ürünlerine dair haberlerin listelendiği endpoint.
 *     tags: [Brand]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Brand ID'si
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID'si
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Sayfa numarası (1 tabanlı)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 12
 *         description: Sayfa başına gönderi sayısı
 *     responses:
 *       200:
 *         description: Haberler başarıyla listelendi.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: ['benchmark', 'post', 'question', 'tipsAndTricks', 'experience', 'update']
 *                   data:
 *                     type: object
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Brand veya product bulunamadı.
 */
router.get(
  '/:brandId/products/:productId/news',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId, productId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 12;
    const news = await brandService.getBrandProductNews(brandId, productId, userId, page, limit);
    res.json(news);
  }),
);

export default router;

