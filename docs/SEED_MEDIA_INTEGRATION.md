# Seed Media Integration - MinIO & Database

Bu dokümantasyon, seed görsellerinin MinIO'ya yüklenmesi, URL oluşturma mantığı ve database entegrasyonunu açıklar.

## 📁 Dosya Yapısı

```
prisma/
  seed.ts                          # Ana seed dosyası
  seed/
    helpers/
      media.helper.ts              # URL oluşturma helper'ı
    seed-media-map.json            # Görsel key → MinIO path mapping
tests/
  assets/
    product/                       # Ürün görselleri (phone1.png, phone2.png, vb.)
    catalog/                       # Kategori görselleri
    badge/                         # Badge görselleri
    userprofile/                   # Kullanıcı profil görselleri
    post/                          # Post görselleri
```

## 🔑 Temel Kavramlar

### 1. Seed Media Key Mapping

**`prisma/seed/seed-media-map.json`** dosyası, semantic key'leri MinIO object path'lerine map eder:

```json
{
  "product.phone.phone1": {
    "targetKey": "products/phones/phone1.png"
  },
  "catalog.computers-tablets": {
    "targetKey": "catalog/computers-tablets.png"
  },
  "user.avatar.primary": {
    "targetKey": "profile-pictures/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-avatar.jpg"
  }
}
```

**Key formatı**: `{kategori}.{altkategori}.{isim}` (örn: `product.phone.phone1`, `catalog.home-appliances`)

### 2. URL Oluşturma Helper

**`prisma/seed/helpers/media.helper.ts`** içindeki `getSeedMediaUrl()` fonksiyonu:

```typescript
export function getSeedMediaUrl(key: SeedMediaKey, fallbackUrl?: string): string {
  const entry = seedMedia[key];
  const baseUrl = getMinioPublicEndpoint();  // http://localhost:9000
  const bucketName = getBucketName();        // tipbox-media
  return `${baseUrl}/${bucketName}/${entry.targetKey}`;
}
```

**Örnek çıktı**:
```
http://localhost:9000/tipbox-media/products/phones/phone1.png
```

### 3. Environment Variable Önceliği

MinIO endpoint'i şu sırayla belirlenir:

