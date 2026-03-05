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
 * - Event, EventScenario, vb.
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

/**
 * Kullanıcı ve içerik verilerini temizle (taxonomy/core verileri koru)
 *
 * TRUNCATE CASCADE kullanılır:
 *   - Anlık tablo temizliği, kilit süresi saniyeler
 *   - FK bypass gerekmez
 *
 * KORUNAN (taxonomy): categories, brands, badges, achievement chains/goals,
 *   comparison_metrics, user_themes, products, product_groups
 */
export async function clearUserContentData(): Promise<void> {
  console.log('🗑️  Kullanıcı ve içerik verileri temizleniyor (TRUNCATE)...');
  console.log('ℹ️  Taxonomy/Core verileri korunuyor (categories, brands, badges, themes, vb.)\n');

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      feeds, feed_highlights, trending_posts,
      content_shares, content_favorites, content_likes,
      content_comment_votes, content_comments, content_post_views,
      content_ratings, content_post_tags, top_community_choices,
      post_media, post_comparison_scores, post_comparisons,
      post_tags, post_tips, post_questions,
      content_posts, content_collections,
      marketplace_banners,
      nft_market_listings, nft_transactions, nft_claims, nft_attributes, nfts,
      event_stats, event_rewards, events,
      bridge_rewards, bridge_user_stats, bridge_leaderboards,
      bridge_followers, bridge_posts,
      brand_survey_answers, brand_survey_questions, brand_surveys,
      inventory_media, inventories,
      product_suggestions,
      user_collections, user_titles, user_badges, user_achievements, user_avatars,
      user_mutes, user_blocks, trust_relations, user_trust_scores,
      user_roles, user_feed_preferences, user_settings, profiles,
      expert_answers, expert_request_media, expert_requests,
      dm_feedbacks, dm_support_sessions, support_request_reports,
      dm_messages, dm_requests, dm_threads,
      reward_claims,
      tips_token_transfers, lootboxes, wallets,
      manual_review_flags, moderation_actions, admin_logs,
      password_reset_tokens, email_verification_codes, login_attempts,
      users
    CASCADE
  `);

  console.log('✅ Kullanıcı ve içerik verileri temizlendi');
  console.log('✅ Taxonomy/Core verileri korundu (categories, brands, badges, themes, products, vb.)');
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
