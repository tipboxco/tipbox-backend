# Split Experience Feature - Özet

## 🎯 Özellik Özeti

Kullanıcıların yazdığı deneyim metinlerini Gemini AI kullanarak otomatik olarak iki kategoriye ayıran yeni bir özellik geliştirildi:

1. **Price and Shopping Experience** - Fiyat ve alışveriş deneyimi
2. **Product and Usage Experience** - Ürün ve kullanım deneyimi

## 📁 Eklenen Dosyalar

### Infrastructure Layer
- `src/infrastructure/ai/gemini.service.ts` - Gemini AI servisi (Singleton)
- `src/infrastructure/config/gemini.config.ts` - Gemini yapılandırması

### Güncellenen Dosyalar
- `src/application/inventory/inventory.service.ts` - `splitExperienceWithAI()` metodu eklendi
- `src/application/post/post.service.ts` - `splitExperience()` metodu güncellendi (AI entegrasyonu)
- `src/interfaces/inventory/inventory.router.ts` - `POST /inventory/split-experience` endpoint'i
- `src/interfaces/post/post.router.ts` - `POST /posts/split-experience` endpoint'i
- `src/interfaces/post/post.dto.ts` - DTO'lar güncellendi

### Dokümantasyon
- `docs/GEMINI_AI_INTEGRATION.md` - Detaylı entegrasyon dokümantasyonu
- `env.example.txt` - Gemini environment variables eklendi

## 🚀 Hızlı Başlangıç

### 1. Paket Kurulumu
```bash
npm install @google/generative-ai
```

### 2. Environment Variables
`.env` dosyanıza ekleyin:
```bash
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-2.0-flash-exp
GEMINI_MAX_RETRIES=3
GEMINI_TIMEOUT=30000
```

### 3. API Key Alma
[Google AI Studio](https://makersuite.google.com/app/apikey) adresinden ücretsiz API key alın.

## 📡 API Endpoints

### Inventory Split Experience
```bash
POST /inventory/split-experience
Authorization: Bearer <token>

{
  "productId": "01JFQM5XXXXXXXXXXX",
  "experienceText": "Deneyim metni..."
}
```

### Post Split Experience
```bash
POST /posts/split-experience
Authorization: Bearer <token>

{
  "productId": "01JFQM5XXXXXXXXXXX",
  "content": "Deneyim metni..."
}
```

## 🏗️ Mimari

```
Infrastructure Layer (External Services)
    ↓
Application Layer (Business Logic)
    ↓
Interface Layer (API Endpoints)
```

### Clean Architecture Uyumu
- ✅ Singleton pattern ile tek instance
- ✅ Dependency injection
- ✅ Error handling
- ✅ Logging
- ✅ Testable yapı

## 🔄 Kullanım Akışı

### Inventory Flow
1. Kullanıcı deneyim metnini yazar
2. Frontend `/inventory/split-experience` endpoint'ine istek atar
3. Backend Gemini AI'a istek gönderir
4. AI metni kategorilere ayırır ve rating verir
5. Frontend ayrıştırılmış deneyimleri gösterir
6. Kullanıcı onayladığında `/inventory` endpoint'ine POST atar

### Post Flow
1. Kullanıcı deneyim metnini yazar
2. Frontend `/posts/split-experience` endpoint'ine istek atar
3. Backend Gemini AI'a istek gönderir
4. AI metni kategorilere ayırır
5. Frontend ayrıştırılmış deneyimleri gösterir
6. Kullanıcı onayladığında `/posts/experience` endpoint'ine POST atar

## 📊 Response Formatı

```json
{
  "priceAndShopping": {
    "content": "Fiyat ve alışveriş deneyimi metni...",
    "rating": 4
  },
  "productAndUsage": {
    "content": "Ürün ve kullanım deneyimi metni...",
    "rating": 5
  }
}
```

## ⚡ Performans

- **Ortalama Yanıt Süresi**: 2-4 saniye
- **Timeout**: 30 saniye
- **Rate Limit**: 60 istek/dakika (Free tier)

## 🔒 Güvenlik

- API key environment variable olarak saklanır
- Input validation
- Authentication required
- Rate limiting (önerilir)

## 📝 Loglama

Tüm AI istekleri Winston logger ile loglanır:
- İstek detayları
- Yanıt süreleri
- Başarı/hata durumları
- Kategori bilgileri

## 🧪 Test

```bash
# Manuel test
curl -X POST http://localhost:3000/inventory/split-experience \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "01JFQM5XXXXXXXXXXX",
    "experienceText": "Test metni..."
  }'
```

## 📚 Detaylı Dokümantasyon

Daha fazla bilgi için: [GEMINI_AI_INTEGRATION.md](./GEMINI_AI_INTEGRATION.md)

## 🔧 Troubleshooting

### API Key Hatası
```
Error: GEMINI_API_KEY ortam değişkeni tanımlanmamış!
```
**Çözüm**: `.env` dosyasına `GEMINI_API_KEY` ekleyin

### Timeout Hatası
**Çözüm**: `GEMINI_TIMEOUT` değerini artırın veya network bağlantısını kontrol edin

## 🎯 Gelecek Geliştirmeler

- [ ] Cache mekanizması
- [ ] Batch processing
- [ ] Custom model training
- [ ] Multi-language support
- [ ] A/B testing

## 📞 İletişim

Sorularınız için:
- GitHub Issues
- Slack: #backend-team

