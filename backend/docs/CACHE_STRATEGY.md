# Cache Strategy Dokümantasyonu

**Proje:** Tipbox Backend  
**Tarih:** 23 Aralık 2025  
**Versiyon:** 1.0

---

## İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Cache Pattern](#cache-pattern)
3. [Cache Key Yönetimi](#cache-key-yönetimi)
4. [TTL Stratejisi](#ttl-stratejisi)
5. [Cache Invalidation](#cache-invalidation)
6. [Error Handling](#error-handling)
7. [Best Practices](#best-practices)
8. [Monitoring](#monitoring)

---

## Genel Bakış

Tipbox Backend'de **Redis** kullanılarak **Cache-Aside (Lazy Loading)** pattern'i uygulanmaktadır. Bu strateji ile:

- Önce cache kontrol edilir
- Cache miss durumunda database'den veri çekilir
- Çekilen veri cache'e yazılır
- Cache error durumunda graceful degradation ile uygulama çalışmaya devam eder

### Teknoloji Stack

- **Redis 7.x** - In-memory cache
- **Node.js redis client** - Redis bağlantısı
- **Circuit Breaker Pattern** - Cache failure handling

---

## Cache Pattern

### 1. Cache-Aside (Lazy Loading)

```typescript
async getUserProfile(userId: string) {
  const cacheKey = CACHE_KEYS.USER_PROFILE(userId);
  
  // 1. Cache kontrolü (graceful degradation)
  try {
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;
  } catch (error) {
    logger.warn('Cache error, falling back to database', { error, userId });
  }
  
  // 2. Database'den çek
  const user = await userRepo.findById(userId);
  
  // 3. Cache'e yaz (best effort)
  if (user) {
    try {
      await cacheService.set(cacheKey, user, CACHE_TTL.USER_PROFILE);
    } catch (error) {
      logger.warn('Cache set failed', { error, userId });
    }
  }
  
  return user;
}
```

### 2. Write-Through Pattern (Specific Cases)

Bazı kritik data için write-through pattern kullanılır:

```typescript
async updateUserProfile(userId: string, data: any) {
  // 1. Database'e yaz
  const updated = await userRepo.update(userId, data);
  
  // 2. Cache'i güncelle
  const cacheKey = CACHE_KEYS.USER_PROFILE(userId);
  await cacheService.set(cacheKey, updated, CACHE_TTL.USER_PROFILE);
  
  return updated;
}
```

### 3. Cache Invalidation Pattern

Data değiştiğinde cache'i invalidate et:

```typescript
async deleteUser(userId: string) {
  // 1. Database'den sil
  await userRepo.delete(userId);
  
  // 2. İlgili tüm cache'leri temizle
  await cacheService.delPattern(CACHE_PATTERNS.USER_ALL(userId));
}
```

---

## Cache Key Yönetimi

### Key Naming Convention

Tüm cache key'leri `src/infrastructure/cache/cache-keys.ts` dosyasında merkezi olarak yönetilir.

**Format:** `<entity>:<identifier>:<sub-entity>`

**Örnekler:**
- `user:abc123:profile`
- `post:xyz789:comments`
- `feed:user123:first:20`
- `product:prod456:reviews`

### Key Kategorileri

#### 1. User Related
```typescript
CACHE_KEYS.USER_PROFILE(userId)        // user:abc123:profile
CACHE_KEYS.USER_SETTINGS(userId)       // user:abc123:settings
CACHE_KEYS.USER_PRIVACY(userId)        // user:abc123:privacy
```

#### 2. Post Related
```typescript
CACHE_KEYS.POST(postId)                // post:xyz789
CACHE_KEYS.POST_COMMENTS(postId)       // post:xyz789:comments
CACHE_KEYS.POST_LIKES(postId)          // post:xyz789:likes
```

#### 3. Feed Related
```typescript
CACHE_KEYS.FEED(userId, cursor, limit) // feed:user123:first:20
CACHE_KEYS.FEED_TRENDING(period)       // feed:trending:daily
```

#### 4. Auth Related
```typescript
CACHE_KEYS.TOKEN_BLACKLIST(token)      // blacklist:eyJhbG...
CACHE_KEYS.LOGIN_ATTEMPTS(email)       // login-attempts:user@mail.com
```

### Pattern Matching

Wildcard pattern'ler ile toplu silme:

```typescript
CACHE_PATTERNS.USER_ALL(userId)        // user:abc123:*
CACHE_PATTERNS.FEED_USER(userId)       // feed:abc123:*
CACHE_PATTERNS.POST_ALL(postId)        // post:xyz789:*
```

---

## TTL Stratejisi

Tüm TTL değerleri `src/infrastructure/cache/cache-ttl.ts` dosyasında merkezi olarak yönetilir.

### TTL Kategorileri

#### 1. Real-time Data (60-300 saniye)
Çok sık değişen data:
- `POST_LIKES`: 300s (5 dk)
- `POST_STATS`: 300s (5 dk)
- `DM_UNREAD_COUNT`: 60s (1 dk)

#### 2. Dynamic Data (300-1800 saniye)
Sık değişen data:
- `FEED`: 600s (10 dk)
- `POST_COMMENTS`: 600s (10 dk)
- `WALLET_BALANCE`: 300s (5 dk)

#### 3. Semi-static Data (1800-7200 saniye)
Nadir değişen data:
- `USER_PROFILE`: 3600s (1 saat)
- `PRODUCT`: 3600s (1 saat)
- `USER_SETTINGS`: 7200s (2 saat)

#### 4. Static Data (7200+ saniye)
Çok nadir değişen data:
- `CATEGORY`: 7200s (2 saat)
- `STATIC_BRANDS`: 86400s (24 saat)
- `STATIC_TAGS`: 86400s (24 saat)

### TTL Best Practices

1. **Data değişim sıklığına göre TTL seç**
   - Sık değişiyorsa kısa TTL
   - Nadir değişiyorsa uzun TTL

2. **Trade-off: Freshness vs Performance**
   - Daha kısa TTL = Daha fresh data, daha fazla DB hit
   - Daha uzun TTL = Daha az DB hit, daha stale data

3. **Critical data için kısa TTL**
   - Wallet balance: 5 dk
   - Unread message count: 1 dk

4. **Static data için uzun TTL**
   - Kategoriler: 2 saat
   - Brand listesi: 24 saat

---

## Cache Invalidation

### 1. Manual Invalidation

Data değiştiğinde manuel olarak cache'i temizle:

```typescript
// User profil güncelleme
async updateProfile(userId: string, data: any) {
  await profileRepo.update(userId, data);
  await cacheService.del(CACHE_KEYS.USER_PROFILE(userId));
}
```

### 2. Pattern-based Invalidation

İlgili tüm cache'leri toplu temizleme:

```typescript
// User'ın tüm cache'lerini temizle
async invalidateUserCache(userId: string) {
  await cacheService.delPattern(CACHE_PATTERNS.USER_ALL(userId));
}
```

### 3. Event-based Invalidation

Önemli event'lerde cache temizleme:

```typescript
// Post beğenildiğinde stats cache'i invalidate et
async likePost(userId: string, postId: string) {
  await likeRepo.create(userId, postId);
  await cacheService.del(CACHE_KEYS.POST_STATS(postId));
  await cacheService.del(CACHE_KEYS.POST_LIKES(postId));
}
```

### 4. Cascade Invalidation

İlişkili data'ların cache'i de temizlenir:

```typescript
// Post silindiğinde ilgili tüm cache'ler temizlenir
async deletePost(postId: string) {
  await postRepo.delete(postId);
  
  // Post'un tüm cache'leri
  await cacheService.delPattern(CACHE_PATTERNS.POST_ALL(postId));
  
  // İlgili feed cache'leri (opsiyonel - TTL'e bırakılabilir)
  // await cacheService.delPattern(CACHE_PATTERNS.FEED_ALL());
}
```

---

## Error Handling

### 1. Graceful Degradation

Cache fail olsa bile uygulama çalışmaya devam eder:

```typescript
try {
  const cached = await cacheService.get(key);
  if (cached) return cached;
} catch (error) {
  logger.warn('Cache error, falling back to database', { error });
}
// Continue with database query
```

### 2. Circuit Breaker Pattern

`CacheService` içinde circuit breaker implementasyonu:

- **Threshold:** 5 ardışık hata
- **Timeout:** 60 saniye
- **Operation Timeout:** 5 saniye

```typescript
// Circuit breaker açık ise cache operasyonları skip edilir
if (this.isCircuitBreakerOpen()) {
  logger.debug('Circuit breaker open, skipping cache');
  return null;
}
```

### 3. Connection Handling

Redis bağlantı durumu sürekli kontrol edilir:

```typescript
if (!this.client || !this.isConnected) {
  logger.warn('Cache client not connected, skipping cache');
  return null;
}
```

### 4. Timeout Protection

Tüm cache operasyonları timeout korumalı:

```typescript
async withTimeout<T>(operation: Promise<T>, timeoutMs = 5000): Promise<T> {
  return Promise.race([
    operation,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Cache operation timeout')), timeoutMs)
    ),
  ]);
}
```

---

## Best Practices

### 1. Cache Key Usage

✅ **DO:**
```typescript
// Merkezi key kullan
const key = CACHE_KEYS.USER_PROFILE(userId);
await cacheService.get(key);
```

❌ **DON'T:**
```typescript
// Hard-coded key kullanma
await cacheService.get(`user:${userId}:profile`);
```

### 2. TTL Usage

✅ **DO:**
```typescript
// Merkezi TTL kullan
await cacheService.set(key, data, CACHE_TTL.USER_PROFILE);
```

❌ **DON'T:**
```typescript
// Magic number kullanma
await cacheService.set(key, data, 3600);
```

### 3. Error Handling

✅ **DO:**
```typescript
// Her zaman try-catch kullan
try {
  const cached = await cacheService.get(key);
  if (cached) return cached;
} catch (error) {
  logger.warn('Cache error', { error });
}
```

❌ **DON'T:**
```typescript
// Cache error'u ignore etme
const cached = await cacheService.get(key);
```

### 4. Cache Invalidation

✅ **DO:**
```typescript
// Data değiştiğinde cache'i temizle
await repo.update(id, data);
await cacheService.del(CACHE_KEYS.USER_PROFILE(id));
```

❌ **DON'T:**
```typescript
// Cache'i temizlemeyi unutma
await repo.update(id, data);
// Cache hala eski data'yı gösterecek!
```

---

## Monitoring

### Cache Metrics

Takip edilmesi gereken metrikler:

1. **Hit Rate**
   ```
   Hit Rate = (Cache Hits / Total Requests) * 100
   Target: >80%
   ```

2. **Miss Rate**
   ```
   Miss Rate = (Cache Misses / Total Requests) * 100
   Target: <20%
   ```

3. **Eviction Rate**
   ```
   Key'lerin memory limiti dolunca evict edilme oranı
   Target: <5%
   ```

4. **Connection Status**
   ```
   Redis bağlantı durumu
   Target: 99.9% uptime
   ```

5. **Operation Latency**
   ```
   Cache get/set operation süreleri
   Target: <10ms p95
   ```

### Logging

Cache operasyonları loglama:

```typescript
// Debug logs
logger.debug('Cache hit for user profile', { userId });
logger.debug('Cache miss for user profile', { userId });

// Warn logs
logger.warn('Cache error, falling back to database', { error, userId });
logger.warn('Circuit breaker activated', { errorCount });

// Error logs
logger.error('Failed to connect to Redis', { error });
```

### Health Checks

Health check endpoint'inde cache durumu:

```typescript
app.get('/health', async (req, res) => {
  const redisStatus = cacheService.isCacheConnected() ? 'healthy' : 'unhealthy';
  
  res.json({
    cache: {
      status: redisStatus,
      connected: cacheService.isCacheConnected()
    }
  });
});
```

---

## Örnekler

### Örnek 1: User Profile Cache

```typescript
async getUserProfile(userId: string): Promise<User | null> {
  const cacheKey = CACHE_KEYS.USER_PROFILE(userId);
  
  // Cache check
  try {
    const cached = await this.cacheService.get<User>(cacheKey);
    if (cached) {
      logger.debug('Cache hit for user profile', { userId });
      return cached;
    }
  } catch (error) {
    logger.warn('Cache error for user profile', { error, userId });
  }

  // Database fetch
  const user = await this.userRepo.findById(userId);
  
  // Cache set
  if (user) {
    try {
      await this.cacheService.set(cacheKey, user, CACHE_TTL.USER_PROFILE);
    } catch (error) {
      logger.warn('Failed to set user profile cache', { error, userId });
    }
  }
  
  return user;
}
```

### Örnek 2: Feed Cache with Pagination

```typescript
async getUserFeed(userId: string, cursor?: string, limit = 20) {
  const cacheKey = CACHE_KEYS.FEED(userId, cursor || 'first', limit);
  
  // Cache check
  try {
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;
  } catch (error) {
    logger.warn('Cache error for feed', { error, userId });
  }

  // Database fetch
  const feed = await this.feedRepo.getUserFeed(userId, cursor, limit);
  
  // Cache set
  try {
    await this.cacheService.set(cacheKey, feed, CACHE_TTL.FEED);
  } catch (error) {
    logger.warn('Failed to set feed cache', { error, userId });
  }
  
  return feed;
}
```

### Örnek 3: Cache Invalidation on Update

```typescript
async updateUserProfile(userId: string, data: ProfileUpdate) {
  // Database update
  const updated = await this.profileRepo.update(userId, data);
  
  // Invalidate related caches
  await this.cacheService.del(CACHE_KEYS.USER_PROFILE(userId));
  
  // Optionally: Update cache with new data (write-through)
  await this.cacheService.set(
    CACHE_KEYS.USER_PROFILE(userId),
    updated,
    CACHE_TTL.USER_PROFILE
  );
  
  return updated;
}
```

---

## Kaynaklar

- [Redis Best Practices](https://redis.io/docs/management/optimization/)
- [Cache-Aside Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/cache-aside)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)

---

**Son Güncelleme:** 23 Aralık 2025  
**Doküman Sahibi:** Backend Team

