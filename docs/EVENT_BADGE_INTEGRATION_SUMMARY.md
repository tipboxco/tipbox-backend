# Event Badge Sistemi - Entegrasyon Özeti

## 📋 Yapılan Değişiklikler

### 1. Yeni Helper Fonksiyonlar Oluşturuldu

#### `prisma/seed/helpers/ensure-event-badge-system.ts`
Event badge sisteminin tam entegrasyonunu sağlar:
- Event badge kategorisi oluşturur
- Event badge görsellerini MinIO'ya yükler (`tests/assets/event_badges/`)
- 5 Event badge oluşturur (görselleriyle birlikte)
- Test event oluşturur
- `EventBadge` join table kayıtlarını oluşturur

**Badge Listesi:**
1. `[Event] İlk Adım` - COMMON (1 post)
2. `[Event] İlk Beğeni` - COMMON (1 like)
3. `[Event] Aktif Katılımcı` - RARE (3 post)
4. `[Event] Popüler` - RARE (3 likes)
5. `[Event] İçerik Ustası` - EPIC (5 posts)

#### `prisma/seed/helpers/ensure-marketplace-badges.ts`
Marketplace badge'lerini oluşturur:
- 4 Badge kategorisi oluşturur (Early Adopter, Achievement, Trust, Brand)
- Marketplace badge görsellerini MinIO'ya yükler (`tests/assets/Badges _ Marketplace/`)
- 10 Marketplace badge oluşturur
- Görselleri döngüsel olarak atar

**Badge Kategorileri:**
- Early Adopter Badges (2 adet)
- Achievement Badges (4 adet)
- Trust Badges (2 adet)
- Brand Badges (2 adet)

### 2. Görsel Upload Script'i

#### `scripts/upload-all-badge-images.ts`
Tüm badge görsellerini MinIO'ya yükler:
- Event badge görselleri → `badges/event/`
- Marketplace badge görselleri → `badges/marketplace/`
- İdempotent (zaten varsa atlar)
- Hata yönetimi ile güvenli

### 3. Ana Seed Entegrasyonu

#### `prisma/seed.ts`
```typescript
import { ensureEventBadgeSystem } from './seed/helpers/ensure-event-badge-system'
import { ensureMarketplaceBadges } from './seed/helpers/ensure-marketplace-badges'

// ...

// Event & Marketplace badges seeding
await ensureEventBadgeSystem(prisma)
await ensureMarketplaceBadges(prisma)
```

### 4. Clear-and-Seed Güncellemesi

#### `scripts/clear-and-seed.ts`
Badge görsel upload adımı eklendi:
```typescript
// ADIM 3.1: Event Badge ve Marketplace Badge görselleri yükle
const uploadBadgeImagesPath = path.join(process.cwd(), 'scripts', 'upload-all-badge-images.ts');
execSync(`npx ts-node ${uploadBadgeImagesPath}`, { stdio: 'inherit' });
```

### 5. Silinen/Değiştirilen Dosyalar

**Silinen:**
- `scripts/seed-badges-and-event.ts` → `ensure-event-badge-system.ts` ile değiştirildi
- `scripts/upload-badge-images.ts` → `upload-all-badge-images.ts` ile değiştirildi
- `prisma/seed/helpers/ensure-event-badges.ts` → Yeni sistem
- `prisma/seed/helpers/ensure-test-event.ts` → Yeni sistem

## 🎯 Sistem Mimarisi

### EventBadge Join Table
```prisma
model EventBadge {
  id               String      @id @default(uuid())
  eventId          String      // Hangi event
  badgeId          String      // Hangi badge
  requirementType  String      // POSTS_COUNT, LIKES_RECEIVED
  threshold        Int         // Hedef sayı
  displayOrder     Int?        // Sıralama
  enabled          Boolean     @default(true)
  
  event            WishboxEvent @relation
  badge            Badge        @relation
  
  @@unique([eventId, badgeId])
}
```

