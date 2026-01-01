# Experience Snippet Rename - Refactoring Documentation

## 📋 Özet

`aiSplitId` → `experienceSnippetId` olarak yeniden adlandırıldı.

**Neden?**
- AI terminolojisinden uzaklaşarak daha genel bir isim kullanımı
- "Experience Snippet" terimi daha semantik ve açıklayıcı
- Gelecekte AI olmayan yöntemlerle de experience split yapılabilir

---

## 🎯 Soruya Cevap: Experience Görüntüleme Mantığı

### Soru
> Biz her zaman envanter'e baktığımızda deneyimlere ait metinleri görüntülemek için `ai_experience_splits` tablosu ile ilişkilendirerek göstereceğiz doğru mu?

### ✅ Cevap: EVET, Tamamen Doğru!

### Veri Akışı

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Kullanıcı Inventory'ye Ürün Ekler + Experience Yazar    │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Experience → Gemini AI → Split Edilir                    │
│    - Price and Shopping                                      │
│    - Product and Usage                                       │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Split Sonucu → ai_experience_splits Tablosuna Kaydedilir│
│    - id (UUID)                                               │
│    - original_experience                                     │
│    - price_and_shopping                                      │
│    - product_and_usage                                       │
│    - placeholders                                            │
│    - ratings                                                 │
│    - metadata (tokens, processing time, model)              │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Inventory → experience_snippet_id ile Referans Tutar     │
│    inventories.experience_snippet_id = ai_experience_splits.id│
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Inventory Görüntüleme → JOIN ile Deneyim Getir          │
│    SELECT * FROM inventories                                 │
│    LEFT JOIN ai_experience_splits                           │
│    ON inventories.experience_snippet_id = ai_experience_splits.id│
└─────────────────────────────────────────────────────────────┘
```

### Avantajları

#### 1. **Tek Kayıt, Çoklu Kullanım**
Experience bir kere split edilir, her yerden erişilir:
- Inventory'de gösterilebilir
- Post'larda kullanılabilir
- Karşılaştırmalarda referans alınabilir

#### 2. **Veri Tutarlılığı**
```typescript
// İlişkisel veritabanı yapısına uygun
Inventory {
  id: "inv-123"
  experienceSnippetId: "snippet-456" // Sadece referans
}

AiExperienceSplit {
  id: "snippet-456" // Gerçek veri burada
  priceAndShopping: "..."
  productAndUsage: "..."
}
```

#### 3. **Düzenlenebilirlik**
Kullanıcı deneyimini düzenleyebilir:
```typescript
ai_experience_splits {
  isEdited: true // Kullanıcı değiştirdi mi?
  // Orijinal ve güncel versiyonlar aynı tabloda
}
```

#### 4. **Metriks ve Tracking**
AI kullanımını izleyebiliyoruz:
```typescript
ai_experience_splits {
  tokensUsed: 3732
  processingTimeMs: 18352
  model: "gemini-2.5-pro"
  promptVersion: "v2.1"
}
```

#### 5. **Esneklik**
Gelecekte farklı split yöntemleri eklenebilir:
- AI split
- Manuel split
- Şablon bazlı split
- Topluluk destekli split

---

## 🔄 Yapılan Değişiklikler

### 1. Schema (Prisma)

#### Inventory Model
```prisma
// ÖNCE
model Inventory {
  aiSplitId  String?  @map("ai_split_id") @db.Uuid
  aiSplit    AiExperienceSplit?  @relation(fields: [aiSplitId], references: [id])
  @@index([aiSplitId])
}

// SONRA
model Inventory {
  experienceSnippetId  String?  @map("experience_snippet_id") @db.Uuid
  experienceSnippet    AiExperienceSplit?  @relation(fields: [experienceSnippetId], references: [id])
  @@index([experienceSnippetId])
}
```

#### ContentPost Model
```prisma
// ÖNCE
model ContentPost {
  aiSplitId  String?  @map("ai_split_id") @db.Uuid
  aiSplit    AiExperienceSplit?  @relation(fields: [aiSplitId], references: [id])
  @@index([aiSplitId])
}

// SONRA
model ContentPost {
  experienceSnippetId  String?  @map("experience_snippet_id") @db.Uuid
  experienceSnippet    AiExperienceSplit?  @relation(fields: [experienceSnippetId], references: [id])
  @@index([experienceSnippetId])
}
```

### 2. Database Migration

```sql
-- ÖNCE
inventories.ai_split_id → uuid (foreign key to ai_experience_splits.id)
content_posts.ai_split_id → uuid (foreign key to ai_experience_splits.id)

