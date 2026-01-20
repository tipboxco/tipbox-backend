import { prisma, TEST_USER_ID, TRUST_USER_IDS, TRUSTER_USER_IDS } from '../types';
import { randomUUID } from 'crypto';
import { RewardClaimType, RewardSourceType, RewardClaimStatus } from '@prisma/client';
import { getAuthToken, makeAuthenticatedRequest, getUserTokens, getUserEmails } from './helpers/api-client.helper';

/**
 * Apple brand history verileri oluştur
 * - Event join: Endpoint üzerinden (POST /events/{eventId}/join)
 * - Survey answer: Prisma ile (endpoint yok)
 * - BridgeUserStats: Prisma ile (okuma ve hesaplama)
 * - RewardClaim: Prisma ile (endpoint yok)
 * - BridgeReward: Prisma ile (endpoint yok)
 * - WishboxStats: Prisma ile (okuma ve hesaplama)
 */
export async function seedAppleHistory(
  brandId: string,
  eventId: string,
  challengeBadges: Array<{ badgeId: string; name: string; threshold: number }>,
  surveyIds: string[]
): Promise<{
  userStats: number;
  rewardClaims: number;
  bridgeRewards: number;
  eventStats: number;
}> {
  console.log('📜 [seed] Apple brand history (Endpoint-Based where possible)');

  // Apple brand'ı bul
  const appleBrand = await prisma.brand.findUnique({
    where: { id: brandId },
  });

  if (!appleBrand) {
    throw new Error('Apple brand not found. Please run apple-brand seed first.');
  }

  // Event'i bul
  const event = await prisma.wishboxEvent.findUnique({
    where: { id: eventId },
    include: {
      eventBadges: {
        include: {
          badge: true,
        },
      },
    },
  });

  if (!event) {
    throw new Error('Event not found. Please run apple-events seed first.');
  }

  // Gerçek kullanıcı email'lerini al
  const users = getUserEmails();

  // Tüm kullanıcılar için token'ları al
  const tokenMap = await getUserTokens(users);

  if (tokenMap.size === 0) {
    throw new Error('No auth tokens obtained. Please check user credentials.');
  }

  // Ömer kullanıcısını öncelikli olarak al
  const omerToken = tokenMap.get(TEST_USER_ID);
  if (!omerToken) {
    throw new Error('Ömer kullanıcısı için token alınamadı!');
  }

  let userStatsCount = 0;
  let rewardClaimsCount = 0;
  let bridgeRewardsCount = 0;
  let eventStatsCount = 0;

  // Her kullanıcı için history verileri oluştur
  for (const [userId, authResult] of tokenMap.entries()) {
    const user = users.find(u => u.id === userId);
    if (!user) continue;

    const token = authResult.token;
    const isOmer = userId === TEST_USER_ID;

    console.log(`  👤 ${user.email} için history oluşturuluyor...`);

    // 1. EVENT JOIN - Endpoint üzerinden
    try {
      const joinResult = await makeAuthenticatedRequest(
        'POST',
        `/events/${eventId}/join`,
        token
      );
      if (joinResult) {
        console.log(`    ✅ Event'e katıldı`);
      }
    } catch (error) {
      // Zaten katılmış olabilir, hata yoksay
    }

    // 2. SURVEY ANSWERS - Prisma ile (endpoint yok)
    // Ömer için tüm survey'lere cevap ver, diğerleri için rastgele
    const surveysToAnswer = isOmer 
      ? surveyIds 
      : surveyIds.filter(() => Math.random() > 0.4); // %60 ihtimalle cevap ver

    for (const surveyId of surveysToAnswer) {
      const survey = await prisma.brandSurvey.findUnique({
        where: { id: surveyId },
        include: {
          questions: true,
        },
      });

      if (!survey) continue;

      // Her soruya cevap ver
      for (const question of survey.questions) {
        let answerText: string;

        if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
          // Basit bir cevap oluştur (gerçek uygulamada options tablosu olurdu)
          answerText = 'Option 1';
        } else {
          // TEXT tipi için örnek cevap
          const sampleTexts = [
            'Excellent performance, highly recommend.',
            'Good overall, but some features need work.',
            'Love the design and user experience.',
            'Needs better battery optimization.',
            'Very satisfied with the camera.',
          ];
          answerText = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
        }

        try {
          await prisma.brandSurveyAnswer.create({
            data: {
              id: randomUUID(),
              questionId: question.id,
              userId: userId,
              answerText: answerText,
            },
          });
        } catch (e) {
          // Zaten cevaplanmış olabilir
        }
      }
    }

    // 3. BRIDGEUSERSTATS - Prisma ile (okuma ve hesaplama)
    const userPosts = await prisma.contentPost.count({
      where: {
        userId: userId,
        product: {
          brandId: appleBrand.externalId, // Product.brandId Brand.externalId'ye referans veriyor
        },
      },
    });

    const userComments = await prisma.contentComment.count({
      where: {
        userId: userId,
        post: {
          product: {
            brandId: appleBrand.externalId, // Product.brandId Brand.externalId'ye referans veriyor
          },
        },
      },
    });

    // Kullanıcının katıldığı survey sayısını hesapla
    const userSurveyAnswers = await prisma.brandSurveyAnswer.findMany({
      where: {
        userId: userId,
        question: {
          survey: {
            brandId: brandId,
          },
        },
      },
      select: {
        questionId: true,
        question: {
          select: {
            surveyId: true,
          },
        },
      },
    });

    // Farklı survey ID'lerini say
    const uniqueSurveyIds = new Set(userSurveyAnswers.map((a) => a.question.surveyId));
    const userSurveys = uniqueSurveyIds.size;

    const existingStats = await prisma.bridgeUserStats.findUnique({
      where: {
        userId_brandId: {
          userId: userId,
          brandId: brandId,
        },
      },
    });

    if (!existingStats) {
      await prisma.bridgeUserStats.create({
        data: {
          id: randomUUID(),
          userId: userId,
          brandId: brandId,
          commentsCount: userComments,
          surveysParticipated: userSurveys,
          trustScore: isOmer ? 95 : Math.floor(Math.random() * 50) + 50, // Ömer için yüksek skor
          lastInteractionAt: new Date(),
        },
      });
      userStatsCount++;
    } else {
      await prisma.bridgeUserStats.update({
        where: {
          userId_brandId: {
            userId: userId,
            brandId: brandId,
          },
        },
        data: {
          commentsCount: userComments,
          surveysParticipated: userSurveys,
          trustScore: isOmer ? 95 : Math.max(existingStats.trustScore, Math.floor(Math.random() * 50) + 50),
          lastInteractionAt: new Date(),
        },
      });
    }

    // 4. REWARDCLAIMS - Prisma ile (endpoint yok)
    // Ömer için daha fazla reward claim
    const rewardClaimConfigs = isOmer
      ? [
          {
            type: RewardClaimType.LADDER,
            sourceType: RewardSourceType.LADDER_REWARD,
            amount: 50,
            metadata: {
              rank: 1,
              period: 'weekly',
              description: 'Weekly leaderboard reward - 1st place',
            },
          },
          {
            type: RewardClaimType.LADDER,
            sourceType: RewardSourceType.LADDER_REWARD,
            amount: 40,
            metadata: {
              rank: 2,
              period: 'monthly',
              description: 'Monthly leaderboard reward - 2nd place',
            },
          },
          {
            type: RewardClaimType.EVENT,
            sourceType: RewardSourceType.EVENT_PARTICIPATION,
            amount: 30,
            metadata: {
              eventId: eventId,
              eventTitle: event.title,
              description: 'Event participation reward',
            },
          },
          {
            type: RewardClaimType.TIPS,
            sourceType: RewardSourceType.TIPS_RECEIVED,
            amount: 25,
            metadata: {
              description: 'Tips received from community',
            },
          },
        ]
      : [
          {
            type: RewardClaimType.LADDER,
            sourceType: RewardSourceType.LADDER_REWARD,
            amount: 20,
            metadata: {
              rank: Math.floor(Math.random() * 10) + 1,
              period: 'weekly',
              description: 'Weekly leaderboard reward',
            },
          },
          {
            type: RewardClaimType.EVENT,
            sourceType: RewardSourceType.EVENT_PARTICIPATION,
            amount: 15,
            metadata: {
              eventId: eventId,
              eventTitle: event.title,
              description: 'Event participation reward',
            },
          },
        ];

    for (const config of rewardClaimConfigs) {
      const existingClaim = await prisma.rewardClaim.findFirst({
        where: {
          userId: userId,
          rewardType: config.type,
          sourceType: config.sourceType,
        },
      });

      if (!existingClaim) {
        await prisma.rewardClaim.create({
          data: {
            id: randomUUID(),
            userId: userId,
            rewardType: config.type,
            sourceType: config.sourceType,
            amount: config.amount,
            status: isOmer ? RewardClaimStatus.CLAIMED : (Math.random() > 0.5 ? RewardClaimStatus.PENDING : RewardClaimStatus.CLAIMED),
            metadata: config.metadata as any,
            earnedAt: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000),
            sourceId: null, // eventId VarChar(26) formatında, UUID değil
          },
        });
        rewardClaimsCount++;
      }
    }

    // 5. BRIDGEREWARDS (Badges) - Prisma ile (endpoint yok)
    // Ömer için daha fazla badge
    const badgesToAward = isOmer
      ? challengeBadges // Ömer için tüm badge'ler
      : challengeBadges
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.floor(Math.random() * 3) + 1); // 1-3 badge

    for (const challenge of badgesToAward) {
      const existingReward = await prisma.bridgeReward.findFirst({
        where: {
          userId: userId,
          brandId: brandId,
          badgeId: challenge.badgeId,
        },
      });

      if (!existingReward) {
        await prisma.bridgeReward.create({
          data: {
            id: randomUUID(),
            userId: userId,
            brandId: brandId,
            badgeId: challenge.badgeId,
            awardedAt: new Date(Date.now() - Math.floor(Math.random() * 5) * 24 * 60 * 60 * 1000),
          },
        });
        bridgeRewardsCount++;
      }
    }

    // 6. WISHBOXSTATS (Event Participation) - Prisma ile (okuma ve hesaplama)
    // Ömer için gerçek veriler, diğerleri için hesaplanmış değerler
    const existingEventStats = await prisma.wishboxStats.findUnique({
      where: {
        userId_eventId: {
          userId: userId,
          eventId: eventId,
        },
      },
    });

    // Kullanıcının event'teki aktivitelerini hesapla
    const eventPosts = await prisma.contentPost.count({
      where: {
        userId: userId,
        eventId: eventId,
      },
    });

    const eventComments = await prisma.contentComment.count({
      where: {
        userId: userId,
        post: {
          eventId: eventId,
        },
      },
    });

    // Kullanıcının event post'larına gelen like'ları say
    const userEventPostIds = await prisma.contentPost.findMany({
      where: {
        userId: userId,
        eventId: eventId,
      },
      select: { id: true },
    });

    const eventLikesReceived = await prisma.contentLike.count({
      where: {
        postId: {
          in: userEventPostIds.map(p => p.id),
        },
      },
    });

    // Ömer için daha fazla aktivite göster
    const finalEventPosts = isOmer ? Math.max(eventPosts, 5) : eventPosts;
    const finalEventComments = isOmer ? Math.max(eventComments, 12) : eventComments;
    const finalEventLikesReceived = isOmer ? Math.max(eventLikesReceived, 25) : eventLikesReceived;

    if (!existingEventStats) {
      await prisma.wishboxStats.create({
        data: {
          id: randomUUID(),
          userId: userId,
          eventId: eventId,
          totalParticipated: finalEventPosts + finalEventComments,
          totalComments: finalEventComments,
          helpfulVotesReceived: finalEventLikesReceived,
          eventPostsCount: finalEventPosts,
          eventLikesReceived: finalEventLikesReceived,
        },
      });
      eventStatsCount++;
    } else {
      await prisma.wishboxStats.update({
        where: {
          userId_eventId: {
            userId: userId,
            eventId: eventId,
          },
        },
        data: {
          totalParticipated: finalEventPosts + finalEventComments,
          totalComments: finalEventComments,
          helpfulVotesReceived: finalEventLikesReceived,
          eventPostsCount: finalEventPosts,
          eventLikesReceived: finalEventLikesReceived,
        },
      });
    }
  }

  console.log(`\n✅ History verileri oluşturuldu:`);
  console.log(`   BridgeUserStats: ${userStatsCount}`);
  console.log(`   RewardClaims: ${rewardClaimsCount}`);
  console.log(`   BridgeRewards: ${bridgeRewardsCount}`);
  console.log(`   WishboxStats: ${eventStatsCount}`);

  return {
    userStats: userStatsCount,
    rewardClaims: rewardClaimsCount,
    bridgeRewards: bridgeRewardsCount,
    eventStats: eventStatsCount,
  };
}
