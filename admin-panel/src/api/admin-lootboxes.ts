import { get, post, patch, del } from './client';

const prefix = '/admin';

export interface LootboxStatsResponse {
  total: number;
  unopened: number;
  opened: number;
  byType: Record<string, number>;
  byTier: Record<string, number>;
}

export interface LootboxListItem {
  id: string;
  userId: string;
  username: string | null;
  userEmail: string | null;
  type: string;
  tier: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  opened: boolean;
  openedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface LootboxDetail {
  id: string;
  type: string;
  tier: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  opened: boolean;
  openedAt: string | null;
  expiresAt: string | null;
  user: {
    id: string;
    email: string;
    status: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export async function fetchLootboxStats() {
  return get<LootboxStatsResponse>(`${prefix}/lootboxes/stats`);
}

export async function fetchLootboxes(params?: {
  limit?: number;
  offset?: number;
  userId?: string;
  type?: string;
  opened?: boolean;
  sort?: 'createdAt' | 'openedAt';
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | boolean | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'createdAt',
    order: params?.order ?? 'desc',
  };
  if (params?.userId) query.userId = params.userId;
  if (params?.type) query.type = params.type;
  if (params?.opened !== undefined) query.opened = params.opened;
  return get<LootboxListItem[]>(`${prefix}/lootboxes`, query);
}

export async function fetchLootbox(id: string) {
  return get<LootboxDetail>(`${prefix}/lootboxes/${id}`);
}

export async function createLootbox(body: {
  userId: string;
  type: string;
  tier?: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  expiresAt?: string | null;
}) {
  return post<{
    id: string;
    userId: string;
    type: string;
    tier: string;
    opened: boolean;
    expiresAt: string | null;
    createdAt: string;
  }>(`${prefix}/lootboxes`, body);
}

export async function updateLootbox(
  id: string,
  body: {
    type?: string;
    tier?: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
    expiresAt?: string | null;
  }
) {
  return patch<{
    id: string;
    type: string;
    tier: string;
    expiresAt: string | null;
    updatedAt: string;
  }>(`${prefix}/lootboxes/${id}`, body);
}

export async function deleteLootbox(id: string) {
  return del<{ success: boolean; message: string }>(`${prefix}/lootboxes/${id}`);
}
