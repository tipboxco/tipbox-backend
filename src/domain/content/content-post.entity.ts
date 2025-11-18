import { ContentPostType } from './content-post-type.enum';

export class ContentPost {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly type: ContentPostType,
    public readonly title: string,
    public readonly body: string,
    public readonly mainCategoryId: string | null,
    public readonly subCategoryId: string | null,
    public readonly productGroupId: string | null,
    public readonly productId: string | null,
    public readonly inventoryRequired: boolean,
    public readonly isBoosted: boolean,
    public readonly boostedUntil: Date | null,
    public readonly likesCount: number,
    public readonly commentsCount: number,
    public readonly favoritesCount: number,
    public readonly viewsCount: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  getTitle(): string {
    return this.title;
  }

  getBody(): string {
    return this.body;
  }

  isQuestion(): boolean {
    return this.type === ContentPostType.QUESTION;
  }

  isTip(): boolean {
    return this.type === ContentPostType.TIPS;
  }

  isComparison(): boolean {
    return this.type === ContentPostType.COMPARE;
  }

  isFreePost(): boolean {
    return this.type === ContentPostType.FREE;
  }

  belongsToUser(userId: string): boolean {
    return this.userId === userId;
  }

  requiresInventory(): boolean {
    return this.inventoryRequired;
  }

  isBoostedPost(): boolean {
    return this.isBoosted && this.isBoostActive();
  }

  isBoostActive(): boolean {
    return this.boostedUntil ? new Date() < this.boostedUntil : false;
  }

  hasProduct(): boolean {
    return this.productId !== null;
  }

  hasCategory(): boolean {
    return this.mainCategoryId !== null || this.subCategoryId !== null;
  }

  isRecentPost(): boolean {
    const daysSinceCreated = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreated <= 7;
  }

  getPostTypeIcon(): string {
    switch (this.type) {
      case ContentPostType.QUESTION: return '❓';
      case ContentPostType.TIPS: return '💡';
      case ContentPostType.COMPARE: return '⚖️';
      case ContentPostType.FREE: return '📝';
      case ContentPostType.EXPERIENCE: return '🌟';
      case ContentPostType.UPDATE: return '📢';
      default: return '📝';
    }
    return '📝';
  }

  getPostTypeDisplayName(): string {
    switch (this.type) {
      case ContentPostType.QUESTION: return 'Soru';
      case ContentPostType.TIPS: return 'İpucu';
      case ContentPostType.COMPARE: return 'Karşılaştırma';
      case ContentPostType.FREE: return 'Serbest';
      case ContentPostType.EXPERIENCE: return 'Deneyim';
      case ContentPostType.UPDATE: return 'Güncelleme';
      default: return 'Serbest';
    }
    return 'Serbest';
  }

  getWordCount(): number {
    return this.body.split(' ').length;
  }

  isDetailedPost(): boolean {
    return this.getWordCount() > 100;
  }

  generateSlug(): string {
    return this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim() + `-${this.id}`;
  }
}