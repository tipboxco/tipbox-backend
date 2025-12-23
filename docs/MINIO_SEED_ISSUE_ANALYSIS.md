# MinIO Seed Görsel Yükleme Sorunu - Analiz ve Çözüm

## 🔍 Sorun

Seed işlemi (`npm run db:seed:all`) çalıştırıldığında:
- ✅ Database'e veriler ekleniyor
- ✅ DB'de görsel URL'leri kaydediliyor
- ❌ Ancak MinIO'da görseller bulunamıyor

## 📋 Mevcut Durum

### Seed Süreci

1. **Seed başlangıcında** (`prisma/seed.ts:1126-1133`):
   ```typescript
   try {
     await ensureSeedMediaUploaded();
   } catch (error) {
     console.warn('⚠️  Seed görselleri yüklenirken hata oluştu, devam ediliyor...');
     console.warn('   Not: Eğer görseller zaten MinIO\'da varsa bu hata normal olabilir.');
   }
   ```

2. **`ensureSeedMediaUploaded()` fonksiyonu** (`prisma/seed/helpers/ensure-seed-media.ts`):
   - `seed-media-map.json` dosyasını okur
   - Her key için local dosya path'ini bulur
   - MinIO'ya yükler
   - **Hata durumunda sadece warning verir, seed devam eder**

### Olası Sorunlar

#### 1. MinIO Bağlantı Sorunu

**Container dışında seed çalıştırılıyorsa:**
- Seed script `localhost:9000` kullanmaya çalışır
- MinIO container içinde `minio:9000` olarak çalışır
- **Çözüm:** Seed script container içinde çalıştırılmalı veya `S3_ENDPOINT` env değişkeni doğru set edilmeli

**Container içinde seed çalıştırılıyorsa:**
- `S3_ENDPOINT=http://minio:9000` kullanılmalı
- Container network'ünde MinIO erişilebilir olmalı

#### 2. Bucket Oluşturma Sorunu

- `checkAndCreateBucket()` bucket'ı kontrol eder ve yoksa oluşturur
- Ancak bucket oluşturulurken hata olursa, seed devam eder (sadece warning)
- **Kontrol:** MinIO console'da bucket'ın var olup olmadığını kontrol edin

#### 3. Dosya Yükleme Hatası

- Local dosyalar bulunamıyorsa (`tests/assets/` klasöründe yoksa)
- Dosya okuma hatası olursa
- MinIO'ya yazma hatası olursa
- **Tüm bu hatalar sadece warning olarak loglanır, seed devam eder**

#### 4. seed-media-map.json Eksik veya Yanlış

- `seed-media-map.json` dosyası eksikse veya yanlış formatdaysa
- `upload-seed-media.ts` script'i çalıştırılmamışsa
- **Çözüm:** `npm run upload-seed-media` komutunu çalıştırın

## 🔧 Çözüm Adımları

### Adım 1: MinIO Bağlantısını Kontrol Et

```bash
# Container içinde test scripti çalıştır
docker-compose exec backend npx ts-node scripts/check-minio-connection.ts
```

Bu script:
- MinIO bağlantısını test eder
- Bucket'ın var olup olmadığını kontrol eder
- Bucket içeriğini listeler
- Test dosyası yükler

### Adım 2: Seed Media Map'i Kontrol Et

```bash
# seed-media-map.json dosyasının var olup olmadığını kontrol et
ls -la prisma/seed/seed-media-map.json

# Eğer yoksa veya güncel değilse, oluştur/güncelle
docker-compose exec backend npx ts-node scripts/upload-seed-media.ts
```

### Adım 3: Seed'i Container İçinde Çalıştır

**ÖNEMLİ:** Seed script'i container içinde çalıştırın:

```bash
# Container içinde seed çalıştır
docker-compose exec backend npm run db:seed:all

# VEYA

# Container içinde direkt seed script çalıştır
docker-compose exec backend npx ts-node prisma/seed.ts
```

**Neden?**
- Container içinde `S3_ENDPOINT=http://minio:9000` doğru çalışır
- Container network'ünde MinIO erişilebilir
- Environment variable'lar doğru set edilmiş olur

### Adım 4: Seed Loglarını Kontrol Et

Seed çalıştırırken şu logları kontrol edin:

```
📦 Seed görselleri MinIO'ya yükleniyor...
   ✅ 10 görsel yüklendi...
   ✅ 20 görsel yüklendi...
✅ Seed görselleri yükleme tamamlandı:
   📤 Yüklenen: 50
   ⏭️  Atlanan: 0
   ⚠️  Hata: 0
```

