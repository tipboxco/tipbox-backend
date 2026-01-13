export class WishboxStats {
  constructor(
    public readonly id: string,
    public readonly userId: number,
    public readonly eventId: number,
    public readonly totalParticipated: number,
    public readonly totalComments: number,
    public readonly helpfulVotesReceived: number,
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

  getTotalParticipated(): number {
    return this.totalParticipated;
  }

  getTotalComments(): number {
    return this.totalComments;
  }

  getHelpfulVotesReceived(): number {
    return this.helpfulVotesReceived;
  }

  hasParticipated(): boolean {
    return this.totalParticipated > 0;
  }

  isActiveParticipant(): boolean {
    return this.totalParticipated >= 3 || this.totalComments >= 5;
  }

  isHighlyEngaged(): boolean {
    return this.totalParticipated >= 5 && this.totalComments >= 10 && this.helpfulVotesReceived >= 5;
  }

  getEngagementLevel(): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXPERT' {
    if (this.isHighlyEngaged()) return 'EXPERT';
    if (this.isActiveParticipant()) return 'HIGH';
    if (this.hasParticipated()) return 'MEDIUM';
    return 'LOW';
  }

  getEngagementLevelDisplayName(): string {
    switch (this.getEngagementLevel()) {
      case 'LOW': return 'Düşük Katılım';
      case 'MEDIUM': return 'Orta Katılım';
      case 'HIGH': return 'Yüksek Katılım';
      case 'EXPERT': return 'Uzman Katılımcı';
    }
  }

  getEngagementScore(): number {
    // Simple scoring algorithm
    let score = 0;
    score += this.totalParticipated * 10; // 10 points per participation
    score += this.totalComments * 5;      // 5 points per comment
    score += this.helpfulVotesReceived * 3; // 3 points per helpful vote
    return score;
  }

  getEngagementIcon(): string {
    switch (this.getEngagementLevel()) {
      case 'LOW': return '😐';
      case 'MEDIUM': return '🙂';
      case 'HIGH': return '😊';
      case 'EXPERT': return '🌟';
    }
  }

  getParticipationRate(): number {
    // This would need total available scenarios to calculate properly
    // For now, return a simple metric
    return Math.min(this.totalParticipated * 20, 100); // Assume 5 scenarios max
  }

  isInfluentialParticipant(): boolean {
    return this.helpfulVotesReceived >= 10;
  }

  getCommentsPerParticipation(): number {
    if (this.totalParticipated === 0) return 0;
    return Math.round((this.totalComments / this.totalParticipated) * 10) / 10;
  }
}