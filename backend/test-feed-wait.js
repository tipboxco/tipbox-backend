const { triggerFeedDistributionAfterSeed } = require('./prisma/seed/trigger-feed-distribution.ts');

(async () => {
  console.log('🧪 Testing with waitForCompletion=true\n');
  await triggerFeedDistributionAfterSeed(true);
  console.log('\n✅ Done!');
  process.exit(0);
})().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
