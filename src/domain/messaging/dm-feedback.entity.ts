export class DMFeedback {
  constructor(
    public readonly id: number,
    public readonly sessionId: number,
    public readonly rating: number,
    public readonly comment: string | null,
    public readonly submittedAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToSession(sessionId: number): boolean {
    return this.sessionId === sessionId;
  }

  getRating(): number {
    return this.rating;
  }

  getComment(): string {
    return this.comment ?? 'Yorum eklenmemiş.';
  }

  hasComment(): boolean {
    return this.comment !== null && this.comment.trim().length > 0;
  }

  isPositiveFeedback(): boolean {
    return this.rating >= 4;
  }

  isNeutralFeedback(): boolean {
    return this.rating === 3;
  }

  isNegativeFeedback(): boolean {
    return this.rating <= 2;
  }

  isExcellentFeedback(): boolean {
    return this.rating === 5;
  }

  getRatingDisplayName(): string {
    switch (this.rating) {
      case 1: return 'Çok Kötü';
      case 2: return 'Kötü';
      case 3: return 'Orta';
      case 4: return 'İyi';
      case 5: return 'Mükemmel';
      default: return 'Bilinmiyor';
    }
  }

  getRatingIcon(): string {
    switch (this.rating) {
      case 1: return '😞';
      case 2: return '😐';
      case 3: return '🙂';
      case 4: return '😊';
      case 5: return '🤩';
      default: return '❓';
    }
  }

  getRatingColor(): string {
    switch (this.rating) {
      case 1: return '#ef4444';      // Red
      case 2: return '#f59e0b';      // Orange
      case 3: return '#6b7280';      // Gray
      case 4: return '#3b82f6';      // Blue
      case 5: return '#22c55e';      // Green
      default: return '#9ca3af';     // Light Gray
    }
  }

  getRatingStars(): string {
    return '⭐'.repeat(this.rating) + '☆'.repeat(5 - this.rating);
  }

  isRecentFeedback(): boolean {
    const daysSinceFeedback = Math.floor(
      (Date.now() - this.submittedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceFeedback <= 7;
  }

  getDaysSinceFeedback(): number {
    return Math.floor((Date.now() - this.submittedAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  getFeedbackQuality(): 'BASIC' | 'DETAILED' | 'COMPREHENSIVE' {
    if (!this.hasComment()) return 'BASIC';
    const wordCount = this.comment!.split(' ').length;
    if (wordCount >= 20) return 'COMPREHENSIVE';
    if (wordCount >= 5) return 'DETAILED';
    return 'BASIC';
  }

  getFeedbackQualityDisplayName(): string {
    switch (this.getFeedbackQuality()) {
      case 'BASIC': return 'Temel';
      case 'DETAILED': return 'Detaylı';
      case 'COMPREHENSIVE': return 'Kapsamlı';
    }
  }

  isValid(): boolean {
    return this.rating >= 1 && this.rating <= 5;
  }

  getTimeAgo(): string {
    const days = this.getDaysSinceFeedback();
    
    if (days === 0) return 'Bugün';
    if (days === 1) return 'Dün';
    if (days < 7) return `${days} gün önce`;
    if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
    if (days < 365) return `${Math.floor(days / 30)} ay önce`;
    return `${Math.floor(days / 365)} yıl önce`;
  }
}