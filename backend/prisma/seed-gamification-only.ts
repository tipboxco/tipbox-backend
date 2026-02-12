import { PrismaClient } from '@prisma/client';
import { seedGamificationCollections } from './seed/steps/gamification-collections.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('🎮 Starting Gamification Collections Seed (standalone)...\n');

  try {
    await seedGamificationCollections(prisma);
    console.log('\n✅ Gamification Collections seed completed successfully!');
  } catch (error) {
    console.error('\n❌ Error seeding gamification collections:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
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
