import { PrismaClient } from '@prisma/client';
import { UserTrustScore } from '../../domain/user/user-trust-score.entity';

export class UserTrustScorePrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: string): Promise<UserTrustScore | null> {
    const score = await this.prisma.userTrustScore.findUnique({ where: { id } });
    return score ? this.toDomain(score) : null;
  }

  async findByUserId(userId: string): Promise<UserTrustScore | null> {
    const score = await this.prisma.userTrustScore.findFirst({ where: { userId } });
    return score ? this.toDomain(score) : null;
  }

  async create(userId: string, score: number): Promise<UserTrustScore> {
    const trustScore = await this.prisma.userTrustScore.create({
      data: {
        userId,
        score
      }
    });
    return this.toDomain(trustScore);
  }

  async update(id: string, score: number): Promise<UserTrustScore | null> {
    const trustScore = await this.prisma.userTrustScore.update({
      where: { id },
      data: { score }
    });
    return trustScore ? this.toDomain(trustScore) : null;
  }

  async updateByUserId(userId: string, score: number): Promise<UserTrustScore | null> {
    // Find first record by userId and then update by id
    const existing = await this.prisma.userTrustScore.findFirst({ where: { userId } });
    if (!existing) return null;
    
    const trustScore = await this.prisma.userTrustScore.update({
      where: { id: existing.id },
      data: { score }
    });
    return trustScore ? this.toDomain(trustScore) : null;
  }

  async incrementScore(userId: string, increment: number): Promise<UserTrustScore | null> {
    // Find first record by userId and then update by id
    const existing = await this.prisma.userTrustScore.findFirst({ where: { userId } });
    if (!existing) return null;
    
    const trustScore = await this.prisma.userTrustScore.update({
      where: { id: existing.id },
      data: {
        score: {
          increment
        }
      }
    });
    return trustScore ? this.toDomain(trustScore) : null;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.userTrustScore.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async getTopTrustScores(limit: number = 10): Promise<UserTrustScore[]> {
    const scores = await this.prisma.userTrustScore.findMany({
      orderBy: { score: 'desc' },
      take: limit
    });
    return scores.map(score => this.toDomain(score));
  }

  async list(): Promise<UserTrustScore[]> {
    const scores = await this.prisma.userTrustScore.findMany();
    return scores.map(score => this.toDomain(score));
  }

  private toDomain(prismaScore: any): UserTrustScore {
    return new UserTrustScore(
      prismaScore.id,
      prismaScore.userId,
      prismaScore.score,
      prismaScore.reason,
      prismaScore.calculatedAt,
      prismaScore.createdAt,
      prismaScore.updatedAt
    );
  }
}