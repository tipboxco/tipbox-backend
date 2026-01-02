/**
 * Eski Main Category ID'lerine Sub Category'leri ekler
 */

import { prisma } from '../prisma/seed/types';

async function fixCategoryMapping(): Promise<void> {
  console.log('🔧 Main Category mapping düzeltiliyor...\n');

  // API'den gelen eski ID'ler
  const apiElectronicsId = '303c8552-a5c1-415b-8c58-9644ca73d596';
  const apiCosmeticsId = '3af3f14c-9b33-44fb-abe9-a906ce33c59a';

  // Yeni Main Category'ler (seed'den oluşturulan)
  const newElectronics = await prisma.mainCategory.findFirst({
    where: { name: 'Electronics' },
    include: { subCategories: true },
  });

  const newCosmetics = await prisma.mainCategory.findFirst({
    where: { name: 'Cosmetics' },
    include: { subCategories: true },
  });

  // Eski Main Category'leri bul
  const oldElectronics = await prisma.mainCategory.findUnique({
    where: { id: apiElectronicsId },
  });

  const oldCosmetics = await prisma.mainCategory.findUnique({
    where: { id: apiCosmeticsId },
  });

  if (oldElectronics && newElectronics && newElectronics.id !== oldElectronics.id) {
    console.log(`📦 Electronics: Yeni Sub Category'ler eski Main Category'ye taşınıyor...`);
    console.log(`   Eski ID: ${oldElectronics.id}`);
    console.log(`   Yeni ID: ${newElectronics.id}`);
    console.log(`   Taşınacak Sub Category sayısı: ${newElectronics.subCategories.length}`);

    // Yeni Sub Category'leri eski Main Category'ye taşı
    for (const subCat of newElectronics.subCategories) {
      await prisma.subCategory.update({
        where: { id: subCat.id },
        data: { mainCategoryId: oldElectronics.id },
      });
    }
    console.log(`   ✅ ${newElectronics.subCategories.length} Sub Category taşındı`);
  }

  if (oldCosmetics && newCosmetics && newCosmetics.id !== oldCosmetics.id) {
    console.log(`📦 Cosmetics: Yeni Sub Category'ler eski Main Category'ye taşınıyor...`);
    console.log(`   Eski ID: ${oldCosmetics.id}`);
    console.log(`   Yeni ID: ${newCosmetics.id}`);
    console.log(`   Taşınacak Sub Category sayısı: ${newCosmetics.subCategories.length}`);

    // Yeni Sub Category'leri eski Main Category'ye taşı
    for (const subCat of newCosmetics.subCategories) {
      await prisma.subCategory.update({
        where: { id: subCat.id },
        data: { mainCategoryId: oldCosmetics.id },
      });
    }
    console.log(`   ✅ ${newCosmetics.subCategories.length} Sub Category taşındı`);
  }

  // Yeni Main Category'leri sil (artık kullanılmıyor)
  if (newElectronics && oldElectronics && newElectronics.id !== oldElectronics.id) {
    await prisma.mainCategory.delete({
      where: { id: newElectronics.id },
    });
    console.log(`   🗑️  Yeni Electronics Main Category silindi`);
  }

  if (newCosmetics && oldCosmetics && newCosmetics.id !== oldCosmetics.id) {
    await prisma.mainCategory.delete({
      where: { id: newCosmetics.id },
    });
    console.log(`   🗑️  Yeni Cosmetics Main Category silindi`);
  }

  console.log('\n✅ Mapping düzeltme tamamlandı!');
}

if (require.main === module) {
  fixCategoryMapping()
    .catch((e) => {
      console.error('❌ Hata:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { fixCategoryMapping };

