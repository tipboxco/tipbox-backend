# Collections App API Reference

> Base URL: `/api/events/collections`
> Auth: Tum endpoint'ler `Bearer Token` gerektirir.

---

## EP-01: Collections List

```
GET /api/events/collections
```

Collections tab'indaki ana liste. Arama, kategori chip filtresi, bottom sheet filtreleri ve status filtresi destekler. Cursor tabanli infinite scroll pagination.

### Query Parameters

| Param | Type | Default | Aciklama |
|-------|------|---------|----------|
| `search` | `string` | - | Collection title/description'da arama (500ms debounce onerilir) |
| `category` | `string` | - | Chip filter handle'i (EP-02'den gelen `handle` degeri). `"all"` veya bos = tum kategoriler |
| `mainCategoryId` | `string` | - | Bottom sheet ana kategori ID (Medusa category ID) |
| `subCategoryId` | `string` | - | Bottom sheet alt kategori ID (Medusa category ID) |
| `productGroupId` | `string` | - | Bottom sheet urun grubu ID (ileride eklenecek) |
| `status` | `string` | `"all"` | `"all"` \| `"completed"` \| `"in_progress"` \| `"not_started"` |
| `cursor` | `string` | - | Sonraki sayfa cursor'i (pagination.cursor'dan alinir) |
| `limit` | `integer` | `20` | Sayfa basina item sayisi (min: 1, max: 50) |

### Response

```json
{
  "collections": [
    {
      "id": "uuid-string",
      "title": "Elektronik Kesfet",
      "description": "Elektronik kategorisindeki badge'leri topla",
      "currentProgress": 35,
      "totalProgress": 100,
      "totalBadges": 8,
      "earnedBadges": 3,
      "coverImage": "https://cdn.example.com/collections/banner.jpg",
      "category": "Elektronik"
    }
  ],
  "pagination": {
    "cursor": "next-page-cursor-id",
    "hasMore": true,
    "limit": 20,
    "total": 45
  }
}
```

### Response Fields

| Field | Type | Aciklama |
|-------|------|----------|
| `collections[].id` | `string` | Collection UUID |
| `collections[].title` | `string` | Collection adi |
| `collections[].description` | `string` | Kisa aciklama |
| `collections[].currentProgress` | `number` | Kullanicinin mevcut ilerlemesi (toplam puan) |
| `collections[].totalProgress` | `number` | Toplam ilerleme hedefi (toplam puan) |
| `collections[].totalBadges` | `number` | Collection'daki toplam badge sayisi |
| `collections[].earnedBadges` | `number` | Kullanicinin kazandigi badge sayisi |
| `collections[].coverImage` | `string \| null` | Kapak gorseli URL'i |
| `collections[].category` | `string \| null` | Kategori adi |
| `pagination.cursor` | `string \| null` | Sonraki sayfa cursor'i. `null` = son sayfa |
| `pagination.hasMore` | `boolean` | Daha fazla sayfa var mi |
| `pagination.limit` | `number` | Sayfa basina item sayisi |
| `pagination.total` | `number` | Toplam collection sayisi (filtreler dahil) |

### Progress Hesaplama

- Her collection'in birden fazla `AchievementGoal`'u olabilir
- `totalProgress` = Tum goal'lerin `pointsRequired` toplami
- `currentProgress` = Kullanicinin her goal'deki ilerlemesi (goal limitini asmaz)
- Progress bar: `currentProgress / totalProgress`

---

## EP-02: Collection Categories (Chip Filter)

```
GET /api/events/collections/categories
```

Collections tab ustundeki yatay chip filter kategorilerini getirir. Sadece en az 1 collection'a sahip kategoriler doner. **24 saat cache'lenebilir.**

### Response

```json
{
  "categories": [
    {
      "id": "cat_abc123",
      "name": "Elektronik",
      "handle": "electronics"
    },
    {
      "id": "cat_def456",
      "name": "Kozmetik",
      "handle": "cosmetics"
    }
  ]
}
```

### Response Fields

| Field | Type | Aciklama |
|-------|------|----------|
| `categories[].id` | `string` | Kategori ID |
| `categories[].name` | `string` | UI'da gosterilecek kategori adi |
| `categories[].handle` | `string` | EP-01'de `category` query param olarak gonderilecek deger |

### Kullanim

1. Chip listesinin basina sabit `"Tumu"` chip'i ekleyin (backend gondermez)
2. Chip'e tiklandiginda EP-01'i `category={handle}` ile cagirin
3. `"Tumu"` secildiyse `category` parametresini gondermeyin veya `"all"` gonderin

---

## EP-03: Collection Detail + Badges

```
GET /api/events/collections/:collectionId
```

Bir collection'in detayini ve badge listesini getirir. Badge'ler icinde arama destekler. Badge'ler oluşturulma tarihine göre sıralanması gerekiyor. İlk oluşturulan en üstte olacak şekilde eğer order uymuyorsa order'a göre olması gerekiyor.

### Path Parameters

