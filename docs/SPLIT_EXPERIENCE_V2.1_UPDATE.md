# Split Experience v2.1 - İçerik Standartlaştırma ve Dinamik Placeholder

**Tarih:** 25 Aralık 2025  
**Prompt Version:** v2.1  
**Önceki Versiyon:** v2.0

## 🎯 Yeni Özellikler

### 1. İçerik Standartlaştırma ve İyileştirme

AI artık kısa, özensiz veya yarım metinleri kategorinin standartlarına göre iyileştiriyor:

**Önceki Davranış (v2.0):**
```json
{
  "priceAndShopping": {
    "content": "Çok pahalı buldum, 18.000 TL verdim.",  // Olduğu gibi
    "rating": 2
  }
}
```

**Yeni Davranış (v2.1):**
```json
{
  "priceAndShopping": {
    "content": "Ürünü 18.000 TL'ye satın aldım ve fiyatını oldukça yüksek buldum.",
    "rating": 2,
    "placeholder": "Teslimat süreci, ödeme seçenekleri veya satıcı deneyiminiz hakkında da bilgi ekleyin...",
    "isEnhanced": true  // YENİ
  }
}
```

### 2. Dinamik Placeholder Üretimi

AI artık kategorinin eksik kısımlarına göre özel placeholder metinleri üretiyor:

**Senaryolar:**

| Durum | Placeholder Tipi | Örnek |
|-------|-----------------|--------|
| Kategori tamamen boş | Static fallback | "Ürünün fiyatı, teslimat süreci hakkında bilgi ekleyin..." |
| Fiyat var, teslimat yok | Dinamik AI | "Teslimat sürecinden ve paketleme kalitesinden de bahsedin..." |
| Ürün var, kullanım süresi yok | Dinamik AI | "Ne kadar süredir kullanıyorsunuz? Uzun vadeli performansından bahsedin..." |
| Fiyat var, satıcı yok | Dinamik AI | "Nereden satın aldınız? Satıcı deneyiminiz nasıldı?" |

## 📝 Yapılan Değişiklikler

### 1. Interface Güncellemeleri

```typescript
export interface ExperienceCategory {
  content: string;
  rating: number;
  placeholder?: string;
  isEnhanced?: boolean;  // ✨ YENİ - AI tarafından iyileştirildi mi?
}
```

### 2. Prompt Güncellemeleri

#### Eklenen Kurallar:

**İçerik Standartlaştırma:**
```
- Kısa ve öz metinleri, kategorinin standardına göre daha anlamlı ve düzgün cümleler haline getir
- Argo, kaba veya özensiz ifadeleri düzelt
- Türkçe dilbilgisi ve yazım kurallarına uy
- Metni profesyonel ama samimi bir tonda yeniden ifade et
- Anlamı koruyarak eksik bağlamları tamamla
```

**Dinamik Placeholder Oluşturma:**
```
- Eğer bir kategori için bilgi YOKSA, o kategoriyi null yap
- Eğer bir kategori için bilgi VAR AMA EKSİKSE, dinamik bir placeholder üret
- Placeholder, kullanıcıyı o kategorinin eksik kısımlarını doldurmaya yönlendirmeli
```

### 3. Parser Güncellemeleri

**İki Seviyeli Placeholder Sistemi:**

1. **Static Fallback** (Kategori tamamen null):
```typescript
{
  content: '',
  rating: 0,
  placeholder: 'Ürünün fiyatı, teslimat süreci veya satın alma deneyiminiz hakkında bilgi ekleyin...',
  isEnhanced: false
}
```

2. **Dinamik AI Placeholder** (Kategori var ama eksik):
```typescript
{
  content: 'Ürünü 18.000 TL\'ye satın aldım...',
  rating: 2,
  placeholder: 'Teslimat sürecinden ve paketleme kalitesinden de bahsedin...',  // AI üretir
  isEnhanced: true
}
```

## 🔄 Kullanım Örnekleri

### Örnek 1: Kısa Fiyat Metni

**Girdi:**
```
"Çok pahalı buldum, 18.000 TL verdim."
```

**Çıktı:**
```json
{
  "priceAndShopping": {
    "content": "Ürünü 18.000 TL'ye satın aldım ve fiyatını oldukça yüksek buldum.",
    "rating": 2,
    "placeholder": "Teslimat süreci, ödeme seçenekleri veya satıcı deneyiminiz hakkında da bilgi ekleyin...",
    "isEnhanced": true
  },
  "productAndUsage": {
    "content": "",
    "rating": 0,
    "placeholder": "Ürünün performansı, kullanım deneyimi veya özellikler hakkında bilgi ekleyin...",
    "isEnhanced": false
  }
}
```

