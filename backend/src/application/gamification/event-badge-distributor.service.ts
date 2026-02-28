import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { GamificationService } from './gamification.service';
import logger from '../../infrastructure/logger/logger';

/**
 * Event Badge Distributor Service
 *
 * Handles distribution of event badges based on upvote (helpfulVotesReceived) ranking.
 * This service is triggered when an event ends.
 *
 * Mechanism:
 * 1. Fetches EventBadges for the event ordered by rank (1, 2, 3)
 * 2. Gets EventStats ordered by helpfulVotesReceived descending
 * 3. Awards badges to top 1-3 users based on rank
 *
 * Tiebreaker: If multiple users have the same helpfulVotesReceived count,
 * the user with earlier participation (EventStats.createdAt) wins.
 */
export class EventBadgeDistributorService {
  private prisma: ReturnType<typeof getPrisma>;
  private gamificationService: GamificationService;

  constructor() {
    this.prisma = getPrisma();
    this.gamificationService = new GamificationService();
  }

  /**
   * Distribute event badges to top users based on upvote ranking
   * @param eventId - The event ID
   * @returns Number of badges distributed
   */
  async distributeEventBadges(eventId: string): Promise<number> {
    try {
      logger.info(`Starting event badge distribution for event ${eventId}`);

      // 1. Check if event exists and has ended
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          title: true,
          endDate: true,
          status: true,
        },
      });

      if (!event) {
        logger.warn(`Event ${eventId} not found, skipping badge distribution`);
        return 0;
      }

      const now = new Date();
      if (event.endDate > now) {
        logger.warn(`Event ${eventId} has not ended yet, skipping badge distribution`);
        return 0;
      }

      // 2. Get EventBadges ordered by rank (1, 2, 3)
      const eventBadges = await this.prisma.eventBadge.findMany({
        where: {
          eventId,
          enabled: true,
        },
        orderBy: {
          rank: 'asc',
        },
        include: {
          badge: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (eventBadges.length === 0) {
        logger.info(`No event badges configured for event ${eventId}`);
        return 0;
      }

      logger.info(`Found ${eventBadges.length} event badges for distribution`);

      // 3. Get top users ordered by helpfulVotesReceived
      // Tiebreaker: createdAt (earlier participation wins)
      const topUsers = await this.prisma.eventStats.findMany({
        where: {
          eventId,
        },
        orderBy: [
          { helpfulVotesReceived: 'desc' },
          { createdAt: 'asc' }, // Tiebreaker
        ],
        take: eventBadges.length, // Only get as many users as we have badges
        include: {
          user: {
            select: {
              id: true,
              profile: { select: { displayName: true, userName: true } },
            },
          },
        },
      });

      if (topUsers.length === 0) {
        logger.info(`No users participated in event ${eventId}`);
        return 0;
      }

      logger.info(`Found ${topUsers.length} users eligible for badges`);

      // 4. Award badges to top users
      let badgesDistributed = 0;

      for (let i = 0; i < eventBadges.length && i < topUsers.length; i++) {
        const eventBadge = eventBadges[i];
        const userStats = topUsers[i];
        const userId = userStats.userId;
        const badgeId = eventBadge.badgeId;

        try {
          // Check if user already has this badge
          const existingBadge = await this.prisma.userBadge.findUnique({
            where: {
              userId_badgeId: {
                userId,
                badgeId,
              },
            },
          });

          if (existingBadge) {
            logger.info(
              `User ${userId} already has badge ${badgeId}, skipping`
            );
            continue;
          }

          // Award badge
          await this.gamificationService.grantBadgeToUser(userId, badgeId);

          const userName = userStats.user.profile?.displayName || userStats.user.profile?.userName || 'Unknown';
          logger.info(
            `Badge "${eventBadge.badge.name}" (rank ${eventBadge.rank}) awarded to user ${userName} ` +
            `(${userStats.helpfulVotesReceived} upvotes) for event "${event.title}"`
          );

          badgesDistributed++;
        } catch (error) {
          logger.error(
            `Failed to award badge ${badgeId} to user ${userId} for event ${eventId}:`,
            error
          );
          // Continue with other badges even if one fails
        }
      }

      logger.info(
        `Event badge distribution completed for event ${eventId}. ` +
        `Distributed ${badgesDistributed} badges.`
      );

      return badgesDistributed;
    } catch (error) {
      logger.error(`Failed to distribute event badges for event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Get event badge leaderboard preview
   * Shows current standings without awarding badges
   * @param eventId - The event ID
   * @param limit - Number of top users to return (default: 10)
   */
  async getEventBadgeLeaderboard(
    eventId: string,
    limit: number = 10
  ): Promise<Array<{
    userId: string;
    userName: string;
    helpfulVotesReceived: number;
    rank: number;
  }>> {
    try {
      const topUsers = await this.prisma.eventStats.findMany({
        where: {
          eventId,
        },
        orderBy: [
          { helpfulVotesReceived: 'desc' },
          { createdAt: 'asc' },
        ],
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              profile: { select: { displayName: true, userName: true } },
            },
          },
        },
      });

      return topUsers.map((stats, index) => ({
        userId: stats.userId,
        userName: stats.user.profile?.displayName || stats.user.profile?.userName || 'Unknown',
        helpfulVotesReceived: stats.helpfulVotesReceived,
        rank: index + 1,
      }));
    } catch (error) {
      logger.error(`Failed to get event badge leaderboard for event ${eventId}:`, error);
      return [];
    }
  }

  /**
   * Schedule badge distribution for an event
   * Can be called by a cron job or triggered manually
   * @param eventId - The event ID
   */
  async scheduleEventBadgeDistribution(eventId: string): Promise<void> {
    try {
      // This method can be enhanced to use a job queue (Bull, BullMQ, etc.)
      // For now, it directly calls the distribution method
      await this.distributeEventBadges(eventId);
    } catch (error) {
      logger.error(`Failed to schedule event badge distribution for event ${eventId}:`, error);
      throw error;
    }
  }
}
