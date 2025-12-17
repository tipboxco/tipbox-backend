import { s3Config } from './s3.config';

/**
 * Ortak public media base URL
 * - Tüm görsel URL'leri için TEK kontrol noktası
 * - Seed ve runtime aynı env önceliğini kullanır
 *
 * Öncelik sırası:
 * 1) SEED_MEDIA_BASE_URL    -> Seed & frontend için önerilen tek base URL
 * 2) MINIO_PUBLIC_ENDPOINT  -> Frontend'in doğrudan eriştiği host
 * 3) S3_ENDPOINT            -> Container içi endpoint (minio:9000 → localhost:9000'a normalize edilir)
 * 4) s3Config.endpoint      -> S3 config'ten gelen endpoint
 * 5) Varsayılan: http://localhost:9000
 */
export function getPublicMediaBaseUrl(): string {
  /**
   * Öncelik sırası:
   * 1) SEED_MEDIA_BASE_URL    -> Seed & frontend için önerilen tek base URL
   * 2) MINIO_PUBLIC_ENDPOINT  -> Frontend'in doğrudan eriştiği host
   * 3) S3_ENDPOINT            -> Container içi endpoint (production'da kullanmayın!)
   * 4) s3Config.endpoint      -> S3 config'ten gelen endpoint
   * 5) Varsayılan: http://localhost:9000
   * 
   * ÖNEMLİ: Production'da SEED_MEDIA_BASE_URL veya MINIO_PUBLIC_ENDPOINT set edilmelidir!
   */
  const hasPublicEndpoint = Boolean(
    process.env.SEED_MEDIA_BASE_URL || 
    process.env.MINIO_PUBLIC_ENDPOINT
  );

  const raw =
    process.env.SEED_MEDIA_BASE_URL ||
    process.env.MINIO_PUBLIC_ENDPOINT ||
    process.env.S3_ENDPOINT ||
    s3Config.endpoint ||
    'http://localhost:9000';

  // Eğer SEED_MEDIA_BASE_URL veya MINIO_PUBLIC_ENDPOINT set edilmişse direkt kullan
  // (Bu production endpoint'i olmalı, değiştirme)
  if (hasPublicEndpoint) {
    return raw.replace(/\/$/, '');
  }

  // Sadece development'ta container içi "minio:9000" adresini localhost'a çevir
  // Production'da bu durum olmamalı (SEED_MEDIA_BASE_URL set edilmeli)
  const normalized = raw.replace('minio:9000', 'localhost:9000');

  // Trailing slash'i temizle
  return normalized.replace(/\/$/, '');
}

/**
 * Verilen relative path için tam media URL üretir.
 * DB'de sadece bucket path tutulur (örn: users/profile/9f2a1c/avatar.jpg)
 * Bu fonksiyon PUBLIC_BASE_URL ile birleştirerek tam URL oluşturur.
 * 
 * Örn: 
 * - Input:  'users/profile/9f2a1c/avatar.jpg'
 * - Output: 'https://api-test.tipbox.co/media/users/profile/9f2a1c/avatar.jpg'
 * 
 * @param relativePath - MinIO bucket path (örn: users/profile/9f2a1c/avatar.jpg)
 * @returns Tam media URL
 */
export function buildMediaUrl(relativePath: string): string {
  // PUBLIC_BASE_URL env değişkeni varsa onu kullan, yoksa getPublicMediaBaseUrl() kullan
  const baseUrl = process.env.PUBLIC_BASE_URL || getPublicMediaBaseUrl();
  const cleanPath = relativePath.replace(/^\/+/, '');
  return `${baseUrl}/media/${cleanPath}`;
}

/**
 * Database'deki media URL'ini production endpoint'ine dönüştürür.
 * 
 * Eğer URL localhost veya minio:9000 içeriyorsa, production endpoint'ine çevirir.
 * Bu sayede frontend her zaman doğru URL'yi alır.
 * 
 * @param dbUrl - Database'den gelen URL (örn: http://localhost:9000/tipbox-media/products/phone5.png)
 * @returns Production endpoint'ine dönüştürülmüş URL
 * 
 * Örnek:
 * - Input:  http://localhost:9000/tipbox-media/products/phone5.png
 * - Output: http://api-test.tipbox.co:9000/tipbox-media/products/phone5.png
 */
export function normalizeMediaUrl(dbUrl: string | null | undefined): string | null {
  if (!dbUrl) return null;

  try {
    const url = new URL(dbUrl);
    const publicBase = getPublicMediaBaseUrl();
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

/**
 * Database'den gelen media path veya URL'ini tam URL'ye çevirir.
 * 
 * Eğer değer zaten bir URL ise (http:// veya https:// ile başlıyorsa), olduğu gibi döndürür.
 * Eğer değer bir path ise (örn: users/profile/9f2a1c/avatar.jpg), buildMediaUrl ile tam URL'ye çevirir.
 * 
 * Bu fonksiyon hem eski URL formatını hem de yeni path formatını destekler.
 * 
 * @param mediaPathOrUrl - Database'den gelen path veya URL
 * @returns Tam media URL veya null
 * 
 * Örnekler:
 * - Input:  'users/profile/9f2a1c/avatar.jpg'
 * - Output: 'https://api-test.tipbox.co/media/users/profile/9f2a1c/avatar.jpg'
 * 
 * - Input:  'https://api-test.tipbox.co/media/users/profile/9f2a1c/avatar.jpg'
 * - Output: 'https://api-test.tipbox.co/media/users/profile/9f2a1c/avatar.jpg'
 */
export function resolveMediaUrl(mediaPathOrUrl: string | null | undefined): string | null {
  if (!mediaPathOrUrl) return null;

  // Eğer zaten bir URL ise (http:// veya https:// ile başlıyorsa), olduğu gibi döndür
  if (mediaPathOrUrl.startsWith('http://') || mediaPathOrUrl.startsWith('https://')) {
    return mediaPathOrUrl;
  }

  // Path ise buildMediaUrl ile tam URL'ye çevir
  return buildMediaUrl(mediaPathOrUrl);
}



















