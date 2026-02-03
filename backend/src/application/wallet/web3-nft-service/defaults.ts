/**
 * Web3 NFT Service – Default metadata for standard NFT fields.
 * Uses createNFTMetadata to build name, description, imageUrl, externalUrl, attributes for Smart Wallet mint.
 */

import { createNFTMetadata, type NFTMetadataInput } from "./types";

/** Standard input for Tipbox badge (used with createNFTMetadata). */
const DEFAULT_BADGE_METADATA_INPUT: NFTMetadataInput = {
  name: "Tipbox Badge",
  description: "Badge required for Tipbox claim.",
  imageUrl: undefined,
  externalUrl: undefined,
  attributes: [
    { trait_type: "type", value: "badge" },
    { trait_type: "usage", value: "tipbox_claim" },
  ],
};

/** Default badge metadata produced by createNFTMetadata; minted to Smart Wallet. */
export const DEFAULT_BADGE_METADATA = createNFTMetadata(DEFAULT_BADGE_METADATA_INPUT);
