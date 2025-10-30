import { NFTMarketListingStatus } from './nft-market-listing-status.enum';

export class NFTMarketListing {
  constructor(
    public readonly id: string,
    public readonly nftId: number,
    public readonly listedByUserId: number,
    public readonly price: number,
    public readonly status: NFTMarketListingStatus,
    public readonly listedAt: Date,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToNFT(nftId: number): boolean {
    return this.nftId === nftId;
  }

  belongsToUser(userId: number): boolean {
    return this.listedByUserId === userId;
  }

  isActive(): boolean {
    return this.status === NFTMarketListingStatus.ACTIVE;
  }

  isSold(): boolean {
    return this.status === NFTMarketListingStatus.SOLD;
  }

  isCancelled(): boolean {
    return this.status === NFTMarketListingStatus.CANCELLED;
  }

  getPrice(): number {
    return this.price;
  }

  isHighPriced(): boolean {
    return this.price >= 1000;
  }

  isRecentlyListed(): boolean {
    const daysSinceListed = Math.floor(
      (Date.now() - this.listedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceListed <= 7;
  }

  getDaysSinceListed(): number {
    return Math.floor((Date.now() - this.listedAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  getStatusDisplayName(): string {
    switch (this.status) {
      case NFTMarketListingStatus.ACTIVE: return 'Aktif';
      case NFTMarketListingStatus.SOLD: return 'Satıldı';
      case NFTMarketListingStatus.CANCELLED: return 'İptal Edildi';
    }
  }

  getStatusColor(): string {
    switch (this.status) {
      case NFTMarketListingStatus.ACTIVE: return '#22c55e';      // Green
      case NFTMarketListingStatus.SOLD: return '#3b82f6';       // Blue
      case NFTMarketListingStatus.CANCELLED: return '#6b7280';  // Gray
    }
  }

  getStatusIcon(): string {
    switch (this.status) {
      case NFTMarketListingStatus.ACTIVE: return '🟢';
      case NFTMarketListingStatus.SOLD: return '✅';
      case NFTMarketListingStatus.CANCELLED: return '❌';
    }
  }

  getPriceFormatted(): string {
    if (this.price >= 1000000) return `${(this.price / 1000000).toFixed(1)}M TIPS`;
    if (this.price >= 1000) return `${(this.price / 1000).toFixed(1)}K TIPS`;
    return `${this.price} TIPS`;
  }

  getPriceCategory(): 'BUDGET' | 'MODERATE' | 'PREMIUM' | 'LUXURY' {
    if (this.price >= 10000) return 'LUXURY';
    if (this.price >= 1000) return 'PREMIUM';
    if (this.price >= 100) return 'MODERATE';
    return 'BUDGET';
  }

  getPriceCategoryDisplayName(): string {
    switch (this.getPriceCategory()) {
      case 'BUDGET': return 'Uygun Fiyatlı';
      case 'MODERATE': return 'Orta Seviye';
      case 'PREMIUM': return 'Premium';
      case 'LUXURY': return 'Lüks';
    }
  }

  canBeCancelled(): boolean {
    return this.isActive();
  }

  canBePurchased(): boolean {
    return this.isActive();
  }
}