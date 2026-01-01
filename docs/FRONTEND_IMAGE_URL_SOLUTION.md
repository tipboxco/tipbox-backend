# Frontend'e Görsel URL'lerini Gösterme Çözümü

## 🎯 Sorun

Database'deki PostMedia kayıtlarında görsel URL'leri `http://localhost:9000` formatında. Production'da:
- MinIO sadece `api-test.tipbox.co:9000` adresinde erişilebilir
- Frontend localhost URL'lerine erişemez
- Production MinIO'da sadece 2 klasör var (brands/, event/)

## ✅ Çözüm

### 1. URL Normalizasyon Fonksiyonu

`src/infrastructure/config/media.config.ts` dosyasına `normalizeMediaUrl()` fonksiyonu eklendi:

```typescript
export function normalizeMediaUrl(dbUrl: string | null | undefined): string | null {
  if (!dbUrl) return null;

  try {
    const url = new URL(dbUrl);
    const publicBase = getPublicMediaBaseUrl(); // Environment variable'dan alır
    const publicUrl = new URL(publicBase);

    // Eğer URL zaten production endpoint'ine işaret ediyorsa değiştirme
    if (url.hostname === publicUrl.hostname && url.port === publicUrl.port) {
      return dbUrl;
    }

    // URL'yi production endpoint'ine çevir
    return `${publicBase}${url.pathname}${url.search}${url.hash}`;
  } catch (error) {
    // Geçersiz URL ise olduğu gibi döndür
    return dbUrl;
  }
}
```

### 2. Environment Variable Ayarları

Production'da `.env` dosyasına ekleyin:

```env
# Production MinIO endpoint (frontend'in erişebileceği)
MINIO_PUBLIC_ENDPOINT=http://api-test.tipbox.co:9000

# VEYA

# Seed ve runtime için tek kontrol noktası (önerilen)
SEED_MEDIA_BASE_URL=http://api-test.tipbox.co:9000
```

**Öncelik Sırası:**
1. `SEED_MEDIA_BASE_URL` (önerilen)
2. `MINIO_PUBLIC_ENDPOINT`
3. `S3_ENDPOINT`
4. Varsayılan: `http://localhost:9000`

### 3. Feed Servislerinde Kullanım

PostMedia görsellerini frontend'e gönderirken URL'leri normalize edin:

```typescript
import { normalizeMediaUrl } from '../../infrastructure/config/media.config';

// PostMedia'dan görselleri al
const postMedia = await prisma.postMedia.findMany({
  where: { postId: { in: postIds } },
  orderBy: { orderIndex: 'asc' },
});

// URL'leri normalize et
const images = postMedia.map(media => normalizeMediaUrl(media.mediaUrl)).filter(Boolean);
```

### 4. Örnek Kullanım

**Feed Service'de:**

```typescript
// PostMedia'dan görselleri çek
const postMediaMap = new Map<string, string[]>();
const postMedia = await prisma.postMedia.findMany({
  where: { postId: { in: postIds } },
  orderBy: { orderIndex: 'asc' },
});

for (const media of postMedia) {
  if (!postMediaMap.has(media.postId)) {
    postMediaMap.set(media.postId, []);
  }
  const normalizedUrl = normalizeMediaUrl(media.mediaUrl);
  if (normalizedUrl) {
    postMediaMap.get(media.postId)!.push(normalizedUrl);
  }
}

// Feed item'larında kullan
const images = postMediaMap.get(post.id) || [];
```

## 🔄 Migration Stratejisi

### Seçenek A: Runtime Normalizasyon (Önerilen)

- ✅ Database'deki URL'leri değiştirmeye gerek yok
- ✅ Environment variable ile kontrol
- ✅ Hem local hem production'da çalışır
- ✅ Daha esnek

### Seçenek B: Database URL'lerini Güncelleme

```sql
-- Tüm localhost URL'lerini production endpoint'ine çevir
UPDATE post_media 
SET media_url = REPLACE(media_url, 'http://localhost:9000', 'http://api-test.tipbox.co:9000')
WHERE media_url LIKE 'http://localhost:9000%';
```

**Not:** Bu yaklaşım daha az esnek, environment değiştiğinde tekrar güncelleme gerekir.

## 📋 Yapılacaklar

1. ✅ `normalizeMediaUrl()` fonksiyonu eklendi
2. ⏳ Production `.env` dosyasına `MINIO_PUBLIC_ENDPOINT` eklenmeli
3. ⏳ Feed servislerinde PostMedia kullanımı güncellenmeli
4. ⏳ URL normalizasyonu feed servislerine entegre edilmeli

## 🎯 Sonuç

- Database'deki URL'ler localhost olsa bile
- Production'da `MINIO_PUBLIC_ENDPOINT` set edilirse
- Frontend her zaman doğru URL'yi alacak
- Görseller production MinIO'dan servis edilecek
