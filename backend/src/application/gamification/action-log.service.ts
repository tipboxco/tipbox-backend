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
            ? (params.metadata as Prisma.InputJsonValue)
            : Prisma.JsonNull,
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
   * Uses batch insert instead of sequential logAction calls for performance
   */
  async backfillActionsFromExistingData(userId: string): Promise<number> {
    logger.info('Backfilling actions for user', { userId });

    try {
      // Pre-cache all ActionTypes to avoid N+1 lookups
      const allActionTypes = await prisma.actionType.findMany();
      const actionTypeMap = new Map<string, string>();
      for (const at of allActionTypes) {
        actionTypeMap.set(`${at.mainAction}:${at.code}`, at.id);
      }

      const resolveActionTypeId = (mainAction: MainAction, code: string): string | null => {
        return actionTypeMap.get(`${mainAction}:${code}`) ?? null;
      };

      const actionLogData: Prisma.ActionLogCreateManyInput[] = [];

      // ContentPostType -> ActionType code mapping
      // Only EXPERIENCE and FREE (mapped to GENERAL) are tracked
      const postTypeToActionCode: Record<string, string> = {
        EXPERIENCE: 'EXPERIENCE',
        FREE: 'GENERAL',
      };

      // Backfill posts
      const posts = await prisma.contentPost.findMany({
        where: { userId },
        select: { id: true, type: true, categoryId: true },
      });

      for (const post of posts) {
        const actionCode = postTypeToActionCode[post.type];
        if (!actionCode) continue; // Skip post types not tracked (TIPS, COMPARE, QUESTION, UPDATE)

        const actionTypeId = resolveActionTypeId(MainAction.POST, actionCode);
        if (actionTypeId) {
          actionLogData.push({
            userId,
            mainAction: MainAction.POST,
            actionTypeId,
            entityType: 'post',
            entityId: post.id,
            metadata: { postType: post.type, categoryId: post.categoryId, backfilled: true } as Prisma.InputJsonValue,
          });
        }
      }

      // Backfill likes (only post likes, not comment likes)
      const likes = await prisma.contentLike.findMany({
        where: { userId, postId: { not: null } },
        select: { id: true, postId: true },
      });

      const likeActionTypeId = resolveActionTypeId(MainAction.LIKE, 'ALL');
      if (likeActionTypeId) {
        for (const like of likes) {
          if (like.postId) {
            actionLogData.push({
              userId,
              mainAction: MainAction.LIKE,
              actionTypeId: likeActionTypeId,
              entityType: 'post',
              entityId: like.postId,
              metadata: { backfilled: true } as Prisma.InputJsonValue,
            });
          }
        }
      }

      // Backfill comments
      const comments = await prisma.contentComment.findMany({
        where: { userId },
        select: { id: true, postId: true, comment: true },
      });

      const commentActionTypeId = resolveActionTypeId(MainAction.COMMENT, 'ALL');
      if (commentActionTypeId) {
        for (const comment of comments) {
          actionLogData.push({
            userId,
            mainAction: MainAction.COMMENT,
            actionTypeId: commentActionTypeId,
            entityType: 'post',
            entityId: comment.postId,
            metadata: { commentId: comment.id, commentLength: comment.comment.length, backfilled: true } as Prisma.InputJsonValue,
          });
        }
      }

      // Backfill bookmarks/favorites
      const favorites = await prisma.contentFavorite.findMany({
        where: { userId },
        select: { id: true, postId: true },
      });

      const bookmarkActionTypeId = resolveActionTypeId(MainAction.BOOKMARK, 'ALL');
      if (bookmarkActionTypeId) {
        for (const favorite of favorites) {
          actionLogData.push({
            userId,
            mainAction: MainAction.BOOKMARK,
            actionTypeId: bookmarkActionTypeId,
            entityType: 'post',
            entityId: favorite.postId,
            metadata: { backfilled: true } as Prisma.InputJsonValue,
          });
        }
      }

      // Batch insert in chunks of 500
      const BATCH_SIZE = 500;
      for (let i = 0; i < actionLogData.length; i += BATCH_SIZE) {
        const batch = actionLogData.slice(i, i + BATCH_SIZE);
        await prisma.actionLog.createMany({ data: batch, skipDuplicates: true });
        logger.debug('Action backfill batch inserted', { userId, batchStart: i, batchSize: batch.length });
      }

      const totalLogged = actionLogData.length;
      logger.info('Action backfill complete', { userId, totalLogged });
      return totalLogged;
    } catch (error) {
      logger.error('Action backfill failed', {
        userId,
        error: getErrorMessage(error),
      });
      return 0;
    }
  }
}
