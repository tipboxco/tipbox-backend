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
import { triggerFeedDistributionAfterSeed } from './trigger-feed-distribution';
// Import from JS file (no ts-node issues)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { markSeedStart, markSeedEnd, addSeedUserId } = require('./seed-metadata');

export async function runAllSeeds(): Promise<void> {
  console.log('🌱 Modular seed start');
  
  // Seed başlangıcını işaretle
  markSeedStart();
  
  // Seed.ts'deki tüm test kullanıcı ID'lerini metadata'ya ekle (seed.ts satır 6-28)
  // Bu ID'ler seed.ts'de tanımlı test kullanıcılarıdır
  const allSeedUserIds = [
    TEST_USER_ID,
    TARGET_USER_ID,
    ...TRUST_USER_IDS,
    ...TRUSTER_USER_IDS
  ];
  
  console.log(`📝 Seed kullanıcı ID'leri metadata'ya ekleniyor: ${allSeedUserIds.length} kullanıcı`);
  for (const userId of allSeedUserIds) {
    addSeedUserId(userId);
  }
  
  try {
    await seedTaxonomy();
    await seedProductCatalog(); // Product Catalog seed (taxonomy'den sonra, çünkü main category'leri kullanıyor)
    await seedUsersAndProfiles();
    await seedProductsAndContent();
    await seedFeedAndTrending();
    await seedMarketplace();
    await seedExplore();
    await seedMessaging();
    await seedBrandProducts();
    
    // Seed sonunu işaretle
    markSeedEnd();
    console.log('✨ Modular seed completed');
    
    // Seed sonrası feed distribution job'larını queue'ya ekle
    // FeedDistributionWorker çalıştığında bu job'lar işlenecek
    await triggerFeedDistributionAfterSeed();
  } catch (error) {
    console.error('❌ Seed hatası:', error);
    markSeedEnd(); // Hata olsa bile metadata'yı temizle
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



