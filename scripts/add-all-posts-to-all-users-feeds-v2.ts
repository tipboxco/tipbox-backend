import { PrismaClient } from '@prisma/client';
import { FeedService } from '../src/application/feed/feed.service';

const prisma = new PrismaClient();
const feedService = new FeedService();

async function main() {
  // Tüm aktif kullanıcıları bul
  const allActiveUsers = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, email: true },
  });

  console.log(`✅ Found ${allActiveUsers.length} active users`);

  // Tüm postları bul
  const allPosts = await prisma.contentPost.findMany({
    select: { id: true, userId: true, type: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📝 Found ${allPosts.length} total posts`);

  if (allPosts.length === 0) {
    console.log('❌ No posts found');
    await prisma.$disconnect();
    process.exit(0);
  }

  // Her post için addPostToFeeds metodunu çağır
  let processedCount = 0;
  for (const post of allPosts) {
    processedCount++;
    console.log(`\n[${processedCount}/${allPosts.length}] Processing post: ${post.id} (${post.type}) by user ${post.userId}`);
    try {
      await feedService.addPostToFeeds(post.id, post.userId);
      console.log(`✅ Post ${post.id} added to feeds`);
    } catch (error) {
      console.error(`❌ Error adding post ${post.id} to feeds:`, error);
    }
  }

  // Her kullanıcının feed'inde kaç kayıt olduğunu kontrol et
  console.log(`\n📊 Feed statistics:`);
  for (const user of allActiveUsers) {
    const feedCount = await prisma.feed.count({
      where: { userId: user.id },
    });
    console.log(`  - ${user.email}: ${feedCount} feed entries`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
