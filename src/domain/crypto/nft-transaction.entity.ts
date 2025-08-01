import { NFTTransactionType } from './nft-transaction-type.enum';

export class NFTTransaction {
  constructor(
    public readonly id: number,
    public readonly nftId: number,
    public readonly fromUserId: number | null,
    public readonly toUserId: number,
    public readonly price: number | null,
    public readonly transactionType: NFTTransactionType,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToNFT(nftId: number): boolean {
    return this.nftId === nftId;
  }

  belongsToSender(userId: number): boolean {
    return this.fromUserId === userId;
  }

  belongsToReceiver(userId: number): boolean {
    return this.toUserId === userId;
  }

  involveUser(userId: number): boolean {
    return this.belongsToSender(userId) || this.belongsToReceiver(userId);
  }

  isMint(): boolean {
    return this.transactionType === NFTTransactionType.MINT;
  }

  isTransfer(): boolean {
    return this.transactionType === NFTTransactionType.TRANSFER;
  }

  isPurchase(): boolean {
    return this.transactionType === NFTTransactionType.PURCHASE;
  }

  hasPrice(): boolean {
    return this.price !== null && this.price > 0;
  }

  getPrice(): number {
    return this.price ?? 0;
  }

  isRecentTransaction(): boolean {
    const daysSinceTransaction = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceTransaction <= 7;
  }

  getTransactionTypeDisplayName(): string {
    switch (this.transactionType) {
      case NFTTransactionType.MINT: return 'Basım';
      case NFTTransactionType.TRANSFER: return 'Transfer';
      case NFTTransactionType.PURCHASE: return 'Satın Alma';
    }
  }

  getTransactionIcon(): string {
    switch (this.transactionType) {
      case NFTTransactionType.MINT: return '🆕';
      case NFTTransactionType.TRANSFER: return '🔄';
      case NFTTransactionType.PURCHASE: return '💰';
    }
  }

  getPriceFormatted(): string {
    if (!this.hasPrice()) return 'Ücretsiz';
    const price = this.getPrice();
    if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M TIPS`;
    if (price >= 1000) return `${(price / 1000).toFixed(1)}K TIPS`;
    return `${price} TIPS`;
  }

  isFirstOwner(): boolean {
    return this.isMint();
  }

  isHighValueTransaction(): boolean {
    return this.hasPrice() && this.getPrice() >= 1000;
  }

  getTransactionStatus(): 'COMPLETED' | 'PENDING' | 'FAILED' {
    // For now, all recorded transactions are completed
    // In future, could check blockchain status
    return 'COMPLETED';
  }
}