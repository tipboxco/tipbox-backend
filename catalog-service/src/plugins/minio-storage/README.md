# MinIO Storage Plugin

Bu plugin, Medusa.js uygulamanızda media dosyalarını MinIO sunucusuna yüklemek için kullanılır.

## Kurulum

1. MinIO client paketi zaten `package.json`'a eklenmiştir. Paketleri yüklemek için:

```bash
npm install
```

## Yapılandırma

`.env` dosyanıza aşağıdaki değişkenleri ekleyin:

```env
MINIO_ENDPOINT=localhost:9000
MINIO_BUCKET=medusa
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
MINIO_USE_SSL=false
MINIO_REGION=us-east-1
```

### Ortam Değişkenleri

- `MINIO_ENDPOINT`: MinIO sunucunuzun endpoint'i (örn: `localhost:9000` veya `https://minio.example.com`)
- `MINIO_BUCKET`: Dosyaların yükleneceği bucket adı
- `MINIO_ACCESS_KEY`: MinIO erişim anahtarı
- `MINIO_SECRET_KEY`: MinIO gizli anahtarı
- `MINIO_USE_SSL`: SSL kullanılıp kullanılmayacağı (`true` veya `false`)
- `MINIO_REGION`: MinIO bölgesi (opsiyonel)

## Kullanım

Plugin otomatik olarak `medusa-config.ts`'de kayıtlıdır. Media dosyaları yüklendiğinde otomatik olarak MinIO'ya yüklenir.

### API Endpoints

- `GET /admin/media` - Tüm media dosyalarını listele
- `POST /admin/media` - Yeni bir media dosyası yükle
- `DELETE /admin/media/:id` - Bir media dosyasını sil

### Örnek Kullanım

```typescript
import { MinioStorageService } from "./plugins/minio-storage/service"

const minioService = new MinioStorageService({
  endpoint: process.env.MINIO_ENDPOINT!,
  bucket: process.env.MINIO_BUCKET!,
  accessKeyId: process.env.MINIO_ACCESS_KEY!,
  secretAccessKey: process.env.MINIO_SECRET_KEY!,
})

// Dosya yükle
const buffer = Buffer.from("...")
const { url, key } = await minioService.uploadFile(buffer, "image.jpg", "image/jpeg")

// Dosya sil
await minioService.deleteFile(key)

// Dosyaları listele
const files = await minioService.listFiles("media/")
```

## Özellikler

- ✅ Otomatik bucket oluşturma
- ✅ Presigned URL desteği (7 gün geçerli)
- ✅ Public URL fallback desteği
- ✅ Dosya listeleme
- ✅ Dosya silme
- ✅ Güvenli dosya yolu kontrolü

## Notlar

- Bucket yoksa otomatik olarak oluşturulur
- Dosyalar `media/` prefix'i ile yüklenir
- Presigned URL'ler 7 gün geçerlidir
- Bucket public ise direkt URL kullanılabilir

