# Eksik Endpoint'ler - Mobil Entegrasyon Özeti

**Tarih:** 2025-01-XX  
**Durum:** Backend'de eksik endpoint'ler tespit edildi

Bu dokümantasyon, `docs/YENI_EKLENEN_ENDPOINTLER.md` dosyasında belirtilen endpoint'lerin backend'deki mevcut durumunu özetler.

---

## 📊 Endpoint Durum Özeti

| # | Endpoint | Method | Durum | Öncelik | Notlar |
|---|----------|--------|-------|---------|--------|
| 1 | `/products/{productId}` | GET | ❌ **EKSİK** | Yüksek | Product detay endpoint'i yok |
| 2 | `/products/{productId}/posts` | GET | ❌ **EKSİK** | Yüksek | Product post'ları endpoint'i yok |
| 3 | `/products/{productId}/news` | GET | ❌ **EKSİK** | Orta | Product news endpoint'i yok (sadece `/brands/{brandId}/products/{productId}/news` var) |
| 4 | `/news/{newsId}` | GET | ❌ **EKSİK** | Orta | News router ve endpoint'i yok |
| 5 | `/brands/{brandId}/history` | GET | ✅ **MEVCUT** | Orta | `src/interfaces/brand/brand.router.ts:828` |
| 6 | `/brands/{brandId}/stats` | GET | ❌ **EKSİK** | Düşük | Brand stats endpoint'i yok |
| 7 | `/events/{eventId}/join` | POST | ❌ **EKSİK** | Yüksek | Event join endpoint'i yok |
| 8 | `/events/{eventId}/requirements` | GET | ❌ **EKSİK** | Orta | Event requirements endpoint'i yok |

### İstatistikler
- **Toplam Endpoint:** 8
- **Mevcut:** 1 (12.5%)
- **Eksik:** 7 (87.5%)
- **Yüksek Öncelik Eksik:** 3
- **Orta Öncelik Eksik:** 3
- **Düşük Öncelik Eksik:** 1

---

## ❌ Eksik Endpoint'ler Detayları

### 1. GET /products/{productId}
**Durum:** ❌ EKSİK  
**Öncelik:** Yüksek  
**Lokasyon:** `src/interfaces/catalog/catalog.router.ts` (eklenmeli)

**Açıklama:**
- Product detay bilgilerini döndüren endpoint mevcut değil
- Catalog router'da sadece product listesi endpoint'leri var
- Product repository mevcut (`src/infrastructure/repositories/product-prisma.repository.ts`)

**Gerekli İşlemler:**
- Catalog router'a yeni endpoint eklenmeli
- Catalog service'e `getProductById` metodu eklenmeli
- Response formatı dokümantasyona uygun olmalı

---

### 2. GET /products/{productId}/posts
**Durum:** ❌ EKSİK  
**Öncelik:** Yüksek  
**Lokasyon:** Yeni router veya catalog router'a eklenmeli

**Açıklama:**
- Product'a ait post'ları döndüren endpoint mevcut değil
- Benzer endpoint'ler var: `/brands/{brandId}/feed`, `/events/{eventId}/posts`
- Post service mevcut ve product'a göre filtreleme yapılabilir

**Gerekli İşlemler:**
- Product posts için yeni endpoint eklenmeli
- Post service'e product'a göre filtreleme metodu eklenmeli
- Response formatı BrandFeedPost formatına uygun olmalı

---

### 3. GET /products/{productId}/news
**Durum:** ❌ EKSİK  
**Öncelik:** Orta  
**Not:** Benzer endpoint mevcut: `/brands/{brandId}/products/{productId}/news`

**Açıklama:**
- Product'a ait haberleri döndüren direkt endpoint yok
- Benzer endpoint var: `GET /brands/{brandId}/products/{productId}/news` (`src/interfaces/brand/brand.router.ts:1433`)
- Bu endpoint brand ve product ID'si gerektiriyor, sadece product ID ile çalışan bir endpoint yok

