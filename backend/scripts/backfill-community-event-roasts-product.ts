import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * ROASTS tipindeki Community Event'ler için product_id backfill eder.
 * - Sadece brandId = null (community)
 * - Sadece feedType = 'ROASTS'
 * - Sadece productId boş olanları doldurur
 *
 * Bulamazsa deterministik fallback olarak herhangi bir product seçer.
 */
async function main() {
  const roastsEvents = await prisma.wishboxEvent.findMany({
    where: {
      brandId: null,
      feedType: 'ROASTS',
      productId: null,
    },
    select: { id: true, title: true },
  });

  if (roastsEvents.length === 0) {
    // eslint-disable-next-line no-console
    console.log('ℹ️  Backfill gerektiren ROASTS event yok (productId dolu ya da ROASTS yok)');
    return;
  }

  const pickProductId = async (eventTitle: string): Promise<string | null> => {
    const t = eventTitle.toLowerCase();

    // Basit keyword eşleşmeleri (DB'deki ürün datasına göre best-effort)
    const candidates: Array<{ where: any; reason: string }> = [];

    if (t.includes('kulaklık') || t.includes('airpods') || t.includes('earbud')) {
      candidates.push({ where: { name: { contains: 'AirPods', mode: 'insensitive' } }, reason: 'AirPods' });
      candidates.push({ where: { name: { contains: 'buds', mode: 'insensitive' } }, reason: 'buds' });
    }

    if (t.includes('makyaj') || t.includes('fondöten') || t.includes('ruj') || t.includes('maskara')) {
      candidates.push({ where: { name: { contains: 'foundation', mode: 'insensitive' } }, reason: 'foundation' });
      candidates.push({ where: { name: { contains: 'lipstick', mode: 'insensitive' } }, reason: 'lipstick' });
      candidates.push({ where: { name: { contains: 'mascara', mode: 'insensitive' } }, reason: 'mascara' });
    }

    if (t.includes('kamera') || t.includes('gece')) {
      candidates.push({ where: { name: { contains: 'iPhone', mode: 'insensitive' } }, reason: 'iPhone' });
      candidates.push({ where: { name: { contains: 'phone', mode: 'insensitive' } }, reason: 'phone' });
    }

    for (const c of candidates) {
      const p = await prisma.product.findFirst({
        where: c.where,
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });
      if (p?.id) return p.id;
    }

    // Fallback: herhangi bir product
    const fallback = await prisma.product.findFirst({
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    return fallback?.id ?? null;
  };

  let updated = 0;
  for (const e of roastsEvents) {
    const productId = await pickProductId(e.title);
    if (!productId) {
      // eslint-disable-next-line no-console
      console.warn(`⚠️  Product bulunamadı, event atlandı: ${e.id} (${e.title})`);
      continue;
    }

    await prisma.wishboxEvent.update({
      where: { id: e.id },
      data: { productId },
    });
    updated++;
  }

  const snapshot = await prisma.wishboxEvent.findMany({
    where: { brandId: null, feedType: 'ROASTS' },
    select: { id: true, title: true, feedType: true, productId: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // eslint-disable-next-line no-console
  console.log('✅ ROASTS event productId backfill tamamlandı');
  // eslint-disable-next-line no-console
  console.log({ updated });
  // eslint-disable-next-line no-console
  console.table(snapshot);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('❌ backfill-community-event-roasts-product hata:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

