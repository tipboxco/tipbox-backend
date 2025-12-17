# Test Branch Seed Yapılandırması

## 🎯 Amaç

Test branch'inde deploy alındığında seed workflow çalıştığında, görsellerin URL'leri production endpoint'ini kullanmalıdır. Bu sayede:
- ✅ Database'e kaydedilen URL'ler doğru endpoint'i içerir (`http://api-test.tipbox.co:9000`)
- ✅ Frontend görselleri doğrudan erişebilir
- ✅ Localhost URL'leri production'da kullanılmaz

## ⚙️ Yapılandırma

### Test/Production `.env` Dosyası

Test branch'inde deploy alındığında, sunucudaki `.env` dosyasına şu environment variable'ı ekleyin:

```env
# MinIO/S3 yapılandırması (Container içi - backend için)
S3_ENDPOINT=http://minio:9000
S3_BUCKET_NAME=tipbox-media
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123

# Production Public Endpoint (Frontend ve Seed için) ⭐ ÖNEMLİ
SEED_MEDIA_BASE_URL=http://api-test.tipbox.co:9000
```

**ÖNEMLİ:** `SEED_MEDIA_BASE_URL` **MUTLAKA** set edilmelidir!

## 🔄 Nasıl Çalışır?

### 1. Deploy Workflow

Test branch'ine push yapıldığında GitHub Actions workflow çalışır:

```yaml
# .github/workflows/deploy-hetzner-test.yml
- name: Run seeds
  run: docker compose run --rm backend npm run seed:all
```

### 2. Seed Workflow

Seed workflow çalıştığında:

```typescript
// prisma/seed/helpers/media.helper.ts
export function getSeedMediaUrl(key: SeedMediaKey): string {
  const baseUrl = getMinioPublicEndpoint(); // .env'den SEED_MEDIA_BASE_URL okur
  const bucketName = getBucketName();
  return `${baseUrl}/${bucketName}/${entry.targetKey}`;
}
```

**Örnek:**
- Environment: `SEED_MEDIA_BASE_URL=http://api-test.tipbox.co:9000`
- Key: `product.phone.phone1`
- Target: `products/phones/phone1.png`
- **Sonuç:** `http://api-test.tipbox.co:9000/tipbox-media/products/phones/phone1.png`

### 3. Database'e Kayıt

Seed workflow görselleri MinIO'ya yükler ve database'e URL'leri kaydeder:

```typescript
const product = await prisma.product.create({
  data: {
    name: 'iPhone 15 Pro',
    imageUrl: getSeedMediaUrl('product.phone.phone1'),
    // imageUrl = "http://api-test.tipbox.co:9000/tipbox-media/products/phones/phone1.png"
  }
});
```

## ⚠️ Uyarı Sistemi

Eğer production ortamında (`NODE_ENV=production`) `SEED_MEDIA_BASE_URL` set edilmemişse:

```
⚠️  UYARI: Production ortamında SEED_MEDIA_BASE_URL veya MINIO_PUBLIC_ENDPOINT set edilmemiş!
   Seed görselleri localhost URL'leri ile kaydedilecek ve frontend erişemeyecek.
   Lütfen .env dosyasına SEED_MEDIA_BASE_URL=http://api-test.tipbox.co:9000 ekleyin.
```

## 📋 Kontrol Listesi

### Deploy Öncesi

- [ ] Sunucudaki `.env` dosyasında `SEED_MEDIA_BASE_URL=http://api-test.tipbox.co:9000` var
- [ ] `S3_ENDPOINT=http://minio:9000` (container içi, backend için)
- [ ] `S3_BUCKET_NAME=tipbox-media`

### Deploy Sonrası

- [ ] Seed workflow başarıyla çalıştı
- [ ] Database'deki URL'ler production endpoint'ini içeriyor
- [ ] Frontend görselleri doğru gösteriyor
- [ ] Localhost URL'leri yok

## 🔍 Doğrulama

### 1. Environment Variable Kontrolü

```bash
# Sunucuda kontrol et
docker compose exec backend env | grep SEED_MEDIA_BASE_URL
# Çıktı: SEED_MEDIA_BASE_URL=http://api-test.tipbox.co:9000
```

### 2. Database URL Kontrolü

```sql
-- Database'deki URL'leri kontrol et
SELECT image_url FROM products WHERE image_url IS NOT NULL LIMIT 5;

-- Beklenen format:
-- http://api-test.tipbox.co:9000/tipbox-media/products/phones/phone1.png
```

### 3. Seed Log Kontrolü

Seed workflow çalıştığında log'larda şunu görmelisiniz:

```
✅ Production endpoint kullanılıyor: http://api-test.tipbox.co:9000
```

## 🎯 Sonuç

Test branch'inde deploy alındığında:
- ✅ Seed workflow `.env` dosyasından `SEED_MEDIA_BASE_URL` okur
- ✅ Database'e production endpoint'i ile URL'ler kaydedilir
- ✅ Frontend doğrudan erişebilir
- ✅ Localhost URL'leri kullanılmaz

## 🔧 Sorun Giderme

### Sorun: Database'de localhost URL'leri var

**Çözüm:**
1. `.env` dosyasına `SEED_MEDIA_BASE_URL=http://api-test.tipbox.co:9000` ekleyin
2. Seed workflow'u tekrar çalıştırın: `docker compose run --rm backend npm run seed:all`
3. Veya mevcut URL'leri normalize edin: `normalizeMediaUrl()` kullanın

### Sorun: Seed workflow uyarı veriyor

**Çözüm:**
- `.env` dosyasına `SEED_MEDIA_BASE_URL` ekleyin
- Container'ı yeniden başlatın: `docker compose restart backend`
