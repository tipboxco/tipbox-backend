import { Prisma } from '@prisma/client';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { FeedItem, FeedItemType, FeedResponse, ContextData, ExperiencePost, ExperienceContent, BasePost } from '../../interfaces/feed/feed.dto';
import { ContentPostType } from '../../domain/content/content-post-type.enum';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import logger from '../../infrastructure/logger/logger';
import { NotFoundError } from '../../infrastructure/errors/custom-errors';
import { brandToWebsite } from '../../data/brandToWebsite';
import { randomUUID } from 'crypto';
import { ActionLogService } from '../gamification/action-log.service';
import { AchievementProgressService } from '../gamification/achievement-progress.service';
import { MainAction } from '../../domain/gamification/main-action.enum';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const slugify = require('slugify');

/** Reusable product base shape returned by getProductBase */
interface ProductBase {
  id: string;
  name: string;
  subName: string;
  image: string | null;
}

/** Shape of a post row loaded with the heavy include used by feed mapping */
interface PostWithRelations {
  id: string;
  type: string;
  body: string;
  title?: string | null;
  userId: string;
  productId: string | null;
  productGroupId?: string | null;
  subCategoryId?: string | null;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  favoritesCount: number;
  viewsCount?: number;
  isBoosted?: boolean;
  boostedUntil?: Date | null;
  productStatus?: string | null;
  createdAt: Date;
  user: {
    id: string;
    email: string | null;
    profile: { displayName: string | null } | null;
    titles: Array<{ title: string; earnedAt: Date }>;
    avatars: Array<{ imageUrl: string | null; isActive: boolean; createdAt: Date }>;
  };
  product: {
    id: string;
    name: string;
    subName: string | null;
    imageUrl: string | null;
    brandId: string | null;
    group: { id: string; name: string; imageUrl: string | null; subCategory?: { id: string; name: string; imageUrl: string | null; mainCategory?: { id: string; name: string; imageUrl: string | null } | null } | null } | null;
  } | null;
  comparison?: {
    comparisonSummary: string | null;
    product1: { id: string; name: string; subName: string | null; imageUrl: string | null; group?: { name: string } | null } | null;
    product2: { id: string; name: string; subName: string | null; imageUrl: string | null; group?: { name: string } | null } | null;
    scores?: unknown[];
  } | null;
  tip?: unknown | null;
  tags?: Array<{ tag: string }>;
  contentPostTags?: Array<{ tag: string }>;
  likes?: unknown[];
  comments?: unknown[];
  favorites?: unknown[];
  media?: Array<{ mediaUrl: string; orderIndex: number }>;
  subCategory?: { id: string; name: string; imageUrl: string | null; mainCategory?: { id: string; name: string; imageUrl: string | null } | null } | null;
  mainCategory?: { id: string; name: string; imageUrl: string | null } | null;
  productGroup?: {
    id: string;
    name: string;
    imageUrl: string | null;
    subCategory?: { id: string; name: string; imageUrl: string | null; mainCategory?: { id: string; name: string; imageUrl: string | null } | null } | null;
  } | null;
  // News-related fields present in some queries
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  externalUrl?: string | null;
}

/** Shape of an inventory row with media */
interface InventoryWithMedia {
  id: string;
  userId: string;
  productId: string;
  media: Array<{ mediaUrl: string }>;
}

/** Base post shape for feed mapping helpers */
interface FeedBasePost {
  id: string;
  user: { id: string; name: string; title: string; avatar: string };
  stats: { likes: number; comments: number; shares: number; bookmarks: number };
  createdAt: string;
  contextType: string;
  contextData: ContextData;
  isBoosted?: boolean;
  boostedUntil?: string | null;
  source?: string;
}

/** Brand entry from brandToWebsite data */
interface BrandWebsiteEntry {
  id: number;
  brand: string;
  website: string;
}

/** Badge earned result */
interface BadgeEarned {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  rarity: string | null;
}
const slugifyOptions = {
  lower: true,
  strict: true,
  locale: 'tr',
  trim: true,
};
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

/** Kategoriye göre markalar listesi - pagination ile */
export interface BrandsByCategoryResponse {
  items: BrandItem[];
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
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

/** Markanın ürünleri kategori (level 2) bazında gruplu response */
export interface BrandProductGroupsByCategoryResponse {
  items: Array<{
    categoryId: string;
    categoryName: string;
    products: BrandProduct[];
  }>;
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
    posts: number;
    news: number;
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
  type: string; // Anket tipi (EventType veya özel tip)
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
  private readonly prisma: ReturnType<typeof getPrisma>;
  private readonly actionLogService: ActionLogService;
  private readonly achievementProgressService: AchievementProgressService;

  constructor() {
    this.prisma = getPrisma();
    this.actionLogService = new ActionLogService();
    this.achievementProgressService = new AchievementProgressService();
  }

  /**
   * Brand'i id veya externalId ile bulur (EP'lerde path'te id veya externalId kabul etmek için).
   */
  private async resolveBrandByIdOrExternalId(brandId: string): Promise<{
    id: string;
    externalId: string | null;
    name: string;
  } | null> {
    return this.prisma.brand.findFirst({
      where: {
        OR: [{ id: brandId }, { externalId: brandId }],
      },
      select: { id: true, externalId: true, name: true },
    });
  }

