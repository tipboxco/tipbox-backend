import { PrismaClient } from '@prisma/client';
import { EVENT_BADGE_CONFIGS } from '../../src/config/event-badges.config';
import { BadgeType } from '../../src/domain/gamification/badge-type.enum';

export async function ensureEventBadges(prisma: PrismaClient): Promise<void> {
  console.log('\n🏆 Seeding Event Badges...');

  try {
    // Badge category for event badges
    let eventCategory = await prisma.badgeCategory.findFirst({
      where: { name: 'Event Rozetleri' },
    });

    if (!eventCategory) {
      eventCategory = await prisma.badgeCategory.create({
        data: {
          name: 'Event Rozetleri',
          description: 'Event katılımı ve başarıları için verilen rozetler',
        },
      });
      console.log('  ✅ Event Badge Category created');
    }

    // Achievement chain for event badges
    let eventChain = await prisma.achievementChain.findFirst({
      where: { name: 'Event Başarıları' },
    });

    if (!eventChain) {
      eventChain = await prisma.achievementChain.create({
        data: {
          name: 'Event Başarıları',
          description: 'Event katılımı ve aktiviteler için başarı rozetleri',
          category: 'EVENT',
        },
      });
      console.log('  ✅ Event Achievement Chain created');
    }

    // Create badges and achievement goals
    for (const config of EVENT_BADGE_CONFIGS) {
      // Check if badge already exists
      let badge = await prisma.badge.findFirst({
        where: { name: config.name },
      });

      if (!badge) {
        badge = await prisma.badge.create({
          data: {
            name: config.name,
            description: config.description,
            imageUrl: null, // TODO: Event badge görselleri eklenebilir
            type: BadgeType.EVENT,
            rarity: config.rarity,
            boostMultiplier: null,
            rewardMultiplier: null,
            categoryId: eventCategory.id,
          },
        });
        console.log(`  ✅ Badge created: ${config.name}`);
      } else {
        console.log(`  ⏭️  Badge already exists: ${config.name}`);
      }

      // Check if achievement goal already exists for this badge
      const existingGoal = await prisma.achievementGoal.findFirst({
        where: { rewardBadgeId: badge.id },
      });

      if (!existingGoal) {
        // Create achievement goal with requirement JSON
        await prisma.achievementGoal.create({
          data: {
            chainId: eventChain.id,
            title: config.name,
            requirement: JSON.stringify({
              type: config.requirement.type,
              threshold: config.requirement.threshold,
            }),
            rewardBadgeId: badge.id,
            pointsRequired: config.requirement.threshold,
            difficulty: config.rarity === 'COMMON' ? 'EASY' : config.rarity === 'RARE' ? 'MEDIUM' : 'HARD',
          },
        });
        console.log(`  ✅ Achievement Goal created for: ${config.name}`);
      } else {
        console.log(`  ⏭️  Achievement Goal already exists for: ${config.name}`);
      }
    }

    console.log(`\n✅ Event Badges seeded successfully (${EVENT_BADGE_CONFIGS.length} badges)\n`);
  } catch (error) {
    console.error('❌ Error seeding event badges:', error);
    throw error;
  }
}
