# Production Seed URL Yapılandırması

## 🎯 Amaç

Production'da seed workflow çalıştığında, MinIO'ya yüklenen görsellerin URL'leri production endpoint'ini kullanmalıdır. Bu sayede:
- ✅ Database'e kaydedilen URL'ler doğru endpoint'i içerir
- ✅ Frontend görselleri doğrudan erişebilir
- ✅ Environment değiştiğinde sadece env variable güncellenir

## ⚙️ Yapılandırma

### Production `.env` Dosyası

Production `.env` dosyasına şu environment variable'ı ekleyin:

```env
# Seed ve runtime için tek kontrol noktası (ÖNERİLEN)
SEED_MEDIA_BASE_URL=http://api-test.tipbox.co:9000

# VEYA

# Sadece frontend için
MINIO_PUBLIC_ENDPOINT=http://api-test.tipbox.co:9000
```

**Öncelik Sırası:**
1. `SEED_MEDIA_BASE_URL` (önerilen - seed ve runtime için tek kontrol noktası)
2. `MINIO_PUBLIC_ENDPOINT` (sadece frontend için)
3. `S3_ENDPOINT` (container içi, production'da kullanmayın!)
4. Varsayılan: `http://localhost:9000` (sadece development)

### Örnek Production `.env`

```env
# MinIO/S3 yapılandırması
S3_ENDPOINT=http://minio:9000  # Container içi (backend için)
S3_BUCKET_NAME=tipbox-media
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123

# Production Public Endpoint (Frontend ve Seed için)
SEED_MEDIA_BASE_URL=http://api-test.tipbox.co:9000
```

## 🔄 Nasıl Çalışır?

### 1. Seed Workflow

Seed workflow çalıştığında:

```typescript
// prisma/seed/helpers/media.helper.ts
export function getSeedMediaUrl(key: SeedMediaKey): string {
  const baseUrl = getMinioPublicEndpoint(); // SEED_MEDIA_BASE_URL'den alır
  const bucketName = getBucketName();
  return `${baseUrl}/${bucketName}/${entry.targetKey}`;
}
```

**Örnek:**
- Environment: `SEED_MEDIA_BASE_URL=http://api-test.tipbox.co:9000`
- Key: `product.phone.phone1`
- Target: `products/phones/phone1.png`
- **Sonuç:** `http://api-test.tipbox.co:9000/tipbox-media/products/phones/phone1.png`

### 2. Database'e Kayıt

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

### 3. Frontend Erişimi

Frontend bu URL'leri doğrudan kullanabilir:

```typescript
// Database'den gelen URL zaten production endpoint'ini içeriyor
const imageUrl = product.imageUrl; 
// "http://api-test.tipbox.co:9000/tipbox-media/products/phones/phone1.png"
```

## 🔧 Environment Değişikliği

Eğer production endpoint'i değişirse (örn: `http://api.tipbox.co:9000`):

1. **Sadece `.env` dosyasını güncelleyin:**
   ```env
   SEED_MEDIA_BASE_URL=http://api.tipbox.co:9000
   ```

2. **Yeni seed workflow çalıştırın:**
   - Yeni görseller yeni endpoint ile kaydedilecek
   - Eski görseller için `normalizeMediaUrl()` kullanın (runtime'da dönüştürme)

## 📋 Kontrol Listesi

- [ ] Production `.env` dosyasına `SEED_MEDIA_BASE_URL` eklendi
- [ ] Production endpoint doğru set edildi (`http://api-test.tipbox.co:9000`)
- [ ] Seed workflow test edildi
- [ ] Database'deki URL'ler production endpoint'ini içeriyor
- [ ] Frontend görselleri doğru gösteriyor

## ⚠️ Önemli Notlar

1. **Container İçi vs Public Endpoint:**
   - `S3_ENDPOINT=http://minio:9000` → Backend container'ı için (MinIO'ya yükleme)
   - `SEED_MEDIA_BASE_URL=http://api-test.tipbox.co:9000` → Frontend için (URL oluşturma)

2. **Development vs Production:**
   - **Development:** `SEED_MEDIA_BASE_URL` set edilmezse → `http://localhost:9000` kullanılır
   - **Production:** `SEED_MEDIA_BASE_URL` **MUTLAKA** set edilmelidir!

3. **URL Normalizasyon:**
   - Eski localhost URL'leri için `normalizeMediaUrl()` kullanın
   - Yeni seed'ler zaten doğru URL ile kaydedilecek

## 🎯 Sonuç

Production'da seed workflow çalıştığında:
- ✅ Görseller MinIO'ya yüklenir
- ✅ Database'e production endpoint'i ile kaydedilir
- ✅ Frontend doğrudan erişebilir
- ✅ Environment değiştiğinde sadece env variable güncellenir
