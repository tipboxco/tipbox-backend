import { get, post, patch, del } from './client';

const prefix = '/admin';

export interface UserThemeStatsResponse {
  totalThemes: number;
  totalUsersWithThemes: number;
  mostUsedThemes: Array<{
    id: string;
    name: string;
    userCount: number;
  }>;
}

export interface UserThemeListItem {
  id: string;
  name: string;
  description: string | null;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function fetchUserThemesStats() {
  return get<UserThemeStatsResponse>(`${prefix}/user-themes/stats`);
}

export async function fetchUserThemes(params?: {
  limit?: number;
  offset?: number;
  search?: string;
  sort?: 'createdAt' | 'name';
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'name',
    order: params?.order ?? 'asc',
  };
  if (params?.search) query.search = params.search;
  return get<UserThemeListItem[]>(`${prefix}/user-themes`, query);
}

export async function createUserTheme(body: { name: string; description?: string | null }) {
  return post<{ id: string; name: string; description: string | null; createdAt: string }>(
    `${prefix}/user-themes`,
    body
  );
}

export async function updateUserTheme(
  id: string,
  body: { name?: string; description?: string | null }
) {
  return patch<{ id: string; name: string; description: string | null; updatedAt: string }>(
    `${prefix}/user-themes/${id}`,
    body
  );
}

export async function deleteUserTheme(id: string) {
  return del<{ success: boolean; message: string }>(`${prefix}/user-themes/${id}`);
}
