# Feed Scoring System - Setup ve Deployment Guide

## 🚀 Hızlı Başlangıç

### Prerequisites

```bash
# Node.js 18+
node --version

# PostgreSQL 14+
psql --version

# Redis 6+ (BullMQ için)
redis-cli --version
```

### 1. Database Migration

```bash
# Development
npm run prisma:migrate:dev

# Production
npm run prisma:migrate:deploy

# Prisma Client güncelle
npx prisma generate
```

### 2. Environment Variables

`.env` dosyasına ekleyin:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/tipbox"

# Redis (BullMQ için)
REDIS_HOST="localhost"
REDIS_PORT="6379"

# Feed Configuration (optional - defaults kullanılır)
FEED_SCORE_MIN_THRESHOLD=5
FEED_CLEANUP_THRESHOLD_UNSEEN=2.5
FEED_CLEANUP_THRESHOLD_SEEN=1.5
FEED_MAX_PER_USER=2000
FEED_TIME_WINDOW_DAYS=14
FEED_CLEANUP_CRON="0 2 * * *"
```

### 3. Redis Başlat

```bash
# Docker ile
docker run -d --name tipbox-redis -p 6379:6379 redis:alpine

# Veya local Redis
redis-server
```

### 4. Worker ve Scheduler Başlat

```bash
# Development
npm run dev:workers

# Production (PM2 ile)
pm2 start ecosystem.config.js
```

### 5. Test Et

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Specific test file
npm test -- feed-scoring.service.test.ts
```

## 📊 Production Deployment

### Step 1: Database Backup

```bash
# Backup oluştur
pg_dump -U user -h localhost tipbox > backup_$(date +%Y%m%d).sql

# Veya
npm run db:backup
```

### Step 2: Migration Çalıştır

```bash
# Test environment'ta önce test et
NODE_ENV=staging npm run prisma:migrate:deploy

# Production'da çalıştır
NODE_ENV=production npm run prisma:migrate:deploy
```

### Step 3: Existing Feeds için Score Hesaplama (Optional)

Eğer mevcut feed kayıtlarınız varsa:

```typescript
// scripts/calculate-existing-scores.ts
import { PrismaClient } from '@prisma/client';
import { FeedScoringService } from '../src/application/feed/feed-scoring.service';

const prisma = new PrismaClient();
const scoringService = new FeedScoringService();

async function migrateScores() {
  const BATCH_SIZE = 1000;
  let processed = 0;
  
  while (true) {
    const feeds = await prisma.feed.findMany({
      where: { relevanceScore: 0 }, // Score hesaplanmamış olanlar
      take: BATCH_SIZE,
      include: {
        post: {
          include: {
            user: true,
          }
        }
      }
    });

    if (feeds.length === 0) break;

    for (const feed of feeds) {
      try {
        const result = await scoringService.calculateFullScore(
          feed.userId,
          feed.postId,
          feed.post.userId,
          {
            mainCategoryId: feed.post.mainCategoryId,
            subCategoryId: feed.post.subCategoryId,
            productGroupId: feed.post.productGroupId,
            productId: feed.post.productId,
            likesCount: (feed.post as any).likesCount || 0,
            commentsCount: (feed.post as any).commentsCount || 0,
            viewsCount: (feed.post as any).viewsCount || 0,
            sharesCount: (feed.post as any).sharesCount || 0,
            isBoosted: feed.post.isBoosted,
            boostedUntil: feed.post.boostedUntil,
            createdAt: feed.post.createdAt,
          }
        );

        await prisma.feed.update({
          where: { id: feed.id },
          data: {
            relevanceScore: result.score,
            source: result.source,
          }
        });

        processed++;
      } catch (error) {
        console.error(`Failed to score feed ${feed.id}:`, error);
        // Fallback: Set default score
        await prisma.feed.update({
          where: { id: feed.id },
          data: { relevanceScore: 10 }
        });
      }
    }

    console.log(`Processed ${processed} feeds...`);
  }

  console.log(`Migration complete. Total: ${processed} feeds`);
}

migrateScores()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Çalıştır:

```bash
npx ts-node scripts/calculate-existing-scores.ts
```

### Step 4: Worker ve Scheduler Deploy

#### PM2 Configuration

`ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'tipbox-api',
      script: 'dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      }
    },
    {
      name: 'tipbox-workers',
      script: 'dist/infrastructure/workers/index.js',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
      }
    }
  ]
};
```

Deploy:

```bash
# Build
npm run build

