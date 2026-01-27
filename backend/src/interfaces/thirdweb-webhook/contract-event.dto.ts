// ============================================================================
// THIRDWEB CONTRACT EVENT SUBSCRIPTION DTOs
// ============================================================================
// Gerçek Thirdweb payload formatına göre güncellenmiş (v1.events)

/**
 * Ana Thirdweb Webhook Payload (üst seviye wrapper)
 */
export interface ThirdwebWebhookPayloadWrapper {
  timestamp: number;           // Unix timestamp (saniye)
  topic: string;               // "v1.events"
  data: ThirdwebEventItem[];   // Event array
}

/**
 * Tek bir event item
 */
export interface ThirdwebEventItem {
  data: ThirdwebEventData;
  status: string;              // "new"
  type: string;                // "event"
  id: string;                  // Unique event ID
}

/**
 * Event data (gerçek blockchain verisi)
 */
export interface ThirdwebEventData {
  chain_id: string;            // "1" (string olarak geliyor)
  block_number: number;
  block_hash: string;
  block_timestamp: number;     // Unix timestamp (saniye)
  transaction_hash: string;
  transaction_index: number;
  log_index: number;
  address: string;             // Contract address
  data: string;                // Raw event data
  topics: string[];            // Event topics
  decoded: ThirdwebDecodedEvent | null;
}

/**
 * Decoded event yapısı (Thirdweb formatı)
 */
export interface ThirdwebDecodedEvent {
  name: string;                // "Transfer", "Approval" vb.
  indexed_params: Record<string, string>;      // from, to vb.
  non_indexed_params: Record<string, string>;  // amount, value vb.
}

// ============================================================================
// NORMALIZED EVENT TYPES (İç kullanım için dönüştürülmüş)
// ============================================================================

/**
 * Normalized Contract Event (sistemimizin kullandığı format)
 */
export interface NormalizedContractEvent {
  chainId: number;
  contractAddress: string;
  blockNumber: number;
  blockHash: string;
  blockTimestamp: Date;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  eventName: string;
  data: string;
  topics: string[];
  decodedLog: Record<string, DecodedLogValue>;
  rawPayload: ThirdwebEventItem;
}

/**
 * Decoded log value structure (normalize edilmiş)
 */
export interface DecodedLogValue {
  type: string;
  value: string;
}

/**
 * Thirdweb event'ini normalize et
 */
export function normalizeThirdwebEvent(item: ThirdwebEventItem): NormalizedContractEvent {
  const { data } = item;
  
  // Decoded log'u bizim formatımıza çevir
  const decodedLog: Record<string, DecodedLogValue> = {};
  
  if (data.decoded) {
    // indexed_params'ı ekle
    for (const [key, value] of Object.entries(data.decoded.indexed_params || {})) {
      decodedLog[key] = { type: 'address', value: String(value) };
    }
    
    // non_indexed_params'ı ekle
    for (const [key, value] of Object.entries(data.decoded.non_indexed_params || {})) {
      // amount -> value mapping (ERC20 uyumluluğu için)
      const normalizedKey = key === 'amount' ? 'value' : key;
      decodedLog[normalizedKey] = { type: 'uint256', value: String(value) };
    }
  }

  return {
    chainId: parseInt(data.chain_id, 10),
    contractAddress: data.address,
    blockNumber: data.block_number,
    blockHash: data.block_hash,
    blockTimestamp: new Date(data.block_timestamp * 1000),
    transactionHash: data.transaction_hash,
    transactionIndex: data.transaction_index,
    logIndex: data.log_index,
    eventName: data.decoded?.name || 'Unknown',
    data: data.data,
    topics: data.topics,
    decodedLog,
    rawPayload: item,
  };
}

/**
 * Wrapper payload'ı parse et ve normalize edilmiş event'leri döndür
 */
