# Tipbox API - Kapsamlı Endpoint Dokümantasyonu

Bu dokümantasyon, Tipbox backend API'sinin tüm endpoint'lerini detaylı request/response formatlarıyla içerir. Hem backend hem mobil uygulama geliştiricileri için hazırlanmıştır.

## 📋 İçindekiler

1. [Authentication](#1-authentication)
2. [User Management](#2-user-management)
3. [Wallet](#3-wallet)
4. [Feed](#4-feed)
5. [Post](#5-post)
6. [Interaction](#6-interaction)
7. [Messaging](#7-messaging)
8. [Inventory](#8-inventory)
9. [Marketplace](#9-marketplace)
10. [Explore](#10-explore)
11. [Expert](#11-expert)
12. [Event](#12-event)
13. [Search](#13-search)
14. [Notification](#14-notification)
15. [Catalog](#15-catalog)
16. [Brand](#16-brand)
17. [Cache (Admin)](#17-cache-admin)
18. [Dashboard (Admin)](#18-dashboard-admin)

---

## Genel Bilgiler

### Base URL
- **Development:** `http://localhost:3000`
- **Test:** `https://api-test.tipbox.co`
- **Production:** `https://api.tipbox.co`

### Authentication
Çoğu endpoint Bearer Token authentication gerektirir:
```http
Authorization: Bearer {jwt_token}
```

### Response Format
Tüm endpoint'ler JSON formatında response döner. Standart response formatı:
```json
{
  "success": true,
  "data": { ... },
  "message": "İşlem başarılı"
}
```

### Error Response Format
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
- `limit`: Sayfa başına item sayısı (1-50 arası, default: 20)
- `hasMore`: Daha fazla item var mı? (boolean)

---

## 1. Authentication

### 1.1. Kullanıcı Girişi

**Endpoint:** `POST /auth/login`

**Authentication:** Gerekli değil

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "id": 1,
  "fullName": "Ömer Faruk",
  "email": "user@example.com",
  "avatar": "http://api-test.tipbox.co:9000/tipbox-media/profile-pictures/1/uuid.jpg",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400`: Geçersiz istek formatı
- `401`: Geçersiz email/şifre veya email doğrulanmamış

---

### 1.2. Kullanıcı Kaydı

**Endpoint:** `POST /auth/register`

**Authentication:** Gerekli değil

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "Ömer Faruk"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Kayıt başarılı. Email doğrulama kodu gönderildi."
}
```

**Error Responses:**
- `400`: Geçersiz istek formatı
- `409`: Email zaten kayıtlı
- `500`: Email gönderilemedi

---

### 1.3. Email Doğrulama

**Endpoint:** `POST /auth/verify-email`

**Authentication:** Gerekli değil

**Request:**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Email doğrulama başarılı"
}
```

**Error Responses:**
- `400`: Geçersiz istek formatı
- `404`: Geçersiz veya süresi dolmuş kod

---

### 1.4. Kullanıcı Bilgilerini Getir

**Endpoint:** `GET /auth/me`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "Ömer Faruk",
  "status": "ACTIVE",
  "auth0Id": null,
  "walletAddress": null,
  "kycStatus": "VERIFIED",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

---

### 1.5. Şifre Sıfırlama Kodu Gönder

**Endpoint:** `POST /auth/forgot-password`

**Authentication:** Gerekli değil

**Request:**
```json
{
  "mail": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Şifre sıfırlama kodu gönderildi."
}
```

---

### 1.6. Şifre Sıfırlama Kodunu Doğrula

**Endpoint:** `POST /auth/verify-reset-code`

**Authentication:** Gerekli değil

**Request:**
```json
{
  "mail": "user@example.com",
  "code": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Kod doğrulandı. Yeni şifrenizi oluşturabilirsiniz."
}
```

---

### 1.7. Şifreyi Sıfırla

**Endpoint:** `POST /auth/reset-password`

**Authentication:** Gerekli değil

**Request:**
```json
{
  "email": "user@example.com",
  "password": "newpassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Şifre başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz."
}
```

---

### 1.8. Kullanıcı Çıkışı

**Endpoint:** `POST /auth/logout`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "success": true,
  "message": "Çıkış yapıldı"
}
```

---

## 2. User Management

### 2.1. Profil Bilgilerini Getir (Self)

**Endpoint:** `GET /users/me/profile`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Ömer Faruk",
  "avatarUrl": "http://api-test.tipbox.co:9000/tipbox-media/profile-pictures/1/uuid.jpg",
  "bannerUrl": "http://api-test.tipbox.co:9000/tipbox-media/banners/1/uuid.jpg",
  "biography": "Kullanıcı biyografisi",
  "titles": ["Expert", "Reviewer"],
  "stats": {
    "posts": 42,
    "trust": 150,
    "truster": 75
  },
  "badges": [
    {
      "id": "badge-1",
      "title": "First Post",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/badges/first-post.jpg"
    }
  ],
  "cosmetics": {
    "activeBadge": {
      "id": "badge-1",
      "title": "First Post",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/badges/first-post.jpg"
    },
    "activeBanner": {
      "id": "banner-1",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/banners/banner-1.jpg"
    }
  },
  "isTrusted": true
}
```

---

### 2.2. Profil Bilgilerini Güncelle

**Endpoint:** `PUT /users/me/profile`

**Authentication:** Bearer Token gerekli

**Request (multipart/form-data veya JSON):**
```json
{
  "displayName": "Yeni İsim",
  "biography": "Yeni biyografi",
  "titles": ["Expert", "Reviewer"]
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Profil güncellendi",
  "data": { ... }
}
```

---

### 2.3. Avatar Yükle

**Endpoint:** `POST /users/me/avatar`

**Authentication:** Bearer Token gerekli

**Request:** multipart/form-data
- `avatar`: Image file (JPG, PNG, GIF, WebP, HEIC)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "avatarUrl": "http://api-test.tipbox.co:9000/tipbox-media/profile-pictures/1/uuid.jpg"
  }
}
```

---

### 2.4. Banner Yükle

**Endpoint:** `POST /users/me/banner`

**Authentication:** Bearer Token gerekli

**Request:** multipart/form-data
- `banner`: Image file (JPG, PNG, GIF, WebP, HEIC)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "bannerUrl": "http://api-test.tipbox.co:9000/tipbox-media/banners/1/uuid.jpg"
  }
}
```

---

### 2.5. Kullanıcı Profilini Getir (Public)

**Endpoint:** `GET /users/:userId/profile`

**Authentication:** Bearer Token gerekli

**Path Parameters:**
- `userId` (string, UUID): Kullanıcı ID'si

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Ömer Faruk",
  "avatarUrl": "http://api-test.tipbox.co:9000/tipbox-media/profile-pictures/1/uuid.jpg",
  "bannerUrl": "http://api-test.tipbox.co:9000/tipbox-media/banners/1/uuid.jpg",
  "biography": "Kullanıcı biyografisi",
  "titles": ["Expert", "Reviewer"],
  "stats": {
    "posts": 42,
    "trust": 150,
    "truster": 75
  },
  "badges": [ ... ],
  "cosmetics": { ... },
  "isTrusted": true,
  "isFollowing": false
}
```

---

### 2.6. Kullanıcı Feed'ini Getir

**Endpoint:** `GET /users/:userId/feed`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional, default: 20): Sayfa başına item sayısı
- `types` (string, optional): Filtreleme için post tipleri (virgülle ayrılmış: `post,benchmark,question`)

**Response (200):**
```json
{
  "items": [
    {
      "type": "feed",
      "data": {
        "id": "post-1",
        "type": "post",
        "user": { ... },
        "content": "Post içeriği",
        "stats": { ... },
        "createdAt": "2024-01-15T10:30:00.000Z"
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

---

## 3. Wallet

### 3.1. Kullanıcı Cüzdanlarını Listele

**Endpoint:** `GET /wallets`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
[
  {
    "id": "wallet-1",
    "userId": "user-1",
    "publicAddress": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
    "provider": "METAMASK",
    "isConnected": true,
    "shortAddress": "0x742d...4d8b6",
    "providerIcon": "https://example.com/metamask-icon.png",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
]
```

---

### 3.2. Aktif Cüzdanı Getir

**Endpoint:** `GET /wallets/active`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "id": "wallet-1",
  "userId": "user-1",
  "publicAddress": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
  "provider": "METAMASK",
  "isConnected": true,
  "shortAddress": "0x742d...4d8b6",
  "providerIcon": "https://example.com/metamask-icon.png",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**Error Responses:**
- `404`: Aktif cüzdan bulunamadı

---

### 3.3. Cüzdan Bağla

**Endpoint:** `POST /wallets/connect`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "publicAddress": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
  "provider": "METAMASK"
}
```

**Response (201):**
```json
{
  "id": "wallet-1",
  "userId": "user-1",
  "publicAddress": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
  "provider": "METAMASK",
  "isConnected": true,
  "shortAddress": "0x742d...4d8b6",
  "providerIcon": "https://example.com/metamask-icon.png",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

---

### 3.4. Cüzdanı Bağlantıyı Kes

**Endpoint:** `PATCH /wallets/:id/disconnect`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "id": "wallet-1",
  "isConnected": false,
  ...
}
```

---

### 3.5. Cüzdanı Aktifleştir

**Endpoint:** `PATCH /wallets/:id/activate`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "id": "wallet-1",
  "isConnected": true,
  ...
}
```

---

### 3.6. Cüzdanı Sil

**Endpoint:** `DELETE /wallets/:id`

**Authentication:** Bearer Token gerekli

**Response (204):** No content

---

## 4. Feed

### 4.1. Kullanıcı Feed'ini Getir

**Endpoint:** `GET /feed`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "type": "feed",
      "data": {
        "id": "post-1",
        "type": "post",
        "user": {
          "id": "user-1",
          "name": "Ömer Faruk",
          "title": "Expert",
          "avatar": "http://api-test.tipbox.co:9000/tipbox-media/profile-pictures/1/uuid.jpg"
        },
        "stats": {
          "likes": 42,
          "comments": 10,
          "shares": 5,
          "bookmarks": 3
        },
        "content": "Post içeriği",
        "images": [
          {
            "url": "http://api-test.tipbox.co:9000/tipbox-media/posts/post-1/image1.jpg",
            "width": 1920,
            "height": 1080
          }
        ],
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    },
    {
      "type": "benchmark",
      "data": {
        "id": "benchmark-1",
        "type": "benchmark",
        "user": { ... },
        "products": [
          {
            "id": "product-1",
            "name": "iPhone 15 Pro",
            "isOwned": true,
            "choice": false
          }
        ],
        "content": "Karşılaştırma içeriği",
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    }
  ],
  "pagination": {
    "cursor": "post-1",
    "hasMore": true,
    "limit": 20,
    "total": 150
  }
}
```

---

## 5. Post

### 5.1. Post Oluştur

**Endpoint:** `POST /posts`

**Authentication:** Bearer Token gerekli

**Request (multipart/form-data veya JSON):**
```json
{
  "type": "post",
  "content": "Post içeriği",
  "productId": "product-1",
  "contextType": "product",
  "images": [
    "http://api-test.tipbox.co:9000/tipbox-media/posts/post-1/image1.jpg"
  ]
}
```

**Response (201):**
```json
{
  "id": "post-1",
  "type": "post",
  "content": "Post içeriği",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

---

### 5.2. Benchmark Post Oluştur

**Endpoint:** `POST /posts/benchmark`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "content": "Karşılaştırma içeriği",
  "productIds": ["product-1", "product-2"],
  "contextType": "product_group"
}
```

**Response (201):**
```json
{
  "id": "benchmark-1",
  "type": "benchmark",
  "products": [ ... ],
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

---

### 5.3. Question Post Oluştur

**Endpoint:** `POST /posts/question`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "content": "Soru metni",
  "productId": "product-1",
  "contextType": "product"
}
```

**Response (201):**
```json
{
  "id": "question-1",
  "type": "question",
  "content": "Soru metni",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

---

### 5.4. Tips and Tricks Post Oluştur

**Endpoint:** `POST /posts/tips-and-tricks`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "content": "İpucu içeriği",
  "productId": "product-1",
  "tag": "performance",
  "benefitCategory": "PERFORMANCE"
}
```

**Response (201):**
```json
{
  "id": "tips-1",
  "type": "tipsAndTricks",
  "content": "İpucu içeriği",
  "tag": "performance",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

---

### 5.5. Experience Post Oluştur

**Endpoint:** `POST /posts/experience`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "content": "Deneyim içeriği",
  "productId": "product-1",
  "experienceType": "OWN",
  "status": "ACTIVE"
}
```

**Response (201):**
```json
{
  "id": "experience-1",
  "type": "experience",
  "content": "Deneyim içeriği",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

---

### 5.6. Post Detayını Getir

**Endpoint:** `GET /posts/:postId`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "id": "post-1",
  "type": "post",
  "user": { ... },
  "content": "Post içeriği",
  "stats": { ... },
  "images": [ ... ],
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

---

### 5.7. Post'u Güncelle

**Endpoint:** `PUT /posts/:postId`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "content": "Güncellenmiş içerik"
}
```

**Response (200):**
```json
{
  "id": "post-1",
  "content": "Güncellenmiş içerik",
  "updatedAt": "2024-01-15T11:00:00.000Z"
}
```

---

### 5.8. Post'u Sil

**Endpoint:** `DELETE /posts/:postId`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "success": true,
  "message": "Post silindi"
}
```

---

## 6. Interaction

### 6.1. Post'u Beğen

**Endpoint:** `POST /interactions/posts/:postId/like`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "success": true,
  "message": "Post liked successfully"
}
```

---

### 6.2. Post Beğenisini Geri Al

**Endpoint:** `DELETE /interactions/posts/:postId/like`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "success": true,
  "message": "Post unliked successfully"
}
```

---

### 6.3. Post'u Favorilere Ekle

**Endpoint:** `POST /interactions/posts/:postId/bookmark`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "favorite-1",
    "postId": "post-1",
    "userId": "user-1"
  },
  "message": "Post bookmarked successfully"
}
```

---

### 6.4. Favorilerden Çıkar

**Endpoint:** `DELETE /interactions/posts/:postId/bookmark`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "success": true,
  "message": "Post unbookmarked successfully"
}
```

---

### 6.5. Favorileri Listele

**Endpoint:** `GET /interactions/bookmarks`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
- `limit` (number, optional, default: 50): Maksimum item sayısı

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "post-1",
      "type": "post",
      "content": "Post içeriği",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### 6.6. Yorum Yap

**Endpoint:** `POST /interactions/posts/:postId/comments`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "comment": "Yorum metni",
  "parentId": "comment-1"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "comment-1",
    "comment": "Yorum metni",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 6.7. Post Yorumlarını Getir

**Endpoint:** `GET /interactions/posts/:postId/comments`

**Authentication:** Gerekli değil

**Query Parameters:**
- `limit` (number, optional, default: 50): Maksimum yorum sayısı

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "comment-1",
      "comment": "Yorum metni",
      "user": { ... },
      "replies": [ ... ],
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### 6.8. Yorumu Sil

**Endpoint:** `DELETE /interactions/comments/:commentId`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "success": true,
  "message": "Comment deleted successfully"
}
```

---

### 6.9. Yorumu Beğen

**Endpoint:** `POST /interactions/comments/:commentId/like`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "success": true,
  "message": "Comment liked successfully"
}
```

---

### 6.10. Yorum Beğenisini Geri Al

**Endpoint:** `DELETE /interactions/comments/:commentId/like`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "success": true,
  "message": "Comment unliked successfully"
}
```

---

### 6.11. Post'u Paylaş

**Endpoint:** `POST /interactions/posts/:postId/share`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "shareType": "INTERNAL_REPOST",
  "platform": "twitter"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "share-1",
    "shareType": "INTERNAL_REPOST",
    "platform": "twitter"
  }
}
```

---

### 6.12. Post Etkileşim Durumunu Getir

**Endpoint:** `GET /interactions/posts/:postId/status`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "success": true,
  "data": {
    "liked": true,
    "favorited": false,
    "shared": false
  }
}
```

---

## 7. Messaging

### 7.1. Mesaj Kutusunu Getir

**Endpoint:** `GET /messages`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
- `search` (string, optional): Arama metni
- `unreadOnly` (boolean, optional): Sadece okunmamış mesajlar
- `limit` (number, optional, default: 50, max: 100): Maksimum thread sayısı

**Response (200):**
```json
[
  {
    "id": "thread-1",
    "senderName": "Ahmet Yılmaz",
    "senderTitle": "Expert",
    "senderAvatar": "http://api-test.tipbox.co:9000/tipbox-media/profile-pictures/2/uuid.jpg",
    "lastMessage": "Merhaba!",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "isUnread": true,
    "unreadCount": 3
  }
]
```

---

### 7.2. Message Feed'i Getir

**Endpoint:** `GET /messages/feed`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
- `limit` (number, optional, default: 50, max: 100): Maksimum feed item sayısı

**Response (200):**
```json
[
  {
    "id": "msg-1",
    "type": "message",
    "data": {
      "id": "msg-1",
      "sender": { ... },
      "lastMessage": "Merhaba!",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "isUnread": false
    }
  },
  {
    "id": "tips-1",
    "type": "send-tips",
    "data": {
      "id": "tips-1",
      "sender": { ... },
      "amount": 100.50,
      "message": "Teşekkürler!",
      "timestamp": "2024-01-15T10:25:00.000Z"
    }
  },
  {
    "id": "req-1",
    "type": "support-request",
    "data": {
      "id": "req-1",
      "sender": { ... },
      "type": "GENERAL",
      "message": "Yardıma ihtiyacım var",
      "amount": 50,
      "status": "pending",
      "timestamp": "2024-01-15T10:20:00.000Z",
      "threadId": null
    }
  }
]
```

---

### 7.3. Direkt Mesaj Gönder

**Endpoint:** `POST /messages`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "recipientUserId": "user-2",
  "message": "Merhaba!"
}
```

**Response (201):** No content

---

### 7.4. Thread Oluştur veya Getir

**Endpoint:** `POST /messages/threads`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "recipientId": "user-2"
}
```

**Response (200):**
```json
{
  "id": "thread-1",
  "userOneId": "user-1",
  "userTwoId": "user-2",
  "isActive": true,
  "startedAt": "2024-01-15T10:30:00.000Z"
}
```

---

### 7.5. Thread Mesajlarını Getir

**Endpoint:** `GET /messages/:threadId`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
- `limit` (number, optional, default: 50, max: 100): Maksimum mesaj sayısı
- `offset` (number, optional, default: 0): Atlanacak mesaj sayısı

**Response (200):**
```json
[
  {
    "id": "msg-1",
    "type": "message",
    "data": {
      "id": "msg-1",
      "sender": { ... },
      "lastMessage": "Merhaba!",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "isUnread": false
    }
  }
]
```

---

### 7.6. Support Request'leri Listele

**Endpoint:** `GET /messages/support-requests`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
- `status` (string, optional): Filtreleme için durum (`pending`, `active`, `completed`, `finalized`, `reported`)
- `search` (string, optional): Arama metni
- `limit` (number, optional, default: 50, max: 100): Maksimum request sayısı

**Response (200):**
```json
[
  {
    "id": "req-1",
    "userName": "Ahmet Yılmaz",
    "userTitle": "Expert",
    "userAvatar": "http://api-test.tipbox.co:9000/tipbox-media/profile-pictures/2/uuid.jpg",
    "requestDescription": "Yardıma ihtiyacım var",
    "status": "pending",
    "threadId": null
  }
]
```

---

### 7.7. Support Request Oluştur

**Endpoint:** `POST /messages/support-requests`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "senderUserId": "user-1",
  "recipientUserId": "user-2",
  "type": "GENERAL",
  "message": "Yardıma ihtiyacım var",
  "amount": "50.00",
  "status": "pending",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response (201):** No content

---

### 7.8. Support Request'i Accept Et

**Endpoint:** `POST /messages/support-requests/:requestId/accept`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "requestId": "req-1",
  "threadId": "thread-1"
}
```

---

### 7.9. Support Request'i Reject Et

**Endpoint:** `POST /messages/support-requests/:requestId/reject`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "message": "Support request rejected"
}
```

---

### 7.10. Support Request'i İptal Et

**Endpoint:** `POST /messages/support-requests/:requestId/cancel`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "message": "Support request cancelled"
}
```

---

### 7.11. TIPS Gönder

**Endpoint:** `POST /messages/tips`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "senderUserId": "user-1",
  "recipientUserId": "user-2",
  "message": "Teşekkürler!",
  "amount": 100.50,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response (201):** No content

---

## 8. Inventory

### 8.1. Inventory'ye Ürün Ekle

**Endpoint:** `POST /inventory`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "productId": "product-1",
  "selectedDurationId": "duration-1",
  "selectedLocationId": "location-1",
  "selectedPurposeId": "purpose-1",
  "content": "Ürün deneyimi",
  "experience": [
    {
      "type": "price_and_shopping",
      "content": "Fiyat deneyimi",
      "rating": 4
    },
    {
      "type": "product_and_usage",
      "content": "Kullanım deneyimi",
      "rating": 5
    }
  ],
  "status": "own",
  "images": [
    "http://api-test.tipbox.co:9000/tipbox-media/inventory/item-1/image1.jpg"
  ]
}
```

**Response (201):**
```json
{
  "id": "inventory-1",
  "productId": "product-1",
  "userId": "user-1",
  "status": "own",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

---

### 8.2. Kullanıcı Inventory Listesini Getir

**Endpoint:** `GET /inventory`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
[
  {
    "id": "inventory-1",
    "product": {
      "id": "product-1",
      "name": "iPhone 15 Pro",
      "image": { ... }
    },
    "brand": { ... },
    "hasOwned": true,
    "experienceSummary": "Harika bir ürün",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
]
```

---

### 8.3. Inventory Item'ı Güncelle

**Endpoint:** `PATCH /inventory/:inventoryId`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "hasOwned": true,
  "experienceSummary": "Güncellenmiş deneyim özeti"
}
```

**Response (200):**
```json
{
  "id": "inventory-1",
  "hasOwned": true,
  "experienceSummary": "Güncellenmiş deneyim özeti",
  "updatedAt": "2024-01-15T11:00:00.000Z"
}
```

---

### 8.4. Inventory Item'ı Sil

**Endpoint:** `DELETE /inventory/:inventoryId`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "success": true,
  "message": "Inventory item deleted successfully"
}
```

---

### 8.5. Deneyim Seçeneklerini Getir

**Endpoint:** `GET /inventory/experience/options`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "durations": [
    {
      "id": "duration-1",
      "name": "1-3 Ay"
    }
  ],
  "locations": [
    {
      "id": "location-1",
      "name": "Online"
    }
  ],
  "purposes": [
    {
      "id": "purpose-1",
      "name": "Kişisel Kullanım"
    }
  ]
}
```

---

### 8.6. Deneyim Metnini AI ile Ayır

**Endpoint:** `POST /inventory/split-experience`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "productId": "product-1",
  "experienceText": "Ürünü satın aldım, çok memnun kaldım. Fiyatı uygun, performansı harika."
}
```

**Response (200):**
```json
{
  "priceAndShopping": {
    "content": "Fiyatı uygun",
    "rating": 4
  },
  "productAndUsage": {
    "content": "Performansı harika",
    "rating": 5
  }
}
```

---

## 9. Marketplace

### 9.1. Satıştaki NFT'leri Listele

**Endpoint:** `GET /marketplace/listings`

**Authentication:** Gerekli değil

**Query Parameters:**
- `search` (string, optional): Arama metni
- `minPrice` (number, optional): Minimum fiyat
- `maxPrice` (number, optional): Maksimum fiyat
- `type` (string, optional): NFT tipi (`BADGE`, `COSMETIC`, `LOOTBOX`)
- `rarity` (string, optional): Nadirlik (`COMMON`, `RARE`, `EPIC`)
- `limit` (number, optional, default: 50): Sayfalama limiti
- `cursor` (string, optional): Pagination cursor
- `orderBy` (string, optional, default: `listedAt_desc`): Sıralama (`price_asc`, `price_desc`, `listedAt_desc`, `listedAt_asc`)

**Response (200):**
```json
[
  {
    "id": "listing-1",
    "title": "Epic Badge",
    "username": "user-1",
    "price": "100.00",
    "image": "http://api-test.tipbox.co:9000/tipbox-media/nfts/badge-1.jpg",
    "userAvatar": "http://api-test.tipbox.co:9000/tipbox-media/profile-pictures/1/uuid.jpg"
  }
]
```

---

### 9.2. Kullanıcının NFT'lerini Listele

**Endpoint:** `GET /marketplace/my-nfts`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
- `limit` (number, optional, default: 50): Sayfalama limiti
- `cursor` (string, optional): Pagination cursor

**Response (200):**
```json
{
  "items": [
    {
      "id": "nft-1",
      "title": "Epic Badge",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/nfts/badge-1.jpg"
    }
  ],
  "pagination": {
    "cursor": "nft-1",
    "hasMore": false
  }
}
```

---

### 9.3. NFT'yi Satışa Koy

**Endpoint:** `POST /marketplace/listings`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "nftId": "nft-1",
  "amount": 100.50
}
```

**Response (200):**
```json
{
  "id": "listing-1",
  "title": "Epic Badge",
  "price": "100.50",
  "listedAt": "2024-01-15T10:30:00.000Z"
}
```

---

### 9.4. Listing Fiyatını Güncelle

**Endpoint:** `PUT /marketplace/listings/:listingId/price`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "amount": 150.00
}
```

**Response (200):**
```json
{
  "id": "listing-1",
  "price": "150.00",
  "updatedAt": "2024-01-15T11:00:00.000Z"
}
```

---

### 9.5. Listing'i İptal Et

**Endpoint:** `DELETE /marketplace/listings/:listingId`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "message": "Listing başarıyla iptal edildi"
}
```

---

### 9.6. NFT Satış Bilgilerini Getir

**Endpoint:** `GET /marketplace/sell/:nftId`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "id": "nft-1",
  "viewer": 150,
  "rarity": "epic",
  "price": 100.00,
  "suggestedPrice": 120.00,
  "gasFee": 5.00,
  "earningsAfterSales": 95.00
}
```

---

### 9.7. NFT Satış Detayını Getir

**Endpoint:** `GET /marketplace/sell/:nftId/detail`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "id": "nft-1",
  "viewer": 150,
  "rarity": "epic",
  "price": 100.00,
  "suggestedPrice": 120.00,
  "earnDate": "2024-01-10T10:30:00.000Z",
  "totalOwner": 5,
  "ownerUser": {
    "id": "user-1",
    "name": "Ömer Faruk"
  }
}
```

