/**
 * ThirdwebAuthService
 * 
 * Thirdweb In-App Wallet API ile custom auth-payload authentication entegrasyonu.
 * Kullanıcı ID'si ve walletId ile embedded wallet oluşturur.
 * 
 * Auth Payload Format:
 * - userId: Tipbox kullanıcı ID'si
 * - walletId: sabit değer (THIRDWEB_WALLET_ID environment variable)
 * 
 * @see https://portal.thirdweb.com/wallets
 * @see https://portal.thirdweb.com/wallets/custom-authentication
 */

import logger from '../logger/logger';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Thirdweb auth/complete request body
 * method: "custom" ile auth-payload kullanılır
 */
export interface ThirdwebAuthCompleteRequest {
  method: 'custom';
  type: 'auth-payload';
  payload: string; // JSON stringified payload
}

/**
 * Thirdweb'e gönderilecek auth payload formatı
 */
export interface ThirdwebAuthPayload {
  userId: string;    // Tipbox kullanıcı ID'si
  walletId: string;  // Sabit wallet identifier
  timestamp: number; // İşlem zamanı (opsiyonel güvenlik için)
}

export interface ThirdwebAuthCompleteResponse {
  isNewUser: boolean;
  token: string;
  type: string;
  userId: string;
  walletAddress: string;
  // ERC-4337 Smart Account adresi (varsa)
  smartAccountAddress?: string;
}

export interface ThirdwebWalletInfoResponse {
  result: {
    profiles: Array<{
      email?: string;
      emailVerified?: boolean;
      id: string;
      type: string;
      name?: string;
      picture?: string;
    }>;
    userId: string;
    address: string;
    createdAt: string;
  };
}

export interface ThirdwebAuthResult {
  success: boolean;
  isNewUser?: boolean;
  userId?: string;
  /** EIP-7702 EOA wallet adresi */
  walletAddress?: string;
  /** ERC-4337 Smart Account adresi */
  smartAccountAddress?: string;
  thirdwebToken?: string;
  error?: string;
}

