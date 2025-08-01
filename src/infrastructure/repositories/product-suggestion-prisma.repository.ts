import { PrismaClient } from '@prisma/client';
import { ProductSuggestion } from '../../domain/product/product-suggestion.entity';
import { ProductSuggestionStatus } from '../../domain/product/product-suggestion-status.enum';

export class ProductSuggestionPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: number): Promise<ProductSuggestion | null> {
    const suggestion = await this.prisma.productSuggestion.findUnique({ 
      where: { id },
      include: {
        user: true,
        reviewer: true
      }
    });
    return suggestion ? this.toDomain(suggestion) : null;
  }

  async findByUserId(userId: number): Promise<ProductSuggestion[]> {
    const suggestions = await this.prisma.productSuggestion.findMany({
      where: { userId },
      include: {
        user: true,
        reviewer: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return suggestions.map(suggestion => this.toDomain(suggestion));
  }

  async findByStatus(status: ProductSuggestionStatus): Promise<ProductSuggestion[]> {
    const suggestions = await this.prisma.productSuggestion.findMany({
      where: { status },
      include: {
        user: true,
        reviewer: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return suggestions.map(suggestion => this.toDomain(suggestion));
  }

  async findPending(): Promise<ProductSuggestion[]> {
    return this.findByStatus(ProductSuggestionStatus.PENDING);
  }

  async findApproved(): Promise<ProductSuggestion[]> {
    return this.findByStatus(ProductSuggestionStatus.APPROVED);
  }

  async findRejected(): Promise<ProductSuggestion[]> {
    return this.findByStatus(ProductSuggestionStatus.REJECTED);
  }

  async create(
    userId: number,
    suggestedName: string,
    suggestedBrand?: string,
    description?: string,
    reason?: string
  ): Promise<ProductSuggestion> {
    const suggestion = await this.prisma.productSuggestion.create({
      data: {
        userId,
        suggestedName,
        suggestedBrand,
        description,
        reason,
        status: ProductSuggestionStatus.PENDING
      },
      include: {
        user: true,
        reviewer: true
      }
    });
    return this.toDomain(suggestion);
  }

  async update(id: number, data: { 
    suggestedName?: string;
    suggestedBrand?: string;
    description?: string;
    reason?: string;
    status?: ProductSuggestionStatus;
  }): Promise<ProductSuggestion | null> {
    const suggestion = await this.prisma.productSuggestion.update({
      where: { id },
      data,
      include: {
        user: true,
        reviewer: true
      }
    });
    return suggestion ? this.toDomain(suggestion) : null;
  }

  async updateStatus(id: number, status: ProductSuggestionStatus, reviewedBy?: number): Promise<ProductSuggestion | null> {
    const suggestion = await this.prisma.productSuggestion.update({
      where: { id },
      data: { 
        status,
        reviewedBy,
        reviewedAt: new Date()
      },
      include: {
        user: true,
        reviewer: true
      }
    });
    return suggestion ? this.toDomain(suggestion) : null;
  }

  async approve(id: number, reviewedBy: number): Promise<ProductSuggestion | null> {
    return this.updateStatus(id, ProductSuggestionStatus.APPROVED, reviewedBy);
  }

  async reject(id: number, reviewedBy: number): Promise<ProductSuggestion | null> {
    return this.updateStatus(id, ProductSuggestionStatus.REJECTED, reviewedBy);
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.productSuggestion.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async countByStatus(status: ProductSuggestionStatus): Promise<number> {
    return await this.prisma.productSuggestion.count({
      where: { status }
    });
  }

  async countPending(): Promise<number> {
    return this.countByStatus(ProductSuggestionStatus.PENDING);
  }

  async list(): Promise<ProductSuggestion[]> {
    const suggestions = await this.prisma.productSuggestion.findMany({
      include: {
        user: true,
        reviewer: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return suggestions.map(suggestion => this.toDomain(suggestion));
  }

  private toDomain(prismaSuggestion: any): ProductSuggestion {
    return new ProductSuggestion(
      prismaSuggestion.id,
      prismaSuggestion.userId,
      prismaSuggestion.suggestedName,
      prismaSuggestion.suggestedBrand,
      prismaSuggestion.description,
      prismaSuggestion.reason,
      prismaSuggestion.status as ProductSuggestionStatus,
      prismaSuggestion.reviewedAt,
      prismaSuggestion.reviewedBy,
      prismaSuggestion.createdAt,
      prismaSuggestion.updatedAt
    );
  }
}