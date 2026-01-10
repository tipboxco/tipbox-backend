# Yeni Eklenen Endpoint'ler - Backend Test/Entegrasyon Dokümantasyonu

**Tarih:** 2025-01-10 (Son Güncelleme)  
**Durum:** Frontend'de entegre edildi, backend'de test/ekleme gerekiyor

Bu dokümantasyon, frontend'de kullanılmak üzere oluşturulan ancak backend'de henüz mevcut olmayabilecek endpoint'leri içerir. Backend tarafında test edilmeli veya eklenmelidir.

---

## 👥 User Feature - Suggested Users

### Suggested Users (Önerilen Kullanıcılar)

**Endpoint:** `GET /users/suggested`

**Authentication:** Bearer Token gerekli

**Durum:** ✅ **Eklendi ve Hazır** (2026-01-10 - v2.0 Güncellendi)

**Açıklama:** Kullanıcıya özel, trust etmediği kullanıcılardan önerir. Pagination, search ve mutual trust count desteği ile.

**Query Parameters:**
- `limit` (optional, default: 20, max: 50): Döndürülecek maksimum kullanıcı sayısı
- `cursor` (optional): Pagination için cursor (son kullanıcının ID'si)
- `q` (optional): Kullanıcı adı veya isim araması için search query

**Request Examples:**
```bash
# Basic
GET /users/suggested?limit=20

# With pagination
GET /users/suggested?limit=15&cursor=user-123

# With search
GET /users/suggested?q=michael&limit=10

# Combined
GET /users/suggested?q=michael&limit=10&cursor=user-456
```

**Response (200):**
```json
{
  "items": [
    {
      "id": "user-123",
      "userName": "michael_clark",
      "name": "Michael Clark",
      "avatar": "https://cdn.tipbox.com/avatars/user-123.jpg",
      "titles": [
        "Technology Enthusiast",
        "Hardware Expert",
        "Digital Innovation Specialist"
      ],
      "isTrusted": false,
      "mutualTrustCount": 3,
      "stats": {
        "trust": 245,
        "truster": 189,
        "posts": 87
      }
    }
  ],
  "pagination": {
    "nextCursor": "user-456",
    "hasMore": true
  }
}
```

**Error Responses:**
- `401`: Unauthorized

**Özellikler:**
- ✅ Kullanıcının trust ettiği kişileri hariç tutar
- ✅ Engellenmiş (blocked) kullanıcıları hariç tutar
- ✅ Susturulmuş (muted) kullanıcıları hariç tutar
- ✅ Popülerlik bazlı sıralama (truster count)
- ✅ **Cursor-based pagination** (infinite scroll)
- ✅ **Search functionality** (name/username)
- ✅ **Mutual trust count** ("3 ortak arkadaş")
- ✅ Her kullanıcı için farklı liste

**Algoritma:**
1. Trust/Block/Mute listelerini çıkar
2. Search query varsa filtrele (name/username)
3. Cursor pagination uygula
4. Popülerleri seç (truster + posts count)
5. Mutual trust count hesapla (paralel)
6. Enrich et (avatar, titles - paralel)

**Frontend Integration:**
- TypeScript interfaces: ✅ Hazır
- React Query hook: ✅ `useSuggestedUsers(searchQuery?)`
- Infinite scroll: ✅ Destekleniyor
- Search: ✅ Destekleniyor

**Detaylı Döküman:** 
- [docs/features/suggested-users.md](features/suggested-users.md)
- [docs/SUGGESTED_USERS_V2_IMPLEMENTATION.md](SUGGESTED_USERS_V2_IMPLEMENTATION.md)

---

## 📦 Catalog Feature - Product Endpoints

### 1. Product Detail

**Endpoint:** `GET /products/{productId}`

**Authentication:** Bearer Token gerekli

**Path Parameters:**
- `productId` (string, required): Product ID'si

**Response (200):**
```json
{
  "productId": "product-1",
  "name": "iPhone 15 Pro",
  "subName": "256GB Titanium",
  "description": "Product açıklaması",
  "image": "http://api-test.tipbox.co:9000/tipbox-media/products/iphone-15-pro.jpg",
  "brand": {
    "id": "brand-1",
    "name": "Apple",
    "image": "http://api-test.tipbox.co:9000/tipbox-media/brands/apple.jpg"
  },
  "specs": [
    "256GB Storage",
    "A17 Pro Chip",
    "Titanium Design"
  ],
  "price": 999.99,
  "currency": "USD"
}
```

**Error Responses:**
- `404`: Product bulunamadı
- `401`: Unauthorized

**Notlar:**
- `subName`, `description`, `specs`, `price`, `currency` opsiyonel alanlar
- `brand` opsiyonel, eğer product bir brand'e ait değilse null olabilir

---

### 2. Product Posts

**Endpoint:** `GET /products/{productId}/posts`

**Authentication:** Bearer Token gerekli

**Path Parameters:**
- `productId` (string, required): Product ID'si

**Query Parameters:**
- `type` (string, optional): Post type - `experience`, `comments`, `benchmark` (opsiyonel, tüm postlar için boş bırakılabilir)
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "type": "experience",
      "data": {
        "id": "post-1",
        "type": "experience",
        "user": {
          "id": "user-1",
          "name": "Ömer Faruk",
          "avatar": "http://api-test.tipbox.co:9000/tipbox-media/profile-pictures/1/uuid.jpg"
        },
        "content": "Post içeriği",
        "images": [
          "http://api-test.tipbox.co:9000/tipbox-media/posts/post-1-image.jpg"
        ],
        "stats": {
          "likes": 10,
          "comments": 5,
          "shares": 2
        },
        "createdAt": "2024-01-15T10:30:00.000Z",
        "product": {
          "id": "product-1",
          "name": "iPhone 15 Pro",
          "image": "http://api-test.tipbox.co:9000/tipbox-media/products/iphone-15-pro.jpg"
        }
      }
    }
  ],
  "pagination": {
    "cursor": "post-1",
    "hasMore": true,
    "limit": 20
  }
}
```

**Error Responses:**
- `404`: Product bulunamadı
- `401`: Unauthorized

**Notlar:**
- `type` parametresi yoksa tüm post tipleri döner
- `type=experience` → Sadece experience postları
- `type=comments` → Sadece comment postları
- `type=benchmark` → Sadece benchmark postları
- Response formatı `/brands/{brandId}/feed` ile aynı (BrandFeedPost formatı)

---

### 3. Product News

**Endpoint:** `GET /products/{productId}/news`

**Authentication:** Bearer Token gerekli

**Path Parameters:**
- `productId` (string, required): Product ID'si

**Query Parameters:**
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "id": "news-1",
      "title": "iPhone 15 Pro Yeni Özellikler",
      "description": "News açıklaması",
      "source": "TechCrunch",
      "date": "2024-01-15T10:30:00.000Z",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/news/news-1.jpg"
    }
  ],
  "pagination": {
    "cursor": "news-1",
    "hasMore": true,
    "limit": 20
  }
}
```

