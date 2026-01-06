import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

// Routers
import authRouter from './auth/auth.router';
import userRouter from './user/user.router';
import walletRouter from './wallet/wallet.router';
import feedRouter from './feed/feed.router';
import marketplaceRouter from './marketplace/marketplace.router';
import exploreRouter from './explore/explore.router';
import expertRouter from './expert/expert.router';
import inventoryRouter from './inventory/inventory.router';
import interactionRouter from './interaction/interaction.router';
import messagingRouter from './messaging/messaging.router';
import catalogRouter from './catalog/catalog.router';
import brandRouter from './brand/brand.router';
import searchRouter from './search/search.router';
import dashboardRouter from './dashboard/dashboard.router';
import postRouter from './post/post.router';
import eventRouter from './event/event.router';
import cacheRouter from './cache/cache.router';
import notificationRouter from './notification/notification.router';
import newsRouter from './news/news.router';

// Middleware
import { authMiddleware } from './auth/auth.middleware';
import { requestLogger } from '../infrastructure/logger/request-logger.middleware';
import { errorHandler } from '../infrastructure/logger/error-handler.middleware';
import { requestTimingMiddleware } from '../infrastructure/middleware/request-timing.middleware';
import { requestContextMiddleware } from '../infrastructure/middleware/request-context.middleware';
import { metricsMiddleware } from '../infrastructure/metrics/metrics.middleware';

// Services & Config
import { getMetricsService } from '../infrastructure/metrics/metrics.service';
import { checkSystemHealth, checkReadiness, checkLiveness } from '../infrastructure/health/health-checks';
import { getCorsOptions } from '../infrastructure/config/cors.config';
import { getSwaggerOptions, getSwaggerServers, swaggerAuthHelperJs } from '../infrastructure/config/swagger.config';
import { getPublicMediaBaseUrl } from '../infrastructure/config/media.config';
import config from '../infrastructure/config';
import logger from '../infrastructure/logger/logger';

const app = express();

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

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request middleware
app.use(requestContextMiddleware);
app.use(requestTimingMiddleware);
app.use(requestLogger);
app.use(metricsMiddleware);

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
  
  // BASE_URL set edilmişse, onu kullan (req.get('host') yerine)
  const baseUrl = process.env.BASE_URL;
  
  return {
    ...baseOptions,
    definition: {
      ...baseOptions.definition,
      servers: getSwaggerServers().map(server => {
        // BASE_URL set edilmişse, onu kullan
        if (baseUrl) {
          let cleanUrl = baseUrl.replace(/\/$/, '');
          // Eğer protocol yoksa http:// ekle
          if (!cleanUrl.match(/^https?:\/\//)) {
            cleanUrl = `http://${cleanUrl}`;
          }
          return { ...server, url: cleanUrl };
        }
        
        // BASE_URL yoksa ve localhost ise, request'ten host al
        if (server.url.includes('localhost') && req.get('host')) {
          const protocol = req.protocol || 'http';
          return { ...server, url: `${protocol}://${req.get('host')}` };
        }
        return server;
      }),
    },
  };
}

/**
 * Swagger spec'inde hardcoded localhost:9000 örneklerini SEED_MEDIA_BASE_URL ile değiştirir
 */
function replaceLocalhostExamplesInSwaggerSpec(spec: Record<string, unknown>): Record<string, unknown> {
  try {
    const mediaBaseUrl = getPublicMediaBaseUrl();
    const specString = JSON.stringify(spec);
    
    // localhost:9000 örneklerini SEED_MEDIA_BASE_URL ile değiştir
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

app.get('/api-docs/swagger.json', (req, res) => {
  const swaggerSpec = swaggerJSDoc(getDynamicSwaggerOptions(req));
  const processedSpec = replaceLocalhostExamplesInSwaggerSpec(swaggerSpec as Record<string, unknown>);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(processedSpec);
});

app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', (req, res, next) => {
  const swaggerSpec = swaggerJSDoc(getDynamicSwaggerOptions(req));
  const processedSpec = replaceLocalhostExamplesInSwaggerSpec(swaggerSpec as Record<string, unknown>);
  swaggerUi.setup(processedSpec, {
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
app.use('/users', authMiddleware, userRouter);
app.use('/wallets', authMiddleware, walletRouter);
app.use('/feed', authMiddleware, feedRouter);
app.use('/messages', messagingRouter);
app.use('/marketplace', marketplaceRouter);
app.use('/explore', exploreRouter);
app.use('/expert', expertRouter);
app.use('/inventory', inventoryRouter);
app.use('/catalog', catalogRouter);
app.use('/products', catalogRouter); // Product endpoints için
app.use('/brands', brandRouter);
app.use('/search', searchRouter);
app.use('/posts', postRouter);
app.use('/events', eventRouter);
app.use('/news', newsRouter);
app.use('/interactions', interactionRouter);
app.use('/notifications', authMiddleware, notificationRouter);
app.use('/api/cache', cacheRouter);

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
