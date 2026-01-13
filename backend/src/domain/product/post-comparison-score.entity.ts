export class PostComparisonScore {
  constructor(
    public readonly id: string,
    public readonly comparisonId: string,
    public readonly metricId: string,
    public readonly scoreProduct1: number,
    public readonly scoreProduct2: number,
    public readonly comment: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Business logic methods
  getComment(): string {
    return this.comment ?? 'Yorum bulunmamaktadır.';
  }

  hasComment(): boolean {
    return this.comment !== null && this.comment.trim().length > 0;
  }

  isValidScore(): boolean {
    return this.isValidScoreValue(this.scoreProduct1) && 
           this.isValidScoreValue(this.scoreProduct2);
  }

  private isValidScoreValue(score: number): boolean {
    return score >= 1 && score <= 10 && Number.isInteger(score);
  }

  getWinner(): 'PRODUCT_1' | 'PRODUCT_2' | 'TIE' {
    if (this.scoreProduct1 > this.scoreProduct2) return 'PRODUCT_1';
    if (this.scoreProduct2 > this.scoreProduct1) return 'PRODUCT_2';
    return 'TIE';
  }

  getScoreDifference(): number {
    return Math.abs(this.scoreProduct1 - this.scoreProduct2);
  }

  isCloseComparison(): boolean {
    return this.getScoreDifference() <= 1;
  }

  isDecisiveComparison(): boolean {
    return this.getScoreDifference() >= 3;
  }

  getProduct1ScoreLabel(): string {
    return this.getScoreLabel(this.scoreProduct1);
  }

  getProduct2ScoreLabel(): string {
    return this.getScoreLabel(this.scoreProduct2);
  }

  private getScoreLabel(score: number): string {
    if (!this.isValidScoreValue(score)) return 'Geçersiz';
    
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

  getProduct1ScoreColor(): string {
    return this.getScoreColor(this.scoreProduct1);
  }

  getProduct2ScoreColor(): string {
    return this.getScoreColor(this.scoreProduct2);
  }

  private getScoreColor(score: number): string {
    if (!this.isValidScoreValue(score)) return '#6b7280'; // Gray
    
    if (score >= 8) return '#22c55e';  // Green
    if (score >= 6) return '#f59e0b';  // Yellow
    if (score >= 4) return '#f97316';  // Orange
    return '#ef4444';                  // Red
  }

  getAverageScore(): number {
    return (this.scoreProduct1 + this.scoreProduct2) / 2;
  }

  getBetterProduct(): 1 | 2 | null {
    const winner = this.getWinner();
    if (winner === 'PRODUCT_1') return 1;
    if (winner === 'PRODUCT_2') return 2;
    return null; // Tie
  }

  getScoreForProduct(productNumber: 1 | 2): number {
    return productNumber === 1 ? this.scoreProduct1 : this.scoreProduct2;
  }

  getComparisonResult(): string {
    const winner = this.getWinner();
    const difference = this.getScoreDifference();
    
    if (winner === 'TIE') return 'Berabere';
    
    const winnerText = winner === 'PRODUCT_1' ? 'İlk ürün' : 'İkinci ürün';
    
    if (this.isDecisiveComparison()) return `${winnerText} açık üstün (${difference} puan fark)`;
    if (this.isCloseComparison()) return `${winnerText} hafif üstün (${difference} puan fark)`;
    
    return `${winnerText} üstün (${difference} puan fark)`;
  }

  getConfidenceLevel(): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (this.isDecisiveComparison()) return 'HIGH';
    if (this.isCloseComparison()) return 'LOW';
    return 'MEDIUM';
  }

  getReliabilityScore(): number {
    let score = 5; // Base score
    
    // Comment adds reliability
    if (this.hasComment()) {
      score += 2;
      // Detailed comment adds more reliability
      if (this.comment!.length > 50) score += 1;
    }
    
    // Recent scores are more reliable
    if (this.isRecentScore()) score += 1;
    
    // Extreme scores without comments are less reliable
    if ((this.scoreProduct1 === 1 || this.scoreProduct1 === 10 || 
         this.scoreProduct2 === 1 || this.scoreProduct2 === 10) && 
        !this.hasComment()) {
      score -= 1;
    }
    
    return Math.min(10, Math.max(1, score));
  }

  isRecentScore(): boolean {
    const daysSinceCreated = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreated <= 7; // Created within last week
  }

  isOutdatedScore(): boolean {
    const daysSinceCreated = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreated >= 180; // Older than 6 months
  }

  needsVerification(): boolean {
    // Scores that might need verification
    return this.isDecisiveComparison() && !this.hasComment();
  }

  getScoreQuality(): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' {
    const reliability = this.getReliabilityScore();
    
    if (reliability >= 8) return 'EXCELLENT';
    if (reliability >= 6) return 'GOOD';
    if (reliability >= 4) return 'FAIR';
    return 'POOR';
  }

  calculateWeightedScore(metricWeight: number): { product1: number; product2: number } {
    const weight = metricWeight / 10; // Normalize weight to 0-1
    
    return {
      product1: this.scoreProduct1 * weight,
      product2: this.scoreProduct2 * weight
    };
  }

  getScorePercentage(productNumber: 1 | 2): number {
    const score = this.getScoreForProduct(productNumber);
    return (score / 10) * 100;
  }

  getRelativePerformance(): { product1: string; product2: string } {
    const total = this.scoreProduct1 + this.scoreProduct2;
    
    return {
      product1: `${Math.round((this.scoreProduct1 / total) * 100)}%`,
      product2: `${Math.round((this.scoreProduct2 / total) * 100)}%`
    };
  }

  isBalancedScore(): boolean {
    // Both products score reasonably well
    return this.scoreProduct1 >= 5 && this.scoreProduct2 >= 5;
  }

  hasExtremeScore(): boolean {
    return this.scoreProduct1 <= 2 || this.scoreProduct1 >= 9 ||
           this.scoreProduct2 <= 2 || this.scoreProduct2 >= 9;
  }

  getScoreDistribution(): { low: number; medium: number; high: number } {
    const scores = [this.scoreProduct1, this.scoreProduct2];
    
    return {
      low: scores.filter(s => s <= 4).length,
      medium: scores.filter(s => s >= 5 && s <= 7).length,
      high: scores.filter(s => s >= 8).length
    };
  }

  belongsToComparison(comparisonId: string): boolean {
    return this.comparisonId === comparisonId;
  }

  belongsToMetric(metricId: string): boolean {
    return this.metricId === metricId;
  }
}