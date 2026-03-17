import { z } from 'zod';
import { AdminPaginationQuerySchema } from './admin-common.schemas';

/* ========== Admin Collections (BadgeCollection) ========== */

export const AdminCollectionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().min(1).optional(),
  categoryId: z.string().optional(),
  sort: z.enum(['createdAt', 'name']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminCreateCollectionSchema = z.object({
  name: z.string().min(1).max(500),
  bannerUrl: z.string().url().optional().nullable(),
  highlightsImage: z.string().url().optional().nullable(),
  owner: z.string().max(500).optional().nullable(),
  focusSector: z.string().max(500).optional().nullable(),
  targetGroup: z.string().max(500).optional().nullable(),
  shortDescription: z.string().max(2000).optional().nullable(),
  longDescription: z.string().max(5000).optional().nullable(),
  unlockCondition: z.string().max(1000).optional().nullable(),
  completionBonus: z.string().max(500).optional().nullable(),
  categoryId: z.string().optional().nullable(),
});

export const AdminUpdateCollectionSchema = AdminCreateCollectionSchema.partial();

// UUID regex pattern that accepts all valid UUID formats including nil UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const AdminAddCollectionBadgeSchema = z.object({
  badgeId: z.string().regex(UUID_REGEX, 'Invalid UUID format'),
});

const AchievementDifficultyEnum = z.enum(['EASY', 'MEDIUM', 'HARD']);

const ContentPostTypeEnum = z.enum(['FREE', 'TIPS', 'COMPARE', 'QUESTION', 'EXPERIENCE', 'UPDATE']);

export const AdminCreateCollectionGoalSchema = z.object({
  actionTypeId: z.string().regex(UUID_REGEX, 'Invalid UUID format'),
  rewardBadgeId: z.string().regex(UUID_REGEX, 'Invalid UUID format'),
  pointsRequired: z.coerce.number().int().min(1),
  title: z.string().min(1).max(500).optional(),
  requirement: z.string().max(1000).optional(),
  difficulty: AchievementDifficultyEnum.default('MEDIUM'),
  keywords: z.array(z.string().min(1).max(100)).max(10).optional().default([]),
  allowedPostTypes: z.array(ContentPostTypeEnum).optional().default([]),
  isPassive: z.boolean().optional().default(false),
});

export const AdminUpdateCollectionGoalSchema = z.object({
  actionTypeId: z.string().regex(UUID_REGEX, 'Invalid UUID format').optional(),
  rewardBadgeId: z.string().regex(UUID_REGEX, 'Invalid UUID format').optional(),
  pointsRequired: z.coerce.number().int().min(1).optional(),
  title: z.string().min(1).max(500).optional(),
  requirement: z.string().max(1000).optional(),
  difficulty: AchievementDifficultyEnum.optional(),
  keywords: z.array(z.string().min(1).max(100)).max(10).optional(),
  allowedPostTypes: z.array(ContentPostTypeEnum).optional(),
  isPassive: z.boolean().optional(),
});

/* ========== Admin Badges ========== */

const BadgeTypeEnum = z.enum(['COLLECTION', 'EVENT', 'COSMETIC', 'BRAND']);
const BadgeRarityEnum = z.enum(['COMMON', 'RARE', 'EPIC']);
const BadgeStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);

export const AdminBadgesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  type: BadgeTypeEnum.optional(),
  rarity: BadgeRarityEnum.optional(),
  status: BadgeStatusEnum.optional(),
  categoryId: z.string().regex(UUID_REGEX, 'Invalid UUID format').optional(),
  collectionId: z.string().regex(UUID_REGEX, 'Invalid UUID format').optional(),
  search: z.string().min(1).optional(),
  sort: z.enum(['createdAt', 'name', 'displayOrder']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminCreateBadgeSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  type: BadgeTypeEnum,
  rarity: BadgeRarityEnum,
  status: BadgeStatusEnum.optional().default('ACTIVE'),
  displayOrder: z.number().int().min(0).optional().default(0),
  boostMultiplier: z.number().min(0).optional().nullable(),
  rewardMultiplier: z.number().min(0).optional().nullable(),
  categoryId: z.string().regex(UUID_REGEX, 'Invalid UUID format'),
  collectionId: z.string().regex(UUID_REGEX, 'Invalid UUID format').optional().nullable(),
});

export const AdminUpdateBadgeSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  type: BadgeTypeEnum.optional(),
  rarity: BadgeRarityEnum.optional(),
  status: BadgeStatusEnum.optional(),
  displayOrder: z.number().int().min(0).optional(),
  boostMultiplier: z.number().min(0).optional().nullable(),
  rewardMultiplier: z.number().min(0).optional().nullable(),
  categoryId: z.string().regex(UUID_REGEX, 'Invalid UUID format').optional(),
  collectionId: z.string().regex(UUID_REGEX, 'Invalid UUID format').optional().nullable(),
});

/* ========== Bulk Badge Operations ========== */

export const AdminBulkReorderBadgesSchema = z.object({
  badges: z.array(
    z.object({
      id: z.string().regex(UUID_REGEX, 'Invalid UUID format'),
      displayOrder: z.number().int().min(0),
    })
  ).min(1).max(200),
});

export const AdminBulkUpdateBadgeStatusSchema = z.object({
  badgeIds: z.array(z.string().regex(UUID_REGEX, 'Invalid UUID format')).min(1).max(200),
  status: BadgeStatusEnum,
});

export const AdminBadgeOwnersQuerySchema = AdminPaginationQuerySchema.extend({
  claimed: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  sort: z.enum(['createdAt', 'claimedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/* ========== Admin User Progress ========== */

/**
 * Query schema for user progress list endpoint
 */
export const AdminUserProgressQuerySchema = AdminPaginationQuerySchema.extend({
  search: z.string().min(1).optional(),
  claimStatus: z.enum(['all', 'claimed', 'unclaimed']).default('all'),
  sort: z.enum(['username', 'totalBadges', 'progressPercent', 'lastActivity']).default('lastActivity'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/* ========== Type Exports ========== */

export type AdminCollectionsQuery = z.infer<typeof AdminCollectionsQuerySchema>;
export type AdminCreateCollectionInput = z.infer<typeof AdminCreateCollectionSchema>;
export type AdminUpdateCollectionInput = z.infer<typeof AdminUpdateCollectionSchema>;
export type AdminAddCollectionBadgeInput = z.infer<typeof AdminAddCollectionBadgeSchema>;
export type AdminCreateCollectionGoalInput = z.infer<typeof AdminCreateCollectionGoalSchema>;
export type AdminUpdateCollectionGoalInput = z.infer<typeof AdminUpdateCollectionGoalSchema>;
export type AdminBadgesQuery = z.infer<typeof AdminBadgesQuerySchema>;
export type AdminCreateBadgeInput = z.infer<typeof AdminCreateBadgeSchema>;
export type AdminUpdateBadgeInput = z.infer<typeof AdminUpdateBadgeSchema>;
export type AdminBulkReorderBadgesInput = z.infer<typeof AdminBulkReorderBadgesSchema>;
export type AdminBulkUpdateBadgeStatusInput = z.infer<typeof AdminBulkUpdateBadgeStatusSchema>;
export type AdminBadgeOwnersQuery = z.infer<typeof AdminBadgeOwnersQuerySchema>;
export type AdminUserProgressQuery = z.infer<typeof AdminUserProgressQuerySchema>;
