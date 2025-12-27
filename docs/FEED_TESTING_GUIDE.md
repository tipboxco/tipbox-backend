# Feed Scoring Sistemi - Test Guide

## 📋 İçindekiler

1. [Test Ortamı Kurulumu](#test-ortamı-kurulumu)
2. [Unit Testler](#unit-testler)
3. [Integration Testler](#integration-testler)
4. [API Endpoint Testleri](#api-endpoint-testleri)
5. [Performance Testleri](#performance-testleri)
6. [Manuel Test Senaryoları](#manuel-test-senaryoları)
7. [Production Monitoring](#production-monitoring)

## 🔧 Test Ortamı Kurulumu

### Prerequisites

```bash
# Dependencies
npm install
npm install --save-dev @types/jest jest ts-jest supertest

# Database setup
npx prisma migrate dev
npx prisma generate
npx prisma db seed  # Test data

# Redis (cleanup worker için)
docker run -d -p 6379:6379 redis:alpine
```

### Test Database

```bash
# .env.test dosyası
DATABASE_URL="postgresql://user:pass@localhost:5432/tipbox_test"
REDIS_HOST="localhost"
REDIS_PORT="6379"
```

### Test Data Oluşturma

```typescript
// prisma/seed.test.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedTestData() {
  // 3 test kullanıcısı
  const user1 = await prisma.user.create({
    data: {
      id: 'user-1-uuid',
      email: 'user1@test.com',
      status: 'ACTIVE',
      profile: {
        create: {
          displayName: 'Test User 1',
          unseenFeedCount: 0,
        }
      }
    }
  });

  const user2 = await prisma.user.create({
    data: {
      id: 'user-2-uuid',
      email: 'user2@test.com',
      status: 'ACTIVE',
      profile: {
        create: {
          displayName: 'Test User 2',
          unseenFeedCount: 0,
        }
      }
    }
  });

  // Trust relation: user1 trusts user2
  await prisma.trustRelation.create({
    data: {
      trusterId: user1.id,
      trustedUserId: user2.id,
    }
  });

  // 10 test post
  for (let i = 0; i < 10; i++) {
    await prisma.contentPost.create({
      data: {
        id: `post-${i}`,
        userId: user2.id,
        postType: 'EXPERIENCE',
        content: `Test post ${i}`,
        isBoosted: i % 3 === 0, // Her 3 postta 1 boosted
      }
    });
  }
}

seedTestData();
```

## 🧪 Unit Testler

### 1. FeedScoringService Tests

```typescript
// tests/unit/feed-scoring.service.test.ts
import { FeedScoringService } from '../../src/application/feed/feed-scoring.service';
import { PrismaClient } from '@prisma/client';

describe('FeedScoringService', () => {
  let scoringService: FeedScoringService;
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
    scoringService = new FeedScoringService();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('calculateFullScore', () => {
    it('should give high score for trust relation', async () => {
      const userId = 'user-1-uuid';
      const postAuthorId = 'user-2-uuid'; // user1 trusts user2
      const postId = 'post-1';

      const result = await scoringService.calculateFullScore(
        userId,
        postId,
        postAuthorId,
        {
          mainCategoryId: null,
          subCategoryId: null,
          productGroupId: null,
          productId: null,
          likesCount: 0,
          commentsCount: 0,
          viewsCount: 0,
          sharesCount: 0,
          isBoosted: false,
          boostedUntil: null,
          createdAt: new Date(),
        }
      );

      expect(result.score).toBeGreaterThanOrEqual(40); // Trust score
      expect(result.source).toBe('TRUSTER');
      expect(result.factors.trustScore).toBe(40);
    });

    it('should give bonus for mutual trust', async () => {
      // Create mutual trust
      await prisma.trustRelation.create({
        data: {
          trusterId: 'user-2-uuid',
          trustedUserId: 'user-1-uuid',
        }
      });

      const result = await scoringService.calculateFullScore(
        'user-1-uuid',
        'post-1',
        'user-2-uuid',
        { /* post data */ }
      );

      expect(result.factors.trustScore).toBe(35); // Mutual trust
      expect(result.source).toBe('MUTUAL_TRUST');

      // Cleanup
      await prisma.trustRelation.deleteMany({
        where: {
          trusterId: 'user-2-uuid',
          trustedUserId: 'user-1-uuid',
        }
      });
    });

    it('should give recency bonus for new posts', async () => {
      const now = new Date();
      
      const result = await scoringService.calculateFullScore(
        'user-1-uuid',
        'post-1',
        'user-2-uuid',
        {
          /* ... */
          createdAt: now, // Yeni post
        }
      );

      expect(result.factors.recencyScore).toBe(10); // 48 saat içinde
    });

    it('should give boost score for boosted posts', async () => {
      const boostedUntil = new Date();
      boostedUntil.setDate(boostedUntil.getDate() + 7); // 7 gün boost

      const result = await scoringService.calculateFullScore(
        'user-1-uuid',
        'post-1',
        'user-2-uuid',
        {
          /* ... */
          isBoosted: true,
          boostedUntil,
        }
      );

      expect(result.factors.boostScore).toBeGreaterThanOrEqual(5);
      expect(result.factors.boostScore).toBeLessThanOrEqual(10);
    });

    it('should give inventory score for product match', async () => {
      // Create inventory item
      const product = await prisma.product.create({
        data: {
          id: 'product-1',
          name: 'Test Product',
        }
      });

      await prisma.inventory.create({
        data: {
          userId: 'user-1-uuid',
          productId: product.id,
        }
      });

      const result = await scoringService.calculateFullScore(
        'user-1-uuid',
        'post-1',
        'user-2-uuid',
        {
          /* ... */
          productId: product.id,
        }
      );

      expect(result.factors.inventoryScore).toBe(30); // Exact match
      expect(result.source).toBe('INVENTORY_MATCH');

      // Cleanup
      await prisma.inventory.deleteMany({
        where: { userId: 'user-1-uuid', productId: product.id }
      });
      await prisma.product.delete({ where: { id: product.id } });
    });
  });

  describe('calculateFastScore', () => {
    it('should be faster than full scoring', async () => {
      const startFull = Date.now();
      await scoringService.calculateFullScore(/* ... */);
      const fullTime = Date.now() - startFull;

      const startFast = Date.now();
      await scoringService.calculateFastScore(/* ... */);
      const fastTime = Date.now() - startFast;

      expect(fastTime).toBeLessThan(fullTime / 5); // At least 5x faster
    });

    it('should give category match score', async () => {
      const result = await scoringService.calculateFastScore(
        'user-1-uuid',
        {
          mainCategoryId: 'category-1',
          subCategoryId: null,
          isBoosted: false,
          boostedUntil: null,
          createdAt: new Date(),
        }
      );

      // Assuming user has category-1 in preferences
      expect(result.score).toBeGreaterThanOrEqual(15);
    });
  });
});
```

### 2. FeedCleanupService Tests

```typescript
// tests/unit/feed-cleanup.service.test.ts
import { FeedCleanupService } from '../../src/application/feed/feed-cleanup.service';
import { PrismaClient } from '@prisma/client';

describe('FeedCleanupService', () => {
  let cleanupService: FeedCleanupService;
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
    cleanupService = new FeedCleanupService();
  });

  describe('cleanupLowScoreFeeds', () => {
    it('should delete unseen feeds below threshold (2.5)', async () => {
      // Create low-score unseen feed
      await prisma.feed.create({
        data: {
          id: 'feed-low-1',
          userId: 'user-1-uuid',
          postId: 'post-1',
          source: 'NEW_USER',
          seen: false,
          relevanceScore: 2.0, // Below 2.5
        }
      });

      await cleanupService.cleanupLowScoreFeeds();

      const deleted = await prisma.feed.findUnique({
        where: { id: 'feed-low-1' }
      });

      expect(deleted).toBeNull();
    });

    it('should delete seen feeds below threshold (1.5)', async () => {
      await prisma.feed.create({
        data: {
          id: 'feed-low-2',
          userId: 'user-1-uuid',
          postId: 'post-1',
          source: 'NEW_USER',
          seen: true,
          relevanceScore: 1.2, // Below 1.5
        }
      });

      await cleanupService.cleanupLowScoreFeeds();

      const deleted = await prisma.feed.findUnique({
        where: { id: 'feed-low-2' }
      });

      expect(deleted).toBeNull();
    });

    it('should delete feeds older than 14 days', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 20); // 20 days ago

      await prisma.feed.create({
        data: {
          id: 'feed-old-1',
          userId: 'user-1-uuid',
          postId: 'post-1',
          source: 'NEW_USER',
          seen: false,
          relevanceScore: 50, // High score but old
          createdAt: oldDate,
        }
      });

      await cleanupService.cleanupLowScoreFeeds();

      const deleted = await prisma.feed.findUnique({
        where: { id: 'feed-old-1' }
      });

      expect(deleted).toBeNull();
    });

    it('should NOT delete high-score recent feeds', async () => {
      await prisma.feed.create({
        data: {
          id: 'feed-keep-1',
          userId: 'user-1-uuid',
          postId: 'post-1',
          source: 'TRUSTER',
          seen: false,
          relevanceScore: 60, // High score
          createdAt: new Date(),
        }
      });

      await cleanupService.cleanupLowScoreFeeds();

      const kept = await prisma.feed.findUnique({
        where: { id: 'feed-keep-1' }
      });

      expect(kept).not.toBeNull();

      // Cleanup
      await prisma.feed.delete({ where: { id: 'feed-keep-1' } });
    });
  });

  describe('optimizeUserFeeds', () => {
    it('should keep max 1000 feeds per user', async () => {
      const userId = 'user-1-uuid';

      // Create 1100 feeds
      const feeds = [];
      for (let i = 0; i < 1100; i++) {
        feeds.push({
          id: `feed-bulk-${i}`,
          userId,
          postId: 'post-1',
          source: 'NEW_USER',
          seen: false,
          relevanceScore: Math.random() * 100,
        });
      }

      await prisma.feed.createMany({ data: feeds });

      await cleanupService.optimizeUserFeeds(userId);

      const count = await prisma.feed.count({ where: { userId } });

      expect(count).toBeLessThanOrEqual(1000);

      // Cleanup
      await prisma.feed.deleteMany({ where: { userId } });
    });

    it('should keep highest score feeds', async () => {
      const userId = 'user-1-uuid';

      // Create feeds with known scores
      await prisma.feed.createMany({
        data: [
          { id: 'feed-high-1', userId, postId: 'post-1', source: 'TRUSTER', relevanceScore: 90 },
          { id: 'feed-high-2', userId, postId: 'post-2', source: 'TRUSTER', relevanceScore: 85 },
          { id: 'feed-low-1', userId, postId: 'post-3', source: 'NEW_USER', relevanceScore: 10 },
          { id: 'feed-low-2', userId, postId: 'post-4', source: 'NEW_USER', relevanceScore: 15 },
        ]
      });

      // Assume limit is 2
      await cleanupService.optimizeUserFeeds(userId);

      const remaining = await prisma.feed.findMany({
        where: { userId },
        orderBy: { relevanceScore: 'desc' }
      });

      expect(remaining[0].id).toBe('feed-high-1');
      expect(remaining[1].id).toBe('feed-high-2');

      // Cleanup
      await prisma.feed.deleteMany({ where: { userId } });
    });
  });
});
```

### 3. FeedPrismaRepository Tests

```typescript
// tests/unit/feed-prisma.repository.test.ts
import { FeedPrismaRepository } from '../../src/infrastructure/repositories/feed-prisma.repository';

describe('FeedPrismaRepository', () => {
  let repository: FeedPrismaRepository;

  beforeAll(() => {
    repository = new FeedPrismaRepository();
  });

  describe('markAsSeen', () => {
    it('should set seen to true and apply 50% penalty', async () => {
      // Create feed with score 60
      const feed = await prisma.feed.create({
        data: {
          id: 'feed-penalty-1',
          userId: 'user-1-uuid',
          postId: 'post-1',
          source: 'TRUSTER',
          seen: false,
          relevanceScore: 60,
        }
      });

      await repository.markAsSeen(feed.id);

      const updated = await prisma.feed.findUnique({
        where: { id: feed.id }
      });

      expect(updated?.seen).toBe(true);
      expect(updated?.relevanceScore).toBe(30); // 60 * 0.5
    });

    it('should decrement unseenFeedCount', async () => {
      // Get initial count
      const profile = await prisma.profile.findUnique({
        where: { userId: 'user-1-uuid' }
      });
      const initialCount = profile?.unseenFeedCount || 0;

      const feed = await prisma.feed.create({
        data: {
          id: 'feed-count-1',
          userId: 'user-1-uuid',
          postId: 'post-1',
          source: 'TRUSTER',
          seen: false,
          relevanceScore: 50,
        }
      });

      await repository.markAsSeen(feed.id);

      const updatedProfile = await prisma.profile.findUnique({
        where: { userId: 'user-1-uuid' }
      });

      expect(updatedProfile?.unseenFeedCount).toBe(initialCount - 1);
    });
  });

  describe('markMultipleAsSeen', () => {
    it('should batch update multiple feeds', async () => {
      const feeds = await prisma.feed.createMany({
        data: [
          { id: 'feed-batch-1', userId: 'user-1-uuid', postId: 'post-1', source: 'TRUSTER', relevanceScore: 60 },
          { id: 'feed-batch-2', userId: 'user-1-uuid', postId: 'post-2', source: 'TRUSTER', relevanceScore: 40 },
          { id: 'feed-batch-3', userId: 'user-1-uuid', postId: 'post-3', source: 'TRUSTER', relevanceScore: 80 },
        ]
      });

      const count = await repository.markMultipleAsSeen([
        'feed-batch-1',
        'feed-batch-2',
        'feed-batch-3'
      ]);

      expect(count).toBe(3);

      const updated = await prisma.feed.findMany({
        where: {
          id: { in: ['feed-batch-1', 'feed-batch-2', 'feed-batch-3'] }
        }
      });

      expect(updated.every(f => f.seen)).toBe(true);
      expect(updated[0].relevanceScore).toBe(30); // 60 * 0.5
      expect(updated[1].relevanceScore).toBe(20); // 40 * 0.5
      expect(updated[2].relevanceScore).toBe(40); // 80 * 0.5
    });
  });

  describe('updateScoreByFeedback', () => {
    it('should reduce score for hide feedback', async () => {
      const feed = await prisma.feed.create({
        data: {
          id: 'feed-hide-1',
          userId: 'user-1-uuid',
          postId: 'post-1',
          source: 'TRUSTER',
          relevanceScore: 30,
        }
      });

      await repository.updateScoreByFeedback(feed.id, 0.3, null);

      const updated = await prisma.feed.findUnique({
        where: { id: feed.id }
      });

      expect(updated?.relevanceScore).toBe(9); // 30 * 0.3
    });

    it('should increase score for save feedback', async () => {
      const feed = await prisma.feed.create({
        data: {
          id: 'feed-save-1',
          userId: 'user-1-uuid',
          postId: 'post-1',
          source: 'TRUSTER',
          relevanceScore: 30,
        }
      });

      await repository.updateScoreByFeedback(feed.id, null, 10);

      const updated = await prisma.feed.findUnique({
        where: { id: feed.id }
      });

      expect(updated?.relevanceScore).toBe(40); // 30 + 10
    });
  });

  describe('findByUserId', () => {
    it('should sort by relevance score desc', async () => {
      await prisma.feed.createMany({
        data: [
          { id: 'feed-sort-1', userId: 'user-1-uuid', postId: 'post-1', source: 'TRUSTER', relevanceScore: 30 },
          { id: 'feed-sort-2', userId: 'user-1-uuid', postId: 'post-2', source: 'TRUSTER', relevanceScore: 70 },
          { id: 'feed-sort-3', userId: 'user-1-uuid', postId: 'post-3', source: 'TRUSTER', relevanceScore: 50 },
        ]
      });

      const result = await repository.findByUserId('user-1-uuid', { limit: 10 });

      expect(result.feeds[0].id).toBe('feed-sort-2'); // 70
      expect(result.feeds[1].id).toBe('feed-sort-3'); // 50
      expect(result.feeds[2].id).toBe('feed-sort-1'); // 30
    });
  });
});
```

## 🔗 Integration Testler

```typescript
// tests/integration/feed-flow.test.ts
describe('Feed Flow Integration', () => {
  it('should create post and add to feeds with scoring', async () => {
    // 1. Create post
    const post = await prisma.contentPost.create({
      data: {
        id: 'integration-post-1',
        userId: 'user-2-uuid',
        postType: 'EXPERIENCE',
        content: 'Integration test post',
        isBoosted: false,
      }
    });

    // 2. Add to feeds
    await feedService.addPostToFeeds(post.id, post.userId);

    // 3. Verify feeds created
    const feeds = await prisma.feed.findMany({
      where: { postId: post.id }
    });

    expect(feeds.length).toBeGreaterThan(0);

    // 4. Verify scores
    feeds.forEach(feed => {
      expect(feed.relevanceScore).toBeGreaterThan(0);
      
      // User1 trusts user2, so should have high score
      if (feed.userId === 'user-1-uuid') {
        expect(feed.relevanceScore).toBeGreaterThanOrEqual(40);
        expect(feed.source).toBe('TRUSTER');
      }
    });
  });

  it('should handle seen tracking with penalty', async () => {
    // 1. Create feed
    const feed = await prisma.feed.create({
      data: {
        id: 'integration-feed-1',
        userId: 'user-1-uuid',
        postId: 'post-1',
        source: 'TRUSTER',
        relevanceScore: 60,
        seen: false,
      }
    });

    // 2. Mark as seen
    await feedService.markFeedAsSeen([feed.id]);

    // 3. Verify penalty applied
    const updated = await prisma.feed.findUnique({
      where: { id: feed.id }
    });

    expect(updated?.seen).toBe(true);
    expect(updated?.relevanceScore).toBe(30);

    // 4. Get feed - should be lower in results
    const result = await feedService.getUserFeed('user-1-uuid', {});

    // Find our feed in results
    const feedItem = result.items.find(item => item.feedId === feed.id);
    
    // Should be below unseen feeds with higher scores
    expect(feedItem).toBeDefined();
  });

  it('should handle cleanup workflow', async () => {
    // 1. Create low-score feed
    await prisma.feed.create({
      data: {
        id: 'cleanup-feed-1',
        userId: 'user-1-uuid',
        postId: 'post-1',
        source: 'NEW_USER',
        relevanceScore: 2.0,
        seen: false,
      }
    });

    // 2. Run cleanup
    await cleanupService.cleanupLowScoreFeeds();

    // 3. Verify deletion
    const deleted = await prisma.feed.findUnique({
      where: { id: 'cleanup-feed-1' }
    });

    expect(deleted).toBeNull();
  });
});
```

## 🌐 API Endpoint Testleri

```typescript
// tests/api/feed.api.test.ts
import request from 'supertest';
import app from '../../src/app';

describe('Feed API Endpoints', () => {
  let authToken: string;

  beforeAll(async () => {
    // Get auth token
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user1@test.com', password: 'test123' });
    
    authToken = response.body.token;
  });

  describe('POST /api/feed/seen', () => {
    it('should mark feeds as seen', async () => {
      const response = await request(app)
        .post('/api/feed/seen')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          feedIds: ['feed-1', 'feed-2']
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Feeds marked as seen');
      expect(response.body.count).toBe(2);
    });

    it('should reject invalid request', async () => {
      const response = await request(app)
        .post('/api/feed/seen')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          feedIds: 'invalid' // Should be array
        });

      expect(response.status).toBe(400);
    });

    it('should reject too many feeds', async () => {
      const manyFeeds = Array(100).fill('feed-1');
      
      const response = await request(app)
        .post('/api/feed/seen')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ feedIds: manyFeeds });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Maximum 50');
    });
  });

  describe('POST /api/feed/:feedId/hide', () => {
    it('should hide feed', async () => {
      const response = await request(app)
        .post('/api/feed/feed-1/hide')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Feed hidden');
    });
  });

  describe('POST /api/feed/:feedId/save', () => {
    it('should save feed', async () => {
      const response = await request(app)
        .post('/api/feed/feed-1/save')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Feed saved');
    });
  });

  describe('GET /api/feed', () => {
    it('should return feeds sorted by score', async () => {
      const response = await request(app)
        .get('/api/feed')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.items).toBeInstanceOf(Array);

      // Verify score descending order
      const scores = response.body.items.map((item: any) => 
        item.relevanceScore
      );

      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
    });
  });
});
```

## ⚡ Performance Testleri

```typescript
// tests/performance/feed-scoring.perf.test.ts
describe('Feed Scoring Performance', () => {
  it('should meet full scoring time target (<100ms)', async () => {
    const iterations = 100;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await scoringService.calculateFullScore(/* ... */);
      times.push(Date.now() - start);
    }

    const avg = times.reduce((a, b) => a + b) / times.length;
    const p95 = times.sort()[Math.floor(iterations * 0.95)];

    console.log(`Full Scoring - Avg: ${avg}ms, P95: ${p95}ms`);

    expect(avg).toBeLessThan(100);
    expect(p95).toBeLessThan(150);
  });

  it('should meet fast scoring time target (<10ms)', async () => {
    const iterations = 100;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await scoringService.calculateFastScore(/* ... */);
      times.push(Date.now() - start);
    }

    const avg = times.reduce((a, b) => a + b) / times.length;

    console.log(`Fast Scoring - Avg: ${avg}ms`);

    expect(avg).toBeLessThan(10);
  });

  it('should handle 1000 feeds creation in reasonable time', async () => {
    const start = Date.now();
    
    await feedService.addPostToFeeds('post-bulk', 'user-2-uuid');

    const elapsed = Date.now() - start;

    console.log(`1000 feeds creation: ${elapsed}ms`);

    expect(elapsed).toBeLessThan(5000); // 5 seconds
  });
});
```

## 📝 Manuel Test Senaryoları

### Senaryo 1: Yeni Post Oluşturma ve Scoring

```bash
# 1. Yeni post oluştur
POST /api/posts
{
  "content": "Test post",
  "postType": "EXPERIENCE"
}

# 2. Feed'lere eklendiğini doğrula
GET /api/feed
# Response'da yeni post olmalı

# 3. Database'de score'ları kontrol et
SELECT user_id, relevance_score, source, seen 
FROM feeds 
WHERE post_id = 'yeni-post-id'
ORDER BY relevance_score DESC;

# Beklenen:
# - Trust relation olan kullanıcılar için yüksek score (40+)
# - Kategori match için orta score (15+)
# - Diğer kullanıcılar için düşük score (10+)
```

### Senaryo 2: Seen Tracking

```bash
# 1. Feed'i getir
GET /api/feed

# 2. İlk feed item'ı 2+ saniye görünür tut (frontend simüle et)

# 3. Seen olarak işaretle
POST /api/feed/seen
{
  "feedIds": ["feed-id-1", "feed-id-2"]
}

# 4. Score'un düştüğünü doğrula
SELECT relevance_score, seen FROM feeds WHERE id = 'feed-id-1';
# Seen = true, Score yarıya düşmüş olmalı

# 5. Feed'i tekrar çek
GET /api/feed
# Seen feed'ler aşağıda olmalı
```

### Senaryo 3: User Feedback

```bash
# 1. Feed'i hide et
POST /api/feed/feed-id-1/hide

# 2. Score'un düştüğünü kontrol et
SELECT relevance_score FROM feeds WHERE id = 'feed-id-1';
# Score %30'una düşmüş olmalı (örn: 30 → 9)

# 3. Feed'i save et
POST /api/feed/feed-id-2/save

# 4. Score'un arttığını kontrol et
SELECT relevance_score FROM feeds WHERE id = 'feed-id-2';
# Score +10 artmış olmalı (örn: 30 → 40)
```

### Senaryo 4: Cleanup Job

```bash
# 1. Düşük score'lu feed oluştur (test için)
INSERT INTO feeds (id, user_id, post_id, source, relevance_score, seen)
VALUES ('test-feed-1', 'user-uuid', 'post-id', 'NEW_USER', 2.0, false);

# 2. Cleanup job'ı manuel tetikle
# Backend'de FeedCleanupScheduler.triggerCleanup() çağır

# 3. Feed'in silindiğini doğrula
SELECT * FROM feeds WHERE id = 'test-feed-1';
# Sonuç: Boş (silinmiş)

# 4. Log'ları kontrol et
# Winston logs'ta cleanup statistics olmalı
```

### Senaryo 5: Batch Scoring Kontrolü

```bash
# Terminal 1: Log monitoring
tail -f logs/app.log | grep "scoring"

# Terminal 2: 10 post oluştur
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/posts \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"content": "Test post '$i'", "postType": "EXPERIENCE"}'
  sleep 1
done

# Log'larda görmeli:
# - 1. post: "Using FULL SCORING"
# - 2-9. postlar: "Using FAST SCORING"
# - 10. post: "Using FULL SCORING"
```

## 📊 Production Monitoring

### Key Metrics to Monitor

```typescript
// Prometheus metrics örneği
const metrics = {
  // Score distribution
  'feed.score.p50': 25.0,
  'feed.score.p75': 45.0,
  'feed.score.p95': 75.0,
  'feed.score.p99': 95.0,
  
  // Feed count
  'feed.count.per_user.avg': 850,
  'feed.count.per_user.max': 2000,
  
  // Performance
  'feed.scoring.full.time_ms.avg': 75,
  'feed.scoring.fast.time_ms.avg': 8,
  'feed.query.time_ms.avg': 120,
  
  // Cleanup
  'feed.cleanup.daily_deleted': 15000,
  'feed.cleanup.last_run': '2025-12-27T02:00:00Z',
  
  // Errors
  'feed.scoring.errors': 5,
  'feed.scoring.fallback': 12,
};
```

### Health Check Queries

```sql
-- 1. Feed distribution per user
SELECT 
  COUNT(*) as feed_count,
  AVG(relevance_score) as avg_score,
  MAX(relevance_score) as max_score,
  MIN(relevance_score) as min_score
FROM feeds
GROUP BY user_id
ORDER BY feed_count DESC
LIMIT 10;

-- 2. Score distribution
SELECT 
  CASE 
    WHEN relevance_score < 10 THEN 'Low (0-10)'
    WHEN relevance_score < 30 THEN 'Medium (10-30)'
    WHEN relevance_score < 50 THEN 'High (30-50)'
    ELSE 'Very High (50+)'
  END as score_range,
  COUNT(*) as count
FROM feeds
GROUP BY score_range;

-- 3. Seen vs Unseen
SELECT 
  seen,
  COUNT(*) as count,
  AVG(relevance_score) as avg_score
FROM feeds
GROUP BY seen;

-- 4. Source distribution
SELECT 
  source,
  COUNT(*) as count,
  AVG(relevance_score) as avg_score
FROM feeds
GROUP BY source
ORDER BY count DESC;

-- 5. Old feeds (cleanup candidates)
SELECT COUNT(*) as old_feeds
FROM feeds
WHERE created_at < NOW() - INTERVAL '14 days';
```

### Alert Queries

```sql
-- Alert: Users with too many feeds
SELECT user_id, COUNT(*) as feed_count
FROM feeds
GROUP BY user_id
HAVING COUNT(*) > 2500;

-- Alert: Cleanup job not running
SELECT 
  MAX(created_at) as last_cleanup_time,
  NOW() - MAX(created_at) as hours_since_cleanup
FROM feeds
WHERE created_at < NOW() - INTERVAL '1 day'
  AND relevance_score < 2.5;

-- Alert: High error rate (check application logs)
```

## 🐛 Troubleshooting

### Issue: Scoring hataları

```bash
# Log'ları kontrol et
tail -f logs/app.log | grep "ERROR.*scoring"

# Fallback count'u kontrol et
grep "Fallback score used" logs/app.log | wc -l

# Database connection kontrol et
npm run prisma:studio
```

### Issue: Cleanup çalışmıyor

```bash
# Redis connection kontrol et
redis-cli ping

# Queue'ları kontrol et
redis-cli KEYS "bull:feed:cleanup:*"

# Worker status'ü kontrol et
pm2 logs worker
```

### Issue: Performance sorunları

```bash
# Slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%feeds%'
ORDER BY mean_exec_time DESC
LIMIT 10;

# Index kullanımı
EXPLAIN ANALYZE
SELECT * FROM feeds
WHERE user_id = 'xxx'
ORDER BY relevance_score DESC;
```

---

**Son Güncelleme**: 27 Aralık 2025
**Version**: 1.0.0

