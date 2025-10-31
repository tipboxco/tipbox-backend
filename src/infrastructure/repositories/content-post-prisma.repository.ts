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
      await this.prisma.contentPost.delete({ where: { id } });
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
        tags: true,
        _count: {
          select: {
            comments: true,
            likes: true,
            views: true
          }
        }
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
        tags: true,
        _count: {
          select: {
            likes: true,
            comments: true,
            views: true
          }
        }
      },
      orderBy: {
        likes: {
          _count: 'desc'
        }
      },
      take: limit
    });
    return posts.map(post => this.toDomain(post));
  }

  async incrementLikeCount(postId: string): Promise<void> {
    // Like count is calculated from ContentLike table, no need to update
    // This method is kept for compatibility but does nothing
  }

  async decrementLikeCount(postId: string): Promise<void> {
    // Like count is calculated from ContentLike table, no need to update
    // This method is kept for compatibility but does nothing
  }

  async incrementViewCount(postId: string): Promise<void> {
    // View count is calculated from ContentPostView table, no need to update
    // This method is kept for compatibility but does nothing
  }

  async incrementCommentCount(postId: string): Promise<void> {
    // Comment count is calculated from ContentComment table, no need to update
    // This method is kept for compatibility but does nothing
  }

  async decrementCommentCount(postId: string): Promise<void> {
    // Comment count is calculated from ContentComment table, no need to update
    // This method is kept for compatibility but does nothing
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
      prismaPost.createdAt,
      prismaPost.updatedAt
    );
  }
}