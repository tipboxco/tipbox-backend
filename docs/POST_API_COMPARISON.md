# Post API Endpoint Karşılaştırması: Frontend vs Backend

Bu dokümantasyon, frontend dokümantasyonundaki (`POST_API_SPECIFICATION.md`) beklenen endpoint yapıları ile backend'deki gerçek endpoint yapılarını karşılaştırır.

---

## 1. Free Post

### Frontend Beklentisi
```typescript
{
  contextType: string;      // "sub_category" | "product_group" | "product"
  contextId: string;        // UUID
  description: string;      // Post açıklama metni (zorunlu)
  images?: File[];          // Opsiyonel - Görsel dosyaları (array)
}
```

### Backend Gerçek Yapı
```typescript
{
  contextType: ContextType;  // "sub_category" | "product_group" | "product"
  contextId: string;         // UUID
  description: string;      // Post açıklama metni (zorunlu)
  images?: string[];         // Opsiyonel - Görsel URL'leri (array)
  eventId?: string;         // Opsiyonel - Event ID
}
```

### Durum
✅ **UYUMLU** - Tüm parametreler eşleşiyor. `images` backend'de URL array olarak döner (multipart/form-data ile yüklenir).

---

## 2. Tips & Tricks Post

### Frontend Beklentisi
```typescript
{
  contextType: string;      // "sub_category" | "product_group" | "product"
  contextId: string;        // UUID
  description: string;      // Tips & tricks içeriği (zorunlu)
  images?: File[];          // Opsiyonel - Görsel dosyaları (array)
}
```

### Backend Gerçek Yapı
```typescript
{
  contextType: ContextType;  // "sub_category" | "product_group" | "product"
  contextId: string;         // UUID
  description: string;       // Tips & tricks içeriği (zorunlu)
  benefitCategory: TipsAndTricksBenefitCategory; // ZORUNLU - "time_saving" | "energy_efficiency" | "durability" | "better_result"
  images?: string[];         // Opsiyonel - Görsel URL'leri (array)
  eventId?: string;         // Opsiyonel - Event ID
}
```

### Durum
❌ **UYUMSUZ** - Frontend dokümantasyonunda `benefitCategory` parametresi eksik! Backend'de bu parametre **zorunlu**.

### Düzeltme Gereksinimi
Frontend dokümantasyonuna `benefitCategory` parametresi eklenmeli:
```typescript
{
  contextType: string;
  contextId: string;
  description: string;
  benefitCategory: string;  // "time_saving" | "energy_efficiency" | "durability" | "better_result" (ZORUNLU)
  images?: File[];
}
```

---

## 3. Question Post

### Frontend Beklentisi
```typescript
{
  contextType: string;      // "sub_category" | "product_group" | "product"
  contextId: string;        // UUID
  description: string;      // Soru metni (zorunlu)
  boostAmount?: number;     // Opsiyonel - Boost miktarı
  images?: File[];          // Opsiyonel - Görsel dosyaları (array)
}
```

### Backend Gerçek Yapı
```typescript
{
  contextType: ContextType;  // "sub_category" | "product_group" | "product"
  contextId: string;         // UUID
  description: string;       // Soru metni (zorunlu)
  selectedBoostOptionId: string; // ZORUNLU - Boost option ID (boostAmount değil!)
  images?: string[];         // Opsiyonel - Görsel URL'leri (array)
  eventId?: string;         // Opsiyonel - Event ID
}
```

### Durum
❌ **UYUMSUZ** - Frontend dokümantasyonunda `boostAmount` (number, optional) var, ancak backend'de `selectedBoostOptionId` (string, **zorunlu**) bekleniyor.

### Düzeltme Gereksinimi
Frontend dokümantasyonu güncellenmeli:
```typescript
{
  contextType: string;
  contextId: string;
  description: string;
  selectedBoostOptionId: string;  // ZORUNLU - Boost option ID (boostAmount değil!)
  images?: File[];
}
```

**Not:** Boost option'ları almak için `GET /posts/boost-options` endpoint'i kullanılmalı.

---

## 4. Benchmark Post

### Frontend Beklentisi
```typescript
{
  contextType: string;      // "sub_category" | "product_group" | "product"
  contextId: string;        // UUID
  description: string;      // Karşılaştırma açıklaması (zorunlu)
  comparedProductId: string; // Karşılaştırılan ürün ID'si (zorunlu)
  images?: File[];          // Opsiyonel - Görsel dosyaları (array)
}
```

