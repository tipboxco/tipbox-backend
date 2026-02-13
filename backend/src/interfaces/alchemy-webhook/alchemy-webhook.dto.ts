/**
 * Alchemy Notify Webhook DTOs
 *
 * Alchemy bazen GraphQL-benzeri block/logs yapısında veri gönderir (ERC20 Transfer dinleme).
 * EOA → smart wallet ve smart wallet → EOA transferleri bu yapı üzerinden işlenir.
 *
 * @see https://docs.alchemy.com/reference/notify-api-quickstart
 * @see https://docs.alchemy.com/reference/address-activity-webhook
 */

/** ERC20 Transfer event topic0 (keccak256("Transfer(address,address,uint256)")) */
export const ALCHEMY_ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/** Alchemy webhook event types */
export type AlchemyWebhookType = 'ADDRESS_ACTIVITY' | 'NFT_ACTIVITY' | 'MINED_TRANSACTION' | string;

// ============================================================================
// Graph-style payload (block + logs, contract filter ile)
// ============================================================================

export interface AlchemyGraphAddress {
  address?: string | null;
}

/** Ethereum tx alanları. Token transfer from/to için log.topics kullanılır, bu from/to değil. */
export interface AlchemyGraphTransaction {
  hash?: string | null;
  nonce?: number | null;
  index?: number | null;
  /** Tx gönderen (EOA); token gönderen değil — token from = log.topics[1] */
  from?: AlchemyGraphAddress | null;
  /** Tx hedef (çoğunlukla token contract); token alıcı değil — token to = log.topics[2] */
  to?: AlchemyGraphAddress | null;
  value?: string | null;
  gasPrice?: string | null;
  maxFeePerGas?: string | null;
  maxPriorityFeePerGas?: string | null;
  gas?: string | null;
  status?: number | string | null;
  gasUsed?: string | null;
  cumulativeGasUsed?: string | null;
  effectiveGasPrice?: string | null;
  createdContract?: AlchemyGraphAddress | null;
}

export interface AlchemyGraphLog {
  data?: string | null;
  topics?: string[] | null;
  index?: number | null;
  account?: AlchemyGraphAddress | null;
  transaction?: AlchemyGraphTransaction | null;
}

export interface AlchemyGraphBlock {
  hash?: string | null;
  number?: string | number | null;
  timestamp?: string | number | null;
  logs?: AlchemyGraphLog[] | null;
}

/** Parsed ERC20 Transfer from raw log (topics + data) */
export interface AlchemyParsedTransfer {
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  transactionHash: string;
  logIndex: number;
}

/**
 * Graph formatındaki bir log'u ERC20 Transfer olarak parse eder.
 * From/to adresleri SADECE log.topics üzerinden alınır; transaction.from/to kullanılmaz.
 *
 * - topics[0] = Transfer event imzası (method id)
 * - topics[1] = from (token gönderen adres, 32-byte padded)
 * - topics[2] = to (token alıcı adres, 32-byte padded)
 * - data = value (uint256, wei)
 */
export function parseAlchemyGraphTransferLog(
  log: AlchemyGraphLog,
  contractAddress: string
): AlchemyParsedTransfer | null {
  const topics = log.topics;
  const data = log.data;
  const accountAddr = log.account?.address ?? null;
  const txHash = log.transaction?.hash ?? null;

  if (!topics?.length || !accountAddr || !txHash) return null;
  const addr = accountAddr.toLowerCase();
  const contract = contractAddress.toLowerCase();
  if (addr !== contract) return null;
  if (topics[0]?.toLowerCase() !== ALCHEMY_ERC20_TRANSFER_TOPIC.toLowerCase()) return null;

  // From/to SADECE topics'tan: topics[1] = from, topics[2] = to (transaction.from/to değil)
  const fromHex = topics[1];
  const toHex = topics[2];
  if (!fromHex || !toHex) return null;
  const from = topicToAddress(fromHex);
  const to = topicToAddress(toHex);
  if (!from || !to) return null;

  // data = value (uint256, 32 bytes hex)
  let value = '0';
  if (data && typeof data === 'string' && data.startsWith('0x')) {
    value = BigInt(data).toString();
  }

  const logIndex = typeof log.index === 'number' ? log.index : parseInt(String(log.index ?? '0'), 10) || 0;
  return { from, to, value, contractAddress: accountAddr, transactionHash: txHash, logIndex };
}

function topicToAddress(topic: string): string | null {
  if (!topic || typeof topic !== 'string') return null;
  const hex = topic.startsWith('0x') ? topic.slice(2) : topic;
  if (hex.length < 40) return null;
  return '0x' + hex.slice(-40).toLowerCase();
}

/** Alchemy GRAPHQL webhook'unda block event.data.block altında gelir */
function getBlockFromPayload(payload: AlchemyWebhookPayload): AlchemyGraphBlock | null {
  const ev = payload.event as { block?: AlchemyGraphBlock; data?: { block?: AlchemyGraphBlock } } | undefined;
  return (
    (payload as { block?: AlchemyGraphBlock }).block ??
    ev?.data?.block ??
    ev?.block ??
    null
  );
}

/** Payload'da graph block.logs var mı kontrol eder */
export function hasAlchemyGraphBlock(payload: AlchemyWebhookPayload): boolean {
  const block = getBlockFromPayload(payload);
  return !!(block?.logs && Array.isArray(block.logs) && block.logs.length > 0);
}

/** Payload'dan graph block'u döndürür */
export function getAlchemyGraphBlock(payload: AlchemyWebhookPayload): AlchemyGraphBlock | null {
  const block = getBlockFromPayload(payload);
  return block?.logs ? block : null;
}

/** Raw contract info in activity item */
export interface AlchemyRawContract {
  rawValue?: string | null;
  address?: string | null;
  decimals?: number | null;
}

/** Single activity item (transfer) in Address Activity */
export interface AlchemyActivityItem {
  blockNum?: string;
  hash?: string;
  fromAddress?: string;
  toAddress?: string;
  value?: number;
  asset?: string;
  category?: 'token' | 'external' | 'internal';
  erc721TokenId?: string | null;
  erc1155Metadata?: unknown;
  rawContract?: AlchemyRawContract;
  typeTraceAddress?: string;
  log?: {
    address?: string;
    topics?: string[];
    data?: string;
    blockNumber?: string;
    transactionHash?: string;
    transactionIndex?: string;
    logIndex?: string;
  };
}

/** Event object for ADDRESS_ACTIVITY */
export interface AlchemyAddressActivityEvent {
  network?: string;
  activity?: AlchemyActivityItem[];
}

/** Top-level Alchemy webhook payload (event veya graph block ile gelebilir) */
export interface AlchemyWebhookPayload {
  webhookId?: string;
  id?: string;
  createdAt?: string;
  type?: AlchemyWebhookType;
  event?: AlchemyAddressActivityEvent | Record<string, unknown>;
  /** Graph formatında gelen block + logs (ERC20 Transfer dinleme) */
  block?: AlchemyGraphBlock;
}

export function isAlchemyAddressActivityPayload(
  p: AlchemyWebhookPayload
): p is AlchemyWebhookPayload & { type: 'ADDRESS_ACTIVITY'; event: AlchemyAddressActivityEvent } {
  return p.type === 'ADDRESS_ACTIVITY' && Array.isArray((p.event as AlchemyAddressActivityEvent)?.activity);
}
