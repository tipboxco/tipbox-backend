import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { FeedSource } from '../../domain/admin/feed-source.enum';
import logger from '../../infrastructure/logger/logger';

export interface ScoringFactors {
  trustScore: number;
  inventoryScore: number;
  engagementScore: number;
  recencyScore: number;
  boostScore: number;
  total: number;
}

export interface ScoringResult {
  score: number;
  source: FeedSource;
  factors: ScoringFactors;
}

export interface TrustRelationInfo {
  userTrustsAuthor: boolean;
  authorTrustsUser: boolean;
  isMutual: boolean;
}

export interface InventoryMatchInfo {
  hasExactProduct: boolean;
  hasProductGroup: boolean;
  hasCategoryMatch: boolean;
}

export class FeedScoringService {
  private readonly prisma: ReturnType<typeof getPrisma>;
  
  // Scoring weights (configurable)
  private readonly WEIGHTS = {
    TRUST: {
      MUTUAL: 35,
      USER_TRUSTS_AUTHOR: 40,
      AUTHOR_TRUSTS_USER: 30,
    },
    INVENTORY: {
      EXACT_PRODUCT: 30,
      PRODUCT_GROUP: 20,
      CATEGORY_MATCH: 15,
    },
    ENGAGEMENT: {
      TRENDING_BONUS: 20,
      HIGH_ENGAGEMENT_BONUS: 15,
      LIKES_WEIGHT: 0.4,
      COMMENTS_WEIGHT: 0.3,
      VIEWS_WEIGHT: 0.2,
    },
    RECENCY: {
      HOURS_48: 10,
      DAYS_14: 5,
      OLD: 0,
    },
    BOOST: {
      MIN: 5,
      MAX: 10,
    },
  };

  constructor() {
    this.prisma = getPrisma();
  }

  /**
   * FULL SCORING: Tüm faktörleri hesapla (her 10 postta 1 kez)
   */
  async calculateFullScore(
    userId: string,
    postId: string,
    postAuthorId: string,
    postData: {
      mainCategoryId?: string | null;
      subCategoryId?: string | null;
      productGroupId?: string | null;
      productId?: string | null;
      likesCount: number;
      commentsCount: number;
      viewsCount: number;
      sharesCount: number;
      isBoosted: boolean;
      boostedUntil?: Date | null;
      createdAt: Date;
    }
  ): Promise<ScoringResult> {
    try {
      const [trustInfo, inventoryInfo, isTrending] = await Promise.all([
        this.checkTrustRelation(userId, postAuthorId),
        this.checkInventoryMatch(userId, postData),
        this.checkTrendingStatus(postId),
      ]);

      const trustScore = this.calculateTrustScore(trustInfo);
      const inventoryScore = this.calculateInventoryScore(inventoryInfo);
      const engagementScore = this.calculateEngagementScore(postData, isTrending);
      const recencyScore = this.calculateRecencyScore(postData.createdAt);
      const boostScore = this.calculateBoostScore(postData.isBoosted, postData.boostedUntil);

      const total = trustScore + inventoryScore + engagementScore + recencyScore + boostScore;
      const source = this.determineSource(trustInfo, inventoryInfo, isTrending, postData.isBoosted, engagementScore);

      return {
        score: Math.round(total * 100) / 100, // 2 decimal places
        source,
        factors: {
          trustScore,
          inventoryScore,
          engagementScore,
          recencyScore,
          boostScore,
          total,
        },
      };
    } catch (error) {
      logger.error({
        message: 'Full scoring error',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        userId, 
        postId 
      });
      return this.getFallbackScore();
    }
  }

  /**
   * FAST SCORING: Sadece temel faktörler (9 post için)
   */
  async calculateFastScore(
    userId: string,
    postData: {
      mainCategoryId?: string | null;
      subCategoryId?: string | null;
      isBoosted: boolean;
      boostedUntil?: Date | null;
      createdAt: Date;
    }
  ): Promise<ScoringResult> {
    try {
      const categoryMatch = await this.checkSimpleCategoryMatch(userId, postData);
      const recencyScore = this.calculateRecencyScore(postData.createdAt);
      const boostScore = this.calculateBoostScore(postData.isBoosted, postData.boostedUntil);

      const categoryScore = categoryMatch ? this.WEIGHTS.INVENTORY.CATEGORY_MATCH : 0;
      const total = categoryScore + recencyScore + boostScore;

      return {
        score: Math.round(total * 100) / 100,
        source: postData.isBoosted ? FeedSource.BOOSTED : 
                categoryMatch ? FeedSource.CATEGORY_MATCH : FeedSource.NEW_USER,
        factors: {
          trustScore: 0,
          inventoryScore: categoryScore,
          engagementScore: 0,
          recencyScore,
          boostScore,
          total,
        },
      };
    } catch (error) {
      logger.error({
        message: 'Fast scoring error',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        userId
      });
      return this.getFallbackScore();
    }
  }

