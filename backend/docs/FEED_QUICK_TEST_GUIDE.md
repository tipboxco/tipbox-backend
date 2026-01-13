# 🧪 Feed Scoring Sistemi - Hızlı Test Rehberi

## 📋 Genel Bakış

Bu rehber, Feed Scoring sistemini **15 dakikada** baştan sona test etmenizi sağlar.

**Toplam Süre**: ~15 dakika  
**Zorluk**: Kolay  
**Gerekli**: Postman veya curl

---

## 🚀 Adım 1: Ortam Hazırlığı (2 dk)

### 1.1. Branch'i Kontrol Et

```bash
cd /Users/omerfaruk/Desktop/Dev/tipbox-projects/tipbox-backend

# feat/feed branch'inde olduğunuzdan emin olun
git branch
# * feat/feed olmalı

# Eğer değilse:
git checkout feat/feed
```

### 1.2. Redis'i Başlat

```bash
# Eğer çalışmıyorsa:
redis-cli ping
# Hata verirse:

# Docker ile başlat:
docker run -d --name tipbox-redis -p 6379:6379 redis:alpine

# Veya local Redis:
redis-server &

# Test et:
redis-cli ping
# PONG dönmeli
```

### 1.3. Dependencies Yükle

```bash
npm install

# Prisma client güncelle
npx prisma generate
```

---

## 📊 Adım 2: Database Migration (2 dk)

### 2.1. Migration'ı Çalıştır

```bash
# Development ortamında:
npx prisma migrate dev

# Veya production ortamında:
npx prisma migrate deploy
```

**Beklenen Output**:
```
✔ Generated Prisma Client
✔ The migration 20251227120000_add_feed_relevance_score_and_sources has been applied
```

### 2.2. Migration'ı Doğrula

```bash
# Prisma Studio'yu aç
npx prisma studio
```

**Tarayıcıda** http://localhost:5555 açılacak:
1. `feeds` tablosuna git
2. Sütunlarda `relevance_score` (DECIMAL) olmalı
3. Kapatabilirsin

**Veya SQL ile kontrol et**:
```bash
# PostgreSQL'e bağlan
psql -U your_user -d tipbox

# Kolon kontrolü
\d feeds

# Şunu görmeli:
# relevance_score | numeric(5,2) | not null | 0.00
```

---

## 🏃 Adım 3: Backend'i Başlat (1 dk)

### 3.1. Development Modda Başlat

```bash
# Terminal 1: Backend
npm run dev

# Backend başladığında göreceksiniz:
# Server running on port 3000
# Database connected
# Swagger docs: http://localhost:3000/api-docs
```

### 3.2. Worker'ları Başlat (Opsiyonel - Cleanup testi için)

```bash
# Terminal 2: Workers (yeni terminal)
npm run dev:workers

# Veya production'da:
pm2 start ecosystem.config.js --only tipbox-workers

# Göreceksiniz:
# FeedCleanupWorker started successfully
# Daily feed cleanup scheduled
```

---

## 🧪 Adım 4: API Testleri (5 dk)

### 4.1. Auth Token Al

```bash
# Login endpoint'ini çağır
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@user.com",
    "password": "yourpassword"
  }'

# Response'dan token'ı kopyala:
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "user": {...}
# }
```

**Token'ı kaydet** (sonraki adımlarda kullanacaksınız):
```bash
export TOKEN="your-token-here"
```

### 4.2. Test 1: Yeni Post Oluştur

```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "postType": "EXPERIENCE",
    "content": "Test post for feed scoring",
    "mainCategoryId": "your-category-id"
  }'

# Response:
# {
#   "id": "post-123",
#   "content": "Test post for feed scoring",
#   ...
# }
```

**📝 Not**: `post-123` ID'sini kaydet!

### 4.3. Test 2: Feed'i Getir ve Score Kontrol Et

```bash
curl -X GET http://localhost:3000/api/feed \
  -H "Authorization: Bearer $TOKEN"

# Response'da yeni post'u göreceksiniz:
# {
#   "items": [
#     {
#       "feedId": "feed-456",
#       "postId": "post-123",
#       "relevanceScore": 45.5,  // ✅ Score var!
#       "source": "CATEGORY_MATCH",
#       "seen": false,
#       ...
#     }
#   ],
#   "nextCursor": "..."
# }
```

