import { AchievementDifficulty } from './achievement-difficulty.enum';

export class AchievementGoal {
  constructor(
    public readonly id: string,
    public readonly chainId: number,
    public readonly title: string,
    public readonly requirement: string,
    public readonly rewardBadgeId: number | null,
    public readonly pointsRequired: number,
    public readonly difficulty: AchievementDifficulty
  ) {}

  // Essential business methods only
  belongsToChain(chainId: number): boolean {
    return this.chainId === chainId;
  }

  getTitle(): string {
    return this.title;
  }

  getRequirement(): string {
    return this.requirement;
  }

  hasRewardBadge(): boolean {
    return this.rewardBadgeId !== null;
  }

  isEasy(): boolean {
    return this.difficulty === AchievementDifficulty.EASY;
  }

  isMedium(): boolean {
    return this.difficulty === AchievementDifficulty.MEDIUM;
  }

  isHard(): boolean {
    return this.difficulty === AchievementDifficulty.HARD;
  }

  getDifficultyDisplayName(): string {
    switch (this.difficulty) {
      case AchievementDifficulty.EASY: return 'Kolay';
      case AchievementDifficulty.MEDIUM: return 'Orta';
      case AchievementDifficulty.HARD: return 'Zor';
    }
  }

  getDifficultyColor(): string {
    switch (this.difficulty) {
      case AchievementDifficulty.EASY: return '#22c55e';   // Green
      case AchievementDifficulty.MEDIUM: return '#f59e0b'; // Yellow
      case AchievementDifficulty.HARD: return '#ef4444';   // Red
    }
  }

  getDifficultyIcon(): string {
    switch (this.difficulty) {
      case AchievementDifficulty.EASY: return '🟢';
      case AchievementDifficulty.MEDIUM: return '🟡';
      case AchievementDifficulty.HARD: return '🔴';
    }
  }

  getPointsRequired(): number {
    return this.pointsRequired;
  }

  calculateCompletionBonus(): number {
    switch (this.difficulty) {
      case AchievementDifficulty.EASY: return 1.0;
      case AchievementDifficulty.MEDIUM: return 1.5;
      case AchievementDifficulty.HARD: return 2.0;
    }
  }
}