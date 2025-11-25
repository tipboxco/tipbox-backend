/**
 * Seed ortamında kullanılan görselleri MinIO'ya yükler ve URL haritası üretir.
 * Script, tests klasöründeki statik görselleri bucket içindeki ilgili klasöre koyar.
 */

// Eğer docker dışından çalışıyorsak S3 endpoint'i localhost'a ayarla
if (!process.env.S3_ENDPOINT || process.env.S3_ENDPOINT === 'http://minio:9000') {
  process.env.S3_ENDPOINT = 'http://127.0.0.1:9000';
}

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
const publicEndpoint = (process.env.MINIO_PUBLIC_ENDPOINT || 'http://10.20.0.17:9000').replace(/\/$/, '');
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

const badgeFiles = [
  { fileName: 'EarlyAdapter.png', badgeName: 'Early Bird' },
  { fileName: 'HardwareExpert.png', badgeName: 'Welcome' },
  { fileName: 'PremiumShoper.png', badgeName: 'Tip Master' },
  { fileName: 'WishMarker.png', badgeName: 'First Post' },
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
  seedAssets.push({
    key: `catalog.${slug}`,
    localPath: path.join(assetsBasePath, 'catalog', fileName),
    targetKey: `catalog/${slug}${path.extname(fileName).toLowerCase() || '.png'}`,
    contentType: inferContentType(fileName),
    description: `Kategori görseli: ${baseName}`,
  });
}

// Badge görsellerini ekle (TEST_USER_ID için)
for (const badgeFile of badgeFiles) {
  const slug = slugify(badgeFile.badgeName);
  seedAssets.push({
    key: `badge.${slug}`,
    localPath: path.join(assetsBasePath, 'badge', badgeFile.fileName),
    targetKey: `badges/${TEST_USER_ID}/${slug}${path.extname(badgeFile.fileName).toLowerCase() || '.png'}`,
    contentType: inferContentType(badgeFile.fileName),
    description: `Badge görseli: ${badgeFile.badgeName} (User: ${TEST_USER_ID})`,
  });
}

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

async function uploadSeedMedia(): Promise<void> {
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

