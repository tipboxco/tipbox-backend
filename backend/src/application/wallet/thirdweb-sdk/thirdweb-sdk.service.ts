/**
 * ThirdwebSdkService
 * 
 * This service enables wallet sessions and Tipbox operations (tip, claim, pendingTips, transfer)
 * using Thirdweb SDK v5. Authentication is handled via the auth_endpoint strategy.
 * Contract deployed on Sepolia chain.
 *
 * Released under the GNU General Public License (GPL).
 * Public, open source: anyone may use and contribute.
 * 
 * Original Author: İBRAHİM GÜZEL https://github.com/iguzelofficial
 *
 * @see https://portal.thirdweb.com/typescript/v5
 */

import { CONFIG } from "../config/config";
import { parseContractError, toUserMessage } from "./contract-errors";
import type {
  ClaimResult,
  PendingTipsResult,
  ThirdwebSdkAuthResult,
  TipResult,
  WalletBalanceResult,
  WalletNFTsResult,
} from "./types";
import { ThirdwebCore, decodeBytes32ToString, type ThirdwebCoreContracts } from "./thirdweb.core";
import { createWeb3NftService } from "../web3-nft-service";

// Re-export types for backward compatibility
export type { ThirdwebSdkAuthResult, ThirdwebSdkConfig } from "./types"
export { TIPBOX_ERROR_NAMES, type TipboxErrorName } from "./types"

// ============================================================================
// SERVICE
// ============================================================================

export class ThirdwebSdkService {
  private readonly core: ThirdwebCore;

  constructor(core?: ThirdwebCore) {
    this.core =
      core ??
      new ThirdwebCore({
        clientId: process.env.THIRDWEB_CLIENT_ID || "",
        secretKey: process.env.THIRDWEB_SECRET_KEY || "",
        chainId: parseInt(process.env.THIRDWEB_DEFAULT_CHAIN_ID || String(CONFIG.chainId), 10),
        rpcUrl: CONFIG.rpcUrl,
        sponsorGas: process.env.THIRDWEB_SPONSOR_GAS === "true",
        walletId: process.env.THIRDWEB_WALLET_ID || "tipbox-embedded-wallet",
        contracts: CONFIG.contracts as ThirdwebCoreContracts,
      });
  }

  // ==========================================================================
  // AUTHENTICATION (authenticateAndGetAddresses – no tip transfer)
  // ==========================================================================

  /**
   * Connects wallet and Smart Account for the given userId; returns EOA and Smart Account addresses.
   * Does not perform a tip transfer. Use sendTip for tipping.
   */
  async authenticateAndGetAddresses(
    userId: string,
    _chainId?: number
  ): Promise<ThirdwebSdkAuthResult> {
    const chain = this.core.getChain();
    let eoaAddress: string | undefined;
    let smartAccountAddress: string | undefined;

    try {
      const connected = await this.core.connectWalletAndSmartAccount(userId);
      eoaAddress = connected.eoaAddress;
      smartAccountAddress = connected.smartAccountAddress;

      return {
        success: true,
        eoaAddress,
        smartAccountAddress,
        thirdwebUserId: userId,
      };
    } catch (error) {
      return this.handleAuthError(
        error,
        userId,
        chain.id,
        eoaAddress,
        smartAccountAddress
      );
    }
  }

  // ==========================================================================
  // TIPBOX OPERATIONS (private helpers + public API)
  // ==========================================================================

  /**
   * Checks Smart Account token balance and logs it. Used before sending a tip.
   * @returns true if balance is sufficient; false otherwise (tip contract should not be called).
   */
  private async checkTokenBalanceAndLog(
    accountAddress: string,
    amountWei: bigint
  ): Promise<boolean> {
    const tokenContract = this.core.getTokenContract();
    const [balanceWei, decimals] = await Promise.all([
      this.core.readContract<bigint>({
        contract: tokenContract,
        method: "balanceOf",
        params: [accountAddress],
      }),
      this.core.readContract<number>({
        contract: tokenContract,
        method: "decimals",
        params: [],
      }),
    ]);

    const hasSufficientBalance = balanceWei >= amountWei;
    return hasSufficientBalance;
  }

