import { Router, Request, Response } from 'express';
import { requiresAuth } from 'express-openid-connect';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import logger from '../../infrastructure/logger/logger';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import { ProfilePrismaRepository } from '../../infrastructure/repositories/profile-prisma.repository';
import { UserAvatarPrismaRepository } from '../../infrastructure/repositories/user-avatar-prisma.repository';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import { AuthService } from '../../application/auth/auth.service';
import { validateBody } from '../../infrastructure/middleware/validation.middleware';
import { LoginSchema, RegisterSchema } from '../auth/auth.schemas';
import axios from 'axios';

const router = Router();
const userRepo = new UserPrismaRepository();
const profileRepo = new ProfilePrismaRepository();
const avatarRepo = new UserAvatarPrismaRepository();
const authService = new AuthService();

// ============================================================================
// HELPER FUNCTIONS - Kod tekrarını önlemek için
// ============================================================================

/**
 * Request header'larından dinamik base URL oluşturur (Auth0 callback için).
 * Sabit URL kullanılmaz - her zaman gelen request'in host bilgisi kullanılır.
 * Reverse proxy (nginx, cloudflare) arkasında x-forwarded-* header'ları dikkate alınır.
 */
function getBaseUrl(req: Request): string {
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host = req.get('host') || req.get('x-forwarded-host') || `localhost:${process.env.PORT || 3000}`;
  return `${protocol}://${host}`;
}

/**
 * Request'e göre dinamik callback URL oluşturur (Auth0 redirect_uri için)
 */
function getCallbackUrl(req: Request): string {
  const baseUrl = getBaseUrl(req);
  return `${baseUrl}/auth0/callback`;
}

/**
 * Token endpoint URL'ini oluşturur (redirect_url parametresiyle)
 */
function buildTokenEndpoint(redirectUrl?: string): string {
  return redirectUrl 
    ? `/auth0/token?redirect_url=${encodeURIComponent(redirectUrl)}`
    : '/auth0/token';
}

/**
 * Auth0 `sub` alanından provider'ı tespit eder.
 * Örn: "google-oauth2|xxxx", "auth0|xxxx"
 */
function isGoogleProvider(auth0Sub: string, googleConnection: string): boolean {
  if (!auth0Sub) return false;
  if (auth0Sub.startsWith('google-oauth2|')) return true;
  return auth0Sub.startsWith(`${googleConnection}|`);
}

/**
 * Auth0 yapılandırmasını doğrular
 */
function getAuth0Config() {
  const auth0Domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const databaseConnection = process.env.AUTH0_DATABASE_CONNECTION || 'Username-Password-Authentication';
  const audience = process.env.AUTH0_AUDIENCE;
  const googleConnection = process.env.AUTH0_GOOGLE_CONNECTION || 'google-oauth2';

  const isValid = auth0Domain && clientId;

  return {
    auth0Domain,
    clientId,
    clientSecret,
    databaseConnection,
    audience,
    googleConnection,
    isValid
  };
}

/**
 * Auth0 API hatalarını işler
 */
function handleAuth0ApiError(axiosError: any, auth0Domain: string, res: Response, context: string) {
  logger.error({
    message: `Auth0 API isteği başarısız (${context})`,
    error: axiosError?.message || String(axiosError),
    errorCode: axiosError?.code,
    response: axiosError?.response?.data
  });

  // Network hataları
  if (axiosError?.code === 'ECONNABORTED' || axiosError?.message?.includes('timeout')) {
    return res.status(504).json({
      success: false,
      error: 'Auth0 API timeout',
      message: 'Auth0 API\'ye bağlanırken zaman aşımı oluştu.'
    });
  }
  
  if (axiosError?.code === 'ENOTFOUND' || axiosError?.code === 'EAI_AGAIN' || axiosError?.message?.includes('getaddrinfo')) {
    return res.status(502).json({
      success: false,
      error: 'Auth0 domain bulunamadı',
      message: `Auth0 domain'e erişilemiyor: ${auth0Domain}`
    });
  }

  if (axiosError?.code === 'CERT_HAS_EXPIRED' || axiosError?.message?.includes('certificate') || axiosError?.message?.includes('SSL')) {
    return res.status(502).json({
      success: false,
      error: 'SSL/TLS hatası',
      message: 'Auth0 API\'ye bağlanırken SSL hatası oluştu.'
    });
  }

  // Auth0 response hataları
  if (axiosError?.response?.data) {
    const errorData = axiosError.response.data;
    const errorMessage = errorData.error_description || errorData.error || errorData.message || 'Bilinmeyen hata';
    
    // Email zaten kayıtlı hatası
    if (errorData.code === 'user_exists' || errorMessage.toLowerCase().includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: 'Email zaten kayıtlı',
        message: 'Bu email adresi zaten kullanılıyor.'
      });
    }

    return res.status(axiosError.response.status || 400).json({
      success: false,
      error: context,
      message: errorMessage
    });
  }

  return res.status(500).json({
    success: false,
    error: 'Auth0 API bağlantı hatası',
    message: axiosError?.message || 'Auth0 API\'ye bağlanılamadı'
  });
}

