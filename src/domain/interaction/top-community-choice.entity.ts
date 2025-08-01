export class TopCommunityChoice {
  constructor(
    public readonly id: number,
    public readonly postId: number,
    public readonly reason: string | null,
    public readonly badgeLabel: string,
    public readonly awardedAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToPost(postId: number): boolean {
    return this.postId === postId;
  }

  getBadgeLabel(): string {
    return this.badgeLabel;
  }

  getReason(): string {
    return this.reason ?? 'Sebep belirtilmemiş';
  }

  hasReason(): boolean {
    return this.reason !== null && this.reason.trim().length > 0;
  }

  isRecentlyAwarded(): boolean {
    const daysSinceAwarded = Math.floor(
      (Date.now() - this.awardedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceAwarded <= 7; // Within last week
  }

  getAwardType(): 'COMMUNITY_CHOICE' | 'STAFF_PICK' | 'TRENDING' | 'OTHER' {
    const label = this.badgeLabel.toLowerCase();
    if (label.includes('community') || label.includes('topluluk')) return 'COMMUNITY_CHOICE';
    if (label.includes('staff') || label.includes('editör')) return 'STAFF_PICK';
    if (label.includes('trending') || label.includes('popüler')) return 'TRENDING';
    return 'OTHER';
  }

  getAwardIcon(): string {
    switch (this.getAwardType()) {
      case 'COMMUNITY_CHOICE': return '👥';
      case 'STAFF_PICK': return '⭐';
      case 'TRENDING': return '🔥';
      case 'OTHER': return '🏆';
    }
  }
}