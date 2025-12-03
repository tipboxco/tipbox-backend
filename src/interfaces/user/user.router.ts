import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import {
  PROFILE_FEED_CARD_TYPES,
  ProfileFeedCardType,
  UserService,
} from '../../application/user/user.service';
import { CreateUserRequest, UpdateUserProfileRequest, UserResponse } from './user.dto';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { S3Service } from '../../infrastructure/s3/s3.service';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../infrastructure/logger/logger';
// ValidationError kullanılmıyor; mevcut mimaride router içinde direkt 400/409 dönüyoruz

const router = Router();
const userService = new UserService();
const s3Service = new S3Service();

const parseProfileFeedTypes = (value: unknown): ProfileFeedCardType[] | undefined => {
  if (!value) {
    return undefined;
  }

  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  const normalized = rawValues
    .map((item) => item.trim())
    .filter(
      (item): item is ProfileFeedCardType =>
        (PROFILE_FEED_CARD_TYPES as readonly string[]).includes(item)
    );

  if (!normalized.length) {
    return undefined;
  }

  return Array.from(new Set(normalized));
};

/**
 * @openapi
 * /users/me/profile:
 *   get:
 *     summary: Hesabın profil bilgileri (self profile)
 *     description: Giriş yapan kullanıcının detaylı profil bilgisini döner.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil bilgileri
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 name: { type: string }
 *                 avatarUrl: { type: string, nullable: true }
 *                 bannerUrl: { type: string, nullable: true }
 *                 biography: { type: string, nullable: true }
 *                 titles:
 *                   type: array
 *                   items: { type: string }
 *                 stats:
 *                   type: object
 *                   properties:
 *                     posts: { type: integer }
 *                     trust: { type: integer }
 *                     truster: { type: integer }
 *                 badges:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       title: { type: string }
 *                       image: { type: string, nullable: true }
 *                 cosmetics:
 *                   type: object
 *                   properties:
 *                     activeBadge:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         title: { type: string }
 *                         image: { type: string, nullable: true }
 *                     activeBanner:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         image: { type: string, nullable: true }
 *                 isTrusted: { type: boolean }
 *       401:
 *         description: Unauthorized
 */
router.get('/me/profile', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const profile = await userService.getSelfUserProfile(String(userId));
  if (!profile) return res.status(404).json({ message: 'User not found' });
  return res.json(profile);
}));

/**
 * @openapi
 * /users/me/profile:
 *   put:
 *     summary: Profil bilgilerini güncelle
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserProfileRequest'
 *     responses:
 *       200:
 *         description: Güncellenmiş profil
 */
router.put('/me/profile', asyncHandler(async (req: Request<{}, {}, UpdateUserProfileRequest>, res: Response) => {
  const userPayload = (req as any).user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const body = req.body || {};

  if (body.name && body.name.trim().length < 2) {
    return res.status(400).json({ message: 'İsim en az 2 karakter olmalıdır' });
  }

  if (body.biography && body.biography.length > 500) {
    return res.status(400).json({ message: 'Biyografi en fazla 500 karakter olabilir' });
  }

  if (body.badge && !Array.isArray(body.badge)) {
    return res.status(400).json({ message: 'badge alanı bir dizi olmalıdır' });
  }

  await userService.updateProfileDetails(String(userId), {
    name: body.name,
    biography: body.biography,
    banner: typeof body.banner !== 'undefined' ? body.banner : undefined,
    avatar: body.avatar ?? undefined,
    cosmeticId: typeof body.cosmetic !== 'undefined' ? body.cosmetic : undefined,
    badges: body.badge?.map(badge => ({ id: badge })) ?? undefined,
  });

  const profile = await userService.getSelfUserProfile(String(userId));
  return res.json({
    success: true,
    profile,
  });
}));

/**
 * @openapi
 * /users/{id}/profile:
 *   get:
 *     summary: Kullanıcı profili (diğer kullanıcı)
 *     description: Ziyaret edilen kullanıcının profilini ve "isTrusted" durumunu döner.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ziyaret edilen kullanıcı ID'si
 *     responses:
 *       200:
 *         description: Profil bilgileri
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 name: { type: string }
 *                 avatarUrl: { type: string, nullable: true }
 *                 bannerUrl: { type: string, nullable: true }
 *                 biography: { type: string, nullable: true }
 *                 titles:
 *                   type: array
 *                   items: { type: string }
 *                 stats:
 *                   type: object
 *                   properties:
 *                     posts: { type: integer }
 *                     trust: { type: integer }
 *                     truster: { type: integer }
 *                 badges:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       title: { type: string }
 *                       image: { type: string, nullable: true }
 *                 isTrusted: { type: boolean }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/:id/profile', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const viewerId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!viewerId) return res.status(401).json({ message: 'Unauthorized' });

  const targetUserId = req.params.id;
  if (!targetUserId) return res.status(400).json({ message: 'User id is required' });

  const profile = await userService.getUserProfileForViewer(String(viewerId), String(targetUserId));
  if (!profile) return res.status(404).json({ message: 'User not found' });
  return res.json(profile);
}));

/**
 * @openapi
 * /users/{id}/trusts:
 *   get:
 *     summary: Kullanıcının trust listesini getirir
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: İsim veya kullanıcı adına göre arama (case-insensitive)
 *     responses:
 *       200:
 *         description: Trust list
 */
router.get('/:id/trusts', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
  const list = await userService.listTrustedUsers(id, q);
  return res.json(list);
}));

/**
 * @openapi
 * /users/{id}/trusters:
 *   get:
 *     summary: Kullanıcının truster listesini getirir
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: İsim veya kullanıcı adına göre arama (case-insensitive)
 *     responses:
 *       200:
 *         description: Truster listesi
 */
router.get('/:id/trusters', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
  const list = await userService.listTrusters(id, q);
  return res.json(list);
}));

