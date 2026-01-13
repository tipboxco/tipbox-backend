# Google Workspace OAuth 2.0 Email Konfigürasyonu

Bu dokümantasyon, Tipbox backend'inin Google Workspace OAuth 2.0 ile Service Account kullanarak email göndermesi için gerekli adımları içerir.

## Avantajlar

- ✅ **IP adresi bağımsız:** Lokal makine ve production sunucusunda aynı şekilde çalışır
- ✅ **Daha güvenli:** Hesap şifresi yerine JSON anahtar dosyası kullanılır
- ✅ **Taşınabilir:** Farklı sunuculara kolayca taşınabilir
- ✅ **Yönetilebilir:** Google Cloud Console'dan merkezi yönetim

## Gereksinimler

- Google Cloud hesabı (Service Account oluşturmak için)
- Google Workspace Admin erişimi (Domain-wide delegation için)

## Bölüm 1: Google Cloud Console (Geliştirici İşlemleri)

### Adım 1: Google Cloud Projesi Oluşturun veya Seçin

1. [Google Cloud Console](https://console.cloud.google.com/)'a gidin
2. Giriş yapın (info@tipbox.co veya ilgili bir Google hesabı ile)
3. Üst menüden yeni bir proje oluşturun veya mevcut bir projeyi seçin (örn: "Tipbox Backend")

### Adım 2: Gmail API'yi Etkinleştirin

1. Oluşturduğunuz projeyi seçin
2. Sol menüden **APIs & Services** > **Enabled APIs & services** bölümüne gidin
3. **+ ENABLE APIS AND SERVICES** butonuna tıklayın
4. Arama kutusuna "Gmail API" yazın ve bulun
5. Gmail API'yi seçin ve **Enable** butonuna tıklayın

### Adım 3: Service Account Oluşturun

1. Sol menüden **IAM & Admin** > **Service Accounts** bölümüne gidin
2. **+ CREATE SERVICE ACCOUNT** butonuna tıklayın
3. Service account detaylarını girin:
   - **Service account name:** `tipbox-mailer` (veya istediğiniz bir isim)
   - **Service account ID:** Otomatik oluşturulur
4. **Create and Continue** butonuna tıklayın
5. Rol seçme ekranını (Adım 2) **Continue** ile geçin (rol gerekmez)
6. Adım 3'ü **Done** ile tamamlayın

### Adım 4: JSON Anahtar Dosyasını İndirin

1. Oluşturduğunuz `tipbox-mailer` service account'unu listede bulun ve üzerine tıklayın
2. Üst sekmelerden **KEYS** sekmesine gidin
3. **ADD KEY** > **Create new key** seçin
4. Key tipi olarak **JSON** seçili kalsın ve **CREATE** butonuna basın
5. Tarayıcınız JSON dosyasını indirecektir (örn: `tipboxbackend-3e2c3d3c0b31.json`)

**ÖNEMLİ:** Bu JSON dosyasını projenizin ana dizinine kopyalayın ve `.gitignore` dosyanıza eklediğinizden emin olun.

### Adım 5: Client ID'yi Kopyalayın (Workspace Admin için)

1. Service Account detay sayfasında **Advanced settings** bölümüne gidin
2. **Client ID** değerini kopyalayın (uzun sayısal değer, email adresi değil)
3. Bu Client ID'yi Workspace Admin'e verin

## Bölüm 2: Google Workspace Admin Console (Admin İşlemleri)

### Adım 1: Domain-Wide Delegation

1. Workspace Admin olarak [admin.google.com](https://admin.google.com) adresine giriş yapın
2. Sol menüden **Security** > **Access and data control** > **API controls** yolunu izleyin
3. **Domain-wide Delegation** panelini bulun ve **Manage Domain-Wide Delegation** butonuna tıklayın

### Adım 2: API İstemcisini Yetkilendirme

1. **Add new** butonuna tıklayın
2. **Client ID:** Bölüm 1 / Adım 5'te kopyaladığınız Client ID'yi yapıştırın
3. **OAuth Scopes (API Kapsamları):** Şu izni tam olarak yapıştırın:
   ```
   https://www.googleapis.com/auth/gmail.send
   ```
   *(Bu, service account'a SADECE e-posta gönderme izni verir)*
4. **Authorize** butonuna tıklayın

**Not:** İznin tüm Google sistemlerine yayılması 15 dakika kadar sürebilir.

## Bölüm 3: Backend Yapılandırması

### Adım 1: Gerekli Paketler (Zaten Yüklü)

Projede zaten yüklü:
- `nodemailer`
- `google-auth-library`

### Adım 2: Environment Variables

`.env` dosyanıza aşağıdaki değişkenleri ekleyin:

```env
# Email (Google Workspace OAuth 2.0) yapılandırması
# JSON dosyasının path'i (absolute veya relative)
GOOGLE_APPLICATION_CREDENTIALS=./tipboxbackend-3e2c3d3c0b31.json
# Service Account'un hangi email adına gönderim yapacağı
EMAIL_USER_TO_IMPERSONATE=info@tipbox.co
# E-postada görünecek "Kimden" adı
EMAIL_FROM_NAME=Tipbox
```

**Not:** 
- `GOOGLE_APPLICATION_CREDENTIALS` için absolute path (`/path/to/file.json`) veya relative path (`./file.json`) kullanabilirsiniz
- Relative path kullanıyorsanız, proje root dizininden başlar

### Adım 3: JSON Dosyasını Projeye Ekleyin

1. İndirdiğiniz JSON dosyasını projenizin ana dizinine kopyalayın
2. Dosya adını `tipboxbackend-3e2c3d3c0b31.json` olarak kullanın (veya kendi dosya adınızı kullanın)
3. `.gitignore` dosyasına JSON dosyasını ekleyin (zaten ekli)

### Adım 4: Test Etme

1. `.env` dosyasının doğru yapılandırıldığından emin olun
2. Backend'i başlatın: `npm run dev`
3. `/auth/signup` endpoint'ine bir POST isteği gönderin:
   ```json
   {
     "email": "test@example.com",
     "password": "TestPassword123!"
   }
   ```
4. Email'inizin gelip gelmediğini kontrol edin

## Sorun Giderme

### "Failed to obtain access token" hatası
- JSON dosyasının path'inin doğru olduğundan emin olun
- JSON dosyasının geçerli olduğundan emin olun
- Gmail API'nin etkinleştirildiğinden emin olun

### "Domain-wide delegation not configured" hatası
- Workspace Admin'in Domain-wide Delegation'ı doğru yapılandırdığından emin olun
- Client ID'nin doğru kopyalandığından emin olun
- OAuth scope'un tam olarak `https://www.googleapis.com/auth/gmail.send` olduğundan emin olun
- 15 dakika bekleyin (izin yayılması zaman alabilir)

### "Email transporter not initialized" hatası
- `GOOGLE_APPLICATION_CREDENTIALS` environment variable'ının doğru ayarlandığından emin olun
- JSON dosyasının okunabilir olduğundan emin olun
- Service Account'un doğru oluşturulduğundan emin olun

### Email gönderilemiyor
- Google Workspace hesabının gönderim limitlerini kontrol edin
- Spam klasörünü kontrol edin
- Log dosyalarını kontrol edin (`logs/` dizini)

## Güvenlik Notları

- ✅ JSON dosyasını **asla** git repository'sine commit etmeyin
- ✅ Production ortamında JSON dosyasını güvenli bir şekilde saklayın (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault, vs.)
- ✅ Service Account'un izinlerini düzenli olarak kontrol edin
- ✅ OAuth scope'ları minimum gerekli izinlerle sınırlayın (`gmail.send` sadece gönderme izni verir)
- ✅ Email gönderim loglarını izleyin ve şüpheli aktiviteleri kontrol edin

## Günlük Limitler

Google Workspace için günlük gönderim limitleri:
- **Gmail (Kişisel):** 500 email/gün
- **Google Workspace (Business):** 2000 email/gün (default), artırılabilir

Daha yüksek limitler için Google Workspace Support ile iletişime geçin.

## Production Deployment

### Heroku

1. JSON dosyasını Heroku Config Vars'a ekleyin (base64 encode edilmiş olarak)
2. Veya JSON içeriğini Heroku Secrets Manager'a ekleyin
3. `GOOGLE_APPLICATION_CREDENTIALS` için absolute path kullanın

### AWS (EC2/Lambda)

1. JSON dosyasını AWS Secrets Manager'a ekleyin
2. Runtime'da Secrets Manager'dan okuyup geçici dosya olarak kaydedin
3. `GOOGLE_APPLICATION_CREDENTIALS` için bu geçici dosyanın path'ini kullanın

### Docker

1. JSON dosyasını Docker image'a COPY etmeyin (güvenlik riski)
2. Docker volume veya secret olarak mount edin
3. `GOOGLE_APPLICATION_CREDENTIALS` için mount edilen path'i kullanın

## İlgili Dokümantasyon

- [Google Cloud Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
- [Gmail API](https://developers.google.com/gmail/api)
- [Domain-wide Delegation](https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority)

