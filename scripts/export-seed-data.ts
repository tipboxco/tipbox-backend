/**
 * DB'deki seed verilerini export eden script
 * 
 * Kullanım:
 *   npx ts-node scripts/export-seed-data.ts
 *   npx ts-node scripts/export-seed-data.ts --output prisma/seed/exported-data.json
 *   npx ts-node scripts/export-seed-data.ts --user-id <userId> --only-user
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface SeedExport {
  users: any[];
  profiles: any[];
  contentPosts: any[];
  products: any[];
  categories: any[];
  brands: any[];
  inventories: any[];
  postMedia: any[];
  metadata: {
    exportedAt: string;
    seedUserIds: string[];
    totalRecords: number;
  };
}

async function exportSeedData(options: {
  outputPath?: string;
  userId?: string;
  onlyUser?: boolean;
}): Promise<void> {
  console.log('📤 Seed verileri export ediliyor...\n');

  const { getSeedUserIds } = require('../prisma/seed/seed-metadata');
  const seedUserIds = getSeedUserIds();

  if (seedUserIds.length === 0) {
    console.warn('⚠️  Seed kullanıcı ID\'leri bulunamadı. Tüm veriler export edilecek.');
  }

  const exportData: SeedExport = {
    users: [],
    profiles: [],
    contentPosts: [],
    products: [],
    categories: [],
    brands: [],
    inventories: [],
    postMedia: [],
    metadata: {
      exportedAt: new Date().toISOString(),
      seedUserIds: seedUserIds,
      totalRecords: 0,
    },
  };

  try {
    // Users
    const userWhere = options.userId 
      ? { id: options.userId }
      : options.onlyUser && seedUserIds.length > 0
      ? { id: { in: seedUserIds } }
      : {};

    const users = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        email: true,
        passwordHash: true,
        status: true,
        emailVerified: true,
        createdAt: true,
      },
    });
    exportData.users = users;
    console.log(`✅ ${users.length} kullanıcı export edildi`);

    // Profiles
    const profiles = await prisma.profile.findMany({
      where: options.userId 
        ? { userId: options.userId }
        : options.onlyUser && seedUserIds.length > 0
        ? { userId: { in: seedUserIds } }
        : {},
      select: {
        id: true,
        userId: true,
        displayName: true,
        userName: true,
        bio: true,
        bannerUrl: true,
        cosmeticBadgeId: true,
        country: true,
        birthDate: true,
        postsCount: true,
        trustCount: true,
        trusterCount: true,
        unseenFeedCount: true,
        createdAt: true,
      },
    });
    exportData.profiles = profiles;
    console.log(`✅ ${profiles.length} profil export edildi`);

    // Content Posts
    const posts = await prisma.contentPost.findMany({
      where: options.userId 
        ? { userId: options.userId }
        : options.onlyUser && seedUserIds.length > 0
        ? { userId: { in: seedUserIds } }
        : {},
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        body: true,
        productId: true,
        productGroupId: true,
        mainCategoryId: true,
        subCategoryId: true,
        inventoryRequired: true,
        isBoosted: true,
        boostedUntil: true,
        likesCount: true,
        commentsCount: true,
        favoritesCount: true,
        viewsCount: true,
        sharesCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    exportData.contentPosts = posts;
    console.log(`✅ ${posts.length} post export edildi`);

    // Post Media
    const postIds = posts.map(p => p.id);
    if (postIds.length > 0) {
      const media = await prisma.postMedia.findMany({
        where: { postId: { in: postIds } },
        select: {
          id: true,
          postId: true,
          userId: true,
          mediaUrl: true,
          orderIndex: true,
          createdAt: true,
        },
      });
      exportData.postMedia = media;
      console.log(`✅ ${media.length} post media export edildi`);
    }

    // Products (post'larda kullanılan)
    const productIds = [...new Set(posts.map(p => p.productId).filter(Boolean))];
    if (productIds.length > 0) {
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          brand: true,
          description: true,
          imageUrl: true,
          groupId: true,
          createdAt: true,
        },
      });
      exportData.products = products;
      console.log(`✅ ${products.length} ürün export edildi`);
    }

    // Categories (post'larda kullanılan)
    const categoryIds = [
      ...new Set(posts.map(p => p.mainCategoryId).filter(Boolean)),
      ...new Set(posts.map(p => p.subCategoryId).filter(Boolean)),
    ];
    if (categoryIds.length > 0) {
      const mainCategories = await prisma.mainCategory.findMany({
        where: { id: { in: categoryIds } },
      });
      const subCategories = await prisma.subCategory.findMany({
        where: { id: { in: categoryIds } },
      });
      exportData.categories = [...mainCategories, ...subCategories];
      console.log(`✅ ${exportData.categories.length} kategori export edildi`);
    }

    // Brands
    const brands = await prisma.brand.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        logoUrl: true,
        imageUrl: true,
        category: true,
        categoryId: true,
        createdAt: true,
      },
    });
    exportData.brands = brands;
    console.log(`✅ ${brands.length} marka export edildi`);

    // Inventories
    const inventories = await prisma.inventory.findMany({
      where: options.userId 
        ? { userId: options.userId }
        : options.onlyUser && seedUserIds.length > 0
        ? { userId: { in: seedUserIds } }
        : {},
      select: {
        id: true,
        userId: true,
        productId: true,
        hasOwned: true,
        experienceSummary: true,
        createdAt: true,
      },
    });
    exportData.inventories = inventories;
    console.log(`✅ ${inventories.length} inventory export edildi`);

    // Metadata
    exportData.metadata.totalRecords = 
      users.length + 
      profiles.length + 
      posts.length + 
      exportData.postMedia.length +
      exportData.products.length +
      exportData.categories.length +
      brands.length +
      inventories.length;

    // Export to file
    const outputPath = options.outputPath || path.join(process.cwd(), 'prisma', 'seed', 'exported-seed-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');

    console.log(`\n✅ Export tamamlandı!`);
    console.log(`📁 Dosya: ${outputPath}`);
    console.log(`📊 Toplam kayıt: ${exportData.metadata.totalRecords}`);
    console.log(`\n💡 Bu dosyayı seed.ts'ye entegre etmek için:`);
    console.log(`   npx ts-node scripts/import-seed-data.ts --file ${outputPath}`);

  } catch (error) {
    console.error('❌ Export hatası:', error);
    throw error;
  }
}

// CLI
const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
const outputPath = outputIndex !== -1 && args[outputIndex + 1] ? args[outputIndex + 1] : undefined;

const userIdIndex = args.indexOf('--user-id');
const userId = userIdIndex !== -1 && args[userIdIndex + 1] ? args[userIdIndex + 1] : undefined;

const onlyUser = args.includes('--only-user');

exportSeedData({ outputPath, userId, onlyUser })
  .catch((e) => {
    console.error('❌ Export failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
