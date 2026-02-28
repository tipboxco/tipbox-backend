import { CacheService } from './cache.service';
import logger from '../logger/logger';

/** Stampede lock TTL: cache TTL'in %10'u, 5-30 saniye arasında */
function getLockTTL(cacheTTL: number): number {
  return Math.min(30, Math.max(5, Math.ceil(cacheTTL * 0.1)));
}

/** Kısa bekleme (stampede protection retry için) */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generic cache wrapper with graceful degradation and stampede protection
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
    cacheOnError?: boolean;
    logPrefix?: string;
    stampede?: boolean; // Cache stampede koruması aktif et
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

  // Stampede protection: sadece bir request DB'ye gitsin, diğerleri beklesin
  if (options?.stampede) {
    const lockKey = `lock:${cacheKey}`;
    const lockTTL = getLockTTL(ttl);
    const acquired = await cacheService.setNX(lockKey, '1', lockTTL);

    if (!acquired) {
      // Başka bir request zaten fetch yapıyor - kısa bekle ve cache'i tekrar dene
      logger.debug(`${logPrefix}: Stampede lock active, waiting for key: ${cacheKey}`);
      await sleep(100);

      try {
        const retried = await cacheService.get<T>(cacheKey);
        if (retried) {
          logger.debug(`${logPrefix}: Cache HIT after stampede wait for key: ${cacheKey}`);
          return retried;
        }
      } catch {
        // Cache hala boş veya hata - fall through ve DB'den çek
      }
      logger.debug(`${logPrefix}: Stampede wait failed, fetching from DB for key: ${cacheKey}`);
    }
  }

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
    }

    return data;
  } catch (dbError) {
    logger.error(`${logPrefix}: Database fetch error for key: ${cacheKey}`, {
      error: dbError instanceof Error ? dbError.message : String(dbError),
    });
    throw dbError;
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
 * Cache-aside pattern with stale-while-revalidate.
 * Cache expire olmadan önce arka planda refresh yapar.
 * Kullanıcı her zaman hemen cevap alır (stale olsa bile).
 *
 * @param cacheKey - Cache key
 * @param fetchFn - Database'den veri çekme fonksiyonu
 * @param ttl - TTL (saniye cinsinden)
 * @param refreshThreshold - 0-1 arası eşik. Örn: 0.8 → TTL'in %80'i geçince arka planda refresh başlat
 */
export async function withCacheAndRefresh<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  ttl: number,
  refreshThreshold: number = 0.8
): Promise<T> {
  const cacheService = CacheService.getInstance();

  // Try to get from cache
  try {
    const cached = await cacheService.get<T>(cacheKey);
    if (cached) {
      // TTL kontrolü ile background refresh tetikle
      const remainingTTL = await cacheService.ttl(cacheKey);
      const refreshPoint = ttl * (1 - refreshThreshold); // Örn: 1800s TTL, 0.8 threshold → 360s

      if (remainingTTL !== null && remainingTTL > 0 && remainingTTL < refreshPoint) {
        // TTL düşük — arka planda yenile (stampede lock ile)
        const lockKey = `refresh-lock:${cacheKey}`;
        const lockTTL = getLockTTL(ttl);
        const acquired = await cacheService.setNX(lockKey, '1', lockTTL);

        if (acquired) {
          logger.debug(`Stale-while-revalidate: background refresh for key: ${cacheKey}`);
          void (async () => {
            try {
              const freshData = await fetchFn();
              await cacheService.set(cacheKey, freshData, ttl);
              logger.debug(`Background refresh completed for key: ${cacheKey}`);
            } catch (error) {
              logger.warn(`Background refresh failed for key: ${cacheKey}`, {
                error: error instanceof Error ? error.message : String(error),
              });
            }
          })();
        }
      }

      return cached; // Stale data hemen dön
    }
  } catch (error) {
    logger.warn(`Cache error for key: ${cacheKey}`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Cache miss - senkron fetch
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

