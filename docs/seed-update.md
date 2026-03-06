# Seed Update Plan - TestFlight Hazırlığı

> **Tarih:** 2026-03-05
> **Amaç:** TestFlight için seed verilerini optimize etmek, internal test kullanıcılarını temiz bırakmak ve EP/tablo kapsama analizi yapmak.

---

## 1. FEATURED_USER_IDS Değişikliği

### Problem

Mevcut `FEATURED_USER_IDS` internal test ekibini içeriyor. Bu kullanıcılar (`SEED_FEATURED_ONLY=true` modunda) tüm seed post ve inventory verilerini alıyor. Ancak bu kullanıcılar uygulamayı organik test etmeli - temiz profille başlamalılar. Hatta profilleri bile olmaması gerekiyor. Onlar register olarak sisteme girmeleri gerekiyor. 

**Mevcut FEATURED_USER_IDS (internal ekip):**

| # | ID | İsim | Email | Rol |
|---|---|---|---|---|
| 1 | `480f5de9-...` | Ömer Faruk | omer@tipbox.co | TEST_USER_ID |
| 2 | `11111111-...` | Tuna | tuna@tipbox.co | TRUST_USER_IDS[0] |
| 3 | `33333333-...` | İbrahim | ibrahim@tipbox.co | TRUST_USER_IDS[2] |
| 4 | `44444444-...` | Burakcan | burakcan@tipbox.co | TRUST_USER_IDS[3] |
| 5 | `55555555-...` | Mihraç | mihrac@tipbox.co | TRUST_USER_IDS[4] |
| 6 | `aaaaaaaa-...` | İrem | irem@tipbox.co | TRUSTER_USER_IDS[0] |
| 7 | `bbbbbbbb-...` | Furkan | furkan@tipbox.co | TRUSTER_USER_IDS[1] |
| 8 | `cccccccc-...` | Aycan | aycan@tipbox.co | TRUSTER_USER_IDS[2] |
| 9 | `99999999-...` | Ozan (Julia) | ozan@tipbox.co | JULIA_USER_ID |

### Çözüm: Internal Users = Temiz, Seed Users = Dolu

Internal test ekibi seed verisi ALMAMALI. Bunun yerine SEED_USERS listesindeki non-internal kullanıcılara veri basılmalı.

**Yeni FEATURED_USER_IDS (seed-only users):**

| # | İsim | Email | Neden |
|---|---|---|---|
| 1 | Elif | elif@tipbox.co | Skincare & Beauty içerik |
| 2 | Can | can@tipbox.co | Gaming & Streaming |
| 3 | Zeynep | zeynep@tipbox.co | Photo & Camera |
| 4 | Selin | selin@tipbox.co | Hair Care |
| 5 | Emre | emre@tipbox.co | Smartwatch |
| 6 | Deniz | deniz@tipbox.co | Beard & Grooming |
| 7 | Berkay | berkay@tipbox.co | Drone & Aerial |
| 8 | Gizem | gizem@tipbox.co | Moisturizer |
| 9 | Ece | ece@tipbox.co | Lip Products |

### Gerekli Kod Değişiklikleri

**Dosya:** `backend/prisma/seed.ts` (satır ~58-68)

```typescript
// ESKİ
const FEATURED_USER_IDS = [
  TEST_USER_ID,           // omer@tipbox.co
  TRUST_USER_IDS[0],      // tuna@tipbox.co
  TRUST_USER_IDS[2],      // ibrahim@tipbox.co
  TRUST_USER_IDS[3],      // burakcan@tipbox.co
  TRUST_USER_IDS[4],      // mihrac@tipbox.co
  TRUSTER_USER_IDS[0],    // irem@tipbox.co
  TRUSTER_USER_IDS[1],    // furkan@tipbox.co
  TRUSTER_USER_IDS[2],    // aycan@tipbox.co
  JULIA_USER_ID,          // ozan@tipbox.co
]

// YENİ — sadece non-internal kullanıcılar
const FEATURED_USER_IDS = SEED_USERS
  .filter(u => !INTERNAL_USER_EMAILS.includes(u.email))
  .slice(0, 9)
  .map(u => u.id)
```

