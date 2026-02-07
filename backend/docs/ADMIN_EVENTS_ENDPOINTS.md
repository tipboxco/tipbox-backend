# Admin Panel — Events Bölümü Endpoint Listesi

Bu doküman, admin-panel **Events** bölümü için yöneticinin ihtiyaç duyacağı tüm API endpoint'lerini listeler. Tüm EP'ler **Admin auth** (`authMiddleware` + `requireAdmin`) ile korunacak; mevcut kullanıcı tarafı event EP'leri (`/events/*`) aynen kalacak, admin tarafı `/admin/events/*` altında toplanacak.

**Referans:** Prisma modelleri — `Event`, `EventStats`, `EventReward`, `EventBadge`, `Badge`; admin sayfaları — EventList, EventBadges, EventRewards, EventAnalytics.

**Admin panel ekran planı (Event–Badge ilişkisi, sekmeler, EP eşlemesi):** [ADMIN_EVENTS_ADMIN_PANEL_PLAN.md](ADMIN_EVENTS_ADMIN_PANEL_PLAN.md).

---

## 0. Backend durumu (EP'ler var mı?)

**Hayır.** Bu dokümandaki **tüm admin Events EP'leri** (`/admin/events/*`) şu an backend'de **tanımlı değil**.  
`admin.router.ts` içinde yalnızca şunlar var: `/admin/login`, `/admin/stats`, `/admin/users/*`, `/admin/user-reports/*`, `/admin/user-kyc/*`, `/admin/user-trust-scores`, `/admin/logs`. **`/admin/events`** altında hiç route yok.

Bu EP'leri kullanmak için [ADMIN_EVENTS_EP_PLAN.md](ADMIN_EVENTS_EP_PLAN.md) fazlarına göre backend'e eklenmesi gerekiyor.

---

## 1. Özet Tablo

| # | Metod | Path | Açıklama | Durum |
|---|-------|------|----------|--------|
| 1 | GET | `/admin/events/stats` | Event özet istatistikleri (total, draft, published, closed) | Eklenecek |
| 2 | GET | `/admin/events` | Event listesi (sayfalama, filtre: status, feedType, search, sort) | Eklenecek |
| 3 | GET | `/admin/events/:id` | Tek event detayı (admin görünümü, tüm alanlar) | Eklenecek |
| 4 | POST | `/admin/events` | Yeni event oluştur | Eklenecek |
| 5 | PATCH | `/admin/events/:id` | Event güncelle (title, description, dates, status, feedType, productId, brandId, imageUrl, categoryIds) | Eklenecek |
| 6 | DELETE | `/admin/events/:id` | Event sil (veya status=CLOSED yap; cascade ile EventStats/EventReward/EventBadge etkilenir) | Eklenecek |
| 7 | GET | `/admin/events/:id/participants` | Event'e katılan kullanıcılar listesi (EventStats tabanlı, sayfalı) | Eklenecek |
| 8 | GET | `/admin/events/:id/analytics` | Event özet analitik (katılımcı sayısı, toplam post, toplam ödül vb.) | Eklenecek |
| 9 | GET | `/admin/events/:id/badges` | Event badge'leri listesi (EventBadge + Badge bilgisi, admin görünümü) | Eklenecek |
| 10 | POST | `/admin/events/:id/badges` | Event'e badge ekle (badgeId, rank, displayOrder) | Eklenecek |
| 11 | PATCH | `/admin/events/:id/badges/:eventBadgeId` | Event badge güncelle (rank, displayOrder, enabled) | Eklenecek |
| 12 | DELETE | `/admin/events/:id/badges/:eventBadgeId` | Event'ten badge kaldır/sil | Eklenecek |
| 13 | GET | `/admin/events/:id/rewards` | Event ödül dağıtım listesi (EventReward, sayfalı) | Eklenecek |

---

## 2. Güvenlik

