import { s3Config } from './s3.config';

/**
 * Ortak public media base URL
 * - Tüm görsel URL'leri için TEK kontrol noktası
 * - Seed ve runtime aynı env önceliğini kullanır
 * - HİÇBİR ZAMAN localhost kullanılmaz!
 *
 * Öncelik sırası:
 * 1) SEED_MEDIA_BASE_URL    -> Seed & frontend için önerilen tek base URL
 * 2) MINIO_PUBLIC_ENDPOINT  -> Frontend'in doğrudan eriştiği host
 * 3) DEVICE_IP              -> Development modunda cihaz IP adresi (env'den)
 * 4) Test ortamında: api-test.tipbox.co:9000
 * 5) Production'da: SEED_MEDIA_BASE_URL veya MINIO_PUBLIC_ENDPOINT zorunlu
 */
export function getPublicMediaBaseUrl(): string {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  /**
   * Öncelik sırası:
   * 1) SEED_MEDIA_BASE_URL    -> Seed & frontend için önerilen tek base URL
   * 2) MINIO_PUBLIC_ENDPOINT  -> Frontend'in doğrudan eriştiği host
   * 3) Test ortamında: api-test.tipbox.co:9000
   * 4) Development'ta: DEVICE_IP env değişkeni (örn: http://192.168.1.195:9000)
   * 5) Production'da: SEED_MEDIA_BASE_URL veya MINIO_PUBLIC_ENDPOINT zorunlu!
   */
  const hasPublicEndpoint = Boolean(
    process.env.SEED_MEDIA_BASE_URL || 
    process.env.MINIO_PUBLIC_ENDPOINT
  );

  // Public endpoint varsa direkt kullan
  if (hasPublicEndpoint) {
    const raw = process.env.SEED_MEDIA_BASE_URL || process.env.MINIO_PUBLIC_ENDPOINT || '';
    return raw.replace(/\/$/, '');
  }

  // Test ortamında api-test.tipbox.co kullan
  if (nodeEnv === 'test') {
    return 'http://api-test.tipbox.co:9000';
  }

  // Development ortamında DEVICE_IP kullan (localhost YOK!)
  if (nodeEnv === 'development') {
    const deviceIp = process.env.DEVICE_IP;
    if (deviceIp) {
      // DEVICE_IP formatı: 192.168.1.195 veya http://192.168.1.195:9000
      const cleanIp = deviceIp.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const hasPort = cleanIp.includes(':');
      return hasPort ? `http://${cleanIp}` : `http://${cleanIp}:9000`;
    }
    
    // DEVICE_IP yoksa hata ver (localhost kullanma!)
    throw new Error(
      'Development modunda DEVICE_IP environment variable set edilmelidir! ' +
      'Örnek: DEVICE_IP=192.168.1.195 veya DEVICE_IP=http://192.168.1.195:9000'
    );
  }

  // Production'da public endpoint zorunlu
  if (nodeEnv === 'production') {
    throw new Error(
      'Production modunda SEED_MEDIA_BASE_URL veya MINIO_PUBLIC_ENDPOINT environment variable set edilmelidir!'
    );
  }

  // Fallback (olmamalı)
  throw new Error(
    `Media base URL belirlenemedi! NODE_ENV: ${nodeEnv}. ` +
    'Lütfen SEED_MEDIA_BASE_URL, MINIO_PUBLIC_ENDPOINT veya DEVICE_IP environment variable\'ını set edin.'
  );
}

/**
 * Verilen relative path için tam media URL üretir.
 * DB'de sadece bucket path tutulur (örn: users/profile/9f2a1c/avatar.jpg)
 * Bu fonksiyon PUBLIC_BASE_URL ile birleştirerek tam URL oluşturur.
 * 
 * MinIO için doğru format: http://[endpoint]:9000/tipbox-media/path/to/file.jpg
 * - Development: http://192.168.1.195:9000/tipbox-media/...
 * - Test: http://api-test.tipbox.co:9000/tipbox-media/...
 * 
 * Örn: 
 * - Input:  'profile-pictures/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-avatar.jpg'
 * - Output: 'http://192.168.1.195:9000/tipbox-media/profile-pictures/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-avatar.jpg'
 * 
 * @param relativePath - MinIO bucket path (örn: profile-pictures/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-avatar.jpg)
 * @returns Tam media URL
 */
export function buildMediaUrl(relativePath: string): string {
  // PUBLIC_BASE_URL env değişkeni varsa onu kullan, yoksa getPublicMediaBaseUrl() kullan
  const baseUrl = process.env.PUBLIC_BASE_URL || getPublicMediaBaseUrl();
  const cleanPath = relativePath.replace(/^\/+/, '').replace(/^tipbox-media\//, ''); // tipbox-media/ prefix'ini kaldır (zaten ekleyeceğiz)
  const bucketName = s3Config.bucketName;
  
  // MinIO için doğru format: http://endpoint/bucket-name/object-key
  return `${baseUrl}/${bucketName}/${cleanPath}`;
}

/**
 * Database'deki media URL'ini ortama uygun endpoint'e dönüştürür.
 * 
 * Eğer URL eski format içeriyorsa (localhost, minio:9000), mevcut ortama uygun endpoint'e çevirir.
 * Bu sayede frontend her zaman doğru URL'yi alır.
 * 
 * @param dbUrl - Database'den gelen URL (örn: http://192.168.1.195:9000/tipbox-media/products/phone5.png)
 * @returns Ortama uygun endpoint'e dönüştürülmüş URL
 * 
 * Örnek:
 * - Input:  http://192.168.1.195:9000/tipbox-media/products/phone5.png (development)
 * - Output: http://api-test.tipbox.co:9000/tipbox-media/products/phone5.png (test ortamında)
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
 * Eğer değer zaten bir URL ise (http:// veya https:// ile başlıyorsa), normalizeMediaUrl ile ortama uygun hale getirir.
 * Eğer değer bir path ise (örn: profile-pictures/... veya tipbox-media/profile-pictures/...), buildMediaUrl ile tam URL'ye çevirir.
 * 
 * Bu fonksiyon hem eski URL formatını hem de yeni path formatını destekler.
 * 
 * @param mediaPathOrUrl - Database'den gelen path veya URL
 * @returns Tam media URL veya null
 * 
 * Örnekler (Development):
 * - Input:  'profile-pictures/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-avatar.jpg'
 * - Output: 'http://192.168.1.195:9000/tipbox-media/profile-pictures/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-avatar.jpg'
 * 
 * Örnekler (Test):
 * - Input:  'profile-pictures/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-avatar.jpg'
 * - Output: 'http://api-test.tipbox.co:9000/tipbox-media/profile-pictures/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-avatar.jpg'
 */
export function resolveMediaUrl(mediaPathOrUrl: string | null | undefined): string | null {
  if (!mediaPathOrUrl) return null;

  // Eğer zaten bir URL ise (http:// veya https:// ile başlıyorsa), olduğu gibi döndür
  if (mediaPathOrUrl.startsWith('http://') || mediaPathOrUrl.startsWith('https://')) {
    return mediaPathOrUrl;
  }

  // Path ise buildMediaUrl ile tam URL'ye çevir
  // buildMediaUrl zaten tipbox-media/ prefix'ini kaldırıp tekrar ekliyor, bu yüzden güvenli
  return buildMediaUrl(mediaPathOrUrl);
}



















