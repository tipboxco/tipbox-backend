/**
 * Seed ortamında kullanılan görselleri MinIO'ya yükler ve URL haritası üretir.
 * Script, tests klasöründeki statik görselleri bucket içindeki ilgili klasöre koyar.
 */

// Container içinde çalışıyorsak minio:9000 kullan, dışındaysa localhost:9000
// S3_ENDPOINT zaten .env'de set edilmiş olmalı (container içinde: minio:9000, dışında: localhost:9000)
// Burada değiştirmiyoruz, mevcut değeri kullanıyoruz

import { promises as fs } from 'fs';
import path from 'path';
import { S3Service } from '../src/infrastructure/s3/s3.service';

interface SeedAsset {
  key: string;
  localPath: string;
  targetKey: string;
  contentType: string;
  description?: string;
}

const TEST_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';
const TARGET_USER_ID = '248cc91f-b551-4ecc-a885-db1163571330';
const bucketName = process.env.S3_BUCKET_NAME || 'tipbox-media';

// Frontend'in erişeceği public MinIO endpoint'i
// Öncelik: SEED_MEDIA_BASE_URL > MINIO_PUBLIC_ENDPOINT > S3_ENDPOINT (minio:9000 -> localhost:9000) > http://localhost:9000
const rawPublicEndpoint =
  process.env.SEED_MEDIA_BASE_URL ||
  process.env.MINIO_PUBLIC_ENDPOINT ||
  process.env.S3_ENDPOINT ||
  'http://localhost:9000';
const publicEndpoint = rawPublicEndpoint.replace('minio:9000', 'localhost:9000').replace(/\/$/, '');
const publicBucketBase = `${publicEndpoint}/${bucketName}`;
const outputMapPath = path.join(__dirname, '../prisma/seed/seed-media-map.json');

const assetsBasePath = path.join(__dirname, '../tests/assets');

const catalogFiles = [
  'air conditioner.png',
  'cameras.png',
  'computers-tablets.png',
  'drone.png',
  'games.png',
  'headphones.png',
  'home appliances.png',
  'kucukev.png',
  'phones.png',
  'printers.png',
  'smart home devices.png',
  'TV.png',
  'otomotiv.png',
];

type BadgeFileConfig = {
  fileName: string;
  badgeName: string;
  extraKeys?: string[];
};