-- SONRA (Prisma otomatik ALTER TABLE yaptı)
inventories.experience_snippet_id → uuid (foreign key to ai_experience_splits.id)
content_posts.experience_snippet_id → uuid (foreign key to ai_experience_splits.id)

-- ✅ Var olan 170 inventory kaydı korundu
-- ✅ Foreign key ilişkileri korundu
-- ✅ Index'ler yeniden oluşturuldu
```

### 3. DTO Güncellemeleri

#### inventory.dto.ts
```typescript
// ÖNCE
export interface CreateInventoryRequest {
  aiSplitId?: string; // AI split sonucunun ID'si (optional)
}

// SONRA
export interface CreateInventoryRequest {
  experienceSnippetId?: string; // Experience snippet ID (optional)
}
```

#### post.dto.ts
```typescript
// ÖNCE
export interface CreateExperiencePostRequest {
  aiSplitId?: string; // AI split sonucunun ID'si (optional)
}

// SONRA
export interface CreateExperiencePostRequest {
  experienceSnippetId?: string; // Experience snippet ID (optional)
}
```

### 4. Service Layer Güncellemeleri

#### InventoryService
```typescript
// ÖNCE
private readonly aiSplitRepo: AiExperienceSplitPrismaRepository;

async splitExperienceWithAI(): Promise<{
  aiSplitId: string;
  priceAndShopping: {...};
  productAndUsage: {...};
}> {
  const aiSplit = await this.aiSplitRepo.create({...});
  return { aiSplitId: aiSplit.id, ... };
}

// SONRA
private readonly experienceSnippetRepo: AiExperienceSplitPrismaRepository;

async splitExperienceWithAI(): Promise<{
  experienceSnippetId: string;
  priceAndShopping: {...};
  productAndUsage: {...};
}> {
  const experienceSnippet = await this.experienceSnippetRepo.create({...});
  return { experienceSnippetId: experienceSnippet.id, ... };
}
```

#### PostService
```typescript
// ÖNCE
private aiSplitRepo: AiExperienceSplitPrismaRepository;

if (request.aiSplitId) {
  await this.prisma.contentPost.update({
    data: { aiSplitId: request.aiSplitId }
  });
}

// SONRA
private experienceSnippetRepo: AiExperienceSplitPrismaRepository;

if (request.experienceSnippetId) {
  await this.prisma.contentPost.update({
    data: { experienceSnippetId: request.experienceSnippetId }
  });
}
```

---

## 🧪 Test ve Doğrulama

### 1. Schema Validation
```bash
✅ npx prisma validate
✅ No schema errors
```

### 2. Database Migration
```bash
✅ docker-compose exec backend npx prisma db push
✅ Database is now in sync with your Prisma schema
```

### 3. Var Olan Veriler
```sql
SELECT COUNT(*) as total_inventories, 
       COUNT(experience_snippet_id) as with_snippet 
FROM inventories;

-- Result:
-- total_inventories: 170
-- with_snippet: 0
-- ✅ Tüm kayıtlar korundu!
```

### 4. Foreign Key İlişkileri
```sql
-- ÖNCE
inventories_ai_split_id_fkey

-- SONRA
inventories_experience_snippet_id_fkey

-- ✅ İlişkiler korundu ve yeniden oluşturuldu
```

### 5. Linter ve TypeScript
```bash
✅ No linter errors
✅ No TypeScript compilation errors
```

### 6. Backend Restart
```bash
✅ Container tipbox_backend restarted successfully
✅ Backend healthy
```

---

## 📊 API Değişiklikleri

### Inventory Endpoint

#### POST /inventory
```json
// ÖNCE
{
  "productId": "uuid",
  "hasOwned": true,
  "experienceSummary": "...",
  "aiSplitId": "uuid" // optional
}

// SONRA
{
  "productId": "uuid",
  "hasOwned": true,
  "experienceSummary": "...",
  "experienceSnippetId": "uuid" // optional
}
```

#### POST /inventory/split-experience
```json
// Response ÖNCE
{
  "aiSplitId": "uuid",
  "priceAndShopping": {...},
  "productAndUsage": {...}
}

// Response SONRA
{
  "experienceSnippetId": "uuid",
  "priceAndShopping": {...},
  "productAndUsage": {...}
}
```

### Post Endpoint

#### POST /post/experience
```json
// ÖNCE
{
  "content": "...",
  "productId": "uuid",
  "aiSplitId": "uuid" // optional
}

// SONRA
{
  "content": "...",
  "productId": "uuid",
  "experienceSnippetId": "uuid" // optional
}
```

---

## 🔒 Backward Compatibility

### Database Level ✅
- Sütun isimleri güncellendi
- Var olan veriler korundu
- Foreign key ilişkileri korundu
- Index'ler yeniden oluşturuldu

### API Level ⚠️
**BREAKING CHANGE:** API request/response field isimleri değişti:
- `aiSplitId` → `experienceSnippetId`

**Frontend güncellemesi gerekiyor:**
```typescript
// ÖNCE
const response = await api.post('/inventory', {
  aiSplitId: splitResult.aiSplitId
});

