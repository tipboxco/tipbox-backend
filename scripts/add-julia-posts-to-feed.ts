import { PrismaClient } from '@prisma/client';
import { generateUlid } from '../prisma/seed/types';

const prisma = new PrismaClient();

async function main() {
  const juliaUser = await prisma.user.findUnique({
    where: { email: 'julia.havk@tipbox.co' },
  });

  if (!juliaUser) {
    console.log('Julia user not found');
    process.exit(1);
  }

  const juliaPosts = await prisma.contentPost.findMany({
    where: { userId: juliaUser.id },
  });

  console.log(`Found ${juliaPosts.length} posts for Julia`);

  const omerUser = await prisma.user.findUnique({
    where: { email: 'omer@tipbox.co' },
  });

  if (!omerUser) {
    console.log('Omer user not found');
    process.exit(1);
  }

  for (const post of juliaPosts) {
    await prisma.feed
      .create({
        data: {
          id: generateUlid(),
          userId: omerUser.id,
          postId: post.id,
          source: 'CATEGORY_MATCH',
          seen: false,
        },
      })
      .catch(() => {});
  }

  console.log('Feed entries created for Omer');
  await prisma.$disconnect();
}

main().catch(console.error);

