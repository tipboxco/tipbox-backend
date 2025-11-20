const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'docs');
const outputFile = path.join(__dirname, 'docs-data.json');

// Kategori tanımları
const categories = {
  'setup': {
    name: 'Kurulum & Yapılandırma',
    icon: 'fa-cog',
    files: ['SETUP_GUIDE', 'ENVIRONMENT_SETUP', 'DOCKER_CONTAINER_CONFIG']
  },
  'deployment': {
    name: 'Deployment',
    icon: 'fa-rocket',
    files: ['AUTOMATED_DEPLOYMENT', 'DEPLOYMENT_QUICK_START', 'HETZNER_DEPLOYMENT']
  },
  'development': {
    name: 'Geliştirme',
    icon: 'fa-code',
    files: ['BRANCH_STRATEGY', 'TEST', 'SWAGGER_TROUBLESHOOTING', 'SOCKET_TESTING']
  },
  'features': {
    name: 'Özellikler & Entegrasyonlar',
    icon: 'fa-puzzle-piece',
    files: [
      'SOCKET_IO_INTEGRATION', 'SOCKET_INTEGRATION_SUMMARY', 'MESSAGING_SOCKET_EVENTS',
      'MESSAGING_SOCKET_IMPLEMENTATION_PLAN', 'REDIS_BULLMQ_INTEGRATION', 'MINIO_FILE_UPLOAD',
      'GOOGLE_WORKSPACE_OAUTH2_CONFIG', 'GOOGLE_WORKSPACE_SMTP_CONFIG', 'MANUAL_SIGNUP_EMAIL_VERIFICATION'
    ]
  },
  'database': {
    name: 'Veritabanı',
    icon: 'fa-database',
    files: ['PRISMA_TYPE_HELPER_REFACTOR']
  },
  'monitoring': {
    name: 'İzleme & Loglama',
    icon: 'fa-chart-line',
    files: ['MONITORING_SETUP']
  },
  'knowledge': {
    name: 'Knowledge Base',
    icon: 'fa-book',
    files: ['TIPBOX_KNOWLEDGE_BASE', 'README']
  },
  'summaries': {
    name: 'Özetler & Analizler',
    icon: 'fa-file-alt',
    files: [
      'SESSION_SUMMARY', 'MARKETPLACE_FIX_SUMMARY', 'MARKETPLACE_SEED_SUMMARY',
      'API_RESPONSE_IMPACT_ANALYSIS', 'INDUSTRY_STANDARDS_ANALYSIS'
    ]
  },
  'changelog': {
    name: 'Changelog',
    icon: 'fa-history',
    files: ['CHANGELOG_2025_01_XX']
  }
};

function readMarkdownFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

function getFileTitle(content) {
  // İlk # başlığını bul
  const match = content.match(/^#\s+(.+)$/m);
  if (match) {
    return match[1].trim();
  }
  // Dosya adından başlık oluştur
  return path.basename(filePath, '.md').replace(/_/g, ' ');
}

function categorizeFile(fileName) {
  const baseName = path.basename(fileName, '.md');
  
  for (const [categoryId, category] of Object.entries(categories)) {
    if (category.files.includes(baseName)) {
      return categoryId;
    }
  }
  
  return 'other';
}

function getAllMarkdownFiles(dir) {
  const files = [];
  
  function traverseDir(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        traverseDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }
  
  traverseDir(dir);
  return files;
}

// Ana işlem
const allFiles = getAllMarkdownFiles(docsDir);
const docsData = {
  categories: {},
  files: []
};

// Kategorileri oluştur
for (const [categoryId, category] of Object.entries(categories)) {
  docsData.categories[categoryId] = {
    id: categoryId,
    name: category.name,
    icon: category.icon,
    files: []
  };
}

// Diğer kategorisi
docsData.categories.other = {
  id: 'other',
  name: 'Diğer',
  icon: 'fa-file',
  files: []
};

// Dosyaları oku ve kategorize et
for (const filePath of allFiles) {
  const content = readMarkdownFile(filePath);
  if (!content) continue;
  
  const relativePath = path.relative(docsDir, filePath);
  const fileName = path.basename(filePath, '.md');
  const categoryId = categorizeFile(fileName);
  const title = getFileTitle(content);
  
  const docEntry = {
    id: fileName.toLowerCase().replace(/_/g, '-'),
    fileName: fileName,
    path: relativePath,
    title: title,
    content: content,
    category: categoryId
  };
  
  docsData.files.push(docEntry);
  docsData.categories[categoryId].files.push(docEntry.id);
}

// JSON dosyasına yaz
fs.writeFileSync(outputFile, JSON.stringify(docsData, null, 2), 'utf-8');
console.log(`✅ ${docsData.files.length} dokümantasyon dosyası işlendi ve ${outputFile} dosyasına yazıldı.`);

// JavaScript dosyasına da yaz (CORS sorunlarını önlemek için)
const jsOutputFile = path.join(__dirname, 'docs-data.js');
const jsContent = `// Otomatik oluşturulmuş dokümantasyon verileri
window.DOCS_DATA = ${JSON.stringify(docsData, null, 2)};`;
fs.writeFileSync(jsOutputFile, jsContent, 'utf-8');
console.log(`✅ JavaScript dosyası da oluşturuldu: ${jsOutputFile}`);
console.log(`📁 Kategoriler: ${Object.keys(docsData.categories).length}`);

