# Admin Events Endpoint Uygulama Planı

Referans: [backend/docs/ADMIN_EVENTS_ENDPOINTS.md](backend/docs/ADMIN_EVENTS_ENDPOINTS.md). Tüm EP'ler **Admin auth** (`authMiddleware` + `requireAdmin`) ile korunacak. Admin event route'ları ya mevcut [backend/src/interfaces/admin/admin.router.ts](backend/src/interfaces/admin/admin.router.ts) içine `/events` altında eklenecek ya da ayrı bir `admin-events.router.ts` oluşturulup app'te `/admin` altında mount edilecek. DTO'lar [backend/src/interfaces/admin/admin.dto.ts](backend/src/interfaces/admin/admin.dto.ts) veya `admin-event.dto.ts` içinde tanımlanacak.

**Backend durumu:** Bu plandaki EP'ler şu an **backend'de yok**. admin.router.ts'de `/admin/events/*` route'u tanımlı değil; aşağıdaki fazlar uygulanınca eklenecek.

---

## Mevcut durum

- **Kullanıcı tarafı:** `/events/*` (event.router.ts) — authMiddleware ile user token; listeleme, detay, join/leave, badges, rewards, leaderboard, posts vb.
- **Admin tarafı event EP'leri:** Yok. Eklenecek: `/admin/events/*` (liste, CRUD, participants, analytics, badges CRUD, rewards listesi).

---

## Faz 1 — Event liste ve detay

**Hedef:** EventList ve tek event detay ekranlarının admin tarafında çalışması.

- **GET /admin/events/stats** — Event özet istatistikleri (total, draft, published, closed). Route sırası: `/events/stats` tanımı `/events/:id`'den önce olmalı.
- **GET /admin/events** — Query: `limit`, `offset`, `status`, `feedType`, `search`, `sort`, `order`. Event listesi; listeye isteğe bağlı participantsCount (EventStats count) eklenebilir.
- **GET /admin/events/:id** — Tek event detayı (tüm Event alanları + product, brand, mainCategory, subCategory özeti).

**Çıktı:** admin.dto.ts veya admin-event.dto.ts içinde AdminEventStatsResponse, AdminEventListItem, AdminEventDetailResponse. Router'da sıralama: `/admin/events/stats` ve `/admin/events` (liste) tanımları `/admin/events/:id`'den önce.

---

## Faz 2 — Event CRUD

- **POST /admin/events** — Body: title (required), description?, startDate, endDate, status?, feedType?, productId?, brandId?, mainCategoryId?, subCategoryId?, imageUrl?. Validasyon (Zod); AdminLog EVENT_CREATE.
- **PATCH /admin/events/:id** — Body: aynı alanlar (opsiyonel). AdminLog EVENT_UPDATE.
- **DELETE /admin/events/:id** — Event silme (cascade: EventStats, EventReward, EventBadge). AdminLog EVENT_DELETE.

**Çıktı:** CreateEventSchema, UpdateEventSchema (Zod); AdminLog entegrasyonu.

---

## Faz 3 — Katılımcılar ve analitik

- **GET /admin/events/:id/participants** — Query: `limit`, `offset`, `sort`, `order`. EventStats listesi; user email/displayName (User + Profile join). Sayfalı response.
- **GET /admin/events/:id/analytics** — Özet: participantCount, totalPosts (ContentPost where eventId), totalRewardsGranted (EventReward count), badgesCount (EventBadge count).

**Çıktı:** AdminEventParticipantListItem, AdminEventAnalyticsResponse DTO'ları.

---

## Faz 4 — Event badge yönetimi

- **GET /admin/events/:id/badges** — EventBadge listesi + Badge bilgisi (name, imageUrl, rarity, category).
- **POST /admin/events/:id/badges** — Body: badgeId, rank, displayOrder?. Badge var mı kontrolü; EventBadge @@unique([eventId, rank]) ihlali kontrolü. AdminLog EVENT_BADGE_ADD.
- **PATCH /admin/events/:id/badges/:eventBadgeId** — Body: rank?, displayOrder?, enabled?. AdminLog EVENT_BADGE_UPDATE.
- **DELETE /admin/events/:id/badges/:eventBadgeId** — EventBadge sil. AdminLog EVENT_BADGE_REMOVE.

**Çıktı:** AdminEventBadgeListItem DTO; AddEventBadgeSchema, UpdateEventBadgeSchema (Zod).

---

## Faz 5 — Event ödülleri

- **GET /admin/events/:id/rewards** — Query: `limit`, `offset`, `userId?`, `rewardType?`, `sort`, `order`. EventReward listesi; isteğe bağlı user email/displayName.

**Çıktı:** AdminEventRewardListItem DTO; sayfalı response.

---

## Dosya değişiklikleri özeti

| Dosya | Değişiklik |
|-------|------------|
| [backend/src/interfaces/admin/admin.router.ts](backend/src/interfaces/admin/admin.router.ts) | `/events` altında tüm admin event route'ları (veya ayrı admin-events.router mount) |
| [backend/src/interfaces/admin/admin.dto.ts](backend/src/interfaces/admin/admin.dto.ts) veya admin-event.dto.ts | AdminEventStatsResponse, AdminEventListItem, AdminEventDetailResponse, AdminEventParticipantListItem, AdminEventAnalyticsResponse, AdminEventBadgeListItem, AdminEventRewardListItem |
| Validation şemaları | admin.schemas.ts veya admin-event.schemas.ts — CreateEvent, UpdateEvent, AddEventBadge, UpdateEventBadge (Zod) |

---

## Route sırası (admin.router içinde)

1. `GET /admin/events/stats` — sabit path önce
2. `GET /admin/events` — liste
3. `GET /admin/events/:id/participants` — :id altında önce daha spesifik
4. `GET /admin/events/:id/analytics`
5. `GET /admin/events/:id/badges`
6. `POST /admin/events/:id/badges`
7. `GET /admin/events/:id/badges/:eventBadgeId` — tek badge detayı (isteğe bağlı)
8. `PATCH /admin/events/:id/badges/:eventBadgeId`
9. `DELETE /admin/events/:id/badges/:eventBadgeId`
10. `GET /admin/events/:id/rewards`
11. `GET /admin/events/:id` — tek event detay (en sonda :id yakalansın)
12. `POST /admin/events`
13. `PATCH /admin/events/:id`
14. `DELETE /admin/events/:id`

---

## Güvenlik

- Tüm bu route'lar `authMiddleware` + `requireAdmin` ile korunacak.
- Kullanıcı tarafı `/events/*` route'ları değişmeyecek; sadece admin paneli için `/admin/events/*` eklenmiş olacak.

---

## Admin panel ekran planı

Backend EP'ler hazır olduktan sonra admin panelde hangi ekranların nasıl kullanılacağı ve **Event–Badge ilişkisi yönetiminin** nasıl öne çıkarılacağı için: **[ADMIN_EVENTS_ADMIN_PANEL_PLAN.md](ADMIN_EVENTS_ADMIN_PANEL_PLAN.md)**.