**Eğer hata varsa:**
```
⚠️  Local dosya bulunamadı: catalog.computers-tablets (catalog/computers-tablets.png)
⚠️  user.avatar.primary yüklenirken hata: Connection refused
```

### Adım 5: MinIO Console'da Kontrol Et

1. MinIO Console'a erişin: `http://localhost:9001`
2. Login: `minioadmin` / `minioadmin123` (veya .env'deki değerler)
3. `tipbox-media` bucket'ını kontrol edin
4. Dosyaların yüklenip yüklenmediğini görün

### Adım 6: Environment Variable'ları Kontrol Et

`.env` dosyasında şu değişkenlerin doğru set edildiğinden emin olun:

```env
# MinIO endpoint (container içinde)
S3_ENDPOINT=http://minio:9000

# MinIO credentials
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123

# Bucket name
S3_BUCKET_NAME=tipbox-media

# Public endpoint (frontend için)
MINIO_PUBLIC_ENDPOINT=http://localhost:9000
# VEYA production için:
# MINIO_PUBLIC_ENDPOINT=http://api-test.tipbox.co:9000
```

## 🐛 Debug Komutları

### MinIO Bağlantı Testi

```bash
# Container içinde test
docker-compose exec backend npx ts-node scripts/check-minio-connection.ts
```

### Seed Media Map Oluşturma

```bash
# seed-media-map.json oluştur/güncelle
docker-compose exec backend npx ts-node scripts/upload-seed-media.ts
```

### Seed'i Tekrar Çalıştırma

```bash
# Tüm verileri temizle ve seed'i çalıştır
docker-compose exec backend npm run db:seed:all
```

### MinIO Bucket İçeriğini Listeleme

```bash
# MinIO CLI ile (eğer yüklüyse)
mc ls local/tipbox-media/

# VEYA test scripti ile
docker-compose exec backend npx ts-node scripts/check-minio-connection.ts
```

## ✅ Doğrulama

Seed işlemi başarılı olduğunda:

1. **Log çıktısı:**
   ```
   ✅ Seed görselleri yükleme tamamlandı:
      📤 Yüklenen: 50+
      ⏭️  Atlanan: 0
      ⚠️  Hata: 0
   ```

2. **MinIO Console'da:**
   - `tipbox-media` bucket'ında dosyalar görünür
   - Klasör yapısı: `catalog/`, `products/`, `badge/`, `userprofile/`, vb.

3. **Database'de:**
   - Görsel URL'leri path formatında kaydedilir (örn: `catalog/computers-tablets.png`)
   - API response'larında `resolveMediaUrl()` ile tam URL'ye çevrilir

## 📝 Notlar

### Seed Script Container Dışında Çalıştırılıyorsa

Eğer seed script'i container dışında çalıştırıyorsanız:

1. `.env` dosyasında `S3_ENDPOINT=http://localhost:9000` set edin
2. MinIO'nun `localhost:9000` üzerinden erişilebilir olduğundan emin olun
3. Credentials'ların doğru olduğundan emin olun

### Production Ortamı

Production'da:

1. `MINIO_PUBLIC_ENDPOINT` veya `SEED_MEDIA_BASE_URL` set edin
2. Seed script'i production container'ında çalıştırın
3. MinIO'nun public erişilebilir olduğundan emin olun

## 🔗 İlgili Dosyalar

- `prisma/seed.ts` - Ana seed dosyası
- `prisma/seed/helpers/ensure-seed-media.ts` - Görsel yükleme helper'ı
- `prisma/seed/seed-media-map.json` - Görsel mapping dosyası
- `scripts/upload-seed-media.ts` - Görsel yükleme scripti
- `scripts/check-minio-connection.ts` - Bağlantı test scripti (yeni)
- `src/infrastructure/s3/s3.service.ts` - S3/MinIO service
- `src/infrastructure/config/s3.config.ts` - S3 yapılandırması

## 🚀 Hızlı Çözüm

Eğer seed çalıştırdıktan sonra görseller MinIO'da yoksa:

```bash
# 1. MinIO bağlantısını test et
docker-compose exec backend npx ts-node scripts/check-minio-connection.ts

# 2. Seed media map'i oluştur/güncelle
docker-compose exec backend npx ts-node scripts/upload-seed-media.ts

# 3. Seed'i container içinde çalıştır
docker-compose exec backend npm run db:seed:all

# 4. MinIO Console'da kontrol et: http://localhost:9001
```

