import { RewardClaimType } from './reward-claim-type.enum';
import { RewardSourceType } from './reward-source-type.enum';
import { RewardClaimStatus } from './reward-claim-status.enum';

export interface RewardMetadata {
  fromUserId?: string;
  fromUserName?: string;
  fromUserAvatar?: string;
  badgeId?: string;
  badgeName?: string;
  achievementId?: string;
  achievementName?: string;
  eventId?: string;
  eventName?: string;
  description?: string;
  [key: string]: any;
}

export class RewardClaim {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly rewardType: RewardClaimType,
    public readonly sourceType: RewardSourceType,
    public readonly amount: number,
    public readonly status: RewardClaimStatus,
    public readonly earnedAt: Date,
    public readonly claimedAt: Date | null,
    public readonly expiresAt: Date | null,
    public readonly sourceId: string | null,
    public readonly metadata: RewardMetadata | null,
    public readonly transactionId: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Status kontrolleri
  isPending(): boolean {
    return this.status === RewardClaimStatus.PENDING;
  }

  isClaimed(): boolean {
    return this.status === RewardClaimStatus.CLAIMED;
  }

  isExpired(): boolean {
    return this.status === RewardClaimStatus.EXPIRED;
  }

  isCancelled(): boolean {
    return this.status === RewardClaimStatus.CANCELLED;
  }

  // Claimable mı kontrol et
  isClaimable(): boolean {
    if (!this.isPending()) {
      return false;
    }

    if (this.expiresAt && new Date() > this.expiresAt) {
      return false;
    }

    return true;
  }

  // Expire olmuş mu kontrol et
  hasExpired(): boolean {
    return this.expiresAt !== null && new Date() > this.expiresAt;
  }

  // Reward tip kontrolü
  isTipsReward(): boolean {
    return this.rewardType === RewardClaimType.TIPS;
  }

  isLadderReward(): boolean {
    return this.sourceType === RewardSourceType.LADDER_REWARD;
  }

  isSupportReward(): boolean {
    return this.sourceType === RewardSourceType.SUPPORT_SESSION;
  }

  isTipsReceivedReward(): boolean {
    return this.sourceType === RewardSourceType.TIPS_RECEIVED;
  }

  // Display helpers
  getRewardTypeDisplay(): string {
    switch (this.rewardType) {
      case RewardClaimType.TIPS:
        return 'Tips';
      case RewardClaimType.BADGE:
        return 'Badge';
      case RewardClaimType.ACHIEVEMENT:
        return 'Achievement';
      case RewardClaimType.LADDER:
        return 'Ladder Reward';
      case RewardClaimType.SUPPORT:
        return 'Support Reward';
      case RewardClaimType.EVENT:
        return 'Event Reward';
      default:
        return 'Unknown';
    }
  }

  getSourceTypeDisplay(): string {
    switch (this.sourceType) {
      case RewardSourceType.LADDER_REWARD:
        return 'Ladder Sıralaması';
      case RewardSourceType.TIPS_RECEIVED:
        return 'Tips Alındı';
      case RewardSourceType.SUPPORT_SESSION:
        return 'Destek Verme';
      case RewardSourceType.BADGE_EARNED:
        return 'Badge Kazanma';
      case RewardSourceType.ACHIEVEMENT_UNLOCKED:
        return 'Başarı Kilidi Açma';
      case RewardSourceType.EVENT_PARTICIPATION:
        return 'Etkinlik Katılımı';
      case RewardSourceType.SYSTEM_GRANT:
        return 'Sistem Hediyesi';
      default:
        return 'Bilinmeyen';
    }
  }

  getAmountFormatted(): string {
    if (this.amount >= 1000000) return `${(this.amount / 1000000).toFixed(1)}M`;
    if (this.amount >= 1000) return `${(this.amount / 1000).toFixed(1)}K`;
    return this.amount.toString();
  }

  getDescription(): string {
    if (this.metadata?.description) {
      return this.metadata.description;
    }

    return this.getSourceTypeDisplay();
  }

  // Reward claim için DTO
  toDTO() {
    return {
      id: this.id,
      userId: this.userId,
      rewardType: this.rewardType,
      sourceType: this.sourceType,
      amount: this.amount,
      status: this.status,
      earnedAt: this.earnedAt.toISOString(),
      claimedAt: this.claimedAt?.toISOString() || null,
      expiresAt: this.expiresAt?.toISOString() || null,
      sourceId: this.sourceId,
      metadata: this.metadata,
      isClaimable: this.isClaimable(),
      rewardTypeDisplay: this.getRewardTypeDisplay(),
      sourceTypeDisplay: this.getSourceTypeDisplay(),
      amountFormatted: this.getAmountFormatted(),
      description: this.getDescription(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
