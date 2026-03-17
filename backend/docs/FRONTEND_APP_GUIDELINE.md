# Frontend App Integration Guideline (iOS)

> Tarih: 2026-03-17 (son güncelleme: experience rating bug fix eklendi)
> Backend branch: `developer`
> Platform: **iOS only**
> Bu doküman, backend'deki son değişiklikleri ve iOS app tarafında yapılması gereken entegrasyonları kapsar.

---

## 1. Push Notification (Arka Plan Bildirim Desteği)

### Sorun

Bildirimler yalnızca app açıkken (foreground) geliyordu, arka planda (background/killed) çalışmıyordu.

### Backend'de Yapılan Değişiklikler

| Dosya | Değişiklik |
|-------|-----------|
| `expo-push.service.ts` | `data` payload serialize-safe hale getirildi, `badge` (unread count) eklendi, `mutableContent: true` eklendi, receipt kontrolü eklendi |
| `notification.worker.ts` | `unreadCount` push data'ya eklendi (iOS badge için) |

### Push Notification Payload (Backend → Expo → APNs → Device)

```json
{
  "to": "ExpoToken[...]",
  "sound": "default",
  "title": "Post Liked! ❤️",
  "body": "John liked your post",
  "data": {
    "type": "POST_LIKED",
    "postId": "uuid",
    "likerId": "uuid",
    "avatar": "https://...",
    "imageUrl": "https://...",
    "unreadCount": 5
  },
  "priority": "high",
  "badge": 5,
  "mutableContent": true
}
```

### App Tarafında Yapılması Gerekenler

#### 1.1. Foreground Notification Handler

App açıkken gelen bildirimlerin gösterilmesi için:

```typescript
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true, // Backend badge count gönderiyor, iOS app icon badge'i otomatik güncellenir
  }),
});
```

#### 1.2. Background Notification Handler (TaskManager)

Arka plan bildirimleri için `TaskManager` ile background task tanımlanmalı:

```typescript
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, ({ data, error }) => {
  if (error) {
    console.error('Background notification error:', error);
    return;
  }
  // data.notification içinde push payload bulunur
  // Gerekirse local state güncelle, badge say vs.
});

// App başlangıcında register et
Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
```

#### 1.3. Push Token Kaydı

Her app açılışında ve login sonrası push token backend'e kaydedilmeli:

```typescript
import * as Notifications from 'expo-notifications';

// iOS izin iste
const { status } = await Notifications.requestPermissionsAsync({
  ios: {
    allowAlert: true,
    allowBadge: true,
    allowSound: true,
  },
});

if (status !== 'granted') {
  // Kullanıcı izin vermedi - bildirimler çalışmaz
  return;
}

const token = (await Notifications.getExpoPushTokenAsync({
  projectId: 'your-expo-project-id', // app.json'daki extra.eas.projectId
})).data;

// Backend'e gönder
await fetch('/api/notifications/push-token', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    token,
    deviceType: 'ios',
  }),
});
```

> **Kritik:** `projectId` parametresi Expo SDK 49+ için zorunlu. Eksikse token alınamaz.

#### 1.4. APNs Credential Kontrolü (EAS)

iOS push notification'ların çalışması için APNs key'inin Expo projesiyle eşleştirilmiş olması gerekiyor:

```bash
eas credentials --platform ios
```

Kontrol edilecekler:
- **APNs Key (.p8)** veya **APNs Certificate (.p12)** yüklenmiş olmalı
- Key ID ve Team ID doğru olmalı
- Bundle identifier app ile eşleşmeli

> Credential yoksa push notification Expo sunucularından cihaza hiç ulaşamaz. Bu en sık karşılaşılan arka plan bildirim sorunudur.

