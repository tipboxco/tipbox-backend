import { CacheService } from '../src/infrastructure/cache/cache.service';

const cacheService = CacheService.getInstance();

async function clearFeedCache() {
  console.log('Clearing feed cache for all users...\n');

  try {
    // Clear all feed cache entries
    const pattern = 'feed:*';
    await cacheService.delPattern(pattern);
    console.log('✅ Feed cache cleared successfully!');
  } catch (error) {
    console.error('❌ Error clearing feed cache:', error);
  }
}

clearFeedCache().catch(console.error);



