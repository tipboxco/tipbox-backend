import { prisma, generateUlid, TEST_USER_ID, TARGET_USER_ID, TRUST_USER_IDS } from './types';
import { getSeedMediaPath } from './helpers/media.helper';
import { S3Service } from '../../src/infrastructure/s3/s3.service';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

// Wishbox istatistikleri için kullanılacak maksimum kullanıcı sayısı (default: 5)
const MAX_WISHBOX_STATS_USERS = Number.parseInt(process.env.SEED_WISHBOX_USER_LIMIT || '5', 10);

export async function seedExplore(): Promise<void> {
  console.log('🔍 [seed] explore (full)');
  
  // Marketplace banner görsellerini MinIO'ya yükle
  const s3Service = new S3Service();
  const exploreImagePaths: string[] = [];
  
  const imageFiles = [
    { localPath: path.join(__dirname, '../../../tests/assets/explore/explorebanners.png'), fileName: 'explorebanners.png' },
    { localPath: path.join(__dirname, '../../../tests/assets/explore/explorebanners2.png'), fileName: 'explorebanners2.png' },
  ];
  
  console.log('📸 Marketplace banner görselleri MinIO\'ya yükleniyor...');
  for (const imageFile of imageFiles) {
    try {
      if (!existsSync(imageFile.localPath)) {
        console.warn(`⚠️  Görsel dosyası bulunamadı: ${imageFile.localPath}`);
        continue;
      }
      
      const minioPath = `Explore/${imageFile.fileName}`;
      
      // MinIO'da dosyanın mevcut olup olmadığını kontrol et
      const exists = await s3Service.fileExists(minioPath);
      
      if (!exists) {
        const fileBuffer = readFileSync(imageFile.localPath);
        await s3Service.uploadFile(minioPath, fileBuffer, 'image/png');
        console.log(`✅ Görsel yüklendi: ${minioPath}`);
      } else {
        console.log(`⏭️  Görsel zaten mevcut: ${minioPath}`);
      }
      
      exploreImagePaths.push(minioPath);
    } catch (error) {
      console.error(`❌ Görsel yüklenemedi: ${imageFile.fileName}`, error);
    }
  }
  
  // Marketplace banners - 2 tane oluştur
  if (exploreImagePaths.length >= 2) {
    await Promise.all([
      prisma.marketplaceBanner.create({
        data: {
          title: 'Yeni Sezon NFT Koleksiyonu',
          description: "Sınırlı sayıda özel avatar ve badge NFT'leri şimdi satışta!",
          imageUrl: exploreImagePaths[0]!,
          linkUrl: '/marketplace/listings?type=BADGE',
          isActive: true,
          displayOrder: 1,
        },
      }),
      prisma.marketplaceBanner.create({
        data: {
          title: 'Epic Rarity İndirimi',
          description: "%30 indirimli EPIC rarity NFT'lere göz at",
          imageUrl: exploreImagePaths[1]!,
          linkUrl: '/marketplace/listings?rarity=EPIC',
          isActive: true,
          displayOrder: 2,
        },
      }),
    ]).catch((error) => {
      console.warn('⚠️  Marketplace banner oluşturulurken hata:', error);
    });
    console.log('✅ Marketplace banner\'lar oluşturuldu');
  } else {
    console.warn('⚠️  Yeterli görsel yüklenemedi, marketplace banner\'lar oluşturulamadı');
  }

  // Brands (subset matching original names) - logoUrl seed media üzerinden
  await Promise.all(
    [
      { name: 'TechVision', description: 'Yenilikçi teknoloji ürünleri ve çözümleri sunan global marka', category: 'Technology', logoKey: 'explore.event.primary' },
      { name: 'SmartHome Pro', description: 'Akıllı ev sistemleri ve IoT cihazları konusunda uzman', category: 'Home & Living', logoKey: 'explore.event.primary' },
      { name: 'CoffeeDelight', description: 'Premium kahve makineleri ve barista ekipmanları', category: 'Kitchen', logoKey: 'explore.event.primary' },
      { name: 'FitnessTech', description: 'Akıllı spor ekipmanları ve sağlık takip cihazları', category: 'Health & Fitness', logoKey: 'explore.event.primary' },
      { name: 'StyleHub', description: 'Modern ve şık yaşam ürünleri markası', category: 'Fashion', logoKey: 'explore.event.primary' },
      { name: 'AutoParts Pro', description: 'Otomotiv yedek parça ve aksesuarları', category: 'Automotive', logoKey: 'explore.event.primary' },
    ].map((b) =>
      prisma.brand
        .create({
          data: { name: b.name, description: b.description, category: b.category, logoUrl: getSeedMediaPath(b.logoKey as any) },
        })
        .catch(() => null)
    )
  );

  // Wishbox events
  const today = new Date();
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(new Date().setMonth(today.getMonth() + 1));
  const events = await Promise.all([
    prisma.wishboxEvent.create({
      data: {
        id: generateUlid(),
        title: 'Yılbaşı Mega Ödül Anketi',
        description: 'Yılın en iyi ürünlerini belirle, büyük ödüller kazan! 1000 TIPS havuzu seni bekliyor.',
        startDate: today,
        endDate: nextMonth,
        status: 'PUBLISHED',
        eventType: 'SURVEY',
      },
    }),
    prisma.wishboxEvent.create({
      data: {
        id: generateUlid(),
        title: 'Teknoloji Trendleri 2024',
        description: 
          "2024'ün en çok beklenen teknoloji ürünlerini seçiyoruz. Senin tercihin ne?",
        startDate: today,
        endDate: nextWeek,
        status: 'PUBLISHED',
        eventType: 'POLL',
      },
    }),
    prisma.wishboxEvent.create({
      data: {
        id: generateUlid(),
        title: 'Kahve Tutkunlarının Anketi',
        description:
          'En iyi kahve makinesi hangisi? Kahve severlerin tercihleri bu etkinlikte belirleniyor.',
        startDate: today,
        endDate: nextWeek,
        status: 'PUBLISHED',
        eventType: 'CONTEST',
      },
    }),
  ]).catch(() => [] as any);

  if (events && events.length >= 3) {
    await Promise.all([
      prisma.wishboxScenario.create({
        data: { eventId: events[0].id, title: 'Yılın En İyi Telefonu', description: 'Hangi telefon 2024\'ün şampiyonu olmalı?', orderIndex: 1 },
      }),
      prisma.wishboxScenario.create({
        data: { eventId: events[0].id, title: "Yılın En İyi Laptop'u", description: 'En iyi performansı hangi laptop verdi?', orderIndex: 2 },
      }),
      prisma.wishboxScenario.create({
        data: { eventId: events[1].id, title: 'En Beklenen Akıllı Saat', description: '2024\'te hangi akıllı saati almayı düşünüyorsun?', orderIndex: 1 },
      }),
      prisma.wishboxScenario.create({
        data: { eventId: events[2].id, title: 'Tam Otomatik vs Manuel', description: 'Tam otomatik mı, manuel kahve makinesi mi?', orderIndex: 1 },
      }),
    ]).catch(() => {});

    const allUserIds = [
      (await prisma.user.findUnique({ where: { id: TEST_USER_ID } }))?.id,
      (await prisma.user.findUnique({ where: { id: TARGET_USER_ID } }))?.id,
      ...TRUST_USER_IDS,
    ].filter(Boolean) as string[];

    const limitedUserIds = allUserIds.slice(0, MAX_WISHBOX_STATS_USERS);

    await Promise.all(
      events.flatMap((event: any) =>
        limitedUserIds.map((userId) =>
          prisma.wishboxStats.create({
            data: {
              userId,
              eventId: event.id,
              totalParticipated: Math.floor(Math.random() * 5) + 1,
              totalComments: Math.floor(Math.random() * 10),
              helpfulVotesReceived: Math.floor(Math.random() * 20),
            },
          }).catch(() => null)
        )
      )
    );
  }

  // Yeni product'lar ve inventory media'ları ekle (explore/products/new için)
  console.log('📦 Creating new products with inventory media for explore...');
  const techCategory = await prisma.mainCategory.findFirst({ where: { name: 'Teknoloji' } });
  const evYasamCategory = await prisma.mainCategory.findFirst({ where: { name: 'Ev & Yaşam' } });
  
  if (techCategory && evYasamCategory) {
    const techSubCategory = await prisma.subCategory.findFirst({ where: { mainCategoryId: techCategory.id } });
    const evYasamSubCategory = await prisma.subCategory.findFirst({ where: { mainCategoryId: evYasamCategory.id } });

    if (techSubCategory && evYasamSubCategory) {
      let techGroup = await prisma.productGroup.findFirst({ where: { subCategoryId: techSubCategory.id } });
      if (!techGroup) {
        techGroup = await prisma.productGroup.create({
          data: {
            name: 'Explore Tech Products',
            description: 'Explore için teknoloji ürünleri',
            subCategoryId: techSubCategory.id,
            imageUrl: getSeedMediaPath('product.laptop.macbook'),
          },
        });
      }
      
      let homeGroup = await prisma.productGroup.findFirst({ where: { subCategoryId: evYasamSubCategory.id } });
      if (!homeGroup) {
        homeGroup = await prisma.productGroup.create({
          data: {
            name: 'Explore Home Products',
            description: 'Explore için ev ürünleri',
            subCategoryId: evYasamSubCategory.id,
            imageUrl: getSeedMediaPath('product.vacuum.dyson'),
          },
        });
      }
      
      const productGroups = [techGroup, homeGroup];

      const exploreProducts = [
        { name: 'FitnessTech Heart Rate Monitor', brand: 'FitnessTech', group: productGroups[0]!, mediaKey: 'product.explore.1' },
        { name: 'FitnessTech Dumbbells', brand: 'FitnessTech', group: productGroups[0]!, mediaKey: 'product.explore.2' },
        { name: 'FitnessTech Yoga Mat', brand: 'FitnessTech', group: productGroups[0]!, mediaKey: 'product.explore.3' },
        { name: 'SmartHome Pro Smart Light', brand: 'SmartHome Pro', group: productGroups[1]!, mediaKey: 'product.explore.4' },
        { name: 'SmartHome Pro Thermostat', brand: 'SmartHome Pro', group: productGroups[1]!, mediaKey: 'product.explore.5' },
        { name: 'TechVision Smart Watch', brand: 'TechVision', group: productGroups[0]!, mediaKey: 'product.explore.6' },
        { name: 'TechVision Wireless Earbuds', brand: 'TechVision', group: productGroups[0]!, mediaKey: 'product.explore.7' },
        { name: 'CoffeeDelight Espresso Machine', brand: 'CoffeeDelight', group: productGroups[1]!, mediaKey: 'product.explore.8' },
        { name: 'StyleHub Designer Lamp', brand: 'StyleHub', group: productGroups[1]!, mediaKey: 'product.explore.9' },
        { name: 'StyleHub Modern Chair', brand: 'StyleHub', group: productGroups[1]!, mediaKey: 'product.explore.10' },
      ];

      const userIdToUse = (await prisma.user.findUnique({ where: { id: TEST_USER_ID } }))?.id || (await prisma.user.findFirst())?.id;
      
      if (userIdToUse) {
        for (const productData of exploreProducts) {
          try {
            const product = await prisma.product.create({
              data: {
                name: productData.name,
                brand: productData.brand,
                description: `Yeni eklenen ${productData.name} ürünü`,
                groupId: productData.group.id,
                imageUrl: getSeedMediaPath(productData.mediaKey as any),
              },
            });

            // Inventory oluştur
            const inventory = await prisma.inventory.create({
              data: {
                userId: userIdToUse,
                productId: product.id,
                hasOwned: true,
                experienceSummary: `${productData.name} hakkında deneyim paylaşımı`,
              },
            });

            // Inventory media ekle
            const mediaUrl = getSeedMediaPath(productData.mediaKey as any);
            if (mediaUrl) {
              await prisma.inventoryMedia.create({
                data: {
                  inventoryId: inventory.id,
                  mediaUrl,
                },
              });
            }
          } catch (error) {
            // Product zaten varsa veya hata oluşursa devam et
            console.warn(`Product oluşturulamadı: ${productData.name}`, error);
          }
        }
      }
    }
  }

  console.log('🎉 Explore seeding completed');
}

if (require.main === module) {
  seedExplore()
    .catch((e) => {
      console.error('❌ Explore seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}


