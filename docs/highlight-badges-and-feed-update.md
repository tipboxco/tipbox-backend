# Highlight Badges & Event Feed Update

> **Date:** 2026-03-18
> **Changed Files:**
> - `backend/src/application/user/user.service.ts`
> - `backend/src/interfaces/user/user-badge.types.ts`
> - `backend/src/application/event/event.service.ts`
> - `backend/src/interfaces/feed/feed.dto.ts`
> - `backend/src/application/explore/explore.service.ts`
> - `backend/src/interfaces/explore/explore.dto.ts`

---

## 1. GET `/api/users/me/highlight-badges` (EP-05)

Kullanıcının profil highlight badge seçim ekranı için gerekli verileri döner.

### Yapılan Değişiklikler

1. **`claimed: true` filtresi kaldırıldı** — Daha önce sadece claim edilmiş (NFT'ye dönüştürülmüş) badge'ler listeleniyordu. Artık kullanıcının sahip olduğu tüm badge'ler listeleniyor. `claimed` sadece NFT durumunu ifade eder, badge görünürlüğünü etkilememelidir.

2. **Badge tipleri 4'e ayrıldı** — Önceden sadece `event` ve `collection` olarak 2 gruba ayrılıyordu (`mapBadgeCategory` ile). Artık veritabanındaki gerçek `type` alanına göre `COLLECTION`, `EVENT`, `COSMETIC`, `BRAND` olarak 4 ayrı grupta dönüyor.

### Request

```
GET /api/users/me/highlight-badges
Authorization: Bearer <token>
```

### Response (200)

```json
{
  "selectedBadgeIds": [
    "uuid-1",
    "uuid-2"
  ],
  "availableBadges": {
    "collection": [
      {
        "id": "badge-uuid",
        "title": "First Wash",
        "image": "https://api-test.tipbox.co/media/badges/first-wash.png",
        "rarity": "Usual"
      }
    ],
    "event": [
      {
        "id": "badge-uuid",
        "title": "Cabin Approved",
        "image": "https://api-test.tipbox.co/media/badges/cabin-approved.png",
        "rarity": "Rare"
      }
    ],
    "cosmetic": [
      {
        "id": "badge-uuid",
        "title": "Golden Frame",
        "image": "https://api-test.tipbox.co/media/badges/golden-frame.png",
        "rarity": "Epic"
      }
    ],
    "brand": [
      {
        "id": "badge-uuid",
        "title": "Nike Verified",
        "image": "https://api-test.tipbox.co/media/badges/nike-verified.png",
        "rarity": "Legendary"
      }
    ]
  }
}
```

### `availableBadges` Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `collection` | `HighlightBadgeItem[]` | `COLLECTION` tipindeki badge'ler (koleksiyon görevleri ile kazanılan) |
| `event` | `HighlightBadgeItem[]` | `EVENT` tipindeki badge'ler (etkinliklerde kazanılan) |
| `cosmetic` | `HighlightBadgeItem[]` | `COSMETIC` tipindeki badge'ler (kozmetik/görsel badge'ler) |
| `brand` | `HighlightBadgeItem[]` | `BRAND` tipindeki badge'ler (marka iş birlikleri) |

### `HighlightBadgeItem` Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string (uuid)` | Badge ID |
| `title` | `string` | Badge adı |
| `image` | `string \| null` | Badge görsel URL'i |
| `rarity` | `"Usual" \| "Rare" \| "Epic" \| "Legendary"` | Badge nadirlik seviyesi |

---

## 2. PUT `/api/users/me/highlight-badges` (EP-06)

Kullanıcının profilde gösterilecek highlight badge'lerini günceller (maksimum 4).

### Yapılan Değişiklikler

- **`claimed: true` validasyonu kaldırıldı** — Daha önce sadece claim edilmiş badge'ler seçilebiliyordu. Artık kullanıcının sahip olduğu herhangi bir badge highlight olarak seçilebilir.

### Request

```
PUT /api/users/me/highlight-badges
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "badgeIds": [
    "badge-uuid-1",
    "badge-uuid-2",
    "badge-uuid-3",
    "badge-uuid-4"
  ]
}
```

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `badgeIds` | `string[]` | Min: 0, Max: 4, UUID format | Highlight olarak seçilen badge ID'leri |

### Response (200)

```json
{
  "success": true,
  "badgeIds": [
    "badge-uuid-1",
    "badge-uuid-2",
    "badge-uuid-3",
    "badge-uuid-4"
  ]
}
```

### Error Responses

| Status | Condition | Message |
|--------|-----------|---------|
| 400 | 4'ten fazla badge gönderildiğinde | `"Maximum 4 highlight badges allowed"` |
| 400 | Kullanıcıya ait olmayan badge gönderildiğinde | `"Some badges are not owned by the user"` |
| 401 | Token eksik/geçersiz | `"Unauthorized"` |

---

## 3. Event Feed — `hasUpvoted` & `upvotes` Eklendi

Event detay sayfasındaki post listesine upvote bilgisi eklendi.

### Değişiklikler

- `BaseStats`'a `upvotes` field'ı eklendi
- `BasePost`'a `hasUpvoted` field'ı eklendi
- Event post query'sine kullanıcının vote kaydı include edildi

### Güncellenen Response Alanları

#### `stats` objesine eklenen:

| Field | Type | Description |
|-------|------|-------------|
| `upvotes` | `number` | Post'un toplam upvote sayısı |

#### `post` objesine eklenen:

| Field | Type | Description |
|-------|------|-------------|
| `hasUpvoted` | `boolean` | Mevcut kullanıcı bu post'u upvote etmiş mi |

---

## 4. Explore Events — `eventType` Düzeltmesi

`GET /api/explore/events` endpoint'inde `eventType` alanı her zaman hardcoded `"SURVEY"` olarak dönüyordu. Artık Event modelindeki `feedType` alanından dinamik olarak okunuyor.

### Yapılan Değişiklikler

- **`eventType` artık `event.feedType`'dan geliyor** — Önceden tüm event'ler için sabit `"SURVEY"` dönüyordu. Artık veritabanındaki `feed_type` kolonunun gerçek değeri kullanılıyor.
- **`EventType` tipi güncellendi** — `'SURVEY' | 'POLL' | 'CONTEST' | 'CHALLENGE' | 'PROMOTION'` yerine `'PICKS' | 'ROASTS'` olarak değiştirildi (`EventFeedType` enum'una uygun).

### Güncellenen Response Alanı

| Field | Type | Önceki | Sonraki |
|-------|------|--------|---------|
| `eventType` | `string` | Her zaman `"SURVEY"` | `"PICKS"` veya `"ROASTS"` (event'in `feedType` değerine göre) |
