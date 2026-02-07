import { get } from './client';
import type { AdminTrustScoreListItem } from '../types/admin';

const prefix = '/admin';

export async function fetchUserTrustScoresList(params?: {
  limit?: number;
  offset?: number;
  userId?: string;
  sort?: 'score' | 'createdAt' | 'calculatedAt';
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'calculatedAt',
    order: params?.order ?? 'desc',
  };
  if (params?.userId) query.userId = params.userId;
  const res = await get<AdminTrustScoreListItem[]>(`${prefix}/user-trust-scores`, query);
  return res;
}
