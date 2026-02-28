import { Request, Response, NextFunction } from 'express';
import logger from './logger';
import { ErrorCode } from '../errors/error-codes.enum';
import { ErrorResponse } from '../errors/error-response.interface';

interface ErrorLike {
  status?: number;
  message?: string;
  code?: string;
  stack?: string;
  meta?: { target?: string[] };
}

function toErrorLike(err: unknown): ErrorLike {
  if (err instanceof Error) {
    return err as ErrorLike;
  }
  if (typeof err === 'object' && err !== null) {
    return err as ErrorLike;
  }
  return { message: String(err) };
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  const traceId = req.traceId;
  const env = process.env.NODE_ENV || 'development';

  const errObj = toErrorLike(err);

  // Custom error class'ları için status ve message
  const status = errObj.status || 500;
  let message = errObj.message || 'Internal server error';
  let code = errObj.code || ErrorCode.INTERNAL_SERVER_ERROR;

  // Prisma hataları için özel mesaj ve kod
  if (errObj.code === 'P2002') {
    code = ErrorCode.DUPLICATE_ENTRY;
    if (errObj.meta?.target?.includes('email')) {
      message = 'This email address is already registered in the system.';
      code = ErrorCode.EMAIL_ALREADY_EXISTS;
    }
  } else if (errObj.code === 'P2025') {
    code = ErrorCode.NOT_FOUND;
    message = 'Record not found.';
  } else if (errObj.code?.startsWith('P')) {
    code = ErrorCode.DATABASE_ERROR;
    message = 'A database error occurred.';
  }

  // Structured error logging
  logger.error({
    message,
    code,
    traceId,
    stack: errObj.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    body: req.body,
    status,
    timestamp: new Date().toISOString(),
    environment: env,
    userId: req.user?.id,
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
      ...(env !== 'production' && { stack: errObj.stack }),
    },
  };

  // Response zaten gönderilmişse tekrar göndermeye çalışma
  if (res.headersSent) {
    return next(err);
  }

  try {
    res.status(status).json(errorResponse);
  } catch (jsonError) {
    logger.error('Failed to send error response', {
      originalError: message,
      jsonError: jsonError instanceof Error ? jsonError.message : 'Unknown serialization error',
      traceId,
    });
    res.status(500).end();
  }
} 