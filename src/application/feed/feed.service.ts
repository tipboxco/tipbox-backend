import { FeedPrismaRepository } from '../../infrastructure/repositories/feed-prisma.repository';
import { ProfilePrismaRepository } from '../../infrastructure/repositories/profile-prisma.repository';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import { PrismaClient } from '@prisma/client';
import {
  FeedResponse,
  FeedItem,
  FeedItemType,
  Post,
  BenchmarkPost,
  TipsAndTricksPost,
  ExperiencePost,
  ExperienceContent,
  ReviewProduct,
  FeedFilterOptions,
  BaseUser,
  BaseStats,
  BaseProduct,
  BenchmarkProduct,
  ContextData,
} from '../../interfaces/feed/feed.dto';
import { ContextType } from '../../domain/content/context-type.enum';
import { ContentPostType } from '../../domain/content/content-post-type.enum';
import { FeedSource } from '../../domain/admin/feed-source.enum';
import { generateIdForModel } from '../../infrastructure/ids/id.strategy';
import logger from '../../infrastructure/logger/logger';
import { FeedScoringService } from './feed-scoring.service';
import { FeedCleanupScheduler } from '../../infrastructure/scheduler/feed-cleanup.scheduler';

export class FeedService {
  private readonly feedRepo: FeedPrismaRepository;
  private readonly profileRepo: ProfilePrismaRepository;
  private readonly cacheService: CacheService;
  private readonly prisma: PrismaClient;
  private readonly scoringService: FeedScoringService;
  private readonly cleanupScheduler: FeedCleanupScheduler;
  
  // Post counter for batch scoring
  private postCounter: number = 0;

  constructor() {
    this.feedRepo = new FeedPrismaRepository();
    this.profileRepo = new ProfilePrismaRepository();
    this.cacheService = CacheService.getInstance();
    this.prisma = new PrismaClient();
    this.scoringService = new FeedScoringService();
    this.cleanupScheduler = new FeedCleanupScheduler();
  }

  /**
   * Media path'ini tam URL'ye çevirir
   * resolveMediaUrl kullanarak doğru formatı garanti eder
   */
  private buildFullMediaUrl(path: string | null | undefined): string | null {
    return resolveMediaUrl(path);
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

    // Cursor olarak item (post) ID bekleniyor. Repository ise feed.id ile paginate ediyor.
    // Bu nedenle gelen cursor'ı feed.id'ye çeviriyoruz.
    let feedCursor: string | undefined = undefined;
    if (options?.cursor) {
      const cursorFeed = await this.feedRepo.findByPostId(userId, options.cursor);
      feedCursor = cursorFeed?.id;
    }

    try {
      // Cache check (otomatik olarak cache hit/miss işaretler)
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
      cursor: feedCursor,
    });

