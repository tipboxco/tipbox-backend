import { s3Config } from './s3.config';

/**
 * Ortak public media base URL
 * - Tüm görsel URL'leri için TEK kontrol noktası
 * - Sadece .env dosyasındaki SEED_MEDIA_BASE_URL kullanılır
 * - Başka hiçbir yerde URL yönlendirmesine gerek yok
 */
export function getPublicMediaBaseUrl(): string {
  const baseUrl = process.env.SEED_MEDIA_BASE_URL;
  
  if (!baseUrl) {
    throw new Error(
      'SEED_MEDIA_BASE_URL environment variable set edilmelidir! ' +
      'Örnek: SEED_MEDIA_BASE_URL=http://192.168.1.195:9000 (development) veya SEED_MEDIA_BASE_URL=http://api-test.tipbox.co:9000 (test)'
    );
  }

  return baseUrl.replace(/\/$/, '');
}

/**
 * Verilen relative path için tam media URL üretir.
 * DB'de sadece bucket path tutulur (örn: users/profile/9f2a1c/avatar.jpg)
 * Bu fonksiyon SEED_MEDIA_BASE_URL ile birleştirerek tam URL oluşturur.
 * 
 * MinIO için doğru format: http://[endpoint]:9000/tipbox-media/path/to/file.jpg
 * 
 * Örn: 
 * - Input:  'profile-pictures/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-avatar.jpg'
 * - Output: 'http://192.168.1.195:9000/tipbox-media/profile-pictures/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-avatar.jpg'
 * 
 * @param relativePath - MinIO bucket path (örn: profile-pictures/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-avatar.jpg)
 * @returns Tam media URL (SEED_MEDIA_BASE_URL kullanarak)
 */
export function buildMediaUrl(relativePath: string): string {
  const baseUrl = getPublicMediaBaseUrl();
  const cleanPath = relativePath.replace(/^\/+/, '').replace(/^tipbox-media\//, ''); // tipbox-media/ prefix'ini kaldır (zaten ekleyeceğiz)
  const bucketName = s3Config.bucketName;
  
  // MinIO için doğru format: http://endpoint/bucket-name/object-key
  return `${baseUrl}/${bucketName}/${cleanPath}`;
}

/**
 * Database'deki media URL'ini SEED_MEDIA_BASE_URL'e dönüştürür.
 * 
 * Eğer URL zaten SEED_MEDIA_BASE_URL ile eşleşiyorsa değiştirmez.
 * Eğer farklı bir endpoint'e işaret ediyorsa (localhost, eski IP, vb.), SEED_MEDIA_BASE_URL'e çevirir.
 * 
 * @param dbUrl - Database'den gelen URL
 * @returns SEED_MEDIA_BASE_URL kullanılarak normalize edilmiş URL
 */
export function normalizeMediaUrl(dbUrl: string | null | undefined): string | null {
  if (!dbUrl) return null;

  try {
    const url = new URL(dbUrl);
    const publicBase = getPublicMediaBaseUrl();
    const publicUrl = new URL(publicBase);

    // Eğer URL zaten SEED_MEDIA_BASE_URL endpoint'ine işaret ediyorsa değiştirme
    if (url.hostname === publicUrl.hostname && url.port === publicUrl.port) {
      return dbUrl;
    }

    // URL'yi SEED_MEDIA_BASE_URL endpoint'ine çevir
    return `${publicBase}${url.pathname}${url.search}${url.hash}`;
  } catch (error) {
    // Geçersiz URL ise olduğu gibi döndür
    return dbUrl;
  }
}

/**
 * Database'den gelen media path veya URL'ini tam URL'ye çevirir.
 * 
 * Eğer değer zaten bir URL ise (http:// veya https:// ile başlıyorsa), normalizeMediaUrl ile SEED_MEDIA_BASE_URL'e çevirir.
 * Eğer değer bir path ise (örn: profile-pictures/...), buildMediaUrl ile tam URL'ye çevirir (SEED_MEDIA_BASE_URL kullanarak).
 * 
 * @param mediaPathOrUrl - Database'den gelen path veya URL
 * @returns Tam media URL (SEED_MEDIA_BASE_URL kullanarak) veya null
 */
export function resolveMediaUrl(mediaPathOrUrl: string | null | undefined): string | null {
  if (!mediaPathOrUrl) return null;

  // Eğer zaten bir URL ise, normalizeMediaUrl ile SEED_MEDIA_BASE_URL'e çevir
  if (mediaPathOrUrl.startsWith('http://') || mediaPathOrUrl.startsWith('https://')) {
    return normalizeMediaUrl(mediaPathOrUrl);
  }

  // Path ise buildMediaUrl ile tam URL'ye çevir (SEED_MEDIA_BASE_URL kullanarak)
  return buildMediaUrl(mediaPathOrUrl);
}



















