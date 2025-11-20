# Tipbox Backend Dokümantasyon Sitesi

Bu klasör, Tipbox Backend projesinin tüm dokümantasyon dosyalarını görüntülemek için bir web arayüzü içerir.

## 📁 Dosya Yapısı

```
project-docs/
├── index.html          # Ana HTML dosyası
├── styles.css          # Stil dosyası (dashboard renkleri ile)
├── app.js              # JavaScript uygulaması (markdown parser, menü, arama)
├── docs-data.json      # İşlenmiş dokümantasyon verileri (otomatik oluşturulur)
├── generate-docs-data.js # Markdown dosyalarını JSON'a çeviren script
└── README.md           # Bu dosya
```

## 🚀 Kullanım

### 1. Dokümantasyon Verilerini Oluştur

İlk kez veya dokümantasyon dosyaları değiştiğinde, JSON verisini yeniden oluşturun:

```bash
cd project-docs
node generate-docs-data.js
```

Bu komut, `../docs/` klasöründeki tüm markdown dosyalarını okuyup `docs-data.json` dosyasını oluşturur.

### 2. Web Sitesini Aç

`index.html` dosyasını bir web tarayıcısında açın:

```bash
# macOS
open index.html

# Linux
xdg-open index.html

# Windows
start index.html
```

**Not:** Bazı tarayıcılar güvenlik nedeniyle local file fetch'e izin vermeyebilir. Bu durumda:

- **Python ile basit server:**
  ```bash
  python3 -m http.server 8000
  ```
  Sonra tarayıcıda `http://localhost:8000` adresine gidin.

- **Node.js ile basit server:**
  ```bash
  npx http-server -p 8000
  ```

## ✨ Özellikler

- 📚 **Kategorize Menü**: Dokümantasyonlar kategorilere göre organize edilmiştir
- 🔍 **Arama**: Dokümantasyon içinde arama yapabilirsiniz
- 📱 **Responsive**: Mobil ve tablet cihazlarda da çalışır
- 🎨 **Dashboard Tasarımı**: Dashboard'daki renk şeması kullanılmıştır
- 📖 **Markdown Desteği**: Tüm markdown özellikleri desteklenir (başlıklar, listeler, kod blokları, tablolar, vb.)

## 🎨 Renk Şeması

Dashboard'dan alınan renkler:
- **Arka Plan**: `#272727`
- **Metin**: `#FAFAFA`
- **Vurgu**: `#D0F205` (yeşil-sarı)
- **İkincil Metin**: `#A3A3A3`
- **Font**: Jura

## 📝 Kategoriler

Dokümantasyonlar şu kategorilere ayrılmıştır:

1. **Kurulum & Yapılandırma**: SETUP_GUIDE, ENVIRONMENT_SETUP, DOCKER_CONTAINER_CONFIG
2. **Deployment**: AUTOMATED_DEPLOYMENT, DEPLOYMENT_QUICK_START, HETZNER_DEPLOYMENT
3. **Geliştirme**: BRANCH_STRATEGY, TEST, SWAGGER_TROUBLESHOOTING, SOCKET_TESTING
4. **Özellikler & Entegrasyonlar**: Socket.IO, Redis/BullMQ, MinIO, Google Workspace, vb.
5. **Veritabanı**: PRISMA_TYPE_HELPER_REFACTOR
6. **İzleme & Loglama**: MONITORING_SETUP
7. **Knowledge Base**: TIPBOX_KNOWLEDGE_BASE, README
8. **Özetler & Analizler**: SESSION_SUMMARY, MARKETPLACE_FIX_SUMMARY, vb.
9. **Changelog**: CHANGELOG_2025_01_XX

## 🔄 Güncelleme

Dokümantasyon dosyaları değiştiğinde:

1. `generate-docs-data.js` script'ini çalıştırın
2. Tarayıcıyı yenileyin (veya cache'i temizleyin)

## 🐛 Sorun Giderme

### Dokümantasyon görünmüyor

- `docs-data.json` dosyasının mevcut olduğundan emin olun
- Tarayıcı konsolunda hata olup olmadığını kontrol edin
- Local file fetch sorunları için bir HTTP server kullanın

### Markdown formatı bozuk görünüyor

- Markdown parser basit bir versiyondur, bazı gelişmiş özellikler desteklenmeyebilir
- Kod blokları ve tablolar düzgün çalışmalıdır

## 📄 Lisans

Bu dokümantasyon sitesi Tipbox Backend projesinin bir parçasıdır.

