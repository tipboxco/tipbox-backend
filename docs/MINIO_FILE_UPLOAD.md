# MinIO ve File Upload Yapılandırması

Bu doküman, Tipbox Backend projesinde MinIO kullanımı ve file upload yapılandırmasını açıklar.

## 📚 Genel Bakış

### MinIO Nedir?
- **MinIO**: AWS S3-compatible bir object storage çözümüdür
- **Avantajları**: 
  - Ücretsiz ve açık kaynak
  - Docker ile kolay kurulum
  - AWS S3 API'si ile %100 uyumlu
  - Local development için ideal
  - Production'da da kullanılabilir (Hetzner sunucusunda)

### Neden S3-Compatible Kod Yapısı?
- **Kod Tekrar Kullanımı**: Aynı kod hem MinIO hem AWS S3 ile çalışır
- **Gelecek Geçiş**: İleride AWS S3'e geçiş için sadece environment variable'ları değiştirmek yeterli
- **Standart API**: AWS SDK kullanıldığı için industry standard

## 🏗️ Mimari

```
┌─────────────────┐
│   Backend API   │
│  (Express.js)   │
└────────┬────────┘
         │
         │ AWS SDK / S3Client
         │ (S3-Compatible API)
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Local MinIO    │     │ Production      │
│  (Docker)       │     │ MinIO (Hetzner) │
│  Port: 9000     │     │ Port: 9000      │
└─────────────────┘     └─────────────────┘
         │
         │ İleride:
         ▼
┌─────────────────┐
│   AWS S3        │
│  (Sadece ENV    │
│   değişikliği)  │
└─────────────────┘
```

## 🔧 Local Development

### 1. Docker Compose ile MinIO Başlatma

```bash
# MinIO container'ı başlat
docker-compose up -d minio

# MinIO durumunu kontrol et
docker-compose ps minio

# MinIO loglarını kontrol et
docker-compose logs minio
```

### 2. MinIO Console Erişimi

**Local Development:**
- **API Endpoint**: `http://localhost:9000`
- **Web Console**: `http://localhost:9001`
- **Credentials**: 
  - User: `minioadmin` (default)
  - Password: `minioadmin123` (default)

**Not**: Bu credentials'lar sadece development için. Production'da mutlaka değiştirin!

### 3. Bucket Otomatik Oluşturma

Backend başladığında `S3Service` otomatik olarak:
1. `tipbox-media` bucket'ını kontrol eder
2. Yoksa otomatik oluşturur
3. Loglarda durumu gösterir

**Loglar:**
```json
{"message":"S3 bucket mevcut","bucketName":"tipbox-media"}
// veya
{"message":"S3 bucket oluşturuldu","bucketName":"tipbox-media"}
```

### 4. File Upload Testi

**Swagger UI ile Test:**
1. `http://localhost:3000/api-docs` adresine gidin
2. `POST /users/setup-profile` endpoint'ini açın
3. "Try it out" butonuna tıklayın
4. Multipart/form-data olarak:
   - `FullName`: Test User
   - `UserName`: testuser
   - `selectCategories`: `{"userId":"1","selectedCategories":[]}`
   - `Avatar`: Bir resim dosyası seçin (max 5MB)

**cURL ile Test:**
```bash
curl -X POST http://localhost:3000/users/setup-profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "FullName=Test User" \
  -F "UserName=testuser" \
  -F "selectCategories={\"userId\":\"1\",\"selectedCategories\":[]}" \
  -F "Avatar=@/path/to/image.jpg"
```

## 🚀 Production (Hetzner)

### 1. MinIO Yapılandırması

**docker-compose.prod.yml:**
```yaml
minio:
  image: minio/minio:latest
  container_name: tipbox_minio_prod
  restart: always
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: ${MINIO_ROOT_USER}
    MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
  volumes:
    - minio_prod_data:/data
  networks:
    - tipbox_network
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
    interval: 30s
    timeout: 20s
    retries: 3
```

### 2. Environment Variables

