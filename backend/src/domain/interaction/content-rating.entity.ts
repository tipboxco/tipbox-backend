export class ContentRating {
  constructor(
    public readonly id: string,
    public readonly userId: number,
    public readonly commentId: number,
    public readonly rating: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToUser(userId: number): boolean {
    return this.userId === userId;
  }

  belongsToComment(commentId: number): boolean {
    return this.commentId === commentId;
  }

  getRating(): number {
    return this.rating;
  }

  isValidRating(): boolean {
    return this.rating >= 1 && this.rating <= 5;
  }

  isPositiveRating(): boolean {
    return this.rating >= 4;
  }

  isNegativeRating(): boolean {
    return this.rating <= 2;
  }

  isNeutralRating(): boolean {
    return this.rating === 3;
  }

  getRatingIcon(): string {
    if (this.rating >= 5) return '⭐⭐⭐⭐⭐';
    if (this.rating >= 4) return '⭐⭐⭐⭐';
    if (this.rating >= 3) return '⭐⭐⭐';
    if (this.rating >= 2) return '⭐⭐';
    return '⭐';
  }
}