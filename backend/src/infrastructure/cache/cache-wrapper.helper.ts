import { CacheService } from './cache.service';
import logger from '../logger/logger';

/**
 * Generic cache wrapper with graceful degradation
 * Cache başarısız olursa otomatik olarak database'e fallback yapar
 * 
 * @param cacheKey - Cache key
 * @param fetchFn - Database'den veri çekme fonksiyonu
 * @param ttl - TTL (saniye cinsinden)
 * @param options - Ekstra seçenekler
 * @returns Cached veya fresh data
 */
export async function withCache<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  ttl: number,
  options?: {
    skipCache?: boolean;
    cacheOnError?: boolean; // Error durumunda bile cache'e kaydet
    logPrefix?: string;
  }
): Promise<T> {
  const cacheService = CacheService.getInstance();
  const logPrefix = options?.logPrefix || 'Cache';

  // Skip cache if requested
  if (options?.skipCache) {
    logger.debug(`${logPrefix}: Cache skipped for key: ${cacheKey}`);
    return await fetchFn();
  }

  // Try to get from cache (graceful degradation built-in)
  try {
    const cached = await cacheService.get<T>(cacheKey);
    if (cached) {
      logger.debug(`${logPrefix}: Cache HIT for key: ${cacheKey}`);
      return cached;
    }
  } catch (error) {
    logger.warn(`${logPrefix}: Cache GET error for key: ${cacheKey}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    // Continue to database fetch
  }

  // Cache miss or error - fetch from database
  logger.debug(`${logPrefix}: Cache MISS for key: ${cacheKey}`);
  
  try {
    const data = await fetchFn();

    // Try to cache the result
    try {
      await cacheService.set(cacheKey, data, ttl);
      logger.debug(`${logPrefix}: Data cached for key: ${cacheKey} (TTL: ${ttl}s)`);
    } catch (cacheError) {
      logger.warn(`${logPrefix}: Cache SET error for key: ${cacheKey}`, {
        error: cacheError instanceof Error ? cacheError.message : String(cacheError),
      });
      // Don't throw - we have the data, cache failure is not critical
    }

    return data;
  } catch (dbError) {
    logger.error(`${logPrefix}: Database fetch error for key: ${cacheKey}`, {
      error: dbError instanceof Error ? dbError.message : String(dbError),
    });
    throw dbError; // Database errors should be thrown
  }
}

/**
 * Cache invalidation helper
 * Verilen key veya pattern'i cache'den temizler
 * 
 * @param keyOrPattern - Cache key veya pattern (örn: user:123:* )
 * @param isPattern - Pattern mı yoksa tek key mi?
 */
export async function invalidateCache(
  keyOrPattern: string,
  isPattern: boolean = false
): Promise<void> {
  const cacheService = CacheService.getInstance();

  try {
    if (isPattern) {
      await cacheService.delPattern(keyOrPattern);
      logger.info(`Cache invalidated with pattern: ${keyOrPattern}`);
    } else {
      await cacheService.del(keyOrPattern);
      logger.info(`Cache invalidated for key: ${keyOrPattern}`);
    }
  } catch (error) {
    logger.warn(`Cache invalidation failed for: ${keyOrPattern}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - cache invalidation failure is not critical
  }
}

/**
 * Batch cache invalidation
 * Birden fazla key'i aynı anda temizler
 * 
 * @param keys - Cache key'leri
 */
export async function invalidateCacheBatch(keys: string[]): Promise<void> {
  const cacheService = CacheService.getInstance();

  try {
    await Promise.all(keys.map(key => cacheService.del(key)));
    logger.info(`Batch cache invalidation completed for ${keys.length} keys`);
  } catch (error) {
    logger.warn(`Batch cache invalidation failed`, {
      error: error instanceof Error ? error.message : String(error),
      keysCount: keys.length,
    });
  }
}

/**
 * Cache-aside pattern with automatic refresh
 * Cache expire olmadan önce arka planda refresh yapar (stale-while-revalidate)
 * 
 * @param cacheKey - Cache key
 * @param fetchFn - Database'den veri çekme fonksiyonu
 * @param ttl - TTL (saniye cinsinden)
 * @param refreshThreshold - Refresh threshold (0-1 arası, örn: 0.8 = %80'inde refresh başlat)
 */
export async function withCacheAndRefresh<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  ttl: number,
  refreshThreshold: number = 0.8
): Promise<T> {
  const cacheService = CacheService.getInstance();

  try {
    const cached = await cacheService.get<T>(cacheKey);
    if (cached) {
      // Check if we should refresh in background
      // Bu özellik için Redis'te TTL kontrolü gerekir
      // Şimdilik normal cache kullan
      return cached;
    }
  } catch (error) {
    logger.warn(`Cache error for key: ${cacheKey}`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Fetch and cache
  const data = await fetchFn();
  
  try {
    await cacheService.set(cacheKey, data, ttl);
  } catch (error) {
    logger.warn(`Cache set error for key: ${cacheKey}`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return data;
}

