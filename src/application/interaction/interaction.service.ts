import { ContentLike } from '../../domain/interaction/content-like.entity';
import { ContentPost } from '../../domain/content/content-post.entity';
import { User } from '../../domain/user/user.entity';
import { ContentLikePrismaRepository } from '../../infrastructure/repositories/content-like-prisma.repository';
import { ContentPostPrismaRepository } from '../../infrastructure/repositories/content-post-prisma.repository';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import SocketManager from '../../infrastructure/realtime/socket-manager';
import logger from '../../infrastructure/logger/logger';

export class InteractionService {
  private contentLikeRepo = new ContentLikePrismaRepository();
  private contentPostRepo = new ContentPostPrismaRepository();
  private userRepo = new UserPrismaRepository();
  private prisma = getPrisma();

  constructor() {}

  /**
   * Bir gönderiyi beğen
   */
  async likePost(userId: number, postId: number): Promise<ContentLike> {
    try {
      const postIdStr = String(postId);
      const userIdStr = String(userId);
      
      // Gönderiyi kontrol et
      const post = await this.contentPostRepo.findById(postIdStr);
      if (!post) {
        throw new Error('Post not found');
      }

      // Kullanıcıyı kontrol et
      const user = await this.userRepo.findById(userIdStr);
      if (!user) {
        throw new Error('User not found');
      }

      // Zaten beğenilmiş mi kontrol et
      const existingLike = await this.contentLikeRepo.findByUserAndPost(userIdStr, postIdStr);
      if (existingLike) {
        throw new Error('Post already liked');
      }

      // Beğeniyi oluştur
      const like = await this.contentLikeRepo.create({
        userId: userIdStr,
        postId: postIdStr,
        createdAt: new Date(),
      });

      // Beğeni sayısını güncelle
      await this.contentPostRepo.incrementLikeCount(postIdStr);

      // Post sahibine bildirim gönder
      if (post.userId !== userIdStr) {
        const liker = await this.userRepo.findById(userIdStr);
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
  async unlikePost(userId: number, postId: number): Promise<void> {
    try {
      const postIdStr = String(postId);
      const userIdStr = String(userId);
      
      // Beğeniyi bul ve sil
      const like = await this.contentLikeRepo.findByUserAndPost(userIdStr, postIdStr);
      if (!like) {
        throw new Error('Like not found');
      }

      await this.contentLikeRepo.delete(like.id);

      // Beğeni sayısını güncelle
      await this.contentPostRepo.decrementLikeCount(postIdStr);

      logger.info(`User ${userId} unliked post ${postId}`);
    } catch (error) {
      logger.error(`Failed to unlike post ${postId} by user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Bir gönderiyi favorilere ekle
   */
  async favoritePost(userId: number, postId: number): Promise<void> {
    try {
      const userIdStr = String(userId);
      const postIdStr = String(postId);

      // Gönderiyi kontrol et
      const post = await this.contentPostRepo.findById(postIdStr);
      if (!post) {
        throw new Error('Post not found');
      }

      // Zaten favoride mi kontrol et
      const existingFavorite = await this.prisma.contentFavorite.findUnique({
        where: {
          userId_postId: {
            userId: userIdStr,
            postId: postIdStr
          }
        }
      });

      if (existingFavorite) {
        throw new Error('Post already favorited');
      }

      // Favoriye ekle
      await this.prisma.contentFavorite.create({
        data: {
          userId: userIdStr,
          postId: postIdStr
        }
      });

      // Favori sayısını güncelle
      await this.contentPostRepo.incrementFavoriteCount(postIdStr);
      
      // Post sahibine bildirim gönder
      if (post.userId !== userIdStr) {
        const user = await this.userRepo.findById(userIdStr);
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
  async unfavoritePost(userId: number, postId: number): Promise<void> {
    try {
      const userIdStr = String(userId);
      const postIdStr = String(postId);

      // Favoriyi bul ve sil
      const favorite = await this.prisma.contentFavorite.findUnique({
        where: {
          userId_postId: {
            userId: userIdStr,
            postId: postIdStr
          }
        }
      });

      if (!favorite) {
        throw new Error('Favorite not found');
      }

      await this.prisma.contentFavorite.delete({
        where: {
          userId_postId: {
            userId: userIdStr,
            postId: postIdStr
          }
        }
      });

      // Favori sayısını güncelle
      await this.contentPostRepo.decrementFavoriteCount(postIdStr);

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
}
