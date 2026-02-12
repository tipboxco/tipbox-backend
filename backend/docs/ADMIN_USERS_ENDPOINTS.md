# Admin Panel — Users Bölümü Endpoint Listesi

Bu doküman, admin-panel **Users** bölümü için yöneticinin ihtiyaç duyacağı tüm API endpoint'lerini listeler. Mevcut `admin.router.ts` yapısına, Prisma şemasına (User, Profile, UserRole, ModerationAction, UserReport, UserKycRecord, UserTrustScore, UserAvatar, UserBadge, EventStats, Wallet, TipsTokenTransfer) ve admin sayfalarına (UserList, UserDetail, BannedUsers, UserKYC, UserReports, UserTrustScores) uyumludur.

**User Detail genişletmesi (profil resmi, katıldığı event’ler, badge’ler, cüzdan/tips) ve UX yerleşim kararı:** [ADMIN_USER_DETAIL_UX_AND_ENDPOINTS.md](ADMIN_USER_DETAIL_UX_AND_ENDPOINTS.md).

---

## 1. Özet Tablo

| # | Metod | Path | Açıklama | Durum |
|---|-------|------|----------|--------|
| 1 | GET | `/admin/users` | Kullanıcı listesi (sayfalama, filtre, arama) | ✅ Var |
| 2 | GET | `/admin/users/:id` | Tek kullanıcı detayı (genişletilmiş) | ✅ Var (genişletilebilir) |
| 3 | PATCH | `/admin/users/:id` | Kullanıcı bilgilerini güncelle (email, status vb.) | ❌ Eklenecek |
| 4 | PATCH | `/admin/users/:id/ban` | Kullanıcıyı yasakla | ✅ Var |
| 5 | PATCH | `/admin/users/:id/unban` | Yasağı kaldır | ✅ Var |
| 6 | GET | `/admin/users/:id/profile` | Kullanıcı profil bilgisi (Profile) | ❌ Eklenecek |
| 7 | GET | `/admin/users/:id/roles` | Kullanıcı rolleri | ❌ Eklenecek |
| 8 | PUT | `/admin/users/:id/roles` | Roller atama/güncelleme | ❌ Eklenecek |
| 9 | GET | `/admin/users/:id/moderation-history` | Moderation geçmişi (ban/warn/mute) | ❌ Eklenecek |
| 10 | GET | `/admin/users/:id/login-attempts` | Son giriş denemeleri (güvenlik) | ❌ Eklenecek |
| 11 | GET | `/admin/user-reports` | Kullanıcı şikayetleri listesi | ❌ Eklenecek |
| 12 | GET | `/admin/user-reports/:id` | Tek şikayet detayı | ❌ Eklenecek |
| 13 | PATCH | `/admin/user-reports/:id/resolve` | Şikayeti çözüldü olarak işaretle | ❌ Eklenecek |
| 14 | GET | `/admin/users/banned` | Yasaklı kullanıcılar listesi (veya `?status=BANNED`) | Mevcut listeyle |
| 15 | GET | `/admin/user-kyc` | KYC kayıtları listesi (sayfalama, filtre) | ❌ Eklenecek |
| 16 | GET | `/admin/user-kyc/:userId` | Kullanıcının KYC kaydı detayı | ❌ Eklenecek |
| 17 | PATCH | `/admin/user-kyc/:recordId/review` | KYC inceleme sonucu (approve/decline/on_hold) | ❌ Eklenecek |
| 18 | GET | `/admin/user-trust-scores` | Trust score listesi (kullanıcı bazlı veya genel) | ❌ Eklenecek |
| 19 | GET | `/admin/users/:id/trust-scores` | Kullanıcının trust score geçmişi | ❌ Eklenecek |
| 20 | GET | `/admin/users/stats` | Users bölümü özet istatistikleri | ❌ Eklenecek (opsiyonel) |
| 21 | GET | `/admin/users/:id/avatar` | Kullanıcının aktif avatar bilgisi | ❌ Eklenecek |
| 22 | PATCH | `/admin/users/:id/avatar` | Avatar güncelle (imageUrl / aktif kayıt) | ❌ Eklenecek |
| 23 | POST | `/admin/users/:id/avatar` | Yeni avatar ekle (imageUrl) | ❌ Eklenecek |
| 24 | GET | `/admin/users/:id/events` | Katıldığı event’ler (EventStats + Event özeti) | ❌ Eklenecek |
| 25 | GET | `/admin/users/:id/badges` | Kullanıcının badge’leri (UserBadge + Badge) | ❌ Eklenecek |
| 26 | POST | `/admin/users/:id/badges` | Kullanıcıya badge ver | ❌ Eklenecek |
| 27 | DELETE | `/admin/users/:id/badges/:userBadgeId` | Kullanıcıdan badge al | ❌ Eklenecek |
| 28 | GET | `/admin/users/:id/wallet` | Cüzdan özeti (balance, provider) | ❌ Eklenecek |
| 29 | GET | `/admin/users/:id/tips-summary` | Tips özeti (toplam gönderilen/alınan) | ❌ Eklenecek |
| 30 | GET | `/admin/users/:id/tips-transactions` | Tips işlem listesi (sayfalı) | ❌ Eklenecek |

