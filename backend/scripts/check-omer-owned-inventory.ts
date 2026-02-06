/**
 * Ömer kullanıcısının Experience postları (status=own) ve envanter uyumu kontrolü.
 * Owned experience postu varsa o ürün envanterde olmalı.
 * Kullanım: docker compose exec backend npx ts-node scripts/check-omer-owned-inventory.ts
 */
import { getPrisma } from '../src/infrastructure/repositories/prisma.client';

const prisma = getPrisma();

async function main() {
  console.log('--- Ömer kullanıcısı: Owned Experience postları ve envanter kontrolü ---\n');

  // Ömer kullanıcısını bul (displayName veya email ile)
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { profile: { displayName: { contains: 'omer', mode: 'insensitive' } } },
        { profile: { displayName: { contains: 'ömer', mode: 'insensitive' } } },
        { email: { contains: 'omer', mode: 'insensitive' } },
      ],
    },
    include: { profile: { select: { displayName: true } } },
  });

  if (users.length === 0) {
    console.log('Ömer kullanıcısı bulunamadı.');
    await prisma.$disconnect();
    return;
  }

  for (const user of users) {
    const displayName = (user as any).profile?.displayName || user.email || user.id;
    console.log(`Kullanıcı: ${displayName} (id: ${user.id})\n`);

    const ownedExperiencePosts = await prisma.contentPost.findMany({
      where: {
        userId: user.id,
        type: 'EXPERIENCE',
        productStatus: 'own',
        productId: { not: null },
      },
      select: {
        id: true,
        productId: true,
        createdAt: true,
        product: { select: { id: true, name: true } },
      },
    });

    if (ownedExperiencePosts.length === 0) {
      console.log('  Owned (productStatus=own) experience postu yok.\n');
      continue;
    }

    const inventories = await prisma.inventory.findMany({
      where: { userId: user.id },
      select: { productId: true, hasOwned: true },
    });
    const inventoryProductIds = new Set(inventories.map((i) => i.productId));

    let allOk = true;
    for (const post of ownedExperiencePosts) {
      const productId = post.productId!;
      const inInventory = inventoryProductIds.has(productId);
      const status = inInventory ? '✅ Envanterde' : '❌ EKSİK';
      if (!inInventory) allOk = false;
      console.log(
        `  Post ${post.id} | productId: ${productId} | ${post.product?.name?.slice(0, 40) || '-'} | ${status}`
      );
    }

    console.log('');
    if (allOk) {
      console.log('  Sonuç: Tüm owned experience postlarının ürünleri envanterde. Backend doğru çalışıyor.\n');
    } else {
      console.log(
        '  Sonuç: Bazı owned experience postlarının ürünleri envanterde YOK. Backend hatalı olabilir (I owned seçildiğinde envantere eklenmeli).\n'
      );
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Hata:', e);
  process.exit(1);
});
