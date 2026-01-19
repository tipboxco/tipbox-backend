import { prisma } from '../types';
import { getSeedMediaPath, SeedMediaKey } from '../helpers/media.helper';

/**
 * Apple brand ve kategori oluştur
 */
export async function seedAppleBrand(): Promise<{ brandId: string; categoryId: string }> {
  console.log('🍎 [seed] Apple brand & category');

  // Brand category oluştur veya bul
  let brandCategory = await prisma.brandCategory.findFirst({
    where: { name: 'Electronics' },
  });

  if (!brandCategory) {
    brandCategory = await prisma.brandCategory.create({
      data: {
        name: 'Electronics',
      },
    });
  }

  // Apple brand oluştur veya bul
  let appleBrand = await prisma.brand.findFirst({
    where: { name: 'Apple' },
  });

  if (!appleBrand) {
    appleBrand = await prisma.brand.create({
      data: {
        name: 'Apple',
        description: 'Premium consumer electronics and software',
        categoryId: brandCategory.id,
        logoUrl: getSeedMediaPath('brand.apple.logo' as SeedMediaKey, true) || undefined,
        imageUrl: getSeedMediaPath('brand.apple.banner' as SeedMediaKey, true) || undefined,
      },
    });
    console.log(`  ✅ Apple brand oluşturuldu: ${appleBrand.id}`);
  } else {
    // Brand'ı güncelle
    appleBrand = await prisma.brand.update({
      where: { id: appleBrand.id },
      data: {
        categoryId: brandCategory.id,
        description: 'Premium consumer electronics and software',
        logoUrl: getSeedMediaPath('brand.apple.logo' as SeedMediaKey, true) || appleBrand.logoUrl || undefined,
        imageUrl: getSeedMediaPath('brand.apple.banner' as SeedMediaKey, true) || appleBrand.imageUrl || undefined,
      },
    });
    console.log(`  ✅ Apple brand güncellendi: ${appleBrand.id}`);
  }

  return {
    brandId: appleBrand.id,
    categoryId: brandCategory.id,
  };
}
