# Tipbox Seed Data Inventory

> TestFlight hazırlığı için seed verilerinin eksiksiz envanteri.
> **Gerçek pipeline:** `clear-and-seed.ts` → `seed.ts` (8000+ satır)
> Son güncelleme: 2026-03-05

---

## Pipeline Akışı

### Dış Pipeline: `scripts/clear-and-seed.ts` (6 Stage)

| Stage | Adım | Dosya / Modül | Açıklama |
|-------|------|---------------|----------|
| 1/6 | MinIO cleanup | `clear-minio-media.ts` | Tüm veya kısmi medya temizliği |
| 2/6 | DB cleanup | `clear-seed-data.ts` / `clear-user-content-data.ts` | TRUNCATE veya selective DB temizlik |
| 3/6 | Upload seed media | `scripts/fix-minio-structure.ts` | Seed görselleri MinIO'ya yükle |
| 4/6 | Upload badge images | `scripts/upload-all-badge-images.ts` | Badge görselleri MinIO'ya yükle |
| 5/6 | **Run seed.ts** | `prisma/seed.ts` | **ANA SEED DOSYASI** (aşağıdaki tüm veriler) |
| 6/6 | Feed distribution | `scripts/trigger-feed-distribution.ts` | Tüm postlar için BullMQ job'ları |

**Flagler:**
- `--all` / `-a`: Taxonomy dahil tüm verileri sil (varsayılan: taxonomy korunur)
- `SEED_FEATURED_ONLY=true` (varsayılan): Sadece öne çıkan 9 kullanıcıya post/inventory oluşturur

### İç Pipeline: `seed.ts` main() Adımları

```
 1. User Themes (Light, Dark, Auto)
 2. 34 Seed Users (SEED_USERS array)
2a. Admin user (admin@tipbox.co)
2b. UserAvatar step (tüm kullanıcılara avatar)
 3. Experience Taxonomy (Duration, Location, Purpose)
    ── Categories/Brands/Products → DEPRECATED (catalog-service)
 5. User Inventories (catalog ürünlerinden)
5b. AiExperienceSplit (statik split kayıtları)
 7. Posts (AI-generated, ~500 hedef)
7.5 Post Tags
 8. Social Features (Likes, Comments, Views, Shares, Favorites)
 8. Trust Relations
8b. Social & Preferences (Block, Mute, FeedPreferences)
8.5 Trending Posts
 9. Wallet Transactions
9b. Payment (SubscriptionPlan, PaymentMethod, UserSubscription, Invoice)
9c. TipsTokenTransfer
12. Events (11 event, event posts + comments)
14. Messaging (DMThread, DMMessage, DMRequest)
13. NFT & Marketplace (NFT, Attributes, Transactions, Listings)
10. Badges & System Tables (BadgeCategory, Badge, UserBadge)
    ── Badge Categories (Cosmetic, Event, Collection, Brand)
    ── Action Types (15 adet)
 5. Comparison Metrics (8 adet, Türkçe)
5b. Boost Options (3 adet)
    ── Julia Havk user + profile (ayrı oluşturma)
    ── Feed Distribution (queue jobs)
    ── Transaction Seeding (Wallet)
    ── Reward Claim Seeding
    ── Event & Marketplace Badges → DEPRECATED (skipped)
    ── Gamification Collections (3 koleksiyon)
    ── Brand Catalog (Survey, Posts, Rewards, News)
    ── Expert & Notification
    ── Priority User NFTs
    ── Brand Logo Update (logo.dev)
```

---

## 1. Kullanıcılar (Users & Profiles)

### 1.1 Sabit ID Kullanıcılar

| Rol | ID | Email | Display Name | Username |
|-----|-----|-------|-------------|----------|
| **Primary Test** | `480f5de9-b691-4d70-a6a8-2789226f4e07` | omer@tipbox.co | Ömer Faruk | omerfaruk |
| **Target User** | `10000000-0000-4000-a000-000000000018` | serkan@tipbox.co | Serkan | serkan |
| **Julia / Ozan** | `99999999-9999-4999-9999-999999999999` | ozan@tipbox.co | Ozan | ozan |
| **Community Coach** | `10000000-0000-4000-a000-000000000017` | ebru@tipbox.co | Ebru | ebru |
| **Admin** | `00000000-0000-4000-a000-000000000001` | admin@tipbox.co | Admin | admin |

### 1.2 SEED_USERS Array (34 Kullanıcı)

