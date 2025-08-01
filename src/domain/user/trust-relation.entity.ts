export class TrustRelation {
  constructor(
    public readonly id: number,
    public readonly trusterId: number,
    public readonly trustedUserId: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Business logic methods
  isMutualTrust(otherRelation: TrustRelation): boolean {
    return this.trusterId === otherRelation.trustedUserId && 
           this.trustedUserId === otherRelation.trusterId;
  }

  getDurationDays(): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this.createdAt.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  isRecentTrust(): boolean {
    return this.getDurationDays() <= 7; // Trust within last week
  }

  isLongTermTrust(): boolean {
    return this.getDurationDays() >= 90; // Trust for more than 3 months
  }
}