import { WishboxRewardType } from './wishbox-reward-type.enum';

export class WishboxReward {
  constructor(
    public readonly id: string,
    public readonly userId: number,
    public readonly eventId: number,
    public readonly rewardType: WishboxRewardType,
    public readonly rewardId: number,
    public readonly amount: number | null,
    public readonly awardedAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToUser(userId: number): boolean {
    return this.userId === userId;
  }

  belongsToEvent(eventId: number): boolean {
    return this.eventId === eventId;
  }

  isTipsReward(): boolean {
    return this.rewardType === WishboxRewardType.TIPS;
  }

  isBadgeReward(): boolean {
    return this.rewardType === WishboxRewardType.BADGE;
  }

  isTitleReward(): boolean {
    return this.rewardType === WishboxRewardType.TITLE;
  }

  hasAmount(): boolean {
    return this.amount !== null && this.amount > 0;
  }

  getAmount(): number {
    return this.amount ?? 0;
  }

  getRewardTypeDisplayName(): string {
    switch (this.rewardType) {
      case WishboxRewardType.TIPS: return 'TIPS';
      case WishboxRewardType.BADGE: return 'Rozet';
      case WishboxRewardType.TITLE: return 'Unvan';
    }
  }

  getRewardIcon(): string {
    switch (this.rewardType) {
      case WishboxRewardType.TIPS: return '💰';
      case WishboxRewardType.BADGE: return '🏅';
      case WishboxRewardType.TITLE: return '👑';
    }
  }

  isRecentlyAwarded(): boolean {
    const daysSinceAwarded = Math.floor(
      (Date.now() - this.awardedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceAwarded <= 7;
  }

  getDaysSinceAwarded(): number {
    return Math.floor((Date.now() - this.awardedAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  getFormattedAmount(): string {
    if (!this.hasAmount()) return '';
    
    if (this.isTipsReward()) {
      const amount = this.getAmount();
      if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M TIPS`;
      if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K TIPS`;
      return `${amount} TIPS`;
    }
    
    return this.getAmount().toString();
  }

  getRewardValue(): number {
    if (this.isTipsReward()) return this.getAmount();
    if (this.isBadgeReward()) return 100; // Estimated badge value
    if (this.isTitleReward()) return 50;  // Estimated title value
    return 0;
  }

  getRewardValueCategory(): 'SMALL' | 'MEDIUM' | 'LARGE' | 'EPIC' {
    const value = this.getRewardValue();
    if (value >= 1000) return 'EPIC';
    if (value >= 500) return 'LARGE';
    if (value >= 100) return 'MEDIUM';
    return 'SMALL';
  }

  getRewardValueCategoryDisplayName(): string {
    switch (this.getRewardValueCategory()) {
      case 'SMALL': return 'Küçük Ödül';
      case 'MEDIUM': return 'Orta Ödül';
      case 'LARGE': return 'Büyük Ödül';
      case 'EPIC': return 'Efsane Ödül';
    }
  }

  getTimeAgo(): string {
    const days = this.getDaysSinceAwarded();
    
    if (days === 0) return 'Bugün';
    if (days === 1) return 'Dün';
    if (days < 7) return `${days} gün önce`;
    if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
    if (days < 365) return `${Math.floor(days / 30)} ay önce`;
    return `${Math.floor(days / 365)} yıl önce`;
  }
}