---

## 10. Explore

### 10.1. Hottest (Trend) İçerikleri Getir

**Endpoint:** `GET /explore/hottest`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "type": "feed",
      "data": { ... }
    }
  ],
  "pagination": {
    "cursor": "post-1",
    "hasMore": true,
    "limit": 20
  }
}
```

---

### 10.2. Marketplace Banner'larını Getir

**Endpoint:** `GET /explore/marketplace-banners`

**Authentication:** Gerekli değil

**Response (200):**
```json
[
  {
    "id": "banner-1",
    "title": "Özel Kampanya",
    "description": "Kampanya açıklaması",
    "imageUrl": "http://api-test.tipbox.co:9000/tipbox-media/banners/campaign-1.jpg",
    "linkUrl": "https://tipbox.co/campaign"
  }
]
```

---

### 10.3. Yeni Event'ları Getir

**Endpoint:** `GET /explore/events`

**Authentication:** Gerekli değil

**Query Parameters:**
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "eventId": "event-1",
      "eventType": "SURVEY",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/events/event-1.jpg",
      "title": "Anket Başlığı",
      "description": "Anket açıklaması",
      "startDate": "2024-01-15T10:30:00.000Z",
      "endDate": "2024-02-15T10:30:00.000Z",
      "interaction": 150,
      "participants": [
        {
          "userId": "user-1",
          "avatar": "http://api-test.tipbox.co:9000/tipbox-media/profile-pictures/1/uuid.jpg",
          "userName": "Ömer Faruk"
        }
      ]
    }
  ],
  "pagination": {
    "cursor": "event-1",
    "hasMore": true,
    "limit": 20
  }
}
```

