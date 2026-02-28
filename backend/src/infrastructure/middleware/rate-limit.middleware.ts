import rateLimit from 'express-rate-limit';
import logger from '../logger/logger';

/**
 * Auth endpoint'leri icin katı rate limiting.
 * Brute force saldirisi, hesap olusturma spam ve email spam onler.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 20, // 15 dk'da max 20 istek
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
  handler: (req, res, next, options) => {
    logger.warn({
      message: 'Auth rate limit exceeded',
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

/**
 * Login endpoint'i icin daha kati rate limiting.
 * Brute force sifre denemeleri onler.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 10, // 15 dk'da max 10 login denemesi
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 15 minutes',
  },
  handler: (req, res, next, options) => {
    logger.warn({
      message: 'Login rate limit exceeded',
      ip: req.ip,
      path: req.path,
      email: req.body?.email ? `${req.body.email.substring(0, 3)}***` : 'unknown',
    });
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

/**
 * Email dogrulama ve sifre sifirlama icin rate limiting.
 * 6 haneli kod brute force onler.
 */
export const verificationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 10, // 1 saatte max 10 deneme
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification attempts, please try again after 1 hour',
  },
  handler: (req, res, next, options) => {
    logger.warn({
      message: 'Verification rate limit exceeded',
      ip: req.ip,
      path: req.path,
    });
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

/**
 * Genel API rate limiting.
 * DoS saldirisi onler.
 */
export const globalRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 dakika
  max: 200, // 1 dk'da max 200 istek
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please slow down',
  },
  handler: (req, res, next, options) => {
    logger.warn({
      message: 'Global rate limit exceeded',
      ip: req.ip,
      path: req.path,
    });
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});
