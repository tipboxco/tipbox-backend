import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { BrandService } from '../../application/brand/brand.service';
import { ContentPostType } from '../../domain/content/content-post-type.enum';
import { NewsService } from '../../application/news/news.service';

const router = Router();
const brandService = new BrandService();
const newsService = new NewsService();

router.use(authMiddleware);

/**
 * @openapi
 * /brands/categories:
 *   get:
 *     summary: Tüm brand kategorilerini listele
 *     description: Kullanıcının app içerisindeki tüm brand categorilerini görüntülediği endpoint.
 *     tags: [Brand Catalog]
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
  asyncHandler(async (_req: Request, res: Response) => {
    const categories = await brandService.getAllBrandCategories();
    return res.json(categories);
  }),
);

/**
 * @openapi
 * /brands/categories/{categoryId}/brands:
 *   get:
 *     summary: Kategoriye göre markaları listele
 *     description: Kullanıcının seçtiği categorye bağlı markalar, markaya ait ürün sayısına göre (çoktan aza) sıralanarak pagination ile döner.
 *     tags: [Brand Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *         description: Brand kategori ID'si
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Sayfa numarası
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Sayfa başına marka sayısı
 *     responses:
 *       200:
 *         description: Markalar başarıyla listelendi.
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
 *                       brandId:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       image:
 *                         type: string
 *                         nullable: true
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/categories/:categoryId/brands',
  asyncHandler(async (req: Request, res: Response) => {
    const { categoryId } = req.params;
    const pageParam = req.query.page ? Number(req.query.page) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const page = pageParam && !Number.isNaN(pageParam) && pageParam >= 1 ? pageParam : 1;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;
    const result = await brandService.getBrandsByCategoryId(categoryId, { page, limit });
    return res.json(result);
  }),
);

/**
 * @openapi
 * /brands/search:
 *   get:
 *     summary: Global brand search - Tüm brand kategorileri arasında arama
 *     description: Tüm brand kategorileri arasında arama yapar ve sonuçları brand category bazında gruplar. Sadece eşleşen brand'i olan category'ler döner.
 *     tags: [Brand Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         required: true
 *         schema:
 *           type: string
 *         description: Brand name, description veya category name'de arama
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor (son dönen category ID'si)
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
 *         description: Arama sonuçları başarıyla getirildi
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
 *                       categoryId:
 *                         type: string
 *                       categoryName:
 *                         type: string
 *                       categoryImage:
 *                         type: string
 *                         nullable: true
 *                       brands:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             brandId:
 *                               type: string
 *                             name:
 *                               type: string
 *                             image:
 *                               type: string
 *                               nullable: true
 *                             categoryId:
 *                               type: string
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
 *         description: Search parametresi boş veya geçersiz
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       500:
 *         description: Sunucu hatası
 */
router.get(
  '/search',
  asyncHandler(async (req: Request, res: Response) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    
    if (!search || search.length === 0) {
      return res.status(400).json({ message: 'Search parameter is required' });
    }

    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    
    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ message: 'Limit must be between 1 and 50' });
    }

    const result = await brandService.searchBrandsGlobally(search, {
      cursor,
      limit: limitParam,
    });

    return res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/catalog:
 *   get:
 *     summary: Brand catalog detayları
 *     description: Kullanıcının seçtiği markanın katalog sayfasının detaylarını listelendiği endpoint.
 *     tags: [Brand Catalog]
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
     *                 bannerImage:
     *                   type: string
     *                   format: uri
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
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const catalog = await brandService.getBrandCatalog(brandId, userId);
    return res.json(catalog);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/follow:
 *   post:
 *     summary: Markayı takip et
 *     description: Kullanıcı markayı takip eder (BridgeFollower tablosuna kayıt eklenir). App tarafında optimistic güncelleme sonrası bu EP ile senkronize edilir.
 *     tags: [Brand Catalog]
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
 *         description: Marka takip edildi.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isJoined:
 *                   type: boolean
 *                   example: true
 *                 followers:
 *                   type: integer
 *                   description: Güncel takipçi sayısı
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Brand bulunamadı.
 */
