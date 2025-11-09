const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Docker compose port bilgilerini gösteren script
 * Container'lar ayağa kalktıktan sonra hangi portlardan erişilebileceğini gösterir
 */

// Servis isimleri ve açıklamaları
const serviceInfo = {
  backend: {
    name: 'Backend API',
    url: 'http://localhost:3000',
    swagger: 'http://localhost:3000/api-docs',
    description: 'Ana backend servisi ve API dokümantasyonu'
  },
  'prisma-studio': {
    name: 'Prisma Studio',
    url: 'http://localhost:5555',
    description: 'Database GUI - Veritabanı yönetim arayüzü'
  },
  pgadmin: {
    name: 'pgAdmin',
    url: 'http://localhost:5050',
    description: 'PostgreSQL yönetim arayüzü (Email: admin@tipbox.co, Password: admin123)'
  },
  minio: {
    name: 'MinIO Console',
    url: 'http://localhost:9001',
    api: 'http://localhost:9000',
    description: 'MinIO object storage yönetim konsolu'
  },
  postgres: {
    name: 'PostgreSQL',
    url: 'localhost:5432',
    description: 'PostgreSQL veritabanı (kullanıcı: postgres, şifre: postgres, db: tipbox_dev)'
  },
  redis: {
    name: 'Redis',
    url: 'localhost:6379',
    description: 'Redis cache ve queue servisi'
  }
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function printHeader() {
  console.log('\n' + '='.repeat(80));
  console.log('  🐳 DOCKER CONTAINER PORT BİLGİLERİ');
  console.log('='.repeat(80) + '\n');
}

function printService(serviceName, info) {
  console.log(`  📦 ${info.name}`);
  console.log(`     ${info.description}`);
  
  if (info.url) {
    // URL'leri Ctrl+Click ile tıklanabilir yapmak için özel format
    // Modern terminaller genellikle http:// ile başlayan URL'leri otomatik algılar
    console.log(`     🔗 ${info.url}`);
  }
  
  if (info.swagger) {
    console.log(`     📚 Swagger: ${info.swagger}`);
  }
  
  if (info.api) {
    console.log(`     🔌 API: ${info.api}`);
  }
  
  console.log('');
}

function checkContainerStatus(containerName) {
  try {
    const result = execSync(`docker ps --filter "name=${containerName}" --format "{{.Status}}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return result.trim().length > 0;
  } catch (error) {
    return false;
  }
}

async function showPorts() {
  // 5 saniye bekle
  console.log('⏳ Container\'ların ayağa kalkması bekleniyor... (5 saniye)');
  await sleep(5000);
  
  printHeader();
  
  // Her servis için bilgileri göster
  for (const [serviceName, info] of Object.entries(serviceInfo)) {
    const containerName = `tipbox_${serviceName}`;
    const isRunning = checkContainerStatus(containerName);
    
    if (isRunning) {
      printService(serviceName, info);
    } else {
      console.log(`  ⚠️  ${info.name} (${containerName}) henüz çalışmıyor`);
      console.log('');
    }
  }
  
  console.log('='.repeat(80));
  console.log('  💡 İpucu: URL\'lere Ctrl+Click (veya Cmd+Click) ile direkt erişebilirsiniz!');
  console.log('='.repeat(80) + '\n');
}

// Script çalıştırıldığında
if (require.main === module) {
  showPorts().catch(console.error);
}

module.exports = { showPorts };

