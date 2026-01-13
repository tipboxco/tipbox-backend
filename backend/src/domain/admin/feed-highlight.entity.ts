import { FeedHighlightReason } from './feed-highlight-reason.enum';

export class FeedHighlight {
  constructor(
    public readonly id: string,
    public readonly postId: number,
    public readonly reason: FeedHighlightReason,
    public readonly highlightedAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToPost(postId: number): boolean {
    return this.postId === postId;
  }

  isMostLiked(): boolean {
    return this.reason === FeedHighlightReason.MOST_LIKED;
  }

  isStaffPick(): boolean {
    return this.reason === FeedHighlightReason.STAFF_PICK;
  }

  isBoosted(): boolean {
    return this.reason === FeedHighlightReason.BOOSTED;
  }

  getReasonDisplayName(): string {
    switch (this.reason) {
      case FeedHighlightReason.MOST_LIKED: return 'En Çok Beğenilen';
      case FeedHighlightReason.STAFF_PICK: return 'Editör Seçimi';
      case FeedHighlightReason.BOOSTED: return 'Öne Çıkarılan';
    }
  }

  getReasonIcon(): string {
    switch (this.reason) {
      case FeedHighlightReason.MOST_LIKED: return '❤️';
      case FeedHighlightReason.STAFF_PICK: return '⭐';
      case FeedHighlightReason.BOOSTED: return '🚀';
    }
  }

  getReasonColor(): string {
    switch (this.reason) {
      case FeedHighlightReason.MOST_LIKED: return '#ef4444';   // Red
      case FeedHighlightReason.STAFF_PICK: return '#f59e0b';   // Yellow
      case FeedHighlightReason.BOOSTED: return '#8b5cf6';     // Purple
    }
  }

  getDaysSinceHighlighted(): number {
    return Math.floor((Date.now() - this.highlightedAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  isRecentHighlight(): boolean {
    return this.getDaysSinceHighlighted() <= 7;
  }

  isActiveHighlight(): boolean {
    // Highlights might have expiry logic
    return this.getDaysSinceHighlighted() <= 30;
  }

  getHighlightPriority(): 'LOW' | 'MEDIUM' | 'HIGH' | 'PREMIUM' {
    if (this.isStaffPick()) return 'PREMIUM';
    if (this.isBoosted()) return 'HIGH';
    if (this.isMostLiked()) return 'MEDIUM';
    return 'LOW';
  }

  getHighlightPriorityDisplayName(): string {
    switch (this.getHighlightPriority()) {
      case 'LOW': return 'Düşük';
      case 'MEDIUM': return 'Orta';
      case 'HIGH': return 'Yüksek';
      case 'PREMIUM': return 'Premium';
    }
  }

  shouldShowBadge(): boolean {
    return this.isActiveHighlight();
  }

  getTimeAgo(): string {
    const days = this.getDaysSinceHighlighted();
    
    if (days === 0) return 'Bugün';
    if (days === 1) return 'Dün';
    if (days < 7) return `${days} gün önce`;
    if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
    return `${Math.floor(days / 30)} ay önce`;
  }
}