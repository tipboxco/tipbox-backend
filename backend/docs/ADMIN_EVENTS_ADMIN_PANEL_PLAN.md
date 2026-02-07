# Admin Panel — Events Ekran Planı

Bu doküman, [ADMIN_EVENTS_ENDPOINTS.md](ADMIN_EVENTS_ENDPOINTS.md) ve [ADMIN_EVENTS_EP_PLAN.md](ADMIN_EVENTS_EP_PLAN.md) dosyalarına göre admin panelde **Event** ekranlarının nasıl planlanacağını, nelerin ekleneceği/güncelleneceğini ve **Event–Badge ilişkisi yönetiminin** nasıl öne çıkarılacağını tanımlar.

**Ön koşul:** Backend’de `/admin/events/*` endpoint’leri (ADMIN_EVENTS_EP_PLAN fazlarına göre) tanımlı ve çalışır olmalı. Panel bu EP’lere göre tasarlanır.

---

## 1. Ekran Özeti

| Ekran | Route | Açıklama | Durum |
|-------|--------|----------|--------|
| **EventList** | `/events` | Event özet istatistikleri + filtreli event listesi | Güncellenecek (şu an placeholder) |
| **EventDetail** | `/events/:id` | Tek event detayı; sekmeler: Özet, Badge'ler, Katılımcılar, Analitik, Ödüller | **Yeni eklenecek** |
| **EventBadges** | `/events/badges` | Event seçici veya “Event detay > Badge'ler”e yönlendirme | Güncellenecek |
| **EventRewards** | `/events/rewards` | Event seçici veya EventDetail > Ödüller sekmesine link | Güncellenecek |
| **EventAnalytics** | `/events/analytics` | Event seçici veya EventDetail > Analitik sekmesine link | Güncellenecek |

**Öneri:** Event-Badge, Event-Ödül ve Event-Analitik ilişkisi **event bağlamında** görünsün. Bu yüzden ana yapı:

- **EventList** → Liste + “Detay” ile **EventDetail** (`/events/:id`) açılır.
- **EventDetail** → Sekmeler: **Özet** (event bilgisi + düzenleme + silme), **Badge'ler** (event–badge ilişkisi yönetimi), **Katılımcılar**, **Analitik**, **Ödüller**.
- **EventBadges / EventRewards / EventAnalytics** → “Event seç” (dropdown veya event listesi) ile bir event seçilir, ilgili içerik gösterilir; veya “Event detayda görüntüle” linki ile `/events/:id` ilgili sekmeye yönlendirilir.

---

## 2. EventList (`/events`)

**Kullanılacak EP’ler:**

- `GET /admin/events/stats` → Özet istatistikler (total, draft, published, closed).
- `GET /admin/events` → Liste; query: `limit`, `offset`, `status`, `feedType`, `search`, `sort`, `order`.

**Ekran planı:**

- **Üst:** Stats kartları (Toplam, Taslak, Yayında, Kapalı).
- **Filtreler:** Status (DRAFT | PUBLISHED | CLOSED), Feed type (PICKS | ROASTS), Arama (title/description), Sıralama (createdAt | startDate | endDate | title), Sıra (asc | desc).
- **Tablo:** Event ID, Başlık, Durum, Feed type, Başlangıç, Bitiş, Katılımcı sayısı (varsa), Oluşturulma; son sütunda “Detay” → `/events/:id`.
- **Aksiyon:** “Yeni event” butonu → `/events/new` veya modal (POST /admin/events).

**Güncelleme:** Mevcut placeholder kaldırılacak; yukarıdaki yapı ve EP entegrasyonu eklenecek.

---

## 3. EventDetail (`/events/:id`) — **Yeni sayfa**

**Amaç:** Tek bir event’e ait tüm bilgi ve yönetim (özellikle **Event–Badge ilişkisi**) tek sayfada, sekmelerle toplansın.

**Kullanılacak EP’ler:**

- `GET /admin/events/:id` → Event detayı (tüm alanlar + product/brand/category özeti).
- `PATCH /admin/events/:id` → Event güncelleme.
- `DELETE /admin/events/:id` → Event silme.
- `GET /admin/events/:id/participants` → Katılımcı listesi.
- `GET /admin/events/:id/analytics` → Analitik özet.
- `GET /admin/events/:id/badges` → Event badge listesi.
- `POST /admin/events/:id/badges` → Event’e badge ekleme.
- `PATCH /admin/events/:id/badges/:eventBadgeId` → Event badge güncelleme.
- `DELETE /admin/events/:id/badges/:eventBadgeId` → Event’ten badge kaldırma.
- `GET /admin/events/:id/rewards` → Event ödül listesi.

