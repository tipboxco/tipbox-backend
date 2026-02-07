/**
 * imageUrl boş olan Badge kayıtlarına görsel path atar.
 * MinIO'dan dosya çekilmez; seed aşamasında görseller zaten yüklü. Sadece path (metin) yazılır.
 * Path'ler sabit liste; atama sırayla yapılır (badge-1 → path[0], badge-2 → path[1], ...).
 *
 * Kullanım (backend klasöründen):
 *   npm run sync-badge-images
 *   veya: npx ts-node scripts/sync-badge-images-from-minio.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Seed'de kullanılan badge görsel path'leri (badges/custom/...) */
const BADGE_IMAGE_PATHS: string[] = [
  'badges/custom/badge-1.png',
  'badges/custom/badge-2.png',
  'badges/custom/badge-3.png',
  'badges/custom/badge-4.png',
  'badges/custom/badge-5.png',
  'badges/custom/badge-6.png',
  'badges/custom/badge-7.png',
  'badges/custom/badge-8.png',
  'badges/custom/badge-9.png',
  'badges/custom/badge-10.png',
  'badges/custom/badge-11-Crimson-Roast.png',
  'badges/custom/badge-12-Golden-Pick.png',
  'badges/custom/badge-13-Trendsetter.png',
  'badges/custom/badge-14-Web3-Architect.png',
  'badges/custom/badge-15-Deal-Maven.png',
  'badges/custom/badge-16-Ladder-Vanguard.png',
  'badges/custom/badge-17-Top-Picks.png',
  'badges/custom/badge-18-Product-Roast.png',
  'badges/custom/badge-19-Ladder-Ranker.png',
  'badges/custom/badge-20-Genesis-Member.png',
  'badges/custom/badge-21-Outdoor-Explorer.png',
  'badges/custom/badge-22-Critical-Review.png',
  'badges/custom/EarlyAdapter.png',
  'badges/custom/HardwareExpert.png',
  'badges/custom/PremiumShoper.png',
  'badges/custom/WishMarker.png',
];

async function main(): Promise<void> {
  console.log('🔄 imageUrl boş badge\'lere path atanıyor (MinIO yok, sadece path)...\n');

  const badgesWithoutImage = await prisma.badge.findMany({
    where: {
      OR: [{ imageUrl: null }, { imageUrl: '' }],
    },
    orderBy: { id: 'asc' },
  });

  if (badgesWithoutImage.length === 0) {
    console.log('✅ imageUrl boş olan badge yok. Güncelleme yapılmadı.');
    return;
  }

  console.log(`🏅 imageUrl boş ${badgesWithoutImage.length} badge bulundu.\n`);

  let updated = 0;
  for (let i = 0; i < badgesWithoutImage.length; i++) {
    const badge = badgesWithoutImage[i];
    const imagePath = BADGE_IMAGE_PATHS[i % BADGE_IMAGE_PATHS.length];

    await prisma.badge.update({
      where: { id: badge.id },
      data: { imageUrl: imagePath },
    });
    updated++;
    console.log(`   ${badge.name} → ${imagePath}`);
  }

  console.log(`\n✅ ${updated} badge'in imageUrl alanı güncellendi.`);
}

main()
  .catch((e) => {
    console.error('Hata:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
