import { getPrisma } from './prisma.client';
import { ContentPost } from '../../domain/content/content-post.entity';
import { ContentPostType } from '../../domain/content/content-post-type.enum';
import { generateIdForModel } from '../ids/id.strategy';

export class ContentPostPrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<ContentPost | null> {
    const post = await this.prisma.contentPost.findUnique({ 
      where: { id },
      include: {
        user: true,
        subCategory: true,
        question: true,
        tip: true,
        tags: true,
        comments: true,
        likes: true,
        favorites: true,
        views: true,
        contentPostTags: true
      }
    });
    return post ? this.toDomain(post) : null;
  }

  async findByUserId(userId: string): Promise<ContentPost[]> {
    const posts = await this.prisma.contentPost.findMany({
      where: { userId },
      include: {
        user: true,
        subCategory: true,
        question: true,
        tip: true,
        tags: true,
        comments: true,
        likes: true,
        favorites: true,
        views: true,
        contentPostTags: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return posts.map(post => this.toDomain(post));
  }

  async findBySubCategoryId(subCategoryId: string): Promise<ContentPost[]> {
    const posts = await this.prisma.contentPost.findMany({
      where: { subCategoryId },
      include: {
        user: true,
        subCategory: true,
        question: true,
        tip: true,
        tags: true,
        comments: true,
        likes: true,
        favorites: true,
        views: true,
        contentPostTags: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return posts.map(post => this.toDomain(post));
  }

  async findByType(type: ContentPostType): Promise<ContentPost[]> {
    const posts = await this.prisma.contentPost.findMany({
      where: { type },
      include: {
        user: true,
        subCategory: true,
        question: true,
        tip: true,
        tags: true,
        comments: true,
        likes: true,
        favorites: true,
        views: true,
        contentPostTags: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return posts.map(post => this.toDomain(post));
  }

  async search(query: string): Promise<ContentPost[]> {
    const posts = await this.prisma.contentPost.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { body: { contains: query, mode: 'insensitive' } }
        ]
      },
      include: {
        user: true,
        subCategory: true,
        question: true,
        tip: true,
        tags: true,
        comments: true,
        likes: true,
        favorites: true,
        views: true,
        contentPostTags: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return posts.map(post => this.toDomain(post));
  }

  async create(
    userId: string,
    type: ContentPostType,
    title: string,
    body: string,
    subCategoryId?: string,
    mainCategoryId?: string,
    productGroupId?: string,
    productId?: string,
    inventoryRequired: boolean = false,
    isBoosted: boolean = false
  ): Promise<ContentPost> {
    const post = await this.prisma.contentPost.create({
      data: {
        id: generateIdForModel('ContentPost'),
        userId,
        type,
        title,
        body,
        subCategoryId: subCategoryId || null,
        mainCategoryId: mainCategoryId || null,
        productGroupId: productGroupId || null,
        productId: productId || null,
        inventoryRequired,
        isBoosted
      },
      include: {
        user: true,
        subCategory: true,
        question: true,
        tip: true,
        tags: true,
        comments: true,
        likes: true,
        favorites: true,
        views: true,
        contentPostTags: true
      }
    });

    // Increment user's postsCount
    await this.prisma.profile.updateMany({
      where: { userId },
      data: {
        postsCount: {
          increment: 1
        }
      } as any
    });

    return this.toDomain(post);
  }

  async update(id: string, data: { 
    title?: string;
    body?: string;
    isBoosted?: boolean;
    boostedUntil?: Date;
  }): Promise<ContentPost | null> {
    const post = await this.prisma.contentPost.update({
      where: { id },
      data,
      include: {
        user: true,
        subCategory: true,
        question: true,
        tip: true,
        tags: true,
        comments: true,
        likes: true,
        favorites: true,
        views: true,
        contentPostTags: true
      }
    });
    return post ? this.toDomain(post) : null;
  }

  async delete(id: string): Promise<boolean> {
    try {
      // Get post to get userId before deleting
      const post = await this.prisma.contentPost.findUnique({
        where: { id },
        select: { userId: true }
      });

      if (!post) return false;

      await this.prisma.contentPost.delete({ where: { id } });

      // Decrement user's postsCount
      await this.prisma.profile.updateMany({
        where: { userId: post.userId },
        data: {
          postsCount: {
            increment: -1
          }
        } as any
      });

      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<ContentPost[]> {
    const posts = await this.prisma.contentPost.findMany({
      include: {
        user: true,
        subCategory: true,
        question: true,
        tip: true,
        tags: true,
        comments: true,
        likes: true,
        favorites: true,
        views: true,
        contentPostTags: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return posts.map(post => this.toDomain(post));
  }

  async listRecent(limit: number = 10): Promise<ContentPost[]> {
    const posts = await this.prisma.contentPost.findMany({
      include: {
        user: true,
        subCategory: true,
        question: true,
        tip: true,
        tags: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return posts.map(post => this.toDomain(post));
  }

  async listPopular(limit: number = 10): Promise<ContentPost[]> {
    const posts = await this.prisma.contentPost.findMany({
      include: {
        user: true,
        subCategory: true,
        question: true,
        tip: true,
        tags: true
      },
      orderBy: {
        likesCount: 'desc'
      } as any,
      take: limit
    });
    return posts.map(post => this.toDomain(post));
  }

  async incrementLikeCount(postId: string): Promise<void> {
    await this.prisma.contentPost.update({
      where: { id: postId },
      data: {
        likesCount: {
          increment: 1
        }
      } as any
    });
  }

  async decrementLikeCount(postId: string): Promise<void> {
    await this.prisma.contentPost.update({
      where: { id: postId },
      data: {
        likesCount: {
          increment: -1
        }
      } as any
    });
  }

  async incrementViewCount(postId: string): Promise<void> {
    await this.prisma.contentPost.update({
      where: { id: postId },
      data: {
        viewsCount: {
          increment: 1
        }
      } as any
    });
  }

  async incrementCommentCount(postId: string): Promise<void> {
    await this.prisma.contentPost.update({
      where: { id: postId },
      data: {
        commentsCount: {
          increment: 1
        }
      } as any
    });
  }

  async decrementCommentCount(postId: string): Promise<void> {
    await this.prisma.contentPost.update({
      where: { id: postId },
      data: {
        commentsCount: {
          increment: -1
        }
      } as any
    });
  }

  async incrementFavoriteCount(postId: string): Promise<void> {
    await this.prisma.contentPost.update({
      where: { id: postId },
      data: {
        favoritesCount: {
          increment: 1
        }
      } as any
    });
  }

  async decrementFavoriteCount(postId: string): Promise<void> {
    await this.prisma.contentPost.update({
      where: { id: postId },
      data: {
        favoritesCount: {
          increment: -1
        }
      } as any
    });
  }

  private toDomain(prismaPost: any): ContentPost {
    return new ContentPost(
      prismaPost.id,
      prismaPost.userId,
      prismaPost.type as ContentPostType,
      prismaPost.title,
      prismaPost.body,
      prismaPost.subCategoryId,
      prismaPost.mainCategoryId,
      prismaPost.productGroupId,
      prismaPost.productId,
      prismaPost.inventoryRequired,
      prismaPost.isBoosted,
      prismaPost.boostedUntil,
      prismaPost.likesCount ?? 0,
      prismaPost.commentsCount ?? 0,
      prismaPost.favoritesCount ?? 0,
      prismaPost.viewsCount ?? 0,
      prismaPost.createdAt,
      prismaPost.updatedAt
    );
  }
}