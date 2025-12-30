# User Settings Endpoints API Dokümantasyonu

Bu dokümantasyon, mobil uygulama entegrasyonu için User Settings endpoint'lerinin request-response yapılarını içermektedir.

## Base URL

```
https://api.tipbox.co/users
```

veya test ortamı için:

```
https://api-test.tipbox.co/users
```

## Authentication

Tüm endpoint'ler JWT Bearer token ile korunmaktadır. İsteklerde `Authorization` header'ı kullanılmalıdır:

```
Authorization: Bearer <token>
```

---

## 1. Şifre Değiştirme

### POST `/users/settings/change-password`

Kullanıcının şifresini değiştirir.

#### Request Headers

```
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body

```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword123"
}
```

#### Request Schema

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `currentPassword` | string | Evet | Mevcut şifre |
| `newPassword` | string | Evet | Yeni şifre (minimum 6 karakter) |

#### Success Response (200)

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

#### Error Responses

**400 Bad Request**
```json
{
  "error": {
    "message": "Current password and new password are required"
  }
}
```

veya

```json
{
  "error": {
    "message": "Invalid current password"
  }
}
```

**401 Unauthorized**
```json
{
  "error": {
    "message": "Unauthorized"
  }
}
```

---

## 2. Bildirim Ayarları

### GET `/users/settings/notifications`

Kullanıcının bildirim ayarlarını getirir.

#### Request Headers

```
Authorization: Bearer <token>
```

#### Success Response (200)

```json
[
  {
    "notificationCode": 0,
    "value": true
  },
  {
    "notificationCode": 1,
    "value": true
  },
  {
    "notificationCode": 2,
    "value": false
  }
]
```

#### Response Schema

| Alan | Tip | Açıklama |
|------|-----|----------|
| `notificationCode` | integer | Bildirim tipi kodu (0: EMAIL, 1: PUSH, 2: IN_APP) |
| `value` | boolean | Bildirim durumu (true: açık, false: kapalı) |

#### Notification Codes

- `0` - EMAIL: E-posta bildirimleri
- `1` - PUSH: Push bildirimleri
- `2` - IN_APP: Uygulama içi bildirimler

#### Error Responses

**401 Unauthorized**
```json
{
  "error": {
    "message": "Unauthorized"
  }
}
```

---

### PUT `/users/settings/notifications`

Kullanıcının bildirim ayarlarını günceller.

#### Request Headers

```
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body

```json
[
  {
    "notificationCode": 0,
    "value": true
  },
  {
    "notificationCode": 1,
    "value": false
  },
  {
    "notificationCode": 2,
    "value": true
  }
]
```

#### Request Schema

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `notificationCode` | integer | Evet | Bildirim tipi kodu (0, 1, veya 2) |
| `value` | boolean | Evet | Bildirim durumu |

#### Success Response (200)

```json
{
  "success": true,
  "message": "Notification settings updated successfully"
}
```

#### Error Responses

**400 Bad Request**
```json
{
  "message": "Settings must be an array"
}
```

veya

```json
{
  "success": false,
  "message": "Failed to update notification settings"
}
```

**401 Unauthorized**
```json
{
  "message": "Unauthorized"
}
```

---

## 3. Gizlilik Ayarları

### GET `/users/settings/privacy`

Kullanıcının gizlilik ayarlarını getirir.

#### Request Headers

```
Authorization: Bearer <token>
```

#### Success Response (200)

```json
[
  {
    "privacyCode": 0,
    "selectedValue": "trust-only"
  },
  {
    "privacyCode": 1,
    "selectedValue": "everyone"
  },
  {
    "privacyCode": 2,
    "selectedValue": "everyone"
  }
]
```

#### Response Schema

| Alan | Tip | Açıklama |
|------|-----|----------|
| `privacyCode` | integer | Gizlilik ayarı kodu |
| `selectedValue` | string | Seçilen değer |

#### Privacy Codes

- `0` - NFT_BADGE_COLLECTIONS: NFT rozet koleksiyonları görünürlüğü
- `1` - TRUST_TRUSTER_LIST: Güven listesi görünürlüğü
- `2` - ONE_ON_ONE_SUPPORT: Birebir destek görünürlüğü

#### Selected Values

- `"trust-only"` - Sadece güvendiğim kişiler
- `"everyone"` - Herkes

