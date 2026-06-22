import { Router, Request, Response } from 'express';
import { ExploreService } from '../../application/explore/explore.service';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';

const router = Router();
const exploreService = new ExploreService();

/**
 * @openapi
 * /api/explore/hottest:
 *   get:
 *     summary: Trend olan içerikleri getir (Hottest)
 *     description: Sistemdeki en çok trend olan içerikleri getirir. Feed formatında döner.
 *     tags: [Explore]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Hottest posts başarıyla getirildi
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
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/hottest',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const cursor = req.query.cursor as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;

    if (limit < 1 || limit > 50) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
    }

    const result = await exploreService.getHottestPosts(String(userId), { cursor, limit, search });
    return res.json(result);
  })
);

/**
 * @openapi
 * /api/explore/search-posts:
 *   get:
 *     summary: Paylaşılan postlarda metin araması
 *     description: Post başlığı/içeriğinde arama yapar ve eşleşen postları feed formatında, en yeniden eskiye doğru döner.
 *     tags: [Explore]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Aranacak metin (post başlığı/içeriği)
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
 *         description: Arama sonuçları başarıyla getirildi
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/search-posts',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    if (limit < 1 || limit > 50) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
    }

    const result = await exploreService.searchPosts(String(userId), { q, cursor, limit });
    return res.json(result);
  })
);

/**
 * @openapi
 * /api/explore/marketplace-banners:
 *   get:
 *     summary: Marketplace banner'larını getir
 *     description: Aktif marketplace banner'larını getirir
 *     tags: [Explore]
 *     responses:
 *       200:
 *         description: Banner'lar başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   title:
 *                     type: string
 *                   description:
 *                     type: string
 *                   imageUrl:
 *                     type: string
 *                   linkUrl:
 *                     type: string
 */
router.get(
  '/marketplace-banners',
  asyncHandler(async (req: Request, res: Response) => {
    const banners = await exploreService.getMarketplaceBanners();
    return res.json(banners);
  })
);

/**
 * @openapi
 * /api/explore/events:
 *   get:
 *     summary: Yeni event'ları getir (What's News)
 *     description: Yeni oluşturulmuş event'ları getirir
 *     tags: [Explore]
 *     parameters:
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
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Event başlığı veya açıklamasında arama yapar
 *     responses:
 *       200:
 *         description: Event'lar başarıyla getirildi
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
 *                       eventId:
 *                         type: string
 *                       eventType:
 *                         type: string
 *                         enum: [SURVEY, POLL, CONTEST, CHALLENGE, PROMOTION]
 *                         description: Event tipi
 *                       image:
 *                         type: string
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       startDate:
 *                         type: string
 *                         format: date-time
 *                       endDate:
 *                         type: string
 *                         format: date-time
 *                       interaction:
 *                         type: integer
 *                       participants:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             userId:
 *                               type: string
 *                             avatar:
 *                               type: string
 *                             userName:
 *                               type: string
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
router.get(
  '/events',
  asyncHandler(async (req: Request, res: Response) => {
    const cursor = req.query.cursor as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;

    if (limit < 1 || limit > 50) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
    }

    const result = await exploreService.getWhatsNewsEvents({ cursor, limit, search });
    return res.json(result);
  })
);

/**
 * @openapi
 * /api/explore/brands/new:
 *   get:
 *     summary: Yeni katılmış markaları getir
 *     description: App içerisinde yeni katılmış olan markaları getirir
 *     tags: [Explore]
 *     parameters:
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
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Marka adında arama yapar
 *     responses:
 *       200:
 *         description: Markalar başarıyla getirildi
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
 *                       images:
 *                         type: string
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
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
router.get(
  '/brands/new',
  asyncHandler(async (req: Request, res: Response) => {
    const cursor = req.query.cursor as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;

    if (limit < 1 || limit > 50) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
    }

    const result = await exploreService.getNewBrands({ cursor, limit, search });
    return res.json(result);
  })
);

/**
 * @openapi
 * /api/explore/products/new:
 *   get:
 *     summary: Yeni eklenmiş ürünleri getir
 *     description: App içerisinde yeni eklenmiş olan ürünleri getirir
 *     tags: [Explore]
 *     parameters:
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
 *         description: Ürünler başarıyla getirildi
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
 *                       images:
 *                         type: string
 *                       title:
 *                         type: string
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
router.get(
  '/products/new',
  asyncHandler(async (req: Request, res: Response) => {
    const cursor = req.query.cursor as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    if (limit < 1 || limit > 50) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
    }

    const result = await exploreService.getNewProducts({ cursor, limit });
    return res.json(result);
  })
);

/**
 * @openapi
 * /api/explore/search:
 *   get:
 *     summary: Explore ekranında unified arama
 *     description: Post, product ve brand sonuçlarını birleştirerek arama yapar. Hottest ve News tab'ları için kullanılabilir.
 *     tags: [Explore]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Arama terimi
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [hottest, news]
 *           default: hottest
 *         description: Arama tipi (hottest veya news)
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
 *                       id:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [post, product, brand]
 *                       title:
 *                         type: string
 *                       content:
 *                         type: string
 *                       image:
 *                         type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     cursor:
 *                       type: string
 *                     hasMore:
 *                       type: boolean
 *                     limit:
 *                       type: integer
 *       400:
 *         description: Query parametresi eksik
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/search',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const q = req.query.q as string | undefined;
    const type = (req.query.type as 'hottest' | 'news') || 'hottest';
    const cursor = req.query.cursor as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Query parameter (q) is required' });
    }

    if (limit < 1 || limit > 50) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
    }

    if (type !== 'hottest' && type !== 'news') {
      return res.status(400).json({ success: false, message: 'Type must be either "hottest" or "news"' });
    }

    const result = await exploreService.searchExplore(String(userId), q.trim(), { type, cursor, limit });
    return res.json(result);
  })
);

export default router;

