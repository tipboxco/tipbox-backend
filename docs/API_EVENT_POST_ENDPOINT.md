# Event Post Endpoint - API Documentation

## Endpoint

**POST** `/api/v1/posts/:eventId/post`

Event için post oluşturma endpoint'i. Event'e katılmış kullanıcılar bu endpoint ile event'e özel post paylaşabilir.

---

## Authentication

**Required:** Bearer Token

```
Authorization: Bearer {jwt_token}
```

---

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventId` | string (ULID) | ✅ Yes | Event'in benzersiz ID'si |

---

## Request Body

**Content-Type:** `multipart/form-data`

### Required Fields

| Field | Type | Required | Max Length | Description |
|-------|------|----------|------------|-------------|
| `body` | string | ✅ Yes | 2000 chars | Post içeriği/açıklaması |
| `contextType` | enum | ✅ Yes | - | `product` veya `sub_category` |
| `contextId` | string (ULID) | ✅ Yes | - | Product ID veya Sub-category ID |

### Optional Fields

| Field | Type | Required | Limit | Description |
|-------|------|----------|-------|-------------|
| `images` | file[] | ❌ No | Max 10 files, 5MB each | Post görselleri |

### Context Type Values

- **`product`**: Post belirli bir ürün ile ilişkili
- **`sub_category`**: Post bir alt kategori ile ilişkili

---

## Request Examples

### 1. Text Only Post (cURL)

```bash
curl -X POST \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -F "body=Event için harika bir deneyim paylaşıyorum!" \
  -F "contextType=product" \
  -F "contextId=01JK5XMZN0PRODUCTID123" \
  http://localhost:3000/api/v1/posts/01JK5XMZN0EVENTID123/post
```

### 2. Post with Images (cURL)

```bash
curl -X POST \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -F "body=Bu ürünü event'te denedim, işte fotoğrafları" \
  -F "contextType=product" \
  -F "contextId=01JK5XMZN0PRODUCTID123" \
  -F "images=@/path/to/photo1.jpg" \
  -F "images=@/path/to/photo2.jpg" \
  -F "images=@/path/to/photo3.jpg" \
  http://localhost:3000/api/v1/posts/01JK5XMZN0EVENTID123/post
```

### 3. JavaScript/TypeScript (Fetch)

```typescript
const formData = new FormData();
formData.append('body', 'Event için içerik paylaşıyorum!');
formData.append('contextType', 'product');
formData.append('contextId', 'product-ulid-123');

// Resim ekle
const imageFiles = document.getElementById('images').files;
for (let i = 0; i < imageFiles.length; i++) {
  formData.append('images', imageFiles[i]);
}

const response = await fetch(`/api/v1/posts/${eventId}/post`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData
});

const result = await response.json();
```

### 4. Axios

```typescript
import axios from 'axios';

const formData = new FormData();
formData.append('body', 'Event deneyimim');
formData.append('contextType', 'sub_category');
formData.append('contextId', 'subcategory-ulid');

// Dosyalar
files.forEach(file => {
  formData.append('images', file);
});

try {
  const response = await axios.post(
    `/api/v1/posts/${eventId}/post`,
    formData,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    }
  );
  
  console.log('Post created:', response.data);
} catch (error) {
  console.error('Error:', error.response?.data);
}
```

---

## Response Format

### Success Response (201 Created)

```json
{
  "id": "01JK5XYZABC123456789",
  "message": "Post created successfully"
}
```

**Fields:**
- `id` (string): Oluşturulan post'un benzersiz ID'si (ULID format)
- `message` (string): Başarı mesajı

---

## Error Responses

### 400 Bad Request - Missing Fields

```json
{
  "message": "body, contextType, and contextId are required"
}
```

### 400 Bad Request - Body Too Long

```json
{
  "message": "body must be at most 2000 characters"
}
```

### 400 Bad Request - Invalid Context Type

```json
{
  "message": "contextType must be 'product' or 'sub_category'"
}
```

### 400 Bad Request - Too Many Images

```json
{
  "message": "Maximum 10 images allowed"
}
```

### 401 Unauthorized

```json
{
  "message": "Unauthorized"
}
```

### 403 Forbidden - Not Joined Event

```json
{
  "error": {
    "code": "NOT_JOINED",
    "message": "You must join this event before sharing a post"
  }
}
```

### 404 Not Found - Event Not Found

```json
{
  "error": {
    "code": "EVENT_NOT_FOUND",
    "message": "Event not found"
  }
}
```

### 404 Not Found - Context Not Found

```json
{
  "error": {
    "code": "CONTEXT_NOT_FOUND",
    "message": "Product or sub-category not found"
  }
}
```

### 413 Payload Too Large

Dosya boyutu 5MB'ı aşarsa:

```json
{
  "message": "File size exceeds 5MB limit"
}
```

---

## Business Logic

### 1. Event Katılım Kontrolü

Kullanıcı post oluşturmadan önce event'e katılmış olmalıdır:

```sql
SELECT * FROM user_events 
WHERE user_id = ? AND event_id = ? AND is_joined = true
```

### 2. Event Metrik Güncellemesi

Post başarıyla oluşturulduğunda:

```typescript
// WishboxStats güncellenir
eventMetricsService.incrementUserPostCount(userId, eventId);

// Kullanıcının eventPostsCount değeri 1 artar
// Badge threshold kontrolü otomatik yapılır
```

### 3. Badge Kontrolü

Post oluşturulduktan sonra otomatik badge kontrolü:

```typescript
badgeEligibilityService.checkAndGrantEventBadges(userId, eventId, metrics);

