# Cache Monitoring & Invalidation Rehberi

## 📊 1. CACHE HIT/MISS NASIL GÖRÜNTÜLENIR?

### A. Log'lardan Görüntüleme

```bash
# Cache hit/miss log'larını filtrele
docker exec tipbox_backend cat /app/logs/2025-12-23.log | grep -E "(cache|Cache)"

# Sadece cache hit'leri gör
docker exec tipbox_backend cat /app/logs/2025-12-23.log | grep "served from cache"

# Sadece cache miss'leri gör
docker exec tipbox_backend cat /app/logs/2025-12-23.log | grep "served from database"

# Response time karşılaştırması
docker exec tipbox_backend cat /app/logs/2025-12-23.log | grep -E "duration.*ms"
```

### B. Response Header'lardan Görüntüleme

Her request'te `X-Response-Time` header'ı eklenir:

```bash
# Curl ile test et
curl -I http://localhost:3000/api/user/profile/USER_ID \
  -H "Authorization: Bearer TOKEN"

# Response:
# X-Response-Time: 45ms  (cache'den)
# X-Response-Time: 150ms (database'den)
```

### C. Log Örneği

**Cache Hit (Hızlı):**
```json
{
  "level": "info",
  "message": "User profile served from cache",
  "userId": "user-123",
  "cacheKey": "user:user-123:profile",
  "duration": "5ms",
  "source": "cache",
  "timestamp": "2025-12-23T15:30:00.000Z"
}
```

**Cache Miss (Yavaş):**
```json
{
  "level": "info",
  "message": "User profile served from database",
  "userId": "user-123",
  "duration": "125ms",
  "source": "database",
  "cacheMiss": true,
  "timestamp": "2025-12-23T15:30:00.000Z"
}
```

---

## 🔄 2. CACHE INVALIDATION (Cache Silme)

### A. Kullanım Örnekleri

#### User Profili Güncellendiğinde

```typescript
import { invalidateUserCache } from '../infrastructure/cache/cache-invalidation';

// user.service.ts içinde
async updateProfile(userId: string, data: any) {
  // Database'i güncelle
  await this.userRepo.update(userId, data);
  
  // Cache'i temizle
  await invalidateUserCache(userId);
  
  return { success: true };
}
```

#### Post Güncellendiğinde

```typescript
import { invalidatePostCache, invalidateUserFeedCache } from '../infrastructure/cache/cache-invalidation';

// post.service.ts içinde
async updatePost(postId: string, userId: string, data: any) {
  // Database'i güncelle
  await this.postRepo.update(postId, data);
  
  // Post cache'ini temizle
  await invalidatePostCache(postId);
  
  // Kullanıcının feed cache'ini temizle
  await invalidateUserFeedCache(userId);
  
  return { success: true };
}
```

#### Yeni Post Oluşturulduğunda

```typescript
import { invalidateUserFeedCache } from '../infrastructure/cache/cache-invalidation';

// post.service.ts içinde
async createPost(userId: string, data: any) {
  // Post'u oluştur
  const post = await this.postRepo.create(userId, data);
  
  // Kullanıcının feed cache'ini temizle (yeni post gösterilsin)
  await invalidateUserFeedCache(userId);
  
  // Takipçilerinin feed cache'lerini de temizle
  const followers = await this.getFollowers(userId);
  for (const follower of followers) {
    await invalidateUserFeedCache(follower.id);
  }
  
  return post;
}
```

#### User Hesabı Silindiğinde

```typescript
import { invalidateAllUserCache } from '../infrastructure/cache/cache-invalidation';

// user.service.ts içinde
async deleteUser(userId: string) {
  // User'ı sil
  await this.userRepo.delete(userId);
  
  // User'ın TÜM cache'lerini temizle
  await invalidateAllUserCache(userId);
  
  return { success: true };
}
```

---

## 📈 3. CACHE METRICS GÖRÜNTÜLEME

### A. Metrics Endpoint Oluştur

```typescript
// src/interfaces/cache/cache.router.ts (YENİ)
import { Router } from 'express';
import { cacheMetrics } from '../../infrastructure/cache/cache-metrics';
import { authMiddleware } from '../auth/auth.middleware';
import { requireRole } from '../../infrastructure/middleware/rbac.middleware';

const router = Router();

// Cache metrics (sadece admin)
router.get(
  '/metrics',
  authMiddleware,
  requireRole('ADMIN'),
  (req, res) => {
    const metrics = cacheMetrics.getMetrics();
    res.json({
      success: true,
      data: metrics,
    });
  }
);

// Cache metrics reset (sadece admin)
router.post(
  '/metrics/reset',
  authMiddleware,
  requireRole('ADMIN'),
  (req, res) => {
    cacheMetrics.reset();
    res.json({
      success: true,
      message: 'Cache metrics reset',
    });
  }
);

export default router;
```

### B. app.ts'e Ekle

```typescript
// src/interfaces/app.ts
import cacheRouter from './cache/cache.router';

// Routes
app.use('/api/cache', cacheRouter);
```

### C. Kullanım

```bash
# Cache metrics'i görüntüle
curl http://localhost:3000/api/cache/metrics \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Response:
{
  "success": true,
  "data": {
    "hits": 1250,
    "misses": 150,
    "total": 1400,
    "hitRate": "89.29%",
    "averageResponseTime": "12.45ms"
  }
}
```

