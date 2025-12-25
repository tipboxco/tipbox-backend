# Tests/Assets Klasör Analizi ve MinIO Kullanımı

## 📁 Mevcut Klasör Yapısı

### ✅ MinIO'ya Yüklenen Klasörler (seed-media-map.json'da tanımlı)

#### 1. **catalog/** (13 dosya)
- `air conditioner.png` → `catalog/air-conditioner.png`
- `cameras.png` → `catalog/cameras.png`
- `computers-tablets.png` → `catalog/computers-tablets.png`
- `drone.png` → `catalog/drone.png`
- `games.png` → `catalog/games.png`
- `headphones.png` → `catalog/headphones.png`
- `home appliances.png` → `catalog/home-appliances.png` ⚠️ (Local'de farklı isim)
- `kucukev.png` → `catalog/kucukev.png`
- `phones.png` → `catalog/phones.png`
- `printers.png` → `catalog/printers.png`
- `smart home devices.png` → `catalog/smart-home-devices.png` ⚠️ (Local'de farklı isim)
- `TV.png` → `catalog/tv.png`
- `otomotiv.png` → `catalog/otomotiv.png`

**MinIO Hedef:** `catalog/` ve `brand-categories/` klasörleri

#### 2. **badge/** (4 dosya)
- `EarlyAdapter.png` → `badges/custom/EarlyAdapter.png`
- `HardwareExpert.png` → `badges/custom/HardwareExpert.png`
- `PremiumShoper.png` → `badges/custom/PremiumShoper.png`
- `WishMarker.png` → `badges/custom/WishMarker.png`

**MinIO Hedef:** `badges/custom/` klasörü

#### 3. **product/** (18 dosya)
**Kullanılan:**
- `phone1.png` → `products/phones/phone1.png`
- `phone2.png` → `products/phones/phone2.png`
- `phone3.png` → `products/phones/phone3.png`
- `phone4.png` → `products/phones/phone4.png`
- `phone5.png` → `products/phones/phone5.png`
- `phone6.png` → `products/phones/phone6.png`
- `dyson.png` → `products/dyson.png`
- `macbook.png` → `products/macbook.png`
- `headphone.png` → `products/headphone.png`
- `headphone2.png` → `products/headphone2.png`
- `samsun.png` → `products/samsun.png`

**Kullanılmayan:**
- `electronic-post-1.jpg` - `electronic-post-10.jpg` (10 dosya) - Post görselleri için kullanılabilir
- `makeup-post-1.jpg` - `makeup-post-10.jpg` (10 dosya) - Post görselleri için kullanılabilir
- `smartwatch.png` - Kullanılmıyor

**MinIO Hedef:** `products/` ve `products/phones/` klasörleri

#### 4. **userprofile/** (6 dosya)
- `banner.png` → `profile-banners/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-banner.png`
- `ozan.jpg` → `profile-pictures/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-avatar.jpg`
- `useravatar.jpg` → `userprofile/useravatar.jpg`
- `useravatar2.jpg` → `userprofile/useravatar2.jpg`
- `useravatar3.jpg` → `userprofile/useravatar3.jpg`
- `useravatar4.png` → `userprofile/useravatar4.png`

**MinIO Hedef:** `profile-pictures/`, `profile-banners/`, `userprofile/` klasörleri

#### 5. **event/** (2 dosya)
- `event.png` → `event/event.png`
- `eventcardbg.png` → `event/eventcardbg.png`

**MinIO Hedef:** `event/` klasörü

#### 6. **marketplace/** (1 dosya)
- `marketplace.jpg` → `marketplace/rainbow-border.jpg`

**MinIO Hedef:** `marketplace/` klasörü

#### 7. **post/** (1 dosya)
- `post.jpg` → `post-media/480f5de9-b691-4d70-a6a8-2789226f4e07/post.jpg`

**MinIO Hedef:** `post-media/` klasörü

### ❌ MinIO'ya Yüklenmeyen Klasörler

#### 1. **brandbadge/** (6 dosya)
- `brandbadge1.png` - `brandbadge6.png`
- **Durum:** Kullanılmıyor, seed-media-map.json'da tanımlı değil
- **Potansiyel Kullanım:** Brand badge'leri için

#### 2. **Brand Catalog/** (Klasör yapısı)
- `Select Category/brandcatalog-cosmetic.png`
- `Select Category/brandcatalog-electronic` (dosya değil, klasör)
- **Durum:** Kullanılmıyor
- **Potansiyel Kullanım:** Brand catalog görselleri için

#### 3. **Select Brand/** (24 dosya)
- `Cosmetic/` klasörü (12 dosya):
  - `brandcatalog-cosmetic-bioderma.png`
  - `brandcatalog-cosmetic-chanel.png`
  - `brandcatalog-cosmetic-dior.png`
  - `brandcatalog-cosmetic-esteelauder.png`
  - `brandcatalog-cosmetic-farmasi.png`
  - `brandcatalog-cosmetic-flormar.png`
  - `brandcatalog-cosmetic-lorealparis.png`
  - `brandcatalog-cosmetic-mac.png`
  - `brandcatalog-cosmetic-maybelline.png`
  - `brandcatalog-cosmetic-nars.png`
  - `brandcatalog-cosmetic-neutrogena.png`
  - `brandcatalog-cosmetic-sephora.png`

- `Electronic/` klasörü (12 dosya):
  - `brandcatalog-electronic-apple.png`
  - `brandcatalog-electronic-asus.png`
  - `brandcatalog-electronic-canon.png`
  - `brandcatalog-electronic-dyson.png`
  - `brandcatalog-electronic-jbl.png`
  - `brandcatalog-electronic-marshall.png`
  - `brandcatalog-electronic-msi.png`
  - `brandcatalog-electronic-nvidia.png`
  - `brandcatalog-electronic-samsung.png`
  - `brandcatalog-electronic-shark.png`
  - `brandcatalog-electronic-steelseries.png`
  - `brandcatalog-electronic-xiaomi.png`

**Durum:** Kullanılmıyor, seed-media-map.json'da tanımlı değil
**Potansiyel Kullanım:** Brand catalog görselleri için

#### 4. **Brand Page/** (Klasör yapısı)
- `Electronic/Apple/` klasörü (11 dosya):
  - `apple-product-airpods4.png`
  - `apple-product-airpods4ANC.png`
  - `apple-product-airpodsmax.png`
  - `apple-product-airpodspro3.png`
  - `apple-product-iphone16e.png`
  - `apple-product-iphone17.png`
  - `apple-product-iphone17pro.png`
  - `apple-product-iphoneair.png`
  - `apple-product-watchse3.png`
  - `apple-product-watchseries11.png`
  - `apple-product-watchultra3.png`
- `Electronic/Brand Banners/` klasörü (12 dosya - *.jpg)
- **Durum:** Kullanılmıyor
- **Potansiyel Kullanım:** Brand sayfa görselleri ve product görselleri için

#### 5. **Tipbox App Test Images/** (Klasör yapısı)
- `Posts/` klasörü (muhtemelen post görselleri)
- **Durum:** Kullanılmıyor
- **Potansiyel Kullanım:** Post görselleri için

#### 6. **WhatsNews/** (1 dosya)
- `event.jpg`
- **Durum:** Kullanılmıyor
- **Potansiyel Kullanım:** News/Event görselleri için

## 📊 Özet İstatistikler

### Kullanılan Görseller
- **Toplam:** ~65 görsel (seed-media-map.json'da tanımlı)
- **Klasörler:** 7 klasör (catalog, badge, product, userprofile, event, marketplace, post)

### Kullanılmayan Görseller
- **brandbadge/:** 6 dosya
- **Select Brand/:** 24 dosya
- **Brand Page/:** 23+ dosya (11 Apple product + 12 brand banner)
- **product/:** 20 dosya (electronic-post ve makeup-post görselleri)
- **product/:** 1 dosya (smartwatch.png)
- **Tipbox App Test Images/:** Bilinmeyen sayıda dosya
- **WhatsNews/:** 1 dosya

**Toplam Kullanılmayan:** ~75+ dosya

## 🔍 Sorunlar ve Öneriler

### 1. Dosya İsim Uyumsuzlukları
- **catalog/** klasöründe:
  - `air conditioner.png` (boşluklu) → `catalog/air-conditioner.png` (tire ile) ⚠️
  - `home appliances.png` (boşluklu) → `catalog/home-appliances.png` (tire ile) ⚠️
  - `smart home devices.png` (boşluklu) → `catalog/smart-home-devices.png` (tire ile) ⚠️

**Çözüm:** `buildAssetMapping()` fonksiyonu slugify kullanıyor ama dosya isimleri boşluklu. Bu yüzden bazı görseller bulunamıyor.

### 2. Kullanılmayan Görseller
- Brand catalog görselleri (Select Brand klasörü) kullanılmıyor
- Brand badge görselleri kullanılmıyor
- Post görselleri (electronic-post, makeup-post) kullanılmıyor
- Brand page görselleri kullanılmıyor

**Öneri:** Bu görselleri seed-media-map.json'a ekleyip MinIO'ya yükleyebiliriz.

### 3. DB'deki Path Formatı
- DB'de path'ler `tipbox-media/profile-pictures/...` şeklinde tutuluyor
- `buildMediaUrl` fonksiyonu tekrar `tipbox-media/` ekliyor
- Sonuç: `/tipbox-media/tipbox-media/...` (çift prefix)

**Çözüm:** `buildMediaUrl` zaten `tipbox-media/` prefix'ini kaldırıyor ama DB'deki path'ler tam URL formatında olabilir. `resolveMediaUrl` kontrol edilmeli.

## 📝 Önerilen MinIO Klasör Yapısı

```
tipbox-media/
├── badges/custom/          ✅ (4 dosya)
├── brand-categories/       ✅ (10 dosya)
├── brands/catalog/         ✅ (71 dosya - brand marketplace görselleri)
├── catalog/                ✅ (10 dosya)
├── event/                  ✅ (2 dosya)
├── inventory/              ✅ (1 dosya)
├── marketplace/            ✅ (1 dosya)
├── post-media/             ✅ (1 dosya)
├── posts/                  ✅ (5 dosya)
├── products/               ✅ (11 dosya)
│   └── phones/             ✅ (6 dosya)
├── profile-banners/         ✅ (1 dosya)
├── profile-pictures/        ✅ (2 dosya)
├── userprofile/            ✅ (5 dosya)
└── users/                  ✅ (2 dosya)
```

**Toplam:** 14 klasör, ~120 dosya


