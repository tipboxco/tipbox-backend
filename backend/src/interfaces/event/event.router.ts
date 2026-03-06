import { Router, Request, Response } from 'express';
import { EventService } from '../../application/event/event.service';
import { UserService } from '../../application/user/user.service';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { getErrorMessage, hasErrorMessage, errorMessageIncludes } from '../../infrastructure/errors/error-helper';
import logger from '../../infrastructure/logger/logger';
import { isAdmin } from '../../infrastructure/auth/role-checker';

const router = Router();
const eventService = new EventService();
const userService = new UserService();

/**
 * @openapi
 * components:
 *   schemas:
 *     EventProductSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         imageUrl:
 *           type: string
 *           nullable: true
 *     EventCard:
 *       type: object
 *       properties:
 *         eventId:
 *           type: string
 *         image:
 *           type: string
 *           nullable: true
 *         title:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         startDate:
 *           type: string
 *           format: date-time
 *         endDate:
 *           type: string
 *           format: date-time
 *         interaction:
 *           type: integer
 *         eventType:
 *           type: string
 *           enum: [PICKS, ROASTS]
 *         product:
 *           $ref: '#/components/schemas/EventProductSummary'
 *           nullable: true
 *         participants:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               avatar:
 *                 type: string
 *                 nullable: true
 *               userName:
 *                 type: string
 *     EventDetail:
 *       type: object
 *       properties:
 *         eventId:
 *           type: string
 *         banner:
 *           type: string
 *           nullable: true
 *         title:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         startDate:
 *           type: string
 *           format: date-time
 *         endDate:
 *           type: string
 *           format: date-time
 *         interaction:
 *           type: integer
 *         eventType:
 *           type: string
 *           enum: [PICKS, ROASTS]
 *         product:
 *           $ref: '#/components/schemas/EventProductSummary'
 *           nullable: true
 *         isJoined:
 *           type: boolean
 *         status:
 *           type: string
 *           enum: [active, upcoming]
 *         rewards:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               image:
 *                 type: string
 *                 nullable: true
 *               title:
 *                 type: string
 *     LimitedTimeEventLeaderboardUser:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         avatar:
 *           type: string
 *           nullable: true
 *         rank:
 *           type: integer
 *     LimitedTimeEventUser:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         avatar:
 *           type: string
 *           nullable: true
 *         rank:
 *           type: integer
 *         score:
 *           type: integer
 *     LimitedTimeEventResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         leaderboardUsers:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/LimitedTimeEventLeaderboardUser'
 *         userScore:
 *           $ref: '#/components/schemas/LimitedTimeEventUser'
 *           nullable: true
 *         backgroundImage:
 *           type: string
 *           nullable: true
 *         eventImage:
 *           type: string
 *           nullable: true
 *         startDate:
 *           type: string
 *           format: date-time
 *         endDate:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /api/events/achievements:
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
      return res.status(401).json({ success: false, message: 'Unauthorized' });
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
 * /api/events/limited:
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
      return res.status(401).json({ success: false, message: 'Unauthorized' });
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
 * /api/events/my-events:
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
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
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
 * /api/events/active:
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
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
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
 * /api/events/upcoming:
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
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
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
 * /api/events/{eventId}:
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
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const eventId = req.params.eventId;

    if (!eventId) {
      return res.status(400).json({ success: false, message: 'Event ID is required' });
    }

    const eventDetail = await eventService.getEventDetail(eventId, userId);
    return res.json(eventDetail);
  })
);

/**
 * @openapi
 * /api/events/{eventId}/posts:
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
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const eventId = req.params.eventId;

    if (!eventId) {
      return res.status(400).json({ success: false, message: 'Event ID is required' });
    }

    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
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
 * /api/events/{eventId}/badges:
 *   get:
 *     summary: Event badge'lerini kullanıcı progress'i ile getir
 *     description: Event'te kazanılabilecek tüm badge'lerin listesini kullanıcının ilerleme bilgisi ile birlikte getirir. Her badge için rarity, category ve detaylı progress bilgisi içerir.
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
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       imageUrl:
 *                         type: string
 *                         nullable: true
 *                       rarity:
 *                         type: string
 *                         enum: [common, rare, epic]
 *                       category:
 *                         type: string
 *                       userProgress:
 *                         type: object
 *                         properties:
 *                           current:
 *                             type: integer
 *                           target:
 *                             type: integer
 *                           isCompleted:
 *                             type: boolean
 *                           completedAt:
 *                             type: string
 *                             format: date-time
 *                           progressPercentage:
 *                             type: number
 *                       eventId:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
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
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const eventId = req.params.eventId;

    if (!eventId) {
      return res.status(400).json({ success: false, message: 'Event ID is required' });
    }

    const cursor = req.query.cursor as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (typeof limitParam === 'number' && (limitParam < 1 || limitParam > 50)) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
    }

    const eventBadges = await eventService.getEventBadgesWithProgress(
      eventId,
      String(userId),
      {
        cursor,
        ...(typeof limitParam === 'number' ? { limit: limitParam } : {}),
      }
    );

    return res.json(eventBadges);
  })
);

/**
 * @openapi
 * /api/events/{eventId}/join:
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
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const eventId = req.params.eventId;

    if (!eventId) {
      return res.status(400).json({ success: false, message: 'Event ID is required' });
    }

    try {
      const eventDetail = await eventService.joinEvent(eventId, userId);
      return res.json(eventDetail);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (hasErrorMessage(error, 'Event not found')) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }
      if (errorMessageIncludes(error, 'already joined') || errorMessageIncludes(error, 'not started') || errorMessageIncludes(error, 'ended') || errorMessageIncludes(error, 'not published')) {
        return res.status(400).json({ message });
      }
      logger.error(`Error joining event ${eventId}:`, error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  })
);

/**
 * @openapi
 * /api/events/{eventId}/leave:
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
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const eventId = req.params.eventId;

    if (!eventId) {
      return res.status(400).json({ success: false, message: 'Event ID is required' });
    }

    try {
      const eventDetail = await eventService.leaveEvent(eventId, userId);
      return res.json(eventDetail);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (hasErrorMessage(error, 'Event not found')) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }
      logger.error(`Error leaving event ${eventId}:`, error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  })
);

/**
 * @openapi
 * /api/events/{eventId}/progress:
 *   get:
 *     summary: Kullanıcının event ilerlemesini getir
 *     description: Kullanıcının event'teki metriklerini, badge progress'ini ve leaderboard'unu getirir
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
 *         description: Event progress bilgisi başarıyla getirildi
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 */
router.get(
  '/:eventId/progress',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const eventId = req.params.eventId;

    if (!eventId) {
      return res.status(400).json({ success: false, message: 'Event ID is required' });
    }

    try {
      const progress = await eventService.getUserEventProgress(String(userId), eventId);
      return res.json(progress);
    } catch (error: unknown) {
      if (hasErrorMessage(error, 'Event not found')) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }
      logger.error(`Error getting event progress ${eventId}:`, error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  })
);

