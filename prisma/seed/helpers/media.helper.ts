import mediaMap from '../seed-media-map.json';

type MediaEntry = {
  targetKey: string;
};

const seedMedia = mediaMap as Record<string, MediaEntry>;

export type SeedMediaKey = keyof typeof seedMedia;

// MinIO public endpoint'ini environment variable'dan al
function getMinioPublicEndpoint(): string {
  // Environment variable'dan al, yoksa default olarak http://10.20.0.17:9000 kullan
  const endpoint = process.env.MINIO_PUBLIC_ENDPOINT || 'http://10.20.0.17:9000';
  return endpoint.replace(/\/$/, ''); // Trailing slash'i temizle
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

