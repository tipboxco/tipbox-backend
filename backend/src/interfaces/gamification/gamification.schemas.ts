/**
 * Zod validation schemas for Gamification API
 */

import { z } from 'zod';

// Query parameter schemas

export const BadgesQuerySchema = z.object({
  type: z.enum(['COLLECTION', 'EVENT', 'COSMETIC', 'BRAND']).optional(),
  rarity: z.enum(['COMMON', 'RARE', 'EPIC']).optional(),
  categoryId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const CollectionsQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  search: z.string().optional(),
  includeProgress: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const UserBadgesQuerySchema = z.object({
  claimed: z.coerce.boolean().optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'TRUSTERS', 'PRIVATE']).optional(),
  type: z.enum(['COLLECTION', 'EVENT', 'COSMETIC', 'BRAND']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const UserAchievementsQuerySchema = z.object({
  completed: z.coerce.boolean().optional(),
  collectionId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// Request body schemas

export const ClaimBadgeSchema = z.object({});

export const UpdateBadgeVisibilitySchema = z.object({
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'TRUSTERS', 'PRIVATE']),
  isVisible: z.boolean().optional(),
});

export const UpdateBadgeDisplayOrderSchema = z.object({
  badgeOrders: z
    .array(
      z.object({
        userBadgeId: z.string().uuid(),
        displayOrder: z.number().int().min(1).max(6),
      })
    )
    .min(1)
    .max(6),
});

// Admin schemas (can be moved to admin.schemas.ts if preferred)

export const AdminBulkGrantBadgeSchema = z.object({
  badgeId: z.string().uuid(),
  userIds: z.array(z.string().uuid()).min(1).max(100), // Max 100 users per batch
  claimed: z.boolean().optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'TRUSTERS', 'PRIVATE']).optional(),
});

// Type exports for TypeScript inference

export type BadgesQueryInput = z.infer<typeof BadgesQuerySchema>;
export type CollectionsQueryInput = z.infer<typeof CollectionsQuerySchema>;
export type UserBadgesQueryInput = z.infer<typeof UserBadgesQuerySchema>;
export type UserAchievementsQueryInput = z.infer<typeof UserAchievementsQuerySchema>;
export type ClaimBadgeInput = z.infer<typeof ClaimBadgeSchema>;
export type UpdateBadgeVisibilityInput = z.infer<typeof UpdateBadgeVisibilitySchema>;
export type UpdateBadgeDisplayOrderInput = z.infer<typeof UpdateBadgeDisplayOrderSchema>;
export type AdminBulkGrantBadgeInput = z.infer<typeof AdminBulkGrantBadgeSchema>;
