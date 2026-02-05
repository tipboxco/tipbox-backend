/**
 * Thirdweb SDK module – Types and result interfaces for auth, Tipbox operations, and wallet data.
 */

// ============================================================================
// AUTH & WALLET
// ============================================================================

export interface ThirdwebSdkAuthResult {
  success: boolean;
  /** EIP-7702 EOA wallet address (In-App Wallet). */
  eoaAddress?: string;
  /** ERC-4337 Smart Account address. */
  smartAccountAddress?: string;
  /** Thirdweb user identifier. */
  thirdwebUserId?: string;
  /** Transaction receipt (e.g. tip/claim). */
  receipt?: unknown;
  /** User-displayable error message. */
  error?: string;
  /** Contract revert error name for programmatic handling. */
  contractError?: string;
}

export interface ThirdwebSdkConfig {
  clientId: string;
  secretKey?: string;
  chainId: number;
  sponsorGas?: boolean;
}

// ============================================================================
// CONNECTED ACCOUNT (internal / API)
// ============================================================================

export interface AccountInfo {
  success: boolean;
  eoaAddress?: string;
  smartAccountAddress?: string;
  thirdwebUserId?: string;
  error?: string;
  contractError?: string;
}

// ============================================================================
// TIPBOX İŞLEMLERİ (tip, claim, pendingTips, transfer)
// ============================================================================

export interface TipParams {
  amountWei: bigint;
  targetAddress: string;
}

export interface TipResult extends ThirdwebSdkAuthResult {
  /** Gönderilen miktar (wei string) */
  amountWei?: string;
  /** Alıcı adres */
  targetAddress?: string;
}

export interface ClaimParams {
  /** Claim yapacak hesap (Smart Account adresi) */
  accountAddress: string;
}

export interface ClaimResult extends ThirdwebSdkAuthResult {}

export interface PendingTipsParams {
  /** Sorgulanacak adres */
  address: string;
}

export interface PendingTipsResult {
  success: boolean;
  /** Bekleyen tip miktarı (wei string) */
  pendingWei?: string;
  /** Human-readable miktar (number) */
  pendingFormatted?: number;
  error?: string;
  contractError?: string;
}

/** Contract'tan adrese göre token balance okuma sonucu (webhook sync için) */
export interface TokenBalanceForAddressResult {
  success: boolean;
  balanceWei?: string;
  balanceFormatted?: number;
  error?: string;
}

/** Single token balance (native ETH or contract token). */
export interface TokenBalance {
  symbol?: string;
  name?: string;
  balanceWei: string;
  balanceFormatted: string;
  decimals?: number;
  /** Contract address (absent for native ETH). */
  address?: string;
}

/** Wallet balance: list of tokens (ETH + config contract token). */
export interface WalletBalanceResult {
  success: boolean;
  eoaAddress?: string;
  smartAccountAddress?: string;
  tokens: TokenBalance[];
  error?: string;
  contractError?: string;
}

/** Standard badge/NFT metadata decoded from tokenURI (data:application/json;base64,...). */
export interface NFTMetadataJson {
  name: string;
  description?: string;
  image?: string;
  external_url?: string;
  animation_url?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

/** Single NFT owned by wallet; metadata parsed from tokenURI. */
export interface WalletNFTItem {
  tokenId: string;
  contractAddress: string;
  tokenURI?: string;
  /** Decoded JSON when tokenURI is data:application/json;base64,... */
  metadata?: NFTMetadataJson;
  collectionName?: string;
  collectionSymbol?: string;
}

/** List of NFTs owned by a wallet. */
export interface WalletNFTsResult {
  success: boolean;
  eoaAddress?: string;
  smartAccountAddress?: string;
  nfts: WalletNFTItem[];
  error?: string;
  contractError?: string;
}

export interface TransferParams {
  /** ERC20 transfer: to address and amount in wei. */
  toAddress: string;
  amountWei: bigint;
}

export interface TransferResult extends ThirdwebSdkAuthResult {
  toAddress?: string;
  amountWei?: string;
}

// ============================================================================
// CONTRACT ERROR TYPES (aligned with contract-errors)
// ============================================================================

export const TIPBOX_ERROR_NAMES = [
  "InvalidAddress",
  "InvalidFeePercentage",
  "NoBadgeOwned",
  "NoPendingTips",
  "OwnableInvalidOwner",
  "OwnableUnauthorizedAccount",
  "SafeERC20FailedOperation",
  "ERC20InsufficientAllowance",
  "ERC20InsufficientBalance",
  "AA21Prefund",
  "AA25InvalidNonce",
] as const;

export type TipboxErrorName = (typeof TIPBOX_ERROR_NAMES)[number];
