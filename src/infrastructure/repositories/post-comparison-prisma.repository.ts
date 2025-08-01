import { PrismaClient } from '@prisma/client';
import { PostComparison } from '../../domain/product/post-comparison.entity';

export class PostComparisonPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: number): Promise<PostComparison | null> {
    const comparison = await this.prisma.postComparison.findUnique({ 
      where: { id },
      include: {
        post: true,
        product1: true,
        product2: true,
        scores: true
      }
    });
    return comparison ? this.toDomain(comparison) : null;
  }

  async findByPostId(postId: number): Promise<PostComparison[]> {
    const comparisons = await this.prisma.postComparison.findMany({
      where: { postId },
      include: {
        post: true,
        product1: true,
        product2: true,
        scores: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return comparisons.map(comparison => this.toDomain(comparison));
  }

  async findByProductId(productId: number): Promise<PostComparison[]> {
    const comparisons = await this.prisma.postComparison.findMany({
      where: {
        OR: [
          { product1Id: productId },
          { product2Id: productId }
        ]
      },
      include: {
        post: true,
        product1: true,
        product2: true,
        scores: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return comparisons.map(comparison => this.toDomain(comparison));
  }

  async findByProducts(productAId: number, productBId: number): Promise<PostComparison[]> {
    const comparisons = await this.prisma.postComparison.findMany({
      where: {
        OR: [
          { AND: [{ product1Id: productAId }, { product2Id: productBId }] },
          { AND: [{ product1Id: productBId }, { product2Id: productAId }] }
        ]
      },
      include: {
        post: true,
        product1: true,
        product2: true,
        scores: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return comparisons.map(comparison => this.toDomain(comparison));
  }

  async create(
    postId: number, 
    productAId: number, 
    productBId: number, 
    winnerProductId?: number
  ): Promise<PostComparison> {
    const comparison = await this.prisma.postComparison.create({
      data: {
        postId,
        product1Id: productAId,
        product2Id: productBId,

      },
      include: {
        post: true,
        product1: true,
        product2: true,
        scores: true
      }
    });
    return this.toDomain(comparison);
  }

  async update(id: number, data: { 

  }): Promise<PostComparison | null> {
    const comparison = await this.prisma.postComparison.update({
      where: { id },
      data,
      include: {
        post: true,
        product1: true,
        product2: true,
        scores: true
      }
    });
    return comparison ? this.toDomain(comparison) : null;
  }

  async setWinner(id: number, winnerProductId: number): Promise<PostComparison | null> {
    const comparison = await this.prisma.postComparison.update({
      where: { id },
      data: { comparisonSummary: "Updated" },
      include: {
        post: true,
        product1: true,
        product2: true,
        scores: true
      }
    });
    return comparison ? this.toDomain(comparison) : null;
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.postComparison.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<PostComparison[]> {
    const comparisons = await this.prisma.postComparison.findMany({
      include: {
        post: true,
        product1: true,
        product2: true,
        scores: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return comparisons.map(comparison => this.toDomain(comparison));
  }

  async listRecent(limit: number = 10): Promise<PostComparison[]> {
    const comparisons = await this.prisma.postComparison.findMany({
      include: {
        post: true,
        product1: true,
        product2: true,
        scores: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return comparisons.map(comparison => this.toDomain(comparison));
  }

  private toDomain(prismaComparison: any): PostComparison {
    return new PostComparison(
      prismaComparison.id,
      prismaComparison.postId,
      prismaComparison.product1Id,
      prismaComparison.product2Id,
      prismaComparison.winnerProductId,
      prismaComparison.createdAt,
      prismaComparison.updatedAt
    );
  }
}