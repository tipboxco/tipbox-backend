# Mobil Tarafta Beklenen Ama Backend'den Eksik/Hatalı Dönen Endpoint'ler

Bu dokümantasyon, mobil uygulamada kullanılan ama backend'den eksik, hatalı veya yanlış format dönen endpoint'leri içerir.

## 📋 Genel Durum

- **Toplam Endpoint:** ~100+
- **Bağlı Endpoint:** ~80+
- **Eksik/Hatalı Endpoint:** ~20+

---

## 🔴 Kritik Sorunlar

### 1. Search Endpoint - `/search`
**Durum:** ✅ **DOĞRULANDI** - Backend response formatı doğru

**Kontrol Sonuçları:**
- ✅ `/search` endpoint'i mevcut ve çalışıyor
- ✅ Response formatı doğru: `{ userData: [], brandData: [], productData: [] }`
- ⚠️ SearchModal component'i hala mock data kullanıyor olabilir

**Beklenen Response:**
```json
{
  "userData": [...],
  "brandData": [...],
  "productData": [...]
}
```

**Aksiyon:**
- ✅ Backend response formatı kontrol edildi ve doğru
- SearchModal component'ini güncelle - Artık gerçek endpoint'i kullanabilir
- `useSearch` hook'unu kullan

---

### 2. Wallet Endpoints - `/wallets/*`
**Durum:** ✅ **DÜZELTİLDİ** - Transaction endpoint'i eklendi

**Yapılan Değişiklikler:**
- ✅ `GET /wallets/transactions` endpoint'i eklendi
- ✅ `GET /wallets/balance` endpoint'i eklendi
- ✅ Tüm wallet endpoint'lerine `authMiddleware` eklendi
- ✅ User ID JWT token'dan alınıyor

**Eklendi Endpoint'ler:**
- `GET /wallets/transactions` - Kullanıcının TIPS transaction geçmişini getirir (pagination ile)
- `GET /wallets/balance` - Kullanıcının TIPS balance'ını getirir

**Aksiyon:**
- ✅ Backend'de transaction endpoint'i eklendi
- WalletScreen'i güncelle - Artık gerçek endpoint'i kullanabilir

---

### 3. Inventory Endpoints - `/inventory/*`
**Durum:** ✅ **DÜZELTİLDİ** - Split experience endpoint'i doğrulandı

**Durum:**
- ✅ `POST /inventory/split-experience` - Backend'de mevcut ve çalışıyor
- ⚠️ `POST /posts/experience/split` - Mevcut ama deprecated olarak işaretlenebilir
- ⚠️ `POST /posts/split-experience` - Mevcut ama deprecated olarak işaretlenebilir

