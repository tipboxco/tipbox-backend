/**
 * Web3 NFT Service
 *
 * This service provides ERC721 badge minting (e.g., Tipbox Badge) using the owner private key (OWNER_PRIVATE_KEY).
 * Supports safeMint operations on Sepolia network.
 *
 * Released under the GNU General Public License (GPL).
 * Open source: anyone can use and contribute.
 *
 * Original Author: İBRAHİM GÜZEL https://github.com/iguzelofficial
 */

import {
  createThirdwebClient,
  defineChain,
  estimateGas,
  eth_getBalance,
  getContract,
  getRpcClient,
  prepareContractCall,
  readContract,
  sendTransaction,
  waitForReceipt,
} from "thirdweb";
import { privateKeyToAccount } from "thirdweb/wallets";
import { CONFIG, ERC721_BADGE_ABI } from "../config/config";
import { parseContractError, toUserMessage } from "../thirdweb-sdk/contract-errors";
import { DEFAULT_BADGE_METADATA } from "./defaults";
import type {
  BatchMintRecipient,
  LazyMintResult,
  MintResult,
  NFTMetadata,
  ParsedNFTMetadata,
  WalletNFTItem,
  WalletNFTsListResult,
  Web3NftConfig,
} from "./types";

/** Sepolia chain definition from CONFIG. */
const CHAIN = defineChain({ id: CONFIG.chainId, rpc: CONFIG.rpcUrl });

/** Ensures private key string has 0x prefix for thirdweb. */
function normalizePrivateKey(key: string): `0x${string}` {
  return key.startsWith("0x") ? (key as `0x${string}`) : (`0x${key}` as `0x${string}`);
}

/**
 * Web3 NFT Service – Server-side ERC721 mint and wallet NFT listing.
 * Uses owner private key (OWNER_PRIVATE_KEY) for mint; shares error handling with thirdweb-sdk.
 */
export class Web3NftService {
  private client: ReturnType<typeof createThirdwebClient>;
  private contract: ReturnType<typeof getContract>;
  private account: ReturnType<typeof privateKeyToAccount> | null = null;
  private readonly chain = CHAIN;
  private readonly contractAddress: string;

  constructor(config?: Web3NftConfig) {
    const privateKey = config?.privateKey ?? process.env.OWNER_PRIVATE_KEY ?? process.env.ADMIN_PRIVATE_KEY;
    const secretKey = config?.secretKey ?? process.env.THIRDWEB_SECRET_KEY ?? "";
    this.contractAddress = config?.contractAddress ?? CONFIG.contracts.tipboxBadge;
    const abi = config?.abi ?? ERC721_BADGE_ABI;

    this.client = createThirdwebClient({
      secretKey: secretKey || "",
    });

    this.contract = getContract({
      client: this.client,
      chain: this.chain,
      address: this.contractAddress as `0x${string}`,
      abi: abi as Parameters<typeof getContract>[0]["abi"],
    });

    if (privateKey) {
      this.account = privateKeyToAccount({
        client: this.client,
        privateKey: normalizePrivateKey(privateKey),
      });
    }
  }

  /** Returns the owner (admin) address if private key is set; otherwise null. */
  getOwnerAddress(): string | null {
    return this.account?.address ?? null;
  }

  /** Returns the badge contract address. */
  getContractAddress(): string {
    return this.contractAddress;
  }

  /** Returns the chain (Sepolia). */
  getChain() {
    return this.chain;
  }

  /** Returns native balance of the owner account (for gas checks). */
  async getOwnerBalance(): Promise<{ balance: bigint; balanceEth: string }> {
    if (!this.account) return { balance: BigInt(0), balanceEth: "0" };
    try {
      const rpc = getRpcClient({ client: this.client, chain: this.chain });
      const balance = await eth_getBalance(rpc, { address: this.account.address });
      const balanceEth = (Number(balance) / 1e18).toFixed(6);
      return { balance, balanceEth };
    } catch {
      return { balance: BigInt(0), balanceEth: "0" };
    }
  }

