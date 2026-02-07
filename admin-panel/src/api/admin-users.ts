import { get, patch, put, post, del } from './client';
import type {
  AdminUserListItem,
  AdminUserDetailResponse,
  AdminProfileResponse,
  AdminRolesResponse,
  AdminModerationHistoryItem,
  AdminUsersStatsResponse,
  AdminTrustScoreListItem,
  AdminLoginAttemptListItem,
  AdminAvatarResponse,
  AdminUserEventListItem,
  AdminUserBadgeListItem,
  AdminWalletSummaryItem,
  AdminTipsSummaryResponse,
  AdminTipsTransactionListItem,
} from '../types/admin';

const prefix = '/admin';

export async function fetchUsersStats() {
  const res = await get<AdminUsersStatsResponse>(`${prefix}/users/stats`);
  return res;
}

export async function fetchUsers(params: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  emailVerified?: boolean;
  sort?: 'email' | 'createdAt';
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | boolean | undefined> = {
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    search: params.search,
    status: params.status,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  if (params.emailVerified !== undefined) query.emailVerified = params.emailVerified;
  const res = await get<AdminUserListItem[]>(`${prefix}/users`, query);
  return res;
}

export async function fetchUser(id: string) {
  return get<AdminUserDetailResponse>(`${prefix}/users/${id}`);
}

export async function fetchUserProfile(id: string) {
  return get<AdminProfileResponse>(`${prefix}/users/${id}/profile`);
}

export async function fetchUserRoles(id: string) {
  return get<AdminRolesResponse>(`${prefix}/users/${id}/roles`);
}

export async function fetchUserModerationHistory(id: string, params?: { limit?: number; offset?: number }) {
  const query = params
    ? { limit: params.limit ?? 20, offset: params.offset ?? 0 }
    : undefined;
  const res = await get<AdminModerationHistoryItem[]>(`${prefix}/users/${id}/moderation-history`, query);
  return res;
}

export async function fetchUserTrustScores(id: string, params?: { limit?: number; offset?: number }) {
  const res = await get<AdminTrustScoreListItem[]>(`${prefix}/users/${id}/trust-scores`, params);
  return res;
}

export async function fetchUserLoginAttempts(id: string, params?: { limit?: number; offset?: number; status?: string }) {
  const res = await get<AdminLoginAttemptListItem[]>(`${prefix}/users/${id}/login-attempts`, params);
  return res;
}

export async function updateUser(id: string, body: { email?: string; status?: string | null; emailVerified?: boolean }) {
  return patch<AdminUserDetailResponse>(`${prefix}/users/${id}`, body);
}

export async function updateUserRoles(id: string, roles: string[]) {
  return put<AdminRolesResponse>(`${prefix}/users/${id}/roles`, { roles });
}

export async function banUser(id: string, reason?: string) {
  return patch<{ userId: string; status: string }>(`${prefix}/users/${id}/ban`, { reason: reason ?? 'Admin ban' });
}

export async function unbanUser(id: string) {
  return patch<{ userId: string; status: null }>(`${prefix}/users/${id}/unban`, {});
}

export async function fetchUserAvatar(userId: string) {
  return get<AdminAvatarResponse>(`${prefix}/users/${userId}/avatar`);
}

export async function updateUserAvatar(
  userId: string,
  body: { imageUrl?: string; avatarId?: string; isActive?: boolean }
) {
  return patch<AdminAvatarResponse>(`${prefix}/users/${userId}/avatar`, body);
}

export async function createUserAvatar(userId: string, body: { imageUrl: string }) {
  return post<AdminAvatarResponse>(`${prefix}/users/${userId}/avatar`, body);
}

export async function fetchUserEvents(
  userId: string,
  params?: { limit?: number; offset?: number; sort?: string; order?: 'asc' | 'desc' }
) {
  const query = params
    ? { limit: params.limit ?? 20, offset: params.offset ?? 0, sort: params.sort, order: params.order }
    : undefined;
  return get<AdminUserEventListItem[]>(`${prefix}/users/${userId}/events`, query);
}

export async function fetchUserBadges(
  userId: string,
  params?: { limit?: number; offset?: number; claimed?: boolean }
) {
  const query = params ? { limit: params.limit ?? 20, offset: params.offset ?? 0, claimed: params.claimed } : undefined;
  return get<AdminUserBadgeListItem[]>(`${prefix}/users/${userId}/badges`, query);
}

export async function grantUserBadge(
  userId: string,
  body: { badgeId: string; isVisible?: boolean; displayOrder?: number; visibility?: string }
) {
  return post<AdminUserBadgeListItem>(`${prefix}/users/${userId}/badges`, body);
}

export async function revokeUserBadge(userId: string, userBadgeId: string) {
  return del<{ userBadgeId: string }>(`${prefix}/users/${userId}/badges/${userBadgeId}`);
}

export async function fetchUserWallet(userId: string) {
  return get<AdminWalletSummaryItem[]>(`${prefix}/users/${userId}/wallet`);
}

export async function fetchUserTipsSummary(userId: string) {
  return get<AdminTipsSummaryResponse>(`${prefix}/users/${userId}/tips-summary`);
}

export async function fetchUserTipsTransactions(
  userId: string,
  params?: { limit?: number; offset?: number; direction?: 'sent' | 'received' | 'all'; sort?: string; order?: 'asc' | 'desc' }
) {
  const query = params
    ? {
        limit: params.limit ?? 20,
        offset: params.offset ?? 0,
        direction: params.direction,
        sort: params.sort,
        order: params.order,
      }
    : undefined;
  return get<AdminTipsTransactionListItem[]>(`${prefix}/users/${userId}/tips-transactions`, query);
}
