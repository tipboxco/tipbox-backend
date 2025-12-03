const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const userId = '480f5de9-b691-4d70-a6a8-2789226f4e07';
    const [posts, trusts, trusters] = await Promise.all([
      prisma.contentPost.count({ where: { userId } }),
      prisma.trustRelation.count({ where: { trusterId: userId } }),
      prisma.trustRelation.count({ where: { trustedUserId: userId } }),
    ]);

    const profile = await prisma.profile.upsert({
      where: { userId },
      update: {
        postsCount: posts,
        trustCount: trusts,
        trusterCount: trusters,
      },
      create: {
        userId,
        displayName: 'Ömer Faruk',
        userName: 'omerfaruk',
        bannerUrl: null,
        postsCount: posts,
        trustCount: trusts,
        trusterCount: trusters,
      },
    });

    console.log('Counts updated', { posts, trusts, trusters });
    console.log('Profile snapshot', {
      postsCount: profile.postsCount,
      trustCount: profile.trustCount,
      trusterCount: profile.trusterCount,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

