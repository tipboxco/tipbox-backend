/**
 * ThirdwebWalletService
 * 
 * Thirdweb embedded wallet için blockchain işlemleri:
 * - Native token balance
 * - ERC20 token bakiyesi ve listesi
 * - NFT listeleme ve transfer
 * - Wallet disconnect
 * 
 * @see https://portal.thirdweb.com/typescript/v5
 */

import logger from '../logger/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface TokenBalance {
  contractAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  logoUrl?: string;
}

export interface NftItem {
  contractAddress: string;
  tokenId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  tokenType: 'ERC721' | 'ERC1155';
  balance?: string; // ERC1155 için
}

export interface WalletBalanceResult {
  success: boolean;
  nativeBalance?: {
    symbol: string;
    balance: string;
    balanceFormatted: string;
  };
  tokens?: TokenBalance[];
  error?: string;
}

export interface WalletNftsResult {
  success: boolean;
  nfts?: NftItem[];
  totalCount?: number;
  error?: string;
}

export interface TransferResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

// Chain configuration
export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  nativeCurrency: {
    symbol: string;
    decimals: number;
  };
  blockExplorerUrl?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class ThirdwebWalletService {
  private readonly apiBaseUrl = 'https://api.thirdweb.com';
  private readonly clientId: string;
  private readonly secretKey: string;
  private readonly defaultChainId: number;

  // Desteklenen chain'ler
  private readonly chains: Map<number, ChainConfig> = new Map([
    [1, {
      chainId: 1,
      name: 'Ethereum Mainnet',
      rpcUrl: 'https://eth.llamarpc.com',
      nativeCurrency: { symbol: 'ETH', decimals: 18 },
      blockExplorerUrl: 'https://etherscan.io',
    }],
    [137, {
      chainId: 137,
      name: 'Polygon Mainnet',
      rpcUrl: 'https://polygon-rpc.com',
      nativeCurrency: { symbol: 'MATIC', decimals: 18 },
      blockExplorerUrl: 'https://polygonscan.com',
    }],
    [8453, {
      chainId: 8453,
      name: 'Base Mainnet',
      rpcUrl: 'https://mainnet.base.org',
      nativeCurrency: { symbol: 'ETH', decimals: 18 },
      blockExplorerUrl: 'https://basescan.org',
    }],
    [11155111, {
      chainId: 11155111,
      name: 'Sepolia Testnet',
      rpcUrl: 'https://sepolia.infura.io/v3/YOUR_KEY',
      nativeCurrency: { symbol: 'ETH', decimals: 18 },
      blockExplorerUrl: 'https://sepolia.etherscan.io',
    }],
  ]);

  constructor() {
    this.clientId = process.env.THIRDWEB_CLIENT_ID || '';
    this.secretKey = process.env.THIRDWEB_SECRET_KEY || '';
    this.defaultChainId = parseInt(process.env.THIRDWEB_DEFAULT_CHAIN_ID || '137', 10); // Polygon default

    if (!this.clientId && !this.secretKey) {
      logger.warn('THIRDWEB_CLIENT_ID veya THIRDWEB_SECRET_KEY ayarlanmamış.');
    }
  }

  // ==========================================================================
  // WALLET BALANCE
  // ==========================================================================

  /**
   * Wallet'ın native token ve ERC20 bakiyelerini getirir
   */
  async getWalletBalance(
    walletAddress: string,
    chainId?: number
  ): Promise<WalletBalanceResult> {
    const chain = chainId || this.defaultChainId;

    try {
      logger.debug({
        message: 'Wallet balance sorgulanıyor',
        walletAddress,
        chainId: chain,
      });

      // Thirdweb API ile balance sorgula
      const response = await fetch(
        `${this.apiBaseUrl}/v1/wallets/${walletAddress}/balances?chainId=${chain}`,
        {
          method: 'GET',
          headers: this.buildHeaders(),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({
          message: 'Wallet balance sorgusu başarısız',
          status: response.status,
          error: errorText,
        });

        return {
          success: false,
          error: `Failed to get balance: ${response.status}`,
        };
      }

      const data = await response.json();

      // Native balance
      const chainConfig = this.chains.get(chain);
      const nativeBalance = {
        symbol: chainConfig?.nativeCurrency.symbol || 'ETH',
        balance: data.nativeBalance?.value || '0',
        balanceFormatted: this.formatBalance(
          data.nativeBalance?.value || '0',
          chainConfig?.nativeCurrency.decimals || 18
        ),
      };

      // ERC20 tokens
      const tokens: TokenBalance[] = (data.tokens || []).map((token: any) => ({
        contractAddress: token.contractAddress,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        balance: token.balance,
        balanceFormatted: this.formatBalance(token.balance, token.decimals),
        logoUrl: token.logo,
      }));

      return {
        success: true,
        nativeBalance,
        tokens,
      };
    } catch (error) {
      logger.error({
        message: 'Wallet balance hatası',
        walletAddress,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Belirli bir ERC20 token'ın bakiyesini getirir
   */
  async getTokenBalance(
    walletAddress: string,
    tokenContractAddress: string,
    chainId?: number
  ): Promise<TokenBalance | null> {
    const chain = chainId || this.defaultChainId;

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/v1/contract/${chain}/${tokenContractAddress}/erc20/balance-of?address=${walletAddress}`,
        {
          method: 'GET',
          headers: this.buildHeaders(),
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      return {
        contractAddress: tokenContractAddress,
        symbol: data.symbol || 'TOKEN',
        name: data.name || 'Unknown Token',
        decimals: data.decimals || 18,
        balance: data.value || '0',
        balanceFormatted: this.formatBalance(data.value || '0', data.decimals || 18),
      };
    } catch (error) {
      logger.error({
        message: 'Token balance hatası',
        walletAddress,
        tokenContractAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  // ==========================================================================
  // NFT OPERATIONS
  // ==========================================================================

  /**
   * Wallet'ın sahip olduğu NFT'leri getirir
   */
  async getWalletNfts(
    walletAddress: string,
    chainId?: number,
    options?: { limit?: number; cursor?: string }
  ): Promise<WalletNftsResult> {
    const chain = chainId || this.defaultChainId;

    try {
      logger.debug({
        message: 'Wallet NFT\'leri sorgulanıyor',
        walletAddress,
        chainId: chain,
      });

      let url = `${this.apiBaseUrl}/v1/wallets/${walletAddress}/nfts?chainId=${chain}`;
      if (options?.limit) url += `&limit=${options.limit}`;
      if (options?.cursor) url += `&cursor=${options.cursor}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({
          message: 'Wallet NFT sorgusu başarısız',
          status: response.status,
          error: errorText,
        });

        return {
          success: false,
          error: `Failed to get NFTs: ${response.status}`,
        };
      }

      const data = await response.json();

      const nfts: NftItem[] = (data.nfts || data.result || []).map((nft: any) => ({
        contractAddress: nft.contractAddress || nft.contract?.address,
        tokenId: nft.tokenId?.toString() || nft.id?.tokenId,
        name: nft.metadata?.name || nft.name || `NFT #${nft.tokenId}`,
        description: nft.metadata?.description || nft.description,
        imageUrl: nft.metadata?.image || nft.image || nft.media?.[0]?.gateway,
        metadata: nft.metadata,
        tokenType: nft.tokenType || nft.type || 'ERC721',
        balance: nft.balance?.toString(),
      }));

      return {
        success: true,
        nfts,
        totalCount: data.totalCount || nfts.length,
      };
    } catch (error) {
      logger.error({
        message: 'Wallet NFT hatası',
        walletAddress,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Belirli bir NFT koleksiyonundaki NFT'leri getirir
   */
  async getNftsFromCollection(
    walletAddress: string,
    collectionAddress: string,
    chainId?: number
  ): Promise<WalletNftsResult> {
    const chain = chainId || this.defaultChainId;

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/v1/contract/${chain}/${collectionAddress}/erc721/get-owned?ownerAddress=${walletAddress}`,
        {
          method: 'GET',
          headers: this.buildHeaders(),
        }
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to get collection NFTs: ${response.status}`,
        };
      }

      const data = await response.json();

      const nfts: NftItem[] = (data.result || []).map((nft: any) => ({
        contractAddress: collectionAddress,
        tokenId: nft.id?.toString() || nft.tokenId?.toString(),
        name: nft.metadata?.name || `NFT #${nft.id || nft.tokenId}`,
        description: nft.metadata?.description,
        imageUrl: nft.metadata?.image,
        metadata: nft.metadata,
        tokenType: 'ERC721',
      }));

      return {
        success: true,
        nfts,
        totalCount: nfts.length,
      };
    } catch (error) {
      logger.error({
        message: 'Collection NFT hatası',
        collectionAddress,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // TRANSFER OPERATIONS (Server Wallet ile)
  // ==========================================================================

  /**
   * ERC20 token transfer (Server wallet üzerinden)
   * NOT: Bu işlem için admin/server wallet gerekir
   */
  async transferToken(
    fromAddress: string,
    toAddress: string,
    tokenContractAddress: string,
    amount: string,
    chainId?: number
  ): Promise<TransferResult> {
    const chain = chainId || this.defaultChainId;

    try {
      logger.info({
        message: 'Token transfer başlatılıyor',
        fromAddress,
        toAddress,
        tokenContractAddress,
        amount,
        chainId: chain,
      });

      const response = await fetch(
        `${this.apiBaseUrl}/v1/contract/${chain}/${tokenContractAddress}/erc20/transfer`,
        {
          method: 'POST',
          headers: this.buildHeaders(),
          body: JSON.stringify({
            fromAddress,
            toAddress,
            amount,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({
          message: 'Token transfer başarısız',
          status: response.status,
          error: errorText,
        });

        return {
          success: false,
          error: `Transfer failed: ${response.status} - ${errorText}`,
        };
      }

      const data = await response.json();

      logger.info({
        message: 'Token transfer başarılı',
        transactionHash: data.transactionHash || data.queueId,
      });

      return {
        success: true,
        transactionHash: data.transactionHash || data.queueId,
      };
    } catch (error) {
      logger.error({
        message: 'Token transfer hatası',
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * NFT transfer (Server wallet üzerinden)
   */
  async transferNft(
    fromAddress: string,
    toAddress: string,
    nftContractAddress: string,
    tokenId: string,
    chainId?: number,
    tokenType: 'ERC721' | 'ERC1155' = 'ERC721',
    amount?: string // ERC1155 için
  ): Promise<TransferResult> {
    const chain = chainId || this.defaultChainId;

    try {
      logger.info({
        message: 'NFT transfer başlatılıyor',
        fromAddress,
        toAddress,
        nftContractAddress,
        tokenId,
        tokenType,
        chainId: chain,
      });

      const endpoint = tokenType === 'ERC721'
        ? `${this.apiBaseUrl}/v1/contract/${chain}/${nftContractAddress}/erc721/transfer`
        : `${this.apiBaseUrl}/v1/contract/${chain}/${nftContractAddress}/erc1155/transfer`;

      const body: Record<string, unknown> = {
        fromAddress,
        toAddress,
        tokenId,
      };

      if (tokenType === 'ERC1155' && amount) {
        body.amount = amount;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({
          message: 'NFT transfer başarısız',
          status: response.status,
          error: errorText,
        });

        return {
          success: false,
          error: `NFT transfer failed: ${response.status}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        transactionHash: data.transactionHash || data.queueId,
      };
    } catch (error) {
      logger.error({
        message: 'NFT transfer hatası',
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // WALLET MANAGEMENT
  // ==========================================================================

  /**
   * Wallet'ı disconnect et (local state temizleme)
   * NOT: Embedded wallet'lar blockchain'de "disconnect" edilemez,
   * sadece uygulama tarafında oturum sonlandırılır
   */
  async disconnectWallet(walletAddress: string): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info({
        message: 'Wallet disconnect işlemi',
        walletAddress,
      });

      // Thirdweb embedded wallet için disconnect API'si yok
      // Bu işlem uygulama tarafında yapılır (DB'de isConnected = false)
      
      return { success: true };
    } catch (error) {
      logger.error({
        message: 'Wallet disconnect hatası',
        walletAddress,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Desteklenen chain listesini döndürür
   */
  getSupportedChains(): ChainConfig[] {
    return Array.from(this.chains.values());
  }

  /**
   * Chain bilgisini döndürür
   */
  getChainConfig(chainId: number): ChainConfig | undefined {
    return this.chains.get(chainId);
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.secretKey) {
      headers['x-secret-key'] = this.secretKey;
    }

    if (this.clientId) {
      headers['x-client-id'] = this.clientId;
    }

    return headers;
  }

  /**
   * Wei/token unit'i formatlar
   */
  private formatBalance(balance: string, decimals: number): string {
    try {
      const value = BigInt(balance);
      const divisor = BigInt(10 ** decimals);
      const integerPart = value / divisor;
      const remainder = value % divisor;
      
      const remainderStr = remainder.toString().padStart(decimals, '0');
      const significantDecimals = remainderStr.slice(0, 6).replace(/0+$/, '');
      
      if (significantDecimals) {
        return `${integerPart}.${significantDecimals}`;
      }
      return integerPart.toString();
    } catch {
      return '0';
    }
  }

  /**
   * Servisin yapılandırılıp yapılandırılmadığını kontrol eder
   */
  isConfigured(): boolean {
    return !!(this.clientId || this.secretKey);
  }
}

// Singleton instance
let thirdwebWalletServiceInstance: ThirdwebWalletService | null = null;

export function getThirdwebWalletService(): ThirdwebWalletService {
  if (!thirdwebWalletServiceInstance) {
    thirdwebWalletServiceInstance = new ThirdwebWalletService();
  }
  return thirdwebWalletServiceInstance;
}
