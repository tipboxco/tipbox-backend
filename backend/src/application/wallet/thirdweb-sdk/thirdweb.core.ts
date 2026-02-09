/**
 * Thirdweb Core – Parametric, chain-agnostic kernel for Thirdweb SDK v5.
 * All contract communication (read, prepare, send, wait) goes through the core.
 * Use this core with different configs (chains, wallets, contracts) for different systems.
 *
 * @see https://portal.thirdweb.com/typescript/v5
 * 
 * Original Author: İBRAHİM GÜZEL https://github.com/iguzelofficial
 */

import {
  createThirdwebClient,
  defineChain,
  prepareContractCall as thirdwebPrepareContractCall,
  readContract as thirdwebReadContract,
  sendTransaction as thirdwebSendTransaction,
  waitForReceipt as thirdwebWaitForReceipt,
} from "thirdweb";
import { inAppWallet, smartWallet } from "thirdweb/wallets";
import {
  getBadgeContract,
  getTipboxContract,
  getTokenContract,
  getTokenContractNameSymbolBytes32,
  type SepoliaChain,
} from "./contracts";

// ============================================================================
// CONFIG
// ============================================================================

/** Contract addresses fixed when core is defined. */
export interface ThirdwebCoreContracts {
  /** Tipbox contract address. */
  tipbox: `0x${string}`;
  /** ERC20 tips token contract address. */
  tipsToken: `0x${string}`;
  /** ERC721 badge contract address. */
  tipboxBadge: `0x${string}`;
}

export interface ThirdwebCoreConfig {
  /** Thirdweb dashboard client ID (public). */
  clientId?: string;
  /** Thirdweb secret key (server-side). */
  secretKey?: string;
  /** Chain ID (e.g. 11155111 for Sepolia). */
  chainId: number;
  /** RPC URL for the chain. Optional; some chains work without it. */
  rpcUrl?: string;
  /** Whether Smart Account gas is sponsored. */
  sponsorGas?: boolean;
  /** Wallet ID for auth_endpoint strategy. */
  walletId?: string;
  /** Contract addresses; fixed when core is defined. */
  contracts: ThirdwebCoreContracts;
}

export type ThirdwebClient = ReturnType<typeof createThirdwebClient>;
export type ThirdwebChain = ReturnType<typeof defineChain>;

// ============================================================================
// CORE
// ============================================================================

export class ThirdwebCore {
  private readonly client: ThirdwebClient;
  private readonly chain: ThirdwebChain;
  private readonly config: Readonly<ThirdwebCoreConfig>;

  constructor(config: ThirdwebCoreConfig) {
    const { clientId, secretKey, chainId, rpcUrl, sponsorGas = false, walletId = "embedded-wallet", contracts } = config;

    this.client = createThirdwebClient({
      clientId: clientId ?? undefined,
      secretKey: secretKey ?? "",
    });

    this.chain = defineChain({
      id: chainId,
      ...(rpcUrl && { rpc: rpcUrl }),
    });

    this.config = Object.freeze({
      clientId,
      secretKey,
      chainId,
      rpcUrl,
      sponsorGas,
      walletId,
      contracts,
    });
  }

  /** Tipbox contract address (from config, fixed when core is defined). */
  getTipboxAddress(): `0x${string}` {
    return this.config.contracts.tipbox;
  }

  /** ERC20 tips token contract address (from config). */
  getTokenAddress(): `0x${string}` {
    return this.config.contracts.tipsToken;
  }

  /** ERC721 badge contract address (from config). */
  getBadgeAddress(): `0x${string}` {
    return this.config.contracts.tipboxBadge;
  }

  /** All contract addresses (read-only). */
  getContracts(): Readonly<ThirdwebCoreContracts> {
    return this.config.contracts;
  }

  /** Tipbox contract instance (client + chain + address from config). */
  getTipboxContract() {
    return getTipboxContract(this.client, this.chain as SepoliaChain, this.config.contracts.tipbox);
  }