**Gerekli İşlemler:**
- Product news için yeni endpoint eklenmeli
- Brand service'teki `getBrandProductNews` metodunu kullanabilir veya yeni bir metod oluşturulabilir
- Cursor-based pagination kullanılmalı (mevcut endpoint page-based)

---

### 4. GET /news/{newsId}
**Durum:** ❌ EKSİK  
**Öncelik:** Orta  
**Lokasyon:** Yeni news router oluşturulmalı

**Açıklama:**
- News router mevcut değil (`src/interfaces/` altında `news.router.ts` yok)
- News detay endpoint'i yok
- News'ler muhtemelen post'lar olarak saklanıyor (veritabanı yapısı kontrol edilmeli)

**Gerekli İşlemler:**
- Yeni news router oluşturulmalı (`src/interfaces/news/news.router.ts`)
- `app.ts`'e news router eklenmeli
- News detay için service metodu oluşturulmalı
- Response formatı dokümantasyona uygun olmalı

---

### 5. GET /brands/{brandId}/history
**Durum:** ✅ MEVCUT  
**Lokasyon:** `src/interfaces/brand/brand.router.ts:828`

**Açıklama:**
- Endpoint mevcut ve çalışıyor
- Brand service'te `getBrandHistory` metodu var
- Response formatı dokümantasyona benzer (bazı farklılıklar olabilir)

**Notlar:**
- Response formatı kontrol edilmeli (dokümantasyondaki format ile uyumlu mu?)
- `pointsHistory` ayrı bir endpoint'te: `/brands/{brandId}/history/points`

---

### 6. GET /brands/{brandId}/stats
**Durum:** ❌ EKSİK  
**Öncelik:** Düşük  
**Lokasyon:** `src/interfaces/brand/brand.router.ts` (eklenmeli)

**Açıklama:**
- Brand istatistiklerini döndüren hafif endpoint yok
- `/brands/{brandId}/history` endpoint'inden `stats` ve `totalPoints` alınabilir
- Daha hafif bir endpoint olarak eklenebilir

**Gerekli İşlemler:**
- Brand router'a yeni endpoint eklenmeli
- Brand service'te `getBrandStats` metodu oluşturulmalı
- Sadece stats ve totalPoints döndürmeli

---

### 7. POST /events/{eventId}/join
**Durum:** ❌ EKSİK  
**Öncelik:** Yüksek  
**Lokasyon:** `src/interfaces/event/event.router.ts` (eklenmeli)

**Açıklama:**
- Event'e katılma endpoint'i yok
- Event service'te join metodu kontrol edilmeli
- `wishboxStats` tablosuna kayıt yapılması gerekebilir

**Gerekli İşlemler:**
- Event router'a POST endpoint eklenmeli
- Event service'e `joinEvent` metodu eklenmeli
- Kullanıcının zaten katılmış olup olmadığı kontrol edilmeli
- Response formatı `GET /events/{eventId}` ile aynı olmalı

---

### 8. GET /events/{eventId}/requirements
**Durum:** ❌ EKSİK  
**Öncelik:** Orta  
**Lokasyon:** `src/interfaces/event/event.router.ts` (eklenmeli)

**Açıklama:**
- Event gereksinimlerini döndüren endpoint yok
- Event service'te requirements hesaplama metodu kontrol edilmeli
- Kullanıcının ilerlemesi hesaplanmalı

**Gerekli İşlemler:**
- Event router'a GET endpoint eklenmeli
- Event service'e `getEventRequirements` metodu eklenmeli
- Kullanıcının ilerlemesi hesaplanmalı
- Overall progress hesaplanmalı

---

## 🔍 Mevcut Benzer Endpoint'ler

### Product ile İlgili
- ❌ `/products/{productId}` - YOK
- ❌ `/products/{productId}/posts` - YOK
- ❌ `/products/{productId}/news` - YOK
- ✅ `/catalog/product-groups/{productGroupId}/products` - MEVCUT (liste)
- ✅ `/brands/{brandId}/products/{productId}/news` - MEVCUT (brand + product news)

