import { PrismaClient } from '@prisma/client';
import logger from '../../infrastructure/logger/logger';

export interface CleanupStats {
  deletedCount: number;
  affectedUsers: number;
  deletedBySeen: {
    seen: number;
    unseen: number;
  };
  deletedByReason: {
    lowScore: number;
    timeWindow: number;
    userLimit: number;
  };
  duration: number;
}

export class FeedCleanupService {
  private readonly prisma: PrismaClient;

  // Configurable thresholds
  private readonly CONFIG = {
    MAX_FEEDS_PER_USER: 2000,
    UNSEEN_CLEANUP_THRESHOLD: 2.5,
    SEEN_CLEANUP_THRESHOLD: 1.5,
    TIME_WINDOW_DAYS: 14,
    BATCH_SIZE: 1000,
  };

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Ana cleanup metodu: Düşük score'lu ve eski feed'leri temizler
   */
  async cleanupLowScoreFeeds(): Promise<CleanupStats> {
    const startTime = Date.now();
    let totalDeleted = 0;
    const affectedUserIds = new Set<string>();
    const stats = {
      deletedCount: 0,
      affectedUsers: 0,
      deletedBySeen: { seen: 0, unseen: 0 },
      deletedByReason: { lowScore: 0, timeWindow: 0, userLimit: 0 },
      duration: 0,
    };

    try {
      logger.info({ message: 'Starting feed cleanup' });

      // 1. Kullanıcı başına limit kontrolü
      const limitStats = await this.cleanupUserLimits();
      stats.deletedByReason.userLimit = limitStats.deletedCount;
      totalDeleted += limitStats.deletedCount;
      limitStats.affectedUsers.forEach(id => affectedUserIds.add(id));

      // 2. Düşük score'lu unseen feed'ler
      const unseenStats = await this.cleanupUnseenLowScore();
      stats.deletedBySeen.unseen = unseenStats.deletedCount;
      stats.deletedByReason.lowScore += unseenStats.deletedCount;
      totalDeleted += unseenStats.deletedCount;
      unseenStats.affectedUsers.forEach(id => affectedUserIds.add(id));

      // 3. Düşük score'lu seen feed'ler (daha agresif)
      const seenStats = await this.cleanupSeenLowScore();
      stats.deletedBySeen.seen = seenStats.deletedCount;
      stats.deletedByReason.lowScore += seenStats.deletedCount;
      totalDeleted += seenStats.deletedCount;
      seenStats.affectedUsers.forEach(id => affectedUserIds.add(id));

      // 4. Time window dışındaki feed'ler
      const timeWindowStats = await this.cleanupOldFeeds();
      stats.deletedByReason.timeWindow = timeWindowStats.deletedCount;
      totalDeleted += timeWindowStats.deletedCount;
      timeWindowStats.affectedUsers.forEach(id => affectedUserIds.add(id));

      stats.deletedCount = totalDeleted;
      stats.affectedUsers = affectedUserIds.size;
      stats.duration = Date.now() - startTime;

      logger.info({
        message: 'Feed cleanup completed',
        stats,
      });

      return stats;
    } catch (error) {
      logger.error({ message: 'Feed cleanup failed', error });
      throw error;
    }
  }

  /**
   * Kullanıcı başına feed limit kontrolü (max 2000)
   */
  private async cleanupUserLimits(): Promise<{ deletedCount: number; affectedUsers: Set<string> }> {
    let totalDeleted = 0;
    const affectedUsers = new Set<string>();

    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    for (const user of users) {
      const feedCount = await this.prisma.feed.count({
        where: { userId: user.id },
      });

      if (feedCount > this.CONFIG.MAX_FEEDS_PER_USER) {
        const excessCount = feedCount - this.CONFIG.MAX_FEEDS_PER_USER;

        // En düşük score'lu ve en eski feed'leri sil
        const feedsToDelete = await this.prisma.feed.findMany({
          where: { userId: user.id },
          orderBy: [
            { relevanceScore: 'asc' },
            { createdAt: 'asc' },
          ],
          take: excessCount,
          select: { id: true },
        });

        if (feedsToDelete.length > 0) {
          await this.prisma.feed.deleteMany({
            where: { id: { in: feedsToDelete.map(f => f.id) } },
          });

          totalDeleted += feedsToDelete.length;
          affectedUsers.add(user.id);

          logger.info({
            message: 'User feed limit cleanup',
            userId: user.id,
            deletedCount: feedsToDelete.length,
          });
        }
      }
    }

    return { deletedCount: totalDeleted, affectedUsers };
  }

