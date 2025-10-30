export class WishboxScenario {
  constructor(
    public readonly id: string,
    public readonly eventId: number,
    public readonly title: string,
    public readonly description: string | null,
    public readonly orderIndex: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToEvent(eventId: number): boolean {
    return this.eventId === eventId;
  }

  getTitle(): string {
    return this.title;
  }

  getDescription(): string {
    return this.description ?? 'Senaryo açıklaması bulunmamaktadır.';
  }

  getOrderIndex(): number {
    return this.orderIndex;
  }

  isFirstScenario(): boolean {
    return this.orderIndex === 1;
  }

  isLaterScenario(): boolean {
    return this.orderIndex > 1;
  }

  getScenarioNumber(): string {
    return `Senaryo ${this.orderIndex}`;
  }

  generateSlug(): string {
    return this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  isDetailedScenario(): boolean {
    return this.description !== null && this.description.length > 100;
  }
}