import { ContentLike } from '../../domain/interaction/content-like.entity';
import { ContentComment } from '../../domain/interaction/content-comment.entity';
import { ContentShare } from '../../domain/interaction/content-share.entity';
import { ContentFavorite } from '../../domain/interaction/content-favorite.entity';
import { ContentPost } from '../../domain/content/content-post.entity';
import { User } from '../../domain/user/user.entity';
import { ShareType } from '../../domain/interaction/share-type.enum';
import { ContentLikePrismaRepository } from '../../infrastructure/repositories/content-like-prisma.repository';
import { ContentPostPrismaRepository } from '../../infrastructure/repositories/content-post-prisma.repository';
import { ContentCommentPrismaRepository } from '../../infrastructure/repositories/content-comment-prisma.repository';
import { ContentSharePrismaRepository } from '../../infrastructure/repositories/content-share-prisma.repository';
import { ContentFavoritePrismaRepository } from '../../infrastructure/repositories/content-favorite-prisma.repository';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import { EventMetricsService } from '../event/event-metrics.service';
import { BadgeEligibilityService } from '../gamification/badge-eligibility.service';
import { AchievementProgressService } from '../gamification/achievement-progress.service';
import { AchievementGoalType } from '../../domain/gamification/achievement-goal-type.enum';
import logger from '../../infrastructure/logger/logger';

export class InteractionService {
  private contentLikeRepo = new ContentLikePrismaRepository();
  private contentPostRepo = new ContentPostPrismaRepository();
  private commentRepo = new ContentCommentPrismaRepository();
  private shareRepo = new ContentSharePrismaRepository();
  private favoriteRepo = new ContentFavoritePrismaRepository();
  private userRepo = new UserPrismaRepository();
  private prisma = getPrisma();
  private notificationService = new NotificationService();
  private eventMetricsService = new EventMetricsService();
  private badgeEligibilityService = new BadgeEligibilityService();
  private achievementProgressService = new AchievementProgressService();

  constructor() {}

