/**
 * Hiyerarşik Feed Yapısı Seed Script'i
 * 
 * Electronics ve Cosmetics kategorileri altında eksiksiz hiyerarşik yapı oluşturur:
 * - 2 Main Category (Electronics, Cosmetics)
 * - 4 Sub Category (her category'de 2'şer)
 * - 8 Product Group (her sub category'de 2'şer)
 * - 16 Product (her product group'ta 2'şer)
 * 
 * Görseller MinIO'ya yüklenir ve DB'ye kaydedilir.
 */

import { PrismaClient } from '@prisma/client';
import { S3Service } from '../src/infrastructure/s3/s3.service';
import { resolveMediaUrl } from '../src/infrastructure/config/media.config';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const s3Service = new S3Service();

// Test hierarchy yapısı
const HIERARCHY_STRUCTURE = {
  electronics: {
    categoryId: '3968a741-6ebe-4d97-b853-62b04198c91e',
    categoryName: 'Electronics',
    subCategories: [
      {
        subCategoryId: '079262b2-a70e-494d-aa69-d2746543caec',
        subCategoryName: 'cameras',
        productGroups: [
          {
            productGroupId: '3bff32d3-2e8f-436c-b30c-70e5d59425bf',
            productGroupName: 'cameras',
            products: [
              { productId: '5b839ba6-7869-40ab-8540-8c91cfd1932e', productName: '2 In 1 Laptops' },
              { productId: '2c1bbc03-d55c-4df2-b4d2-aa34c9ad1d4d', productName: 'Acer Nitro 16' },
            ],
          },
          {
            productGroupId: null, // Oluşturulacak
            productGroupName: 'cameras Group 2',
            products: [
              { productId: null, productName: 'Camera Product 1' },
              { productId: null, productName: 'Camera Product 2' },
            ],
          },
        ],
      },
      {
        subCategoryId: '8fb311e1-9c72-4054-8f1a-4116c1c159b4',
        subCategoryName: 'drones',
        productGroups: [
          {
            productGroupId: null,
            productGroupName: 'drones Group 1',
            products: [
              { productId: null, productName: 'Drone Product 1' },
              { productId: null, productName: 'Drone Product 2' },
            ],
          },
          {
            productGroupId: null,
            productGroupName: 'drones Group 2',
            products: [
              { productId: null, productName: 'Drone Product 3' },
              { productId: null, productName: 'Drone Product 4' },
            ],
          },
        ],
      },
    ],
  },
  cosmetics: {
    categoryId: '2ec1c38f-a3e2-4228-87a0-d6e0067ac206',
    categoryName: 'Cosmetics',
    subCategories: [
      {
        subCategoryId: 'f4e84c4d-d09a-4e41-ae40-5ad23990a4f5',
        subCategoryName: 'Bath body',
        productGroups: [
          {
            productGroupId: 'cfde64de-52ce-4c88-b57e-e129f4d6b12c',
            productGroupName: 'Bath body',
            products: [
              { productId: '00b369a7-394a-455c-a04d-58c3280db6ba', productName: 'BaBylissPRO Nano Titanium Portofino' },
              { productId: '1fe389b4-003d-4004-aabd-455fda354425', productName: 'Bath Body' },
            ],
          },
          {
            productGroupId: null,
            productGroupName: 'Bath body Group 2',
            products: [
              { productId: null, productName: 'Bath Product 1' },
              { productId: null, productName: 'Bath Product 2' },
            ],
          },
        ],
      },
      {
        subCategoryId: 'b496203a-58a6-499b-a9be-997522cae2af',
        subCategoryName: 'Facial tools',
        productGroups: [
          {
            productGroupId: null,
            productGroupName: 'Facial tools Group 1',
            products: [
              { productId: null, productName: 'Facial Product 1' },
              { productId: null, productName: 'Facial Product 2' },
            ],
          },
          {
            productGroupId: null,
            productGroupName: 'Facial tools Group 2',
            products: [
              { productId: null, productName: 'Facial Product 3' },
              { productId: null, productName: 'Facial Product 4' },
            ],
          },
        ],
      },
    ],
  },
};

/**
 * MinIO'dan veya local asset'lerden görsel al
 */
