/**
 * ThirdwebProvider — IWalletProvider adapter backed by ThirdwebSdkService.
 *
 * Thin delegation layer: every method proxies to the existing ThirdwebSdkService
 * so no business logic lives here — it all stays in the service.
 */

import {
  getThirdwebSdkService,
  ThirdwebSdkService,
} from '../../thirdweb-sdk/thirdweb-sdk.service';
import type {
  IWalletProvider,
  MintBadgeResult,
  WalletProviderConfig,
} from '../wallet-provider.interface';
import type {
  ClaimResult,
  PendingTipsResult,
  ThirdwebSdkAuthResult,
  TipResult,
  TokenBalanceForAddressResult,
  WalletBalanceResult,
  WalletNFTsResult,
} from '../../thirdweb-sdk/types';

export class ThirdwebProvider implements IWalletProvider {
  private readonly svc: ThirdwebSdkService;

  constructor(service?: ThirdwebSdkService) {
    this.svc = service ?? getThirdwebSdkService();
  }

  isConfigured(): boolean {
    return this.svc.isConfigured();
  }

  getConfig(): WalletProviderConfig {
    return this.svc.getConfig();
  }

  authenticateAndGetAddresses(
    userId: string,
    chainId?: number,
  ): Promise<ThirdwebSdkAuthResult> {
    return this.svc.authenticateAndGetAddresses(userId, chainId);
  }

  sendTip(userId: string, amountWei: bigint, targetAddress: string): Promise<TipResult> {
    return this.svc.sendTip(userId, amountWei, targetAddress);
  }

  transferToAddress(userId: string, amountWei: bigint, toAddress: string): Promise<TipResult> {
    return this.svc.transferToAddress(userId, amountWei, toAddress);
  }

  claim(userId: string): Promise<ClaimResult> {
    return this.svc.claim(userId);
  }

  async mintDefaultBadgeForUser(userId: string): Promise<MintBadgeResult> {
    const raw = await this.svc.mintDefaultBadgeForUser(userId);
    if (raw.success) {
      return {
        success: true,
        transactionHash: raw.transactionHash,
        eoaAddress: raw.eoaAddress,
        smartAccountAddress: raw.smartAccountAddress,
        userId: raw.thirdwebUserId ?? userId,
      };
    }
    return {
      success: false,
      error: raw.error,
      contractError: raw.contractError,
      eoaAddress: raw.eoaAddress,
      smartAccountAddress: raw.smartAccountAddress,
      userId: raw.thirdwebUserId ?? userId,
    };
  }

  getWalletBalanceForUser(userId: string): Promise<WalletBalanceResult> {
    return this.svc.getWalletBalanceForUser(userId);
  }

  getPendingTipsForUser(userId: string): Promise<PendingTipsResult> {
    return this.svc.getPendingTipsForUser(userId);
  }

  getWalletNFTsForUser(userId: string): Promise<WalletNFTsResult> {
    return this.svc.getWalletNFTsForUser(userId);
  }

  getTokenBalanceForAddress(address: string): Promise<TokenBalanceForAddressResult> {
    return this.svc.getTokenBalanceForAddress(address);
  }

  getPendingTips(address: string): Promise<PendingTipsResult> {
    return this.svc.getPendingTips(address);
  }

  getFeePercentage(): Promise<number> {
    return this.svc.getFeePercentage();
  }

  getFeeRecipient(): Promise<string | null> {
    return this.svc.getFeeRecipient();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: ThirdwebProvider | null = null;

export function getThirdwebProvider(): ThirdwebProvider {
  if (!instance) instance = new ThirdwebProvider();
  return instance;
}