  /** Ensures Tipbox has sufficient ERC20 allowance from the Smart Account; approves if needed. */
  private async ensureTokenAllowance(
    account: Awaited<ReturnType<ThirdwebCore["connectWalletAndSmartAccount"]>>["smartAccount"],
    ownerAddress: string,
    amountWei: bigint
  ): Promise<void> {
    const tokenContract = this.core.getTokenContract();
    const tipboxAddress = this.core.getTipboxAddress();
    const currentAllowance = await this.core.readContract<bigint>({
      contract: tokenContract,
      method: "allowance",
      params: [ownerAddress, tipboxAddress],
    });

    if (currentAllowance >= amountWei) return;

    const approveTx = this.core.prepareContractCall({
      contract: tokenContract,
      method: "approve",
      params: [tipboxAddress, amountWei],
    });

    await this.core.sendTransactionAndWait(approveTx, account);
  }

  /** Sends the Tipbox tip() transaction from the Smart Account to tipTarget. */
  private async executeTip(
    account: Awaited<ReturnType<ThirdwebCore["connectWalletAndSmartAccount"]>>["smartAccount"],
    amountWei: bigint,
    tipTarget: string
  ): Promise<unknown> {
    const tipTx = this.core.prepareContractCall({
      contract: this.core.getTipboxContract(),
      method: "tip",
      params: [amountWei, tipTarget as `0x${string}`],
    });

    return this.core.sendTransactionAndWait(tipTx, account);
  }

  /** Maps auth/wallet errors to ThirdwebSdkAuthResult with user message and optional contractError. */
  private handleAuthError(
    error: unknown,
    userId: string,
    chainId: number,
    eoaAddress?: string,
    smartAccountAddress?: string
  ): ThirdwebSdkAuthResult {
    const message = error instanceof Error ? error.message : String(error);
    const contractError = parseContractError(message);
    const userMessage = toUserMessage(contractError ?? message);

    return {
      success: false,
      error: userMessage,
      contractError: contractError ?? undefined,
      eoaAddress,
      smartAccountAddress,
      thirdwebUserId: userId,
    };
  }