**✅ Kontrol**:
- `relevanceScore` > 0 olmalı
- `source` değeri `TRUSTER`, `CATEGORY_MATCH`, vb. olmalı
- `seen` = false olmalı

### 4.4. Test 3: Feed'i Seen İşaretle

```bash
# Feed ID'sini yukarıdaki response'dan al (feed-456)
curl -X POST http://localhost:3000/api/feed/seen \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "feedIds": ["feed-456"]
  }'

# Response:
# {
#   "message": "Feeds marked as seen",
#   "count": 1
# }
```

**✅ Seen Penalty Test**:
```bash
# Feed'i tekrar getir
curl -X GET http://localhost:3000/api/feed \
  -H "Authorization: Bearer $TOKEN"

# Aynı feed'i bul:
# {
#   "feedId": "feed-456",
#   "relevanceScore": 22.75,  // ✅ Yarıya düştü! (45.5 → 22.75)
#   "seen": true,              // ✅ Seen = true
#   ...
# }
```

### 4.5. Test 4: User Feedback - Hide

```bash
curl -X POST http://localhost:3000/api/feed/feed-456/hide \
  -H "Authorization: Bearer $TOKEN"

# Response:
# {
#   "message": "Feed hidden"
# }

# Feed'i tekrar getir ve score'u kontrol et:
curl -X GET http://localhost:3000/api/feed \
  -H "Authorization: Bearer $TOKEN"

# Score şimdi %30'a düşmüş olmalı:
# "relevanceScore": 6.825  // (22.75 * 0.3)
```

### 4.6. Test 5: User Feedback - Save

```bash
# Başka bir feed ID'si ile test et
curl -X POST http://localhost:3000/api/feed/feed-789/save \
  -H "Authorization: Bearer $TOKEN"

# Response:
# {
#   "message": "Feed saved"
# }

# Feed'i tekrar getir:
curl -X GET http://localhost:3000/api/feed \
  -H "Authorization: Bearer $TOKEN"

# Score +10 artmış olmalı:
# Önceki: 30 → Şimdi: 40
```

---

## 🧹 Adım 5: Cleanup Testi (3 dk)

### 5.1. Düşük Score'lu Test Feed Oluştur

```bash
# Database'e doğrudan düşük score'lu feed ekle
psql -U your_user -d tipbox

INSERT INTO feeds (id, user_id, post_id, source, relevance_score, seen, created_at)
VALUES (
  'test-feed-low',
  'your-user-id',
  'any-post-id',
  'NEW_USER',
  2.0,  -- Threshold (2.5) altında
  false,
  NOW()
);

# Çıkış
\q
```

### 5.2. Cleanup Job'ı Manuel Tetikle

#### Yöntem 1: Script ile

`scripts/test-cleanup.ts` dosyası oluştur:

```typescript
import { FeedCleanupScheduler } from '../src/infrastructure/scheduler/feed-cleanup.scheduler';

async function testCleanup() {
  console.log('🧹 Starting manual cleanup...');
  
  const scheduler = new FeedCleanupScheduler();
  await scheduler.triggerCleanup();
  
  console.log('✅ Cleanup completed');
  await scheduler.close();
  
  process.exit(0);
}

testCleanup().catch(console.error);
```

Çalıştır:
```bash
npx ts-node scripts/test-cleanup.ts

# Output:
# 🧹 Starting manual cleanup...
# Deleted 1 low-score/old feed records in batch.
# ✅ Cleanup completed
```

#### Yöntem 2: Node REPL ile

```bash
node

# Node console'da:
const { FeedCleanupScheduler } = require('./dist/infrastructure/scheduler/feed-cleanup.scheduler');
const scheduler = new FeedCleanupScheduler();
scheduler.triggerCleanup().then(() => console.log('Done'));
```

### 5.3. Cleanup Sonucunu Doğrula

```bash
# Test feed'in silindiğini kontrol et
psql -U your_user -d tipbox

SELECT * FROM feeds WHERE id = 'test-feed-low';

# Sonuç: 0 rows (silindi ✅)
```

---

## 📊 Adım 6: Database'de Score Dağılımı (2 dk)

### 6.1. Score Distribution

```bash
psql -U your_user -d tipbox
```

