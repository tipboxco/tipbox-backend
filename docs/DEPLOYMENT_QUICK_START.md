# Deployment Hızlı Başlangıç Rehberi

Bu rehber, Hetzner test sunucusuna (188.245.150.117) hızlı bir şekilde deploy yapmak için gerekli minimum adımları içerir.

## 🚀 Hızlı Başlangıç (5 Dakika)

### 1. Sunucu Hazırlığı (İlk Kez)

```bash
# Sunucuya SSH ile bağlan
ssh root@188.245.150.117

# Temel kurulumlar
apt update && apt upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
apt install docker-compose-plugin -y

# Firewall
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable

# Proje dizini
mkdir -p /opt/tipbox-backend && cd /opt/tipbox-backend
```

### 2. SSH Key Oluşturma (GitHub Actions için)

```bash
# SSH key oluştur
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy -N ""

# Public key'i authorized_keys'e ekle
cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys

# Private key'i göster (GitHub Secrets'a eklenecek)
cat ~/.ssh/github_actions_deploy
```

**ÖNEMLİ**: Private key çıktısını kopyalayın!

### 3. GitHub Secrets Ekleme

GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Eklenecek secrets:
- `HETZNER_HOST`: `188.245.150.117`
- `HETZNER_USER`: `root`
- `HETZNER_SSH_KEY`: (yukarıda kopyaladığınız private key)
- `HETZNER_SSH_PORT`: `22` (opsiyonel)

### 4. Environment Dosyası Oluşturma

```bash
# Sunucuda
cd /opt/tipbox-backend
nano .env
```

Aşağıdaki template'i kullanın (değerleri değiştirin):

```env
NODE_ENV=production
PORT=3000
NODE_OPTIONS=--max-old-space-size=4096

DATABASE_URL=postgresql://tipbox_user:STRONG_PASSWORD@postgres:5432/tipbox_prod
POSTGRES_PASSWORD=STRONG_PASSWORD

REDIS_URL=redis://redis:6379
REDIS_PASSWORD=STRONG_REDIS_PASSWORD

JWT_SECRET=your-super-secret-jwt-key-min-32-chars-long

S3_ENDPOINT=http://minio:9000
S3_BUCKET_NAME=tipbox-media
S3_REGION=eu-central-1
MINIO_ROOT_USER=tipbox_minio_user
MINIO_ROOT_PASSWORD=STRONG_MINIO_PASSWORD

GOOGLE_APPLICATION_CREDENTIALS=/app/tipboxbackend-3e2c3d3c0b31.json
EMAIL_USER_TO_IMPERSONATE=info@tipbox.co
EMAIL_FROM_NAME=Tipbox

CORS_ORIGINS=http://188.245.150.117,https://tipbox.co
CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS
```

### 5. Google Service Account JSON

```bash
# Sunucuda dosyayı oluşturun ve içeriğini yapıştırın
nano /opt/tipbox-backend/tipboxbackend-3e2c3d3c0b31.json

# Local makinedeki tipboxbackend-3e2c3d3c0b31.json dosyasının içeriğini kopyalayın,
# sunucudaki nano editörüne yapıştırın ve kaydedip çıkın (CTRL+O, ENTER, CTRL+X)

### 6. İlk Manuel Deployment

```bash
# Sunucuda
cd /opt/tipbox-backend

# Repository'yi klonla
git clone <repository-url> .
git checkout test

# Nginx config (opsiyonel)
cp nginx.conf.example nginx.conf

# İlk deployment
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
```

### 7. Health Check

```bash
# Backend health check
curl http://localhost:3000/health

# Veya sunucu IP'si üzerinden
curl http://188.245.150.117:3000/health
```

## ✅ Otomatik Deployment

Artık `test` branch'ine push yaptığınızda otomatik olarak deploy edilecek:

```bash
# Local'de
git checkout test
git add .
git commit -m "feat: new feature"
git push origin test
```

GitHub Actions otomatik olarak:
1. Code'u build edecek
2. Sunucuya SSH ile bağlanacak
3. Git pull yapacak
4. Docker image build edecek
5. Container'ları güncelleyecek
6. Migration'ları çalıştıracak
7. Health check yapacak

## 🔧 Sık Kullanılan Komutlar

### Log Kontrolü

```bash
# Backend logları
docker compose -f docker-compose.prod.yml logs -f backend

# Tüm servisler
docker compose -f docker-compose.prod.yml logs -f
```

### Container Durumu

```bash
# Çalışan container'lar
docker compose -f docker-compose.prod.yml ps

# Container'ı yeniden başlat
docker compose -f docker-compose.prod.yml restart backend
```

### Manuel Deployment

```bash
# Deployment script'i kullan
bash /opt/tipbox-backend/scripts/deploy.sh test
```

## 🐛 Sorun Giderme

### SSH Bağlantı Hatası

```bash
# GitHub Secrets'da SSH key'in doğru olduğundan emin olun
# Sunucuda authorized_keys kontrolü
cat ~/.ssh/authorized_keys
```

### Container Başlamıyor

```bash
# Logları kontrol et
docker compose -f docker-compose.prod.yml logs backend

# Environment variables kontrolü
docker compose -f docker-compose.prod.yml exec backend env | grep DATABASE_URL
```

### Migration Hatası

```bash
# Migration durumunu kontrol et
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate status
```

## 📚 Detaylı Dokümantasyon

Daha detaylı bilgi için:
- [AUTOMATED_DEPLOYMENT.md](./AUTOMATED_DEPLOYMENT.md) - Tam deployment rehberi
- [HETZNER_DEPLOYMENT.md](./HETZNER_DEPLOYMENT.md) - Hetzner sunucu kurulum rehberi

---

**Sunucu IP**: 188.245.150.117  
**Deployment Branch**: `test`  
**Workflow**: `.github/workflows/deploy-hetzner-test.yml`

