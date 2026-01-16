# Event Post - InventoryId Support

## Değişiklik

`POST /posts/{eventId}/post` endpoint'ine `inventoryId` desteği eklendi. Artık App tarafı `inventoryId` gönderdiğinde, backend otomatik olarak productId'yi inventory'den çekiyor.

## Problem

**Önce:**
- App `productId` göndermek zorundaydı
- `productId` bazı durumlarda App'de mevcut değildi
- Kullanıcı inventory'den product seçtiğinde sadece `inventoryId` vardı

**Şimdi:**
- App `inventoryId` gönderebilir
- Backend `inventoryId`'den `productId`'yi otomatik olarak çeker
- Ownership kontrolü yapılır (güvenlik)

## API Değişiklikleri

### Request Body

#### Yeni Field
```typescript
{
  "body": "Post içeriği",
  "contextType": "product",
  "inventoryId": "c505c6c2-1234-5678-90ab-cdef12345678", // ✅ YENİ
  "eventId": "00MKFPNIQ30000064YDGL62K7Q"
}
```

#### Eski Field (Hala Destekleniyor)
```typescript
{
  "body": "Post içeriği",
  "contextType": "product",
  "contextId": "01H8PRO123456789ABCDEFGH", // Product ID direkt
  "eventId": "00MKFPNIQ30000064YDGL62K7Q"
}
```

### Validation Rules

| Field | Required | Description |
|-------|----------|-------------|
| `body` | Yes | Post içeriği |
| `contextType` | Yes | `"product"` veya `"sub_category"` |
| `contextId` | Conditional | `inventoryId` yoksa zorunlu |
| `inventoryId` | Conditional | `contextId` yoksa zorunlu |
| `images` | No | Maksimum 10 dosya |

**Not**: `contextId` VEYA `inventoryId` gerekli (en az biri)

## Backend İşleyişi

### Flow

```
1. Request gelir
   ↓
2. inventoryId var mı kontrol et
   ↓
3. Varsa:
   a. Inventory'yi bul
   b. Ownership kontrolü yap (güvenlik)
   c. productId'yi çek
   ↓
4. Yoksa:
   - contextId'yi kullan (eski davranış)
   ↓
5. Product'ı validate et
   ↓
6. Post oluştur
```

### Service Layer

#### Yeni Metod: `resolveProductIdFromInventory`
```typescript
private async resolveProductIdFromInventory(
  inventoryId: string,
  userId: string
): Promise<string> {
  const inventory = await this.prisma.inventory.findUnique({
    where: { id: inventoryId },
    select: { 
      productId: true,
      userId: true 
    },
  });

  if (!inventory) {
    throw new Error('Inventory item not found.');
  }

  // Security: Ownership check
  if (inventory.userId !== userId) {
    throw new Error('This inventory item does not belong to you.');
  }

  return inventory.productId;
}
```

#### Güncellenen Metod: `createFreePost`
```typescript
// InventoryId'den productId'yi resolve et
let actualContextId = request.contextId;

if (request.inventoryId && request.contextType === ContextType.PRODUCT) {
  const productId = await this.resolveProductIdFromInventory(
    request.inventoryId,
    userId
  );
  actualContextId = productId;
}

// Devamı...
```

## Kullanım Örnekleri

### Senaryo 1: Inventory'den Product Seçimi (YENİ)

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "body=Bu ürünü çok beğendim!" \
  -F "contextType=product" \
  -F "inventoryId=c505c6c2-1234-5678-90ab-cdef12345678" \
  http://localhost:3000/api/v1/posts/EVENT_ID/post
```

**Backend İşlem:**
1. `inventoryId` → `c505c6c2-1234-5678-90ab-cdef12345678`
2. Database'den inventory çekiliyor
3. `productId` → `01H8PRO123456789ABCDEFGH`
4. Ownership check: ✅ Kullanıcıya ait
5. Post oluşturuluyor

### Senaryo 2: Direkt Product ID (ESKİ - Hala Çalışıyor)

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "body=Bu ürünü çok beğendim!" \
  -F "contextType=product" \
  -F "contextId=01H8PRO123456789ABCDEFGH" \
  http://localhost:3000/api/v1/posts/EVENT_ID/post
```

## Error Responses

### 404 - Inventory Not Found
```json
{
  "error": {
    "code": "INVENTORY_NOT_FOUND",
    "message": "Inventory item not found. Please select a valid product from your inventory."
  }
}
```

### 403 - Inventory Ownership
```json
{
  "error": {
    "code": "INVENTORY_FORBIDDEN",
    "message": "This inventory item does not belong to you."
  }
}
```

### 400 - Missing Fields
```json
{
  "message": "Either contextId or inventoryId is required"
}
```

## Frontend Integration

### TypeScript Interface
```typescript
interface CreateEventPostRequest {
  body: string;
  contextType: 'product' | 'sub_category';
  contextId?: string;     // Optional if inventoryId provided
  inventoryId?: string;   // ✅ YENİ: Optional if contextId provided
  images?: File[];
}
```

### Kullanım 1: Inventory'den
```typescript
// User inventory'den product seçti
const createPostFromInventory = async (inventoryItem: InventoryItem) => {
  const formData = new FormData();
  formData.append('body', 'Post içeriği');
  formData.append('contextType', 'product');
  formData.append('inventoryId', inventoryItem.id); // ✅ Sadece inventory ID
  
  await api.post(`/posts/${eventId}/post`, formData);
};
```

