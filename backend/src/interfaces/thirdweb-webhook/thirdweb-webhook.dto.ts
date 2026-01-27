// ============================================================================
// THIRDWEB WEBHOOK DTOs & TYPES
// ============================================================================

/**
 * Thirdweb Engine'den gelen webhook payload yapısı
 */
export interface ThirdwebWebhookPayload {
  // Queue details
  queueId: string;
  status: 'sent' | 'mined' | 'errored' | 'cancelled';
  onchainStatus: 'success' | 'reverted' | null;
  queuedAt: string;
  sentAt: string | null;
  minedAt: string | null;
  errorMessage: string | null;
  cancelledAt: string | null;
  retryCount: number;

  // Onchain details
  chainId: number;
  fromAddress: string;
  toAddress: string;
  data: string;
  value: string;
  nonce: number;
  gasLimit: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  gasPrice: string;
  transactionType: number | null;
  transactionHash: string | null;
  sentAtBlockNumber: number | null;
  blockNumber: number | null;

  // User operation (account abstraction) details
  signerAddress: string | null;
  accountAddress: string | null;
  target: string | null;
  sender: string | null;
  initCode: string | null;
  callData: string | null;
  callGasLimit: string | null;
  verificationGasLimit: string | null;
  preVerificationGas: string | null;
  paymasterAndData: string | null;
  userOpHash: string | null;

  // Off-chain details
  functionName: string | null;
  functionArgs: string | null;
  extension: string | null;
  deployedContractAddress: string | null;
  deployedContractType: string | null;
}

/**
 * Webhook işleme sonucu
 */
export interface WebhookProcessResult {
  success: boolean;
  action: 'created' | 'updated' | 'skipped';
  message: string;
  transactionId?: string;
  webhookLogId?: string;
}

/**
 * Webhook response
 */
export interface ThirdwebWebhookResponse {
  success: boolean;
  action: 'created' | 'updated' | 'skipped';
  message: string;
  transactionId?: string;
}

/**
 * Wallet balance alert payload (backend_wallet_balance event)
 */
export interface WalletBalanceAlertPayload {
  walletAddress: string;
  balance: string;
  minWalletBalance: string;
  chainId: number;
}

/**
 * Status öncelik sıralaması
 * Daha yüksek = daha öncelikli
 */
export const WEBHOOK_STATUS_PRIORITY: Record<string, number> = {
  'mined': 4,
  'cancelled': 3,
  'sent': 2,
  'errored': 1
};

/**
 * Desteklenen chain ID'leri
 */
export const SUPPORTED_CHAIN_IDS = {
  ETHEREUM_MAINNET: 1,
  ETHEREUM_SEPOLIA: 11155111,
  POLYGON_MAINNET: 137,
  POLYGON_MUMBAI: 80001,
  ARBITRUM_MAINNET: 42161,
  ARBITRUM_SEPOLIA: 421614,
  BASE_MAINNET: 8453,
  BASE_SEPOLIA: 84532
} as const;

/**
 * Webhook log'dan DTO'ya dönüşüm
 */
export interface ThirdwebWebhookLogDTO {
  id: string;
  queueId: string;
  status: string;
  onchainStatus: string | null;
  chainId: number;
  fromAddress: string;
  toAddress: string;
  transactionHash: string | null;
  blockNumber: number | null;
  functionName: string | null;
  errorMessage: string | null;
  transactionId: string | null;
  processedAt: string;
  createdAt: string;
}
