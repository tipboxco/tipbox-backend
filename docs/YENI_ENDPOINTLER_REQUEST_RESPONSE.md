# Yeni Eklenen Endpoint'ler - Request/Response Dokümantasyonu

Bu dokümantasyon, mobil uygulama geliştiricileri için yeni eklenen endpoint'lerin detaylı request/response yapılarını içerir.

---

## 📋 İçindekiler

1. [Notification Endpoint'leri](#1-notification-endpointleri)
2. [Messages Endpoint'leri](#2-messages-endpointleri)
3. [User Endpoint'leri](#3-user-endpointleri)
4. [Explore Endpoint'leri](#4-explore-endpointleri)
5. [Catalog Endpoint'leri](#5-catalog-endpointleri)
6. [User Report Endpoint](#6-user-report-endpoint)

---

## 1. Notification Endpoint'leri

### 1.1. Bildirimleri Listele (Type/Category Filtering ile)

**Endpoint:** `GET /notifications`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `limit` | integer | Hayır | Sayfa başına bildirim sayısı (default: 20) |
| `offset` | integer | Hayır | Atlanacak bildirim sayısı (default: 0) |
| `unreadOnly` | boolean | Hayır | Sadece okunmamış bildirimler (default: false) |
| `type` | string | Hayır | Bildirim tipi (örn: `POST_LIKED`, `NEW_MESSAGE`, `NEW_TRUSTER`) |
| `category` | string | Hayır | Bildirim kategorisi (`POST`, `TRUST`, `MESSAGE`, `SUPPORT`, `COLLECTION`, `GAMIFICATION`, `EXPERT`, `EVENT`, `SYSTEM`) |

**Request Örnekleri:**

```http
# Tüm bildirimler
GET /notifications?limit=20&offset=0

# Sadece okunmamış bildirimler
GET /notifications?unreadOnly=true

# Sadece POST kategorisi bildirimleri
GET /notifications?category=POST

# Belirli bir tip bildirim
GET /notifications?type=NEW_MESSAGE

# POST kategorisi ve okunmamış
GET /notifications?category=POST&unreadOnly=true
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "660e8400-e29b-41d4-a716-446655440001",
      "type": "POST_LIKED",
      "title": "Postunuz Beğenildi! ❤️",
      "message": "Ahmet Yılmaz postunuzu beğendi",
      "data": {
        "postId": "abc123def456",
        "likerId": "770e8400-e29b-41d4-a716-446655440002",
        "likerName": "Ahmet Yılmaz"
      },
      "read": false,
      "readAt": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

**Notification Type Değerleri:**
- `POST_LIKED`, `POST_COMMENTED`, `POST_SHARED`, `POST_FAVORITED`
- `COMMENT_LIKED`, `COMMENT_REPLIED`
- `NEW_TRUSTER`, `NEW_TRUSTED_BY`
- `NEW_MESSAGE`, `DM_REQUEST_RECEIVED`, `DM_REQUEST_ACCEPTED`, `SUPPORT_REQUEST_ACCEPTED`
- `COLLECTION_POST_ADDED`, `COLLECTION_SHARED`
- `NEW_BADGE`, `ACHIEVEMENT_UNLOCKED`, `LEVEL_UP`, `REWARD_EARNED`
- `EXPERT_REQUEST_AVAILABLE`, `EXPERT_REQUEST_ANSWERED`
- `EVENT_STARTED`, `EVENT_ENDING_SOON`, `EVENT_REWARD_AVAILABLE`
- `SYSTEM_ANNOUNCEMENT`, `ACCOUNT_SECURITY`, `TIPS_RECEIVED`, `TIPS_SENT`

**Notification Category Değerleri:**
- `POST` - Post etkileşimleri
- `TRUST` - Trust/takip bildirimleri
- `MESSAGE` - Mesaj bildirimleri
- `SUPPORT` - Destek talebi bildirimleri
- `COLLECTION` - Koleksiyon bildirimleri
- `GAMIFICATION` - Rozet/başarı bildirimleri
- `EXPERT` - Expert soru bildirimleri
- `EVENT` - Etkinlik bildirimleri
- `SYSTEM` - Sistem bildirimleri

---

## 2. Messages Endpoint'leri

### 2.1. Mesaj Kutusunu Getir (Category Filtering ile)

**Endpoint:** `GET /messages`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `search` | string | Hayır | Karşı tarafın adı, unvanı veya son mesaj içeriğinde arama |
| `unreadOnly` | boolean | Hayır | Sadece okunmamış mesajı olan thread'ler (default: false) |
| `threadType` | string | Hayır | Thread tipi filtresi: `DM`, `SUPPORT`, `ALL` (default: `ALL`) |
| `limit` | integer | Hayır | Maksimum thread sayısı (1-100, default: 50) |

**Request Örnekleri:**

```http
# Tüm mesajlar
GET /messages?limit=50

# Sadece DM mesajları
GET /messages?threadType=DM

# Sadece Support mesajları
GET /messages?threadType=SUPPORT

# Okunmamış DM mesajları
GET /messages?threadType=DM&unreadOnly=true

# Arama ile DM mesajları
GET /messages?threadType=DM&search=ahmet
```

**Response (200):**

```json
[
  {
    "id": "1f2d6cb7-aef1-4221-8dba-2cd0601faae3",
    "recipientUserId": "660e8400-e29b-41d4-a716-446655440001",
    "senderName": "Ahmet Yılmaz",
    "senderTitle": "Expert",
    "senderAvatar": "https://cdn.tipbox.co/avatars/ahmet.jpg",
    "lastMessage": "Merhaba, nasılsın?",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "isUnread": true,
    "unreadCount": 3,
    "threadType": "DM"
  },
  {
    "id": "2f3e7dc8-bfg2-5332-9ecb-3de1712gbbe4",
    "recipientUserId": "770e8400-e29b-41d4-a716-446655440002",
    "senderName": "Ayşe Demir",
    "senderTitle": "Support Expert",
    "senderAvatar": "https://cdn.tipbox.co/avatars/ayse.jpg",
    "lastMessage": "Smartwatch kurulumu için yardıma ihtiyacım var.",
    "timestamp": "2024-01-15T09:15:00.000Z",
    "isUnread": false,
    "unreadCount": 0,
    "threadType": "SUPPORT"
  }
]
```

**ThreadType Değerleri:**
- `DM` - Normal direkt mesaj thread'leri
- `SUPPORT` - Destek talebi thread'leri
- `ALL` - Tüm thread'ler (default)

---

## 3. User Endpoint'leri

### 3.1. Truster Listesi (Sort ile)

**Endpoint:** `GET /users/:id/trusters`

**Authentication:** Bearer Token gerekli

**Path Parameters:**
| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `id` | string | Evet | Kullanıcı ID'si |

**Query Parameters:**
| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `q` | string | Hayır | İsim veya kullanıcı adına göre arama (case-insensitive) |
| `sort` | string | Hayır | Sıralama kriteri (default: `date_desc`) |

**Sort Değerleri:**
- `name_asc` - İsme göre A-Z
- `name_desc` - İsme göre Z-A
- `date_asc` - Trust tarihine göre eski-yeni
- `date_desc` - Trust tarihine göre yeni-eski (default)
- `trusted_first` - Önce trust edilenler (mutual trust)

**Request Örnekleri:**

```http
# Tüm truster'lar (yeni-eski)
GET /users/550e8400-e29b-41d4-a716-446655440000/trusters

# İsme göre A-Z
GET /users/550e8400-e29b-41d4-a716-446655440000/trusters?sort=name_asc

# Arama ile truster'lar
GET /users/550e8400-e29b-41d4-a716-446655440000/trusters?q=ahmet&sort=name_asc

# Önce trust edilenler
GET /users/550e8400-e29b-41d4-a716-446655440000/trusters?sort=trusted_first
```

**Response (200):**

```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "userName": "ahmet_yilmaz",
    "titles": ["Expert", "Technology Enthusiast"],
    "avatar": "https://cdn.tipbox.co/avatars/ahmet.jpg",
    "name": "Ahmet Yılmaz",
    "isTrusted": true
  },
  {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "userName": "ayse_demir",
    "titles": ["Support Expert"],
    "avatar": "https://cdn.tipbox.co/avatars/ayse.jpg",
    "name": "Ayşe Demir",
    "isTrusted": false
  }
]
```

### 3.2. Kullanıcı Raporla

**Endpoint:** `POST /users/:id/report/:targetUserId`

**Authentication:** Bearer Token gerekli

**Path Parameters:**
| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `id` | string | Evet | Raporlayan kullanıcı ID'si (JWT token'daki userId ile eşleşmeli) |
| `targetUserId` | string | Evet | Raporlanacak kullanıcı ID'si |

**Request Body:**
```json
{
  "category": "SPAM",
  "description": "Spam mesajlar gönderiyor" // Opsiyonel, maksimum 500 karakter
}
```

**Category Değerleri:**
- `SPAM` - Spam
- `HARASSMENT` - Taciz
- `SCAM` - Dolandırıcılık
- `INAPPROPRIATE_CONTENT` - Uygunsuz İçerik
- `FAKE_ACCOUNT` - Sahte Hesap
- `OTHER` - Diğer

**Request Örnekleri:**

```http
POST /users/550e8400-e29b-41d4-a716-446655440000/report/660e8400-e29b-41d4-a716-446655440001
Content-Type: application/json
Authorization: Bearer {token}

{
  "category": "SPAM",
  "description": "Sürekli spam mesajlar gönderiyor"
}
```

**Response (201):**
```json
{
  "message": "Kullanıcı başarıyla raporlandı"
}
```

**Error Responses:**

```json
// 400 - Geçersiz kategori
{
  "message": "Geçersiz rapor kategorisi"
}

// 400 - Kendini raporlama
{
  "message": "Kendinizi raporlayamazsınız"
}

// 404 - Kullanıcı bulunamadı
{
  "message": "Raporlanan kullanıcı bulunamadı"
}

// 409 - Zaten raporlanmış
{
  "message": "Bu kullanıcı zaten raporlanmış. Her kullanıcı bir kullanıcı için sadece bir kez rapor gönderebilir."
}
```

---

## 4. Explore Endpoint'leri

### 4.1. Hottest Posts (Search ile)

**Endpoint:** `GET /explore/hottest`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `cursor` | string | Hayır | Pagination cursor |
| `limit` | integer | Hayır | Sayfa başına item sayısı (1-50, default: 20) |
| `search` | string | Hayır | Post başlığı veya içeriğinde arama |

**Request Örnekleri:**

```http
# Tüm hottest posts
GET /explore/hottest?limit=20

# Arama ile hottest posts
GET /explore/hottest?search=smartwatch&limit=20

# Pagination ile
GET /explore/hottest?cursor=abc123&limit=20&search=iphone
```

**Response (200):**

```json
{
  "items": [
    {
      "type": "feed",
      "data": {
        "id": "abc123def456",
        "userId": "550e8400-e29b-41d4-a716-446655440000",
        "userName": "omer_faruk",
        "userAvatar": "https://cdn.tipbox.co/avatars/omer.jpg",
        "title": "iPhone 15 Pro İnceleme",
        "body": "iPhone 15 Pro'nun detaylı incelemesi...",
        "images": ["https://cdn.tipbox.co/posts/iphone15.jpg"],
        "createdAt": "2024-01-15T10:30:00.000Z",
        "stats": {
          "likes": 42,
          "comments": 15,
          "shares": 8,
          "bookmarks": 23
        }
      }
    }
  ],
  "pagination": {
    "cursor": "def456ghi789",
    "hasMore": true,
    "limit": 20
  }
}
```

### 4.2. Events (Search ile)

**Endpoint:** `GET /explore/events`

**Authentication:** Gerekli değil

**Query Parameters:**
| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `cursor` | string | Hayır | Pagination cursor |
| `limit` | integer | Hayır | Sayfa başına item sayısı (1-50, default: 20) |
| `search` | string | Hayır | Event başlığı veya açıklamasında arama |

**Request Örnekleri:**

```http
# Tüm event'ler
GET /explore/events?limit=20

# Arama ile event'ler
GET /explore/events?search=survey&limit=20
```

**Response (200):**

```json
{
  "items": [
    {
      "eventId": "evt123abc456",
      "eventType": "SURVEY",
      "image": "https://cdn.tipbox.co/events/survey.jpg",
      "title": "Yeni Ürün Anketi",
      "description": "Yeni ürünlerimiz hakkında görüşlerinizi alıyoruz",
      "startDate": "2024-01-15T00:00:00.000Z",
      "endDate": "2024-01-30T23:59:59.000Z",
      "interaction": 1250,
      "participants": [
        {
          "userId": "550e8400-e29b-41d4-a716-446655440000",
          "avatar": "https://cdn.tipbox.co/avatars/user1.jpg",
          "userName": "user1"
        }
      ]
    }
  ],
  "pagination": {
    "cursor": "evt789def012",
    "hasMore": true,
    "limit": 20
  }
}
```

**EventType Değerleri:**
- `SURVEY` - Anket
- `POLL` - Anket/Oylama
- `CONTEST` - Yarışma
- `CHALLENGE` - Mücadele
- `PROMOTION` - Promosyon

### 4.3. New Brands (Search ile)

**Endpoint:** `GET /explore/brands/new`

**Authentication:** Gerekli değil

**Query Parameters:**
| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `cursor` | string | Hayır | Pagination cursor |
| `limit` | integer | Hayır | Sayfa başına item sayısı (1-50, default: 20) |
| `search` | string | Hayır | Marka adında arama |

**Request Örnekleri:**

```http
# Tüm yeni markalar
GET /explore/brands/new?limit=20

# Arama ile markalar
GET /explore/brands/new?search=apple&limit=20
```

**Response (200):**

```json
{
  "items": [
    {
      "brandId": "550e8400-e29b-41d4-a716-446655440000",
      "images": "https://cdn.tipbox.co/brands/apple-logo.png",
      "title": "Apple",
      "description": "Apple Inc. teknoloji şirketi"
    }
  ],
  "pagination": {
    "cursor": "660e8400-e29b-41d4-a716-446655440001",
    "hasMore": true,
    "limit": 20
  }
}
```

---

## 5. Catalog Endpoint'leri

### 5.1. Product Group Ürünleri (Search ile)

**Endpoint:** `GET /catalog/product-groups/:productGroupId/products`

**Authentication:** Bearer Token gerekli

**Path Parameters:**
| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `productGroupId` | string | Evet | Product group ID'si (UUID) |

**Query Parameters:**
| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `search` | string | Hayır | Product adı, marka veya açıklamasında arama |

**Request Örnekleri:**

```http
# Tüm ürünler
GET /catalog/product-groups/550e8400-e29b-41d4-a716-446655440000/products

# Arama ile ürünler
GET /catalog/product-groups/550e8400-e29b-41d4-a716-446655440000/products?search=iphone
```

**Response (200):**

```json
[
  {
    "productId": "660e8400-e29b-41d4-a716-446655440001",
    "name": "iPhone 15 Pro",
    "image": "https://cdn.tipbox.co/products/iphone15pro.jpg",
    "productGroupId": "550e8400-e29b-41d4-a716-446655440000"
  },
  {
    "productId": "770e8400-e29b-41d4-a716-446655440002",
    "name": "iPhone 15",
    "image": "https://cdn.tipbox.co/products/iphone15.jpg",
    "productGroupId": "550e8400-e29b-41d4-a716-446655440000"
  }
]
```

---

## 6. User Report Endpoint

### 6.1. Kullanıcı Raporla

**Endpoint:** `POST /users/:id/report/:targetUserId`

**Authentication:** Bearer Token gerekli

**Path Parameters:**
| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `id` | string | Evet | Raporlayan kullanıcı ID'si (JWT token'daki userId ile eşleşmeli) |
| `targetUserId` | string | Evet | Raporlanacak kullanıcı ID'si |

**Request Body:**
```json
{
  "category": "SPAM",
  "description": "Spam mesajlar gönderiyor" // Opsiyonel, maksimum 500 karakter
}
```

**Category Değerleri:**
- `SPAM` - Spam
- `HARASSMENT` - Taciz
- `SCAM` - Dolandırıcılık
- `INAPPROPRIATE_CONTENT` - Uygunsuz İçerik
- `FAKE_ACCOUNT` - Sahte Hesap
- `OTHER` - Diğer

**Request Örnekleri:**

```http
POST /users/550e8400-e29b-41d4-a716-446655440000/report/660e8400-e29b-41d4-a716-446655440001
Content-Type: application/json
Authorization: Bearer {token}

{
  "category": "SPAM",
  "description": "Sürekli spam mesajlar gönderiyor"
}
```

**Response (201):**
```json
{
  "message": "Kullanıcı başarıyla raporlandı"
}
```

**Error Responses:**

```json
// 400 - Geçersiz kategori
{
  "message": "Geçersiz rapor kategorisi"
}

// 400 - Kendini raporlama
{
  "message": "Kendinizi raporlayamazsınız"
}

// 404 - Kullanıcı bulunamadı
{
  "message": "Raporlanan kullanıcı bulunamadı"
}

// 409 - Zaten raporlanmış
{
  "message": "Bu kullanıcı zaten raporlanmış. Her kullanıcı bir kullanıcı için sadece bir kez rapor gönderebilir."
}
```

---

## 📝 Genel Notlar

### Authentication
Tüm endpoint'ler (Explore events ve brands hariç) Bearer Token authentication gerektirir:
```http
Authorization: Bearer {jwt_token}
```

### Base URL
- **Development:** `http://localhost:3000`
- **Test:** `https://api-test.tipbox.co`
- **Production:** `https://api.tipbox.co`

### Error Response Format
Tüm hatalar standart format:
```json
{
  "success": false,
  "message": "Hata mesajı",
  "error": "Detaylı hata bilgisi (opsiyonel)"
}
```

### Pagination
Cursor-based pagination kullanılır:
- `cursor`: Son item'ın ID'si (string)
- `limit`: Sayfa başına item sayısı
- `hasMore`: Daha fazla item var mı? (boolean)

### Search Parametreleri
Tüm search parametreleri:
- Case-insensitive (büyük/küçük harf duyarsız)
- Partial match (kısmi eşleşme)
- Trim edilmiş (başında/sonunda boşluklar kaldırılır)

---

## 🔄 Değişiklik Özeti

### Yeni Eklenen Parametreler:

1. **Notifications:**
   - `type` - Bildirim tipi filtresi
   - `category` - Bildirim kategorisi filtresi

2. **Messages:**
   - `threadType` - Thread tipi filtresi (DM/SUPPORT/ALL)

3. **Users/Trusters:**
   - `sort` - Sıralama kriteri (name_asc, name_desc, date_asc, date_desc, trusted_first)

4. **Explore:**
   - `search` - Arama parametresi (hottest, events, brands)

5. **Catalog:**
   - `search` - Product arama parametresi

### Yeni Endpoint:

1. **User Report:**
   - `POST /users/:id/report/:targetUserId` - Kullanıcı raporlama

---

## 📱 Mobil Uygulama Entegrasyon Örnekleri

### React Native / TypeScript Örnekleri

```typescript
// Notification filtering
const getNotifications = async (category?: string, type?: string) => {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (type) params.append('type', type);
  
  const response = await fetch(
    `${API_BASE_URL}/notifications?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.json();
};

// Messages with threadType filter
const getMessages = async (threadType: 'DM' | 'SUPPORT' | 'ALL' = 'ALL') => {
  const response = await fetch(
    `${API_BASE_URL}/messages?threadType=${threadType}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  return response.json();
};

// Trusters with sort
const getTrusters = async (userId: string, sort: string = 'date_desc') => {
  const response = await fetch(
    `${API_BASE_URL}/users/${userId}/trusters?sort=${sort}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  return response.json();
};

// Explore search
const getHottestPosts = async (search?: string) => {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  
  const response = await fetch(
    `${API_BASE_URL}/explore/hottest?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  return response.json();
};

// Report user
const reportUser = async (targetUserId: string, category: string, description?: string) => {
  const response = await fetch(
    `${API_BASE_URL}/users/${currentUserId}/report/${targetUserId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        category,
        description,
      }),
    }
  );
  return response.json();
};
```

---

## ✅ Test Senaryoları

### 1. Notification Filtering
```bash
# Tüm bildirimler
curl -X GET "http://localhost:3000/notifications" \
  -H "Authorization: Bearer {token}"

# POST kategorisi
curl -X GET "http://localhost:3000/notifications?category=POST" \
  -H "Authorization: Bearer {token}"

# Belirli tip
curl -X GET "http://localhost:3000/notifications?type=NEW_MESSAGE" \
  -H "Authorization: Bearer {token}"
```

### 2. Messages Filtering
```bash
# Sadece DM mesajları
curl -X GET "http://localhost:3000/messages?threadType=DM" \
  -H "Authorization: Bearer {token}"

# Support mesajları
curl -X GET "http://localhost:3000/messages?threadType=SUPPORT" \
  -H "Authorization: Bearer {token}"
```

### 3. Trusters Sorting
```bash
# İsme göre A-Z
curl -X GET "http://localhost:3000/users/{userId}/trusters?sort=name_asc" \
  -H "Authorization: Bearer {token}"

# Trusted first
curl -X GET "http://localhost:3000/users/{userId}/trusters?sort=trusted_first" \
  -H "Authorization: Bearer {token}"
```

### 4. Explore Search
```bash
# Hottest posts search
curl -X GET "http://localhost:3000/explore/hottest?search=iphone" \
  -H "Authorization: Bearer {token}"

# Events search
curl -X GET "http://localhost:3000/explore/events?search=survey"
```

### 5. Catalog Search
```bash
# Product search
curl -X GET "http://localhost:3000/catalog/product-groups/{groupId}/products?search=iphone" \
  -H "Authorization: Bearer {token}"
```

### 6. User Report
```bash
curl -X POST "http://localhost:3000/users/{userId}/report/{targetUserId}" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "SPAM",
    "description": "Spam mesajlar gönderiyor"
  }'
```

---

**Son Güncelleme:** 2024-01-06
**Versiyon:** 1.0.0


