# Admin User Detail — EP ↔ Ekran Eşlemesi

Bu doküman, User Detail sayfasındaki her sekme için **hangi endpoint’in** çağrıldığını, **request/response** şeklini ve **ekranda hangi alanların** kullanıldığını tanımlar. Ekranlar response’a göre planlanmalı; tüm anlamlı alanlar UI’da kullanılmalıdır.

---

## 1. Cüzdan & Tips sekmesi

### GET `/admin/users/:id/wallet`

| | |
|---|---|
| **Request** | Path: `id` (userId). Body yok. |
| **Response** | `{ success: true, data: AdminWalletSummaryItem[] }` |
| **AdminWalletSummaryItem** | `id`, `userId`, `provider`, `publicAddress`, `balance`, `lockedBalance`, `isConnected`, `createdAt` (ISO string) |

**Ekran kullanımı:**
- **Cüzdanlar** kartı: Tablo — Wallet ID, User ID, Provider, Adres, Bakiye, Kilitli, Bağlı, **Oluşturulma (createdAt)**.
- **Özet satırı/kartı (response’tan türet):** Toplam bakiye (sum of `balance`), toplam kilitli (sum of `lockedBalance`), cüzdan sayısı (`data.length`).

---

### GET `/admin/users/:id/tips-summary`

| | |
|---|---|
| **Request** | Path: `id`. Body yok. |
| **Response** | `{ success: true, data: AdminTipsSummaryResponse }` |
| **AdminTipsSummaryResponse** | `totalSent`, `totalReceived`, `sentCount`, `receivedCount` (number) |

**Ekran kullanımı:**
- **Tips özeti** kartı: Dört alan — Toplam gönderilen (`totalSent`), Toplam alınan (`totalReceived`), Gönderi sayısı (`sentCount`), Alım sayısı (`receivedCount`).

---

### GET `/admin/users/:id/tips-transactions`

| | |
|---|---|
| **Request** | Path: `id`. Query: `limit`, `offset`, `direction` (sent \| received \| all), `sort`, `order`. |
| **Response** | `{ success: true, data: AdminTipsTransactionListItem[] }`, `pagination: { total, limit, offset }` |
| **AdminTipsTransactionListItem** | `id`, `fromUserId`, `toUserId`, `amount`, `reason`, `createdAt`, `fromUserEmail?`, `fromUserDisplayName?`, `toUserEmail?`, `toUserDisplayName?` |

**Ekran kullanımı:**
- **Tips işlemleri** tablosu: İşlem ID, Tarih (`createdAt`), Gönderen (displayName/email/userId), Alan (displayName/email/userId), Tutar, Sebep. Sayfalama bilgisi (`pagination`).

---

## 2. Diğer sekmeler (kısa)

- **Özet:** GET `/admin/users/:id` → Hesap + Son yasaklama + Hesap düzenle.
- **Profil:** GET `/admin/users/:id` (profile), GET `/admin/users/:id/avatar` → Profil detayı + Profil resmi kartları; response alanları aynen kullanılır.
- **Etkinlikler:** GET `/admin/users/:id/events` → Tablo (eventId, eventTitle, eventStatus, eventStartDate, eventEndDate, eventPostsCount, eventLikesReceived, totalParticipated, createdAt).
- **Rozetler:** GET `/admin/users/:id/badges`, POST/DELETE → Tablo + “Rozet ver” formu; response alanları (id, badgeId, badgeName, badgeImageUrl, badgeRarity, badgeCategoryName, isVisible, displayOrder, visibility, claimed, claimedAt, createdAt) kullanılır.
- **Moderation / Trust / Giriş:** İlgili GET endpoint’leri → Tablolar; response `data` ve `pagination` kullanılır.

---

## 3. Uygulama kuralları

1. **State:** Her sekme için API’den gelen `res.data` (ve gerekiyorsa `res.pagination`) doğrudan state’e yazılır; `data` array/object yapısı backend ile aynı kabul edilir.
2. **Boş/eksik:** `data` undefined veya null ise `?? []` / `?? null` ile güvenli varsayılan kullanılır.
3. **Tüm alanlar:** Response’taki her alan (id, userId, createdAt vb.) en az bir yerde (tablo sütunu, kart alanı veya özet) kullanılmalıdır.
4. **Sayfalama:** Liste endpoint’leri `pagination` döndürüyorsa UI’da “Toplam X kayıt”, Önceki/Sonraki ile kullanılır.
