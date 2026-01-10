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
 *                     total:
 *                       type: integer
 *                       description: Toplam feed sayısı
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
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
  return res.json(feed);
}));

/**
 * @openapi
 * /feed/filtered:
 *   get:
 *     summary: Filtrelenmiş feed getir
 *     description: Kullanıcının feed'ini filtrelerle getirir. Kendi postları otomatik olarak filtrelenir.
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
 *             enum: [TRUSTER, CATEGORY_MATCH, TRENDING, NEW_USER, BOOSTED, INVENTORY_MATCH, PRODUCT_GROUP_MATCH]
 *         description: Feed source filtreleri. Kullanılabilir değerler: TRUSTER, CATEGORY_MATCH, TRENDING, NEW_USER, BOOSTED, INVENTORY_MATCH, PRODUCT_GROUP_MATCH
 *       - in: query
 *         name: tags
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [Review, Benchmark, Tips, Question, Experience, Update]
 *         description: İçerik etiketleri veya post type'ları. Review=FREE, Benchmark=COMPARE, Tips=TIPS, Question=QUESTION, Experience=EXPERIENCE, Update=UPDATE
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Birincil kategori ID'si (mainCategoryId veya subCategoryId). Kategorileri listelemek için GET /catalog/categories endpoint'ini kullanın.
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [recent, top]
 *         description: Sıralama tipi (recent = en yeni postlar, top = relevance score'a göre popüler olanlar)
 *       - in: query
 *         name: types
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [benchmark, post, question, tipsAndTricks, experience, update]
 *         description: Feed item type'larına göre filtrele
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
 *         description: Filtrelenmiş feed başarıyla getirildi
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
 *                       - type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [experience]
 *                           data:
 *                             $ref: '#/components/schemas/ExperiencePost'
 *                       - type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [update]
 *                           data:
 *                             $ref: '#/components/schemas/UpdatePost'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     cursor:
 *                       type: string
 *                     hasMore:
 *                       type: boolean
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                       description: Toplam filtreli feed sayısı (kendi postları hariç)
 */
router.get('/filtered', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
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
  return res.json(feed);
}));

/**
 * @openapi
 * /feed/seen:
 *   post:
 *     summary: Feed item'ları seen olarak işaretle
 *     description: Viewport tracking ile görülen feed'leri seen işaretle ve seen penalty uygula
 *     tags: [Feed]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - feedIds
 *             properties:
 *               feedIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Seen olarak işaretlenecek feed ID'leri
 *                 example: ["feed123", "feed456"]
 *     responses:
 *       200:
 *         description: Feed'ler başarıyla seen işaretlendi
 *       400:
 *         description: Geçersiz request
 *       401:
 *         description: Unauthorized
 */
router.post('/seen', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { feedIds } = req.body;

  if (!feedIds || !Array.isArray(feedIds) || feedIds.length === 0) {
    return res.status(400).json({ message: 'feedIds array is required' });
  }

  // Validation: Max 50 feed per request
  if (feedIds.length > 50) {
    return res.status(400).json({ message: 'Maximum 50 feeds per request' });
  }

  await feedService.markFeedAsSeen(feedIds);

  return res.status(200).json({
    message: 'Feeds marked as seen',
    count: feedIds.length,
  });
}));

/**
 * @openapi
 * /feed/{feedId}/hide:
 *   post:
 *     summary: Feed'i gizle
 *     description: Feed'i gizle (score * 0.3)
 *     tags: [Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: feedId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Feed gizlendi
 */
router.post('/:feedId/hide', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { feedId } = req.params;

  await feedService.handleUserFeedback(feedId, userId, 'hide');

  return res.status(200).json({ message: 'Feed hidden' });
}));

/**
 * @openapi
 * /feed/{feedId}/not-interested:
 *   post:
 *     summary: İlgilenmiyorum
 *     description: Feed'i düşük öncelikli yap (score * 0.3)
 *     tags: [Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: feedId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Feedback kaydedildi
 */
router.post('/:feedId/not-interested', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { feedId } = req.params;

  await feedService.handleUserFeedback(feedId, userId, 'not_interested');

  return res.status(200).json({ message: 'Feedback recorded' });
}));

/**
 * @openapi
 * /feed/{feedId}/save:
 *   post:
 *     summary: Feed'i kaydet/bookmark
 *     description: Feed'i kaydet ve score'u artır (score + 10)
 *     tags: [Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: feedId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Feed kaydedildi
 */
router.post('/:feedId/save', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { feedId } = req.params;

  await feedService.handleUserFeedback(feedId, userId, 'save');

  return res.status(200).json({ message: 'Feed saved' });
}));

/**
 * @openapi
 * /feed/{feedId}/report:
 *   post:
 *     summary: Feed'i şikayet et
 *     description: Feed'i sil ve post'u moderation'a gönder
 *     tags: [Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: feedId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Feed rapor edildi
 */
router.post('/:feedId/report', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { feedId } = req.params;

  await feedService.handleUserFeedback(feedId, userId, 'report');

  return res.status(200).json({ message: 'Feed reported' });
}));

/**
 * @openapi
 * /feed/source-counts:
 *   get:
 *     summary: Feed source sayılarını getir
 *     description: Her feed source için toplam sayıyı döndürür (kendi postları hariç)
 *     tags: [Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feed source sayıları başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 counts:
 *                   type: object
 *                   additionalProperties:
 *                     type: integer
 *                   description: Feed source'lara göre sayılar (TRUSTER, BOOSTED, MUTUAL_TRUST, vb.)
 *                   example:
 *                     TRUSTER: 1
 *                     MUTUAL_TRUST: 17
 *                     BOOSTED: 3
 *                     INVENTORY_MATCH: 1
 *                     CATEGORY_MATCH: 52
 *                     TRENDING: 0
 *                     NEW_USER: 6
 */
router.get('/source-counts', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const counts = await feedService.getFeedSourceCounts(String(userId));
  res.json({ counts });
}));

export default router;

