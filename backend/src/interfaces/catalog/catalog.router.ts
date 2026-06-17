import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { CatalogService } from '../../application/catalog/catalog.service';

const router = Router();
const catalogService = new CatalogService();

router.use(authMiddleware);

/**
 * @openapi
 * /api/catalog/categories:
 *   get:
 *     summary: Tüm kategorileri listele
 *     description: Kullanıcının app içerisindeki tüm kategorileri görüntülediği endpoint.
 *     tags: [Product Catalog]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kategoriler başarıyla listelendi.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
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
    const categories = await catalogService.getAllCategories();
    return res.json(categories);
  }),
);

/**
 * @openapi
 * /api/catalog/categories/{categoryId}/sub-categories:
 *   get:
 *     summary: Kategoriye göre sub-kategorileri listele
 *     description: Kullanıcının seçtiği kategoriye göre app içerisindeki Sub Categoriesleri görüntülediği endpoint. Cursor-based pagination ile 20'li sayfalama yapar.
 *     tags: [Product Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *         description: Kategori ID'si
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor (önceki sayfanın son item ID'si)
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
 *         description: Sub-kategoriler başarıyla listelendi.
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
 *                       subCategoryId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       image:
 *                         type: string
 *                         nullable: true
 *                       categoryId:
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
 *         description: Kategori bulunamadı.
 */
router.get(
  '/categories/:categoryId/sub-categories',
  asyncHandler(async (req: Request, res: Response) => {
    const { categoryId } = req.params;
    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    
    // Limit kontrolü - max 50, ama 100'e kadar kabul et (frontend 100 gönderiyor)
    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 100)) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 100' });
    }

    const subCategories = await catalogService.getSubCategoriesByCategoryId(categoryId, {
      cursor,
      limit: limitParam,
    });
    return res.json(subCategories);
  }),
);

/**
 * @openapi
 * /api/catalog/sub-categories/{subCategoryId}/product-groups:
 *   get:
 *     summary: Sub-kategoriye göre product group'ları listele
 *     description: Kullanıcının seçtiği sub kategoriye göre app içerisindeki Product Group listesini görüntülediği endpoint. Cursor-based pagination ile 20'li sayfalama yapar.
 *     tags: [Product Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subCategoryId
 *         required: true
 *         schema:
 *           type: string
 *         description: Sub-kategori ID'si
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor (önceki sayfanın son item ID'si)
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
 *         description: Product group'lar başarıyla listelendi.
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
 *                       name:
 *                         type: string
 *                       image:
 *                         type: string
 *                         nullable: true
 *                       subCategoryId:
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
 *         description: Sub-kategori bulunamadı.
 */
router.get(
  '/sub-categories/:subCategoryId/product-groups',
  asyncHandler(async (req: Request, res: Response) => {
    const { subCategoryId } = req.params;
    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    
    // Limit kontrolü - max 50, ama 100'e kadar kabul et (frontend 100 gönderiyor)
    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 100)) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 100' });
    }

    const productGroups = await catalogService.getProductGroupsBySubCategoryId(subCategoryId, {
      cursor,
      limit: limitParam,
    });
    return res.json(productGroups);
  }),
);

/**
 * @openapi
 * /api/catalog/subcategories/search:
 *   get:
 *     summary: İsim bazlı sub-kategori araması
 *     description: Sub-kategorileri (level=1) ada göre arar. Breadcrumb için üst kategori adını da döndürür. Cursor-based pagination.
 *     tags: [Product Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Arama terimi
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *         description: Pagination cursor
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 20 }
 *         description: Sayfa başına item sayısı
 *     responses:
 *       200:
 *         description: Arama sonuçları başarıyla getirildi.
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/subcategories/search',
  asyncHandler(async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
    }

    const result = await catalogService.searchSubCategories(q, { cursor, limit: limitParam });
    return res.json(result);
  }),
);

/**
 * @openapi
 * /api/catalog/subcategories/popular:
 *   get:
 *     summary: Popüler sub-kategoriler
 *     description: En fazla post içeren sub-kategorileri (level=1) döndürür.
 *     tags: [Product Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 10 }
 *         description: Döndürülecek item sayısı
 *     responses:
 *       200:
 *         description: Popüler sub-kategoriler başarıyla getirildi.
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/subcategories/popular',
  asyncHandler(async (req: Request, res: Response) => {
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    if (limitParam < 1 || limitParam > 50) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
    }

    const result = await catalogService.getPopularSubCategories(limitParam);
    return res.json(result);
  }),
);

/**
 * @openapi
 * /api/catalog/product-groups/search:
 *   get:
 *     summary: İsim bazlı product group araması
 *     description: Product group'ları (level=2) ada göre arar. Breadcrumb için üst alt-kategori ve kök kategori adlarını da döndürür. Cursor-based pagination.
 *     tags: [Product Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Arama terimi
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *         description: Pagination cursor
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 20 }
 *         description: Sayfa başına item sayısı
 *     responses:
 *       200:
 *         description: Arama sonuçları başarıyla getirildi.
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/product-groups/search',
  asyncHandler(async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
    }

    const result = await catalogService.searchProductGroups(q, { cursor, limit: limitParam });
    return res.json(result);
  }),
);

/**
 * @openapi
 * /api/catalog/product-groups/popular:
 *   get:
 *     summary: Popüler product group'lar
 *     description: En fazla post içeren product group'ları (level=2) döndürür.
 *     tags: [Product Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 10 }
 *         description: Döndürülecek item sayısı
 *     responses:
 *       200:
 *         description: Popüler product group'lar başarıyla getirildi.
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/product-groups/popular',
  asyncHandler(async (req: Request, res: Response) => {
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    if (limitParam < 1 || limitParam > 50) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
    }

    const result = await catalogService.getPopularProductGroups(limitParam);
    return res.json(result);
  }),
);

/**
 * @openapi
 * /api/catalog/product-groups/{productGroupId}/products:
 *   get:
 *     summary: Product group'a göre ürünleri listele
 *     description: Kullanıcının seçtiği Product Group'a göre app içerisindeki Product listesini görüntülediği endpoint. Cursor-based pagination ile 20'li sayfalama yapar.
 *     tags: [Product Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productGroupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Product group ID'si
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Product adı, marka veya açıklamasında arama yapar
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor (önceki sayfanın son item ID'si)
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
 *         description: Ürünler başarıyla listelendi.
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
 *                       productGroupId:
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
 *         description: Product group bulunamadı.
 */