/**
 * Kullanıcıyı Auth0 ID'ye göre bulur veya oluşturur
 */
async function findOrCreateUser(
  auth0Sub: string,
  auth0Email: string,
  auth0Name: string | null | undefined,
  emailVerified: boolean
) {
  let user = await userRepo.findByAuth0Id(auth0Sub);
  
  if (!user) {
    try {
      user = await userRepo.createWithAuth0(auth0Sub, auth0Email, auth0Name ?? undefined, emailVerified);
      logger.info({
        message: 'Auth0 kullanıcısı oluşturuldu',
        auth0Id: auth0Sub,
        email: auth0Email,
        userId: user.id
      });
    } catch (error: any) {
      // Email zaten varsa mevcut kullanıcıyı güncelle
      if (error.name === 'EmailAlreadyExistsError' || error.code === 'P2002') {
        const existingUser = await userRepo.findByEmail(auth0Email);
        if (existingUser) {
          const { getPrisma } = await import('../../infrastructure/repositories/prisma.client');
          const prisma = getPrisma();
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { auth0Id: auth0Sub, emailVerified }
          });
          user = await userRepo.findById(existingUser.id);
          logger.info({
            message: 'Mevcut kullanıcı Auth0 ID ile güncellendi',
            auth0Id: auth0Sub,
            email: auth0Email,
            userId: existingUser.id
          });
        }
      } else {
        throw error;
      }
    }
  } else if (emailVerified && !user.emailVerified) {
    // Email verified durumunu güncelle
    const { getPrisma } = await import('../../infrastructure/repositories/prisma.client');
    const prisma = getPrisma();
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, status: 'ACTIVE' }
    });
    user = await userRepo.findById(user.id);
  }

  return user;
}

/**
 * Kullanıcı için profil yoksa provider bilgileriyle oluşturur
 */
