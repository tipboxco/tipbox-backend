import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { validateQuery } from '../../infrastructure/middleware/validation.middleware';
import { NotificationService } from '../../application/notification/notification.service';
import { CollectionsService } from '../../application/collections/collections.service';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import {
  CollectionsListQuerySchema,
  CollectionDetailQuerySchema,
  UserCollectionProgressQuerySchema,
  CompletedCollectionsQuerySchema,
} from './collections.schemas';
import type {
  CollectionsListQuery,
  CollectionDetailQuery,
  UserCollectionProgressQuery,
  CompletedCollectionsQuery,
} from './collections.schemas';

const router = Router();
const notificationService = new NotificationService();
const collectionsService = new CollectionsService();

router.use(authMiddleware);

/* ========== EP-01: Collections List ========== */

/**
 * @openapi
 * /api/events/collections:
 *   get:
 *     summary: Collection listesini getir
 *     description: |
 *       Collections tab'ında gösterilen collection listesini getirir.
 *       Arama, kategori chip filtresi ve bottom sheet filtreleri destekler.
 *       Cursor tabanlı pagination ile infinite scroll desteği sağlar.
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Collection title veya description'da arama (500ms debounce önerilir)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: "Chip filter kategorisi (örn. electronics, cosmetics). all veya bos = tum kategoriler"
 *       - in: query
 *         name: mainCategoryId
 *         schema:
 *           type: string
 *         description: Bottom sheet ana kategori filtresi (Medusa category ID)
 *       - in: query
 *         name: subCategoryId
 *         schema:
 *           type: string
 *         description: Bottom sheet alt kategori filtresi (Medusa category ID)
 *       - in: query
 *         name: productGroupId
 *         schema:
 *           type: string
 *         description: Bottom sheet ürün grubu filtresi (Medusa category ID) - ileride eklenecek
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, completed, in_progress, not_started]
 *           default: all
 *         description: "Collection durum filtresi. completed = kullanıcının tamamladığı collection'lar"
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor (infinite scroll için)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 50
 *         description: Sayfa başına item sayısı
 *     responses:
 *       200:
 *         description: Collection listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 collections:
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
 *                       currentProgress:
 *                         type: integer
 *                         description: Kullanıcının bu collection'daki mevcut ilerlemesi
 *                       totalProgress:
 *                         type: integer
 *                         description: Collection'ın toplam ilerleme hedefi
 *                       totalBadges:
 *                         type: integer
 *                         description: Collection'daki toplam badge sayısı
 *                       earnedBadges:
 *                         type: integer
 *                         description: Kullanıcının kazandığı badge sayısı
 *                       coverImage:
 *                         type: string
 *                         nullable: true
 *                         description: Collection kapak görseli URL'i
 *                       category:
 *                         type: string
 *                         nullable: true
 *                         description: Chip filter kategorisi handle'ı
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     cursor:
 *                       type: string
 *                       nullable: true
 *                       description: Sonraki sayfa cursor'ı (null = son sayfa)
 *                     hasMore:
 *                       type: boolean
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                       description: Toplam collection sayısı (filtreler dahil)
 *       401:
 *         description: Kimlik doğrulaması başarısız
 */
router.get(
  '/',
  validateQuery(CollectionsListQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const query = req.query as unknown as CollectionsListQuery;

    const result = await collectionsService.listCollections(String(userId), {
      search: query.search,
      category: query.category,
      mainCategoryId: query.mainCategoryId,
      subCategoryId: query.subCategoryId,
      productGroupId: query.productGroupId,
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });

    return res.json(result);
  }),
);

/* ========== EP-02: Collection Categories ========== */

/**
 * @openapi
 * /api/events/collections/categories:
 *   get:
 *     summary: Collection chip filtre kategorilerini getir
 *     description: |
 *       CollectionsTab üstündeki yatay kaydırılabilir chip filtrelerin kategorilerini getirir.
 *       Sadece en az bir collection'a sahip kategoriler döner.
 *       Frontend 24 saat cache'liyor.
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kategori listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 categories:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                         description: UI'da gösterilecek isim
 *                       handle:
 *                         type: string
 *                         description: EP-01'de "category" query param olarak gönderilecek değer
 *       401:
 *         description: Kimlik doğrulaması başarısız
 */