**Layout:**

- **Üst:** Sol üst “Listeye dön” (`/events`), başlık (event title), event ID (görünür), durum etiketi.
- **Sekmeler:** Özet | Badge'ler | Katılımcılar | Analitik | Ödüller.

### 3.1 Sekme: Özet

- Event alanları: title, description, startDate, endDate, status, feedType, imageUrl, productId, brandId, mainCategoryId, subCategoryId, createdAt; product/brand/category özeti (varsa).
- **Event düzenle** formu: Aynı alanlar (PATCH body).
- **Event sil** butonu: Onay + DELETE.

### 3.2 Sekme: Badge'ler (Event–Badge ilişkisi — çok iyi olmalı)

**Hedef:** Bu event’e bağlı badge’lerin listesi, ekleme, düzenleme ve kaldırma net ve tek ekranda olsun.

**Üst bağlam:**

- “Bu event: [Event başlığı] (ID: …)” — ilişki her zaman anlaşılır olsun.
- “Event’e badge ekle” butonu → form açar.

**Tablo (GET /admin/events/:id/badges response’una göre):**

| Sütun | Açıklama | Kaynak |
|--------|----------|--------|
| EventBadge ID | EventBadge.id | response |
| Badge ID | EventBadge.badgeId / Badge bilgisi | response |
| Badge | Görsel + ad (Badge name, imageUrl) | Badge join |
| Rank | Sıra (EventBadge.rank) | response |
| Display order | EventBadge.displayOrder | response |
| Enabled | EventBadge.enabled (Evet/Hayır) | response |
| Oluşturulma | EventBadge.createdAt | response |
| İşlemler | Düzenle, Kaldır | — |

**Badge ekle (POST /admin/events/:id/badges):**

- Form: Badge seçimi (dropdown — tüm badge’lerden veya badgeId UUID), Rank (number), Display order (opsiyonel).
- Gönder → liste yenilir.

**Badge düzenle (PATCH /admin/events/:id/badges/:eventBadgeId):**

- Modal veya inline: Rank, Display order, Enabled (checkbox).
- Gönder → liste yenilir.

**Badge kaldır (DELETE /admin/events/:id/badges/:eventBadgeId):**

- Onay: “Bu badge event’ten kaldırılacak.”
- Sil → liste yenilir.

**Görsel/UX:**

- Badge görseli (imageUrl) tabloda küçük thumbnail.
- Rank sırasına göre sıralama (örn. rank asc).
- Boş durum: “Bu event’e henüz badge eklenmemiş. ‘Event’e badge ekle’ ile ekleyin.”

### 3.3 Sekme: Katılımcılar

- `GET /admin/events/:id/participants` → Tablo: userId, eventId, totalParticipated, totalComments, helpfulVotesReceived, eventPostsCount, eventLikesReceived, createdAt; isteğe bağlı user email/displayName.
- Sayfalama (pagination).
- “Kullanıcıya git” linki → `/users/:userId`.

### 3.4 Sekme: Analitik

- `GET /admin/events/:id/analytics` → Özet kartlar: participantCount, totalPosts, totalRewardsGranted, badgesCount.
- İsteğe bağlı: leaderboard top N (EP’de varsa).

### 3.5 Sekme: Ödüller

- `GET /admin/events/:id/rewards` → Tablo: id, userId, eventId, rewardType, rewardId, amount, awardedAt, createdAt; isteğe bağlı user email/displayName.
- Sayfalama.
- “Kullanıcıya git” linki → `/users/:userId`.

---

## 4. EventBadges (`/events/badges`)

**Seçenek A (önerilen):** Event-Badge yönetimi **EventDetail > Badge'ler** sekmesinde yapılsın. Bu sayfa:

- “Event seçin” dropdown veya event listesi (GET /admin/events kısaltılmış) gösterir; seçilince `/events/:id` sayfasına yönlendirilir (hash veya query: `?tab=badges`).
- Veya doğrudan: “Event badge yönetimi için önce bir event seçin” + EventList’e link.

**Seçenek B:** EventBadges sayfası event seçimi + aynı badge tablosu/ekleme/düzenleme/silme mantığını kendi içinde barındırır (EP çağrıları aynı, sadece sayfa bağımsız).

**Öneri:** Seçenek A; tek kaynak EventDetail > Badge'ler, böylece Event–Badge ilişkisi her zaman event bağlamında kalır.

---

## 5. EventRewards ve EventAnalytics

- **EventRewards:** “Event seç” ile bir event seçilir → aynı EP’ler (`GET /admin/events/:id/rewards`) kullanılır; içerik EventDetail > Ödüller ile aynı olabilir. Veya “Event detayda görüntüle” linki ile `/events/:id` ve “Ödüller” sekmesi açılır.
- **EventAnalytics:** Aynı mantık; “Event seç” veya `/events/:id` > Analitik sekmesi.

