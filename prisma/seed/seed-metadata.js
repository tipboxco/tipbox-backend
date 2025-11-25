const fs = require('fs');
const path = require('path');

// Seed metadata dosyasının path'ini belirle
// process.cwd() proje root'unu verir, prisma/seed klasörüne ekliyoruz
const SEED_DIR = path.join(process.cwd(), 'prisma', 'seed');
const METADATA_FILE = path.join(SEED_DIR, 'seed-metadata.json');

// Internal type definition (JSDoc)
/**
 * @typedef {Object} SeedMetadata
 * @property {Date | null} lastSeedRun
 * @property {string | null} seedRunId
 * @property {string[]} seedUserIds
 * @property {string[]} seedPostIds
 * @property {string[]} seedFeedIds
 * @property {string[]} seedNFTIds
 */

let metadataCache = null;

/**
 * Metadata dosyasını yükle
 */
function loadSeedMetadata() {
  if (metadataCache) {
    return metadataCache;
  }

  const defaultMetadata = {
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
      return metadataCache;
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
function saveSeedMetadata(metadata) {
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
function markSeedStart() {
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
function markSeedEnd() {
  const metadata = loadSeedMetadata();
  // Seed run ID'yi temizle (artık gerekmiyor)
  metadata.seedRunId = null;
  saveSeedMetadata(metadata);
}

/**
 * Seed kullanıcı ID'sini ekle
 */
function addSeedUserId(userId) {
  const metadata = loadSeedMetadata();
  if (!metadata.seedUserIds.includes(userId)) {
    metadata.seedUserIds.push(userId);
    saveSeedMetadata(metadata);
  }
}

/**
 * Seed post ID'sini ekle
 */
function addSeedPostId(postId) {
  const metadata = loadSeedMetadata();
  if (!metadata.seedPostIds.includes(postId)) {
    metadata.seedPostIds.push(postId);
    saveSeedMetadata(metadata);
  }
}

/**
 * Seed feed ID'sini ekle
 */
function addSeedFeedId(feedId) {
  const metadata = loadSeedMetadata();
  if (!metadata.seedFeedIds.includes(feedId)) {
    metadata.seedFeedIds.push(feedId);
    saveSeedMetadata(metadata);
  }
}

/**
 * Seed NFT ID'sini ekle
 */
function addSeedNFTId(nftId) {
  const metadata = loadSeedMetadata();
  if (!metadata.seedNFTIds.includes(nftId)) {
    metadata.seedNFTIds.push(nftId);
    saveSeedMetadata(metadata);
  }
}

/**
 * Seed data çalıştırıldı mı kontrol et
 */
function hasSeedData() {
  const metadata = loadSeedMetadata();
  return metadata.lastSeedRun !== null;
}

/**
 * Seed data timestamp'ini al
 */
function getLastSeedRunTime() {
  const metadata = loadSeedMetadata();
  return metadata.lastSeedRun;
}

/**
 * Seed kullanıcı ID'lerini al
 */
function getSeedUserIds() {
  const metadata = loadSeedMetadata();
  return [...metadata.seedUserIds];
}

/**
 * Seed post ID'lerini al
 */
function getSeedPostIds() {
  const metadata = loadSeedMetadata();
  return [...metadata.seedPostIds];
}

/**
 * Seed feed ID'lerini al
 */
function getSeedFeedIds() {
  const metadata = loadSeedMetadata();
  return [...metadata.seedFeedIds];
}

/**
 * Seed NFT ID'lerini al
 */
function getSeedNFTIds() {
  const metadata = loadSeedMetadata();
  return [...metadata.seedNFTIds];
}

/**
 * Metadata'yı temizle (clear seed data çalıştırıldığında)
 */
function clearSeedMetadata() {
  const defaultMetadata = {
    lastSeedRun: null,
    seedRunId: null,
    seedUserIds: [],
    seedPostIds: [],
    seedFeedIds: [],
    seedNFTIds: [],
  };
  saveSeedMetadata(defaultMetadata);
}

// CommonJS export for ts-node compatibility
// This MUST be at the end and use module.exports (not export)
module.exports = {
  markSeedStart,
  markSeedEnd,
  addSeedUserId,
  addSeedPostId,
  addSeedFeedId,
  addSeedNFTId,
  hasSeedData,
  getLastSeedRunTime,
  getSeedUserIds,
  getSeedPostIds,
  getSeedFeedIds,
  getSeedNFTIds,
  clearSeedMetadata,
  loadSeedMetadata,
  saveSeedMetadata
};
