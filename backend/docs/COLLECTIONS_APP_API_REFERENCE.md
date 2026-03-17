# Collections App API Reference

> Base path: `/api/collections` (veya `/api/events/collections`)
> Auth: Tüm endpointler `Bearer token` gerektirir.
> Son güncelleme: 2026-03-17 — `highlightsImage` alanı eklendi.

---

## EP-01: Collections List

Tüm collection'ları listeler. Arama, kategori filtresi, durum filtresi ve cursor tabanlı pagination destekler.

```
GET /api/collections/
```

### Query Parameters

| Param           | Type   | Default | Description                                                    |
|-----------------|--------|---------|----------------------------------------------------------------|
| `search`        | string | —       | Collection title/description'da arama (500ms debounce önerilir)|
| `category`      | string | —       | Chip filter kategori handle'ı (EP-02'den dönen `handle` değeri)|
| `mainCategoryId`| string | —       | Bottom sheet ana kategori ID                                   |
| `subCategoryId` | string | —       | Bottom sheet alt kategori ID                                   |
| `productGroupId`| string | —       | Bottom sheet ürün grubu ID                                     |
| `status`        | string | `all`   | `all` \| `completed` \| `in_progress` \| `not_started`        |
| `cursor`        | string | —       | Pagination cursor (infinite scroll)                            |
| `limit`         | number | `20`    | Sayfa başına item (min: 1, max: 50)                            |

### Filtreleme Rehberi

EP-01 üç farklı filtreleme yöntemini destekler. Frontend ekibi ihtiyaca göre bunları kombine edebilir.

#### 1. Chip Filter (Kategori Handle)

Üstteki yatay kaydırılabilir chip'ler için kullanılır. Önce EP-02'den kategorileri çek, sonra seçilen chip'in `handle` değerini gönder.

```
# Önce kategorileri çek
GET /api/collections/categories
→ [{ id: "uuid-1", name: "Electronics", handle: "electronics" }, ...]

# Seçilen chip ile filtrele
GET /api/collections/?category=electronics
```

