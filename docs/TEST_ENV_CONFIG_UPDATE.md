# Test Ortami Yapilandirma Guncellemesi

**Tarih:** 2026-03-01
**Domain:** `https://api-test.tipbox.co`
**Amac:** Tum localhost referanslarini test domain'ine tasima, CORS ve nginx HTTPS yapilandirmasi

---

## Degisiklik Ozeti

| Dosya | Degisiklik |
|-------|-----------|
| `.env` | BASE_URL, CORS, MinIO, Catalog CORS, Admin Panel URL |
| `docker-compose.test.yml` | Backend, Admin Panel, Catalog Service env defaults |
| `nginx.conf` | HTTPS server blogu aktif edildi |
| `backend/.env` | CORS, BASE_URL, TUNNEL_URL, MINIO_CORS |

---

## 1. Root `.env` Degisiklikleri

### BASE_URL

```diff
- BASE_URL=http://localhost:3000
+ BASE_URL=https://api-test.tipbox.co
```

### CORS_ORIGINS

```diff
- CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:5173,http://localhost:9002,https://api-test.tipbox.co,https://api-tipbox.exportergo.com
+ CORS_ORIGINS=https://api-test.tipbox.co,http://localhost:3000,http://localhost:3001,http://localhost:5173,http://localhost:9002
```

- `https://api-test.tipbox.co` birinci siraya alindi
- Eski `exportergo.com` domain'leri kaldirildi

### SEED_MEDIA_BASE_URL

```diff
- SEED_MEDIA_BASE_URL=http://localhost:9000
+ SEED_MEDIA_BASE_URL=https://api-test.tipbox.co/media
```

Nginx `/media/` proxy'si uzerinden MinIO'ya yonlendirilir.

### NFT_BADGE_IMAGE_URL

```diff
- NFT_BADGE_IMAGE_URL=https://minio-tipbox.exportergo.com
+ NFT_BADGE_IMAGE_URL=https://api-test.tipbox.co/media
```

### TUNNEL_URL

```diff
- TUNNEL_URL=https://api-tipbox.exportergo.com
+ TUNNEL_URL=https://api-test.tipbox.co
```

### MINIO_CORS_ALLOW_ORIGIN

```diff
- MINIO_CORS_ALLOW_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:5173,https://api-tipbox.exportergo.com,https://minio-tipbox.exportergo.com
+ MINIO_CORS_ALLOW_ORIGIN=https://api-test.tipbox.co,http://localhost:3000,http://localhost:3001,http://localhost:5173
```

### Catalog Service CORS

```diff
- STORE_CORS=http://localhost:8000,http://localhost:3000
- ADMIN_CORS=http://localhost:5173,http://localhost:9002
- AUTH_CORS=http://localhost:5173,http://localhost:9002,http://localhost:8000
+ STORE_CORS=https://api-test.tipbox.co,http://localhost:8000,http://localhost:3000
+ ADMIN_CORS=https://api-test.tipbox.co,http://localhost:5173,http://localhost:9002
+ AUTH_CORS=https://api-test.tipbox.co,http://localhost:5173,http://localhost:9002,http://localhost:8000
```

### VITE_API_BASE_URL (Admin Panel)

```diff
- VITE_API_BASE_URL=http://localhost:3000
+ VITE_API_BASE_URL=https://api-test.tipbox.co
```

---

## 2. docker-compose.test.yml Degisiklikleri

### Backend Service

```diff
- CORS_ORIGINS=${CORS_ORIGINS:-http://localhost:3000,http://localhost:3001,http://localhost:5173,http://localhost:9002,https://api-test.tipbox.co}
+ CORS_ORIGINS=${CORS_ORIGINS:-https://api-test.tipbox.co,http://localhost:3000,http://localhost:3001,http://localhost:5173,http://localhost:9002}

- BASE_URL=${BASE_URL:-http://localhost:3000}
+ BASE_URL=${BASE_URL:-https://api-test.tipbox.co}

- SEED_MEDIA_BASE_URL=${SEED_MEDIA_BASE_URL:-http://localhost:9000}
+ SEED_MEDIA_BASE_URL=${SEED_MEDIA_BASE_URL:-https://api-test.tipbox.co/media}
```

### Admin Panel Service

```diff
- VITE_API_BASE_URL=${VITE_API_BASE_URL:-http://localhost:3000}
+ VITE_API_BASE_URL=${VITE_API_BASE_URL:-https://api-test.tipbox.co}
```

### Catalog Service

```diff
- STORE_CORS=${STORE_CORS:-http://localhost:8000,http://localhost:3000}
- ADMIN_CORS=${ADMIN_CORS:-http://localhost:5173,http://localhost:9002}
- AUTH_CORS=${AUTH_CORS:-http://localhost:5173,http://localhost:9002,http://localhost:8000}
- S3_ENDPOINT_EXTERNAL=http://localhost:9000
+ STORE_CORS=${STORE_CORS:-https://api-test.tipbox.co,http://localhost:8000,http://localhost:3000}
+ ADMIN_CORS=${ADMIN_CORS:-https://api-test.tipbox.co,http://localhost:5173,http://localhost:9002}
+ AUTH_CORS=${AUTH_CORS:-https://api-test.tipbox.co,http://localhost:5173,http://localhost:9002,http://localhost:8000}
+ S3_ENDPOINT_EXTERNAL=https://api-test.tipbox.co/media
```

---

## 3. nginx.conf Degisiklikleri

