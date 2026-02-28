import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { MedusaService } from '../../application/medusa/medusa.service';

const router = Router();
const medusaService = new MedusaService();

router.use(authMiddleware);

/**
 * @openapi
 * /medusa/store/products/{productId}:
 *   get:
 *     summary: Medusa ürün bilgisini getir
 *     description: Medusa.js sunucusundan ürün ID'sine göre ürün bilgisini çeker.
 *     tags: [Medusa]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: Medusa ürün ID'si
 *     responses:
 *       200:
 *         description: Ürün bilgisi başarıyla getirildi.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 description:
 *                   type: string
 *                   nullable: true
 *                 handle:
 *                   type: string
 *                   nullable: true
 *                 images:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       url:
 *                         type: string
 *       404:
 *         description: Ürün bulunamadı.
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/store/products/:productId',
  asyncHandler(async (req: Request, res: Response) => {
    const { productId } = req.params;
    const product = await medusaService.getProductById(productId);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    return res.json(product);
  }),
);

/**
 * @openapi
 * /medusa/store/product-categories:
 *   get:
 *     summary: Medusa kategorilerini getir
 *     description: Medusa.js sunucusundan parent kategori ID'sine göre kategorileri çeker.
 *     tags: [Medusa]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: parentId
 *         schema:
 *           type: string
 *           nullable: true
 *         description: Parent kategori ID'si (null ise ana kategoriler)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 500
 *         description: Sonuç limiti
 *       - in: query
 *         name: includeDescendantsTree
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Alt kategorileri dahil et
 *     responses:
 *       200:
 *         description: Kategoriler başarıyla getirildi.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   handle:
 *                     type: string
 *                     nullable: true
 *                   description:
 *                     type: string
 *                     nullable: true
 *                   parent_category_id:
 *                     type: string
 *                     nullable: true
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/store/product-categories',
  asyncHandler(async (req: Request, res: Response) => {
    const parentId = req.query.parentId as string | null;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const includeDescendantsTree =
      req.query.includeDescendantsTree === 'true' || req.query.includeDescendantsTree === true;

    const categories = await medusaService.getCategoriesByParent(parentId || null, {
      limit,
      includeDescendantsTree,
    });

    return res.json(categories);
  }),
);

/**
 * @openapi
 * /medusa/store/filterable-products:
 *   get:
 *     summary: Medusa filtrelenebilir ürünleri getir
 *     description: Medusa.js sunucusundan kategori ID'sine göre filtrelenebilir ürünleri çeker.
 *     tags: [Medusa]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *         description: Kategori ID'si
 *       - in: query
 *         name: searchQuery
 *         schema:
 *           type: string
 *         description: Arama sorgusu
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Sayfa boyutu
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Sayfa offset'i
 *       - in: query
 *         name: metadataFilters
 *         schema:
 *           type: object
 *         description: Metadata filtreleri (JSON string olarak gönderilmeli)
 *     responses:
 *       200:
 *         description: Filtrelenebilir ürünler başarıyla getirildi.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *                 filterable_options:
 *                   type: object
 *                   nullable: true
 *       400:
 *         description: categoryId parametresi eksik.
 *       401:
 *         description: Kimlik doğrulaması başarısız.
 */
router.get(
  '/store/filterable-products',
  asyncHandler(async (req: Request, res: Response) => {
    const categoryId = req.query.categoryId as string;

    if (!categoryId) {
      return res.status(400).json({ success: false, message: 'categoryId parameter is required' });
    }

    const searchQuery = req.query.searchQuery as string | undefined;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;

    let metadataFilters: Record<string, string[]> | undefined;
    if (req.query.metadataFilters) {
      try {
        metadataFilters =
          typeof req.query.metadataFilters === 'string'
            ? JSON.parse(req.query.metadataFilters)
            : req.query.metadataFilters;
      } catch (error) {
        return res.status(400).json({ success: false, message: 'Invalid metadataFilters format' });
      }
    }

    const result = await medusaService.getFilterableProductsByCategoryId(categoryId, {
      searchQuery,
      pageSize,
      offset,
      metadataFilters,
    });

    return res.json(result);
  }),
);

export default router;

