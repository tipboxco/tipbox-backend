/**
 * Seed verilerini temizleyip seed.ts'yi çalıştıran script
 * 
 * Bu script:
 * 1. Prisma schema validation ve client generate
 * 2. Mevcut seed verilerini temizler (taxonomy korunur veya silinir)
 * 3. seed.ts'yi çalıştırır
 * 
 * Kullanım:
 *   npx ts-node scripts/clear-and-seed.ts          # Taxonomy korunur (sadece user/content temizlenir)
 *   npx ts-node scripts/clear-and-seed.ts --all    # Tüm veriler temizlenir (taxonomy dahil)
 */

import { execSync } from 'child_process';
import path from 'path';
import { clearUserContentMedia, clearAllMedia } from '../prisma/seed/helpers/clear-minio-media';

async function clearAndSeed(clearAll: boolean = false): Promise<void> {
  console.log('🔍 Prisma schema kontrol ediliyor...\n');
  
  try {
    // Önce Prisma schema'yı validate et
    try {
      execSync('npx prisma validate', { 
        stdio: 'pipe',
        cwd: process.cwd(),
      });
      console.log('✅ Schema geçerli\n');
    } catch (error: any) {
      console.error('❌ Schema validation başarısız!');
      if (error.stdout) {
        console.error(error.stdout.toString());
      }
      console.error('\n💡 Önce schema hatalarını düzeltin ve prisma generate çalıştırın');
      process.exit(1);
    }
    
    // Prisma client'ın güncel olduğundan emin ol
    console.log('🔧 Prisma client generate ediliyor...\n');
    try {
      execSync('npx prisma generate', {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log('✅ Prisma client güncel\n');
    } catch (error) {
      console.error('❌ Prisma client generate başarısız!');
      process.exit(1);
    }
    
    // MinIO görsellerini temizle (DB temizlemeden ÖNCE)
    if (clearAll) {
      console.log('🧹 MinIO TÜM görselleri temizleniyor (taxonomy dahil)...\n');
      try {
        await clearAllMedia();
      } catch (error) {
        console.warn('⚠️  MinIO temizleme hatası, devam ediliyor...', error);
      }
    } else {
      console.log('🧹 MinIO user/content görselleri temizleniyor (taxonomy korunuyor)...\n');
      try {
        await clearUserContentMedia();
      } catch (error) {
        console.warn('⚠️  MinIO temizleme hatası, devam ediliyor...', error);
      }
    }

    // Seed verilerini temizle (DB)
    if (clearAll) {
      console.log('\n🧹 TÜM seed verileri temizleniyor (taxonomy dahil)...\n');
      const clearSeedPath = path.join(process.cwd(), 'prisma', 'seed', 'clear-seed-data.ts');
      execSync(`npx ts-node ${clearSeedPath} --force`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
    } else {
      console.log('\n🧹 Kullanıcı/içerik verileri temizleniyor (taxonomy korunuyor)...\n');
      const clearUserContentPath = path.join(process.cwd(), 'prisma', 'seed', 'clear-user-content-data.ts');
      execSync(`npx ts-node ${clearUserContentPath}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
    }
    
    console.log('\n🌱 Seed.ts çalıştırılıyor...\n');
    console.log('ℹ️  Not: Seed görselleri seed.ts içinde otomatik olarak MinIO\'ya yüklenecek\n');
    
    // seed.ts'yi çalıştır
    const seedPath = path.join(process.cwd(), 'prisma', 'seed.ts');
    execSync(`npx ts-node ${seedPath}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    
    console.log('\n✅ Seed işlemi tamamlandı!');
  } catch (error) {
    console.error('❌ Seed işlemi başarısız:', error);
    process.exit(1);
  }
}

// CLI argümanlarını kontrol et
const args = process.argv.slice(2);
const clearAll = args.includes('--all') || args.includes('-a');

clearAndSeed(clearAll);

