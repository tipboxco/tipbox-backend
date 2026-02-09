#!/usr/bin/env node
/**
 * Cloudflare Tunnel - Wrapper with cleanup on exit
 * npm run tunnel iptal edildiğinde (Ctrl+C) kalan cloudflared process'lerini kapatır.
 */

const { spawn } = require('child_process');
const path = require('path');

function killCloudflared(cb) {
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'taskkill' : 'pkill';
  const args = isWin ? ['/F', '/IM', 'cloudflared.exe'] : ['-9', 'cloudflared'];

  const proc = spawn(cmd, args, { stdio: 'pipe', shell: isWin });
  proc.on('close', () => {
    if (cb) cb();
    else process.exit(0);
  });
}

async function main() {
  let cloudflared = null;
  let exiting = false;

  const cleanup = () => {
    if (exiting) return;
    exiting = true;
    console.log('\nTunnel kapatılıyor...');
    if (cloudflared) cloudflared.kill('SIGTERM');
    setTimeout(() => {
      killCloudflared(() => {
        console.log('Cloudflared process\'leri kapatıldı.');
        process.exit(0);
      });
    }, 1500);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // 1. Setup (Published application routes + DNS)
  const setup = spawn('npm', ['run', 'tunnel:setup'], {
    stdio: 'inherit',
    shell: true,
    cwd: path.join(__dirname, '..'),
  });

  const setupDone = new Promise((resolve) => setup.on('close', resolve));
  const code = await setupDone;
  if (code !== 0) process.exit(code);

  // 2. Cloudflared tunnel (npx - Windows'ta PATH sorununu aşar)
  const cwd = path.join(__dirname, '..');
  const cfgPath = path.join(cwd, 'cloudflared', 'config.yml');
  cloudflared = spawn('npx', ['cloudflared', 'tunnel', '--config', cfgPath, 'run'], {
    stdio: 'inherit',
    cwd,
    shell: true,
    windowsHide: true,
  });

  cloudflared.on('error', (err) => {
    console.error('Cloudflared başlatılamadı:', err.message);
    console.error('Cloudflared PATH\'te kurulu mu? https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/');
    process.exit(1);
  });

  cloudflared.on('exit', (exitCode) => {
    if (!exiting) process.exit(exitCode ?? 0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
