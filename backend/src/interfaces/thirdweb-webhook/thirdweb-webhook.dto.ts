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
 * Thirdweb'den gelen ham payload (dökümantasyon güncel olmayabilir; farklı formatlar kabul edilir)
 */
const TRANSACTION_STATUS_FROM_TYPE: Record<string, 'sent' | 'mined' | 'errored' | 'cancelled'> = {
  'engine.transaction.sent': 'sent',
  'engine.transaction.mined': 'mined',
  'engine.transaction.errored': 'errored',
  'engine.transaction.cancelled': 'cancelled'
};

function pick<T extends object, K extends keyof T>(obj: T, key: K): T[K] | undefined;
function pick(obj: Record<string, unknown>, key: string, alt?: string): unknown {
  const v = obj[key] ?? (alt ? obj[alt] : undefined);
  return v;
}

/**
 * Ham webhook body'yi (wrapped veya düz, farklı alan adları) ThirdwebWebhookPayload'e dönüştürür.
 * Dökümantasyon güncel olmayabileceği için hem { id, type, data } hem düz payload desteklenir.
 */
export function normalizeThirdwebWebhookPayload(raw: unknown): ThirdwebWebhookPayload {
  const o = raw as Record<string, unknown>;
  // Sarılı format: { id, type, triggered_at, object, data: { queueId, ... } }
  const dataSource =
    o && typeof o === 'object' && o.data && typeof o.data === 'object'
      ? (o.data as Record<string, unknown>)
      : (o as Record<string, unknown>);

  const type = (o.type ?? o.topic) as string | undefined;
  const statusFromType = type ? TRANSACTION_STATUS_FROM_TYPE[type] : undefined;

  const num = (v: unknown): number => (typeof v === 'number' && !Number.isNaN(v) ? v : typeof v === 'string' ? parseInt(v, 10) || 0 : 0);
  const str = (v: unknown): string => (v != null ? String(v) : '');
  const strOrNull = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
  const numOrNull = (v: unknown): number | null =>
    v == null ? null : typeof v === 'number' && !Number.isNaN(v) ? v : typeof v === 'string' ? (parseInt(v, 10) || null) : null;

  const queueId = str(pick(dataSource, 'queueId', 'queue_id'));
  const status = (statusFromType ?? str(pick(dataSource, 'status'))) as 'sent' | 'mined' | 'errored' | 'cancelled';
  const chainId = num(pick(dataSource, 'chainId', 'chain_id'));
  const fromAddress = str(pick(dataSource, 'fromAddress', 'from_address'));
  const toAddress = str(pick(dataSource, 'toAddress', 'to_address'));

  if (!queueId || !chainId || !fromAddress || !toAddress) {
    throw new Error(
      `Missing required fields after normalize. queueId=${!!queueId} chainId=${!!chainId} fromAddress=${!!fromAddress} toAddress=${!!toAddress}`
    );
  }

  const validStatus = ['sent', 'mined', 'errored', 'cancelled'].includes(status) ? status : 'errored';

  return {
    queueId,
    status: validStatus,
    onchainStatus: strOrNull(pick(dataSource, 'onchainStatus', 'onchain_status')) as 'success' | 'reverted' | null,
    queuedAt: str(pick(dataSource, 'queuedAt', 'queued_at')),
    sentAt: strOrNull(pick(dataSource, 'sentAt', 'sent_at')),
    minedAt: strOrNull(pick(dataSource, 'minedAt', 'mined_at')),
    errorMessage: strOrNull(pick(dataSource, 'errorMessage', 'error_message')),
    cancelledAt: strOrNull(pick(dataSource, 'cancelledAt', 'cancelled_at')),
    retryCount: num(pick(dataSource, 'retryCount', 'retry_count')),
    chainId,
    fromAddress,
    toAddress,
    data: str(pick(dataSource, 'data')),
    value: str(pick(dataSource, 'value')),
    nonce: num(pick(dataSource, 'nonce')),
    gasLimit: str(pick(dataSource, 'gasLimit', 'gas_limit')),
    maxFeePerGas: str(pick(dataSource, 'maxFeePerGas', 'max_fee_per_gas')),
    maxPriorityFeePerGas: str(pick(dataSource, 'maxPriorityFeePerGas', 'max_priority_fee_per_gas')),
    gasPrice: str(pick(dataSource, 'gasPrice', 'gas_price')),
    transactionType: numOrNull(pick(dataSource, 'transactionType', 'transaction_type')),
    transactionHash: strOrNull(pick(dataSource, 'transactionHash', 'transaction_hash')),
    sentAtBlockNumber: numOrNull(pick(dataSource, 'sentAtBlockNumber', 'sent_at_block_number')),
    blockNumber: numOrNull(pick(dataSource, 'blockNumber', 'block_number')),
    signerAddress: strOrNull(pick(dataSource, 'signerAddress', 'signer_address')),
    accountAddress: strOrNull(pick(dataSource, 'accountAddress', 'account_address')),
    target: strOrNull(pick(dataSource, 'target')),
    sender: strOrNull(pick(dataSource, 'sender')),
    initCode: strOrNull(pick(dataSource, 'initCode', 'init_code')),
    callData: strOrNull(pick(dataSource, 'callData', 'call_data')),
    callGasLimit: strOrNull(pick(dataSource, 'callGasLimit', 'call_gas_limit')),
    verificationGasLimit: strOrNull(pick(dataSource, 'verificationGasLimit', 'verification_gas_limit')),
    preVerificationGas: strOrNull(pick(dataSource, 'preVerificationGas', 'pre_verification_gas')),
    paymasterAndData: strOrNull(pick(dataSource, 'paymasterAndData', 'paymaster_and_data')),
    userOpHash: strOrNull(pick(dataSource, 'userOpHash', 'user_op_hash')),
    functionName: strOrNull(pick(dataSource, 'functionName', 'function_name')),
    functionArgs: typeof pick(dataSource, 'functionArgs', 'function_args') === 'string'
      ? pick(dataSource, 'functionArgs', 'function_args') as string
      : (pick(dataSource, 'functionArgs', 'function_args') != null ? JSON.stringify(pick(dataSource, 'functionArgs', 'function_args')) : null),
    extension: strOrNull(pick(dataSource, 'extension')),
    deployedContractAddress: strOrNull(pick(dataSource, 'deployedContractAddress', 'deployed_contract_address')),
    deployedContractType: strOrNull(pick(dataSource, 'deployedContractType', 'deployed_contract_type'))
  };
}

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
