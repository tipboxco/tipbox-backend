import { Request, Response, NextFunction } from 'express';
import { getMetricsService } from './metrics.service';

/**
 * HTTP Request Metrics Middleware
 * 
 * Her HTTP isteği için metrikleri toplar:
 * - Request count
 * - Request duration
 * - Request size
 * - Status code
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const metricsService = getMetricsService();
  const startTime = Date.now();
  const requestSize = req.headers['content-length'] 
    ? parseInt(req.headers['content-length'], 10) 
    : undefined;

  // Response tamamlandığında metrikleri kaydet
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000; // Saniye cinsinden
    const route = req.route?.path || req.path || req.url;
    const method = req.method;

    // Metrikleri kaydet
    metricsService.recordHttpRequest(
      method,
      route,
      res.statusCode,
      duration,
      requestSize
    );

    // Hata durumunda error counter'ı artır
    if (res.statusCode >= 400) {
      const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
      metricsService.recordError(errorType, route, res.statusCode);
    }
  });

  next();
}

