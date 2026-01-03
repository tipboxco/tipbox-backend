# Eksik Endpoint'ler - API Dokümantasyonu

Bu dokümantasyon, mobil uygulama için eksik endpoint'lerin request/response formatlarını içerir.

## 📋 İçindekiler

1. [Auth Endpoint'leri](#auth-endpointleri)
2. [Product Endpoint'leri](#product-endpointleri)
3. [Brand Endpoint'leri](#brand-endpointleri)
4. [Event Endpoint'leri](#event-endpointleri)
5. [News Endpoint'leri](#news-endpointleri)
6. [Wallet Endpoint'leri](#wallet-endpointleri)
7. [Search Endpoint'leri](#search-endpointleri)
8. [Payment Endpoint'leri](#payment-endpointleri)
9. [Rewards Endpoint'leri](#rewards-endpointleri)

---

## Auth Endpoint'leri

### 1. Kategori Seçimlerini Kaydet

**Endpoint:** `POST /auth/categories`

**Authentication:** Bearer Token gerekli

**Request:**
```http
POST /auth/categories
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "categoryIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Kategoriler başarıyla kaydedildi",
  "categories": [
    {
      "categoryId": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Elektronik"
    },
    {
      "categoryId": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Giyim"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request`: Geçersiz kategori ID'leri
- `401 Unauthorized`: Kimlik doğrulaması başarısız

---

### 2. Kullanıcının Seçtiği Kategorileri Getir

**Endpoint:** `GET /auth/categories`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /auth/categories
Authorization: Bearer {token}
```

**Response:**
```json
[
  {
    "categoryId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Elektronik",
    "image": "http://api-test.tipbox.co:9000/tipbox-media/categories/electronics.jpg"
  },
  {
    "categoryId": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Giyim",
    "image": "http://api-test.tipbox.co:9000/tipbox-media/categories/clothing.jpg"
  }
]
```

**Error Responses:**
- `401 Unauthorized`: Kimlik doğrulaması başarısız

---

## Product Endpoint'leri

### 3. Ürün Detay Bilgileri

**Endpoint:** `GET /products/{productId}`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /products/770e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {token}
```

**Path Parameters:**
- `productId` (string, UUID): Ürün ID'si

**Response:**
```json
{
  "productId": "770e8400-e29b-41d4-a716-446655440000",
  "name": "iPhone 15 Pro",
  "model": "A2848",
  "specs": "6.1 inch, A17 Pro, 128GB",
  "brand": {
    "brandId": "880e8400-e29b-41d4-a716-446655440001",
    "name": "Apple"
  },
  "image": "http://api-test.tipbox.co:9000/tipbox-media/products/iphone-15-pro.jpg",
  "stats": {
    "reviews": 1250,
    "likes": 3400,
    "shares": 890
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Kimlik doğrulaması başarısız
- `404 Not Found`: Ürün bulunamadı

---

### 4. Ürün Deneyim Paylaşımları

**Endpoint:** `GET /products/{productId}/posts?type=experience`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /products/770e8400-e29b-41d4-a716-446655440000/posts?type=experience&cursor=&limit=20
Authorization: Bearer {token}
```

**Query Parameters:**
- `type` (string, required): Post tipi (`experience`)
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional): Sayfa başına kayıt sayısı (varsayılan: 20, maksimum: 50)

**Response:**
```json
{
  "items": [
    {
      "type": "experience",
      "data": {
        "id": "990e8400-e29b-41d4-a716-446655440000",
        "user": {
          "id": "110e8400-e29b-41d4-a716-446655440000",
          "name": "Ahmet Yılmaz",
          "avatar": "http://api-test.tipbox.co:9000/tipbox-media/avatars/user1.jpg"
        },
        "content": [
          {
            "title": "Price and Shopping Experience",
            "content": "Ürünü çok uygun fiyata aldım...",
            "rating": 4
          },
          {
            "title": "Product and Usage Experience",
            "content": "Kullanım deneyimi harika...",
            "rating": 5
          }
        ],
        "stats": {
          "likes": 45,
          "comments": 12,
          "shares": 5,
          "bookmarks": 8
        },
        "createdAt": "2024-01-15T10:30:00Z"
      }
    }
  ],
  "pagination": {
    "cursor": "990e8400-e29b-41d4-a716-446655440000",
    "hasMore": true,
    "limit": 20
  }
}
```

**Error Responses:**
- `400 Bad Request`: Geçersiz query parametreleri
- `401 Unauthorized`: Kimlik doğrulaması başarısız
- `404 Not Found`: Ürün bulunamadı

---

### 5. Ürün Yorumları

**Endpoint:** `GET /products/{productId}/posts?type=comments`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /products/770e8400-e29b-41d4-a716-446655440000/posts?type=comments&cursor=&limit=20
Authorization: Bearer {token}
```

**Query Parameters:**
- `type` (string, required): Post tipi (`comments`)
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional): Sayfa başına kayıt sayısı (varsayılan: 20, maksimum: 50)

**Response:**
```json
{
  "items": [
    {
      "type": "post",
      "data": {
        "id": "aa0e8400-e29b-41d4-a716-446655440000",
        "user": {
          "id": "110e8400-e29b-41d4-a716-446655440000",
          "name": "Mehmet Demir",
          "avatar": "http://api-test.tipbox.co:9000/tipbox-media/avatars/user2.jpg"
        },
        "content": "Bu ürün gerçekten harika!",
        "stats": {
          "likes": 23,
          "comments": 5,
          "shares": 2,
          "bookmarks": 3
        },
        "createdAt": "2024-01-14T15:20:00Z"
      }
    }
  ],
  "pagination": {
    "cursor": "aa0e8400-e29b-41d4-a716-446655440000",
    "hasMore": false,
    "limit": 20
  }
}
```

---

### 6. Ürün Karşılaştırmaları

**Endpoint:** `GET /products/{productId}/posts?type=benchmark`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /products/770e8400-e29b-41d4-a716-446655440000/posts?type=benchmark&cursor=&limit=20
Authorization: Bearer {token}
```

**Query Parameters:**
- `type` (string, required): Post tipi (`benchmark`)
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional): Sayfa başına kayıt sayısı (varsayılan: 20, maksimum: 50)

**Response:**
```json
{
  "items": [
    {
      "type": "benchmark",
      "data": {
        "id": "bb0e8400-e29b-41d4-a716-446655440000",
        "user": {
          "id": "110e8400-e29b-41d4-a716-446655440000",
          "name": "Ayşe Kaya",
          "avatar": "http://api-test.tipbox.co:9000/tipbox-media/avatars/user3.jpg"
        },
        "products": [
          {
            "productId": "770e8400-e29b-41d4-a716-446655440000",
            "name": "iPhone 15 Pro",
            "isSelected": true
          },
          {
            "productId": "cc0e8400-e29b-41d4-a716-446655440001",
            "name": "Samsung Galaxy S24",
            "isSelected": false
          }
        ],
        "content": "İki ürünü karşılaştırdım...",
        "stats": {
          "likes": 67,
          "comments": 15,
          "shares": 8,
          "bookmarks": 12
        },
        "createdAt": "2024-01-13T09:15:00Z"
      }
    }
  ],
  "pagination": {
    "cursor": "bb0e8400-e29b-41d4-a716-446655440000",
    "hasMore": true,
    "limit": 20
  }
}
```

---

### 7. Ürün Haberleri

**Endpoint:** `GET /products/{productId}/news`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /products/770e8400-e29b-41d4-a716-446655440000/news?page=1&limit=12
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (number, optional): Sayfa numarası (varsayılan: 1)
- `limit` (number, optional): Sayfa başına kayıt sayısı (varsayılan: 12, maksimum: 50)

**Response:**
```json
[
  {
    "type": "post",
    "data": {
      "id": "dd0e8400-e29b-41d4-a716-446655440000",
      "user": {
        "id": "110e8400-e29b-41d4-a716-446655440000",
        "name": "Ali Veli",
        "avatar": "http://api-test.tipbox.co:9000/tipbox-media/avatars/user4.jpg"
      },
      "content": "Yeni özellikler eklendi...",
      "stats": {
        "likes": 89,
        "comments": 20,
        "shares": 10,
        "bookmarks": 15
      },
      "createdAt": "2024-01-12T14:00:00Z"
    }
  }
]
```

**Not:** Bu endpoint mevcut: `GET /brands/{brandId}/products/{productId}/news` - Aynı format kullanılabilir.

---

## Brand Endpoint'leri

### 8. Brand'e Ait Tüm Postlar

**Endpoint:** `GET /brands/{brandId}/posts`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /brands/880e8400-e29b-41d4-a716-446655440001/posts?cursor=&limit=20
Authorization: Bearer {token}
```

**Path Parameters:**
- `brandId` (string, UUID): Brand ID'si

**Query Parameters:**
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional): Sayfa başına kayıt sayısı (varsayılan: 20, maksimum: 50)

**Response:**
```json
{
  "items": [
    {
      "type": "post",
      "data": {
        "id": "ee0e8400-e29b-41d4-a716-446655440000",
        "user": {
          "id": "110e8400-e29b-41d4-a716-446655440000",
          "name": "Fatma Şahin",
          "avatar": "http://api-test.tipbox.co:9000/tipbox-media/avatars/user5.jpg"
        },
        "content": "Marka hakkında bir paylaşım...",
        "stats": {
          "likes": 34,
          "comments": 8,
          "shares": 4,
          "bookmarks": 6
        },
        "createdAt": "2024-01-11T11:45:00Z"
      }
    }
  ],
  "pagination": {
    "cursor": "ee0e8400-e29b-41d4-a716-446655440000",
    "hasMore": true,
    "limit": 20
  }
}
```

**Not:** Mevcut endpoint: `GET /brands/{brandId}/feed` - Benzer format kullanılabilir.

---

## Event Endpoint'leri

### 9. Event Detay Bilgileri

**Endpoint:** `GET /events/{eventId}`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /events/ff0e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {token}
```

**Path Parameters:**
- `eventId` (string, UUID): Event ID'si

**Response:**
```json
{
  "id": "ff0e8400-e29b-41d4-a716-446655440000",
  "title": "Yılbaşı Özel Etkinliği",
  "description": "Yılbaşına özel ödüller kazanın!",
  "type": "SURVEY",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z",
  "image": "http://api-test.tipbox.co:9000/tipbox-media/events/new-year-event.jpg",
  "status": "joined",
  "requirements": {
    "totalParticipated": 2,
    "requiredParticipated": 3,
    "progress": 66
  },
  "rewards": [
    {
      "id": "gg0e8400-e29b-41d4-a716-446655440000",
      "title": "100 TIPS",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/rewards/tips-100.jpg",
      "points": 100
    }
  ]
}
```

**Not:** Mevcut endpoint: `GET /brands/events/{eventId}` - Benzer format kullanılabilir.

---

### 10. Etkinliğe Katıl

**Endpoint:** `POST /events/{eventId}/join`

**Authentication:** Bearer Token gerekli

**Request:**
```http
POST /events/ff0e8400-e29b-41d4-a716-446655440000/join
Authorization: Bearer {token}
Content-Type: application/json
```

**Path Parameters:**
- `eventId` (string, UUID): Event ID'si

**Response:**
```json
{
  "success": true,
  "message": "Etkinliğe başarıyla katıldınız",
  "event": {
    "id": "ff0e8400-e29b-41d4-a716-446655440000",
    "status": "joined"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Etkinliğe zaten katılmışsınız veya etkinlik aktif değil
- `401 Unauthorized`: Kimlik doğrulaması başarısız
- `404 Not Found`: Event bulunamadı

---

### 11. Etkinlik Gereksinimleri ve İlerleme

**Endpoint:** `GET /events/{eventId}/requirements`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /events/ff0e8400-e29b-41d4-a716-446655440000/requirements
Authorization: Bearer {token}
```

**Path Parameters:**
- `eventId` (string, UUID): Event ID'si

**Response:**
```json
{
  "eventId": "ff0e8400-e29b-41d4-a716-446655440000",
  "requirements": [
    {
      "id": "hh0e8400-e29b-41d4-a716-446655440000",
      "title": "3 Anket Tamamla",
      "description": "3 farklı ankete katıl",
      "requiredCount": 3,
      "currentCount": 2,
      "completed": false,
      "progress": 66
    },
    {
      "id": "ii0e8400-e29b-41d4-a716-446655440001",
      "title": "5 Paylaşım Yap",
      "description": "5 paylaşım yap",
      "requiredCount": 5,
      "currentCount": 5,
      "completed": true,
      "progress": 100
    }
  ],
  "totalProgress": 83,
  "unlockedRewards": [
    {
      "id": "gg0e8400-e29b-41d4-a716-446655440000",
      "title": "100 TIPS",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/rewards/tips-100.jpg"
    }
  ]
}
```

---

## News Endpoint'leri

### 12. Haber Detay Bilgileri

**Endpoint:** `GET /news/{newsId}`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /news/jj0e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {token}
```

**Path Parameters:**
- `newsId` (string, UUID): Haber ID'si (post ID'si)

**Response:**
```json
{
  "id": "jj0e8400-e29b-41d4-a716-446655440000",
  "type": "post",
  "user": {
    "id": "110e8400-e29b-41d4-a716-446655440000",
    "name": "Zeynep Yıldız",
    "avatar": "http://api-test.tipbox.co:9000/tipbox-media/avatars/user6.jpg"
  },
  "content": "Yeni ürün lansmanı hakkında detaylı bilgi...",
  "images": [
    "http://api-test.tipbox.co:9000/tipbox-media/posts/news1.jpg"
  ],
  "stats": {
    "likes": 156,
    "comments": 32,
    "shares": 18,
    "bookmarks": 25
  },
  "createdAt": "2024-01-10T16:30:00Z",
  "updatedAt": "2024-01-10T16:30:00Z"
}
```

**Not:** Bu endpoint mevcut post endpoint'leri kullanılarak implement edilebilir: `GET /posts/{postId}`

---

## Wallet Endpoint'leri

### 13. Cüzdan Bakiyesi

**Endpoint:** `GET /wallet/balance`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /wallet/balance
Authorization: Bearer {token}
```

**Response:**
```json
{
  "balance": 1250.50,
  "currency": "TIPS",
  "locked": 100.00,
  "available": 1150.50
}
```

**Error Responses:**
- `401 Unauthorized`: Kimlik doğrulaması başarısız

**Not:** Mevcut endpoint: `GET /expert/balance` - Benzer format kullanılabilir.

---

### 14. İşlem Geçmişi

**Endpoint:** `GET /wallet/transactions`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /wallet/transactions?cursor=&limit=20
Authorization: Bearer {token}
```

**Query Parameters:**
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional): Sayfa başına kayıt sayısı (varsayılan: 20, maksimum: 50)

**Response:**
```json
{
  "items": [
    {
      "id": "kk0e8400-e29b-41d4-a716-446655440000",
      "type": "received",
      "amount": 50.00,
      "currency": "TIPS",
      "from": {
        "id": "110e8400-e29b-41d4-a716-446655440000",
        "name": "Ahmet Yılmaz"
      },
      "reason": "Post beğenisi",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": "ll0e8400-e29b-41d4-a716-446655440001",
      "type": "sent",
      "amount": 25.00,
      "currency": "TIPS",
      "to": {
        "id": "220e8400-e29b-41d4-a716-446655440002",
        "name": "Mehmet Demir"
      },
      "reason": "Expert sorusu",
      "createdAt": "2024-01-14T15:20:00Z"
    }
  ],
  "pagination": {
    "cursor": "ll0e8400-e29b-41d4-a716-446655440001",
    "hasMore": true,
    "limit": 20
  }
}
```

---

### 15. TIPS Gönder

**Endpoint:** `POST /wallet/send`

**Authentication:** Bearer Token gerekli

**Request:**
```http
POST /wallet/send
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "toUserId": "220e8400-e29b-41d4-a716-446655440002",
  "amount": 50.00,
  "reason": "Teşekkür etmek için"
}
```

**Response:**
```json
{
  "success": true,
  "message": "TIPS başarıyla gönderildi",
  "transaction": {
    "id": "mm0e8400-e29b-41d4-a716-446655440000",
    "type": "sent",
    "amount": 50.00,
    "currency": "TIPS",
    "to": {
      "id": "220e8400-e29b-41d4-a716-446655440002",
      "name": "Mehmet Demir"
    },
    "createdAt": "2024-01-15T11:00:00Z"
  },
  "newBalance": 1200.50
}
```

**Error Responses:**
- `400 Bad Request`: Yetersiz bakiye veya geçersiz miktar
- `401 Unauthorized`: Kimlik doğrulaması başarısız
- `404 Not Found`: Alıcı kullanıcı bulunamadı

---

### 16. TIPS Talep Et

**Endpoint:** `POST /wallet/claim`

**Authentication:** Bearer Token gerekli

**Request:**
```http
POST /wallet/claim
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "rewardId": "nn0e8400-e29b-41d4-a716-446655440000",
  "amount": 100.00
}
```

**Response:**
```json
{
  "success": true,
  "message": "TIPS başarıyla talep edildi",
  "transaction": {
    "id": "oo0e8400-e29b-41d4-a716-446655440000",
    "type": "claimed",
    "amount": 100.00,
    "currency": "TIPS",
    "reason": "Ödül talep",
    "createdAt": "2024-01-15T11:15:00Z"
  },
  "newBalance": 1300.50
}
```

**Error Responses:**
- `400 Bad Request`: Ödül zaten talep edilmiş veya geçersiz
- `401 Unauthorized`: Kimlik doğrulaması başarısız
- `404 Not Found`: Ödül bulunamadı

---

### 17. NFT Varlıkları

**Endpoint:** `GET /wallet/nft`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /wallet/nft?cursor=&limit=20
Authorization: Bearer {token}
```

**Query Parameters:**
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional): Sayfa başına kayıt sayısı (varsayılan: 20, maksimum: 50)

**Response:**
```json
{
  "items": [
    {
      "id": "pp0e8400-e29b-41d4-a716-446655440000",
      "name": "Tipbox Badge #1",
      "description": "İlk rozet",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/nft/badge-1.jpg",
      "tokenId": "0x1234567890abcdef",
      "contractAddress": "0xabcdef1234567890",
      "createdAt": "2024-01-10T10:00:00Z"
    }
  ],
  "pagination": {
    "cursor": "pp0e8400-e29b-41d4-a716-446655440000",
    "hasMore": false,
    "limit": 20
  }
}
```

---

### 18. NFT Detay Bilgileri

**Endpoint:** `GET /wallet/nft/{nftId}`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /wallet/nft/pp0e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {token}
```

**Path Parameters:**
- `nftId` (string, UUID): NFT ID'si

**Response:**
```json
{
  "id": "pp0e8400-e29b-41d4-a716-446655440000",
  "name": "Tipbox Badge #1",
  "description": "İlk rozet",
  "image": "http://api-test.tipbox.co:9000/tipbox-media/nft/badge-1.jpg",
  "tokenId": "0x1234567890abcdef",
  "contractAddress": "0xabcdef1234567890",
  "metadata": {
    "rarity": "common",
    "collection": "Tipbox Badges"
  },
  "createdAt": "2024-01-10T10:00:00Z"
}
```

---

## Search Endpoint'leri

### 19. Arama

**Endpoint:** `GET /search`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /search?keyword=iphone&types=user,brand,product&limit=10
Authorization: Bearer {token}
```

**Query Parameters:**
- `keyword` (string, required): Aranacak anahtar kelime
- `types` (string, optional): Virgülle ayrılmış arama tipleri (`user,brand,product`) - Boş/atlandığında hepsi
- `limit` (number, optional): Her tip için maksimum sonuç sayısı (varsayılan: 10, maksimum: 50)

**Response:**
```json
{
  "userData": [
    {
      "id": "110e8400-e29b-41d4-a716-446655440000",
      "name": "iPhone Kullanıcısı",
      "avatar": "http://api-test.tipbox.co:9000/tipbox-media/avatars/user1.jpg",
      "cosmetic": "Gold"
    }
  ],
  "brandData": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440001",
      "name": "Apple",
      "category": "Elektronik",
      "logo": "http://api-test.tipbox.co:9000/tipbox-media/brands/apple-logo.jpg"
    }
  ],
  "productData": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "name": "iPhone 15 Pro",
      "model": "A2848",
      "specs": "6.1 inch, A17 Pro, 128GB",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/products/iphone-15-pro.jpg"
    }
  ]
}
```

**Not:** Bu endpoint mevcut: `GET /search` - Aynı format kullanılabilir.

---

## Payment Endpoint'leri

### 20. Kayıtlı Kartları Listele

**Endpoint:** `GET /payment/cards`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /payment/cards
Authorization: Bearer {token}
```

**Response:**
```json
[
  {
    "id": "qq0e8400-e29b-41d4-a716-446655440000",
    "last4": "4242",
    "brand": "visa",
    "expMonth": 12,
    "expYear": 2025,
    "isDefault": true
  },
  {
    "id": "rr0e8400-e29b-41d4-a716-446655440001",
    "last4": "5555",
    "brand": "mastercard",
    "expMonth": 6,
    "expYear": 2026,
    "isDefault": false
  }
]
```

---

### 21. Yeni Kart Ekle

**Endpoint:** `POST /payment/cards`

**Authentication:** Bearer Token gerekli

**Request:**
```http
POST /payment/cards
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "cardNumber": "4242424242424242",
  "expMonth": 12,
  "expYear": 2025,
  "cvc": "123",
  "cardholderName": "Ahmet Yılmaz",
  "isDefault": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Kart başarıyla eklendi",
  "card": {
    "id": "ss0e8400-e29b-41d4-a716-446655440000",
    "last4": "4242",
    "brand": "visa",
    "expMonth": 12,
    "expYear": 2025,
    "isDefault": false
  }
}
```

**Error Responses:**
- `400 Bad Request`: Geçersiz kart bilgileri
- `401 Unauthorized`: Kimlik doğrulaması başarısız

---

### 22. Kart Sil

**Endpoint:** `DELETE /payment/cards/{cardId}`

**Authentication:** Bearer Token gerekli

**Request:**
```http
DELETE /payment/cards/qq0e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {token}
```

**Path Parameters:**
- `cardId` (string, UUID): Kart ID'si

**Response:**
```json
{
  "success": true,
  "message": "Kart başarıyla silindi"
}
```

**Error Responses:**
- `401 Unauthorized`: Kimlik doğrulaması başarısız
- `404 Not Found`: Kart bulunamadı

---

### 23. Faturalama Geçmişi

**Endpoint:** `GET /payment/billing-history`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /payment/billing-history?cursor=&limit=20
Authorization: Bearer {token}
```

**Query Parameters:**
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional): Sayfa başına kayıt sayısı (varsayılan: 20, maksimum: 50)

**Response:**
```json
{
  "items": [
    {
      "id": "tt0e8400-e29b-41d4-a716-446655440000",
      "amount": 99.99,
      "currency": "TRY",
      "description": "Premium Abonelik",
      "status": "completed",
      "date": "2024-01-15T10:00:00Z",
      "invoiceUrl": "http://api-test.tipbox.co/invoices/tt0e8400-e29b-41d4-a716-446655440000.pdf"
    }
  ],
  "pagination": {
    "cursor": "tt0e8400-e29b-41d4-a716-446655440000",
    "hasMore": false,
    "limit": 20
  }
}
```

---

### 24. Bağlı Ödeme Yöntemi

**Endpoint:** `GET /payment/method`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /payment/method
Authorization: Bearer {token}
```

**Response:**
```json
{
  "method": "card",
  "card": {
    "id": "qq0e8400-e29b-41d4-a716-446655440000",
    "last4": "4242",
    "brand": "visa",
    "expMonth": 12,
    "expYear": 2025
  }
}
```

---

## Rewards Endpoint'leri

### 25. Tüm Ödülleri Listele

**Endpoint:** `GET /rewards`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /rewards?cursor=&limit=20
Authorization: Bearer {token}
```

**Query Parameters:**
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional): Sayfa başına kayıt sayısı (varsayılan: 20, maksimum: 50)

**Response:**
```json
{
  "items": [
    {
      "id": "uu0e8400-e29b-41d4-a716-446655440000",
      "title": "100 TIPS",
      "description": "100 TIPS kazanın",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/rewards/tips-100.jpg",
      "points": 100,
      "type": "tips",
      "isClaimed": false
    },
    {
      "id": "vv0e8400-e29b-41d4-a716-446655440001",
      "title": "Özel Rozet",
      "description": "Özel rozet kazanın",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/rewards/badge-special.jpg",
      "points": 500,
      "type": "badge",
      "isClaimed": true
    }
  ],
  "pagination": {
    "cursor": "vv0e8400-e29b-41d4-a716-446655440001",
    "hasMore": true,
    "limit": 20
  }
}
```

**Not:** Mevcut endpoint: `GET /events/achievements` - Benzer format kullanılabilir.

---

### 26. Ödül Detay Bilgileri

**Endpoint:** `GET /rewards/{rewardId}`

**Authentication:** Bearer Token gerekli

**Request:**
```http
GET /rewards/uu0e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {token}
```

**Path Parameters:**
- `rewardId` (string, UUID): Ödül ID'si

**Response:**
```json
{
  "id": "uu0e8400-e29b-41d4-a716-446655440000",
  "title": "100 TIPS",
  "description": "100 TIPS kazanın",
  "image": "http://api-test.tipbox.co:9000/tipbox-media/rewards/tips-100.jpg",
  "points": 100,
  "type": "tips",
  "requirements": [
    {
      "id": "ww0e8400-e29b-41d4-a716-446655440000",
      "title": "10 Post Paylaş",
      "description": "10 farklı post paylaş",
      "requiredCount": 10,
      "currentCount": 7,
      "completed": false,
      "progress": 70
    }
  ],
  "isClaimed": false,
  "claimedAt": null
}
```

---

## 📝 Notlar

1. **Authentication:** Tüm endpoint'ler Bearer Token ile kimlik doğrulaması gerektirir.
2. **Base URL:** Development: `http://localhost:3000`, Test: `https://api-test.tipbox.co`, Production: `https://api.tipbox.co`
3. **Pagination:** Cursor-based pagination kullanılır. `cursor` parametresi bir sonraki sayfa için kullanılır.
4. **Error Format:** Tüm hatalar aşağıdaki formatta döner:
   ```json
   {
     "success": false,
     "message": "Hata mesajı",
     "code": "ERROR_CODE"
   }
   ```
5. **Date Format:** Tüm tarihler ISO 8601 formatında (`YYYY-MM-DDTHH:mm:ssZ`) döner.

---

## 🔄 Mevcut Endpoint'lerle İlişkiler

Bazı endpoint'ler mevcut endpoint'ler kullanılarak implement edilebilir:

- `GET /products/{productId}/posts?type=experience` → `GET /brands/{brandId}/products/{productId}/experiences` (mevcut)
- `GET /products/{productId}/news` → `GET /brands/{brandId}/products/{productId}/news` (mevcut)
- `GET /brands/{brandId}/posts` → `GET /brands/{brandId}/feed` (mevcut)
- `GET /events/{eventId}` → `GET /brands/events/{eventId}` (mevcut)
- `GET /wallet/balance` → `GET /expert/balance` (mevcut, format farklı)
- `GET /search` → Mevcut (aynı format)



