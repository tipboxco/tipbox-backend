# Event Post Endpoint - Düzeltilmiş İmplementasyon

## Son Güncelleme: 2026-01-15

## Özet

`POST /posts/{eventId}/post` endpoint'i spesifikasyondaki tüm gerekliliklere göre düzeltildi ve optimize edildi.

## Yapılan Kritik Düzeltmeler

### 1. Prisma Model Mapping

**Sorun**: Frontend `"product"` ve `"sub_category"` gönderiyor ama Prisma schema'da modeller `Product` ve `SubCategory` (PascalCase)

**Çözüm**: Dynamic model mapping kullanıldı

```typescript
const contextModelMap: Record<string, string> = {
  'product': 'product',
  'sub_category': 'subCategory'
};

const modelName = contextModelMap[contextType];
const contextExists = await (prisma as any)[modelName].findUnique({
  where: { id: contextId }
});
```

**Not**: Prisma schema'nızda:
- `model Product` → `prisma.product` (camelCase)
- `model SubCategory` → `prisma.subCategory` (camelCase)

### 2. Event Membership Check

**Sorun**: Spesifikasyonda `UserEvent` modeli belirtilmişti ama schema'da `WishboxStats` kullanılıyor

**Çözüm**: `WishboxStats` modeli kullanıldı

```typescript
const userStats = await prisma.wishboxStats.findUnique({
  where: {
    userId_eventId: {
      userId: String(userId),
      eventId: eventId,
    },
  },
});

if (!userStats) {
  return res.status(403).json({ 
    error: {
      code: 'NOT_JOINED',
      message: 'You must join this event before sharing a post'
    }
  });
}
```

### 3. Body Field Validation

**Sorun**: Boş string kontrolü eksikti

**Çözüm**: Trim edilmiş body kontrolü eklendi

```typescript
const trimmedBody = typeof body === 'string' ? body.trim() : '';

if (trimmedBody.length === 0) {
  return res.status(400).json({ 
    message: 'body must be at least 1 character' 
  });
}

if (trimmedBody.length > 2000) {
  return res.status(400).json({ 
    message: 'body must be at most 2000 characters' 
  });
}
```

### 4. Event Metrics Güncelleme

**Sorun**: Post oluşturulduğunda event metrics güncellenmiyordu

**Çözüm**: `WishboxStats` kaydı güncelleniyor

```typescript
// Update user event stats if eventId is provided
if (request.eventId) {
  try {
    await this.prisma.wishboxStats.updateMany({
      where: {
        userId: userId,
        eventId: request.eventId,
      },
      data: {
        totalParticipated: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    // Log error but don't fail the post creation
    logger.warn({
      message: 'Failed to update event stats',
      eventId: request.eventId,
      userId,
      postId: post.id,
      error,
    });
  }
}
```

**Not**: Event stats güncelleme başarısız olsa bile post oluşturma başarılı olur (resilient design)

### 5. Error Handling İyileştirmeleri

**Tüm Error Response'lar**:

```typescript
// 400 - Missing fields
{ "message": "body, contextType, and contextId are required" }

// 400 - Empty body
{ "message": "body must be at least 1 character" }

// 400 - Body too long
{ "message": "body must be at most 2000 characters" }

// 400 - Invalid context type
{ "message": "contextType must be 'product' or 'sub_category'" }

// 400 - Too many images
{ "message": "Maximum 10 images allowed" }

// 401 - No authentication
{ "message": "Authentication required" }

// 403 - Not joined event
{
  "error": {
    "code": "NOT_JOINED",
    "message": "You must join this event before sharing a post"
  }
}

// 404 - Event not found
{
  "error": {
    "code": "EVENT_NOT_FOUND",
    "message": "Event not found"
  }
}

// 404 - Context not found
{
  "error": {
    "code": "CONTEXT_NOT_FOUND",
    "message": "Product or sub-category not found"
  }
}

// 500 - Internal error
{ "message": "Internal server error" }
```

## Implementation Flow

```
1. Authentication Check
   ├─ Token validation
   └─ Extract userId
   
2. Path Parameter Validation
   └─ eventId required
   
3. Body Field Validation
   ├─ body, contextType, contextId required
   ├─ body trim & length check (1-2000 chars)
   ├─ contextType enum check
   └─ images count check (max 10)
   
4. Event Validation
   ├─ Check if event exists (WishboxEvent)
   └─ Check if user joined event (WishboxStats)
   
5. Context Validation
   ├─ Map contextType to Prisma model name
   └─ Check if context exists in database
   
6. Image Processing
   └─ Upload images to S3/cloud storage
   
7. Post Creation
   ├─ Create ContentPost record
   ├─ Create PostMedia records (if images)
   └─ Update WishboxStats (totalParticipated + 1)
   
8. Async Operations (non-blocking)
   ├─ Invalidate event caches
   └─ Distribute post to feeds
   
9. Success Response (201 Created)
   └─ Return { id, message }
```

