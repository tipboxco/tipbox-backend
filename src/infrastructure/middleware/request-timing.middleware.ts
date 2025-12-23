import { Request, Response, NextFunction } from 'express';
import logger from '../logger/logger';

/**
 * Request Timing Middleware
 * Her request'in ne kadar sürdüğünü ölçer ve log'lar
 */
export function requestTimingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const startHrTime = process.hrtime();

  // Request bilgilerini sakla
  (req as any).startTime = startTime;

  // Response header'ı hemen ekle (finish'den önce)
  const originalSend = res.send;
  res.send = function(data: any) {
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    
    // Header'ları ekle (henüz gönderilmemişse)
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${durationMs}ms`);
      
      // Cache status header'ı ekle
      const cacheHit = (req as any).cacheHit;
      if (cacheHit === true) {
        res.setHeader('X-Cache-Status', 'HIT');
      } else if (cacheHit === false) {
        res.setHeader('X-Cache-Status', 'MISS');
      } else {
        res.setHeader('X-Cache-Status', 'BYPASS');
      }
    }
    
    return originalSend.call(this, data);
  } as any;

  // Response tamamlandığında timing'i log'la
  res.on('finish', () => {
    const endTime = Date.now();
    const hrDiff = process.hrtime(startHrTime);
    
    // Milisaniye cinsinden süre
    const durationMs = endTime - startTime;
    
    // Mikrosaniye cinsinden daha hassas süre
    const durationMicroseconds = hrDiff[0] * 1e6 + hrDiff[1] / 1e3;
    const durationMsHighPrecision = durationMicroseconds / 1000;

    // Cache bilgisi varsa ekle
    const cacheHit = (req as any).cacheHit;
    const cacheSource = cacheHit ? 'cache' : 'database';

    // Log'a yaz
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: durationMs,
      durationMsHighPrecision: durationMsHighPrecision.toFixed(2),
      source: cacheSource,
      cacheHit: cacheHit || false,
      userId: (req as any).user?.id,
      traceId: (req as any).traceId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };

    // Yavaş request'leri warn olarak logla
    if (durationMs > 1000) {
      logger.warn({
        message: 'Slow request detected',
        ...logData,
      });
    } else {
      logger.info({
        message: 'Request completed',
        ...logData,
      });
    }
  });

  next();
}

/**
 * Cache Hit/Miss Marker
 * Service layer'da cache hit/miss durumunu işaretle
 */
export function markCacheHit(req: Request): void {
  (req as any).cacheHit = true;
}

export function markCacheMiss(req: Request): void {
  (req as any).cacheHit = false;
}

/**
 * Operation Timing Helper
 * Belirli bir operasyonun süresini ölçer
 */
export async function measureOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await operation();
    const duration = Date.now() - startTime;
    
    logger.debug({
      message: `Operation completed: ${operationName}`,
      duration: `${duration}ms`,
      ...metadata,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error({
      message: `Operation failed: ${operationName}`,
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : String(error),
      ...metadata,
    });
    
    throw error;
  }
}

