import { z } from 'zod';

/* ========== NFT ========== */

export const AdminNFTQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().optional(),
  type: z.enum(['BADGE', 'ACHIEVEMENT', 'COLLECTIBLE', 'EVENT']).optional(),
  rarity: z.enum(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']).optional(),
  currentOwnerId: z.string().uuid().optional(),
  isTransferable: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  sort: z.enum(['createdAt', 'viewCount', 'name']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminCreateNFTSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url(),
  type: z.enum(['BADGE', 'ACHIEVEMENT', 'COLLECTIBLE', 'EVENT']),
  rarity: z.enum(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']),
  isTransferable: z.boolean().default(true),
  currentOwnerId: z.string().uuid().optional().nullable(),
  attributes: z
    .array(
      z.object({
        traitType: z.string().min(1).max(100),
        value: z.string().min(1).max(200),
      })
    )
    .optional(),
});

export const AdminUpdateNFTSchema = AdminCreateNFTSchema.partial().omit({
  attributes: true,
});

export const AdminTransferNFTSchema = z.object({
  toUserId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

/* ========== NFT Transactions ========== */

export const AdminNFTTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  nftId: z.string().uuid().optional(),
  fromUserId: z.string().uuid().optional(),
  toUserId: z.string().uuid().optional(),
  transactionType: z
    .enum(['MINT', 'TRANSFER', 'SALE', 'CLAIM', 'BURN'])
    .optional(),
  sort: z.enum(['createdAt', 'price']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/* ========== NFT Marketplace ========== */

export const AdminNFTMarketListingsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  nftId: z.string().uuid().optional(),
  listedByUserId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED']).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(['createdAt', 'price']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminModerateListingSchema = z.object({
  status: z.enum(['ACTIVE', 'CANCELLED']),
  moderatorNote: z.string().max(500).optional(),
});

/* ========== Lootbox ========== */

export const AdminLootboxQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  userId: z.string().uuid().optional(),
  status: z.enum(['LOCKED', 'UNLOCKED']).optional(),
  minTipsLocked: z.coerce.number().min(0).optional(),
  maxTipsLocked: z.coerce.number().min(0).optional(),
  sort: z.enum(['createdAt', 'tipsLocked']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminUnlockLootboxSchema = z.object({
  adminNote: z.string().max(500).optional(),
});