router.post(
  '/:brandId/follow',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const result = await brandService.followBrand(brandId, userId);
    return res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/follow:
 *   delete:
 *     summary: Markayı bırak (takibi kaldır)
 *     description: Kullanıcı markayı bırakır (BridgeFollower tablosundan kayıt silinir). Leave işlemi için kullanılır.
 *     tags: [Brand Catalog]
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
 *         description: Marka bırakıldı.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isJoined:
 *                   type: boolean
 *                   example: false
 *                 followers:
 *                   type: integer
 *                   description: Güncel takipçi sayısı
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Brand bulunamadı.
 */
router.delete(
  '/:brandId/follow',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const result = await brandService.leaveBrand(brandId, userId);
    return res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/feed:
 *   get:
 *     summary: Brand feed'ini getir
 *     description: Seçili marka için bridge post'lardan oluşan feed listesini döner.
 *     tags: [Brand Catalog]
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
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? limitParam : undefined;

    const feed = await brandService.getBrandFeed(brandId, {
      cursor,
      limit,
      userId,
    });
    return res.json(feed);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/groups:
 *   get:
 *     summary: Markanın ürünlerini kategori (level 2) bazında getir
 *     description: Brand id veya externalId ile markayı bulur. Ürünler nested Category yapısına göre gruplanır; sadece rank/derinlik 2 (level 2) kategoriler grup adı olarak döner. Kategorisi yok veya level 2 olmayan ürünler "Diğer" grubunda.
 *     tags: [Brand Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *         description: Brand ID veya externalId (her ikisi de kabul edilir)
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Sayfa başına kategori grubu sayısı (varsayılan 20)
 *       - in: query
 *         name: productLimit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Her kategori grubunda dönecek ürün sayısı (varsayılan 5)
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Sonraki sayfa için cursor (son kategori id)
 *     responses:
 *       200:
 *         description: Kategori grupları ve ürünler döndü.
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
 *                       categoryId:
 *                         type: string
 *                       categoryName:
 *                         type: string
 *                       products:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             productId:
 *                               type: string
 *                             name:
 *                               type: string
 *                             image:
 *                               type: string
 *                               nullable: true
 *                             stats:
 *                               type: object
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
  '/:brandId/groups',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;
    const productLimitParam = req.query.productLimit ? Number(req.query.productLimit) : undefined;
    const productLimit =
      productLimitParam && !Number.isNaN(productLimitParam) ? Math.min(productLimitParam, 50) : undefined;

    const result = await brandService.getBrandProductGroups(brandId, { cursor, limit, productLimit });
    return res.json(result);
  }),
);

