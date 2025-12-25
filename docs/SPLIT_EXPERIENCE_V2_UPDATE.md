# Split Experience v2.0 Güncellemesi

## 📋 Özet

Split Experience özelliği v2.0'a güncellendi. Ana değişiklik: **AI artık kısa metinleri tekrar etmiyor** ve boş kategoriler için **placeholder metinleri** döndürüyor.

## 🎯 Sorun

**Eski Davranış (v1.0):**
```json
// Girdi: "Çok pahalı buldum, 18.000 TL verdim."
{
  "priceAndShopping": {
    "content": "Çok pahalı buldum, 18.000 TL verdim.",
    "rating": 2
  },
  "productAndUsage": {
    "content": "Çok pahalı buldum, 18.000 TL verdim.",  // ❌ TEKRAR!
    "rating": 2
  }
}
```

## ✅ Çözüm

**Yeni Davranış (v2.0):**
```json
// Girdi: "Çok pahalı buldum, 18.000 TL verdim."
{
  "priceAndShopping": {
    "content": "Çok pahalı buldum, 18.000 TL verdim.",
    "rating": 2
  },
  "productAndUsage": {
    "content": "",
    "rating": 0,
    "placeholder": "Ürünün performansı, kullanım deneyimi veya özellikler hakkında bilgi ekleyin..."
  },
  "metadata": {
    "tokensUsed": 245,
    "processingTimeMs": 2134,
    "model": "gemini-2.5-pro",
    "promptVersion": "v2.0"
  }
}
```

## 🔄 Yapılan Değişiklikler

### 1. Interface Güncellemeleri

#### `src/infrastructure/ai/gemini.service.ts`
```typescript
export interface SplitExperienceResponse {
  priceAndShopping: {
    content: string;
    rating: number;
    placeholder?: string;  // ✨ YENİ
  } | null;
  productAndUsage: {
    content: string;
    rating: number;
    placeholder?: string;  // ✨ YENİ
  } | null;
  metadata: {
    tokensUsed: number | null;
    processingTimeMs: number;
    model: string;
    promptVersion: string;
  };
}
```

### 2. Prompt Güncellemeleri

**Yeni Kurallar:**
- ❌ Aynı metni her iki kategoriye de KOPYALAMA yasak
- ✅ Metin sadece bir kategoriye aitse, diğerini `null` yap
- ✅ Kısa ve belirsiz metinler için en uygun kategoriyi seç
- ✅ Net örnekler eklendi

**Prompt Örnekleri:**
```
Örnek 1 - Sadece Fiyat:
Girdi: "Çok pahalı buldum, 18.000 TL verdim."
Çıktı:
{
  "priceAndShopping": {
    "content": "Çok pahalı buldum, 18.000 TL verdim.",
    "rating": 2
  },
  "productAndUsage": null
}
```

### 3. Parser Güncellemeleri

Boş kategoriler için otomatik placeholder ekleme:

```typescript
const placeholders = {
  priceAndShopping: 'Ürünün fiyatı, teslimat süreci veya satın alma deneyiminiz hakkında bilgi ekleyin...',
  productAndUsage: 'Ürünün performansı, kullanım deneyimi veya özellikler hakkında bilgi ekleyin...',
};

// Eğer kategori null ise
result.priceAndShopping = {
  content: '',
  rating: 0,
  placeholder: placeholders.priceAndShopping,
};
```

### 4. DTO Güncellemeleri

#### `src/interfaces/post/post.dto.ts`
```typescript
export interface ExperienceCategory {
  content: string;
  rating: number;
  placeholder?: string;
}

export interface SplitExperienceResponse {
  priceAndShopping: ExperienceCategory | null;
  productAndUsage: ExperienceCategory | null;
  metadata: {
    tokensUsed: number | null;
    processingTimeMs: number;
    model: string;
    promptVersion: string;
  };
}
```

### 5. Swagger Dokümantasyonu
Güncel Swagger şeması:
- `ExperienceCategory` şeması eklendi
- `placeholder` alanı dokümante edildi
- Response örnekleri güncellendi

## 📊 Test Senaryoları

### Test Case 1: Sadece Fiyat
**Girdi:**
```json
{
  "productId": "01JFQM5XZT8VHQN9YKXR2W3E4P",
  "experienceText": "Çok pahalı buldum, 18.000 TL verdim."
}
```

**Beklenen Çıktı:**
```json
{
  "priceAndShopping": {
    "content": "Çok pahalı buldum, 18.000 TL verdim.",
    "rating": 2
  },
  "productAndUsage": {
    "content": "",
    "rating": 0,
    "placeholder": "Ürünün performansı, kullanım deneyimi veya özellikler hakkında bilgi ekleyin..."
  }
}
```

### Test Case 2: Sadece Ürün
**Girdi:**
```json
{
  "productId": "01JFQM5XZT8VHQN9YKXR2W3E4P",
  "experienceText": "Pil ömrü kötü, sadece 15 dakika dayanıyor."
}
```

**Beklenen Çıktı:**
```json
{
  "priceAndShopping": {
    "content": "",
    "rating": 0,
    "placeholder": "Ürünün fiyatı, teslimat süreci veya satın alma deneyiminiz hakkında bilgi ekleyin..."
  },
  "productAndUsage": {
    "content": "Pil ömrü kötü, sadece 15 dakika dayanıyor.",
    "rating": 2
  }
}
```