  /**
   * Sends a tip: connects wallet for userId and transfers amountWei to targetAddress via Tipbox.
   */
  async sendTip(
    userId: string,
    amountWei: bigint,
    targetAddress: string
  ): Promise<TipResult> {
    let eoaAddress: string | undefined;
    let smartAccountAddress: string | undefined;

    try {
      const connected = await this.core.connectWalletAndSmartAccount(userId);
      eoaAddress = connected.eoaAddress;
      smartAccountAddress = connected.smartAccountAddress;

      const hasSufficientBalance = await this.checkTokenBalanceAndLog(
        smartAccountAddress,
        amountWei
      );

      if (!hasSufficientBalance) {
        const userMessage = toUserMessage("ERC20InsufficientBalance");
        return {
          success: false,
          error: userMessage,
          contractError: "ERC20InsufficientBalance",
          eoaAddress,
          smartAccountAddress,
          thirdwebUserId: userId,
        };
      }

      await this.ensureTokenAllowance(
        connected.smartAccount,
        smartAccountAddress,
        amountWei
      );

      const receipt = await this.executeTip(
        connected.smartAccount,
        amountWei,
        targetAddress
      );

      return {
        success: true,
        eoaAddress,
        smartAccountAddress,
        thirdwebUserId: userId,
        receipt,
        amountWei: amountWei.toString(),
        targetAddress,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const contractError = parseContractError(message);
      const userMessage = toUserMessage(contractError ?? message);
      return {
        success: false,
        error: userMessage,
        contractError: contractError ?? undefined,
        eoaAddress,
        smartAccountAddress,
        thirdwebUserId: userId,
      };
    }
  }

  /**
   * Claims pending tips for the user: connects wallet and calls Tipbox claim().
   * If NoBadgeOwned is returned, the caller (e.g. controller) may mint a badge and retry claim.
   */
  async claim(userId: string): Promise<ClaimResult> {
    let eoaAddress: string | undefined;
    let smartAccountAddress: string | undefined;

    try {
      const connected = await this.core.connectWalletAndSmartAccount(userId);
      eoaAddress = connected.eoaAddress;
      smartAccountAddress = connected.smartAccountAddress;

      const receipt = await this.executeClaim(connected);
      return {
        success: true,
        eoaAddress,
        smartAccountAddress,
        thirdwebUserId: userId,
        receipt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const contractError = parseContractError(message);
      const userMessage = toUserMessage(contractError ?? message);
      return {
        success: false,
        error: userMessage,
        contractError: contractError ?? undefined,
        eoaAddress,
        smartAccountAddress,
        thirdwebUserId: userId,
      };
    }
  }

  /**
   * Sends the Tipbox claim transaction; throws on error.
   */
  private async executeClaim(connected: {
    smartAccount: Awaited<ReturnType<ThirdwebCore["connectWalletAndSmartAccount"]>>["smartAccount"];
  }) {
    const claimTx = this.core.prepareContractCall({
      contract: this.core.getTipboxContract(),
      method: "claim",
      params: [],
    });
    return this.core.sendTransactionAndWait(claimTx, connected.smartAccount);
  }

  /**
   * Connects wallet for userId and mints the default Tipbox badge to the user's Smart Account.
   * Used after NoBadgeOwned so the user can then call claim.
   */
  async mintDefaultBadgeForUser(userId: string): Promise<
    { success: true; transactionHash?: string; eoaAddress: string; smartAccountAddress: string; thirdwebUserId: string } |
    { success: false; error?: string; contractError?: string; eoaAddress?: string; smartAccountAddress?: string; thirdwebUserId: string }
  > {
    try {
      const connected = await this.core.connectWalletAndSmartAccount(userId);
      const nftService = createWeb3NftService();
      const mintResult = await nftService.mintDefaultBadge(connected.smartAccountAddress);
      if (!mintResult.success) {
        return {
          success: false,
          error: mintResult.error,
          contractError: mintResult.contractError,
          eoaAddress: connected.eoaAddress,
          smartAccountAddress: connected.smartAccountAddress,
          thirdwebUserId: userId,
        };
      }
      return {
        success: true,
        transactionHash: mintResult.transactionHash,
        eoaAddress: connected.eoaAddress,
        smartAccountAddress: connected.smartAccountAddress,
        thirdwebUserId: userId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const contractError = parseContractError(message);
      const userMessage = toUserMessage(contractError ?? message);
      return {
        success: false,
        error: userMessage,
        contractError: contractError ?? undefined,
        thirdwebUserId: userId,
      };
    }
  }

  /**
   * Reads ERC20 name() or symbol(): tries string ABI first; on viem decode error (Position out of bounds),
   * falls back to bytes32 ABI and decodes to string. Some tokens return bytes32 instead of string.
   */
  private async readTokenNameOrSymbol(method: "name" | "symbol"): Promise<string> {
    const tokenContract = this.core.getTokenContract();
    try {
      const value = await this.core.readContract<string>({
        contract: tokenContract,
        method,
        params: [],
      });
      return value ?? "";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isDecodeError =
        message.includes("Position") && message.includes("out of bounds");
      if (!isDecodeError) throw err;
      try {
        const hex = await this.core.readContract<`0x${string}`>({
          contract: this.core.getTokenContractNameSymbolBytes32(),
          method,
          params: [],
        });
        return decodeBytes32ToString(hex);
      } catch {
        return "";
      }
    }
  }

  /**
   * Connects wallet for userId and returns Smart Account balance at token level.
   * Returns native (ETH) plus config token; name/symbol read from contract (environment-agnostic).
   * If token returns name/symbol as bytes32 (causing viem "Position out of bounds"), falls back to bytes32 decode.
   */
  async getWalletBalanceForUser(userId: string): Promise<WalletBalanceResult> {
    try {
      const connected = await this.core.connectWalletAndSmartAccount(userId);
      const tokenContract = this.core.getTokenContract();

      const [nativeBalance, tokenBalanceWei, decimals] = await Promise.all([
        this.core.getNativeBalance(connected.smartAccountAddress),
        this.core.readContract<bigint>({
          contract: tokenContract,
          method: "balanceOf",
          params: [connected.smartAccountAddress as `0x${string}`],
        }),
        this.core.readContract<number>({
          contract: tokenContract,
          method: "decimals",
          params: [],
        }),
      ]);

      const tokenName = await this.readTokenNameOrSymbol("name");
      const tokenSymbol = await this.readTokenNameOrSymbol("symbol");

      const tokenFormatted = Number(tokenBalanceWei) / 10 ** decimals;

      const tokens: WalletBalanceResult["tokens"] = [
        {
          symbol: nativeBalance.symbol,
          balanceWei: nativeBalance.balance,
          balanceFormatted: nativeBalance.formatted,
        },
        {
          name: tokenName,
          symbol: tokenSymbol,
          address: tokenContract.address,
          balanceWei: tokenBalanceWei.toString(),
          balanceFormatted: String(tokenFormatted),
          decimals,
        },
      ];

      return {
        success: true,
        eoaAddress: connected.eoaAddress,
        smartAccountAddress: connected.smartAccountAddress,
        tokens,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const contractError = parseContractError(message);
      const userMessage = toUserMessage(contractError ?? message);
      return {
        success: false,
        tokens: [],
        error: userMessage,
        contractError: contractError ?? undefined,
      };
    }
  }

  /**
   * Connects wallet for userId and returns pending tip amount for that Smart Account (read-only).
   * Use with the same user as authenticate (THIRDWEB_USER_ID).
   */
  async getPendingTipsForUser(userId: string): Promise<PendingTipsResult> {
    try {
      const connected = await this.core.connectWalletAndSmartAccount(userId);
      return this.getPendingTips(connected.smartAccountAddress);
    } catch (error) {
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



  /**
   * userId ile wallet bağlanır, Smart Account’a ait NFT listesi web3-nft-service üzerinden döndürülür.
   */
  async getWalletNFTsForUser(userId: string): Promise<WalletNFTsResult> {
    try {
      const connected = await this.core.connectWalletAndSmartAccount(userId);
      const nftService = createWeb3NftService();
      const listResult = await nftService.getWalletNFTs(connected.smartAccountAddress);
      if (!listResult.success) {
        return {
          success: false,
          nfts: [],
          error: listResult.error,
          contractError: listResult.contractError,
        };
      }
      return {
        success: true,
        eoaAddress: connected.eoaAddress,
        smartAccountAddress: connected.smartAccountAddress,
        nfts: listResult.nfts,
      };
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
   * Returns pending tip amount for the given address (read-only).
   */
  async getPendingTips(address: string): Promise<PendingTipsResult> {
    try {
      const pendingWei = await this.core.readContract<bigint>({
        contract: this.core.getTipboxContract(),
        method: "pendingTips",
        params: [address as `0x${string}`],
      });
      const decimals = await this.core.readContract<number>({
        contract: this.core.getTokenContract(),
        method: "decimals",
        params: [],
      });
      const pendingFormatted = Number(pendingWei) / 10 ** decimals;
      const result: PendingTipsResult = {
        success: true,
        pendingWei: pendingWei.toString(),
        pendingFormatted,
      };
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ==========================================================================
  // CONFIG HELPERS
  // ==========================================================================

  /** Returns whether the Thirdweb client is configured. */
  isConfigured(): boolean {
    return this.core.isConfigured();
  }

  /** Returns current SDK config (chainId, sponsorGas, walletId, isReady). */
  getConfig(): {
    chainId: number;
    sponsorGas: boolean;
    walletId: string;
    isReady: boolean;
  } {
    return this.core.getConfigSnapshot();
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let thirdwebSdkServiceInstance: ThirdwebSdkService | null = null;

/** Returns the shared ThirdwebSdkService instance (singleton). */
export function getThirdwebSdkService(): ThirdwebSdkService {
  if (!thirdwebSdkServiceInstance) {
    thirdwebSdkServiceInstance = new ThirdwebSdkService();
  }
  return thirdwebSdkServiceInstance;
}
