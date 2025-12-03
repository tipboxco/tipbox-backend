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
 *                 posts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: ['feed', 'benchmark', 'post', 'question', 'tipsAndTricks']
 *                       data:
 *                         type: object
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
 *                         enum: ['feed', 'benchmark', 'post', 'question', 'tipsAndTricks']
 *                       data:
 *                         type: object
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Brand bulunamadı.
 */
router.get(
  '/:brandId/feed',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const feed = await brandService.getBrandFeed(brandId);
    res.json(feed);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/products:
 *   get:
 *     summary: Markaya ait ürünleri listele
 *     description: Markaya ait ürünlerin listelendiği endpoint. Ürünler product group'lara göre gruplanmıştır.
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
 *         description: Brand ürünleri başarıyla listelendi.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   productGroupId:
 *                     type: string
 *                     format: uuid
 *                   productGroupName:
 *                     type: string
 *                   products:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         productId:
 *                           type: string
 *                           format: uuid
 *                         name:
 *                           type: string
 *                         image:
 *                           type: string
 *                           nullable: true
 *                         stats:
 *                           type: object
 *                           properties:
 *                             reviews:
 *                               type: integer
 *                             likes:
 *                               type: integer
 *                             share:
 *                               type: integer
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Brand bulunamadı.
 */
router.get(
  '/:brandId/products',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const products = await brandService.getBrandProducts(brandId);
    res.json(products);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/surveys:
 *   get:
 *     summary: Brand Survey & Gamification - Anketler
 *     description: Seçili marka için survey/gamification kartlarını döner.
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
 *         description: Survey listesi başarıyla getirildi.
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/:brandId/surveys',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const result = await brandService.getBrandSurveys(brandId, userId);
    res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/events:
 *   get:
 *     summary: Brand Survey & Gamification - Eventler
 *     description: Seçili marka için event kartlarını döner.
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
 *         description: Event listesi başarıyla getirildi.
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/:brandId/events',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const result = await brandService.getBrandEvents(brandId, userId);
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
 *     description: Brand'e ait trend içerikleri (feed formatında) döner.
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
 *     responses:
 *       200:
 *         description: Trend içerikleri başarıyla getirildi.
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/:brandId/trends',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const result = await brandService.getBrandTrends(brandId, userId);
    res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/history:
 *   get:
 *     summary: Marka geçmişi ana sayfa bilgilerini getir
 *     description: Kullanıcının seçtiği markaya ait geçmiş (puanlar, rozetler, istatistikler) bilgisini döner.
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
 *     responses:
 *       200:
 *         description: Marka geçmişi başarıyla getirildi.
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/:brandId/history',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const result = await brandService.getBrandHistory(brandId, userId);
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
 *     responses:
 *       200:
 *         description: Marka geçmişi anketleri başarıyla getirildi.
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/:brandId/history/surveys',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const result = await brandService.getBrandHistorySurveys(brandId, userId);
    res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/history/posts:
 *   get:
 *     summary: Marka geçmişine ait paylaşımları getir
 *     description: Marka geçmişi için feed formatında paylaşımları döner.
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
 *     responses:
 *       200:
 *         description: Marka geçmişi paylaşımları başarıyla getirildi.
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/:brandId/history/posts',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const result = await brandService.getBrandHistoryPosts(brandId, userId);
    res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/history/events:
 *   get:
 *     summary: Marka geçmişine ait event'leri getir
 *     description: Marka geçmişi ekranı için event kartlarını döner.
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
 *     responses:
 *       200:
 *         description: Marka geçmişi event'leri başarıyla getirildi.
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/:brandId/history/events',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const result = await brandService.getBrandHistoryEvents(brandId, userId);
    res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/products/{productId}/experiences:
 *   get:
 *     summary: Marka ürününe ait deneyim paylaşımlarını listele
 *     description: Marka ürününe ait deneyim paylaşımlarının listelendiği endpoint.
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
 *     responses:
 *       200:
 *         description: Deneyim paylaşımları başarıyla listelendi.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: ['feed', 'benchmark', 'post', 'question', 'tipsAndTricks']
 *                   data:
 *                     type: object
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
    const experiences = await brandService.getBrandProductExperiences(brandId, productId, userId);
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
 *                     enum: ['feed', 'benchmark', 'post', 'question', 'tipsAndTricks']
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
    const comparisons = await brandService.getBrandProductComparisons(brandId, productId, userId);
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
 *                     enum: ['feed', 'benchmark', 'post', 'question', 'tipsAndTricks']
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
    const news = await brandService.getBrandProductNews(brandId, productId, userId);
    res.json(news);
  }),
);

export default router;

