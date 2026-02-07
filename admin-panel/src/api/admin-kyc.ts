import { get, patch } from './client';
import type { AdminKycListItem, AdminKycDetailResponse } from '../types/admin';

const prefix = '/admin';

export async function fetchUserKycList(params?: {
  limit?: number;
  offset?: number;
  userId?: string;
  reviewStatus?: string;
  reviewResult?: string;
}) {
  const query: Record<string, string | number | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
  };
  if (params?.userId) query.userId = params.userId;
  if (params?.reviewStatus) query.reviewStatus = params.reviewStatus;
  if (params?.reviewResult) query.reviewResult = params.reviewResult;
  const res = await get<AdminKycListItem[]>(`${prefix}/user-kyc`, query);
  return res;
}

export async function fetchUserKycByUserId(userId: string) {
  return get<AdminKycDetailResponse>(`${prefix}/user-kyc/${userId}`);
}

export async function updateKycReview(recordId: string, body: { reviewStatus?: string; reviewResult?: string; reviewReason?: string }) {
  return patch<{ recordId: string; userId: string }>(`${prefix}/user-kyc/${recordId}/review`, body);
}
