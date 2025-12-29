export enum FeedSource {
  // Existing
  TRUSTER = 'TRUSTER',                      // Kullanıcının trust ettiği kişi
  CATEGORY_MATCH = 'CATEGORY_MATCH',        // Kategori eşleşmesi
  TRENDING = 'TRENDING',                    // Trending post
  NEW_USER = 'NEW_USER',                    // Fallback
  BOOSTED = 'BOOSTED',                      // Boost edilmiş

  // New - Trust Network
  TRUSTER_NETWORK = 'TRUSTER_NETWORK',      // Kullanıcıyı trust eden kişi
  MUTUAL_TRUST = 'MUTUAL_TRUST',            // Karşılıklı trust

  // New - Inventory Match
  INVENTORY_MATCH = 'INVENTORY_MATCH',      // Envanterindeki ürün
  PRODUCT_GROUP_MATCH = 'PRODUCT_GROUP_MATCH', // Aynı product group

  // New - Engagement
  ENGAGEMENT_HIGH = 'ENGAGEMENT_HIGH'       // Yüksek engagement
}