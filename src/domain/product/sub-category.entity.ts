export class SubCategory {
  constructor(
    public readonly id: string,
    public readonly mainCategoryId: number,
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
    return this.description ?? `${this.name} alt kategorisi`;
  }

  isValid(): boolean {
    return this.name.trim().length > 0 && this.mainCategoryId > 0;
  }

  generateSlug(): string {
    return this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  getFullPath(mainCategoryName: string): string {
    return `${mainCategoryName} > ${this.name}`;
  }

  isSpecializedCategory(): boolean {
    const specializedKeywords = [
      'professional', 'uzman', 'premium', 'advanced', 'pro',
      'gaming', 'outdoor', 'luxury', 'industrial'
    ];
    return specializedKeywords.some(keyword => 
      this.name.toLowerCase().includes(keyword)
    );
  }

  getSubCategoryIcon(): string {
    const name = this.name.toLowerCase();
    
    // Electronics sub-categories
    if (name.includes('telefon') || name.includes('mobile')) return '📱';
    if (name.includes('laptop') || name.includes('bilgisayar')) return '💻';
    if (name.includes('tablet')) return '📱';
    if (name.includes('kulaklık') || name.includes('headphone')) return '🎧';
    
    // Clothing sub-categories
    if (name.includes('gömlek') || name.includes('shirt')) return '👔';
    if (name.includes('pantolon') || name.includes('pants')) return '👖';
    if (name.includes('elbise') || name.includes('dress')) return '👗';
    if (name.includes('ayakkabı') || name.includes('shoe')) return '👟';
    
    // Home sub-categories
    if (name.includes('mutfak') || name.includes('kitchen')) return '🍳';
    if (name.includes('banyo') || name.includes('bathroom')) return '🛁';
    if (name.includes('yatak') || name.includes('bedroom')) return '🛏️';
    if (name.includes('salon') || name.includes('living')) return '🛋️';
    
    return '📋'; // Default sub-category icon
  }

  getSpecialtyLevel(): 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'PROFESSIONAL' {
    const name = this.name.toLowerCase();
    if (name.includes('pro') || name.includes('professional')) return 'PROFESSIONAL';
    if (name.includes('advanced') || name.includes('uzman')) return 'ADVANCED';
    if (name.includes('intermediate') || name.includes('orta')) return 'INTERMEDIATE';
    return 'BASIC';
  }

  belongsToMainCategory(mainCategoryId: number): boolean {
    return this.mainCategoryId === mainCategoryId;
  }

  isRecentlyCreated(): boolean {
    const daysSinceCreated = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreated <= 30; // Created within last month
  }
}