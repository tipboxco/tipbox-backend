import { ProductSuggestionStatus } from './product-suggestion-status.enum';

export class ProductSuggestion {
  constructor(
    public readonly id: number,
    public readonly userId: number,
    public readonly suggestedName: string,
    public readonly suggestedBrand: string | null,
    public readonly description: string | null,
    public readonly reason: string | null,
    public readonly status: ProductSuggestionStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly reviewedAt: Date | null,
    public readonly reviewedBy: number | null
  ) {}

  // Business logic methods
  getDisplayName(): string {
    return this.suggestedBrand ? 
      `${this.suggestedBrand} ${this.suggestedName}` : 
      this.suggestedName;
  }

  getSuggestedBrand(): string {
    return this.suggestedBrand ?? 'Markasız';
  }

  getDescription(): string {
    return this.description ?? 'Açıklama bulunmamaktadır.';
  }

  getReason(): string {
    return this.reason ?? 'Öneri sebebi belirtilmemiş.';
  }

  isPending(): boolean {
    return this.status === ProductSuggestionStatus.PENDING;
  }

  isApproved(): boolean {
    return this.status === ProductSuggestionStatus.APPROVED;
  }

  isRejected(): boolean {
    return this.status === ProductSuggestionStatus.REJECTED;
  }

  isReviewed(): boolean {
    return this.reviewedAt !== null && this.reviewedBy !== null;
  }

  needsReview(): boolean {
    return this.isPending() && !this.isReviewed();
  }

  canBeReviewed(): boolean {
    return this.isPending();
  }

  getStatusDisplayName(): string {
    switch (this.status) {
      case ProductSuggestionStatus.PENDING: return 'Beklemede';
      case ProductSuggestionStatus.APPROVED: return 'Onaylandı';
      case ProductSuggestionStatus.REJECTED: return 'Reddedildi';
      default: return 'Bilinmiyor';
    }
  }

  getStatusColor(): string {
    switch (this.status) {
      case ProductSuggestionStatus.PENDING: return '#f59e0b';   // Yellow
      case ProductSuggestionStatus.APPROVED: return '#22c55e';  // Green
      case ProductSuggestionStatus.REJECTED: return '#ef4444';  // Red
      default: return '#6b7280'; // Gray
    }
  }

  getStatusIcon(): string {
    switch (this.status) {
      case ProductSuggestionStatus.PENDING: return '⏳';
      case ProductSuggestionStatus.APPROVED: return '✅';
      case ProductSuggestionStatus.REJECTED: return '❌';
      default: return '❓';
    }
  }

  getDaysSinceCreated(): number {
    return Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  getDaysSinceReviewed(): number | null {
    if (!this.reviewedAt) return null;
    return Math.floor(
      (Date.now() - this.reviewedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  isRecentSuggestion(): boolean {
    return this.getDaysSinceCreated() <= 7; // Within last week
  }

  isOldPendingSuggestion(): boolean {
    return this.isPending() && this.getDaysSinceCreated() >= 30; // Pending for over a month
  }

  isRecentlyReviewed(): boolean {
    const daysSinceReviewed = this.getDaysSinceReviewed();
    return daysSinceReviewed !== null && daysSinceReviewed <= 3; // Reviewed within last 3 days
  }

  hasBrand(): boolean {
    return this.suggestedBrand !== null && this.suggestedBrand.trim().length > 0;
  }

  hasDescription(): boolean {
    return this.description !== null && this.description.trim().length > 0;
  }

  hasReason(): boolean {
    return this.reason !== null && this.reason.trim().length > 0;
  }

  getCompleteness(): number {
    let score = 0;
    score += 25; // Base score for having a name
    
    if (this.hasBrand()) score += 25;
    if (this.hasDescription()) score += 25;
    if (this.hasReason()) score += 25;
    
    return score;
  }

  isWellDocumented(): boolean {
    return this.getCompleteness() >= 75;
  }

  getUrgencyLevel(): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (this.isOldPendingSuggestion()) return 'HIGH';
    if (this.isPending() && this.getDaysSinceCreated() >= 14) return 'MEDIUM';
    return 'LOW';
  }

  generateSlug(): string {
    const baseSlug = this.getDisplayName()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    return `${baseSlug}-suggestion-${this.id}`;
  }

  isFromUser(userId: number): boolean {
    return this.userId === userId;
  }

  wasReviewedBy(reviewerId: number): boolean {
    return this.reviewedBy === reviewerId;
  }

  canBeEditedByUser(userId: number): boolean {
    return this.isFromUser(userId) && this.canBeReviewed();
  }

  getPriority(): number {
    let priority = 5; // Base priority
    
    // Increase priority for well-documented suggestions
    if (this.isWellDocumented()) priority += 2;
    
    // Increase priority for older suggestions
    if (this.getDaysSinceCreated() >= 30) priority += 3;
    else if (this.getDaysSinceCreated() >= 14) priority += 1;
    
    // Increase priority if it has a brand
    if (this.hasBrand()) priority += 1;
    
    return Math.min(10, priority);
  }
}