# Görsel Yönetimi - Kullanım Kılavuzu

Bu dokümantasyon, seed sürecinde tüm görsel tiplerini (product, brand, category, badge, post, banner, vb.) manuel olarak ekleme ve yönetme işlemlerini açıklar.

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Desteklenen Görsel Tipleri](#desteklenen-görsel-tipleri)
3. [Yeni Görsel Ekleme](#yeni-görsel-ekleme)
4. [Mevcut Görseli Değiştirme](#mevcut-görseli-değiştirme)
5. [Klasör Bazlı Görsel Ekleme](#klasör-bazlı-görsel-ekleme)
6. [Tüm Entity Görsellerini Güncelleme](#tüm-entity-görsellerini-güncelleme)
7. [Örnekler](#örnekler)

---

## 🎯 Genel Bakış

Görsel yönetimi iki aşamadan oluşur:

1. **Görsel Ekleme**: `scripts/upload-seed-media.ts` içinde görselleri tanımlama
2. **Mapping Yönetimi**: `prisma/seed.ts` içinde entity-görsel eşleştirmesi

## 📦 Desteklenen Görsel Tipleri

- **Product**: Ürün görselleri (`tests/assets/product/`)
- **Catalog**: Kategori görselleri (`tests/assets/catalog/`)
- **Badge**: Badge görselleri (`tests/assets/badge/`)
- **BrandBadge**: Brand badge görselleri (`tests/assets/brandbadge/`)
- **Post**: Post görselleri (`tests/assets/post/`)
- **Marketplace**: Marketplace banner görselleri (`tests/assets/marketplace/`)
- **Event**: Event görselleri (`tests/assets/event/`)
- **UserProfile**: Kullanıcı profil görselleri (`tests/assets/userprofile/`)
- **WhatsNews**: News görselleri (`tests/assets/WhatsNews/`)

### Akış

```
1. tests/assets/product/ klasörüne görsel ekle
   ↓
2. upload-seed-media.ts'de görseli tanımla
   ↓
3. npm run upload-seed-media (veya docker-compose exec backend npx ts-node scripts/upload-seed-media.ts)
   ↓
4. seed.ts'de PRODUCT_IMAGE_MAPPING'e ekle
   ↓
5. ensureProduct() ile product oluştur (otomatik görsel atanır)
   VEYA
   updateProductImages() ile mevcut product'ları güncelle
```

---

## 📤 Yeni Görsel Ekleme

### Adım 1: Görseli Ekle

Görseli `tests/assets/product/` klasörüne ekleyin:

```
tests/assets/product/
  └── avonkrem.jpg  ← Yeni görsel
```

### Adım 2: upload-seed-media.ts'de Tanımla

`scripts/upload-seed-media.ts` dosyasında `manualMediaAssets` array'ine ekleyin:

```typescript
const manualMediaAssets: Array<{
  type: 'file' | 'folder';
  category: string; // product, catalog, badge, vb.
  path: string;
  key?: string; // Opsiyonel
}> = [
  // Product görseli
  { type: 'file', category: 'product', path: 'avonkrem.jpg', key: 'product.avonkrem' },
  
  // Catalog görseli
  { type: 'file', category: 'catalog', path: 'phones-new.png', key: 'catalog.phones-new' },
  
  // Badge görseli
  { type: 'file', category: 'badge', path: 'new-badge.png', key: 'badge.new-badge' },
  
  // Key belirtilmezse otomatik oluşturulur
  { type: 'file', category: 'product', path: 'yeni-urun.png' },
];
```

### Adım 3: Görseli Yükle

```bash
# Container içinde
docker-compose exec backend npx ts-node scripts/upload-seed-media.ts

# VEYA local'de
npm run upload-seed-media
```

Bu komut:
- Görseli MinIO'ya yükler
- `seed-media-map.json` dosyasını günceller

### Adım 4: seed.ts'de Mapping Ekle

`prisma/seed.ts` dosyasında `MEDIA_IMAGE_MAPPING`'e ekleyin:

```typescript
const MEDIA_IMAGE_MAPPING: Record<string, {
  product?: Record<string, SeedMediaKey>;
  mainCategory?: Record<string, SeedMediaKey>;
  subCategory?: Record<string, SeedMediaKey>;
  brandCategory?: Record<string, SeedMediaKey>;
  brand?: Record<string, SeedMediaKey>;
  badge?: Record<string, SeedMediaKey>;
  // ... diğer tipler
}> = {
  product: {
    'Avon Krem': 'product.avonkrem', // ← Yeni eklendi
  },
  mainCategory: {
    'Teknoloji': 'catalog.computers-tablets-new', // ← Yeni eklendi
  },
  brand: {
    'TechVision': 'brand.techvision-v2', // ← Yeni eklendi
  },
  badge: {
    'Early Bird': 'badge.early-bird-new', // ← Yeni eklendi
  },
};
```

### Adım 5: Product Oluştur

`ensureProduct()` fonksiyonu otomatik olarak mapping'den görseli bulur:

```typescript
await ensureProduct({
  name: 'Avon Krem',
  brand: 'Avon',
  description: 'Nemlendirici krem',
  // imageKey belirtmeye gerek yok, otomatik bulunur
});
```

---

## 🔄 Mevcut Görseli Değiştirme

### Senaryo: Dyson V15 görselini değiştir

#### Adım 1: Yeni Görseli Ekle

```
tests/assets/product/
  └── dyson-v2.png  ← Yeni görsel
```

#### Adım 2: upload-seed-media.ts'de Tanımla

```typescript
const manualProductAssets = [
  { type: 'file', path: 'dyson-v2.png', key: 'product.dyson-v2' },
];
```

#### Adım 3: Görseli Yükle

```bash
docker-compose exec backend npx ts-node scripts/upload-seed-media.ts
```

#### Adım 4: seed.ts'de Mapping Güncelle

```typescript
const PRODUCT_IMAGE_MAPPING: Record<string, SeedMediaKey> = {
  'Dyson V15': 'product.dyson-v2', // ← Eski: 'product.vacuum.dyson'
  'Dyson': 'product.dyson-v2', // ← Tüm Dyson product'ları için
};
```

#### Adım 5: Mevcut Product'ları Güncelle

**Seçenek 1: Seed içinde manuel çağır**

`prisma/seed.ts` içinde `main()` fonksiyonunun sonuna ekleyin:

```typescript
// Seed sonunda product görsellerini güncelle
await updateProductImages();
```

**Seçenek 2: Ayrı script olarak çalıştır**

```typescript
// prisma/seed/update-product-images.ts
import { updateProductImages } from '../seed';

updateProductImages()
  .then(() => {
    console.log('✅ Product görselleri güncellendi');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Hata:', error);
    process.exit(1);
  });
```

---

## 📁 Klasör Bazlı Görsel Ekleme

### Senaryo: Kremler klasöründeki tüm görselleri ekle

#### Adım 1: Klasör Oluştur ve Görselleri Ekle

```
tests/assets/product/kremler/
  ├── avonkrem.jpg
  ├── niveakrem.png
  └── eucerinkrem.jpg
```

#### Adım 2: upload-seed-media.ts'de Tanımla

```typescript
const manualProductAssets = [
  { type: 'folder', path: 'kremler', key: 'product.kremler' },
];
```

Bu, klasördeki tüm görselleri otomatik olarak ekler:
- `product.kremler.avonkrem`
- `product.kremler.niveakrem`
- `product.kremler.eucerinkrem`

#### Adım 3: Görselleri Yükle

```bash
docker-compose exec backend npx ts-node scripts/upload-seed-media.ts
```

#### Adım 4: seed.ts'de Mapping Ekle

```typescript
const PRODUCT_IMAGE_MAPPING: Record<string, SeedMediaKey> = {
  'Avon Krem': 'product.kremler.avonkrem',
  'Nivea Krem': 'product.kremler.niveakrem',
  'Eucerin Krem': 'product.kremler.eucerinkrem',
};
```

---

## 🔧 Tüm Entity Görsellerini Güncelleme

### updateAllEntityImages() Fonksiyonu

Bu fonksiyon `MEDIA_IMAGE_MAPPING`'de belirtilen tüm entity'lerin görsellerini günceller:
- Products
- MainCategories
- SubCategories
- BrandCategories
- Brands
- Badges

**Özellikler:**
- ✅ Sadece mapping'de belirtilen product'ları günceller
- ✅ Görsel değişmemişse güncelleme yapmaz
- ✅ Hata durumunda uyarı verir, seed devam eder
- ✅ Detaylı log çıktısı verir

**Kullanım:**

```typescript
// seed.ts içinde
await updateAllEntityImages();
```

**Çıktı Örneği:**

```
🖼️  Tüm entity görselleri güncelleniyor (mapping'de belirtilenler)...

📦 Product görselleri güncelleniyor...
  ✅ 2 product görseli güncellendi

📁 MainCategory görselleri güncelleniyor...
  ✅ 1 mainCategory görseli güncellendi

🏢 Brand görselleri güncelleniyor...
  ✅ 1 brand görseli güncellendi

✅ Toplam 4 entity görseli güncellendi
```

---

## 📝 Örnekler

### Örnek 1: Yeni Product Ekleme

```typescript
// 1. tests/assets/product/avonkrem.jpg ekle

// 2. upload-seed-media.ts
const manualProductAssets = [
  { type: 'file', path: 'avonkrem.jpg', key: 'product.avonkrem' },
];

// 3. seed.ts
const PRODUCT_IMAGE_MAPPING: Record<string, SeedMediaKey> = {
  'Avon Krem': 'product.avonkrem',
};

// 4. Product oluştur
await ensureProduct({
  name: 'Avon Krem',
  brand: 'Avon',
  description: 'Nemlendirici krem',
  // imageKey otomatik bulunur: 'product.avonkrem'
});
```

### Örnek 2: Mevcut Product Görselini Değiştirme

```typescript
// 1. tests/assets/product/dyson-v2.png ekle

// 2. upload-seed-media.ts
const manualProductAssets = [
  { type: 'file', path: 'dyson-v2.png', key: 'product.dyson-v2' },
];

// 3. seed.ts
const PRODUCT_IMAGE_MAPPING: Record<string, SeedMediaKey> = {
  'Dyson V15': 'product.dyson-v2', // Eski görseli değiştir
};

// 4. Mevcut product'ları güncelle
await updateProductImages();
```

### Örnek 3: Klasör Bazlı Ekleme

```typescript
// 1. tests/assets/product/kremler/ klasörüne görseller ekle

// 2. upload-seed-media.ts
const manualProductAssets = [
  { type: 'folder', path: 'kremler', key: 'product.kremler' },
];

// 3. seed.ts
const PRODUCT_IMAGE_MAPPING: Record<string, SeedMediaKey> = {
  'Avon Krem': 'product.kremler.avonkrem',
  'Nivea Krem': 'product.kremler.niveakrem',
};

// 4. Product'ları oluştur
await ensureProduct({ name: 'Avon Krem', brand: 'Avon' });
await ensureProduct({ name: 'Nivea Krem', brand: 'Nivea' });
```

### Örnek 4: Brand + Name Kombinasyonu

```typescript
// Aynı isimde farklı brand'lar için
const PRODUCT_IMAGE_MAPPING: Record<string, SeedMediaKey> = {
  'Avon Krem': 'product.avonkrem',
  'Nivea Krem': 'product.niveakrem',
  // Brand + name kombinasyonu
  'Avon Avon Krem': 'product.avonkrem', // Öncelikli
  'Nivea Nivea Krem': 'product.niveakrem', // Öncelikli
};
```

---

## ⚠️ Önemli Notlar

### 1. Key Formatı

- **Manuel key**: `product.avonkrem` (önerilen)
- **Otomatik key**: Dosya adından oluşturulur: `avonkrem.jpg` → `product.avonkrem`

### 2. Mapping Önceliği

`getProductImageKey()` fonksiyonu şu sırayla arar:
1. Product name: `PRODUCT_IMAGE_MAPPING['Avon Krem']`
2. Brand + name: `PRODUCT_IMAGE_MAPPING['Avon Avon Krem']`
3. Sadece brand: `PRODUCT_IMAGE_MAPPING['Avon']`
4. Bulunamazsa: `undefined` (görsel atanmaz)

### 3. Hata Yönetimi

- Görsel bulunamazsa: Uyarı verilir, seed devam eder
- Mapping'de yoksa: Görsel atanmaz (null)
- MinIO'ya yüklenemezse: Uyarı verilir, seed devam eder

### 4. Performans

- `updateProductImages()` sadece mapping'de belirtilen product'ları günceller
- Batch update yapılmaz (her product için ayrı update)
- Çok sayıda product için yavaş olabilir (optimize edilebilir)

---

## 🔗 İlgili Dosyalar

- `scripts/upload-seed-media.ts` - Görsel yükleme scripti
- `prisma/seed.ts` - Seed dosyası (PRODUCT_IMAGE_MAPPING)
- `prisma/seed/seed-media-map.json` - Görsel mapping dosyası (otomatik oluşturulur)
- `tests/assets/product/` - Product görselleri klasörü

---

## 🚀 Hızlı Başlangıç

### Yeni Görsel Ekleme

```bash
# 1. Görseli ekle
# tests/assets/product/avonkrem.jpg

# 2. upload-seed-media.ts'de tanımla
# { type: 'file', path: 'avonkrem.jpg', key: 'product.avonkrem' }

# 3. Yükle
docker-compose exec backend npx ts-node scripts/upload-seed-media.ts

# 4. seed.ts'de mapping ekle
# 'Avon Krem': 'product.avonkrem'

# 5. Product oluştur
# await ensureProduct({ name: 'Avon Krem', brand: 'Avon' })
```

### Mevcut Görseli Değiştirme

```bash
# 1. Yeni görseli ekle ve yükle (yukarıdaki adımlar)

# 2. seed.ts'de mapping güncelle
# 'Dyson V15': 'product.dyson-v2'

# 3. Güncelle
# await updateProductImages()
```

---

## 📞 Destek

Sorularınız için backend ekibi ile iletişime geçebilirsiniz.

**Not:** Bu dokümantasyon, product görsel yönetimi için manuel ekleme/değiştirme işlemlerini kapsar. Otomatik algılama özelliği yoktur - tüm görseller manuel olarak tanımlanmalıdır.

