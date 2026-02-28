import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import {
  PROFILE_FEED_CARD_TYPES,
  ProfileFeedCardType,
  UserService,
} from '../../application/user/user.service';
import { CreateUserRequest, UpdateUserProfileRequest, UserResponse } from './user.dto';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { PaymentDashboardService } from '../../application/payment/payment-dashboard.service';
import { PaymentMethodService, PAYMENT_ERROR_CODES } from '../../application/payment/payment-method.service';
import { InvoiceService } from '../../application/payment/invoice.service';
import {
  PaymentDashboardResponse,
  PaymentMethodResponse,
  SubscriptionResponse,
  InvoiceResponse,
  AddPaymentMethodRequest,
  UpdatePaymentMethodRequest,
} from '../payment/payment.dto';
import { parseInvoiceSort, parseLimit, parseOffset } from '../payment/payment.schemas';
import { S3Service } from '../../infrastructure/s3/s3.service';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../infrastructure/logger/logger';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { invalidateUserCache, invalidateAllUserCache } from '../../infrastructure/cache/cache-invalidation';
import { WalletService } from '../../application/wallet/wallet.service';
import { createWeb3NftService, createNFTMetadata } from '../../application/wallet/web3-nft-service';
// ValidationError kullanılmıyor; mevcut mimaride router içinde direkt 400/409 dönüyoruz

const router = Router();
const userService = new UserService();
const walletService = new WalletService();
const s3Service = new S3Service();
const prisma = getPrisma();
const paymentDashboardService = new PaymentDashboardService();
const paymentMethodService = new PaymentMethodService();
const invoiceService = new InvoiceService();

function toPaymentMethodResponse(card: { id: string; cardAlias: string; brand: string; last4: string; expiryMonth: number; expiryYear: number; isDefault: boolean; createdAt: Date; updatedAt: Date }): PaymentMethodResponse {
  return {
    id: card.id,
    card_alias: card.cardAlias,
    brand: card.brand,
    last4: card.last4,
    expiry_month: card.expiryMonth,
    expiry_year: card.expiryYear,
    is_default: card.isDefault,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

function toSubscriptionResponse(sub: { planId: string; status: string; currentPeriodEnd: Date; planName?: string; benefits?: string[] }): SubscriptionResponse {
  return {
    current_plan_id: sub.planId,
    plan_name: sub.planName ?? '',
    status: sub.status,
    next_billing_date: sub.currentPeriodEnd.toISOString(),
    benefits: sub.benefits ?? [],
  };
}

function toInvoiceResponse(inv: { id: string; amount: number; currency: string; status: string; description: string | null; invoiceDate: Date }): InvoiceResponse {
  return {
    id: inv.id,
    amount: inv.amount,
    currency: inv.currency,
    date: inv.invoiceDate.toISOString(),
    status: inv.status,
    description: inv.description,
  };
}

// Multer configuration - memory storage (dosya buffer'da tutulacak)
// Bu tanım endpoint'lerden ÖNCE olmalı (hoisting sorunu için)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    // Sadece resim dosyalarına izin ver (HEIC/HEIF iOS desteği ile)
    const allowedMimeTypes = [
      'image/jpeg', 
      'image/jpg', 
      'image/png', 
      'image/gif', 
      'image/webp',
      'image/heic',
      'image/heif'
    ];
    
    if (file.mimetype && allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else if (file.originalname) {
      // Fallback: Dosya uzantısına göre kontrol
      const ext = file.originalname.split('.').pop()?.toLowerCase();
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
      if (ext && allowedExtensions.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Sadece resim dosyaları yüklenebilir (JPG, PNG, GIF, WebP, HEIC)'));
      }
    } else {
      cb(new Error('Sadece resim dosyaları yüklenebilir (JPG, PNG, GIF, WebP, HEIC)'));
    }
  },
});

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
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const profile = await userService.getSelfUserProfile(String(userId));
  if (!profile) return res.status(404).json({ success: false, message: 'User not found' });
  return res.json(profile);
}));

/**
 * @openapi
 * /users/me/profile:
 *   put:
 *     summary: Profil bilgilerini güncelle
 *     description: Profil bilgilerini günceller. Avatar ve banner için ayrı upload endpoint'leri kullanılmalıdır (POST /users/me/avatar ve POST /users/me/banner).
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
/**
 * @openapi
 * /users/me/avatar:
 *   post:
 *     summary: Avatar yükle
 *     description: Multipart/form-data ile avatar dosyası yükler ve avatar URL'ini döner.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Avatar görseli (JPG, PNG, GIF, WebP, HEIC - max 5MB)
 *     responses:
 *       200:
 *         description: Avatar başarıyla yüklendi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     avatarUrl:
 *                       type: string
 *                       example: "http://192.168.1.178:9000/tipbox-media/profile-pictures/user123/avatar.jpg"
 *       400:
 *         description: Geçersiz dosya formatı veya dosya bulunamadı
 *       401:
 *         description: Kimlik doğrulaması başarısız
 */
