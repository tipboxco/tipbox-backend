# Frontend API Endpoint'leri - Detaylı Dokümantasyon

Bu dokümantasyon, frontend'de henüz bağlanmamış olan endpoint'lerin detaylı request/response yapılarını içerir.

---

## 📋 İçindekiler

1. [Send Gift (TIPS Gönderme)](#1-send-gift-tips-gönderme)
2. [1-on-1 Request (Support Request)](#2-1-on-1-request-support-request)
3. [DM (Direct Message)](#3-dm-direct-message)
4. [Edit Profile](#4-edit-profile)
5. [Marketplace - Satışa Koyma](#5-marketplace---satışa-koyma)
6. [Marketplace - Delist](#6-marketplace---delist)

---

## 1. Send Gift (TIPS Gönderme)

### Endpoint
```
POST /messages/tips
```

### Authentication
```
Authorization: Bearer <token>
```

### Request Body
```typescript
{
  senderUserId: string;      // UUID - JWT token'daki userId ile eşleşmeli
  recipientUserId: string;   // UUID - TIPS gönderilecek kullanıcı ID'si
  message: string;            // TIPS ile birlikte gönderilecek mesaj
  amount: number;            // Gönderilecek TIPS miktarı (minimum 0.01)
  timestamp: string;          // ISO 8601 formatında (örn: "2024-01-15T10:30:00Z")
}
```

### Örnek Request
```json
{
  "senderUserId": "550e8400-e29b-41d4-a716-446655440000",
  "recipientUserId": "660e8400-e29b-41d4-a716-446655440001",
  "message": "Teşekkürler!",
  "amount": 100.50,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Response
**Status Code:** `201 Created`

**Body:** Yok (sadece status code döner)

### Hata Durumları

#### 400 Bad Request
```json
{
  "message": "recipientUserId is required"
}
```

```json
{
  "message": "amount must be a positive number"
}
```

```json
{
  "message": "message is required"
}
```

```json
{
  "message": "timestamp is required"
}
```

```json
{
  "message": "Invalid timestamp format. Expected ISO 8601 format (e.g., 2024-01-15T10:30:00Z)"
}
```

#### 401 Unauthorized
```json
{
  "message": "Unauthorized"
}
```

#### 403 Forbidden
```json
{
  "message": "senderUserId does not match authenticated user"
}
```

### Socket Events
İşlem başarılı olduğunda şu socket event'leri tetiklenir:
- `new_message` (alıcıya gönderilir)
- `message_sent` (göndericiye gönderilir)

**Event Payload:**
```typescript
{
  messageId: string;
  threadId: string;
  senderId: string;
  recipientId: string;
  message: string;
  messageType: "send-tips";
  amount: number;
  context: "DM";
  timestamp: string; // ISO 8601
}
```

---

## 2. 1-on-1 Request (Support Request)

### Endpoint
```
POST /messages/support-requests
```

### Authentication
```
Authorization: Bearer <token>
```

### Request Body
```typescript
{
  senderUserId: string;      // UUID - JWT token'daki userId ile eşleşmeli
  recipientUserId: string;   // UUID - Destek talebi gönderilecek kullanıcı ID'si
  type: "GENERAL" | "TECHNICAL" | "PRODUCT";  // Destek talebi tipi
  message: string;            // Destek talebi mesajı
  amount: string;             // Destek talebi için önerilen miktar (string formatında)
  status: "pending";         // Genellikle "pending" olarak gönderilir
  timestamp: string;          // ISO 8601 formatında
}
```

### Örnek Request
```json
{
  "senderUserId": "550e8400-e29b-41d4-a716-446655440000",
  "recipientUserId": "660e8400-e29b-41d4-a716-446655440001",
  "type": "GENERAL",
  "message": "Yardıma ihtiyacım var",
  "amount": "50.00",
  "status": "pending",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Response
**Status Code:** `201 Created`

**Body:** Yok (sadece status code döner)

### Hata Durumları

#### 400 Bad Request
```json
{
  "message": "senderUserId is required"
}
```

```json
{
  "message": "recipientUserId is required"
}
```

```json
{
  "message": "type is required"
}
```

```json
{
  "message": "type must be one of: GENERAL, TECHNICAL, PRODUCT"
}
```

```json
{
  "message": "message is required"
}
```

```json
{
  "message": "amount is required and must be a string"
}
```

```json
{
  "message": "amount must be a valid number string"
}
```

```json
{
  "message": "status is required"
}
```

```json
{
  "message": "status must be one of: pending, accepted, rejected"
}
```

```json
{
  "message": "timestamp is required"
}
```

```json
{
  "message": "Invalid timestamp format. Expected ISO 8601 format (e.g., 2024-01-15T10:30:00Z)"
}
```

#### 401 Unauthorized
```json
{
  "message": "Unauthorized"
}
```

#### 403 Forbidden
```json
{
  "message": "senderUserId does not match authenticated user"
}
```

### Socket Events
İşlem başarılı olduğunda `new_message` socket event'i tetiklenir (alıcıya gönderilir).

**Event Payload:**
```typescript
{
  messageId: string;
  threadId: string | null; // pending durumunda null
  senderId: string;
  recipientId: string;
  message: string;
  messageType: "support-request";
  context: "DM";
  timestamp: string; // ISO 8601
}
```

---

## 3. DM (Direct Message)

### Endpoint
```
POST /messages
```

### Authentication
```
Authorization: Bearer <token>
```

### Request Body
```typescript
{
  recipientUserId: string;   // UUID - Mesaj gönderilecek kullanıcı ID'si
  message: string;            // Mesaj içeriği
}
```

### Örnek Request
```json
{
  "recipientUserId": "660e8400-e29b-41d4-a716-446655440001",
  "message": "Merhaba, nasılsın?"
}
```

### Response
**Status Code:** `201 Created`

**Body:** Yok (sadece status code döner)

### Hata Durumları

#### 400 Bad Request
```json
{
  "message": "recipientUserId is required"
}
```

```json
{
  "message": "message is required"
}
```

#### 401 Unauthorized
```json
{
  "message": "Unauthorized"
}
```

### Socket Events
İşlem başarılı olduğunda şu socket event'leri tetiklenir:
- `new_message` (alıcıya gönderilir)
- `message_sent` (göndericiye gönderilir)

**Event Payload:**
```typescript
{
  messageId: string;
  threadId: string;
  senderId: string;
  recipientId: string;
  message: string;
  messageType: "message";
  context: "DM";
  timestamp: string; // ISO 8601
}
```

---

## 4. Edit Profile

### Endpoint
```
PUT /users/me/profile
```

### Authentication
```
Authorization: Bearer <token>
```

### Request Body
```typescript
{
  name?: string;              // Profilde gösterilecek isim (min 2 karakter)
  biography?: string;         // Kullanıcı biyografisi (max 500 karakter)
  banner?: string | null;    // Banner görsel URL'si (MinIO/S3)
  avatar?: string | null;     // Avatar görsel URL'si (MinIO/S3)
  cosmetic?: string | null;  // Aktif kozmetik badge/çerçeve ID'si
  badge?: string[];           // Aktif olarak seçilen badge ID listesi
}
```

### Örnek Request
```json
{
  "name": "Ömer Faruk",
  "biography": "Teknoloji meraklısı. Donanım ve yazılım üzerine yazıyorum.",
  "banner": "https://cdn.tipbox.co/profile-banners/user123/banner.jpg",
  "avatar": "https://cdn.tipbox.co/profile-pictures/user123/avatar.jpg",
  "cosmetic": "badge-123",
  "badge": ["badge-456", "badge-789"]
}
```

### Response
**Status Code:** `200 OK`

```typescript
{
  success: boolean;           // true
  profile: {
    id: string;
    name: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    biography: string | null;
    titles: string[];
    stats: {
      posts: number;
      trust: number;
      truster: number;
    };
    badges: Array<{
      id: string;
      title: string;
      image: string | null;
    }>;
    cosmetics: {
      activeBadge: {
        id: string;
        title: string;
        image: string | null;
      } | null;
      activeBanner: {
        id: string;
        image: string | null;
      } | null;
    };
    isTrusted: boolean;
  }
}
```

### Örnek Response
```json
{
  "success": true,
  "profile": {
    "id": "b6d8c1f2-4a9b-4d1c-9e2a-123456789abc",
    "name": "Ömer Faruk",
    "avatarUrl": "https://cdn.tipbox.co/profile-pictures/user123/avatar.jpg",
    "bannerUrl": "https://cdn.tipbox.co/profile-banners/user123/banner.jpg",
    "biography": "Teknoloji meraklısı. Donanım ve yazılım üzerine yazıyorum.",
    "titles": ["Technology Enthusiast", "Digital Surfer", "Hardware Expert"],
    "stats": {
      "posts": 42,
      "trust": 15,
      "truster": 28
    },
    "badges": [
      {
        "id": "badge-456",
        "title": "Rare Builder",
        "image": "https://cdn.tipbox.co/badges/rare-builder.png"
      },
      {
        "id": "badge-789",
        "title": "Epic Contributor",
        "image": "https://cdn.tipbox.co/badges/epic-contributor.png"
      }
    ],
    "cosmetics": {
      "activeBadge": {
        "id": "badge-123",
        "title": "Premium Badge",
        "image": "https://cdn.tipbox.co/badges/premium.png"
      },
      "activeBanner": {
        "id": "banner-123",
        "image": "https://cdn.tipbox.co/banners/premium-banner.png"
      }
    },
    "isTrusted": false
  }
}
```

### Hata Durumları

#### 400 Bad Request
```json
{
  "message": "İsim en az 2 karakter olmalıdır"
}
```

```json
{
  "message": "Biyografi en fazla 500 karakter olabilir"
}
```

```json
{
  "message": "badge alanı bir dizi olmalıdır"
}
```

#### 401 Unauthorized
```json
{
  "message": "Unauthorized"
}
```

---

## 5. Marketplace - Satışa Koyma

### Endpoint
```
POST /marketplace/listings
```

### Authentication
```
Authorization: Bearer <token>
```

### Request Body
```typescript
{
  nftId: string;              // Satışa konulacak NFT'nin ID'si
  amount: number;             // TIPS miktarı (fiyat) - pozitif sayı olmalı
}
```

### Örnek Request
```json
{
  "nftId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "amount": 125.50
}
```

### Response
**Status Code:** `200 OK`

```typescript
{
  id: string;                 // Listing ID'si
  title: string;              // NFT adı
  description?: string;       // NFT açıklaması
  username: string;           // Satıcı kullanıcı adı
  price: string;              // Fiyat (string formatında, TIPS)
  image: string;              // NFT görsel URL'si
  userAvatar?: string;        // Satıcı avatar URL'si
  rarity: string;            // "usual" | "rare" | "epic" | "legendary"
  type: string;              // "BADGE" | "COSMETIC" | "LOOTBOX"
  listedAt: string;          // ISO 8601 formatında
  sellerId: string;          // Satıcı kullanıcı ID'si
  nftId: string;             // NFT ID'si
}
```

### Örnek Response
```json
{
  "id": "listing-123-456-789",
  "title": "Rare Builder Badge",
  "description": "Bu rozet nadir bir başarıyı temsil eder",
  "username": "omerfaruk",
  "price": "125.50",
  "image": "https://cdn.tipbox.co/badges/rare-builder.png",
  "userAvatar": "https://cdn.tipbox.co/profile-pictures/user123/avatar.jpg",
  "rarity": "rare",
  "type": "BADGE",
  "listedAt": "2024-01-15T10:30:00.000Z",
  "sellerId": "550e8400-e29b-41d4-a716-446655440000",
  "nftId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### Hata Durumları

#### 400 Bad Request
```json
{
  "message": "nftId ve amount (pozitif sayı) gerekli"
}
```

```json
{
  "message": "NFT bulunamadı"
}
```

```json
{
  "message": "Bu NFT zaten satışta"
}
```

#### 401 Unauthorized
```json
{
  "message": "Unauthorized"
}
```

#### 403 Forbidden
```json
{
  "message": "Bu NFT size ait değil"
}
```

---

## 6. Marketplace - Delist (Satıştan Kaldırma)

### Endpoint
```
DELETE /marketplace/listings/:listingId
```

### Authentication
```
Authorization: Bearer <token>
```

### Path Parameters
- `listingId`: string (UUID) - İptal edilecek listing ID'si

### Request Body
Yok

### Örnek Request
```
DELETE /marketplace/listings/listing-123-456-789
```

### Response
**Status Code:** `200 OK`

```typescript
{
  message: string;            // "Listing başarıyla iptal edildi"
}
```

### Örnek Response
```json
{
  "message": "Listing başarıyla iptal edildi"
}
```

### Hata Durumları

#### 400 Bad Request
```json
{
  "message": "Bu listing iptal edilemez"
}
```

#### 401 Unauthorized
```json
{
  "message": "Unauthorized"
}
```

#### 403 Forbidden
```json
{
  "message": "Bu listing size ait değil"
}
```

#### 404 Not Found
```json
{
  "message": "Listing bulunamadı"
}
```

---

## 📝 Genel Notlar

### Authentication
Tüm endpoint'ler `Authorization: Bearer <token>` header'ı gerektirir. Token, login endpoint'inden alınan JWT token'dır.

### Base URL
- **Development:** `http://localhost:3000`
- **Test:** `https://api-test.tipbox.co`
- **Production:** `https://api.tipbox.co`

### Hata Yönetimi
Tüm endpoint'ler standart HTTP status code'ları kullanır:
- `200 OK`: Başarılı işlem
- `201 Created`: Yeni kayıt oluşturuldu
- `400 Bad Request`: Geçersiz istek
- `401 Unauthorized`: Kimlik doğrulaması başarısız
- `403 Forbidden`: Yetki yok
- `404 Not Found`: Kayıt bulunamadı
- `500 Internal Server Error`: Sunucu hatası

### Socket Events
Bazı endpoint'ler (Send Gift, 1-1 Request, DM) başarılı olduğunda socket event'leri tetikler. Frontend'de socket bağlantısı kurulmuş olmalıdır.

### Validation Kuralları

#### Send Gift
- `amount`: Pozitif sayı olmalı (minimum 0.01)
- `message`: Boş string olamaz
- `timestamp`: Geçerli ISO 8601 formatında olmalı

#### 1-on-1 Request
- `type`: "GENERAL", "TECHNICAL" veya "PRODUCT" olmalı
- `amount`: Geçerli bir sayı string'i olmalı
- `status`: "pending", "accepted" veya "rejected" olmalı

#### Edit Profile
- `name`: Minimum 2 karakter
- `biography`: Maksimum 500 karakter
- `badge`: Array olmalı (string[])

#### Marketplace
- `amount`: Pozitif sayı olmalı
- `nftId`: Geçerli UUID formatında olmalı

---

## 🔗 İlgili Endpoint'ler

### Support Request İşlemleri
- `GET /messages/support-requests` - Support request listesi
- `POST /messages/support-requests/:requestId/accept` - Support request'i kabul et
- `POST /messages/support-requests/:requestId/reject` - Support request'i reddet
- `POST /messages/support-requests/:requestId/cancel` - Support request'i iptal et

### Marketplace İşlemleri
- `GET /marketplace/listings` - Aktif listing'leri listele
- `GET /marketplace/my-nfts` - Kullanıcının NFT'leri
- `PUT /marketplace/listings/:listingId/price` - Listing fiyatını güncelle
- `GET /marketplace/sell/:nftId` - NFT satış bilgileri
- `GET /marketplace/sell/:nftId/detail` - NFT satış detayı

### Profile İşlemleri
- `GET /users/me/profile` - Kendi profil bilgilerini getir
- `GET /users/:id/profile` - Başka kullanıcının profil bilgilerini getir
- `GET /users/:id/profile-card` - Profil kartı bilgileri

---

## 📌 Örnek Kullanım Senaryoları

### Senaryo 1: Kullanıcıya TIPS Gönderme
```typescript
// 1. Kullanıcı profil sayfasında "Send Gift" butonuna tıklar
// 2. Modal açılır, miktar ve mesaj girilir
// 3. API çağrısı yapılır

const sendGift = async (recipientId: string, amount: number, message: string) => {
  const response = await fetch('http://localhost:3000/messages/tips', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      senderUserId: currentUserId,
      recipientUserId: recipientId,
      message: message,
      amount: amount,
      timestamp: new Date().toISOString()
    })
  });
  
  if (response.status === 201) {
    // Başarılı - Socket event'i gelecek
    console.log('TIPS gönderildi');
  } else {
    const error = await response.json();
    console.error('Hata:', error.message);
  }
};
```

### Senaryo 2: 1-on-1 Support Request Oluşturma
```typescript
const createSupportRequest = async (
  recipientId: string, 
  type: 'GENERAL' | 'TECHNICAL' | 'PRODUCT',
  message: string,
  amount: number
) => {
  const response = await fetch('http://localhost:3000/messages/support-requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      senderUserId: currentUserId,
      recipientUserId: recipientId,
      type: type,
      message: message,
      amount: amount.toString(),
      status: 'pending',
      timestamp: new Date().toISOString()
    })
  });
  
  if (response.status === 201) {
    console.log('Support request oluşturuldu');
  } else {
    const error = await response.json();
    console.error('Hata:', error.message);
  }
};
```

### Senaryo 3: Profil Düzenleme
```typescript
const updateProfile = async (profileData: {
  name?: string;
  biography?: string;
  banner?: string | null;
  avatar?: string | null;
  cosmetic?: string | null;
  badge?: string[];
}) => {
  const response = await fetch('http://localhost:3000/users/me/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(profileData)
  });
  
  if (response.ok) {
    const data = await response.json();
    // data.profile içinde güncellenmiş profil bilgileri var
    return data.profile;
  } else {
    const error = await response.json();
    throw new Error(error.message);
  }
};
```

### Senaryo 4: NFT'yi Satışa Koyma
```typescript
const listNFT = async (nftId: string, price: number) => {
  const response = await fetch('http://localhost:3000/marketplace/listings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      nftId: nftId,
      amount: price
    })
  });
  
  if (response.ok) {
    const listing = await response.json();
    // listing içinde oluşturulan listing bilgileri var
    return listing;
  } else {
    const error = await response.json();
    throw new Error(error.message);
  }
};
```

### Senaryo 5: Listing'i İptal Etme
```typescript
const cancelListing = async (listingId: string) => {
  const response = await fetch(`http://localhost:3000/marketplace/listings/${listingId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (response.ok) {
    const data = await response.json();
    console.log(data.message); // "Listing başarıyla iptal edildi"
  } else {
    const error = await response.json();
    throw new Error(error.message);
  }
};
```

---

## 🚀 Hızlı Başlangıç

### TypeScript Interface'leri

```typescript
// Send Gift
interface SendGiftRequest {
  senderUserId: string;
  recipientUserId: string;
  message: string;
  amount: number;
  timestamp: string;
}

// Support Request
interface SupportRequestCreate {
  senderUserId: string;
  recipientUserId: string;
  type: 'GENERAL' | 'TECHNICAL' | 'PRODUCT';
  message: string;
  amount: string;
  status: 'pending';
  timestamp: string;
}

// Direct Message
interface DirectMessageRequest {
  recipientUserId: string;
  message: string;
}

// Edit Profile
interface UpdateProfileRequest {
  name?: string;
  biography?: string;
  banner?: string | null;
  avatar?: string | null;
  cosmetic?: string | null;
  badge?: string[];
}

interface ProfileResponse {
  success: boolean;
  profile: {
    id: string;
    name: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    biography: string | null;
    titles: string[];
    stats: {
      posts: number;
      trust: number;
      truster: number;
    };
    badges: Array<{
      id: string;
      title: string;
      image: string | null;
    }>;
    cosmetics: {
      activeBadge: {
        id: string;
        title: string;
        image: string | null;
      } | null;
      activeBanner: {
        id: string;
        image: string | null;
      } | null;
    };
    isTrusted: boolean;
  };
}

// Marketplace Listing
interface CreateListingRequest {
  nftId: string;
  amount: number;
}

interface ListingResponse {
  id: string;
  title: string;
  description?: string;
  username: string;
  price: string;
  image: string;
  userAvatar?: string;
  rarity: 'usual' | 'rare' | 'epic' | 'legendary';
  type: 'BADGE' | 'COSMETIC' | 'LOOTBOX';
  listedAt: string;
  sellerId: string;
  nftId: string;
}
```

---

## 📞 Destek

Sorularınız için backend ekibi ile iletişime geçebilirsiniz.

**Not:** Bu dokümantasyon, backend servislerindeki mevcut endpoint'lerin detaylı açıklamalarını içerir. Endpoint'lerde değişiklik olması durumunda bu dokümantasyon güncellenmelidir.


