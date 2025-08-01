export class ContentCollection {
  constructor(
    public readonly id: number,
    public readonly userId: number,
    public readonly name: string,
    public readonly description: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToUser(userId: number): boolean {
    return this.userId === userId;
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description ?? `${this.name} koleksiyonu`;
  }

  hasDescription(): boolean {
    return this.description !== null && this.description.trim().length > 0;
  }

  isRecentlyCreated(): boolean {
    const daysSinceCreated = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreated <= 7; // Within last week
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