/**
 * @openapi
 * /users/{id}/trusts/{targetUserId}:
 *   delete:
 *     summary: Trust listesinden kullanıcı kaldır
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: targetUserId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Kaldırıldı
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id/trusts/:targetUserId', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const authUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!authUserId) return res.status(401).json({ message: 'Unauthorized' });
  const id = String(req.params.id);
  if (authUserId !== id) return res.status(401).json({ message: 'Unauthorized' });
  const targetUserId = String(req.params.targetUserId);
  const ok = await userService.removeTrust(id, targetUserId);
  if (!ok) return res.status(404).json({ message: 'Kayıt bulunamadı' });
  return res.status(204).end();
}));

/**
 * @openapi
 * /users/{id}/trust:
 *   post:
 *     summary: Trust ekle
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ targetUserId ]
 *             properties:
 *               targetUserId: { type: string }
 *     responses:
 *       201:
 *         description: Eklendi
 *       401:
 *         description: Unauthorized
 */
router.post('/:id/trust', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const authUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!authUserId) return res.status(401).json({ message: 'Unauthorized' });
  const id = String(req.params.id);
  if (authUserId !== id) return res.status(401).json({ message: 'Unauthorized' });
  const { targetUserId } = req.body || {};
  if (!targetUserId || typeof targetUserId !== 'string') return res.status(400).json({ message: 'targetUserId is required' });
  await userService.addTrust(id, targetUserId);
  return res.status(201).end();
}));

/**
 * @openapi
 * /users/{id}/block:
 *   post:
 *     summary: Kullanıcıyı engelle
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ targetUserId ]
 *             properties:
 *               targetUserId: { type: string }
 */
router.post('/:id/block', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const authUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!authUserId) return res.status(401).json({ message: 'Unauthorized' });
  const id = String(req.params.id);
  if (authUserId !== id) return res.status(401).json({ message: 'Unauthorized' });
  const { targetUserId } = req.body || {};
  if (!targetUserId || typeof targetUserId !== 'string') return res.status(400).json({ message: 'targetUserId is required' });
  await userService.blockUser(id, targetUserId);
  return res.status(201).end();
}));

/**
 * @openapi
 * /users/{id}/unblock:
 *   post:
 *     summary: Kullanıcı blok kaldır
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ targetUserId ]
 *             properties:
 *               targetUserId: { type: string }
 *     responses:
 *       204:
 *         description: Blok kaldırıldı
 */
router.post('/:id/unblock', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const authUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!authUserId) return res.status(401).json({ message: 'Unauthorized' });
  const id = String(req.params.id);
  if (authUserId !== id) return res.status(401).json({ message: 'Unauthorized' });
  const { targetUserId } = req.body || {};
  if (!targetUserId || typeof targetUserId !== 'string') return res.status(400).json({ message: 'targetUserId is required' });
  const ok = await userService.unblockUser(id, targetUserId);
  return res.status(ok ? 204 : 404).end();
}));

/**
 * @openapi
 * /users/{id}/mute:
 *   post:
 *     summary: Kullanıcıyı sustur
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ targetUserId ]
 *             properties:
 *               targetUserId: { type: string }
 *     responses:
 *       201:
 *         description: Susturma ayarlandı
 */
router.post('/:id/mute', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const authUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!authUserId) return res.status(401).json({ message: 'Unauthorized' });
  const id = String(req.params.id);
  if (authUserId !== id) return res.status(401).json({ message: 'Unauthorized' });
  const { targetUserId } = req.body || {};
  if (!targetUserId || typeof targetUserId !== 'string') return res.status(400).json({ message: 'targetUserId is required' });
  await userService.muteUser(id, targetUserId);
  return res.status(201).end();
}));

/**
 * @openapi
 * /users/{id}/unmute:
 *   post:
 *     summary: Susturma kaldır
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ targetUserId ]
 *             properties:
 *               targetUserId: { type: string }
 *     responses:
 *       204:
 *         description: Susturma kaldırıldı
 */
router.post('/:id/unmute', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const authUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!authUserId) return res.status(401).json({ message: 'Unauthorized' });
  const id = String(req.params.id);
  if (authUserId !== id) return res.status(401).json({ message: 'Unauthorized' });
  const { targetUserId } = req.body || {};
  if (!targetUserId || typeof targetUserId !== 'string') return res.status(400).json({ message: 'targetUserId is required' });
  const ok = await userService.unmuteUser(id, targetUserId);
  return res.status(ok ? 204 : 404).end();
}));

/**
 * @openapi
 * /users/{id}/collections/bridges:
 *   get:
 *     summary: Bridge badge koleksiyonu
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: İsim veya kullanıcı adına göre arama (case-insensitive)
 *     responses:
 *       200:
 *         description: Kullanıcının bridge koleksiyon rozetleri
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                   image:
 *                     type: string
 *                     nullable: true
 *                     example: "http://localhost:9000/tipbox-media/badges/480f5de9-b691-4d70-a6a8-2789226f4e07/bridge-ambassador.png"
 *                   title:
 *                     type: string
 *                     example: "Bridge Ambassador"
 *                   rarity:
 *                     type: string
 *                     enum: [Usual, Rare, Epic, Legendary]
 *                     example: "Rare"
 *                   isClaimed:
 *                     type: boolean
 *                     example: true
 *                   nftAddress:
 *                     type: string
 *                     nullable: true
 *                     example: null
 *                   totalEarned:
 *                     type: integer
 *                     example: 3
 *                   earnedDate:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                     example: "2024-02-10T10:30:00.000Z"
 *                   tasks:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: "goal-123"
 *                         title:
 *                           type: string
 *                           example: "10 Yorum Yap"
 *                         type:
 *                           type: string
 *                           enum: [Comment, Like, Share]
 *                           example: "Comment"
 */
router.get('/:id/collections/bridges', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    return res.status(400).json({ message: 'Invalid user id format' });
  }
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
  const keyword = q || search || undefined;
  const list = await userService.listBridgeBadges(id, keyword);
  return res.json(list);
}));