  /**
   * Product cursor'ı id veya metadata->>'externalId' ile resolve eder (frontend product id veya externalId gönderebilir).
   */
  private async resolveProductIdForCursor(cursor: string): Promise<string> {
    const byId = await this.prisma.product.findUnique({
      where: { id: cursor },
      select: { id: true },
    });
    if (byId) return byId.id;
    const byExternalId = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM products WHERE metadata->>'externalId' = ${cursor} LIMIT 1
    `;
    if (byExternalId?.length) return byExternalId[0].id;
    throw new NotFoundError(`Product not found with id or externalId: ${cursor}`);
  }

  /**
   * Media path'ini tam URL'ye çevirir
   * resolveMediaUrl kullanarak doğru formatı garanti eder
   */
  private buildFullMediaUrl(path: string | null | undefined): string | null {
    return resolveMediaUrl(path);
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

      return categories.map((category) => {

        return {
          categoryId: category.id,
          name: category.name,
          image: category.imageUrl
        };
      });
    } catch (error) {
      logger.error('Failed to get all brand categories:', error);
      throw error;
    }
  }

  /**
   * Kategoriye göre markaları listele (pagination ile)
   * categoryId UUID veya kategori adı olabilir
   */
  async getBrandsByCategoryId(
    categoryId: string,
    options?: { page?: number; limit?: number }
  ): Promise<BrandsByCategoryResponse> {
    try {
      const page = options?.page && options.page >= 1 ? options.page : 1;
      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
      const skip = (page - 1) * limit;

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
          imageUrl: { not: null },
        },
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
        orderBy: [
          { products: { _count: 'desc' } },
          { id: 'asc' },
        ],
        skip,
        take: limit + 1,
      });

      const hasMore = brands.length > limit;
      const items = (hasMore ? brands.slice(0, limit) : brands).map((brand) => ({
        brandId: brand.id,
        name: brand.name,
        image: brand.imageUrl?.replace(/token=[^&]*/, `token=${process.env.LOGO_DEV_API_TOKEN}`) ?? null,
      }));

      return {
        items,
        pagination: {
          page,
          limit,
          hasMore,
        },
      };
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
    // Brand kontrolü
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
    });

    if (!brand) {
      throw new NotFoundError(`Brand not found: ${brandId}`);
    }

    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor;
    const now = new Date();

    // BrandSurvey modelini kullan - aktif survey'leri getir (startsAt <= now <= endsAt)
    const whereClause: Prisma.BrandSurveyWhereInput = {
      brandId,
      startsAt: { lte: now },
      endsAt: { gte: now },
      ...(cursor && { id: { gt: cursor } }),
    };

    const surveys = await this.prisma.brandSurvey.findMany({
      where: whereClause,
      include: {
        questions: true,
      },
      orderBy: { startsAt: 'asc' },
      take: limit + 1, // Bir fazla al ki hasMore'u kontrol edebilelim
    });

    const hasMore = surveys.length > limit;
    const resultSurveys = hasMore ? surveys.slice(0, limit) : surveys;
    const nextCursor = hasMore && resultSurveys.length > 0 ? resultSurveys[resultSurveys.length - 1].id : undefined;

    // Kullanıcının survey cevaplarını kontrol et
    const surveyIds = resultSurveys.map((s) => s.id);
    const userAnswers = await this.prisma.brandSurveyAnswer.findMany({
      where: {
        userId,
        question: {
          surveyId: { in: surveyIds },
        },
      },
      include: {
        question: {
          select: {
            surveyId: true,
          },
        },
      },
    });

    // Her survey için kullanıcının kaç soruya cevap verdiğini hesapla
    const surveyAnswerCounts = new Map<string, number>();
    userAnswers.forEach((answer) => {
      const surveyId = answer.question.surveyId;
      surveyAnswerCounts.set(surveyId, (surveyAnswerCounts.get(surveyId) || 0) + 1);
    });

    const surveyList: SurveyCard[] = resultSurveys.map((survey) => {
      const answeredCount = surveyAnswerCounts.get(survey.id) || 0;
      const totalQuestions = survey.questions.length;

      let status: SurveyStatusType = 'start';
      if (answeredCount > 0 && answeredCount < totalQuestions) {
        status = 'continue';
      } else if (answeredCount >= totalQuestions) {
        status = 'viewresults';
      }

      const progress = totalQuestions > 0 ? Math.min(100, Math.round((answeredCount / totalQuestions) * 100)) : 0;

      return {
        id: survey.id,
        title: survey.title,
        description: survey.description || '',
        type: 'survey',
        duration: '5-10 dk',
        points: 100 + answeredCount * 25,
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

      let bannerImageUrl: string | null = null;
      
      if (brand.imageUrl) {
        bannerImageUrl = resolveMediaUrl(brand.imageUrl);
      }

      return {
        brandId: brand.id,
        name: brand.name,
        description: brand.description,
        bannerImage: bannerImageUrl,
        followers: followersCount,
        isJoined,
      };
    } catch (error) {
      logger.error(`Failed to get brand catalog for ${brandId}:`, error);
      throw error;
    }
  }

  /**
   * Markayı takip et (BridgeFollower tablosuna kayıt ekle).
   * Zaten takip ediyorsa idempotent: mevcut kayıt döner.
   */
  async followBrand(brandId: string, userId: string): Promise<{ isJoined: true; followers: number }> {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true },
    });
    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    await this.prisma.bridgeFollower.upsert({
      where: {
        userId_brandId: { userId, brandId },
      },
      update: {},
      create: {
        userId,
        brandId,
      },
    });

    const followersCount = await this.prisma.bridgeFollower.count({
      where: { brandId },
    });

    // Gamification: Brand follow tracking (fire-and-forget)
    this.actionLogService
      .logAction({
        userId,
        mainAction: MainAction.JOIN,
        actionTypeCode: 'BRAND',
        entityType: 'brand',
        entityId: brandId,
      })
      .catch((err) => {
        logger.warn('Failed to log brand follow action', { userId, brandId, error: err instanceof Error ? err.message : String(err) });
      });

    this.achievementProgressService
      .incrementProgressByCode(userId, MainAction.JOIN, 'BRAND', 1)
      .catch((err) => {
        logger.warn('Failed to increment brand follow progress', { userId, brandId, error: err instanceof Error ? err.message : String(err) });
      });

    return { isJoined: true, followers: followersCount };
  }

  /**
   * Markayı bırak (BridgeFollower tablosundan kayıt sil).
   * Takip etmiyorsa idempotent: 204/200 ile başarılı kabul edilir.
   */
  async leaveBrand(brandId: string, userId: string): Promise<{ isJoined: false; followers: number }> {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true },
    });
    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    await this.prisma.bridgeFollower.deleteMany({
      where: {
        userId,
        brandId,
      },
    });

    const followersCount = await this.prisma.bridgeFollower.count({
      where: { brandId },
    });
    return { isJoined: false, followers: followersCount };
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
          externalId: true,
          name: true,
          description: true,
          imageUrl: true,
        },
      });

      if (!brand) {
        throw new NotFoundError('Brand not found');
      }

      // ✅ DÜZELTME: Product.brandId Brand.externalId'ye referans veriyor, Brand.id'ye değil
      if (!brand.externalId) {
        return {
          brandId: brand.id,
          name: brand.name,
          posts: [],
          pagination: {
            cursor: undefined,
            hasMore: false,
            limit: options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 10,
          },
        };
      }

      const brandProducts = await this.prisma.product.findMany({
        where: { brandId: brand.externalId },
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
      
      const inventoriesMap = new Map<string, InventoryWithMedia>();
      if (experiencePostIds.length > 0 && options?.userId) {
        const inventories = await this.prisma.inventory.findMany({
          where: {
            userId: options.userId,
            productId: { in: productIds },
          },
          include: {
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

    const whereClause: Prisma.EventWhereInput = {
      status: 'PUBLISHED',
      brandId,
      ...(cursor && { id: { gt: cursor } }),
    };

    const events = await this.prisma.event.findMany({
      where: whereClause,
      orderBy: { startDate: 'asc' },
      take: limit + 1, // Bir fazla al ki hasMore'u kontrol edebilelim
    });

    const hasMore = events.length > limit;
    const resultEvents = hasMore ? events.slice(0, limit) : events;
    const nextCursor = hasMore && resultEvents.length > 0 ? resultEvents[resultEvents.length - 1].id : undefined;

    const stats = await this.prisma.eventStats.findMany({
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
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundError(`Event not found: ${eventId}`);
    }

    const stats = await this.prisma.eventStats.findMany({
      where: { eventId },
    });

    const totalUser = stats.length || 0;
    const totalParticipated = stats.reduce((sum, s) => sum + s.totalParticipated, 0);
    const maxParticipated = Math.max(1, totalParticipated);

    const joined = stats.some((s) => s.userId === userId);

    // Basit bir yüzde hesabı: katılımcı sayısına göre normalize
    const percentage = totalUser === 0 ? 0 : Math.min(100, Math.round((totalParticipated / (totalUser * 5)) * 100));

    // Ödül için event'e bağlı ilk badge reward'u bulmaya çalış
    const reward = await this.prisma.eventReward.findFirst({
      where: { eventId },
      include: {
        user: true,
      },
    });

    const badgeImageUrl = resolveMediaUrl('brandbadge/badge1.png') || '';
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
      // ✅ DÜZELTME: Product.brandId Brand.externalId'ye referans veriyor, Brand.id'ye değil
      if (!brand.externalId) {
        return {
          items: [],
          pagination: {
            cursor: undefined,
            hasMore: false,
            limit: options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20,
          },
        };
      }

      const brandProducts = await this.prisma.product.findMany({
        where: { brandId: brand.externalId },
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

      const whereClause: Prisma.ContentPostWhereInput = {
        productId: { in: productIds },
        ...(cursor && { id: { lt: cursor } }),
      };

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
    // Note: cursor filtering is done in-memory below after distinct dedup

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
    const defaultBadgeImage = resolveMediaUrl('badge/badge1.png') || '';
    
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

    // ✅ DÜZELTME: Toplam puan = BridgeReward + RewardClaim (EVENT_PARTICIPATION, brand'e ait event'lerden)
    // BridgeReward puanları
    const bridgeRewardPoints = allRewards.length * 50;

    // Brand'e ait event'leri bul
    const brandEvents = await this.prisma.event.findMany({
      where: {
        brandId,
      },
      select: {
        id: true,
      },
    });

    const brandEventIds = brandEvents.map((e) => e.id);

    // Event reward'larından gelen puanlar (EVENT_PARTICIPATION)
    // ✅ Prisma JSONB için: Tüm event reward'larını al, sonra JavaScript'te filtrele
    const allEventRewards = await this.prisma.rewardClaim.findMany({
      where: {
        userId,
        sourceType: 'EVENT_PARTICIPATION',
        status: 'CLAIMED',
      },
      select: {
        amount: true,
        metadata: true,
      },
    });

    // Brand'e ait event'lerden gelen reward'ları filtrele
    const eventRewards = allEventRewards.filter((r) => {
      const eventId = (r.metadata as Record<string, unknown> | null)?.eventId as string | undefined;
      return eventId && brandEventIds.includes(eventId);
    });

    const eventRewardPoints = eventRewards.reduce((sum, r) => sum + r.amount, 0);

    // Toplam puan
    const totalPoints = bridgeRewardPoints + eventRewardPoints;

    // Stats: kullanıcıya özel istatistikler
    // ✅ DÜZELTME: Surveys: kullanıcının bu marka için katıldığı survey sayısı (unique survey sayısı)
    const userSurveyAnswers = await this.prisma.brandSurveyAnswer.findMany({
      where: {
        userId,
        question: {
          survey: {
            brandId,
          },
        },
      },
      select: {
        question: {
          select: {
            surveyId: true,
          },
        },
      },
    });

    const uniqueSurveyIds = new Set(userSurveyAnswers.map((a) => a.question.surveyId));
    const userSurveys = uniqueSurveyIds.size;

    // Shares: kullanıcının bu marka için yaptığı bridgePost sayısı
    const userBridgePostsCount = await this.prisma.bridgePost.count({
      where: {
        userId,
        brandId,
      },
    });

    // ✅ DÜZELTME: Events: kullanıcının bu marka için katıldığı event sayısı
    // Brand'e ait event ID'lerini kullan (yukarıda zaten hesaplandı)
    const eventIds = brandEventIds;

    // Kullanıcının bu brand'e ait event'lere katılım sayısı
    const userEvents = await this.prisma.eventStats.findMany({
      where: {
        userId,
        eventId: { in: eventIds },
      },
      distinct: ['eventId'],
    });

    const stats: BrandHistoryStats = {
      surveys: userSurveys,
      shares: userBridgePostsCount,
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

  /**
   * Brand istatistiklerini getir (hafif endpoint)
   */
  async getBrandStats(brandId: string, userId: string): Promise<{
    surveys: number;
    shares: number;
    totalPoints: number;
  }> {
    try {
      // Brand'in var olup olmadığını kontrol et
      const brand = await this.prisma.brand.findUnique({
        where: { id: brandId },
      });

      if (!brand) {
        throw new NotFoundError(`Brand not found: ${brandId}`);
      }

      // Kullanıcının bu marka için kazandığı rozetler
      const allRewards = await this.prisma.bridgeReward.findMany({
        where: {
          userId,
          brandId,
        },
      });

      // ✅ DÜZELTME: Toplam puan = BridgeReward + RewardClaim (EVENT_PARTICIPATION, brand'e ait event'lerden)
      // BridgeReward puanları
      const bridgeRewardPoints = allRewards.length * 50;

      // Brand'e ait event'leri bul
      const brandEventIds = await this.prisma.event.findMany({
        where: {
          brandId,
        },
        select: {
          id: true,
        },
      });

      const eventIds = brandEventIds.map((e) => e.id);


      // ✅ DÜZELTME: Event reward'larından gelen puanlar (EVENT_PARTICIPATION)
      // Prisma JSONB için: Tüm event reward'larını al, sonra JavaScript'te filtrele
      const allEventRewards = await this.prisma.rewardClaim.findMany({
        where: {
          userId,
          sourceType: 'EVENT_PARTICIPATION',
          status: 'CLAIMED',
        },
        select: {
          amount: true,
          metadata: true,
        },
      });

      // Brand'e ait event'lerden gelen reward'ları filtrele
      const eventRewards = allEventRewards.filter((r) => {
        const eventId = (r.metadata as Record<string, unknown> | null)?.eventId as string | undefined;
        return eventId && eventIds.includes(eventId);
      });

      const eventRewardPoints = eventRewards.reduce((sum, r) => sum + r.amount, 0);

      // Toplam puan
      const totalPoints = bridgeRewardPoints + eventRewardPoints;

      // Stats: kullanıcıya özel istatistikler
      // Surveys: kullanıcının bu marka için katıldığı survey sayısı (unique survey sayısı)
      const userSurveyAnswers = await this.prisma.brandSurveyAnswer.findMany({
        where: {
          userId,
          question: {
            survey: {
              brandId,
            },
          },
        },
        select: {
          question: {
            select: {
              surveyId: true,
            },
          },
        },
      });

      const uniqueSurveyIds = new Set(userSurveyAnswers.map((a) => a.question.surveyId));
      const userSurveys = uniqueSurveyIds.size;

      // Shares: kullanıcının bu marka için yaptığı bridgePost sayısı
      const userBridgePostsCount = await this.prisma.bridgePost.count({
        where: {
          userId,
          brandId,
        },
      });

      // ✅ DÜZELTME: Events: kullanıcının bu marka için katıldığı event sayısı
      const userEvents = await this.prisma.eventStats.findMany({
        where: {
          userId,
          eventId: { in: eventIds },
        },
        distinct: ['eventId'],
      });

      return {
        surveys: userSurveys,
        shares: userBridgePostsCount,
        totalPoints,
      };
    } catch (error) {
      logger.error(`Failed to get brand stats for ${brandId}:`, error);
      throw error;
    }
  }

  async getBrandHistoryPoints(
    brandId: string,
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<BrandHistoryPointsResponse> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor;

    // ✅ DÜZELTME: BridgeReward'ları al
    const bridgeRewardWhere: Prisma.BridgeRewardWhereInput = {
      userId,
      brandId,
      ...(cursor && { id: { lt: cursor } }),
    };

    const bridgeRewards = await this.prisma.bridgeReward.findMany({
      where: bridgeRewardWhere,
      include: {
        badge: true,
      },
      orderBy: {
        awardedAt: 'desc',
      },
      take: limit + 1,
    });

    // ✅ DÜZELTME: Event reward'larını da al (EVENT_PARTICIPATION, brand'e ait event'lerden)
    const brandEventIds = await this.prisma.event.findMany({
      where: {
        brandId,
      },
      select: {
        id: true,
      },
    });

    const eventIds = brandEventIds.map((e) => e.id);

    // ✅ Prisma JSONB için: Tüm event reward'larını al, sonra JavaScript'te filtrele
    const allEventRewards = await this.prisma.rewardClaim.findMany({
      where: {
        userId,
        sourceType: 'EVENT_PARTICIPATION',
        status: 'CLAIMED',
      },
      orderBy: {
        claimedAt: 'desc',
      },
      select: {
        id: true,
        amount: true,
        metadata: true,
        claimedAt: true,
        earnedAt: true,
      },
    });

    // Brand'e ait event'lerden gelen reward'ları filtrele
    const eventRewards = allEventRewards.filter((r) => {
      const eventId = (r.metadata as Record<string, unknown> | null)?.eventId as string | undefined;
      return eventId && eventIds.includes(eventId);
    });

    // BridgeReward'ları items'a çevir
    const defaultBadgeImage = resolveMediaUrl('badge/badge1.png') || '';
    const bridgeRewardItems: BrandHistoryPointsItem[] = bridgeRewards.map((r) => ({
      id: r.id,
      title: r.badge.name,
      image: r.badge.imageUrl || defaultBadgeImage,
      points: 50, // Her bridgeReward 50 puan
      createdAt: r.awardedAt.toISOString(),
    }));

    // Event reward'ları items'a çevir
    const eventRewardItems: BrandHistoryPointsItem[] = eventRewards.map((r) => {
      const metadata = r.metadata as Record<string, unknown> | null;
      return {
        id: r.id,
        title: (metadata?.eventName as string) || (metadata?.eventTitle as string) || 'Event Reward',
        image: defaultBadgeImage,
        points: r.amount,
        createdAt: r.claimedAt?.toISOString() || r.earnedAt.toISOString(),
      };
    });

    // Tüm items'ları birleştir ve tarihe göre sırala
    const allItems = [...bridgeRewardItems, ...eventRewardItems].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Pagination uygula
    const hasMore = allItems.length > limit;
    const resultItems = hasMore ? allItems.slice(0, limit) : allItems;
    const nextCursor = hasMore && resultItems.length > 0 ? resultItems[resultItems.length - 1].id : undefined;

    return {
      items: resultItems,
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  /**
   * Marka geçmişi - Anketler: Sadece kullanıcının tamamladığı anketler (progress === 100).
   */
  async getBrandHistorySurveys(
    brandId: string,
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<SurveyList> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor;

    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      throw new NotFoundError(`Brand not found: ${brandId}`);
    }

    // ✅ DÜZELTME: Brand'e ait survey'leri al (Event yerine BrandSurvey)
    const brandSurveys = await this.prisma.brandSurvey.findMany({
      where: { brandId },
      include: { questions: true },
      orderBy: { startsAt: 'desc' },
    });

    if (brandSurveys.length === 0) {
      return {
        surveyList: [],
        pagination: { cursor: undefined, hasMore: false, limit },
      };
    }

    const questionIds = brandSurveys.flatMap((s) => s.questions.map((q) => q.id));
    const userAnswers = await this.prisma.brandSurveyAnswer.findMany({
      where: { userId, questionId: { in: questionIds } },
      select: {
        questionId: true,
        question: { select: { surveyId: true } },
      },
    });

    const answersBySurvey = new Map<string, number>();
    for (const answer of userAnswers) {
      const surveyId = answer.question.surveyId;
      answersBySurvey.set(surveyId, (answersBySurvey.get(surveyId) || 0) + 1);
    }

    const allWithProgress: SurveyCard[] = brandSurveys.map((survey) => {
      const answeredCount = answersBySurvey.get(survey.id) || 0;
      const totalQuestions = survey.questions.length;
      const progress = totalQuestions > 0
        ? Math.min(100, Math.round((answeredCount / totalQuestions) * 100))
        : 0;

      let status: SurveyStatusType = 'start';
      if (progress === 100) status = 'viewresults';
      else if (progress > 0) status = 'continue';

      return {
        id: survey.id,
        title: survey.title,
        description: survey.description || '',
        type: 'SURVEY',
        duration: '5-10 dk',
        points: 100 + answeredCount * 25,
        status,
        progress,
      };
    });

    const completedOnly = allWithProgress.filter((s) => s.progress === 100);

    let fromIndex = 0;
    if (cursor) {
      const idx = completedOnly.findIndex((s) => s.id === cursor);
      if (idx !== -1) fromIndex = idx + 1;
    }

    const hasMore = completedOnly.length - fromIndex > limit;
    const surveyList = completedOnly.slice(fromIndex, fromIndex + limit);
    const nextCursor = hasMore && surveyList.length > 0 ? surveyList[surveyList.length - 1].id : undefined;

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
   * Marka geçmişi - Paylaşımlar: Sadece kullanıcının kendi attığı post'lar (ContentPost).
   * Brand'in ürünleriyle ilişkili ve current user'a ait post'lar döner.
   */
  async getBrandHistoryPosts(
    brandId: string,
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<FeedResponse> {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
    });

    if (!brand) {
      throw new NotFoundError(`Brand not found: ${brandId}`);
    }

    if (!brand.externalId) {
      return {
        items: [],
        pagination: {
          cursor: undefined,
          hasMore: false,
          limit: options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20,
        },
      };
    }

    const brandProducts = await this.prisma.product.findMany({
      where: { brandId: brand.externalId },
      select: { id: true },
    });
    const productIds = brandProducts.map((p) => p.id);

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

    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor;

    const historyPostsWhere: Prisma.ContentPostWhereInput = {
      userId,
      productId: { in: productIds },
      ...(cursor && { id: { lt: cursor } }),
    };

    const postsWithStats = await this.prisma.contentPost.findMany({
      where: historyPostsWhere,
      include: {
        user: {
          include: {
            profile: true,
            titles: { orderBy: { earnedAt: 'desc' }, take: 1 },
            avatars: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
        product: { include: { group: true } },
        comparison: {
          include: {
            product1: { include: { group: true } },
            product2: { include: { group: true } },
            scores: true,
          },
        },
        tip: true,
        tags: true,
        contentPostTags: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
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
  }

  /**
   * Markanın (externalId'ye ait) ürünlerini nested kategori yapısına göre gruplar.
   * Gruplar sadece level 2 (rank 2) derinliğindeki kategori isimleriyle döner; level 0/1 veya kategorisiz ürünler "Diğer" grubunda.
   */
  async getBrandProductGroups(
    brandId: string,
    options?: { cursor?: string; limit?: number; productLimit?: number }
  ): Promise<BrandProductGroupsByCategoryResponse> {
    try {
      const brand = await this.resolveBrandByIdOrExternalId(brandId);
      if (!brand) {
        throw new NotFoundError('Brand not found');
      }
      if (!brand.externalId) {
        throw new NotFoundError('Brand externalId not found');
      }

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
      const productLimit =
        options?.productLimit && options.productLimit > 0 ? Math.min(options.productLimit, 50) : 5;
      const cursor = options?.cursor;

      const items: Array<{ categoryId: string; categoryName: string; products: BrandProduct[] }> = [];

      // Level 2 kategorileri getir (bu markaya ait en az bir ürünü olanlar)
      const categoriesWhere: { level: number; products: { some: { brandId: string } }; id?: { gt: string } } = {
        level: 2,
        products: { some: { brandId: brand.externalId } },
      };
      if (cursor && cursor !== 'ungrouped') {
        categoriesWhere.id = { gt: cursor };
      }

      const categories = await this.prisma.category.findMany({
        where: categoriesWhere,
        orderBy: { id: 'asc' },
        take: limit + 1,
        select: { id: true, name: true },
      });

      const hasMore = categories.length > limit;
      const resultCategories = hasMore ? categories.slice(0, limit) : categories;
      const nextCursor =
        hasMore && resultCategories.length > 0 ? resultCategories[resultCategories.length - 1].id : undefined;

      for (const category of resultCategories) {
        const products = await this.prisma.product.findMany({
          where: {
            brandId: brand.externalId,
            categoryId: category.id,
          },
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
        });
        const limited = products.length > productLimit ? products.slice(0, productLimit) : products;
        const productsMapped: BrandProduct[] = await Promise.all(
          limited.map(async (product) => {
            const stats = await this.calculateProductStats(product.contentPosts || [], brand.id);
            return {
              productId: product.id,
              name: product.name,
              image: this.buildFullMediaUrl(product.imageUrl),
              stats,
            };
          })
        );
        items.push({
          categoryId: category.id,
          categoryName: category.name,
          products: productsMapped,
        });
      }

      // İlk sayfada "Diğer": kategorisi yok veya level !== 2 olan ürünler
      if (!cursor) {
        const otherProducts = await this.prisma.product.findMany({
          where: {
            brandId: brand.externalId,
            OR: [
              { categoryId: null },
              { category: { level: { not: 2 } } },
            ],
          },
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
        });
        if (otherProducts.length > 0) {
          const limited = otherProducts.length > productLimit ? otherProducts.slice(0, productLimit) : otherProducts;
          const productsMapped: BrandProduct[] = await Promise.all(
            limited.map(async (product) => {
              const stats = await this.calculateProductStats(product.contentPosts || [], brand.id);
              return {
                productId: product.id,
                name: product.name,
                image: this.buildFullMediaUrl(product.imageUrl),
                stats,
              };
            })
          );
          items.push({
            categoryId: 'ungrouped',
            categoryName: 'Diğer',
            products: productsMapped,
          });
        }
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
      logger.error(`Failed to get brand product groups by category for ${brandId}:`, error);
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
      const brand = await this.resolveBrandByIdOrExternalId(brandId);
      if (!brand) {
        throw new NotFoundError('Brand not found');
      }
      if (!brand.externalId) {
        throw new NotFoundError('Brand externalId not found');
      }

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
      const cursor = options?.cursor;

      let productsByGroupWhere: Prisma.ProductWhereInput = {
        brandId: brand.externalId,
        groupId: productGroupId === 'ungrouped' ? null : productGroupId,
      };

      if (cursor) {
        const resolvedCursor = await this.resolveProductIdForCursor(cursor);
        productsByGroupWhere = { ...productsByGroupWhere, id: { gt: resolvedCursor } };
      }

      const products = await this.prisma.product.findMany({
        where: productsByGroupWhere,
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
    const items: BrandProduct[] = await Promise.all(
      resultProducts.map(async (product) => {
        const stats = await this.calculateProductStats(product.contentPosts || [], brand.id);

        return {
          productId: product.id,
          name: product.name,
          image: this.buildFullMediaUrl(product.imageUrl),
          stats,
        };
      })
    );

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

    let productsByGroupWhere2: Prisma.ProductWhereInput = {
      groupId: productGroupId === 'ungrouped' ? null : productGroupId,
    };

    if (cursor) {
      const resolvedCursor = await this.resolveProductIdForCursor(cursor);
      productsByGroupWhere2 = { ...productsByGroupWhere2, id: { gt: resolvedCursor } };
    }

    const products = await this.prisma.product.findMany({
      where: productsByGroupWhere2,
      include: {
        contentPosts: {
          select: {
            id: true,
            likesCount: true,
            sharesCount: true,
            favoritesCount: true,
          },
        },
        brand: {
          select: {
            id: true,
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
    
    // Brand ID'yi bul (ilk product'ın brandId'sini kullan, hepsi aynı brand'e ait olmalı)
    const brandId = resultProducts[0]?.brand?.id || '';
    
    const items: BrandProduct[] = await Promise.all(
      resultProducts.map(async (product) => {
        // Product'ın brandId'sini kullan (Product.brandId Brand.externalId'ye referans veriyor)
        // Brand ID'yi bulmak için Brand tablosundan externalId ile arama yap
        const productBrand = await this.prisma.brand.findFirst({
          where: { externalId: product.brandId },
          select: { id: true },
        });
        const productBrandId = productBrand?.id || brandId;
        
        const stats = await this.calculateProductStats(product.contentPosts || [], productBrandId);

        return {
          productId: product.id,
          name: product.name,
          image: this.buildFullMediaUrl(product.imageUrl),
          stats,
        };
      })
    );

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
   * Brand'e ait belirli bir product group'un ürünlerini listele
   */
  async getBrandGroupProducts(
    brandId: string,
    productGroupId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<BrandProductsResponse> {
    try {
      const brand = await this.resolveBrandByIdOrExternalId(brandId);
      if (!brand) {
        throw new NotFoundError('Brand not found');
      }
      if (!brand.externalId) {
        throw new NotFoundError('Brand externalId not found');
      }

      const productGroup = await this.prisma.productGroup.findUnique({
        where: { id: productGroupId },
      });
      if (!productGroup) {
        throw new NotFoundError('Product group not found');
      }

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
      const cursor = options?.cursor;

      let groupProductsWhere: Prisma.ProductWhereInput = {
        groupId: productGroupId,
        brandId: brand.externalId,
      };
      if (cursor) {
        const resolvedCursor = await this.resolveProductIdForCursor(cursor);
        groupProductsWhere = { ...groupProductsWhere, id: { gt: resolvedCursor } };
      }

      const products = await this.prisma.product.findMany({
        where: groupProductsWhere,
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

      const items: BrandProduct[] = await Promise.all(
        resultProducts.map(async (product) => {
          const stats = await this.calculateProductStats(product.contentPosts || [], brand.id);

          return {
            productId: product.id,
            name: product.name,
            image: this.buildFullMediaUrl(product.imageUrl),
            stats,
          };
        })
      );

      return {
        items,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get brand group products for ${brandId}/${productGroupId}:`, error);
      throw error;
    }
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