  /**
   * Bir gönderiyi beğen
   */
  async likePost(userId: string, postId: string): Promise<ContentLike> {
    try {
      // Gönderiyi kontrol et
      const post = await this.contentPostRepo.findById(postId);
      if (!post) {
        throw new Error('Post not found');
      }

      // Kullanıcıyı kontrol et
      const user = await this.userRepo.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Zaten beğenilmiş mi kontrol et
      const existingLike = await this.contentLikeRepo.findByUserAndPost(userId, postId);
      if (existingLike) {
        throw new Error('Post already liked');
      }

      // Beğeniyi oluştur
      const like = await this.contentLikeRepo.create({
        userId: userId,
        postId: postId,
        createdAt: new Date(),
      });

      // Beğeni sayısını güncelle
      await this.contentPostRepo.incrementLikeCount(postId);

      // Event varsa post sahibinin metriğini güncelle
      const postWithEventId = await this.prisma.contentPost.findUnique({
        where: { id: postId },
        select: { eventId: true, userId: true },
      });

      // Achievement Ladder progress (event dışı) - async
      this.achievementProgressService
        .incrementProgress(userId, AchievementGoalType.LIKE_GIVEN, 1)
        .catch((err) => {
          logger.warn({
            message: 'Failed to increment achievement progress for like given',
            userId,
            postId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      if (postWithEventId?.userId) {
        this.achievementProgressService
          .incrementProgress(
            String(postWithEventId.userId),
            AchievementGoalType.LIKE_RECEIVED,
            1
          )
          .catch((err) => {
            logger.warn({
              message: 'Failed to increment achievement progress for like received',
              userId: String(postWithEventId.userId),
              postId,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      }

      if (postWithEventId?.eventId) {
        // Async olarak event metrik ve badge kontrolü yap (hata olsa bile devam et)
        this.eventMetricsService.incrementUserLikesReceived(postWithEventId.userId, postWithEventId.eventId)
          .then((metrics) => {
            return this.badgeEligibilityService.checkAndGrantEventBadges(
              postWithEventId.userId,
              postWithEventId.eventId!,
              metrics
            );
          })
          .catch((err) => {
            logger.warn({
              message: 'Failed to update event metrics or check badges for like',
              userId: postWithEventId.userId,
              eventId: postWithEventId.eventId,
              error: err,
            });
          });
      }

      // Post sahibine bildirim gönder
      if (post.userId !== userId) {
        const liker = await this.userRepo.findById(userId);
        if (liker) {
          await this.notificationService.sendNotification(
            post.userId,
            NotificationType.POST_LIKED,
            {
              likerName: liker.name || liker.email,
              likerId: liker.id,
              postId: post.id,
            }
          );
        }
      }

      logger.info(`User ${userId} liked post ${postId}`);
      return like;
    } catch (error) {
      logger.error(`Failed to like post ${postId} by user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Bir gönderinin beğenisini geri al
   */
  async unlikePost(userId: string, postId: string): Promise<void> {
    try {
      // Beğeniyi bul ve sil
      const like = await this.contentLikeRepo.findByUserAndPost(userId, postId);
      if (!like) {
        throw new Error('Like not found');
      }

      await this.contentLikeRepo.delete(like.id);

      // Beğeni sayısını güncelle
      await this.contentPostRepo.decrementLikeCount(postId);

      // Event varsa post sahibinin metriğini azalt (badge geri alınmaz)
      const postWithEventId = await this.prisma.contentPost.findUnique({
        where: { id: postId },
        select: { eventId: true, userId: true },
      });

      if (postWithEventId?.eventId) {
        // Async olarak event metriği azalt (hata olsa bile devam et)
        this.eventMetricsService.decrementUserLikesReceived(postWithEventId.userId, postWithEventId.eventId)
          .catch((err) => {
            logger.warn({
              message: 'Failed to decrement event metrics for unlike',
              userId: postWithEventId.userId,
              eventId: postWithEventId.eventId,
              error: err,
            });
          });
      }

      logger.info(`User ${userId} unliked post ${postId}`);
    } catch (error) {
      logger.error(`Failed to unlike post ${postId} by user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Bir gönderiyi favorilere ekle (bookmark)
   */
  async favoritePost(userId: string, postId: string): Promise<ContentFavorite> {
    try {
      // Gönderiyi kontrol et
      const post = await this.contentPostRepo.findById(postId);
      if (!post) {
        throw new Error('Post not found');
      }

      // Zaten favoride mi kontrol et
      const existingFavorite = await this.favoriteRepo.findByUserAndPost(userId, postId);
      if (existingFavorite) {
        throw new Error('Post already favorited');
      }

      // Favoriye ekle
      const favorite = await this.favoriteRepo.create({
        userId,
        postId,
      });

      // Favori sayısını güncelle
      await this.contentPostRepo.incrementFavoriteCount(postId);
      
      // Post sahibine bildirim gönder
      if (post.userId !== userId) {
        const user = await this.userRepo.findById(userId);
        if (user) {
          await this.notificationService.sendNotification(
            post.userId,
            NotificationType.POST_FAVORITED,
            {
              userName: user.name || user.email,
              userId: user.id,
              postId: post.id,
            }
          );
        }
      }

      logger.info(`User ${userId} favorited post ${postId}`);
      return favorite;
    } catch (error) {
      logger.error(`Failed to favorite post ${postId} by user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Bir gönderiyi favorilerden çıkar (unbookmark)
   */
  async unfavoritePost(userId: string, postId: string): Promise<void> {
    try {
      // Favoriyi bul ve sil
      const favorite = await this.favoriteRepo.findByUserAndPost(userId, postId);
      if (!favorite) {
        throw new Error('Favorite not found');
      }

      await this.favoriteRepo.delete(userId, postId);

      // Favori sayısını güncelle
      await this.contentPostRepo.decrementFavoriteCount(postId);

      logger.info(`User ${userId} unfavorited post ${postId}`);
    } catch (error) {
      logger.error(`Failed to unfavorite post ${postId} by user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcının favorilerini getir
   */
  async getUserFavorites(userId: string, limit = 50): Promise<ContentFavorite[]> {
    try {
      return await this.favoriteRepo.findByUserId(userId, limit);
    } catch (error) {
      logger.error(`Failed to get favorites for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Bir gönderiyi görüntüle
   */
  async viewPost(userId: number, postId: number): Promise<void> {
    try {
      const postIdStr = String(postId);
      
      // Gönderiyi kontrol et
      const post = await this.contentPostRepo.findById(postIdStr);
      if (!post) {
        throw new Error('Post not found');
      }

      // Görüntüleme kaydı oluştur (ContentPostView entity'si gerekli)
      // Bu kısım ContentPostView repository'si oluşturulduktan sonra implement edilecek

      // Görüntüleme sayısını güncelle
      await this.contentPostRepo.incrementViewCount(postIdStr);

      logger.info(`User ${userId} viewed post ${postId}`);
    } catch (error) {
      logger.error(`Failed to view post ${postId} by user ${userId}:`, error);
      throw error;
    }
  }

  // ========== COMMENT METHODS ==========

  /**
   * Post'a yorum yap
   */
  async createComment(
    userId: string,
    postId: string,
    commentText: string,
    parentId?: string
  ): Promise<ContentComment> {
    try {
      // Post kontrolü
      const post = await this.contentPostRepo.findById(postId);
      if (!post) {
        throw new Error('Post not found');
      }

      // Parent comment kontrolü (reply ise)
      if (parentId) {
        const parentComment = await this.commentRepo.findById(parentId);
        if (!parentComment) {
          throw new Error('Parent comment not found');
        }
      }

      // Yorum oluştur
      const comment = await this.commentRepo.create({
        postId,
        userId,
        comment: commentText,
        parentId,
      });

      // Post'un comment count'unu artır
      await this.contentPostRepo.incrementCommentCount(postId);

      // Post sahibine bildirim (kendi yorumu değilse)
      if (post.userId !== userId && !parentId) {
        const commenter = await this.userRepo.findById(userId);
        if (commenter) {
          await this.notificationService.sendNotification(
            post.userId,
            NotificationType.POST_COMMENTED,
            {
              commenterName: commenter.name || commenter.email,
              commenterId: commenter.id,
              postId: post.id,
              commentId: comment.id,
            }
          );
        }
      }

      // Parent comment sahibine bildirim (reply ise)
      if (parentId) {
        const parentComment = await this.commentRepo.findById(parentId);
        if (parentComment && parentComment.userId !== userId) {
          const replier = await this.userRepo.findById(userId);
          if (replier) {
            await this.notificationService.sendNotification(
              parentComment.userId,
              NotificationType.COMMENT_REPLIED,
              {
                replierName: replier.name || replier.email,
                replierId: replier.id,
                postId: post.id,
                commentId: comment.id,
                parentCommentId: parentId,
              }
            );
          }
        }
      }

      logger.info(`User ${userId} commented on post ${postId}`);
      return comment;
    } catch (error) {
      logger.error(`Failed to create comment on post ${postId}:`, error);
      throw error;
    }
  }

  /**
   * Yorumu güncelle
   */
  async updateComment(userId: string, commentId: string, newComment: string): Promise<void> {
    try {
      const comment = await this.commentRepo.findById(commentId);
      if (!comment) {
        throw new Error('Comment not found');
      }

      // Yetki kontrolü (sadece kendi yorumunu güncelleyebilir)
      if (comment.userId !== userId) {
        throw new Error('Unauthorized to update this comment');
      }

      // Zaman kontrolü (15 dakika içinde güncellenebilir)
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      if (comment.createdAt < fifteenMinutesAgo) {
        throw new Error('Comment can only be updated within 15 minutes of creation');
      }

      // Comment'i güncelle (Prisma ile direkt)
      await this.prisma.contentComment.update({
        where: { id: commentId },
        data: { comment: newComment },
      });

      // Cache invalidation
      try {
        const { CacheService } = await import('../../infrastructure/cache/cache.service');
        const cacheService = CacheService.getInstance();
        await cacheService.delPattern(`post:${comment.postId}:*`).catch(() => {});
        await cacheService.delPattern('feed:*').catch(() => {});
      } catch (error) {
        logger.warn({
          message: 'Failed to invalidate cache',
          commentId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      logger.info(`User ${userId} updated comment ${commentId}`);
    } catch (error) {
      logger.error(`Failed to update comment ${commentId}:`, error);
      throw error;
    }
  }

  /**
   * Yorumu sil
   */
  async deleteComment(userId: string, commentId: string): Promise<void> {
    try {
      const comment = await this.commentRepo.findById(commentId);
      if (!comment) {
        throw new Error('Comment not found');
      }

      // Yetki kontrolü (sadece kendi yorumunu silebilir)
      if (comment.userId !== userId) {
        throw new Error('Unauthorized to delete this comment');
      }

      await this.commentRepo.delete(commentId);

      // Post'un comment count'unu azalt
      await this.contentPostRepo.decrementCommentCount(comment.postId);

      logger.info(`User ${userId} deleted comment ${commentId}`);
    } catch (error) {
      logger.error(`Failed to delete comment ${commentId}:`, error);
      throw error;
    }
  }

  /**
   * Post'un yorumlarını getir
   */
  async getPostComments(postId: string, limit = 50): Promise<{
    comments: Array<{
      comment: ContentComment;
      replies: ContentComment[];
      user: {
        id: string;
        name: string | null;
        avatar: string | null;
      };
    }>;
  }> {
    try {
      const comments = await this.commentRepo.findByPostId(postId, limit);

      const commentsWithData = await Promise.all(
        comments.map(async (comment) => {
          const [user, replies] = await Promise.all([
            this.userRepo.findById(comment.userId),
            this.commentRepo.findRepliesByParentId(comment.id),
          ]);

          return {
            comment,
            replies,
            user: {
              id: user?.id || '',
              name: user?.name || null,
              avatar: null, // Avatar sistemi varsa ekle
            },
          };
        })
      );

      return { comments: commentsWithData };
    } catch (error) {
      logger.error(`Failed to get comments for post ${postId}:`, error);
      throw error;
    }
  }

  /**
   * Yorumu beğen
   */
  async likeComment(userId: string, commentId: string): Promise<void> {
    try {
      const comment = await this.commentRepo.findById(commentId);
      if (!comment) {
        throw new Error('Comment not found');
      }

      // Zaten beğenilmiş mi?
      const existingLike = await this.prisma.contentLike.findUnique({
        where: {
          userId_commentId: { userId, commentId },
        },
      });

      if (existingLike) {
        throw new Error('Comment already liked');
      }

      // Like oluştur
      await this.prisma.contentLike.create({
        data: { userId, commentId },
      });

      // Comment like count artır
      await this.commentRepo.incrementLikeCount(commentId);

      // Comment sahibine bildirim (kendi yorumu değilse)
      if (comment.userId !== userId) {
        const liker = await this.userRepo.findById(userId);
        if (liker) {
          await this.notificationService.sendNotification(
            comment.userId,
            NotificationType.COMMENT_LIKED,
            {
              likerName: liker.name || liker.email,
              likerId: liker.id,
              commentId: comment.id,
              postId: comment.postId,
            }
          );
        }
      }

      logger.info(`User ${userId} liked comment ${commentId}`);
    } catch (error) {
      logger.error(`Failed to like comment ${commentId}:`, error);
      throw error;
    }
  }

  /**
   * Yorumun beğenisini geri al
   */
  async unlikeComment(userId: string, commentId: string): Promise<void> {
    try {
      await this.prisma.contentLike.delete({
        where: {
          userId_commentId: { userId, commentId },
        },
      });

      await this.commentRepo.decrementLikeCount(commentId);

      logger.info(`User ${userId} unliked comment ${commentId}`);
    } catch (error) {
      logger.error(`Failed to unlike comment ${commentId}:`, error);
      throw error;
    }
  }

  // ========== SHARE METHODS ==========

  /**
   * Post'u paylaş
   */
  async sharePost(
    userId: string,
    postId: string,
    shareType: ShareType,
    platform?: string
  ): Promise<ContentShare> {
    try {
      const post = await this.contentPostRepo.findById(postId);
      if (!post) {
        throw new Error('Post not found');
      }

      // Zaten paylaşılmış mı kontrol et
      const existingShare = await this.shareRepo.findByUserAndPost(userId, postId);
      if (existingShare) {
        throw new Error('Post already shared');
      }

      // Share oluştur
      const share = await this.shareRepo.create({
        userId,
        postId,
        shareType,
        platform,
      });

      // Post share count artır
      await this.contentPostRepo.incrementShareCount(postId);

      // Post sahibine bildirim (kendi paylaşımı değilse)
      if (post.userId !== userId) {
        const sharer = await this.userRepo.findById(userId);
        if (sharer) {
          await this.notificationService.sendNotification(
            post.userId,
            NotificationType.POST_SHARED,
            {
              sharerName: sharer.name || sharer.email,
              sharerId: sharer.id,
              postId: post.id,
              shareType,
            }
          );
        }
      }

      logger.info(`User ${userId} shared post ${postId} (${shareType})`);
      return share;
    } catch (error) {
      logger.error(`Failed to share post ${postId}:`, error);
      throw error;
    }
  }

  /**
   * Kullanıcının post ile etkileşim durumu
   */
  async getUserInteractionStatus(userId: string, postId: string): Promise<{
    liked: boolean;
    favorited: boolean;
    shared: boolean;
  }> {
    try {
      const [like, favorite, share] = await Promise.all([
        this.contentLikeRepo.findByUserAndPost(userId, postId),
        this.favoriteRepo.findByUserAndPost(userId, postId),
        this.shareRepo.findByUserAndPost(userId, postId),
      ]);

      return {
        liked: !!like,
        favorited: !!favorite,
        shared: !!share,
      };
    } catch (error) {
      logger.error(`Failed to get interaction status for post ${postId}:`, error);
      throw error;
    }
  }
}
