# Post Oluşturma Parametre Mapping Dokümantasyonu

Bu dokümantasyon, mobil uygulama ve backend API arasındaki post oluşturma parametrelerinin mapping'lerini açıklar.

## Genel Bakış

Backend'de 6/7 post tipi için endpoint mevcut. Event post'ları için özel endpoint eksik. Bazı parametre uyumsuzlukları mevcut ancak bunlar frontend'de mapping ile çözülebilir.

---

## 1. Free Post (Serbest Gönderi)

### Mobil Ekran
- **Dosya**: `src/features/post/screens/CreatePostScreen.tsx`
- **Hook**: `useCreateFreePost()`

### Backend Endpoint
- **Endpoint**: `POST /posts/free`
- **Service**: `PostService.createFreePost()`

### Parametreler

| Mobil Parametre | Backend Parametre | Tip | Durum |
|----------------|-------------------|-----|-------|
| `contextType` | `contextType` | `ContextType` enum | ✅ Uyumlu |
| `contextId` | `contextId` | `string` | ✅ Uyumlu |
| `description` | `description` | `string` | ✅ Uyumlu |
| `images` | `images` | `string[]` (optional) | ✅ Uyumlu |

### ContextType Enum Değerleri
- `sub_category`
- `product_group`
- `product`

### Örnek Request
```json
{
  "contextType": "product",
  "contextId": "550e8400-e29b-41d4-a716-446655440000",
  "description": "Bu ürün hakkında bir gönderi",
  "images": ["https://example.com/image1.jpg"]
}
```

---

## 2. Tips & Tricks Post (İpucu Gönderisi)

### Mobil Ekran
- **Dosya**: `src/features/post/screens/CreateTipsAndTrickPostScreen.tsx`
- **Parametreler**: `tipsText`, `selectedCategory`, `images`

### Backend Endpoint
- **Endpoint**: `POST /posts/tips-and-tricks`
- **Service**: `PostService.createTipsAndTricksPost()`

### Parametreler

| Mobil Parametre | Backend Parametre | Tip | Durum |
|----------------|-------------------|-----|-------|
| `contextType` | `contextType` | `ContextType` enum | ✅ Uyumlu |
| `contextId` | `contextId` | `string` | ✅ Uyumlu |
| `tipsText` | `description` | `string` | ✅ Uyumlu (isim farklı) |
| `selectedCategory` | `benefitCategory` | Enum | ⚠️ Mapping gerekli |
| `images` | `images` | `string[]` (optional) | ✅ Uyumlu |

### BenefitCategory Mapping

Mobil'de `selectedCategory` muhtemelen bir string ID veya kategori adı olabilir. Backend'de `benefitCategory` enum değerleri:

| Backend Enum | Değer | Açıklama |
|-------------|-------|----------|
| `time_saving` | `time_saving` | Zaman tasarrufu |
| `energy_efficiency` | `energy_efficiency` | Enerji verimliliği |
| `durability` | `durability` | Dayanıklılık |
| `better_result` | `better_result` | Daha iyi sonuç |

### Backend İç Mapping

Backend'de `benefitCategory` → `TipCategory` mapping'i yapılıyor:

```typescript
TIME, ENERGY → TipCategory.USAGE
DURABILITY → TipCategory.CARE
BETTER → TipCategory.OTHER
```

### Önerilen Frontend Mapping

Mobil uygulamada `selectedCategory` değerini backend'in beklediği `benefitCategory` enum değerine dönüştürmek gerekiyor. Eğer mobil'de kategori ID'si kullanılıyorsa, bir mapping tablosu oluşturulmalı.

### Örnek Request
```json
{
  "contextType": "product",
  "contextId": "550e8400-e29b-41d4-a716-446655440000",
  "description": "Bu ürün için harika bir ipucu",
  "benefitCategory": "time_saving",
  "images": ["https://example.com/image1.jpg"]
}
```

---

## 3. Question Post (Soru Gönderisi)

### Mobil Ekran
- **Dosya**: `src/features/post/screens/CreateQuestionPostScreen.tsx`
- **Parametreler**: `questionText`, `selectedBoost`, `images`

### Backend Endpoint
- **Endpoint**: `POST /posts/question`
- **Service**: `PostService.createQuestionPost()`

### Parametreler

