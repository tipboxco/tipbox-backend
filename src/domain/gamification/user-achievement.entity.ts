export class UserAchievement {
  constructor(
    public readonly id: string,
    public readonly userId: number,
    public readonly goalId: number,
    public readonly progress: number,
    public readonly completed: boolean,
    public readonly completedAt: Date | null
  ) {}

  // Essential business methods only
  belongsToUser(userId: number): boolean {
    return this.userId === userId;
  }

  belongsToGoal(goalId: number): boolean {
    return this.goalId === goalId;
  }

  getProgress(): number {
    return this.progress;
  }

  isCompleted(): boolean {
    return this.completed && this.completedAt !== null;
  }

  isInProgress(): boolean {
    return !this.completed && this.progress > 0;
  }

  isNotStarted(): boolean {
    return this.progress === 0 && !this.completed;
  }

  getCompletionPercentage(requiredPoints: number): number {
    if (requiredPoints === 0) return 100;
    return Math.min(100, (this.progress / requiredPoints) * 100);
  }

  isNearCompletion(requiredPoints: number): boolean {
    return this.getCompletionPercentage(requiredPoints) >= 80;
  }

  getRemainingProgress(requiredPoints: number): number {
    return Math.max(0, requiredPoints - this.progress);
  }

  canBeCompleted(requiredPoints: number): boolean {
    return this.progress >= requiredPoints && !this.completed;
  }

  getDaysSinceCompletion(): number | null {
    if (!this.completedAt) return null;
    return Math.floor((Date.now() - this.completedAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  isRecentlyCompleted(): boolean {
    const days = this.getDaysSinceCompletion();
    return days !== null && days <= 7;
  }

  getProgressStatus(): 'NOT_STARTED' | 'IN_PROGRESS' | 'NEAR_COMPLETION' | 'COMPLETED' {
    if (this.isCompleted()) return 'COMPLETED';
    if (this.isNotStarted()) return 'NOT_STARTED';
    // Need requiredPoints to determine near completion, so just return in progress
    return 'IN_PROGRESS';
  }
}