**Ek olarak internal kullanıcıları tanımla:**

```typescript
const INTERNAL_USER_EMAILS = [
  'omer@tipbox.co', 'tuna@tipbox.co', 'mehmet@tipbox.co',
  'ibrahim@tipbox.co', 'burakcan@tipbox.co', 'mihrac@tipbox.co',
  'irem@tipbox.co', 'furkan@tipbox.co', 'aycan@tipbox.co',
  'ozan@tipbox.co',
]
```

### Internal Kullanıcılar Ne Alacak?

Internal kullanıcılar yine seed'de oluşturulacak ama sadece:
- User + Profile (isim, bio, avatar, banner)
- Wallet + başlangıç TIPS bakiyesi (test için)
- UserSettings (varsayılan ayarlar)
- Admin rolü (admin@tipbox.co)

Almayacakları:
- Post (kendi oluşturacaklar)
- Inventory (kendi ekleyecekler)
- DM geçmişi
- Fazla trust ilişkisi

---

## 2. Öncelikli Düzeltmeler (P0 / P1 / P2)

### P0 — TestFlight Blocker

| # | Sorun | Etki | Çözüm |
|---|---|---|---|
| 1 | **FEATURED_USER_IDS internal ekibi gösteriyor** | Internal kullanıcılar kirli profille TestFlight yapamaz | Yukarıdaki değişiklik |
| 2 | **Comparison Metrics Türkçe** | "Fiyat", "Kalite", "Dayanıklılık" gibi metrikler İngilizce olmalı | `Fiyat→Price`, `Kalite→Quality`, `Kullanım Kolaylığı→Ease of Use`, `Dayanıklılık→Durability`, `Tasarım→Design`, `Müşteri Hizmetleri→Customer Service`, `Özellikler→Features`, `Çevre Dostu→Eco-Friendly` |
| 3 | **Event titles/descriptions Türkçe** | 11 event tamamen Türkçe | Tüm event başlık ve açıklamalarını İngilizceye çevir |
| 4 | **DM message templates Türkçe** | Mesaj şablonları Türkçe | `messageTemplates` dizisini İngilizceye çevir |
| 5 | **UserTheme descriptions Türkçe** | `'Açık tema - günün her saati için ideal'` | İngilizceye çevir |

### P1 — Önemli Düzeltmeler

| # | Sorun | Etki | Çözüm |
|---|---|---|---|
| 1 | **Taxonomy karışıklığı** | ExperienceLocation'da "Excellent/Good/Poor" (rating), ExperiencePurpose'da "Daily/1-2 times a week" (frequency) değerleri var | Her tablodaki misplaced değerleri kaldır, doğru tablolara taşı veya ayrı ExperienceRating/ExperienceFrequency tabloları oluştur |
| 2 | **Julia Havk / Ozan ID çakışması** | `JULIA_USER_ID = 99999999-...` hem Julia hem Ozan'a referans | Tek bir isim seç ve tutarlı yap. Ozan halihazırda SEED_USERS listesinde, Julia ayrı oluşturuluyor |
| 3 | **Badge descriptions karışık dil** | Bazı badge'ler Türkçe ("Gürültü Avcısı"), bazıları İngilizce ("Pioneer Badge") | Hepsini İngilizceye çevir |
| 4 | **AI post generation Gemini bağımlılığı** | Gemini API key yoksa post üretimi başarısız olabilir | Fallback statik post şablonları ekle |

### P2 — İyileştirmeler

