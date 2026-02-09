/**
 * Web3 NFT Service – Types for mint operations and wallet NFT listing.
 * Mint operations use owner private key (OWNER_PRIVATE_KEY) from env.
 */

import type { Chain } from "thirdweb";

export type ContractAbi = readonly unknown[];

/** Configuration for Web3NftService (private key, contract address, chain, ABI). */
export interface Web3NftConfig {
  /** NFT contract owner private key (0x...). From env: OWNER_PRIVATE_KEY or ADMIN_PRIVATE_KEY. */
  privateKey?: string;
  /** Thirdweb secret key. */
  secretKey?: string;
  /** NFT contract address. */
  contractAddress?: string;
  /** Chain (default: Sepolia). */
  chain?: Chain;
  /** Contract ABI including safeMint. */
  abi?: ContractAbi;
}

export interface MintResult {
  success: boolean;
  transactionHash?: string;
  tokenId?: string;
  error?: string;
  contractError?: string;
}

export interface LazyMintResult extends MintResult {
  tokenURIs?: string[];
}

export interface NFTAttribute {
  trait_type: string;
  value: string | number;
}

export interface NFTMetadata {
  name: string;
  description?: string;
  image?: string;
  animation_url?: string;
  external_url?: string;
  attributes?: NFTAttribute[];
}

export interface BatchMintRecipient {
  address: string;
  metadata: NFTMetadata;
}

/** Metadata decoded from tokenURI (data:application/json;base64,...). */
export interface ParsedNFTMetadata {
  name: string;
  description?: string;
  image?: string;
  external_url?: string;
  animation_url?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

/** Single NFT item listed for a wallet (tokenId, contract, tokenURI, parsed metadata). */
export interface WalletNFTItem {
  tokenId: string;
  contractAddress: string;
  tokenURI?: string;
  metadata?: ParsedNFTMetadata;
  collectionName?: string;
  collectionSymbol?: string;
}

/** Result of getWalletNFTs (caller may add eoa/smartAccount addresses). */
export interface WalletNFTsListResult {
  success: boolean;
  nfts: WalletNFTItem[];
  error?: string;
  contractError?: string;
}

/** Standard NFT metadata input (raw fields from API/UI). */
export interface NFTMetadataInput {
  name: string;
  description?: string;
  imageUrl?: string;
  externalUrl?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

/**
 * URL'den port numarasını kaldırır.
 * HTTPS:443 ve HTTP:80 varsayılan portlar zaten gizlenir.
 * MinIO/localhost:9000 gibi portlar da silinir (çıktı MEDIA_PUBLIC_BASE_URL host'unu kullanır).
 */
function stripPortFromUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    console.log({url});
    url.port = "";
    return url.toString();
  } catch {
    return urlString;
  }
}

/**
 * Contract'tan gelen image URL'deki host'u .env'deki MEDIA_PUBLIC_BASE_URL ile değiştirir.
 * Port numarası kaldırılır. data: ve ipfs: URL'leri olduğu gibi döndürülür.
 */
function replaceImageUrlHost(imageUrl: string): string {
  if (imageUrl.startsWith("data:") || imageUrl.startsWith("ipfs:")) return imageUrl;
  try {
    const { resolveMediaUrl } = require("../../infrastructure/config/media.config");
    const resolved = resolveMediaUrl(imageUrl);
    console.log({resolved, imageUrl});
    return resolved ? stripPortFromUrl(resolved) : imageUrl;
  } catch {
    return imageUrl;
  }
}

/**
 * NFT metadata'dan image URL çözümler. Contract'tan gelen imageUrl/metadata.image
 * host bilgisi .env'deki MEDIA_PUBLIC_BASE_URL ile değiştirilir (CORS, media proxy için).
 * Wallet NFT listesinde kullanılır.
 */
export function resolveNftImageUrl(metadata: {
  image?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
} | undefined): string | undefined {
  const rawImage = metadata?.image ? String(metadata.image).trim() : "";
  const hasValidImage =
    rawImage.length >= 10 &&
    (rawImage.startsWith("http") || rawImage.startsWith("ipfs") || rawImage.startsWith("data:"));
  if (hasValidImage) return replaceImageUrlHost(rawImage);

  const fallback = process.env.NFT_BADGE_IMAGE_URL?.trim();
  if (fallback) return fallback;

  return rawImage || undefined;
}

/**
 * Builds NFTMetadata.attributes from input attribute list (keeps entries with trait_type and value).
 */
export function createNFTMetadata(input: NFTMetadataInput): NFTMetadata {
  const attributes = (input.attributes ?? [])
    .filter((a) => a.trait_type != null && a.value != null && String(a.value).trim() !== "")
    .map((a) => ({ trait_type: a.trait_type, value: a.value }));
  return {
    name: input.name,
    description: input.description ?? undefined,
    image: input.imageUrl ?? undefined,
    external_url: input.externalUrl ?? undefined,
    attributes: attributes.length > 0 ? attributes : undefined,
  };
}
