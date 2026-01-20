import { FeedPrismaRepository } from '../../infrastructure/repositories/feed-prisma.repository';
import { ProfilePrismaRepository } from '../../infrastructure/repositories/profile-prisma.repository';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
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
import { FeedDistributionScheduler } from '../../infrastructure/scheduler/feed-distribution.scheduler';
import { getPostCounts } from '../../infrastructure/repositories/prisma-types.helper';

export class FeedService {
  private readonly feedRepo: FeedPrismaRepository;
  private readonly profileRepo: ProfilePrismaRepository;
  private readonly cacheService: CacheService;
  private readonly prisma: ReturnType<typeof getPrisma>;
  private readonly scoringService: FeedScoringService;
  private readonly cleanupScheduler: FeedCleanupScheduler;
  private readonly distributionScheduler: FeedDistributionScheduler;
  
  // Post counter for batch scoring
  private postCounter: number = 0;

  constructor() {
    this.feedRepo = new FeedPrismaRepository();
    this.profileRepo = new ProfilePrismaRepository();
    this.cacheService = CacheService.getInstance();
    this.prisma = getPrisma();
    this.scoringService = new FeedScoringService();
    this.cleanupScheduler = new FeedCleanupScheduler();
    this.distributionScheduler = new FeedDistributionScheduler();
  }

  /**
   * Media path'ini tam URL'ye çevirir
   * resolveMediaUrl kullanarak doğru formatı garanti eder
   */
  private buildFullMediaUrl(path: string | null | undefined): string | null {
    return resolveMediaUrl(path);
  }

  /**
   * Category ID'yi MainCategory ID'sine çevirir
   * Farklı ID formatlarını destekler: UUID, ULID, prefix'li ID'ler (pcat_, mcat_, scat_), ve diğer formatlar
   * 
   * Arama sırası:
   * 1. Direkt MainCategory'de ID ile ara (herhangi bir format - UUID, ULID, prefix'li, vs.)
   * 2. Bulunamazsa Category tablosunda ara (prefix'li ID'ler için)
   * 3. Bulunamazsa name ile MainCategory'de ara
   * 
   * @param categoryId - Category ID (herhangi bir format: UUID, ULID, prefix'li ID veya name)
   * @returns MainCategory ID veya null
   */
  private async resolveCategoryId(categoryId: string): Promise<string | null> {
    if (!categoryId || categoryId.trim() === '') {
      return null;
    }

    const trimmedId = categoryId.trim();

    // 1. Önce direkt MainCategory'de ID ile ara (herhangi bir format - UUID, ULID, prefix'li, vs.)
    try {
      const mainCategory = await this.prisma.mainCategory.findUnique({
        where: { id: trimmedId },
        select: { id: true },
      });
      if (mainCategory) {
        return mainCategory.id;
      }
    } catch (error) {
      // ID formatı Prisma için geçersiz olabilir (örn. prefix'li ID'ler UUID field'ında)
      // Devam et, diğer yöntemleri dene
    }

    // 2. MainCategory'de bulunamadı - Category tablosunda ara (eski sistem - prefix'li ID'ler)
    try {
      const category = await this.prisma.category.findUnique({
        where: { id: trimmedId },
        select: { id: true, name: true },
      });

      if (category) {
        // Category bulundu - name ile MainCategory'de eşleştir
        const mainCategory = await this.prisma.mainCategory.findFirst({
          where: { name: category.name },
          select: { id: true },
        });
        if (mainCategory) {
          return mainCategory.id;
        }
      }
    } catch (error) {
      // Category tablosunda da bulunamadı veya hata oluştu
      // Devam et, name ile ara
    }

    // 3. Category tablosunda bulunamadı - direkt name olarak MainCategory'de ara
    try {
      const mainCategoryByName = await this.prisma.mainCategory.findFirst({
        where: { name: trimmedId },
        select: { id: true },
      });
      if (mainCategoryByName) {
        return mainCategoryByName.id;
      }
    } catch (error) {
      // Name ile de bulunamadı
    }

    return null;
  }

