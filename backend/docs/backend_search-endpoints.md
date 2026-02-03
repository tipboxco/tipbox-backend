# Backend Search Endpoints - Mobile API Dokümantasyonu

Bu dokümantasyon, backend'deki tüm search endpoint'lerini request-response formatında içermektedir.

---

## 1. Genel Arama (User, Brand, Product)

**Endpoint:** `GET /search`

**Authentication:** Gerekli değil

**Request:**
```http
GET /search?keyword=iphone&types=user,brand,product&limit=10
```

**Query Parameters:**
- `keyword` (string, optional): Aranacak anahtar kelime. Boş/atlandığında default veriler döner (4'er adet user, brand, product)
- `types` (string, optional): Virgülle ayrılmış arama tipleri (`user,brand,product`). Boş/atlandığında hepsi.
- `limit` (integer, optional, default: 10, max: 50): Her tip için döndürülecek maksimum sonuç sayısı (sadece keyword verildiğinde geçerli). Default mode'da her zaman 4 döner.

**Response (200):**
```json
{
  "userData": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe",
      "avatar": "http://api-test.tipbox.co:9000/tipbox-media/avatars/user-avatar.jpg",
      "cosmetic": "Expert"
    }
  ],
  "brandData": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Apple",
      "category": "Electronics",
      "logo": "http://api-test.tipbox.co:9000/tipbox-media/brands/apple-logo.jpg"
    }
  ],
  "productData": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "name": "iPhone 15 Pro",
      "model": "Apple",
      "specs": "6.1 inch, A17 Pro, 128GB",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/products/iphone-15-pro.jpg"
    }
  ]
}
```

**Arama Alanları:**
- **User**: email, displayName, userName
- **Brand**: name, category, description
- **Product**: name, brand, description

---

## 2. Product Catalog Search

**Endpoint:** `GET /catalog/product-groups/:productGroupId/products`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /catalog/product-groups/880e8400-e29b-41d4-a716-446655440001/products?search=iphone
Authorization: Bearer {token}
```

**Path Parameters:**
- `productGroupId` (string, UUID): Product group ID'si

**Query Parameters:**
- `search` (string, optional): Product name, brand veya description'da arama

**Response (200):**
```json
[
  {
    "productId": "770e8400-e29b-41d4-a716-446655440000",
    "name": "iPhone 15 Pro",
    "image": "http://api-test.tipbox.co:9000/tipbox-media/products/iphone-15-pro.jpg",
    "productGroupId": "880e8400-e29b-41d4-a716-446655440001"
  }
]
```

**Arama Alanları:**
- Product name
- Brand
- Description

---

## 3. Events Search

**Endpoint:** `GET /explore/events`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /explore/events?search=survey&cursor=&limit=20
Authorization: Bearer {token}
```

**Query Parameters:**
- `search` (string, optional): Event başlığı veya açıklamasında arama
- `cursor` (string, optional): Pagination cursor
- `limit` (integer, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "eventId": "990e8400-e29b-41d4-a716-446655440003",
      "eventType": "SURVEY",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/events/event-image.jpg",
      "title": "Product Survey",
      "description": "Share your opinion about our products",
      "startDate": "2024-01-15T10:30:00.000Z",
      "endDate": "2024-02-15T10:30:00.000Z",
      "interaction": 150,
      "participants": [
        {
          "userId": "550e8400-e29b-41d4-a716-446655440000",
          "avatar": "http://api-test.tipbox.co:9000/tipbox-media/avatars/user-avatar.jpg",
          "userName": "johndoe"
        }
      ]
    }
  ],
  "pagination": {
    "cursor": "990e8400-e29b-41d4-a716-446655440003",
    "hasMore": true,
    "limit": 20
  }
}
```

**Arama Alanları:**
- Event title
- Event description

---

## 4. Support Requests Search

**Endpoint:** `GET /messages/support-requests`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /messages/support-requests?search=help&status=active&limit=50
Authorization: Bearer {token}
```

**Query Parameters:**
- `search` (string, optional): Kullanıcı adı, unvanı veya istek açıklamasında arama
- `status` (string, optional): Destek sohbetlerinin durumuna göre filtreleme (`pending`, `active`, `awaiting_completion`, `completed`, `finalized`, `reported`)
- `limit` (integer, optional, default: 50, max: 100): Döndürülecek maksimum destek sohbeti sayısı

**Response (200):**
```json
[
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440004",
    "userName": "John Doe",
    "userTitle": "Expert",
    "userAvatar": "http://api-test.tipbox.co:9000/tipbox-media/avatars/user-avatar.jpg",
    "requestDescription": "I need help with my product",
    "status": "active",
    "threadId": "bb0e8400-e29b-41d4-a716-446655440005"
  }
]
```