1. `SEED_MEDIA_BASE_URL` (önerilen - seed için tek kontrol noktası)
2. `MINIO_PUBLIC_ENDPOINT` (frontend'in eriştiği host)
3. `S3_ENDPOINT` (container içi endpoint, `minio:9000` → `localhost:9000`'a çevrilir)
4. Varsayılan: `http://localhost:9000`

## 🎯 Kullanım Senaryoları

### Senaryo 1: Seed'de Ürün Görseli Ekleme

**`prisma/seed.ts`** içinde:

```typescript
import { getSeedMediaUrl } from './seed/helpers/media.helper'

// Ürün oluştururken
const product = await prisma.product.create({
  data: {
    name: 'iPhone 15 Pro',
    brand: 'Apple',
    imageUrl: getSeedMediaUrl('product.phone.phone2'),  // ✅ Key kullan
    // ...
  }
});
```

**Sonuç**: Database'de `imageUrl = "http://localhost:9000/tipbox-media/products/phones/phone2.png"` olarak kaydedilir.

### Senaryo 2: Kategori Görseli Ekleme

```typescript
const category = await prisma.mainCategory.create({
  data: {
    name: 'Teknoloji',
    imageUrl: getSeedMediaUrl('catalog.computers-tablets'),
  }
});
```

### Senaryo 3: Fallback URL Kullanımı

Eğer key bulunamazsa, fallback URL kullanılabilir:

```typescript
const url = getSeedMediaUrl('inventory.dyson-media', 'https://cdn.tipbox.co/inventory/dyson-1.jpg');
// Key yoksa → fallback URL döner
```

## 📤 MinIO Upload İşlemleri

### S3Service Kullanımı

**`src/infrastructure/s3/s3.service.ts`** içindeki `uploadFile()` metodu:

```typescript
const s3 = new S3Service();
const buffer = readFileSync('tests/assets/product/phone1.png');
const url = await s3.uploadFile(
  'products/phones/phone1.png',  // MinIO object key
  buffer,                        // File buffer
  'image/png'                    // MIME type
);
// Dönen URL: http://localhost:9000/tipbox-media/products/phones/phone1.png
```

### Script ile Toplu Upload

**`scripts/seed-user-inventory-media.ts`** örneği:

```typescript
// Kullanıcının tüm inventory'lerine görsel yükle
for (const inv of inventories) {
  const fileName = files[Math.floor(Math.random() * files.length)];
  const buffer = readFileSync(path.join(ASSETS_DIR, fileName));
  
  const objectKey = `posts/${userId}/${Date.now()}-${path.basename(fileName)}`;
  const url = await s3.uploadFile(objectKey, buffer, contentType);
  
  // Database'e kaydet
  await prisma.inventoryMedia.create({
    data: {
      inventoryId: inv.id,
      mediaUrl: url,  // ✅ MinIO URL'i direkt kaydedilir
      type: InventoryMediaType.IMAGE,
    },
  });
}
```

## 🔄 Feed/User Service'lerde Image Kullanımı

### FeedService - contextData.image

**`src/application/feed/feed.service.ts`**:

```typescript
private buildContextData(post: any): ContextData {
  if (contextType === 'PRODUCT' && post.product) {
    return {
      id: String(product.id),
      name: product.name,
      subName: group?.name || '',
      image: product.imageUrl || null,  // ✅ DB'den gelen MinIO URL
      // ...
    };
  }
}
```

**Response örneği**:
```json
{
  "contextType": "PRODUCT",
  "contextData": {
    "id": "8295a03d-494d-475b-aa89-6bc4e9ebc624",
    "name": "iPhone 15 Pro",
    "subName": "Apple",
    "image": "http://localhost:9000/tipbox-media/products/phones/phone2.png"
  }
}
```

### UserService - getProductBase

**`src/application/user/user.service.ts`**:

```typescript
private async getProductBase(productId: string | null) {
  const product = await this.prisma.product.findUnique({ 
    where: { id: productId },
    include: { group: true }
  });
  
  return {
    id: String(product.id),
    name: product.name,
    subName: product.brand || product.group?.name || '',
    image: product.imageUrl || null,  // ✅ DB'den gelen MinIO URL
  };
}
```

## 📝 Önemli Notlar

1. **Seed sırasında görseller MinIO'ya yüklenmez**: 
   - Seed sadece URL'leri database'e yazar
   - Görsellerin MinIO'da olması beklenir (manuel upload veya script ile)

2. **URL formatı her zaman tutarlıdır**:
   ```
   {BASE_URL}/{BUCKET_NAME}/{targetKey}
   ```
   Örnek: `http://localhost:9000/tipbox-media/products/phones/phone1.png`

3. **Key'ler semantic'tir**:
   - `product.phone.phone1` → Ürün telefon görseli
   - `catalog.home-appliances` → Kategori görseli
   - `user.avatar.primary` → Kullanıcı avatar'ı

4. **Fallback mekanizması**:
   - Key bulunamazsa `fallbackUrl` kullanılır
   - Fallback yoksa hata fırlatılır

## 🚀 Lokal Kurulum Akışı

Yeni bir geliştiricinin aynı görsel + veri setini çalıştırması için önerilen adımlar:

1. **Bağımlılıkları kur:** `npm install`
2. **MinIO servisini başlat:** Docker Compose içindeki MinIO container'ını ayağa kaldır ve `.env` dosyasında `S3_ENDPOINT / MINIO_PUBLIC_ENDPOINT / SEED_MEDIA_BASE_URL / S3_BUCKET_NAME` değerlerini doğrula.
3. **Gerekirse görselleri yükle:** İlk kez kuruluyorsa veya bucket boşsa
   ```bash
   npm run upload:seed-media
   # veya
   npx ts-node scripts/upload-seed-media.ts
   ```
   Bu script `tests/assets/**` klasöründen dosyaları okuyup MinIO'ya yükler ve `prisma/seed/seed-media-map.json` haritasını günceller. Bucket'ta aynı dosyalar zaten varsa bu adım atlanabilir.
4. **Veritabanını sıfırla ve seed et:**
   ```bash
   npx prisma migrate reset --skip-seed
   npx prisma db seed
   ```
   Seed, kullanıcıları, ilişkileri, görsel URL'lerini ve profil istatistiklerini otomatik olarak oluşturur.
5. **Doğrulama (opsiyonel):** `/users/me/profile`, `/feed`, `/marketplace/listings` gibi endpoint'lere istek atarak görsellerin doğru döndüğünü kontrol et.

Bu akış sayesinde MinIO'ya manuel upload veya tabloya tek tek URL girme ihtiyacı kalmaz; repo'yu pull eden herkes birkaç komutla aynı veriyi elde eder.

## 🛠️ Yeni Görsel Ekleme Adımları

1. **Görseli `tests/assets/` altına ekle** (örn: `tests/assets/product/new-phone.png`)

2. **`seed-media-map.json`'a key ekle**:
   ```json
   {
     "product.phone.newphone": {
       "targetKey": "products/phones/new-phone.png"
     }
   }
   ```

3. **Seed'de kullan**:
   ```typescript
   imageUrl: getSeedMediaUrl('product.phone.newphone')
   ```

4. **Görseli MinIO'ya yükle** (manuel veya script ile)

## 🔍 İlgili Dosyalar

- **Helper**: `prisma/seed/helpers/media.helper.ts`
- **Mapping**: `prisma/seed/seed-media-map.json`
- **S3 Service**: `src/infrastructure/s3/s3.service.ts`
- **Seed Script**: `prisma/seed.ts`
- **Upload Script**: `scripts/seed-user-inventory-media.ts`

