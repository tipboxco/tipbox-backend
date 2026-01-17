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

// Ana sayfa - Otomatik olarak login sayfasına yönlendir
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  if (req.oidc?.isAuthenticated()) {
    // Eğer giriş yapılmışsa token bilgilerini döndür
    return res.redirect('/auth0/token');
  } else {
    // Giriş yapılmamışsa login sayfasına yönlendir
    if (res.oidc?.login) {
      res.oidc.login({
        returnTo: '/auth0/token'
      });
      return;
    } else {
      return res.status(500).json({
        success: false,
        error: 'Auth0 middleware yapılandırılmamış',
        message: 'Auth0 middleware düzgün yapılandırılmamış. Lütfen .env dosyasını kontrol edin.'
      });
    }
  }
}));

// Google ile direkt giriş endpoint'i
router.get('/google', asyncHandler(async (req: Request, res: Response) => {
  if (req.oidc?.isAuthenticated()) {
    // Eğer zaten giriş yapılmışsa token bilgilerini döndür
    return res.redirect('/auth0/token');
  }

  // Google connection ile direkt giriş yap
  if (res.oidc?.login) {
    // Auth0'da Google connection adı genellikle "google-oauth2" veya "google"
    // Environment variable'dan alabilirsiniz, yoksa default "google-oauth2" kullanılır
    const googleConnection = process.env.AUTH0_GOOGLE_CONNECTION || 'google-oauth2';
    
    res.oidc.login({
      returnTo: '/auth0/token',
      authorizationParams: {
        connection: googleConnection, // Google connection'ı belirt
        prompt: 'select_account' // Google'da hesap seçim ekranını göster
      }
    });
    return;
  } else {
    return res.status(500).json({
      success: false,
      error: 'Auth0 middleware yapılandırılmamış',
      message: 'Auth0 middleware düzgün yapılandırılmamış. Lütfen .env dosyasını kontrol edin.'
    });
  }
}));

