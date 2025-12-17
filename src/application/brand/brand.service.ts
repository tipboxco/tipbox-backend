import { PrismaClient } from '@prisma/client';
import { FeedItem, FeedItemType, FeedResponse, ContextData, ExperiencePost, ExperienceContent } from '../../interfaces/feed/feed.dto';
import { ContentPostType } from '../../domain/content/content-post-type.enum';
import { buildMediaUrl } from '../../infrastructure/config/media.config';
import logger from '../../infrastructure/logger/logger';
import { NotFoundError } from '../../infrastructure/errors/custom-errors';

export interface BrandCategoryItem {
  categoryId: string;
  name: string;
  image: string | null;
}

export interface BrandItem {
  brandId: string;
  name: string;
  image: string | null;
}

export interface BrandCatalogResponse {
  brandId: string;
  name: string;
  description: string | null;
  /**
   * Brand catalog ekranında kullanılacak banner görseli
   * (seed sırasında brand.imageUrl olarak dolduruluyor)
   */
  bannerImage: string | null;
  followers: number;
  isJoined: boolean;
}

export interface BrandFeedResponse {
  brandId: string;
  name: string;
  posts: FeedItem[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

export interface BrandProductGroup {
  productGroupId: string;
  productGroupName: string;
  products: BrandProduct[];
}

export interface BrandProductGroupInfo {
  productGroupId: string;
  productGroupName: string;
}

export interface BrandProductsResponse {
  items: BrandProduct[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

export interface BrandProductsBatchResponse {
  groups: Record<string, BrandProductGroupInfo>;
  items: BrandProduct[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

export interface BrandProduct {
  productId: string;
  name: string;
  image: string | null;
  stats: {
    reviews: number;
    likes: number;
    share: number;
  };
}

// ===== Brand Survey & Gamification DTO'ları =====

export type SurveyStatusType = 'start' | 'continue' | 'viewresults';

export interface BrandInfo {
  id: string;
  name: string;
  category: string;
  logo: string | null;
}

export interface SurveyCard {
  id: string;
  title: string;
  description: string;
  type: string; // Anket tipi (WishboxEventType veya özel tip)
  duration: string; // Tahmini tamamlama süresi
  points: number;
  status: SurveyStatusType;
  progress: number;
}

export interface SurveyEndPoint {
  brand: BrandInfo;
  surveyList: SurveyCard[];
}

export interface SurveyListResponse {
  surveyList: SurveyCard[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

export type BrandEventType = 'default' | 'product';

export interface BrandEventCard {
  id: string;
  title: string;
  description: string;
  type: BrandEventType;
  startDate: string;
  endDate: string;
  status: 'joined' | 'join';
  image: string;
}

export interface EventTasks {
  id: string;
  title: string;
  progress: number;
  total: number;
}

export interface EventStatistics {
  percentage: number;
  totalUser: number;
}

export interface EventRewards {
  title: string;
  badgeImage: string;
}

export interface BrandEventDetail {
  id: string;
  title: string;
  description: string;
  status: 'joined' | 'join';
  image: string;
  statistics: EventStatistics;
  rewards: EventRewards;
  requirements: EventTasks[];
}

// ===== Brand History DTO'ları =====

export interface BrandHistoryStats {
  surveys: number;
  shares: number;
  events: number;
}

export interface BrandHistoryPointsItem {
  id: string;
  title: string;
  image: string;
  points: number;
  createdAt: string;
}

export interface BrandHistoryBadge {
  id: string;
  title: string;
  image: string;
}

export interface BrandHistory {
  id: string;
  name: string;
  category: string;
  image: string;
  totalPoints: number;
  stats: BrandHistoryStats;
  badgeList: BrandHistoryBadge[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

export interface BrandHistoryPointsResponse {
  items: BrandHistoryPointsItem[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

export interface SurveyList {
  surveyList: SurveyCard[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

export interface BrandHistoryEvents {
  events: BrandEventCard[];
}

export interface BrandEventsResponse {
  items: BrandEventCard[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

export interface BrandHistoryEventsResponse {
  items: BrandEventCard[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

export class BrandService {
  private readonly prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Tüm brand kategorilerini listele
   */
  async getAllBrandCategories(): Promise<BrandCategoryItem[]> {
    try {
      const categories = await this.prisma.brandCategory.findMany({
        orderBy: {
          name: 'asc',
        },
      });

      return categories.map((category) => ({
        categoryId: category.id,
        name: category.name,
        image: category.imageUrl,
      }));
    } catch (error) {
      logger.error('Failed to get all brand categories:', error);
      throw error;
    }
  }

  /**
   * Kategoriye göre markaları listele
   * categoryId UUID veya kategori adı olabilir
   */
  async getBrandsByCategoryId(categoryId: string): Promise<BrandItem[]> {
    try {
      // Önce kategoriyi bul (UUID veya name ile)
      const category = await this.prisma.brandCategory.findFirst({
        where: {
          OR: [
            { id: categoryId },
            { name: categoryId },
          ],
        },
      });

      if (!category) {
        throw new NotFoundError(`Category not found: ${categoryId}`);
      }

      const brands = await this.prisma.brand.findMany({
        where: {
          categoryId: category.id,
        },
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      return brands.map((brand) => ({
        brandId: brand.id,
        name: brand.name,
        image: brand.imageUrl,
      }));
    } catch (error) {
      logger.error(`Failed to get brands for category ${categoryId}:`, error);
      throw error;
    }
  }

  /**
   * Brand Survey & Gamification - Anketler tab'ı
   * Brand bilgileri store'dan alınacak, sadece surveyList + pagination dönecek
   */
  async getBrandSurveys(
    brandId: string,
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<SurveyListResponse> {
    // Brand kontrolü (store'dan alınacak ama response'da dönmeyeceğiz)
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
    });

    if (!brand) {
      throw new NotFoundError(`Brand not found: ${brandId}`);
    }

    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor;

    // Sadece SURVEY tipindeki event'leri döndür
    const whereClause: any = {
      status: 'PUBLISHED',
      brandId,
      eventType: 'SURVEY',
    };

    if (cursor) {
      whereClause.id = {
        gt: cursor,
      };
    }

    const events = await this.prisma.wishboxEvent.findMany({
      where: whereClause as any,
      orderBy: { startDate: 'asc' },
      take: limit + 1, // Bir fazla al ki hasMore'u kontrol edebilelim
    });

    const hasMore = events.length > limit;
    const resultEvents = hasMore ? events.slice(0, limit) : events;
    const nextCursor = hasMore && resultEvents.length > 0 ? resultEvents[resultEvents.length - 1].id : undefined;

    // Kullanıcının event istatistiklerine göre status/progress hesapla
    const stats = await this.prisma.wishboxStats.findMany({
      where: {
        userId,
        eventId: { in: resultEvents.map((e) => e.id) },
      },
    });

    const statsMap = new Map<string, (typeof stats)[number]>();
    stats.forEach((s) => statsMap.set(s.eventId, s));

    const surveyList: SurveyCard[] = resultEvents.map((event) => {
      const eventStats = statsMap.get(event.id);
      const totalParticipated = eventStats?.totalParticipated ?? 0;

      let status: SurveyStatusType = 'start';
      if (totalParticipated > 0 && totalParticipated < 3) {
        status = 'continue';
      } else if (totalParticipated >= 3) {
        status = 'viewresults';
      }

      const progress = Math.min(100, totalParticipated * 25);

      return {
        id: event.id,
        title: event.title,
        description: event.description || '',
        type: (event.eventType || 'SURVEY').toLowerCase(),
        duration: '5-10 dk',
        points: 100 + (totalParticipated || 1) * 25,
        status,
        progress,
      };
    });

    return {
      surveyList,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  /**
   * Brand catalog detayları (brand bilgisi + posts)
   */
  async getBrandCatalog(brandId: string, userId?: string): Promise<BrandCatalogResponse> {
    try {
      const brand = await this.prisma.brand.findUnique({
        where: { id: brandId },
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
        },
      });

      if (!brand) {
        throw new NotFoundError('Brand not found');
      }

      // Followers count
      const followersCount = await this.prisma.bridgeFollower.count({
        where: { brandId },
      });

      // Is user following this brand?
      let isJoined = false;
      if (userId) {
        const follow = await this.prisma.bridgeFollower.findUnique({
          where: {
            userId_brandId: {
              userId: userId,
              brandId: brandId,
            },
          },
        });
        isJoined = !!follow;
      }

      return {
        brandId: brand.id,
        name: brand.name,
        description: brand.description,
        bannerImage: brand.imageUrl || null,
        followers: followersCount,
        isJoined,
      };
    } catch (error) {
      logger.error(`Failed to get brand catalog for ${brandId}:`, error);
      throw error;
    }
  }

  /**
   * Brand feed (sadece brand'e ait bridge post'lardan oluşan feed)
   */
  async getBrandFeed(
    brandId: string,
    options?: { cursor?: string; limit?: number; userId?: string }
  ): Promise<BrandFeedResponse> {
    try {
      const brand = await this.prisma.brand.findUnique({
        where: { id: brandId },
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
        },
      });

      if (!brand) {
        throw new NotFoundError('Brand not found');
      }

      const brandProducts = await this.prisma.product.findMany({
        where: { brand: brand.name },
        select: { id: true },
      });
      const productIds = brandProducts.map((product) => product.id);

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 10;
      const cursor = options?.cursor;

      const contentPosts = await this.prisma.contentPost.findMany({
        where: productIds.length
          ? {
              productId: { in: productIds },
            }
          : {
              OR: [
                {
                  body: {
                    contains: brand.name,
                    mode: 'insensitive',
                  },
                },
                {
                  title: {
                    contains: brand.name,
                    mode: 'insensitive',
                  },
                },
              ],
            },
        include: {
          user: {
            include: {
              profile: true,
              titles: {
                orderBy: { earnedAt: 'desc' },
                take: 1,
              },
              avatars: {
                where: { isActive: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
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
                include: { group: true },
              },
              product2: {
                include: { group: true },
              },
              scores: true,
            },
          },
          tip: true,
          tags: true,
          contentPostTags: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
      });

      // Experience post'ları için inventory verilerini toplu olarak çek
      const experiencePostIds = contentPosts
        .filter((p) => p.type === ContentPostType.EXPERIENCE || p.type === ContentPostType.UPDATE)
        .map((p) => p.id);
      
      const inventoriesMap = new Map<string, any>();
      if (experiencePostIds.length > 0 && options?.userId) {
        const inventories = await this.prisma.inventory.findMany({
          where: {
            userId: options.userId,
            productId: { in: productIds },
          },
          include: {
            productExperiences: true,
            media: true, // type field'ı kaldırıldı, tüm media'ları getir
          },
        });

        // Post ID'ye göre inventory'leri map'le (productId ve userId'ye göre)
        inventories.forEach((inv) => {
          const key = `${inv.userId}-${inv.productId}`;
          inventoriesMap.set(key, inv);
        });
      }

      const hasMore = contentPosts.length > limit;
      const resultPosts = hasMore ? contentPosts.slice(0, limit) : contentPosts;
      const nextCursor = hasMore && resultPosts.length > 0 ? resultPosts[resultPosts.length - 1].id : undefined;
      const posts = await this.mapPostsToFeedItems(resultPosts, options?.userId, inventoriesMap);

      return {
        brandId: brand.id,
        name: brand.name,
        posts,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get brand feed for ${brandId}:`, error);
      throw error;
    }
  }

  /**
   * Brand Survey & Gamification - Eventler tab'ı (pagination ile)
   */
  async getBrandEvents(
    brandId: string,
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<BrandEventsResponse> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor;

    const whereClause: any = {
      status: 'PUBLISHED',
      brandId,
    };

    if (cursor) {
      whereClause.id = {
        gt: cursor,
      };
    }

    const events = await this.prisma.wishboxEvent.findMany({
      where: whereClause as any,
      orderBy: { startDate: 'asc' },
      take: limit + 1, // Bir fazla al ki hasMore'u kontrol edebilelim
    });

    const hasMore = events.length > limit;
    const resultEvents = hasMore ? events.slice(0, limit) : events;
    const nextCursor = hasMore && resultEvents.length > 0 ? resultEvents[resultEvents.length - 1].id : undefined;

    const stats = await this.prisma.wishboxStats.findMany({
      where: {
        userId,
        eventId: { in: resultEvents.map((e) => e.id) },
      },
    });
    const statsSet = new Set(stats.map((s) => s.eventId));

    const items = resultEvents.map<BrandEventCard>((event) => ({
      id: event.id,
      title: event.title,
      description: event.description || '',
      type: 'default',
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      status: statsSet.has(event.id) ? 'joined' : 'join',
      image: event.imageUrl || '',
    }));

    return {
      items,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  /**
   * Brand Survey & Gamification - Event detay endpoint'i
   */
  async getBrandEventDetail(eventId: string, userId: string): Promise<BrandEventDetail> {
    const event = (await this.prisma.wishboxEvent.findUnique({
      where: { id: eventId },
    })) as any;

    if (!event) {
      throw new NotFoundError(`Event not found: ${eventId}`);
    }

    const stats = await this.prisma.wishboxStats.findMany({
      where: { eventId },
    });

    const totalUser = stats.length || 0;
    const totalParticipated = stats.reduce((sum, s) => sum + s.totalParticipated, 0);
    const maxParticipated = Math.max(1, totalParticipated);

    const joined = stats.some((s) => s.userId === userId);

    // Basit bir yüzde hesabı: katılımcı sayısına göre normalize
    const percentage = totalUser === 0 ? 0 : Math.min(100, Math.round((totalParticipated / (totalUser * 5)) * 100));

    // Ödül için event'e bağlı ilk badge reward'u bulmaya çalış
    const reward = await this.prisma.wishboxReward.findFirst({
      where: { eventId },
      include: {
        user: true,
      },
    });

    const badgeImageUrl = buildMediaUrl('tipbox-media/brandbadge/badge1.png');
    const rewards: EventRewards = {
      title: reward ? `Badge Reward #${reward.rewardId}` : 'Participation Badge',
      badgeImage: badgeImageUrl,
    };

    // Basit görev listesi
    const requirements: EventTasks[] = [
      {
        id: `${eventId}-1`,
        title: 'Anketi tamamla',
        progress: joined ? maxParticipated : 0,
        total: maxParticipated,
      },
      {
        id: `${eventId}-2`,
        title: 'En az 1 paylaşım yap',
        progress: joined ? 1 : 0,
        total: 1,
      },
    ];

    return {
      id: event.id,
      title: event.title,
      description: event.description || '',
      status: joined ? 'joined' : 'join',
      image: event.imageUrl || '',
      statistics: {
        percentage,
        totalUser,
      },
      rewards,
      requirements,
    };
  }

  /**
   * Brand Survey & Gamification - Trendler tab'ı
   * Brand'e ait trend içerikleri (en popüler/trending post'lar) - pagination ile
   */
  async getBrandTrends(
    brandId: string,
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<FeedResponse> {
    try {
      const brand = await this.prisma.brand.findUnique({
        where: { id: brandId },
      });

      if (!brand) {
        throw new NotFoundError(`Brand not found: ${brandId}`);
      }

      // Brand'e ait product'ları bul
      const brandProducts = await this.prisma.product.findMany({
        where: { brand: brand.name },
        select: { id: true },
      });
      const productIds = brandProducts.map((product) => product.id);

      if (productIds.length === 0) {
        return {
          items: [],
          pagination: {
            cursor: undefined,
            hasMore: false,
            limit: options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20,
          },
        };
      }

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 5;
      const cursor = options?.cursor;

      const whereClause: any = {
        productId: { in: productIds },
      };

      if (cursor) {
        whereClause.id = {
          lt: cursor,
        };
      }

      // Trend post'ları: en çok beğenilen ve yorumlanan post'lar
      // Önce stats'leri alalım
      const postsWithStats = await this.prisma.contentPost.findMany({
        where: whereClause,
        include: {
          user: {
            include: {
              profile: true,
              titles: {
                orderBy: { earnedAt: 'desc' },
                take: 1,
              },
              avatars: {
                where: { isActive: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
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
                include: { group: true },
              },
              product2: {
                include: { group: true },
              },
              scores: true,
            },
          },
          tip: true,
          tags: true,
          contentPostTags: true,
        },
        orderBy: [
          { likesCount: 'desc' },
          { commentsCount: 'desc' },
          { viewsCount: 'desc' },
          { createdAt: 'desc' },
          { id: 'desc' }, // deterministik sıralama için id ekleyelim
        ],
        take: limit + 1, // Bir fazla al ki hasMore'u kontrol edebilelim
        ...(options?.cursor && {
          cursor: { id: options.cursor },
          skip: 1,
        }),
      });

      const hasMore = postsWithStats.length > limit;
      const resultPosts = hasMore ? postsWithStats.slice(0, limit) : postsWithStats;
      const nextCursor = hasMore && resultPosts.length > 0 ? resultPosts[resultPosts.length - 1].id : undefined;

      const feedItems = await this.mapPostsToFeedItems(resultPosts, userId);

      return {
        items: feedItems,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get brand trends for ${brandId}:`, error);
      throw error;
    }
  }

  // ===== Brand History =====

  async getBrandHistory(
    brandId: string,
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<BrandHistory> {
    // Brand bilgilerini store'dan (brand tablosundan) al
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      include: { brandCategory: true },
    });

    if (!brand) {
      throw new NotFoundError(`Brand not found: ${brandId}`);
    }

    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor;

    // Kullanıcının bu marka için kazandığı rozetler (pagination ile)
    const whereClause: any = {
      userId,
      brandId,
    };

    if (cursor) {
      whereClause.badgeId = {
        lt: cursor,
      };
    }

    // Önce tüm unique badge'leri al (distinct badgeId'ler)
    const allRewards = await this.prisma.bridgeReward.findMany({
      where: {
        userId,
        brandId,
      },
      include: {
        badge: true,
      },
      orderBy: {
        awardedAt: 'desc',
      },
    });

    // Distinct badge'leri map'le
    const uniqueBadgesMap = new Map<string, BrandHistoryBadge>();
    const defaultBadgeImage = buildMediaUrl('tipbox-media/badge/badge1.png');
    
    for (const br of allRewards) {
      if (!uniqueBadgesMap.has(br.badgeId)) {
        uniqueBadgesMap.set(br.badgeId, {
          id: br.badgeId,
          title: br.badge.name,
          image: br.badge.imageUrl || defaultBadgeImage,
        });
      }
    }

    // Badge'leri array'e çevir ve cursor'a göre filtrele
    let allBadges = Array.from(uniqueBadgesMap.values());
    
    // Cursor varsa, cursor'dan önceki badge'leri al
    if (cursor) {
      const cursorIndex = allBadges.findIndex(b => b.id === cursor);
      if (cursorIndex !== -1) {
        allBadges = allBadges.slice(cursorIndex + 1);
      }
    }

    // Pagination uygula
    const hasMore = allBadges.length > limit;
    const paginatedBadges = hasMore ? allBadges.slice(0, limit) : allBadges;
    const nextCursor = hasMore && paginatedBadges.length > 0 
      ? paginatedBadges[paginatedBadges.length - 1].id 
      : undefined;

    const badgeList: BrandHistoryBadge[] = paginatedBadges;

    // Toplam puan: kullanıcının bu marka için kazandığı bridgeReward sayısı * 50
    // (Her bridgeReward yaklaşık 50 puan değerinde)
    const totalPoints = allRewards.length * 50;

    // Stats: kullanıcıya özel istatistikler
    // Surveys: kullanıcının bu marka için katıldığı survey sayısı
    const userSurveys = await this.prisma.brandSurveyAnswer.findMany({
      where: {
        userId,
        question: {
          survey: {
            brandId,
          },
        },
      },
      distinct: ['questionId'],
    });

    // Shares: kullanıcının bu marka için yaptığı bridgePost sayısı
    const userBridgePostsCount = await this.prisma.bridgePost.count({
      where: {
        userId,
        brandId,
      },
    });

    // Events: kullanıcının bu marka için katıldığı event sayısı
    // (WishboxEvent'te brandId yok, bu yüzden genel event sayısını alıyoruz)
    const userEvents = await this.prisma.wishboxStats.findMany({
      where: {
        userId,
      },
      distinct: ['eventId'],
    });

    const stats: BrandHistoryStats = {
      surveys: userSurveys.length,
      shares: userBridgePostsCount,
      events: userEvents.length,
    };

    return {
      id: brand.id,
      name: brand.name,
      category: brand.brandCategory?.name || 'General',
      image: brand.imageUrl || '',
      totalPoints,
      stats,
      badgeList,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  async getBrandHistoryPoints(
    brandId: string,
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<BrandHistoryPointsResponse> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor;

    // Kullanıcının bu marka için kazandığı bridgeReward'ları al
    const whereClause: any = {
      userId,
      brandId,
    };

    if (cursor) {
      whereClause.id = {
        lt: cursor,
      };
    }

    const rewards = await this.prisma.bridgeReward.findMany({
      where: whereClause,
      include: {
        badge: true,
      },
      orderBy: {
        awardedAt: 'desc',
      },
      take: limit + 1, // Bir fazla al ki hasMore'u kontrol edebilelim
    });

    const hasMore = rewards.length > limit;
    const resultRewards = hasMore ? rewards.slice(0, limit) : rewards;

    const defaultBadgeImage = buildMediaUrl('tipbox-media/badge/badge1.png');
    const items: BrandHistoryPointsItem[] = resultRewards.map((r) => ({
      id: r.id,
      title: r.badge.name,
      image: r.badge.imageUrl || defaultBadgeImage,
      points: 50, // Her bridgeReward 50 puan
      createdAt: r.awardedAt.toISOString(),
    }));

    const nextCursor = hasMore && resultRewards.length > 0 ? resultRewards[resultRewards.length - 1].id : undefined;

    return {
      items,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  async getBrandHistorySurveys(
    brandId: string,
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<SurveyList> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor;

    // İlgili brand'in varlığını doğrula (ileride brand'e özel filtreler eklenebilir)
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      throw new NotFoundError(`Brand not found: ${brandId}`);
    }

    // Tüm PUBLISHED event'ler arasından sayfalı şekilde çek
    const events = await this.prisma.wishboxEvent.findMany({
      where: {
        status: 'PUBLISHED',
        brandId,
      } as any,
      orderBy: { startDate: 'asc' },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    });

    const hasMore = events.length > limit;
    const resultEvents = hasMore ? events.slice(0, limit) : events;
    const nextCursor = hasMore && resultEvents.length > 0 ? resultEvents[resultEvents.length - 1].id : undefined;

    if (resultEvents.length === 0) {
      return {
        surveyList: [],
        pagination: {
          cursor: undefined,
          hasMore: false,
          limit,
        },
      };
    }

    // Kullanıcının event istatistiklerine göre status/progress hesapla
    const stats = await this.prisma.wishboxStats.findMany({
      where: {
        userId,
        eventId: { in: resultEvents.map((e) => e.id) },
      },
    });

    const statsMap = new Map<string, (typeof stats)[number]>();
    stats.forEach((s) => statsMap.set(s.eventId, s));

    const surveyList: SurveyCard[] = resultEvents.map((event) => {
      const eventStats = statsMap.get(event.id);
      const totalParticipated = eventStats?.totalParticipated ?? 0;

      let status: SurveyStatusType = 'start';
      if (totalParticipated > 0 && totalParticipated < 3) {
        status = 'continue';
      } else if (totalParticipated >= 3) {
        status = 'viewresults';
      }

      const progress = Math.min(100, totalParticipated * 25);

      return {
        id: event.id,
        title: event.title,
        description: event.description || '',
        type: event.eventType || 'SURVEY',
        duration: '5-10 dk',
        points: 100 + (totalParticipated || 1) * 25,
        status,
        progress,
      };
    });

    return {
      surveyList,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  async getBrandHistoryPosts(
    brandId: string,
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<FeedResponse> {
    return this.getBrandTrends(brandId, userId, options);
  }

  async getBrandHistoryEvents(
    brandId: string,
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<BrandHistoryEventsResponse> {
    const result = await this.getBrandEvents(brandId, userId, options);
    return {
      items: result.items,
      pagination: result.pagination,
    };
  }

  /**
   * Markaya ait product group'ları listele (sadece group bilgileri)
   */
  async getBrandProductGroups(
    brandId: string,
    options?: { cursor?: string; limit?: number; productLimit?: number }
  ): Promise<{
    items: BrandProductGroup[];
    pagination: {
      cursor?: string;
      hasMore: boolean;
      limit: number;
    };
  }> {
    try {
      const brand = await this.prisma.brand.findUnique({
        where: { id: brandId },
        select: { name: true },
      });

      if (!brand) {
        throw new NotFoundError('Brand not found');
      }

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
      const productLimit =
        options?.productLimit && options.productLimit > 0 ? Math.min(options.productLimit, 50) : 5;
      const cursor = options?.cursor;

      const groups = await this.prisma.productGroup.findMany({
        where: {
          products: {
            some: { brand: brand.name },
          },
          ...(cursor && {
            id: {
              gt: cursor,
            },
          }),
        },
        orderBy: {
          id: 'asc',
        },
        take: limit + 1,
        include: {
          products: {
            where: { brand: brand.name },
            orderBy: { id: 'asc' },
            take: productLimit + 1,
            include: {
              contentPosts: {
                select: {
                  id: true,
                  likesCount: true,
                  sharesCount: true,
                  favoritesCount: true,
                },
              },
            },
          },
        },
      });

      const hasMore = groups.length > limit;
      const resultGroups = hasMore ? groups.slice(0, limit) : groups;
      const nextCursor = hasMore && resultGroups.length > 0 ? resultGroups[resultGroups.length - 1].id : undefined;

      const items: BrandProductGroup[] = [];

      for (const group of resultGroups) {
        const groupProducts = group.products || [];
        const hasMoreProducts = groupProducts.length > productLimit;
        const limitedProducts = hasMoreProducts ? groupProducts.slice(0, productLimit) : groupProducts;

        const products = limitedProducts.map<BrandProduct>((product) => {
          const stats = this.calculateProductStats(product.contentPosts || []);
          return {
            productId: product.id,
            name: product.name,
            image: product.imageUrl,
            stats,
          };
        });

        items.push({
          productGroupId: group.id,
          productGroupName: group.name,
          products,
        });
      }

      return {
        items,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get brand product groups for ${brandId}:`, error);
      throw error;
    }
  }

  /**
   * Belirli bir product group için products listesi (pagination ile)
   */
  async getBrandProductsByGroup(
    brandId: string,
    productGroupId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<BrandProductsResponse> {
    try {
      const brand = await this.prisma.brand.findUnique({
        where: { id: brandId },
        select: { name: true },
      });

      if (!brand) {
        throw new NotFoundError('Brand not found');
      }

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
      const cursor = options?.cursor;

      const whereClause: any = {
        brand: brand.name,
        groupId: productGroupId === 'ungrouped' ? null : productGroupId,
      };

      if (cursor) {
        whereClause.id = {
          gt: cursor,
        };
      }

      const products = await this.prisma.product.findMany({
        where: whereClause,
        include: {
          contentPosts: {
            select: {
              id: true,
              likesCount: true,
              sharesCount: true,
              favoritesCount: true,
            },
          },
        },
        orderBy: {
          id: 'asc',
        },
        take: limit + 1,
      });

      const hasMore = products.length > limit;
      const resultProducts = hasMore ? products.slice(0, limit) : products;
      const nextCursor = hasMore && resultProducts.length > 0 ? resultProducts[resultProducts.length - 1].id : undefined;
    const items: BrandProduct[] = resultProducts.map((product) => {
      const stats = this.calculateProductStats(product.contentPosts || []);

      return {
        productId: product.id,
        name: product.name,
        image: product.imageUrl,
        stats,
      };
    });

      return {
        items,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get brand products by group for ${brandId}/${productGroupId}:`, error);
      throw error;
    }
  }

  /**
   * Belirli bir product group ID'si için products listesi (brandId olmadan)
   */
  async getProductsByGroupId(
    productGroupId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<BrandProductsResponse> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 5;
    const cursor = options?.cursor;

    const whereClause: any = {
      groupId: productGroupId === 'ungrouped' ? null : productGroupId,
    };

    if (cursor) {
      whereClause.id = {
        gt: cursor,
      };
    }

    const products = await this.prisma.product.findMany({
      where: whereClause,
      include: {
        contentPosts: {
          select: {
            id: true,
            likesCount: true,
            sharesCount: true,
            favoritesCount: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
      take: limit + 1,
    });

    const hasMore = products.length > limit;
    const resultProducts = hasMore ? products.slice(0, limit) : products;
    const nextCursor = hasMore && resultProducts.length > 0 ? resultProducts[resultProducts.length - 1].id : undefined;
    const items: BrandProduct[] = resultProducts.map((product) => {
      const stats = this.calculateProductStats(product.contentPosts || []);

      return {
        productId: product.id,
        name: product.name,
        image: product.imageUrl,
        stats,
      };
    });

    return {
      items,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  /**
   * Markaya ait ürünleri listele (infinity scroll için pagination ile)
   * Her product group içindeki products array'i için de pagination uygulanır
   * @deprecated Use getBrandProductsBatch instead
   */
  async getBrandProducts(
    brandId: string,
    options?: { cursor?: string; limit?: number; productLimit?: number }
  ): Promise<{
    items: BrandProductGroup[];
    pagination: {
      cursor?: string;
      hasMore: boolean;
      limit: number;
    };
  }> {
    try {
      // Brand'a ait ürünleri bul (Product.brand field'ından)
      // Önce brand name'i al
      const brand = await this.prisma.brand.findUnique({
        where: { id: brandId },
        select: { name: true },
      });

      if (!brand) {
        throw new NotFoundError('Brand not found');
      }

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
      const productLimit = options?.productLimit && options.productLimit > 0 ? Math.min(options.productLimit, 50) : 20;
      const cursor = options?.cursor;

      // Brand name'e göre ürünleri bul (pagination ile)
      const whereClause: any = {
        brand: brand.name,
      };

      if (cursor) {
        // Cursor-based pagination için productId kullan
        whereClause.id = {
          gt: cursor,
        };
      }

      const products = await this.prisma.product.findMany({
        where: whereClause,
        include: {
          group: true,
          contentPosts: {
            select: {
              id: true,
              likesCount: true,
              sharesCount: true,
              favoritesCount: true,
            },
          },
        },
        orderBy: {
          id: 'asc',
        },
        take: limit + 1, // Bir fazla al ki hasMore'u kontrol edebilelim
      });

      const hasMore = products.length > limit;
      const resultProducts = hasMore ? products.slice(0, limit) : products;
      const nextCursor = hasMore && resultProducts.length > 0 ? resultProducts[resultProducts.length - 1].id : undefined;

      // Product groups'a göre grupla
      const groupsMap = new Map<string, { name: string; products: BrandProduct[] }>();

      for (const product of resultProducts) {
        const groupId = product.groupId || 'ungrouped';
        const groupName = product.group?.name || 'Ungrouped';

        if (!groupsMap.has(groupId)) {
          groupsMap.set(groupId, { name: groupName, products: [] });
        }

        const groupData = groupsMap.get(groupId)!;

        const stats = this.calculateProductStats(product.contentPosts || []);

        groupData.products.push({
          productId: product.id,
          name: product.name,
          image: product.imageUrl,
          stats,
        });
      }

      // Map'i array'e dönüştür ve her group içindeki products için pagination ekle
      const items: BrandProductGroup[] = Array.from(groupsMap.entries()).map(([groupId, groupData]) => {
        const groupProducts = groupData.products;
        const groupHasMore = groupProducts.length > productLimit;
        const paginatedProducts = groupHasMore ? groupProducts.slice(0, productLimit) : groupProducts;

        return {
          productGroupId: groupId,
          productGroupName: groupData.name,
          products: paginatedProducts,
        };
      });

      return {
        items,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get brand products for ${brandId}:`, error);
      throw error;
    }
  }

  /**
   * Marka ürününe ait deneyim paylaşımlarını listele (cursor-based pagination)
   */
  async getBrandProductExperiences(
    brandId: string,
    productId: string,
    userId?: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<FeedResponse> {
    try {
      // Brand name'i al
      const brand = await this.prisma.brand.findUnique({
        where: { id: brandId },
        select: { name: true },
      });

      if (!brand) {
        throw new NotFoundError('Brand not found');
      }

      // Product'ı kontrol et
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, brand: true },
      });

      if (!product || product.brand !== brand.name) {
        throw new NotFoundError('Product not found or does not belong to this brand');
      }

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
      const cursor = options?.cursor;

      const whereClause: any = {
        productId: productId,
        type: ContentPostType.EXPERIENCE,
      };

      if (cursor) {
        whereClause.id = {
          lt: cursor,
        };
      }

      // Ürüne ait deneyim paylaşımlarını getir (EXPERIENCE type posts) - cursor-based pagination
      const posts = await this.prisma.contentPost.findMany({
        where: whereClause,
        include: {
          user: {
            include: {
              profile: true,
              titles: {
                orderBy: { earnedAt: 'desc' },
                take: 1,
              },
              avatars: {
                where: { isActive: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
          product: {
            include: {
              group: true,
            },
          },
          likes: true,
          comments: true,
          favorites: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // Bir fazla al ki hasMore'u kontrol edebilelim
      });

      const hasMore = posts.length > limit;
      const resultPosts = hasMore ? posts.slice(0, limit) : posts;
      const nextCursor = hasMore && resultPosts.length > 0 ? resultPosts[resultPosts.length - 1].id : undefined;

      // Feed items'a dönüştür
      const feedItems = await this.mapPostsToFeedItems(resultPosts, userId);

      return {
        items: feedItems,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get brand product experiences for ${brandId}/${productId}:`, error);
      throw error;
    }
  }

  /**
   * Marka ürününe ait karşılaştırma gönderilerini listele
   */
  async getBrandProductComparisons(
    brandId: string,
    productId: string,
    userId?: string,
    page: number = 1,
    limit: number = 12,
  ): Promise<FeedItem[]> {
    try {
      // Brand name'i al
      const brand = await this.prisma.brand.findUnique({
        where: { id: brandId },
        select: { name: true },
      });

      if (!brand) {
        throw new NotFoundError('Brand not found');
      }

      // Product'ı kontrol et
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, brand: true },
      });

      if (!product || product.brand !== brand.name) {
        throw new NotFoundError('Product not found or does not belong to this brand');
      }

      const safePage = page > 0 ? page : 1;
      const safeLimit = Math.min(Math.max(limit, 1), 50);

      // Ürüne ait karşılaştırma gönderilerini getir (COMPARE type posts) - sayfalı
      const posts = await this.prisma.contentPost.findMany({
        where: {
          OR: [
            { productId: productId, type: ContentPostType.COMPARE },
            {
              comparison: {
                OR: [
                  { product1Id: productId },
                  { product2Id: productId },
                ],
              },
            },
          ],
        },
        include: {
          user: {
            include: {
              profile: true,
              titles: {
                orderBy: { earnedAt: 'desc' },
                take: 1,
              },
              avatars: {
                where: { isActive: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
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
          likes: true,
          comments: true,
          favorites: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      });

      // Feed items'a dönüştür
      const feedItems = await this.mapPostsToFeedItems(posts, userId);

      return feedItems;
    } catch (error) {
      logger.error(`Failed to get brand product comparisons for ${brandId}/${productId}:`, error);
      throw error;
    }
  }

  /**
   * Marka ürünlerine dair haberleri listele
   */
  async getBrandProductNews(
    brandId: string,
    productId: string,
    _userId?: string,
    page: number = 1,
    limit: number = 12,
  ): Promise<
    Array<{
      id: string;
      title: string;
      description: string;
      source: string;
      date: string;
      image: string;
      url?: string;
      stats: {
        likes: number;
        comments: number;
        share: number;
        bookmarks: number;
      };
    }>
  > {
    try {
      // Brand name'i al
      const brand = await this.prisma.brand.findUnique({
        where: { id: brandId },
        select: { name: true },
      });

      if (!brand) {
        throw new NotFoundError('Brand not found');
      }

      // Product'ı kontrol et
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, brand: true },
      });

      if (!product || product.brand !== brand.name) {
        throw new NotFoundError('Product not found or does not belong to this brand');
      }

      const safePage = page > 0 ? page : 1;
      const safeLimit = Math.min(Math.max(limit, 1), 50);

      // Ürüne dair haberleri getir (şu an için tüm post tiplerini dahil ediyoruz) - sayfalı
      // Haberler için özel bir tip yok, feed tipinde olabilir
      const posts = await this.prisma.contentPost.findMany({
        where: {
          productId: productId,
          // Haberler için özel bir filtre yok, tüm post tiplerini dahil ediyoruz
        },
        include: {
          user: {
            include: {
              profile: true,
              titles: {
                orderBy: { earnedAt: 'desc' },
                take: 1,
              },
              avatars: {
                where: { isActive: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
          product: {
            include: {
              group: true,
            },
          },
          likes: true,
          comments: true,
          favorites: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      });

      // Haber response formatına dönüştür
      const newsItems = posts.map((post) => {
        const likes = (post as any).likesCount ?? post.likes?.length ?? 0;
        const comments = (post as any).commentsCount ?? post.comments?.length ?? 0;
        // shares relation is not selected on the typed result; rely on sharesCount if present
        const shares = (post as any).sharesCount ?? 0;
        const bookmarks = (post as any).favoritesCount ?? post.favorites?.length ?? 0;

        const title = (post as any).title || (post as any).body?.slice(0, 80) || 'News';
        const description = (post as any).body || '';
        const source = brand.name || 'tipbox';
        const image =
          (post as any).imageUrl ||
          post.product?.imageUrl ||
          post.product?.group?.imageUrl ||
          (post as any).thumbnailUrl ||
          '';

        return {
          id: post.id,
          title,
          description,
          source,
          date: post.createdAt.toISOString(),
          image,
          url: (post as any).externalUrl || undefined,
          stats: {
            likes,
            comments,
            share: shares,
            bookmarks,
          },
        };
      });

      return newsItems;
    } catch (error) {
      logger.error(`Failed to get brand product news for ${brandId}/${productId}:`, error);
      throw error;
    }
  }

  /**
   * Posts'ları FeedItem'lara dönüştür
   */
  private async mapPostsToFeedItems(posts: any[], userId?: string, inventoriesMap?: Map<string, any>): Promise<FeedItem[]> {
    // User inventories for benchmark isOwned check
    const inventories = userId
      ? await this.prisma.inventory.findMany({
          where: { userId },
          select: { productId: true },
        })
      : [];
    const ownedProductIds = new Set(inventories.map((inv) => String(inv.productId)));

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
        postMediaMap.get(media.postId)!.push(media.mediaUrl);
      });
    }

    // Map posts to feed items
    return posts.map((post) => {
      const userBase = {
        id: post.user.id,
        name: post.user.profile?.displayName || post.user.email || 'Anonymous',
        title: post.user.titles?.[0]?.title || '',
        avatar: post.user.avatars?.[0]?.imageUrl || '',
      };

      const stats = {
        likes: post.likesCount ?? 0,
        comments: post.commentsCount ?? 0,
        shares: post.sharesCount ?? 0,
        bookmarks: post.favoritesCount ?? 0,
      };

      const basePost = {
        id: post.id,
        user: userBase,
        stats,
        createdAt: post.createdAt.toISOString(),
      };

      // Context bilgisi (FeedService ile uyumlu)
      const contextType = this.mapContextTypeForBrand(post);
      const contextData = this.buildBrandContextData(post, ownedProductIds);

      const basePostWithContext = {
        ...basePost,
        contextType,
        contextData,
      };

      // Get images for this post from PostMedia (orderIndex'e göre sıralı)
      let images = postMediaMap.get(post.id) || [];
      // PostMedia'da görsel yoksa, ürün görselini fallback olarak kullan
      if ((!images || images.length === 0) && post.product?.imageUrl) {
        images = [post.product.imageUrl];
      }

      // Map based on post type
      switch (post.type) {
        case ContentPostType.FREE:
          return this.mapToPostItem(post, basePostWithContext, FeedItemType.POST, images);
        case ContentPostType.EXPERIENCE:
          return this.mapToExperienceItem(post, basePostWithContext, FeedItemType.EXPERIENCE, images, ownedProductIds, inventoriesMap);
        case ContentPostType.UPDATE:
          return this.mapToExperienceItem(post, basePostWithContext, FeedItemType.UPDATE, images, ownedProductIds, inventoriesMap);
        case ContentPostType.COMPARE:
          return this.mapToBenchmarkItem(post, basePostWithContext, ownedProductIds, images);
        case ContentPostType.QUESTION:
          return this.mapToPostItem(post, basePostWithContext, FeedItemType.QUESTION, images);
        case ContentPostType.TIPS:
          return this.mapToTipsAndTricksItem(post, basePostWithContext, images);
        default:
          return this.mapToPostItem(post, basePostWithContext, FeedItemType.POST, images);
      }
    });
  }

  /**
   * Brand feed için context type hesaplama (FeedService.mapContextType ile uyumlu)
   */
  private mapContextTypeForBrand(post: any): 'product' | 'product_group' | 'sub_category' {
    if (post?.productId) {
      return 'product';
    }
    if (post?.productGroupId) {
      return 'product_group';
    }
    return 'sub_category';
  }

  /**
   * Brand feed için contextData üretimi (FeedService.buildContextData'ye benzer)
   */
  private buildBrandContextData(post: any, ownedProductIds?: Set<string>): ContextData {
    const contextType = this.mapContextTypeForBrand(post);

    if (contextType === 'product' && post.product) {
      const product = post.product;
      const group = product.group;
      const subCategory = (group as any)?.subCategory;

      return {
        id: String(product.id),
        name: product.name,
        subName: group?.name || subCategory?.name || '',
        image: product.imageUrl || null,
        isOwned: ownedProductIds ? ownedProductIds.has(String(product.id)) : undefined,
      };
    }

    if (contextType === 'product_group') {
      const group = post.productGroup;
      if (group) {
        const subCategory = (group as any).subCategory;
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

  private getProductBase(product: any): any | null {
    if (!product) return null;
    return {
      id: String(product.id),
      name: product.name,
      subName: product.subName || product.brand || product.group?.name || '',
      image: product.imageUrl || null,
    };
  }

  private calculateProductStats(
    contentPosts: Array<{ likesCount?: number | null; sharesCount?: number | null; favoritesCount?: number | null }>
  ): { reviews: number; likes: number; share: number } {
    const reviews = contentPosts.length;
    const likes = contentPosts.reduce((sum, post) => sum + (post.likesCount ?? 0), 0);
    const share = contentPosts.reduce((sum, post) => sum + (post.sharesCount ?? 0), 0);
    return { reviews, likes, share };
  }

  private mapToPostItem(
    post: any,
    basePost: any,
    type: FeedItemType.POST | FeedItemType.QUESTION,
    images: string[] = []
  ): FeedItem {
    return {
      type,
      data: {
        ...basePost,
        content: post.body,
        images,
      },
    };
  }

  private mapToExperienceItem(
    post: any,
    basePost: any,
    type: FeedItemType.EXPERIENCE | FeedItemType.UPDATE,
    images: string[] = [],
    _ownedProductIds?: Set<string>,
    inventoriesMap?: Map<string, any>
  ): FeedItem {
    // Önce inventory'den gelen experience verilerini kontrol et
    let experienceContent: ExperienceContent[] = [];
    if (inventoriesMap && post.userId && post.productId) {
      const inventoryKey = `${post.userId}-${post.productId}`;
      const inventory = inventoriesMap.get(inventoryKey);
      
      if (inventory && inventory.productExperiences && inventory.productExperiences.length > 0) {
        // Inventory'den gelen experience verilerini kullan
        experienceContent = this.buildExperienceSectionsFromInventory(
          inventory.productExperiences,
          inventory.experienceSummary
        );
        
        // Inventory'den gelen görselleri de kullan
        if (inventory.media && inventory.media.length > 0) {
          images = inventory.media.map((m: any) => m.mediaUrl);
        }
      }
    }
    
    // Eğer inventory'den veri gelmediyse, body'den parse et
    if (experienceContent.length === 0) {
      experienceContent = this.parseExperienceContent(post.body);
    }

    // Get tags
    const tags = post.tags?.map((t: any) => t.tag) || post.contentPostTags?.map((t: any) => t.tag) || [];

    const productBase = this.getProductBase(post.product);

    if (type === FeedItemType.UPDATE) {
      const relatedPost = {
        id: post.id,
        product: productBase,
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
            const priceRating = this.calculateExperienceRating(String(item.content || '') + '-price');
            const usageRating = this.calculateExperienceRating(String(item.content || '') + '-usage');
            
            transformedContent.push({
              title: 'Price and Shopping Experience',
              content: item.content || '',
              rating: priceRating,
            });
            
            transformedContent.push({
              title: 'Product and Usage Experience',
              content: item.content || '',
              rating: usageRating,
            });
            hasPrice = true;
            hasUsage = true;
          } else if (item.title === 'Price and Shopping Experience') {
            transformedContent.push({
              title: item.title,
              content: item.content || '',
              rating: item.rating && item.rating > 0
                ? item.rating
                : this.calculateExperienceRating(String(item.content || '') + '-price'),
            });
            hasPrice = true;
          } else if (item.title === 'Product and Usage Experience') {
            transformedContent.push({
              title: item.title,
              content: item.content || '',
              rating: item.rating && item.rating > 0
                ? item.rating
                : this.calculateExperienceRating(String(item.content || '') + '-usage'),
            });
            hasUsage = true;
          }
        }
        
        // If only one type exists, add the missing one
        if (hasPrice && !hasUsage) {
          const usageRating = this.calculateExperienceRating(String(transformedContent[0]?.content || '') + '-usage');
          transformedContent.push({
            title: 'Product and Usage Experience',
            content: transformedContent[0]?.content || '',
            rating: usageRating,
          });
        } else if (hasUsage && !hasPrice) {
          const priceRating = this.calculateExperienceRating(String(transformedContent[0]?.content || '') + '-price');
          transformedContent.unshift({
            title: 'Price and Shopping Experience',
            content: transformedContent[0]?.content || '',
            rating: priceRating,
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
    const generateRating = () =>
      extractedRating && extractedRating > 0
        ? extractedRating
        : this.calculateExperienceRating(body);

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
      const priceRating = this.calculateExperienceRating(body + '-price');
      const usageRating = this.calculateExperienceRating(body + '-usage');
      
      content.push({
        title: 'Price and Shopping Experience',
        content: body,
        rating: priceRating,
      });
      
      content.push({
        title: 'Product and Usage Experience',
        content: body,
        rating: usageRating,
      });
    }

    return content;
  }

  /**
   * Inventory'den gelen experience verilerini ExperienceContent[] formatına dönüştür
   */
  private buildExperienceSectionsFromInventory(
    experiences: Array<{ title: string; experienceText: string }>,
    summary?: string | null
  ): ExperienceContent[] {
    const sections: {
      price: ExperienceContent | null;
      usage: ExperienceContent | null;
    } = {
      price: null,
      usage: null,
    };

    for (const exp of experiences) {
      const normalizedTitle = (exp.title || '').toLowerCase();
      if (!sections.price && normalizedTitle.includes('price')) {
        sections.price = {
          title: 'Price and Shopping Experience',
          content: exp.experienceText,
          rating: this.calculateExperienceRating(exp.experienceText + '-price'),
        };
        continue;
      }

      if (
        !sections.usage &&
        (normalizedTitle.includes('product') || normalizedTitle.includes('usage'))
      ) {
        sections.usage = {
          title: 'Product and Usage Experience',
          content: exp.experienceText,
          rating: this.calculateExperienceRating(exp.experienceText + '-usage'),
        };
      }
    }

    const fallbackText =
      summary || experiences[0]?.experienceText || 'Experience details not provided.';

    if (!sections.price) {
      sections.price = {
        title: 'Price and Shopping Experience',
        content: fallbackText,
        rating: this.calculateExperienceRating(fallbackText + '-price'),
      };
    }

    if (!sections.usage) {
      const usageText = experiences[1]?.experienceText || fallbackText;
      sections.usage = {
        title: 'Product and Usage Experience',
        content: usageText,
        rating: this.calculateExperienceRating(usageText + '-usage'),
      };
    }

    return [sections.price, sections.usage].filter(
      (section): section is ExperienceContent => section !== null,
    );
  }

  /**
   * Experience text'inden rating hesapla (basit hash-based)
   */
  private calculateExperienceRating(text: string): number {
    if (!text) return 50;
    // Basit bir hash fonksiyonu ile 30-70 arası rating üret
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash % 41) + 30; // 30-70 arası
  }

  private mapToBenchmarkItem(
    post: any,
    basePost: any,
    _ownedProductIds: Set<string>,
    images: string[] = []
  ): FeedItem {
    const comparison = post.comparison;
    if (!comparison) {
      return this.mapToPostItem(post, basePost, FeedItemType.POST, images);
    }

    return {
      type: FeedItemType.BENCHMARK,
      data: {
        ...basePost,
        content: comparison.comparisonSummary || post.body,
      },
    };
  }

  private mapToTipsAndTricksItem(post: any, basePost: any, images: string[] = []): FeedItem {
    const product = this.getProductBase(post.product);
    const tag = post.tags?.[0]?.tag || post.contentPostTags?.[0]?.tag || '';

    return {
      type: FeedItemType.TIPS_AND_TRICKS,
      data: {
        ...basePost,
        product: product,
        content: post.body,
        tag,
        images,
      },
    };
  }

}


