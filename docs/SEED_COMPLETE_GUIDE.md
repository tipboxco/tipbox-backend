# Seed Workflow - Kapsamlı Rehber

Bu dokümantasyon, seed workflow'unun tüm yönlerini kapsar: görsel yükleme, URL yapılandırması, yeni veri ekleme ve production ayarları.

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Seed Workflow Akışı](#seed-workflow-akışı)
3. [Seed Optimizasyon Stratejisi](#seed-optimizasyon-stratejisi)
4. [Görsel Yükleme Sistemi](#görsel-yükleme-sistemi)
5. [Yeni Seed Verisi Ekleme](#yeni-seed-verisi-ekleme)
6. [Production URL Yapılandırması](#production-url-yapılandırması)
7. [Migration Gereksinimleri](#migration-gereksinimleri)
8. [Komutlar ve Kullanım](#komutlar-ve-kullanım)

---

## 🎯 Genel Bakış

### Seed Workflow Özeti

```
1. Schema validation ve Prisma client generate
   ↓
2. Verileri temizle (taxonomy korunur veya silinir)
   ↓
3. Seed görsellerini MinIO'ya yükle (otomatik)
   ↓
4. Seed verilerini database'e ekle
   ↓
5. Tamamlandı
```

### Temel Kavramlar

- **Modüler seed dosyaları** (`prisma/seed/*.seed.ts`): Test için kullanılır
- **Ana seed dosyası** (`prisma/seed.ts`): Onaylanmış, final veriler için
- **seed-media-map.json**: Görsel key → MinIO path mapping (otomatik oluşturulur)
- **Idempotent helper'lar**: Taxonomy verilerini güvenli şekilde oluşturur/günceller

---

## 🔄 Seed Workflow Akışı

### 1. Seed Başlatılır

```bash
npm run db:seed          # Taxonomy korunur, sadece user/content temizlenir
npm run db:seed:all      # Tüm veriler temizlenir (taxonomy dahil)
```

### 2. Görseller Otomatik Yüklenir

**`prisma/seed.ts` başında:**
```typescript
// ensureSeedMediaUploaded() otomatik çağrılır
await ensureSeedMediaUploaded();
```

**Akış:**
1. `seed-media-map.json` okunur
2. Her key için local dosya path'i bulunur
3. Görseller MinIO'ya yüklenir (idempotent)
4. Seed devam eder

### 3. Seed Verileri Database'e Eklenir

```typescript
// getSeedMediaPath() sadece path döndürür
const imagePath = getSeedMediaPath('catalog.computers-tablets');
// → "tipbox-media/catalog/computers-tablets.png"

// Database'e path kaydedilir
await prisma.mainCategory.create({
  data: {
    name: 'Teknoloji',
    imageUrl: imagePath, // Path database'de tutulur
  }
});
```

### 4. Runtime'da URL Oluşturulur

API response'larında `resolveMediaUrl()` veya `getPublicMediaBaseUrl()` kullanılır:

```typescript
// src/application/brand/brand.service.ts
const baseUrl = getPublicMediaBaseUrl();
// → http://localhost:9000 (development)
// → http://api-test.tipbox.co:9000 (production)

const fullUrl = `${baseUrl}/${brand.imageUrl}`;
// → http://localhost:9000/tipbox-media/brand-categories/cameras.png
```

---

## ⚡ Seed Optimizasyon Stratejisi

### Genel Bakış

Seed verileri maliyet optimizasyonu için iki kategoriye ayrılmıştır:

1. **Test Kategorileri** (Electronics, Beauty/Cosmetics): Tam veri seti
2. **Diğer Kategoriler**: Minimal veri seti

### Test Kategorileri

**Brand Categories:**
- `Electronics` - Tam product ve post seti
- `Beauty` (Cosmetics) - Tam product ve post seti

**Bu kategoriler için:**
- ✅ Tüm product'lar oluşturulur (config'de tanımlı tüm product'lar)
- ✅ Her product için **20 post** oluşturulur
- ✅ Post type dağılımı:
  - EXPERIENCE: 6 post
  - COMPARE: 3 post
  - UPDATE: 4 post
  - QUESTION: 3 post
  - TIPS: 2 post
  - FREE: 2 post

### Diğer Kategoriler

**Brand Categories:**
- Technology, Home & Living, Kitchen, Health & Fitness, Fashion, Gaming, Outdoor, Pets, Travel, Baby, Automotive, Sustainability

**Bu kategoriler için:**
- ⚠️ Sadece **ilk 1-2 product** oluşturulur (config'de tanımlı olsa bile)
- ⚠️ Her product için **5 post** oluşturulur
- ⚠️ Post type dağılımı:
  - EXPERIENCE: 2 post
  - COMPARE: 1 post
  - UPDATE: 1 post
  - QUESTION: 1 post

### Diğer Post Kaynakları (Sınırlandırılmış)

Seed dosyasında diğer post oluşturma noktaları da optimize edilmiştir:

```typescript
// AudioMax brand feed posts
// Önceki: 20 post → Şimdi: 10 post

// Trending posts
// Önceki: randomBetween(5, 8) → Şimdi: randomBetween(2, 3)

// Brand experiences boost
// Önceki: 15 post → Şimdi: 5 post

// Julia Havk TIPS posts
// Önceki: 5 post → Şimdi: 3 post
```

### Kaldırılan Fonksiyonlar

**`ensureAllPostsHaveMedia()` fonksiyonu kaldırılmıştır:**
- Bu fonksiyon tüm post'lara otomatik media ekliyordu
- Maliyet artışına neden oluyordu
- Artık sadece görsel gerektiren post'lar için `ensurePostMedia()` kullanılıyor

### Seed Başında Veri Temizleme

Seed başında tüm ContentPost ve PostMedia kayıtları temizlenir:

```typescript
// prisma/seed.ts - main() fonksiyonunun başında
await prisma.postMedia.deleteMany()
await prisma.contentPost.deleteMany()
// ... diğer ilgili tablolar
```

**ÖNEMLİ:** Bu temizleme işlemi seed'in her çalıştırılmasında yapılır, böylece duplicate veriler oluşmaz.

### Product Görsel Yükleme

**Test kategorileri için özel görsel yükleme:**
- Electronics: `tests/assets/brands/electronics/` klasöründen görseller
- Cosmetics: `tests/assets/brands/Cosmetic/` klasöründen görseller
- Apple Products: `tests/assets/Apple_Products/` klasöründen görseller

Bu görseller gerçeğe yakın test verileri için kullanılır.

### Örnek: Brand Product Oluşturma

```typescript
// prisma/seed.ts - seedBrandProducts() fonksiyonu
const isTestCategory = brandCategory?.name === 'Electronics' || brandCategory?.name === 'Beauty'

// Test kategorisi değilse, sadece ilk 1-2 product'ı al
if (!isTestCategory && productConfigs.length > 2) {
  productConfigs = productConfigs.slice(0, 2)
  console.log(`  ⚠️  Non-test category: Limiting to ${productConfigs.length} products`)
}

// Post sayısı belirleme
const totalPostsPerProduct = isTestCategory ? 20 : 5

// Post type dağılımı
const postDistribution = isTestCategory
  ? { EXPERIENCE: 6, COMPARE: 3, UPDATE: 4, QUESTION: 3, TIPS: 2, FREE: 2 }
  : { EXPERIENCE: 2, COMPARE: 1, UPDATE: 1, QUESTION: 1 }
```

---

## 📦 Görsel Yükleme Sistemi

### Dosya Yapısı

```
prisma/
  seed.ts                          # Ana seed dosyası
  seed/
    helpers/
      media.helper.ts              # getSeedMediaPath(), getSeedMediaUrl()
      ensure-seed-media.ts         # ensureSeedMediaUploaded() - otomatik yükleme
    seed-media-map.json            # Key → targetKey mapping (otomatik oluşturulur)
tests/
  assets/
    catalog/                       # Kategori görselleri
    product/                       # Ürün görselleri
    badge/                         # Badge görselleri
    userprofile/                   # Kullanıcı profil görselleri
    post/                          # Post görselleri
```

### Seed Media Key Mapping

**`prisma/seed/seed-media-map.json`** (otomatik oluşturulur):

```json
{
  "catalog.computers-tablets": {
    "targetKey": "catalog/computers-tablets.png"
  },
  "brand.category.cameras": {
    "targetKey": "brand-categories/cameras.png"
  },
  "product.phone.phone1": {
    "targetKey": "products/phones/phone1.png"
  }
}
```

**Key formatı**: `{kategori}.{altkategori}.{isim}`

### Helper Fonksiyonlar

#### `getSeedMediaPath(key)`

Sadece path döndürür (database'e yazılacak format):

```typescript
getSeedMediaPath('catalog.computers-tablets')
// → "tipbox-media/catalog/computers-tablets.png"
```

#### `ensureSeedMediaUploaded()`

Seed başında otomatik çağrılır, tüm görselleri MinIO'ya yükler:

```typescript
// prisma/seed.ts içinde
await ensureSeedMediaUploaded();
// ✅ Tüm seed-media-map.json'daki görseller MinIO'ya yüklenir
```

### Görsel Yükleme Akışı

```
1. Seed başlar
   ↓
2. ensureSeedMediaUploaded() çağrılır
   ↓
3. seed-media-map.json okunur
   ↓
4. Her key için:
   - Local dosya path'i bulunur (tests/assets/...)
   - Dosya MinIO'ya yüklenir (entry.targetKey)
   ↓
5. Seed devam eder, getSeedMediaPath() ile path'ler database'e yazılır
```

**ÖNEMLİ:** Görseller seed başında otomatik yüklenir, ayrıca `upload-seed-media.ts` çalıştırmanıza gerek yok!

---

## ➕ Yeni Seed Verisi Ekleme

### Senaryo 1: Görsel Olmayan Veri

#### Adım 1: Test için Modüler Seed Dosyası

```typescript
// prisma/seed/my-new-seed.ts
import { prisma } from './types';

export async function seedMyNewData(): Promise<void> {
  await prisma.user.create({
    data: { email: 'test@example.com' }
  });
}
```

#### Adım 2: Test Et

```bash
docker-compose exec backend npx ts-node prisma/seed/my-new-seed.ts
```

#### Adım 3: seed.ts'ye Manuel Ekle

**ÖNEMLİ:** Modüler dosyayı import etme! Sadece kodu kopyala:

```typescript
// prisma/seed.ts içinde
async function main() {
  // ... mevcut kod ...
  
  // Yeni seed verisi (my-new-seed.ts'den kopyalandı)
  await prisma.user.create({
    data: { email: 'test@example.com' }
  });
}
```

#### Adım 4: Final Test

```bash
npm run db:seed
```

---

### Senaryo 2: Yeni Görsel ile Veri

#### Adım 1: Görseli Ekle

```bash
tests/assets/catalog/my-new-category.png
```

#### Adım 2: upload-seed-media.ts'yi Güncelle

```typescript
// scripts/upload-seed-media.ts
const catalogFiles = [
  // ... mevcut dosyalar ...
  'my-new-category.png', // YENİ
];
```

#### Adım 3: upload-seed-media.ts'yi Çalıştır

Bu script `seed-media-map.json`'ı günceller:

```bash
docker-compose exec backend npx ts-node scripts/upload-seed-media.ts
```

**Sonuç:** `seed-media-map.json`'da yeni key oluşur:
```json
{
  "catalog.my-new-category": {
    "targetKey": "catalog/my-new-category.png"
  }
}
```

#### Adım 4: seed.ts'de Kullan

```typescript
await ensureMainCategory({
  name: 'Yeni Kategori',
  imageKey: 'catalog.my-new-category', // YENİ KEY
});
```

**Not:** Görsel otomatik yüklenir (`ensureSeedMediaUploaded()` sayesinde), ayrıca yükleme yapmanıza gerek yok!

---

### Senaryo 3: Brand Category Görseli

Brand category görselleri `catalog/` klasöründen gelir:

1. Görseli `tests/assets/catalog/` klasörüne ekle
2. `upload-seed-media.ts`'de `catalogFiles` array'ine ekle
3. `upload-seed-media.ts`'yi çalıştır
4. Hem `catalog.my-brand-category` hem de `brand.category.my-brand-category` key'leri oluşur

```typescript
await ensureBrandCategory({
  name: 'My Brand Category',
  imageKey: 'brand.category.my-brand-category',
});
```

---

## 🌐 Production URL Yapılandırması

### Environment Variables

**Öncelik Sırası:**
1. `SEED_MEDIA_BASE_URL` (önerilen - seed ve runtime için tek kontrol noktası)
2. `MINIO_PUBLIC_ENDPOINT` (sadece frontend için)
3. `S3_ENDPOINT` (container içi, production'da kullanmayın!)
4. Varsayılan: `http://localhost:9000` (development)

### Production `.env` Örneği

```env
# MinIO/S3 yapılandırması (container içi)
S3_ENDPOINT=http://minio:9000
S3_BUCKET_NAME=tipbox-media
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123

# Production Public Endpoint (Frontend ve Seed için)
SEED_MEDIA_BASE_URL=http://api-test.tipbox.co:9000
```

### Nasıl Çalışır?

#### 1. Seed Workflow

```typescript
// prisma/seed/helpers/media.helper.ts
function getMinioPublicEndpoint(): string {
  return process.env.SEED_MEDIA_BASE_URL || 
         process.env.MINIO_PUBLIC_ENDPOINT || 
         'http://localhost:9000';
}

// getSeedMediaPath() sadece path döndürür
// Runtime'da getPublicMediaBaseUrl() ile URL oluşturulur
```

#### 2. Database'e Kayıt

```typescript
// Seed sırasında sadece path kaydedilir
const imagePath = getSeedMediaPath('product.phone.phone1');
// → "tipbox-media/products/phones/phone1.png"

await prisma.product.create({
  data: { imageUrl: imagePath }
});
```

#### 3. Runtime'da URL Oluşturma

```typescript
// src/infrastructure/config/media.config.ts
export function getPublicMediaBaseUrl(): string {
  return process.env.SEED_MEDIA_BASE_URL || 
         process.env.MINIO_PUBLIC_ENDPOINT || 
         'http://localhost:9000';
}

// API response'larında
const baseUrl = getPublicMediaBaseUrl();
const fullUrl = `${baseUrl}/${product.imageUrl}`;
// Production: http://api-test.tipbox.co:9000/tipbox-media/products/phones/phone1.png
```

### Development vs Production

**Development:**
- `SEED_MEDIA_BASE_URL` set edilmezse → `http://localhost:9000` kullanılır
- Container içi: `minio:9000` → `localhost:9000`'a otomatik çevrilir

**Production:**
- `SEED_MEDIA_BASE_URL` **MUTLAKA** set edilmelidir!
- Örnek: `SEED_MEDIA_BASE_URL=http://api-test.tipbox.co:9000`

---

## 🔄 Migration Gereksinimleri

### Önemli: Migration'ları Uygulama

Seed çalıştırmadan **ÖNCE** tüm migration'ların uygulandığından emin olun:

```bash
# Migration durumunu kontrol et
docker-compose exec backend npx prisma migrate status

# Uygulanmamış migration'ları uygula
docker-compose exec backend npx prisma migrate deploy
```

### Gerekli Migration'lar

**Experience Taxonomy Relations:**
- `experience_snippet_id` kolonu (Inventory, ContentPost)
- `experience_duration_id` kolonu (Inventory, ContentPost)
- `experience_location_id` kolonu (Inventory, ContentPost)
- `experience_purpose_id` kolonu (Inventory, ContentPost)

Bu kolonlar olmadan seed çalıştırılırsa hata alırsınız:
```
The column `inventories.experience_snippet_id` does not exist in the current database.
```

### Prisma Client Generate

Migration uygulandıktan sonra Prisma Client'ı yeniden generate edin:

```bash
docker-compose exec backend npx prisma generate
```

**ÖNEMLİ:** Container içinde çalıştırın, local'de değil!

### Schema Değişiklikleri Sonrası

Schema'da değişiklik yaptıktan sonra:

1. Migration oluştur:
   ```bash
   docker-compose exec backend npx prisma migrate dev --name your_migration_name
   ```

2. Migration'ı uygula:
   ```bash
   docker-compose exec backend npx prisma migrate deploy
   ```

3. Prisma Client'ı generate et:
   ```bash
   docker-compose exec backend npx prisma generate
   ```

4. Seed'i çalıştır:
   ```bash
   npm run db:seed:all
   ```

---

## 🛠️ Komutlar ve Kullanım

### Seed Komutları

```bash
# Seed (taxonomy korunur)
npm run db:seed

# Seed All (tüm veriler temizlenir)
npm run db:seed:all

# Reset (sadece user/content, taxonomy korunur)
npm run db:reset

# Reset All (tüm veriler)
npm run db:reset:all

# Reset Force (migration'ları baştan oluşturur)
npm run db:reset:force
```

### Görsel Yükleme Komutları

```bash
# Yeni görsel ekledikten sonra (seed-media-map.json güncellemek için)
docker-compose exec backend npx ts-node scripts/upload-seed-media.ts

# Not: Seed çalıştırırken görseller otomatik yüklenir!
```

### Modüler Seed Test

```bash
# Test için modüler seed dosyasını çalıştır
docker-compose exec backend npx ts-node prisma/seed/my-new-seed.ts
```

---

## 📝 Önemli Notlar

### 1. Modüler Seed Dosyaları vs seed.ts

- **Modüler seed dosyaları** (`prisma/seed/*.seed.ts`): Sadece test için
- **seed.ts**: Onaylanmış, final veriler için
- **Modüler dosyaları seed.ts'de import etme!** Sadece kodu kopyala

### 2. Görsel Yükleme

- **`upload-seed-media.ts`**: `seed-media-map.json` oluşturur/günceller
- **`ensure-seed-media.ts`**: Seed başında otomatik olarak görselleri yükler
- **Yeni görsel ekledikten sonra `upload-seed-media.ts` çalıştır** (seed-media-map.json güncellenir)

### 3. seed-media-map.json

- Bu dosya **otomatik oluşturulur** (`upload-seed-media.ts` tarafından)
- **Manuel düzenleme yapmayın!**

### 4. Idempotent Helper Fonksiyonlar

Taxonomy verileri için idempotent helper'lar kullan:

```typescript
// ✅ DOĞRU
await ensureMainCategory({
  name: 'Teknoloji',
  imageKey: 'catalog.computers-tablets',
});

// ❌ YANLIŞ (duplicate olabilir)
await prisma.mainCategory.create({
  data: { name: 'Teknoloji' }
});
```

**Mevcut idempotent helper'lar:**
- `ensureMainCategory()`, `ensureSubCategory()`, `ensureProductGroup()`
- `ensureProduct()`, `ensureBrandCategory()`, `ensureBrand()`
- `ensureBadgeCategory()`, `ensureBadge()`, `ensureUserTheme()`
- `ensureComparisonMetric()`, `ensureBoostOption()`
- `ensureAchievementChain()`, `ensureAchievementGoal()`

### 5. Path vs URL

- **Database'de**: Sadece path tutulur (`tipbox-media/catalog/cameras.png`)
- **API response'larında**: Tam URL oluşturulur (`http://localhost:9000/tipbox-media/catalog/cameras.png`)
- **Seed'de**: `getSeedMediaPath()` kullan (path döndürür)
- **Runtime'da**: `getPublicMediaBaseUrl()` + path = tam URL

### 6. Seed Optimizasyonu

- **Test kategorileri** (Electronics, Beauty): Tam veri seti
- **Diğer kategoriler**: Minimal veri seti (1-2 product, 5 post per product)
- **`ensureAllPostsHaveMedia()` kaldırıldı**: Artık sadece görsel gerektiren post'lar için media ekleniyor
- **Diğer post kaynakları sınırlandırıldı**: AudioMax feed (10), trending (2-3), brand experiences (5), Julia Havk TIPS (3)

### 7. Seed Başında Veri Temizleme

Seed başında (`main()` fonksiyonunun başında) tüm ContentPost ve PostMedia kayıtları temizlenir. Bu sayede:
- Duplicate veriler oluşmaz
- Her seed çalıştırmasında temiz bir başlangıç yapılır
- Taxonomy verileri korunur (eğer `db:seed` kullanıyorsanız)

---

## ❓ Sık Sorulan Sorular

### Q: Seed çalıştırırken görseller otomatik yükleniyor mu?

**A:** Evet! `ensureSeedMediaUploaded()` fonksiyonu seed başında otomatik olarak tüm görselleri yükler. Ayrıca `upload-seed-media.ts` çalıştırmanıza gerek yok.

### Q: Yeni görsel ekledim, ne yapmalıyım?

**A:**
1. Görseli `tests/assets/` klasörüne ekle
2. `upload-seed-media.ts`'yi güncelle (dosya listesine ekle)
3. `upload-seed-media.ts`'yi çalıştır (seed-media-map.json güncellenir)
4. `seed.ts`'de yeni key'i kullan
5. `npm run db:seed` çalıştır (görsel otomatik yüklenir)

### Q: Modüler seed dosyasını seed.ts'de import edebilir miyim?

**A:** Hayır. Modüler dosyalar sadece test için. Onaylandıktan sonra kodu manuel olarak `seed.ts`'ye kopyala.

### Q: Production'da URL'ler nasıl çalışır?

**A:** 
- `.env` dosyasına `SEED_MEDIA_BASE_URL=http://api-test.tipbox.co:9000` ekle
- Seed çalıştırıldığında URL'ler bu endpoint ile oluşturulur
- Runtime'da `getPublicMediaBaseUrl()` aynı endpoint'i kullanır

### Q: Taxonomy verilerini nasıl eklerim?

**A:** Idempotent helper fonksiyonlar kullan (`ensureMainCategory`, `ensureBrand`, vb.). Bu fonksiyonlar zaten varsa günceller, yoksa oluşturur ve mevcut ID'yi korur.

### Q: Seed çalıştırırken "column does not exist" hatası alıyorum, ne yapmalıyım?

**A:** 
1. Migration durumunu kontrol et: `docker-compose exec backend npx prisma migrate status`
2. Uygulanmamış migration'ları uygula: `docker-compose exec backend npx prisma migrate deploy`
3. Prisma Client'ı generate et: `docker-compose exec backend npx prisma generate`
4. Seed'i tekrar çalıştır: `npm run db:seed:all`

### Q: Test kategorileri ve diğer kategoriler arasındaki fark nedir?

**A:**
- **Test kategorileri** (Electronics, Beauty): Tam veri seti - tüm product'lar ve her product için 20 post
- **Diğer kategoriler**: Minimal veri seti - sadece 1-2 product ve her product için 5 post
- Bu optimizasyon maliyetleri düşürmek için yapılmıştır

### Q: Seed başında hangi veriler temizleniyor?

**A:** Seed başında (`main()` fonksiyonunun başında) şu veriler temizlenir:
- `PostMedia` - Tüm post media kayıtları
- `ContentPost` - Tüm content post kayıtları
- İlgili tablolar (comments, likes, favorites, views, vb.)

**ÖNEMLİ:** Taxonomy verileri (categories, brands, vb.) korunur (eğer `db:seed` kullanıyorsanız).

---

## 🎯 Hızlı Referans

### Yeni Seed Verisi Ekleme Checklist

- [ ] Test için modüler seed dosyası oluştur/güncelle
- [ ] Modüler seed dosyasını çalıştır ve test et
- [ ] Onaylandıktan sonra kodu `seed.ts`'ye manuel kopyala
- [ ] (Opsiyonel) Yeni görsel varsa:
  - [ ] Görseli `tests/assets/` klasörüne ekle
  - [ ] `upload-seed-media.ts`'yi güncelle
  - [ ] `upload-seed-media.ts`'yi çalıştır
  - [ ] `seed.ts`'de yeni key'i kullan
- [ ] `npm run db:seed` ile final test

### Komut Özeti

```bash
# Migration işlemleri (seed'den önce)
docker-compose exec backend npx prisma migrate status      # Durum kontrolü
docker-compose exec backend npx prisma migrate deploy     # Migration uygula
docker-compose exec backend npx prisma generate           # Prisma Client generate

# Seed işlemleri
npm run db:seed          # Seed (taxonomy korunur)
npm run db:seed:all      # Seed All (tüm veriler temizlenir)
npm run db:reset         # Reset (taxonomy korunur)
npm run db:reset:all     # Reset All
npm run db:reset:force   # Reset Force (migration)

# Görsel yükleme (yeni görsel ekledikten sonra)
docker-compose exec backend npx ts-node scripts/upload-seed-media.ts

# Modüler seed test
docker-compose exec backend npx ts-node prisma/seed/my-new-seed.ts
```

---

## 📚 İlgili Dosyalar

- **Ana seed**: `prisma/seed.ts`
- **Media helper**: `prisma/seed/helpers/media.helper.ts`
- **Ensure media**: `prisma/seed/helpers/ensure-seed-media.ts`
- **Media map**: `prisma/seed/seed-media-map.json`
- **Upload script**: `scripts/upload-seed-media.ts`
- **Clear & seed**: `scripts/clear-and-seed.ts`
- **S3 Service**: `src/infrastructure/s3/s3.service.ts`
- **Media config**: `src/infrastructure/config/media.config.ts`
