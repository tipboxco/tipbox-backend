# Admin Panel — Badges & Collections Endpoint Listesi

Bu doküman, admin-panel **Badges** ve **Badge Collections** bölümleri için yöneticinin ihtiyaç duyacağı tüm API endpoint'lerini listeler. Tüm EP'ler **Admin auth** (`authMiddleware` + `requireAdmin`) ile korunur.

**Referans:** Prisma modelleri — `Badge`, `BadgeCollection`, `BadgeCategory`, `UserBadge`, `Category`; admin sayfaları — BadgeList, BadgeDetail, CollectionList, CollectionDetail.

**Uygulama planı:** [ADMIN_BADGES_COLLECTIONS_EP_PLAN.md](ADMIN_BADGES_COLLECTIONS_EP_PLAN.md). **Panel planı:** [ADMIN_BADGES_COLLECTIONS_ADMIN_PANEL_PLAN.md](ADMIN_BADGES_COLLECTIONS_ADMIN_PANEL_PLAN.md).

---

## 1. Özet Tablo

### Koleksiyonlar

| # | Metod | Path | Açıklama |
|---|-------|------|----------|
| 1 | GET | `/admin/collections/stats` | Koleksiyon özet (total) |
| 2 | GET | `/admin/collections` | Koleksiyon listesi (sayfalama, search, categoryId, sort) |
| 3 | GET | `/admin/collections/:id` | Tek koleksiyon detayı |
| 4 | POST | `/admin/collections` | Koleksiyon oluştur |
| 5 | PATCH | `/admin/collections/:id` | Koleksiyon güncelle |
| 6 | DELETE | `/admin/collections/:id` | Koleksiyon sil |
| 7 | GET | `/admin/collections/:id/badges` | Koleksiyona ait badge listesi |
| 8 | POST | `/admin/collections/:id/badges` | Koleksiyona badge ekle (body: badgeId) |
| 9 | DELETE | `/admin/collections/:id/badges/:badgeId` | Badge'i koleksiyondan çıkar |
| 9b | GET | `/admin/action-types` | Aktivasyon tipleri listesi (ActionType: id, mainAction, code, label) |
| 9c | POST | `/admin/collections/:id/goals` | Koleksiyon için AchievementGoal oluştur (body: actionTypeId, rewardBadgeId, pointsRequired, title?, requirement?, difficulty?) |

### Badge'ler

| # | Metod | Path | Açıklama |
|---|-------|------|----------|
| 10 | GET | `/admin/badges/stats` | Badge özet (total, byType, byRarity) |
| 11 | GET | `/admin/badges` | Badge listesi (sayfalama, type, rarity, categoryId, collectionId, search) |
| 12 | GET | `/admin/badges/:id` | Tek badge detayı |
| 13 | POST | `/admin/badges` | Badge oluştur |
| 14 | PATCH | `/admin/badges/:id` | Badge güncelle |
| 15 | DELETE | `/admin/badges/:id` | Badge sil |
| 16 | GET | `/admin/badges/:id/owners` | Badge'e sahip kullanıcılar (UserBadge + User/Profile) |

---

## 2. Koleksiyonlar

### GET /admin/collections/stats

**Response:** `{ success, data: { total } }`.

---

### GET /admin/collections

**Query:** `limit`, `offset`, `search` (name contains), `categoryId`, `sort` (createdAt | name), `order` (asc | desc).

**Response:** `{ success, data: AdminCollectionListItem[], pagination }`. Her öğe: id, name, bannerUrl, owner, categoryId? (opsiyonel), categoryName?, badgesCount, goalsCount, createdAt.

---

### GET /admin/collections/:id

**Response:** AdminCollectionDetailResponse: id, name, bannerUrl, owner, categoryId?, categoryName?, badgesCount, goalsCount, createdAt, focusSector?, targetGroup?, shortDescription?, longDescription?, unlockCondition?, completionBonus?, updatedAt, category?.

---

### POST /admin/collections

**Body (COLLECTION METADATA):** name (required), bannerUrl? (Cover Image), owner?, focusSector?, targetGroup?, shortDescription?, longDescription?, unlockCondition? (Prerequisite), completionBonus? (Completion Reward), categoryId? (opsiyonel).