async function getImageForEntity(
  entityType: 'category' | 'subCategory' | 'productGroup' | 'product',
  entityName: string
): Promise<string | null> {
  const assetsBasePath = path.join(__dirname, '../tests/assets');
  const catalogPath = path.join(assetsBasePath, 'Product Catalog', 'Main Category');
  
  // Önce local asset'lerden ara
  const possiblePaths = [
    path.join(catalogPath, `${entityName}.png`),
    path.join(catalogPath, `${entityName.replace(/\s+/g, '-')}.png`),
    path.join(catalogPath, `${entityName.replace(/\s+/g, '_')}.png`),
  ];
  
  for (const imagePath of possiblePaths) {
    if (fs.existsSync(imagePath)) {
      // MinIO'ya yükle
      try {
        const imageBuffer = fs.readFileSync(imagePath);
        const fileName = `product-catalog/${entityType}/${uuidv4()}-${path.basename(imagePath)}`;
        const contentType = 'image/png';
        
        await s3Service.uploadFile(fileName, imageBuffer, contentType);
        return s3Service.getFileUrl(fileName);
      } catch (error: any) {
        console.warn(`⚠️  Görsel yüklenemedi: ${error.message}`);
      }
    }
  }
  
  // Eğer görsel bulunamazsa, rastgele bir catalog görseli kullan
  try {
    const catalogImages = fs.readdirSync(catalogPath).filter(f => f.endsWith('.png'));
    if (catalogImages.length > 0) {
      const randomImage = catalogImages[Math.floor(Math.random() * catalogImages.length)];
      const imagePath = path.join(catalogPath, randomImage);
      const imageBuffer = fs.readFileSync(imagePath);
      const fileName = `product-catalog/${entityType}/${uuidv4()}-${randomImage}`;
      
      await s3Service.uploadFile(fileName, imageBuffer, 'image/png');
      return s3Service.getFileUrl(fileName);
    }
  } catch (error: any) {
    console.warn(`⚠️  Rastgele görsel alınamadı: ${error.message}`);
  }
  
  return null;
}

/**
 * Main Category'yi kontrol et veya oluştur
 */
async function ensureMainCategory(config: {
  id: string;
  name: string;
  description?: string;
}): Promise<void> {
  const existing = await prisma.mainCategory.findUnique({
    where: { id: config.id },
  });
  
  if (existing) {
    console.log(`  ✅ Main Category mevcut: ${config.name}`);
    return;
  }
  
  const imageUrl = await getImageForEntity('category', config.name);
  
  await prisma.mainCategory.create({
    data: {
      id: config.id,
      name: config.name,
      description: config.description || `${config.name} kategorisi`,
      imageUrl: imageUrl,
    },
  });
  
  console.log(`  ✅ Main Category oluşturuldu: ${config.name}`);
}

/**
 * Sub Category'yi kontrol et veya oluştur
 */
async function ensureSubCategory(config: {
  id: string;
  name: string;
  mainCategoryId: string;
  description?: string;
}): Promise<void> {
  const existing = await prisma.subCategory.findUnique({
    where: { id: config.id },
  });
  
  if (existing) {
    console.log(`    ✅ Sub Category mevcut: ${config.name}`);
    return;
  }
  
  const imageUrl = await getImageForEntity('subCategory', config.name);
  
  await prisma.subCategory.create({
    data: {
      id: config.id,
      name: config.name,
      description: config.description || `${config.name} alt kategorisi`,
      mainCategoryId: config.mainCategoryId,
      imageUrl: imageUrl,
    },
  });
  
  console.log(`    ✅ Sub Category oluşturuldu: ${config.name}`);
}

/**
 * Product Group'u kontrol et veya oluştur
 */
async function ensureProductGroup(config: {
  id: string | null;
  name: string;
  subCategoryId: string;
  description?: string;
}): Promise<string> {
  // Eğer ID verilmişse, mevcut olup olmadığını kontrol et
  if (config.id) {
    const existing = await prisma.productGroup.findUnique({
      where: { id: config.id },
    });
    
    if (existing) {
      console.log(`      ✅ Product Group mevcut: ${config.name}`);
      return config.id;
    }
  }
  
  // Yeni ID oluştur
  const productGroupId = config.id || uuidv4();
  const imageUrl = await getImageForEntity('productGroup', config.name);
  
  await prisma.productGroup.create({
    data: {
      id: productGroupId,
      name: config.name,
      description: config.description || `${config.name} ürün grubu`,
      subCategoryId: config.subCategoryId,
      imageUrl: imageUrl,
    },
  });
  
  console.log(`      ✅ Product Group oluşturuldu: ${config.name} (${productGroupId})`);
  return productGroupId;
}