  /**
   * Trust relation kontrolü
   */
  private async checkTrustRelation(userId: string, authorId: string): Promise<TrustRelationInfo> {
    if (userId === authorId) {
      return { userTrustsAuthor: false, authorTrustsUser: false, isMutual: false };
    }

    const [userToAuthor, authorToUser] = await Promise.all([
      this.prisma.trustRelation.findUnique({
        where: {
          trusterId_trustedUserId: {
            trusterId: userId,
            trustedUserId: authorId,
          },
        },
      }),
      this.prisma.trustRelation.findUnique({
        where: {
          trusterId_trustedUserId: {
            trusterId: authorId,
            trustedUserId: userId,
          },
        },
      }),
    ]);

    const userTrustsAuthor = !!userToAuthor;
    const authorTrustsUser = !!authorToUser;

    return {
      userTrustsAuthor,
      authorTrustsUser,
      isMutual: userTrustsAuthor && authorTrustsUser,
    };
  }

  /**
   * Inventory match kontrolü
   */
  private async checkInventoryMatch(
    userId: string,
    postData: {
      productId?: string | null;
      productGroupId?: string | null;
      mainCategoryId?: string | null;
      subCategoryId?: string | null;
    }
  ): Promise<InventoryMatchInfo> {
    // Exact product match
    if (postData.productId) {
      const inventory = await this.prisma.inventory.findFirst({
        where: { userId, productId: postData.productId },
      });
      if (inventory) {
        return { hasExactProduct: true, hasProductGroup: false, hasCategoryMatch: false };
      }
    }

    // Product group match
    if (postData.productGroupId) {
      const inventory = await this.prisma.inventory.findFirst({
        where: {
          userId,
          product: { groupId: postData.productGroupId },
        },
      });
      if (inventory) {
        return { hasExactProduct: false, hasProductGroup: true, hasCategoryMatch: false };
      }
    }

    // Category match (user preferences)
    const categoryMatch = await this.checkSimpleCategoryMatch(userId, postData);

    return {
      hasExactProduct: false,
      hasProductGroup: false,
      hasCategoryMatch: categoryMatch,
    };
  }

