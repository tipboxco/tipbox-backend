import { LeaderboardPeriod } from './leaderboard-period.enum';

export class BridgeLeaderboard {
  constructor(
    public readonly id: number,
    public readonly brandId: number,
    public readonly userId: number,
    public readonly period: LeaderboardPeriod,
    public readonly rank: number,
    public readonly score: number,
    public readonly recordedAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToBrand(brandId: number): boolean {
    return this.brandId === brandId;
  }

  belongsToUser(userId: number): boolean {
    return this.userId === userId;
  }

  getRank(): number {
    return this.rank;
  }

  getScore(): number {
    return this.score;
  }

  isWeeklyLeaderboard(): boolean {
    return this.period === LeaderboardPeriod.WEEKLY;
  }

  isMonthlyLeaderboard(): boolean {
    return this.period === LeaderboardPeriod.MONTHLY;
  }

  getPeriodDisplayName(): string {
    return this.isWeeklyLeaderboard() ? 'Haftalık' : 'Aylık';
  }

  isTopRank(): boolean {
    return this.rank <= 3;
  }

  isFirstPlace(): boolean {
    return this.rank === 1;
  }

  isTopTen(): boolean {
    return this.rank <= 10;
  }

  getRankDisplayName(): string {
    if (this.rank === 1) return '🥇 1. Sıra';
    if (this.rank === 2) return '🥈 2. Sıra';
    if (this.rank === 3) return '🥉 3. Sıra';
    return `${this.rank}. Sıra`;
  }

  getRankIcon(): string {
    if (this.rank === 1) return '🥇';
    if (this.rank === 2) return '🥈';
    if (this.rank === 3) return '🥉';
    if (this.rank <= 10) return '🏆';
    return '📊';
  }

  getRankColor(): string {
    if (this.rank === 1) return '#ffd700';     // Gold
    if (this.rank === 2) return '#c0c0c0';     // Silver
    if (this.rank === 3) return '#cd7f32';     // Bronze
    if (this.rank <= 10) return '#3b82f6';     // Blue
    return '#6b7280';                           // Gray
  }

  isRecentRecord(): boolean {
    const daysSinceRecord = Math.floor(
      (Date.now() - this.recordedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceRecord <= 7;
  }

  getFormattedScore(): string {
    if (this.score >= 1000000) return `${(this.score / 1000000).toFixed(1)}M`;
    if (this.score >= 1000) return `${(this.score / 1000).toFixed(1)}K`;
    return this.score.toString();
  }

  getPerformanceLevel(): 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'BELOW_AVERAGE' {
    if (this.rank <= 3) return 'EXCELLENT';
    if (this.rank <= 10) return 'GOOD';
    if (this.rank <= 50) return 'AVERAGE';
    return 'BELOW_AVERAGE';
  }
}