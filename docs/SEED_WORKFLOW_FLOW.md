# Seed Workflow Akış Analizi

## 🔄 Test Branch'inde Seed Workflow Akışı

### 1. Seed Workflow Başlatılır

```bash
# Deploy workflow çalıştığında
docker compose run --rm backend npm run seed:all
```

### 2. Görseller MinIO'ya Yüklenir

**Örnek: `prisma/seed.ts` - Marketplace görselleri:**

```typescript
const s3Service = new S3Service()
await s3Service.checkAndCreateBucket()

const objectKey = `brands/catalog/${brand.id}/marketplace.jpg`
const externalUrl = await s3Service.uploadFile(
  objectKey,
  marketplaceImageBuffer,
  'image/jpeg'
)
```

**Akış:**
1. `S3Service.uploadFile()` çağrılır
2. Görsel MinIO'ya yüklenir (`http://minio:9000` - container içi)
3. `S3Service.getFileUrl()` çağrılır
4. `getFileUrl()` → `getPublicMediaBaseUrl()` kullanır
5. `getPublicMediaBaseUrl()` → `.env` dosyasından `SEED_MEDIA_BASE_URL` okur

### 3. URL Oluşturulur

**`S3Service.getFileUrl()`:**
```typescript
getFileUrl(fileName: string): string {
  const publicBase = getPublicMediaBaseUrl(); // .env'den SEED_MEDIA_BASE_URL okur
  return `${publicBase}/${s3Config.bucketName}/${fileName}`;
}
```

**Örnek:**
- Environment: `SEED_MEDIA_BASE_URL=http://api-test.tipbox.co:9000`
- Object Key: `brands/catalog/123/marketplace.jpg`
- **Sonuç:** `http://api-test.tipbox.co:9000/tipbox-media/brands/catalog/123/marketplace.jpg`

### 4. Database'e Kaydedilir

```typescript
await prisma.brand.update({
  where: { id: brand.id },
  data: {
    imageUrl: externalUrl, // http://api-test.tipbox.co:9000/tipbox-media/...
  }
});
```

## ✅ Doğru Akış

```
1. Seed workflow başlar
   ↓
2. S3Service.uploadFile() çağrılır
   ↓
3. Görsel MinIO'ya yüklenir (container içi: minio:9000)
   ↓
4. getFileUrl() → getPublicMediaBaseUrl() çağrılır
   ↓
5. getPublicMediaBaseUrl() → .env'den SEED_MEDIA_BASE_URL okur
   ↓
6. URL oluşturulur: http://api-test.tipbox.co:9000/tipbox-media/...
   ↓
7. Database'e kaydedilir
```

## ⚠️ Tespit Edilen Sorunlar ve Düzeltmeler

### Sorun 1: `getPublicMediaBaseUrl()` Production Endpoint'i Değiştiriyordu

**Önceki Kod:**
```typescript
const normalized = raw.replace('minio:9000', 'localhost:9000');
// Her zaman minio:9000 → localhost:9000 çevirimi yapıyordu
```

**Düzeltme:**
```typescript
// Eğer SEED_MEDIA_BASE_URL set edilmişse direkt kullan (değiştirme)
if (hasPublicEndpoint) {
  return raw.replace(/\/$/, '');
}
// Sadece development'ta minio:9000 → localhost:9000
```

### Sorun 2: `brand-products.seed.ts` Gereksiz Replace

**Önceki Kod:**
```typescript
const uploadedUrl = await s3Service.uploadFile(...);
const localhostUrl = uploadedUrl.replace('minio:9000', 'localhost:9000');
// Gereksiz replace - uploadFile() zaten doğru URL'i döndürüyor
```

**Düzeltme:**
```typescript
const uploadedUrl = await s3Service.uploadFile(...);
// uploadFile() zaten getPublicMediaBaseUrl() kullanarak doğru URL'i döndürür
eventImageUrls.push(uploadedUrl);
```

## 🎯 Sonuç

Test branch'inde deploy alındığında:

1. ✅ Seed workflow çalışır
2. ✅ Görseller MinIO'ya yüklenir (container içi: `minio:9000`)
3. ✅ URL'ler `.env` dosyasından `SEED_MEDIA_BASE_URL` okunarak oluşturulur
4. ✅ Database'e `http://api-test.tipbox.co:9000/tipbox-media/...` formatında kaydedilir
5. ✅ Frontend doğrudan erişebilir

## 📋 Kontrol Listesi

- [x] `getPublicMediaBaseUrl()` production endpoint'i koruyor
- [x] `brand-products.seed.ts` gereksiz replace kaldırıldı
- [x] `S3Service.uploadFile()` doğru URL döndürüyor
- [x] Seed workflow `.env` dosyasından URL okur
- [x] Database'e production endpoint'i ile kaydedilir
