# Test Ortami Deploy Rehberi

## 1. Server On Kosullar

```bash
# Docker & Docker Compose
docker --version        # >= 24
docker compose version  # >= 2.20

# Git
git --version           # >= 2.30

# Node.js & pnpm (prisma generate icin)
node --version          # >= 23
pnpm --version          # >= 9
```

Eksik varsa:

```bash
# Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Node.js 23
curl -fsSL https://deb.nodesource.com/setup_23.x | bash -
apt-get install -y nodejs
corepack enable && corepack prepare pnpm@9.15.0 --activate
```

---

## 2. Repo Klonla

```bash
mkdir -p /opt
cd /opt
git clone git@github.com:tipboxco/tipbox-backend.git
cd tipbox-backend
git checkout test
```

---

## 3. Dosyalari Hazirla

### 3a. Root `.env` (docker-compose icin - ANA DOSYA)

```bash
cp .env.example .env
nano .env
```

Test ortamina ozel degistirilecekler:

```env
# Postgres (test defaults)
POSTGRES_USER=tipbox_user
POSTGRES_PASSWORD=tipbox_test_password
POSTGRES_DB=tipbox_test

# Database URL (compose override eder ama yine de eslessin)
DATABASE_URL=postgresql://tipbox_user:tipbox_test_password@postgres:5432/tipbox_test

# Node
NODE_ENV=test

# Base URL (test domain)
BASE_URL=https://api-test.tipbox.co
TUNNEL_URL=https://api-test.tipbox.co

# CORS (test domainleri ekle)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:5173,http://localhost:9002,https://api-test.tipbox.co

# S3 (docker icindeki minio)
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123

# Auth0, JWT, Thirdweb, Gemini, Google... gercek degerleri gir
AUTH0_DOMAIN=https://tipbox-auth.us.auth0.com
JWT_SECRET=<guclu-bir-secret>
# ... diger secretlar
```

### 3b. `backend/.env.test` (workflow kontrolu icin)

Workflow `backend/.env.test` dosyasinin varligini kontrol ediyor. Olustur:

```bash
cp backend/env.test.example.txt backend/.env.test
nano backend/.env.test
```

Root `.env` ile ayni degerleri gir (backend'e ait olanlar).

### 3c. Google Service Account

```bash
# Lokaldeki JSON dosyasini server'a kopyala
scp backend/tipboxbackend-3e2c3d3c0b31.json user@SERVER:/opt/tipbox-backend/backend/
```

### 3d. nginx.conf

Mevcut `nginx.conf` zaten test icin ayarli (`server_name api-test.tipbox.co`). Kontrol et:

```bash
cat nginx.conf | grep server_name
# Cikti: server_name api-test.tipbox.co localhost;
```

### 3e. SSL (Opsiyonel)

SSL yoksa nginx HTTP modunda calisir. SSL eklemek icin:

```bash
mkdir -p ssl certbot/conf certbot/www
# Certbot veya mevcut sertifikalari ssl/ altina koy
# Sonra nginx.conf'taki HTTPS blogunu uncomment et
```

---

## 4. GitHub Secrets

GitHub repo > Settings > Secrets > Actions'a ekle:

| Secret | Deger |
|--------|-------|
| `HETZNER_SSH_KEY` | Server SSH private key (tam icerik) |
| `HETZNER_HOST` | Server IP veya hostname |
| `HETZNER_USER` | SSH kullanici adi (root veya deploy user) |
| `HETZNER_SSH_PORT` | SSH portu (varsayilan: 22) |

---

## 5. Ilk Deploy (Sifirdan)

### Secnekler

GitHub Actions > Deploy to Test Server > Run workflow:

| Secenek | Ilk deploy icin | Aciklama |
|---------|-----------------|----------|
| **branch** | `test` | Deploy edilecek branch |
| **run_seed** | `true` | DB bos, seed gerekli |
| **force_rebuild** | `true` | Ilk sefer, cache yok |
| **skip_backup** | `true` | DB bos, backup anlamsiz |

### Ne olur (sirayla):

1. **prepare** - git pull, `backend/.env.test` kontrol
2. ~~backup~~ - atlanir (skip_backup=true)
3. **stop** - eski container varsa durdurur
4. **build** - `--no-cache` ile image build (force_rebuild=true)
5. **prisma** - Prisma Client generate
6. **infrastructure** - postgres, redis, minio ayaga kalkar
7. **wait-db** - postgres hazir olana kadar bekler
8. **migrate** - prisma migrate deploy + db push
9. **seed** - clear-and-seed.ts calisir (run_seed=true)
10. **start** - tum servisler baslar (backend, nginx, admin-panel, catalog-service, prisma-studio)
11. **health** - `/health` endpoint kontrol
12. **cleanup** - eski image'lar temizlenir

---

## 6. Sonraki Deploylar (Normal)

`test` branch'ine push yapildiginda **otomatik** calisir:

| Secenek | Otomatik deger | Aciklama |
|---------|----------------|----------|
| run_seed | `false` | Mevcut data korunur |
| force_rebuild | `false` | Cache kullanilir (hizli) |
| skip_backup | `false` | DB backup alinir |

Manuel tetiklemek icin: Actions > Run workflow > varsayilanlari birak.

---

## 7. Deploy Sonrasi Kontrol

```bash
# Server'da
ssh user@SERVER

# Container durumu
cd /opt/tipbox-backend
docker compose -f docker-compose.test.yml ps

# Backend loglari
docker compose -f docker-compose.test.yml logs -f backend

# Health check
curl http://localhost:3000/health

# Dis erisim (domain ayarliysa)
curl https://api-test.tipbox.co/health
```

---

## 8. Sorun Giderme

```bash
cd /opt/tipbox-backend

# Tek servisi yeniden baslat
docker compose -f docker-compose.test.yml restart backend

# Loglar
docker compose -f docker-compose.test.yml logs --tail=100 backend
docker compose -f docker-compose.test.yml logs --tail=50 postgres

# DB'ye baglan
docker compose -f docker-compose.test.yml exec postgres psql -U tipbox_user -d tipbox_test

# Redis kontrol
docker compose -f docker-compose.test.yml exec redis redis-cli ping

# MinIO kontrol
docker compose -f docker-compose.test.yml exec minio mc ls local

# Tum servisleri sifirla
docker compose -f docker-compose.test.yml down -v  # DIKKAT: volumeleri siler
docker compose -f docker-compose.test.yml up -d
```

---

## Ozet: Server'da Olmasi Gereken Dosyalar

```
/opt/tipbox-backend/
├── .env                                    # Ana env dosyasi (docker-compose okur)
├── backend/.env.test                       # Workflow kontrolu icin
├── backend/tipboxbackend-*.json            # Google service account
├── nginx.conf                              # Repo'dan gelir (git tracked)
├── docker-compose.test.yml                 # Repo'dan gelir (git tracked)
└── ssl/                                    # SSL sertifikalari (opsiyonel)
    ├── fullchain.pem
    └── privkey.pem
```