- **Tüm admin event EP'leri:** `authMiddleware` + `requireAdmin` kullanılacak.
- **Kullanıcı tarafı event EP'leri** (`/events/*`): Mevcut haliyle `authMiddleware` (user token) ile kalacak; admin EP'leri ayrı prefix (`/admin/events`) ile sadece admin token ile erişilecek.

---

## 3. Event CRUD ve Liste

### 3.1 GET /admin/events/stats

**Route sırası:** `GET /admin/events/stats` tanımı `GET /admin/events/:id`'den **önce** olmalı.

**Response örneği:**
```json
{
  "success": true,
  "data": {
    "total": 42,
    "draft": 5,
    "published": 30,
    "closed": 7
  }
}
```

- EventStatus'a göre count (DRAFT, PUBLISHED, CLOSED).

---

### 3.2 GET /admin/events

**Query:** `limit`, `offset`, `status` (DRAFT | PUBLISHED | CLOSED), `feedType` (PICKS | ROASTS), `search` (title/description contains), `sort` (createdAt | startDate | endDate | title), `order` (asc | desc).

**Response:** `{ success, data: AdminEventListItem[], pagination }`.  
Her öğe: id, title, description, startDate, endDate, status, feedType, imageUrl, productId, brandId, mainCategoryId, subCategoryId, createdAt; isteğe bağlı participantsCount (EventStats count).

---

### 3.3 GET /admin/events/:id

**Path:** `id` = Event.id (VarChar 26, ULID).

**Response:** Event tüm alanları + product/brand/mainCategory/subCategory özeti (id, name vb.). Admin detay görünümü.

---

### 3.4 POST /admin/events

**Body:** title (required), description?, startDate, endDate, status? (default DRAFT), feedType? (default PICKS), productId?, brandId?, mainCategoryId?, subCategoryId?, imageUrl?.

**Response:** `{ success, data: AdminEventDetailResponse }`.  
Oluşturma sonrası AdminLog: action `EVENT_CREATE`, entityType `event`.

---

### 3.5 PATCH /admin/events/:id

**Body:** title?, description?, startDate?, endDate?, status?, feedType?, productId?, brandId?, mainCategoryId?, subCategoryId?, imageUrl? (hepsi opsiyonel).

**Response:** Güncellenmiş event. AdminLog: action `EVENT_UPDATE`.

---

### 3.6 DELETE /admin/events/:id

**Davranış:** Event silinirse ilişkili EventStats, EventReward, EventBadge cascade ile silinir. Alternatif: Soft delete yerine status=CLOSED yapılabilir; plan tercihi: gerçek DELETE.  
AdminLog: action `EVENT_DELETE`.

**Response:** `{ success, message: "Event silindi" }`.

---

## 4. Event Katılımcılar ve Analitik

### 4.1 GET /admin/events/:id/participants

**Query:** `limit`, `offset`, `sort` (eventPostsCount | eventLikesReceived | totalParticipated | createdAt), `order`.

**Response:** EventStats tabanlı liste; her satır: userId, eventId, totalParticipated, totalComments, helpfulVotesReceived, eventPostsCount, eventLikesReceived, createdAt; isteğe bağlı user email/displayName (User + Profile join).

**Sayfa:** EventAnalytics veya EventList detayında "Katılımcılar" sekmesi.

---

### 4.2 GET /admin/events/:id/analytics

**Response:** Özet sayılar: participantCount (EventStats count), totalPosts (ContentPost where eventId), totalRewardsGranted (EventReward count), badgesCount (EventBadge count). İsteğe bağlı: leaderboard top N.

**Sayfa:** EventAnalytics.

---

## 5. Event Badge Yönetimi

### 5.1 GET /admin/events/:id/badges

**Query:** `limit`, `offset` (gerekirse).  
**Response:** EventBadge listesi; her öğe: id, eventId, badgeId, rank, displayOrder, enabled, createdAt; Badge bilgisi (name, description, imageUrl, rarity, categoryId veya category name) join.