/**
 * @openapi
 * /brands/groups/{productGroupId}/products:
 *   get:
 *     summary: Belirli bir product group için products listesi
 *     description: Belirli bir product group içindeki products'ların pagination ile listelendiği endpoint.
 *     tags: [Brand Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Bir sonraki sayfa için cursor (product id veya metadata externalId kabul edilir)
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
  '/groups/:productGroupId/products',
  asyncHandler(async (req: Request, res: Response) => {
    const { productGroupId } = req.params;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;

    const result = await brandService.getProductsByGroupId(productGroupId, {
      cursor,
      limit,
    });
    return res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/groups/{groupId}/products:
 *   get:
 *     summary: Brand'e ait belirli bir product group'un ürünlerini listele
 *     description: Brand'e ait belirli bir product group içindeki products'ların pagination ile listelendiği endpoint. "Tümünü gör" butonu için kullanılır.
 *     tags: [Brand Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *         description: Brand ID veya externalId (her ikisi de kabul edilir)
 *       - in: path
 *         name: groupId
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
 *         description: Bir sonraki sayfa için cursor (product id veya metadata externalId kabul edilir)
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
  '/:brandId/groups/:groupId/products',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId, groupId } = req.params;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;

    const result = await brandService.getBrandGroupProducts(brandId, groupId, {
      cursor,
      limit,
    });
    return res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/surveys:
 *   get:
 *     summary: Brand Survey & Gamification - Anketler
 *     description: Seçili marka için survey/gamification kartlarını pagination ile döner. Brand bilgileri store'dan alınır, sadece surveyList döner.
 *     tags: [Brand Catalog]
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
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;

    const result = await brandService.getBrandSurveys(brandId, userId, {
      cursor,
      limit,
    });
    return res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/events:
 *   get:
 *     summary: Brand Survey & Gamification - Eventler
 *     description: Seçili marka için event kartlarını pagination ile döner.
 *     tags: [Brand Catalog]
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
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;

    const result = await brandService.getBrandEvents(brandId, userId, {
      cursor,
      limit,
    });
    return res.json(result);
  }),
);

/**
 * @openapi
 * /brands/events/{eventId}:
 *   get:
 *     summary: Brand Survey & Gamification - Event detayı
 *     description: Seçili marka için belirli bir event'in detaylarını döner.
 *     tags: [Brand Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
  '/events/:eventId',
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req.params;
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const result = await brandService.getBrandEventDetail(eventId, userId);
    return res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/trends:
 *   get:
 *     summary: Brand Survey & Gamification - Trendler
 *     description: Brand'e ait trend içerikleri (feed formatında) pagination ile döner.
 *     tags: [Brand Catalog]
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
 *         description: Sayfa başına dönecek kayıt sayısı (varsayılan 5)
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
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;

    const result = await brandService.getBrandTrends(brandId, userId, {
      cursor,
      limit,
    });
    return res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/history:
 *   get:
 *     summary: Marka geçmişi ana sayfa bilgilerini getir
 *     description: Kullanıcının seçtiği markaya ait geçmiş (puanlar, rozetler, istatistikler) bilgisini pagination ile döner.
 *     tags: [Brand Catalog]
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
 *                       description: Tamamlanan anket sayısı
 *                     shares:
 *                       type: integer
 *                       description: Kullanıcının bu marka için attığı post sayısı
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
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;

    const result = await brandService.getBrandHistory(brandId, userId, {
      cursor,
      limit,
    });
    return res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/history/points:
 *   get:
 *     summary: Marka geçmişine ait puan geçmişini getir
 *     description: Kullanıcının bu marka için kazandığı puanların pagination ile listelenmesi.
 *     tags: [Brand Catalog]
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
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;

    const result = await brandService.getBrandHistoryPoints(brandId, userId, {
      cursor,
      limit,
    });
    return res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/history/surveys:
 *   get:
 *     summary: Marka geçmişine ait anketleri getir
 *     description: Geçmişteki survey kartlarını döner.
 *     tags: [Brand Catalog]
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
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? limitParam : undefined;

    const result = await brandService.getBrandHistorySurveys(brandId, userId, {
      cursor,
      limit,
    });
    return res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/history/feed:
 *   get:
 *     summary: Marka geçmişine ait paylaşımları getir
 *     description: Marka geçmişi için feed formatında paylaşımları pagination ile döner.
 *     tags: [Brand Catalog]
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
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;

    const result = await brandService.getBrandHistoryPosts(brandId, userId, {
      cursor,
      limit,
    });
    return res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/products/{productId}:
 *   get:
 *     summary: Brand context'inde product detay bilgilerini getir
 *     description: Belirli bir brand'e ait product'ın detaylı bilgilerini getirir. Catalog context'indeki product detayından farklı olabilir (brand-specific stats, brand context bilgileri vb.).
 *     tags: [Brand Catalog]
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
 *         description: Product detayı başarıyla getirildi.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 productId:
 *                   type: string
 *                 name:
 *                   type: string
 *                 subName:
 *                   type: string
 *                   nullable: true
 *                 description:
 *                   type: string
 *                   nullable: true
 *                 image:
 *                   type: string
 *                   nullable: true
 *                 brand:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     image:
 *                       type: string
 *                       nullable: true
 *                 specs:
 *                   type: array
 *                   items:
 *                     type: string
 *                 price:
 *                   type: number
 *                   nullable: true
 *                 currency:
 *                   type: string
 *                   nullable: true
 *                 stats:
 *                   type: object
 *                   properties:
 *                     reviews:
 *                       type: integer
 *                     likes:
 *                       type: integer
 *                     share:
 *                       type: integer
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Brand veya product bulunamadı.
 */
router.get(
  '/:brandId/products/:productId',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId, productId } = req.params;
    const product = await brandService.getBrandProductDetail(brandId, productId);
    return res.json(product);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/stats:
 *   get:
 *     summary: Brand istatistiklerini getir
 *     description: Kullanıcının brand için istatistiklerini getirir (surveys, shares, events, totalPoints).
 *     tags: [Brand Catalog]
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
 *         description: Brand istatistikleri başarıyla getirildi.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 surveys:
 *                   type: integer
 *                 shares:
 *                   type: integer
 *                 events:
 *                   type: integer
 *                 totalPoints:
 *                   type: integer
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Brand bulunamadı.
 */
