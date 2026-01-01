# Split Experience v2.0 - Changelog

**Tarih:** 25 Aralık 2025  
**Prompt Version:** v2.0  
**Breaking Changes:** Minimal (Geriye uyumlu)

## 🎯 Ana Değişiklikler

### Problem
v1.0'da AI, kısa experience metinlerini her iki kategoriye de kopyalıyordu:
```json
// ❌ Eski davranış
{
  "priceAndShopping": { "content": "Çok pahalı buldum...", "rating": 2 },
  "productAndUsage": { "content": "Çok pahalı buldum...", "rating": 2 }  // TEKRAR!
}
```

### Çözüm
v2.0'da AI artık metni doğru kategoriye ayırıyor ve boş kategoriler için placeholder döndürüyor:
```json
// ✅ Yeni davranış
{
  "priceAndShopping": { "content": "Çok pahalı buldum...", "rating": 2 },
  "productAndUsage": { 
    "content": "", 
    "rating": 0, 
    "placeholder": "Ürünün performansı hakkında bilgi ekleyin..." 
  }
}
```

## 📝 Değiştirilen Dosyalar

### 1. `src/infrastructure/ai/gemini.service.ts`
- ✨ `SplitExperienceResponse` interface'ine `placeholder?: string` eklendi
- 🔧 Prompt güncellendi - metni tekrarlama yasağı eklendi
- 🔧 Prompt'a 3 örnek senaryo eklendi
- 🔧 Parser'da boş kategoriler için otomatik placeholder ekleme

### 2. `src/interfaces/post/post.dto.ts`
- ✨ Yeni `ExperienceCategory` interface eklendi
- 🔧 `SplitExperienceResponse` tamamen yeniden yapılandırıldı
- 📚 Swagger dokümantasyonu güncellendi

### 3. `src/interfaces/post/post.router.ts`
- 🐛 Request validation düzeltildi (`userId` ve `productId` zorunlu)

### 4. `src/application/post/post.service.ts`
- 🔧 Response formatı güncellendi (direkt AI sonucunu döndür)
- 📊 Loglama iyileştirildi

### 5. `test-split-experience.json`
- ✨ 6 farklı test senaryosu eklendi

### 6. Dokümantasyon
- 📄 `docs/SPLIT_EXPERIENCE_V2_UPDATE.md` - Detaylı güncelleme dokümantasyonu
- 📄 `docs/CHANGELOG_SPLIT_EXPERIENCE_V2.md` - Bu dosya

## 🔄 API Değişiklikleri

### Request (Değişmedi)
```typescript
POST /posts/experience/split
{
  "productId": "string",
  "content": "string"
}
```

### Response (Güncellendi)

**v1.0:**
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

**v2.0:**
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
  metadata: {               // YENİ
    tokensUsed: number | null;
    processingTimeMs: number;
    model: string;
    promptVersion: string;
  };
}
```

## 📊 Prompt İyileştirmeleri

### Eklenen Kurallar
1. **Tekrarlama Yasağı:** "Aynı metni her iki kategoriye de KOPYALAMA - bu kesinlikle yasak!"
2. **Kategori Netliği:** "Eğer metin sadece bir kategoriye aitse, diğer kategoriyi mutlaka null yap"
3. **Kısa Metinler:** "Eğer metin çok kısa ve belirsizse, metni en uygun kategoriye koy"

### Eklenen Örnekler
- Örnek 1: Sadece fiyat içeren metin
- Örnek 2: Sadece ürün içeren metin
- Örnek 3: Karışık uzun metin

## 🎨 Frontend Kullanımı

### Boş Kategori Kontrolü
```typescript
if (response.priceAndShopping?.content) {
  // İçerik var - göster
  displayContent(response.priceAndShopping.content);
} else if (response.priceAndShopping?.placeholder) {
  // İçerik yok - placeholder göster
  displayPlaceholder(response.priceAndShopping.placeholder);
}
```

### Placeholder Metinleri
- **Price & Shopping:** "Ürünün fiyatı, teslimat süreci veya satın alma deneyiminiz hakkında bilgi ekleyin..."
- **Product & Usage:** "Ürünün performansı, kullanım deneyimi veya özellikler hakkında bilgi ekleyin..."

## 🧪 Test Senaryoları

| Test Case | Girdi | Beklenen |
|-----------|-------|----------|
| Sadece Fiyat | "Çok pahalı buldum, 18.000 TL verdim." | ✅ priceAndShopping dolu, productAndUsage boş+placeholder |
| Sadece Ürün | "Pil ömrü kötü, 15 dakika." | ✅ productAndUsage dolu, priceAndShopping boş+placeholder |
| Karışık | "949 TL'ye aldım. Ürün harika." | ✅ Her iki kategori de ayrı ayrı dolu |
| Çok Kısa | "Harika!" | ✅ AI en uygun kategoriyi seçer |
| Teslimat | "Kargo hızlıydı." | ✅ priceAndShopping dolu |
| Uzun Detaylı | V15s örneği | ✅ Her iki kategori de dolu |

## 🔍 Metadata

Response'da artık AI istatistikleri var:
```json
{
  "metadata": {
    "tokensUsed": 245,
    "processingTimeMs": 2134,
    "model": "gemini-2.5-pro",
    "promptVersion": "v2.0"
  }
}
```

## 📈 Performans

**Değişiklik Yok:**
- ⚡ Ortalama yanıt süresi: 2-4 saniye
- 💰 Token kullanımı: ~200-400 token
- 🚀 Prompt optimizasyonu performansı etkilemez

## ✅ Migration Checklist

- [x] Interface güncellemeleri
- [x] Prompt güncellemeleri
- [x] Parser güncellemeleri
- [x] DTO güncellemeleri
- [x] Swagger dokümantasyonu
- [x] Test senaryoları
- [x] Detaylı dokümantasyon
- [x] Changelog

## 🎉 Sonuç

v2.0 ile:
- ✅ Kısa metinler artık tekrar etmiyor
- ✅ Boş kategoriler için açık ipuçları
- ✅ Daha iyi kullanıcı deneyimi
- ✅ Frontend için placeholder desteği
- ✅ AI metadata bilgileri
- ✅ Geriye uyumlu

## 🔗 İlgili Linkler

- [Detaylı Dokümantasyon](./SPLIT_EXPERIENCE_V2_UPDATE.md)
- [Gemini AI Entegrasyonu](./GEMINI_AI_INTEGRATION.md)
- [Split Experience Özelliği](./SPLIT_EXPERIENCE_FEATURE.md)
- [Test Senaryoları](../test-split-experience.json)