router.post(
  '/me/avatar',
  upload.single('avatar'),
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Debug: Request bilgilerini logla
    logger.info({
      message: '[uploadAvatar] Request received',
      contentType: req.headers['content-type'],
      hasFile: !!req.file,
      fileField: req.file ? req.file.fieldname : null,
      bodyKeys: Object.keys(req.body || {}),
      filesKeys: Object.keys(req.files || {}),
    });

    const file = req.file;
    if (!file) {
      // Daha detaylı hata mesajı
      logger.warn({
        message: '[uploadAvatar] File not found',
        contentType: req.headers['content-type'],
        body: req.body,
        files: req.files,
      });
      return res.status(400).json({ 
        success: false,
        message: 'Avatar dosyası gerekli',
        debug: {
          contentType: req.headers['content-type'],
          expectedField: 'avatar',
          receivedFields: Object.keys(req.body || {}),
        }
      });
    }

    try {
      // File extension'ı güvenli şekilde al
      let fileExtension = 'jpg'; // Default extension
      
      // Önce dosya adından extension al
      if (file.originalname && file.originalname.includes('.')) {
        const parts = file.originalname.split('.');
        if (parts.length > 1) {
          fileExtension = parts[parts.length - 1].toLowerCase();
        }
      }
      
      // MIME type'dan extension mapping
      const mimeToExtension: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/heic': 'heic',
        'image/heif': 'heif',
      };
      
      // MIME type varsa onu kullan (daha güvenilir)
      if (file.mimetype && mimeToExtension[file.mimetype]) {
        fileExtension = mimeToExtension[file.mimetype];
      }
      
      // Extension'ı validate et
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
      if (!allowedExtensions.includes(fileExtension)) {
        return res.status(400).json({ 
          success: false,
          message: 'Desteklenmeyen dosya formatı. Sadece JPG, PNG, GIF, WebP ve HEIC formatları desteklenmektedir.' 
        });
      }
      
      // Dosya adını oluştur
      const fileName = `profile-pictures/${userId}/${uuidv4()}.${fileExtension}`;
      
      // Dosyayı S3'e yükle
      const filePath = await s3Service.uploadFile(fileName, file.buffer, file.mimetype);
      
      // Veritabanına kaydet: Önceki aktif avatar'ı pasif yap
      await prisma.userAvatar.updateMany({
        where: {
          userId,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
      
      // Yeni avatar'ı aktif olarak kaydet (sadece path, full URL değil)
      await prisma.userAvatar.create({
        data: {
          userId,
          imageUrl: filePath, // Bu zaten path formatında (profile-pictures/...)
          isActive: true,
        },
      });
      
      // Cache'i temizle - avatar güncellendiği için profil cache'i invalidate et
      try {
        await invalidateAllUserCache(userId);
        logger.info({
          message: 'User cache invalidated after avatar upload',
          userId,
        });
      } catch (cacheError) {
        // Cache invalidation hatası kritik değil, log'la ama devam et
        logger.warn({
          message: 'Cache invalidation failed after avatar upload',
          userId,
          error: cacheError instanceof Error ? cacheError.message : String(cacheError),
        });
      }
      
      // Tam URL'yi oluştur
      const avatarUrl = resolveMediaUrl(filePath, false);
      
      logger.info({
        message: 'Avatar başarıyla yüklendi ve veritabanına kaydedildi',
        userId,
        fileName,
        fileSize: file.size,
        mimeType: file.mimetype,
        avatarUrl,
        filePath,
      });
      
      return res.json({
        success: true,
        data: {
          avatarUrl: avatarUrl || filePath,
        },
      });
    } catch (error) {
      logger.error({
        message: 'Avatar upload error',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  })
);

/**
 * @openapi
 * /users/me/banner:
 *   post:
 *     summary: Banner yükle
 *     description: Multipart/form-data ile banner dosyası yükler ve banner URL'ini döner.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - banner
 *             properties:
 *               banner:
 *                 type: string
 *                 format: binary
 *                 description: Banner görseli (JPG, PNG, GIF, WebP, HEIC - max 5MB)
 *     responses:
 *       200:
 *         description: Banner başarıyla yüklendi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     bannerUrl:
 *                       type: string
 *                       example: "http://192.168.1.178:9000/tipbox-media/banners/user123/banner.jpg"
 *       400:
 *         description: Geçersiz dosya formatı veya dosya bulunamadı
 *       401:
 *         description: Kimlik doğrulaması başarısız
 */
router.post(
  '/me/banner',
  upload.single('banner'),
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Debug: Request bilgilerini logla
    logger.info({
      message: '[uploadBanner] Request received',
      contentType: req.headers['content-type'],
      hasFile: !!req.file,
      fileField: req.file ? req.file.fieldname : null,
      bodyKeys: Object.keys(req.body || {}),
      filesKeys: Object.keys(req.files || {}),
    });

    const file = req.file;
    if (!file) {
      // Daha detaylı hata mesajı
      logger.warn({
        message: '[uploadBanner] File not found',
        contentType: req.headers['content-type'],
        body: req.body,
        files: req.files,
      });
      return res.status(400).json({ 
        success: false,
        message: 'Banner dosyası gerekli',
        debug: {
          contentType: req.headers['content-type'],
          expectedField: 'banner',
          receivedFields: Object.keys(req.body || {}),
        }
      });
    }

    try {
      // File extension'ı güvenli şekilde al
      let fileExtension = 'jpg'; // Default extension
      
      // Önce dosya adından extension al
      if (file.originalname && file.originalname.includes('.')) {
        const parts = file.originalname.split('.');
        if (parts.length > 1) {
          fileExtension = parts[parts.length - 1].toLowerCase();
        }
      }
      
      // MIME type'dan extension mapping
      const mimeToExtension: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/heic': 'heic',
        'image/heif': 'heif',
      };
      
      // MIME type varsa onu kullan (daha güvenilir)
      if (file.mimetype && mimeToExtension[file.mimetype]) {
        fileExtension = mimeToExtension[file.mimetype];
      }
      
      // Extension'ı validate et
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
      if (!allowedExtensions.includes(fileExtension)) {
        return res.status(400).json({ 
          success: false,
          message: 'Desteklenmeyen dosya formatı. Sadece JPG, PNG, GIF, WebP ve HEIC formatları desteklenmektedir.' 
        });
      }
      
      // Dosya adını oluştur
      const fileName = `banners/${userId}/${uuidv4()}.${fileExtension}`;
      
      // Dosyayı S3'e yükle
      const filePath = await s3Service.uploadFile(fileName, file.buffer, file.mimetype);
      
      // Profil tablosunda bannerUrl'i güncelle
      const existingProfile = await prisma.profile.findUnique({
        where: { userId } as any,
      });
      
      if (existingProfile) {
        await prisma.profile.update({
          where: { userId } as any,
          data: { bannerUrl: filePath },
        });
      } else {
        // Profil yoksa oluştur
        await prisma.profile.create({
          data: {
            userId,
            displayName: 'Anonymous User',
            userName: null,
            bannerUrl: filePath,
          } as any,
        });
      }
      
      // Cache'i temizle - banner güncellendiği için profil cache'i invalidate et
      try {
        await invalidateAllUserCache(userId);
        logger.info({
          message: 'User cache invalidated after banner upload',
          userId,
        });
      } catch (cacheError) {
        // Cache invalidation hatası kritik değil, log'la ama devam et
        logger.warn({
          message: 'Cache invalidation failed after banner upload',
          userId,
          error: cacheError instanceof Error ? cacheError.message : String(cacheError),
        });
      }
      
      // Tam URL'yi oluştur
      const bannerUrl = resolveMediaUrl(filePath, false);
      
      logger.info({
        message: 'Banner başarıyla yüklendi ve veritabanına kaydedildi',
        userId,
        fileName,
        fileSize: file.size,
        mimeType: file.mimetype,
        bannerUrl,
        filePath,
      });
      
      return res.json({
        success: true,
        data: {
          bannerUrl: bannerUrl || filePath,
        },
      });
    } catch (error) {
      logger.error({
        message: 'Banner yükleme hatası',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  })
);

router.put('/me/profile', asyncHandler(async (req: Request<{}, {}, UpdateUserProfileRequest>, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!userId) {
    logger.warn('[updateProfile] Unauthorized request - no userId found');
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const body = req.body || {};
  logger.info('[updateProfile] Request received', { userId, bodyKeys: Object.keys(body) });

  if (body.name && body.name.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Name must be at least 2 characters long' });
  }

  if (body.biography && body.biography.length > 500) {
    return res.status(400).json({ success: false, message: 'Biography can be at most 500 characters' });
  }

  if (body.badge && !Array.isArray(body.badge)) {
    return res.status(400).json({ success: false, message: 'Badge field must be an array' });
  }

  if (body.badge && body.badge.length > 3) {
    return res.status(400).json({ success: false, message: 'Maximum 3 badges can be selected' });
  }

  try {
    await userService.updateProfileDetails(String(userId), {
      name: body.name,
      biography: body.biography,
      cosmeticId: typeof body.cosmetic !== 'undefined' ? body.cosmetic : undefined,
      badges: body.badge?.map(badge => ({ id: badge })) ?? undefined,
    });

    logger.info('[updateProfile] Profile updated successfully', { userId });

    const profile = await userService.getSelfUserProfile(String(userId));
    if (!profile) {
      logger.error('[updateProfile] Profile not found after update', { userId });
      return res.status(404).json({ 
        success: false,
        message: 'Profile not found' 
      });
    }

    return res.json({
      success: true,
      profile,
    });
  } catch (error) {
    logger.error('[updateProfile] Error updating profile', { 
      userId, 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error; // asyncHandler'a bırak
  }
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
  const userPayload = req.user;
  const viewerId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!viewerId) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const targetUserId = req.params.id;
  if (!targetUserId) return res.status(400).json({ success: false, message: 'User id is required' });

  const profile = await userService.getUserProfileForViewer(String(viewerId), String(targetUserId));
  if (!profile) return res.status(404).json({ success: false, message: 'User not found' });
  return res.json(profile);
}));

/**
 * @openapi
 * /users/suggested:
 *   get:
 *     summary: Önerilen kullanıcıları getir (Suggested Users)
 *     description: |
 *       Trust edilmemiş kullanıcılardan öneriler döner. 
 *       Pagination, search ve mutual trust count desteği vardır.
 *       
 *       **Öneri Algoritması:**
 *       - Ortak trust'lar
 *       - Popülerlik (truster count)
 *       - Aktiflik (post count)
 *       
 *       **Hariç Tutulanlar:**
 *       - Kullanıcının kendisi
 *       - Zaten trust edilmiş kullanıcılar
 *       - Engellenmiş (blocked) kullanıcılar
 *       - Susturulmuş (muted) kullanıcılar
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Döndürülecek maksimum kullanıcı sayısı
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination için cursor (son kullanıcının ID'si)
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Kullanıcı adı veya isim araması için search query
 *     responses:
 *       200:
 *         description: Önerilen kullanıcılar listesi
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
 *                         example: "248cc91f-b551-4ecc-a885-db1163571330"
 *                       userName:
 *                         type: string
 *                         nullable: true
 *                         example: "michael_clark"
 *                       name:
 *                         type: string
 *                         nullable: true
 *                         example: "Michael Clark"
 *                       avatar:
 *                         type: string
 *                         nullable: true
 *                         example: "https://cdn.tipbox.co/avatars/user-123.jpg"
 *                       titles:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["Technology Enthusiast", "Hardware Expert", "Digital Innovation Specialist"]
 *                       isTrusted:
 *                         type: boolean
 *                         example: false
 *                         description: Kullanıcının bu kişiyi trust edip etmediği (suggested users'da her zaman false)
 *                       mutualTrustCount:
 *                         type: integer
 *                         example: 3
 *                         description: Ortak trust sayısı ("3 ortak arkadaş" gibi gösterilebilir)
 *                       stats:
 *                         type: object
 *                         properties:
 *                           posts:
 *                             type: integer
 *                             example: 87
 *                           trust:
 *                             type: integer
 *                             example: 245
 *                           truster:
 *                             type: integer
 *                             example: 189
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     nextCursor:
 *                       type: string
 *                       nullable: true
 *                       example: "user-456"
 *                       description: Bir sonraki sayfa için cursor (null ise son sayfa)
 *                     hasMore:
 *                       type: boolean
 *                       example: true
 *                       description: Daha fazla kullanıcı var mı?
 *             examples:
 *               success:
 *                 value:
 *                   items:
 *                     - id: "user-123"
 *                       userName: "michael_clark"
 *                       name: "Michael Clark"
 *                       avatar: "https://cdn.tipbox.com/avatars/user-123.jpg"
 *                       titles: ["Technology Enthusiast", "Hardware Expert", "Digital Innovation Specialist"]
 *                       isTrusted: false
 *                       mutualTrustCount: 3
 *                       stats:
 *                         trust: 245
 *                         truster: 189
 *                         posts: 87
 *                   pagination:
 *                     nextCursor: "user-456"
 *                     hasMore: true
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 */
router.get('/suggested', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

  // Query parameters
  const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
  const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;
  const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
  const searchQuery = req.query.q ? String(req.query.q) : undefined;

  const suggestions = await userService.getSuggestedUsers(String(userId), {
    cursor,
    limit,
    searchQuery,
  });

  return res.json(suggestions);
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
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name_asc, name_desc, date_asc, date_desc, trusted_first]
 *           default: date_desc
 *         description: "Sıralama kriteri (name_asc: A-Z, name_desc: Z-A, date_asc: Eski-yeni, date_desc: Yeni-eski, trusted_first: Önce trust edilenler)"
 *     responses:
 *       200:
 *         description: Truster listesi
 */
router.get('/:id/trusters', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
  const sort = typeof req.query.sort === 'string' 
    ? req.query.sort as 'name_asc' | 'name_desc' | 'date_asc' | 'date_desc' | 'trusted_first'
    : 'date_desc'; // Default sort
  const list = await userService.listTrusters(id, q, sort);
  return res.json(list);
}));


/**
 * @openapi
 * /users/trusts/{targetUserId}:
 *   delete:
 *     summary: Trust listesinden kullanıcı kaldır (authenticated user için)
 *     description: Authenticated user'ın trust listesinden belirtilen kullanıcıyı kaldırır. User ID auth token'dan alınır.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: targetUserId
 *         required: true
 *         schema:
 *           type: string
 *         description: Trust listesinden kaldırılacak kullanıcı ID'si
 *     responses:
 *       204:
 *         description: Kullanıcı trust listesinden başarıyla kaldırıldı
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Trust kaydı bulunamadı
 */
router.delete('/trusts/:targetUserId', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const authUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!authUserId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  
  const targetUserId = String(req.params.targetUserId);
  const ok = await userService.removeTrust(authUserId, targetUserId);
  if (!ok) return res.status(404).json({ success: false, message: 'Record not found' });
  return res.status(204).end();
}));