**Arama Alanları:**
- User name
- User title
- Request description

---

## 5. Messages/Threads Search

**Endpoint:** `GET /messages`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /messages?search=john&unreadOnly=false&threadType=ALL&limit=50
Authorization: Bearer {token}
```

**Query Parameters:**
- `search` (string, optional): Sender name veya last message'da arama
- `unreadOnly` (boolean, optional, default: false): Sadece okunmamış mesajları getir
- `threadType` (string, optional, default: `ALL`): Thread tipi (`DM`, `SUPPORT`, `ALL`)
- `limit` (integer, optional, default: 50, max: 100): Maksimum thread sayısı

**Response (200):**
```json
{
  "threads": [
    {
      "threadId": "cc0e8400-e29b-41d4-a716-446655440006",
      "sender": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "John Doe",
        "avatar": "http://api-test.tipbox.co:9000/tipbox-media/avatars/user-avatar.jpg"
      },
      "lastMessage": "Hello, how can I help you?",
      "isUnread": false,
      "isSupportThread": false
    }
  ]
}
```

**Arama Alanları:**
- Sender name
- Last message

---

## 6. Explore - Hottest Posts Search

**Endpoint:** `GET /explore/hottest`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /explore/hottest?search=review&cursor=&limit=20
Authorization: Bearer {token}
```

**Query Parameters:**
- `search` (string, optional): Post başlığı veya içeriğinde arama
- `cursor` (string, optional): Pagination cursor
- `limit` (integer, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "type": "feed",
      "data": {
        "id": "dd0e8400-e29b-41d4-a716-446655440007",
        "title": "Product Review",
        "body": "This is a great product...",
        "user": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "name": "John Doe",
          "avatar": "http://api-test.tipbox.co:9000/tipbox-media/avatars/user-avatar.jpg"
        }
      }
    }
  ],
  "pagination": {
    "cursor": "dd0e8400-e29b-41d4-a716-446655440007",
    "hasMore": true,
    "limit": 20
  }
}
```

**Arama Alanları:**
- Post title
- Post body

---

## 7. Explore - Brands Search

**Endpoint:** `GET /explore/brands/new`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /explore/brands/new?search=apple&cursor=&limit=20
Authorization: Bearer {token}
```

**Query Parameters:**
- `search` (string, optional): Marka adında arama
- `cursor` (string, optional): Pagination cursor
- `limit` (integer, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "brandId": "660e8400-e29b-41d4-a716-446655440001",
      "images": "http://api-test.tipbox.co:9000/tipbox-media/brands/apple-logo.jpg",
      "title": "Apple",
      "description": "Technology company"
    }
  ],
  "pagination": {
    "cursor": "660e8400-e29b-41d4-a716-446655440001",
    "hasMore": false,
    "limit": 20
  }
}
```

**Arama Alanları:**
- Brand name

---

## 8. Marketplace - NFT Listings Search

**Endpoint:** `GET /marketplace/listings`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /marketplace/listings?search=badge&type=BADGE&rarity=RARE&minPrice=10&maxPrice=100&orderBy=price_asc&limit=50&cursor=
Authorization: Bearer {token}
```

**Query Parameters:**
- `search` (string, optional): NFT name veya description'da arama
- `type` (string, optional): NFT tipi (`BADGE`, `COSMETIC`, `LOOTBOX`)
- `rarity` (string, optional): NFT rarity (`COMMON`, `RARE`, `EPIC`)
- `minPrice` (number, optional): Minimum fiyat
- `maxPrice` (number, optional): Maksimum fiyat
- `orderBy` (string, optional): Sıralama (`price_asc`, `price_desc`, `listedAt_desc`, `listedAt_asc`)
- `limit` (integer, optional, default: 50, max: 100): Sayfa başına item sayısı
- `cursor` (string, optional): Pagination cursor

**Response (200):**
```json
{
  "items": [
    {
      "id": "ee0e8400-e29b-41d4-a716-446655440008",
      "title": "Rare Badge",
      "username": "johndoe",
      "price": "50.00",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/nfts/badge.jpg",
      "userAvatar": "http://api-test.tipbox.co:9000/tipbox-media/avatars/user-avatar.jpg"
    }
  ],
  "pagination": {
    "cursor": "ee0e8400-e29b-41d4-a716-446655440008",
    "hasMore": true,
    "limit": 50
  }
}
```

**Arama Alanları:**
- NFT name
- NFT description

---

## 9. User - Trusted Users Search