**Sayfa:** EventBadges.

---

### 5.2 POST /admin/events/:id/badges

**Body:** badgeId (UUID), rank (int), displayOrder? (int).  
**Validasyon:** badgeId mevcut Badge olmalı; aynı eventId + rank unique (EventBadge @@unique([eventId, rank])).

**Response:** Oluşturulan EventBadge + Badge özeti. AdminLog: action `EVENT_BADGE_ADD`.

---

### 5.3 PATCH /admin/events/:id/badges/:eventBadgeId

**Body:** rank?, displayOrder?, enabled?  
**Path:** eventBadgeId = EventBadge.id (UUID).

**Response:** Güncellenmiş EventBadge. AdminLog: action `EVENT_BADGE_UPDATE`.

---

### 5.4 DELETE /admin/events/:id/badges/:eventBadgeId

**Response:** `{ success, message: "Badge event'ten kaldırıldı" }`. AdminLog: action `EVENT_BADGE_REMOVE`.

---

## 6. Event Ödülleri

### 6.1 GET /admin/events/:id/rewards

**Query:** `limit`, `offset`, `userId?`, `rewardType?` (TIPS | BADGE | TITLE), `sort` (awardedAt | createdAt), `order`.

**Response:** EventReward listesi; her öğe: id, userId, eventId, rewardType, rewardId, amount, awardedAt, createdAt; isteğe bağlı user email/displayName.

**Sayfa:** EventRewards.

---

## 7. Admin Panel Sayfa – EP Eşlemesi

| Admin sayfa | Kullanılacak endpoint'ler |
|-------------|---------------------------|
| **EventList** | GET /admin/events/stats, GET /admin/events (filtre: status, feedType, search, sort, order) |
| **Event detay / düzenleme** | GET /admin/events/:id, PATCH /admin/events/:id, DELETE /admin/events/:id, POST /admin/events (yeni event) |
| **EventAnalytics** | GET /admin/events/:id/analytics, GET /admin/events/:id/participants |
| **EventBadges** | GET /admin/events/:id/badges, POST /admin/events/:id/badges, PATCH /admin/events/:id/badges/:eventBadgeId, DELETE /admin/events/:id/badges/:eventBadgeId |
| **EventRewards** | GET /admin/events/:id/rewards |

---

## 8. Uygulama Sırası Önerisi (Fazlar)

1. **Faz 1 — Event liste ve detay:** GET /admin/events/stats, GET /admin/events, GET /admin/events/:id. Route sırası: `/events/stats` ve `/events` sonra `/events/:id`.
2. **Faz 2 — Event CRUD:** POST /admin/events, PATCH /admin/events/:id, DELETE /admin/events/:id.
3. **Faz 3 — Katılımcılar ve analitik:** GET /admin/events/:id/participants, GET /admin/events/:id/analytics.
4. **Faz 4 — Event badge yönetimi:** GET /admin/events/:id/badges, POST, PATCH, DELETE event badges.
5. **Faz 5 — Event ödülleri:** GET /admin/events/:id/rewards.

---

## 9. Teknik Notlar

- **Event id:** VarChar(26), ULID formatında; path'te `:id` olarak kullanılır.
- **AdminLog:** Event create/update/delete ve event badge add/update/remove işlemlerinde action + description + entityType (`event` veya `event_badge`) + entityId (0 veya ilgili id) yazılmalı.
- **DTO'lar:** admin.dto.ts veya ayrı admin-event.dto.ts içinde AdminEventListItem, AdminEventDetailResponse, AdminEventStatsResponse, AdminEventParticipantListItem, AdminEventBadgeListItem, AdminEventRewardListItem vb. tanımlanabilir.
- **Validation:** admin.schemas.ts veya admin-event.schemas.ts ile Zod şemaları (CreateEvent, UpdateEvent, AddEventBadge, UpdateEventBadge).
