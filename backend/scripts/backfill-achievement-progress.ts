import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import { AchievementProgressService } from '../src/application/gamification/achievement-progress.service';
import { AchievementGoalType } from '../src/domain/gamification/achievement-goal-type.enum';

const prisma = getPrisma();
const achievementProgressService = new AchievementProgressService();

/**
 * Event dışı Achievement Ladder progress backfill eder.
 * - EP (Experience post), inventory, like given/received metriklerinden total hesaplar
 * - `user_achievements` upsert eder
 * - Complete olanlarda `grantBadgeToUser` çağırır (idempotent)
 */
async function main() {
  const batchSize = 200;
  let cursor: string | undefined;
  let processed = 0;

  // eslint-disable-next-line no-console
  console.log('🚀 backfill-achievement-progress başladı');

  // Ön kontrol: hedefler DB'de var mı?
  const goalTypeCounts = await prisma.$queryRawUnsafe<Array<{ goal_type: string; count: number }>>(
    `select goal_type, count(*)::int as count
     from achievement_goals
     where goal_type is not null
     group by goal_type`
  );

  const counts = new Map<string, number>(goalTypeCounts.map((g) => [String(g.goal_type), Number(g.count)]));

  const requiredGoalTypes: AchievementGoalType[] = [
    AchievementGoalType.POST,
    AchievementGoalType.INVENTORY,
    AchievementGoalType.LIKE_GIVEN,
    AchievementGoalType.LIKE_RECEIVED,
  ];

  const missing = requiredGoalTypes.filter((t) => (counts.get(t) ?? 0) === 0);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `❌ backfill iptal: DB'de goalType'lı AchievementGoal yok veya eksik. Eksik tipler: ${missing.join(', ')}`
    );
    // eslint-disable-next-line no-console
    console.error(
      '   Önce ladder goal seed et: npx ts-node scripts/seed-achievement-ladder.ts'
    );
    process.exitCode = 1;
    return;
  }

  // eslint-disable-next-line no-console
  console.log('✅ goalType hedefleri bulundu:', Object.fromEntries(counts));

  while (true) {
    const users = await prisma.user.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    });

    if (users.length === 0) break;

    for (const user of users) {
      const userId = String(user.id);

      const [experiencePostsCount, inventoryItemsCount, postLikesGivenCount, postLikesReceivedCount] =
        await Promise.all([
          prisma.contentPost.count({
            where: {
              userId,
              type: 'EXPERIENCE',
            },
          }),
          prisma.inventory.count({
            where: { userId },
          }),
          prisma.contentLike.count({
            where: {
              userId,
              postId: { not: null },
            },
          }),
          prisma.contentLike.count({
            where: {
              postId: { not: null },
              post: { userId },
            },
          }),
        ]);

      await Promise.all([
        achievementProgressService.upsertProgressFromTotal(
          userId,
          AchievementGoalType.POST,
          experiencePostsCount
        ),
        achievementProgressService.upsertProgressFromTotal(
          userId,
          AchievementGoalType.INVENTORY,
          inventoryItemsCount
        ),
        achievementProgressService.upsertProgressFromTotal(
          userId,
          AchievementGoalType.LIKE_GIVEN,
          postLikesGivenCount
        ),
        achievementProgressService.upsertProgressFromTotal(
          userId,
          AchievementGoalType.LIKE_RECEIVED,
          postLikesReceivedCount
        ),
      ]);

      processed += 1;
      if (processed % 200 === 0) {
        // eslint-disable-next-line no-console
        console.log(`✅ Processed users: ${processed}`);
      }
    }

    cursor = String(users[users.length - 1].id);
  }

  // eslint-disable-next-line no-console
  console.log(`🎉 backfill-achievement-progress tamamlandı. Processed users: ${processed}`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('❌ backfill-achievement-progress hata:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

