import { prisma, TEST_USER_ID, TARGET_USER_ID, TRUST_USER_IDS, TRUSTER_USER_IDS } from './types';

/**
 * Test verilerini kaldırır (sadece test kullanıcıları ve onların verileri)
 * 
 * ÖNEMLİ: Bu fonksiyon sadece test kullanıcılarını (TEST_USER_ID, TARGET_USER_ID, TRUST_USER_IDS, TRUSTER_USER_IDS) 
 * ve onların verilerini siler. Aşağıdaki seed verileri KORUNUR:
 * - Taxonomy (categories, badges, themes, comparison metrics)
 * - Products ve product groups
 * - Brands (eğer test kullanıcıları tarafından oluşturulmadıysa)
 * - Marketplace banners
 * - Diğer seed verileri
 * 
 * Bu sayede test verileri silindiğinde, seed verileri (taxonomy, products, vb.) hala veritabanında kalır
 * ve yeni testler için kullanılabilir.
 */
export async function clearTestData(): Promise<void> {
  console.log('🗑️  Test verileri temizleniyor...');

  const testUserIds = [TEST_USER_ID, TARGET_USER_ID, ...TRUST_USER_IDS, ...TRUSTER_USER_IDS];

  try {
    // Test kullanıcılarının tüm ilişkili verilerini sil
    
    // Feed ve trending verileri
    await prisma.feed.deleteMany({
      where: { userId: { in: testUserIds } }
    });
    await prisma.trendingPost.deleteMany({
      where: { post: { userId: { in: testUserIds } } }
    });

    // Content verileri
    await prisma.contentFavorite.deleteMany({
      where: { 
        OR: [
          { userId: { in: testUserIds } },
          { post: { userId: { in: testUserIds } } }
        ]
      }
    });
    await prisma.contentLike.deleteMany({
      where: { 
        OR: [
          { userId: { in: testUserIds } },
          { post: { userId: { in: testUserIds } } }
        ]
      }
    });
    await prisma.contentComment.deleteMany({
      where: { 
        OR: [
          { userId: { in: testUserIds } },
          { post: { userId: { in: testUserIds } } }
        ]
      }
    });
    await prisma.contentPostView.deleteMany({
      where: { 
        OR: [
          { userId: { in: testUserIds } },
          { post: { userId: { in: testUserIds } } }
        ]
      }
    });
    await prisma.contentPost.deleteMany({
      where: { userId: { in: testUserIds } }
    });

    // Marketplace verileri
    await prisma.nFTMarketListing.deleteMany({
      where: { listedByUserId: { in: testUserIds } }
    });
    await prisma.nFT.deleteMany({
      where: { currentOwnerId: { in: testUserIds } }
    });

    // Explore verileri
    await prisma.wishboxStats.deleteMany({
      where: { userId: { in: testUserIds } }
    });
    await prisma.bridgeFollower.deleteMany({
      where: { 
        OR: [
          { userId: { in: testUserIds } },
          { brandId: { in: testUserIds } } // Eğer brand userId kullanıyorsa
        ]
      }
    });
    await prisma.bridgePost.deleteMany({
      where: { userId: { in: testUserIds } }
    });

    // Inventory verileri
    await prisma.inventoryMedia.deleteMany({
      where: { inventory: { userId: { in: testUserIds } } }
    });
    await prisma.productExperience.deleteMany({
      where: { inventory: { userId: { in: testUserIds } } }
    });
    await prisma.inventory.deleteMany({
      where: { userId: { in: testUserIds } }
    });

    // User related verileri
    await prisma.userCollection.deleteMany({
      where: { userId: { in: testUserIds } }
    });
    await prisma.userTitle.deleteMany({
      where: { userId: { in: testUserIds } }
    });
    await prisma.userBadge.deleteMany({
      where: { userId: { in: testUserIds } }
    });
    await prisma.userAchievement.deleteMany({
      where: { userId: { in: testUserIds } }
    });
    await prisma.userAvatar.deleteMany({
      where: { userId: { in: testUserIds } }
    });
    await prisma.userMute.deleteMany({
      where: { 
        OR: [
          { muterId: { in: testUserIds } },
          { mutedUserId: { in: testUserIds } }
        ]
      }
    });
    await prisma.userBlock.deleteMany({
      where: { 
        OR: [
          { blockerId: { in: testUserIds } },
          { blockedUserId: { in: testUserIds } }
        ]
      }
    });
    await prisma.trustRelation.deleteMany({
      where: { 
        OR: [
          { trusterId: { in: testUserIds } },
          { trustedUserId: { in: testUserIds } }
        ]
      }
    });
    await prisma.userTrustScore.deleteMany({
      where: { userId: { in: testUserIds } }
    });
    await prisma.userRole.deleteMany({
      where: { userId: { in: testUserIds } }
    });
    await prisma.userFeedPreferences.deleteMany({
      where: { userId: { in: testUserIds } }
    });
    await prisma.userSettings.deleteMany({
      where: { userId: { in: testUserIds } }
    });
    await prisma.profile.deleteMany({
      where: { userId: { in: testUserIds } }
    });

    // Expert verileri
    // Önce test kullanıcılarına ait request'leri bul
    const testUserRequests = await prisma.expertRequest.findMany({
      where: { userId: { in: testUserIds } },
      select: { id: true }
    });
    const testUserRequestIds = testUserRequests.map(r => r.id);
    
    // ExpertAnswer'ları sil (expertUserId veya requestId ile)
    await prisma.expertAnswer.deleteMany({
      where: { 
        OR: [
          { expertUserId: { in: testUserIds } },
          ...(testUserRequestIds.length > 0 ? [{ requestId: { in: testUserRequestIds } }] : [])
        ]
      }
    });
    
    // ExpertRequestMedia'yı sil
    if (testUserRequestIds.length > 0) {
      await prisma.expertRequestMedia.deleteMany({
        where: { requestId: { in: testUserRequestIds } }
      });
    }
    
    // ExpertRequest'leri sil
    await prisma.expertRequest.deleteMany({
      where: { userId: { in: testUserIds } }
    });

    // Messaging verileri
    await prisma.dMSupportSession.deleteMany({
      where: { 
        OR: [
          { helperId: { in: testUserIds } },
          { thread: { 
            OR: [
              { userOneId: { in: testUserIds } },
              { userTwoId: { in: testUserIds } }
            ]
          }}
        ]
      }
    });
    await prisma.dMMessage.deleteMany({
      where: { 
        OR: [
          { senderId: { in: testUserIds } },
          { thread: { 
            OR: [
              { userOneId: { in: testUserIds } },
              { userTwoId: { in: testUserIds } }
            ]
          }}
        ]
      }
    });
    await prisma.dMRequest.deleteMany({
      where: { 
        OR: [
          { fromUserId: { in: testUserIds } },
          { toUserId: { in: testUserIds } }
        ]
      }
    });
    await prisma.dMThread.deleteMany({
      where: { 
        OR: [
          { userOneId: { in: testUserIds } },
          { userTwoId: { in: testUserIds } }
        ]
      }
    });

    // Crypto verileri
    await prisma.tipsTokenTransfer.deleteMany({
      where: { 
        OR: [
          { fromUserId: { in: testUserIds } },
          { toUserId: { in: testUserIds } }
        ]
      }
    });
    await prisma.lootbox.deleteMany({
      where: { userId: { in: testUserIds } }
    });
    await prisma.wallet.deleteMany({
      where: { userId: { in: testUserIds } }
    });

    // Auth verileri
    await prisma.passwordResetToken.deleteMany({
      where: { userId: { in: testUserIds } }
    });
    await prisma.emailVerificationCode.deleteMany({
      where: { userId: { in: testUserIds } }
    });
    await prisma.loginAttempt.deleteMany({
      where: { userId: { in: testUserIds } }
    });

    // User'ları sil (en son)
    await prisma.user.deleteMany({
      where: { id: { in: testUserIds } }
    });

    console.log('✅ Test verileri temizlendi');
  } catch (error) {
    console.error('❌ Test verileri temizlenirken hata oluştu:', error);
    throw error;
  }
}

if (require.main === module) {
  clearTestData()
    .catch((e) => {
      console.error('❌ Clear test data failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

