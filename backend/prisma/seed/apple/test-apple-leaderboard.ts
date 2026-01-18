import { seedAppleLeaderboard } from './apple-leaderboard.seed';
import { seedAppleBrand } from './apple-brand.seed';
import { prisma } from '../types';

async function testAppleLeaderboard() {
  console.log('🧪 Testing Apple Leaderboard Seed...\n');

  try {
    // Önce brand'ı oluştur
    const brandResult = await seedAppleBrand();
    console.log(`✅ Brand ID: ${brandResult.brandId}\n`);

    // Leaderboard seed'i çalıştır
    const result = await seedAppleLeaderboard(brandResult.brandId);
    console.log('\n✅ Leaderboard seed başarılı!\n');

    // DB'den kontrol et
    console.log('📊 DB Kontrolü:\n');

    // WEEKLY leaderboard
    const weeklyLeaderboard = await prisma.bridgeLeaderboard.findMany({
      where: {
        brandId: brandResult.brandId,
        period: 'WEEKLY',
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: {
        rank: 'asc',
      },
      take: 10,
    });

    console.log('📈 WEEKLY Leaderboard (Top 10):');
    weeklyLeaderboard.forEach((entry, index) => {
      const userName = entry.user.profile?.userName || entry.user.profile?.displayName || 'Unknown';
      console.log(`   ${entry.rank}. ${userName} - Score: ${entry.score.toFixed(2)}`);
    });

    // MONTHLY leaderboard
    const monthlyLeaderboard = await prisma.bridgeLeaderboard.findMany({
      where: {
        brandId: brandResult.brandId,
        period: 'MONTHLY',
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: {
        rank: 'asc',
      },
      take: 10,
    });

    console.log('\n📈 MONTHLY Leaderboard (Top 10):');
    monthlyLeaderboard.forEach((entry, index) => {
      const userName = entry.user.profile?.userName || entry.user.profile?.displayName || 'Unknown';
      console.log(`   ${entry.rank}. ${userName} - Score: ${entry.score.toFixed(2)}`);
    });

    // İstatistikler
    const totalWeekly = await prisma.bridgeLeaderboard.count({
      where: {
        brandId: brandResult.brandId,
        period: 'WEEKLY',
      },
    });

    const totalMonthly = await prisma.bridgeLeaderboard.count({
      where: {
        brandId: brandResult.brandId,
        period: 'MONTHLY',
      },
    });

    console.log('\n📊 Toplam İstatistikler:');
    console.log(`   WEEKLY Entries: ${totalWeekly}`);
    console.log(`   MONTHLY Entries: ${totalMonthly}`);

    console.log('\n✅ Tüm kontroller başarılı!\n');
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testAppleLeaderboard();
