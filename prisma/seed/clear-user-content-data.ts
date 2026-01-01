/**
 * Kullanıcı ve içerik verilerini temizleyen script
 * 
 * Bu script sadece kullanıcı/içerik verilerini temizler, sabit taxonomy/core verilerini korur:
 * 
 * KORUNAN (Taxonomy/Core):
 * - MainCategory, SubCategory, ProductGroup
 * - Product
 * - BrandCategory, Brand
 * - BadgeCategory, Badge
 * - AchievementChain, AchievementGoal
 * - ComparisonMetric
 * - UserTheme
 * - ExperienceDuration, ExperienceLocation, ExperiencePurpose
 * - BoostOption
 * 
 * TEMİZLENEN (User/Content):
 * - Tüm User ve ilişkili tablolar
 * - ContentPost ve tüm ilişkili tablolar
 * - Feed, TrendingPost, FeedHighlight
 * - Inventory, ProductExperience, InventoryMedia
 * - BrandSurvey, BridgePost, BridgeFollower, vb.
 * - WishboxEvent, WishboxScenario, vb.
 * - DMThread, DMMessage, DMRequest, vb.
 * - ExpertRequest, ExpertAnswer, vb.
 * - Wallet, TipsTokenTransfer, NFT, vb.
 * - MarketplaceBanner
 * - AdminLog, ModerationAction, ManualReviewFlag
 * - ProductSuggestion
 * 
 * Kullanım:
 *   npx ts-node prisma/seed/clear-user-content-data.ts
 */

import { prisma } from './types';
import { ProgressBar } from './helpers/progress-bar';

/**
 * Kullanıcı ve içerik verilerini temizle (taxonomy/core verileri koru)
 */