---

### 10.4. Yeni Markaları Getir

**Endpoint:** `GET /explore/brands/new`

**Authentication:** Gerekli değil

**Query Parameters:**
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "brandId": "brand-1",
      "images": "http://api-test.tipbox.co:9000/tipbox-media/brands/brand-1.jpg",
      "title": "Brand Name",
      "description": "Brand açıklaması"
    }
  ],
  "pagination": {
    "cursor": "brand-1",
    "hasMore": true,
    "limit": 20
  }
}
```

---

### 10.5. Yeni Ürünleri Getir

**Endpoint:** `GET /explore/products/new`

**Authentication:** Gerekli değil

**Query Parameters:**
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "productId": "product-1",
      "images": "http://api-test.tipbox.co:9000/tipbox-media/products/product-1.jpg",
      "title": "Product Name"
    }
  ],
  "pagination": {
    "cursor": "product-1",
    "hasMore": true,
    "limit": 20
  }
}
```

---

## 11. Expert

### 11.1. TIPS Balance'ı Getir

**Endpoint:** `GET /expert/balance`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "balance": 500.00,
  "cached": false
}
```

---

### 11.2. Expert Request Oluştur

**Endpoint:** `POST /expert/request`

**Authentication:** Bearer Token gerekli

**Request (multipart/form-data):**
- `description` (string, required): Soru veya istek açıklaması
- `category` (string, optional): Soru kategorisi
- `tipsAmount` (string, optional): TIPS miktarı
- `media` (file[], optional): Medya dosyaları (max 10)

**Response (200):**
```json
{
  "id": "request-1",
  "userId": "user-1",
  "description": "Soru açıklaması",
  "tipsAmount": 50.00,
  "status": "PENDING",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

---

### 11.3. Expert Request'leri Listele

**Endpoint:** `GET /expert/requests`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
- `status` (string, optional): Filtreleme için durum (`PENDING`, `ANSWERED`, `CLOSED`)
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "id": "request-1",
      "description": "Soru açıklaması",
      "tipsAmount": 50.00,
      "status": "PENDING",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "cursor": "request-1",
    "hasMore": true,
    "limit": 20
  }
}
```

---

### 11.4. Expert Request Detayını Getir

**Endpoint:** `GET /expert/requests/:requestId`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "id": "request-1",
  "description": "Soru açıklaması",
  "tipsAmount": 50.00,
  "status": "PENDING",
  "media": [
    {
      "url": "http://api-test.tipbox.co:9000/tipbox-media/expert-requests/request-1/media1.jpg",
      "type": "IMAGE"
    }
  ],
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

---

### 11.5. Expert Request'e Cevap Ver

**Endpoint:** `POST /expert/requests/:requestId/answer`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "answer": "Cevap metni",
  "media": [
    "http://api-test.tipbox.co:9000/tipbox-media/expert-requests/request-1/answer-media1.jpg"
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Cevap gönderildi"
}
```

