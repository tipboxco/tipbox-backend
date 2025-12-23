# MinIO ve Seed Entegrasyonu - Detaylı Dokümantasyon

Bu dokümantasyon, MinIO görsel yönetimi ile seed mekanizmasının nasıl entegre edildiğini ve deploy sürecinde nasıl çalıştığını açıklar.

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Seed Komutları ve MinIO İlişkisi](#seed-komutları-ve-minio-ilişkisi)
3. [Deploy Süreci](#deploy-süreci)
4. [MinIO Klasör Yapısı](#minio-klasör-yapısı)
5. [Temizleme Mekanizması](#temizleme-mekanizması)
6. [Örnek Senaryolar](#örnek-senaryolar)

---

## 🎯 Genel Bakış

### Seed ve MinIO İlişkisi

```
Seed Komutu
  ↓
MinIO Temizleme (YENİ)
  ↓
DB Temizleme
  ↓
Seed Çalıştırma
  ├─ ensureSeedMediaUploaded() → Görseller MinIO'ya yüklenir
  └─ Veriler database'e eklenir
```

### Temel Prensipler

1. **MinIO temizleme DB temizlemeden ÖNCE yapılır**
2. **Taxonomy görselleri korunur** (`db:seed` komutunda)
3. **Tüm görseller temizlenir** (`db:seed:all` komutunda)
4. **Seed sırasında görseller otomatik yüklenir**

---

## 🔄 Seed Komutları ve MinIO İlişkisi

### `npm run db:seed` (Taxonomy Korunur)

**Komut:**
```bash
npm run db:seed
# VEYA
docker-compose exec backend npx ts-node scripts/clear-and-seed.ts
```

**Akış:**

```
1. MinIO Temizleme
   └─ clearUserContentMedia()
      ├─ users/ → Silinir
      ├─ posts/ → Silinir
      ├─ post-media/ → Silinir
      ├─ inventory/ → Silinir
      ├─ news/ → Silinir
      ├─ profile-pictures/ → Silinir
      └─ profile-banners/ → Silinir
      ✅ KORUNAN: catalog/, brand-categories/, badges/, products/, brands/, event/

2. DB Temizleme
   └─ clear-user-content-data.ts
      ├─ User verileri → Silinir
      ├─ Content verileri → Silinir
      └─ ✅ KORUNAN: Taxonomy (categories, brands, badges, products)

3. Seed Çalıştırma
   └─ seed.ts
      ├─ ensureSeedMediaUploaded() → Tüm görseller MinIO'ya yüklenir
      └─ Veriler database'e eklenir
```

**Sonuç:**
- ✅ Taxonomy görselleri MinIO'da korunur
- ✅ Taxonomy verileri DB'de korunur
- ✅ User/content görselleri MinIO'da temizlenir
- ✅ User/content verileri DB'de temizlenir
- ✅ Yeni seed görselleri ve verileri eklenir

---

### `npm run db:seed:all` (Taxonomy Korunmaz)

**Komut:**
```bash
npm run db:seed:all
# VEYA
docker-compose exec backend npx ts-node scripts/clear-and-seed.ts --all
```

**Akış:**

```
1. MinIO Temizleme
   └─ clearAllMedia()
      └─ Tüm bucket içeriği silinir (taxonomy dahil)

2. DB Temizleme
   └─ clear-seed-data.ts --force
      └─ Tüm veriler silinir (taxonomy dahil)

3. Seed Çalıştırma
   └─ seed.ts
      ├─ ensureSeedMediaUploaded() → Tüm görseller MinIO'ya yüklenir
      └─ Veriler database'e eklenir
```

**Sonuç:**
- ❌ Tüm görseller MinIO'da temizlenir
- ❌ Tüm veriler DB'de temizlenir
- ✅ Yeni seed görselleri ve verileri eklenir

---

## 🚀 Deploy Süreci

### GitHub Actions Workflow

**Deploy sırasında çalışan komutlar:**

```yaml
# .github/workflows/deploy-test.yml

1. Infrastructure Başlatma
   └─ docker compose up -d postgres redis minio

2. Seed Kontrolü ve Çalıştırma
   └─ docker compose run --rm backend npm run seed:all
      ↓
      scripts/clear-and-seed.ts --all
      ↓
      ├─ clearAllMedia() → MinIO temizlenir
      ├─ clear-seed-data.ts --force → DB temizlenir
      └─ seed.ts → Görseller + veriler eklenir
```

### Deploy Akışı (Detaylı)

```
1. Prepare
   └─ Kodu pull et, env dosyasını kontrol et

2. Backup
   └─ Database backup al

3. Stop
   └─ Mevcut servisleri durdur

4. Build
   └─ Docker image'larını build et

5. Prisma
   └─ Prisma Client generate et

6. Infrastructure
   └─ postgres, redis, minio başlat
      ↓
      MinIO container başlar
      Bucket hazır olur (veya oluşturulur)

7. Wait-DB
   └─ Database'in hazır olmasını bekle

8. Migrate
   └─ Prisma migration'ları çalıştır

9. Seed (Akıllı Kontrol)
   └─ HAS_DATA kontrolü
      ├─ Veri yoksa → Seed çalıştır
      │  ├─ clearAllMedia() → MinIO temizlenir
      │  ├─ clear-seed-data.ts → DB temizlenir
      │  └─ seed.ts → Görseller + veriler eklenir
      └─ Veri varsa → Seed atlanır

10. Start
    └─ Tüm servisleri başlat

11. Health
    └─ Backend health check

12. Cleanup
    └─ Eski image'ları temizle
```

---

## 📁 MinIO Klasör Yapısı

### Taxonomy Görselleri (Korunan - `db:seed`)

```
tipbox-media/
├── catalog/                    # Kategori görselleri
│   ├── phones.png
│   ├── computers-tablets.png
│   └── ...
├── brand-categories/           # Brand kategori görselleri
│   ├── cameras.png
│   └── ...
├── badges/custom/              # Badge görselleri
│   ├── EarlyAdapter.png
│   └── ...
├── products/                   # Ürün görselleri (sabit)
│   ├── phones/
│   │   ├── phone1.png
│   │   └── ...
│   ├── dyson.png
│   └── ...
├── brands/catalog/             # Brand görselleri
│   └── {brandId}/
│       └── marketplace.jpg
└── event/                      # Event görselleri
    ├── event.png
    └── eventcardbg.png
```

### User/Content Görselleri (Temizlenen - `db:seed`)

```
tipbox-media/
├── users/                      # User avatarları, bannerlar
│   └── {userId}/
│       ├── avatar.jpg
│       └── banner.png
├── posts/                      # Post görselleri
│   └── {postId}/
├── post-media/                 # Post media klasörü
│   └── {userId}/
│       └── post.jpg
├── inventory/                  # Inventory görselleri
│   └── ...
├── news/                       # News görselleri
│   └── {brand}/{product}/
├── profile-pictures/           # Profile pictures (user bazlı)
│   └── {userId}/
└── profile-banners/            # Profile banners (user bazlı)
    └── {userId}/
```

---

## 🧹 Temizleme Mekanizması

### clearUserContentMedia()

**Fonksiyon:** `prisma/seed/helpers/clear-minio-media.ts`

**Temizlenen klasörler:**
- `users/`
- `posts/`
- `post-media/`
- `inventory/`
- `news/`
- `profile-pictures/`
- `profile-banners/`

**Korunan klasörler:**
- `catalog/`
- `brand-categories/`
- `badges/custom/`
- `products/`
- `brands/catalog/`
- `event/`

**Kullanım:**
```typescript
await clearUserContentMedia();
```

**Çıktı:**
```
🧹 MinIO user/content görselleri temizleniyor (taxonomy korunuyor)...
  ✅ users/: 15 dosya silindi
  ✅ posts/: 42 dosya silindi
  ✅ inventory/: 8 dosya silindi
✅ Toplam 65 user/content görseli temizlendi
✅ Taxonomy görselleri korundu
```

---

### clearAllMedia()

**Fonksiyon:** `prisma/seed/helpers/clear-minio-media.ts`

**Temizlenen:**
- Tüm bucket içeriği (taxonomy dahil)

**Kullanım:**
```typescript
await clearAllMedia();
```

**Çıktı:**
```
🧹 MinIO TÜM görselleri temizleniyor (taxonomy dahil)...
✅ Toplam 150 görsel silindi (tüm bucket temizlendi)
```

---

## 📝 Örnek Senaryolar

### Senaryo 1: Development - Taxonomy Korunur

```bash
# Local development'ta
npm run db:seed
```

**Ne olur:**
1. MinIO'da sadece user/content görselleri temizlenir
2. DB'de sadece user/content verileri temizlenir
3. Taxonomy görselleri ve verileri korunur
4. Yeni seed görselleri ve verileri eklenir

**Kullanım:**
- Günlük development
- Test verilerini yenileme (taxonomy korunarak)

---

### Senaryo 2: Development - Tam Temizlik

```bash
# Local development'ta
npm run db:seed:all
```

**Ne olur:**
1. MinIO'da TÜM görseller temizlenir
2. DB'de TÜM veriler temizlenir
3. Yeni seed görselleri ve verileri eklenir

**Kullanım:**
- İlk kurulum
- Taxonomy değişiklikleri test etme
- Tam reset

---

### Senaryo 3: Production/Test Deploy

```bash
# GitHub Actions içinde
docker compose run --rm backend npm run seed:all
```

**Ne olur:**
1. Akıllı kontrol: DB'de veri var mı?
   - **Veri yoksa:**
     - MinIO temizlenir
     - DB temizlenir
     - Seed çalıştırılır
   - **Veri varsa:**
     - Seed atlanır (MinIO ve DB korunur)

**Kullanım:**
- İlk production deploy
- Test environment setup

---

## 🔧 Teknik Detaylar

### S3Service Delete Metodları

**Yeni eklenen metodlar:**

```typescript
// src/infrastructure/s3/s3.service.ts

/**
 * Klasördeki tüm dosyaları recursive olarak sil
 */
async deleteFolder(folderPrefix: string): Promise<number>

/**
 * Tüm bucket içeriğini temizle
 */
async clearBucket(): Promise<number>
```

**Kullanım:**
- Batch delete (1000 dosya/batch)
- Recursive klasör silme
- Hata yönetimi ve logging

### clear-and-seed.ts Entegrasyonu

**Yeni akış:**

```typescript
// scripts/clear-and-seed.ts

1. MinIO Temizleme (DB'den ÖNCE)
   ├─ clearAll → clearAllMedia()
   └─ clearUserContent → clearUserContentMedia()

2. DB Temizleme
   ├─ clearAll → clear-seed-data.ts --force
   └─ clearUserContent → clear-user-content-data.ts

3. Seed Çalıştırma
   └─ seed.ts (ensureSeedMediaUploaded() otomatik)
```

---

## ⚠️ Önemli Notlar

### 1. MinIO Bağlantısı

**Container içinde:**
- `S3_ENDPOINT=http://minio:9000` (docker network)
- Container'lar aynı network'te (`tipbox_network`)

**Container dışında (local):**
- `S3_ENDPOINT=http://localhost:9000`
- MinIO port mapping: `9000:9000`

### 2. Bucket Persistence

```yaml
# docker-compose.yml
minio:
  volumes:
    - minio_data:/data  # ← MinIO verileri kalıcı
```

- MinIO verileri Docker volume'da saklanır
- Container yeniden başlatılsa bile veriler korunur
- Sadece `clearAllMedia()` veya `clearUserContentMedia()` çağrıldığında temizlenir

### 3. Seed Akıllı Kontrol

```bash
# Deploy sırasında
HAS_DATA=$(SELECT COUNT(*) FROM users WHERE email LIKE '%@tipbox.%')
if [ "$HAS_DATA" = "0" ]; then
  # Seed çalıştır (MinIO temizleme dahil)
else
  # Seed atla (MinIO ve DB korunur)
fi
```

- İlk deploy'da seed çalışır (MinIO temizlenir)
- Sonraki deploy'larda atlanır (MinIO ve DB korunur)

### 4. Hata Yönetimi

- MinIO temizleme hatası olsa bile seed devam eder
- Sadece warning verilir
- Seed görselleri yine de yüklenir (overwrite)

---

## 🚀 Hızlı Başlangıç

### Development

```bash
# Taxonomy korunur
npm run db:seed

# Tam temizlik
npm run db:seed:all
```

### Production/Test Deploy

```bash
# GitHub Actions otomatik çalıştırır
docker compose run --rm backend npm run seed:all
```

---

## 🔗 İlgili Dosyalar

- `scripts/clear-and-seed.ts` - Ana seed scripti (MinIO temizleme entegre)
- `prisma/seed/helpers/clear-minio-media.ts` - MinIO temizleme fonksiyonları
- `prisma/seed.ts` - Seed dosyası (ensureSeedMediaUploaded() otomatik)
- `src/infrastructure/s3/s3.service.ts` - S3Service (delete metodları)
- `.github/actions/execute-remote-stage/action.yml` - Deploy action

---

## 📞 Destek

Sorularınız için backend ekibi ile iletişime geçebilirsiniz.

**Not:** Bu dokümantasyon, MinIO ve seed entegrasyonunun tüm yönlerini kapsar. Deploy sürecinde MinIO temizleme otomatik olarak yapılır.

