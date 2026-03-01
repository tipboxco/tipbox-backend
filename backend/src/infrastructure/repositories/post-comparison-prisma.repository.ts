import type { PostComparison as PrismaPostComparisonModel } from '@prisma/client';
import { PostComparison } from '../../domain/product/post-comparison.entity';
import { getPrisma } from './prisma.client';

export class PostComparisonPrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<PostComparison | null> {
    const comparison = await this.prisma.postComparison.findUnique({
      where: { id },
    });
    return comparison ? this.toDomain(comparison) : null;
  }

  async findByPostId(postId: string): Promise<PostComparison[]> {
    const comparisons = await this.prisma.postComparison.findMany({
      where: { postId },
      orderBy: { createdAt: 'desc' }
    });
    return comparisons.map(comparison => this.toDomain(comparison));
  }

  async findByProductId(productId: string): Promise<PostComparison[]> {
    const comparisons = await this.prisma.postComparison.findMany({
      where: {
        OR: [
          { product1Id: productId },
          { product2Id: productId }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    return comparisons.map(comparison => this.toDomain(comparison));
  }

  async findByProducts(productAId: string, productBId: string): Promise<PostComparison[]> {
    const comparisons = await this.prisma.postComparison.findMany({
      where: {
        OR: [
          { AND: [{ product1Id: productAId }, { product2Id: productBId }] },
          { AND: [{ product1Id: productBId }, { product2Id: productAId }] }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    return comparisons.map(comparison => this.toDomain(comparison));
  }

  async create(
    postId: string, 
    productAId: string, 
    productBId: string, 
    winnerProductId?: string
  ): Promise<PostComparison> {
    const comparison = await this.prisma.postComparison.create({
      data: {
        postId,
        product1Id: productAId,
        product2Id: productBId,

      },
    });
    return this.toDomain(comparison);
  }

  async update(id: string, data: { 

  }): Promise<PostComparison | null> {
    const comparison = await this.prisma.postComparison.update({
      where: { id },
      data,
    });
    return comparison ? this.toDomain(comparison) : null;
  }

  async setWinner(id: string, winnerProductId: string): Promise<PostComparison | null> {
    const comparison = await this.prisma.postComparison.update({
      where: { id },
      data: { comparisonSummary: "Updated" },
    });
    return comparison ? this.toDomain(comparison) : null;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.postComparison.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<PostComparison[]> {
    const comparisons = await this.prisma.postComparison.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return comparisons.map(comparison => this.toDomain(comparison));
  }

  async listRecent(limit: number = 10): Promise<PostComparison[]> {
    const comparisons = await this.prisma.postComparison.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return comparisons.map(comparison => this.toDomain(comparison));
  }

  private toDomain(prismaComparison: PrismaPostComparisonModel): PostComparison {
    return new PostComparison(
      prismaComparison.id,
      prismaComparison.postId,
      prismaComparison.product1Id,
      prismaComparison.product2Id,
      prismaComparison.comparisonSummary,
      prismaComparison.createdAt,
      prismaComparison.updatedAt
    );
  }
}