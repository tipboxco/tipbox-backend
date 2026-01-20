import { prisma, generateUlid } from '../types';
import { getSeedMediaPath, SeedMediaKey } from '../helpers/media.helper';
import { randomUUID } from 'crypto';

interface ProductConfig {
  name: string;
  description: string;
  imageKey?: SeedMediaKey;
}

interface ProductGroupConfig {
  name: string;
  description: string;
  subCategoryName: string;
  products: ProductConfig[];
  imageKey?: SeedMediaKey;
}

/**
 * Apple product groups ve products oluştur
 * 4 farklı product group: iPhones, MacBooks, iPads, Apple Watch
 */
export async function seedAppleProducts(brandId: string): Promise<{
  productGroups: Array<{ id: string; name: string; productCount: number }>;
}> {
  console.log('📱 [seed] Apple products & product groups');

  // Main category bul (Electronics)
  const electronicsCategory = await prisma.mainCategory.findFirst({
    where: { name: 'Electronics' },
  });

  if (!electronicsCategory) {
    throw new Error('Electronics main category not found. Please run main category seed first.');
  }

  // Sub categories oluştur veya bul
  const subCategories = {
    phones: await ensureSubCategory({
      name: 'Phones',
      mainCategoryId: electronicsCategory.id,
      description: 'Smartphones and mobile devices',
    }),
    laptops: await ensureSubCategory({
      name: 'Laptops',
      mainCategoryId: electronicsCategory.id,
      description: 'Laptop computers and notebooks',
    }),
    tablets: await ensureSubCategory({
      name: 'Tablets',
      mainCategoryId: electronicsCategory.id,
      description: 'Tablet computers and iPads',
    }),
    wearables: await ensureSubCategory({
      name: 'Wearables',
      mainCategoryId: electronicsCategory.id,
      description: 'Smartwatches and fitness trackers',
    }),
  };

  // Product group configs
  const productGroupConfigs: ProductGroupConfig[] = [
    {
      name: 'iPhone Series',
      description: 'Apple iPhone models',
      subCategoryName: 'Phones',
      imageKey: 'product.apple.iphone17' as SeedMediaKey,
      products: [
        { name: 'iPhone 17', description: 'Latest iPhone with advanced camera and A18 chip', imageKey: 'product.apple.iphone17' as SeedMediaKey },
        { name: 'iPhone 17 Pro', description: 'Pro model with titanium design and ProRAW', imageKey: 'product.apple.iphone17pro' as SeedMediaKey },
        { name: 'iPhone 16e', description: 'Affordable iPhone with great performance', imageKey: 'product.apple.iphone16e' as SeedMediaKey },
        { name: 'iPhone Air', description: 'Lightweight iPhone with premium features', imageKey: 'product.apple.iphoneair' as SeedMediaKey },
        { name: 'iPhone 15 Pro', description: 'Previous generation Pro model', imageKey: 'product.apple.iphone17pro' as SeedMediaKey },
        { name: 'iPhone 15', description: 'Previous generation standard model' },
        { name: 'iPhone 14 Pro', description: 'Older Pro model with Dynamic Island' },
        { name: 'iPhone SE 3', description: 'Compact iPhone with A15 chip' },
      ],
    },
    {
      name: 'MacBook',
      description: 'Apple MacBook laptops',
      subCategoryName: 'Laptops',
      imageKey: 'product.laptop.macbook' as SeedMediaKey,
      products: [
        { name: 'MacBook Pro 16" M4', description: '16-inch MacBook Pro with M4 chip', imageKey: 'product.laptop.macbook' as SeedMediaKey },
        { name: 'MacBook Pro 14" M4', description: '14-inch MacBook Pro with M4 chip' },
        { name: 'MacBook Air 15" M3', description: '15-inch MacBook Air with M3 chip' },
        { name: 'MacBook Air 13" M3', description: '13-inch MacBook Air with M3 chip' },
        { name: 'MacBook Pro 16" M3', description: 'Previous generation 16-inch Pro' },
        { name: 'MacBook Pro 14" M3', description: 'Previous generation 14-inch Pro' },
        { name: 'MacBook Air 13" M2', description: 'Previous generation 13-inch Air' },
      ],
    },
    {
      name: 'iPad',
      description: 'Apple iPad tablets',
      subCategoryName: 'Tablets',
      imageKey: 'product.tablet.ipad' as SeedMediaKey,
      products: [
        { name: 'iPad Pro 12.9" M4', description: '12.9-inch iPad Pro with M4 chip', imageKey: 'product.tablet.ipad' as SeedMediaKey },
        { name: 'iPad Pro 11" M4', description: '11-inch iPad Pro with M4 chip' },
        { name: 'iPad Air 13" M2', description: '13-inch iPad Air with M2 chip' },
        { name: 'iPad Air 11" M2', description: '11-inch iPad Air with M2 chip' },
        { name: 'iPad 10th Gen', description: '10th generation iPad' },
        { name: 'iPad 9th Gen', description: '9th generation iPad' },
        { name: 'iPad mini 6', description: '6th generation iPad mini' },
      ],
    },
    {
      name: 'Apple Watch',
      description: 'Apple smartwatches',
      subCategoryName: 'Wearables',
      imageKey: 'product.watch.applewatch' as SeedMediaKey,
      products: [
        { name: 'Apple Watch Series 11', description: 'Latest Apple Watch with advanced health features', imageKey: 'product.apple.watchseries11' as SeedMediaKey },
        { name: 'Apple Watch Ultra 3', description: 'Ultra durable Apple Watch for outdoor activities', imageKey: 'product.apple.watchultra3' as SeedMediaKey },
        { name: 'Apple Watch SE 3', description: 'Affordable Apple Watch with essential features', imageKey: 'product.apple.watchse3' as SeedMediaKey },
        { name: 'Apple Watch Series 10', description: 'Previous generation Apple Watch' },
        { name: 'Apple Watch Ultra 2', description: 'Previous generation Ultra model' },
        { name: 'Apple Watch Series 9', description: 'Older generation Apple Watch' },
      ],
    },
  ];

  const createdGroups: Array<{ id: string; name: string; productCount: number }> = [];

  // Her product group için
  for (const groupConfig of productGroupConfigs) {
    const subCategory = subCategories[groupConfig.subCategoryName.toLowerCase() as keyof typeof subCategories];
    
    if (!subCategory) {
      console.warn(`⚠️ Sub category not found: ${groupConfig.subCategoryName}`);
      continue;
    }

    // Product group oluştur veya bul
    let productGroup = await prisma.productGroup.findFirst({
      where: {
        name: groupConfig.name,
        subCategoryId: subCategory.id,
      },
    });

    if (!productGroup) {
      productGroup = await prisma.productGroup.create({
        data: {
          name: groupConfig.name,
          description: groupConfig.description,
          subCategoryId: subCategory.id,
          imageUrl: groupConfig.imageKey ? getSeedMediaPath(groupConfig.imageKey, true) || undefined : undefined,
        },
      });
      console.log(`  ✅ Product group oluşturuldu: ${groupConfig.name}`);
    } else {
      // Güncelle
      productGroup = await prisma.productGroup.update({
        where: { id: productGroup.id },
        data: {
          description: groupConfig.description,
          imageUrl: groupConfig.imageKey ? getSeedMediaPath(groupConfig.imageKey, true) || productGroup.imageUrl || undefined : productGroup.imageUrl,
        },
      });
      console.log(`  ✅ Product group güncellendi: ${groupConfig.name}`);
    }

    // Brand'ı bul (bir kez, tüm products için)
    const appleBrand = await prisma.brand.findFirst({
      where: { name: 'Apple' },
    });

    if (!appleBrand) {
      throw new Error('Apple brand not found. Please run apple-brand seed first.');
    }

    // Products oluştur
    let productCount = 0;
    for (const productConfig of groupConfig.products) {
      // Product var mı kontrol et (brandId üzerinden)
      let product = await prisma.product.findFirst({
        where: {
          name: productConfig.name,
          brandId: appleBrand.externalId, // Product.brandId Brand.externalId'ye referans veriyor
          groupId: productGroup.id,
        },
      });

      if (!product) {
        product = await prisma.product.create({
          data: {
            id: randomUUID(),
            name: productConfig.name,
            brandId: appleBrand.externalId, // Product.brandId Brand.externalId'ye referans veriyor
            description: productConfig.description,
            groupId: productGroup.id,
            imageUrl: productConfig.imageKey ? getSeedMediaPath(productConfig.imageKey, true) || undefined : undefined,
          },
        });
        productCount++;
      } else {
        // Güncelle
        product = await prisma.product.update({
          where: { id: product.id },
          data: {
            description: productConfig.description,
            imageUrl: productConfig.imageKey ? getSeedMediaPath(productConfig.imageKey, true) || product.imageUrl || undefined : product.imageUrl,
          },
        });
      }
    }

    console.log(`    ✅ ${productCount} yeni product oluşturuldu, toplam ${groupConfig.products.length} product`);
    createdGroups.push({
      id: productGroup.id,
      name: productGroup.name,
      productCount: groupConfig.products.length,
    });
  }

  return {
    productGroups: createdGroups,
  };
}

/**
 * Sub category oluştur veya bul
 */
async function ensureSubCategory(config: {
  name: string;
  mainCategoryId: string;
  description?: string;
}): Promise<{ id: string; name: string }> {
  let subCategory = await prisma.subCategory.findFirst({
    where: {
      name: config.name,
      mainCategoryId: config.mainCategoryId,
    },
  });

  if (!subCategory) {
    subCategory = await prisma.subCategory.create({
      data: {
        name: config.name,
        description: config.description,
        mainCategoryId: config.mainCategoryId,
      },
    });
  }

  return subCategory;
}
