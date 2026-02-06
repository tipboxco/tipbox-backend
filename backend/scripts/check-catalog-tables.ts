import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCatalogTables() {
  try {
    console.log('🔍 Katalog tabloları kontrol ediliyor...\n');

    const categoryCount = await prisma.category.count();
    const mainCategoryCount = await prisma.mainCategory.count();
    const subCategoryCount = await prisma.subCategory.count();
    const productGroupCount = await prisma.productGroup.count();
    const productCount = await prisma.product.count();

    const rows = [
      { tablo: 'categories (Category)', sayi: categoryCount, dolu: categoryCount > 0 },
      { tablo: 'main_categories (MainCategory)', sayi: mainCategoryCount, dolu: mainCategoryCount > 0 },
      { tablo: 'sub_categories (SubCategory)', sayi: subCategoryCount, dolu: subCategoryCount > 0 },
      { tablo: 'product_groups (ProductGroup)', sayi: productGroupCount, dolu: productGroupCount > 0 },
      { tablo: 'products (Product)', sayi: productCount, dolu: productCount > 0 },
    ];

    console.log('Tablo                    | Kayıt sayısı | Dolu?');
    console.log('-------------------------|--------------|------');
    for (const r of rows) {
      const doluStr = r.dolu ? '✅ Evet' : '❌ Boş';
      console.log(`${r.tablo.padEnd(24)} | ${String(r.sayi).padStart(12)} | ${doluStr}`);
    }

    const hepsiDolu = rows.every((r) => r.dolu);
    console.log('\n' + (hepsiDolu ? '✅ Tüm katalog tabloları dolu.' : '⚠️ Bazı tablolar boş.'));

    await prisma.$disconnect();
    process.exit(hepsiDolu ? 0 : 1);
  } catch (e) {
    console.error('Hata:', e);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkCatalogTables();