### Örnek 2: Argo/Özensiz İfade

**Girdi:**
```
"abi çok bozuk çıktı ya, para verdim boşuna"
```

**Çıktı:**
```json
{
  "priceAndShopping": {
    "content": "Para ödediğime değmediğini düşünüyorum, ürün beklentilerimi karşılamadı.",
    "rating": 1,
    "placeholder": "Satın alma süreci ve teslimat deneyiminizden de bahsedin...",
    "isEnhanced": true
  },
  "productAndUsage": {
    "content": "Ürün bozuk çıktı ve kullanım kalitesi oldukça düşük.",
    "rating": 1,
    "placeholder": "Hangi özelliklerde sorun yaşadınız? Detaylı anlatın...",
    "isEnhanced": true
  }
}
```

### Örnek 3: Noktalama/Yazım Hatası

**Girdi:**
```
"çok güzel ürün fiyatı da uygun teslimat hızlıydı ürünü kullanırken çok memnun kaldım"
```

**Çıktı:**
```json
{
  "priceAndShopping": {
    "content": "Ürünün fiyatını uygun buldum ve teslimat süreci oldukça hızlı gerçekleşti.",
    "rating": 5,
    "isEnhanced": true
  },
  "productAndUsage": {
    "content": "Ürünü kullanırken çok memnun kaldım, performansı beklentilerimi karşıladı.",
    "rating": 5,
    "placeholder": "Ürünün hangi özelliklerinden memnun kaldınız? Detaylandırın...",
    "isEnhanced": true
  }
}
```

### Örnek 4: Sadece Teslimat

**Girdi:**
```
"Kargo çok hızlıydı, 2 günde geldi."
```

**Çıktı:**
```json
{
  "priceAndShopping": {
    "content": "Ürünün teslimatı oldukça hızlıydı, sipariş verdikten sadece 2 gün sonra elime ulaştı.",
    "rating": 5,
    "placeholder": "Ürünün fiyatından, satın alma sürecinden veya paketleme kalitesinden de bahsedin...",
    "isEnhanced": true
  },
  "productAndUsage": {
    "content": "",
    "rating": 0,
    "placeholder": "Ürünün performansı, kullanım deneyimi veya özellikler hakkında bilgi ekleyin...",
    "isEnhanced": false
  }
}
```

## 🎨 Frontend Entegrasyonu

### İyileştirilmiş İçerik Gösterimi

```typescript
interface ExperienceCategoryProps {
  category: ExperienceCategory | null;
  title: string;
}

const ExperienceCategoryCard: React.FC<ExperienceCategoryProps> = ({ category, title }) => {
  if (!category) return null;

  return (
    <div className="category-card">
      <h3>{title}</h3>
      
      {/* İçerik varsa */}
      {category.content ? (
        <div className="content">
          <p>{category.content}</p>
          
          {/* İyileştirilmiş işareti */}
          {category.isEnhanced && (
            <span className="badge">✨ AI Tarafından İyileştirildi</span>
          )}
          
          <div className="rating">
            {'⭐'.repeat(category.rating)}
          </div>
          
          {/* Dinamik placeholder varsa göster */}
          {category.placeholder && (
            <div className="suggestion">
              <span className="icon">💡</span>
              <p className="text-gray-600 italic">{category.placeholder}</p>
            </div>
          )}
        </div>
      ) : (
        /* İçerik yoksa fallback placeholder */
        <div className="empty-state">
          <p className="text-gray-400 italic">{category.placeholder}</p>
          <button onClick={handleAddContent}>+ Deneyim Ekle</button>
        </div>
      )}
    </div>
  );
};
```

### UI Gösterimi

**İyileştirilmiş İçerik:**
```
┌─────────────────────────────────────────┐
│ Fiyat ve Alışveriş Deneyimi             │
├─────────────────────────────────────────┤
│ Ürünü 18.000 TL'ye satın aldım ve       │
│ fiyatını oldukça yüksek buldum.         │
│                                          │
│ [✨ AI Tarafından İyileştirildi]         │
│ ⭐⭐                                      │
│                                          │
│ 💡 Teslimat sürecinden ve paketleme     │
│    kalitesinden de bahsedin...          │
└─────────────────────────────────────────┘
```

