import { CacheService } from './cache.service';
import { CACHE_KEYS } from './cache-keys';
import logger from '../logger/logger';

const cacheService = CacheService.getInstance();

/**
 * Cache Invalidation Helper Functions
 * Bu fonksiyonlar data güncellendiğinde cache'i temizlemek için kullanılır
 */

/**
 * User cache'ini invalidate eder
 * Kullanım: User profili güncellendiğinde
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  try {
    const keysToDelete = [
      CACHE_KEYS.USER_PROFILE(userId),
      CACHE_KEYS.USER_SETTINGS(userId),
    ];

    for (const key of keysToDelete) {
      await cacheService.del(key);
    }

    logger.info({
      message: 'User cache invalidated',
      userId,
      keys: keysToDelete,
    });
  } catch (error) {
    logger.error('Error invalidating user cache', { error, userId });
  }
}

/**
 * Post cache'ini invalidate eder
 * Kullanım: Post güncellendiğinde veya silindiğinde
 */
export async function invalidatePostCache(postId: string): Promise<void> {
  try {
    const keysToDelete = [
      CACHE_KEYS.POST(postId),
      CACHE_KEYS.POST_COMMENTS(postId),
    ];

    for (const key of keysToDelete) {
      await cacheService.del(key);
    }

    logger.info({
      message: 'Post cache invalidated',
      postId,
      keys: keysToDelete,
    });
  } catch (error) {
    logger.error('Error invalidating post cache', { error, postId });
  }
}

/**
 * User'ın feed cache'ini invalidate eder
 * Kullanım: Yeni post oluşturulduğunda, takip/unfollow'da
 */
export async function invalidateUserFeedCache(userId: string): Promise<void> {
  try {
    // Pattern ile tüm feed page'lerini sil
    await cacheService.delPattern(`feed:${userId}:*`);

    logger.info({
      message: 'User feed cache invalidated',
      userId,
    });
  } catch (error) {
    logger.error('Error invalidating feed cache', { error, userId });
  }
}

/**
 * Trending posts cache'ini invalidate eder
 * Kullanım: Yeni trending calculation'dan sonra
 */
export async function invalidateTrendingCache(): Promise<void> {
  try {
    await cacheService.delPattern('trending:*');

    logger.info({
      message: 'Trending cache invalidated',
    });
  } catch (error) {
    logger.error('Error invalidating trending cache', { error });
  }
}

/**
 * Category cache'ini invalidate eder
 * Kullanım: Category güncellendiğinde
 */
export async function invalidateCategoryCache(categoryId: string): Promise<void> {
  try {
    await cacheService.del(CACHE_KEYS.CATEGORY(categoryId));

    logger.info({
      message: 'Category cache invalidated',
      categoryId,
    });
  } catch (error) {
    logger.error('Error invalidating category cache', { error, categoryId });
  }
}

/**
 * Belirli bir user'ın tüm cache'ini temizler
 * Kullanım: User hesabı silindiğinde, major update'lerde
 */
export async function invalidateAllUserCache(userId: string): Promise<void> {
  try {
    // User ile ilgili tüm cache'leri sil
    await cacheService.delPattern(`user:${userId}:*`);
    await cacheService.delPattern(`feed:${userId}:*`);

    logger.info({
      message: 'All user cache invalidated',
      userId,
    });
  } catch (error) {
    logger.error('Error invalidating all user cache', { error, userId });
  }
}

/**
 * Tüm cache'i temizler (dikkatli kullan!)
 * Kullanım: Major system update'lerde, cache corruption şüphesinde
 */
export async function invalidateAllCache(): Promise<void> {
  try {
    await cacheService.delPattern('*');

    logger.warn({
      message: 'ALL CACHE INVALIDATED',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error invalidating all cache', { error });
  }
}

