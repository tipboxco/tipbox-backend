/**
 * Seed ortamında kullanılan görselleri MinIO'ya yükler ve URL haritası üretir.
 * Script, tests/assets klasöründeki tüm görselleri klasör yapısına göre sistematik olarak yükler.
 * 
 * Klasör Yapısı:
 * - badge/ → badges/custom/
 * - brandbadge/ → badges/brand/
 * - Brand Banners/ → brands/banners/
 * - brands/electronics/ → brands/catalog/
 * - brands/Cosmetic/ → brands/catalog/
 * - catalog/ → catalog/ ve brand-categories/
 * - event/ → event/
 * - marketplace/ → marketplace/
 * - post/ → post-media/
 * - product/ → products/
 * - userprofile/ → profile-pictures/ ve profile-banners/
 * - WhatsNews/ → news/
 * - Apple/ → products/apple/
 */

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
const rawPublicEndpoint =
  process.env.SEED_MEDIA_BASE_URL ||
  process.env.MINIO_PUBLIC_ENDPOINT ||
  process.env.S3_ENDPOINT ||
  'http://localhost:9000';
const publicEndpoint = rawPublicEndpoint.replace('minio:9000', 'localhost:9000').replace(/\/$/, '');
const publicBucketBase = `${publicEndpoint}/${bucketName}`;
const outputMapPath = path.join(__dirname, '../prisma/seed/seed-media-map.json');

const assetsBasePath = path.join(__dirname, '../tests/assets');

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

/**
 * Bir klasördeki tüm dosyaları recursive olarak bulur
 */
async function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): Promise<string[]> {
  const files = await fs.readdir(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      arrayOfFiles = await getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  }

  return arrayOfFiles;
}

/**
 * Dosya adından key oluşturur
 */