  /** ERC20 tips token contract instance. */
  getTokenContract() {
    return getTokenContract(this.client, this.chain as SepoliaChain, this.config.contracts.tipsToken);
  }

  /** ERC20 token contract (name/symbol as bytes32) for decode fallback. */
  getTokenContractNameSymbolBytes32() {
    return getTokenContractNameSymbolBytes32(
      this.client,
      this.chain as SepoliaChain,
      this.config.contracts.tipsToken
    );
  }

  /** ERC721 badge contract instance. */
  getBadgeContract() {
    return getBadgeContract(this.client, this.chain as SepoliaChain, this.config.contracts.tipboxBadge);
  }

  /** Returns the Thirdweb client. */
  getClient(): ThirdwebClient {
    return this.client;
  }

  /** Returns the chain definition. Use with contract getters and readContract/sendTransaction. */
  getChain(): ThirdwebChain {
    return this.chain;
  }

  /** Chain ID. */
  getChainId(): number {
    return this.config.chainId;
  }

  /** Whether gas is sponsored for Smart Account. */
  getSponsorGas(): boolean {
    return this.config.sponsorGas ?? false;
  }

  /** Wallet ID used in auth_endpoint. */
  getWalletId(): string {
    return this.config.walletId ?? "embedded-wallet";
  }

  /**
   * Connects In-App Wallet (auth_endpoint) and Smart Account for the given userId.
   * Does not perform any contract call. Use for auth-only or before tip/claim/etc.
   */
  async connectWalletAndSmartAccount(userId: string): Promise<{
    eoaAddress: string;
    smartAccountAddress: string;
    smartAccount: Awaited<ReturnType<ReturnType<typeof smartWallet>["connect"]>>;
  }> {
    const walletId = this.getWalletId();

    const eoaAccount = await inAppWallet().connect({
      client: this.client,
      strategy: "auth_endpoint",
      payload: JSON.stringify({
        userId,
        walletId,
        timestamp: Date.now(),
      }),
    });

    const smartAccount = await smartWallet({
      chain: this.chain,
      sponsorGas: this.getSponsorGas(),
    }).connect({
      client: this.client,
      personalAccount: eoaAccount,
    });

    return {
      eoaAddress: eoaAccount.address,
      smartAccountAddress: smartAccount.address,
      smartAccount,
    };
  }

  /**
   * Returns native (ETH) balance for an address on the configured chain.
   */
  async getNativeBalance(
    address: string,
    chainId?: number
  ): Promise<{ balance: string; formatted: string; symbol: string }> {
    const chain =
      chainId !== undefined && chainId !== this.config.chainId
        ? defineChain({ id: chainId, ...(this.config.rpcUrl && { rpc: this.config.rpcUrl }) })
        : this.chain;

    try {
      const { getWalletBalance } = await import("thirdweb/wallets");
      const balance = await getWalletBalance({
        client: this.client,
        chain,
        address,
      });
      return {
        balance: balance.value.toString(),
        formatted: balance.displayValue,
        symbol: balance.symbol,
      };
    } catch {
      return {
        balance: "0",
        formatted: "0",
        symbol: "ETH",
      };
    }
  }

  /** Returns whether the client has credentials (clientId or secretKey). */
  isConfigured(): boolean {
    return !!(this.config.clientId || this.config.secretKey);
  }

  /** Returns a snapshot of core config (for debugging or API). */
  getConfigSnapshot(): {
    chainId: number;
    sponsorGas: boolean;
    walletId: string;
    isReady: boolean;
  } {
    return {
      chainId: this.config.chainId,
      sponsorGas: this.getSponsorGas(),
      walletId: this.getWalletId(),
      isReady: this.isConfigured(),
    };
  }

  // ==========================================================================
  // CONTRACT COMMUNICATION (read, prepare, send, wait)
  // ==========================================================================

