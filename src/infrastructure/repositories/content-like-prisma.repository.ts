import { PrismaClient } from '@prisma/client';
import { ContentLike } from '../../domain/interaction/content-like.entity';

export class ContentLikePrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: string): Promise<ContentLike | null> {
    const like = await this.prisma.contentLike.findUnique({ 
      where: { id },
      include: {
        user: true,
        post: true
      }
    });
    return like ? this.toDomain(like) : null;
  }

  async findByUserAndPost(userId: string, postId: string): Promise<ContentLike | null> {
    const like = await this.prisma.contentLike.findFirst({
      where: {
        userId,
        postId
      },
      include: {
        user: true,
        post: true
      }
    });
    return like ? this.toDomain(like) : null;
  }

  async findByUserId(userId: string): Promise<ContentLike[]> {
    const likes = await this.prisma.contentLike.findMany({
      where: { userId },
      include: {
        user: true,
        post: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return likes.map(like => this.toDomain(like));
  }

  async findByPostId(postId: string): Promise<ContentLike[]> {
    const likes = await this.prisma.contentLike.findMany({
      where: { postId },
      include: {
        user: true,
        post: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return likes.map(like => this.toDomain(like));
  }

  async create(data: Partial<ContentLike>): Promise<ContentLike> {
    const like = await this.prisma.contentLike.create({
      data: {
        userId: data.userId!,
        postId: data.postId ?? null,
        commentId: data.commentId ?? null,
        createdAt: data.createdAt || new Date(),
      },
      include: {
        user: true,
        post: true
      }
    });
    return this.toDomain(like);
  }

  async update(id: string, data: Partial<ContentLike>): Promise<ContentLike | null> {
    try {
      const updateData: any = {
        updatedAt: new Date(),
      };
      if (data.postId !== undefined) updateData.postId = data.postId;
      if (data.commentId !== undefined) updateData.commentId = data.commentId;
      
      const like = await this.prisma.contentLike.update({
        where: { id },
        data: updateData,
        include: {
          user: true,
          post: true
        }
      });
      return this.toDomain(like);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.contentLike.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async getLikeCountByPostId(postId: string): Promise<number> {
    return this.prisma.contentLike.count({
      where: { postId }
    });
  }

  async getLikeCountByUserId(userId: string): Promise<number> {
    return this.prisma.contentLike.count({
      where: { userId }
    });
  }

  private toDomain(prismaLike: any): ContentLike {
    return new ContentLike(
      prismaLike.id,
      prismaLike.userId,
      prismaLike.postId,
      prismaLike.commentId,
      prismaLike.createdAt,
      prismaLike.updatedAt
    );
  }
}