```env
# MinIO Configuration
MINIO_ROOT_USER=tipbox_minio_user
MINIO_ROOT_PASSWORD=strong_password_here

# S3-Compatible Configuration (MinIO için)
S3_ENDPOINT=http://minio:9000
S3_BUCKET_NAME=tipbox-media
S3_REGION=eu-central-1
S3_ACCESS_KEY=${MINIO_ROOT_USER}  # MinIO'da aynı
S3_SECRET_KEY=${MINIO_ROOT_PASSWORD}  # MinIO'da aynı
```

### 3. Güvenlik

**Production'da MinIO Console erişimi:**
- Port 9001'i dışarıdan açmayın (sadece internal network)
- SSH port forwarding ile erişim:
  ```bash
  ssh -L 9001:localhost:9001 root@your-server-ip
  # Tarayıcıda: http://localhost:9001
  ```

## 📁 File Upload Yapısı

### Avatar Upload Akışı

```
1. Client → POST /users/setup-profile (multipart/form-data)
   ├─ FullName: string
   ├─ UserName: string
   ├─ selectCategories: JSON string
   └─ Avatar: File (image/jpeg, image/png, etc.)

2. Backend
   ├─ Multer ile dosya alınır (memory storage)
   ├─ Dosya validasyonu (max 5MB, sadece resim)
   └─ S3Service.uploadFile() çağrılır

3. S3Service
   ├─ Bucket kontrolü/oluşturma (otomatik)
   ├─ AWS SDK ile MinIO'ya yükleme
   └─ File URL'i döner

4. Database
   └─ Avatar URL'i UserAvatar tablosuna kaydedilir
```

### Dosya Yolu Formatı

```
profile-pictures/{userId}/{uuid}.{extension}

Örnek:
profile-pictures/10/ad8a0f30-5b1c-4cf6-ab29-b61c234d2273.jpg
```

### Dosya URL'i

```
Development: http://minio:9000/tipbox-media/profile-pictures/10/file.jpg
Production:  http://minio:9000/tipbox-media/profile-pictures/10/file.jpg
             (Backend container içinden erişim)
```

## 🔄 AWS S3'e Geçiş (İleride)

Kod değişikliği **GEREKMEZ**. Sadece environment variable'ları değiştirin:

```env
# AWS S3 için
S3_ENDPOINT=https://s3.eu-central-1.amazonaws.com
S3_BUCKET_NAME=tipbox-media-prod
S3_REGION=eu-central-1
S3_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
S3_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
# MinIO credentials'ları kaldırılabilir
```

**Kod otomatik olarak AWS S3'i kullanacaktır!**

## 🛠️ Troubleshooting

### Bucket Bulunamadı Hatası

```bash
# Backend loglarını kontrol et
docker-compose logs backend | grep bucket

# MinIO Console'dan bucket'ı manuel oluştur
# http://localhost:9001 → Buckets → Create Bucket → tipbox-media
```

### File Upload Hatası

```bash
# Backend loglarını kontrol et
docker-compose logs backend | grep -i "avatar\|upload\|s3"

# MinIO erişimini test et
curl http://localhost:9000/minio/health/live

# Bucket permissions kontrolü
# MinIO Console → Buckets → tipbox-media → Access Policy
```

### MinIO Container Başlamıyor

```bash
# Container durumunu kontrol et
docker-compose ps minio

# Logları kontrol et
docker-compose logs minio

# Volume'ü kontrol et
docker volume ls | grep minio

# Yeniden başlat
docker-compose restart minio
```

## 📝 Checklist

### Local Development
- [ ] MinIO container çalışıyor (`docker-compose ps minio`)
- [ ] MinIO Console erişilebilir (`http://localhost:9001`)
- [ ] Backend başladığında bucket otomatik oluşturuldu
- [ ] File upload testi başarılı

### Production
- [ ] MinIO credentials güçlü şifrelerle değiştirildi
- [ ] MinIO Console port'u dışarıdan kapalı (güvenlik)
- [ ] Bucket otomatik oluşturma çalışıyor
- [ ] File upload testi başarılı
- [ ] Backup stratejisi kuruldu

---

**Not**: Bu yapılandırma hem MinIO hem AWS S3 ile çalışır. Kod değişikliği olmadan geçiş yapılabilir.

