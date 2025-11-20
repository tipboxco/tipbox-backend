// Global state
let docsData = null;
let currentView = 'home';
let currentDocId = null;

// Markdown parser (geliştirilmiş versiyon)
function parseMarkdown(markdown) {
  let html = markdown;
  
  // Code blocks (önce code block'ları koru)
  const codeBlocks = [];
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const id = `CODE_BLOCK_${codeBlocks.length}`;
    codeBlocks.push({ id, code: code.trim() });
    return id;
  });
  
  // Headers (sırayla, en büyükten küçüğe)
  html = html.replace(/^###### (.*$)/gim, '<h6>$1</h6>');
  html = html.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Horizontal rules
  html = html.replace(/^---$/gim, '<hr>');
  html = html.replace(/^\*\*\*$/gim, '<hr>');
  
  // Blockquotes
  html = html.replace(/^> (.+)$/gim, '<blockquote>$1</blockquote>');
  
  // Tables
  html = html.replace(/^\|(.+)\|$/gim, (match, content) => {
    const cells = content.split('|').map(cell => cell.trim()).filter(cell => cell);
    if (cells.length > 0) {
      // Header row kontrolü (bir sonraki satır --- içeriyorsa)
      return '<tr>' + cells.map(cell => `<td>${cell}</td>`).join('') + '</tr>';
    }
    return match;
  });
  
  // Table wrapper
  html = html.replace(/(<tr>[\s\S]*?<\/tr>)/g, (match) => {
    if (!match.includes('<table>')) {
      return '<table>' + match + '</table>';
    }
    return match;
  });
  
  // Table header detection (basit)
  html = html.replace(/<table><tr>(<td>.*?<\/td>)<\/tr>/g, (match, firstRow) => {
    return match.replace(firstRow, firstRow.replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>'));
  });
  
  // Lists (unordered)
  const lines = html.split('\n');
  let inList = false;
  let listItems = [];
  let processedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const listMatch = line.match(/^[\*\-\+]\s+(.+)$/);
    
    if (listMatch) {
      if (!inList) {
        inList = true;
        listItems = [];
      }
      listItems.push(listMatch[1]);
    } else {
      if (inList && listItems.length > 0) {
        processedLines.push('<ul>' + listItems.map(item => `<li>${item}</li>`).join('') + '</ul>');
        listItems = [];
        inList = false;
      }
      processedLines.push(line);
    }
  }
  
  if (inList && listItems.length > 0) {
    processedLines.push('<ul>' + listItems.map(item => `<li>${item}</li>`).join('') + '</ul>');
  }
  
  html = processedLines.join('\n');
  
  // Ordered lists
  inList = false;
  listItems = [];
  processedLines = [];
  const lines2 = html.split('\n');
  
  for (let i = 0; i < lines2.length; i++) {
    const line = lines2[i];
    const listMatch = line.match(/^\d+\.\s+(.+)$/);
    
    if (listMatch) {
      if (!inList) {
        inList = true;
        listItems = [];
      }
      listItems.push(listMatch[1]);
    } else {
      if (inList && listItems.length > 0) {
        processedLines.push('<ol>' + listItems.map(item => `<li>${item}</li>`).join('') + '</ol>');
        listItems = [];
        inList = false;
      }
      processedLines.push(line);
    }
  }
  
  if (inList && listItems.length > 0) {
    processedLines.push('<ol>' + listItems.map(item => `<li>${item}</li>`).join('') + '</ol>');
  }
  
  html = processedLines.join('\n');
  
  // Inline formatting (code block'lardan sonra)
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  
  // Italic (bold'dan sonra)
  html = html.replace(/(?<!\*)\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/(?<!_)_(?!_)([^_]+?)(?<!_)_(?!_)/g, '<em>$1</em>');
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  
  // Code blocks'ları geri yerleştir
  codeBlocks.forEach(({ id, code }) => {
    html = html.replace(id, `<pre><code>${escapeHtml(code)}</code></pre>`);
  });
  
  // Paragraphs (son adım)
  html = html.split('\n\n').map(para => {
    const trimmed = para.trim();
    if (!trimmed) return '';
    if (trimmed.match(/^<[h|u|o|p|d|b|t|i|]/)) {
      return trimmed;
    }
    return '<p>' + trimmed + '</p>';
  }).filter(p => p).join('\n\n');
  
  // Clean up
  html = html.replace(/\n{3,}/g, '\n\n');
  html = html.replace(/<p><\/p>/g, '');
  
  return html;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load docs data
async function loadDocsData() {
  // Önce global window.DOCS_DATA'yı kontrol et (script tag ile yüklenmiş olabilir)
  if (window.DOCS_DATA) {
    docsData = window.DOCS_DATA;
    initializeApp();
    return;
  }
  
  // Eğer yoksa fetch ile dene
  try {
    const response = await fetch('docs-data.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    docsData = await response.json();
    initializeApp();
  } catch (error) {
    console.error('Error loading docs data:', error);
    
    // Hata mesajını göster
    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
      mainContent.innerHTML = `
        <div style="padding: 48px; text-align: center; color: #A3A3A3;">
          <h2 style="color: #FF6B7A; margin-bottom: 16px;">Dokümantasyon Verileri Yüklenemedi</h2>
          <p style="margin-bottom: 24px;">Lütfen aşağıdaki adımları takip edin:</p>
          <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(163, 163, 163, 0.2); border-radius: 8px; padding: 24px; max-width: 600px; margin: 0 auto; text-align: left;">
            <p style="margin-bottom: 16px;"><strong>1. Dokümantasyon verilerini oluşturun:</strong></p>
            <pre style="background: rgba(0, 0, 0, 0.3); padding: 12px; border-radius: 4px; overflow-x: auto; margin-bottom: 16px;"><code>cd project-docs
node generate-docs-data.js</code></pre>
            <p style="margin-bottom: 16px;"><strong>2. Bir HTTP server kullanın:</strong></p>
            <pre style="background: rgba(0, 0, 0, 0.3); padding: 12px; border-radius: 4px; overflow-x: auto; margin-bottom: 16px;"><code># Python ile:
python3 -m http.server 8000

# veya Node.js ile:
npx http-server -p 8000</code></pre>
            <p style="margin-bottom: 0;"><strong>3. Tarayıcıda açın:</strong> <code style="color: #D0F205;">http://localhost:8000</code></p>
          </div>
          <p style="margin-top: 24px; font-size: 0.875rem;">Hata detayı: ${error.message}</p>
        </div>
      `;
    }
  }
}

// Initialize app
function initializeApp() {
  renderSidebar();
  renderHomeView();
  setupEventListeners();
}

// Render sidebar
function renderSidebar() {
  const sidebarNav = document.getElementById('sidebarNav');
  let html = '';
  
  for (const [categoryId, category] of Object.entries(docsData.categories)) {
    if (category.files.length === 0) continue;
    
    html += `
      <div class="nav-category">
        <div class="category-header" data-category="${categoryId}">
          <i class="fas ${category.icon}"></i>
          <span>${category.name}</span>
          <i class="fas fa-chevron-down" style="margin-left: auto; font-size: 0.75rem;"></i>
        </div>
        <div class="category-items" data-category-items="${categoryId}">
    `;
    
    category.files.forEach(fileId => {
      const file = docsData.files.find(f => f.id === fileId);
      if (file) {
        html += `<a href="#" class="nav-item" data-doc-id="${file.id}">${file.title}</a>`;
      }
    });
    
    html += `
        </div>
      </div>
    `;
  }
  
  sidebarNav.innerHTML = html;
  
  // Category toggle
  document.querySelectorAll('.category-header').forEach(header => {
    header.addEventListener('click', (e) => {
      const categoryId = header.dataset.category;
      const items = document.querySelector(`[data-category-items="${categoryId}"]`);
      header.classList.toggle('collapsed');
      items.classList.toggle('expanded');
    });
  });
  
  // Default: expand all categories
  document.querySelectorAll('.category-items').forEach(items => {
    items.classList.add('expanded');
  });
  
  // Nav item clicks
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const docId = item.dataset.docId;
      loadDocument(docId);
      
      // Update active state
      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      // Close mobile menu
      closeMobileMenu();
    });
  });
}

