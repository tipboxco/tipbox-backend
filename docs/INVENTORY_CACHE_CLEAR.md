# Inventory Cache Temizleme - Kullanım Kılavuzu

## Sorun
`GET /inventory` endpoint'i cache'den veri dönüyor ve yeni eklenen/güncellenen ürünler görünmüyor.

## Çözümler

### 1. API Endpoint ile (Önerilen)

#### Kendi Cache'inizi Temizleyin
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/v1/inventory/cache/clear
```

**Response:**
```json
{
  "message": "Inventory cache cleared for user 550e8400-e29b-41d4-a716-446655440000",
  "cleared": 1
}
```

#### Belirli Bir Kullanıcının Cache'ini Temizleyin
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": "550e8400-e29b-41d4-a716-446655440000"}' \
  http://localhost:3000/api/v1/inventory/cache/clear
```

#### Tüm Kullanıcıların Cache'ini Temizleyin
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"all": true}' \
  http://localhost:3000/api/v1/inventory/cache/clear
```

**Response:**
```json
{
  "message": "All inventory cache cleared (5 entries)",
  "cleared": 5
}
```

### 2. Node.js Script ile

#### Belirli Kullanıcı
```bash
# .env dosyanızda REDIS_URL tanımlı olmalı
node scripts/clear-inventory-cache.js 550e8400-e29b-41d4-a716-446655440000
```

**Output:**
```
🔍 Inventory cache temizleniyor: userId=550e8400-e29b-41d4-a716-446655440000
✅ Cache temizlendi: inventory:user:550e8400-e29b-41d4-a716-446655440000:list
```

#### Tüm Kullanıcılar
```bash
node scripts/clear-all-inventory-cache.js
```

**Output:**
```
🔍 Tüm inventory cache'leri temizleniyor...
📊 Toplam 5 cache anahtarı bulundu
✅ Temizlendi: inventory:user:550e8400-e29b-41d4-a716-446655440000:list
✅ Temizlendi: inventory:user:660e8400-e29b-41d4-a716-446655440001:list
✅ Temizlendi: inventory:user:770e8400-e29b-41d4-a716-446655440002:list
✅ Temizlendi: inventory:user:880e8400-e29b-41d4-a716-446655440003:list
✅ Temizlendi: inventory:user:990e8400-e29b-41d4-a716-446655440004:list

✅ Toplam 5 cache temizlendi
```

### 3. Redis CLI ile (Manuel)

```bash
# Redis'e bağlan
redis-cli

# Belirli kullanıcının cache'ini temizle
DEL inventory:user:550e8400-e29b-41d4-a716-446655440000:list

# Tüm inventory cache'lerini listele
KEYS inventory:user:*:list

# Tüm inventory cache'lerini temizle (dikkatli kullanın!)
redis-cli --scan --pattern "inventory:user:*:list" | xargs redis-cli DEL
```

## Cache Yapısı

### Cache Key Format
```
inventory:user:{userId}:list
```

### Cache İçeriği
```json
[
  {
    "id": "inventory-id-1",
    "product": {
      "id": "product-id-1",
      "name": "Product Name",
      "mainCategory": "Electronics",
      "subCategory": "Smartphones"
    },
    "image": "https://storage.example.com/image.jpg",
    "experienceCount": 2,
    "status": "own",
    "hasOwned": true
  }
]
```

### Cache TTL
- **Default**: 1 saat (3600 saniye)
- **Location**: `src/infrastructure/cache/cache-ttl.ts`

## Otomatik Cache Invalidation

Aşağıdaki işlemler yapıldığında cache otomatik olarak temizlenmelidir (henüz implement edilmemiş):

### TODO: Otomatik Cache Invalidation
- [ ] Inventory ekleme sonrası
- [ ] Inventory güncelleme sonrası
- [ ] Inventory silme sonrası
- [ ] Experience ekleme/güncelleme sonrası
- [ ] Media ekleme/silme sonrası

### Implementation Önerisi

`inventory.service.ts` içinde cache invalidation ekleyin:

```typescript
// Inventory ekleme sonrası
async addInventoryItem(userId: string, data: CreateInventoryRequest) {
  // ... inventory creation logic
  
  // Invalidate cache
  await this.cacheService.delete(`inventory:user:${userId}:list`);
  
  return result;
}

// Inventory güncelleme sonrası
async updateInventoryItem(userId: string, inventoryId: string, data: UpdateInventoryItemDto) {
  // ... update logic
  
  // Invalidate cache
  await this.cacheService.delete(`inventory:user:${userId}:list`);
  
  return result;
}
```

## Troubleshooting

### Cache Temizlenmiyor
1. **Redis bağlantısını kontrol edin:**
```bash
redis-cli ping
# Response: PONG
```

2. **Cache service bağlantısını kontrol edin:**
```bash
curl http://localhost:3000/health
# Cache status'u kontrol edin
```

3. **Environment variables kontrol edin:**
```bash
# .env dosyasında
REDIS_URL=redis://localhost:6379
CACHE_ENABLED=true
```

### Cache Hala Eski Veri Dönüyor
1. Backend'i restart edin
2. Cache'i temizleyin
3. Browser cache'ini temizleyin
4. Postman/Insomnia cache'ini temizleyin

### Script Çalışmıyor
1. **Node.js version kontrol:**
```bash
node --version
# v18 veya üzeri olmalı
```

2. **Redis package kurulu mu:**
```bash
npm list ioredis
# veya
npm install ioredis
```

3. **Environment variables:**
```bash
# Script çalıştırırken
REDIS_URL=redis://localhost:6379 node scripts/clear-inventory-cache.js USER_ID
```

## API Endpoint Detayları

### POST /inventory/cache/clear

**Authentication**: Required (Bearer Token)

**Request Body**:
```typescript
{
  userId?: string;  // Opsiyonel, boş ise kendi cache'inizi temizler
  all?: boolean;    // true ise tüm inventory cache'lerini temizler
}
```

**Response**:
```typescript
{
  message: string;
  cleared: number;  // Temizlenen cache sayısı
}
```

**Status Codes**:
- `200`: Başarılı
- `401`: Unauthorized
- `500`: Internal Server Error

## Gelecek İyileştirmeler

1. **Otomatik Cache Invalidation**: Inventory değişikliklerinde otomatik cache temizleme
2. **Cache Warming**: Popüler veriler için proactive cache warming
3. **Selective Cache Update**: Tüm cache'i silmek yerine sadece değişen kısmı güncelleme
4. **Cache Analytics**: Cache hit/miss rate tracking
5. **Cache Compression**: Büyük cache'ler için compression

---

**Created**: 2026-01-15
**Author**: System
**Status**: ✅ Production Ready
