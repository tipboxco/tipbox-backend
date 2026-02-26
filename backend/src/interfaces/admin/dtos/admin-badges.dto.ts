/* ========== Admin Collections (BadgeCollection) DTOs ========== */

export type AdminCollectionStatsResponse = {
  total: number;
};

export type AdminCollectionListItem = {
  id: string;
  name: string;
  bannerUrl: string | null;
  owner: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  badgesCount: number;
  goalsCount?: number;
  createdAt: string;
};

export type AdminCollectionDetailResponse = AdminCollectionListItem & {
  focusSector: string | null;
  targetGroup: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  unlockCondition: string | null;
  completionBonus: string | null;
  updatedAt: string;
  category?: { id: string; name: string } | null;
};

export type AdminCollectionBadgeListItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  type: string;
  rarity: string;
  categoryId: string;
  categoryName?: string | null;
  createdAt: string;
};

export type AdminActionTypeListItem = {
  id: string;
  mainAction: string;
  code: string;
  label: string;
};

/* ========== Admin Badge Categories ========== */

export type AdminBadgeCategoryListItem = {
  id: string;
  name: string;
  description: string | null;
};

/* ========== Admin Badges ========== */

export type AdminBadgeStatsResponse = {
  total: number;
  byType: Record<string, number>;
  byRarity: Record<string, number>;
};

export type AdminBadgeListItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  type: string;
  rarity: string;
  categoryId: string;
  categoryName?: string | null;
  collectionId: string | null;
  collectionName?: string | null;
  createdAt: string;
};

export type AdminBadgeDetailResponse = AdminBadgeListItem & {
  boostMultiplier: number | null;
  rewardMultiplier: number | null;
  /** Badge modelinde updatedAt yok; API null döner. */
  updatedAt: string | null;
  category?: { id: string; name: string } | null;
  collection?: { id: string; name: string } | null;
};

export type AdminBadgeOwnerListItem = {
  id: string;
  userId: string;
  badgeId: string;
  claimed: boolean;
  claimedAt: string | null;
  createdAt: string;
  userEmail: string | null;
  userDisplayName: string | null;
};

/* ========== Admin User Progress ========== */

/**
 * User progress list item for admin panel
 */
export type AdminUserProgressListItem = {
  userId: string;
  email: string | null;
  userName: string | null;
  displayName: string | null;
  totalBadges: number;
  claimedBadges: number;
  unclaimedBadges: number;
  totalAchievements: number;
  completedAchievements: number;
  progressPercent: number; // 0-100
  lastActivity: string | null; // ISO date
};

/**
 * Enhanced stats for user progress page
 */
export type AdminUserProgressStatsResponse = {
  totalUsers: number;
  totalUsersWithBadges: number;
  averageBadgesPerUser: number;
  activeUsers: number;
};

/* ========== Admin Badge Input Types (inferred from schemas) ========== */

import type {
  AdminCreateCollectionSchema,
  AdminUpdateCollectionSchema,
  AdminCreateCollectionGoalSchema,
  AdminCreateBadgeSchema,
  AdminUpdateBadgeSchema,
} from '../schemas/admin-badges.schemas';
import type { z } from 'zod';

export type AdminCreateCollectionInput = z.infer<typeof AdminCreateCollectionSchema>;
export type AdminUpdateCollectionInput = z.infer<typeof AdminUpdateCollectionSchema>;
export type AdminCreateCollectionGoalInput = z.infer<typeof AdminCreateCollectionGoalSchema>;
export type AdminCreateBadgeInput = z.infer<typeof AdminCreateBadgeSchema>;
export type AdminUpdateBadgeInput = z.infer<typeof AdminUpdateBadgeSchema>;
