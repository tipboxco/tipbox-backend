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
  CollectionBackgroundGradient,
} from '../../interfaces/collections/collections.dto';

/**
 * Deterministic gradient generation from a string ID.
 * Produces consistent colors per collection without requiring DB storage.
 */
function generateGradientFromId(id: string): CollectionBackgroundGradient {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }

  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 45) % 360;
  const h3 = (h1 + 90) % 360;

  return {
    colors: [hslToHex(h1, 65, 50), hslToHex(h2, 60, 45), hslToHex(h3, 70, 40)],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  };
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function isValidGradient(val: unknown): val is CollectionBackgroundGradient {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return (
    Array.isArray(obj.colors) &&
    obj.colors.length >= 2 &&
    typeof obj.start === 'object' &&
    typeof obj.end === 'object'
  );
}

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

    let items: CollectionListItem[] = collections.map((c) => {
      const totalProgress = c.achievementGoals.reduce(
        (sum, g) => sum + g.pointsRequired,
        0,
      );
      const currentProgress = c.achievementGoals.reduce((sum, g) => {
        const p = progressByGoal.get(g.id) ?? 0;
        return sum + Math.min(p, g.pointsRequired);
      }, 0);

      const rawGradient = (c as Record<string, unknown>).backgroundGradient;
      const gradient = isValidGradient(rawGradient)
        ? rawGradient
        : generateGradientFromId(c.id);

      return {
        id: c.id,
        title: c.name,
        description: c.shortDescription ?? c.longDescription ?? '',
        currentProgress,
        totalProgress,
        backgroundGradient: gradient,
        category: c.category?.handle ?? null,
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
          orderBy: { name: 'asc' as const },
          select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
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
        currentProgress,
        totalProgress,
        status,
      };
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

    const rawGradient = (collection as Record<string, unknown>).backgroundGradient;
    const gradient = isValidGradient(rawGradient)
      ? rawGradient
      : generateGradientFromId(collection.id);

    return {
      collection: {
        id: collection.id,
        title: collection.name,
        description: collection.longDescription ?? collection.shortDescription ?? '',
        currentProgress: collectionCurrentProgress,
        totalProgress: collectionTotalProgress,
        backgroundGradient: gradient,
        category: collection.category?.handle ?? null,
      },
      badges,
    };
  }
}
