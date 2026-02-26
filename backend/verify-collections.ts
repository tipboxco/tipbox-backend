import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📊 Checking Gamification Collections...\n');

  const collections = await prisma.badgeCollection.findMany({
    where: {
      id: {
        in: [
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000002',
          '00000000-0000-0000-0000-000000000003',
        ],
      },
    },
    include: {
      _count: {
        select: {
          badges: true,
          achievementGoals: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  console.log(`Found ${collections.length} collections:\n`);

  collections.forEach((col, index) => {
    console.log(`${index + 1}. ${col.name}`);
    console.log(`   Owner: ${col.owner}`);
    console.log(`   Focus: ${col.focusSector}`);
    console.log(`   Target Group: ${col.targetGroup}`);
    console.log(`   Category: ${col.category?.name || 'N/A'}`);
    console.log(`   Badges: ${col._count.badges}`);
    console.log(`   Goals: ${col._count.achievementGoals}`);
    console.log(`   Short Desc: ${col.shortDescription}`);
    console.log(`   Completion Bonus: ${col.completionBonus}`);
    console.log('');
  });

  // Also check badges
  const badges = await prisma.badge.findMany({
    where: {
      collectionId: {
        in: [
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000002',
          '00000000-0000-0000-0000-000000000003',
        ],
      },
    },
    include: {
      collection: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  console.log(`📛 Found ${badges.length} badges for these collections:\n`);
  badges.forEach((badge) => {
    console.log(`   - ${badge.name} (${badge.rarity}) -> ${badge.collection?.name}`);
  });

  // Check achievement goals
  const goals = await prisma.achievementGoal.findMany({
    where: {
      collectionId: {
        in: [
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000002',
          '00000000-0000-0000-0000-000000000003',
        ],
      },
    },
    include: {
      collection: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      title: 'asc',
    },
  });

  console.log(`\n🎯 Found ${goals.length} achievement goals:\n`);
  goals.forEach((goal) => {
    console.log(
      `   - ${goal.title} (${goal.difficulty}, ${goal.pointsRequired} pts) -> ${goal.collection?.name}`,
    );
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