| # | Sorun | Etki | Çözüm |
|---|---|---|---|
| 1 | **seed.ts 8000+ satır monolith** | Bakım zorluğu, debug imkansız | Step dosyalarına parçala (mevcut `seed/steps/` yapısını genişlet) |
| 2 | **Gereksiz NFT sayısı** | 80-200 NFT aşırı | TestFlight için 10-15 NFT yeterli |
| 3 | **500 post hedefi yüksek** | Gemini API maliyeti ve süre | TestFlight için 50-100 post yeterli |
| 4 | **Deprecated kod blokları** | `seedProductCategories()`, `seedBrands()`, `seedProducts()` commented-out | Tamamen kaldır, dosyayı temizle |

---

## 3. EP (Endpoint) Kapsama Analizi

Projedeki tüm endpoint router'ları (`interfaces/`) ile seed verilerini karşılaştırdım. Aşağıda her EP grubunun seed tarafından karşılanma durumu yer alıyor.

### Tam Kapsanan EP'ler (Seed Yeterli)

| EP Grubu | Router | Seed Durumu |
|---|---|---|
| **Auth** (`/auth`) | login, register, verify, reset | User + passwordHash seed'leniyor. Login çalışır (şifre: `Tipbox2024!`) |
| **Users** (`/users`) | profile, trust, avatars | 34 User + Profile + Trust ilişkileri + UserAvatar mevcut |
| **Feed** (`/feed`) | main feed, filtered, seen | Post + FeedDistribution + Trust seed'leniyor |
| **Posts** (`/posts`) | create, read, update, delete | 500 AI-generated post (tip, question, experience, comparison, update) |
| **Interactions** (`/interactions`) | like, comment, share, favorite | ContentLike + ContentComment + ContentShare + ContentFavorite seed'leniyor |
| **Events** (`/events`) | list, detail, participate | 11 Event + badges + rewards seed'leniyor |
| **Messaging** (`/inbox`) | threads, messages | 30-50 DMThread + DMMessage + DMRequest seed'leniyor |
| **NFT/Marketplace** (`/marketplace`) | listings, buy, sell | NFT + NFTMarketListing + NFTAttribute seed'leniyor |
| **Wallets** (`/wallets`) | balance, connect, rewards | Wallet + TipsBalance + RewardClaim seed'leniyor |
| **Transactions** (`/transactions`) | send-tip, history | Transaction + TipsTokenTransfer seed'leniyor |
| **Gamification** (`/api`) | badges, collections, achievements | Badge + BadgeCollection + AchievementGoal + ActionType + UserBadge seed'leniyor |
| **Collections** (`/collections`) | list, detail, reminder | BadgeCollection + Badge + AchievementGoal seed'leniyor |
| **Catalog** (`/catalog`) | categories, products, posts | Category + Product + ContentPost ilişkileri var (catalog-service'den gelir) |
| **Brands** (`/brands`) | list, detail, posts | Brand + BridgeFollower + News + BrandSurvey seed'leniyor |
| **Search** (`/search`) | users, brands, products | User + Brand + Product mevcut |
| **Expert** (`/expert`) | requests, responses | ExpertRequest + ExpertAnswer seed'leniyor (5-8 request) |
| **Inventory** (`/inventory`) | list, add, update | UserInventory + Product ilişkileri seed'leniyor |
| **Notifications** (`/notifications`) | list, read, settings | Notification (5-10) + PushToken seed'leniyor |
| **Subscription** (`/subscription`) | plans | SubscriptionPlan (2: Monthly + Yearly) seed'leniyor |
| **Explore** (`/explore`) | hottest, events, brands | Post + Event + Brand + MarketplaceBanner seed'leniyor |

### Kısmen Kapsanan EP'ler (Ek Veri Gerekli)

| EP Grubu | Eksik | Öneri |
|---|---|---|
| **Notifications** | Sadece 5-10 notifikasyon var, 22 tip mevcut | Her notification tipinden en az 1 adet seed'le (POST_LIKED, COMMENTED, TRUSTED, NEW_FOLLOWER, EVENT_STARTED, BADGE_EARNED, TIPS_RECEIVED, DM_NEW_MESSAGE vb.) |
| **Gamification Stats** (`/api/profile/gamification-stats`) | UserAchievement progress verisi eksik | Bazı kullanıcılara %30-80 arası achievement progress ekle |
| **Collections Progress** | AchievementGoal var ama UserAchievement progress seed'lenmiyor | Featured user'lar için 3-5 collection'da ilerleme kaydet |
| **Brand Surveys** | Survey + Question var ama UserSurveyCompletion eksik | Bazı kullanıcılara tamamlanmış survey yanıtları ekle |
| **Wallet Rewards** | RewardClaim seed'leniyor ama RewardDistribution eksik | Birkaç PENDING + CLAIMED reward distribution ekle |
| **Expert Requests** | 5-8 request var ama media eklenmemiş | ExpertRequestMedia ile görsel ekle |

### Kapsamayan EP'ler (Yeni Seed Gerekli)

| EP Grubu | Durum | Önem | Öneri |
|---|---|---|---|
| **News** (`/news`) | News tablosu brand-catalog.seed.ts'de seed'leniyor ama miktarı az | ORTA | Her brand için 2-3 haber makalesi |
| **Surveys** (`/surveys`) | BrandSurvey var ama genel Survey modeli yoksa ayrı | DÜŞÜK | Şimdilik BrandSurvey yeterli |
| **Product Suggestions** | ProductSuggestion tablosu hiç seed'lenmiyor | DÜŞÜK | TestFlight'ta kullanıcılar kendi önerecek, seed gerekmez |
| **Lootbox** | Lootbox tablosu seed'lenmiyor | DÜŞÜK | Lootbox mekaniksi TestFlight scope'unda değilse gerekmez |

---

## 4. Tablo Kapsama Analizi

Prisma schema'daki 72 modelden seed durumu:

### Seed'lenen Tablolar (45/72)

| Kategori | Tablolar |
|---|---|
| **Core** | User, Profile, UserSettings, UserAvatar, UserRole, TrustRelation |
| **Content** | ContentPost, PostMedia, PostTag, ContentPostTag, PostTip, PostQuestion, PostComparison, PostComparisonScore |
| **Engagement** | ContentComment, ContentLike, ContentFavorite, ContentShare, ContentPostView, ContentCommentVote |
| **Feed** | Feed (via distribution), FeedHighlight, TrendingPost |
| **Catalog** | Category, Product, MainCategory, SubCategory, ProductGroup (catalog-service) |
| **Inventory** | Inventory, AiExperienceSplit |
| **Gamification** | Badge, BadgeCategory, BadgeCollection, UserBadge, AchievementChain, AchievementGoal, ActionType |
| **Events** | Event, EventBadge |
| **Messaging** | DMThread, DMMessage, DMRequest |
| **Financial** | Wallet, Transaction, TipsTokenTransfer, SubscriptionPlan, PaymentMethod, UserSubscription, Invoice, RewardClaim |
| **NFT** | NFT, NFTAttribute, NFTMarketListing, NFTTransaction |
| **Brand** | Brand, BrandCategory, BridgeFollower, BrandSurvey, BrandSurveyQuestion, BrandSurveyAnswer, News |
| **System** | UserTheme, ComparisonMetric, BoostOption, MarketplaceBanner, ExperienceDuration, ExperienceLocation, ExperiencePurpose |
| **Other** | Notification, PushToken, ExpertRequest, ExpertAnswer, AdminLog |

### Seed'lenmeyen (Ama Gerekmeyen) Tablolar (27/72)

| Tablo | Neden Gerekmez |
|---|---|
| LoginAttempt | Otomatik loglanır |
| PasswordResetToken | İstek üzerine oluşur |
| EmailVerificationCode | Kayıt sırasında oluşur |
| UserTitle | Achievement'tan kazanılır |
| UserCollection | Kullanıcı oluşturur |
| UserTrustScore | Hesaplanır |
| UserKycRecord | KYC-specific |
| UserBlock, UserMute | Social&Preferences step'inde seed'leniyor (1 block, 1 mute) |
| UserFeedPreferences | Social&Preferences step'inde seed'leniyor |
| ActionLog | Otomatik takip |
| UserAchievement | Aksiyonlardan türetilir |
| TopCommunityChoice | Sistem ödülü |
| ContentCollection | Kullanıcı oluşturur |
| ContentRating | Kullanıcı etkileşimi |
| ContentPostVote | Kullanıcı etkileşimi |
| PostUpdateContent | Bağlı post |
| ProductSuggestion | Kullanıcı önerisi |
| InventoryMedia | Kullanıcı yükler |
| BridgePost | Kullanıcı brand post'u |
| UserSurveyCompletion | Survey yanıtı |
| BridgeUserStats, BridgeLeaderboard, BridgeReward | Hesaplanır |
| MessageReaction, MessageReadReceipt | Kullanıcı etkileşimi |
| SupportRequestReport, DMSupportSession, DMFeedback | Destek sistemi |
| ModerationAction, ManualReviewFlag, UserReport | Moderasyon |
| EventStats, EventReward | Dinamik |
| ThirdwebWebhookLog, ContractEventLog | Sistem logları |
| Lootbox, NFTClaim | Dinamik |

---

## 5. TestFlight İçin Eklenmesi Önerilen Seed Verileri

### Yüksek Öncelik (TestFlight UX'i İyileştirir)

#### 5.1 Zengin Notification Set'i
Mevcut: 5-10 generic notification. TestFlight'ta notification ekranı boş görünecek.

**Öneri:** Her notification tipinden en az 1 adet:
```
POST_LIKED, POST_COMMENTED, NEW_FOLLOWER, TRUST_RECEIVED,
EVENT_STARTED, EVENT_ENDING_SOON, BADGE_EARNED, TIPS_RECEIVED,
DM_NEW_MESSAGE, EXPERT_REQUEST_ANSWERED, REWARD_AVAILABLE,
SYSTEM_ANNOUNCEMENT
```
**Toplam:** ~15-20 bildirim (featured user'lara değil, non-internal kullanıcılara)

#### 5.2 Achievement Progress
Mevcut: AchievementGoal var ama hiçbir kullanıcının ilerlemesi yok.

**Öneri:** Featured (non-internal) kullanıcılar için:
- 3-5 collection'da %30-80 progress
- 1-2 tamamlanmış achievement (UserAchievement `completed: true`)
- "Near completion" (>80%) olan 2-3 goal (gamification stats EP'i için)

#### 5.3 Daha Zengin Expert Request'ler
Mevcut: 5-8 request, media yok.

**Öneri:**
- En az 3 ANSWERED, 2 PENDING, 1 BROADCASTING status'ünde
- 2-3 request'e ExpertRequestMedia ekle
- TIPS amount'ları değişken (5, 10, 25 TIPS)

#### 5.4 News Makaleleri
Mevcut: brand-catalog.seed.ts'de 4 template var ama toplam makale sayısı az.

**Öneri:** En az 10-15 haber makalesi (top brand'ler için). Explore sayfasının doluluk hissi için kritik.

### Orta Öncelik (İyi Olur)

#### 5.5 Wallet Reward Distributions
Mevcut: RewardClaim seed'leniyor ama distribution chain eksik.

**Öneri:**
- 5-10 RewardDistribution (TIPS, BADGE, EVENT kaynaklı)
- Bazıları PENDING, bazıları CLAIMED
- Rewards summary EP'si için gerekli

#### 5.6 Brand Survey Completion
Mevcut: Survey + Question + Answer seed'leniyor ama UserSurveyCompletion yok.

**Öneri:**
- 3-5 kullanıcıya tamamlanmış survey kayıtları
- pointsAwarded değerleri (5-15 TIPS)
- Bridge engagement göstergesi

#### 5.7 Event Participation
Mevcut: Event seed'leniyor ama EventStats ve EventReward eksik.

**Öneri:**
- Featured user'lar için 2-3 event participation kaydı
- 1-2 event reward (TIPS + BADGE)
- EventStats (totalParticipated, eventPostsCount)

### Düşük Öncelik (TestFlight Sonrası)

#### 5.8 Lootbox Sistemi
Sadece lootbox mekaniksi TestFlight scope'unda ise seed gerekir.

#### 5.9 Product Suggestions
Kullanıcılar TestFlight'ta kendi önerilerini oluşturacak.

#### 5.10 Content Collections
Kullanıcı-oluşturmalı koleksiyonlar, seed gerekmiyor.

---

## 6. Özet Aksiyon Listesi

### Hemen Yapılması Gerekenler (TestFlight Öncesi)

| # | Aksiyon | Dosya | Tahmini Etki |
|---|---|---|---|
| 1 | FEATURED_USER_IDS'ı non-internal kullanıcılara çevir | `seed.ts:58-68` | Internal ekip temiz profille test eder |
| 2 | Comparison metrics İngilizceye çevir | `seed.ts:7091-7100` | App UI'da Türkçe metrik ismi görünmez |
| 3 | Event titles/descriptions İngilizceye çevir | `seed.ts:3427-3975` | Event ekranı İngilizce olur |
| 4 | DM message templates İngilizceye çevir | `seed.ts:seedMessaging()` | Inbox Türkçe mesaj göstermez |
| 5 | UserTheme descriptions İngilizceye çevir | `seed.ts:6856-6860` | Tema açıklamaları düzgün olur |
| 6 | Zengin notification set'i ekle | `seed/steps/notification.seed.ts` | Notification ekranı dolu görünür |
| 7 | Achievement progress ekle | Yeni step veya mevcut gamification step | Gamification ekranları işlevsel görünür |

### TestFlight Sırasında / Sonrasında

| # | Aksiyon | Dosya | Tahmini Etki |
|---|---|---|---|
| 8 | Expert request media ekle | `seed/steps/expert.seed.ts` | Expert ekranı zengin görünür |
| 9 | News makalelerini artır | `seed/steps/brand-catalog.seed.ts` | Explore sayfası dolu |
| 10 | Taxonomy karışıklığını düzelt | `seed/taxonomy.seed.ts` | Doğru filtre seçenekleri |
| 11 | Julia/Ozan çakışmasını çöz | `seed.ts` | Tutarlı veri |
| 12 | Deprecated kod temizliği | `seed.ts` | Bakım kolaylığı |
| 13 | Post hedef sayısını düşür (500→100) | `seed.ts:seedPosts()` | Daha hızlı seed, daha az API maliyeti |
| 14 | NFT sayısını düşür (200→15) | `seed.ts:seedNFTMarketplace()` | Daha temiz marketplace |

---

## 7. Sonuç

**Mevcut seed'ler TestFlight için %85 yeterli.** Tüm major endpoint'ler (feed, posts, events, messaging, marketplace, gamification, wallets, transactions, expert, catalog, brands, search, explore) seed verisiyle destekleniyor.

Kritik eksikler:
1. **FEATURED_USER_IDS değişikliği** — internal ekibin temiz profil ihtiyacı
2. **Türkçe içerik** — karşılaştırma metrikleri, event'ler, mesajlar İngilizce olmalı
3. **Notification çeşitliliği** — tek tip yerine tüm notification tipleri seed'lenmeli
4. **Achievement progress** — gamification ekranlarının işlevsel görünmesi için gerekli

Bu 4 aksiyonla seed TestFlight-ready olur.
