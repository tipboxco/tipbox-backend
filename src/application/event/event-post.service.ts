import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import logger from '../../infrastructure/logger/logger';
import { generateUlid } from '../../infrastructure/ids/id.strategy';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';

export class EventPostService {
  private prisma = getPrisma();

  /**
   * Event post oluştur
   */
  async createEventPost(data: {
    eventId: string;
    userId: string;
    productId?: string;
    title: string;
    body: string;
  }) {
    // Event var mı ve aktif mi kontrol et
    const event = await this.prisma.wishboxEvent.findUnique({
      where: { id: data.eventId },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    const now = new Date();
    if (event.startDate > now) {
      throw new Error('Event has not started yet');
    }
    if (event.endDate < now) {
      throw new Error('Event has ended');
    }
    if (event.status !== 'PUBLISHED') {
      throw new Error('Event is not published');
    }

    // Ürün varsa kontrol et
    if (data.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: data.productId },
      });
      
      if (!product) {
        throw new Error('Product not found');
      }
    }

    // Post oluştur
    const post = await this.prisma.eventPost.create({
      data: {
        id: generateUlid(),
        eventId: data.eventId,
        userId: data.userId,
        productId: data.productId,
        title: data.title,
        body: data.body,
      },
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
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            imageUrl: true,
          },
        },
      },
    });

    // WishboxStats güncelle (totalParticipated)
    await this.prisma.wishboxStats.upsert({
      where: {
        userId_eventId: {
          userId: data.userId,
          eventId: data.eventId,
        },
      },
      create: {
        userId: data.userId,
        eventId: data.eventId,
        totalParticipated: 1,
        totalComments: 0,
        helpfulVotesReceived: 0,
      },
      update: {
        totalParticipated: { increment: 1 },
      },
    });

    logger.info(`Event post created: ${post.id} by user ${data.userId}`);

    return {
      id: post.id,
      eventId: post.eventId,
      title: post.title,
      body: post.body,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt.toISOString(),
      user: {
        id: post.user.id,
        name: post.user.profile?.displayName || post.user.email || 'Anonymous',
        avatar: resolveMediaUrl(post.user.avatars?.[0]?.imageUrl, true),
      },
      product: post.product ? {
        id: post.product.id,
        name: post.product.name,
        brand: post.product.brand,
        image: resolveMediaUrl(post.product.imageUrl),
      } : null,
    };
  }

  /**
   * Event post'larını listele
   */
  async getEventPosts(
    eventId: string,
    options?: { cursor?: string; limit?: number; userId?: string }
  ) {
    const limit = options?.limit || 20;

    const posts = await this.prisma.eventPost.findMany({
      where: { eventId },
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
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            imageUrl: true,
          },
        },
        likes: options?.userId
          ? {
              where: { userId: options.userId },
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
    const items = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : undefined;

    return {
      items: items.map((post) => ({
        id: post.id,
        eventId: post.eventId,
        title: post.title,
        body: post.body,
        likesCount: post.likesCount,
        commentsCount: post.commentsCount,
        createdAt: post.createdAt.toISOString(),
        user: {
          id: post.user.id,
          name: post.user.profile?.displayName || post.user.email || 'Anonymous',
          avatar: resolveMediaUrl(post.user.avatars?.[0]?.imageUrl, true),
        },
        product: post.product ? {
          id: post.product.id,
          name: post.product.name,
          brand: post.product.brand,
          image: resolveMediaUrl(post.product.imageUrl),
        } : null,
        isLikedByUser: options?.userId ? (post.likes as any[]).length > 0 : false,
      })),
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }

  /**
   * Event post detayı
   */
  async getEventPostDetail(postId: string, userId?: string) {
    const post = await this.prisma.eventPost.findUnique({
      where: { id: postId },
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
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            imageUrl: true,
          },
        },
        likes: userId
          ? {
              where: { userId },
              take: 1,
            }
          : false,
        event: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!post) {
      throw new Error('Post not found');
    }

    return {
      id: post.id,
      eventId: post.eventId,
      title: post.title,
      body: post.body,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt.toISOString(),
      user: {
        id: post.user.id,
        name: post.user.profile?.displayName || post.user.email || 'Anonymous',
        avatar: resolveMediaUrl(post.user.avatars?.[0]?.imageUrl, true),
      },
      product: post.product ? {
        id: post.product.id,
        name: post.product.name,
        brand: post.product.brand,
        image: resolveMediaUrl(post.product.imageUrl),
      } : null,
      event: {
        id: post.event.id,
        title: post.event.title,
      },
      isLikedByUser: userId ? (post.likes as any[]).length > 0 : false,
    };
  }

  /**
   * Event post'u sil
   */
  async deleteEventPost(postId: string, userId: string) {
    const post = await this.prisma.eventPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new Error('Post not found');
    }

    if (post.userId !== userId) {
      throw new Error('Unauthorized: You can only delete your own posts');
    }

    await this.prisma.eventPost.delete({
      where: { id: postId },
    });

    logger.info(`Event post deleted: ${postId} by user ${userId}`);
  }

  /**
   * Event post'u beğen/beğeniyi kaldır
   */
  async toggleLike(postId: string, userId: string) {
    const existingLike = await this.prisma.eventPostLike.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });

    if (existingLike) {
      // Beğeniyi kaldır
      await this.prisma.$transaction([
        this.prisma.eventPostLike.delete({
          where: { id: existingLike.id },
        }),
        this.prisma.eventPost.update({
          where: { id: postId },
          data: { likesCount: { decrement: 1 } },
        }),
      ]);
      return { liked: false };
    } else {
      // Beğen
      await this.prisma.$transaction([
        this.prisma.eventPostLike.create({
          data: {
            postId,
            userId,
          },
        }),
        this.prisma.eventPost.update({
          where: { id: postId },
          data: { likesCount: { increment: 1 } },
        }),
      ]);
      return { liked: true };
    }
  }

  /**
   * Event post'a yorum ekle
   */
  async addComment(postId: string, userId: string, comment: string) {
    const post = await this.prisma.eventPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new Error('Post not found');
    }

    const [newComment] = await this.prisma.$transaction([
      this.prisma.eventPostComment.create({
        data: {
          id: generateUlid(),
          postId,
          userId,
          comment,
        },
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
      }),
      this.prisma.eventPost.update({
        where: { id: postId },
        data: { commentsCount: { increment: 1 } },
      }),
    ]);

    return {
      id: newComment.id,
      postId: newComment.postId,
      comment: newComment.comment,
      createdAt: newComment.createdAt.toISOString(),
      user: {
        id: newComment.user.id,
        name: newComment.user.profile?.displayName || newComment.user.email || 'Anonymous',
        avatar: resolveMediaUrl(newComment.user.avatars?.[0]?.imageUrl, true),
      },
    };
  }

  /**
   * Event post yorumlarını listele
   */
  async getPostComments(
    postId: string,
    options?: { cursor?: string; limit?: number }
  ) {
    const limit = options?.limit || 20;

    const comments = await this.prisma.eventPostComment.findMany({
      where: { postId },
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
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(options?.cursor && {
        cursor: { id: options.cursor },
        skip: 1,
      }),
    });

    const hasMore = comments.length > limit;
    const items = hasMore ? comments.slice(0, limit) : comments;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : undefined;

    return {
      items: items.map((comment) => ({
        id: comment.id,
        postId: comment.postId,
        comment: comment.comment,
        createdAt: comment.createdAt.toISOString(),
        user: {
          id: comment.user.id,
          name: comment.user.profile?.displayName || comment.user.email || 'Anonymous',
          avatar: resolveMediaUrl(comment.user.avatars?.[0]?.imageUrl, true),
        },
      })),
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    };
  }
}

