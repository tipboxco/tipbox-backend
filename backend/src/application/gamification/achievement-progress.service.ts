import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import logger from '../../infrastructure/logger/logger';
import { GamificationService } from './gamification.service';
import { AchievementGoalType } from '../../domain/gamification/achievement-goal-type.enum';

export class AchievementProgressService {
  private readonly prisma: ReturnType<typeof getPrisma>;
  private readonly gamificationService: GamificationService;

  constructor() {
    this.prisma = getPrisma();
    this.gamificationService = new GamificationService();
  }

  /**
   * Belirli bir requirement tipine bağlı tüm AchievementGoal'lar için progress artırır.
   * Progress sadece artar; completed olmuş goal tekrar ilerletilmez.
   */
  async incrementProgress(
    userId: string,
    goalType: AchievementGoalType,
    amount = 1
  ): Promise<void> {
    if (!userId) return;
    if (!Number.isFinite(amount) || amount <= 0) return;

    const goals = await this.findGoalsByType(goalType);
    if (goals.length === 0) return;

    for (const goal of goals) {
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const existing = await tx.userAchievement.findUnique({
            where: {
              userId_goalId: {
                userId,
                goalId: goal.id,
              },
            },
          });

          if (existing?.completed) {
            return { completedNow: false, rewardBadgeId: null as string | null };
          }

          const prev = existing?.progress ?? 0;
          const next = prev + amount;
          const completedNow = next >= goal.pointsRequired;
          const completedAt = completedNow ? existing?.completedAt ?? new Date() : null;

          if (existing) {
            await tx.userAchievement.update({
              where: { id: existing.id },
              data: {
                progress: next,
                completed: completedNow,
                completedAt,
              },
            });
          } else {
            await tx.userAchievement.create({
              data: {
                userId,
                goalId: goal.id,
                progress: next,
                completed: completedNow,
                completedAt,
              },
            });
          }

          return { completedNow, rewardBadgeId: goal.rewardBadgeId ?? null };
        });

        if (result.completedNow && result.rewardBadgeId) {
          // Idempotent: zaten varsa tekrar oluşturmaz
          await this.gamificationService.grantBadgeToUser(userId, result.rewardBadgeId);
        }
      } catch (error) {
        logger.warn({
          message: 'Failed to increment achievement progress',
          userId,
          goalType,
          goalId: goal.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Backfill gibi senaryolarda total değere göre progress'i set eder (arttırır ama geriye düşürmez).
   * - existing progress > total ise dokunmaz.
   * - total >= pointsRequired ise completed yapar ve badge grant eder.
   */
  async upsertProgressFromTotal(
    userId: string,
    goalType: AchievementGoalType,
    total: number
  ): Promise<void> {
    if (!userId) return;
    if (typeof total !== 'number' || !Number.isFinite(total) || total < 0) return;

    const goals = await this.findGoalsByType(goalType);
    if (goals.length === 0) return;

    for (const goal of goals) {
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const existing = await tx.userAchievement.findUnique({
            where: {
              userId_goalId: {
                userId,
                goalId: goal.id,
              },
            },
          });

          if (existing?.completed) {
            return { completedNow: false, rewardBadgeId: null as string | null };
          }

          const prev = existing?.progress ?? 0;
          if (prev >= total) {
            return { completedNow: false, rewardBadgeId: null as string | null };
          }

          const next = total;
          const completedNow = next >= goal.pointsRequired;
          const completedAt = completedNow ? existing?.completedAt ?? new Date() : null;

          if (existing) {
            await tx.userAchievement.update({
              where: { id: existing.id },
              data: {
                progress: next,
                completed: completedNow,
                completedAt,
              },
            });
          } else {
            await tx.userAchievement.create({
              data: {
                userId,
                goalId: goal.id,
                progress: next,
                completed: completedNow,
                completedAt,
              },
            });
          }

          return { completedNow, rewardBadgeId: goal.rewardBadgeId ?? null };
        });

        if (result.completedNow && result.rewardBadgeId) {
          await this.gamificationService.grantBadgeToUser(userId, result.rewardBadgeId);
        }
      } catch (error) {
        logger.warn({
          message: 'Failed to upsert achievement progress from total',
          userId,
          goalType,
          goalId: goal.id,
          total,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async findGoalsByType(
    goalType: AchievementGoalType
  ): Promise<Array<{ id: string; pointsRequired: number; rewardBadgeId: string | null }>> {
    const goals = await this.prisma.achievementGoal.findMany({
      select: {
        id: true,
        pointsRequired: true,
        rewardBadgeId: true,
        goalType: true,
      },
      where: {
        goalType: goalType as any,
      },
    });

    return goals
      .map((g) => ({
        id: String(g.id),
        pointsRequired: Number(g.pointsRequired) || 0,
        rewardBadgeId: g.rewardBadgeId ? String(g.rewardBadgeId) : null,
      }))
      .filter((x) => x.pointsRequired > 0);
  }
}

