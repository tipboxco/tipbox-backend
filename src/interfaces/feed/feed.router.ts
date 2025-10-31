import { Router, Request, Response } from 'express';
import { FeedService } from '../../application/feed/feed.service';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { FeedFilterOptions, FeedItemType } from './feed.dto';

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
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

  if (limit < 1 || limit > 50) {
    return res.status(400).json({ message: 'Limit must be between 1 and 50' });
  }

  const feed = await feedService.getUserFeed(String(userId), { cursor, limit });
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
 *         name: types
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [feed, benchmark, post, question, tipsAndTricks]
 *         description: İstenen feed tipleri
 *       - in: query
 *         name: categoryIds
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Kategori ID'leri
 *       - in: query
 *         name: productIds
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Ürün ID'leri
 *       - in: query
 *         name: userIds
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Kullanıcı ID'leri
 *       - in: query
 *         name: minLikes
 *         schema:
 *           type: integer
 *         description: Minimum beğeni sayısı
 *       - in: query
 *         name: minComments
 *         schema:
 *           type: integer
 *         description: Minimum yorum sayısı
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Başlangıç tarihi
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Bitiş tarihi
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
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

  if (limit < 1 || limit > 50) {
    return res.status(400).json({ message: 'Limit must be between 1 and 50' });
  }

  // Parse filters
  const filters: FeedFilterOptions = {};

  if (req.query.types) {
    const types = Array.isArray(req.query.types) 
      ? req.query.types as string[] 
      : [req.query.types as string];
    filters.types = types as FeedItemType[];
  }

  if (req.query.categoryIds) {
    filters.categoryIds = Array.isArray(req.query.categoryIds)
      ? req.query.categoryIds as string[]
      : [req.query.categoryIds as string];
  }

  if (req.query.productIds) {
    filters.productIds = Array.isArray(req.query.productIds)
      ? req.query.productIds as string[]
      : [req.query.productIds as string];
  }

  if (req.query.userIds) {
    filters.userIds = Array.isArray(req.query.userIds)
      ? req.query.userIds as string[]
      : [req.query.userIds as string];
  }

  if (req.query.minLikes) {
    filters.minLikes = parseInt(req.query.minLikes as string, 10);
  }

  if (req.query.minComments) {
    filters.minComments = parseInt(req.query.minComments as string, 10);
  }

  if (req.query.dateFrom || req.query.dateTo) {
    filters.dateRange = {};
    if (req.query.dateFrom) {
      filters.dateRange.from = req.query.dateFrom as string;
    }
    if (req.query.dateTo) {
      filters.dateRange.to = req.query.dateTo as string;
    }
  }

  const feed = await feedService.getFilteredFeed(String(userId), filters, { cursor, limit });
  res.json(feed);
}));

export default router;

