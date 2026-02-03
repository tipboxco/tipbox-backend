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
