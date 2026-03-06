import { getCurrentContext } from '../middleware/request-context.middleware';

/**
 * Default avatar path (MinIO'daki path)
 * Bu path tüm ortamlarda (dev, test, prod) aynı olacak
 */
export const DEFAULT_AVATAR_PATH = 'avatars/default/default-useravatar.png';

function normalizeUrl(raw: string): URL {
  const trimmed = raw.trim().replace(/\/$/, '');
  const withProtocol = trimmed.match(/^https?:\/\//) ? trimmed : `http://${trimmed}`;
  return new URL(withProtocol);
}

/**
 * Verilen base URL'i "public object base" haline getirir.
 *
 * - Eğer base URL path'i boşsa → otomatik `/tipbox-media` ekler
 *   (örn. `http://192.168.1.116:9000` → `http://192.168.1.116:9000/tipbox-media`)
 * - Eğer path zaten doluysa aynen korur
 *   (örn. nginx proxy: `https://api-test.tipbox.co/media`)
 *   (örn. explicit bucket: `http://localhost:9000/tipbox-media`)
 */
function normalizePublicObjectBaseUrl(rawBaseUrl: string): string {
  const url = normalizeUrl(rawBaseUrl);
  const pathname = url.pathname.replace(/\/$/, '');

  if (!pathname || pathname === '') {
    url.pathname = '/tipbox-media';
    return `${url.protocol}//${url.host}${url.pathname}`;
  }

  return `${url.protocol}//${url.host}${pathname}`;
}

function tryExtractObjectKeyFromUrl(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    const pathname = url.pathname || '';

    const tipboxMediaIdx = pathname.indexOf('/tipbox-media/');
    if (tipboxMediaIdx >= 0) {
      return pathname.substring(tipboxMediaIdx + '/tipbox-media/'.length);
    }

    const mediaIdx = pathname.indexOf('/media/');
    if (mediaIdx >= 0) {
      return pathname.substring(mediaIdx + '/media/'.length);
    }

    return null;
  } catch {
    return null;
  }
}
/** Express Request tipi - circular dependency önlemek için lazy import yerine tip için */
type ExpressRequest = { get(name: string): string | undefined; protocol: string };

/**
 * Mevcut HTTP isteğinden media base URL türetir.
 * Böylece MEDIA_PUBLIC_BASE_URL set edilmeden hangi ağdan istek gelirse (localhost, 10.5.50.134 vb.)
 * avatar/media URL'leri o host üzerinden döner; app tarafı görsele erişebilir.
 */
function getMediaBaseUrlFromRequest(req: ExpressRequest): string {
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
  const hostHeader = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
  let hostname: string;
  try {
    const u = new URL(hostHeader.startsWith('http') ? hostHeader : `http://${hostHeader}`);
    hostname = u.hostname;
  } catch {
    hostname = hostHeader.includes(']') ? hostHeader : hostHeader.split(':')[0];
  }
  const mediaPort = process.env.MEDIA_PORT || '9000';
  const hostPart = hostname.includes(':') ? `[${hostname}]` : hostname;
  return `${protocol}://${hostPart}:${mediaPort}`;
}

/**
 * Ortak public media base URL
 * - Tüm görsel URL'leri için TEK kontrol noktası
 *
 * Öncelik sırası:
 * 1. MEDIA_PUBLIC_BASE_URL (explicit override)
 * 2. SEED_MEDIA_BASE_URL (asıl kullanılan env)
 * 3. MINIO_PUBLIC_ENDPOINT (legacy)
 * 4. Request context (ağ değişince otomatik adapte olur)
 * 5. BASE_URL → port 9000 türetme (legacy)
 * 6. S3_ENDPOINT (dev fallback)
 *
 * Bu fonksiyonun döndürdüğü değer "public object base" olmalıdır:
 * - Direct MinIO: `http://<ip>:9000/tipbox-media`
 * - Nginx proxy:  `https://api-test.tipbox.co/media`
 */
