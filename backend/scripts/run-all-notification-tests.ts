/**
 * Tüm bildirim testlerini tek seferde çalıştır
 * 
 * Kullanım:
 *   docker-compose exec backend npx ts-node scripts/run-all-notification-tests.ts
 */

import { spawn } from 'child_process';
import * as path from 'path';

const TEST_DIR = path.join(__dirname, '../src/tests/notificationtest');

const TESTS = [
  'notification.post.test.ts',
  'notification.comment.test.ts',
  'notification.trust.test.ts',
  'notification.message.test.ts',
  'notification.gamification.test.ts',
  'notification.expert.test.ts',
  'notification.collection.test.ts',
  'notification.event.test.ts',
  'notification.system.test.ts',
];

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
}

const results: TestResult[] = [];

function log(message: string, level: 'info' | 'success' | 'error' = 'info') {
  const timestamp = new Date().toLocaleTimeString('tr-TR');
  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌',
  }[level];
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function runTest(testFile: string): Promise<boolean> {
  return new Promise((resolve) => {
    const testPath = path.join(TEST_DIR, testFile);
    log(`Çalıştırılıyor: ${testFile}`, 'info');
    
    const child = spawn('npx', ['ts-node', testPath], {
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      if (code === 0) {
        log(`${testFile} başarıyla tamamlandı`, 'success');
        results.push({ name: testFile, success: true });
        resolve(true);
      } else {
        log(`${testFile} başarısız oldu (exit code: ${code})`, 'error');
        results.push({ name: testFile, success: false, error: `Exit code: ${code}` });
        resolve(false);
      }
    });

    child.on('error', (error) => {
      log(`${testFile} çalıştırılırken hata: ${error.message}`, 'error');
      results.push({ name: testFile, success: false, error: error.message });
      resolve(false);
    });
  });
}

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🚀 Tüm Bildirim Testleri Başlatılıyor');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  let successCount = 0;
  let failCount = 0;

  for (const test of TESTS) {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 Test: ${test}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    const success = await runTest(test);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Testler arası kısa bir bekleme
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Özet rapor
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 TEST ÖZET RAPORU');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log(`Toplam Test: ${TESTS.length}`);
  console.log(`✅ Başarılı: ${successCount}`);
  console.log(`❌ Başarısız: ${failCount}`);
  console.log('');
  console.log('Detaylı Sonuçlar:');
  results.forEach(result => {
    if (result.success) {
      log(`${result.name}`, 'success');
    } else {
      log(`${result.name} - ${result.error || 'Bilinmeyen hata'}`, 'error');
    }
  });
  console.log('');
  console.log('═══════════════════════════════════════════════════════');

  // Başarısız test varsa exit code 1
  if (failCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

