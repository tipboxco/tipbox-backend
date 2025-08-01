import { ModerationActionType } from './moderation-action-type.enum';

export class ModerationAction {
  constructor(
    public readonly id: number,
    public readonly moderatorId: number,
    public readonly targetUserId: number,
    public readonly reason: string,
    public readonly actionType: ModerationActionType,
    public readonly contentType: string | null,
    public readonly contentId: number | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToModerator(moderatorId: number): boolean {
    return this.moderatorId === moderatorId;
  }

  belongsToTargetUser(userId: number): boolean {
    return this.targetUserId === userId;
  }

  getReason(): string {
    return this.reason;
  }

  hasContent(): boolean {
    return this.contentType !== null && this.contentId !== null;
  }

  getContentType(): string {
    return this.contentType ?? 'Genel';
  }

  getContentId(): number | null {
    return this.contentId;
  }

  isBan(): boolean {
    return this.actionType === ModerationActionType.BAN;
  }

  isWarn(): boolean {
    return this.actionType === ModerationActionType.WARN;
  }

  isMute(): boolean {
    return this.actionType === ModerationActionType.MUTE;
  }

  isContentRemoved(): boolean {
    return this.actionType === ModerationActionType.CONTENT_REMOVED;
  }

  getActionTypeDisplayName(): string {
    switch (this.actionType) {
      case ModerationActionType.BAN: return 'Yasaklama';
      case ModerationActionType.WARN: return 'Uyarı';
      case ModerationActionType.MUTE: return 'Susturma';
      case ModerationActionType.CONTENT_REMOVED: return 'İçerik Kaldırma';
    }
  }

  getActionIcon(): string {
    switch (this.actionType) {
      case ModerationActionType.BAN: return '🚫';
      case ModerationActionType.WARN: return '⚠️';
      case ModerationActionType.MUTE: return '🔇';
      case ModerationActionType.CONTENT_REMOVED: return '🗑️';
    }
  }

  getActionColor(): string {
    switch (this.actionType) {
      case ModerationActionType.BAN: return '#dc2626';        // Dark Red
      case ModerationActionType.WARN: return '#f59e0b';       // Orange
      case ModerationActionType.MUTE: return '#6b7280';       // Gray
      case ModerationActionType.CONTENT_REMOVED: return '#ef4444'; // Red
    }
  }

  getSeverityLevel(): 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE' {
    switch (this.actionType) {
      case ModerationActionType.BAN: return 'SEVERE';
      case ModerationActionType.CONTENT_REMOVED: return 'HIGH';
      case ModerationActionType.MUTE: return 'MEDIUM';
      case ModerationActionType.WARN: return 'LOW';
    }
  }

  getSeverityLevelDisplayName(): string {
    switch (this.getSeverityLevel()) {
      case 'LOW': return 'Düşük';
      case 'MEDIUM': return 'Orta';
      case 'HIGH': return 'Yüksek';
      case 'SEVERE': return 'Ciddi';
    }
  }

  getDaysSinceAction(): number {
    return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  isRecentAction(): boolean {
    return this.getDaysSinceAction() <= 7;
  }

  isValidAction(): boolean {
    return this.reason.trim().length > 0;
  }

  getContentDisplayName(): string {
    if (!this.hasContent()) return 'Genel';
    
    switch (this.contentType?.toLowerCase()) {
      case 'post': return 'Gönderi';
      case 'comment': return 'Yorum';
      case 'message': return 'Mesaj';
      case 'profile': return 'Profil';
      default: return this.contentType ?? 'Bilinmiyor';
    }
  }

  generateActionSummary(): string {
    const contentInfo = this.hasContent() 
      ? ` (${this.getContentDisplayName()} #${this.contentId})`
      : '';
    return `${this.getActionTypeDisplayName()}${contentInfo}: ${this.reason}`;
  }

  getTimeAgo(): string {
    const days = this.getDaysSinceAction();
    
    if (days === 0) return 'Bugün';
    if (days === 1) return 'Dün';
    if (days < 7) return `${days} gün önce`;
    if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
    if (days < 365) return `${Math.floor(days / 30)} ay önce`;
    return `${Math.floor(days / 365)} yıl önce`;
  }

  isAppealable(): boolean {
    // Users can appeal bans and content removals
    return this.isBan() || this.isContentRemoved();
  }

  getAppealDeadlineDays(): number | null {
    if (!this.isAppealable()) return null;
    return 30; // 30 days to appeal
  }

  canStillAppeal(): boolean {
    if (!this.isAppealable()) return false;
    const deadlineDays = this.getAppealDeadlineDays();
    if (deadlineDays === null) return false;
    return this.getDaysSinceAction() <= deadlineDays;
  }
}