function generateKeyFromPath(filePath: string, basePath: string): string {
  const relativePath = path.relative(basePath, filePath);
  const normalized = relativePath.replace(/\\/g, '/').replace(/\//g, '.');
  const withoutExt = normalized.replace(/\.[^/.]+$/, '');
  return withoutExt.toLowerCase();
}

const seedAssets: SeedAsset[] = [];

/**
 * Tüm görselleri sistematik olarak ekle
 */
async function buildSeedAssets(): Promise<void> {
  console.log('📦 Seed görselleri taranıyor...\n');

  // 1. BADGE GÖRSELLERİ → badges/custom/
  console.log('🏆 Badge görselleri ekleniyor...');
  const badgePath = path.join(assetsBasePath, 'badge');
  try {
    const badgeFiles = await fs.readdir(badgePath);
    for (const file of badgeFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(badgePath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        const key = `badge.${slugify(file.replace(/\.[^/.]+$/, ''))}`;
        seedAssets.push({
          key,
          localPath: filePath,
          targetKey: `badges/custom/${file}`,
          contentType: inferContentType(filePath),
          description: `Badge görseli: ${file}`,
        });
      }
    }
    console.log(`   ✅ ${badgeFiles.filter(f => !f.startsWith('.')).length} badge görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Badge klasörü okunamadı: ${error}`);
  }

  // 2. BRAND BADGE GÖRSELLERİ → badges/brand/
  console.log('🏷️  Brand badge görselleri ekleniyor...');
  const brandBadgePath = path.join(assetsBasePath, 'brandbadge');
  try {
    const brandBadgeFiles = await fs.readdir(brandBadgePath);
    for (const file of brandBadgeFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(brandBadgePath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        const key = `badge.brand.${slugify(file.replace(/\.[^/.]+$/, ''))}`;
        seedAssets.push({
          key,
          localPath: filePath,
          targetKey: `badges/brand/${file}`,
          contentType: inferContentType(filePath),
          description: `Brand badge görseli: ${file}`,
        });
      }
    }
    console.log(`   ✅ ${brandBadgeFiles.filter(f => !f.startsWith('.')).length} brand badge görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Brand badge klasörü okunamadı: ${error}`);
  }

  // 3. BRAND BANNERS → brands/banners/
  console.log('🎨 Brand banner görselleri ekleniyor...');
  const brandBannersPath = path.join(assetsBasePath, 'Brand Banners');
  const brandBannersPathUnderscore = path.join(assetsBasePath, 'Brand_Banners');
  let effectiveBrandBannersPath: string | null = null;
  
  try {
    try {
      await fs.access(brandBannersPath);
      effectiveBrandBannersPath = brandBannersPath;
    } catch {
      try {
        await fs.access(brandBannersPathUnderscore);
        effectiveBrandBannersPath = brandBannersPathUnderscore;
      } catch {
        console.warn(`   ⚠️  Brand Banners klasörü bulunamadı (Brand Banners veya Brand_Banners)`);
        throw new Error('Brand Banners klasörü bulunamadı');
      }
    }
    
    const bannerFiles = await fs.readdir(effectiveBrandBannersPath);
    for (const file of bannerFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(effectiveBrandBannersPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        // brandpage-electronic-apple.jpg → brand.banner.electronic-apple
        const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
        const key = `brand.banner.${slugify(nameWithoutExt.replace('brandpage-', ''))}`;
        seedAssets.push({
          key,
          localPath: filePath,
          targetKey: `brands/banners/${file}`,
          contentType: inferContentType(filePath),
          description: `Brand banner: ${file}`,
        });
      }
    }
    console.log(`   ✅ ${bannerFiles.filter(f => !f.startsWith('.')).length} brand banner görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Brand Banners klasörü okunamadı: ${error}`);
  }

  // 4. BRANDS/ELECTRONICS → brands/catalog/
  console.log('📱 Electronics brand catalog görselleri ekleniyor...');
  const brandsElectronicsPath = path.join(assetsBasePath, 'brands', 'electronics');
  try {
    const electronicFiles = await fs.readdir(brandsElectronicsPath);
    for (const file of electronicFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(brandsElectronicsPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        // brandcatalog-electronic-apple.png → brand.catalog.electronic-apple
        const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
        const key = `brand.catalog.${slugify(nameWithoutExt.replace('brandcatalog-', ''))}`;
        seedAssets.push({
          key,
          localPath: filePath,
          targetKey: `brands/catalog/${file}`,
          contentType: inferContentType(filePath),
          description: `Electronics brand catalog: ${file}`,
        });
      }
    }
    console.log(`   ✅ ${electronicFiles.filter(f => !f.startsWith('.')).length} electronics brand catalog görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Brands/electronics klasörü okunamadı: ${error}`);
  }

  // 5. BRANDS/COSMETIC → brands/catalog/
  console.log('💄 Cosmetic brand catalog görselleri ekleniyor...');
  const brandsCosmeticPath = path.join(assetsBasePath, 'brands', 'Cosmetic');
  const brandsCosmeticPathLowercase = path.join(assetsBasePath, 'brands', 'cosmetic');
  let effectiveBrandsCosmeticPath: string | null = null;
  
  try {
    try {
      await fs.access(brandsCosmeticPath);
      effectiveBrandsCosmeticPath = brandsCosmeticPath;
    } catch {
      try {
        await fs.access(brandsCosmeticPathLowercase);
        effectiveBrandsCosmeticPath = brandsCosmeticPathLowercase;
      } catch {
        console.warn(`   ⚠️  Brands/Cosmetic klasörü bulunamadı (Cosmetic veya cosmetic)`);
        throw new Error('Brands/Cosmetic klasörü bulunamadı');
      }
    }
    
    const cosmeticFiles = await fs.readdir(effectiveBrandsCosmeticPath);
    for (const file of cosmeticFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(effectiveBrandsCosmeticPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        // brandcatalog-cosmetic-chanel.png → brand.catalog.cosmetic-chanel
        const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
        const key = `brand.catalog.${slugify(nameWithoutExt.replace('brandcatalog-', ''))}`;
        seedAssets.push({
          key,
          localPath: filePath,
          targetKey: `brands/catalog/${file}`,
          contentType: inferContentType(filePath),
          description: `Cosmetic brand catalog: ${file}`,
        });
      }
    }
    console.log(`   ✅ ${cosmeticFiles.filter(f => !f.startsWith('.')).length} cosmetic brand catalog görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Brands/Cosmetic klasörü okunamadı: ${error}`);
  }

  // 6. CATALOG → catalog/ ve brand-categories/
  console.log('📁 Catalog görselleri ekleniyor...');
  const catalogPath = path.join(assetsBasePath, 'catalog');
  try {
    const catalogFiles = await fs.readdir(catalogPath);
    for (const file of catalogFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(catalogPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
        const slug = slugify(nameWithoutExt);
        
        // Catalog görseli
        seedAssets.push({
          key: `catalog.${slug}`,
          localPath: filePath,
          targetKey: `catalog/${slug}${path.extname(file)}`,
          contentType: inferContentType(filePath),
          description: `Catalog görseli: ${nameWithoutExt}`,
        });
        
        // Brand category görseli (aynı dosya)
        seedAssets.push({
          key: `brand.category.${slug}`,
          localPath: filePath,
          targetKey: `brand-categories/${file}`, // Orijinal dosya adını koru
          contentType: inferContentType(filePath),
          description: `Brand category görseli: ${nameWithoutExt}`,
        });
      }
    }
    console.log(`   ✅ ${catalogFiles.filter(f => !f.startsWith('.')).length} catalog görseli eklendi (her biri 2 kez: catalog + brand-categories)`);
  } catch (error) {
    console.warn(`   ⚠️  Catalog klasörü okunamadı: ${error}`);
  }

  // 7. EVENT/EVENTS → events/
  console.log('🎉 Event görselleri ekleniyor...');
  const eventPath = path.join(assetsBasePath, 'event');
  const eventsPath = path.join(assetsBasePath, 'events');
  let effectiveEventPath: string | null = null;
  
  try {
    try {
      await fs.access(eventPath);
      effectiveEventPath = eventPath;
    } catch {
      try {
        await fs.access(eventsPath);
        effectiveEventPath = eventsPath;
      } catch {
        console.warn(`   ⚠️  Event klasörü bulunamadı (event veya events)`);
        throw new Error('Event klasörü bulunamadı');
      }
    }
    
    const eventFiles = await fs.readdir(effectiveEventPath);
    for (const file of eventFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(effectiveEventPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
        const key = `event.${slugify(nameWithoutExt)}`;
        seedAssets.push({
          key,
          localPath: filePath,
          targetKey: `events/${file}`, // events/ klasörüne yükle
          contentType: inferContentType(filePath),
          description: `Event görseli: ${file}`,
        });
      }
    }
    console.log(`   ✅ ${eventFiles.filter(f => !f.startsWith('.')).length} event görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Event klasörü okunamadı: ${error}`);
  }

  // 8. MARKETPLACE → marketplace/
  console.log('🛒 Marketplace görselleri ekleniyor...');
  const marketplacePath = path.join(assetsBasePath, 'marketplace');
  try {
    const marketplaceFiles = await fs.readdir(marketplacePath);
    for (const file of marketplaceFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(marketplacePath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
        const key = `marketplace.${slugify(nameWithoutExt)}`;
        seedAssets.push({
          key,
          localPath: filePath,
          targetKey: `marketplace/${file}`,
          contentType: inferContentType(filePath),
          description: `Marketplace görseli: ${file}`,
        });
      }
    }
    console.log(`   ✅ ${marketplaceFiles.filter(f => !f.startsWith('.')).length} marketplace görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Marketplace klasörü okunamadı: ${error}`);
  }

  // 9. POST → post-media/
  console.log('📝 Post görselleri ekleniyor...');
  const postPath = path.join(assetsBasePath, 'post');
  try {
    const postFiles = await fs.readdir(postPath);
    for (const file of postFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(postPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
        const key = `post.${slugify(nameWithoutExt)}`;
        seedAssets.push({
          key,
          localPath: filePath,
          targetKey: `post-media/${TEST_USER_ID}/${file}`,
          contentType: inferContentType(filePath),
          description: `Post görseli: ${file}`,
        });
      }
    }
    console.log(`   ✅ ${postFiles.filter(f => !f.startsWith('.')).length} post görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Post klasörü okunamadı: ${error}`);
  }

  // 10. PRODUCT → products/
  console.log('📦 Product görselleri ekleniyor...');
  const productPath = path.join(assetsBasePath, 'product');
  try {
    const productFiles = await fs.readdir(productPath);
    for (const file of productFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(productPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
        
        // Özel product mapping'leri
        if (file.startsWith('phone')) {
          const phoneNumber = file.match(/phone(\d+)/)?.[1] || '';
          seedAssets.push({
            key: `product.phone.phone${phoneNumber}`,
            localPath: filePath,
            targetKey: `products/phones/phone${phoneNumber}${path.extname(file)}`,
            contentType: inferContentType(filePath),
            description: `Phone product: ${file}`,
          });
        } else if (file === 'dyson.png') {
          seedAssets.push({
            key: 'product.vacuum.dyson',
            localPath: filePath,
            targetKey: `products/${file}`,
            contentType: inferContentType(filePath),
            description: `Product: ${file}`,
          });
        } else if (file === 'macbook.png') {
          seedAssets.push({
            key: 'product.laptop.macbook',
            localPath: filePath,
            targetKey: `products/${file}`,
            contentType: inferContentType(filePath),
            description: `Product: ${file}`,
          });
        } else if (file === 'headphone.png') {
          seedAssets.push({
            key: 'product.headphone.primary',
            localPath: filePath,
            targetKey: `products/${file}`,
            contentType: inferContentType(filePath),
            description: `Product: ${file}`,
          });
        } else if (file === 'headphone2.png') {
          seedAssets.push({
            key: 'product.headphone.secondary',
            localPath: filePath,
            targetKey: `products/${file}`,
            contentType: inferContentType(filePath),
            description: `Product: ${file}`,
          });
        } else if (file === 'samsun.png') {
          seedAssets.push({
            key: 'product.phone.samsung',
            localPath: filePath,
            targetKey: `products/${file}`,
            contentType: inferContentType(filePath),
            description: `Product: ${file}`,
          });
        } else if (file === 'smartwatch.png') {
          seedAssets.push({
            key: 'product.smartwatch',
            localPath: filePath,
            targetKey: `products/${file}`,
            contentType: inferContentType(filePath),
            description: `Product: ${file}`,
          });
        } else if (file.startsWith('electronic-post-') || file.startsWith('makeup-post-')) {
          // Post görselleri için ayrı key
          const key = `product.post.${slugify(nameWithoutExt)}`;
          seedAssets.push({
            key,
            localPath: filePath,
            targetKey: `products/posts/${file}`,
            contentType: inferContentType(filePath),
            description: `Product post görseli: ${file}`,
          });
        } else {
          // Diğer product görselleri
          const key = `product.${slugify(nameWithoutExt)}`;
          seedAssets.push({
            key,
            localPath: filePath,
            targetKey: `products/${file}`,
            contentType: inferContentType(filePath),
            description: `Product: ${file}`,
          });
        }
      }
    }
    console.log(`   ✅ ${productFiles.filter(f => !f.startsWith('.')).length} product görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Product klasörü okunamadı: ${error}`);
  }

  // 11. USERPROFILE → profile-pictures/ ve profile-banners/
  console.log('👤 User profile görselleri ekleniyor...');
  const userProfilePath = path.join(assetsBasePath, 'userprofile');
  try {
    const profileFiles = await fs.readdir(userProfilePath);
    
    // Kullanıcı ID'leri
    const JULIA_USER_ID = '99999999-9999-4999-9999-999999999999';
    const TRUST_USER_IDS = [
      '11111111-1111-4111-a111-111111111111',
      '22222222-2222-4222-a222-222222222222',
      '33333333-3333-4333-a333-333333333333',
      '44444444-4444-4444-a444-444444444444',
      '55555555-5555-4555-a555-555555555555',
    ];
    const TRUSTER_USER_IDS = [
      'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
      'cccccccc-cccc-4ccc-cccc-cccccccccccc',
    ];
    const COMMUNITY_COACH_USER_ID = '66666666-6666-4666-a666-666666666666';
    
    // Avatar eşleştirmesi
    const avatarMapping: Record<string, { key: string; userId: string }> = {
      'ozan.jpg': { key: 'user.avatar.primary', userId: TEST_USER_ID },
      'man-user.jpg': { key: 'user.avatar.market', userId: TARGET_USER_ID },
      'woman-user.jpg': { key: 'user.avatar.julia', userId: JULIA_USER_ID },
      'man-user-2.png': { key: 'user.avatar.trust1', userId: TRUST_USER_IDS[0] },
      'man-user-3.jpg': { key: 'user.avatar.trust2', userId: TRUST_USER_IDS[1] },
      'man-user-4.jpg': { key: 'user.avatar.trust3', userId: TRUST_USER_IDS[2] },
      'man-user-5.jpg': { key: 'user.avatar.trust4', userId: TRUST_USER_IDS[3] },
      'woman-user-2.jpg': { key: 'user.avatar.truster1', userId: TRUSTER_USER_IDS[0] },
      'woman-user-3.jpg': { key: 'user.avatar.truster2', userId: TRUSTER_USER_IDS[1] },
      'woman-user-4.jpg': { key: 'user.avatar.truster3', userId: TRUSTER_USER_IDS[2] },
      'woman-user-5.jpg': { key: 'user.avatar.coach', userId: COMMUNITY_COACH_USER_ID },
    };
    
    for (const file of profileFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(userProfilePath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        if (file === 'banner.png') {
          seedAssets.push({
            key: 'user.banner.primary',
            localPath: filePath,
            targetKey: `profile-banners/${TEST_USER_ID}/seed-banner.png`,
            contentType: inferContentType(filePath),
            description: `User banner: ${file}`,
          });
        } else if (avatarMapping[file]) {
          // Eşleştirilmiş avatar dosyası
          const mapping = avatarMapping[file];
          const fileExt = path.extname(file).toLowerCase().replace('.', '');
          seedAssets.push({
            key: mapping.key,
            localPath: filePath,
            targetKey: `profile-pictures/${mapping.userId}/seed-avatar.${fileExt}`,
            contentType: inferContentType(filePath),
            description: `User avatar: ${file} (${mapping.userId})`,
          });
        } else {
          // Diğer user avatar'ları (eski format için geriye dönük uyumluluk)
          const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
          const key = `user.avatar.${slugify(nameWithoutExt)}`;
          seedAssets.push({
            key,
            localPath: filePath,
            targetKey: `userprofile/${file}`,
            contentType: inferContentType(filePath),
            description: `User avatar: ${file}`,
          });
        }
      }
    }
    console.log(`   ✅ ${profileFiles.filter(f => !f.startsWith('.')).length} user profile görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Userprofile klasörü okunamadı: ${error}`);
  }

  // 11b. DEFAULT AVATAR → avatars/default/
  console.log('👤 Default avatar görseli ekleniyor...');
  const defaultAvatarPath = path.join(assetsBasePath, 'defaultavatar');
  try {
    const defaultAvatarFiles = await fs.readdir(defaultAvatarPath);
    for (const file of defaultAvatarFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(defaultAvatarPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        if (file === 'default-useravatar.png') {
          seedAssets.push({
            key: 'user.avatar.default',
            localPath: filePath,
            targetKey: `avatars/default/default-useravatar.png`,
            contentType: inferContentType(filePath),
            description: `Default user avatar: ${file}`,
          });
        } else {
          // Diğer default avatar dosyaları
          const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
          const key = `user.avatar.default.${slugify(nameWithoutExt)}`;
          seedAssets.push({
            key,
            localPath: filePath,
            targetKey: `avatars/default/${file}`,
            contentType: inferContentType(filePath),
            description: `Default avatar: ${file}`,
          });
        }
      }
    }
    console.log(`   ✅ ${defaultAvatarFiles.filter(f => !f.startsWith('.')).length} default avatar görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Defaultavatar klasörü okunamadı: ${error}`);
  }

  // 12. WHATSNEWS → news/
  console.log('📰 What\'s News görselleri ekleniyor...');
  const whatsNewsPath = path.join(assetsBasePath, 'WhatsNews');
  try {
    const newsFiles = await fs.readdir(whatsNewsPath);
    for (const file of newsFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(whatsNewsPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
        const key = `news.${slugify(nameWithoutExt)}`;
        seedAssets.push({
          key,
          localPath: filePath,
          targetKey: `news/${file}`,
          contentType: inferContentType(filePath),
          description: `What's News görseli: ${file}`,
        });
      }
    }
    console.log(`   ✅ ${newsFiles.filter(f => !f.startsWith('.')).length} news görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  WhatsNews klasörü okunamadı: ${error}`);
  }

  // 13. APPLE PRODUCTS → products/apple/
  console.log('🍎 Apple product görselleri ekleniyor...');
  const applePath = path.join(assetsBasePath, 'Apple');
  const applePathUnderscore = path.join(assetsBasePath, 'Apple_Products');
  let effectiveApplePath: string | null = null;
  
  try {
    try {
      await fs.access(applePath);
      effectiveApplePath = applePath;
    } catch {
      try {
        await fs.access(applePathUnderscore);
        effectiveApplePath = applePathUnderscore;
      } catch {
        console.warn(`   ⚠️  Apple klasörü bulunamadı (Apple veya Apple_Products)`);
        throw new Error('Apple klasörü bulunamadı');
      }
    }
    
    const appleFiles = await fs.readdir(effectiveApplePath);
    for (const file of appleFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(effectiveApplePath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        // apple-product-airpods4.png → product.apple.airpods4
        const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
        const productName = nameWithoutExt.replace('apple-product-', '');
        const slugifiedProductName = slugify(productName);
        const key = `product.apple.${slugifiedProductName}`;
        // targetKey için orijinal dosya adını kullan (MinIO'da büyük/küçük harf korunmalı)
        seedAssets.push({
          key,
          localPath: filePath,
          targetKey: `products/apple/${productName}${path.extname(file)}`,
          contentType: inferContentType(filePath),
          description: `Apple product: ${file}`,
        });
      }
    }
    console.log(`   ✅ ${appleFiles.filter(f => !f.startsWith('.')).length} Apple product görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Apple klasörü okunamadı: ${error}`);
  }

  console.log(`\n✅ Toplam ${seedAssets.length} görsel eklendi\n`);
}

async function uploadSeedMedia(): Promise<void> {
  // Tüm görselleri ekle
  await buildSeedAssets();
  
  const s3Service = new S3Service();
  const uploadResults: Record<string, { targetKey: string }> = {};

  console.log('📤 Görseller MinIO\'ya yükleniyor...\n');

  let uploadedCount = 0;
  let skippedCount = 0;

  for (const asset of seedAssets) {
    try {
      await fs.access(asset.localPath);
    } catch {
      console.warn(`⚠️  Dosya bulunamadı, atlanıyor: ${asset.localPath}`);
      continue;
    }

    // MinIO'da dosyanın mevcut olup olmadığını kontrol et
    const exists = await s3Service.fileExists(asset.targetKey);
    
    if (exists) {
      // Dosya zaten mevcut, atla
      skippedCount++;
      uploadResults[asset.key] = {
        targetKey: asset.targetKey,
      };
      continue;
    }

    const fileBuffer = await fs.readFile(asset.localPath);
    const contentType = asset.contentType || inferContentType(asset.localPath);
    
    console.log(`☁️  Yükleniyor: ${asset.key}`);
    console.log(`   Kaynak: ${path.relative(process.cwd(), asset.localPath)}`);
    console.log(`   Hedef:  ${asset.targetKey}`);

    const uploadedUrl = await s3Service.uploadFile(asset.targetKey, fileBuffer, contentType);
    const publicUrl = `${publicBucketBase}/${asset.targetKey}`;

    console.log(`✅ MinIO URL: ${uploadedUrl}`);
    console.log(`🌐 Public URL: ${publicUrl}\n`);

    uploadResults[asset.key] = {
      targetKey: asset.targetKey,
    };
    uploadedCount++;
  }

  await fs.mkdir(path.dirname(outputMapPath), { recursive: true });
  await fs.writeFile(outputMapPath, JSON.stringify(uploadResults, null, 2), 'utf-8');

  console.log(`\n📄 seed-media-map.json güncellendi: ${outputMapPath}`);
  console.log(`ℹ️  URL'ler runtime'da ${publicEndpoint} endpoint'inden oluşturulacak`);
  console.log(`\n📊 Yükleme Özeti:`);
  console.log(`   ✅ Yeni yüklenen: ${uploadedCount}`);
  console.log(`   ⏭️  Zaten mevcut (atlandı): ${skippedCount}`);
  console.log(`   📦 Toplam: ${Object.keys(uploadResults).length} görsel`);
}

uploadSeedMedia()
  .then(() => {
    console.log('\n🎉 Seed görselleri başarıyla yüklendi.');
  })
  .catch((error) => {
    console.error('\n❌ Seed görselleri yüklenemedi:', error);
    process.exit(1);
  });
