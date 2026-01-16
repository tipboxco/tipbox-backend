/**
 * Script: Verify Event Badge System
 * 
 * Bu script event badge sisteminin düzgün çalışıp çalışmadığını test eder:
 * - Badge'lerin doğru oluşturulduğunu kontrol eder
 * - Test kullanıcılarının metriklerini gösterir
 * - Badge progress'lerini simüle eder
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EVENT_ID = '00MKFPNIQ30000064YDGL62K7Q';

async function main() {
  console.log('\n🔍 Verifying Event Badge System...\n');

  // 1. Event bilgisi
  const event = await prisma.wishboxEvent.findUnique({
    where: { id: EVENT_ID },
    select: {
      id: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
    },
  });

  if (!event) {
    throw new Error('Event not found!');
  }

  console.log('📅 Event Information:');
  console.log(`   Title: ${event.title}`);
  console.log(`   Status: ${event.status}`);
  console.log(`   Start: ${event.startDate.toISOString()}`);
  console.log(`   End: ${event.endDate.toISOString()}`);
  console.log(`   Active: ${event.status === 'PUBLISHED' && event.endDate > new Date() ? 'YES ✅' : 'NO ❌'}`);

  // 2. Badge'leri listele
  console.log('\n🏆 Event Badges:');
  const badges = await prisma.badge.findMany({
    where: {
      type: 'EVENT',
      name: {
        startsWith: '[Event]',
      },
    },
    include: {
      achievementGoals: {
        select: {
          id: true,
          requirement: true,
          pointsRequired: true,
          difficulty: true,
        },
      },
      category: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  const postBadges: any[] = [];
  const likesBadges: any[] = [];

  badges.forEach(badge => {
    const goal = badge.achievementGoals[0];
    if (!goal) return;

    const req = JSON.parse(goal.requirement);
    const badgeInfo = {
      id: badge.id,
      name: badge.name,
      description: badge.description,
      rarity: badge.rarity,
      type: req.type,
      threshold: req.threshold,
      difficulty: goal.difficulty,
    };

    if (req.type === 'POSTS_COUNT') {
      postBadges.push(badgeInfo);
    } else if (req.type === 'LIKES_RECEIVED') {
      likesBadges.push(badgeInfo);
    }
  });

  console.log('\n   📝 Post Badges:');
  postBadges
    .sort((a, b) => a.threshold - b.threshold)
    .forEach(b => {
      console.log(`   ├─ ${b.name} (${b.rarity})`);
      console.log(`   │  └─ Threshold: ${b.threshold} posts | Difficulty: ${b.difficulty}`);
    });

  console.log('\n   👍 Likes Received Badges:');
  likesBadges
    .sort((a, b) => a.threshold - b.threshold)
    .forEach(b => {
      console.log(`   ├─ ${b.name} (${b.rarity})`);
      console.log(`   │  └─ Threshold: ${b.threshold} likes | Difficulty: ${b.difficulty}`);
    });

  // 3. Test kullanıcılarının durumu
  console.log('\n👥 Test Users & Metrics:');
  const userStats = await prisma.wishboxStats.findMany({
    where: {
      eventId: EVENT_ID,
    },
    include: {
      user: {
        select: {
          email: true,
          profile: {
            select: {
              displayName: true,
            },
          },
        },
      },
    },
    orderBy: {
      eventPostsCount: 'desc',
    },
  });

  if (userStats.length === 0) {
    console.log('   ⚠️  No users found with event stats');
  } else {
    for (const stat of userStats) {
      const userName = stat.user.profile?.displayName || stat.user.email;
      console.log(`\n   👤 ${userName}`);
      console.log(`      Posts: ${stat.eventPostsCount}`);
      console.log(`      Likes Received: ${stat.eventLikesReceived}`);

      // Kullanıcının kazanması gereken badge'leri hesapla
      const eligiblePostBadges = postBadges.filter(
        b => stat.eventPostsCount >= b.threshold
      );
      const eligibleLikesBadges = likesBadges.filter(
        b => stat.eventLikesReceived >= b.threshold
      );

      // Kullanıcının sahip olduğu badge'leri kontrol et
      const userBadges = await prisma.userBadge.findMany({
        where: {
          userId: stat.userId,
          badgeId: {
            in: [...eligiblePostBadges, ...eligibleLikesBadges].map(b => b.id),
          },
        },
        include: {
          badge: {
            select: {
              name: true,
            },
          },
        },
      });

      console.log(`      Eligible Badges: ${eligiblePostBadges.length + eligibleLikesBadges.length}`);
      console.log(`      Earned Badges: ${userBadges.length}`);

      if (userBadges.length > 0) {
        console.log(`      └─ Badges:`);
        userBadges.forEach(ub => {
          console.log(`         ✓ ${ub.badge.name} ${ub.claimed ? '(Claimed)' : '(Unclaimed)'}`);
        });
      }

      // Eksik badge'leri göster
      const missingBadgeIds = [...eligiblePostBadges, ...eligibleLikesBadges]
        .map(b => b.id)
        .filter(id => !userBadges.some(ub => ub.badgeId === id));

      if (missingBadgeIds.length > 0) {
        console.log(`      ⚠️  Missing ${missingBadgeIds.length} badge(s) - Should be auto-granted!`);
      }
    }
  }

  // 4. Badge Progress Simulation
  console.log('\n\n📊 Badge Progress Simulation:');
  console.log('   (Simulating user with different metric values)\n');

  const simulateProgress = (posts: number, likes: number) => {
    console.log(`   📍 User with ${posts} posts, ${likes} likes:`);
    
    const earnedPostBadges = postBadges.filter(b => posts >= b.threshold);
    const earnedLikesBadges = likesBadges.filter(b => likes >= b.threshold);
    
    console.log(`      Post Badges: ${earnedPostBadges.map(b => b.name.split(']')[1].trim()).join(', ') || 'None'}`);
    console.log(`      Likes Badges: ${earnedLikesBadges.map(b => b.name.split(']')[1].trim()).join(', ') || 'None'}`);
    
    // Next badge
    const nextPostBadge = postBadges.find(b => posts < b.threshold);
    const nextLikesBadge = likesBadges.find(b => likes < b.threshold);
    
    if (nextPostBadge) {
      console.log(`      Next Post Badge: ${nextPostBadge.name} (need ${nextPostBadge.threshold - posts} more posts)`);
    } else {
      console.log(`      Next Post Badge: All completed! 🎉`);
    }
    
    if (nextLikesBadge) {
      console.log(`      Next Likes Badge: ${nextLikesBadge.name} (need ${nextLikesBadge.threshold - likes} more likes)`);
    } else {
      console.log(`      Next Likes Badge: All completed! 🎉`);
    }
  };

  simulateProgress(0, 0);
  console.log('');
  simulateProgress(1, 1);
  console.log('');
  simulateProgress(3, 3);
  console.log('');
  simulateProgress(5, 5);

  // 5. System Health Check
  console.log('\n\n🏥 System Health Check:');
  
  const checks = {
    badgesCreated: badges.length >= 6,
    achievementGoalsLinked: badges.every(b => b.achievementGoals.length > 0),
    categoryExists: badges.every(b => b.category !== null),
    eventActive: event.status === 'PUBLISHED' && event.endDate > new Date(),
    testDataExists: userStats.length > 0,
  };

  Object.entries(checks).forEach(([check, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${check}`);
  });

  const allPassed = Object.values(checks).every(v => v);
  console.log(`\n   Overall: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);

  // 6. API Endpoint Test Instructions
  console.log('\n\n🧪 API Testing Instructions:');
  console.log('   1. Get event progress:');
  console.log(`      GET /api/v1/events/${EVENT_ID}/progress`);
  console.log('');
  console.log('   2. Create a post:');
  console.log(`      POST /api/v1/posts/${EVENT_ID}/post`);
  console.log('      (Should auto-increment metrics & check badges)');
  console.log('');
  console.log('   3. Like a post:');
  console.log('      POST /api/v1/interactions/like');
  console.log('      (Should increment post owner\'s likes received)');
  console.log('');
  console.log('   4. Check leaderboard:');
  console.log(`      GET /api/v1/events/${EVENT_ID}/leaderboard`);

  console.log('\n✅ Verification Complete!\n');
}

main()
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