router.get(
  '/categories',
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await collectionsService.getCollectionCategories();
    return res.json(result);
  }),
);

/* ========== EP-05: User's Collection Progress (Profile) ========== */

/**
 * @openapi
 * /api/collections/user-progress:
 *   get:
 *     summary: Kullanıcının ilerleme kaydettiği collection'ları getir
 *     description: |
 *       Belirtilen kullanıcının (veya giriş yapan kullanıcının) herhangi bir ilerleme kaydettiği
 *       collection listesini getirir. Hiç ilerleme olmayan collection'lar listelenmez.
 *       Profil sayfasında "Koleksiyonlar" bölümünde kullanılır.
 *       Hem in_progress hem completed collection'ları içerir.
 *       Cursor tabanlı pagination ile infinite scroll desteği sağlar.
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Hedef kullanıcı ID. Verilmezse giriş yapan kullanıcının collection'ları döner.
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor (infinite scroll için)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 50
 *         description: Sayfa başına item sayısı
 *     responses:
 *       200:
 *         description: İlerleme kaydedilmiş collection listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 collections:
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
 *                       currentProgress:
 *                         type: integer
 *                         description: Kullanıcının mevcut ilerlemesi
 *                       totalProgress:
 *                         type: integer
 *                         description: Toplam ilerleme hedefi
 *                       coverImage:
 *                         type: string
 *                         nullable: true
 *                       category:
 *                         type: string
 *                         nullable: true
 *                       status:
 *                         type: string
 *                         enum: [in_progress, completed]
 *                         description: Collection durumu
 *                       totalBadges:
 *                         type: integer
 *                         description: Collection'daki toplam badge sayısı
 *                       earnedBadges:
 *                         type: integer
 *                         description: Kullanıcının kazandığı badge sayısı
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     cursor:
 *                       type: string
 *                       nullable: true
 *                     hasMore:
 *                       type: boolean
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                       description: Toplam ilerleme kaydedilmiş collection sayısı
 *       401:
 *         description: Kimlik doğrulaması başarısız
 */
router.get(
  '/user-progress',
  validateQuery(UserCollectionProgressQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const currentUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const query = req.query as unknown as UserCollectionProgressQuery;
    const targetUserId = query.userId || String(currentUserId);

    const result = await collectionsService.getUserCollectionProgress(targetUserId, {
      cursor: query.cursor,
      limit: query.limit,
    });

    return res.json(result);
  }),
);

/* ========== EP-04: User's Completed Collections ========== */

/**
 * @openapi
 * /api/collections/completed:
 *   get:
 *     summary: Kullanıcının tamamladığı collection'ları getir
 *     description: |
 *       Belirtilen kullanıcının (veya giriş yapan kullanıcının) tamamladığı collection listesini getirir.
 *       Profil sayfasında "Tamamlanan Koleksiyonlar" bölümünde kullanılır.
 *       Cursor tabanlı pagination ile infinite scroll desteği sağlar.
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Hedef kullanıcı ID. Verilmezse giriş yapan kullanıcının tamamladığı collection'lar döner.
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor (infinite scroll için)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 50
 *         description: Sayfa başına item sayısı
 *     responses:
 *       200:
 *         description: Tamamlanan collection listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 collections:
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
 *                       coverImage:
 *                         type: string
 *                         nullable: true
 *                       category:
 *                         type: string
 *                         nullable: true
 *                       completedAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         description: Son goal'un tamamlandığı tarih
 *                       totalBadges:
 *                         type: integer
 *                         description: Collection'daki toplam badge sayısı
 *                       earnedBadges:
 *                         type: integer
 *                         description: Kullanıcının kazandığı badge sayısı
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     cursor:
 *                       type: string
 *                       nullable: true
 *                     hasMore:
 *                       type: boolean
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                       description: Toplam tamamlanan collection sayısı
 *       401:
 *         description: Kimlik doğrulaması başarısız
 */
