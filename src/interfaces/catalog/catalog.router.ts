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
 *                   categoryId:
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
  '/categories',
  asyncHandler(async (req: Request, res: Response) => {
    const categories = await catalogService.getAllCategories();
    res.json(categories);
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
    res.json(subCategories);
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
    res.json(productGroups);
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
    res.json(products);
  }),
);

export default router;

