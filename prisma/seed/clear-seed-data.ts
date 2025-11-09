import { prisma } from './types';
import { getLastSeedRunTime, clearSeedMetadata, getSeedUserIds } from './seed-metadata';

/**
 * Seed data ile test sonrası eklenen datayı ayırt etmek için iki yöntem kullanılır:
 * 1. Timestamp bazlı: Seed çalıştırıldığında timestamp kaydedilir, sadece o tarihten önceki veriler seed data olarak kabul edilir
 * 2. ID bazlı: Seed'de kullanılan belirli ID'ler (TEST_USER_ID, vb.) kaydedilir
 * 
 * Clear seed data çalıştırıldığında:
 * - Eğer seed metadata varsa: Sadece seed timestamp'inden önceki veriler silinir
 * - Eğer seed metadata yoksa: TÜM veriler silinir (eski davranış)
 */
export async function clearAllSeedData(): Promise<void> {
  console.log('🗑️  Seed verileri temizleniyor...');
  
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
 */
async function clearAllData(): Promise<void> {

  try {
    // Foreign key constraint'leri nedeniyle ters sırada silme
    // En son oluşturulan verilerden başla
    
    // Feed ve trending verileri
    await prisma.feed.deleteMany({});
    await prisma.trendingPost.deleteMany({});
    await prisma.feedHighlight.deleteMany({});

    // Content verileri
    await prisma.contentFavorite.deleteMany({});
    await prisma.contentLike.deleteMany({});
    await prisma.contentCommentVote.deleteMany({});
    await prisma.contentComment.deleteMany({});
    await prisma.contentPostView.deleteMany({});
    await prisma.contentRating.deleteMany({});
    await prisma.contentPostTag.deleteMany({});
    await prisma.postComparisonScore.deleteMany({});
    await prisma.postComparison.deleteMany({});
    await prisma.postTag.deleteMany({});
    await prisma.postTip.deleteMany({});
    await prisma.postQuestion.deleteMany({});
    await prisma.contentPost.deleteMany({});
    await prisma.contentCollection.deleteMany({});

    // Marketplace verileri
    await prisma.marketplaceBanner.deleteMany({});
    await prisma.nFTMarketListing.deleteMany({});
    await prisma.nFTTransaction.deleteMany({});
    await prisma.nFTClaim.deleteMany({});
    await prisma.nFTAttribute.deleteMany({});
    await prisma.nFT.deleteMany({});

    // Explore verileri
    await prisma.wishboxStats.deleteMany({});
    await prisma.wishboxReward.deleteMany({});
    await prisma.scenarioChoice.deleteMany({});
    await prisma.wishboxEvent.deleteMany({});
    await prisma.bridgeReward.deleteMany({});
    await prisma.bridgeUserStats.deleteMany({});
    await prisma.bridgeLeaderboard.deleteMany({});
    await prisma.bridgeFollower.deleteMany({});
    await prisma.bridgePost.deleteMany({});
    await prisma.brandSurveyAnswer.deleteMany({});
    await prisma.brandSurvey.deleteMany({});
    await prisma.brand.deleteMany({});

    // Inventory verileri
    await prisma.inventoryMedia.deleteMany({});
    await prisma.productExperience.deleteMany({});
    await prisma.inventory.deleteMany({});

    // User related verileri
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

    // Expert verileri
    await prisma.expertAnswer.deleteMany({});
    await prisma.expertRequestMedia.deleteMany({});
    await prisma.expertRequest.deleteMany({});

    // Messaging verileri
    await prisma.dMFeedback.deleteMany({});
    await prisma.dMSupportSession.deleteMany({});
    await prisma.dMMessage.deleteMany({});
    await prisma.dMRequest.deleteMany({});
    await prisma.dMThread.deleteMany({});

    // Gamification verileri
    await prisma.rewardClaim.deleteMany({});
    await prisma.achievementGoal.deleteMany({});
    await prisma.achievementChain.deleteMany({});
    await prisma.badge.deleteMany({});

    // Crypto verileri
    await prisma.tipsTokenTransfer.deleteMany({});
    await prisma.lootbox.deleteMany({});
    await prisma.wallet.deleteMany({});

    // Product verileri
    await prisma.productSuggestion.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.productGroup.deleteMany({});

    // Taxonomy verileri
    await prisma.subCategory.deleteMany({});
    await prisma.mainCategory.deleteMany({});
    await prisma.comparisonMetric.deleteMany({});
    await prisma.badgeCategory.deleteMany({});
    await prisma.userTheme.deleteMany({});

    // Admin verileri
    await prisma.manualReviewFlag.deleteMany({});
    await prisma.moderationAction.deleteMany({});
    await prisma.adminLog.deleteMany({});

    // Auth verileri
    await prisma.passwordResetToken.deleteMany({});
    await prisma.emailVerificationCode.deleteMany({});
    await prisma.loginAttempt.deleteMany({});

    // User'ları sil (en son)
    await prisma.user.deleteMany({});

    console.log('✅ Tüm seed verileri temizlendi');
  } catch (error) {
    console.error('❌ Seed verileri temizlenirken hata oluştu:', error);
    throw error;
  }
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
      await prisma.wishboxStats.deleteMany({
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
      
      await prisma.productExperience.deleteMany({
        where: { inventory: { userId: { in: seedUserIds } } }
      });
      
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
      
      // Explore bridge verileri - timestamp'e göre
      await prisma.wishboxReward.deleteMany({
        where: { createdAt: { lt: timestamp } }
      });
      
      await prisma.scenarioChoice.deleteMany({
        where: { createdAt: { lt: timestamp } }
      });
      
      await prisma.wishboxEvent.deleteMany({
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
  clearAllSeedData()
    .catch((e) => {
      console.error('❌ Clear seed data failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