---

## 2. UX ve yerleşim (User Detail vs Event / Wallet)

Profil resmi, katıldığı etkinlikler, badge’ler ve cüzdan/tips bilgisi **nerede** gösterilip yönetilmeli sorusu için **hibrit yaklaşım** önerilir (detay: [ADMIN_USER_DETAIL_UX_AND_ENDPOINTS.md](ADMIN_USER_DETAIL_UX_AND_ENDPOINTS.md)):

- **User Detail (UserDetail.tsx):** “Kimlik merkezi” — Bu kullanıcıya ait her şey (profil, avatar, event listesi, badge listesi, cüzdan/tips özeti) burada **görüntülenir**; avatar güncelleme ve badge verme/alma gibi **kullanıcıya özel yönetim** de burada yapılır.
- **Event sayfası (admin):** Bir event’in katılımcıları, event badge’leri, event ödülleri **bağlam odaklı** yönetilir; satırda “Kullanıcıya git” ile User Detail’a gidilir.
- **Wallet/Finance sayfası (admin):** Cüzdan listesi, işlemler **bağlam odaklı**; kullanıcıya göre filtre ve “Kullanıcıya git” ile User Detail’a gidilir.

Böylece hem “bu kullanıcının her şeyi” tek ekrandan görülür hem de Event/Wallet sayfaları kendi kapsamında yönetim sunar (endüstri pratiği: Stripe, Auth0, Firebase vb.).

---

## 3. Mevcut Endpoint'ler (Kısa Referans)

Aşağıdakiler `backend/src/interfaces/admin/admin.router.ts` içinde tanımlı.

- **POST** `/admin/login` — Admin girişi (email, password).
- **GET** `/admin/stats` — Genel istatistikler (users, posts, bannedUsers, adminLogs).
- **GET** `/admin/users` — Kullanıcı listesi; query: `limit`, `offset`.
- **GET** `/admin/users/:id` — Tek kullanıcı detayı (id, email, status, emailVerified, auth0Id, createdAt, updatedAt).
- **PATCH** `/admin/users/:id/ban` — Kullanıcıyı yasakla; body: `reason` (opsiyonel).
- **PATCH** `/admin/users/:id/unban` — Yasağı kaldır.
- **GET** `/admin/logs` — Admin işlem logları; query: `limit`, `offset`.

---

## 4. Eklenecek / Genişletilecek Endpoint'ler — Detay

### 3.1 Kullanıcı listesi (genişletme)

**GET** `/admin/users`

**Mevcut:** `limit`, `offset`  
**Eklenmesi önerilen query parametreleri:**

| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| `search` | string | Email veya profil displayName/userName üzerinde arama |
| `status` | string | `BANNED`, `ACTIVE` vb. (User.status) |
| `emailVerified` | boolean | Sadece doğrulanmış/doğrulanmamış |
| `sort` | string | `createdAt`, `email` (varsayılan: `createdAt`) |
| `order` | string | `asc`, `desc` (varsayılan: `desc`) |

**Response (mevcut yapı korunur):** `{ success, data: AdminUserListItem[], pagination }`.  
İsteğe bağlı: listeye `displayName`, `userName` (Profile’dan join) eklenebilir.

---

### 3.2 Tek kullanıcı detayı (genişletme)

**GET** `/admin/users/:id`

**Mevcut alanlar:** id, email, status, emailVerified, auth0Id, createdAt, updatedAt.  
**Eklenmesi önerilen:**  
- Profile özeti: displayName, userName, bio, country, postsCount, trustCount, trusterCount (aynı response’ta veya ayrı EP’de).  
- `roles: string[]` (UserRole.role).  
- Son moderation: bannedAt, lastBanReason (ModerationAction’dan).

