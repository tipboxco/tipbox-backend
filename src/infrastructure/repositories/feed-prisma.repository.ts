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
    const where: any = { userId };
    
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
      orderBy: [
        { post: { isBoosted: 'desc' } },
        { createdAt: 'desc' },
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

  async findByUserIdAndSource(userId: string, source: FeedSource): Promise<Feed[]> {
    const feeds = await this.prisma.feed.findMany({
      where: { userId, source },
      orderBy: { createdAt: 'desc' },
    });
    return feeds.map((feed) => this.toDomain(feed));
  }

  async markAsSeen(feedId: string): Promise<Feed | null> {
    // Get feed to get userId before updating
    const feedBeforeUpdate = await this.prisma.feed.findUnique({
      where: { id: feedId },
      select: { userId: true, seen: true }
    });

    const feed = await this.prisma.feed.update({
      where: { id: feedId },
      data: { seen: true },
    });

    // Decrement unseenFeedCount if feed was previously unseen
    if (feedBeforeUpdate && !feedBeforeUpdate.seen) {
      await this.prisma.profile.updateMany({
        where: { userId: feedBeforeUpdate.userId },
        data: {
          unseenFeedCount: {
            increment: -1
          }
        } as any
      });
    }

    return feed ? this.toDomain(feed) : null;
  }

  async markMultipleAsSeen(feedIds: string[]): Promise<number> {
    // Get feeds to get userIds before updating
    const feedsBeforeUpdate = await this.prisma.feed.findMany({
      where: { id: { in: feedIds } },
      select: { userId: true, seen: true }
    });

    const result = await this.prisma.feed.updateMany({
      where: { id: { in: feedIds } },
      data: { seen: true },
    });

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
        } as any
      });
    }

    return result.count;
  }

  async countUnseen(userId: string): Promise<number> {
    // Use denormalized count from Profile table
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { unseenFeedCount: true } as any
    });
    return (profile as any)?.unseenFeedCount || 0;
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
      } as any
    });
  }

  private toDomain(prismaFeed: any): Feed {
    return new Feed(
      prismaFeed.id,
      prismaFeed.userId,
      prismaFeed.postId,
      prismaFeed.source as FeedSource,
      prismaFeed.seen,
      prismaFeed.createdAt,
      prismaFeed.updatedAt
    );
  }
}