/**
 * @openapi
 * /users/trust:
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
 *               targetUserId:
 *                 type: string
 *                 description: Trust edilecek kullanıcı ID'si
 *                 example: "248cc91f-b551-4ecc-a885-db1163571330"
 *     responses:
 *       201:
 *         description: Trust işlemi başarıyla gerçekleştirildi ve trust/truster sayıları güncellendi
 *       400:
 *         description: Geçersiz parametreler
 *       401:
 *         description: Unauthorized
 */
router.post('/trust', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const authUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!authUserId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  
  const { targetUserId } = req.body || {};
  const id = String(authUserId);

  if (!targetUserId || typeof targetUserId !== 'string') {
    return res.status(400).json({ success: false, message: 'targetUserId is required and must be a string' });
  }
  
  await userService.addTrust(id, targetUserId);
  return res.status(201).json({ message: 'Trust added successfully' });
}));


/**
 * @openapi
 * /users/{id}/collections/bridges:
 *   get:
 *     summary: Bridge badge koleksiyonu
 *     tags: [Collections]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: İsim veya kullanıcı adına göre arama (case-insensitive)
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Pagination cursor (son item'ın id'si)
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Sayfa başına item sayısı
 *     responses:
 *       200:
 *         description: Kullanıcının bridge koleksiyon rozetleri (Badge type'a göre Brand ve Achievement tab'ları için ayrılmış)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 brand:
 *                   type: object
 *                   description: Badge type BRAND olan rozetler (Brand tab içeriği)
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           image: { type: string, nullable: true }
 *                           title: { type: string }
 *                           rarity: { type: string, enum: [Usual, Rare, Epic, Legendary] }
 *                           isClaimed: { type: boolean }
 *                           nftAddress: { type: string, nullable: true }
 *                           totalEarned: { type: integer }
 *                           earnedDate: { type: string, format: date-time, nullable: true }
 *                           tasks: { type: array, items: { type: object, properties: { id: { type: string }, title: { type: string }, type: { type: string, enum: [Comment, Like, Share] } } } }
 *                 achievement:
 *                   type: object
 *                   description: Badge type BRAND dışındaki tüm rozetler (Achievement tab içeriği)
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           image: { type: string, nullable: true }
 *                           title: { type: string }
 *                           rarity: { type: string, enum: [Usual, Rare, Epic, Legendary] }
 *                           isClaimed: { type: boolean }
 *                           nftAddress: { type: string, nullable: true }
 *                           totalEarned: { type: integer }
 *                           earnedDate: { type: string, format: date-time, nullable: true }
 *                           tasks: { type: array, items: { type: object, properties: { id: { type: string }, title: { type: string }, type: { type: string, enum: [Comment, Like, Share] } } } }
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
 */
