import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { MainAction } from '../../domain/gamification/main-action.enum';
import { ActionTypeRepository } from '../../infrastructure/repositories/action-type-prisma.repository';
import logger from '../../infrastructure/logger/logger';
import { getErrorMessage } from '../../infrastructure/errors/error-helper';
import { Prisma } from '@prisma/client';

const prisma = getPrisma();

export class ActionLogService {
  private actionTypeRepo: ActionTypeRepository;

  constructor() {
    this.actionTypeRepo = new ActionTypeRepository();
  }

  /**
   * Log a user action (fire-and-forget pattern)
   * Should never throw errors to avoid blocking user actions
   */
  async logAction(params: {
    userId: string;
    mainAction: MainAction;
    actionTypeCode: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      // Find ActionType by mainAction + code
      const actionType = await this.actionTypeRepo.findByMainActionAndCode(
        params.mainAction,
        params.actionTypeCode
      );

      if (!actionType) {
        logger.warn('ActionType not found for logging', {
          mainAction: params.mainAction,
          code: params.actionTypeCode,
        });
        return;
      }

      // Create action log
      await prisma.actionLog.create({
        data: {
          userId: params.userId,
          mainAction: params.mainAction,
          actionTypeId: actionType.id,
          entityType: params.entityType,
          entityId: params.entityId,
          metadata: params.metadata
            ? (JSON.parse(JSON.stringify(params.metadata)) as Prisma.JsonValue)
            : null,
        },
      });

      logger.info('Action logged', {
        userId: params.userId,
        mainAction: params.mainAction,
        entityType: params.entityType,
      });
    } catch (error) {
      logger.error('Failed to log action', {
        error: getErrorMessage(error),
        params,
      });
      // Don't throw - logging should never block user actions
    }
  }

  /**
   * Get user's action history with filters
   */
  async getUserActionHistory(
    userId: string,
    filters?: {
      mainAction?: MainAction;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: Prisma.ActionLogWhereInput = { userId };

    if (filters?.mainAction) {
      where.mainAction = filters.mainAction;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const logs = await prisma.actionLog.findMany({
      where,
      include: {
        actionType: true,
        user: {
          include: {
            profile: {
              select: {
                username: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    });

    return logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      user: {
        username: log.user.profile?.username || 'Unknown',
        email: log.user.email,
      },
      mainAction: log.mainAction,
      actionType: {
        label: log.actionType.label,
      },
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata,
      createdAt: log.createdAt,
    }));
  }

  /**
   * Get action counts by type for a user
   */
  async getActionCountsByType(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Record<string, number>> {
    const where: Prisma.ActionLogWhereInput = { userId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    const counts = await prisma.actionLog.groupBy({
      by: ['mainAction'],
      where,
      _count: { id: true },
    });

    const result: Record<string, number> = {};
    counts.forEach((count) => {
      result[count.mainAction] = count._count.id;
    });

    return result;
  }

  /**
   * Backfill actions from existing data
   * This will be implemented based on existing data structure
   */
  async backfillActionsFromExistingData(userId: string): Promise<number> {
    logger.info('Backfilling actions for user', { userId });

    let totalLogged = 0;

    try {
      // Backfill posts
      const posts = await prisma.contentPost.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          categoryId: true,
          createdAt: true,
        },
      });

      for (const post of posts) {
        await this.logAction({
          userId,
          mainAction: MainAction.POST,
          actionTypeCode: post.type,
          entityType: 'post',
          entityId: post.id,
          metadata: {
            postType: post.type,
            categoryId: post.categoryId,
            backfilled: true,
          },
        });
        totalLogged++;
      }

      // Backfill likes
      const likes = await prisma.contentLike.findMany({
        where: { userId },
        select: {
          id: true,
          postId: true,
          createdAt: true,
        },
      });

      for (const like of likes) {
        await this.logAction({
          userId,
          mainAction: MainAction.LIKE,
          actionTypeCode: 'ALL',
          entityType: 'post',
          entityId: like.postId,
          metadata: {
            backfilled: true,
          },
        });
        totalLogged++;
      }

      // Backfill comments
      const comments = await prisma.contentComment.findMany({
        where: { userId },
        select: {
          id: true,
          postId: true,
          body: true,
          createdAt: true,
        },
      });

      for (const comment of comments) {
        await this.logAction({
          userId,
          mainAction: MainAction.COMMENT,
          actionTypeCode: 'ALL',
          entityType: 'post',
          entityId: comment.postId,
          metadata: {
            commentId: comment.id,
            commentLength: comment.body.length,
            backfilled: true,
          },
        });
        totalLogged++;
      }

      // Backfill bookmarks/favorites
      const favorites = await prisma.contentFavorite.findMany({
        where: { userId },
        select: {
          id: true,
          postId: true,
          createdAt: true,
        },
      });

      for (const favorite of favorites) {
        await this.logAction({
          userId,
          mainAction: MainAction.BOOKMARK,
          actionTypeCode: 'ALL',
          entityType: 'post',
          entityId: favorite.postId,
          metadata: {
            backfilled: true,
          },
        });
        totalLogged++;
      }

      logger.info('Action backfill complete', { userId, totalLogged });
    } catch (error) {
      logger.error('Action backfill failed', {
        userId,
        error: getErrorMessage(error),
      });
    }

    return totalLogged;
  }
}
