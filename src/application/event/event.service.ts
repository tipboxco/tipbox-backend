import { PrismaClient } from '@prisma/client';
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
import { buildMediaUrl } from '../../infrastructure/config/media.config';

export class EventService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get active events (currently running)
   */
  async getActiveEvents(
    userId?: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<ActiveEvent> {
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

          return {
            eventId: event.id,
            image: event.imageUrl,
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

          return {
            eventId: event.id,
            image: event.imageUrl,
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
        image: badge.imageUrl,
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
        banner: event.imageUrl,
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
   * Get event posts (content posts related to event products)
   * Note: Events are linked to products through scenarios/choices
   * For now, we'll get posts from products that are mentioned in event scenarios
   */
  async getEventPosts(
    eventId: string,
    userId?: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<EventPosts> {
    try {
      const limit = options?.limit || 20;

      // Get event scenarios to find related products
      const event = await this.prisma.wishboxEvent.findUnique({
        where: { id: eventId },
        include: {
          scenarios: {
            include: {
              choices: {
                include: {
                  user: {
                    include: {
                      profile: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!event) {
        throw new Error('Event not found');
      }

      // For now, return empty posts or get posts from a general feed
      // In a real implementation, you might want to link events to specific products
      // and fetch posts related to those products

      // As a workaround, we can get recent posts from users who participated in the event
      const participantUserIds = new Set<string>();
      event.scenarios.forEach((scenario) => {
        scenario.choices.forEach((choice) => {
          participantUserIds.add(choice.userId);
        });
      });

      if (participantUserIds.size === 0) {
        return {
          items: [],
          pagination: {
            hasMore: false,
            limit,
          },
        };
      }

      // Get posts from participants (limited approach)
      // In production, you'd want a more sophisticated way to link events to posts
      const posts = await this.prisma.contentPost.findMany({
        where: {
          userId: { in: Array.from(participantUserIds) },
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

        return {
          type: baseType as any,
          data: {
            id: post.id,
            type: baseType as any,
            user: {
              id: post.user.id,
              name: post.user.profile?.displayName || post.user.email || 'Anonymous',
              title: post.user.titles?.[0]?.title || '',
              avatar: post.user.avatars?.[0]?.imageUrl || '',
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
              image: post.product?.imageUrl || null,
            },
            content: post.body,
            images: [] as any[],
          } as any,
        } as any;
      });

      return {
        items: feedItems,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get event posts for ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Get event badges (all badges available in the event)
   */
  async getEventBadges(
    eventId: string,
    userId?: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<Badges> {
    try {
      const limit = options?.limit || 20;

      // Event'in varlığını doğrula
      const event = await this.prisma.wishboxEvent.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new Error('Event not found');
      }

      // Şimdilik event rozetlerini, global EVENT tipindeki rozetlerden besliyoruz.
      // WishboxReward.rewardId ile Badge.id birebir eşleşmediği için burada direkt
      // EVENT tipindeki rozetleri listeliyoruz.
      const badges = await this.prisma.badge.findMany({
        where: { type: 'EVENT' as any },
        take: limit + 1,
        ...(options?.cursor && {
          cursor: { id: options.cursor },
          skip: 1,
        }),
      });

      const hasMore = badges.length > limit;
      const resultBadges = hasMore ? badges.slice(0, limit) : badges;
      const nextCursor = hasMore && resultBadges.length > 0 ? resultBadges[resultBadges.length - 1].id : undefined;

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
            image: badge.imageUrl || null,
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
      avatar: s.user.avatars?.[0]?.imageUrl || null,
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

      const avatarUrl =
        statAny.user?.avatars?.[0]?.imageUrl ||
        null;

      userScore = {
        id: userStat.userId,
        avatar: avatarUrl,
        rank,
        score,
      };
    }

    const backgroundImage = buildMediaUrl('tipbox-media/event/eventcardbg.png');
    const eventImage = buildMediaUrl('tipbox-media/event/event.png');

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
   * Helper: Get event interaction count (participants + comments)
   */
  private async getEventInteraction(eventId: string): Promise<number> {
    const [participantsCount, commentsCount] = await Promise.all([
      this.prisma.wishboxStats.count({
        where: { eventId },
      }),
      this.prisma.choiceComment.count({
        where: {
          choice: {
            scenario: {
              eventId,
            },
          },
        },
      }),
    ]);

    return participantsCount + commentsCount;
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
      avatar: stat.user.avatars?.[0]?.imageUrl || null,
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
      FREE: FeedItemType.FEED,
      TIPS: FeedItemType.TIPS_AND_TRICKS,
      COMPARE: FeedItemType.BENCHMARK,
      QUESTION: FeedItemType.QUESTION,
      EXPERIENCE: FeedItemType.FEED,
      UPDATE: FeedItemType.POST,
    };

    return mapping[postType] || FeedItemType.FEED;
  }
}
