# Son Değişikliklere Göre Backend Eşlemesi

Bu dokümanda son frontend değişikliklerinden etkilenen **yapılar**, **kullanılan API’ler** ve **backend tarafında mimari için öneriler** özetlenmiştir.

---

## 1. Değişen / Yeni Ekranlar ve Akışlar

### 1.1 Brand History Screen (Marka Geçmişim)

- **Dosya:** `src/features/catalog/screens/BrandHistoryScreen.tsx`
- **Değişiklik:** Tek sayfa yerine **3 sekmeli** yapı (Posts, Polls, Badges), yatay swipe (PagerView), full ekran (bottom inset yok).
- **Kullanılan API’ler:**
  - `GET /brands/{brandId}/history` → istatistikler, rozetler, puan geçmişi
  - `GET /brands/{brandId}/feed` → post listesi (pagination)
  - `GET /brands/{brandId}/surveys` → anket listesi (pagination)

**Backend’den beklenen sözleşmeler:**

| Endpoint | Method | Amaç | Response (özet) |
|----------|--------|------|------------------|
| `/brands/{brandId}/history` | GET | Marka özeti, rozetler, puan geçmişi | `BrandHistory` (aşağıda) |
| `/brands/{brandId}/feed` | GET | Marka feed postları | `{ items: BrandFeedPost[], pagination }` |
| `/brands/{brandId}/surveys` | GET | Marka anketleri | `{ items: Survey[], pagination }` |

**Tipler (catalog/types.ts):**

```ts
// BrandHistory - /brands/{brandId}/history
interface BrandHistory {
  brandId: string;
  name: string;
  totalPoints: number;
  stats: { surveys: number; shares: number; events: number };
  badges: Array<{ id: string; title: string; image: string }>;
  pointsHistory: Array<{ id: string; title: string; points: number; date: string }>;
}

// Survey - /brands/{brandId}/surveys item
interface Survey {
  id: string;
  title: string;
  description: string;
  type: string;
  duration: string;
  points: number;
  status: 'start' | 'continue' | 'view_results';  // API'de "viewresults" → normalize
  progress?: number;
}
```

- Feed: `BrandFeedPost[]` + `pagination: { cursor?, hasMore, limit }`.
- Not: `brandId` history response’ta opsiyonel kabul ediliyor (log’da `undefined` gelebiliyor); backend’de mutlaka dönülmesi önerilir.

---

### 1.2 Edit Highlight Badges Screen (Yeni)

- **Dosya:** `src/features/profile/screens/EditHighlightBadgesScreen.tsx`
- **Açılış:** ProfileScreen’de “Edit Highlight Badges” tıklanınca.
  - Parametre: `initialBadgeIds?: string[]` (mevcut profil rozet ID’leri).
- **Davranış:**
  - 4 slot (highlight badge); her slotta rozet veya boş (+).
  - Sekmeler: **Event Badges** (achievements) | **Collections** (bridges).
  - Save: Şu an sadece `goBack()`; **backend çağrısı TODO**.

**Backend için çıkarımlar:**

1. **Profil “highlight badges” = 4 slot**
   - Mevcut `UpdateProfileRequest.badge?: string[]` yorumu “max 3” idi; yeni ekranda **4 slot** var.
   - Backend’de:
     - Ya `PUT/ PATCH /users/me/profile` içinde `badge` alanı **max 4** olacak şekilde güncellenmeli,
     - Ya da ayrı bir endpoint ile “highlight badges” yönetilmeli (aşağıda öneri).

2. **Seçilebilir rozet listesi**
   - Event Badges: `mockBadgesData.achievements` (profile mock).
   - Collections: `mockBadgesData.bridges`.
   - Backend’de bunların karşılığı:
     - Event/achievement rozetleri için bir endpoint (örn. `GET /users/me/available-badges?type=event` veya `/badges/achievements`),
     - Collections/bridge rozetleri için bir endpoint (örn. `GET /users/me/available-badges?type=collection` veya `/badges/collections`).
   - Response: en az `{ id, title, image }` (ve isteğe göre `rarity`, `category`).

3. **Önerilen endpoint (Highlight Badges kaydet)**

```
PATCH /users/me/profile
Body: { highlightBadgeIds: string[] }  // max 4, sıralı

veya

PUT /users/me/highlight-badges
Body: { badgeIds: string[] }  // max 4, sıralı
```

