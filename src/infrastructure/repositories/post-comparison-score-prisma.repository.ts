import { PostComparisonScore } from '../../domain/product/post-comparison-score.entity';
import { getPrisma } from './prisma.client';

export class PostComparisonScorePrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<PostComparisonScore | null> {
    const score = await this.prisma.postComparisonScore.findUnique({ 
      where: { id },
      include: {
        comparison: true,
        metric: true
      }
    });
    return score ? this.toDomain(score) : null;
  }

  async findByComparisonId(comparisonId: string): Promise<PostComparisonScore[]> {
    const scores = await this.prisma.postComparisonScore.findMany({
      where: { comparisonId },
      include: {
        comparison: true,
        metric: true
      },
      orderBy: { createdAt: 'asc' }
    });
    return scores.map(score => this.toDomain(score));
  }

  async findByMetricId(metricId: string): Promise<PostComparisonScore[]> {
    const scores = await this.prisma.postComparisonScore.findMany({
      where: { metricId },
      include: {
        comparison: true,
        metric: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return scores.map(score => this.toDomain(score));
  }

  async findByComparisonAndMetric(comparisonId: string, metricId: string): Promise<PostComparisonScore | null> {
    const score = await this.prisma.postComparisonScore.findUnique({
      where: {
        comparisonId_metricId: {
          comparisonId,
          metricId
        }
      },
      include: {
        comparison: true,
        metric: true
      }
    });
    return score ? this.toDomain(score) : null;
  }

  async create(
    comparisonId: string,
    metricId: string,
    scoreProduct1: number,
    scoreProduct2: number,
    comment?: string
  ): Promise<PostComparisonScore> {
    const score = await this.prisma.postComparisonScore.create({
      data: {
        comparisonId,
        metricId,
        scoreProduct1,
        scoreProduct2,
        comment
      },
      include: {
        comparison: true,
        metric: true
      }
    });
    return this.toDomain(score);
  }

  async update(id: string, data: { 
    scoreProduct1?: number;
    scoreProduct2?: number;
    comment?: string;
  }): Promise<PostComparisonScore | null> {
    const score = await this.prisma.postComparisonScore.update({
      where: { id },
      data,
      include: {
        comparison: true,
        metric: true
      }
    });
    return score ? this.toDomain(score) : null;
  }

  async updateScores(id: string, scoreProduct1: number, scoreProduct2: number): Promise<PostComparisonScore | null> {
    return this.update(id, { scoreProduct1, scoreProduct2 });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.postComparisonScore.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteByComparisonId(comparisonId: string): Promise<boolean> {
    try {
      await this.prisma.postComparisonScore.deleteMany({
        where: { comparisonId }
      });
      return true;
    } catch {
      return false;
    }
  }

  async countByComparisonId(comparisonId: string): Promise<number> {
    return await this.prisma.postComparisonScore.count({
      where: { comparisonId }
    });
  }

  async list(): Promise<PostComparisonScore[]> {
    const scores = await this.prisma.postComparisonScore.findMany({
      include: {
        comparison: true,
        metric: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return scores.map(score => this.toDomain(score));
  }

  private toDomain(prismaScore: any): PostComparisonScore {
    return new PostComparisonScore(
      prismaScore.id,
      prismaScore.comparisonId,
      prismaScore.metricId,
      prismaScore.scoreProduct1,
      prismaScore.scoreProduct2,
      prismaScore.comment,
      prismaScore.createdAt,
      prismaScore.updatedAt
    );
  }
}