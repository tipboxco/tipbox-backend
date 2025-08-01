export class ComparisonMetric {
  constructor(
    public readonly id: number,
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
    return this.description ?? `${this.name} karşılaştırma metriği`;
  }

  isValid(): boolean {
    return this.name.trim().length > 0;
  }

  hasDescription(): boolean {
    return this.description !== null && this.description.trim().length > 0;
  }

  generateSlug(): string {
    return this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  getMetricCategory(): 'PERFORMANCE' | 'DESIGN' | 'VALUE' | 'USABILITY' | 'QUALITY' | 'OTHER' {
    const name = this.name.toLowerCase();
    
    if (name.includes('performans') || name.includes('hız') || 
        name.includes('güç') || name.includes('performance')) {
      return 'PERFORMANCE';
    }
    
    if (name.includes('tasarım') || name.includes('görünüm') || 
        name.includes('estetik') || name.includes('design')) {
      return 'DESIGN';
    }
    
    if (name.includes('fiyat') || name.includes('değer') || 
        name.includes('price') || name.includes('value')) {
      return 'VALUE';
    }
    
    if (name.includes('kullanım') || name.includes('kolay') || 
        name.includes('usability') || name.includes('ease')) {
      return 'USABILITY';
    }
    
    if (name.includes('kalite') || name.includes('dayanıklılık') || 
        name.includes('quality') || name.includes('durability')) {
      return 'QUALITY';
    }
    
    return 'OTHER';
  }

  getMetricIcon(): string {
    const category = this.getMetricCategory();
    switch (category) {
      case 'PERFORMANCE': return '⚡';
      case 'DESIGN': return '🎨';
      case 'VALUE': return '💰';
      case 'USABILITY': return '👤';
      case 'QUALITY': return '⭐';
      case 'OTHER': return '📊';
    }
  }

  getMetricColor(): string {
    const category = this.getMetricCategory();
    switch (category) {
      case 'PERFORMANCE': return '#f59e0b';  // Orange
      case 'DESIGN': return '#ec4899';       // Pink
      case 'VALUE': return '#22c55e';        // Green
      case 'USABILITY': return '#3b82f6';    // Blue
      case 'QUALITY': return '#8b5cf6';      // Purple
      case 'OTHER': return '#6b7280';        // Gray
    }
  }

  getWeight(): number {
    // Return importance weight for this metric (1-10)
    const category = this.getMetricCategory();
    switch (category) {
      case 'PERFORMANCE': return 9;
      case 'QUALITY': return 9;
      case 'VALUE': return 8;
      case 'USABILITY': return 7;
      case 'DESIGN': return 6;
      case 'OTHER': return 5;
    }
  }

  isHighPriorityMetric(): boolean {
    return this.getWeight() >= 8;
  }

  isCoreMetric(): boolean {
    const coreMetrics = ['PERFORMANCE', 'QUALITY', 'VALUE'];
    return coreMetrics.includes(this.getMetricCategory());
  }

  isSubjectiveMetric(): boolean {
    const subjectiveMetrics = ['DESIGN', 'USABILITY'];
    return subjectiveMetrics.includes(this.getMetricCategory());
  }

  isObjectiveMetric(): boolean {
    return !this.isSubjectiveMetric();
  }

  getScoreRange(): { min: number; max: number } {
    return { min: 1, max: 10 }; // Standard 1-10 scoring range
  }

  isValidScore(score: number): boolean {
    const range = this.getScoreRange();
    return score >= range.min && score <= range.max && Number.isInteger(score);
  }

  getScoreLabel(score: number): string {
    if (!this.isValidScore(score)) return 'Geçersiz';
    
    if (score >= 9) return 'Mükemmel';
    if (score >= 8) return 'Çok İyi';
    if (score >= 7) return 'İyi';
    if (score >= 6) return 'Orta Üstü';
    if (score >= 5) return 'Orta';
    if (score >= 4) return 'Orta Altı';
    if (score >= 3) return 'Zayıf';
    if (score >= 2) return 'Çok Zayıf';
    return 'Yetersiz';
  }

  getScoreColor(score: number): string {
    if (!this.isValidScore(score)) return '#6b7280'; // Gray
    
    if (score >= 8) return '#22c55e';  // Green
    if (score >= 6) return '#f59e0b';  // Yellow
    if (score >= 4) return '#f97316';  // Orange
    return '#ef4444';                  // Red
  }

  calculateWeightedScore(rawScore: number): number {
    if (!this.isValidScore(rawScore)) return 0;
    return (rawScore * this.getWeight()) / 10;
  }

  getRecommendedMinScore(): number {
    // Minimum recommended score for this metric
    return this.isHighPriorityMetric() ? 6 : 5;
  }

  isAcceptableScore(score: number): boolean {
    return this.isValidScore(score) && score >= this.getRecommendedMinScore();
  }
}