/**
 * @openapi
 * /collections/achievements/{badgeId}/claim:
 *   post:
 *     summary: Achievement badge claim et
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.post('/collections/achievements/:badgeId/claim', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const badgeId = String(req.params.badgeId);
  const result = await userService.claimAchievementBadge(String(userId), badgeId);
  return res.status(result.success ? 201 : 400).json(result);
}));

router.post('/collections/bridges/:badgeId/claim', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  const badgeId = String(req.params.badgeId);
  const result = await userService.claimBridgeBadge(String(userId), badgeId);
  return res.status(result.success ? 201 : 400).json(result);
}));
// Multer configuration - memory storage (dosya buffer'da tutulacak)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    // Sadece resim dosyalarına izin ver
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    if (file.mimetype && allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece resim dosyaları yüklenebilir (JPG, PNG, GIF, WebP)'));
    }
  },
});

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Yeni kullanıcı oluştur
 *     description: Email ve display name ile yeni kullanıcı oluşturur (admin işlemi)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - displayName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: yeni.kullanici@tipbox.com
 *                 description: Kullanıcının email adresi (benzersiz olmalı)
 *               displayName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: Yeni Kullanıcı
 *                 description: Kullanıcının görünen adı
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *                 example: Merhaba! Ben yeni bir kullanıcıyım ve Tipbox'ı keşfediyorum.
 *                 description: Kullanıcının kısa biyografisi (opsiyonel)
 *     responses:
 *       201:
 *         description: Kullanıcı başarıyla oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "a2y7c1m4xk9q0v3b5n8d6p1r0s"
 *                   description: Oluşturulan kullanıcının benzersiz ID'si
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: yeni.kullanici@tipbox.com
 *                   description: Kullanıcının email adresi
 *                 name:
 *                   type: string
 *                   example: Yeni Kullanıcı
 *                   description: Kullanıcının tam adı
 *                 status:
 *                   type: string
 *                   example: ACTIVE
 *                   description: Kullanıcının hesap durumu
 *                 auth0Id:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *                   description: Auth0 kullanıcı ID'si
 *                 walletAddress:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *                   description: Kullanıcının cüzdan adresi
 *                 kycStatus:
 *                   type: string
 *                   example: PENDING
 *                   description: KYC doğrulama durumu
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T14:30:00.000Z"
 *                   description: Hesap oluşturulma tarihi
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T14:30:00.000Z"
 *                   description: Son güncelleme tarihi
 *       400:
 *         description: Geçersiz istek formatı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Email ve displayName alanları zorunludur
 *       409:
 *         description: Email zaten kayıtlı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Bu email adresi zaten kayıtlı
 *       401:
 *         description: Yetkisiz erişim
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Geçersiz token
 *       500:
 *         description: Sunucu hatası
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Kullanıcı oluşturulurken bir hata oluştu
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  let { email, displayName, bio } = req.body as CreateUserRequest;
  // Normalize leading/trailing whitespace on string inputs
  if (typeof email === 'string') email = email.trim();
  if (typeof displayName === 'string') displayName = displayName.trim();
  if (typeof bio === 'string') bio = bio.trim();
  
  // Validation: Email zorunlu ve kontrolü (undefined/null kontrolü önce)
  if (email === undefined || email === null) {
    return res.status(400).json({ error: { message: 'Email adresi zorunludur ve boş olamaz.' } });
  }
  
  if (typeof email !== 'string') {
    return res.status(400).json({ error: { message: 'Email adresi string olmalıdır.' } });
  }
  
  if (email === '') {
    return res.status(400).json({ error: { message: 'Email adresi zorunludur ve boş olamaz.' } });
  }
  
  // Email format kontrolü
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: { message: 'Geçerli bir email adresi giriniz.' } });
  }
  
  // Validation: DisplayName zorunlu ve kontrolü
  if (displayName === undefined || displayName === null) {
    return res.status(400).json({ error: { message: 'DisplayName zorunludur ve boş olamaz.' } });
  }
  
  if (typeof displayName !== 'string') {
    return res.status(400).json({ error: { message: 'DisplayName string olmalıdır.' } });
  }
  
  if (displayName === '') {
    return res.status(400).json({ error: { message: 'DisplayName zorunludur ve boş olamaz.' } });
  }
  
  // DisplayName minLength kontrolü (OpenAPI: minLength: 2)
  if (displayName.length < 2) {
    return res.status(400).json({ error: { message: 'DisplayName en az 2 karakter olmalıdır.' } });
  }
  
  // DisplayName maxLength kontrolü (OpenAPI: maxLength: 50)
  if (displayName.length > 50) {
    return res.status(400).json({ error: { message: 'DisplayName en fazla 50 karakter olabilir.' } });
  }
  
  // Bio maxLength kontrolü (OpenAPI: maxLength: 500)
  if (bio !== undefined && bio !== null && typeof bio === 'string' && bio.length > 500) {
    return res.status(400).json({ error: { message: 'Bio en fazla 500 karakter olabilir.' } });
  }
  
  // Tüm validation'lar geçildi, şimdi user oluştur
  try {
    const user = await userService.createUser(email, displayName);
    const response: UserResponse = {
      id: user.id,
      email: user.email ?? email,
      name: user.name ?? displayName,
      status: user.status || 'ACTIVE',
      auth0Id: user.auth0Id || null,
      walletAddress: user.walletAddress || null,
      kycStatus: user.kycStatus || '',
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
    return res.status(201).json(response);
  } catch (error: any) {
    if (error?.code === 'P2002' && error?.meta?.target?.includes('email')) {
      return res.status(409).json({ error: { message: 'Bu email adresi zaten kullanılıyor.' } });
    }
    throw error;
  }
}));

/**
 * @openapi
 * /users/setup-profile:
 *   post:
 *     summary: Kullanıcı profilini tamamlar (Set Up Profile)
 *     description: Email doğrulaması sonrası kullanıcı profilini tamamlar. FullName, UserName, Avatar, Banner ve ilgi alanlarını kaydeder.
 *     operationId: setupUserProfile
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - FullName
 *               - UserName
 *               - selectCategories
 *             properties:
 *               FullName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: Ömer Faruk
 *                 description: Kullanıcının tam adı
 *               UserName:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 30
 *                 pattern: '^[a-zA-Z0-9_]+$'
 *                 example: omerfaruk
 *                 description: Kullanıcının benzersiz kullanıcı adı
 *               Avatar:
 *                 type: string
 *                 format: binary
 *                 description: Profil fotoğrafı (opsiyonel, max 5MB)
 *               Banner:
 *                 type: string
 *                 format: binary
 *                 description: Profil banner görseli (opsiyonel, max 5MB)
 *               selectCategories:
 *                 type: string
 *                 example: '{"userId":"1","selectedCategories":[{"categoryId":"1","subCategoryIds":["1","2"]}]}'
 *                 description: JSON string formatında ilgi alanları
 *     responses:
 *       200:
 *         description: Profil başarıyla tamamlandı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Profil başarıyla tamamlandı
 *                 user:
 *                   $ref: '#/components/schemas/UserResponse'
 *       400:
 *         description: Geçersiz istek formatı veya eksik alanlar
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: FullName, UserName ve selectCategories alanları zorunludur
 *       401:
 *         description: Yetkisiz erişim veya email doğrulanmamış
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Email doğrulanmamış
 *       409:
 *         description: Kullanıcı adı zaten kullanılıyor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Bu kullanıcı adı zaten kullanılıyor
 *       500:
 *         description: Sunucu hatası
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Profil tamamlanırken bir hata oluştu
 */
