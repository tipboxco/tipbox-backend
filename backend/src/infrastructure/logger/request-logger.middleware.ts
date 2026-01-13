import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from './logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  console.log('RequestLogger middleware çalıştı');
  const traceId = uuidv4();
  (req as any).traceId = traceId;
  res.setHeader('X-Trace-Id', traceId);

  const start = Date.now();

  res.on('finish', () => {
    console.log('RequestLogger res.on(finish) tetiklendi');
    const duration = Date.now() - start;
    logger.info({
      message: 'HTTP Request',
      traceId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      status: res.statusCode,
      duration,
      body: req.body,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
}; 