router.get(
  '/:brandId/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.params;
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const stats = await brandService.getBrandStats(brandId, userId);
    return res.json(stats);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/products/{productId}/feed:
 *   get:
 *     summary: Marka ürününe ait tüm gönderileri listele
 *     description: Marka ürününe ait tüm gönderilerin cursor-based pagination ile listelendiği endpoint.
 *     tags: [Brand Catalog]
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
 *         description: Tüm gönderiler başarıyla listelendi.
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
  '/:brandId/products/:productId/feed',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId, productId } = req.params;
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;
    const result = await brandService.getBrandProductPosts(brandId, productId, userId, undefined, {
      cursor,
      limit,
    });
    return res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/products/{productId}/reviews:
 *   get:
 *     summary: Marka ürününe ait review gönderilerini listele
 *     description: Marka ürününe ait review (experience) gönderilerinin cursor-based pagination ile listelendiği endpoint.
 *     tags: [Brand Catalog]
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
 *         description: Review gönderileri başarıyla listelendi.
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
 *                         enum: ['experience', 'update']
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
  '/:brandId/products/:productId/reviews',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId, productId } = req.params;
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;
    const result = await brandService.getBrandProductPosts(brandId, productId, userId, ContentPostType.EXPERIENCE, {
      cursor,
      limit,
    });
    return res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/products/{productId}/benchmarks:
 *   get:
 *     summary: Marka ürününe ait benchmark gönderilerini listele
 *     description: Marka ürününe ait benchmark (comparison) gönderilerinin cursor-based pagination ile listelendiği endpoint.
 *     tags: [Brand Catalog]
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
 *         description: Benchmark gönderileri başarıyla listelendi.
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
 *                         enum: ['benchmark']
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
  '/:brandId/products/:productId/benchmarks',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId, productId } = req.params;
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;
    const result = await brandService.getBrandProductPosts(brandId, productId, userId, ContentPostType.COMPARE, {
      cursor,
      limit,
    });
    return res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/products/{productId}/tips:
 *   get:
 *     summary: Marka ürününe ait tips gönderilerini listele
 *     description: Marka ürününe ait tips gönderilerinin cursor-based pagination ile listelendiği endpoint.
 *     tags: [Brand Catalog]
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
 *         description: Tips gönderileri başarıyla listelendi.
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
 *                         enum: ['tipsAndTricks']
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
  '/:brandId/products/:productId/tips',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId, productId } = req.params;
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;
    const result = await brandService.getBrandProductPosts(brandId, productId, userId, ContentPostType.TIPS, {
      cursor,
      limit,
    });
    return res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/products/{productId}/questions:
 *   get:
 *     summary: Marka ürününe ait question gönderilerini listele
 *     description: Marka ürününe ait question gönderilerinin cursor-based pagination ile listelendiği endpoint.
 *     tags: [Brand Catalog]
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
 *         description: Question gönderileri başarıyla listelendi.
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
 *                         enum: ['question']
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
  '/:brandId/products/:productId/questions',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId, productId } = req.params;
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
    const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;
    const result = await brandService.getBrandProductPosts(brandId, productId, userId, ContentPostType.QUESTION, {
      cursor,
      limit,
    });
    return res.json(result);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/products/{productId}/news:
 *   get:
 *     summary: Marka ürünlerine dair haberleri listele
 *     description: Marka ürünlerine dair haberlerin listelendiği endpoint.
 *     tags: [Brand Catalog]
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
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 12;
    const news = await brandService.getBrandProductNews(brandId, productId, userId, page, limit);
    return res.json(news);
  }),
);

/**
 * @openapi
 * /brands/{brandId}/products/{productId}/news/{newsId}:
 *   get:
 *     summary: Marka ürününe ait haber detayını getir
 *     description: Marka ürününe ait belirli bir haberin detaylı bilgilerini getirir. Banner, title, content, interactions (beğeni, yorum, paylaşım, save) bilgilerini içerir.
 *     tags: [Brand Catalog]
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
 *       - in: path
 *         name: newsId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: News ID'si
 *     responses:
 *       200:
 *         description: Haber detayı başarıyla getirildi.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 content:
 *                   type: string
 *                   description: Haberin tam içeriği
 *                 source:
 *                   type: string
 *                 date:
 *                   type: string
 *                   format: date-time
 *                 banner:
 *                   type: string
 *                   nullable: true
 *                   description: Banner image URL
 *                 author:
 *                   type: string
 *                   nullable: true
 *                 tags:
 *                   type: array
 *                   items:
 *                     type: string
 *                 likesCount:
 *                   type: integer
 *                 commentsCount:
 *                   type: integer
 *                 sharesCount:
 *                   type: integer
 *                 favoritesCount:
 *                   type: integer
 *                 viewsCount:
 *                   type: integer
 *                 isLiked:
 *                   type: boolean
 *                   description: Kullanıcının bu news'i beğenip beğenmediği
 *                 isFavorited:
 *                   type: boolean
 *                   description: Kullanıcının bu news'i favorilere ekleyip eklemediği
 *                 isShared:
 *                   type: boolean
 *                   description: Kullanıcının bu news'i paylaşıp paylaşmadığı
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Brand, product veya news bulunamadı.
 */
router.get(
  '/:brandId/products/:productId/news/:newsId',
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId, productId, newsId } = req.params;
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Brand ve product kontrolü
    const brand = await brandService.getBrandProductDetail(brandId, productId).catch(() => null);
    if (!brand) {
      return res.status(404).json({ message: 'Brand or product not found' });
    }

    // News detayını getir
    const news = await newsService.getNewsById(newsId, userId);
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    return res.json(news);
  }),
);

export default router;

