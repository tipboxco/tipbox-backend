import { get, post, patch, del, postFormData } from './client';
import type {
  AdminCollectionStatsResponse,
  AdminCollectionListItem,
  AdminCollectionDetailResponse,
  AdminCollectionBadgeListItem,
  AdminActionTypeListItem,
  AdminBadgeCategoryListItem,
  AdminBadgeStatsResponse,
  AdminBadgeListItem,
  AdminBadgeDetailResponse,
  AdminBadgeOwnerListItem,
} from '../types/admin';

const prefix = '/admin/badges';

/* ========== Badge Categories ========== */

export async function fetchBadgeCategories() {
  return get<AdminBadgeCategoryListItem[]>(`/admin/badges/categories`);
}

/* ========== Collections ========== */

export type AdminCollectionCategorySub = { id: string; name: string };
export type AdminCollectionCategoryMain = { id: string; name: string; children: AdminCollectionCategorySub[] };

export async function fetchCollectionCategories() {
  return get<AdminCollectionCategoryMain[]>(`${prefix}/collections/categories`);
}

export async function uploadMedia(file: File) {
  if (!file) {
    throw new Error('No file selected');
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPG, PNG, GIF, and WebP are supported.');
  }

  // Validate file size (5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 5MB.');
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await postFormData<{ url: string }>(`${prefix}/media/upload`, formData);
    if (!res.data?.url) {
      throw new Error('Upload succeeded but no URL returned');
    }
    return res;
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Failed to upload image. Please try again.');
  }
}

export async function uploadBadgeImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return postFormData<{ url: string }>(`${prefix}/upload-image`, formData);
}

export async function fetchCollectionsStats() {
  return get<AdminCollectionStatsResponse>(`${prefix}/collections/stats`);
}

export async function fetchCollections(params?: {
  limit?: number;
  offset?: number;
  search?: string;
  categoryId?: string;
  sort?: 'createdAt' | 'name';
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'createdAt',
    order: params?.order ?? 'desc',
  };
  if (params?.search) query.search = params.search;
  if (params?.categoryId) query.categoryId = params.categoryId;
  return get<AdminCollectionListItem[]>(`${prefix}/collections`, query);
}

export async function fetchCollection(id: string) {
  return get<AdminCollectionDetailResponse>(`${prefix}/collections/${id}`);
}

export async function createCollection(body: {
  name: string;
  bannerUrl?: string | null;
  owner?: string | null;
  focusSector?: string | null;
  targetGroup?: string | null;
  shortDescription?: string | null;
  longDescription?: string | null;
  unlockCondition?: string | null;
  completionBonus?: string | null;
  categoryId?: string | null;
}) {
  return post<AdminCollectionDetailResponse>(`${prefix}/collections`, body);
}

export async function updateCollection(
  id: string,
  body: Partial<{
    name: string;
    bannerUrl: string | null;
    owner: string | null;
    focusSector: string | null;
    targetGroup: string | null;
    shortDescription: string | null;
    longDescription: string | null;
    unlockCondition: string | null;
    completionBonus: string | null;
    categoryId: string | null;
  }>
) {
  return patch<AdminCollectionDetailResponse>(`${prefix}/collections/${id}`, body);
}

export async function deleteCollection(id: string) {
  return del<{ message: string }>(`${prefix}/collections/${id}`);
}

export async function fetchCollectionBadges(collectionId: string) {
  return get<AdminCollectionBadgeListItem[]>(`${prefix}/collections/${collectionId}/badges`);
}

export async function addCollectionBadge(collectionId: string, body: { badgeId: string }) {
  return post<{ badgeId: string }>(`${prefix}/collections/${collectionId}/badges`, body);
}

export async function removeCollectionBadge(collectionId: string, badgeId: string) {
  return del<{ message: string }>(`${prefix}/collections/${collectionId}/badges/${badgeId}`);
}

export async function fetchActionTypes(mainAction?: string) {
  const query = mainAction ? { mainAction } : {};
  return get<AdminActionTypeListItem[]>(`/admin/system/action-types`, query);
}

export interface AdminCollectionGoalListItem {
  id: string;
  title: string;
  requirement: string;
  pointsRequired: number;
  difficulty: string;
  keywords: string[];
  allowedPostTypes: string[];
  isPassive: boolean;
  mainAction: string;
  createdAt: string;
  actionType: { id: string; code: string; label: string; mainAction: string };
  rewardBadge: { id: string; name: string; imageUrl: string | null; rarity: string } | null;
  usersCount: number;
}