### İlişkiler
```
WishboxEvent (1) ←→ (N) EventBadge (N) ←→ (1) Badge
```

Her event'in kendi badge'leri ve farklı threshold'ları olabilir!

## 📤 MinIO Klasör Yapısı

```
tipbox-media/
├── badges/
│   ├── event/              # Event badge görselleri
│   │   ├── 1.png
│   │   ├── 2.png
│   │   ├── 3.png
│   │   ├── 4.png
│   │   └── 5.png
│   └── marketplace/        # Marketplace badge görselleri
│       ├── badge-1.png
│       ├── badge-2.png
│       └── ... (10 adet)
```

## 🚀 Kullanım

### Seed Çalıştırma

```bash
# Tam reset ve seed (taxonomy dahil tüm veriler)
npx ts-node scripts/clear-and-seed.ts --all

# Partial seed (taxonomy korunur, user/content temizlenir)
npx ts-node scripts/clear-and-seed.ts

# Sadece badge görselleri upload
npx ts-node scripts/upload-all-badge-images.ts
```

### Seed Sırası

1. **Schema Validation** → Prisma schema geçerli mi?
2. **Migration Check** → Migration'lar uygulanmış mı?
3. **Database Sync** → DB schema ile Prisma schema senkronize mi?
4. **MinIO Clear** → Eski görseller temizlenir
5. **Database Clear** → User/content verileri temizlenir
6. **Media Upload** → User avatarlar, banner'lar yüklenir
7. **Badge Images Upload** → Event & Marketplace badge görselleri yüklenir
8. **Seed.ts** → Ana seed çalışır
   - Taxonomy
   - Product Catalog
   - Users
   - **Event Badge System** ✨
   - **Marketplace Badges** ✨
   - Content
   - Posts
   - ...
9. **Feed Distribution** → Post'lar için feed kayıtları oluşturulur

## 📊 Test Event Bilgileri

- **Event ID:** `00MKFPNIQ30000064YDGL62K7Q`
- **Başlık:** Test Event 2026
- **Tarih:** 2025-12-31 → 2026-01-30
- **Durum:** PUBLISHED
- **Badge Sayısı:** 5 adet

## 🔧 App Tarafı Değişiklikleri

### Gerekli Güncellemeler

1. **Event Badge Listesi Endpoint'i:**
   ```
   GET /events/{eventId}/badges
   ```
   Bu endpoint zaten vardı, şimdi `EventBadge` table'ından veri çekiyor.

2. **Badge Progress Calculation:**
   `EventService.getEventBadgesWithProgress()` artık event-specific threshold'ları kullanıyor.

3. **Badge Görselleri:**
   - Event badge'ler: `badges/event/1.png`
   - Marketplace badge'ler: `badges/marketplace/badge-1.png`
   - MinIO URL: `http://minio-url/tipbox-media/{imageUrl}`

## ✅ Tamamlanan Görevler

- [x] `EventBadge` join table oluşturuldu
- [x] Migration hazırlandı
- [x] Entity/DTO'lar oluşturuldu
- [x] Service güncellemeleri yapıldı
- [x] Event badge görselleri yüklendi
- [x] Marketplace badge görselleri yüklendi
- [x] Seed helper fonksiyonları oluşturuldu
- [x] Ana seed'e entegre edildi
- [x] `clear-and-seed.ts` güncellendi
- [x] Test verileri oluşturuldu

## 🎯 Sonuç

Artık sistemde:
- ✅ Her event'in kendi badge'leri olabilir
- ✅ Aynı badge farklı event'lerde farklı threshold'larla kullanılabilir
- ✅ Tüm badge'lerin görselleri var
- ✅ Seed sistemi tamamen otomatik
- ✅ App tarafı mevcut endpoint'leri kullanmaya devam edebilir

---

**Not:** Database temizlenmişti, bu normal! Seed çalıştıktan sonra tüm veriler geri gelecek.