/**
 * @openapi
 * /api/events/{eventId}/leaderboard:
 *   get:
 *     summary: Event leaderboard'unu getir
 *     description: Event'in sıralı kullanıcı listesini getirir
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
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Sayfa başına item sayısı
 *     responses:
 *       200:
 *         description: Event leaderboard başarıyla getirildi
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event not found
 */
router.get(
  '/:eventId/leaderboard',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const eventId = req.params.eventId;

    if (!eventId) {
      return res.status(400).json({ success: false, message: 'Event ID is required' });
    }

    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    if (limitParam < 1 || limitParam > 100) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 100' });
    }

    try {
      const leaderboard = await eventService.getEventLeaderboard(eventId, limitParam);
      return res.json(leaderboard);
    } catch (error: unknown) {
      if (hasErrorMessage(error, 'Event not found')) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }
      logger.error(`Error getting event leaderboard ${eventId}:`, error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  })
);

/**
 * @openapi
 * /api/events/{eventId}/requirements:
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
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const eventId = req.params.eventId;

    if (!eventId) {
      return res.status(400).json({ success: false, message: 'Event ID is required' });
    }

    try {
      const requirements = await eventService.getEventRequirements(eventId, userId);
      return res.json(requirements);
    } catch (error: unknown) {
      if (hasErrorMessage(error, 'Event not found')) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }
      logger.error(`Error getting event requirements ${eventId}:`, error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  })
);

/**
 * @openapi
 * /api/events/{eventId}/badges/{badgeId}:
 *   get:
 *     summary: Event badge detayı ve kullanıcı ilerlemesi
 *     description: Belirli bir event badge'inin detaylarını ve kullanıcının o badge'deki ilerlemesini getirir.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID (ULID)
 *       - in: path
 *         name: badgeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Badge ID (ULID)
 *     responses:
 *       200:
 *         description: Badge detayı başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: Badge ID
 *                 title:
 *                   type: string
 *                   description: Badge ismi
 *                 description:
 *                   type: string
 *                   description: Badge açıklaması
 *                 imageUrl:
 *                   type: string
 *                   nullable: true
 *                   description: Badge görseli URL
 *                 rarity:
 *                   type: string
 *                   enum: [COMMON, RARE, EPIC]
 *                   description: Badge nadir değeri
 *                 userProgress:
 *                   type: object
 *                   properties:
 *                     current:
 *                       type: integer
 *                       description: Kullanıcının mevcut ilerleme değeri
 *                     target:
 *                       type: integer
 *                       description: Hedef değer
 *                     isCompleted:
 *                       type: boolean
 *                       description: Badge tamamlandı mı
 *                     completedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       description: Tamamlanma tarihi (ISO 8601)
 *                     progressPercentage:
 *                       type: number
 *                       description: İlerleme yüzdesi (0-100)
 *                 category:
 *                   type: string
 *                   description: Badge kategorisi
 *                 eventId:
 *                   type: string
 *                   description: İlişkili event ID
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   description: Badge oluşturulma tarihi
 *       400:
 *         description: Geçersiz eventId veya badgeId formatı
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event veya badge bulunamadı
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:eventId/badges/:badgeId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or missing authentication token',
        statusCode: 401
      });
    }

    const { eventId, badgeId } = req.params;

    // Validate IDs
    if (!eventId || !badgeId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid eventId or badgeId format',
        statusCode: 400
      });
    }

    try {
      const badgeDetail = await eventService.getEventBadgeDetail(eventId, badgeId, String(userId));
      return res.json(badgeDetail);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      
      if (errorMessageIncludes(error, 'Badge not found')) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Badge not found',
          statusCode: 404
        });
      }
      
      if (errorMessageIncludes(error, 'Event not found')) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Event not found',
          statusCode: 404
        });
      }
      
      if (errorMessageIncludes(error, 'does not belong to this event')) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Badge does not belong to this event',
          statusCode: 404
        });
      }
      
      logger.error(`Error getting event badge detail ${badgeId} for event ${eventId}:`, error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        statusCode: 500
      });
    }
  })
);

/**
 * @openapi
 * /api/events/search:
 *   get:
 *     summary: Event'lerde arama yap
 *     description: Community Events ve Achievement Ladder'da event araması yapar. Event başlığı ve açıklamasında arama yapar.
 *     tags: [Events]
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
 *           enum: [community, achievement]
 *           default: community
 *         description: Event tipi (community veya achievement)
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
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       image:
 *                         type: string
 *                       startDate:
 *                         type: string
 *                         format: date-time
 *                       endDate:
 *                         type: string
 *                         format: date-time
 *                       eventType:
 *                         type: string
 *                         enum: [SURVEY, POLL, CONTEST, CHALLENGE, PROMOTION]
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
    const type = (req.query.type as 'community' | 'achievement') || 'community';
    const cursor = req.query.cursor as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Query parameter (q) is required' });
    }

    if (limit < 1 || limit > 50) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
    }

    if (type !== 'community' && type !== 'achievement') {
      return res.status(400).json({ success: false, message: 'Type must be either "community" or "achievement"' });
    }

    const result = await eventService.searchEvents(q.trim(), { type, cursor, limit });
    return res.json(result);
  })
);

export default router;