# Start workers
pm2 start ecosystem.config.js --only tipbox-workers

# Start API
pm2 start ecosystem.config.js --only tipbox-api

# Save configuration
pm2 save

# Auto-restart on reboot
pm2 startup
```

### Step 5: Monitoring Setup

#### Prometheus Metrics (Optional)

```typescript
// src/infrastructure/monitoring/metrics.ts
import client from 'prom-client';

const register = new client.Register();

export const feedScoreHistogram = new client.Histogram({
  name: 'feed_score_distribution',
  help: 'Distribution of feed relevance scores',
  buckets: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  registers: [register],
});

export const feedScoringDuration = new client.Histogram({
  name: 'feed_scoring_duration_ms',
  help: 'Duration of feed scoring operations',
  labelNames: ['type'], // 'full' or 'fast'
  buckets: [1, 5, 10, 25, 50, 100, 250, 500],
  registers: [register],
});

export const feedCleanupCounter = new client.Counter({
  name: 'feed_cleanup_deleted_total',
  help: 'Total number of feeds deleted by cleanup',
  labelNames: ['reason'], // 'low_score', 'old', 'user_limit'
  registers: [register],
});
```

Metrics endpoint:

```typescript
// src/interfaces/monitoring/metrics.router.ts
import { Router } from 'express';
import { register } from '../../infrastructure/monitoring/metrics';

const router = Router();

router.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

export default router;
```

## 🔍 Post-Deployment Verification

### 1. Health Checks

```bash
# API health
curl http://localhost:3000/health

# Metrics
curl http://localhost:3000/metrics | grep feed

# Redis connection
redis-cli ping
```

### 2. Database Checks

```sql
-- Verify relevance_score column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'feeds' AND column_name = 'relevance_score';

-- Verify indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'feeds' 
  AND indexname LIKE 'idx_feeds_%';

-- Check score distribution
SELECT 
  CASE 
    WHEN relevance_score < 10 THEN '0-10'
    WHEN relevance_score < 30 THEN '10-30'
    WHEN relevance_score < 50 THEN '30-50'
    ELSE '50+'
  END as score_range,
  COUNT(*) as count
FROM feeds
GROUP BY score_range
ORDER BY score_range;
```

### 3. Worker Status

```bash
# PM2
pm2 status
pm2 logs tipbox-workers --lines 50

# BullMQ queue status
redis-cli KEYS "bull:feed:cleanup:*"
redis-cli LLEN "bull:feed:cleanup:wait"
redis-cli LLEN "bull:feed:cleanup:active"
redis-cli LLEN "bull:feed:cleanup:completed"
redis-cli LLEN "bull:feed:cleanup:failed"
```

### 4. Test Scoring

```bash
# Create test post
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test post", "postType": "EXPERIENCE"}'

# Check feed creation
curl http://localhost:3000/api/feed \
  -H "Authorization: Bearer $TOKEN" | jq '.items[0]'

# Expected output:
# {
#   "feedId": "xxx",
#   "relevanceScore": 40+,  // If trust relation exists
#   "source": "TRUSTER",
#   "seen": false,
#   ...
# }
```

### 5. Test Cleanup (Manual Trigger)

```typescript
// src/scripts/test-cleanup.ts
import { FeedCleanupScheduler } from '../infrastructure/scheduler/feed-cleanup.scheduler';

async function testCleanup() {
  const scheduler = new FeedCleanupScheduler();
  await scheduler.triggerCleanup();
  console.log('Cleanup triggered successfully');
  await scheduler.close();
}

testCleanup();
```

```bash
npx ts-node src/scripts/test-cleanup.ts
```

## 🐛 Troubleshooting

### Issue: Migration Failed

```bash
# Reset migration (DIKKAT: Data kaybı olabilir)
npx prisma migrate reset