Bunlar aynı GET’te genişletilebileceği gibi, aşağıdaki alt kaynak EP’lere bölünebilir.

---

### 3.3 Kullanıcı güncelleme

**PATCH** `/admin/users/:id`

**Body (hepsi opsiyonel):**

```ts
{
  email?: string;           // unique kontrolü
  status?: string | null;   // BANNED, null vb.
  emailVerified?: boolean;
}
```

**Response:** `{ success, data: AdminUserDetailResponse }`.  
Not: Ban/unban için mevcut `/ban` ve `/unban` kullanılmaya devam edilebilir; bu EP sadece genel alan güncellemesi için.

---

### 3.4 Kullanıcı profil (admin görünümü)

**GET** `/admin/users/:id/profile`

**Response:** Profile alanları (id, userId, displayName, userName, bio, bannerUrl, country, birthDate, postsCount, trustCount, trusterCount, createdAt, updatedAt). Profile yoksa 404 veya null.

---

### 3.5 Kullanıcı rolleri

**GET** `/admin/users/:id/roles`  
**Response:** `{ success, data: { roles: string[] } }` (UserRole.role listesi).

**PUT** `/admin/users/:id/roles`  
**Body:** `{ roles: string[] }` (örn. `["USER", "VERIFIED"]`). ADMIN ataması için ek güvenlik (ör. sadece süper admin) düşünülebilir.  
**Response:** `{ success, data: { roles: string[] } }`.

---

### 3.6 Moderation geçmişi

**GET** `/admin/users/:id/moderation-history`

**Query:** `limit`, `offset` (sayfalama).

**Response:** ModerationAction listesi (moderatorId, actionType: BAN/WARN/MUTE/CONTENT_REMOVED, reason, contentType, contentId, createdAt). İsteğe bağlı: moderator email/displayName.

---

### 3.7 Giriş denemeleri (güvenlik)

**GET** `/admin/users/:id/login-attempts`

**Query:** `limit`, `offset`, `status` (LoginAttempt.status).

**Response:** LoginAttempt listesi (ipAddress, userAgent, status, attemptedAt).

---

### 3.8 Kullanıcı şikayetleri (User Reports)

**GET** `/admin/user-reports`

**Query:** `limit`, `offset`, `reportedUserId`, `reporterId`, `category`, `sort`, `order`.

**Response:** `{ success, data: UserReportListItem[], pagination }`.  
Her öğe: id, reportedUserId, reporterId, category, description, createdAt; isteğe bağlı reported/reporter email veya displayName.

**GET** `/admin/user-reports/:id`  
**Response:** Tek UserReport detayı + reported/reporter kullanıcı özeti.

**PATCH** `/admin/user-reports/:id/resolve`  
**Body:** `{ resolved: boolean, adminNote?: string }`.  
(Şimdilik UserReport’ta “resolved” alanı yoksa, AdminLog ile loglama veya ileride UserReport’a alan eklenebilir.)

---

### 3.9 Yasaklı kullanıcılar listesi

**Seçenek A:** Mevcut **GET** `/admin/users?status=BANNED` ile çözülür (3.1’deki filtreyle).  
**Seçenek B:** Alias **GET** `/admin/users/banned` → aynı handler, sadece `status=BANNED` sabit.  
Öneri: Seçenek A yeterli; admin panelde “Banned Users” sayfası `GET /admin/users?status=BANNED` kullanır.

---

### 3.10 KYC

**GET** `/admin/user-kyc`

**Query:** `limit`, `offset`, `userId`, `reviewStatus` (INIT, PENDING, COMPLETED, DECLINED, ON_HOLD), `reviewResult` (GREEN, YELLOW, RED).

**Response:** UserKycRecord listesi (userId, sumsubApplicantId, reviewStatus, reviewResult, reviewReason, kycLevel, createdAt, lastSyncedAt) + isteğe bağlı user email.

**GET** `/admin/user-kyc/:userId`  
Kullanıcıya ait KYC kaydı (tek veya en güncel). Birden fazla kayıt varsa liste veya “en son” tek kayıt dönebilir.

**PATCH** `/admin/user-kyc/:recordId/review`  
**Body:** `{ reviewStatus?: KycReviewStatus, reviewResult?: KycReviewResult, reviewReason?: string }`.  
Sadece yetkili admin; AdminLog ile loglanır.

---

