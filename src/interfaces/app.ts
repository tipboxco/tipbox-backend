import express from 'express';
import cors from 'cors';
import userRouter from './user/user.router';
import authRouter from './auth/auth.router';
import walletRouter from './wallet/wallet.router';
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