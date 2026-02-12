import { getPrisma } from '../src/infrastructure/repositories/prisma.client';

const prisma = getPrisma();

/**
 * Electronics ve Beauty kategorilerine ait sub category listesini gösterir
 * Category tablosundaki verileri kontrol eder
 */
async function listCategories() {
  try {
    console.log('🔍 Category tablosundaki veriler kontrol ediliyor...\n');

    // Electronic ve Beauty ana kategorilerini bul
    const electronicMain = await prisma.category.findFirst({
      where: {
        OR: [
          { name: { contains: 'Electronic', mode: 'insensitive' } },
          { name: { contains: 'Electronics', mode: 'insensitive' } },
        ],
        parentId: null,
      },
    });

    const beautyMain = await prisma.category.findFirst({
      where: {
        name: { contains: 'Beauty', mode: 'insensitive' },
        parentId: null,
      },
    });

    console.log('═'.repeat(80));
    console.log('📱 ELECTRONICS KATEGORİSİ');
    console.log('═'.repeat(80));
    
    if (electronicMain) {
      console.log(`Ana Kategori: ${electronicMain.name}`);
      console.log(`ID: ${electronicMain.id}`);
      console.log(`Level: ${electronicMain.level ?? 'N/A'}`);
      console.log(`Description: ${electronicMain.description || 'Yok'}`);
      console.log(`Handle: ${electronicMain.handle || 'Yok'}`);
      console.log(`Is Active: ${electronicMain.isActive ?? 'N/A'}`);
      console.log('\n📋 Sub Categories:');
      console.log('-'.repeat(80));
      
      const electronicSubs = await prisma.category.findMany({
        where: {
          parentId: electronicMain.id,
        },
        orderBy: { name: 'asc' },
      });

      if (electronicSubs.length > 0) {
        electronicSubs.forEach((sub, index) => {
          console.log(`${index + 1}. ${sub.name}`);
          console.log(`   ID: ${sub.id}`);
          console.log(`   Level: ${sub.level ?? 'N/A'}`);
          console.log(`   Description: ${sub.description || 'Yok'}`);
          console.log(`   Handle: ${sub.handle || 'Yok'}`);
          console.log(`   Is Active: ${sub.isActive ?? 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('  ❌ Sub category bulunamadı');
      }
    } else {
      console.log('❌ Electronics kategorisi bulunamadı');
    }

    console.log('\n═'.repeat(80));
    console.log('💄 BEAUTY KATEGORİSİ');
    console.log('═'.repeat(80));
    
    if (beautyMain) {
      console.log(`Ana Kategori: ${beautyMain.name}`);
      console.log(`ID: ${beautyMain.id}`);
      console.log(`Level: ${beautyMain.level ?? 'N/A'}`);
      console.log(`Description: ${beautyMain.description || 'Yok'}`);
      console.log(`Handle: ${beautyMain.handle || 'Yok'}`);
      console.log(`Is Active: ${beautyMain.isActive ?? 'N/A'}`);
      console.log('\n📋 Sub Categories:');
      console.log('-'.repeat(80));
      
      const beautySubs = await prisma.category.findMany({
        where: {
          parentId: beautyMain.id,
        },
        orderBy: { name: 'asc' },
      });

      if (beautySubs.length > 0) {
        beautySubs.forEach((sub, index) => {
          console.log(`${index + 1}. ${sub.name}`);
          console.log(`   ID: ${sub.id}`);
          console.log(`   Level: ${sub.level ?? 'N/A'}`);
          console.log(`   Description: ${sub.description || 'Yok'}`);
          console.log(`   Handle: ${sub.handle || 'Yok'}`);
          console.log(`   Is Active: ${sub.isActive ?? 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('  ❌ Sub category bulunamadı');
      }
    } else {
      console.log('❌ Beauty kategorisi bulunamadı');
    }

    // Tüm kategorileri de göster (ilk 30)
    console.log('\n═'.repeat(80));
    console.log('📊 TÜM KATEGORİLER (İlk 30)');
    console.log('═'.repeat(80));
    
    const allCategories = await prisma.category.findMany({
      take: 30,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        parentId: true,
        level: true,
        description: true,
        handle: true,
        isActive: true,
      },
    });

    if (allCategories.length > 0) {
      allCategories.forEach((cat, index) => {
        const parentInfo = cat.parentId ? `(Parent: ${cat.parentId})` : '(Ana kategori)';
        console.log(`${index + 1}. ${cat.name} ${parentInfo}`);
        console.log(`   ID: ${cat.id} | Level: ${cat.level ?? 'N/A'} | Active: ${cat.isActive ?? 'N/A'}`);
        if (cat.description) {
          console.log(`   Description: ${cat.description}`);
        }
        console.log('');
      });
    } else {
      console.log('❌ Category tablosunda veri bulunamadı');
    }

    // Toplam sayıları göster
    const totalCategories = await prisma.category.count();
    const rootCategories = await prisma.category.count({
      where: { parentId: null },
    });
    const subCategories = await prisma.category.count({
      where: { parentId: { not: null } },
    });

    console.log('\n═'.repeat(80));
    console.log('📈 İSTATİSTİKLER');
    console.log('═'.repeat(80));
    console.log(`Toplam Kategori: ${totalCategories}`);
    console.log(`Ana Kategoriler (parentId null): ${rootCategories}`);
    console.log(`Alt Kategoriler (parentId dolu): ${subCategories}`);

    await prisma.$disconnect();
    console.log('\n✅ İşlem tamamlandı!');
  } catch (error) {
    console.error('❌ Hata:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

listCategories();
