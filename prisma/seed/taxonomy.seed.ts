import { prisma } from './types';
import { getSeedMediaUrl } from './helpers/media.helper';

export async function seedTaxonomy(): Promise<void> {
  console.log('📱 [seed] user themes');
  await Promise.all([
    prisma.userTheme.create({ data: { name: 'Light', description: 'Açık tema - günün her saati için ideal' } }),
    prisma.userTheme.create({ data: { name: 'Dark', description: 'Koyu tema - gözleri yormaz, modern görünüm' } }),
    prisma.userTheme.create({ data: { name: 'Auto', description: 'Otomatik - sistem temasını takip eder' } }),
  ]).catch(() => {});

  console.log('📂 [seed] main categories');
  // Görsel eşleştirmeleri: kategori isimlerine göre seed media key'leri
  const categoryImageKeyMap: Record<string, string | null> = {
    'Teknoloji': 'catalog.computers-tablets',
    'Ev & Yaşam': 'catalog.home-appliances',
    'Gıda & İçecek': 'catalog.air-conditioner', // Rastgele eşleştirme
    'Moda & Aksesuar': 'catalog.printers', // Rastgele eşleştirme
    'Sağlık & Güzellik': 'catalog.smart-home-devices', // Rastgele eşleştirme
    'Spor & Outdoor': 'catalog.drone', // Rastgele eşleştirme
    'Hobi & Eğlence': 'catalog.games',
    'Otomotiv': 'catalog.otomotiv',
  };

  const mainCategories = await Promise.all([
    prisma.mainCategory.create({ 
      data: { 
        name: 'Teknoloji', 
        description: 'Elektronik cihazlar, yazılım, mobil uygulamalar',
        imageUrl: null // ID oluşturulduktan sonra güncellenecek
      } 
    }),
    prisma.mainCategory.create({ 
      data: { 
        name: 'Ev & Yaşam', 
        description: 'Ev eşyaları, dekorasyon, temizlik ürünleri',
        imageUrl: null // ID oluşturulduktan sonra güncellenecek
      } 
    }),
    prisma.mainCategory.create({ 
      data: { 
        name: 'Gıda & İçecek', 
        description: 'Yiyecek, içecek, gıda takviyesi ürünleri',
        imageUrl: null // ID oluşturulduktan sonra güncellenecek
      } 
    }),
    prisma.mainCategory.create({ 
      data: { 
        name: 'Moda & Aksesuar', 
        description: 'Giyim, ayakkabı, çanta, takı ve aksesuarlar',
        imageUrl: null // ID oluşturulduktan sonra güncellenecek
      } 
    }),
    prisma.mainCategory.create({ 
      data: { 
        name: 'Sağlık & Güzellik', 
        description: 'Kişisel bakım, kozmetik, sağlık ürünleri',
        imageUrl: null // ID oluşturulduktan sonra güncellenecek
      } 
    }),
    prisma.mainCategory.create({ 
      data: { 
        name: 'Spor & Outdoor', 
        description: 'Spor ekipmanları, outdoor aktiviteler, fitness',
        imageUrl: null // ID oluşturulduktan sonra güncellenecek
      } 
    }),
    prisma.mainCategory.create({ 
      data: { 
        name: 'Hobi & Eğlence', 
        description: 'Kitap, oyun, müzik, sanat malzemeleri',
        imageUrl: null // ID oluşturulduktan sonra güncellenecek
      } 
    }),
    prisma.mainCategory.create({ 
      data: { 
        name: 'Otomotiv', 
        description: 'Araç aksesuarları, bakım ürünleri, parçalar',
        imageUrl: null // ID oluşturulduktan sonra güncellenecek
      } 
    }),
  ]).catch(() => []);

  // Kategoriler oluşturulduktan sonra imageUrl'leri seed media üzerinden güncelle
  for (const category of mainCategories) {
    const key = categoryImageKeyMap[category.name];
    if (key) {
      await prisma.mainCategory.update({
        where: { id: category.id },
        data: {
          imageUrl: getSeedMediaUrl(key as any),
        },
      });
    }
  }

  console.log('🏆 [seed] badge categories');
  await Promise.all([
    prisma.badgeCategory.create({ data: { name: 'Achievement', description: 'Başarı rozetleri - belirli hedeflere ulaşma' } }),
    prisma.badgeCategory.create({ data: { name: 'Event', description: 'Etkinlik rozetleri - özel günler ve kampanyalar' } }),
    prisma.badgeCategory.create({ data: { name: 'Cosmetic', description: 'Kozmetik rozetler - görsel özelleştirme' } }),
    prisma.badgeCategory.create({ data: { name: 'Community', description: 'Topluluk rozetleri - sosyal aktiviteler' } }),
  ]).catch(() => {});

  // Default badges
  const achievementCategory = await prisma.badgeCategory.findFirst({ where: { name: 'Achievement' } });
  const communityCategory = await prisma.badgeCategory.findFirst({ where: { name: 'Community' } });
  const eventCategory = await prisma.badgeCategory.findFirst({ where: { name: 'Event' } });
  if (achievementCategory && communityCategory && eventCategory) {
    await Promise.all([
      prisma.badge.create({
        data: {
          name: 'Welcome',
          description: "Tipbox'a hoş geldin! İlk kayıt rozetin.",
          type: 'ACHIEVEMENT',
          rarity: 'COMMON',
          boostMultiplier: 1.0,
          rewardMultiplier: 1.0,
          categoryId: achievementCategory.id,
        },
      }),
      prisma.badge.create({
        data: {
          name: 'First Post',
          description: 'İlk gönderini paylaştın! İyi başlangıç.',
          type: 'ACHIEVEMENT',
          rarity: 'COMMON',
          boostMultiplier: 1.1,
          rewardMultiplier: 1.1,
          categoryId: achievementCategory.id,
        },
      }),
      prisma.badge.create({
        data: {
          name: 'Tip Master',
          description: '10 faydalı ipucu paylaştın. Sen bir uzman!',
          type: 'ACHIEVEMENT',
          rarity: 'RARE',
          boostMultiplier: 1.3,
          rewardMultiplier: 1.3,
          categoryId: achievementCategory.id,
        },
      }),
      prisma.badge.create({
        data: {
          name: 'Community Hero',
          description: '100 faydalı yorum yaptın. Topluluk kahramanı!',
          type: 'ACHIEVEMENT',
          rarity: 'EPIC',
          boostMultiplier: 1.5,
          rewardMultiplier: 1.5,
          categoryId: communityCategory.id,
        },
      }),
      prisma.badge.create({
        data: {
          name: 'Early Bird',
          description: 
            "Tipbox'un ilk kullanıcılarından birisin!",
          type: 'EVENT',
          rarity: 'RARE',
          boostMultiplier: 1.2,
          rewardMultiplier: 1.4,
          categoryId: eventCategory.id,
        },
      }),
      prisma.badge.create({
        data: {
          name: 'Beta Tester',
          description: 'Beta sürecinde bize yardım ettin. Teşekkürler!',
          type: 'EVENT',
          rarity: 'EPIC',
          boostMultiplier: 1.4,
          rewardMultiplier: 1.6,
          categoryId: eventCategory.id,
        },
      }),
    ]).catch(() => {});
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
  await Promise.all([
    (prisma as any).boostOption.create({
      data: {
        title: 'Standard Boost',
        description: 'Standart görünürlük artışı',
        amount: 0,
        isPopular: false,
        isActive: true,
      },
    }),
    (prisma as any).boostOption.create({
      data: {
        title: 'Popular Boost',
        description: 'Popüler gönderiler için özel boost',
        amount: 10,
        isPopular: true,
        isActive: true,
      },
    }),
    (prisma as any).boostOption.create({
      data: {
        title: 'Premium Boost',
        description: 'Maksimum görünürlük için premium boost',
        amount: 25,
        isPopular: true,
        isActive: true,
      },
    }),
  ]).catch(() => {});

  console.log('⏱️ [seed] experience durations');
  await Promise.all([
    (prisma as any).experienceDuration.create({ data: { name: 'Less than 1 month', isActive: true } }),
    (prisma as any).experienceDuration.create({ data: { name: '1-3 months', isActive: true } }),
    (prisma as any).experienceDuration.create({ data: { name: '3-6 months', isActive: true } }),
    (prisma as any).experienceDuration.create({ data: { name: '6-12 months', isActive: true } }),
    (prisma as any).experienceDuration.create({ data: { name: 'More than 1 year', isActive: true } }),
  ]).catch(() => {});

  console.log('📍 [seed] experience locations');
  await Promise.all([
    (prisma as any).experienceLocation.create({ data: { name: 'Home', isActive: true } }),
    (prisma as any).experienceLocation.create({ data: { name: 'Office', isActive: true } }),
    (prisma as any).experienceLocation.create({ data: { name: 'Outdoor', isActive: true } }),
    (prisma as any).experienceLocation.create({ data: { name: 'Other', isActive: true } }),
  ]).catch(() => {});

  console.log('🎯 [seed] experience purposes');
  await Promise.all([
    (prisma as any).experiencePurpose.create({ data: { name: 'Personal use', isActive: true } }),
    (prisma as any).experiencePurpose.create({ data: { name: 'Professional use', isActive: true } }),
    (prisma as any).experiencePurpose.create({ data: { name: 'Gift', isActive: true } }),
    (prisma as any).experiencePurpose.create({ data: { name: 'Other', isActive: true } }),
  ]).catch(() => {});

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


