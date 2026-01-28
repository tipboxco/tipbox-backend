/**
 * ThirdwebSdkService
 * 
 * Thirdweb SDK v5 kullanarak wallet ve smart account işlemleri.
 * HTTP API yerine doğrudan SDK kullanır - daha güvenilir ve hızlı.
 * 
 * Özellikler:
 * - In-App Wallet (Custom Auth)
 * - Smart Account (ERC-4337)
 * - EOA ve Smart Account adresleri
 * 
 * @see https://portal.thirdweb.com/typescript/v5
 */

import { createThirdwebClient, defineChain } from 'thirdweb';
import { inAppWallet, smartWallet } from 'thirdweb/wallets';
import type { Account, Wallet } from 'thirdweb/wallets';
import logger from '../logger/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface ThirdwebSdkAuthResult {
  success: boolean;
  /** EIP-7702 EOA wallet adresi (In-App Wallet) */
  eoaAddress?: string;
  /** ERC-4337 Smart Account adresi */
  smartAccountAddress?: string;
  /** Thirdweb kullanıcı ID'si */
  thirdwebUserId?: string;
  error?: string;
}

export interface ThirdwebSdkConfig {
  clientId: string;
  secretKey?: string;
  chainId: number;
  sponsorGas?: boolean;
}

// ============================================================================
// SERVICE
// ============================================================================

export class ThirdwebSdkService {
  private client: ReturnType<typeof createThirdwebClient>;
  private readonly chainId: number;
  private readonly sponsorGas: boolean;
  private readonly walletId: string;

  constructor() {
    const clientId = process.env.THIRDWEB_CLIENT_ID || '';
    const secretKey = process.env.THIRDWEB_SECRET_KEY || '';

    if (!clientId && !secretKey) {
      logger.warn('THIRDWEB_CLIENT_ID veya THIRDWEB_SECRET_KEY ayarlanmamış.');
    }

    // Thirdweb client oluştur
    this.client = createThirdwebClient({
      clientId: clientId || undefined,
      secretKey: secretKey || undefined,
    });

    this.chainId = parseInt(process.env.THIRDWEB_DEFAULT_CHAIN_ID || '11155111', 10);
    this.sponsorGas = process.env.THIRDWEB_SPONSOR_GAS === 'true';
    this.walletId = process.env.THIRDWEB_WALLET_ID || 'tipbox-embedded-wallet';
  }

  // ==========================================================================
  // AUTHENTICATION & WALLET CREATION
  // ==========================================================================