export async function fetchCollectionGoals(collectionId: string) {
  return get<AdminCollectionGoalListItem[]>(`${prefix}/collections/${collectionId}/goals`);
}

export async function createCollectionGoal(
  collectionId: string,
  body: {
    actionTypeId: string;
    rewardBadgeId: string;
    pointsRequired: number;
    title?: string;
    requirement?: string;
    difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
    keywords?: string[];
    allowedPostTypes?: string[];
    isPassive?: boolean;
  }
) {
  return post<{ id: string }>(`${prefix}/collections/${collectionId}/goals`, body);
}

export async function updateCollectionGoal(
  collectionId: string,
  goalId: string,
  body: {
    title?: string;
    requirement?: string;
    pointsRequired?: number;
    difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
    keywords?: string[];
    allowedPostTypes?: string[];
    isPassive?: boolean;
  }
) {
  return patch<{ id: string }>(`${prefix}/collections/${collectionId}/goals/${goalId}`, body);
}

export async function deleteCollectionGoal(collectionId: string, goalId: string) {
  return del<{ message: string }>(`${prefix}/collections/${collectionId}/goals/${goalId}`);
}

/* ========== Collection User Progress ========== */

export type AdminCollectionUserProgressBadge = {
  badgeId: string;
  badgeName: string;
  badgeImageUrl: string | null;
  claimed: boolean;
  claimedAt: string | null;
};

export type AdminCollectionUserProgressItem = {
  userId: string;
  email: string | null;
  userName: string | null;
  displayName: string | null;
  earnedBadges: number;
  totalBadges: number;
  progressPercent: number;
  claimed: number;
  badges: AdminCollectionUserProgressBadge[];
};

export async function fetchCollectionUserProgress(
  collectionId: string,
  params?: { limit?: number; offset?: number }
) {
  const query: Record<string, string | number | undefined> = {
    limit: params?.limit ?? 50,
    offset: params?.offset ?? 0,
  };
  return get<AdminCollectionUserProgressItem[]>(
    `${prefix}/collections/${collectionId}/user-progress`,
    query
  );
}

/* ========== Badges ========== */

export async function fetchBadgesStats() {
  return get<AdminBadgeStatsResponse>(`${prefix}/stats`);
}

export async function fetchBadges(params?: {
  limit?: number;
  offset?: number;
  type?: string;
  rarity?: string;
  categoryId?: string;
  collectionId?: string;
  search?: string;
  sort?: 'createdAt' | 'name';
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'createdAt',
    order: params?.order ?? 'desc',
  };
  if (params?.type) query.type = params.type;
  if (params?.rarity) query.rarity = params.rarity;
  if (params?.categoryId) query.categoryId = params.categoryId;
  if (params?.collectionId) query.collectionId = params.collectionId;
  if (params?.search) query.search = params.search;
  return get<AdminBadgeListItem[]>(`${prefix}`, query);
}

export async function fetchBadge(id: string) {
  return get<AdminBadgeDetailResponse>(`${prefix}/${id}`);
}

export async function createBadge(body: {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  type: string;
  rarity: string;
  boostMultiplier?: number | null;
  rewardMultiplier?: number | null;
  categoryId: string;
  collectionId?: string | null;
}) {
  return post<AdminBadgeDetailResponse>(`${prefix}`, body);
}

export async function updateBadge(
  id: string,
  body: Partial<{
    name: string;
    description: string | null;
    imageUrl: string | null;
    type: string;
    rarity: string;
    boostMultiplier: number | null;
    rewardMultiplier: number | null;
    categoryId: string;
    collectionId: string | null;
  }>
) {
  return patch<AdminBadgeDetailResponse>(`${prefix}/${id}`, body);
}

export async function deleteBadge(id: string) {
  return del<{ message: string }>(`${prefix}/${id}`);
}

export async function fetchBadgeOwners(
  badgeId: string,
  params?: {
    limit?: number;
    offset?: number;
    claimed?: boolean;
    sort?: 'createdAt' | 'claimedAt';
    order?: 'asc' | 'desc';
  }
) {
  const query: Record<string, string | number | boolean | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'createdAt',
    order: params?.order ?? 'desc',
  };
  if (params?.claimed !== undefined) query.claimed = params.claimed;
  return get<AdminBadgeOwnerListItem[]>(`${prefix}/${badgeId}/owners`, query);
}
