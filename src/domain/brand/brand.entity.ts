export class Brand {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly description: string | null,
    public readonly logoUrl: string | null,
    public readonly category: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description ?? `${this.name} markası hakkında bilgi bulunmamaktadır.`;
  }

  hasLogo(): boolean {
    return this.logoUrl !== null && this.logoUrl.trim().length > 0;
  }

  hasCategory(): boolean {
    return this.category !== null && this.category.trim().length > 0;
  }

  getCategory(): string {
    return this.category ?? 'Genel';
  }

  isRecentlyCreated(): boolean {
    const daysSinceCreated = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreated <= 30;
  }

  generateSlug(): string {
    return this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  getBrandIcon(): string {
    const category = this.getCategory().toLowerCase();
    if (category.includes('teknoloji')) return '💻';
    if (category.includes('giyim')) return '👕';
    if (category.includes('yiyecek')) return '🍕';
    if (category.includes('otomobil')) return '🚗';
    if (category.includes('kozmetik')) return '💄';
    return '🏢'; // Default brand icon
  }
}