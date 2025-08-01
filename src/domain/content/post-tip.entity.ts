import { TipCategory } from './tip-category.enum';

export class PostTip {
  constructor(
    public readonly id: number,
    public readonly postId: number,
    public readonly tipCategory: TipCategory,
    public readonly isVerified: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToPost(postId: number): boolean {
    return this.postId === postId;
  }

  isVerifiedTip(): boolean {
    return this.isVerified;
  }

  isUsageTip(): boolean {
    return this.tipCategory === TipCategory.USAGE;
  }

  isPurchaseTip(): boolean {
    return this.tipCategory === TipCategory.PURCHASE;
  }

  isCareTip(): boolean {
    return this.tipCategory === TipCategory.CARE;
  }

  getTipCategoryDisplayName(): string {
    switch (this.tipCategory) {
      case TipCategory.USAGE: return 'Kullanım';
      case TipCategory.PURCHASE: return 'Satın Alma';
      case TipCategory.CARE: return 'Bakım';
      case TipCategory.OTHER: return 'Diğer';
    }
  }

  getTipCategoryIcon(): string {
    switch (this.tipCategory) {
      case TipCategory.USAGE: return '🔧';
      case TipCategory.PURCHASE: return '🛒';
      case TipCategory.CARE: return '🧽';
      case TipCategory.OTHER: return '💡';
    }
  }
}