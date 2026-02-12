import { get } from './client';

// ==================== Stats Interfaces ====================

export interface UserProgressStatsResponse {
  totalUsers: number;
  activeUsers: number;
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
