import express from 'express';
import cors from 'cors';
import userRouter from './user/user.router';
import authRouter from './auth/auth.router';
import walletRouter from './wallet/wallet.router';
import feedRouter from './feed/feed.router';
import marketplaceRouter from './marketplace/marketplace.router';
import exploreRouter from './explore/explore.router';
import expertRouter from './expert/expert.router';
import inventoryRouter from './inventory/inventory.router';
import { authMiddleware } from './auth/auth.middleware';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';
import { requestLogger } from '../infrastructure/logger/request-logger.middleware';
import { errorHandler } from '../infrastructure/logger/error-handler.middleware';
import logger from '../infrastructure/logger/logger';
import messagingRouter from './messaging/messaging.router';
import catalogRouter from './catalog/catalog.router';
import brandRouter from './brand/brand.router';
import searchRouter from './search/search.router';
import dashboardRouter from './dashboard/dashboard.router';
import postRouter from './post/post.router';
import { getMetricsService } from '../infrastructure/metrics/metrics.service';
import { metricsMiddleware } from '../infrastructure/metrics/metrics.middleware';
import config from '../infrastructure/config';

const PORT = process.env.PORT || 3000;
const nodeEnv = config.nodeEnv;

// Ortam bazlı Swagger server URL'leri
function getSwaggerServers() {
  const baseUrl = process.env.SWAGGER_SERVER_URL || process.env.API_BASE_URL;
  
  switch (nodeEnv) {
    case 'development':
      return [
        { url: `http://localhost:${PORT}`, description: 'Local Development' }
      ];
    case 'test':
      // Test ortamı için IP veya domain
      const testUrl = baseUrl || `http://188.245.150.117:${PORT}`;
      return [
        { url: testUrl, description: 'Test Environment' },
        { url: `http://localhost:${PORT}`, description: 'Local (Fallback)' }
      ];
    case 'production':
      // Production için domain
      const prodUrl = baseUrl || 'https://api.tipbox.co';
      return [
        { url: prodUrl, description: 'Production' }
      ];
    default:
      return [
        { url: `http://localhost:${PORT}`, description: 'Local' }
      ];
  }
}

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Tipbox API',
      version: '1.0.0',
      description: 'Tipbox servisleri için API dokümantasyonu',
    },
    servers: getSwaggerServers(),
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        BaseUser: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            title: { type: 'string' },
            avatarUrl: { type: 'string', format: 'uri' },
          },
        },
        BaseStats: {
          type: 'object',
          properties: {
            likes: { type: 'number' },
            comments: { type: 'number' },
            shares: { type: 'number' },
            bookmarks: { type: 'number' },
          },
        },
        BaseProduct: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            subName: { type: 'string' },
            image: { type: 'object' },
          },
        },
        PostProduct: {
          allOf: [
            { $ref: '#/components/schemas/BaseProduct' },
          ],
        },
        BenchmarkProduct: {
          allOf: [
            { $ref: '#/components/schemas/BaseProduct' },
            {
              type: 'object',
              properties: {
                isOwned: { type: 'boolean' },
                choice: { type: 'boolean' },
              },
            },
          ],
        },
        Post: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: {
              type: 'string',
              enum: ['feed', 'benchmark', 'post', 'question', 'tipsAndTricks'],
            },
            user: { $ref: '#/components/schemas/BaseUser' },
            stats: { $ref: '#/components/schemas/BaseStats' },
            createdAt: { type: 'string', format: 'date-time' },
            product: {
              oneOf: [
                { $ref: '#/components/schemas/PostProduct' },
                { type: 'null' },
              ],
            },
            content: { type: 'string' },
            images: {
              type: 'array',
              items: { type: 'object' },
            },
          },
        },
        BenchmarkPost: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: {
              type: 'string',
              enum: ['feed', 'benchmark', 'post', 'question', 'tipsAndTricks'],
            },
            user: { $ref: '#/components/schemas/BaseUser' },
            stats: { $ref: '#/components/schemas/BaseStats' },
            createdAt: { type: 'string', format: 'date-time' },
            products: {
              type: 'array',
              items: { $ref: '#/components/schemas/BenchmarkProduct' },
            },
            content: { type: 'string' },
          },
        },
        TipsAndTricksPost: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: {
              type: 'string',
              enum: ['feed', 'benchmark', 'post', 'question', 'tipsAndTricks'],
            },
            user: { $ref: '#/components/schemas/BaseUser' },
            stats: { $ref: '#/components/schemas/BaseStats' },
            createdAt: { type: 'string', format: 'date-time' },
            product: {
              oneOf: [
                { $ref: '#/components/schemas/PostProduct' },
                { type: 'null' },
              ],
            },
            content: { type: 'string' },
            tag: { type: 'string' },
            images: {
              type: 'array',
              items: { type: 'object' },
            },
          },
        },
        FeedResponse: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                oneOf: [
                  {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['feed'] },
                      data: { $ref: '#/components/schemas/Post' },
                    },
                  },
                  {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['benchmark'] },
                      data: { $ref: '#/components/schemas/BenchmarkPost' },
                    },
                  },
                  {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['post'] },
                      data: { $ref: '#/components/schemas/Post' },
                    },
                  },
                  {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['question'] },
                      data: { $ref: '#/components/schemas/Post' },
                    },
                  },
                  {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['tipsAndTricks'] },
                      data: { $ref: '#/components/schemas/TipsAndTricksPost' },
                    },
                  },
                ],
              },
            },
            pagination: {
              type: 'object',
              properties: {
                cursor: { type: 'string' },
                hasMore: { type: 'boolean' },
                limit: { type: 'number' },
              },
            },
          },
        },
        ExpertRequestMediaResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            mediaUrl: { type: 'string', format: 'uri' },
            mediaType: { type: 'string', enum: ['IMAGE', 'VIDEO'] },
            uploadedAt: { type: 'string', format: 'date-time' },
          },
        },
        ExpertRequestResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            description: { type: 'string' },
            category: { type: 'string', nullable: true },
            tipsAmount: { type: 'number' },
            status: {
              type: 'string',
              enum: ['PENDING', 'BROADCASTING', 'EXPERT_FOUND', 'ANSWERED', 'CLOSED'],
            },
            answeredAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            media: {
              type: 'array',
              items: { $ref: '#/components/schemas/ExpertRequestMediaResponse' },
            },
          },
        },
        ExpertRequestStatusResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            status: {
              type: 'string',
              enum: ['PENDING', 'BROADCASTING', 'EXPERT_FOUND', 'ANSWERED', 'CLOSED'],
            },
            description: { type: 'string' },
            category: { type: 'string', nullable: true },
            tipsAmount: { type: 'number' },
            estimatedWaitTimeMinutes: { type: 'number', nullable: true },
            expertFound: {
              type: 'object',
              nullable: true,
              properties: {
                expertUserId: { type: 'string', format: 'uuid' },
                expertName: { type: 'string' },
                expertTitle: { type: 'array', items: { type: 'string' } },
                expertAvatar: { type: 'string', format: 'uri', nullable: true },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ExpertAnswerUser: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            title: { type: 'array', items: { type: 'string' } },
            avatar: { type: 'string', format: 'uri', nullable: true },
          },
        },
        ExpertAnswerResponse: {
          type: 'object',
          properties: {
            question: {
              type: 'object',
              properties: {
                description: { type: 'string' },
              },
            },
            answer: {
              type: 'object',
              properties: {
                user: { $ref: '#/components/schemas/ExpertAnswerUser' },
                content: { type: 'string' },
              },
            },
          },
        },
        InventoryListItemResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            brand: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                model: { type: 'string' },
                specs: { type: 'string' },
              },
            },
            image: { type: 'string', format: 'uri', nullable: true },
            reviews: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  rating: { type: 'number', minimum: 0, maximum: 5 },
                },
              },
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        InventoryItemResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            productId: { type: 'string', format: 'uuid' },
            hasOwned: { type: 'boolean' },
            experienceSummary: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            product: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                brand: { type: 'string', nullable: true },
                description: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    './src/interfaces/**/*.ts', // TypeScript dosyaları (development ve build öncesi)
    './dist/interfaces/**/*.js', // Compiled JavaScript dosyaları (production)
    './src/interfaces/**/*.router.ts', // Router dosyaları (explicit)
  ],
};

