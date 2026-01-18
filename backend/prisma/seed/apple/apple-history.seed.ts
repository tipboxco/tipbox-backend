import { prisma, TRUST_USER_IDS } from '../types';
import { randomUUID } from 'crypto';
import { RewardClaimType, RewardSourceType, RewardClaimStatus } from '@prisma/client';

/**
 * Apple brand history verileri oluştur
 * - BridgeUserStats
 * - RewardClaim (4 farklı tip: LADDER, SURVEY, EVENT, TIPS)
 * - BridgeReward (badge kazanımları)
 * - WishboxStats (event participation)
 */
export async function seedAppleHistory(brandId: string, eventId: string): Promise<{
  userStats: number;
  rewardClaims: number;
  bridgeRewards: number;
  eventStats: number;
}> {
  console.log('📜 [seed] Apple brand history');

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

  // Kullanıcıları al
  const allUsers = await prisma.user.findMany({
    take: 20, // İlk 20 kullanıcı
  });

  if (allUsers.length === 0) {
    throw new Error('No users found. Please run user seed first.');
  }

  let userStatsCount = 0;
  let rewardClaimsCount = 0;
  let bridgeRewardsCount = 0;
  let eventStatsCount = 0;

  // Her kullanıcı için history verileri oluştur
  for (const user of allUsers) {
    // BridgeUserStats oluştur
    const userPosts = await prisma.contentPost.count({
      where: {
        userId: user.id,
        product: {
          brandId: appleBrand.externalId,
        },
      },
    });

    const userComments = await prisma.contentComment.count({
      where: {
        userId: user.id,
        post: {
          product: {
            brandId: appleBrand.externalId,
          },
        },
      },
    });

    // Kullanıcının katıldığı survey sayısını hesapla
    const userSurveyAnswers = await prisma.brandSurveyAnswer.findMany({
      where: {
        userId: user.id,
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
          userId: user.id,
          brandId: brandId,
        },
      },
    });

    if (!existingStats) {
      await prisma.bridgeUserStats.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          brandId: brandId,
          commentsCount: userComments,
          surveysParticipated: Math.floor(userSurveys / 4), // Her survey'de 4 soru var
          trustScore: Math.random() * 50 + 50, // 50-100 arası
          lastInteractionAt: new Date(),
        },
      });
      userStatsCount++;
    } else {
      await prisma.bridgeUserStats.update({
        where: {
          userId_brandId: {
            userId: user.id,
            brandId: brandId,
          },
        },
        data: {
          commentsCount: userComments,
          surveysParticipated: Math.floor(userSurveys / 4),
          lastInteractionAt: new Date(),
        },
      });
    }

    // RewardClaim oluştur (4 farklı tip)
    const rewardClaimConfigs = [
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
        type: RewardClaimType.EVENT, // SURVEY type yok, EVENT kullanıyoruz
        sourceType: RewardSourceType.EVENT_PARTICIPATION,
        amount: 15,
        metadata: {
          surveyId: 'survey-1',
          surveyTitle: 'iPhone User Experience Survey 2024',
          description: 'Survey completion reward',
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
          fromUserId: allUsers[0]?.id,
          description: 'Tips received from community',
        },
      },
    ];

    for (const config of rewardClaimConfigs) {
      // sourceId UUID formatında olmalı, eventId VarChar(26) olduğu için null kullanıyoruz
      const existingClaim = await prisma.rewardClaim.findFirst({
        where: {
          userId: user.id,
          rewardType: config.type,
          sourceType: config.sourceType,
        },
      });

      if (!existingClaim) {
        await prisma.rewardClaim.create({
          data: {
            id: randomUUID(),
            userId: user.id,
            rewardType: config.type,
            sourceType: config.sourceType,
            amount: config.amount,
            status: Math.random() > 0.5 ? RewardClaimStatus.PENDING : RewardClaimStatus.CLAIMED,
            metadata: config.metadata as any,
            earnedAt: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000),
            sourceId: null, // eventId VarChar(26) formatında, UUID değil
          },
        });
        rewardClaimsCount++;
      }
    }

    // BridgeReward oluştur (badge kazanımları)
    // Event badge'lerinden bazılarını kullanıcılara ver
    if (event.eventBadges.length > 0) {
      const badgesToAward = event.eventBadges
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(Math.random() * 3) + 1); // 1-3 badge

      for (const eventBadge of badgesToAward) {
        const existingReward = await prisma.bridgeReward.findFirst({
          where: {
            userId: user.id,
            brandId: brandId,
            badgeId: eventBadge.badgeId,
          },
        });

        if (!existingReward) {
          await prisma.bridgeReward.create({
            data: {
              id: randomUUID(),
              userId: user.id,
              brandId: brandId,
              badgeId: eventBadge.badgeId,
              awardedAt: new Date(Date.now() - Math.floor(Math.random() * 5) * 24 * 60 * 60 * 1000),
            },
          });
          bridgeRewardsCount++;
        }
      }
    }

    // WishboxStats oluştur (event participation)
    const existingEventStats = await prisma.wishboxStats.findUnique({
      where: {
        userId_eventId: {
          userId: user.id,
          eventId: eventId,
        },
      },
    });

    if (!existingEventStats) {
      // Kullanıcının event'teki aktivitelerini hesapla
      const eventPosts = await prisma.contentPost.count({
        where: {
          userId: user.id,
          eventId: eventId,
        },
      });

      const eventComments = await prisma.contentComment.count({
        where: {
          userId: user.id,
          post: {
            eventId: eventId,
          },
        },
      });

      const eventLikes = await prisma.contentLike.count({
        where: {
          userId: user.id,
          post: {
            eventId: eventId,
          },
        },
      });

      await prisma.wishboxStats.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          eventId: eventId,
          totalParticipated: eventPosts + eventComments,
          totalComments: eventComments,
          helpfulVotesReceived: eventLikes,
        },
      });
      eventStatsCount++;
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
