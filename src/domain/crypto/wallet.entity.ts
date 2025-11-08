import { WalletProvider } from './wallet-provider.enum';

export class Wallet {
  constructor(
    public readonly id: string,
    public readonly userId: number,
    public readonly publicAddress: string,
    public readonly provider: WalletProvider,
    public readonly isConnected: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Essential business methods only
  belongsToUser(userId: number): boolean {
    return this.userId === userId;
  }

  isActive(): boolean {
    return this.isConnected;
  }

  getShortAddress(): string {
    if (this.publicAddress.length < 10) return this.publicAddress;
    return `${this.publicAddress.slice(0, 6)}...${this.publicAddress.slice(-4)}`;
  }

  isMetaMask(): boolean {
    return this.provider === WalletProvider.METAMASK;
  }

  isWalletConnect(): boolean {
    return this.provider === WalletProvider.WALLETCONNECT;
  }

  isCustom(): boolean {
    return this.provider === WalletProvider.CUSTOM;
  }

  getProviderDisplayName(): string {
    switch (this.provider) {
      case WalletProvider.METAMASK: return 'MetaMask';
      case WalletProvider.WALLETCONNECT: return 'WalletConnect';
      case WalletProvider.CUSTOM: return 'Özel Cüzdan';
    }
  }

  getProviderIcon(): string {
    switch (this.provider) {
      case WalletProvider.METAMASK: return '🦊';
      case WalletProvider.WALLETCONNECT: return '🔗';
      case WalletProvider.CUSTOM: return '💼';
    }
  }

  isValidAddress(): boolean {
    // Basic Ethereum address validation (starts with 0x and 42 chars)
    return this.publicAddress.startsWith('0x') && this.publicAddress.length === 42;
  }

  getConnectionStatus(): 'CONNECTED' | 'DISCONNECTED' {
    return this.isConnected ? 'CONNECTED' : 'DISCONNECTED';
  }

  getConnectionStatusColor(): string {
    return this.isConnected ? '#22c55e' : '#ef4444'; // Green : Red
  }

  getDaysSinceConnection(): number {
    return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  isRecentlyConnected(): boolean {
    return this.getDaysSinceConnection() <= 7;
  }
}