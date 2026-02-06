import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * categories (category_id) ile eşleşen content postları tek sorguda gösterir.
 * Hiyerarşi: categories tablosunda parent_id + mpath ile; content_posts.category_id ile bağlı.
 */
async function main() {
  const postsWithCategory = await prisma.contentPost.findMany({
    where: { categoryId: { not: null } },
    select: {
      id: true,
      title: true,
      type: true,
      categoryId: true,
      productId: true,
      createdAt: true,
      category: {
        select: {
          id: true,
          name: true,
          level: true,
          parentId: true,
          mpath: true,
        },
      },
      product: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const totalWithCategory = await prisma.contentPost.count({
    where: { categoryId: { not: null } },
  });
  const totalPosts = await prisma.contentPost.count();

  console.log('Content postları – kategori yapısına göre (tek sorgu)\n');
  console.log(`Toplam content post: ${totalPosts}`);
  console.log(`category_id dolu (categories ile eşleşen): ${totalWithCategory}`);
  console.log(`category_id boş: ${totalPosts - totalWithCategory}\n`);
  console.log('Örnek kayıtlar (son 50):');
  console.log('─'.repeat(100));

  for (const p of postsWithCategory) {
    const cat = p.category;
    const path = cat?.mpath || cat?.id || '-';
    console.log(
      [
        p.id,
        p.type,
        (p.title || '').slice(0, 30),
        cat ? `${cat.name} (level ${cat?.level ?? '-'})` : '-',
        path,
        p.product?.name ?? '-',
      ].join(' | ')
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
