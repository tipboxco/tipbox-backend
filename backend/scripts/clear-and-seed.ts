/**
 * Clear all seed data and reseed the database
 * Usage:
 *   npm run seed:clear-and-seed        # Clear user content, keep taxonomy
 *   npm run seed:clear-and-seed --all  # Clear everything including taxonomy
 */

import { execSync } from 'child_process';
import path from 'path';

async function clearAndSeed(clearAll: boolean = false) {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🌱 TIPBOX CLEAR AND SEED');
    console.log('='.repeat(80) + '\n');

    if (clearAll) {
      console.log('⚠️  MOD: TÜM VERİLER TEMİZLENECEK (taxonomy dahil)\n');
    } else {
      console.log('ℹ️  MOD: Sadece kullanıcı/içerik verileri temizlenecek (taxonomy korunacak)\n');
    }

    // ADIM 0: Prisma Schema Validation
    console.log('🔍 Prisma schema kontrol ediliyor...\n');
    try {
      execSync('npx prisma validate', {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log('✅ Schema geçerli\n');
    } catch (error) {
      console.error('❌ Schema geçersiz! Lütfen schema.prisma dosyasını kontrol edin.');
      process.exit(1);
    }

    // ADIM 1: Database Schema Push
    console.log('🔄 Prisma schema database\'e uygulanıyor...\n');
    try {
      execSync('npx prisma db push --accept-data-loss', {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log('✅ Schema database\'e uygulandı\n');
    } catch (error) {
      console.error('❌ Schema push başarısız!');
      process.exit(1);
    }

    // ADIM 2: Prisma Client Generate
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

    // ADIM 3: MinIO görsellerini temizle (ÖNCE)
    
    /*console.log('\n🧹 MinIO görselleri temizleniyor...\n');
    try {
      const clearMediaPath = path.join(process.cwd(), 'scripts', 'clear-minio.ts');
      if (clearAll) {
        execSync(`npx ts-node ${clearMediaPath} --all`, {
          stdio: 'inherit',
          cwd: process.cwd(),
        });
      } else {
        execSync(`npx ts-node ${clearMediaPath}`, {
          stdio: 'inherit',
          cwd: process.cwd(),
        });
      }
      console.log('✅ MinIO temizlendi\n');
    } catch (error) {
      console.warn('⚠️  MinIO temizleme hatası, devam ediliyor...');
      console.warn('   Hata:', error instanceof Error ? error.message : String(error));
    }
*/
    // ADIM 4: Seed verilerini temizle (DB)
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

    // ADIM 5: Seed görsellerini MinIO'ya yükle (Temizlemeden SONRA)
    console.log('\n📤 Seed görselleri MinIO\'ya yükleniyor (doğru UGC yapısı ile)...\n');
    try {
      const uploadMediaPath = path.join(process.cwd(), 'scripts', 'fix-minio-structure.ts');
      execSync(`npx ts-node ${uploadMediaPath}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log('✅ Seed görselleri yüklendi (UGC yapısı: profile-pictures/{userId}/)\n');
    } catch (error) {
      console.warn('⚠️  Seed görselleri yüklenemedi, devam ediliyor...');
      console.warn('   Hata:', error instanceof Error ? error.message : String(error));
      console.warn('   💡 Manuel olarak çalıştırabilirsiniz: npx ts-node scripts/fix-minio-structure.ts\n');
      // Media upload hatası seed işlemini durdurmaz
    }

    // ADIM 6: Seed.ts çalıştır
    console.log('\n🌱 Seed.ts çalıştırılıyor...\n');

    // seed.ts'yi çalıştır (SKIP_SEED_MEDIA_UPLOAD=true ile görselleri tekrar yüklemesin)
    const seedPath = path.join(process.cwd(), 'prisma', 'seed.ts');
    execSync(`npx ts-node --transpileOnly ${seedPath}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: {
        ...process.env,
        SKIP_SEED_MEDIA_UPLOAD: 'true', // seed.ts içinde görselleri tekrar yüklemesin
      },
    });

    console.log('\n✅ Seed işlemi tamamlandı!');
    console.log('💡 Feed distribution job\'ları seed.ts içinde oluşturuldu (arka planda işlenecek)\n');

  } catch (error) {
    console.error('❌ Seed işlemi başarısız:', error);
    process.exit(1);
  }
}

// CLI argümanlarını kontrol et
const args = process.argv.slice(2);
const clearAll = args.includes('--all') || args.includes('-a');

clearAndSeed(clearAll);
