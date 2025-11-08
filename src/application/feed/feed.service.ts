import { FeedPrismaRepository } from '../../infrastructure/repositories/feed-prisma.repository';
import { ProfilePrismaRepository } from '../../infrastructure/repositories/profile-prisma.repository';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { PrismaClient } from '@prisma/client';
import {
  FeedResponse,
  FeedItem,
  FeedItemType,
  Post,
  BenchmarkPost,
  TipsAndTricksPost,
  FeedFilterOptions,
  BaseUser,
  BaseStats,
  BaseProduct,
  BenchmarkProduct,
  PostProduct,
  TipsAndTricksProduct,
} from '../../interfaces/feed/feed.dto';
import { ContentPostType } from '../../domain/content/content-post-type.enum';
import logger from '../../infrastructure/logger/logger';

export class FeedService {
  private readonly feedRepo: FeedPrismaRepository;
  private readonly profileRepo: ProfilePrismaRepository;
  private readonly cacheService: CacheService;
  private readonly prisma: PrismaClient;

  constructor() {
    this.feedRepo = new FeedPrismaRepository();
    this.profileRepo = new ProfilePrismaRepository();
    this.cacheService = CacheService.getInstance();
    this.prisma = new PrismaClient();
  }

  /**
   * Get User Feed - Kullanıcının feed'ini getirir (performans için cache ve pagination ile)
   */
  async getUserFeed(
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<FeedResponse> {
    const limit = options?.limit || 20;
    const cacheKey = `feed:${userId}:${options?.cursor || 'first'}:${limit}`;

    try {
      // Cache check
      const cached = await this.cacheService.get<FeedResponse>(cacheKey);
      if (cached) {
        logger.info({ message: 'Feed served from cache', userId, cacheKey });
        return cached;
      }
    } catch (error) {
      // Cache error - continue without cache
      logger.warn({ message: 'Cache error', error: error instanceof Error ? error.message : String(error) });
    }

    // Fetch feeds from database
    const { feeds, nextCursor } = await this.feedRepo.findByUserId(userId, {
      limit,
      cursor: options?.cursor,
    });

    // Get all post IDs
    const postIds = feeds.map((feed) => feed.postId);

    if (postIds.length === 0) {
      const emptyResponse: FeedResponse = {
        items: [],
        pagination: {
          hasMore: false,
          limit,
        },
      };
      return emptyResponse;
    }

    // Batch fetch posts with all relations
    const posts = await this.prisma.contentPost.findMany({
      where: { id: { in: postIds } },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        product: {
          include: {
            group: true,
          },
        },
        comparison: {
          include: {
            product1: {
              include: {
                group: true,
              },
            },
            product2: {
              include: {
                group: true,
              },
            },
          },
        },
        question: true,
        tip: true,
        tags: true,
        likes: true,
        comments: true,
        favorites: true,
        contentPostTags: true,
      },
    });

    // Create stats map from denormalized counts in posts
    const statsMap = new Map<string, BaseStats>();
    posts.forEach((post) => {
      statsMap.set(post.id, {
        likes: (post as any).likesCount || 0,
        comments: (post as any).commentsCount || 0,
        shares: 0,
        bookmarks: (post as any).favoritesCount || 0,
      });
    });

    // Get user inventories for benchmark isOwned check
    const inventories = await this.prisma.inventory.findMany({
      where: { userId },
      select: { productId: true },
    });
    const ownedProductIds = new Set(inventories.map((inv) => String(inv.productId)));

    // Batch fetch images for posts (from InventoryMedia)
    const postProductIds = posts.map((p) => p.productId).filter(Boolean) as string[];
    const inventoryMediaMap = new Map<string, string[]>();
    if (postProductIds.length > 0) {
      const inventoriesWithMedia = await this.prisma.inventory.findMany({
        where: {
          userId: { in: posts.map((p) => p.userId) },
          productId: { in: postProductIds },
        },
        include: {
          media: {
            where: { type: 'IMAGE' },
            select: { mediaUrl: true },
          },
        },
      });

      inventoriesWithMedia.forEach((inv) => {
        const key = `${inv.userId}-${inv.productId}`;
        inventoryMediaMap.set(key, inv.media.map((m) => m.mediaUrl));
      });
    }

    // Batch fetch user bases (cache to avoid duplicate calls)
    const userIds = Array.from(new Set(posts.map((p) => p.userId)));
    const userBaseMap = new Map<string, BaseUser>();
    await Promise.all(
      userIds.map(async (uid) => {
        const userBase = await this.getUserBase(String(uid));
        userBaseMap.set(String(uid), userBase);
      })
    );

    // Convert posts to feed items
    const feedItems = await Promise.all(
      posts.map(async (post) => {
        const userBase = userBaseMap.get(String(post.userId)) || (await this.getUserBase(String(post.userId)));
        const stats = statsMap.get(post.id) || { likes: 0, comments: 0, shares: 0, bookmarks: 0 };
        const basePost = {
          id: post.id,
          user: userBase,
          stats,
          createdAt: post.createdAt.toISOString(),
        };

        // Get images for this post
        const postKey = `${post.userId}-${post.productId || ''}`;
        const images = inventoryMediaMap.get(postKey) || [];

        switch (post.type) {
          case ContentPostType.FREE:
            return this.mapToPostItem(post, basePost, FeedItemType.FEED, images);
          case ContentPostType.COMPARE:
            return this.mapToBenchmarkItem(post, basePost, ownedProductIds, images);
          case ContentPostType.QUESTION:
            return this.mapToPostItem(post, basePost, FeedItemType.QUESTION, images);
          case ContentPostType.TIPS:
            return this.mapToTipsAndTricksItem(post, basePost, images);
          default:
            return this.mapToPostItem(post, basePost, FeedItemType.POST, images);
        }
      })
    );

    const response: FeedResponse = {
      items: feedItems,
      pagination: {
        cursor: nextCursor,
        hasMore: !!nextCursor,
        limit,
      },
    };

    // Cache for 1 minute (feed is dynamic)
    try {
      await this.cacheService.set(cacheKey, response, 60);
    } catch (error) {
      // Cache error - continue without caching
    }

    return response;
  }

