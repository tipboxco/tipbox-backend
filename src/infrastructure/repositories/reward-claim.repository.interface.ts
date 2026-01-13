import { RewardClaim, RewardMetadata } from '../../domain/reward/reward-claim.entity';
import { RewardClaimType } from '../../domain/reward/reward-claim-type.enum';
import { RewardSourceType } from '../../domain/reward/reward-source-type.enum';
import { RewardClaimStatus } from '../../domain/reward/reward-claim-status.enum';

export interface CreateRewardClaimDTO {
  userId: string;
  rewardType: RewardClaimType;
  sourceType: RewardSourceType;
  amount: number;
  sourceId?: string;
  metadata?: RewardMetadata;
  expiresAt?: Date;
}

export interface UpdateRewardClaimDTO {
  status?: RewardClaimStatus;
  claimedAt?: Date;
  transactionId?: string;
}

export interface RewardClaimFilters {
  userId?: string;
  status?: RewardClaimStatus;
  rewardType?: RewardClaimType;
  sourceType?: RewardSourceType;
  earnedAfter?: Date;
  earnedBefore?: Date;
  claimable?: boolean;
}

export interface IRewardClaimRepository {
  create(data: CreateRewardClaimDTO): Promise<RewardClaim>;
  findById(id: string): Promise<RewardClaim | null>;
  findByUserId(userId: string, filters?: RewardClaimFilters): Promise<RewardClaim[]>;
  findPendingByUserId(userId: string): Promise<RewardClaim[]>;
  findClaimableByUserId(userId: string): Promise<RewardClaim[]>;
  update(id: string, data: UpdateRewardClaimDTO): Promise<RewardClaim | null>;
  markAsClaimed(id: string, transactionId: string): Promise<RewardClaim | null>;
  markAsExpired(id: string): Promise<RewardClaim | null>;
  findExpiredClaims(): Promise<RewardClaim[]>;
  getTotalClaimableAmount(userId: string): Promise<number>;
  getClaimsBySourceType(userId: string, sourceType: RewardSourceType): Promise<RewardClaim[]>;
  delete(id: string): Promise<boolean>;
}