router.get('/:id/collections/bridges', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id;
  const limit = parseInt(req.query.limit as string) || 20;
  const cursor = req.query.cursor as string | undefined;

  if (limit < 1 || limit > 50) {
    return res.status(400).json({
      success: false,
      message: 'Limit must be between 1 and 50',
    });
  }

  const result = await userService.getUserBadgesWithCategories(
    userId,
    limit,
    cursor,
  );

  return res.json(result);
}));

/**
 * @openapi
 * /users/collections/achievements/claim:
 *   post:
 *     summary: Achievement badge claim et (query string ile)
 *     description: badgeId query parametresi ile. Badge DB'den okunur, kullanıcının Thirdweb wallet smartAccountAddress'ine NFT mint edilir.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: badgeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Claim edilecek achievement badge ID (UUID)
 *     responses:
 *       201:
 *         description: Badge başarıyla claim edildi
 *       400:
 *         description: Claim başarısız veya badgeId eksik
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Badge not found
 *       502:
 *         description: NFT mint failed
 */
router.post('/collections/achievements/claim', asyncHandler(handleAchievementClaim));

/**
 * @openapi
 * /users/collections/achievements/{badgeId}/claim:
 *   post:
 *     summary: Achievement badge claim et (path ile)
 *     description: badgeId path parametresi ile. Badge DB'den okunur, kullanıcının Thirdweb wallet smartAccountAddress'ine NFT mint edilir.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: badgeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Claim edilecek achievement badge ID (UUID)
 *     responses:
 *       201:
 *         description: Badge başarıyla claim edildi
 *       400:
 *         description: Claim başarısız
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Badge not found
 *       502:
 *         description: NFT mint failed
 */
router.post('/collections/achievements/:badgeId/claim', asyncHandler(handleAchievementClaim));

/**
 * @openapi
 * /collections/bridges/{badgeId}/claim:
 *   post:
 *     summary: Bridge badge claim et
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 */
router.post('/collections/bridges/:badgeId/claim', asyncHandler(handleAchievementClaim));

async function handleAchievementClaim(req: Request, res: Response): Promise<void> {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }
  const badgeId = String(req.params.badgeId || req.query.badgeId || '').trim();
  if (!badgeId) {
    res.status(400).json({ success: false, message: 'badgeId is required (path or query)' });
    return;
  }

  const badge = await prisma.badge.findUnique({ where: { id: badgeId } });
  if (!badge) {
    res.status(404).json({ success: false, message: 'Badge not found' });
    return;
  }

  const wallet = await walletService.getThirdwebWallet(String(userId));
  if (!wallet?.smartAccountAddress) {
    res.status(400).json({
      success: false,
      message: 'Thirdweb wallet with smart account required. Connect your wallet first.',
    });
    return;
  }

  const metadata = createNFTMetadata({
    name: badge.name,
    description: badge.description ?? undefined,
    imageUrl: badge.imageUrl ? (resolveMediaUrl(badge.imageUrl, true) ?? undefined) : undefined,
    attributes: [
      { trait_type: 'type', value: badge.type },
      { trait_type: 'rarity', value: badge.rarity },
      { trait_type: 'badgeId', value: badge.id },
    ],
  });

  const nftService = createWeb3NftService();
  const mintResult = await nftService.mintWithMetadata(wallet.smartAccountAddress, metadata);

  if (!mintResult.success) {
    logger.warn({ userId, badgeId, error: mintResult.error, message: 'Achievement badge NFT mint failed' });
    res.status(502).json({
      success: false,
      message: mintResult.error ?? 'NFT mint failed',
      contractError: mintResult.contractError,
    });
    return;
  }

  const result = await userService.claimAchievementBadge(String(userId), badgeId);
  res.status(result.success ? 201 : 400).json({
    ...result,
    transactionHash: mintResult.transactionHash,
  });
}

/**
 * @openapi
 * /users/collections/bridges/claim:
 *   post:
 *     summary: Bridge badge claim et (query string ile)
 *     description: badgeId query parametresi ile. Badge DB'den okunur, kullanıcının Thirdweb wallet smartAccountAddress'ine NFT mint edilir.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: badgeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Claim edilecek bridge badge ID (UUID)
 *     responses:
 *       201:
 *         description: Badge başarıyla claim edildi
 *       400:
 *         description: Claim başarısız veya badgeId eksik
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Badge not found
 *       502:
 *         description: NFT mint failed
 */
router.post('/collections/bridges/claim', asyncHandler(handleBridgeClaim));

/**
 * @openapi
 * /users/collections/bridges/{badgeId}/claim:
 *   post:
 *     summary: Bridge badge claim et (path ile)
 *     description: badgeId path parametresi ile. Badge DB'den okunur, kullanıcının Thirdweb wallet smartAccountAddress'ine NFT mint edilir.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: badgeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Claim edilecek bridge badge ID (UUID)
 *     responses:
 *       201:
 *         description: Badge başarıyla claim edildi
 *       400:
 *         description: Claim başarısız
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Badge not found
 *       502:
 *         description: NFT mint failed
 */
router.post('/collections/bridges/:badgeId/claim', asyncHandler(handleBridgeClaim));

async function handleBridgeClaim(req: Request, res: Response): Promise<void> {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }
  const badgeId = String(req.params.badgeId || req.query.badgeId || '').trim();
  if (!badgeId) {
    res.status(400).json({ success: false, message: 'badgeId is required (path or query)' });
    return;
  }

  const badge = await prisma.badge.findUnique({ where: { id: badgeId } });
  if (!badge) {
    res.status(404).json({ success: false, message: 'Badge not found' });
    return;
  }

  const wallet = await walletService.getThirdwebWallet(String(userId));
  if (!wallet?.smartAccountAddress) {
    res.status(400).json({
      success: false,
      message: 'Thirdweb wallet with smart account required. Connect your wallet first.',
    });
    return;
  }

  const metadata = createNFTMetadata({
    name: badge.name,
    description: badge.description ?? undefined,
    imageUrl: badge.imageUrl ? (resolveMediaUrl(badge.imageUrl, true) ?? undefined) : undefined,
    attributes: [
      { trait_type: 'type', value: badge.type },
      { trait_type: 'rarity', value: badge.rarity },
      { trait_type: 'badgeId', value: badge.id },
    ],
  });

  const nftService = createWeb3NftService();
  const mintResult = await nftService.mintWithMetadata(wallet.smartAccountAddress, metadata);

  if (!mintResult.success) {
    logger.warn({ userId, badgeId, error: mintResult.error, message: 'Bridge badge NFT mint failed' });
    res.status(502).json({
      success: false,
      message: mintResult.error ?? 'NFT mint failed',
      contractError: mintResult.contractError,
    });
    return;
  }

  const result = await userService.claimBridgeBadge(String(userId), badgeId);
  res.status(result.success ? 201 : 400).json({
    ...result,
    transactionHash: mintResult.transactionHash,
  });
}

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
    return res.status(400).json({ success: false, message: 'Email adresi zorunludur ve boş olamaz.' });
  }
  
  if (typeof email !== 'string') {
    return res.status(400).json({ success: false, message: 'Email adresi string olmalıdır.' });
  }
  
  if (email === '') {
    return res.status(400).json({ success: false, message: 'Email adresi zorunludur ve boş olamaz.' });
  }
  
  // Email format kontrolü
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: 'Geçerli bir email adresi giriniz.' });
  }
  
  // Validation: DisplayName zorunlu ve kontrolü
  if (displayName === undefined || displayName === null) {
    return res.status(400).json({ success: false, message: 'DisplayName zorunludur ve boş olamaz.' });
  }
  
  if (typeof displayName !== 'string') {
    return res.status(400).json({ success: false, message: 'DisplayName string olmalıdır.' });
  }
  
  if (displayName === '') {
    return res.status(400).json({ success: false, message: 'DisplayName zorunludur ve boş olamaz.' });
  }
  
  // DisplayName minLength kontrolü (OpenAPI: minLength: 2)
  if (displayName.length < 2) {
    return res.status(400).json({ success: false, message: 'DisplayName must be at least 2 characters long.' });
  }
  
  // DisplayName maxLength kontrolü (OpenAPI: maxLength: 50)
  if (displayName.length > 50) {
    return res.status(400).json({ success: false, message: 'DisplayName can be at most 50 characters long.' });
  }
  
  // Bio maxLength kontrolü (OpenAPI: maxLength: 500)
  if (bio !== undefined && bio !== null && typeof bio === 'string' && bio.length > 500) {
    return res.status(400).json({ success: false, message: 'Bio can be at most 500 characters long.' });
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
  } catch (error: unknown) {
    const code = (error as any).code;
    if (code === 'P2002' && 
        typeof error === 'object' && 
        error !== null && 
        'meta' in error &&
        typeof (error as { meta: unknown }).meta === 'object' &&
        (error as { meta: { target?: unknown } }).meta?.target &&
        Array.isArray((error as { meta: { target: unknown[] } }).meta.target) &&
        (error as { meta: { target: string[] } }).meta.target.includes('email')) {
      return res.status(409).json({ success: false, message: 'This email address is already in use.' });
    }
    throw error;
  }
}));

