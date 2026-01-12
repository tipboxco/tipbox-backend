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
} from '../../interfaces/event/event.dto';
import { FeedItem, FeedItemType } from '../../interfaces/feed/feed.dto';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { CACHE_TTL } from '../../infrastructure/cache/cache-ttl';

export class EventService {
  private prisma: ReturnType<typeof getPrisma>;
  private cacheService: CacheService;

  constructor() {
    this.prisma = getPrisma();
    this.cacheService = CacheService.getInstance();
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
      }

      // Event posts cache (eventId'ye özel, tüm cursor'lar için pattern match)
      // Redis pattern matching ile events:posts:eventId:* şeklinde silebiliriz
      // Ancak şimdilik sadece ilk sayfa için silelim
      keysToDelete.push(`events:posts:${eventId}:first:20`);

      // Guest için de active events cache'i temizle
      keysToDelete.push(`events:active:guest:first:20`);

      // Tüm cache key'lerini sil
      for (const key of keysToDelete) {
        await this.cacheService.del(key);
      }

      logger.info({ 
        message: 'Event caches invalidated', 
        eventId, 
        userId,
        keysInvalidated: keysToDelete.length 
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
    const cacheKey = `events:active:${userId || 'guest'}:${options?.cursor || 'first'}:${options?.limit || 20}`;

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
      const where: any = {
        status: 'PUBLISHED',
        startDate: { lte: now },
        endDate: { gte: now },
      };

      const events = await this.prisma.wishboxEvent.findMany({
        where,
        orderBy: { startDate: 'asc' },
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
            eventType: this.mapEventType(event.eventType),
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
      const where: any = {
        status: 'PUBLISHED',
        startDate: { gt: now },
      };

      const events = await this.prisma.wishboxEvent.findMany({
        where,
        orderBy: { startDate: 'asc' },
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
            eventType: this.mapEventType(event.eventType),
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
      const events = await this.prisma.wishboxEvent.findMany({
        where: {
          id: { in: eventIds },
          status: 'PUBLISHED',
          startDate: { lte: now },
          endDate: { gte: now },
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
            eventType: this.mapEventType(event.eventType),
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
      const event = await this.prisma.wishboxEvent.findUnique({
        where: { id: eventId },
        include: {
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
        const userStats = await this.prisma.wishboxStats.findUnique({
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

      // Get reward badges (unique badges from rewards)
      // Note: rewardId is an integer, we need to find badges by matching with achievement goals or other methods
      // For now, get all EVENT type badges as rewards
      const eventBadges = await this.prisma.badge.findMany({
        where: { type: 'EVENT' },
        take: 10,
      });

      const rewardBadges: RewardBadge[] = eventBadges.map((badge) => ({
        id: badge.id,
        image: resolveMediaUrl(badge.imageUrl || null),
        title: badge.name,
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
        eventType: this.mapEventType(event.eventType),
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
      const event = await this.prisma.wishboxEvent.findUnique({
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
        
        // Product image için fallback chain: product -> group -> subCategory -> mainCategory
        const product = post.product as any;
        const group = product?.group;
        const subCategory = group?.subCategory;
        const mainCategory = subCategory?.mainCategory;
        const imagePath = product?.imageUrl || group?.imageUrl || subCategory?.imageUrl || mainCategory?.imageUrl || null;

        return {
          type: baseType as any,
          data: {
            id: post.id,
            type: baseType as any,
            user: {
              id: post.user.id,
              name: post.user.profile?.displayName || post.user.email || 'Anonymous',
              title: post.user.titles?.[0]?.title || '',
              avatar: resolveMediaUrl(post.user.avatars?.[0]?.imageUrl || null, true) || '',
            },
            stats: {
              likes: post.likesCount,
              comments: post.commentsCount,
              shares: post.sharesCount,
              bookmarks: post.favoritesCount,
            },
            createdAt: post.createdAt.toISOString(),
            contextType: 'PRODUCT',
            contextData: {
              id: post.productId || '',
              name: post.product?.name || '',
              subName: post.productGroup?.name || '',
              image: resolveMediaUrl(imagePath),
            },
            content: post.body,
            images: (post.media || []).map((m: any) => resolveMediaUrl(m.mediaUrl)).filter((url: string | null): url is string => url !== null),
          } as any,
        } as any;
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
      const event = await this.prisma.wishboxEvent.findUnique({
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
        .filter(word => word.length > 3); // 3 harften uzun kelimeleri al

      // Tüm EVENT tipindeki badge'leri al
      const allEventBadges = await this.prisma.badge.findMany({
        where: { type: 'EVENT' as any },
        take: 100, // Önce hepsini al, sonra filtrele
      });

      // Event-specific badge'leri filtrele (name'de [Event] ve event keyword'ü içerenler)
      const eventSpecificBadges = allEventBadges.filter(badge => {
        if (!badge.name.includes('[Event]')) return false;
        
        // Event title'daki keyword'lerden biri badge description'da var mı?
        const badgeText = `${badge.name} ${badge.description || ''}`.toLowerCase();
        return eventKeywords.some(keyword => badgeText.includes(keyword));
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
                current = (userAchievement as any).progress || 0;
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
   * Limited Time Event - leaderboard ve kullanıcı skoru ile tek bir aktif event döner
   */
  async getLimitedTimeEvent(userId: string): Promise<LimitedTimeEventResponse | null> {
    const now = new Date();

    // Aktif ve bitiş tarihi ileride olan ilk event'i limited event olarak kullanalım
    const event = await this.prisma.wishboxEvent.findFirst({
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
    const stats = await this.prisma.wishboxStats.findMany({
      where: { eventId: event.id },
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

    const sortedByScore = [...stats].sort((a, b) => scoreFor(b as any) - scoreFor(a as any));

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
      (await this.prisma.wishboxStats.findUnique({
        where: {
          userId_eventId: {
            userId,
            eventId: event.id,
          },
        },
      }));

    let userScore: LimitedTimeEventUser | null = null;
    if (userStat) {
      const statAny = userStat as any;
      const score = scoreFor(statAny);
      const rankIndex = sortedByScore.findIndex((s) => s.userId === userStat.userId);
      const rank = rankIndex >= 0 ? rankIndex + 1 : 0;

      const avatarUrl = resolveMediaUrl(
        statAny.user?.avatars?.[0]?.imageUrl ||
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
      this.prisma.wishboxStats.count({
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
    const stats = await this.prisma.wishboxStats.findMany({
      where: { eventId },
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

    return stats.map((stat) => ({
      userId: stat.user.id,
      avatar: resolveMediaUrl(stat.user.avatars?.[0]?.imageUrl || null, true),
      userName: stat.user.profile?.displayName || stat.user.email || 'Anonymous',
    }));
  }

  /**
   * Helper: Map WishboxEventType to EventType
   */
  private mapEventType(eventType: string): EventType {
    // Map WishboxEventType to 'default' or 'product'
    // For now, all are 'default' unless we have product-specific events
    if (eventType === 'PROMOTION') {
      return 'product';
    }
    return 'default';
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
      const event = await this.prisma.wishboxEvent.findUnique({
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
      const existingStats = await this.prisma.wishboxStats.findUnique({
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

      // wishboxStats'a kayıt ekle
      await this.prisma.wishboxStats.create({
        data: {
          userId,
          eventId: event.id,
          totalParticipated: 0,
          totalComments: 0,
          helpfulVotesReceived: 0,
        },
      });

      logger.info(`User ${userId} joined event ${eventId}`);

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
      const event = await this.prisma.wishboxEvent.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new Error('Event not found');
      }

      // Kullanıcının katılım kaydını kontrol et
      const existingStats = await this.prisma.wishboxStats.findUnique({
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

      // wishboxStats kaydını sil
      await this.prisma.wishboxStats.delete({
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
      const event = await this.prisma.wishboxEvent.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new Error('Event not found');
      }

      // Kullanıcının event stats'ını al
      const userStats = await this.prisma.wishboxStats.findUnique({
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
}
