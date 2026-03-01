import express from 'express';
import cors, { CorsOptions } from 'cors';
import helmet from 'helmet';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';
import { auth, requiresAuth } from 'express-openid-connect';

// Routers
import authRouter from './auth/auth.router';
import userRouter from './user/user.router';
import walletRouter from './wallet/wallet.router';
import transactionRouter from './transaction/transaction.router';
import feedRouter from './feed/feed.router';
import marketplaceRouter from './marketplace/marketplace.router';
import exploreRouter from './explore/explore.router';
import expertRouter from './expert/expert.router';
import inventoryRouter from './inventory/inventory.router';
import interactionRouter from './interaction/interaction.router';
import inboxRouter from './inbox/inbox.router';
import catalogRouter from './catalog/catalog.router';
import brandRouter from './brand/brand.router';
import searchRouter from './search/search.router';
import dashboardRouter from './dashboard/dashboard.router';
import postRouter from './post/post.router';
import eventRouter from './event/event.router';
import collectionsRouter from './collections/collections.router';
import cacheRouter from './cache/cache.router';
import notificationRouter from './notification/notification.router';
import newsRouter from './news/news.router';
import syncReceiverRouter from './sync-receiver/sync-receiver.router';
import auth0Router from './auth0/auth0.router';
import cannyRouter from './canny/canny.router';
import surveyRouter from './survey/survey.router';
import thirdwebWebhookRouter from './thirdweb-webhook/thirdweb-webhook.router';
import alchemyWebhookRouter from './alchemy-webhook/alchemy-webhook.router';
import subscriptionRouter from './subscription/subscription.router';
import seedRouter from './seed/seed.router';
import adminRouter from './admin/admin.router';
import gamificationRouter from './gamification/gamification.router';

// Middleware
import { authMiddleware } from './auth/auth.middleware';
import { requestLogger } from '../infrastructure/logger/request-logger.middleware';
import { errorHandler } from '../infrastructure/logger/error-handler.middleware';
import { requestTimingMiddleware } from '../infrastructure/middleware/request-timing.middleware';
import { requestContextMiddleware } from '../infrastructure/middleware/request-context.middleware';
import { bigIntSerializerMiddleware } from '../infrastructure/middleware/bigint-serializer.middleware';
import { metricsMiddleware } from '../infrastructure/metrics/metrics.middleware';
import { globalRateLimiter } from '../infrastructure/middleware/rate-limit.middleware';
import { csrfProtection } from '../infrastructure/middleware/csrf.middleware';
import { asyncHandler } from '../infrastructure/errors/async-handler';

// Services & Config
import { getMetricsService } from '../infrastructure/metrics/metrics.service';
import { checkSystemHealth, checkReadiness, checkLiveness } from '../infrastructure/health/health-checks';
import { getCorsOptions } from '../infrastructure/config/cors.config';
import { getSwaggerOptions, getSwaggerServers, swaggerAuthHelperJs } from '../infrastructure/config/swagger.config';
import { getPublicMediaBaseUrl } from '../infrastructure/config/media.config';
import config from '../infrastructure/config';
import logger from '../infrastructure/logger/logger';

const app = express();

// Reverse proxy (nginx) arkasında doğru host/protocol ve cookie davranışı için
// (x-forwarded-* header'larını dikkate alır)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Swagger UI için CSP gevşetme
app.use((req, res, next) => {
  if (req.path.startsWith('/api-docs')) {
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https:; connect-src 'self' http: https:;"
    );
  }
  // Dashboard için CSP gevşetme
  if (req.path === '/' || req.path.startsWith('/dashboard')) {
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline' 'unsafe-eval'; script-src-attr 'unsafe-inline'; img-src 'self' data: https://tipbox.co https://cdnjs.cloudflare.com; connect-src 'self' http: https:; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;"
    );
  }
  next();
});

// CORS
app.use(cors(getCorsOptions()));

// Webhook route'ları için CORS: gelen webhook isteklerine izin ver (Alchemy, Thirdweb vb.)
const webhookCorsOptions: CorsOptions = {
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Alchemy-Signature', 'X-Webhook-Signature', 'X-Webhook-Timestamp', 'X-Engine-Signature', 'X-Engine-Timestamp'],
  credentials: false,
  optionsSuccessStatus: 204,
};

