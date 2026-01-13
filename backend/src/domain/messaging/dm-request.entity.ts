import { DMRequestStatus } from './dm-request-status.enum';
import { SupportType } from './support-type.enum';

export class DMRequest {
  constructor(
    public readonly id: string,
    public readonly fromUserId: string,
    public readonly toUserId: string,
    public readonly status: DMRequestStatus,
    public readonly type: SupportType,
    public readonly amount: number,
    public readonly description: string | null,
    public readonly threadId: string | null,
    public readonly fromUserRating: number | null,
    public readonly toUserRating: number | null,
    public readonly closedByFromUserAt: Date | null,
    public readonly closedByToUserAt: Date | null,
    public readonly sentAt: Date,
    public readonly respondedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToSender(userId: string): boolean {
    return this.fromUserId === userId;
  }

  belongsToReceiver(userId: string): boolean {
    return this.toUserId === userId;
  }

  involveUser(userId: string): boolean {
    return this.belongsToSender(userId) || this.belongsToReceiver(userId);
  }

  isPending(): boolean {
    return this.status === DMRequestStatus.PENDING;
  }

  isAccepted(): boolean {
    return this.status === DMRequestStatus.ACCEPTED;
  }

  isDeclined(): boolean {
    return this.status === DMRequestStatus.DECLINED;
  }

  isCanceled(): boolean {
    return this.status === DMRequestStatus.CANCELED;
  }

  isAwaitingCompletion(): boolean {
    return this.status === DMRequestStatus.AWAITING_COMPLETION;
  }

  isCompleted(): boolean {
    return this.status === DMRequestStatus.COMPLETED;
  }

  isReported(): boolean {
    return this.status === DMRequestStatus.REPORTED;
  }

  isClosedByUser(userId: string): boolean {
    if (this.belongsToSender(userId)) {
      return this.closedByFromUserAt !== null;
    }
    if (this.belongsToReceiver(userId)) {
      return this.closedByToUserAt !== null;
    }
    return false;
  }

  hasBothUsersClosed(): boolean {
    return this.closedByFromUserAt !== null && this.closedByToUserAt !== null;
  }

  hasBeenResponded(): boolean {
    return this.respondedAt !== null;
  }

  getDaysSinceSent(): number {
    return Math.floor((Date.now() - this.sentAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  getDaysSinceResponded(): number | null {
    if (!this.hasBeenResponded()) return null;
    return Math.floor((Date.now() - this.respondedAt!.getTime()) / (1000 * 60 * 60 * 24));
  }

  isRecentRequest(): boolean {
    return this.getDaysSinceSent() <= 7;
  }

  isExpiredRequest(): boolean {
    // Requests could expire after 30 days if not responded
    return this.isPending() && this.getDaysSinceSent() >= 30;
  }

  getStatusDisplayName(): string {
    switch (this.status) {
      case DMRequestStatus.PENDING: return 'Beklemede';
      case DMRequestStatus.ACCEPTED: return 'Kabul Edildi';
      case DMRequestStatus.DECLINED: return 'Reddedildi';
      case DMRequestStatus.CANCELED: return 'İptal Edildi';
      case DMRequestStatus.AWAITING_COMPLETION: return 'Tamamlanmayı Bekliyor';
      case DMRequestStatus.COMPLETED: return 'Tamamlandı';
      case DMRequestStatus.REPORTED: return 'Raporlandı';
      default: return 'Bilinmeyen';
    }
  }

  getStatusColor(): string {
    switch (this.status) {
      case DMRequestStatus.PENDING: return '#f59e0b';    // Yellow
      case DMRequestStatus.ACCEPTED: return '#22c55e';   // Green
      case DMRequestStatus.DECLINED: return '#ef4444';   // Red
      case DMRequestStatus.CANCELED: return '#ef4444';   // Red (same as declined)
      case DMRequestStatus.AWAITING_COMPLETION: return '#3b82f6'; // Blue
      case DMRequestStatus.COMPLETED: return '#10b981';  // Emerald green
      case DMRequestStatus.REPORTED: return '#dc2626';  // Dark red
      default: return '#6b7280'; // Gray
    }
  }

  getStatusIcon(): string {
    switch (this.status) {
      case DMRequestStatus.PENDING: return '⏳';
      case DMRequestStatus.ACCEPTED: return '✅';
      case DMRequestStatus.DECLINED: return '❌';
      case DMRequestStatus.CANCELED: return '🚫';
      case DMRequestStatus.AWAITING_COMPLETION: return '⏰';
      case DMRequestStatus.COMPLETED: return '🎉';
      case DMRequestStatus.REPORTED: return '🚩';
      default: return '❓';
    }
  }

  canBeResponded(): boolean {
    return this.isPending() && !this.isExpiredRequest();
  }

  canBeAccepted(): boolean {
    return this.canBeResponded();
  }

  canBeDeclined(): boolean {
    return this.canBeResponded();
  }

  getResponseTime(): number | null {
    if (!this.hasBeenResponded()) return null;
    return this.respondedAt!.getTime() - this.sentAt.getTime();
  }

  getResponseTimeHours(): number | null {
    const responseTime = this.getResponseTime();
    if (responseTime === null) return null;
    return Math.floor(responseTime / (1000 * 60 * 60));
  }

  isQuickResponse(): boolean {
    const responseTimeHours = this.getResponseTimeHours();
    return responseTimeHours !== null && responseTimeHours <= 24;
  }

  getRequestPriority(): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
    const days = this.getDaysSinceSent();
    if (this.isPending()) {
      if (days >= 7) return 'URGENT';
      if (days >= 3) return 'HIGH';
      if (days >= 1) return 'MEDIUM';
      return 'LOW';
    }
    return 'LOW';
  }
}