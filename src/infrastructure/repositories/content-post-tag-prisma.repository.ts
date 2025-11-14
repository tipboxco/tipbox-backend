import { PrismaClient } from '@prisma/client';
import { ContentPostTag } from '../../domain/content/content-post-tag.entity';

export class ContentPostTagPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: string): Promise<ContentPostTag | null> {
    const postTag = await this.prisma.contentPostTag.findUnique({ 
      where: { id },
      include: {
        post: true
      }
    });
    return postTag ? this.toDomain(postTag) : null;
  }

  async findByPostId(postId: number): Promise<ContentPostTag[]> {
    const postTags = await this.prisma.contentPostTag.findMany({
      where: { postId },
      include: {
        post: true
      },
      orderBy: { createdAt: 'asc' }
    });
    return postTags.map(postTag => this.toDomain(postTag));
  }

  async findByTag(tag: string): Promise<ContentPostTag[]> {
    const postTags = await this.prisma.contentPostTag.findMany({
      where: { tag },
      include: {
        post: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return postTags.map(postTag => this.toDomain(postTag));
  }

  async findByPostAndTag(postId: number, tag: string): Promise<ContentPostTag | null> {
    const postTag = await this.prisma.contentPostTag.findFirst({
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

  async create(postId: number, tag: string): Promise<ContentPostTag> {
    const postTag = await this.prisma.contentPostTag.create({
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

  async createMultiple(postId: number, tags: string[]): Promise<ContentPostTag[]> {
    const data = tags.map(tag => ({ postId, tag }));
    
    await this.prisma.contentPostTag.createMany({
      data,
      skipDuplicates: true
    });

    // Return the created post tags
    return this.findByPostId(postId);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.contentPostTag.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteByPostAndTag(postId: number, tag: string): Promise<boolean> {
    try {
      const postTag = await this.prisma.contentPostTag.findFirst({
        where: { postId, tag }
      });
      if (postTag) {
        await this.prisma.contentPostTag.delete({ where: { id: postTag.id } });
      }
      return true;
    } catch {
      return false;
    }
  }

  async deleteByPostId(postId: number): Promise<boolean> {
    try {
      await this.prisma.contentPostTag.deleteMany({
        where: { postId }
      });
      return true;
    } catch {
      return false;
    }
  }

  async deleteByTag(tag: string): Promise<boolean> {
    try {
      await this.prisma.contentPostTag.deleteMany({
        where: { tag }
      });
      return true;
    } catch {
      return false;
    }
  }

  async updatePostTags(postId: number, tags: string[]): Promise<ContentPostTag[]> {
    // Remove existing tags
    await this.deleteByPostId(postId);
    
    // Add new tags
    if (tags.length > 0) {
      return this.createMultiple(postId, tags);
    }
    
    return [];
  }

  async countByPostId(postId: number): Promise<number> {
    return await this.prisma.contentPostTag.count({
      where: { postId }
    });
  }

  async countByTag(tag: string): Promise<number> {
    return await this.prisma.contentPostTag.count({
      where: { tag }
    });
  }

  async findPostsByTags(tags: string[]): Promise<ContentPostTag[]> {
    const postTags = await this.prisma.contentPostTag.findMany({
      where: {
        tag: {
          in: tags
        }
      },
      include: {
        post: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return postTags.map(postTag => this.toDomain(postTag));
  }

  async list(): Promise<ContentPostTag[]> {
    const postTags = await this.prisma.contentPostTag.findMany({
      include: {
        post: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return postTags.map(postTag => this.toDomain(postTag));
  }

  private toDomain(prismaPostTag: any): ContentPostTag {
    return new ContentPostTag(
      prismaPostTag.id,
      prismaPostTag.postId,
      prismaPostTag.tag,
      prismaPostTag.createdAt,
      prismaPostTag.updatedAt
    );
  }
}