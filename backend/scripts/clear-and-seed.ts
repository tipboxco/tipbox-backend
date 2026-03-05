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
import { SeedPipelineLogger } from '../prisma/seed/helpers/seed-pipeline-logger';

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
  const mode = clearAll ? 'full (taxonomy dahil)' : 'partial (taxonomy korunur)';
  const pipeline = new SeedPipelineLogger(`clear-and-seed [${mode}]`, 6);

  try {
    // [1/6] MinIO temizle
    await pipeline.runStage(
      clearAll ? 'MinIO cleanup (all media)' : 'MinIO cleanup (user/content only)',
      async () => {
        if (clearAll) {
          const { clearAllMedia } = await import('../prisma/seed/helpers/clear-minio-media');
          await clearAllMedia();
        } else {
          const { clearUserContentMedia } = await import('../prisma/seed/helpers/clear-minio-media');
          await clearUserContentMedia();
        }
      },
    );

    // [2/6] DB temizle
    await pipeline.runStage(
      clearAll ? 'DB cleanup (TRUNCATE all)' : 'DB cleanup (user/content only)',
      async () => {
        if (clearAll) {
          const { clearAllSeedData } = await import('../prisma/seed/clear-seed-data');
          await clearAllSeedData(true);
        } else {
          const { clearUserContentData } = await import('../prisma/seed/clear-user-content-data');
          await clearUserContentData();
        }
      },
    );

    // [3/6] Seed görselleri MinIO'ya yükle (child process)
    await pipeline.runStageOptional(
      'Upload seed media to MinIO',
      () => runScript(path.join(process.cwd(), 'scripts', 'fix-minio-structure.ts')),
      undefined,
    );

    // [4/6] Badge görselleri yükle (child process)
    await pipeline.runStageOptional(
      'Upload badge images',
      () => runScript(path.join(process.cwd(), 'scripts', 'upload-all-badge-images.ts')),
      undefined,
    );

    // [5/6] Seed.ts (child process)
    await pipeline.runStage('Run seed.ts', () =>
      runScript(path.join(process.cwd(), 'prisma', 'seed.ts'), {
        SKIP_SEED_MEDIA_UPLOAD: 'true',
      }),
    );

    // [6/6] Feed distribution (child process)
    await pipeline.runStageOptional(
      'Trigger feed distribution',
      () => runScript(path.join(process.cwd(), 'scripts', 'trigger-feed-distribution.ts')),
      undefined,
    );

    pipeline.complete();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    pipeline.fail(errorMsg);
    throw error;
  }
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
