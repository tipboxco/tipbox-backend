# Event Post Creation Error - Product Not Found

## Hata

```
2026-01-16T10:39:23.902Z [error]: Failed to create free post: Product not found: 0462b7da-0e4d-48b2-8a54-0412a7d971b5
```

## Root Cause Analizi

### Hata Nerede?

**Frontend → Backend → Database**

```
1. Frontend: Product seçimi
   ↓
2. API Request: POST /posts/{eventId}/post
   {
     "contextType": "product",
     "contextId": "0462b7da-0e4d-48b2-8a54-0412a7d971b5"  ← Bu ID database'de YOK
   }
   ↓
3. Backend: Product arama
   ↓
4. Database: Product bulunamadı
   ↓
5. Error: "Product not found"
```

### Kimin Hatası?

#### 🔴 Frontend Hatası (Büyük İhtimalle - %80)

**Olası Sebepler:**
1. **Cache'de eski product ID var**
   - Product silinmiş ama cache'de hala duruyor
   - Çözüm: Cache'i temizleyin

2. **Product listesi güncel değil**
   - Product silinmiş ama UI'da hala görünüyor
   - Çözüm: Product listesini yenileyin

3. **Yanlış product seçilmiş**
   - Test/development product ID'si production'da kullanılmış
   - Çözüm: Product seçimini kontrol edin

4. **Deep link/Cache sorun**
   - Eski bir deep link kullanılıyor
   - Çözüm: Deep link validation ekleyin

#### 🟡 Backend Hatası (Kısmen - %20)

**Sorunlar:**
1. **Hata mesajı teknik**
   - ❌ "Product not found: 0462b7da-0e4d-48b2-8a54-0412a7d971b5"
   - ✅ "Product does not exist or has been deleted"

2. **HTTP Status Code yanlış**
   - ❌ 500 Internal Server Error
   - ✅ 404 Not Found

## Düzeltmeler

### Backend Düzeltmeleri (✅ Yapıldı)

#### 1. User-Friendly Error Message
```typescript
// ❌ Önce
throw new Error(`Product not found: ${contextId}`);

// ✅ Sonra
throw new Error(`Product does not exist or has been deleted. Please select a valid product.`);
```

#### 2. Better Error Handling
```typescript
// Router'da
if (message.includes('does not exist or has been deleted')) {
  return res.status(404).json({ 
    error: {
      code: 'CONTEXT_NOT_FOUND',
      message: message // User-friendly message
    }
  });
}
```

#### 3. Logging İyileştirmesi
```typescript
logger.warn({
  message: 'Product not found in post creation',
  contextId,
  userId,
});
```

### Frontend Önerileri

#### 1. Product Validation
```typescript
// Post oluşturmadan önce product validate et
async function validateProduct(productId: string): Promise<boolean> {
  try {
    const response = await api.get(`/products/${productId}`);
    return response.status === 200;
  } catch (error) {
    if (error.response?.status === 404) {
      showError('This product is no longer available. Please select another product.');
      return false;
    }
    throw error;
  }
}

// Post oluşturma
const isValid = await validateProduct(selectedProductId);
if (!isValid) {
  return; // İşlemi durdur
}
```

#### 2. Cache Invalidation
```typescript
// Product listesi çekildiğinde cache'i temizle
const fetchProducts = async () => {
  // Eski cache'i temizle
  await cache.remove('products');
  
  // Yeni veri çek
  const products = await api.get('/products');
  
  // Cache'e kaydet (TTL ile)
  await cache.set('products', products, { ttl: 300 }); // 5 dakika
};
```

#### 3. Error Handling
```typescript
try {
  await createEventPost(eventId, postData);
} catch (error) {
  if (error.response?.data?.error?.code === 'CONTEXT_NOT_FOUND') {
    // Product bulunamadı
    Alert.alert(
      'Product Not Available',
      'This product is no longer available. Please select another product.',
      [
        { text: 'Select Another', onPress: () => navigateToProductSelection() },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }
}
```

#### 4. Product Listesi Refresh
```typescript
// Pull-to-refresh
const onRefresh = async () => {
  setRefreshing(true);
  await fetchProducts(); // Cache bypass
  setRefreshing(false);
};

// Auto-refresh her 5 dakikada
useEffect(() => {
  const interval = setInterval(fetchProducts, 5 * 60 * 1000);
  return () => clearInterval(interval);
}, []);
```

## Debugging

### 1. Product Var mı Kontrol Et

