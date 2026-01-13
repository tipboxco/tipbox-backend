/**
 * Merkezi cache key yönetimi
 * Tüm cache key'leri bu dosyada tanımlanır
 */

export const CACHE_KEYS = {
  // User related
  USER_PROFILE: (userId: string) => `user:${userId}:profile`,
  USER_SETTINGS: (userId: string) => `user:${userId}:settings`,
  USER_PRIVACY: (userId: string) => `user:${userId}:privacy`,
  USER_DEVICE: (userId: string, deviceId: string) => `user:${userId}:device:${deviceId}`,
  USER_TRUST_SCORE: (userId: string) => `user:${userId}:trust-score`,
  
  // Post related
  POST: (postId: string) => `post:${postId}`,
  POST_COMMENTS: (postId: string) => `post:${postId}:comments`,
  POST_LIKES: (postId: string) => `post:${postId}:likes`,
  POST_STATS: (postId: string) => `post:${postId}:stats`,
  
  // Feed related
  FEED: (userId: string, cursor: string | number, limit: number) => 
    `feed:${userId}:${cursor}:${limit}`,
  FEED_TRENDING: (period: 'daily' | 'weekly' | 'monthly') => `feed:trending:${period}`,
  FEED_PERSONALIZED: (userId: string, page: number) => `feed:personalized:${userId}:${page}`,
  
  // Product related
  PRODUCT: (productId: string) => `product:${productId}`,
  PRODUCT_REVIEWS: (productId: string) => `product:${productId}:reviews`,
  PRODUCT_COMPARISON: (productIds: string[]) => `product:comparison:${productIds.sort().join(':')}`,
  
  // Category related
  CATEGORY: (categoryId: string) => `category:${categoryId}`,
  SUB_CATEGORY: (subCategoryId: string) => `sub-category:${subCategoryId}`,
  CATEGORY_PRODUCTS: (categoryId: string) => `category:${categoryId}:products`,
  
  // Marketplace related
  MARKETPLACE_BANNER: () => `marketplace:banners`,
  MARKETPLACE_FEATURED: () => `marketplace:featured`,
  MARKETPLACE_LISTINGS: (params?: string) => params ? `marketplace:listings:${params}` : `marketplace:listings`,
  MARKETPLACE_NFT_DETAIL: (nftId: string) => `marketplace:nft:${nftId}`,
  
  // NFT related
  NFT_MY_NFTS: (userId: string, limit?: number) => 
    limit ? `nft:${userId}:my-nfts:${limit}` : `nft:${userId}:my-nfts`,
  NFT_LISTING: (listingId: string) => `nft:listing:${listingId}`,
  NFT_DETAIL: (nftId: string) => `nft:${nftId}:detail`,
  NFT_PRICE_HISTORY: (nftId: string) => `nft:${nftId}:price-history`,
  
  // Wallet related
  WALLET_BALANCE: (userId: string) => `wallet:${userId}:balance`,
  WALLET_TRANSACTIONS: (userId: string, page: number) => `wallet:${userId}:transactions:${page}`,
  
  // Expert related
  EXPERT_PROFILE: (expertId: string) => `expert:${expertId}:profile`,
  EXPERT_REQUESTS: (expertId: string) => `expert:${expertId}:requests`,
  
  // Inventory related
  INVENTORY_USER: (userId: string) => `inventory:${userId}`,
  INVENTORY_ITEM: (inventoryId: string) => `inventory:item:${inventoryId}`,
  
  // Messaging related
  DM_THREAD: (threadId: string) => `dm:thread:${threadId}`,
  DM_MESSAGES: (threadId: string, page: number) => `dm:thread:${threadId}:messages:${page}`,
  DM_UNREAD_COUNT: (userId: string) => `dm:${userId}:unread-count`,
  
  // Notification related
  NOTIFICATION_UNREAD_COUNT: (userId: string) => `notification:${userId}:unread-count`,
  
  // Search related
  SEARCH_RESULTS: (query: string, type: string) => `search:${type}:${query}`,
  SEARCH_SUGGESTIONS: (query: string) => `search:suggestions:${query}`,
  
  // Auth related
  TOKEN_BLACKLIST: (token: string) => `blacklist:${token}`,
  LOGIN_ATTEMPTS: (email: string) => `login-attempts:${email}`,
  
  // Static data
  STATIC_CATEGORIES: () => `static:categories`,
  STATIC_BRANDS: () => `static:brands`,
  STATIC_TAGS: () => `static:tags`,
  
  // AI related
  AI_SPLIT_EXPERIENCE: (experienceTextHash: string, productId: string) => 
    `ai:split:${productId}:${experienceTextHash}`,
};

/**
 * Cache invalidation pattern'leri
 */
export const CACHE_PATTERNS = {
  USER_ALL: (userId: string) => `user:${userId}:*`,
  POST_ALL: (postId: string) => `post:${postId}:*`,
  FEED_USER: (userId: string) => `feed:${userId}:*`,
  FEED_ALL: () => `feed:*`,
  PRODUCT_ALL: (productId: string) => `product:${productId}:*`,
  DM_THREAD_ALL: (threadId: string) => `dm:thread:${threadId}:*`,
  DM_USER: (userId: string) => `dm:${userId}:*`,
  WALLET_USER: (userId: string) => `wallet:${userId}:*`,
  AI_PRODUCT: (productId: string) => `ai:split:${productId}:*`,
  MARKETPLACE_ALL: () => `marketplace:*`,
  NFT_USER: (userId: string) => `nft:${userId}:*`,
  NFT_ALL: (nftId: string) => `nft:${nftId}:*`,
};

