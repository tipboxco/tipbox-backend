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
  const raw =
    process.env.SEED_MEDIA_BASE_URL ||
    process.env.MINIO_PUBLIC_ENDPOINT ||
    process.env.S3_ENDPOINT ||
    s3Config.endpoint ||
    'http://localhost:9000';

  // Container içi "minio:9000" adresini frontend'in erişebileceği host'a çevir
  const normalized = raw.replace('minio:9000', 'localhost:9000');

  // Trailing slash'i temizle
  return normalized.replace(/\/$/, '');
}

/**
 * Verilen relative path için tam media URL üretir.
 * Örn: buildMediaUrl('tipbox-media/catalog/home-appliances.png')
 */
export function buildMediaUrl(relativePath: string): string {
  const base = getPublicMediaBaseUrl();
  const cleanPath = relativePath.replace(/^\/+/, '');
  return `${base}/${cleanPath}`;
}








