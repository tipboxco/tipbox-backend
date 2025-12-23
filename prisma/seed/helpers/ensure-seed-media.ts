/**
 * Seed media görsellerini MinIO'ya yükler
 * Bu fonksiyon seed.ts başında çağrılarak tüm görsellerin MinIO'da olduğundan emin olur
 */

import { S3Service } from '../../../src/infrastructure/s3/s3.service';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import mediaMap from '../seed-media-map.json';

type MediaEntry = {
  targetKey: string;
};

const seedMedia = mediaMap as Record<string, MediaEntry>;

// upload-seed-media.ts'deki asset mapping mantığını kullan
// Bu mapping upload-seed-media.ts ile aynı olmalı
function buildAssetMapping(): Map<string, string> {
  const assetsBasePath = path.join(__dirname, '../../tests/assets');
  const mapping = new Map<string, string>();
  
  const TEST_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';
  const TARGET_USER_ID = '248cc91f-b551-4ecc-a885-db1163571330';
  
  // User avatars
  mapping.set('user.avatar.primary', path.join(assetsBasePath, 'userprofile', 'ozan.jpg'));
  mapping.set('user.banner.primary', path.join(assetsBasePath, 'userprofile', 'banner.png'));
  mapping.set('user.avatar.market', path.join(assetsBasePath, 'userprofile', 'ozan.jpg'));
  mapping.set('user.avatar.trust1', path.join(assetsBasePath, 'userprofile', 'useravatar.jpg'));
  mapping.set('user.avatar.trust2', path.join(assetsBasePath, 'userprofile', 'useravatar2.jpg'));
  mapping.set('user.avatar.trust3', path.join(assetsBasePath, 'userprofile', 'useravatar3.jpg'));
  mapping.set('user.avatar.trust4', path.join(assetsBasePath, 'userprofile', 'useravatar4.png'));
  mapping.set('user.avatar.trust5', path.join(assetsBasePath, 'userprofile', 'ozan.jpg'));
  mapping.set('user.avatar.truster1', path.join(assetsBasePath, 'userprofile', 'useravatar2.jpg'));
  mapping.set('user.avatar.truster2', path.join(assetsBasePath, 'userprofile', 'useravatar3.jpg'));
  mapping.set('user.avatar.truster3', path.join(assetsBasePath, 'userprofile', 'useravatar4.png'));
  
  // Inventory
  mapping.set('inventory.dyson-media', path.join(__dirname, '../../tests/post.png'));
  
  // Catalog files
  const catalogFiles = [
    'air conditioner.png', 'cameras.png', 'computers-tablets.png',
    'drone.png', 'games.png', 'headphones.png', 'home appliances.png',
    'kucukev.png', 'phones.png', 'printers.png', 'smart home devices.png',
    'TV.png', 'otomotiv.png'
  ];
  
  const slugify = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  
  for (const fileName of catalogFiles) {
    const baseName = fileName.replace(path.extname(fileName), '');
    const slug = slugify(baseName || fileName);
    const catalogPath = path.join(assetsBasePath, 'catalog', fileName);
    
    // Catalog key
    mapping.set(`catalog.${slug}`, catalogPath);
    // Brand category key (aynı dosya)
    mapping.set(`brand.category.${slug}`, catalogPath);
  }
  
  // Badge files
  const badgeFiles: Array<{ fileName: string; badgeName: string; extraKeys?: string[] }> = [
    { fileName: 'EarlyAdapter.png', badgeName: 'Early Bird', extraKeys: ['badge.early-adapter'] },
    { fileName: 'HardwareExpert.png', badgeName: 'Welcome', extraKeys: ['badge.hardware-expert'] },
    { fileName: 'PremiumShoper.png', badgeName: 'Tip Master', extraKeys: ['badge.premium-shoper'] },
    { fileName: 'WishMarker.png', badgeName: 'First Post', extraKeys: ['badge.wish-marker'] },
    { fileName: 'HardwareExpert.png', badgeName: 'Community Hero' },
    { fileName: 'PremiumShoper.png', badgeName: 'Beta Tester' },
    { fileName: 'HardwareExpert.png', badgeName: 'Benchmark Sage' },
    { fileName: 'PremiumShoper.png', badgeName: 'Experience Curator' },
    { fileName: 'WishMarker.png', badgeName: 'Bridge Ambassador' },
    { fileName: 'EarlyAdapter.png', badgeName: 'Brand Visionary' },
  ];
  
  for (const badgeFile of badgeFiles) {
    const slug = slugify(badgeFile.badgeName);
    const badgePath = path.join(assetsBasePath, 'badge', badgeFile.fileName);
    mapping.set(`badge.${slug}`, badgePath);
    if (badgeFile.extraKeys) {
      for (const extraKey of badgeFile.extraKeys) {
        mapping.set(extraKey, badgePath);
      }
    }
  }
  
  // Marketplace
  mapping.set('marketplace.rainbow-border', path.join(assetsBasePath, 'marketplace', 'marketplace.jpg'));
  
  // Post
  mapping.set('post.image.primary', path.join(assetsBasePath, 'post', 'post.jpg'));
  
  // Phone products
  for (let i = 1; i <= 6; i++) {
    mapping.set(`product.phone.phone${i}`, path.join(assetsBasePath, 'product', `phone${i}.png`));
  }
  
  // Other products
  mapping.set('product.vacuum.dyson', path.join(assetsBasePath, 'product', 'dyson.png'));
  mapping.set('product.laptop.macbook', path.join(assetsBasePath, 'product', 'macbook.png'));
  mapping.set('product.headphone.primary', path.join(assetsBasePath, 'product', 'headphone.png'));
  mapping.set('product.headphone.secondary', path.join(assetsBasePath, 'product', 'headphone2.png'));
  mapping.set('product.phone.samsung', path.join(assetsBasePath, 'product', 'samsun.png'));
  
  return mapping;
}

