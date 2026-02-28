import { CacheService } from './cache.service';
import { CACHE_KEYS, CACHE_PATTERNS } from './cache-keys';
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
      CACHE_KEYS.POST_LIKES(postId),
      CACHE_KEYS.POST_STATS(postId),
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
 * Post etkileşim cache'ini invalidate eder (like, comment, share, favorite)
 * Kullanım: Post'a like/unlike, comment, share, favorite yapıldığında
 */
export async function invalidatePostInteractionCache(postId: string): Promise<void> {
  try {
    const keysToDelete = [
      CACHE_KEYS.POST_LIKES(postId),
      CACHE_KEYS.POST_STATS(postId),
      CACHE_KEYS.POST_COMMENTS(postId),
    ];

    for (const key of keysToDelete) {
      await cacheService.del(key);
    }

    logger.info({
      message: 'Post interaction cache invalidated',
      postId,
    });
  } catch (error) {
    logger.error('Error invalidating post interaction cache', { error, postId });
  }
}

/**
 * Wallet cache'ini invalidate eder
 * Kullanım: Wallet balance güncellendiğinde, wallet connect/disconnect edildiğinde
 */
export async function invalidateWalletCache(userId: string): Promise<void> {
  try {
    await cacheService.delPattern(CACHE_PATTERNS.WALLET_USER(userId));

    logger.info({
      message: 'Wallet cache invalidated',
      userId,
    });
  } catch (error) {
    logger.error('Error invalidating wallet cache', { error, userId });
  }
}

/**
 * Badge/gamification cache'ini invalidate eder
 * Kullanım: Kullanıcıya badge verildiğinde, claim edildiğinde, visibility güncellendiğinde
 */
export async function invalidateBadgeCache(userId: string): Promise<void> {
  try {
    await cacheService.del(CACHE_KEYS.USER_PROFILE(userId));

    logger.info({
      message: 'Badge cache invalidated',
      userId,
    });
  } catch (error) {
    logger.error('Error invalidating badge cache', { error, userId });
  }
}

/**
 * DM/Support request cache'ini invalidate eder
 * Kullanım: Support request durumu değiştiğinde
 */
export async function invalidateDMCache(userId: string, threadId?: string): Promise<void> {
  try {
    await cacheService.del(CACHE_KEYS.DM_UNREAD_COUNT(userId));
    await cacheService.del(CACHE_KEYS.NOTIFICATION_UNREAD_COUNT(userId));

    if (threadId) {
      await cacheService.del(CACHE_KEYS.DM_THREAD(threadId));
      await cacheService.delPattern(CACHE_PATTERNS.DM_THREAD_ALL(threadId));
    }

    logger.info({
      message: 'DM cache invalidated',
      userId,
      threadId,
    });
  } catch (error) {
    logger.error('Error invalidating DM cache', { error, userId, threadId });
  }
}

/**
 * Trust score cache'ini invalidate eder
 * Kullanım: Kullanıcının trust score'u güncellendiğinde
 */
