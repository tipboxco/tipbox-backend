import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { generateIdForModel } from '../../infrastructure/ids/id.strategy';
import { ShareType } from '../../domain/interaction/share-type.enum';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import logger from '../../infrastructure/logger/logger';
import { NotFoundError } from '../../infrastructure/errors/custom-errors';
import { ContentPostType } from '../../domain/content/content-post-type.enum';
import { InteractionService } from '../interaction/interaction.service';

export interface NewsDetail {
  id: string;
  title: string;
  content: string;
  source: string;
  date: string;
  banner: string | null; // Banner image
  author: string | null;
  tags: string[];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  favoritesCount: number;
  viewsCount: number;
  // Kullanıcının interaction durumu
  isLiked?: boolean;
  isFavorited?: boolean;
  isShared?: boolean;
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
  private interactionService = new InteractionService();

  /**
   * News detayını getir
   * Hem News tablosundan hem de ContentPost tablosundan (UPDATE tipi) veri çekebilir
   */
  async getNewsById(newsId: string, userId?: string): Promise<NewsDetail | null> {
    try {
      // Önce News tablosunda ara (UUID formatında)
      let news = await this.prisma.news.findUnique({
        where: { id: newsId },
        include: {
          brand: {
            select: {
              name: true,
            },
          },
        },
      }).catch(() => null);

      // Eğer News tablosunda bulunamazsa, ContentPost tablosunda UPDATE tipi olarak ara
      if (!news) {
        const post = await this.prisma.contentPost.findUnique({
          where: { id: newsId },
          include: {
            user: {
              include: {
                profile: true,
              },
            },
            product: {
              include: {
                brand: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            media: {
              orderBy: { orderIndex: 'asc' },
            },
            likes: userId ? {
              where: { userId: userId },
            } : false,
            favorites: userId ? {
              where: { userId: userId },
            } : false,
            comments: true,
            contentPostTags: true,
          },
        });

        // UPDATE tipi postlar için inventory media'sından banner al
        let inventoryBanner: string | null = null;
        if (post && post.type === ContentPostType.UPDATE && post.productId && post.userId) {
          const inventory = await this.prisma.inventory.findFirst({
            where: {
              userId: post.userId,
              productId: post.productId,
            },
            include: {
              media: {
                orderBy: { createdAt: 'asc' },
                take: 1,
              },
            },
          }).catch(() => null);

          if (inventory?.media && inventory.media.length > 0) {
            inventoryBanner = resolveMediaUrl(inventory.media[0].mediaUrl);
          }
        }

        if (!post) {
          return null;
        }

        // ContentPost'u NewsDetail formatına çevir
        const postRecord = post as unknown as Record<string, unknown>;
        const likesCount = (postRecord.likesCount as number) ?? post.likes?.length ?? 0;
        const commentsCount = (postRecord.commentsCount as number) ?? post.comments?.length ?? 0;
        const sharesCount = (postRecord.sharesCount as number) ?? 0;
        const favoritesCount = (postRecord.favoritesCount as number) ?? post.favorites?.length ?? 0;
        const viewsCount = (postRecord.viewsCount as number) ?? 0;

        // Banner image - öncelik sırası: Post media > Inventory media > Product image
        const bannerImage = post.media && post.media.length > 0
          ? resolveMediaUrl(post.media[0].mediaUrl)
          : inventoryBanner
          ? inventoryBanner
          : post.product?.imageUrl
          ? resolveMediaUrl(post.product.imageUrl)
          : null;

        // Tags
        const tags = post.contentPostTags?.map((t: { tag: string }) => t.tag) || [];

        // Kullanıcının interaction durumunu kontrol et
        const isLiked = userId ? (post.likes && post.likes.length > 0) : false;
        const isFavorited = userId ? (post.favorites && post.favorites.length > 0) : false;
        const isShared = false; // ContentPost için share kontrolü yapılmıyor şimdilik

        // View count'u artır (userId varsa)
        if (userId) {
          const existingView = await this.prisma.contentPostView.findFirst({
            where: {
              userId: userId,
              postId: post.id,
            },
          }).catch(() => null);
          if (!existingView) {
            await this.prisma.contentPostView.create({
              data: {
                userId: userId,
                postId: post.id,
                viewerIp: '',
              },
            }).catch(() => {}); // Hata olursa devam et
          }
        }

        // Tarih formatını gün/ay/yıl şeklinde formatla (Türkçe)
        const formattedDate = new Date(post.createdAt).toLocaleDateString('tr-TR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });

        // Banner için marketplace.jpg kullan (eğer başka banner yoksa)
        // MinIO'da news/marketplace.jpg path'inde olmalı (upload-news-banner.ts script'i ile yüklenir)
        const finalBanner = bannerImage || resolveMediaUrl('news/marketplace.jpg');

        // İçeriği uzun yap (7 paragraf) - eğer kısa ise genişlet
        let longContent = post.body || '';
        if (longContent.length < 2000) {
          // İçeriği 7 paragrafa çıkar
          const paragraphs = [
            longContent,
            'Bu haber, teknoloji dünyasında önemli bir gelişmeyi işaret ediyor. Kullanıcılar için daha iyi bir deneyim sunmak amacıyla yapılan bu güncelleme, sektörde büyük yankı uyandırdı.',
            'Uzmanlar, bu gelişmenin gelecekte daha fazla yeniliğe kapı açacağını belirtiyor. Kullanıcı geri bildirimleri ve pazar analizleri, bu yönde olumlu sinyaller veriyor.',
            'Detaylı testler ve kullanıcı deneyimleri, bu güncellemenin performans ve kullanılabilirlik açısından önemli iyileştirmeler getirdiğini gösteriyor. Kullanıcılar, yeni özelliklerden memnun olduklarını ifade ediyor.',
            'Gelecek planları arasında, bu güncellemeye dayalı olarak daha fazla özellik ve iyileştirme yer alıyor. Ekip, kullanıcı geri bildirimlerini dikkate alarak sürekli geliştirme çalışmalarına devam ediyor.',
            'Bu haber, sektördeki diğer oyuncuları da etkileyecek gibi görünüyor. Rekabet ortamında bu tür yenilikler, tüm sektörün gelişimine katkı sağlıyor.',
            'Sonuç olarak, bu gelişme hem kullanıcılar hem de sektör için önemli bir adım. Gelecekte daha fazla yenilik ve iyileştirme bekleniyor.',
          ];
          longContent = paragraphs.join('\n\n');
        }

        return {
          id: post.id,
          title: (postRecord.title as string) || post.body?.slice(0, 80) || 'News',
          content: longContent,
          source: post.product?.brand?.name || 'tipbox',
          date: formattedDate,
          banner: finalBanner,
          author: post.user?.profile?.displayName || post.user?.email || null,
          tags,
          likesCount,
          commentsCount,
          sharesCount,
          favoritesCount,
          viewsCount: viewsCount + (userId ? 1 : 0),
          isLiked,
          isFavorited,
          isShared,
        };
      }

      // News tablosundan gelen veri için
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

      // Kullanıcının interaction durumunu kontrol et
      let isLiked = false;
      let isFavorited = false;
      let isShared = false;

      if (userId) {
        const [userLike, userFavorite, userShare] = await Promise.all([
          this.prisma.newsLike.findUnique({
            where: {
              userId_newsId: {
                userId: userId,
                newsId: newsId,
              },
            },
          }),
          this.prisma.newsFavorite.findUnique({
            where: {
              userId_newsId: {
                userId: userId,
                newsId: newsId,
              },
            },
          }),
          this.prisma.newsShare.findFirst({
            where: {
              userId: userId,
              newsId: newsId,
            },
          }),
        ]);

        isLiked = !!userLike;
        isFavorited = !!userFavorite;
        isShared = !!userShare;
      }

      // Tarih formatını gün/ay/yıl şeklinde formatla (Türkçe)
      const formattedDate = new Date(news.createdAt).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      // Banner için önce news.bannerImageUrl, yoksa marketplace.jpg
      // MinIO'da news/marketplace.jpg path'inde olmalı
      const newsBanner = news.bannerImageUrl
        ? resolveMediaUrl(news.bannerImageUrl)
        : resolveMediaUrl('news/marketplace.jpg');

      // İçeriği uzun yap (7 paragraf) - eğer kısa ise genişlet
      let longContent = news.content || '';
      if (longContent.length < 2000) {
        // İçeriği 7 paragrafa çıkar
        const paragraphs = [
          longContent,
          'Bu haber, teknoloji dünyasında önemli bir gelişmeyi işaret ediyor. Kullanıcılar için daha iyi bir deneyim sunmak amacıyla yapılan bu güncelleme, sektörde büyük yankı uyandırdı.',
          'Uzmanlar, bu gelişmenin gelecekte daha fazla yeniliğe kapı açacağını belirtiyor. Kullanıcı geri bildirimleri ve pazar analizleri, bu yönde olumlu sinyaller veriyor.',
          'Detaylı testler ve kullanıcı deneyimleri, bu güncellemenin performans ve kullanılabilirlik açısından önemli iyileştirmeler getirdiğini gösteriyor. Kullanıcılar, yeni özelliklerden memnun olduklarını ifade ediyor.',
          'Gelecek planları arasında, bu güncellemeye dayalı olarak daha fazla özellik ve iyileştirme yer alıyor. Ekip, kullanıcı geri bildirimlerini dikkate alarak sürekli geliştirme çalışmalarına devam ediyor.',
          'Bu haber, sektördeki diğer oyuncuları da etkileyecek gibi görünüyor. Rekabet ortamında bu tür yenilikler, tüm sektörün gelişimine katkı sağlıyor.',
          'Sonuç olarak, bu gelişme hem kullanıcılar hem de sektör için önemli bir adım. Gelecekte daha fazla yenilik ve iyileştirme bekleniyor.',
        ];
        longContent = paragraphs.join('\n\n');
      }

      return {
        id: news.id,
        title: news.title,
        content: longContent,
        source: news.source,
        date: formattedDate,
        banner: newsBanner,
        author: news.author,
        tags: news.tags,
        likesCount: news.likesCount,
        commentsCount: news.commentsCount,
        sharesCount: news.sharesCount,
        favoritesCount: news.favoritesCount,
        viewsCount: news.viewsCount + (userId ? 1 : 0),
        isLiked,
        isFavorited,
        isShared,
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
   * Hem News tablosundaki news'ler hem de ContentPost tablosundaki UPDATE tipi postlar için çalışır
   */
  async addComment(
    userId: string,
    newsId: string,
    comment: string,
    parentId?: string
  ): Promise<NewsCommentResponse> {
    try {
      // Önce News tablosunda ara
      let news = await this.prisma.news.findUnique({
        where: { id: newsId },
      });

      // Eğer News tablosunda bulunamazsa, ContentPost tablosunda ara (UPDATE tipi)
      if (!news) {
        logger.info(`News ${newsId} not found in News table, checking ContentPost table...`);
        const post = await this.prisma.contentPost.findUnique({
          where: { id: newsId },
        });

        if (!post) {
          logger.warn(`ContentPost ${newsId} not found`);
          throw new NotFoundError('News not found');
        }

        logger.info(`ContentPost ${newsId} found, using InteractionService to create ContentComment...`);
        
        // ContentPost için InteractionService kullanarak ContentComment oluştur
        // InteractionService zaten parentId kontrolü yapıyor
        const contentComment = await this.interactionService.createComment(
          userId,
          newsId,
          comment,
          parentId
        );

        logger.info(`ContentComment created successfully: ${contentComment.id}`);

        // ContentComment'ı NewsCommentResponse formatına çevir
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: {
            profile: true,
            avatars: {
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });

        return {
          id: contentComment.id,
          userId: contentComment.userId,
          userName: user?.profile?.userName || user?.profile?.displayName || null,
          userAvatar: resolveMediaUrl(user?.avatars?.[0]?.imageUrl || null),
          comment: contentComment.comment,
          likesCount: contentComment.likesCount,
          createdAt: contentComment.createdAt.toISOString(),
        };
      }

      // News tablosunda bulundu, NewsComment oluştur
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
   * Hem News tablosundaki news'ler hem de ContentPost tablosundaki UPDATE tipi postlar için çalışır
   */
  async getComments(newsId: string, limit: number = 50, offset: number = 0): Promise<{
    items: NewsCommentResponse[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      // Önce News tablosunda ara
      const news = await this.prisma.news.findUnique({
        where: { id: newsId },
      });

      // Eğer News tablosunda bulunamazsa, ContentPost tablosunda ara (UPDATE tipi)
      if (!news) {
        const post = await this.prisma.contentPost.findUnique({
          where: { id: newsId },
        });

        if (!post) {
          return {
            items: [],
            total: 0,
            hasMore: false,
          };
        }

        // ContentPost için ContentComment'ları getir
        const [contentComments, total] = await Promise.all([
          this.prisma.contentComment.findMany({
            where: {
              postId: newsId,
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
          this.prisma.contentComment.count({
            where: {
              postId: newsId,
              parentId: null,
            },
          }),
        ]);

        const hasMore = contentComments.length > limit;
        const resultComments = hasMore ? contentComments.slice(0, limit) : contentComments;

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
      }

      // News tablosunda bulundu, NewsComment'ları getir
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
