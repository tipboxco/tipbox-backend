#!/usr/bin/env node

const { spawn } = require('child_process');
const { exec } = require('child_process');
const path = require('path');

const REPORT_FILE = process.argv[2] || 'user-report.html';
const PORT = 8080;
const URL = `http://localhost:${PORT}/${REPORT_FILE}`;

// Start server in background
const server = spawn('node', [path.join(__dirname, 'serve-test-report.js')], {
  detached: true,
  stdio: 'ignore'
});

server.unref();

// Wait a bit for server to start, then open browser
setTimeout(() => {
  const platform = process.platform;
  let command;
  
  if (platform === 'win32') {
    command = `start ${URL}`;
  } else if (platform === 'darwin') {
    command = `open ${URL}`;
  } else {
    command = `xdg-open ${URL}`;
  }
  
  exec(command, (error) => {
    if (error) {
      console.error(`❌ Tarayıcı açılamadı: ${error.message}`);
      console.log(`\n📄 Raporu manuel olarak açabilirsiniz: ${URL}`);
    } else {
      console.log(`\n✅ Tarayıcı açıldı: ${URL}`);
    }
  });
}, 2000);

console.log(`\n🚀 Rapor sunucusu başlatılıyor...`);
console.log(`📄 Rapor: ${URL}`);

