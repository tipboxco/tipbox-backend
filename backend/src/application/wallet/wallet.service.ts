import { Wallet, WalletProvider } from '../../domain/wallet/wallet.entity';
import { WalletPrismaRepository } from '../../infrastructure/repositories/wallet-prisma.repository';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import logger from '../../infrastructure/logger/logger';
import {
  InsufficientBalanceError,
  WalletProviderAuthFailedError,
  WalletProviderNotConfiguredError,
} from '../../infrastructure/errors/custom-errors';
import {
  getActiveWalletProviderEnum,
  getWalletProvider,
} from './provider/wallet-provider.factory';
import { invalidateWalletCache } from '../../infrastructure/cache/cache-invalidation';

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

    const provider = getWalletProvider();
    if (!provider.isConfigured()) return;

    try {
      const auth = await provider.authenticateAndGetAddresses(userId);
      if (!auth.success || !auth.eoaAddress) return;

      await this.connectWallet(
        userId,
        auth.eoaAddress,
        getActiveWalletProviderEnum(),
        auth.smartAccountAddress,
      );
      logger.info({
        userId,
        eoaAddress: auth.eoaAddress,
        smartAccountAddress: auth.smartAccountAddress,
        message: 'Wallet created from provider session (ensureWalletForUser)',
      });
    } catch (err) {
      logger.warn({
        userId,
        error: err instanceof Error ? err.message : String(err),
        message: 'ensureWalletForUser: provider session or wallet create failed',
      });
    }
  }

  /**
   * Sadece Thirdweb wallet connect ile yeni wallet oluşturur. Mock/sahte adres kullanılmaz.
   * Thirdweb yapılandırılmamışsa veya kullanıcı Thirdweb oturumu yoksa hata fırlatır.
   */
  async createWalletViaThirdweb(userId: string): Promise<Wallet> {
    return this.createWalletViaProvider(userId);
  }

  async createWalletViaProvider(userId: string): Promise<Wallet> {
    const provider = getWalletProvider();
    if (!provider.isConfigured()) {
      throw new WalletProviderNotConfiguredError(
        'Wallet oluşturmak için wallet provider yapılandırması gerekli. İlgili ortam değişkenlerini kontrol edin.',
      );
    }

    let auth: { success: boolean; eoaAddress?: string; smartAccountAddress?: string };
    try {
      auth = await provider.authenticateAndGetAddresses(userId);
    } catch (err) {
      logger.warn({ userId, error: err, message: 'Provider authenticateAndGetAddresses failed' });
      throw new WalletProviderAuthFailedError(
        'Cüzdan oluşturmak için önce uygulama içinde wallet connect yapılmalı.',
      );
    }

    if (!auth.success || !auth.eoaAddress) {
      throw new WalletProviderAuthFailedError(
        'Wallet provider oturumu bulunamadı. Lütfen önce uygulama içinde cüzdan bağlayın.',
      );
    }

    const wallet = await this.connectWallet(
      userId,
      auth.eoaAddress,
      getActiveWalletProviderEnum(),
      auth.smartAccountAddress ?? undefined,
    );
    logger.info({
      userId,
      eoaAddress: auth.eoaAddress,
      smartAccountAddress: auth.smartAccountAddress,
      message: 'Wallet created via provider (createWalletViaProvider)',
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
    logger.info({
      walletId,
      amount,
      metadata,
      message: 'Updating wallet balance (atomic increment)',
    });

    // Atomic increment — race condition olmadan balance günceller
    const updatedWallet = await this.walletRepo.incrementBalance(walletId, amount);
    if (!updatedWallet) {
      // incrementBalance null dönerse: wallet yok veya yetersiz bakiye (negatif olurdu)
      const wallet = await this.walletRepo.findById(walletId);
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      throw new InsufficientBalanceError(
        `Insufficient balance. Current: ${wallet.balance}, Required: ${Math.abs(amount)}`
      );
    }

    // Cache invalidation
    invalidateWalletCache(updatedWallet.userId).catch((err) => {
      logger.warn('Failed to invalidate wallet cache after balance update', { error: err instanceof Error ? err.message : String(err) });
    });

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

    // Cache invalidation
    invalidateWalletCache(wallet.userId).catch((err) => {
      logger.warn('Failed to invalidate wallet cache after locked balance update', { error: err instanceof Error ? err.message : String(err) });
    });

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

    // Pending/created transaction varken sync YAPMA — chain henüz güncel olmayabilir ve
    // DB balance'ı eski değere geri yazarak confirmTransaction sonuçlarını ezebilir.
    const { getPrisma: getPrismaClient } = await import('../../infrastructure/repositories/prisma.client');
    const prisma = getPrismaClient();
    const pendingCount = await prisma.transaction.count({
      where: {
        walletId,
        status: { in: ['pending', 'created'] },
      },
    });
    if (pendingCount > 0) {
      logger.info({
        walletId,
        pendingCount,
        message: 'Skipping balance sync: pending/created transactions exist',
      });
      return { success: false, error: 'Pending transactions exist, sync skipped' };
    }

    const address = wallet.smartAccountAddress ?? wallet.publicAddress;
    const provider = getWalletProvider();
    if (!provider.isConfigured()) {
      logger.debug({ walletId, message: 'Wallet provider not configured, skipping balance sync' });
      return { success: false, error: 'Wallet provider not configured' };
    }
    try {
      const [balanceResult, pendingResult] = await Promise.all([
        provider.getTokenBalanceForAddress(address),
        provider.getPendingTips(address),
      ]);
      const balance = balanceResult.balanceFormatted ?? 0;
      const lockedBalance = pendingResult.pendingFormatted ?? 0;
      await this.walletRepo.setBalance(walletId, balance, lockedBalance);

      // Cache invalidation
      invalidateWalletCache(wallet.userId).catch((err) => {
        logger.warn('Failed to invalidate wallet cache', { error: err instanceof Error ? err.message : String(err) });
      });

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
    const wallet = await this.walletRepo.findById(walletId);
    const result = await this.walletRepo.setBalance(walletId, balance, lockedBalance);
    if (wallet) {
      invalidateWalletCache(wallet.userId).catch((err) => {
        logger.warn('Failed to invalidate wallet cache', { error: err instanceof Error ? err.message : String(err) });
      });
    }
    return result;
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

    // Cache invalidation
    invalidateWalletCache(updatedWallet.userId).catch((err) => {
      logger.warn('Failed to invalidate wallet cache after setBalance', { error: err instanceof Error ? err.message : String(err) });
    });

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

    // Cache invalidation
    invalidateWalletCache(userId).catch((err) => {
      logger.warn('Failed to invalidate wallet cache after connect', { error: err instanceof Error ? err.message : String(err) });
    });

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
      // Cache invalidation
      invalidateWalletCache(wallet.userId).catch((err) => {
        logger.warn('Failed to invalidate wallet cache after disconnect', { error: err instanceof Error ? err.message : String(err) });
      });

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
   * Kullanıcının Thirdweb wallet'ını getirir (geriye dönük uyumluluk için korunur).
   */
  async getThirdwebWallet(userId: string): Promise<Wallet | null> {
    const wallets = await this.walletRepo.findByUserId(userId);
    return wallets.find((w) => w.provider === WalletProvider.THIRDWEB) || null;
  }

  /**
   * Aktif provider'a ait kullanıcı wallet'ını getirir.
   * WALLET_PROVIDER env değişkenine göre doğru provider wallet'ı döner.
   */
  async getActiveProviderWallet(userId: string): Promise<Wallet | null> {
    const wallets = await this.walletRepo.findByUserId(userId);
    const activeEnum = getActiveWalletProviderEnum();
    return wallets.find((w) => w.provider === activeEnum) || null;
  }

}