| # | ID | Ad | Email | Username | Uzmanlık | Ülke |
|---|-----|-----|-------|----------|----------|------|
| 1 | `480f5de9-...` | Ömer Faruk | omer@tipbox.co | omerfaruk | Tech Explorer | Turkey |
| 2 | `11111111-...` | Tuna | tuna@tipbox.co | tuna | Mobile Guru | Turkey |
| 3 | `22222222-...` | Mehmet | mehmet@tipbox.co | mehmet | Audio Expert | Turkey |
| 4 | `33333333-...` | İbrahim | ibrahim@tipbox.co | ibrahim | Skincare Specialist | Turkey |
| 5 | `44444444-...` | Burakcan | burakcan@tipbox.co | burakcan | Hardware Pro | Turkey |
| 6 | `55555555-...` | Mihraç | mihrac@tipbox.co | mihrac | Gaming Master | Turkey |
| 7 | `aaaaaaaa-...` | İrem | irem@tipbox.co | irem | Beauty Curator | Turkey |
| 8 | `bbbbbbbb-...` | Furkan | furkan@tipbox.co | furkan | Photo Expert | Turkey |
| 9 | `cccccccc-...` | Aycan | aycan@tipbox.co | aycan | Fragrance Connoisseur | Turkey |
| 10 | `99999999-...` | Ozan | ozan@tipbox.co | ozan | Smart Home Pro | Turkey |
| 11 | `...0001` | Elif | elif@tipbox.co | elif | Hair Care Expert | Turkey |
| 12 | `...0002` | Can | can@tipbox.co | can | Fitness Tech | Turkey |
| 13 | `...0003` | Zeynep | zeynep@tipbox.co | zeynep | Nail Artist | Turkey |
| 14 | `...0004` | Ahmet | ahmet@tipbox.co | ahmet | Grooming Guru | Turkey |
| 15 | `...0005` | Selin | selin@tipbox.co | selin | Wellness Expert | Turkey |
| 16 | `...0006` | Emre | emre@tipbox.co | emre | Digital Reader | Turkey |
| 17 | `...0007` | Deniz | deniz@tipbox.co | deniz | Audio Lover | Turkey |
| 18 | `...0008` | Barış | baris@tipbox.co | baris | Drone Expert | Turkey |
| 19 | `...0009` | Merve | merve@tipbox.co | merve | Wearable Tech | Turkey |
| 20 | `...0010` | Berkay | berkay@tipbox.co | berkay | Keyboard Master | Turkey |
| 21 | `...0011` | Aslı | asli@tipbox.co | asli | Hydration Expert | Turkey |
| 22 | `...0012` | Murat | murat@tipbox.co | murat | Display Expert | Turkey |
| 23 | `...0013` | Gizem | gizem@tipbox.co | gizem | Base Makeup Pro | Turkey |
| 24 | `...0014` | Onur | onur@tipbox.co | onur | Network Guru | Turkey |
| 25 | `...0015` | Burcu | burcu@tipbox.co | burcu | Lip Expert | Turkey |
| 26 | `...0016` | Tolga | tolga@tipbox.co | tolga | Charging Pro | Turkey |
| 27 | `...0017` | Ebru | ebru@tipbox.co | ebru | Eye Makeup Artist | Turkey |
| 28 | `...0018` | Serkan | serkan@tipbox.co | serkan | Storage Expert | Turkey |
| 29 | `...0019` | Ece | ece@tipbox.co | ece | Lash Expert | Turkey |
| 30 | `...0020` | Kaan | kaan@tipbox.co | kaan | Gaming Gear | Turkey |
| 31 | `...0021` | Derya | derya@tipbox.co | derya | Cleansing Expert | Turkey |
| 32 | `...0022` | Selim | selim@tipbox.co | selim | Streaming Pro | Turkey |
| 33 | `...0023` | Pelin | pelin@tipbox.co | pelin | Blush Master | Turkey |
| 34 | `...0024` | Cem | cem@tipbox.co | cem | Connectivity Pro | Turkey |

### 1.3 Julia Havk (Ayrı Oluşturma)