**Error Responses:**
- `404`: Product bulunamadı
- `401`: Unauthorized

**Notlar:**
- Product'a ait haberler listelenir
- Cursor-based pagination kullanılır

---

## 📰 News Feature

### 4. News Detail

**Endpoint:** `GET /news/{newsId}`

**Authentication:** Bearer Token gerekli

**Path Parameters:**
- `newsId` (string, required): News ID'si

**Response (200):**
```json
{
  "id": "news-1",
  "title": "iPhone 15 Pro Yeni Özellikler",
  "content": "Detaylı haber içeriği...",
  "source": "TechCrunch",
  "date": "2024-01-15T10:30:00.000Z",
  "image": "http://api-test.tipbox.co:9000/tipbox-media/news/news-1.jpg",
  "author": "John Doe",
  "tags": ["iPhone", "Apple", "Technology"]
}
```

**Error Responses:**
- `404`: News bulunamadı
- `401`: Unauthorized

**Notlar:**
- `author` ve `tags` opsiyonel alanlar
- `content` tam haber metnini içerir

---

## 🏢 Brand Feature

### 5. Brand History

**Endpoint:** `GET /brands/{brandId}/history`

**Authentication:** Bearer Token gerekli

**Path Parameters:**
- `brandId` (string, required): Brand ID'si

