# Hetzner Sunucu Deployment Rehberi

Bu doküman, Tipbox Backend projesinin Hetzner Cloud sunucusuna deploy edilmesi için adım adım rehberdir.

**Önemli Not**: Bu proje **MinIO** kullanmaktadır. MinIO, AWS S3-compatible bir object storage çözümüdür. Development ve Production ortamlarında MinIO kullanılır. İleride AWS S3'e geçiş yapılabilir çünkü kod S3-compatible yapılandırılmıştır (sadece environment variable'ları değiştirmek yeterli olacaktır).

## 📋 Ön Gereksinimler

- Hetzner Cloud hesabı
- SSH erişimi
- Docker ve Docker Compose kurulu
- Domain adresi (opsiyonel ama önerilir)

## 🔧 Sunucu Hazırlığı

### 1. Sunucu Oluşturma

1. Hetzner Cloud Console'dan yeni bir sunucu oluşturun
2. Önerilen özellikler:
   - **CPU**: 2+ vCPU
   - **RAM**: 4GB+
   - **Disk**: 40GB+ SSD
   - **OS**: Ubuntu 22.04 LTS
   - **Location**: Nürnberg (eu-central) veya Helsinki (eu-north)

### 2. Sunucu Kurulumu

```bash
# Sunucuya SSH ile bağlanın
ssh root@your-server-ip

# Sistem güncellemesi
apt update && apt upgrade -y

# Docker kurulumu
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Docker Compose kurulumu
apt install docker-compose-plugin -y

# Firewall yapılandırması
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw enable
```

## 📦 Proje Kurulumu

### 1. Proje Klonlama

```bash
# Proje dizini oluştur
mkdir -p /opt/tipbox-backend
cd /opt/tipbox-backend

# Git repo'yu klonla (veya proje dosyalarını yükle)
git clone <your-repo-url> .

# Veya mevcut projeyi yükle
scp -r /local/path/to/project root@your-server-ip:/opt/tipbox-backend
```

### 2. Environment Variables

```bash
# .env dosyası oluştur
cd /opt/tipbox-backend
nano .env
```

**Production .env örneği:**

```env
# Server
NODE_ENV=production
PORT=3000
NODE_OPTIONS=--max-old-space-size=4096

# Database
DATABASE_URL=postgresql://tipbox_user:strong_password_here@postgres:5432/tipbox_prod

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# MinIO Storage (Object Storage)
# Production'da MinIO kullanılacak (Hetzner sunucusunda)
# AWS S3'e geçiş için: S3_ENDPOINT'i değiştirmek yeterli (kod değişikliği gerekmez)
S3_ENDPOINT=http://minio:9000
S3_BUCKET_NAME=tipbox-media
S3_REGION=eu-central-1
S3_ACCESS_KEY=${MINIO_ROOT_USER}
S3_SECRET_KEY=${MINIO_ROOT_PASSWORD}
MINIO_ROOT_USER=tipbox_minio_user
MINIO_ROOT_PASSWORD=strong_minio_password_here

# Email (Google Workspace OAuth 2.0)
GOOGLE_APPLICATION_CREDENTIALS=/app/tipboxbackend-3e2c3d3c0b31.json
EMAIL_USER_TO_IMPERSONATE=info@tipbox.co
EMAIL_FROM_NAME=Tipbox

# CORS
CORS_ORIGINS=https://tipbox.co,https://www.tipbox.co
CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS

# Auth0 (opsiyonel)
AUTH0_DOMAIN=your-auth0-domain.auth0.com
AUTH0_AUDIENCE=https://tipbox-backend
```

### 3. Production Docker Compose

`docker-compose.prod.yml` dosyası oluşturun:

```yaml
services:
  postgres:
    image: postgres:15
    container_name: tipbox_postgres_prod
    restart: always
    environment:
      POSTGRES_USER: tipbox_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: tipbox_prod
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
    networks:
      - tipbox_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tipbox_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    container_name: tipbox_minio_prod
    restart: always
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - minio_prod_data:/data
    networks:
      - tipbox_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
    # Not: Production'da MinIO Console'a dışarıdan erişim için port mapping ekleyebilirsiniz
    # ports:
    #   - "9000:9000"  # API için
    #   - "9001:9001"  # Web Console için (güvenlik için firewall ile kısıtlanmalı)

  redis:
    image: redis:7-alpine
    container_name: tipbox_redis_prod
    restart: always
    volumes:
      - redis_prod_data:/data
    networks:
      - tipbox_network
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: tipbox_backend_prod
    restart: always
    environment:
      - NODE_ENV=production
      - NODE_OPTIONS=--max-old-space-size=4096
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
      - S3_ENDPOINT=http://minio:9000
      - S3_BUCKET_NAME=${S3_BUCKET_NAME}
      - S3_REGION=${S3_REGION}
      - S3_ACCESS_KEY=${MINIO_ROOT_USER}
      - S3_SECRET_KEY=${MINIO_ROOT_PASSWORD}
      - MINIO_ROOT_USER=${MINIO_ROOT_USER}
      - MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - GOOGLE_APPLICATION_CREDENTIALS=/app/tipboxbackend-3e2c3d3c0b31.json
      - EMAIL_USER_TO_IMPERSONATE=${EMAIL_USER_TO_IMPERSONATE}
      - EMAIL_FROM_NAME=${EMAIL_FROM_NAME}
      - CORS_ORIGINS=${CORS_ORIGINS}
      - CORS_METHODS=${CORS_METHODS}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    volumes:
      - ./tipboxbackend-3e2c3d3c0b31.json:/app/tipboxbackend-3e2c3d3c0b31.json:ro
      - ./logs:/app/logs
    networks:
      - tipbox_network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    container_name: tipbox_nginx_prod
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - backend
    networks:
      - tipbox_network

volumes:
  postgres_prod_data:
  minio_prod_data:
  redis_prod_data:

networks:
  tipbox_network:
    driver: bridge
```

### 4. Nginx Yapılandırması

`nginx.conf` dosyası oluşturun:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:3000;
    }

    server {
        listen 80;
        server_name your-domain.com www.your-domain.com;

        # Redirect HTTP to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com www.your-domain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # SSL yapılandırması
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Gzip compression
        gzip on;
        gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

        # Max upload size (avatar için)
        client_max_body_size 10M;

        location / {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Health check endpoint
        location /health {
            proxy_pass http://backend/health;
            access_log off;
        }
    }
}
```

### 5. SSL Sertifikası (Let's Encrypt)

```bash
# Certbot kurulumu
apt install certbot -y

# SSL sertifikası oluştur (domain varsa)
certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Sertifikaları nginx dizinine kopyala
mkdir -p /opt/tipbox-backend/ssl
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/tipbox-backend/ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/tipbox-backend/ssl/key.pem

# Otomatik yenileme için cron job
crontab -e
# Şunu ekle:
# 0 0 * * * certbot renew --quiet && cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/tipbox-backend/ssl/cert.pem && cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/tipbox-backend/ssl/key.pem && docker-compose -f docker-compose.prod.yml restart nginx
```

## 🚀 Deployment

### 1. İlk Deployment

```bash
cd /opt/tipbox-backend

# Prisma migration'ları çalıştır
docker-compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy

# Container'ları başlat
docker-compose -f docker-compose.prod.yml up -d

# Logları kontrol et
docker-compose -f docker-compose.prod.yml logs -f backend
```

### 2. MinIO Bucket Kontrolü ve File Upload Testi

Backend başladığında otomatik olarak `tipbox-media` bucket'ı oluşturulacaktır. 

**Otomatik Bucket Oluşturma:**
- Backend container'ı başladığında `S3Service` otomatik olarak bucket'ı kontrol eder
- Bucket yoksa otomatik oluşturur
- Loglarda `S3 bucket oluşturuldu` veya `S3 bucket mevcut` mesajını görebilirsiniz

**Manuel Kontrol:**
```bash
# Backend loglarında bucket durumunu kontrol et
docker-compose -f docker-compose.prod.yml logs backend | grep bucket

# MinIO Console'a erişim (port forwarding ile güvenli)
ssh -L 9001:localhost:9001 root@your-server-ip

# Tarayıcıda: http://localhost:9001
# Login: MINIO_ROOT_USER / MINIO_ROOT_PASSWORD
```

**File Upload Testi:**
```bash
# Setup-profile endpoint'i ile avatar yükleme testi
curl -X POST https://your-domain.com/users/setup-profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "FullName=Test User" \
  -F "UserName=testuser" \
  -F "selectCategories={\"userId\":\"1\",\"selectedCategories\":[]}" \
  -F "Avatar=@/path/to/image.jpg"

# Başarılı response'da avatarUrl dönecektir
```

### 3. Health Check

```bash
# Backend health check
curl http://localhost:3000/health

# Veya domain üzerinden
curl https://your-domain.com/health
```

## 📊 Monitoring ve Logging

### Log Yönetimi

```bash
# Backend logları
docker-compose -f docker-compose.prod.yml logs -f backend

