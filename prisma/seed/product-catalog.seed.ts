/**
 * Product Catalog klasöründen Main Category, Sub Category, Product Group ve Product'ları seed eder
 * Öncelikli kategoriler: Cosmetics, Electronics, Sports & Outdoors
 */

import { readdirSync, statSync, existsSync } from 'fs';
import path from 'path';
import { prisma } from './types';
import { resolveMediaUrl } from '../../src/infrastructure/config/media.config';

const assetsBasePath = path.join(__dirname, '../../tests/assets');
const productCatalogPath = path.join(assetsBasePath, 'Product Catalog', 'Main Category');

interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
}

function getAllPngFiles(dirPath: string): string[] {
  const files: string[] = [];
  
  try {
    const items = readdirSync(dirPath);
    for (const item of items) {
      if (item.startsWith('.')) continue;
      const itemPath = path.join(dirPath, item);
      const itemStat = statSync(itemPath);
      
      if (itemStat.isFile() && item.toLowerCase().endsWith('.png')) {
        files.push(itemPath);
      } else if (itemStat.isDirectory()) {
        files.push(...getAllPngFiles(itemPath));
      }
    }
  } catch (error) {
    // Skip on error
  }
  
  return files;
}

function extractProductName(fileName: string): string {
  // Dosya adından extension'ı kaldır ve product adını çıkar
  // Örn: "Got2b-Glued-Blasting-Freeze-Spray.png" -> "Got2b Glued Blasting Freeze Spray"
  return fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

async function seedProductCatalog(): Promise<void> {
  console.log('📦 [seed] Product Catalog - Main Categories, Sub Categories, Product Groups & Products\n');

  if (!existsSync(productCatalogPath)) {
    console.warn('⚠️  Product Catalog klasörü bulunamadı:', productCatalogPath);
    return;
  }

  // Öncelikli kategoriler: Cosmetics, Electronics, Sports Outdoors
  const priorityMainCategories = ['Cosmetics', 'Electronics', 'Sports Outdoors'];
  
  // Main Category klasörlerini bul
  const mainCategoryFolders: FileInfo[] = [];
  const mainCategoryImages: Map<string, string> = new Map();
  
  const items = readdirSync(productCatalogPath);
  
  // Önce PNG dosyalarını (main category görselleri) bul
  for (const item of items) {
    if (item.endsWith('.png')) {
      const categoryName = item.replace('.png', '').replace(/-/g, ' ');
      const imagePath = path.join(productCatalogPath, item);
      mainCategoryImages.set(categoryName, imagePath);
    }
  }
  
  // Sonra klasörleri bul
  for (const item of items) {
    if (item.startsWith('.')) continue;
    const itemPath = path.join(productCatalogPath, item);
    const itemStat = statSync(itemPath);
    
    if (itemStat.isDirectory()) {
      mainCategoryFolders.push({
        name: item,
        path: itemPath,
        isDirectory: true,
      });
    }
  }
  
  // Öncelikli kategorileri önce işle
  const orderedFolders: FileInfo[] = [];
  for (const priority of priorityMainCategories) {
    const folder = mainCategoryFolders.find(f => f.name === priority);
    if (folder) {
      orderedFolders.push(folder);
    }
  }
  
  // Diğer klasörleri ekle
  for (const folder of mainCategoryFolders) {
    if (!priorityMainCategories.includes(folder.name)) {
      orderedFolders.push(folder);
    }
  }

  let totalMainCategories = 0;
  let totalSubCategories = 0;
  let totalProductGroups = 0;
  let totalProducts = 0;

  for (const mainCategoryFolder of orderedFolders) {
    const mainCategoryName = mainCategoryFolder.name;
    
    // Main Category görselini bul
    const mainCategoryImageFile = `${mainCategoryName.toLowerCase().replace(/\s+/g, '-')}.png`;
    const mainCategoryImagePath = path.join(productCatalogPath, mainCategoryImageFile);
    const mainCategoryImage = existsSync(mainCategoryImagePath)
      ? `product-catalog/main-categories/${mainCategoryImageFile}`
      : mainCategoryImages.get(mainCategoryName) 
        ? `product-catalog/main-categories/${path.basename(mainCategoryImages.get(mainCategoryName)!)}`
        : null;
    
    // Main Category'yi oluştur veya bul
    let mainCategory = await prisma.mainCategory.findFirst({
      where: { name: mainCategoryName },
    });
    
    if (!mainCategory) {
      mainCategory = await prisma.mainCategory.create({
        data: {
          name: mainCategoryName,
          description: `${mainCategoryName} kategorisi`,
          imageUrl: mainCategoryImage ? resolveMediaUrl(mainCategoryImage) : null,
        },
      });
      totalMainCategories++;
      console.log(`✅ Main Category oluşturuldu: ${mainCategoryName}`);
    } else {
      // Mevcut Main Category'yi kullan ve görseli güncelle
      if (mainCategoryImage) {
        await prisma.mainCategory.update({
          where: { id: mainCategory.id },
          data: { imageUrl: resolveMediaUrl(mainCategoryImage) },
        });
        console.log(`🔄 Main Category görseli güncellendi: ${mainCategoryName} (ID: ${mainCategory.id})`);
      }
      console.log(`✅ Mevcut Main Category kullanılıyor: ${mainCategoryName} (ID: ${mainCategory.id})`);
    }

    // Sub Category'leri bul
    const subCategoryItems = readdirSync(mainCategoryFolder.path);
    const subCategoryMap = new Map<string, { image: string; path: string; isDirectory: boolean }>();
    
    for (const subItem of subCategoryItems) {
      if (subItem.startsWith('.')) continue;
      const subItemPath = path.join(mainCategoryFolder.path, subItem);
      const subItemStat = statSync(subItemPath);
      
      if (subItemStat.isFile() && subItem.endsWith('.png')) {
        // Sub Category görseli (PNG dosyası)
        const subCategoryName = subItem.replace('.png', '').replace(/-/g, ' ');
        if (!subCategoryMap.has(subCategoryName)) {
          subCategoryMap.set(subCategoryName, {
            image: `product-catalog/main-categories/${subItem}`,
            path: mainCategoryFolder.path, // Sub category'nin ana klasörü
            isDirectory: false,
          });
        }
      } else if (subItemStat.isDirectory()) {
        // Klasör (Sub Category veya Product Group olabilir)
        const subCategoryName = subItem;
        const subCategoryImageFile = `${subCategoryName.toLowerCase().replace(/\s+/g, '-')}.png`;
        const subCategoryImagePath = path.join(mainCategoryFolder.path, subCategoryImageFile);
        
        subCategoryMap.set(subCategoryName, {
          image: existsSync(subCategoryImagePath)
            ? `product-catalog/main-categories/${subCategoryImageFile}`
            : `product-catalog/main-categories/${subCategoryName}.png`,
          path: subItemPath, // Klasörün kendisi
          isDirectory: true,
        });
      }
    }

    // Sub Category'leri oluştur
    for (const [subCategoryName, subCategoryInfo] of subCategoryMap.entries()) {
      let subCategory = await prisma.subCategory.findFirst({
        where: {
          name: subCategoryName,
          mainCategoryId: mainCategory.id,
        },
      });
      
      if (!subCategory) {
        subCategory = await prisma.subCategory.create({
          data: {
            name: subCategoryName,
            description: `${subCategoryName} alt kategorisi`,
            mainCategoryId: mainCategory.id,
            imageUrl: resolveMediaUrl(subCategoryInfo.image),
          },
        });
        totalSubCategories++;
        console.log(`   ✅ Sub Category oluşturuldu: ${subCategoryName}`);
      } else {
        // Görseli güncelle
        if (!subCategory.imageUrl) {
          await prisma.subCategory.update({
            where: { id: subCategory.id },
            data: { imageUrl: resolveMediaUrl(subCategoryInfo.image) },
          });
          console.log(`   🔄 Sub Category görseli güncellendi: ${subCategoryName}`);
        }
      }

      // Product Group'ları bul
      const productGroupMap = new Map<string, { image: string; path: string; products: string[] }>();
      
      // Eğer subCategoryInfo bir klasörse, içindeki alt klasörleri Product Group olarak kabul et
      if (subCategoryInfo.isDirectory) {
        const productGroupItems = readdirSync(subCategoryInfo.path);
        
        for (const pgItem of productGroupItems) {
          if (pgItem.startsWith('.')) continue;
          const pgItemPath = path.join(subCategoryInfo.path, pgItem);
          const pgItemStat = statSync(pgItemPath);
          
          if (pgItemStat.isDirectory()) {
            // Product Group klasörü
            const productGroupName = pgItem;
            const productGroupImageFile = `${productGroupName.toLowerCase().replace(/\s+/g, '-')}.png`;
            const productGroupImagePath = path.join(subCategoryInfo.path, productGroupImageFile);
            
            // Product'ları bul (en alt seviyedeki PNG dosyaları)
            const productFiles = getAllPngFiles(pgItemPath);
            const productNames = productFiles.map(f => path.basename(f));
            
            productGroupMap.set(productGroupName, {
              image: existsSync(productGroupImagePath)
                ? `product-catalog/main-categories/${productGroupImageFile}`
                : subCategoryInfo.image,
              path: pgItemPath,
              products: productNames,
            });
          }
        }
      }

      // Eğer Product Group yoksa ama direkt product'lar varsa, bir Product Group oluştur
      if (productGroupMap.size === 0) {
        const directProductFiles = getAllPngFiles(subCategoryInfo.path);
        if (directProductFiles.length > 0) {
          const productGroupName = subCategoryName;
          productGroupMap.set(productGroupName, {
            image: subCategoryInfo.image,
            path: subCategoryInfo.path,
            products: directProductFiles.map(f => path.basename(f)),
          });
        }
      }

      // Product Group'ları oluştur
      for (const [productGroupName, productGroupInfo] of productGroupMap.entries()) {
        let productGroup = await prisma.productGroup.findFirst({
          where: {
            name: productGroupName,
            subCategoryId: subCategory.id,
          },
        });
        
        if (!productGroup) {
          productGroup = await prisma.productGroup.create({
            data: {
              name: productGroupName,
              description: `${productGroupName} ürün grubu`,
              subCategoryId: subCategory.id,
              imageUrl: resolveMediaUrl(productGroupInfo.image),
            },
          });
          totalProductGroups++;
          console.log(`      ✅ Product Group oluşturuldu: ${productGroupName}`);
        } else {
          // Görseli güncelle
          if (!productGroup.imageUrl) {
            await prisma.productGroup.update({
              where: { id: productGroup.id },
              data: { imageUrl: resolveMediaUrl(productGroupInfo.image) },
            });
            console.log(`      🔄 Product Group görseli güncellendi: ${productGroupName}`);
          }
        }

        // Product'ları oluştur
        for (const productFileName of productGroupInfo.products) {
          const productName = extractProductName(productFileName);
          const productImage = `product-catalog/main-categories/${productFileName}`;
          
          // Aynı isimde product var mı kontrol et
          let product = await prisma.product.findFirst({
            where: {
              name: productName,
              groupId: productGroup.id,
            },
          });
          
          if (!product) {
            product = await prisma.product.create({
              data: {
                name: productName,
                brand: extractBrandFromName(productName),
                description: `${productName} ürünü`,
                groupId: productGroup.id,
                imageUrl: resolveMediaUrl(productImage),
              },
            });
            totalProducts++;
          } else {
            // Görseli güncelle
            if (!product.imageUrl) {
              await prisma.product.update({
                where: { id: product.id },
                data: { imageUrl: resolveMediaUrl(productImage) },
              });
            }
          }
        }
        
        if (productGroupInfo.products.length > 0) {
          console.log(`         ✅ ${productGroupInfo.products.length} Product oluşturuldu/güncellendi`);
        }
      }
    }
  }

  console.log('\n' + '═'.repeat(100));
  console.log('\n📊 Product Catalog Seed Özeti:');
  console.log(`   ✅ Main Categories: ${totalMainCategories} yeni, ${orderedFolders.length} toplam`);
  console.log(`   ✅ Sub Categories: ${totalSubCategories} yeni`);
  console.log(`   ✅ Product Groups: ${totalProductGroups} yeni`);
  console.log(`   ✅ Products: ${totalProducts} yeni`);
  console.log('\n✨ Product Catalog seed tamamlandı!');
}

function extractBrandFromName(productName: string): string | null {
  // Product adından marka çıkarmaya çalış
  // Örn: "Got2b Glued Blasting Freeze Spray" -> "Got2b"
  // "Apple iPhone 16" -> "Apple"
  const words = productName.split(' ');
  if (words.length > 0) {
    // İlk kelime genellikle marka olabilir
    const firstWord = words[0];
    // Eğer ilk kelime çok kısaysa (2 karakter veya daha az), ilk 2 kelimeyi al
    if (firstWord.length <= 2 && words.length > 1) {
      return `${firstWord} ${words[1]}`;
    }
    return firstWord;
  }
  return null;
}

if (require.main === module) {
  seedProductCatalog()
    .catch((e) => {
      console.error('❌ Product Catalog seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { seedProductCatalog };

