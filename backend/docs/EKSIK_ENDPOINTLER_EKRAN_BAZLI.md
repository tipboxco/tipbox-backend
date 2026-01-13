# Eksik Endpoint'ler - Ekran Bazlı Analiz

## 📱 Auth Feature

### 1. SelectCategoriesScreen
**Durum:** ❌ Mock data kullanıyor
**Kullanılan Mock:** `@/src/mock/auth/categorys`
**Eksik Endpoint:**
- `POST /auth/categories` - Seçilen kategorileri kaydetmek için
- `GET /auth/categories` - Kullanıcının seçtiği kategorileri getirmek için (opsiyonel)

**Not:** Kategorileri seçtikten sonra `completeRegistration()` çağrılıyor ama API'ye kayıt yapılmıyor (TODO yorumu var).

---

## 📦 Catalog Feature

### 2. BrandProductDetailScreen
**Durum:** ❌ Mock data kullanıyor
**Kullanılan Mock:**
- `mock_brand_product_experience_posts` - Deneyim paylaşımları
- `mock_news_data` - Haberler
- `mock_benchmark_posts` - Karşılaştırmalar

**Eksik Endpoint:**
- `GET /products/{productId}/posts?type=experience` - Deneyim paylaşımları
- `GET /products/{productId}/posts?type=comments` - Yorumlar
- `GET /products/{productId}/posts?type=benchmark` - Karşılaştırmalar
- `GET /products/{productId}/news` - Haberler
- `GET /products/{productId}` - Ürün detay bilgileri

**Not:** `productId` route params'tan geliyor ama API'ye bağlanmıyor.

---

### 3. BrandPostListScreen
**Durum:** ❌ Mock data kullanıyor
**Kullanılan Mock:** `mockPostData` from `@/src/mock/catalog/brandSurveys`
**Eksik Endpoint:**
- `GET /brands/{brandId}/posts` - Brand'e ait tüm postları listele

**Not:** Brand ID parametresi yok, muhtemelen route params'tan alınmalı.

---

### 4. BrandEventsScreen
**Durum:** ❌ Mock data kullanıyor
**Kullanılan Mock:** `mockBrandEvents` from `@/src/mock/catalog/brandSurveys`
**Eksik Endpoint:**
- `GET /brands/{brandId}/events` - Brand'e ait etkinlikleri listele

**Not:** `useBrandEvents` hook'u var ama bu ekranda kullanılmıyor. SurveyScreen'de kullanılıyor.

---

### 5. BrandEventsDetailScreen
**Durum:** ❌ Mock data kullanıyor
**Kullanılan Mock:** `mockEventDetail` from `@/src/mock/catalog/brandSurveys`
**Eksik Endpoint:**
- `GET /events/{eventId}` - Etkinlik detay bilgileri
- `POST /events/{eventId}/join` - Etkinliğe katıl
- `GET /events/{eventId}/requirements` - Etkinlik gereksinimleri ve ilerleme

**Not:** Event ID route params'tan alınmalı.

---

### 6. BrandSurveyListScreen
**Durum:** ❌ Mock data kullanıyor
**Kullanılan Mock:** `mockBrandSurveys` from `@/src/mock/catalog/brandSurveys`
**Eksik Endpoint:**
- `GET /brands/{brandId}/surveys` - Brand'e ait anketleri listele

**Not:** `useBrandSurveys` hook'u var ama bu ekranda kullanılmıyor. SurveyScreen'de kullanılıyor.

---

### 7. NewsDetailScreen
**Durum:** ❌ Mock data kullanıyor
**Kullanılan Mock:** `mock_news_detail` from `@/src/mock/catalog/brandProductDetail/newsDetail`
**Eksik Endpoint:**
- `GET /news/{newsId}` - Haber detay bilgileri

**Not:** `newsId` route params'tan geliyor ama API'ye bağlanmıyor.

---

### 8. BrandHistoryScreen
**Durum:** ❌ Mock data kullanıyor
**Kullanılan Mock:** Local mock data (brandData object)
**Eksik Endpoint:**
- `GET /brands/{brandId}/history` - Brand geçmişi, istatistikler, rozetler, puan geçmişi
- `GET /brands/{brandId}/stats` - Brand istatistikleri (surveys, shares, events)

**Not:** Brand ID parametresi yok, muhtemelen route params'tan alınmalı.

---

## 🎁 Events Feature

### 9. RewardsBadgesScreen
**Durum:** ❌ Mock data kullanıyor
**Kullanılan Mock:** `see_all_reward_mock` from `@/src/mock/events/communityEvents`
**Eksik Endpoint:**
- `GET /rewards` - Tüm ödülleri listele
- `GET /rewards/{rewardId}` - Ödül detay bilgileri

