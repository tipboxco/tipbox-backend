/**
 * Feed distribution'ı manuel olarak tetikler
 */

import dotenv from 'dotenv';
dotenv.config({ override: false });

import { spawn } from 'child_process';

async function isFeedWorkerLikelyRunning(): Promise<boolean> {
  const { FeedDistributionScheduler } = await import('../src/infrastructure/scheduler/feed-distribution.scheduler');
  const scheduler = new FeedDistributionScheduler();

  try {
    const initial = await scheduler.getQueueStats();
    const start = Date.now();
    let lastCompleted = initial.completed;

    // Kısa bir pencere içinde "active" veya "completed artışı" görürsek worker var kabul ediyoruz.
    while (Date.now() - start < 8000) {
      // Not: 1sn aralıkla kontrol yeterli
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const stats = await scheduler.getQueueStats();

      if (stats.active > 0) return true;
      if (stats.completed > lastCompleted) return true;

      lastCompleted = stats.completed;
    }

    return false;
  } finally {
    await scheduler.close();
  }
}

function startWorkersDetached(): void {
  // Bu process kapanınca bile container içinde worker'lar çalışmaya devam etsin.
  // Not: stdout/stderr'ı "ignore" ediyoruz ki detach gerçek anlamda detach olsun.
  const child = spawn('npx', ['ts-node', '--transpile-only', 'src/infrastructure/workers/index.ts'], {
    cwd: process.cwd(),
    env: process.env,
    detached: true,
    stdio: 'ignore',
  });

  child.unref();
}

async function main() {
  console.log('🚀 Feed distribution tetikleniyor...\n');
  const { triggerFeedDistributionAfterSeed } = await import('../prisma/seed/trigger-feed-distribution');
  await triggerFeedDistributionAfterSeed();

  // Seed/trigger bittiğinde, worker yoksa job'lar "waiting"de kalır ve dışarıdan "job'lar çalışmıyor" gibi görünür.
  // Docker / compose tarafına dokunmadan, sadece script üzerinden worker'ları arka planda ayağa kaldırıyoruz.
  const workerRunning = await isFeedWorkerLikelyRunning();
  if (!workerRunning) {
    console.log('\n⚠️  Feed worker aktif görünmüyor. WorkerManager arka planda başlatılıyor...\n');
    startWorkersDetached();
    console.log('✅ WorkerManager background olarak başlatıldı (container içinde çalışmaya devam edecek).');
  } else {
    console.log('\n✅ Worker aktif. Job\'lar arka planda işlenmeye devam edecek.');
  }

  console.log('\n✅ Feed distribution tetikleme tamamlandı!');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Feed distribution hatası:', error);
  process.exit(1);
});
