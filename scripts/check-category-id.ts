import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCategoryId() {
  const queryId = '047ae9ff-3766-498f-ba7d-16f49c85a113';
  
  console.log(`🔍 Kategori ID kontrol ediliyor: ${queryId}\n`);
  
  // Bu ID'ye sahip kategoriyi bul
  const category = await prisma.mainCategory.findUnique({
    where: { id: queryId },
    select: {
      id: true,
      name: true,
    }
  });
  
  if (!category) {
    console.log(`❌ ID ${queryId} ile kategori bulunamadı!`);
    
    // Tüm kategorileri listele
    console.log('\n📋 Tüm kategoriler:');
    const allCategories = await prisma.mainCategory.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
    
    allCategories.forEach((cat) => {
      console.log(`   - ${cat.name} (ID: ${cat.id})`);
    });
  } else {
    console.log(`✅ Kategori bulundu:`);
    console.log(`   Name: ${category.name}`);
    console.log(`   ID: ${category.id}\n`);
    
    // Bu kategoriye ait sub-category'leri bul
    const subCategories = await prisma.subCategory.findMany({
      where: {
        mainCategoryId: category.id,
      },
      select: {
        id: true,
        name: true,
      },
    });
    
    console.log(`📋 Sub-category sayısı: ${subCategories.length}`);
    if (subCategories.length > 0) {
      subCategories.forEach((sub, index) => {
        console.log(`   ${index + 1}. ${sub.name} (ID: ${sub.id})`);
      });
    } else {
      console.log('   ⚠️  Bu kategori için sub-category yok!');
    }
  }
  
  await prisma.$disconnect();
}

checkCategoryId().catch((error) => {
  console.error('❌ Hata:', error);
  process.exit(1);
});