### Kullanım 2: Product Catalog'dan
```typescript
// User product catalog'dan product seçti
const createPostFromCatalog = async (product: Product) => {
  const formData = new FormData();
  formData.append('body', 'Post içeriği');
  formData.append('contextType', 'product');
  formData.append('contextId', product.id); // ✅ Direkt product ID
  
  await api.post(`/posts/${eventId}/post`, formData);
};
```

## Güvenlik

### 1. Ownership Check
```typescript
// Backend otomatik olarak kontrol ediyor
if (inventory.userId !== userId) {
  throw new Error('This inventory item does not belong to you.');
}
```

**Güvenlik Senaryosu:**
- User A: `inventoryId = 123` (User A'ya ait)
- User B: `inventoryId = 123` kullanmaya çalışıyor
- ❌ Backend reject ediyor: "This inventory item does not belong to you."

### 2. Database Query Optimization
```typescript
// Sadece gerekli field'ları çek
select: { 
  productId: true,
  userId: true // Ownership check için
}
```

## Logging

```json
{
  "message": "ProductId resolved from inventoryId",
  "inventoryId": "c505c6c2-1234-5678-90ab-cdef12345678",
  "productId": "01H8PRO123456789ABCDEFGH",
  "userId": "44444444-4444-4444-a444-444444444444"
}
```

```json
{
  "message": "Free post created: 01JKPOST123 by user 44444444-4444-4444-a444-444444444444",
  "eventId": "00MKFPNIQ30000064YDGL62K7Q",
  "contextType": "product",
  "contextId": "01H8PRO123456789ABCDEFGH",
  "inventoryId": "c505c6c2-1234-5678-90ab-cdef12345678"
}
```

## Testing

### Test 1: InventoryId ile Post
```bash
# 1. Inventory listesini çek
INVENTORY_ID=$(curl -s -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/inventory | jq -r '.[0].id')

# 2. InventoryId ile post oluştur
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "body=Test post from inventory" \
  -F "contextType=product" \
  -F "inventoryId=${INVENTORY_ID}" \
  "http://localhost:3000/api/v1/posts/EVENT_ID/post"
```

### Test 2: Ownership Check
```bash
# Başka kullanıcının inventory'sini kullanmaya çalış (401/403 bekleniyor)
curl -X POST \
  -H "Authorization: Bearer DIFFERENT_USER_TOKEN" \
  -F "body=Test post" \
  -F "contextType=product" \
  -F "inventoryId=OTHER_USER_INVENTORY_ID" \
  "http://localhost:3000/api/v1/posts/EVENT_ID/post"
```

## Migration Guide

### Frontend Değişikliği Gerekli mi?

❌ **Hayır** - Backward compatible
✅ **Opsiyonel** - Inventory akışı için yeni field kullanılabilir

### Mevcut Kod Hala Çalışıyor
```typescript
// Eski kod - değişiklik gerekmez
formData.append('contextId', productId);
```

### Yeni Feature Eklemek İsterseniz
```typescript
// Yeni feature
if (source === 'inventory') {
  formData.append('inventoryId', item.id);
} else {
  formData.append('contextId', item.productId);
}
```

## Performance

### Database Queries

**InventoryId ile:**
```sql
-- 1. Inventory lookup (productId çekmek için)
SELECT productId, userId FROM inventory WHERE id = ?;

-- 2. Product validation (zaten yapılıyor)
SELECT * FROM product WHERE id = ?;
```

**contextId ile:**
```sql
-- 1. Product validation
SELECT * FROM product WHERE id = ?;
```

**Impact**: +1 query (inventory lookup) - minimal impact

### Caching
Inventory lookup için cache eklenebilir (opsiyonel optimization)

## Değiştirilen Dosyalar

```
✓ src/interfaces/post/post.dto.ts
  - CreatePostRequest'e inventoryId field'ı eklendi

✓ src/application/post/post.service.ts
  - resolveProductIdFromInventory() metodu eklendi
  - createFreePost() inventoryId desteği eklendi
  - Ownership check eklendi

✓ src/interfaces/post/post.router.ts
  - inventoryId validation eklendi
  - Error handling güncellendi (INVENTORY_NOT_FOUND, INVENTORY_FORBIDDEN)
  - OpenAPI documentation güncellendi
```

## Breaking Changes

❌ **Breaking Change Yok**
- Eski `contextId` hala çalışıyor
- Yeni `inventoryId` opsiyonel

## Checklist

- [x] DTO güncellendi
- [x] Service layer güncellendi
- [x] Router güncellendi
- [x] Validation eklendi
- [x] Ownership check eklendi
- [x] Error handling eklendi
- [x] Logging eklendi
- [x] OpenAPI documentation güncellendi
- [x] Test senaryoları hazırlandı
- [x] Dokümantasyon yazıldı
- [ ] Frontend team bilgilendirildi
- [ ] Production test yapıldı

---

**Date**: 2026-01-16
**Feature**: InventoryId Support for Event Posts
**Status**: ✅ Ready for Production
**Breaking Change**: ❌ No
**Backward Compatible**: ✅ Yes
