import { prisma } from './types';
import fs from 'fs';
import path from 'path';

const METADATA_FILE = path.join(__dirname, 'seed-metadata.json');

export interface SeedMetadata {
  lastSeedRun: Date | null;
  seedRunId: string | null;
  seedUserIds: string[];
  seedPostIds: string[];
  seedFeedIds: string[];
  seedNFTIds: string[];
  // Diğer seed ID'leri buraya eklenebilir
}

let metadataCache: SeedMetadata | null = null;

/**
 * Metadata dosyasını yükle
 */
export function loadSeedMetadata(): SeedMetadata {
  if (metadataCache) {
    return metadataCache;
  }

  const defaultMetadata: SeedMetadata = {
    lastSeedRun: null,
    seedRunId: null,
    seedUserIds: [],
    seedPostIds: [],
    seedFeedIds: [],
    seedNFTIds: [],
  };

  try {
    if (fs.existsSync(METADATA_FILE)) {
      const fileContent = fs.readFileSync(METADATA_FILE, 'utf-8');
      const parsed = JSON.parse(fileContent);
      metadataCache = {
        ...defaultMetadata,
        ...parsed,
        lastSeedRun: parsed.lastSeedRun ? new Date(parsed.lastSeedRun) : null,
      };
      return metadataCache!;
    }
  } catch (error) {
    console.warn('⚠️  Seed metadata dosyası okunamadı, varsayılan değerler kullanılıyor:', error);
  }

  metadataCache = defaultMetadata;
  return metadataCache;
}

/**
 * Metadata dosyasını kaydet
 */
export function saveSeedMetadata(metadata: SeedMetadata): void {
  try {
    metadataCache = metadata;
    const dataToSave = {
      ...metadata,
      lastSeedRun: metadata.lastSeedRun ? metadata.lastSeedRun.toISOString() : null,
    };
    fs.writeFileSync(METADATA_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');
  } catch (error) {
    console.error('❌ Seed metadata dosyası kaydedilemedi:', error);
    throw error;
  }
}

/**
 * Seed çalıştırma başlangıcını kaydet
 */
export function markSeedStart(): string {
  const metadata = loadSeedMetadata();
  const seedRunId = `seed-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  metadata.seedRunId = seedRunId;
  metadata.lastSeedRun = new Date();
  metadata.seedUserIds = [];
  metadata.seedPostIds = [];
  metadata.seedFeedIds = [];
  metadata.seedNFTIds = [];
  
  saveSeedMetadata(metadata);
  return seedRunId;
}

/**
 * Seed çalıştırma sonunu kaydet
 */
export function markSeedEnd(): void {
  const metadata = loadSeedMetadata();
  // Seed run ID'yi temizle (artık gerekmiyor)
  metadata.seedRunId = null;
  saveSeedMetadata(metadata);
}

/**
 * Seed kullanıcı ID'sini ekle
 */
export function addSeedUserId(userId: string): void {
  const metadata = loadSeedMetadata();
  if (!metadata.seedUserIds.includes(userId)) {
    metadata.seedUserIds.push(userId);
    saveSeedMetadata(metadata);
  }
}

/**
 * Seed post ID'sini ekle
 */
export function addSeedPostId(postId: string): void {
  const metadata = loadSeedMetadata();
  if (!metadata.seedPostIds.includes(postId)) {
    metadata.seedPostIds.push(postId);
    saveSeedMetadata(metadata);
  }
}

/**
 * Seed feed ID'sini ekle
 */
export function addSeedFeedId(feedId: string): void {
  const metadata = loadSeedMetadata();
  if (!metadata.seedFeedIds.includes(feedId)) {
    metadata.seedFeedIds.push(feedId);
    saveSeedMetadata(metadata);
  }
}

/**
 * Seed NFT ID'sini ekle
 */
export function addSeedNFTId(nftId: string): void {
  const metadata = loadSeedMetadata();
  if (!metadata.seedNFTIds.includes(nftId)) {
    metadata.seedNFTIds.push(nftId);
    saveSeedMetadata(metadata);
  }
}

/**
 * Seed data çalıştırıldı mı kontrol et
 */
export function hasSeedData(): boolean {
  const metadata = loadSeedMetadata();
  return metadata.lastSeedRun !== null;
}

/**
 * Seed data timestamp'ini al
 */
export function getLastSeedRunTime(): Date | null {
  const metadata = loadSeedMetadata();
  return metadata.lastSeedRun;
}

/**
 * Seed kullanıcı ID'lerini al
 */
export function getSeedUserIds(): string[] {
  const metadata = loadSeedMetadata();
  return [...metadata.seedUserIds];
}

/**
 * Seed post ID'lerini al
 */
export function getSeedPostIds(): string[] {
  const metadata = loadSeedMetadata();
  return [...metadata.seedPostIds];
}

/**
 * Seed feed ID'lerini al
 */
export function getSeedFeedIds(): string[] {
  const metadata = loadSeedMetadata();
  return [...metadata.seedFeedIds];
}

/**
 * Seed NFT ID'lerini al
 */
export function getSeedNFTIds(): string[] {
  const metadata = loadSeedMetadata();
  return [...metadata.seedNFTIds];
}

/**
 * Metadata'yı temizle (clear seed data çalıştırıldığında)
 */
export function clearSeedMetadata(): void {
  const defaultMetadata: SeedMetadata = {
    lastSeedRun: null,
    seedRunId: null,
    seedUserIds: [],
    seedPostIds: [],
    seedFeedIds: [],
    seedNFTIds: [],
  };
  saveSeedMetadata(defaultMetadata);
}

