import dotenv from 'dotenv';
dotenv.config();

import { CacheService } from '../src/infrastructure/cache/cache.service';
import { invalidateAllUserCache } from '../src/infrastructure/cache/cache-invalidation';
import logger from '../src/infrastructure/logger/logger';

const cacheService = CacheService.getInstance();
const userId = '480f5de9-b691-4d70-a6a8-2789226f4e07'; // omer user id

async function clearUserCache() {
  try {
    console.log('🔍 User cache temizleme işlemi başlatılıyor...\n');
    console.log('User ID:', userId);
    console.log('='.repeat(60) + '\n');

    // Cache service'e bağlan
    await cacheService.connect();
    console.log('✅ Cache service bağlandı\n');

    // Tüm user cache'lerini temizle
    console.log('🗑️  User cache temizleniyor...');
    await invalidateAllUserCache(userId);
    console.log('✅ User cache temizlendi\n');

    // Manuel olarak da kontrol edelim
    console.log('🔍 Manuel cache kontrolü:');
    const patterns = [
      `user:${userId}:*`,
      `feed:${userId}:*`,
    ];

    for (const pattern of patterns) {
      try {
        await cacheService.delPattern(pattern);
        console.log(`   ✅ Pattern temizlendi: ${pattern}`);
      } catch (error: any) {
        console.log(`   ⚠️  Pattern temizlenemedi: ${pattern} - ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Cache temizleme işlemi tamamlandı!');
    console.log('\n💡 Şimdi profil endpoint\'ini tekrar çağırdığınızda yeni banner görünmelidir.');

  } catch (error: any) {
    console.error(`\n❌ Hata: ${error.message}`);
    logger.error('Error clearing user cache:', error);
    throw error;
  }
}

clearUserCache();
