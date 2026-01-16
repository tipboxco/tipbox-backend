# Event Badge System - Setup Complete ✅

## 🎯 Event Bilgileri

**Event ID:** `00MKFPNIQ30000064YDGL62K7Q`  
**Event Adı:** Kablosuz Kulaklık Ses Kalitesi Testi  
**Durum:** PUBLISHED (Aktif)  
**Bitiş Tarihi:** 2026-01-30

---

## 🏆 Oluşturulan Badge'ler

### 📝 Post Badge'leri

| Badge | Rarity | Threshold | Zorluk |
|-------|--------|-----------|--------|
| [Event] İlk Adım | COMMON | 1 post | EASY |
| [Event] Aktif Katılımcı | RARE | 3 post | MEDIUM |
| [Event] İçerik Ustası | EPIC | 5 post | HARD |

### 👍 Beğeni Badge'leri (Likes Received)

| Badge | Rarity | Threshold | Zorluk |
|-------|--------|-----------|--------|
| [Event] İlk Beğeni | COMMON | 1 beğeni | EASY |
| [Event] Popüler | RARE | 3 beğeni | MEDIUM |
| [Event] Viral Oldu | EPIC | 5 beğeni | HARD |

---

## 🗄️ Veri Yapısı

### Database Tables

```
Badge (badges)
├─ id: UUID
├─ name: "[Event] İlk Adım"
├─ type: "EVENT"
├─ rarity: "COMMON" | "RARE" | "EPIC"
└─ categoryId: "Event Rozetleri"

AchievementGoal (achievement_goals)
├─ rewardBadgeId: Badge.id
├─ requirement: JSON { type, threshold }
├─ pointsRequired: threshold değeri
└─ difficulty: "EASY" | "MEDIUM" | "HARD"

WishboxStats (wishbox_stats)
├─ userId + eventId (composite key)
├─ eventPostsCount: INT (kullanıcının post sayısı)
└─ eventLikesReceived: INT (kullanıcının aldığı beğeni)

UserBadge (user_badges)
├─ userId + badgeId (composite key)
├─ claimed: BOOLEAN
└─ claimedAt: DATETIME
```

---

## 🔧 Kullanım

### 1. Badge'leri Oluştur/Güncelle

```bash
# Docker container içinde çalıştır
docker exec tipbox_backend npx ts-node scripts/setup-event-badges.ts
```

**Ne yapar:**
- 6 badge oluşturur/günceller
- AchievementGoal'ları linkler
- Badge Category ve Achievement Chain oluşturur
- Test kullanıcıları için örnek metrik data oluşturur

### 2. Sistemi Doğrula

```bash
# Verification script
docker exec tipbox_backend npx ts-node scripts/verify-event-badges.ts
```

**Ne gösterir:**
- Event bilgileri
- Tüm badge'ler ve threshold'lar
- Test kullanıcılarının metrikleri
- Kazanılması gereken vs kazanılmış badge'ler
- Badge progress simülasyonu
- System health check

---

## 📊 Badge Kazanma Mantığı

### Akış

```
1. Kullanıcı post atar
   └─> POST /posts/{eventId}/post
       └─> PostService.createFreePost()
           └─> EventMetricsService.incrementUserPostCount()
               └─> WishboxStats.eventPostsCount++
                   └─> BadgeEligibilityService.checkAndGrantEventBadges()
                       └─> Threshold kontrolü
                           └─> Badge ver (GamificationService)

2. Kullanıcının postu beğenilir
   └─> POST /interactions/like
       └─> InteractionService.likePost()
           └─> EventMetricsService.incrementUserLikesReceived(postOwner)
               └─> WishboxStats.eventLikesReceived++
                   └─> BadgeEligibilityService.checkAndGrantEventBadges()
                       └─> Threshold kontrolü
                           └─> Badge ver (GamificationService)
```

### Kurallar

✅ **Badge verilir:**
- Event aktif ise (PUBLISHED ve endDate > now)
- Kullanıcı threshold'a ulaştıysa
- Badge daha önce verilmemişse

❌ **Badge verilmez:**
- Event kapalıysa
- Threshold'a ulaşılmamışsa
- Badge zaten verilmişse

---

## 🧪 Test Senaryoları

### 1. Event Progress Kontrolü

```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:3000/api/v1/events/00MKFPNIQ30000064YDGL62K7Q/progress
```

**Beklenen Response:**
```json
{
  "userId": "...",
  "eventId": "00MKFPNIQ30000064YDGL62K7Q",
  "metrics": {
    "postsCount": 0,
    "likesReceived": 0
  },
  "badges": [
    {
      "badgeId": "...",
      "badgeName": "[Event] İlk Adım",
      "requirement": {
        "type": "POSTS_COUNT",
        "threshold": 1
      },
      "currentProgress": 0,
      "isEarned": false,
      "progressPercentage": 0
    }
  ]
}
```

### 2. İlk Post At (İlk Badge)

```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -F "body=Event için ilk postum!" \
  -F "contextType=product" \
  -F "contextId={productId}" \
  http://localhost:3000/api/v1/posts/00MKFPNIQ30000064YDGL62K7Q/post
```

