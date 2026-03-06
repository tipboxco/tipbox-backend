import { get, patch } from './client';

const prefix = '/admin';

export interface RewardClaimStatsResponse {
  total: number;
  pending: number;
  claimed: number;
  expired: number;
  rejected: number;
  totalClaimedAmount: number;
}

export interface RewardClaimListItem {
  id: string;
  userId: string;
  userName: string;
  displayName: string | null;
  amount: number;
  rewardType: string;
  sourceType: string;
  sourceId: string | null;
  status: 'PENDING' | 'CLAIMED' | 'EXPIRED' | 'REJECTED';
  earnedAt: string;
  claimedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RewardClaimDetail extends RewardClaimListItem {
  metadata: Record<string, unknown> | null;
  transactionId: string | null;
  transaction: {
    id: string;
    status: string;
    amount: number;
  } | null;
}

export async function fetchRewardClaimStats() {
  return get<RewardClaimStatsResponse>(`${prefix}/reward-claims/stats`);
}

export async function fetchRewardClaims(params?: {
  limit?: number;
  offset?: number;
  status?: string;
  userId?: string;
  rewardType?: string;
  sourceType?: string;
  sort?: 'createdAt' | 'earnedAt' | 'amount' | 'expiresAt';
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | boolean | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'createdAt',
    order: params?.order ?? 'desc',
  };
  if (params?.status) query.status = params.status;
  if (params?.userId) query.userId = params.userId;
  if (params?.rewardType) query.rewardType = params.rewardType;
  if (params?.sourceType) query.sourceType = params.sourceType;
  return get<RewardClaimListItem[]>(`${prefix}/reward-claims`, query);
}

export async function fetchRewardClaim(id: string) {
  return get<RewardClaimDetail>(`${prefix}/reward-claims/${id}`);
}

export async function approveRewardClaim(id: string) {
  return patch<{ id: string; status: string; claimedAt: string | null }>(`${prefix}/reward-claims/${id}/approve`, {});
}

export async function rejectRewardClaim(id: string) {
  return patch<{ id: string; status: string }>(`${prefix}/reward-claims/${id}/reject`, {});
}

export async function extendRewardClaim(id: string, expiresAt: string) {
  return patch<{ id: string; status: string; expiresAt: string | null }>(`${prefix}/reward-claims/${id}/extend`, { expiresAt });
}
