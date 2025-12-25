# Placeholder Alanları Database Yazılmama Sorunu - Çözüm Raporu

## 🐛 Sorun Açıklaması

Split Experience özelliğinde, Gemini AI'dan dönen `placeholder` ve `isEnhanced` alanları API response'unda görünüyor ama database'e yazılmıyordu.

### Örnek Response (AI'dan dönüyor):
```json
{
  "priceAndShopping": {
    "content": "...",
    "rating": 4,
    "placeholder": "Nereden satın aldınız? Paketleme kalitesi...",
    "isEnhanced": true
  },
  "productAndUsage": {
    "content": "...",
    "rating": 5,
    "placeholder": "Ürünü ne kadar süredir kullanıyorsunuz?...",
    "isEnhanced": true
  }
}
```

### Database Durumu (Placeholder boş):
```sql
SELECT 
  id, 
  price_and_shopping_placeholder, 
  product_and_usage_placeholder 
FROM ai_experience_splits 
ORDER BY created_at DESC 
LIMIT 3;

-- Sonuç: Tüm placeholder sütunları NULL
```

---

## 🔍 Kök Neden Analizi

### 1. Schema ✅ DOĞRU
`prisma/schema.prisma` dosyasında alanlar tanımlıydı:

```prisma
model AiExperienceSplit {
  priceAndShoppingPlaceholder   String?   @map("price_and_shopping_placeholder") @db.Text
  productAndUsagePlaceholder    String?   @map("product_and_usage_placeholder") @db.Text
  priceAndShoppingIsEnhanced    Boolean?  @map("price_and_shopping_is_enhanced")
  productAndUsageIsEnhanced     Boolean?  @map("product_and_usage_is_enhanced")
}
```

### 2. Database Sütunları ✅ DOĞRU
```bash
docker-compose exec postgres psql -U postgres -d tipbox_dev -c "\d ai_experience_splits"

# Sonuç:
# price_and_shopping_placeholder | text
# product_and_usage_placeholder  | text
# price_and_shopping_is_enhanced | boolean
# product_and_usage_is_enhanced  | boolean
```

### 3. Service Layer ✅ DOĞRU
`post.service.ts` ve `inventory.service.ts` dosyalarında veriler doğru şekilde gönderiliyordu:

```typescript
const aiSplit = await this.aiSplitRepo.create({
  userId,
  productId,
  originalExperience: experienceText,
  priceAndShopping: splitResult.priceAndShopping?.content ?? null,
  priceAndShoppingPlaceholder: splitResult.priceAndShopping?.placeholder ?? null,
  productAndUsagePlaceholder: splitResult.productAndUsage?.placeholder ?? null,
  priceAndShoppingIsEnhanced: splitResult.priceAndShopping?.isEnhanced ?? null,
  productAndUsageIsEnhanced: splitResult.productAndUsage?.isEnhanced ?? null,
  // ...
});
```

### 4. Repository Layer ❌ HATA BULUNDU!

`src/infrastructure/repositories/ai-experience-split-prisma.repository.ts`

**SORUN:** `create()` metodunda placeholder ve isEnhanced alanları Prisma'ya gönderilmiyordu!

```typescript
async create(data: CreateAiExperienceSplitData): Promise<AiExperienceSplit> {
  const split = await this.prisma.aiExperienceSplit.create({
    data: {
      userId: data.userId,
      productId: data.productId ?? null,
      originalExperience: data.originalExperience,
      priceAndShopping: data.priceAndShopping ?? null,
      productAndUsage: data.productAndUsage ?? null,
      priceAndShoppingRating: data.priceAndShoppingRating ?? null,
      productAndUsageRating: data.productAndUsageRating ?? null,
      // ❌ PLACEHOLDER VE ISENHANCED ALANLARI EKSİK!
      isEdited: data.isEdited ?? false,
      model: data.model ?? 'gemini-2.5-pro',
      promptVersion: data.promptVersion ?? 'v1.0',
      tokensUsed: data.tokensUsed ?? null,
      processingTimeMs: data.processingTimeMs ?? null
    },
    // ...
  });
}
```

---

## ✅ Uygulanan Çözüm

### 1. Repository Create Metodu Güncellendi

```typescript
async create(data: CreateAiExperienceSplitData): Promise<AiExperienceSplit> {
  const split = await this.prisma.aiExperienceSplit.create({
    data: {
      userId: data.userId,
      productId: data.productId ?? null,
      originalExperience: data.originalExperience,
      priceAndShopping: data.priceAndShopping ?? null,
      productAndUsage: data.productAndUsage ?? null,
      priceAndShoppingRating: data.priceAndShoppingRating ?? null,
      productAndUsageRating: data.productAndUsageRating ?? null,
      // ✅ PLACEHOLDER ALANLARI EKLENDİ
      priceAndShoppingPlaceholder: data.priceAndShoppingPlaceholder ?? null,
      productAndUsagePlaceholder: data.productAndUsagePlaceholder ?? null,
      // ✅ ISENHANCED ALANLARI EKLENDİ
      priceAndShoppingIsEnhanced: data.priceAndShoppingIsEnhanced ?? null,
      productAndUsageIsEnhanced: data.productAndUsageIsEnhanced ?? null,
      isEdited: data.isEdited ?? false,
      model: data.model ?? 'gemini-2.5-pro',
      promptVersion: data.promptVersion ?? 'v2.1', // ✅ v1.0 → v2.1
      tokensUsed: data.tokensUsed ?? null,
      processingTimeMs: data.processingTimeMs ?? null
    },
    include: {
      user: true,
      product: true
    }
  });
  return this.toDomain(split);
}
```