  /**
   * Get Filtered Feed - Kullanıcının filtrelenmiş feed'ini getirir
   */
  async getFilteredFeed(
    userId: string,
    filters: FeedFilterOptions,
    options?: { cursor?: string; limit?: number }
  ): Promise<FeedResponse> {
    const limit = options?.limit || 20;

    // Build filter query
    const where: any = {};
    const postWhere: any = {};

    if (filters.types && filters.types.length > 0) {
      const contentPostTypes = filters.types.map((type) => {
        switch (type) {
          case FeedItemType.FEED:
          case FeedItemType.POST:
            return ContentPostType.FREE;
          case FeedItemType.BENCHMARK:
            return ContentPostType.COMPARE;
          case FeedItemType.QUESTION:
            return ContentPostType.QUESTION;
          case FeedItemType.TIPS_AND_TRICKS:
            return ContentPostType.TIPS;
          default:
            return null;
        }
      }).filter(Boolean);
      postWhere.type = { in: contentPostTypes };
    }

    if (filters.categoryIds && filters.categoryIds.length > 0) {
      postWhere.OR = [
        { mainCategoryId: { in: filters.categoryIds } },
        { subCategoryId: { in: filters.categoryIds } },
      ];
    }

    if (filters.productIds && filters.productIds.length > 0) {
      postWhere.productId = { in: filters.productIds };
    }

    if (filters.userIds && filters.userIds.length > 0) {
      postWhere.userId = { in: filters.userIds };
    }

    if (filters.dateRange) {
      postWhere.createdAt = {};
      if (filters.dateRange.from) {
        postWhere.createdAt.gte = new Date(filters.dateRange.from);
      }
      if (filters.dateRange.to) {
        postWhere.createdAt.lte = new Date(filters.dateRange.to);
      }
    }

    // Note: minLikes and minComments filtering will be done after fetching stats

    // Fetch feeds with post filters
    const feeds = await this.prisma.feed.findMany({
      where: {
        userId,
        ...(Object.keys(postWhere).length > 0 && {
          post: postWhere,
        }),
      },
      include: {
        post: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
            product: {
              include: {
                group: true,
              },
            },
            comparison: {
              include: {
                product1: {
                  include: {
                    group: true,
                  },
                },
                product2: {
                  include: {
                    group: true,
                  },
                },
              },
            },
            question: true,
            tip: true,
            tags: true,
            likes: true,
            comments: true,
            favorites: true,
            contentPostTags: true,
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

    if (resultFeeds.length === 0) {
      return {
        items: [],
        pagination: {
          hasMore: false,
          limit,
        },
      };
    }

    let posts = resultFeeds.map((feed) => feed.post);
    let postIds = posts.map((p) => p.id);

    // Create stats map from denormalized counts in posts
    const statsMap = new Map<string, BaseStats>();
    posts.forEach((post) => {
      statsMap.set(post.id, {
        likes: (post as any).likesCount || 0,
        comments: (post as any).commentsCount || 0,
        shares: 0,
        bookmarks: (post as any).favoritesCount || 0,
      });
    });

    // Apply minLikes and minComments filters
    let filteredFeeds = resultFeeds;
    if (filters.minLikes || filters.minComments) {
      filteredFeeds = resultFeeds.filter((feed) => {
        const stats = statsMap.get(feed.post.id);
        if (!stats) return false;
        if (filters.minLikes && stats.likes < filters.minLikes) return false;
        if (filters.minComments && stats.comments < filters.minComments) return false;
        return true;
      });
    }

    const inventories = await this.prisma.inventory.findMany({
      where: { userId },
      select: { productId: true },
    });
    const ownedProductIds = new Set(inventories.map((inv) => String(inv.productId)));

    // Update posts and postIds after filtering
    posts = filteredFeeds.map((feed) => feed.post);
    postIds = posts.map((p) => p.id);

    // Batch fetch images
    const postProductIds = posts.map((p) => p.productId).filter(Boolean) as string[];
    const inventoryMediaMap = new Map<string, string[]>();
    if (postProductIds.length > 0) {
      const inventoriesWithMedia = await this.prisma.inventory.findMany({
        where: {
          userId: { in: posts.map((p) => p.userId) },
          productId: { in: postProductIds },
        },
        include: {
          media: {
            where: { type: 'IMAGE' },
            select: { mediaUrl: true },
          },
        },
      });

      inventoriesWithMedia.forEach((inv) => {
        const key = `${inv.userId}-${inv.productId}`;
        inventoryMediaMap.set(key, inv.media.map((m) => m.mediaUrl));
      });
    }

    // Batch fetch user bases
    const userIds = Array.from(new Set(posts.map((p) => p.userId)));
    const userBaseMap = new Map<string, BaseUser>();
    await Promise.all(
      userIds.map(async (uid) => {
        const userBase = await this.getUserBase(String(uid));
        userBaseMap.set(String(uid), userBase);
      })
    );

    const feedItems = await Promise.all(
      posts.map(async (post) => {
        const userBase = userBaseMap.get(String(post.userId)) || (await this.getUserBase(String(post.userId)));
        const stats = statsMap.get(post.id) || { likes: 0, comments: 0, shares: 0, bookmarks: 0 };
        const basePost = {
          id: post.id,
          user: userBase,
          stats,
          createdAt: post.createdAt.toISOString(),
        };

        // Get images for this post
        const postKey = `${post.userId}-${post.productId || ''}`;
        const images = inventoryMediaMap.get(postKey) || [];

        switch (post.type) {
          case ContentPostType.FREE:
            return this.mapToPostItem(post, basePost, FeedItemType.FEED, images);
          case ContentPostType.COMPARE:
            return this.mapToBenchmarkItem(post, basePost, ownedProductIds, images);
          case ContentPostType.QUESTION:
            return this.mapToPostItem(post, basePost, FeedItemType.QUESTION, images);
          case ContentPostType.TIPS:
            return this.mapToTipsAndTricksItem(post, basePost, images);
          default:
            return this.mapToPostItem(post, basePost, FeedItemType.POST, images);
        }
      })
    );

    return {
      items: feedItems,
      pagination: {
        cursor: nextCursor,
        hasMore: !!nextCursor,
        limit,
      },
    };
  }

  // ===== Private Helper Methods =====

  private async getUserBase(userId: string): Promise<BaseUser> {
    const [profile, avatar, title] = await Promise.all([
      this.profileRepo.findByUserId(userId),
      this.prisma.userAvatar.findFirst({ where: { userId, isActive: true } }),
      this.prisma.userTitle.findFirst({ where: { userId }, orderBy: { earnedAt: 'desc' } }),
    ]);

    return {
      id: userId,
      name: profile?.displayName || 'Anonymous',
      title: title?.title || '',
      avatarUrl: avatar?.imageUrl || '',
    };
  }

  private getProductBase(product: any): BaseProduct | null {
    if (!product) return null;
    return {
      id: String(product.id),
      name: product.name,
      subName: product.brand || product.group?.name || '',
      image: null, // TODO: Product image URL
    };
  }

  private mapToPostItem(
    post: any,
    basePost: any,
    type: FeedItemType.FEED | FeedItemType.POST | FeedItemType.QUESTION,
    images: string[] = []
  ): FeedItem {
    const product = this.getProductBase(post.product);
    const postData: Post = {
      ...basePost,
      type,
      product: product ? (product as PostProduct) : null,
      content: post.body,
      images,
    };

    return {
      type,
      data: postData,
    };
  }

  private mapToBenchmarkItem(
    post: any,
    basePost: any,
    ownedProductIds: Set<string>,
    images: string[] = []
  ): FeedItem {
    const comparison = post.comparison;
    if (!comparison) {
      // Fallback to regular post if no comparison
      return this.mapToPostItem(post, basePost, FeedItemType.POST, images);
    }

    const product1 = this.getProductBase(comparison.product1);
    const product2 = this.getProductBase(comparison.product2);

    const products: BenchmarkProduct[] = [];
    if (product1) {
      products.push({
        ...product1,
        isOwned: ownedProductIds.has(product1.id),
        choice: false, // TODO: User'ın seçimini belirle
      });
    }
    if (product2) {
      products.push({
        ...product2,
        isOwned: ownedProductIds.has(product2.id),
        choice: false, // TODO: User'ın seçimini belirle
      });
    }

    const benchmarkData: BenchmarkPost = {
      ...basePost,
      type: FeedItemType.BENCHMARK,
      products,
      content: comparison.comparisonSummary || post.body,
    };

    return {
      type: FeedItemType.BENCHMARK,
      data: benchmarkData,
    };
  }

  private mapToTipsAndTricksItem(post: any, basePost: any, images: string[] = []): FeedItem {
    const product = this.getProductBase(post.product);
    const tip = post.tip;
    const tag = post.tags?.[0]?.tag || post.contentPostTags?.[0]?.tag || '';

    const tipsData: TipsAndTricksPost = {
      ...basePost,
      type: FeedItemType.TIPS_AND_TRICKS,
      product: product ? (product as TipsAndTricksProduct) : null,
      content: post.body,
      tag,
      images,
    };

    return {
      type: FeedItemType.TIPS_AND_TRICKS,
      data: tipsData,
    };
  }
}

