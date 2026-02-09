#!/usr/bin/env node
/**
 * Cloudflare Tunnel - Published Application Routes (API ile oluşturur)
 * npm run tunnel'dan önce çalıştırılır.
 *
 * Credentials: cloudflared/.env (backend-api ile karışmaz)
 * Gerekli: TUNNEL_CLOUDFLARE_API_TOKEN, TUNNEL_CLOUDFLARE_ACCOUNT_ID
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Sadece cloudflared/.env yükle (backend-api Cloudflare hesabından ayrı)
function loadEnv(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const content = fs.readFileSync(resolved, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (val) process.env[key] = val;
      }
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Önce script yanındaki .env, sonra cwd/cloudflared/.env
const envPaths = [
  path.join(__dirname, '.env'),
  path.join(process.cwd(), 'cloudflared', '.env'),
];
const loaded = envPaths.some((p) => loadEnv(p));
if (!loaded) {
  console.warn('⚠️ cloudflared/.env bulunamadı. Aranan:', envPaths[0]);
}

const TUNNEL_ID = process.env.TUNNEL_ID || 'bf6b66c8-5cff-420c-8ea9-a1f67aed24ab';
const TUNNEL_DOMAIN = process.env.TUNNEL_DOMAIN || 'exportergo.com';
const TUNNEL_API_SUBDOMAIN = process.env.TUNNEL_API_SUBDOMAIN || 'api-tipbox';
const TUNNEL_MINIO_SUBDOMAIN = process.env.TUNNEL_MINIO_SUBDOMAIN || 'minio-tipbox';
const API_HOST = `${TUNNEL_API_SUBDOMAIN}.${TUNNEL_DOMAIN}`;
const MINIO_HOST = `${TUNNEL_MINIO_SUBDOMAIN}.${TUNNEL_DOMAIN}`;
const BACKEND_PORT = process.env.TUNNEL_BACKEND_PORT || '3000';
const MINIO_PORT = process.env.TUNNEL_MINIO_PORT || '9000';

const CREDENTIALS_PATH = path.join(__dirname, '..', '.cloudflared', `${TUNNEL_ID}.json`);

const CONFIG = {
  config: {
    ingress: [
      {
        hostname: API_HOST,
        service: `http://localhost:${BACKEND_PORT}`,
        originRequest: { connectTimeout: 30 },
      },
      {
        hostname: MINIO_HOST,
        service: `http://localhost:${MINIO_PORT}`,
        originRequest: { connectTimeout: 30 },
      },
      { service: 'http_status:404' },
    ],
    'warp-routing': { enabled: false },
  },
};

async function getAccountId() {
  const fromEnv = process.env.TUNNEL_CLOUDFLARE_ACCOUNT_ID;
  if (fromEnv) return fromEnv;

  try {
    const cred = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    return cred.AccountTag || cred.account_tag;
  } catch {
    return null;
  }
}

async function setupRoutes() {
  const token = process.env.TUNNEL_CLOUDFLARE_API_TOKEN;
  const accountId = process.env.TUNNEL_CLOUDFLARE_ACCOUNT_ID || (await getAccountId());

  if (!token) {
    console.warn('⚠️ TUNNEL_CLOUDFLARE_API_TOKEN yok - Published routes atlanıyor.');
    console.warn('   cloudflared/.env dosyasında TUNNEL_CLOUDFLARE_API_TOKEN tanımlı mı?');
    console.warn('   Dosya yolu:', path.resolve(__dirname, '.env'));
    console.warn('   Routes zaten Dashboard\'da tanımlıysa devam edebilirsiniz.');
    return;
  }

  if (!accountId) {
    console.warn('⚠️ TUNNEL_CLOUDFLARE_ACCOUNT_ID yok - Published routes atlanıyor.')
    return;
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${TUNNEL_ID}/configurations`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(CONFIG),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('❌ Cloudflare API hatası:', res.status, JSON.stringify(data, null, 2));
    process.exit(1);
  }

  if (!data.success) {
    console.error('❌ Cloudflare API başarısız:', data.errors || data.messages);
    process.exit(1);
  }

  console.log('✅ Published application routes güncellendi.');
  console.log(`   - ${API_HOST} → localhost:${BACKEND_PORT}`);
  console.log(`   - ${MINIO_HOST} → localhost:${MINIO_PORT} (MinIO)`);

  // DNS route'ları oluştur (her subdomain için CNAME)
  const hostnames = [API_HOST, MINIO_HOST];
  for (const hostname of hostnames) {
    const r = spawnSync('cloudflared', ['tunnel', 'route', 'dns', TUNNEL_ID, hostname], {
      stdio: 'inherit',
      shell: true,
    });
    if (r.status !== 0) {
      console.warn(`⚠️ DNS route atlanıyor: ${hostname} (cloudflared bulunamadı veya hata)`);
    }
  }
}

setupRoutes().catch((err) => {
  console.error('❌ Hata:', err.message);
  process.exit(1);
});
