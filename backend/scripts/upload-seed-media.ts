/**
 * Seed ortamında kullanılan görselleri MinIO'ya yükler ve URL haritası üretir.
 * Script, tests/assets klasöründeki tüm görselleri klasör yapısına göre sistematik olarak yükler.
 * 
 * Güncel Klasör Yapısı:
 * - avatars/ → avatars/
 * - badge/ → badges/custom/
 * - badge/brandbadges/ → badges/brand/
 * - badge/eventbadges/ → badges/event/
 * - brands/banners/ → brands/banners/
 * - brands/electronics/ → brands/catalog/
 * - brands/cosmetic/ → brands/catalog/
 * - catalog/ → catalog/
 * - catalog/main-category/ → product-catalog/main-categories/
 * - events/ → events/
 * - explore/ → explore/
 * - marketplace/ → marketplace/
 * - onboarding/ → onboarding/
 * - post/ → post-media/
 * - post/post-images/ → posts/seed-images/
 * - primepass/ → primepass/
 * - userprofile/ → profile-pictures/ ve profile-banners/
 * - whatsnews/ → news/
 */

import { promises as fs } from 'fs';
import path from 'path';
import { S3Service } from '../src/infrastructure/s3/s3.service';
import { getPublicMediaBaseUrl } from '../src/infrastructure/config/media.config';

interface SeedAsset {
  key: string;
  localPath: string;
  targetKey: string;
  contentType: string;
  description?: string;
}

const TEST_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';
const bucketName = process.env.S3_BUCKET_NAME || 'tipbox-media';

// Public base (object root). Örn:
// - Direct MinIO: http://192.168.1.116:9000/tipbox-media
// - Nginx proxy:  https://api-test.tipbox.co/media
const publicBucketBase = getPublicMediaBaseUrl().replace(/\/$/, '');
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
  try {
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
  } catch (error) {
    // Directory doesn't exist or can't be read
  }

  return arrayOfFiles;
}

/**
 * Dosyanın resim dosyası olup olmadığını kontrol eder
 */
function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
}

const seedAssets: SeedAsset[] = [];

/**
 * Tüm görselleri sistematik olarak ekle
 */