### Backend Gerçek Yapı
```typescript
{
  contextType: ContextType;  // "sub_category" | "product_group" | "product"
  contextId: string;         // UUID
  description: string;       // Karşılaştırma açıklaması (zorunlu)
  products: Product[];        // ZORUNLU - Ürün array'i (en az 2 ürün)
  images?: string[];         // Opsiyonel - Görsel URL'leri (array)
  eventId?: string;          // Opsiyonel - Event ID
}

// Product interface:
{
  productId: string;
  isSelected: boolean;
}
```

### Durum
❌ **UYUMSUZ** - Frontend dokümantasyonunda `comparedProductId` (tek ürün) var, ancak backend'de `products` (array, en az 2 ürün) bekleniyor.

### Düzeltme Gereksinimi
Frontend dokümantasyonu güncellenmeli:
```typescript
{
  contextType: string;
  contextId: string;
  description: string;
  products: Array<{          // ZORUNLU - En az 2 ürün
    productId: string;
    isSelected: boolean;
  }>;
  images?: File[];
}
```

---

## 5. Update Post

### Frontend Beklentisi
```typescript
{
  contextType: string;      // "sub_category" | "product_group" | "product"
  contextId: string;        // UUID
  description: string;      // Update açıklaması (zorunlu)
  images?: File[];          // Opsiyonel - Görsel dosyaları (array)
}
```

### Backend Gerçek Yapı
```typescript
{
  contextType: ContextType;  // "sub_category" | "product_group" | "product"
  contextId: string;         // UUID
  content: string;            // Update içeriği (zorunlu) - "description" değil, "content"!
  images?: string[];         // Opsiyonel - Görsel URL'leri (array)
  eventId?: string;          // Opsiyonel - Event ID
}
```

### Durum
❌ **UYUMSUZ** - Frontend dokümantasyonunda `description` var, ancak backend'de `content` bekleniyor.

### Düzeltme Gereksinimi
Frontend dokümantasyonu güncellenmeli:
```typescript
{
  contextType: string;
  contextId: string;
  content: string;  // "description" değil, "content"!
  images?: File[];
}
```

---

## 6. Experience Post

### Frontend Beklentisi
```typescript
{
  contextType: string;           // "sub_category" | "product_group" | "product"
  contextId: string;             // UUID
  productId: string;             // Deneyim yapılan ürün ID'si (zorunlu)
  duration: string;               // Deneyim süresi (zorunlu)
  condition: string;              // Ürün durumu (zorunlu)
  frequency: string;             // Kullanım sıklığı (zorunlu)
  experienceText: string;        // Deneyim metni (zorunlu)
  priceExperienceText?: string;  // Opsiyonel - Fiyat deneyimi metni
  productExperienceText?: string; // Opsiyonel - Ürün deneyimi metni
  priceRating: number;           // Fiyat puanı 1-5 (zorunlu)
  productRating: number;          // Ürün puanı 1-5 (zorunlu)
  selectedDuration?: string;      // Opsiyonel - Inventory usage için
  selectedLocation?: string;     // Opsiyonel - Inventory usage için
  selectedPurpose?: string;      // Opsiyonel - Inventory usage için
  images?: File[];               // Opsiyonel - Görsel dosyaları (array)
}
```

### Backend Gerçek Yapı
```typescript
{
  contextType: ContextType;      // "sub_category" | "product_group" | "product"
  contextId: string;              // UUID
  selectedDurationId: string;      // ZORUNLU - Duration ID (string değil, ID!)
  selectedLocationId: string;      // ZORUNLU - Location ID (string değil, ID!)
  selectedPurposeId: string;      // ZORUNLU - Purpose ID (string değil, ID!)
  content: string;                 // ZORUNLU - Deneyim metni ("experienceText" değil, "content"!)
  experience: Experience[];       // ZORUNLU - Experience array
  status: ExperienceStatus;       // ZORUNLU - "own" | "tested"
  images?: string[];              // Opsiyonel - Görsel URL'leri (array)
  experienceSnippetId?: string;   // Opsiyonel - Experience snippet ID
  eventId?: string;               // Opsiyonel - Event ID
}

// Experience interface:
{
  type: ExperienceType;  // "price_and_shopping" | "product_and_usage"
  content: string;
  rating: number;        // 1-5
}
```

### Durum
❌ **BÜYÜK UYUMSUZLUK** - Frontend dokümantasyonundaki parametreler backend'deki yapı ile tamamen farklı!

