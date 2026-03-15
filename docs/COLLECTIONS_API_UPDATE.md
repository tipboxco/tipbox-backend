# Collections API — Yeni Endpoint'ler (2026-03-16)

> Backend'e eklenen yeni collection endpoint'lerinin frontend/app entegrasyon rehberi.

---

## Özet

| # | Method | Endpoint | Açıklama | Durum |
|---|--------|----------|----------|-------|
| EP-01 | `GET` | `/api/collections` | Tüm collection listesi (arama, filtre, pagination) | Mevcut |
| EP-02 | `GET` | `/api/collections/categories` | Chip filtre kategorileri | Mevcut |
| EP-03 | `GET` | `/api/collections/:collectionId` | Collection detay + badge listesi | Mevcut |
| EP-04 | `GET` | `/api/collections/completed` | Kullanıcının tamamladığı collection'lar | **Yeni** |
| EP-05 | `GET` | `/api/collections/user-progress` | Kullanıcının ilerleme kaydettiği collection'lar | **Yeni** |
| - | `POST` | `/api/collections/badges/:badgeId/reminder` | Badge hatırlatma ayarla | Mevcut |

Tüm endpoint'ler `Bearer Token` gerektirir.

---

## EP-04: Tamamlanan Collection'lar

```
GET /api/collections/completed
```

Kullanıcının **tamamladığı** collection'ları döner. Tüm achievement goal'ları %100 tamamlanmış olmalı.

### Query Parameters

| Parametre | Tip | Zorunlu | Default | Açıklama |
|-----------|-----|---------|---------|----------|
| `userId` | `string` | Hayır | Auth user | Başka kullanıcının profili için |
| `cursor` | `string` | Hayır | - | Infinite scroll pagination cursor |
| `limit` | `number` | Hayır | `20` | Sayfa başına item (min: 1, max: 50) |

### Response `200 OK`

```json
{
  "collections": [
    {
      "id": "c1a2b3c4-...",
      "title": "Kozmetik Uzmanı",
      "description": "Kozmetik alanında uzmanlaş",
      "coverImage": "https://media.tipbox.co/collections/cosmetics.png",
      "category": "cosmetics",
      "completedAt": "2026-03-10T14:30:00.000Z",
      "totalBadges": 5,
      "earnedBadges": 4
    }
  ],
  "pagination": {
    "cursor": "next-page-uuid",
    "hasMore": true,
    "limit": 20,
    "total": 3
  }
}
```

### Response Alanları

| Alan | Tip | Açıklama |
|------|-----|----------|
| `id` | `string` | Collection UUID — detay sayfasına yönlendirme için kullanılır |
| `title` | `string` | Collection başlığı |
| `description` | `string` | Kısa açıklama |
| `coverImage` | `string \| null` | Kapak görseli CDN URL |
| `category` | `string \| null` | Kategori handle (ör. `electronics`, `cosmetics`) |
| `completedAt` | `string \| null` | Son achievement goal'un tamamlandığı tarih (ISO 8601) |
| `totalBadges` | `number` | Collection'daki toplam badge sayısı |
| `earnedBadges` | `number` | Kullanıcının kazandığı badge sayısı |

### Örnek İstekler

```bash
# Kendi tamamladıklarım
GET /api/collections/completed

# Başka kullanıcının tamamladıkları (profil sayfası)
GET /api/collections/completed?userId=abc-123

# Pagination
GET /api/collections/completed?cursor=prev-last-id&limit=10
```

---

## EP-05: İlerleme Kaydedilen Collection'lar (Profil)

```
GET /api/collections/user-progress
```

Kullanıcının **herhangi bir ilerleme kaydettiği** collection'ları döner. Hiç ilerleme olmayan collection'lar **listelenmez**. Hem `in_progress` hem `completed` collection'ları içerir.

### Query Parameters

| Parametre | Tip | Zorunlu | Default | Açıklama |
|-----------|-----|---------|---------|----------|
| `userId` | `string` | Hayır | Auth user | Başka kullanıcının profili için |
| `cursor` | `string` | Hayır | - | Infinite scroll pagination cursor |
| `limit` | `number` | Hayır | `20` | Sayfa başına item (min: 1, max: 50) |

### Response `200 OK`