# Tüm servislerin logları
docker-compose -f docker-compose.prod.yml logs -f

# Log rotasyonu için logrotate kurulumu
apt install logrotate -y

# Logrotate yapılandırması
nano /etc/logrotate.d/tipbox-backend
```

Logrotate config:
```
/opt/tipbox-backend/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0644 root root
    sharedscripts
    postrotate
        docker-compose -f /opt/tipbox-backend/docker-compose.prod.yml restart backend
    endscript
}
```

### Backup Stratejisi

```bash
# Backup script oluştur
nano /opt/tipbox-backend/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/tipbox"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# PostgreSQL backup
docker-compose -f /opt/tipbox-backend/docker-compose.prod.yml exec -T postgres pg_dump -U tipbox_user tipbox_prod > $BACKUP_DIR/postgres_$DATE.sql

# MinIO backup (data volume)
docker run --rm -v tipbox-backend_minio_prod_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/minio_$DATE.tar.gz /data

# Redis backup
docker-compose -f /opt/tipbox-backend/docker-compose.prod.yml exec -T redis redis-cli --rdb - > $BACKUP_DIR/redis_$DATE.rdb

# Eski backup'ları temizle (7 günden eski)
find $BACKUP_DIR -type f -mtime +7 -delete
```

```bash
chmod +x /opt/tipbox-backend/backup.sh

# Günlük backup için cron
crontab -e
# Şunu ekle:
# 0 2 * * * /opt/tipbox-backend/backup.sh
```

## 🔄 Güncelleme ve Maintenance

### Proje Güncelleme

```bash
cd /opt/tipbox-backend

# Git pull
git pull origin main

# Build ve restart
docker-compose -f docker-compose.prod.yml build backend
docker-compose -f docker-compose.prod.yml up -d backend

# Migration varsa
docker-compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
```

### Database Migration

```bash
# Production migration
docker-compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy

# Migration durumunu kontrol et
docker-compose -f docker-compose.prod.yml run --rm backend npx prisma migrate status
```

## 🔒 Güvenlik Önerileri

1. **Güçlü Şifreler**: Tüm environment variable'ları güçlü şifrelerle değiştirin
2. **Firewall**: Sadece gerekli portları açın
3. **SSL**: Mutlaka HTTPS kullanın
4. **SSH Key**: Password authentication yerine SSH key kullanın
5. **Docker Secrets**: Hassas bilgileri Docker secrets ile yönetin
6. **Regular Updates**: Sistem ve Docker image'larını düzenli güncelleyin
7. **Monitoring**: Logları düzenli kontrol edin

## 📝 Checklist

- [ ] Sunucu oluşturuldu ve SSH erişimi sağlandı
- [ ] Docker ve Docker Compose kuruldu
- [ ] Proje dosyaları sunucuya yüklendi
- [ ] `.env` dosyası production değerleriyle oluşturuldu
- [ ] `docker-compose.prod.yml` oluşturuldu
- [ ] Nginx yapılandırıldı ve SSL sertifikası kuruldu
- [ ] Google Service Account JSON dosyası yüklendi
- [ ] Database migration'ları çalıştırıldı
- [ ] MinIO bucket kontrol edildi
- [ ] Health check endpoint'leri test edildi
- [ ] Backup stratejisi kuruldu
- [ ] Monitoring ve logging yapılandırıldı
- [ ] Güvenlik önlemleri alındı

## 🆘 Troubleshooting

### Backend Container Başlamıyor

```bash
# Logları kontrol et
docker-compose -f docker-compose.prod.yml logs backend

# Container'ı yeniden başlat
docker-compose -f docker-compose.prod.yml restart backend
```

### Database Bağlantı Hatası

```bash
# PostgreSQL container'ının çalıştığını kontrol et
docker-compose -f docker-compose.prod.yml ps postgres

# Connection string'i kontrol et
echo $DATABASE_URL
```

### MinIO Bucket Hatası

```bash
# Backend loglarında bucket kontrolü
docker-compose -f docker-compose.prod.yml logs backend | grep bucket

# MinIO Console'a erişim ve manuel bucket oluşturma
# http://your-server-ip:9001
```

### Disk Doluluk

```bash
# Disk kullanımını kontrol et
df -h

# Docker volume temizliği
docker system prune -a --volumes
```

---

**Not**: Bu doküman sürekli güncellenebilir. Production deployment öncesi tüm adımları test etmeyi unutmayın.

