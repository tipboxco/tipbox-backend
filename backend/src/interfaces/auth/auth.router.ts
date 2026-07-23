import { Router, Request, Response } from 'express';
import { AuthService } from '../../application/auth/auth.service';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from './auth.middleware';
import { UserAvatarPrismaRepository } from '../../infrastructure/repositories/user-avatar-prisma.repository';
import { ProfilePrismaRepository } from '../../infrastructure/repositories/profile-prisma.repository';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import logger from '../../infrastructure/logger/logger';
import { validateBody } from '../../infrastructure/middleware/validation.middleware';
import {
  loginRateLimiter,
  authRateLimiter,
  verificationRateLimiter,
} from '../../infrastructure/middleware/rate-limit.middleware';
import { DailyRewardService } from '../../application/wallet/daily-reward.service';
import {
  LoginSchema,
  RegisterSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
  VerifyResetCodeSchema,
  ResendVerificationSchema
} from './auth.schemas';

const router = Router();
const authService = new AuthService();
const avatarRepo = new UserAvatarPrismaRepository();
const profileRepo = new ProfilePrismaRepository();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Kullanıcı girişi
 *     description: Email ve şifre ile kullanıcı girişi yapar ve JWT token döner
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: omer@tipbox.co
 *                 description: Kullanıcının email adresi
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: password123
 *                 description: Kullanıcının şifresi (minimum 6 karakter)
 *     responses:
 *       200:
 *         description: Başarılı giriş ve kullanıcı bilgileri ile token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                   description: Kullanıcının benzersiz ID'si
 *                 fullName:
 *                   type: string
 *                   nullable: true
 *                   example: Ömer Faruk
 *                   description: Kullanıcının tam adı (Profile'dan)
 *                 email:
 *                   type: string
 *                   example: omer@tipbox.co
 *                   description: Kullanıcının email adresi
 *                 avatar:
 *                   type: string
 *                   nullable: true
 *                   example: http://localhost:9000/tipbox-media/profile-pictures/1/uuid.jpg
 *                   description: Kullanıcının aktif profil fotoğrafı URL'i
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJvbWVyLmZhcnVrQHRpcGJveC5jb20iLCJpYXQiOjE3NjE3MjczNDMsImV4cCI6MTc2MTczMDk0M30.example_signature
 *                   description: JWT access token (1 saat geçerli)
 *                 refreshToken:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJvbWVyLmZhcnVrQHRpcGJveC5jb20iLCJpYXQiOjE3NjE3MjczNDMsImV4cCI6MTc2MTczMDk0M30.refresh_token
 *                   description: JWT refresh token (7 gün geçerli)
 *       400:
 *         description: Geçersiz istek formatı
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
 *                   example: Email ve şifre alanları zorunludur
 *       401:
 *         description: Geçersiz email veya şifre, veya email doğrulanmamış
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
 *                   example: Geçersiz email veya şifre
 *       500:
 *         description: Sunucu hatası
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Giriş yapılırken bir hata oluştu
 */
router.post('/login', loginRateLimiter, validateBody(LoginSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Authentication
  const user = await authService.authenticate(email, password);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
    });
  }

  // Email doğrulaması kontrolü
  if (!user.emailVerified) {
    return res.status(401).json({
      success: false,
      message: 'Your email address is not verified. Please verify your email address first.',
    });
  }

  // Profile bilgilerini çek
  const profile = await profileRepo.findByUserId(user.id);
  const fullName = profile?.displayName || null;

  // Aktif avatar'ı çek
  const activeAvatar = await avatarRepo.findActiveByUserId(user.id);
  const avatarUrl = resolveMediaUrl(activeAvatar?.imageUrl || null, true);

  // Token oluştur
  const token = authService.generateToken(user);
  
  // Refresh token oluştur (daha uzun süreli - 7 gün)
  const refreshToken = authService.generateRefreshToken(user);

  // Device tracking - User-Agent ve IP'den cihaz bilgilerini kaydet
  const userAgent = req.headers['user-agent'] || '';
  const ipAddress = (req.ip || req.socket.remoteAddress || null) as string | null;
  
  // Async olarak device tracking yap (blocking olmaz)
  authService.trackDevice(user.id, userAgent, ipAddress).catch((error) => {
    // Hata durumunda log'la ama login işlemini engelleme
    logger.error({
      message: 'Device tracking failed during login',
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  // Günlük giriş ödülü — fire-and-forget
  new DailyRewardService()
    .grantLoginReward(user.id)
    .catch((err) => logger.error({ err, userId: user.id }, 'daily reward başarısız'));

  // Response
  const loginData = {
    id: user.id,
    fullName,
    email: user.email || '',
    avatar: avatarUrl,
    token,
    refreshToken,
  };
  return res.json({
    success: true,
    data: loginData,
    // Backward compatibility - flat fields (deprecated, use data object)
    ...loginData,
  });
}));

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Manuel kullanıcı kaydı
 *     description: Email, şifre ve isim ile kullanıcı kaydı başlatır. Email doğrulama kodu gönderilir.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *                 description: Kullanıcının email adresi (benzersiz olmalı)
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: password123
 *                 description: Kullanıcının şifresi (minimum 6 karakter)
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: Ömer Faruk
 *                 description: Kullanıcının tam adı
 *     responses:
 *       200:
 *         description: Kayıt başarılı, email doğrulama kodu gönderildi
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
 *                   example: Kayıt başarılı. Email doğrulama kodu gönderildi.
 *       400:
 *         description: Geçersiz istek formatı
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
 *                   example: Email, şifre ve isim alanları zorunludur
 *       409:
 *         description: Email zaten kayıtlı
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
 *                   example: Bu email adresi zaten kayıtlı
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
 *                   example: Email gönderilemedi. Lütfen tekrar deneyin.
 */
router.post('/register', authRateLimiter, validateBody(RegisterSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  try {
    const result = await authService.signup(email, password, name);

    if (!result.success) {
      // Email zaten kayıtlı hatası için 409
      if (result.message.includes('already registered') || result.message.includes('already exists')) {
        return res.status(409).json(result);
      }
      
      // Email gönderilemedi hatası için 503 (Service Unavailable)
      if (result.message.includes('Failed to send') || result.message.includes('Email could not be sent')) {
        return res.status(503).json(result);
      }
      
      // Diğer hatalar için 500
      return res.status(500).json(result);
    }

    return res.json(result);
  } catch (error) {
    // Beklenmeyen hatalar için
    logger.error({
      message: 'Unexpected error in register endpoint',
      email,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during registration. Please try again.',
    });
  }
}));