- `category` boş veya `all` gönderilirse filtre uygulanmaz (tüm collection'lar döner).
- Sadece en az 1 collection'a sahip kategoriler EP-02'den döner.

#### 2. Bottom Sheet Filter (Kategori ID)

Hiyerarşik kategori seçimi için kullanılır. Ana kategori → alt kategori şeklinde çalışır.

```
# Sadece ana kategori seçildi
GET /api/collections/?mainCategoryId=uuid-main

# Ana + alt kategori seçildi (alt kategori öncelikli)
GET /api/collections/?mainCategoryId=uuid-main&subCategoryId=uuid-sub
```

- `subCategoryId` varsa sadece o kullanılır, `mainCategoryId` ignore edilir.
- `subCategoryId` yoksa `mainCategoryId` kullanılır.

#### 3. Durum Filtresi (Status)

Kullanıcının ilerleme durumuna göre filtreler.

```
GET /api/collections/?status=completed
GET /api/collections/?status=in_progress
GET /api/collections/?status=not_started
GET /api/collections/?status=all          # varsayılan, filtre yok
```

| Değer          | Açıklama                                              |
|----------------|-------------------------------------------------------|
| `all`          | Tüm collection'lar (varsayılan)                       |
| `completed`    | `currentProgress >= totalProgress` olanlar            |
| `in_progress`  | `currentProgress > 0 && currentProgress < totalProgress` |
| `not_started`  | `currentProgress === 0` olanlar                       |

#### 4. Arama (Search)

Collection adı ve açıklamalarında case-insensitive arama yapar.

```
GET /api/collections/?search=summer
```

- `name`, `shortDescription` ve `longDescription` alanlarında arar.
- 500ms debounce önerilir.

#### Filtreleri Kombine Etme

Tüm filtreler aynı anda kullanılabilir:

```
GET /api/collections/?category=electronics&status=in_progress&search=badge&limit=10
```

### Response `200`

```json
{
  "collections": [
    {
      "id": "uuid",
      "title": "Summer Season Badges",
      "description": "Short or long description text",
      "currentProgress": 3,
      "totalProgress": 10,
      "coverImage": "https://cdn.example.com/media/collections/banners/abc.jpg",
      "highlightsImage": "https://cdn.example.com/media/collections/highlights/xyz.jpg",
      "category": "electronics"
    }
  ],
  "pagination": {
    "cursor": "uuid-of-last-item",
    "hasMore": true,
    "limit": 20,
    "total": 45
  }
}
```

### Response Fields

| Field              | Type           | Description                                       |
|--------------------|----------------|---------------------------------------------------|
| `id`               | string         | Collection UUID                                   |
| `title`            | string         | Collection adı                                    |
| `description`      | string         | Kısa veya uzun açıklama                           |
| `currentProgress`  | number         | Kullanıcının mevcut ilerlemesi                    |
| `totalProgress`    | number         | Toplam ilerleme hedefi                            |
| `coverImage`       | string \| null | Collection kapak görseli (CDN URL)                |
| `highlightsImage`  | string \| null | Collection highlights görseli (CDN URL)           |
| `category`         | string \| null | Kategori handle'ı                                 |

---

## EP-02: Collection Categories

Chip filter kategorilerini getirir. Sadece en az bir collection'a sahip kategoriler döner.

```
GET /api/collections/categories
```

### Query Parameters

Yok.

### Response `200`

```json
{
  "categories": [
    {
      "id": "uuid",
      "name": "Electronics",
      "handle": "electronics"
    }
  ]
}
```

### Response Fields

| Field    | Type   | Description                                                |
|----------|--------|------------------------------------------------------------|
| `id`     | string | Kategori UUID                                              |
| `name`   | string | UI'da gösterilecek isim                                    |
| `handle` | string | EP-01'de `category` query param olarak gönderilecek değer  |

> Backend 24 saat cache'ler.

---

## EP-03: Collection Detail + Badges

Bir collection'ın detayını ve badge listesini getirir.

```
GET /api/collections/:collectionId
```

### Path Parameters

| Param          | Type   | Description     |
|----------------|--------|-----------------|
| `collectionId` | string | Collection UUID |

### Query Parameters

| Param    | Type   | Description                                               |
|----------|--------|-----------------------------------------------------------|
| `search` | string | Badge title/description'da arama (400ms debounce önerilir)|

### Response `200`

```json
{
  "collection": {
    "id": "uuid",
    "title": "Summer Season Badges",
    "description": "Detailed description of this collection",
    "currentProgress": 3,
    "totalProgress": 10,
    "coverImage": "https://cdn.example.com/media/collections/banners/abc.jpg",
    "highlightsImage": "https://cdn.example.com/media/collections/highlights/xyz.jpg",
    "category": "electronics"
  },
  "badges": [
    {
      "id": "uuid",
      "title": "First Purchase",
      "description": "Complete your first purchase",
      "icon": "https://cdn.example.com/media/badges/def.png",
      "currentProgress": 1,
      "totalProgress": 1,
      "status": "completed"
    }
  ]
}
```

### Collection Fields

| Field              | Type           | Description                              |
|--------------------|----------------|------------------------------------------|
| `id`               | string         | Collection UUID                          |
| `title`            | string         | Collection adı                           |
| `description`      | string         | Uzun veya kısa açıklama                  |
| `currentProgress`  | number         | Kullanıcının toplam ilerlemesi           |
| `totalProgress`    | number         | Toplam ilerleme hedefi                   |
| `coverImage`       | string \| null | Kapak görseli (CDN URL)                  |
| `highlightsImage`  | string \| null | Highlights görseli (CDN URL)             |
| `category`         | string \| null | Kategori handle'ı                        |

### Badge Fields

| Field             | Type   | Description                                                         |
|-------------------|--------|---------------------------------------------------------------------|
| `id`              | string | Badge UUID                                                          |
| `title`           | string | Badge adı                                                           |
| `description`     | string | Badge açıklaması                                                    |
| `icon`            | string | Badge görseli (CDN URL)                                             |
| `currentProgress` | number | Kullanıcının bu badge için ilerlemesi                               |
| `totalProgress`   | number | Tamamlanma hedefi                                                   |
| `status`          | string | `not_started` \| `in_progress` \| `completed`                      |

### Status Hesaplama

- `not_started`: `currentProgress === 0`
- `in_progress`: `currentProgress > 0 && currentProgress < totalProgress`
- `completed`: `currentProgress >= totalProgress`

---

## EP-04: Completed Collections

Kullanıcının tamamladığı collection'ları getirir.

```
GET /api/collections/completed
```

### Query Parameters

| Param    | Type   | Default | Description                                                |
|----------|--------|---------|------------------------------------------------------------|
| `userId` | string | —       | Hedef kullanıcı ID. Boş bırakılırsa giriş yapan kullanıcı.|
| `cursor` | string | —       | Pagination cursor                                          |
| `limit`  | number | `20`    | Sayfa başına item (min: 1, max: 50)                        |

### Response `200`

```json
{
  "collections": [
    {
      "id": "uuid",
      "title": "Starter Collection",
      "description": "Get started with the platform",
      "coverImage": "https://cdn.example.com/media/collections/banners/abc.jpg",
      "highlightsImage": "https://cdn.example.com/media/collections/highlights/xyz.jpg",
      "category": "onboarding",
      "completedAt": "2026-03-15T14:30:00.000Z",
      "totalBadges": 5,
      "earnedBadges": 5
    }
  ],
  "pagination": {
    "cursor": null,
    "hasMore": false,
    "limit": 20,
    "total": 1
  }
}
```

### Response Fields

| Field              | Type           | Description                              |
|--------------------|----------------|------------------------------------------|
| `id`               | string         | Collection UUID                          |
| `title`            | string         | Collection adı                           |
| `description`      | string         | Açıklama                                 |
| `coverImage`       | string \| null | Kapak görseli (CDN URL)                  |
| `highlightsImage`  | string \| null | Highlights görseli (CDN URL)             |
| `category`         | string \| null | Kategori handle'ı                        |
| `completedAt`      | string \| null | Son goal'un tamamlandığı tarih (ISO 8601)|
| `totalBadges`      | number         | Collection'daki toplam badge sayısı      |
| `earnedBadges`     | number         | Kullanıcının kazandığı badge sayısı      |

---

## EP-05: User Collection Progress

Kullanıcının ilerleme kaydettiği collection'ları getirir. Hiç ilerleme olmayan collection'lar listelenmez. Profil sayfasında "Koleksiyonlar" bölümünde kullanılır.

```
GET /api/collections/user-progress
```

### Query Parameters

| Param    | Type   | Default | Description                                                |
|----------|--------|---------|------------------------------------------------------------|
| `userId` | string | —       | Hedef kullanıcı ID. Boş bırakılırsa giriş yapan kullanıcı.|
| `cursor` | string | —       | Pagination cursor                                          |
| `limit`  | number | `20`    | Sayfa başına item (min: 1, max: 50)                        |

### Response `200`

```json
{
  "collections": [
    {
      "id": "uuid",
      "title": "Tech Explorer",
      "description": "Explore technology badges",
      "currentProgress": 4,
      "totalProgress": 10,
      "coverImage": "https://cdn.example.com/media/collections/banners/abc.jpg",
      "highlightsImage": "https://cdn.example.com/media/collections/highlights/xyz.jpg",
      "category": "tech",
      "status": "in_progress",
      "totalBadges": 8,
      "earnedBadges": 3
    }
  ],
  "pagination": {
    "cursor": "uuid-of-last-item",
    "hasMore": true,
    "limit": 20,
    "total": 5
  }
}
```

### Response Fields

| Field              | Type           | Description                                      |
|--------------------|----------------|--------------------------------------------------|
| `id`               | string         | Collection UUID                                  |
| `title`            | string         | Collection adı                                   |
| `description`      | string         | Açıklama                                         |
| `currentProgress`  | number         | Kullanıcının mevcut ilerlemesi                   |
| `totalProgress`    | number         | Toplam ilerleme hedefi                           |
| `coverImage`       | string \| null | Kapak görseli (CDN URL)                          |
| `highlightsImage`  | string \| null | Highlights görseli (CDN URL)                     |
| `category`         | string \| null | Kategori handle'ı                                |
| `status`           | string         | `in_progress` \| `completed`                     |
| `totalBadges`      | number         | Collection'daki toplam badge sayısı              |
| `earnedBadges`     | number         | Kullanıcının kazandığı badge sayısı              |

---

## EP-06: Badge Reminder

Belirtilen badge için hatırlatma ayarlar.

```
POST /api/collections/badges/:badgeId/reminder
```

### Path Parameters

| Param    | Type   | Description |
|----------|--------|-------------|
| `badgeId`| string | Badge UUID  |

### Request Body

```json
{
  "remindAt": "2026-03-18T10:00:00.000Z"
}
```

| Field      | Type   | Required | Description                                            |
|------------|--------|----------|--------------------------------------------------------|
| `remindAt` | string | Hayır    | Hatırlatma zamanı (ISO 8601). Yoksa 1 gün sonra.      |

### Response `200`

```json
{
  "id": "uuid",
  "remindAt": "2026-03-18T10:00:00.000Z"
}
```

### Error Responses

| Status | Description                     |
|--------|---------------------------------|
| `400`  | Geçersiz badgeId veya remindAt  |
| `401`  | Authentication başarısız        |
| `404`  | Badge bulunamadı                |

---

## Ortak Pagination Yapısı

Tüm liste endpointleri aynı pagination yapısını kullanır:

```json
{
  "pagination": {
    "cursor": "string | null",
    "hasMore": true,
    "limit": 20,
    "total": 100
  }
}
```

| Field     | Type           | Description                                       |
|-----------|----------------|---------------------------------------------------|
| `cursor`  | string \| null | Sonraki sayfa için cursor. `null` = son sayfa.     |
| `hasMore` | boolean        | Daha fazla sonuç var mı                            |
| `limit`   | number         | İstenen sayfa boyutu                               |
| `total`   | number         | Toplam sonuç sayısı                                |

**Infinite scroll:** `hasMore: true` ise sonraki isteğe `cursor` değerini ekleyerek devam edin.

---

## Image URL'leri

Tüm image alanları (`coverImage`, `highlightsImage`, `icon`) CDN URL olarak döner:

- **coverImage**: Collection kapak görseli (`collections/banners/` klasöründen)
- **highlightsImage**: Collection highlights görseli (`collections/highlights/` klasöründen)
- **icon**: Badge görseli (`badges/` klasöründen)

URL formatı: `{MEDIA_PUBLIC_BASE_URL}/{path}`
Örnek: `https://api-test.tipbox.co/media/collections/banners/abc123.jpg`

`null` değer = görsel yok.
