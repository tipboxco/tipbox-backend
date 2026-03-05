import { prisma } from './types';
// Import from JS file (no ts-node issues)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getLastSeedRunTime, clearSeedMetadata, getSeedUserIds } = require('./seed-metadata');

/**
 * Seed data ile test sonrası eklenen datayı ayırt etmek için iki yöntem kullanılır:
 * 1. Timestamp bazlı: Seed çalıştırıldığında timestamp kaydedilir, sadece o tarihten önceki veriler seed data olarak kabul edilir
 * 2. ID bazlı: Seed'de kullanılan belirli ID'ler (TEST_USER_ID, vb.) kaydedilir
 * 
 * Clear seed data çalıştırıldığında:
 * - Eğer seed metadata varsa: Sadece seed timestamp'inden önceki veriler silinir
 * - Eğer seed metadata yoksa: TÜM veriler silinir (eski davranış)
 */
export async function clearAllSeedData(forceClearAll: boolean = false): Promise<void> {
  console.log('🗑️  Seed verileri temizleniyor...');
  
  // Eğer forceClearAll true ise, metadata'ya bakmadan tüm verileri sil
  if (forceClearAll) {
    console.log('⚠️  FORCE MODE: TÜM veriler silinecek (metadata kontrolü yapılmıyor)!');
    await clearAllData();
    // Metadata'yı da temizle
    clearSeedMetadata();
    console.log('✅ Tüm veriler temizlendi');
    return;
  }
  
  const lastSeedRun = getLastSeedRunTime();
  const seedUserIds = getSeedUserIds();
  
  if (!lastSeedRun) {
    console.log('⚠️  Seed metadata bulunamadı, TÜM veriler silinecek!');
    // Eski davranış: Tüm verileri sil
    await clearAllData();
    return;
  }
  
  console.log(`📅 Seed çalıştırma zamanı: ${lastSeedRun.toISOString()}`);
  console.log(`👤 Seed kullanıcı sayısı: ${seedUserIds.length}`);
  
  // Seed timestamp'inden önceki verileri sil
  await clearDataBeforeTimestamp(lastSeedRun, seedUserIds);
  
  // Metadata'yı temizle
  clearSeedMetadata();
  console.log('✅ Seed verileri temizlendi (metadata temizlendi)');
}

/**
 * Tüm verileri sil.
 *
 * TRUNCATE ... CASCADE kullanılır:
 *   - Row-by-row DELETE yerine anlık tablo temizliği → kilit süresi saniyeler
 *   - FK constraint bypass gerekmez (CASCADE otomatik halleder)
 *   - Backend çalışırken çağrılsa bile sunucu kilitlenmez
 */