#### 1.5. app.json / app.config.js Kontrol Listesi

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#ffffff"
        }
      ]
    ],
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      },
      "entitlements": {
        "aps-environment": "production"
      }
    }
  }
}
```

> **`UIBackgroundModes: ["remote-notification"]`** olmadan iOS arka planda push almaz.
> **`aps-environment`** production build'lerde `"production"` olmalı.

#### 1.6. Notification Data Kullanımı

Push notification'ın `data` alanında gelen bilgiler:

| Alan | Tip | Açıklama |
|------|-----|----------|
| `type` | string | Bildirim tipi (48 farklı tip: `POST_LIKED`, `NEW_MESSAGE`, `NEW_BADGE` vb.) |
| `unreadCount` | number | Okunmamış bildirim sayısı (iOS app icon badge otomatik güncellenir) |
| `avatar` | string \| null | Bildirimi tetikleyen kullanıcının avatar URL'i |
| `imageUrl` | string \| null | İlgili içerik görseli (post, event, badge) |
| `postId` | string | (varsa) İlgili post ID |
| `badgeId` | string | (varsa) İlgili badge ID |
| `senderId` | string | (varsa) Gönderen kullanıcı ID |

**Navigasyon:** Kullanıcı bildirime tıkladığında `type` alanına göre doğru ekrana yönlendirme yapılmalı.

---

## 2. Collections API

> Base path: `/api/collections`
> Auth: Tüm endpointler `Bearer token` gerektirir.

### 2.1. BREAKING CHANGE — `highlightsImage` Alanı Taşındı

`highlightsImage` artık **collection** seviyesinde değil, **badge** seviyesinde dönüyor.

**Kaldırılan:** EP-01, EP-03 (collection objesi), EP-04, EP-05 response'larından `highlightsImage` kaldırıldı.

**Eklenen:** EP-03 badge listesinde her badge'e `highlightsImage: string | null` eklendi.

```json
// Eskisi (collection seviyesinde) → KALDIRILDI
{ "id": "uuid", "title": "Summer Season", "coverImage": "https://...", "highlightsImage": "https://..." }

