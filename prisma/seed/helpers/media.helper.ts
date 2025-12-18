import mediaMap from '../seed-media-map.json';
import { S3Service } from '../../../src/infrastructure/s3/s3.service';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

type MediaEntry = {
  targetKey: string;
};

const seedMedia = mediaMap as Record<string, MediaEntry>;

export type SeedMediaKey = keyof typeof seedMedia;

// Seed media yükleme cache (bir kez yüklendikten sonra tekrar yüklemeyi önler)
let seedMediaUploaded = false;
const uploadedKeys = new Set<string>();

// MinIO public endpoint'ini environment variable'lardan al
function getMinioPublicEndpoint(): string {
  /**
   * Öncelik sırası:
   * 1) SEED_MEDIA_BASE_URL    -> Seed görselleri için tek kontrol noktası (önerilen)
   * 2) MINIO_PUBLIC_ENDPOINT  -> Frontend'in doğrudan eriştiği host
   * 3) S3_ENDPOINT            -> Container içi endpoint (production'da kullanmayın!)
   * 4) Varsayılan: http://localhost:9000
   * 
   * ÖNEMLİ: Production'da SEED_MEDIA_BASE_URL veya MINIO_PUBLIC_ENDPOINT set edilmelidir!
   * Örnek: SEED_MEDIA_BASE_URL=http://api-test.tipbox.co:9000
   */
  const isProduction = process.env.NODE_ENV === 'production';
  const hasPublicEndpoint = Boolean(
    process.env.SEED_MEDIA_BASE_URL || 
    process.env.MINIO_PUBLIC_ENDPOINT
  );

  // Production'da public endpoint set edilmemişse uyarı ver
  if (isProduction && !hasPublicEndpoint) {
    console.warn('⚠️  UYARI: Production ortamında SEED_MEDIA_BASE_URL veya MINIO_PUBLIC_ENDPOINT set edilmemiş!');
    console.warn('   Seed görselleri localhost URL\'leri ile kaydedilecek ve frontend erişemeyecek.');
    console.warn('   Lütfen .env dosyasına SEED_MEDIA_BASE_URL=http://api-test.tipbox.co:9000 ekleyin.');
  }

  const raw =
    process.env.SEED_MEDIA_HOST || // Eski isim (seed.ts ile uyumlu)
    process.env.SEED_MEDIA_BASE_URL ||
    process.env.MINIO_PUBLIC_ENDPOINT ||
    process.env.S3_ENDPOINT ||
    'http://localhost:9000';

  // Eğer SEED_MEDIA_BASE_URL veya MINIO_PUBLIC_ENDPOINT set edilmişse direkt kullan
  // (Bu production endpoint'i olmalı, değiştirme)
  if (hasPublicEndpoint) {
    const endpoint = raw.replace(/\/$/, '');
    if (isProduction) {
      console.log(`✅ Production endpoint kullanılıyor: ${endpoint}`);
    }
    return endpoint;
  }

  // Sadece development'ta container içi "minio:9000" adresini localhost'a çevir
  // Production'da bu durum olmamalı (SEED_MEDIA_BASE_URL set edilmeli)
  const normalized = raw.replace('minio:9000', 'localhost:9000');

  // Trailing slash'i temizle
  return normalized.replace(/\/$/, '');
}

function getBucketName(): string {
  return process.env.S3_BUCKET_NAME || 'tipbox-media';
}

/**
 * Seed media için sadece path döndürür (bucket içindeki path)
 * DB'ye yazılacak format: tipbox-media/products/phone6.png
 * @param key Seed media key
 * @returns Bucket path (örn: tipbox-media/products/phone6.png)
 */
export function getSeedMediaPath(key: SeedMediaKey): string {
  const entry = seedMedia[key];

  if (!entry) {
    throw new Error(`Seed media anahtarı bulunamadı: ${key}`);
  }

  const bucketName = getBucketName();
  return `${bucketName}/${entry.targetKey}`;
}

// Runtime'da URL oluştur (DEPRECATED: Seed için kullanmayın, sadece path kullanın)
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