```sql
-- Score dağılımı
SELECT 
  CASE 
    WHEN relevance_score < 10 THEN '0-10 (Low)'
    WHEN relevance_score < 30 THEN '10-30 (Medium)'
    WHEN relevance_score < 50 THEN '30-50 (High)'
    ELSE '50+ (Very High)'
  END as score_range,
  COUNT(*) as count,
  ROUND(AVG(relevance_score::numeric), 2) as avg_score
FROM feeds
GROUP BY score_range
ORDER BY score_range;

-- Beklenen output:
--  score_range   | count | avg_score 
-- ---------------+-------+-----------
--  0-10 (Low)    |   150 |      7.25
--  10-30 (Medium)|   580 |     22.50
--  30-50 (High)  |   220 |     42.15
--  50+ (Very High)|   50 |     68.40
```

### 6.2. Source Distribution

```sql
-- Hangi source'dan kaç feed var?
SELECT 
  source,
  COUNT(*) as count,
  ROUND(AVG(relevance_score::numeric), 2) as avg_score,
  COUNT(CASE WHEN seen THEN 1 END) as seen_count
FROM feeds
GROUP BY source
ORDER BY count DESC;

-- Beklenen output:
--      source         | count | avg_score | seen_count
-- --------------------+-------+-----------+------------
--  CATEGORY_MATCH     |   450 |     25.30 |        120
--  TRUSTER            |   320 |     45.50 |         80
--  NEW_USER           |   180 |     12.00 |         50
--  BOOSTED            |    50 |     35.20 |         10
```

### 6.3. Seen vs Unseen

```sql
-- Seen penalty etkisi
SELECT 
  seen,
  COUNT(*) as count,
  ROUND(AVG(relevance_score::numeric), 2) as avg_score,
  ROUND(MIN(relevance_score::numeric), 2) as min_score,
  ROUND(MAX(relevance_score::numeric), 2) as max_score
FROM feeds
GROUP BY seen;

-- Beklenen output:
--  seen  | count | avg_score | min_score | max_score
-- -------+-------+-----------+-----------+-----------
--  false |   800 |     35.50 |      5.00 |     95.00
--  true  |   200 |     17.75 |      2.50 |     47.50
-- (Seen score'lar yarı yarıya düşük ✅)
```

---

## 🔍 Adım 7: Log Kontrolü (1 dk)

### 7.1. Backend Logs

```bash
# Terminal'de backend loglarını izle
tail -f logs/app.log | grep -i "feed\|scoring\|cleanup"

# Göreceksiniz:
# Using FULL SCORING (postId: post-123)
# Trust score: 40, Inventory: 15, Engagement: 10, Recency: 10, Boost: 0
# Total score: 75
# Feed added to feeds with relevance scoring (feedCount: 150)
```

### 7.2. Cleanup Logs

```bash
# Cleanup job logları
tail -f logs/app.log | grep -i "cleanup"

# Göreceksiniz:
# Starting feed cleanup for low-score and old feeds...
# Deleted 25 low-score/old feed records in batch.
# Finished feed cleanup. Total deleted: 25 records.
```

---

## ✅ Başarı Kriterleri

Tüm testleri geçtiyseniz aşağıdakileri göreceksiniz:

### ✅ 1. Database

- [x] `feeds` tablosunda `relevance_score` kolonu var
- [x] 3 yeni index oluşturulmuş
- [x] Score'lar 0-110 arası değerler alıyor

### ✅ 2. Scoring

- [x] Yeni post oluşturulduğunda feed'e score ile ekleniyor
- [x] Trust relation varsa yüksek score (40+)
- [x] Kategori match varsa orta score (15+)
- [x] Default score minimum 10

### ✅ 3. Seen Penalty

- [x] Feed seen olunca score yarıya düşüyor
- [x] `seen` = true oluyor
- [x] `unseenFeedCount` azalıyor

### ✅ 4. User Feedback

- [x] Hide: Score %30'a düşüyor
- [x] Save: Score +10 artıyor
- [x] Report: Feed siliniyor

### ✅ 5. Cleanup

- [x] Düşük score'lu feedler siliniyor (< 2.5)
- [x] Seen feedler için daha agresif (< 1.5)
- [x] Eski feedler siliniyor (> 14 gün)

### ✅ 6. Performance

