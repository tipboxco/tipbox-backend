/**
 * Tüm workspace paketlerindeki ve root'taki node_modules klasörlerini siler.
 * Cross-platform (Windows / Linux / macOS).
 * Kullanım: node scripts/clean-node-modules.cjs  veya  pnpm run clean:modules
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const dirs = [
  '',
  'backend',
  'admin-panel',
  'catalog-service',
  'merge-code',
];

for (const dir of dirs) {
  const base = dir ? path.join(rootDir, dir) : rootDir;
  const nodeModules = path.join(base, 'node_modules');
  if (fs.existsSync(nodeModules)) {
    try {
      fs.rmSync(nodeModules, { recursive: true, maxRetries: 3 });
      console.log('Silindi:', nodeModules);
    } catch (err) {
      console.error('Silinemedi:', nodeModules, err.message);
      process.exitCode = 1;
    }
  }
}

console.log('clean:modules tamamlandı.');