async function clearAllData(): Promise<void> {
  console.log('🗑️  TRUNCATE ile tüm veriler temizleniyor...');

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
      brand_survey_answers, brand_surveys, brands, brand_categories,
      inventory_media, inventories,
      user_collections, user_titles, user_badges, user_achievements, user_avatars,
      user_mutes, user_blocks, trust_relations, user_trust_scores,
      user_roles, user_feed_preferences, user_settings, profiles,
      expert_answers, expert_request_media, expert_requests,
      dm_feedbacks, dm_support_sessions, support_request_reports,
      dm_messages, dm_requests, dm_threads,
      reward_claims, achievement_goals, achievement_chains,
      event_badges, badges, badge_categories,
      tips_token_transfers, lootboxes, wallets,
      product_suggestions, products, product_groups,
      sub_categories, main_categories, comparison_metrics,
      manual_review_flags, moderation_actions, admin_logs,
      user_themes,
      password_reset_tokens, email_verification_codes, login_attempts,
      users
    CASCADE
  `);

  console.log('✅ Tüm veriler temizlendi');
}

/**
 * Belirli bir timestamp'ten önceki verileri sil
 * NOT: Taxonomy verileri (categories, badges, themes) ve products silinmez çünkü bunlar test verilerinden bağımsızdır
 * ve test verileri silindiğinde de korunması gerekir.
 */
/**
 * Belirli seed kullanıcılarının verilerini sil (timestamp bazlı).
 *
 * Tek bir $transaction içinde çalışır:
 *   - SET LOCAL session_replication_role = replica → FK bypass (aynı bağlantı)
 *   - Tüm delete'ler tek connection üzerinden → PG overload yok
 *   - Transaction bitince FK constraint'ler otomatik geri döner
 *
 * NOT: Taxonomy (categories, badges, themes) ve products korunur.
 */
async function clearDataBeforeTimestamp(timestamp: Date, seedUserIds: string[]): Promise<void> {
  console.log(`🗑️  ${timestamp.toISOString()} tarihinden önceki seed verileri temizleniyor...`);
  console.log('ℹ️  Taxonomy (categories, badges, themes) ve products korunacak');

  await prisma.$transaction(
    async (tx) => {
      // FK constraint bypass — transaction-scoped, otomatik resetlenir
      await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica;');

      if (seedUserIds.length > 0) {
        console.log(`👤 Seed kullanıcılarının verileri temizleniyor: ${seedUserIds.length} kullanıcı`);

        // ── Feed & trending ──
        await tx.feed.deleteMany({ where: { userId: { in: seedUserIds } } });
        await tx.trendingPost.deleteMany({ where: { post: { userId: { in: seedUserIds } } } });

        // ── Content (leaf → parent sırasıyla) ──
        await tx.contentShare.deleteMany({ where: { OR: [{ userId: { in: seedUserIds } }, { post: { userId: { in: seedUserIds } } }] } });
        await tx.contentFavorite.deleteMany({ where: { OR: [{ userId: { in: seedUserIds } }, { post: { userId: { in: seedUserIds } } }] } });
        await tx.contentLike.deleteMany({ where: { OR: [{ userId: { in: seedUserIds } }, { post: { userId: { in: seedUserIds } } }] } });
        await tx.contentCommentVote.deleteMany({ where: { OR: [{ userId: { in: seedUserIds } }, { comment: { userId: { in: seedUserIds } } }] } });
        await tx.contentComment.deleteMany({ where: { OR: [{ userId: { in: seedUserIds } }, { post: { userId: { in: seedUserIds } } }] } });
        await tx.contentPostView.deleteMany({ where: { OR: [{ userId: { in: seedUserIds } }, { post: { userId: { in: seedUserIds } } }] } });
        await tx.contentPostTag.deleteMany({ where: { post: { userId: { in: seedUserIds } } } });
        await tx.topCommunityChoice.deleteMany({ where: { post: { userId: { in: seedUserIds } } } });
        await tx.postMedia.deleteMany({ where: { userId: { in: seedUserIds } } });
        await tx.postComparisonScore.deleteMany({ where: { comparison: { post: { userId: { in: seedUserIds } } } } });
        await tx.postComparison.deleteMany({ where: { post: { userId: { in: seedUserIds } } } });
        await tx.postTip.deleteMany({ where: { post: { userId: { in: seedUserIds } } } });
        await tx.postQuestion.deleteMany({ where: { post: { userId: { in: seedUserIds } } } });
        await tx.contentPost.deleteMany({ where: { userId: { in: seedUserIds } } });

        // ── Marketplace / NFT ──
        await tx.nFTMarketListing.deleteMany({ where: { listedByUserId: { in: seedUserIds } } });
        await tx.nFTTransaction.deleteMany({ where: { OR: [{ fromUserId: { in: seedUserIds } }, { toUserId: { in: seedUserIds } }] } });
        await tx.nFTClaim.deleteMany({ where: { userId: { in: seedUserIds } } });
        await tx.nFTAttribute.deleteMany({ where: { nft: { currentOwnerId: { in: seedUserIds } } } });
        await tx.nFT.deleteMany({ where: { currentOwnerId: { in: seedUserIds } } });

        // ── Explore / Bridge ──
        await tx.eventStats.deleteMany({ where: { userId: { in: seedUserIds } } });
        await tx.bridgeFollower.deleteMany({ where: { userId: { in: seedUserIds } } });
        await tx.bridgePost.deleteMany({ where: { userId: { in: seedUserIds } } });

        // ── Inventory ──
        await tx.inventoryMedia.deleteMany({ where: { inventory: { userId: { in: seedUserIds } } } });
        await tx.inventory.deleteMany({ where: { userId: { in: seedUserIds } } });

        // ── User related ──
        await tx.userCollection.deleteMany({ where: { userId: { in: seedUserIds } } });
        await tx.userTitle.deleteMany({ where: { userId: { in: seedUserIds } } });
        await tx.userBadge.deleteMany({ where: { userId: { in: seedUserIds } } });
        await tx.userAchievement.deleteMany({ where: { userId: { in: seedUserIds } } });
        await tx.userAvatar.deleteMany({ where: { userId: { in: seedUserIds } } });
        await tx.userMute.deleteMany({ where: { OR: [{ muterId: { in: seedUserIds } }, { mutedUserId: { in: seedUserIds } }] } });
        await tx.userBlock.deleteMany({ where: { OR: [{ blockerId: { in: seedUserIds } }, { blockedUserId: { in: seedUserIds } }] } });
        await tx.trustRelation.deleteMany({ where: { OR: [{ trusterId: { in: seedUserIds } }, { trustedUserId: { in: seedUserIds } }] } });
        await tx.userTrustScore.deleteMany({ where: { userId: { in: seedUserIds } } });
        await tx.userRole.deleteMany({ where: { userId: { in: seedUserIds } } });
        await tx.userFeedPreferences.deleteMany({ where: { userId: { in: seedUserIds } } });
        await tx.userSettings.deleteMany({ where: { userId: { in: seedUserIds } } });
        await tx.profile.deleteMany({ where: { userId: { in: seedUserIds } } });

        // ── Expert ──
        await tx.expertAnswer.deleteMany({ where: { OR: [{ expertUserId: { in: seedUserIds } }, { request: { userId: { in: seedUserIds } } }] } });
        await tx.expertRequestMedia.deleteMany({ where: { request: { userId: { in: seedUserIds } } } });
        await tx.expertRequest.deleteMany({ where: { userId: { in: seedUserIds } } });

        // ── Messaging ──
        await tx.dMSupportSession.deleteMany({ where: { OR: [{ helperId: { in: seedUserIds } }, { thread: { OR: [{ userOneId: { in: seedUserIds } }, { userTwoId: { in: seedUserIds } }] } }] } });
        await tx.supportRequestReport.deleteMany({ where: { OR: [{ reporterId: { in: seedUserIds } }, { request: { OR: [{ fromUserId: { in: seedUserIds } }, { toUserId: { in: seedUserIds } }] } }] } });
        await tx.dMMessage.deleteMany({ where: { OR: [{ senderId: { in: seedUserIds } }, { thread: { OR: [{ userOneId: { in: seedUserIds } }, { userTwoId: { in: seedUserIds } }] } }] } });
        await tx.dMRequest.deleteMany({ where: { OR: [{ fromUserId: { in: seedUserIds } }, { toUserId: { in: seedUserIds } }] } });
        await tx.dMThread.deleteMany({ where: { OR: [{ userOneId: { in: seedUserIds } }, { userTwoId: { in: seedUserIds } }] } });

        // ── Crypto ──
        await tx.tipsTokenTransfer.deleteMany({ where: { OR: [{ fromUserId: { in: seedUserIds } }, { toUserId: { in: seedUserIds } }] } });
        await tx.lootbox.deleteMany({ where: { userId: { in: seedUserIds } } });
        await tx.wallet.deleteMany({ where: { userId: { in: seedUserIds } } });

        // ── Auth ──
        await tx.emailVerificationCode.deleteMany({ where: { userId: { in: seedUserIds } } });
        await tx.passwordResetToken.deleteMany({ where: { userId: { in: seedUserIds } } });
        await tx.loginAttempt.deleteMany({ where: { userId: { in: seedUserIds } } });

        // ── Seed kullanıcıları ──
        await tx.user.deleteMany({ where: { id: { in: seedUserIds } } });

        // ── Timestamp bazlı non-user verileri ──
        await tx.marketplaceBanner.deleteMany({ where: { createdAt: { lt: timestamp } } });

        // Brand zinciri: answer → question → survey → brand → category
        await tx.brandSurveyAnswer.deleteMany({ where: { question: { survey: { brand: { createdAt: { lt: timestamp } } } } } });
        await tx.brandSurveyQuestion.deleteMany({ where: { survey: { brand: { createdAt: { lt: timestamp } } } } });
        await tx.brandSurvey.deleteMany({ where: { brand: { createdAt: { lt: timestamp } } } });
        await tx.brand.deleteMany({ where: { createdAt: { lt: timestamp } } });
        await tx.brandCategory.deleteMany({ where: { createdAt: { lt: timestamp } } });

        // Explore timestamp bazlı
        await tx.eventReward.deleteMany({ where: { createdAt: { lt: timestamp } } });
        await tx.event.deleteMany({ where: { createdAt: { lt: timestamp } } });
        await tx.bridgeReward.deleteMany({ where: { createdAt: { lt: timestamp } } });
        await tx.bridgeUserStats.deleteMany({ where: { createdAt: { lt: timestamp } } });
        await tx.bridgeLeaderboard.deleteMany({ where: { createdAt: { lt: timestamp } } });
      } else {
        // Seed kullanıcı ID'leri yoksa, sadece timestamp'e göre sil
        console.log('⚠️  Seed kullanıcı ID\'leri bulunamadı, sadece timestamp\'e göre temizleme yapılıyor');
        await tx.feed.deleteMany({ where: { createdAt: { lt: timestamp } } });
        await tx.contentPost.deleteMany({ where: { createdAt: { lt: timestamp } } });
        await tx.user.deleteMany({ where: { createdAt: { lt: timestamp } } });
      }

      console.log('✅ Seed verileri temizlendi (taxonomy ve products korundu)');
    },
    { timeout: 300_000 },
  );
}

if (require.main === module) {
  // Komut satırı argümanlarını kontrol et
  const forceClearAll = process.argv.includes('--force') || process.argv.includes('-f');
  
  clearAllSeedData(forceClearAll)
    .catch((e) => {
      console.error('❌ Clear seed data failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

