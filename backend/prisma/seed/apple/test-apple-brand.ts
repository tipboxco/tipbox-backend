import { seedAppleBrand } from './apple-brand.seed';
import { prisma } from '../types';

async function testAppleBrand() {
  console.log('🧪 Testing Apple Brand Seed...\n');

  try {
    // Seed'i çalıştır
    const result = await seedAppleBrand();
    console.log('\n✅ Seed başarılı!');
    console.log(`   Brand ID: ${result.brandId}`);
    console.log(`   Category ID: ${result.categoryId}\n`);

    // DB'den kontrol et
    const appleBrand = await prisma.brand.findUnique({
      where: { id: result.brandId },
      include: {
        brandCategory: true,
      },
    });

    if (!appleBrand) {
      console.error('❌ Brand bulunamadı!');
      process.exit(1);
    }

    console.log('📊 DB Kontrolü:');
    console.log(`   Brand Name: ${appleBrand.name}`);
    console.log(`   Description: ${appleBrand.description}`);
    console.log(`   Category: ${appleBrand.brandCategory?.name || 'N/A'}`);
    console.log(`   Logo URL: ${appleBrand.logoUrl || 'N/A'}`);
    console.log(`   Banner URL: ${appleBrand.imageUrl || 'N/A'}`);
    console.log(`   Created At: ${appleBrand.createdAt}`);

    // Brand category kontrolü
    const brandCategory = await prisma.brandCategory.findUnique({
      where: { id: result.categoryId },
    });

    console.log(`\n📁 Brand Category:`);
    console.log(`   Name: ${brandCategory?.name || 'N/A'}`);
    console.log(`   Description: ${brandCategory?.description || 'N/A'}`);

    console.log('\n✅ Tüm kontroller başarılı!\n');
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testAppleBrand();
