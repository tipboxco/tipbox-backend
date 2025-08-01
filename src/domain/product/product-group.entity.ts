export class ProductGroup {
  constructor(
    public readonly id: number,
    public readonly subCategoryId: number,
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
    return this.description ?? `${this.name} ürün grubu`;
  }

  isValid(): boolean {
    return this.name.trim().length > 0 && this.subCategoryId > 0;
  }

  generateSlug(): string {
    return this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  getFullPath(mainCategoryName: string, subCategoryName: string): string {
    return `${mainCategoryName} > ${subCategoryName} > ${this.name}`;
  }

  belongsToSubCategory(subCategoryId: number): boolean {
    return this.subCategoryId === subCategoryId;
  }

  isSpecializedGroup(): boolean {
    const specializedKeywords = [
      'premium', 'luxury', 'professional', 'gaming', 'outdoor',
      'industrial', 'commercial', 'enterprise', 'pro'
    ];
    return specializedKeywords.some(keyword => 
      this.name.toLowerCase().includes(keyword)
    );
  }

  isBrandSpecific(): boolean {
    const brandKeywords = [
      'apple', 'samsung', 'sony', 'nike', 'adidas', 'hp', 'dell',
      'lg', 'xiaomi', 'huawei', 'oppo', 'vivo'
    ];
    return brandKeywords.some(brand => 
      this.name.toLowerCase().includes(brand)
    );
  }

  getPriceRange(): 'BUDGET' | 'MID_RANGE' | 'PREMIUM' | 'LUXURY' {
    const name = this.name.toLowerCase();
    if (name.includes('luxury') || name.includes('lüks')) return 'LUXURY';
    if (name.includes('premium') || name.includes('high-end')) return 'PREMIUM';
    if (name.includes('budget') || name.includes('ekonomik')) return 'BUDGET';
    return 'MID_RANGE';
  }

  getTargetAudience(): 'GENERAL' | 'PROFESSIONAL' | 'GAMING' | 'SPORTS' | 'BUSINESS' {
    const name = this.name.toLowerCase();
    if (name.includes('gaming') || name.includes('oyun')) return 'GAMING';
    if (name.includes('professional') || name.includes('pro')) return 'PROFESSIONAL';
    if (name.includes('sports') || name.includes('spor')) return 'SPORTS';
    if (name.includes('business') || name.includes('iş')) return 'BUSINESS';
    return 'GENERAL';
  }

  getGroupIcon(): string {
    const audience = this.getTargetAudience();
    switch (audience) {
      case 'GAMING': return '🎮';
      case 'PROFESSIONAL': return '💼';
      case 'SPORTS': return '⚽';
      case 'BUSINESS': return '🏢';
      case 'GENERAL': return '📦';
    }
  }

  getGroupColor(): string {
    const priceRange = this.getPriceRange();
    switch (priceRange) {
      case 'LUXURY': return '#8b5cf6';    // Purple
      case 'PREMIUM': return '#3b82f6';   // Blue
      case 'MID_RANGE': return '#10b981'; // Green
      case 'BUDGET': return '#f59e0b';    // Orange
    }
  }

  isRecentlyCreated(): boolean {
    const daysSinceCreated = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreated <= 30; // Created within last month
  }

  getCompetitiveAdvantage(): string[] {
    const advantages: string[] = [];
    
    if (this.isSpecializedGroup()) advantages.push('Uzmanlaşmış');
    if (this.isBrandSpecific()) advantages.push('Marka Odaklı');
    if (this.getPriceRange() === 'PREMIUM') advantages.push('Premium Kalite');
    if (this.getTargetAudience() === 'PROFESSIONAL') advantages.push('Profesyonel');
    
    return advantages;
  }
}