#### Default Values

- `NFT_BADGE_COLLECTIONS`: `"trust-only"`
- `TRUST_TRUSTER_LIST`: `"everyone"`
- `ONE_ON_ONE_SUPPORT`: `"everyone"`

#### Error Responses

**401 Unauthorized**
```json
{
  "message": "Unauthorized"
}
```

---

### PUT `/users/settings/privacy`

Kullanıcının gizlilik ayarlarını günceller.

#### Request Headers

```
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body

```json
[
  {
    "privacyCode": 0,
    "selectedValue": "trust-only"
  },
  {
    "privacyCode": 1,
    "selectedValue": "everyone"
  },
  {
    "privacyCode": 2,
    "selectedValue": "trust-only"
  }
]
```

#### Request Schema

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `privacyCode` | integer | Evet | Gizlilik ayarı kodu (0, 1, veya 2) |
| `selectedValue` | string | Evet | Seçilen değer ("trust-only" veya "everyone") |

#### Success Response (200)

```json
{
  "success": true,
  "message": "Privacy settings updated successfully"
}
```

#### Error Responses

**400 Bad Request**
```json
{
  "message": "Settings must be an array"
}
```

veya

```json
{
  "success": false,
  "message": "Failed to update privacy settings"
}
```

**401 Unauthorized**
```json
{
  "message": "Unauthorized"
}
```

---

## 4. Destek Oturumu Fiyatı

### GET `/users/settings/support-session-price`

Kullanıcının destek oturumu fiyatını getirir.

#### Request Headers

```
Authorization: Bearer <token>
```

#### Success Response (200)

```json
{
  "price": 50
}
```

veya fiyat ayarlanmamışsa:

```json
{
  "price": null
}
```

#### Response Schema

| Alan | Tip | Açıklama |
|------|-----|----------|
| `price` | number \| null | Destek oturumu fiyatı (TIPS cinsinden) veya null |

#### Error Responses

**401 Unauthorized**
```json
{
  "message": "Unauthorized"
}
```

---

### PUT `/users/settings/support-session-price`

Kullanıcının destek oturumu fiyatını günceller. Minimum 50 TIPS olmalı ve 10 günde bir değiştirilebilir.

#### Request Headers

```
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body

```json
{
  "price": 50
}
```

#### Request Schema

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| `price` | number | Evet | Destek oturumu fiyatı (minimum 50 TIPS) |

#### Success Response (200)

```json
{
  "success": true,
  "message": "Support session price updated successfully"
}
```

#### Error Responses

**400 Bad Request**

Fiyat eksik veya geçersiz:
```json
{
  "message": "Price is required and must be a number"
}
```

Minimum fiyat kontrolü:
```json
{
  "error": {
    "message": "Minimum 50 TIPS can be set"
  }
}
```

10 gün kuralı:
```json
{
  "error": {
    "message": "The amount can be changed once every 10 days"
  }
}
```

**401 Unauthorized**
```json
{
  "message": "Unauthorized"
}
```

---

## 5. Bağlı Cihazlar

### GET `/users/settings/devices`

Kullanıcının bağlı cihazlarını getirir.

#### Request Headers

```
Authorization: Bearer <token>
```

#### Success Response (200)

```json
[
  {
    "id": "device-id-1",
    "name": "iPhone 14 Pro",
    "location": "Istanbul, Turkey",
    "date": "2024-01-15T10:30:00.000Z",
    "isActive": true
  },
  {
    "id": "device-id-2",
    "name": "Chrome on Windows",
    "location": null,
    "date": "2024-01-10T08:20:00.000Z",
    "isActive": false
  }
]
```

#### Response Schema

| Alan | Tip | Açıklama |
|------|-----|----------|
| `id` | string | Cihaz benzersiz kimliği |
| `name` | string | Cihaz adı |
| `location` | string \| null | Cihaz konumu (varsa) |
| `date` | string | Son giriş tarihi (ISO 8601 formatında) |
| `isActive` | boolean | Cihazın aktif olup olmadığı |

#### Error Responses

**401 Unauthorized**
```json
{
  "message": "Unauthorized"
}
```

---

### DELETE `/users/settings/devices/:deviceId`

Bağlı cihazı listeden kaldırır.

#### Request Headers

```
Authorization: Bearer <token>
```

