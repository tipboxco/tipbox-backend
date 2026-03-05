/**
 * Seed verilerini temizleyip seed.ts'yi çalıştıran script
 *
 * RAM-optimized:
 *   - Migration kodu yok (entrypoint + stage-start.sh zaten halleder)
 *   - Dynamic imports (her adım sadece kendi modülünü yükler)
 *   - Child process'ler düşük heap ile çalışır (--max-old-space-size=256)
 *
 * Kullanım:
 *   npx ts-node --transpile-only scripts/clear-and-seed.ts          # taxonomy korunur
 *   npx ts-node --transpile-only scripts/clear-and-seed.ts --all    # tüm veriler silinir
 *
 * VEYA (daha az RAM):
 *   NODE_OPTIONS="--max-old-space-size=512" npx ts-node --transpile-only scripts/clear-and-seed.ts
 */

// @ts-nocheck — scripts/ tsconfig kapsamı dışında; --transpile-only ile çalışır
import { execSync } from 'child_process';
import path from 'path';

// Child process'ler için heap limiti — dev server zaten ~700MB kullandığından küçük tutulur
const CHILD_HEAP = '--max-old-space-size=256';

function runScript(scriptPath: string, extraEnv: Record<string, string> = {}): void {
  execSync(`npx ts-node --transpile-only "${scriptPath}"`, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_OPTIONS: CHILD_HEAP,
      ...extraEnv,
    },
  });
}

async function clearAndSeed(clearAll: boolean): Promise<void> {
  // ── ADIM 1: MinIO temizle (dynamic import → sadece bu adımda belleğe alınır) ──
  if (clearAll) {
    console.log('\n🧹 MinIO: TÜM görseller temizleniyor...');
    const { clearAllMedia } = await import('../prisma/seed/helpers/clear-minio-media');
    await clearAllMedia();
  } else {
    console.log('\n🧹 MinIO: kullanıcı/içerik görselleri temizleniyor...');
    const { clearUserContentMedia } = await import('../prisma/seed/helpers/clear-minio-media');
    await clearUserContentMedia();
  }

  // ── ADIM 2: DB temizle (dynamic import → sadece bu adımda belleğe alınır) ──
  if (clearAll) {
    console.log('\n🧹 DB: TÜM seed verileri temizleniyor (taxonomy dahil)...');
    const { clearAllSeedData } = await import('../prisma/seed/clear-seed-data');
    await clearAllSeedData(true);
  } else {
    console.log('\n🧹 DB: kullanıcı/içerik verileri temizleniyor (taxonomy korunuyor)...');
    const { clearUserContentData } = await import('../prisma/seed/clear-user-content-data');
    await clearUserContentData();
  }

  // ── ADIM 3: Seed görselleri MinIO'ya yükle (ayrı child process → kendi heap'i) ──
  console.log('\n📤 Seed görselleri MinIO\'ya yükleniyor...');
  try {
    runScript(path.join(process.cwd(), 'scripts', 'fix-minio-structure.ts'));
    console.log('✅ Seed görselleri yüklendi');
  } catch {
    console.warn('⚠️  Seed görselleri yüklenemedi, devam ediliyor...');
    console.warn('   Manuel: npx ts-node --transpile-only scripts/fix-minio-structure.ts');
  }

  // ── ADIM 4: Badge görselleri yükle (ayrı child process) ──
  console.log('\n🎨 Badge görselleri yükleniyor...');
  try {
    runScript(path.join(process.cwd(), 'scripts', 'upload-all-badge-images.ts'));
    console.log('✅ Badge görselleri yüklendi');
  } catch {
    console.warn('⚠️  Badge görselleri yüklenemedi, devam ediliyor...');
    console.warn('   Manuel: npx ts-node --transpile-only scripts/upload-all-badge-images.ts');
  }

  // ── ADIM 5: Seed.ts (ayrı child process) ──
  console.log('\n🌱 Seed.ts çalıştırılıyor...');
  runScript(path.join(process.cwd(), 'prisma', 'seed.ts'), {
    SKIP_SEED_MEDIA_UPLOAD: 'true', // görseller adım 3'te yüklendi
  });

  // ── ADIM 6: Feed distribution (ayrı child process) ──
  console.log('\n🔄 Feed distribution tetikleniyor...');
  try {
    runScript(path.join(process.cwd(), 'scripts', 'trigger-feed-distribution.ts'));
    console.log('✅ Feed distribution job\'ları oluşturuldu');
  } catch {
    console.warn('⚠️  Feed distribution tetiklenemedi');
    console.warn('   Manuel: npx ts-node --transpile-only scripts/trigger-feed-distribution.ts');
  }

  console.log('\n✅ Seed işlemi tamamlandı!\n');
}

const args = process.argv.slice(2);
const clearAll = args.includes('--all') || args.includes('-a');

// Dynamic import ile prisma client — sadece disconnect için gerekli
import('../prisma/seed/types').then(({ prisma }) => {
  clearAndSeed(clearAll)
    .catch((error) => {
      console.error('❌ Seed işlemi başarısız:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
});
