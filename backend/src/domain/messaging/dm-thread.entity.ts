export class DMThread {
  constructor(
    public readonly id: string,
    public readonly userOneId: string,
    public readonly userTwoId: string,
    public readonly isActive: boolean,
    public readonly isSupportThread: boolean,
    public readonly startedAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToUser(userId: string): boolean {
    return this.userOneId === userId || this.userTwoId === userId;
  }

  getOtherUserId(currentUserId: string): string {
    return this.userOneId === currentUserId ? this.userTwoId : this.userOneId;
  }

  isActiveThread(): boolean {
    return this.isActive;
  }

  isThreadBetweenUsers(userId1: string, userId2: string): boolean {
    return (
      (this.userOneId === userId1 && this.userTwoId === userId2) ||
      (this.userOneId === userId2 && this.userTwoId === userId1)
    );
  }

  getDaysSinceStarted(): number {
    return Math.floor((Date.now() - this.startedAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  isRecentThread(): boolean {
    return this.getDaysSinceStarted() <= 7;
  }

  isLongRunningThread(): boolean {
    return this.getDaysSinceStarted() >= 30;
  }

  getThreadAgeCategory(): 'NEW' | 'RECENT' | 'ESTABLISHED' | 'OLD' {
    const days = this.getDaysSinceStarted();
    if (days <= 1) return 'NEW';
    if (days <= 7) return 'RECENT';
    if (days <= 30) return 'ESTABLISHED';
    return 'OLD';
  }

  getThreadAgeCategoryDisplayName(): string {
    switch (this.getThreadAgeCategory()) {
      case 'NEW': return 'Yeni Konuşma';
      case 'RECENT': return 'Son Konuşma';
      case 'ESTABLISHED': return 'Devam Eden';
      case 'OLD': return 'Eski Konuşma';
    }
  }

  getThreadStatus(): 'ACTIVE' | 'INACTIVE' {
    return this.isActive ? 'ACTIVE' : 'INACTIVE';
  }

  getThreadStatusColor(): string {
    return this.isActive ? '#22c55e' : '#6b7280'; // Green : Gray
  }

  canReceiveMessages(): boolean {
    return this.isActive;
  }

  isSupportContext(): boolean {
    return this.isSupportThread;
  }
}