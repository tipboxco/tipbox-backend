import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { EventMetrics } from '../../domain/event/event-metrics.entity';
import logger from '../../infrastructure/logger/logger';

export class EventMetricsService {
  private prisma: ReturnType<typeof getPrisma>;

  constructor() {
    this.prisma = getPrisma();
  }

  /**
   * Kullanıcının event'teki post sayısını artır
   */
  async incrementUserPostCount(userId: string, eventId: string): Promise<EventMetrics> {
    try {
      // EventStats kaydını bul veya oluştur
      const stats = await this.prisma.eventStats.upsert({
        where: {
          userId_eventId: {
            userId,
            eventId,
          },
        },
        update: {
          eventPostsCount: {
            increment: 1,
          },
          updatedAt: new Date(),
        },
        create: {
          userId,
          eventId,
          totalParticipated: 0,
          totalComments: 0,
          helpfulVotesReceived: 0,
          eventPostsCount: 1,
          eventLikesReceived: 0,
        },
      });

      logger.info(`User ${userId} post count incremented for event ${eventId}: ${stats.eventPostsCount}`);

      return {
        userId,
        eventId,
        postsCount: stats.eventPostsCount,
        likesReceivedCount: stats.eventLikesReceived,
      };
    } catch (error) {
      logger.error(`Failed to increment post count for user ${userId} in event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcının event'teki alınan beğeni sayısını artır
   */
  async incrementUserLikesReceived(userId: string, eventId: string): Promise<EventMetrics> {
    try {
      // EventStats kaydını bul veya oluştur
      const stats = await this.prisma.eventStats.upsert({
        where: {
          userId_eventId: {
            userId,
            eventId,
          },
        },
        update: {
          eventLikesReceived: {
            increment: 1,
          },
          updatedAt: new Date(),
        },
        create: {
          userId,
          eventId,
          totalParticipated: 0,
          totalComments: 0,
          helpfulVotesReceived: 0,
          eventPostsCount: 0,
          eventLikesReceived: 1,
        },
      });

      logger.info(`User ${userId} likes received incremented for event ${eventId}: ${stats.eventLikesReceived}`);

      return {
        userId,
        eventId,
        postsCount: stats.eventPostsCount,
        likesReceivedCount: stats.eventLikesReceived,
      };
    } catch (error) {
      logger.error(`Failed to increment likes received for user ${userId} in event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcının event'teki alınan beğeni sayısını azalt (unlike durumunda)
   */
  async decrementUserLikesReceived(userId: string, eventId: string): Promise<EventMetrics> {
    try {
      const existingStats = await this.prisma.eventStats.findUnique({
        where: {
          userId_eventId: {
            userId,
            eventId,
          },
        },
      });

      if (!existingStats) {
        logger.warn(`No stats found for user ${userId} in event ${eventId}, skipping decrement`);
        return {
          userId,
          eventId,
          postsCount: 0,
          likesReceivedCount: 0,
        };
      }

      const stats = await this.prisma.eventStats.update({
        where: {
          userId_eventId: {
            userId,
            eventId,
          },
        },
        data: {
          eventLikesReceived: {
            decrement: 1,
          },
          updatedAt: new Date(),
        },
      });

      logger.info(`User ${userId} likes received decremented for event ${eventId}: ${stats.eventLikesReceived}`);

      return {
        userId,
        eventId,
        postsCount: stats.eventPostsCount,
        likesReceivedCount: stats.eventLikesReceived,
      };
    } catch (error) {
      logger.error(`Failed to decrement likes received for user ${userId} in event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcının event'teki helpful votes sayısını artır (upvote durumunda)
   */
  async incrementHelpfulVotesReceived(userId: string, eventId: string): Promise<EventMetrics> {
    try {
      const stats = await this.prisma.eventStats.upsert({
        where: {
          userId_eventId: {
            userId,
            eventId,
          },
        },
        update: {
          helpfulVotesReceived: {
            increment: 1,
          },
          updatedAt: new Date(),
        },
        create: {
          userId,
          eventId,
          totalParticipated: 0,
          totalComments: 0,
          helpfulVotesReceived: 1,
          eventPostsCount: 0,
          eventLikesReceived: 0,
        },
      });

      logger.info(
        `User ${userId} helpful votes incremented for event ${eventId}: ${stats.helpfulVotesReceived}`,
      );

      return {
        userId,
        eventId,
        postsCount: stats.eventPostsCount,
        likesReceivedCount: stats.eventLikesReceived,
        helpfulVotesReceivedCount: stats.helpfulVotesReceived,
      };
    } catch (error) {
      logger.error(
        `Failed to increment helpful votes for user ${userId} in event ${eventId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Kullanıcının event'teki helpful votes sayısını azalt (upvote geri çekme)
   */
  async decrementHelpfulVotesReceived(userId: string, eventId: string): Promise<EventMetrics> {
    try {
      const existingStats = await this.prisma.eventStats.findUnique({
        where: {
          userId_eventId: {
            userId,
            eventId,
          },
        },
      });

      if (!existingStats) {
        logger.warn(
          `No stats found for user ${userId} in event ${eventId}, skipping helpful votes decrement`,
        );
        return {
          userId,
          eventId,
          postsCount: 0,
          likesReceivedCount: 0,
          helpfulVotesReceivedCount: 0,
        };
      }

      const stats = await this.prisma.eventStats.update({
        where: {
          userId_eventId: {
            userId,
            eventId,
          },
        },
        data: {
          helpfulVotesReceived: {
            decrement: 1,
          },
          updatedAt: new Date(),
        },
      });

      logger.info(
        `User ${userId} helpful votes decremented for event ${eventId}: ${stats.helpfulVotesReceived}`,
      );

      return {
        userId,
        eventId,
        postsCount: stats.eventPostsCount,
        likesReceivedCount: stats.eventLikesReceived,
        helpfulVotesReceivedCount: stats.helpfulVotesReceived,
      };
    } catch (error) {
      logger.error(
        `Failed to decrement helpful votes for user ${userId} in event ${eventId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Kullanıcının güncel event metriklerini getir
   */
  async getUserMetrics(userId: string, eventId: string): Promise<EventMetrics> {
    try {
      const stats = await this.prisma.eventStats.findUnique({
        where: {
          userId_eventId: {
            userId,
            eventId,
          },
        },
      });

      if (!stats) {
        return {
          userId,
          eventId,
          postsCount: 0,
          likesReceivedCount: 0,
        };
      }

      return {
        userId,
        eventId,
        postsCount: stats.eventPostsCount,
        likesReceivedCount: stats.eventLikesReceived,
      };
    } catch (error) {
      logger.error(`Failed to get metrics for user ${userId} in event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Event leaderboard'unu getir
   */
  async getLeaderboard(eventId: string, limit: number = 50): Promise<Array<{
    userId: string;
    postsCount: number;
    likesReceivedCount: number;
  }>> {
    try {
      const stats = await this.prisma.eventStats.findMany({
        where: {
          eventId,
        },
        orderBy: [
          { eventPostsCount: 'desc' },
          { eventLikesReceived: 'desc' },
        ],
        take: limit,
        select: {
          userId: true,
          eventPostsCount: true,
          eventLikesReceived: true,
        },
      });

      return stats.map((stat) => ({
        userId: stat.userId,
        postsCount: stat.eventPostsCount,
        likesReceivedCount: stat.eventLikesReceived,
      }));
    } catch (error) {
      logger.error(`Failed to get leaderboard for event ${eventId}:`, error);
      throw error;
    }
  }
}
