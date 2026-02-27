import { Wallet, WalletProvider } from '../../domain/wallet/wallet.entity';
import { WalletPrismaRepository } from '../../infrastructure/repositories/wallet-prisma.repository';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import logger from '../../infrastructure/logger/logger';
import {
  InsufficientBalanceError,
  ThirdwebNotConfiguredError,
  ThirdwebWalletAuthFailedError,
} from '../../infrastructure/errors/custom-errors';
import { getThirdwebSdkService } from './thirdweb-sdk/thirdweb-sdk.service';

export class WalletService {
  constructor(
    private readonly walletRepo = new WalletPrismaRepository(),
    private readonly notificationService = new NotificationService()
  ) {}

  async getUserWallets(userId: string): Promise<Wallet[]> {
    return this.walletRepo.findByUserId(userId);
  }

  /**
   * Kullanıcının wallet'ı yoksa Thirdweb SDK ile oturum açıp wallet oluşturur ve DB'ye kaydeder.
   * Liste çağrılarından önce kullanılır (wallet yoksa otomatik oluşturma).
   */
  async ensureWalletForUser(userId: string): Promise<void> {
    const wallets = await this.walletRepo.findByUserId(userId);
    if (wallets.length > 0) return;

    const sdk = getThirdwebSdkService();
    if (!sdk.isConfigured()) return;

    try {
      const auth = await sdk.authenticateAndGetAddresses(userId);
      if (!auth.success || !auth.eoaAddress) return;

      await this.connectWallet(
        userId,
        auth.eoaAddress,
        WalletProvider.THIRDWEB,
        auth.smartAccountAddress
      );
      logger.info({
        userId,
        eoaAddress: auth.eoaAddress,
        smartAccountAddress: auth.smartAccountAddress,
        message: 'Wallet created from Thirdweb session (ensureWalletForUser)',
      });
    } catch (err) {
      logger.warn({
        userId,
        error: err instanceof Error ? err.message : String(err),
        message: 'ensureWalletForUser: Thirdweb session or wallet create failed',
      });
    }
  }

  /**
   * Sadece Thirdweb wallet connect ile yeni wallet oluşturur. Mock/sahte adres kullanılmaz.
   * Thirdweb yapılandırılmamışsa veya kullanıcı Thirdweb oturumu yoksa hata fırlatır.
   */
  async createWalletViaThirdweb(userId: string): Promise<Wallet> {
    const sdk = getThirdwebSdkService();
    if (!sdk.isConfigured()) {
      throw new ThirdwebNotConfiguredError(
        'Wallet oluşturmak için Thirdweb yapılandırması gerekli. THIRDWEB_CLIENT_ID ve THIRDWEB_SECRET_KEY tanımlı olmalı.'
      );
    }

    let auth: { success: boolean; eoaAddress?: string; smartAccountAddress?: string };
    try {
      auth = await sdk.authenticateAndGetAddresses(userId);
    } catch (err) {
      logger.warn({ userId, error: err, message: 'Thirdweb authenticateAndGetAddresses failed' });
      throw new ThirdwebWalletAuthFailedError(
        'Cüzdan oluşturmak için önce uygulama içinde Thirdweb ile wallet connect yapılmalı.'
      );
    }

    if (!auth.success || !auth.eoaAddress) {
      throw new ThirdwebWalletAuthFailedError(
        'Thirdweb wallet oturumu bulunamadı. Lütfen önce uygulama içinde cüzdan bağlayın (Wallet Connect).'
      );
    }

    const wallet = await this.connectWallet(
      userId,
      auth.eoaAddress,
      WalletProvider.THIRDWEB,
      auth.smartAccountAddress ?? undefined
    );
    logger.info({
      userId,
      eoaAddress: auth.eoaAddress,
      smartAccountAddress: auth.smartAccountAddress,
      message: 'Wallet created via Thirdweb (createWalletViaThirdweb)',
    });
    return wallet;
  }

  async getActiveWallet(userId: string): Promise<Wallet | null> {
    return this.walletRepo.findActiveByUserId(userId);
  }

  /**
   * Balance sorgusu için tercih edilen wallet: önce smartAccountAddress olan, yoksa aktif wallet.
   * Contract'tan balance/pending çekerken bu adres kullanılır.
   */
  async getPreferredWalletForBalance(userId: string): Promise<Wallet | null> {
    return this.walletRepo.findPreferredForReceivingByUserId(userId);
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
   * Contract'tan balance ve pendingTips çekip wallet tablosunu günceller (webhook sonrası sync).
   * Takip adresi: smart_account_address varsa o, yoksa public_address.
   */
  async syncWalletBalanceFromChain(walletId: string): Promise<{ success: boolean; error?: string }> {
    const wallet = await this.walletRepo.findById(walletId);
    if (!wallet) {
      return { success: false, error: 'Wallet not found' };
    }
    const address = wallet.smartAccountAddress ?? wallet.publicAddress;
    const sdk = getThirdwebSdkService();
    if (!sdk.isConfigured()) {
      logger.debug({ walletId, message: 'Thirdweb SDK not configured, skipping balance sync' });
      return { success: false, error: 'Thirdweb SDK not configured' };
    }
    try {
      const [balanceResult, pendingResult] = await Promise.all([
        sdk.getTokenBalanceForAddress(address),
        sdk.getPendingTips(address),
      ]);
      const balance = balanceResult.balanceFormatted ?? 0;
      const lockedBalance = pendingResult.pendingFormatted ?? 0;
      await this.walletRepo.setBalance(walletId, balance, lockedBalance);
      logger.info({
        walletId,
        address,
        balance,
        lockedBalance,
        message: 'Wallet balance synced from chain (contract + pendingTips)',
      });
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ walletId, address, error: msg, message: 'syncWalletBalanceFromChain failed' });
      return { success: false, error: msg };
    }
  }

  /**
   * Contract'tan alınan balance/lockedBalance değerlerini DB'ye yazar (sync sonrası veya /balance'dan).
   */
  async setBalanceFromContract(walletId: string, balance: number, lockedBalance: number): Promise<Wallet | null> {
    return this.walletRepo.setBalance(walletId, balance, lockedBalance);
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

  async connectWallet(
    userId: string,
    publicAddress: string,
    provider: WalletProvider,
    smartAccountAddress?: string
  ): Promise<Wallet> {
    // Mock/sahte adres kabul edilmez; wallet Thirdweb üzerinden bağlanmalı
    if (publicAddress.startsWith('0xTIPBOX_')) {
      throw new ThirdwebWalletAuthFailedError(
        'Sahte (mock) cüzdan adresi kabul edilmez. Cüzdan Thirdweb Wallet Connect ile bağlanmalı.'
      );
    }
    // Aynı adres zaten var mı kontrol et
    const existingWallets = await this.walletRepo.findByUserId(userId);
    const existing = existingWallets.find(w => w.publicAddress.toLowerCase() === publicAddress.toLowerCase());

    let wallet: Wallet;
    if (existing) {
      // Var olan wallet'ı aktif yap; smartAccountAddress verilmişse güncelle
      if (smartAccountAddress && !existing.smartAccountAddress) {
        await this.walletRepo.updateSmartAccountAddress(existing.id, smartAccountAddress);
      }
      const updatedWallet = await this.walletRepo.updateConnectionStatus(existing.id, true);
      if (!updatedWallet) {
        throw new Error('Failed to update wallet connection status');
      }
      wallet = updatedWallet;
    } else {
      // Yeni wallet oluştur (smartAccountAddress varsa kaydet)
      wallet = await this.walletRepo.create(userId, publicAddress, provider, true, smartAccountAddress);
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