import { Router, Request, Response } from 'express';
import { ExploreService } from '../../application/explore/explore.service';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';

const router = Router();
const exploreService = new ExploreService();

/**
 * @openapi
 * /explore/hottest:
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

    const result = await exploreService.getHottestPosts(String(userId), { cursor, limit });
    res.json(result);
  })
);

/**
 * @openapi
 * /explore/marketplace-banners:
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
    res.json(banners);
  })
);

/**
 * @openapi
 * /explore/events:
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

    if (limit < 1 || limit > 50) {
      return res.status(400).json({ message: 'Limit must be between 1 and 50' });
    }

    const result = await exploreService.getWhatsNewsEvents({ cursor, limit });
    res.json(result);
  })
);

/**
 * @openapi
 * /explore/brands/new:
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

    if (limit < 1 || limit > 50) {
      return res.status(400).json({ message: 'Limit must be between 1 and 50' });
    }

    const result = await exploreService.getNewBrands({ cursor, limit });
    res.json(result);
  })
);

/**
 * @openapi
 * /explore/products/new:
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
      return res.status(400).json({ message: 'Limit must be between 1 and 50' });
    }

    const result = await exploreService.getNewProducts({ cursor, limit });
    res.json(result);
  })
);

export default router;

