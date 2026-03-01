import { UserBadge } from '../../domain/gamification/user-badge.entity';
import { Badge } from '../../domain/gamification/badge.entity';
import { UserAchievement } from '../../domain/gamification/user-achievement.entity';
import { BadgeRarity } from '../../domain/gamification/badge-rarity.enum';
import { BadgeType } from '../../domain/gamification/badge-type.enum';
import { BadgeVisibility } from '../../domain/gamification/badge-visibility.enum';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import logger from '../../infrastructure/logger/logger';
import { invalidateBadgeCache } from '../../infrastructure/cache/cache-invalidation';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { CACHE_KEYS } from '../../infrastructure/cache/cache-keys';
import { CACHE_TTL } from '../../infrastructure/cache/cache-ttl';

export class GamificationService {
  private readonly notificationService: NotificationService;
  private prisma: ReturnType<typeof getPrisma>;
  private readonly cacheService: CacheService;

  constructor() {
    this.notificationService = new NotificationService();
    this.prisma = getPrisma();
    this.cacheService = CacheService.getInstance();
  }

  /**
   * Kullanıcıya rozet verir ve bildirim kuyruğuna ekler
   * @param userId - Kullanıcı ID'si
   * @param badgeId - Rozet ID'si
   * @returns Verilen rozet bilgisi
   */
  async grantBadgeToUser(userId: string, badgeId: string): Promise<UserBadge | null> {
    try {
      // Badge bilgisini getir
      const badge = await this.prisma.badge.findUnique({
        where: { id: badgeId },
      });

      if (!badge) {
        logger.error(`Badge ${badgeId} not found`);
        return null;
      }

      // Kullanıcıda zaten bu badge var mı kontrol et (idempotency)
      const existingBadge = await this.prisma.userBadge.findUnique({
        where: {
          userId_badgeId: {
            userId,
            badgeId,
          },
        },
      });

      if (existingBadge) {
        logger.info(`Badge ${badgeId} already granted to user ${userId}`);
        return new UserBadge(
          existingBadge.id,
          existingBadge.userId,
          existingBadge.badgeId,
          existingBadge.isVisible,
          existingBadge.displayOrder,
          existingBadge.visibility as BadgeVisibility,
          existingBadge.claimed,
          existingBadge.claimedAt
        );
      }

      // UserBadge oluştur (claimed=false - kullanıcı claim edecek)
      const userBadge = await this.prisma.userBadge.create({
        data: {
          userId,
          badgeId,
          isVisible: true,
          displayOrder: null,
          visibility: BadgeVisibility.PUBLIC,
          claimed: false, // Event rozetleri claim edilmeli
          claimedAt: null,
        },
      });

      logger.info(`Badge ${badge.name} granted to user ${userId}`);

      // Cache invalidation
      invalidateBadgeCache(userId).catch((err) => {
        logger.warn('Failed to invalidate badge cache after grant', { error: err instanceof Error ? err.message : String(err) });
      });

      // Rozet bildirimini NotificationService ile gönder
      await this.notificationService.sendNotification(
        userId,
        NotificationType.NEW_BADGE,
        {
          badgeName: badge.name,
          badgeIcon: badge.imageUrl || '🏆',
          badgeId: badge.id,
        }
      );

      logger.info(`Notification sent for badge ${badge.name} to user ${userId}`);

      return new UserBadge(
        userBadge.id,
        userBadge.userId,
        userBadge.badgeId,
        userBadge.isVisible,
        userBadge.displayOrder,
        userBadge.visibility as BadgeVisibility,
        userBadge.claimed,
        userBadge.claimedAt
      );
    } catch (error) {
      logger.error(`Failed to grant badge ${badgeId} to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcıya başarı verir ve bildirim kuyruğuna ekler
   * @param userId - Kullanıcı ID'si
   * @param achievementId - Başarı ID'si
   * @returns Verilen başarı bilgisi
   */
  async grantAchievementToUser(userId: string, achievementId: string): Promise<UserAchievement | null> {
    try {
      // Mock achievement data
      const mockUserAchievement = new UserAchievement(
        '00000000-0000-0000-0000-000000000001',
        userId,
        achievementId,
        100, // progress
        true, // completed
        new Date() // completedAt
      );

      logger.info(`Achievement ${achievementId} granted to user ${userId}`);

      // Başarı bildirimini NotificationService ile gönder
      await this.notificationService.sendNotification(
        userId,
        NotificationType.ACHIEVEMENT_UNLOCKED,
        {
        achievementName: 'İlk Başarı',
        achievementIcon: '🏆',
        achievementId,
        }
      );

      logger.info(`Notification sent for achievement ${achievementId} to user ${userId}`);

      return mockUserAchievement;
    } catch (error) {
      logger.error(`Failed to grant achievement ${achievementId} to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcının rozetlerini getirir
   * @param userId - Kullanıcı ID'si
   * @returns Kullanıcının rozetleri
   */
  async getUserBadges(userId: string) {
    try {
      // Cache-aside: check cache first
      const cacheKey = CACHE_KEYS.USER_BADGES(userId);
      const cached = await this.cacheService.get<Array<Record<string, unknown>>>(cacheKey);
      if (cached) {
        return cached;
      }

      const userBadges = await this.prisma.userBadge.findMany({
        where: { userId },
        include: {
          badge: {
            include: {
              category: true,
            },
          },
        },
        orderBy: [
          { claimed: 'desc' },
          { displayOrder: 'asc' },
          { claimedAt: 'desc' },
        ],
      });

      const result = userBadges.map((ub) => ({
        id: ub.id,
        badgeId: ub.badgeId,
        badge: {
          id: ub.badge.id,
          name: ub.badge.name,
          description: ub.badge.description,
          imageUrl: ub.badge.imageUrl,
          type: ub.badge.type,
          rarity: ub.badge.rarity,
          pointValue: this.calculateBadgePoints(ub.badge.rarity as BadgeRarity, ub.badge.type as BadgeType),
          category: ub.badge.category,
        },
        claimed: ub.claimed,
        claimedAt: ub.claimedAt,
        isVisible: ub.isVisible,
        displayOrder: ub.displayOrder,
        visibility: ub.visibility,
        earnedAt: ub.createdAt,
      }));

      // Store in cache
      await this.cacheService.set(cacheKey, result, CACHE_TTL.USER_BADGES).catch(() => {});

      return result;
    } catch (error) {
      logger.error(`Failed to get badges for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcının başarılarını getirir
   * @param userId - Kullanıcı ID'si
   * @returns Kullanıcının başarıları
   */
  async getUserAchievements(userId: string) {
    try {
      const userAchievements = await this.prisma.userAchievement.findMany({
        where: { userId },
        include: {
          goal: {
            include: {
              collection: true,
              actionType: true,
              rewardBadge: true,
            },
          },
        },
        orderBy: [
          { completed: 'desc' },
          { progress: 'desc' },
        ],
      });

      return userAchievements.map((ua) => ({
        id: ua.id,
        goalId: ua.goalId,
        goal: {
          id: ua.goal.id,
          title: ua.goal.title,
          requirement: ua.goal.requirement,
          actionType: {
            mainAction: ua.goal.mainAction,
            label: ua.goal.actionType.label,
          },
          pointsRequired: ua.goal.pointsRequired,
          difficulty: ua.goal.difficulty,
          collection: ua.goal.collection,
          rewardBadge: ua.goal.rewardBadge,
        },
        progress: ua.progress,
        percentage: (ua.progress / ua.goal.pointsRequired) * 100,
        completed: ua.completed,
        completedAt: ua.completedAt,
        remaining: ua.goal.pointsRequired - ua.progress,
      }));
    } catch (error) {
      logger.error(`Failed to get achievements for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcının gamification istatistiklerini getirir
   * @param userId - Kullanıcı ID'si
   * @returns Gamification istatistikleri
   */
  async getUserGamificationStats(userId: string) {
    try {
      // Cache-aside: check cache first
      const cacheKey = CACHE_KEYS.USER_GAMIFICATION_STATS(userId);
      const cached = await this.cacheService.get<Record<string, unknown>>(cacheKey);
      if (cached) {
        return cached;
      }

      // Get badge stats
      const totalBadges = await this.prisma.userBadge.count({ where: { userId } });
      const claimedBadges = await this.prisma.userBadge.count({
        where: { userId, claimed: true },
      });

      // Get achievement stats
      const totalAchievements = await this.prisma.userAchievement.count({
        where: { userId },
      });
      const completedAchievements = await this.prisma.userAchievement.count({
        where: { userId, completed: true },
      });

      // Calculate total points from badges
      const userBadges = await this.prisma.userBadge.findMany({
        where: { userId, claimed: true },
        include: { badge: true },
      });

      let totalPoints = 0;
      const rarityBreakdown = { COMMON: 0, RARE: 0, EPIC: 0 };
      const typeBreakdown = { COLLECTION: 0, EVENT: 0, COSMETIC: 0, BRAND: 0 };

      userBadges.forEach((ub) => {
        const points = this.calculateBadgePoints(ub.badge.rarity as BadgeRarity, ub.badge.type as BadgeType);
        totalPoints += points;
        rarityBreakdown[ub.badge.rarity as keyof typeof rarityBreakdown]++;
        typeBreakdown[ub.badge.type as keyof typeof typeBreakdown]++;
      });

      // Calculate level (100 points per level)
      const level = Math.floor(totalPoints / 100) + 1;
      const nextLevelPoints = level * 100;

      // Collection stats
      const collections = await this.prisma.badgeCollection.findMany({
        include: {
          achievementGoals: {
            include: {
              userAchievements: {
                where: { userId },
              },
            },
          },
        },
      });

      let completedCollections = 0;
      let inProgressCollections = 0;

      collections.forEach((collection) => {
        const goals = collection.achievementGoals;
        const completedGoals = goals.filter((g) =>
          g.userAchievements.some((ua) => ua.completed)
        ).length;

        if (completedGoals === goals.length && goals.length > 0) {
          completedCollections++;
        } else if (completedGoals > 0) {
          inProgressCollections++;
        }
      });

      const stats = {
        badges: {
          total: totalBadges,
          claimed: claimedBadges,
          unclaimed: totalBadges - claimedBadges,
          byRarity: rarityBreakdown,
          byType: typeBreakdown,
        },
        achievements: {
          total: totalAchievements,
          completed: completedAchievements,
          inProgress: totalAchievements - completedAchievements,
          notStarted: 0,
        },
        level,
        experience: totalPoints,
        nextLevelExperience: nextLevelPoints,
        collections: {
          total: collections.length,
          completed: completedCollections,
          inProgress: inProgressCollections,
        },
      };

      // Store in cache
      await this.cacheService.set(cacheKey, stats, CACHE_TTL.USER_GAMIFICATION_STATS).catch(() => {});

      return stats;
    } catch (error) {
      logger.error(`Failed to get gamification stats for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate badge point value based on rarity and type
   */
  private calculateBadgePoints(rarity: BadgeRarity, type: BadgeType): number {
    let basePoints = 0;

    // Rarity points
    switch (rarity) {
      case BadgeRarity.COMMON:
        basePoints = 10;
        break;
      case BadgeRarity.RARE:
        basePoints = 30;
        break;
      case BadgeRarity.EPIC:
        basePoints = 50;
        break;
    }

    // Type multiplier
    let multiplier = 1.0;
    switch (type) {
      case BadgeType.COLLECTION:
        multiplier = 1.0;
        break;
      case BadgeType.EVENT:
        multiplier = 1.5;
        break;
      case BadgeType.COSMETIC:
        multiplier = 0.5;
        break;
      case BadgeType.BRAND:
        multiplier = 2.0;
        break;
    }

    return Math.floor(basePoints * multiplier);
  }

  /**
   * Claim an unclaimed badge
   */
  async claimBadge(userId: string, badgeId: string) {
    const userBadge = await this.prisma.userBadge.findFirst({
      where: { userId, badgeId },
    });

    if (!userBadge) {
      throw new Error('Badge not found in user collection');
    }

    if (userBadge.claimed) {
      throw new Error('Badge already claimed');
    }

    const updated = await this.prisma.userBadge.update({
      where: { id: userBadge.id },
      data: {
        claimed: true,
        claimedAt: new Date(),
      },
      include: { badge: true },
    });

    logger.info('Badge claimed', { userId, badgeId, userBadgeId: updated.id });

    // Cache invalidation
    invalidateBadgeCache(userId).catch((err) => {
      logger.warn('Failed to invalidate badge cache after claim', { error: err instanceof Error ? err.message : String(err) });
    });

    return updated;
  }

  /**
   * Update badge visibility settings
   */
  async updateBadgeVisibility(
    userId: string,
    userBadgeId: string,
    visibility: BadgeVisibility,
    isVisible?: boolean
  ) {
    const userBadge = await this.prisma.userBadge.findUnique({
      where: { id: userBadgeId },
    });

    if (!userBadge || userBadge.userId !== userId) {
      throw new Error('Badge not found');
    }

    await this.prisma.userBadge.update({
      where: { id: userBadgeId },
      data: {
        visibility,
        isVisible: isVisible ?? (visibility !== 'PRIVATE'),
      },
    });

    // Cache invalidation
    invalidateBadgeCache(userId).catch((err) => {
      logger.warn('Failed to invalidate badge cache after visibility update', { error: err instanceof Error ? err.message : String(err) });
    });

    logger.info('Badge visibility updated', { userId, userBadgeId, visibility });
  }

  /**
   * Update badge display order for profile showcase
   */
  async updateBadgeDisplayOrder(
    userId: string,
    badgeOrders: Array<{ userBadgeId: string; displayOrder: number }>
  ) {
    // Verify all badges belong to user
    const userBadgeIds = badgeOrders.map((b) => b.userBadgeId);
    const userBadges = await this.prisma.userBadge.findMany({
      where: { id: { in: userBadgeIds }, userId },
    });

    if (userBadges.length !== badgeOrders.length) {
      throw new Error('Some badges do not belong to user');
    }

    // Update display orders in transaction
    await this.prisma.$transaction(
      badgeOrders.map((bo) =>
        this.prisma.userBadge.update({
          where: { id: bo.userBadgeId },
          data: { displayOrder: bo.displayOrder },
        })
      )
    );

    // Cache invalidation
    invalidateBadgeCache(userId).catch((err) => {
      logger.warn('Failed to invalidate badge cache after display order update', { error: err instanceof Error ? err.message : String(err) });
    });

    logger.info('Badge display order updated', { userId, count: badgeOrders.length });
  }

  /**
   * Get all badges with filters
   */
  async getAllBadges(filters?: {
    type?: string;
    rarity?: string;
    categoryId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};

    if (filters?.type) where.type = filters.type;
    if (filters?.rarity) where.rarity = filters.rarity;
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const badges = await this.prisma.badge.findMany({
      where,
      include: {
        category: true,
        _count: {
          select: { userBadges: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 20,
      skip: filters?.offset || 0,
    });

    return badges.map((badge) => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      imageUrl: badge.imageUrl,
      type: badge.type,
      rarity: badge.rarity,
      pointValue: this.calculateBadgePoints(badge.rarity as BadgeRarity, badge.type as BadgeType),
      category: badge.category,
      earnedByUserCount: badge._count.userBadges,
    }));
  }

  /**
   * Get badge by ID with details
   */
  async getBadgeById(badgeId: string) {
    const badge = await this.prisma.badge.findUnique({
      where: { id: badgeId },
      include: {
        category: true,
        collection: true,
        _count: {
          select: { userBadges: true },
        },
        userBadges: {
          where: { claimed: true },
          include: {
            user: {
              include: {
                profile: {
                  select: { userName: true },
                },
              },
            },
          },
          orderBy: { claimedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!badge) return null;

    return {
      id: badge.id,
      name: badge.name,
      description: badge.description,
      imageUrl: badge.imageUrl,
      type: badge.type,
      rarity: badge.rarity,
      pointValue: this.calculateBadgePoints(badge.rarity as BadgeRarity, badge.type as BadgeType),
      boostMultiplier: badge.boostMultiplier,
      rewardMultiplier: badge.rewardMultiplier,
      category: badge.category,
      collection: badge.collection,
      earnedByUserCount: badge._count.userBadges,
      recentEarners: badge.userBadges.map((ub) => ({
        userId: ub.userId,
        username: ub.user.profile?.userName || 'Unknown',
        claimedAt: ub.claimedAt,
      })),
    };
  }

  /**
   * Get all collections with optional user progress
   */
  async getAllCollections(filters?: {
    categoryId?: string;
    search?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};

    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { shortDescription: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const collections = await this.prisma.badgeCollection.findMany({
      where,
      include: {
        _count: {
          select: {
            badges: true,
            achievementGoals: true,
          },
        },
        achievementGoals: filters?.userId
          ? {
              include: {
                userAchievements: {
                  where: { userId: filters.userId },
                },
              },
            }
          : false,
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 20,
      skip: filters?.offset || 0,
    });

    return collections.map((collection) => {
      const result: Record<string, unknown> = {
        id: collection.id,
        name: collection.name,
        bannerUrl: collection.bannerUrl,
        shortDescription: collection.shortDescription,
        focusSector: collection.focusSector,
        targetGroup: collection.targetGroup,
        badgeCount: collection._count.badges,
        goalCount: collection._count.achievementGoals,
        isLocked: !!collection.unlockCondition,
      };

      if (filters?.userId && collection.achievementGoals) {
        const goals = collection.achievementGoals as Array<{ userAchievements?: Array<{ completed: boolean }> }>;
        const completedGoals = goals.filter((g) =>
          g.userAchievements?.some((ua) => ua.completed)
        ).length;

        result.userProgress = {
          completedGoals,
          totalGoals: goals.length,
          percentage: goals.length > 0 ? (completedGoals / goals.length) * 100 : 0,
          isCompleted: completedGoals === goals.length && goals.length > 0,
        };
      }

      return result;
    });
  }

  /**
   * Get collection by ID with goals and user progress.
   * Optional badgeSearch: filters badges by name/description (case-insensitive).
   */
  async getCollectionById(
    collectionId: string,
    userId?: string,
    options?: { badgeSearch?: string }
  ) {
    const badgeSearchTrimmed = options?.badgeSearch?.trim();
    const collection = await this.prisma.badgeCollection.findUnique({
      where: { id: collectionId },
      include: {
        category: true,
        badges: {
          where: badgeSearchTrimmed
            ? {
                OR: [
                  { name: { contains: badgeSearchTrimmed, mode: 'insensitive' as const } },
                  { description: { contains: badgeSearchTrimmed, mode: 'insensitive' as const } },
                ],
              }
            : undefined,
          select: {
            id: true,
            name: true,
            imageUrl: true,
            rarity: true,
          },
        },
        achievementGoals: {
          include: {
            actionType: true,
            rewardBadge: {
              select: { id: true, name: true },
            },
            userAchievements: userId
              ? {
                  where: { userId },
                }
              : false,
          },
        },
      },
    });

    if (!collection) return null;

    const goals = collection.achievementGoals.map((goal) => {
      const userAchievement = userId ? goal.userAchievements?.[0] : undefined;

      const result: Record<string, unknown> = {
        id: goal.id,
        title: goal.title,
        requirement: goal.requirement,
        actionType: {
          mainAction: goal.mainAction,
          label: goal.actionType.label,
        },
        pointsRequired: goal.pointsRequired,
        difficulty: goal.difficulty,
        rewardBadge: goal.rewardBadge,
      };

      if (userAchievement) {
        result.userProgress = {
          current: userAchievement.progress,
          percentage: (userAchievement.progress / goal.pointsRequired) * 100,
          completed: userAchievement.completed,
          completedAt: userAchievement.completedAt,
        };
      }

      return result;
    });

    const completedGoals = goals.filter(
      (g) => (g.userProgress as { completed?: boolean } | undefined)?.completed
    ).length;

    return {
      id: collection.id,
      name: collection.name,
      bannerUrl: collection.bannerUrl,
      owner: collection.owner,
      focusSector: collection.focusSector,
      targetGroup: collection.targetGroup,
      shortDescription: collection.shortDescription,
      longDescription: collection.longDescription,
      unlockCondition: collection.unlockCondition,
      completionBonus: collection.completionBonus,
      category: collection.category,
      badges: collection.badges,
      goals,
      isLocked: !!collection.unlockCondition,
      userCompletion: userId
        ? {
            completedGoals,
            totalGoals: goals.length,
            percentage: goals.length > 0 ? (completedGoals / goals.length) * 100 : 0,
            isCompleted: completedGoals === goals.length && goals.length > 0,
          }
        : undefined,
    };
  }
}

export default GamificationService;
