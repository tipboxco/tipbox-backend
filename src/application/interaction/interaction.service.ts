import { ContentLike } from '../../domain/interaction/content-like.entity';
import { ContentComment } from '../../domain/interaction/content-comment.entity';
import { ContentShare } from '../../domain/interaction/content-share.entity';
import { ContentPost } from '../../domain/content/content-post.entity';
import { User } from '../../domain/user/user.entity';
import { ShareType } from '../../domain/interaction/share-type.enum';
import { ContentLikePrismaRepository } from '../../infrastructure/repositories/content-like-prisma.repository';
import { ContentPostPrismaRepository } from '../../infrastructure/repositories/content-post-prisma.repository';
import { ContentCommentPrismaRepository } from '../../infrastructure/repositories/content-comment-prisma.repository';
import { ContentSharePrismaRepository } from '../../infrastructure/repositories/content-share-prisma.repository';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import SocketManager from '../../infrastructure/realtime/socket-manager';
import logger from '../../infrastructure/logger/logger';

export class InteractionService {
  private contentLikeRepo = new ContentLikePrismaRepository();
  private contentPostRepo = new ContentPostPrismaRepository();
  private commentRepo = new ContentCommentPrismaRepository();
  private shareRepo = new ContentSharePrismaRepository();
  private userRepo = new UserPrismaRepository();
  private prisma = getPrisma();

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

      // Post sahibine bildirim gönder
      if (post.userId !== userId) {
        const liker = await this.userRepo.findById(userId);
        if (liker) {
          SocketManager.getInstance().getSocketHandler().sendMessageToUser(
            post.userId,
            'new_notification',
            {
              type: 'post_liked',
              message: `${liker.name || liker.email} gönderinizi beğendi.`,
              postId: post.id,
              likerId: liker.id,
              likerName: liker.name || liker.email,
              timestamp: new Date().toISOString(),
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

      logger.info(`User ${userId} unliked post ${postId}`);
    } catch (error) {
      logger.error(`Failed to unlike post ${postId} by user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Bir gönderiyi favorilere ekle
   */
  async favoritePost(userId: string, postId: string): Promise<void> {
    try {
      // Gönderiyi kontrol et
      const post = await this.contentPostRepo.findById(postId);
      if (!post) {
        throw new Error('Post not found');
      }

      // Zaten favoride mi kontrol et
      const existingFavorite = await this.prisma.contentFavorite.findUnique({
        where: {
          userId_postId: {
            userId: userId,
            postId: postId
          }
        }
      });

      if (existingFavorite) {
        throw new Error('Post already favorited');
      }

      // Favoriye ekle
      await this.prisma.contentFavorite.create({
        data: {
          userId: userId,
          postId: postId
        }
      });

      // Favori sayısını güncelle
      await this.contentPostRepo.incrementFavoriteCount(postId);
      
      // Post sahibine bildirim gönder
      if (post.userId !== userId) {
        const user = await this.userRepo.findById(userId);
        if (user) {
          SocketManager.getInstance().getSocketHandler().sendMessageToUser(
            post.userId,
            'new_notification',
            {
              type: 'post_favorited',
              message: `${user.name || user.email} gönderinizi favorilere ekledi.`,
              postId: post.id,
              userId: user.id,
              userName: user.name || user.email,
              timestamp: new Date().toISOString(),
            }
          );
        }
      }

      logger.info(`User ${userId} favorited post ${postId}`);
    } catch (error) {
      logger.error(`Failed to favorite post ${postId} by user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Bir gönderiyi favorilerden çıkar
   */
  async unfavoritePost(userId: string, postId: string): Promise<void> {
    try {
      // Favoriyi bul ve sil
      const favorite = await this.prisma.contentFavorite.findUnique({
        where: {
          userId_postId: {
            userId: userId,
            postId: postId
          }
        }
      });

      if (!favorite) {
        throw new Error('Favorite not found');
      }

      await this.prisma.contentFavorite.delete({
        where: {
          userId_postId: {
            userId: userId,
            postId: postId
          }
        }
      });

      // Favori sayısını güncelle
      await this.contentPostRepo.decrementFavoriteCount(postId);

      logger.info(`User ${userId} unfavorited post ${postId}`);
    } catch (error) {
      logger.error(`Failed to unfavorite post ${postId} by user ${userId}:`, error);
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
          SocketManager.getInstance().getSocketHandler().sendMessageToUser(
            post.userId,
            'new_notification',
            {
              type: 'post_commented',
              message: `${commenter.name || commenter.email} gönderinize yorum yaptı.`,
              postId: post.id,
              commentId: comment.id,
              commenterId: commenter.id,
              commenterName: commenter.name || commenter.email,
              timestamp: new Date().toISOString(),
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
            SocketManager.getInstance().getSocketHandler().sendMessageToUser(
              parentComment.userId,
              'new_notification',
              {
                type: 'comment_replied',
                message: `${replier.name || replier.email} yorumunuza yanıt verdi.`,
                postId: post.id,
                commentId: comment.id,
                parentCommentId: parentId,
                replierId: replier.id,
                replierName: replier.name || replier.email,
                timestamp: new Date().toISOString(),
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
          SocketManager.getInstance().getSocketHandler().sendMessageToUser(
            comment.userId,
            'new_notification',
            {
              type: 'comment_liked',
              message: `${liker.name || liker.email} yorumunuzu beğendi.`,
              commentId: comment.id,
              postId: comment.postId,
              likerId: liker.id,
              likerName: liker.name || liker.email,
              timestamp: new Date().toISOString(),
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
          SocketManager.getInstance().getSocketHandler().sendMessageToUser(
            post.userId,
            'new_notification',
            {
              type: 'post_shared',
              message: `${sharer.name || sharer.email} gönderinizi paylaştı.`,
              postId: post.id,
              sharerId: sharer.id,
              sharerName: sharer.name || sharer.email,
              shareType,
              timestamp: new Date().toISOString(),
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
        this.prisma.contentFavorite.findUnique({
          where: { userId_postId: { userId, postId } },
        }),
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
