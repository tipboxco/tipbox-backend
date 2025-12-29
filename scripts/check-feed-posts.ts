/**
 * 3 kullanıcının son 3 feed gönderi ID'lerini listele ve herkese düşüp düşmediğini kontrol et
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const USERS = [
  { id: '480f5de9-b691-4d70-a6a8-2789226f4e07', email: 'omer@tipbox.co' },
  { id: '248cc91f-b551-4ecc-a885-db1163571330', email: 'markettest@tipbox.co' },
  { id: '11111111-1111-4111-a111-111111111111', email: 'trust-user-0@tipbox.co' },
];

async function checkFeedPosts() {
  console.log('🔍 3 Kullanıcının Son 10 Feed Gönderi ID\'leri Kontrol Ediliyor...\n');
  console.log('═'.repeat(80));

  // Her kullanıcı için son 10 feed post ID'sini al
  const userFeedPosts = new Map<string, string[]>();

  for (const user of USERS) {
    console.log(`\n📰 ${user.email} (${user.id})`);
    console.log('─'.repeat(80));

    const feeds = await prisma.feed.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        postId: true,
        createdAt: true,
        source: true,
        post: {
          select: {
            userId: true,
            type: true,
            title: true,
          },
        },
      },
    });

    if (feeds.length === 0) {
      console.log('  ⚠ Feed kaydı yok');
      userFeedPosts.set(user.id, []);
    } else {
      const postIds: string[] = [];
      feeds.forEach((f, i) => {
        const postAuthor = USERS.find((u) => u.id === f.post?.userId);
        const authorEmail = postAuthor?.email || f.post?.userId || 'Bilinmiyor';
        console.log(
          `  ${i + 1}. Post ID: ${f.postId} | Type: ${f.post?.type || 'N/A'} | Author: ${authorEmail} | Source: ${f.source} | Tarih: ${f.createdAt.toISOString()}`
        );
        postIds.push(f.postId);
      });
      userFeedPosts.set(user.id, postIds);
    }
  }

  // Şimdi her post'un diğer kullanıcıların feed'inde olup olmadığını kontrol et
  console.log('\n\n🔍 Her Post\'un Diğer Kullanıcıların Feed\'inde Olup Olmadığı Kontrol Ediliyor...\n');
  console.log('═'.repeat(80));

  // Tüm unique post ID'leri topla
  const allPostIds = new Set<string>();
  userFeedPosts.forEach((postIds) => {
    postIds.forEach((postId) => allPostIds.add(postId));
  });

  for (const postId of Array.from(allPostIds)) {
    console.log(`\n📝 Post ID: ${postId}`);

    // Post bilgilerini al
    const post = await prisma.contentPost.findUnique({
      where: { id: postId },
      select: {
        userId: true,
        type: true,
        title: true,
      },
    });

    const postAuthor = USERS.find((u) => u.id === post?.userId);
    const authorEmail = postAuthor?.email || post?.userId || 'Bilinmiyor';
    console.log(`  👤 Yazar: ${authorEmail} | Type: ${post?.type || 'N/A'}`);

    // Her kullanıcı için bu post'un feed'inde olup olmadığını kontrol et
    for (const user of USERS) {
      const feedRecord = await prisma.feed.findFirst({
        where: {
          userId: user.id,
          postId: postId,
        },
        select: {
          source: true,
          createdAt: true,
        },
      });

      if (feedRecord) {
        console.log(`  ✅ ${user.email}: Feed'de mevcut (Source: ${feedRecord.source})`);
      } else {
        console.log(`  ❌ ${user.email}: Feed'de YOK`);
      }
    }
  }

  // Özet istatistikler
  console.log('\n\n📊 Özet İstatistikler');
  console.log('═'.repeat(80));

  for (const postId of Array.from(allPostIds)) {
    const feedCount = await prisma.feed.count({
      where: { postId },
    });

    const expectedCount = USERS.length - 1; // Post sahibi hariç
    const post = await prisma.contentPost.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    const postAuthor = USERS.find((u) => u.id === post?.userId);
    const authorEmail = postAuthor?.email || post?.userId || 'Bilinmiyor';

    console.log(
      `\n📝 Post ID: ${postId} (Yazar: ${authorEmail})`
    );
    console.log(`  📊 Feed kayıt sayısı: ${feedCount} (Beklenen: ${expectedCount})`);

    if (feedCount >= expectedCount) {
      console.log(`  ✅ Tüm kullanıcıların feed'inde mevcut`);
    } else {
      console.log(`  ⚠ Eksik feed kayıtları var (${feedCount}/${expectedCount})`);
    }
  }
}

checkFeedPosts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