### Test Case 3: Her İki Kategori
**Girdi:**
```json
{
  "productId": "01JFQM5XZT8VHQN9YKXR2W3E4P",
  "experienceText": "Dyson'dan 949 TL'ye aldım, teslimat hızlıydı. Ürün harika, lazer teknolojisi mükemmel."
}
```

**Beklenen Çıktı:**
```json
{
  "priceAndShopping": {
    "content": "Dyson'dan 949 TL'ye aldım, teslimat hızlıydı.",
    "rating": 5
  },
  "productAndUsage": {
    "content": "Ürün harika, lazer teknolojisi mükemmel.",
    "rating": 5
  }
}
```

## 🎨 Frontend Kullanımı

### Boş Kategori Kontrolü

```typescript
// Response geldiğinde
const response: SplitExperienceResponse = await api.splitExperience(request);

// Price and Shopping alanı
if (response.priceAndShopping?.content) {
  // Veri var, göster
  displayContent(response.priceAndShopping.content);
} else if (response.priceAndShopping?.placeholder) {
  // Veri yok, placeholder göster
  displayPlaceholder(response.priceAndShopping.placeholder);
}

// Product and Usage alanı
if (response.productAndUsage?.content) {
  displayContent(response.productAndUsage.content);
} else if (response.productAndUsage?.placeholder) {
  displayPlaceholder(response.productAndUsage.placeholder);
}
```

### React Örneği

```tsx
interface ExperienceCategoryProps {
  category: ExperienceCategory | null;
  title: string;
}

const ExperienceCategoryCard: React.FC<ExperienceCategoryProps> = ({ category, title }) => {
  if (!category) return null;

  return (
    <div className="category-card">
      <h3>{title}</h3>
      
      {category.content ? (
        <div className="content">
          <p>{category.content}</p>
          <div className="rating">
            {'⭐'.repeat(category.rating)}
          </div>
        </div>
      ) : (
        <div className="placeholder">
          <p className="text-gray-400 italic">{category.placeholder}</p>
          <button onClick={handleAddContent}>+ Deneyim Ekle</button>
        </div>
      )}
    </div>
  );
};
```

## 📝 Migration Notları

### Breaking Changes

**v1.0 Response:**
```typescript
{
  priceAndShopping: {
    content: string;
    rating: number;
  } | null;
  productAndUsage: {
    content: string;
    rating: number;
  } | null;
}
```

**v2.0 Response:**
```typescript
{
  priceAndShopping: {
    content: string;
    rating: number;
    placeholder?: string;  // YENİ
  } | null;
  productAndUsage: {
    content: string;
    rating: number;
    placeholder?: string;  // YENİ
  } | null;
  metadata: {             // YENİ
    tokensUsed: number | null;
    processingTimeMs: number;
    model: string;
    promptVersion: string;
  };
}
```

### Geriye Uyumluluk

✅ Eski frontend kodları çalışmaya devam eder (placeholder optional)
✅ `content` ve `rating` alanları değişmedi
⚠️ `metadata` alanı eklendi (TypeScript tipleri güncellenmelidir)

## 🔍 Prompt Version Kontrolü

Response'daki `metadata.promptVersion` alanından versiyonu kontrol edebilirsiniz:

```typescript
if (response.metadata.promptVersion === 'v2.0') {
  // Yeni versiyon - placeholder desteği var
  handleV2Response(response);
} else {
  // Eski versiyon
  handleV1Response(response);
}
```

## 📈 Performans

**Değişiklik Yok:**
- Ortalama yanıt süresi: 2-4 saniye
- Token kullanımı: ~200-400 token
- Prompt güncellenmesi performansı etkilemez

## 🐛 Bug Fixes

1. ✅ Kısa metinlerin her iki kategoriye de kopyalanması düzeltildi
2. ✅ Boş kategoriler için kullanıcı deneyimi iyileştirildi
3. ✅ AI'ın kategori seçiminde daha net kurallar eklendi

## 🚀 Test Etme

### cURL ile Test

```bash
curl -X POST http://localhost:3000/posts/split-experience \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "01JFQM5XZT8VHQN9YKXR2W3E4P",
    "content": "Çok pahalı buldum, 18.000 TL verdim."
  }'
```

### Beklenen Response

```json
{
  "priceAndShopping": {
    "content": "Çok pahalı buldum, 18.000 TL verdim.",
    "rating": 2
  },
  "productAndUsage": {
    "content": "",
    "rating": 0,
    "placeholder": "Ürünün performansı, kullanım deneyimi veya özellikler hakkında bilgi ekleyin..."
  },
  "metadata": {
    "tokensUsed": 245,
    "processingTimeMs": 2134,
    "model": "gemini-2.5-pro",
    "promptVersion": "v2.0"
  }
}
```

## 📚 İlgili Dosyalar

- `src/infrastructure/ai/gemini.service.ts` - Ana servis
- `src/interfaces/post/post.dto.ts` - DTO tanımları
- `test-split-experience.json` - Test senaryoları
- `docs/GEMINI_AI_INTEGRATION.md` - Genel dokümantasyon

## 🎉 Özet

v2.0 güncellemesi ile:
- ✅ Kısa metinler artık tekrar etmiyor
- ✅ Boş kategoriler için placeholder desteği
- ✅ Daha net AI kuralları
- ✅ Daha iyi kullanıcı deneyimi
- ✅ Frontend için açık ipuçları

**Prompt Version:** v2.0  
**Tarih:** 25 Aralık 2025  
**Breaking Changes:** Minimal (geriye uyumlu)

