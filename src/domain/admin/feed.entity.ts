import { FeedSource } from './feed-source.enum';

export class Feed {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly postId: string,
    public readonly source: FeedSource,
    public readonly seen: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToUser(userId: string): boolean {
    return this.userId === userId;
  }

  belongsToPost(postId: string): boolean {
    return this.postId === postId;
  }

  isSeen(): boolean {
    return this.seen;
  }

  isUnseen(): boolean {
    return !this.seen;
  }

  isTrusterFeed(): boolean {
    return this.source === FeedSource.TRUSTER;
  }

  isCategoryMatch(): boolean {
    return this.source === FeedSource.CATEGORY_MATCH;
  }

  isTrendingFeed(): boolean {
    return this.source === FeedSource.TRENDING;
  }

  isNewUserFeed(): boolean {
    return this.source === FeedSource.NEW_USER;
  }

  isBoostedFeed(): boolean {
    return this.source === FeedSource.BOOSTED;
  }

  getSourceDisplayName(): string {
    switch (this.source) {
      case FeedSource.TRUSTER: return 'Güvenilen Kişi';
      case FeedSource.CATEGORY_MATCH: return 'Kategori Eşleşmesi';
      case FeedSource.TRENDING: return 'Trend';
      case FeedSource.NEW_USER: return 'Yeni Kullanıcı';
      case FeedSource.BOOSTED: return 'Öne Çıkarılan';
    }
  }

  getSourceIcon(): string {
    switch (this.source) {
      case FeedSource.TRUSTER: return '🤝';
      case FeedSource.CATEGORY_MATCH: return '🎯';
      case FeedSource.TRENDING: return '🔥';
      case FeedSource.NEW_USER: return '🆕';
      case FeedSource.BOOSTED: return '⚡';
    }
  }

  getSourceColor(): string {
    switch (this.source) {
      case FeedSource.TRUSTER: return '#22c55e';      // Green
      case FeedSource.CATEGORY_MATCH: return '#3b82f6'; // Blue
      case FeedSource.TRENDING: return '#f59e0b';     // Orange
      case FeedSource.NEW_USER: return '#8b5cf6';     // Purple
      case FeedSource.BOOSTED: return '#ef4444';      // Red
    }
  }

  getDaysSinceCreated(): number {
    return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  isRecentFeed(): boolean {
    return this.getDaysSinceCreated() <= 1;
  }

  getFeedPriority(): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
    if (this.isBoostedFeed()) return 'URGENT';
    if (this.isTrendingFeed()) return 'HIGH';
    if (this.isTrusterFeed()) return 'MEDIUM';
    return 'LOW';
  }

  getFeedPriorityDisplayName(): string {
    switch (this.getFeedPriority()) {
      case 'LOW': return 'Düşük Öncelik';
      case 'MEDIUM': return 'Orta Öncelik';
      case 'HIGH': return 'Yüksek Öncelik';
      case 'URGENT': return 'Acil';
    }
  }

  shouldHighlight(): boolean {
    return this.isBoostedFeed() || this.isTrendingFeed();
  }

  getSeenStatus(): 'SEEN' | 'UNSEEN' {
    return this.seen ? 'SEEN' : 'UNSEEN';
  }

  getSeenStatusIcon(): string {
    return this.seen ? '👁️' : '👁️‍🗨️';
  }
}