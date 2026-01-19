import { s3Config } from './s3.config';
/**
 * Default avatar path (MinIO'daki path)
 * Bu path tüm ortamlarda (dev, test, prod) aynı olacak
 */
export const DEFAULT_AVATAR_PATH = 'defaultavatar/default-useravatar.png';
/**
 * Ortak public media base URL
 * - Tüm görsel URL'leri için TEK kontrol noktası
 * - Öncelikle SEED_MEDIA_BASE_URL kullanılır (önerilen)
 * - Yoksa BASE_URL'den port 9000 türetilir (eski yöntem)
 */
export function getPublicMediaBaseUrl(): string {
  // Öncelik 1: SEED_MEDIA_BASE_URL (önerilen yöntem - nginx proxy için)
  const seedMediaBaseUrl = process.env.SEED_MEDIA_BASE_URL;
  const baseUrl = process.env.BASE_URL;
  
  // Eğer SEED_MEDIA_BASE_URL varsa ve BASE_URL ile uyumluysa kullan
  if (seedMediaBaseUrl) {
    // Eğer BASE_URL de varsa, IP/hostname uyumluluğunu kontrol et
    if (baseUrl) {
      try {
        const seedUrl = new URL(seedMediaBaseUrl);
        const baseUrlObj = new URL(baseUrl);
        
        // Eğer hostname'ler farklıysa (farklı IP), BASE_URL'den türet
        if (seedUrl.hostname !== baseUrlObj.hostname) {
          // BASE_URL'den port 9000 ile türet
          const derivedMediaUrl = `${baseUrlObj.protocol}//${baseUrlObj.hostname}:9000`;
          return derivedMediaUrl;
        }
      } catch {
        // URL parse edilemezse, SEED_MEDIA_BASE_URL'i kullan
      }
    }
    return seedMediaBaseUrl.replace(/\/$/, '');
  }
  
  // Öncelik 2: BASE_URL'den port 9000 türet (eski yöntem - geriye dönük uyumluluk)
  if (!baseUrl) {
    throw new Error(
      'SEED_MEDIA_BASE_URL veya BASE_URL environment variable set edilmelidir! ' +
      'Önerilen: SEED_MEDIA_BASE_URL=https://api-test.tipbox.co/media (nginx proxy ile) ' +
      'veya BASE_URL=http://192.168.1.164:3000 (development için port 9000\'e çevrilir)'
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
 * Database'den sadece path gelir (örn: catalog/home-appliances.png)
 * Bu fonksiyon getPublicMediaBaseUrl() ile birleştirerek tam URL oluşturur.
 * 
 * Eğer mediaPath zaten tam bir URL ise (http:// veya https:// ile başlıyorsa), direkt döndürülür.
 * 
 * AVATAR FALLBACK: Eğer mediaPath null/undefined ise, default avatar URL'i döndürülür.
 * 
 * Örnekler:
 * - Input:  'catalog/home-appliances.png'
 *   SEED_MEDIA_BASE_URL=https://api-test.tipbox.co/media
 *   Output: 'https://api-test.tipbox.co/media/catalog/home-appliances.png'
 * 
 * - Input:  'profile-pictures/xxx/avatar.jpg'
 *   BASE_URL=http://192.168.1.164:3000 (port 9000'e çevrilir)
 *   Output: 'http://192.168.1.164:9000/profile-pictures/xxx/avatar.jpg'
 * 
 * - Input:  'http://example.com/image.jpg' (tam URL)
 *   Output: 'http://example.com/image.jpg' (değişmeden döndürülür)
 * 
 * - Input:  null (avatar yok)
 *   Output: 'http://api-test.tipbox.co/media/defaultavatar/default-useravatar.png'
 * 
 * @param mediaPath - Database'den gelen path veya tam URL
 * @param useDefaultAvatarFallback - true ise null durumunda default avatar döndürülür (default: false)
 * @returns Tam media URL veya null
 */
export function resolveMediaUrl(mediaPath: string | null | undefined, useDefaultAvatarFallback: boolean = false): string | null {
  if (!mediaPath) {
    // Eğer avatar için çağrılıyorsa ve fallback istenmişse, default avatar döndür
    if (useDefaultAvatarFallback) {
      const baseUrl = getPublicMediaBaseUrl();
      return `${baseUrl}/tipbox-media/${DEFAULT_AVATAR_PATH}`;
    }
    return null;
  }
  // Eğer zaten tam bir URL ise (http:// veya https:// ile başlıyorsa)
  if (mediaPath.match(/^https?:\/\//)) {
    // YOUR_DEVICE_IP placeholder'ını gerçek base URL ile değiştir
    if (mediaPath.includes('YOUR_DEVICE_IP')) {
      const baseUrl = getPublicMediaBaseUrl();
      try {
        const url = new URL(mediaPath);
        const pathname = url.pathname;
        return `${baseUrl}${pathname}`;
      } catch {
        return mediaPath.replace(/http:\/\/YOUR_DEVICE_IP:9000/, baseUrl);
      }
    }
    
    // Eğer URL tipbox-media içeriyorsa (MinIO bucket path'leri), 
    // eski base URL'i yeni base URL ile değiştir
    const currentBaseUrl = getPublicMediaBaseUrl();
    
    // tipbox-media içeren URL'ler için pathname'i çıkar ve yeni base URL ile birleştir
    if (mediaPath.includes('tipbox-media')) {
      try {
        const url = new URL(mediaPath);
        const pathname = url.pathname;
        
        // Pathname zaten /tipbox-media/ ile başlıyorsa, direkt kullan
        // Değilse, tipbox-media ekle
        if (pathname.startsWith('/tipbox-media/')) {
          return `${currentBaseUrl}${pathname}`;
        } else {
          // Pathname'den başındaki /'yi kaldır
          const cleanPath = pathname.replace(/^\//, '');
          return `${currentBaseUrl}/tipbox-media/${cleanPath}`;
        }
      } catch {
        // URL parse edilemezse, regex ile path'i çıkar ve yeni base URL ile birleştir
        const pathMatch = mediaPath.match(/\/tipbox-media\/.+$/);
        if (pathMatch) {
          return `${currentBaseUrl}${pathMatch[0]}`;
        }
      }
    }
    
    // tipbox-media içermeyen URL'ler için, sadece hostname/port farklıysa güncelle
    try {
      const url = new URL(mediaPath);
      const currentUrl = new URL(currentBaseUrl);
      
      // Eğer hostname veya port farklıysa, yeni base URL ile değiştir
      if (url.hostname !== currentUrl.hostname || url.port !== currentUrl.port) {
        const pathname = url.pathname;
        return `${currentBaseUrl}${pathname}`;
      }
    } catch {
      // URL parse edilemezse, olduğu gibi döndür
    }
    
    return mediaPath;
  }
  // Path'i temizle (başındaki / ve tipbox-media/ prefix'ini kaldır)
  const cleanPath = mediaPath.replace(/^\/+/, '').replace(/^tipbox-media\//, '');
  
  // getPublicMediaBaseUrl() ile media base URL'ini al
  const baseUrl = getPublicMediaBaseUrl();
  
  // MinIO için bucket adını ekle (baseUrl + /bucket-name + /path)
  return `${baseUrl}/tipbox-media/${cleanPath}`;
}
