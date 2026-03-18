import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { CACHE_TTL } from '../../infrastructure/cache/cache-ttl';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import type {
  CollectionListItem,
  CollectionsListResponse,
  CollectionCategory,
  CollectionCategoriesResponse,
  CollectionBadge,
  CollectionBadgeStatus,
  CollectionDetailResponse,
  CompletedCollectionItem,
  CompletedCollectionsResponse,
  UserCollectionProgressItem,
  UserCollectionProgressResponse,
} from '../../interfaces/collections/collections.dto';

export class CollectionsService {
  private cache: CacheService;

  constructor() {
    this.cache = CacheService.getInstance();
  }

  /**
   * EP-01: List collections with search, category filter, and cursor pagination.
   */
  async listCollections(
    userId: string,
    params: {
      search?: string;
      category?: string;
      mainCategoryId?: string;
      subCategoryId?: string;
      productGroupId?: string;
      status?: 'all' | 'completed' | 'in_progress' | 'not_started';
      cursor?: string;
      limit: number;
    },
  ): Promise<CollectionsListResponse> {
    const prisma = getPrisma();
    const statusFilter = params.status && params.status !== 'all' ? params.status : null;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { shortDescription: { contains: params.search, mode: 'insensitive' } },
        { longDescription: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.category && params.category !== 'all') {
      where.category = { handle: params.category };
    }

    if (params.mainCategoryId) {
      // Filter by main category or its children
      where.categoryId = params.subCategoryId ?? params.mainCategoryId;
    }

    // When status filter is active, we need to fetch more items to account for post-filter
    const fetchLimit = statusFilter ? params.limit * 3 : params.limit;

    const [collections, total] = await Promise.all([
      prisma.badgeCollection.findMany({
        where,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
        take: fetchLimit + 1,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true, handle: true } },
          achievementGoals: {
            select: { id: true, pointsRequired: true },
          },
          _count: { select: { badges: true } },
        },
      }),
      prisma.badgeCollection.count({ where }),
    ]);

    // Fetch user progress for all goals in these collections
    const allGoalIds = collections.flatMap((c) =>
      c.achievementGoals.map((g) => g.id),
    );

    const userAchievements =
      allGoalIds.length > 0
        ? await prisma.userAchievement.findMany({
            where: { userId, goalId: { in: allGoalIds } },
            select: { goalId: true, progress: true },
          })
        : [];

    const progressByGoal = new Map(
      userAchievements.map((ua) => [ua.goalId, ua.progress]),
    );

    // Fetch earned badge counts per collection
    const collectionIds = collections.map((c) => c.id);
    const earnedBadges =
      collectionIds.length > 0
        ? await prisma.userBadge.findMany({
            where: {
              userId,
              badge: { collectionId: { in: collectionIds } },
            },
            select: { badge: { select: { collectionId: true } } },
          })
        : [];

    const earnedByCollection = new Map<string, number>();
    for (const ub of earnedBadges) {
      if (ub.badge.collectionId) {
        earnedByCollection.set(
          ub.badge.collectionId,
          (earnedByCollection.get(ub.badge.collectionId) ?? 0) + 1,
        );
      }
    }

    let items: CollectionListItem[] = collections.map((c) => {
      const totalProgress = c.achievementGoals.reduce(
        (sum, g) => sum + g.pointsRequired,
        0,
      );
      const currentProgress = c.achievementGoals.reduce((sum, g) => {
        const p = progressByGoal.get(g.id) ?? 0;
        return sum + Math.min(p, g.pointsRequired);
      }, 0);

      return {
        id: c.id,
        title: c.name,
        description: c.shortDescription ?? c.longDescription ?? '',
        currentProgress,
        totalProgress,
        totalBadges: c._count.badges,
        earnedBadges: earnedByCollection.get(c.id) ?? 0,
        coverImage: c.bannerUrl ? resolveMediaUrl(c.bannerUrl) : null,
        category: c.category?.name ?? null,
      };
    });

    // Apply status filter if specified
    if (statusFilter) {
      items = items.filter((item) => {
        if (statusFilter === 'completed') {
          return item.totalProgress > 0 && item.currentProgress >= item.totalProgress;
        }
        if (statusFilter === 'in_progress') {
          return item.currentProgress > 0 && item.currentProgress < item.totalProgress;
        }
        if (statusFilter === 'not_started') {
          return item.currentProgress === 0;
        }
        return true;
      });
    }

    // Apply pagination limit after status filtering
    const hasMore = items.length > params.limit;
    const paginatedItems = items.slice(0, params.limit);
    const lastItem = paginatedItems[paginatedItems.length - 1];

    return {
      collections: paginatedItems,
      pagination: {
        cursor: hasMore && lastItem ? lastItem.id : null,
        hasMore,
        limit: params.limit,
        total: statusFilter ? paginatedItems.length : total,
      },
    };
  }

  /**
   * EP-02: Get collection chip filter categories.
   */
  async getCollectionCategories(): Promise<CollectionCategoriesResponse> {
    const cacheKey = 'collections:categories';
    const cached = await this.cache.get<CollectionCategoriesResponse>(cacheKey);
    if (cached) return cached;

    const prisma = getPrisma();

    // Find categories that have at least one BadgeCollection
    const categoriesWithCollections = await prisma.category.findMany({
      where: {
        badgeCollections: { some: {} },
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, handle: true },
    });

    const categories: CollectionCategory[] = categoriesWithCollections.map(
      (c) => ({
        id: c.id,
        name: c.name,
        handle: c.handle ?? c.id,
      }),
    );

    const result: CollectionCategoriesResponse = { categories };

    await this.cache.set(cacheKey, result, CACHE_TTL.VERY_LONG);

    return result;
  }

  /**
   * EP-05: Get collections where user has any progress (in_progress + completed).
   * Used on profile pages to show only collections the user has engaged with.
   */
  async getUserCollectionProgress(
    targetUserId: string,
    params: { cursor?: string; limit: number },
  ): Promise<UserCollectionProgressResponse> {
    const prisma = getPrisma();

    // Step 1: Get all achievement goals with user progress
    const goalsWithProgress = await prisma.achievementGoal.findMany({
      select: {
        id: true,
        collectionId: true,
        pointsRequired: true,
        userAchievements: {
          where: { userId: targetUserId },
          select: { progress: true },
        },
      },
    });

    // Step 2: Group by collection, keep only those with progress > 0
    const collectionProgress = new Map<
      string,
      { total: number; current: number }
    >();

    for (const goal of goalsWithProgress) {
      const entry = collectionProgress.get(goal.collectionId) ?? {
        total: 0,
        current: 0,
      };

      entry.total += goal.pointsRequired;
      const ua = goal.userAchievements[0];
      if (ua) {
        entry.current += Math.min(ua.progress, goal.pointsRequired);
      }

      collectionProgress.set(goal.collectionId, entry);
    }

    // Filter: only collections where user has any progress
    const activeCollectionIds: string[] = [];
    const progressData = new Map<string, { current: number; total: number }>();

    for (const [collectionId, progress] of collectionProgress) {
      if (progress.total > 0 && progress.current > 0) {
        activeCollectionIds.push(collectionId);
        progressData.set(collectionId, progress);
      }
    }

    const total = activeCollectionIds.length;

    if (total === 0) {
      return {
        collections: [],
        pagination: { cursor: null, hasMore: false, limit: params.limit, total: 0 },
      };
    }

    // Step 3: Fetch collection details with cursor pagination
    const collections = await prisma.badgeCollection.findMany({
      where: { id: { in: activeCollectionIds } },
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      take: params.limit + 1,
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { name: true } },
        _count: { select: { badges: true } },
      },
    });

    // Step 4: Get earned badge count for user
    const collectionIds = collections.slice(0, params.limit).map((c) => c.id);
    const earnedBadges =
      collectionIds.length > 0
        ? await prisma.userBadge.findMany({
            where: {
              userId: targetUserId,
              badge: { collectionId: { in: collectionIds } },
            },
            select: { badge: { select: { collectionId: true } } },
          })
        : [];

    const earnedByCollection = new Map<string, number>();
    for (const ub of earnedBadges) {
      if (ub.badge.collectionId) {
        earnedByCollection.set(
          ub.badge.collectionId,
          (earnedByCollection.get(ub.badge.collectionId) ?? 0) + 1,
        );
      }
    }

    const hasMore = collections.length > params.limit;
    const paginatedCollections = collections.slice(0, params.limit);
    const lastItem = paginatedCollections[paginatedCollections.length - 1];

    const items: UserCollectionProgressItem[] = paginatedCollections.map((c) => {
      const pd = progressData.get(c.id) ?? { current: 0, total: 0 };
      const isCompleted = pd.total > 0 && pd.current >= pd.total;

      return {
        id: c.id,
        title: c.name,
        description: c.shortDescription ?? c.longDescription ?? '',
        currentProgress: pd.current,
        totalProgress: pd.total,
        coverImage: c.bannerUrl ? resolveMediaUrl(c.bannerUrl) : null,
        category: c.category?.name ?? null,
        status: isCompleted ? 'completed' : 'in_progress',
        totalBadges: c._count.badges,
        earnedBadges: earnedByCollection.get(c.id) ?? 0,
      };
    });

    return {
      collections: items,
      pagination: {
        cursor: hasMore && lastItem ? lastItem.id : null,
        hasMore,
        limit: params.limit,
        total,
      },
    };
  }

  /**
   * EP-04: Get user's completed collections.
   * More efficient than listCollections with status=completed because it queries
   * from the UserAchievement side instead of fetching all collections and filtering.
   */
  async getCompletedCollections(
    targetUserId: string,
    params: { cursor?: string; limit: number },
  ): Promise<CompletedCollectionsResponse> {
    const prisma = getPrisma();

    // Step 1: Get all achievement goals grouped by collection, with user progress
    const goalsWithProgress = await prisma.achievementGoal.findMany({
      select: {
        id: true,
        collectionId: true,
        pointsRequired: true,
        userAchievements: {
          where: { userId: targetUserId },
          select: { progress: true, completedAt: true },
        },
      },
    });

    // Step 2: Group by collection and determine which are completed
    const collectionProgress = new Map<
      string,
      { total: number; current: number; latestCompletedAt: Date | null }
    >();

    for (const goal of goalsWithProgress) {
      const entry = collectionProgress.get(goal.collectionId) ?? {
        total: 0,
        current: 0,
        latestCompletedAt: null,
      };

      entry.total += goal.pointsRequired;
      const ua = goal.userAchievements[0];
      if (ua) {
        entry.current += Math.min(ua.progress, goal.pointsRequired);
        if (ua.completedAt && (!entry.latestCompletedAt || ua.completedAt > entry.latestCompletedAt)) {
          entry.latestCompletedAt = ua.completedAt;
        }
      }

      collectionProgress.set(goal.collectionId, entry);
    }

    // Filter to only completed collections (current >= total && total > 0)
    const completedCollectionIds: string[] = [];
    const completionData = new Map<string, { completedAt: Date | null }>();

    for (const [collectionId, progress] of collectionProgress) {
      if (progress.total > 0 && progress.current >= progress.total) {
        completedCollectionIds.push(collectionId);
        completionData.set(collectionId, { completedAt: progress.latestCompletedAt });
      }
    }

    const total = completedCollectionIds.length;

    if (total === 0) {
      return {
        collections: [],
        pagination: { cursor: null, hasMore: false, limit: params.limit, total: 0 },
      };
    }

    // Step 3: Fetch collection details with cursor pagination
    const collections = await prisma.badgeCollection.findMany({
      where: { id: { in: completedCollectionIds } },
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      take: params.limit + 1,
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { name: true } },
        badges: { select: { id: true } },
        _count: { select: { badges: true } },
      },
    });

    // Step 4: Get earned badge count for user in these collections
    const collectionIds = collections.slice(0, params.limit).map((c) => c.id);
    const earnedBadges =
      collectionIds.length > 0
        ? await prisma.userBadge.findMany({
            where: {
              userId: targetUserId,
              badge: { collectionId: { in: collectionIds } },
            },
            select: { badge: { select: { collectionId: true } } },
          })
        : [];

    const earnedByCollection = new Map<string, number>();
    for (const ub of earnedBadges) {
      if (ub.badge.collectionId) {
        earnedByCollection.set(
          ub.badge.collectionId,
          (earnedByCollection.get(ub.badge.collectionId) ?? 0) + 1,
        );
      }
    }

    const hasMore = collections.length > params.limit;
    const paginatedCollections = collections.slice(0, params.limit);
    const lastItem = paginatedCollections[paginatedCollections.length - 1];

    const items: CompletedCollectionItem[] = paginatedCollections.map((c) => {
      const cd = completionData.get(c.id);
      return {
        id: c.id,
        title: c.name,
        description: c.shortDescription ?? c.longDescription ?? '',
        coverImage: c.bannerUrl ? resolveMediaUrl(c.bannerUrl) : null,
        category: c.category?.name ?? null,
        completedAt: cd?.completedAt?.toISOString() ?? null,
        totalBadges: c._count.badges,
        earnedBadges: earnedByCollection.get(c.id) ?? 0,
      };
    });

    return {
      collections: items,
      pagination: {
        cursor: hasMore && lastItem ? lastItem.id : null,
        hasMore,
        limit: params.limit,
        total,
      },
    };
  }

  /**
   * EP-03: Get collection detail with badges.
   */
  async getCollectionDetail(
    collectionId: string,
    userId: string,
    search?: string,
  ): Promise<CollectionDetailResponse | null> {
    const prisma = getPrisma();

    const collection = await prisma.badgeCollection.findUnique({
      where: { id: collectionId },
      include: {
        category: { select: { id: true, name: true, handle: true } },
        achievementGoals: {
          select: { id: true, pointsRequired: true, rewardBadgeId: true },
        },
        badges: {
          where: search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  { description: { contains: search, mode: 'insensitive' as const } },
                ],
              }
            : undefined,
          orderBy: [{ displayOrder: 'asc' as const }, { createdAt: 'asc' as const }],
          select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            highlightsImage: true,
            status: true,
            displayOrder: true,
            createdAt: true,
          },
        },
      },
    });

    if (!collection) return null;

    // Get user achievements for this collection's goals
    const goalIds = collection.achievementGoals.map((g) => g.id);
    const userAchievements =
      goalIds.length > 0
        ? await prisma.userAchievement.findMany({
            where: { userId, goalId: { in: goalIds } },
            select: { goalId: true, progress: true, completed: true },
          })
        : [];

    const progressByGoal = new Map(
      userAchievements.map((ua) => [ua.goalId, ua]),
    );

    // Build goal map: badgeId -> goal info
    const goalByBadge = new Map(
      collection.achievementGoals
        .filter((g) => g.rewardBadgeId)
        .map((g) => [g.rewardBadgeId!, g]),
    );

    // Check which badges the user already owns
    const badgeIds = collection.badges.map((b) => b.id);
    const userBadges =
      badgeIds.length > 0
        ? await prisma.userBadge.findMany({
            where: { userId, badgeId: { in: badgeIds } },
            select: { badgeId: true, claimed: true },
          })
        : [];
    const ownedBadges = new Set(userBadges.map((ub) => ub.badgeId));

    // Map badges with progress
    const badges: CollectionBadge[] = collection.badges.map((badge) => {
      const goal = goalByBadge.get(badge.id);

      let currentProgress: number;
      let totalProgress: number;

      if (goal) {
        const userAchievement = progressByGoal.get(goal.id);
        totalProgress = goal.pointsRequired;
        currentProgress = Math.min(
          userAchievement?.progress ?? 0,
          totalProgress,
        );
      } else {
        // Badge without an achievement goal: binary (owned or not)
        totalProgress = 1;
        currentProgress = ownedBadges.has(badge.id) ? 1 : 0;
      }

      let status: CollectionBadgeStatus;
      if (currentProgress <= 0) {
        status = 'not_started';
      } else if (currentProgress >= totalProgress) {
        status = 'completed';
      } else {
        status = 'in_progress';
      }

      return {
        id: badge.id,
        title: badge.name,
        description: badge.description ?? '',
        icon: resolveMediaUrl(badge.imageUrl) ?? '',
        highlightsImage: badge.highlightsImage ? resolveMediaUrl(badge.highlightsImage) : null,
        currentProgress,
        totalProgress,
        status,
        isActive: badge.status === 'ACTIVE',
        displayOrder: 0, // will be assigned after sorting
        createdAt: badge.createdAt.toISOString(),
      };
    });

    // Assign sequential displayOrder based on sorted position
    badges.forEach((badge, index) => {
      badge.displayOrder = index + 1;
    });

    // Collection-level progress
    const collectionTotalProgress = collection.achievementGoals.reduce(
      (sum, g) => sum + g.pointsRequired,
      0,
    );
    const collectionCurrentProgress = collection.achievementGoals.reduce(
      (sum, g) => {
        const ua = progressByGoal.get(g.id);
        return sum + Math.min(ua?.progress ?? 0, g.pointsRequired);
      },
      0,
    );

    const totalBadgesCount = collection.badges.length;
    const earnedBadgesCount = ownedBadges.size;

    return {
      collection: {
        id: collection.id,
        title: collection.name,
        description: collection.longDescription ?? collection.shortDescription ?? '',
        currentProgress: collectionCurrentProgress,
        totalProgress: collectionTotalProgress,
        totalBadges: totalBadgesCount,
        earnedBadges: earnedBadgesCount,
        coverImage: collection.bannerUrl ? resolveMediaUrl(collection.bannerUrl) : null,
        category: collection.category?.name ?? null,
      },
      badges,
    };
  }
}
