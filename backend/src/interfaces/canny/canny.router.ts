import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import logger from '../../infrastructure/logger/logger';
import { AuthService } from '../../application/auth/auth.service';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import { ProfilePrismaRepository } from '../../infrastructure/repositories/profile-prisma.repository';
import { UserAvatarPrismaRepository } from '../../infrastructure/repositories/user-avatar-prisma.repository';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import { User } from '../../domain/user/user.entity';

const router = Router();
const authService = new AuthService();
const userRepo = new UserPrismaRepository();
const profileRepo = new ProfilePrismaRepository();
const avatarRepo = new UserAvatarPrismaRepository();

/**
 * Request header'larından dinamik base URL oluşturur (Auth0 callback için).
 * Sabit URL kullanılmaz - her zaman gelen request'in host bilgisi kullanılır.
 * Reverse proxy arkasında x-forwarded-* header'ları dikkate alınır.
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
  return `${baseUrl}/api/auth0/callback`;
}

/**
 * Query parametresinden değer alır
 */
function getQueryParameterByName(name: string, query: Record<string, unknown>): string | null {
  const value = query[name];
  if (!value) return null;
  return decodeURIComponent(String(value));
}

/**
 * Canny SSO token oluşturur.
 * Canny dokümantasyonu: https://developers.canny.io/install/widget/sso
 * Token Canny Private SSO Key ile HS256 ile imzalanmalıdır (backend JWT_SECRET değil!).
 * Payload: id, email, name (zorunlu), avatarURL (opsiyonel ama tercih edilir).
 */
function generateCannySsoToken(user: User, avatarURL?: string | null): string {
  const privateKey = process.env.CANNY_SSO_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('CANNY_SSO_PRIVATE_KEY environment variable is required for Canny SSO');
  }

  const userData: Record<string, unknown> = {
    id: user.id,
    email: user.email || '',
    name: user.displayName || user.email || 'User',
    exp: Math.floor(Date.now() / 1000) + 300, // 5 dakika geçerlilik (redirect tek seferlik)
  };

  if (avatarURL) userData.avatarURL = avatarURL;

  return jwt.sign(userData, privateKey, { algorithm: 'HS256' });
}

/**
 * Kullanıcı avatar URL'ini alır (Auth0 getUserProfileData ile aynı mantık).
 * - Önce aktif avatar (DB), yoksa en son yüklenen avatar
 * - Auth0 session varsa picture fallback
 * - Path'leri resolveMediaUrl ile tam URL'ye çevirir
 */
async function getAvatarUrlForUser(userId: string, auth0Picture?: string | null): Promise<string | null> {
  // 1) Aktif avatar
  let activeAvatar = await avatarRepo.findActiveByUserId(userId);

  // 2) Aktif yoksa en son yüklenen avatar (isActive bayrağı yanlış olabilir)
  if (!activeAvatar) {
    const avatars = await avatarRepo.findByUserId(userId);
    activeAvatar = avatars[0] ?? null; // findByUserId zaten createdAt desc ile sıralı
  }

  let avatarUrl = resolveMediaUrl(activeAvatar?.imageUrl || null, false);

  // 3) DB'de avatar yoksa Auth0 picture (Google vb.) kullan
  if (!avatarUrl && auth0Picture) {
    avatarUrl = resolveMediaUrl(auth0Picture, false) || auth0Picture;
  }

  return avatarUrl;
}

/**
 * Canny redirect URL'i oluşturur
 */
function getRedirectURL(ssoToken: string, redirectURL: string, companyID: string): string | null {
  if (redirectURL.indexOf('https://') !== 0 || !companyID) {
    return null;
  }
  return `https://canny.io/api/redirects/sso?companyID=${encodeURIComponent(companyID)}&ssoToken=${encodeURIComponent(ssoToken)}&redirect=${encodeURIComponent(redirectURL)}`;
}

/**
 * Auth0 yapılandırmasını doğrular
 */