---

## 12. Event

### 12.1. Achievement Rozetlerini Getir

**Endpoint:** `GET /events/achievements`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional, default: 20, max: 50): Sayfa başına badge sayısı
- `status` (string, optional): Filtreleme (`not-started`, `in_progress`, `completed`)

**Response (200):**
```json
{
  "items": [
    {
      "id": "badge-1",
      "title": "First Post",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/badges/first-post.jpg",
      "status": "completed",
      "progress": 100
    }
  ],
  "pagination": {
    "cursor": "badge-1",
    "hasMore": false,
    "limit": 20
  }
}
```

---

### 12.2. Aktif Limited Time Event'i Getir

**Endpoint:** `GET /events/limited`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "eventId": "event-1",
  "title": "Limited Event",
  "description": "Event açıklaması",
  "startDate": "2024-01-15T10:30:00.000Z",
  "endDate": "2024-02-15T10:30:00.000Z",
  "leaderboard": [
    {
      "userId": "user-1",
      "name": "Ömer Faruk",
      "score": 1500,
      "rank": 1
    }
  ],
  "userScore": 1200,
  "userRank": 5
}
```

**Response (204):** Aktif event yok

---

### 12.3. Aktif Event'leri Getir

**Endpoint:** `GET /events/active`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "eventId": "event-1",
      "eventType": "SURVEY",
      "title": "Event Başlığı",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/events/event-1.jpg",
      "startDate": "2024-01-15T10:30:00.000Z",
      "endDate": "2024-02-15T10:30:00.000Z",
      "isJoined": true
    }
  ],
  "pagination": {
    "cursor": "event-1",
    "hasMore": true,
    "limit": 20
  }
}
```

