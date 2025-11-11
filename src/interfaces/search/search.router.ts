import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { SearchService } from '../../application/search/search.service';

const router = Router();
const searchService = new SearchService();

/**
 * @openapi
 * /search:
 *   get:
 *     summary: Anahtar kelimeye göre kullanıcı, ürün ve marka araması (Top-N)
 *     description: Verilen keyword'e göre User, Product ve Brand sonuçlarını döndürür. Varsayılan olarak her tip için top-10 sonuç gelir.
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: keyword
 *         required: true
 *         schema:
 *           type: string
 *         description: Aranacak anahtar kelime
 *       - in: query
 *         name: types
 *         schema:
 *           type: string
 *           example: "user,brand,product"
 *         description: Virgülle ayrılmış arama tipleri (user,brand,product). Boş/atlandığında hepsi.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Her tip için döndürülecek maksimum sonuç sayısı.
 *     responses:
 *       200:
 *         description: Arama sonuçları
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userData:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       avatar: { type: string, nullable: true }
 *                       cosmetic: { type: string }
 *                 brandData:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       category: { type: string, nullable: true }
 *                       logo: { type: string, nullable: true }
 *                 productData:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       model: { type: string }
 *                       specs: { type: string }
 *                       image: { type: string, nullable: true }
 *       400:
 *         description: Geçersiz istek
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    let { keyword } = req.query as { keyword?: string };
    const { types, limit } = req.query as { types?: string; limit?: string };

    if (typeof keyword !== 'string') {
      return res.status(400).json({ message: 'keyword is required' });
    }

    keyword = keyword.trim();
    if (keyword.length === 0) {
      return res.status(400).json({ message: 'keyword cannot be empty' });
    }

    let limitPerType = 10;
    if (typeof limit === 'string') {
      const parsed = parseInt(limit, 10);
      if (!Number.isNaN(parsed)) {
        if (parsed < 1 || parsed > 50) {
          return res.status(400).json({ message: 'limit must be between 1 and 50' });
        }
        limitPerType = parsed;
      }
    }

    let selectedTypes: Array<'user' | 'brand' | 'product'> | undefined = undefined;
    if (typeof types === 'string' && types.trim().length > 0) {
      const parts = types
        .split(',')
        .map((p) => p.trim().toLowerCase())
        .filter((p) => ['user', 'brand', 'product'].includes(p));
      if (parts.length > 0) {
        selectedTypes = parts as Array<'user' | 'brand' | 'product'>;
      }
    }

    const result = await searchService.searchAll(keyword, limitPerType, selectedTypes);
    return res.json(result);
  })
);

export default router;