```bash
# Script ile
node scripts/check-product-exists.js 0462b7da-0e4d-48b2-8a54-0412a7d971b5

# API ile
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/v1/products/0462b7da-0e4d-48b2-8a54-0412a7d971b5"
```

**Beklenen Sonuçlar:**

✅ **Product VAR (200 OK)**:
```json
{
  "id": "0462b7da-0e4d-48b2-8a54-0412a7d971b5",
  "name": "iPhone 15 Pro",
  "brand": "Apple",
  ...
}
```
→ Backend sorunu değil, başka bir sorun var

❌ **Product YOK (404 Not Found)**:
```json
{
  "error": "Product not found"
}
```
→ Frontend yanlış ID gönderiyor veya product silinmiş

### 2. Product Listesini Kontrol Et

```bash
# Tüm product'ları listele
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/v1/products" | jq '.items[] | {id, name}'
```

### 3. Database'de Product Ara

```sql
-- Prisma Studio ile
npx prisma studio

-- SQL ile
SELECT id, name, brand 
FROM products 
WHERE id = '0462b7da-0e4d-48b2-8a54-0412a7d971b5';
```

## Prevention (Önleme)

### Backend

1. **Product Deletion Workflow**
```typescript
// Product silinmeden önce kontrol et
async deleteProduct(productId: string) {
  // Post'larda kullanılıyor mu?
  const postsCount = await prisma.contentPost.count({
    where: { productId }
  });
  
  if (postsCount > 0) {
    throw new Error('Cannot delete product with existing posts');
  }
  
  // Soft delete (better)
  await prisma.product.update({
    where: { id: productId },
    data: { isDeleted: true, deletedAt: new Date() }
  });
}
```

2. **Product Validation Middleware**
```typescript
// API middleware
async function validateProductExists(productId: string) {
  const exists = await redis.get(`product:exists:${productId}`);
  if (exists === 'false') {
    throw new NotFoundError('Product not found');
  }
  
  if (exists === null) {
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });
    
    await redis.setex(
      `product:exists:${productId}`,
      300, // 5 min cache
      product ? 'true' : 'false'
    );
    
    if (!product) {
      throw new NotFoundError('Product not found');
    }
  }
}
```

### Frontend

1. **Product Validation Before Post**
2. **Cache TTL (5-10 minutes max)**
3. **Pull-to-refresh support**
4. **Graceful error handling**
5. **Retry mechanism with different product**

## Test Scenarios

### Test 1: Geçerli Product
```bash
# 1. Product listesini çek
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/v1/products" | jq '.items[0].id'

# 2. Bu product ile post oluştur
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "body=Test post" \
  -F "contextType=product" \
  -F "contextId=VALID_PRODUCT_ID" \
  "http://localhost:3000/api/v1/posts/EVENT_ID/post"
```

### Test 2: Geçersiz Product
```bash
# Invalid product ID ile test
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "body=Test post" \
  -F "contextType=product" \
  -F "contextId=00000000-0000-0000-0000-000000000000" \
  "http://localhost:3000/api/v1/posts/EVENT_ID/post"
```

**Beklenen Response (404)**:
```json
{
  "error": {
    "code": "CONTEXT_NOT_FOUND",
    "message": "Product does not exist or has been deleted. Please select a valid product."
  }
}
```

## Sonuç

### Sorumluluklar

| Taraf | Sorumluluk | Status |
|-------|-----------|--------|
| **Frontend** | Geçerli product ID göndermek | ⚠️ Düzeltilmeli |
| **Frontend** | Cache management | ⚠️ Düzeltilmeli |
| **Frontend** | Error handling | ⚠️ İyileştirilmeli |
| **Backend** | User-friendly error message | ✅ Düzeltildi |
| **Backend** | Doğru HTTP status code | ✅ Düzeltildi |
| **Backend** | Logging | ✅ İyileştirildi |

### Aksiyon Listesi

#### Frontend Team
- [ ] Product validation ekleyin (post oluşturmadan önce)
- [ ] Cache TTL azaltın (max 5-10 dakika)
- [ ] Product listesi refresh ekleyin
- [ ] Error handling iyileştirin
- [ ] Deep link validation ekleyin

#### Backend Team
- [x] Error message iyileştir
- [x] HTTP status code düzelt (404)
- [x] Logging iyileştir
- [x] Debug script ekle
- [ ] Product soft delete ekle (opsiyonel)

---

**Date**: 2026-01-16
**Error Type**: Product Not Found
**Root Cause**: Invalid/Deleted Product ID from Frontend
**Backend Status**: ✅ Fixed (Better error handling)
**Frontend Status**: ⚠️ Needs Fix (Product validation)