---

### 12.4. Yaklaşan Event'leri Getir

**Endpoint:** `GET /events/upcoming`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "eventId": "event-1",
      "eventType": "SURVEY",
      "title": "Event Başlığı",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/events/event-1.jpg",
      "startDate": "2024-02-01T10:30:00.000Z",
      "endDate": "2024-02-15T10:30:00.000Z",
      "isJoined": false
    }
  ],
  "pagination": {
    "cursor": "event-1",
    "hasMore": true,
    "limit": 20
  }
}
```

---

### 12.5. Event Detayını Getir

**Endpoint:** `GET /events/:eventId`

**Authentication:** Bearer Token gerekli

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
  "participants": 150
}
```

---

### 12.6. Event Post'larını Getir

**Endpoint:** `GET /events/:eventId/posts`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "type": "feed",
      "data": { ... }
    }
  ],
  "pagination": {
    "cursor": "post-1",
    "hasMore": true,
    "limit": 20
  }
}
```

---

### 12.7. Event Badge'lerini Getir

**Endpoint:** `GET /events/:eventId/badges`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "id": "badge-1",
      "title": "Event Badge",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/badges/event-badge.jpg",
      "description": "Badge açıklaması"
    }
  ],
  "pagination": {
    "cursor": "badge-1",
    "hasMore": false,
    "limit": 20
  }
}
```

