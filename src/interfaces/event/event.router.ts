import { Router, Request, Response } from 'express';
import { EventService } from '../../application/event/event.service';
import { UserService } from '../../application/user/user.service';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { getErrorMessage, hasErrorMessage, errorMessageIncludes } from '../../infrastructure/errors/error-helper';
import logger from '../../infrastructure/logger/logger';

const router = Router();
const eventService = new EventService();
const userService = new UserService();

/**
 * @openapi
 * /events/achievements:
 *   get:
 *     summary: Kullanıcının tüm achievement rozetlerini getir
 *     description: Achievement sekmesindeki badge listesini status bilgisiyle (not-started, in_progress, completed) birlikte döner. Infinity scroll destekler.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Son alınan badge'in id'si (infinite scroll için)
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Sayfa başına döndürülecek maksimum badge sayısı
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [not-started, in_progress, completed]
 *         description: İlerleme durumuna göre filtreleme
 *     responses:
 *       200:
 *         description: Achievement badge listesi
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/achievements',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
    const parsedLimit =
      typeof rawLimit === 'string'
        ? Number.parseInt(rawLimit, 10)
        : typeof rawLimit === 'number'
          ? rawLimit
          : undefined;
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit! > 0 ? Math.min(parsedLimit!, 50) : undefined;

    const rawStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
    const status =
      rawStatus === 'not-started' || rawStatus === 'in_progress' || rawStatus === 'completed'
        ? rawStatus
        : undefined;

    const result = await userService.getAchievementBadges(String(userId), {
      cursor,
      limit,
      status,
    });

    return res.json(result);
  })
);

/**
 * @openapi
 * /events/limited:
 *   get:
 *     summary: Aktif limited time event bilgisini getir
 *     description: Kullanıcı için aktif olan limited time event'i, leaderboard ve kullanıcı skoruyla birlikte döner.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Limited time event bilgisi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LimitedTimeEventResponse'
 *       204:
 *         description: Aktif limited time event yok
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/limited',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const event = await eventService.getLimitedTimeEvent(String(userId));
    if (!event) {
      return res.status(204).send();
    }

    return res.json(event);
  })
);

/**
 * @openapi
 * /events/my-events:
 *   get:
 *     summary: Kullanıcının katıldığı aktif event'leri getir
 *     description: Kullanıcının post attığı ve halen aktif olan event'lerin listesini getirir.
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
 *         description: Kullanıcının event'leri başarıyla getirildi
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
  '/my-events',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ message: 'Limit must be between 1 and 50' });
    }

    const myEvents = await eventService.getMyActiveEvents(String(userId), {
      cursor,
      ...(typeof limitParam === 'number' ? { limit: limitParam } : {}),
    });

    return res.json(myEvents);
  })
);

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
    const userPayload = req.user;
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

    return res.json(activeEvents);
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
    const userPayload = req.user;
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

    return res.json(upcomingEvents);
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
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const eventId = req.params.eventId;

    if (!eventId) {
      return res.status(400).json({ message: 'Event ID is required' });
    }

    const eventDetail = await eventService.getEventDetail(eventId, userId);
    return res.json(eventDetail);
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
    const userPayload = req.user;
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

    return res.json(eventPosts);
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
    const userPayload = req.user;
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

    return res.json(eventBadges);
  })
);

/**
 * @openapi
 * /events/{eventId}/join:
 *   post:
 *     summary: Event'e katıl
 *     description: Kullanıcının event'e katılmasını sağlar. Response formatı GET /events/{eventId} ile aynıdır.
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
 *         description: Event'e başarıyla katıldı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EventDetail'
 *       400:
 *         description: Event'e zaten katılmış veya event'e katılamaz durumda
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 */
router.post(
  '/:eventId/join',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const eventId = req.params.eventId;

    if (!eventId) {
      return res.status(400).json({ message: 'Event ID is required' });
    }

    try {
      const eventDetail = await eventService.joinEvent(eventId, userId);
      return res.json(eventDetail);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (hasErrorMessage(error, 'Event not found')) {
        return res.status(404).json({ message: 'Event not found' });
      }
      if (errorMessageIncludes(error, 'already joined') || errorMessageIncludes(error, 'not started') || errorMessageIncludes(error, 'ended') || errorMessageIncludes(error, 'not published')) {
        return res.status(400).json({ message });
      }
      logger.error(`Error joining event ${eventId}:`, error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  })
);

/**
 * @openapi
 * /events/{eventId}/leave:
 *   post:
 *     summary: Event'ten ayrıl
 *     description: Kullanıcının event'ten ayrılmasını sağlar. Response formatı GET /events/{eventId} ile aynıdır. Idempotent endpoint - zaten ayrılmışsa hata vermez.
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
 *         description: Event'ten başarıyla ayrıldı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EventDetail'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 */
router.post(
  '/:eventId/leave',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const eventId = req.params.eventId;

    if (!eventId) {
      return res.status(400).json({ message: 'Event ID is required' });
    }

    try {
      const eventDetail = await eventService.leaveEvent(eventId, userId);
      return res.json(eventDetail);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (hasErrorMessage(error, 'Event not found')) {
        return res.status(404).json({ message: 'Event not found' });
      }
      logger.error(`Error leaving event ${eventId}:`, error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  })
);

/**
 * @openapi
 * /events/{eventId}/requirements:
 *   get:
 *     summary: Event gereksinimlerini ve ilerlemeyi getir
 *     description: Event gereksinimlerini ve kullanıcının ilerlemesini getirir.
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
 *         description: Event gereksinimleri başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 eventId:
 *                   type: string
 *                 requirements:
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
 *                       type:
 *                         type: string
 *                         enum: [survey, post, share, other]
 *                       completed:
 *                         type: boolean
 *                       progress:
 *                         type: object
 *                         properties:
 *                           current:
 *                             type: integer
 *                           total:
 *                             type: integer
 *                 overallProgress:
 *                   type: object
 *                   properties:
 *                     completed:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     percentage:
 *                       type: number
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 */
router.get(
  '/:eventId/requirements',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const eventId = req.params.eventId;

    if (!eventId) {
      return res.status(400).json({ message: 'Event ID is required' });
    }

    try {
      const requirements = await eventService.getEventRequirements(eventId, userId);
      return res.json(requirements);
    } catch (error: unknown) {
      if (hasErrorMessage(error, 'Event not found')) {
        return res.status(404).json({ message: 'Event not found' });
      }
      logger.error(`Error getting event requirements ${eventId}:`, error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  })
);

export default router;