- Profil okumada (`GET /users/{userId}/profile`) zaten `badges` array’i var; bunun “highlight” (öne çıkan 4’lü) olarak yorumlanması ve sıralı dönmesi yeterli olabilir. Yeni endpoint gerekmez; sadece `PUT /users/me/profile` ile `badge: string[]` (max 4) gönderilir.

---

### 1.3 Collections & CollectionCardModal (Events)

- **Dosyalar:**
  - `src/features/events/screens/CollectionDetailScreen.tsx` – Collection detay + badge listesi
  - `src/features/events/components/CollectionCardModal/index.tsx` – Badge kartı (360° dönüş, download)
  - `src/features/events/components/TabContents/CollectionsTab.tsx` – Collection listesi
  - `src/features/events/types/collection.types.ts` – Tipler
  - `src/services/MediaService/index.ts` – Badge image galeriye kaydetme

- **Akış:**
  - Collections tab’da liste → Collection’a tıklanınca `CollectionDetailScreen` (param: `collectionId`)
  - Detayda collection hero + badge listesi; badge’e tıklanınca **CollectionCardModal** açılıyor
  - Modal’da Download’a basılınca kart 360° dönüyor, **badge image URL’den indirilip galeriye kaydediliyor**, kart arka yüzde kalıyor

**Backend’den beklenen endpoint’ler:**

| Endpoint | Method | Amaç | Response (özet) |
|----------|--------|------|------------------|
| `/collections` | GET | Collection listesi (opsiyonel filtre) | `{ collections: Collection[], total: number }` |
| `/collections/:id` | GET | Tek collection + badge listesi | `{ collection: Collection, badges: CollectionBadge[] }` |

**Tipler (events/types/collection.types.ts):**

```ts
// Collection (liste + detay)
interface Collection {
  id: string;
  title: string;
  description: string;
  currentProgress: number;
  totalProgress: number;
  backgroundGradient: {
    colors: string[];
    start: { x: number; y: number };
    end: { x: number; y: number };
  };
  category?: string;
}

// Badge durumu
type CollectionBadgeStatus = 'not_started' | 'in_progress' | 'completed';

// Collection içindeki badge – icon/iconUrl mutlaka public URL (download için)
interface CollectionBadge {
  id: string;
  title: string;
  description: string;
  icon: string;  // API'de iconUrl dönebilir → frontend map: icon = response.iconUrl
  currentProgress: number;
  totalProgress: number;
  status: CollectionBadgeStatus;
}

// GET /collections/:id response
interface CollectionDetailResponse {
  collection: Collection;
  badges: CollectionBadge[];
}
```

**Kritik noktalar:**

1. **Badge image URL:** Her badge için **public, indirilebilir image URL** (CDN/storage) dönülmeli; uygulama bu URL ile galeriye kaydediyor.
2. **Progress:** `currentProgress` / `totalProgress` kullanıcıya göre; `status` buna göre `not_started` | `in_progress` | `completed`.
3. **backgroundGradient:** Collection kartı için `colors`, `start`, `end` frontend’de aynen kullanılıyor.

---

## 2. Profil Tarafı – Mevcut Sözleşmeler

### 2.1 Profil okuma

- **Endpoint:** `GET /users/{userId}/profile`
- **Kullanım:** ProfileScreen, EditHighlightBadges’e açılırken `profile.badges` → `initialBadgeIds`.
- **Beklenen alan (data içinde):**
  - `badges?: Array<{ id: string; title: string; image?: string }>`
  - Sıra: Öne çıkan (highlight) sırasıyla; **max 4** önerilir.

### 2.2 Profil güncelleme

- **Endpoint:** `PUT /users/me/profile`
- **Mevcut request (profileApi.ts):**
  - `name?`, `biography?`, `cosmetic?`, `badge?: string[]` (yorum: max 3 → **4’e çıkarılmalı**).

### 2.3 Tipler (profile/types.ts)

```ts
interface Badge {
  id: string;
  title: string;
  image?: string;
  type?: 'collection' | 'event';
}

interface UserProfile {
  // ...
  badges: Badge[];
}
```

- Edit Highlight Badges ekranı “seçilebilir liste” için şu an mock kullanıyor; backend’de event/collection rozet listesi endpoint’leri eklendiğinde bu listeler API’den doldurulabilir.

---

