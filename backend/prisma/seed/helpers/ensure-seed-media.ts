/**
 * Seed media görsellerini MinIO'ya yükler
 * Bu fonksiyon seed.ts başında çağrılarak tüm görsellerin MinIO'da olduğundan emin olur
 */

import { S3Service } from '../../../src/infrastructure/s3/s3.service';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import path from 'path';
import mediaMap from '../seed-media-map.json';

type MediaEntry = {
  targetKey: string;
};

const seedMedia = mediaMap as Record<string, MediaEntry>;

// upload-seed-media.ts ile aynı klasör yapısını kullan
// seed-media-map.json'dan key'e göre local path bulur
function buildAssetMapping(): Map<string, string> {
  const assetsBasePath = path.join(__dirname, '../../../tests/assets');
  const mapping = new Map<string, string>();
  
  const fs = require('fs');
  const existsSync = fs.existsSync || require('fs').existsSync;
  
  // Debug: Container içinde dosya yolu kontrolü
  if (process.env.DEBUG_SEED_MEDIA === 'true') {
    console.log(`🔍 Debug: assetsBasePath = ${assetsBasePath}`);
    console.log(`🔍 Debug: __dirname = ${__dirname}`);
    console.log(`🔍 Debug: Dosya yolu var mı? ${existsSync(assetsBasePath)}`);
  }
  
  const slugify = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  
  // seed-media-map.json'daki key'lere göre local path'leri bul
  // Bu mapping upload-seed-media.ts ile aynı mantıkta çalışmalı
  
  // 1. BADGE → badges/custom/
  try {
    const badgePath = path.join(assetsBasePath, 'badge');
    if (existsSync(badgePath)) {
      const files = fs.readdirSync(badgePath);
      for (const file of files) {
        if (file.startsWith('.')) continue;
        const filePath = path.join(badgePath, file);
        if (existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const key = `badge.${slugify(file.replace(/\.[^/.]+$/, ''))}`;
          mapping.set(key, filePath);
        }
      }
    }
  } catch (error) {
    // Klasör yoksa atla
  }
  
  // 2. BRAND BADGE → badges/brand/
  try {
    const brandBadgePath = path.join(assetsBasePath, 'brandbadge');
    if (existsSync(brandBadgePath)) {
      const files = fs.readdirSync(brandBadgePath);
      for (const file of files) {
        if (file.startsWith('.')) continue;
        const filePath = path.join(brandBadgePath, file);
        if (existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const key = `badge.brand.${slugify(file.replace(/\.[^/.]+$/, ''))}`;
          mapping.set(key, filePath);
        }
      }
    }
  } catch (error) {
    // Klasör yoksa atla
  }
  
  // 3. BRAND BANNERS → brands/banners/
  // Önce "Brand Banners" klasörünü dene, yoksa "Brand_Banners" klasörünü dene
  const brandBannersPaths = [
    path.join(assetsBasePath, 'Brand Banners'),
    path.join(assetsBasePath, 'Brand_Banners'),
  ];
  
  for (const brandBannersPath of brandBannersPaths) {
    try {
      if (existsSync(brandBannersPath)) {
        const files = fs.readdirSync(brandBannersPath);
        for (const file of files) {
          if (file.startsWith('.')) continue;
          const filePath = path.join(brandBannersPath, file);
          if (existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
            // brandpage-electronic-apple.jpg -> brand.banner.electronic-apple
            // marshall.jpg -> brand.banner.marshall
            let keyName = nameWithoutExt.replace('brandpage-', '');
            const key = `brand.banner.${slugify(keyName)}`;
            mapping.set(key, filePath);
          }
        }
        break; // İlk bulunan klasörü kullan
      }
    } catch (error) {
      // Klasör yoksa diğerini dene
      continue;
    }
  }
  
  // 4. BRANDS/ELECTRONICS → brands/catalog/
  try {
    const brandsElectronicsPath = path.join(assetsBasePath, 'brands', 'electronics');
    if (existsSync(brandsElectronicsPath)) {
      const files = fs.readdirSync(brandsElectronicsPath);
      for (const file of files) {
        if (file.startsWith('.')) continue;
        const filePath = path.join(brandsElectronicsPath, file);
        if (existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
          const key = `brand.catalog.${slugify(nameWithoutExt.replace('brandcatalog-', ''))}`;
          mapping.set(key, filePath);
        }
      }
    }
  } catch (error) {
    // Klasör yoksa atla
  }
  
  // 5. BRANDS/COSMETIC → brands/catalog/
  // Önce "Cosmetic" klasörünü dene, yoksa "cosmetic" klasörünü dene
  const brandsCosmeticPaths = [
    path.join(assetsBasePath, 'brands', 'Cosmetic'),
    path.join(assetsBasePath, 'brands', 'cosmetic'),
  ];
  
  for (const brandsCosmeticPath of brandsCosmeticPaths) {
    try {
      if (existsSync(brandsCosmeticPath)) {
        const files = fs.readdirSync(brandsCosmeticPath);
        for (const file of files) {
          if (file.startsWith('.')) continue;
          const filePath = path.join(brandsCosmeticPath, file);
          if (existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
            const key = `brand.catalog.${slugify(nameWithoutExt.replace('brandcatalog-', ''))}`;
            mapping.set(key, filePath);
          }
        }
        break; // İlk bulunan klasörü kullan
      }
    } catch (error) {
      // Klasör yoksa diğerini dene
      continue;
    }
  }
  
  // 6. CATALOG → catalog/ ve brand-categories/
  try {
    const catalogPath = path.join(assetsBasePath, 'catalog');
    if (existsSync(catalogPath)) {
      const files = fs.readdirSync(catalogPath);
      for (const file of files) {
        if (file.startsWith('.')) continue;
        const filePath = path.join(catalogPath, file);
        if (existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
          const slug = slugify(nameWithoutExt);
          mapping.set(`catalog.${slug}`, filePath);
          mapping.set(`brand.category.${slug}`, filePath);
        }
      }
    }
  } catch (error) {
    // Klasör yoksa atla
  }

  // 6a. CATALOG MAIN-CATEGORY → catalog/main-category/ (sadece birinci seviye PNG dosyaları)
  try {
    const catalogMainCategoryPath = path.join(assetsBasePath, 'catalog', 'main-category');
    if (existsSync(catalogMainCategoryPath)) {
      const items = fs.readdirSync(catalogMainCategoryPath);
      for (const item of items) {
        if (item.startsWith('.')) continue;
        const itemPath = path.join(catalogMainCategoryPath, item);
        if (existsSync(itemPath) && fs.statSync(itemPath).isFile() && /\.(png|jpg|jpeg)$/i.test(item)) {
          const nameWithoutExt = item.replace(/\.[^/.]+$/, '');
          const slug = slugify(nameWithoutExt);
          mapping.set(`catalog.main-category.${slug}`, itemPath);
        }
      }
    }
  } catch (error) {
    // Klasör yoksa atla
  }

  // 6b. PRODUCT CATALOG → product-catalog/ (hierarchical structure)
  try {
    const productCatalogPath = path.join(assetsBasePath, 'Product Catalog', 'Main Category');
    if (existsSync(productCatalogPath)) {
      // Recursive function to scan Product Catalog directory
      const scanProductCatalog = (dirPath: string, relativePath: string = ''): void => {
        try {
          const items = fs.readdirSync(dirPath);
          for (const item of items) {
            if (item.startsWith('.')) continue;
            
            const itemPath = path.join(dirPath, item);
            const itemStat = fs.statSync(itemPath);
            
            if (itemStat.isFile() && /\.(png|jpg|jpeg)$/i.test(item)) {
              // File found - create mapping
              const nameWithoutExt = item.replace(/\.[^/.]+$/, '');
              const currentPath = relativePath ? `${relativePath}/${item}` : item;
              
              // Determine key type based on path depth
              const pathParts = currentPath.split('/').filter(p => p);
              
              if (pathParts.length === 1) {
                // Main category level: Main Category/electronic.png
                // Dosya ismini slugify et ama özel durumları handle et
                let slug = slugify(nameWithoutExt);
                // Özel durumlar: Appliances.png -> appliances, Automotive-Motorcycle.png -> automotive-motorcycle
                // Dosya ismi zaten doğru formatta olabilir
                const key = `product-catalog.main-category.${slug}`;
                mapping.set(key, itemPath);
              } else if (pathParts.length === 2) {
                // Sub-category level: Main Category/Cosmetics/hair-care.png
                const categorySlug = slugify(pathParts[0]);
                const fileSlug = slugify(nameWithoutExt);
                const key = `product-catalog.sub-category.${categorySlug}.${fileSlug}`;
                mapping.set(key, itemPath);
              } else if (pathParts.length === 3) {
                // Product group level: Main Category/Cosmetics/Hair Styling Group/hair-sprays.png
                const categorySlug = slugify(pathParts[0]);
                const groupSlug = slugify(pathParts[1].replace(/\s+Group$/, ''));
                const fileSlug = slugify(nameWithoutExt);
                const key = `product-catalog.product-group.${categorySlug}.${groupSlug}.${fileSlug}`;
                mapping.set(key, itemPath);
              } else if (pathParts.length >= 4) {
                // Product level: Main Category/Cosmetics/Hair Styling Group/Hair Sprays/product-name.png
                const categorySlug = slugify(pathParts[0]);
                const groupSlug = slugify(pathParts[1].replace(/\s+Group$/, ''));
                const subGroupSlug = slugify(pathParts[2]);
                const productSlug = slugify(nameWithoutExt);
                const key = `product-catalog.product.${categorySlug}.${groupSlug}.${subGroupSlug}.${productSlug}`;
                mapping.set(key, itemPath);
              }
            } else if (itemStat.isDirectory()) {
              // Recursively scan subdirectories
              const newRelativePath = relativePath ? `${relativePath}/${item}` : item;
              scanProductCatalog(itemPath, newRelativePath);
            }
          }
        } catch (error) {
          // Skip if error reading directory
        }
      };
      
      scanProductCatalog(productCatalogPath);
    }
  } catch (error) {
    // Klasör yoksa atla
  }
  
  // 7. EVENT/EVENTS → event/
  try {
    const eventPath = path.join(assetsBasePath, 'event');
    const eventsPath = path.join(assetsBasePath, 'events');
    let effectiveEventPath: string | null = null;

    if (existsSync(eventPath)) {
      effectiveEventPath = eventPath;
    } else if (existsSync(eventsPath)) {
      effectiveEventPath = eventsPath;
    }

    if (effectiveEventPath) {
      const files = fs.readdirSync(effectiveEventPath);
      for (const file of files) {
        if (file.startsWith('.')) continue;
        const filePath = path.join(effectiveEventPath, file);
        if (existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
          const key = `event.${slugify(nameWithoutExt)}`;
          mapping.set(key, filePath);
        }
      }
    }
  } catch (error) {
    // Klasör yoksa atla
  }
  
  // 8. MARKETPLACE → marketplace/
  try {
    const marketplacePath = path.join(assetsBasePath, 'marketplace');
    if (existsSync(marketplacePath)) {
      const files = fs.readdirSync(marketplacePath);
      for (const file of files) {
        if (file.startsWith('.')) continue;
        const filePath = path.join(marketplacePath, file);
        if (existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
          const key = `marketplace.${slugify(nameWithoutExt)}`;
          mapping.set(key, filePath);
        }
      }
    }
  } catch (error) {
    // Klasör yoksa atla
  }
  
  // 9. POST → post-media/
  try {
    const postPath = path.join(assetsBasePath, 'post');
    if (existsSync(postPath)) {
      const files = fs.readdirSync(postPath);
      for (const file of files) {
        if (file.startsWith('.')) continue;
        const filePath = path.join(postPath, file);
        if (existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
          const key = `post.${slugify(nameWithoutExt)}`;
          mapping.set(key, filePath);
        }
      }
    }
  } catch (error) {
    // Klasör yoksa atla
  }
  
  // 10. PRODUCT → products/
  try {
    const productPath = path.join(assetsBasePath, 'product');
    if (existsSync(productPath)) {
      const files = fs.readdirSync(productPath);
      for (const file of files) {
        if (file.startsWith('.')) continue;
        const filePath = path.join(productPath, file);
        if (existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
          
          if (file.startsWith('phone')) {
            const phoneNumber = file.match(/phone(\d+)/)?.[1] || '';
            mapping.set(`product.phone.phone${phoneNumber}`, filePath);
          } else if (file === 'dyson.png') {
            mapping.set('product.vacuum.dyson', filePath);
          } else if (file === 'macbook.png') {
            mapping.set('product.laptop.macbook', filePath);
          } else if (file === 'headphone.png') {
            mapping.set('product.headphone.primary', filePath);
          } else if (file === 'headphone2.png') {
            mapping.set('product.headphone.secondary', filePath);
          } else if (file === 'samsun.png') {
            mapping.set('product.phone.samsung', filePath);
          } else if (file === 'smartwatch.png') {
            mapping.set('product.smartwatch', filePath);
            mapping.set('product.watch.smartwatch', filePath); // Alternatif key
          } else if (file.startsWith('electronic-post-') || file.startsWith('makeup-post-')) {
            // Post görselleri hem post media hem de product görseli olarak kullanılabilir
            const postKey = `product.post.${slugify(nameWithoutExt)}`;
            mapping.set(postKey, filePath);
            // Ayrıca product görseli olarak da ekle (feed akışında kullanılabilir)
            const productKey = `product.${slugify(nameWithoutExt)}`;
            mapping.set(productKey, filePath);
          } else {
            const key = `product.${slugify(nameWithoutExt)}`;
            mapping.set(key, filePath);
          }
        }
      }
    }
  } catch (error) {
    // Klasör yoksa atla
  }
  
  // 11. USERPROFILE → profile-pictures/ ve profile-banners/
  // tests/assets/userprofile/ dosya adları ile seed key eşleştirmesi (SEED_USERS avatarKey ile uyumlu)
  try {
    const userProfilePath = path.join(assetsBasePath, 'userprofile');
    if (existsSync(userProfilePath)) {
      const files = fs.readdirSync(userProfilePath);
      const fileToKey: Record<string, string> = {
        'omer.png': 'user.avatar.omer',
        'mehmet.png': 'user.avatar.mehmet',
        'burakcan.png': 'user.avatar.burakcan',
        'mihrac.png': 'user.avatar.mihrac',
        'furkan.png': 'user.avatar.furkan',
        'aycan.png': 'user.avatar.aycan',
        'ozan.jpg': 'user.avatar.ozan',
        'ozan.png': 'user.avatar.ozan',
        'man-user.jpg': 'user.avatar.man1',
        'man-user-2.png': 'user.avatar.man2',
        'man-user-3.jpg': 'user.avatar.man3',
        'man-user-4.jpg': 'user.avatar.man4',
        'man-user-5.jpg': 'user.avatar.man5',
        'woman-user.jpg': 'user.avatar.woman1',
        'woman-user-2.jpg': 'user.avatar.woman2',
        'woman-user-3.jpg': 'user.avatar.woman3',
        'woman-user-4.jpg': 'user.avatar.woman4',
        'woman-user-5.jpg': 'user.avatar.woman5',
        'banner.png': 'user.banner.primary',
      };
      for (const file of files) {
        if (file.startsWith('.')) continue;
        const filePath = path.join(userProfilePath, file);
        if (existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const key = fileToKey[file];
          if (key) {
            if (key === 'user.avatar.ozan' && file === 'ozan.png' && mapping.has(key)) continue;
            if (!mapping.has(key)) mapping.set(key, filePath);
          }
        }
      }
    }
  } catch (error) {
    // Klasör yoksa atla
  }
  
  // 11b. DEFAULT AVATAR → avatars/default/
  try {
    const defaultAvatarPath = path.join(assetsBasePath, 'defaultavatar');
    if (existsSync(defaultAvatarPath)) {
      const files = fs.readdirSync(defaultAvatarPath);
      for (const file of files) {
        if (file.startsWith('.')) continue;
        const filePath = path.join(defaultAvatarPath, file);
        if (existsSync(filePath) && fs.statSync(filePath).isFile()) {
          if (file === 'default-useravatar.png') {
            mapping.set('user.avatar.default', filePath);
          } else {
            const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
            const key = `user.avatar.default.${slugify(nameWithoutExt)}`;
            mapping.set(key, filePath);
          }
        }
      }
    }
  } catch (error) {
    // Klasör yoksa atla
  }
  
  // 12. WHATSNEWS → news/
  try {
    const whatsNewsPath = path.join(assetsBasePath, 'WhatsNews');
    if (existsSync(whatsNewsPath)) {
      const files = fs.readdirSync(whatsNewsPath);
      for (const file of files) {
        if (file.startsWith('.')) continue;
        const filePath = path.join(whatsNewsPath, file);
        if (existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
          const key = `news.${slugify(nameWithoutExt)}`;
          mapping.set(key, filePath);
        }
      }
    }
  } catch (error) {
    // Klasör yoksa atla
  }
  
  // 13. APPLE PRODUCTS → products/apple/
  // Önce "Apple_Products" klasörünü dene, yoksa "Apple" klasörünü dene
  const applePaths = [
    path.join(assetsBasePath, 'Apple_Products'),
    path.join(assetsBasePath, 'Apple'),
  ];
  
  for (const applePath of applePaths) {
    try {
      if (existsSync(applePath)) {
        const files = fs.readdirSync(applePath);
        for (const file of files) {
          if (file.startsWith('.')) continue;
          const filePath = path.join(applePath, file);
          if (existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const nameWithoutExt = file.replace(/\.[^/.]+$/, '');
            // apple-product-airpods4.png -> product.apple.airpods4
            const productName = nameWithoutExt.replace('apple-product-', '');
            const key = `product.apple.${slugify(productName)}`;
            mapping.set(key, filePath);
          }
        }
        break; // İlk bulunan klasörü kullan
      }
    } catch (error) {
      // Klasör yoksa diğerini dene
      continue;
    }
  }
  
  return mapping;
}

