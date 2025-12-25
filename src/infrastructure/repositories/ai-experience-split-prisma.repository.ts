import { AiExperienceSplit } from '../../domain/ai/ai-experience-split.entity';
import { getPrisma } from './prisma.client';

export interface CreateAiExperienceSplitData {
  userId: string;
  productId?: string | null;
  originalExperience: string;
  priceAndShopping?: string | null;
  productAndUsage?: string | null;
  priceAndShoppingRating?: number | null;
  productAndUsageRating?: number | null;
  priceAndShoppingPlaceholder?: string | null;
  productAndUsagePlaceholder?: string | null;
  priceAndShoppingIsEnhanced?: boolean | null;
  productAndUsageIsEnhanced?: boolean | null;
  isEdited?: boolean;
  model?: string;
  promptVersion?: string;
  tokensUsed?: number | null;
  processingTimeMs?: number | null;
}

export interface UpdateAiExperienceSplitData {
  priceAndShopping?: string;
  productAndUsage?: string;
  priceAndShoppingRating?: number;
  productAndUsageRating?: number;
  isEdited?: boolean;
}

export class AiExperienceSplitPrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<AiExperienceSplit | null> {
    const split = await this.prisma.aiExperienceSplit.findUnique({
      where: { id },
      include: {
        user: true,
        product: true
      }
    });
    return split ? this.toDomain(split) : null;
  }

  async findByUserId(userId: string): Promise<AiExperienceSplit[]> {
    const splits = await this.prisma.aiExperienceSplit.findMany({
      where: { userId },
      include: {
        user: true,
        product: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return splits.map(split => this.toDomain(split));
  }

  async findByProductId(productId: string): Promise<AiExperienceSplit[]> {
    const splits = await this.prisma.aiExperienceSplit.findMany({
      where: { productId },
      include: {
        user: true,
        product: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return splits.map(split => this.toDomain(split));
  }

  async findByUserAndProduct(userId: string, productId: string): Promise<AiExperienceSplit[]> {
    const splits = await this.prisma.aiExperienceSplit.findMany({
      where: {
        userId,
        productId
      },
      include: {
        user: true,
        product: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return splits.map(split => this.toDomain(split));
  }

  async create(data: CreateAiExperienceSplitData): Promise<AiExperienceSplit> {
    const split = await this.prisma.aiExperienceSplit.create({
      data: {
        userId: data.userId,
        productId: data.productId ?? null,
        originalExperience: data.originalExperience,
        priceAndShopping: data.priceAndShopping ?? null,
        productAndUsage: data.productAndUsage ?? null,
        priceAndShoppingRating: data.priceAndShoppingRating ?? null,
        productAndUsageRating: data.productAndUsageRating ?? null,
        priceAndShoppingPlaceholder: data.priceAndShoppingPlaceholder ?? null,
        productAndUsagePlaceholder: data.productAndUsagePlaceholder ?? null,
        priceAndShoppingIsEnhanced: data.priceAndShoppingIsEnhanced ?? null,
        productAndUsageIsEnhanced: data.productAndUsageIsEnhanced ?? null,
        isEdited: data.isEdited ?? false,
        model: data.model ?? 'gemini-2.5-pro',
        promptVersion: data.promptVersion ?? 'v2.1',
        tokensUsed: data.tokensUsed ?? null,
        processingTimeMs: data.processingTimeMs ?? null
      },
      include: {
        user: true,
        product: true
      }
    });
    return this.toDomain(split);
  }

  async update(id: string, data: UpdateAiExperienceSplitData): Promise<AiExperienceSplit | null> {
    try {
      const split = await this.prisma.aiExperienceSplit.update({
        where: { id },
        data: {
          priceAndShopping: data.priceAndShopping,
          productAndUsage: data.productAndUsage,
          priceAndShoppingRating: data.priceAndShoppingRating,
          productAndUsageRating: data.productAndUsageRating,
          isEdited: data.isEdited ?? true
        },
        include: {
          user: true,
          product: true
        }
      });
      return this.toDomain(split);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.aiExperienceSplit.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async list(limit?: number): Promise<AiExperienceSplit[]> {
    const splits = await this.prisma.aiExperienceSplit.findMany({
      include: {
        user: true,
        product: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return splits.map(split => this.toDomain(split));
  }

  async getStatsByUser(userId: string): Promise<{
    total: number;
    edited: number;
    avgTokensUsed: number;
    avgProcessingTime: number;
  }> {
    const splits = await this.prisma.aiExperienceSplit.findMany({
      where: { userId },
      select: {
        isEdited: true,
        tokensUsed: true,
        processingTimeMs: true
      }
    });

    const total = splits.length;
    const edited = splits.filter(s => s.isEdited).length;
    const tokensUsed = splits.filter(s => s.tokensUsed !== null).map(s => s.tokensUsed!);
    const processingTimes = splits.filter(s => s.processingTimeMs !== null).map(s => s.processingTimeMs!);

    return {
      total,
      edited,
      avgTokensUsed: tokensUsed.length > 0 ? tokensUsed.reduce((a, b) => a + b, 0) / tokensUsed.length : 0,
      avgProcessingTime: processingTimes.length > 0 ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length : 0
    };
  }

  private toDomain(prismaSplit: any): AiExperienceSplit {
    return new AiExperienceSplit(
      prismaSplit.id,
      prismaSplit.userId,
      prismaSplit.productId,
      prismaSplit.originalExperience,
      prismaSplit.priceAndShopping,
      prismaSplit.productAndUsage,
      prismaSplit.priceAndShoppingRating,
      prismaSplit.productAndUsageRating,
      prismaSplit.isEdited,
      prismaSplit.model,
      prismaSplit.promptVersion,
      prismaSplit.tokensUsed,
      prismaSplit.processingTimeMs,
      prismaSplit.createdAt,
      prismaSplit.updatedAt
    );
  }
}

