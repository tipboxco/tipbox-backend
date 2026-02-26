# Admin Panel — Content Bölümü Endpoint Listesi

Bu doküman, admin-panel **Content** bölümü için yöneticinin ihtiyaç duyacağı tüm API endpoint'lerini listeler. Tüm EP'ler **Admin auth** (`authMiddleware` + `requireAdmin`) ile korunur; prefix `/admin/content/*` (postlar, yorumlar, feed highlights, trending, manual review, moderation, tags).

**Referans:** Prisma modelleri — `ContentPost`, `ContentComment`, `FeedHighlight`, `TrendingPost`, `TopCommunityChoice`, `ManualReviewFlag`, `ModerationAction`, `ContentPostTag`; admin sayfaları — ContentPosts, ContentPostDetail, ContentComments, TrendingPosts, ModerationQueue, ManualReviews, TagsCategories, FeedHighlights.

**Admin panel ekran planı:** [ADMIN_CONTENT_ADMIN_PANEL_PLAN.md](ADMIN_CONTENT_ADMIN_PANEL_PLAN.md).

---

## 0. Backend durumu (EP'ler var mı?)

**Evet.** Bu dokümandaki admin Content EP'leri `admin.router.ts` içinde `/admin/content/*` ve `/admin/users/:id/posts` olarak tanımlıdır.

---

## 1. Özet Tablo

