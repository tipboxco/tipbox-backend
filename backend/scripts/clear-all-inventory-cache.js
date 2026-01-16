#!/usr/bin/env node

/**
 * Tüm Inventory Cache'lerini Temizleme Script
 * 
 * Kullanım:
 * node scripts/clear-all-inventory-cache.js
 * 
 * Bu script tüm inventory:user:* pattern'indeki cache'leri temizler
 */

const Redis = require('ioredis');

// Redis configuration
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
});

async function clearAllInventoryCache() {
  try {
    console.log('🔍 Tüm inventory cache\'leri temizleniyor...');
    
    const pattern = 'inventory:user:*:list';
    
    // Scan for all matching keys
    let cursor = '0';
    let deletedCount = 0;
    const keys = [];
    
    do {
      const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      const foundKeys = result[1];
      
      if (foundKeys.length > 0) {
        keys.push(...foundKeys);
      }
    } while (cursor !== '0');
    
    console.log(`📊 Toplam ${keys.length} cache anahtarı bulundu`);
    
    if (keys.length > 0) {
      // Delete all keys
      for (const key of keys) {
        await redis.del(key);
        deletedCount++;
        console.log(`✅ Temizlendi: ${key}`);
      }
      
      console.log(`\n✅ Toplam ${deletedCount} cache temizlendi`);
    } else {
      console.log('ℹ️  Temizlenecek cache bulunamadı');
    }
    
    // Close Redis connection
    await redis.quit();
    process.exit(0);
  } catch (error) {
    console.error('❌ Hata:', error.message);
    await redis.quit();
    process.exit(1);
  }
}

clearAllInventoryCache();
