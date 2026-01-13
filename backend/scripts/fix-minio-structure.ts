/**
 * MinIO Klasör Yapısını Düzelt ve Görselleri Yükle
 * 
 * Bu script tests/assets/ klasöründeki görselleri doğru MinIO yapısına upload eder.
 * 
 * DOĞRU KLASÖR YAPISI:
 * - UGC (User Generated Content):
 *   - profile-pictures/{userId}/seed-avatar.jpg
 *   - profile-banners/{userId}/seed-banner.png
 *   - posts/{postId}/image1.jpg (runtime'da oluşturulacak)
 *   - inventory/{inventoryId}/image1.jpg (runtime'da oluşturulacak)
 * 
 * - STATIC (Seed görselleri):
 *   - catalog/ (kategori görselleri)
 *   - brands/ (brand logo/banner)
 *   - products/ (ürün görselleri)
 *   - badges/ (badge görselleri)
 *   - events/ (event görselleri)
 *   - news/ (what's news)
 */

import { promises as fs } from 'fs';
import path from 'path';
import { S3Service } from '../src/infrastructure/s3/s3.service';

interface AssetMapping {
  key: string;           // Seed'de kullanılacak key (örn: user.avatar.omer)
  localPath: string;     // tests/assets/ içindeki path
  minioPath: string;     // MinIO'daki path (örn: profile-pictures/xxx/seed-avatar.jpg)
  contentType: string;
}

const mappings: AssetMapping[] = [];

// User ID'ler (seed.ts ile aynı)
const USER_IDS = {
  omer: '480f5de9-b691-4d70-a6a8-2789226f4e07',
  tuna: '11111111-1111-4111-a111-111111111111',
  mehmet: '22222222-2222-4222-a222-222222222222',
  ibrahim: '33333333-3333-4333-a333-333333333333',
  burakcan: '44444444-4444-4444-a444-444444444444',
  mihrac: '55555555-5555-4555-a555-555555555555',
  irem: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  furkan: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  aycan: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
  ozan: 'dddddddd-dddd-4ddd-dddd-dddddddddddd',
};

const inferContentType = (filePath: string): string => {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return types[ext] || 'application/octet-stream';
};

async function buildMappings() {
  const assetsPath = path.join(__dirname, '../tests/assets');
  
  console.log('📦 Asset mapping\'ler oluşturuluyor...\n');

  // 1. USER PROFILE → profile-pictures/{userId}/
  console.log('👤 User avatarlar...');
  const userProfilePath = path.join(assetsPath, 'userprofile');
  const avatarFiles: Record<string, { userId: string; key: string }> = {
    'omer.png': { userId: USER_IDS.omer, key: 'user.avatar.omer' },
    'mehmet.png': { userId: USER_IDS.mehmet, key: 'user.avatar.mehmet' },
    'burakcan.png': { userId: USER_IDS.burakcan, key: 'user.avatar.burakcan' },
    'mihrac.png': { userId: USER_IDS.mihrac, key: 'user.avatar.mihrac' },
    'furkan.png': { userId: USER_IDS.furkan, key: 'user.avatar.furkan' },
    'aycan.png': { userId: USER_IDS.aycan, key: 'user.avatar.aycan' },
    'ozan.png': { userId: USER_IDS.ozan, key: 'user.avatar.ozan' },
    'ozan.jpg': { userId: USER_IDS.ozan, key: 'user.avatar.ozan' },
    'banner.png': { userId: USER_IDS.omer, key: 'user.banner.primary' },
  };

  for (const [filename, config] of Object.entries(avatarFiles)) {
    const localPath = path.join(userProfilePath, filename);
    try {
      await fs.access(localPath);
      const ext = path.extname(filename);
      const isAvatar = filename !== 'banner.png';
      mappings.push({
        key: config.key,
        localPath,
        minioPath: isAvatar 
          ? `profile-pictures/${config.userId}/seed-avatar${ext}`
          : `profile-banners/${config.userId}/seed-banner${ext}`,
        contentType: inferContentType(localPath),
      });
    } catch {
      console.warn(`   ⚠️  ${filename} bulunamadı`);
    }
  }
  console.log(`   ✅ ${Object.keys(avatarFiles).length} avatar/banner mapping oluşturuldu`);

  // 2. BADGES → badges/custom/
  console.log('🏆 Badges...');
  await mapDirectory(
    path.join(assetsPath, 'badge'),
    'badges/custom',
    'badge'
  );

  // 3. BRAND BADGES → badges/brand/
  console.log('🏷️  Brand badges...');
  await mapDirectory(
    path.join(assetsPath, 'brandbadge'),
    'badges/brand',
    'badge.brand'
  );

  // 4. BRAND BANNERS → brands/banners/
  console.log('🎨 Brand banners...');
  const brandBannersPath = path.join(assetsPath, 'Brand_Banners');
  await mapDirectory(brandBannersPath, 'brands/banners', 'brand.banner');

  // 5. CATALOG → catalog/
  console.log('📂 Catalog...');
  await mapDirectory(
    path.join(assetsPath, 'catalog'),
    'catalog',
    'catalog'
  );

  // 6. EVENTS → events/
  console.log('🎉 Events...');
  await mapDirectory(
    path.join(assetsPath, 'events'),
    'events',
    'event'
  );

  // 7. PRODUCTS → products/seed/
  console.log('📦 Products...');
  await mapDirectory(
    path.join(assetsPath, 'product'),
    'products/seed',
    'product'
  );

  // 8. NEWS → news/
  console.log('📰 News...');
  await mapDirectory(
    path.join(assetsPath, 'WhatsNews'),
    'news',
    'news'
  );

  // 9. DEFAULT AVATAR → avatars/default/
  console.log('👤 Default avatar...');
  await mapDirectory(
    path.join(assetsPath, 'defaultavatar'),
    'avatars/default',
    'user.avatar.default'
  );

  console.log(`\n✅ Toplam ${mappings.length} mapping oluşturuldu\n`);
}