## Database Schema

### WishboxStats (Event Membership)
```prisma
model WishboxStats {
  id                   String       @id @default(uuid()) @db.Uuid
  userId               String       @map("user_id") @db.Uuid
  eventId              String       @map("event_id") @db.VarChar(26)
  totalParticipated    Int          @map("total_participated")
  totalComments        Int          @map("total_comments")
  helpfulVotesReceived Int          @map("helpful_votes_received")
  eventPostsCount      Int          @default(0) @map("event_posts_count")
  eventLikesReceived   Int          @default(0) @map("event_likes_received")
  createdAt            DateTime     @default(now()) @map("created_at")
  updatedAt            DateTime     @updatedAt @map("updated_at")
  
  @@unique([userId, eventId])
  @@map("wishbox_stats")
}
```

### ContentPost (Post Records)
```prisma
model ContentPost {
  id              String          @id @db.VarChar(26)
  userId          String          @map("user_id") @db.Uuid
  postType        ContentPostType @map("post_type")
  title           String?
  body            String
  subCategoryId   String?         @map("sub_category_id") @db.Uuid
  mainCategoryId  String?         @map("main_category_id") @db.Uuid
  productGroupId  String?         @map("product_group_id") @db.Uuid
  productId       String?         @map("product_id") @db.Uuid
  eventId         String?         @map("event_id") @db.VarChar(26)
  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")
  
  @@map("content_posts")
}
```

## Test Scenarios

### ✅ Başarılı Senaryolar

1. **Text-only post**
```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -F "body=Event için test post" \
  -F "contextType=product" \
  -F "contextId={productId}" \
  http://localhost:3000/api/v1/posts/{eventId}/post
```

2. **Post with images**
```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -F "body=Test post with images" \
  -F "contextType=product" \
  -F "contextId={productId}" \
  -F "images=@image1.jpg" \
  -F "images=@image2.jpg" \
  http://localhost:3000/api/v1/posts/{eventId}/post
```

3. **Sub-category context**
```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -F "body=Category test post" \
  -F "contextType=sub_category" \
  -F "contextId={subCategoryId}" \
  http://localhost:3000/api/v1/posts/{eventId}/post
```

### ❌ Hata Senaryoları

1. **Empty body** → 400
2. **Body > 2000 chars** → 400
3. **Invalid contextType** → 400
4. **> 10 images** → 400
5. **No token** → 401
6. **Not joined event** → 403
7. **Invalid eventId** → 404
8. **Invalid contextId** → 404

## Performans Optimizasyonları

1. **Early Validation**: Image processing öncesi tüm validationlar yapılır
2. **Async Operations**: Cache invalidation ve feed distribution async yapılır
3. **Resilient Design**: Event stats güncelleme başarısız olsa bile post oluşturulur
4. **Error Isolation**: Her async operation kendi error handling'ine sahip

## Güvenlik

1. ✅ Authentication required
2. ✅ Event membership check
3. ✅ Context ownership validation
4. ✅ File size limits (5MB per image)
5. ✅ File count limits (max 10 images)
6. ✅ Input sanitization (trim, length check)
7. ✅ SQL injection prevention (Prisma ORM)

## Monitoring & Logging

Tüm kritik operasyonlar loglanıyor:

```typescript
logger.info(`Free post created: ${post.id} by user ${userId}`, {
  eventId: request.eventId || null,
  contextType: request.contextType,
  contextId: request.contextId,
});

logger.warn({
  message: 'Failed to update event stats',
  eventId: request.eventId,
  userId,
  postId: post.id,
  error,
});

logger.error('Error creating event post:', {
  error,
  userId,
  eventId,
  contextType,
  contextId
});
```

## Bilinen Limitasyonlar

1. **Transaction**: Event stats güncelleme ve post oluşturma tek transaction'da değil (resilient design için)
2. **Image Optimization**: Görseller yükleniyor ama automatic compression yok
3. **Rate Limiting**: Endpoint-level rate limiting yok (global rate limiting var ise)

## Gelecek İyileştirmeler

1. Add transaction support for atomic operations
2. Implement image compression/optimization
3. Add post moderation workflow
4. Implement real-time notifications
5. Add analytics tracking
6. Add rate limiting per user/event

---

**Status**: ✅ Production Ready
**Last Updated**: 2026-01-15
**Breaking Changes**: None
**Backward Compatible**: Yes
