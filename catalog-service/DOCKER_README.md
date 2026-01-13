# Docker Kurulum Rehberi

Bu rehber, Tipbox Medusa uygulamasını Docker ile çalıştırmak için gerekli adımları içerir.

## Gereksinimler

- Docker
- Docker Compose

## Hızlı Başlangıç

### 1. Ortam Değişkenlerini Ayarlayın

`.env` dosyası oluşturun (veya `.env.example` dosyasını kopyalayın):

```bash
# Database
POSTGRES_USER=medusa_user
POSTGRES_PASSWORD=medusa_password
POSTGRES_DB=medusa_db
POSTGRES_PORT=5432
DATABASE_URL=postgres://medusa_user:medusa_password@postgres:5432/medusa_db

# Medusa Configuration
JWT_SECRET=supersecret
COOKIE_SECRET=supersecret
STORE_CORS=http://localhost:8000
ADMIN_CORS=http://localhost:7001
AUTH_CORS=http://localhost:9000
NODE_ENV=development

# Ports
MEDUSA_PORT=9000
```

### 2. Docker Compose ile Başlatın

```bash
docker-compose up -d
```

Bu komut:
- PostgreSQL veritabanını başlatır
- Medusa uygulamasını build eder ve başlatır
- İlk kurulumda otomatik olarak:
  - Veritabanı migration'larını çalıştırır
  - Seed verilerini ekler (category, product, brand, brand category ve product-brand linkleme)

### 3. Logları İzleyin

```bash
docker-compose logs -f medusa
```

### 4. Uygulamaya Erişin

- **API**: http://localhost:9000
- **Admin Panel**: http://localhost:9000/app

## Seed Verileri

İlk kurulumda otomatik olarak aşağıdaki veriler eklenir:

### Categories
- Shirts
- Sweatshirts
- Pants
- Merch

### Products
- Medusa T-Shirt (Shirts kategorisinde)
- Medusa Sweatshirt (Sweatshirts kategorisinde)
- Medusa Sweatpants (Pants kategorisinde)
- Medusa Shorts (Merch kategorisinde)

### Brand Categories
- Elektronik
- Giyim
- Spor & Outdoor

### Brands
- Medusa Brand (Elektronik kategorisinde)
- Premium Fashion (Giyim kategorisinde)
- SportMax (Spor & Outdoor kategorisinde)

### Product-Brand Linkleme
Tüm ürünler otomatik olarak brand'lere bağlanır.

## Komutlar

### Servisleri Durdurma
```bash
docker-compose down
```

### Servisleri Durdurma (Verileri Silmeden)
```bash
docker-compose stop
```

### Servisleri Durdurma (Tüm Verileri Silme)
```bash
docker-compose down -v
```

### Servisleri Yeniden Başlatma
```bash
docker-compose restart
```

### Logları Görüntüleme
```bash
# Tüm servisler
docker-compose logs

# Sadece Medusa
docker-compose logs medusa

# Sadece PostgreSQL
docker-compose logs postgres

# Canlı log takibi
docker-compose logs -f medusa
```

### Seed'i Yeniden Çalıştırma

Seed'i yeniden çalıştırmak için:

```bash
# Seed flag dosyasını silin
docker-compose exec medusa rm /app/.seed_completed

# Seed'i manuel çalıştırın
docker-compose exec medusa npm run seed
```

### Veritabanına Bağlanma

```bash
docker-compose exec postgres psql -U medusa_user -d medusa_db
```

## Sorun Giderme

### Migration Hataları

Eğer migration hataları alırsanız:

```bash
docker-compose exec medusa npx medusa db:migrate
```

### Seed Hataları

Seed işlemi başarısız olursa:

```bash
# Logları kontrol edin
docker-compose logs medusa

# Seed'i manuel çalıştırın
docker-compose exec medusa npm run seed
```

### Port Çakışması

Eğer portlar kullanılıyorsa, `.env` dosyasında port numaralarını değiştirin:

```env
POSTGRES_PORT=5433
MEDUSA_PORT=9001
```

## Geliştirme

Geliştirme sırasında hot-reload için:

```bash
# Development modunda çalıştırın
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Not: `docker-compose.dev.yml` dosyasını oluşturarak development ayarlarını ekleyebilirsiniz.

