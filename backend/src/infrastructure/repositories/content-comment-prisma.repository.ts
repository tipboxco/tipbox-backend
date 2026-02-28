import type { ContentComment as PrismaContentCommentModel, Prisma } from '@prisma/client';
import { ContentComment } from '../../domain/interaction/content-comment.entity';
import { getPrisma } from './prisma.client';
import { generateIdForModel } from '../ids/id.strategy';
import { asContentCommentUpdate } from './prisma-types.helper';

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
      },
    });
    
    return this.toDomain(comment);
  }

  async findById(id: string): Promise<ContentComment | null> {
    const comment = await this.prisma.contentComment.findUnique({
      where: { id },
    });
    return comment ? this.toDomain(comment) : null;
  }

  async findByPostId(
    postId: string, 
    limit = 50, 
    sortBy: 'newest' | 'oldest' | 'popular' = 'newest'
  ): Promise<ContentComment[]> {
    // Sıralama kriterini belirle
    let orderBy: Prisma.ContentCommentOrderByWithRelationInput | Prisma.ContentCommentOrderByWithRelationInput[] = { createdAt: 'desc' }; // Default: newest

    if (sortBy === 'oldest') {
      orderBy = { createdAt: 'asc' };
    } else if (sortBy === 'popular') {
      orderBy = [
        { likesCount: 'desc' },
        { createdAt: 'desc' }, // Aynı like sayısında yeniler önce
      ];
    }

    const comments = await this.prisma.contentComment.findMany({
      where: { postId, parentId: null }, // Sadece top-level
      orderBy,
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
      data: asContentCommentUpdate({ likesCount: { increment: 1 } }),
    });
  }

  async decrementLikeCount(commentId: string): Promise<void> {
    await this.prisma.contentComment.update({
      where: { id: commentId },
      data: asContentCommentUpdate({ likesCount: { decrement: 1 } }),
    });
  }

  private toDomain(prismaComment: PrismaContentCommentModel): ContentComment {
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