  /**
   * Get User Feed - Kullanıcının feed'ini getirir (performans için cache ve pagination ile)
   */
  async getUserFeed(
    userId: string,
    options?: { cursor?: string; limit?: number; contextType?: ContextType; contextId?: string }
  ): Promise<FeedResponse> {
    const limit = options?.limit || 20;

    // Cursor olarak item (post) ID bekleniyor. Repository ise feed.id ile paginate ediyor.
    // Bu nedenle gelen cursor'ı feed.id'ye çeviriyoruz.
    let feedCursor: string | undefined = undefined;
    if (options?.cursor) {
      const cursorFeed = await this.feedRepo.findByPostId(userId, options.cursor);
      feedCursor = cursorFeed?.id;
    }

    // Cache disabled - always fetch fresh data from database for real-time feed

    // Fetch feeds from database
    const { feeds, nextCursor } = await this.feedRepo.findByUserId(userId, {
      limit,
      cursor: feedCursor,
    });

    // Feed tablosu boşsa boş feed döndür (fallback mekanizması kaldırıldı)
    // Production'da feed tablosu her zaman dolu olmalı (FeedDistributionWorker tarafından doldurulur)
    if (feeds.length === 0) {
      logger.warn({
        message: 'Feed table is empty for user - feed distribution may not be working',
        userId,
        suggestion: 'Check FeedDistributionWorker is running and processing jobs',
      });

      return {
        items: [],
        pagination: {
          cursor: undefined,
          hasMore: false,
          limit,
        },
      };
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
      const counts = getPostCounts(post);
      statsMap.set(post.id, {
        likes: counts.likesCount,
        comments: counts.commentsCount,
        shares: counts.sharesCount,
        bookmarks: counts.favoritesCount,
      });
    });

    // Order posts according to feed pagination order (avoid resort that breaks cursor)
    // Create feed source map (postId -> source)
    const feedSourceMap = new Map<string, string>();
    feeds.forEach((feed) => {
      feedSourceMap.set(feed.postId, feed.source);
    });

    const postMap = new Map(posts.map((p) => [p.id, p]));
    let orderedPosts = feeds
      .map((feed) => postMap.get(feed.postId))
      .filter((p): p is typeof posts[number] => Boolean(p));

    // Context-based filtering
    if (options?.contextType && options?.contextId) {
      // Context'e göre post'ları filtrele
      const allowedTypes = this.getAllowedPostTypesForContext(options.contextType);
      
      if (options.contextType === ContextType.SUB_CATEGORY) {
        // Alt product group'ları getir
        const productGroups = await this.prisma.productGroup.findMany({
          where: { subCategoryId: options.contextId },
          select: { id: true },
        });
        const productGroupIds = productGroups.map((pg) => pg.id);

        // Alt product'ları getir
        const products = await this.prisma.product.findMany({
          where: { groupId: { in: productGroupIds } },
          select: { id: true },
        });
        const productIds = products.map((p) => p.id);

        // Post'ları context'e göre filtrele
        orderedPosts = orderedPosts.filter((post) => {
          // Sub category'ye ait mi?
          if (post.subCategoryId === options.contextId) {
            return allowedTypes.includes(post.type);
          }
          // Alt product group'a ait mi?
          if (post.productGroupId && productGroupIds.includes(post.productGroupId)) {
            return allowedTypes.includes(post.type);
          }
          // Alt product'a ait mi? (sadece Free, Tips, Question)
          if (post.productId && productIds.includes(post.productId)) {
            return allowedTypes.includes(post.type);
          }
          return false;
        });
      } else if (options.contextType === ContextType.PRODUCT_GROUP) {
        // Alt product'ları getir
        const products = await this.prisma.product.findMany({
          where: { groupId: options.contextId },
          select: { id: true },
        });
        const productIds = products.map((p) => p.id);

        // Post'ları context'e göre filtrele
        orderedPosts = orderedPosts.filter((post) => {
          // Product group'a ait mi?
          if (post.productGroupId === options.contextId) {
            return allowedTypes.includes(post.type);
          }
          // Alt product'a ait mi? (sadece Free, Tips, Question)
          if (post.productId && productIds.includes(post.productId)) {
            return allowedTypes.includes(post.type);
          }
          return false;
        });
      } else if (options.contextType === ContextType.PRODUCT) {
        // Sadece bu product'a ait gönderiler
        orderedPosts = orderedPosts.filter((post) => {
          return post.productId === options.contextId;
        });
        // Product için tüm post tipleri gösterilebilir (filtreleme yok)
      }
    }

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
        let feedSource = feedSourceMap.get(post.id);
        // ENGAGEMENT_HIGH aslında TRENDING olarak gösterilmeli
        if (feedSource === FeedSource.ENGAGEMENT_HIGH) {
          feedSource = FeedSource.TRENDING;
        }
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