/**
 * @openapi
 * /users/avatars:
 *   get:
 *     summary: Mevcut avatar listesini getirir
 *     description: Setup profile sırasında kullanıcıya gösterilecek 12 adet default avatar listesini döndürür.
 *     operationId: getAvatars
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Avatar listesi başarıyla döndürüldü
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 avatars:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: avatar-1
 *                         description: Avatar identifier
 *                       name:
 *                         type: string
 *                         example: avatar-1.png
 *                         description: Avatar dosya adı
 *                       url:
 *                         type: string
 *                         example: http://192.168.1.178:9000/tipbox-media/avatars/avatar-1.png
 *                         description: Avatar'ın tam URL'i
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
 *                   example: Avatar listesi alınırken bir hata oluştu
 */
router.get('/avatars', asyncHandler(async (req: Request, res: Response) => {
  try {
    // 12 adet avatar: seed'de tests/assets/avatars/ → MinIO'ya avatars/avatar-1.png ... avatars/avatar-12.png yüklenir
    const avatars = Array.from({ length: 12 }, (_, i) => {
      const avatarNumber = i + 1;
      const avatarName = `avatar-${avatarNumber}.png`;
      const avatarPath = `avatars/${avatarName}`;
      const avatarUrl = resolveMediaUrl(avatarPath);

      return {
        id: `avatar-${avatarNumber}`,
        name: avatarName,
        url: avatarUrl || '',
      };
    });

    return res.status(200).json({
      success: true,
      avatars,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({
      message: 'Avatar listesi alınırken hata oluştu',
      error: errorMessage,
    });

    return res.status(500).json({
      success: false,
      message: `Avatar listesi alınırken bir hata oluştu: ${errorMessage}`,
    });
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
 *                 example: '{"userId":"1","selectedCategories":[{"categoryId":"1","subCategoryIds":["1","2"]},{"categoryId":"2","subCategoryIds":["3"]},{"categoryId":"3","subCategoryIds":["4","5"]}]}'
 *                 description: JSON string formatında ilgi alanları. En az 3 farklı alan (category veya subCategory) seçilmelidir.
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
 *                   example: En az 3 farklı alan seçmelisiniz. Şu anda 2 alan seçtiniz.
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
  const userPayload = req.user;
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

  // En az 3 farklı alan seçimi validasyonu
  const selectedCategories = categoriesData.selectedCategories || [];
  
  if (!Array.isArray(selectedCategories) || selectedCategories.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'You must select at least 3 different fields',
    });
  }

  // Toplam seçilen alan sayısını hesapla (category + subCategory'ler)
  const selectedFields = new Set<string>();
  
  for (const category of selectedCategories) {
    if (category.categoryId) {
      selectedFields.add(`category_${category.categoryId}`);
    }
    if (Array.isArray(category.subCategoryIds)) {
      for (const subCategoryId of category.subCategoryIds) {
        selectedFields.add(`subcategory_${subCategoryId}`);
      }
    }
  }

  // En az 3 farklı alan kontrolü
  if (selectedFields.size < 3) {
    return res.status(400).json({
      success: false,
      message: `You must select at least 3 different fields. Currently you have selected ${selectedFields.size} field(s).`,
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
      throw new Error('Unsupported file format. Only JPG, PNG, GIF and WebP formats are supported.');
    }
    
    // Dosya adını oluştur
    const fileName = `${folder}/${userIdStr}/${uuidv4()}.${fileExtension}`;
    
    // Dosyayı yükle
    const fileUrl = await s3Service.uploadFile(fileName, file.buffer, file.mimetype);
    
    logger.info({
      message: `${fileType} uploaded successfully`,
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({
        message: 'Avatar upload error',
        error: errorMessage,
        userId: userIdStr,
        fileName: avatarFile.originalname,
        fileSize: avatarFile.size,
        mimeType: avatarFile.mimetype,
      });
      
      return res.status(500).json({
        success: false,
        message: `An error occurred while uploading avatar: ${errorMessage}`,
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({
        message: 'Banner upload error',
        error: errorMessage,
        userId: userIdStr,
        fileName: bannerFile.originalname,
        fileSize: bannerFile.size,
        mimeType: bannerFile.mimetype,
      });
      
      return res.status(500).json({
        success: false,
        message: `An error occurred while uploading banner: ${errorMessage}`,
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

    return res.status(200).json({
      success: true,
      message: 'Profile completed successfully',
      user: response,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('already in use') || errorMessage.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: errorMessage,
      });
    }
    
    if (errorMessage.includes('not verified') || errorMessage.includes('email not verified')) {
      return res.status(401).json({
        success: false,
        message: errorMessage,
      });
    }

    return res.status(500).json({
      success: false,
      message: `An error occurred while completing profile: ${errorMessage}`,
    });
  }
}));

/**
 * @openapi
 * /users/username/check:
 *   get:
 *     summary: Username müsaitlik ve geçerlilik kontrolü
 *     description: Kullanıcı input'a girdikçe real-time olarak username'in geçerli ve müsait olup olmadığını kontrol eder
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: username
 *         schema:
 *           type: string
 *         required: true
 *         description: Kontrol edilecek username
 *         example: tunab
 *     responses:
 *       200:
 *         description: Username kontrolü başarılı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isValid:
 *                   type: boolean
 *                   example: true
 *                   description: Username formatı geçerli mi?
 *                 isAvailable:
 *                   type: boolean
 *                   example: true
 *                   description: Username müsait mi?
 *                 message:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *                   description: Hata mesajı (varsa)
 *       400:
 *         description: Geçersiz istek
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
 *                   example: Username parametresi zorunludur
 *       500:
 *         description: Sunucu hatası
 */
router.get('/username/check', asyncHandler(async (req: Request, res: Response) => {
  const { username } = req.query;

  if (!username || typeof username !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Username parametresi zorunludur',
    });
  }

  try {
    // Mevcut kullanıcı ID'sini al (eğer varsa)
    const userPayload = req.user;
    const currentUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    const result = await userService.checkUsernameAvailability(
      username,
      currentUserId ? String(currentUserId) : undefined
    );

    return res.json(result);
  } catch (error) {
    logger.error({
      message: 'Error checking username availability',
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      isValid: false,
      isAvailable: false,
      message: 'An error occurred while checking username',
    });
  }
}));

/**
 * @openapi
 * /users/username/suggestions:
 *   get:
 *     summary: Username önerileri (Instagram benzeri)
 *     description: Verilen username müsait değilse, benzer ve müsait username önerileri döner
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: username
 *         schema:
 *           type: string
 *         required: true
 *         description: Temel username (öneriler buna göre oluşturulur)
 *         example: tunab
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *           minimum: 1
 *           maximum: 10
 *         required: false
 *         description: Döndürülecek öneri sayısı
 *         example: 5
 *     responses:
 *       200:
 *         description: Username önerileri başarıyla döndürüldü
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["tunab1", "tunab_1", "tunab123", "tunabreal", "1tunab"]
 *                   description: Önerilen username'ler listesi
 *       400:
 *         description: Geçersiz istek
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
 *                   example: Username parametresi zorunludur
 *       500:
 *         description: Sunucu hatası
 */
router.get('/username/suggestions', asyncHandler(async (req: Request, res: Response) => {
  const { username, limit } = req.query;

  if (!username || typeof username !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Username parametresi zorunludur',
    });
  }

  const limitNum = limit ? parseInt(String(limit), 10) : 5;
  const validLimit = Math.min(Math.max(limitNum, 1), 10); // 1-10 arası

  try {
    const suggestions = await userService.suggestUsernames(username, validLimit);
    return res.json({
      suggestions,
    });
  } catch (error) {
    logger.error({
      message: 'Error generating username suggestions',
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      suggestions: [],
      message: 'An error occurred while generating username suggestions',
    });
  }
}));

/**
 * @openapi
 * /users/categories:
 *   get:
 *     summary: Kullanıcı kayıt için kategori ve sub-kategori listesi
 *     description: Her kategori için dinamik olarak en fazla 10 sub-kategoriyi döner. Alfabetik sıraya göre ilk 10 sub-kategori getirilir.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kategori ve sub-kategori listesi başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   categoryId:
 *                     type: string
 *                     example: "pcat_01KFBPP9QBEJE1ZW7DFHBP6T2B"
 *                     description: Kategori benzersiz ID'si
 *                   name:
 *                     type: string
 *                     example: "Electronics"
 *                     description: Kategori adı
 *                   subCategories:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         subCategoryId:
 *                           type: string
 *                           example: "pcat_01KFBPP9YH0YHNBMBGVNZBYD1S"
 *                           description: Sub-kategori benzersiz ID'si
 *                         name:
 *                           type: string
 *                           example: "Cell Phones & Accessories"
 *                           description: Sub-kategori adı
 *                     maxItems: 10
 *                     description: En fazla 10 sub-kategori (alfabetik sıraya göre)
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
 *                   example: Kategori listesi alınırken bir hata oluştu
 */
router.get('/categories', asyncHandler(async (req: Request, res: Response) => {
  try {
    const categories = await userService.getUserCategories();
    return res.json(categories);
  } catch (error) {
    logger.error({
      message: 'Error getting user categories',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching category list',
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
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
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
  return res.json(response);
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
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  return res.json(card);
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
  if (!ok) return res.status(404).json({ success: false, message: 'Record not found' });
  return res.status(204).send();
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
  const userPayload = req.user;
  const authUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!authUserId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const id = String(req.params.id);
  if (authUserId !== id) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const targetUserId = String(req.params.targetUserId);
  await userService.blockUser(id, targetUserId);
  return res.status(204).send();
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
  const userPayload = req.user;
  const authUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!authUserId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const id = String(req.params.id);
  if (authUserId !== id) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const targetUserId = String(req.params.targetUserId);
  const ok = await userService.unblockUser(id, targetUserId);
  if (!ok) return res.status(404).json({ success: false, message: 'Block record not found' });
  return res.status(204).send();
}));

/**
 * @openapi
 * /users/{id}/report/{targetUserId}:
 *   post:
 *     summary: Bir kullanıcıyı raporla (report)
 *     description: Bir kullanıcıyı belirtilen kategori ve açıklama ile raporlar
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Kullanıcı ID (raporlayan)
 *       - in: path
 *         name: targetUserId
 *         required: true
 *         schema: { type: string }
 *         description: Raporlanacak kullanıcı ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category
 *             properties:
 *               category:
 *                 type: string
 *                 enum: [SPAM, HARASSMENT, SCAM, INAPPROPRIATE_CONTENT, FAKE_ACCOUNT, OTHER]
 *                 description: Rapor kategorisi
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: Rapor açıklaması (opsiyonel)
 *     responses:
 *       201:
 *         description: Kullanıcı başarıyla raporlandı
 *       400:
 *         description: Geçersiz istek (kendini raporlama, geçersiz kategori, vb.)
 *       409:
 *         description: Bu kullanıcı zaten raporlanmış
 *       404:
 *         description: Raporlanan kullanıcı bulunamadı
 */
router.post('/:id/report/:targetUserId', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const authUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!authUserId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const id = String(req.params.id);
  if (authUserId !== id) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const targetUserId = String(req.params.targetUserId);
  const { category, description } = req.body || {};
  
  if (!category || typeof category !== 'string') {
    return res.status(400).json({ success: false, message: 'Category is required' });
  }

  try {
    await userService.reportUser(id, targetUserId, category, description);
    return res.status(201).json({ message: 'Kullanıcı başarıyla raporlandı' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
    if (errorMessage.includes('zaten raporlanmış')) {
      return res.status(409).json({ success: false, message: errorMessage });
    }
    if (errorMessage.includes('not found')) {
      return res.status(404).json({ success: false, message: errorMessage });
    }
    return res.status(400).json({ success: false, message: errorMessage });
  }
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
  const userPayload = req.user;
  const authUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!authUserId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const id = String(req.params.id);
  if (authUserId !== id) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const targetUserId = String(req.params.targetUserId);
  await userService.muteUser(id, targetUserId);
  return res.status(204).send();
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
  const userPayload = req.user;
  const authUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!authUserId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const id = String(req.params.id);
  if (authUserId !== id) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const targetUserId = String(req.params.targetUserId);
  const ok = await userService.unmuteUser(id, targetUserId);
  if (!ok) return res.status(404).json({ success: false, message: 'Mute record not found' });
  return res.status(204).send();
}));

/**
 * @openapi
 * /users/{id}/collections/achievements:
 *   get:
 *     summary: Kullanıcının Achievement Badge koleksiyonunu listele
 *     description: Kullanıcının kazandığı achievement badge'leri döner. Arama parametresi ile filtreleme yapılabilir.
 *     tags: [Collections]
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
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Pagination cursor (son item'ın id'si)
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Sayfa başına item sayısı
 *     responses:
 *       200:
 *         description: Achievement Badge listesi
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
 *                         example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                       image:
 *                         type: string
 *                         nullable: true
 *                         example: "https://cdn.tipbox.co/badges/builder.png"
 *                       title:
 *                         type: string
 *                         example: "Builder Badge"
 *                       rarity:
 *                         type: string
 *                         enum: [Usual, Rare, Epic, Legendary]
 *                         example: "Rare"
 *                       isClaimed:
 *                         type: boolean
 *                         example: true
 *                       nftAddress:
 *                         type: string
 *                         nullable: true
 *                         example: null
 *                       totalEarned:
 *                         type: integer
 *                         example: 1
 *                       earnedDate:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         example: "2024-01-15T10:30:00.000Z"
 *                       tasks:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                               example: "goal-123"
 *                             title:
 *                               type: string
 *                               example: "10 Yorum Yap"
 *                             type:
 *                               type: string
 *                               enum: [Comment, Like, Share]
 *                               example: "Comment"
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
 */
router.get('/:id/collections/achievements', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    return res.status(400).json({ success: false, message: 'Invalid user id format' });
  }
  const querySearch = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
  const queryQ = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
  const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
  const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
  const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;
  const badges = await userService.listAchievementBadges(id, queryQ || querySearch || undefined, { cursor, limit });
  return res.json(badges);
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
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Pagination cursor (son item id)
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
  const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
  const types = parseProfileFeedTypes(req.query.types);
  const feed = await userService.getUserProfileFeed(id, { limit, types, cursor });
  return res.json(feed);
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
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Pagination cursor (son item'ın id'si)
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Sayfa başına item sayısı
 *     responses:
 *       200:
 *         description: Review listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
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
 */
router.get('/:id/reviews', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
  const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
  const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;
  const reviews = await userService.getUserReviews(id, { cursor, limit });
  return res.json(reviews);
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
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Pagination cursor (son item'ın id'si)
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Sayfa başına item sayısı
 *     responses:
 *       200:
 *         description: Benchmark listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
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
 */
router.get('/:id/benchmarks', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
  const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
  const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;
  const benchmarks = await userService.getUserBenchmarks(id, { cursor, limit });
  return res.json(benchmarks);
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
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Pagination cursor (son item'ın id'si)
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Sayfa başına item sayısı
 *     responses:
 *       200:
 *         description: Tips&Tricks listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
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
 */
router.get('/:id/tips', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
  const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
  const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;
  const tips = await userService.getUserTips(id, { cursor, limit });
  return res.json(tips);
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
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Pagination cursor (son item'ın id'si)
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Sayfa başına item sayısı
 *     responses:
 *       200:
 *         description: Question reply listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
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
 */
router.get('/:id/questions', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
  const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
  const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;
  const replies = await userService.getUserReplies(id, { cursor, limit });
  return res.json(replies);
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
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *         description: Pagination cursor (son item'ın id'si)
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Sayfa başına item sayısı
 *     responses:
 *       200:
 *         description: Bookmark edilmiş gönderiler listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
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
 */
router.get('/:id/bookmarks', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
  const limitParam = req.query.limit ? Number(req.query.limit) : undefined;
  const limit = limitParam && !Number.isNaN(limitParam) ? Math.min(limitParam, 50) : 20;
  const bookmarks = await userService.getUserBookmarks(id, { cursor, limit });
  return res.json(bookmarks);
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
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Current password and new password are required' });
  }

  const result = await userService.changePassword(String(userId), currentPassword, newPassword);
  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message || 'Password change failed' });
  }

  return res.json(result);
}));

/**
 * @openapi
 * /users/settings/notifications:
 *   get:
 *     summary: Bildirim ayarlarını getir
 *     description: Kullanıcının tüm bildirim ayarlarını getirir (kanal, kategori ve global ayarlar)
 *     tags: [User Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bildirim ayarları
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 channels:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       notificationCode:
 *                         type: integer
 *                         example: 0
 *                       value:
 *                         type: boolean
 *                         example: true
 *                 categories:
 *                   type: object
 *                   properties:
 *                     trustNotifications:
 *                       type: boolean
 *                     supportNotifications:
 *                       type: boolean
 *                     messageNotifications:
 *                       type: boolean
 *                     collectionNotifications:
 *                       type: boolean
 *                     postNotifications:
 *                       type: boolean
 *                     nftNotifications:
 *                       type: boolean
 *                     rewardNotifications:
 *                       type: boolean
 *                     transactionNotifications:
 *                       type: boolean
 *                     walletNotifications:
 *                       type: boolean
 *                     gamificationNotifications:
 *                       type: boolean
 *                     expertNotifications:
 *                       type: boolean
 *                     eventNotifications:
 *                       type: boolean
 *                     systemNotifications:
 *                       type: boolean
 *                 global:
 *                   type: object
 *                   properties:
 *                     receiveNotifications:
 *                       type: boolean
 *                       nullable: true
 */
router.get('/settings/notifications', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const settings = await userService.getNotificationSettings(String(userId));
    return res.json(settings);
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    throw error;
  }
}));

/**
 * @openapi
 * /users/settings/notifications:
 *   put:
 *     summary: Bildirim ayarlarını güncelle
 *     description: Kullanıcının bildirim ayarlarını günceller. Hem eski format (array) hem de yeni format (object) desteklenir.
 *     tags: [User Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: array
 *                 description: Eski format - sadece kanal ayarları
 *                 items:
 *                   type: object
 *                   properties:
 *                     notificationCode:
 *                       type: integer
 *                       example: 0
 *                     value:
 *                       type: boolean
 *                       example: true
 *               - type: object
 *                 description: Yeni format - kanal, kategori ve global ayarlar
 *                 properties:
 *                   channels:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         notificationCode:
 *                           type: integer
 *                         value:
 *                           type: boolean
 *                   categories:
 *                     type: object
 *                     properties:
 *                       trustNotifications:
 *                         type: boolean
 *                       supportNotifications:
 *                         type: boolean
 *                       messageNotifications:
 *                         type: boolean
 *                       collectionNotifications:
 *                         type: boolean
 *                       postNotifications:
 *                         type: boolean
 *                       nftNotifications:
 *                         type: boolean
 *                       rewardNotifications:
 *                         type: boolean
 *                       transactionNotifications:
 *                         type: boolean
 *                       walletNotifications:
 *                         type: boolean
 *                       gamificationNotifications:
 *                         type: boolean
 *                       expertNotifications:
 *                         type: boolean
 *                       eventNotifications:
 *                         type: boolean
 *                       systemNotifications:
 *                         type: boolean
 *                   global:
 *                     type: object
 *                     properties:
 *                       receiveNotifications:
 *                         type: boolean
 *                         nullable: true
 *     responses:
 *       200:
 *         description: Bildirim ayarları güncellendi
 */
router.put('/settings/notifications', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const settings = req.body;
  
  // Backward compatibility: Array formatını da kabul et
  if (Array.isArray(settings)) {
    const result = await userService.updateNotificationSettings(String(userId), settings);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  }

  // Yeni format: Object
  if (typeof settings === 'object' && settings !== null) {
    const result = await userService.updateNotificationSettings(String(userId), settings);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  }

  return res.status(400).json({ 
    success: false, 
    message: 'Settings must be an array or object' 
  });
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
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const settings = await userService.getPrivacySettings(String(userId));
  return res.json(settings);
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
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const settings = req.body;
  if (!Array.isArray(settings)) {
    return res.status(400).json({ success: false, message: 'Settings must be an array' });
  }

  const result = await userService.updatePrivacySettings(String(userId), settings);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
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
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const price = await userService.getSupportSessionPrice(String(userId));
  return res.json({ price });
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
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { price } = req.body;
  if (!price || typeof price !== 'number') {
    return res.status(400).json({ success: false, message: 'Price is required and must be a number' });
  }

  const result = await userService.updateSupportSessionPrice(String(userId), price);
  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message || 'Notification settings update failed' });
  }

  return res.json(result);
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
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const devices = await userService.getConnectedDevices(String(userId));
  return res.json(devices);
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
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { deviceId } = req.params;
  const result = await userService.removeDevice(String(userId), deviceId);
  if (!result.success) {
    return res.status(404).json(result);
  }

  return res.json(result);
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
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const result = await userService.removeAllDevices(String(userId));
  return res.json(result);
}));