export function parseThirdwebPayload(payload: ThirdwebWebhookPayloadWrapper): NormalizedContractEvent[] {
  if (!payload.data || !Array.isArray(payload.data)) {
    return [];
  }

  return payload.data
    .filter(item => item.type === 'event' && item.data?.decoded)
    .map(item => normalizeThirdwebEvent(item));
}

// ============================================================================
// LEGACY TYPES (Eski format desteği için tutuldu)
// ============================================================================

/**
 * Contract Event Log payload (eski format - event-log type)
 * @deprecated Use ThirdwebWebhookPayloadWrapper instead
 */
export interface ContractEventPayload {
  type: 'event-log';
  data: {
    chainId: number;
    contractAddress: string;
    blockNumber: number;
    transactionHash: string;
    topics: string[];
    data: string;
    eventName: string;
    decodedLog: Record<string, DecodedLogValue>;
    timestamp: number;
    transactionIndex: number;
    logIndex: number;
  };
}

/**
 * Transaction Receipt payload (transaction-receipt type)
 */
export interface TransactionReceiptPayload {
  type: 'transaction-receipt';
  data: {
    chainId: number;
    blockNumber: number;
    contractAddress: string;
    transactionHash: string;
    blockHash: string;
    timestamp: number;
    data: string;
    value: string;
    to: string;
    from: string;
    transactionIndex: number;
    gasUsed: string;
    effectiveGasPrice: string;
    status: number;
  };
}

/**
 * Combined payload type
 */
export type ThirdwebContractSubscriptionPayload = 
  | ThirdwebWebhookPayloadWrapper 
  | ContractEventPayload 
  | TransactionReceiptPayload;

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Common NFT Event types
 */
export enum NFTEventType {
  TRANSFER = 'Transfer',
  APPROVAL = 'Approval',
  APPROVAL_FOR_ALL = 'ApprovalForAll',
  MINT = 'Transfer',
}

/**
 * Common ERC20 Event types
 */
export enum ERC20EventType {
  TRANSFER = 'Transfer',
  APPROVAL = 'Approval',
}

/**
 * Zero address (used to detect mint events)
 */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Check if a Transfer event is a Mint (from zero address)
 */
export function isMintEvent(fromAddress: string): boolean {
  return fromAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase();
}

/**
 * Check if a Transfer event is a Burn (to zero address)
 */
export function isBurnEvent(toAddress: string): boolean {
  return toAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase();
}

/**
 * Event processing result
 */
export interface EventProcessResult {
  success: boolean;
  action: 'created' | 'updated' | 'skipped' | 'processed';
  message: string;
  eventLogId?: string;
  transactionId?: string;
  walletId?: string;
  eventsProcessed?: number;
}

/**
 * Contract Event Log DTO (for API responses)
 */
export interface ContractEventLogDTO {
  id: string;
  chainId: number;
  contractAddress: string;
  blockNumber: number;
  transactionHash: string;
  eventName: string;
  decodedLog: Record<string, any>;
  timestamp: string;
  transactionId: string | null;
  walletId: string | null;
  processed: boolean;
  processedAt: string | null;
  createdAt: string;
}

/**
 * Token türü
 */
