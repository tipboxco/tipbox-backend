export class NFTClaim {
  constructor(
    public readonly id: number,
    public readonly userId: number,
    public readonly nftId: number | null,
    public readonly tipsAmount: number,
    public readonly claimedAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToUser(userId: number): boolean {
    return this.userId === userId;
  }

  belongsToNFT(nftId: number): boolean {
    return this.nftId === nftId;
  }

  hasNFT(): boolean {
    return this.nftId !== null;
  }

  getTipsAmount(): number {
    return this.tipsAmount;
  }

  isHighValueClaim(): boolean {
    return this.tipsAmount >= 1000;
  }

  isRecentClaim(): boolean {
    const daysSinceClaim = Math.floor(
      (Date.now() - this.claimedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceClaim <= 7;
  }

  getDaysSinceClaim(): number {
    return Math.floor((Date.now() - this.claimedAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  getClaimType(): 'NFT_WITH_TIPS' | 'TIPS_ONLY' {
    return this.hasNFT() ? 'NFT_WITH_TIPS' : 'TIPS_ONLY';
  }

  getClaimTypeDisplayName(): string {
    return this.hasNFT() ? 'NFT + Tips' : 'Sadece Tips';
  }

  getClaimIcon(): string {
    return this.hasNFT() ? '🎁' : '💰';
  }

  getTipsAmountFormatted(): string {
    if (this.tipsAmount >= 1000000) return `${(this.tipsAmount / 1000000).toFixed(1)}M TIPS`;
    if (this.tipsAmount >= 1000) return `${(this.tipsAmount / 1000).toFixed(1)}K TIPS`;
    return `${this.tipsAmount} TIPS`;
  }

  getClaimValue(): number {
    // Base value is tips amount
    let value = this.tipsAmount;
    
    // If includes NFT, add estimated NFT value
    if (this.hasNFT()) {
      value += 100; // Basic NFT value estimation
    }
    
    return value;
  }

  getClaimValueCategory(): 'SMALL' | 'MEDIUM' | 'LARGE' | 'MASSIVE' {
    const value = this.getClaimValue();
    if (value >= 10000) return 'MASSIVE';
    if (value >= 1000) return 'LARGE';
    if (value >= 100) return 'MEDIUM';
    return 'SMALL';
  }

  getClaimValueCategoryDisplayName(): string {
    switch (this.getClaimValueCategory()) {
      case 'SMALL': return 'Küçük Ödül';
      case 'MEDIUM': return 'Orta Ödül';
      case 'LARGE': return 'Büyük Ödül';
      case 'MASSIVE': return 'Dev Ödül';
    }
  }

  getClaimValueCategoryColor(): string {
    switch (this.getClaimValueCategory()) {
      case 'SMALL': return '#9ca3af';      // Gray
      case 'MEDIUM': return '#3b82f6';     // Blue
      case 'LARGE': return '#8b5cf6';      // Purple
      case 'MASSIVE': return '#f59e0b';    // Gold
    }
  }

  getTimeAgo(): string {
    const days = this.getDaysSinceClaim();
    
    if (days === 0) return 'Bugün';
    if (days === 1) return 'Dün';
    if (days < 7) return `${days} gün önce`;
    if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
    if (days < 365) return `${Math.floor(days / 30)} ay önce`;
    return `${Math.floor(days / 365)} yıl önce`;
  }
}