// Local dosya path'lerini key'e göre bul
function getLocalPathForKey(key: string): string | null {
  const assetsBasePath = path.join(__dirname, '../../../tests/assets');
  
  // Önce buildAssetMapping'den bak
  const mapping = buildAssetMapping();
  let localPath = mapping.get(key);
  
  // Eğer mapping'de bulunamazsa, seed-media-map.json'daki targetKey'den dosya adını çıkar ve ara
  if (!localPath || !existsSync(localPath)) {
    const entry = seedMedia[key];
    if (entry && entry.targetKey) {
      // targetKey'den dosya adını çıkar (örn: "badges/custom/EarlyAdapter.png" -> "EarlyAdapter.png")
      const fileName = entry.targetKey.split('/').pop();
      if (fileName) {
        // Dosya adından extension'ı kaldır
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
        const ext = path.extname(fileName);
        
        // Farklı klasörlerde ara
        const searchPaths = [
          path.join(assetsBasePath, 'badge', fileName),
          path.join(assetsBasePath, 'badge', nameWithoutExt + '.png'),
          path.join(assetsBasePath, 'badge', nameWithoutExt + '.jpg'),
          path.join(assetsBasePath, 'brandbadge', fileName),
          path.join(assetsBasePath, 'brandbadge', nameWithoutExt + '.png'),
          path.join(assetsBasePath, 'Brand_Banners', fileName),
          path.join(assetsBasePath, 'Brand Banners', fileName),
          path.join(assetsBasePath, 'brands', 'electronics', fileName),
          path.join(assetsBasePath, 'brands', 'Cosmetic', fileName),
          path.join(assetsBasePath, 'brands', 'cosmetic', fileName),
          path.join(assetsBasePath, 'catalog', fileName),
          path.join(assetsBasePath, 'catalog', 'main-category', fileName),
          path.join(assetsBasePath, 'event', fileName),
          path.join(assetsBasePath, 'events', fileName),
          path.join(assetsBasePath, 'marketplace', fileName),
          path.join(assetsBasePath, 'post', fileName),
          path.join(assetsBasePath, 'product', fileName),
          path.join(assetsBasePath, 'userprofile', fileName),
          path.join(assetsBasePath, 'defaultavatar', fileName),
          path.join(assetsBasePath, 'WhatsNews', fileName),
          path.join(assetsBasePath, 'Apple_Products', fileName),
          path.join(assetsBasePath, 'Apple', fileName),
          // Product Catalog klasörü
          path.join(assetsBasePath, 'Product Catalog', 'Main Category', fileName),
        ];
        
        // Dosyayı ara
        for (const searchPath of searchPaths) {
          if (existsSync(searchPath)) {
            localPath = searchPath;
            break;
          }
        }
        
        // Product Catalog için recursive arama
        if (!localPath && key.startsWith('product-catalog.')) {
          const productCatalogBasePath = path.join(assetsBasePath, 'Product Catalog', 'Main Category');
          if (existsSync(productCatalogBasePath)) {
            // Recursive search function
            const findInProductCatalog = (dirPath: string): string | null => {
              try {
                const items = readdirSync(dirPath);
                for (const item of items) {
                  if (item.startsWith('.')) continue;
                  const itemPath = path.join(dirPath, item);
                  const itemStat = statSync(itemPath);
                  
                  if (itemStat.isFile() && (item === fileName || item === nameWithoutExt + ext)) {
                    return itemPath;
                  } else if (itemStat.isDirectory()) {
                    const found = findInProductCatalog(itemPath);
                    if (found) return found;
                  }
                }
              } catch (error) {
                // Skip on error
              }
              return null;
            };
            
            const foundPath = findInProductCatalog(productCatalogBasePath);
            if (foundPath) {
              localPath = foundPath;
            }
          }
        }
      }
    }
  }
  
  // Son kontrol: Dosya gerçekten var mı?
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
  // Ortam bilgisini al
  const nodeEnv = process.env.NODE_ENV || 'development'
  const s3Endpoint = process.env.S3_ENDPOINT || 'http://minio:9000'
  const s3BucketName = process.env.S3_BUCKET_NAME || 'tipbox-media'
  
  // Ortam adını belirle
  let environmentName = 'Development'
  if (nodeEnv === 'test') {
    environmentName = 'Test'
  } else if (nodeEnv === 'production') {
    environmentName = 'Production'
  }
  
  // Container bilgisini belirle
  const containerName = s3Endpoint.includes('minio:9000') 
    ? `tipbox_minio_${nodeEnv}` 
    : 'Harici MinIO'
  
  console.log(`\n📦 MinIO Yapılandırması:`)
  console.log(`   Ortam: ${environmentName}`)
  console.log(`   MinIO Container: ${containerName}`)
  console.log(`   MinIO Endpoint: ${s3Endpoint}`)
  console.log(`   Bucket Adı: ${s3BucketName}`)
  console.log(`   Görseller ${containerName} container'ına yüklenecek...\n`)
  
  const s3Service = new S3Service();
  
  // Bucket'ı oluştur - hata olursa seed devam etmemeli
  // ÖNEMLİ: Önce MinIO'da bucket oluşturulmalı, sonra DB'ye yazılmalı
  try {
    console.log(`📦 MinIO bucket kontrolü yapılıyor (${s3BucketName})...`)
    await s3Service.checkAndCreateBucket()
    console.log(`✅ MinIO bucket hazır: ${s3BucketName}`)
    console.log(`   ✅ Bucket oluşturuldu, görseller yüklenmeye hazır\n`)
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`❌ MinIO bucket oluşturulamadı: ${s3BucketName}`)
    console.error(`   Container: ${containerName}`)
    console.error(`   Endpoint: ${s3Endpoint}`)
    console.error(`   Hata: ${errorMsg}`)
    console.error(`   ⚠️  Seed işlemi bucket olmadan devam edemez!`)
    console.error(`   ⚠️  Önce MinIO'da bucket oluşturulmalı, sonra DB'ye yazılmalı!`)
    throw new Error(`MinIO bucket oluşturulamadı: ${errorMsg}`)
  }
  
  let uploadedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const createdFolders = new Set<string>();
  const missingFiles: string[] = [];
  const uploadErrors: Array<{ key: string; targetKey: string; error: string }> = [];
  
  console.log('📦 Seed görselleri MinIO\'ya yükleniyor...\n');
  console.log(`📋 Toplam ${Object.keys(seedMedia).length} görsel kontrol ediliyor...\n`);
  
  for (const [key, entry] of Object.entries(seedMedia)) {
    try {
      // Local dosya path'ini bul
      const localPath = getLocalPathForKey(key);
      
      if (!localPath || !existsSync(localPath)) {
        console.warn(`⚠️  Local dosya bulunamadı: ${key}`);
        console.warn(`   Hedef: ${entry.targetKey}`);
        console.warn(`   Beklenen path: ${localPath || 'N/A'}\n`);
        missingFiles.push(key);
        errorCount++;
        // Klasörü yine de ekle (beklenen klasörler listesinde görünsün)
        const folder = entry.targetKey.split('/')[0];
        if (folder) {
          // Not: Bu klasör için dosya yüklenemedi ama klasör beklenen listesinde olmalı
          // createdFolders'a eklemiyoruz çünkü dosya yüklenemedi
        }
        continue;
      }
      
      // MinIO'da dosyanın mevcut olup olmadığını kontrol et
      const exists = await s3Service.fileExists(entry.targetKey);
      
      if (exists) {
        // Dosya zaten mevcut, atla
        skippedCount++;
        const folder = entry.targetKey.split('/')[0];
        createdFolders.add(folder);
        continue;
      }
      
      // Dosyayı oku ve yükle
      const fileBuffer = readFileSync(localPath);
      const contentType = inferContentType(localPath);
      
      await s3Service.uploadFile(entry.targetKey, fileBuffer, contentType);
      
      // Başarıyla yüklendikten sonra klasörü ekle
      const folder = entry.targetKey.split('/')[0];
      createdFolders.add(folder);
      
      uploadedCount++;
      
      if (uploadedCount % 20 === 0) {
        console.log(`   ✅ ${uploadedCount} görsel yüklendi...`);
      }
    } catch (error: any) {
      // Hata olsa bile devam et
      const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ ${key} yüklenirken hata:`);
        console.error(`   Hedef: ${entry.targetKey}`);
        console.error(`   Hata: ${errorMsg}\n`);
        uploadErrors.push({ key, targetKey: entry.targetKey, error: errorMsg });
        errorCount++;
    }
  }
  
  // Sonuçları göster
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 Seed Görsel Yükleme Özeti:');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`✅ Başarıyla yüklenen: ${uploadedCount}`);
  console.log(`⏭️  Zaten mevcut (atlandı): ${skippedCount}`);
  console.log(`❌ Hata: ${errorCount}`);
  console.log(`📁 Oluşturulan klasör sayısı: ${createdFolders.size}\n`);
  
  // Oluşturulan klasörleri listele
  if (createdFolders.size > 0) {
    console.log('📁 MinIO\'da oluşturulan klasörler:');
    const sortedFolders = Array.from(createdFolders).sort();
    for (const folder of sortedFolders) {
      console.log(`   ✅ ${folder}/`);
    }
    console.log('');
  }
  
  // Eksik dosyaları göster
  if (missingFiles.length > 0) {
    console.log(`⚠️  Eksik local dosyalar (${missingFiles.length} adet):`);
    for (const key of missingFiles.slice(0, 10)) { // İlk 10'unu göster
      const entry = seedMedia[key];
      console.log(`   - ${key} → ${entry.targetKey}`);
    }
    if (missingFiles.length > 10) {
      console.log(`   ... ve ${missingFiles.length - 10} adet daha`);
    }
    console.log('');
  }
  
  // Yükleme hatalarını göster
  if (uploadErrors.length > 0) {
    console.log(`❌ Yükleme hataları (${uploadErrors.length} adet):`);
    for (const err of uploadErrors.slice(0, 10)) { // İlk 10'unu göster
      console.log(`   - ${err.key} → ${err.targetKey}`);
      console.log(`     Hata: ${err.error}`);
    }
    if (uploadErrors.length > 10) {
      console.log(`   ... ve ${uploadErrors.length - 10} adet daha`);
    }
    console.log('');
  }
  
  // Beklenen klasörleri seed-media-map.json'dan dinamik olarak çıkar
  const expectedFoldersSet = new Set<string>();
  for (const entry of Object.values(seedMedia)) {
    const targetKey = entry.targetKey;
    // İlk klasörü al (örn: "profile-pictures/xxx/yyy.jpg" -> "profile-pictures")
    const folder = targetKey.split('/')[0];
    if (folder) {
      expectedFoldersSet.add(folder);
    }
  }
  
  // Oluşturulan klasörleri kontrol et (nested klasörler için de kontrol yap)
  const createdFoldersArray = Array.from(createdFolders);
  const missingFolders = Array.from(expectedFoldersSet).filter(expectedFolder => {
    // Direkt eşleşme var mı?
    if (createdFolders.has(expectedFolder)) {
      return false; // Klasör oluşturulmuş
    }
    
    // Nested klasör kontrolü (örn: "badges" için "badges/custom" kontrolü)
    const hasNestedMatch = createdFoldersArray.some(created => {
      return created === expectedFolder || created.startsWith(expectedFolder + '/');
    });
    
    return !hasNestedMatch; // Eğer nested match yoksa eksik sayılır
  });
  
  if (missingFolders.length > 0) {
    console.log(`⚠️  Beklenen ama oluşturulmayan klasörler (${missingFolders.length} adet):`);
    console.log(`   (Bu klasörler için hiç dosya yüklenemedi)`);
    console.log(`   💡 Bu bir hata değil, sadece bu klasörler için dosya bulunamadı veya yüklenemedi`);
    console.log(`   💡 Sebepler:`);
    console.log(`      - Local dosyalar eksik olabilir (yukarıdaki "Eksik local dosyalar" bölümüne bakın)`);
    console.log(`      - Yükleme hatası olmuş olabilir (yukarıdaki "Yükleme hataları" bölümüne bakın)`);
    console.log(`   💡 Seed işlemi devam edecek, eksik görseller için local dosyaları ekleyin\n`);
    for (const folder of missingFolders.sort()) {
      console.log(`   - ${folder}/`);
    }
    console.log('');
  } else {
    console.log(`✅ Tüm beklenen klasörler için dosyalar yüklendi (${expectedFoldersSet.size} klasör)`);
    console.log('');
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');
}