// Email ve Password ile Auth0 Database connection kullanarak API-based giriş endpoint'i
router.post('/email', validateBody(LoginSchema), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Auth0 yapılandırma değerlerini al
    const auth0Domain = process.env.AUTH0_DOMAIN;
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const databaseConnection = process.env.AUTH0_DATABASE_CONNECTION || 'Username-Password-Authentication';
    const audience = process.env.AUTH0_AUDIENCE;

    if (!auth0Domain || !clientId) {
      return res.status(500).json({
        success: false,
        error: 'Auth0 yapılandırması eksik',
        message: 'AUTH0_DOMAIN ve CLIENT_ID environment variable\'ları tanımlanmalıdır.'
      });
    }

    // Auth0 Authentication API ile email/password ile giriş yap
    // Resource Owner Password Credentials Grant flow kullanıyoruz
    const tokenUrl = `${auth0Domain}/oauth/token`;
    
    // Auth0 API form-urlencoded format bekler
    // Tüm gerekli alanları ekle
    const tokenRequestBody = new URLSearchParams();
    tokenRequestBody.append('grant_type', 'password');
    tokenRequestBody.append('username', email);
    tokenRequestBody.append('password', password);
    tokenRequestBody.append('client_id', clientId);
    tokenRequestBody.append('connection', databaseConnection);
    tokenRequestBody.append('scope', 'openid profile email');

    // Client secret varsa ekle (zorunlu değil ama önerilir)
    if (clientSecret) {
      tokenRequestBody.append('client_secret', clientSecret);
    }

    // Audience varsa ekle (opsiyonel)
    if (audience) {
      tokenRequestBody.append('audience', audience);
    }
    
    

    

    // Auth0'a token isteği gönder (axios ile)
    let tokenData: any;
    try {
      const tokenResponse = await axios.post(tokenUrl, tokenRequestBody.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000, // 30 saniye timeout
        validateStatus: (status) => status < 500, // 5xx hariç tüm status kodlarını kabul et
      });
      console.log({tokenResponse: tokenResponse.data});
      if (tokenResponse.status >= 400) {
        // Auth0 hata mesajlarını parse et
        const errorData = tokenResponse.data || {};
        logger.warn({
          message: 'Auth0 login başarısız',
          email,
          status: tokenResponse.status,
          error: errorData
        });

        let errorMessage = 'Geçersiz email veya şifre';
        if (errorData.error_description) {
          errorMessage = errorData.error_description;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }

        return res.status(401).json({
          success: false,
          message: errorMessage
        });
      }

      tokenData = tokenResponse.data;
    } catch (axiosError: any) {
      logger.error({
        message: 'Auth0 API isteği başarısız',
        error: axiosError?.message || String(axiosError),
        errorCode: axiosError?.code,
        errorName: axiosError?.name,
        url: tokenUrl,
        email,
        response: axiosError?.response?.data
      });

      // Network hatası kontrolü
      if (axiosError?.code === 'ECONNABORTED' || axiosError?.message?.includes('timeout')) {
        return res.status(504).json({
          success: false,
          error: 'Auth0 API timeout',
          message: 'Auth0 API\'ye bağlanırken zaman aşımı oluştu. Lütfen tekrar deneyin.'
        });
      }
      
      if (axiosError?.code === 'ENOTFOUND' || axiosError?.code === 'EAI_AGAIN' || axiosError?.message?.includes('getaddrinfo')) {
        return res.status(502).json({
          success: false,
          error: 'Auth0 domain bulunamadı',
          message: `Auth0 domain'e erişilemiyor: ${auth0Domain}. Lütfen AUTH0_DOMAIN değerini kontrol edin.`
        });
      }

      if (axiosError?.code === 'CERT_HAS_EXPIRED' || axiosError?.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || axiosError?.message?.includes('certificate') || axiosError?.message?.includes('SSL')) {
        return res.status(502).json({
          success: false,
          error: 'SSL/TLS hatası',
          message: 'Auth0 API\'ye bağlanırken SSL hatası oluştu.'
        });
      }

      // Auth0'dan gelen hata response'u
      if (axiosError?.response?.data) {
        const errorData = axiosError.response.data;
        let errorMessage = 'Geçersiz email veya şifre';
        if (errorData.error_description) {
          errorMessage = errorData.error_description;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        return res.status(axiosError.response.status || 401).json({
          success: false,
          message: errorMessage
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Auth0 API bağlantı hatası',
        message: axiosError?.message || 'Auth0 API\'ye bağlanılamadı'
      });
    }
    const auth0AccessToken = tokenData.access_token;
    const auth0IdToken = tokenData.id_token;

    if (!auth0IdToken) {
      return res.status(500).json({
        success: false,
        error: 'Token alınamadı',
        message: 'Auth0\'dan id_token alınamadı.'
      });
    }

    // ID Token'ı decode et (kullanıcı bilgileri için)
    const jwt = await import('jsonwebtoken');
    const decodedToken = jwt.decode(auth0IdToken) as any;

    if (!decodedToken || !decodedToken.sub || !decodedToken.email) {
      return res.status(500).json({
        success: false,
        error: 'Token decode hatası',
        message: 'Auth0 token\'ı decode edilemedi.'
      });
    }

    const auth0Sub = decodedToken.sub;
    const auth0Email = decodedToken.email;
    const auth0Name = decodedToken.name;
    const auth0Picture = decodedToken.picture;
    const emailVerified = decodedToken.email_verified || false;

    // Kullanıcıyı veritabanında kontrol et veya oluştur
    let user = await userRepo.findByAuth0Id(auth0Sub);
    
    if (!user) {
      // Kullanıcı yoksa oluştur
      try {
        user = await userRepo.createWithAuth0(
          auth0Sub,
          auth0Email,
          auth0Name,
          emailVerified
        );
        logger.info({
          message: 'Auth0 kullanıcısı veritabanına eklendi (API login)',
          auth0Id: auth0Sub,
          email: auth0Email,
          userId: user.id
        });
      } catch (error: any) {
        // Email zaten varsa (farklı bir auth0Id ile), mevcut kullanıcıyı bul
        if (error.name === 'EmailAlreadyExistsError' || error.code === 'P2002') {
          const existingUser = await userRepo.findByEmail(auth0Email);
          if (existingUser) {
            // Mevcut kullanıcıyı Auth0 ID ile güncelle
            try {
              const { getPrisma } = await import('../../infrastructure/repositories/prisma.client');
              const prisma = getPrisma();
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { auth0Id: auth0Sub, emailVerified: emailVerified }
              });
              user = await userRepo.findById(existingUser.id);
            } catch (updateError) {
              logger.error({
                message: 'Kullanıcı güncellenirken hata oluştu',
                error: updateError instanceof Error ? updateError.message : String(updateError),
                auth0Id: auth0Sub,
                email: auth0Email
              });
            }
          }
        } else {
          logger.error({
            message: 'Auth0 kullanıcısı oluşturulurken hata oluştu',
            error: error instanceof Error ? error.message : String(error),
            auth0Id: auth0Sub,
            email: auth0Email
          });
          return res.status(500).json({
            success: false,
            error: 'Kullanıcı oluşturulamadı',
            message: 'Kullanıcı kaydı sırasında bir hata oluştu.'
          });
        }
      }
    } else {
      // Kullanıcı varsa, email verified durumunu güncelle (Auth0'da verified ise)
      if (emailVerified && !user.emailVerified) {
        try {
          const { getPrisma } = await import('../../infrastructure/repositories/prisma.client');
          const prisma = getPrisma();
          await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: true }
          });
          user = await userRepo.findById(user.id);
        } catch (updateError) {
          logger.warn({
            message: 'Email verified durumu güncellenemedi',
            error: updateError instanceof Error ? updateError.message : String(updateError),
            userId: user?.id
          });
        }
      }
    }

    if (!user) {
      return res.status(500).json({
        success: false,
        error: 'Kullanıcı bulunamadı',
        message: 'Kullanıcı bilgileri alınamadı.'
      });
    }

    // user null değil, devam et
    const userId = user.id;
    const userEmail = user.email || auth0Email;

    // Profile bilgilerini çek
    const profile = await profileRepo.findByUserId(userId);
    const fullName = profile?.displayName || auth0Name || null;

    // Aktif avatar'ı çek
    const activeAvatar = await avatarRepo.findActiveByUserId(userId);
    let avatarUrl = resolveMediaUrl(activeAvatar?.imageUrl || null, true);
    
    // Eğer avatar yoksa ve Auth0'dan picture varsa, avatar oluştur
    if (!avatarUrl && auth0Picture) {
      try {
        await avatarRepo.create(userId, auth0Picture, true);
        avatarUrl = resolveMediaUrl(auth0Picture, true);
        logger.info({
          message: 'Auth0 picture avatar olarak kaydedildi',
          userId: userId,
          pictureUrl: auth0Picture
        });
      } catch (avatarError) {
        logger.warn({
          message: 'Avatar oluşturulamadı',
          error: avatarError instanceof Error ? avatarError.message : String(avatarError),
          userId: userId
        });
        avatarUrl = auth0Picture; // Fallback olarak Auth0 picture'ı kullan
      }
    } else if (!avatarUrl) {
      avatarUrl = auth0Picture || null;
    }

    // Backend JWT token oluştur (/auth/login ile aynı mantık)
    const backendToken = authService.generateToken(user);
    const backendRefreshToken = authService.generateRefreshToken(user);

    // Device tracking - User-Agent ve IP'den cihaz bilgilerini kaydet
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = (req.ip || req.socket.remoteAddress || null) as string | null;
    
    // Async olarak device tracking yap (blocking olmaz)
    authService.trackDevice(userId, userAgent, ipAddress).catch((error) => {
      // Hata durumunda log'la ama login işlemini engelleme
      logger.error({
        message: 'Device tracking failed during Auth0 API login',
        userId: userId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // /auth/login ile aynı format
    const response = {
      id: userId, // Backend user ID
      fullName: fullName,
      email: userEmail,
      avatar: avatarUrl,
      token: backendToken, // Backend JWT token
      refreshToken: backendRefreshToken // Backend refresh token
    };

    return res.json(response);
  } catch (error) {
    logger.error({
      message: 'Auth0 API login sırasında hata oluştu',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      success: false,
      error: 'Giriş yapılırken bir hata oluştu',
      message: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });
  }
}));