---

## 13. Search

### 13.1. Genel Arama

**Endpoint:** `GET /search`

**Authentication:** Gerekli değil

**Query Parameters:**
- `keyword` (string, required): Aranacak anahtar kelime
- `types` (string, optional): Arama tipleri (virgülle ayrılmış: `user,brand,product`)
- `limit` (number, optional, default: 10, max: 50): Her tip için maksimum sonuç sayısı

**Response (200):**
```json
{
  "userData": [
    {
      "id": "user-1",
      "name": "Ömer Faruk",
      "avatar": "http://api-test.tipbox.co:9000/tipbox-media/profile-pictures/1/uuid.jpg",
      "cosmetic": "Expert"
    }
  ],
  "brandData": [
    {
      "id": "brand-1",
      "name": "Apple",
      "category": "Elektronik",
      "logo": "http://api-test.tipbox.co:9000/tipbox-media/brands/apple-logo.jpg"
    }
  ],
  "productData": [
    {
      "id": "product-1",
      "name": "iPhone 15 Pro",
      "model": "A2848",
      "specs": "256GB, Titanium",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/products/iphone-15-pro.jpg"
    }
  ]
}
```

---

## 14. Notification

### 14.1. Bildirimleri Listele

**Endpoint:** `GET /notifications`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
- `limit` (number, optional, default: 20): Sayfa başına bildirim sayısı
- `offset` (number, optional, default: 0): Atlanacak bildirim sayısı
- `unreadOnly` (boolean, optional, default: false): Sadece okunmamış bildirimler

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "notification-1",
      "type": "POST_LIKE",
      "title": "Post beğenildi",
      "message": "Ömer Faruk postunuzu beğendi",
      "isRead": false,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "metadata": {
        "postId": "post-1",
        "userId": "user-2"
      }
    }
  ]
}
```

---

### 14.2. Okunmamış Bildirim Sayısını Getir

**Endpoint:** `GET /notifications/unread-count`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "success": true,
  "data": {
    "count": 5
  }
}
```