export async function clearUserContentData(): Promise<void> {
  console.log('🗑️  Kullanıcı ve içerik verileri temizleniyor...');
  console.log('ℹ️  Taxonomy/Core verileri korunuyor (categories, brands, badges, themes, vb.)\n');
  
  // Progress bar oluştur (toplam 12 ana grup)
  const totalSteps = 12;
  const progress = new ProgressBar(totalSteps, 50);

  try {
    // Foreign key constraint'leri nedeniyle ters sırada silme
    // En son oluşturulan verilerden başla
    
    // Feed ve trending verileri
    progress.increment('Feed ve trending verileri temizleniyor...');
    await prisma.feed.deleteMany({});
    await prisma.trendingPost.deleteMany({});
    await prisma.feedHighlight.deleteMany({});

    // Content verileri
    progress.increment('Content verileri temizleniyor...');
    await prisma.contentFavorite.deleteMany({});
    await prisma.contentLike.deleteMany({});
    await prisma.contentCommentVote.deleteMany({});
    await prisma.contentComment.deleteMany({});
    await prisma.contentPostView.deleteMany({});
    await prisma.contentRating.deleteMany({});
    await prisma.contentPostTag.deleteMany({});
    await prisma.topCommunityChoice.deleteMany({});
    await prisma.postMedia.deleteMany({});
    await prisma.postComparisonScore.deleteMany({});
    await prisma.postComparison.deleteMany({});
    await prisma.postTag.deleteMany({});
    await prisma.postTip.deleteMany({});
    await prisma.postQuestion.deleteMany({});
    await prisma.contentPost.deleteMany({});
    await prisma.contentCollection.deleteMany({});

    // Marketplace verileri
    progress.increment('Marketplace verileri temizleniyor...');
    await prisma.marketplaceBanner.deleteMany({});
    await prisma.nFTMarketListing.deleteMany({});
    await prisma.nFTTransaction.deleteMany({});
    await prisma.nFTClaim.deleteMany({});
    await prisma.nFTAttribute.deleteMany({});
    await prisma.nFT.deleteMany({});

    // Explore/Bridge verileri (BrandSurvey, BridgePost, WishboxEvent, vb.)
    progress.increment('Explore/Bridge verileri temizleniyor...');
    await prisma.wishboxStats.deleteMany({});
    await prisma.wishboxReward.deleteMany({});
    await prisma.choiceComment.deleteMany({});
    await prisma.scenarioChoice.deleteMany({});
    await prisma.wishboxScenario.deleteMany({});
    await prisma.wishboxEvent.deleteMany({});
    await prisma.bridgeReward.deleteMany({});
    await prisma.bridgeUserStats.deleteMany({});
    await prisma.bridgeLeaderboard.deleteMany({});
    await prisma.bridgeFollower.deleteMany({});
    await prisma.bridgePost.deleteMany({});
    await prisma.brandSurveyAnswer.deleteMany({});
    await prisma.brandSurveyQuestion.deleteMany({});
    await prisma.brandSurvey.deleteMany({});
    // NOT: Brand ve BrandCategory korunur (taxonomy)

    // Inventory verileri
    progress.increment('Inventory verileri temizleniyor...');
    await prisma.inventoryMedia.deleteMany({});
    await prisma.productExperience.deleteMany({});
    await prisma.inventory.deleteMany({});
    // NOT: Product, ProductGroup korunur (taxonomy)

    // Product suggestions (userId var)
    await prisma.productSuggestion.deleteMany({});
    // NOT: Product korunur (taxonomy)

    // User related verileri
    progress.increment('Kullanıcı ilişkili verileri temizleniyor...');
    await prisma.userCollection.deleteMany({});
    await prisma.userTitle.deleteMany({});
    await prisma.userBadge.deleteMany({});
    await prisma.userAchievement.deleteMany({});
    await prisma.userAvatar.deleteMany({});
    await prisma.userMute.deleteMany({});
    await prisma.userBlock.deleteMany({});
    await prisma.trustRelation.deleteMany({});
    await prisma.userTrustScore.deleteMany({});
    await prisma.userRole.deleteMany({});
    await prisma.userFeedPreferences.deleteMany({});
    await prisma.userSettings.deleteMany({});
    await prisma.profile.deleteMany({});
    // NOT: UserTheme korunur (taxonomy)

    // Expert verileri
    progress.increment('Expert verileri temizleniyor...');
    await prisma.expertAnswer.deleteMany({});
    await prisma.expertRequestMedia.deleteMany({});
    await prisma.expertRequest.deleteMany({});

    // Messaging verileri
    progress.increment('Messaging verileri temizleniyor...');
    await prisma.dMFeedback.deleteMany({});
    await prisma.dMSupportSession.deleteMany({});
    await prisma.supportRequestReport.deleteMany({});
    await prisma.dMMessage.deleteMany({});
    await prisma.dMRequest.deleteMany({});
    await prisma.dMThread.deleteMany({});

    // Gamification verileri (user'a ait)
    progress.increment('Gamification verileri temizleniyor...');
    await prisma.rewardClaim.deleteMany({});
    // NOT: AchievementGoal, AchievementChain, Badge, BadgeCategory korunur (taxonomy)

    // Crypto verileri
    progress.increment('Crypto verileri temizleniyor...');
    await prisma.tipsTokenTransfer.deleteMany({});
    await prisma.lootbox.deleteMany({});
    await prisma.wallet.deleteMany({});

    // Admin verileri
    progress.increment('Admin verileri temizleniyor...');
    await prisma.manualReviewFlag.deleteMany({});
    await prisma.moderationAction.deleteMany({});
    await prisma.adminLog.deleteMany({});

    // Auth verileri
    progress.increment('Auth verileri temizleniyor...');
    await prisma.passwordResetToken.deleteMany({});
    await prisma.emailVerificationCode.deleteMany({});
    await prisma.loginAttempt.deleteMany({});

    // User'ları sil (en son)
    progress.increment('Kullanıcılar temizleniyor...');
    await prisma.user.deleteMany({});

    progress.complete('Kullanıcı ve içerik verileri temizlendi!');
    console.log('\n✅ Kullanıcı ve içerik verileri temizlendi');
    console.log('✅ Taxonomy/Core verileri korundu (categories, brands, badges, themes, products, vb.)');
  } catch (error) {
    console.error('❌ Kullanıcı ve içerik verileri temizlenirken hata oluştu:', error);
    throw error;
  }
}

if (require.main === module) {
  clearUserContentData()
    .catch((e) => {
      console.error('❌ Clear user content data failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
