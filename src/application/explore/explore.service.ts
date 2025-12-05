import { PrismaClient } from '@prisma/client';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { MarketplaceBannerPrismaRepository } from '../../infrastructure/repositories/marketplace-banner-prisma.repository';
import logger from '../../infrastructure/logger/logger';
import {
  TrendingFeedResponse,
  EventResponse,
  NewBrandResponse,
  NewProductResponse,
  MarketplaceBannerResponse,
} from '../../interfaces/explore/explore.dto';
import { ContentPostType } from '../../domain/content/content-post-type.enum';
import { FeedItemType } from '../../domain/feed/feed-item-type.enum';
import { ContextType } from '../../domain/content/context-type.enum';
import { ContextData, ExperiencePost, ExperienceContent, ReviewProduct } from '../../interfaces/feed/feed.dto';

export class ExploreService {
  private readonly prisma: PrismaClient;
  private readonly cacheService: CacheService;
  private readonly bannerRepo: MarketplaceBannerPrismaRepository;

  constructor() {
    this.prisma = new PrismaClient();
    this.cacheService = CacheService.getInstance();
    this.bannerRepo = new MarketplaceBannerPrismaRepository();
  }

  /**
   * Get Hottest/Trending Posts
   */
  async getHottestPosts(
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<TrendingFeedResponse> {
    const limit = options?.limit || 20;
    const cacheKey = `explore:hottest:${userId}:${options?.cursor || 'first'}:${limit}`;

    try {
      const cached = await this.cacheService.get<TrendingFeedResponse>(cacheKey);
      if (cached) {
        logger.info({ message: 'Hottest posts served from cache', userId, cacheKey });
        return cached;
      }
    } catch (error) {
      logger.warn({ message: 'Cache error', error: error instanceof Error ? error.message : String(error) });
    }

    // Fetch trending posts from the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const trendingPosts = await this.prisma.trendingPost.findMany({
      where: {
        calculatedAt: {
          gte: sevenDaysAgo,
        },
        trendPeriod: 'DAILY',
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
              },
            },
            question: true,
            tip: true,
            tags: true,
            contentPostTags: true,
          },
        },
      },
      orderBy: [
        { score: 'desc' },
        { calculatedAt: 'desc' },
      ],
      take: limit + 1,
      ...(options?.cursor && {
        cursor: { id: options.cursor },
        skip: 1,
      }),
    });

    const hasMore = trendingPosts.length > limit;
    const resultPosts = hasMore ? trendingPosts.slice(0, limit) : trendingPosts;
    const nextCursor = hasMore && resultPosts.length > 0 ? resultPosts[resultPosts.length - 1].id : undefined;

    if (resultPosts.length === 0) {
      return {
        items: [],
        pagination: {
          hasMore: false,
          limit,
        },
      };
    }

    // Get user inventories for benchmark isOwned check
    const inventories = await this.prisma.inventory.findMany({
      where: { userId },
      select: { productId: true },
    });
    const ownedProductIds = new Set(inventories.map((inv) => String(inv.productId)));

    // Get posts from resultPosts and create stats map from denormalized counts
    const posts = resultPosts.map((tp) => tp.post);
    const statsMap = new Map();
    posts.forEach((post) => {
      statsMap.set(post.id, {
        likes: (post as any).likesCount || 0,
        comments: (post as any).commentsCount || 0,
        shares: (post as any).sharesCount || 0,
        bookmarks: (post as any).favoritesCount || 0,
      });
    });
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
    const userBaseMap = new Map();
    await Promise.all(
      userIds.map(async (uid) => {
        const userBase = await this.getUserBase(String(uid));
        userBaseMap.set(String(uid), userBase);
      })
    );

    // Convert to feed items
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

        const postKey = `${post.userId}-${post.productId || ''}`;
        const images = inventoryMediaMap.get(postKey) || [];

        switch (post.type) {
          case ContentPostType.FREE:
            return this.mapToPostItem(post, basePost, FeedItemType.POST, images);
          case ContentPostType.COMPARE:
            return this.mapToBenchmarkItem(post, basePost, ownedProductIds, images);
          case ContentPostType.QUESTION:
            return this.mapToPostItem(post, basePost, FeedItemType.QUESTION, images);
          case ContentPostType.TIPS:
            return this.mapToTipsAndTricksItem(post, basePost, images);
          case ContentPostType.EXPERIENCE:
            return this.mapToExperienceItem(post, basePost, FeedItemType.EXPERIENCE, images, ownedProductIds);
          case ContentPostType.UPDATE:
            return this.mapToExperienceItem(post, basePost, FeedItemType.UPDATE, images, ownedProductIds);
          default:
            return this.mapToPostItem(post, basePost, FeedItemType.POST, images);
        }
      })
    );

    const response: TrendingFeedResponse = {
      items: feedItems,
      pagination: {
        cursor: nextCursor,
        hasMore: !!nextCursor,
        limit,
      },
    };

    // Cache for 5 minutes
    try {
      await this.cacheService.set(cacheKey, response, 300);
    } catch (error) {
      // Cache error - continue without caching
    }

    return response;
  }

  /**
   * Get Marketplace Banners
   */
  async getMarketplaceBanners(): Promise<MarketplaceBannerResponse[]> {
    const cacheKey = 'explore:marketplace:banners:active';

    try {
      const cached = await this.cacheService.get<MarketplaceBannerResponse[]>(cacheKey);
      if (cached) {
        logger.info({ message: 'Marketplace banners served from cache', cacheKey });
        return cached;
      }
    } catch (error) {
      logger.warn({ message: 'Cache error', error: error instanceof Error ? error.message : String(error) });
    }

    const banners = await this.bannerRepo.findActive();

    const response: MarketplaceBannerResponse[] = banners.map((banner) => ({
      id: banner.id,
      title: banner.title,
      description: banner.description || undefined,
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl || undefined,
    }));

    // Cache for 30 minutes
    try {
      await this.cacheService.set(cacheKey, response, 1800);
    } catch (error) {
      // Cache error - continue without caching
    }

    return response;
  }

  /**
   * Get What's News - New Events
   */
  async getWhatsNewsEvents(options?: { cursor?: string; limit?: number }): Promise<{
    items: EventResponse[];
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    const limit = options?.limit || 20;
    const cacheKey = `explore:events:new:${options?.cursor || 'first'}:${limit}`;

    try {
      const cached = await this.cacheService.get<{
        items: EventResponse[];
        pagination: { cursor?: string; hasMore: boolean; limit: number };
      }>(cacheKey);
      if (cached) {
        logger.info({ message: 'New events served from cache', cacheKey });
        return cached;
      }
    } catch (error) {
      logger.warn({ message: 'Cache error', error: error instanceof Error ? error.message : String(error) });
    }

    const events = await this.prisma.wishboxEvent.findMany({
      where: {
        status: 'PUBLISHED',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit + 1,
      ...(options?.cursor && {
        cursor: { id: options.cursor },
        skip: 1,
      }),
    });

    const hasMore = events.length > limit;
    const resultEvents = hasMore ? events.slice(0, limit) : events;
    const nextCursor = hasMore && resultEvents.length > 0 ? resultEvents[resultEvents.length - 1].id : undefined;

    // Get participant counts and sample participants for each event
    const eventItems: EventResponse[] = await Promise.all(
      resultEvents.map(async (event) => {
        const participantData = await this.prisma.wishboxStats.findMany({
          where: { eventId: event.id },
          include: {
            user: {
              include: {
                profile: true,
                avatars: {
                  where: { isActive: true },
                  take: 1,
                },
              },
            },
          },
          orderBy: {
            totalParticipated: 'desc',
          },
          take: 5, // Sample of top participants
        });

        const totalParticipants = await this.prisma.wishboxStats.count({
          where: { eventId: event.id },
        });

        return {
          eventId: event.id,
          eventType: event.eventType || 'SURVEY',
          image: (event as any).imageUrl || null,
          title: event.title,
          description: event.description || '',
          startDate: event.startDate.toISOString(),
          endDate: event.endDate.toISOString(),
          interaction: totalParticipants,
          participants: participantData.map((pd) => ({
            userId: pd.userId,
            avatar: pd.user.avatars[0]?.imageUrl || null,
            userName: pd.user.profile?.userName || pd.user.profile?.displayName || 'Anonymous',
          })),
        };
      })
    );

    const response = {
      items: eventItems,
      pagination: {
        cursor: nextCursor,
        hasMore: !!nextCursor,
        limit,
      },
    };

    // Cache for 10 minutes
    try {
      await this.cacheService.set(cacheKey, response, 600);
    } catch (error) {
      // Cache error - continue without caching
    }

    return response;
  }

  /**
   * Get New Brands
   */
  async getNewBrands(options?: { cursor?: string; limit?: number }): Promise<{
    items: NewBrandResponse[];
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    const limit = options?.limit || 20;
    const cacheKey = `explore:brands:new:${options?.cursor || 'first'}:${limit}`;

    try {
      const cached = await this.cacheService.get<{
        items: NewBrandResponse[];
        pagination: { cursor?: string; hasMore: boolean; limit: number };
      }>(cacheKey);
      if (cached) {
        logger.info({ message: 'New brands served from cache', cacheKey });
        return cached;
      }
    } catch (error) {
      logger.warn({ message: 'Cache error', error: error instanceof Error ? error.message : String(error) });
    }

    const brands = await this.prisma.brand.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: limit + 1,
      ...(options?.cursor && {
        cursor: { id: options.cursor },
        skip: 1,
      }),
    });

    const hasMore = brands.length > limit;
    const resultBrands = hasMore ? brands.slice(0, limit) : brands;
    const nextCursor = hasMore && resultBrands.length > 0 ? resultBrands[resultBrands.length - 1].id : undefined;

    const response = {
      items: resultBrands.map((brand) => ({
        brandId: brand.id,
        images: brand.logoUrl || null,
        title: brand.name,
        description: brand.description || '',
      })),
      pagination: {
        cursor: nextCursor,
        hasMore: !!nextCursor,
        limit,
      },
    };

    // Cache for 15 minutes
    try {
      await this.cacheService.set(cacheKey, response, 900);
    } catch (error) {
      // Cache error - continue without caching
    }

    return response;
  }

  /**
   * Get New Products
   */
  async getNewProducts(options?: { cursor?: string; limit?: number }): Promise<{
    items: NewProductResponse[];
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    const limit = options?.limit || 20;
    const cacheKey = `explore:products:new:${options?.cursor || 'first'}:${limit}`;

    try {
      const cached = await this.cacheService.get<{
        items: NewProductResponse[];
        pagination: { cursor?: string; hasMore: boolean; limit: number };
      }>(cacheKey);
      if (cached) {
        logger.info({ message: 'New products served from cache', cacheKey });
        return cached;
      }
    } catch (error) {
      logger.warn({ message: 'Cache error', error: error instanceof Error ? error.message : String(error) });
    }

    const products = await this.prisma.product.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: limit + 1,
      ...(options?.cursor && {
        cursor: { id: options.cursor },
        skip: 1,
      }),
    });

    const hasMore = products.length > limit;
    const resultProducts = hasMore ? products.slice(0, limit) : products;
    const nextCursor = hasMore && resultProducts.length > 0 ? resultProducts[resultProducts.length - 1].id : undefined;

    // Get product images from inventory media
    const productIds = resultProducts.map((p) => p.id);
    const inventories = await this.prisma.inventory.findMany({
      where: {
        productId: { in: productIds },
      },
      include: {
        media: {
          where: { type: 'IMAGE' },
          take: 1,
          orderBy: { uploadedAt: 'desc' },
        },
      },
      take: productIds.length,
    });

    const productImageMap = new Map<string, string>();
    inventories.forEach((inv) => {
      if (inv.media.length > 0) {
        productImageMap.set(String(inv.productId), inv.media[0].mediaUrl);
      }
    });

    const response = {
      items: resultProducts.map((product) => ({
        productId: product.id,
        images: productImageMap.get(product.id) || product.imageUrl || null,
        title: product.name,
      })),
      pagination: {
        cursor: nextCursor,
        hasMore: !!nextCursor,
        limit,
      },
    };

    // Cache for 15 minutes
    try {
      await this.cacheService.set(cacheKey, response, 900);
    } catch (error) {
      // Cache error - continue without caching
    }

    return response;
  }

  // ===== Private Helper Methods =====

  private async getUserBase(userId: string) {
    const [profile, avatar, title] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId } }),
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

  private getProductBase(product: any) {
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

  private buildContextData(post: any): ContextData {
    const contextType = this.mapContextType(post);

    if (contextType === ContextType.PRODUCT && post.product) {
      const product = post.product;
      const group = product.group;
      const subCategory = group?.subCategory;

      return {
        id: String(product.id),
        name: product.name,
        subName: group?.name || subCategory?.name || '',
        image: product.imageUrl || null,
      };
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

    // SUB_CATEGORY (fallback olarak mainCategory bilgisini de kullan)
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

  private mapToPostItem(post: any, basePost: any, type: any, images: string[] = []) {
    const postData = {
      ...basePost,
      type,
      contextData: this.buildContextData(post),
      content: post.body,
      images,
    };

    return {
      type,
      data: postData,
    };
  }

  private mapToBenchmarkItem(post: any, basePost: any, ownedProductIds: Set<string>, images: string[] = []) {
    const comparison = post.comparison;
    if (!comparison) {
      return this.mapToPostItem(post, basePost, FeedItemType.POST, images);
    }

    const product1 = this.getProductBase(comparison.product1);
    const product2 = this.getProductBase(comparison.product2);

    const products: any[] = [];
    if (product1) {
      products.push({
        ...product1,
        isOwned: ownedProductIds.has(product1.id),
        choice: false,
      });
    }
    if (product2) {
      products.push({
        ...product2,
        isOwned: ownedProductIds.has(product2.id),
        choice: false,
      });
    }

    const benchmarkData = {
      ...basePost,
      type: FeedItemType.BENCHMARK,
      contextData: this.buildContextData(post),
      products,
      content: comparison.comparisonSummary || post.body,
    };

    return {
      type: FeedItemType.BENCHMARK,
      data: benchmarkData,
    };
  }

  private mapToTipsAndTricksItem(post: any, basePost: any, images: string[] = []) {
    const tag = post.tags?.[0]?.tag || post.contentPostTags?.[0]?.tag || '';

    const tipsData = {
      ...basePost,
      type: FeedItemType.TIPS_AND_TRICKS,
      contextData: this.buildContextData(post),
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
  ) {
    const productBase = this.getProductBase(post.product);
    const product: ReviewProduct = productBase
      ? {
          ...productBase,
          isOwned: ownedProductIds?.has(productBase.id) || false,
        }
      : {
          id: post.productId || '',
          name: post.product?.name || '',
          subName: post.productGroup?.name || '',
          image: post.product?.imageUrl || null,
          isOwned: false,
        };

    // Parse experience content from body
    const experienceContent: ExperienceContent[] = this.parseExperienceContent(post.body);

    // Get tags
    const tags = post.tags?.map((t: any) => t.tag) || post.contentPostTags?.map((t: any) => t.tag) || [];

    const experienceData: ExperiencePost = {
      ...basePost,
      type,
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
}

