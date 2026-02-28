import type { Feed as PrismaFeedModel, Prisma } from '@prisma/client';
import { Feed } from '../../domain/admin/feed.entity';
import { getPrisma } from './prisma.client';
import { FeedSource } from '../../domain/admin/feed-source.enum';

export class FeedPrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<Feed | null> {
    const feed = await this.prisma.feed.findUnique({ where: { id } });
    return feed ? this.toDomain(feed) : null;
  }

  async findByUserId(userId: string, options?: { limit?: number; cursor?: string; seen?: boolean }): Promise<{ feeds: Feed[]; nextCursor?: string }> {
    const limit = options?.limit || 20;
    const where: Prisma.FeedWhereInput = {
      userId,
      // Kullanıcının kendi post'larını feed'inde gösterme
      post: {
        userId: { not: userId }
      }
    };
    
    if (options?.seen !== undefined) {
      where.seen = options.seen;
    }

    const feeds = await this.prisma.feed.findMany({
      where,
      include: {
        post: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
            product: true,
            comparison: {
              include: {
                product1: true,
                product2: true,
              },
            },
            question: true,
            tip: true,
            tags: true,
            likes: true,
            comments: true,
            favorites: true,
          },
        },
      },
      // YENİ SIRALAMA: relevance_score önce (seen penalty ile düşenler aşağıda)
      orderBy: [
        { relevanceScore: 'desc' },
        { post: { isBoosted: 'desc' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit + 1,
      ...(options?.cursor && {
        cursor: { id: options.cursor },
        skip: 1,
      }),
    });

    const hasMore = feeds.length > limit;
    const resultFeeds = hasMore ? feeds.slice(0, limit) : feeds;
    const nextCursor = hasMore && resultFeeds.length > 0 ? resultFeeds[resultFeeds.length - 1].id : undefined;

    return {
      feeds: resultFeeds.map((feed) => this.toDomain(feed)),
      nextCursor,
    };
  }

  async findByPostId(userId: string, postId: string): Promise<Feed | null> {
    const feed = await this.prisma.feed.findFirst({
      where: { userId, postId },
    });
    return feed ? this.toDomain(feed) : null;
  }

  async findByUserIdAndSource(userId: string, source: FeedSource): Promise<Feed[]> {
    const feeds = await this.prisma.feed.findMany({
      where: { userId, source },
      orderBy: { createdAt: 'desc' },
    });
    return feeds.map((feed) => this.toDomain(feed));
  }

  async markAsSeen(feedId: string): Promise<Feed | null> {
    // Get feed to get userId and current score before updating
    const feedBeforeUpdate = await this.prisma.feed.findUnique({
      where: { id: feedId },
      select: { userId: true, seen: true, relevanceScore: true }
    });

    if (!feedBeforeUpdate) return null;

    // Update: seen = true, apply 50% penalty
    const feed = await this.prisma.feed.update({
      where: { id: feedId },
      data: { 
        seen: true,
        relevanceScore: feedBeforeUpdate.relevanceScore * 0.5 // Seen penalty: 50%
      },
    });

    // Decrement unseenFeedCount if feed was previously unseen
    if (feedBeforeUpdate && !feedBeforeUpdate.seen) {
      await this.prisma.profile.updateMany({
        where: { userId: feedBeforeUpdate.userId },
        data: {
          unseenFeedCount: {
            increment: -1
          }
        }
      });
    }

    return feed ? this.toDomain(feed) : null;
  }

  async markMultipleAsSeen(feedIds: string[]): Promise<number> {
    if (feedIds.length === 0) return 0;

    // Get feeds to get userIds and current scores before updating
    const feedsBeforeUpdate = await this.prisma.feed.findMany({
      where: { id: { in: feedIds } },
      select: { id: true, userId: true, seen: true, relevanceScore: true }
    });

    // Update feeds: seen = true, relevanceScore = relevanceScore * 0.5 (batch)
    const updatePromises = feedsBeforeUpdate.map((feed) => {
      return this.prisma.feed.update({
        where: { id: feed.id },
        data: {
          seen: true,
          relevanceScore: feed.relevanceScore * 0.5, // Seen penalty: 50%
        },
      });
    });

    await Promise.all(updatePromises);

    // Count unseen feeds per user and decrement their unseenFeedCount
    const unseenCountsByUser = new Map<string, number>();
    feedsBeforeUpdate.forEach(feed => {
      if (!feed.seen) {
        const current = unseenCountsByUser.get(feed.userId) || 0;
        unseenCountsByUser.set(feed.userId, current + 1);
      }
    });

    // Update each user's unseenFeedCount
    for (const [userId, count] of unseenCountsByUser.entries()) {
      await this.prisma.profile.updateMany({
        where: { userId },
        data: {
          unseenFeedCount: {
            increment: -count
          }
        }
      });
    }

    return feedsBeforeUpdate.length;
  }

  async countUnseen(userId: string): Promise<number> {
    // Use denormalized count from Profile table
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { unseenFeedCount: true }
    });
    return profile?.unseenFeedCount || 0;
  }

  async delete(feedId: string): Promise<boolean> {
    try {
      await this.prisma.feed.delete({ where: { id: feedId } });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Feed oluşturulduğunda unseenFeedCount'u artırmak için kullanılır
   * Feed oluşturma işlemlerinden sonra bu metod çağrılmalıdır
   */
  async incrementUnseenFeedCount(userId: string): Promise<void> {
    await this.prisma.profile.updateMany({
      where: { userId },
      data: {
        unseenFeedCount: {
          increment: 1
        }
      }
    });
  }

  /**
   * User feedback'e göre feed score'unu güncelle
   * 
   * @param feedId - Feed ID
   * @param multiplier - Score multiplier (örn: 0.3 = %30'a düş)
   * @param increment - Score increment (örn: 10 = +10 puan)
   */
  async updateScoreByFeedback(
    feedId: string,
    multiplier?: number | null,
    increment?: number | null
  ): Promise<void> {
    const feed = await this.prisma.feed.findUnique({
      where: { id: feedId },
      select: { relevanceScore: true },
    });

    if (!feed) return;

    let newScore = feed.relevanceScore;

    if (multiplier !== null && multiplier !== undefined) {
      newScore = newScore * multiplier;
    }

    if (increment !== null && increment !== undefined) {
      newScore = newScore + increment;
    }

    // Min 0, Max 120 (safeguard)
    newScore = Math.max(0, Math.min(120, newScore));

    await this.prisma.feed.update({
      where: { id: feedId },
      data: { relevanceScore: newScore },
    });
  }

  private toDomain(prismaFeed: PrismaFeedModel): Feed {
    return new Feed(
      prismaFeed.id,
      prismaFeed.userId,
      prismaFeed.postId,
      prismaFeed.source as FeedSource,
      prismaFeed.seen,
      prismaFeed.relevanceScore || 0,
      prismaFeed.createdAt,
      prismaFeed.updatedAt
    );
  }
}