**Not:** AchievementTab'de `useAchievements` hook'u var ama bu ekranda kullanılmıyor.

---

## 💰 Wallet Feature

### 10. WalletScreen
**Durum:** ❌ Mock transaction data kullanıyor
**Kullanılan Mock:** Local mock transactions object (today, yesterday, lastWeek, lastMonth)
**Eksik Endpoint:**
- `GET /wallet/balance` - Cüzdan bakiyesi
- `GET /wallet/transactions` - İşlem geçmişi (pagination ile)
- `POST /wallet/send` - TIPS gönder
- `POST /wallet/claim` - TIPS talep et
- `GET /wallet/nft` - NFT varlıkları

**Not:** Send ve Claim işlemleri için bottom sheet'ler var ama API entegrasyonu yok.

---

### 11. NftAssetsScreen
**Durum:** ❌ Mock NFT data kullanıyor
**Kullanılan Mock:** Local mock nfts array
**Eksik Endpoint:**
- `GET /wallet/nft` - NFT varlıkları listele
- `GET /wallet/nft/{nftId}` - NFT detay bilgileri

---

## 🔍 Search Feature

### 12. SearchModal
**Durum:** ❌ Mock data kullanıyor
**Kullanılan Mock:** Local mock users, brands, products arrays
**Eksik Endpoint:**
- `GET /search?q={query}&type={users|brands|products}` - Arama endpoint'i

**Not:** `handleSearch` fonksiyonunda TODO yorumu var: "TODO: Implement actual search"

---

## 💳 Settings Feature

### 13. PaymentTab (PaymentAndSubscriptionTabsScreen)
**Durum:** ❌ Mock data kullanıyor
**Kullanılan Mock:**
- `mockSavedCards` - Kayıtlı kartlar
- `mockBillingHistory` - Faturalama geçmişi
- `mockLinkedPaymentMethod` - Bağlı ödeme yöntemi

**Eksik Endpoint:**
- `GET /payment/cards` - Kayıtlı kartları listele
- `POST /payment/cards` - Yeni kart ekle
- `DELETE /payment/cards/{cardId}` - Kart sil
- `GET /payment/billing-history` - Faturalama geçmişi
- `GET /payment/method` - Bağlı ödeme yöntemi

---

## ✅ Bağlı Olan Ekranlar (Referans)

### Catalog Feature
- ✅ **SurveyScreen** - `useBrandSurveys`, `useBrandTrends`, `useBrandEvents` kullanıyor
- ✅ **BrandDetailScreen** - `useBrandCatalog`, `useBrandFeed` kullanıyor
- ✅ **ProductCatalogScreen** - Catalog API'leri kullanıyor

### Events Feature
- ✅ **EventsScreen** - `useActiveEvents`, `useUpcomingEvents`, `useLimitedEvent`, `useAchievements` kullanıyor
- ✅ **AchievementTab** - `useLimitedEvent`, `useAchievements` kullanıyor
- ✅ **CommunityTab** - `useActiveEvents`, `useUpcomingEvents` kullanıyor

### Profile Feature
- ✅ **CollectionsScreen** - `useUserCollectionAchievements`, `useUserCollectionBridges` kullanıyor
- ✅ **AchievementBadgesTab** - `useUserCollectionAchievements` kullanıyor
- ✅ **BridgeBadgesTab** - `useUserCollectionBridges` kullanıyor

---

## 📊 Özet İstatistikler

- **Toplam Ekran:** 13 ekran
- **Bağlı Ekranlar:** 8 ekran (referans olarak)
- **Eksik Endpoint'li Ekranlar:** 13 ekran
- **Toplam Eksik Endpoint:** ~30+ endpoint

---

## 🔧 Öncelik Sırası

### Yüksek Öncelik
1. **SelectCategoriesScreen** - Kullanıcı kayıt akışında kritik
2. **BrandProductDetailScreen** - Ana özelliklerden biri
3. **WalletScreen** - Ödeme işlemleri için kritik
4. **SearchModal** - Temel arama özelliği

### Orta Öncelik
5. **BrandPostListScreen** - Brand detay sayfası ile ilgili
6. **BrandEventsScreen** - Brand detay sayfası ile ilgili
7. **BrandSurveyListScreen** - Brand detay sayfası ile ilgili
8. **BrandHistoryScreen** - Brand detay sayfası ile ilgili

### Düşük Öncelik
9. **RewardsBadgesScreen** - Events ekranında zaten var
10. **NewsDetailScreen** - Detay sayfası
11. **BrandEventsDetailScreen** - Detay sayfası
12. **NftAssetsScreen** - NFT özelliği
13. **PaymentTab** - Ayarlar sayfası

