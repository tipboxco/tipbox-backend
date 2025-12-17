import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const omer = await prisma.user.findUnique({
    where: { email: 'omer@tipbox.co' },
  });

  if (!omer) {
    console.log('Omer not found');
    process.exit(1);
  }

  const feedCount = await prisma.feed.count({
    where: { userId: omer.id },
  });
  console.log(`Total feed entries for Omer: ${feedCount}`);

  const feeds = await prisma.feed.findMany({
    where: { userId: omer.id },
    take: 20,
    orderBy: [
      { post: { isBoosted: 'desc' } },
      { post: { createdAt: 'desc' } },
      { createdAt: 'desc' },
    ],
    select: {
      id: true,
      postId: true,
      createdAt: true,
      post: {
        select: {
          id: true,
          createdAt: true,
          title: true,
          type: true,
        },
      },
    },
  });

  console.log(`\nFirst 20 feeds (ordered by post.createdAt desc):`);
  feeds.forEach((f, i) => {
    console.log(
      `${i + 1}. Post: ${f.post.createdAt.toISOString()}, Feed: ${f.createdAt.toISOString()}, Type: ${f.post.type}, Title: ${f.post.title || 'No title'}`
    );
  });

  await prisma.$disconnect();
}

main().catch(console.error);

