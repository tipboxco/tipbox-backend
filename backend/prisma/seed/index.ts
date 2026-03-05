import { prisma, TEST_USER_ID, TARGET_USER_ID, TRUST_USER_IDS, TRUSTER_USER_IDS } from './types';

import { seedTaxonomy } from './taxonomy.seed';
import { seedUsersAndProfiles } from './user.seed';
import { seedProductsAndContent } from './content.seed';
import { seedFeedAndTrending } from './feed.seed';
import { seedMarketplace } from './marketplace.seed';
import { seedExplore } from './explore.seed';
import { seedMessaging } from './messaging.seed';
import { seedBrandProducts } from './brand-products.seed';
import { seedProductCatalog } from './product-catalog.seed';
import { seedNewsBanner } from './news-banner.seed';
import { triggerFeedDistributionAfterSeed } from './trigger-feed-distribution';
import { SeedPipelineLogger } from './helpers/seed-pipeline-logger';
// Import from JS file (no ts-node issues)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { markSeedStart, markSeedEnd, addSeedUserId } = require('./seed-metadata');

export async function runAllSeeds(): Promise<void> {
  const pipeline = new SeedPipelineLogger('runAllSeeds', 12);

  // Seed başlangıcını işaretle
  markSeedStart();

  try {
    // [1/12] Register seed metadata
    await pipeline.runStage('Register seed metadata', () => {
      const allSeedUserIds = [
        TEST_USER_ID,
        TARGET_USER_ID,
        ...TRUST_USER_IDS,
        ...TRUSTER_USER_IDS,
      ];
      for (const userId of allSeedUserIds) {
        addSeedUserId(userId);
      }
      return Promise.resolve();
    }, `${[TEST_USER_ID, TARGET_USER_ID, ...TRUST_USER_IDS, ...TRUSTER_USER_IDS].length} users`);

    // [2/12] Seed taxonomy
    await pipeline.runStage('Seed taxonomy', () => seedTaxonomy());

    // [3/12] Seed product catalog (taxonomy'den sonra, main category'leri kullanıyor)
    await pipeline.runStage('Seed product catalog', () => seedProductCatalog());

    // [4/12] Seed users & profiles
    await pipeline.runStage('Seed users & profiles', () => seedUsersAndProfiles());

    // [5/12] Seed products & content
    await pipeline.runStage('Seed products & content', () => seedProductsAndContent());

    // [6/12] Seed feed & trending
    await pipeline.runStage('Seed feed & trending', () => seedFeedAndTrending());

    // [7/12] Seed marketplace
    await pipeline.runStage('Seed marketplace', () => seedMarketplace());

    // [8/12] Seed explore
    await pipeline.runStage('Seed explore', () => seedExplore());

    // [9/12] Seed messaging
    await pipeline.runStage('Seed messaging', () => seedMessaging());

    // [10/12] Seed brand products
    await pipeline.runStage('Seed brand products', () => seedBrandProducts());

    // [11/12] Seed news banner
    await pipeline.runStage('Seed news banner', () => seedNewsBanner());

    // Seed sonunu işaretle
    markSeedEnd();

    // [12/12] Feed distribution
    await pipeline.runStageOptional(
      'Trigger feed distribution',
      () => triggerFeedDistributionAfterSeed(),
      undefined,
    );

    pipeline.complete();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    markSeedEnd(); // Hata olsa bile metadata'yı temizle
    pipeline.fail(errorMsg);
    throw error;
  }
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