**Response:** `{ success, data: AdminCollectionDetailResponse }`. AdminLog: COLLECTION_CREATE.

---

### PATCH /admin/collections/:id

**Body:** Yukarıdaki alanların hepsi opsiyonel (name, bannerUrl, owner, focusSector, targetGroup, shortDescription, longDescription, unlockCondition, completionBonus, categoryId).

**Response:** Güncellenmiş koleksiyon. AdminLog: COLLECTION_UPDATE.

---

### DELETE /admin/collections/:id

Önce ilgili badge'lerin collectionId'si null yapılır, sonra koleksiyon silinir. AdminLog: COLLECTION_DELETE.

---

### GET /admin/collections/:id/badges

**Response:** `{ success, data: AdminCollectionBadgeListItem[] }`. Badge where collectionId = id; category, type, rarity dahil.

---

### POST /admin/collections/:id/badges

**Body:** `{ badgeId: string }` (UUID). Mevcut badge'in collectionId'si bu koleksiyon id'si yapılır.

**Response:** `{ success, message, data: { badgeId } }`. AdminLog: COLLECTION_BADGE_ADD.

---

### DELETE /admin/collections/:id/badges/:badgeId

Badge.collectionId = null yapılır. AdminLog: COLLECTION_BADGE_REMOVE.

---

### GET /admin/action-types

**Açıklama:** Badge aktivasyon tipi seçimi için ActionType listesi (Aktivasyon tipi = mainAction + code ile eşleşen hedef).

**Response:** `{ success, data: AdminActionTypeListItem[] }`. Her öğe: id, mainAction, code, label.

---

### POST /admin/collections/:id/goals

**Açıklama:** Koleksiyona bağlı bir AchievementGoal oluşturur. Badge bu koleksiyona ait olmalı (rewardBadgeId'nin collectionId'si path'teki id ile aynı).

**Body:** actionTypeId (UUID), rewardBadgeId (UUID), pointsRequired (number, min 1), title? (string), requirement? (string), difficulty? (EASY | MEDIUM | HARD, default MEDIUM).

**Response:** `201` `{ success, data: { id: string } }`. AdminLog: COLLECTION_GOAL_CREATE.

---

## 3. Badge'ler

### GET /admin/badges/stats

**Response:** `{ success, data: { total, byType: Record<string, number>, byRarity: Record<string, number> } }`.

---

### GET /admin/badges

**Query:** `limit`, `offset`, `type` (COLLECTION | EVENT | COSMETIC | BRAND), `rarity` (COMMON | RARE | EPIC), `categoryId`, `collectionId`, `search` (name/description), `sort` (createdAt | name), `order`.

**Response:** `{ success, data: AdminBadgeListItem[], pagination }`. Her öğe: id, name, description, imageUrl, type, rarity, categoryId, categoryName, collectionId, collectionName, createdAt.

---

### GET /admin/badges/:id

**Response:** Tüm Badge alanları + category, collection özeti. AdminBadgeDetailResponse.

---

### POST /admin/badges

**Body:** name (required), description?, imageUrl?, type (BadgeType), rarity (BadgeRarity), boostMultiplier?, rewardMultiplier?, categoryId (UUID), collectionId? (UUID).

**Response:** `{ success, data: AdminBadgeDetailResponse }`. AdminLog: BADGE_CREATE.

---

### PATCH /admin/badges/:id

**Body:** Yukarıdaki alanların hepsi opsiyonel.

**Response:** Güncellenmiş badge. AdminLog: BADGE_UPDATE.

---

### DELETE /admin/badges/:id

Badge silinir. UserBadge/EventBadge/AchievementGoal referansları schema'ya göre (cascade/restrict). AdminLog: BADGE_DELETE.

---

### GET /admin/badges/:id/owners

**Query:** `limit`, `offset`, `claimed` (true | false), `sort` (createdAt | claimedAt), `order`.

**Response:** `{ success, data: AdminBadgeOwnerListItem[], pagination }`. Her öğe: id (userBadgeId), userId, badgeId, claimed, claimedAt, createdAt, userEmail, userDisplayName.

---

## 4. Güvenlik

Tüm bu EP'ler `authMiddleware` + `requireAdmin` ile korunur. Admin token gerekir.
