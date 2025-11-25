import { ComparisonMetric } from '../../domain/product/comparison-metric.entity';
import { getPrisma } from './prisma.client';

export class ComparisonMetricPrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<ComparisonMetric | null> {
    const metric = await this.prisma.comparisonMetric.findUnique({ 
      where: { id },
      include: {
        comparisonScores: true
      }
    });
    return metric ? this.toDomain(metric) : null;
  }

  async findByName(name: string): Promise<ComparisonMetric | null> {
    const metric = await this.prisma.comparisonMetric.findFirst({ 
      where: { name },
      include: {
        comparisonScores: true
      }
    });
    return metric ? this.toDomain(metric) : null;
  }

  async create(
    name: string, 
    description?: string
  ): Promise<ComparisonMetric> {
    const metric = await this.prisma.comparisonMetric.create({
      data: {
        name,
        description
      },
      include: {
        comparisonScores: true
      }
    });
    return this.toDomain(metric);
  }

  async update(id: string, data: { 
    name?: string; 
    description?: string;
  }): Promise<ComparisonMetric | null> {
    const metric = await this.prisma.comparisonMetric.update({
      where: { id },
      data,
      include: {
        comparisonScores: true
      }
    });
    return metric ? this.toDomain(metric) : null;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.comparisonMetric.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<ComparisonMetric[]> {
    const metrics = await this.prisma.comparisonMetric.findMany({
      include: {
        comparisonScores: true
      },
      orderBy: { name: 'asc' }
    });
    return metrics.map(metric => this.toDomain(metric));
  }

  async listWithUsageCount(): Promise<ComparisonMetric[]> {
    const metrics = await this.prisma.comparisonMetric.findMany({
      include: {
        _count: {
          select: { comparisonScores: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    return metrics.map(metric => this.toDomain(metric));
  }

  private toDomain(prismaMetric: any): ComparisonMetric {
    return new ComparisonMetric(
      prismaMetric.id,
      prismaMetric.name,
      prismaMetric.description,
      prismaMetric.createdAt,
      prismaMetric.updatedAt
    );
  }
}