async function mapDirectory(localDir: string, minioDir: string, keyPrefix: string) {
  try {
    const files = await fs.readdir(localDir);
    let count = 0;
    
    for (const file of files) {
      if (file.startsWith('.')) continue;
      
      const localPath = path.join(localDir, file);
      const stat = await fs.stat(localPath);
      
      if (stat.isFile()) {
        const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
        const cleanName = nameWithoutExt.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        
        mappings.push({
          key: `${keyPrefix}.${cleanName}`,
          localPath,
          minioPath: `${minioDir}/${file}`,
          contentType: inferContentType(localPath),
        });
        count++;
      }
    }
    
    console.log(`   ✅ ${count} dosya eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  ${localDir} okunamadı:`, error instanceof Error ? error.message : error);
  }
}

async function uploadToMinIO() {
  console.log('📤 MinIO\'ya upload başlıyor...\n');
  
  const s3Service = new S3Service();
  await s3Service.checkAndCreateBucket();
  
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const mapping of mappings) {
    try {
      // Dosyayı oku
      const fileBuffer = await fs.readFile(mapping.localPath);
      
      // MinIO'ya yükle
      await s3Service.uploadFile(mapping.minioPath, fileBuffer, mapping.contentType);
      
      uploaded++;
      if (uploaded % 10 === 0) {
        console.log(`   ⏳ ${uploaded}/${mappings.length} yüklendi...`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        skipped++;
      } else {
        console.error(`   ❌ ${mapping.minioPath} yüklenemedi:`, error);
        failed++;
      }
    }
  }
  
  console.log(`\n✅ Upload tamamlandı:`);
  console.log(`   - Yüklenen: ${uploaded}`);
  console.log(`   - Atlanan: ${skipped}`);
  console.log(`   - Başarısız: ${failed}`);
}

async function generateSeedMediaMap() {
  console.log('\n📝 seed-media-map.json oluşturuluyor...');
  
  const mediaMap: Record<string, { targetKey: string }> = {};
  
  for (const mapping of mappings) {
    mediaMap[mapping.key] = {
      targetKey: mapping.minioPath,
    };
  }
  
  const outputPath = path.join(__dirname, '../prisma/seed/seed-media-map.json');
  await fs.writeFile(outputPath, JSON.stringify(mediaMap, null, 2), 'utf-8');
  
  console.log(`✅ ${Object.keys(mediaMap).length} mapping kaydedildi: ${outputPath}`);
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║     🔧 MinIO KLASÖR YAPISI DÜZELTİCİ               ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  try {
    // 1. Mapping'leri oluştur
    await buildMappings();
    
    // 2. MinIO'ya upload et
    await uploadToMinIO();
    
    // 3. seed-media-map.json oluştur
    await generateSeedMediaMap();
    
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║          ✨ İŞLEM BAŞARILI! ✨                     ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    
    console.log('📋 Sonraki adımlar:');
    console.log('   1. docker-compose exec backend npx ts-node scripts/clear-and-seed.ts');
    console.log('   2. Test: http://localhost/media/profile-pictures/xxx/seed-avatar.jpg\n');
    
  } catch (error) {
    console.error('\n❌ HATA:', error);
    process.exit(1);
  }
}

main();

