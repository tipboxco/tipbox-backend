import { ExpertRequestStatus } from './expert-request-status.enum';

export class ExpertRequest {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly description: string,
    public readonly category: string | null,
    public readonly tipsAmount: number,
    public readonly status: ExpertRequestStatus,
    public readonly answeredAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Business logic methods
  isPending(): boolean {
    return this.status === ExpertRequestStatus.PENDING;
  }

  isBroadcasting(): boolean {
    return this.status === ExpertRequestStatus.BROADCASTING;
  }

  isExpertFound(): boolean {
    return this.status === ExpertRequestStatus.EXPERT_FOUND;
  }

  isAnswered(): boolean {
    return this.status === ExpertRequestStatus.ANSWERED;
  }

  isClosed(): boolean {
    return this.status === ExpertRequestStatus.CLOSED;
  }

  canBeAnswered(): boolean {
    return (
      this.status === ExpertRequestStatus.PENDING ||
      this.status === ExpertRequestStatus.BROADCASTING ||
      this.status === ExpertRequestStatus.EXPERT_FOUND
    );
  }

  canUpdateTips(): boolean {
    return this.status === ExpertRequestStatus.PENDING;
  }

  belongsToUser(userId: string): boolean {
    return this.userId === userId;
  }

  hasTips(): boolean {
    return this.tipsAmount > 0;
  }
}

