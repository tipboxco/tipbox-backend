# Swagger Endpoint Görünürlük Sorunları ve Çözümler

## Problem
Yeni eklenen endpoint'ler Swagger UI'da görünmüyor.

## Otomatik Çözüm

En kolay yol, hazırladığımız script'i kullanmak:

```bash
./scripts/check-swagger.sh
```

Bu script:
1. Backend container'ının çalışıp çalışmadığını kontrol eder
2. TypeScript dosyalarını derler
3. Container'ı restart eder
4. Swagger endpoint'lerini kontrol eder ve listeler

## Manuel Çözümler

### 1. Tarayıcı Cache'ini Temizleme
Swagger UI tarayıcı cache'ini kullanıyor olabilir. Şunları deneyin:

**Chrome/Edge:**
- `Ctrl + Shift + R` (Windows/Linux) veya `Cmd + Shift + R` (Mac) ile hard refresh yapın
- Veya Developer Tools açın (F12) ve Network tab'ında "Disable cache" işaretleyin

**Firefox:**
- `Ctrl + F5` (Windows/Linux) veya `Cmd + Shift + R` (Mac)
- Veya Developer Tools'da Network tab'ında cache'i devre dışı bırakın

**Safari:**
- `Cmd + Option + R` ile hard refresh
- Veya Developer menüsünden "Empty Caches" seçeneğini kullanın

### 2. Swagger JSON Endpoint'ini Kontrol Etme
Endpoint'lerin Swagger'a kayıtlı olup olmadığını kontrol edin:

```bash
# Tüm endpoint'leri listele
curl http://localhost:3000/api-docs/swagger.json | jq '.paths | keys'

# Auth endpoint'lerini filtrele
curl http://localhost:3000/api-docs/swagger.json | jq '.paths | keys | map(select(contains("auth")))'

# Belirli bir endpoint'i kontrol et
curl http://localhost:3000/api-docs/swagger.json | jq '.paths["/auth/forgot-password"]'
```

### 3. Backend Container'ını Restart Etme
Yeni endpoint'lerden sonra mutlaka container'ı restart edin:

```bash
# TypeScript'i derle
docker-compose exec backend npm run build

# Container'ı restart et
docker-compose restart backend

# Backend'in başlamasını bekle (yaklaşık 10 saniye)
sleep 10

# Swagger JSON'u kontrol et
curl http://localhost:3000/api-docs/swagger.json | jq '.paths | keys'
```

### 4. Swagger Spec Yenileme
Swagger spec artık dinamik olarak her request'te yeniden oluşturuluyor. Bu cache sorunlarını önler.

Swagger JSON endpoint'i artık cache header'ları ile korunuyor:
- `Cache-Control: no-cache, no-store, must-revalidate`
- `Pragma: no-cache`
- `Expires: 0`

Bu sayede tarayıcı her zaman fresh spec alır.

## Yeni Endpoint Eklerken İzlenecek Adımlar

1. **Endpoint'i route dosyasına ekleyin:**
   ```typescript
   /**
    * @openapi
    * /auth/new-endpoint:
    *   post:
    *     summary: Yeni endpoint
    *     ...
    */
   router.post('/new-endpoint', ...);
   ```

2. **TypeScript'i derleyin:**
   ```bash
   docker-compose exec backend npm run build
   ```

3. **Container'ı restart edin:**
   ```bash
   docker-compose restart backend
   ```

4. **Swagger JSON'u kontrol edin:**
   ```bash
   curl http://localhost:3000/api-docs/swagger.json | jq '.paths | keys'
   ```

5. **Tarayıcıyı hard refresh yapın:**
   - `Ctrl + Shift + R` veya `Cmd + Shift + R`

## Sorun Devam Ediyorsa

1. **Browser console'u kontrol edin:**
   - F12 tuşuna basın
   - Console tab'ına gidin
   - Swagger ile ilgili hataları kontrol edin

2. **Network tab'ını kontrol edin:**
   - F12 → Network tab
   - Swagger JSON'un başarıyla yüklendiğini kontrol edin
   - 200 status code alındığından emin olun

3. **Backend log'larını kontrol edin:**
   ```bash
   docker-compose logs backend | tail -50
   ```

4. **Swagger JSDoc yorumlarını kontrol edin:**
   - `@openapi` yerine `@swagger` kullanmadığınızdan emin olun
   - Yorum formatının doğru olduğundan emin olun
   - Indentation'ın doğru olduğundan emin olun

## Notlar

- Swagger artık `dist/interfaces/**/*.js` dosyalarını öncelikli olarak okur (Docker için)
- Swagger spec her request'te dinamik olarak oluşturulur (cache sorunlarını önlemek için)
- Tüm endpoint'ler Swagger UI'da görünür olmalıdır
- Swagger JSON endpoint'i cache bypass header'ları ile korunuyor

## Hızlı Kontrol

Endpoint'in Swagger'da görünüp görünmediğini hızlıca kontrol etmek için:

```bash
curl -s http://localhost:3000/api-docs/swagger.json | jq '.paths | has("/auth/forgot-password")'
```

`true` dönerse endpoint Swagger'a kayıtlı demektir.