// Yenisi (badge seviyesinde) → EKLENDİ
{ "id": "uuid", "title": "First Purchase", "icon": "https://...", "highlightsImage": "https://cdn.../badges/highlights/ghi.png", "status": "completed" }
```

**App Tarafında Yapılması Gerekenler:**
1. Collection tiplerinden `highlightsImage` alanını kaldır
2. Badge tipine `highlightsImage: string | null` ekle
3. Collection ekranlarında `collection.highlightsImage` kullanan yerleri kaldır
4. Badge ekranlarında `badge.highlightsImage` kullanmaya başla
5. Highlights görseli artık `badges/highlights/` klasöründen geliyor (`collections/highlights/` değil)

### 2.2. EP-01: Collections List

Tüm collection'ları listeler. Arama, kategori filtresi, durum filtresi ve cursor tabanlı pagination destekler.

```
GET /api/collections/
```

#### Query Parameters

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

#### Response `200`

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

#### Response Fields

| Field              | Type           | Description                                       |
|--------------------|----------------|---------------------------------------------------|
| `id`               | string         | Collection UUID                                   |
| `title`            | string         | Collection adı                                    |
| `description`      | string         | Kısa veya uzun açıklama                           |
| `currentProgress`  | number         | Kullanıcının mevcut ilerlemesi                    |
| `totalProgress`    | number         | Toplam ilerleme hedefi                            |
| `coverImage`       | string \| null | Collection kapak görseli (CDN URL)                |
| `category`         | string \| null | Kategori handle'ı                                 |

### 2.3. EP-02: Collection Categories

Chip filter kategorilerini getirir. Sadece en az bir collection'a sahip kategoriler döner. Backend 24 saat cache'ler.

```
GET /api/collections/categories
```

#### Response `200`

```json
{
  "categories": [
    { "id": "uuid", "name": "Electronics", "handle": "electronics" }
  ]
}
```

| Field    | Type   | Description                                                |
|----------|--------|------------------------------------------------------------|
| `id`     | string | Kategori UUID                                              |
| `name`   | string | UI'da gösterilecek isim                                    |
| `handle` | string | EP-01'de `category` query param olarak gönderilecek değer  |

### 2.4. EP-03: Collection Detail + Badges

Bir collection'ın detayını ve badge listesini getirir.

```
GET /api/collections/:collectionId
```

#### Path Parameters

| Param          | Type   | Description     |
|----------------|--------|-----------------|
| `collectionId` | string | Collection UUID |

#### Query Parameters

| Param    | Type   | Description                                               |
|----------|--------|-----------------------------------------------------------|
| `search` | string | Badge title/description'da arama (400ms debounce önerilir)|

#### Response `200`

```json
{
  "collection": {
    "id": "uuid",
    "title": "Summer Season Badges",
    "description": "Detailed description of this collection",
    "currentProgress": 3,
    "totalProgress": 10,
    "coverImage": "https://cdn.example.com/media/collections/banners/abc.jpg",
    "category": "electronics"
  },
  "badges": [
    {
      "id": "uuid",
      "title": "First Purchase",
      "description": "Complete your first purchase",
      "icon": "https://cdn.example.com/media/badges/def.png",
      "highlightsImage": "https://cdn.example.com/media/badges/highlights/ghi.png",
      "currentProgress": 1,
      "totalProgress": 1,
      "status": "completed"
    }
  ]
}
```

#### Collection Fields

| Field              | Type           | Description                              |
|--------------------|----------------|------------------------------------------|
| `id`               | string         | Collection UUID                          |
| `title`            | string         | Collection adı                           |
| `description`      | string         | Uzun veya kısa açıklama                  |
| `currentProgress`  | number         | Kullanıcının toplam ilerlemesi           |
| `totalProgress`    | number         | Toplam ilerleme hedefi                   |
| `coverImage`       | string \| null | Kapak görseli (CDN URL)                  |
| `category`         | string \| null | Kategori handle'ı                        |

#### Badge Fields

| Field              | Type           | Description                                            |
|--------------------|----------------|--------------------------------------------------------|
| `id`               | string         | Badge UUID                                             |
| `title`            | string         | Badge adı                                              |
| `description`      | string         | Badge açıklaması                                       |
| `icon`             | string         | Badge görseli (CDN URL)                                |
| `highlightsImage`  | string \| null | Badge highlights görseli (CDN URL)                     |
| `currentProgress`  | number         | Kullanıcının bu badge için ilerlemesi                  |
| `totalProgress`    | number         | Tamamlanma hedefi                                      |
| `status`           | string         | `not_started` \| `in_progress` \| `completed`         |

#### Status Hesaplama

- `not_started`: `currentProgress === 0`
- `in_progress`: `currentProgress > 0 && currentProgress < totalProgress`
- `completed`: `currentProgress >= totalProgress`

### 2.5. EP-04: Completed Collections

Kullanıcının tamamladığı collection'ları getirir.

```
GET /api/collections/completed
```

#### Query Parameters

| Param    | Type   | Default | Description                                                |
|----------|--------|---------|------------------------------------------------------------|
| `userId` | string | —       | Hedef kullanıcı ID. Boş bırakılırsa giriş yapan kullanıcı.|
| `cursor` | string | —       | Pagination cursor                                          |
| `limit`  | number | `20`    | Sayfa başına item (min: 1, max: 50)                        |

#### Response `200`

```json
{
  "collections": [
    {
      "id": "uuid",
      "title": "Starter Collection",
      "description": "Get started with the platform",
      "coverImage": "https://cdn.example.com/media/collections/banners/abc.jpg",
      "category": "onboarding",
      "completedAt": "2026-03-15T14:30:00.000Z",
      "totalBadges": 5,
      "earnedBadges": 5
    }
  ],
  "pagination": { "cursor": null, "hasMore": false, "limit": 20, "total": 1 }
}
```

#### Response Fields

| Field              | Type           | Description                              |
|--------------------|----------------|------------------------------------------|
| `id`               | string         | Collection UUID                          |
| `title`            | string         | Collection adı                           |
| `description`      | string         | Açıklama                                 |
| `coverImage`       | string \| null | Kapak görseli (CDN URL)                  |
| `category`         | string \| null | Kategori handle'ı                        |
| `completedAt`      | string \| null | Son goal'un tamamlandığı tarih (ISO 8601)|
| `totalBadges`      | number         | Collection'daki toplam badge sayısı      |
| `earnedBadges`     | number         | Kullanıcının kazandığı badge sayısı      |

### 2.6. EP-05: User Collection Progress

Kullanıcının ilerleme kaydettiği collection'ları getirir. Hiç ilerleme olmayan collection'lar listelenmez. Profil sayfasında "Koleksiyonlar" bölümünde kullanılır.

```
GET /api/collections/user-progress
```

#### Query Parameters

| Param    | Type   | Default | Description                                                |
|----------|--------|---------|------------------------------------------------------------|
| `userId` | string | —       | Hedef kullanıcı ID. Boş bırakılırsa giriş yapan kullanıcı.|
| `cursor` | string | —       | Pagination cursor                                          |
| `limit`  | number | `20`    | Sayfa başına item (min: 1, max: 50)                        |

#### Response `200`

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
      "category": "tech",
      "status": "in_progress",
      "totalBadges": 8,
      "earnedBadges": 3
    }
  ],
  "pagination": { "cursor": "uuid-of-last-item", "hasMore": true, "limit": 20, "total": 5 }
}
```