  /** Mints an NFT to toAddress with the given metadata (encoded as data URI). */
  async mintWithMetadata(toAddress: string, metadata: NFTMetadata): Promise<MintResult> {
    const tokenURI = this.metadataToDataUri(metadata);
    return this.safeMint(toAddress, tokenURI);
  }

  /**
   * Mints the default Tipbox badge to the given address (uses DEFAULT_BADGE_METADATA).
   * Used after NoBadgeOwned so the user can then call claim.
   */
  async mintDefaultBadge(toAddress: string): Promise<MintResult> {
    return this.mintWithMetadata(toAddress, DEFAULT_BADGE_METADATA);
  }

  /**
   * Returns the list of NFTs owned by ownerAddress from the badge contract (includes tokenURI parsing).
   * Decodes tokenURI when format is data:application/json;base64,...
   */
  async getWalletNFTs(ownerAddress: string): Promise<WalletNFTsListResult> {
    if (!this.isValidAddress(ownerAddress)) {
      return { success: false, nfts: [], error: "Invalid owner address (0x + 40 hex chars)." };
    }
    try {
      const owner = ownerAddress as `0x${string}`;
      const read = readContract as (opts: { contract: unknown; method: string; params?: unknown[] }) => Promise<unknown>;
      const [balance, collectionName, collectionSymbol] = await Promise.all([
        read({ contract: this.contract, method: "balanceOf", params: [owner] }) as Promise<bigint>,
        read({ contract: this.contract, method: "name" }).catch(() => "") as Promise<string>,
        read({ contract: this.contract, method: "symbol" }).catch(() => "") as Promise<string>,
      ]);

      const nfts: WalletNFTItem[] = [];
      const balanceNum = Number(balance);

      for (let i = 0; i < balanceNum; i++) {
        const tokenId = (await read({
          contract: this.contract,
          method: "tokenOfOwnerByIndex",
          params: [owner, BigInt(i)],
        })) as bigint;
        const tokenURI = (await read({
          contract: this.contract,
          method: "tokenURI",
          params: [tokenId],
        })) as string;
        const metadata = this.parseTokenURIMetadata(tokenURI);
        nfts.push({
          tokenId: tokenId.toString(),
          contractAddress: this.contractAddress,
          tokenURI,
          ...(metadata && { metadata }),
          ...(collectionName && { collectionName }),
          ...(collectionSymbol && { collectionSymbol }),
        });
      }

      return { success: true, nfts };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const contractError = parseContractError(message);
      const userMessage = toUserMessage(contractError ?? message);
      return {
        success: false,
        nfts: [],
        error: userMessage,
        contractError: contractError ?? undefined,
      };
    }
  }

  /**
   * Decodes tokenURI when format is data:application/json;base64,... and returns parsed metadata.
   */
  parseTokenURIMetadata(uri: string): ParsedNFTMetadata | undefined {
    const prefix = "data:application/json;base64,";
    if (!uri.startsWith(prefix)) return undefined;
    try {
      const base64 = uri.slice(prefix.length);
      const json = Buffer.from(base64, "base64").toString("utf-8");
      const parsed = JSON.parse(json) as ParsedNFTMetadata;
      return {
        name: parsed.name ?? "",
        description: parsed.description,
        image: parsed.image,
        external_url: parsed.external_url,
        animation_url: parsed.animation_url,
        attributes: parsed.attributes,
      };
    } catch {
      return undefined;
    }
  }

  /** Calls ERC721 safeMint(to, uri) with owner account; returns receipt or error. */
  async safeMint(toAddress: string, tokenURI: string): Promise<MintResult> {
    if (!this.account) {
      return this.failResult(toUserMessage("OwnerKeyNotSet"));
    }
    if (!this.isValidAddress(toAddress)) {
      return this.failResult("Invalid recipient address (0x + 40 hex chars).");
    }

    try {
      const tx = prepareContractCall({
        contract: this.contract,
        method: "function safeMint(address to, string uri) returns (uint256)",
        params: [toAddress as `0x${string}`, tokenURI],
      });

      const result = await sendTransaction({
        transaction: tx,
        account: this.account,
      });

      const receipt = await waitForReceipt(result);

      return {
        success: true,
        transactionHash: receipt.transactionHash,
      };
    } catch (error) {
      return this.handleError(error, "safeMint");
    }
  }