### News ile İlgili
- ❌ `/news/{newsId}` - YOK
- ❌ News router - YOK
- ✅ Post detay: `/posts/{id}` - MEVCUT (news post olarak kullanılabilir)

### Brand ile İlgili
- ✅ `/brands/{brandId}/history` - MEVCUT
- ❌ `/brands/{brandId}/stats` - YOK
- ✅ `/brands/{brandId}/history/points` - MEVCUT (points history)
- ✅ `/brands/{brandId}/history/feed` - MEVCUT (history feed)
- ✅ `/brands/{brandId}/history/events` - MEVCUT (history events)

### Event ile İlgili
- ✅ `/events/{eventId}` - MEVCUT (detay)
- ❌ `/events/{eventId}/join` - YOK
- ❌ `/events/{eventId}/requirements` - YOK
- ✅ `/events/{eventId}/posts` - MEVCUT
- ✅ `/events/{eventId}/badges` - MEVCUT

---

## 🚀 Önerilen Uygulama Sırası

### Faz 1: Yüksek Öncelik (Kritik)
1. **GET /products/{productId}** - Product detay sayfası için kritik
2. **GET /products/{productId}/posts** - Product detay sayfasındaki post listesi için kritik
3. **POST /events/{eventId}/join** - Event katılımı için kritik

### Faz 2: Orta Öncelik
4. **GET /products/{productId}/news** - Product haberleri
5. **GET /news/{newsId}** - News detay sayfası
6. **GET /events/{eventId}/requirements** - Event gereksinimleri

### Faz 3: Düşük Öncelik
7. **GET /brands/{brandId}/stats** - Brand stats (history endpoint'inden de alınabilir)

---

## 📝 Teknik Notlar

### Router Yapısı
- Catalog router: `src/interfaces/catalog/catalog.router.ts`
- Brand router: `src/interfaces/brand/brand.router.ts`
- Event router: `src/interfaces/event/event.router.ts`
- News router: **YOK** (oluşturulmalı)

### Service Yapısı
- Catalog service: `src/application/catalog/catalog.service.ts`
- Brand service: `src/application/brand/brand.service.ts`
- Event service: `src/application/event/event.service.ts`
- Post service: `src/application/post/post.service.ts`
- News service: **YOK** (oluşturulmalı veya post service kullanılabilir)

### Repository Yapısı
- Product repository: `src/infrastructure/repositories/product-prisma.repository.ts` ✅
- Post repository: Mevcut (post service içinde)
- News repository: **YOK** (post repository kullanılabilir)

---

## ✅ Kontrol Listesi

### Backend Geliştirme
- [ ] Product detail endpoint ekle
- [ ] Product posts endpoint ekle
- [ ] Product news endpoint ekle
- [ ] News router oluştur
- [ ] News detail endpoint ekle
- [ ] Brand stats endpoint ekle
- [ ] Event join endpoint ekle
- [ ] Event requirements endpoint ekle

### Test
- [ ] Tüm endpoint'ler için unit test
- [ ] Tüm endpoint'ler için integration test
- [ ] Response formatlarını dokümantasyonla karşılaştır
- [ ] Error handling testleri

### Dokümantasyon
- [ ] Swagger dokümantasyonu güncelle
- [ ] API response örnekleri ekle
- [ ] Error response örnekleri ekle

---

## 📞 Sonuç

**Toplam 8 endpoint'ten 7 tanesi eksik.** Yüksek öncelikli 3 endpoint'in acilen eklenmesi gerekiyor çünkü mobil uygulamada kritik ekranlar bu endpoint'lere bağımlı.

**Önerilen Aksiyon:**
1. Önce yüksek öncelikli 3 endpoint'i ekle
2. Sonra orta öncelikli endpoint'leri ekle
3. Son olarak düşük öncelikli endpoint'i ekle

**Tahmini Süre:**
- Faz 1 (Yüksek Öncelik): 2-3 gün
- Faz 2 (Orta Öncelik): 2-3 gün
- Faz 3 (Düşük Öncelik): 1 gün
- **Toplam:** 5-7 gün