HTTPS server blogu aktif edildi (onceden comment'li idi):

```nginx
# HTTP server (mevcut - degismedi)
server {
    listen 80;
    server_name api-test.tipbox.co localhost;
    # HTTP → HTTPS redirect (localhost haric)
    location / {
        if ($host = localhost) {
            proxy_pass http://backend;
            break;
        }
        return 301 https://$host$request_uri;
    }
}

# HTTPS server (YENI - aktif edildi)
server {
    listen 443 ssl;
    http2 on;
    server_name api-test.tipbox.co;

    ssl_certificate /etc/letsencrypt/live/api-test.tipbox.co/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-test.tipbox.co/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /media/ {
        proxy_pass http://minio:9000/tipbox-media/;
    }
}
```

SSL sertifika yolu: `/etc/letsencrypt/live/api-test.tipbox.co/` (Let's Encrypt)

---

## 4. backend/.env Degisiklikleri

```diff
- CORS_ORIGINS=http://localhost:3000,...,https://wilson-plugins-dayton-languages.trycloudflare.com,https://api-tipbox.exportergo.com
+ CORS_ORIGINS=https://api-test.tipbox.co,http://localhost:3000,http://localhost:3001,http://localhost:5173,http://localhost:9002

- NFT_BADGE_IMAGE_URL=https://minio-tipbox.exportergo.com
+ NFT_BADGE_IMAGE_URL=https://api-test.tipbox.co/media

- TUNNEL_URL=https://api-tipbox.exportergo.com
+ TUNNEL_URL=https://api-test.tipbox.co

- MINIO_CORS_ALLOW_ORIGIN=http://localhost:3000,...,https://api-tipbox.exportergo.com,https://minio-tipbox.exportergo.com
+ MINIO_CORS_ALLOW_ORIGIN=https://api-test.tipbox.co,http://localhost:3000,http://localhost:3001,http://localhost:5173

- BASE_URL=http://localhost:3000
+ BASE_URL=https://api-test.tipbox.co
```

---

## 5. Trafik Akisi

```
Client (HTTPS)
    |
    v
nginx :443 (api-test.tipbox.co)
    |
    |-- /            --> backend:3000  (Express API)
    |-- /health      --> backend:3000  (health check)
    |-- /media/*     --> minio:9000    (tipbox-media bucket)
    |-- /socket.io/  --> backend:3000  (WebSocket upgrade)
    |
    v
HTTP :80
    |-- localhost    --> backend:3000  (local dev)
    |-- api-test.*   --> 301 HTTPS redirect
```

---

## 6. Port Haritasi

| Port | Servis | Erisim |
|------|--------|--------|
| 80 | nginx (HTTP) | Public - HTTPS redirect |
| 443 | nginx (HTTPS) | Public - ana giris noktasi |
| 3000 | backend | Internal (nginx arkasinda) |
| 5050 | pgadmin | `http://SERVER_IP:5050` |
| 5173 | catalog admin dashboard | `http://SERVER_IP:5173` |
| 5174 | admin-panel | `http://SERVER_IP:5174` |
| 5555 | prisma-studio | `http://SERVER_IP:5555` |
| 9000 | minio API | Internal (nginx `/media/` proxy) |
| 9001 | minio console | `http://SERVER_IP:9001` |
| 9002 | catalog API | `http://SERVER_IP:9002` |

---

## 7. CORS Politikasi

`NODE_ENV=test` oldugunda `cors.config.ts` **tum origin'lere** izin verir. `CORS_ORIGINS` env degiskeni production icin guvenlik katmani olarak korunur.

Izin verilen origin'ler:

| Origin | Aciklama |
|--------|----------|
| `https://api-test.tipbox.co` | Test domain (nginx HTTPS) |
| `http://localhost:3000` | Backend (local/container) |
| `http://localhost:3001` | Frontend dev |
| `http://localhost:5173` | Catalog admin dashboard |
| `http://localhost:9002` | Catalog API |

Ek olarak `config/index.ts` icerisinde su origin'ler her zaman eklenir:
- `https://thirdweb.com`, `https://portal.thirdweb.com`, `https://engine.thirdweb.com`
- `https://api-tipbox.tipbox.co`, `http://api-tipbox.tipbox.co`

---

## 8. SSL Sertifikasi (Let's Encrypt)

```bash
# Server'da certbot ile sertifika alma
docker run --rm \
  -v /opt/tipbox-backend/certbot/conf:/etc/letsencrypt \
  -v /opt/tipbox-backend/certbot/www:/var/www/certbot \
  certbot/certbot certonly \
  --webroot -w /var/www/certbot \
  -d api-test.tipbox.co \
  --email admin@tipbox.co \
  --agree-tos --no-eff-email

# nginx reload
docker compose -f docker-compose.test.yml exec nginx nginx -s reload
```

Sertifika yolu (nginx.conf'ta tanimli):
```
/etc/letsencrypt/live/api-test.tipbox.co/fullchain.pem
/etc/letsencrypt/live/api-test.tipbox.co/privkey.pem
```

---

## 9. Dogrulama Kontrol Listesi

Deploy sonrasi asagidaki kontrolleri yapin:

```bash
# HTTPS erisim
curl -I https://api-test.tipbox.co/health

# HTTP -> HTTPS redirect
curl -I http://api-test.tipbox.co/health
# Beklenen: 301 -> https://api-test.tipbox.co/health

# Media proxy (MinIO)
curl -I https://api-test.tipbox.co/media/

# Backend CORS header kontrolu
curl -I -H "Origin: https://api-test.tipbox.co" https://api-test.tipbox.co/api
# Beklenen: Access-Control-Allow-Origin: https://api-test.tipbox.co

# WebSocket
wscat -c wss://api-test.tipbox.co/socket.io/?EIO=4&transport=websocket

# Admin Panel
curl -I http://SERVER_IP:5174

# Prisma Studio
curl -I http://SERVER_IP:5555
```
