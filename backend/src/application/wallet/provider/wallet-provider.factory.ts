/**
 * WalletProviderFactory — resolves the active IWalletProvider from env at runtime.
 *
 * Reads WALLET_PROVIDER env var (default: "thirdweb") and returns the matching
 * singleton provider.  All business logic depends only on IWalletProvider;
 * switching providers is a one-line env change.
 *
 * Supported values for WALLET_PROVIDER:
 *   "thirdweb"  — ThirdwebProvider (backed by ThirdwebSdkService + SDK v5)
 *   "alchemy"   — AlchemyProvider  (stub; implement before enabling)
 */

import { WalletProvider } from '../../../domain/wallet/wallet.entity';
import { getAlchemyProvider } from './alchemy/alchemy.provider';
import { getThirdwebProvider } from './thirdweb/thirdweb.provider';
import type { IWalletProvider } from './wallet-provider.interface';

// ============================================================================
// PROVIDER NAME
// ============================================================================

export type WalletProviderName = 'thirdweb' | 'alchemy';

/**
 * Returns the active provider name from WALLET_PROVIDER env var.
 * Defaults to "thirdweb" for backward compatibility.
 */
export function getActiveProviderName(): WalletProviderName {
  const raw = (process.env.WALLET_PROVIDER ?? 'thirdweb').trim().toLowerCase();
  if (raw === 'alchemy') return 'alchemy';
  return 'thirdweb';
}

/**
 * Returns the WalletProvider enum value that matches the active provider.
 * Used when persisting a newly created wallet to the DB.
 */
export function getActiveWalletProviderEnum(): WalletProvider {
  const name = getActiveProviderName();
  if (name === 'alchemy') return WalletProvider.ALCHEMY;
  return WalletProvider.THIRDWEB;
}

// ============================================================================
// FACTORY
// ============================================================================

let providerInstance: IWalletProvider | null = null;

/**
 * Returns the active IWalletProvider singleton.
 *
 * The instance is cached after the first call; call resetWalletProvider()
 * in tests when you need a fresh instance.
 */
export function getWalletProvider(): IWalletProvider {
  if (!providerInstance) {
    const name = getActiveProviderName();
    providerInstance = name === 'alchemy' ? getAlchemyProvider() : getThirdwebProvider();
  }
  return providerInstance;
}

/** Clears the cached provider instance. Intended for use in tests only. */
export function resetWalletProvider(): void {
  providerInstance = null;
}