**Not:**
- Backend'de 3 farklı split experience endpoint'i var:
  1. `/inventory/split-experience` - ✅ **Önerilen** (inventory context'inde)
  2. `/posts/experience/split` - ⚠️ Mevcut ama inventory endpoint'i tercih edilmeli
  3. `/posts/split-experience` - ⚠️ Mevcut ama inventory endpoint'i tercih edilmeli

**Aksiyon:**
- ✅ Backend'de `/inventory/split-experience` endpoint'i mevcut ve çalışıyor
- Mobil taraf `/inventory/split-experience` endpoint'ini kullanmalı
- Diğer endpoint'ler (`/posts/experience/split`, `/posts/split-experience`) deprecated olarak işaretlenebilir

---

## 🟡 Orta Öncelikli Sorunlar

### 4. Post Endpoints - `/posts/:postId`
**Durum:** ✅ Endpoint'ler bağlandı ama kullanılmıyor

**Sorunlar:**
- `GET /posts/:postId` - Bağlandı ama PostDetailCard mock data kullanıyor olabilir
- `PUT /posts/:postId` - Bağlandı ama kullanılmıyor
- `DELETE /posts/:postId` - Bağlandı ama kullanılmıyor

**Aksiyon:**
- PostDetailCard'ı kontrol et
- Post edit/delete özelliklerini ekle

---

### 5. User Management - Avatar/Banner Upload
**Durum:** ✅ Endpoint'ler bağlandı ama kullanılmıyor

**Sorunlar:**
- `POST /users/me/avatar` - Bağlandı ama kullanılmıyor
- `POST /users/me/banner` - Bağlandı ama kullanılmıyor

**Aksiyon:**
- Profile edit screen'lerinde bu endpoint'leri kullan

---

### 6. Auth Endpoints
**Durum:** ✅ Endpoint'ler bağlandı ama bazıları kullanılmıyor

**Sorunlar:**
- `POST /auth/verify-email` - Bağlandı ama VerifyCodeScreen'de kullanılıyor mu kontrol et
- `GET /auth/me` - Bağlandı ama kullanılmıyor
- `POST /auth/forgot-password` - Bağlandı ama ForgotPasswordScreen'de kullanılıyor mu kontrol et
- `POST /auth/verify-reset-code` - Bağlandı ama kullanılıyor mu kontrol et
- `POST /auth/reset-password` - Bağlandı ama ResetPasswordScreen'de kullanılıyor mu kontrol et
- `POST /auth/logout` - Bağlandı ama kullanılmıyor

**Aksiyon:**
- Auth screen'lerinde bu endpoint'leri kullan
- Logout fonksiyonunu ekle

---

### 7. Marketplace Endpoints
**Durum:** ✅ Endpoint'ler bağlandı ama bazıları kullanılmıyor

**Sorunlar:**
- `PUT /marketplace/listings/:listingId/price` - Bağlandı ama kullanılmıyor
- `GET /marketplace/sell/:nftId` - Bağlandı ama kullanılmıyor
- `GET /marketplace/sell/:nftId/detail` - Bağlandı ama kullanılmıyor

**Aksiyon:**
- Marketplace screen'lerinde bu endpoint'leri kullan

---

### 8. Event Endpoints
**Durum:** ✅ Endpoint'ler bağlandı ama bazıları kullanılmıyor

**Sorunlar:**
- `GET /events/:eventId/posts` - Bağlandı ama kullanılmıyor
- `GET /events/:eventId/badges` - Bağlandı ama kullanılmıyor

**Aksiyon:**
- Event detail screen'lerinde bu endpoint'leri kullan

---

### 9. Expert Endpoints
**Durum:** ✅ Endpoint'ler bağlandı ama hiçbiri kullanılmıyor

**Sorunlar:**
- Tüm Expert endpoint'leri bağlandı ama Expert feature'ı kullanılmıyor
- Expert screen'leri yok

**Aksiyon:**
- Expert feature'ını implement et
- Expert screen'leri oluştur

---

### 10. Messaging - Message Feed
**Durum:** ✅ Endpoint bağlandı ama kullanılmıyor

**Sorunlar:**
- `GET /messages/feed` - Bağlandı ama InboxScreen'de kullanılmıyor
- InboxScreen muhtemelen `/messages` endpoint'ini kullanıyor

**Aksiyon:**
- InboxScreen'i kontrol et
- Message feed endpoint'ini kullan

---

## 🟢 Düşük Öncelikli Sorunlar

### 11. Response Format Uyumsuzlukları
**Durum:** ✅ **DOĞRULANDI** - Response formatları doğru

**Kontrol Sonuçları:**
- ✅ `GET /users/:userId/feed` - Backend doğru format döndürüyor: `{ items: [], pagination: { cursor, hasMore, limit } }`
- ✅ `GET /users/:userId/reviews` - Backend doğru format döndürüyor: `{ items: [], pagination: { cursor, hasMore, limit } }`
- ✅ `GET /users/:userId/benchmarks` - Backend doğru format döndürüyor: `{ items: [], pagination: { cursor, hasMore, limit } }`

**Not:**
- Tüm user endpoint'leri standart pagination formatını kullanıyor
- Response formatları dokümantasyona uygun

**Aksiyon:**
- ✅ Backend response formatları kontrol edildi ve doğru
- Pagination formatı zaten standardize edilmiş

---

## 📝 Özet ve Öneriler

### Yapılması Gerekenler

1. **SearchModal'ı güncelle** - Search endpoint'ini kullan
2. **WalletScreen'i güncelle** - Wallet endpoint'lerini kullan
3. **Auth screen'lerini kontrol et** - Eksik endpoint'leri kullan
4. **Post edit/delete özelliklerini ekle** - Post endpoint'lerini kullan
5. **Profile edit screen'lerini güncelle** - Avatar/banner upload endpoint'lerini kullan
6. **Marketplace screen'lerini güncelle** - Eksik endpoint'leri kullan
7. **Event detail screen'lerini güncelle** - Event posts/badges endpoint'lerini kullan
8. **Expert feature'ını implement et** - Expert endpoint'lerini kullan
9. **Backend response formatlarını kontrol et** - Pagination ve response formatlarını standardize et

### Backend'e Bildirilmesi Gerekenler

1. ✅ **Transaction Endpoint Eklendi** - `/wallets/transactions` endpoint'i eklendi
2. ✅ **Split Experience Endpoint Doğrulandı** - `/inventory/split-experience` endpoint'i mevcut ve çalışıyor
3. ✅ **Pagination Format Doğrulandı** - Tüm user endpoint'leri standart pagination formatını kullanıyor
4. ✅ **Response Format Doğrulandı** - Search endpoint response formatı doğru

### Backend'de Yapılan Değişiklikler

1. ✅ `GET /wallets/transactions` endpoint'i eklendi
2. ✅ `GET /wallets/balance` endpoint'i eklendi
3. ✅ Wallet router'a `authMiddleware` eklendi
4. ✅ `TipsBalanceService.getUserTransactionHistory()` metodu eklendi

---

## 🔍 Test Edilmesi Gerekenler

1. Tüm yeni bağlanan endpoint'lerin çalışıp çalışmadığı
2. Response formatlarının dokümantasyona uygun olup olmadığı
3. Error handling'in doğru çalışıp çalışmadığı
4. Pagination'ın doğru çalışıp çalışmadığı
5. Cache stratejilerinin doğru çalışıp çalışmadığı

---

## 📅 Son Güncelleme

Bu dokümantasyon **2024-01-15** tarihinde oluşturulmuştur.

**Son Revizyon:** 2024-01-15
- ✅ Wallet transactions endpoint'i eklendi
- ✅ Wallet balance endpoint'i eklendi
- ✅ Response formatları doğrulandı
- ✅ Split experience endpoint'leri doğrulandı

