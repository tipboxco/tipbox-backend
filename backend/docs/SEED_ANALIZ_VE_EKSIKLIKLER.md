# Tipbox Backend – Seed Verileri Analizi ve Eksiklikler Raporu

Bu doküman, mevcut seed yapısının durumunu, hangi modüllerin/feature'ların seed'lendiğini ve nerede eksiklikler olduğunu özetler. Plan çıkarmanız için referans olarak kullanılabilir.

---

## 1. Mevcut Seed Mimarisi Özeti

### 1.1 Ana Seed Akışı

**Giriş noktası:** `scripts/clear-and-seed.ts` → `prisma/seed.ts` (main)

**Sıra:**

1. Catalog kontrolü (Product, Category, Brand – catalog-service’ten bekleniyor)
2. MinIO bucket + default avatar + setup avatarları
3. Post/PostMedia temizliği
4. **createSeedUsers** – 40 kullanıcı, Profile, UserSettings, Wallet (UserTheme gerekli)
5. **seedTaxonomy** – Experience Duration/Location/Purpose
6. **seedUserInventories** – Inventory (catalog ürünleriyle)
7. **seedPosts** – ContentPost, PostMedia, PostTag, PostQuestion, PostTip, PostComparison
8. **seedPostTags** – ContentPostTag
9. **seedSocialFeatures** – Like, Comment, Favorite, Share, View, Rating, vb.
10. **seedTrustRelations** – TrustRelation
11. **seedTrendingPosts** – TrendingPost
12. **seedTransactions** – Transaction (Wallet ile)
13. **seedEvents** – Event, EventStats, EventReward, EventBadge
14. **seedMessaging** – DMThread, DMMessage, DMRequest
15. **seedNFTMarketplace** – NFT, NFTTransaction, NFTMarketListing
16. **seedRemainingSystemTables** – Badge, BadgeCategory, UserBadge, AchievementChain, AchievementGoal, UserAchievement, ComparisonMetric, BoostOption, Experience taxonomy, MarketplaceBanner, vb.
17. **seedBrandCatalog** (steps/brand-catalog.seed) – BridgeFollower, BrandSurvey, BridgePost, BridgeReward, News
18. **seedPriorityUserNFTs** – Priority kullanıcılar için ek NFT
19. **seedRewardClaims** – RewardClaim
20. **ensureEventBadgeSystem**, **ensureMarketplaceBadges**
21. **seedBrandProducts** – Brand’lere product + inventory + post (test kategorileri Electronics/Beauty için daha zengin)

**Not:** `seedProductCategories`, `seedBrands`, `seedProducts` artık **deprecated**; kategori/ürün/brand catalog-service tarafından sağlanıyor.

### 1.2 Ayrı / Manuel Script’ler

| Script | Amaç | Ana seed’e dahil? |
|--------|------|--------------------|
| `scripts/seed-payment-subscription-data.ts` | SubscriptionPlan, UserSubscription, Invoice (omer@tipbox.co) | Hayır – manuel |
| `scripts/seed-explore-banners.ts` | Explore banner verileri | Hayır |
| `scripts/seed-achievement-ladder.ts` | Achievement ladder | Hayır |
| `scripts/seed-hierarchical-feed.ts` | Hiyerarşik feed | Hayır |
| `scripts/trigger-feed-distribution.ts` | Feed dağıtım job’ları | clear-and-seed sonunda çağrılıyor |

### 1.3 Modüler Seed (prisma/seed/index.ts)

**Kullanım:** Ana `seed.ts` ile aynı değil; ayrı test/alternatif akış.

İçerir: Taxonomy, ProductCatalog, Users, Content, Feed, Marketplace, **Explore**, Messaging, BrandProducts, NewsBanner, Feed distribution.

**Önemli:** Ana `seed.ts` içinde **Explore seed (explore.seed.ts) çağrılmıyor.** Explore verileri sadece modüler seed’de var.

---

## 2. Prisma Modellerine Göre Durum

### 2.1 Tam / Yeterli Seed Olan Modeller

