# Google Workspace SMTP Konfigürasyonu

Bu dokümantasyon, Tipbox backend'inin Google Workspace SMTP kullanarak email göndermesi için gerekli adımları içerir.

## Gereksinimler

- Google Workspace hesabı (info@tipbox.co email adresi)
- Google Workspace Admin erişimi veya en azından info@tipbox.co hesabına erişim

## Adım 1: Google Workspace'de App Password Oluşturma

Google Workspace hesabınız için 2FA (İki Faktörlü Doğrulama) aktif olmalıdır. Eğer aktif değilse:

1. Google Workspace Admin Console'a giriş yapın
2. Güvenlik > 2-Step Verification bölümüne gidin
3. 2FA'yı aktifleştirin

App Password oluşturmak için:

1. Google Hesabınıza giriş yapın: https://myaccount.google.com/
2. Sol menüden **Güvenlik** sekmesine gidin
3. **2 Adımlı Doğrulama** bölümüne gidin ve aktif olduğundan emin olun
4. **App passwords** (Uygulama şifreleri) bölümüne gidin
5. **Select app** (Uygulama seç) dropdown'undan **Mail** seçin
6. **Select device** (Cihaz seç) dropdown'undan **Other (Custom name)** seçin
7. "Tipbox Backend" gibi bir isim verin
8. **Generate** (Oluştur) butonuna tıklayın
9. Oluşturulan 16 haneli şifreyi kopyalayın (örn: `abcd efgh ijkl mnop`)

**ÖNEMLİ:** Bu şifreyi güvenli bir yerde saklayın. Tekrar gösterilmeyecektir.

## Adım 2: Environment Variables Ayarlama

Projenizin `.env` dosyasına aşağıdaki değişkenleri ekleyin:

```env
# Email (Google Workspace SMTP) yapılandırması
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=info@tipbox.co
SMTP_PASSWORD=abcd efgh ijkl mnop
SMTP_FROM_EMAIL=info@tipbox.co
SMTP_FROM_NAME=Tipbox
```

**Not:** `SMTP_PASSWORD` değerine app password'ü **boşluksuz** olarak yazın (örn: `abcdefghijklmnop`)

## Adım 3: Google Workspace Admin Ayarları (Opsiyonel)

Eğer email gönderiminde sorun yaşıyorsanız, Google Workspace Admin Console'dan şu ayarları kontrol edin:

1. **Admin Console** > **Apps** > **Google Workspace** > **Gmail**
2. **Routing** sekmesine gidin
3. **SMTP relay service** ayarlarını kontrol edin
4. Gerekirse, backend sunucunuzun IP adresini whitelist'e ekleyin

## Test Etme

Konfigürasyonu test etmek için:

1. `.env` dosyasının doğru yapılandırıldığından emin olun
2. Backend'i başlatın: `npm run dev`
3. `/auth/signup` endpoint'ine bir POST isteği gönderin
4. Email'inizin gelip gelmediğini kontrol edin

## Sorun Giderme

### "Invalid login credentials" hatası
- App password'ün doğru kopyalandığından emin olun
- Şifredeki boşlukları kaldırın
- `SMTP_USER` değerinin tam email adresi olduğundan emin olun (info@tipbox.co)

### "Connection timeout" hatası
- Firewall ayarlarını kontrol edin
- Port 587'nin açık olduğundan emin olun
- SMTP_HOST değerinin `smtp.gmail.com` olduğundan emin olun

### Email gönderilemiyor
- Google Workspace hesabının gönderim limitlerini kontrol edin
- Spam klasörünü kontrol edin
- SMTP_FROM_EMAIL ve SMTP_USER değerlerinin aynı olduğundan emin olun

## Güvenlik Notları

- App password'ü asla git repository'sine commit etmeyin
- Production ortamında environment variables'ı güvenli bir şekilde saklayın (AWS Secrets Manager, Azure Key Vault, vs.)
- App password'ü periyodik olarak yenileyin
- Email gönderim loglarını izleyin ve şüpheli aktiviteleri kontrol edin

## Günlük Limitler

Google Workspace SMTP için günlük gönderim limitleri:
- **Gmail (Kişisel):** 500 email/gün
- **Google Workspace (Business):** 2000 email/gün (default), artırılabilir

Daha yüksek limitler için Google Workspace Support ile iletişime geçin.