| Mobil Parametre | Backend Parametre | Tip | Durum |
|----------------|-------------------|-----|-------|
| `contextType` | `contextType` | `ContextType` enum | ✅ Uyumlu |
| `contextId` | `contextId` | `string` | ✅ Uyumlu |
| `questionText` | `description` | `string` | ✅ Uyumlu (isim farklı) |
| `selectedBoost` | `selectedBoostOptionId` | `string` | ✅ Uyumlu (isim farklı) |
| `images` | `images` | `string[]` (optional) | ✅ Uyumlu |

### Boost Options

Boost option'ları almak için ayrı bir endpoint mevcut:
- **Endpoint**: `GET /posts/boost-options`
- **Response**: `BoostOption[]`

```typescript
interface BoostOption {
  id: string;
  image: string;
  title: string;
  description: string;
  amount: number;
  isPopular: boolean;
}
```

### Örnek Request
```json
{
  "contextType": "product",
  "contextId": "550e8400-e29b-41d4-a716-446655440000",
  "description": "Bu ürün hakkında bir soru",
  "selectedBoostOptionId": "boost-option-id-123",
  "images": ["https://example.com/image1.jpg"]
}
```

---

## 4. Benchmark Post (Comparison Post - Karşılaştırma)

### Mobil Ekran
- **Dosya**: `src/features/post/screens/CreateBenchmarkPostScreen.tsx`
- **Parametreler**: `selectedProduct1`, `selectedProduct2`, `selectedChoice`, `postText`, `images`

### Backend Endpoint
- **Endpoint**: `POST /posts/benchmark`
- **Service**: `PostService.createBenchmarkPost()`

### Parametreler

| Mobil Parametre | Backend Parametre | Tip | Durum |
|----------------|-------------------|-----|-------|
| `contextType` | `contextType` | `ContextType` enum | ✅ Uyumlu |
| `contextId` | `contextId` | `string` | ✅ Uyumlu |
| `postText` | `description` | `string` | ✅ Uyumlu (isim farklı) |
| `selectedProduct1` | `products[0]` | `Product` | ⚠️ Dönüşüm gerekli |
| `selectedProduct2` | `products[1]` | `Product` | ⚠️ Dönüşüm gerekli |
| `selectedChoice` | - | - | ❓ Kullanılmıyor |
| `images` | - | - | ❌ Backend'de desteklenmiyor |

### Product Array Yapısı

Backend'de `products` array formatı:

```typescript
interface Product {
  productId: string;
  isSelected: boolean;
}
```

### Frontend Dönüşüm

Mobil'den backend'e gönderilirken:

```typescript
// Mobil formatı
{
  selectedProduct1: "product-id-1",
  selectedProduct2: "product-id-2",
  selectedChoice: "choice-value"
}

// Backend formatına dönüşüm
{
  products: [
    { productId: "product-id-1", isSelected: true },
    { productId: "product-id-2", isSelected: true }
  ]
}
```

**Not**: Backend sadece ilk 2 seçili ürünü kullanıyor. `selectedChoice` parametresi backend'de kullanılmıyor.

### Örnek Request
```json
{
  "contextType": "product",
  "contextId": "550e8400-e29b-41d4-a716-446655440000",
  "description": "İki ürünü karşılaştırıyorum",
  "products": [
    { "productId": "product-1-id", "isSelected": true },
    { "productId": "product-2-id", "isSelected": true }
  ]
}
```

---

## 5. Update Post (Güncelleme Gönderisi)

### Mobil Ekran
- **Dosya**: `src/features/post/screens/CreateUpdatePostScreen.tsx`
- **Parametreler**: `product`, `description`, `selectedImages`

### Backend Endpoint
- **Endpoint**: `POST /posts/update`
- **Service**: `PostService.createUpdatePost()`

### Parametreler

| Mobil Parametre | Backend Parametre | Tip | Durum |
|----------------|-------------------|-----|-------|
| `contextType` | `contextType` | `ContextType` enum | ✅ Uyumlu |
| `contextId` | `contextId` | `string` | ✅ Uyumlu |
| `description` | `content` | `string` | ✅ Uyumlu (isim farklı) |
| `selectedImages` | `images` | `string[]` (optional) | ✅ Uyumlu (isim farklı) |

