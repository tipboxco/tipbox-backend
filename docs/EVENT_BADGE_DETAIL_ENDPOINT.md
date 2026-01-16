# Event Badge Detail Endpoint Spesifikasyonu

## 📝 Genel Bakış

Bu dokümantasyon, kullanıcının belirli bir event badge'indeki ilerlemesini görüntülemek için kullanılacak endpoint'in request/response yapısını tanımlar.

**Status:** ✅ Implemented  
**Version:** 1.0.0  
**Date:** 16 Ocak 2026

---

## 🎯 Amaç

Kullanıcı bir event badge'ine tıkladığında:
- Badge'in temel bilgilerini (isim, açıklama, görsel, rarity)
- Kullanıcının o badge'deki mevcut ilerlemesini
- Badge'i kazanmak için gerekli hedefi
- Progress bar için gerekli verileri

göstermek.

---

## 🔗 Endpoint

### GET Event Badge Detail with User Progress

**Endpoint:** `GET /api/v1/events/{eventId}/badges/{badgeId}`

**Açıklama:** Belirli bir event'e ait badge'in detaylarını ve kullanıcının o badge'deki ilerlemesini getirir.

---

## 📥 Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventId` | `string` | ✅ Yes | Event'in benzersiz ID'si (ULID) |
| `badgeId` | `string` | ✅ Yes | Badge'in benzersiz ID'si (UUID) |

### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `Authorization` | `string` | ✅ Yes | Bearer token - Kullanıcı kimlik doğrulama |
| `Content-Type` | `string` | ✅ Yes | `application/json` |

### Query Parameters

Yok.

### Request Example

```http
GET /api/v1/events/00MKFPNIQ30000064YDGL62K7Q/badges/a1b2c3d4-e5f6-7890-abcd-ef1234567890 HTTP/1.1
Host: api.tipbox.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

---

## 📤 Response

### Success Response (200 OK)

#### Response Body Schema

```typescript
interface EventBadgeDetailResponse {
  // Badge Temel Bilgileri
  id: string;                    // Badge ID (UUID)
  title: string;                 // Badge ismi (örn: "[Event] İlk Adım")
  description: string;           // Badge açıklaması
  imageUrl: string | null;       // Badge görseli URL'i
  rarity: string;                // Badge nadir değeri (COMMON, RARE, EPIC)
  
  // İlerleme Bilgileri (User-specific)
  userProgress: {
    current: number;             // Kullanıcının mevcut ilerleme değeri (örn: 3 post)
    target: number;              // Hedef değer (örn: 5 post)
    isCompleted: boolean;        // Badge tamamlandı mı?
    completedAt: string | null;  // Tamamlanma tarihi (ISO 8601) - Sadece completed ise
    progressPercentage: number;  // İlerleme yüzdesi (0-100)
  };
  
  // Badge Metadata
  category: string;              // Badge kategorisi (örn: "Event Rozetleri")
  eventId: string;               // İlişkili event ID
  createdAt: string;             // Badge oluşturulma tarihi (ISO 8601)
}
```

#### Response Example - İlerlemede Olan Badge

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "[Event] İçerik Ustası",
  "description": "Event'te toplam 5 post paylaştın! ⭐ Harika bir içerik üreticisisin! Event boyunca düzenli ve kaliteli paylaşımların topluluğa değer katıyor. Bu başarı için tebrikler!",
  "imageUrl": null,
  "rarity": "EPIC",
  "userProgress": {
    "current": 3,
    "target": 5,
    "isCompleted": false,
    "completedAt": null,
    "progressPercentage": 60
  },
  "category": "Event Rozetleri",
  "eventId": "00MKFPNIQ30000064YDGL62K7Q",
  "createdAt": "2026-01-15T10:30:00.000Z"
}
```

