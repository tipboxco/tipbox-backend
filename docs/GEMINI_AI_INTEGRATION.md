# Gemini AI Entegrasyonu

Bu dokümantasyon, Tipbox Backend projesine entegre edilen Gemini AI servisinin kullanımını ve yapısını açıklar.

## Genel Bakış

Gemini AI servisi, kullanıcıların yazdığı deneyim metinlerini otomatik olarak iki kategoriye ayırmak için kullanılır:

1. **Price and Shopping Experience (Fiyat ve Alışveriş Deneyimi)**
   - Ürünün fiyatı, satın alma süreci, teslimat, kargo, ambalaj
   - Ödeme seçenekleri, indirimler, kampanyalar
   - Satıcı deneyimi, müşteri hizmetleri

2. **Product and Usage Experience (Ürün ve Kullanım Deneyimi)**
   - Ürünün performansı, kalitesi, özellikleri
   - Kullanım deneyimi, dayanıklılık
   - Ürünün beklentileri karşılama durumu

## Mimari Yapı

### Clean Architecture Uyumu

Proje Clean Architecture prensiplerine uygun olarak yapılandırılmıştır:

```
src/
├── infrastructure/
│   ├── ai/
│   │   └── gemini.service.ts          # Gemini AI servisi (Singleton)
│   └── config/
│       └── gemini.config.ts           # Gemini yapılandırması
├── application/
│   ├── inventory/
│   │   └── inventory.service.ts       # Inventory iş mantığı
│   └── post/
│       └── post.service.ts            # Post iş mantığı
└── interfaces/
    ├── inventory/
    │   └── inventory.router.ts        # Inventory API endpoint'leri
    └── post/
        └── post.router.ts             # Post API endpoint'leri
```

### Servis Katmanları

1. **Infrastructure Layer (`GeminiService`)**
   - External API entegrasyonu
   - Singleton pattern ile tek instance
   - Error handling ve retry mekanizması
   - Response parsing ve validasyon

2. **Application Layer**
   - `InventoryService.splitExperienceWithAI()`: Inventory için deneyim ayrıştırma
   - `PostService.splitExperience()`: Post için deneyim ayrıştırma

3. **Interface Layer**
   - `POST /inventory/split-experience`: Inventory endpoint
   - `POST /posts/split-experience`: Post endpoint

## Kurulum

### 1. Gemini API Key Alma