### Düzeltme Gereksinimi
Frontend dokümantasyonu tamamen güncellenmeli:
```typescript
{
  contextType: string;           // "sub_category" | "product_group" | "product"
  contextId: string;             // UUID
  selectedDurationId: string;     // ZORUNLU - Duration ID (GET /posts/experience/options'dan alınır)
  selectedLocationId: string;    // ZORUNLU - Location ID (GET /posts/experience/options'dan alınır)
  selectedPurposeId: string;      // ZORUNLU - Purpose ID (GET /posts/experience/options'dan alınır)
  content: string;               // ZORUNLU - Deneyim metni
  experience: Array<{            // ZORUNLU - Experience array (en az 1, genelde 2)
    type: "price_and_shopping" | "product_and_usage";
    content: string;
    rating: number;              // 1-5
  }>;
  status: "own" | "tested";      // ZORUNLU - Ürün durumu
  images?: File[];               // Opsiyonel - Görsel dosyaları (array)
  experienceSnippetId?: string;  // Opsiyonel - Experience snippet ID
}
```

**Not:** 
- `productId`, `duration`, `condition`, `frequency`, `experienceText`, `priceExperienceText`, `productExperienceText`, `priceRating`, `productRating` parametreleri backend'de yok!
- `selectedDurationId`, `selectedLocationId`, `selectedPurposeId` değerleri `GET /posts/experience/options` endpoint'inden alınmalı.
- `experience` array'i içinde `type`, `content`, ve `rating` bilgileri gönderilmeli.

---

## 7. Event Post

### Frontend Beklentisi
```typescript
POST /events/{eventId}/posts
{
  description: string;      // Post açıklama metni (zorunlu)
  productId?: string;      // Opsiyonel - Eğer product seçildiyse (UUID)
  images?: File[];         // Opsiyonel - Görsel dosyaları (array)
}
```

### Backend Gerçek Yapı
❌ **ENDPOINT YOK** - Backend'de `/events/{eventId}/posts` endpoint'i mevcut değil!

### Durum
❌ **ENDPOINT EKSİK** - Event post'ları için özel endpoint yok. Bunun yerine, diğer post endpoint'lerine `eventId` parametresi eklenerek event'e bağlanıyor.

### Mevcut Çözüm
Event post'ları oluşturmak için:
1. Normal post endpoint'lerini kullan (`/posts/free`, `/posts/tips-and-tricks`, vb.)
2. `eventId` parametresini request body'ye ekle
3. Post otomatik olarak event'e bağlanır

---

## Özet Tablo

| Post Tipi | Endpoint | Frontend-Backend Uyumu | Kritik Sorunlar |
|-----------|----------|------------------------|-----------------|
| Free Post | `/posts/free` | ✅ Uyumlu | Yok |
| Tips & Tricks | `/posts/tips-and-tricks` | ❌ Uyumsuz | `benefitCategory` eksik (zorunlu) |
| Question | `/posts/question` | ❌ Uyumsuz | `boostAmount` yerine `selectedBoostOptionId` (zorunlu) |
| Benchmark | `/posts/benchmark` | ❌ Uyumsuz | `comparedProductId` yerine `products[]` array |
| Update | `/posts/update` | ❌ Uyumsuz | `description` yerine `content` |
| Experience | `/posts/experience` | ❌ Büyük Uyumsuzluk | Tüm parametre yapısı farklı |
| Event Post | `/events/{eventId}/posts` | ❌ Endpoint Yok | Endpoint mevcut değil, `eventId` parametresi kullanılmalı |

---

## Önerilen Düzeltmeler

1. **Tips & Tricks**: `benefitCategory` parametresi eklenmeli (zorunlu)
2. **Question**: `boostAmount` yerine `selectedBoostOptionId` kullanılmalı (zorunlu)
3. **Benchmark**: `comparedProductId` yerine `products[]` array kullanılmalı
4. **Update**: `description` yerine `content` kullanılmalı
5. **Experience**: Tüm parametre yapısı yeniden yazılmalı
6. **Event Post**: Endpoint oluşturulmalı veya mevcut endpoint'lerde `eventId` kullanımı dokümante edilmeli

---

## Ek Endpoint'ler

Backend'de mevcut olan ancak frontend dokümantasyonunda olmayan endpoint'ler:

1. `GET /posts/boost-options` - Boost option listesini getirir (Question post için)
2. `GET /posts/experience/options` - Experience seçeneklerini getirir (Duration, Location, Purpose)
3. `POST /posts/experience/split` - Deneyimi AI ile ayırır
4. `POST /posts/split-experience` - Deneyim metnini AI ile kategorilere ayırır
5. `GET /posts/update/reviews/{productId}` - Ürün için review bilgilerini getirir

Bu endpoint'ler frontend dokümantasyonuna eklenmeli.