Böylece hem event merkezli (EventDetail) hem de menüden doğrudan “Event Rewards / Event Analytics” girişi korunur.

---

## 6. Route ve Sidebar Güncellemesi

**Route (App.tsx):**

- `GET /events` → EventList (mevcut).
- **`GET /events/:id` → EventDetail (yeni).** (`/events/new` için ayrı route veya EventDetail’da `id === 'new'` ile create modu.)
- `GET /events/badges` → EventBadges (event seçici veya yönlendirme).
- `GET /events/rewards` → EventRewards (event seçici veya yönlendirme).
- `GET /events/analytics` → EventAnalytics (event seçici veya yönlendirme).

**Sidebar:** Mevcut yapı korunabilir; “Event List” yanına isteğe bağlı “Event Detail” açıklaması eklenebilir (detay zaten listeden “Detay” ile açılır).

---

## 7. API Client (admin-panel)

**Yeni veya güncellenecek modül:** `admin-events.ts` (veya `api/events.ts` admin prefix ile).

**Fonksiyonlar (backend EP’lere göre):**

- `fetchEventsStats()` → GET /admin/events/stats
- `fetchEvents(params)` → GET /admin/events
- `fetchEvent(id)` → GET /admin/events/:id
- `createEvent(body)` → POST /admin/events
- `updateEvent(id, body)` → PATCH /admin/events/:id
- `deleteEvent(id)` → DELETE /admin/events/:id
- `fetchEventParticipants(id, params)` → GET /admin/events/:id/participants
- `fetchEventAnalytics(id)` → GET /admin/events/:id/analytics
- `fetchEventBadges(id, params)` → GET /admin/events/:id/badges
- `addEventBadge(id, body)` → POST /admin/events/:id/badges
- `updateEventBadge(id, eventBadgeId, body)` → PATCH /admin/events/:id/badges/:eventBadgeId
- `removeEventBadge(id, eventBadgeId)` → DELETE /admin/events/:id/badges/:eventBadgeId
- `fetchEventRewards(id, params)` → GET /admin/events/:id/rewards

**Tipler (types/admin.ts veya types/events.ts):** AdminEventStatsResponse, AdminEventListItem, AdminEventDetailResponse, AdminEventParticipantListItem, AdminEventAnalyticsResponse, AdminEventBadgeListItem, AdminEventRewardListItem; PaginationMeta.

---

## 8. Uygulama Sırası (Panel tarafı)

1. **Backend:** ADMIN_EVENTS_EP_PLAN Faz 1–5 (admin event route’ları ve DTO’lar) tamamlanmalı.
2. **Panel API + tipler:** `admin-events.ts` ve ilgili type’lar; EP’ler hazır oldukça mock’lar kaldırılır.
3. **EventList:** Stats + liste + filtreler + “Detay” linki.
4. **EventDetail:** Sayfa + sekmeler (Özet, Badge'ler, Katılımcılar, Analitik, Ödüller); Özet sekmesi (detay + PATCH/DELETE).
5. **EventDetail > Badge'ler:** Tablo + ekleme formu + düzenleme + kaldırma (Event–Badge ilişkisi ön planda).
6. **EventDetail > Katılımcılar, Analitik, Ödüller:** İlgili EP’lerle doldurulur.
7. **EventBadges / EventRewards / EventAnalytics:** Event seçici veya “Event detayda aç” yönlendirmesi.

---

## 9. Event–Badge İlişkisi Özeti (Kontrol Listesi)

- [ ] Event başlığı ve event ID, Badge'ler sekmesinde her zaman görünür.
- [ ] Event badge listesi: EventBadge ID, Badge ID, Badge görseli + ad, Rank, Display order, Enabled, Oluşturulma.
- [ ] “Event’e badge ekle”: badgeId (veya seçim), rank, displayOrder; POST sonrası liste yenilenir.
- [ ] “Düzenle”: rank, displayOrder, enabled; PATCH sonrası liste yenilenir.
- [ ] “Kaldır”: onay + DELETE sonrası liste yenilenir.
- [ ] Boş durum mesajı ve tek tıkla “Badge ekle” erişimi.
- [ ] Rank/displayOrder’a göre sıralı liste; görsel thumbnails kullanımı.

Bu plan, ADMIN_EVENTS_ENDPOINTS.md ve ADMIN_EVENTS_EP_PLAN.md ile uyumludur; backend EP’ler hazır olduğunda panel bu yapıya göre implemente edilebilir.