export enum TokenType {
  ERC20 = 'ERC20',
  ERC721 = 'ERC721',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Parsed Transfer Event
 */
export interface ParsedTransferEvent {
  eventName: 'Transfer';
  from: string;
  to: string;
  tokenId?: string;
  value?: string;
  valueDecimal?: number;
  isMint: boolean;
  isBurn: boolean;
  tokenType: TokenType;
}

/**
 * Parsed Approval Event
 */
export interface ParsedApprovalEvent {
  eventName: 'Approval';
  owner: string;
  spender: string;
  value?: string;
  tokenId?: string;
  tokenType: TokenType;
}

/**
 * Parse a Transfer event from decoded log
 */
export function parseTransferEvent(
  decodedLog: Record<string, DecodedLogValue>,
  decimals: number = 18
): ParsedTransferEvent | null {
  try {
    // Normalize edilmiş format veya eski format
    const from = decodedLog.from?.value || decodedLog._from?.value;
    const to = decodedLog.to?.value || decodedLog._to?.value;
    
    if (!from || !to) return null;

    const tokenId = decodedLog.tokenId?.value || decodedLog._tokenId?.value;
    // "amount" artık "value" olarak normalize edildi
    const value = decodedLog.value?.value || decodedLog._value?.value || decodedLog.amount?.value;

    // Token türünü belirle
    let tokenType = TokenType.UNKNOWN;
    if (tokenId && !value) {
      tokenType = TokenType.ERC721;
    } else if (value && !tokenId) {
      tokenType = TokenType.ERC20;
    } else if (value) {
      tokenType = TokenType.ERC20;
    }

    // Value'yu decimal'e çevir
    let valueDecimal: number | undefined;
    if (value && tokenType === TokenType.ERC20) {
      try {
        valueDecimal = parseFloat(value) / Math.pow(10, decimals);
      } catch {
        valueDecimal = undefined;
      }
    }

    return {
      eventName: 'Transfer',
      from,
      to,
      tokenId,
      value,
      valueDecimal,
      isMint: isMintEvent(from),
      isBurn: isBurnEvent(to),
      tokenType,
    };
  } catch {
    return null;
  }
}

/**
 * Parse an Approval event from decoded log
 */
export function parseApprovalEvent(
  decodedLog: Record<string, DecodedLogValue>,
  decimals: number = 18
): ParsedApprovalEvent | null {
  try {
    const owner = decodedLog.owner?.value || decodedLog._owner?.value;
    const spender = decodedLog.spender?.value || decodedLog._spender?.value;
    
    if (!owner || !spender) return null;

    const tokenId = decodedLog.tokenId?.value || decodedLog._tokenId?.value;
    const value = decodedLog.value?.value || decodedLog._value?.value;

    let tokenType = TokenType.UNKNOWN;
    if (tokenId && !value) {
      tokenType = TokenType.ERC721;
    } else if (value) {
      tokenType = TokenType.ERC20;
    }

    return {
      eventName: 'Approval',
      owner,
      spender,
      value,
      tokenId,
      tokenType,
    };
  } catch {
    return null;
  }
}

/**
 * Wei to token amount conversion
 */
export function weiToToken(weiValue: string, decimals: number = 18): number {
  try {
    return parseFloat(weiValue) / Math.pow(10, decimals);
  } catch {
    return 0;
  }
}

/**
 * Token amount to wei conversion
 */
export function tokenToWei(amount: number, decimals: number = 18): string {
  return (amount * Math.pow(10, decimals)).toString();
}

/**
 * Check if it's a significant transfer (not dust)
 */
export function isSignificantTransfer(value: string, decimals: number = 18, minAmount: number = 0.0001): boolean {
  const amount = weiToToken(value, decimals);
  return amount >= minAmount;
}

/**
 * Supported contract addresses (configure in env)
 */
export function getSupportedContractAddresses(): string[] {
  const addresses = process.env.THIRDWEB_WATCHED_CONTRACTS || '';
  return addresses.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
}

/**
 * Check if contract address is supported
 */
export function isContractSupported(address: string): boolean {
  const supported = getSupportedContractAddresses();
  if (supported.length === 0) return true;
  return supported.includes(address.toLowerCase());
}

/**
 * Check if payload is the new Thirdweb format (v1.events)
 */
export function isThirdwebV1Payload(payload: any): payload is ThirdwebWebhookPayloadWrapper {
  return payload && 
    typeof payload.timestamp === 'number' && 
    payload.topic === 'v1.events' && 
    Array.isArray(payload.data);
}

/**
 * Check if payload is legacy format
 */
export function isLegacyPayload(payload: any): payload is ContractEventPayload {
  return payload && payload.type === 'event-log';
}
