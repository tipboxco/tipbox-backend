# Event Post Endpoint Tasarım Dokümantasyonu

Bu dokümantasyon, Event post oluşturma için endpoint tasarımını açıklar.

## Mevcut Durum

### Problem
- Mobil uygulamada `EventCreatePost` ekranı mevcut
- Backend'de event'e özel post oluşturma endpoint'i yok
- Event post'ları şu anda event'e katılan kullanıcıların post'larından filtreleniyor (`GET /events/:eventId/posts`)

### Mevcut Yapı
- `ContentPost` modelinde `eventId` field'ı yok
- Event'ler ile post'lar arasında doğrudan bir ilişki yok
- Event post'ları participant user ID'lerine göre filtreleniyor (geçici çözüm)

## Tasarım Seçenekleri

### Seçenek 1: Mevcut Endpoint'lere `eventId` Ekleme (ÖNERİLEN)

#### Avantajlar
- Minimal değişiklik gerektirir
- Mevcut endpoint'lerin tüm özelliklerini kullanabilir
- Kod tekrarı yok
- Tüm post tipleri event'e bağlanabilir

#### Dezavantajlar
- Tüm post endpoint'lerine optional parametre eklenmeli
- Database migration gerekir (`ContentPost` modeline `eventId` field'ı)

#### Implementation

**1. Database Schema Değişikliği**

```prisma
model ContentPost {
  // ... mevcut field'lar
  eventId String? @map("event_id") @db.VarChar(26)
  event   WishboxEvent? @relation(fields: [eventId], references: [id], onDelete: SetNull)
  
  @@index([eventId])
}
```

**2. DTO Değişiklikleri**

Tüm post request interface'lerine optional `eventId` eklenir:

```typescript
export interface CreatePostRequest {
  contextType: ContextType;
  contextId: string;
  description: string;
  images?: string[];
  eventId?: string; // YENİ: Optional event ID
}

export interface CreateTipsAndTricksPostRequest {
  contextType: ContextType;
  contextId: string;
  description: string;
  benefitCategory: TipsAndTricksBenefitCategory;
  images?: string[];
  eventId?: string; // YENİ
}

// ... diğer request interface'leri için de aynı
```

**3. Service Değişiklikleri**

`PostService` içinde post oluşturma metodlarına event validation ve linking eklenir:

```typescript
async createFreePost(
  userId: string,
  request: CreatePostRequest
): Promise<{ id: string }> {
  // ... mevcut kod
  
  // Event validation (eğer eventId varsa)
  if (request.eventId) {
    const event = await this.prisma.wishboxEvent.findUnique({
      where: { id: request.eventId },
    });
    
    if (!event) {
      throw new Error(`Event not found: ${request.eventId}`);
    }
    
    // Event'in aktif olup olmadığını kontrol et
    const now = new Date();
    if (event.startDate > now || event.endDate < now) {
      throw new Error('Event is not active');
    }
  }
  
  const post = await this.postRepo.create(
    userId,
    ContentPostType.FREE,
    '',
    bodyWithImages,
    contextIds.subCategoryId,
    contextIds.mainCategoryId,
    contextIds.productGroupId,
    contextIds.productId,
    false,
    false,
    request.eventId // YENİ: eventId parametresi
  );
  
  // ... geri kalan kod
}
```

**4. Repository Değişiklikleri**

`ContentPostPrismaRepository.create()` metoduna `eventId` parametresi eklenir:

```typescript
async create(
  userId: string,
  type: ContentPostType,
  title: string,
  body: string,
  subCategoryId?: string,
  mainCategoryId?: string,
  productGroupId?: string,
  productId?: string,
  inventoryRequired: boolean = false,
  isBoosted: boolean = false,
  eventId?: string // YENİ
): Promise<ContentPost> {
  const post = await this.prisma.contentPost.create({
    data: {
      // ... mevcut field'lar
      eventId: eventId || null, // YENİ
    },
    // ... include'lar
  });
  
  return this.toDomain(post);
}
```

**5. Router Değişiklikleri**

Router'larda `eventId` parametresi extract edilir:

```typescript
router.post(
  '/free',
  asyncHandler(async (req: Request, res: Response) => {
    // ... mevcut kod
    
    const request: CreatePostRequest = {
      contextType: req.body.contextType as ContextType,
      contextId: req.body.contextId,
      description: req.body.description,
      images: req.body.images || [],
      eventId: req.body.eventId, // YENİ: Optional
    };
    
    // ... geri kalan kod
  })
);
```

**6. Event Post Listeleme İyileştirmesi**

`EventService.getEventPosts()` metodu artık doğrudan `eventId` ile filtreleyebilir:

```typescript
async getEventPosts(
  eventId: string,
  userId?: string,
  options?: { cursor?: string; limit?: number }
): Promise<EventPosts> {
  // ... mevcut kod
  
  // Artık doğrudan eventId ile filtreleyebiliriz
  const posts = await this.prisma.contentPost.findMany({
    where: {
      eventId: eventId, // YENİ: Doğrudan eventId ile filtreleme
    },
    // ... include'lar ve orderBy
  });
  
  // ... geri kalan kod
}
```

#### API Örnekleri

**Free Post (Event ile)**
```http
POST /posts/free
Content-Type: application/json
Authorization: Bearer <token>

{
  "contextType": "product",
  "contextId": "product-id-123",
  "description": "Event için bir post",
  "images": ["https://example.com/image1.jpg"],
  "eventId": "event-id-456"
}
```

**Tips & Tricks Post (Event ile)**
```http
POST /posts/tips-and-tricks
Content-Type: application/json
Authorization: Bearer <token>

{
  "contextType": "product",
  "contextId": "product-id-123",
  "description": "Event için bir ipucu",
  "benefitCategory": "time_saving",
  "images": ["https://example.com/image1.jpg"],
  "eventId": "event-id-456"
}
```

---

### Seçenek 2: Yeni Event Post Endpoint'i

#### Avantajlar
- Event'e özel logic eklenebilir
- Event validation merkezi bir yerde
- Event'e özel business rule'lar uygulanabilir

#### Dezavantajlar
- Kod tekrarı (mevcut post endpoint'lerini wrap etmek gerekir)
- Daha fazla endpoint yönetimi
- Event'e özel post tipi gerekebilir

#### Implementation

**1. Yeni Endpoint**

```typescript
// src/interfaces/event/event.router.ts

router.post(
  '/:eventId/posts',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const eventId = req.params.eventId;
    const postType = req.body.postType; // 'free', 'tips', 'question', vb.

    // Event validation
    const event = await eventService.validateEvent(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Event'in aktif olup olmadığını kontrol et
    const now = new Date();
    if (event.startDate > now || event.endDate < now) {
      return res.status(400).json({ message: 'Event is not active' });
    }

    // Post tipine göre ilgili endpoint'e yönlendir
    const postRequest = {
      ...req.body,
      eventId, // Event ID'yi ekle
    };

    let result;
    switch (postType) {
      case 'free':
        result = await postService.createFreePost(userId, postRequest);
        break;
      case 'tips':
        result = await postService.createTipsAndTricksPost(userId, postRequest);
        break;
      case 'question':
        result = await postService.createQuestionPost(userId, postRequest);
        break;
      // ... diğer post tipleri
      default:
        return res.status(400).json({ message: 'Invalid post type' });
    }

    return res.status(201).json(result);
  })
);
```

**2. API Örneği**

```http
POST /events/event-id-456/posts
Content-Type: application/json
Authorization: Bearer <token>

{
  "postType": "free",
  "contextType": "product",
  "contextId": "product-id-123",
  "description": "Event için bir post",
  "images": ["https://example.com/image1.jpg"]
}
```

---

## Önerilen Çözüm: Seçenek 1

**Neden Seçenek 1?**
1. **Minimal Değişiklik**: Sadece optional parametre ekleniyor
2. **Esneklik**: Tüm post tipleri event'e bağlanabilir
3. **Kod Tekrarı Yok**: Mevcut endpoint'ler kullanılıyor
4. **Tutarlılık**: Tüm post endpoint'leri aynı pattern'i takip ediyor

## Implementation Adımları

### Adım 1: Database Migration
1. Prisma schema'ya `eventId` field'ı ekle
2. Migration oluştur ve çalıştır
3. Index ekle (performans için)

### Adım 2: Domain Layer
1. `ContentPost` entity'sine `eventId` field'ı ekle (optional)
2. Event validation method'u ekle

### Adım 3: Repository Layer
1. `ContentPostPrismaRepository.create()` metoduna `eventId` parametresi ekle
2. `toDomain()` metodunda `eventId` mapping'i yap

### Adım 4: Service Layer
1. Tüm post creation method'larına event validation ekle
2. Event validation helper method oluştur

### Adım 5: DTO Layer
1. Tüm post request interface'lerine `eventId?: string` ekle
2. OpenAPI dokümantasyonunu güncelle

### Adım 6: Router Layer
1. Tüm post router'larına `eventId` extract et
2. Request validation'a `eventId` ekle (optional)

### Adım 7: Event Service
1. `getEventPosts()` metodunu güncelle (doğrudan `eventId` ile filtrele)
2. Event validation helper method ekle

### Adım 8: Testing
1. Unit test'ler yaz
2. Integration test'ler yaz
3. E2E test'ler yaz

## Validation Rules

### Event Validation
- Event mevcut olmalı
- Event aktif olmalı (`startDate <= now <= endDate`)
- Event status'u `PUBLISHED` olmalı

### Post Validation
- Mevcut post validation'ları geçerli kalır
- Event ID geçerli format'ta olmalı (VarChar(26))

## Error Handling

### Event Not Found
```json
{
  "message": "Event not found: event-id-123",
  "code": "EVENT_NOT_FOUND"
}
```

### Event Not Active
```json
{
  "message": "Event is not active",
  "code": "EVENT_NOT_ACTIVE"
}
```

### Invalid Event ID
```json
{
  "message": "Invalid event ID format",
  "code": "INVALID_EVENT_ID"
}
```

## API Dokümantasyonu

### OpenAPI Schema Güncellemesi

Tüm post request schema'larına `eventId` field'ı eklenir:

```yaml
CreatePostRequest:
  type: object
  required:
    - contextType
    - contextId
    - description
  properties:
    contextType:
      $ref: '#/components/schemas/ContextType'
    contextId:
      type: string
    description:
      type: string
    images:
      type: array
      items:
        type: string
    eventId:
      type: string
      description: Optional event ID to link post to event
      example: "01ARZ3NDEKTSV4RRFFQ69G5FAV"
```

## Migration Planı

### Backward Compatibility
- `eventId` optional olduğu için mevcut API'ler çalışmaya devam eder
- Mevcut post'lar `eventId = null` olarak kalır
- Yeni post'lar isteğe bağlı olarak `eventId` ile oluşturulabilir

### Rollout Strategy
1. **Phase 1**: Database migration (downtime gerekebilir)
2. **Phase 2**: Backend deployment (optional parametre, backward compatible)
3. **Phase 3**: Frontend integration (yeni özellik)
4. **Phase 4**: Monitoring ve optimizasyon

## Performans Considerations

### Indexing
- `eventId` field'ı için index eklenmeli
- Composite index: `[eventId, createdAt]` (event post listeleme için)

### Caching
- Event validation sonuçları cache'lenebilir
- Event post listeleri cache'lenebilir

## Güvenlik

### Authorization
- Kullanıcı event'e erişim yetkisi olmalı
- Event private ise, kullanıcı event'e katılmış olmalı

### Rate Limiting
- Event post oluşturma için özel rate limit olabilir
- Event bazlı rate limit olabilir

## Sonuç

Seçenek 1 (Mevcut Endpoint'lere `eventId` Ekleme) önerilen çözümdür. Minimal değişiklik ile maksimum esneklik sağlar ve mevcut kod yapısını korur.



