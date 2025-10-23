import { ContentLike } from '../../domain/interaction/content-like.entity';
import { ContentPost } from '../../domain/content/content-post.entity';
import { User } from '../../domain/user/user.entity';
import { ContentLikePrismaRepository } from '../../infrastructure/repositories/content-like-prisma.repository';
import { ContentPostPrismaRepository } from '../../infrastructure/repositories/content-post-prisma.repository';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import SocketManager from '../../infrastructure/realtime/socket-manager';
import logger from '../../infrastructure/logger/logger';

export class InteractionService {
  private contentLikeRepo = new ContentLikePrismaRepository();
  private contentPostRepo = new ContentPostPrismaRepository();
  private userRepo = new UserPrismaRepository();

  constructor() {}

  /**
   * Bir gönderiyi beğen
   */
  async likePost(userId: number, postId: number): Promise<ContentLike> {
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
        userId,
        postId,
        createdAt: new Date(),
      });

      // Beğeni sayısını güncelle
      await this.contentPostRepo.incrementLikeCount(postId);

      // Post sahibine bildirim gönder
      if (post.userId !== userId) {
        const liker = await this.userRepo.findById(userId);
        if (liker) {
          SocketManager.getInstance().getSocketHandler().sendMessageToUser(
            post.userId.toString(),
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
  async favoritePost(userId: number, postId: number): Promise<void> {
    try {
      // Gönderiyi kontrol et
      const post = await this.contentPostRepo.findById(postId);
      if (!post) {
        throw new Error('Post not found');
      }

      // Favoriye ekle (ContentFavorite entity'si gerekli)
      // Bu kısım ContentFavorite repository'si oluşturulduktan sonra implement edilecek
      
      // Post sahibine bildirim gönder
      if (post.userId !== userId) {
        const user = await this.userRepo.findById(userId);
        if (user) {
          SocketManager.getInstance().getSocketHandler().sendMessageToUser(
            post.userId.toString(),
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
   * Bir gönderiyi görüntüle
   */
  async viewPost(userId: number, postId: number): Promise<void> {
    try {
      // Gönderiyi kontrol et
      const post = await this.contentPostRepo.findById(postId);
      if (!post) {
        throw new Error('Post not found');
      }

      // Görüntüleme kaydı oluştur (ContentPostView entity'si gerekli)
      // Bu kısım ContentPostView repository'si oluşturulduktan sonra implement edilecek

      // Görüntüleme sayısını güncelle
      await this.contentPostRepo.incrementViewCount(postId);

      logger.info(`User ${userId} viewed post ${postId}`);
    } catch (error) {
      logger.error(`Failed to view post ${postId} by user ${userId}:`, error);
      throw error;
    }
  }
}
