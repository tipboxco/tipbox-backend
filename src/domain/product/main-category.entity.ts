export class MainCategory {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Business logic methods
  getDisplayName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description ?? `${this.name} kategorisi`;
  }

  isValid(): boolean {
    return this.name.trim().length > 0;
  }

  generateSlug(): string {
    return this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  getCategoryIcon(): string {
    const name = this.name.toLowerCase();
    if (name.includes('elektronik')) return '📱';
    if (name.includes('giyim')) return '👕';
    if (name.includes('ev')) return '🏠';
    if (name.includes('spor')) return '⚽';
    if (name.includes('kitap')) return '📚';
    if (name.includes('oyuncak')) return '🧸';
    if (name.includes('kozmetik')) return '💄';
    if (name.includes('otomobil') || name.includes('araç')) return '🚗';
    if (name.includes('yiyecek') || name.includes('gıda')) return '🍕';
    return '📦'; // Default icon
  }

  getCategoryColor(): string {
    const name = this.name.toLowerCase();
    if (name.includes('elektronik')) return '#3b82f6'; // Blue
    if (name.includes('giyim')) return '#ec4899';     // Pink
    if (name.includes('ev')) return '#10b981';        // Green
    if (name.includes('spor')) return '#f59e0b';      // Orange
    if (name.includes('kitap')) return '#8b5cf6';     // Purple
    if (name.includes('oyuncak')) return '#f97316';   // Orange
    if (name.includes('kozmetik')) return '#ec4899';  // Pink
    if (name.includes('otomobil')) return '#6b7280';  // Gray
    if (name.includes('yiyecek')) return '#ef4444';   // Red
    return '#6b7280'; // Default gray
  }

  isPopularCategory(): boolean {
    const popularCategories = [
      'elektronik', 'giyim', 'ev', 'spor', 'kozmetik', 'otomobil'
    ];
    return popularCategories.some(cat => 
      this.name.toLowerCase().includes(cat)
    );
  }

  getTrendingScore(): number {
    // Simple scoring based on category popularity
    if (this.isPopularCategory()) return 8;
    return 5; // Default score
  }
}