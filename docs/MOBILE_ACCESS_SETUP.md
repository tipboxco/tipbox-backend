# Mobil Cihazdan Backend'e Erişim Kurulumu

## Sorun
Mobil cihazdan `http://192.168.1.164:3000` adresine erişilemiyor ve 500 hatası alınıyor.

## Çözüm Adımları

### 1. Windows Firewall Ayarları

**Yönetici olarak PowerShell açın** ve şu komutu çalıştırın:

```powershell
netsh advfirewall firewall add rule name="Tipbox Backend Port 3000" dir=in action=allow protocol=TCP localport=3000
```

Veya Windows Firewall GUI üzerinden:
1. Windows Defender Firewall → Advanced Settings
2. Inbound Rules → New Rule
3. Port → TCP → Specific local ports: `3000`
4. Allow the connection
5. Tüm profilleri seçin (Domain, Private, Public)
6. İsim: "Tipbox Backend Port 3000"

### 2. Mobil Cihazın Network Kontrolü

**Önemli:** Mobil cihazın **aynı WiFi network'ünde** olduğundan emin olun.

- Bilgisayarınızın IP'si: `192.168.1.164`
- Mobil cihazınızın IP'si de `192.168.1.x` formatında olmalı
- Mobil cihaz mobil data kullanıyorsa erişemez!

Mobil cihazın IP'sini kontrol etmek için:
- **Android:** Settings → About phone → Status → IP address
- **iOS:** Settings → WiFi → (Bağlı WiFi'ye tıklayın) → IP Address

### 3. Backend Erişim Testi

Mobil cihazdan tarayıcıda test edin:
```
http://192.168.1.164:3000/api
```

Başarılı response:
```json
{
  "message": "Tipbox Backend API çalışıyor!",
  "swagger": "http://localhost:3000/api-docs",
  "version": "1.0.0"
}
```

### 4. CORS Ayarları

Backend development modunda çalışıyorsa, CORS ayarları otomatik olarak local network IP'lerini kabul eder:
- `http://192.168.*.*` (tüm 192.168.x.x IP'leri)
- `http://10.*.*.*` (tüm 10.x.x.x IP'leri)
- `http://172.16-31.*.*` (172.16-31.x.x IP'leri)

### 5. Mobil Uygulama İçin Base URL

Mobil uygulamanızda base URL'i şu şekilde ayarlayın:

```typescript
// Development
const API_BASE_URL = 'http://192.168.1.164:3000';

// Production
const API_BASE_URL = 'https://api.tipbox.co';
```

### 6. Hata Ayıklama

Eğer hala 500 hatası alıyorsanız:

1. **Backend loglarını kontrol edin:**
```bash
docker logs tipbox_backend --tail 100
```

2. **Mobil cihazdan ping testi:**
```bash
# Mobil cihazdan terminal/command prompt
ping 192.168.1.164
```

3. **Port erişilebilirliğini test edin:**
```bash
# Bilgisayarınızdan
netstat -ano | findstr :3000
```

4. **Docker container'ın port mapping'ini kontrol edin:**
```bash
docker ps | findstr tipbox_backend
```

Çıktı şöyle olmalı:
```
tipbox_backend   0.0.0.0:3000->3000/tcp
```

### 7. Alternatif Çözümler

#### A. Docker Network Bridge Modu
Eğer Docker bridge network kullanıyorsanız, container'ın host network'üne erişimi olabilir. Kontrol edin:

```bash
docker network inspect tipbox_network
```

#### B. Host Network Modu (Gelişmiş)
Docker Compose'da backend servisini host network modunda çalıştırabilirsiniz:

```yaml
backend:
  network_mode: host
  # ... diğer ayarlar
```

**Not:** Bu modda port mapping (`ports:`) kullanılamaz.

#### C. Ngrok Kullanımı (Test için)
Geçici olarak ngrok kullanarak backend'i internet üzerinden erişilebilir yapabilirsiniz:

```bash
ngrok http 3000
```

Bu size bir public URL verecek (örn: `https://abc123.ngrok.io`), ancak bu sadece test için kullanılmalıdır.

### 8. Mobil Uygulama İçin Örnek Kod

```typescript
// API Client örneği
const apiClient = axios.create({
  baseURL: 'http://192.168.1.164:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Token ekleme
apiClient.interceptors.request.use((config) => {
  const token = getAuthToken(); // Token'ı storage'dan al
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - Hata yönetimi
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token geçersiz, login sayfasına yönlendir
      navigateToLogin();
    }
    return Promise.reject(error);
  }
);
```

### 9. Test Endpoint'leri

Mobil cihazdan test edebileceğiniz endpoint'ler:

```bash
# Health check (Authentication gerekmez)
GET http://192.168.1.164:3000/health

# API info (Authentication gerekmez)
GET http://192.168.1.164:3000/api

# Interactions status (Authentication gerekir)
GET http://192.168.1.164:3000/interactions/posts/:postId/status
Headers: Authorization: Bearer <token>
```

### 10. Yaygın Sorunlar ve Çözümleri

| Sorun | Olası Neden | Çözüm |
|-------|-------------|-------|
| Connection refused | Firewall engelliyor | Port 3000'i firewall'da açın |
| Timeout | Farklı network | Mobil cihazı aynı WiFi'ye bağlayın |
| 500 Internal Server Error | Backend hatası | Backend loglarını kontrol edin |
| CORS error | CORS ayarları | Development modunda otomatik çözülür |
| 401 Unauthorized | Token eksik/geçersiz | Token'ı kontrol edin |

---

**Son Güncelleme:** 29 Aralık 2024

