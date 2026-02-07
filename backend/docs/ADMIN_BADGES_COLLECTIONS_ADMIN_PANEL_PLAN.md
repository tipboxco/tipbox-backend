# Admin Panel — Badges & Collections Ekran Planı

Bu doküman, [ADMIN_BADGES_COLLECTIONS_EP.md](ADMIN_BADGES_COLLECTIONS_EP.md) ve plana göre admin panelde **Badge** ve **Badge Collection** ekranlarının nasıl planlandığını ve EP eşlemesini tanımlar.

---

## 1. Ekran Özeti

| Ekran | Route | Açıklama |
|-------|--------|----------|
| **CollectionList** | `/gamification/collections` | Koleksiyon stats + filtreli liste + "Detay" → CollectionDetail, "Yeni koleksiyon" |
| **CollectionDetail** | `/gamification/collections/:id` | Koleksiyon detayı; sekmeler: Özet \| Badge'ler |
| **BadgeList** | `/gamification/badges` | Badge stats + filtreli liste + "Detay" → BadgeDetail, "Yeni badge" |
| **BadgeDetail** | `/gamification/badges/:id` | Badge detayı; sekmeler: Özet \| Sahipler |

---

## 2. CollectionList (`/gamification/collections`)

**EP'ler:** GET /admin/collections/stats, GET /admin/collections.

**Ekran:** Stats kartı (Toplam koleksiyon); filtreler: search (name), categoryId, sort (createdAt | name), order; tablo: ad, kategori, badge sayısı, oluşturulma; "Detay" → `/gamification/collections/:id`; "Yeni koleksiyon" butonu → modal veya create sayfası (POST /admin/collections).

---

## 3. CollectionDetail (`/gamification/collections/:id`)

**EP'ler:** GET /admin/collections/:id, PATCH /admin/collections/:id, DELETE /admin/collections/:id; GET /admin/collections/:id/badges, POST /admin/collections/:id/badges, DELETE /admin/collections/:id/badges/:badgeId.

**Layout:** Üst: "Listeye dön" (`/gamification/collections`), koleksiyon adı, ID. **Sekmeler: Özet | Badge'ler.**

### 3.1 Sekme: Özet

Tüm BadgeCollection alanları (name, bannerUrl, owner, category, collectionObjective, targetVertical, productScope, collectionType, hookPitch, visualTheme, completionBonus, primaryKpi, secondaryKpi, targetAudience, campaignContext, successMetric, sponsorship, unlockCondition, scheduleLaunchDate, timeStockLimit). Düzenle formu (PATCH). Sil butonu (onay + DELETE).

### 3.2 Sekme: Badge'ler

"Bu koleksiyon: [ad]" bağlamı. GET /admin/collections/:id/badges tablosu: badge adı, tip, rarity, kategori, işlemler (Koleksiyondan çıkar). "Badge ekle" → mevcut badge seç (dropdown, GET /admin/badges ile liste) + POST /admin/collections/:id/badges (badgeId). "Koleksiyondan çıkar" → onay + DELETE.

---

## 4. BadgeList (`/gamification/badges`)

**EP'ler:** GET /admin/badges/stats, GET /admin/badges.

**Ekran:** Stats (total, type/rarity dağılımı); filtreler: type, rarity, categoryId, collectionId, search; tablo: ad, tip, rarity, kategori, koleksiyon, oluşturulma; "Detay" → `/gamification/badges/:id`; "Yeni badge" → modal veya create sayfası (POST /admin/badges).

---

## 5. BadgeDetail (`/gamification/badges/:id`)

**EP'ler:** GET /admin/badges/:id, PATCH /admin/badges/:id, DELETE /admin/badges/:id; GET /admin/badges/:id/owners.

**Layout:** Üst: "Listeye dön" (`/gamification/badges`), badge adı, ID. **Sekmeler: Özet | Sahipler.**

### 5.1 Sekme: Özet

Badge alanları (name, description, imageUrl, type, rarity, category, collection, boostMultiplier, rewardMultiplier). Koleksiyon varsa link → `/gamification/collections/:collectionId`. Düzenle formu (PATCH). Sil butonu (onay + DELETE).

### 5.2 Sekme: Sahipler

"Bu badge'e sahip kullanıcılar." GET /admin/badges/:id/owners tablosu: kullanıcı email, displayName, userId, claimed, claimedAt, createdAt; sayfalama. Kullanıcı adına tıklanınca `/users/:userId` (UserDetail).

---

## 6. Dosya eşlemesi

| Sayfa | Dosya | EP kullanımı |
|-------|--------|---------------|
| Badge listesi | admin-panel/src/pages/gamification/Badges.tsx | GET stats, GET list |
| Badge detay | admin-panel/src/pages/gamification/BadgeDetail.tsx | GET badge, PATCH, DELETE, GET owners |
| Koleksiyon listesi | admin-panel/src/pages/gamification/BadgeCollections.tsx | GET stats, GET list |
| Koleksiyon detay | admin-panel/src/pages/gamification/CollectionDetail.tsx | GET collection, PATCH, DELETE; GET/POST/DELETE collection badges |

**API:** admin-panel/src/api/admin-badges-collections.ts (veya admin-badges.ts + admin-collections.ts).  
**Tipler:** admin-panel/src/types/admin.ts — AdminCollectionStatsResponse, AdminCollectionListItem, AdminCollectionDetailResponse, AdminCollectionBadgeListItem; AdminBadgeStatsResponse, AdminBadgeListItem, AdminBadgeDetailResponse, AdminBadgeOwnerListItem.
