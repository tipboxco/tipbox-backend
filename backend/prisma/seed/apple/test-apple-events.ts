import { seedAppleEvents } from './apple-events.seed';
import { seedAppleBrand } from './apple-brand.seed';
import { prisma } from '../types';

async function testAppleEvents() {
  console.log('🧪 Testing Apple Events Seed...\n');

  try {
    // Önce brand'ı oluştur
    const brandResult = await seedAppleBrand();
    console.log(`✅ Brand ID: ${brandResult.brandId}\n`);

    // Events seed'i çalıştır
    const result = await seedAppleEvents(brandResult.brandId);
    console.log('\n✅ Events seed başarılı!\n');

    // DB'den kontrol et
    console.log('📊 DB Kontrolü:\n');

    const event = await prisma.wishboxEvent.findUnique({
      where: { id: result.eventId },
      include: {
        brand: true,
        mainCategory: true,
        eventBadges: {
          include: {
            badge: true,
          },
          orderBy: {
            displayOrder: 'asc',
          },
        },
      },
    });

    if (!event) {
      console.error('❌ Event bulunamadı!');
      process.exit(1);
    }

    console.log(`🎉 Event: ${event.title}`);
    console.log(`   ID: ${event.id}`);
    console.log(`   Description: ${event.description || 'N/A'}`);
    console.log(`   Brand: ${event.brand?.name || 'N/A'}`);
    console.log(`   Category: ${event.mainCategory?.name || 'N/A'}`);
    console.log(`   Status: ${event.status}`);
    console.log(`   Start Date: ${event.startDate.toISOString()}`);
    console.log(`   End Date: ${event.endDate.toISOString()}`);
    console.log(`   Challenges Count: ${event.eventBadges.length}\n`);

    console.log('🏆 Challenges:');
    event.eventBadges.forEach((eventBadge, index) => {
      console.log(`\n   ${index + 1}. ${eventBadge.badge.name}`);
      console.log(`      Description: ${eventBadge.badge.description}`);
      console.log(`      Requirement Type: ${eventBadge.requirementType}`);
      console.log(`      Threshold: ${eventBadge.threshold}`);
      console.log(`      Rarity: ${eventBadge.badge.rarity}`);
      console.log(`      Display Order: ${eventBadge.displayOrder}`);
      console.log(`      Enabled: ${eventBadge.enabled}`);
    });

    // İstatistikler
    const totalBadges = await prisma.badge.count({
      where: {
        categoryId: event.eventBadges[0]?.badge.categoryId,
      },
    });

    console.log(`\n📈 İstatistikler:`);
    console.log(`   Total Event Badges: ${event.eventBadges.length}`);
    console.log(`   Total Badges in Category: ${totalBadges}`);

    console.log('\n✅ Tüm kontroller başarılı!\n');
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testAppleEvents();