/**
 * Email doğrulama kodunu yeniden gönderir
 */
router.post('/resend-verification', verificationRateLimiter, validateBody(ResendVerificationSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = await authService.sendEmailVerificationCode(email);

  if (!result.success) {
    const statusCode = result.message.includes('bulunamadı') ? 404 : 500;
    return res.status(statusCode).json(result);
  }

  return res.json(result);
}));

/**
 * @openapi
 * /api/auth/verify-email:
 *   post:
 *     summary: Email doğrulama
 *     description: Email adresine gönderilen 6 haneli kod ile email doğrulama yapar
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *                 description: Doğrulanacak email adresi
 *               code:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 example: "123456"
 *                 description: Email'e gönderilen 6 haneli doğrulama kodu
 *     responses:
 *       200:
 *         description: Email doğrulama başarılı, JWT token döner
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ1c2VyQGV4YW1wbGUuY29tIiwiaWF0IjoxNzYxNzI3MzQzLCJleHAiOjE3NjE3MzA5NDN9.example_signature
 *                   description: JWT access token (1 saat geçerli)
 *                 message:
 *                   type: string
 *                   example: Email doğrulama başarılı
 *       400:
 *         description: Geçersiz istek formatı
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
 *                   example: Email ve kod alanları zorunludur
 *       404:
 *         description: Geçersiz veya süresi dolmuş kod
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
 *                   example: Geçersiz veya süresi dolmuş doğrulama kodu
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
 *                   example: Email doğrulama sırasında bir hata oluştu
 */