const badgeFiles: BadgeFileConfig[] = [
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

// Brand ve product için kullanılacak product görselleri
const productFiles = [
  { key: 'product.vacuum.dyson', fileName: 'dyson.png' },
  { key: 'product.laptop.macbook', fileName: 'macbook.png' },
  { key: 'product.headphone.primary', fileName: 'headphone.png' },
  { key: 'product.headphone.secondary', fileName: 'headphone2.png' },
  { key: 'product.phone.samsung', fileName: 'samsun.png' },
];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const inferContentType = (filePath: string): string => {
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
};

const seedAssets: SeedAsset[] = [
  {
    key: 'user.avatar.primary',
    localPath: path.join(assetsBasePath, 'userprofile', 'ozan.jpg'),
    targetKey: `profile-pictures/${TEST_USER_ID}/seed-avatar.jpg`,
    contentType: 'image/jpeg',
    description: 'Ana test kullanıcısının profil fotoğrafı',
  },
  {
    key: 'user.banner.primary',
    localPath: path.join(assetsBasePath, 'userprofile', 'banner.png'),
    targetKey: `profile-banners/${TEST_USER_ID}/seed-banner.png`,
    contentType: 'image/png',
    description: 'Ana test kullanıcısının profil banner görseli',
  },
];

seedAssets.push({
  key: 'user.avatar.market',
  localPath: path.join(assetsBasePath, 'userprofile', 'ozan.jpg'),
  targetKey: `profile-pictures/${TARGET_USER_ID}/seed-avatar.jpg`,
  contentType: 'image/jpeg',
  description: 'Market test kullanıcısının profil fotoğrafı (placeholder)',
});

const trustAvatarSeeds = [
  { key: 'user.avatar.trust1', fileName: 'useravatar.jpg' },
  { key: 'user.avatar.trust2', fileName: 'useravatar2.jpg' },
  { key: 'user.avatar.trust3', fileName: 'useravatar3.jpg' },
  { key: 'user.avatar.trust4', fileName: 'useravatar4.png' },
  { key: 'user.avatar.trust5', fileName: 'ozan.jpg' },
];

const trusterAvatarSeeds = [
  { key: 'user.avatar.truster1', fileName: 'useravatar2.jpg' },
  { key: 'user.avatar.truster2', fileName: 'useravatar3.jpg' },
  { key: 'user.avatar.truster3', fileName: 'useravatar4.png' },
];

for (const seed of [...trustAvatarSeeds, ...trusterAvatarSeeds]) {
  seedAssets.push({
    key: seed.key,
    localPath: path.join(assetsBasePath, 'userprofile', seed.fileName),
    targetKey: `userprofile/${seed.fileName}`,
    contentType: inferContentType(seed.fileName),
    description: `Trust/Truster avatar: ${seed.key}`,
  });
}

seedAssets.push({
  key: 'inventory.dyson-media',
  localPath: path.join(__dirname, '../tests/post.png'),
  targetKey: 'inventory/dyson-default.png',
  contentType: 'image/png',
  description: 'Dyson ürünleri için envanter görseli',
});

for (const fileName of catalogFiles) {
  const baseName = fileName.replace(path.extname(fileName), '');
  const slug = slugify(baseName || fileName);
  const ext = path.extname(fileName).toLowerCase() || '.png';
  
  // Catalog görselleri
  seedAssets.push({
    key: `catalog.${slug}`,
    localPath: path.join(assetsBasePath, 'catalog', fileName),
    targetKey: `catalog/${slug}${ext}`,
    contentType: inferContentType(fileName),
    description: `Kategori görseli: ${baseName}`,
  });
  
  // Brand category görselleri (catalog görsellerinden kopyala)
  // seed-media-map.json'da brand-categories/ klasörüne işaret ediyor
  seedAssets.push({
    key: `brand.category.${slug}`,
    localPath: path.join(assetsBasePath, 'catalog', fileName),
    targetKey: `brand-categories/${fileName}`, // Orijinal dosya adını koru (cameras.png, otomotiv.png)
    contentType: inferContentType(fileName),
    description: `Brand category görseli: ${baseName}`,
  });
}

// Badge görsellerini ekle (TEST_USER_ID için)
for (const badgeFile of badgeFiles) {
  const slug = slugify(badgeFile.badgeName);
  const targetFileName = badgeFile.fileName;
  seedAssets.push({
    key: `badge.${slug}`,
    localPath: path.join(assetsBasePath, 'badge', badgeFile.fileName),
    targetKey: `badges/custom/${targetFileName}`,
    contentType: inferContentType(badgeFile.fileName),
    description: `Badge görseli: ${badgeFile.badgeName} (custom path)`,
  });

  if (badgeFile.extraKeys) {
    for (const extraKey of badgeFile.extraKeys) {
      seedAssets.push({
        key: extraKey,
        localPath: path.join(assetsBasePath, 'badge', badgeFile.fileName),
        targetKey: `badges/custom/${targetFileName}`,
        contentType: inferContentType(badgeFile.fileName),
        description: `Ek badge görseli alias: ${extraKey}`,
      });
    }
  }
}

seedAssets.push({
  key: 'marketplace.rainbow-border',
  localPath: path.join(assetsBasePath, 'marketplace', 'marketplace.jpg'),
  targetKey: 'marketplace/rainbow-border.jpg',
  contentType: 'image/jpeg',
  description: 'Marketplace listing varsayılan görseli',
});

// Post görselini ekle (TEST_USER_ID için)
seedAssets.push({
  key: 'post.image.primary',
  localPath: path.join(assetsBasePath, 'post', 'post.jpg'),
  targetKey: `post-media/${TEST_USER_ID}/post.jpg`,
  contentType: 'image/jpeg',
  description: `Post görseli (User: ${TEST_USER_ID})`,
});

// Telefon görsellerini ekle (product.phone.phone1-6)
const phoneFiles = [
  { fileName: 'phone1.png', brand: 'Samsung' },
  { fileName: 'phone2.png', brand: 'iPhone' },
  { fileName: 'phone3.png', brand: 'Redmi' },
  { fileName: 'phone4.png', brand: 'Oppo' },
  { fileName: 'phone5.png', brand: 'Nokia' },
  { fileName: 'phone6.png', brand: 'Blackberry' },
];

for (const phoneFile of phoneFiles) {
  const phoneNumber = phoneFile.fileName.replace('phone', '').replace('.png', '');
  seedAssets.push({
    key: `product.phone.phone${phoneNumber}`,
    localPath: path.join(assetsBasePath, 'product', phoneFile.fileName),
    targetKey: `products/phones/phone${phoneNumber}.png`,
    contentType: 'image/png',
    description: `Telefon görseli: ${phoneFile.brand} (phone${phoneNumber})`,
  });
}

// Product görsellerini ekle (brand / product / mainCategory / SubCategory seed'lerinde kullanılacak)
for (const pf of productFiles) {
  seedAssets.push({
    key: pf.key,
    localPath: path.join(assetsBasePath, 'product', pf.fileName),
    targetKey: `products/${pf.fileName.toLowerCase()}`,
    contentType: inferContentType(pf.fileName),
    description: `Ürün görseli: ${pf.key}`,
  });
}


async function uploadSeedMedia(): Promise<void> {
  // Önce manuel görselleri ekle
  await addManualMediaAssets();
  
  const s3Service = new S3Service();
  // JSON'da sadece targetKey tutulacak, URL runtime'da oluşturulacak
  const uploadResults: Record<string, { targetKey: string }> = {};

  for (const asset of seedAssets) {
    try {
      await fs.access(asset.localPath);
    } catch {
      console.warn(`⚠️  Dosya bulunamadı, atlanıyor: ${asset.localPath}`);
      continue;
    }

    const fileBuffer = await fs.readFile(asset.localPath);
    const contentType = asset.contentType || inferContentType(asset.localPath);
    console.log(`\n☁️  Yükleniyor: ${asset.key}`);
    console.log(`   Kaynak: ${asset.localPath}`);
    console.log(`   Hedef:  ${asset.targetKey}`);

    const uploadedUrl = await s3Service.uploadFile(asset.targetKey, fileBuffer, contentType);
    const publicUrl = `${publicBucketBase}/${asset.targetKey}`;

    console.log(`✅ MinIO URL: ${uploadedUrl}`);
    console.log(`🌐 Public URL: ${publicUrl}`);

    // Sadece targetKey kaydediliyor, URL runtime'da oluşturulacak
    uploadResults[asset.key] = {
      targetKey: asset.targetKey,
    };
  }

  await fs.mkdir(path.dirname(outputMapPath), { recursive: true });
  await fs.writeFile(outputMapPath, JSON.stringify(uploadResults, null, 2), 'utf-8');

  console.log(`\n📄 seed-media-map güncellendi: ${outputMapPath}`);
  console.log(`ℹ️  URL'ler runtime'da ${publicEndpoint} endpoint'inden oluşturulacak`);
}

uploadSeedMedia()
  .then(() => {
    console.log('\n🎉 Seed görselleri başarıyla yüklendi.');
  })
  .catch((error) => {
    console.error('\n❌ Seed görselleri yüklenemedi:', error);
    process.exit(1);
  });

