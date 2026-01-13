/**
 * Feed distribution'ı manuel olarak tetikler
 */

import dotenv from 'dotenv';
dotenv.config({ override: false });

import { triggerFeedDistributionAfterSeed } from '../prisma/seed/trigger-feed-distribution';

async function main() {
  console.log('🚀 Feed distribution tetikleniyor...\n');
  await triggerFeedDistributionAfterSeed();
  console.log('\n✅ Feed distribution tamamlandı!');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Feed distribution hatası:', error);
  process.exit(1);
});