// Webhook endpoint'leri (raw body gerekir - body parser'dan önce mount edilir)
app.use('/api/webhooks/alchemy', cors(webhookCorsOptions), alchemyWebhookRouter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Auth0 middleware (opsiyonel - sadece gerekli env değişkenleri varsa)
const issuerBaseURL = process.env.ISSUER_BASE_URL;
const clientID = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const secret = process.env.SECRET;
const baseURL = process.env.BASE_URL || 'http://localhost:3000';

if (issuerBaseURL && clientID && secret && !issuerBaseURL.includes('{yourDomain}') && !clientID.includes('{yourClientId}') && secret !== 'LONG_RANDOM_STRING') {
  /**
   * Request header'larından dinamik base URL oluşturur (Auth0 callback için).
   * Cloudflared httpHostHeader ile orijinal host'u ilettiğinde Host doğru gelir.
   * x-forwarded-proto yoksa, production domain'lerde https varsayılır.
   */
  function getDynamicBaseUrl(req: express.Request): string {
    let protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    const host = req.get('host') || req.get('x-forwarded-host') || `localhost:${process.env.PORT || 3000}`;
    // Cloudflared bazen x-forwarded-proto iletmez; production domain'de https varsay
    if (protocol === 'http' && host && !host.startsWith('localhost') && !host.match(/^\d+\.\d+\.\d+\.\d+/)) {
      protocol = 'https';
    }
    return `${protocol}://${host}`;
  }

  const auth0Config: Record<string, unknown> = {
    authRequired: false,
    auth0Logout: true,
    // baseURL string olmalı (express-openid-connect gereksinimi)
    // Login endpoint'lerinde redirect_uri request'ten dinamik olarak override edilecek
    baseURL: baseURL,
    clientID: clientID,
    issuerBaseURL: issuerBaseURL,
    secret: secret,
    // Issuer discovery ve token istekleri için timeout (ms). Varsayılan 5000; yavaş ağ/VPN için artırılabilir.
    httpTimeout: Number(process.env.AUTH0_HTTP_TIMEOUT_MS) || 15000,
    // Authorization Code Flow için clientSecret gerekli (id_token almak için)
    ...(clientSecret && { clientSecret: clientSecret }),
    // ID Token almak için gerekli parametreler
    authorizationParams: {
      response_type: 'code', // Authorization Code Flow
      scope: 'openid profile email', // openid scope'u mutlaka olmalı
      response_mode: 'query' // veya 'form_post' (daha güvenli)
      // PKCE parametrelerini eklemiyoruz (confidential client olduğumuz için client_secret kullanıyoruz)
      // code_challenge ve code_challenge_method gönderilmediği için PKCE kullanılmayacak
    } as Record<string, string>,
    routes: {
      // Callback route'u custom handler ile handle edilecek (request header'ından dinamik redirectUri)
      callback: false,
      postLogoutRedirect: '/auth0/token' // Callback sonrasında token endpoint'ine yönlendir
    },
    // Cookie ayarları - farklı domain'ler arasında çalışması için
    session: {
      // Cookie'yi tüm domain'ler için geçerli yap (sameSite: 'none' ve secure: true gerekli)
      cookie: {
        sameSite: 'Lax', // 'None' için secure: true gerekli (HTTPS)
        secure: process.env.NODE_ENV === 'production', // Production'da HTTPS gerekli
        httpOnly: true,
        // Domain belirtilmezse, cookie mevcut domain için set edilir
        // path: '/' - default
      }
    },
    // Login state oluşturulurken dinamik redirect_uri ayarla
    getLoginState: (req: express.Request, options: Record<string, unknown> & { authorizationParams?: Record<string, unknown> }) => {
      const dynamicBaseUrl = getDynamicBaseUrl(req);
      const dynamicCallbackUrl = `${dynamicBaseUrl}/auth0/callback`;
      
      logger.info({
        message: 'Auth0 login state oluşturuluyor',
        originalBaseUrl: baseURL,
        dynamicBaseUrl,
        dynamicCallbackUrl,
        host: req.get('host'),
        xForwardedHost: req.get('x-forwarded-host'),
        protocol: req.protocol,
        xForwardedProto: req.get('x-forwarded-proto')
      });

      return {
        ...options,
        authorizationParams: {
          ...options.authorizationParams,
          redirect_uri: dynamicCallbackUrl
        }
      };
    },
    // Callback sonrasında session'ı döndür
    afterCallback: async (req: express.Request, res: express.Response, session: Record<string, unknown>) => {
      return session;
    }
  };
  
  app.use(auth(auth0Config));

  // Custom callback handler: Cloudflared/nginx arkasında Host localhost olarak geldiği için
  // redirectUri'yi request header'larından (x-forwarded-host, x-forwarded-proto) oluştur
  app.get('/auth0/callback', express.urlencoded({ extended: false }), asyncHandler(async (req: express.Request, res: express.Response) => {
    const redirectUri = getDynamicBaseUrl(req) + '/auth0/callback';
    logger.info({
      message: 'Auth0 callback - dinamik redirectUri kullanılıyor',
      redirectUri,
      host: req.get('host'),
      xForwardedHost: req.get('x-forwarded-host'),
      xForwardedProto: req.get('x-forwarded-proto')
    });
    res.oidc?.callback({ redirectUri });
  }));
  app.post('/auth0/callback', express.urlencoded({ extended: false }), asyncHandler(async (req: express.Request, res: express.Response) => {
    const redirectUri = getDynamicBaseUrl(req) + '/auth0/callback';
    res.oidc?.callback({ redirectUri });
  }));

  // Callback URL'ini hesapla ve log'la
  logger.info({ 
    message: 'Auth0 middleware initialized',
    baseURL: baseURL,
    hasClientSecret: !!clientSecret,
    responseType: (auth0Config.authorizationParams as Record<string, unknown> | undefined)?.response_type,
    scope: (auth0Config.authorizationParams as Record<string, unknown> | undefined)?.scope,
    note: 'Callback endpoint manuel olarak handle ediliyor (request\'ten host bilgisi kullanılıyor). Auth0 Dashboard\'da tüm olası callback URL\'lerini ekleyin.'
  });
} else {
  logger.warn({ message: 'Auth0 middleware skipped - missing or invalid configuration' });
}

// Request middleware
app.use(requestContextMiddleware);
app.use(requestTimingMiddleware);
app.use(requestLogger);
app.use(metricsMiddleware);
app.use(bigIntSerializerMiddleware);

// Global rate limiting (DoS korunmasi)
app.use(globalRateLimiter);

// Static files
const socketMessagingUiPath = path.resolve(process.cwd(), 'DmMessagingUI');
app.use('/Socket', express.static(socketMessagingUiPath));

// Health check endpoints
app.get('/health', async (req, res) => {
  try {
    const health = await checkSystemHealth();
    const statusCode = health.status === 'error' ? 503 : 200;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      message: 'Health check failed',
    });
  }
});

