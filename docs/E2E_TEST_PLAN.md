# Tipbox Backend - E2E Test Plan

**Tarih:** 2026-03-01
**Arac:** k6 (Grafana) — fonksiyonel E2E + load/stress testing
**Ortam:** Configurable (LOCAL / STAGING via `BASE_URL`)
**Kapsam:** Tum app-side kullanici akislari (Admin EP'ler haric)

---

## 1. Genel Bakis

### Amac

1. **Fonksiyonel E2E:** Tum app endpoint'lerinin senaryo bazli, uclararasi calistigini dogrulama
2. **Load Testing:** Coklu kullanici ile sistem davranisini olcme (response time, error rate, throughput)
3. **Stress Testing:** Kirilma noktasini bulma (sistemin ne kadar yuku kaldirabileceginiz)

### Neden k6?

- JavaScript ile yazilir (TypeScript backend'le uyumlu)
- Hem fonksiyonel assertion hem load test tek aracta
- CLI'dan calisir, CI/CD'ye entegre edilebilir
- HTML/JSON rapor cikartir
- Virtual User (VU) bazli senaryo destegi — "50 kullanici ayni anda post atiyor" gibi senaryolar dogal

### Test Ortami Yapilandirmasi

```
BASE_URL    = http://localhost:3000   (local Docker)
            = https://staging.tipbox.co (staging)

AUTH_METHOD = manual                   (POST /auth/login)
```

Tum testler `BASE_URL` environment variable'ina gore calisir. Her iki ortamda da ayni test seti kullanilir.

### Auth Stratejisi

**Manual auth (email/password)** kullanilacak:
- Hem local hem staging'de calisir
- Auth0 rate limit'lerine takilmaz
- Test kullanicilari onceden seed edilir veya register flow'u ile olusturulur

Her senaryo basinda:
```javascript
// k6 setup fonksiyonunda
const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
  email: 'testuser1@tipbox.test',
  password: 'TestPass123!'
}), { headers: { 'Content-Type': 'application/json' } });

const token = loginRes.json('data.token');
// Tum sonraki isteklerde: Authorization: Bearer ${token}
```

---

## 2. Dosya Yapisi

```
tests/
├── e2e/
│   ├── config/
│   │   ├── env.js                    # BASE_URL, auth credentials, thresholds
│   │   └── helpers.js                # Auth helper, response checker, random data
│   │
│   ├── scenarios/                    # Senaryo bazli test dosyalari
│   │   ├── 01-onboarding.test.js     # Register → Verify → Setup Profile
│   │   ├── 02-auth.test.js           # Login → Token → Logout → Forgot Password
│   │   ├── 03-profile.test.js        # View → Edit → Avatar → Settings
│   │   ├── 04-post-creation.test.js  # Tip/Question/Benchmark/Experience/Update
│   │   ├── 05-feed.test.js           # Main Feed → Filter → Seen → Hide
│   │   ├── 06-interaction.test.js    # Like → Comment → Share → Bookmark → React
│   │   ├── 07-social.test.js         # Trust → Block → Mute → Report → Suggest
│   │   ├── 08-inbox.test.js          # Thread → Message → React → Read → Delete
│   │   ├── 09-notification.test.js   # List → Read → Settings → Push Token
│   │   ├── 10-wallet.test.js         # Create → Connect → Balance → Tip → History
│   │   ├── 11-gamification.test.js   # Badges → Collections → Achievements → Claim
│   │   ├── 12-explore.test.js        # Hottest → Search → Marketplace Banners
│   │   ├── 13-events.test.js         # List → Detail → Participate → Submit → Leaderboard
│   │   ├── 14-marketplace.test.js    # Browse → List → Buy → My NFTs
│   │   ├── 15-expert.test.js         # List → Book Session → Review
│   │   ├── 16-inventory.test.js      # Add → List → Update → Delete → Summary
│   │   ├── 17-news.test.js           # List → Detail → Like → Comment
│   │   ├── 18-catalog.test.js        # Browse → Search → Categories → Trending
│   │   └── 19-subscription.test.js   # Plans listele
│   │
│   ├── flows/                        # Uclararasi (cross-module) akislar
│   │   ├── full-user-journey.test.js # Kayit → Post → Interaction → Mesaj → Wallet
│   │   ├── content-lifecycle.test.js # Post Olustur → Feed'de Gor → Like → Comment → Sil
│   │   └── social-loop.test.js       # Trust → DM → Tip Gonder → Badge Kazan
│   │
│   ├── load/                         # Load & stress test senaryolari
│   │   ├── smoke.test.js             # 1 VU, happy path (saglama testi)
│   │   ├── average-load.test.js      # 50 VU, 5 dakika (normal gunluk yuk)
│   │   ├── stress.test.js            # 100→500 VU ramp-up (stres testi)
│   │   ├── spike.test.js             # 0→1000 VU ani artis (spike testi)
│   │   └── soak.test.js              # 50 VU, 30 dakika (uzun sureli stabilite)
│   │
│   └── data/
│       ├── test-users.json           # Onceden tanimli test kullanicilari
│       └── test-fixtures.json        # Post icerikleri, yorum metinleri, vb.
│
├── k6.config.js                      # k6 global konfigurasyonu
└── run-tests.sh                      # Test calistirma script'i
```

---

## 3. Senaryo Detaylari

> Her senaryo, bir app ekrani veya kullanici akisini temsil eder.
> Endpointler gercek kullanici davranisi sirasina gore siralidir.

---

### Senaryo 01 — Onboarding (Kayit Akisi)

**App Ekrani:** Welcome → Register → Email Verify → Profile Setup

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 1 | `GET` | `/users/username/check?username=testuser` | Username musait mi | `200` + `{ available: true }` |
| 2 | `GET` | `/users/username/suggestions?base=test` | Username onerileri | `200` + suggestions array |
| 3 | `POST` | `/auth/register` | Kayit ol | `201` + user + token |
| 4 | `POST` | `/auth/resend-verification` | Kod tekrar gonder | `200` |
| 5 | `POST` | `/auth/verify-email` | Email dogrula | `200` + verified |
| 6 | `GET` | `/users/avatars` | Avatar secenekleri | `200` + avatars[] |
| 7 | `POST` | `/users/setup-profile` | Profil kur (avatar + banner upload) | `200/201` |
| 8 | `GET` | `/users/categories` | Kategori sec | `200` + categories[] |

**Assertions:**
- Register sonrasi token donmeli
- Yanlis verification code → `400`
- Duplicate email → `409` veya hata mesaji
- Username bosluk/ozel karakter → validation error

---

### Senaryo 02 — Authentication

**App Ekrani:** Login → Home / Forgot Password → Reset

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 1 | `POST` | `/auth/login` | Email + sifre ile giris | `200` + token |
| 2 | `GET` | `/auth/me` | Token ile kullanici bilgisi | `200` + user |
| 3 | `POST` | `/auth/logout` | Cikis (token blacklist) | `200` |
| 4 | `GET` | `/auth/me` | Blacklisted token ile istek | `401` |
| 5 | `POST` | `/auth/forgot-password` | Sifre sifirlama istegi | `200` |
| 6 | `POST` | `/auth/verify-reset-code` | Reset kodu dogrula | `200` |
| 7 | `POST` | `/auth/reset-password` | Yeni sifre belirle | `200` |
| 8 | `POST` | `/auth/login` | Yeni sifre ile giris | `200` + token |

**Negatif Testler:**
- Yanlis sifre → `401`
- Olmayan email → `401/404`
- Bos body → `400` (Zod validation)
- Zayif sifre (register) → `400`
- Rate limit asimi (6+ basarisiz login) → `429`

---

### Senaryo 03 — Profil Yonetimi

**App Ekrani:** Profile → Edit Profile → Settings

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 1 | `GET` | `/users/me/profile` | Kendi profilini gor | `200` + profile |
| 2 | `PUT` | `/users/me/profile` | Profil guncelle (bio, displayName) | `200` |
| 3 | `PUT` | `/users/me/profile` | Avatar/banner yukle (multipart) | `200` |
| 4 | `GET` | `/users/:id/profile` | Baska kullanicinin profili | `200` |
| 5 | `GET` | `/users/:id/profile-card` | Profil karti | `200` |
| 6 | `GET` | `/users/:id/feed` | Kullanici postlari | `200` |
| 7 | `GET` | `/users/:id/reviews` | Kullanici reviewlari | `200` |
| 8 | `GET` | `/users/:id/benchmarks` | Kullanici benchmarklari | `200` |
| 9 | `GET` | `/users/:id/tips` | Kullanici tipleri | `200` |
| 10 | `GET` | `/users/:id/questions` | Kullanici sorulari | `200` |
| 11 | `GET` | `/users/:id/bookmarks` | Bookmarklar (sadece kendi) | `200` |

**Settings Alt-Akisi:**

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 12 | `POST` | `/users/settings/change-password` | Sifre degistir | `200` |
| 13 | `GET` | `/users/settings/notifications` | Bildirim ayarlari | `200` |
| 14 | `PUT` | `/users/settings/notifications` | Bildirim ayari guncelle | `200` |
| 15 | `GET` | `/users/settings/privacy` | Gizlilik ayarlari | `200` |
| 16 | `PUT` | `/users/settings/privacy` | Gizlilik guncelle | `200` |
| 17 | `GET` | `/users/settings/devices` | Bagli cihazlar | `200` |
| 18 | `DELETE` | `/users/settings/devices/:deviceId` | Cihaz kaldir | `200` |
| 19 | `GET` | `/users/settings/payment-dashboard` | Odeme dashboard | `200` |
| 20 | `POST` | `/users/settings/payment-methods` | Odeme yontemi ekle | `201` |
| 21 | `PATCH` | `/users/settings/payment-methods/:id` | Odeme yontemi guncelle | `200` |
| 22 | `DELETE` | `/users/settings/payment-methods/:id` | Odeme yontemi sil | `200` |
| 23 | `GET` | `/users/settings/invoices` | Faturalar | `200` |
| 24 | `GET` | `/users/settings/support-session-price` | Destek oturum fiyati | `200` |
| 25 | `PUT` | `/users/settings/support-session-price` | Fiyat guncelle | `200` |

---

### Senaryo 04 — Post Olusturma

**App Ekrani:** Create Post (Tab bazli: Tip, Question, Benchmark, Experience, Update)

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 1 | `POST` | `/posts/tips-and-tricks` | Tip & Tricks postu | `201` + post |
| 2 | `POST` | `/posts/question` | Soru postu | `201` + post |
| 3 | `POST` | `/posts/benchmark` | Benchmark postu (karsilastirma) | `201` + post |
| 4 | `POST` | `/posts/experience` | Deneyim postu | `201` + post |
| 5 | `POST` | `/posts/update` | Guncelleme postu | `201` + post |
| 6 | `POST` | `/posts/` | Genel post (gorsel ile, multipart) | `201` + post |
| 7 | `GET` | `/posts/:id` | Olusturdugumuz postu gor | `200` + post detail |
| 8 | `PATCH` | `/posts/:id` | Postu duzenle | `200` |
| 9 | `GET` | `/posts/drafts` | Taslaklar | `200` + drafts[] |
| 10 | `POST` | `/posts/:id/publish` | Taslak yayinla | `200` |
| 11 | `POST` | `/posts/:id/split-experience` | Experience bol | `200` |
| 12 | `DELETE` | `/posts/:id` | Post sil | `200` |

**Assertions:**
- Bos title → `400`
- Cok uzun body (>10000 char) → `400`
- Gorsel yuklemede yanlis format → `400`
- Auth olmadan post → `401`
- Baskasinin postunu silme → `403`

---

### Senaryo 05 — Feed

**App Ekrani:** Home Feed → Filter → Pull to Refresh

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 1 | `GET` | `/feed/` | Ana feed (ilk sayfa) | `200` + items[] |
| 2 | `GET` | `/feed/?cursor=xxx` | Sonraki sayfa (pagination) | `200` + items[] |
| 3 | `GET` | `/feed/filtered?type=tip` | Tip filtresi | `200` + filtered items |
| 4 | `GET` | `/feed/filtered?type=question` | Soru filtresi | `200` |
| 5 | `POST` | `/feed/seen` | Goruldu isaretle | `200` |
| 6 | `POST` | `/feed/:feedId/hide` | Postu gizle | `200` |
| 7 | `POST` | `/feed/:feedId/not-interested` | Ilgilenmiyorum | `200` |
| 8 | `POST` | `/feed/:feedId/save` | Kaydet | `200` |
| 9 | `POST` | `/feed/:feedId/report` | Sikayet et | `200` |
| 10 | `GET` | `/feed/source-counts` | Feed kaynak istatistikleri | `200` |

---

### Senaryo 06 — Post Interaction (Etkilesim)

**App Ekrani:** Post Detail → Like → Comment → Share → Bookmark

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 1 | `POST` | `/interactions/posts/:postId/like` | Begeni | `200/201` |
| 2 | `DELETE` | `/interactions/posts/:postId/like` | Begeni kaldir | `200` |
| 3 | `POST` | `/interactions/posts/:postId/bookmark` | Yer imi ekle | `200/201` |
| 4 | `DELETE` | `/interactions/posts/:postId/bookmark` | Yer imi kaldir | `200` |
| 5 | `GET` | `/interactions/posts/:postId/comments` | Yorumlari getir | `200` + comments[] |
| 6 | `POST` | `/interactions/posts/:postId/comment` | Yorum yaz | `201` + comment |
| 7 | `PUT` | `/interactions/comments/:commentId` | Yorum duzenle | `200` |
| 8 | `DELETE` | `/interactions/comments/:commentId` | Yorum sil | `200` |
| 9 | `POST` | `/interactions/posts/:postId/share` | Paylas | `200/201` |
| 10 | `DELETE` | `/interactions/posts/:postId/share` | Paylasimi kaldir | `200` |
| 11 | `POST` | `/interactions/share-history` | Paylasim gecmisi | `200` |
| 12 | `POST` | `/interactions/posts/:postId/react` | Emoji tepki | `200/201` |
| 13 | `GET` | `/interactions/posts/:postId/reactions` | Tepkileri getir | `200` |
| 14 | `DELETE` | `/interactions/posts/:postId/react` | Tepki kaldir | `200` |

**Negatif Testler:**
- Ayni posta iki kez like → idempotent veya `409`
- Olmayan post'a like → `404`
- Bos yorum → `400`

---

### Senaryo 07 — Sosyal Iliskiler

**App Ekrani:** User Profile → Trust/Block/Mute/Report

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 1 | `POST` | `/users/trust` | Kullaniciyi guven listesine ekle | `200/201` |
| 2 | `GET` | `/users/:id/trusts` | Guvendigi kisiler | `200` + users[] |
| 3 | `GET` | `/users/:id/trusters` | Guvenenlerin listesi | `200` + users[] |
| 4 | `DELETE` | `/users/trusts/:targetUserId` | Guveni kaldir | `200` |
| 5 | `POST` | `/users/:id/block/:targetUserId` | Engelle | `200` |
| 6 | `DELETE` | `/users/:id/block/:targetUserId` | Engeli kaldir | `200` |
| 7 | `POST` | `/users/:id/mute/:targetUserId` | Sessize al | `200` |
| 8 | `DELETE` | `/users/:id/mute/:targetUserId` | Sessizi kaldir | `200` |
| 9 | `POST` | `/users/:id/report/:targetUserId` | Sikayet et | `200` |
| 10 | `GET` | `/users/suggested` | Onerilen kullanicilar | `200` + users[] |

**Cross-Check:**
- Engellenen kullanicinin postlari feed'de gorunmemeli
- Engellenince DM gonderilemez olmali

---

### Senaryo 08 — Inbox (Mesajlasma)

**App Ekrani:** Inbox List → Thread → Send Message → React

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 1 | `GET` | `/inbox/` | Mesaj listesi (threadler) | `200` + threads[] |
| 2 | `POST` | `/inbox/message` | Yeni DM gonder (thread olusur) | `201` |
| 3 | `GET` | `/inbox/thread/:threadId` | Thread mesajlari | `200` + messages[] |
| 4 | `POST` | `/inbox/thread/:threadId/message` | Thread'e mesaj gonder | `201` |
| 5 | `PUT` | `/inbox/message/:messageId/read` | Okundu isaretle | `200` |
| 6 | `POST` | `/inbox/message/:messageId/react` | Mesaja tepki ver | `200` |
| 7 | `DELETE` | `/inbox/message/:messageId/react` | Tepki kaldir | `200` |
| 8 | `DELETE` | `/inbox/message/:messageId` | Mesaj sil | `200` |
| 9 | `POST` | `/inbox/thread/:threadId/mute` | Thread'i sessize al | `200` |
| 10 | `POST` | `/inbox/thread/:threadId/unmute` | Sessizi kaldir | `200` |
| 11 | `PUT` | `/inbox/thread/:threadId/read` | Thread okundu | `200` |
| 12 | `POST` | `/inbox/thread/:threadId/block` | Engelle | `200` |
| 13 | `DELETE` | `/inbox/thread/:threadId` | Thread sil | `200` |

**2-Kullanici Senaryosu:**
- User A mesaj gonderir → User B inbox'inda gormeli
- User B okur → okundu durumu guncellenmeli
- User A engellenir → mesaj gonderilemez olmali

---

### Senaryo 09 — Bildirimler

**App Ekrani:** Notification Bell → List → Detail

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 1 | `GET` | `/notifications/unread-count` | Okunmamis sayi | `200` + count |
| 2 | `GET` | `/notifications/` | Bildirim listesi | `200` + notifications[] |
| 3 | `PUT` | `/notifications/:id/read` | Okundu isaretle | `200` |
| 4 | `PUT` | `/notifications/mark-all-read` | Tumunu oku | `200` |
| 5 | `DELETE` | `/notifications/:id` | Bildirimi sil | `200` |
| 6 | `GET` | `/notifications/settings` | Bildirim ayarlari | `200` |
| 7 | `PUT` | `/notifications/settings` | Ayar guncelle | `200` |
| 8 | `POST` | `/notifications/push-token` | Push token kaydet | `200` |
| 9 | `DELETE` | `/notifications/push-token` | Push token sil | `200` |

**Cross-Module Check:**
- Post like → bildirim olusur mu
- Yorum → bildirim olusur mu
- DM → bildirim olusur mu

---

### Senaryo 10 — Wallet & Transactions

**App Ekrani:** Wallet → Balance → Send Tip → History

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 1 | `GET` | `/wallets/` | Wallet listesi | `200` |
| 2 | `POST` | `/wallets/create` | Yeni wallet olustur | `201` |
| 3 | `POST` | `/wallets/connect` | Wallet bagla | `200` |
| 4 | `GET` | `/wallets/active` | Aktif wallet | `200` |
| 5 | `GET` | `/wallets/balance` | Bakiye sorgula | `200` + balance |
| 6 | `GET` | `/wallets/info` | Wallet bilgisi | `200` |
| 7 | `GET` | `/wallets/nfts` | NFT'ler | `200` |
| 8 | `GET` | `/wallets/transactions` | Wallet islemleri | `200` |
| 9 | `PATCH` | `/wallets/:id/activate` | Wallet aktif et | `200` |
| 10 | `POST` | `/transactions/send-tip` | Tip gonder | `200/201` |
| 11 | `GET` | `/transactions/history` | Islem gecmisi | `200` |
| 12 | `GET` | `/transactions/history/grouped` | Gruplu gecmis | `200` |
| 13 | `GET` | `/transactions/:id` | Islem detayi | `200` |
| 14 | `POST` | `/transactions/:id/cancel` | Islem iptal | `200` |

**Rewards Alt-Akisi:**

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 15 | `GET` | `/wallets/rewards/summary` | Odul ozeti | `200` |
| 16 | `GET` | `/wallets/rewards/claimable` | Talep edilebilir oduller | `200` |
| 17 | `GET` | `/wallets/rewards/source/:sourceType` | Kaynak bazli odul | `200` |
| 18 | `POST` | `/wallets/rewards/claim/:rewardId` | Odul talep et | `200` |
| 19 | `POST` | `/wallets/rewards/claim-all` | Tum odulleri talep et | `200` |
| 20 | `GET` | `/wallets/rewards/history` | Odul gecmisi | `200` |
| 21 | `POST` | `/wallets/pending-tips/claim` | Bekleyen tipleri al | `200` |

---

### Senaryo 11 — Gamification

**App Ekrani:** Profile → Badges → Collections → Achievements

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 1 | `GET` | `/api/gamification/badges` | Tum badge'ler (public) | `200` + badges[] |
| 2 | `GET` | `/api/gamification/badges/:id` | Badge detay (public) | `200` + badge |
| 3 | `GET` | `/api/gamification/collections` | Koleksiyonlar (public) | `200` |
| 4 | `GET` | `/api/gamification/collections/:id` | Koleksiyon detay (public) | `200` |
| 5 | `GET` | `/api/gamification/profile/badges` | Kullanici badge'leri | `200` |
| 6 | `POST` | `/api/gamification/profile/badges/:badgeId/claim` | Badge talep et | `200` |
| 7 | `PUT` | `/api/gamification/profile/badges/:id/visibility` | Gorunurluk degistir | `200` |
| 8 | `PUT` | `/api/gamification/profile/badges/display-order` | Siralama degistir | `200` |
| 9 | `GET` | `/api/gamification/profile/achievements` | Basarimlar | `200` |
| 10 | `GET` | `/api/gamification/profile/gamification-stats` | Istatistikler | `200` |
| 11 | `GET` | `/api/gamification/profile/near-completion` | Yakin hedefler | `200` |

**Collections Ekrani:**

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 12 | `GET` | `/collections/` | Koleksiyon listesi | `200` |
| 13 | `GET` | `/collections/categories` | Kategoriler | `200` |
| 14 | `GET` | `/collections/:collectionId` | Koleksiyon detay | `200` |
| 15 | `POST` | `/collections/badges/:badgeId/reminder` | Hatirlatici kur | `200` |

**User Collections:**

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 16 | `GET` | `/users/:id/collections/achievements` | Kullanici basarimlari | `200` |
| 17 | `GET` | `/users/:id/collections/bridges` | Kullanici NFT koleksiyonlari | `200` |
| 18 | `POST` | `/users/collections/achievements/claim` | Basarim talep | `200` |
| 19 | `POST` | `/users/collections/achievements/:badgeId/claim` | Spesifik basarim | `200` |
| 20 | `POST` | `/users/collections/bridges/:badgeId/claim` | NFT talep | `200` |

---

### Senaryo 12 — Explore & Search

**App Ekrani:** Explore Tab → Trending → Search

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 1 | `GET` | `/explore/hottest` | En populer icerikler | `200` |
| 2 | `GET` | `/explore/marketplace-banners` | Marketplace bannerlari (public) | `200` |
| 3 | `GET` | `/explore/events` | Yenilikler / events (public) | `200` |
| 4 | `GET` | `/explore/brands/new` | Yeni markalar (public) | `200` |
| 5 | `GET` | `/explore/products/new` | Yeni urunler (public) | `200` |
| 6 | `GET` | `/explore/search?q=iphone` | Arama | `200` + results |
| 7 | `GET` | `/search/?q=test` | Global arama (public) | `200` + results |
| 8 | `GET` | `/posts/trending` | Trending postlar | `200` |

---

### Senaryo 13 — Events

**App Ekrani:** Events List → Detail → Participate → Submit → Leaderboard

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 1 | `GET` | `/events/` | Event listesi (public) | `200` + events[] |
| 2 | `GET` | `/events/:eventId` | Event detay (public) | `200` + event |
| 3 | `POST` | `/events/:eventId/participate` | Katil | `200` |
| 4 | `GET` | `/events/:eventId/participants` | Katilimcilar (public) | `200` |
| 5 | `POST` | `/events/:eventId/submit` | Icerik gonder | `201` |
| 6 | `GET` | `/events/:eventId/submissions` | Gonderiler (public) | `200` |
| 7 | `GET` | `/events/:eventId/leaderboard` | Skor tablosu (public) | `200` |
| 8 | `GET` | `/events/:eventId/rewards` | Oduller (public) | `200` |

---

### Senaryo 14 — Marketplace

**App Ekrani:** Marketplace → Browse → Buy → Sell → My Listings

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 1 | `GET` | `/marketplace/listings` | NFT listelemeleri (public) | `200` |
| 2 | `GET` | `/marketplace/my-nfts` | Benim NFT'lerim | `200` |
| 3 | `GET` | `/marketplace/available-nfts` | Satisa uygun NFT'ler | `200` |
| 4 | `GET` | `/marketplace/sell/:nftId` | Satis detay | `200` |
| 5 | `GET` | `/marketplace/sell/:nftId/detail` | Satis detay (genisletilmis) | `200` |
| 6 | `POST` | `/marketplace/listings` | NFT listeleme olustur | `201` |
| 7 | `PUT` | `/marketplace/listings/:listingId/price` | Fiyat guncelle | `200` |
| 8 | `POST` | `/marketplace/buy` | NFT satin al | `200` |
| 9 | `GET` | `/marketplace/my-listings` | Benim listelelerim | `200` |
| 10 | `DELETE` | `/marketplace/listings/:listingId` | Listelemeyi sil | `200` |

---

### Senaryo 15 — Expert / Support Sessions

**App Ekrani:** Expert List → Profile → Book → Review

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 1 | `GET` | `/expert/` | Uzman listesi (public) | `200` |
| 2 | `GET` | `/expert/:expertId` | Uzman profili (public) | `200` |
| 3 | `GET` | `/expert/reviews` | Uzman degerlendirmeleri (public) | `200` |
| 4 | `POST` | `/expert/register` | Uzman olarak kayit ol | `200/201` |
| 5 | `PATCH` | `/expert/:expertId/availability` | Musaitlik guncelle (expert) | `200` |
| 6 | `POST` | `/expert/session/book` | Oturum rezerve et | `201` |
| 7 | `GET` | `/expert/my-sessions` | Rezervasyonlarim | `200` |
| 8 | `GET` | `/expert/session/:sessionId` | Oturum detay | `200` |
| 9 | `PATCH` | `/expert/session/:sessionId/status` | Oturum durumu guncelle | `200` |
| 10 | `POST` | `/expert/:expertId/review` | Degerlendirme yap | `201` |

---

### Senaryo 16 — Inventory

**App Ekrani:** My Inventory → Add → Edit → Delete

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 1 | `GET` | `/inventory/` | Envanter listesi | `200` |
| 2 | `GET` | `/inventory/summary` | Envanter ozeti | `200` |
| 3 | `POST` | `/inventory/` | Urun ekle | `201` |
| 4 | `POST` | `/inventory/batch-add` | Toplu ekle | `201` |
| 5 | `PATCH` | `/inventory/:itemId` | Guncelle | `200` |
| 6 | `DELETE` | `/inventory/:itemId` | Sil | `200` |

---

### Senaryo 17 — News

**App Ekrani:** News Feed → Detail → Like → Comment

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 1 | `GET` | `/news/` | Haber listesi (public) | `200` + news[] |
| 2 | `GET` | `/news/:newsId` | Haber detay (public) | `200` + news |
| 3 | `POST` | `/news/:newsId/like` | Haberi begen | `200` |
| 4 | `DELETE` | `/news/:newsId/like` | Begeni kaldir | `200` |
| 5 | `POST` | `/news/:newsId/comment` | Yorum yap | `201` |
| 6 | `DELETE` | `/news/comment/:commentId` | Yorum sil | `200` |

---

### Senaryo 18 — Catalog & Brands

**App Ekrani:** Catalog Browse → Product Detail → Brand

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 1 | `GET` | `/catalog/` | Urun katalogu (public) | `200` |
| 2 | `GET` | `/catalog/categories` | Kategoriler (public) | `200` |
| 3 | `GET` | `/catalog/trending` | Trend urunler (public) | `200` |
| 4 | `GET` | `/catalog/search?q=phone` | Urun arama (public) | `200` |
| 5 | `GET` | `/catalog/:productId` | Urun detay (public) | `200` |
| 6 | `GET` | `/brand/` | Marka listesi (public) | `200` |
| 7 | `GET` | `/brand/:brandId` | Marka detay (public) | `200` |
| 8 | `GET` | `/brand/:brandId/products` | Marka urunleri (public) | `200` |
| 9 | `POST` | `/brand/register` | Marka kayit | `201` |
| 10 | `PATCH` | `/brand/:brandId` | Marka guncelle (owner) | `200` |

---

### Senaryo 19 — Subscription & Survey

**App Ekrani:** Plans → Survey

| Adim | Method | Endpoint | Aciklama | Beklenen |
|------|--------|----------|----------|----------|
| 1 | `GET` | `/subscription/plans` | Abonelik planlari | `200` + plans[] |
| 2 | `GET` | `/survey/` | Anket listesi (public) | `200` |
| 3 | `POST` | `/survey/:surveyId/participate` | Ankete katil | `200` |
| 4 | `POST` | `/survey/:surveyId/submit` | Anket cevapla | `200` |

---

## 4. Cross-Module E2E Akislar (Flows)

> Birden fazla modulu kapsayan, gercek kullanici yolculugunu simule eden akislar.

---

### Flow 1 — Full User Journey (Tam Kullanici Yolculugu)

```
Register → Verify Email → Setup Profile → Browse Feed → Create Post
→ Receive Like Notification → Reply Comment → Send DM → Send Tip
→ Claim Badge → View Achievements
```

**Adimlar:**
1. `POST /auth/register` — Kayit
2. `POST /auth/verify-email` — Dogrulama
3. `POST /users/setup-profile` — Profil kurulumu
4. `GET /feed/` — Feed'i gor
5. `POST /posts/tips-and-tricks` — Post olustur
6. *(User B)* `POST /interactions/posts/:postId/like` — Like at
7. `GET /notifications/` — Bildirim kontrol
8. `POST /interactions/posts/:postId/comment` — Yorum yap
9. `POST /inbox/message` — DM gonder
10. `POST /wallets/create` — Wallet olustur
11. `POST /transactions/send-tip` — Tip gonder
12. `GET /api/gamification/profile/badges` — Badge kontrol
13. `POST /api/gamification/profile/badges/:badgeId/claim` — Badge talep

---

### Flow 2 — Content Lifecycle (Icerik Yasam Dongusu)

```
Create Post → Appears in Feed → Gets Interactions → Author Sees Stats → Delete Post
```

1. `POST /posts/tips-and-tricks` — Post olustur
2. *(User B)* `GET /feed/` — Feed'de post gorulur
3. *(User B)* `POST /interactions/posts/:postId/like` — Like
4. *(User B)* `POST /interactions/posts/:postId/comment` — Yorum
5. *(User B)* `POST /interactions/posts/:postId/share` — Paylas
6. `GET /posts/:id` — Post detay (like/comment sayilari)
7. `DELETE /posts/:id` — Post sil
8. *(User B)* `GET /feed/` — Post artik gorunmez

---

### Flow 3 — Social Loop (Sosyal Dongu)

```
Discover User → Trust → DM → Tip → Badge Earned
```

1. `GET /users/suggested` — Onerilen kullanici bul
2. `GET /users/:id/profile` — Profil incele
3. `POST /users/trust` — Guven listesine ekle
4. `POST /inbox/message` — DM gonder
5. `GET /inbox/thread/:threadId` — Thread gor
6. `POST /transactions/send-tip` — Tip gonder
7. `GET /api/gamification/profile/near-completion` — Yakin hedefler

---

## 5. Load & Stress Test Senaryolari

### 5.1 Smoke Test (Duman Testi)

**Amac:** Sistemin ayakta ve temel fonksiyonlarin calistigini dogrulama
```
VU: 1
Sure: 30 saniye
Senaryo: Login → Feed → Post Detail → Logout
Threshold: %0 hata, p95 < 2s
```

### 5.2 Average Load (Normal Yuk)

**Amac:** Gunluk ortalama kullanim simulasyonu
```
VU: 50 sanal kullanici
Sure: 5 dakika
Ramp-up: 30sn icinde 0→50 VU
Senaryo: Karisik (Feed %40, Post %20, Interaction %20, Profile %10, Inbox %10)
Threshold: p95 < 500ms, hata orani < %1
```

### 5.3 Stress Test (Stres Testi)

**Amac:** Sistemin sinirlarini bulmak
```
VU: 100 → 200 → 500 (kademeli artis)
Sure: 15 dakika
Ramp-up: Her kademe 3 dakika
Threshold: p95 < 2s, hata orani < %5
```

### 5.4 Spike Test (Ani Artis)

**Amac:** Ani kullanici patlamasinda sistem davranisi
```
VU: 0 → 1000 (1 dakikada)
Sure: 5 dakika
Senaryo: Sadece GET endpointleri (Feed + Explore + Profile)
Threshold: Sistem crash olmamali, recovery 2dk icinde
```

### 5.5 Soak Test (Dayaniklilik)

**Amac:** Uzun sureli stabilite (memory leak, connection leak tespiti)
```
VU: 50
Sure: 30 dakika (veya daha uzun)
Senaryo: Full karisik akis
Threshold: Response time trend artmamali, memory kullanimi stabil kalmali
```

---

## 6. k6 Threshold & Metrikler

### Varsayilan Threshold'lar

```javascript
export const thresholds = {
  // Response time
  http_req_duration: ['p(95)<500', 'p(99)<1500'],

  // Error rate
  http_req_failed: ['rate<0.01'],     // <%1 hata

  // Throughput
  http_reqs: ['rate>100'],            // Saniyede 100+ istek

  // Ozel metrikler
  'login_duration': ['p(95)<1000'],
  'feed_load_duration': ['p(95)<800'],
  'post_create_duration': ['p(95)<1500'],
  'dm_send_duration': ['p(95)<500'],
};
```

### Izlenecek Metrikler

| Metrik | Aciklama | Hedef |
|--------|----------|-------|
| `http_req_duration` | Istek suresi | p95 < 500ms |
| `http_req_failed` | Basarisiz istek orani | < %1 |
| `http_reqs` | Saniye basina istek | > 100 rps |
| `http_req_waiting` | Server isleme suresi (TTFB) | p95 < 300ms |
| `http_req_connecting` | TCP baglanti suresi | p95 < 50ms |
| `iterations` | Tamamlanan senaryo sayisi | - |
| `vus` | Aktif sanal kullanici | - |
| `data_received` | Alinan veri | - |
| `data_sent` | Gonderilen veri | - |

---

## 7. Test Verisi Stratejisi

### Test Kullanicilari

```json
{
  "users": [
    { "email": "e2e-user-1@tipbox.test", "password": "TestPass123!", "role": "user" },
    { "email": "e2e-user-2@tipbox.test", "password": "TestPass123!", "role": "user" },
    { "email": "e2e-user-3@tipbox.test", "password": "TestPass123!", "role": "user" },
    { "email": "e2e-expert@tipbox.test", "password": "TestPass123!", "role": "expert" },
    { "email": "e2e-brand@tipbox.test", "password": "TestPass123!", "role": "brand" }
  ]
}
```

### Veri Hazirlama Secenekleri

| Yontem | Aciklama | Ne Zaman |
|--------|----------|----------|
| **Seed Script** | `POST /api/seeds/` ile test verisi uret | Test oncesi (setup) |
| **Register Flow** | Her test baslangicinda kullanici olustur | Onboarding testi |
| **Fixture Data** | Onceden hazirlanmis JSON dosyalari | Load testlerde |

### Temizlik

- Her test suite sonunda olusturulan verileri temizle (veya ayri test DB kullan)
- `POST /dashboard/clear-test-data` endpoint'i mevcut — kullanilabilir
- Alternatif: Test kullanicilarini `e2e-` prefix'i ile ayirt et, toplu sil

---

## 8. Calistirma Komutlari

### Tek Senaryo Calistirma

```bash
# Fonksiyonel E2E — Onboarding senaryosu
k6 run tests/e2e/scenarios/01-onboarding.test.js \
  -e BASE_URL=http://localhost:3000

# Fonksiyonel E2E — Tum senaryolar (sirayla)
k6 run tests/e2e/flows/full-user-journey.test.js \
  -e BASE_URL=http://localhost:3000
```

### Load Test Calistirma

```bash
# Smoke test
k6 run tests/e2e/load/smoke.test.js \
  -e BASE_URL=http://localhost:3000

# Average load (50 kullanici)
k6 run tests/e2e/load/average-load.test.js \
  -e BASE_URL=http://localhost:3000

# Stress test (100-500 kullanici)
k6 run tests/e2e/load/stress.test.js \
  -e BASE_URL=http://localhost:3000

# Spike test (1000 kullanici)
k6 run tests/e2e/load/spike.test.js \
  -e BASE_URL=http://localhost:3000
```

### Rapor Cikartma

```bash
# HTML rapor
k6 run tests/e2e/load/average-load.test.js \
  --out json=results.json \
  -e BASE_URL=http://localhost:3000

# Grafana Cloud'a gonder (opsiyonel)
k6 run tests/e2e/load/stress.test.js \
  --out cloud \
  -e BASE_URL=http://localhost:3000
```

---

## 9. Negatif Test Checklisti

> Her senaryo icin uygulanmasi gereken negatif testler.

| # | Test | Beklenen | Ilgili Senaryo |
|---|------|----------|----------------|
| 1 | Token olmadan protected EP | `401 Unauthorized` | Tumu |
| 2 | Gecersiz/expire token | `401 Unauthorized` | Tumu |
| 3 | Bos body (POST/PUT) | `400 Bad Request` (Zod) | Post, Auth, Settings |
| 4 | Olmayan resource ID | `404 Not Found` | Post, Comment, Thread |
| 5 | Baskasinin kaynagini silme | `403 Forbidden` | Post, Comment, Message |
| 6 | Duplicate islem (cift like) | Idempotent veya `409` | Interaction |
| 7 | Rate limit asimi | `429 Too Many Requests` | Auth login |
| 8 | Cok buyuk payload (>10MB) | `413 Payload Too Large` | File upload |
| 9 | Yanlis Content-Type | `400/415` | File upload |
| 10 | SQL injection denemesi | `400` (Zod blokladi) | Search, arama alanlari |
| 11 | XSS payload | Sanitize edilmis output | Post body, comment |
| 12 | Gecersiz pagination cursor | `400` veya bos sonuc | Feed, lists |

---

## 10. Oncelik Sirasi (Implementation Roadmap)

### Faz 1 — Temel Altyapi (1-2 gun)
- [ ] k6 kurulumu ve dosya yapisi
- [ ] Auth helper (login, token yonetimi)
- [ ] Config (BASE_URL, thresholds, test users)
- [ ] Smoke test (temel akis)

### Faz 2 — Core Senaryolar (3-5 gun)
- [ ] Senaryo 01: Onboarding
- [ ] Senaryo 02: Authentication
- [ ] Senaryo 03: Profile
- [ ] Senaryo 04: Post Creation
- [ ] Senaryo 05: Feed
- [ ] Senaryo 06: Interaction
- [ ] Senaryo 08: Inbox

### Faz 3 — Tam Kapsam (3-5 gun)
- [ ] Senaryo 07: Social
- [ ] Senaryo 09: Notification
- [ ] Senaryo 10: Wallet & Transactions
- [ ] Senaryo 11: Gamification
- [ ] Senaryo 12: Explore & Search
- [ ] Senaryo 13-19: Events, Marketplace, Expert, vb.

### Faz 4 — Cross-Module & Load (2-3 gun)
- [ ] Flow 1: Full User Journey
- [ ] Flow 2: Content Lifecycle
- [ ] Flow 3: Social Loop
- [ ] Average Load test
- [ ] Stress test
- [ ] Spike test

### Faz 5 — CI/CD Entegrasyonu (1 gun)
- [ ] GitHub Actions / CI pipeline'a smoke test ekle
- [ ] Scheduled load test (haftalik)
- [ ] Rapor cikartma ve alerting

---

*Son Guncelleme: 2026-03-01*