router.post('/verify-email', verificationRateLimiter, validateBody(VerifyEmailSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email, code } = req.body;

  const result = await authService.verifyEmail(email, code);

  if (!result.success) {
    return res.status(404).json(result);
  }

  return res.json(result);
}));

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Giriş yapan kullanıcının bilgilerini getir
 *     description: JWT token ile doğrulanmış kullanıcının profil bilgilerini döner
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kullanıcı bilgileri başarıyla getirildi
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
 *                   description: Auth0 kullanıcı ID'si (opsiyonel)
 *                 walletAddress:
 *                   type: string
 *                   nullable: true
 *                   example: 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6
 *                   description: Kullanıcının cüzdan adresi (opsiyonel)
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
 *       401:
 *         description: Yetkisiz erişim veya geçersiz token
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
router.get('/me', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  // authMiddleware handles token validation + blacklist check and sets req.user
  const token = req.token;
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const user = await authService.getUserFromToken(token);
  if (!user) return res.status(401).json({ success: false, message: 'User not found' });

  const meData = {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status || 'ACTIVE',
    auth0Id: user.auth0Id || null,
    walletAddress: user.walletAddress || null,
    kycStatus: user.kycStatus || '',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
  return res.json({
    success: true,
    data: meData,
    // Backward compatibility - flat fields (deprecated, use data object)
    ...meData,
  });
}));

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     summary: Şifre sıfırlama kodu gönderir
 *     description: Email adresine şifre sıfırlama kodu gönderir
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mail
 *             properties:
 *               mail:
 *                 type: string
 *                 format: email
 *                 example: example@gmail.com
 *                 description: Şifre sıfırlama kodu gönderilecek email adresi
 *     responses:
 *       200:
 *         description: Şifre sıfırlama kodu gönderildi
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
 *                   example: Şifre sıfırlama kodu gönderildi.
 *       400:
 *         description: Geçersiz istek formatı veya email doğrulanmamış
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
 *                   example: Email adresiniz doğrulanmamış
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
 *                   example: Email gönderilemedi. Lütfen tekrar deneyin.
 */
router.post('/forgot-password', verificationRateLimiter, validateBody(ForgotPasswordSchema), asyncHandler(async (req: Request, res: Response) => {
  const { mail } = req.body;

  const result = await authService.forgotPassword(mail);

  if (!result.success) {
    const statusCode = result.message.includes('doğrulanmamış') ? 400 : 500;
    return res.status(statusCode).json(result);
  }

  return res.json(result);
}));

/**
 * @openapi
 * /api/auth/verify-reset-code:
 *   post:
 *     summary: Şifre sıfırlama kodunu doğrular
 *     description: Email ve kod ile şifre sıfırlama kodunu doğrular
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mail
 *               - code
 *             properties:
 *               mail:
 *                 type: string
 *                 format: email
 *                 example: example@gmail.com
 *                 description: Email adresi
 *               code:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 example: "122456"
 *                 description: Email'e gönderilen 6 haneli şifre sıfırlama kodu
 *     responses:
 *       200:
 *         description: Kod doğrulandı
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
 *                   example: Kod doğrulandı. Yeni şifrenizi oluşturabilirsiniz.
 *       400:
 *         description: Geçersiz istek formatı
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
 *                   example: Email ve kod alanları zorunludur
 *       404:
 *         description: Geçersiz veya süresi dolmuş kod
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
 *                   example: Geçersiz veya süresi dolmuş kod
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
 *                   example: Kod doğrulama sırasında bir hata oluştu
 */
router.post('/verify-reset-code', verificationRateLimiter, validateBody(VerifyResetCodeSchema), asyncHandler(async (req: Request, res: Response) => {
  const { mail, code } = req.body;

  const result = await authService.verifyResetCode(mail, code);

  if (!result.success) {
    return res.status(404).json(result);
  }

  return res.json(result);
}));

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     summary: Şifreyi sıfırlar
 *     description: Email ve yeni şifre ile kullanıcı şifresini günceller
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: example@gmail.com
 *                 description: Şifresi sıfırlanacak kullanıcının email adresi
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: 1224qwer
 *                 description: Yeni şifre (minimum 6 karakter)
 *     responses:
 *       200:
 *         description: Şifre başarıyla güncellendi
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
 *                   example: Şifre başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.
 *       400:
 *         description: Geçersiz istek formatı veya şifre kriterleri karşılanmıyor
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
 *                   example: Şifre en az 6 karakter olmalıdır
 *       404:
 *         description: Kullanıcı bulunamadı
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
 *                   example: Kullanıcı bulunamadı
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
 *                   example: Şifre güncellenirken bir hata oluştu
 */
router.post('/reset-password', verificationRateLimiter, validateBody(ResetPasswordSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const result = await authService.resetPassword(email, password);

  if (!result.success) {
    const statusCode = result.message.includes('bulunamadı') ? 404 : 500;
    return res.status(statusCode).json(result);
  }

  return res.json(result);
}));

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Kullanıcı çıkışı
 *     description: Mevcut JWT token'ı blacklist'e ekler ve geçersiz kılar
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Çıkış başarılı
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
 *                   example: Çıkış yapıldı
 *       401:
 *         description: Yetkisiz erişim
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 */
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  // Token'ı blacklist'e ekle
  const { blacklistToken } = await import('../../infrastructure/auth/token-blacklist');
  await blacklistToken(token);
  
  return res.json({
    success: true,
    message: 'Çıkış yapıldı'
  });
}));

export default router; 