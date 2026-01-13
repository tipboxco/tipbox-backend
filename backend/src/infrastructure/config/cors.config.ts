import { CorsOptions } from 'cors';
import config from './index';
import logger from '../logger/logger';

export function getCorsOptions(): CorsOptions {
  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Development ve test ortamlarında HER ŞEYE izin ver
      // Bu, farklı ağlarda local backend kullanırken CORS sorunlarını önler
      // CORS_ORIGINS env variable set edilmiş olsa bile development/test'te tüm origin'lere izin verilir
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        logger.debug(`CORS: Allowing all origins in ${process.env.NODE_ENV} mode. Origin: ${origin || 'undefined'}`);
        return callback(null, true);
      }

      // BASE_URL'den origin çıkar ve otomatik olarak allowed origins'e ekle
      // Bu, farklı ağlarda backend ayağa kalktığında CORS sorunlarını önler
      if (process.env.BASE_URL) {
        try {
          const baseUrl = process.env.BASE_URL.replace(/\/$/, '');
          let baseOrigin = baseUrl;
          
          // Eğer protocol yoksa http:// ekle
          if (!baseOrigin.match(/^https?:\/\//)) {
            baseOrigin = `http://${baseOrigin}`;
          }
          
          // URL parse et
          const url = new URL(baseOrigin);
          const baseOriginClean = `${url.protocol}//${url.host}`;
          
          if (origin === baseOriginClean || origin === baseUrl) {
            logger.debug(`CORS: Allowed BASE_URL origin: ${origin}`);
            return callback(null, true);
          }
        } catch (error) {
          // BASE_URL parse edilemezse devam et
          logger.debug(`CORS: Could not parse BASE_URL: ${process.env.BASE_URL}`);
        }
      }

      // Production'da config'deki origin'leri kontrol et
      // Origin yoksa (same-origin request, Postman, curl, mobile app vb.) izin ver
      if (!origin) {
        return callback(null, true);
      }

      const allowedOrigins = config.corsOrigins;

      // Önce string exact match kontrolü
      for (const allowedOrigin of allowedOrigins) {
        if (typeof allowedOrigin === 'string') {
          if (origin === allowedOrigin) {
            logger.debug(`CORS: Allowed exact match: ${origin}`);
            return callback(null, true);
          }
        }
      }

      // Sonra regex pattern kontrolü (local network IP'leri için)
      for (const allowedOrigin of allowedOrigins) {
        if (allowedOrigin instanceof RegExp) {
          if (allowedOrigin.test(origin)) {
            logger.debug(`CORS: Allowed regex match: ${origin}`);
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
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400, // 24 saat pre-flight cache
    optionsSuccessStatus: 204, // OPTIONS request için 204 No Content döndür
  };
}


