/**
 * Marketplace banner cache'ini temizler
 */

import dotenv from 'dotenv';
dotenv.config({ override: false });

import { CacheService } from '../src/infrastructure/cache/cache.service';

async function clearMarketplaceBannersCache() {
  try {
    console.log('🗑️  Marketplace banner cache temizleniyor...\n');

    const cacheService = CacheService.getInstance();
    await cacheService.connect();

    const cacheKey = 'explore:marketplace:banners:active';
    
    // Cache key'ini sil
    await cacheService.del(cacheKey);
    console.log(`✅ Cache key silindi: ${cacheKey}`);

    // Pattern ile de temizle (eğer başka varyantlar varsa)
    await cacheService.delPattern('explore:marketplace:banners:*');
    console.log(`✅ Pattern cache temizlendi: explore:marketplace:banners:*`);

    console.log('\n✅ Cache temizlendi! Artık yeni isteklerde güncel görseller görünecek.');
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  }
}

clearMarketplaceBannersCache();