router.get(
  '/product-groups/:productGroupId/products',
  asyncHandler(async (req: Request, res: Response) => {
    const { productGroupId } = req.params;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    
    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
    }

    const products = await catalogService.getProductsByProductGroupId(productGroupId, search, {
      cursor,
      limit: limitParam,
    });
    return res.json(products);
  }),
);

/**
 * @openapi
 * /api/catalog/sub-categories/{subCategoryId}/posts:
 *   get:
 *     summary: Sub category'ye ait post'ları getir
 *     description: Belirli bir sub category'ye ait post'ları getirir. Hiyerarşik feed mantığı ile alt product group ve product'ların gönderilerini de içerir. Feed formatında döner.
 *     tags: [Product Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subCategoryId
 *         required: true
 *         schema:
 *           type: string
 *         description: Sub category ID'si (UUID veya external ID formatında olabilir)
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [all, free, tips_and_tricks, questions]
 *           default: all
 *         description: Post tipi filtresi (opsiyonel). all = Tüm gönderiler (Free, Tips, Question), free = Free gönderiler, tips_and_tricks = Tips gönderileri, questions = Question gönderileri
 *         style: form
 *         explode: false
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest, most_popular]
 *           default: newest
 *         description: Sıralama tipi. newest = En yeni, oldest = En eski, most_popular = En popüler
 *         style: form
 *         explode: false
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
 *         description: Sub category post'ları başarıyla getirildi.
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
 *         description: Sub category bulunamadı.
 */
router.get(
  '/sub-categories/:subCategoryId/posts',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const { subCategoryId } = req.params;
    const filter = req.query.filter as string | undefined; // all, free, tips_and_tricks, questions
    const sort = req.query.sort as string | undefined; // newest, oldest, most_popular
    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
    }

    const posts = await catalogService.getSubCategoryPosts(subCategoryId, userId, {
      filter,
      sort,
      cursor,
      ...(typeof limitParam === 'number' ? { limit: limitParam } : {}),
    });

    return res.json(posts);
  }),
);

/**
 * @openapi
 * /api/catalog/product-groups/{productGroupId}/posts:
 *   get:
 *     summary: Product group'a ait post'ları getir
 *     description: Belirli bir product group'a ait post'ları getirir. Hiyerarşik feed mantığı ile alt product'ların gönderilerini de içerir. Feed formatında döner.
 *     tags: [Product Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productGroupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Product group ID'si (UUID veya external ID formatında olabilir)
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [all, free, tips_and_tricks, questions]
 *           default: all
 *         description: Post tipi filtresi (opsiyonel). all = Tüm gönderiler (Free, Tips, Question), free = Free gönderiler, tips_and_tricks = Tips gönderileri, questions = Question gönderileri
 *         style: form
 *         explode: false
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest, most_popular]
 *           default: newest
 *         description: Sıralama tipi. newest = En yeni, oldest = En eski, most_popular = En popüler
 *         style: form
 *         explode: false
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
 *         description: Product group post'ları başarıyla getirildi.
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
 *         description: Product group bulunamadı.
 */
router.get(
  '/product-groups/:productGroupId/posts',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const { productGroupId } = req.params;
    const filter = req.query.filter as string | undefined; // all, free, tips_and_tricks, questions
    const sort = req.query.sort as string | undefined; // newest, oldest, most_popular
    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
    }

    const posts = await catalogService.getProductGroupPosts(productGroupId, userId, {
      filter,
      sort,
      cursor,
      ...(typeof limitParam === 'number' ? { limit: limitParam } : {}),
    });

    return res.json(posts);
  }),
);