router.post('/setup-profile', upload.fields([{ name: 'Avatar', maxCount: 1 }, { name: 'Banner', maxCount: 1 }]), asyncHandler(async (req: Request & { files?: { [fieldname: string]: Express.Multer.File[] } }, res: Response) => {
  const userPayload = (req as any).user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Yetkisiz erişim',
    });
  }

  // ID artık string (UUID/ULID)
  const userIdStr = String(userId);

  const { FullName, UserName, selectCategories } = req.body;

  // Validasyon
  if (!FullName || !UserName || !selectCategories) {
    return res.status(400).json({
      success: false,
      message: 'FullName, UserName ve selectCategories alanları zorunludur',
    });
  }

  // selectCategories JSON parse
  let categoriesData;
  try {
    categoriesData = typeof selectCategories === 'string' 
      ? JSON.parse(selectCategories) 
      : selectCategories;
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'selectCategories geçerli bir JSON formatında olmalıdır',
    });
  }

  // Helper function: Dosya yükleme
  const uploadImageFile = async (file: Express.Multer.File, folder: string, fileType: string): Promise<string> => {
    // File extension'ı güvenli şekilde al (dosya adından veya MIME type'dan)
    let fileExtension = 'jpg'; // Default extension
    
    // Önce dosya adından extension al
    if (file.originalname && file.originalname.includes('.')) {
      const parts = file.originalname.split('.');
      if (parts.length > 1) {
        fileExtension = parts[parts.length - 1].toLowerCase();
      }
    }
    
    // MIME type'dan extension mapping (güvenlik için)
    const mimeToExtension: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
    };
    
    // MIME type varsa onu kullan (daha güvenilir)
    if (file.mimetype && mimeToExtension[file.mimetype]) {
      fileExtension = mimeToExtension[file.mimetype];
    }
    
    // Extension'ı validate et (sadece izin verilen formatlar)
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!allowedExtensions.includes(fileExtension)) {
      throw new Error('Desteklenmeyen dosya formatı. Sadece JPG, PNG, GIF ve WebP formatları desteklenmektedir.');
    }
    
    // Dosya adını oluştur
    const fileName = `${folder}/${userIdStr}/${uuidv4()}.${fileExtension}`;
    
    // Dosyayı yükle
    const fileUrl = await s3Service.uploadFile(fileName, file.buffer, file.mimetype);
    
    logger.info({
      message: `${fileType} başarıyla yüklendi`,
      userId: userIdStr,
      fileName,
      fileSize: file.size,
      mimeType: file.mimetype,
    });
    
    return fileUrl;
  };

  // Avatar yükleme
  let avatar: string | undefined;
  const avatarFile = req.files?.['Avatar']?.[0];
  if (avatarFile) {
    try {
      avatar = await uploadImageFile(avatarFile, 'profile-pictures', 'Avatar');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      logger.error({
        message: 'Avatar yükleme hatası',
        error: errorMessage,
        userId: userIdStr,
        fileName: avatarFile.originalname,
        fileSize: avatarFile.size,
        mimeType: avatarFile.mimetype,
      });
      
      return res.status(500).json({
        success: false,
        message: `Avatar yüklenirken bir hata oluştu: ${errorMessage}`,
      });
    }
  }

  // Banner yükleme
  let bannerUrl: string | undefined;
  const bannerFile = req.files?.['Banner']?.[0];
  if (bannerFile) {
    try {
      bannerUrl = await uploadImageFile(bannerFile, 'profile-banners', 'Banner');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      logger.error({
        message: 'Banner yükleme hatası',
        error: errorMessage,
        userId: userIdStr,
        fileName: bannerFile.originalname,
        fileSize: bannerFile.size,
        mimeType: bannerFile.mimetype,
      });
      
      return res.status(500).json({
        success: false,
        message: `Banner yüklenirken bir hata oluştu: ${errorMessage}`,
      });
    }
  }

  // Profil setup
  try {
    const user = await userService.setupProfile(userIdStr, {
      fullName: FullName,
      userName: UserName,
      avatar: avatar,
      bannerUrl,
      selectedCategories: categoriesData.selectedCategories || [],
    });

    const response: UserResponse = {
      id: user.id,
      email: user.email ?? '',
      name: user.name ?? '',
      status: user.status || 'ACTIVE',
      auth0Id: user.auth0Id || null,
      walletAddress: user.walletAddress || null,
      kycStatus: user.kycStatus || '',
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    res.status(200).json({
      success: true,
      message: 'Profil başarıyla tamamlandı',
      user: response,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
    
    if (errorMessage.includes('zaten kullanılıyor')) {
      return res.status(409).json({
        success: false,
        message: errorMessage,
      });
    }
    
    if (errorMessage.includes('Email doğrulanmamış')) {
      return res.status(401).json({
        success: false,
        message: errorMessage,
      });
    }

    res.status(500).json({
      success: false,
      message: `Profil tamamlanırken bir hata oluştu: ${errorMessage}`,
    });
  }
}));

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Kullanıcıyı ID ile getir
 *     description: Belirtilen ID'ye sahip kullanıcının detaylı bilgilerini döner
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Kullanıcının benzersiz ID'si
 *         example: 1
 *     responses:
 *       200:
 *         description: Kullanıcı başarıyla bulundu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                   description: Kullanıcının benzersiz ID'si
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: omer@tipbox.co
 *                   description: Kullanıcının email adresi
 *                 name:
 *                   type: string
 *                   example: Ömer Faruk
 *                   description: Kullanıcının tam adı
 *                 status:
 *                   type: string
 *                   example: ACTIVE
 *                   description: Kullanıcının hesap durumu
 *                 auth0Id:
 *                   type: string
 *                   nullable: true
 *                   example: auth0|60f7b3b3b3b3b3b3b3b3b3b3
 *                   description: Auth0 kullanıcı ID'si
 *                 walletAddress:
 *                   type: string
 *                   nullable: true
 *                   example: 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6
 *                   description: Kullanıcının cüzdan adresi
 *                 kycStatus:
 *                   type: string
 *                   example: VERIFIED
 *                   description: KYC doğrulama durumu
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"
 *                   description: Hesap oluşturulma tarihi
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"
 *                   description: Son güncelleme tarihi
 *       404:
 *         description: Kullanıcı bulunamadı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Kullanıcı bulunamadı
 *       401:
 *         description: Yetkisiz erişim
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Geçersiz token
 *       500:
 *         description: Sunucu hatası
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Kullanıcı bilgileri alınırken bir hata oluştu
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  const user = await userService.getUserById(id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const response: UserResponse = {
    id: user.id,
    email: user.email ?? '',
    name: user.name ?? '',
    status: user.status || 'ACTIVE',
    auth0Id: user.auth0Id || null,
    walletAddress: user.walletAddress || null,
    kycStatus: user.kycStatus || '',
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
  res.json(response);
}));


