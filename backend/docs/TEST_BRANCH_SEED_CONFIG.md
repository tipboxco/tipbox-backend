# Test Branch Seed Yapılandırması

## 🎯 Amaç

Test branch'inde deploy alındığında seed workflow çalıştığında, görsellerin doğru şekilde yüklenmesi ve runtime'da production endpoint'i ile URL'lerin oluşturulması sağlanmalıdır. Bu sayede:
- ✅ Görseller otomatik olarak MinIO'ya yüklenir
- ✅ Database'de path tutulur (URL değil)
- ✅ Runtime'da production endpoint'i ile URL oluşturulur
- ✅ Frontend görselleri doğrudan erişebilir

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
# Nginx proxy üzerinden /media/ path'i ile erişim (port 9000 VPN/internal only)
SEED_MEDIA_BASE_URL=https://api-test.tipbox.co/media
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

### 2. Seed Workflow Akışı

#### Adım 1: Görseller Otomatik Yüklenir

Seed başında `ensureSeedMediaUploaded()` otomatik çağrılır:

```typescript
// prisma/seed.ts başında
await ensureSeedMediaUploaded();
// ✅ Tüm seed-media-map.json'daki görseller MinIO'ya yüklenir
```

#### Adım 2: Seed Verileri Database'e Eklenir

```typescript
// prisma/seed/helpers/media.helper.ts
export function getSeedMediaPath(key: SeedMediaKey): string {
  const entry = seedMedia[key];
  const bucketName = getBucketName();
  return `${bucketName}/${entry.targetKey}`;
  // → "tipbox-media/products/phones/phone1.png" (sadece path)
}

// seed.ts içinde
const product = await prisma.product.create({
  data: {
    name: 'iPhone 15 Pro',
    imageUrl: getSeedMediaPath('product.phone.phone1'),
    // imageUrl = "tipbox-media/products/phones/phone1.png" (path, URL değil)
  }
});
```

**ÖNEMLİ:** Database'de sadece path tutulur, tam URL değil!

#### Adım 3: Runtime'da URL Oluşturulur

API response'larında `getPublicMediaBaseUrl()` kullanılır:

```typescript
// src/infrastructure/config/media.config.ts
export function getPublicMediaBaseUrl(): string {
  return process.env.SEED_MEDIA_BASE_URL || 
         process.env.MINIO_PUBLIC_ENDPOINT || 
         'http://localhost:9000';
}

// API response'larında
const baseUrl = getPublicMediaBaseUrl();
// → http://api-test.tipbox.co:9000 (production)
// → http://localhost:9000 (development)

const fullUrl = `${baseUrl}/${product.imageUrl}`;
// → http://api-test.tipbox.co:9000/tipbox-media/products/phones/phone1.png
```

## ⚠️ Uyarı Sistemi

Eğer production ortamında (`NODE_ENV=production`) `SEED_MEDIA_BASE_URL` set edilmemişse:

```
⚠️  UYARI: Production ortamında SEED_MEDIA_BASE_URL veya MINIO_PUBLIC_ENDPOINT set edilmemiş!
   Runtime'da görsel URL'leri localhost olarak oluşturulacak ve frontend erişemeyecek.
   Lütfen .env dosyasına SEED_MEDIA_BASE_URL=https://api-test.tipbox.co/media ekleyin.
```

## 📋 Kontrol Listesi

### Deploy Öncesi

- [ ] Sunucudaki `.env` dosyasında `SEED_MEDIA_BASE_URL=https://api-test.tipbox.co/media` var
- [ ] `S3_ENDPOINT=http://minio:9000` (container içi, backend için)
- [ ] `S3_BUCKET_NAME=tipbox-media`

### Deploy Sonrası

- [ ] Seed workflow başarıyla çalıştı
- [ ] Görseller MinIO'ya yüklendi (seed log'larında görünür)
- [ ] Database'de path'ler doğru format'ta (`tipbox-media/...`)
- [ ] API response'larında production endpoint'i ile URL'ler oluşturuluyor
- [ ] Frontend görselleri doğru gösteriyor

## 🔍 Doğrulama

### 1. Environment Variable Kontrolü

```bash
# Sunucuda kontrol et
docker compose exec backend env | grep SEED_MEDIA_BASE_URL
# Çıktı: SEED_MEDIA_BASE_URL=https://api-test.tipbox.co/media
```

### 2. Database Path Kontrolü

```sql
-- Database'deki path'leri kontrol et
SELECT image_url FROM products WHERE image_url IS NOT NULL LIMIT 5;

-- Beklenen format (path, URL değil):
-- tipbox-media/products/phones/phone1.png
-- tipbox-media/brand-categories/cameras.png
```

### 3. Seed Log Kontrolü

Seed workflow çalıştığında log'larda şunları görmelisiniz:

```
📦 Seed görselleri MinIO'ya yükleniyor...
   ✅ 10 görsel yüklendi...
   ✅ 20 görsel yüklendi...
✅ Seed görselleri yükleme tamamlandı:
   📤 Yüklenen: 150
   ⏭️  Atlanan: 0
```

### 4. API Response Kontrolü

API endpoint'lerinden birine istek atın ve response'da URL'lerin production endpoint'i içerdiğini kontrol edin:

```bash
curl https://api-test.tipbox.co/api/brands | jq '.[0].image'
# Beklenen: "https://api-test.tipbox.co/media/brand-categories/cameras.png"
```

## 🎯 Sonuç

Test branch'inde deploy alındığında:
- ✅ Seed workflow görselleri otomatik olarak MinIO'ya yükler
- ✅ Database'de path'ler tutulur (URL değil)
- ✅ Runtime'da `getPublicMediaBaseUrl()` production endpoint'i ile URL oluşturur
- ✅ Frontend görselleri doğrudan erişebilir
- ✅ Environment değiştiğinde sadece env variable güncellenir

## 🔧 Sorun Giderme

### Sorun: Görseller MinIO'ya yüklenmiyor

**Çözüm:**
1. Seed log'larını kontrol edin (`ensureSeedMediaUploaded()` çalışıyor mu?)
2. MinIO container'ının çalıştığını kontrol edin: `docker compose ps`
3. `S3_ENDPOINT` ve credentials'ları kontrol edin

### Sorun: API response'larında localhost URL'leri görünüyor

**Çözüm:**
1. `.env` dosyasına `SEED_MEDIA_BASE_URL=https://api-test.tipbox.co/media` ekleyin
2. Backend container'ını yeniden başlatın: `docker compose restart backend`
3. API response'larında `getPublicMediaBaseUrl()` kullanıldığından emin olun

### Sorun: Database'de eski URL format'ı var (tam URL)

**Not:** Eski seed'lerde URL format'ı kullanılıyordu. Yeni seed'lerde sadece path tutuluyor. Eski veriler için `normalizeMediaUrl()` kullanılabilir, ama yeni seed'lerde sorun olmamalı.

### Sorun: Seed workflow uyarı veriyor

**Çözüm:**
- `.env` dosyasına `SEED_MEDIA_BASE_URL` ekleyin
- Container'ı yeniden başlatın: `docker compose restart backend`