// Swagger spec'i her seferinde dinamik olarak oluştur (cache sorunlarını önlemek için)
function getSwaggerSpec() {
  return swaggerJSDoc(swaggerOptions);
}

const app = express();

// CORS configuration - Config modülünden ortam bazlı değerleri al
const corsOptions = {
  origin: config.corsOrigins,
  credentials: true,
  methods: config.corsMethods,
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(express.json());

// Request logger middleware
app.use(requestLogger);

// Prometheus metrics middleware
app.use(metricsMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API root endpoint (dashboard'dan önce)
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Tipbox Backend API çalışıyor!',
    swagger: 'http://localhost:3000/api-docs',
    version: '1.0.0',
    endpoints: {
      'GET /health': 'Health check endpoint',
      'GET /api-docs': 'Swagger API dokümantasyonu',
      'GET /metrics': 'Prometheus metrics endpoint',
      'POST /auth/login': 'Kullanıcı girişi',
      'GET /users': 'Kullanıcı listesi',
      'GET /wallets': 'Cüzdan bilgileri'
    }
  });
});

// Prometheus metrics endpoint
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

// Swagger JSON endpoint (Swagger UI middleware'lerinden önce tanımlanmalı)
app.get('/api-docs/swagger.json', (req, res) => {
  // Request'ten dinamik olarak server URL'lerini güncelle
  const dynamicSwaggerOptions = {
    ...swaggerOptions,
    definition: {
      ...swaggerOptions.definition,
      servers: getSwaggerServers().map(server => {
        // Eğer localhost ise ve request'ten host bilgisi varsa, onu kullan
        if (server.url.includes('localhost') && req.get('host')) {
          const protocol = req.protocol || 'http';
          return { ...server, url: `${protocol}://${req.get('host')}` };
        }
        return server;
      })
    }
  };
  
  const swaggerSpec = swaggerJSDoc(dynamicSwaggerOptions);
  // Cache'i devre dışı bırak (her zaman fresh spec için)
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(swaggerSpec);
});