  /**
   * Reads from a contract (view/pure). All read operations go through the core.
   */
  readContract<T = unknown>(params: {
    contract: Parameters<typeof thirdwebReadContract>[0]["contract"];
    method: Parameters<typeof thirdwebReadContract>[0]["method"];
    params?: readonly unknown[] | unknown[];
  }): Promise<T> {
    return thirdwebReadContract(params as Parameters<typeof thirdwebReadContract>[0]) as Promise<T>;
  }

  /**
   * Same as readContract, but when RPC/contract returns "0x" (empty data) viem throws
   * AbiDecodingZeroDataError. This helper catches that and returns defaultValue instead,
   * so callers can treat "no data" as zero balance / default decimals etc.
   */
  async readContractSafe<T>(params: {
    contract: Parameters<typeof thirdwebReadContract>[0]["contract"];
    method: Parameters<typeof thirdwebReadContract>[0]["method"];
    params?: readonly unknown[] | unknown[];
  }, defaultValue: T): Promise<T> {
    try {
      return await thirdwebReadContract(params as Parameters<typeof thirdwebReadContract>[0]) as T;
    } catch (err) {
      if (isZeroDataDecodeError(err)) return defaultValue;
      throw err;
    }
  }

  /**
   * Prepares a contract call (transaction payload). Does not send.
   */
  prepareContractCall(params: {
    contract: Parameters<typeof thirdwebPrepareContractCall>[0]["contract"];
    method: Parameters<typeof thirdwebPrepareContractCall>[0]["method"];
    params?: readonly unknown[] | unknown[];
  }): ReturnType<typeof thirdwebPrepareContractCall> {
    return thirdwebPrepareContractCall(params as Parameters<typeof thirdwebPrepareContractCall>[0]);
  }

  /**
   * Sends a transaction from the given account.
   */
  sendTransaction(
    transaction: Parameters<typeof thirdwebSendTransaction>[0]["transaction"],
    account: Parameters<typeof thirdwebSendTransaction>[0]["account"]
  ): ReturnType<typeof thirdwebSendTransaction> {
    return thirdwebSendTransaction({ transaction, account });
  }

  /**
   * Waits for transaction receipt after send.
   */
  waitForReceipt(
    result: Parameters<typeof thirdwebWaitForReceipt>[0]
  ): ReturnType<typeof thirdwebWaitForReceipt> {
    return thirdwebWaitForReceipt(result);
  }

  /**
   * Sends a transaction and waits for receipt. Single call for common flow.
   */
  async sendTransactionAndWait(
    transaction: Parameters<typeof thirdwebSendTransaction>[0]["transaction"],
    account: Parameters<typeof thirdwebSendTransaction>[0]["account"]
  ): Promise<Awaited<ReturnType<typeof thirdwebWaitForReceipt>>> {
    const result = await this.sendTransaction(transaction, account);
    return this.waitForReceipt(result);
  }
}

// ============================================================================
// UTILITIES (chain-agnostic, reusable)
// ============================================================================

/** viem/thirdweb throws when RPC returns "0x" and ABI decode is attempted. */
function isZeroDataDecodeError(err: unknown): boolean {
  const msg = err instanceof Error ? (err.message ?? err.name) : String(err);
  return /AbiDecodingZeroDataError|Cannot decode zero data|zero data/i.test(msg);
}

/**
 * Decodes bytes32 hex (0x + 64 hex chars) to UTF-8 string, stripping null padding.
 * Use when ERC20 name/symbol return bytes32 and viem decode fails.
 */
export function decodeBytes32ToString(hex: `0x${string}` | string): string {
  if (!hex || typeof hex !== "string" || !hex.startsWith("0x")) return "";
  const raw = hex.slice(2);
  if (raw.length < 64) return "";
  try {
    const buf = Buffer.from(raw.slice(0, 64), "hex");
    return buf.toString("utf8").replace(/\0/g, "").trim();
  } catch {
    return "";
  }
}