- **User, Profile, UserSettings** – createSeedUsers
- **UserTheme** – main’de theme configs
- **TrustRelation** – seedTrustRelations
- **Category, MainCategory, SubCategory, ProductGroup, Product** – catalog-service veya seed (taxonomy/product categories/brands/products kısmen deprecated ama brand-catalog ve seedBrandProducts kullanıyor)
- **Brand, BrandCategory** – catalog-service
- **Inventory, InventoryMedia** – seedUserInventories, seedBrandProducts
- **ContentPost, PostMedia, PostTag, ContentPostTag, PostQuestion, PostTip, PostComparison, PostComparisonScore** – seedPosts
- **ContentComment, ContentLike, ContentFavorite, ContentShare, ContentRating, ContentCommentVote, ContentPostView, TopCommunityChoice** – seedSocialFeatures
- **Badge, BadgeCategory, UserBadge** – seedRemainingSystemTables + setup-badges.ts
- **AchievementChain, AchievementGoal, UserAchievement** – seedRemainingSystemTables
- **RewardClaim** – seedRewardClaims
- **BridgeFollower, BrandSurvey, BrandSurveyQuestion, BrandSurveyAnswer, BridgePost, BridgeReward, News** – seedBrandCatalog
- **Event, EventStats, EventReward, EventBadge** – seedEvents (+ ensureEventBadgeSystem)
- **Wallet, Transaction** – createSeedUsers (Wallet), seedTransactions
- **NFT, NFTTransaction, NFTMarketListing** – seedNFTMarketplace, seedPriorityUserNFTs
- **DMThread, DMMessage, DMRequest** – seedMessaging
- **Feed, FeedHighlight, TrendingPost** – seedTrendingPosts + trigger-feed-distribution
- **ComparisonMetric, BoostOption** – seedRemainingSystemTables
- **ExperienceDuration, ExperienceLocation, ExperiencePurpose** – seedTaxonomy
- **MarketplaceBanner** – seedRemainingSystemTables

### 2.2 Kısmen / Koşullu Seed Olan Modeller

- **EventStats** – seedEvents içinde güncelleniyor (create/update); tam ayrı bir “EventStats seed” yok, event katılımlarıyla dolduruluyor.
- **UserSubscription, Invoice, SubscriptionPlan** – Sadece `seed-payment-subscription-data.ts` ile (manuel). Ana seed’e entegre değil.

### 2.3 Hiç Seed Edilmeyen veya Eksik Modeller

| Model | Açıklama | Öneri |
|-------|----------|--------|
| **UserBlock** | Bloke ilişkileri | Test senaryoları için 2–5 block ilişkisi eklenebilir. |
| **UserMute** | Sessize alınan kullanıcılar | Test için 2–5 mute ilişkisi. |
| **UserFeedPreferences** | Feed tercihleri | createSeedUsers’ta UserSettings var; UserFeedPreferences ayrı tablo, seed yok. |
| **UserAvatar** | Çoklu avatar | Tek avatar URL Profile’da; UserAvatar tablosu seed’lenmiyor. |
| **PaymentMethod** | Ödeme yöntemi | Payment/subscription script’i kart bekliyor; ana seed’de yok. |
| **SubscriptionPlan, UserSubscription, Invoice** | Abonelik | Sadece ayrı script; ana seed’e entegre değil. |
| **TipsTokenTransfer** | TIPS transfer kayıtları | Transaction var, TipsTokenTransfer ayrı; seed yok. |
| **BridgeLeaderboard** | Brand liderlik tablosu | Brand catalog’da yok; istatistik/leaderboard EP’leri için eklenebilir. |
| **BridgeUserStats** | Kullanıcı–brand istatistikleri | Brand catalog’da yok; stats EP’leri için eklenebilir. |
| **ExpertRequest, ExpertRequestMedia, ExpertAnswer** | Uzman sorusu/cevap | Hiç seed yok. |
| **Notification** | Bildirimler | Hiç seed yok. |
| **PushToken** | Push token’lar | Hiç seed yok. |
| **AdminLog** | Admin işlem logları | Hiç seed yok. |
| **ModerationAction** | Moderasyon aksiyonları | Hiç seed yok. |
| **ManualReviewFlag** | Manuel inceleme bayrakları | Hiç seed yok. |
| **UserReport** | Kullanıcı raporları | Hiç seed yok. |
| **ProductSuggestion** | Ürün önerileri | Hiç seed yok. |
| **Lootbox, NFTClaim** | Lootbox / NFT claim | NFT tarafı var, Lootbox/NFTClaim seed yok. |
| **DMSupportSession, DMFeedback, SupportRequestReport** | DM destek / feedback | Hiç seed yok. |
| **AiExperienceSplit** | A/B deney (Experience split) | Hiç seed yok. Runtime'da doldurulur: kullanıcı envantere "owned" ürün ekleyip Experience metni paylaştığında `createInventoryItem` içinde otomatik `splitExperienceWithAI` çağrılır, Gemini ile ayrışan metin bu tabloya yazılır. Seed'de Gemini çağrısı yapılmadığı için bu tabloya veri basılmıyor; isteğe bağlı statik 1–2 kayıt eklenebilir. |
| **UserKycRecord, UserCollection, UserRole** | KYC, koleksiyon, rol | createSeedUsers’ta dolaylı kullanım var; bu tabloların açık seed’i yok. |