### Örnek Request
```json
{
  "contextType": "product",
  "contextId": "550e8400-e29b-41d4-a716-446655440000",
  "content": "Ürün hakkında bir güncelleme",
  "images": ["https://example.com/image1.jpg"]
}
```

---

## 6. Experience Post (Deneyim Paylaşımı)

### Mobil Ekran
- **Dosya**: `src/features/post/screens/CreateExperiencePostScreen.tsx`
- **Parametreler**: `product`, `fromInventory`, `experienceOption`, `selectedProduct`, `step1Duration`, `selectedCondition`, `selectedFrequency`, `experienceText`, `priceRating`, `productRating`, `selectedImages`

### Backend Endpoint
- **Endpoint**: `POST /posts/experience`
- **Service**: `PostService.createExperiencePost()`

### Parametreler

| Mobil Parametre | Backend Parametre | Tip | Durum |
|----------------|-------------------|-----|-------|
| `contextType` | `contextType` | `ContextType` enum | ✅ Uyumlu |
| `contextId` | `contextId` | `string` | ✅ Uyumlu |
| `experienceText` | `content` | `string` | ✅ Uyumlu (isim farklı) |
| `step1Duration` | `selectedDurationId` | `string` | ✅ Uyumlu (isim farklı) |
| `selectedCondition` | `selectedLocationId` | `string` | ⚠️ İsim uyumsuzluğu |
| `selectedFrequency` | `selectedPurposeId` | `string` | ⚠️ İsim uyumsuzluğu |
| `priceRating`, `productRating` | `experience[]` | `Experience[]` | ⚠️ Yapı farklı |
| `selectedImages` | `images` | `string[]` (optional) | ✅ Uyumlu |
| `fromInventory` | - | - | ❌ Kullanılmıyor |
| `experienceOption` | - | - | ❌ Kullanılmıyor |

### Experience Array Yapısı

Backend'de `experience` array formatı:

```typescript
interface Experience {
  type: ExperienceType; // 'price_and_shopping' | 'product_and_usage'
  content: string;
  rating: number; // 1-5
}
```

### Frontend Dönüşüm

Mobil'den backend'e gönderilirken:

```typescript
// Mobil formatı (varsayılan)
{
  priceRating: 4,
  productRating: 5,
  experienceText: "Genel deneyim metni"
}

// Backend formatına dönüşüm
{
  experience: [
    {
      type: "price_and_shopping",
      content: "Fiyat ve alışveriş deneyimi metni",
      rating: 4
    },
    {
      type: "product_and_usage",
      content: "Ürün ve kullanım deneyimi metni",
      rating: 5
    }
  ]
}
```

**Not**: Eğer mobil'de `experienceText` tek bir metin olarak geliyorsa, AI split endpoint'i kullanılabilir:
- **Endpoint**: `POST /posts/split-experience` veya `POST /posts/experience/split`
- Bu endpoint deneyim metnini otomatik olarak iki kategoriye ayırır.

### Experience Options

Experience seçeneklerini almak için:
- **Endpoint**: `GET /posts/experience/options`
- **Response**: 
```typescript
{
  durations: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
  purposes: Array<{ id: string; name: string }>;
}
```

### Experience Status

```typescript
enum ExperienceStatus {
  OWN = 'own',      // Sahip olunan
  TESTED = 'tested' // Test edilen
}
```

### Kullanılmayan Parametreler

Aşağıdaki parametreler mobil'de bekleniyor ancak backend'de kullanılmıyor:
- `fromInventory`: Inventory'den mi geldiği bilgisi
- `experienceOption`: Deneyim seçeneği (muhtemelen duration/location/purpose ile ilgili)

Bu parametrelerin backend'de kullanılıp kullanılmayacağına karar verilmeli.

### Örnek Request
```json
{
  "contextType": "product",
  "contextId": "550e8400-e29b-41d4-a716-446655440000",
  "selectedDurationId": "duration-id-123",
  "selectedLocationId": "location-id-456",
  "selectedPurposeId": "purpose-id-789",
  "content": "Genel deneyim açıklaması",
  "experience": [
    {
      "type": "price_and_shopping",
      "content": "Fiyat uygun, alışveriş deneyimi iyi",
      "rating": 4
    },
    {
      "type": "product_and_usage",
      "content": "Ürün kaliteli, kullanımı kolay",
      "rating": 5
    }
  ],
  "status": "own",
  "images": ["https://example.com/image1.jpg"],
  "experienceSnippetId": "snippet-id-optional"
}
```

