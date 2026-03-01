import { Request, Response, NextFunction } from 'express';
import logger from '../logger/logger';
import { ErrorCode } from '../errors/error-codes.enum';

/**
 * Paths exempt from CSRF origin validation.
 * These are either protected by OAuth state parameter or are read-only.
 */
const EXEMPT_PATHS = new Set([
  '/callback',      // OAuth state parameter protects this
  '/google',        // Login initiation (redirect to Auth0)
  '/mobile/google', // Mobile Google OAuth initiation
  '/logout',        // Session destroy (GET only, no state mutation risk)
  '/status',        // Read-only
  '/mobile/urls',   // Read-only
  '/profile',       // Read-only (requiresAuth protected)
  '/',              // Login initiation
]);

/**
 * Safe HTTP methods that don't require CSRF protection.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection middleware for Auth0 cookie-based routes.
 *
 * JWT API routes (`/api/*`) use Bearer tokens and are inherently CSRF-safe.
 * Auth0 OAuth routes use session cookies and need defense-in-depth:
 *
 * 1. Origin/Referer header validation for state-changing requests
 * 2. SameSite=Lax cookie already blocks most cross-origin POSTs
 * 3. OAuth `state` parameter protects callback flow
 *
 * This middleware adds an extra layer by rejecting POST/PUT/DELETE
 * requests from unknown origins.
 */
export function csrfProtection(allowedOrigins?: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Safe methods don't need CSRF protection
    if (SAFE_METHODS.has(req.method)) {
      return next();
    }

    // Check exempt paths
    if (EXEMPT_PATHS.has(req.path)) {
      return next();
    }

    // Validate Origin or Referer header
    const origin = req.get('Origin');
    const referer = req.get('Referer');

    // No Origin/Referer = likely not from a browser (curl, Postman, mobile app)
    // SameSite=Lax cookie won't be sent cross-origin for POST anyway
    if (!origin && !referer) {
      return next();
    }

    // Build list of trusted origins
    const trustedOrigins = new Set<string>();

    // Add configured allowed origins
    if (allowedOrigins) {
      for (const o of allowedOrigins) {
        trustedOrigins.add(o.replace(/\/$/, ''));
      }
    }

    // Add BASE_URL origin
    if (process.env.BASE_URL) {
      try {
        const baseUrl = new URL(process.env.BASE_URL);
        trustedOrigins.add(baseUrl.origin);
      } catch {
        // Invalid BASE_URL, skip
      }
    }

    // Add request's own origin (same-origin requests)
    const host = req.get('Host');
    if (host) {
      const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
      trustedOrigins.add(`${protocol}://${host}`);
    }

    // Check Origin header
    if (origin) {
      const normalizedOrigin = origin.replace(/\/$/, '');
      if (trustedOrigins.has(normalizedOrigin)) {
        return next();
      }

      logger.warn('CSRF: Origin mismatch', {
        origin,
        path: req.path,
        method: req.method,
        trustedOrigins: [...trustedOrigins],
      });

      res.status(403).json({
        success: false,
        error: {
          code: ErrorCode.FORBIDDEN,
          message: 'Request origin not allowed.',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        },
      });
      return;
    }

    // Check Referer header as fallback
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (trustedOrigins.has(refererUrl.origin)) {
          return next();
        }
      } catch {
        // Invalid Referer URL
      }

      logger.warn('CSRF: Referer mismatch', {
        referer,
        path: req.path,
        method: req.method,
        trustedOrigins: [...trustedOrigins],
      });

      res.status(403).json({
        success: false,
        error: {
          code: ErrorCode.FORBIDDEN,
          message: 'Request origin not allowed.',
          timestamp: new Date().toISOString(),
          path: req.originalUrl,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Middleware that requires `X-Requested-With` header for AJAX-only endpoints.
 * Browser navigation and form submissions don't send this header,
 * providing defense-in-depth against CSRF for specific endpoints.
 */
export function requireAjaxHeader(req: Request, res: Response, next: NextFunction): void {
  const xRequestedWith = req.get('X-Requested-With');

  if (!xRequestedWith) {
    logger.warn('CSRF: Missing X-Requested-With header', {
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
    });

    res.status(403).json({
      success: false,
      error: {
        code: ErrorCode.FORBIDDEN,
        message: 'This endpoint requires X-Requested-With header.',
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      },
    });
    return;
  }

  next();
}