- [x] Feed API < 500ms response time
- [x] Scoring job başarıyla çalışıyor
- [x] Cleanup job başarıyla çalışıyor

---

## 🐛 Hata Durumlarında

### Hata 1: Migration Çalışmıyor

```bash
# Migration'ı reset et (DİKKAT: Test DB'de yapın!)
npx prisma migrate reset

# Veya manuel migration:
psql -U user -d tipbox < prisma/migrations/20251227120000_.../migration.sql
```

### Hata 2: Redis Bağlanamıyor

```bash
# Redis kontrol
redis-cli ping

# Çalışmıyorsa:
docker ps | grep redis
docker start tipbox-redis

# Veya yeni başlat:
docker run -d --name tipbox-redis -p 6379:6379 redis:alpine
```

### Hata 3: Scoring Çalışmıyor

```bash
# Logs kontrol et
tail -f logs/app.log | grep "ERROR.*scoring"

# Fallback score kullanılıyor mu?
grep "Fallback score" logs/app.log

# Çok fazla fallback varsa:
# - Database connection kontrol et
# - Trust relations kontrol et
# - Inventory kontrol et
```

### Hata 4: Cleanup Çalışmıyor

```bash
# Worker çalışıyor mu?
pm2 status

# Queue kontrol
redis-cli KEYS "bull:feed:cleanup:*"

# Worker restart
pm2 restart tipbox-workers
```

---

## 📊 Quick Validation Script

Hızlıca tüm sistemi test etmek için:

```bash
# test-feed-system.sh oluştur
cat > test-feed-system.sh << 'EOF'
#!/bin/bash

echo "🧪 Testing Feed Scoring System..."

# 1. Redis check
echo "1️⃣  Checking Redis..."
redis-cli ping || exit 1
echo "   ✅ Redis OK"

# 2. Database check
echo "2️⃣  Checking Database..."
psql -U user -d tipbox -c "SELECT column_name FROM information_schema.columns WHERE table_name='feeds' AND column_name='relevance_score';" | grep relevance_score || exit 1
echo "   ✅ Database OK"

# 3. Backend check
echo "3️⃣  Checking Backend..."
curl -s http://localhost:3000/health | grep -q "ok" || exit 1
echo "   ✅ Backend OK"

# 4. Feed API check
echo "4️⃣  Checking Feed API..."
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/feed | grep -q "relevanceScore" || exit 1
echo "   ✅ Feed API OK"

echo ""
echo "🎉 All tests passed!"
EOF

chmod +x test-feed-system.sh
./test-feed-system.sh
```

---

## 🎓 Sonraki Adımlar

Testler başarılı olduysa:

1. **Production'a Hazırlık**
   ```bash
   # Build
   npm run build
   
   # Production migration
   NODE_ENV=production npx prisma migrate deploy
   
   # PM2 ile start
   pm2 start ecosystem.config.js
   ```

2. **Monitoring Kurulumu**
   - Prometheus metrics setup
   - Grafana dashboard
   - Alert rules

3. **Frontend Entegrasyonu**
   - Viewport tracking implement et
   - Batch seen tracking ekle
   - User feedback UI

---

## 📚 Ek Kaynaklar

- **Detaylı Test Guide**: `docs/FEED_TESTING_GUIDE.md`
- **Setup Guide**: `docs/FEED_SETUP_GUIDE.md`
- **System Docs**: `docs/FEED_SCORING_SYSTEM.md`
- **API Reference**: Swagger UI → http://localhost:3000/api-docs

---

## 💡 Pro Tips

1. **Postman Collection Oluştur**
   - Tüm feed endpoint'lerini koleksiyona ekle
   - Token'ı environment variable yap
   - Test senaryolarını kaydet

2. **Test Data Oluştur**
   - Farklı score'lu feedler oluştur
   - Trust relations ekle
   - Category matches ekle

3. **Performance Test**
   - 1000 feed ile getirme süresi
   - Scoring service response time
   - Cleanup job duration

4. **Monitoring**
   - `pm2 logs` ile live takip
   - `logs/app.log` ile detaylı analiz
   - Redis queues ile job tracking

---

**Test Süresi**: ~15 dakika  
**Başarı Oranı**: %100 bekleniyor  
**Son Güncelleme**: 27 Aralık 2025

✅ **Sisteminiz Test İçin Hazır!**

