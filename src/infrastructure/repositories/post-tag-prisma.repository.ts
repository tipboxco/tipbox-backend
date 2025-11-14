import { PrismaClient } from '@prisma/client';
import { PostTag } from '../../domain/content/post-tag.entity';

export class PostTagPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: string): Promise<PostTag | null> {
    const tag = await this.prisma.postTag.findUnique({ 
      where: { id },
      include: {
        post: true
      }
    });
    return tag ? this.toDomain(tag) : null;
  }

  async findByPostId(postId: string): Promise<PostTag[]> {
    const tags = await this.prisma.postTag.findMany({
      where: { postId },
      include: {
        post: true
      },
      orderBy: { createdAt: 'asc' }
    });
    return tags.map(tag => this.toDomain(tag));
  }

  async findByTag(tag: string): Promise<PostTag[]> {
    const tags = await this.prisma.postTag.findMany({
      where: { tag },
      include: {
        post: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return tags.map(postTag => this.toDomain(postTag));
  }

  async findByPostAndTag(postId: string, tag: string): Promise<PostTag | null> {
    const postTag = await this.prisma.postTag.findFirst({
      where: {
        postId,
        tag
      },
      include: {
        post: true
      }
    });
    return postTag ? this.toDomain(postTag) : null;
  }

  async create(postId: string, tag: string): Promise<PostTag> {
    const postTag = await this.prisma.postTag.create({
      data: {
        postId,
        tag
      },
      include: {
        post: true
      }
    });
    return this.toDomain(postTag);
  }

  async createMultiple(postId: string, tags: string[]): Promise<PostTag[]> {
    const data = tags.map(tag => ({ postId, tag }));
    
    await this.prisma.postTag.createMany({
      data,
      skipDuplicates: true
    });

    return this.findByPostId(postId);
  }

  async update(id: string, data: { tag?: string }): Promise<PostTag | null> {
    const tag = await this.prisma.postTag.update({
      where: { id },
      data,
      include: {
        post: true
      }
    });
    return tag ? this.toDomain(tag) : null;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.postTag.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteByPostAndTag(postId: string, tag: string): Promise<boolean> {
    try {
      const postTag = await this.prisma.postTag.findFirst({
        where: { postId, tag }
      });
      if (postTag) {
        await this.prisma.postTag.delete({ where: { id: postTag.id } });
      }
      return true;
    } catch {
      return false;
    }
  }

  async deleteByPostId(postId: string): Promise<boolean> {
    try {
      await this.prisma.postTag.deleteMany({
        where: { postId }
      });
      return true;
    } catch {
      return false;
    }
  }

  async updatePostTags(postId: string, tags: string[]): Promise<PostTag[]> {
    // Remove existing tags
    await this.deleteByPostId(postId);
    
    // Add new tags
    if (tags.length > 0) {
      return this.createMultiple(postId, tags);
    }
    
    return [];
  }

  async countByPostId(postId: string): Promise<number> {
    return await this.prisma.postTag.count({
      where: { postId }
    });
  }

  async countByTag(tag: string): Promise<number> {
    return await this.prisma.postTag.count({
      where: { tag }
    });
  }

  async getPopularTags(limit: number = 10): Promise<{tag: string, count: number}[]> {
    const tags = await this.prisma.postTag.groupBy({
      by: ['tag'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: limit
    });
    return tags.map(t => ({ tag: t.tag, count: t._count.id }));
  }

  async searchTags(query: string): Promise<PostTag[]> {
    const tags = await this.prisma.postTag.findMany({
      where: {
        tag: { contains: query, mode: 'insensitive' }
      },
      include: {
        post: true
      },
      orderBy: { tag: 'asc' }
    });
    return tags.map(tag => this.toDomain(tag));
  }

  async list(): Promise<PostTag[]> {
    const tags = await this.prisma.postTag.findMany({
      include: {
        post: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return tags.map(tag => this.toDomain(tag));
  }

  private toDomain(prismaTag: any): PostTag {
    return new PostTag(
      prismaTag.id,
      prismaTag.postId,
      prismaTag.tag,
      prismaTag.createdAt,
      prismaTag.updatedAt
    );
  }
}