**Tamamlanmış Badge Örneği:**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "[Event] İlk Adım",
  "description": "Event süresince ilk postunu paylaşarak bu rozeti kazandın! 🎉 Event'e katılımını gösterdiğin için teşekkürler. Devam et, daha fazla rozet seni bekliyor!",
  "imageUrl": null,
  "rarity": "COMMON",
  "userProgress": {
    "current": 7,
    "target": 1,
    "isCompleted": true,
    "completedAt": "2026-01-15T14:25:30.000Z",
    "progressPercentage": 100
  },
  "category": "Event Rozetleri",
  "eventId": "00MKFPNIQ30000064YDGL62K7Q",
  "createdAt": "2026-01-15T10:30:00.000Z"
}
```

---

### Error Responses

#### 400 Bad Request

**Sebep:** Geçersiz eventId veya badgeId formatı

```json
{
  "error": "Bad Request",
  "message": "Invalid eventId or badgeId format",
  "statusCode": 400
}
```

#### 401 Unauthorized

**Sebep:** Geçersiz veya eksik authentication token

```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing authentication token",
  "statusCode": 401
}
```

#### 404 Not Found

**Sebep:** Event bulunamadı

```json
{
  "error": "Not Found",
  "message": "Event not found",
  "statusCode": 404
}
```

**Sebep:** Badge bulunamadı

```json
{
  "error": "Not Found",
  "message": "Badge not found",
  "statusCode": 404
}
```

**Sebep:** Badge bu event'e ait değil

```json
{
  "error": "Not Found",
  "message": "Badge does not belong to this event",
  "statusCode": 404
}
```

#### 500 Internal Server Error

**Sebep:** Sunucu hatası

```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "statusCode": 500
}
```

---

## 💾 Backend Implementation

### Database Tables Used

#### Badge Table
```prisma
model Badge {
  id               String            @id @default(uuid()) @db.Uuid
  name             String
  description      String?
  imageUrl         String?           @map("image_url")
  type             BadgeType         // 'EVENT'
  rarity           BadgeRarity       // 'COMMON', 'RARE', 'EPIC'
  categoryId       String            @map("category_id") @db.Uuid
  createdAt        DateTime          @default(now())
  
  category         BadgeCategory     @relation(fields: [categoryId], references: [id])
  achievementGoals AchievementGoal[]
  userBadges       UserBadge[]
}
```

#### UserBadge Table
```prisma
model UserBadge {
  id           String   @id @default(uuid()) @db.Uuid
  userId       String   @map("user_id") @db.Uuid
  badgeId      String   @map("badge_id") @db.Uuid
  claimed      Boolean  @default(false)
  claimedAt    DateTime? @map("claimed_at")
  createdAt    DateTime @default(now())
  
  badge        Badge    @relation(fields: [badgeId], references: [id])
  user         User     @relation(fields: [userId], references: [id])
  
  @@unique([userId, badgeId])
}
```

#### AchievementGoal Table
```prisma
model AchievementGoal {
  id               String    @id @default(uuid()) @db.Uuid
  requirement      String    // JSON: {"type": "POSTS_COUNT", "threshold": 5}
  rewardBadgeId    String?   @map("reward_badge_id") @db.Uuid
  
  rewardBadge      Badge?    @relation(fields: [rewardBadgeId], references: [id])
}
```

#### WishboxStats Table (Event Metrics)
```prisma
model WishboxStats {
  userId               String   @map("user_id") @db.Uuid
  eventId              String?  @map("event_id")
  eventPostsCount      Int      @default(0)
  eventLikesReceived   Int      @default(0)
  
  @@unique([userId, eventId])
}
```

---

## 🔄 Business Logic

### Badge Progress Hesaplama

1. **Badge requirement'ı parse et:**
   ```typescript
   const requirement = JSON.parse(achievementGoal.requirement);
   // { type: "POSTS_COUNT", threshold: 5 }
   ```

2. **Kullanıcının event metriklerini al:**
   ```typescript
   const metrics = await eventMetricsService.getUserMetrics(userId, eventId);
   // { postsCount: 3, likesReceivedCount: 2 }
   ```

3. **Progress hesapla:**
   ```typescript
   let currentProgress = 0;
   switch (requirement.type) {
     case 'POSTS_COUNT':
       currentProgress = metrics.postsCount;
       break;
     case 'LIKES_RECEIVED':
       currentProgress = metrics.likesReceivedCount;
       break;
   }
   ```

4. **Badge kazanılmış mı kontrol et:**
   ```typescript
   const userBadge = await prisma.userBadge.findUnique({
     where: { userId_badgeId: { userId, badgeId } }
   });
   const isCompleted = userBadge !== null;
   ```

5. **Progress percentage hesapla:**
   ```typescript
   const progressPercentage = Math.min(100, 
     Math.round((currentProgress / threshold) * 100)
   );
   ```

---

## 🎨 Frontend Integration

### API Service

```typescript
// communityEventsApi.ts
export const getEventBadgeDetail = async (
  eventId: string,
  badgeId: string
): Promise<EventBadgeDetailResponse> => {
  const response = await apiService.getClient().get<EventBadgeDetailResponse>(
    `/events/${eventId}/badges/${badgeId}`
  );
  return response.data;
};
```

### React Query Hook

```typescript
// hooks.ts
export const useEventBadgeDetail = (eventId: string, badgeId: string) => {
  return useQuery<EventBadgeDetailResponse, Error>({
    queryKey: ['events', eventId, 'badges', badgeId, 'detail'],
    queryFn: () => getEventBadgeDetail(eventId, badgeId),
    enabled: !!eventId && !!badgeId,
    staleTime: 5 * 60 * 1000,  // 5 dakika cache
    gcTime: 10 * 60 * 1000,    // 10 dakika
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
```

### UI Mapping

```typescript
// BadgeDetailModal içinde
const { data: badgeDetail, isLoading, error } = useEventBadgeDetail(eventId, badgeId);

if (isLoading) return <Spinner />;
if (error) return <ErrorView />;

return (
  <View>
    <Image source={{ uri: badgeDetail.imageUrl }} />
    <Text>{badgeDetail.title}</Text>
    <Text>{badgeDetail.description}</Text>
    
    {/* Progress Bar */}
    <Box w="100%" h={5} bg="#E0E0E0" borderRadius={10}>
      <Box
        w={`${badgeDetail.userProgress.progressPercentage}%`}
        h="100%"
        bg={badgeDetail.userProgress.isCompleted ? '#0C7A24' : '#686868'}
      />
    </Box>
    
    <Text>
      {badgeDetail.userProgress.current}/{badgeDetail.userProgress.target}
    </Text>
    
    {badgeDetail.userProgress.isCompleted && (
      <Text>Tamamlandı: {new Date(badgeDetail.userProgress.completedAt).toLocaleDateString()}</Text>
    )}
  </View>
);
```

---

## 🧪 Test Senaryoları

### 1. Badge Henüz Başlamadı (0/5)

**Request:**
```http
GET /api/v1/events/00MKFPNIQ30000064YDGL62K7Q/badges/badge-uuid
```

**Response (200):**
```json
{
  "userProgress": {
    "current": 0,
    "target": 5,
    "isCompleted": false,
    "completedAt": null,
    "progressPercentage": 0
  }
}
```

---

### 2. Badge İlerlemede (3/5)

**Response (200):**
```json
{
  "userProgress": {
    "current": 3,
    "target": 5,
    "isCompleted": false,
    "completedAt": null,
    "progressPercentage": 60
  }
}
```

---

### 3. Badge Tamamlandı (5/5)

**Response (200):**
```json
{
  "userProgress": {
    "current": 5,
    "target": 5,
    "isCompleted": true,
    "completedAt": "2026-01-15T14:25:30.000Z",
    "progressPercentage": 100
  }
}
```

---

### 4. Badge Hedefi Aşıldı (8/5)

**Response (200):**
```json
{
  "userProgress": {
    "current": 8,
    "target": 5,
    "isCompleted": true,
    "completedAt": "2026-01-15T14:25:30.000Z",
    "progressPercentage": 100
  }
}
```

**Not:** `progressPercentage` maksimum 100 olarak gösterilir, ancak `current` hedefi aşabilir.

---

## 🔐 Security Considerations

1. **Authentication:** ✅ Bearer token zorunlu
2. **Authorization:** ✅ Kullanıcı sadece kendi progress'ini görebilir
3. **Input Validation:** ✅ eventId ve badgeId formatları kontrol edilir
4. **Rate Limiting:** Backend'de implement edilmeli

---

## ⚡ Performance Considerations

1. **Cache Strategy:**
   - Badge metadata cache'lenebilir (değişmez)
   - User progress 5 dakika cache
   - Key pattern: `badge:detail:{eventId}:{badgeId}:{userId}`

2. **Database Optimization:**
   - `userBadge` unique index: `(userId, badgeId)`
   - `wishboxStats` unique index: `(userId, eventId)`

---

## 📚 Related Endpoints

1. `GET /api/v1/events/{eventId}/progress` - Kullanıcının tüm badge progress'i
2. `GET /api/v1/events/{eventId}/leaderboard` - Event leaderboard'u
3. `POST /api/v1/posts/{eventId}/post` - Event'e post paylaş (metrics günceller)
4. `POST /api/v1/interactions/like` - Post beğen (likes metrics günceller)

---

## 🔄 Frontend Implementation Checklist

- [x] Backend endpoint implement edildi
- [x] Swagger dokümantasyonu eklendi
- [x] Error handling yapıldı
- [ ] `communityEventsApi.ts` - `getEventBadgeDetail` fonksiyonu ekle
- [ ] `hooks.ts` - `useEventBadgeDetail` hook'u ekle
- [ ] `types.ts` - `EventBadgeDetailResponse` interface'i ekle
- [ ] `BadgeDetailModal/index.tsx` - API entegrasyonu yap
- [ ] `RewardsBadgesScreen.tsx` - Badge press'te API çağır
- [ ] Loading state ekle
- [ ] Error handling ekle
- [ ] Cache invalidation stratejisi belirle

---

## 🧪 Test Script

Test script'i çalıştırmak için:

```bash
./test-badge-detail-endpoint.sh
```

Script otomatik olarak:
- Badge ID'lerini database'den alır
- Her badge için endpoint'i test eder
- Hata senaryolarını test eder (404, 401)
- Sonuçları renkli output ile gösterir

---

## ✅ Implementation Status

- [x] DTO interface tanımlandı
- [x] Service method oluşturuldu
- [x] Router endpoint'i eklendi
- [x] Swagger dokümantasyonu yapıldı
- [x] Error handling implement edildi
- [x] Test script'i hazırlandı
- [x] Dokümantasyon tamamlandı

---

**Tarih:** 16 Ocak 2026  
**Versiyon:** 1.0.0  
**Status:** ✅ Production Ready  
**Hazırlayan:** TipBox Backend Team
