import { CorsOptions } from 'cors';
import config from './index';
import logger from '../logger/logger';

export function getCorsOptions(): CorsOptions {
  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Development ve test ortamlarında HER ŞEYE izin ver
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        logger.debug(`CORS: Allowing all origins in ${process.env.NODE_ENV} mode. Origin: ${origin || 'undefined'}`);
        return callback(null, true);
      }

      // Production'da config'deki origin'leri kontrol et
      if (!origin) {
        return callback(null, true);
      }

      const allowedOrigins = config.corsOrigins;

      for (const allowedOrigin of allowedOrigins) {
        if (typeof allowedOrigin === 'string') {
          if (origin === allowedOrigin) {
            return callback(null, true);
          }
        } else if (allowedOrigin instanceof RegExp) {
          if (allowedOrigin.test(origin)) {
            return callback(null, true);
          }
        }
      }

      logger.warn(`CORS: Blocked origin in production: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: config.corsMethods,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  };
}