// Email ve Password ile Auth0 Database connection kullanarak API-based kayıt endpoint'i
router.post('/register', validateBody(RegisterSchema), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    // Auth0 yapılandırma değerlerini al
    const auth0Domain = process.env.AUTH0_DOMAIN;
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const databaseConnection = process.env.AUTH0_DATABASE_CONNECTION || 'Username-Password-Authentication';

    if (!auth0Domain || !clientId) {
      return res.status(500).json({
        success: false,
        error: 'Auth0 yapılandırması eksik',
        message: 'AUTH0_DOMAIN ve CLIENT_ID environment variable\'ları tanımlanmalıdır.'
      });
    }

    // Auth0 Database Connections Signup API
    // POST https://{AUTH0_DOMAIN}/dbconnections/signup
    const signupUrl = `${auth0Domain}/dbconnections/signup`;
    
    // Auth0 API form-urlencoded format bekler
    const signupRequestBody = new URLSearchParams();
    signupRequestBody.append('client_id', clientId);
    signupRequestBody.append('email', email);
    signupRequestBody.append('password', password);
    signupRequestBody.append('connection', databaseConnection);
    
    // Name varsa ekle (Auth0'da name alanı olarak saklanır)
    if (name) {
      signupRequestBody.append('name', name);
    }

    // Client secret varsa ekle
    if (clientSecret) {
      signupRequestBody.append('client_secret', clientSecret);
    }

    logger.debug({
      message: 'Auth0 signup isteği gönderiliyor',
      url: signupUrl,
      email,
      connection: databaseConnection,
      hasClientSecret: !!clientSecret
    });

    // Auth0'a signup isteği gönder
    let signupData: any;
    try {
      const signupResponse = await axios.post(signupUrl, signupRequestBody.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
        validateStatus: (status) => status < 500,
      });

      if (signupResponse.status >= 400) {
        const errorData = signupResponse.data || {};
        logger.warn({
          message: 'Auth0 signup başarısız',
          email,
          status: signupResponse.status,
          error: errorData
        });

        let errorMessage = 'Kayıt başarısız';
        if (errorData.error_description) {
          errorMessage = errorData.error_description;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }

        // Email zaten kayıtlı hatası
        if (errorData.code === 'user_exists' || errorMessage.toLowerCase().includes('already exists') || errorMessage.toLowerCase().includes('zaten')) {
          return res.status(409).json({
            success: false,
            error: 'Email zaten kayıtlı',
            message: 'Bu email adresi zaten kullanılıyor.'
          });
        }

        return res.status(signupResponse.status).json({
          success: false,
          error: 'Kayıt başarısız',
          message: errorMessage
        });
      }

      signupData = signupResponse.data;
    } catch (axiosError: any) {
      logger.error({
        message: 'Auth0 signup API isteği başarısız',
        error: axiosError?.message || String(axiosError),
        errorCode: axiosError?.code,
        url: signupUrl,
        email,
        response: axiosError?.response?.data
      });

      // Network hatası kontrolü
      if (axiosError?.code === 'ECONNABORTED' || axiosError?.message?.includes('timeout')) {
        return res.status(504).json({
          success: false,
          error: 'Auth0 API timeout',
          message: 'Auth0 API\'ye bağlanırken zaman aşımı oluştu. Lütfen tekrar deneyin.'
        });
      }

      if (axiosError?.code === 'ENOTFOUND' || axiosError?.code === 'EAI_AGAIN') {
        return res.status(502).json({
          success: false,
          error: 'Auth0 domain bulunamadı',
          message: `Auth0 domain'e erişilemiyor: ${auth0Domain}. Lütfen AUTH0_DOMAIN değerini kontrol edin.`
        });
      }

      // Auth0'dan gelen hata response'u
      if (axiosError?.response?.data) {
        const errorData = axiosError.response.data;
        let errorMessage = 'Kayıt başarısız';
        if (errorData.error_description) {
          errorMessage = errorData.error_description;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }

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
          error: 'Kayıt başarısız',
          message: errorMessage
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Auth0 API bağlantı hatası',
        message: axiosError?.message || 'Auth0 API\'ye bağlanılamadı'
      });
    }

    // Signup başarılı - Auth0 kullanıcısı oluşturuldu
    // Şimdi login yaparak token alalım
    const audience = process.env.AUTH0_AUDIENCE;
    const tokenUrl = `${auth0Domain}/oauth/token`;
    
    const tokenRequestBody = new URLSearchParams();
    tokenRequestBody.append('grant_type', 'password');
    tokenRequestBody.append('username', email);
    tokenRequestBody.append('password', password);
    tokenRequestBody.append('client_id', clientId);
    tokenRequestBody.append('connection', databaseConnection);
    tokenRequestBody.append('scope', 'openid profile email');

    if (clientSecret) {
      tokenRequestBody.append('client_secret', clientSecret);
    }

    if (audience) {
      tokenRequestBody.append('audience', audience);
    }

    // Kayıt sonrası otomatik login yap
    let tokenData: any;
    try {
      const tokenResponse = await axios.post(tokenUrl, tokenRequestBody.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
        validateStatus: (status) => status < 500,
      });

      if (tokenResponse.status >= 400) {
        // Signup başarılı ama login başarısız - kullanıcıya bilgi ver
        logger.warn({
          message: 'Auth0 signup başarılı ama login başarısız',
          email,
          status: tokenResponse.status,
          error: tokenResponse.data
        });

        return res.status(201).json({
          success: true,
          message: 'Kayıt başarılı. Lütfen giriş yapın.',
          requiresLogin: true
        });
      }

      tokenData = tokenResponse.data;
    } catch (loginError: any) {
      // Signup başarılı ama login hatası - kullanıcıya bilgi ver
      logger.warn({
        message: 'Auth0 signup başarılı ama login hatası',
        email,
        error: loginError?.message
      });

      return res.status(201).json({
        success: true,
        message: 'Kayıt başarılı. Lütfen giriş yapın.',
        requiresLogin: true
      });
    }

    // Login başarılı - token alındı
    const auth0AccessToken = tokenData.access_token;
    const auth0IdToken = tokenData.id_token;

    if (!auth0IdToken) {
      return res.status(500).json({
        success: false,
        error: 'Token alınamadı',
        message: 'Kayıt başarılı ancak token alınamadı. Lütfen giriş yapın.'
      });
    }

    // ID Token'ı decode et
    const jwt = await import('jsonwebtoken');
    const decodedToken = jwt.decode(auth0IdToken) as any;

    if (!decodedToken || !decodedToken.sub || !decodedToken.email) {
      return res.status(500).json({
        success: false,
        error: 'Token decode hatası',
        message: 'Auth0 token\'ı decode edilemedi.'
      });
    }

    const auth0Sub = decodedToken.sub;
    const auth0Email = decodedToken.email;
    const auth0Name = decodedToken.name || name;
    const auth0Picture = decodedToken.picture;
    const emailVerified = decodedToken.email_verified || false;

    // Kullanıcıyı veritabanında kontrol et veya oluştur
    let user = await userRepo.findByAuth0Id(auth0Sub);
    
    if (!user) {
      try {
        user = await userRepo.createWithAuth0(
          auth0Sub,
          auth0Email,
          auth0Name,
          emailVerified
        );
        logger.info({
          message: 'Auth0 kullanıcısı veritabanına eklendi (API register)',
          auth0Id: auth0Sub,
          email: auth0Email,
          userId: user.id
        });
      } catch (error: any) {
        if (error.name === 'EmailAlreadyExistsError' || error.code === 'P2002') {
          const existingUser = await userRepo.findByEmail(auth0Email);
          if (existingUser) {
            try {
              const { getPrisma } = await import('../../infrastructure/repositories/prisma.client');
              const prisma = getPrisma();
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { auth0Id: auth0Sub, emailVerified: emailVerified }
              });
              user = await userRepo.findById(existingUser.id);
            } catch (updateError) {
              logger.error({
                message: 'Kullanıcı güncellenirken hata oluştu',
                error: updateError instanceof Error ? updateError.message : String(updateError),
                auth0Id: auth0Sub,
                email: auth0Email
              });
            }
          }
        } else {
          logger.error({
            message: 'Auth0 kullanıcısı oluşturulurken hata oluştu',
            error: error instanceof Error ? error.message : String(error),
            auth0Id: auth0Sub,
            email: auth0Email
          });
          return res.status(500).json({
            success: false,
            error: 'Kullanıcı oluşturulamadı',
            message: 'Kullanıcı kaydı sırasında bir hata oluştu.'
          });
        }
      }
    }

    if (!user) {
      return res.status(500).json({
        success: false,
        error: 'Kullanıcı bulunamadı',
        message: 'Kullanıcı bilgileri alınamadı.'
      });
    }

    const userId = user.id;
    const userEmail = user.email || auth0Email;

    // Profile bilgilerini çek veya oluştur
    let profile = await profileRepo.findByUserId(userId);
    if (!profile && name) {
      // Profile yoksa oluştur
      try {
        const { getPrisma } = await import('../../infrastructure/repositories/prisma.client');
        const prisma = getPrisma();
        await prisma.profile.create({
          data: {
            userId: userId,
            displayName: name
          }
        });
        profile = await profileRepo.findByUserId(userId);
      } catch (profileError) {
        logger.warn({
          message: 'Profile oluşturulamadı',
          error: profileError instanceof Error ? profileError.message : String(profileError),
          userId: userId
        });
      }
    }
    const fullName = profile?.displayName || auth0Name || name || null;

    // Aktif avatar'ı çek
    const activeAvatar = await avatarRepo.findActiveByUserId(userId);
    let avatarUrl = resolveMediaUrl(activeAvatar?.imageUrl || null, true);
    
    // Eğer avatar yoksa ve Auth0'dan picture varsa, avatar oluştur
    if (!avatarUrl && auth0Picture) {
      try {
        await avatarRepo.create(userId, auth0Picture, true);
        avatarUrl = resolveMediaUrl(auth0Picture, true);
      } catch (avatarError) {
        logger.warn({
          message: 'Avatar oluşturulamadı',
          error: avatarError instanceof Error ? avatarError.message : String(avatarError),
          userId: userId
        });
        avatarUrl = auth0Picture;
      }
    } else if (!avatarUrl) {
      avatarUrl = auth0Picture || null;
    }

    // Backend JWT token oluştur
    const backendToken = authService.generateToken(user);
    const backendRefreshToken = authService.generateRefreshToken(user);

    // Device tracking
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = (req.ip || req.socket.remoteAddress || null) as string | null;
    
    authService.trackDevice(userId, userAgent, ipAddress).catch((error) => {
      logger.error({
        message: 'Device tracking failed during Auth0 API register',
        userId: userId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // /auth/login ile aynı format
    const response = {
      id: userId,
      fullName: fullName,
      email: userEmail,
      avatar: avatarUrl,
      token: backendToken,
      refreshToken: backendRefreshToken
    };

    return res.status(201).json(response);
  } catch (error) {
    logger.error({
      message: 'Auth0 API register sırasında hata oluştu',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      success: false,
      error: 'Kayıt yapılırken bir hata oluştu',
      message: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });
  }
}));

