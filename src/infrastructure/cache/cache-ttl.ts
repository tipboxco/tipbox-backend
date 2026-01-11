/**
 * Merkezi TTL (Time To Live) yönetimi
 * Tüm cache TTL değerleri saniye cinsinden bu dosyada tanımlanır
 */

export const CACHE_TTL = {
  // User related
  USER_PROFILE: 3600,          // 1 saat - sık değişmeyen data
  USER_SETTINGS: 7200,         // 2 saat - çok nadir değişir
  USER_PRIVACY: 7200,          // 2 saat - çok nadir değişir
  USER_DEVICE: 86400,          // 24 saat - cihaz bilgisi nadiren değişir
  USER_TRUST_SCORE: 1800,      // 30 dakika - periyodik olarak güncellenir
  
  // Post related
  POST: 1800,                  // 30 dakika - post içeriği nadir değişir ama stats değişebilir
  POST_COMMENTS: 600,          // 10 dakika - yorumlar sık eklenebilir
  POST_LIKES: 300,             // 5 dakika - like'lar çok sık değişir
  POST_STATS: 300,             // 5 dakika - stats çok sık değişir
  
  // Feed related
  FEED: 600,                   // 10 dakika - feed sürekli güncellenir
  FEED_TRENDING: 600,          // 10 dakika - trend'ler sık güncellenir
  FEED_PERSONALIZED: 900,      // 15 dakika - personalized feed
  
  // Product related
  PRODUCT: 3600,               // 1 saat - product bilgisi nadir değişir
  PRODUCT_REVIEWS: 1800,       // 30 dakika - review'lar periyodik eklenir
  PRODUCT_COMPARISON: 3600,    // 1 saat - karşılaştırma sonuçları nadir değişir
  
  // Category related
  CATEGORY: 7200,              // 2 saat - kategori bilgisi nadiren değişir
  SUB_CATEGORY: 7200,          // 2 saat - sub kategori bilgisi nadiren değişir
  CATEGORY_PRODUCTS: 3600,     // 1 saat - kategori içindeki ürünler
  
  // Marketplace related
  MARKETPLACE_BANNER: 3600,    // 1 saat - banner'lar günlük güncellenir
  MARKETPLACE_FEATURED: 1800,  // 30 dakika - featured items daha sık güncellenir
  
  // Wallet related
  WALLET_BALANCE: 300,         // 5 dakika - bakiye sık değişebilir
  WALLET_TRANSACTIONS: 1800,   // 30 dakika - işlem geçmişi
  
  // Expert related
  EXPERT_PROFILE: 3600,        // 1 saat - expert profili nadir değişir
  EXPERT_REQUESTS: 600,        // 10 dakika - istekler sık gelebilir
  
  // Inventory related
  INVENTORY_USER: 1800,        // 30 dakika - user inventory
  INVENTORY_ITEM: 3600,        // 1 saat - inventory item detayı
  
  // Messaging related
  DM_THREAD: 600,              // 10 dakika - thread bilgisi
  DM_MESSAGES: 300,            // 5 dakika - mesajlar çok sık gelir
  DM_UNREAD_COUNT: 60,         // 1 dakika - okunmamış sayısı real-time'a yakın olmalı
  
  // Event related
  EVENT_ACTIVE: 1800,          // 30 dakika - aktif event'ler
  EVENT_UPCOMING: 3600,        // 1 saat - yaklaşan event'ler
  EVENT_DETAIL: 600,           // 10 dakika - event detayı (katılım sayısı sık değişebilir)
  EVENT_POSTS: 600,            // 10 dakika - event post'ları (yeni post'lar sık eklenebilir)
  EVENT_BADGES: 3600,          // 1 saat - event badge'leri nadir değişir
  
  // Notification related
  NOTIFICATION_UNREAD_COUNT: 60, // 1 dakika - okunmamış bildirim sayısı real-time'a yakın olmalı
  
  // Search related
  SEARCH_RESULTS: 1800,        // 30 dakika - arama sonuçları
  SEARCH_SUGGESTIONS: 3600,    // 1 saat - arama önerileri
  
  // Auth related
  TOKEN_BLACKLIST: 604800,     // 7 gün - token'ın expire süresine eşit
  LOGIN_ATTEMPTS: 900,         // 15 dakika - login attempt tracking
  
  // Static data
  STATIC_CATEGORIES: 86400,    // 24 saat - statik kategoriler
  STATIC_BRANDS: 86400,        // 24 saat - statik markalar
  STATIC_TAGS: 86400,          // 24 saat - statik tag'ler
  
  // AI related
  AI_SPLIT_EXPERIENCE: 604800, // 7 gün - aynı metin tekrar sorulursa cache'ten dön (maliyet tasarrufu)
  
  // Special values
  SHORT: 300,                  // 5 dakika - kısa süreli cache için
  MEDIUM: 1800,                // 30 dakika - orta süreli cache için
  LONG: 3600,                  // 1 saat - uzun süreli cache için
  VERY_LONG: 86400,            // 24 saat - çok uzun süreli cache için
};

/**
 * Cache stratejilerine göre TTL grupları
 */
export const CACHE_STRATEGY = {
  // Real-time data - çok sık değişir
  REALTIME: CACHE_TTL.SHORT,
  
  // Dynamic data - sık değişir
  DYNAMIC: CACHE_TTL.MEDIUM,
  
  // Semi-static data - nadir değişir
  SEMI_STATIC: CACHE_TTL.LONG,
  
  // Static data - çok nadir değişir
  STATIC: CACHE_TTL.VERY_LONG,
};