**Boş Kategori:**
```
┌─────────────────────────────────────────┐
│ Ürün ve Kullanım Deneyimi               │
├─────────────────────────────────────────┤
│ Ürünün performansı, kullanım deneyimi   │
│ veya özellikler hakkında bilgi ekleyin..│
│                                          │
│ [+ Deneyim Ekle]                        │
└─────────────────────────────────────────┘
```

## 📊 İyileştirme Tipleri

### 1. Dilbilgisi ve Noktalama
- Eksik noktalama işaretlerini ekler
- Cümle yapılarını düzeltir
- Büyük/küçük harf kullanımını standardize eder

### 2. Ton ve Üslup
- Argo ifadeleri temizler
- Kaba veya özensiz dili yumuşatır
- Profesyonel ama samimi ton yakalar

### 3. Bağlam Tamamlama
- Kısa metinleri anlamlı hale getirir
- Eksik bağlamları tamamlar
- Kategori standardına uygun format kullanır

### 4. Yapılandırma
- Uzun, noktalama olmayan metinleri cümlelere böler
- Her kategoriye uygun anlatım biçimi kullanır

## 🔍 Placeholder Stratejisi

### Dinamik Placeholder Mantığı

AI, mevcut içeriğe bakarak nelerin eksik olduğunu tespit eder:

**Fiyat Kategorisi:**
- Fiyat var → Teslimat, ödeme, satıcı iste
- Teslimat var → Fiyat, ödeme, satıcı iste
- Satıcı var → Fiyat, teslimat, ödeme iste

**Ürün Kategorisi:**
- Performans var → Kullanım süresi, dayanıklılık iste
- Özellik var → Genel performans, memnuniyet iste
- Genel yorum var → Spesifik özellikler iste

## 📈 Performans

**Token Kullanımı:**
- v2.0: ~200-400 token
- v2.1: ~250-500 token (+%25, iyileştirme nedeniyle)

**İşlem Süresi:**
- Değişmedi: 2-4 saniye

## ✅ Migration v2.0 → v2.1

### Breaking Changes

**YOK** - Geriye tam uyumlu!

### Yeni Alanlar (Opsiyonel)

```typescript
// v2.0
{
  content: string;
  rating: number;
  placeholder?: string;
}

// v2.1
{
  content: string;
  rating: number;
  placeholder?: string;
  isEnhanced?: boolean;  // YENİ (opsiyonel)
}
```

### Frontend Kontrolü

```typescript
// Versiyon kontrolü
if (response.metadata.promptVersion === 'v2.1') {
  // Yeni özellikler kullanılabilir
  if (category.isEnhanced) {
    showEnhancementBadge();
  }
  
  if (category.placeholder) {
    showDynamicSuggestion(category.placeholder);
  }
} else {
  // Eski davranış
  handleV2Response(response);
}
```

## 🧪 Test Senaryoları

### Yeni Test Caseler

1. **Argo/Özensiz İfade:** "abi çok bozuk çıktı ya, para verdim boşuna"
2. **Noktalama/Yazım Hatası:** "çok güzel ürün fiyatı da uygun teslimat hızlıydı"
3. **Kısa Tek Kelime:** "Harika!", "Kötü!", "Mükemmel!"
4. **Eksik Bağlam:** "Pahalı", "İyi değil", "Beğendim"

## 🎯 Kalite Kriterleri

AI'ın ürettiği içerik şunları sağlamalı:

✅ Anlamı korumak  
✅ Türkçe dilbilgisi kurallarına uymak  
✅ Profesyonel ama samimi ton  
✅ Kategori standardına uygun format  
✅ Eksik bilgiler için yönlendirici placeholder  
✅ Kullanıcının amacını yansıtmak  

## 🔗 İlgili Dosyalar

- `src/infrastructure/ai/gemini.service.ts` - Ana servis (v2.1)
- `src/interfaces/post/post.dto.ts` - DTO tanımları
- `test-split-experience.json` - 8 test senaryosu
- `docs/SPLIT_EXPERIENCE_V2_UPDATE.md` - v2.0 dokümantasyonu
- `docs/CHANGELOG_SPLIT_EXPERIENCE_V2.md` - v2.0 changelog

## 🎉 Özet

v2.1 ile:
- ✅ Kısa metinler standartlaştırılıyor
- ✅ Argo ve özensiz dil düzeltiliyor
- ✅ Dinamik placeholder üretimi
- ✅ İyileştirme işareti (`isEnhanced`)
- ✅ Daha iyi kullanıcı deneyimi
- ✅ %100 geriye uyumlu

**Prompt Version:** v2.1  
**Önceki Versiyon:** v2.0  
**Breaking Changes:** Yok  
**Yeni Token Maliyeti:** +%25