/**
 * @openapi
 * /users/{id}/profile-card:
 *   get:
 *     summary: Kullanıcının profil kartını getir
 *     description: Profil kartı için isim, avatar, banner, açıklama, unvanlar, istatistikler ve rozetleri döner
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Kullanıcı ID (UUID/ULID)
 *         example: "b6d8c1f2-4a9b-4d1c-9e2a-123456789abc"
 *     responses:
 *       200:
 *         description: Profil kartı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "b6d8c1f2-4a9b-4d1c-9e2a-123456789abc"
 *                 name:
 *                   type: string
 *                   example: "Ömer Faruk"
 *                 avatarUrl:
 *                   type: string
 *                   nullable: true
 *                   example: "https://cdn.tipbox.co/profile-pictures/omer.jpg"
 *                 bannerUrl:
 *                   type: string
 *                   nullable: true
 *                   example: "https://cdn.tipbox.co/profile-banners/omer-banner.jpg"
 *                 description:
 *                   type: string
 *                   nullable: true
 *                   example: "Teknoloji meraklısı. Donanım ve yazılım üzerine yazıyorum."
 *                 titles:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["Technology Enthusiast", "Digital Surfer", "Hardware Expert"]
 *                 stats:
 *                   type: object
 *                   properties:
 *                     posts:
 *                       type: integer
 *                       example: 42
 *                     trust:
 *                       type: integer
 *                       example: 15
 *                     truster:
 *                       type: integer
 *                       example: 28
 *                 badges:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       imageUrl:
 *                         type: string
 *                         nullable: true
 *                         example: "https://cdn.tipbox.co/badges/rare-builder.png"
 *                       title:
 *                         type: string
 *                         example: "Rare Builder"
 *       404:
 *         description: Kullanıcı bulunamadı
 */
router.get('/:id/profile-card', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const card = await userService.getUserProfileCard(id);
  if (!card) {
    return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
  }
  res.json(card);
}));




/**
 * @openapi
 * /users/{id}/trusts/{targetUserId}:
 *   delete:
 *     summary: Trust listesinden kaldır
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: targetUserId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Başarılı }
 *       404: { description: Kayıt bulunamadı }
 */
router.delete('/:id/trusts/:targetUserId', asyncHandler(async (req: Request, res: Response) => {
  const { id, targetUserId } = req.params;
  const ok = await userService.removeTrust(id, targetUserId);
  if (!ok) return res.status(404).json({ message: 'Kayıt bulunamadı' });
  res.status(204).send();
}));

/**
 * @openapi
 * /users/{id}/block/{targetUserId}:
 *   post:
 *     summary: Bir kullanıcıyı engelle (block)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Kullanıcı ID (engelleyen)
 *       - in: path
 *         name: targetUserId
 *         required: true
 *         schema: { type: string }
 *         description: Engellenecek kullanıcı ID
 *     responses:
 *       204:
 *         description: Kullanıcı başarıyla engellendi
 *       400:
 *         description: Geçersiz istek
 */
router.post('/:id/block/:targetUserId', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const authUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!authUserId) return res.status(401).json({ message: 'Unauthorized' });
  const id = String(req.params.id);
  if (authUserId !== id) return res.status(401).json({ message: 'Unauthorized' });
  const targetUserId = String(req.params.targetUserId);
  await userService.blockUser(id, targetUserId);
  res.status(204).send();
}));

/**
 * @openapi
 * /users/{id}/block/{targetUserId}:
 *   delete:
 *     summary: Bir kullanıcının engelini kaldır (unblock)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Kullanıcı ID (engeli kaldıran)
 *       - in: path
 *         name: targetUserId
 *         required: true
 *         schema: { type: string }
 *         description: Engeli kaldırılacak kullanıcı ID
 *     responses:
 *       204:
 *         description: Engel başarıyla kaldırıldı
 *       404:
 *         description: Engelleme kaydı bulunamadı
 */
router.delete('/:id/block/:targetUserId', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const authUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!authUserId) return res.status(401).json({ message: 'Unauthorized' });
  const id = String(req.params.id);
  if (authUserId !== id) return res.status(401).json({ message: 'Unauthorized' });
  const targetUserId = String(req.params.targetUserId);
  const ok = await userService.unblockUser(id, targetUserId);
  if (!ok) return res.status(404).json({ message: 'Engelleme kaydı bulunamadı' });
  res.status(204).send();
}));

/**
 * @openapi
 * /users/{id}/mute/{targetUserId}:
 *   post:
 *     summary: Bir kullanıcıyı sustur (mute)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Kullanıcı ID (susturan)
 *       - in: path
 *         name: targetUserId
 *         required: true
 *         schema: { type: string }
 *         description: Susturulacak kullanıcı ID
 *     responses:
 *       204:
 *         description: Kullanıcı başarıyla susturuldu
 *       400:
 *         description: Geçersiz istek
 */
