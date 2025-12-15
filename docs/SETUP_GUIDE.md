# Tipbox Backend - Kurulum ve Başlangıç Rehberi

Bu rehber, Tipbox Backend projesini ilk kez çalıştırmak için gereken tüm adımları içerir.

## 📋 Ön Gereksinimler

- Docker ve Docker Compose yüklü olmalı
- Node.js 18+ (yerel geliştirme için)
- Git

## 🚀 Hızlı Başlangıç

### 1. Projeyi Klonlayın

```bash
git clone <repository-url>
cd tipbox-backend
```

### 2. Ortam Değişkenlerini Ayarlayın

`.env` dosyasını oluşturun ve gerekli değişkenleri ayarlayın:

```bash
# .env dosyası örneği
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/tipbox_dev
REDIS_URL=redis://redis:6379
JWT_SECRET=your-super-secret-jwt-key-for-development-only
```

### 3. Docker Container'ları Başlatın

```bash
docker-compose up -d
```

Bu komut şu servisleri başlatır:
- PostgreSQL (port: 5432)
- Redis (port: 6379)
- MinIO (port: 9000, console: 9001)
- PgAdmin (port: 5050)
- Backend (port: 3000)

> 🔔 **Not:** Container'lar ayağa kalktığında backend hazır olur olmaz tarayıcıda `http://localhost:3000` otomatik açılsın istiyorsanız aşağıdaki wrapper komutlarını kullanabilirsiniz:
>
> ```bash
> npm run docker:up       # docker compose up (detached) + tarayıcı açılışı
> npm run docker:start    # docker compose start + tarayıcı açılışı
> npm run docker:restart  # docker compose restart + tarayıcı açılışı
> ```


### 4. Veritabanı Şemasını Uygulayın

```bash
docker-compose exec backend npx prisma db push
```

Bu komut Prisma şemasını veritabanına uygular ve tabloları oluşturur.

### 5. Prisma Client'ı Generate Edin

```bash
docker-compose exec backend npx prisma generate
```

**Not:** Eğer TypeScript tip hataları alırsanız, bu komutu çalıştırın.

### 6. Seed Data'yı Yükleyin

```bash
docker-compose exec backend npm run db:seed
```

Bu komut test verilerini veritabanına yükler:
- Test kullanıcıları
- Kategoriler
- Ürünler
- NFT'ler
- Content post'lar
- ve daha fazlası...

### 7. Prisma Studio'yu Başlatın (Opsiyonel)

Veritabanını görselleştirmek için:

```bash
docker-compose exec backend npx prisma studio --port 5555
```

Tarayıcıda `http://localhost:5555` adresine gidin.

## 🔧 Sorun Giderme

### TypeScript Tip Hataları

Eğer Prisma client ile ilgili tip hataları alırsanız:

```bash
# Container içinde Prisma client'ı yeniden generate edin
docker-compose exec backend npx prisma generate

# Container'ı yeniden başlatın
docker-compose restart backend
```

### Docker Container'ı Yeniden Build Etme

Eğer değişiklikler yansımıyorsa:

```bash
# Image'ı cache olmadan yeniden build edin
docker-compose build --no-cache backend

# Container'ı yeniden oluşturun
docker-compose up -d backend
```

### Veritabanı Bağlantı Sorunları

```bash
# PostgreSQL container'ının çalıştığını kontrol edin
docker-compose ps

# Container loglarını kontrol edin
docker-compose logs postgres
```

## 📝 Test Kullanıcı Bilgileri

Seed işlemi sonrası aşağıdaki test kullanıcıları oluşturulur:

### Ana Test Kullanıcısı
- **Email:** `omer@tipbox.co`
- **Password:** `password123`
- **User ID:** `480f5de9-b691-4d70-a6a8-2789226f4e07`

### Market Test Kullanıcısı
- **Email:** `markettest@tipbox.co`
- **Password:** `password123`
- **User ID:** `248cc91f-b551-4ecc-a885-db1163571330`

### Trust Kullanıcıları
- **Email:** `trust-user-0@tipbox.co` (0-4 arası)
- **Password:** `password123`

### Truster Kullanıcıları
- **Email:** `truster-user-0@tipbox.co` (0-2 arası)
- **Password:** `password123`

## 🛠️ Yararlı Komutlar

### Container İşlemleri