Julia Havk, `main()` sonunda **ayrıca** oluşturulur (SEED_USERS'daki Ozan ile aynı ID: `99999999...`):
- Email: julia.havk@tipbox.co
- Display Name: Julia Havk
- Username: juliahavk
- Country: **United States** (diğer herkes Turkey)
- **Sorun:** Ozan zaten SEED_USERS'da bu ID ile oluşturuluyor. Julia sadece `juliaUser` yoksa oluşturulur, bu yüzden Ozan kalıyor.
- Julia'nın ekstra postları **DEVRE DIŞI** (satır 7812-7814)

### 1.4 Öne Çıkan Kullanıcılar (FEATURED_USER_IDS)

`SEED_FEATURED_ONLY=true` (varsayılan) modunda sadece bunlara post + inventory verilir:

| # | Kullanıcı | ID |
|---|-----------|-----|
| 1 | Ömer Faruk | TEST_USER_ID |
| 2 | Tuna | TRUST_USER_IDS[0] |
| 3 | İbrahim | TRUST_USER_IDS[2] |
| 4 | Burakcan | TRUST_USER_IDS[3] |
| 5 | Mihraç | TRUST_USER_IDS[4] |
| 6 | İrem | TRUSTER_USER_IDS[0] |
| 7 | Furkan | TRUSTER_USER_IDS[1] |
| 8 | Aycan | TRUSTER_USER_IDS[2] |
| 9 | Ozan | JULIA_USER_ID |

### 1.5 Trust İlişkileri

| Truster (Güvenen) | Trusted (Güvenilen) |
|---|---|
| Ömer Faruk | Tuna, Mehmet, İbrahim, Burakcan, Mihraç |
| İrem | Ömer Faruk |
| Furkan | Ömer Faruk |
| Aycan | Ömer Faruk |
| + Dinamik trust ilişkileri (seedTrustRelations) | Tüm kullanıcılar arası |

### 1.6 Her Kullanıcı İçin Oluşturulan Veriler

| Veri | Açıklama |
|------|----------|
| User | Email, passwordHash, emailVerified=true, status=ACTIVE |
| Profile | displayName, userName, bio, country, bannerUrl |
| UserAvatar | MinIO'daki avatar görseli, isActive=true |
| UserTitle | Uzmanlık başlığı (title alanı) |
| UserSettings | defaultThemeId (Dark tema) |
| Wallet | CUSTOM provider, 1000.0 balance, isConnected=true |

**Tüm kullanıcılar için şifre: `password123`**

**Toplam: 34 seed user + 1 admin = 35 kullanıcı**

---

## 2. Taxonomy (Experience Verileri)

`seedTaxonomy()` tarafından oluşturulur (`taxonomy.seed.ts`).

### 2.1 Experience Duration (Kullanım Süresi)

| # | Name | Active |
|---|------|--------|
| 1 | Less than 1 month | true |
| 2 | 1-3 months | true |
| 3 | 3-6 months | true |
| 4 | 6-12 months | true |
| 5 | More than 1 year | true |
| 6 | 1 Year | true |

### 2.2 Experience Location (Kullanım Yeri)

| # | Name | Active | Not |
|---|------|--------|-----|
| 1 | Home | true | |
| 2 | Office | true | |
| 3 | Outdoor | true | |
| 4 | Other | true | |
| 5 | Excellent | true | ⚠️ Rating değeri, Location DEĞİL |
| 6 | Good | true | ⚠️ Rating değeri |
| 7 | Average | true | ⚠️ Rating değeri |
| 8 | Poor | true | ⚠️ Rating değeri |
| 9 | Very poor | true | ⚠️ Rating değeri |

### 2.3 Experience Purpose (Kullanım Amacı)

| # | Name | Active | Not |
|---|------|--------|-----|
| 1 | Personal use | true | |
| 2 | Professional use | true | |
| 3 | Gift | true | |
| 4 | Other | true | |
| 5 | Rarely Use | true | ⚠️ Frekans değeri, Purpose DEĞİL |
| 6 | Rarely | true | ⚠️ Frekans değeri |
| 7 | Daily | true | ⚠️ Frekans değeri |
| 8 | 1-2 times a week | true | ⚠️ Frekans değeri |
| 9 | 3-4 times a week | true | ⚠️ Frekans değeri |

---

## 3. Product Catalog (Ürün Hiyerarşisi)

**ÖNEMLİ:** Kategoriler, markalar ve ürünler **catalog-service** tarafından oluşturulur. seed.ts başında `product.count()` ve `category.count()` kontrolü yapılır; eğer 0 ise seed **durur** (graceful exit).

`seedProductCategories()`, `seedBrands()`, `seedProducts()` fonksiyonları seed.ts'te tanımlı ancak **DEPRECATED** ve `main()` içinde yorum bloğuna alınmış. Catalog-service çalıştıktan sonra seed.ts devreye girer.

### 3.1 DEPRECATED Kategori/Marka Yapısı (seed.ts'te tanımlı ama ÇAĞRILMIYOR)

Aşağıdaki veriler seed.ts'te tanımlı ancak `main()` fonksiyonunda çağrılmıyor:

- **Electronics:** 7 subcategory (Phones, Laptops, Tablets, Audio, Wearables, Accessories, Cameras), 27 product group
- **Beauty:** 7 subcategory (Skincare, Makeup, Fragrance, Haircare, Personal Care, Nail Care, Men's Grooming), 30 product group
- **Electronics Brands (8):** Apple, Samsung, Google, Sony, Bose, Logitech, Canon, DJI
- **Beauty Brands (13):** CeraVe, La Roche-Posay, The Ordinary, MAC, Maybelline, L'Oréal, NYX, Flormar, Chanel, Dior, Pantene, Dove, Nivea
- **~1000 ürün** (Foundation 120, Lipstick 100, Eyeshadow 80, vb.)

> Bu veriler `catalog-service` tarafından sağlandığı için seed.ts'ten kaldırılmıştır.

---

## 4. İçerik (Content Posts)

### 4.1 AI-Generated Postlar (`seedPosts()`)

- **Hedef:** 500 post (`TARGET_TOTAL_POSTS = 500`)
- **Kullanıcılar:** `SEED_FEATURED_ONLY=true` ise 9 öne çıkan kullanıcı, `false` ise 30 kullanıcı
- **Ürün kaynağı:** Catalog-service'den gelen popüler markalar/kategoriler (ilk 500 ürün)
- **Post tipleri:** QUESTION, TIPS, FREE, EXPERIENCE, COMPARE, UPDATE
- **İçerik üretimi:** Gemini AI (batch processing, 4 post/batch, 1s delay arası)
- **Fallback:** AI başarısız olursa Türkçe statik metin kullanılır
- **Tarih aralığı:** Son 90 gün içinde rastgele
- **Öne çıkan kullanıcılar:** Her tipten 2-4 post
- **Diğer kullanıcılar:** Her tipten 1-2 post
- **Murat ve Nil:** Post oluşturma atlanır (boş profil)

### 4.2 Post İlişkili Veriler

| Veri Türü | Açıklama | Kaynak |
|-----------|----------|--------|
| PostQuestion | QUESTION postları için format (SHORT/LONG/POLL/CHOICE) | seedPosts() |
| PostTip | TIPS postları için kategori (CARE/USAGE/REVIEW/OTHER) | seedPosts() |
| PostComparison | COMPARE postları için iki ürün karşılaştırması | seedPosts() |
| PostComparisonScore | Karşılaştırma metrikleri (Türkçe: Fiyat, Kalite vb.) | seedPosts() |
| PostMedia | %10 post-images, %27 seed-media görseli | seedPosts() |
| ContentPostTag | Her posta AI-generated veya rastgele taglar | seedPostTags() |

### 4.3 Event Postları

Her aktif event için 5-8 FREE tipli ContentPost oluşturulur (detaylar bölüm 7'de).

---

## 5. Envanter ve Deneyimler (Inventory)

### 5.1 User Inventories (`seedUserInventories()`)

- Öne çıkan kullanıcılara catalog-service'deki ürünlerden 3-8 envanter oluşturulur
- Her envanter: `hasOwned=true`, InventoryMedia eklenir
- `SEED_FEATURED_ONLY=true` ise sadece 9 öne çıkan kullanıcıya

### 5.2 AiExperienceSplit

- Owned inventory'ler için statik split kayıtları
- Gemini çağrılmaz, sabit veriler

---

## 6. Sosyal Özellikler

### 6.1 Social Features (`seedSocialFeatures()`)

| Veri | Açıklama |
|------|----------|
| ContentLike | Postlara rastgele like'lar |
| ContentComment | Postlara rastgele yorumlar |
| ContentPostView | Postlara rastgele görüntülenme |
| ContentFavorite | Postlara rastgele favori |
| Shares | Post paylaşım sayıları |

### 6.2 Trust Relations (`seedTrustRelations()`)

- Ömer → 5 Trust User (Tuna, Mehmet, İbrahim, Burakcan, Mihraç)
- 3 Truster User → Ömer (İrem, Furkan, Aycan)
- + Dinamik ek trust ilişkileri

### 6.3 Social & Preferences (`seedSocialAndPreferences()`)

| Veri | Adet | Açıklama |
|------|------|----------|
| UserBlock | 2-5 | Kullanıcı engelleme çiftleri |
| UserMute | 2-5 | Kullanıcı sessize alma çiftleri |
| UserFeedPreferences | 3-5 | Electronics/Beauty kategorileri, TR dili |

### 6.4 Trending Posts (`seedTrendingPosts()`)

- En çok etkileşim alan postlar trending olarak işaretlenir
- Score ve period (DAILY) atanır

---

## 7. Etkinlikler (Events)

### 7.1 Event Konfigürasyonu (`seedEvents()`)

**7 Aktif Event:**

| # | Başlık | Kategori | Süre |
|---|--------|----------|------|
| 1 | Laptop ile Uzaktan Çalışma Deneyimi | Electronics | -10g → +20g |
| 2 | Kablosuz Kulaklık Ses Kalitesi Testi | Electronics | -15g → +15g |
| 3 | Akıllı Saat Spor Takibi Karşılaştırması | Electronics | -8g → +22g |
| 4 | Tablet Kullanım Senaryoları | Electronics | -7g → +23g |
| 5 | Günlük Cilt Bakım Rutini Paylaşımı | Beauty | -14g → +16g |
| 6 | Yağlı Ciltler İçin En İyi Ürünler | Beauty | -11g → +19g |
| 7 | Kalıcı Makyaj Ürünleri Testi | Beauty | -9g → +21g |

**4 Yaklaşan Event:**

| # | Başlık | Kategori | Süre |
|---|--------|----------|------|
| 8 | Oyun Performansı: Hangi Cihaz Daha İyi? | Electronics | +5g → +35g |
| 9 | Kamera Performansı: Gece Çekimleri | Electronics | +8g → +38g |
| 10 | Güneşten Korunma: En Etkili SPF Ürünleri | Beauty | +7g → +37g |
| 11 | Saç Bakım Rutini: Kuru ve Yıpranmış Saçlar | Beauty | +10g → +40g |

> Not: Event başlıkları ve açıklamaları **Türkçe**.

### 7.2 Event Posts & Comments

- Her aktif event için 5-8 FREE tipli ContentPost (toplam ~35-56 post)
- Her event post için 0-3 yorum (Türkçe, Electronics/Beauty kategorisine göre template)
- EventStats: Her katılımcı için totalParticipated, totalComments, helpfulVotesReceived
- Event görselleri: `tests/assets/events/` dizininden MinIO'ya yüklenir

---

## 8. Mesajlaşma (Messaging)

### 8.1 DM Threads (`seedMessaging()`)

- **30-50 normal DM thread** (rastgele kullanıcı çiftleri)
- %80 active, %20 inactive
- Her thread için 3-15 mesaj
- Mesajlar: Türkçe conversation template'leri (starter → response → follow-ups)
- %70 mesaj okunmuş, %30 okunmamış

### 8.2 Support Requests

- **10-20 support request** (rastgele kullanıcılar arası)
- Status dağılımı: PENDING, ACCEPTED, AWAITING_COMPLETION, COMPLETED, DECLINED, CANCELED
- ACCEPTED+ status'ler için support thread oluşturulur + 4 mesaj
- Type: GENERAL, TECHNICAL, PRODUCT (rastgele)
- COMPLETED olanlar için rating (3-5)

### 8.3 Tahmini Mesaj Sayıları

| Veri | Tahmini Adet |
|------|-------------|
| Normal DM Thread | 30-50 |
| Support Thread | 5-10 |
| DM Messages | 200-500 |
| Support Messages | 20-40 |
| DM Requests | 10-20 |

---

## 9. NFT & Marketplace

### 9.1 NFT'ler (`seedNFTMarketplace()`)

- Her kullanıcı (40) için 2-5 NFT = **80-200 NFT**
- Tipler: BADGE, COSMETIC, LOOTBOX
- Rarity: COMMON, RARE, EPIC
- Her NFT için MINT transaction + 3-5 attribute
- %20 NFT transfer/purchase işlemi
- %80 transferable

### 9.2 Market Listings

- **20-30 aktif listing**
- Fiyat: COMMON=100+, RARE=300+, EPIC=800+ (+ random)
- Status: %70 ACTIVE, %15 SOLD, %15 CANCELLED

### 9.3 Priority User NFTs

- `seedPriorityUserNFTs()` ile öne çıkan kullanıcılara ek NFT'ler

---

## 10. Badges & Gamification

### 10.1 Badge Categories

| # | Kategori | Açıklama |
|---|----------|----------|
| 1 | Achievement Badges | Başarı rozetleri |
| 2 | Event Badges | Etkinlik rozetleri |
| 3 | Community Badges | Topluluk rozetleri |
| 4 | Special Badges | Özel rozetler |
| + | Cosmetic, Event, Collection, Brand | `ensureBadgeCategory` ile oluşturulan ek kategoriler |

### 10.2 Badges (32 adet)

| Tip | Badge'ler | Rarity |
|-----|-----------|--------|
| COLLECTION | Early Adapter, Hardware Expert, Tech Enthusiast, Smart Buyer, Gadget Master, Product Expert, Review Pro, Content Creator, Community Star, Crimson Roast, Golden Pick, Web3 Architect, Deal Maven, Ladder Vanguard, Top Picks, Product Roast, Ladder Ranker, Genesis Member, Critical Review | COMMON-EPIC |
| COSMETIC | Beauty Guru, Style Curator, Trend Spotter, Trendsetter, Outdoor Explorer | COMMON-RARE |
| BRAND | Brand Badge 1-6 | RARE-EPIC |

### 10.3 User Badges

- Her kullanıcı 2-5 rastgele badge alır
- Visibility: PUBLIC, FRIENDS, TRUSTERS, PRIVATE
- %70 claimed, %80 visible

### 10.4 Gamification Collections (`seedGamificationCollections()`)

| # | Koleksiyon | Badge Sayısı |
|---|-----------|-------------|
| 1 | Content Creator Pro | 3 (First Post, Prolific Writer, Content Master) |
| 2 | Community Champion | 2 (Social Butterfly, Helpful Hero) |
| 3 | Brand Ambassador | 1 (Brand Partner) |

### 10.5 Action Types (15 adet)

POST (EXPERIENCE, TIPS, REVIEW, GENERAL), LIKE, COMMENT, BOOKMARK, JOIN (ALL, BRAND), SYSTEM (PROFILE_COMPLETE, BIO_ADD, INVENTORY_ADD, PROFILE_PHOTO, TRUST, UPVOTE)

---

## 11. Finansal Veriler

### 11.1 Wallet Transactions (`seedTransactions()`)

- `seed/transaction-seed.ts` modülünden
- Her kullanıcıya wallet + transaction'lar
- Type ve status çeşitliliği

### 11.2 Payment (`seedPayment()`)

| Veri | Detay |
|------|-------|
| SubscriptionPlan | 2 plan: Monthly ($99.99), Yearly ($999.99) |
| PaymentMethod | Test VISA kartı (last4=4242, exp 12/2030) |
| UserSubscription | Ömer için aktif abonelik |
| Invoice | 3 fatura (son 2 ay + güncel), hepsi PAID |

### 11.3 TipsTokenTransfer (`seedTipsTransfers()`)

- 5-12 transfer (kullanıcı çiftleri arası)
- Tutar: 5-50 + ondalık
- 4 predefined reason template

### 11.4 Reward Claims (`seedRewardClaims()`)

- `seed/reward-claim-seed.ts` modülünden
- Kullanıcılar için reward claim kayıtları

---

## 12. Sistem Verileri

### 12.1 User Themes

| # | Tema | Açıklama |
|---|------|----------|
| 1 | Light | Açık tema - günün her saati için ideal |
| 2 | Dark | Koyu tema - gözleri yormaz, modern görünüm |
| 3 | Auto | Otomatik - sistem temasını takip eder |

> Not: Tema açıklamaları **Türkçe**.

### 12.2 Comparison Metrics (8 adet)

| # | Metric Adı | Açıklama |
|---|-----------|----------|
| 1 | Fiyat | Ürünün fiyat performansı (1-10) |
| 2 | Kalite | Ürünün genel kalitesi (1-10) |
| 3 | Kullanım Kolaylığı | Ürünün ne kadar kolay kullanıldığı (1-10) |
| 4 | Dayanıklılık | Ürünün ne kadar uzun süre dayandığı (1-10) |
| 5 | Tasarım | Ürünün görsel tasarımı ve estetik (1-10) |
| 6 | Müşteri Hizmetleri | Markanın müşteri hizmetleri kalitesi (1-10) |
| 7 | Özellikler | Ürünün sahip olduğu özellikler (1-10) |
| 8 | Çevre Dostu | Ürünün çevreye olan etkisi (1-10) |

> ⚠️ Tüm metric adları ve açıklamaları **Türkçe**.

### 12.3 Boost Options (3 adet)

| # | Başlık | Tutar (TIPS) | Popular |
|---|--------|-------------|---------|
| 1 | Standard Boost | 0 | Hayır |
| 2 | Popular Boost | 10 | Evet |
| 3 | Premium Boost | 25 | Evet |

### 12.4 Marketplace Banners

- `seedRemainingSystemTables()` ve `system.seed.ts` step'inden 3 banner
- Görseller: Seed media map'ten

---

## 13. Brand Catalog (`seedBrandCatalog()`)

| Veri | Adet | Açıklama |
|------|------|----------|
| BridgeFollower | 5-15 / brand | Top 5 brand için takipçiler |
| BrandSurvey | 2 / brand | Product Satisfaction, Feature Preferences |
| BrandSurveyQuestion | 3 / survey | Anket soruları |
| BrandSurveyAnswer | 3-5 / question | Kullanıcı cevapları |
| BridgePost | 5-10 / brand | Brand-focused engagement posts |
| BridgeReward | 5-10 / brand | Rastgele badge ödülleri |
| News | 3 / brand | Product Launch, Promotion, Innovation |

---

## 14. Ek Step'ler

### 14.1 Expert (`seedExpert()`)

- 5-10 ExpertRequest (Electronics/Beauty kategorileri)
- Statüs: 1/3 PENDING, 2/3 ANSWERED
- Her ANSWERED request için 1 ExpertAnswer
- Tips tutarı: 100-500

### 14.2 Notification (`seedNotification()`)

- 5-10 Notification (8 farklı tip)
- Notification tipleri: POST_LIKED, POST_COMMENTED, NEW_TRUSTER, NEW_MESSAGE, TIPS_RECEIVED, EVENT_STARTED, NEW_BADGE, SYSTEM_ANNOUNCEMENT
- **İçerikler Türkçe** (title ve message)
- 1 PushToken (iOS, ilk kullanıcı)

### 14.3 Auth Edge (`seedUsersAndProfiles()` → identity.seed.ts)

- EmailVerificationCode: 6-digit, 30-dk expiry
- PasswordResetToken: 24-byte hex, 1-saat expiry
- LoginAttempt: Mix SUCCESS/FAILED
- UserKycRecord: SUMSUB provider, ~5 kayıt

### 14.4 Brand Logo Update

- `updateBrandLogosFromLogoDev()`: Marka logolarını `img.logo.dev` API'sinden günceller
- `brandToWebsite` mapping kullanılır

---

## 15. MinIO Media Dosyaları

### 15.1 Yüklenen Görseller

| Stage | MinIO Path | Açıklama |
|-------|-----------|----------|
| Stage 3 | `users/*/avatar.*` | Kullanıcı avatarları |
| Stage 3 | `seed-media/*` | Seed media görselleri (ürün, badge, banner) |
| Stage 4 | `badges/*` | Badge görselleri |
| seed.ts | `avatars/default-useravatar.png` | Varsayılan avatar |
| seed.ts | `avatars/avatar-1.png ... avatar-12.png` | Setup profil avatarları |
| seed.ts | `users/{JULIA_ID}/avatar.jpg` | Julia/Ozan avatar |
| seed.ts | `users/{JULIA_ID}/banner.png` | Julia/Ozan banner |
| seed.ts | `events/*.png` | Event görselleri |
| seed.ts | `post-images/*` | Post görselleri |

---

## 16. Özet: Toplam Veri Miktarları

| Model | Tahmini Adet | Kaynak |
|-------|-------------|--------|
| **User** | 35 (34 seed + 1 admin) | seed.ts |
| **Profile** | 35 | seed.ts |
| **UserAvatar** | 35+ | seed.ts + user-avatar.seed.ts |
| **UserTitle** | 34 (her seed user'a 1) | seed.ts |
| **UserSettings** | 34 | seed.ts |
| **Wallet** | 34 | identity.seed.ts |
| **UserTheme** | 3 | seed.ts |
| **TrustRelation** | 8+ (sabit) + dinamik | seed.ts |
| **UserBlock** | 2-5 | social-and-preferences.seed.ts |
| **UserMute** | 2-5 | social-and-preferences.seed.ts |
| **UserFeedPreferences** | 3-5 | social-and-preferences.seed.ts |
| **ExperienceDuration** | 6 | taxonomy.seed.ts |
| **ExperienceLocation** | 9 | taxonomy.seed.ts |
| **ExperiencePurpose** | 9 | taxonomy.seed.ts |
| **Product / Category / Brand** | catalog-service'den | ❌ seed.ts OLUŞTURMUYOR |
| **Inventory** | 27-72 (9 featured × 3-8) | seed.ts |
| **ContentPost** | ~500 (hedef) + 35-56 event posts | seed.ts |
| **ContentPostTag** | ~500+ | seedPostTags() |
| **ContentComment** | Dinamik | seedSocialFeatures() + seedEvents() |
| **ContentLike** | Dinamik | seedSocialFeatures() |
| **ContentFavorite** | Dinamik | seedSocialFeatures() |
| **ContentPostView** | Dinamik | seedSocialFeatures() |
| **PostQuestion** | ~80 (QUESTION postları) | seedPosts() |
| **PostTip** | ~80 (TIPS postları) | seedPosts() |
| **PostComparison** | ~80 (COMPARE postları) | seedPosts() |
| **PostComparisonScore** | ~160 (comparison × 2) | seedPosts() |
| **PostMedia** | ~185 (~37% post) | seedPosts() |
| **TrendingPost** | Dinamik | seedTrendingPosts() |
| **Event** | 11 (7 active + 4 upcoming) | seedEvents() |
| **EventStats** | ~50-80 | seedEvents() |
| **DMThread (Normal)** | 30-50 | seedMessaging() |
| **DMThread (Support)** | 5-10 | seedMessaging() |
| **DMMessage** | 200-500+ | seedMessaging() |
| **DMRequest** | 10-20 | seedMessaging() |
| **NFT** | 80-200 | seedNFTMarketplace() |
| **NFTAttribute** | 240-1000 | seedNFTMarketplace() |
| **NFTTransaction** | 100-250 | seedNFTMarketplace() |
| **NFTMarketListing** | 20-30 | seedNFTMarketplace() |
| **BadgeCategory** | 4-8 | seedRemainingSystemTables() |
| **Badge** | 32+ | seedRemainingSystemTables() |
| **UserBadge** | 70-200 | seedRemainingSystemTables() |
| **BadgeCollection** | 3 | gamification-collections.seed.ts |
| **AchievementGoal** | 5+ | gamification-collections.seed.ts |
| **ActionType** | 15 | seed.ts |
| **ComparisonMetric** | 8 | seed.ts |
| **BoostOption** | 3 | seed.ts |
| **SubscriptionPlan** | 2 | payment.seed.ts |
| **PaymentMethod** | 1 | payment.seed.ts |
| **UserSubscription** | 1 | payment.seed.ts |
| **Invoice** | 3 | payment.seed.ts |
| **TipsTokenTransfer** | 5-12 | tips-transfer.seed.ts |
| **BridgeFollower** | 25-75 | brand-catalog.seed.ts |
| **BrandSurvey** | ~10 | brand-catalog.seed.ts |
| **BridgePost** | 25-50 | brand-catalog.seed.ts |
| **News** | ~15 | brand-catalog.seed.ts |
| **ExpertRequest** | 5-10 | expert.seed.ts |
| **Notification** | 5-10 | notification.seed.ts |
| **MarketplaceBanner** | 3 | system.seed.ts |
| **Feed** | Distribution worker tarafından | trigger-feed-distribution.ts |

---

## 17. Giriş Bilgileri (TestFlight)

| Kullanıcı | Email | Şifre |
|-----------|-------|-------|
| Ömer Faruk (Primary) | omer@tipbox.co | password123 |
| Tuna | tuna@tipbox.co | password123 |
| Mehmet | mehmet@tipbox.co | password123 |
| İbrahim | ibrahim@tipbox.co | password123 |
| Burakcan | burakcan@tipbox.co | password123 |
| Mihraç | mihrac@tipbox.co | password123 |
| İrem | irem@tipbox.co | password123 |
| Furkan | furkan@tipbox.co | password123 |
| Aycan | aycan@tipbox.co | password123 |
| Ozan | ozan@tipbox.co | password123 |
| Serkan (Target) | serkan@tipbox.co | password123 |
| Ebru (Coach) | ebru@tipbox.co | password123 |
| Admin | admin@tipbox.co | password123 |
| ... (diğer 22 kullanıcı) | {isim}@tipbox.co | password123 |

**Tüm kullanıcılar için şifre: `password123`**

---

## 18. TestFlight Cleanup - Gereksiz / Sorunlu Veriler

> **DİKKAT:** Bu analiz **gerçek pipeline** olan `clear-and-seed.ts` → `seed.ts` akışına göre yapılmıştır.

---

### KIRMIZI - Kaldırılmalı

#### 1. Taxonomy'deki yanlış yerleştirilmiş değerler
- **ExperienceLocation** içinde rating değerleri: `Excellent`, `Good`, `Average`, `Poor`, `Very poor`
- **ExperiencePurpose** içinde frekans değerleri: `Rarely Use`, `Rarely`, `Daily`, `1-2 times a week`, `3-4 times a week`
- **Dosya:** `prisma/seed/taxonomy.seed.ts`
- **Aksiyon:** Ayrı tablo/model'e taşı veya kaldır

#### 2. Comparison Metric'leri Türkçe
- `Fiyat`, `Kalite`, `Kullanım Kolaylığı`, `Dayanıklılık`, `Tasarım`, `Müşteri Hizmetleri`, `Özellikler`, `Çevre Dostu`
- **Dosya:** `seed.ts:7091-7100`
- **Aksiyon:** İngilizce'ye çevir

#### 3. Julia Havk / Ozan ID çakışması
- `99999999-9999-4999-9999-999999999999` hem SEED_USERS'da Ozan, hem de ayrıca Julia Havk olarak oluşturulmaya çalışılıyor
- Julia postları zaten DEVRE DIŞI ama user oluşturma bloğu aktif
- **Dosya:** `seed.ts:7705-7814`
- **Aksiyon:** Julia bloğunu tamamen kaldır veya ayrı ID ver

#### 4. `prisma/seed/index.ts` ve ilişkili eski pipeline (ÖLÜ KOD)
- `clear-and-seed.ts` bu dosyayı hiç çağırmıyor
- Ölü dosyalar: `seed/index.ts`, `seed/content.seed.ts`, `seed/feed.seed.ts`, `seed/marketplace.seed.ts`, `seed/explore.seed.ts`, `seed/messaging.seed.ts`, `seed/brand-products.seed.ts`, `seed/news-banner.seed.ts`, `seed/user.seed.ts`, `seed/dmthread.seed.ts`, `seed/dmrequest.seed.ts`
- **Aksiyon:** Arşivle veya sil (hala kullanılan `taxonomy.seed.ts`, `helpers/`, `steps/`, `types.ts` korunmalı)

---

### TURUNCU - Düzeltilmeli

#### 5. Tema açıklamaları Türkçe
- "Açık tema - günün her saati için ideal", "Koyu tema - gözleri yormaz"
- **Aksiyon:** İngilizce'ye çevir

#### 6. Event içerikleri Türkçe
- 11 event başlığı, açıklaması, post template'leri ve comment template'leri Türkçe
- **Aksiyon:** İngilizce'ye çevir

#### 7. Notification içerikleri Türkçe
- Notification title ve message'ları Türkçe
- **Aksiyon:** İngilizce'ye çevir

#### 8. Deprecated kod blokları (seed.ts'te ~2000 satır)
- `seedProductCategories()`, `seedBrands()`, `seedProducts()` → DEPRECATED ama hala tanımlı
- Bridge achievement chain → ~200 satır yorum bloğu
- `ensureEventBadgeSystem()`, `ensureMarketplaceBadges()` → DEPRECATED (skipped)
- **Aksiyon:** Deprecated kod bloklarını temizle

#### 9. catalog-service bağımlılığı
- seed.ts `product.count()` ve `category.count()` kontrolü yapıyor; 0 ise duruyor
- TestFlight ortamında catalog-service'in seed'den önce çalışmış olması gerekir
- **Aksiyon:** Bağımlılığı dökümante et, TestFlight setup'ına ekle

#### 10. Mesajlaşma template'leri Türkçe
- DM conversation starters, responses, follow-ups Türkçe
- Support request description'ları Türkçe
- **Aksiyon:** İngilizce'ye çevir

---

### SARI - İyileştirilebilir

#### 11. seed.ts dosya boyutu (8000+ satır)
- **Aksiyon:** Aktif fonksiyonları `seed/steps/` modülerine taşı

#### 12. Progress bar step sayısı yanlış
- `totalSteps = 32` hardcoded ama bazı step'ler atlanıyor
- **Aksiyon:** Dinamik hesapla

#### 13. Tüm kullanıcılar Turkey
- 34 seed user hepsi Turkey, çeşitlilik yok
- **Aksiyon:** Birkaç kullanıcıyı farklı ülkelere ata

---

### Özet: Öncelik Matrisi

| Öncelik | Madde | Efor | Etki |
|---------|-------|------|------|
| **P0** | Taxonomy yanlış değerler (rating/frequency) | 15 dk | UX bozukluğu |
| **P0** | Comparison Metric'leri İngilizce yap | 5 dk | Kullanıcı-görünür Türkçe |
| **P0** | Julia Havk / Ozan ID çakışması çöz | 10 dk | Veri tutarsızlığı |
| **P0** | Ölü seed/index.ts pipeline'ını temizle | 30 dk | Codebase karışıklığı |
| **P1** | Tema açıklamalarını İngilizce yap | 5 dk | Dil tutarsızlığı |
| **P1** | Event içeriklerini İngilizce yap | 30 dk | Türkçe event'ler |
| **P1** | Notification içeriklerini İngilizce yap | 10 dk | Türkçe notification'lar |
| **P1** | Deprecated kod bloklarını temizle | 1 saat | Bakım yükü |
| **P1** | catalog-service bağımlılığını dökümante et | 15 dk | Deployment riski |
| **P1** | Mesajlaşma template'lerini İngilizce yap | 20 dk | Türkçe mesajlar |
| **P2** | seed.ts modülerleştir | 2-3 saat | Bakım kolaylığı |
| **P2** | Progress bar step sayısını düzelt | 5 dk | Yanlış progress |
| **P2** | Ülke çeşitliliği ekle | 5 dk | Kozmetik |

---

## 19. Seed Çalıştırma

```bash
# Seed'i çalıştır (taxonomy korunur)
docker-compose exec backend npx ts-node --transpile-only scripts/clear-and-seed.ts

# Taxonomy dahil tüm verileri sil + seed
docker-compose exec backend npx ts-node --transpile-only scripts/clear-and-seed.ts --all

# Sadece feed distribution tetikle
docker-compose exec backend npx ts-node --transpile-only scripts/trigger-feed-distribution.ts

# Seed öncesi catalog-service çalıştır
docker-compose up catalog-service
```