router.get(
  '/completed',
  validateQuery(CompletedCollectionsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const currentUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const query = req.query as unknown as CompletedCollectionsQuery;
    const targetUserId = query.userId || String(currentUserId);

    const result = await collectionsService.getCompletedCollections(targetUserId, {
      cursor: query.cursor,
      limit: query.limit,
    });

    return res.json(result);
  }),
);

/* ========== EP-03: Collection Detail + Badges ========== */

/**
 * @openapi
 * /api/events/collections/{collectionId}:
 *   get:
 *     summary: Collection detayı ve badge listesi
 *     description: |
 *       Belirli bir collection'ın detayını ve ona ait badge listesini getirir.
 *       Badge'ler içinde arama destekler.
 *       Status hesaplama:
 *       - not_started: currentProgress === 0
 *       - in_progress: currentProgress > 0 && currentProgress < totalProgress
 *       - completed: currentProgress >= totalProgress
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: collectionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Collection ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Badge title veya description'da arama (400ms debounce önerilir)
 *     responses:
 *       200:
 *         description: Collection detayı ve badge listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 collection:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     currentProgress:
 *                       type: integer
 *                     totalProgress:
 *                       type: integer
 *                     backgroundGradient:
 *                       type: object
 *                       properties:
 *                         colors:
 *                           type: array
 *                           items:
 *                             type: string
 *                         start:
 *                           type: object
 *                           properties:
 *                             x:
 *                               type: number
 *                             y:
 *                               type: number
 *                         end:
 *                           type: object
 *                           properties:
 *                             x:
 *                               type: number
 *                             y:
 *                               type: number
 *                     category:
 *                       type: string
 *                       nullable: true
 *                 badges:
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
 *                       icon:
 *                         type: string
 *                         description: Public CDN URL (badge görseli)
 *                       currentProgress:
 *                         type: integer
 *                       totalProgress:
 *                         type: integer
 *                       status:
 *                         type: string
 *                         enum: [not_started, in_progress, completed]
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       404:
 *         description: Collection bulunamadı
 */
router.get(
  '/:collectionId',
  validateQuery(CollectionDetailQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { collectionId } = req.params;
    const query = req.query as unknown as CollectionDetailQuery;

    const result = await collectionsService.getCollectionDetail(
      collectionId,
      String(userId),
      query.search,
    );

    if (!result) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    return res.json(result);
  }),
);

/* ========== Badge Reminder ========== */

/**
 * @openapi
 * /api/events/collections/badges/{badgeId}/reminder:
 *   post:
 *     summary: Badge için hatırlatma ayarla
 *     description: Belirtilen zamanda (veya varsayılan 1 gün sonra) badge görevi tamamlama hatırlatması gönderilir. Aynı badge için mevcut hatırlatma varsa güncellenir.
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: badgeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               remindAt:
 *                 type: string
 *                 format: date-time
 *                 description: Hatırlatma zamanı (ISO 8601). Yoksa varsayılan 1 gün sonra.
 *     responses:
 *       200:
 *         description: Hatırlatma ayarlandı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 remindAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Geçersiz badgeId veya remindAt
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       404:
 *         description: Badge bulunamadı
 */
router.post(
  '/badges/:badgeId/reminder',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const badgeId = req.params.badgeId;
    if (!badgeId) {
      return res.status(400).json({ success: false, message: 'badgeId is required' });
    }

    const prisma = getPrisma();
    const badge = await prisma.badge.findUnique({
      where: { id: badgeId },
      select: { id: true },
    });
    if (!badge) {
      return res.status(404).json({ success: false, message: 'Badge not found' });
    }

    let remindAt: Date;
    const remindAtRaw = req.body.remindAt;
    if (remindAtRaw && typeof remindAtRaw === 'string') {
      remindAt = new Date(remindAtRaw);
      if (Number.isNaN(remindAt.getTime())) {
        return res.status(400).json({ success: false, message: 'remindAt must be a valid ISO date string' });
      }
      if (remindAt <= new Date()) {
        return res.status(400).json({ success: false, message: 'remindAt must be in the future' });
      }
    } else {
      remindAt = new Date();
      remindAt.setDate(remindAt.getDate() + 1);
    }

    const result = await notificationService.setBadgeReminder(
      String(userId),
      badgeId,
      remindAt,
    );
    return res.json(result);
  }),
);

export default router;
