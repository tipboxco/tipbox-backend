import { PrismaClient } from '@prisma/client';
import { Feed } from '../../domain/admin/feed.entity';
import { FeedSource } from '../../domain/admin/feed-source.enum';

export class FeedPrismaRepository {
  private prisma = new PrismaClient();

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
    const feed = await this.prisma.feed.update({
      where: { id: feedId },
      data: { seen: true },
    });
    return feed ? this.toDomain(feed) : null;
  }

  async markMultipleAsSeen(feedIds: string[]): Promise<number> {
    const result = await this.prisma.feed.updateMany({
      where: { id: { in: feedIds } },
      data: { seen: true },
    });
    return result.count;
  }

  async countUnseen(userId: string): Promise<number> {
    return this.prisma.feed.count({
      where: { userId, seen: false },
    });
  }

  async delete(feedId: string): Promise<boolean> {
    try {
      await this.prisma.feed.delete({ where: { id: feedId } });
      return true;
    } catch {
      return false;
    }
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