app.get('/ready', async (req, res) => {
  try {
    const isReady = await checkReadiness();
    res.status(isReady ? 200 : 503).json({
      ready: isReady,
      timestamp: new Date().toISOString(),
      ...(isReady ? {} : { message: 'Service not ready' }),
    });
  } catch (error) {
    logger.error('Readiness check failed', { error });
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      message: 'Readiness check failed',
    });
  }
});

app.get('/live', (req, res) => {
  const isAlive = checkLiveness();
  res.status(isAlive ? 200 : 503).json({
    alive: isAlive,
    timestamp: new Date().toISOString(),
  });
});

// API root endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Tipbox Backend API çalışıyor!',
    swagger: `${req.protocol}://${req.get('host')}/api-docs`,
    version: '1.0.0',
  });
});

// Swagger documentation
app.get('/api-docs/custom-swagger.js', (req, res) => {
  res.type('application/javascript').send(swaggerAuthHelperJs);
});

function getDynamicSwaggerOptions(req: express.Request) {
  const baseOptions = getSwaggerOptions();
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  return {
    ...baseOptions,
    definition: {
      ...baseOptions.definition,
      servers: getSwaggerServers().map(server => {
        const label = server.description?.includes('App API') ? 'App API' : 'Admin API';
        if (nodeEnv === 'development' && req.get('host')) {
          const protocol = req.protocol || 'http';
          const host = req.get('host');
          return {
            ...server,
            url: `${protocol}://${host}`,
            description: `${label} — Development (${host})`,
          };
        }
        const baseUrl = process.env.BASE_URL;
        if (baseUrl && (nodeEnv === 'test' || nodeEnv === 'production')) {
          let cleanUrl = baseUrl.replace(/\/$/, '');
          if (!cleanUrl.match(/^https?:\/\//)) cleanUrl = `http://${cleanUrl}`;
          return { ...server, url: cleanUrl, description: `${label} — ${server.description?.split(' — ')[1] || ''}` };
        }
        return server;
      }),
    },
  };
}

/**
 * Swagger spec'inde hardcoded localhost:9000 örneklerini public media base URL ile değiştirir
 */
function replaceLocalhostExamplesInSwaggerSpec(spec: Record<string, unknown>): Record<string, unknown> {
  try {
    const mediaBaseUrl = getPublicMediaBaseUrl();
    const specString = JSON.stringify(spec);
    const updatedSpecString = specString.replace(
      /http:\/\/localhost:9000/g,
      mediaBaseUrl
    );
    return JSON.parse(updatedSpecString);
  } catch (error) {
    logger.warn('Swagger spec post-processing failed, using original spec', { error });
    return spec;
  }
}

/** context: 'all' | 'app' | 'admin' — dropdown ile sadece ilgili EP'leri gösterir */
function filterSpecByContext(
  spec: Record<string, unknown>,
  context: string
): Record<string, unknown> {
  if (!spec.paths || typeof spec.paths !== 'object') return spec;
  const paths = spec.paths as Record<string, unknown>;
  let filtered: Record<string, unknown>;
  if (context === 'admin') {
    filtered = Object.fromEntries(
      Object.entries(paths).filter(([pathKey]) => pathKey.startsWith('/admin'))
    );
  } else if (context === 'app') {
    filtered = Object.fromEntries(
      Object.entries(paths).filter(([pathKey]) => !pathKey.startsWith('/admin'))
    );
  } else {
    return spec;
  }
  const usedTags = new Set<string>();
  for (const op of Object.values(filtered)) {
    if (op && typeof op === 'object') {
      for (const methodOp of Object.values(op as Record<string, unknown>)) {
        const tags = (methodOp as Record<string, unknown>)?.tags as string[] | undefined;
        if (Array.isArray(tags)) tags.forEach((t: string) => usedTags.add(t));
      }
    }
  }
  const tags = spec.tags as Array<{ name: string; description?: string }> | undefined;
  if (Array.isArray(tags)) {
    (spec as Record<string, unknown>).tags = tags.filter((t) => usedTags.has(t.name));
  }
  return { ...spec, paths: filtered };
}

function getSpecForRequest(req: express.Request): Record<string, unknown> {
  const context = (req.query.context as string) || 'app';
  const validContext = ['all', 'app', 'admin'].includes(context) ? context : 'app';
  const swaggerSpec = swaggerJSDoc(getDynamicSwaggerOptions(req));
  const processedSpec = replaceLocalhostExamplesInSwaggerSpec(swaggerSpec as Record<string, unknown>);
  return filterSpecByContext(processedSpec, validContext);
}

app.get('/api-docs/swagger.json', (req, res) => {
  const spec = getSpecForRequest(req);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(spec);
});

app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', (req, res, next) => {
  const spec = getSpecForRequest(req);
  swaggerUi.setup(spec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Tipbox API Documentation',
    customJs: '/api-docs/custom-swagger.js',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
    },
  })(req, res, next);
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const metricsService = getMetricsService();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    const metrics = await metricsService.getMetrics();
    res.end(metrics);
  } catch (err) {
    logger.error({ message: 'Error getting metrics', error: err });
    res.status(500).end(err instanceof Error ? err.message : 'Metrics error');
  }
});