#### Response Fields

| Field              | Type           | Description                                      |
|--------------------|----------------|--------------------------------------------------|
| `id`               | string         | Collection UUID                                  |
| `title`            | string         | Collection adı                                   |
| `description`      | string         | Açıklama                                         |
| `currentProgress`  | number         | Kullanıcının mevcut ilerlemesi                   |
| `totalProgress`    | number         | Toplam ilerleme hedefi                           |
| `coverImage`       | string \| null | Kapak görseli (CDN URL)                          |
| `category`         | string \| null | Kategori handle'ı                                |
| `status`           | string         | `in_progress` \| `completed`                     |
| `totalBadges`      | number         | Collection'daki toplam badge sayısı              |
| `earnedBadges`     | number         | Kullanıcının kazandığı badge sayısı              |

### 2.7. EP-06: Badge Reminder

Belirtilen badge için hatırlatma ayarlar.

```
POST /api/collections/badges/:badgeId/reminder
```

| Param    | Type   | Description |
|----------|--------|-------------|
| `badgeId`| string | Badge UUID  |

#### Request Body

```json
{ "remindAt": "2026-03-18T10:00:00.000Z" }
```

| Field      | Type   | Required | Description                                            |
|------------|--------|----------|--------------------------------------------------------|
| `remindAt` | string | Hayır    | Hatırlatma zamanı (ISO 8601). Yoksa 1 gün sonra.      |

#### Response `200`

```json
{ "id": "uuid", "remindAt": "2026-03-18T10:00:00.000Z" }
```

#### Error Responses

| Status | Description                     |
|--------|---------------------------------|
| `400`  | Geçersiz badgeId veya remindAt  |
| `401`  | Authentication başarısız        |
| `404`  | Badge bulunamadı                |

### 2.8. Filtreleme Rehberi

EP-01 dört farklı filtreleme yöntemini destekler. Frontend ihtiyaca göre bunları kombine edebilir.

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

### 2.9. Ortak Pagination Yapısı

Tüm liste endpointleri (EP-01, EP-04, EP-05) aynı cursor-based pagination yapısını kullanır:

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

**Infinite scroll:** `hasMore: true` ise sonraki isteğe `cursor` değerini ekleyerek devam edin:

```
GET /api/collections/?cursor=uuid-of-last-item&limit=20
```

### 2.10. Image URL'leri

Tüm image alanları (`coverImage`, `icon`, `highlightsImage`) CDN URL olarak döner:

- **coverImage**: Collection kapak görseli (`collections/banners/` klasöründen)
- **icon**: Badge görseli (`badges/` klasöründen)
- **highlightsImage**: Badge highlights görseli (`badges/highlights/` klasöründen)

URL formatı: `{MEDIA_PUBLIC_BASE_URL}/{path}`
Örnek: `https://api-test.tipbox.co/media/collections/banners/abc123.jpg`

`null` değer = görsel yok.

---

## 3. Yorum (Comment) API Değişiklikleri

### 3.1. `isLiked` Alanı Eklendi

