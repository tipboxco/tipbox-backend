import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import logger from '../../infrastructure/logger/logger';
import { GamificationService } from './gamification.service';
import { MainAction } from '../../domain/gamification/main-action.enum';

export class AchievementProgressService {
  private readonly prisma: ReturnType<typeof getPrisma>;
  private readonly gamificationService: GamificationService;

  constructor() {
    this.prisma = getPrisma();
    this.gamificationService = new GamificationService();
  }

  /**
   * Increments progress for all Collection badge goals matching the action
   * Progress only increases; completed goals are not re-incremented.
   *
   * @param userId - User ID
   * @param mainAction - Main action type (POST, LIKE, COMMENT, etc.)
   * @param actionTypeId - Specific action type ID (e.g., POST+EXPERIENCE, LIKE+ALL)
   * @param amount - Amount to increment (default: 1)
   */
  async incrementProgress(
    userId: string,
    mainAction: MainAction,
    actionTypeId: string,
    amount = 1
  ): Promise<void> {
    if (!userId) return;
    if (!Number.isFinite(amount) || amount <= 0) return;

    const goals = await this.findGoalsByAction(mainAction, actionTypeId);
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
          // Idempotent: won't create duplicate if already exists
          await this.gamificationService.grantBadgeToUser(userId, result.rewardBadgeId);

          logger.info({
            message: 'Collection badge goal completed',
            userId,
            goalId: goal.id,
            mainAction,
            actionTypeId,
            badgeId: result.rewardBadgeId,
          });
        }
      } catch (error) {
        logger.warn({
          message: 'Failed to increment achievement progress',
          userId,
          mainAction,
          actionTypeId,
          goalId: goal.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Sets progress from a total value for backfill scenarios
   * - Does not decrease existing progress if it's already higher
   * - Completes goal and grants badge if total >= pointsRequired
   *
   * @param userId - User ID
   * @param mainAction - Main action type
   * @param actionTypeId - Specific action type ID
   * @param total - Total progress value to set
   */
  async upsertProgressFromTotal(
    userId: string,
    mainAction: MainAction,
    actionTypeId: string,
    total: number
  ): Promise<void> {
    if (!userId) return;
    if (typeof total !== 'number' || !Number.isFinite(total) || total < 0) return;

    const goals = await this.findGoalsByAction(mainAction, actionTypeId);
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
          mainAction,
          actionTypeId,
          goalId: goal.id,
          total,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Finds Collection badge goals by action type
   * Only returns goals with COLLECTION badge type (via rewardBadge relation)
   */
  private async findGoalsByAction(
    mainAction: MainAction,
    actionTypeId: string
  ): Promise<Array<{ id: string; pointsRequired: number; rewardBadgeId: string | null }>> {
    const goals = await this.prisma.achievementGoal.findMany({
      select: {
        id: true,
        pointsRequired: true,
        rewardBadgeId: true,
        mainAction: true,
        actionTypeId: true,
        rewardBadge: {
          select: {
            type: true,
          },
        },
      },
      where: {
        mainAction: mainAction as any,
        actionTypeId,
      },
    });

    return goals
      .filter((g) => g.rewardBadge?.type === 'COLLECTION') // Only Collection badge goals
      .map((g) => ({
        id: String(g.id),
        pointsRequired: Number(g.pointsRequired) || 0,
        rewardBadgeId: g.rewardBadgeId ? String(g.rewardBadgeId) : null,
      }))
      .filter((x) => x.pointsRequired > 0);
  }

  /**
   * Get user's progress for a specific collection
   * @param userId - User ID
   * @param collectionId - Collection ID
   * @returns Array of goal progress
   */
  async getCollectionProgress(
    userId: string,
    collectionId: string
  ): Promise<Array<{
    goalId: string;
    title: string;
    progress: number;
    pointsRequired: number;
    completed: boolean;
    completedAt: Date | null;
  }>> {
    try {
      const goals = await this.prisma.achievementGoal.findMany({
        where: {
          collectionId,
        },
        include: {
          userAchievements: {
            where: {
              userId,
            },
          },
        },
      });

      return goals.map((goal) => {
        const userAchievement = goal.userAchievements[0];
        return {
          goalId: goal.id,
          title: goal.title,
          progress: userAchievement?.progress ?? 0,
          pointsRequired: goal.pointsRequired,
          completed: userAchievement?.completed ?? false,
          completedAt: userAchievement?.completedAt ?? null,
        };
      });
    } catch (error) {
      logger.error({
        message: 'Failed to get collection progress',
        userId,
        collectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Helper: Find ActionType ID by mainAction and code
   * Returns null if not found (so callers can safely skip incrementProgress)
   */
  async findActionTypeId(mainAction: MainAction, code: string): Promise<string | null> {
    try {
      const actionType = await this.prisma.actionType.findUnique({
        where: {
          mainAction_code: {
            mainAction: mainAction as any,
            code,
          },
        },
        select: {
          id: true,
        },
      });
      return actionType?.id ?? null;
    } catch (error) {
      logger.warn({
        message: 'Failed to find ActionType',
        mainAction,
        code,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Convenience method: Increment progress by action code
   * Automatically looks up ActionType ID
   */
  async incrementProgressByCode(
    userId: string,
    mainAction: MainAction,
    code: string,
    amount = 1
  ): Promise<void> {
    const actionTypeId = await this.findActionTypeId(mainAction, code);
    if (!actionTypeId) {
      logger.debug({
        message: 'ActionType not found, skipping progress increment',
        mainAction,
        code,
      });
      return;
    }
    await this.incrementProgress(userId, mainAction, actionTypeId, amount);
  }
}

