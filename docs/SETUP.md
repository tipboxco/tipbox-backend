# Tipbox – Kurulum Rehberi

Bu doküman, Tipbox monorepo’sunu (backend, admin-panel, catalog-service) **Docker Compose** ile çalıştırmak ve ortam değişkenlerini ayarlamak için adım adım rehberdir.

---

## İçindekiler

1. [Ön Gereksinimler](#1-ön-gereksinimler)
2. [Hızlı Başlangıç](#2-hızlı-başlangıç)
3. [Ortam Değişkenleri (.env)](#3-ortam-değişkenleri-env)
4. [Docker Servisleri ve Portlar](#4-docker-servisleri-ve-portlar)
5. [Harici Servisler ve API Anahtarları](#5-harici-servisler-ve-api-anahtarları)
6. [Veritabanı ve Seed](#6-veritabanı-ve-seed)
7. [Yerel Geliştirme (Docker Olmadan)](#7-yerel-geliştirme-docker-olmadan)
8. [Sorun Giderme](#8-sorun-giderme)

---

## 1. Ön Gereksinimler

| Gereksinim | Açıklama |
|------------|----------|
| **Docker Desktop** | Docker ve Docker Compose. [İndir](https://www.docker.com/products/docker-desktop/) |
| **Git** | Repo klonlama |
| **Node.js 18+** | Docker kullanmadan yerel çalıştırma için |
| **pnpm 9+** | Monorepo paket yöneticisi. `corepack enable && corepack prepare pnpm@9.15.0 --activate` |

Kontrol:

```bash
docker --version
docker-compose --version
```

---

## 2. Hızlı Başlangıç

```bash
# 1. Repo klonla
git clone <repository-url>
cd tipbox-backend

# 2. Global .env oluştur (proje kökünde)
cp .env.example .env
# Gerekli key'leri .env içinde doldurun (minimal: POSTGRES_*, MINIO_*, JWT_SECRET)

# 3. Tüm servisleri başlat
docker-compose up -d --build

# 4. Veritabanı şemasını uygula
docker-compose exec backend npx prisma db push

# 5. (İsteğe bağlı) Seed data yükle
docker-compose exec backend pnpm run db:seed
```

- **Backend API:** http://localhost:3000  
- **Admin Panel:** http://localhost:5174  
- **Catalog (Medusa):** http://localhost:9002 (API), http://localhost:5173 (Admin UI)  
- **Prisma Studio:** `docker-compose exec backend npx prisma studio --port 5555` → http://localhost:5555  

---

## 3. Ortam Değişkenleri (.env)

Tüm Docker Compose servisleri **proje kökündeki tek bir `.env`** dosyasını kullanır.

### 3.1 .env Oluşturma

```bash
cp .env.example .env
```

`.env.example` içinde her key için **Kullanım** ve **Nereden alınır** (linkler dahil) açıklamaları vardır.

### 3.2 Key Grupları Özeti

| Grup | Zorunluluk (minimal çalışma) | Açıklama |
|------|------------------------------|----------|
| `POSTGRES_*`, `MINIO_*` | Evet | Docker Postgres/MinIO + connection string’ler |
| `DATABASE_URL`, `REDIS_URL` | Evet | Backend ve catalog bağlantıları |
| `JWT_SECRET` | Evet | Backend JWT doğrulama |
| `AUTH0_*`, `CLIENT_*`, `SECRET` | Login için | Auth0 Dashboard |
| `THIRDWEB_*`, `ADMIN_PRIVATE_KEY` | Web3/NFT için | Thirdweb Dashboard / Engine |
| `S3_*` | MinIO ile aynı | S3/MinIO (local’de MinIO varsayılanla çalışır) |
| `CORS_ORIGINS` | Önerilir | Frontend/admin origin’leri |
| `GEMINI_API_KEY`, `GOOGLE_*` | AI/Translate için | Google Cloud / AI Studio |
| `VITE_API_BASE_URL` | Admin panel için | Backend API URL’i |

Detaylı açıklamalar ve **hangi key’in nereden alınacağı** için doğrudan **`.env.example`** dosyasındaki yorum satırlarına bakın.

---

## 4. Docker Servisleri ve Portlar

| Servis | Container | Port (host) | Açıklama |
|--------|-----------|-------------|----------|
| **Backend** | tipbox_backend | 3000 | Express API |
| **Admin Panel** | tipbox_admin_panel | 5174 | Vite React admin |
| **Catalog Service** | tipbox_catalog_service | 9002 (API), 5173 (Admin) | Medusa e-ticaret |
| **PostgreSQL** | tipbox_postgres | 5432 | Ana DB (backend + medusa ayrı DB’ler) |
| **Redis** | tipbox_redis | 6379 | Cache / kuyruk |
| **MinIO** | tipbox_minio | 9000 (API), 9001 (Console) | S3 uyumlu depolama |
| **PgAdmin** | tipbox_pgadmin | 5050 | DB yönetimi (opsiyonel) |
| **Nginx** | tipbox_nginx | 80, 443 | Reverse proxy (SSL ile kullanılıyorsa) |

Tüm servisler `docker-compose.yml` içinde **`.env`** ile yapılandırılır; `${VAR:-default}` kullanımı vardır.

---

## 5. Harici Servisler ve API Anahtarları

Aşağıdaki key’leri kullanmak için ilgili servislerde hesap açıp değerleri `.env` içine yazmanız gerekir. `.env.example` içinde her biri için “Nereden alınır” ve linkler bulunur.

| Servis | Key’ler | Nereden alınır |
|--------|--------|-----------------|
| **Auth0** | `AUTH0_DOMAIN`, `ISSUER_BASE_URL`, `CLIENT_ID`, `CLIENT_SECRET`, `SECRET` | [Auth0 Dashboard](https://manage.auth0.com/) → Applications → [Uygulama] → Settings |
| **Thirdweb** | `THIRDWEB_CLIENT_ID`, `THIRDWEB_SECRET_KEY`, `ADMIN_PRIVATE_KEY`, `THIRDWEB_WEBHOOK_SECRET` | [Thirdweb API Keys](https://thirdweb.com/dashboard/settings/api-keys), [Engine](https://engine.thirdweb.com/) (Webhooks) |
| **Alchemy** | `ALCHEMY_WEBHOOK_SIGNING_KEY` | [Alchemy Dashboard](https://dashboard.alchemy.com/) → Notify → Webhooks |
| **Google / Gemini** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials), [Google AI Studio](https://aistudio.google.com/app/apikey) |
| **Canny** | `CANNY_SSO_PRIVATE_KEY` | [Canny Admin](https://canny.io/admin/settings/security) → SSO redirect → Private Key |

Sadece API’yi ayağa kaldırmak için Auth0 ve JWT yeterli; Web3, Alchemy, Gemini vb. ilgili özellikleri kullanacaksanız o key’leri ekleyin.

---

## 6. Veritabanı ve Seed

### Şema uygulama

```bash
docker-compose exec backend npx prisma db push
```

### Prisma Client (tip hataları için)

```bash
docker-compose exec backend npx prisma generate
```

### Seed (test verisi)

```bash
docker-compose exec backend pnpm run db:seed
```

Seed sonrası test kullanıcıları (backend/docs/SETUP_GUIDE.md ile uyumlu):

- **Email:** `omer@tipbox.co`  
- **Şifre:** `password123`  

Diğer test hesapları için: [backend/docs/SETUP_GUIDE.md](backend/docs/SETUP_GUIDE.md#-test-kullanıcı-bilgileri).

### Prisma Studio

```bash
docker-compose exec backend npx prisma studio --port 5555 --browser none
```

Tarayıcıda: http://localhost:5555

---

## 7. Yerel Geliştirme (Docker Olmadan)

Bu repo **pnpm monorepo** yapısındadır. Tüm bağımlılıklar kökten tek komutla yüklenir.

### 7.1 pnpm ile (önerilen)

```bash
# Kökte
pnpm install
cp .env.example .env   # Gerekli key'leri doldurun

# Backend
pnpm run backend       # backend dev server (nodemon)

# Admin Panel
pnpm run admin         # admin-panel dev (Vite)

# Catalog (Medusa)
pnpm run catalog       # catalog-service dev
```

- **PostgreSQL / Redis / MinIO** yerelde kurulu olmalı veya sadece bu servisleri Docker ile açıp uygulamaları host’tan çalıştırabilirsiniz. `.env` içinde `DATABASE_URL` ve `REDIS_URL`’i localhost’a göre ayarlayın (örn. `postgres:5432` → `localhost:5432`).

### 7.2 node_modules temizleme

Tüm projelerdeki `node_modules` klasörlerini silip yeniden kurmak için:

```bash
pnpm run clean:modules
pnpm install
```

Detaylı backend adımları: [backend/docs/SETUP_GUIDE.md](backend/docs/SETUP_GUIDE.md).

---

## 8. Sorun Giderme

### Docker / Compose

| Sorun | Çözüm |
|-------|--------|
| Port zaten kullanımda | `docker-compose.yml` içinde ilgili servisin `ports` değerini değiştirin veya çakışan uygulamayı kapatın. |
| `.env` okunmuyor | `.env` dosyasının **proje kökünde** (docker-compose.yml ile aynı dizinde) olduğundan emin olun. |
| Build hatası | `docker-compose build --no-cache backend` (veya ilgili servis) deneyin. |

### Veritabanı

| Sorun | Çözüm |
|-------|--------|
| "Table does not exist" | `docker-compose exec backend npx prisma db push` |
| Bağlantı hatası | `docker-compose ps` ile postgres/redis’in up olduğunu kontrol edin. `.env` içinde `DATABASE_URL`’in `postgres:5432` (container adı) kullandığından emin olun. |

### Backend

| Sorun | Çözüm |
|-------|--------|
| Prisma Client tip hataları | `docker-compose exec backend npx prisma generate` ve gerekirse `docker-compose restart backend` |
| Auth0 / CORS hataları | `CORS_ORIGINS` ve Auth0 callback URL’lerinin (Auth0 Dashboard’da) doğru olduğundan emin olun. |

Daha fazla senaryo: [backend/docs/SETUP_GUIDE.md](backend/docs/SETUP_GUIDE.md#-sorun-giderme).

---

## İlgili Dokümanlar

- **`.env.example`** – Tüm ortam değişkenleri, kullanım yerleri ve key’leri nereden alacağınız (linklerle).
- **[backend/docs/SETUP_GUIDE.md](backend/docs/SETUP_GUIDE.md)** – Backend odaklı kurulum, test kullanıcıları, Prisma komutları.
- **[CLAUDE.md](CLAUDE.md)** – Proje mimarisi ve kod standartları.

---

**Son güncelleme:** Proje kökünde tek `.env`, pnpm monorepo ve `clean:modules` script’i dahil edilmiştir.