/**
 * @openapi
 * /users/settings/payment-dashboard:
 *   get:
 *     summary: Ödeme özeti (kartlar, abonelik, son faturalar)
 *     description: Ayarlar sayfası için kayıtlı kartlar, aktif abonelik ve son 3-5 faturayı döner.
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ödeme özeti
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 saved_cards: { type: array, items: { $ref: '#/components/schemas/PaymentMethodResponse' } }
 *                 active_subscription: { $ref: '#/components/schemas/SubscriptionResponse', nullable: true }
 *                 recent_invoices: { type: array, items: { $ref: '#/components/schemas/InvoiceResponse' } }
 *       401:
 *         description: Unauthorized
 */
router.get('/settings/payment-dashboard', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const dashboard = await paymentDashboardService.getDashboard(String(userId));
  const response: PaymentDashboardResponse = {
    saved_cards: dashboard.saved_cards.map(toPaymentMethodResponse),
    active_subscription: dashboard.active_subscription ? toSubscriptionResponse(dashboard.active_subscription) : null,
    recent_invoices: dashboard.recent_invoices.map(toInvoiceResponse),
  };
  return res.json(response);
}));

/**
 * @openapi
 * /users/settings/payment-methods:
 *   post:
 *     summary: Yeni kart ekle
 *     description: Ödeme sağlayıcısından alınan token ile kart eklenir. Kart bilgisi backend'e gönderilmez.
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddPaymentMethodRequest'
 *     responses:
 *       201:
 *         description: Kart eklendi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentMethodResponse'
 *       400:
 *         description: Geçersiz istek veya hata (error_code ile)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 error_code: { type: string, enum: [INSUFFICIENT_FUNDS, INVALID_EXPIRY, CARD_DECLINED] }
 *       401:
 *         description: Unauthorized
 */