---

## 3. Feature / Modül Bazlı Eksiklikler

### 3.1 Explore (Keşfet)

- **Durum:** `explore.seed.ts` sadece **modüler seed** (`prisma/seed/index.ts`) içinde çağrılıyor.
- **Eksik:** Ana `seed.ts` (clear-and-seed akışı) Explore’u hiç çalıştırmıyor. Bu yüzden “normal” seed sonrası Explore sayfası boş kalabilir.
- **Öneri:** Ana seed’e `seedExplore()` eklenmeli veya clear-and-seed sonunda opsiyonel olarak çağrılmalı.

### 3.2 Ödeme / Abonelik (Payment & Subscription)

- **Durum:** SubscriptionPlan, UserSubscription, Invoice yalnızca `seed-payment-subscription-data.ts` ile; PaymentMethod seed’i yok.
- **Eksik:** Ana seed’de PaymentMethod, SubscriptionPlan, UserSubscription, Invoice yok. Subscription EP’leri test için elle script çalıştırmak gerekiyor.
- **Öneri:**
  - Ana seed’e minimal SubscriptionPlan + (opsiyonel) bir test UserSubscription/Invoice eklenebilir.
  - PaymentMethod için en az bir test kartı (maskelenmiş) seed’lenebilir veya script’in User’a bağlı bir PaymentMethod oluşturması sağlanabilir.

### 3.3 Brand Catalog (Bridge)

- **Durum:** BridgeFollower, BrandSurvey, BridgePost, BridgeReward, News `seedBrandCatalog` ile iyi durumda.
- **Eksik:**
  - **BridgeLeaderboard** – Seed yok; leaderboard EP’leri test için veri gerektirir.
  - **BridgeUserStats** – Seed yok; brand kullanıcı istatistikleri için gerekli.
- **Öneri:** Brand-catalog seed’e BridgeLeaderboard ve BridgeUserStats için az sayıda kayıt eklenebilir (top 5 brand + birkaç kullanıcı).

### 3.4 Expert / Soru–Cevap

- **Durum:** ExpertRequest, ExpertAnswer (ve medya) hiç seed’lenmiyor.
- **Eksik:** Uzman sorusu ve cevap akışını test etmek için veri yok.
- **Öneri:** 5–10 örnek ExpertRequest + ExpertAnswer (birkaç kullanıcı ve ürünle) eklenebilir.

### 3.5 Bildirim ve Push

- **Durum:** Notification ve PushToken seed’i yok.
- **Eksik:** Bildirim listesi ve push test senaryoları için veri yok.
- **Öneri:** Birkaç kullanıcı için 5–10 Notification + isteğe bağlı PushToken eklenebilir.

### 3.6 Moderasyon ve Raporlama

- **Durum:** AdminLog, ModerationAction, ManualReviewFlag, UserReport seed’i yok.
- **Eksik:** Moderasyon ve raporlama ekranları test için boş kalır.
- **Öneri:** Az sayıda UserReport, ModerationAction, AdminLog ve (opsiyonel) ManualReviewFlag eklenebilir.

