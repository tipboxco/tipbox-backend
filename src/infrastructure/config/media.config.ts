import { s3Config } from './s3.config';

/**
 * Ortak public media base URL (MinIO için)
 * - .env dosyasından BASE_URL'i okur
 * - BASE_URL'den port 9000'i türetir (MinIO için)
 * - Örnek: BASE_URL=http://192.168.1.164:3000 → http://192.168.1.164:9000
 */
export function getPublicMediaBaseUrl(): string {
  const baseUrl = process.env.BASE_URL;
  
  if (!baseUrl) {
    throw new Error(
      'BASE_URL environment variable set edilmelidir! ' +
      'Örnek: BASE_URL=http://192.168.1.164:3000 (development) veya BASE_URL=https://api-test.tipbox.co (test)'
    );
  }

  try {
    // BASE_URL'i parse et
    let cleanBaseUrl = baseUrl.replace(/\/$/, '');
    if (!cleanBaseUrl.match(/^https?:\/\//)) {
      cleanBaseUrl = `http://${cleanBaseUrl}`;
    }
    
    const url = new URL(cleanBaseUrl);
    // Aynı IP/hostname'i kullan, port'u 9000 yap (MinIO için)
    const mediaBaseUrl = `${url.protocol}//${url.hostname}:9000`;
    
    return mediaBaseUrl;
  } catch (error) {
    throw new Error(
      `BASE_URL parse edilemedi: ${baseUrl}. ` +
      'Örnek format: http://192.168.1.164:3000 veya https://api-test.tipbox.co'
    );
  }
}

/**
 * Database'den gelen media path'ini tam URL'ye çevirir.
 * 
 * Database'den sadece path gelir (örn: profile-pictures/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-avatar.jpg)
 * Bu fonksiyon BASE_URL'den türetilen MinIO endpoint'i ile birleştirerek tam URL oluşturur.
 * 
 * Eğer mediaPath zaten tam bir URL ise (http:// veya https:// ile başlıyorsa), direkt döndürülür.
 * 
 * MinIO için doğru format: http://[endpoint]:9000/tipbox-media/path/to/file.jpg
 * BASE_URL'den otomatik türetilir: BASE_URL=http://192.168.1.164:3000 → http://192.168.1.164:9000
 * 
 * Örn: 
 * - Input:  'profile-pictures/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-avatar.jpg'
 * - Output: 'http://192.168.1.164:9000/tipbox-media/profile-pictures/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-avatar.jpg'
 * - Input:  'http://example.com/image.jpg' (tam URL)
 * - Output: 'http://example.com/image.jpg' (değişmeden döndürülür)
 * 
 * @param mediaPath - Database'den gelen path (örn: profile-pictures/480f5de9-b691-4d70-a6a8-2789226f4e07/seed-avatar.jpg) veya tam URL
 * @returns Tam media URL (BASE_URL'den türetilen MinIO endpoint kullanarak) veya null
 */
export function resolveMediaUrl(mediaPath: string | null | undefined): string | null {
  if (!mediaPath) return null;

  // Eğer zaten tam bir URL ise (http:// veya https:// ile başlıyorsa), direkt döndür
  if (mediaPath.match(/^https?:\/\//)) {
    return mediaPath;
  }

  // Path'i temizle (başındaki / ve tipbox-media/ prefix'ini kaldır)
  const cleanPath = mediaPath.replace(/^\/+/, '').replace(/^tipbox-media\//, '');
  
  // BASE_URL'den türetilen MinIO endpoint'i al
  const baseUrl = getPublicMediaBaseUrl();
  const bucketName = s3Config.bucketName;
  
  // MinIO için doğru format: http://endpoint/bucket-name/object-key
  return `${baseUrl}/${bucketName}/${cleanPath}`;
}



















