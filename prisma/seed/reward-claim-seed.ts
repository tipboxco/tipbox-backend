import { PrismaClient, RewardClaimType, RewardSourceType, RewardClaimStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function seedRewardClaims() {
  console.log('🎁 Seeding Reward Claims...');

  try {
    // Öncelikle belirtilen kullanıcıları al
    const priorityUsernames = ['burakcan', 'omer', 'tuna', 'mihrac', 'furkan'];
    
    const priorityUsers = await prisma.user.findMany({
      where: {
        profile: {
          userName: {
            in: priorityUsernames,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    // Diğer kullanıcıları da al
    const otherUsers = await prisma.user.findMany({
      take: 10,
      where: {
        profile: {
          userName: {
            notIn: priorityUsernames,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    const users = [...priorityUsers, ...otherUsers];

    if (users.length === 0) {
      console.log('⚠️  No users found. Please run user seed first.');
      return;
    }

    console.log(`Found ${users.length} users for reward claim seeding`);
    console.log(`Priority users: ${priorityUsers.map(u => u.profile?.userName).join(', ')}`);

    // Her kullanıcı için reward claim'ler oluştur
    for (const user of users) {
      const displayName = user.profile?.displayName || user.profile?.userName || user.email;
      console.log(`Creating reward claims for user: ${displayName}`);

      // 1. Ladder Reward - Sıralama ödülü
      await prisma.rewardClaim.create({
        data: {
          userId: user.id,
          rewardType: RewardClaimType.LADDER,
          sourceType: RewardSourceType.LADDER_REWARD,
          amount: 20,
          status: RewardClaimStatus.PENDING,
          metadata: {
            rank: 3,
            period: 'weekly',
            description: 'Haftalık sıralamada 3. oldunuz',
          },
          earnedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 gün önce
        },
      });

      // 2. Tips Received - Gelen tips'ler
      await prisma.rewardClaim.create({
        data: {
          userId: user.id,
          rewardType: RewardClaimType.TIPS,
          sourceType: RewardSourceType.TIPS_RECEIVED,
          amount: 35,
          status: RewardClaimStatus.PENDING,
          metadata: {
            fromUserId: users[0]?.id,
            fromUserName: 'Mehmet Koç',
            description: 'Tips gönderdi',
          },
          earnedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 gün önce
        },
      });

      // 3. Support Session - Destek verme ödülü
      await prisma.rewardClaim.create({
        data: {
          userId: user.id,
          rewardType: RewardClaimType.SUPPORT,
          sourceType: RewardSourceType.SUPPORT_SESSION,
          amount: 35,
          status: RewardClaimStatus.PENDING,
          metadata: {
            supportedUserId: users[1]?.id,
            supportedUserName: 'Ömer Faruk Demiral',
            description: 'Destek verdiniz',
          },
          earnedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 gün önce
        },
      });

      // 4. Daha fazla Tips Received reward'ları
      for (let i = 0; i < 7; i++) {
        await prisma.rewardClaim.create({
          data: {
            userId: user.id,
            rewardType: RewardClaimType.TIPS,
            sourceType: RewardSourceType.TIPS_RECEIVED,
            amount: 35,
            status: RewardClaimStatus.PENDING,
            metadata: {
              fromUserId: users[(i + 1) % users.length]?.id,
              fromUserName: 'Mehmet Koç',
              description: 'Tips gönderdi',
            },
            earnedAt: new Date(Date.now() - (i + 4) * 24 * 60 * 60 * 1000),
          },
        });
      }

      // 5. Bazı claimed reward'lar (history için)
      await prisma.rewardClaim.create({
        data: {
          userId: user.id,
          rewardType: RewardClaimType.TIPS,
          sourceType: RewardSourceType.TIPS_RECEIVED,
          amount: 50,
          status: RewardClaimStatus.CLAIMED,
          claimedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          metadata: {
            fromUserId: users[2]?.id,
            fromUserName: 'Ali Veli',
            description: 'Tips gönderdi',
          },
          earnedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        },
      });

      // 6. Badge Reward
      await prisma.rewardClaim.create({
        data: {
          userId: user.id,
          rewardType: RewardClaimType.BADGE,
          sourceType: RewardSourceType.BADGE_EARNED,
          amount: 100,
          status: RewardClaimStatus.PENDING,
          metadata: {
            badgeName: 'İlk Post Badge',
            description: 'İlk postunuzu paylaştınız',
          },
          earnedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      });

      // 7. Achievement Reward
      await prisma.rewardClaim.create({
        data: {
          userId: user.id,
          rewardType: RewardClaimType.ACHIEVEMENT,
          sourceType: RewardSourceType.ACHIEVEMENT_UNLOCKED,
          amount: 75,
          status: RewardClaimStatus.PENDING,
          metadata: {
            achievementName: '10 Post Paylaşma',
            description: '10 post paylaştınız',
          },
          earnedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
      });

      // 8. Event Reward
      await prisma.rewardClaim.create({
        data: {
          userId: user.id,
          rewardType: RewardClaimType.EVENT,
          sourceType: RewardSourceType.EVENT_PARTICIPATION,
          amount: 150,
          status: RewardClaimStatus.PENDING,
          metadata: {
            eventName: 'Yılbaşı Etkinliği',
            description: 'Etkinliğe katıldınız',
          },
          earnedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      });

      // 9. Süresi dolmuş reward (expired)
      await prisma.rewardClaim.create({
        data: {
          userId: user.id,
          rewardType: RewardClaimType.TIPS,
          sourceType: RewardSourceType.TIPS_RECEIVED,
          amount: 25,
          status: RewardClaimStatus.EXPIRED,
          expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          metadata: {
            description: 'Süresi doldu',
          },
          earnedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
      });
    }

    // İstatistikleri göster
    const totalClaims = await prisma.rewardClaim.count();
    const pendingClaims = await prisma.rewardClaim.count({
      where: { status: RewardClaimStatus.PENDING },
    });
    const claimedClaims = await prisma.rewardClaim.count({
      where: { status: RewardClaimStatus.CLAIMED },
    });
    const expiredClaims = await prisma.rewardClaim.count({
      where: { status: RewardClaimStatus.EXPIRED },
    });

    console.log(`\n✅ Reward Claims seeded successfully!`);
    console.log(`📊 Statistics:`);
    console.log(`   - Total Claims: ${totalClaims}`);
    console.log(`   - Pending Claims: ${pendingClaims}`);
    console.log(`   - Claimed Claims: ${claimedClaims}`);
    console.log(`   - Expired Claims: ${expiredClaims}`);

    // Her kullanıcı için toplam claimable amount
    for (const user of users) {
      const claimableAmount = await prisma.rewardClaim.aggregate({
        where: {
          userId: user.id,
          status: RewardClaimStatus.PENDING,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        _sum: {
          amount: true,
        },
      });

      const displayName = user.profile?.displayName || user.profile?.userName || user.email;
      console.log(`   - ${displayName}: ${claimableAmount._sum.amount || 0} TIPS claimable`);
    }
  } catch (error) {
    console.error('❌ Error seeding reward claims:', error);
    throw error;
  }
}

// Ana fonksiyon
async function main() {
  console.log('🌱 Starting Reward Claim Seed...\n');

  try {
    await seedRewardClaims();
    console.log('\n✨ Reward Claim Seeding completed!\n');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Script çalıştırıldığında
if (require.main === module) {
  main();
}

export { seedRewardClaims };
