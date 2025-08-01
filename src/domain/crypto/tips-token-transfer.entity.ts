export class TipsTokenTransfer {
  constructor(
    public readonly id: number,
    public readonly fromUserId: number,
    public readonly toUserId: number,
    public readonly amount: number,
    public readonly reason: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToSender(userId: number): boolean {
    return this.fromUserId === userId;
  }

  belongsToReceiver(userId: number): boolean {
    return this.toUserId === userId;
  }

  involveUser(userId: number): boolean {
    return this.belongsToSender(userId) || this.belongsToReceiver(userId);
  }

  getAmount(): number {
    return this.amount;
  }

  getReason(): string {
    return this.reason ?? 'Sebep belirtilmemiş';
  }

  hasReason(): boolean {
    return this.reason !== null && this.reason.trim().length > 0;
  }

  isLargeTransfer(): boolean {
    return this.amount >= 1000;
  }

  isRecentTransfer(): boolean {
    const daysSinceTransfer = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceTransfer <= 7;
  }

  getTransferAmountFormatted(): string {
    if (this.amount >= 1000000) return `${(this.amount / 1000000).toFixed(1)}M`;
    if (this.amount >= 1000) return `${(this.amount / 1000).toFixed(1)}K`;
    return this.amount.toString();
  }

  getTransferType(): 'TIP' | 'REWARD' | 'GIFT' | 'OTHER' {
    const reason = this.reason?.toLowerCase() || '';
    if (reason.includes('tip') || reason.includes('bahşiş')) return 'TIP';
    if (reason.includes('ödül') || reason.includes('reward')) return 'REWARD';
    if (reason.includes('hediye') || reason.includes('gift')) return 'GIFT';
    return 'OTHER';
  }

  getTransferTypeDisplayName(): string {
    switch (this.getTransferType()) {
      case 'TIP': return 'Bahşiş';
      case 'REWARD': return 'Ödül';
      case 'GIFT': return 'Hediye';
      case 'OTHER': return 'Diğer';
    }
  }

  getTransferIcon(): string {
    switch (this.getTransferType()) {
      case 'TIP': return '💰';
      case 'REWARD': return '🏆';
      case 'GIFT': return '🎁';
      case 'OTHER': return '💸';
    }
  }
}