export function getPublicMediaBaseUrl(): string {
  // 1) Explicit override (her zaman en yüksek öncelik)
  const mediaPublicBaseUrl = process.env.MEDIA_PUBLIC_BASE_URL;
  if (mediaPublicBaseUrl) return normalizePublicObjectBaseUrl(mediaPublicBaseUrl);

  // 2) SEED_MEDIA_BASE_URL — ana env değişkeni
  const seedMediaBase = process.env.SEED_MEDIA_BASE_URL;
  if (seedMediaBase) return normalizePublicObjectBaseUrl(seedMediaBase);

  // 3) Legacy env
  const minioPublic = process.env.MINIO_PUBLIC_ENDPOINT;
  if (minioPublic) return normalizePublicObjectBaseUrl(minioPublic);

  // 4) Request'ten türet (env yoksa; ağ değişince otomatik adapte olur)
  const ctx = getCurrentContext();
  if (ctx?.req) return normalizePublicObjectBaseUrl(getMediaBaseUrlFromRequest(ctx.req as ExpressRequest));

  // 5) Legacy fallback: BASE_URL'den 9000 türet
  const baseUrl = process.env.BASE_URL;
  if (baseUrl) {
    try {
      const url = normalizeUrl(baseUrl);
      const derived = `${url.protocol}//${url.hostname}:9000`;
      return normalizePublicObjectBaseUrl(derived);
    } catch {
      throw new Error(
        `BASE_URL parse edilemedi: ${baseUrl}. ` +
          'Örnek format: http://192.168.1.164:3000 veya https://api-test.tipbox.co'
      );
    }
  }

  // 6) Son çare: S3_ENDPOINT'ten public üretmeyi dene (dev için)
  const s3Endpoint = process.env.S3_ENDPOINT;
  if (s3Endpoint) {
    const isDevelopment = (process.env.NODE_ENV || 'development') === 'development';
    const normalized = isDevelopment
      ? s3Endpoint.replace(/minio:9000/g, 'localhost:9000')
      : s3Endpoint;
    return normalizePublicObjectBaseUrl(normalized);
  }

  throw new Error(
    'SEED_MEDIA_BASE_URL veya MEDIA_PUBLIC_BASE_URL veya BASE_URL set edilmelidir.'
  );
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
 *   MEDIA_PUBLIC_BASE_URL=https://api-test.tipbox.co/media
 *   Output: 'https://api-test.tipbox.co/media/catalog/home-appliances.png'
 * 
 * - Input:  'profile-pictures/xxx/avatar.jpg'
 *   BASE_URL=http://192.168.1.164:3000 (port 9000'e çevrilir)
 *   Output: 'http://192.168.1.164:9000/tipbox-media/profile-pictures/xxx/avatar.jpg'
 * 
 * - Input:  'http://example.com/image.jpg' (tam URL)
 *   Output: 'http://example.com/image.jpg' (değişmeden döndürülür)
 * 
 * - Input:  null (avatar yok)
 *   Output: 'http://api-test.tipbox.co/media/avatars/default/default-useravatar.png'
 * 
 * @param mediaPath - Database'den gelen path veya tam URL
 * @param useDefaultAvatarFallback - true ise null durumunda default avatar döndürülür (default: false)
 * @returns Tam media URL veya null
 */
export function resolveMediaUrl(mediaPath: string | null | undefined, useDefaultAvatarFallback: boolean = false): string | null {
  const publicBase = getPublicMediaBaseUrl();

  if (!mediaPath) {
    // Eğer avatar için çağrılıyorsa ve fallback istenmişse, default avatar döndür
    if (useDefaultAvatarFallback) {
      return `${publicBase}/${DEFAULT_AVATAR_PATH}`;
    }
    return null;
  }

  // Tam URL ise: sadece bilinen MinIO/proxy formatlarını normalize et.
  if (mediaPath.match(/^https?:\/\//)) {
    // Placeholder URL'ler (docs / seed çıktıları)
    if (mediaPath.includes('YOUR_DEVICE_IP')) {
      try {
        const url = new URL(mediaPath);
        const key = tryExtractObjectKeyFromUrl(mediaPath);
        if (key) return `${publicBase}/${key}`;
        return `${publicBase}${url.pathname}`;
      } catch {
        return mediaPath.replace(/http:\/\/YOUR_DEVICE_IP:9000/, publicBase);
      }
    }

    const extractedKey = tryExtractObjectKeyFromUrl(mediaPath);
    if (extractedKey) return `${publicBase}/${extractedKey}`;

    // Bilinmeyen host/path (CDN vb.) ise olduğu gibi döndür.
    return mediaPath;
  }

  // Path'i temizle (başındaki /, tipbox-media/ ve media/ prefix'lerini kaldır)
  const cleanPath = mediaPath
    .replace(/^\/+/, '')
    .replace(/^tipbox-media\//, '')
    .replace(/^media\//, '');

  return `${publicBase}/${cleanPath}`;
}
