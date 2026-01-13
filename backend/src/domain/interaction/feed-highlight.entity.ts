export enum FeedHighlightReason {
  MOST_LIKED = 'MOST_LIKED',
  STAFF_PICK = 'STAFF_PICK',
  BOOSTED = 'BOOSTED'
}

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
      case FeedHighlightReason.BOOSTED: return '📌';
    }
  }

  getReasonColor(): string {
    switch (this.reason) {
      case FeedHighlightReason.MOST_LIKED: return '#ef4444';  // Red
      case FeedHighlightReason.STAFF_PICK: return '#f59e0b';  // Yellow
      case FeedHighlightReason.BOOSTED: return '#3b82f6';     // Blue
    }
  }

  isRecentlyHighlighted(): boolean {
    const daysSinceHighlighted = Math.floor(
      (Date.now() - this.highlightedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceHighlighted <= 7; // Within last week
  }

  getPriority(): number {
    switch (this.reason) {
      case FeedHighlightReason.STAFF_PICK: return 10;  // Highest priority
      case FeedHighlightReason.BOOSTED: return 8;
      case FeedHighlightReason.MOST_LIKED: return 6;
    }
  }

  isHighPriority(): boolean {
    return this.getPriority() >= 8;
  }
}