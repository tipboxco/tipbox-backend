import { PrismaClient } from '@prisma/client';
import { FeedService } from '../src/application/feed/feed.service';

const prisma = new PrismaClient();
const feedService = new FeedService();

async function main() {
  // Julia kullanıcısını bul
  const juliaUser = await prisma.user.findUnique({
    where: { email: 'julia.havk@tipbox.co' },
  });

  if (!juliaUser) {
    console.log('❌ Julia user not found');
    process.exit(1);
  }

  console.log(`✅ Found Julia user: ${juliaUser.id}`);

  // Julia'nın tüm postlarını bul
  const juliaPosts = await prisma.contentPost.findMany({
    where: { userId: juliaUser.id },
    select: { id: true, type: true, title: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📝 Found ${juliaPosts.length} posts for Julia`);

  if (juliaPosts.length === 0) {
    console.log('❌ No posts found for Julia');
    await prisma.$disconnect();
    process.exit(0);
  }

  // Her post için addPostToFeeds metodunu çağır
  for (const post of juliaPosts) {
    console.log(`\n🔄 Processing post: ${post.id} (${post.type})`);
    try {
      await feedService.addPostToFeeds(post.id, juliaUser.id);
      console.log(`✅ Post ${post.id} added to feeds`);
    } catch (error) {
      console.error(`❌ Error adding post ${post.id} to feeds:`, error);
    }
  }

  // Julia'nın feed'inde kaç kayıt olduğunu kontrol et
  const juliaFeedCount = await prisma.feed.count({
    where: { userId: juliaUser.id },
  });

  console.log(`\n✅ Julia's feed now has ${juliaFeedCount} entries`);

  // Tüm kullanıcıların feed'inde Julia'nın postları var mı kontrol et
  const allUsersFeedCount = await prisma.feed.count({
    where: {
      post: {
        userId: juliaUser.id,
      },
    },
  });

  console.log(`✅ Total feed entries for Julia's posts across all users: ${allUsersFeedCount}`);

  await prisma.$disconnect();
}

main().catch(console.error);
