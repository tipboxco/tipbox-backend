export class UserTrustScore {
  constructor(
    public readonly id: string,
    public readonly userId: number,
    public readonly score: number,
    public readonly reason: string | null,
    public readonly calculatedAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Business logic methods
  getTrustLevel(): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXCELLENT' {
    if (this.score >= 9) return 'EXCELLENT';
    if (this.score >= 7) return 'HIGH';
    if (this.score >= 5) return 'MEDIUM';
    return 'LOW';
  }

  getTrustLevelColor(): string {
    switch (this.getTrustLevel()) {
      case 'EXCELLENT': return '#22c55e'; // Green
      case 'HIGH': return '#3b82f6';      // Blue
      case 'MEDIUM': return '#f59e0b';    // Yellow
      case 'LOW': return '#ef4444';       // Red
    }
  }

  isHighTrust(): boolean {
    return this.score >= 7;
  }

  isTrusted(): boolean {
    return this.score >= 5;
  }

  isRecentCalculation(): boolean {
    const daysSinceCalculation = Math.floor(
      (Date.now() - this.calculatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCalculation <= 1; // Calculated within last day
  }

  needsRecalculation(): boolean {
    const daysSinceCalculation = Math.floor(
      (Date.now() - this.calculatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCalculation >= 7; // Needs recalculation after a week
  }
}