import { CacheService } from '../src/infrastructure/cache/cache.service';

const cacheService = CacheService.getInstance();

async function clearCatalogCache() {
  console.log('Clearing catalog cache...\n');

  try {
    // Clear all catalog related cache entries
    const patterns = [
      'static:categories',           // Main categories
      'category:*',                   // Sub-categories
      'sub-category:*',               // Product groups
      'product-group:*',              // Products
    ];

    for (const pattern of patterns) {
      await cacheService.delPattern(pattern);
      console.log(`✅ Cleared: ${pattern}`);
    }

    console.log('\n✅ All catalog cache cleared successfully!');
    console.log('📋 Catalog data will be refreshed from database on next request.');
  } catch (error) {
    console.error('❌ Error clearing catalog cache:', error);
  } finally {
    process.exit(0);
  }
}

clearCatalogCache().catch(console.error);