---

### 14.3. Bildirimi Okundu Olarak İşaretle

**Endpoint:** `PUT /notifications/:id/read`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

---

### 14.4. Tüm Bildirimleri Okundu Olarak İşaretle

**Endpoint:** `PUT /notifications/mark-all-read`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "success": true,
  "message": "5 notifications marked as read",
  "data": {
    "count": 5
  }
}
```

---

### 14.5. Bildirimi Sil

**Endpoint:** `DELETE /notifications/:id`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "success": true,
  "message": "Notification deleted"
}
```

---

### 14.6. Bildirim Ayarlarını Getir

**Endpoint:** `GET /notifications/settings`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "success": true,
  "data": {
    "trustNotifications": true,
    "supportNotifications": true,
    "messageNotifications": true,
    "collectionNotifications": true,
    "postNotifications": true,
    "notificationEmailEnabled": true,
    "notificationPushEnabled": true,
    "notificationInAppEnabled": true
  }
}
```

---

### 14.7. Bildirim Ayarlarını Güncelle

**Endpoint:** `PUT /notifications/settings`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "trustNotifications": false,
  "postNotifications": true,
  "notificationPushEnabled": true
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Notification settings updated"
}
```

---

### 14.8. Push Token Kaydet

**Endpoint:** `POST /notifications/push-token`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "deviceType": "ios"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Push token registered successfully",
  "data": {
    "id": "push-token-1",
    "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "deviceType": "ios",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 14.9. Push Token Sil

**Endpoint:** `DELETE /notifications/push-token`

**Authentication:** Bearer Token gerekli

**Request:**
```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Push token deleted successfully"
}
```

---

## 15. Catalog

Detaylı bilgi için: [Brand Catalog ve Category API Dokümantasyonu](./BRAND_CATALOG_CATEGORY_API.md)

### 15.1. Kategorileri Listele

**Endpoint:** `GET /catalog/categories`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
[
  {
    "categoryId": "category-1",
    "name": "Elektronik",
    "image": "http://api-test.tipbox.co:9000/tipbox-media/categories/electronics.jpg"
  }
]
```

---

### 15.2. Sub-Kategorileri Listele

**Endpoint:** `GET /catalog/categories/:categoryId/sub-categories`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
[
  {
    "subCategoryId": "sub-category-1",
    "name": "Akıllı Telefonlar",
    "image": "http://api-test.tipbox.co:9000/tipbox-media/sub-categories/smartphones.jpg"
  }
]
```

---

### 15.3. Product Group'ları Listele

**Endpoint:** `GET /catalog/sub-categories/:subCategoryId/product-groups`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "productGroupId": "product-group-1",
      "name": "iPhone",
      "image": "http://api-test.tipbox.co:9000/tipbox-media/product-groups/iphone.jpg"
    }
  ],
  "pagination": {
    "cursor": "product-group-1",
    "hasMore": true,
    "limit": 20
  }
}
```

---

### 15.4. Ürünleri Listele

**Endpoint:** `GET /catalog/product-groups/:productGroupId/products`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "productId": "product-1",
      "name": "iPhone 15 Pro",
      "subName": "256GB Titanium",
      "image": {
        "url": "http://api-test.tipbox.co:9000/tipbox-media/products/iphone-15-pro.jpg",
        "width": 1920,
        "height": 1080
      }
    }
  ],
  "pagination": {
    "cursor": "product-1",
    "hasMore": true,
    "limit": 20
  }
}
```

---

## 16. Brand

Detaylı bilgi için: [Brand Catalog ve Category API Dokümantasyonu](./BRAND_CATALOG_CATEGORY_API.md)

### 16.1. Brand Kategorilerini Listele