#### Path Parameters

| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| `deviceId` | string | Evet | Kaldırılacak cihazın ID'si |

#### Success Response (200)

```json
{
  "success": true,
  "message": "Device removed successfully"
}
```

#### Error Responses

**401 Unauthorized**
```json
{
  "message": "Unauthorized"
}
```

**404 Not Found**
```json
{
  "success": false,
  "message": "Device not found"
}
```

---

## Hata Yönetimi

### Genel Hata Formatı

Tüm endpoint'ler tutarlı bir hata formatı kullanır:

```json
{
  "error": {
    "message": "Hata mesajı"
  }
}
```

veya bazı endpoint'lerde:

```json
{
  "message": "Hata mesajı"
}
```

### HTTP Status Kodları

- `200` - Başarılı işlem
- `400` - Geçersiz istek (validation hatası, iş kuralı ihlali)
- `401` - Yetkilendirme hatası (token eksik veya geçersiz)
- `404` - Kaynak bulunamadı
- `500` - Sunucu hatası

---

## Örnek Kullanım Senaryoları

### Senaryo 1: Bildirim Ayarlarını Güncelleme

```bash
# 1. Bildirim ayarlarını getir
GET /users/settings/notifications
Authorization: Bearer <token>

# 2. E-posta bildirimlerini kapat, push bildirimlerini aç
PUT /users/settings/notifications
Authorization: Bearer <token>
Content-Type: application/json

[
  { "notificationCode": 0, "value": false },
  { "notificationCode": 1, "value": true },
  { "notificationCode": 2, "value": true }
]
```

### Senaryo 2: Gizlilik Ayarlarını Yapılandırma

```bash
# 1. Mevcut gizlilik ayarlarını getir
GET /users/settings/privacy
Authorization: Bearer <token>

# 2. NFT koleksiyonlarını sadece güvendiğim kişilere göster
PUT /users/settings/privacy
Authorization: Bearer <token>
Content-Type: application/json

[
  { "privacyCode": 0, "selectedValue": "trust-only" },
  { "privacyCode": 1, "selectedValue": "everyone" },
  { "privacyCode": 2, "selectedValue": "everyone" }
]
```

### Senaryo 3: Destek Oturumu Fiyatı Ayarlama

```bash
# 1. Mevcut fiyatı kontrol et
GET /users/settings/support-session-price
Authorization: Bearer <token>

# 2. Fiyatı 100 TIPS olarak güncelle
PUT /users/settings/support-session-price
Authorization: Bearer <token>
Content-Type: application/json

{
  "price": 100
}
```

### Senaryo 4: Cihaz Yönetimi

```bash
# 1. Bağlı cihazları listele
GET /users/settings/devices
Authorization: Bearer <token>

# 2. Bir cihazı kaldır
DELETE /users/settings/devices/device-id-123
Authorization: Bearer <token>
```

---

## Notlar

1. **Token Yönetimi**: Tüm endpoint'ler JWT token gerektirir. Token'ın geçerli ve süresi dolmamış olmalıdır.

2. **Fiyat Güncelleme Kısıtı**: Destek oturumu fiyatı 10 günde bir değiştirilebilir. Son güncellemeden 10 gün geçmeden yeni bir güncelleme yapılamaz.

3. **Minimum Fiyat**: Destek oturumu fiyatı minimum 50 TIPS olmalıdır.

4. **Array Validasyonu**: Bildirim ve gizlilik ayarları array formatında gönderilmelidir.

5. **Default Değerler**: Eğer kullanıcının ayarları yoksa, sistem default değerler kullanır.

6. **Tarih Formatı**: Tüm tarih alanları ISO 8601 formatında (UTC) döner.

---

## Mobil Entegrasyon İpuçları

1. **Token Storage**: JWT token'ı güvenli bir şekilde saklayın (Keychain/Keystore).

2. **Error Handling**: Tüm hata durumlarını kullanıcıya anlaşılır mesajlarla gösterin.

3. **Loading States**: Her API çağrısında loading state gösterin.

4. **Offline Support**: Mümkünse offline durumda cached verileri gösterin.

5. **Retry Logic**: Network hatalarında otomatik retry mekanizması ekleyin.

6. **Validation**: Client-side validation yapın, ancak server response'larını da kontrol edin.

