import { Wallet, WalletProvider } from '../../domain/wallet/wallet.entity';
import { WalletPrismaRepository } from '../../infrastructure/repositories/wallet-prisma.repository';

export class WalletService {
  constructor(private readonly walletRepo = new WalletPrismaRepository()) {}

  async getUserWallets(userId: number): Promise<Wallet[]> {
    return this.walletRepo.findByUserId(userId);
  }

  async getActiveWallet(userId: number): Promise<Wallet | null> {
    return this.walletRepo.findActiveByUserId(userId);
  }

  async connectWallet(userId: number, publicAddress: string, provider: WalletProvider): Promise<Wallet> {
    // Aynı adres zaten var mı kontrol et
    const existingWallets = await this.walletRepo.findByUserId(userId);
    const existing = existingWallets.find(w => w.publicAddress.toLowerCase() === publicAddress.toLowerCase());
    
    if (existing) {
      // Var olan wallet'ı aktif yap
      const updatedWallet = await this.walletRepo.updateConnectionStatus(existing.id, true);
      if (!updatedWallet) {
        throw new Error('Failed to update wallet connection status');
      }
      return updatedWallet;
    }

    // Yeni wallet oluştur
    return this.walletRepo.create(userId, publicAddress, provider, true);
  }

  async disconnectWallet(walletId: number): Promise<Wallet | null> {
    return this.walletRepo.updateConnectionStatus(walletId, false);
  }

  async switchActiveWallet(walletId: number): Promise<Wallet | null> {
    return this.walletRepo.updateConnectionStatus(walletId, true);
  }

  async removeWallet(walletId: number): Promise<boolean> {
    return this.walletRepo.delete(walletId);
  }

  async getWalletById(walletId: number): Promise<Wallet | null> {
    return this.walletRepo.findById(walletId);
  }

  // Utility methods
  validateWalletAddress(address: string): boolean {
    // Basic Ethereum address validation
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    return ethAddressRegex.test(address);
  }

  formatWalletForDisplay(wallet: Wallet): { shortAddress: string; icon: string; provider: string } {
    return {
      shortAddress: wallet.getShortAddress(),
      icon: wallet.getProviderIcon(),
      provider: wallet.provider
    };
  }
}