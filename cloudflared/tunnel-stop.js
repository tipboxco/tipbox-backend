#!/usr/bin/env node
const { spawnSync } = require('child_process');
const isWin = process.platform === 'win32';
spawnSync(isWin ? 'taskkill' : 'pkill', isWin ? ['/F', '/IM', 'cloudflared.exe'] : ['-9', 'cloudflared'], { stdio: 'inherit' });
console.log('Cloudflared kapatıldı.');