  /** Alias for mintWithMetadata. */
  async mintTo(toAddress: string, metadata: NFTMetadata): Promise<MintResult> {
    return this.mintWithMetadata(toAddress, metadata);
  }

  /** Mints with a raw token URI (e.g. IPFS). */
  async mintWithIPFS(toAddress: string, ipfsURI: string): Promise<MintResult> {
    return this.safeMint(toAddress, ipfsURI);
  }

  /** Mints one NFT per recipient with a short delay between each. */
  async batchMint(recipients: BatchMintRecipient[]): Promise<MintResult[]> {
    const results: MintResult[] = [];
    for (const { address, metadata } of recipients) {
      const result = await this.mintWithMetadata(address, metadata);
      results.push(result);
      await new Promise((r) => setTimeout(r, 2000));
    }
    return results;
  }

  /** Builds token URIs for metadatas without sending transactions. */
  async lazyMint(metadatas: NFTMetadata[]): Promise<LazyMintResult> {
    if (!this.account) {
      return { success: false, error: toUserMessage("OwnerKeyNotSet") };
    }
    try {
      const tokenURIs = metadatas.map((m) => this.metadataToDataUri(m));
      return { success: true, tokenURIs };
    } catch (error) {
      return this.handleError(error, "lazyMint") as LazyMintResult;
    }
  }

  /** Estimates gas and cost for a safeMint to toAddress with the given metadata. */
  async estimateGasFee(toAddress: string, metadata: NFTMetadata): Promise<{
    gasLimit: string;
    estimatedCostWei: string;
    estimatedCostEth: string;
    adminBalance: string;
    adminBalanceEth: string;
    hasEnoughBalance: boolean;
  } | null> {
    if (!this.account) return null;
    try {
      const target = this.isValidAddress(toAddress) ? toAddress : this.account.address;
      const tokenURI = this.metadataToDataUri(metadata);
      const tx = prepareContractCall({
        contract: this.contract,
        method: "function safeMint(address to, string uri) returns (uint256)",
        params: [target as `0x${string}`, tokenURI],
      });

      const gasLimit = await estimateGas({ transaction: tx, account: this.account });
      const gasPrice = BigInt(30_000_000_000);
      const estimatedCostWei = gasLimit * gasPrice;
      const { balance, balanceEth } = await this.getOwnerBalance();

      return {
        gasLimit: gasLimit.toString(),
        estimatedCostWei: estimatedCostWei.toString(),
        estimatedCostEth: (Number(estimatedCostWei) / 1e18).toFixed(6),
        adminBalance: balance.toString(),
        adminBalanceEth: balanceEth,
        hasEnoughBalance: balance >= estimatedCostWei,
      };
    } catch {
      return null;
    }
  }

  /** Encodes metadata as data:application/json;base64,... */
  private metadataToDataUri(metadata: NFTMetadata): string {
    const json = JSON.stringify({
      name: metadata.name,
      description: metadata.description ?? "",
      image: metadata.image ?? "",
      external_url: metadata.external_url ?? "",
      animation_url: metadata.animation_url ?? "",
      attributes: metadata.attributes ?? [],
    });
    const base64 = Buffer.from(json).toString("base64");
    return `data:application/json;base64,${base64}`;
  }

  /** Validates EVM address format (0x + 40 hex chars). */
  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /** Returns a failed MintResult with the given error message. */
  private failResult(error: string): MintResult {
    return { success: false, error };
  }

  /** Returns MintResult with user message and optional contractError. */
  private handleError(error: unknown, _context: string): MintResult {
    const message = error instanceof Error ? error.message : String(error);
    const contractError = parseContractError(message);
    const userMessage = toUserMessage(contractError ?? message);

    return {
      success: false,
      error: userMessage,
      contractError: contractError ?? undefined,
    };
  }
}

/** Factory for Web3NftService; optionally pass config or use env (OWNER_PRIVATE_KEY, etc.). */
export function createWeb3NftService(config?: Web3NftConfig): Web3NftService {
  return new Web3NftService(config);
}