router.post('/:id/mute/:targetUserId', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const authUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!authUserId) return res.status(401).json({ message: 'Unauthorized' });
  const id = String(req.params.id);
  if (authUserId !== id) return res.status(401).json({ message: 'Unauthorized' });
  const targetUserId = String(req.params.targetUserId);
  await userService.muteUser(id, targetUserId);
  res.status(204).send();
}));

/**
 * @openapi
 * /users/{id}/mute/{targetUserId}:
 *   delete:
 *     summary: Bir kullanıcının susturulmasını kaldır (unmute)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Kullanıcı ID (susturmayı kaldıran)
 *       - in: path
 *         name: targetUserId
 *         required: true
 *         schema: { type: string }
 *         description: Susturulması kaldırılacak kullanıcı ID
 *     responses:
 *       204:
 *         description: Susturma başarıyla kaldırıldı
 *       404:
 *         description: Susturma kaydı bulunamadı
 */
router.delete('/:id/mute/:targetUserId', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const authUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!authUserId) return res.status(401).json({ message: 'Unauthorized' });
  const id = String(req.params.id);
  if (authUserId !== id) return res.status(401).json({ message: 'Unauthorized' });
  const targetUserId = String(req.params.targetUserId);
  const ok = await userService.unmuteUser(id, targetUserId);
  if (!ok) return res.status(404).json({ message: 'Susturma kaydı bulunamadı' });
  res.status(204).send();
}));

/**
 * @openapi
 * /users/{id}/collections/achievements:
 *   get:
 *     summary: Kullanıcının Achievement Badge koleksiyonunu listele
 *     description: Kullanıcının kazandığı achievement badge'leri döner. Arama parametresi ile filtreleme yapılabilir.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Kullanıcı ID
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Badge adı veya açıklamasına göre arama (case-insensitive)
 *     responses:
 *       200:
 *         description: Achievement Badge listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                   image:
 *                     type: string
 *                     nullable: true
 *                     example: "https://cdn.tipbox.co/badges/builder.png"
 *                   title:
 *                     type: string
 *                     example: "Builder Badge"
 *                   rarity:
 *                     type: string
 *                     enum: [Usual, Rare, Epic, Legendary]
 *                     example: "Rare"
 *                   isClaimed:
 *                     type: boolean
 *                     example: true
 *                   nftAddress:
 *                     type: string
 *                     nullable: true
 *                     example: null
 *                   totalEarned:
 *                     type: integer
 *                     example: 1
 *                   earnedDate:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                     example: "2024-01-15T10:30:00.000Z"
 *                   tasks:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: "goal-123"
 *                         title:
 *                           type: string
 *                           example: "10 Yorum Yap"
 *                         type:
 *                           type: string
 *                           enum: [Comment, Like, Share]
 *                           example: "Comment"
 */
router.get('/:id/collections/achievements', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    return res.status(400).json({ message: 'Invalid user id format' });
  }
  const querySearch = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
  const queryQ = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
  const badges = await userService.listAchievementBadges(id, queryQ || querySearch || undefined);
  res.json(badges);
}));

/**
 * @openapi
 * /users/{id}/achievements:
 *   get:
 *     summary: Achievement sekmesindeki badge listesini getir
 *     description: Kullanıcının achievement badge'lerini progress ve status bilgisiyle birlikte döner. Infinity scroll destekler.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
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
 *       400:
 *         description: Geçersiz kullanıcı id formatı
 */
router.get('/:id/achievements', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    return res.status(400).json({ message: 'Invalid user id format' });
  }

  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const parsedLimit =
    typeof rawLimit === 'string'
      ? Number.parseInt(rawLimit, 10)
      : typeof rawLimit === 'number'
        ? rawLimit
        : undefined;
  const limit = Number.isFinite(parsedLimit) && parsedLimit! > 0 ? Math.min(parsedLimit!, 50) : undefined;

  const rawStatus = typeof req.query.status === 'string' ? req.query.status : undefined;
  const status =
    rawStatus === 'not-started' || rawStatus === 'in_progress' || rawStatus === 'completed'
      ? rawStatus
      : undefined;

  const result = await userService.getAchievementBadges(id, { cursor, limit, status });
  res.json(result);
}));

/**
 * @openapi
 * /users/{id}/feed:
 *   get:
 *     summary: Kullanıcının paylaştığı feed gönderilerini listele
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Döndürülecek maksimum card sayısı (varsayılan tümü)
 *       - in: query
 *         name: types
 *         required: false
 *         schema:
 *           type: string
 *           example: "post,benchmark,tipsAndTricks"
 *         description: Virgülle ayrılmış CardType listesi (örn. post,benchmark)
 *     responses:
 *       200:
 *         description: Card listesi (timestamp'e göre sıralı)
 */
router.get('/:id/feed', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const parsedLimit =
    typeof rawLimit === 'string'
      ? Number.parseInt(rawLimit, 10)
      : typeof rawLimit === 'number'
        ? rawLimit
        : undefined;
  const limit = Number.isFinite(parsedLimit) && parsedLimit! > 0 ? Math.min(parsedLimit!, 100) : undefined;
  const types = parseProfileFeedTypes(req.query.types);
  const feed = await userService.getUserProfileFeed(id, { limit, types });
  res.json(feed);
}));

/**
 * @openapi
 * /users/{id}/reviews:
 *   get:
 *     summary: Kullanıcının paylaştığı review'ları listele
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Review listesi
 */
router.get('/:id/reviews', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const reviews = await userService.getUserReviews(id);
  res.json(reviews);
}));

/**
 * @openapi
 * /users/{id}/benchmarks:
 *   get:
 *     summary: Kullanıcının paylaştığı benchmark'ları listele
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Benchmark listesi
 */
router.get('/:id/benchmarks', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const benchmarks = await userService.getUserBenchmarks(id);
  res.json(benchmarks);
}));

/**
 * @openapi
 * /users/{id}/tips:
 *   get:
 *     summary: Kullanıcının paylaştığı tips&tricks'leri listele
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Tips&Tricks listesi
 */
router.get('/:id/tips', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const tips = await userService.getUserTips(id);
  res.json(tips);
}));

