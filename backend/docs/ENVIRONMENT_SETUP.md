# Ortam Kurulum Rehberi

Bu doküman, Tipbox Backend projesinin farklı ortamlar (Developer, Test, Production) için kurulum ve yapılandırma adımlarını içerir.

## 📋 İçindekiler

1. [Ortam Ayrışımı](#ortam-ayrışımı)
2. [Developer Ortamı](#developer-ortamı)
3. [Test Ortamı](#test-ortamı)
4. [Production Ortamı](#production-ortamı)
5. [Environment Variables](#environment-variables)
6. [Docker Compose Kullanımı](#docker-compose-kullanımı)

---

## Ortam Ayrışımı

Proje üç farklı ortam için yapılandırılmıştır:

| Ortam | Branch | Docker Compose | Database | Environment File |
|-------|--------|----------------|----------|------------------|
| **Developer** | `developer` | `docker-compose.yml` | `tipbox_dev` | `.env` |
| **Test** | `test` | `docker-compose.test.yml` | `tipbox_test` | `.env.test` |
| **Production** | `main` | `docker-compose.production.yml` | `tipbox_prod` | `.env.production` |

---

## Developer Ortamı

### Özellikler

- Hot reload (nodemon)
- Debug modu aktif
- Verbose logging (debug level)
- Tüm portlar expose (5432, 6379, 9000, 3000, 5555)
- Prisma Studio ve PgAdmin erişimi
- Test data seed edilebilir

### Kurulum

1. **Repository'yi klonlayın:**

```bash
git clone <repository-url>
cd tipbox-backend
git checkout developer
```

2. **Environment dosyasını oluşturun:**

```bash
cp env.example.txt .env
# .env dosyasını düzenleyin
```

3. **Docker Compose ile servisleri başlatın:**

```bash
npm run docker:up
```

4. **Database migration'larını çalıştırın:**

```bash
npm run db:migrate
```

5. **Seed data ekleyin (opsiyonel):**

```bash
npm run db:seed:all
```

6. **Backend'i başlatın:**

```bash
npm run dev
```

### Erişim

- **Backend API:** http://localhost:3000
- **Prisma Studio:** http://localhost:5555
- **PgAdmin:** http://localhost:5050
- **MinIO Console:** http://localhost:9001

---

## Test Ortamı

### Özellikler

- Production-like build ama daha esnek
- Info level logging, 30 gün retention
- Health check'ler aktif
- Sınırlı port exposure
- Test data seed edilebilir
- Monitoring (opsiyonel)

### Kurulum (Hetzner Test Server)

1. **Sunucuya SSH ile bağlanın:**

```bash
ssh root@YOUR_TEST_SERVER_IP
```

2. **Proje dizinine gidin:**

```bash
cd /opt/tipbox-backend
```

3. **Test branch'ine geçin:**

```bash
git checkout test
git pull origin test
```

4. **Environment dosyasını oluşturun:**

```bash
cp .env.test.example .env.test
# .env.test dosyasını düzenleyin ve gerçek değerleri girin
```

5. **Docker Compose ile deploy edin:**

```bash
npm run docker:up:test
# veya
docker compose -f docker-compose.test.yml up -d
```

6. **Database migration'larını çalıştırın:**

```bash
docker compose -f docker-compose.test.yml run --rm backend npx prisma migrate deploy
```

### Otomatik Deployment

Test branch'ine push yapıldığında GitHub Actions otomatik olarak deploy eder:

```bash
git checkout test
git push origin test
```

### Deploy Script Kullanımı

```bash
./scripts/deploy-test.sh test
```

---

## Production Ortamı

### Özellikler

- Maximum security
- Optimized build
- Warn level console logging, Info level file logging, 90 gün retention
- Health check'ler zorunlu
- SSL/TLS zorunlu
- Minimum port exposure
- Seed YOK
- Backup otomatik (günlük + haftalık + aylık)

### Kurulum (Hetzner Production Server)

1. **Sunucuya SSH ile bağlanın:**

```bash
ssh root@YOUR_PRODUCTION_SERVER_IP
```

2. **Proje dizinine gidin:**

```bash
cd /opt/tipbox-backend
```

3. **Main branch'ine geçin:**

```bash
git checkout main
git pull origin main
```

4. **Environment dosyasını oluşturun:**

```bash
cp .env.production.example .env.production
# .env.production dosyasını düzenleyin ve GERÇEK production değerlerini girin
# ÖNEMLİ: Tüm şifreleri güçlü, rastgele değerlerle değiştirin!
```

5. **SSL sertifikalarını yükleyin:**

```bash
# SSL sertifikalarını ssl/ dizinine kopyalayın
```

6. **Docker Compose ile deploy edin:**

```bash
npm run docker:up:production
# veya
docker compose -f docker-compose.production.yml up -d
```

7. **Database migration'larını çalıştırın (backup sonrası):**

```bash
# Önce backup alın
./scripts/db-update.sh -e prod -m deploy -b

# Veya manuel:
docker compose -f docker-compose.production.yml exec -T postgres pg_dump -U tipbox_user tipbox_prod > backup-$(date +%Y%m%d-%H%M%S).sql
docker compose -f docker-compose.production.yml run --rm backend npx prisma migrate deploy
```

### Manuel Deployment (GitHub Actions)

1. GitHub Actions sekmesine gidin
2. "Deploy to Production" workflow'unu seçin
3. "Run workflow" butonuna tıklayın
4. Confirm alanına **"DEPLOY"** yazın
5. Workflow çalışacak ve production'a deploy edecek

### Deploy Script Kullanımı

```bash
./scripts/deploy-production.sh main
```

**ÖNEMLİ:** Production deployment için 10 saniye bekleme süresi vardır (iptal için Ctrl+C).

---

## Environment Variables

### Ortam Bazlı Dosyalar

- **Developer:** `.env` (veya `env.example.txt`'den kopyalayın)
- **Test:** `.env.test` (veya `.env.test.example`'dan kopyalayın)
- **Production:** `.env.production` (veya `.env.production.example`'dan kopyalayın)

### Ortam Bazlı Default Değerler

Config modülü (`src/infrastructure/config/index.ts`) ortam bazlı default değerler sağlar:

#### CORS Origins

- **Developer:** `http://localhost:3000`, `http://localhost:3001`, `http://localhost:5173`
- **Test:** `http://localhost:3000`, `https://test.tipbox.co`
- **Production:** `https://tipbox.co`, `https://www.tipbox.co`, `https://app.tipbox.co`

#### Log Levels

- **Developer:** `debug`
- **Test:** `info`
- **Production:** `warn` (console), `info` (file)

#### Log Retention

- **Developer:** 7 gün
- **Test:** 30 gün
- **Production:** 90 gün

### Gerekli Environment Variables

Tüm ortamlar için gerekli değişkenler:

```env
# Server
PORT=3000
NODE_ENV=development|test|production
NODE_OPTIONS=--max-old-space-size=4096

# Database
DATABASE_URL=postgresql://user:password@host:5432/database_name
POSTGRES_PASSWORD=your_password

# Redis
REDIS_URL=redis://:password@redis:6379
REDIS_PASSWORD=your_redis_password

# MinIO/S3
MINIO_ROOT_USER=your_minio_user
MINIO_ROOT_PASSWORD=your_minio_password
S3_ENDPOINT=http://minio:9000
S3_BUCKET_NAME=tipbox-media
S3_REGION=eu-central-1
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key

# JWT
JWT_SECRET=your-jwt-secret-key-min-32-chars

# Email
GOOGLE_APPLICATION_CREDENTIALS=/app/tipboxbackend-3e2c3d3c0b31.json
EMAIL_USER_TO_IMPERSONATE=info@tipbox.co
EMAIL_FROM_NAME=Tipbox

# CORS
CORS_ORIGINS=http://localhost:3000,https://your-domain.com
CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS,PATCH
```

---

## Docker Compose Kullanımı

### Developer Ortamı

```bash
# Servisleri başlat
npm run docker:up

# Servisleri durdur
npm run docker:down

# Logları görüntüle
npm run docker:logs
```

### Test Ortamı

```bash
# Servisleri başlat
npm run docker:up:test

# Servisleri durdur
npm run docker:down:test

# Logları görüntüle
npm run docker:logs:test
```

### Production Ortamı

```bash
# Servisleri başlat
npm run docker:up:production

# Servisleri durdur
npm run docker:down:production

# Logları görüntüle
npm run docker:logs:production
```

---

## Troubleshooting

### Environment Dosyası Bulunamadı

```bash
# Developer için
cp env.example.txt .env

# Test için
cp .env.test.example .env.test

# Production için
cp .env.production.example .env.production
```

### Database Connection Error

1. Docker container'ların çalıştığını kontrol edin:
```bash
docker compose ps
```

2. Environment dosyasındaki DATABASE_URL'i kontrol edin

3. Database'in hazır olduğunu kontrol edin:
```bash
docker compose exec postgres psql -U postgres -l
```

### Migration Hataları

```bash
# Migration durumunu kontrol edin
docker compose exec backend npx prisma migrate status

# Migration'ları sıfırdan uygulayın (DİKKAT: Sadece test/developer)
docker compose exec backend npx prisma migrate deploy
```

---

## Güvenlik Notları

1. **Production ortamında:**
   - Tüm şifreleri güçlü, rastgele değerlerle değiştirin
   - JWT_SECRET en az 64 karakter olmalı
   - SSL/TLS zorunlu
   - Environment dosyalarını asla commit etmeyin

2. **Test ortamında:**
   - Production'a benzer güvenlik ama daha esnek
   - Test data kullanılabilir

3. **Developer ortamında:**
   - Lokal kullanım için
   - Güvenlik ayarları gevşek

---

## İlgili Dokümantasyon

- [Branch Stratejisi](./BRANCH_STRATEGY.md)
- [Hetzner Deployment](./HETZNER_DEPLOYMENT.md)
- [Automated Deployment](./AUTOMATED_DEPLOYMENT.md)