**Endpoint:** `GET /users/:id/trusters`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /users/550e8400-e29b-41d4-a716-446655440000/trusters?q=john&search=john
Authorization: Bearer {token}
```

**Path Parameters:**
- `id` (string, UUID): User ID'si

**Query Parameters:**
- `q` (string, optional): Arama terimi (alternatif: `search`)
- `search` (string, optional): Arama terimi (alternatif: `q`)

**Response (200):**
```json
[
  {
    "userId": "ff0e8400-e29b-41d4-a716-446655440009",
    "displayName": "John Doe",
    "userName": "johndoe",
    "avatar": "http://api-test.tipbox.co:9000/tipbox-media/avatars/user-avatar.jpg",
    "title": "Expert"
  }
]
```

**Arama Alanları:**
- Display name
- User name

---

## 10. User - Achievement Badges Search

**Endpoint:** `GET /users/:id/collections/achievements`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /users/550e8400-e29b-41d4-a716-446655440000/collections/achievements?q=expert&search=expert&cursor=&limit=20
Authorization: Bearer {token}
```

**Path Parameters:**
- `id` (string, UUID): User ID'si

**Query Parameters:**
- `q` (string, optional): Arama terimi (alternatif: `search`)
- `search` (string, optional): Arama terimi (alternatif: `q`)
- `cursor` (string, optional): Pagination cursor
- `limit` (integer, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "badgeId": "110e8400-e29b-41d4-a716-446655440010",
      "name": "Expert Badge",
      "description": "Achieved expert status",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/badges/expert-badge.jpg",
      "earnedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "cursor": "110e8400-e29b-41d4-a716-446655440010",
    "hasMore": false,
    "limit": 20
  }
}
```

**Arama Alanları:**
- Badge name
- Badge description

---

## 11. User - Bridge Badges Search

**Endpoint:** `GET /users/:id/collections/bridges`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /users/550e8400-e29b-41d4-a716-446655440000/collections/bridges?q=bridge&search=bridge&cursor=&limit=20
Authorization: Bearer {token}
```

**Path Parameters:**
- `id` (string, UUID): User ID'si

**Query Parameters:**
- `q` (string, optional): Arama terimi (alternatif: `search`)
- `search` (string, optional): Arama terimi (alternatif: `q`)
- `cursor` (string, optional): Pagination cursor
- `limit` (integer, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):** Badge tablosundaki `type` alanına göre gruplanmış; `BRAND` olanlar `brand.items`, diğerleri `achievement.items` içinde (Tab Page yapısı için).

```json
{
  "brand": {
    "items": [
      {
        "id": "220e8400-e29b-41d4-a716-446655440011",
        "title": "Bridge Ambassador",
        "image": "http://api-test.tipbox.co:9000/tipbox-media/badges/bridge-badge.jpg",
        "rarity": "Rare",
        "isClaimed": true,
        "nftAddress": null,
        "totalEarned": 3,
        "earnedDate": "2024-01-15T10:30:00.000Z",
        "tasks": []
      }
    ]
  },
  "achievement": {
    "items": [
      {
        "id": "330e8400-e29b-41d4-a716-446655440012",
        "title": "Expert Badge",
        "image": "http://api-test.tipbox.co:9000/tipbox-media/badges/expert.png",
        "rarity": "Epic",
        "isClaimed": true,
        "nftAddress": null,
        "totalEarned": 1,
        "earnedDate": "2024-02-10T10:30:00.000Z",
        "tasks": [{ "id": "goal-1", "title": "10 Yorum Yap", "type": "Comment" }]
      }
    ]
  },
  "pagination": {
    "cursor": "330e8400-e29b-41d4-a716-446655440012",
    "hasMore": false,
    "limit": 20
  }
}
```

**Arama Alanları:**
- Badge name

---

## 12. Notification Messages Search

**Endpoint:** `GET /notifications`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /notifications?search=comment&limit=20&offset=0&unreadOnly=false
Authorization: Bearer {token}
```

**Query Parameters:**
- `search` (string, optional): Notification title ve message'da arama
- `limit` (integer, optional, default: 20): Sayfa başına notification sayısı
- `offset` (integer, optional, default: 0): Atlanacak notification sayısı
- `unreadOnly` (boolean, optional, default: false): Sadece okunmamış notification'ları getir
- `type` (string, optional): Notification tipi (örn: `POST_LIKED`, `NEW_MESSAGE`, `NEW_TRUSTER`)
- `category` (string, optional): Notification kategorisi (`POST`, `TRUST`, `MESSAGE`, `SUPPORT`, `COLLECTION`, `GAMIFICATION`, `EXPERT`, `EVENT`, `SYSTEM`)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "330e8400-e29b-41d4-a716-446655440012",
      "type": "COMMENT_REPLIED",
      "title": "New Comment",
      "message": "John Doe replied to your comment",
      "data": {},
      "read": false,
      "readAt": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 50,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

**Arama Alanları:**
- Notification title
- Notification message

---

## 13. Content Posts Search

**Endpoint:** `GET /posts/search`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /posts/search?q=review&cursor=&limit=20
Authorization: Bearer {token}
```

