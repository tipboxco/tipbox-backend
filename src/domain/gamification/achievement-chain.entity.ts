export class AchievementChain {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly description: string | null,
    public readonly category: string
  ) {}

  // Essential business methods only
  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description ?? `${this.name} başarı zinciri`;
  }

  getCategory(): string {
    return this.category;
  }

  belongsToCategory(category: string): boolean {
    return this.category.toLowerCase() === category.toLowerCase();
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