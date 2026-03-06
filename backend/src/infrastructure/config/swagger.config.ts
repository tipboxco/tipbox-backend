import swaggerJSDoc from 'swagger-jsdoc';
import fs from 'fs';
import path from 'path';
import config from './index';

/**
 * swagger-jsdoc `apis` path'leri process.cwd()'ye göre resolve edilir.
 * Prod/test gibi ortamlarda proses farklı bir cwd ile başlayabildiği için
 * relative path'ler (./src/...) bazen hiç eşleşmez ve components/schemas gibi
 * tanımlar spec'e giremez. Bu yüzden backend root'u __dirname üzerinden sabitleyip
 * absolute glob path'leri kullanıyoruz.
 *
 * - src runtime:  <backend>/src/infrastructure/config  -> ../../.. = <backend>
 * - dist runtime: <backend>/dist/infrastructure/config -> ../../.. = <backend>
 */
const BACKEND_ROOT = path.resolve(__dirname, '../../..');
function getSwaggerApis(): string[] {
  const srcInterfacesDir = path.join(BACKEND_ROOT, 'src', 'interfaces');
  const distInterfacesDir = path.join(BACKEND_ROOT, 'dist', 'interfaces');

  // Aynı anda hem src hem dist varsa, duplicate/çakışma yaşamamak için src'yi tercih et.
  if (fs.existsSync(srcInterfacesDir)) {
    return [path.join(srcInterfacesDir, '**/*.ts')];
  }

  // Prod/test image'larda src yoksa dist'i kullan.
  if (fs.existsSync(distInterfacesDir)) {
    return [path.join(distInterfacesDir, '**/*.js')];
  }

  // Fallback: relative glob (en azından local geliştirmede çalışır)
  return ['./src/interfaces/**/*.ts'];
}

/**
 * Tek base URL için kullanılacak (env ve BASE_URL'e göre).
 * Routing değişmez; sadece Swagger dokümantasyonunda "App" vs "Admin" seçeneği sunar.
 */
