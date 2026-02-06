export class BadgeCollection {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly bannerUrl: string | null,
    public readonly owner: string | null,
    public readonly collectionObjective: string | null,
    public readonly targetVertical: string | null,
    public readonly productScope: string | null,
    public readonly collectionType: string | null,
    public readonly hookPitch: string | null,
    public readonly visualTheme: string | null,
    public readonly completionBonus: string | null,
    public readonly primaryKpi: string | null,
    public readonly secondaryKpi: string | null,
    public readonly targetAudience: string | null,
    public readonly campaignContext: string | null,
    public readonly successMetric: string | null,
    public readonly sponsorship: string | null,
    public readonly unlockCondition: string | null,
    public readonly scheduleLaunchDate: Date | null,
    public readonly timeStockLimit: string | null,
    public readonly categoryId: string,
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
    return this.collectionObjective ?? 'Badge collection';
  }

  // Strategy getters
  getPrimaryKpi(): string | null {
    return this.primaryKpi;
  }

  getTargetAudience(): string | null {
    return this.targetAudience;
  }

  // Logic getters
  isLocked(): boolean {
    return this.unlockCondition !== null && this.unlockCondition !== 'NONE';
  }

  isScheduled(): boolean {
    return this.scheduleLaunchDate !== null;
  }

  isLaunched(): boolean {
    if (!this.scheduleLaunchDate) return true;
    return new Date() >= this.scheduleLaunchDate;
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