      // Brand ID'ye göre ürünleri bul (pagination ile)
      const brandProductsWhere: Prisma.ProductWhereInput = {
        brandId: brandId,
        ...(cursor && { id: { gt: cursor } }),
      };

      const products = await this.prisma.product.findMany({
        where: brandProductsWhere,
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

        const stats = await this.calculateProductStats(product.contentPosts || [], brandId);

        groupData.products.push({
          productId: product.id,
          name: product.name,
          image: this.buildFullMediaUrl(product.imageUrl),
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
   * Generic metod: Brand product'a ait belirli tip gönderileri getir (cursor-based pagination)
   */
  async getBrandProductPosts(
    brandId: string,
    productId: string,
    userId?: string,
    postType?: ContentPostType | ContentPostType[],
    options?: { cursor?: string; limit?: number }
  ): Promise<FeedResponse> {
    try {
      // Brand name'i al
      const brand = await this.prisma.brand.findFirst({
        where: {
          OR: [
            { id: brandId },
            { externalId: brandId },
          ],
        },
        select: { id: true, externalId: true, name: true },
      });

      if (!brand) {
        throw new NotFoundError('Brand not found');
      }

      // Product'ı kontrol et
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, brandId: true },
      });

      if (!product || product.brandId !== brand.externalId) {
        throw new NotFoundError('Product not found or does not belong to this brand');
      }

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
      const cursor = options?.cursor;

      const productPostsWhere: Prisma.ContentPostWhereInput = {
        productId: productId,
        ...(postType && (Array.isArray(postType) ? { type: { in: postType } } : { type: postType })),
        ...(cursor && { id: { lt: cursor } }),
      };

      // Ürüne ait gönderileri getir - cursor-based pagination
      const posts = await this.prisma.contentPost.findMany({
        where: productPostsWhere,
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
              product1: true,
              product2: true,
              scores: true,
            },
          },
          likes: true,
          comments: true,
          favorites: true,
          media: {
            orderBy: { orderIndex: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // Bir fazla al ki hasMore'u kontrol edebilelim
      });

      const hasMore = posts.length > limit;
      const resultPosts = hasMore ? posts.slice(0, limit) : posts;
      const nextCursor = hasMore && resultPosts.length > 0 ? resultPosts[resultPosts.length - 1].id : undefined;

      // Experience post'ları için inventory verilerini toplu olarak çek
      // Inventory modelinde contentPostId yok, productId var. Her post'un productId'si var.
      const experiencePosts = resultPosts.filter(
        (p) => p.type === ContentPostType.EXPERIENCE || p.type === ContentPostType.UPDATE
      );
      
      const inventoriesMap = new Map<string, InventoryWithMedia>();
      if (experiencePosts.length > 0 && userId) {
        // Post'ların productId'lerini al
        const productIds = experiencePosts
          .map((p) => p.productId)
          .filter((id): id is string => id !== null);
        
        if (productIds.length > 0) {
          const inventories = await this.prisma.inventory.findMany({
            where: {
              userId: userId,
              productId: { in: productIds },
            },
            include: {
              media: {
                orderBy: { createdAt: 'asc' },
              },
            },
          });

          // Inventory'leri productId'ye göre map'le
          for (const inv of inventories) {
            inventoriesMap.set(inv.productId, inv);
          }
        }
      }

      // Feed items'a dönüştür
      const feedItems = await this.mapPostsToFeedItems(resultPosts, userId, inventoriesMap);

      return {
        items: feedItems,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get brand product posts for ${brandId}/${productId}:`, error);
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
      // Brand'i kontrol et (hem id hem externalId ile kontrol et)
      const brand = await this.prisma.brand.findFirst({
        where: {
          OR: [
            { id: brandId },
            { externalId: brandId },
          ],
        },
        select: { id: true, externalId: true, name: true },
      });

      if (!brand) {
        throw new NotFoundError('Brand not found');
      }

      // Product'ı kontrol et
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, brandId: true },
      });

      if (!product || product.brandId !== brand.externalId) {
        throw new NotFoundError('Product not found or does not belong to this brand');
      }

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
      const cursor = options?.cursor;

      const experiencesWhere: Prisma.ContentPostWhereInput = {
        productId: productId,
        type: ContentPostType.EXPERIENCE,
        ...(cursor && { id: { lt: cursor } }),
      };

      // Ürüne ait deneyim paylaşımlarını getir (EXPERIENCE type posts) - cursor-based pagination
      const posts = await this.prisma.contentPost.findMany({
        where: experiencesWhere,
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
      // Brand'i kontrol et (hem id hem externalId ile kontrol et)
      const brand = await this.prisma.brand.findFirst({
        where: {
          OR: [
            { id: brandId },
            { externalId: brandId },
          ],
        },
        select: { id: true, externalId: true, name: true },
      });

      if (!brand) {
        throw new NotFoundError('Brand not found');
      }

      // Product'ı kontrol et
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, brandId: true },
      });

      if (!product || product.brandId !== brand.externalId) {
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
   * Brand context'inde product detay bilgilerini getir
   * Catalog context'indeki product detayından farklı olabilir (brand-specific bilgiler, stats vb.)
   */
  async getBrandProductDetail(
    brandId: string,
    productId: string,
  ): Promise<{
    productId: string;
    name: string;
    subName: string | null;
    description: string | null;
    image: string | null;
    brand: {
      id: string;
      name: string;
      image: string | null;
    } | null;
    specs: string[];
    price: number | null;
    currency: string | null;
    stats?: {
      posts: number;
      news: number;
    };
  }> {
    try {
      // Brand'i kontrol et (hem id hem externalId ile kontrol et)
      const brand = await this.prisma.brand.findFirst({
        where: {
          OR: [
            { id: brandId },
            { externalId: brandId },
          ],
        },
        select: { id: true, externalId: true, name: true, imageUrl: true },
      });

      if (!brand) {
        throw new NotFoundError('Brand not found');
      }

      // Product'ı kontrol et ve brand'e ait olduğunu doğrula
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
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
      });

      if (!product) {
        throw new NotFoundError(`Product not found: ${productId}`);
      }

      // Product'ın brand'e ait olduğunu kontrol et (brandId product'ta externalId olarak saklanıyor)
      if (product.brandId !== brand.externalId) {
        throw new NotFoundError('Product does not belong to this brand');
      }

      // Brand bilgisi
      const brandData = {
        id: brand.id,
        name: brand.name,
        image: resolveMediaUrl(brand.imageUrl),
      };

      // Product stats hesapla (reviews, likes, share)
      const contentPosts = await this.prisma.contentPost.findMany({
        where: { productId: productId },
        select: {
          likesCount: true,
          sharesCount: true,
          favoritesCount: true,
        },
      });

      const stats = await this.calculateProductStats(contentPosts, brandId);

      // Specs'i parse et (şimdilik boş array)
      const specs: string[] = [];

      // Price ve currency şimdilik null
      const price: number | null = null;
      const currency: string | null = null;

      return {
        productId: product.id,
        name: product.name,
        subName: product.subName,
        description: product.description,
        image: resolveMediaUrl(product.imageUrl),
        brand: brandData,
        specs,
        price,
        currency,
        stats,
      };
    } catch (error) {
      logger.error(`Failed to get brand product detail for ${brandId}/${productId}:`, error);
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
      // Brand'i kontrol et (hem id hem externalId ile kontrol et)
      const brand = await this.prisma.brand.findFirst({
        where: {
          OR: [
            { id: brandId },
            { externalId: brandId },
          ],
        },
        select: { id: true, externalId: true, name: true },
      });

      if (!brand) {
        throw new NotFoundError('Brand not found');
      }

      // Product'ı kontrol et
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, brandId: true },
      });

      if (!product || product.brandId !== brand.externalId) {
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
        const likes = post.likesCount ?? post.likes?.length ?? 0;
        const comments = post.commentsCount ?? post.comments?.length ?? 0;
        const shares = post.sharesCount ?? 0;
        const bookmarks = post.favoritesCount ?? post.favorites?.length ?? 0;

        const title = post.title || post.body?.slice(0, 80) || 'News';
        const description = post.body || '';
        const source = brand.name || 'tipbox';
        const image =
          post.product?.imageUrl ||
          post.product?.group?.imageUrl ||
          '';

        return {
          id: post.id,
          title,
          description,
          source,
          date: post.createdAt.toISOString(),
          image,
          url: undefined,
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
  private async mapPostsToFeedItems(posts: PostWithRelations[], userId?: string, inventoriesMap?: Map<string, InventoryWithMedia>): Promise<FeedItem[]> {
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
        avatar: resolveMediaUrl(post.user.avatars?.[0]?.imageUrl || null, true) || '',
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
      let images = (postMediaMap.get(post.id) || []).map((mediaUrl: string) => resolveMediaUrl(mediaUrl)).filter((url: string | null): url is string => url !== null);
      // PostMedia'da görsel yoksa, ürün görselini fallback olarak kullan
      if ((!images || images.length === 0) && post.product?.imageUrl) {
        const productImageUrl = this.buildFullMediaUrl(post.product.imageUrl);
        if (productImageUrl) {
          images = [productImageUrl];
        }
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
  private mapContextTypeForBrand(post: PostWithRelations): 'product' | 'product_group' | 'sub_category' {
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
  private buildBrandContextData(post: PostWithRelations, ownedProductIds?: Set<string>): ContextData {
    const contextType = this.mapContextTypeForBrand(post);

    if (contextType === 'product' && post.product) {
      const product = post.product;
      const group = product.group;
      const subCategory = group?.subCategory;

      return {
        id: String(product.id),
        name: product.name,
        subName: group?.name || subCategory?.name || '',
        image: this.buildFullMediaUrl(product.imageUrl),
        isOwned: ownedProductIds ? ownedProductIds.has(String(product.id)) : undefined,
      };
    }

    if (contextType === 'product_group') {
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

  private getProductBase(product: PostWithRelations['product']): ProductBase | null {
    if (!product) return null;
    return {
      id: String(product.id),
      name: product.name,
      subName: product.subName || product.group?.name || '',
      image: this.buildFullMediaUrl(product.imageUrl),
    };
  }

  /**
   * Product stats hesapla (posts ve news sayıları)
   * @param contentPosts - Product'a ait post'lar
   * @param brandId - Brand ID (news sayısı için gerekli)
   * @returns { posts: number, news: number }
   */
  private async calculateProductStats(
    contentPosts: Array<{ likesCount?: number | null; sharesCount?: number | null; favoritesCount?: number | null }>,
    brandId: string
  ): Promise<{ posts: number; news: number }> {
    const posts = contentPosts.length;
    
    // Brand'e ait news sayısı (News modelinde productId yok, bu yüzden brand bazlı)
    // News model may not exist in Prisma schema; safely attempt count
    let newsCount = 0;
    try {
      const prismaWithNews = this.prisma as unknown as Record<string, { count: (args: { where: Record<string, unknown> }) => Promise<number> }>;
      if (prismaWithNews['news']) {
        newsCount = await prismaWithNews['news'].count({
          where: { brandId },
        });
      }
    } catch {
      // News model doesn't exist yet
    }

    return { posts, news: newsCount };
  }

  private mapToPostItem(
    post: PostWithRelations,
    basePost: FeedBasePost,
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
    } as FeedItem;
  }

  private mapToExperienceItem(
    post: PostWithRelations,
    basePost: FeedBasePost,
    type: FeedItemType.EXPERIENCE | FeedItemType.UPDATE,
    images: string[] = [],
    _ownedProductIds?: Set<string>,
    inventoriesMap?: Map<string, InventoryWithMedia>
  ): FeedItem {
    // Önce inventory'den gelen experience verilerini kontrol et
    let experienceContent: ExperienceContent[] = [];
    if (inventoriesMap && post.userId && post.productId) {
      // Inventory'ler productId ile map'lenmiş
      const inventory = post.productId ? inventoriesMap.get(post.productId) : undefined;
      
      // Artık productExperiences yok, sadece inventory media'sını kullan
      if (inventory) {
        // Inventory'den gelen görselleri kullan
        if (inventory.media && inventory.media.length > 0) {
          images = inventory.media.map((m: { mediaUrl: string }) => resolveMediaUrl(m.mediaUrl)).filter((url: string | null): url is string => url !== null);
        }
      }
    }
    
    // Body'den experience content'i parse et
    experienceContent = this.parseExperienceContent(post.body);

    // Get tags
    const tags = post.tags?.map((t: { tag: string }) => t.tag) || post.contentPostTags?.map((t: { tag: string }) => t.tag) || [];

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
      } as FeedItem;
    }

    const experienceData = {
      ...basePost,
      content: experienceContent,
      tags,
      images,
    };

    return {
      type,
      data: experienceData,
    } as FeedItem;
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
      let contentArray: Array<{ title?: string; content?: string; rating?: number }> | undefined = undefined;
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
    post: PostWithRelations,
    basePost: FeedBasePost,
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
    } as FeedItem;
  }

  private mapToTipsAndTricksItem(post: PostWithRelations, basePost: FeedBasePost, images: string[] = []): FeedItem {
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
    } as FeedItem;
  }

  /**
   * Global brand search - Tüm brand kategorileri arasında arama
   * Sonuçları brand category bazında gruplar
   */
  async searchBrandsGlobally(
    search: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{
    items: Array<{
      categoryId: string;
      categoryName: string;
      categoryImage: string | null;
      brands: Array<{
        brandId: string;
        name: string;
        image: string | null;
        categoryId: string;
      }>;
    }>;
    pagination: {
      cursor?: string;
      hasMore: boolean;
      limit: number;
    };
  }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor;
    const searchTrimmed = search?.trim();

    if (!searchTrimmed || searchTrimmed.length === 0) {
      return {
        items: [],
        pagination: {
          cursor: undefined,
          hasMore: false,
          limit,
        },
      };
    }

    try {
      // ⚠️ KRİTİK: Sadece brand name, description ve category name'de arama yapılmalı
      // Brand category adı ile eşleşme YAPILMAMALI (sadece brand'in kendi category'si)
      const matchingBrands = await this.prisma.brand.findMany({
        where: {
          // Sadece brand adı, açıklama ve category adında arama
          OR: [
            { name: { contains: searchTrimmed, mode: 'insensitive' } },
            { description: { contains: searchTrimmed, mode: 'insensitive' } },
            { brandCategory: { name: { contains: searchTrimmed, mode: 'insensitive' } } },
          ],
          // ⚠️ KRİTİK: Sadece categoryId'si olan brand'leri al (category'si olmayan brand'leri atla)
          categoryId: { not: null },
        },
        include: {
          brandCategory: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
        },
      });

      // ⚠️ KRİTİK: Aynı brandId'ye sahip brand'lerin birden fazla category'de görünmesini engelle
      // Her brandId sadece bir kez eklenmeli (kendi category'sinde)
      const processedBrandIds = new Set<string>();
      
      // Brand'leri category bazında grupla
      const categoriesMap = new Map<
        string,
        {
          categoryId: string;
          categoryName: string;
          categoryImage: string | null;
          brands: Array<{
            brandId: string;
            name: string;
            image: string | null;
            categoryId: string;
          }>;
        }
      >();

      const brandMap: Record<string, BrandWebsiteEntry> = {};
      brandToWebsite.forEach((brand: BrandWebsiteEntry) => {
        brandMap[slugify(brand.brand, slugifyOptions)] = brand;
      });

      for (const brand of matchingBrands) {
        // ⚠️ KRİTİK: Category'si olmayan brand'leri atla
        if (!brand.brandCategory) continue;

        // ⚠️ KRİTİK: Bu brandId daha önce işlendiyse atla (aynı brand farklı category'lerde görünmemeli)
        if (processedBrandIds.has(brand.id)) {
          logger.warn(`Brand ${brand.id} already processed, skipping duplicate`);
          continue;
        }

        const categoryId = brand.brandCategory.id;

        // ⚠️ KRİTİK: Brand'in categoryId'si ile eşleşmeli
        if (brand.categoryId !== categoryId) {
          logger.warn(`Brand ${brand.id} categoryId mismatch: ${brand.categoryId} vs ${categoryId}`);
          continue;
        }

        if (!categoriesMap.has(categoryId)) {
          categoriesMap.set(categoryId, {
            categoryId: categoryId,
            categoryName: brand.brandCategory.name,
            categoryImage: resolveMediaUrl(brand.brandCategory.imageUrl),
            brands: [],
          });
        }

        // ⚠️ KRİTİK: Brand görseli doğruluğu - image URL validation
        const brandImageUrl = brand.imageUrl;
        const slugbrand = slugify(brand.name, slugifyOptions);
        const website = brandMap?.[slugbrand]?.website;
        
        // Image URL logic: önce brand.imageUrl, yoksa website'den logo.dev, yoksa null
        let resolvedImage: string | null = null;
        if (brandImageUrl && brandImageUrl.length > 0 && brandImageUrl !== 'NULL') {
          resolvedImage = resolveMediaUrl(brandImageUrl);
        } else if (website) {
          resolvedImage = `https://img.logo.dev/name/${website}?token=${process.env.LOGO_DEV_API_TOKEN}`;
        }
        if (resolvedImage) {
          resolvedImage = resolvedImage.includes('token=')
            ? resolvedImage.replace(/token=[^&]*/, `token=${process.env.LOGO_DEV_API_TOKEN}`)
            : `${resolvedImage}${resolvedImage.includes('?') ? '&' : '?'}token=${process.env.LOGO_DEV_API_TOKEN}`;
        }

        // Image URL validation: null, boş string veya geçersiz URL kontrolü
        const validImage = resolvedImage && 
          resolvedImage.trim().length > 0 && 
          (resolvedImage.startsWith('http://') || resolvedImage.startsWith('https://'));

        const categoryData = categoriesMap.get(categoryId)!;
        categoryData.brands.push({
          brandId: brand.id,
          name: brand.name,
          image: validImage ? resolvedImage : null, // Geçersiz URL'ler null olarak döndürülür
          categoryId: categoryId,
        });

        // BrandId'yi işlenmiş olarak işaretle
        processedBrandIds.add(brand.id);
      }

      // ⚠️ KRİTİK: Sadece eşleşen brand'i olan category'leri döndür
      // Boş brand listesi olan category'leri filtrele
      let allCategories = Array.from(categoriesMap.values())
        .filter((category) => category.brands.length > 0); // En az bir brand'i olan category'ler

      // Cursor-based pagination: cursor varsa, o ID'den sonraki category'leri al
      if (cursor) {
        const cursorIndex = allCategories.findIndex((c) => c.categoryId === cursor);
        if (cursorIndex >= 0) {
          allCategories = allCategories.slice(cursorIndex + 1);
        } else {
          // Cursor bulunamazsa, cursor ID'sinden büyük olanları al
          allCategories = allCategories.filter((c) => c.categoryId > cursor);
        }
      }

      // Category'leri ID'ye göre sırala (cursor-based pagination için)
      allCategories.sort((a, b) => a.categoryId.localeCompare(b.categoryId));

      // Limit + 1 al ki hasMore'u kontrol edebilelim
      const hasMore = allCategories.length > limit;
      const resultCategories = hasMore ? allCategories.slice(0, limit) : allCategories;
      const nextCursor = hasMore && resultCategories.length > 0 
        ? resultCategories[resultCategories.length - 1].categoryId 
        : undefined;

      return {
        items: resultCategories,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to search brands globally:`, error);
      throw error;
    }
  }

  /**
   * Anket sorularını getirir
   * GET /surveys/{surveyId}/questions
   */
  async getSurveyQuestions(surveyId: string, userId: string): Promise<{
    surveyId: string;
    questions: Array<{
      id: string;
      text: string;
      type: string;
      options: Array<{
        id: string;
        text: string;
      }>;
      order: number;
      isAnswered: boolean;
    }>;
    totalQuestions: number;
  }> {
    // Survey kontrolü
    const survey = await this.prisma.brandSurvey.findUnique({
      where: { id: surveyId },
      include: {
        questions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!survey) {
      throw new NotFoundError(`Survey not found: ${surveyId}`);
    }

    // Kullanıcının verdiği cevapları kontrol et
    const userAnswers = await this.prisma.brandSurveyAnswer.findMany({
      where: {
        userId,
        question: {
          surveyId: surveyId,
        },
      },
      select: {
        questionId: true,
      },
    });

    const answeredQuestionIds = new Set(userAnswers.map((a) => a.questionId));

    // Soruları formatla
    const questions = survey.questions.map((question, index) => {
      const options = Array.isArray(question.options)
        ? (question.options as Array<{ id: string; text: string }>)
        : [];

      return {
        id: question.id,
        text: question.questionText,
        type: question.type,
        options,
        order: index + 1,
        isAnswered: answeredQuestionIds.has(question.id),
      };
    });

    return {
      surveyId: survey.id,
      questions,
      totalQuestions: questions.length,
    };
  }

  /**
   * Submit all survey answers at once and complete the survey.
   * POST /surveys/{surveyId}/submit
   */
  async submitSurvey(
    surveyId: string,
    userId: string,
    answers: Array<{ questionId: string; answerId: string }>,
  ): Promise<{
    success: boolean;
    message?: string;
    awardedPoints?: number;
    newTotalPoints?: number;
    badgesEarned?: BadgeEarned[];
  }> {
    // Survey check
    const survey = await this.prisma.brandSurvey.findUnique({
      where: { id: surveyId },
      include: { questions: true },
    });

    if (!survey) {
      throw new NotFoundError(`Survey not found: ${surveyId}`);
    }

    // Check survey is active
    const now = new Date();
    if (now < survey.startsAt || now > survey.endsAt) {
      return {
        success: false,
        message: 'This survey is not currently active.',
      };
    }

    // Check already completed
    const existingCompletion = await this.prisma.userSurveyCompletion.findUnique({
      where: {
        userId_surveyId: { userId, surveyId },
      },
    });

    if (existingCompletion) {
      return {
        success: false,
        message: 'You have already completed this survey.',
      };
    }

    // Validate all questions are answered
    const questionIds = new Set(survey.questions.map((q) => q.id));
    const answeredQuestionIds = new Set(answers.map((a) => a.questionId));

    for (const qId of questionIds) {
      if (!answeredQuestionIds.has(qId)) {
        return {
          success: false,
          message: `Please answer all questions. (${answeredQuestionIds.size}/${questionIds.size})`,
        };
      }
    }

    // Validate no unknown questionIds
    for (const a of answers) {
      if (!questionIds.has(a.questionId)) {
        return {
          success: false,
          message: `Unknown question: ${a.questionId}`,
        };
      }
    }

    // Save all answers + completion in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Upsert answers
      for (const answer of answers) {
        await tx.brandSurveyAnswer.upsert({
          where: {
            questionId_userId: {
              questionId: answer.questionId,
              userId,
            },
          },
          update: {
            answerText: answer.answerId,
            updatedAt: new Date(),
          },
          create: {
            id: randomUUID(),
            questionId: answer.questionId,
            userId,
            answerText: answer.answerId,
          },
        });
      }

      // Create completion record
      await tx.userSurveyCompletion.create({
        data: {
          userId,
          surveyId,
          pointsAwarded: 10,
        },
      });
    });

    // Calculate total survey points
    const completions = await this.prisma.userSurveyCompletion.findMany({
      where: { userId },
      select: { pointsAwarded: true },
    });
    const totalSurveyPoints = completions.reduce((sum, c) => sum + c.pointsAwarded, 0);

    // Badge checks
    const badgesEarned: BadgeEarned[] = [];
    const surveyBadges = await this.prisma.badge.findMany({
      where: {
        category: { name: 'Survey' },
      },
      orderBy: { name: 'asc' },
    });

    const badgeThresholds = [
      { points: 10, name: 'Survey Explorer (Bronze)' },
      { points: 25, name: 'Survey Master (Silver)' },
      { points: 50, name: 'Survey Legend (Gold)' },
    ];

    for (const threshold of badgeThresholds) {
      if (totalSurveyPoints >= threshold.points) {
        const badge = surveyBadges.find((b) => b.name === threshold.name);
        if (badge) {
          const hasBadge = await this.prisma.userBadge.findFirst({
            where: { userId, badgeId: badge.id },
          });

          if (!hasBadge) {
            await this.prisma.userBadge.create({
              data: {
                id: randomUUID(),
                userId,
                badgeId: badge.id,
                isVisible: true,
                visibility: 'PUBLIC',
              },
            });

            badgesEarned.push({
              id: badge.id,
              name: badge.name,
              description: badge.description,
              image: resolveMediaUrl(badge.imageUrl),
              rarity: badge.rarity,
            });

            logger.info(`User ${userId} earned badge: ${badge.name}`);
          }
        }
      }
    }

    return {
      success: true,
      message: 'Survey completed successfully!',
      awardedPoints: 10,
      newTotalPoints: totalSurveyPoints,
      badgesEarned,
    };
  }

}

