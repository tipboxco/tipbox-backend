import { Request, Response, NextFunction } from 'express';
import { getMetricsService } from './metrics.service';
import logger from '../logger/logger';

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
  const contentLength = req.headers['content-length'];
  const requestSize =
    contentLength !== undefined ? parseInt(contentLength, 10) || undefined : undefined;

  // Response tamamlandığında metrikleri kaydet
  res.on('finish', () => {
    try {
      const duration = (Date.now() - startTime) / 1000; // Saniye cinsinden
      const route = req.route?.path || req.path || req.url;
      const method = req.method;

      metricsService.recordHttpRequest(method, route, res.statusCode, duration, requestSize);

      if (res.statusCode >= 400) {
        const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
        metricsService.recordError(errorType, route, res.statusCode);
      }
    } catch (error) {
      logger.warn('Failed to record request metrics', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  next();
}