/**
 * @openapi
 * /users/{id}/questions:
 *   get:
 *     summary: Kullanıcının soru cevaplarını (reply) listele
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Question reply listesi
 */
router.get('/:id/questions', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const replies = await userService.getUserReplies(id);
  res.json(replies);
}));

/**
 * @openapi
 * /users/{id}/ladder/badges:
 *   get:
 *     summary: Kullanıcının başarım merdivenlerinden kazandığı badge'leri listele
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Ladder badge listesi
 */
router.get('/:id/ladder/badges', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const badges = await userService.getUserLadderBadges(id);
  res.json(badges);
}));

/**
 * @openapi
 * /users/{id}/bookmarks:
 *   get:
 *     summary: Kullanıcının bookmark ettiği gönderileri listele
 *     description: |
 *       Kullanıcının favorite (bookmark) ettiği tüm gönderileri getirir.
 *       Her gönderi kendi tipine göre (feed, benchmark, post, question, tipsAndTricks) formatlanmış olarak döner.
 *       
 *       **Post Tipleri:**
 *       - `FREE` -> `post` tipi
 *       - `COMPARE` -> `benchmark` tipi
 *       - `TIPS` -> `tipsAndTricks` tipi
 *       - `QUESTION` -> `question` tipi
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Kullanıcı ID (UUID)
 *         example: "248cc91f-b551-4ecc-a885-db1163571330"
 *     responses:
 *       200:
 *         description: Bookmark edilmiş gönderiler listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 oneOf:
 *                   - type: object
 *                     properties:
 *                       id: { type: string, example: "01ARZ3NDEKTSV4RRFFQ69G5FAV" }
 *                       type: { type: string, enum: ["post"], example: "post" }
 *                       user:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           name: { type: string, example: "Ömer Faruk" }
 *                           title: { type: string, example: "Technology Enthusiast" }
 *                           avatarUrl: { type: string, nullable: true }
 *                       stats:
 *                         type: object
 *                         properties:
 *                           likes: { type: number, example: 15 }
 *                           comments: { type: number, example: 3 }
 *                           shares: { type: number, example: 0 }
 *                           bookmarks: { type: number, example: 5 }
 *                       createdAt: { type: string, format: date-time }
 *                       product:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id: { type: string }
 *                           name: { type: string }
 *                           subName: { type: string }
 *                           image: { type: string, nullable: true }
 *                       content: { type: string, example: "This is a great product..." }
 *                       images: { type: array, items: { type: string } }
 *                   - type: object
 *                     properties:
 *                       id: { type: string }
 *                       type: { type: string, enum: ["benchmark"], example: "benchmark" }
 *                       user: { type: object }
 *                       stats: { type: object }
 *                       createdAt: { type: string }
 *                       products:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id: { type: string }
 *                             name: { type: string }
 *                             subName: { type: string }
 *                             image: { type: string, nullable: true }
 *                             isOwned: { type: boolean }
 *                             choice: { type: boolean }
 *                       content: { type: string }
 *                   - type: object
 *                     properties:
 *                       id: { type: string }
 *                       type: { type: string, enum: ["tipsAndTricks"], example: "tipsAndTricks" }
 *                       user: { type: object }
 *                       stats: { type: object }
 *                       createdAt: { type: string }
 *                       product: { type: object, nullable: true }
 *                       content: { type: string }
 *                       tag: { type: string, example: "Maintenance" }
 *                       images: { type: array }
 *                   - type: object
 *                     properties:
 *                       id: { type: string }
 *                       type: { type: string, enum: ["question"], example: "question" }
 *                       user: { type: object }
 *                       stats: { type: object }
 *                       createdAt: { type: string }
 *                       product: { type: object, nullable: true }
 *                       content: { type: string }
 *                       expectedAnswerFormat: { type: string, enum: ["short", "long", "poll", "choice"] }
 *                       images: { type: array }
 *                   - type: object
 *                     properties:
 *                       id: { type: string }
 *                       type: { type: string, enum: ["feed"], example: "feed" }
 *                       user: { type: object }
 *                       stats: { type: object }
 *                       createdAt: { type: string }
 *                       product: { type: object, nullable: true }
 *                       content: { type: string }
 *                       images: { type: array }
 *             example:
 *               - id: "01ARZ3NDEKTSV4RRFFQ69G5FAV"
 *                 type: "post"
 *                 user:
 *                   id: "248cc91f-b551-4ecc-a885-db1163571330"
 *                   name: "Ömer Faruk"
 *                   title: "Technology Enthusiast"
 *                   avatarUrl: "https://cdn.tipbox.co/avatars/omer.jpg"
 *                 stats:
 *                   likes: 15
 *                   comments: 3
 *                   shares: 0
 *                   bookmarks: 5
 *                 createdAt: "2024-01-15T10:30:00.000Z"
 *                 product:
 *                   id: "550e8400-e29b-41d4-a716-446655440000"
 *                   name: "Dyson V15s Detect Submarine"
 *                   subName: "Dyson"
 *                   image: null
 *                 content: "Using the Dyson V15s Submarine daily has completely changed how I clean my home."
 *                 images: []
 *               - id: "01ARZ3NDEKTSV4RRFFQ69G5FAW"
 *                 type: "benchmark"
 *                 user:
 *                   id: "248cc91f-b551-4ecc-a885-db1163571330"
 *                   name: "Ömer Faruk"
 *                   title: "Hardware Expert"
 *                   avatarUrl: "https://cdn.tipbox.co/avatars/omer.jpg"
 *                 stats:
 *                   likes: 20
 *                   comments: 5
 *                   shares: 2
 *                   bookmarks: 8
 *                 createdAt: "2024-01-14T09:15:00.000Z"
 *                 products:
 *                   - id: "550e8400-e29b-41d4-a716-446655440000"
 *                     name: "Dyson V15s Detect Submarine"
 *                     subName: "Dyson"
 *                     image: null
 *                     isOwned: true
 *                     choice: false
 *                   - id: "550e8400-e29b-41d4-a716-446655440001"
 *                     name: "Dyson V12 Detect Slim"
 *                     subName: "Dyson"
 *                     image: null
 *                     isOwned: false
 *                     choice: false
 *                 content: "Her iki modeli de test ettim. V15s daha güçlü..."
 */
