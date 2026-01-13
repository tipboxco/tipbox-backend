# Otomatik Deployment Rehberi - Hetzner Test Sunucusu

Bu doküman, Tipbox Backend projesinin Hetzner test sunucusuna (188.245.150.117) otomatik olarak deploy edilmesi için gerekli tüm adımları içerir.

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Sunucu Tarafı Kurulum](#sunucu-tarafı-kurulum)
3. [Proje Tarafı Yapılandırma](#proje-tarafı-yapılandırma)
4. [GitHub Actions Workflow](#github-actions-workflow)
5. [İlk Deployment](#ilk-deployment)
6. [Otomatik Deployment](#otomatik-deployment)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Genel Bakış

### Deployment Stratejisi

- **Test Branch**: `test` veya `staging` branch'ine push yapıldığında otomatik deploy
- **Deployment Yöntemi**: GitHub Actions → SSH ile sunucuya bağlan → Docker Compose ile deploy
- **Zero-Downtime**: Rolling deployment stratejisi (opsiyonel, ileride eklenebilir)

### Mimari

```
GitHub Repository
    ↓ (push to test branch)
GitHub Actions Workflow
    ↓ (SSH connection)
Hetzner Server (188.245.150.117)
    ↓ (docker-compose)
Docker Containers:
  - Backend (Node.js)
  - PostgreSQL
  - Redis
  - MinIO
  - Nginx (reverse proxy)
```

---

## 🖥️ Sunucu Tarafı Kurulum

### 1. İlk Sunucu Hazırlığı

SSH ile sunucuya bağlanın:
```bash
ssh root@188.245.150.117
```

### 2. Sistem Güncellemesi ve Temel Kurulumlar

```bash
# Sistem güncellemesi
apt update && apt upgrade -y

# Temel araçlar
apt install -y curl wget git ufw htop nano

# Docker kurulumu
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Docker Compose kurulumu
apt install docker-compose-plugin -y

# Docker servisini başlat
systemctl start docker
systemctl enable docker

# Docker kullanıcı izinlerini ayarla (opsiyonel, root kullanıyorsanız gerekmez)
# usermod -aG docker $USER
```

### 3. Firewall Yapılandırması

```bash
# Firewall kurallarını ayarla
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw --force enable

# Firewall durumunu kontrol et
ufw status
```

### 4. Deployment Dizini Oluşturma

```bash
# Proje dizini oluştur
mkdir -p /opt/tipbox-backend
cd /opt/tipbox-backend

# Dizin izinlerini ayarla
chmod 755 /opt/tipbox-backend
```

### 5. SSH Key Yapılandırması (GitHub Actions için)

GitHub Actions'ın sunucuya SSH ile bağlanabilmesi için:

#### 5.1. SSH Key Oluşturma (Sunucuda)

```bash
# Deployment için özel bir kullanıcı oluştur (önerilir)
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy

# Deploy kullanıcısına geç
su - deploy

# SSH key oluştur (eğer yoksa)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy -N ""

# Public key'i authorized_keys'e ekle
cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh

# Private key'i göster (bunu GitHub Secrets'a ekleyeceğiz)
cat ~/.ssh/github_actions_deploy
```

**ÖNEMLİ**: Private key çıktısını kopyalayın, GitHub Secrets'a ekleyeceğiz.

#### 5.2. Alternatif: Root Kullanıcı ile (Daha Az Güvenli)

Eğer root kullanıcı ile devam edecekseniz:

```bash
# Root kullanıcısında SSH key oluştur
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy -N ""

# Public key'i authorized_keys'e ekle
cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Private key'i göster
cat ~/.ssh/github_actions_deploy
```

### 6. Git Repository Erişimi

Sunucunun GitHub repository'ye erişebilmesi için:

#### Seçenek 1: SSH Key ile (Önerilen)

```bash
# Deploy kullanıcısına geç (veya root'ta)
su - deploy  # veya root'ta kalın

# GitHub için SSH key oluştur
ssh-keygen -t ed25519 -C "deploy@hetzner-server" -f ~/.ssh/github_deploy -N ""

# Public key'i göster
cat ~/.ssh/github_deploy.pub
```

Bu public key'i GitHub repository Settings → Deploy keys → Add deploy key bölümüne ekleyin.

#### Seçenek 2: Personal Access Token (PAT)

GitHub Personal Access Token oluşturun ve GitHub Secrets'a ekleyin (workflow'da kullanılacak).

### 7. Environment Variables Dosyası

```bash
cd /opt/tipbox-backend

# .env dosyası oluştur
nano .env
```

Aşağıdaki içeriği ekleyin (değerleri kendi production değerlerinizle değiştirin):

```env
# Server
NODE_ENV=production
PORT=3000
NODE_OPTIONS=--max-old-space-size=4096

# Database
DATABASE_URL=postgresql://tipbox_user:STRONG_PASSWORD_HERE@postgres:5432/tipbox_prod
POSTGRES_PASSWORD=STRONG_PASSWORD_HERE

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=STRONG_REDIS_PASSWORD_HERE

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-MIN-32-CHARS

# MinIO Storage
S3_ENDPOINT=http://minio:9000
S3_BUCKET_NAME=tipbox-media
S3_REGION=eu-central-1
MINIO_ROOT_USER=tipbox_minio_user
MINIO_ROOT_PASSWORD=STRONG_MINIO_PASSWORD_HERE

# Email (Google Workspace OAuth 2.0)
GOOGLE_APPLICATION_CREDENTIALS=/app/tipboxbackend-3e2c3d3c0b31.json
EMAIL_USER_TO_IMPERSONATE=info@tipbox.co
EMAIL_FROM_NAME=Tipbox

# CORS
CORS_ORIGINS=https://tipbox.co,https://www.tipbox.co,http://188.245.150.117
CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS

# Auth0 (opsiyonel)
AUTH0_DOMAIN=your-auth0-domain.auth0.com
AUTH0_AUDIENCE=https://tipbox-backend
```

**Güvenlik Notu**: Tüm şifreleri güçlü, rastgele değerlerle değiştirin!

### 8. Google Service Account JSON Dosyası

```bash
# Google Service Account JSON dosyasını yükle
cd /opt/tipbox-backend

# SCP ile dosyayı yükle (local makineden)
# scp tipboxbackend-3e2c3d3c0b31.json root@188.245.150.117:/opt/tipbox-backend/

# Veya nano ile oluşturup içeriği yapıştırın
nano tipboxbackend-3e2c3d3c0b31.json
```

### 9. Nginx Yapılandırması (Opsiyonel - SSL için)

Eğer domain kullanacaksanız:

```bash
cd /opt/tipbox-backend

# Nginx config oluştur
nano nginx.conf
```

Nginx config içeriği için `HETZNER_DEPLOYMENT.md` dosyasına bakın.

### 10. Log Dizinleri

```bash
mkdir -p /opt/tipbox-backend/logs/nginx
chmod -R 755 /opt/tipbox-backend/logs
```

---

## 💻 Proje Tarafı Yapılandırma

### 1. Production Dockerfile Oluşturma

Proje root dizininde `Dockerfile.prod` dosyası oluşturulmalı (veya mevcut Dockerfile production için güncellenmeli).

### 2. Production Docker Compose Dosyası

`docker-compose.prod.yml` dosyası oluşturulmuştur. Bu dosya production ortamı için optimize edilmiştir.

**Özellikler:**
- Multi-stage build ile optimize edilmiş image boyutu
- Health check'ler tüm servisler için
- Production-ready konfigürasyonlar
- Volume'lar ile data persistence

### 3. Nginx Yapılandırması (Opsiyonel)

`nginx.conf.example` dosyasını `nginx.conf` olarak kopyalayın ve gerekirse düzenleyin:

```bash
cp nginx.conf.example nginx.conf
nano nginx.conf
```

**Not**: SSL sertifikası yoksa, mevcut nginx.conf HTTP üzerinden çalışacak şekilde yapılandırılmıştır.

### 4. GitHub Secrets Yapılandırması

GitHub repository'de Settings → Secrets and variables → Actions bölümüne aşağıdaki secrets eklenmelidir:

#### Gerekli Secrets:

1. **HETZNER_HOST**: `188.245.150.117`
2. **HETZNER_USER**: `root` veya `deploy` (oluşturduğunuz kullanıcı)
3. **HETZNER_SSH_KEY**: Sunucuda oluşturduğunuz private SSH key (tam içerik)
   - **ÖNEMLİ**: Private key'in tamamını kopyalayın (başında `-----BEGIN OPENSSH PRIVATE KEY-----` ve sonunda `-----END OPENSSH PRIVATE KEY-----` olmalı)
   - Satır sonları korunmalı
4. **HETZNER_SSH_PORT**: `22` (varsayılan, opsiyonel)
5. **GITHUB_TOKEN**: GitHub Personal Access Token (repository erişimi için, opsiyonel - eğer private repo ise gerekli)

#### Secret Ekleme Adımları:

1. GitHub repository'ye gidin
2. Settings → Secrets and variables → Actions
3. "New repository secret" butonuna tıklayın
4. Her secret için:
   - Name: `HETZNER_HOST`
   - Secret: `188.245.150.117`
   - Add secret

### 5. GitHub Actions Workflow Dosyası

`.github/workflows/deploy-hetzner-test.yml` dosyası oluşturulmuştur.

**Özellikler:**
- `test` veya `staging` branch'ine push yapıldığında otomatik deploy
- TypeScript build kontrolü
- Linter kontrolü (opsiyonel, hata durumunda devam eder)
- SSH ile güvenli bağlantı
- Health check ile deployment doğrulama
- Eski Docker image'larını temizleme

### 6. Deployment Script

`scripts/deploy.sh` dosyası oluşturulmuştur. Bu script sunucuda manuel olarak da çalıştırılabilir:

```bash
# Test branch için
bash /opt/tipbox-backend/scripts/deploy.sh test

# Staging branch için
bash /opt/tipbox-backend/scripts/deploy.sh staging
```

---

## 🔄 GitHub Actions Workflow

### Workflow Dosyası: `.github/workflows/deploy-hetzner-test.yml`

Bu dosya, belirli bir branch'e (örn: `test` veya `staging`) push yapıldığında otomatik olarak deploy işlemini başlatır.

**Özellikler:**
- Sadece `test` branch'ine push yapıldığında çalışır
- TypeScript build kontrolü
- SSH ile sunucuya bağlanır
- Git pull yapar
- Docker image'ı build eder
- Docker Compose ile deploy eder
- Migration'ları çalıştırır
- Health check yapar

### Workflow Tetikleme

Workflow şu durumlarda tetiklenir:
- `test` branch'ine push yapıldığında
- `test` branch'ine pull request merge edildiğinde
- Manuel olarak (workflow_dispatch)

---

## 🚀 İlk Deployment

### 1. GitHub Secrets Kontrolü

GitHub repository'de tüm secrets'ların eklendiğinden emin olun:
- `HETZNER_HOST`
- `HETZNER_USER`
- `HETZNER_SSH_KEY`
- `HETZNER_SSH_PORT`

### 2. Sunucu Hazırlığı Kontrolü

```bash
ssh root@188.245.150.117

# Docker kontrolü
docker --version
docker compose version

# Dizin kontrolü
ls -la /opt/tipbox-backend

# .env dosyası kontrolü
cat /opt/tipbox-backend/.env
```

### 3. İlk Manuel Deployment (Test)

```bash
cd /opt/tipbox-backend

# Repository'yi klonla (eğer yoksa)
git clone <repository-url> .

# Test branch'ine geç
git checkout test

# Environment dosyasını kontrol et
ls -la .env

# Docker Compose ile build ve deploy
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Migration'ları çalıştır
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy

# Logları kontrol et
docker compose -f docker-compose.prod.yml logs -f backend
```

### 4. Health Check

```bash
# Backend health check
curl http://localhost:3000/health

# Veya sunucu IP'si üzerinden
curl http://188.245.150.117:3000/health
```

### 5. GitHub Actions ile İlk Otomatik Deploy

```bash
# Local'de test branch'ine geç
git checkout test

# Küçük bir değişiklik yap (örn: README'ye not ekle)
echo "# Test deployment" >> README.md

# Commit ve push
git add .
git commit -m "test: trigger first automated deployment"
git push origin test
```

GitHub Actions sekmesinde workflow'un çalıştığını görebilirsiniz.

---

## 🔁 Otomatik Deployment

### Deployment Akışı

1. **Developer** `test` branch'ine push yapar
2. **GitHub Actions** workflow tetiklenir
3. **Build** aşaması: TypeScript compile, test (opsiyonel)
4. **Deploy** aşaması:
   - SSH ile sunucuya bağlanır
   - Git pull yapar
   - Docker image build eder
   - Docker Compose ile container'ları günceller
   - Migration'ları çalıştırır
   - Health check yapar
5. **Notification** (opsiyonel): Slack/Discord/Email bildirimi

### Branch Stratejisi

```
main/master     → Production (manuel deploy)
    ↓
test/staging   → Test Server (otomatik deploy) ← ŞU AN BURADAYIZ
    ↓
develop        → Development (local)
```

### Deployment Komutları (Sunucuda)

Workflow şu komutları çalıştırır:

```bash
cd /opt/tipbox-backend
git pull origin test
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
```

---

## 🔧 Maintenance ve Güncelleme

### Manuel Deployment (Acil Durumlar)

```bash
ssh root@188.245.150.117
cd /opt/tipbox-backend
git pull origin test
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d backend
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
```

### Log Kontrolü

```bash
# Backend logları
docker compose -f docker-compose.prod.yml logs -f backend

# Tüm servisler
docker compose -f docker-compose.prod.yml logs -f

# Son 100 satır
docker compose -f docker-compose.prod.yml logs --tail=100 backend
```

### Container Durumu

```bash
# Çalışan container'lar
docker compose -f docker-compose.prod.yml ps

# Container resource kullanımı
docker stats
```

### Database Migration

```bash
# Migration durumu
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate status

# Yeni migration uygula
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
```

### Rollback (Geri Alma)

```bash
# Önceki commit'e dön
cd /opt/tipbox-backend
git checkout <previous-commit-hash>
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d backend
```

---

## 🐛 Troubleshooting

### 1. SSH Bağlantı Hatası

**Hata**: `Permission denied (publickey)`

**Çözüm**:
```bash
# GitHub Secrets'da SSH key'in doğru olduğundan emin olun
# Sunucuda authorized_keys kontrolü
cat ~/.ssh/authorized_keys

# SSH key formatını kontrol edin (başında/tırnağında boşluk olmamalı)
```

### 2. Docker Build Hatası

**Hata**: `Cannot connect to Docker daemon`

**Çözüm**:
```bash
# Docker servisini kontrol et
systemctl status docker
systemctl start docker

# Kullanıcının docker grubunda olduğundan emin ol
usermod -aG docker $USER
```

### 3. Git Pull Hatası

**Hata**: `Permission denied` veya `Repository not found`

**Çözüm**:
```bash
# SSH key'in GitHub'a eklendiğinden emin olun
# Veya Personal Access Token kullanın
git config --global credential.helper store
```

### 4. Migration Hatası

**Hata**: `Migration failed`

**Çözüm**:
```bash
# Migration durumunu kontrol et
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate status

# Database bağlantısını kontrol et
docker compose -f docker-compose.prod.yml exec backend npx prisma db pull
```

### 5. Container Başlamıyor

**Hata**: `Container exited with code 1`

**Çözüm**:
```bash
# Logları kontrol et
docker compose -f docker-compose.prod.yml logs backend

# Environment variables kontrolü
docker compose -f docker-compose.prod.yml exec backend env | grep DATABASE_URL

# Container'ı yeniden başlat
docker compose -f docker-compose.prod.yml restart backend
```

### 6. Port Çakışması

**Hata**: `Port already in use`

**Çözüm**:
```bash
# Port kullanımını kontrol et
netstat -tulpn | grep :3000

# Eski container'ı durdur
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### 7. Disk Doluluk

**Hata**: `No space left on device`

**Çözüm**:
```bash
# Disk kullanımını kontrol et
df -h

# Eski Docker image'ları temizle
docker system prune -a --volumes

# Log dosyalarını temizle
find /opt/tipbox-backend/logs -type f -mtime +7 -delete
```

---

## 📊 Monitoring ve Alerting

### Health Check Endpoint

```bash
# Backend health check
curl http://188.245.150.117:3000/health

# Beklenen response
{"status":"ok","timestamp":"2025-01-XX..."}
```

### Log Monitoring

```bash
# Real-time log takibi
docker compose -f docker-compose.prod.yml logs -f backend

# Hata loglarını filtrele
docker compose -f docker-compose.prod.yml logs backend | grep -i error
```

### Resource Monitoring

```bash
# Container resource kullanımı
docker stats

# Sistem kaynakları
htop
```

---

## 🔒 Güvenlik Best Practices

1. **SSH Key Güvenliği**
   - Private key'leri asla commit etmeyin
   - GitHub Secrets kullanın
   - Düzenli olarak key'leri rotate edin

2. **Environment Variables**
   - `.env` dosyasını asla commit etmeyin
   - Güçlü şifreler kullanın
   - Production şifrelerini düzenli değiştirin

3. **Firewall**
   - Sadece gerekli portları açın
   - SSH için fail2ban kurun (opsiyonel)

4. **Docker Security**
   - Non-root user kullanın (mümkünse)
   - Image'ları düzenli güncelleyin
   - Security scan yapın

5. **Backup**
   - Düzenli database backup alın
   - MinIO data backup'ı yapın
   - Backup'ları test edin

---

## ✅ Deployment Checklist

### İlk Kurulum
- [ ] Sunucu hazırlandı (Docker, Docker Compose)
- [ ] Firewall yapılandırıldı
- [ ] SSH key oluşturuldu ve GitHub Secrets'a eklendi
- [ ] `.env` dosyası oluşturuldu (production değerleriyle)
- [ ] Google Service Account JSON yüklendi
- [ ] Nginx yapılandırıldı (opsiyonel)
- [ ] Log dizinleri oluşturuldu

### Proje Yapılandırması
- [x] Production Dockerfile oluşturuldu (`Dockerfile.prod`)
- [x] `docker-compose.prod.yml` oluşturuldu
- [x] GitHub Actions workflow dosyası oluşturuldu (`.github/workflows/deploy-hetzner-test.yml`)
- [x] Deployment script oluşturuldu (`scripts/deploy.sh`)
- [x] Nginx config örneği oluşturuldu (`nginx.conf.example`)
- [ ] GitHub Secrets eklendi (aşağıdaki adımları takip edin)

### İlk Deployment
- [ ] Repository sunucuya klonlandı
- [ ] İlk manuel deployment başarılı
- [ ] Health check başarılı
- [ ] Migration'lar uygulandı
- [ ] GitHub Actions workflow test edildi

### Sürekli İyileştirme
- [ ] Monitoring kuruldu
- [ ] Backup stratejisi uygulandı
- [ ] Alerting yapılandırıldı (opsiyonel)
- [ ] Dokümantasyon güncellendi

---

## 📝 Notlar

- **Test Branch**: Şu an için `test` branch'i kullanılıyor, isterseniz `staging` veya başka bir branch kullanabilirsiniz
- **Zero-Downtime**: İleride blue-green deployment veya rolling update eklenebilir
- **CI/CD Pipeline**: Test aşaması şu an yok, ileride eklenebilir
- **Multi-Environment**: Production için ayrı bir workflow oluşturulabilir

---

**Son Güncelleme**: 2025-01-XX
**Sunucu IP**: 188.245.150.117
**Deployment Branch**: `test`