| Param | Type | Aciklama |
|-------|------|----------|
| `collectionId` | `string (uuid)` | Collection ID |

### Query Parameters

| Param | Type | Aciklama |
|-------|------|----------|
| `search` | `string` | Badge title/description'da arama (400ms debounce onerilir) |

### Response

```json
{
  "collection": {
    "id": "uuid-string",
    "title": "Elektronik Kesfet",
    "description": "Detayli aciklama metni...",
    "currentProgress": 35,
    "totalProgress": 100,
    "totalBadges": 8,
    "earnedBadges": 3,
    "coverImage": "https://cdn.example.com/collections/banner.jpg",
    "category": "Elektronik"
  },
  "badges": [
    {
      "id": "badge-uuid",
      "title": "Ilk Alisveris",
      "description": "Ilk alisverisini yap",
      "icon": "https://cdn.example.com/badges/first-purchase.png",
      "highlightsImage": "https://cdn.example.com/badges/first-purchase-highlight.png",
      "currentProgress": 1,
      "totalProgress": 1,
      "status": "completed",
      "isActive": true,
      "displayOrder": 1,
      "createdAt": "2026-01-15T10:30:00.000Z"
    },
    {
      "id": "badge-uuid-2",
      "title": "5 Yorum Yap",
      "description": "5 adet yorum yaz",
      "icon": "https://cdn.example.com/badges/5-reviews.png",
      "highlightsImage": null,
      "currentProgress": 2,
      "totalProgress": 5,
      "status": "in_progress",
      "isActive": true,
      "displayOrder": 2,
      "createdAt": "2026-01-15T11:00:00.000Z"
    }
  ]
}
```

### Response Fields — `collection`

| Field | Type | Aciklama |
|-------|------|----------|
| `id` | `string` | Collection UUID |
| `title` | `string` | Collection adi |
| `description` | `string` | Detayli aciklama (longDescription, yoksa shortDescription) |
| `currentProgress` | `number` | Kullanicinin toplam ilerlemesi |
| `totalProgress` | `number` | Toplam ilerleme hedefi |
| `totalBadges` | `number` | Toplam badge sayisi |
| `earnedBadges` | `number` | Kazanilan badge sayisi |
| `coverImage` | `string \| null` | Kapak gorseli |
| `category` | `string \| null` | Kategori adi |

### Response Fields — `badges[]`

