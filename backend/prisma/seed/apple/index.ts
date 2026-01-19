import { seedAppleBrand } from './apple-brand.seed';
import { seedAppleProducts } from './apple-products.seed';
import { seedApplePosts } from './apple-posts.seed';
import { seedAppleEvents } from './apple-events.seed';
import { seedAppleSurveys } from './apple-surveys.seed';
import { seedAppleNews } from './apple-news.seed';
import { seedAppleInteractions } from './apple-interactions.seed';
import { seedAppleLeaderboard } from './apple-leaderboard.seed';
import { seedAppleHistory } from './apple-history.seed';

/**
 * Apple brand için tüm seed dosyalarını sırayla çalıştır
 */
export async function seedApple(): Promise<void> {
  console.log('\n🍎 ========================================');
  console.log('🍎 Apple Brand Seed Başlatılıyor...');
  console.log('🍎 ========================================\n');

  try {
    // 1. Brand ve Category
    console.log('📋 Adım 1/8: Brand ve Category');
    const brandResult = await seedAppleBrand();
    console.log(`✅ Brand ID: ${brandResult.brandId}\n`);

    // 2. Products ve Product Groups
    console.log('📋 Adım 2/8: Products ve Product Groups');
    const productsResult = await seedAppleProducts(brandResult.brandId);
    console.log(`✅ ${productsResult.productGroups.length} product group, toplam ürünler oluşturuldu\n`);

    // 3. Posts
    console.log('📋 Adım 3/8: Posts');
    const postsResult = await seedApplePosts(brandResult.brandId);
    console.log(`✅ ${postsResult.posts.length} post oluşturuldu\n`);

    // 4. Events ve Challenges
    console.log('📋 Adım 4/8: Events ve Challenges');
    const eventsResult = await seedAppleEvents(brandResult.brandId);
    console.log(`✅ Event ve ${eventsResult.challenges.length} challenge oluşturuldu\n`);

    // 5. Surveys
    console.log('📋 Adım 5/8: Surveys');
    const surveysResult = await seedAppleSurveys(brandResult.brandId);
    console.log(`✅ ${surveysResult.surveys.length} survey oluşturuldu\n`);

    // 6. News
    console.log('📋 Adım 6/8: News');
    const newsResult = await seedAppleNews(brandResult.brandId);
    console.log(`✅ ${newsResult.news.length} news oluşturuldu\n`);

    // 7. Interactions
    console.log('📋 Adım 7/8: Interactions');
    const interactionsResult = await seedAppleInteractions(brandResult.brandId);
    console.log(`✅ Post interactions: ${interactionsResult.postInteractions.likes} likes, ${interactionsResult.postInteractions.comments} comments`);
    console.log(`✅ News interactions: ${interactionsResult.newsInteractions.likes} likes, ${interactionsResult.newsInteractions.comments} comments\n`);

    // 8. Leaderboard
    console.log('📋 Adım 8/9: Leaderboard');
    const leaderboardResult = await seedAppleLeaderboard(brandResult.brandId);
    console.log(`✅ ${leaderboardResult.leaderboards.length} leaderboard kaydı oluşturuldu\n`);

    // 9. History
    console.log('📋 Adım 9/9: Brand History');
    const surveyIds = surveysResult.surveys.map(s => s.id);
    const historyResult = await seedAppleHistory(
      brandResult.brandId,
      eventsResult.eventId,
      eventsResult.challenges,
      surveyIds
    );
    console.log(`✅ History verileri oluşturuldu: ${historyResult.userStats} user stats, ${historyResult.rewardClaims} reward claims, ${historyResult.bridgeRewards} bridge rewards, ${historyResult.eventStats} event stats\n`);

    console.log('🍎 ========================================');
    console.log('🍎 Apple Brand Seed Tamamlandı! ✅');
    console.log('🍎 ========================================\n');

    console.log('📊 Özet:');
    console.log(`   ✅ Brand: ${brandResult.brandId}`);
    console.log(`   ✅ Product Groups: ${productsResult.productGroups.length}`);
    console.log(`   ✅ Posts: ${postsResult.posts.length}`);
    console.log(`   ✅ Events: 1 (${eventsResult.challenges.length} challenges)`);
    console.log(`   ✅ Surveys: ${surveysResult.surveys.length}`);
    console.log(`   ✅ News: ${newsResult.news.length}`);
    console.log(`   ✅ Leaderboard Entries: ${leaderboardResult.leaderboards.length}`);
    console.log(`   ✅ History Records: ${historyResult.userStats + historyResult.rewardClaims + historyResult.bridgeRewards + historyResult.eventStats}`);
    console.log('');
  } catch (error) {
    console.error('❌ Apple seed sırasında hata:', error);
    throw error;
  }
}

// Eğer doğrudan çalıştırılıyorsa
if (require.main === module) {
  seedApple()
    .then(() => {
      console.log('✅ Apple seed başarıyla tamamlandı!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Apple seed hatası:', error);
      process.exit(1);
    });
}