**Response (200):**
```json
{
  "brandId": "brand-1",
  "name": "Apple",
  "totalPoints": 2405,
  "stats": {
    "surveys": 27,
    "shares": 127,
    "events": 12
  },
  "badges": [
    {
      "id": "badge-1",
      "title": "Apple Expert",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/badges/apple-expert.jpg"
    },
    {
      "id": "badge-2",
      "title": "Tech Enthusiast",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/badges/tech-enthusiast.jpg"
    }
  ],
  "pointsHistory": [
    {
      "id": "history-1",
      "title": "Puan Kazanılan Anket Adı",
      "points": 250,
      "date": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "history-2",
      "title": "Puan Kazanılan Anket Adı",
      "points": 250,
      "date": "2024-01-14T10:30:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `404`: Brand bulunamadı
- `401`: Unauthorized

**Notlar:**
- Kullanıcının brand ile ilgili tüm geçmişi, istatistikleri, rozetleri ve puan geçmişini döner
- `badges` ve `pointsHistory` array'leri boş olabilir
- `pointsHistory` en yeni tarihli olanlar önce gelecek şekilde sıralanmalı

---

### 6. Brand Stats

**Endpoint:** `GET /brands/{brandId}/stats`

**Authentication:** Bearer Token gerekli

**Path Parameters:**
- `brandId` (string, required): Brand ID'si

**Response (200):**
```json
{
  "surveys": 27,
  "shares": 127,
  "events": 12,
  "totalPoints": 2405
}
```

**Error Responses:**
- `404`: Brand bulunamadı
- `401`: Unauthorized

**Notlar:**
- Brand istatistiklerini döner
- `/brands/{brandId}/history` endpoint'inden dönen `stats` ve `totalPoints` ile aynı veriler
- Daha hafif bir endpoint (sadece istatistikler için)

---

## 🎁 Events Feature

### 7. Join Event

**Endpoint:** `POST /events/{eventId}/join`

**Authentication:** Bearer Token gerekli

**Path Parameters:**
- `eventId` (string, required): Event ID'si

**Request Body:**
```json
{}
```
(Boş body - sadece path parameter yeterli)

**Response (200):**
```json
{
  "eventId": "event-1",
  "eventType": "SURVEY",
  "title": "Event Başlığı",
  "description": "Event açıklaması",
  "image": "http://api-test.tipbox.co:9000/tipbox-media/events/event-1.jpg",
  "banner": "http://api-test.tipbox.co:9000/tipbox-media/events/event-1-banner.jpg",
  "startDate": "2024-01-15T10:30:00.000Z",
  "endDate": "2024-02-15T10:30:00.000Z",
  "rewards": [
    {
      "id": "reward-1",
      "type": "BADGE",
      "name": "Event Badge",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/badges/event-badge.jpg"
    }
  ],
  "isJoined": true,
  "participants": 151
}
```

**Error Responses:**
- `404`: Event bulunamadı
- `401`: Unauthorized
- `400`: Zaten katılmış veya event'e katılamaz durumda

**Notlar:**
- Response formatı `GET /events/{eventId}` ile aynı (EventDetailApiResponse)
- `isJoined` değeri `true` olarak dönmeli
- `participants` sayısı artmalı
- Eğer kullanıcı zaten katılmışsa, hata dönmeli veya mevcut event detayını dönebilir

---

### 8. Event Requirements

**Endpoint:** `GET /events/{eventId}/requirements`

**Authentication:** Bearer Token gerekli

**Path Parameters:**
- `eventId` (string, required): Event ID'si

**Response (200):**
```json
{
  "eventId": "event-1",
  "requirements": [
    {
      "id": "req-1",
      "title": "Anketi Tamamla",
      "description": "Event anketini tamamlayarak puan kazan",
      "type": "survey",
      "completed": true,
      "progress": {
        "current": 10,
        "total": 10
      }
    },
    {
      "id": "req-2",
      "title": "Post Paylaş",
      "description": "Event ile ilgili bir post paylaş",
      "type": "post",
      "completed": false,
      "progress": {
        "current": 0,
        "total": 1
      }
    },
    {
      "id": "req-3",
      "title": "Paylaşım Yap",
      "description": "Event'i sosyal medyada paylaş",
      "type": "share",
      "completed": false
    }
  ],
  "overallProgress": {
    "completed": 1,
    "total": 3,
    "percentage": 33.33
  }
}
```

**Error Responses:**
- `404`: Event bulunamadı
- `401`: Unauthorized

**Notlar:**
- Event gereksinimlerini ve kullanıcının ilerlemesini döner
- `requirements[].type` değerleri: `survey`, `post`, `share`, `other`
- `requirements[].progress` opsiyonel (sadece sayılabilir gereksinimler için)
- `overallProgress.percentage` 0-100 arası değer
- `overallProgress.completed` tamamlanan gereksinim sayısı
- `overallProgress.total` toplam gereksinim sayısı

---

## 📊 Özet

### Endpoint Listesi

| # | Endpoint | Method | Durum | Öncelik |
|---|----------|--------|-------|---------|
| 1 | `/products/{productId}` | GET | ⚠️ Test/ekleme gerekli | Yüksek |
| 2 | `/products/{productId}/posts` | GET | ⚠️ Test/ekleme gerekli | Yüksek |
| 3 | `/products/{productId}/news` | GET | ⚠️ Test/ekleme gerekli | Orta |
| 4 | `/news/{newsId}` | GET | ⚠️ Test/ekleme gerekli | Orta |
| 5 | `/brands/{brandId}/history` | GET | ⚠️ Test/ekleme gerekli | Orta |
| 6 | `/brands/{brandId}/stats` | GET | ⚠️ Test/ekleme gerekli | Düşük |
| 7 | `/events/{eventId}/join` | POST | ⚠️ Test/ekleme gerekli | Yüksek |
| 8 | `/events/{eventId}/requirements` | GET | ⚠️ Test/ekleme gerekli | Orta |

### Toplam
- **8 yeni endpoint**
- **Yüksek Öncelik:** 3 endpoint
- **Orta Öncelik:** 4 endpoint
- **Düşük Öncelik:** 1 endpoint

---

## 🔧 Backend Test Senaryoları

### 1. Product Detail Test
```
GET /products/product-123
- ✅ Product varsa detay bilgilerini döner
- ✅ Product yoksa 404 döner
- ✅ Unauthorized ise 401 döner
```

### 2. Product Posts Test
```
GET /products/product-123/posts?type=experience&limit=20
- ✅ Experience postları döner
- ✅ type parametresi yoksa tüm postlar döner
- ✅ Pagination çalışır
```

### 3. Product News Test
```
GET /products/product-123/news?limit=20
- ✅ Product haberleri döner
- ✅ Pagination çalışır
```

### 4. News Detail Test
```
GET /news/news-123
- ✅ News varsa detay bilgilerini döner
- ✅ News yoksa 404 döner
```

### 5. Brand History Test
```
GET /brands/brand-123/history
- ✅ Brand history döner
- ✅ Badges ve pointsHistory boş array olabilir
```

### 6. Brand Stats Test
```
GET /brands/brand-123/stats
- ✅ Brand stats döner
```

### 7. Join Event Test
```
POST /events/event-123/join
- ✅ Event'e katılır, isJoined: true döner
- ✅ Zaten katılmışsa hata veya mevcut detay döner
- ✅ Participants sayısı artar
```

### 8. Event Requirements Test
```
GET /events/event-123/requirements
- ✅ Event requirements ve progress döner
- ✅ Overall progress hesaplanır
```

---

## 📝 Notlar

1. **Response Formatları:** Tüm endpoint'ler mevcut API pattern'lerine uygun olarak tasarlandı (cursor-based pagination, standart error format, vb.)

2. **Authentication:** Tüm endpoint'ler Bearer Token authentication gerektirir (mevcut pattern'e uygun)

3. **Pagination:** List endpoint'leri cursor-based pagination kullanır (`cursor`, `hasMore`, `limit`)

4. **Error Handling:** Standart error response formatı kullanılmalı:
   ```json
   {
     "success": false,
     "message": "Hata mesajı",
     "error": "Detaylı hata bilgisi (opsiyonel)"
   }
   ```

5. **Type Definitions:** Frontend'de TypeScript type'ları tanımlı, backend response'ları bu type'lara uygun olmalı

6. **Cache:** Backend tarafında uygun cache stratejileri uygulanabilir (özellikle product detail, news detail gibi sık değişmeyen veriler için)

---

## 🚀 Entegrasyon Önceliği

### Yüksek Öncelik (Kullanıcı Akışında Kritik)
1. `GET /products/{productId}` - Product detay sayfası için kritik
2. `GET /products/{productId}/posts` - Product detay sayfasındaki post listesi için kritik
3. `POST /events/{eventId}/join` - Event katılımı için kritik

### Orta Öncelik
4. `GET /products/{productId}/news` - Product haberleri
5. `GET /news/{newsId}` - News detay sayfası
6. `GET /brands/{brandId}/history` - Brand history sayfası
7. `GET /events/{eventId}/requirements` - Event gereksinimleri

### Düşük Öncelik
8. `GET /brands/{brandId}/stats` - Brand stats (history endpoint'inden de alınabilir)

---

## 📞 İletişim

Backend'de bu endpoint'ler mevcut mu veya eklenmesi gerekiyor mu kontrol edilmeli. Eğer mevcut değilse, yukarıdaki formatlara uygun olarak eklenmelidir.

Frontend'de tüm endpoint'ler entegre edildi ve kullanıma hazır. Backend'de test edildikten sonra ekranlar çalışır hale gelecek.

