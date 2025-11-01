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

const PORT = process.env.PORT || 3000;
const swaggerServerUrl =
  process.env.SWAGGER_SERVER_URL || `http://localhost:${PORT}`;

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Tipbox API',
      version: '1.0.0',
      description: 'Tipbox servisleri için API dokümantasyonu',
    },
    servers: [
      { url: `http://localhost:${PORT}`, description: 'Local' }
      // Elastic Beanstalk test environment disabled for developer branch
      // { url: 'http://app-backend-test-env.eba-iyvqk4cj.eu-central-1.elasticbeanstalk.com', description: 'Test' }
    ],
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
    './dist/interfaces/**/*.js', // Docker/Production için compiled JavaScript dosyaları (ÖNCELIK)
    './src/interfaces/**/*.ts', // Local development için TypeScript dosyaları
  ],
};

// Swagger spec'i her seferinde dinamik olarak oluştur (cache sorunlarını önlemek için)
function getSwaggerSpec() {
  return swaggerJSDoc(swaggerOptions);
}

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [
    'http://localhost:3000'
    // Elastic Beanstalk test environment disabled for developer branch
    // 'http://app-backend-test-env.eba-iyvqk4cj.eu-central-1.elasticbeanstalk.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(express.json());

// Request logger middleware
app.use(requestLogger);
// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Tipbox Backend API çalışıyor!',
    swagger: 'http://localhost:3000/api-docs',
    version: '1.0.0',
    endpoints: {
      'GET /api-docs': 'Swagger API dokümantasyonu',
      'POST /auth/login': 'Kullanıcı girişi',
      'GET /users': 'Kullanıcı listesi',
      'GET /wallets': 'Cüzdan bilgileri'
    }
  });
});

// Swagger JSON endpoint (Swagger UI middleware'lerinden önce tanımlanmalı)
app.get('/api-docs/swagger.json', (req, res) => {
  const swaggerSpec = getSwaggerSpec();
  // Cache'i devre dışı bırak (her zaman fresh spec için)
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(swaggerSpec);
});

app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(getSwaggerSpec(), {
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
}));
app.use('/auth', authRouter);
app.use('/users', authMiddleware, userRouter);
app.use('/wallets', authMiddleware, walletRouter);
app.use('/feed', authMiddleware, feedRouter);
app.use('/marketplace', marketplaceRouter);
app.use('/explore', exploreRouter);
app.use('/expert', expertRouter);
app.use('/inventory', inventoryRouter);

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