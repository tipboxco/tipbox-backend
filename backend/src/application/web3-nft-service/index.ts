/**
 * AdminMintService Module
 * 
 * NFT contract owner'ı için server-side mint işlemleri.
 * ⚠️ SADECE server-side (API routes) kullanılmalı!
 * 
 * @see ./README.md - Detaylı dokümantasyon
 * 
 * @example
 * ```typescript
 * import { AdminMintService, createAdminMintService } from "@/services/admin-mint";
 * import type { NFTMetadata, AdminMintConfig } from "@/services/admin-mint";
 * ```
 */

// Service export
export { AdminMintService, createAdminMintService } from "./web3.nft.service";

// Type exports
export type {
  ContractAbi,
  AdminMintConfig,
  GasEstimate,
  AdminMintResult,
  LazyMintResult,
  NFTMetadata,
  NFTAttribute,
  GasLimitCheck,
  BatchMintRecipient,
} from "./types";