`GET /api/interactions/posts/:postId/comments` response'unda her yorum ve reply için `isLiked` alanı eklendi.

**Eskisi:**
```json
{
  "comments": [
    {
      "comment": { "id": "uuid", "comment": "Great post!", "likesCount": 5 },
      "replies": [
        { "id": "uuid", "comment": "Thanks!", "likesCount": 2 }
      ],
      "user": { "id": "uuid", "name": "John" }
    }
  ]
}
```

**Yenisi:**
```json
{
  "comments": [
    {
      "comment": { "id": "uuid", "comment": "Great post!", "likesCount": 5 },
      "isLiked": true,
      "replies": [
        { "id": "uuid", "comment": "Thanks!", "likesCount": 2, "isLiked": false }
      ],
      "user": { "id": "uuid", "name": "John" }
    }
  ]
}
```

#### App Tarafında Yapılması Gerekenler

1. Comment tipine `isLiked: boolean` ekle
2. Reply tipine `isLiked: boolean` ekle
3. Yorum beğeni butonunun initial state'ini `isLiked` alanından oku
4. Artık her yorum için ayrı API çağrısı yapmaya gerek yok - `isLiked` tek sorguda geliyor

---

## 4. Experience Rating Parsing Değişiklikleri (Bug Fix)

### 4.1. Her Bölümün Kendi Rating'i Var

**BUG FIX:** Experience post oluşturulurken frontend farklı rating'ler gönderiyor (ör. `priceRating: 5`, `productRating: 4`), ancak API response'unda tüm bölümler **aynı** rating değerini döndürüyordu. Bu sorun düzeltildi.

**Sorun:** Backend, body'den rating parse ederken sadece ilk `Rating: X` değerini yakalayıp tüm bölümlere aynı değeri uyguluyordu.

**Düzeltme:** Her bölüm artık kendi `(Rating: X/5)` değerinden ayrı ayrı parse ediliyor. Düzeltme 5 farklı servise uygulandı:
- Feed service (ana feed)
- Explore service (keşfet)
- Brand service (marka sayfası)
- User service (profil sayfası)
- Catalog service (katalog)

**Eskisi (hatalı):** Tüm bölümler aynı rating'i alıyordu:
```json
{
  "experienceContent": [
    {
      "title": "Price and Shopping Experience",
      "content": "Great deals on electronics...",
      "rating": 5
    },
    {
      "title": "Product and Usage Experience",
      "content": "Battery life is excellent...",
      "rating": 5
    }
  ]
}
```

**Yenisi (doğru):** Her bölüm kendi rating değerine sahip:
```json
{
  "experienceContent": [
    {
      "title": "Price and Shopping Experience",
      "content": "Great deals on electronics...",
      "rating": 5
    },
    {
      "title": "Product and Usage Experience",
      "content": "Battery life is excellent...",
      "rating": 4
    }
  ]
}
```

#### Rating Değer Aralıkları