/**
 * @openapi
 * /api/catalog/products/{productId}/posts:
 *   get:
 *     summary: Product'a ait post'ları getir
 *     description: Belirli bir product'a ait post'ları getirir. Product için deneyim (EXPERIENCE), ipucu (TIPS), karşılaştırma (COMPARE), soru (QUESTION), güncelleme (UPDATE) gönderileri paylaşılabilir. Feed formatında döner.
 *     tags: [Product Catalog]
 *     security:
 *       - bearerAuth:  []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID'si
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [all, tips_and_tricks, reviews, benchmarks, questions, updates]
 *           default: all
 *         description: Post tipi filtresi (opsiyonel). all = Tüm gönderiler, tips_and_tricks = Tips gönderileri, reviews = Experience gönderileri, benchmarks = Comparison gönderileri, questions = Question gönderileri, updates = Update gönderileri
 *         style: form
 *         explode: false
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest, most_popular]
 *           default: newest
 *         description: Sıralama tipi. newest = En yeni, oldest = En eski, most_popular = En popüler
 *         style: form
 *         explode: false
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
 *         description: Product post'ları başarıyla getirildi.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 * 
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
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
 *         description: Product bulunamadı.
 */
/**
 * @openapi
 * /api/catalog/products/search:
 *   get:
 *     summary: Global product search - Tüm product group'lar arasında arama
 *     description: Tüm product group'lar arasında arama yapar ve sonuçları product group bazında gruplar. Sadece eşleşen ürünü olan product group'lar döner.
 *     tags: [Product Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         required: true
 *         schema:
 *           type: string
 *         description: Product name, brand veya description'da arama
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor (son dönen product group ID'si)
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
 *                       productGroupId:
 *                         type: string
 *                       productGroupName:
 *                         type: string
 *                       productGroupImage:
 *                         type: string
 *                         nullable: true
 *                       subCategoryId:
 *                         type: string
 *                       subCategoryName:
 *                         type: string
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
 *                             productGroupId:
 *                               type: string
 *                             subCategoryId:
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
  '/products/search',
  asyncHandler(async (req: Request, res: Response) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    
    if (!search || search.length === 0) {
      return res.status(400).json({ success: false, message: 'Search parameter is required' });
    }

    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    
    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
    }

    const result = await catalogService.searchProductsGlobally(search, {
      cursor,
      limit: limitParam,
    });

    return res.json(result);
  }),
);

/**
 * @openapi
 * /api/catalog/context/{contextId}/posts:
 *   get:
 *     summary: Context'e ait post'ları getir (Smart Endpoint)
 *     description: |
 *       Herhangi bir context ID'si (main category, sub category, product group, product) alır ve otomatik olarak doğru post listesini döndürür.
 *       ID prefix veya veritabanı sorgusu ile context type'ı otomatik belirlenir.
 *       - `pcat_` ile başlayan ID'ler → Category (main veya sub)
 *       - `prod_` ile başlayan ID'ler → Product
 *       - UUID formatındaki ID'ler → ProductGroup, SubCategory veya MainCategory (otomatik tespit)
 *       
 *       Response'ta `contextType` field'ı ile hangi context'ten geldiği belirtilir: 'main_category', 'sub_category', 'product_group', 'product'
 *     tags: [Product Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contextId
 *         required: true
 *         schema:
 *           type: string
 *         description: Context ID (category, product group, product - herhangi bir format)
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [all, free, tips_and_tricks, questions, updates, benchmarks, reviews]
 *         description: Post tipi filtresi
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest, most_popular]
 *         description: Sıralama türü
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
 *         description: Sayfa başına item sayısı (1-50)
 *     responses:
 *       200:
 *         description: Post listesi başarıyla döndürüldü
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
 *                 contextType:
 *                   type: string
 *                   enum: [main_category, sub_category, product_group, product]
 *       404:
 *         description: Context bulunamadı
 */
router.get(
  '/context/:contextId/posts',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const { contextId } = req.params;
    
    const filter = req.query.filter as string | undefined;
    const sort = req.query.sort as string | undefined;
    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
    }

    const result = await catalogService.getContextPosts(contextId, userId, {
      filter,
      sort,
      cursor,
      ...(typeof limitParam === 'number' ? { limit: limitParam } : {}),
    });

    return res.json(result);
  }),
);

router.get(
  '/products/:productId/posts',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const { productId } = req.params;
    
    const filterParam = req.query.filter as string | undefined;
    
    // Map filter to ContentPostType
    let filter: string | undefined = filterParam;
    if (!filter || filter === 'all') {
      // Product için izin verilen tüm post tipleri: EXPERIENCE, TIPS, COMPARE, QUESTION, UPDATE
      filter = 'all';
    }
    
    const sort = req.query.sort as string | undefined; // newest, oldest, most_popular
    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
    }

    const posts = await catalogService.getProductPosts(productId, userId, {
      filter,
      sort,
      cursor,
      ...(typeof limitParam === 'number' ? { limit: limitParam } : {}),
    });

    return res.json(posts);
  }),
);

export default router;

