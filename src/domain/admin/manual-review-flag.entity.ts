import { ManualReviewFlagStatus } from './manual-review-flag-status.enum';

export class ManualReviewFlag {
  constructor(
    public readonly id: string,
    public readonly flaggedByUserId: number,
    public readonly contentType: string,
    public readonly contentId: number,
    public readonly reason: string,
    public readonly status: ManualReviewFlagStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToUser(userId: number): boolean {
    return this.flaggedByUserId === userId;
  }

  belongsToContent(contentType: string, contentId: number): boolean {
    return this.contentType === contentType && this.contentId === contentId;
  }

  getReason(): string {
    return this.reason;
  }

  getContentType(): string {
    return this.contentType;
  }

  getContentId(): number {
    return this.contentId;
  }

  isOpen(): boolean {
    return this.status === ManualReviewFlagStatus.OPEN;
  }

  isInReview(): boolean {
    return this.status === ManualReviewFlagStatus.IN_REVIEW;
  }

  isResolved(): boolean {
    return this.status === ManualReviewFlagStatus.RESOLVED;
  }

  getStatusDisplayName(): string {
    switch (this.status) {
      case ManualReviewFlagStatus.OPEN: return 'Açık';
      case ManualReviewFlagStatus.IN_REVIEW: return 'İnceleniyor';
      case ManualReviewFlagStatus.RESOLVED: return 'Çözüldü';
    }
  }

  getStatusIcon(): string {
    switch (this.status) {
      case ManualReviewFlagStatus.OPEN: return '🚩';
      case ManualReviewFlagStatus.IN_REVIEW: return '👁️';
      case ManualReviewFlagStatus.RESOLVED: return '✅';
    }
  }

  getStatusColor(): string {
    switch (this.status) {
      case ManualReviewFlagStatus.OPEN: return '#ef4444';      // Red
      case ManualReviewFlagStatus.IN_REVIEW: return '#f59e0b'; // Orange
      case ManualReviewFlagStatus.RESOLVED: return '#22c55e';  // Green
    }
  }

  getDaysSinceFlagged(): number {
    return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  isRecentFlag(): boolean {
    return this.getDaysSinceFlagged() <= 1;
  }

  isUrgentFlag(): boolean {
    return this.isOpen() && this.getDaysSinceFlagged() >= 7;
  }

  isOverdueFlag(): boolean {
    return this.isOpen() && this.getDaysSinceFlagged() >= 14;
  }

  getContentDisplayName(): string {
    switch (this.contentType.toLowerCase()) {
      case 'post': return 'Gönderi';
      case 'comment': return 'Yorum';
      case 'message': return 'Mesaj';
      case 'profile': return 'Profil';
      case 'product': return 'Ürün';
      case 'review': return 'İnceleme';
      default: return this.contentType;
    }
  }

  getFlagCategory(): 'SPAM' | 'HARASSMENT' | 'INAPPROPRIATE' | 'COPYRIGHT' | 'OTHER' {
    const reason = this.reason.toLowerCase();
    if (reason.includes('spam') || reason.includes('reklam')) return 'SPAM';
    if (reason.includes('taciz') || reason.includes('hakaret') || reason.includes('saldırı')) return 'HARASSMENT';
    if (reason.includes('uygunsuz') || reason.includes('müstehcen') || reason.includes('yasaklı')) return 'INAPPROPRIATE';
    if (reason.includes('telif') || reason.includes('copyright') || reason.includes('izinsiz')) return 'COPYRIGHT';
    return 'OTHER';
  }

  getFlagCategoryDisplayName(): string {
    switch (this.getFlagCategory()) {
      case 'SPAM': return 'Spam';
      case 'HARASSMENT': return 'Taciz/Hakaret';
      case 'INAPPROPRIATE': return 'Uygunsuz İçerik';
      case 'COPYRIGHT': return 'Telif Hakkı';
      case 'OTHER': return 'Diğer';
    }
  }

  getFlagCategoryIcon(): string {
    switch (this.getFlagCategory()) {
      case 'SPAM': return '📧';
      case 'HARASSMENT': return '🤬';
      case 'INAPPROPRIATE': return '🔞';
      case 'COPYRIGHT': return '©️';
      case 'OTHER': return '❗';
    }
  }

  getPriorityLevel(): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
    if (this.isOverdueFlag()) return 'URGENT';
    if (this.isUrgentFlag()) return 'HIGH';
    if (this.getFlagCategory() === 'HARASSMENT' || this.getFlagCategory() === 'INAPPROPRIATE') return 'HIGH';
    if (this.getFlagCategory() === 'COPYRIGHT') return 'MEDIUM';
    return 'LOW';
  }

  getPriorityLevelDisplayName(): string {
    switch (this.getPriorityLevel()) {
      case 'LOW': return 'Düşük Öncelik';
      case 'MEDIUM': return 'Orta Öncelik';
      case 'HIGH': return 'Yüksek Öncelik';
      case 'URGENT': return 'Acil';
    }
  }

  needsImmediateAttention(): boolean {
    return this.getPriorityLevel() === 'URGENT';
  }

  canBeAssigned(): boolean {
    return this.isOpen();
  }

  canBeResolved(): boolean {
    return this.isOpen() || this.isInReview();
  }

  getTimeAgo(): string {
    const days = this.getDaysSinceFlagged();
    
    if (days === 0) return 'Bugün';
    if (days === 1) return 'Dün';
    if (days < 7) return `${days} gün önce`;
    if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
    if (days < 365) return `${Math.floor(days / 30)} ay önce`;
    return `${Math.floor(days / 365)} yıl önce`;
  }

  generateFlagSummary(): string {
    return `${this.getContentDisplayName()} #${this.contentId} - ${this.getFlagCategoryDisplayName()}: ${this.reason}`;
  }
}