import { Router, Request, Response } from 'express';
import { FeedService } from '../../application/feed/feed.service';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { FeedFilterOptions } from './feed.dto';

const router = Router();
const feedService = new FeedService();

/**
 * @openapi
 * /feed:
 *   get:
 *     summary: Kullanıcının feed'ini getir
 *     description: Kullanıcının feed akışını pagination ile getirir. Performans için cache kullanır.
 *     tags: [Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor (son item'ın id'si)
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
 *         description: Feed başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     oneOf:
 *                       - type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [feed]
 *                           data:
 *                             $ref: '#/components/schemas/Post'
 *                       - type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [benchmark]
 *                           data:
 *                             $ref: '#/components/schemas/BenchmarkPost'
 *                       - type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [post]
 *                           data:
 *                             $ref: '#/components/schemas/Post'
 *                       - type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [question]
 *                           data:
 *                             $ref: '#/components/schemas/Post'
 *                       - type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [tipsAndTricks]
 *                           data:
 *                             $ref: '#/components/schemas/TipsAndTricksPost'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     cursor:
 *                       type: string
 *                     hasMore:
 *                       type: boolean
 *                     limit:
 *                       type: integer
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const cursor = req.query.cursor as string | undefined;
  const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

  if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 200)) {
    return res.status(400).json({ message: 'Limit must be between 1 and 200' });
  }

  const feed = await feedService.getUserFeed(String(userId), {
    cursor,
    ...(typeof limitParam === 'number' ? { limit: limitParam } : {}),
  });
  res.json(feed);
}));

/**
 * @openapi
 * /feed/filtered:
 *   get:
 *     summary: Filtrelenmiş feed getir
 *     description: Kullanıcının feed'ini filtrelerle getirir
 *     tags: [Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: interests
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Kullanıcının ilgi alanlarını temsil eden kategori / konu ID'leri
 *       - in: query
 *         name: tags
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [Review, Benchmark, Tips, Question, Experience, Update]
 *         description: İçerik etiketleri (ör. Review, Benchmark, Tips)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Birincil kategori ID'si
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [recent, top]
 *           default: recent
 *         description: Sıralama tipi (recent = en yeni, top = etkileşime göre)
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
 *         description: Filtrelenmiş feed başarıyla getirildi
 */
router.get('/filtered', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const cursor = req.query.cursor as string | undefined;
  const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const limit = typeof limitParam === 'number' ? limitParam : 20;

  if (limit < 1 || limit > 50) {
    return res.status(400).json({ message: 'Limit must be between 1 and 50' });
  }

  // Parse filters based on new UX: Interests - Tags - Category - Sort
  const filters: FeedFilterOptions = {};

  if (req.query.interests) {
    filters.interests = Array.isArray(req.query.interests)
      ? (req.query.interests as string[])
      : [req.query.interests as string];
  }

  if (req.query.tags) {
    filters.tags = Array.isArray(req.query.tags)
      ? (req.query.tags as string[])
      : [req.query.tags as string];
  }

  if (req.query.category) {
    filters.category = req.query.category as string;
  }

  if (req.query.sort) {
    const sort = String(req.query.sort);
    if (sort === 'recent' || sort === 'top') {
      filters.sort = sort;
    }
  }

  const feed = await feedService.getFilteredFeed(String(userId), filters, {
    cursor,
    limit,
  });
  res.json(feed);
}));

export default router;

