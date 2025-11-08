#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const REPORT_PORT = 8080;
// Resolve results directory dynamically to handle directory changes
const RESULTS_DIR_CANDIDATES = [
  path.join(__dirname, '../test-results'),
  path.join(__dirname, '../tests/test-results'),
  path.join(__dirname, '../reports'),
];
const RESULTS_DIR = RESULTS_DIR_CANDIDATES.find((p) => {
  try { return fs.existsSync(p) && fs.statSync(p).isDirectory(); } catch { return false; }
});

// Fallback to default even if not exists (will error with helpful message later)
const BASE_RESULTS_DIR = RESULTS_DIR || path.join(__dirname, '../test-results');

const DETAILED_REPORT_FILE = path.join(BASE_RESULTS_DIR, 'detailed-test-report.html');
const AUTH_REPORT_FILE = path.join(BASE_RESULTS_DIR, 'auth-report.html');
const USER_REPORT_FILE = path.join(BASE_RESULTS_DIR, 'user-report.html');
const USER_SETTINGS_REPORT_FILE = path.join(BASE_RESULTS_DIR, 'user-settings-report.html');
const EXPERT_REPORT_FILE = path.join(BASE_RESULTS_DIR, 'expert-report.html');
const FEED_REPORT_FILE = path.join(BASE_RESULTS_DIR, 'feed-report.html');
const EXPLORE_REPORT_FILE = path.join(BASE_RESULTS_DIR, 'explore-report.html');
const INVENTORY_REPORT_FILE = path.join(BASE_RESULTS_DIR, 'inventory-report.html');
const MARKETPLACE_REPORT_FILE = path.join(BASE_RESULTS_DIR, 'marketplace-report.html');
const HEALTH_REPORT_FILE = path.join(BASE_RESULTS_DIR, 'health-report.html');

// Check if at least one report file exists
const reportFiles = [
  DETAILED_REPORT_FILE,
  AUTH_REPORT_FILE,
  USER_REPORT_FILE,
  USER_SETTINGS_REPORT_FILE,
  EXPERT_REPORT_FILE,
  FEED_REPORT_FILE,
  EXPLORE_REPORT_FILE,
  INVENTORY_REPORT_FILE,
  MARKETPLACE_REPORT_FILE,

];

if (!reportFiles.some(file => fs.existsSync(file))) {
  console.error('❌ Test raporu bulunamadı. Lütfen önce testleri çalıştırın.');
  console.error('   Aranan dizin:', BASE_RESULTS_DIR);
  process.exit(1);
}

