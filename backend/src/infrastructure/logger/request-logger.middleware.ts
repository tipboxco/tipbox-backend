import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from './logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const traceId = uuidv4();
  req.traceId = traceId;
  res.setHeader('X-Trace-Id', traceId);

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      message: 'HTTP Request',
      traceId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      status: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
};
