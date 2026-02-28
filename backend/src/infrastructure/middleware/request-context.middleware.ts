import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  req: Request;
  res: Response;
  traceId: string;
}

// AsyncLocalStorage instance (singleton)
export const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Middleware to store request context in AsyncLocalStorage
 * Bu sayede tüm uygulama boyunca (service layer dahil) request'e erişebiliriz
 */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const traceId = req.traceId || 'unknown';
  
  const context: RequestContext = {
    req,
    res,
    traceId,
  };
  
  // Request context'i AsyncLocalStorage'a kaydet
  requestContext.run(context, () => {
    next();
  });
}

/**
 * Helper function to get current request context
 * Service layer'dan request'e erişmek için kullanılır
 */
export function getCurrentContext(): RequestContext | undefined {
  return requestContext.getStore();
}

/**
 * Helper to mark cache hit/miss for current request
 * CacheService tarafından otomatik çağrılır
 */
export function markCacheStatus(status: 'hit' | 'miss' | 'bypass'): void {
  const context = getCurrentContext();
  if (context) {
    context.req.cacheHit = status === 'hit' ? true : status === 'miss' ? false : undefined;
  }
}