async function ensureProfileExists(userId: string, auth0Name: string | null | undefined) {
  const profile = await profileRepo.findByUserId(userId);
  
  if (!profile && auth0Name) {
    try {
      await profileRepo.create(userId, auth0Name);
      logger.info({
        message: 'Profil provider bilgileriyle oluşturuldu',
        userId,
        displayName: auth0Name
      });
    } catch (error) {
      logger.warn({
        message: 'Profil oluşturulamadı',
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

/**
 * Kullanıcı için profil ve avatar bilgilerini çeker
 */
async function getUserProfileData(userId: string, auth0Name: string | null, auth0Picture: string | null) {
  const profile = await profileRepo.findByUserId(userId);
  const fullName = profile?.displayName || auth0Name || null;

  const activeAvatar = await avatarRepo.findActiveByUserId(userId);
  let avatarUrl = resolveMediaUrl(activeAvatar?.imageUrl || null, true);

  // Avatar yoksa Auth0 picture'dan oluştur
  if (!avatarUrl && auth0Picture) {
    try {
      await avatarRepo.create(userId, auth0Picture, true);
      avatarUrl = resolveMediaUrl(auth0Picture, true);
    } catch (error) {
      avatarUrl = auth0Picture;
    }
  } else if (!avatarUrl) {
    avatarUrl = auth0Picture || null;
  }

  return { fullName, avatarUrl };
}

/**
 * Backend token'ları oluşturur ve device tracking yapar
 */
async function generateBackendTokens(user: any, req: Request) {
  const backendToken = authService.generateToken(user);
  const backendRefreshToken = authService.generateRefreshToken(user);

  // Device tracking (async, non-blocking)
  const userAgent = req.headers['user-agent'] || '';
  const ipAddress = (req.ip || req.socket.remoteAddress || null) as string | null;
  
  authService.trackDevice(user.id, userAgent, ipAddress).catch((error) => {
    logger.error({
      message: 'Device tracking failed',
      userId: user.id,
      error: error instanceof Error ? error.message : String(error)
    });
  });

  return { backendToken, backendRefreshToken };
}

/**
 * Auth response'u oluşturur (/auth/login formatıyla uyumlu)
 */
function buildAuthResponse(
  userId: string,
  email: string,
  fullName: string | null,
  avatarUrl: string | null,
  token: string,
  refreshToken: string
) {
  return {
    id: userId,
    fullName,
    email,
    avatar: avatarUrl,
    token,
    refreshToken
  };
}

/**
 * Expo deep link redirect URL'i oluşturur
 */
function buildExpoRedirectUrl(
  redirectUrl: string,
  token: string,
  refreshToken: string,
  userId: string,
  email: string,
  fullName: string | null,
  avatarUrl: string | null
): string {
  const params = new URLSearchParams();
  params.set('token', token);
  params.set('refreshToken', refreshToken);
  params.set('userId', userId);
  params.set('email', email);
  if (fullName) params.set('fullName', fullName);
  if (avatarUrl) params.set('avatar', avatarUrl);

  // URL formatına göre işle
  if (redirectUrl.startsWith('exp://') || redirectUrl.startsWith('http://') || redirectUrl.startsWith('https://')) {
    const url = new URL(redirectUrl);
    params.forEach((value, key) => url.searchParams.set(key, value));
    return url.toString();
  } else {
    // Custom scheme (tipbox://, myapp://, vb.)
    const separator = redirectUrl.includes('?') ? '&' : '?';
    return `${redirectUrl}${separator}${params.toString()}`;
  }
}

/**
 * Auth0'dan token alır (password grant)
 */
async function getAuth0Token(email: string, password: string, config: ReturnType<typeof getAuth0Config>) {
  const tokenUrl = `${config.auth0Domain}/oauth/token`;
  
  const body = new URLSearchParams();
  body.append('grant_type', 'password');
  body.append('username', email);
  body.append('password', password);
  body.append('client_id', config.clientId!);
  body.append('connection', config.databaseConnection);
  body.append('scope', 'openid profile email');
  
  if (config.clientSecret) body.append('client_secret', config.clientSecret);
  if (config.audience) body.append('audience', config.audience);

  const response = await axios.post(tokenUrl, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 30000,
    validateStatus: (status) => status < 500
  });
  logger.info({message: 'Auth0 token response', data: JSON.stringify(response.data)});

  return response;
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * Ana sayfa - Login'e yönlendir
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const redirectUrl = req.query.redirect_url as string | undefined;
  const tokenEndpoint = buildTokenEndpoint(redirectUrl);
  const callbackUrl = getCallbackUrl(req);

  logger.info({
    message: 'Auth0 login başlatılıyor',
    host: req.get('host'),
    callbackUrl,
    tokenEndpoint
  });

  if (req.oidc?.isAuthenticated()) {
    return res.redirect(tokenEndpoint);
  }

  if (res.oidc?.login) {
    return res.oidc.login({ 
      returnTo: tokenEndpoint,
      authorizationParams: {
        redirect_uri: callbackUrl // Dinamik callback URL
      }
    });
  }

  return res.status(500).json({
    success: false,
    error: 'Auth0 middleware yapılandırılmamış'
  });
}));

/**
 * Google OAuth login - Expo uygulaması için
 * Dinamik host bazlı redirect destekler
 */
router.get('/google', asyncHandler(async (req: Request, res: Response) => {
  const redirectUrl = req.query.redirect_url as string | undefined;
  const tokenEndpoint = buildTokenEndpoint(redirectUrl);
  const callbackUrl = getCallbackUrl(req);
  const config = getAuth0Config();

  logger.info({
    message: 'Google OAuth başlatılıyor',
    host: req.get('host'),
    callbackUrl,
    redirectUrl,
    tokenEndpoint
  });

  if (res.oidc?.login) {
    return res.oidc.login({
      returnTo: tokenEndpoint,
      authorizationParams: {
        redirect_uri: callbackUrl, // Dinamik callback URL
        connection: config.googleConnection,
        prompt: 'select_account',
        // Oturum açık olsa bile yeniden hesap seçimi / auth ekranını zorla
        // (farklı hesapla giriş senaryosu)
        max_age: 0
      }
    });
  }

  return res.status(500).json({
    success: false,
    error: 'Auth0 middleware yapılandırılmamış'
  });
}));

/**
 * Expo mobil için Google OAuth - Deep link destekli
 * GET /auth0/mobile/google?redirect_url=tipbox://auth/callback
 */
router.get('/mobile/google', asyncHandler(async (req: Request, res: Response) => {
  const redirectUrl = req.query.redirect_url as string;
  const baseUrl = getBaseUrl(req);
  const callbackUrl = getCallbackUrl(req);

  if (!redirectUrl) {
    return res.status(400).json({
      success: false,
      error: 'redirect_url gerekli',
      message: 'Expo deep link URL\'i (örn: tipbox://auth/callback) sağlanmalı'
    });
  }

  // Token endpoint'ine yönlendir (redirect_url parametresiyle)
  const tokenEndpoint = buildTokenEndpoint(redirectUrl);
  const config = getAuth0Config();

  logger.info({
    message: 'Mobil Google OAuth başlatılıyor',
    baseUrl,
    callbackUrl,
    redirectUrl,
    host: req.get('host')
  });

  if (res.oidc?.login) {
    return res.oidc.login({
      returnTo: tokenEndpoint,
      authorizationParams: {
        redirect_uri: callbackUrl, // Dinamik callback URL (IP bazlı)
        connection: config.googleConnection,
        prompt: 'select_account',
        // Oturum açık olsa bile yeniden hesap seçimi / auth ekranını zorla
        max_age: 0
      }
    });
  }

  return res.status(500).json({
    success: false,
    error: 'Auth0 middleware yapılandırılmamış'
  });
}));

/**
 * Email/Password ile giriş (API-based)
 */
router.post('/email', validateBody(LoginSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const config = getAuth0Config();

  if (!config.isValid) {
    return res.status(500).json({
      success: false,
      error: 'Auth0 yapılandırması eksik'
    });
  }

  try {
    const tokenResponse = await getAuth0Token(email, password, config);

    if (tokenResponse.status >= 400) {
      const errorData = tokenResponse.data || {};
      logger.warn({ message: 'Auth0 login başarısız', email, status: tokenResponse.status });
      
      return res.status(401).json({
        success: false,
        message: errorData.error_description || errorData.error || 'Geçersiz email veya şifre'
      });
    }

    const { id_token: idToken } = tokenResponse.data;

    if (!idToken) {
      return res.status(500).json({
        success: false,
        error: 'Token alınamadı'
      });
    }

    // Token decode
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.decode(idToken) as any;

    if (!decoded?.sub || !decoded?.email) {
      return res.status(500).json({
        success: false,
        error: 'Token decode hatası'
      });
    }

    // Kullanıcı oluştur/bul
    const user = await findOrCreateUser(
      decoded.sub,
      decoded.email,
      decoded.name,
      decoded.email_verified || false
    );

    if (!user) {
      return res.status(500).json({
        success: false,
        error: 'Kullanıcı bulunamadı'
      });
    }

    // Profil yoksa provider bilgileriyle oluştur
    await ensureProfileExists(user.id, decoded.name || null);

    // Email doğrulanmadıysa: doğrulama kodu gönder ve token dönme
    if (!user.emailVerified) {
      const sendResult = await authService.sendEmailVerificationCode(decoded.email || email);
      if (!sendResult.success) {
        return res.status(500).json({
          success: false,
          error: 'verification_email_send_failed',
          message: sendResult.message
        });
      }
      return res.status(403).json({
        success: true,
        requiresEmailVerification: true,
        email: decoded.email || email,
        message: 'Email adresiniz doğrulanmamış. Doğrulama kodu gönderildi.'
      });
    }

    // Profil ve token bilgilerini al
    const { fullName, avatarUrl } = await getUserProfileData(user.id, decoded.name, decoded.picture);
    const { backendToken, backendRefreshToken } = await generateBackendTokens(user, req);

    return res.json(buildAuthResponse(
      user.id,
      user.email || decoded.email,
      fullName,
      avatarUrl,
      backendToken,
      backendRefreshToken
    ));

  } catch (error: any) {
    if (error.isAxiosError) {
      return handleAuth0ApiError(error, config.auth0Domain!, res, 'login');
    }
    throw error;
  }
}));

/**
 * Email/Password ile kayıt (API-based)
 */
router.post('/register', validateBody(RegisterSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  const config = getAuth0Config();
  if (!config.isValid) {
    return res.status(500).json({
      success: false,
      error: 'Auth0 yapılandırması eksik'
    });
  }

  try {
    // Auth0'da kullanıcı oluştur
    const signupUrl = `${config.auth0Domain}/dbconnections/signup`;
    const signupBody = new URLSearchParams();
    signupBody.append('client_id', config.clientId!);
    signupBody.append('email', email);
    signupBody.append('password', password);
    signupBody.append('connection', config.databaseConnection);
    if (name) signupBody.append('name', name);
    if (config.clientSecret) signupBody.append('client_secret', config.clientSecret);

    const signupResponse = await axios.post(signupUrl, signupBody.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000,
      validateStatus: (status) => status < 500
    });

    logger.info({message: 'Auth0 signup response', data: signupResponse.data});
    if (signupResponse.status >= 400) {
      const errorData = signupResponse.data || {};
      const errorMessage = errorData.error_description || errorData.error || 'Kayıt başarısız';
      
      if (errorData.code === 'user_exists' || errorMessage.toLowerCase().includes('already exists')) {
        return res.status(409).json({
          success: false,
          error: 'Email zaten kayıtlı'
        });
      }

      return res.status(signupResponse.status).json({
        success: false,
        error: 'Kayıt başarısız',
        message: errorMessage
      });
    }

    // Kayıt sonrası otomatik login
    const tokenResponse = await getAuth0Token(email, password, config);

    if (tokenResponse.status >= 400) {
      return res.status(201).json({
        success: true,
        message: 'Kayıt başarılı. Lütfen giriş yapın.',
        requiresLogin: true
      });
    }

    const { id_token: idToken } = tokenResponse.data;
    if (!idToken) {
      return res.status(201).json({
        success: true,
        message: 'Kayıt başarılı. Lütfen giriş yapın.',
        requiresLogin: true
      });
    }

    // Token decode
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.decode(idToken) as any;

    if (!decoded?.sub || !decoded?.email) {
      return res.status(201).json({
        success: true,
        message: 'Kayıt başarılı. Lütfen giriş yapın.',
        requiresLogin: true
      });
    }

    // Kullanıcı oluştur
    const user = await findOrCreateUser(
      decoded.sub,
      decoded.email,
      decoded.name || name,
      decoded.email_verified || false
    );

    if (!user) {
      return res.status(201).json({
        success: true,
        message: 'Kayıt başarılı. Lütfen giriş yapın.',
        requiresLogin: true
      });
    }

    // Profil yoksa provider bilgileriyle oluştur
    await ensureProfileExists(user.id, decoded.name || name || null);

    // Email doğrulanmadıysa: doğrulama kodu gönder ve token dönme
    if (!user.emailVerified) {
      const sendResult = await authService.sendEmailVerificationCode(decoded.email || email);
      if (!sendResult.success) {
        return res.status(500).json({
          success: false,
          error: 'verification_email_send_failed',
          message: sendResult.message
        });
      }
      return res.status(201).json({
        success: true,
        requiresEmailVerification: true,
        email: decoded.email || email,
        message: 'Kayıt başarılı. Email doğrulama kodu gönderildi.'
      });
    }

    // Profil ve token bilgilerini al
    const { fullName, avatarUrl } = await getUserProfileData(user.id, decoded.name || name, decoded.picture);
    const { backendToken, backendRefreshToken } = await generateBackendTokens(user, req);

    
    return res.status(201).json(buildAuthResponse(
      user.id,
      user.email || decoded.email,
      fullName,
      avatarUrl,
      backendToken,
      backendRefreshToken
    ));

  } catch (error: any) {
    if (error.isAxiosError) {
      return handleAuth0ApiError(error, config.auth0Domain!, res, 'register');
    }
    throw error;
  }
}));

