/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { prisma, generateUlid, TEST_USER_ID } from './types';
import { getSeedMediaUrl } from './helpers/media.helper';

const HOME_APPLIANCE_IMAGE = getSeedMediaUrl('catalog.home-appliances');
const PHONE_IMAGE = getSeedMediaUrl('catalog.phones');
const INVENTORY_MEDIA_URL = getSeedMediaUrl('inventory.dyson-media', 'https://cdn.tipbox.co/inventory/dyson-1.jpg');
const DYSON_PRODUCT_IMAGE = getSeedMediaUrl('product.vacuum.dyson');
const MACBOOK_PRODUCT_IMAGE = getSeedMediaUrl('product.laptop.macbook');

// Üretilen ekstra FREE post sayısı (default: 2, env ile arttırılabilir)
const EXTRA_FREE_POST_COUNT = Number.parseInt(process.env.SEED_FREE_POST_COUNT || '2', 10);

export async function seedProductsAndContent(): Promise<void> {
  console.log('🧩 [seed] products & content (full)');

  // Categories
  const techCategory = await prisma.mainCategory.findFirst({ where: { name: 'Teknoloji' } });
  const evYasamCategory = await prisma.mainCategory.findFirst({ where: { name: 'Ev & Yaşam' } });

  // Subcategory (ensure one exists under Ev & Yaşam)
  let evYasamSubCategory = await prisma.subCategory.findFirst({ where: { mainCategoryId: evYasamCategory?.id } });
  if (!evYasamSubCategory && evYasamCategory) {
    evYasamSubCategory = await prisma.subCategory.create({
      data: {
        name: 'Temizlik Ürünleri',
        description: 'Süpürge, temizlik robotu vb.',
        mainCategoryId: evYasamCategory.id,
        imageUrl: null, // ID oluşturulduktan sonra güncellenecek
      },
    });
    // Sub category imageUrl güncelle
    await prisma.subCategory.update({
      where: { id: evYasamSubCategory.id },
      data: {
        imageUrl: HOME_APPLIANCE_IMAGE
      }
    });
  }

  // Tech subcategories (ensure SmartPhones exists)
  const akilliTelefonSubCat = await prisma.subCategory.upsert({
    where: {
      id: (await prisma.subCategory.findFirst({ where: { name: 'Akıllı Telefonlar' } }))?.id || '00000000-0000-0000-0000-00000000a001',
    },
    update: { name: 'Akıllı Telefonlar', description: 'iPhone, Android, Samsung, Xiaomi vs.', mainCategoryId: techCategory?.id },
    create: { name: 'Akıllı Telefonlar', description: 'iPhone, Android, Samsung, Xiaomi vs.', mainCategoryId: techCategory?.id! },
  }).catch(async () => prisma.subCategory.findFirst({ where: { name: 'Akıllı Telefonlar' } }));

  // Product groups and products
  const productGroup = await prisma.productGroup.create({
    data: {
      name: 'Dyson Vakum Temizleyiciler',
      description: 'Dyson marka vakum temizleyiciler',
      subCategoryId: evYasamSubCategory?.id!,
      imageUrl: null, // ID oluşturulduktan sonra güncellenecek
    },
  });
  // Product group imageUrl güncelle
  await prisma.productGroup.update({
    where: { id: productGroup.id },
    data: {
      imageUrl: HOME_APPLIANCE_IMAGE
    }
  });

  const product1 = await prisma.product.create({
    data: {
      name: 'Dyson V15s Detect Submarine',
      brand: 'Dyson',
      description: 'Gelişmiş sensörlü kablosuz süpürge',
      groupId: productGroup.id,
      imageUrl: null, // ID oluşturulduktan sonra güncellenecek
    },
  });
  // Product imageUrl güncelle
  await prisma.product.update({
    where: { id: product1.id },
    data: {
      imageUrl: DYSON_PRODUCT_IMAGE
    }
  });

  const product2 = await prisma.product.create({
    data: {
      name: 'Dyson V12 Detect Slim',
      brand: 'Dyson',
      description: 'Hafif ve güçlü kablosuz süpürge',
      groupId: productGroup.id,
      imageUrl: null, // ID oluşturulduktan sonra güncellenecek
    },
  });
  // Product imageUrl güncelle
  await prisma.product.update({
    where: { id: product2.id },
    data: {
      imageUrl: DYSON_PRODUCT_IMAGE
    }
  });

  const phoneProductGroup = await prisma.productGroup.create({
    data: {
      name: 'Apple iPhone Serisi',
      description: 'Apple iPhone modelleri',
      subCategoryId: akilliTelefonSubCat?.id!,
      imageUrl: null, // ID oluşturulduktan sonra güncellenecek
    },
  });
  // Product group imageUrl güncelle
  await prisma.productGroup.update({
    where: { id: phoneProductGroup.id },
    data: {
      imageUrl: PHONE_IMAGE
    }
  });

  const product3 = await prisma.product.create({
    data: {
      name: 'iPhone 15 Pro',
      brand: 'Apple',
      description: "Apple'ın en yeni flagship telefonu",
      groupId: phoneProductGroup.id,
      imageUrl: null, // ID oluşturulduktan sonra güncellenecek
    },
  });
  // Product imageUrl güncelle
  await prisma.product.update({
    where: { id: product3.id },
    data: {
      imageUrl: MACBOOK_PRODUCT_IMAGE
    }
  });

  // Inventory & Product Experience for TEST_USER
  const userIdToUse = (await prisma.user.findUnique({ where: { id: TEST_USER_ID } }))?.id || (await prisma.user.findFirst())?.id!;
  const inventory1 = await prisma.inventory.create({
    data: {
      userId: userIdToUse,
      productId: product1.id,
      hasOwned: true,
      experienceSummary: 'Mükemmel bir ürün, günlük kullanımda çok etkili',
    },
  });

  await prisma.productExperience.create({
    data: {
      inventoryId: inventory1.id,
      title: 'Price and Shopping Experience',
      experienceText:
        "Dyson V15s Detect Submarine'i $949'a aldım. Premium fiyat diğer kablosuz süpürgelere göre ama kalitesi buna değer. Alışveriş deneyimi çok profesyonel.",
    },
  });

  await prisma.productExperience.create({
    data: {
      inventoryId: inventory1.id,
      title: 'Product and Usage Experience',
      experienceText:
        'Günlük kullanımda Dyson V15s Submarine ev temizliğimi tamamen değiştirdi. Islak temizlik başlığı mutfak ve banyo zeminleri için mükemmel çalışıyor, döküntüleri hemen topluyor.',
    },
  });

  await prisma.inventoryMedia.create({
    data: {
      inventoryId: inventory1.id,
      mediaUrl: INVENTORY_MEDIA_URL,
      type: 'IMAGE',
    },
  });

  // Content Posts: FREE
  const freePostId = generateUlid();
  await prisma.contentPost.create({
    data: {
      id: freePostId,
      userId: userIdToUse,
      type: 'FREE',
      title: 'Dyson V15s Daily Experience',
      body: 'Using the Dyson V15s Submarine daily has completely changed how I clean my home... ',
      productId: product1.id,
      mainCategoryId: evYasamCategory?.id!,
      subCategoryId: evYasamSubCategory?.id!,
      inventoryRequired: true,
      isBoosted: false,
    },
  });

  await prisma.contentPostTag.createMany({
    data: [
      { postId: freePostId, tag: 'Dyson' },
      { postId: freePostId, tag: 'Vacuum Cleaner' },
      { postId: freePostId, tag: 'Home Cleaning' },
    ],
    skipDuplicates: true,
  });

  // TIPS Post
  const tipsPostId = generateUlid();
  await prisma.contentPost.create({
    data: {
      id: tipsPostId,
      userId: userIdToUse,
      type: 'TIPS',
      title: 'Dyson Maintenance Tips',
      body: "Dyson V15s'i uzun süre kullanmak için düzenli olarak filtreleri temizlemek...",
      productId: product1.id,
      mainCategoryId: evYasamCategory?.id!,
      subCategoryId: evYasamSubCategory?.id!,
      inventoryRequired: true,
      isBoosted: false,
    },
  });

  await prisma.postTip.create({ data: { postId: tipsPostId, tipCategory: 'CARE', isVerified: true } });
  await prisma.postTag.create({ data: { postId: tipsPostId, tag: 'Maintenance' } });
  await prisma.contentPostTag.createMany({
    data: [
      { postId: tipsPostId, tag: 'Maintenance' },
      { postId: tipsPostId, tag: 'Care Tips' },
    ],
    skipDuplicates: true,
  });

  // COMPARE Post
  const comparePostId = generateUlid();
  await prisma.contentPost.create({
    data: {
      id: comparePostId,
      userId: userIdToUse,
      type: 'COMPARE',
      title: 'Dyson V15s vs V12 Slim Comparison',
      body: 'Her iki modeli de test ettim...',
      productId: product1.id,
      mainCategoryId: evYasamCategory?.id!,
      subCategoryId: evYasamSubCategory?.id!,
      inventoryRequired: false,
      isBoosted: true,
    },
  });

  const comparison = await prisma.postComparison.create({
    data: {
      postId: comparePostId,
      product1Id: product1.id,
      product2Id: product2.id,
      comparisonSummary: 'V15s daha güçlü ama daha ağır, V12 daha pratik ama daha az güçlü',
    },
  });

  const fiyatMetric = await prisma.comparisonMetric.findFirst({ where: { name: 'Fiyat' } });
  const kaliteMetric = await prisma.comparisonMetric.findFirst({ where: { name: 'Kalite' } });
  if (fiyatMetric)
    await prisma.postComparisonScore.create({
      data: { comparisonId: comparison.id, metricId: fiyatMetric.id, scoreProduct1: 7, scoreProduct2: 8, comment: 'V12 daha uygun fiyatlı' },
    });
  if (kaliteMetric)
    await prisma.postComparisonScore.create({
      data: { comparisonId: comparison.id, metricId: kaliteMetric.id, scoreProduct1: 9, scoreProduct2: 8, comment: 'V15s kalite açısından daha üstün' },
    });

  // More FREE posts (kontrollü sayıda)
  for (let i = 0; i < EXTRA_FREE_POST_COUNT; i++) {
    const postId = generateUlid();
    await prisma.contentPost.create({
      data: {
        id: postId,
        userId: userIdToUse,
        type: 'FREE',
        title: `Tech Review Post ${i + 1}`,
        body: `This is a sample review post ${i + 1}. Sharing my experience with various tech products and how they fit into my daily life.`,
        productId: i % 2 === 0 ? product1.id : product3.id,
        mainCategoryId: i % 2 === 0 ? evYasamCategory?.id! : techCategory?.id!,
        subCategoryId: i % 2 === 0 ? evYasamSubCategory?.id! : akilliTelefonSubCat?.id!,
        inventoryRequired: i % 2 === 0,
        isBoosted: i === 0,
      },
    });
  }

  // Comments
  const commentsTargets = await prisma.contentPost.findMany({ where: { userId: userIdToUse }, take: 3 });
  for (const post of commentsTargets) {
    await prisma.contentComment.create({
      data: {
        id: generateUlid(),
        postId: post.id,
        userId: userIdToUse,
        comment: `Great post about ${post.title}! I have similar experience.`,
        isAnswer: false,
      },
    });
  }

  // Likes & Favorites & Views
  const allPosts = await prisma.contentPost.findMany({ where: { userId: userIdToUse } });
  for (const post of allPosts.slice(0, 3)) {
    await prisma.contentLike.create({ data: { userId: userIdToUse, postId: post.id } }).catch(() => {});
    if (allPosts.indexOf(post) % 2 === 0) {
      await prisma.contentFavorite.create({ data: { userId: userIdToUse, postId: post.id } }).catch(() => {});
    }
  }
  for (const post of allPosts.slice(0, 2)) {
    await prisma.contentPostView.create({ data: { postId: post.id, userId: userIdToUse, viewerIp: '127.0.0.1' } }).catch(() => {});
  }
  console.log('🎉 Content seeding completed');
}

if (require.main === module) {
  seedProductsAndContent()
    .catch((e) => {
      console.error('❌ Content seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}