  /**
   * Kullanıcı için In-App Wallet ve Smart Account oluşturur/bağlar
   * 
   * @param userId - Tipbox kullanıcı ID'si
   * @param chainId - Chain ID (opsiyonel)
   * @returns EOA ve Smart Account adresleri
   */
  async authenticateAndGetAddresses(
    userId: string,
    chainId?: number
  ): Promise<ThirdwebSdkAuthResult> {
    const chain = defineChain(chainId || this.chainId);

    try {
      logger.info({
        message: 'Thirdweb SDK authentication başlatılıyor',
        userId,
        chainId: chain.id,
        walletId: this.walletId,
      });

      // 1. In-App Wallet oluştur (Custom Auth Endpoint ile)
      const wallet = inAppWallet({
        auth: {
          options: ['auth_endpoint'],
        },
      });

      // 2. Wallet'ı bağla (auth_endpoint strategy ile)
      // Backend'de custom auth endpoint kullanıyoruz
      const eoaAccount = await wallet.connect({
        client: this.client,
        strategy: 'auth_endpoint',
        payload: JSON.stringify({
          userId,
          walletId: this.walletId,
          timestamp: Date.now(),
        }),
      });

      const eoaAddress = eoaAccount.address;

      logger.info({
        message: 'In-App Wallet bağlandı',
        userId,
        eoaAddress,
      });

      // 3. Smart Wallet oluştur
      const smart = smartWallet({
        chain,
        sponsorGas: this.sponsorGas,
      });

      // 4. Smart Account'u EOA ile bağla
      const smartAccount = await smart.connect({
        client: this.client,
        personalAccount: eoaAccount,
      });

      const smartAccountAddress = smartAccount.address;

      logger.info({
        message: 'Smart Account bağlandı',
        userId,
        eoaAddress,
        smartAccountAddress,
        chainId: chain.id,
      });

      return {
        success: true,
        eoaAddress,
        smartAccountAddress,
      };
    } catch (error) {
      logger.error({
        message: 'Thirdweb SDK authentication hatası',
        userId,
        chainId: chain.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Private key ile Smart Account adresi hesaplar
   * (Test ve admin işlemleri için)
   */
  async getSmartAccountFromPrivateKey(
    privateKey: string,
    chainId?: number
  ): Promise<ThirdwebSdkAuthResult> {
    const chain = defineChain(chainId || this.chainId);

    try {
      // Dynamic import for privateKeyAccount
      const { privateKeyAccount } = await import('thirdweb/wallets');

      // EOA oluştur
      const eoaAccount = privateKeyAccount({
        client: this.client,
        privateKey,
      });

      const eoaAddress = eoaAccount.address;

      // Smart Wallet oluştur
      const smart = smartWallet({
        chain,
        sponsorGas: this.sponsorGas,
      });

      // Smart Account'u bağla
      const smartAccount = await smart.connect({
        client: this.client,
        personalAccount: eoaAccount,
      });

      return {
        success: true,
        eoaAddress,
        smartAccountAddress: smartAccount.address,
      };
    } catch (error) {
      logger.error({
        message: 'Private key smart account hatası',
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * EOA adresinden Smart Account adresini predict eder
   * (Deterministik hesaplama - deploy gerekmez)
   */
  async predictSmartAccountAddress(
    eoaAddress: string,
    chainId?: number
  ): Promise<{ success: boolean; smartAccountAddress?: string; error?: string }> {
    const chain = defineChain(chainId || this.chainId);

    try {
      // Thirdweb'in varsayılan account factory'sini kullan
      // Smart account adresi deterministik olarak hesaplanır
      const { predictAddress } = await import('thirdweb/wallets/smart');

      const predictedAddress = await predictAddress({
        client: this.client,
        chain,
        adminAddress: eoaAddress,
      });

      logger.debug({
        message: 'Smart account adresi predict edildi',
        eoaAddress,
        smartAccountAddress: predictedAddress,
        chainId: chain.id,
      });

      return {
        success: true,
        smartAccountAddress: predictedAddress,
      };
    } catch (error) {
      logger.error({
        message: 'Smart account predict hatası',
        eoaAddress,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // WALLET OPERATIONS
  // ==========================================================================

  /**
   * Wallet balance'ı getirir
   */
  async getWalletBalance(
    address: string,
    chainId?: number
  ): Promise<{ balance: string; formatted: string; symbol: string }> {
    const chain = defineChain(chainId || this.chainId);

    try {
      const { getWalletBalance } = await import('thirdweb/wallets');

      const balance = await getWalletBalance({
        client: this.client,
        chain,
        address,
      });

      return {
        balance: balance.value.toString(),
        formatted: balance.displayValue,
        symbol: balance.symbol,
      };
    } catch (error) {
      logger.error({
        message: 'Wallet balance hatası',
        address,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        balance: '0',
        formatted: '0',
        symbol: 'ETH',
      };
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Servisin yapılandırılıp yapılandırılmadığını kontrol eder
   */
  isConfigured(): boolean {
    return !!this.client;
  }

  /**
   * Yapılandırma bilgilerini döndürür
   */
  getConfig(): {
    chainId: number;
    sponsorGas: boolean;
    walletId: string;
    isReady: boolean;
  } {
    return {
      chainId: this.chainId,
      sponsorGas: this.sponsorGas,
      walletId: this.walletId,
      isReady: this.isConfigured(),
    };
  }

  /**
   * Chain bilgisi oluşturur
   */
  getChain(chainId?: number) {
    return defineChain(chainId || this.chainId);
  }
}

// Singleton instance
let thirdwebSdkServiceInstance: ThirdwebSdkService | null = null;

export function getThirdwebSdkService(): ThirdwebSdkService {
  if (!thirdwebSdkServiceInstance) {
    thirdwebSdkServiceInstance = new ThirdwebSdkService();
  }
  return thirdwebSdkServiceInstance;
}
