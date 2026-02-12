import { get } from './client';

// ==================== Stats Interfaces ====================

export interface UserProgressStatsResponse {
  totalUsers: number;
  activeUsers: number;
  totalUsersWithBadges: number;
  averageBadgesPerUser: number;
}

export interface BrandBadgesStatsResponse {
  totalBadges: number;
  totalAwarded: number;
}

export interface EventBadgesStatsResponse {
  totalBadges: number;
  totalAwarded: number;
}

export interface CosmeticBadgesStatsResponse {
  totalBadges: number;
  totalOwned: number;
}

// ==================== User Progress Interfaces ====================

export interface AdminUserProgressListItem {
  userId: string;
  email: string | null;
  userName: string | null;
  displayName: string | null;
  totalBadges: number;
  claimedBadges: number;
  unclaimedBadges: number;
  totalAchievements: number;
  completedAchievements: number;
  progressPercent: number;
  lastActivity: string | null;
}

// ==================== Stats API Functions ====================

export async function fetchUserProgressStats() {
  return get<UserProgressStatsResponse>('/admin/gamification/user-progress/stats');
}

export async function fetchBrandBadgesStats() {
  return get<BrandBadgesStatsResponse>('/admin/gamification/brand-badges/stats');
}

export async function fetchEventBadgesStats() {
  return get<EventBadgesStatsResponse>('/admin/gamification/event-badges/stats');
}

export async function fetchCosmeticBadgesStats() {
  return get<CosmeticBadgesStatsResponse>('/admin/gamification/cosmetic-badges/stats');
}

// ==================== User Progress API Functions ====================

export async function fetchUserProgressList(params?: {
  limit?: number;
  offset?: number;
  search?: string;
  claimStatus?: 'all' | 'claimed' | 'unclaimed';
  sort?: 'username' | 'totalBadges' | 'progressPercent' | 'lastActivity';
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    claimStatus: params?.claimStatus ?? 'all',
    sort: params?.sort ?? 'lastActivity',
    order: params?.order ?? 'desc',
  };
  if (params?.search) query.search = params.search;
  return get<AdminUserProgressListItem[]>('/admin/gamification/user-progress', query);
}