// Render home view
function renderHomeView() {
  const categoriesGrid = document.getElementById('categoriesGrid');
  let html = '';
  
  for (const [categoryId, category] of Object.entries(docsData.categories)) {
    if (category.files.length === 0) continue;
    
    html += `
      <div class="category-card" data-category="${categoryId}">
        <div class="category-card-icon">
          <i class="fas ${category.icon}"></i>
        </div>
        <h3 class="category-card-title">${category.name}</h3>
        <p class="category-card-count">${category.files.length} dokümantasyon</p>
      </div>
    `;
  }
  
  categoriesGrid.innerHTML = html;
  
  // Category card clicks
  document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
      const categoryId = card.dataset.category;
      const category = docsData.categories[categoryId];
      if (category.files.length > 0) {
        // İlk dokümantasyonu yükle
        loadDocument(category.files[0]);
      }
    });
  });
}

// Load document
function loadDocument(docId) {
  const doc = docsData.files.find(f => f.id === docId);
  if (!doc) {
    console.error('Document not found:', docId);
    return;
  }
  
  currentDocId = docId;
  currentView = 'document';
  
  // Update views
  document.getElementById('homeView').style.display = 'none';
  document.getElementById('searchResultsView').style.display = 'none';
  document.getElementById('documentView').style.display = 'block';
  
  // Update breadcrumb
  const category = Object.values(docsData.categories).find(cat => cat.files.includes(docId));
  const breadcrumb = document.getElementById('breadcrumb');
  breadcrumb.innerHTML = `
    <a href="#" class="breadcrumb-item" data-action="home">Ana Sayfa</a>
    <span class="breadcrumb-item active">${category ? category.name : 'Dokümantasyon'}</span>
    <span class="breadcrumb-item active">${doc.title}</span>
  `;
  
  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(nav => {
    nav.classList.remove('active');
    if (nav.dataset.docId === docId) {
      nav.classList.add('active');
    }
  });
  
  // Render document content
  const documentContent = document.getElementById('documentContent');
  const parsedContent = parseMarkdown(doc.content);
  documentContent.innerHTML = parsedContent;
  
  // Scroll to top
  window.scrollTo(0, 0);
  
  // Update URL (without reload)
  window.history.pushState({ docId }, '', `#${docId}`);
}

