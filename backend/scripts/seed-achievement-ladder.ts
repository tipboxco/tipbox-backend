import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureBadgeCategory(name: string, description?: string) {
  const existing = await prisma.badgeCategory.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.badgeCategory.create({ data: { name, description } });
}

async function ensureBadge(config: {
  name: string;
  description?: string;
  type: 'ACHIEVEMENT' | 'EVENT' | 'COSMETIC';
  rarity: 'COMMON' | 'RARE' | 'EPIC';
  categoryId: string;
}) {
  const existing = await prisma.badge.findFirst({ where: { name: config.name } });
  if (existing) {
    return prisma.badge.update({
      where: { id: existing.id },
      data: {
        description: config.description ?? existing.description,
        type: config.type as any,
        rarity: config.rarity as any,
        categoryId: config.categoryId,
      },
    });
  }

  return prisma.badge.create({
    data: {
      name: config.name,
      description: config.description,
      imageUrl: null,
      type: config.type as any,
      rarity: config.rarity as any,
      boostMultiplier: null,
      rewardMultiplier: null,
      categoryId: config.categoryId,
    },
  });
}

async function ensureAchievementChain(config: { name: string; description?: string; category: string }) {
  const existing = await prisma.achievementChain.findFirst({ where: { name: config.name } });
  if (existing) return existing;
  return prisma.achievementChain.create({ data: config });
}

async function ensureAchievementGoal(config: {
  chainId: string;
  title: string;
  requirement: string;
  goalType: 'POST' | 'INVENTORY' | 'LIKE_GIVEN' | 'LIKE_RECEIVED' | 'COMMENT';
  rewardBadgeId: string;
  pointsRequired: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}) {
  const existing = await prisma.achievementGoal.findFirst({
    where: { chainId: config.chainId, title: config.title },
  });

  if (existing) {
    return prisma.achievementGoal.update({
      where: { id: existing.id },
      data: {
        requirement: config.requirement,
        goalType: config.goalType as any,
        rewardBadgeId: config.rewardBadgeId,
        pointsRequired: config.pointsRequired,
        difficulty: config.difficulty as any,
      },
    });
  }

  return prisma.achievementGoal.create({
    data: {
      chainId: config.chainId,
      title: config.title,
      requirement: config.requirement,
      goalType: config.goalType as any,
      rewardBadgeId: config.rewardBadgeId,
      pointsRequired: config.pointsRequired,
      difficulty: config.difficulty as any,
    },
  });
}

/**
 * Event dışı Achievement Ladder için 4 örnek badge + goal seed eder.
 * Güvenli/idempotent: Mevcut datayı silmez.
 */
async function main() {
  // eslint-disable-next-line no-console
  console.log('🌱 seed-achievement-ladder başladı');

  const category = await ensureBadgeCategory('Achievement', 'Başarı rozetleri - belirli hedeflere ulaşma');

  const chain = await ensureAchievementChain({
    name: 'Achievement Ladder',
    description: 'Event dışı, sürekli devam eden hedefler',
    category: 'Ladder',
  });

  const badges = await Promise.all([
    ensureBadge({
      name: 'Experience Explorer',
      description: '10 tane Experience Post paylaş',
      type: 'ACHIEVEMENT',
      rarity: 'COMMON',
      categoryId: category.id,
    }),
    ensureBadge({
      name: 'Inventory Collector',
      description: 'Envantere 10 ürün ekle',
      type: 'ACHIEVEMENT',
      rarity: 'COMMON',
      categoryId: category.id,
    }),
    ensureBadge({
      name: 'Like Spreader',
      description: '100 post beğen (verilen like)',
      type: 'ACHIEVEMENT',
      rarity: 'RARE',
      categoryId: category.id,
    }),
    ensureBadge({
      name: 'Loved Creator',
      description: 'Postların toplam 100 like alsın (alınan like)',
      type: 'ACHIEVEMENT',
      rarity: 'RARE',
      categoryId: category.id,
    }),
  ]);

  const badgeByName = new Map(badges.map((b) => [b.name, b]));

  await Promise.all([
    ensureAchievementGoal({
      chainId: chain.id,
      title: 'Share 10 Experience Posts',
      requirement: '10 Post paylaşma hedefi',
      goalType: 'POST',
      rewardBadgeId: badgeByName.get('Experience Explorer')!.id,
      pointsRequired: 10,
      difficulty: 'EASY',
    }),
    ensureAchievementGoal({
      chainId: chain.id,
      title: 'Add 10 Items to Inventory',
      requirement: '10 tane ürünü envantere ekle',
      goalType: 'INVENTORY',
      rewardBadgeId: badgeByName.get('Inventory Collector')!.id,
      pointsRequired: 10,
      difficulty: 'EASY',
    }),
    ensureAchievementGoal({
      chainId: chain.id,
      title: 'Give 100 Post Likes',
      requirement: '100 post beğenme hedefi',
      goalType: 'LIKE_GIVEN',
      rewardBadgeId: badgeByName.get('Like Spreader')!.id,
      pointsRequired: 100,
      difficulty: 'MEDIUM',
    }),
    ensureAchievementGoal({
      chainId: chain.id,
      title: 'Receive 100 Post Likes',
      requirement: 'Postların toplam 100 beğeni alması',
      goalType: 'LIKE_RECEIVED',
      rewardBadgeId: badgeByName.get('Loved Creator')!.id,
      pointsRequired: 100,
      difficulty: 'MEDIUM',
    }),
  ]);

  // eslint-disable-next-line no-console
  console.log('✅ seed-achievement-ladder tamamlandı');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('❌ seed-achievement-ladder hata:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

