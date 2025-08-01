import { TrendPeriod } from './trend-period.enum';

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

  getTrendPeriodIcon(): string {
    return this.isDailyTrend() ? '📅' : '📊';
  }

  isHighScore(): boolean {
    return this.score >= 100;
  }

  isViralScore(): boolean {
    return this.score >= 1000;
  }

  getScoreCategory(): 'LOW' | 'MEDIUM' | 'HIGH' | 'VIRAL' {
    if (this.score >= 1000) return 'VIRAL';
    if (this.score >= 100) return 'HIGH';
    if (this.score >= 10) return 'MEDIUM';
    return 'LOW';
  }

  getScoreCategoryDisplayName(): string {
    switch (this.getScoreCategory()) {
      case 'LOW': return 'Düşük Trend';
      case 'MEDIUM': return 'Orta Trend';
      case 'HIGH': return 'Yüksek Trend';
      case 'VIRAL': return 'Viral';
    }
  }

  getScoreCategoryColor(): string {
    switch (this.getScoreCategory()) {
      case 'LOW': return '#9ca3af';       // Gray
      case 'MEDIUM': return '#3b82f6';    // Blue
      case 'HIGH': return '#f59e0b';      // Orange
      case 'VIRAL': return '#ef4444';     // Red
    }
  }

  getScoreCategoryIcon(): string {
    switch (this.getScoreCategory()) {
      case 'LOW': return '📈';
      case 'MEDIUM': return '🔥';
      case 'HIGH': return '💥';
      case 'VIRAL': return '🚀';
    }
  }

  getDaysSinceCalculated(): number {
    return Math.floor((Date.now() - this.calculatedAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  isRecentTrend(): boolean {
    return this.getDaysSinceCalculated() <= 1;
  }

  isActiveTrend(): boolean {
    // Daily trends expire after 1 day, weekly after 7 days
    const maxDays = this.isDailyTrend() ? 1 : 7;
    return this.getDaysSinceCalculated() <= maxDays;
  }

  getFormattedScore(): string {
    if (this.score >= 1000000) return `${(this.score / 1000000).toFixed(1)}M`;
    if (this.score >= 1000) return `${(this.score / 1000).toFixed(1)}K`;
    return this.score.toString();
  }

  getTrendRank(): 'TOP_1' | 'TOP_5' | 'TOP_10' | 'TOP_50' | 'REGULAR' {
    if (this.score >= 10000) return 'TOP_1';
    if (this.score >= 5000) return 'TOP_5';
    if (this.score >= 1000) return 'TOP_10';
    if (this.score >= 100) return 'TOP_50';
    return 'REGULAR';
  }

  getTrendRankDisplayName(): string {
    switch (this.getTrendRank()) {
      case 'TOP_1': return '#1 Trend';
      case 'TOP_5': return 'Top 5';
      case 'TOP_10': return 'Top 10';
      case 'TOP_50': return 'Top 50';
      case 'REGULAR': return 'Trend';
    }
  }

  shouldHighlight(): boolean {
    return this.isViralScore() || this.getTrendRank() === 'TOP_1';
  }
}