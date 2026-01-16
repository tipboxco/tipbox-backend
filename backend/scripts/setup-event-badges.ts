/**
 * Script: Setup Event Badges for Specific Event
 * 
 * Bu script belirli bir event için 6 badge oluşturur:
 * - 3 badge: 1, 3, 5 post paylaşımı için
 * - 3 badge: 1, 3, 5 beğeni (likes received) için
 * 
 * Event ID: 00MKFPNIQ30000064YDGL62K7Q
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EVENT_ID = '00MKFPNIQ30000064YDGL62K7Q';

interface BadgeConfig {
  key: string;
  name: string;
  description: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC';
  imageUrl: string | null;
  requirementType: 'POSTS_COUNT' | 'LIKES_RECEIVED';
  threshold: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}

const EVENT_BADGES: BadgeConfig[] = [
  // Post Badges
  {
    key: 'EVENT_FIRST_POST',
    name: '[Event] İlk Adım',
    description: 'Event\'te ilk postunu paylaştın! 🎉',
    rarity: 'COMMON',
    imageUrl: null,
    requirementType: 'POSTS_COUNT',
    threshold: 1,
    difficulty: 'EASY',
  },
  {
    key: 'EVENT_TRIPLE_POSTER',
    name: '[Event] Aktif Katılımcı',
    description: 'Event\'te 3 post paylaştın! Devam et! 🔥',
    rarity: 'RARE',
    imageUrl: null,
    requirementType: 'POSTS_COUNT',
    threshold: 3,
    difficulty: 'MEDIUM',
  },
  {
    key: 'EVENT_MASTER_POSTER',
    name: '[Event] İçerik Ustası',
    description: 'Event\'te 5 post paylaştın! Harikasın! ⭐',
    rarity: 'EPIC',
    imageUrl: null,
    requirementType: 'POSTS_COUNT',
    threshold: 5,
    difficulty: 'HARD',
  },
  // Likes Received Badges
  {
    key: 'EVENT_FIRST_LIKE',
    name: '[Event] İlk Beğeni',
    description: 'İlk beğenini aldın! Yoldasın! 👍',
    rarity: 'COMMON',
    imageUrl: null,
    requirementType: 'LIKES_RECEIVED',
    threshold: 1,
    difficulty: 'EASY',
  },
  {
    key: 'EVENT_POPULAR',
    name: '[Event] Popüler',
    description: '3 beğeni aldın! İçeriklerin beğeniliyor! 🌟',
    rarity: 'RARE',
    imageUrl: null,
    requirementType: 'LIKES_RECEIVED',
    threshold: 3,
    difficulty: 'MEDIUM',
  },
  {
    key: 'EVENT_VIRAL',
    name: '[Event] Viral Oldu',
    description: '5 beğeni aldın! Tam bir yıldızsın! 💫',
    rarity: 'EPIC',
    imageUrl: null,
    requirementType: 'LIKES_RECEIVED',
    threshold: 5,
    difficulty: 'HARD',
  },
];

async function main() {
  console.log('\n🚀 Starting Event Badge Setup...');
  console.log(`Event ID: ${EVENT_ID}\n`);

  try {
    // 1. Event'in varlığını kontrol et
    const event = await prisma.wishboxEvent.findUnique({
      where: { id: EVENT_ID },
      select: { id: true, title: true, status: true },
    });

    if (!event) {
      throw new Error(`Event not found: ${EVENT_ID}`);
    }

    console.log(`✅ Event found: ${event.title} (Status: ${event.status})\n`);

    // 2. Badge Category'yi bul veya oluştur
    let badgeCategory = await prisma.badgeCategory.findFirst({
      where: { name: 'Event Rozetleri' },
    });

    if (!badgeCategory) {
      badgeCategory = await prisma.badgeCategory.create({
        data: {
          name: 'Event Rozetleri',
          description: 'Event katılımı ve başarıları için verilen rozetler',
        },
      });
      console.log('✅ Badge Category created: Event Rozetleri');
    } else {
      console.log('✅ Badge Category found: Event Rozetleri');
    }

    // 3. Achievement Chain'i bul veya oluştur
    let achievementChain = await prisma.achievementChain.findFirst({
      where: { name: 'Event Başarıları' },
    });

    if (!achievementChain) {
      achievementChain = await prisma.achievementChain.create({
        data: {
          name: 'Event Başarıları',
          description: 'Event katılımı ve aktiviteler için başarı rozetleri',
          category: 'EVENT',
        },
      });
      console.log('✅ Achievement Chain created: Event Başarıları');
    } else {
      console.log('✅ Achievement Chain found: Event Başarıları');
    }

    console.log('\n📝 Creating/Updating Event Badges...\n');

    // 4. Her badge için işlem yap
    for (const config of EVENT_BADGES) {
      // Badge'i bul veya oluştur
      let badge = await prisma.badge.findFirst({
        where: { 
          name: config.name,
        },
      });

      if (badge) {
        console.log(`⏭️  Badge already exists: ${config.name}`);
        // Badge'i güncelle
        badge = await prisma.badge.update({
          where: { id: badge.id },
          data: {
            description: config.description,
            rarity: config.rarity,
            type: 'EVENT',
          },
        });
        console.log(`   ↳ Updated badge properties`);
      } else {
        // Yeni badge oluştur
        badge = await prisma.badge.create({
          data: {
            name: config.name,
            description: config.description,
            imageUrl: config.imageUrl,
            type: 'EVENT',
            rarity: config.rarity,
            boostMultiplier: null,
            rewardMultiplier: null,
            categoryId: badgeCategory.id,
          },
        });
        console.log(`✅ Created badge: ${config.name}`);
      }

      // Achievement Goal'u kontrol et
      const existingGoal = await prisma.achievementGoal.findFirst({
        where: { 
          rewardBadgeId: badge.id,
        },
      });

      const requirementJson = JSON.stringify({
        type: config.requirementType,
        threshold: config.threshold,
      });

      if (existingGoal) {
        // Goal'u güncelle
        await prisma.achievementGoal.update({
          where: { id: existingGoal.id },
          data: {
            title: config.name,
            requirement: requirementJson,
            pointsRequired: config.threshold,
            difficulty: config.difficulty,
          },
        });
        console.log(`   ↳ Updated achievement goal (Threshold: ${config.threshold} ${config.requirementType})`);
      } else {
        // Yeni goal oluştur
        await prisma.achievementGoal.create({
          data: {
            chainId: achievementChain.id,
            title: config.name,
            requirement: requirementJson,
            rewardBadgeId: badge.id,
            pointsRequired: config.threshold,
            difficulty: config.difficulty,
          },
        });
        console.log(`   ↳ Created achievement goal (Threshold: ${config.threshold} ${config.requirementType})`);
      }
    }

    // 5. Özet bilgi
    console.log('\n📊 Summary:');
    console.log(`   Event ID: ${EVENT_ID}`);
    console.log(`   Badges Created/Updated: ${EVENT_BADGES.length}`);
    console.log(`   - Post Badges: 3 (1, 3, 5 posts)`);
    console.log(`   - Likes Badges: 3 (1, 3, 5 likes received)`);

    // 6. Test için örnek kullanıcı metrikleri oluştur (opsiyonel)
    console.log('\n🧪 Creating test user metrics...');
    
    const testUsers = await prisma.user.findMany({
      take: 3,
      select: { id: true, email: true },
    });

    if (testUsers.length > 0) {
      for (let i = 0; i < testUsers.length; i++) {
        const user = testUsers[i];
        
        // Kullanıcı için event stats oluştur veya güncelle
        await prisma.wishboxStats.upsert({
          where: {
            userId_eventId: {
              userId: user.id,
              eventId: EVENT_ID,
            },
          },
          create: {
            userId: user.id,
            eventId: EVENT_ID,
            totalParticipated: 0,
            totalComments: 0,
            helpfulVotesReceived: 0,
            eventPostsCount: i + 1, // Test: 1, 2, 3 posts
            eventLikesReceived: i, // Test: 0, 1, 2 likes
          },
          update: {
            eventPostsCount: i + 1,
            eventLikesReceived: i,
            updatedAt: new Date(),
          },
        });

        console.log(`   ✅ Test metrics for ${user.email}: ${i + 1} posts, ${i} likes`);
      }
    }

    console.log('\n✅ Event Badge Setup Complete!\n');

    // 7. Verification - Badge'leri listele
    console.log('📋 Verifying badges...\n');
    const createdBadges = await prisma.badge.findMany({
      where: {
        name: {
          in: EVENT_BADGES.map(b => b.name),
        },
      },
      include: {
        achievementGoals: {
          select: {
            requirement: true,
            pointsRequired: true,
            difficulty: true,
          },
        },
      },
    });

    createdBadges.forEach(badge => {
      const goal = badge.achievementGoals[0];
      if (goal) {
        const req = JSON.parse(goal.requirement);
        console.log(`✓ ${badge.name}`);
        console.log(`  └─ ${req.type}: ${req.threshold} (${badge.rarity}, ${goal.difficulty})`);
      }
    });

    console.log('\n🎉 All badges are ready for testing!\n');

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
