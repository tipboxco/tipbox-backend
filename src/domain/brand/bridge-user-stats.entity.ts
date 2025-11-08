export class BridgeUserStats {
  constructor(
    public readonly id: string,
    public readonly userId: number,
    public readonly brandId: number,
    public readonly commentsCount: number,
    public readonly surveysParticipated: number,
    public readonly trustScore: number,
    public readonly lastInteractionAt: Date | null,
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

  getCommentsCount(): number {
    return this.commentsCount;
  }

  getSurveysParticipated(): number {
    return this.surveysParticipated;
  }

  getTrustScore(): number {
    return this.trustScore;
  }

  hasInteracted(): boolean {
    return this.lastInteractionAt !== null;
  }

  isActiveUser(): boolean {
    return this.commentsCount > 0 || this.surveysParticipated > 0;
  }

  isHighlyActive(): boolean {
    return this.commentsCount >= 10 || this.surveysParticipated >= 5;
  }

  getTrustLevel(): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXCELLENT' {
    if (this.trustScore >= 9) return 'EXCELLENT';
    if (this.trustScore >= 7) return 'HIGH';
    if (this.trustScore >= 5) return 'MEDIUM';
    return 'LOW';
  }

  getTrustLevelDisplayName(): string {
    switch (this.getTrustLevel()) {
      case 'LOW': return 'Düşük';
      case 'MEDIUM': return 'Orta';
      case 'HIGH': return 'Yüksek';
      case 'EXCELLENT': return 'Mükemmel';
    }
  }

  getTrustLevelColor(): string {
    switch (this.getTrustLevel()) {
      case 'LOW': return '#ef4444';       // Red
      case 'MEDIUM': return '#f59e0b';    // Yellow
      case 'HIGH': return '#3b82f6';      // Blue
      case 'EXCELLENT': return '#22c55e'; // Green
    }
  }

  getDaysSinceLastInteraction(): number | null {
    if (!this.lastInteractionAt) return null;
    return Math.floor((Date.now() - this.lastInteractionAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  isRecentlyActive(): boolean {
    const days = this.getDaysSinceLastInteraction();
    return days !== null && days <= 7;
  }

  getEngagementScore(): number {
    let score = 0;
    score += Math.min(this.commentsCount * 2, 20); // Max 20 points from comments
    score += Math.min(this.surveysParticipated * 5, 25); // Max 25 points from surveys
    score += Math.min(this.trustScore * 5, 50); // Max 50 points from trust
    
    // Bonus for recent activity
    if (this.isRecentlyActive()) score += 5;
    
    return Math.min(score, 100);
  }

  getEngagementLevel(): 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' {
    const score = this.getEngagementScore();
    if (score >= 80) return 'VERY_HIGH';
    if (score >= 60) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
  }
}