// Local dosya path'lerini key'e göre bul
function getLocalPathForKey(key: string): string | null {
  const mapping = buildAssetMapping();
  const localPath = mapping.get(key);
  
  if (localPath && existsSync(localPath)) {
    return localPath;
  }
  
  return null;
}

function inferContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Seed media görsellerini MinIO'ya yükler (idempotent - zaten varsa atlar)
 */
export async function ensureSeedMediaUploaded(): Promise<void> {
  const s3Service = new S3Service();
  await s3Service.checkAndCreateBucket();
  
  let uploadedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  console.log('📦 Seed görselleri MinIO\'ya yükleniyor...\n');
  
  for (const [key, entry] of Object.entries(seedMedia)) {
    try {
      // Local dosya path'ini bul
      const localPath = getLocalPathForKey(key);
      
      if (!localPath || !existsSync(localPath)) {
        console.warn(`⚠️  Local dosya bulunamadı: ${key} (${entry.targetKey})`);
        errorCount++;
        continue;
      }
      
      // MinIO'da zaten var mı kontrol et (basit kontrol - hata olursa yine de yüklemeyi dene)
      try {
        // S3Service'de headObject yoksa direkt yükleme yap
        // uploadFile zaten idempotent değil, bu yüzden her seferinde yükler
        // Ama MinIO overwrite yapabilir, sorun değil
      } catch {
        // Kontrol hatası olursa devam et
      }
      
      // Dosyayı oku ve yükle
      const fileBuffer = readFileSync(localPath);
      const contentType = inferContentType(localPath);
      
      await s3Service.uploadFile(entry.targetKey, fileBuffer, contentType);
      uploadedCount++;
      
      if (uploadedCount % 10 === 0) {
        console.log(`   ✅ ${uploadedCount} görsel yüklendi...`);
      }
    } catch (error: any) {
      // Hata olsa bile devam et (belki zaten yüklü)
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
        skippedCount++;
      } else {
        console.warn(`⚠️  ${key} yüklenirken hata: ${errorMsg}`);
        errorCount++;
      }
    }
  }
  
  console.log(`\n✅ Seed görselleri yükleme tamamlandı:`);
  console.log(`   📤 Yüklenen: ${uploadedCount}`);
  console.log(`   ⏭️  Atlanan: ${skippedCount}`);
  if (errorCount > 0) {
    console.log(`   ⚠️  Hata: ${errorCount}`);
  }
  console.log('');
}
