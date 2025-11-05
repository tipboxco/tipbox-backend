#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const REPORT_PORT = 8080;
const REPORT_FILE = path.join(__dirname, '../test-results/jest-html-report.html');
const DETAILED_REPORT_FILE = path.join(__dirname, '../test-results/detailed-test-report.html');
const AUTH_REPORT_FILE = path.join(__dirname, '../test-results/auth-report.html');
const USER_REPORT_FILE = path.join(__dirname, '../test-results/user-report.html');
const HEALTH_REPORT_FILE = path.join(__dirname, '../test-results/health-report.html');
const EXPERT_REPORT_FILE = path.join(__dirname, '../test-results/expert-report.html');

// Check if at least one report file exists
if (!fs.existsSync(REPORT_FILE) && !fs.existsSync(DETAILED_REPORT_FILE) && !fs.existsSync(AUTH_REPORT_FILE) && !fs.existsSync(USER_REPORT_FILE) && !fs.existsSync(HEALTH_REPORT_FILE) && !fs.existsSync(EXPERT_REPORT_FILE)) {
  console.error('❌ Test raporu bulunamadı. Lütfen önce testleri çalıştırın.');
  console.error('   Standart rapor:', REPORT_FILE);
  console.error('   Detaylı rapor:', DETAILED_REPORT_FILE);
  process.exit(1);
}

// Create simple HTTP server
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    // Ana sayfa - rapor seçimi (dinamik liste dahil)
    const resultsDir = path.join(__dirname, '../test-results');
    let dynamicLinks = '';
    try {
      const files = fs.readdirSync(resultsDir).filter(f => f.toLowerCase().endsWith('.html'));
      dynamicLinks = files.map(f => `<a href="/reports/${encodeURIComponent(f)}" class="report-link">${f}</a>`).join('\n');
    } catch (_) {}

    const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Raporları</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            text-align: center;
        }
        h1 {
            color: #333;
            margin-bottom: 30px;
        }
        .report-link {
            display: block;
            padding: 20px;
            margin: 15px 0;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-size: 18px;
            transition: background 0.3s;
        }
        .report-link:hover {
            background: #5568d3;
        }
        .report-link.detailed {
            background: #10b981;
        }
        .report-link.detailed:hover {
            background: #059669;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Test Raporları</h1>
        <a href="/detailed-report.html" class="report-link detailed">🔍 Detaylı Test Raporu</a>
        <a href="/standard-report.html" class="report-link">📄 Standart Test Raporu</a>
        <a href="/auth-report.html" class="report-link" style="background:#3b82f6">🔐 Auth Test Raporu</a>
        <a href="/expert-report.html" class="report-link" style="background:#f59e0b">🧠 Expert Test Raporu</a>
        <a href="/user-report.html" class="report-link" style="background:#8b5cf6">👤 User Test Raporu</a>
        <a href="/health-report.html" class="report-link" style="background:#10b981">❤️ Health Test Raporu</a>
        ${dynamicLinks}
    </div>
</body>
</html>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } else if (req.url.startsWith('/reports/')) {
    // Dinamik dosya servisleme: /reports/<file.html>
    const fileName = decodeURIComponent(req.url.replace('/reports/', ''));
    const filePath = path.join(__dirname, '../test-results', fileName);
    const baseDir = path.join(__dirname, '../test-results');
    if (!filePath.startsWith(baseDir)) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Invalid path');
      return;
    }
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else if (req.url === '/detailed-report.html' || req.url === '/detailed') {
    // Detaylı rapor
    fs.readFile(DETAILED_REPORT_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Detaylı rapor bulunamadı. Test çalıştırıldı mı?');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else if (req.url === '/standard-report.html' || req.url === '/report.html') {
    // Standart rapor
    fs.readFile(REPORT_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Rapor okunamadı');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else if (req.url === '/auth-report.html') {
    // Auth raporu
    fs.readFile(AUTH_REPORT_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Auth raporu bulunamadı. Test çalıştırıldı mı?');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else if (req.url === '/user-report.html') {
    fs.readFile(USER_REPORT_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('User raporu bulunamadı. Test çalıştırıldı mı?');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else if (req.url === '/health-report.html') {
    fs.readFile(HEALTH_REPORT_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Health raporu bulunamadı. Test çalıştırıldı mı?');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else if (req.url === '/expert-report.html') {
    fs.readFile(EXPERT_REPORT_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Expert raporu bulunamadı. Test çalıştırıldı mı?');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Start server with error handling
server.listen(REPORT_PORT, () => {
  console.log('');
  console.log('✅ Test raporu sunucusu başlatıldı!');
  console.log('');
  console.log('📊 Raporlar:');
  console.log(`   Ana sayfa: http://localhost:${REPORT_PORT}/`);
  if (fs.existsSync(DETAILED_REPORT_FILE)) {
    console.log(`   🔍 Detaylı Rapor: http://localhost:${REPORT_PORT}/detailed-report.html`);
  }
  if (fs.existsSync(REPORT_FILE)) {
    console.log(`   📄 Standart Rapor: http://localhost:${REPORT_PORT}/standard-report.html`);
  }
  if (fs.existsSync(AUTH_REPORT_FILE)) {
    console.log(`   🔐 Auth Raporu: http://localhost:${REPORT_PORT}/auth-report.html`);
  }
  if (fs.existsSync(USER_REPORT_FILE)) {
    console.log(`   👤 User Raporu: http://localhost:${REPORT_PORT}/user-report.html`);
  }
  if (fs.existsSync(HEALTH_REPORT_FILE)) {
    console.log(`   ❤️ Health Raporu: http://localhost:${REPORT_PORT}/health-report.html`);
  }
  if (fs.existsSync(EXPERT_REPORT_FILE)) {
    console.log(`   🧠 Expert Raporu: http://localhost:${REPORT_PORT}/expert-report.html`);
  }
  console.log('');
  console.log('💡 Sunucuyu durdurmak için Ctrl+C tuşlarına basın');
  console.log('');
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error('❌ Port 8080 zaten kullanımda!');
    console.error('');
    console.error('💡 Çözüm seçenekleri:');
    console.error('   1. Mevcut sunucuyu durdurun: docker exec tipbox_backend pkill -f serve-test-report');
    console.error('   2. VEYA başka bir port kullanın (script içinde PORT değiştirin)');
    console.error('');
    console.error('   Mevcut sunucuya erişim:');
    console.error(`   http://localhost:${REPORT_PORT}/`);
    console.error('');
    process.exit(1);
  } else {
    console.error('❌ Sunucu başlatılamadı:', err.message);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Sunucu kapatılıyor...');
  server.close(() => {
    console.log('✅ Sunucu kapatıldı');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});