/**
 * Callback endpoint - Auth0 redirect'i işler
 */
router.get('/callback', asyncHandler(async (req: Request, res: Response) => {
  const redirectUrl = req.query.redirect_url as string | undefined;
  const tokenEndpoint = buildTokenEndpoint(redirectUrl);
  const callbackUrl = getCallbackUrl(req);

  logger.info({
    message: 'Auth0 callback alındı',
    host: req.get('host'),
    callbackUrl,
    isAuthenticated: req.oidc?.isAuthenticated()
  });
  
  if (req.oidc?.isAuthenticated()) {
    return res.redirect(tokenEndpoint);
  }

  // Not: Normalde bu route'u express-openid-connect callback handler'ı karşılar.
  // Buraya düşmek genelde state/cookie bulunamadığı (session kaybı) anlamına gelir.
  // Callback aşamasında yeniden login başlatmak loop üretir, bu yüzden 401 dönüyoruz.
  return res.status(401).json({
    success: false,
    error: 'session_not_found',
    message:
      'Auth0 oturumu bulunamadı (cookie/state kaybı). Uygulamadan yeniden giriş akışını başlatın. Bu devam ederse callback URL / cookie ayarlarını kontrol edin.',
    restart: {
      login: `/auth0?redirect_url=${encodeURIComponent(redirectUrl || '')}`,
      google: `/auth0/mobile/google?redirect_url=${encodeURIComponent(redirectUrl || '')}`
    }
  });
}));