### 3.7 Sosyal / Güvenlik (Block, Mute, Feed Preferences)

- **Durum:** UserBlock, UserMute, UserFeedPreferences seed’i yok.
- **Eksik:** Block/mute ve feed tercihi senaryoları test edilemiyor.
- **Öneri:** 2–5 UserBlock, 2–5 UserMute, 3–5 kullanıcı için UserFeedPreferences eklenebilir.

### 3.8 TIPS Transfer ve Ödeme Detayı

- **Durum:** Transaction (Wallet hareketi) var; TipsTokenTransfer ayrı tablo ve seed’lenmiyor.
- **Eksik:** TIPS gönder/al detaylı akışı test için eksik kalabilir.
- **Öneri:** seedTransactions’a paralel veya sonrasında bir miktar TipsTokenTransfer eklenebilir.

### 3.9 Lootbox / NFT Claim

- **Durum:** NFT ve NFTMarketListing seed’de; Lootbox ve NFTClaim yok.
- **Eksik:** Lootbox açma ve NFT claim akışları test edilemiyor.
- **Öneri:** Birkaç Lootbox + NFTClaim kaydı eklenebilir.

### 3.10 Kullanıcı Avatar (Çoklu)

- **Durum:** Profil avatar’ı (tek) kullanılıyor; UserAvatar tablosu doldurulmuyor.
- **Eksik:** Çoklu avatar özelliği test edilemiyor.
- **Öneri:** Özellik kullanılıyorsa, birkaç kullanıcı için UserAvatar kayıtları eklenebilir.

---

## 4. Öncelik Sıralı Aksiyon Planı

### Faz 1 – Kritik (Ana akış ve temel EP’ler)

1. **Explore’u ana seed’e ekle**  
   - Ana `seed.ts` veya clear-and-seed sonunda `seedExplore()` çağrısı ekleyin.  
   - Böylece tek komutla (`db:seed` / clear-and-seed) Explore sayfası da dolu olur.

2. **Payment/Subscription’ı ana seed’e entegre et**  
   - SubscriptionPlan (1–2 plan) ana seed’de oluşturulabilir.  
   - İsteğe bağlı: bir test kullanıcısı için UserSubscription + Invoice.  
   - PaymentMethod: Ya ana seed’de bir test kartı ekleyin ya da `seed-payment-subscription-data.ts` içinde User yoksa bir PaymentMethod oluşturun.

3. **BridgeLeaderboard & BridgeUserStats**  
   - `steps/brand-catalog.seed.ts` içinde top 5 brand ve birkaç kullanıcı için Leaderboard + UserStats kayıtları ekleyin.

### Faz 2 – Önemli (Test kalitesi)

4. **ExpertRequest + ExpertAnswer**  
   - Yeni bir `expert.seed.ts` (veya mevcut bir seed dosyasına) 5–10 ExpertRequest + cevaplar ekleyin.

5. **Notification (+ isteğe bağlı PushToken)**  
   - Birkaç kullanıcı için 5–10 Notification; gerekirse 1–2 PushToken.

6. **UserBlock, UserMute, UserFeedPreferences**  
   - seedTrustRelations veya ayrı küçük bir “social-safety” seed’de 2–5 block, 2–5 mute, 3–5 UserFeedPreferences.

### Faz 3 – Tamamlayıcı

7. **Moderasyon / Raporlama**  
   - UserReport, ModerationAction, AdminLog (ve isteğe bağlı ManualReviewFlag) için az sayıda kayıt.

8. **TipsTokenTransfer**  
   - seedTransactions’tan sonra veya ona bağlı, birkaç TIPS transfer kaydı.

9. **Lootbox + NFTClaim**  
   - NFT seed’ine yakın yerde birkaç Lootbox + NFTClaim.

10. **UserAvatar (çoklu)**  
    - Sadece bu özellik kullanılıyorsa, birkaç kullanıcı için UserAvatar seed’i.

---

## 5. Dokümantasyon ve Script Tutarlılığı

