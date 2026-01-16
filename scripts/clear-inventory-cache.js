#!/usr/bin/env node

/**
 * Inventory Cache Temizleme Script
 * 
 * Kullanım:
 * node scripts/clear-inventory-cache.js <userId>
 * 
 * Örnek:
 * node scripts/clear-inventory-cache.js 550e8400-e29b-41d4-a716-446655440000
 */

const Redis = require('ioredis');

const userId = process.argv[2];

if (!userId) {
  console.error('❌ Kullanım: node scripts/clear-inventory-cache.js <userId>');
  console.error('Örnek: node scripts/clear-inventory-cache.js 550e8400-e29b-41d4-a716-446655440000');
  process.exit(1);
}

// Redis configuration
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
});

async function clearInventoryCache() {
  try {
    console.log(`🔍 Inventory cache temizleniyor: userId=${userId}`);
    
    const cacheKey = `inventory:user:${userId}:list`;
    
    // Check if key exists
    const exists = await redis.exists(cacheKey);
    
    if (exists) {
      // Delete the key
      await redis.del(cacheKey);
      console.log(`✅ Cache temizlendi: ${cacheKey}`);
    } else {
      console.log(`ℹ️  Cache bulunamadı: ${cacheKey} (zaten temiz)`);
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

clearInventoryCache();
