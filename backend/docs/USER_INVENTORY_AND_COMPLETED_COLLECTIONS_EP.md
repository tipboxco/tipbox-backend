# EP: User Inventory (Public) & Completed Collections Filter

> **Tarih:** 2026-03-12
> **Durum:** Backend tamamlandı, app entegrasyonu bekleniyor

---

## EP-01: Başka Kullanıcının Envanterini Görme

### Endpoint

```
GET /api/users/:id/inventory
```

### Amaç

Herhangi bir kullanıcının sahip olduğu ürünlerin envanterini görüntüleme. Mevcut `GET /api/inventory` sadece kendi envanterini döndürüyordu; bu endpoint başkalarının envanterini de public olarak sunar.

### Auth

Gerekmez. Mevcut `GET /api/users/:id/reviews`, `GET /api/users/:id/benchmarks` pattern'i ile aynı.

### Path Params

| Param | Tip    | Zorunlu | Açıklama                |
| ----- | ------ | ------- | ----------------------- |
| `id`  | string | Evet    | Kullanıcı ID (UUID)     |

### Query Params

| Param    | Tip     | Zorunlu | Default | Açıklama                              |
| -------- | ------- | ------- | ------- | ------------------------------------- |
| `cursor` | string  | Hayır   | —       | Pagination cursor (son item'ın id'si) |
| `limit`  | integer | Hayır   | 20      | Sayfa başına item (min: 1, max: 50)   |

### Response — `200 OK`

```json
{
  "items": [
    {
      "id": "c505c6c2-1234-5678-90ab-cdef12345678",
      "productId": "01H8PRO123456789ABCDEFGH",
      "brand": {
        "name": "Apple",
        "model": "iPhone 15 Pro",
        "specs": "256GB Storage, Titanium Blue"
      },
      "image": "https://cdn.example.com/products/iphone15.jpg",
      "tags": ["Recent", "Owned"]
    }
  ],
  "pagination": {
    "cursor": "next-inventory-uuid-or-null",
    "hasMore": true,
    "limit": 20
  }
}
```

### Notlar

- Sadece `hasOwned: true` olan inventory kayıtları döner.
- Kullanıcı bulunamazsa boş `items: []` döner, 404 fırlatmaz.
- Image alanı: InventoryMedia'daki ilk görselin CDN URL'i. Yoksa `null`.
- Tags: Son 7 gün içinde eklendiyse `"Recent"`, sahiplik varsa `"Owned"`.

### App Tarafı Aksiyonlar

1. **Profil sayfası → Envanter sekmesi**: Başka kullanıcının profiline girildiğinde bu endpoint'i çağırın.
2. **Infinite scroll**: Response'daki `pagination.cursor` değerini bir sonraki istekte `?cursor=xxx` olarak gönderin. `hasMore: false` olunca durdurun.
3. **Kendi envanter**: `GET /api/inventory` (auth gerekli) aynen kalıyor, kendi envanteriniz için onu kullanmaya devam edin.

---

## EP-02: Tamamlanan Collection'ları Filtreleme

### Endpoint (mevcut endpoint'e parametre eklendi)

```
GET /api/events/collections?status=completed
```

Aynı zamanda `/api/collections?status=completed` üzerinden de erişilebilir (ikisi aynı router'a mount edilmiş).

### Amaç

Kullanıcının tamamladığı, devam eden veya henüz başlamadığı collection'ları filtreleyebilmek. Daha önce tüm collection'lar dönüyordu, client tarafında filtreleme gerekiyordu.

### Auth

Gerekli (Bearer token). Mevcut davranış ile aynı.

### Yeni Query Param

| Param    | Tip    | Zorunlu | Default | Değerler                                         |
| -------- | ------ | ------- | ------- | ------------------------------------------------ |
| `status` | string | Hayır   | `all`   | `all`, `completed`, `in_progress`, `not_started`  |

Mevcut query param'lar (`search`, `category`, `mainCategoryId`, `subCategoryId`, `productGroupId`, `cursor`, `limit`) aynen geçerli. `status` bunlarla birlikte kombine edilebilir.

### Status Tanımları

| Değer          | Koşul                                                        |
| -------------- | ------------------------------------------------------------ |
| `all`          | Filtre yok, tüm collection'lar (mevcut davranış, breaking change yok) |
| `completed`    | `currentProgress >= totalProgress` ve `totalProgress > 0`    |
| `in_progress`  | `currentProgress > 0` ve `currentProgress < totalProgress`   |
| `not_started`  | `currentProgress === 0`                                      |

### Response — `200 OK`

Response formatı **değişmedi**, mevcut `CollectionsListResponse` ile birebir aynı:

```json
{
  "collections": [
    {
      "id": "collection-uuid",
      "title": "Content Creator",
      "description": "Create your first posts and become a content creator",
      "currentProgress": 10,
      "totalProgress": 10,
      "backgroundGradient": {
        "colors": ["#4A90D9", "#5B8FBF", "#2E7A66"],
        "start": { "x": 0, "y": 0 },
        "end": { "x": 1, "y": 1 }
      },
      "category": "content"
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

### App Tarafı Aksiyonlar

1. **Profil → Tamamlanan Koleksiyonlar**: `?status=completed` ile sadece tamamlanan collection'ları çekin.
2. **Profil → Devam Eden Koleksiyonlar**: `?status=in_progress` ile aktif collection'ları gösterin.
3. **Kombine filtreler**: `?status=completed&category=electronics` gibi birden fazla filtre birlikte çalışır.
4. **Geriye uyumluluk**: `status` gönderilmezse mevcut davranış korunur, hiçbir şey kırılmaz.

---

## Değişen Dosyalar

| Dosya | EP | Değişiklik |
|-------|----|-----------|
| `src/interfaces/user/user.router.ts` | EP-01 | `GET /:id/inventory` endpoint eklendi |
| `src/application/user/user.service.ts` | EP-01 | `getUserInventory()` metodu eklendi |
| `src/interfaces/collections/collections.router.ts` | EP-02 | OpenAPI docs'a `status` param eklendi, service'e iletiliyor |
| `src/interfaces/collections/collections.schemas.ts` | EP-02 | Zod schema'ya `status` enum eklendi |
| `src/application/collections/collections.service.ts` | EP-02 | `listCollections()`'a status filtre mantığı eklendi |
