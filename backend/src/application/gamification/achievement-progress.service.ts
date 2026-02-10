import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import logger from '../../infrastructure/logger/logger';
import { GamificationService } from './gamification.service';
import { MainAction } from '../../domain/gamification/main-action.enum';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import { getErrorMessage } from '../../infrastructure/errors/error-helper';

export class AchievementProgressService {
  private readonly prisma: ReturnType<typeof getPrisma>;
  private readonly gamificationService: GamificationService;
  private readonly notificationService: NotificationService;

  constructor() {
    this.prisma = getPrisma();
    this.gamificationService = new GamificationService();
    this.notificationService = new NotificationService();
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
            return { completedNow: false, rewardBadgeId: null as string | null, prev: 0, next: 0 };
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

          return { completedNow, rewardBadgeId: goal.rewardBadgeId ?? null, prev, next };
        });

        // Milestone detection (if not completed yet)
        if (!result.completedNow && result.next < goal.pointsRequired) {
          const prevPercentage = (result.prev / goal.pointsRequired) * 100;
          const newPercentage = (result.next / goal.pointsRequired) * 100;
          const milestones = [25, 50, 75, 90];

          for (const milestone of milestones) {
            if (prevPercentage < milestone && newPercentage >= milestone) {
              // Send milestone notification
              this.notificationService.sendNotification(
                userId,
                NotificationType.ACHIEVEMENT_PROGRESS,
                {
                  goalTitle: goal.title || goal.requirement || 'Achievement',
                  progress: result.next,
                  pointsRequired: goal.pointsRequired,
                  percentage: milestone,
                  remaining: goal.pointsRequired - result.next,
                }
              ).catch((err) => {
                logger.warn('Failed to send milestone notification', {
                  error: getErrorMessage(err),
                  userId,
                  goalId: goal.id,
                  milestone,
                });
              });

              logger.info('Milestone reached', {
                userId,
                goalId: goal.id,
                milestone,
                progress: result.next,
              });
            }
          }
        }

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

  /**
   * Get goals near completion (80%+ progress by default)
   * @param userId - User ID
   * @param threshold - Completion threshold (default: 0.8 = 80%)
   * @returns Array of near-completion goals
   */
  async getNearCompletionGoals(
    userId: string,
    threshold: number = 0.8
  ) {
    try {
      const userAchievements = await this.prisma.userAchievement.findMany({
        where: {
          userId,
          completed: false, // Only incomplete goals
        },
        include: {
          goal: {
            include: {
              collection: true,
              rewardBadge: {
                select: {
                  id: true,
                  name: true,
                  imageUrl: true,
                  rarity: true,
                },
              },
            },
          },
        },
      });

      const nearCompletion = userAchievements
        .filter((ua) => (ua.progress / ua.goal.pointsRequired) >= threshold)
        .map((ua) => ({
          goalId: ua.goalId,
          title: ua.goal.title || ua.goal.requirement || 'Achievement',
          progress: ua.progress,
          pointsRequired: ua.goal.pointsRequired,
          percentage: (ua.progress / ua.goal.pointsRequired) * 100,
          remaining: ua.goal.pointsRequired - ua.progress,
          estimatedActionsNeeded: ua.goal.pointsRequired - ua.progress,
          rewardBadge: ua.goal.rewardBadge,
          collection: {
            id: ua.goal.collection.id,
            name: ua.goal.collection.name,
          },
        }))
        .sort((a, b) => b.percentage - a.percentage); // Highest percentage first

      return nearCompletion;
    } catch (error) {
      logger.error('Failed to get near completion goals', {
        userId,
        threshold,
        error: getErrorMessage(error),
      });
      return [];
    }
  }
}

