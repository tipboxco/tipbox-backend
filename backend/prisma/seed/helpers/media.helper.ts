import mediaMap from '../seed-media-map.json';
import { S3Service } from '../../../src/infrastructure/s3/s3.service';
import { getPublicMediaBaseUrl } from '../../../src/infrastructure/config/media.config';
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

// Public media base URL'ini tek noktadan al (bkz: media.config.ts)
function getSeedPublicMediaBaseUrl(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const hasExplicitPublic =
    Boolean(process.env.MEDIA_PUBLIC_BASE_URL) ||
    Boolean(process.env.SEED_MEDIA_BASE_URL) ||
    Boolean(process.env.MINIO_PUBLIC_ENDPOINT);

  if (isProduction && !hasExplicitPublic) {
    console.warn(
      '⚠️  UYARI: Production ortamında MEDIA_PUBLIC_BASE_URL (önerilen) veya SEED_MEDIA_BASE_URL/MINIO_PUBLIC_ENDPOINT set edilmemiş!'
    );
    console.warn(
      '   Seed görselleri için dönen URL\'ler yanlış olabilir. Önerilen: MEDIA_PUBLIC_BASE_URL=https://api.yourdomain.com/media'
    );
  }

  return getPublicMediaBaseUrl();
}

function getBucketName(): string {
  return process.env.S3_BUCKET_NAME || 'tipbox-media';
}

/**
 * Seed media için sadece path döndürür (bucket içindeki path)
 * DB'ye yazılacak format: products/phone6.png (bucket ismi olmadan)
 * @param key Seed media key
 * @param optional Eğer true ise, key bulunamazsa null döndürür (hata fırlatmaz)
 * @returns Path (örn: products/phone6.png) veya null (optional=true ise)
 */
export function getSeedMediaPath(key: SeedMediaKey): string;
export function getSeedMediaPath(key: SeedMediaKey, optional: true): string | null;
export function getSeedMediaPath(key: SeedMediaKey, optional?: boolean): string | null {
  const entry = seedMedia[key];

  if (!entry) {
    if (optional) {
      // Optional ise null döndür
      return null;
    }
    throw new Error(`Seed media anahtarı bulunamadı: ${key}`);
  }

  // Bucket ismi olmadan sadece path döndür
  return entry.targetKey;
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
  const publicBase = getSeedPublicMediaBaseUrl();
  return `${publicBase}/${entry.targetKey}`;
}

export function listSeedMedia(): Record<string, MediaEntry> {
  return seedMedia;
}