**Endpoint:** `GET /brands/categories`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
[
  {
    "categoryId": "category-1",
    "name": "Elektronik",
    "image": "http://api-test.tipbox.co:9000/tipbox-media/brand-categories/electronics.jpg"
  }
]
```

---

### 16.2. Kategoriye Göre Markaları Listele

**Endpoint:** `GET /brands/categories/:categoryId/brands`

**Authentication:** Bearer Token gerekli

**Query Parameters:**
- `cursor` (string, optional): Pagination cursor
- `limit` (number, optional, default: 20, max: 50): Sayfa başına item sayısı

**Response (200):**
```json
{
  "items": [
    {
      "brandId": "brand-1",
      "name": "Apple",
      "logo": "http://api-test.tipbox.co:9000/tipbox-media/brands/apple-logo.jpg",
      "description": "Brand açıklaması"
    }
  ],
  "pagination": {
    "cursor": "brand-1",
    "hasMore": true,
    "limit": 20
  }
}
```

---

### 16.3. Brand Catalog Detayları

**Endpoint:** `GET /brands/:brandId/catalog`

**Authentication:** Bearer Token gerekli

**Response (200):**
```json
{
  "brandId": "brand-1",
  "name": "Apple",
  "logo": "http://api-test.tipbox.co:9000/tipbox-media/brands/apple-logo.jpg",
  "description": "Brand açıklaması",
  "products": [
    {
      "productId": "product-1",
      "name": "iPhone 15 Pro",
      "image": { ... }
    }
  ]
}
```

---

## 17. Cache (Admin)

### 17.1. Cache Metrics'lerini Getir

**Endpoint:** `GET /cache/metrics`

**Authentication:** Bearer Token gerekli (Admin only)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "hits": 1500,
    "misses": 200,
    "hitRate": 0.88,
    "cacheConnected": true,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 17.2. Cache Metrics'lerini Sıfırla

**Endpoint:** `POST /cache/metrics/reset`

**Authentication:** Bearer Token gerekli (Admin only)

**Response (200):**
```json
{
  "success": true,
  "message": "Cache metrics reset successfully"
}
```

---

### 17.3. User Cache'ini Temizle

**Endpoint:** `DELETE /cache/invalidate/user/:userId`

**Authentication:** Bearer Token gerekli (Admin only)

**Response (200):**
```json
{
  "success": true,
  "message": "User cache invalidated for userId: user-1"
}
```

---

### 17.4. Post Cache'ini Temizle

**Endpoint:** `DELETE /cache/invalidate/post/:postId`

**Authentication:** Bearer Token gerekli (Admin only)

**Response (200):**
```json
{
  "success": true,
  "message": "Post cache invalidated for postId: post-1"
}
```

---

### 17.5. Feed Cache'ini Temizle

**Endpoint:** `DELETE /cache/invalidate/feed/:userId`

**Authentication:** Bearer Token gerekli (Admin only)

**Response (200):**
```json
{
  "success": true,
  "message": "Feed cache invalidated for userId: user-1"
}
```

---

### 17.6. Trending Cache'ini Temizle

**Endpoint:** `DELETE /cache/invalidate/trending`

**Authentication:** Bearer Token gerekli (Admin only)

**Response (200):**
```json
{
  "success": true,
  "message": "Trending cache invalidated"
}
```

---

### 17.7. Cache Durumunu Getir

**Endpoint:** `GET /cache/status`

**Authentication:** Bearer Token gerekli (Admin only)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## 18. Dashboard (Admin)

Dashboard endpoint'leri admin paneli için kullanılır ve HTML sayfası döner. API endpoint'leri değildir.

---

## Mobil Uygulama Performans Önerileri

### Görsel Optimizasyonu

1. **Lazy Loading:** Görselleri sadece görünür olduklarında yükleyin
2. **Image Caching:** Görselleri local cache'de saklayın
3. **Progressive Loading:** Düşük kaliteli placeholder gösterin, sonra yüksek kaliteli görseli yükleyin
4. **CDN Kullanımı:** Görseller CDN üzerinden servis edilir, cache'lenir

### Network Optimizasyonu

1. **Request Batching:** Birden fazla request'i birleştirin
2. **Pagination:** Büyük listeler için cursor-based pagination kullanın
3. **Cache Strategy:** 
   - GET request'leri cache'leyin
   - Cache invalidation için socket event'lerini dinleyin
4. **Retry Logic:** Network hatalarında exponential backoff ile retry yapın

### Data Management

1. **Local Storage:** Sık kullanılan verileri local'de saklayın
2. **Offline Support:** Offline durumda cached verileri gösterin
3. **Background Sync:** Uygulama arka plandayken sync yapın

### Socket.IO Kullanımı

1. **Real-time Updates:** Socket.IO ile real-time bildirimler alın
2. **Connection Management:** Uygulama arka plana geçtiğinde socket'i kapatın
3. **Reconnection:** Bağlantı koptuğunda otomatik reconnect yapın

---

## Backend Geliştirici Notları

### Error Handling

Tüm endpoint'ler standart error response formatını kullanır:
```json
{
  "success": false,
  "message": "Hata mesajı",
  "error": "Detaylı hata bilgisi (opsiyonel)"
}
```

### Validation

Request validation için:
- Body validation: `validateBody` middleware kullanılır
- Query parameter validation: Router seviyesinde yapılır
- Path parameter validation: Express route parameters ile yapılır

### Authentication

JWT token authentication:
- Token format: `Bearer {token}`
- Token expiration: 1 saat (access token), 7 gün (refresh token)
- Token refresh: `/auth/refresh` endpoint'i ile (eğer varsa)

### Rate Limiting

Bazı endpoint'lerde rate limiting uygulanabilir. Rate limit aşıldığında:
- Status Code: `429 Too Many Requests`
- Response: `{ "message": "Rate limit exceeded" }`

---

## Son Güncelleme

Bu dokümantasyon **2024-01-15** tarihinde güncellenmiştir.

API versiyonu: **v1.0.0**








