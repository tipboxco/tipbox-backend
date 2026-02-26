import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Community Event'lerde feedType (PICKS/ROASTS) backfill eder.
 * - Sadece brandId = null olan (community) event'lere dokunur
 * - Seed'de planladığımız 3 event ROASTS, diğerleri PICKS olur
 */
async function main() {
  const roastsTitles = [
    'Kablosuz Kulaklık Ses Kalitesi Testi',
    'Kalıcı Makyaj Ürünleri Testi',
    'Kamera Performansı: Gece Çekimleri',
  ];

  const roastsResult = await prisma.event.updateMany({
    where: {
      brandId: null,
      title: { in: roastsTitles },
    },
    data: {
      feedType: 'ROASTS',
    },
  });

  const picksResult = await prisma.event.updateMany({
    where: {
      brandId: null,
      title: { notIn: roastsTitles },
    },
    data: {
      feedType: 'PICKS',
    },
  });

  // Kontrol amaçlı son durumu yazdır
  const snapshot = await prisma.event.findMany({
    where: { brandId: null },
    select: { id: true, title: true, feedType: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // eslint-disable-next-line no-console
  console.log('✅ Community Event feedType backfill tamamlandı');
  // eslint-disable-next-line no-console
  console.log({ roastsUpdated: roastsResult.count, picksUpdated: picksResult.count });
  // eslint-disable-next-line no-console
  console.table(snapshot);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('❌ backfill-community-event-feed-type hata:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