| # | Metod | Path | Açıklama | Durum |
|---|-------|------|----------|--------|
| 1 | GET | `/admin/content/posts/stats` | Post özet istatistikleri (total, byType, boostedCount, withEventCount) | Var |
| 2 | GET | `/admin/content/posts` | Post listesi (sayfalama, filtre: type, userId, eventId, category, search, sort) | Var |
| 3 | GET | `/admin/content/posts/:id` | Tek post detayı (tüm alanlar + user, category, product, event, media, tags, question, comparison, tip) | Var |
| 4 | PATCH | `/admin/content/posts/:id` | Post güncelle (title, body, isBoosted, boostedUntil, category/product alanları) | Var |
| 5 | DELETE | `/admin/content/posts/:id` | Post sil (cascade) | Var |
| 6 | GET | `/admin/content/comments/stats` | Yorum özet (total) | Var |
| 7 | GET | `/admin/content/comments` | Yorum listesi (postId, userId, parentIdNull, sort, order) | Var |
| 8 | GET | `/admin/content/comments/:id` | Tek yorum detayı (post + user + repliesCount) | Var |
| 9 | PATCH | `/admin/content/comments/:id` | Yorum güncelle (comment metni) | Var |
| 10 | DELETE | `/admin/content/comments/:id` | Yorum sil | Var |
| 11 | GET | `/admin/content/feed-highlights` | Feed highlight listesi | Var |
| 12 | POST | `/admin/content/feed-highlights` | Highlight ekle (postId, reason: STAFF_PICK | MOST_LIKED | BOOSTED) | Var |
| 13 | PATCH | `/admin/content/feed-highlights/:id` | Highlight reason güncelle | Var |
| 14 | DELETE | `/admin/content/feed-highlights/:id` | Highlight kaldır | Var |
| 15 | GET | `/admin/content/trending` | Trending post listesi (trendPeriod: DAILY | WEEKLY) | Var |
| 16 | POST | `/admin/content/trending` | Trending'e manuel ekle (postId, trendPeriod, score?) | Var |
| 17 | PATCH | `/admin/content/trending/:id` | Score/trendPeriod güncelle | Var |
| 18 | DELETE | `/admin/content/trending/:id` | Trending'den kaldır | Var |
| 19 | GET | `/admin/content/top-community-choices` | Top community choice listesi | Var |
| 20 | POST | `/admin/content/top-community-choices` | Top community choice ekle (postId, reason?, badgeLabel) | Var |
| 21 | PATCH | `/admin/content/top-community-choices/:id` | reason, badgeLabel güncelle | Var |
| 22 | DELETE | `/admin/content/top-community-choices/:id` | Kaldır | Var |
| 23 | GET | `/admin/content/manual-review-flags` | Manual review flag listesi (status, contentType filtre) | Var |
| 24 | GET | `/admin/content/manual-review-flags/:id` | Tek flag detayı | Var |
| 25 | PATCH | `/admin/content/manual-review-flags/:id` | status güncelle (OPEN | IN_REVIEW | RESOLVED) | Var |
| 26 | GET | `/admin/content/moderation-actions` | Moderation aksiyon listesi | Var |
| 27 | GET | `/admin/content/moderation-actions/:id` | Tek moderation aksiyon detayı | Var |
| 28 | GET | `/admin/content/tags` | Kullanılan tag listesi (aggregate veya postId'ye göre) | Var |
| 29 | GET | `/admin/users/:id/posts` | Kullanıcının yazdığı postlar (sayfalı) | Var |

---

## 2. Güvenlik

- **Tüm admin content EP'leri:** `authMiddleware` + `requireAdmin`.
- **Prefix:** `/admin/content/*` ve User–Content bağlantısı için `/admin/users/:id/posts`.

---

## 3. Posts

### 3.1 GET /admin/content/posts/stats

**Route sırası:** `GET /admin/content/posts/stats` tanımı `GET /admin/content/posts/:id`'den **önce** olmalı.

**Response örneği:**
```json
{
  "success": true,
  "data": {
    "total": 1000,
    "byType": { "FREE": 400, "TIPS": 200, "EXPERIENCE": 300, "QUESTION": 50, "COMPARE": 50 },
    "boostedCount": 10,
    "withEventCount": 120
  }
}
```

### 3.2 GET /admin/content/posts

**Query:** `limit`, `offset`, `type` (FREE | TIPS | COMPARE | QUESTION | EXPERIENCE | UPDATE), `userId`, `eventId`, `mainCategoryId`, `subCategoryId`, `productId`, `search` (title/body contains), `sort` (createdAt | likesCount | commentsCount | viewsCount | title), `order` (asc | desc).

**Response:** `{ success, data: AdminContentPostListItem[], pagination }`. Her öğe: id, userId, type, title, bodyExcerpt, createdAt, likesCount, commentsCount, favoritesCount, viewsCount, isBoosted, boostedUntil, eventId, mainCategoryId, subCategoryId, productId, userDisplayName, userName.

### 3.3 GET /admin/content/posts/:id

**Path:** `id` = ContentPost.id (VarChar 26).

**Response:** Tüm post alanları + user, mainCategory, subCategory, category, product, productGroup, event özeti; media (id, mediaUrl, orderIndex); tags dizisi; question, comparison, tip varsa.

### 3.4 PATCH /admin/content/posts/:id

**Body:** title?, body?, isBoosted?, boostedUntil?, mainCategoryId?, subCategoryId?, categoryId?, productGroupId?, productId? (hepsi opsiyonel).

**Response:** Güncellenmiş post özeti. AdminLog: action `CONTENT_POST_UPDATE`.

### 3.5 DELETE /admin/content/posts/:id

**Response:** `{ success, message: "Post silindi", data: { id } }`. AdminLog: action `CONTENT_POST_DELETE`. Cascade: comments, likes, feed entries vb.

---

## 4. Comments

### 4.1 GET /admin/content/comments/stats

**Response:** `{ success, data: { total } }`.

### 4.2 GET /admin/content/comments

**Query:** `limit`, `offset`, `postId`, `userId`, `parentIdNull` (true = sadece üst yorumlar), `sort` (createdAt | likesCount), `order`.

**Response:** `{ success, data: AdminContentCommentListItem[], pagination }`. Her öğe: id, postId, userId, parentId, comment, commentExcerpt, isAnswer, likesCount, createdAt, userDisplayName, userName, postTitle.

### 4.3 GET /admin/content/comments/:id

**Response:** Yorum detayı + post özeti + user özeti + repliesCount.

### 4.4 PATCH /admin/content/comments/:id

**Body:** comment? (string). AdminLog: action `CONTENT_COMMENT_UPDATE`.

### 4.5 DELETE /admin/content/comments/:id

**Response:** `{ success, message: "Yorum silindi", data: { id } }`. AdminLog: action `CONTENT_COMMENT_DELETE`.

---

## 5. Feed Highlights

### 5.1 GET /admin/content/feed-highlights

**Query:** `limit`, `offset`, `postId`, `reason` (MOST_LIKED | STAFF_PICK | BOOSTED), `sort`, `order`.

**Response:** `{ success, data: AdminFeedHighlightListItem[], pagination }`.

### 5.2 POST /admin/content/feed-highlights

**Body:** postId (string, max 26), reason (STAFF_PICK | MOST_LIKED | BOOSTED). AdminLog: action `FEED_HIGHLIGHT_CREATE`. FeedHighlight.id: ULID (generateIdForModel('FeedHighlight')).

### 5.3 PATCH /admin/content/feed-highlights/:id

**Body:** reason? (enum). AdminLog: action `FEED_HIGHLIGHT_UPDATE`.

### 5.4 DELETE /admin/content/feed-highlights/:id

**Response:** `{ success, message: "Feed highlight kaldırıldı" }`. AdminLog: action `FEED_HIGHLIGHT_DELETE`.

---

## 6. Trending Posts

### 6.1 GET /admin/content/trending

**Query:** `limit`, `offset`, `trendPeriod` (DAILY | WEEKLY), `sort` (score | calculatedAt | createdAt), `order`.

**Response:** `{ success, data: AdminTrendingPostListItem[], pagination }`.

### 6.2 POST /admin/content/trending

**Body:** postId, trendPeriod (DAILY | WEEKLY), score? (number, default 0). AdminLog: action `TRENDING_POST_CREATE`. TrendingPost.id: ULID.

### 6.3 PATCH /admin/content/trending/:id

**Body:** score?, trendPeriod?. AdminLog: action `TRENDING_POST_UPDATE`.

### 6.4 DELETE /admin/content/trending/:id

**Response:** `{ success, message: "Trending'den kaldırıldı" }`. AdminLog: action `TRENDING_POST_DELETE`.

---

## 7. Top Community Choices

### 7.1 GET /admin/content/top-community-choices

**Query:** `limit`, `offset`, `postId`, `sort` (awardedAt | createdAt), `order`.

**Response:** `{ success, data: AdminTopCommunityChoiceListItem[], pagination }`.

### 7.2 POST /admin/content/top-community-choices

**Body:** postId, reason? (string), badgeLabel (string, required). AdminLog: action `TOP_COMMUNITY_CHOICE_CREATE`.

### 7.3 PATCH /admin/content/top-community-choices/:id

**Body:** reason?, badgeLabel?. AdminLog: action `TOP_COMMUNITY_CHOICE_UPDATE`.

### 7.4 DELETE /admin/content/top-community-choices/:id

**Response:** `{ success, message: "Kaldırıldı" }`. AdminLog: action `TOP_COMMUNITY_CHOICE_DELETE`.

---

## 8. Manual Review Flags

### 8.1 GET /admin/content/manual-review-flags

**Query:** `limit`, `offset`, `status` (OPEN | IN_REVIEW | RESOLVED), `contentType`, `sort`, `order`.

**Response:** `{ success, data: AdminManualReviewFlagListItem[], pagination }`.

### 8.2 GET /admin/content/manual-review-flags/:id

**Response:** Flag detayı + contentSummary (contentType#contentId).

### 8.3 PATCH /admin/content/manual-review-flags/:id

**Body:** status? (OPEN | IN_REVIEW | RESOLVED). AdminLog: action `MANUAL_REVIEW_FLAG_UPDATE`.

---

## 9. Moderation Actions

### 9.1 GET /admin/content/moderation-actions

**Query:** `limit`, `offset`, `targetUserId`, `contentType`, `actionType`, `sort`, `order`.

**Response:** `{ success, data: AdminModerationActionListItem[], pagination }`. Read-only liste; yeni aksiyon oluşturmak için mevcut user ban EP'leri kullanılır.

### 9.2 GET /admin/content/moderation-actions/:id

**Response:** Moderation aksiyon detayı + target user + contentSummary.

---

## 10. Tags

### 10.1 GET /admin/content/tags

**Query:** `limit`, `offset`, `postId?` (verilirse sadece o post'un tag'leri), `search?` (tag metni).

**Response:** `{ success, data: AdminContentTagListItem[] }`. Her öğe: tag (string), count (number). postId verilmezse aggregate (tüm tag'ler, kullanım sayısına göre).

---

## 11. User–Content bağlantısı

### 11.1 GET /admin/users/:id/posts

**Path:** `id` = User.id (UUID). **Route sırası:** Bu route `GET /admin/users/:id`'den **önce** tanımlanmalı (Express sırası).

**Query:** AdminContentPostsQuerySchema ile aynı (limit, offset, type?, sort, order). where.userId = id.

**Response:** `{ success, data: AdminContentPostListItem[], pagination }`. Kullanıcının yazdığı postlar; format admin post listesi ile aynı.

---

## 12. Admin Panel Sayfa – EP Eşlemesi

| Admin sayfa | Kullanılacak endpoint'ler |
|-------------|---------------------------|
| **ContentPosts** | GET /admin/content/posts/stats, GET /admin/content/posts |
| **ContentPostDetail** | GET /admin/content/posts/:id, PATCH /admin/content/posts/:id, DELETE /admin/content/posts/:id |
| **ContentComments** | GET /admin/content/comments/stats, GET /admin/content/comments, GET /admin/content/comments/:id, PATCH, DELETE |
| **TrendingPosts** | GET /admin/content/trending, POST, PATCH, DELETE /admin/content/trending |
| **ModerationQueue** | GET /admin/content/moderation-actions, GET /admin/content/manual-review-flags, PATCH /admin/content/manual-review-flags/:id |
| **ManualReviews** | GET /admin/content/manual-review-flags, GET /admin/content/manual-review-flags/:id, PATCH |
| **FeedHighlights** | GET /admin/content/feed-highlights, POST, PATCH, DELETE |
| **TagsCategories** | GET /admin/content/tags |
| **User Detail > Postları** | GET /admin/users/:id/posts |

---

## 13. Teknik Notlar

- **ContentPost id:** VarChar(26), ULID benzeri. **FeedHighlight id, TrendingPost id:** VarChar(26), generateIdForModel ile üretilir.
- **ManualReviewFlag contentId:** Int (legacy). **ModerationAction contentId:** Int | null.
- **AdminLog:** Tüm content CRUD ve highlight/trending/top-community-choice işlemlerinde action + description + entityType + entityId (0) yazılır.
- **DTO'lar:** admin.dto.ts içinde AdminContentPostsStatsResponse, AdminContentPostListItem, AdminContentPostDetailResponse, AdminContentCommentListItem, AdminContentCommentDetailResponse, AdminFeedHighlightListItem, AdminTrendingPostListItem, AdminTopCommunityChoiceListItem, AdminManualReviewFlagListItem, AdminModerationActionListItem, AdminContentTagListItem.
- **Validation:** admin.schemas.ts içinde AdminContentPostsQuerySchema, AdminContentPostUpdateSchema, AdminContentCommentsQuerySchema, AdminContentCommentUpdateSchema, AdminFeedHighlightCreateSchema, AdminFeedHighlightUpdateSchema, AdminTrendingQuerySchema, AdminTrendingCreateSchema, AdminTrendingUpdateSchema, AdminTopCommunityChoicesQuerySchema, AdminTopCommunityChoiceCreateSchema, AdminTopCommunityChoiceUpdateSchema, AdminManualReviewFlagsQuerySchema, AdminManualReviewFlagUpdateSchema, AdminModerationActionsQuerySchema, AdminContentTagsQuerySchema.