| Servis | Aralık | Açıklama |
|--------|--------|----------|
| Feed, Explore | 1-5 (body'den parse) veya 30-70 (fallback) | Body'de rating varsa 1-5, yoksa random 30-70 |
| Brand | 1-5 (body'den parse) veya hash-based (fallback) | Body'de rating varsa 1-5, yoksa `calculateExperienceRating` |
| User, Catalog | 1-5 | Body'den parse, fallback 0 |

#### App Tarafında Yapılması Gerekenler

- Her experience bölümünün `rating` değerini ayrı ayrı göster (zaten bölüm bazlı gösteriliyorsa sadece bug fix'in doğrulanması yeterli)
- `contentItem?.rating` değerini her bölüm için ayrı ayrı okumaya devam edin - artık doğru değerler gelecek
- Rating 1-5 aralığında ise yıldız olarak gösterilebilir

---

## 5. Tam Tip Tanımları (TypeScript)

Frontend'de kullanılacak güncel TypeScript tipleri:

```typescript
// ===== Collections =====

interface CollectionCategory {
  id: string;
  name: string;
  handle: string;  // EP-01'de category param olarak kullanılır
}

interface CollectionListItem {
  id: string;
  title: string;
  description: string;
  currentProgress: number;
  totalProgress: number;
  coverImage: string | null;
  category: string | null;
}

interface CollectionBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  highlightsImage: string | null;  // YENİ: Badge seviyesinde
  currentProgress: number;
  totalProgress: number;
  status: 'not_started' | 'in_progress' | 'completed';
}

interface UserCollectionProgressItem {
  id: string;
  title: string;
  description: string;
  currentProgress: number;
  totalProgress: number;
  coverImage: string | null;
  category: string | null;
  status: 'in_progress' | 'completed';
  totalBadges: number;
  earnedBadges: number;
}

interface CompletedCollectionItem {
  id: string;
  title: string;
  description: string;
  coverImage: string | null;
  category: string | null;
  completedAt: string | null;
  totalBadges: number;
  earnedBadges: number;
}

// ===== Comments =====

interface CommentItem {
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
  isLiked: boolean;  // YENİ
  replies: Array<{
    id: string;
    postId: string;
    userId: string;
    parentId: string | null;
    comment: string;
    isAnswer: boolean;
    likesCount: number;
    isLiked: boolean;  // YENİ
    createdAt: string;
    updatedAt: string;
  }>;
  user: {
    id: string;
    name: string | null;
    avatar: string | null;
  };
}

// ===== Experience Content =====

interface ExperienceContentItem {
  title: string;   // "Price and Shopping Experience" | "Product and Usage Experience"
  content: string;  // Bölüm içeriği
  rating: number;   // Bölüm bazlı rating (1-5 veya 30-70 fallback)
}

// ===== Marketplace My NFTs =====

interface UserNFTItem {
  id: string;
  title: string;
  username: string;
  image: string;                    // Tam URL (resolveMediaUrl ile dönüştürülmüş)
  description: string | null;
  type: 'COSMETIC';                 // Marketplace'te sadece COSMETIC
  rarity: 'COMMON' | 'RARE' | 'EPIC';
  listing: {
    id: string;
    price: number;
    listedAt: string;               // ISO 8601
    status: 'ACTIVE';               // Sadece ACTIVE listing döner
  } | null;                         // null = satışta değil
}

interface UserNFTsResponse {
  items: UserNFTItem[];
  pagination: {
    cursor: string | undefined;
    hasMore: boolean;
    limit: number;
  };
}

// ===== Push Notification Data =====

interface PushNotificationData {
  type: string;         // Bildirim tipi (POST_LIKED, NEW_MESSAGE, vb.)
  unreadCount: number;  // iOS app icon badge count
  avatar?: string;
  imageUrl?: string;
  postId?: string;
  badgeId?: string;
  senderId?: string;
  [key: string]: string | number | boolean;
}
```

---

## 6. Badge Bildirim Görseli (Bug Fix)

### Sorun

`NEW_BADGE` bildirimlerinde `badgeUrl` (badge görseli) `null` geliyordu.

### Sebep

Bildirim listeleme endpoint'inde (`GET /api/notifications`) badge görseli batch olarak DB'den çekilirken, `imageUrl`'i `null` olan badge'ler map'e `null` olarak kaydediliyordu. Fallback mantığı `Map.has()` ile kontrol ediyordu - map'te key vardı ama değer `null` olduğu için random fallback'e hiç düşmüyordu.

### Backend'de Yapılan Düzeltme

- Badge görseli `null` ise enricher'ın kaydettiği `data.imageUrl`'e, o da yoksa random badge görseline fallback yapıyor
- Artık badge görseli **her zaman** dolu gelecek (ya gerçek görsel, ya enricher'ın görseli, ya random fallback)

### App Tarafında

Bu tamamen backend fix'i. App tarafında değişiklik gerekmez. Ancak savunma amaçlı:

- `badgeUrl` alanını render ederken `null` kontrolü yapılmalı
- Eğer `null` gelirse local bir placeholder badge görseli gösterilebilir
- `NEW_BADGE` bildiriminin response yapısı:

```json
{
  "id": "uuid",
  "type": "NEW_BADGE",
  "title": "New Badge Earned! 🏆",
  "message": "You earned the Early Adapter badge!",
  "badgeUrl": "https://api-test.tipbox.co/media/badge/EarlyAdapter.png",
  "badgeName": "Early Adapter",
  "read": false,
  "createdAt": "2026-03-17T10:00:00.000Z"
}
```

> `badgeUrl` artık her zaman dolu gelecek. `avatar`, `userId`, `imageUrl` gibi alanlar `NEW_BADGE` tipinde gönderilmez.

---

## 7. Marketplace My NFTs API Değişiklikleri (Bug Fix)

### 7.1. `image` Alanı Düzeltildi

**BUG FIX:** `GET /api/marketplace/my-nfts` endpoint'inde NFT görselleri kırık URL olarak dönüyordu.

**Sorun:** `listUserNFTs` metodu `image` alanını `resolveMediaUrl()` kullanmadan doğrudan `nft.imageUrl` olarak döndürüyordu. Diğer tüm marketplace endpoint'leri (`/listings`, `/my-listings`, `/available-nfts`) bu dönüşümü yapıyordu ama `/my-nfts` atlıyordu.

**Düzeltme:** `image` alanı artık `resolveMediaUrl(nft.imageUrl)` ile dönüştürülüyor. Görsel URL'leri CDN/public base URL ile doğru şekilde resolve ediliyor.

**Eskisi (hatalı):**
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Cosmic Hat",
      "image": "nfts/cosmic-hat.png",
      "listing": null
    }
  ]
}
```

**Yenisi (doğru):**
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Cosmic Hat",
      "image": "https://api-test.tipbox.co/media/nfts/cosmic-hat.png",
      "listing": null
    }
  ]
}
```

### 7.2. `listing` Alanı Sadece ACTIVE Listing Döndürüyor

**BUG FIX:** Her NFT'nin `listing` bilgisi daha önce tüm status'lerdeki listing'leri (ACTIVE, SOLD, CANCELLED) çekiyordu. Bu durum satılmış veya iptal edilmiş eski listing'lerin görünmesine neden oluyordu.

**Düzeltme:** Artık sadece `ACTIVE` status'teki listing'ler döndürülüyor. Eğer bir NFT'nin aktif listing'i yoksa `listing: null` olarak gelir.

### 7.3. Sadece COSMETIC NFT'ler Listeleniyor

Bu kasıtlı bir davranıştır. `/my-nfts` endpoint'i yalnızca `COSMETIC` tipindeki NFT'leri döndürür. `BADGE` ve `LOOTBOX` tipleri marketplace'te listelenmez.

> App tarafında NFT listesi boş geliyorsa, kullanıcının sahip olduğu NFT'lerin tipini kontrol edin. Sadece `COSMETIC` tipi NFT'ler bu listede görünür.

### 7.4. Contract Sync Davranışı

`/my-nfts` çağrıldığında, kullanıcının `smartAccountAddress`'i varsa önce blockchain contract'ı ile DB sync yapılır. Bu sync:
- **Başarılı olursa:** DB'deki NFT sahipliği güncellenir, yeni mint'ler eklenir
- **Başarısız olursa:** Sessizce atlanır, sadece DB'deki mevcut veriler döner
- **Wallet yoksa:** Sync atlanır, sadece DB'deki veriler döner

> App tarafında ek bir işlem gerekmez. Ancak ilk yüklemede response biraz yavaş olabilir (contract sync süresi). Loading state gösterilmesi önerilir.

### 7.5. Güncel Response Yapısı

`GET /api/marketplace/my-nfts`

**Query Parameters:**

| Parametre | Tip | Default | Açıklama |
|-----------|-----|---------|----------|
| `limit` | number | 50 | Sayfa başına kayıt (max 100) |
| `cursor` | string | - | Son alınan item'ın ID'si (cursor-based pagination) |

**Response:**

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Cosmic Hat",
      "username": "john_doe",
      "image": "https://api-test.tipbox.co/media/nfts/cosmic-hat.png",
      "description": "A rare cosmic hat NFT",
      "type": "COSMETIC",
      "rarity": "RARE",
      "listing": {
        "id": "uuid",
        "price": 150,
        "listedAt": "2026-03-17T10:00:00.000Z",
        "status": "ACTIVE"
      }
    },
    {
      "id": "uuid",
      "title": "Golden Shield",
      "username": "john_doe",
      "image": "https://api-test.tipbox.co/media/nfts/golden-shield.png",
      "description": null,
      "type": "COSMETIC",
      "rarity": "EPIC",
      "listing": null
    }
  ],
  "pagination": {
    "cursor": "uuid-of-last-item",
    "hasMore": true,
    "limit": 50
  }
}
```

#### App Tarafında Yapılması Gerekenler

1. `image` alanının artık tam URL olarak geldiğini doğrulayın. Eğer app tarafında manual URL prefix ekliyorsanız, **kaldırın** (double prefix olur)
2. `listing` alanı `null` ise NFT satışta değildir; `listing.status === "ACTIVE"` ise satışta
3. `type` her zaman `"COSMETIC"` olacak (marketplace filtresi)
4. `rarity` değerleri: `"COMMON"`, `"RARE"`, `"EPIC"`
5. İlk yükleme sırasında contract sync nedeniyle gecikme olabilir - loading indicator gösterin

---

## 8. Kontrol Listesi

### Push Notification (iOS)
- [ ] `Notifications.requestPermissionsAsync()` ile iOS bildirim izni iste
- [ ] `Notifications.setNotificationHandler()` tanımla (`shouldSetBadge: true`)
- [ ] `TaskManager.defineTask()` ile background task tanımla
- [ ] `Notifications.registerTaskAsync()` ile background task'ı register et
- [ ] Push token kaydını `projectId` ile yap, `deviceType: 'ios'` gönder
- [ ] `eas credentials --platform ios` ile APNs key kontrolü yap
- [ ] `app.json`'da `UIBackgroundModes: ["remote-notification"]` ekle
- [ ] `app.json`'da `aps-environment: "production"` entitlement ekle
- [ ] Bildirim tıklanınca `data.type`'a göre navigasyon yap

### Collections
- [ ] Collection tiplerinden `highlightsImage` kaldır
- [ ] Badge tipine `highlightsImage: string | null` ekle
- [ ] Collection ekranlarındaki `highlightsImage` referanslarını temizle
- [ ] Badge detay/liste ekranlarında `highlightsImage` göster
- [ ] EP-02'den kategori listesini çekip chip filter implement et
- [ ] Chip filter'da seçilen kategori handle'ını EP-01'e `category` param olarak gönder
- [ ] Status filter implement et (`all`, `completed`, `in_progress`, `not_started`)
- [ ] Search debounce (500ms) ile arama implement et
- [ ] Cursor-based infinite scroll pagination implement et
- [ ] EP-03 badge listesinde `search` query param ile badge arama ekle
- [ ] EP-04/EP-05'te `userId` param ile başka kullanıcının koleksiyonlarını görüntüle

### Comments
- [ ] Comment tipine `isLiked: boolean` ekle
- [ ] Reply tipine `isLiked: boolean` ekle
- [ ] Beğeni butonunun initial state'ini `isLiked`'dan oku

### Experience Content (Bug Fix)
- [ ] Her bölümün kendi `rating` değerini ayrı gösterdiğini doğrula
- [ ] `priceRating` ve `productRating` değerlerinin API response'unda farklı döndüğünü test et
- [ ] Rating gösteriminin bölüm bazlı olduğunu doğrula (tek bir global rating yerine)

### Marketplace My NFTs (Bug Fix)
- [ ] `image` alanının artık tam URL döndüğünü doğrula (manual prefix ekliyorsanız kaldırın)
- [ ] `listing` alanı `null` ise "satışta değil" olarak göster
- [ ] `listing.status` sadece `"ACTIVE"` döneceğini göz önünde bulundur
- [ ] İlk yükleme gecikmesi için loading indicator ekle (contract sync)
- [ ] NFT tipinin `UserNFTItem` interface'inde güncel olduğunu doğrula

### Badge Bildirimleri
- [ ] `badgeUrl` render ederken `null` fallback (local placeholder) ekle
