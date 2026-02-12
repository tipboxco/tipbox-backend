# Admin User Detail — UX Kararı ve Ek Endpoint'ler

Bu doküman iki konuyu ele alır: (1) **Profil resmi, katıldığı etkinlikler, badge'ler, cüzdan/tips** gibi bilgilerin admin panelde **nerede** görüntülenip yönetileceği (User Detail mi, Event/Wallet sayfası mı); (2) Bu görünümü desteklemek için gereken **ek User-scoped admin endpoint'leri**.

---

## 1. UX ve yerleşim kararı: Nerede gösterilmeli / yönetilmeli?

### Seçenekler

| Yaklaşım | Açıklama | Artı / Eksi |
|----------|----------|-------------|
| **A) Tamamen kullanıcı merkezli** | Tüm bilgiler (avatar, event’ler, badge’ler, cüzdan) sadece User Detail sayfasında. | Tek ekranda “bu kullanıcı” özeti; Event/Wallet sayfaları sadece liste. Yönetim tek yerde toplanır ama sayfa şişer, event/wallet operasyonları zayıf kalabilir. |
| **B) Tamamen bağlam merkezli** | Avatar/event/badge/wallet sadece Event veya Wallet sayfalarında; User Detail’da sadece temel profil. | Event/Wallet odaklı yönetim güçlü; “bu kullanıcının her şeyi” görmek için sayfalar arası gezinmek gerekir. |
| **C) Hibrit (önerilen)** | **User Detail = kimlik merkezi:** Kullanıcıya ait özetler (avatar, katıldığı event’ler, badge’ler, cüzdan/tips özeti) burada; gerektiği yerde **yönetim** (avatar güncelleme, badge ver/al) da User Detail’da. Event/Wallet sayfaları **bağlam odaklı** (bir event’in katılımcıları, bir cüzdanın işlemleri) ve “Kullanıcıya git” linki ile User Detail’a bağlanır. | Hem “bu kullanıcı” hem “bu event / bu cüzdan” akışları tatmin edilir; endüstri pratiği ile uyumlu. |

### Endüstri pratiği (Stripe, Auth0, Firebase, AWS IAM vb.)

- **Kullanıcı / müşteri detay sayfası** “identity hub” olarak kullanılır: Profil, güvenlik, aktivite, abonelikler, ödemeler gibi **kullanıcıya ait** her şey sekmeler veya bloklar halinde burada; listeler read-only veya “Detay” ile ilgili sayfaya (Event, Wallet) gider.
- **Bağlam sayfaları** (ör. Event detay, Wallet/Transaction listesi) **kapsam öncelikli** kullanılır: “Bu event’in katılımcıları”, “Bu cüzdanın bakiyesi”. Bu sayfalarda “Kullanıcıya git” ile User Detail’a gidilir.
- **Yönetim aksiyonları:** Kullanıcıya özel (avatar değiştir, badge ver/al) genelde User Detail’da; event’e özel (event’e badge ekle/çıkar) Event sayfasında; wallet’a özel (işlem iptali vb.) Wallet/Finance sayfasında tutulur.

### Öneri: Hibrit (C)

- **User Detail (UserDetail.tsx):**
  - **Görüntüleme:** Profil (mevcut), **profil resmi (avatar)** özeti ve güncelleme, **katıldığı event’ler** (liste, event adına tıklanınca Event sayfasına), **badge’ler** (liste, gerekirse grant/revoke), **cüzdan/tips özeti** (bakiye, toplam alınan/verilen tips, son işlemler veya “Tümünü gör” ile Wallet sayfasına).
  - **Yönetim:** Avatar güncelleme (URL veya upload), gerekirse kullanıcıya badge verme/alma.
- **Event sayfası (admin):** Event’e katılan kullanıcı listesi, event badge’leri, event ödülleri; satırda “Kullanıcıya git” → User Detail.
- **Wallet/Finance sayfası (admin):** Cüzdan listesi, bakiye, işlemler; kullanıcıya göre filtre ve “Kullanıcıya git” → User Detail.

