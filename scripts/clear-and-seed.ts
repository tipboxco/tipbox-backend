/**
 * Seed verilerini temizleyip seed.ts'yi çalıştıran script
 * 
 * Bu script:
 * 1. Prisma schema validation
 * 2. Migration status kontrolü ve uygulama
 * 3. DB schema ile Prisma schema uyumluluğu kontrolü
 * 4. Prisma client generate
 * 5. Mevcut seed verilerini temizler (taxonomy korunur veya silinir)
 * 6. seed.ts'yi çalıştırır
 * 
 * Kullanım:
 *   npx ts-node scripts/clear-and-seed.ts          # Taxonomy korunur (sadece user/content temizlenir)
 *   npx ts-node scripts/clear-and-seed.ts --all    # Tüm veriler temizlenir (taxonomy dahil)
 */

import { execSync } from 'child_process';
import path from 'path';
// MinIO işlemleri artık ayrı script'ler ile yapılıyor
// - Temizleme: scripts/clear-minio-media.ts (eğer gerekirse)
// - Yükleme: scripts/upload-seed-media.ts
// import { clearUserContentMedia, clearAllMedia } from '../prisma/seed/helpers/clear-minio-media';
// import { ensureSeedMediaUploaded } from '../prisma/seed/helpers/ensure-seed-media';

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
    
    // Migration status kontrolü
    console.log('📊 Migration durumu kontrol ediliyor...\n');
    try {
      const statusOutput = execSync('npx prisma migrate status', {
        stdio: 'pipe',
        cwd: process.cwd(),
        encoding: 'utf-8',
      });
      
      console.log('📋 Migration durumu:');
      console.log(statusOutput);
      
      // Eğer uygulanmamış migration'lar varsa uygula
      if (statusOutput.includes('not yet been applied') || 
          statusOutput.includes('drift detected') ||
          statusOutput.includes('database schema is not in sync') ||
          statusOutput.includes('Following migrations have not yet been applied')) {
        console.log('\n⚠️  Uygulanmamış migration\'lar bulundu, uygulanıyor...\n');
        execSync('npx prisma migrate deploy', {
          stdio: 'inherit',
          cwd: process.cwd(),
        });
        console.log('✅ Migration\'lar uygulandı\n');
      } else {
        console.log('✅ Tüm migration\'lar uygulanmış\n');
      }
    } catch (error: any) {
      // migrate status hata verirse veya stdout'ta uygulanmamış migration bilgisi varsa
      const errorOutput = error.stdout?.toString() || error.stderr?.toString() || error.message || '';
      const fullOutput = error.stdout?.toString() || '';
      
      // stdout'ta uygulanmamış migration bilgisi varsa
      if (fullOutput.includes('not yet been applied') || 
          fullOutput.includes('Following migrations have not yet been applied')) {
        console.log('\n⚠️  Uygulanmamış migration\'lar bulundu, uygulanıyor...\n');
        try {
          execSync('npx prisma migrate deploy', {
            stdio: 'inherit',
            cwd: process.cwd(),
          });
          console.log('✅ Migration\'lar uygulandı\n');
        } catch (deployError) {
          console.error('❌ Migration deploy başarısız!');
          console.error('💡 Manuel olarak migration uygulayın: npx prisma migrate deploy');
          process.exit(1);
        }
      } else if (errorOutput.includes('database schema is not in sync') ||
                 errorOutput.includes('drift detected')) {
        console.log('\n⚠️  Database schema ile Prisma schema uyumsuz!');
        console.log('💡 Schema\'yı database\'e uyguluyoruz...\n');
        
        try {
          execSync('npx prisma db push --accept-data-loss', {
            stdio: 'inherit',
            cwd: process.cwd(),
          });
          console.log('✅ Schema database\'e uygulandı\n');
        } catch (pushError) {
          console.error('❌ Schema push başarısız!');
          console.error('💡 Manuel olarak migration oluşturun: npx prisma migrate dev');
          process.exit(1);
        }
      } else {
        // Migration history yoksa veya başka bir hata varsa, migrate deploy dene
        console.log('\n⚠️  Migration history kontrolü başarısız, migration\'ları uygulamayı deniyoruz...\n');
        try {
          execSync('npx prisma migrate deploy', {
            stdio: 'inherit',
            cwd: process.cwd(),
          });
          console.log('✅ Migration\'lar uygulandı\n');
        } catch (deployError) {
          console.error('❌ Migration deploy başarısız!');
          console.error('💡 Hata:', errorOutput.substring(0, 500));
          process.exit(1);
        }
      }
    }
    
    // Schema ile database'in gerçekten senkronize olup olmadığını kontrol et
    // Migration'lar uygulanmış görünse bile, schema ile database arasında uyumsuzluk olabilir
    // (Örneğin: migration'lar uygulanmış ama bazı kolonlar eksik olabilir)
    console.log('🔄 Schema ve database senkronizasyonu kontrol ediliyor...\n');
    let schemaChanged = false;
    try {
      // prisma db push ile schema uyumsuzluğunu kontrol et ve gerekirse düzelt
      // NOT: --skip-generate kullanmıyoruz çünkü schema değişirse Prisma Client'ı da güncellemek gerekiyor
      const pushOutput = execSync('npx prisma db push --accept-data-loss 2>&1', {
        stdio: 'pipe',
        cwd: process.cwd(),
        encoding: 'utf-8',
      });
      
      // Eğer "Your database is now in sync" mesajı varsa, zaten senkronize
      if (pushOutput.includes('Your database is now in sync')) {
        console.log('✅ Schema ve database zaten senkronize\n');
      } else {
        // Schema push yapıldı, değişiklikler uygulandı
        schemaChanged = true;
        console.log('⚠️  Schema ile database arasında uyumsuzluk bulundu ve düzeltildi\n');
        console.log('📋 Yapılan değişiklikler:');
        // Push çıktısından önemli satırları göster
        const lines = pushOutput.split('\n');
        lines.forEach(line => {
          if (line.includes('CREATE') || line.includes('ALTER') || line.includes('ADD') || line.includes('DROP')) {
            console.log(`   ${line.trim()}`);
          }
        });
        console.log('');
        // Prisma Client otomatik generate edildi (db push içinde)
        console.log('✅ Prisma Client otomatik olarak generate edildi (db push içinde)\n');
      }
    } catch (error: any) {
      // db push hata verirse, yine de devam et (migration'lar uygulanmış olabilir)
      const errorOutput = error.stdout?.toString() || error.stderr?.toString() || '';
      if (errorOutput.includes('Your database is now in sync')) {
        console.log('✅ Schema ve database senkronize\n');
      } else {
        console.warn('⚠️  Schema senkronizasyon kontrolü başarısız, devam ediliyor...');
        console.warn('   Hata:', errorOutput.substring(0, 300));
        console.warn('   💡 Eğer seed sırasında hata alırsanız, manuel olarak çalıştırın: npx prisma db push --accept-data-loss\n');
      }
    }
    
    // Prisma client'ın güncel olduğundan emin ol
    // Eğer schema değişmediyse (db push yapılmadıysa), generate et
    if (!schemaChanged) {
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
    }
    
    // Seed görsellerini MinIO'ya yükle (migration ve prisma generate'den sonra)
    console.log('📤 Seed görselleri MinIO\'ya yükleniyor...\n');
    try {
      const uploadMediaPath = path.join(process.cwd(), 'scripts', 'upload-seed-media.ts');
      execSync(`npx ts-node ${uploadMediaPath}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log('✅ Seed görselleri yüklendi\n');
    } catch (error) {
      console.warn('⚠️  Seed görselleri yüklenemedi, devam ediliyor...');
      console.warn('   Hata:', error instanceof Error ? error.message : String(error));
      console.warn('   💡 Manuel olarak çalıştırabilirsiniz: npm run upload-seed-media\n');
      // Media upload hatası seed işlemini durdurmaz
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
    
    // seed.ts'yi çalıştır (SKIP_SEED_MEDIA_UPLOAD=true ile görselleri tekrar yüklemesin)
    const seedPath = path.join(process.cwd(), 'prisma', 'seed.ts');
    execSync(`npx ts-node ${seedPath}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: {
        ...process.env,
        SKIP_SEED_MEDIA_UPLOAD: 'true', // seed.ts içinde görselleri tekrar yüklemesin
      },
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

