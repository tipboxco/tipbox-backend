import { Router, Request, Response } from 'express';
import { EventService } from '../../application/event/event.service';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';

const router = Router();
const eventService = new EventService();

/**
 * @openapi
 * /events/active:
 *   get:
 *     summary: Aktif event'leri getir
 *     description: Şu anda devam eden aktif event'lerin listesini getirir. Scroll ile pagination destekler.
 *     tags: [Events]
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
 *         description: Aktif event'ler başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EventCard'
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
  '/active',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ message: 'Limit must be between 1 and 50' });
    }

    const activeEvents = await eventService.getActiveEvents(userId, {
      cursor,
      ...(typeof limitParam === 'number' ? { limit: limitParam } : {}),
    });

    res.json(activeEvents);
  })
);

/**
 * @openapi
 * /events/upcoming:
 *   get:
 *     summary: Yaklaşan event'leri getir
 *     description: Gelecekte başlayacak event'lerin listesini getirir. Scroll ile pagination destekler.
 *     tags: [Events]
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
 *         description: Yaklaşan event'ler başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EventCard'
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
  '/upcoming',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ message: 'Limit must be between 1 and 50' });
    }

    const upcomingEvents = await eventService.getUpcomingEvents(userId, {
      cursor,
      ...(typeof limitParam === 'number' ? { limit: limitParam } : {}),
    });

    res.json(upcomingEvents);
  })
);

/**
 * @openapi
 * /events/{eventId}:
 *   get:
 *     summary: Event detayını getir
 *     description: Belirli bir event'in detaylı bilgilerini getirir (banner, rewards, isJoined, vb.)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Event detayı başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EventDetail'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 */
router.get(
  '/:eventId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const eventId = req.params.eventId;

    if (!eventId) {
      return res.status(400).json({ message: 'Event ID is required' });
    }

    const eventDetail = await eventService.getEventDetail(eventId, userId);
    res.json(eventDetail);
  })
);

/**
 * @openapi
 * /events/{eventId}/posts:
 *   get:
 *     summary: Event post'larını getir
 *     description: Event'e ait post'ları getirir. Feed formatında döner. Scroll ile pagination destekler.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
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
 *         description: Event post'ları başarıyla getirildi
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
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 */
router.get(
  '/:eventId/posts',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const eventId = req.params.eventId;

    if (!eventId) {
      return res.status(400).json({ message: 'Event ID is required' });
    }

    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ message: 'Limit must be between 1 and 50' });
    }

    const eventPosts = await eventService.getEventPosts(eventId, userId, {
      cursor,
      ...(typeof limitParam === 'number' ? { limit: limitParam } : {}),
    });

    res.json(eventPosts);
  })
);

/**
 * @openapi
 * /events/{eventId}/badges:
 *   get:
 *     summary: Event badge'lerini getir
 *     description: Event'te kazanılabilecek tüm badge'lerin listesini getirir. Scroll ile pagination destekler.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
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
 *         description: Event badge'leri başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Badge'
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
 *       404:
 *         description: Event not found
 */
router.get(
  '/:eventId/badges',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const eventId = req.params.eventId;

    if (!eventId) {
      return res.status(400).json({ message: 'Event ID is required' });
    }

    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ message: 'Limit must be between 1 and 50' });
    }

    const eventBadges = await eventService.getEventBadges(eventId, userId, {
      cursor,
      ...(typeof limitParam === 'number' ? { limit: limitParam } : {}),
    });

    res.json(eventBadges);
  })
);

export default router;