    // Cache disabled - return fresh data from database

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

    // Category filter - sadece main category (UUID, prefix'li ID veya name ile)
    if (filters.category) {
      const resolvedCategoryId = await this.resolveCategoryId(filters.category);
      if (resolvedCategoryId) {
        postWhere.mainCategoryId = resolvedCategoryId;
      } else {
        // Geçersiz category ID - boş sonuç döndür
        logger.warn({
          message: 'Invalid category ID in feed filter',
          categoryId: filters.category,
          userId,
        });
        return {
          items: [],
          pagination: {
            hasMore: false,
            limit,
            cursor: undefined,
          },
        };
      }
    }

    // Interests filter - şu feed source'lar kabul edilir: TRUSTER, CATEGORY_MATCH, TRENDING, NEW_USER, BOOSTED, INVENTORY_MATCH, PRODUCT_GROUP_MATCH
    const feedWhere: any = {};
    if (filters.interests && filters.interests.length > 0) {
      // İzin verilen feed source'lar
      const allowedSources = [
        FeedSource.TRUSTER,
        FeedSource.CATEGORY_MATCH,
        FeedSource.TRENDING,
        FeedSource.NEW_USER,
        FeedSource.BOOSTED,
        FeedSource.INVENTORY_MATCH,
        FeedSource.PRODUCT_GROUP_MATCH,
      ];
      
      // Case-insensitive mapping: new_user -> NEW_USER, boosted -> BOOSTED, vb.
      const sourceMapping: Record<string, FeedSource> = {
        'new_user': FeedSource.NEW_USER,
        'boosted': FeedSource.BOOSTED,
        'truster': FeedSource.TRUSTER,
        'trending': FeedSource.TRENDING,
        'category_match': FeedSource.CATEGORY_MATCH,
        'inventory_match': FeedSource.INVENTORY_MATCH,
        'product_group_match': FeedSource.PRODUCT_GROUP_MATCH,
      };
      
      // Feed source'larını normalize et ve validate et
      const validSources = filters.interests
        .map((source) => {
          const normalized = source.toUpperCase();
          // Önce direkt enum değeri olarak kontrol et
          if (allowedSources.includes(normalized as FeedSource)) {
            return normalized as FeedSource;
          }
          // Sonra mapping'den kontrol et
          const mapped = sourceMapping[source.toLowerCase()];
          return mapped || null;
        })
        .filter((source): source is FeedSource => source !== null && allowedSources.includes(source));
      
      if (validSources.length > 0) {
        feedWhere.source = { in: validSources };
      }
    }

    if (filters.productIds && filters.productIds.length > 0) {
      postWhere.productId = { in: filters.productIds };
    }

    if (filters.userIds && filters.userIds.length > 0) {
      postWhere.userId = { in: filters.userIds };
    }

    // Context-based filtering
    if (filters.contextType && filters.contextId) {
      await this.applyContextBasedFiltering(postWhere, filters.contextType, filters.contextId);
    }