async function buildSeedAssets(): Promise<void> {
  console.log('📦 Seed görselleri taranıyor...\n');

  // 1. AVATARS → avatars/
  console.log('👤 Avatar görselleri ekleniyor...');
  const avatarsPath = path.join(assetsBasePath, 'avatars');
  try {
    const avatarFiles = await fs.readdir(avatarsPath);
    for (const file of avatarFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(avatarsPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile() && isImageFile(filePath)) {
        const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
        const key = `avatar.${slugify(nameWithoutExt)}`;
        seedAssets.push({
          key,
          localPath: filePath,
          targetKey: `avatars/${file}`,
          contentType: inferContentType(filePath),
          description: `Avatar görseli: ${file}`,
        });
      }
    }
    console.log(`   ✅ ${avatarFiles.filter(f => !f.startsWith('.') && isImageFile(f)).length} avatar görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Avatars klasörü okunamadı: ${error}`);
  }

  // 2. BADGE GÖRSELLERİ → badges/custom/
  console.log('🏆 Badge görselleri ekleniyor...');
  const badgePath = path.join(assetsBasePath, 'badge');
  try {
    const badgeFiles = await fs.readdir(badgePath);
    for (const file of badgeFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(badgePath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile() && isImageFile(filePath)) {
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
    const fileCount = badgeFiles.filter(f => !f.startsWith('.') && !['brandbadges', 'eventbadges'].includes(f)).length;
    console.log(`   ✅ ${fileCount} badge görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Badge klasörü okunamadı: ${error}`);
  }

  // 3. BRAND BADGE GÖRSELLERİ → badges/brand/ (badge/brandbadges/)
  console.log('🏷️  Brand badge görselleri ekleniyor...');
  const brandBadgePath = path.join(assetsBasePath, 'badge', 'brandbadges');
  try {
    const brandBadgeFiles = await fs.readdir(brandBadgePath);
    for (const file of brandBadgeFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(brandBadgePath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile() && isImageFile(filePath)) {
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

  // 4. EVENT BADGE GÖRSELLERİ → badges/event/ (badge/eventbadges/)
  console.log('🎫 Event badge görselleri ekleniyor...');
  const eventBadgePath = path.join(assetsBasePath, 'badge', 'eventbadges');
  try {
    const eventBadgeFiles = await fs.readdir(eventBadgePath);
    for (const file of eventBadgeFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(eventBadgePath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile() && isImageFile(filePath)) {
        const key = `badge.event.${slugify(file.replace(/\.[^/.]+$/, ''))}`;
        seedAssets.push({
          key,
          localPath: filePath,
          targetKey: `badges/event/${file}`,
          contentType: inferContentType(filePath),
          description: `Event badge görseli: ${file}`,
        });
      }
    }
    console.log(`   ✅ ${eventBadgeFiles.filter(f => !f.startsWith('.')).length} event badge görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Event badge klasörü okunamadı: ${error}`);
  }

  // 5. BRAND BANNERS → brands/banners/ (brands/banners/)
  console.log('🎨 Brand banner görselleri ekleniyor...');
  const brandBannersPath = path.join(assetsBasePath, 'brands', 'banners');
  try {
    const bannerFiles = await fs.readdir(brandBannersPath);
    for (const file of bannerFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(brandBannersPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile() && isImageFile(filePath)) {
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
    console.warn(`   ⚠️  Brand banners klasörü okunamadı: ${error}`);
  }

  // 6. BRANDS/ELECTRONICS → brands/catalog/
  console.log('📱 Electronics brand catalog görselleri ekleniyor...');
  const brandsElectronicsPath = path.join(assetsBasePath, 'brands', 'electronics');
  try {
    const electronicFiles = await fs.readdir(brandsElectronicsPath);
    for (const file of electronicFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(brandsElectronicsPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile() && isImageFile(filePath)) {
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

  // 7. BRANDS/COSMETIC → brands/catalog/
  console.log('💄 Cosmetic brand catalog görselleri ekleniyor...');
  const brandsCosmeticPath = path.join(assetsBasePath, 'brands', 'cosmetic');
  try {
    const cosmeticFiles = await fs.readdir(brandsCosmeticPath);
    for (const file of cosmeticFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(brandsCosmeticPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile() && isImageFile(filePath)) {
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
    console.warn(`   ⚠️  Brands/cosmetic klasörü okunamadı: ${error}`);
  }

  // 8. CATALOG → catalog/ (sadece ana klasördeki dosyalar)
  console.log('📁 Catalog görselleri ekleniyor...');
  const catalogPath = path.join(assetsBasePath, 'catalog');
  try {
    const catalogFiles = await fs.readdir(catalogPath);
    for (const file of catalogFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(catalogPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile() && isImageFile(filePath)) {
        const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
        const slug = slugify(nameWithoutExt);
        
        // Catalog görseli
        seedAssets.push({
          key: `catalog.${slug}`,
          localPath: filePath,
          targetKey: `catalog/${file}`,
          contentType: inferContentType(filePath),
          description: `Catalog görseli: ${nameWithoutExt}`,
        });
        
        // Brand category görseli (aynı dosya)
        seedAssets.push({
          key: `brand.category.${slug}`,
          localPath: filePath,
          targetKey: `brand-categories/${file}`,
          contentType: inferContentType(filePath),
          description: `Brand category görseli: ${nameWithoutExt}`,
        });
      }
    }
    const fileCount = catalogFiles.filter(f => !f.startsWith('.') && f !== 'main-category').length;
    console.log(`   ✅ ${fileCount} catalog görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Catalog klasörü okunamadı: ${error}`);
  }

  // 9. CATALOG/MAIN-CATEGORY → product-catalog/main-categories/ (recursive)
  console.log('📦 Main Category görselleri ekleniyor...');
  const mainCategoryPath = path.join(assetsBasePath, 'catalog', 'main-category');
  try {
    const allMainCategoryFiles = await getAllFiles(mainCategoryPath);
    const imageFiles = allMainCategoryFiles.filter(f => isImageFile(f));
    
    for (const filePath of imageFiles) {
      const fileName = path.basename(filePath);
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
      const relativePath = path.relative(mainCategoryPath, filePath);
      
      // Key: main-category.category-name veya main-category.subcategory.item-name
      const pathParts = relativePath.replace(/\\/g, '/').split('/');
      let keyParts = ['main-category'];
      for (const part of pathParts) {
        if (part !== fileName) {
          keyParts.push(slugify(part));
        }
      }
      keyParts.push(slugify(nameWithoutExt));
      const key = keyParts.join('.');
      
      seedAssets.push({
        key,
        localPath: filePath,
        targetKey: `product-catalog/main-categories/${relativePath.replace(/\\/g, '/')}`,
        contentType: inferContentType(filePath),
        description: `Main Category görseli: ${relativePath}`,
      });
    }
    console.log(`   ✅ ${imageFiles.length} main category görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Main-category klasörü okunamadı: ${error}`);
  }

  // 10. EVENTS → events/ (tüm alt klasörler dahil)
  console.log('🎉 Event görselleri ekleniyor...');
  const eventsPath = path.join(assetsBasePath, 'events');
  try {
    const allEventFiles = await getAllFiles(eventsPath);
    const imageFiles = allEventFiles.filter(f => isImageFile(f));
    
    for (const filePath of imageFiles) {
      const fileName = path.basename(filePath);
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
      const relativePath = path.relative(eventsPath, filePath);
      const key = `event.${slugify(nameWithoutExt)}`;
      
      seedAssets.push({
        key,
        localPath: filePath,
        targetKey: `events/${relativePath.replace(/\\/g, '/')}`,
        contentType: inferContentType(filePath),
        description: `Event görseli: ${fileName}`,
      });
    }
    console.log(`   ✅ ${imageFiles.length} event görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Events klasörü okunamadı: ${error}`);
  }

  // 11. EXPLORE → explore/
  console.log('🔍 Explore görselleri ekleniyor...');
  const explorePath = path.join(assetsBasePath, 'explore');
  try {
    const exploreFiles = await fs.readdir(explorePath);
    for (const file of exploreFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(explorePath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile() && isImageFile(filePath)) {
        const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
        const key = `explore.${slugify(nameWithoutExt)}`;
        seedAssets.push({
          key,
          localPath: filePath,
          targetKey: `explore/${file}`,
          contentType: inferContentType(filePath),
          description: `Explore görseli: ${file}`,
        });
      }
    }
    console.log(`   ✅ ${exploreFiles.filter(f => !f.startsWith('.')).length} explore görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Explore klasörü okunamadı: ${error}`);
  }

  // 12. MARKETPLACE → marketplace/
  console.log('🛒 Marketplace görselleri ekleniyor...');
  const marketplacePath = path.join(assetsBasePath, 'marketplace');
  try {
    const marketplaceFiles = await fs.readdir(marketplacePath);
    for (const file of marketplaceFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(marketplacePath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile() && isImageFile(filePath)) {
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

  // 13. ONBOARDING → onboarding/
  console.log('📱 Onboarding görselleri ekleniyor...');
  const onboardingPath = path.join(assetsBasePath, 'onboarding');
  try {
    const onboardingFiles = await fs.readdir(onboardingPath);
    for (const file of onboardingFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(onboardingPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile() && isImageFile(filePath)) {
        const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
        const key = `onboarding.${slugify(nameWithoutExt)}`;
        seedAssets.push({
          key,
          localPath: filePath,
          targetKey: `onboarding/${file}`,
          contentType: inferContentType(filePath),
          description: `Onboarding görseli: ${file}`,
        });
      }
    }
    console.log(`   ✅ ${onboardingFiles.filter(f => !f.startsWith('.')).length} onboarding görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Onboarding klasörü okunamadı: ${error}`);
  }

  // 14. POST → post-media/ (sadece ana klasördeki dosyalar)
  console.log('📝 Post görselleri ekleniyor...');
  const postPath = path.join(assetsBasePath, 'post');
  try {
    const postFiles = await fs.readdir(postPath);
    for (const file of postFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(postPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile() && isImageFile(filePath)) {
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
    const fileCount = postFiles.filter(f => !f.startsWith('.') && f !== 'post-images').length;
    console.log(`   ✅ ${fileCount} post görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Post klasörü okunamadı: ${error}`);
  }

  // 15. POST/POST-IMAGES → posts/seed-images/
  console.log('🖼️  Post Images görselleri ekleniyor...');
  const postImagesPath = path.join(assetsBasePath, 'post', 'post-images');
  try {
    const postImageFiles = await fs.readdir(postImagesPath);
    for (const file of postImageFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(postImagesPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile() && isImageFile(filePath)) {
        const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
        const key = `product.${slugify(nameWithoutExt)}`;
        seedAssets.push({
          key,
          localPath: filePath,
          targetKey: `posts/seed-images/${file}`,
          contentType: inferContentType(filePath),
          description: `Post image: ${file}`,
        });
      }
    }
    console.log(`   ✅ ${postImageFiles.filter(f => !f.startsWith('.')).length} post image görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Post-images klasörü okunamadı: ${error}`);
  }

  // 16. PRIMEPASS → primepass/
  console.log('⭐ Primepass görselleri ekleniyor...');
  const primepassPath = path.join(assetsBasePath, 'primepass');
  try {
    const primepassFiles = await fs.readdir(primepassPath);
    for (const file of primepassFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(primepassPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile() && isImageFile(filePath)) {
        const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
        const key = `primepass.${slugify(nameWithoutExt)}`;
        seedAssets.push({
          key,
          localPath: filePath,
          targetKey: `primepass/${file}`,
          contentType: inferContentType(filePath),
          description: `Primepass görseli: ${file}`,
        });
      }
    }
    console.log(`   ✅ ${primepassFiles.filter(f => !f.startsWith('.')).length} primepass görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Primepass klasörü okunamadı: ${error}`);
  }

  // 17. USERPROFILE → profile-pictures/ ve profile-banners/
  console.log('👤 User profile görselleri ekleniyor...');
  const userProfilePath = path.join(assetsBasePath, 'userprofile');
  try {
    const profileFiles = await fs.readdir(userProfilePath);
    
    // Kullanıcı ID'leri
    const JULIA_USER_ID = '99999999-9999-4999-9999-999999999999';
    
    // Avatar eşleştirmesi - Gerçek dosya isimleri ile SEED_USERS'daki userId'ler
    const avatarMapping: Record<string, { key: string; userId: string }> = {
      // İsme özel avatarlar
      'omer.png': { key: 'user.avatar.omer', userId: '480f5de9-b691-4d70-a6a8-2789226f4e07' },
      'mehmet.png': { key: 'user.avatar.mehmet', userId: '22222222-2222-4222-a222-222222222222' },
      'burakcan.png': { key: 'user.avatar.burakcan', userId: '44444444-4444-4444-a444-444444444444' },
      'mihrac.png': { key: 'user.avatar.mihrac', userId: '55555555-5555-4555-a555-555555555555' },
      'furkan.png': { key: 'user.avatar.furkan', userId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb' },
      'aycan.png': { key: 'user.avatar.aycan', userId: 'cccccccc-cccc-4ccc-cccc-cccccccccccc' },
      'ozan.jpg': { key: 'user.avatar.ozan', userId: JULIA_USER_ID },
      'ozan.png': { key: 'user.avatar.ozan-png', userId: JULIA_USER_ID },
      
      // Generic avatars
      'man-user.jpg': { key: 'user.avatar.man1', userId: '11111111-1111-4111-a111-111111111111' },
      'man-user-2.png': { key: 'user.avatar.man2', userId: '33333333-3333-4333-a333-333333333333' },
      'man-user-3.jpg': { key: 'user.avatar.man3', userId: '10000000-0000-4000-a000-000000000002' },
      'man-user-4.jpg': { key: 'user.avatar.man4', userId: '10000000-0000-4000-a000-000000000004' },
      'man-user-5.jpg': { key: 'user.avatar.man5', userId: '10000000-0000-4000-a000-000000000006' },
      'woman-user.jpg': { key: 'user.avatar.woman1', userId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' },
      'woman-user-2.jpg': { key: 'user.avatar.woman2', userId: '10000000-0000-4000-a000-000000000001' },
      'woman-user-3.jpg': { key: 'user.avatar.woman3', userId: '10000000-0000-4000-a000-000000000003' },
      'woman-user-4.jpg': { key: 'user.avatar.woman4', userId: '10000000-0000-4000-a000-000000000005' },
      'woman-user-5.jpg': { key: 'user.avatar.woman5', userId: '10000000-0000-4000-a000-000000000007' },
    };
    
    for (const file of profileFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(userProfilePath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile() && isImageFile(filePath)) {
        if (file === 'banner.png') {
          seedAssets.push({
            key: 'user.banner.primary',
            localPath: filePath,
            targetKey: `profile-banners/${TEST_USER_ID}/seed-banner.png`,
            contentType: inferContentType(filePath),
            description: `User banner: ${file}`,
          });
        } else if (avatarMapping[file]) {
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
          // Eşleşmeyen dosyalar için genel key
          const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
          const key = `user.avatar.${slugify(nameWithoutExt)}`;
          seedAssets.push({
            key,
            localPath: filePath,
            targetKey: `profile-pictures/generic/${file}`,
            contentType: inferContentType(filePath),
            description: `User avatar (generic): ${file}`,
          });
        }
      }
    }
    console.log(`   ✅ ${profileFiles.filter(f => !f.startsWith('.')).length} user profile görseli eklendi`);
  } catch (error) {
    console.warn(`   ⚠️  Userprofile klasörü okunamadı: ${error}`);
  }

  // 18. WHATSNEWS → news/
  console.log('📰 What\'s News görselleri ekleniyor...');
  const whatsNewsPath = path.join(assetsBasePath, 'whatsnews');
  try {
    const newsFiles = await fs.readdir(whatsNewsPath);
    for (const file of newsFiles) {
      if (file.startsWith('.')) continue;
      const filePath = path.join(whatsNewsPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile() && isImageFile(filePath)) {
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
    console.warn(`   ⚠️  Whatsnews klasörü okunamadı: ${error}`);
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
  let errorCount = 0;

  for (const asset of seedAssets) {
    try {
      await fs.access(asset.localPath);
    } catch {
      console.warn(`⚠️  Dosya bulunamadı, atlanıyor: ${asset.localPath}`);
      errorCount++;
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

    try {
      const fileBuffer = await fs.readFile(asset.localPath);
      const contentType = asset.contentType || inferContentType(asset.localPath);
      
      console.log(`☁️  Yükleniyor: ${asset.key}`);
      console.log(`   Kaynak: ${path.relative(process.cwd(), asset.localPath)}`);
      console.log(`   Hedef:  ${asset.targetKey}`);

      await s3Service.uploadFile(asset.targetKey, fileBuffer, contentType);
      const publicUrl = `${publicBucketBase}/${asset.targetKey}`;

      console.log(`✅ Yüklendi`);
      console.log(`🌐 Public URL: ${publicUrl}\n`);

      uploadResults[asset.key] = {
        targetKey: asset.targetKey,
      };
      uploadedCount++;
    } catch (uploadError) {
      console.error(`❌ Yükleme hatası: ${asset.key}`, uploadError);
      errorCount++;
    }
  }

  await fs.mkdir(path.dirname(outputMapPath), { recursive: true });
  await fs.writeFile(outputMapPath, JSON.stringify(uploadResults, null, 2), 'utf-8');

  console.log(`\n📄 seed-media-map.json güncellendi: ${outputMapPath}`);
  console.log(`ℹ️  URL'ler runtime'da ${publicBucketBase} base'inden oluşturulacak`);
  console.log(`\n📊 Yükleme Özeti:`);
  console.log(`   ✅ Yeni yüklenen: ${uploadedCount}`);
  console.log(`   ⏭️  Zaten mevcut (atlandı): ${skippedCount}`);
  console.log(`   ❌ Hata: ${errorCount}`);
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