## 3. Özet Tablo – Backend Tarafında Yapılacaklar

| Alan | Öneri |
|------|--------|
| **Brand History** | `GET /brands/{brandId}/history` response’ta `brandId` alanının her zaman dolu gelmesi. |
| **Brand Feed** | `GET /brands/{brandId}/feed` → `items` + cursor tabanlı `pagination`. |
| **Brand Surveys** | `GET /brands/{brandId}/surveys` → `items` (Survey[]) + `pagination`; `status` için "viewresults" → client’ta "view_results" normalize. |
| **Collections listesi** | `GET /collections` → `{ collections: Collection[], total: number }`; opsiyonel kategori/filtre. |
| **Collection detay + badge’ler** | `GET /collections/:id` → `{ collection: Collection, badges: CollectionBadge[] }`; her badge’te **icon/iconUrl** public URL (download için). |
| **Profil badges** | `GET /users/{userId}/profile` → `badges` array’i **max 4**, sıralı (highlight order). |
| **Profil güncelleme** | `PUT /users/me/profile` → `badge?: string[]` **max 4** (highlight badge ID’leri, sıralı). |
| **Edit Highlight Badges – kaydet** | Mevcut `updateProfile` ile `badge: string[]` (max 4) gönderilmesi yeterli; istenirse ayrı `PUT /users/me/highlight-badges` da tanımlanabilir. |
| **Seçilebilir rozet listesi** | (Opsiyonel) Event/Collections için `GET /badges/achievements`, `GET /badges/collections` veya `GET /users/me/available-badges?type=event|collection`; response `{ id, title, image }[]`. |

---

## 4. Son Değişiklikler – Boost, Prime Pass, NFT Badges

Bu bölüm, **Boost (Question Post)**, **Prime Pass / NFT badge** ve **CreateQuestionPostScreen** boost UI değişikliklerinden sonra backend tarafında netleştirilmesi gereken yapıları özetler.

### 4.1 Boost (Question Post) – Posts API

**Endpoint’ler:**

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/posts/boost-price` | Dinamik boost fiyatı (post ID yok). **Kritik:** Bu route **mutlaka** `GET /posts/:postId` **önce** tanımlanmalı; aksi halde "boost-price" literal’ı postId gibi eşleşip 404 "Post not found" döner. |
| POST | `/posts/question` | Soru gönderisi oluşturma (FormData). |
| PATCH | `/posts/:postId/boost` | Boost aç/kapa. |

**GET /posts/boost-price – Response:**

```ts
interface GetBoostPriceResponse {
  price: number;        // TIPS
  currency: string;     // "TIPS"
  factors?: {
    onlineUsers?: number;
    activityLevel?: string;
    timeOfDay?: string;
  };
}
```

**POST /posts/question – Body (FormData):**

- `contextType`, `contextId`, `description`, `images[]`
- **`boostEnabled`**: boolean (string olarak gönderilir: `"true"` / `"false"`). Backend bu alanı okuyup kayıt etmeli; boost açıksa ödeme/fiyat akışı buna göre yürütülmeli.

**PATCH /posts/:postId/boost – Body ve Response:**

- Body: `{ enabled: boolean }`
- Response: `{ success, postId, isBoosted, boostPrice?, message? }`

**Frontend referans:** `src/features/post/api/postApi.ts` (`getBoostPrice`, `createQuestionPost`, `togglePostBoost`), `src/features/post/screens/CreateQuestionPostScreen.tsx`.

---

### 4.2 Prime Pass ve NFT Badge (Payment / Subscription)

- **Yeni endpoint yok.** Profilde “Prime Pass var mı?” kontrolü **mevcut** payment dashboard ile yapılıyor.
- Frontend: `usePaymentDashboard()` → `GET /users/settings/payment-dashboard`; response içindeki `active_subscription` kullanılıyor.

**Beklenen yapı (zaten kullanılıyor):**

```ts
// GET /users/settings/payment-dashboard response
interface PaymentDashboard {
  saved_cards: PaymentMethod[];
  active_subscription: Subscription | null;
  recent_invoices: Invoice[];
}

