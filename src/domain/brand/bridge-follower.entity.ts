export class BridgeFollower {
  constructor(
    public readonly id: string,
    public readonly userId: number,
    public readonly brandId: number,
    public readonly followedAt: Date,
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

  getDaysSinceFollowed(): number {
    return Math.floor((Date.now() - this.followedAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  isRecentFollower(): boolean {
    return this.getDaysSinceFollowed() <= 7;
  }

  isLongTimeFollower(): boolean {
    return this.getDaysSinceFollowed() >= 365; // 1 year
  }

  getLoyaltyLevel(): 'NEW' | 'REGULAR' | 'LOYAL' | 'VETERAN' {
    const days = this.getDaysSinceFollowed();
    if (days >= 365) return 'VETERAN';
    if (days >= 180) return 'LOYAL';
    if (days >= 30) return 'REGULAR';
    return 'NEW';
  }

  getLoyaltyDisplayName(): string {
    switch (this.getLoyaltyLevel()) {
      case 'NEW': return 'Yeni Takipçi';
      case 'REGULAR': return 'Düzenli Takipçi';
      case 'LOYAL': return 'Sadık Takipçi';
      case 'VETERAN': return 'Eski Takipçi';
    }
  }

  getLoyaltyIcon(): string {
    switch (this.getLoyaltyLevel()) {
      case 'NEW': return '🆕';
      case 'REGULAR': return '👤';
      case 'LOYAL': return '💎';
      case 'VETERAN': return '👑';
    }
  }
}