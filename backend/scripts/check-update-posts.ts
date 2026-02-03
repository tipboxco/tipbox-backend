/**
 * DB'de update post ve post_update_content kayıtlarını kontrol eder.
 * Kullanım: npx ts-node scripts/check-update-posts.ts [userId]
 * userId opsiyonel; verilmezse tüm update postlar listelenir.
 */
import { getPrisma } from '../src/infrastructure/repositories/prisma.client';

const prisma = getPrisma();

async function main() {
  const userId = process.argv[2]?.trim(); // opsiyonel: 480f5de9-b691-4d70-a6a8-2789226f4e07

  console.log('🔍 Update post ve post_update_content kontrolü\n');
  if (userId) {
    console.log(`   Filtre: userId = ${userId}\n`);
  }

  // 1) content_posts içinde type = UPDATE olanlar
  const updatePostsWhere = userId ? { type: 'UPDATE' as const, userId } : { type: 'UPDATE' as const };
  const updatePosts = await prisma.contentPost.findMany({
    where: updatePostsWhere,
    select: {
      id: true,
      userId: true,
      type: true,
      productId: true,
      body: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log('📌 content_posts (type = UPDATE):');
  console.log('   Toplam:', updatePosts.length);
  if (updatePosts.length === 0) {
    console.log('   (Kayıt yok)\n');
  } else {
    updatePosts.forEach((p, i) => {
      console.log(`   ${i + 1}. id=${p.id} userId=${p.userId} productId=${p.productId ?? 'null'} createdAt=${p.createdAt.toISOString()}`);
      console.log(`      body(ilk 60): ${(p.body || '').slice(0, 60)}...`);
    });
    console.log('');
  }

  // 2) post_update_content tablosu
  const updateContentWhere = userId
    ? { post: { userId } }
    : {};
  const updateContentRows = await prisma.postUpdateContent.findMany({
    where: updateContentWhere,
    include: {
      post: { select: { id: true, userId: true, type: true, createdAt: true } },
      experiencePost: { select: { id: true, userId: true, type: true, body: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log('📌 post_update_content:');
  console.log('   Toplam:', updateContentRows.length);
  if (updateContentRows.length === 0) {
    console.log('   (Kayıt yok)\n');
  } else {
    updateContentRows.forEach((row, i) => {
      console.log(`   ${i + 1}. postId=${row.postId} experiencePostId=${row.experiencePostId}`);
      console.log(`      update post createdAt: ${row.post?.createdAt?.toISOString()}`);
      console.log(`      content(ilk 60): ${(row.content || '').slice(0, 60)}...`);
    });
    console.log('');
  }

  // 3) Özet
  const allUpdatePostIds = new Set(updatePosts.map((p) => p.id));
  const allContentPostIds = new Set(updateContentRows.map((r) => r.postId));
  const missingInContent = [...allUpdatePostIds].filter((id) => !allContentPostIds.has(id));
  const orphanContent = [...allContentPostIds].filter((id) => !allUpdatePostIds.has(id));

  if (missingInContent.length > 0) {
    console.log('⚠️  content_posts\'ta UPDATE var ama post_update_content\'te yok:', missingInContent);
  }
  if (orphanContent.length > 0) {
    console.log('⚠️  post_update_content\'te var ama content_posts\'ta UPDATE yok:', orphanContent);
  }
  if (missingInContent.length === 0 && orphanContent.length === 0 && updatePosts.length > 0) {
    console.log('✅ Tüm update postların post_update_content kaydı mevcut.');
  }
}

main()
  .catch((e) => {
    console.error('❌ Hata:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
