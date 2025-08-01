export enum TrendPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY'
}

export class TrendingPost {
  constructor(
    public readonly id: number,
    public readonly postId: number,
    public readonly score: number,
    public readonly trendPeriod: TrendPeriod,
    public readonly calculatedAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToPost(postId: number): boolean {
    return this.postId === postId;
  }

  getScore(): number {
    return this.score;
  }

  isDailyTrend(): boolean {
    return this.trendPeriod === TrendPeriod.DAILY;
  }

  isWeeklyTrend(): boolean {
    return this.trendPeriod === TrendPeriod.WEEKLY;
  }

  getTrendPeriodDisplayName(): string {
    return this.isDailyTrend() ? 'Günlük' : 'Haftalık';
  }

  isHighScore(): boolean {
    return this.score >= 100;
  }

  isRecentCalculation(): boolean {
    const hoursSinceCalculation = Math.floor(
      (Date.now() - this.calculatedAt.getTime()) / (1000 * 60 * 60)
    );
    return hoursSinceCalculation <= 24; // Within last day
  }

  getTrendLevel(): 'LOW' | 'MEDIUM' | 'HIGH' | 'VIRAL' {
    if (this.score >= 1000) return 'VIRAL';
    if (this.score >= 500) return 'HIGH';
    if (this.score >= 100) return 'MEDIUM';
    return 'LOW';
  }

  getTrendIcon(): string {
    switch (this.getTrendLevel()) {
      case 'VIRAL': return '🚀';
      case 'HIGH': return '🔥';
      case 'MEDIUM': return '📈';
      case 'LOW': return '👀';
    }
  }

  getScoreFormatted(): string {
    if (this.score >= 1000000) return `${(this.score / 1000000).toFixed(1)}M`;
    if (this.score >= 1000) return `${(this.score / 1000).toFixed(1)}K`;
    return this.score.toString();
  }
}