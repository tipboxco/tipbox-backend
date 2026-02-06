/**
 * Prisma ile post ID kontrolü
 * Kullanım: npx ts-node scripts/check-post-id.ts [postId]
 * Örnek: npx ts-node scripts/check-post-id.ts 2f8a8f3d-6ab6-4d08-8c4a-6ad442b06aad
 */
import { getPrisma } from '../src/infrastructure/repositories/prisma.client';

const prisma = getPrisma();

async function main() {
  const searchId = process.argv[2]?.trim() || '2f8a8f3d-6ab6-4d08-8c4a-6ad442b06aad';

  console.log('--- Prisma ile Post ID Kontrolü ---\n');
  console.log('Aranan id:', searchId, '(uzunluk:', searchId.length, ')');
  console.log('ContentPost.id formatı: VarChar(26) = ULID\n');

  // 1. Bu id ile post var mı?
  const postById = await prisma.contentPost.findUnique({
    where: { id: searchId },
    select: { id: true, type: true, userId: true, productId: true, createdAt: true },
  });
  if (postById) {
    console.log('✅ BULUNDU:', postById);
  } else {
    console.log('❌ Bu id ile post BULUNAMADI.');
    if (searchId.length === 36 && /^[0-9a-f-]{36}$/i.test(searchId)) {
      console.log('   (Gönderilen değer UUID formatında; ContentPost.id 26 karakter ULID olmalı.)');
    }
  }

  // 2. Son birkaç post - id formatı
  const recent = await prisma.contentPost.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { id: true, type: true, createdAt: true },
  });
  console.log('\n--- Son 5 ContentPost (id formatı 26 karakter) ---');
  recent.forEach((p, i) => {
    console.log(`  ${i + 1}. id: ${p.id} (uzunluk: ${p.id.length}) type: ${p.type} createdAt: ${p.createdAt.toISOString()}`);
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Hata:', e);
  process.exit(1);
});