# Veya manuel SQL ile fix
psql -U user -d tipbox -f prisma/migrations/XXXXXX/migration.sql
```

### Issue: Workers Başlamıyor

```bash
# Redis connection test
redis-cli ping

# Check logs
pm2 logs tipbox-workers --err

# Restart workers
pm2 restart tipbox-workers
```

### Issue: Scoring Hataları

```bash
# Check logs for errors
tail -f logs/app.log | grep "ERROR.*scoring"

# Test scoring service
npx ts-node -e "
  const { FeedScoringService } = require('./dist/application/feed/feed-scoring.service');
  const service = new FeedScoringService();
  service.calculateFullScore('user-id', 'post-id', 'author-id', {...})
    .then(console.log)
    .catch(console.error);
"
```

### Issue: Cleanup Çalışmıyor

```bash
# Check scheduled jobs
redis-cli KEYS "bull:feed:cleanup:repeat:*"

# Check job status
redis-cli HGETALL "bull:feed:cleanup:1"

# Manually trigger
curl -X POST http://localhost:3000/admin/cleanup/trigger \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Issue: Performance Sorunları

```sql
-- Slow queries
SELECT 
  query, 
  mean_exec_time, 
  calls 
FROM pg_stat_statements 
WHERE query LIKE '%feeds%' 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Missing indexes
SELECT 
  schemaname, 
  tablename, 
  indexname 
FROM pg_indexes 
WHERE tablename = 'feeds';

-- Table size
SELECT 
  pg_size_pretty(pg_total_relation_size('feeds')) as total_size,
  pg_size_pretty(pg_relation_size('feeds')) as table_size,
  pg_size_pretty(pg_indexes_size('feeds')) as indexes_size;
```

## 📈 Monitoring Dashboards

### Grafana Dashboard (JSON)

```json
{
  "dashboard": {
    "title": "Feed Scoring System",
    "panels": [
      {
        "title": "Feed Score Distribution",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, feed_score_distribution)"
          }
        ]
      },
      {
        "title": "Scoring Performance",
        "targets": [
          {
            "expr": "rate(feed_scoring_duration_ms_sum[5m]) / rate(feed_scoring_duration_ms_count[5m])"
          }
        ]
      },
      {
        "title": "Cleanup Stats",
        "targets": [
          {
            "expr": "rate(feed_cleanup_deleted_total[1d])"
          }
        ]
      }
    ]
  }
}
```

### CloudWatch Alarms (AWS)

```yaml
# cloudwatch-alarms.yaml
FeedCleanupFailed:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: feed-cleanup-failed
    MetricName: CleanupErrors
    Namespace: Tipbox/Feed
    Statistic: Sum
    Period: 3600
    EvaluationPeriods: 1
    Threshold: 1
    ComparisonOperator: GreaterThanThreshold

FeedQuerySlow:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: feed-query-slow
    MetricName: QueryDuration
    Namespace: Tipbox/Feed
    Statistic: Average
    Period: 300
    EvaluationPeriods: 2
    Threshold: 500
    ComparisonOperator: GreaterThanThreshold
```

## 🔄 Rollback Plan

Eğer deployment sorunlu olursa:

### 1. Quick Rollback

```bash
# Revert migration
npx prisma migrate resolve --rolled-back XXXXXX_add_feed_relevance_score

# Restore previous code
git revert <commit-hash>
pm2 restart all
```

### 2. Full Rollback

```bash
# Stop services
pm2 stop tipbox-workers
pm2 stop tipbox-api

# Restore database
psql -U user -d tipbox < backup_20251227.sql

# Checkout previous version
git checkout <previous-commit>
npm install
npm run build

# Restart
pm2 start ecosystem.config.js
```

## 📞 Support

- **Dokümantasyon**: `docs/FEED_SCORING_SYSTEM.md`
- **Test Guide**: `docs/FEED_TESTING_GUIDE.md`
- **Logs**: `logs/app.log`, `pm2 logs`
- **Monitoring**: `http://localhost:3000/metrics`

---

**Son Güncelleme**: 27 Aralık 2025
**Version**: 1.0.0
**Status**: ✅ Production Ready

