/**
 * omer@tipbox.co tarafından oluşturulan postların feed tablosundaki durumunu kontrol et
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OMER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';

async function checkOmerFeeds() {
  console.log('🔍 omer@tipbox.co tarafından oluşturulan postların feed tablosundaki durumu:\n');
  console.log('═'.repeat(80));

  // omer tarafından oluşturulan son 10 post
  const omerPosts = await prisma.contentPost.findMany({
    where: { userId: OMER_ID },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      type: true,
      title: true,
      createdAt: true,
    },
  });

  console.log(`\n📝 omer tarafından oluşturulan son 10 post:\n`);
  omerPosts.forEach((p, i) => {
    console.log(`${i + 1}. Post ID: ${p.id} | Type: ${p.type} | Tarih: ${p.createdAt.toISOString()}`);
  });

  console.log('\n\n📊 Her post için feed kayıtları:\n');
  console.log('═'.repeat(80));

  for (const post of omerPosts) {
    const feedRecords = await prisma.feed.findMany({
      where: { postId: post.id },
      select: {
        id: true,
        userId: true,
        source: true,
        seen: true,
        createdAt: true,
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`\n📝 Post ID: ${post.id} (${post.type})`);
    console.log(`   📊 Feed kayıt sayısı: ${feedRecords.length}`);

    if (feedRecords.length > 0) {
      feedRecords.forEach((f) => {
        console.log(
          `   - User: ${f.user?.email || f.userId} | Source: ${f.source} | Seen: ${f.seen} | Tarih: ${f.createdAt.toISOString()}`
        );
      });
    } else {
      console.log(`   ⚠ Feed kaydı yok`);
    }
  }

  // Özet istatistikler
  console.log('\n\n📊 Özet İstatistikler');
  console.log('═'.repeat(80));

  const totalPosts = omerPosts.length;
  let postsWithFeeds = 0;
  let postsWithoutFeeds = 0;
  let totalFeedRecords = 0;

  for (const post of omerPosts) {
    const feedCount = await prisma.feed.count({
      where: { postId: post.id },
    });

    totalFeedRecords += feedCount;

    if (feedCount > 0) {
      postsWithFeeds++;
    } else {
      postsWithoutFeeds++;
    }
  }

  console.log(`\n📈 Toplam Post Sayısı: ${totalPosts}`);
  console.log(`✅ Feed kaydı olan postlar: ${postsWithFeeds}`);
  console.log(`❌ Feed kaydı olmayan postlar: ${postsWithoutFeeds}`);
  console.log(`📊 Toplam Feed Kayıt Sayısı: ${totalFeedRecords}`);
  console.log(`📊 Ortalama Feed Kayıt Sayısı: ${(totalFeedRecords / totalPosts).toFixed(2)}`);

  // Aktif kullanıcı sayısını kontrol et (post sahibi hariç)
  const activeUsers = await prisma.user.count({
    where: {
      status: 'ACTIVE',
      id: { not: OMER_ID },
    },
  });

  console.log(`\n👥 Aktif kullanıcı sayısı (omer hariç): ${activeUsers}`);
  console.log(`📊 Beklenen feed kayıt sayısı (post başına): ${activeUsers}`);
}

checkOmerFeeds()
  .catch(console.error)
  .finally(() => prisma.$disconnect());