// Show home view
function showHomeView() {
  currentView = 'home';
  currentDocId = null;
  
  document.getElementById('homeView').style.display = 'block';
  document.getElementById('documentView').style.display = 'none';
  document.getElementById('searchResultsView').style.display = 'none';
  
  const breadcrumb = document.getElementById('breadcrumb');
  breadcrumb.innerHTML = '<a href="#" class="breadcrumb-item active" data-action="home">Ana Sayfa</a>';
  
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  
  window.history.pushState({}, '', '#');
}

// Search functionality
function performSearch(query) {
  if (!query || query.trim().length < 2) {
    document.getElementById('searchResultsView').style.display = 'none';
    if (currentView === 'home') {
      document.getElementById('homeView').style.display = 'block';
    } else {
      document.getElementById('documentView').style.display = 'block';
    }
    return;
  }
  
  const searchTerm = query.toLowerCase();
  const results = [];
  
  docsData.files.forEach(file => {
    const titleMatch = file.title.toLowerCase().includes(searchTerm);
    const contentMatch = file.content.toLowerCase().includes(searchTerm);
    
    if (titleMatch || contentMatch) {
      // Find snippet
      const contentLower = file.content.toLowerCase();
      const index = contentLower.indexOf(searchTerm);
      let snippet = '';
      
      if (index !== -1) {
        const start = Math.max(0, index - 100);
        const end = Math.min(file.content.length, index + searchTerm.length + 100);
        snippet = file.content.substring(start, end);
        // Highlight search term
        snippet = snippet.replace(
          new RegExp(searchTerm, 'gi'),
          match => `<mark>${match}</mark>`
        );
      } else {
        snippet = file.content.substring(0, 200) + '...';
      }
      
      const category = Object.values(docsData.categories).find(cat => cat.files.includes(file.id));
      
      results.push({
        ...file,
        snippet,
        categoryName: category ? category.name : 'Diğer'
      });
    }
  });
  
  // Show results
  if (results.length > 0) {
    renderSearchResults(results);
  } else {
    renderNoResults();
  }
}

function renderSearchResults(results) {
  currentView = 'search';
  
  document.getElementById('homeView').style.display = 'none';
  document.getElementById('documentView').style.display = 'none';
  document.getElementById('searchResultsView').style.display = 'block';
  
  const resultsList = document.getElementById('searchResultsList');
  let html = '';
  
  results.forEach(result => {
    html += `
      <div class="search-result-item" data-doc-id="${result.id}">
        <div class="search-result-title">${result.title}</div>
        <div class="search-result-category">${result.categoryName}</div>
        <div class="search-result-snippet">...${result.snippet}...</div>
      </div>
    `;
  });
  
  resultsList.innerHTML = html;
  
  // Result item clicks
  document.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const docId = item.dataset.docId;
      loadDocument(docId);
    });
  });
}

function renderNoResults() {
  document.getElementById('searchResultsView').style.display = 'block';
  document.getElementById('searchResultsList').innerHTML = 
    '<div class="no-results">Arama sonucu bulunamadı.</div>';
}

// Setup event listeners
function setupEventListeners() {
  // Search input
  const searchInput = document.getElementById('searchInput');
  let searchTimeout;
  
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performSearch(e.target.value);
    }, 300);
  });
  
  // Mobile menu toggle
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const sidebarToggle = document.getElementById('sidebarToggle');
  
  mobileMenuToggle.addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
  });
  
  sidebarToggle.addEventListener('click', () => {
    closeMobileMenu();
  });
  
  // Breadcrumb home click
  document.addEventListener('click', (e) => {
    if (e.target.dataset.action === 'home') {
      e.preventDefault();
      showHomeView();
    }
  });
  
  // Close mobile menu on outside click
  document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && 
        !mobileMenuToggle.contains(e.target)) {
      closeMobileMenu();
    }
  });
  
  // Handle browser back/forward
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.docId) {
      loadDocument(e.state.docId);
    } else {
      showHomeView();
    }
  });
  
  // Handle hash on load
  if (window.location.hash) {
    const docId = window.location.hash.substring(1);
    const doc = docsData.files.find(f => f.id === docId);
    if (doc) {
      loadDocument(docId);
    }
  }
}

function closeMobileMenu() {
  document.getElementById('sidebar').classList.remove('open');
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadDocsData);
} else {
  loadDocsData();
}

