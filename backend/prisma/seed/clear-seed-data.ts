import { prisma } from './types';
import { ProgressBar } from './helpers/progress-bar';
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
 * Tüm verileri sil (eski davranış)
 *
 * Tüm delete operasyonları tek bir $transaction içinde çalışır.
 * SET LOCAL session_replication_role = replica → FK constraint'leri devre dışı bırakır,
 * transaction bitince otomatik olarak 'origin'e döner (aynı bağlantı garantisi).
 */
async function clearAllData(): Promise<void> {
  // Progress bar oluştur (toplam 15 ana grup)
  const totalSteps = 15
  const progress = new ProgressBar(totalSteps, 50)

  await prisma.$transaction(
    async (tx) => {
      // SET LOCAL: bu transaction'a özgü, bitince otomatik resetlenir
      // Tüm tx sorguları aynı bağlantıyı kullanır → FK bypass güvenli
      await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica;');

      // Feed ve trending verileri
      progress.increment('Feed ve trending verileri temizleniyor...')
      await tx.feed.deleteMany({});
      await tx.trendingPost.deleteMany({});
      await tx.feedHighlight.deleteMany({});

      // Content verileri
      progress.increment('Content verileri temizleniyor...')
      await tx.contentShare.deleteMany({});
      await tx.contentFavorite.deleteMany({});
      await tx.contentLike.deleteMany({});
      await tx.contentCommentVote.deleteMany({});
      await tx.contentComment.deleteMany({});
      await tx.contentPostView.deleteMany({});
      await tx.contentRating.deleteMany({});
      await tx.contentPostTag.deleteMany({});
      await tx.topCommunityChoice.deleteMany({});
      await tx.postMedia.deleteMany({});
      await tx.postComparisonScore.deleteMany({});
      await tx.postComparison.deleteMany({});
      await tx.postTag.deleteMany({});
      await tx.postTip.deleteMany({});
      await tx.postQuestion.deleteMany({});
      await tx.contentPost.deleteMany({});
      await tx.contentCollection.deleteMany({});

      // Marketplace verileri
      progress.increment('Marketplace verileri temizleniyor...')
      await tx.marketplaceBanner.deleteMany({});
      await tx.nFTMarketListing.deleteMany({});
      await tx.nFTTransaction.deleteMany({});
      await tx.nFTClaim.deleteMany({});
      await tx.nFTAttribute.deleteMany({});
      await tx.nFT.deleteMany({});

      // Explore verileri
      await tx.eventStats.deleteMany({});
      await tx.eventReward.deleteMany({});
      await tx.event.deleteMany({});
      await tx.bridgeReward.deleteMany({});
      await tx.bridgeUserStats.deleteMany({});
      await tx.bridgeLeaderboard.deleteMany({});
      await tx.bridgeFollower.deleteMany({});
      await tx.bridgePost.deleteMany({});
      await tx.brandSurveyAnswer.deleteMany({});
      await tx.brandSurvey.deleteMany({});
      await tx.brand.deleteMany({});
      await tx.brandCategory.deleteMany({});

      // Inventory verileri
      progress.increment('Inventory verileri temizleniyor...')
      await tx.inventoryMedia.deleteMany({});
      await tx.inventory.deleteMany({});

      // User related verileri
      await tx.userCollection.deleteMany({});
      await tx.userTitle.deleteMany({});
      await tx.userBadge.deleteMany({});
      await tx.userAchievement.deleteMany({});
      await tx.userAvatar.deleteMany({});
      await tx.userMute.deleteMany({});
      await tx.userBlock.deleteMany({});
      await tx.trustRelation.deleteMany({});
      await tx.userTrustScore.deleteMany({});
      await tx.userRole.deleteMany({});
      await tx.userFeedPreferences.deleteMany({});
      await tx.userSettings.deleteMany({});
      await tx.profile.deleteMany({});

      // Expert verileri
      progress.increment('Expert verileri temizleniyor...')
      await tx.expertAnswer.deleteMany({});
      await tx.expertRequestMedia.deleteMany({});
      await tx.expertRequest.deleteMany({});

      // Messaging verileri
      await tx.dMFeedback.deleteMany({});
      await tx.dMSupportSession.deleteMany({});
      await tx.supportRequestReport.deleteMany({});
      await tx.dMMessage.deleteMany({});
      await tx.dMRequest.deleteMany({});
      await tx.dMThread.deleteMany({});

      // Gamification verileri
      progress.increment('Gamification verileri temizleniyor...')
      await tx.rewardClaim.deleteMany({});
      await tx.achievementGoal.deleteMany({});
      await tx.achievementChain.deleteMany({});
      await tx.eventBadge.deleteMany({});
      await tx.badge.deleteMany({});
      await tx.badgeCategory.deleteMany({});

      // Crypto verileri
      await tx.tipsTokenTransfer.deleteMany({});
      await tx.lootbox.deleteMany({});
      await tx.wallet.deleteMany({});

      // Product verileri
      progress.increment('Product verileri temizleniyor...')
      await tx.productSuggestion.deleteMany({});
      await tx.product.deleteMany({});
      await tx.productGroup.deleteMany({});

      // Taxonomy verileri
      await tx.subCategory.deleteMany({});
      await tx.mainCategory.deleteMany({});
      await tx.comparisonMetric.deleteMany({});

      // Admin verileri
      progress.increment('Admin verileri temizleniyor...')
      await tx.manualReviewFlag.deleteMany({});
      await tx.moderationAction.deleteMany({});
      await tx.adminLog.deleteMany({});

      await tx.userTheme.deleteMany({});

      // Auth verileri
      progress.increment('Auth verileri temizleniyor...')
      await tx.passwordResetToken.deleteMany({});
      await tx.emailVerificationCode.deleteMany({});
      await tx.loginAttempt.deleteMany({});

      // User'ları sil (en son)
      progress.increment('Kullanıcılar temizleniyor...')
      await tx.user.deleteMany({});

      progress.complete('Tüm seed verileri temizlendi!')
      console.log('\n✅ Tüm seed verileri temizlendi');
    },
    {
      // Büyük veri setleri için yeterli süre (5 dakika)
      timeout: 300_000,
    },
  );
}