| Field | Type | Aciklama |
|-------|------|----------|
| `id` | `string` | Badge UUID |
| `title` | `string` | Badge adi |
| `description` | `string` | Badge aciklamasi |
| `icon` | `string` | Badge gorseli URL (public CDN) |
| `highlightsImage` | `string \| null` | Badge highlights gorseli URL |
| `currentProgress` | `number` | Kullanicinin bu badge'deki ilerlemesi |
| `totalProgress` | `number` | Hedef puan |
| `status` | `string` | `"not_started"` \| `"in_progress"` \| `"completed"` |
| `isActive` | `boolean` | Badge aktif mi (admin tarafindan deaktif edilebilir) |
| `displayOrder` | `number` | Siralama (1'den baslar) |
| `createdAt` | `string (ISO 8601)` | Olusturulma tarihi |

### Badge Status Hesaplama

| Status | Kosul |
|--------|-------|
| `not_started` | `currentProgress === 0` |
| `in_progress` | `currentProgress > 0 && currentProgress < totalProgress` |
| `completed` | `currentProgress >= totalProgress` |

### Error Responses

| Status | Aciklama |
|--------|----------|
| `401` | Token gecersiz veya eksik |
| `404` | `{ success: false, message: "Collection not found" }` |

---

## EP-04: Completed Collections (Profile)

```
GET /api/events/collections/completed
```

Kullanicinin tamamladigi collection'lar. Profil sayfasinda "Tamamlanan Koleksiyonlar" bolumunde kullanilir.

### Query Parameters

| Param | Type | Default | Aciklama |
|-------|------|---------|----------|
| `userId` | `string` | Giris yapan kullanici | Baska bir kullanicinin tamamladigi collection'lari gormek icin |
| `cursor` | `string` | - | Pagination cursor |
| `limit` | `integer` | `20` | Sayfa basina item (min: 1, max: 50) |

### Response

```json
{
  "collections": [
    {
      "id": "uuid-string",
      "title": "Elektronik Kesfet",
      "description": "Elektronik kategorisindeki badge'leri topla",
      "coverImage": "https://cdn.example.com/collections/banner.jpg",
      "category": "Elektronik",
      "completedAt": "2026-03-10T14:30:00.000Z",
      "totalBadges": 8,
      "earnedBadges": 8
    }
  ],
  "pagination": {
    "cursor": null,
    "hasMore": false,
    "limit": 20,
    "total": 3
  }
}
```

### Response Fields

| Field | Type | Aciklama |
|-------|------|----------|
| `collections[].id` | `string` | Collection UUID |
| `collections[].title` | `string` | Collection adi |
| `collections[].description` | `string` | Kisa aciklama |
| `collections[].coverImage` | `string \| null` | Kapak gorseli |
| `collections[].category` | `string \| null` | Kategori adi |
| `collections[].completedAt` | `string (ISO 8601) \| null` | Son goal'un tamamlandigi tarih |
| `collections[].totalBadges` | `number` | Toplam badge sayisi |
| `collections[].earnedBadges` | `number` | Kazanilan badge sayisi |
| `pagination` | `object` | EP-01 ile ayni yapi |

---

## EP-05: User Collection Progress (Profile)

```
GET /api/events/collections/user-progress
```

Kullanicinin herhangi bir ilerleme kaydettigi collection'lar (in_progress + completed). Profil sayfasinda "Koleksiyonlar" bolumunde kullanilir. Hic ilerlemesi olmayan collection'lar listelenmez.

### Query Parameters

| Param | Type | Default | Aciklama |
|-------|------|---------|----------|
| `userId` | `string` | Giris yapan kullanici | Baska bir kullanicinin ilerlemesini gormek icin |
| `cursor` | `string` | - | Pagination cursor |
| `limit` | `integer` | `20` | Sayfa basina item (min: 1, max: 50) |

### Response

```json
{
  "collections": [
    {
      "id": "uuid-string",
      "title": "Elektronik Kesfet",
      "description": "Elektronik kategorisindeki badge'leri topla",
      "currentProgress": 35,
      "totalProgress": 100,
      "coverImage": "https://cdn.example.com/collections/banner.jpg",
      "category": "Elektronik",
      "status": "in_progress",
      "totalBadges": 8,
      "earnedBadges": 3
    }
  ],
  "pagination": {
    "cursor": null,
    "hasMore": false,
    "limit": 20,
    "total": 5
  }
}
```

### Response Fields

| Field | Type | Aciklama |
|-------|------|----------|
| `collections[].id` | `string` | Collection UUID |
| `collections[].title` | `string` | Collection adi |
| `collections[].description` | `string` | Kisa aciklama |
| `collections[].currentProgress` | `number` | Mevcut ilerleme |
| `collections[].totalProgress` | `number` | Toplam hedef |
| `collections[].coverImage` | `string \| null` | Kapak gorseli |
| `collections[].category` | `string \| null` | Kategori adi |
| `collections[].status` | `string` | `"in_progress"` \| `"completed"` |
| `collections[].totalBadges` | `number` | Toplam badge sayisi |
| `collections[].earnedBadges` | `number` | Kazanilan badge sayisi |
| `pagination` | `object` | EP-01 ile ayni yapi |

---

## EP-06: Badge Reminder

```
POST /api/events/collections/badges/:badgeId/reminder
```

Bir badge icin hatirlatma olusturur. Ayni badge icin mevcut hatirlatma varsa guncellenir.

### Path Parameters

| Param | Type | Aciklama |
|-------|------|----------|
| `badgeId` | `string (uuid)` | Badge ID |

### Request Body

```json
{
  "remindAt": "2026-03-19T10:00:00.000Z"
}
```

| Field | Type | Zorunlu | Aciklama |
|-------|------|---------|----------|
| `remindAt` | `string (ISO 8601)` | Hayir | Hatirlatma zamani. Verilmezse 1 gun sonra. Gecmis tarih kabul edilmez. |

### Response

```json
{
  "id": "reminder-uuid",
  "remindAt": "2026-03-19T10:00:00.000Z"
}
```

### Error Responses

| Status | Body | Aciklama |
|--------|------|----------|
| `400` | `{ success: false, message: "badgeId is required" }` | Path param eksik |
| `400` | `{ success: false, message: "remindAt must be a valid ISO date string" }` | Gecersiz tarih formati |
| `400` | `{ success: false, message: "remindAt must be in the future" }` | Gecmis tarih |
| `401` | `{ success: false, message: "Unauthorized" }` | Token eksik/gecersiz |
| `404` | `{ success: false, message: "Badge not found" }` | Badge bulunamadi |

---

## Pagination (Ortak Yapi)

Tum liste endpoint'leri ayni pagination yapisini kullanir:

```json
{
  "pagination": {
    "cursor": "string | null",
    "hasMore": true,
    "limit": 20,
    "total": 45
  }
}
```

### Infinite Scroll Implementasyonu

```
1. Ilk istek:  GET /collections?limit=20
2. Sonraki:    GET /collections?limit=20&cursor={pagination.cursor}
3. Son sayfa:  pagination.hasMore === false veya pagination.cursor === null
```

- `cursor` degeri her zaman `pagination.cursor`'dan alinmalidir
- `hasMore === false` oldugunda daha fazla istek yapmayin
- `cursor === null` da son sayfayi belirtir

---

## Ortak Error Responses

| Status | Aciklama |
|--------|----------|
| `401` | `{ success: false, message: "Unauthorized" }` — Token eksik veya gecersiz |
| `404` | Resource bulunamadi |
| `500` | Sunucu hatasi |