/**
 * Token endpoint - JWT token'ları döndürür
 * Expo uygulaması için deep link redirect destekler
 */
router.get('/token', requiresAuth(), asyncHandler(async (req: Request, res: Response) => {
  if (!req.oidc) {
    return res.status(500).json({
      success: false,
      error: 'Auth0 middleware yapılandırılmamış'
    });
  }

  // Auth0 kullanıcı bilgilerini al
  const auth0User = req.oidc.user;
  if (!auth0User?.sub || !auth0User?.email) {
    return res.status(500).json({
      success: false,
      error: 'Kullanıcı bilgileri alınamadı'
    });
  }

  try {
    const config = getAuth0Config();

    // Kullanıcı oluştur/bul
    const user = await findOrCreateUser(
      auth0User.sub,
      auth0User.email,
      auth0User.name || null,
      auth0User.email_verified || false
    );

    if (!user) {
      return res.status(500).json({
        success: false,
        error: 'Kullanıcı bulunamadı'
      });
    }

    // Profil yoksa provider bilgileriyle oluştur
    await ensureProfileExists(user.id, auth0User.name || null);

    // Email doğrulanmadıysa: doğrulama kodu gönder ve token dönme
    if (!user.emailVerified) {
      const sendResult = await authService.sendEmailVerificationCode(auth0User.email);
      if (!sendResult.success) {
        return res.status(500).json({
          success: false,
          error: 'verification_email_send_failed',
          message: sendResult.message
        });
      }
      return res.status(403).json({
        success: true,
        requiresEmailVerification: true,
        email: auth0User.email,
        message: 'Email adresiniz doğrulanmamış. Doğrulama kodu gönderildi.'
      });
    }

    // Google ile login olduysa, session'dan gelen picture ile aktif avatar'ı değiştir
    // Not: Bu davranış kullanıcının önceki avatar seçimini override eder.
    if (auth0User.picture && isGoogleProvider(auth0User.sub, config.googleConnection)) {
      try {
        const activeAvatar = await avatarRepo.findActiveByUserId(user.id);
        const currentActiveUrl = activeAvatar?.imageUrl || null;

        // Her login'de duplicate kayıt açmamak için URL karşılaştırması yap
        if (currentActiveUrl !== auth0User.picture) {
          await avatarRepo.create(user.id, auth0User.picture, true);
          logger.info({
            message: 'Google login: aktif avatar session picture ile güncellendi',
            userId: user.id
          });
        }
      } catch (error) {
        logger.warn({
          message: 'Google login: avatar güncelleme başarısız, akış devam ediyor',
          userId: user.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Profil ve token bilgilerini al
    const { fullName, avatarUrl } = await getUserProfileData(user.id, auth0User.name, auth0User.picture);
    const { backendToken, backendRefreshToken } = await generateBackendTokens(user, req);

    // Backend token'ı request'e ekle
    req.token = backendToken;

    const response = buildAuthResponse(
      user.id,
      user.email || auth0User.email,
      fullName,
      avatarUrl,
      backendToken,
      backendRefreshToken
    );

    // Expo deep link redirect
    const redirectUrl = req.query.redirect_url as string | undefined;
    if (redirectUrl) {
      try {
        const finalUrl = buildExpoRedirectUrl(
          redirectUrl,
          backendToken,
          backendRefreshToken,
          user.id,
          user.email || auth0User.email,
          fullName,
          avatarUrl
        );
        
        logger.info({
          message: 'Expo uygulamasına redirect',
          redirectUrl: finalUrl,
          userId: user.id
        });
        
        return res.redirect(finalUrl);
      } catch (error) {
        logger.warn({ message: 'Redirect URL parse hatası, JSON döndürülüyor', error });
        return res.json(response);
      }
    }

    return res.json(response);

  } catch (error) {
    logger.error({
      message: 'Token endpoint hatası',
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({
      success: false,
      error: 'Token bilgileri alınamadı'
    });
  }
}));

/**
 * Profil bilgilerini döndürür
 */
router.get('/profile', requiresAuth(), asyncHandler(async (req: Request, res: Response) => {
  if (!req.oidc) {
    return res.status(500).json({
      success: false,
      error: 'Auth0 middleware yapılandırılmamış'
    });
  }

  return res.json({
    success: true,
    user: req.oidc.user
  });
}));

/**
 * Authentication durumunu kontrol eder
 */
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const isAuthenticated = req.oidc?.isAuthenticated() || false;
  
  return res.json({
    authenticated: isAuthenticated,
    user: isAuthenticated && req.oidc?.user ? {
      sub: req.oidc.user.sub,
      email: req.oidc.user.email,
      name: req.oidc.user.name
    } : null
  });
}));

/**
 * Logout
 */
router.get('/logout', asyncHandler(async (req: Request, res: Response) => {
  if (res.oidc?.logout) {
    return res.oidc.logout();
  }

  return res.status(500).json({
    success: false,
    error: 'Auth0 middleware yapılandırılmamış'
  });
}));

/**
 * Mobil uygulama için auth URL'lerini döndürür
 * Expo uygulaması bu URL'leri WebBrowser ile açar
 */
router.get('/mobile/urls', asyncHandler(async (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);
  const redirectUrl = req.query.redirect_url as string || '';

  return res.json({
    success: true,
    urls: {
      google: `${baseUrl}/auth0/mobile/google?redirect_url=${encodeURIComponent(redirectUrl)}`,
      login: `${baseUrl}/auth0/?redirect_url=${encodeURIComponent(redirectUrl)}`,
      logout: `${baseUrl}/auth0/logout`,
      status: `${baseUrl}/auth0/status`
    },
    baseUrl,
    host: req.get('host'),
    note: 'Bu URL\'leri Expo WebBrowser ile açın. Token\'lar redirect_url\'e parametre olarak eklenir.'
  });
}));

export default router;
