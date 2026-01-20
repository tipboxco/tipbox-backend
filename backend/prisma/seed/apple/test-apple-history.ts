import { seedAppleHistory } from './apple-history.seed';
import { seedAppleBrand } from './apple-brand.seed';
import { seedAppleEvents } from './apple-events.seed';
import { prisma } from '../types';

async function testAppleHistory() {
  console.log('🧪 Testing Apple History Seed...\n');

  try {
    // Önce brand ve event'i oluştur
    const brandResult = await seedAppleBrand();
    console.log(`✅ Brand ID: ${brandResult.brandId}\n`);

    const eventResult = await seedAppleEvents(brandResult.brandId);
    console.log(`✅ Event ID: ${eventResult.eventId}\n`);

    // History seed'i çalıştır
    const result = await seedAppleHistory(brandResult.brandId, eventResult.eventId);
    console.log('\n✅ History seed başarılı!\n');

    // DB'den kontrol et
    console.log('📊 DB Kontrolü:\n');

    // BridgeUserStats
    const userStats = await prisma.bridgeUserStats.findMany({
      where: { brandId: brandResult.brandId },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      take: 5,
    });

    console.log('👤 BridgeUserStats Örnekleri:');
    userStats.forEach((stat) => {
      const userName = stat.user.profile?.userName || stat.user.profile?.displayName || 'Unknown';
      console.log(`   ${userName}: ${stat.commentsCount} comments, ${stat.surveysParticipated} surveys, trust score: ${stat.trustScore.toFixed(2)}`);
    });

    // RewardClaims
    const rewardClaims = await prisma.rewardClaim.findMany({
      where: {
        userId: { in: userStats.map((s) => s.userId) },
      },
      include: {
        user: {
          include: {
          profile: true,
        },
      },
      },
      take: 10,
      orderBy: {
        earnedAt: 'desc',
      },
    });

    console.log('\n🎁 RewardClaims Örnekleri:');
    rewardClaims.forEach((claim) => {
      const userName = claim.user.profile?.userName || claim.user.profile?.displayName || 'Unknown';
      console.log(`   ${userName}: ${claim.rewardType} - ${claim.amount} TIPS (${claim.status})`);
      if (claim.metadata && typeof claim.metadata === 'object') {
        const meta = claim.metadata as any;
        console.log(`      Source: ${meta.description || 'N/A'}`);
      }
    });

    // BridgeRewards
    const bridgeRewards = await prisma.bridgeReward.findMany({
      where: { brandId: brandResult.brandId },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        badge: true,
      },
      take: 5,
    });

    console.log('\n🏆 BridgeRewards Örnekleri:');
    bridgeRewards.forEach((reward) => {
      const userName = reward.user.profile?.userName || reward.user.profile?.displayName || 'Unknown';
      console.log(`   ${userName}: ${reward.badge.name} (${reward.badge.rarity})`);
    });

    // WishboxStats
    const eventStats = await prisma.wishboxStats.findMany({
      where: { eventId: eventResult.eventId },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      take: 5,
    });

    console.log('\n📊 Event Stats Örnekleri:');
    eventStats.forEach((stat) => {
      const userName = stat.user.profile?.userName || stat.user.profile?.displayName || 'Unknown';
      console.log(`   ${userName}: ${stat.totalParticipated} participated, ${stat.totalComments} comments, ${stat.helpfulVotesReceived} likes`);
    });

    // İstatistikler
    const totalUserStats = await prisma.bridgeUserStats.count({
      where: { brandId: brandResult.brandId },
    });

    const totalRewardClaims = await prisma.rewardClaim.count({
      where: {
        userId: { in: userStats.map((s) => s.userId) },
      },
    });

    const totalBridgeRewards = await prisma.bridgeReward.count({
      where: { brandId: brandResult.brandId },
    });

    const totalEventStats = await prisma.wishboxStats.count({
      where: { eventId: eventResult.eventId },
    });

    console.log('\n📈 Toplam İstatistikler:');
    console.log(`   BridgeUserStats: ${totalUserStats}`);
    console.log(`   RewardClaims: ${totalRewardClaims}`);
    console.log(`   BridgeRewards: ${totalBridgeRewards}`);
    console.log(`   WishboxStats: ${totalEventStats}`);

    console.log('\n✅ Tüm kontroller başarılı!\n');
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testAppleHistory();
