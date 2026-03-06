import { get, patch, del } from './client';

const prefix = '/admin';

export interface UserReportStatsResponse {
  total: number;
  open: number;
  resolved: number;
  byCategory: Record<string, number>;
}

export interface UserReportListItem {
  id: string;
  category: string;
  description: string | null;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  adminNote: string | null;
  reporterId: string;
  reporterName: string | null;
  reportedUserId: string;
  reportedUserName: string | null;
  reportedUserEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserReportDetail {
  id: string;
  category: string;
  description: string | null;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  adminNote: string | null;
  reporter: {
    id: string;
    email: string;
    userName: string | null;
    displayName: string | null;
  };
  reportedUser: {
    id: string;
    email: string;
    status: string;
    userName: string | null;
    displayName: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export async function fetchUserReportsStats() {
  return get<UserReportStatsResponse>(`${prefix}/user-reports/stats`);
}

export async function fetchUserReports(params?: {
  limit?: number;
  offset?: number;
  resolved?: 'true' | 'false';
  category?: string;
  reporterId?: string;
  reportedUserId?: string;
  search?: string;
  sort?: 'createdAt' | 'updatedAt' | 'category';
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'createdAt',
    order: params?.order ?? 'desc',
  };
  if (params?.resolved) query.resolved = params.resolved;
  if (params?.category) query.category = params.category;
  if (params?.reporterId) query.reporterId = params.reporterId;
  if (params?.reportedUserId) query.reportedUserId = params.reportedUserId;
  if (params?.search) query.search = params.search;
  return get<UserReportListItem[]>(`${prefix}/user-reports`, query);
}

export async function fetchUserReport(id: string) {
  return get<UserReportDetail>(`${prefix}/user-reports/${id}`);
}

export async function resolveUserReport(id: string, body: { adminNote?: string | null }) {
  return patch<{
    id: string;
    resolved: boolean;
    resolvedAt: string | null;
    resolvedBy: string | null;
    adminNote: string | null;
    updatedAt: string;
  }>(`${prefix}/user-reports/${id}/resolve`, body);
}

export async function deleteUserReport(id: string) {
  return del<{ success: boolean; message: string }>(`${prefix}/user-reports/${id}`);
}
