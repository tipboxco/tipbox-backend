export enum WalletProvider {
  METAMASK = 'METAMASK',
  WALLETCONNECT = 'WALLETCONNECT', 
  CUSTOM = 'CUSTOM'
}

export class Wallet {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly publicAddress: string,
    public readonly provider: WalletProvider,
    public readonly isConnected: boolean,
    public readonly balance: number = 0,
    public readonly lockedBalance: number = 0,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Business logic methods
  isActive(): boolean {
    return this.isConnected;
  }

  getAvailableBalance(): number {
    return Math.max(0, this.balance - this.lockedBalance);
  }

  hasBalance(amount: number): boolean {
    return this.getAvailableBalance() >= amount;
  }

  canLock(amount: number): boolean {
    return this.getAvailableBalance() >= amount;
  }

  getShortAddress(): string {
    if (this.publicAddress.length < 10) return this.publicAddress;
    return `${this.publicAddress.slice(0, 6)}...${this.publicAddress.slice(-4)}`;
  }

  getProviderIcon(): string {
    switch (this.provider) {
      case WalletProvider.METAMASK:
        return '🦊';
      case WalletProvider.WALLETCONNECT:
        return '🔗';
      case WalletProvider.CUSTOM:
        return '💼';
      default:
        return '💰';
    }
  }
}