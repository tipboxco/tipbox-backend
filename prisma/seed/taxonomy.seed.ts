import { prisma } from './types';
import { getSeedMediaPath } from './helpers/media.helper';

export async function seedTaxonomy(): Promise<void> {
  console.log('📱 [seed] user themes');
  const themeConfigs = [
    { name: 'Light', description: 'Açık tema - günün her saati için ideal' },
    { name: 'Dark', description: 'Koyu tema - gözleri yormaz, modern görünüm' },
    { name: 'Auto', description: 'Otomatik - sistem temasını takip eder' },
  ];
  
  await Promise.all(
    themeConfigs.map(async (config) => {
      const existing = await prisma.userTheme.findFirst({ where: { name: config.name } });
      if (existing) return existing;
      return prisma.userTheme.create({ data: config });
    })
  );

  console.log('📂 [seed] main categories');
  // Görsel eşleştirmeleri: kategori isimlerine göre seed media key'leri
  const categoryImageKeyMap: Record<string, string | null> = {
    // Product Catalog kategorileri (görselleri product-catalog.seed.ts'de ayarlanacak)
    'Cosmetics': null, // product-catalog.seed.ts'de ayarlanacak
    'Electronics': null, // product-catalog.seed.ts'de ayarlanacak
    'Sports Outdoors': null, // product-catalog.seed.ts'de ayarlanacak
    // Diğer kategoriler
    'Teknoloji': 'catalog.computers-tablets',
    'Ev & Yaşam': 'catalog.home-appliances',
    'Gıda & İçecek': 'catalog.air-conditioner', // Rastgele eşleştirme
    'Moda & Aksesuar': 'catalog.printers', // Rastgele eşleştirme
    'Sağlık & Güzellik': 'catalog.smart-home-devices', // Rastgele eşleştirme
    'Spor & Outdoor': 'catalog.drone', // Rastgele eşleştirme
    'Hobi & Eğlence': 'catalog.games',
    'Otomotiv': 'catalog.otomotiv',
  };

  const mainCategoryConfigs = [
    // Öncelikli kategoriler (Product Catalog'dan seed edilecek)
    { name: 'Cosmetics', description: 'Kozmetik, kişisel bakım, güzellik ürünleri' },
    { name: 'Electronics', description: 'Elektronik cihazlar, teknoloji ürünleri' },
    { name: 'Sports Outdoors', description: 'Spor ekipmanları, outdoor aktiviteler, fitness' },
    // Diğer kategoriler
    { name: 'Teknoloji', description: 'Elektronik cihazlar, yazılım, mobil uygulamalar' },
    { name: 'Ev & Yaşam', description: 'Ev eşyaları, dekorasyon, temizlik ürünleri' },
    { name: 'Gıda & İçecek', description: 'Yiyecek, içecek, gıda takviyesi ürünleri' },
    { name: 'Moda & Aksesuar', description: 'Giyim, ayakkabı, çanta, takı ve aksesuarlar' },
    { name: 'Sağlık & Güzellik', description: 'Kişisel bakım, kozmetik, sağlık ürünleri' },
    { name: 'Spor & Outdoor', description: 'Spor ekipmanları, outdoor aktiviteler, fitness' },
    { name: 'Hobi & Eğlence', description: 'Kitap, oyun, müzik, sanat malzemeleri' },
    { name: 'Otomotiv', description: 'Araç aksesuarları, bakım ürünleri, parçalar' },
  ];

  const mainCategories = await Promise.all(
    mainCategoryConfigs.map(async (config) => {
      const existing = await prisma.mainCategory.findFirst({ where: { name: config.name } });
      if (existing) return existing;
      return prisma.mainCategory.create({ 
        data: { 
          ...config,
          imageUrl: null // ID oluşturulduktan sonra güncellenecek
        } 
      });
    })
  );

  // Kategoriler oluşturulduktan sonra imageUrl'leri seed media üzerinden güncelle
  for (const category of mainCategories) {
    const key = categoryImageKeyMap[category.name];
    if (key) {
      await prisma.mainCategory.update({
        where: { id: category.id },
        data: {
          imageUrl: getSeedMediaPath(key as any),
        },
      });
    }
  }

  console.log('🏆 [seed] badge categories');
  const badgeCategoryConfigs = [
    { name: 'Achievement', description: 'Başarı rozetleri - belirli hedeflere ulaşma' },
    { name: 'Event', description: 'Etkinlik rozetleri - özel günler ve kampanyalar' },
    { name: 'Cosmetic', description: 'Kozmetik rozetler - görsel özelleştirme' },
    { name: 'Community', description: 'Topluluk rozetleri - sosyal aktiviteler' },
  ];

  await Promise.all(
    badgeCategoryConfigs.map(async (config) => {
      const existing = await prisma.badgeCategory.findFirst({ where: { name: config.name } });
      if (existing) return existing;
      return prisma.badgeCategory.create({ data: config });
    })
  );

  // Default badges
  const achievementCategory = await prisma.badgeCategory.findFirst({ where: { name: 'Achievement' } });
  const communityCategory = await prisma.badgeCategory.findFirst({ where: { name: 'Community' } });
  const eventCategory = await prisma.badgeCategory.findFirst({ where: { name: 'Event' } });
  
  if (achievementCategory && communityCategory && eventCategory) {
    const badgeConfigs = [
      {
        name: 'Welcome',
        description: "Tipbox'a hoş geldin! İlk kayıt rozetin.",
        type: 'ACHIEVEMENT' as const,
        rarity: 'COMMON' as const,
        boostMultiplier: 1.0,
        rewardMultiplier: 1.0,
        categoryId: achievementCategory.id,
      },
      {
        name: 'First Post',
        description: 'İlk gönderini paylaştın! İyi başlangıç.',
        type: 'ACHIEVEMENT' as const,
        rarity: 'COMMON' as const,
        boostMultiplier: 1.1,
        rewardMultiplier: 1.1,
        categoryId: achievementCategory.id,
      },
      {
        name: 'Tip Master',
        description: '10 faydalı ipucu paylaştın. Sen bir uzman!',
        type: 'ACHIEVEMENT' as const,
        rarity: 'RARE' as const,
        boostMultiplier: 1.3,
        rewardMultiplier: 1.3,
        categoryId: achievementCategory.id,
      },
      {
        name: 'Community Hero',
        description: '100 faydalı yorum yaptın. Topluluk kahramanı!',
        type: 'ACHIEVEMENT' as const,
        rarity: 'EPIC' as const,
        boostMultiplier: 1.5,
        rewardMultiplier: 1.5,
        categoryId: communityCategory.id,
      },
      {
        name: 'Early Bird',
        description: "Tipbox'un ilk kullanıcılarından birisin!",
        type: 'EVENT' as const,
        rarity: 'RARE' as const,
        boostMultiplier: 1.2,
        rewardMultiplier: 1.4,
        categoryId: eventCategory.id,
      },
      {
        name: 'Beta Tester',
        description: 'Beta sürecinde bize yardım ettin. Teşekkürler!',
        type: 'EVENT' as const,
        rarity: 'EPIC' as const,
        boostMultiplier: 1.4,
        rewardMultiplier: 1.6,
        categoryId: eventCategory.id,
      },
    ];

    await Promise.all(
      badgeConfigs.map(async (config) => {
        const existing = await prisma.badge.findFirst({ where: { name: config.name } });
        if (existing) return existing;
        return prisma.badge.create({ data: config });
      })
    );
  }

  console.log('📊 [seed] comparison metrics');
  await Promise.all([
    prisma.comparisonMetric.create({ data: { name: 'Fiyat', description: 'Ürünün fiyat performansı (1-10)' } }),
    prisma.comparisonMetric.create({ data: { name: 'Kalite', description: 'Ürünün genel kalitesi (1-10)' } }),
    prisma.comparisonMetric.create({ data: { name: 'Kullanım Kolaylığı', description: 'Ürünün ne kadar kolay kullanıldığı (1-10)' } }),
    prisma.comparisonMetric.create({ data: { name: 'Dayanıklılık', description: 'Ürünün ne kadar uzun süre dayandığı (1-10)' } }),
    prisma.comparisonMetric.create({ data: { name: 'Tasarım', description: 'Ürünün görsel tasarımı ve estetik (1-10)' } }),
    prisma.comparisonMetric.create({ data: { name: 'Müşteri Hizmetleri', description: 'Markanın müşteri hizmetleri kalitesi (1-10)' } }),
    prisma.comparisonMetric.create({ data: { name: 'Özellikler', description: 'Ürünün sahip olduğu özellikler (1-10)' } }),
    prisma.comparisonMetric.create({ data: { name: 'Çevre Dostu', description: 'Ürünün çevreye olan etkisi (1-10)' } }),
  ]).catch(() => {});

  console.log('🚀 [seed] boost options');
  const boostOptionConfigs = [
    { title: 'Standard Boost', description: 'Standart görünürlük artışı', amount: 0, isPopular: false, isActive: true },
    { title: 'Popular Boost', description: 'Popüler gönderiler için özel boost', amount: 10, isPopular: true, isActive: true },
    { title: 'Premium Boost', description: 'Maksimum görünürlük için premium boost', amount: 25, isPopular: true, isActive: true },
  ];

  await Promise.all(
    boostOptionConfigs.map(async (config) => {
      const existing = await (prisma as any).boostOption.findFirst({ where: { title: config.title } });
      if (existing) return existing;
      return (prisma as any).boostOption.create({ data: config });
    })
  );

  console.log('⏱️ [seed] experience durations');
  const experienceDurationConfigs = [
    { name: 'Less than 1 month', isActive: true },
    { name: '1-3 months', isActive: true },
    { name: '3-6 months', isActive: true },
    { name: '6-12 months', isActive: true },
    { name: 'More than 1 year', isActive: true },
  ];

  await Promise.all(
    experienceDurationConfigs.map(async (config) => {
      const existing = await (prisma as any).experienceDuration.findFirst({ where: { name: config.name } });
      if (existing) return existing;
      return (prisma as any).experienceDuration.create({ data: config });
    })
  );

  console.log('📍 [seed] experience locations');
  const experienceLocationConfigs = [
    { name: 'Home', isActive: true },
    { name: 'Office', isActive: true },
    { name: 'Outdoor', isActive: true },
    { name: 'Other', isActive: true },
  ];

  await Promise.all(
    experienceLocationConfigs.map(async (config) => {
      const existing = await (prisma as any).experienceLocation.findFirst({ where: { name: config.name } });
      if (existing) return existing;
      return (prisma as any).experienceLocation.create({ data: config });
    })
  );

  console.log('🎯 [seed] experience purposes');
  const experiencePurposeConfigs = [
    { name: 'Personal use', isActive: true },
    { name: 'Professional use', isActive: true },
    { name: 'Gift', isActive: true },
    { name: 'Other', isActive: true },
  ];

  await Promise.all(
    experiencePurposeConfigs.map(async (config) => {
      const existing = await (prisma as any).experiencePurpose.findFirst({ where: { name: config.name } });
      if (existing) return existing;
      return (prisma as any).experiencePurpose.create({ data: config });
    })
  );

  console.log('🎉 Taxonomy seeding completed');
}

if (require.main === module) {
  seedTaxonomy()
    .catch((e) => {
      console.error('❌ Taxonomy seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}