// Create simple HTTP server
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    // Ana sayfa - rapor seçimi (dinamik liste dahil)
    const resultsDir = BASE_RESULTS_DIR;
    let dynamicLinks = '';
    try {
      // Ana sayfada zaten gösterilen raporlar ve filtrelenecek dosyalar
      const excludedFiles = [
        'detailed-test-report.html',
        'auth-report.html',
        'user-report.html',
        'user-settings-report.html',
        'expert-report.html',
        'feed-report.html',
        'explore-report.html',
        'inventory-report.html',
        'marketplace-report.html',
        'health-report.html',
        'jest-auth-run.html',
        'jest-html-report.html'
      ];
      
      const files = fs.readdirSync(resultsDir)
        .filter(f => f.toLowerCase().endsWith('.html'))
        .filter(f => !excludedFiles.includes(f.toLowerCase()));
      
      dynamicLinks = files.map(f => {
        const filePath = path.join(resultsDir, f);
        const stats = fs.statSync(filePath);
        const date = new Date(stats.mtime);
        const dateStr = date.toLocaleString('tr-TR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        return `<a href="/reports/${encodeURIComponent(f)}" class="report-link"><span style="font-weight:bold">${f}</span><br><small style="opacity:0.8">${dateStr}</small></a>`;
      }).join('\n');
    } catch (_) {}

    // Helper function to get file date
    const getFileDate = (filePath) => {
      try {
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          const date = new Date(stats.mtime);
          return date.toLocaleString('tr-TR', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          });
        }
      } catch (_) {}
      return '';
    };

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
            max-width: 600px;
            width: 100%;
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
            line-height: 1.4;
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
        .report-link small {
            display: block;
            margin-top: 5px;
            font-size: 14px;
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Test Raporları</h1>
        ${fs.existsSync(DETAILED_REPORT_FILE) ? `<a href="/detailed-test-report.html" class="report-link detailed">🔍 Detaylı Test Raporu${getFileDate(DETAILED_REPORT_FILE) ? '<small>' + getFileDate(DETAILED_REPORT_FILE) + '</small>' : ''}</a>` : ''}
        ${fs.existsSync(AUTH_REPORT_FILE) ? `<a href="/auth-report.html" class="report-link" style="background:#3b82f6">🔐 Auth Test Raporu${getFileDate(AUTH_REPORT_FILE) ? '<small>' + getFileDate(AUTH_REPORT_FILE) + '</small>' : ''}</a>` : ''}
        ${fs.existsSync(USER_REPORT_FILE) ? `<a href="/user-report.html" class="report-link" style="background:#8b5cf6">👤 User Test Raporu${getFileDate(USER_REPORT_FILE) ? '<small>' + getFileDate(USER_REPORT_FILE) + '</small>' : ''}</a>` : ''}
        ${fs.existsSync(USER_SETTINGS_REPORT_FILE) ? `<a href="/user-settings-report.html" class="report-link" style="background:#a855f7">⚙️ User Settings Test Raporu${getFileDate(USER_SETTINGS_REPORT_FILE) ? '<small>' + getFileDate(USER_SETTINGS_REPORT_FILE) + '</small>' : ''}</a>` : ''}
        ${fs.existsSync(EXPERT_REPORT_FILE) ? `<a href="/expert-report.html" class="report-link" style="background:#f59e0b">🧠 Expert Test Raporu${getFileDate(EXPERT_REPORT_FILE) ? '<small>' + getFileDate(EXPERT_REPORT_FILE) + '</small>' : ''}</a>` : ''}
        ${fs.existsSync(FEED_REPORT_FILE) ? `<a href="/feed-report.html" class="report-link" style="background:#ec4899">📰 Feed Test Raporu${getFileDate(FEED_REPORT_FILE) ? '<small>' + getFileDate(FEED_REPORT_FILE) + '</small>' : ''}</a>` : ''}
        ${fs.existsSync(EXPLORE_REPORT_FILE) ? `<a href="/explore-report.html" class="report-link" style="background:#14b8a6">🔍 Explore Test Raporu${getFileDate(EXPLORE_REPORT_FILE) ? '<small>' + getFileDate(EXPLORE_REPORT_FILE) + '</small>' : ''}</a>` : ''}
        ${fs.existsSync(INVENTORY_REPORT_FILE) ? `<a href="/inventory-report.html" class="report-link" style="background:#6366f1">📦 Inventory Test Raporu${getFileDate(INVENTORY_REPORT_FILE) ? '<small>' + getFileDate(INVENTORY_REPORT_FILE) + '</small>' : ''}</a>` : ''}
        ${fs.existsSync(MARKETPLACE_REPORT_FILE) ? `<a href="/marketplace-report.html" class="report-link" style="background:#f97316">🛒 Marketplace Test Raporu${getFileDate(MARKETPLACE_REPORT_FILE) ? '<small>' + getFileDate(MARKETPLACE_REPORT_FILE) + '</small>' : ''}</a>` : ''}
        ${fs.existsSync(HEALTH_REPORT_FILE) ? `<a href="/health-report.html" class="report-link" style="background:#10b981">❤️ Health Test Raporu${getFileDate(HEALTH_REPORT_FILE) ? '<small>' + getFileDate(HEALTH_REPORT_FILE) + '</small>' : ''}</a>` : ''}
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
    const filePath = path.join(BASE_RESULTS_DIR, fileName);
    const baseDir = BASE_RESULTS_DIR;
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
  } else if (req.url === '/detailed-test-report.html' || req.url === '/detailed-report.html' || req.url === '/detailed') {
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
  } else if (req.url === '/user-settings-report.html') {
    fs.readFile(USER_SETTINGS_REPORT_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('User Settings raporu bulunamadı. Test çalıştırıldı mı?');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else if (req.url === '/feed-report.html') {
    fs.readFile(FEED_REPORT_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Feed raporu bulunamadı. Test çalıştırıldı mı?');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else if (req.url === '/explore-report.html') {
    fs.readFile(EXPLORE_REPORT_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Explore raporu bulunamadı. Test çalıştırıldı mı?');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else if (req.url === '/inventory-report.html') {
    fs.readFile(INVENTORY_REPORT_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Inventory raporu bulunamadı. Test çalıştırıldı mı?');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else if (req.url === '/marketplace-report.html') {
    fs.readFile(MARKETPLACE_REPORT_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Marketplace raporu bulunamadı. Test çalıştırıldı mı?');
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

// Helper function to get file date for console
const getFileDateForConsole = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const date = new Date(stats.mtime);
      return date.toLocaleString('tr-TR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  } catch (_) {}
  return '';
};

// Start server with error handling
server.listen(REPORT_PORT, () => {
  console.log('');
  console.log('✅ Test raporu sunucusu başlatıldı!');
  console.log('');
  console.log('📊 Raporlar:');
  console.log(`   Ana sayfa: http://localhost:${REPORT_PORT}/`);
  if (fs.existsSync(DETAILED_REPORT_FILE)) {
    const date = getFileDateForConsole(DETAILED_REPORT_FILE);
    console.log(`   🔍 Detaylı Rapor: http://localhost:${REPORT_PORT}/detailed-test-report.html${date ? ' (Tarih: ' + date + ')' : ''}`);
  }
  if (fs.existsSync(AUTH_REPORT_FILE)) {
    const date = getFileDateForConsole(AUTH_REPORT_FILE);
    console.log(`   🔐 Auth Raporu: http://localhost:${REPORT_PORT}/auth-report.html${date ? ' (Tarih: ' + date + ')' : ''}`);
  }
  if (fs.existsSync(USER_REPORT_FILE)) {
    const date = getFileDateForConsole(USER_REPORT_FILE);
    console.log(`   👤 User Raporu: http://localhost:${REPORT_PORT}/user-report.html${date ? ' (Tarih: ' + date + ')' : ''}`);
  }
  if (fs.existsSync(USER_SETTINGS_REPORT_FILE)) {
    const date = getFileDateForConsole(USER_SETTINGS_REPORT_FILE);
    console.log(`   ⚙️ User Settings Raporu: http://localhost:${REPORT_PORT}/user-settings-report.html${date ? ' (Tarih: ' + date + ')' : ''}`);
  }
  if (fs.existsSync(EXPERT_REPORT_FILE)) {
    const date = getFileDateForConsole(EXPERT_REPORT_FILE);
    console.log(`   🧠 Expert Raporu: http://localhost:${REPORT_PORT}/expert-report.html${date ? ' (Tarih: ' + date + ')' : ''}`);
  }
  if (fs.existsSync(FEED_REPORT_FILE)) {
    const date = getFileDateForConsole(FEED_REPORT_FILE);
    console.log(`   📰 Feed Raporu: http://localhost:${REPORT_PORT}/feed-report.html${date ? ' (Tarih: ' + date + ')' : ''}`);
  }
  if (fs.existsSync(EXPLORE_REPORT_FILE)) {
    const date = getFileDateForConsole(EXPLORE_REPORT_FILE);
    console.log(`   🔍 Explore Raporu: http://localhost:${REPORT_PORT}/explore-report.html${date ? ' (Tarih: ' + date + ')' : ''}`);
  }
  if (fs.existsSync(INVENTORY_REPORT_FILE)) {
    const date = getFileDateForConsole(INVENTORY_REPORT_FILE);
    console.log(`   📦 Inventory Raporu: http://localhost:${REPORT_PORT}/inventory-report.html${date ? ' (Tarih: ' + date + ')' : ''}`);
  }
  if (fs.existsSync(MARKETPLACE_REPORT_FILE)) {
    const date = getFileDateForConsole(MARKETPLACE_REPORT_FILE);
    console.log(`   🛒 Marketplace Raporu: http://localhost:${REPORT_PORT}/marketplace-report.html${date ? ' (Tarih: ' + date + ')' : ''}`);
  }
  if (fs.existsSync(HEALTH_REPORT_FILE)) {
    const date = getFileDateForConsole(HEALTH_REPORT_FILE);
    console.log(`   ❤️ Health Raporu: http://localhost:${REPORT_PORT}/health-report.html${date ? ' (Tarih: ' + date + ')' : ''}`);
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