export interface ThirdwebWalletInfo {
  success: boolean;
  userId?: string;
  address?: string;
  createdAt?: string;
  profiles?: Array<{
    email?: string;
    id: string;
    type: string;
    name?: string;
  }>;
  error?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class ThirdwebAuthService {
  private readonly apiBaseUrl = 'https://api.thirdweb.com';
  private readonly clientId: string;
  private readonly secretKey: string;
  private readonly ecosystemId?: string;
  private readonly walletId: string;

  constructor() {
    this.clientId = process.env.THIRDWEB_CLIENT_ID || '';
    this.secretKey = process.env.THIRDWEB_SECRET_KEY || '';
    this.ecosystemId = process.env.THIRDWEB_ECOSYSTEM_ID;
    this.walletId = process.env.THIRDWEB_WALLET_ID || 'tipbox-embedded-wallet';

    if (!this.clientId && !this.secretKey) {
      logger.warn('THIRDWEB_CLIENT_ID veya THIRDWEB_SECRET_KEY ayarlanmamış. Thirdweb Auth çalışmayacak.');
    }
  }

  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================

  /**
   * Kullanıcı ID'si ile Thirdweb authentication tamamlar
   * Auth-payload yöntemi ile - JWT gerekmez
   * 
   * @param userId - Tipbox kullanıcı ID'si
   * @returns ThirdwebAuthResult - Wallet adresi ve kullanıcı bilgileri
   */
  async authenticateUser(userId: string): Promise<ThirdwebAuthResult> {
    try {
      // Auth payload oluştur
      const payload: ThirdwebAuthPayload = {
        userId,
        walletId: this.walletId,
        timestamp: Date.now(),
      };

      logger.debug({
        message: 'Thirdweb auth-payload oluşturuluyor',
        userId,
        walletId: this.walletId,
      });

      return this.authenticateWithPayload(payload);
    } catch (error) {
      logger.error({
        message: 'Thirdweb user authentication hatası',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create auth payload',
      };
    }
  }

  /**
   * Auth payload ile Thirdweb authentication tamamlar
   * 
   * @param payload - Auth payload (userId, walletId içerir)
   * @returns ThirdwebAuthResult - Wallet adresi ve kullanıcı bilgileri
   */
  async authenticateWithPayload(payload: ThirdwebAuthPayload): Promise<ThirdwebAuthResult> {
    try {
      const headers = this.buildHeaders();
      
      const requestBody: ThirdwebAuthCompleteRequest = {
        method: 'custom',
        type: 'auth-payload',
        payload: JSON.stringify(payload),
      };

      logger.debug({
        message: 'Thirdweb auth/complete isteği gönderiliyor',
        method: 'custom',
        type: 'auth-payload',
        hasClientId: !!this.clientId,
        hasSecretKey: !!this.secretKey,
        payload: {
          userId: payload.userId,
          walletId: payload.walletId,
        },
      });

      const response = await fetch(`${this.apiBaseUrl}/v1/auth/complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.json();
        logger.error({
          message: 'Thirdweb auth/complete başarısız',
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });

        return {
          success: false,
          error: `Thirdweb authentication failed: ${response.status} - ${errorText}`,
        };
      }

      const data: ThirdwebAuthCompleteResponse = await response.json();

      logger.info({
        message: 'Thirdweb authentication başarılı',
        isNewUser: data.isNewUser,
        userId: data.userId,
        walletAddress: data.walletAddress,
      });

      return {
        success: true,
        isNewUser: data.isNewUser,
        userId: data.userId,
        walletAddress: data.walletAddress,
        thirdwebToken: data.token,
      };
    } catch (error) {
      logger.error({
        message: 'Thirdweb authentication hatası',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // ==========================================================================
  // WALLET INFO
  // ==========================================================================

  /**
   * Thirdweb token ile wallet bilgilerini getirir
   * 
   * @param thirdwebToken - authenticateWithCustomJwt'den dönen token
   * @returns ThirdwebWalletInfo - Wallet detayları
   */
  async getWalletInfo(thirdwebToken: string): Promise<ThirdwebWalletInfo> {
    try {
      const headers = this.buildHeaders();
      headers['Authorization'] = `Bearer ${thirdwebToken}`;

      const response = await fetch(`${this.apiBaseUrl}/v1/wallets/me`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({
          message: 'Thirdweb wallets/me başarısız',
          status: response.status,
          error: errorText,
        });

        return {
          success: false,
          error: `Failed to get wallet info: ${response.status}`,
        };
      }

      const data: ThirdwebWalletInfoResponse = await response.json();

      return {
        success: true,
        userId: data.result.userId,
        address: data.result.address,
        createdAt: data.result.createdAt,
        profiles: data.result.profiles?.map(p => ({
          email: p.email,
          id: p.id,
          type: p.type,
          name: p.name,
        })),
      };
    } catch (error) {
      logger.error({
        message: 'Thirdweb wallet info hatası',
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // SMART ACCOUNT (ERC-4337)
  // ==========================================================================

  /**
   * EOA adresinden ERC-4337 Smart Account adresini hesaplar/alır
   * 
   * Thirdweb'in Account Factory'si kullanılarak smart account adresi
   * deterministik olarak hesaplanır.
   * 
   * @param eoaAddress - EIP-7702 EOA wallet adresi
   * @param chainId - Chain ID (varsayılan: defaultChainId)
   * @returns Smart Account adresi
   */
  async getSmartAccountAddress(
    eoaAddress: string,
    chainId?: number
  ): Promise<{ success: boolean; smartAccountAddress?: string; error?: string }> {
    const chain = chainId || parseInt(process.env.THIRDWEB_DEFAULT_CHAIN_ID || '137', 10);
    const accountFactoryAddress = process.env.THIRDWEB_ACCOUNT_FACTORY_ADDRESS;

    if (!accountFactoryAddress) {
      logger.warn({
        message: 'THIRDWEB_ACCOUNT_FACTORY_ADDRESS ayarlanmamış',
        eoaAddress,
      });
      return {
        success: false,
        error: 'Account factory address not configured',
      };
    }

    try {
      logger.debug({
        message: 'Smart account adresi hesaplanıyor',
        eoaAddress,
        chainId: chain,
        accountFactoryAddress,
      });

      // Thirdweb Engine API ile smart account adresini predict et
      const response = await fetch(
        `${this.apiBaseUrl}/v1/contract/${chain}/${accountFactoryAddress}/account-factory/predict-account-address?adminAddress=${eoaAddress}`,
        {
          method: 'GET',
          headers: this.buildHeaders(),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({
          message: 'Smart account address prediction başarısız',
          status: response.status,
          error: errorText,
        });

        return {
          success: false,
          error: `Failed to predict smart account address: ${response.status}`,
        };
      }

      const data = await response.json();
      const smartAccountAddress = data.result || data.address || data.predictedAddress;

      logger.info({
        message: 'Smart account adresi hesaplandı',
        eoaAddress,
        smartAccountAddress,
        chainId: chain,
      });

      return {
        success: true,
        smartAccountAddress,
      };
    } catch (error) {
      logger.error({
        message: 'Smart account address hesaplama hatası',
        eoaAddress,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Kullanıcı authentication sonrası hem EOA hem Smart Account adreslerini alır
   */
  async authenticateUserWithSmartAccount(userId: string, chainId?: number): Promise<ThirdwebAuthResult> {
    // Önce normal authentication
    const authResult = await this.authenticateUser(userId);

    if (!authResult.success || !authResult.walletAddress) {
      return authResult;
    }

    // Smart account adresini al
    const smartAccountResult = await this.getSmartAccountAddress(authResult.walletAddress, chainId);

    if (smartAccountResult.success && smartAccountResult.smartAccountAddress) {
      authResult.smartAccountAddress = smartAccountResult.smartAccountAddress;
      
      logger.info({
        message: 'Authentication with smart account başarılı',
        userId,
        eoaAddress: authResult.walletAddress,
        smartAccountAddress: authResult.smartAccountAddress,
      });
    }

    return authResult;
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Thirdweb API için header'ları oluşturur
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Backend için secret key kullan (production)
    if (this.secretKey) {
      headers['x-secret-key'] = this.secretKey;
    }

    // Frontend için client id (fallback)
    if (this.clientId) {
      headers['x-client-id'] = this.clientId;
    }

    // Ecosystem wallet kullanıyorsanız
    if (this.ecosystemId) {
      headers['x-ecosystem-id'] = this.ecosystemId;
    }

    return headers;
  }

  /**
   * Servisin düzgün yapılandırılıp yapılandırılmadığını kontrol eder
   */
  isConfigured(): boolean {
    return !!(this.clientId || this.secretKey);
  }

  /**
   * Yapılandırma durumunu döndürür (debug için)
   */
  getConfigStatus(): {
    hasClientId: boolean;
    hasSecretKey: boolean;
    hasEcosystemId: boolean;
    walletId: string;
    isReady: boolean;
  } {
    return {
      hasClientId: !!this.clientId,
      hasSecretKey: !!this.secretKey,
      hasEcosystemId: !!this.ecosystemId,
      walletId: this.walletId,
      isReady: this.isConfigured(),
    };
  }

  /**
   * Wallet ID'yi döndürür
   */
  getWalletId(): string {
    return this.walletId;
  }
}

// Singleton instance
let thirdwebAuthServiceInstance: ThirdwebAuthService | null = null;

export function getThirdwebAuthService(): ThirdwebAuthService {
  if (!thirdwebAuthServiceInstance) {
    thirdwebAuthServiceInstance = new ThirdwebAuthService();
  }
  return thirdwebAuthServiceInstance;
}
