/**
 * IWalletProvider — Provider-agnostic interface for Account Abstraction operations.
 *
 * All wallet providers (ThirdWeb, Alchemy, …) must implement this interface.
 * Business logic (WalletService, workers, routers) depends only on this interface;
 * the concrete provider is resolved at runtime via WalletProviderFactory.
 */

// Re-export shared result types so callers import from one place.
export type {
  ClaimResult,
  PendingTipsResult,
  ThirdwebSdkAuthResult as AuthResult,
  TipResult,
  TokenBalanceForAddressResult,
  WalletBalanceResult,
  WalletNFTsResult,
} from '../thirdweb-sdk/types';

/** Result of mintDefaultBadgeForUser — union avoids optional fields on success path. */
export type MintBadgeResult =
  | {
      success: true;
      transactionHash?: string;
      eoaAddress: string;
      smartAccountAddress: string;
      userId: string;
    }
  | {
      success: false;
      error?: string;
      contractError?: string;
      eoaAddress?: string;
      smartAccountAddress?: string;
      userId: string;
    };

/** Snapshot of provider runtime config for health/debug endpoints. */
export interface WalletProviderConfig {
  chainId: number;
  sponsorGas: boolean;
  walletId: string;
  isReady: boolean;
}

// ============================================================================
// INTERFACE
// ============================================================================

export interface IWalletProvider {
  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------

  /** Returns true when the provider has sufficient credentials to operate. */
  isConfigured(): boolean;

  /** Returns a runtime config snapshot (for health checks / debug). */
  getConfig(): WalletProviderConfig;

  // ------------------------------------------------------------------
  // Account management
  // ------------------------------------------------------------------

  /**
   * Authenticates the user and returns EOA + Smart Account addresses.
   * Does not execute any contract call — use for wallet creation / address lookup.
   */
  authenticateAndGetAddresses(
    userId: string,
    chainId?: number,
  ): Promise<import('../thirdweb-sdk/types').ThirdwebSdkAuthResult>;

  // ------------------------------------------------------------------
  // Tipbox write operations
  // ------------------------------------------------------------------

  /** Sends amountWei TIPS tokens via the Tipbox contract to targetAddress. */
  sendTip(
    userId: string,
    amountWei: bigint,
    targetAddress: string,
  ): Promise<import('../thirdweb-sdk/types').TipResult>;

  /** Transfers amountWei TIPS directly via ERC20 transfer() (not Tipbox contract). */
  transferToAddress(
    userId: string,
    amountWei: bigint,
    toAddress: string,
  ): Promise<import('../thirdweb-sdk/types').TipResult>;

  /** Claims pending tips for the user via Tipbox claim(). */
  claim(userId: string): Promise<import('../thirdweb-sdk/types').ClaimResult>;

  /** Mints the default badge to the user's Smart Account. */
  mintDefaultBadgeForUser(userId: string): Promise<MintBadgeResult>;

  // ------------------------------------------------------------------
  // Read operations — by userId (connects wallet, then reads)
  // ------------------------------------------------------------------

  getWalletBalanceForUser(
    userId: string,
  ): Promise<import('../thirdweb-sdk/types').WalletBalanceResult>;

  getPendingTipsForUser(
    userId: string,
  ): Promise<import('../thirdweb-sdk/types').PendingTipsResult>;

  getWalletNFTsForUser(
    userId: string,
  ): Promise<import('../thirdweb-sdk/types').WalletNFTsResult>;

  // ------------------------------------------------------------------
  // Read operations — by on-chain address (no auth needed)
  // ------------------------------------------------------------------

  /** Reads TIPS token balance for a given address directly from contract. */
  getTokenBalanceForAddress(
    address: string,
  ): Promise<import('../thirdweb-sdk/types').TokenBalanceForAddressResult>;

  /** Reads pending tips for a given address from the Tipbox contract. */
  getPendingTips(
    address: string,
  ): Promise<import('../thirdweb-sdk/types').PendingTipsResult>;

  // ------------------------------------------------------------------
  // Contract configuration helpers
  // ------------------------------------------------------------------

  /** Reads feePercentage from the Tipbox contract. Returns 0 on error. */
  getFeePercentage(): Promise<number>;

  /** Reads feeRecipient from the Tipbox contract. Returns null on error. */
  getFeeRecipient(): Promise<string | null>;
}
