import { Request, Response, NextFunction } from 'express';
import logger from './logger';
import { ErrorCode } from '../errors/error-codes.enum';
import { ErrorResponse } from '../errors/error-response.interface';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const traceId = (req as any).traceId || null;
  const env = process.env.NODE_ENV || 'development';

  // Custom error class'ları için status ve message
  const status = err.status || 500;
  let message = err.message || 'Internal server error';
  let code = err.code || ErrorCode.INTERNAL_SERVER_ERROR;

  // Prisma hataları için özel mesaj ve kod
  if (err.code === 'P2002') {
    code = ErrorCode.DUPLICATE_ENTRY;
    if (err.meta?.target?.includes('email')) {
      message = 'Sistemde kayıtlı mail adresi bulunuyor.';
      code = ErrorCode.EMAIL_ALREADY_EXISTS;
    }
  } else if (err.code === 'P2025') {
    code = ErrorCode.NOT_FOUND;
    message = 'Kayıt bulunamadı.';
  } else if (err.code?.startsWith('P')) {
    code = ErrorCode.DATABASE_ERROR;
    message = 'Veritabanı hatası oluştu.';
  }

  // Structured error logging
  logger.error({
    message,
    code,
    traceId,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    body: req.body,
    status,
    timestamp: new Date().toISOString(),
    environment: env,
    userId: (req as any).user?.id,
  });

  // Standart error response formatı
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      traceId,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      ...(env !== 'production' && { stack: err.stack }),
    },
  };

  res.status(status).json(errorResponse);
} 