router.post('/settings/payment-methods', asyncHandler(async (req: Request<{}, {}, AddPaymentMethodRequest>, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const body = req.body;
  if (!body?.payment_token || !body?.card_alias) {
    return res.status(400).json({ success: false, message: 'payment_token and card_alias are required' });
  }
  const card = await paymentMethodService.addCard(String(userId), {
    payment_token: body.payment_token,
    card_alias: body.card_alias,
  });
  return res.status(201).json(toPaymentMethodResponse(card));
}));

/**
 * @openapi
 * /users/settings/payment-methods/{id}:
 *   patch:
 *     summary: Kart ismini güncelle
 *     description: Sadece card_alias güncellenir.
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePaymentMethodRequest'
 *     responses:
 *       200:
 *         description: Kart güncellendi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentMethodResponse'
 *       404:
 *         description: Kart bulunamadı veya kullanıcıya ait değil
 *       401:
 *         description: Unauthorized
 */
router.patch('/settings/payment-methods/:id', asyncHandler(async (req: Request<{ id: string }, {}, UpdatePaymentMethodRequest>, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const { id } = req.params;
  const body = req.body;
  if (!body?.card_alias) return res.status(400).json({ success: false, message: 'card_alias is required' });
  const card = await paymentMethodService.updateCardAlias(String(userId), id, body.card_alias);
  if (!card) return res.status(404).json({ success: false, message: 'Payment method not found' });
  return res.json(toPaymentMethodResponse(card));
}));

