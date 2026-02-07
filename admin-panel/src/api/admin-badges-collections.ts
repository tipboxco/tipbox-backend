import { get, post, patch, del } from './client';
import type {
  AdminCollectionStatsResponse,
  AdminCollectionListItem,
  AdminCollectionDetailResponse,
  AdminCollectionBadgeListItem,
  AdminBadgeStatsResponse,
  AdminBadgeListItem,
  AdminBadgeDetailResponse,
  AdminBadgeOwnerListItem,
} from '../types/admin';

const prefix = '/admin';

/* ========== Collections ========== */

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
  collectionObjective?: string | null;
  targetVertical?: string | null;
  productScope?: string | null;
  collectionType?: string | null;
  hookPitch?: string | null;
  visualTheme?: string | null;
  completionBonus?: string | null;
  primaryKpi?: string | null;
  secondaryKpi?: string | null;
  targetAudience?: string | null;
  campaignContext?: string | null;
  successMetric?: string | null;
  sponsorship?: string | null;
  unlockCondition?: string | null;
  scheduleLaunchDate?: string | null;
  timeStockLimit?: string | null;
  categoryId: string;
}) {
  return post<AdminCollectionDetailResponse>(`${prefix}/collections`, body);
}

export async function updateCollection(
  id: string,
  body: Partial<{
    name: string;
    bannerUrl: string | null;
    owner: string | null;
    collectionObjective: string | null;
    targetVertical: string | null;
    productScope: string | null;
    collectionType: string | null;
    hookPitch: string | null;
    visualTheme: string | null;
    completionBonus: string | null;
    primaryKpi: string | null;
    secondaryKpi: string | null;
    targetAudience: string | null;
    campaignContext: string | null;
    successMetric: string | null;
    sponsorship: string | null;
    unlockCondition: string | null;
    scheduleLaunchDate: string | null;
    timeStockLimit: string | null;
    categoryId: string;
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

/* ========== Badges ========== */

export async function fetchBadgesStats() {
  return get<AdminBadgeStatsResponse>(`${prefix}/badges/stats`);
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
  return get<AdminBadgeListItem[]>(`${prefix}/badges`, query);
}

export async function fetchBadge(id: string) {
  return get<AdminBadgeDetailResponse>(`${prefix}/badges/${id}`);
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
  return post<AdminBadgeDetailResponse>(`${prefix}/badges`, body);
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
  return patch<AdminBadgeDetailResponse>(`${prefix}/badges/${id}`, body);
}

export async function deleteBadge(id: string) {
  return del<{ message: string }>(`${prefix}/badges/${id}`);
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
  return get<AdminBadgeOwnerListItem[]>(`${prefix}/badges/${badgeId}/owners`, query);
}
