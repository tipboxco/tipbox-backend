import { FeedSource } from './feed-source.enum';

export class Feed {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly postId: string,
    public readonly source: FeedSource,
    public readonly seen: boolean,
    public readonly relevanceScore: number,
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

  // YENİ METODLAR: Relevance score bazlı
  
  /**
   * Yüksek relevance score (> 50)
   */
  isHighRelevance(): boolean {
    return this.relevanceScore > 50;
  }

  /**
   * Düşük relevance score (< 10)
   */
  isLowRelevance(): boolean {
    return this.relevanceScore < 10;
  }

  /**
   * Orta seviye relevance (10-50)
   */
  isMediumRelevance(): boolean {
    return this.relevanceScore >= 10 && this.relevanceScore <= 50;
  }

  /**
   * Cleanup edilmeli mi?
   * - Unseen && score < 2.5
   * - Seen && score < 1.5
   */
  shouldCleanup(): boolean {
    if (!this.seen && this.relevanceScore < 2.5) {
      return true;
    }
    if (this.seen && this.relevanceScore < 1.5) {
      return true;
    }
    return false;
  }

  /**
   * Relevance level: CRITICAL, HIGH, MEDIUM, LOW
   */
  getRelevanceLevel(): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    if (this.relevanceScore >= 80) return 'CRITICAL';
    if (this.relevanceScore >= 50) return 'HIGH';
    if (this.relevanceScore >= 20) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Seen penalty uygulanmış mı?
   * Seen penalty uygulanmışsa score genellikle çift haneli olur
   */
  hasSeenPenalty(): boolean {
    return this.seen && this.relevanceScore < 30;
  }

  getSourceDisplayName(): string {
    switch (this.source) {
      case FeedSource.TRUSTER: return 'Güvenilen Kişi';
      case FeedSource.CATEGORY_MATCH: return 'Kategori Eşleşmesi';
      case FeedSource.TRENDING: return 'Trend';
      case FeedSource.NEW_USER: return 'Yeni Kullanıcı';
      case FeedSource.BOOSTED: return 'Öne Çıkarılan';
      case FeedSource.TRUSTER_NETWORK: return 'Güvenen Kişi';
      case FeedSource.MUTUAL_TRUST: return 'Karşılıklı Güven';
      case FeedSource.INVENTORY_MATCH: return 'Envanterinde Var';
      case FeedSource.PRODUCT_GROUP_MATCH: return 'Ürün Grubu Eşleşmesi';
      case FeedSource.ENGAGEMENT_HIGH: return 'Yüksek Etkileşim';
    }
  }

  getSourceIcon(): string {
    switch (this.source) {
      case FeedSource.TRUSTER: return '🤝';
      case FeedSource.CATEGORY_MATCH: return '🎯';
      case FeedSource.TRENDING: return '🔥';
      case FeedSource.NEW_USER: return '🆕';
      case FeedSource.BOOSTED: return '⚡';
      case FeedSource.TRUSTER_NETWORK: return '👥';
      case FeedSource.MUTUAL_TRUST: return '💚';
      case FeedSource.INVENTORY_MATCH: return '📦';
      case FeedSource.PRODUCT_GROUP_MATCH: return '🏷️';
      case FeedSource.ENGAGEMENT_HIGH: return '⭐';
    }
  }

  getSourceColor(): string {
    switch (this.source) {
      case FeedSource.TRUSTER: return '#22c55e';      // Green
      case FeedSource.CATEGORY_MATCH: return '#3b82f6'; // Blue
      case FeedSource.TRENDING: return '#f59e0b';     // Orange
      case FeedSource.NEW_USER: return '#8b5cf6';     // Purple
      case FeedSource.BOOSTED: return '#ef4444';      // Red
      case FeedSource.TRUSTER_NETWORK: return '#06b6d4'; // Cyan
      case FeedSource.MUTUAL_TRUST: return '#10b981';    // Emerald
      case FeedSource.INVENTORY_MATCH: return '#a855f7';  // Purple
      case FeedSource.PRODUCT_GROUP_MATCH: return '#ec4899'; // Pink
      case FeedSource.ENGAGEMENT_HIGH: return '#f59e0b';     // Amber
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

  /**
   * Feed metadata'sını JSON formatında döner
   */
  toMetadata(): {
    id: string;
    source: string;
    seen: boolean;
    relevanceScore: number;
    relevanceLevel: string;
    priority: string;
    age: number;
  } {
    return {
      id: this.id,
      source: this.source,
      seen: this.seen,
      relevanceScore: this.relevanceScore,
      relevanceLevel: this.getRelevanceLevel(),
      priority: this.getFeedPriority(),
      age: this.getDaysSinceCreated(),
    };
  }
}