router.get('/:id/bookmarks', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const bookmarks = await userService.getUserBookmarks(id);
  res.json(bookmarks);
}));




// ===== SETTINGS ENDPOINTS =====

/**
 * @openapi
 * /users/settings/change-password:
 *   post:
 *     summary: Şifre değiştir
 *     description: Kullanıcının şifresini değiştirir
 *     tags: [User Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: oldPassword123
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: newPassword123
 *     responses:
 *       200:
 *         description: Şifre başarıyla değiştirildi
 *       400:
 *         description: Geçersiz istek
 */
router.post('/settings/change-password', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: { message: 'Current password and new password are required' } });
  }

  const result = await userService.changePassword(String(userId), currentPassword, newPassword);
  if (!result.success) {
    return res.status(400).json({ error: { message: result.message || 'Password change failed' } });
  }

  res.json(result);
}));

/**
 * @openapi
 * /users/settings/notifications:
 *   get:
 *     summary: Bildirim ayarlarını getir
 *     description: Kullanıcının bildirim ayarlarını getirir
 *     tags: [User Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bildirim ayarları
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   notificationCode:
 *                     type: integer
 *                     example: 0
 *                   value:
 *                     type: boolean
 *                     example: true
 */
router.get('/settings/notifications', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const settings = await userService.getNotificationSettings(String(userId));
  res.json(settings);
}));

/**
 * @openapi
 * /users/settings/notifications:
 *   put:
 *     summary: Bildirim ayarlarını güncelle
 *     description: Kullanıcının bildirim ayarlarını günceller
 *     tags: [User Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 notificationCode:
 *                   type: integer
 *                   example: 0
 *                 value:
 *                   type: boolean
 *                   example: true
 *     responses:
 *       200:
 *         description: Bildirim ayarları güncellendi
 */
router.put('/settings/notifications', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const settings = req.body;
  if (!Array.isArray(settings)) {
    return res.status(400).json({ message: 'Settings must be an array' });
  }

  const result = await userService.updateNotificationSettings(String(userId), settings);
  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
}));

/**
 * @openapi
 * /users/settings/privacy:
 *   get:
 *     summary: Gizlilik ayarlarını getir
 *     description: Kullanıcının gizlilik ayarlarını getirir
 *     tags: [User Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Gizlilik ayarları
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   privacyCode:
 *                     type: integer
 *                     example: 0
 *                   selectedValue:
 *                     type: string
 *                     example: "trust-only"
 */
router.get('/settings/privacy', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const settings = await userService.getPrivacySettings(String(userId));
  res.json(settings);
}));

/**
 * @openapi
 * /users/settings/privacy:
 *   put:
 *     summary: Gizlilik ayarlarını güncelle
 *     description: Kullanıcının gizlilik ayarlarını günceller
 *     tags: [User Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 privacyCode:
 *                   type: integer
 *                   example: 0
 *                 selectedValue:
 *                   type: string
 *                   example: "trust-only"
 *     responses:
 *       200:
 *         description: Gizlilik ayarları güncellendi
 */
router.put('/settings/privacy', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const settings = req.body;
  if (!Array.isArray(settings)) {
    return res.status(400).json({ message: 'Settings must be an array' });
  }

  const result = await userService.updatePrivacySettings(String(userId), settings);
  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
}));

/**
 * @openapi
 * /users/settings/support-session-price:
 *   get:
 *     summary: Destek oturumu fiyatını getir
 *     description: Kullanıcının destek oturumu fiyatını getirir
 *     tags: [User Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Destek oturumu fiyatı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 price:
 *                   type: number
 *                   nullable: true
 *                   example: 50
 */
router.get('/settings/support-session-price', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const price = await userService.getSupportSessionPrice(String(userId));
  res.json({ price });
}));

/**
 * @openapi
 * /users/settings/support-session-price:
 *   put:
 *     summary: Destek oturumu fiyatını güncelle
 *     description: Kullanıcının destek oturumu fiyatını günceller (minimum 50 TIPS, 10 günde bir değiştirilebilir)
 *     tags: [User Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - price
 *             properties:
 *               price:
 *                 type: number
 *                 minimum: 50
 *                 example: 50
 *     responses:
 *       200:
 *         description: Fiyat başarıyla güncellendi
 *       400:
 *         description: Geçersiz istek veya 10 gün beklemeden değiştirme denemesi
 */
router.put('/settings/support-session-price', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { price } = req.body;
  if (!price || typeof price !== 'number') {
    return res.status(400).json({ message: 'Price is required and must be a number' });
  }

  const result = await userService.updateSupportSessionPrice(String(userId), price);
  if (!result.success) {
    return res.status(400).json({ error: { message: result.message || 'Notification settings update failed' } } );
  }

  res.json(result);
}));

/**
 * @openapi
 * /users/settings/devices:
 *   get:
 *     summary: Bağlı cihazları getir
 *     description: Kullanıcının bağlı cihazlarını getirir
 *     tags: [User Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bağlı cihazlar listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   location:
 *                     type: string
 *                     nullable: true
 *                   date:
 *                     type: string
 *                   isActive:
 *                     type: boolean
 */
router.get('/settings/devices', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const devices = await userService.getConnectedDevices(String(userId));
  res.json(devices);
}));

/**
 * @openapi
 * /users/settings/devices/{deviceId}:
 *   delete:
 *     summary: Cihazı kaldır
 *     description: Bağlı cihazı listeden kaldırır
 *     tags: [User Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cihaz başarıyla kaldırıldı
 *       404:
 *         description: Cihaz bulunamadı
 */
router.delete('/settings/devices/:deviceId', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { deviceId } = req.params;
  const result = await userService.removeDevice(String(userId), deviceId);
  if (!result.success) {
    return res.status(404).json(result);
  }

  res.json(result);
}));

/**
 * @openapi
 * /users/settings/devices:
 *   delete:
 *     summary: Tüm cihazları kaldır
 *     description: Kullanıcının tüm bağlı cihazlarını listeden kaldırır
 *     tags: [User Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tüm cihazlar başarıyla kaldırıldı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 count:
 *                   type: integer
 */
router.delete('/settings/devices', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = (req as any).user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const result = await userService.removeAllDevices(String(userId));
  res.json(result);
}));

export default router; 