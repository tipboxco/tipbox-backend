# Docker Container Konfigürasyon Rehberi

Bu doküman, projenin Docker container içinde çalışırken hangi konfigürasyonların değiştiğini ve neden değiştiğini açıklar.

## 📋 İçindekiler

1. [Temel Değişiklikler](#temel-değişiklikler)
2. [Ortam Dosyaları](#ortam-dosyaları)
3. [Container İçi Servis Erişimi](#container-içi-servis-erişimi)
4. [Port Yapılandırmaları](#port-yapılandırmaları)
5. [Volume Mount'lar](#volume-mountlar)
6. [Network Yapılandırması](#network-yapılandırması)

---

## Temel Değişiklikler

Container içinde çalışırken, uygulama aynı Docker network'ünde çalışan diğer servislere **container isimleri** ile erişir. Bu nedenle `localhost` yerine servis isimlerini kullanmamız gerekir.

### Değişen Konfigürasyonlar

| Konfigürasyon | Lokal Çalışma | Container İçi Çalışma | Açıklama |
|--------------|---------------|----------------------|----------|
| **Database URL** | `localhost:5432` | `postgres:5432` | PostgreSQL container ismi |
| **Redis URL** | `localhost:6379` | `redis:6379` | Redis container ismi |
| **S3 Endpoint** | `localhost:9000` | `minio:9000` | MinIO container ismi |
| **File Paths** | `./relative/path` | `/app/absolute/path` | Container içinde absolute path'ler |

---

## Ortam Dosyaları

Her ortam için ayrı env dosyaları oluşturulmuştur:

| Ortam | Env Dosyası | Docker Compose | Kullanım |
|-------|-------------|----------------|----------|
| **Development** | `.env` | `docker-compose.yml` | Lokal geliştirme |
| **Test** | `.env.test` | `docker-compose.test.yml` | Test ortamı |
| **Production** | `.env.production` | `docker-compose.prod.yml` | Production ortamı |

### Env Dosyası Oluşturma

```bash
# Development için
cp env.example.txt .env

# Test için
cp env.test.example.txt .env.test

# Production için
cp env.production.example.txt .env.production
```

---

## Container İçi Servis Erişimi

### Database (PostgreSQL)

**Container İçi:**
```env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/tipbox_dev
```

**Lokal Erişim (Container dışından):**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tipbox_dev
```

### Redis

**Container İçi (Development - şifresiz):**
```env
REDIS_URL=redis://redis:6379
```

**Container İçi (Test/Production - şifreli):**
```env
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
```

**Lokal Erişim:**
```env
REDIS_URL=redis://localhost:6379
```

### MinIO/S3

**Container İçi:**
```env
S3_ENDPOINT=http://minio:9000
```

**Lokal Erişim:**
```env
S3_ENDPOINT=http://localhost:9000
```

**Not:** `s3.service.ts` içinde development ortamında URL otomatik olarak `localhost`'a çevrilir (tarayıcıdan erişim için).

### Google Service Account

**Container İçi:**
```env
GOOGLE_APPLICATION_CREDENTIALS=/app/tipboxbackend-3e2c3d3c0b31.json
```

**Lokal Çalışma:**
```env
GOOGLE_APPLICATION_CREDENTIALS=./tipboxbackend-3e2c3d3c0b31.json
```

---

## Port Yapılandırmaları

### Container İçi Port'lar

Container içinde servisler kendi portlarında çalışır:

| Servis | Container İçi Port | Host'a Expose Edilen Port |
|--------|-------------------|---------------------------|
| Backend | `3000` | `3000` |
| PostgreSQL | `5432` | `5432` |
| Redis | `6379` | `6379` |
| MinIO API | `9000` | `9000` |
| MinIO Console | `9001` | `9001` |
| Prisma Studio | `5555` | `5555` |
| PgAdmin | `80` | `5050` |

### Port Mapping

Docker Compose'da port mapping şu şekilde yapılır:
```yaml
ports:
  - "3000:3000"  # host_port:container_port
```

Bu sayede:
- Container içinde: `localhost:3000` veya `0.0.0.0:3000`
- Host'tan erişim: `localhost:3000`

---

## Volume Mount'lar

### Development Ortamı

```yaml
volumes:
  - .:/app                    # Tüm proje kodu
  - /app/node_modules         # node_modules ayrı tutulur (host'tan override edilmez)
  - ./tipboxbackend-3e2c3d3c0b31.json:/app/tipboxbackend-3e2c3d3c0b31.json:ro
```

### Test/Production Ortamı

```yaml
volumes:
  - ./tipboxbackend-3e2c3d3c0b31.json:/app/tipboxbackend-3e2c3d3c0b31.json:ro
  - ./logs:/app/logs
```

**Not:** Test ve Production'da source code build edilmiş hali container içinde, volume mount edilmez.

---

## Network Yapılandırması

### Development

Tüm servisler aynı default network'te çalışır. Container isimleri ile birbirlerine erişebilirler.

### Test/Production

Tüm servisler `tipbox_network` adında özel bir bridge network'te çalışır:

```yaml
networks:
  tipbox_network:
    driver: bridge
```

Bu sayede:
- Servisler birbirlerine container isimleri ile erişebilir
- Network izolasyonu sağlanır
- Daha güvenli bir yapı oluşturulur

---

## Önemli Notlar

### 1. Environment Variable Önceliği

Docker Compose'da environment variable'lar şu sırayla yüklenir:
1. `env_file` (`.env`, `.env.test`, vb.)
2. `environment` (docker-compose.yml içindeki direkt tanımlamalar)

`environment` içindeki değerler `env_file`'daki değerleri override eder.

### 2. Container İçi vs Lokal Çalışma

- **Container içinde:** Servis isimlerini kullan (`postgres`, `redis`, `minio`)
- **Lokal çalışma:** `localhost` kullan

### 3. S3 Endpoint Özel Durumu

Development ortamında, `s3.service.ts` içinde URL otomatik olarak `localhost`'a çevrilir çünkü tarayıcıdan erişim için gerekli. Container içinde MinIO'ya erişim için `minio:9000` kullanılır, ancak dönen URL'ler tarayıcı için `localhost:9000` olur.

### 4. Health Check'ler

Test ve Production ortamlarında health check'ler aktif:
- PostgreSQL: `pg_isready`
- Redis: `redis-cli ping`
- MinIO: `curl http://localhost:9000/minio/health/live`
- Backend: `GET /health`

---

## Hızlı Başlangıç

### Development Ortamı

```bash
# 1. Env dosyasını oluştur
cp env.example.txt .env

# 2. Docker Compose ile servisleri başlat
docker-compose up -d

# 3. Migration'ları çalıştır
docker-compose exec backend npm run db:migrate

# 4. Logları kontrol et
docker-compose logs -f backend
```

### Test Ortamı

```bash
# 1. Env dosyasını oluştur
cp env.test.example.txt .env.test

# 2. Gerekli environment variable'ları .env.test'e ekle
# POSTGRES_PASSWORD, REDIS_PASSWORD, MINIO_ROOT_USER, vb.

# 3. Docker Compose ile servisleri başlat
docker-compose -f docker-compose.test.yml up -d
```

### Production Ortamı

```bash
# 1. Env dosyasını oluştur
cp env.production.example.txt .env.production

# 2. Güvenli secret'ları .env.production'a ekle
# POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET, vb.

# 3. Docker Compose ile servisleri başlat
docker-compose -f docker-compose.prod.yml up -d
```

---

## Sorun Giderme

### Container'lar birbirini görmüyor

- Network'ün doğru yapılandırıldığından emin olun
- Container isimlerinin doğru olduğunu kontrol edin
- `docker network ls` ile network'leri listeleyin
- `docker network inspect <network_name>` ile network detaylarını görün

### Port çakışması

- Host'ta kullanılan port'ları kontrol edin: `lsof -i :3000`
- Docker Compose'daki port mapping'leri değiştirin

### Environment variable'lar yüklenmiyor

- `env_file` path'inin doğru olduğundan emin olun
- `.env` dosyasının proje root'unda olduğunu kontrol edin
- `docker-compose config` ile yapılandırmayı doğrulayın