- **SEED_COMPLETE_GUIDE.md** – Güncel; workflow, media, taxonomy açıklamaları yerinde.
- **BRAND_CATALOG_SEED_GAPS.md** – BridgeFollower, Survey, Post, Reward, News artık brand-catalog.seed’de mevcut; doküman “eksik” kısımlarını “tamamlandı” olarak güncellemek ve sadece BridgeLeaderboard/BridgeUserStats’ı eksik göstermek faydalı olur.
- **Modüler seed (index.ts) vs ana seed.ts** – Hangisinin “default” olduğu (clear-and-seed = ana seed) README veya SEED_COMPLETE_GUIDE’da net yazılabilir; Explore’un sadece modüler seed’de olduğu da belirtilebilir.

---

## 6. Özet Tablo

| Alan | Durum | Ana seed’de? | Önerilen aksiyon |
|------|--------|--------------|------------------|
| Kullanıcı / profil / trust / wallet / transaction | ✅ İyi | Evet | - |
| Content / post / social (like, comment, vb.) | ✅ İyi | Evet | - |
| Feed / trending / dağıtım | ✅ İyi | Evet | - |
| Brand catalog (Bridge*) | ✅ Çoğu tam | Evet | BridgeLeaderboard, BridgeUserStats ekle |
| Explore | ⚠️ Eksik | Hayır | Ana seed’e seedExplore ekle |
| Ödeme / abonelik | ⚠️ Ayrı script | Hayır | Ana seed’e plan + subscription + PaymentMethod entegre et |
| Expert Q&A | ❌ Yok | Hayır | ExpertRequest/Answer seed ekle |
| Bildirim / push | ❌ Yok | Hayır | Notification (+ PushToken) seed ekle |
| Block / Mute / Feed prefs | ❌ Yok | Hayır | Az sayıda kayıt ekle |
| Moderasyon / rapor | ❌ Yok | Hayır | UserReport, ModerationAction, AdminLog ekle |
| TipsTokenTransfer | ❌ Yok | Hayır | Transaction’a paralel bir miktar ekle |
| Lootbox / NFTClaim | ❌ Yok | Hayır | Az sayıda Lootbox + NFTClaim ekle |

Bu rapor, planınızı Faz 1 → 2 → 3 ve “Feature bazlı” bölümlere göre netleştirmenize yardımcı olacak şekilde hazırlandı. Belirli bir modül için daha detaylı seed tasarımı isterseniz o modülü ayrıca ele alabiliriz.

---

## 7. EP / Servis Entegrasyonu Olmayan Tablolar (Hiç Kullanılmayan)

Aşağıdaki tabloların **hiçbir public/private endpoint veya application servisi tarafından kullanılmadığı** tespit edildi. Sadece domain entity veya seed/clear script'lerinde geçiyorlar; canlı uygulama akışında kullanılmıyorlar.

| Tablo | Not |
|-------|-----|
| **AdminLog** | Sadece domain entity (`admin-log.entity.ts`). Prisma ile okuma/yazma yapan servis veya EP yok. |
| **ModerationAction** | Sadece domain entity. Prisma kullanan servis/router yok. |
| **ManualReviewFlag** | Sadece domain entity. Prisma kullanan servis/router yok. |
| **BridgeLeaderboard** | Sadece domain entity. Brand tarafında leaderboard EP'i yok; sadece apple seed script'lerinde (`apple-leaderboard.seed.ts`) kullanılıyor. |
| **BridgeUserStats** | Sadece domain entity. Brand stats EP'i bu tabloyu kullanmıyor; sadece apple seed (`apple-history.seed.ts`) ve clear script'lerinde geçiyor. |
| **ProductSuggestion** | `ProductSuggestionPrismaRepository` var ama **hiçbir application service veya router bu repository'yi kullanmıyor**. EP yok; öneri akışı henüz açılmamış. |
| **Lootbox** | Sadece domain entity. Prisma ile Lootbox CRUD yapan servis/EP yok. |
| **NFTClaim** | Sadece domain entity. Prisma ile NFTClaim kullanan servis/EP yok. |
| **DMSupportSession** | Sadece domain entity. Prisma kullanan servis/router yok. |
| **DMFeedback** | Sadece domain entity. Prisma kullanan servis/router yok. |

