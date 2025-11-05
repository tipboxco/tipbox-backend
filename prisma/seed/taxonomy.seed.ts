import { prisma } from './types';

export async function seedTaxonomy(): Promise<void> {
  console.log('📱 [seed] user themes');
  await Promise.all([
    prisma.userTheme.create({ data: { name: 'Light', description: 'Açık tema - günün her saati için ideal' } }),
    prisma.userTheme.create({ data: { name: 'Dark', description: 'Koyu tema - gözleri yormaz, modern görünüm' } }),
    prisma.userTheme.create({ data: { name: 'Auto', description: 'Otomatik - sistem temasını takip eder' } }),
  ]).catch(() => {});

  console.log('📂 [seed] main categories');
  await Promise.all([
    prisma.mainCategory.create({ data: { name: 'Teknoloji', description: 'Elektronik cihazlar, yazılım, mobil uygulamalar' } }),
    prisma.mainCategory.create({ data: { name: 'Ev & Yaşam', description: 'Ev eşyaları, dekorasyon, temizlik ürünleri' } }),
    prisma.mainCategory.create({ data: { name: 'Gıda & İçecek', description: 'Yiyecek, içecek, gıda takviyesi ürünleri' } }),
    prisma.mainCategory.create({ data: { name: 'Moda & Aksesuar', description: 'Giyim, ayakkabı, çanta, takı ve aksesuarlar' } }),
    prisma.mainCategory.create({ data: { name: 'Sağlık & Güzellik', description: 'Kişisel bakım, kozmetik, sağlık ürünleri' } }),
    prisma.mainCategory.create({ data: { name: 'Spor & Outdoor', description: 'Spor ekipmanları, outdoor aktiviteler, fitness' } }),
    prisma.mainCategory.create({ data: { name: 'Hobi & Eğlence', description: 'Kitap, oyun, müzik, sanat malzemeleri' } }),
    prisma.mainCategory.create({ data: { name: 'Otomotiv', description: 'Araç aksesuarları, bakım ürünleri, parçalar' } }),
  ]).catch(() => {});

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
}


