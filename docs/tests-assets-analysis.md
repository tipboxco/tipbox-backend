# Tests/Assets Klasör Analizi - MinIO Kullanımı

## 📁 Klasör Yapısı ve MinIO Eşleştirmesi

### ✅ MinIO'ya Yüklenen Klasörler

#### 1. **catalog/** → `catalog/` ve `brand-categories/`
**Local:** `tests/assets/catalog/` (13 dosya)
**MinIO:** 
- `catalog/` klasörü (10 dosya yüklendi)
- `brand-categories/` klasörü (10 dosya yüklendi)

**Dosyalar:**
- ✅ `air conditioner.png` → `catalog/air-conditioner.png` ⚠️ (slugify ile dönüştürülüyor)
- ✅ `cameras.png` → `catalog/cameras.png`
- ✅ `computers-tablets.png` → `catalog/computers-tablets.png`
- ✅ `drone.png` → `catalog/drone.png`
- ✅ `games.png` → `catalog/games.png`
- ✅ `headphones.png` → `catalog/headphones.png`
- ⚠️ `home appliances.png` → `catalog/home-appliances.png` (Local'de bulunamadı - slugify uyumsuzluğu)
- ✅ `kucukev.png` → `catalog/kucukev.png`
- ✅ `phones.png` → `catalog/phones.png`
- ✅ `printers.png` → `catalog/printers.png`
- ⚠️ `smart home devices.png` → `catalog/smart-home-devices.png` (Local'de bulunamadı - slugify uyumsuzluğu)
- ✅ `TV.png` → `catalog/tv.png` (slugify ile dönüştürülüyor)
- ✅ `otomotiv.png` → `catalog/otomotiv.png`

**Sorun:** `home appliances.png` ve `smart home devices.png` dosyaları slugify ile `home-appliances` ve `smart-home-devices` olarak aranıyor ama local'de boşluklu isimlerle var.

#### 2. **badge/** → `badges/custom/`
**Local:** `tests/assets/badge/` (4 dosya)
**MinIO:** `badges/custom/` klasörü (4 dosya)

**Dosyalar:**
- ✅ `EarlyAdapter.png` → `badges/custom/EarlyAdapter.png`
- ✅ `HardwareExpert.png` → `badges/custom/HardwareExpert.png`
- ✅ `PremiumShoper.png` → `badges/custom/PremiumShoper.png`
- ✅ `WishMarker.png` → `badges/custom/WishMarker.png`

#### 3. **product/** → `products/` ve `products/phones/`
**Local:** `tests/assets/product/` (28 dosya)
**MinIO:** 
- `products/` klasörü (5 dosya: dyson.png, macbook.png, headphone.png, headphone2.png, samsun.png)
- `products/phones/` klasörü (6 dosya: phone1.png - phone6.png)

**Kullanılan Dosyalar (11 adet):**
- ✅ `phone1.png` → `products/phones/phone1.png`
- ✅ `phone2.png` → `products/phones/phone2.png`
- ✅ `phone3.png` → `products/phones/phone3.png`
- ✅ `phone4.png` → `products/phones/phone4.png`
- ✅ `phone5.png` → `products/phones/phone5.png`
- ✅ `phone6.png` → `products/phones/phone6.png`
- ✅ `dyson.png` → `products/dyson.png`
- ✅ `macbook.png` → `products/macbook.png`
- ✅ `headphone.png` → `products/headphone.png`
- ✅ `headphone2.png` → `products/headphone2.png`
- ✅ `samsun.png` → `products/samsun.png`

**Kullanılmayan Dosyalar (17 adet):**
- ❌ `electronic-post-1.jpg` - `electronic-post-10.jpg` (10 dosya)
- ❌ `makeup-post-1.jpg` - `makeup-post-10.jpg` (10 dosya)
- ❌ `smartwatch.png` (1 dosya)

#### 4. **userprofile/** → `profile-pictures/`, `profile-banners/`, `userprofile/`
**Local:** `tests/assets/userprofile/` (6 dosya)
**MinIO:** 
- `profile-pictures/` klasörü (2 dosya)
- `profile-banners/` klasörü (1 dosya)
- `userprofile/` klasörü (5 dosya)

**Dosyalar:**
- ✅ `banner.png` → `profile-banners/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-banner.png`
- ✅ `ozan.jpg` → `profile-pictures/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-avatar.jpg` (primary)
- ✅ `ozan.jpg` → `profile-pictures/248cc91f-b551-4ecc-a885-db1163571330/seed-avatar.jpg` (market)
- ✅ `useravatar.jpg` → `userprofile/useravatar.jpg`
- ✅ `useravatar2.jpg` → `userprofile/useravatar2.jpg`
- ✅ `useravatar3.jpg` → `userprofile/useravatar3.jpg`
- ✅ `useravatar4.png` → `userprofile/useravatar4.png`
- ✅ `ozan.jpg` → `userprofile/ozan.jpg` (trust5)

#### 5. **event/** → `event/`
**Local:** `tests/assets/event/` (2 dosya)
**MinIO:** `event/` klasörü (2 dosya)

**Dosyalar:**
- ✅ `event.png` → `event/event.png`
- ✅ `eventcardbg.png` → `event/eventcardbg.png`

#### 6. **marketplace/** → `marketplace/`
**Local:** `tests/assets/marketplace/` (1 dosya)
**MinIO:** `marketplace/` klasörü (1 dosya)

**Dosyalar:**
- ✅ `marketplace.jpg` → `marketplace/rainbow-border.jpg`

#### 7. **post/** → `post-media/`
**Local:** `tests/assets/post/` (1 dosya)
**MinIO:** `post-media/` klasörü (1 dosya)

**Dosyalar:**
- ✅ `post.jpg` → `post-media/480f5de9-b691-4d70-a6a8-2789226f4e07/post.jpg`

### ❌ MinIO'ya Yüklenmeyen Klasörler

#### 1. **brandbadge/** (6 dosya)
**Local:** `tests/assets/brandbadge/`
- `brandbadge1.png`
- `brandbadge2.png`
- `brandbadge3.png`
- `brandbadge4.png`
- `brandbadge5.png`
- `brandbadge6.png`

**Durum:** seed-media-map.json'da tanımlı değil, kullanılmıyor
**Potansiyel Kullanım:** Brand badge'leri için `brands/badges/` klasörüne yüklenebilir

#### 2. **Select Brand/** (24 dosya)
**Local:** `tests/assets/Select Brand/`

**Cosmetic/** klasörü (12 dosya):
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

**Electronic/** klasörü (12 dosya):
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

**Durum:** seed-media-map.json'da tanımlı değil, kullanılmıyor
**Potansiyel Kullanım:** Brand catalog görselleri için `brands/catalog/` klasörüne yüklenebilir

#### 3. **Brand Page/** (23+ dosya)
**Local:** `tests/assets/Brand Page/Electronic/`

**Apple/** klasörü (11 dosya):
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

**Brand Banners/** klasörü (12 dosya):
- `brandpage-electronic-apple.jpg`
- `brandpage-electronic-asus.jpg`
- `brandpage-electronic-canon.jpg`
- `brandpage-electronic-dyson.jpg`
- `brandpage-electronic-jbl.jpg`
- `brandpage-electronic-msi.jpg`
- `brandpage-electronic-nvidia.jpg`
- `brandpage-electronic-samsung.jpg`
- `brandpage-electronic-shark.jpg`
- `brandpage-electronic-steelseries.jpg`
- `brandpage-electronic-xiaomi.jpg`
- `marshall.jpg`

**Durum:** seed-media-map.json'da tanımlı değil, kullanılmıyor
**Potansiyel Kullanım:** 
- Product görselleri için `products/` klasörüne
- Brand banner görselleri için `brands/banners/` klasörüne

#### 4. **Brand Catalog/** (2 dosya)
**Local:** `tests/assets/Brand Catalog/Select Category/`
- `brandcatalog-cosmetic.png`
- `brandcatalog-electronic` (dosya değil, klasör)

**Durum:** seed-media-map.json'da tanımlı değil, kullanılmıyor

#### 5. **Tipbox App Test Images/** (Bilinmeyen sayıda dosya)
**Local:** `tests/assets/Tipbox App Test Images/Posts/`
**Durum:** İçeriği bilinmiyor, kullanılmıyor

#### 6. **WhatsNews/** (1 dosya)
**Local:** `tests/assets/WhatsNews/`
- `event.jpg`

**Durum:** seed-media-map.json'da tanımlı değil, kullanılmıyor
**Potansiyel Kullanım:** News/Event görselleri için `news/` veya `event/` klasörüne

## 📊 Özet

### Kullanılan Görseller
- **Toplam:** ~65 görsel (seed-media-map.json'da tanımlı)
- **Klasörler:** 7 klasör (catalog, badge, product, userprofile, event, marketplace, post)
- **MinIO'da:** 14 klasör, ~120 dosya

### Kullanılmayan Görseller
- **brandbadge/:** 6 dosya
- **Select Brand/:** 24 dosya
- **Brand Page/:** 23+ dosya
- **product/:** 20 dosya (post görselleri)
- **product/:** 1 dosya (smartwatch.png)
- **Brand Catalog/:** 2 dosya
- **WhatsNews/:** 1 dosya
- **Tipbox App Test Images/:** Bilinmeyen sayıda

**Toplam Kullanılmayan:** ~77+ dosya

## 🔧 Öneriler

### 1. Dosya İsim Uyumsuzluklarını Düzelt
- `home appliances.png` → `home-appliances.png` olarak yeniden adlandır
- `smart home devices.png` → `smart-home-devices.png` olarak yeniden adlandır
- VEYA `buildAssetMapping()` fonksiyonunu dosya isimlerini doğru eşleştirecek şekilde güncelle

### 2. Kullanılmayan Görselleri Seed'e Ekle
- Brand catalog görsellerini seed-media-map.json'a ekle
- Brand badge görsellerini seed-media-map.json'a ekle
- Post görsellerini (electronic-post, makeup-post) seed-media-map.json'a ekle
- Brand page görsellerini seed-media-map.json'a ekle

### 3. DB Path Formatını Düzelt
- DB'de path'ler `tipbox-media/` ile başlıyor
- `buildMediaUrl` bunu kaldırıp tekrar ekliyor (doğru çalışıyor)
- Ancak hata mesajında `/tipbox-media/tipbox-media/` görünüyor
- Bu, başka bir yerde path'e tekrar `tipbox-media/` ekleniyor olabilir


