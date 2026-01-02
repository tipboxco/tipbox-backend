import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { CatalogService } from '../../application/catalog/catalog.service';

const router = Router();
const catalogService = new CatalogService();

router.use(authMiddleware);

/**
 * @openapi
 * /catalog/categories:
 *   get:
 *     summary: Tüm kategorileri listele
 *     description: Kullanıcının app içerisindeki tüm kategorileri görüntülediği endpoint.
 *     tags: [Catalog]
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
 * /catalog/categories/{categoryId}/sub-categories:
 *   get:
 *     summary: Kategoriye göre sub-kategorileri listele
 *     description: Kullanıcının seçtiği kategoriye göre app içerisindeki Sub Categoriesleri görüntülediği endpoint.
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Kategori ID'si
 *     responses:
 *       200:
 *         description: Sub-kategoriler başarıyla listelendi.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   subCategoryId:
 *                     type: string
 *                     format: uuid
 *                   name:
 *                     type: string
 *                   image:
 *                     type: string
 *                     nullable: true
 *                   categoryId:
 *                     type: string
 *                     format: uuid
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Kategori bulunamadı.
 */
router.get(
  '/categories/:categoryId/sub-categories',
  asyncHandler(async (req: Request, res: Response) => {
    const { categoryId } = req.params;
    const subCategories = await catalogService.getSubCategoriesByCategoryId(categoryId);
    return res.json(subCategories);
  }),
);

/**
 * @openapi
 * /catalog/sub-categories/{subCategoryId}/product-groups:
 *   get:
 *     summary: Sub-kategoriye göre product group'ları listele
 *     description: Kullanıcının seçtiği sub kategoriye göre app içerisindeki Product Group listesini görüntülediği endpoint.
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subCategoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Sub-kategori ID'si
 *     responses:
 *       200:
 *         description: Product group'lar başarıyla listelendi.
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
 *                   name:
 *                     type: string
 *                   image:
 *                     type: string
 *                     nullable: true
 *                   subCategoryId:
 *                     type: string
 *                     format: uuid
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Sub-kategori bulunamadı.
 */
router.get(
  '/sub-categories/:subCategoryId/product-groups',
  asyncHandler(async (req: Request, res: Response) => {
    const { subCategoryId } = req.params;
    const productGroups = await catalogService.getProductGroupsBySubCategoryId(subCategoryId);
    return res.json(productGroups);
  }),
);

/**
 * @openapi
 * /catalog/product-groups/{productGroupId}/products:
 *   get:
 *     summary: Product group'a göre ürünleri listele
 *     description: Kullanıcının seçtiği Product Group'a göre app içerisindeki Product listesini görüntülediği endpoint.
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productGroupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product group ID'si
 *     responses:
 *       200:
 *         description: Ürünler başarıyla listelendi.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   productId:
 *                     type: string
 *                     format: uuid
 *                   name:
 *                     type: string
 *                   image:
 *                     type: string
 *                     nullable: true
 *                   productGroupId:
 *                     type: string
 *                     format: uuid
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Product group bulunamadı.
 */
router.get(
  '/product-groups/:productGroupId/products',
  asyncHandler(async (req: Request, res: Response) => {
    const { productGroupId } = req.params;
    const products = await catalogService.getProductsByProductGroupId(productGroupId);
    return res.json(products);
  }),
);

/**
 * @openapi
 * /catalog/products/{productId}:
 *   get:
 *     summary: Product detay bilgilerini getir
 *     description: Belirli bir product'ın detaylı bilgilerini getirir.
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *                   format: uuid
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
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 *       404:
 *         description: Product bulunamadı.
 */
router.get(
  '/products/:productId',
  asyncHandler(async (req: Request, res: Response) => {
    const { productId } = req.params;
    const product = await catalogService.getProductById(productId);
    return res.json(product);
  }),
);

/**
 * @openapi
 * /catalog/products/{productId}/posts:
 *   get:
 *     summary: Product'a ait post'ları getir
 *     description: Belirli bir product'a ait post'ları getirir. Feed formatında döner.
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID'si
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [experience, comments, benchmark]
 *         description: Post tipi filtresi (opsiyonel)
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
router.get(
  '/products/:productId/posts',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    const { productId } = req.params;
    const type = req.query.type as string | undefined;
    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ message: 'Limit must be between 1 and 50' });
    }

    const posts = await catalogService.getProductPosts(productId, userId, {
      type,
      cursor,
      ...(typeof limitParam === 'number' ? { limit: limitParam } : {}),
    });

    return res.json(posts);
  }),
);

/**
 * @openapi
 * /catalog/products/{productId}/news:
 *   get:
 *     summary: Product'a ait haberleri getir
 *     description: Belirli bir product'a ait haberleri getirir. Cursor-based pagination destekler.
 *     tags: [Catalog]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID'si
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
 *         description: Product haberleri başarıyla getirildi.
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
 *                       source:
 *                         type: string
 *                       date:
 *                         type: string
 *                         format: date-time
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
 *       404:
 *         description: Product bulunamadı.
 */
router.get(
  '/products/:productId/news',
  asyncHandler(async (req: Request, res: Response) => {
    const { productId } = req.params;
    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ message: 'Limit must be between 1 and 50' });
    }

    const news = await catalogService.getProductNews(productId, {
      cursor,
      ...(typeof limitParam === 'number' ? { limit: limitParam } : {}),
    });

    return res.json(news);
  }),
);

export default router;

