export enum WalletProvider {
  METAMASK = 'METAMASK',
  WALLETCONNECT = 'WALLETCONNECT', 
  CUSTOM = 'CUSTOM',
  THIRDWEB = 'THIRDWEB'
}

export class Wallet {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    /** EIP-7702 EOA wallet adresi */
    public readonly publicAddress: string,
    /** ERC-4337 Smart Account adresi (Account Abstraction) */
    public readonly smartAccountAddress: string | null,
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

  getShortSmartAccountAddress(): string | null {
    if (!this.smartAccountAddress) return null;
    if (this.smartAccountAddress.length < 10) return this.smartAccountAddress;
    return `${this.smartAccountAddress.slice(0, 6)}...${this.smartAccountAddress.slice(-4)}`;
  }

  /**
   * ERC-4337 Smart Account adresi var mı?
   */
  hasSmartAccount(): boolean {
    return !!this.smartAccountAddress;
  }

  getProviderIcon(): string {
    switch (this.provider) {
      case WalletProvider.METAMASK:
        return '🦊';
      case WalletProvider.WALLETCONNECT:
        return '🔗';
      case WalletProvider.CUSTOM:
        return '💼';
      case WalletProvider.THIRDWEB:
        return '🔮';
      default:
        return '💰';
    }
  }
}