**Sonuç:**
- `eventPostsCount` 0 → 1
- "[Event] İlk Adım" badge kazanılır
- Bildirim gönderilir

### 3. Progress Tekrar Kontrol

```bash
# Aynı endpoint, şimdi badge earned olmalı
GET /api/v1/events/00MKFPNIQ30000064YDGL62K7Q/progress
```

**Beklenen:**
```json
{
  "metrics": {
    "postsCount": 1,
    "likesReceived": 0
  },
  "badges": [
    {
      "badgeName": "[Event] İlk Adım",
      "currentProgress": 1,
      "isEarned": true,  // ✅ KAZANILDI
      "progressPercentage": 100
    },
    {
      "badgeName": "[Event] Aktif Katılımcı",
      "currentProgress": 1,
      "isEarned": false,
      "progressPercentage": 33  // 1/3
    }
  ]
}
```

### 4. Beğeni Testi

```bash
# Başka bir kullanıcı ile (User B)
POST /api/v1/interactions/like
{
  "postId": "{userA_postId}"
}

# User A progress kontrolü
GET /api/v1/events/00MKFPNIQ30000064YDGL62K7Q/progress
# User A'nın likesReceived: 1
# "[Event] İlk Beğeni" badge kazanılır
```

### 5. Leaderboard

```bash
GET /api/v1/events/00MKFPNIQ30000064YDGL62K7Q/leaderboard?limit=10
```

**Response:**
```json
{
  "eventId": "00MKFPNIQ30000064YDGL62K7Q",
  "items": [
    {
      "rank": 1,
      "userId": "...",
      "userName": "Zeynep",
      "postsCount": 3,
      "likesReceived": 2
    }
  ]
}
```

---

## 📈 Test Data

Script tarafından oluşturulan test kullanıcıları:

| User | Posts | Likes | Eligible Badges |
|------|-------|-------|----------------|
| Elif | 1 | 0 | 1 (İlk Adım) |
| Can | 2 | 1 | 2 (İlk Adım, İlk Beğeni) |
| Zeynep | 3 | 2 | 3 (İlk Adım, Aktif Katılımcı, İlk Beğeni) |

**Not:** Badge'ler henüz verilmemiş (auto-grant sistemi test edilecek)

---

## 🔍 Troubleshooting

### Problem: Badge Verilmiyor

**Kontrol Listesi:**
1. Event aktif mi? (`status = PUBLISHED` ve `endDate > now`)
2. Metrik doğru artıyor mu? (WishboxStats tablosunu kontrol et)
3. Badge requirement JSON doğru mu?
4. BadgeEligibilityService çalışıyor mu? (log'lara bak)

**Debug:**
```bash
# Event status kontrol
docker exec tipbox_backend npx prisma studio
# → WishboxEvent tablosuna bak

# Metrikleri kontrol
docker exec tipbox_backend npx prisma studio
# → WishboxStats tablosuna bak (eventPostsCount, eventLikesReceived)

# Badge'leri kontrol
docker exec tipbox_backend npx ts-node scripts/verify-event-badges.ts
```

### Problem: "Event not found"

Event ID'yi kontrol et:
```bash
docker exec tipbox_backend npx ts-node -e "
  import { PrismaClient } from '@prisma/client';
  const prisma = new PrismaClient();
  prisma.wishboxEvent.findUnique({ where: { id: '00MKFPNIQ30000064YDGL62K7Q' } })
    .then(e => console.log(e))
    .finally(() => prisma.\$disconnect());
"
```

### Problem: Metrikler Artmıyor

PostService ve InteractionService log'larına bak:
```bash
docker logs tipbox_backend -f | grep -i "event metrics"
```

---

## 📝 Notlar

1. **Badge Category:** "Event Rozetleri" - Tüm event badge'leri bu kategoride
2. **Achievement Chain:** "Event Başarıları" - Tüm event goal'ları bu chain'de
3. **Badge Type:** Hepsi `EVENT` type
4. **Idempotency:** Aynı badge birden fazla verilmez
5. **Unlike:** Beğeni geri alınırsa metrik azalır ama badge kalır
6. **Event Kapatma:** Event kapandığında yeni badge verilmez

---

## 🚀 Sonraki Adımlar

1. ✅ Badge'leri oluştur: `scripts/setup-event-badges.ts`
2. ✅ Sistemi doğrula: `scripts/verify-event-badges.ts`
3. 🧪 API'yi test et: Postman veya cURL ile
4. 📱 Frontend entegrasyonu
5. 📊 Analytics ve monitoring

---

## 📚 İlgili Dosyalar

- **Config:** `src/config/event-badges.config.ts`
- **Service:** `src/application/gamification/badge-eligibility.service.ts`
- **Metrics:** `src/application/event/event-metrics.service.ts`
- **Router:** `src/interfaces/post/post.router.ts`
- **Scripts:** `scripts/setup-event-badges.ts`, `scripts/verify-event-badges.ts`
- **Docs:** `docs/API_EVENT_POST_ENDPOINT.md`

---

Sistem hazır ve test edilmeye hazır! 🎉