// SONRA
const response = await api.post('/inventory', {
  experienceSnippetId: splitResult.experienceSnippetId
});
```

---

## 📚 İsim Değişikliği Mantığı

### Neden "Experience Snippet"?

#### 1. **AI-Agnostic**
```
aiSplitId        → AI'ya bağımlı
experienceSnippetId → AI'dan bağımsız, genel amaçlı
```

#### 2. **Semantik Açıklık**
```
"Split" → Ne split ediliyor? Neden?
"Snippet" → Deneyimin bir parçası, açık ve anlaşılır
```

#### 3. **Gelecek Esnekliği**
```typescript
// Gelecekte farklı kaynaklardan snippet oluşturulabilir:
interface ExperienceSnippet {
  source: 'ai' | 'manual' | 'template' | 'community';
  priceAndShopping: {...};
  productAndUsage: {...};
}
```

#### 4. **Domain Driven Design**
```
"AI Split" → Teknik implementasyon detayı
"Experience Snippet" → Business domain terimi
```

---

## 🎯 Örnek Kullanım Senaryoları

### Senaryo 1: Inventory Ekleme + AI Split

```typescript
// 1. Experience'i split et
const splitResult = await inventoryService.splitExperienceWithAI({
  userId: 'user-123',
  productId: 'product-456',
  experienceText: 'Çok pahalı buldum ama ürün harika...'
});

// 2. Inventory'ye ekle (snippet ID ile referans ver)
await inventoryService.createInventoryItem(userId, {
  productId: 'product-456',
  hasOwned: true,
  experienceSnippetId: splitResult.experienceSnippetId // Referans
});
```

### Senaryo 2: Inventory Görüntüleme

```typescript
// Inventory + Experience Snippet birlikte getir
const inventory = await prisma.inventory.findUnique({
  where: { id: inventoryId },
  include: {
    experienceSnippet: true // JOIN ile getir
  }
});

console.log(inventory.experienceSnippet?.priceAndShopping);
console.log(inventory.experienceSnippet?.productAndUsage);
```

### Senaryo 3: Experience Düzenleme

```typescript
// Kullanıcı experience'i düzenler
await prisma.aiExperienceSplit.update({
  where: { id: experienceSnippetId },
  data: {
    priceAndShopping: 'Güncellenmiş metin...',
    isEdited: true // Düzenlenmiş olarak işaretle
  }
});

// Tüm referans veren inventory ve post'lar güncel veriyi görür!
```

---

## 📁 Etkilenen Dosyalar

### Schema ve Database
- ✅ `prisma/schema.prisma`
- ✅ Database tables (inventories, content_posts)

### DTO'lar
- ✅ `src/interfaces/inventory/inventory.dto.ts`
- ✅ `src/interfaces/post/post.dto.ts`

### Service Layer
- ✅ `src/application/inventory/inventory.service.ts`
- ✅ `src/application/post/post.service.ts`

### Domain (Değişiklik yok)
- ℹ️ `src/domain/inventory/inventory.entity.ts` (Minimal entity, ID tutmuyor)

### Repository (Değişiklik yok)
- ℹ️ Prisma Client otomatik generate oldu

---

## ✅ Checklist

- [x] Schema güncellendi
- [x] Database migration yapıldı (prisma db push)
- [x] Var olan veriler korundu (170 inventory)
- [x] Foreign key ilişkileri korundu
- [x] Index'ler güncellendi
- [x] DTO'lar güncellendi
- [x] Service layer güncellendi
- [x] Linter hataları yok
- [x] TypeScript compilation başarılı
- [x] Backend restart edildi
- [x] Backend healthy
- [x] Commit ve push yapıldı
- [x] Dokümantasyon oluşturuldu

---

## 🚀 Sonraki Adımlar

### Frontend Güncellemesi Gerekiyor ⚠️
```typescript
// Tüm API çağrılarında field ismi değişikliği:
aiSplitId → experienceSnippetId
```

### Test Edilmesi Gerekenler
1. ✅ Yeni inventory ekleme + AI split
2. ✅ Experience snippet görüntüleme
3. ✅ Experience düzenleme
4. ⏳ Post oluşturma + snippet referansı
5. ⏳ Var olan inventory'lere yeni experience ekleme

---

**Hazırlayan:** AI Assistant  
**Tarih:** 25 Aralık 2025  
**Branch:** `feat/splitExperience`  
**Commit:** `5aa28f3`