app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', (req, res, next) => {
  // Request'ten dinamik olarak server URL'lerini güncelle
  const dynamicSwaggerOptions = {
    ...swaggerOptions,
    definition: {
      ...swaggerOptions.definition,
      servers: getSwaggerServers().map(server => {
        // Eğer localhost ise ve request'ten host bilgisi varsa, onu kullan
        if (server.url.includes('localhost') && req.get('host')) {
          const protocol = req.protocol || 'http';
          return { ...server, url: `${protocol}://${req.get('host')}` };
        }
        return server;
      })
    }
  };
  
  const swaggerSpec = swaggerJSDoc(dynamicSwaggerOptions);
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Tipbox API Documentation',
    swaggerOptions: {
      persistAuthorization: true, // Token'ı tarayıcıda sakla
      displayRequestDuration: true, // İstek süresini göster
      filter: true, // Endpoint filtreleme özelliğini etkinleştir
      showExtensions: true, // Extension'ları göster
      showCommonExtensions: true,
      tryItOutEnabled: true, // "Try it out" butonunu her zaman göster
    },
  })(req, res, next);
});
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
app.use('/brands', brandRouter);
app.use('/search', searchRouter);
app.use('/posts', postRouter);

// Dashboard endpoint - en sona eklenmeli ki diğer route'lar çalışabilsin
// Dashboard hem root'ta hem de /dashboard'da çalışabilir
app.use('/', dashboardRouter);
app.use('/dashboard', dashboardRouter);

// Error handler middleware (en sona eklenmeli)
app.use(errorHandler);

// Global error yakalayıcılar
process.on('uncaughtException', (err) => {
  logger.error({ message: 'Uncaught Exception', error: err });
});

process.on('unhandledRejection', (reason) => {
  logger.error({ message: 'Unhandled Rejection', error: reason });
});

export default app; 