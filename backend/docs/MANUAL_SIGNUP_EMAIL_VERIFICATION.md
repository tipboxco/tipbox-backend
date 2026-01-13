# Manuel Signup ve Email Doğrulama Sistemi

Bu dokümantasyon, Tipbox backend'inin manuel signup ve email doğrulama sistemi hakkında bilgi içerir.

## Akış

### 1. Signup (Kayıt Olma)

**Endpoint:** `POST /auth/signup`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Kayıt başarılı. Email doğrulama kodu gönderildi."
}
```

**Süreç:**
1. Email ve password alınır
2. Email'in daha önce kayıtlı olup olmadığı kontrol edilir
3. Şifre hash'lenir
4. Kullanıcı oluşturulur (`emailVerified: false`, `status: PENDING_VERIFICATION`)
5. 6 haneli doğrulama kodu oluşturulur
6. Kod veritabanına kaydedilir (10 dakika geçerli)
7. Email gönderilir
8. Response döner

### 2. Email Doğrulama

**Endpoint:** `POST /auth/verify-email`

**Request Body:**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Email doğrulama başarılı"
}
```

**Süreç:**
1. Email ve code alınır
2. Code'un geçerli olup olmadığı kontrol edilir (süresi dolmamış, kullanılmamış)
3. Kullanıcının email'i doğrulanır (`emailVerified: true`, `status: ACTIVE`)
4. Code kullanıldı olarak işaretlenir
5. JWT token oluşturulur ve döner

## Veritabanı Yapısı

### EmailVerificationCode Modeli

```prisma
model EmailVerificationCode {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  email     String
  code      String   @db.VarChar(6)
  isUsed    Boolean  @default(false) @map("is_used")
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, code])
  @@index([email, code])
  @@map("email_verification_codes")
}
```

### User Modeli Güncellemeleri

- `emailVerified: Boolean @default(false)` field'ı eklendi
- `emailVerificationCodes` relation eklendi

## Migration Çalıştırma

Prisma migration'ı çalıştırmak için:

```bash
# Shadow database hatası alıyorsanız:
npx prisma migrate dev --name add_email_verification --skip-generate

# Veya direkt SQL migration oluşturun:
npx prisma migrate dev --create-only --name add_email_verification
```

Migration SQL'i manuel olarak düzenleyip çalıştırabilirsiniz.

## Google Workspace SMTP Konfigürasyonu

Detaylı konfigürasyon için `docs/GOOGLE_WORKSPACE_SMTP_CONFIG.md` dosyasına bakın.

Kısa özet:
1. Google Workspace hesabında App Password oluşturun
2. `.env` dosyasına SMTP ayarlarını ekleyin
3. Backend'i yeniden başlatın

## Environment Variables

Gerekli environment variables:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=info@tipbox.co
SMTP_PASSWORD=your-app-specific-password
SMTP_FROM_EMAIL=info@tipbox.co
SMTP_FROM_NAME=Tipbox
```

## Güvenlik Notları

- Kodlar 10 dakika geçerlidir
- Her kullanıcı için aynı anda sadece bir aktif kod olabilir (yeni kod oluşturulduğunda eski kodlar iptal edilir)
- Kodlar tek kullanımlıktır (kullanıldıktan sonra `isUsed: true` olur)
- Email gönderimi başarısız olursa kullanıcı silinir (rollback)

## Frontend Entegrasyonu

### Signup Akışı

1. Kullanıcı email ve password girer
2. `POST /auth/signup` endpoint'ine istek atılır
3. `success: true` dönerse, email doğrulama ekranına geçilir
4. Kullanıcı email'inden gelen 6 haneli kodu girer
5. `POST /auth/verify-email` endpoint'ine istek atılır
6. `success: true` ve `token` dönerse, token kaydedilir ve profil oluşturma ekranına geçilir

### Hata Durumları

- Email zaten kayıtlı: `409 Conflict` - `{ success: false, message: "Bu email adresi zaten kayıtlı" }`
- Geçersiz kod: `404 Not Found` - `{ success: false, message: "Geçersiz veya süresi dolmuş doğrulama kodu" }`
- Email gönderilemedi: `500 Internal Server Error` - `{ success: false, message: "Email gönderilemedi. Lütfen tekrar deneyin." }`

## API Endpoints Özeti

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/auth/signup` | Kayıt başlatır, email doğrulama kodu gönderir |
| POST | `/auth/verify-email` | Email doğrulama kodu ile email'i doğrular ve token döner |
| POST | `/auth/login` | Mevcut kullanıcı girişi (emailVerified olmalı) |
| GET | `/auth/me` | Giriş yapmış kullanıcının bilgilerini getirir |

## Test Senaryoları

1. **Başarılı Kayıt:**
   - Geçerli email ve password ile signup
   - Email'in gelmesi
   - Kod ile doğrulama
   - Token alma

2. **Email Zaten Kayıtlı:**
   - Mevcut email ile signup
   - 409 error dönmesi

3. **Geçersiz Kod:**
   - Yanlış kod ile doğrulama
   - 404 error dönmesi

4. **Süresi Dolmuş Kod:**
   - 10 dakikadan eski kod ile doğrulama
   - 404 error dönmesi

5. **Email Gönderilemedi:**
   - SMTP konfigürasyonu yanlışken signup
   - Kullanıcının oluşturulmaması (rollback)