interface Subscription {
  current_plan_id: string;
  plan_name: string;   // "Prime Pass" vb. – frontend plan_name.toLowerCase().includes('prime') ile kontrol
  status: 'active' | 'trialing' | 'canceled' | 'past_due';
  next_billing_date: string;
  benefits: string[];
}
```

- **Prime Pass:** `active_subscription !== null`, `status === 'active'` ve `plan_name` içinde "prime" (case-insensitive). Backend’de Prime plan adının bu şekilde tutulması yeterli.
- NFT ribbon sadece UI; ekstra API yok. Badge listesinde `type?: 'collection' | 'event'` varsa frontend buna göre ayrım yapıyor.

**Frontend referans:** `src/features/settings/api/paymentApi.ts`, `src/features/profile/screens/ProfileScreen.tsx` (`hasPrimePass`, `NFTBadgeRibbon`).

---

### 4.3 Profile – Badges ve Tip

- Profil badge’leri için tip: `Badge` içinde **`type?: 'collection' | 'event'`** (profil badge listesinde kullanılıyor).
- Backend’den badge listesi dönerken bu alan varsa frontend collection vs event modal ayrımını yapıyor; zorunlu değil.

---

### 4.4 Collections (Events) – İlerleme ve Filtre

- **Collection** tipi (frontend): `id`, `title`, `description`, `currentProgress`, `totalProgress`, `backgroundGradient`, `category?`.
- CollectionsTab şu an **mock** veri kullanıyor; backend’e geçince:
  - Kullanıcıya özel ilerleme için `currentProgress` / `totalProgress` (veya eşdeğer) dönülmeli.
  - İstenirse “sadece tamamlanan koleksiyonlar” için filtre: `currentProgress === totalProgress`; backend’de query param (örn. `?completed=true`) ile desteklenebilir.

**Frontend referans:** `src/features/events/components/TabContents/CollectionsTab.tsx`, `src/features/events/types/collection.types.ts`.

---

### 4.5 Backend Checklist (Son Değişiklikler)

| Konu | Yapılacak |
|------|-----------|
| **Posts router** | `GET /posts/boost-price` route’unu **`GET /posts/:postId`’den önce** tanımla; response: `price`, `currency`, isteğe bağlı `factors`. |
| **Question post** | `POST /posts/question` body’de `boostEnabled` alanını okuyup kaydet; boost açıksa ödeme/fiyat mantığını buna göre bağla. |
| **Boost toggle** | `PATCH /posts/:postId/boost` ile `enabled` alıp `isBoosted` ve isteğe bağlı `boostPrice` döndür. |
| **Payment/Subscription** | `GET /users/settings/payment-dashboard` response’unda `active_subscription.plan_name` ve `status` alanlarını koru; Prime Pass için plan adında "prime" geçmesini sağla. |
| **Collections** | Gerçek API’de collection listesinde `currentProgress` / `totalProgress` (veya eşdeğer) dön; istenirse “sadece tamamlananlar” için query param (örn. `?completed=true`) ekle. |

---

## 5. Dosya Referansları (Frontend)

- Brand History: `src/features/catalog/screens/BrandHistoryScreen.tsx`, `src/features/catalog/api/brandApi.ts`, `src/features/catalog/types.ts`
- Edit Highlight Badges: `src/features/profile/screens/EditHighlightBadgesScreen.tsx`, `src/features/profile/screens/ProfileScreen.tsx` (navigate + initialBadgeIds)
- Profil API: `src/features/profile/api/profileApi.ts` (`UpdateProfileRequest`, `getUserProfile`), `src/features/profile/types.ts` (`UserProfile`, `Badge`)
- Collections: `src/features/events/screens/CollectionDetailScreen.tsx`, `src/features/events/components/CollectionCardModal/index.tsx`, `src/features/events/components/TabContents/CollectionsTab.tsx`, `src/features/events/types/collection.types.ts`, `src/services/MediaService/index.ts`
- Boost (Posts): `src/features/post/api/postApi.ts` (`getBoostPrice`, `createQuestionPost`, `togglePostBoost`), `src/features/post/screens/CreateQuestionPostScreen.tsx`, `src/features/post/api/hooks.ts` (`useBoostPrice`)
- Payment / Prime Pass: `src/features/settings/api/paymentApi.ts` (`getPaymentDashboard`, `PaymentDashboard`, `Subscription`), `src/features/profile/screens/ProfileScreen.tsx` (`hasPrimePass`, `NFTBadgeRibbon`)

Bu yapılar son değişiklikler sonrası güncel haliyle backend mimarisinin buna göre kurgulanması için referans alınabilir.
