# Inbox CLI Kullanım Kılavuzu

Bu dokümantasyon, Omer kullanıcısı ile inbox işlemlerini yapabilmek için oluşturulmuş CLI ve test araçlarını açıklar.

## 📋 İçindekiler

1. [CLI Kullanımı](#cli-kullanımı)
2. [Test Script'leri](#test-scriptleri)
3. [Julia-Havka Thread Silme](#julia-havka-thread-silme)

## 🖥️ CLI Kullanımı

### Başlatma

```bash
npm run test:inbox:cli
```

veya Docker içinde:

```bash
docker-compose exec backend npx ts-node test-inbox-comprehensive.ts
```

### Özellikler

CLI başlatıldığında otomatik olarak:
- Omer kullanıcısı ile giriş yapar
- Julia-Havka thread'ini siler (varsa)

### Menü Seçenekleri

1. **Inbox listesi getir** - Tüm inbox thread'lerini listeler
2. **Message feed getir** - Unified feed'i getirir
3. **Thread oluştur/getir** - Yeni thread oluşturur veya mevcut thread'i getirir
4. **Thread mesajlarını getir** - Belirli bir thread'in mesajlarını getirir
5. **Direkt mesaj gönder** - Direkt mesaj gönderir
6. **Support request listesi** - Tüm support request'leri listeler
7. **Support request oluştur** - Yeni support request oluşturur
8. **Support request accept** - Support request'i kabul eder
9. **Support request reject** - Support request'i reddeder
10. **TIPS gönder** - TIPS mesajı gönderir
11. **Mesaj düzenle** - Mevcut bir mesajı düzenler
12. **Mesaj sil** - Mesajı siler
13. **Reaksiyon ekle** - Mesaja emoji reaksiyonu ekler
14. **Reaksiyonları getir** - Mesajın reaksiyonlarını getirir
15. **Reaksiyon sil** - Reaksiyonu siler
16. **Mesaj ara** - Thread içinde mesaj arar
17. **Medya yükle** - Medya yükleme talimatlarını gösterir
18. **Thread sil** - Thread'i siler
19. **Julia-Havka thread'ini sil** - Julia-Havka thread'ini manuel olarak siler
20. **Tüm endpoint'leri test et** - Tüm GET endpoint'lerini test eder

## 🧪 Test Script'leri

### Basit Test Script'i

Tüm endpoint'leri otomatik test eder:

```bash
npm run test:inbox
```

veya Docker içinde:

```bash
docker-compose exec backend npx ts-node test-inbox-endpoints.ts
```

Bu script:
- Omer kullanıcısı ile giriş yapar
- Tüm GET endpoint'lerini test eder
- Julia kullanıcısını bulur ve POST testleri yapar
- Test sonuçlarını özetler

### Test Edilen Endpoint'ler

- `GET /inbox` - Inbox listesi
- `GET /inbox/feed` - Unified feed
- `GET /inbox/support-requests` - Support request listesi
- `GET /inbox?search=...` - Arama
- `GET /inbox?unreadOnly=true` - Sadece okunmamış
- `GET /inbox?limit=10` - Limit ile
- `GET /inbox/:threadId` - Thread mesajları
- `POST /inbox/threads` - Thread oluştur
- `POST /inbox` - Mesaj gönder
- `POST /inbox/support-requests` - Support request oluştur
- `POST /inbox/tips` - TIPS gönder

## 🗑️ Julia-Havka Thread Silme

### Manuel Silme

```bash
npm run inbox:delete-julia-havka
```

veya Docker içinde:

```bash
docker-compose exec backend npx ts-node scripts/delete-julia-havka-thread.ts
```

Bu script:
- Julia kullanıcısını bulur (ID: `99999999-9999-4999-9999-999999999999`)
- Julia'nın tüm thread'lerini listeler
- Havka ile olan thread'i bulur ve siler
- Cascade ile tüm mesajları da siler

### CLI İçinden Silme

CLI başlatıldığında otomatik olarak Julia-Havka thread'i silinir. Ayrıca menüden seçenek 19 ile manuel olarak da silinebilir.

## 🔧 Yapılandırma

### Environment Variables

CLI ve test script'leri şu environment variable'ları kullanır:

- `BASE_URL` - API base URL (default: `http://localhost:3000`)
- `OMER_EMAIL` - Omer kullanıcı email'i (default: `omer@tipbox.co`)
- `OMER_PASSWORD` - Omer kullanıcı şifresi (default: `password123`)

### Kullanıcı Bilgileri

- **Omer**: `omer@tipbox.co` / `password123`
- **Julia**: ID: `99999999-9999-4999-9999-999999999999` (ozan@tipbox.co)

## 📝 Notlar

- CLI interaktif bir arayüzdür ve her işlemden sonra Enter'a basmanız gerekir
- Kullanıcı arama işlemleri email veya isim ile yapılabilir
- Thread ID'leri UUID formatındadır
- Medya yükleme için form-data gerektiğinden CLI'da henüz implement edilmemiştir (curl veya Postman kullanılabilir)

## 🐛 Sorun Giderme

### Login Hatası

Eğer login başarısız olursa:
1. Backend servisinin çalıştığından emin olun
2. Omer kullanıcısının veritabanında olduğunu kontrol edin
3. Şifrenin doğru olduğunu kontrol edin

### Thread Bulunamadı

Eğer thread bulunamazsa:
1. Thread ID'sinin doğru olduğundan emin olun
2. Kullanıcının thread'e erişim yetkisi olduğunu kontrol edin
3. Thread'in silinmemiş olduğunu kontrol edin

### API Hatası

Eğer API hataları alırsanız:
1. Backend loglarını kontrol edin
2. Endpoint path'lerinin doğru olduğundan emin olun (`/inbox` kullanılıyor, `/messages` değil)
3. Authentication token'ın geçerli olduğunu kontrol edin
