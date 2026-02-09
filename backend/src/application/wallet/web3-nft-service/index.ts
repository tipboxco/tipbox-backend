/**
 * Web3 NFT Service – Public API.
 *
 * Server-side mint for Tipbox Badge (ERC721) using owner private key (OWNER_PRIVATE_KEY).
 * Shares error handling (parseContractError, toUserMessage) with thirdweb-sdk.
 */

export { Web3NftService, createWeb3NftService } from "./web3.nft.service";
export { DEFAULT_BADGE_METADATA } from "./defaults";
export type {
  BatchMintRecipient,
  ContractAbi,
  LazyMintResult,
  MintResult,
  NFTAttribute,
  NFTMetadata,
  NFTMetadataInput,
  ParsedNFTMetadata,
  WalletNFTItem,
  WalletNFTsListResult,
  Web3NftConfig,
} from "./types";
export { createNFTMetadata, resolveNftImageUrl } from "./types";
