/**
 * AlchemyProvider — IWalletProvider stub for Alchemy Account Kit.
 *
 * STATUS: Not yet implemented. Methods throw WalletProviderNotImplementedError.
 *
 * Environment variables (required when WALLET_PROVIDER=alchemy):
 *   ALCHEMY_API_KEY      — Alchemy API key
 *   ALCHEMY_ACCESS_KEY   — Server wallet access key (generated via generateAccessKey())
 *   ALCHEMY_CHAIN_ID     — Chain ID (default: 11155111 Sepolia)
 *   ALCHEMY_SPONSOR_GAS  — "true" to enable Gas Manager sponsorship
 *
 * Implementation guide: see docs/thirdweb-to-alchemy-migration-report.md
 *   Section 6 — Component migration map
 *   Section 5 — Server-side custom OAuth and AA management
 */

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

// ============================================================================
// NOT-IMPLEMENTED HELPER
// ============================================================================

function notImplemented(method: string): never {
  throw new Error(
    `AlchemyProvider.${method} is not yet implemented. ` +
      'Set WALLET_PROVIDER=thirdweb to use the ThirdWeb provider, ' +
      'or implement this method. See docs/thirdweb-to-alchemy-migration-report.md.',
  );
}

// ============================================================================
// PROVIDER
// ============================================================================

export class AlchemyProvider implements IWalletProvider {
  isConfigured(): boolean {
    return !!(process.env.ALCHEMY_API_KEY && process.env.ALCHEMY_ACCESS_KEY);
  }

  getConfig(): WalletProviderConfig {
    return {
      chainId: parseInt(process.env.ALCHEMY_CHAIN_ID ?? '11155111', 10),
      sponsorGas: process.env.ALCHEMY_SPONSOR_GAS === 'true',
      walletId: 'alchemy-server-wallet',
      isReady: this.isConfigured(),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  authenticateAndGetAddresses(_userId: string, _chainId?: number): Promise<ThirdwebSdkAuthResult> {
    return notImplemented('authenticateAndGetAddresses');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sendTip(_userId: string, _amountWei: bigint, _targetAddress: string): Promise<TipResult> {
    return notImplemented('sendTip');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  transferToAddress(_userId: string, _amountWei: bigint, _toAddress: string): Promise<TipResult> {
    return notImplemented('transferToAddress');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  claim(_userId: string): Promise<ClaimResult> {
    return notImplemented('claim');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mintDefaultBadgeForUser(_userId: string): Promise<MintBadgeResult> {
    return notImplemented('mintDefaultBadgeForUser');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getWalletBalanceForUser(_userId: string): Promise<WalletBalanceResult> {
    return notImplemented('getWalletBalanceForUser');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getPendingTipsForUser(_userId: string): Promise<PendingTipsResult> {
    return notImplemented('getPendingTipsForUser');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getWalletNFTsForUser(_userId: string): Promise<WalletNFTsResult> {
    return notImplemented('getWalletNFTsForUser');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getTokenBalanceForAddress(_address: string): Promise<TokenBalanceForAddressResult> {
    return notImplemented('getTokenBalanceForAddress');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getPendingTips(_address: string): Promise<PendingTipsResult> {
    return notImplemented('getPendingTips');
  }

  getFeePercentage(): Promise<number> {
    return notImplemented('getFeePercentage');
  }

  getFeeRecipient(): Promise<string | null> {
    return notImplemented('getFeeRecipient');
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: AlchemyProvider | null = null;

export function getAlchemyProvider(): AlchemyProvider {
  if (!instance) instance = new AlchemyProvider();
  return instance;
}