// API Routes
app.use('/auth', authRouter);
app.use('/auth0', csrfProtection(), auth0Router);
app.use('/users', authMiddleware, userRouter);
app.use('/wallets', authMiddleware, walletRouter);
app.use('/transactions', authMiddleware, transactionRouter);
app.use('/feed', authMiddleware, feedRouter);
app.use('/inbox', inboxRouter);
app.use('/marketplace', marketplaceRouter);
app.use('/explore', exploreRouter);
app.use('/expert', expertRouter);
app.use('/inventory', inventoryRouter);
app.use('/catalog', catalogRouter);
app.use('/products', catalogRouter); // Backward compatibility için
app.use('/brands', brandRouter);
app.use('/search', searchRouter);
app.use('/posts', postRouter);
app.use('/events/collections', collectionsRouter);
app.use('/events', eventRouter);
app.use('/collections', collectionsRouter);
app.use('/news', newsRouter);
app.use('/interactions', interactionRouter);
app.use('/notifications', authMiddleware, notificationRouter);
app.use('/surveys', surveyRouter);
app.use('/api/cache', cacheRouter);
app.use('/api/seeds', seedRouter);
app.use('/api/sync-receiver', syncReceiverRouter);
app.use('/canny', cannyRouter);
app.use('/subscription', authMiddleware, subscriptionRouter);
app.use('/api', gamificationRouter);
app.use('/admin', adminRouter);

// Webhook routes (no auth - signature verified internally). Alchemy yukarıda body parser'dan önce mount edildi.
app.use('/api/webhooks/thirdweb', thirdwebWebhookRouter);

// Dashboard routes (must be last)
app.use('/', dashboardRouter);
app.use('/dashboard', dashboardRouter);

// Error handler (must be last)
app.use(errorHandler);

// Global error handlers
process.on('uncaughtException', (err) => {
  logger.error({ message: 'Uncaught Exception', error: err });
});

process.on('unhandledRejection', (reason) => {
  logger.error({ message: 'Unhandled Rejection', error: reason });
});

export default app;