**Özet:** Bu 10 tablo şu an **kullanılmıyor**. İleride EP/servis eklenecekse seed de o zaman düşünülebilir; aksi halde seed önceliği düşüktür.

---

## 8. Kullanılan Ama Seed Olmayan Tablolar (Temiz Liste)

Aşağıdaki tablolar **en az bir endpoint veya application servisi tarafından kullanılıyor** (okuma/yazma), ancak **ana seed veya ortak bir seed script'inde veri üretilmiyor**. Test/QA ve demo için seed eklenmesi mantıklı.

### 8.1 Öncelikli (EP/servis yoğun kullanım) — ✅ Ana seed step’lere taşındı

| Tablo | EP / Servis | Step / Durum |
|-------|-------------|--------------|
| **UserBlock** | `user.service` (block/unblock, list), user router | ✅ `steps/social-and-preferences.seed.ts` |
| **UserMute** | `user.service` (mute/unmute, list), user router | ✅ `steps/social-and-preferences.seed.ts` |
| **UserFeedPreferences** | `feed.service`, `feed-scoring.service`, `user.service`, repository | ✅ `steps/social-and-preferences.seed.ts` |
| **UserAvatar** | Birçok servis (user, notification, feed, marketplace, expert, auth) | ✅ `steps/user-avatar.seed.ts` |
| **PaymentMethod** | `PaymentMethodService`, user router | ✅ `steps/payment.seed.ts` (test kartı) |
| **SubscriptionPlan** | `SubscriptionPlanService`, subscription router | ✅ `steps/payment.seed.ts` |
| **UserSubscription** | Dashboard, subscription akışı | ✅ `steps/payment.seed.ts` |
| **Invoice** | `InvoiceService`, user router | ✅ `steps/payment.seed.ts` (3 fatura) |
| **TipsTokenTransfer** | `messaging.service`, `tips-balance.service` | ✅ `steps/tips-transfer.seed.ts` |
| **ExpertRequest** | `expert.service`, expert router | ✅ `steps/expert.seed.ts` |
| **ExpertRequestMedia** | Expert request medya ekleri | (opsiyonel; expert step’te istenirse eklenebilir) |
| **ExpertAnswer** | `expert.service`, expert router | ✅ `steps/expert.seed.ts` |
| **Notification** | `NotificationPrismaRepository`, notification router | ✅ `steps/notification.seed.ts` |
| **PushToken** | `PushTokenService`, notification router | ✅ `steps/notification.seed.ts` (1 token) |

### 8.2 Orta Öncelik (EP/servis var, seed test kalitesini artırır)

| Tablo | EP / Servis | Seed Önerisi |
|-------|-------------|--------------|
| **UserReport** | `user.service` (report user), UserReportPrismaRepository | 2–5 rapor kaydı |
| **SupportRequestReport** | `support-request.service` (report support request) | 2–5 DM support raporu |
| **AiExperienceSplit** | `post.service`, `inventory.service`, AiExperienceSplitPrismaRepository | İsteğe bağlı; deney snippet'leri |
| **UserRole** | RBAC middleware, role-checker, expert-matching (expert rolü) | Birkaç kullanıcıya "expert" vb. rol |
| **UserKycRecord** | UserKycRecordPrismaRepository | EP kullanımı net değil; varsa 1–2 kayıt |
| **UserCollection** | UserCollectionPrismaRepository | EP kullanımı net değil; varsa 1–2 koleksiyon |

### 8.3 Özet: "Kullanılan ama seed yok" listesi (tek satır)

- UserBlock, UserMute, UserFeedPreferences, UserAvatar  
- PaymentMethod, SubscriptionPlan, UserSubscription, Invoice  
- TipsTokenTransfer  
- ExpertRequest, ExpertRequestMedia, ExpertAnswer  
- Notification, PushToken  
- UserReport, SupportRequestReport  
- AiExperienceSplit, UserRole, UserKycRecord, UserCollection  

BridgeLeaderboard ve BridgeUserStats bu listeye **alınmadı**; çünkü EP/servis entegrasyonu yok (bkz. Bölüm 7). EP eklendiğinde hem "kullanılan" hem "seed gerekli" listesine eklenebilir.
