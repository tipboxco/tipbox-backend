import { PrismaClient } from '@prisma/client';
import { ContentPost } from '../../domain/content/content-post.entity';
import { ContentPostType } from '../../domain/content/content-post-type.enum';

export class ContentPostPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: number): Promise<ContentPost | null> {
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

  async findByUserId(userId: number): Promise<ContentPost[]> {
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

  async findBySubCategoryId(subCategoryId: number): Promise<ContentPost[]> {
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
    userId: number,
    type: ContentPostType,
    title: string,
    body: string,
    subCategoryId?: number,
    mainCategoryId?: number,
    productGroupId?: number,
    productId?: number,
    inventoryRequired: boolean = false,
    isBoosted: boolean = false
  ): Promise<ContentPost> {
    const post = await this.prisma.contentPost.create({
      data: {
        userId,
        type,
        title,
        body,
        subCategoryId,
        mainCategoryId,
        productGroupId,
        productId,
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

  async update(id: number, data: { 
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

  async delete(id: number): Promise<boolean> {
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