  /**
   * Düşük score'lu unseen feed'leri temizle (< 2.5)
   */
  private async cleanupUnseenLowScore(): Promise<{ deletedCount: number; affectedUsers: Set<string> }> {
    const affectedUsers = new Set<string>();
    let totalDeleted = 0;
    let hasMore = true;

    while (hasMore) {
      const feedsToDelete = await this.prisma.feed.findMany({
        where: {
          seen: false,
          relevanceScore: { lt: this.CONFIG.UNSEEN_CLEANUP_THRESHOLD },
        },
        select: { id: true, userId: true },
        take: this.CONFIG.BATCH_SIZE,
      });

      if (feedsToDelete.length === 0) {
        hasMore = false;
        break;
      }

      const deleted = await this.prisma.feed.deleteMany({
        where: { id: { in: feedsToDelete.map(f => f.id) } },
      });

      totalDeleted += deleted.count;
      feedsToDelete.forEach(f => affectedUsers.add(f.userId));

      logger.info({
        message: 'Unseen low score feeds deleted',
        batchSize: deleted.count,
      });

      if (feedsToDelete.length < this.CONFIG.BATCH_SIZE) {
        hasMore = false;
      }
    }

    return { deletedCount: totalDeleted, affectedUsers };
  }

  /**
   * Düşük score'lu seen feed'leri temizle (< 1.5, daha agresif)
   */
  private async cleanupSeenLowScore(): Promise<{ deletedCount: number; affectedUsers: Set<string> }> {
    const affectedUsers = new Set<string>();
    let totalDeleted = 0;
    let hasMore = true;

    while (hasMore) {
      const feedsToDelete = await this.prisma.feed.findMany({
        where: {
          seen: true,
          relevanceScore: { lt: this.CONFIG.SEEN_CLEANUP_THRESHOLD },
        },
        select: { id: true, userId: true },
        take: this.CONFIG.BATCH_SIZE,
      });

      if (feedsToDelete.length === 0) {
        hasMore = false;
        break;
      }

      const deleted = await this.prisma.feed.deleteMany({
        where: { id: { in: feedsToDelete.map(f => f.id) } },
      });

      totalDeleted += deleted.count;
      feedsToDelete.forEach(f => affectedUsers.add(f.userId));

      logger.info({
        message: 'Seen low score feeds deleted',
        batchSize: deleted.count,
      });

      if (feedsToDelete.length < this.CONFIG.BATCH_SIZE) {
        hasMore = false;
      }
    }

    return { deletedCount: totalDeleted, affectedUsers };
  }

  /**
   * Time window dışındaki feed'leri temizle (14+ gün eski)
   */
  private async cleanupOldFeeds(): Promise<{ deletedCount: number; affectedUsers: Set<string> }> {
    const affectedUsers = new Set<string>();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.CONFIG.TIME_WINDOW_DAYS);

    let totalDeleted = 0;
    let hasMore = true;

    while (hasMore) {
      const feedsToDelete = await this.prisma.feed.findMany({
        where: {
          createdAt: { lt: cutoffDate },
          relevanceScore: { lt: 10 }, // Sadece düşük score'lu eski feed'ler
        },
        select: { id: true, userId: true },
        take: this.CONFIG.BATCH_SIZE,
      });

      if (feedsToDelete.length === 0) {
        hasMore = false;
        break;
      }

      const deleted = await this.prisma.feed.deleteMany({
        where: { id: { in: feedsToDelete.map(f => f.id) } },
      });

      totalDeleted += deleted.count;
      feedsToDelete.forEach(f => affectedUsers.add(f.userId));

      logger.info({
        message: 'Old feeds deleted',
        batchSize: deleted.count,
        cutoffDate: cutoffDate.toISOString(),
      });

      if (feedsToDelete.length < this.CONFIG.BATCH_SIZE) {
        hasMore = false;
      }
    }

    return { deletedCount: totalDeleted, affectedUsers };
  }

  /**
   * Belirli bir kullanıcının feed'lerini optimize et
   */
  async optimizeUserFeeds(userId: string): Promise<number> {
    const feedCount = await this.prisma.feed.count({
      where: { userId },
    });

    if (feedCount <= this.CONFIG.MAX_FEEDS_PER_USER) {
      return 0;
    }

    const excessCount = feedCount - this.CONFIG.MAX_FEEDS_PER_USER;

    const feedsToDelete = await this.prisma.feed.findMany({
      where: { userId },
      orderBy: [
        { relevanceScore: 'asc' },
        { createdAt: 'asc' },
      ],
      take: excessCount,
      select: { id: true },
    });

    if (feedsToDelete.length > 0) {
      await this.prisma.feed.deleteMany({
        where: { id: { in: feedsToDelete.map(f => f.id) } },
      });
    }

    return feedsToDelete.length;
  }
}

