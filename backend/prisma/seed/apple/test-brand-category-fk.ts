import { seedAppleBrand } from './apple-brand.seed';
import { prisma } from '../types';

async function testBrandCategoryFK() {
  console.log('🔍 Testing Brand-Category Foreign Key Relationship...\n');

  try {
    // Seed'i çalıştır
    const result = await seedAppleBrand();
    console.log(`✅ Brand ID: ${result.brandId}`);
    console.log(`✅ Category ID: ${result.categoryId}\n`);

    // DB'den brand'ı category ile birlikte getir
    const brand = await prisma.brand.findUnique({
      where: { id: result.brandId },
      include: {
        brandCategory: true,
      },
    });

    if (!brand) {
      console.error('❌ Brand bulunamadı!');
      process.exit(1);
    }

    console.log('📊 Brand Bilgileri:');
    console.log(`   ID: ${brand.id}`);
    console.log(`   Name: ${brand.name}`);
    console.log(`   categoryId (FK): ${brand.categoryId || 'NULL'}`);
    console.log(`   brandCategory relation: ${brand.brandCategory ? '✅ Var' : '❌ Yok'}`);

    if (brand.brandCategory) {
      console.log(`   Category Name: ${brand.brandCategory.name}`);
      console.log(`   Category ID: ${brand.brandCategory.id}`);
    }

    // Foreign key kontrolü
    console.log('\n🔗 Foreign Key Kontrolü:');
    if (brand.categoryId && brand.brandCategory) {
      if (brand.categoryId === brand.brandCategory.id) {
        console.log('   ✅ categoryId FK değeri category.id ile eşleşiyor');
      } else {
        console.error(`   ❌ categoryId (${brand.categoryId}) category.id (${brand.brandCategory.id}) ile eşleşmiyor!`);
        process.exit(1);
      }
    } else if (!brand.categoryId) {
      console.warn('   ⚠️ categoryId NULL - Foreign key set edilmemiş');
    } else if (!brand.brandCategory) {
      console.error('   ❌ brandCategory relation NULL - Foreign key broken!');
      process.exit(1);
    }

    // BrandCategory'den brand'ları kontrol et
    const category = await prisma.brandCategory.findUnique({
      where: { id: result.categoryId },
      include: {
        brands: {
          where: { name: 'Apple' },
        },
      },
    });

    if (category) {
      console.log(`\n📁 Category Bilgileri:`);
      console.log(`   ID: ${category.id}`);
      console.log(`   Name: ${category.name}`);
      console.log(`   Apple brand count: ${category.brands.length}`);
      if (category.brands.length > 0) {
        console.log(`   ✅ Apple brand category'de bulundu`);
      }
    }

    console.log('\n✅ Tüm foreign key kontrolleri başarılı!\n');
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testBrandCategoryFK();