/**
 * Belirli bir timestamp'ten önceki verileri sil
 * NOT: Taxonomy verileri (categories, badges, themes) ve products silinmez çünkü bunlar test verilerinden bağımsızdır
 * ve test verileri silindiğinde de korunması gerekir.
 */
async function clearDataBeforeTimestamp(timestamp: Date, seedUserIds: string[]): Promise<void> {
  try {
    console.log(`🗑️  ${timestamp.toISOString()} tarihinden önceki seed verileri temizleniyor...`);
    console.log('ℹ️  Taxonomy (categories, badges, themes) ve products korunacak');
    
    // Seed kullanıcılarının tüm verilerini sil (timestamp'e bakmadan)
    if (seedUserIds.length > 0) {
      console.log(`👤 Seed kullanıcılarının verileri temizleniyor: ${seedUserIds.length} kullanıcı`);
      
      // Feed ve trending verileri - seed kullanıcılarına ait
      await prisma.feed.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      // Content verileri - seed kullanıcılarına ait
      await prisma.contentFavorite.deleteMany({
        where: {
          OR: [
            { userId: { in: seedUserIds } },
            { post: { userId: { in: seedUserIds } } }
          ]
        }
      });
      
      await prisma.contentShare.deleteMany({
        where: {
          OR: [
            { userId: { in: seedUserIds } },
            { post: { userId: { in: seedUserIds } } }
          ]
        }
      });
      
      await prisma.contentFavorite.deleteMany({
        where: {
          OR: [
            { userId: { in: seedUserIds } },
            { post: { userId: { in: seedUserIds } } }
          ]
        }
      });
      
      await prisma.contentLike.deleteMany({
        where: {
          OR: [
            { userId: { in: seedUserIds } },
            { post: { userId: { in: seedUserIds } } }
          ]
        }
      });
      
      await prisma.contentCommentVote.deleteMany({
        where: {
          OR: [
            { userId: { in: seedUserIds } },
            { comment: { userId: { in: seedUserIds } } }
          ]
        }
      });
      
      await prisma.contentComment.deleteMany({
        where: {
          OR: [
            { userId: { in: seedUserIds } },
            { post: { userId: { in: seedUserIds } } }
          ]
        }
      });
      
      await prisma.contentPostView.deleteMany({
        where: {
          OR: [
            { userId: { in: seedUserIds } },
            { post: { userId: { in: seedUserIds } } }
          ]
        }
      });
      
      await prisma.contentPostTag.deleteMany({
        where: { post: { userId: { in: seedUserIds } } }
      });
      
      await prisma.topCommunityChoice.deleteMany({
        where: { post: { userId: { in: seedUserIds } } }
      });
      
      await prisma.postMedia.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      await prisma.postComparisonScore.deleteMany({
        where: { comparison: { post: { userId: { in: seedUserIds } } } }
      });
      
      await prisma.postComparison.deleteMany({
        where: { post: { userId: { in: seedUserIds } } }
      });
      
      await prisma.postTip.deleteMany({
        where: { post: { userId: { in: seedUserIds } } }
      });
      
      await prisma.postQuestion.deleteMany({
        where: { post: { userId: { in: seedUserIds } } }
      });
      
      // Content post'ları - seed kullanıcılarına ait
      await prisma.contentPost.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      // Trending post'ları - seed kullanıcılarına ait post'lar için
      await prisma.trendingPost.deleteMany({
        where: { post: { userId: { in: seedUserIds } } }
      });
      
      // Marketplace verileri - seed kullanıcılarına ait
      await prisma.nFTMarketListing.deleteMany({
        where: { listedByUserId: { in: seedUserIds } }
      });
      
      await prisma.nFTTransaction.deleteMany({
        where: {
          OR: [
            { fromUserId: { in: seedUserIds } },
            { toUserId: { in: seedUserIds } }
          ]
        }
      });
      
      await prisma.nFTClaim.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      // NFT'ler - seed kullanıcılarına ait (currentOwnerId)
      await prisma.nFTAttribute.deleteMany({
        where: { nft: { currentOwnerId: { in: seedUserIds } } }
      });
      
      await prisma.nFT.deleteMany({
        where: { currentOwnerId: { in: seedUserIds } }
      });
      
      // Explore verileri - seed kullanıcılarına ait
      await prisma.eventStats.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      await prisma.bridgeFollower.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      await prisma.bridgePost.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      // Inventory verileri - seed kullanıcılarına ait
      await prisma.inventoryMedia.deleteMany({
        where: { inventory: { userId: { in: seedUserIds } } }
      });
      
      // productExperience tablosu kaldırıldı
      
      await prisma.inventory.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      // User related verileri - seed kullanıcılarına ait
      await prisma.userCollection.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      await prisma.userTitle.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      await prisma.userBadge.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      await prisma.userAchievement.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      await prisma.userAvatar.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      await prisma.userMute.deleteMany({
        where: {
          OR: [
            { muterId: { in: seedUserIds } },
            { mutedUserId: { in: seedUserIds } }
          ]
        }
      });
      
      await prisma.userBlock.deleteMany({
        where: {
          OR: [
            { blockerId: { in: seedUserIds } },
            { blockedUserId: { in: seedUserIds } }
          ]
        }
      });
      
      await prisma.trustRelation.deleteMany({
        where: {
          OR: [
            { trusterId: { in: seedUserIds } },
            { trustedUserId: { in: seedUserIds } }
          ]
        }
      });
      
      await prisma.userTrustScore.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      await prisma.userRole.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      await prisma.userFeedPreferences.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      await prisma.userSettings.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      await prisma.profile.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      // Expert verileri - seed kullanıcılarına ait
      const seedUserRequests = await prisma.expertRequest.findMany({
        where: { userId: { in: seedUserIds } },
        select: { id: true }
      });
      const seedUserRequestIds = seedUserRequests.map(r => r.id);
      
      if (seedUserRequestIds.length > 0) {
        await prisma.expertAnswer.deleteMany({
          where: {
            OR: [
              { expertUserId: { in: seedUserIds } },
              { requestId: { in: seedUserRequestIds } }
            ]
          }
        });
        
        await prisma.expertRequestMedia.deleteMany({
          where: { requestId: { in: seedUserRequestIds } }
        });
      }
      
      await prisma.expertAnswer.deleteMany({
        where: { expertUserId: { in: seedUserIds } }
      });
      
      await prisma.expertRequest.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      // Messaging verileri - seed kullanıcılarına ait
      await prisma.dMSupportSession.deleteMany({
        where: {
          OR: [
            { helperId: { in: seedUserIds } },
            { thread: {
              OR: [
                { userOneId: { in: seedUserIds } },
                { userTwoId: { in: seedUserIds } }
              ]
            }}
          ]
        }
      });
      
      await prisma.supportRequestReport.deleteMany({
        where: {
          OR: [
            { reporterId: { in: seedUserIds } },
            { request: {
              OR: [
                { fromUserId: { in: seedUserIds } },
                { toUserId: { in: seedUserIds } }
              ]
            }}
          ]
        }
      });
      
      await prisma.dMMessage.deleteMany({
        where: {
          OR: [
            { senderId: { in: seedUserIds } },
            { thread: {
              OR: [
                { userOneId: { in: seedUserIds } },
                { userTwoId: { in: seedUserIds } }
              ]
            }}
          ]
        }
      });
      
      await prisma.dMRequest.deleteMany({
        where: {
          OR: [
            { fromUserId: { in: seedUserIds } },
            { toUserId: { in: seedUserIds } }
          ]
        }
      });
      
      await prisma.dMThread.deleteMany({
        where: {
          OR: [
            { userOneId: { in: seedUserIds } },
            { userTwoId: { in: seedUserIds } }
          ]
        }
      });
      
      // Crypto verileri - seed kullanıcılarına ait
      await prisma.tipsTokenTransfer.deleteMany({
        where: {
          OR: [
            { fromUserId: { in: seedUserIds } },
            { toUserId: { in: seedUserIds } }
          ]
        }
      });
      
      await prisma.lootbox.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      await prisma.wallet.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      // Auth verileri - seed kullanıcılarına ait
      await prisma.emailVerificationCode.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      await prisma.passwordResetToken.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      await prisma.loginAttempt.deleteMany({
        where: { userId: { in: seedUserIds } }
      });
      
      // User'ları sil (seed kullanıcıları)
      await prisma.user.deleteMany({
        where: { id: { in: seedUserIds } }
      });
      
      // Marketplace banner'ları timestamp'e göre sil (seed sırasında oluşturulduysa)
      await prisma.marketplaceBanner.deleteMany({
        where: { createdAt: { lt: timestamp } }
      });
      
      // Brand'leri timestamp'e göre sil (seed sırasında oluşturulduysa)
      // Önce brand'leri bul
      const seedBrands = await prisma.brand.findMany({
        where: { createdAt: { lt: timestamp } },
        select: { id: true }
      });
      const seedBrandIds = seedBrands.map(b => b.id);
      
      if (seedBrandIds.length > 0) {
        // Brand survey'leri bul
        const seedSurveys = await prisma.brandSurvey.findMany({
          where: { brandId: { in: seedBrandIds } },
          select: { id: true }
        });
        const seedSurveyIds = seedSurveys.map(s => s.id);
        
        // Brand survey question'ları bul ve answer'ları sil
        if (seedSurveyIds.length > 0) {
          const seedQuestions = await prisma.brandSurveyQuestion.findMany({
            where: { surveyId: { in: seedSurveyIds } },
            select: { id: true }
          });
          const seedQuestionIds = seedQuestions.map(q => q.id);
          
          // Brand survey answer'ları sil (questionId üzerinden)
          if (seedQuestionIds.length > 0) {
            await prisma.brandSurveyAnswer.deleteMany({
              where: { questionId: { in: seedQuestionIds } }
            });
          }
          
          // Brand survey question'ları sil
          await prisma.brandSurveyQuestion.deleteMany({
            where: { surveyId: { in: seedSurveyIds } }
          });
        }
        
        // Brand survey'leri sil
        await prisma.brandSurvey.deleteMany({
          where: { brandId: { in: seedBrandIds } }
        });
      }
      
      // Brand'leri sil
      await prisma.brand.deleteMany({
        where: { createdAt: { lt: timestamp } }
      });
      
      // BrandCategory'leri timestamp'e göre sil (seed sırasında oluşturulduysa)
      await prisma.brandCategory.deleteMany({
        where: { createdAt: { lt: timestamp } }
      });
      
      // Explore bridge verileri - timestamp'e göre
      await prisma.eventReward.deleteMany({
        where: { createdAt: { lt: timestamp } }
      });
      
      // Scenario tables removed - no longer exist
      // await prisma.choiceComment.deleteMany({
      //   where: { createdAt: { lt: timestamp } }
      // });
      
      // await prisma.scenarioChoice.deleteMany({
      //   where: { createdAt: { lt: timestamp } }
      // });
      
      // await prisma.eventScenario.deleteMany({
      //   where: { createdAt: { lt: timestamp } }
      // });
      
      await prisma.event.deleteMany({
        where: { createdAt: { lt: timestamp } }
      });
      
      await prisma.bridgeReward.deleteMany({
        where: { createdAt: { lt: timestamp } }
      });
      
      await prisma.bridgeUserStats.deleteMany({
        where: { createdAt: { lt: timestamp } }
      });
      
      await prisma.bridgeLeaderboard.deleteMany({
        where: { createdAt: { lt: timestamp } }
      });
    } else {
      // Seed kullanıcı ID'leri yoksa, sadece timestamp'e göre sil (ama taxonomy ve products koru)
      console.log('⚠️  Seed kullanıcı ID\'leri bulunamadı, sadece timestamp\'e göre temizleme yapılıyor');
      console.log('ℹ️  Taxonomy (categories, badges, themes) ve products korunacak');
      
      await prisma.feed.deleteMany({
        where: { createdAt: { lt: timestamp } }
      });
      
      await prisma.contentPost.deleteMany({
        where: { createdAt: { lt: timestamp } }
      });
      
      await prisma.user.deleteMany({
        where: { createdAt: { lt: timestamp } }
      });
    }
    
    // NOT: Taxonomy (categories, badges, themes, comparison metrics) ve products korunur
    // çünkü bunlar test verilerinden bağımsızdır ve test verileri silindiğinde de korunması gerekir
    
    console.log('✅ Seed verileri temizlendi (taxonomy ve products korundu)');
  } catch (error) {
    console.error('❌ Seed verileri temizlenirken hata oluştu:', error);
    throw error;
  }
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

