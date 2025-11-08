import { prisma } from './types';

import { seedTaxonomy } from './taxonomy.seed';
import { seedUsersAndProfiles } from './user.seed';
import { seedProductsAndContent } from './content.seed';
import { seedFeedAndTrending } from './feed.seed';
import { seedMarketplace } from './marketplace.seed';
import { seedExplore } from './explore.seed';

export async function runAllSeeds(): Promise<void> {
  console.log('🌱 Modular seed start');
  await seedTaxonomy();
  await seedUsersAndProfiles();
  await seedProductsAndContent();
  await seedFeedAndTrending();
  await seedMarketplace();
  await seedExplore();
  console.log('✨ Modular seed completed');
}

if (require.main === module) {
  runAllSeeds()
    .catch((e) => {
      console.error('❌ Modular seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}



