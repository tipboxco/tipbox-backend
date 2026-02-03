import { Wallet, WalletProvider } from '../../domain/wallet/wallet.entity';
import { WalletPrismaRepository } from '../../infrastructure/repositories/wallet-prisma.repository';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import logger from '../../infrastructure/logger/logger';
import { InsufficientBalanceError } from '../../infrastructure/errors/custom-errors';

export class WalletService {
  constructor(
    private readonly walletRepo = new WalletPrismaRepository(),
    private readonly notificationService = new NotificationService()
  ) {}

  async getUserWallets(userId: string): Promise<Wallet[]> {
    return this.walletRepo.findByUserId(userId);
  }

  async getActiveWallet(userId: string): Promise<Wallet | null> {
    return this.walletRepo.findActiveByUserId(userId);
  }

  /**
   * Wallet'ın balance'ını getir (DB'den)
   */
  async getBalance(walletId: string): Promise<{ balance: number; lockedBalance: number }> {
    const wallet = await this.walletRepo.findById(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    return {
      balance: wallet.balance || 0,
      lockedBalance: wallet.lockedBalance || 0,
    };
  }

  /**
   * Kullanıcının aktif wallet balance'ını getir
   */
  async getUserBalance(userId: string): Promise<{ balance: number; lockedBalance: number; available: number }> {
    const wallet = await this.getActiveWallet(userId);
    if (!wallet) {
      throw new Error('No active wallet found');
    }

    const balance = wallet.balance || 0;
    const lockedBalance = wallet.lockedBalance || 0;

    return {
      balance,
      lockedBalance,
      available: Math.max(0, balance - lockedBalance),
    };
  }

  /**
   * Wallet balance'ını güncelle (add/subtract)
   * @param walletId Wallet ID
   * @param amount Miktar (pozitif = ekle, negatif = çıkar)
   * @param metadata İşlem detayları
   */
  async updateBalance(
    walletId: string,
    amount: number,
    metadata?: { reason?: string; transactionId?: string; sourceType?: string }
  ): Promise<Wallet> {
    const wallet = await this.walletRepo.findById(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const currentBalance = wallet.balance || 0;
    const newBalance = currentBalance + amount;

    // Negatif balance kontrolü
    if (newBalance < 0) {
      logger.error({
        walletId,
        currentBalance,
        amount,
        newBalance,
        metadata,
        message: 'Attempted to set negative balance',
      });
      throw new InsufficientBalanceError(
        `Insufficient balance. Current: ${currentBalance}, Required: ${Math.abs(amount)}`
      );
    }

    logger.info({
      walletId,
      userId: wallet.userId,
      currentBalance,
      amount,
      newBalance,
      metadata,
      message: 'Updating wallet balance',
    });

    const updatedWallet = await this.walletRepo.updateBalance(walletId, newBalance);
    if (!updatedWallet) {
      throw new Error('Failed to update wallet balance');
    }

    return updatedWallet;
  }

  /**
   * Locked balance'ı güncelle (lock/unlock)
   */
  async updateLockedBalance(
    walletId: string,
    amount: number,
    metadata?: { reason?: string; lockType?: string }
  ): Promise<Wallet> {
    const wallet = await this.walletRepo.findById(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const currentLocked = wallet.lockedBalance || 0;
    const newLocked = currentLocked + amount;

    // Negatif locked balance kontrolü
    if (newLocked < 0) {
      logger.error({
        walletId,
        currentLocked,
        amount,
        newLocked,
        metadata,
        message: 'Attempted to set negative locked balance',
      });
      throw new Error('Cannot unlock more than locked amount');
    }

    // Available balance kontrolü (locking için)
    if (amount > 0) {
      const currentBalance = wallet.balance || 0;
      const available = currentBalance - currentLocked;
      if (amount > available) {
        throw new InsufficientBalanceError(
          `Insufficient available balance to lock. Available: ${available}, Required: ${amount}`
        );
      }
    }

    logger.info({
      walletId,
      userId: wallet.userId,
      currentLocked,
      amount,
      newLocked,
      metadata,
      message: 'Updating wallet locked balance',
    });

    const updatedWallet = await this.walletRepo.updateLockedBalance(walletId, newLocked);
    if (!updatedWallet) {
      throw new Error('Failed to update wallet locked balance');
    }

    return updatedWallet;
  }

  /**
   * Balance'ı direkt set et (migration/admin işlemleri için)
   */
  async setBalance(walletId: string, balance: number, lockedBalance?: number): Promise<Wallet> {
    logger.warn({
      walletId,
      balance,
      lockedBalance,
      message: 'Setting wallet balance directly (admin operation)',
    });

    const updatedWallet = await this.walletRepo.setBalance(walletId, balance, lockedBalance);
    if (!updatedWallet) {
      throw new Error('Failed to set wallet balance');
    }

    return updatedWallet;
  }

  async connectWallet(userId: string, publicAddress: string, provider: WalletProvider): Promise<Wallet> {
    // Aynı adres zaten var mı kontrol et
    const existingWallets = await this.walletRepo.findByUserId(userId);
    const existing = existingWallets.find(w => w.publicAddress.toLowerCase() === publicAddress.toLowerCase());
    
    let wallet: Wallet;
    if (existing) {
      // Var olan wallet'ı aktif yap
      const updatedWallet = await this.walletRepo.updateConnectionStatus(existing.id, true);
      if (!updatedWallet) {
        throw new Error('Failed to update wallet connection status');
      }
      wallet = updatedWallet;
    } else {
      // Yeni wallet oluştur
      wallet = await this.walletRepo.create(userId, publicAddress, provider, true);
    }

    // Send notification asynchronously
    this.notificationService.sendNotification(
      userId,
      NotificationType.WALLET_CONNECTED,
      {
        walletAddress: this.formatAddressForNotification(publicAddress),
        provider,
        walletId: wallet.id,
      }
    ).catch(error => {
      logger.error('Error sending wallet connected notification:', error);
    });

    return wallet;
  }

  async disconnectWallet(walletId: string): Promise<Wallet | null> {
    const wallet = await this.walletRepo.findById(walletId);
    if (!wallet) {
      return null;
    }

    const disconnectedWallet = await this.walletRepo.updateConnectionStatus(walletId, false);

    if (disconnectedWallet) {
      // Send notification asynchronously
      this.notificationService.sendNotification(
        wallet.userId,
        NotificationType.WALLET_DISCONNECTED,
        {
          walletAddress: this.formatAddressForNotification(wallet.publicAddress),
          provider: wallet.provider,
          walletId: wallet.id,
        }
      ).catch(error => {
        logger.error('Error sending wallet disconnected notification:', error);
      });
    }

    return disconnectedWallet;
  }

  async switchActiveWallet(walletId: string): Promise<Wallet | null> {
    return this.walletRepo.updateConnectionStatus(walletId, true);
  }

  async removeWallet(walletId: string): Promise<boolean> {
    return this.walletRepo.delete(walletId);
  }

  async getWalletById(walletId: string): Promise<Wallet | null> {
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

  // Format address for notification (short version)
  private formatAddressForNotification(address: string): string {
    if (address.length <= 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }

  // ============================================================================
  // THIRDWEB INTEGRATION
  // ============================================================================

  /**
   * Kullanıcı ID'si ile Thirdweb embedded wallet oluşturur/alır
   * 
   * Bu metod:
   * 1. Kullanıcı ID'si ve walletId ile özel JWT oluşturur
   * 2. JWT'yi Thirdweb API'ye gönderir
   * 3. Thirdweb embedded wallet adresini alır
   * 4. Kullanıcı için wallet kaydı oluşturur veya mevcut olanı döndürür
   * 
   * JWT Format:
   * - sub: userId (Tipbox kullanıcı ID'si)
   * - walletId: sabit değer (THIRDWEB_WALLET_ID)
   * 
   * @param userId - Tipbox user ID
   * @returns Wallet entity ve authentication sonucu
   */
  /**
   * Kullanıcının Thirdweb wallet'ını getirir
   */
  async getThirdwebWallet(userId: string): Promise<Wallet | null> {
    const wallets = await this.walletRepo.findByUserId(userId);
    return wallets.find(w => w.provider === WalletProvider.THIRDWEB) || null;
  }

}