```json
{
  "collections": [
    {
      "id": "d4e5f6a7-...",
      "title": "Teknoloji Gurusu",
      "description": "Teknoloji dünyasındaki bilgini kanıtla",
      "currentProgress": 45,
      "totalProgress": 100,
      "coverImage": "https://media.tipbox.co/collections/tech-guru.png",
      "category": "electronics",
      "status": "in_progress",
      "totalBadges": 5,
      "earnedBadges": 2
    },
    {
      "id": "c1a2b3c4-...",
      "title": "Kozmetik Uzmanı",
      "description": "Kozmetik alanında uzmanlaş",
      "currentProgress": 80,
      "totalProgress": 80,
      "coverImage": "https://media.tipbox.co/collections/cosmetics.png",
      "category": "cosmetics",
      "status": "completed",
      "totalBadges": 3,
      "earnedBadges": 3
    }
  ],
  "pagination": {
    "cursor": "next-page-uuid",
    "hasMore": false,
    "limit": 20,
    "total": 2
  }
}
```

### Response Alanları

| Alan | Tip | Açıklama |
|------|-----|----------|
| `id` | `string` | Collection UUID — detay sayfasına yönlendirme için kullanılır |
| `title` | `string` | Collection başlığı |
| `description` | `string` | Kısa açıklama |
| `currentProgress` | `number` | Kullanıcının mevcut ilerlemesi |
| `totalProgress` | `number` | Toplam ilerleme hedefi |
| `coverImage` | `string \| null` | Kapak görseli CDN URL |
| `category` | `string \| null` | Kategori handle |
| `status` | `"in_progress" \| "completed"` | Collection durumu |
| `totalBadges` | `number` | Collection'daki toplam badge sayısı |
| `earnedBadges` | `number` | Kullanıcının kazandığı badge sayısı |

### Örnek İstekler

```bash
# Kendi ilerlemelerim
GET /api/collections/user-progress

# Başka kullanıcının profili
GET /api/collections/user-progress?userId=abc-123

# Pagination
GET /api/collections/user-progress?cursor=prev-last-id&limit=10
```

---

## Navigasyon Akışı

```
Profil Sayfası
│
├─ "Koleksiyonlar" bölümü
│   └─ GET /api/collections/user-progress?userId=xxx
│        └─ Collection kartına tıkla
│             └─ GET /api/collections/{id}  → EP-03 detay sayfası
│
└─ "Tamamlanan Koleksiyonlar" bölümü
    └─ GET /api/collections/completed?userId=xxx
         └─ Collection kartına tıkla
              └─ GET /api/collections/{id}  → EP-03 detay sayfası
```

Her iki endpoint'te dönen **`id`** alanı ile `EP-03` (`GET /api/collections/:collectionId`) detay sayfasına yönlendirme yapılır.

---

## EP-04 vs EP-05 — Hangisini Kullanmalı?

| Senaryo | Endpoint |
|---------|----------|
| Profil "Koleksiyonlar" — ilerleme olan tüm collection'lar | **EP-05** `/user-progress` |
| Profil "Tamamlanan" — sadece bitirilmiş collection'lar | **EP-04** `/completed` |
| Collection keşfet/browse — tüm collection'lar | EP-01 `/collections` |
| Collection detay + badge listesi | EP-03 `/collections/:id` |

---

## Frontend Notları

### Progress Bar (EP-05)

```typescript
const percentage = (currentProgress / totalProgress) * 100;
// status === 'completed' ise %100 göster
```

### Boş Durum

Her iki endpoint de `collections: []` dönebilir. Boş durum UI'ı hazırlanmalı:
- EP-04 boş: "Henüz tamamlanan koleksiyon yok"
- EP-05 boş: "Henüz başlanmış koleksiyon yok"

### Notlar

- `earnedBadges` ile `totalBadges` eşit olmayabilir — collection tamamlanmış ama tüm badge'ler claim edilmemiş olabilir
- `completedAt` (EP-04): son goal'un tamamlandığı tarihtir; goal'da completedAt kaydı yoksa `null` döner
- `currentProgress === 0` olan collection'lar EP-05'te **döndürülmez**
- Mevcut `GET /api/collections?status=completed` (EP-01) hala çalışır ama yeni endpoint'ler daha verimli ve profil sayfası için daha uygun veri yapısı döner