  /**
   * Basit kategori match kontrolü (fast scoring için de kullanılır)
   * Önce kullanıcının preferredCategories'ine bakır, yoksa inventory'ye bakar
   */
  private async checkSimpleCategoryMatch(
    userId: string,
    postData: {
      mainCategoryId?: string | null;
      subCategoryId?: string | null;
    }
  ): Promise<boolean> {
    const postCategoryId = postData.mainCategoryId || postData.subCategoryId;
    const postSubCategoryId = postData.subCategoryId;
    if (!postCategoryId && !postSubCategoryId) return false;

    // 1. Önce kullanıcının preferredCategories'ini kontrol et
    const userPreferences = await this.prisma.userFeedPreferences.findUnique({
      where: { userId },
      select: { preferredCategories: true },
    });

    if (userPreferences?.preferredCategories) {
      try {
        // JSON formatında saklanan kategori tercihlerini parse et
        const selectedCategories = JSON.parse(userPreferences.preferredCategories);
        
        if (Array.isArray(selectedCategories)) {
          // Her selectedCategory objesi: { categoryId: string, subCategoryIds: string[] }
          for (const category of selectedCategories) {
            // Main category eşleşmesi
            if (category.categoryId && postData.mainCategoryId && category.categoryId === postData.mainCategoryId) {
              return true;
            }
            
            // Sub category eşleşmesi
            if (Array.isArray(category.subCategoryIds) && postSubCategoryId) {
              if (category.subCategoryIds.includes(postSubCategoryId)) {
                return true;
              }
            }
          }
        }
      } catch (error) {
        // JSON parse hatası - eski format olabilir, inventory'ye bak
        logger.warn({
          message: 'Failed to parse preferredCategories JSON',
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 2. Eğer preferredCategories yoksa veya eşleşme bulunamadıysa, inventory'ye bak
    const userInventory = await this.prisma.inventory.findMany({
      where: { userId },
      include: {
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
      },
      take: 20, // İlk 20 inventory item'ına bakmak yeterli (performance için)
    });

    if (userInventory.length === 0) return false;

    // Inventory'deki ürünlerin kategorilerini topla
    const userCategoryIds = new Set<string>();
    for (const item of userInventory) {
      if (item.product?.group?.subCategory?.mainCategory?.id) {
        userCategoryIds.add(item.product.group.subCategory.mainCategory.id);
      }
      if (item.product?.group?.subCategory?.id) {
        userCategoryIds.add(item.product.group.subCategory.id);
      }
    }

    // Post'un kategorisi kullanıcının inventory kategorilerinde var mı?
    if (postCategoryId && userCategoryIds.has(postCategoryId)) {
      return true;
    }
    if (postSubCategoryId && userCategoryIds.has(postSubCategoryId)) {
      return true;
    }

    return false;
  }

  /**
   * Trending status kontrolü
   */
  private async checkTrendingStatus(postId: string): Promise<boolean> {
    const trending = await this.prisma.trendingPost.findFirst({
      where: { postId },
    });
    return !!trending;
  }

  /**
   * Trust score hesaplama
   */
  private calculateTrustScore(trustInfo: TrustRelationInfo): number {
    if (trustInfo.isMutual) {
      return this.WEIGHTS.TRUST.MUTUAL;
    }
    if (trustInfo.userTrustsAuthor) {
      return this.WEIGHTS.TRUST.USER_TRUSTS_AUTHOR;
    }
    if (trustInfo.authorTrustsUser) {
      return this.WEIGHTS.TRUST.AUTHOR_TRUSTS_USER;
    }
    return 0;
  }

  /**
   * Inventory score hesaplama
   */
  private calculateInventoryScore(inventoryInfo: InventoryMatchInfo): number {
    if (inventoryInfo.hasExactProduct) {
      return this.WEIGHTS.INVENTORY.EXACT_PRODUCT;
    }
    if (inventoryInfo.hasProductGroup) {
      return this.WEIGHTS.INVENTORY.PRODUCT_GROUP;
    }
    if (inventoryInfo.hasCategoryMatch) {
      return this.WEIGHTS.INVENTORY.CATEGORY_MATCH;
    }
    return 0;
  }

  /**
   * Engagement score hesaplama
   */
  private calculateEngagementScore(
    postData: {
      likesCount: number;
      commentsCount: number;
      viewsCount: number;
    },
    isTrending: boolean
  ): number {
    if (isTrending) {
      return this.WEIGHTS.ENGAGEMENT.TRENDING_BONUS;
    }

    // Normalize metrics (logarithmic scale)
    const normalizedLikes = Math.log10(postData.likesCount + 1) / 3; // Max ~1000 likes
    const normalizedComments = Math.log10(postData.commentsCount + 1) / 2; // Max ~100 comments
    const normalizedViews = Math.log10(postData.viewsCount + 1) / 4; // Max ~10000 views

    const engagementRate = 
      normalizedLikes * this.WEIGHTS.ENGAGEMENT.LIKES_WEIGHT +
      normalizedComments * this.WEIGHTS.ENGAGEMENT.COMMENTS_WEIGHT +
      normalizedViews * this.WEIGHTS.ENGAGEMENT.VIEWS_WEIGHT;

    const score = Math.min(1, engagementRate) * 10; // Scale to 0-10

    // High engagement bonus
    if (engagementRate > 0.7) {
      return this.WEIGHTS.ENGAGEMENT.HIGH_ENGAGEMENT_BONUS;
    }

    return score;
  }

  /**
   * Recency score hesaplama
   */
  private calculateRecencyScore(createdAt: Date): number {
    const hoursOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

    if (hoursOld <= 48) {
      return this.WEIGHTS.RECENCY.HOURS_48;
    }
    if (hoursOld <= 14 * 24) {
      return this.WEIGHTS.RECENCY.DAYS_14;
    }
    return this.WEIGHTS.RECENCY.OLD;
  }

  /**
   * Boost score hesaplama
   */
  private calculateBoostScore(isBoosted: boolean, boostedUntil?: Date | null): number {
    if (!isBoosted || !boostedUntil) return 0;

    // Check if boost is still active
    if (new Date() > boostedUntil) return 0;

    // Calculate remaining boost time (dynamic score)
    const now = Date.now();
    const end = boostedUntil.getTime();
    const remaining = end - now;
    const hoursRemaining = remaining / (1000 * 60 * 60);

    // More remaining time = higher score
    if (hoursRemaining > 24) {
      return this.WEIGHTS.BOOST.MAX;
    }
    if (hoursRemaining > 12) {
      return this.WEIGHTS.BOOST.MAX - 2;
    }
    return this.WEIGHTS.BOOST.MIN;
  }

  /**
   * Source belirleme (en yüksek öncelikli faktöre göre)
   */
  private determineSource(
    trustInfo: TrustRelationInfo,
    inventoryInfo: InventoryMatchInfo,
    isTrending: boolean,
    isBoosted: boolean,
    engagementScore: number
  ): FeedSource {
    // Priority order
    if (trustInfo.isMutual) return FeedSource.MUTUAL_TRUST;
    if (trustInfo.userTrustsAuthor) return FeedSource.TRUSTER;
    if (trustInfo.authorTrustsUser) return FeedSource.TRUSTER_NETWORK;
    if (inventoryInfo.hasExactProduct) return FeedSource.INVENTORY_MATCH;
    if (inventoryInfo.hasProductGroup) return FeedSource.PRODUCT_GROUP_MATCH;
    if (isBoosted) return FeedSource.BOOSTED;
    if (isTrending) return FeedSource.TRENDING;
    if (engagementScore >= this.WEIGHTS.ENGAGEMENT.HIGH_ENGAGEMENT_BONUS) {
      return FeedSource.ENGAGEMENT_HIGH;
    }
    if (inventoryInfo.hasCategoryMatch) return FeedSource.CATEGORY_MATCH;
    return FeedSource.NEW_USER;
  }

  /**
   * Fallback score (error durumunda)
   */
  private getFallbackScore(): ScoringResult {
    return {
      score: 10,
      source: FeedSource.NEW_USER,
      factors: {
        trustScore: 0,
        inventoryScore: 0,
        engagementScore: 0,
        recencyScore: 0,
        boostScore: 0,
        total: 10,
      },
    };
  }
}

