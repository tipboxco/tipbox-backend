export class Product {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly brand: string | null,
    public readonly description: string | null,
    public readonly groupId: number | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Business logic methods
  getDisplayName(): string {
    return this.brand ? `${this.brand} ${this.name}` : this.name;
  }

  getShortName(): string {
    return this.name;
  }

  getBrand(): string {
    return this.brand ?? 'Markasız';
  }

  getDescription(): string {
    return this.description ?? `${this.getDisplayName()} hakkında detay bilgi bulunmamaktadır.`;
  }

  hasDescription(): boolean {
    return this.description !== null && this.description.trim().length > 0;
  }

  hasBrand(): boolean {
    return this.brand !== null && this.brand.trim().length > 0;
  }

  belongsToGroup(groupId: number): boolean {
    return this.groupId === groupId;
  }

  isUncategorized(): boolean {
    return this.groupId === null;
  }

  generateSlug(): string {
    const baseSlug = this.getDisplayName()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    return `${baseSlug}-${this.id}`;
  }

  generateSKU(): string {
    const brandPrefix = this.brand ? this.brand.substring(0, 3).toUpperCase() : 'GEN';
    const namePrefix = this.name.substring(0, 3).toUpperCase();
    return `${brandPrefix}-${namePrefix}-${this.id.toString().padStart(6, '0')}`;
  }

  isRecentlyAdded(): boolean {
    const daysSinceCreated = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreated <= 7; // Added within last week
  }

  isRecentlyUpdated(): boolean {
    const daysSinceUpdated = Math.floor(
      (Date.now() - this.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceUpdated <= 3; // Updated within last 3 days
  }

  getBrandTier(): 'PREMIUM' | 'MAINSTREAM' | 'BUDGET' | 'UNKNOWN' {
    if (!this.brand) return 'UNKNOWN';
    
    const premiumBrands = [
      'apple', 'samsung', 'sony', 'lg', 'nike', 'adidas', 
      'canon', 'nikon', 'bose', 'beats', 'dyson'
    ];
    
    const mainstreamBrands = [
      'xiaomi', 'huawei', 'oppo', 'vivo', 'hp', 'dell', 
      'asus', 'lenovo', 'acer', 'msi'
    ];
    
    const brand = this.brand.toLowerCase();
    
    if (premiumBrands.some(pb => brand.includes(pb))) return 'PREMIUM';
    if (mainstreamBrands.some(mb => brand.includes(mb))) return 'MAINSTREAM';
    
    return 'BUDGET';
  }

  getProductType(): 'ELECTRONICS' | 'CLOTHING' | 'HOME' | 'SPORTS' | 'OTHER' {
    const name = this.name.toLowerCase();
    
    if (name.includes('telefon') || name.includes('laptop') || 
        name.includes('tablet') || name.includes('kulaklık')) return 'ELECTRONICS';
    
    if (name.includes('gömlek') || name.includes('pantolon') || 
        name.includes('elbise') || name.includes('ayakkabı')) return 'CLOTHING';
    
    if (name.includes('masa') || name.includes('sandalye') || 
        name.includes('yatak') || name.includes('dolap')) return 'HOME';
    
    if (name.includes('spor') || name.includes('fitness') || 
        name.includes('koşu') || name.includes('futbol')) return 'SPORTS';
    
    return 'OTHER';
  }

  getEstimatedPriceRange(): { min: number; max: number; currency: string } {
    const productType = this.getProductType();
    const brandTier = this.getBrandTier();
    
    let baseMin = 100;
    let baseMax = 500;
    
    // Adjust by product type
    switch (productType) {
      case 'ELECTRONICS':
        baseMin = 500;
        baseMax = 5000;
        break;
      case 'CLOTHING':
        baseMin = 50;
        baseMax = 300;
        break;
      case 'HOME':
        baseMin = 200;
        baseMax = 2000;
        break;
      case 'SPORTS':
        baseMin = 100;
        baseMax = 800;
        break;
    }
    
    // Adjust by brand tier
    switch (brandTier) {
      case 'PREMIUM':
        baseMin *= 2;
        baseMax *= 3;
        break;
      case 'MAINSTREAM':
        baseMin *= 1.2;
        baseMax *= 1.5;
        break;
      case 'BUDGET':
        baseMin *= 0.5;
        baseMax *= 0.8;
        break;
    }
    
    return {
      min: Math.round(baseMin),
      max: Math.round(baseMax),
      currency: 'TRY'
    };
  }

  getProductIcon(): string {
    const productType = this.getProductType();
    switch (productType) {
      case 'ELECTRONICS': return '📱';
      case 'CLOTHING': return '👕';
      case 'HOME': return '🏠';
      case 'SPORTS': return '⚽';
      case 'OTHER': return '📦';
    }
  }

  getQualityScore(): number {
    let score = 5; // Base score
    
    // Brand tier influence
    switch (this.getBrandTier()) {
      case 'PREMIUM': score += 3; break;
      case 'MAINSTREAM': score += 1; break;
      case 'BUDGET': score -= 1; break;
    }
    
    // Description quality
    if (this.hasDescription() && this.description!.length > 100) score += 1;
    
    // Recent updates indicate active maintenance
    if (this.isRecentlyUpdated()) score += 0.5;
    
    return Math.min(10, Math.max(1, score));
  }

  isComparableWith(otherProduct: Product): boolean {
    // Products are comparable if they are the same type
    return this.getProductType() === otherProduct.getProductType();
  }

  getSearchKeywords(): string[] {
    const keywords: string[] = [];
    
    keywords.push(this.name.toLowerCase());
    if (this.brand) keywords.push(this.brand.toLowerCase());
    if (this.description) {
      keywords.push(...this.description.toLowerCase().split(' ').filter(word => word.length > 3));
    }
    
    return [...new Set(keywords)]; // Remove duplicates
  }
}