**Query Parameters:**
- `q` (string, required): Arama terimi
- `cursor` (string, optional): Pagination cursor
- `limit` (integer, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "type": "feed",
      "data": {
        "id": "440e8400-e29b-41d4-a716-446655440013",
        "title": "Product Review",
        "body": "This is a comprehensive review...",
        "user": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "name": "John Doe",
          "avatar": "http://api-test.tipbox.co:9000/tipbox-media/avatars/user-avatar.jpg"
        },
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    }
  ],
  "pagination": {
    "cursor": "440e8400-e29b-41d4-a716-446655440013",
    "hasMore": true,
    "limit": 20
  }
}
```

**Arama Alanları:**
- Post title
- Post body

---

## 14. Product Experiences Search

**Endpoint:** `GET /inventory/experiences/search`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /inventory/experiences/search?q=great product&cursor=&limit=20
Authorization: Bearer {token}
```

**Query Parameters:**
- `q` (string, required): Arama terimi
- `cursor` (string, optional): Pagination cursor
- `limit` (integer, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440014",
      "title": "Price and Shopping Experience (5/5)",
      "experienceText": "Great product, excellent value for money",
      "inventory": {
        "id": "660e8400-e29b-41d4-a716-446655440015",
        "product": {
          "id": "770e8400-e29b-41d4-a716-446655440002",
          "name": "iPhone 15 Pro"
        },
        "user": {
          "id": "550e8400-e29b-41d4-a716-446655440000"
        }
      },
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "cursor": "550e8400-e29b-41d4-a716-446655440014",
    "hasMore": false,
    "limit": 20
  }
}
```

**Arama Alanları:**
- Experience title
- Experience text

---

## Özet Tablo

| # | Endpoint | Search Param | Arama Alanları | Auth |
|---|----------|--------------|----------------|------|
| 1 | `GET /search` | `keyword` | User (email, name), Brand (name, category), Product (name, brand) | ❌ |
| 2 | `GET /catalog/product-groups/:id/products` | `search` | Product name, brand, description | ✅ |
| 3 | `GET /explore/events` | `search` | Event title, description | ✅ |
| 4 | `GET /messages/support-requests` | `search` | User name, title, request description | ✅ |
| 5 | `GET /messages` | `search` | Sender name, last message | ✅ |
| 6 | `GET /explore/hottest` | `search` | Post title, body | ✅ |
| 7 | `GET /explore/brands/new` | `search` | Brand name | ✅ |
| 8 | `GET /marketplace/listings` | `search` | NFT name, description | ✅ |
| 9 | `GET /users/:id/trusters` | `q` veya `search` | Display name, user name | ✅ |
| 10 | `GET /users/:id/collections/achievements` | `q` veya `search` | Badge name, description | ✅ |
| 11 | `GET /users/:id/collections/bridges` | `q` veya `search` | Badge name | ✅ |
| 12 | `GET /notifications` | `search` | Notification title, message | ✅ |
| 13 | `GET /posts/search` | `q` | Post title, body | ✅ |
| 14 | `GET /inventory/experiences/search` | `q` | Experience title, text | ✅ |

---

## Notlar

1. **Case-Insensitive Search**: Tüm aramalar case-insensitive (büyük/küçük harf duyarsız) yapılmaktadır.

2. **Pagination**: Çoğu endpoint cursor-based pagination kullanır. `cursor` parametresi bir sonraki sayfa için kullanılır.

3. **Limit Constraints**: Her endpoint'in kendi limit kısıtlamaları vardır. Genellikle default 20, maksimum 50-100 arası değişir.

4. **Authentication**: Çoğu endpoint Bearer Token gerektirir. Sadece genel search endpoint'i (`/search`) authentication gerektirmez.

5. **Search Parameter Names**: Bazı endpoint'ler `search`, bazıları `q`, bazıları `keyword` parametresi kullanır. Her endpoint'in dokümantasyonuna bakınız.

---

## Error Responses

Tüm endpoint'ler için ortak error response'lar:

**401 Unauthorized:**
```json
{
  "message": "Unauthorized"
}
```

**400 Bad Request:**
```json
{
  "message": "Invalid request parameters"
}
```

**500 Internal Server Error:**
```json
{
  "message": "Internal server error"
}
```

