import { PrismaClient, Prisma } from '@prisma/client';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import logger from '../../infrastructure/logger/logger';
import {
  ActiveEvent,
  UpComingEvents,
  EventCard,
  EventDetail,
  EventPosts,
  EventParticipant,
  RewardBadge,
  Badges,
  Badge,
  EventType,
  LimitedTimeEventResponse,
  LimitedTimeEventLeaderboardUser,
  LimitedTimeEventUser,
  EventBadgesResponse,
  EventBadgeItem,
  EventUserProgress,
  BadgeProgress,
  LeaderboardEntry,
  EventLeaderboard,
  EventBadgeDetailResponse,
} from '../../interfaces/event/event.dto';
import { FeedItem, FeedItemType, Post, BaseUser, BaseStats, ContextData } from '../../interfaces/feed/feed.dto';
import { ContextType } from '../../domain/content/context-type.enum';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { CACHE_TTL } from '../../infrastructure/cache/cache-ttl';
import { EventMetricsService } from './event-metrics.service';
import { BadgeEligibilityService } from '../gamification/badge-eligibility.service';
import { AchievementProgressService } from '../gamification/achievement-progress.service';
import { ActionLogService } from '../gamification/action-log.service';
import { MainAction } from '../../domain/gamification/main-action.enum';
import { NOT_SYSTEM_USER } from '../../infrastructure/config/system-users';

/** Prisma Event with product relation */
type EventWithProduct = Prisma.EventGetPayload<{
  include: { product: { select: { id: true; name: true; description: true; imageUrl: true } } };
}>;

/** Prisma EventBadge with badge and category relations */
type EventBadgeWithBadge = Prisma.EventBadgeGetPayload<{
  include: { badge: { include: { category: true } } };
}>;

/** Prisma EventStats with user, profile, and avatars relations */
type EventStatsWithUser = Prisma.EventStatsGetPayload<{
  include: {
    user: {
      include: {
        profile: true;
        avatars: true;
      };
    };
  };
}>;

/** Search result item type for searchEvents */
interface EventSearchResultItem {
  id: string;
  name: string;
  description?: string;
  image?: string;
  startDate?: string;
  endDate?: string;
  eventType?: string;
  interaction?: number;
  participants?: EventParticipant[];
  [key: string]: unknown;
}

export class EventService {
  private prisma: PrismaClient;
  private cacheService: CacheService;
  private eventMetricsService: EventMetricsService;
  private badgeEligibilityService: BadgeEligibilityService;
  private achievementProgressService: AchievementProgressService;
  private actionLogService: ActionLogService;

  constructor() {
    this.prisma = getPrisma();
    this.cacheService = CacheService.getInstance();
    this.eventMetricsService = new EventMetricsService();
    this.badgeEligibilityService = new BadgeEligibilityService();
    this.achievementProgressService = new AchievementProgressService();
    this.actionLogService = new ActionLogService();
  }

  /** Prisma Event model delegate (cast for extended client type compatibility) */
  private get eventDelegate() {
    return this.prisma.event;
  }

  /** Prisma EventStats model delegate (cast for extended client type compatibility) */
  private get eventStatsDelegate() {
    return this.prisma.eventStats;
  }

