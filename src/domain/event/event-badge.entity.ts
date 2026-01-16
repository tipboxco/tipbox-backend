export class EventBadge {
  constructor(
    public readonly id: string,
    public readonly eventId: string,
    public readonly badgeId: string,
    public readonly requirementType: string,
    public readonly threshold: number,
    public readonly displayOrder: number | null,
    public readonly enabled: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  isEnabled(): boolean {
    return this.enabled;
  }

  meetsThreshold(currentValue: number): boolean {
    return currentValue >= this.threshold;
  }

  calculateProgress(currentValue: number): number {
    return Math.min(100, Math.round((currentValue / this.threshold) * 100));
  }
}
