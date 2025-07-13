import { Request, Response, NextFunction } from 'express';
import logger from './logger';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const traceId = (req as any).traceId || null;
  const env = process.env.NODE_ENV || 'development';

  // Custom error class'ları için status ve message
  const status = err.status || 500;
  let message = err.message || 'Internal server error';

  // Prisma hataları için özel mesaj
  if (err.code === 'P2002' && err.meta?.target?.includes('email')) {
    message = 'Sistemde kayıtlı mail adresi bulunuyor.';
  }

  logger.error({
    message,
    traceId,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    body: req.body,
    status,
  });

  res.status(status).json({
    error: {
      message,
      traceId,
      ...(env !== 'production' && { stack: err.stack }),
    },
  });
} 