---

## 7. Event Post (Event Gönderisi)

### Mobil Ekran
- **Dosya**: `src/features/events/screens/EventCreatePost.tsx`
- **Parametreler**: `eventType`, `product`, `productSource`, `content`, `selectedProduct`, `images`

### Backend Endpoint
- **Endpoint**: ❌ **EKSİK** - Event'e özel post oluşturma endpoint'i yok

### Mevcut Durum

Event post'ları için özel bir endpoint yok. Şu anda:
- Event post'ları event'e katılan kullanıcıların post'larından filtreleniyor
- **Endpoint**: `GET /events/:eventId/posts` (sadece okuma)

### Önerilen Çözüm

#### Seçenek 1: Mevcut Endpoint'lere `eventId` Ekleme (Önerilen)

Tüm post oluşturma endpoint'lerine optional `eventId` parametresi eklenebilir:

```typescript
interface CreatePostRequest {
  // ... mevcut parametreler
  eventId?: string; // Optional event ID
}
```

#### Seçenek 2: Yeni Event Post Endpoint'i

Event'e özel bir endpoint oluşturulabilir:
- **Endpoint**: `POST /events/:eventId/posts`
- Bu endpoint mevcut post endpoint'lerini wrap eder ve event'e bağlantı yapar

### Event Post Parametreleri

Mobil'de beklenen parametreler:
- `eventType`: Event tipi
- `product`: Ürün bilgisi
- `productSource`: Ürün kaynağı
- `content`: Post içeriği
- `selectedProduct`: Seçili ürün
- `images`: Görseller

Bu parametrelerin hangi post tipine (Free, Tips, Question, vb.) dönüştürüleceği belirlenmeli.

### Örnek Request (Önerilen Format)

```json
{
  "eventId": "event-id-123",
  "contextType": "product",
  "contextId": "product-id-456",
  "description": "Event için bir post",
  "images": ["https://example.com/image1.jpg"],
  "postType": "free" // veya "tips", "question", vb.
}
```

---

## Genel Notlar

### Image URL Formatı

Tüm endpoint'lerde `images` parametresi string array olarak bekleniyor. URL'ler muhtemelen MinIO veya başka bir storage servisinden geliyor.

### Context Type Validasyonu

Her post tipi için farklı context type kısıtlamaları var:
- **Free Post**: `sub_category`, `product_group`, `product`
- **Tips & Tricks**: `sub_category`, `product_group`, `product`
- **Question**: `sub_category`, `product_group`, `product`
- **Benchmark**: Sadece `product`
- **Experience**: Sadece `product`
- **Update**: Sadece `product`

### Response Format

Tüm post oluşturma endpoint'leri aynı response formatını döner:

```typescript
{
  id: string; // Oluşturulan post ID'si
}
```

### Hata Durumları

- `400 Bad Request`: Geçersiz parametreler
- `401 Unauthorized`: Kimlik doğrulaması başarısız
- `404 Not Found`: Context (product, category, vb.) bulunamadı

---

## Özet Tablo

| Post Tipi | Endpoint | Durum | Parametre Uyumsuzlukları |
|-----------|----------|-------|--------------------------|
| Free Post | `/posts/free` | ✅ | Yok |
| Tips & Tricks | `/posts/tips-and-tricks` | ✅ | `selectedCategory` → `benefitCategory` mapping |
| Question | `/posts/question` | ✅ | `selectedBoost` → `selectedBoostOptionId` (isim farkı) |
| Benchmark | `/posts/benchmark` | ✅ | `selectedProduct1/2` → `products[]` array dönüşümü, `images` desteklenmiyor |
| Update | `/posts/update` | ✅ | `description` → `content` (isim farkı) |
| Experience | `/posts/experience` | ✅ | Çoklu parametre uyumsuzlukları, bazı parametreler kullanılmıyor |
| Event Post | ❌ | ❌ | Endpoint eksik |

---

## Sonuç

Backend'de 6/7 post tipi için endpoint mevcut. Event post'ları için özel endpoint eksik. Parametre uyumsuzlukları mevcut ancak bunlar frontend'de mapping ile çözülebilir. Backend organizasyonu genel olarak iyi durumda.






