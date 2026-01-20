import { seedAppleProducts } from './apple-products.seed';
import { seedAppleBrand } from './apple-brand.seed';
import { prisma } from '../types';

async function testAppleProducts() {
  console.log('🧪 Testing Apple Products Seed...\n');

  try {
    // Önce brand'ı oluştur
    const brandResult = await seedAppleBrand();
    console.log(`✅ Brand ID: ${brandResult.brandId}\n`);

    // Products seed'i çalıştır
    const result = await seedAppleProducts(brandResult.brandId);
    console.log('\n✅ Products seed başarılı!\n');

    // DB'den kontrol et
    console.log('📊 DB Kontrolü:\n');

    for (const group of result.productGroups) {
      // Apple brand'ı bul
      const appleBrand = await prisma.brand.findFirst({
        where: { name: 'Apple' },
      });

      const productGroup = await prisma.productGroup.findUnique({
        where: { id: group.id },
        include: {
          products: {
            where: appleBrand ? { brandId: appleBrand.externalId } : undefined,
            orderBy: { name: 'asc' },
          },
          subCategory: {
            include: {
              mainCategory: true,
            },
          },
        },
      });

      if (!productGroup) {
        console.error(`❌ Product group bulunamadı: ${group.name}`);
        continue;
      }

      console.log(`📦 ${productGroup.name}:`);
      console.log(`   ID: ${productGroup.id}`);
      console.log(`   Description: ${productGroup.description}`);
      console.log(`   Sub Category: ${productGroup.subCategory.name}`);
      console.log(`   Main Category: ${productGroup.subCategory.mainCategory.name}`);
      console.log(`   Products Count: ${productGroup.products.length}`);
      console.log(`   Products:`);
      productGroup.products.forEach((product, index) => {
        console.log(`     ${index + 1}. ${product.name} - ${product.description || 'N/A'}`);
      });
      console.log('');
    }

    // Toplam istatistikler
    const appleBrand = await prisma.brand.findFirst({
      where: { name: 'Apple' },
    });

    const totalProducts = await prisma.product.count({
      where: appleBrand ? { brandId: appleBrand.externalId } : undefined,
    });

    console.log('📈 Toplam İstatistikler:');
    console.log(`   Product Groups: ${result.productGroups.length}`);
    console.log(`   Toplam Products: ${totalProducts}`);

    console.log('\n✅ Tüm kontroller başarılı!\n');
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testAppleProducts();
