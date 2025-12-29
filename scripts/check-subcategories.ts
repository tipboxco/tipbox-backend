import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSubCategories() {
  console.log('🔍 Technology kategorisi ve sub-category\'leri kontrol ediliyor...\n');
  
  // Technology kategorisini bul
  const techCategory = await prisma.mainCategory.findFirst({
    where: {
      name: { in: ['Technology', 'Teknoloji'] }
    },
    select: {
      id: true,
      name: true,
    }
  });
  
  if (!techCategory) {
    console.log('❌ Technology/Teknoloji kategorisi bulunamadı!');
    await prisma.$disconnect();
    return;
  }
  
  console.log(`✅ Technology kategorisi bulundu:`);
  console.log(`   ID: ${techCategory.id}`);
  console.log(`   Name: ${techCategory.name}\n`);
  
  // Bu kategoriye ait sub-category'leri bul
  const subCategories = await prisma.subCategory.findMany({
    where: {
      mainCategoryId: techCategory.id,
    },
    select: {
      id: true,
      name: true,
      mainCategoryId: true,
      imageUrl: true,
    },
    orderBy: {
      name: 'asc',
    },
  });
  
  console.log(`📋 Sub-category sayısı: ${subCategories.length}\n`);
  
  if (subCategories.length === 0) {
    console.log('⚠️  Technology kategorisi için sub-category bulunamadı!');
    console.log('   Seed dosyası çalıştırılmamış olabilir.\n');
  } else {
    console.log('✅ Sub-category\'ler:');
    subCategories.forEach((sub, index) => {
      console.log(`   ${index + 1}. ${sub.name} (ID: ${sub.id})`);
      console.log(`      MainCategoryId: ${sub.mainCategoryId}`);
      console.log(`      ImageUrl: ${sub.imageUrl || '(boş)'}`);
    });
  }
  
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
  
  allCategories.forEach((cat, index) => {
    console.log(`   ${index + 1}. ${cat.name} (ID: ${cat.id})`);
  });
  
  await prisma.$disconnect();
}

checkSubCategories().catch((error) => {
  console.error('❌ Hata:', error);
  process.exit(1);
});