---

## 🔍 4. CACHE vs DATABASE PERFORMANCE KARŞILAŞTIRMASI

### Test Senaryosu

```bash
# 1. İlk istek (Cache Miss - Yavaş)
time curl http://localhost:3000/api/user/profile/USER_ID \
  -H "Authorization: Bearer TOKEN"
# Beklenen: ~100-200ms

# 2. İkinci istek (Cache Hit - Hızlı)
time curl http://localhost:3000/api/user/profile/USER_ID \
  -H "Authorization: Bearer TOKEN"
# Beklenen: ~5-20ms

# 3. Cache'i temizle
curl -X DELETE http://localhost:3000/api/cache/user/USER_ID \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 4. Tekrar istek at (Cache Miss - Yavaş)
time curl http://localhost:3000/api/user/profile/USER_ID \
  -H "Authorization: Bearer TOKEN"
# Beklenen: ~100-200ms
```

### Log'lardan Analiz

```bash
# Son 100 request'in cache hit/miss dağılımı
docker exec tipbox_backend cat /app/logs/2025-12-23.log | \
  grep -E "served from (cache|database)" | \
  tail -100 | \
  awk '{print $NF}' | \
  sort | uniq -c

# Output:
#   85 "cache"
#   15 "database"
# Hit rate: %85
```

---

## 🎯 5. SWAGGER'DAN TEST ETME

### Adım 1: İlk Request (Cache Miss)

```
GET /api/user/profile/{userId}
Authorization: Bearer YOUR_TOKEN
```

**Response Headers:**
```
X-Response-Time: 145ms
```

**Log'da göreceksin:**
```json
{
  "message": "User profile served from database",
  "duration": "145ms",
  "source": "database",
  "cacheMiss": true
}
```

### Adım 2: İkinci Request (Cache Hit)

Aynı endpoint'i tekrar çağır:

```
GET /api/user/profile/{userId}
Authorization: Bearer YOUR_TOKEN
```

**Response Headers:**
```
X-Response-Time: 8ms
```

**Log'da göreceksin:**
```json
{
  "message": "User profile served from cache",
  "duration": "8ms",
  "source": "cache"
}
```

### Adım 3: Cache Invalidation Test

```
PUT /api/user/profile
Authorization: Bearer YOUR_TOKEN
Body: { "name": "New Name" }
```

Cache otomatik temizlenir. Sonra tekrar profili çek:

```
GET /api/user/profile/{userId}
```

Yine database'den gelecek (cache miss).

---

## 📊 6. REDIS CLI İLE MANUEL KONTROL

```bash
# Redis'e bağlan
docker exec -it tipbox_redis redis-cli

# Tüm cache key'lerini listele
KEYS *

# Belirli bir pattern'i ara
KEYS user:*
KEYS feed:*

# Bir key'in değerini gör
GET user:USER_ID:profile

# Bir key'in TTL'ini kontrol et
TTL user:USER_ID:profile
# Output: 3245 (saniye)

# Bir key'i manuel sil
DEL user:USER_ID:profile

# Pattern ile toplu silme
KEYS user:USER_ID:* | xargs redis-cli DEL

# Cache istatistikleri
INFO stats
```

---

## 🚀 7. PRODUCTION'DA MONİTORİNG

### CloudWatch / Datadog İçin

```typescript
// src/infrastructure/cache/cache-metrics.ts içine ekle

import { CloudWatch } from 'aws-sdk';

const cloudwatch = new CloudWatch({ region: 'eu-west-1' });

export async function publishCacheMetrics() {
  const metrics = cacheMetrics.getMetrics();
  
  await cloudwatch.putMetricData({
    Namespace: 'TipBox/Cache',
    MetricData: [
      {
        MetricName: 'CacheHitRate',
        Value: parseFloat(metrics.hitRate),
        Unit: 'Percent',
      },
      {
        MetricName: 'CacheHits',
        Value: metrics.hits,
        Unit: 'Count',
      },
      {
        MetricName: 'CacheMisses',
        Value: metrics.misses,
        Unit: 'Count',
      },
    ],
  }).promise();
}

// Her 5 dakikada bir CloudWatch'a gönder
setInterval(publishCacheMetrics, 5 * 60 * 1000);
```

---

## 🎯 ÖZET: HIZLI REFERANS

### Cache Hit/Miss Görme
```bash
# Log'lardan
docker logs -f tipbox_backend | grep -E "cache|database"

# Metrics endpoint'ten
curl http://localhost:3000/api/cache/metrics -H "Authorization: Bearer ADMIN_TOKEN"
```

### Cache Temizleme
```typescript
// Kod içinde
import { invalidateUserCache } from '../infrastructure/cache/cache-invalidation';
await invalidateUserCache(userId);

// Redis CLI'dan
docker exec tipbox_redis redis-cli DEL user:USER_ID:profile
```

### Performance Karşılaştırma
```bash
# Response header'ından
curl -I http://localhost:3000/api/endpoint

# Log'lardan
docker exec tipbox_backend cat /app/logs/2025-12-23.log | grep duration
```

### Tipik Değerler
- **Cache Hit**: 5-20ms ⚡
- **Database**: 50-200ms 🐢
- **Hit Rate Target**: >80% 🎯

