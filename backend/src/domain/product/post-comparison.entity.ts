export class PostComparison {
  constructor(
    public readonly id: string,
    public readonly postId: number,
    public readonly product1Id: number,
    public readonly product2Id: number,
    public readonly comparisonSummary: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Business logic methods
  getComparisonSummary(): string {
    return this.comparisonSummary ?? 'Karşılaştırma özeti bulunmamaktadır.';
  }

  hasComparisonSummary(): boolean {
    return this.comparisonSummary !== null && this.comparisonSummary.trim().length > 0;
  }

  isValidComparison(): boolean {
    return this.product1Id !== this.product2Id && 
           this.product1Id > 0 && 
           this.product2Id > 0;
  }

  getProductIds(): number[] {
    return [this.product1Id, this.product2Id];
  }

  includesProduct(productId: number): boolean {
    return this.product1Id === productId || this.product2Id === productId;
  }

  getOtherProductId(productId: number): number | null {
    if (this.product1Id === productId) return this.product2Id;
    if (this.product2Id === productId) return this.product1Id;
    return null;
  }

  isRecentComparison(): boolean {
    const daysSinceCreated = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreated <= 7; // Created within last week
  }

  isRecentlyUpdated(): boolean {
    const daysSinceUpdated = Math.floor(
      (Date.now() - this.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceUpdated <= 3; // Updated within last 3 days
  }

  getComparisonType(): 'HEAD_TO_HEAD' | 'FEATURE_COMPARISON' | 'VALUE_COMPARISON' {
    // This could be determined by analysis of the summary or additional fields
    if (!this.hasComparisonSummary()) return 'HEAD_TO_HEAD';
    
    const summary = this.comparisonSummary!.toLowerCase();
    
    if (summary.includes('özellik') || summary.includes('feature') || 
        summary.includes('spec') || summary.includes('teknik')) {
      return 'FEATURE_COMPARISON';
    }
    
    if (summary.includes('fiyat') || summary.includes('değer') || 
        summary.includes('price') || summary.includes('value')) {
      return 'VALUE_COMPARISON';
    }
    
    return 'HEAD_TO_HEAD';
  }

  getComparisonIcon(): string {
    const type = this.getComparisonType();
    switch (type) {
      case 'FEATURE_COMPARISON': return '🔍';
      case 'VALUE_COMPARISON': return '💰';
      case 'HEAD_TO_HEAD': return '⚔️';
    }
  }

  getComparisonColor(): string {
    const type = this.getComparisonType();
    switch (type) {
      case 'FEATURE_COMPARISON': return '#3b82f6';  // Blue
      case 'VALUE_COMPARISON': return '#22c55e';    // Green
      case 'HEAD_TO_HEAD': return '#f59e0b';        // Orange
    }
  }

  getDifficultyLevel(): 'SIMPLE' | 'MODERATE' | 'COMPLEX' {
    if (!this.hasComparisonSummary()) return 'SIMPLE';
    
    const summaryLength = this.comparisonSummary!.length;
    
    if (summaryLength > 500) return 'COMPLEX';
    if (summaryLength > 200) return 'MODERATE';
    return 'SIMPLE';
  }

  getExpectedMetricsCount(): number {
    const type = this.getComparisonType();
    switch (type) {
      case 'FEATURE_COMPARISON': return 8; // More detailed comparison
      case 'VALUE_COMPARISON': return 5;   // Price-focused comparison
      case 'HEAD_TO_HEAD': return 6;       // Balanced comparison
    }
  }

  calculateCompleteness(actualMetricsCount: number): number {
    const expected = this.getExpectedMetricsCount();
    const completeness = Math.min(100, (actualMetricsCount / expected) * 100);
    
    // Bonus for having summary
    if (this.hasComparisonSummary()) {
      return Math.min(100, completeness + 10);
    }
    
    return completeness;
  }

  isCompleteComparison(actualMetricsCount: number): boolean {
    return this.calculateCompleteness(actualMetricsCount) >= 80;
  }

  getPriority(): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (this.isRecentComparison()) return 'HIGH';
    if (this.hasComparisonSummary()) return 'MEDIUM';
    return 'LOW';
  }

  generateComparisonTitle(product1Name: string, product2Name: string): string {
    return `${product1Name} vs ${product2Name}`;
  }

  generateSlug(product1Name: string, product2Name: string): string {
    const title = this.generateComparisonTitle(product1Name, product2Name);
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim() + `-${this.id}`;
  }

  getRecommendedActions(): string[] {
    const actions: string[] = [];
    
    if (!this.hasComparisonSummary()) {
      actions.push('Karşılaştırma özeti ekle');
    }
    
    if (!this.isRecentlyUpdated()) {
      actions.push('Karşılaştırmayı güncelle');
    }
    
    return actions;
  }

  getQualityScore(): number {
    let score = 5; // Base score
    
    if (this.hasComparisonSummary()) {
      score += 2;
      
      // Bonus for detailed summary
      if (this.comparisonSummary!.length > 200) score += 1;
    }
    
    if (this.isRecentComparison()) score += 1;
    if (this.isRecentlyUpdated()) score += 1;
    
    return Math.min(10, score);
  }

  getViewValue(): number {
    // Estimated value this comparison provides to viewers
    let value = this.getQualityScore();
    
    // Recent comparisons are more valuable
    if (this.isRecentComparison()) value += 2;
    
    // Complex comparisons provide more value
    if (this.getDifficultyLevel() === 'COMPLEX') value += 1;
    
    return Math.min(10, value);
  }

  needsUpdate(): boolean {
    const daysSinceUpdated = Math.floor(
      (Date.now() - this.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Suggest update after 30 days for active comparisons
    return daysSinceUpdated >= 30;
  }

  isActive(): boolean {
    // A comparison is considered active if it's recent or recently updated
    return this.isRecentComparison() || this.isRecentlyUpdated();
  }
}