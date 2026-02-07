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

export function getSwaggerServers() {
  const PORT = process.env.PORT || 3000;
  const nodeEnv = config.nodeEnv;

  // Öncelik sırası:
  // 1. BASE_URL (en yüksek öncelik - local veya sunucu için)
  // 2. SWAGGER_SERVER_URL veya API_BASE_URL (sunucu için)
  // 3. Localhost (fallback - sadece development)
  
  const baseUrl = process.env.BASE_URL || process.env.SWAGGER_SERVER_URL || process.env.API_BASE_URL;
  
  if (baseUrl) {
    // BASE_URL tam URL olabilir (http://example.com) veya sadece host (example.com)
    let cleanUrl = baseUrl.replace(/\/$/, '');
    // Eğer protocol yoksa http:// ekle
    if (!cleanUrl.match(/^https?:\/\//)) {
      cleanUrl = `http://${cleanUrl}`;
    }
    // Port yoksa ve development ise PORT ekle
    if (nodeEnv === 'development' && !cleanUrl.match(/:\d+$/)) {
      cleanUrl = cleanUrl.replace(/\/$/, '') + `:${PORT}`;
    }
    return [{ 
      url: cleanUrl, 
      description: `${nodeEnv === 'development' ? 'Development' : nodeEnv === 'test' ? 'Test' : 'Production'} (${baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1') ? 'Local' : 'Server'})` 
    }];
  }

  switch (nodeEnv) {
    case 'development': {
      // Local development için localhost kullan
      return [{ url: `http://localhost:${PORT}`, description: 'Development (Localhost)' }];
    }
    case 'test': {
      const testUrl = 'https://api-test.tipbox.co';
      return [{ url: testUrl, description: 'Test Environment' }];
    }
    case 'production': {
      const prodUrl = 'https://api.tipbox.co';
      return [{ url: prodUrl, description: 'Production' }];
    }
    default: {
      return [{ url: `http://localhost:${PORT}`, description: 'Development (Localhost)' }];
    }
  }
}

export function getSwaggerOptions() {
  return {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Tipbox API',
        version: '1.0.0',
        description: 'Tipbox servisleri için API dokümantasyonu',
      },
      servers: getSwaggerServers(),
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

  window.addEventListener('load', function () {
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
        if ((url.includes('/auth/login') || url.includes('/admin/login')) && method === 'POST') {
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

