# Admin Panel — Content Ekran Planı

Bu doküman, [ADMIN_CONTENT_ENDPOINTS.md](ADMIN_CONTENT_ENDPOINTS.md) dosyasına göre admin panelde **Content** ekranlarının nasıl planlanacağını, nelerin ekleneceği/güncelleneceğini tanımlar.

**Ön koşul:** Backend'de `/admin/content/*` ve `/admin/users/:id/posts` endpoint'leri tanımlı ve çalışır. Panel bu EP'lere göre tasarlanır.

---

## 1. Ekran Özeti

| Ekran | Route | Açıklama | Durum |
|-------|--------|----------|--------|
| **ContentPosts** | `/content/posts` | Post özet istatistikleri + filtreli post listesi | Güncellenecek (şu an placeholder) |
| **ContentPostDetail** | `/content/posts/:id` | Tek post detayı; özet, yorumlar preview, feed highlights, trending; düzenle/sil/highlight ekle | Yeni eklenecek |
| **ContentComments** | `/content/comments` | Yorum listesi + filtreler; detay/modal | Güncellenecek |
| **TrendingPosts** | `/content/trending` | Trending post listesi; ekle/düzenle/kaldır | Güncellenecek |
| **ModerationQueue** | `/content/moderation` | Manual review flags + moderation actions; incele/çöz | Güncellenecek |
| **ManualReviews** | `/content/reviews` | Manual review flag listesi; detay, çözüldü işaretle | Güncellenecek |
| **FeedHighlights** | `/content/feed-highlights` | Feed highlight listesi; ekle/düzenle/kaldır (veya Post Detail'dan) | Yeni veya mevcut sayfaya entegre |
| **TagsCategories** | `/content/tags` | Tag listesi (aggregate); kategori yönetimi için katalog linki | Güncellenecek |
| **User Detail > Postları** | `/users/:id` (sekme) | Kullanıcının postları listesi; post detay linki | Eklenecek |

---

## 2. ContentPosts (`/content/posts`)

**Kullanılacak EP'ler:**

- `GET /admin/content/posts/stats` → Özet istatistikler (total, byType, boostedCount, withEventCount).
- `GET /admin/content/posts` → Liste; query: `limit`, `offset`, `type`, `userId`, `eventId`, `mainCategoryId`, `subCategoryId`, `productId`, `search`, `sort`, `order`.

**Ekran planı:**

- **Üst:** Stats kartları (Toplam post, Türe göre sayılar, Boosted, Event'e bağlı).
- **Filtreler:** Type (FREE | TIPS | COMPARE | QUESTION | EXPERIENCE | UPDATE), userId (opsiyonel), eventId, category, search (title/body), Sıralama (createdAt | likesCount | commentsCount | viewsCount | title), Sıra (asc | desc).
- **Tablo:** id, title, type, user (displayName/userName), createdAt, likesCount, commentsCount, isBoosted, eventId; son sütunda "Detay" → `/content/posts/:id`.
- **Aksiyon:** "Post detay" (create post admin'de ilk aşamada opsiyonel).

**Güncelleme:** Mevcut "Coming Soon" placeholder kaldırılacak; yukarıdaki yapı ve EP entegrasyonu eklenecek.

---

## 3. ContentPostDetail (`/content/posts/:id`) — Yeni sayfa

**Amaç:** Tek bir post'a ait tüm bilgi ve yönetim tek sayfada; özet, yorumlar preview, feed highlights, trending; düzenle/sil/highlight ekle.

**Kullanılacak EP'ler:**

- `GET /admin/content/posts/:id` → Post detayı (tüm alanlar + user + category/product/event + media, question, comparison, tip, tags).
- `PATCH /admin/content/posts/:id` → Post güncelleme.
- `DELETE /admin/content/posts/:id` → Post silme.
- `GET /admin/content/comments?postId=:id` → Bu post'un yorumları (preview).
- `GET /admin/content/feed-highlights?postId=:id` → Bu post için highlight'lar (veya Post Detail'da blok).
- `POST /admin/content/feed-highlights` → Bu post için highlight ekle (postId, reason).
- `GET /admin/content/trending?postId=:id` → Bu post trending'de mi (filtre ile kontrol).
- `POST /admin/content/trending` → Bu post'u trending'e ekle (postId, trendPeriod, score?).

**Layout:**

- **Üst:** "Listeye dön" (`/content/posts`), post başlığı, post id, type etiketi.
- **Bloklar:** Özet (post alanları, user link → `/users/:userId`, category/product/event özeti, media, tags, question/comparison/tip) | Yorumlar (preview veya GET comments?postId=) | Feed Highlights (bu post için liste + "Highlight ekle" butonu) | Trending (bu post var mı + "Trending'e ekle" butonu).
- **Aksiyonlar:** Düzenle (PATCH formu), Sil (onay + DELETE), "Feed'e öne çıkar" (FeedHighlight POST), "Trending'e ekle" (Trending POST).

---

## 4. ContentComments (`/content/comments`)

**Kullanılacak EP'ler:**

- `GET /admin/content/comments/stats` → Opsiyonel özet (total).
- `GET /admin/content/comments` → Liste; query: `limit`, `offset`, `postId`, `userId`, `parentIdNull`, `sort`, `order`.
- `GET /admin/content/comments/:id` → Tek yorum detayı.
- `PATCH /admin/content/comments/:id` → Yorum güncelle (comment metni).
- `DELETE /admin/content/comments/:id` → Yorum sil.

**Ekran planı:**

- **Üst:** Opsiyonel stats kartı.
- **Filtreler:** postId, userId, Sadece üst yorumlar (parentIdNull), Sıralama (createdAt | likesCount), Sıra.
- **Tablo:** id, postId (link → post detay), userId (link → user detay), comment (kısaltılmış), isAnswer, likesCount, createdAt; "Detay" → comment detay sayfası veya modal.
- **Detay:** `/content/comments/:id` sayfası veya modal: GET /admin/content/comments/:id, PATCH/DELETE aksiyonları.

**Güncelleme:** Mevcut "Coming Soon" placeholder kaldırılacak; liste + filtreler + tablo + detay/modal eklenecek.

---

## 5. TrendingPosts (`/content/trending`)

**Kullanılacak EP'ler:**

- `GET /admin/content/trending` → Liste; query: `limit`, `offset`, `trendPeriod` (DAILY | WEEKLY), `sort`, `order`.
- `POST /admin/content/trending` → Manuel ekle (postId, trendPeriod, score?).
- `PATCH /admin/content/trending/:id` → score veya trendPeriod güncelle.
- `DELETE /admin/content/trending/:id` → Trending'den kaldır.

**Ekran planı:**

- **Filtre:** trendPeriod (DAILY | WEEKLY).
- **Tablo:** postId, post title/user özeti, score, trendPeriod, calculatedAt; Düzenle / Kaldır.
- **Aksiyon:** "Trending'e ekle" butonu → form (postId, trendPeriod, score?).

**Güncelleme:** Mevcut "Coming Soon" placeholder kaldırılacak; liste + filtre + tablo + ekle/düzenle/kaldır eklenecek.

---

## 6. ModerationQueue (`/content/moderation`)

**Kaynak:** `GET /admin/content/moderation-actions` + `GET /admin/content/manual-review-flags`. İki liste veya tek "queue" görünümü (flag'ler öncelikli, sonra moderation history).

**Tablo (flags):** id, contentType, contentId, reason, status, flaggedByUser, createdAt; "İncele" → content detayına git (post veya comment), "Çöz" → PATCH /admin/content/manual-review-flags/:id (status = RESOLVED veya IN_REVIEW).

**Güncelleme:** Mevcut "Coming Soon" placeholder kaldırılacak; manual review flags listesi + moderation actions listesi (veya tek queue) + incele/çöz aksiyonları eklenecek.

---

## 7. ManualReviews (`/content/reviews`)

**Kullanılacak EP'ler:**

- `GET /admin/content/manual-review-flags` → Liste; query: `limit`, `offset`, `status`, `contentType`, `sort`, `order`.
- `GET /admin/content/manual-review-flags/:id` → Tek flag detayı.
- `PATCH /admin/content/manual-review-flags/:id` → status güncelle (OPEN | IN_REVIEW | RESOLVED).

**Tablo:** contentType, contentId, reason, status, flaggedByUserId, createdAt; "Detay" ve "Çözüldü işaretle" (PATCH status).

**Güncelleme:** Mevcut "Coming Soon" placeholder kaldırılacak; liste + filtre + tablo + detay + çöz aksiyonu eklenecek.

---

## 8. Feed Highlights (`/content/feed-highlights`)

**Seçenek A:** Ayrı route `/content/feed-highlights` — liste + POST/PATCH/DELETE.  
**Seçenek B:** Sadece Post Detail içinde "Bu post için highlight ekle/kaldır" ile yönetim.

**Öneri:** Hem liste hem post detaydan yönetilebilsin; `/content/feed-highlights` listesi, Post Detail'da da "Highlight ekle" butonu.

**Kullanılacak EP'ler:**

- `GET /admin/content/feed-highlights` → Liste; query: `limit`, `offset`, `postId`, `reason`, `sort`, `order`.
- `POST /admin/content/feed-highlights` → postId, reason (STAFF_PICK | MOST_LIKED | BOOSTED).
- `PATCH /admin/content/feed-highlights/:id` → reason güncelle.
- `DELETE /admin/content/feed-highlights/:id` → Highlight kaldır.

**Ekran planı (ayrı sayfa):** Tablo: id, postId, post title, reason, highlightedAt, createdAt; Ekle / Düzenle / Kaldır.

---

## 9. Tags & Categories (`/content/tags`)

**Tags:** `GET /admin/content/tags` ile popüler tag listesi; isteğe bağlı postId'ye göre filtre. Tag düzenleme post detayda (PATCH post tags — EP planında PATCH /admin/content/posts/:id/tags opsiyonel).

**Categories:** Category/MainCategory/SubCategory yönetimi için mevcut products/catalog sayfalarına link veya burada basit liste (read-only) + "Katalogda düzenle" linki.

**Güncelleme:** Mevcut "Coming Soon" placeholder kaldırılacak; tag listesi (aggregate) + isteğe bağlı postId filtre + kategoriler için katalog linki eklenecek.

---

## 10. User Detail'da Content bağlantısı

**Users > User Detail** sayfasına "Postları" sekmesi veya kart: `GET /admin/users/:id/posts` ile listele; her satırda "Post detay" → `/content/posts/:id`.

**Kullanılacak EP:** `GET /admin/users/:id/posts` (query: limit, offset, type?, sort, order).

---

## 11. Route ve Sidebar Güncellemesi

**Route (App.tsx):**

- `/content/posts` → ContentPosts (mevcut).
- **`/content/posts/:id` → ContentPostDetail (yeni).**
- `/content/comments` → ContentComments (mevcut).
- `/content/trending` → TrendingPosts (mevcut).
- `/content/moderation` → ModerationQueue (mevcut).
- `/content/reviews` → ManualReviews (mevcut).
- `/content/tags` → TagsCategories (mevcut).
- **`/content/feed-highlights` → FeedHighlights (yeni, opsiyonel).** Veya sadece Post Detail'dan yönetim.

**Sidebar:** Mevcut Content altındaki linkler korunur; isteğe bağlı "Feed Highlights" eklenebilir.

---

## 12. API Client (admin-panel)

**Yeni veya güncellenecek modül:** `api/admin-content.ts` (veya mevcut api modülüne admin content fonksiyonları).

**Fonksiyonlar (backend EP'lere göre):**

- `fetchContentPostsStats()` → GET /admin/content/posts/stats
- `fetchContentPosts(params)` → GET /admin/content/posts
- `fetchContentPost(id)` → GET /admin/content/posts/:id
- `updateContentPost(id, body)` → PATCH /admin/content/posts/:id
- `deleteContentPost(id)` → DELETE /admin/content/posts/:id
- `fetchContentCommentsStats()` → GET /admin/content/comments/stats
- `fetchContentComments(params)` → GET /admin/content/comments
- `fetchContentComment(id)` → GET /admin/content/comments/:id
- `updateContentComment(id, body)` → PATCH /admin/content/comments/:id
- `deleteContentComment(id)` → DELETE /admin/content/comments/:id
- `fetchFeedHighlights(params)` → GET /admin/content/feed-highlights
- `createFeedHighlight(body)` → POST /admin/content/feed-highlights
- `updateFeedHighlight(id, body)` → PATCH /admin/content/feed-highlights/:id
- `deleteFeedHighlight(id)` → DELETE /admin/content/feed-highlights/:id
- `fetchTrending(params)` → GET /admin/content/trending
- `createTrending(body)` → POST /admin/content/trending
- `updateTrending(id, body)` → PATCH /admin/content/trending/:id
- `deleteTrending(id)` → DELETE /admin/content/trending/:id
- `fetchTopCommunityChoices(params)` → GET /admin/content/top-community-choices
- `createTopCommunityChoice(body)` → POST /admin/content/top-community-choices
- `updateTopCommunityChoice(id, body)` → PATCH /admin/content/top-community-choices/:id
- `deleteTopCommunityChoice(id)` → DELETE /admin/content/top-community-choices/:id
- `fetchManualReviewFlags(params)` → GET /admin/content/manual-review-flags
- `fetchManualReviewFlag(id)` → GET /admin/content/manual-review-flags/:id
- `updateManualReviewFlag(id, body)` → PATCH /admin/content/manual-review-flags/:id
- `fetchModerationActions(params)` → GET /admin/content/moderation-actions
- `fetchModerationAction(id)` → GET /admin/content/moderation-actions/:id
- `fetchContentTags(params)` → GET /admin/content/tags
- `fetchUserPosts(userId, params)` → GET /admin/users/:id/posts

**Tipler (admin-panel types):** ADMIN_CONTENT_ENDPOINTS.md'deki response tipleri ile uyumlu (AdminContentPostsStatsResponse, AdminContentPostListItem, AdminContentPostDetailResponse, AdminContentCommentListItem, AdminContentCommentDetailResponse, AdminFeedHighlightListItem, AdminTrendingPostListItem, AdminTopCommunityChoiceListItem, AdminManualReviewFlagListItem, AdminModerationActionListItem, AdminContentTagListItem; PaginationMeta).

---

## 13. Uygulama Sırası (Panel tarafı)

1. **Panel API + tipler:** admin-content API modülü ve ilgili type'lar (admin.ts veya ayrı admin-content types).
2. **ContentPosts:** Stats + liste + filtreler + "Detay" linki.
3. **ContentPostDetail:** Sayfa + özet blok + yorumlar preview + feed highlights + trending + PATCH/DELETE/highlight/trending ekle.
4. **ContentComments:** Liste + filtreler + tablo + detay/modal + PATCH/DELETE.
5. **TrendingPosts:** Liste + filtre + tablo + ekle/düzenle/kaldır.
6. **ModerationQueue:** Manual review flags + moderation actions listesi + incele/çöz.
7. **ManualReviews:** Liste + filtre + tablo + detay + çözüldü işaretle.
8. **FeedHighlights:** Liste sayfası (veya sadece Post Detail'dan) + ekle/düzenle/kaldır.
9. **TagsCategories:** Tag listesi + katalog linki.
10. **User Detail > Postları:** "Postları" sekmesi veya kart + GET /admin/users/:id/posts + post detay linki.

Bu plan, ADMIN_CONTENT_ENDPOINTS.md ile uyumludur; backend EP'ler hazır olduğunda panel bu yapıya göre implemente edilebilir.
