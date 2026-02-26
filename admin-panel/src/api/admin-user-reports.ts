import { get, patch, del } from './client';

const prefix = '/admin';

export interface UserReportStatsResponse {
  total: number;
  pending: number;
  reviewing: number;
  resolved: number;
  dismissed: number;
  byType: Record<string, number>;
}

export interface UserReportListItem {
  id: string;
  reportType: 'POST' | 'COMMENT' | 'USER' | 'MESSAGE';
  reason: string;
  description: string | null;
  status: 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';
  reporterId: string;
  reporterUsername: string | null;
  reporterDisplayName: string | null;
  reportedUserId: string;
  reportedUsername: string | null;
  reportedUserEmail: string | null;
  contentId: string | null;
  reviewerId: string | null;
  reviewerUsername: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserReportDetail {
  id: string;
  reportType: 'POST' | 'COMMENT' | 'USER' | 'MESSAGE';
  reason: string;
  description: string | null;
  status: 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';
  contentId: string | null;
  reporter: {
    id: string;
    email: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
  reportedUser: {
    id: string;
    email: string;
    status: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
  reviewer: {
    id: string;
    username: string | null;
    displayName: string | null;
  } | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchUserReportsStats() {
  return get<UserReportStatsResponse>(`${prefix}/user-reports/stats`);
}

export async function fetchUserReports(params?: {
  limit?: number;
  offset?: number;
  status?: 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';
  reportType?: 'POST' | 'COMMENT' | 'USER' | 'MESSAGE';
  reporterId?: string;
  reportedUserId?: string;
  search?: string;
  sort?: 'createdAt' | 'updatedAt';
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'createdAt',
    order: params?.order ?? 'desc',
  };
  if (params?.status) query.status = params.status;
  if (params?.reportType) query.reportType = params.reportType;
  if (params?.reporterId) query.reporterId = params.reporterId;
  if (params?.reportedUserId) query.reportedUserId = params.reportedUserId;
  if (params?.search) query.search = params.search;
  return get<UserReportListItem[]>(`${prefix}/user-reports`, query);
}

export async function fetchUserReport(id: string) {
  return get<UserReportDetail>(`${prefix}/user-reports/${id}`);
}

export async function updateUserReport(
  id: string,
  body: {
    status?: 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';
    reviewNote?: string | null;
    reviewerId?: string | null;
  }
) {
  return patch<{
    id: string;
    status: string;
    reviewNote: string | null;
    reviewerId: string | null;
    updatedAt: string;
  }>(`${prefix}/user-reports/${id}`, body);
}

export async function deleteUserReport(id: string) {
  return del<{ success: boolean; message: string }>(`${prefix}/user-reports/${id}`);
}