function getBaseServerUrl(): { url: string; envLabel: string } {
  const PORT = process.env.PORT || 3000;
  const nodeEnv = config.nodeEnv;
  const baseUrl = process.env.BASE_URL || process.env.SWAGGER_SERVER_URL || process.env.API_BASE_URL;

  if (baseUrl) {
    let cleanUrl = baseUrl.replace(/\/$/, '');
    if (!cleanUrl.match(/^https?:\/\//)) cleanUrl = `http://${cleanUrl}`;
    if (nodeEnv === 'development' && !cleanUrl.match(/:\d+$/)) {
      cleanUrl = cleanUrl.replace(/\/$/, '') + `:${PORT}`;
    }
    const envLabel =
      nodeEnv === 'development' ? 'Development' : nodeEnv === 'test' ? 'Test' : 'Production';
    return { url: cleanUrl, envLabel };
  }

  switch (nodeEnv) {
    case 'test':
      return { url: 'https://api-test.tipbox.co', envLabel: 'Test' };
    case 'production':
      return { url: 'https://api.tipbox.co', envLabel: 'Production' };
    default:
      return { url: `http://localhost:${PORT}`, envLabel: 'Development (Localhost)' };
  }
}

/**
 * Swagger UI'da Server dropdown: aynı URL ile "App API" ve "Admin API" seçenekleri.
 * EP routing değişmez; sadece dokümantasyon gruplaması.
 */
export function getSwaggerServers() {
  const { url, envLabel } = getBaseServerUrl();
  return [
    { url, description: `App API — Kullanıcı ve uygulama endpoint'leri (${envLabel})` },
    { url, description: `Admin API — Admin panel endpoint'leri (${envLabel})` },
  ];
}

/** Swagger UI'da grupların sırası ve kısa açıklamaları. Authentication en üstte, sonra Admin, sonra App. */
const SWAGGER_TAGS: Array<{ name: string; description: string }> = [
  { name: 'Authentication', description: 'Giriş, kayıt ve token (App)' },
  { name: 'Admin - Auth', description: 'Admin giriş ve oturum' },
  { name: 'Admin - Dashboard', description: 'Admin genel istatistikler' },
  { name: 'Admin - Users', description: 'Admin kullanıcı yönetimi' },
  { name: 'Admin - Reports & KYC', description: 'Şikayetler, KYC ve güven skorları' },
  { name: 'Admin - Logs', description: 'Admin işlem logları' },
  { name: 'Admin - Content', description: 'İçerik, post, yorum, highlight, trending' },
  { name: 'Admin - Event Gamification', description: 'Event, koleksiyon ve badge yönetimi' },
  { name: 'Users', description: 'Kullanıcı profili ve ayarları (App)' },
  { name: 'Feed', description: 'Feed ve gönderiler (App)' },
  { name: 'Inventory', description: 'Envanter (App)' },
  { name: 'Wallet', description: 'Cüzdan ve işlemler (App)' },
  { name: 'Events', description: 'Eventler (App)' },
  { name: 'Collections', description: 'Koleksiyonlar ve badge ilerlemesi (App)' },
  { name: 'Notifications', description: 'Bildirimler (App)' },
  { name: 'Inbox', description: 'Mesajlaşma (App)' },
  { name: 'Admin', description: 'Genel admin (eski tag, yeni gruplara taşındı)' },
];

export function getSwaggerOptions() {
  return {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Tipbox API',
        version: '1.0.0',
        description: 'Tipbox servisleri için API dokümantasyonu. Server\'da App API / Admin API aynı base URL\'i kullanır; gruplama sadece dokümantasyon içindir.',
      },
      servers: getSwaggerServers(),
      tags: SWAGGER_TAGS,
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
    apis: getSwaggerApis(),
  };
}

export function getSwaggerSpec() {
  return swaggerJSDoc(getSwaggerOptions());
}

export const swaggerAuthHelperJs = `
(function () {
  const STORAGE_KEY = 'tipbox_swagger_token';

  function applyToken(ui, token) {
    if (!ui || !token) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, token);
      ui.authActions.authorize({
        bearerAuth: {
          name: 'bearerAuth',
          schema: { type: 'http', scheme: 'bearer' },
          value: token,
        },
      });
    } catch (err) {
      console.warn('Swagger auth auto-apply failed', err);
    }
  }

  function getContextFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const c = params.get('context');
    return c === 'admin' ? 'admin' : c === 'all' ? 'all' : 'app';
  }

  function injectContextDropdown() {
    var root = document.querySelector('.swagger-ui');
    if (!root || document.getElementById('tipbox-api-context-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'tipbox-api-context-bar';
    bar.style.cssText = 'padding:12px 20px;background:#1b1b1b;color:#fff;display:flex;align-items:center;gap:10px;font-family:system-ui,sans-serif;';
    bar.innerHTML = '<label for="tipbox-api-context" style="font-weight:600;">API:</label>' +
      '<select id="tipbox-api-context" style="padding:6px 10px;border-radius:4px;min-width:140px;">' +
      '<option value="all">Tümü (All)</option>' +
      '<option value="app">App API</option>' +
      '<option value="admin">Admin API</option>' +
      '</select>';
    var sel = bar.querySelector('select');
    sel.value = getContextFromUrl();
    sel.addEventListener('change', function () {
      window.location.href = window.location.pathname + '?context=' + sel.value;
    });
    root.insertBefore(bar, root.firstChild);
  }

  function navigateByContext(context) {
    window.location.href = window.location.pathname + '?context=' + context;
  }

  function hookServersDropdownForFiltering() {
    var selects = document.querySelectorAll('.swagger-ui select');
    for (var i = 0; i < selects.length; i++) {
      var sel = selects[i];
      if (sel.dataset.tipboxHooked === 'yes') continue;
      var opts = [].slice.call(sel.options || []);
      var hasApp = opts.some(function (o) { return o.text.indexOf('App API') !== -1; });
      var hasAdmin = opts.some(function (o) { return o.text.indexOf('Admin API') !== -1; });
      if (!hasApp || !hasAdmin) continue;
      sel.dataset.tipboxHooked = 'yes';
      var ctx = getContextFromUrl();
      for (var j = 0; j < opts.length; j++) {
        if (ctx === 'admin' && opts[j].text.indexOf('Admin API') !== -1) { sel.selectedIndex = j; break; }
        if (ctx === 'app' && opts[j].text.indexOf('App API') !== -1) { sel.selectedIndex = j; break; }
      }
      sel.addEventListener('change', function () {
        var text = (this.options[this.selectedIndex] && this.options[this.selectedIndex].text) || '';
        if (text.indexOf('Admin API') !== -1) navigateByContext('admin');
        else if (text.indexOf('App API') !== -1) navigateByContext('app');
      });
      break;
    }
  }

  function tryHookServersDropdown() {
    hookServersDropdownForFiltering();
  }

  window.addEventListener('load', function () {
    injectContextDropdown();
    tryHookServersDropdown();
    [300, 600, 1000, 2000].forEach(function (ms) {
      setTimeout(tryHookServersDropdown, ms);
    });

    const ui = window.ui;
    if (!ui) return;

    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) applyToken(ui, saved);

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await originalFetch(...args);
      try {
        const url = args[0] ? args[0].toString() : '';
        const method = (args[1]?.method || 'GET').toUpperCase();
        if ((url.includes('/api/auth/login') || url.includes('/api/admin/login')) && method === 'POST') {
          const clone = response.clone();
          const data = await clone.json().catch(() => null);
          const token = data?.token || data?.access_token || data?.accessToken;
          if (token) applyToken(ui, token);
        }
      } catch (err) {
        console.warn('Swagger auth token capture failed', err);
      }
      return response;
    };
  });
})();
`;

