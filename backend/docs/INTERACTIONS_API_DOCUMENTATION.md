# Interactions API Dokümantasyonu

Bu dokümantasyon, Tipbox Backend'in Interactions API endpoint'lerinin detaylı request/response yapılarını içerir. Mobil uygulama geliştiricileri için hazırlanmıştır.

---

## 📋 İçindekiler

1. [Genel Bilgiler](#genel-bilgiler)
2. [Authentication](#authentication)
3. [Like Endpoints](#1-like-endpoints)
4. [Bookmark (Favorite) Endpoints](#2-bookmark-favorite-endpoints)
5. [Comment Endpoints](#3-comment-endpoints)
6. [Share Endpoints](#4-share-endpoints)
7. [Status Endpoints](#5-status-endpoints)
8. [Hata Yönetimi](#hata-yönetimi)
9. [Örnek Kullanım Senaryoları](#örnek-kullanım-senaryoları)

---

## Genel Bilgiler

### Base URL
```
Development: http://localhost:3000
Production: https://api.tipbox.co
```

### Base Path
```
/interactions
```

### Content-Type
Tüm request'ler için:
```
Content-Type: application/json
```

---

## Authentication

Tüm endpoint'ler **JWT Bearer Token** ile korunmaktadır.

### Header Format
```http
Authorization: Bearer <your-jwt-token>
```

### Token Alma
Token'ı `/auth/login` endpoint'inden alabilirsiniz.

---

## 1. Like Endpoints

### 1.1. Post'u Beğen

**Endpoint:** `POST /interactions/posts/:postId/like`

**Authentication:** ✅ Gerekli

**Path Parameters:**
- `postId` (string, required): Beğenilecek post'un ID'si

**Request Body:** Yok

**Success Response:**
- **Status Code:** `200 OK`
- **Response Body:**
```json
{
  "success": true,
  "message": "Post liked successfully"
}
```

**Error Responses:**

| Status Code | Açıklama | Response Body |
|------------|----------|---------------|
| `400` | Post zaten beğenilmiş | `{ "message": "Post already liked" }` |
| `401` | Yetkisiz erişim | `{ "message": "Unauthorized" }` |
| `404` | Post bulunamadı | `{ "message": "Post not found" }` |

**Örnek Request:**
```bash
curl -X POST \
  http://localhost:3000/interactions/posts/01J8X9K2M3N4P5Q6R7S8T9U0V/like \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Örnek Response:**
```json
{
  "success": true,
  "message": "Post liked successfully"
}
```

---

### 1.2. Post Beğenisini Geri Al

**Endpoint:** `DELETE /interactions/posts/:postId/like`

**Authentication:** ✅ Gerekli

**Path Parameters:**
- `postId` (string, required): Beğenisi geri alınacak post'un ID'si

**Request Body:** Yok

**Success Response:**
- **Status Code:** `200 OK`
- **Response Body:**
```json
{
  "success": true,
  "message": "Post unliked successfully"
}
```

**Error Responses:**

| Status Code | Açıklama | Response Body |
|------------|----------|---------------|
| `404` | Beğeni bulunamadı | `{ "message": "Like not found" }` |
| `401` | Yetkisiz erişim | `{ "message": "Unauthorized" }` |

**Örnek Request:**
```bash
curl -X DELETE \
  http://localhost:3000/interactions/posts/01J8X9K2M3N4P5Q6R7S8T9U0V/like \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 2. Bookmark (Favorite) Endpoints

### 2.1. Post'u Favorilere Ekle

**Endpoint:** `POST /interactions/posts/:postId/bookmark`

**Authentication:** ✅ Gerekli

**Path Parameters:**
- `postId` (string, required): Favorilere eklenecek post'un ID'si

**Request Body:** Yok

**Success Response:**
- **Status Code:** `200 OK`
- **Response Body:**
```json
{
  "success": true,
  "data": {
    "id": "01J8X9K2M3N4P5Q6R7S8T9U0W",
    "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
    "postId": "01J8X9K2M3N4P5Q6R7S8T9U0V",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "message": "Post bookmarked successfully"
}
```

**Response Data Schema:**
```typescript
{
  id: string;           // UUID
  userId: string;       // UUID
  postId: string;       // Post ID (26 karakter)
  createdAt: string;    // ISO 8601 timestamp
  updatedAt: string;    // ISO 8601 timestamp
}
```

**Error Responses:**

| Status Code | Açıklama | Response Body |
|------------|----------|---------------|
| `400` | Post zaten favorilerde | `{ "message": "Post already favorited" }` |
| `404` | Post bulunamadı | `{ "message": "Post not found" }` |
| `401` | Yetkisiz erişim | `{ "message": "Unauthorized" }` |

---

### 2.2. Post'u Favorilerden Çıkar

**Endpoint:** `DELETE /interactions/posts/:postId/bookmark`

**Authentication:** ✅ Gerekli

**Path Parameters:**
- `postId` (string, required): Favorilerden çıkarılacak post'un ID'si

**Request Body:** Yok

**Success Response:**
- **Status Code:** `200 OK`
- **Response Body:**
```json
{
  "success": true,
  "message": "Post unbookmarked successfully"
}
```

**Error Responses:**

| Status Code | Açıklama | Response Body |
|------------|----------|---------------|
| `404` | Favorite kaydı bulunamadı | `{ "message": "Favorite not found" }` |
| `401` | Yetkisiz erişim | `{ "message": "Unauthorized" }` |

---

### 2.3. Kullanıcının Favorilerini Listele

**Endpoint:** `GET /interactions/bookmarks`

**Authentication:** ✅ Gerekli

**Query Parameters:**
- `limit` (integer, optional): Sayfa başına kayıt sayısı (default: 50, max: 100)

**Success Response:**
- **Status Code:** `200 OK`
- **Response Body:**
```json
{
  "success": true,
  "data": [
    {
      "id": "01J8X9K2M3N4P5Q6R7S8T9U0W",
      "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
      "postId": "01J8X9K2M3N4P5Q6R7S8T9U0V",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

**Response Data Schema:**
```typescript
Array<{
  id: string;
  userId: string;
  postId: string;
  createdAt: string;
  updatedAt: string;
}>
```

**Örnek Request:**
```bash
curl -X GET \
  "http://localhost:3000/interactions/bookmarks?limit=20" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 3. Comment Endpoints

### 3.1. Post'a Yorum Yap

**Endpoint:** `POST /interactions/posts/:postId/comments`

**Authentication:** ✅ Gerekli

**Path Parameters:**
- `postId` (string, required): Yorum yapılacak post'un ID'si

**Request Body:**
```json
{
  "comment": "Harika bir paylaşım!",
  "parentId": null  // Optional: Reply yapılıyorsa parent comment ID'si
}
```

**Request Body Schema:**
```typescript
{
  comment: string;      // Required: Yorum metni
  parentId?: string;    // Optional: Reply için parent comment ID
}
```

**Success Response:**
- **Status Code:** `201 Created`
- **Response Body:**
```json
{
  "success": true,
  "data": {
    "id": "01J8X9K2M3N4P5Q6R7S8T9U0X",
    "postId": "01J8X9K2M3N4P5Q6R7S8T9U0V",
    "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
    "parentId": null,
    "comment": "Harika bir paylaşım!",
    "isAnswer": false,
    "likesCount": 0,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Response Data Schema:**
```typescript
{
  id: string;
  postId: string;
  userId: string;
  parentId: string | null;
  comment: string;
  isAnswer: boolean;
  likesCount: number;
  createdAt: string;
  updatedAt: string;
}
```

**Error Responses:**

| Status Code | Açıklama | Response Body |
|------------|----------|---------------|
| `400` | Yorum metni eksik | `{ "message": "Comment text is required" }` |
| `404` | Post bulunamadı | `{ "message": "Post not found" }` |
| `404` | Parent comment bulunamadı (reply için) | `{ "message": "Parent comment not found" }` |
| `401` | Yetkisiz erişim | `{ "message": "Unauthorized" }` |

**Örnek Request (Yeni Yorum):**
```bash
curl -X POST \
  http://localhost:3000/interactions/posts/01J8X9K2M3N4P5Q6R7S8T9U0V/comments \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "Harika bir paylaşım!"
  }'
```

**Örnek Request (Reply):**
```bash
curl -X POST \
  http://localhost:3000/interactions/posts/01J8X9K2M3N4P5Q6R7S8T9U0V/comments \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "Katılıyorum!",
    "parentId": "01J8X9K2M3N4P5Q6R7S8T9U0X"
  }'
```

---

### 3.2. Post'un Yorumlarını Getir

**Endpoint:** `GET /interactions/posts/:postId/comments`

**Authentication:** ❌ Gerekli değil (Public endpoint)

**Path Parameters:**
- `postId` (string, required): Yorumları getirilecek post'un ID'si

**Query Parameters:**
- `limit` (integer, optional): Sayfa başına kayıt sayısı (default: 50, max: 100)

**Success Response:**
- **Status Code:** `200 OK`
- **Response Body:**
```json
{
  "success": true,
  "data": {
    "comments": [
      {
        "comment": {
          "id": "01J8X9K2M3N4P5Q6R7S8T9U0X",
          "postId": "01J8X9K2M3N4P5Q6R7S8T9U0V",
          "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
          "parentId": null,
          "comment": "Harika bir paylaşım!",
          "isAnswer": false,
          "likesCount": 5,
          "createdAt": "2024-01-15T10:30:00.000Z",
          "updatedAt": "2024-01-15T10:30:00.000Z"
        },
        "replies": [
          {
            "id": "01J8X9K2M3N4P5Q6R7S8T9U0Y",
            "postId": "01J8X9K2M3N4P5Q6R7S8T9U0V",
            "userId": "580f5de9-b691-4d70-a6a8-2789226f4e08",
            "parentId": "01J8X9K2M3N4P5Q6R7S8T9U0X",
            "comment": "Katılıyorum!",
            "isAnswer": false,
            "likesCount": 2,
            "createdAt": "2024-01-15T11:00:00.000Z",
            "updatedAt": "2024-01-15T11:00:00.000Z"
          }
        ],
        "user": {
          "id": "480f5de9-b691-4d70-a6a8-2789226f4e07",
          "name": "Ahmet Yılmaz",
          "avatar": null
        }
      }
    ]
  }
}
```

**Response Data Schema:**
```typescript
{
  comments: Array<{
    comment: {
      id: string;
      postId: string;
      userId: string;
      parentId: string | null;
      comment: string;
      isAnswer: boolean;
      likesCount: number;
      createdAt: string;
      updatedAt: string;
    };
    replies: Array<{
      id: string;
      postId: string;
      userId: string;
      parentId: string;
      comment: string;
      isAnswer: boolean;
      likesCount: number;
      createdAt: string;
      updatedAt: string;
    }>;
    user: {
      id: string;
      name: string | null;
      avatar: string | null;
    };
  }>;
}
```

**Örnek Request:**
```bash
curl -X GET \
  "http://localhost:3000/interactions/posts/01J8X9K2M3N4P5Q6R7S8T9U0V/comments?limit=20"
```

---

### 3.3. Yorumu Sil

**Endpoint:** `DELETE /interactions/comments/:commentId`

**Authentication:** ✅ Gerekli

**Path Parameters:**
- `commentId` (string, required): Silinecek yorumun ID'si

**Request Body:** Yok

**Success Response:**
- **Status Code:** `200 OK`
- **Response Body:**
```json
{
  "success": true,
  "message": "Comment deleted successfully"
}
```

**Error Responses:**

| Status Code | Açıklama | Response Body |
|------------|----------|---------------|
| `404` | Yorum bulunamadı | `{ "message": "Comment not found" }` |
| `403` | Yetkisiz (sadece kendi yorumunu silebilir) | `{ "message": "Unauthorized to delete this comment" }` |
| `401` | Yetkisiz erişim | `{ "message": "Unauthorized" }` |

---

### 3.4. Yorumu Beğen

**Endpoint:** `POST /interactions/comments/:commentId/like`

**Authentication:** ✅ Gerekli

**Path Parameters:**
- `commentId` (string, required): Beğenilecek yorumun ID'si

**Request Body:** Yok

**Success Response:**
- **Status Code:** `200 OK`
- **Response Body:**
```json
{
  "success": true,
  "message": "Comment liked successfully"
}
```

**Error Responses:**

| Status Code | Açıklama | Response Body |
|------------|----------|---------------|
| `400` | Yorum zaten beğenilmiş | `{ "message": "Comment already liked" }` |
| `404` | Yorum bulunamadı | `{ "message": "Comment not found" }` |
| `401` | Yetkisiz erişim | `{ "message": "Unauthorized" }` |

---

### 3.5. Yorum Beğenisini Geri Al

**Endpoint:** `DELETE /interactions/comments/:commentId/like`

**Authentication:** ✅ Gerekli

**Path Parameters:**
- `commentId` (string, required): Beğenisi geri alınacak yorumun ID'si

**Request Body:** Yok

**Success Response:**
- **Status Code:** `200 OK`
- **Response Body:**
```json
{
  "success": true,
  "message": "Comment unliked successfully"
}
```

**Error Responses:**

| Status Code | Açıklama | Response Body |
|------------|----------|---------------|
| `404` | Beğeni bulunamadı | `{ "message": "Like not found" }` |
| `401` | Yetkisiz erişim | `{ "message": "Unauthorized" }` |

---

## 4. Share Endpoints

### 4.1. Post'u Paylaş

**Endpoint:** `POST /interactions/posts/:postId/share`

**Authentication:** ✅ Gerekli

**Path Parameters:**
- `postId` (string, required): Paylaşılacak post'un ID'si

**Request Body:**
```json
{
  "shareType": "INTERNAL_REPOST",
  "platform": null
}
```

**Request Body Schema:**
```typescript
{
  shareType: "INTERNAL_REPOST" | "EXTERNAL_SHARE";  // Required
  platform?: string;                                 // Optional: EXTERNAL_SHARE için platform adı (örn: "Twitter", "Facebook")
}
```

**ShareType Enum:**
- `INTERNAL_REPOST`: Post'u kendi timeline'ına repost et
- `EXTERNAL_SHARE`: Post'u dış platforma paylaş

**Success Response:**
- **Status Code:** `201 Created`
- **Response Body:**
```json
{
  "success": true,
  "data": {
    "id": "01J8X9K2M3N4P5Q6R7S8T9U0Z",
    "userId": "480f5de9-b691-4d70-a6a8-2789226f4e07",
    "postId": "01J8X9K2M3N4P5Q6R7S8T9U0V",
    "shareType": "INTERNAL_REPOST",
    "platform": null,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Response Data Schema:**
```typescript
{
  id: string;
  userId: string;
  postId: string;
  shareType: "INTERNAL_REPOST" | "EXTERNAL_SHARE";
  platform: string | null;
  createdAt: string;
}
```

**Error Responses:**

| Status Code | Açıklama | Response Body |
|------------|----------|---------------|
| `400` | Geçersiz shareType | `{ "message": "Valid shareType is required (INTERNAL_REPOST or EXTERNAL_SHARE)" }` |
| `400` | Post zaten paylaşılmış | `{ "message": "Post already shared" }` |
| `404` | Post bulunamadı | `{ "message": "Post not found" }` |
| `401` | Yetkisiz erişim | `{ "message": "Unauthorized" }` |

**Örnek Request (Internal Repost):**
```bash
curl -X POST \
  http://localhost:3000/interactions/posts/01J8X9K2M3N4P5Q6R7S8T9U0V/share \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "shareType": "INTERNAL_REPOST"
  }'
```

**Örnek Request (External Share):**
```bash
curl -X POST \
  http://localhost:3000/interactions/posts/01J8X9K2M3N4P5Q6R7S8T9U0V/share \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "shareType": "EXTERNAL_SHARE",
    "platform": "Twitter"
  }'
```

---

## 5. Status Endpoints

### 5.1. Kullanıcının Post ile Etkileşim Durumu

**Endpoint:** `GET /interactions/posts/:postId/status`

**Authentication:** ✅ Gerekli

**Path Parameters:**
- `postId` (string, required): Durumu kontrol edilecek post'un ID'si

**Success Response:**
- **Status Code:** `200 OK`
- **Response Body:**
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

**Response Data Schema:**
```typescript
{
  liked: boolean;      // Kullanıcı post'u beğenmiş mi?
  favorited: boolean;  // Kullanıcı post'u favorilere eklemiş mi?
  shared: boolean;     // Kullanıcı post'u paylaşmış mı?
}
```

**Örnek Request:**
```bash
curl -X GET \
  http://localhost:3000/interactions/posts/01J8X9K2M3N4P5Q6R7S8T9U0V/status \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Kullanım Senaryosu:**
Bu endpoint, bir post'un detay sayfasını açtığınızda kullanıcının o post ile daha önce yaptığı etkileşimleri kontrol etmek için kullanılır. Böylece UI'da butonların durumunu (beğenildi mi, favorilere eklendi mi, paylaşıldı mı) doğru şekilde gösterebilirsiniz.

---

## Hata Yönetimi

### Genel Hata Response Formatı

Tüm hata durumlarında aşağıdaki format kullanılır:

```json
{
  "message": "Hata mesajı açıklaması",
  "code": "ERROR_CODE",  // Optional
  "status": 400          // HTTP status code
}
```

### HTTP Status Kodları

| Status Code | Açıklama |
|------------|----------|
| `200` | İşlem başarılı |
| `201` | Kayıt oluşturuldu |
| `400` | Geçersiz istek (validation hatası, zaten var olan kayıt vb.) |
| `401` | Yetkisiz erişim (token eksik veya geçersiz) |
| `403` | Yasak (yetki yetersiz) |
| `404` | Kayıt bulunamadı |
| `500` | Sunucu hatası |

### Yaygın Hata Mesajları

- `"Post not found"` - Post ID'si geçersiz veya post silinmiş
- `"Comment not found"` - Comment ID'si geçersiz veya comment silinmiş
- `"Post already liked"` - Post zaten beğenilmiş
- `"Post already favorited"` - Post zaten favorilerde
- `"Post already shared"` - Post zaten paylaşılmış
- `"Comment text is required"` - Yorum metni boş gönderilmiş
- `"Unauthorized"` - Token eksik veya geçersiz
- `"Unauthorized to delete this comment"` - Sadece kendi yorumunu silebilirsiniz

---

## Örnek Kullanım Senaryoları

### Senaryo 1: Post Detay Sayfası

Bir post'un detay sayfasını açtığınızda:

1. **Post durumunu kontrol et:**
   ```http
   GET /interactions/posts/:postId/status
   ```
   Response'dan `liked`, `favorited`, `shared` değerlerini al ve UI'da butonları buna göre göster.

2. **Yorumları getir:**
   ```http
   GET /interactions/posts/:postId/comments?limit=20
   ```
   Response'dan `comments` array'ini al ve listele.

### Senaryo 2: Post'a Yorum Yapma

1. **Yorum gönder:**
   ```http
   POST /interactions/posts/:postId/comments
   Body: { "comment": "Harika!" }
   ```

2. **Yorumları yeniden getir:**
   ```http
   GET /interactions/posts/:postId/comments
   ```
   Yeni yorumu listede göster.

### Senaryo 3: Reply Yapma

1. **Reply gönder:**
   ```http
   POST /interactions/posts/:postId/comments
   Body: {
     "comment": "Katılıyorum!",
     "parentId": "01J8X9K2M3N4P5Q6R7S8T9U0X"
   }
   ```

2. **Yorumları yeniden getir:**
   ```http
   GET /interactions/posts/:postId/comments
   ```
   Reply'yi parent comment'in `replies` array'inde göster.

### Senaryo 4: Favoriler Sayfası

1. **Favorileri getir:**
   ```http
   GET /interactions/bookmarks?limit=50
   ```

2. **Her favorite için post bilgilerini getir:**
   ```http
   GET /posts/:postId
   ```
   (Post endpoint'i farklı bir dokümantasyonda)

---

## Notlar

1. **Real-time Bildirimler:** Tüm etkileşimler (like, comment, share, favorite) Socket.IO üzerinden real-time bildirim gönderir. Post sahibi ve ilgili kullanıcılar bildirim alır.

2. **Rate Limiting:** Production'da rate limiting uygulanabilir. Çok fazla istek gönderirseniz `429 Too Many Requests` hatası alabilirsiniz.

3. **Pagination:** `bookmarks` ve `comments` endpoint'leri için `limit` parametresi kullanılır. Gelecekte cursor-based pagination eklenebilir.

4. **Avatar:** Şu anda `user.avatar` field'ı `null` döner. Avatar sistemi eklendiğinde bu field doldurulacaktır.

5. **Nested Replies:** Reply'ler sadece bir seviye derinlikte desteklenir (parent comment → reply). Daha derin nested yapılar şu anda desteklenmez.

---

## Swagger Dokümantasyonu

Tüm endpoint'lerin interaktif dokümantasyonu için:

```
http://localhost:3000/api-docs
```

Swagger UI'da "Interactions" tag'i altında tüm endpoint'leri görebilir ve test edebilirsiniz.

---

**Son Güncelleme:** 29 Aralık 2024  
**Versiyon:** 1.0.0

