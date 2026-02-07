import { get, patch } from './client';
import type { AdminUserReportListItem, AdminUserReportDetailResponse, PaginationMeta } from '../types/admin';

const prefix = '/admin';

export async function fetchUserReports(params?: {
  limit?: number;
  offset?: number;
  reportedUserId?: string;
  reporterId?: string;
  category?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'createdAt',
    order: params?.order ?? 'desc',
  };
  if (params?.reportedUserId) query.reportedUserId = params.reportedUserId;
  if (params?.reporterId) query.reporterId = params.reporterId;
  if (params?.category) query.category = params.category;
  const res = await get<AdminUserReportListItem[]>(`${prefix}/user-reports`, query);
  return res;
}

export async function fetchUserReport(id: string) {
  return get<AdminUserReportDetailResponse>(`${prefix}/user-reports/${id}`);
}

export async function resolveUserReport(id: string, body: { resolved: boolean; adminNote?: string }) {
  return patch<{ reportId: string; resolved: boolean }>(`${prefix}/user-reports/${id}/resolve`, body);
}
