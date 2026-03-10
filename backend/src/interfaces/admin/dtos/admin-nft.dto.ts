/* ========== NFT ========== */

export type AdminNFTStatsResponse = {
  total: number;
  byType: Record<string, number>;
  byRarity: Record<string, number>;
  totalTransactions: number;
  activeListings: number;
  mostViewedNFTs: {
    nftId: string;
    name: string;
    viewCount: number;
  }[];
};

export type AdminNFTListItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  type: string;
  rarity: string;
  isTransferable: boolean;
  currentOwnerId: string | null;
  currentOwnerUsername: string | null;
  viewCount: number;
  transactionCount: number;
  createdAt: string;
};

export type AdminNFTDetailResponse = AdminNFTListItem & {
  updatedAt: string;
  attributes: {
    id: string;
    key: string;
    value: string;
  }[];
  currentOwner: {
    id: string;
    email: string | null;
    username: string | null;
  } | null;
  recentTransactions: {
    id: string;
    fromUserId: string | null;
    fromUsername: string | null;
    toUserId: string;
    toUsername: string | null;
    transactionType: string;
    price: number | null;
    createdAt: string;
  }[];
  marketListings: {
    id: string;
    price: number;
    status: string;
    listedAt: string;
  }[];
};

/* ========== NFT Transactions ========== */

export type AdminNFTTransactionListItem = {
  id: string;
  nftId: string;
  nftName: string;
  fromUserId: string | null;
  fromUsername: string | null;
  toUserId: string;
  toUsername: string | null;
  transactionType: string;
  price: number | null;
  transactionHash: string | null;
  createdAt: string;
};

/* ========== NFT Marketplace ========== */

export type AdminNFTMarketListingListItem = {
  id: string;
  nftId: string;
  nftName: string;
  nftImageUrl: string;
  listedByUserId: string;
  listedByUsername: string | null;
  price: number;
  status: string;
  listedAt: string;
  createdAt: string;
};

export type AdminNFTMarketListingDetailResponse = AdminNFTMarketListingListItem & {
  updatedAt: string;
  nft: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string;
    type: string;
    rarity: string;
  };
  listedBy: {
    id: string;
    email: string | null;
    username: string | null;
  };
};

/* ========== Lootbox ========== */

export type AdminLootboxStatsResponse = {
  total: number;
  locked: number;
  unlocked: number;
  totalTipsLocked: number;
  avgTipsPerLootbox: number;
};

export type AdminLootboxListItem = {
  id: string;
  userId: string;
  userEmail: string | null;
  username: string | null;
  tipsLocked: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminLootboxDetailResponse = AdminLootboxListItem & {
  user: {
    id: string;
    email: string | null;
    username: string | null;
  };
};

/* ========== Input Types (inferred from schemas) ========== */

import type {
  AdminCreateNFTSchema,
  AdminUpdateNFTSchema,
  AdminTransferNFTSchema,
  AdminModerateListingSchema,
  AdminUnlockLootboxSchema,
} from '../schemas/admin-nft.schemas';
import type { z } from 'zod';

export type AdminCreateNFTInput = z.infer<typeof AdminCreateNFTSchema>;
export type AdminUpdateNFTInput = z.infer<typeof AdminUpdateNFTSchema>;
export type AdminTransferNFTInput = z.infer<typeof AdminTransferNFTSchema>;
export type AdminModerateListingInput = z.infer<typeof AdminModerateListingSchema>;
export type AdminUnlockLootboxInput = z.infer<typeof AdminUnlockLootboxSchema>;
