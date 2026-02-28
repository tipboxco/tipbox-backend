import { PrismaClient, Prisma } from '@prisma/client';
import type { RewardClaim as PrismaRewardClaimModel } from '@prisma/client';
import { 
  IRewardClaimRepository, 
  CreateRewardClaimDTO, 
  UpdateRewardClaimDTO,
  RewardClaimFilters
} from './reward-claim.repository.interface';
import { RewardClaim } from '../../domain/reward/reward-claim.entity';
import { RewardClaimStatus } from '../../domain/reward/reward-claim-status.enum';
import { RewardSourceType } from '../../domain/reward/reward-source-type.enum';
import logger from '../logger/logger';

export class RewardClaimPrismaRepository implements IRewardClaimRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  private mapToEntity(data: PrismaRewardClaimModel): RewardClaim {
    return new RewardClaim(
      data.id,
      data.userId,
      data.rewardType,
      data.sourceType,
      data.amount,
      data.status,
      data.earnedAt,
      data.claimedAt,
      data.expiresAt,
      data.sourceId,
      data.metadata as Record<string, unknown> | null,
      data.transactionId,
      data.createdAt,
      data.updatedAt
    );
  }

  async create(data: CreateRewardClaimDTO): Promise<RewardClaim> {
    try {
      const rewardClaim = await this.prisma.rewardClaim.create({
        data: {
          userId: data.userId,
          rewardType: data.rewardType,
          sourceType: data.sourceType,
          amount: data.amount,
          sourceId: data.sourceId || null,
          metadata: data.metadata || null,
          expiresAt: data.expiresAt || null,
          status: RewardClaimStatus.PENDING,
        },
      });

      return this.mapToEntity(rewardClaim);
    } catch (error) {
      logger.error('Error creating reward claim:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<RewardClaim | null> {
    try {
      const rewardClaim = await this.prisma.rewardClaim.findUnique({
        where: { id },
      });

      return rewardClaim ? this.mapToEntity(rewardClaim) : null;
    } catch (error) {
      logger.error(`Error finding reward claim ${id}:`, error);
      throw error;
    }
  }

  async findByUserId(userId: string, filters?: RewardClaimFilters): Promise<RewardClaim[]> {
    try {
      const where: Prisma.RewardClaimWhereInput = { userId };

      if (filters) {
        if (filters.status) {
          where.status = filters.status;
        }
        if (filters.rewardType) {
          where.rewardType = filters.rewardType;
        }
        if (filters.sourceType) {
          where.sourceType = filters.sourceType;
        }
        if (filters.earnedAfter || filters.earnedBefore) {
          where.earnedAt = {};
          if (filters.earnedAfter) {
            where.earnedAt.gte = filters.earnedAfter;
          }
          if (filters.earnedBefore) {
            where.earnedAt.lte = filters.earnedBefore;
          }
        }
        if (filters.claimable) {
          where.status = RewardClaimStatus.PENDING;
          where.OR = [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ];
        }
      }

      const rewardClaims = await this.prisma.rewardClaim.findMany({
        where,
        orderBy: { earnedAt: 'desc' },
      });

      return rewardClaims.map((rc) => this.mapToEntity(rc));
    } catch (error) {
      logger.error(`Error finding reward claims for user ${userId}:`, error);
      throw error;
    }
  }

  async findPendingByUserId(userId: string): Promise<RewardClaim[]> {
    return this.findByUserId(userId, { status: RewardClaimStatus.PENDING });
  }

  async findClaimableByUserId(userId: string): Promise<RewardClaim[]> {
    return this.findByUserId(userId, { claimable: true });
  }

  async update(id: string, data: UpdateRewardClaimDTO): Promise<RewardClaim | null> {
    try {
      const rewardClaim = await this.prisma.rewardClaim.update({
        where: { id },
        data,
      });

      return this.mapToEntity(rewardClaim);
    } catch (error) {
      logger.error(`Error updating reward claim ${id}:`, error);
      return null;
    }
  }

  async markAsClaimed(id: string, transactionId: string): Promise<RewardClaim | null> {
    return this.update(id, {
      status: RewardClaimStatus.CLAIMED,
      claimedAt: new Date(),
      transactionId,
    });
  }

  async markAsExpired(id: string): Promise<RewardClaim | null> {
    return this.update(id, {
      status: RewardClaimStatus.EXPIRED,
    });
  }

  async findExpiredClaims(): Promise<RewardClaim[]> {
    try {
      const rewardClaims = await this.prisma.rewardClaim.findMany({
        where: {
          status: RewardClaimStatus.PENDING,
          expiresAt: {
            lte: new Date(),
          },
        },
      });

      return rewardClaims.map((rc) => this.mapToEntity(rc));
    } catch (error) {
      logger.error('Error finding expired claims:', error);
      throw error;
    }
  }

  async getTotalClaimableAmount(userId: string): Promise<number> {
    try {
      const result = await this.prisma.rewardClaim.aggregate({
        where: {
          userId,
          status: RewardClaimStatus.PENDING,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        _sum: {
          amount: true,
        },
      });

      return result._sum.amount || 0;
    } catch (error) {
      logger.error(`Error calculating total claimable amount for user ${userId}:`, error);
      throw error;
    }
  }

  async getClaimsBySourceType(userId: string, sourceType: RewardSourceType): Promise<RewardClaim[]> {
    return this.findByUserId(userId, { sourceType });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.rewardClaim.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      logger.error(`Error deleting reward claim ${id}:`, error);
      return false;
    }
  }
}
