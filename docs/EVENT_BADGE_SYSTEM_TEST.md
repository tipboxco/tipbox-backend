# Event Badge System - Test Rehberi

Bu dokümanda event badge sisteminin manuel test adımları bulunmaktadır.

## Gereksinimler

- Database aktif olmalı
- Seed data yüklenmiş olmalı
- Test kullanıcısı: `omer@tipbox.co` (password: `password123`)

## Test Adımları

### 1. Database Migration ve Seed

```bash
# Migration'ı çalıştır
npx prisma migrate dev

# Seed data'yı yükle (event badges ve test event dahil)
npm run seed
```

Beklenen: Event badges ve test event başarıyla oluşturulmalı.

### 2. Test Event Bilgisini Al

```bash
# Test event'i listele
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/v1/events/active
```

Beklenen: "Yeni Yıl İçerik Yarışması" başlıklı event listelenmeli.

### 3. Event'e Katıl

```bash
POST /api/v1/events/{eventId}/join
Authorization: Bearer {token}
```

Beklenen: Event'e başarıyla katılım gerçekleşmeli.

### 4. İlk Post'u Oluştur (1 Post Badge)

```bash
POST /api/v1/posts
Authorization: Bearer {token}
Content-Type: application/json

{
  "eventId": "{eventId}",
  "title": "Test Post 1",
  "body": "Event için ilk postum",
  "type": "FREE",
  "contextType": "sub_category",
  "contextId": "{subCategoryId}"
}
```

Beklenen:
- Post başarıyla oluşturulmalı
- `eventPostsCount` = 1 olmalı
- "Aktif Paylaşımcı" badge'i kazanılmalı
- Bildirim alınmalı

### 5. İlerleme Kontrolü

```bash
GET /api/v1/events/{eventId}/progress
Authorization: Bearer {token}
```

Beklenen Response:
```json
{
  "userId": "...",
  "eventId": "...",
  "metrics": {
    "postsCount": 1,
    "likesReceived": 0
  },
  "badges": [
    {
      "badgeId": "...",
      "badgeName": "[Event] Aktif Paylaşımcı",
      "isEarned": true,
      "currentProgress": 1,
      "requirement": {
        "type": "POSTS_COUNT",
        "threshold": 1
      }
    },
    ...
  ]
}
```

### 6. 3 Post Badge Testi

2 post daha oluştur (toplam 3):

```bash
# Post 2
POST /api/v1/posts
Authorization: Bearer {token}
...

# Post 3
POST /api/v1/posts
Authorization: Bearer {token}
...
```

Sonra progress kontrolü:

```bash
GET /api/v1/events/{eventId}/progress
```

Beklenen:
- `postsCount` = 3
- "Süper Paylaşımcı" badge'i kazanılmalı
- İki badge'in de `isEarned: true` olmalı

### 7. Beğeni Badge Testi

Başka bir kullanıcı ile (örn: `tuna@tipbox.co`) login ol ve ilk kullanıcının postunu beğen:

```bash
# User B ile
POST /api/v1/interactions/like
Authorization: Bearer {userB_token}
{
  "postId": "{userA_postId}"
}
```

User A'nın progress'ine bak:

```bash
# User A ile
GET /api/v1/events/{eventId}/progress
Authorization: Bearer {userA_token}
```

Beklenen:
- `likesReceived` = 1
- User A progress'inde beğeni sayısı artmış olmalı
- **User B'nin progress'i değişmemeli** (beğeni yapan değil, alan kazanır)

### 8. 3 Beğeni Badge Testi

2 farklı kullanıcıdan daha beğeni al (toplam 3):

```bash
# User C ile
POST /api/v1/interactions/like
...

# User D ile
POST /api/v1/interactions/like
...
```

User A progress kontrolü:

```bash
GET /api/v1/events/{eventId}/progress
```

Beklenen:
- `likesReceived` = 3
- "Popüler İçerik Üreticisi" badge'i kazanılmalı

### 9. Leaderboard Testi

```bash
GET /api/v1/events/{eventId}/leaderboard?limit=10
Authorization: Bearer {token}
```

Beklenen Response:
```json
{
  "eventId": "...",
  "items": [
    {
      "rank": 1,
      "userId": "...",
      "userName": "Ömer Faruk",
      "avatar": "...",
      "postsCount": 3,
      "likesReceived": 3
    }
  ]
}
```

### 10. Unlike Testi

Bir beğeniyi geri al:

```bash
DELETE /api/v1/interactions/unlike
Authorization: Bearer {userB_token}
{
  "postId": "{userA_postId}"
}
```

User A progress kontrolü:

```bash
GET /api/v1/events/{eventId}/progress
```

Beklenen:
- `likesReceived` = 2 (azalmış)
- Badge hala kazanılmış durumda (`isEarned: true`)

### 11. Event Kapanma Testi

Event'in endDate'ini geçmiş tarihe güncelle (DB'de manuel):

```sql
UPDATE wishbox_event 
SET end_date = NOW() - INTERVAL '1 day'
WHERE title = 'Yeni Yıl İçerik Yarışması';
```

Yeni post oluştur:

```bash
POST /api/v1/posts
Authorization: Bearer {token}
...
```

Progress kontrolü:

```bash
GET /api/v1/events/{eventId}/progress
```

Beklenen:
- `postsCount` artmış olmalı (4)
- YENİ badge verilmemeli (event kapandığı için)
- Mevcut badge'ler korunmalı

## Başarı Kriterleri

✅ Tüm badge'ler threshold'lara ulaşıldığında otomatik verildi
✅ Beğeni yapan değil, beğeni alan kullanıcı badge kazandı
✅ Event kapandığında yeni badge verilmedi
✅ Unlike durumunda metrik azaldı ama badge kalıcı kaldı
✅ Leaderboard doğru sıralamayı gösterdi
✅ Progress endpoint tüm bilgileri doğru döndü

## Notlar

- Badge'ler claim edilmek için `claimed: false` ile oluşturulur
- Event aktifken (PUBLISHED ve endDate > now) badge verme aktif
- Async işlemler hata olsa bile ana işlemi bloklamaz
- Her badge requirement AchievementGoal tablosunda JSON olarak saklanır