export async function invalidateTrustScoreCache(userId: string): Promise<void> {
  try {
    await cacheService.del(CACHE_KEYS.USER_TRUST_SCORE(userId));

    logger.info({
      message: 'Trust score cache invalidated',
      userId,
    });
  } catch (error) {
    logger.error('Error invalidating trust score cache', { error, userId });
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
 * Catalog posts cache'ini invalidate eder
 * Kullanım: Yeni post oluşturulduğunda veya güncellendiğinde
 */
export async function invalidateCatalogPostsCache(context: {
  subCategoryId?: string;
  productGroupId?: string;
  productId?: string;
}): Promise<void> {
  try {
    const keysToDelete: string[] = [];

    // Sub category posts cache
    if (context.subCategoryId) {
      await cacheService.delPattern(`catalog:sub-category:${context.subCategoryId}:posts:*`);
    }

    // Product group posts cache
    if (context.productGroupId) {
      await cacheService.delPattern(`catalog:product-group:${context.productGroupId}:posts:*`);
    }

    // Product posts cache
    if (context.productId) {
      await cacheService.delPattern(`catalog:product:${context.productId}:posts:*`);
    }

    // Hiyerarşik cache invalidation: Eğer product varsa, üst seviyeleri de temizle
    if (context.productId) {
      // Product'ın product group'unu bul ve cache'ini temizle
      const { getPrisma } = await import('../repositories/prisma.client');
      const prisma = getPrisma();
      const product = await prisma.product.findUnique({
        where: { id: context.productId },
        select: { groupId: true },
      });

      if (product?.groupId) {
        await cacheService.delPattern(`catalog:product-group:${product.groupId}:posts:*`);
        
        // Product group'un sub category'sini bul
        const productGroup = await prisma.productGroup.findUnique({
          where: { id: product.groupId },
          select: { subCategoryId: true },
        });

        if (productGroup?.subCategoryId) {
          await cacheService.delPattern(`catalog:sub-category:${productGroup.subCategoryId}:posts:*`);
        }
      }
    }

    // Eğer product group varsa, üst seviyeyi de temizle
    if (context.productGroupId) {
      const { getPrisma } = await import('../repositories/prisma.client');
      const prisma = getPrisma();
      const productGroup = await prisma.productGroup.findUnique({
        where: { id: context.productGroupId },
        select: { subCategoryId: true },
      });

      if (productGroup?.subCategoryId) {
        await cacheService.delPattern(`catalog:sub-category:${productGroup.subCategoryId}:posts:*`);
      }
    }

    logger.info({
      message: 'Catalog posts cache invalidated',
      context,
    });
  } catch (error) {
    logger.error('Error invalidating catalog posts cache', { error, context });
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

/**
 * NFT marketplace listing cache'ini invalidate eder
 * Kullanım: Yeni NFT listelendiğinde, listing güncellendiğinde
 */
export async function invalidateMarketplaceListings(): Promise<void> {
  try {
    // Marketplace listing cache'lerini temizle
    await cacheService.delPattern('marketplace:listings:*');
    await cacheService.del(CACHE_KEYS.MARKETPLACE_FEATURED());

    logger.info({
      message: 'Marketplace listings cache invalidated',
    });
  } catch (error) {
    logger.error('Error invalidating marketplace listings cache', { error });
  }
}

/**
 * NFT detail cache'ini invalidate eder
 * Kullanım: NFT satıldığında, transfer edildiğinde, bilgileri güncellendiğinde
 */
export async function invalidateNFTCache(nftId: string): Promise<void> {
  try {
    const keysToDelete = [
      CACHE_KEYS.NFT_DETAIL(nftId),
      CACHE_KEYS.NFT_PRICE_HISTORY(nftId),
      CACHE_KEYS.MARKETPLACE_NFT_DETAIL(nftId),
    ];

    for (const key of keysToDelete) {
      await cacheService.del(key);
    }

    logger.info({
      message: 'NFT cache invalidated',
      nftId,
      keys: keysToDelete,
    });
  } catch (error) {
    logger.error('Error invalidating NFT cache', { error, nftId });
  }
}

/**
 * User'ın NFT'lerinin cache'ini invalidate eder
 * Kullanım: User NFT aldığında, sattığında, listelediğinde
 */
export async function invalidateUserNFTCache(userId: string): Promise<void> {
  try {
    // User'ın tüm my-nfts cache'lerini temizle
    await cacheService.delPattern(`nft:${userId}:*`);

    logger.info({
      message: 'User NFT cache invalidated',
      userId,
    });
  } catch (error) {
    logger.error('Error invalidating user NFT cache', { error, userId });
  }
}

/**
 * NFT buy/sell işlemi sonrası cache'i temizler
 * Kullanım: NFT satın alındığında veya satıldığında
 * - Buyer ve seller'ın my-nfts cache'i
 * - NFT detail cache'i
 * - Marketplace listings cache'i
 */
export async function invalidateNFTTransactionCache(params: {
  nftId: string;
  sellerId: string;
  buyerId: string;
}): Promise<void> {
  try {
    const { nftId, sellerId, buyerId } = params;

    // NFT detail cache
    await invalidateNFTCache(nftId);

    // Seller ve buyer'ın NFT cache'leri
    await invalidateUserNFTCache(sellerId);
    await invalidateUserNFTCache(buyerId);

    // Marketplace listings
    await invalidateMarketplaceListings();

    logger.info({
      message: 'NFT transaction cache invalidated',
      nftId,
      sellerId,
      buyerId,
    });
  } catch (error) {
    logger.error('Error invalidating NFT transaction cache', { error, params });
  }
}

/**
 * NFT listing oluşturulduğunda veya iptal edildiğinde cache'i temizler
 * Kullanım: NFT marketplace'e listelendiğinde veya listing iptal edildiğinde
 */
export async function invalidateNFTListingCache(params: {
  nftId: string;
  userId: string;
}): Promise<void> {
  try {
    const { nftId, userId } = params;

    // NFT detail cache
    await invalidateNFTCache(nftId);

    // User'ın NFT cache'i
    await invalidateUserNFTCache(userId);

    // Marketplace listings
    await invalidateMarketplaceListings();

    logger.info({
      message: 'NFT listing cache invalidated',
      nftId,
      userId,
    });
  } catch (error) {
    logger.error('Error invalidating NFT listing cache', { error, params });
  }
}

