# Achievements Category Field & Search Pagination

## 1. GET `/api/users/:id/collections/achievements`

### Değişiklik
Response'daki her badge item'ına `category` field'ı eklendi.

### Yeni Field

| Field | Type | Açıklama |
|-------|------|----------|
| `category` | `"event"` \| `"collection"` | Badge'in event mı yoksa collection mı olduğunu belirtir |

### Belirleme Mantığı
- Badge'in `eventBadges` ilişkisi varsa (count > 0) → `"event"`
- Aksi halde → `"collection"`

### Örnek Response

```json
{
  "items": [
    {
      "id": "badge-uuid",
      "title": "First Post",
      "rarity": "Rare",
      "image": "https://...",
      "isClaimed": true,
      "nftAddress": null,
      "earnedDate": "2026-03-15T10:00:00.000Z",
      "totalEarned": 42,
      "category": "collection",
      "tasks": [
        { "id": "goal-uuid", "title": "Write a post", "type": "Comment" }
      ]
    },
    {
      "id": "badge-uuid-2",
      "title": "Event Winner",
      "rarity": "Epic",
      "image": "https://...",
      "isClaimed": true,
      "nftAddress": "0x...",
      "earnedDate": "2026-03-10T08:00:00.000Z",
      "totalEarned": 5,
      "category": "event",
      "tasks": []
    }
  ],
  "pagination": {
    "cursor": "next-badge-id",
    "hasMore": true,
    "limit": 20
  }
}
```

> **Not:** `GET /api/users/:id/highlights/badges` endpoint'i de aynı `category` field'ını döner. Orada badge'in Prisma `type` field'ı (`BadgeType` enum) kullanılır: `EVENT` → `"event"`, diğerleri → `"collection"`.

---

## 2. GET `/api/search`

### Değişiklik
Cursor-based pagination desteği eklendi.

### Yeni Query Parametreleri

| Parametre | Type | Zorunlu | Açıklama |
|-----------|------|---------|----------|
| `cursor` | `string` | Hayır | Bir önceki response'dan gelen pagination cursor'ı. Sonraki sayfa için kullanılır. |

Mevcut parametreler (`keyword`, `types`, `limit`) aynen geçerlidir.

### Yeni Response Field'ı

Response'a `pagination` objesi eklendi:

```typescript
{
  userData: SearchUserData[];
  brandData: SearchBrandData[];
  productData: SearchProductData[];
  pagination: {
    cursor?: string;   // Sonraki sayfa için kullanılacak opaque cursor (varsa)
    hasMore: boolean;  // Daha fazla sonuç var mı
    limit: number;     // Her tip için dönen maksimum sonuç sayısı
  };
}
```

### Davranış

| Mode | Pagination |
|------|-----------|
| **Default mode** (keyword yok) | `hasMore: false`, cursor yok. Her zaman 4'er adet döner. |
| **Search mode** (keyword var) | `hasMore: true/false` duruma göre. `hasMore: true` ise `cursor` field'ı dolu gelir. |

### Cursor Yapısı
Cursor, base64-encoded JSON formatındadır. Her tip için son dönen item'ın ID'sini içerir:

```json
// decoded cursor örneği
{ "user": "last-user-id", "brand": "last-brand-id", "product": "last-product-id" }
```

Client tarafı cursor'ı decode etmemelidir — opaque string olarak kullanılmalıdır.

### Kullanım Örneği

**İlk istek:**
```
GET /api/search?keyword=apple&limit=10
```

**Response:**
```json
{
  "userData": [...],
  "brandData": [...],
  "productData": [...],
  "pagination": {
    "cursor": "eyJ1c2VyIjoiYWJjMTIzIiwiYnJhbmQiOiJkZWY0NTYifQ==",
    "hasMore": true,
    "limit": 10
  }
}
```

**Sonraki sayfa:**
```
GET /api/search?keyword=apple&limit=10&cursor=eyJ1c2VyIjoiYWJjMTIzIiwiYnJhbmQiOiJkZWY0NTYifQ==
```

### Etkilenen Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `interfaces/search/search.dto.ts` | `SearchPagination` interface eklendi, `SearchData`'ya `pagination` eklendi |
| `interfaces/search/search.router.ts` | `cursor` query parametresi eklendi |
| `application/search/search.service.ts` | Cursor encode/decode, `take: limit+1` ile hasMore kontrolü, pagination objesi oluşturma |
| `application/user/user.service.ts` | `CollectionResponse` tipine `category` eklendi, her iki badge listesinde set edildi |
