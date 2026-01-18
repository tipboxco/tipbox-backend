import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { generateIdForModel } from '../../infrastructure/ids/id.strategy';
import { ShareType } from '../../domain/interaction/share-type.enum';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import logger from '../../infrastructure/logger/logger';
import { NotFoundError } from '../../infrastructure/errors/custom-errors';

export interface NewsDetail {
  id: string;
  title: string;
  content: string;
  source: string;
  date: string;
  image: string | null;
  author: string | null;
  tags: string[];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  favoritesCount: number;
  viewsCount: number;
}

export interface NewsCommentResponse {
  id: string;
  userId: string;
  userName: string | null;
  userAvatar: string | null;
  comment: string;
  likesCount: number;
  createdAt: string;
  replies?: NewsCommentResponse[];
}

export class NewsService {
  private prisma = getPrisma();

  /**
   * News detayını getir
   */
  async getNewsById(newsId: string, userId?: string): Promise<NewsDetail | null> {
    try {
      const news = await this.prisma.news.findUnique({
        where: { id: newsId },
        include: {
          brand: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!news) {
        return null;
      }

      // View count'u artır (userId varsa)
      if (userId) {
        await this.prisma.news.update({
          where: { id: newsId },
          data: {
            viewsCount: {
              increment: 1,
            },
          },
        });
      }

      return {
        id: news.id,
        title: news.title,
        content: news.content,
        source: news.source,
        date: news.createdAt.toISOString(),
        image: resolveMediaUrl(news.bannerImageUrl),
        author: news.author,
        tags: news.tags,
        likesCount: news.likesCount,
        commentsCount: news.commentsCount,
        sharesCount: news.sharesCount,
        favoritesCount: news.favoritesCount,
        viewsCount: news.viewsCount + (userId ? 1 : 0),
      };
    } catch (error) {
      logger.error(`Failed to get news ${newsId}:`, error);
      throw error;
    }
  }

  /**
   * News'i beğen
   */
  async likeNews(userId: string, newsId: string): Promise<void> {
    try {
      // News kontrolü
      const news = await this.prisma.news.findUnique({
        where: { id: newsId },
      });

      if (!news) {
        throw new NotFoundError('News not found');
      }

      // Zaten beğenilmiş mi kontrol et
      const existingLike = await this.prisma.newsLike.findUnique({
        where: {
          userId_newsId: {
            userId,
            newsId,
          },
        },
      });

      if (existingLike) {
        throw new Error('News already liked');
      }

      // Beğeniyi oluştur ve count'u artır
      await this.prisma.$transaction([
        this.prisma.newsLike.create({
          data: {
            userId,
            newsId,
          },
        }),
        this.prisma.news.update({
          where: { id: newsId },
          data: {
            likesCount: {
              increment: 1,
            },
          },
        }),
      ]);
    } catch (error) {
      logger.error(`Failed to like news ${newsId}:`, error);
      throw error;
    }
  }

  /**
   * News beğenisini geri al
   */
  async unlikeNews(userId: string, newsId: string): Promise<void> {
    try {
      const existingLike = await this.prisma.newsLike.findUnique({
        where: {
          userId_newsId: {
            userId,
            newsId,
          },
        },
      });

      if (!existingLike) {
        throw new Error('News not liked');
      }

      // Beğeniyi sil ve count'u azalt
      await this.prisma.$transaction([
        this.prisma.newsLike.delete({
          where: {
            id: existingLike.id,
          },
        }),
        this.prisma.news.update({
          where: { id: newsId },
          data: {
            likesCount: {
              decrement: 1,
            },
          },
        }),
      ]);
    } catch (error) {
      logger.error(`Failed to unlike news ${newsId}:`, error);
      throw error;
    }
  }

  /**
   * News'e yorum ekle
   */
  async addComment(
    userId: string,
    newsId: string,
    comment: string,
    parentId?: string
  ): Promise<NewsCommentResponse> {
    try {
      // News kontrolü
      const news = await this.prisma.news.findUnique({
        where: { id: newsId },
      });

      if (!news) {
        throw new NotFoundError('News not found');
      }

      // Parent comment kontrolü (eğer reply ise)
      if (parentId) {
        const parentComment = await this.prisma.newsComment.findUnique({
          where: { id: parentId },
        });

        if (!parentComment || parentComment.newsId !== newsId) {
          throw new NotFoundError('Parent comment not found');
        }
      }

      const commentId = generateIdForModel('NewsComment');

      // Yorumu oluştur ve count'u artır
      const [createdComment] = await this.prisma.$transaction([
        this.prisma.newsComment.create({
          data: {
            id: commentId,
            userId,
            newsId,
            parentId: parentId || null,
            comment,
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
        }),
        this.prisma.news.update({
          where: { id: newsId },
          data: {
            commentsCount: {
              increment: 1,
            },
          },
        }),
      ]);

      return {
        id: createdComment.id,
        userId: createdComment.userId,
        userName: createdComment.user.profile?.userName || createdComment.user.profile?.displayName || null,
        userAvatar: resolveMediaUrl(createdComment.user.avatars?.[0]?.imageUrl || null),
        comment: createdComment.comment,
        likesCount: createdComment.likesCount,
        createdAt: createdComment.createdAt.toISOString(),
      };
    } catch (error) {
      logger.error(`Failed to add comment to news ${newsId}:`, error);
      throw error;
    }
  }

  /**
   * News yorumlarını listele
   */
  async getComments(newsId: string, limit: number = 50, offset: number = 0): Promise<{
    items: NewsCommentResponse[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const [comments, total] = await Promise.all([
        this.prisma.newsComment.findMany({
          where: {
            newsId,
            parentId: null, // Sadece top-level comments
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
            replies: {
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
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit + 1,
          skip: offset,
        }),
        this.prisma.newsComment.count({
          where: {
            newsId,
            parentId: null,
          },
        }),
      ]);

      const hasMore = comments.length > limit;
      const resultComments = hasMore ? comments.slice(0, limit) : comments;

      const items: NewsCommentResponse[] = resultComments.map((comment) => ({
        id: comment.id,
        userId: comment.userId,
        userName: comment.user.profile?.userName || comment.user.profile?.displayName || null,
        userAvatar: resolveMediaUrl(comment.user.avatars?.[0]?.imageUrl || null),
        comment: comment.comment,
        likesCount: comment.likesCount,
        createdAt: comment.createdAt.toISOString(),
        replies: comment.replies.map((reply) => ({
          id: reply.id,
          userId: reply.userId,
          userName: reply.user.profile?.userName || reply.user.profile?.displayName || null,
          userAvatar: resolveMediaUrl(reply.user.avatars?.[0]?.imageUrl || null),
          comment: reply.comment,
          likesCount: reply.likesCount,
          createdAt: reply.createdAt.toISOString(),
        })),
      }));

      return {
        items,
        total,
        hasMore,
      };
    } catch (error) {
      logger.error(`Failed to get comments for news ${newsId}:`, error);
      throw error;
    }
  }

  /**
   * News yorumunu beğen
   */
  async likeComment(userId: string, commentId: string): Promise<void> {
    try {
      // Comment kontrolü
      const comment = await this.prisma.newsComment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        throw new NotFoundError('Comment not found');
      }

      // Zaten beğenilmiş mi kontrol et
      const existingLike = await this.prisma.newsCommentLike.findUnique({
        where: {
          userId_commentId: {
            userId,
            commentId,
          },
        },
      });

      if (existingLike) {
        throw new Error('Comment already liked');
      }

      // Beğeniyi oluştur ve count'u artır
      await this.prisma.$transaction([
        this.prisma.newsCommentLike.create({
          data: {
            userId,
            commentId,
          },
        }),
        this.prisma.newsComment.update({
          where: { id: commentId },
          data: {
            likesCount: {
              increment: 1,
            },
          },
        }),
      ]);
    } catch (error) {
      logger.error(`Failed to like comment ${commentId}:`, error);
      throw error;
    }
  }

  /**
   * News yorum beğenisini geri al
   */
  async unlikeComment(userId: string, commentId: string): Promise<void> {
    try {
      const existingLike = await this.prisma.newsCommentLike.findUnique({
        where: {
          userId_commentId: {
            userId,
            commentId,
          },
        },
      });

      if (!existingLike) {
        throw new Error('Comment not liked');
      }

      // Beğeniyi sil ve count'u azalt
      await this.prisma.$transaction([
        this.prisma.newsCommentLike.delete({
          where: {
            id: existingLike.id,
          },
        }),
        this.prisma.newsComment.update({
          where: { id: commentId },
          data: {
            likesCount: {
              decrement: 1,
            },
          },
        }),
      ]);
    } catch (error) {
      logger.error(`Failed to unlike comment ${commentId}:`, error);
      throw error;
    }
  }

  /**
   * News'i paylaş
   */
  async shareNews(
    userId: string,
    newsId: string,
    shareType: ShareType,
    platform?: string
  ): Promise<void> {
    try {
      // News kontrolü
      const news = await this.prisma.news.findUnique({
        where: { id: newsId },
      });

      if (!news) {
        throw new NotFoundError('News not found');
      }

      // Zaten paylaşılmış mı kontrol et
      const existingShare = await this.prisma.newsShare.findUnique({
        where: {
          userId_newsId: {
            userId,
            newsId,
          },
        },
      });

      if (existingShare) {
        throw new Error('News already shared');
      }

      // Paylaşımı oluştur ve count'u artır
      await this.prisma.$transaction([
        this.prisma.newsShare.create({
          data: {
            userId,
            newsId,
            shareType,
            platform: platform || null,
          },
        }),
        this.prisma.news.update({
          where: { id: newsId },
          data: {
            sharesCount: {
              increment: 1,
            },
          },
        }),
      ]);
    } catch (error) {
      logger.error(`Failed to share news ${newsId}:`, error);
      throw error;
    }
  }

  /**
   * News'i favorilere ekle (bookmark)
   */
  async favoriteNews(userId: string, newsId: string): Promise<void> {
    try {
      // News kontrolü
      const news = await this.prisma.news.findUnique({
        where: { id: newsId },
      });

      if (!news) {
        throw new NotFoundError('News not found');
      }

      // Zaten favorilere eklenmiş mi kontrol et
      const existingFavorite = await this.prisma.newsFavorite.findUnique({
        where: {
          userId_newsId: {
            userId,
            newsId,
          },
        },
      });

      if (existingFavorite) {
        throw new Error('News already favorited');
      }

      // Favoriyi oluştur ve count'u artır
      await this.prisma.$transaction([
        this.prisma.newsFavorite.create({
          data: {
            userId,
            newsId,
          },
        }),
        this.prisma.news.update({
          where: { id: newsId },
          data: {
            favoritesCount: {
              increment: 1,
            },
          },
        }),
      ]);
    } catch (error) {
      logger.error(`Failed to favorite news ${newsId}:`, error);
      throw error;
    }
  }

  /**
   * News'i favorilerden çıkar
   */
  async unfavoriteNews(userId: string, newsId: string): Promise<void> {
    try {
      const existingFavorite = await this.prisma.newsFavorite.findUnique({
        where: {
          userId_newsId: {
            userId,
            newsId,
          },
        },
      });

      if (!existingFavorite) {
        throw new Error('News not favorited');
      }

      // Favoriyi sil ve count'u azalt
      await this.prisma.$transaction([
        this.prisma.newsFavorite.delete({
          where: {
            id: existingFavorite.id,
          },
        }),
        this.prisma.news.update({
          where: { id: newsId },
          data: {
            favoritesCount: {
              decrement: 1,
            },
          },
        }),
      ]);
    } catch (error) {
      logger.error(`Failed to unfavorite news ${newsId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcının news ile etkileşim durumunu getir
   */
  async getUserInteractionStatus(userId: string, newsId: string): Promise<{
    liked: boolean;
    favorited: boolean;
    shared: boolean;
  }> {
    try {
      const [like, favorite, share] = await Promise.all([
        this.prisma.newsLike.findUnique({
          where: {
            userId_newsId: {
              userId,
              newsId,
            },
          },
        }),
        this.prisma.newsFavorite.findUnique({
          where: {
            userId_newsId: {
              userId,
              newsId,
            },
          },
        }),
        this.prisma.newsShare.findUnique({
          where: {
            userId_newsId: {
              userId,
              newsId,
            },
          },
        }),
      ]);

      return {
        liked: !!like,
        favorited: !!favorite,
        shared: !!share,
      };
    } catch (error) {
      logger.error(`Failed to get interaction status for news ${newsId}:`, error);
      throw error;
    }
  }
}