```bash
# Tüm container'ları başlat
docker-compose up -d

# Container'ları durdur
docker-compose down

# Container loglarını görüntüle
docker-compose logs -f backend

# Container'a bağlan
docker-compose exec backend sh
```

### Prisma İşlemleri

```bash
# Şemayı veritabanına uygula
docker-compose exec backend npx prisma db push

# Migration oluştur (eğer migration kullanıyorsanız)
docker-compose exec backend npx prisma migrate dev

# Seed çalıştır
docker-compose exec backend npm run db:seed

# Prisma Studio başlat
docker-compose exec backend npx prisma studio --port 5555
```

### Veritabanı İşlemleri

```bash
# PostgreSQL'e bağlan
docker-compose exec postgres psql -U postgres -d tipbox_dev

# Veritabanını sıfırla (DİKKAT: Tüm veriler silinir!)
docker-compose exec backend npx prisma migrate reset
```

## 📦 Proje Yapısı

```
tipbox-backend/
├── src/
│   ├── application/     # Application layer (services)
│   ├── domain/          # Domain entities
│   ├── infrastructure/   # Infrastructure layer (repositories, external services)
│   └── interfaces/      # API endpoints
├── prisma/
│   ├── schema.prisma   # Prisma schema
│   └── seed.ts         # Seed script
├── docker-compose.yml   # Docker services configuration
└── Dockerfile          # Backend container image
```

## 🔍 API Test Endpoints

Seed işlemi sonrası test edebileceğiniz endpoint'ler:

### Feed
- `GET /feed` - Kullanıcı feed'i (auth token gerekli)
- `GET /feed/filtered?interests=<categoryId>&tags=Review&sort=recent`

### User Profile
- `GET /users/{userId}/profile-card`
- `GET /users/{userId}/profile?tabs=feed,reviews,benchmarks,tips,replies,ladder`
- `GET /users/{userId}/trusts` - Trust listesi
- `GET /users/{userId}/trusters` - Truster listesi

### Marketplace
- `GET /marketplace/listings` - Aktif NFT listing'leri
- `GET /marketplace/listings?type=BADGE&rarity=EPIC` - Filtrelenmiş listing'ler
- `GET /marketplace/my-nfts` - Kullanıcının NFT'leri (auth token gerekli)

### Explore
- `GET /explore/hottest` - Trend içerikler
- `GET /explore/marketplace-banners` - Marketplace banner'ları
- `GET /explore/events` - Wishbox event'leri

## ⚠️ Önemli Notlar

1. **Prisma Client Güncellemeleri:** Schema değişikliklerinden sonra mutlaka `npx prisma generate` çalıştırın.

2. **Docker Volume'lar:** `docker-compose down -v` komutu ile tüm volume'ları siler (veritabanı verileri dahil).

3. **Port Çakışmaları:** Eğer portlar kullanımda ise, `docker-compose.yml` dosyasındaki port numaralarını değiştirin.

4. **Seed Verileri:** Seed script'i idempotent değildir. Birden fazla çalıştırırsanız duplicate veriler oluşabilir.

## 🐛 Yaygın Sorunlar ve Çözümleri

### Sorun: "Port is already allocated"
**Çözüm:** İlgili portu kullanan servisi durdurun veya `docker-compose.yml`'de port numarasını değiştirin.

### Sorun: "Table does not exist"
**Çözüm:** 
```bash
docker-compose exec backend npx prisma db push
```

### Sorun: "Prisma Client type errors"
**Çözüm:**
```bash
docker-compose exec backend npx prisma generate
docker-compose restart backend
```

### Sorun: "Cannot connect to database"
**Çözüm:**
```bash
# PostgreSQL container'ının çalıştığını kontrol edin
docker-compose ps postgres

# Container'ı yeniden başlatın
docker-compose restart postgres
```

## 📚 Ek Kaynaklar

- [Prisma Dokümantasyonu](https://www.prisma.io/docs)
- [Docker Compose Dokümantasyonu](https://docs.docker.com/compose/)
- [PostgreSQL Dokümantasyonu](https://www.postgresql.org/docs/)

## 🤝 Katkıda Bulunma

Yeni bir özellik eklerken:
1. Feature branch oluşturun
2. Değişikliklerinizi yapın
3. Prisma schema değişikliklerini uygulayın (`npx prisma db push`)
4. Seed script'i güncelleyin (gerekirse)
5. Pull request oluşturun

---

**Son Güncelleme:** 2024
**Versiyon:** 1.0.0