    // Eğer feed tablosu boşsa, direkt contentPost tablosundan en yeni postları çek (fallback)
    if (feeds.length === 0) {
      logger.info({ message: 'Feed table empty, falling back to contentPost table', userId });
      
      // Cursor varsa post ID'ye çevir
      let postCursor: string | undefined = undefined;
      if (options?.cursor) {
        postCursor = options.cursor;
      }

      // En yeni postları çek (kullanıcının kendi postları hariç)
      const postsFromDb = await this.prisma.contentPost.findMany({
        where: {
          userId: { not: userId }, // Kendi postlarını gösterme
        },
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
        orderBy: [
          { isBoosted: 'desc' },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        take: limit + 1,
        ...(postCursor && {
          cursor: { id: postCursor },
          skip: 1,
        }),
      });

      const hasMore = postsFromDb.length > limit;
      const posts = hasMore ? postsFromDb.slice(0, limit) : postsFromDb;
      const actualNextCursor = hasMore && posts.length > 0 ? posts[posts.length - 1].id : undefined;

      // Feed tablosundan gelmediği için direkt posts'u kullan
      // Get user inventories for benchmark isOwned check
      const inventories = await this.prisma.inventory.findMany({
        where: { userId },
        select: { productId: true },
      });
      const ownedProductIds = new Set(inventories.map((inv) => String(inv.productId)));

      // Batch fetch images from PostMedia (orderIndex'e göre sıralı)
      const postIds = posts.map((p) => p.id);
      const postMediaMap = new Map<string, string[]>();
      if (postIds.length > 0) {
        const allPostMedia = await this.prisma.postMedia.findMany({
          where: {
            postId: { in: postIds },
          },
          orderBy: { orderIndex: 'asc' },
          select: { postId: true, mediaUrl: true },
        });

        allPostMedia.forEach((media) => {
          if (!postMediaMap.has(media.postId)) {
            postMediaMap.set(media.postId, []);
          }
          const fullUrl = this.buildFullMediaUrl(media.mediaUrl);
        if (fullUrl) {
          postMediaMap.get(media.postId)!.push(fullUrl);
        }
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

      // Create stats map
      const statsMap = new Map<string, BaseStats>();
      posts.forEach((post) => {
        statsMap.set(post.id, {
          likes: (post as any).likesCount || 0,
          comments: (post as any).commentsCount || 0,
          shares: (post as any).sharesCount || 0,
          bookmarks: (post as any).favoritesCount || 0,
        });
      });

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
            contextType: this.mapContextType(post),
          };

          const images = postMediaMap.get(post.id) || [];

          switch (post.type) {
            case ContentPostType.FREE:
              return this.mapToPostItem(post, basePost, FeedItemType.POST, images, ownedProductIds);
            case ContentPostType.COMPARE:
              return this.mapToBenchmarkItem(post, basePost, ownedProductIds, images);
            case ContentPostType.QUESTION:
              return this.mapToPostItem(post, basePost, FeedItemType.QUESTION, images, ownedProductIds);
            case ContentPostType.TIPS:
              return this.mapToTipsAndTricksItem(post, basePost, images, ownedProductIds);
            case ContentPostType.EXPERIENCE:
              return this.mapToExperienceItem(post, basePost, FeedItemType.EXPERIENCE, images, ownedProductIds);
            case ContentPostType.UPDATE:
              return this.mapToExperienceItem(post, basePost, FeedItemType.UPDATE, images, ownedProductIds);
            default:
              return this.mapToPostItem(post, basePost, FeedItemType.POST, images, ownedProductIds);
          }
        })
      );

      const response: FeedResponse = {
        items: feedItems,
        pagination: {
          cursor: feedItems.length > 0 ? feedItems[feedItems.length - 1].data.id : actualNextCursor,
          hasMore: hasMore,
          limit,
        },
      };

      // Cache for 1 minute
      try {
        await this.cacheService.set(cacheKey, response, 60);
      } catch (error) {
        // Cache error - continue without caching
      }

      return response;
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

    // Order posts according to feed pagination order (avoid resort that breaks cursor)
    // Create feed source map (postId -> source)
    const feedSourceMap = new Map<string, string>();
    feeds.forEach((feed) => {
      feedSourceMap.set(feed.postId, feed.source);
    });

    const postMap = new Map(posts.map((p) => [p.id, p]));
    const orderedPosts = feeds
      .map((feed) => postMap.get(feed.postId))
      .filter((p): p is typeof posts[number] => Boolean(p));

    // Get user inventories for benchmark isOwned check
    const inventories = await this.prisma.inventory.findMany({
      where: { userId },
      select: { productId: true },
    });
    const ownedProductIds = new Set(inventories.map((inv) => String(inv.productId)));

    // Batch fetch images from PostMedia (orderIndex'e göre sıralı)
    const postIds = orderedPosts.map((p) => p.id);
    const postMediaMap = new Map<string, string[]>();
    if (postIds.length > 0) {
      const allPostMedia = await this.prisma.postMedia.findMany({
        where: {
          postId: { in: postIds },
        },
        orderBy: { orderIndex: 'asc' }, // Kullanıcının yüklediği sırada
        select: { postId: true, mediaUrl: true },
      });

      // Map'e dönüştür (postId -> mediaUrl array)
      allPostMedia.forEach((media) => {
        if (!postMediaMap.has(media.postId)) {
          postMediaMap.set(media.postId, []);
        }
        const fullUrl = this.buildFullMediaUrl(media.mediaUrl);
        if (fullUrl) {
          postMediaMap.get(media.postId)!.push(fullUrl);
        }
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
        const feedSource = feedSourceMap.get(post.id);
        const basePost = {
          id: post.id,
          user: userBase,
          stats,
          createdAt: post.createdAt.toISOString(),
          contextType: this.mapContextType(post),
          ...(feedSource && { source: feedSource }),
        };

        // Get images for this post from PostMedia (orderIndex'e göre sıralı)
        const images = postMediaMap.get(post.id) || [];

        switch (post.type) {
          case ContentPostType.FREE:
            return this.mapToPostItem(post, basePost, FeedItemType.POST, images, ownedProductIds);
          case ContentPostType.COMPARE:
            return this.mapToBenchmarkItem(post, basePost, ownedProductIds, images);
          case ContentPostType.QUESTION:
            return this.mapToPostItem(post, basePost, FeedItemType.QUESTION, images, ownedProductIds);
          case ContentPostType.TIPS:
            return this.mapToTipsAndTricksItem(post, basePost, images, ownedProductIds);
          case ContentPostType.EXPERIENCE:
            return this.mapToExperienceItem(post, basePost, FeedItemType.EXPERIENCE, images, ownedProductIds);
          case ContentPostType.UPDATE:
            return this.mapToExperienceItem(post, basePost, FeedItemType.UPDATE, images, ownedProductIds);
          default:
            return this.mapToPostItem(post, basePost, FeedItemType.POST, images, ownedProductIds);
        }
      })
    );

    const response: FeedResponse = {
      items: feedItems,
      pagination: {
        // API'de cursor olarak son item'ın (post) ID'si döndürülür
        cursor: feedItems.length > 0 ? feedItems[feedItems.length - 1].data.id : nextCursor,
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
    // Post'un gerçek oluşturulma zamanına göre sırala (gönderim zamanı)
    const orderBy =
      filters.sort === 'top'
        ? [
            { post: { likesCount: 'desc' as const } },
            { post: { viewsCount: 'desc' as const } },
            { post: { createdAt: 'desc' as const } },
          ]
        : [
            { post: { isBoosted: 'desc' as const } },
            { post: { createdAt: 'desc' as const } },
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

    // Batch fetch images from PostMedia (orderIndex'e göre sıralı)
    const postIds = posts.map((p) => p.id);
    const postMediaMap = new Map<string, string[]>();
    if (postIds.length > 0) {
      const allPostMedia = await this.prisma.postMedia.findMany({
        where: {
          postId: { in: postIds },
        },
        orderBy: { orderIndex: 'asc' }, // Kullanıcının yüklediği sırada
        select: { postId: true, mediaUrl: true },
      });

      // Map'e dönüştür (postId -> mediaUrl array)
      allPostMedia.forEach((media) => {
        if (!postMediaMap.has(media.postId)) {
          postMediaMap.set(media.postId, []);
        }
        const fullUrl = this.buildFullMediaUrl(media.mediaUrl);
        if (fullUrl) {
          postMediaMap.get(media.postId)!.push(fullUrl);
        }
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

        // Get images for this post from PostMedia (orderIndex'e göre sıralı)
        const images = postMediaMap.get(post.id) || [];

        switch (post.type) {
          case ContentPostType.FREE:
            return this.mapToPostItem(post, basePost, FeedItemType.POST, images, ownedProductIds);
          case ContentPostType.COMPARE:
            return this.mapToBenchmarkItem(post, basePost, ownedProductIds, images);
          case ContentPostType.QUESTION:
            return this.mapToPostItem(post, basePost, FeedItemType.QUESTION, images, ownedProductIds);
          case ContentPostType.TIPS:
            return this.mapToTipsAndTricksItem(post, basePost, images, ownedProductIds);
          case ContentPostType.EXPERIENCE:
            return this.mapToExperienceItem(post, basePost, FeedItemType.EXPERIENCE, images, ownedProductIds);
          case ContentPostType.UPDATE:
            return this.mapToExperienceItem(post, basePost, FeedItemType.UPDATE, images, ownedProductIds);
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
      avatar: resolveMediaUrl(avatar?.imageUrl || null) || '',
    };
  }

  private getProductBase(product: any): BaseProduct | null {
    if (!product) return null;
    return {
      id: String(product.id),
      name: product.name,
      subName: product.brand || product.group?.name || '',
      image: this.buildFullMediaUrl(product.imageUrl),
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
        image: this.buildFullMediaUrl(product.imageUrl),
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
        const imagePath = group.imageUrl || subCategory?.imageUrl || subCategory?.mainCategory?.imageUrl || null;
        return {
          id: String(group.id),
          name: group.name,
          subName: subCategory?.name || '',
          image: this.buildFullMediaUrl(imagePath),
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
      const imagePath = subCategory.imageUrl || subCategory.mainCategory?.imageUrl || null;
      return {
        id: String(subCategory.id),
        name: subCategory.name,
        subName: subCategory.mainCategory?.name || '',
        image: this.buildFullMediaUrl(imagePath),
      };
    }

    if (post.mainCategory) {
      return {
        id: String(post.mainCategory.id),
        name: post.mainCategory.name,
        subName: '',
        image: this.buildFullMediaUrl(post.mainCategory.imageUrl),
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
    type: FeedItemType.POST | FeedItemType.QUESTION,
    images: string[] = [],
    ownedProductIds?: Set<string>
  ): FeedItem {
    const contextData = this.buildContextData(post, ownedProductIds);
    const postData: Post = {
      ...basePost,
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

  private mapToExperienceItem(
    post: any,
    basePost: any,
    type: FeedItemType.EXPERIENCE | FeedItemType.UPDATE,
    images: string[] = [],
    ownedProductIds?: Set<string>
  ): FeedItem {
    // Build product info
    const productBase = post.product
      ? this.getProductBase(post.product)
      : post.productId
      ? this.getProductBase({ id: post.productId, name: post.product?.name || '', imageUrl: post.product?.imageUrl || null, group: post.productGroup })
      : null;

    const product: ReviewProduct = productBase
      ? {
          ...productBase,
          isOwned: ownedProductIds?.has(productBase.id) || false,
        }
      : {
          id: post.productId || '',
          name: post.product?.name || '',
          subName: post.productGroup?.name || '',
          image: this.buildFullMediaUrl(post.product?.imageUrl),
          isOwned: false,
        };

    // Parse experience content from body or create default
    // EXPERIENCE posts store structured data in body, UPDATE posts are revisions
    const experienceContent: ExperienceContent[] = this.parseExperienceContent(post.body);

    // Get tags
    const tags = post.tags?.map((t: any) => t.tag) || post.contentPostTags?.map((t: any) => t.tag) || [];

    if (type === FeedItemType.UPDATE) {
      const relatedPost = {
        id: post.id,
        product,
        content: experienceContent,
        tags,
        images,
      };

      const updateData = {
        ...basePost,
        relatedPost,
        content: post.body,
        images,
      };

      return {
        type,
        data: updateData,
      };
    }

    const experienceData: ExperiencePost = {
      ...basePost,
      product,
      content: experienceContent,
      tags,
      images,
    };

    return {
      type,
      data: experienceData,
    };
  }

  private parseExperienceContent(body: string): ExperienceContent[] {
    // Try to parse structured experience content from body
    // Format: [type] content (Rating: X/5)
    const content: ExperienceContent[] = [];
    
    if (!body) {
      return [
        {
          title: 'Product and Usage Experience',
          content: '',
          rating: 0,
        },
      ];
    }

    // First, try to parse body as JSON (in case it contains structured content array)
    try {
      const parsed = JSON.parse(body);
      
      // Handle case where parsed is an object with content array
      let contentArray: any[] | undefined = undefined;
      if (parsed && Array.isArray(parsed.content)) {
        contentArray = parsed.content;
      } else if (Array.isArray(parsed)) {
        // Handle case where body is directly a JSON array
        contentArray = parsed;
      }
      
      if (contentArray && contentArray.length > 0) {
        const transformedContent: ExperienceContent[] = [];
        let hasPrice = false;
        let hasUsage = false;
        
        for (const item of contentArray) {
          if (item.title === 'Experience') {
            // Split "Experience" into two items
            // Generate random rating between 30-70 for both items
            const randomRatingPrice = Math.floor(Math.random() * (70 - 30 + 1)) + 30;
            const randomRatingUsage = Math.floor(Math.random() * (70 - 30 + 1)) + 30;
            
            transformedContent.push({
              title: 'Price and Shopping Experience',
              content: item.content || '',
              rating: randomRatingPrice,
            });
            
            transformedContent.push({
              title: 'Product and Usage Experience',
              content: item.content || '',
              rating: randomRatingUsage,
            });
            hasPrice = true;
            hasUsage = true;
          } else if (item.title === 'Price and Shopping Experience') {
            transformedContent.push({
              title: item.title,
              content: item.content || '',
              rating: item.rating && item.rating > 0 ? item.rating : Math.floor(Math.random() * (70 - 30 + 1)) + 30,
            });
            hasPrice = true;
          } else if (item.title === 'Product and Usage Experience') {
            transformedContent.push({
              title: item.title,
              content: item.content || '',
              rating: item.rating && item.rating > 0 ? item.rating : Math.floor(Math.random() * (70 - 30 + 1)) + 30,
            });
            hasUsage = true;
          }
        }
        
        // If only one type exists, add the missing one
        if (hasPrice && !hasUsage) {
          const randomRatingUsage = Math.floor(Math.random() * (70 - 30 + 1)) + 30;
          transformedContent.push({
            title: 'Product and Usage Experience',
            content: transformedContent[0]?.content || '',
            rating: randomRatingUsage,
          });
        } else if (hasUsage && !hasPrice) {
          const randomRatingPrice = Math.floor(Math.random() * (70 - 30 + 1)) + 30;
          transformedContent.unshift({
            title: 'Price and Shopping Experience',
            content: transformedContent[0]?.content || '',
            rating: randomRatingPrice,
          });
        }
        
        if (transformedContent.length > 0) {
          return transformedContent;
        }
      }
    } catch (e) {
      // Not JSON, continue with text parsing
    }

    // Try to extract experience sections from body
    const priceMatch = body.match(/\[price_and_shopping[^\]]*\](.*?)(?:\[|Rating:|$)/is);
    const usageMatch = body.match(/\[product_and_usage[^\]]*\](.*?)(?:\[|Rating:|$)/is);
    const ratingMatch = body.match(/Rating:\s*(\d+)/i);
    const extractedRating = ratingMatch ? parseInt(ratingMatch[1]) : null;

    // Generate random ratings if not provided
    const generateRating = () => extractedRating && extractedRating > 0 ? extractedRating : Math.floor(Math.random() * (70 - 30 + 1)) + 30;

    if (priceMatch) {
      content.push({
        title: 'Price and Shopping Experience',
        content: priceMatch[1].trim(),
        rating: generateRating(),
      });
    }

    if (usageMatch) {
      content.push({
        title: 'Product and Usage Experience',
        content: usageMatch[1].trim(),
        rating: generateRating(),
      });
    }

    // If only one type found, add the missing one
    if (content.length === 1) {
      const existingContent = content[0].content;
      if (priceMatch && !usageMatch) {
        // Only price found, add usage
        content.push({
          title: 'Product and Usage Experience',
          content: existingContent,
          rating: generateRating(),
        });
      } else if (usageMatch && !priceMatch) {
        // Only usage found, add price
        content.unshift({
          title: 'Price and Shopping Experience',
          content: existingContent,
          rating: generateRating(),
        });
      }
    }

    // If no structured content found, create both defaults
    if (content.length === 0) {
      const randomRatingPrice = Math.floor(Math.random() * (70 - 30 + 1)) + 30;
      const randomRatingUsage = Math.floor(Math.random() * (70 - 30 + 1)) + 30;
      
      content.push({
        title: 'Price and Shopping Experience',
        content: body,
        rating: randomRatingPrice,
      });
      
      content.push({
        title: 'Product and Usage Experience',
        content: body,
        rating: randomRatingUsage,
      });
    }

    return content;
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

  /**
   * Yeni post oluşturulduğunda tüm aktif kullanıcıların feed'ine ekler (RELEVANCE SCORING ile)
   * 
   * Batch Scoring Stratejisi:
   * - Her 10 postta 1: Full scoring (trust, inventory, engagement, recency, boost)
   * - 9 post: Fast scoring (category, boost, recency)
   * 
   * Threshold Kontrolü:
   * - Minimum score: 5 puan (altında olanlar feed'e eklenmez)
   * - Time window: 14 gün (eski postlar feed'e eklenmez)
   * 
   * Cleanup Kontrolü:
   * - Kullanıcı feed count > 1000 ise optimization job queue'ya eklenir (MVP için 1000'e düşürüldü)
   */
  async addPostToFeeds(postId: string, postAuthorId: string): Promise<void> {
    try {
      // Post counter artır (batch scoring için)
      this.postCounter++;
      const isFullScoring = this.postCounter % 10 === 0;

      // Post bilgilerini al
      const post = await this.prisma.contentPost.findUnique({
        where: { id: postId },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
      });

      if (!post) {
        logger.warn({ message: 'Post not found for feed addition', postId });
        return;
      }

      // Time window kontrolü (14 günden eski postlar feed'e eklenmez)
      const postAge = Date.now() - post.createdAt.getTime();
      const maxAge = 14 * 24 * 60 * 60 * 1000; // 14 gün
      if (postAge > maxAge) {
        logger.info({
          message: 'Post too old for feed addition',
          postId,
          postAge: Math.floor(postAge / (24 * 60 * 60 * 1000)) + ' days',
        });
        return;
      }

      // Tüm aktif kullanıcıları al
      const allActiveUsers = await this.prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });

      // Feed kaydları için array
      const feedRecords: Array<{
        id: string;
        userId: string;
        postId: string;
        source: FeedSource;
        relevanceScore: number;
        seen: boolean;
      }> = [];

      // Scoring stratejisine göre işlem
      if (isFullScoring) {
        logger.info({
          message: 'Using FULL SCORING',
          postId,
          postCounter: this.postCounter,
        });

        // Her kullanıcı için full scoring
        for (const user of allActiveUsers) {
          if (user.id === postAuthorId) continue; // Post sahibini hariç tut

          const scoringResult = await this.scoringService.calculateFullScore(
            user.id,
            postId,
            postAuthorId,
            {
              mainCategoryId: post.mainCategoryId,
              subCategoryId: post.subCategoryId,
              productGroupId: post.productGroupId,
              productId: post.productId,
              likesCount: (post as any).likesCount || 0,
              commentsCount: (post as any).commentsCount || 0,
              viewsCount: (post as any).viewsCount || 0,
              sharesCount: (post as any).sharesCount || 0,
              isBoosted: post.isBoosted,
              boostedUntil: post.boostedUntil,
              createdAt: post.createdAt,
            }
          );

          // Threshold kontrolü (minimum 5 puan)
          if (scoringResult.score < 5) {
            continue; // Bu kullanıcıya ekleme
          }

          feedRecords.push({
            id: generateIdForModel('Feed'),
            userId: user.id,
            postId,
            source: scoringResult.source,
            relevanceScore: scoringResult.score,
            seen: false,
          });
        }
      } else {
        logger.info({
          message: 'Using FAST SCORING',
          postId,
          postCounter: this.postCounter,
        });

        // Her kullanıcı için fast scoring
        for (const user of allActiveUsers) {
          if (user.id === postAuthorId) continue;

          const scoringResult = await this.scoringService.calculateFastScore(user.id, {
            mainCategoryId: post.mainCategoryId,
            subCategoryId: post.subCategoryId,
            isBoosted: post.isBoosted,
            boostedUntil: post.boostedUntil,
            createdAt: post.createdAt,
          });

          // Threshold kontrolü (minimum 5 puan)
          if (scoringResult.score < 5) {
            continue;
          }

          feedRecords.push({
            id: generateIdForModel('Feed'),
            userId: user.id,
            postId,
            source: scoringResult.source,
            relevanceScore: scoringResult.score,
            seen: false,
          });
        }
      }

      if (feedRecords.length > 0) {
        // Batch insert
        await this.prisma.feed.createMany({
          data: feedRecords,
          skipDuplicates: true,
        });

        // Her kullanıcı için unseenFeedCount'u artır ve feed limit kontrolü
        const uniqueUserIds = Array.from(new Set(feedRecords.map((r) => r.userId)));
        
        for (const userId of uniqueUserIds) {
          // Unseen count artır
          await this.feedRepo.incrementUnseenFeedCount(userId).catch(() => {});

          // Feed count kontrolü
          const userFeedCount = await this.prisma.feed.count({
            where: { userId },
          });

          // 1000+ feed varsa optimization job queue'ya ekle (MVP için 1000'e düşürüldü)
          if (userFeedCount > 1000) {
            await this.cleanupScheduler.queueUserOptimization(userId).catch((err) => {
              logger.warn({
                message: 'Failed to queue user optimization',
                userId,
                error: err.message,
              });
            });
          }

          // Cache'i invalidate et
          try {
            const cachePattern = `feed:${userId}:*`;
            await this.cacheService.delPattern(cachePattern).catch(() => {});
          } catch (error) {
            logger.warn({
              message: 'Failed to invalidate feed cache',
              userId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // İstatistikler
        const sourceCounts = feedRecords.reduce((acc, r) => {
          acc[r.source] = (acc[r.source] || 0) + 1;
          return acc;
        }, {} as Record<FeedSource, number>);

        const avgScore =
          feedRecords.reduce((sum, r) => sum + r.relevanceScore, 0) / feedRecords.length;

        logger.info({
          message: 'Post added to feeds with relevance scoring',
          postId,
          scoringType: isFullScoring ? 'FULL' : 'FAST',
          feedCount: feedRecords.length,
          sourceCounts,
          avgScore: Math.round(avgScore * 100) / 100,
          minScore: Math.min(...feedRecords.map((r) => r.relevanceScore)),
          maxScore: Math.max(...feedRecords.map((r) => r.relevanceScore)),
        });
      } else {
        logger.info({
          message: 'No feeds created (all users below threshold)',
          postId,
        });
      }
    } catch (error) {
      logger.error({
        message: 'Failed to add post to feeds',
        postId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Hata olsa bile devam et
    }
  }

  /**
   * Feed item'ları seen olarak işaretle ve seen penalty uygula
   * Seen penalty: Mevcut score'un %50'sine düş
   * 
   * Frontend'den viewport tracking ile tetiklenir:
   * - Feed item viewport'a 2 saniye + görünür olunca çağrılır
   * - Batch update: Birden fazla feed item tek request'te
   */
  async markFeedAsSeen(feedIds: string[]): Promise<void> {
    try {
      if (feedIds.length === 0) return;

      // Batch seen marking + score penalty
      const updatedCount = await this.feedRepo.markMultipleAsSeen(feedIds);

      logger.info({
        message: 'Feeds marked as seen with penalty',
        count: updatedCount,
        feedIds: feedIds.slice(0, 5), // İlk 5 ID log'la
      });

      // Feed sahibi kullanıcıları bul ve cache invalidate et
      const feeds = await this.prisma.feed.findMany({
        where: { id: { in: feedIds } },
        select: { userId: true },
        distinct: ['userId'],
      });

      for (const feed of feeds) {
        try {
          const cachePattern = `feed:${feed.userId}:*`;
          await this.cacheService.delPattern(cachePattern).catch(() => {});
        } catch (error) {
          // Cache error - continue
        }
      }
    } catch (error) {
      logger.error({
        message: 'Failed to mark feeds as seen',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Kullanıcı feedback'i ile feed score'unu güncelle
   * 
   * Feedback Tipleri:
   * - hide: Feed'i gizle (score * 0.3)
   * - not_interested: İlgilenmiyorum (score * 0.3)
   * - save: Kaydet (score + 10)
   * - report: Şikayet et (feed sil, post moderate)
   */
  async handleUserFeedback(
    feedId: string,
    userId: string,
    feedbackType: 'hide' | 'not_interested' | 'save' | 'report'
  ): Promise<void> {
    try {
      switch (feedbackType) {
        case 'hide':
        case 'not_interested':
          // Score'u %30'a düşür
          await this.feedRepo.updateScoreByFeedback(feedId, 0.3);
          logger.info({
            message: 'Feed hidden by user',
            feedId,
            userId,
            feedbackType,
          });
          break;

        case 'save':
          // Score'u +10 artır
          await this.feedRepo.updateScoreByFeedback(feedId, null, 10);
          logger.info({
            message: 'Feed saved by user',
            feedId,
            userId,
          });
          break;

        case 'report':
          // Feed'i sil ve post'u moderate'e gönder
          const feed = await this.prisma.feed.findUnique({
            where: { id: feedId },
            select: { postId: true },
          });

          if (feed) {
            // Post'u moderate durumuna al
            await this.prisma.contentPost.update({
              where: { id: feed.postId },
              data: { status: 'PENDING_MODERATION' as any },
            });

            // Feed'i sil
            await this.feedRepo.delete(feedId);

            logger.warn({
              message: 'Feed reported and removed',
              feedId,
              postId: feed.postId,
              userId,
            });
          }
          break;
      }

      // Cache invalidate
      try {
        const cachePattern = `feed:${userId}:*`;
        await this.cacheService.delPattern(cachePattern).catch(() => {});
      } catch (error) {
        // Cache error - continue
      }
    } catch (error) {
      logger.error({
        message: 'Failed to handle user feedback',
        feedId,
        userId,
        feedbackType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Mevcut tüm postları tüm aktif kullanıcıların feed'ine ekler
   * Bu metod bir kez çalıştırılarak mevcut postları feed tablosuna ekler
   */
  async addAllExistingPostsToFeeds(): Promise<void> {
    try {
      logger.info({ message: 'Starting to add all existing posts to feeds' });

      // Tüm aktif kullanıcıları al
      const allActiveUsers = await this.prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });

      if (allActiveUsers.length === 0) {
        logger.warn({ message: 'No active users found' });
        return;
      }

      // Tüm postları al (kendi postları hariç değil, hepsini al)
      const allPosts = await this.prisma.contentPost.findMany({
        select: { id: true, userId: true, isBoosted: true },
        orderBy: { createdAt: 'desc' },
      });

      if (allPosts.length === 0) {
        logger.warn({ message: 'No posts found' });
        return;
      }

      logger.info({
        message: 'Processing posts for feed addition',
        postCount: allPosts.length,
        userCount: allActiveUsers.length,
      });

      // Post sahiplerini trust edenler için trust relation'ları al
      const allTrustRelations = await this.prisma.trustRelation.findMany({
        select: { trusterId: true, trustedUserId: true },
      });
      const trusterMap = new Map<string, Set<string>>();
      allTrustRelations.forEach((rel) => {
        if (!trusterMap.has(rel.trustedUserId)) {
          trusterMap.set(rel.trustedUserId, new Set());
        }
        trusterMap.get(rel.trustedUserId)!.add(rel.trusterId);
      });

      // Kullanıcı feed preferences'larını batch olarak al
      const userIds = allActiveUsers.map((u) => u.id);
      const userPreferences = await this.prisma.userFeedPreferences.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, preferredCategories: true },
      });
      const preferencesMap = new Map(
        userPreferences.map((pref) => [pref.userId, pref.preferredCategories])
      );

      // Post detaylarını al (kategori bilgileri için)
      const postsWithDetails = await this.prisma.contentPost.findMany({
        where: { id: { in: allPosts.map((p) => p.id) } },
        select: { id: true, userId: true, isBoosted: true, mainCategoryId: true, subCategoryId: true },
      });
      const postDetailsMap = new Map(postsWithDetails.map((p) => [p.id, p]));

      // Her post için tüm kullanıcılara ekle (source öncelik sırasına göre)
      let totalAdded = 0;
      for (const post of allPosts) {
        const postDetails = postDetailsMap.get(post.id);
        if (!postDetails) continue;

        const postCategoryId = postDetails.mainCategoryId || postDetails.subCategoryId;
        const trusters = trusterMap.get(post.userId) || new Set<string>();

        const feedRecords: Array<{
          id: string;
          userId: string;
          postId: string;
          source: FeedSource;
          seen: boolean;
        }> = [];

        for (const user of allActiveUsers) {
          if (user.id === post.userId) continue; // Post sahibini hariç tut

          let source: FeedSource | null = null;

          // 1. Truster ise TRUSTER source
          if (trusters.has(user.id)) {
            source = FeedSource.TRUSTER;
          }
          // 2. Boosted post ise BOOSTED source
          else if (postDetails.isBoosted) {
            source = FeedSource.BOOSTED;
          }
          // 3. Kategori eşleşmesi varsa CATEGORY_MATCH
          else if (postCategoryId) {
            const userPrefs = preferencesMap.get(user.id);
            if (userPrefs) {
              const preferredCategories = userPrefs.split(',').filter(Boolean);
              if (preferredCategories.includes(postCategoryId)) {
                source = FeedSource.CATEGORY_MATCH;
              }
            }
          }
          // 4. TRENDING (gelecekte)
          // 5. Fallback: NEW_USER
          if (!source) {
            source = FeedSource.NEW_USER;
          }

          feedRecords.push({
            id: generateIdForModel('Feed'),
            userId: user.id,
            postId: post.id,
            source,
            seen: false,
          });
        }

        if (feedRecords.length > 0) {
          await this.prisma.feed.createMany({
            data: feedRecords,
            skipDuplicates: true,
          });
          totalAdded += feedRecords.length;
        }
      }

      // Tüm kullanıcılar için unseenFeedCount'u güncelle
      for (const user of allActiveUsers) {
        const unseenCount = await this.prisma.feed.count({
          where: {
            userId: user.id,
            seen: false,
          },
        });

        await this.prisma.profile.updateMany({
          where: { userId: user.id },
          data: {
            unseenFeedCount: unseenCount,
          } as any,
        });
      }

      logger.info({
        message: 'All existing posts added to feeds',
        totalPosts: allPosts.length,
        totalFeedRecords: totalAdded,
      });
    } catch (error) {
      logger.error({
        message: 'Failed to add all existing posts to feeds',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

