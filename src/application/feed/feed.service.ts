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
  ContextData,
} from '../../interfaces/feed/feed.dto';
import { ContextType } from '../../domain/content/context-type.enum';
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

    if (feeds.length === 0) {
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
      where: { id: { in: feeds.map((feed) => feed.postId) } },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        product: {
          include: {
            group: {
              include: {
                subCategory: {
                  include: {
                    mainCategory: true,
                  },
                },
              },
            },
          },
        },
        productGroup: {
          include: {
            subCategory: {
              include: {
                mainCategory: true,
              },
            },
          },
        },
        subCategory: {
          include: {
            mainCategory: true,
          },
        },
        mainCategory: true,
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
            scores: true,
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
        shares: (post as any).sharesCount || 0,
        bookmarks: (post as any).favoritesCount || 0,
      });
    });

    const orderedPosts = this.sortPostsByCreatedAt(posts);

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
      orderedPosts.map(async (post) => {
        const userBase = userBaseMap.get(String(post.userId)) || (await this.getUserBase(String(post.userId)));
        const stats = statsMap.get(post.id) || { likes: 0, comments: 0, shares: 0, bookmarks: 0 };
        const basePost = {
          id: post.id,
          user: userBase,
          stats,
          createdAt: post.createdAt.toISOString(),
          contextType: this.mapContextType(post),
        };

        // Get images for this post
        const postKey = `${post.userId}-${post.productId || ''}`;
        const images = inventoryMediaMap.get(postKey) || [];

        switch (post.type) {
          case ContentPostType.FREE:
            return this.mapToPostItem(post, basePost, FeedItemType.FEED, images, ownedProductIds);
          case ContentPostType.COMPARE:
            return this.mapToBenchmarkItem(post, basePost, ownedProductIds, images);
          case ContentPostType.QUESTION:
            return this.mapToPostItem(post, basePost, FeedItemType.QUESTION, images, ownedProductIds);
          case ContentPostType.TIPS:
            return this.mapToTipsAndTricksItem(post, basePost, images, ownedProductIds);
          default:
            return this.mapToPostItem(post, basePost, FeedItemType.POST, images, ownedProductIds);
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
    const limit = options?.limit ?? 20;

    // Build filter query
    const postWhere: any = {};

    // Merge category + interests into a single category filter
    const mergedCategoryIds = new Set<string>();
    if (filters.category) {
      mergedCategoryIds.add(filters.category);
    }
    if (filters.interests && filters.interests.length > 0) {
      filters.interests.forEach((id) => mergedCategoryIds.add(id));
    }

    if (mergedCategoryIds.size > 0) {
      const categoryArray = Array.from(mergedCategoryIds);
      postWhere.OR = [
        { mainCategoryId: { in: categoryArray } },
        { subCategoryId: { in: categoryArray } },
      ];
    }

    if (filters.productIds && filters.productIds.length > 0) {
      postWhere.productId = { in: filters.productIds };
    }

    if (filters.userIds && filters.userIds.length > 0) {
      postWhere.userId = { in: filters.userIds };
    }

    // Tag-based filtering (contentPostTags or tags relations)
    if (filters.tags && filters.tags.length > 0) {
      (postWhere.AND ||= []).push({
        OR: [
          { contentPostTags: { some: { tag: { in: filters.tags } } } },
          { tags: { some: { tag: { in: filters.tags } } } },
        ],
      });
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
    const orderBy =
      filters.sort === 'top'
        ? [
            { post: { likesCount: 'desc' as const } },
            { post: { viewsCount: 'desc' as const } },
            { createdAt: 'desc' as const },
          ]
        : [
            { post: { isBoosted: 'desc' as const } },
            { createdAt: 'desc' as const },
          ];

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
                group: {
                  include: {
                    subCategory: {
                      include: {
                        mainCategory: true,
                      },
                    },
                  },
                },
              },
            },
            productGroup: {
              include: {
                subCategory: {
                  include: {
                    mainCategory: true,
                  },
                },
              },
            },
            subCategory: {
              include: {
                mainCategory: true,
              },
            },
            mainCategory: true,
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
                scores: true,
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
      orderBy,
      take: limit + 1,
      ...(options?.cursor && {
        cursor: { id: options.cursor },
        skip: 1,
      }),
    });

    const hasMoreFromDb = feeds.length > limit;
    const resultFeeds = hasMoreFromDb ? feeds.slice(0, limit) : feeds;
    const nextCursor =
      hasMoreFromDb && resultFeeds.length > 0 ? resultFeeds[resultFeeds.length - 1].id : undefined;

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

    // Create stats map from denormalized counts in posts
    const statsMap = new Map<string, BaseStats>();
    posts.forEach((post) => {
      statsMap.set(post.id, {
        likes: (post as any).likesCount || 0,
        comments: (post as any).commentsCount || 0,
        shares: (post as any).sharesCount || 0,
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

    let feedItems = await Promise.all(
      posts.map(async (post) => {
        const userBase = userBaseMap.get(String(post.userId)) || (await this.getUserBase(String(post.userId)));
        const stats = statsMap.get(post.id) || { likes: 0, comments: 0, shares: 0, bookmarks: 0 };
        const basePost = {
          id: post.id,
          user: userBase,
          stats,
          createdAt: post.createdAt.toISOString(),
          contextType: this.mapContextType(post),
        };

        // Get images for this post
        const postKey = `${post.userId}-${post.productId || ''}`;
        const images = inventoryMediaMap.get(postKey) || [];

        switch (post.type) {
          case ContentPostType.FREE:
            return this.mapToPostItem(post, basePost, FeedItemType.FEED, images, ownedProductIds);
          case ContentPostType.COMPARE:
            return this.mapToBenchmarkItem(post, basePost, ownedProductIds, images);
          case ContentPostType.QUESTION:
            return this.mapToPostItem(post, basePost, FeedItemType.QUESTION, images, ownedProductIds);
          case ContentPostType.TIPS:
            return this.mapToTipsAndTricksItem(post, basePost, images, ownedProductIds);
          default:
            return this.mapToPostItem(post, basePost, FeedItemType.POST, images, ownedProductIds);
        }
      })
    );

    if (filters.types && filters.types.length > 0) {
      feedItems = this.prioritizeFeedItemsByType(feedItems, filters.types, 20);
    }

    const limitedItems = feedItems.slice(0, limit);
    const finalHasMore = hasMoreFromDb || feedItems.length > limit;

    return {
      items: limitedItems,
      pagination: {
        cursor: finalHasMore ? nextCursor : undefined,
        hasMore: finalHasMore,
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
      avatar: avatar?.imageUrl || '',
    };
  }

  private getProductBase(product: any): BaseProduct | null {
    if (!product) return null;
    return {
      id: String(product.id),
      name: product.name,
      subName: product.brand || product.group?.name || '',
      image: product.imageUrl || null,
    };
  }

  private mapContextType(post: any): ContextType {
    if (post?.productId) {
      return 'product' as ContextType;
    }
    if (post?.productGroupId) {
      return 'product_group' as ContextType;
    }
    return 'sub_category' as ContextType;
  }

  /**
   * Kart header / navigasyon için context bilgisini oluşturur.
   */
  private buildContextData(post: any, ownedProductIds?: Set<string>): ContextData {
    const contextType = this.mapContextType(post);

    if (contextType === ContextType.PRODUCT && post.product) {
      const product = post.product;
      const group = product.group;
      const subCategory = group?.subCategory;

      const base: ContextData = {
        id: String(product.id),
        name: product.name,
        subName: group?.name || subCategory?.name || '',
        image: product.imageUrl || null,
        isOwned: ownedProductIds ? ownedProductIds.has(String(product.id)) : undefined,
      };

      // isOwned bilgisi sadece PRODUCT context'inde ve inventorde sahiplik bilgimiz varsa anlamlı.
      // Şu an için burada set etmiyoruz; ileride user inventory bilgisi geçirildiğinde doldurulabilir.
      return base;
    }

    if (contextType === ContextType.PRODUCT_GROUP) {
      const group = post.productGroup;
      if (group) {
        const subCategory = group.subCategory;
        return {
          id: String(group.id),
          name: group.name,
          subName: subCategory?.name || '',
          image: group.imageUrl || subCategory?.imageUrl || subCategory?.mainCategory?.imageUrl || null,
        };
      }

      return {
        id: post.productGroupId ? String(post.productGroupId) : 'unknown',
        name: '',
        subName: '',
        image: null,
      };
    }

    // SUB_CATEGORIES (fallback olarak mainCategory bilgisini de kullan)
    if (post.subCategory) {
      const subCategory = post.subCategory;
      return {
        id: String(subCategory.id),
        name: subCategory.name,
        subName: subCategory.mainCategory?.name || '',
        image: subCategory.imageUrl || subCategory.mainCategory?.imageUrl || null,
      };
    }

    if (post.mainCategory) {
      return {
        id: String(post.mainCategory.id),
        name: post.mainCategory.name,
        subName: '',
        image: post.mainCategory.imageUrl || null,
      };
    }

    return {
      id: post.subCategoryId ? String(post.subCategoryId) : 'unknown',
      name: '',
      subName: '',
      image: null,
    };
  }

  private prioritizeFeedItemsByType(
    items: FeedItem[],
    types: FeedItemType[],
    perTypeTarget: number
  ): FeedItem[] {
    const counters = new Map<FeedItemType, number>();
    const prioritized: FeedItem[] = [];
    const leftovers: FeedItem[] = [];

    for (const item of items) {
      if (types.includes(item.type)) {
        const currentCount = counters.get(item.type) ?? 0;
        if (currentCount < perTypeTarget) {
          prioritized.push(item);
          counters.set(item.type, currentCount + 1);
          continue;
        }
      }
      leftovers.push(item);
    }

    return this.sortFeedItemsByTimestamp([...prioritized, ...leftovers]);
  }

  private sortPostsByCreatedAt<T extends { createdAt?: Date | string }>(items: T[]): T[] {
    const toTime = (value?: Date | string): number => {
      if (!value) return 0;
      if (value instanceof Date) return value.getTime();
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    return [...items].sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
  }

  private sortFeedItemsByTimestamp(items: FeedItem[]): FeedItem[] {
    const toTime = (item: FeedItem): number => {
      const value = item?.data?.createdAt;
      if (!value) return 0;
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    return [...items].sort((a, b) => toTime(b) - toTime(a));
  }

  private mapToPostItem(
    post: any,
    basePost: any,
    type: FeedItemType.FEED | FeedItemType.POST | FeedItemType.QUESTION,
    images: string[] = [],
    ownedProductIds?: Set<string>
  ): FeedItem {
    const contextData = this.buildContextData(post, ownedProductIds);
    const postData: Post = {
      ...basePost,
      type,
      contextData,
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
      return this.mapToPostItem(post, basePost, FeedItemType.POST, images, ownedProductIds);
    }

    const product1 = this.getProductBase(comparison.product1);
    const product2 = this.getProductBase(comparison.product2);
    const choiceProductId = this.selectComparisonWinner(comparison);

    const products: BenchmarkProduct[] = [];
    if (product1) {
      products.push({
        ...product1,
        isOwned: ownedProductIds.has(product1.id),
        choice: choiceProductId
          ? choiceProductId === String(comparison.product1Id)
          : true,
      });
    }
    if (product2) {
      products.push({
        ...product2,
        isOwned: ownedProductIds.has(product2.id),
        choice: choiceProductId
          ? choiceProductId === String(comparison.product2Id)
          : false,
      });
    }

    const benchmarkData: BenchmarkPost = {
      ...basePost,
      type: FeedItemType.BENCHMARK,
      contextData: this.buildContextData(post, ownedProductIds),
      products,
      content: comparison.comparisonSummary || post.body,
    };

    return {
      type: FeedItemType.BENCHMARK,
      data: benchmarkData,
    };
  }

  private mapToTipsAndTricksItem(
    post: any,
    basePost: any,
    images: string[] = [],
    ownedProductIds?: Set<string>
  ): FeedItem {
    const tag = post.tags?.[0]?.tag || post.contentPostTags?.[0]?.tag || '';

    const tipsData: TipsAndTricksPost = {
      ...basePost,
      type: FeedItemType.TIPS_AND_TRICKS,
      contextData: this.buildContextData(post, ownedProductIds),
      content: post.body,
      tag,
      images,
    };

    return {
      type: FeedItemType.TIPS_AND_TRICKS,
      data: tipsData,
    };
  }

  private selectComparisonWinner(
    comparison?: {
      product1Id?: string | null;
      product2Id?: string | null;
      scores?: Array<{ scoreProduct1?: number | null; scoreProduct2?: number | null }>;
    }
  ): string | null {
    if (!comparison || !comparison.scores || comparison.scores.length === 0) {
      return null;
    }

    let product1Score = 0;
    let product2Score = 0;

    for (const score of comparison.scores) {
      product1Score += score.scoreProduct1 ?? 0;
      product2Score += score.scoreProduct2 ?? 0;
    }

    if (product1Score === product2Score) {
      return comparison.product1Id ? String(comparison.product1Id) : null;
    }

    return product1Score > product2Score
      ? (comparison.product1Id ? String(comparison.product1Id) : null)
      : (comparison.product2Id ? String(comparison.product2Id) : null);
  }
}