// Threshold'a ulaşılmışsa badge otomatik verilir
// Örn: 1 post = "Aktif Paylaşımcı" badge
```

### 4. Image Upload

- **Max Dosya Sayısı:** 10
- **Max Dosya Boyutu:** 5MB per file
- **Desteklenen Formatlar:** JPG, PNG, GIF, WebP, HEIC
- **Upload Lokasyonu:** S3/MinIO
- **Path Format:** `posts/{userId}/{timestamp}_{uuid}.{ext}`

---

## Validation Rules

### Body Field
- ✅ Required
- ✅ Must be string
- ✅ Max 2000 characters
- ✅ Trimmed before save

### Context Type
- ✅ Required
- ✅ Only `product` or `sub_category` allowed
- ❌ `product_group` not supported in this endpoint

### Context ID
- ✅ Required
- ✅ Must be valid ULID
- ✅ Must exist in database

### Images
- ✅ Optional
- ✅ Max 10 files
- ✅ Each file max 5MB
- ✅ Only image formats

---

## Integration Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Auth
    participant EventService
    participant PostService
    participant MetricsService
    participant BadgeService
    participant S3

    Client->>API: POST /posts/:eventId/post
    API->>Auth: Validate JWT Token
    Auth-->>API: User ID
    
    API->>EventService: Check Event Join Status
    EventService-->>API: User Joined = true
    
    API->>S3: Upload Images
    S3-->>API: Image URLs
    
    API->>PostService: Create Post
    PostService->>MetricsService: Increment Post Count
    MetricsService->>BadgeService: Check Badge Eligibility
    BadgeService-->>Client: Badge Notification (if earned)
    
    PostService-->>API: Post Created
    API-->>Client: 201 {id, message}
```

---

## Testing

### Test Scenario 1: Successful Post Creation

```bash
# 1. Login
POST /auth/login
{
  "email": "user@example.com",
  "password": "password"
}
# Response: { "token": "..." }

# 2. Join Event
POST /events/01JK5XMZN0EVENTID/join
Authorization: Bearer {token}

# 3. Create Post
POST /posts/01JK5XMZN0EVENTID/post
Authorization: Bearer {token}
Content-Type: multipart/form-data

body: "Test post content"
contextType: "product"
contextId: "01JK5XMZN0PRODUCTID"

# Expected: 201 with post ID
```

### Test Scenario 2: Not Joined Event

```bash
# 1. Login (without joining event)
POST /auth/login

# 2. Try to Create Post
POST /posts/01JK5XMZN0EVENTID/post
# Expected: 403 Forbidden with NOT_JOINED error
```

### Test Scenario 3: Body Too Long

```bash
POST /posts/01JK5XMZN0EVENTID/post
body: "{2001 characters long text}"
# Expected: 400 Bad Request
```

---

## Backward Compatibility

### PostService Changes

`createFreePost` metodu artık hem yeni (`body`) hem eski (`description`) field'ları destekliyor:

```typescript
// Eski kullanım (hala çalışır)
const request = {
  description: "Post content",
  contextType: "product",
  contextId: "123"
};

// Yeni kullanım (tercih edilen)
const request = {
  body: "Post content",
  contextType: "product",
  contextId: "123"
};
```

---

## Performance Considerations

### Image Processing
- S3 upload asenkron yapılır
- Başarısız upload durumunda post oluşturulmaz
- Image optimization: Auto (S3 tarafında)

### Database Operations
1. Event join check: ~5ms
2. Context validation: ~10ms
3. Post creation: ~20ms
4. Metrics update: ~15ms
5. Badge check: ~25ms

**Total:** ~75ms (excluding image upload)

---

## Security

### Authentication
- ✅ JWT token zorunlu
- ✅ Token expiry kontrolü
- ✅ User ID validation

### Authorization
- ✅ Event join status kontrolü
- ✅ User sadece kendi post'unu oluşturabilir

### Input Validation
- ✅ SQL injection koruması (Prisma ORM)
- ✅ XSS koruması (input sanitization)
- ✅ File type validation
- ✅ File size validation

### Rate Limiting
- ⚠️ Önerilir: 10 post/hour per user per event
- ⚠️ Önerilir: 50 image upload/hour per user

---

## Troubleshooting

### Problem: "NOT_JOINED" Error
**Çözüm:** Önce event'e katıl
```bash
POST /events/:eventId/join
```

### Problem: "CONTEXT_NOT_FOUND" Error
**Çözüm:** Geçerli product veya sub_category ID kullan
```bash
GET /products  # Get valid product IDs
GET /categories  # Get valid sub-category IDs
```

### Problem: Images Upload Fails
**Çözüm:**
1. Dosya boyutu kontrol et (max 5MB)
2. Dosya formatı kontrol et (JPG, PNG, etc.)
3. S3/MinIO servisinin çalıştığından emin ol

### Problem: "body must be at most 2000 characters"
**Çözüm:** Post içeriğini 2000 karakter ile sınırla

---

## Related Endpoints

- `POST /events/:eventId/join` - Event'e katıl
- `GET /events/:eventId/progress` - Event ilerlemeni gör
- `GET /events/:eventId/posts` - Event post'larını listele
- `POST /posts/free` - Normal (event dışı) post oluştur

---

## Changelog

### Version 1.1.0 (Current)
- ✅ Event join kontrolü eklendi
- ✅ `body` field desteği (`description` yerine)
- ✅ Response format sadeleştirildi (`success` field kaldırıldı)
- ✅ Error response'lar standartlaştırıldı
- ✅ Context type sadece `product` ve `sub_category` ile sınırlandı
- ✅ Max image sayısı 5'ten 10'a çıkarıldı
- ✅ Validation kuralları güçlendirildi

### Version 1.0.0
- Initial release
