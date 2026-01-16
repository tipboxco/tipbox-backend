# Inventory API - productId Field Eklendi

## Değişiklik

`GET /inventory` endpoint'ine `productId` field'ı eklendi.

## Önceki Response Format

```json
[
  {
    "id": "c505c6c2-1234-5678-90ab-cdef12345678",
    "brand": {
      "name": "Apple",
      "model": "iPhone 15 Pro",
      "specs": "256GB Storage, Titanium Blue"
    },
    "image": "https://storage.example.com/image.jpg",
    "reviews": [...],
    "tags": ["Recent", "Owned"]
  }
]
```

## Yeni Response Format

```json
[
  {
    "id": "c505c6c2-1234-5678-90ab-cdef12345678",
    "productId": "01H8PRO123456789ABCDEFGH",  // ✅ YENİ FIELD
    "brand": {
      "name": "Apple",
      "model": "iPhone 15 Pro",
      "specs": "256GB Storage, Titanium Blue"
    },
    "image": "https://storage.example.com/image.jpg",
    "reviews": [...],
    "tags": ["Recent", "Owned"]
  }
]
```

## Field Açıklaması

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string (UUID) | Inventory item ID | `"c505c6c2-1234-..."` |
| `productId` | string (ULID) | Product tablosundaki ID | `"01H8PRO123456..."` |

## Kullanım Örneği

### Request
```bash
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/inventory
```

### Response
```json
[
  {
    "id": "c505c6c2-1234-5678-90ab-cdef12345678",
    "productId": "01H8PRO123456789ABCDEFGH",
    "brand": {
      "name": "Apple",
      "model": "iPhone 15 Pro",
      "specs": "256GB Storage, Titanium Blue"
    },
    "image": "https://storage.example.com/image.jpg",
    "reviews": [
      {
        "title": "Great phone",
        "description": "Amazing camera quality",
        "rating": 5
      }
    ],
    "tags": ["Recent", "Owned", "Premium"]
  }
]
```

## Frontend Kullanımı

### TypeScript Interface
```typescript
interface InventoryItem {
  id: string;
  productId: string; // ✅ YENİ
  brand: {
    name: string;
    model: string;
    specs: string;
  };
  image: string | null;
  reviews: Array<{
    title: string;
    description: string;
    rating: number;
  }>;
  tags: string[];
}
```

### Kullanım
```typescript
// Inventory listesini çek
const response = await api.get<InventoryItem[]>('/inventory');

// productId ile işlem yap
response.data.forEach(item => {
  console.log(`Product ID: ${item.productId}`);
  console.log(`Inventory ID: ${item.id}`);
  
  // Product detayına git
  router.push(`/products/${item.productId}`);
});
```

## Değiştirilen Dosyalar

```
✓ src/interfaces/inventory/inventory.dto.ts
  - InventoryListItemResponse interface'ine productId field'ı eklendi

✓ src/application/inventory/inventory.service.ts
  - getUserInventoryList() metodunda response'a productId eklendi

✓ src/interfaces/inventory/inventory.router.ts
  - OpenAPI/Swagger documentation güncellendi
```

## Cache Invalidation Gerekli! ⚠️

Bu değişiklik mevcut cache'i etkilemektedir. Cache'i temizlemek için:

### Yöntem 1: API Endpoint (Önerilen)
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/inventory/cache/clear
```

### Yöntem 2: Script
```bash
node scripts/clear-all-inventory-cache.js
```

### Yöntem 3: Redis CLI
```bash
redis-cli --scan --pattern "inventory:user:*:list" | xargs redis-cli DEL
```

## Breaking Changes

❌ **Breaking Change Yok**: Yeni field eklendi, mevcut field'lar değişmedi.

## Migration Guide

Frontend'de `productId` field'ını kullanmaya başlayabilirsiniz:

**Önce (Eski)**:
```typescript
// Product ID'ye erişim yok, sadece inventory ID var
const inventoryId = item.id;
```

**Sonra (Yeni)**:
```typescript
// Artık hem inventory ID hem product ID var
const inventoryId = item.id;
const productId = item.productId; // ✅ Yeni field
```

## Testing

### Test 1: productId Field Var mı?
```bash
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/inventory | jq '.[0].productId'
```

**Beklenen Output**: `"01H8PRO123456789ABCDEFGH"` (ULID format)

### Test 2: productId ile Product Detayına Erişim
```bash
# 1. Inventory'den productId al
PRODUCT_ID=$(curl -s -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/inventory | jq -r '.[0].productId')

# 2. Product detayını çek
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/v1/products/${PRODUCT_ID}"
```

### Test 3: Cache Temizleme
```bash
# Cache'i temizle
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/inventory/cache/clear

# Inventory'yi tekrar çek (productId olmalı)
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/inventory | jq '.[0] | {id, productId}'
```

## Performance Impact

✅ **Minimal Performance Impact**: 
- `productId` zaten database'den çekiliyor (inventory.productId)
- Sadece response'a eklendi, ekstra query yok
- Cache structure değişmedi, sadece yeni field eklendi

## Rollback Plan

Eğer sorun çıkarsa geri almak için:

1. **inventory.dto.ts**'den `productId` field'ını kaldır
2. **inventory.service.ts**'den `productId: inventory.productId` satırını kaldır
3. Cache'i temizle
4. Backend'i restart et

## Production Checklist

- [x] TypeScript interface güncellendi
- [x] Service layer güncellendi
- [x] OpenAPI documentation güncellendi
- [x] Linter hataları yok
- [ ] Cache temizlendi (production'da yapılacak)
- [ ] Frontend team bilgilendirildi
- [ ] API documentation güncellendi

---

**Date**: 2026-01-15
**Status**: ✅ Ready for Production
**Breaking Change**: ❌ No
**Cache Invalidation Required**: ✅ Yes