function getAuth0Config() {
  const auth0Domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.CLIENT_ID;
  const databaseConnection = process.env.AUTH0_DATABASE_CONNECTION || 'Username-Password-Authentication';
  const googleConnection = process.env.AUTH0_GOOGLE_CONNECTION || 'google-oauth2';

  const isValid = auth0Domain && clientId;

  return {
    auth0Domain,
    clientId,
    databaseConnection,
    googleConnection,
    isValid
  };
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
    } catch (error: unknown) {
      // Email zaten varsa mevcut kullanıcıyı güncelle
      const errObj = error as { name?: string; code?: string };
      if (errObj.name === 'EmailAlreadyExistsError' || errObj.code === 'P2002') {
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
 * Canny SSO redirect endpoint
 * Dokümantasyon: https://help.canny.io/en/articles/1961021-setting-up-a-single-sign-on-sso-redirect
 * 
 * Akış:
 * 1. Canny kullanıcıyı bu endpoint'e yönlendirir (redirect ve companyID parametreleriyle)
 * 2. Kullanıcının authenticate olduğu kontrol edilir (Auth0 session veya backend JWT)
 * 3. Eğer Auth0 ile authenticate değilse, Auth0 login'e yönlendirilir
 * 4. Eğer authenticate ise, SSO token oluşturulur ve Canny'ye redirect edilir
 * 
 * GET /canny/redirect?redirect={redirectURL}&companyID={companyID}
 */
router.get('/redirect', asyncHandler(async (req: Request, res: Response) => {
  // Query parametrelerini al
  const redirectURL = getQueryParameterByName('redirect', req.query);
  const companyID = getQueryParameterByName('companyID', req.query);

  // Validasyon: redirect URL ve companyID gerekli
  if (!redirectURL || !companyID) {
    return res.status(400).json({
      success: false,
      error: 'Eksik parametre',
      message: 'redirect ve companyID parametreleri gerekli'
    });
  }

  // Validasyon: redirect URL https:// ile başlamalı
  if (redirectURL.indexOf('https://') !== 0) {
    return res.status(400).json({
      success: false,
      error: 'Geçersiz redirect URL',
      message: 'redirect URL https:// ile başlamalı'
    });
  }

  try {
    let user = null;
    let auth0Picture: string | null = null;

    // Önce Auth0 session kontrolü yap
    if (req.oidc?.isAuthenticated() && req.oidc?.user) {
      const auth0User = req.oidc.user;
      
      if (!auth0User?.sub || !auth0User?.email) {
        // Auth0 session var ama kullanıcı bilgileri eksik
        // Auth0 login'e yönlendir (dinamik callback URL ile)
        const currentUrl = getBaseUrl(req) + req.originalUrl;
        const callbackUrl = getCallbackUrl(req);
        if (res.oidc?.login) {
          return res.oidc.login({ 
            returnTo: currentUrl,
            authorizationParams: {
              redirect_uri: callbackUrl // Dinamik callback URL
            }
          });
        }
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Auth0 kullanıcı bilgileri alınamadı'
        });
      }

      const config = getAuth0Config();

      // Auth0 picture (Google vb.) - avatar fallback için
      auth0Picture = auth0User.picture || null;

      // Kullanıcı oluştur/bul (Auth0)
      user = await findOrCreateUser(
        auth0User.sub,
        auth0User.email,
        auth0User.name || null,
        auth0User.email_verified || false
      );

      // Profil yoksa provider bilgileriyle oluştur
      if (user) {
        await ensureProfileExists(user.id, auth0User.name || null);
      }
    } 
    // Auth0 session yoksa, backend JWT token kontrolü yap
    else {
      // authMiddleware'i manuel olarak çağır
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // Token yok, Auth0 login'e yönlendir (dinamik callback URL ile)
        const currentUrl = getBaseUrl(req) + req.originalUrl;
        const callbackUrl = getCallbackUrl(req);
        if (res.oidc?.login) {
          return res.oidc.login({ 
            returnTo: currentUrl,
            authorizationParams: {
              redirect_uri: callbackUrl // Dinamik callback URL
            }
          });
        }
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Kullanıcı authenticate olmamış. Lütfen önce giriş yapın.'
        });
      }

      // authMiddleware mantığını burada uygula
      const token = authHeader.split(' ')[1];
      const { verifyJwt } = await import('../../infrastructure/auth/jwt.helper');
      const { verifyAuth0Jwt } = await import('../../infrastructure/auth/auth0.helper');
      
      // Önce backend JWT'yi dene
      const backendPayload = verifyJwt(token);
      if (backendPayload && backendPayload.id) {
        user = await userRepo.findById(backendPayload.id);
      } 
      // Backend JWT geçersizse Auth0 JWT'yi dene
      else {
        try {
          const auth0Payload = await verifyAuth0Jwt(token);
          if (auth0Payload && auth0Payload.sub) {
            user = await userRepo.findByAuth0Id(auth0Payload.sub);
          }
        } catch (error) {
          logger.warn({
            message: 'Auth0 token doğrulama sırasında hata',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    // Kullanıcı bulunamadı
    if (!user) {
      // Auth0 login'e yönlendir (dinamik callback URL ile)
      const currentUrl = getBaseUrl(req) + req.originalUrl;
      const callbackUrl = getCallbackUrl(req);
      if (res.oidc?.login) {
        return res.oidc.login({ 
          returnTo: currentUrl,
          authorizationParams: {
            redirect_uri: callbackUrl // Dinamik callback URL
          }
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Kullanıcı bulunamadı. Lütfen önce giriş yapın.'
      });
    }

    // Email doğrulanmamışsa hata döndür
    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        error: 'Email doğrulanmamış',
        message: 'Canny SSO için email adresinizin doğrulanmış olması gerekir'
      });
    }

    // Avatar URL - Auth0 picture fallback ile (Auth0 session varsa)
    const avatarURL = await getAvatarUrlForUser(user.id, auth0Picture || undefined);

    // Canny SSO token oluştur (Canny Private Key ile - backend JWT değil!)
    const ssoToken = generateCannySsoToken(user, avatarURL);

    // Canny redirect URL'i oluştur
    const cannyRedirectURL = getRedirectURL(ssoToken, redirectURL, companyID);

    if (!cannyRedirectURL) {
      return res.status(400).json({
        success: false,
        error: 'Geçersiz parametreler',
        message: 'redirect URL https:// ile başlamalı ve companyID olmalı'
      });
    }

    logger.info({
      message: 'Canny SSO redirect',
      userId: user.id,
      email: user.email,
      companyID,
      redirectURL,
      hasAvatar: !!avatarURL
    });

    // Canny'ye yönlendir
    return res.redirect(cannyRedirectURL);

  } catch (error) {
    logger.error({
      message: 'Canny redirect endpoint hatası',
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({
      success: false,
      error: 'Canny redirect oluşturulamadı',
      message: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });
  }
}));

export default router;
