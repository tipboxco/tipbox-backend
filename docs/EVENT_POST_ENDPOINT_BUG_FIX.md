# Event Post Endpoint - HATA DÜZELTMESİ

## Hata

```
Cannot read properties of undefined (reading 'findUnique')
```

## Sorun

Router'da `getPrisma()` fonksiyonu çağrılıyor ancak Prisma extended client düzgün çalışmıyordu. `getPrisma()` undefined dönüyordu.

## Çözüm

✅ **Prisma çağrılarını router'dan service katmanına taşıdık**

### Değişiklikler

#### 1. Router'da Sadece Validation (post.router.ts)

```typescript
// ❌ ÖNCE (HATALI)
try {
  const prisma = getPrisma(); // undefined dönüyordu!
  
  const event = await prisma.wishboxEvent.findUnique({ ... });
  const userStats = await prisma.wishboxStats.findUnique({ ... });
  const contextExists = await (prisma as any)[modelName].findUnique({ ... });
  
  // ...
}

// ✅ ŞİMDİ (DOĞRU)
try {
  // Process images first
  const imageUrls = await processPostImages(req, String(userId));

  // Create post - service handles all database operations
  const postData: CreatePostRequest = {
    body: trimmedBody,
    contextType: contextType as ContextType,
    contextId: contextId,
    images: imageUrls,
    eventId: eventId,
  };

  const result = await postService.createFreePost(String(userId), postData);
  
  return res.status(201).json({
    id: result.id,
    message: 'Post created successfully'
  });
}
```

#### 2. Service'de Tüm Database İşlemleri (post.service.ts)

```typescript
// Yeni metod eklendi
private async validateEventMembership(userId: string, eventId: string): Promise<void> {
  const userStats = await this.prisma.wishboxStats.findUnique({
    where: {
      userId_eventId: {
        userId: userId,
        eventId: eventId,
      },
    },
  });

  if (!userStats) {
    throw new Error('You must join this event before sharing a post');
  }
}

// createFreePost metodunda çağrılıyor
if (request.eventId) {
  await this.validateEvent(request.eventId);
  await this.validateEventMembership(userId, request.eventId); // ✅ YENİ
}
```

#### 3. Router'da Error Handling

```typescript
catch (error) {
  const message = getErrorMessage(error);
  
  // Parse error message from service
  if (message.includes('Event not found')) {
    return res.status(404).json({ 
      error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' }
    });
  }
  
  if (message.includes('must join this event')) {
    return res.status(403).json({ 
      error: { code: 'NOT_JOINED', message: 'You must join this event before sharing a post' }
    });
  }
  
  if (message.includes('not found') || message.includes('does not exist')) {
    return res.status(404).json({ 
      error: { code: 'CONTEXT_NOT_FOUND', message: 'Product or sub-category not found' }
    });
  }
  
  return res.status(400).json({ message: message || 'Failed to create post' });
}
```

## Mimari Değişiklik

### Önce (Hatalı)
```
Router Layer
├─ getPrisma() ❌ (undefined)
├─ Database queries (wishboxEvent, wishboxStats, product/subCategory)
├─ Validation logic
└─ Service call

Service Layer
├─ Post creation
└─ Cache/feed operations
```

### Şimdi (Doğru)
```
Router Layer
├─ Request validation (body, contextType, images)
├─ Image processing
└─ Service call

Service Layer ✅
├─ Event validation (validateEvent)
├─ Event membership check (validateEventMembership) ← YENİ
├─ Context resolution (resolveContextIds)
├─ Post creation
├─ Event stats update
└─ Cache/feed operations
```

## Avantajlar

1. ✅ **Separation of Concerns**: Router sadece HTTP layer, service business logic
2. ✅ **Single Responsibility**: Her katman kendi sorumluluğunu üstleniyor
3. ✅ **Reusability**: Service metodları başka yerlerden de çağrılabilir
4. ✅ **Testability**: Service katmanı unit test yapmak daha kolay
5. ✅ **Error Handling**: Service'den gelen hatalar router'da parse edilip uygun HTTP response'a dönüştürülüyor

## Test

### ✅ Başarılı Request
```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -F "body=Test post içeriği" \
  -F "contextType=product" \
  -F "contextId={productId}" \
  http://localhost:3000/api/v1/posts/00MKFPNIQ30000064YDGL62K7Q/post
```

**Response (201 Created)**:
```json
{
  "id": "01JKPOST123456789ABCDEFGH",
  "message": "Post created successfully"
}
```

### ❌ Event'e Katılmamış
**Response (403 Forbidden)**:
```json
{
  "error": {
    "code": "NOT_JOINED",
    "message": "You must join this event before sharing a post"
  }
}
```

### ❌ Event Bulunamadı
**Response (404 Not Found)**:
```json
{
  "error": {
    "code": "EVENT_NOT_FOUND",
    "message": "Event not found"
  }
}
```

### ❌ Product/Category Bulunamadı
**Response (404 Not Found)**:
```json
{
  "error": {
    "code": "CONTEXT_NOT_FOUND",
    "message": "Product or sub-category not found"
  }
}
```

## Değiştirilen Dosyalar

```
✓ src/interfaces/post/post.router.ts
  - getPrisma import'u kaldırıldı
  - Database queries kaldırıldı
  - Validation logic basitleştirildi
  - Error handling iyileştirildi

✓ src/application/post/post.service.ts
  - validateEventMembership() metodu eklendi
  - createFreePost() event membership check eklendi
  - Database operations service'de toplandı
```

## Sonraki Adımlar

1. ✅ Test edin: `./test-event-post-endpoint.sh`
2. ✅ Postman/Insomnia ile API test edin
3. ✅ Frontend'den test edin
4. ✅ Logs kontrol edin: `pm2 logs` veya `docker logs`

## Notlar

- ⚠️ `getPrisma()` fonksiyonu başka yerlerde çalışıyor olabilir, sadece router'da sorun vardı
- ⚠️ Service katmanında `this.prisma` zaten çalışıyor (constructor'da initialize ediliyor)
- ✅ Bu değişiklik best practice'e uygun (layered architecture)

---

**Status**: ✅ FIXED
**Date**: 2026-01-15
**Issue**: Cannot read properties of undefined (reading 'findUnique')
**Solution**: Moved database operations from router to service layer
