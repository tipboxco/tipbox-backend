/**
 * Script: Cleanup Old Event Badges
 * 
 * Bu script eski EVENT badge'lerini temizler ve sadece
 * yeni oluşturduğumuz 6 badge'i bırakır.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Korumak istediğimiz badge isimleri
const KEEP_BADGES = [
  '[Event] İlk Adım',
  '[Event] Aktif Katılımcı',
  '[Event] İçerik Ustası',
  '[Event] İlk Beğeni',
  '[Event] Popüler',
  '[Event] Viral Oldu',
];

async function main() {
  console.log('\n🧹 Starting Event Badge Cleanup...\n');

  try {
    // 1. Mevcut EVENT badge'lerini listele
    const allEventBadges = await prisma.badge.findMany({
      where: {
        type: 'EVENT',
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    console.log(`📊 Found ${allEventBadges.length} EVENT type badges\n`);

    // 2. Silinecek badge'leri belirle
    const badgesToDelete = allEventBadges.filter(
      badge => !KEEP_BADGES.includes(badge.name)
    );

    const badgesToKeep = allEventBadges.filter(
      badge => KEEP_BADGES.includes(badge.name)
    );

    console.log(`✅ Keeping ${badgesToKeep.length} badges:`);
    badgesToKeep.forEach(b => {
      console.log(`   ✓ ${b.name}`);
    });

    console.log(`\n❌ Deleting ${badgesToDelete.length} badges:`);
    badgesToDelete.forEach(b => {
      console.log(`   ✗ ${b.name}`);
    });

    if (badgesToDelete.length === 0) {
      console.log('\n✅ No badges to delete. System is clean!\n');
      return;
    }

    // 3. Kullanıcı onayı simülasyonu (production'da bunu kaldırabilirsiniz)
    console.log(`\n⚠️  This will delete ${badgesToDelete.length} badges and their related data:`);
    console.log('   - UserBadge records (user achievements)');
    console.log('   - AchievementGoal records');
    console.log('   - UserAchievement records');
    console.log('   - BridgeReward records (if any)');

    const badgeIds = badgesToDelete.map(b => b.id);

    // 4. İlişkili verileri temizle
    console.log('\n🗑️  Deleting related data...\n');

    // UserAchievement'ları sil (achievement goal'lar üzerinden)
    const achievementGoals = await prisma.achievementGoal.findMany({
      where: {
        rewardBadgeId: { in: badgeIds },
      },
      select: { id: true },
    });

    const goalIds = achievementGoals.map(g => g.id);

    if (goalIds.length > 0) {
      const deletedUserAchievements = await prisma.userAchievement.deleteMany({
        where: {
          goalId: { in: goalIds },
        },
      });
      console.log(`   ✓ Deleted ${deletedUserAchievements.count} user achievements`);
    }

    // UserBadge'leri sil
    const deletedUserBadges = await prisma.userBadge.deleteMany({
      where: {
        badgeId: { in: badgeIds },
      },
    });
    console.log(`   ✓ Deleted ${deletedUserBadges.count} user badges`);

    // BridgeReward'ları sil
    const deletedBridgeRewards = await prisma.bridgeReward.deleteMany({
      where: {
        badgeId: { in: badgeIds },
      },
    });
    if (deletedBridgeRewards.count > 0) {
      console.log(`   ✓ Deleted ${deletedBridgeRewards.count} bridge rewards`);
    }

    // AchievementGoal'ları sil
    const deletedAchievementGoals = await prisma.achievementGoal.deleteMany({
      where: {
        rewardBadgeId: { in: badgeIds },
      },
    });
    console.log(`   ✓ Deleted ${deletedAchievementGoals.count} achievement goals`);

    // Profile cosmetic badge referanslarını temizle
    const profilesWithCosmeticBadge = await prisma.profile.updateMany({
      where: {
        cosmeticBadgeId: { in: badgeIds },
      },
      data: {
        cosmeticBadgeId: null,
      },
    });
    if (profilesWithCosmeticBadge.count > 0) {
      console.log(`   ✓ Cleared ${profilesWithCosmeticBadge.count} profile cosmetic badges`);
    }

    // 5. Badge'leri sil
    const deletedBadges = await prisma.badge.deleteMany({
      where: {
        id: { in: badgeIds },
      },
    });

    console.log(`\n✅ Deleted ${deletedBadges.count} badges\n`);

    // 6. Sonuçları doğrula
    const remainingEventBadges = await prisma.badge.findMany({
      where: {
        type: 'EVENT',
      },
      select: {
        id: true,
        name: true,
      },
    });

    console.log('📋 Remaining EVENT badges:');
    remainingEventBadges.forEach(b => {
      console.log(`   ✓ ${b.name}`);
    });

    console.log(`\n✅ Cleanup Complete!`);
    console.log(`   Total EVENT badges: ${remainingEventBadges.length}`);
    console.log(`   Expected: ${KEEP_BADGES.length}`);

    if (remainingEventBadges.length === KEEP_BADGES.length) {
      console.log(`\n🎉 Success! Only the new event badges remain.\n`);
    } else {
      console.log(`\n⚠️  Warning: Badge count mismatch!\n`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
