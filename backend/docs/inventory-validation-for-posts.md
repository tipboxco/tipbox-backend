# Gönderi Oluşturma için Envanter Kontrolü

## Genel Bakış

Kullanıcılar artık yalnızca kendi envanterlerinde bulunan ürünler hakkında gönderi oluşturabilir. Bu kontrol, tüm post tiplerinde (Free, Tips, Question, Benchmark, Experience, Update) uygulanmaktadır.

## Değişiklikler

### 1. InventoryService
**Dosya:** `backend/src/application/inventory/inventory.service.ts`

Yeni metod eklendi:
```typescript
async hasProductInInventory(userId: string, productId: string): Promise<boolean>
```

Bu metod, kullanıcının envanterinde belirtilen ürünün olup olmadığını kontrol eder.

### 2. PostService
**Dosya:** `backend/src/application/post/post.service.ts`

Tüm post oluşturma metotlarına envanter kontrolü eklendi:

- `createFreePost()` - Product context için kontrol
- `createTipsAndTricksPost()` - Product context için kontrol
- `createQuestionPost()` - Product context için kontrol
- `createBenchmarkPost()` - Product context ve karşılaştırılan tüm ürünler için kontrol
- `createExperiencePost()` - "I owned" status için kontrol (I tried için kontrol yok)
- `createUpdatePost()` - Product context için kontrol

## Hata Mesajları

Kullanıcı envanterinde olmayan bir ürün için post oluşturmaya çalıştığında, şu hata mesajları döner:

### HTTP 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Bu ürün envanterinizde bulunmuyor. Gönderi oluşturmak için önce ürünü envanterinize eklemelisiniz.",
    "traceId": "...",
    "timestamp": "...",
    "path": "/posts/free"
  }
}
```

### Post Tiplerine Göre Özel Mesajlar

| Post Tipi | Mesaj |
|-----------|-------|
| Free Post | "Bu ürün envanterinizde bulunmuyor. Gönderi oluşturmak için önce ürünü envanterinize eklemelisiniz." |
| Tips & Tricks | "Bu ürün envanterinizde bulunmuyor. İpucu paylaşmak için önce ürünü envanterinize eklemelisiniz." |
| Question | "Bu ürün envanterinizde bulunmuyor. Soru sormak için önce ürünü envanterinize eklemelisiniz." |
| Benchmark | "Bu ürün envanterinizde bulunmuyor. Karşılaştırma paylaşmak için önce ürünü envanterinize eklemelisiniz."<br>"Karşılaştırmak istediğiniz ürünlerden biri veya birkaçı envanterinizde bulunmuyor. Karşılaştırma yapabilmek için tüm ürünlerin envanterinizde olması gerekir." |
| Experience (Owned) | "Bu ürün 'Sahip Olduğum' olarak işaretlenmiş ancak envanterinizde bulunmuyor. Lütfen önce ürünü envanterinize ekleyin veya 'Denedim' seçeneğini kullanın." |
| Update | "Bu ürün envanterinizde bulunmuyor. Güncelleme paylaşmak için önce ürünü envanterinize eklemelisiniz." |

## Özel Durumlar

### 1. Sub-Category ve Product Group Context
Sub-category veya product group context'inde oluşturulan post'lar için envanter kontrolü yapılmaz. Sadece product context'inde kontrol yapılır.

### 2. Experience Post - "I Tried" Status
Experience post'larda "I tried" (denedim) status'ü seçilirse envanter kontrolü yapılmaz. Bu durumda kullanıcı ürüne sahip olmadan deneyim paylaşabilir.

### 3. Benchmark Post - Tüm Ürünler Kontrol Edilir
Benchmark (karşılaştırma) post'larında, karşılaştırılan TÜM ürünlerin kullanıcı envanterinde olması gerekir. Eğer karşılaştırılan ürünlerden herhangi biri envanterde yoksa post oluşturulamaz.

## Frontend Entegrasyonu

Frontend tarafında, kullanıcıya gösterilecek hata mesajı:

```javascript
// API'den gelen hata
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Bu ürün envanterinizde bulunmuyor..."
  }
}

// UI'da gösterilecek
// Toast/Alert: "Bu ürün henüz envanterinizde yok"
// Button: "Envantere Ekle" (inventory'ye yönlendirir)
```

### Önerilen UX Akışı

1. Kullanıcı post oluşturmaya çalışır
2. Backend envanter kontrolü yapar
3. Ürün envanterde yoksa:
   - Hata mesajı gösterilir: "Bu ürün henüz envanterinizde yok"
   - "Envantere Ekle" butonu gösterilir
   - Butona tıklandığında inventory ekranına yönlendirilir
4. Ürün envanterde varsa:
   - Post başarıyla oluşturulur

## Test Senaryoları

### Senaryo 1: Free Post - Ürün Envanterde Değil
```bash
POST /posts/free
{
  "contextType": "product",
  "contextId": "prod_01HXXX...",
  "description": "Harika bir ürün!"
}

# Beklenen: 400 Bad Request
# "Bu ürün envanterinizde bulunmuyor..."
```

### Senaryo 2: Free Post - Ürün Envanterde
```bash
# Önce ürünü envantere ekle
POST /inventory
{
  "productId": "prod_01HXXX...",
  "status": "own",
  "content": "..."
}

# Sonra post oluştur
POST /posts/free
{
  "contextType": "product",
  "contextId": "prod_01HXXX...",
  "description": "Harika bir ürün!"
}

# Beklenen: 201 Created
```

### Senaryo 3: Benchmark - Bir Ürün Envanterde Değil
```bash
POST /posts/benchmark
{
  "contextType": "product",
  "contextId": "prod_01HXXX...",
  "products": [
    {"productId": "prod_01HXXX...", "isSelected": true},  # Envanterde
    {"productId": "prod_02HYYY...", "isSelected": true}   # Envanterde DEĞİL
  ],
  "description": "Karşılaştırma"
}

# Beklenen: 400 Bad Request
# "Karşılaştırmak istediğiniz ürünlerden biri veya birkaçı envanterinizde bulunmuyor..."
```

### Senaryo 4: Experience - "I Tried" (Kontrol Yok)
```bash
POST /posts/experience
{
  "contextType": "product",
  "contextId": "prod_01HXXX...",
  "status": "tested",  # I tried
  "content": "...",
  "experience": [...]
}

# Beklenen: 201 Created (envanter kontrolü yapılmaz)
```

### Senaryo 5: Experience - "I Owned" Envanterde Değil
```bash
POST /posts/experience
{
  "contextType": "product",
  "contextId": "prod_01HXXX...",
  "status": "own",  # I owned
  "content": "...",
  "experience": [...]
}

# Beklenen: 400 Bad Request
# "Bu ürün 'Sahip Olduğum' olarak işaretlenmiş ancak envanterinizde bulunmuyor..."
```

## Performans Notları

Her post oluşturma isteğinde veritabanına ek bir sorgu yapılır (envanter kontrolü). Bu sorgu optimize edilmiştir:
- Sadece `id` field'ı seçilir
- Index'li sorgudur (`userId_productId` unique constraint)
- Ortalama sorgu süresi: ~1-2ms

## Backward Compatibility

Bu değişiklik, mevcut post'ları etkilemez. Sadece YENİ post oluşturma isteklerinde envanter kontrolü yapılır.
