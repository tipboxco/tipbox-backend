import { get, patch, del } from './client';

const prefix = '/admin';

export interface UserFeedPreferenceStatsResponse {
  totalPreferences: number;
  withCategories: number;
  withContentTypes: number;
  byLanguage: Record<string, number>;
}

export interface UserFeedPreferenceListItem {
  id: string;
  userId: string;
  username: string | null;
  userEmail: string | null;
  preferredCategories: string | null;
  preferredContentTypes: string | null;
  language: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchUserFeedPreferencesStats() {
  return get<UserFeedPreferenceStatsResponse>(`${prefix}/user-feed-preferences/stats`);
}

export async function fetchUserFeedPreferences(params?: {
  limit?: number;
  offset?: number;
  userId?: string;
  language?: string;
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
  if (params?.userId) query.userId = params.userId;
  if (params?.language) query.language = params.language;
  if (params?.search) query.search = params.search;
  return get<UserFeedPreferenceListItem[]>(`${prefix}/user-feed-preferences`, query);
}

export async function updateUserFeedPreference(
  id: string,
  body: {
    preferredCategories?: string | null;
    preferredContentTypes?: string | null;
    language?: string | null;
  }
) {
  return patch<{
    id: string;
    preferredCategories: string | null;
    preferredContentTypes: string | null;
    language: string | null;
    updatedAt: string;
  }>(`${prefix}/user-feed-preferences/${id}`, body);
}

export async function deleteUserFeedPreference(id: string) {
  return del<{ success: boolean; message: string }>(`${prefix}/user-feed-preferences/${id}`);
}
