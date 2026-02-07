# Admin Badges & Collections Endpoint Uygulama Planı

Referans: [ADMIN_BADGES_COLLECTIONS_EP.md](ADMIN_BADGES_COLLECTIONS_EP.md). Tüm EP'ler **Admin auth** (`authMiddleware` + `requireAdmin`) ile korunur. Route'lar [backend/src/interfaces/admin/admin.router.ts](backend/src/interfaces/admin/admin.router.ts) içinde `/collections` ve `/badges` altında tanımlanır.

---

## Faz 1 — Koleksiyonlar CRUD + Koleksiyon Badge'leri

- **GET /admin/collections/stats** — Toplam koleksiyon sayısı.
- **GET /admin/collections** — Liste; query: limit, offset, search, categoryId, sort, order.
- **GET /admin/collections/:id/badges** — Koleksiyona ait badge listesi.
- **POST /admin/collections/:id/badges** — Body: badgeId. Mevcut badge'i koleksiyona bağla.
- **DELETE /admin/collections/:id/badges/:badgeId** — Badge'i koleksiyondan çıkar (collectionId null).
- **GET /admin/collections/:id** — Tek koleksiyon detayı.
- **POST /admin/collections** — Koleksiyon oluştur.
- **PATCH /admin/collections/:id** — Koleksiyon güncelle.
- **DELETE /admin/collections/:id** — Önce badge'lerin collectionId null, sonra koleksiyon sil.

**Çıktı:** admin.dto.ts — AdminCollectionStatsResponse, AdminCollectionListItem, AdminCollectionDetailResponse, AdminCollectionBadgeListItem. admin.schemas.ts — AdminCollectionsQuerySchema, AdminCreateCollectionSchema, AdminUpdateCollectionSchema, AdminAddCollectionBadgeSchema. AdminLog: COLLECTION_CREATE, COLLECTION_UPDATE, COLLECTION_DELETE, COLLECTION_BADGE_ADD, COLLECTION_BADGE_REMOVE.

---

## Faz 2 — Badge'ler CRUD + Badge Sahipler

- **GET /admin/badges/stats** — total, byType, byRarity.
- **GET /admin/badges** — Liste; query: limit, offset, type, rarity, categoryId, collectionId, search, sort, order.
- **GET /admin/badges/:id/owners** — UserBadge listesi + User/Profile (email, displayName); sayfalı.
- **GET /admin/badges/:id** — Tek badge detayı.
- **POST /admin/badges** — Badge oluştur.
- **PATCH /admin/badges/:id** — Badge güncelle.
- **DELETE /admin/badges/:id** — Badge sil.

**Çıktı:** admin.dto.ts — AdminBadgeStatsResponse, AdminBadgeListItem, AdminBadgeDetailResponse, AdminBadgeOwnerListItem. admin.schemas.ts — AdminBadgesQuerySchema, AdminCreateBadgeSchema, AdminUpdateBadgeSchema, AdminBadgeOwnersQuerySchema. AdminLog: BADGE_CREATE, BADGE_UPDATE, BADGE_DELETE.

---

## Route sırası (admin.router)

1. GET /admin/collections/stats  
2. GET /admin/collections  
3. GET /admin/collections/:id/badges  
4. POST /admin/collections/:id/badges  
5. DELETE /admin/collections/:id/badges/:badgeId  
6. GET /admin/collections/:id  
7. POST /admin/collections  
8. PATCH /admin/collections/:id  
9. DELETE /admin/collections/:id  
10. GET /admin/badges/stats  
11. GET /admin/badges  
12. GET /admin/badges/:id/owners  
13. GET /admin/badges/:id  
14. POST /admin/badges  
15. PATCH /admin/badges/:id  
16. DELETE /admin/badges/:id  

---

## Dosya değişiklikleri

| Dosya | Değişiklik |
|-------|------------|
| admin.router.ts | /collections/* ve /badges/* route'ları |
| admin.dto.ts | Collection ve Badge DTO'ları |
| admin.schemas.ts | Collection ve Badge Zod şemaları |
