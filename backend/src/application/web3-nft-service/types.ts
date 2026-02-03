/**
 * AdminMintService Tip Tanımları
 * 
 * @see ./service.ts
 * @see ./README.md
 */

import type { Chain } from "thirdweb";

// ============================================================================
// ABI TİPİ
// ============================================================================

/** Contract ABI tipi - readonly array */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContractAbi = readonly any[];

// ============================================================================
// CONFIG
// ============================================================================

/**
 * AdminMintService yapılandırma seçenekleri
 * Constructor'a geçirilecek config objesi
 */
export interface AdminMintConfig {
  /** NFT contract owner'ının private key'i (0x... formatında) */
  privateKey?: string;
  /** Thirdweb secret key (dashboard'dan alınır, opsiyonel) */
  secretKey?: string;
  /** NFT contract adresi */
  contractAddress?: string;
  /** Blockchain network (Chain objesi) */
  chain?: Chain;
  /** Contract ABI (safeMint fonksiyonunu içermeli) */
  abi?: ContractAbi;
  /** Maksimum gas fee limiti (ETH cinsinden). Bu değerin üzerindeki işlemler reddedilir. */
  maxGasFeeEth?: number;
}

// ============================================================================
// SONUÇ TİPLERİ
// ============================================================================

/**
 * Gas tahmini sonucu
 * estimateGasFee() fonksiyonunun döndürdüğü değer
 */
export interface GasEstimate {
  /** Gas limit (wei cinsinden) */
  gasLimit: string;
  /** Gas price (wei cinsinden) */
  gasPrice: string;
  /** Tahmini toplam maliyet (wei) */
  estimatedCostWei: string;
  /** Tahmini toplam maliyet (ETH) */
  estimatedCostEth: string;
  /** Admin cüzdan bakiyesi (wei) */
  adminBalance: string;
  /** Admin cüzdan bakiyesi (ETH) */
  adminBalanceEth: string;
  /** Bakiye yeterli mi? */
  hasEnoughBalance: boolean;
}

/**
 * Mint işlemi sonucu
 * Tüm mint fonksiyonlarının döndürdüğü değer
 */
export interface AdminMintResult {
  /** İşlem başarılı mı? */
  success: boolean;
  /** Blockchain transaction hash (başarılı ise) */
  transactionHash?: string;
  /** Mint edilen token ID (varsa) */
  tokenId?: string;
  /** Hata mesajı (başarısız ise) */
  error?: string;
}

/**
 * Lazy mint sonucu
 * lazyMint() fonksiyonunun döndürdüğü değer
 */
export interface LazyMintResult extends AdminMintResult {
  /** Hazırlanan token URI'ları */
  tokenURIs?: string[];
}

/**
 * Gas limit kontrol sonucu
 */
export interface GasLimitCheck {
  /** Limit içinde mi? */
  withinLimit: boolean;
  /** Ayarlanan limit (null = limit yok) */
  limit: number | null;
  /** Tahmini gas (ETH) */
  estimated: number;
  /** Hata mesajı (limit aşıldıysa) */
  message?: string;
}

// ============================================================================
// NFT METADATA
// ============================================================================

/**
 * NFT Özellik (Attribute)
 */
export interface NFTAttribute {
  /** Özellik adı (örn: "Tier", "Level") */
  trait_type: string;
  /** Özellik değeri (string veya sayı) */
  value: string | number;
}

/**
 * NFT Metadata
 * OpenSea ve diğer marketplace'lerin desteklediği standart format
 * 
 * @example
 * ```typescript
 * const metadata: NFTMetadata = {
 *   name: "TipBox Badge #1",
 *   description: "Topluluk rozeti",
 *   image: "ipfs://QmXxx...",
 *   external_url: "https://tipbox.app/badge/1",
 *   attributes: [
 *     { trait_type: "Tier", value: "Gold" },
 *     { trait_type: "Level", value: 5 }
 *   ]
 * };
 * ```
 */
export interface NFTMetadata {
  /** NFT adı (zorunlu) - OpenSea'de görünür */
  name: string;
  /** NFT açıklaması - Detaylı bilgi */
  description?: string;
  /** NFT görseli - IPFS veya HTTPS URL */
  image?: string;
  /** Animasyon/video URL - GIF, MP4 vb. */
  animation_url?: string;
  /** Harici link - Proje websitesi */
  external_url?: string;
  /** NFT özellikleri - Marketplace'lerde filtrelenebilir */
  attributes?: NFTAttribute[];
}

// ============================================================================
// BATCH MINT
// ============================================================================

/**
 * Toplu mint için alıcı bilgisi
 */
export interface BatchMintRecipient {
  /** Alıcı cüzdan adresi */
  address: string;
  /** NFT metadata'sı */
  metadata: NFTMetadata;
}