### 3.11 Trust score’lar

**GET** `/admin/user-trust-scores`

**Query:** `limit`, `offset`, `userId`, `sort`, `order`.  
**Response:** UserTrustScore listesi (userId, score, reason, calculatedAt, createdAt) + isteğe bağlı user bilgisi.

**GET** `/admin/users/:id/trust-scores`  
Belirli kullanıcının trust score geçmişi (sayfalı).

---

### 3.12 Users özet istatistikleri (opsiyonel)

**GET** `/admin/users/stats`

**Response:** Örn. `{ total, bannedCount, emailVerifiedCount, newThisWeek }`.  
Dashboard veya Users ana sayfası için kullanılabilir; mevcut `/admin/stats` ile birleştirilebilir.

---

## 5. Admin Panel Sayfa – EP Eşlemesi

| Admin sayfa | Kullanılacak endpoint'ler |
|-------------|---------------------------|
| **UserList** | GET /admin/users (filtre: search, status, emailVerified, sort, order), GET /admin/users/stats (opsiyonel) |
| **User detail (UserDetail.tsx)** | GET /admin/users/:id, GET /admin/users/:id/profile, GET /admin/users/:id/roles, GET /admin/users/:id/moderation-history, GET /admin/users/:id/trust-scores, GET /admin/users/:id/login-attempts; **avatar:** GET/PATCH/POST /admin/users/:id/avatar; **event’ler:** GET /admin/users/:id/events; **badge’ler:** GET /admin/users/:id/badges, POST /admin/users/:id/badges, DELETE /admin/users/:id/badges/:userBadgeId; **cüzdan/tips:** GET /admin/users/:id/wallet, GET /admin/users/:id/tips-summary, GET /admin/users/:id/tips-transactions |
| **BannedUsers** | GET /admin/users?status=BANNED |
| **Ban/Unban** | PATCH /admin/users/:id/ban, PATCH /admin/users/:id/unban |
| **UserKYC** | GET /admin/user-kyc, GET /admin/user-kyc/:userId, PATCH /admin/user-kyc/:recordId/review |
| **UserReports** | GET /admin/user-reports, GET /admin/user-reports/:id, PATCH /admin/user-reports/:id/resolve |
| **UserTrustScores** | GET /admin/user-trust-scores, GET /admin/users/:id/trust-scores |
| **Kullanıcı düzenleme** | PATCH /admin/users/:id, PUT /admin/users/:id/roles |

---

## 6. Güvenlik ve Tutarlılık

- Tüm endpoint'ler `authMiddleware` + `requireAdmin` ile korunmalı.
- Hassas işlemler (ban, KYC review, rol atama) AdminLog’a yazılmalı.
- PATCH/PUT’ta id path’ten alınmalı; body’deki id’ye güvenilmemeli.
- Rate limiting ve audit log mevcut politikalara uygun uygulanmalı.

---

## 7. Uygulama Sırası Önerisi

1. **Faz 1 – Liste ve detay:** GET /admin/users filtreleri, GET /admin/users/:id genişletmesi, GET /admin/users/:id/profile, GET /admin/users/:id/roles.  
2. **Faz 2 – Moderation:** GET /admin/users/:id/moderation-history, GET /admin/users/banned alias veya status=BANNED (zaten ban/unban var).  
3. **Faz 3 – User Reports:** GET /admin/user-reports, GET /admin/user-reports/:id, PATCH resolve.  
4. **Faz 4 – KYC:** GET /admin/user-kyc, GET /admin/user-kyc/:userId, PATCH review.  
5. **Faz 5 – Trust & ek:** GET /admin/user-trust-scores, GET /admin/users/:id/trust-scores, GET /admin/users/:id/login-attempts, PATCH /admin/users/:id, PUT /admin/users/:id/roles, GET /admin/users/stats.  
6. **Faz 6 – User Detail genişletmesi:** GET/PATCH/POST /admin/users/:id/avatar, GET /admin/users/:id/events, GET /admin/users/:id/badges, POST /admin/users/:id/badges, DELETE /admin/users/:id/badges/:userBadgeId, GET /admin/users/:id/wallet, GET /admin/users/:id/tips-summary, GET /admin/users/:id/tips-transactions.

Bu sıra ile UserList, BannedUsers, UserDetail (mevcut sekmeler) tamamlanır; ardından User Detail’a avatar, event’ler, badge’ler ve cüzdan/tips sekmeleri eklenir.
