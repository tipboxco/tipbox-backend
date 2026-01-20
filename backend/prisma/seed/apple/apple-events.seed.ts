import { prisma, generateUlid } from '../types';
import { getSeedMediaPath, SeedMediaKey } from '../helpers/media.helper';

interface ChallengeConfig {
  name: string;
  description: string;
  requirementType: 'POSTS_COUNT' | 'LIKES_RECEIVED';
  threshold: number;
  rarity: 'COMMON' | 'RARE' | 'EPIC';
}

/**
 * Apple events oluştur - 5 farklı challenge alanı ile
 */
export async function seedAppleEvents(brandId: string): Promise<{
  eventId: string;
  challenges: Array<{ badgeId: string; name: string; threshold: number }>;
}> {
  console.log('🎉 [seed] Apple events & challenges');

  // Apple brand'ı bul
  const appleBrand = await prisma.brand.findUnique({
    where: { id: brandId },
  });

  if (!appleBrand) {
    throw new Error('Apple brand not found. Please run apple-brand seed first.');
  }

  // Main category bul
  const electronicsCategory = await prisma.mainCategory.findFirst({
    where: { name: 'Electronics' },
  });

  if (!electronicsCategory) {
    throw new Error('Electronics main category not found.');
  }

  // Event oluştur
  const eventId = generateUlid();
  const today = new Date();
  const endDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 gün sonra

  let event = await prisma.wishboxEvent.findFirst({
    where: {
      brandId: brandId,
      title: { contains: 'Apple' },
    },
  });

  if (!event) {
    event = await prisma.wishboxEvent.create({
      data: {
        id: eventId,
        title: 'Apple Innovation Challenge 2024',
        description:
          'Join the Apple Innovation Challenge! Share your experiences, tips, and reviews about Apple products. Complete challenges to earn exclusive badges and rewards. Show your Apple expertise and connect with the community!',
        startDate: today,
        endDate: endDate,
        status: 'PUBLISHED',
        brandId: brandId,
        mainCategoryId: electronicsCategory.id,
        imageUrl: getSeedMediaPath('event.event-batarya' as SeedMediaKey, true) || undefined,
      },
    });
    console.log(`  ✅ Event oluşturuldu: ${event.title}`);
  } else {
    console.log(`  ✅ Event zaten var: ${event.title}`);
  }

  // Badge category oluştur veya bul
  let badgeCategory = await prisma.badgeCategory.findFirst({
    where: { name: 'Event Rozetleri' },
  });

  if (!badgeCategory) {
    badgeCategory = await prisma.badgeCategory.create({
      data: {
        name: 'Event Rozetleri',
        description: 'Event etkinliklerinde kazanılan özel rozetler',
      },
    });
  }

  // 5 farklı challenge badge'leri oluştur
  const challengeConfigs: ChallengeConfig[] = [
    {
      name: '[Apple Event] Content Creator',
      description: 'Share 150 posts about Apple products during the event',
      requirementType: 'POSTS_COUNT',
      threshold: 150,
      rarity: 'EPIC',
    },
    {
      name: '[Apple Event] Community Engager',
      description: 'Make 150 comments on Apple-related posts',
      requirementType: 'POSTS_COUNT', // Comments için ayrı type yok, ama bu challenge için POSTS_COUNT kullanıyoruz
      threshold: 150,
      rarity: 'EPIC',
    },
    {
      name: '[Apple Event] Popular Contributor',
      description: 'Receive 50 likes on your Apple posts',
      requirementType: 'LIKES_RECEIVED',
      threshold: 50,
      rarity: 'RARE',
    },
    {
      name: '[Apple Event] Experience Sharer',
      description: 'Share 20 experience posts about Apple products',
      requirementType: 'POSTS_COUNT',
      threshold: 20,
      rarity: 'RARE',
    },
    {
      name: '[Apple Event] Social Butterfly',
      description: 'Share 20 Apple posts with the community',
      requirementType: 'POSTS_COUNT',
      threshold: 20,
      rarity: 'COMMON',
    },
  ];

  const createdChallenges: Array<{ badgeId: string; name: string; threshold: number }> = [];

  // Her challenge için badge oluştur
  for (let i = 0; i < challengeConfigs.length; i++) {
    const challenge = challengeConfigs[i];

    // Badge oluştur veya bul
    let badge = await prisma.badge.findFirst({
      where: {
        name: challenge.name,
        categoryId: badgeCategory.id,
      },
    });

    if (!badge) {
      badge = await prisma.badge.create({
        data: {
          name: challenge.name,
          description: challenge.description,
          categoryId: badgeCategory.id,
          type: 'EVENT',
          rarity: challenge.rarity,
          boostMultiplier: 1.0,
          rewardMultiplier: 1.0,
          imageUrl: getSeedMediaPath(`badge.event.${i + 1}` as SeedMediaKey, true) || undefined,
        },
      });
      console.log(`  ✅ Badge oluşturuldu: ${challenge.name}`);
    }

    // EventBadge join table kaydı oluştur
    const existingEventBadge = await prisma.eventBadge.findUnique({
      where: {
        eventId_badgeId: {
          eventId: event.id,
          badgeId: badge.id,
        },
      },
    });

    if (!existingEventBadge) {
      await prisma.eventBadge.create({
        data: {
          eventId: event.id,
          badgeId: badge.id,
          requirementType: challenge.requirementType,
          threshold: challenge.threshold,
          displayOrder: i + 1,
          enabled: true,
        },
      });
      console.log(`    ✅ Challenge eklendi: ${challenge.name} (Threshold: ${challenge.threshold})`);
    }

    createdChallenges.push({
      badgeId: badge.id,
      name: challenge.name,
      threshold: challenge.threshold,
    });
  }

  console.log(`\n✅ Toplam ${createdChallenges.length} challenge oluşturuldu`);

  return {
    eventId: event.id,
    challenges: createdChallenges,
  };
}