  /**
   * Event cache'lerini invalidate et
   * Join, Leave, Post Create, Post Delete gibi işlemlerde kullanılır
   */
  async invalidateEventCaches(eventId: string, userId?: string): Promise<void> {
    try {
      const keysToDelete: string[] = [];

      // Event detail cache (kullanıcıya özel)
      if (userId) {
        keysToDelete.push(`events:detail:${eventId}:${userId}`);
        keysToDelete.push(`events:active:${userId}:first:20`);
        keysToDelete.push(`events:v2:active:${userId}:first:20`);
        keysToDelete.push(`events:v3:active:${userId}:first:20`);
      }

      // ✅ Event posts cache - TÜM cursor'lar için pattern matching
      // Pattern: events:posts:eventId:*
      const eventPostsPattern = `events:posts:${eventId}:*`;
      try {
        let cursor = '0';
        let totalScanned = 0;
        const maxIterations = 100; // Safety limit
        let iterations = 0;

        do {
          const scanResult = await this.cacheService.scan(cursor, eventPostsPattern, 100);
          cursor = scanResult.cursor;
          
          if (scanResult.keys.length > 0) {
            keysToDelete.push(...scanResult.keys);
            totalScanned += scanResult.keys.length;
          }
          
          iterations++;
        } while (cursor !== '0' && iterations < maxIterations);

        logger.info({
          message: 'Event posts cache keys scanned',
          eventId,
          pattern: eventPostsPattern,
          keysFound: totalScanned,
          iterations
        });
      } catch (scanError) {
        logger.warn({
          message: 'Failed to scan event posts cache, falling back to first page',
          eventId,
          error: scanError
        });
        // Fallback: Sadece ilk sayfayı sil
        keysToDelete.push(`events:posts:${eventId}:first:20`);
      }

      // Guest için de active events cache'i temizle
      keysToDelete.push(`events:active:guest:first:20`);
      keysToDelete.push(`events:v2:active:guest:first:20`);
      keysToDelete.push(`events:v3:active:guest:first:20`);

      // Tüm cache key'lerini sil
      let deletedCount = 0;
      for (const key of keysToDelete) {
        const deleted = await this.cacheService.delete(key);
        if (deleted) deletedCount++;
      }

      logger.info({ 
        message: 'Event caches invalidated', 
        eventId, 
        userId,
        keysToDelete: keysToDelete.length,
        keysDeleted: deletedCount
      });
    } catch (error) {
      logger.warn({ 
        message: 'Event cache invalidation error', 
        eventId,
        userId,
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Get active events (currently running)
   */
  async getActiveEvents(
    userId?: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<ActiveEvent> {
    // NOTE: v2 -> eventType (PICKS/ROASTS) eklendiği için cache version bump
    // NOTE: v3 -> product eklendiği için cache version bump
    const cacheKey = `events:v3:active:${userId || 'guest'}:${options?.cursor || 'first'}:${options?.limit || 20}`;

    // Cache check (otomatik hit/miss işaretler)
    try {
      const cached = await this.cacheService.get<ActiveEvent>(cacheKey);
      if (cached) {
        logger.info({ message: 'Active events served from cache', userId, cacheKey });
        return cached;
      }
    } catch (error) {
      logger.warn({ message: 'Cache error', error: error instanceof Error ? error.message : String(error) });
    }

    try {
      const limit = options?.limit || 20;
      const now = new Date();

      // Fetch active events (PUBLISHED, startDate <= now <= endDate)
      const where: Prisma.EventWhereInput = {
        status: 'PUBLISHED',
        startDate: { lte: now },
        endDate: { gte: now },
      };

      const events = await this.eventDelegate.findMany({
        where,
        orderBy: { startDate: 'asc' },
        include: {
          product: {
            select: { id: true, name: true, description: true, imageUrl: true },
          },
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

      // Map events to EventCard (aktif event'ler için interaction ve participants da dolduralım)
      const eventCards: EventCard[] = await Promise.all(
        resultEvents.map(async (event) => {
          const interaction = await this.getEventInteraction(event.id);
          const participants = await this.getEventParticipants(event.id, 2);

          let imageUrl: string | null = null;
          if (event.imageUrl) {
            imageUrl = resolveMediaUrl(event.imageUrl);
          }

          return {
            eventId: event.id,
            image: imageUrl,
            title: event.title,
            description: event.description,
            startDate: event.startDate.toISOString(),
            endDate: event.endDate.toISOString(),
            interaction,
            eventType: event.feedType as EventType,
            product: event.product
              ? {
                  id: event.product.id,
                  name: event.product.name,
                  description: event.product.description,
                  imageUrl: resolveMediaUrl(event.product.imageUrl || null),
                }
              : null,
            participants,
          };
        })
      );

      const result = {
        items: eventCards,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };

      // Cache'e kaydet
      try {
        await this.cacheService.set(cacheKey, result, CACHE_TTL.SHORT); // 5 dakika (events sık değişir)
      } catch (error) {
        logger.warn({ message: 'Cache set failed', error: error instanceof Error ? error.message : String(error) });
      }

      return result;
    } catch (error) {
      logger.error('Failed to get active events:', error);
      throw error;
    }
  }

  /**
   * Get upcoming events (future events)
   */
  async getUpcomingEvents(
    userId?: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<UpComingEvents> {
    try {
      const limit = options?.limit || 20;
      const now = new Date();

      // Fetch upcoming events (PUBLISHED, startDate > now)
      const where: Prisma.EventWhereInput = {
        status: 'PUBLISHED',
        startDate: { gt: now },
      };

      const events = await this.eventDelegate.findMany({
        where,
        orderBy: { startDate: 'asc' },
        include: {
          product: {
            select: { id: true, name: true, description: true, imageUrl: true },
          },
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

      // Map events to EventCard
      const eventCards: EventCard[] = await Promise.all(
        resultEvents.map(async (event) => {
          const interaction = await this.getEventInteraction(event.id);
          const participants = await this.getEventParticipants(event.id, 2); // Get first 2 participants

          let imageUrl: string | null = null;
          if (event.imageUrl) {
            imageUrl = resolveMediaUrl(event.imageUrl);
          }

          return {
            eventId: event.id,
            image: imageUrl,
            title: event.title,
            description: event.description,
            startDate: event.startDate.toISOString(),
            endDate: event.endDate.toISOString(),
            interaction,
            eventType: event.feedType as EventType,
            product: event.product
              ? {
                  id: event.product.id,
                  name: event.product.name,
                  description: event.product.description,
                  imageUrl: resolveMediaUrl(event.product.imageUrl || null),
                }
              : null,
            participants,
          };
        })
      );

      return {
        items: eventCards,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error('Failed to get upcoming events:', error);
      throw error;
    }
  }

  /**
   * Get user's active events (events the user has participated in)
   */
  async getMyActiveEvents(
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<ActiveEvent> {
    try {
      const limit = options?.limit || 20;
      const now = new Date();

      // Kullanıcının ContentPost'u olan event'leri bul (FREE tipinde)
      const userEventIds = await this.prisma.contentPost.findMany({
        where: { 
          userId,
          eventId: { not: null },
          type: 'FREE',
        },
        select: { eventId: true },
        distinct: ['eventId'],
      });

      const eventIds = userEventIds.map((e: { eventId: string | null }) => e.eventId).filter((id): id is string => id !== null);

      if (eventIds.length === 0) {
        return {
          items: [],
          pagination: { hasMore: false, limit, cursor: undefined },
        };
      }

      // Bu event'lerden aktif olanları getir
      const events = await this.eventDelegate.findMany({
        where: {
          id: { in: eventIds },
          status: 'PUBLISHED',
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: {
          product: {
            select: { id: true, name: true, description: true, imageUrl: true },
          },
        },
        orderBy: { startDate: 'desc' },
        take: limit + 1,
        ...(options?.cursor && {
          cursor: { id: options.cursor },
          skip: 1,
        }),
      });

      const hasMore = events.length > limit;
      const resultEvents = hasMore ? events.slice(0, limit) : events;
      const nextCursor = hasMore && resultEvents.length > 0 ? resultEvents[resultEvents.length - 1].id : undefined;

      // EventCard formatına çevir
      const eventCards: EventCard[] = await Promise.all(
        resultEvents.map(async (event) => {
          const interaction = await this.getEventInteraction(event.id);
          const participants = await this.getEventParticipants(event.id, 2);

          // Kullanıcının bu event'teki post sayısını al (ContentPost FREE tipinde)
          const userPostCount = await this.prisma.contentPost.count({
            where: { 
              eventId: event.id, 
              userId,
              type: 'FREE',
            },
          });

          let imageUrl: string | null = null;
          if (event.imageUrl) {
            imageUrl = resolveMediaUrl(event.imageUrl);
          }

          return {
            eventId: event.id,
            image: imageUrl,
            title: event.title,
            description: event.description,
            startDate: event.startDate.toISOString(),
            endDate: event.endDate.toISOString(),
            interaction,
            eventType: event.feedType as EventType,
            product: event.product
              ? {
                  id: event.product.id,
                  name: event.product.name,
                  description: event.product.description,
                  imageUrl: resolveMediaUrl(event.product.imageUrl || null),
                }
              : null,
            participants,
            userPostCount, // Kullanıcının post sayısı
          };
        })
      );

      return {
        items: eventCards,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error('Failed to get user active events:', error);
      throw error;
    }
  }

  /**
   * Get event detail
   */
  async getEventDetail(eventId: string, userId?: string): Promise<EventDetail> {
    try {
      const event = await this.eventDelegate.findUnique({
        where: { id: eventId },
        include: {
          product: {
            select: { id: true, name: true, description: true, imageUrl: true },
          },
          rewards: {
            where: { rewardType: 'BADGE' },
            include: {
              user: {
                include: {
                  profile: true,
                },
              },
            },
          },
        },
      });

      if (!event) {
        throw new Error('Event not found');
      }

      // Check if user joined (has stats for this event)
      let isJoined = false;
      if (userId) {
        const userStats = await this.eventStatsDelegate.findUnique({
          where: {
            userId_eventId: {
              userId,
              eventId: event.id,
            },
          },
        });
        isJoined = !!userStats;
      }

      // Get interaction count
      const interaction = await this.getEventInteraction(event.id);

      // Get reward badges from EventBadge table (same logic as /badges endpoint)
      const eventBadges = await this.prisma.eventBadge.findMany({
        where: {
          eventId: event.id,
          enabled: true,
        },
        include: {
          badge: {
            include: {
              category: true,
            },
          },
        },
        orderBy: {
          displayOrder: 'asc',
        },
        take: 20, // Limit to 20 badges like /badges endpoint
      });

      const rewardBadges: RewardBadge[] = eventBadges.map((eventBadge) => ({
        id: eventBadge.badge.id,
        image: resolveMediaUrl(eventBadge.badge.imageUrl || null),
        title: eventBadge.badge.name,
      }));

      // Event status (active / upcoming)
      const now = new Date();
      let status: 'active' | 'upcoming' = 'active';
      if (event.startDate > now) {
        status = 'upcoming';
      }

      return {
        eventId: event.id,
        banner: resolveMediaUrl(event.imageUrl || null),
        title: event.title,
        description: event.description,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        interaction,
        eventType: event.feedType as EventType,
        product: event.product
          ? {
              id: event.product.id,
              name: event.product.name,
              description: event.product.description,
              imageUrl: resolveMediaUrl(event.product.imageUrl || null),
            }
          : null,
        isJoined,
        status,
        rewards: rewardBadges,
      };
    } catch (error) {
      logger.error(`Failed to get event detail for ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Get event posts (content posts directly linked to event via eventId)
   * Returns posts of type FREE that are associated with the event
   */
  async getEventPosts(
    eventId: string,
    userId?: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<EventPosts> {
    try {
      const limit = options?.limit || 20;
      const cacheKey = `events:posts:${eventId}:${options?.cursor || 'first'}:${limit}`;

      // Cache check
      try {
        const cached = await this.cacheService.get<EventPosts>(cacheKey);
        if (cached) {
          logger.info({ message: 'Event posts served from cache', eventId, cacheKey });
          return cached;
        }
      } catch (error) {
        logger.warn({ message: 'Cache error', error: error instanceof Error ? error.message : String(error) });
      }

      // Verify event exists
      const event = await this.eventDelegate.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new Error('Event not found');
      }

      // Get posts directly linked to event via eventId field
      const posts = await this.prisma.contentPost.findMany({
        where: {
          eventId: eventId,
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
              product1: true,
              product2: true,
              scores: true,
            },
          },
          question: true,
          tip: true,
          tags: true,
          likes: true,
          comments: true,
          favorites: true,
          media: {
            orderBy: { orderIndex: 'asc' },
          },
          votes: userId
            ? {
                where: { userId },
                take: 1,
              }
            : false,
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(options?.cursor && {
          cursor: { id: options.cursor },
          skip: 1,
        }),
      });

      const hasMore = posts.length > limit;
      const resultPosts = hasMore ? posts.slice(0, limit) : posts;
      const nextCursor = hasMore && resultPosts.length > 0 ? resultPosts[resultPosts.length - 1].id : undefined;

      // Convert posts to a loosely-typed FeedItem array compatible with the frontend FeedItem union
      const feedItems: FeedItem[] = resultPosts.map((post) => {
        const baseType = this.mapContentPostTypeToFeedItemType(post.type);

        // Product image fallback chain: product -> group -> subCategory -> mainCategory
        const product = post.product;
        const group = product?.group;
        const subCategory = group?.subCategory;
        const mainCategory = subCategory?.mainCategory;
        const imagePath = product?.imageUrl || group?.imageUrl || subCategory?.imageUrl || mainCategory?.imageUrl || null;

        const user: BaseUser = {
          id: post.user.id,
          name: post.user.profile?.displayName || post.user.email || 'Anonymous',
          title: post.user.titles?.[0]?.title || '',
          avatar: resolveMediaUrl(post.user.avatars?.[0]?.imageUrl || null, true) || '',
        };

        const stats: BaseStats = {
          likes: post.likesCount,
          comments: post.commentsCount,
          shares: post.sharesCount,
          bookmarks: post.favoritesCount,
          upvotes: post.upvotesCount,
        };

        const contextData: ContextData = {
          id: post.productId || '',
          name: post.product?.name || '',
          subName: post.productGroup?.name || '',
          image: resolveMediaUrl(imagePath),
        };

        const hasUpvoted = userId && Array.isArray(post.votes) ? post.votes.length > 0 : false;

        const postData: Post = {
          id: post.id,
          user,
          stats,
          createdAt: post.createdAt.toISOString(),
          contextType: ContextType.PRODUCT,
          contextData,
          content: post.body,
          images: (post.media || []).map((m) => resolveMediaUrl(m.mediaUrl)).filter((url): url is string => url !== null),
          hasUpvoted,
        };

        return {
          type: baseType as FeedItemType.POST,
          data: postData,
        } as FeedItem;
      });

      const result: EventPosts = {
        items: feedItems,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };

      // Cache'e kaydet
      try {
        await this.cacheService.set(cacheKey, result, CACHE_TTL.EVENT_POSTS);
      } catch (error) {
        logger.warn({ message: 'Failed to cache event posts', error: error instanceof Error ? error.message : String(error) });
      }

      return result;
    } catch (error) {
      logger.error(`Failed to get event posts for ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Get event badges (maximum 5 badges per event, event-specific badges prioritized)
   */
  async getEventBadges(
    eventId: string,
    userId?: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<Badges> {
    try {
      const limit = Math.min(options?.limit || 5, 5); // Max 5 badges per event

      // Event'in varlığını doğrula
      const event = await this.eventDelegate.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new Error('Event not found');
      }

      // Event-specific badge'leri öncelikle al
      // Badge name'inde event title'dan keyword'ler ara
      const eventKeywords = event.title
        .toLowerCase()
        .split(' ')
        .filter((word: string) => word.length > 3); // 3 harften uzun kelimeleri al

      // Tüm EVENT tipindeki badge'leri al
      const allEventBadges = await this.prisma.badge.findMany({
        where: { type: 'EVENT' },
        take: 100, // Önce hepsini al, sonra filtrele
      });

      // Event-specific badge'leri filtrele (name'de [Event] ve event keyword'ü içerenler)
      const eventSpecificBadges = allEventBadges.filter(badge => {
        if (!badge.name.includes('[Event]')) return false;
        
        // Event title'daki keyword'lerden biri badge description'da var mı?
        const badgeText = `${badge.name} ${badge.description || ''}`.toLowerCase();
        return eventKeywords.some((keyword: string) => badgeText.includes(keyword));
      });

      // Önce event-specific badge'leri al, sonra generic EVENT badge'leri
      const prioritizedBadges = [
        ...eventSpecificBadges.slice(0, limit),
        ...allEventBadges
          .filter(b => !eventSpecificBadges.includes(b))
          .slice(0, limit - eventSpecificBadges.length)
      ];

      // Take only the requested limit
      const badges = prioritizedBadges.slice(0, limit);

      const hasMore = false; // Max 5 badge olduğu için pagination yok
      const resultBadges = badges;
      const nextCursor = undefined;

      // Map badges to Badge response format
      const badgeItems: Badge[] = await Promise.all(
        resultBadges.map(async (badge) => {
          // Get user's progress for this badge if userId provided
          let current = 0;
          let total = 100; // Default total

          if (userId) {
            const userBadge = await this.prisma.userBadge.findUnique({
              where: {
                userId_badgeId: {
                  userId,
                  badgeId: badge.id,
                },
              },
            });

            if (userBadge) {
              current = userBadge.claimed ? 100 : 0; // Simplified - you might want to track actual progress
            }

            // Try to get achievement goal for this badge
            const achievementGoal = await this.prisma.achievementGoal.findFirst({
              where: { rewardBadgeId: badge.id },
            });

            if (achievementGoal) {
              total = achievementGoal.pointsRequired;
              // Get user's achievement progress
              const userAchievement = await this.prisma.userAchievement.findFirst({
                where: {
                  userId,
                  goalId: achievementGoal.id,
                },
              });

              if (userAchievement) {
                // Not: schema'da pointsEarned yok, progress alanını kullanıyoruz
                current = userAchievement.progress || 0;
              }
            }
          }

          return {
            id: badge.id,
            title: badge.name,
            description: badge.description || null,
            image: resolveMediaUrl(badge.imageUrl || null),
            current,
            total,
          };
        })
      );

      return {
        items: badgeItems,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get event badges for ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Event'in tüm badge'lerini kullanıcı progress'i ile birlikte getir
   * Yeni format: rarity, category, userProgress dahil
   */
  async getEventBadgesWithProgress(
    eventId: string,
    userId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<EventBadgesResponse> {
    try {
      const limit = Math.min(options?.limit || 20, 50); // Max 50 badges

      // Event'in varlığını doğrula
      const event = await this.eventDelegate.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new Error('Event not found');
      }

      // EventBadge tablosundan event'e ozel badge'leri al
      const eventBadges = await this.prisma.eventBadge.findMany({
        where: {
          eventId,
          enabled: true,
        },
        include: {
          badge: {
            include: {
              category: true,
            },
          },
        },
        orderBy: {
          displayOrder: 'asc',
        },
        take: limit,
      });

      // Kullanıcının event metriklerini al
      const userMetrics = await this.eventMetricsService.getUserMetrics(userId, eventId);

      // Kullanıcının kazandığı badge'leri al
      const userBadges = await this.prisma.userBadge.findMany({
        where: {
          userId,
          badgeId: { in: eventBadges.map((eb) => eb.badgeId) },
        },
        select: {
          badgeId: true,
          claimedAt: true,
        },
      });

      const userBadgeMap = new Map(
        userBadges.map((ub) => [ub.badgeId, ub.claimedAt])
      );

      // Badge'leri map et
      const badgeItems: EventBadgeItem[] = eventBadges.map((eventBadge) => {
        const badge = eventBadge.badge;

        // Threshold and requirementType from EventBadge rank (used as threshold proxy)
        const targetProgress = (eventBadge as unknown as { threshold?: number }).threshold ?? eventBadge.rank;
        const requirementType = (eventBadge as unknown as { requirementType?: string }).requirementType ?? 'POSTS_COUNT';

        // Current progress'i belirle
        let currentProgress = 0;
        switch (requirementType) {
          case 'POSTS_COUNT':
            currentProgress = userMetrics.postsCount;
            break;
          case 'LIKES_RECEIVED':
            currentProgress = userMetrics.likesReceivedCount;
            break;
          default:
            currentProgress = 0;
        }

        // Badge kazanılmış mı?
        const completedAt = userBadgeMap.get(badge.id);
        const isCompleted = completedAt !== undefined;

        // Progress percentage (max 100)
        const progressPercentage = Math.min(
          100,
          Math.round((currentProgress / targetProgress) * 100)
        );

        return {
          id: badge.id,
          title: badge.name,
          description: badge.description || '',
          imageUrl: resolveMediaUrl(badge.imageUrl),
          rarity: badge.rarity.toLowerCase(), // 'common', 'rare', 'epic'
          category: badge.category?.name || 'Event',
          userProgress: {
            current: currentProgress,
            target: targetProgress,
            isCompleted,
            completedAt: completedAt ? completedAt.toISOString() : undefined,
            progressPercentage,
          },
          eventId,
          createdAt: badge.createdAt.toISOString(),
        };
      });

      return {
        items: badgeItems,
        pagination: {
          cursor: undefined, // Şimdilik cursor pagination yok
          hasMore: false, // Tüm badge'leri tek seferde döndürüyoruz
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get event badges with progress for ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Limited Time Event - leaderboard ve kullanıcı skoru ile tek bir aktif event döner
   */
  async getLimitedTimeEvent(userId: string): Promise<LimitedTimeEventResponse | null> {
    const now = new Date();

    // Aktif ve bitiş tarihi ileride olan ilk event'i limited event olarak kullanalım
    const event = await this.eventDelegate.findFirst({
      where: {
        status: 'PUBLISHED',
        endDate: { gt: now },
      },
      orderBy: { endDate: 'asc' },
    });

    if (!event) {
      return null;
    }

    // Leaderboard için en yüksek skora sahip kullanıcıları çek
    const stats = await this.eventStatsDelegate.findMany({
      where: {
        eventId: event.id,
        user: { ...NOT_SYSTEM_USER },
      },
      include: {
        user: {
          include: {
            profile: true,
            avatars: {
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      take: 50,
    });

    const scoreFor = (s: { totalParticipated: number; totalComments: number; helpfulVotesReceived: number }): number => {
      return (
        (s.totalParticipated || 0) +
        (s.totalComments || 0) +
        (s.helpfulVotesReceived || 0) * 2
      );
    };

    const sortedByScore = [...stats].sort((a, b) => scoreFor(b) - scoreFor(a));

    // Only return top 3 users for leaderboard
    const topUsers = sortedByScore.slice(0, 3);

    const leaderboardUsers: LimitedTimeEventLeaderboardUser[] = topUsers.map((s, index) => ({
      id: s.userId,
      avatar: resolveMediaUrl(s.user.avatars?.[0]?.imageUrl || null, true),
      rank: index + 1,
    }));

    // Kullanıcının kendi skoru ve sırası
    const userStat =
      sortedByScore.find((s) => s.userId === userId) ||
      (await this.eventStatsDelegate.findUnique({
        where: {
          userId_eventId: {
            userId,
            eventId: event.id,
          },
        },
      }));

    let userScore: LimitedTimeEventUser | null = null;
    if (userStat) {
      const score = scoreFor(userStat);
      const rankIndex = sortedByScore.findIndex((s) => s.userId === userStat.userId);
      const rank = rankIndex >= 0 ? rankIndex + 1 : 0;

      const userStatWithRelations = userStat as EventStatsWithUser;
      const avatarUrl = resolveMediaUrl(
        userStatWithRelations.user?.avatars?.[0]?.imageUrl ||
        null,
        true
      );

      userScore = {
        id: userStat.userId,
        avatar: avatarUrl,
        rank,
        score,
      };
    }

    const backgroundImage = resolveMediaUrl('event/eventcardbg.png') || '';
    const eventImage = resolveMediaUrl('event/event.png') || '';

    return {
      id: event.id,
      title: event.title,
      description: event.description || null,
      leaderboardUsers,
      userScore,
      backgroundImage,
      eventImage,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
    };
  }

  /**
   * Helper: Get event interaction count (participants + posts)
   */
  private async getEventInteraction(eventId: string): Promise<number> {
    const [participantsCount, contentPostsCount] = await Promise.all([
      this.eventStatsDelegate.count({
        where: { eventId },
      }),
      this.prisma.contentPost.count({
        where: { 
          eventId,
          type: 'FREE',
        },
      }),
    ]);

    return participantsCount + contentPostsCount;
  }

  /**
   * Helper: Get event participants (limited)
   */
  private async getEventParticipants(eventId: string, limit: number = 2): Promise<EventParticipant[]> {
    const stats = await this.eventStatsDelegate.findMany({
      where: {
        eventId,
        user: { ...NOT_SYSTEM_USER },
      },
      include: {
        user: {
          include: {
            profile: true,
            avatars: {
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    type StatWithUser = (typeof stats)[number];
    return stats.map((stat: StatWithUser) => ({
      userId: stat.user.id,
      avatar: resolveMediaUrl(stat.user.avatars?.[0]?.imageUrl || null, true),
      userName: stat.user.profile?.displayName || stat.user.email || 'Anonymous',
    }));
  }

  /**
   * Helper: Map ContentPostType to FeedItemType
   */
  private mapContentPostTypeToFeedItemType(postType: string): FeedItemType {
    const mapping: Record<string, FeedItemType> = {
      FREE: FeedItemType.POST,
      TIPS: FeedItemType.TIPS_AND_TRICKS,
      COMPARE: FeedItemType.BENCHMARK,
      QUESTION: FeedItemType.QUESTION,
      EXPERIENCE: FeedItemType.EXPERIENCE,
      UPDATE: FeedItemType.UPDATE,
    };

    return mapping[postType] || FeedItemType.POST;
  }

  /**
   * Event'e katıl
   */
  async joinEvent(eventId: string, userId: string): Promise<EventDetail> {
    try {
      // Event'in var olup olmadığını kontrol et
      const event = await this.eventDelegate.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new Error('Event not found');
      }

      // Event'in aktif olup olmadığını kontrol et
      const now = new Date();
      if (event.startDate > now) {
        throw new Error('Event has not started yet');
      }
      if (event.endDate < now) {
        throw new Error('Event has ended');
      }

      // Event status'u PUBLISHED olmalı
      if (event.status !== 'PUBLISHED') {
        throw new Error('Event is not published');
      }

      // Kullanıcının zaten katılmış olup olmadığını kontrol et
      const existingStats = await this.eventStatsDelegate.findUnique({
        where: {
          userId_eventId: {
            userId,
            eventId: event.id,
          },
        },
      });

      if (existingStats) {
        // Zaten katılmış, mevcut event detayını döndür
        logger.info(`User ${userId} already joined event ${eventId}`);
        return await this.getEventDetail(eventId, userId);
      }

      // eventStats'a kayıt ekle
      await this.eventStatsDelegate.create({
        data: {
          userId,
          eventId: event.id,
          totalParticipated: 0,
          totalComments: 0,
          helpfulVotesReceived: 0,
        },
      });

      logger.info(`User ${userId} joined event ${eventId}`);

      // Action log (fire-and-forget)
      this.actionLogService
        .logAction({
          userId,
          mainAction: MainAction.JOIN,
          actionTypeCode: 'ALL',
          entityType: 'event',
          entityId: eventId,
          metadata: { eventId },
        })
        .catch((err) => {
          logger.warn({
            message: 'Failed to log JOIN action for event',
            userId,
            eventId,
            error: err instanceof Error ? err.message : String(err),
          });
        });

      // Collection badge progress (async)
      this.achievementProgressService
        .incrementProgressByCode(userId, MainAction.JOIN, 'ALL', 1)
        .catch((err) => {
          logger.warn({
            message: 'Failed to increment achievement progress for event join (ALL)',
            userId,
            eventId,
            error: err instanceof Error ? err.message : String(err),
          });
        });

      // Collection badge progress for EVENT-specific join tracking (async)
      this.achievementProgressService
        .incrementProgressByCode(userId, MainAction.JOIN, 'EVENT', 1)
        .catch((err) => {
          logger.warn({
            message: 'Failed to increment achievement progress for event join (EVENT)',
            userId,
            eventId,
            error: err instanceof Error ? err.message : String(err),
          });
        });

      // Cache'i invalidate et
      await this.invalidateEventCaches(eventId, userId);

      // Event detayını döndür
      return await this.getEventDetail(eventId, userId);
    } catch (error) {
      logger.error(`Failed to join event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Leave an event (idempotent)
   */
  async leaveEvent(eventId: string, userId: string): Promise<EventDetail> {
    try {
      // Event'in var olup olmadığını kontrol et
      const event = await this.eventDelegate.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new Error('Event not found');
      }

      // Kullanıcının katılım kaydını kontrol et
      const existingStats = await this.eventStatsDelegate.findUnique({
        where: {
          userId_eventId: {
            userId,
            eventId: event.id,
          },
        },
      });

      if (!existingStats) {
        // Zaten katılmamış, mevcut event detayını döndür (idempotent)
        logger.info(`User ${userId} has not joined event ${eventId}, nothing to leave`);
        return await this.getEventDetail(eventId, userId);
      }

      // eventStats kaydını sil
      await this.eventStatsDelegate.delete({
        where: {
          userId_eventId: {
            userId,
            eventId: event.id,
          },
        },
      });

      logger.info(`User ${userId} left event ${eventId}`);

      // Cache'i invalidate et
      await this.invalidateEventCaches(eventId, userId);

      // Event detayını döndür (isJoined: false olacak)
      return await this.getEventDetail(eventId, userId);
    } catch (error) {
      logger.error(`Failed to leave event ${eventId} for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Event gereksinimlerini ve kullanıcının ilerlemesini getir
   */
  async getEventRequirements(eventId: string, userId: string): Promise<{
    eventId: string;
    requirements: Array<{
      id: string;
      title: string;
      description: string;
      type: string;
      completed: boolean;
      progress?: {
        current: number;
        total: number;
      };
    }>;
    overallProgress: {
      completed: number;
      total: number;
      percentage: number;
    };
  }> {
    try {
      // Event'in var olup olmadığını kontrol et
      const event = await this.eventDelegate.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new Error('Event not found');
      }

      // Kullanıcının event stats'ını al
      const userStats = await this.eventStatsDelegate.findUnique({
        where: {
          userId_eventId: {
            userId,
            eventId: event.id,
          },
        },
      });

      // Event'e ait post sayısı (kullanıcının event ile ilgili post'ları)
      const userEventPosts = await this.prisma.contentPost.count({
        where: {
          userId,
          eventId: event.id,
        },
      });

      // Event'e ait share sayısı (bridgePost veya başka bir tablo olabilir)
      // Şimdilik basit bir hesaplama yapıyoruz
      const userShares = 0; // TODO: Share sayısını hesapla

      // Requirements listesi
      const requirements = [
        {
          id: `${eventId}-survey`,
          title: 'Anketi Tamamla',
          description: 'Event anketini tamamlayarak puan kazan',
          type: 'survey',
          completed: userStats ? (userStats.totalParticipated || 0) >= 1 : false,
          progress: {
            current: userStats ? (userStats.totalParticipated || 0) : 0,
            total: 1,
          },
        },
        {
          id: `${eventId}-post`,
          title: 'Post Paylaş',
          description: 'Event ile ilgili bir post paylaş',
          type: 'post',
          completed: userEventPosts >= 1,
          progress: {
            current: userEventPosts,
            total: 1,
          },
        },
        {
          id: `${eventId}-share`,
          title: 'Paylaşım Yap',
          description: "Event'i sosyal medyada paylaş",
          type: 'share',
          completed: userShares >= 1,
        },
      ];

      // Overall progress hesapla
      const completedCount = requirements.filter((req) => req.completed).length;
      const totalCount = requirements.length;
      const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100 * 100) / 100 : 0;

      return {
        eventId: event.id,
        requirements,
        overallProgress: {
          completed: completedCount,
          total: totalCount,
          percentage,
        },
      };
    } catch (error) {
      logger.error(`Failed to get event requirements for ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcının event ilerlemesini ve badge'lerini getir
   */
  async getUserEventProgress(userId: string, eventId: string): Promise<EventUserProgress> {
    try {
      // Kullanıcının metriklerini al
      const metrics = await this.eventMetricsService.getUserMetrics(userId, eventId);

      // Event için tanımlı badge'leri ve requirement'ları al
      const requirements = await this.badgeEligibilityService.getEventBadgeRequirements(eventId);

      // Kullanıcının badge'lerini al
      const userBadges = await this.prisma.userBadge.findMany({
        where: {
          userId,
          badgeId: {
            in: requirements.map((r) => r.badgeId),
          },
        },
        select: {
          badgeId: true,
        },
      });

      const earnedBadgeIds = new Set(userBadges.map((ub) => ub.badgeId));

      // Badge progress bilgilerini oluştur
      const badges: BadgeProgress[] = [];
      for (const requirement of requirements) {
        const badge = await this.prisma.badge.findUnique({
          where: { id: requirement.badgeId },
        });

        if (!badge) continue;

        let currentProgress = 0;
        switch (requirement.type) {
          case 'POSTS_COUNT':
            currentProgress = metrics.postsCount;
            break;
          case 'LIKES_RECEIVED':
            currentProgress = metrics.likesReceivedCount;
            break;
        }

        const progressPercentage = Math.min(
          100,
          Math.round((currentProgress / requirement.threshold) * 100)
        );

        badges.push({
          badgeId: badge.id,
          badgeName: badge.name,
          badgeDescription: badge.description || '',
          badgeImage: resolveMediaUrl(badge.imageUrl),
          badgeRarity: badge.rarity,
          requirement: {
            type: requirement.type,
            threshold: requirement.threshold,
          },
          currentProgress,
          isEarned: earnedBadgeIds.has(badge.id),
          progressPercentage,
        });
      }

      // Leaderboard'u al (ilk 10 kullanıcı)
      const leaderboardData = await this.eventMetricsService.getLeaderboard(eventId, 10);

      const leaderboardEntries = await Promise.all(
        leaderboardData.map(async (entry) => {
          const user = await this.prisma.user.findUnique({
            where: { id: entry.userId },
            include: {
              profile: true,
              avatars: {
                where: { isActive: true },
                take: 1,
              },
            },
          });

          if (!user || user.isSystemUser) return null;

          return {
            userId: entry.userId,
            userName: user.profile?.displayName || user.email || 'Unknown',
            avatar: resolveMediaUrl(user.avatars?.[0]?.imageUrl || null, true),
            postsCount: entry.postsCount,
            likesReceived: entry.likesReceivedCount,
          };
        })
      );

      const leaderboard: LeaderboardEntry[] = leaderboardEntries
        .filter((e): e is NonNullable<typeof e> => e !== null)
        .map((e, index) => ({ ...e, rank: index + 1 }));

      return {
        userId,
        eventId,
        metrics: {
          postsCount: metrics.postsCount,
          likesReceived: metrics.likesReceivedCount,
        },
        badges,
        leaderboard,
      };
    } catch (error) {
      logger.error(`Failed to get user event progress for user ${userId} in event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Event leaderboard'unu getir
   */
  async getEventLeaderboard(eventId: string, limit: number = 50): Promise<EventLeaderboard> {
    try {
      const leaderboardData = await this.eventMetricsService.getLeaderboard(eventId, limit);

      const entries = await Promise.all(
        leaderboardData.map(async (entry) => {
          const user = await this.prisma.user.findUnique({
            where: { id: entry.userId },
            include: {
              profile: true,
              avatars: {
                where: { isActive: true },
                take: 1,
              },
            },
          });

          if (!user || user.isSystemUser) return null;

          return {
            userId: entry.userId,
            userName: user.profile?.displayName || user.email || 'Unknown',
            avatar: resolveMediaUrl(user.avatars?.[0]?.imageUrl || null, true),
            postsCount: entry.postsCount,
            likesReceived: entry.likesReceivedCount,
          };
        })
      );

      const items: LeaderboardEntry[] = entries
        .filter((e): e is NonNullable<typeof e> => e !== null)
        .map((e, index) => ({ ...e, rank: index + 1 }));

      return {
        eventId,
        items,
      };
    } catch (error) {
      logger.error(`Failed to get event leaderboard for ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Event badge detail'i ve user progress'i getir
   * Badge'in detay bilgilerini ve kullanıcının o badge'deki ilerlemesini döner
   */
  async getEventBadgeDetail(
    eventId: string,
    badgeId: string,
    userId: string
  ): Promise<EventBadgeDetailResponse> {
    try {
      // Badge'i getir
      const badge = await this.prisma.badge.findUnique({
        where: { id: badgeId },
        include: {
          category: true,
          achievementGoals: {
            select: {
              requirement: true,
            },
          },
        },
      });

      if (!badge) {
        throw new Error('Badge not found');
      }

      // Event'in varlığını kontrol et
      const event = await this.eventDelegate.findUnique({
        where: { id: eventId },
        select: { id: true },
      });

      if (!event) {
        throw new Error('Event not found');
      }

      // Badge'in bu event'e ait olup olmadığını kontrol et
      // (Badge requirement'ında eventId kontrolü yapabilirsiniz)
      // Şimdilik badge type'ı EVENT ise devam et
      if (badge.type !== 'EVENT') {
        throw new Error('Badge does not belong to this event');
      }

      // Badge requirement'ı parse et
      const achievementGoal = badge.achievementGoals[0];
      if (!achievementGoal) {
        throw new Error('Badge requirement not found');
      }

      const requirement = JSON.parse(achievementGoal.requirement);
      const requirementType = requirement.type; // 'POSTS_COUNT' or 'LIKES_RECEIVED'
      const threshold = requirement.threshold;

      // Kullanıcının event metriklerini al
      const metrics = await this.eventMetricsService.getUserMetrics(userId, eventId);

      // Current progress'i belirle
      let currentProgress = 0;
      switch (requirementType) {
        case 'POSTS_COUNT':
          currentProgress = metrics.postsCount;
          break;
        case 'LIKES_RECEIVED':
          currentProgress = metrics.likesReceivedCount;
          break;
        default:
          currentProgress = 0;
      }

      // Badge kazanılmış mı kontrol et
      const userBadge = await this.prisma.userBadge.findUnique({
        where: {
          userId_badgeId: {
            userId,
            badgeId,
          },
        },
        select: {
          claimed: true,
          claimedAt: true,
          // createdAt: true, // ❌ UserBadge'de createdAt field'ı yok!
        },
      });

      const isCompleted = userBadge !== null;
      const completedAt = userBadge?.claimedAt || null; // ✅ claimedAt kullan

      // Progress percentage hesapla (max 100)
      const progressPercentage = Math.min(100, Math.round((currentProgress / threshold) * 100));

      return {
        id: badge.id,
        title: badge.name,
        description: badge.description || '',
        imageUrl: resolveMediaUrl(badge.imageUrl),
        rarity: badge.rarity,
        userProgress: {
          current: currentProgress,
          target: threshold,
          isCompleted,
          completedAt: completedAt ? completedAt.toISOString() : null,
          progressPercentage,
        },
        category: badge.category?.name || 'Event',
        eventId: eventId,
        createdAt: badge.createdAt.toISOString(),
      };
    } catch (error) {
      logger.error(
        `Failed to get event badge detail for badge ${badgeId} in event ${eventId} for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Search events (community or achievement)
   */
  async searchEvents(
    query: string,
    options?: { type?: 'community' | 'achievement'; cursor?: string; limit?: number }
  ): Promise<{
    items: EventSearchResultItem[];
    pagination: {
      cursor?: string;
      hasMore: boolean;
      limit: number;
    };
  }> {
    const limit = options?.limit || 20;
    const eventType = options?.type || 'community';
    const searchQuery = query?.trim();

    if (!searchQuery || searchQuery.length === 0) {
      return {
        items: [],
        pagination: {
          hasMore: false,
          limit,
        },
      };
    }

    const cacheKey = `events:search:${eventType}:${searchQuery}:${options?.cursor || 'first'}:${limit}`;

    try {
      const cached = await this.cacheService.get<{
        items: EventSearchResultItem[];
        pagination: {
          cursor?: string;
          hasMore: boolean;
          limit: number;
        };
      }>(cacheKey);
      if (cached) {
        logger.info({ message: 'Events search served from cache', cacheKey });
        return cached;
      }
    } catch (error) {
      logger.warn({ message: 'Cache error', error: error instanceof Error ? error.message : String(error) });
    }

    const now = new Date();

    // Build where clause based on type
    const andConditions: Prisma.EventWhereInput[] = [
      {
        OR: [
          { title: { contains: searchQuery, mode: 'insensitive' } },
          { description: { contains: searchQuery, mode: 'insensitive' } },
        ],
      },
    ];

    // For community events, filter active/upcoming events
    // For achievement events, we can include all published events
    if (eventType === 'community') {
      // Community events: active or upcoming
      andConditions.push({
        OR: [
          {
            AND: [
              { startDate: { lte: now } },
              { endDate: { gte: now } },
            ],
          },
          {
            startDate: { gt: now },
          },
        ],
      });
    }

    const where: Prisma.EventWhereInput = {
      status: 'PUBLISHED',
      AND: andConditions,
    };

    const events = await this.eventDelegate.findMany({
      where,
      orderBy: eventType === 'community' ? { startDate: 'asc' } : { createdAt: 'desc' },
      take: limit + 1,
      ...(options?.cursor && {
        cursor: { id: options.cursor },
        skip: 1,
      }),
    });

    const hasMore = events.length > limit;
    const resultEvents = hasMore ? events.slice(0, limit) : events;
    const nextCursor = hasMore && resultEvents.length > 0 ? resultEvents[resultEvents.length - 1].id : undefined;

    // Map events to response format
    type EventItem = (typeof resultEvents)[number];
    const items = await Promise.all(
      resultEvents.map(async (event: EventItem) => {
        const interaction = await this.getEventInteraction(event.id);
        const participants = await this.getEventParticipants(event.id, 2);

        let imageUrl: string | null = null;
        if (event.imageUrl) {
          imageUrl = resolveMediaUrl(event.imageUrl);
        }

        return {
          id: event.id,
          name: event.title,
          description: event.description || undefined,
          image: imageUrl || undefined,
          startDate: event.startDate.toISOString(),
          endDate: event.endDate.toISOString(),
          eventType: event.feedType ?? 'PICKS',
          interaction,
          participants: participants.map((p) => ({
            userId: p.userId,
            avatar: p.avatar,
            userName: p.userName,
          })),
        };
      })
    );

    const response = {
      items,
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
}
