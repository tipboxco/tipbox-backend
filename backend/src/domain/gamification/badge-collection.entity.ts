export class BadgeCollection {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly bannerUrl: string | null,
    public readonly owner: string | null,
    public readonly focusSector: string | null,
    public readonly targetGroup: string | null,
    public readonly shortDescription: string | null,
    public readonly longDescription: string | null,
    public readonly unlockCondition: string | null,
    public readonly completionBonus: string | null,
    public readonly categoryId: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Identity getters
  getName(): string {
    return this.name;
  }

  getOwner(): string {
    return this.owner ?? 'Tipbox';
  }

  getObjective(): string {
    return this.longDescription ?? this.shortDescription ?? 'Badge collection';
  }

  getTargetGroup(): string | null {
    return this.targetGroup;
  }

  // Logic getters
  isLocked(): boolean {
    return this.unlockCondition !== null && this.unlockCondition !== 'NONE';
  }

  // Utility methods
  hasBanner(): boolean {
    return this.bannerUrl !== null;
  }

  hasCompletionBonus(): boolean {
    return this.completionBonus !== null;
  }

  generateSlug(): string {
    return this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}
