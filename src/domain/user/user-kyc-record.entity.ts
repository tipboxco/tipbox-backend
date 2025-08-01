import { KycReviewStatus, KycReviewResult, KycProvider } from './kyc-enums';

export class UserKycRecord {
  constructor(
    public readonly id: number,
    public readonly userId: number,
    public readonly sumsubApplicantId: string,
    public readonly reviewStatus: KycReviewStatus,
    public readonly reviewResult: KycReviewResult,
    public readonly reviewReason: string | null,
    public readonly kycLevel: string | null,
    public readonly provider: KycProvider,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly lastUpdatedAt: Date,
    public readonly lastSyncedAt: Date | null
  ) {}

  // Business logic methods
  isVerified(): boolean {
    return this.reviewStatus === KycReviewStatus.COMPLETED && 
           this.reviewResult === KycReviewResult.GREEN;
  }

  isPending(): boolean {
    return this.reviewStatus === KycReviewStatus.PENDING;
  }

  isRejected(): boolean {
    return this.reviewStatus === KycReviewStatus.DECLINED;
  }

  isOnHold(): boolean {
    return this.reviewStatus === KycReviewStatus.ON_HOLD;
  }

  needsAttention(): boolean {
    return this.reviewResult === KycReviewResult.YELLOW || 
           this.reviewResult === KycReviewResult.RED ||
           this.isOnHold();
  }

  getStatusDisplayName(): string {
    switch (this.reviewStatus) {
      case KycReviewStatus.INIT: return 'Başlatıldı';
      case KycReviewStatus.PENDING: return 'İnceleniyor';
      case KycReviewStatus.COMPLETED: return 'Tamamlandı';
      case KycReviewStatus.DECLINED: return 'Reddedildi';
      case KycReviewStatus.ON_HOLD: return 'Beklemede';
      default: return 'Bilinmiyor';
    }
  }

  getResultDisplayName(): string {
    switch (this.reviewResult) {
      case KycReviewResult.GREEN: return 'Onaylandı';
      case KycReviewResult.YELLOW: return 'Uyarı';
      case KycReviewResult.RED: return 'Reddedildi';
      case KycReviewResult.NULL: return 'Sonuçlanmamış';
      default: return 'Bilinmiyor';
    }
  }

  getStatusColor(): string {
    if (this.isVerified()) return '#22c55e'; // Green
    if (this.isPending()) return '#f59e0b';   // Yellow
    if (this.isRejected()) return '#ef4444'; // Red
    if (this.isOnHold()) return '#8b5cf6';   // Purple
    return '#6b7280'; // Gray
  }

  needsSync(): boolean {
    if (!this.lastSyncedAt) return true;
    const hoursSinceSync = Math.floor(
      (Date.now() - this.lastSyncedAt.getTime()) / (1000 * 60 * 60)
    );
    return hoursSinceSync >= 24; // Sync daily
  }

  isSumsubProvider(): boolean {
    return this.provider === KycProvider.SUMSUB;
  }

  hasLevel(): boolean {
    return this.kycLevel !== null;
  }

  getEffectiveLevel(): string {
    return this.kycLevel ?? 'basic';
  }
}