#### Free Tier (Sınırlı)
1. [Google AI Studio](https://makersuite.google.com/app/apikey) adresine gidin
2. Yeni bir API key oluşturun
3. API key'i kopyalayın
4. **Limitler:** 15 istek/dakika, 1,500 istek/gün

#### Paid Tier (Önerilen) 🚀
1. [Google Cloud Console](https://console.cloud.google.com/) adresine gidin
2. Yeni bir proje oluşturun veya mevcut projeyi seçin
3. **Billing** menüsüne gidin ve **kredi kartı bilgilerinizi ekleyin**
4. **APIs & Services > Library** > **"Generative Language API"** etkinleştirin
5. **APIs & Services > Credentials** > **"Create Credentials" > "API Key"**
6. Yeni API key'i kopyalayın
7. **Limitler:** 360 istek/dakika, 10,000+ istek/gün

### 2. Environment Variables

`.env` dosyanıza aşağıdaki değişkenleri ekleyin:

```bash
# Gemini AI Configuration
GEMINI_API_KEY=your-gemini-api-key-here
# Free tier: gemini-1.5-flash (15 req/min)
# Paid tier: gemini-1.5-pro (360 req/min) - Önerilen
GEMINI_MODEL=gemini-1.5-pro
GEMINI_MAX_RETRIES=3
GEMINI_TIMEOUT=30000
```

#### Yapılandırma Parametreleri

- `GEMINI_API_KEY`: Gemini API anahtarı (zorunlu)
- `GEMINI_MODEL`: Kullanılacak model
  - Free tier: `gemini-1.5-flash` (15 req/min)
  - **Paid tier: `gemini-1.5-pro` (360 req/min) - Önerilen**
  - Experimental: `gemini-2.0-flash-exp`, `gemini-exp-1206`
- `GEMINI_MAX_RETRIES`: Hata durumunda tekrar deneme sayısı (varsayılan: 3)
- `GEMINI_TIMEOUT`: İstek timeout süresi (ms) (varsayılan: 30000)

### 3. Paket Kurulumu

```bash
npm install @google/generative-ai
```

## API Kullanımı

### Inventory Split Experience

**Endpoint:** `POST /inventory/split-experience`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "productId": "01JFQM5XXXXXXXXXXX",
  "experienceText": "Samsung Galaxy Buds2 Pro'yu resmi Samsung mağazasından 949 TL'ye aldım. Fiyat diğer kablosuz kulaklıklara göre premium ama Dyson'ın kendini konumlandırdığı yerde haklı. Ürün 2 gün içinde elime ulaştı ve kutusundan çıktığında her şey sağlam ve eksiksizdi. Kullanım deneyimi harika, ses kalitesi mükemmel ve pil ömrü çok iyi."
}
```

**Response:**
```json
{
  "priceAndShopping": {
    "content": "Samsung Galaxy Buds2 Pro'yu resmi Samsung mağazasından 949 TL'ye aldım. Fiyat diğer kablosuz kulaklıklara göre premium ama Dyson'ın kendini konumlandırdığı yerde haklı. Ürün 2 gün içinde elime ulaştı ve kutusundan çıktığında her şey sağlam ve eksiksizdi.",
    "rating": 4
  },
  "productAndUsage": {
    "content": "Kullanım deneyimi harika, ses kalitesi mükemmel ve pil ömrü çok iyi.",
    "rating": 5
  }
}
```

### Post Split Experience

**Endpoint:** `POST /posts/split-experience`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "productId": "01JFQM5XXXXXXXXXXX",
  "content": "Ürünü aldığım mağazada çok iyi bir hizmet aldım. Fiyat uygundu ve kargo hızlıydı. Ürün kalitesi de çok iyi, kullanımı kolay ve dayanıklı."
}
```

**Response:**
```json
{
  "experiences": [
    {
      "type": "price_and_shopping",
      "content": "Ürünü aldığım mağazada çok iyi bir hizmet aldım. Fiyat uygundu ve kargo hızlıydı.",
      "rating": 5
    },
    {
      "type": "product_and_usage",
      "content": "Ürün kalitesi de çok iyi, kullanımı kolay ve dayanıklı.",
      "rating": 5
    }
  ]
}
```

## Hata Yönetimi

### Hata Tipleri

1. **ExternalServiceError (503)**
   - Gemini API'ye erişilemiyor
   - API yanıt vermiyor
   - Network hatası

2. **ValidationError (400)**
   - Geçersiz productId
   - Eksik veya çok kısa experienceText/content
   - Geçersiz request formatı

3. **UnauthorizedError (401)**
   - Geçersiz veya eksik authentication token

### Örnek Hata Yanıtı

```json
{
  "message": "AI servisi ile deneyim ayrıştırılamadı",
  "code": "EXTERNAL_SERVICE_ERROR",
  "status": 503
}
```

## Loglama

Tüm AI istekleri ve yanıtları Winston logger ile loglanır:

```typescript
// Başarılı istek
logger.info({
  message: 'Gemini AI deneyim ayrıştırması başarılı',
  productName: 'Samsung Galaxy Buds2 Pro',
  duration: '2345ms',
  hasPriceAndShopping: true,
  hasProductAndUsage: true,
});

// Hata durumu
logger.error({
  message: 'Gemini AI deneyim ayrıştırması hatası',
  productName: 'Samsung Galaxy Buds2 Pro',
  duration: '5000ms',
  error: 'API timeout',
});
```

## Performans ve Optimizasyon

### Response Süreleri

- Ortalama yanıt süresi: 2-4 saniye
- Timeout süresi: 30 saniye (yapılandırılabilir)

### Rate Limiting

Gemini API'nin rate limit'leri:
- Free tier: 60 istek/dakika
- Paid tier: Daha yüksek limitler

### Best Practices

1. **Kısa ve Öz Metinler**: 500-1000 karakter arası metinler en iyi sonucu verir
2. **Türkçe Dil Desteği**: Gemini 2.0 Flash Türkçe'yi iyi destekler
3. **Error Handling**: Her zaman try-catch kullanın
4. **Fallback Mekanizması**: AI yanıt veremezse, tüm metni "product_and_usage" kategorisine koyun

## Test

### Manuel Test

```bash
# Inventory endpoint
curl -X POST http://localhost:3000/inventory/split-experience \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "01JFQM5XXXXXXXXXXX",
    "experienceText": "Test deneyim metni..."
  }'

# Post endpoint
curl -X POST http://localhost:3000/posts/split-experience \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "01JFQM5XXXXXXXXXXX",
    "content": "Test deneyim metni..."
  }'
```

## Güvenlik

1. **API Key Güvenliği**
   - API key'i asla commit etmeyin
   - Environment variables kullanın
   - Production'da secret manager kullanın (AWS Secrets Manager, etc.)

2. **Rate Limiting**
   - API endpoint'lerine rate limiting ekleyin
   - Abuse'i önlemek için monitoring yapın

3. **Input Validation**
   - Her zaman input'ları validate edin
   - XSS ve injection saldırılarına karşı korunun

## Troubleshooting

### API Key Hatası

```
Error: GEMINI_API_KEY ortam değişkeni tanımlanmamış!
```

**Çözüm:** `.env` dosyasına `GEMINI_API_KEY` ekleyin.

### Timeout Hatası

```
Error: AI servisi ile deneyim ayrıştırılamadı
```

**Çözüm:** 
1. `GEMINI_TIMEOUT` değerini artırın
2. Network bağlantısını kontrol edin
3. Gemini API status'unu kontrol edin

### Parse Hatası

```
Error: AI yanıtı işlenemedi
```

**Çözüm:** 
1. Prompt'u kontrol edin
2. Model versiyonunu güncelleyin
3. Log'larda raw response'u inceleyin

## Gelecek Geliştirmeler

1. **Cache Mekanizması**: Aynı metinler için cache kullanımı
2. **Batch Processing**: Birden fazla metni tek seferde işleme
3. **Custom Model Training**: Tipbox'a özel fine-tuned model
4. **Multi-language Support**: İngilizce ve diğer diller için destek
5. **A/B Testing**: Farklı prompt'ların karşılaştırılması

## İletişim

Sorularınız için:
- GitHub Issues
- Slack: #backend-team
- Email: dev@tipbox.co