/**
 * @openapi
 * /users/settings/payment-methods/{id}:
 *   delete:
 *     summary: Kayıtlı kartı sil
 *     description: Kart aktif abonelikte kullanılıyorsa silme reddedilir (409, error_code CARD_IN_USE_BY_SUBSCRIPTION).
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Kart silindi
 *       404:
 *         description: Kart bulunamadı (error_code CARD_NOT_FOUND)
 *       409:
 *         description: Kart aktif abonelikte kullanılıyor (error_code CARD_IN_USE_BY_SUBSCRIPTION)
 *       401:
 *         description: Unauthorized
 */
router.delete('/settings/payment-methods/:id', asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const { id } = req.params;
  const result = await paymentMethodService.deleteCard(String(userId), id);
  if (!result.success) {
    if (result.errorCode === PAYMENT_ERROR_CODES.CARD_NOT_FOUND) {
      return res.status(404).json({ success: false, message: 'Payment method not found', error_code: result.errorCode });
    }
    if (result.errorCode === PAYMENT_ERROR_CODES.CARD_IN_USE_BY_SUBSCRIPTION) {
      return res.status(409).json({ success: false, message: 'Card is in use by an active subscription', error_code: result.errorCode });
    }
    return res.status(400).json({ success: false, message: 'Cannot delete card', error_code: result.errorCode });
  }
  return res.status(204).send();
}));

/**
 * @openapi
 * /users/settings/invoices:
 *   get:
 *     summary: Fatura geçmişi listele
 *     description: sort_by (date_asc, date_desc), limit, offset ile sayfalı liste.
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sort_by
 *         schema: { type: string, enum: [date_asc, date_desc], default: date_desc }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: Fatura listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/InvoiceResponse' }
 *       401:
 *         description: Unauthorized
 */
router.get('/settings/invoices', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const sort_by = parseInvoiceSort(req.query.sort_by);
  const limit = parseLimit(req.query.limit);
  const offset = parseOffset(req.query.offset);
  const invoices = await invoiceService.listInvoices(String(userId), { sort_by, limit, offset });
  return res.json(invoices.map(toInvoiceResponse));
}));

/**
 * @openapi
 * /users/me:
 *   delete:
 *     summary: Kullanıcı hesabını sil
 *     description: Kullanıcının kendi hesabını siler. İlişkili veriler temizlenir ve GDPR uyumluluğu sağlanır.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Hesap başarıyla silindi
 *       401:
 *         description: Kimlik doğrulaması başarısız
 *       404:
 *         description: Kullanıcı bulunamadı
 */
router.delete('/me', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const deleted = await userService.deleteUser(String(userId));
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(204).send();
  } catch (error) {
    logger.error(`Failed to delete user ${userId}`, error);
    throw error;
  }
}));

/**
 * @openapi
 * /users/{id}/collections/bridges/{badgeId}:
 *   get:
 *     summary: Get badge detail with tasks (EP-03)
 *     description: Get detailed badge information including task progress
 *     tags: [Users, Badges]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: badgeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Badge detail with tasks
 *       404:
 *         description: Badge not found
 */
router.get(
  '/:id/collections/bridges/:badgeId',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.id;
    const badgeId = req.params.badgeId;
    const userPayload = req.user;
    const viewerId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    const badge = await userService.getBadgeDetailWithTasks(
      badgeId,
      viewerId === userId ? userId : undefined,
    );

    return res.json(badge);
  }),
);

/**
 * @openapi
 * /users/me/highlight-badges:
 *   get:
 *     summary: Get highlight badge selection data (EP-05)
 *     description: Get current highlight badges and available badges for selection
 *     tags: [Users, Badges]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Highlight badge selection data
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/me/highlight-badges',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const data = await userService.getHighlightBadgeSelectionData(
      String(userId),
    );
    return res.json(data);
  }),
);

/**
 * @openapi
 * /users/me/highlight-badges:
 *   put:
 *     summary: Update highlight badges (EP-06)
 *     description: Set up to 4 highlight badges for profile
 *     tags: [Users, Badges]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               badgeIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 4
 *     responses:
 *       200:
 *         description: Highlight badges updated
 *       400:
 *         description: Invalid request (max 4 badges or badges not owned)
 *       401:
 *         description: Unauthorized
 */
router.put(
  '/me/highlight-badges',
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = req.user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { badgeIds } = req.body;

    if (!Array.isArray(badgeIds)) {
      return res.status(400).json({
        success: false,
        message: 'badgeIds must be an array',
      });
    }

    const result = await userService.updateHighlightBadges(
      String(userId),
      badgeIds,
    );
    return res.json(result);
  }),
);

export default router; 