import { prisma, generateUlid, TEST_USER_ID } from './types';

export async function seedFeedAndTrending(): Promise<void> {
  console.log('📰 [seed] feed & trending (full)');
  const userIdToUse = (await prisma.user.findUnique({ where: { id: TEST_USER_ID } }))?.id || (await prisma.user.findFirst())?.id!;
  const allPostsForFeed = await prisma.contentPost.findMany({ take: 20 });
  if (allPostsForFeed.length === 0) return;

  const feedSources: Array<'TRUSTER' | 'CATEGORY_MATCH' | 'TRENDING' | 'BOOSTED'> = [
    'TRUSTER',
    'CATEGORY_MATCH',
    'TRENDING',
    'BOOSTED',
  ];

  // Add to primary user's feed
  for (let i = 0; i < allPostsForFeed.length; i++) {
    const post = allPostsForFeed[i];
    const source = feedSources[i % feedSources.length];
    const actualSource = post.isBoosted ? 'BOOSTED' : source;
    await prisma.feed.create({
      data: { id: generateUlid(), userId: userIdToUse, postId: post.id, source: actualSource, seen: false },
    }).catch(() => {});
  }

  // For other users (5 users max)
  const allUsers = await prisma.user.findMany({ take: 5 });
  for (const user of allUsers) {
    if (user.id === userIdToUse) continue;
    const postsForUser = allPostsForFeed.slice(allUsers.indexOf(user) * 3, (allUsers.indexOf(user) + 1) * 3);
    for (let i = 0; i < postsForUser.length; i++) {
      const post = postsForUser[i];
      const source = feedSources[i % feedSources.length];
      const actualSource = post.isBoosted ? 'BOOSTED' : source;
      await prisma.feed.create({
        data: { id: generateUlid(), userId: user.id, postId: post.id, source: actualSource, seen: false },
      }).catch(() => {});
    }
  }

  // Trending (top 8)
  const postsForTrending = allPostsForFeed.slice(0, 8);
  for (let i = 0; i < postsForTrending.length; i++) {
    await prisma.trendingPost.create({
      data: { id: generateUlid(), postId: postsForTrending[i].id, score: 100 - i * 10, trendPeriod: 'DAILY', calculatedAt: new Date() },
    }).catch(() => {});
  }
  console.log('🎉 Feed seeding completed');
}

if (require.main === module) {
  seedFeedAndTrending()
    .catch((e) => {
      console.error('❌ Feed seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}