Böylece User Detail’da “bu kullanıcının her şeyi” görülür ve gerekli yerlerde yönetilir; Event ve Wallet sayfaları kendi bağlamında kalır ve User Detail ile çapraz bağlantı sağlanır.

---

## 2. User Detail için ek endpoint'ler

Aşağıdakilerin tamamı **Admin auth** (`authMiddleware` + `requireAdmin`) ile korunacak; path’ler `/admin/users/:id/...` altında.

### 2.1 Profil resmi (Avatar)

| Metod | Path | Açıklama |
|-------|------|----------|
| GET | `/admin/users/:id/avatar` | Kullanıcının aktif avatar bilgisi (UserAvatar: id, imageUrl, isActive, createdAt). Yoksa 204 veya null. |
| PATCH | `/admin/users/:id/avatar` | Aktif avatar’ı güncelle: mevcut bir UserAvatar kaydının `imageUrl`’ini değiştir veya `isActive` değiştir. Body: `imageUrl?`, `avatarId?` (hangi kaydın aktif yapılacağı). |
| POST | `/admin/users/:id/avatar` | Yeni avatar ekle (örn. imageUrl ile); isActive=true yapıp diğerlerini false yapabilir. Body: `imageUrl` (required). Upload için ayrı media EP kullanılabilir. |

**Not:** Upload akışı varsa: Admin panel önce dosyayı mevcut media/upload EP’ine atar, dönen URL ile POST/PATCH avatar çağrılır.

---

### 2.2 Katıldığı etkinlikler (Events)

| Metod | Path | Açıklama |
|-------|------|----------|
| GET | `/admin/users/:id/events` | Kullanıcının katıldığı event’ler (EventStats tabanlı). Query: `limit`, `offset`, `sort` (eventPostsCount \| eventLikesReceived \| createdAt), `order`. Response: eventId, event title (Event join), event status, startDate/endDate, eventPostsCount, eventLikesReceived, totalParticipated, createdAt. Sayfalı. |

**Yönetim:** Event’e özel aksiyonlar (katılımcı çıkar, event badge ata vb.) admin **Event** sayfasında kalır; User Detail sadece listeyi gösterir ve “Event’e git” linki verir.

---

### 2.3 Badge’ler (User Badges)

| Metod | Path | Açıklama |
|-------|------|----------|
| GET | `/admin/users/:id/badges` | Kullanıcının sahip olduğu badge’ler (UserBadge + Badge bilgisi). Query: `limit`, `offset`, `claimed` (true/false). Response: UserBadge id, badgeId, badge name/imageUrl/rarity/category, isVisible, displayOrder, visibility, claimed, claimedAt, createdAt. Sayfalı. |
| POST | `/admin/users/:id/badges` | Kullanıcıya badge ver (UserBadge oluştur). Body: `badgeId`, `isVisible?`, `displayOrder?`, `visibility?`. AdminLog: USER_BADGE_GRANT. |
| DELETE | `/admin/users/:id/badges/:userBadgeId` | Kullanıcıdan badge al (UserBadge sil veya soft revoke). AdminLog: USER_BADGE_REVOKE. |

**Yönetim:** Badge verme/alma doğrudan “bu kullanıcı” bağlamında olduğu için User Detail’da yapılması mantıklı; Event’e özel event badge’leri ise Event sayfasında kalır.

---

### 2.4 Cüzdan ve Tips