/**
 * Product'ı kontrol et veya oluştur
 */
async function ensureProduct(config: {
  id: string | null;
  name: string;
  productGroupId: string;
  brand?: string;
  description?: string;
}): Promise<string> {
  // Eğer ID verilmişse, mevcut olup olmadığını kontrol et
  if (config.id) {
    const existing = await prisma.product.findUnique({
      where: { id: config.id },
    });
    
    if (existing) {
      console.log(`        ✅ Product mevcut: ${config.name}`);
      return config.id;
    }
  }
  
  // Yeni ID oluştur
  const productId = config.id || uuidv4();
  const imageUrl = await getImageForEntity('product', config.name);
  
  await prisma.product.create({
    data: {
      id: productId,
      name: config.name,
      brand: config.brand || null,
      description: config.description || `${config.name} ürünü`,
      groupId: config.productGroupId,
      imageUrl: imageUrl,
    },
  });
  
  console.log(`        ✅ Product oluşturuldu: ${config.name} (${productId})`);
  return productId;
}

/**
 * Ana seed fonksiyonu
 */
async function seedHierarchicalFeed(): Promise<void> {
  console.log('🌳 Hiyerarşik Feed Yapısı Seed Ediliyor...\n');
  console.log('='.repeat(60));
  
  let totalCategories = 0;
  let totalSubCategories = 0;
  let totalProductGroups = 0;
  let totalProducts = 0;
  
  try {
    for (const [categoryKey, categoryData] of Object.entries(HIERARCHY_STRUCTURE)) {
      console.log(`\n📂 ${categoryData.categoryName} Kategorisi`);
      
      // Main Category
      await ensureMainCategory({
        id: categoryData.categoryId,
        name: categoryData.categoryName,
        description: `${categoryData.categoryName} ana kategorisi`,
      });
      totalCategories++;
      
      // Sub Categories
      for (const subCategory of categoryData.subCategories) {
        console.log(`\n  📁 ${subCategory.subCategoryName} Sub Category`);
        
        await ensureSubCategory({
          id: subCategory.subCategoryId,
          name: subCategory.subCategoryName,
          mainCategoryId: categoryData.categoryId,
          description: `${subCategory.subCategoryName} alt kategorisi`,
        });
        totalSubCategories++;
        
        // Product Groups
        for (const productGroup of subCategory.productGroups) {
          console.log(`\n    📦 ${productGroup.productGroupName} Product Group`);
          
          const productGroupId = await ensureProductGroup({
            id: productGroup.productGroupId,
            name: productGroup.productGroupName,
            subCategoryId: subCategory.subCategoryId,
            description: `${productGroup.productGroupName} ürün grubu`,
          });
          totalProductGroups++;
          
          // Products
          for (const product of productGroup.products) {
            await ensureProduct({
              id: product.productId,
              name: product.productName,
              productGroupId: productGroupId,
              description: `${product.productName} ürünü`,
            });
            totalProducts++;
          }
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Seed Özeti:');
    console.log(`  ✅ Main Categories: ${totalCategories}`);
    console.log(`  ✅ Sub Categories: ${totalSubCategories}`);
    console.log(`  ✅ Product Groups: ${totalProductGroups}`);
    console.log(`  ✅ Products: ${totalProducts}`);
    console.log('\n✨ Hiyerarşik feed yapısı seed tamamlandı!');
    
  } catch (error: any) {
    console.error('\n❌ Seed sırasında hata:', error);
    throw error;
  }
}

// Script çalıştırma
if (require.main === module) {
  seedHierarchicalFeed()
    .then(() => {
      console.log('\n✅ Seed başarıyla tamamlandı');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Seed başarısız:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { seedHierarchicalFeed };