    // Tag-based filtering (contentPostTags, tags relations, or post type mapping)
    if (filters.tags && filters.tags.length > 0) {
      // Map tag names to post types (case-insensitive)
      const tagToTypeMap: Record<string, ContentPostType> = {
        'review': ContentPostType.FREE,
        'benchmark': ContentPostType.COMPARE,
        'tips': ContentPostType.TIPS,
        'question': ContentPostType.QUESTION,
        'experience': ContentPostType.EXPERIENCE,
        'update': ContentPostType.UPDATE,
      };
      
      const typeFilters: ContentPostType[] = [];
      const tagFilters: string[] = [];
      
      filters.tags.forEach((tag) => {
        const normalizedTag = tag.toLowerCase();
        const mappedType = tagToTypeMap[normalizedTag];
        if (mappedType) {
          typeFilters.push(mappedType);
        } else {
          // Tag name olarak kullan (case-insensitive matching için hem orijinal hem lowercase)
          tagFilters.push(tag);
        }
      });
      
      const tagConditions: any[] = [];
      
      // Add type-based filtering
      if (typeFilters.length > 0) {
        tagConditions.push({ type: { in: typeFilters } });
      }
      
      // Add tag-based filtering (contentPostTags or post_tags) - case-insensitive
      if (tagFilters.length > 0) {
        // Hem orijinal hem lowercase versiyonları ara
        const allTagVariants = [
          ...tagFilters,
          ...tagFilters.map(t => t.toLowerCase()),
          ...tagFilters.map(t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()),
        ];
        const uniqueTags = Array.from(new Set(allTagVariants));
        
        tagConditions.push({
          OR: [
            { contentPostTags: { some: { tag: { in: uniqueTags } } } },
            { tags: { some: { tag: { in: uniqueTags } } } },
          ],
        });
      }
      
      if (tagConditions.length > 0) {
        (postWhere.AND ||= []).push({
          OR: tagConditions,
        });
      }
    } else if (filters.contextType && !filters.tags) {
      // Tags yoksa, context seviyesine göre otomatik post type filtreleme
      const allowedTypes = this.getAllowedPostTypesForContext(filters.contextType);
      if (allowedTypes.length > 0) {
        (postWhere.AND ||= []).push({ type: { in: allowedTypes } });
      }
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
    // Sort logic:
    // - recent: En yeni postlar (createdAt'a göre) - default
    // - top: Relevance score'a göre popüler olanlar
    const sortType = filters.sort || 'recent'; // Default: recent
    const orderBy =
      sortType === 'top'
        ? [
            { relevanceScore: 'desc' as const },
            { post: { createdAt: 'desc' as const } },
          ]
        : [
            { post: { createdAt: 'desc' as const } },
          ];

    // Exclude user's own posts (same as normal feed)
    const finalPostWhere = {
      ...postWhere,
      userId: { not: userId }, // Kendi postlarını gösterme
    };

    // Combine feed filters (source) with post filters
    const finalFeedWhere: any = {
      userId,
      ...feedWhere, // Feed source filters (interests)
      ...(Object.keys(finalPostWhere).length > 0 && {
        post: finalPostWhere,
      }),
    };

    const feeds = await this.prisma.feed.findMany({
      where: finalFeedWhere,
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
      const counts = getPostCounts(post);
      statsMap.set(post.id, {
        likes: counts.likesCount,
        comments: counts.commentsCount,
        shares: counts.sharesCount,
        bookmarks: counts.favoritesCount,
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

    // Create feed source map (postId -> source) for filtered feeds
    const feedSourceMap = new Map<string, string>();
    filteredFeeds.forEach((feed) => {
      feedSourceMap.set(feed.postId, feed.source);
    });

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
        let feedSource = feedSourceMap.get(post.id);
        // ENGAGEMENT_HIGH aslında TRENDING olarak gösterilmeli
        if (feedSource === FeedSource.ENGAGEMENT_HIGH) {
          feedSource = FeedSource.TRENDING;
        }
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

    if (filters.types && filters.types.length > 0) {
      feedItems = this.prioritizeFeedItemsByType(feedItems, filters.types, 20);
    }

    const limitedItems = feedItems.slice(0, limit);
    const finalHasMore = hasMoreFromDb || feedItems.length > limit;

    // Calculate total count for filtered feed (using the same where clause as the query)
    const totalCount = await this.prisma.feed.count({
      where: {
        userId,
        ...feedWhere, // Feed source filters (interests)
        ...(Object.keys(finalPostWhere).length > 0 && {
          post: finalPostWhere,
        }),
      },
    });

    return {
      items: limitedItems,
      pagination: {
        cursor: finalHasMore ? nextCursor : undefined,
        hasMore: finalHasMore,
        limit,
        total: totalCount,
      },
    };
  }

  /**
   * Get feed source counts (excluding user's own posts)
   */
  async getFeedSourceCounts(userId: string): Promise<Record<string, number>> {
    const counts = await this.prisma.feed.groupBy({
      by: ['source'],
      where: {
        userId,
        post: {
          userId: { not: userId }, // Exclude user's own posts
        },
      },
      _count: {
        id: true,
      },
    });

    const result: Record<string, number> = {};
    counts.forEach((item) => {
      // ENGAGEMENT_HIGH should be shown as TRENDING
      const source = item.source === 'ENGAGEMENT_HIGH' ? 'TRENDING' : item.source;
      result[source] = (result[source] || 0) + item._count.id;
    });

    // Ensure all sources are present (even if 0)
    const allSources = [
      'TRUSTER',
      'CATEGORY_MATCH',
      'TRENDING',
      'NEW_USER',
      'BOOSTED',
      'TRUSTER_NETWORK',
      'MUTUAL_TRUST',
      'INVENTORY_MATCH',
      'PRODUCT_GROUP_MATCH',
    ];
    allSources.forEach((source) => {
      if (!(source in result)) {
        result[source] = 0;
      }
    });

    return result;
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
      avatar: resolveMediaUrl(avatar?.imageUrl || null, true) || '',
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
   * Context seviyesine göre izin verilen post tiplerini döndürür
   */
  private getAllowedPostTypesForContext(contextType: ContextType): ContentPostType[] {
    switch (contextType) {
      case ContextType.SUB_CATEGORY:
      case ContextType.PRODUCT_GROUP:
        // Sub category ve product group için sadece Free, Tips, Question
        return [ContentPostType.FREE, ContentPostType.TIPS, ContentPostType.QUESTION];
      case ContextType.PRODUCT:
        // Product için tüm post tipleri
        return [
          ContentPostType.FREE,
          ContentPostType.TIPS,
          ContentPostType.QUESTION,
          ContentPostType.EXPERIENCE,
          ContentPostType.UPDATE,
          ContentPostType.COMPARE,
        ];
      default:
        return [];
    }
  }

  /**
   * Context-based filtreleme uygular
   */
  private async applyContextBasedFiltering(
    postWhere: any,
    contextType: ContextType,
    contextId: string
  ): Promise<void> {
    // Context'e göre post'ları filtrele
    switch (contextType) {
      case ContextType.SUB_CATEGORY:
        // Alt product group'ları getir
        const productGroups = await this.prisma.productGroup.findMany({
          where: { subCategoryId: contextId },
          select: { id: true },
        });
        const productGroupIds = productGroups.map((pg) => pg.id);

        // Alt product'ları getir
        const products = await this.prisma.product.findMany({
          where: { groupId: { in: productGroupIds } },
          select: { id: true },
        });
        const productIds = products.map((p) => p.id);

        // Hiyerarşik where clause
        postWhere.OR = [
          { subCategoryId: contextId },
          ...(productGroupIds.length > 0 ? [{ productGroupId: { in: productGroupIds } }] : []),
          ...(productIds.length > 0 ? [{ productId: { in: productIds } }] : []),
        ];

        // Post type filtreleme (Experience, Update, Benchmark hariç)
        const allowedTypes = this.getAllowedPostTypesForContext(contextType);
        (postWhere.AND ||= []).push({ type: { in: allowedTypes } });
        break;

      case ContextType.PRODUCT_GROUP:
        // Alt product'ları getir
        const groupProducts = await this.prisma.product.findMany({
          where: { groupId: contextId },
          select: { id: true },
        });
        const groupProductIds = groupProducts.map((p) => p.id);

        // Hiyerarşik where clause
        postWhere.OR = [
          { productGroupId: contextId },
          ...(groupProductIds.length > 0 ? [{ productId: { in: groupProductIds } }] : []),
        ];

        // Post type filtreleme (Experience, Update, Benchmark hariç)
        const groupAllowedTypes = this.getAllowedPostTypesForContext(contextType);
        (postWhere.AND ||= []).push({ type: { in: groupAllowedTypes } });
        break;

      case ContextType.PRODUCT:
        // Sadece bu product'a ait gönderiler
        postWhere.productId = contextId;
        // Product için tüm post tipleri gösterilebilir (filtreleme yok)
        break;
    }
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

  /**
   * Tek bir post'u feed item formatına çevirir (public metod)
   */
  async getPostAsFeedItem(post: any, userId?: string): Promise<FeedItem | null> {
    if (!post) return null;

    // Get user inventories for benchmark isOwned check
    const ownedProductIds = userId 
      ? new Set(
          (await this.prisma.inventory.findMany({
            where: { userId },
            select: { productId: true },
          })).map((inv) => String(inv.productId))
        )
      : new Set<string>();

    // Get images from PostMedia
    const postMedia = await this.prisma.postMedia.findMany({
      where: { postId: post.id },
      orderBy: { orderIndex: 'asc' },
      select: { mediaUrl: true },
    });
    const images = postMedia.map((media) => this.buildFullMediaUrl(media.mediaUrl)).filter(Boolean) as string[];

    // Get user base
    const userBase = await this.getUserBase(String(post.userId));

    // Get stats
    const counts = getPostCounts(post);
    const stats: BaseStats = {
      likes: counts.likesCount || post.likes?.length || 0,
      comments: counts.commentsCount || post.comments?.length || 0,
      shares: counts.sharesCount || 0,
      bookmarks: counts.favoritesCount || post.favorites?.length || 0,
    };

    const basePost = {
      id: post.id,
      user: userBase,
      stats,
      createdAt: post.createdAt.toISOString(),
      contextType: this.mapContextType(post),
    };

    // Map post based on type
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
      // Convert experienceContent array to string for mobile compatibility
      const relatedPostContentString = experienceContent.length > 0
        ? experienceContent.map((item) => `${item.title}: ${item.content}${item.rating ? ` (${item.rating}/5)` : ''}`).join('\n\n')
        : post.body || '';

      const relatedPost = {
        id: post.id,
        product,
        content: relatedPostContentString, // String for mobile compatibility
        experienceContent, // Keep array for structured data
        tags,
        images,
      } as any; // Type assertion needed because RelatedPostData interface expects content: ExperienceContent[]

      const updateData = {
        ...basePost,
        relatedPost,
        content: post.body || '', // Ensure content is always a string
        images,
      };

      return {
        type,
        data: updateData,
      };
    }

    // Convert experienceContent array to string for mobile compatibility
    // Mobile expects content to be a string (for substring operations)
    const contentString = experienceContent.length > 0
      ? experienceContent.map((item) => `${item.title}: ${item.content}${item.rating ? ` (${item.rating}/5)` : ''}`).join('\n\n')
      : post.body || '';

    const experienceData: ExperiencePost = {
      ...basePost,
      product,
      content: contentString, // String for mobile compatibility
      experienceContent, // Keep array for structured data
      tags,
      images,
    } as any; // Type assertion needed because ExperiencePost interface expects content: ExperienceContent[]

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
   * Post'u feed'lere ekle (Asynchronous with BullMQ)
   * 
   * Fan-out on Write stratejisi ile çalışır:
   * - Post oluşturulduğunda bu metod çağrılır
   * - Feed distribution job'ı queue'ya eklenir (non-blocking)
   * - Worker arka planda hedef kullanıcılara feed dağıtır
   * 
   * Performance optimizations:
   * - Asynchronous processing (ana thread bloklanmaz)
   * - Batch scoring (100'er kullanıcı)
   * - Chunked inserts (500'er kayıt)
   * - Controlled concurrency (max 3 chunk paralel)
   * - Retry mechanism (max 3 attempt per chunk)
   * - Score threshold filtering (minimum 5 puan)
   * 
   * @param postId - Post ID
   * @param postAuthorId - Post yazarının ID'si
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

      // Feed distribution job'ı queue'ya ekle (non-blocking)
      await this.distributionScheduler.queueFeedDistribution(
        postId,
        postAuthorId,
        {
          mainCategoryId: post.mainCategoryId,
          subCategoryId: post.subCategoryId,
          productGroupId: post.productGroupId,
          productId: post.productId,
          likesCount: getPostCounts(post).likesCount,
          commentsCount: getPostCounts(post).commentsCount,
          viewsCount: getPostCounts(post).viewsCount,
          sharesCount: getPostCounts(post).sharesCount,
          isBoosted: post.isBoosted,
          boostedUntil: post.boostedUntil,
          createdAt: post.createdAt,
        },
        isFullScoring ? 'full' : 'fast'
      );

      logger.info({
        message: 'Feed distribution job queued successfully',
        postId,
        scoringType: isFullScoring ? 'FULL' : 'FAST',
        postCounter: this.postCounter,
      });
    } catch (error) {
      logger.error({
        message: 'Failed to queue feed distribution',
        postId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Hata olsa bile devam et - post oluşturma başarısız sayılmamalı
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
            // TODO: status field is not in ContentPost schema, needs to be added to prisma schema
            // await this.prisma.contentPost.update({
            //   where: { id: feed.postId },
            //   data: { status: 'PENDING_MODERATION' as any },
            // });

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