| Metod | Path | Açıklama |
|-------|------|----------|
| GET | `/admin/users/:id/wallet` | Kullanıcının cüzdan özeti (Wallet: id, provider, publicAddress, balance, lockedBalance, isConnected). Birden fazla wallet varsa hepsi; tek wallet varsa tek obje. |
| GET | `/admin/users/:id/tips-summary` | Tips özeti: toplam gönderilen (sentTips sum), toplam alınan (receivedTips sum), işlem sayıları. Tek response ile dashboard kartı doldurulabilir. |
| GET | `/admin/users/:id/tips-transactions` | TipsTokenTransfer listesi (bu kullanıcı from veya to). Query: `limit`, `offset`, `direction` (sent \| received \| all), `sort`, `order`. Response: id, fromUserId, toUserId, amount, reason, createdAt; isteğe bağlı karşı taraf email/displayName. Sayfalı. |

**Yönetim:** Bakiye değiştirme / işlem iptali gibi hassas aksiyonlar (varsa) Wallet/Finance admin sayfasında tutulabilir; User Detail’da sadece görüntüleme ve “Tüm işlemler” ile Wallet sayfasına link verilir.

---

## 3. User Detail sayfa – sekme / blok eşlemesi

| Sekme / blok | Mevcut | Eklenecek EP | Yönetim (opsiyonel) |
|--------------|--------|--------------|----------------------|
| Özet | GET /admin/users/:id | — | — |
| Profil | GET /admin/users/:id (profile dahil) | — | Profil alanları PATCH (ileride) |
| **Profil resmi** | — | GET /admin/users/:id/avatar | PATCH veya POST /admin/users/:id/avatar |
| Roller | GET /admin/users/:id/roles, PUT | — | Mevcut |
| **Katıldığı event’ler** | — | GET /admin/users/:id/events | — (Event sayfasına link) |
| **Badge’ler** | — | GET /admin/users/:id/badges | POST (badge ver), DELETE (badge al) |
| **Cüzdan / Tips** | — | GET /admin/users/:id/wallet, GET /admin/users/:id/tips-summary, GET /admin/users/:id/tips-transactions | — (Wallet sayfasına link) |
| Moderation | GET /admin/users/:id/moderation-history | — | — |
| Trust | GET /admin/users/:id/trust-scores | — | — |
| Giriş denemeleri | GET /admin/users/:id/login-attempts | — | — |

---

## 4. Özet tablo (sadece yeni / genişletilmiş EP’ler)

| # | Metod | Path | Açıklama |
|---|-------|------|----------|
| 1 | GET | `/admin/users/:id/avatar` | Aktif avatar bilgisi |
| 2 | PATCH | `/admin/users/:id/avatar` | Avatar güncelle (imageUrl veya aktif kayıt) |
| 3 | POST | `/admin/users/:id/avatar` | Yeni avatar ekle (imageUrl) |
| 4 | GET | `/admin/users/:id/events` | Katıldığı event’ler (EventStats + Event özeti) |
| 5 | GET | `/admin/users/:id/badges` | Kullanıcının badge’leri (UserBadge + Badge) |
| 6 | POST | `/admin/users/:id/badges` | Kullanıcıya badge ver |
| 7 | DELETE | `/admin/users/:id/badges/:userBadgeId` | Kullanıcıdan badge al |
| 8 | GET | `/admin/users/:id/wallet` | Cüzdan özeti (balance, provider vb.) |
| 9 | GET | `/admin/users/:id/tips-summary` | Tips özeti (toplam gönderilen/alınan) |
| 10 | GET | `/admin/users/:id/tips-transactions` | Tips işlem listesi (sayfalı) |

---

## 5. Event ve Wallet sayfaları ile ilişki

- **Event detay (admin):** “Katılımcılar” listesinde her satırda “Kullanıcıya git” → `/users/:userId`. Event’e özel yönetim (katılımcı çıkar, event badge ata) burada kalır.
- **Wallet / Finance (admin):** Cüzdan veya işlem listesinde kullanıcıya göre filtre ve “Kullanıcıya git” → `/users/:userId`. Bakiye/düzeltme aksiyonları burada tanımlanabilir.

Böylece hem kullanıcı merkezli (User Detail) hem bağlam merkezli (Event, Wallet) akışlar tutarlı ve standartlara uygun şekilde çalışır.