// API: JWT Token bilgilerini döndür - /auth/login ile aynı format
router.get('/token', requiresAuth(), asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!req.oidc) {
      return res.status(500).json({
        success: false,
        error: 'Auth0 middleware yapılandırılmamış',
        message: 'Auth0 middleware düzgün yapılandırılmamış.'
      });
    }

    // Auth0 accessToken'ı ana token olarak kullan (API çağrıları için)
    // accessToken bir obje olabilir, içinde access_token property'si var
    let accessToken: string | null = null;
    if (req.oidc?.accessToken) {
      if (typeof req.oidc.accessToken === 'string') {
        accessToken = req.oidc.accessToken;
      } else if (req.oidc.accessToken && typeof req.oidc.accessToken === 'object' && 'access_token' in req.oidc.accessToken) {
        accessToken = req.oidc.accessToken.access_token;
      }
    }

    // Eğer accessToken yoksa idToken kullan
    const idToken = req.oidc?.idToken 
      ? (typeof req.oidc.idToken === 'string' ? req.oidc.idToken : String(req.oidc.idToken))
      : null;
    
    const token = accessToken || idToken;
    
    // refreshToken da bir obje olabilir
    let refreshToken: string | null = null;
    if (req.oidc?.refreshToken) {
      if (typeof req.oidc.refreshToken === 'string') {
        refreshToken = req.oidc.refreshToken;
      } else if (req.oidc.refreshToken && typeof req.oidc.refreshToken === 'object' && 'refresh_token' in req.oidc.refreshToken) {
        refreshToken = (req.oidc.refreshToken as any).refresh_token;
      }
    }

    if (!token) {
      return res.status(500).json({
        success: false,
        error: 'Token alınamadı',
        message: 'Auth0 token bilgisi bulunamadı.'
      });
    }

    // Auth0 kullanıcı bilgilerini al
    const auth0Sub = req.oidc.user?.sub;
    const auth0Email = req.oidc.user?.email;
    const auth0Name = req.oidc.user?.name;
    const auth0Picture = req.oidc.user?.picture;
    const emailVerified = req.oidc.user?.email_verified || false;

    if (!auth0Sub || !auth0Email) {
      return res.status(500).json({
        success: false,
        error: 'Kullanıcı bilgileri alınamadı',
        message: 'Auth0 kullanıcı bilgileri eksik.'
      });
    }

    // Kullanıcıyı veritabanında kontrol et veya oluştur
    let user = await userRepo.findByAuth0Id(auth0Sub);
    
    if (!user) {
      // Kullanıcı yoksa oluştur
      try {
        user = await userRepo.createWithAuth0(
          auth0Sub,
          auth0Email,
          auth0Name,
          emailVerified
        );
        logger.info({
          message: 'Auth0 kullanıcısı veritabanına eklendi',
          auth0Id: auth0Sub,
          email: auth0Email,
          userId: user.id
        });
      } catch (error: any) {
        // Email zaten varsa (farklı bir auth0Id ile), mevcut kullanıcıyı bul
        if (error.name === 'EmailAlreadyExistsError' || error.code === 'P2002') {
          // Email ile kullanıcıyı bul
          const existingUser = await userRepo.findByEmail(auth0Email);
          if (existingUser) {
            // Mevcut kullanıcıyı Auth0 ID ile güncelle
            try {
              const updatedUser = await userRepo.update(existingUser.id, {
                email: auth0Email,
                status: 'ACTIVE'
              });
              // Auth0Id'yi güncelle (Prisma direkt kullanarak)
              const { getPrisma } = await import('../../infrastructure/repositories/prisma.client');
              const prisma = getPrisma();
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { auth0Id: auth0Sub, emailVerified: emailVerified }
              });
              user = await userRepo.findById(existingUser.id);
              logger.info({
                message: 'Mevcut kullanıcı Auth0 ID ile güncellendi',
                auth0Id: auth0Sub,
                email: auth0Email,
                userId: existingUser.id
              });
            } catch (updateError) {
              logger.error({
                message: 'Kullanıcı güncellenirken hata oluştu',
                error: updateError instanceof Error ? updateError.message : String(updateError),
                auth0Id: auth0Sub,
                email: auth0Email
              });
            }
          }
        } else {
          logger.error({
            message: 'Auth0 kullanıcısı oluşturulurken hata oluştu',
            error: error instanceof Error ? error.message : String(error),
            auth0Id: auth0Sub,
            email: auth0Email
          });
          return res.status(500).json({
            success: false,
            error: 'Kullanıcı oluşturulamadı',
            message: 'Kullanıcı kaydı sırasında bir hata oluştu.'
          });
        }
      }
      } else {
        // Kullanıcı varsa, email verified durumunu güncelle (Auth0'da verified ise)
        if (user && emailVerified && !user.emailVerified) {
          try {
            const { getPrisma } = await import('../../infrastructure/repositories/prisma.client');
            const prisma = getPrisma();
            await prisma.user.update({
              where: { id: user.id },
              data: { emailVerified: true }
            });
            user = await userRepo.findById(user.id);
          } catch (updateError) {
            logger.warn({
              message: 'Email verified durumu güncellenemedi',
              error: updateError instanceof Error ? updateError.message : String(updateError),
              userId: user?.id
            });
          }
        }
      }

    if (!user) {
      return res.status(500).json({
        success: false,
        error: 'Kullanıcı bulunamadı',
        message: 'Kullanıcı bilgileri alınamadı.'
      });
    }

    // user null değil, devam et
    const userId = user.id;
    const userEmail = user.email || auth0Email;

    // Profile bilgilerini çek
    const profile = await profileRepo.findByUserId(userId);
    const fullName = profile?.displayName || auth0Name || null;

    // Aktif avatar'ı çek
    const activeAvatar = await avatarRepo.findActiveByUserId(userId);
    let avatarUrl = resolveMediaUrl(activeAvatar?.imageUrl || null, true);
    
    // Eğer avatar yoksa ve Auth0'dan picture varsa, avatar oluştur
    if (!avatarUrl && auth0Picture) {
      try {
        await avatarRepo.create(userId, auth0Picture, true);
        avatarUrl = resolveMediaUrl(auth0Picture, true);
        logger.info({
          message: 'Auth0 picture avatar olarak kaydedildi',
          userId: userId,
          pictureUrl: auth0Picture
        });
      } catch (avatarError) {
        logger.warn({
          message: 'Avatar oluşturulamadı',
          error: avatarError instanceof Error ? avatarError.message : String(avatarError),
          userId: userId
        });
        avatarUrl = auth0Picture; // Fallback olarak Auth0 picture'ı kullan
      }
    } else if (!avatarUrl) {
      avatarUrl = auth0Picture || null;
    }

    // Backend JWT token oluştur (/auth/login ile aynı mantık)
    const backendToken = authService.generateToken(user);
    const backendRefreshToken = authService.generateRefreshToken(user);

    // Device tracking - User-Agent ve IP'den cihaz bilgilerini kaydet
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = (req.ip || req.socket.remoteAddress || null) as string | null;
    
    // Async olarak device tracking yap (blocking olmaz)
    authService.trackDevice(userId, userAgent, ipAddress).catch((error) => {
      // Hata durumunda log'la ama login işlemini engelleme
      logger.error({
        message: 'Device tracking failed during Auth0 login',
        userId: userId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // /auth/login ile aynı format
    // Backend JWT token'ı req.token'a ekle ki authMiddleware tarafından kullanılabilsin
    req.token = backendToken;

    const response = {
      id: userId, // Backend user ID
      fullName: fullName,
      email: userEmail,
      avatar: avatarUrl,
      token: backendToken, // Backend JWT token
      refreshToken: backendRefreshToken // Backend refresh token
    };

    return res.json(response);
  } catch (error) {
    logger.error({
      message: 'Token bilgileri alınırken hata oluştu',
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({
      success: false,
      error: 'Token bilgileri alınamadı',
      message: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });
  }
}));

// API: Kullanıcı profil bilgilerini döndür
router.get('/profile', requiresAuth(), asyncHandler(async (req: Request, res: Response) => {
  try {
    if (!req.oidc) {
      return res.status(500).json({
        success: false,
        error: 'Auth0 middleware yapılandırılmamış',
        message: 'Auth0 middleware düzgün yapılandırılmamış.'
      });
    }

    return res.json({
      success: true,
      user: req.oidc.user
    });
  } catch (error) {
    logger.error({
      message: 'Profil bilgileri alınırken hata oluştu',
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({
      success: false,
      error: 'Profil bilgileri alınamadı',
      message: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });
  }
}));

// API: Authentication durumunu kontrol et
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  try {
    const isAuthenticated = req.oidc?.isAuthenticated() || false;
    
    return res.json({
      authenticated: isAuthenticated,
      user: isAuthenticated && req.oidc?.user ? {
        sub: req.oidc.user.sub,
        email: req.oidc.user.email,
        name: req.oidc.user.name
      } : null
    });
  } catch (error) {
    logger.error({
      message: 'Auth durumu kontrol edilirken hata oluştu',
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({
      success: false,
      error: 'Auth durumu kontrol edilemedi',
      message: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });
  }
}));

// Logout route - Auth0 middleware otomatik olarak /logout route'unu oluşturur
// Bu route'a yönlendirme yapıldığında kullanıcı çıkış yapar
router.get('/logout', asyncHandler(async (req: Request, res: Response) => {
  try {
    if (res.oidc?.logout) {
      res.oidc.logout();
      return;
    } else {
      return res.status(500).json({
        success: false,
        error: 'Auth0 middleware yapılandırılmamış',
        message: 'Auth0 middleware düzgün yapılandırılmamış.'
      });
    }
  } catch (error) {
    logger.error({
      message: 'Logout işlemi sırasında hata oluştu',
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({
      success: false,
      error: 'Logout işlemi başarısız',
      message: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });
  }
}));

export default router;

