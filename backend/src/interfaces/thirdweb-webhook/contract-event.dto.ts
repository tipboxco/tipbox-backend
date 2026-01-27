// ============================================================================
// THIRDWEB CONTRACT EVENT SUBSCRIPTION DTOs
// ============================================================================

/**
 * Contract Event Log payload (event-log type)
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
    timestamp: number; // Unix timestamp in milliseconds
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
    status: number; // 1 = success, 0 = failed
  };
}

/**
 * Decoded log value structure
 */
export interface DecodedLogValue {
  type: string;
  value: string;
}

/**
 * Combined payload type
 */
export type ThirdwebContractSubscriptionPayload = ContractEventPayload | TransactionReceiptPayload;

/**
 * Common NFT Event types
 */
export enum NFTEventType {
  TRANSFER = 'Transfer',
  APPROVAL = 'Approval',
  APPROVAL_FOR_ALL = 'ApprovalForAll',
  MINT = 'Transfer', // Mint is Transfer from 0x0 address
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
  tokenId?: string;    // ERC721
  value?: string;      // ERC20 (wei cinsinden)
  valueDecimal?: number; // ERC20 (decimal dönüştürülmüş)
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
  value?: string;      // ERC20 - allowance miktarı
  tokenId?: string;    // ERC721 - onaylanan token
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
    const from = decodedLog.from?.value || decodedLog._from?.value;
    const to = decodedLog.to?.value || decodedLog._to?.value;
    
    if (!from || !to) return null;

    const tokenId = decodedLog.tokenId?.value || decodedLog._tokenId?.value;
    const value = decodedLog.value?.value || decodedLog._value?.value || decodedLog.amount?.value;

    // Token türünü belirle
    let tokenType = TokenType.UNKNOWN;
    if (tokenId && !value) {
      tokenType = TokenType.ERC721;
    } else if (value && !tokenId) {
      tokenType = TokenType.ERC20;
    } else if (value) {
      // Her ikisi de varsa ERC20 kabul et (bazı NFT'ler de value döner)
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

    // Token türünü belirle
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
  if (supported.length === 0) return true; // If not configured, accept all
  return supported.includes(address.toLowerCase());
}
