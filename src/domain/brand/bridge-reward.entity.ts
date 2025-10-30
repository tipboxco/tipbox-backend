export class BridgeReward {
  constructor(
    public readonly id: string,
    public readonly userId: number,
    public readonly brandId: number,
    public readonly badgeId: number,
    public readonly awardedAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToUser(userId: number): boolean {
    return this.userId === userId;
  }

  belongsToBrand(brandId: number): boolean {
    return this.brandId === brandId;
  }

  belongsToBadge(badgeId: number): boolean {
    return this.badgeId === badgeId;
  }

  getDaysSinceAwarded(): number {
    return Math.floor((Date.now() - this.awardedAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  isRecentlyAwarded(): boolean {
    return this.getDaysSinceAwarded() <= 7;
  }

  isSpecialReward(): boolean {
    // Could be determined by badge rarity or special criteria
    return this.isRecentlyAwarded(); // Simple implementation for now
  }

  getAwardedTimeAgo(): string {
    const days = this.getDaysSinceAwarded();
    
    if (days === 0) return 'Bugün';
    if (days === 1) return 'Dün';
    if (days < 7) return `${days} gün önce`;
    if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
    if (days < 365) return `${Math.floor(days / 30)} ay önce`;
    return `${Math.floor(days / 365)} yıl önce`;
  }

  getRewardStatus(): 'NEW' | 'RECENT' | 'OLD' {
    const days = this.getDaysSinceAwarded();
    if (days <= 1) return 'NEW';
    if (days <= 30) return 'RECENT';
    return 'OLD';
  }

  getRewardStatusColor(): string {
    switch (this.getRewardStatus()) {
      case 'NEW': return '#22c55e';      // Green
      case 'RECENT': return '#3b82f6';   // Blue
      case 'OLD': return '#6b7280';      // Gray
    }
  }

  getRewardIcon(): string {
    if (this.isRecentlyAwarded()) return '🆕';
    if (this.isSpecialReward()) return '⭐';
    return '🏆';
  }
}