### 2. TypeScript Interface Güncellemeleri

**a. gemini.service.ts:**
```typescript
export interface SplitExperienceResponse {
  priceAndShopping: {
    content: string;
    rating: number;
    placeholder?: string | null; // undefined yerine null destekleniyor
    isEnhanced?: boolean;
  } | null;
  productAndUsage: {
    content: string;
    rating: number;
    placeholder?: string | null; // undefined yerine null destekleniyor
    isEnhanced?: boolean;
  } | null;
  metadata: { /* ... */ };
}
```

**b. post.dto.ts:**
```typescript
export interface ExperienceCategory {
  content: string;
  rating: number;
  placeholder?: string | null; // undefined yerine null destekleniyor
  isEnhanced?: boolean;
}
```

### 3. Parser Logic İyileştirildi

```typescript
// AI'dan gelen veya fallback
let placeholder = parsed.priceAndShopping.placeholder 
  ? String(parsed.priceAndShopping.placeholder).trim() 
  : null;

// Eğer içerik varsa ama placeholder yoksa, fallback kullan
if (content && !placeholder) {
  placeholder = fallbackPlaceholders.priceAndShopping;
}
```

---

## 🧪 Test ve Doğrulama

### Test Senaryosu:
```bash
POST http://localhost:3000/inventory/split-experience
{
  "productId": "...",
  "experienceText": "Başlangıçta pahalı buldum ama ürün harika."
}
```

### Beklenen Database Sonucu:
```sql
SELECT 
  price_and_shopping_placeholder,
  product_and_usage_placeholder,
  price_and_shopping_is_enhanced,
  product_and_usage_is_enhanced
FROM ai_experience_splits 
WHERE id = '...';

-- ✅ Artık dolu olmalı:
-- price_and_shopping_placeholder: "Nereden satın aldınız?..."
-- product_and_usage_placeholder: "Ürünü ne kadar süredir kullanıyorsunuz?..."
-- price_and_shopping_is_enhanced: true
-- product_and_usage_is_enhanced: true
```

---

## 📊 Placeholder Mantığı

| Durum | İçerik | AI Placeholder | Sonuç |
|-------|--------|----------------|--------|
| **Tam kategori** | ✅ Var | ✅ Var | AI'nın ürettiği placeholder |
| **Eksik kategori** | ✅ Var | ❌ Yok | Fallback placeholder |
| **Boş kategori** | ❌ Yok | ❌ Yok | Fallback placeholder |

### Fallback Placeholder'lar:
```typescript
const fallbackPlaceholders = {
  priceAndShopping: 'Ürünün fiyatı, teslimat süreci veya satın alma deneyiminiz hakkında bilgi ekleyin...',
  productAndUsage: 'Ürünün performansı, kullanım deneyimi veya özellikler hakkında bilgi ekleyin...',
};
```

---

## 🎯 Sonuç ve Öğrenilenler

### ✅ Çözülen Sorunlar:
1. ✅ Placeholder alanları artık database'e yazılıyor
2. ✅ isEnhanced alanları artık database'e yazılıyor
3. ✅ AI'dan gelen placeholder'lar kullanılıyor
4. ✅ AI placeholder üretmezse fallback kullanılıyor
5. ✅ null/undefined tip uyuşmazlıkları çözüldü
6. ✅ promptVersion default değeri v2.1'e güncellendi

### 📚 Öğrenilenler:
1. **Katmanlı mimari** sorun tespitini zorlaştırabilir - her katmanı kontrol etmek gerekiyor
2. **Repository pattern** kullanırken, interface ile implementasyon arasındaki tutarsızlıklar kritik
3. **TypeScript** tip güvenliği var ama runtime'da alan eksik olabilir
4. **Debugging stratejisi:** Schema → Database → Service → Repository → tüm akışı takip et

### 🔧 Yapılan Commit'ler:
1. `441fadd` - Interface güncellemeleri ve parser logic düzeltmeleri
2. `c737656` - Repository create metodu düzeltmesi **(Kök sorun çözümü)**

---

## 📝 İlgili Dosyalar

- `src/infrastructure/repositories/ai-experience-split-prisma.repository.ts` (Ana düzeltme)
- `src/infrastructure/ai/gemini.service.ts` (Interface ve parser)
- `src/interfaces/post/post.dto.ts` (DTO interface)
- `src/application/post/post.service.ts` (Service layer)
- `src/application/inventory/inventory.service.ts` (Service layer)
- `prisma/schema.prisma` (Database schema)

---

**Hazırlayan:** AI Assistant  
**Tarih:** 25 Aralık 2025  
**Branch:** `feat/splitExperience`  
**Commit:** `c737656`

