import express from 'express';
import cors from 'cors';
import userRouter from './user/user.router';
import authRouter from './auth/auth.router';
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
      { url: `http://localhost:${PORT}`, description: 'Local' },
      { url: 'http://app-backend-test-env.eba-iyvqk4cj.eu-central-1.elasticbeanstalk.com', description: 'Test' }
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
    './src/interfaces/**/*.ts', // local geliştirme için
    './dist/interfaces/**/*.js' // test için
  ],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [
    'http://localhost:3000',
    'http://app-backend-test-env.eba-iyvqk4cj.eu-central-1.elasticbeanstalk.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(express.json());

// Request logger middleware
app.use(requestLogger);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/auth', authRouter);
app.use('/users', authMiddleware, userRouter);

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