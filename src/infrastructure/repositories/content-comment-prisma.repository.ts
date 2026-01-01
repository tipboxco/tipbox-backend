import { ContentComment } from '../../domain/interaction/content-comment.entity';
import { getPrisma } from './prisma.client';
import { generateIdForModel } from '../ids/id.strategy';

export class ContentCommentPrismaRepository {
  private prisma = getPrisma();

  async create(data: {
    postId: string;
    userId: string;
    comment: string;
    parentId?: string;
    isAnswer?: boolean;
  }): Promise<ContentComment> {
    const commentId = generateIdForModel('ContentComment');
    
    const comment = await this.prisma.contentComment.create({
      data: {
        id: commentId,
        postId: data.postId,
        userId: data.userId,
        comment: data.comment,
        parentId: data.parentId || null,
        isAnswer: data.isAnswer || false,
        likesCount: 0,
      } as any,
    });
    
    return this.toDomain(comment);
  }

  async findById(id: string): Promise<ContentComment | null> {
    const comment = await this.prisma.contentComment.findUnique({
      where: { id },
    });
    return comment ? this.toDomain(comment) : null;
  }

  async findByPostId(postId: string, limit = 50): Promise<ContentComment[]> {
    const comments = await this.prisma.contentComment.findMany({
      where: { postId, parentId: null }, // Sadece top-level
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return comments.map(c => this.toDomain(c));
  }

  async findRepliesByParentId(parentId: string): Promise<ContentComment[]> {
    const replies = await this.prisma.contentComment.findMany({
      where: { parentId },
      orderBy: { createdAt: 'asc' },
    });
    return replies.map(r => this.toDomain(r));
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.contentComment.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async incrementLikeCount(commentId: string): Promise<void> {
    await this.prisma.contentComment.update({
      where: { id: commentId },
      data: { likesCount: { increment: 1 } } as any,
    });
  }

  async decrementLikeCount(commentId: string): Promise<void> {
    await this.prisma.contentComment.update({
      where: { id: commentId },
      data: { likesCount: { decrement: 1 } } as any,
    });
  }

  private toDomain(prismaComment: any): ContentComment {
    return new ContentComment(
      prismaComment.id,
      prismaComment.postId,
      prismaComment.userId,
      prismaComment.parentId,
      prismaComment.comment,
      prismaComment.isAnswer,
      prismaComment.likesCount || 0,
      prismaComment.createdAt,
      prismaComment.updatedAt
    );
  }
}

