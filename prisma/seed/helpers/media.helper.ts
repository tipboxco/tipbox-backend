import mediaMap from '../seed-media-map.json';

type MediaEntry = {
  targetKey: string;
};

const seedMedia = mediaMap as Record<string, MediaEntry>;

export type SeedMediaKey = keyof typeof seedMedia;

// MinIO public endpoint'ini environment variable'lardan al
function getMinioPublicEndpoint(): string {
  /**
   * Öncelik sırası:
   * 1) SEED_MEDIA_BASE_URL    -> Seed görselleri için tek kontrol noktası (önerilen)
   * 2) MINIO_PUBLIC_ENDPOINT  -> Frontend'in doğrudan eriştiği host
   * 3) S3_ENDPOINT            -> Container içi endpoint, minio:9000 ise localhost:9000'a çevir
   * 4) Varsayılan: http://localhost:9000
   */
  const raw =
    process.env.SEED_MEDIA_BASE_URL ||
    process.env.MINIO_PUBLIC_ENDPOINT ||
    process.env.S3_ENDPOINT ||
    'http://localhost:9000';

  // Container içi "minio:9000" adresini frontend'in erişebileceği localhost'a çevir
  const normalized = raw.replace('minio:9000', 'localhost:9000');

  // Trailing slash'i temizle
  return normalized.replace(/\/$/, '');
}

function getBucketName(): string {
  return process.env.S3_BUCKET_NAME || 'tipbox-media';
}

// Runtime'da URL oluştur
export function getSeedMediaUrl(key: SeedMediaKey, fallbackUrl?: string): string {
  const entry = seedMedia[key];

  if (!entry) {
    if (fallbackUrl) {
      return fallbackUrl;
    }
    throw new Error(`Seed media anahtarı bulunamadı: ${key}`);
  }

  // Runtime'da URL oluştur
  const baseUrl = getMinioPublicEndpoint();
  const bucketName = getBucketName();
  return `${baseUrl}/${bucketName}/${entry.targetKey}`;
}

export function listSeedMedia(): Record<string, MediaEntry> {
  return seedMedia;
}

