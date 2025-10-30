export class Inventory {
  constructor(
    public readonly id: string,
    public readonly userId: number,
    public readonly productId: number,
    public readonly hasOwned: boolean,
    public readonly experienceSummary: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  isOwned(): boolean {
    return this.hasOwned;
  }

  hasExperience(): boolean {
    return this.experienceSummary !== null && this.experienceSummary.trim().length > 0;
  }

  getExperienceSummary(): string {
    return this.experienceSummary ?? 'Deneyim paylaşılmamış';
  }

  belongsToUser(userId: number): boolean {
    return this.userId === userId;
  }

  isForProduct(productId: number): boolean {
    return this.productId === productId;
  }

  canAddExperience(): boolean {
    return this.hasOwned;
  }

  getOwnershipStatus(): 'OWNED' | 'NOT_OWNED' {
    return this.hasOwned ? 'OWNED' : 'NOT_OWNED';
  }

  getExperienceLevel(): 'NONE' | 'BASIC' | 'DETAILED' {
    if (!this.hasExperience()) return 'NONE';
    const length = this.experienceSummary!.length;
    return length > 100 ? 'DETAILED' : 'BASIC';
  }
}