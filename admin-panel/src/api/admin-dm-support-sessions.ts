import { get, del } from './client';

const prefix = '/admin';

export interface DMSupportSessionStatsResponse {
  totalSessions: number;
  totalTipsAmount: number;
  avgTipsAmount: number;
  topHelpers: Array<{
    helperId: string;
    username: string | null;
    sessionCount: number;
    totalTips: number;
  }>;
}

export interface DMSupportSessionListItem {
  id: string;
  threadId: string;
  helperId: string;
  helperUsername: string | null;
  helperEmail: string | null;
  tipsAmount: number;
  feedbackCount: number;
  participantCount: number;
  supportedAt: string;
  createdAt: string;
}

export async function fetchDMSupportSessionsStats() {
  return get<DMSupportSessionStatsResponse>(`${prefix}/dm-support-sessions/stats`);
}

export async function fetchDMSupportSessions(params?: {
  limit?: number;
  offset?: number;
  threadId?: string;
  helperId?: string;
  minTipsAmount?: number;
  sort?: 'createdAt' | 'supportedAt' | 'tipsAmount';
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'supportedAt',
    order: params?.order ?? 'desc',
  };
  if (params?.threadId) query.threadId = params.threadId;
  if (params?.helperId) query.helperId = params.helperId;
  if (params?.minTipsAmount !== undefined) query.minTipsAmount = params.minTipsAmount;
  return get<DMSupportSessionListItem[]>(`${prefix}/dm-support-sessions`, query);
}

export async function deleteDMSupportSession(id: string) {
  return del<{ success: boolean; message: string }>(`${prefix}/dm-support-sessions/${id}`);
}
