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
 * Parsed Transfer Event
 */
export interface ParsedTransferEvent {
  eventName: 'Transfer';
  from: string;
  to: string;
  tokenId?: string; // ERC721
  value?: string;   // ERC20
  isMint: boolean;
  isBurn: boolean;
}

/**
 * Parse a Transfer event from decoded log
 */
export function parseTransferEvent(decodedLog: Record<string, DecodedLogValue>): ParsedTransferEvent | null {
  try {
    const from = decodedLog.from?.value || decodedLog._from?.value;
    const to = decodedLog.to?.value || decodedLog._to?.value;
    
    if (!from || !to) return null;

    const tokenId = decodedLog.tokenId?.value || decodedLog._tokenId?.value;
    const value = decodedLog.value?.value || decodedLog._value?.value;

    return {
      eventName: 'Transfer',
      from,
      to,
      tokenId,
      value,
      isMint: isMintEvent(from),
      isBurn: isBurnEvent(to),
    };
  } catch {
    return null;
  }
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
