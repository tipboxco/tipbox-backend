import { get } from './client';
import type { ApiResponse } from './client';

// ==================== Analytics Types ====================

/** GET /admin/analytics/users */
export type UserGrowthAnalytics = {
  totalUsers: number;
  growthRate: number;
  newUsersLastMonth: number;
  activeUsersLastMonth: number;
  retentionRate: number;
  userGrowthByDay: { date: string; newUsers: number; activeUsers: number }[];
};

/** GET /admin/analytics/content */
export type ContentTrendsAnalytics = {
  totalPosts: number;
  postsLastMonth: number;
  totalComments: number;
  commentsLastMonth: number;
  avgEngagementRate: number;
  topContentTypes: { type: string; count: number; percentage: number }[];
  contentByDay: { date: string; posts: number; comments: number }[];
};

/** GET /admin/analytics/engagement */
export type EngagementAnalytics = {
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgPostEngagement: number;
  topEngagedUsers: { userId: string; username: string | null; engagementScore: number }[];
  engagementTrends: { date: string; likes: number; comments: number; shares: number }[];
};

/** GET /admin/analytics/revenue */
export type RevenueAnalytics = {
  totalRevenue: number;
  revenueLastMonth: number;
  revenueGrowthRate: number;
  subscriptionRevenue: number;
  nftRevenue: number;
  revenueByDay: { date: string; revenue: number }[];
  topRevenueUsers: { userId: string; username: string | null; totalSpent: number }[];
};

/** GET /admin/analytics/platform */
export type PlatformHealthAnalytics = {
  overallScore: number;
  userActivity: { score: number; trend: 'up' | 'down' | 'stable' };
  contentQuality: { score: number; trend: 'up' | 'down' | 'stable' };
  engagement: { score: number; trend: 'up' | 'down' | 'stable' };
  revenue: { score: number; trend: 'up' | 'down' | 'stable' };
  issues: { severity: 'low' | 'medium' | 'high'; message: string }[];
};

// ==================== Module Stats Types ====================

export type EventStats = { total: number; draft: number; published: number; closed: number };
export type NftStats = {
  total: number;
  byType: Record<string, number>;
  byRarity: Record<string, number>;
  totalTransactions: number;
  activeListings: number;
};
export type BadgeStats = {
  total: number;
  byType: Record<string, number>;
  byRarity: Record<string, number>;
  owned: number;
};
export type CollectionStats = { total: number };
export type ProductStats = {
  total: number;
  addedThisMonth: number;
  byCategory: Record<string, number>;
  byCategoryCount: number;
};
export type BrandStats = {
  total: number;
  totalFollowers: number;
  activeSurveys: number;
};
export type WalletStats = {
  total: number;
  connected: number;
  disconnected: number;
  totalBalance: number;
  totalLockedBalance: number;
  byProvider: Record<string, number>;
};
export type UserReportStats = {
  total: number;
  open: number;
  resolved: number;
  byCategory: Record<string, number>;
};
export type LootboxStats = {
  total: number;
  unopened: number;
  opened: number;
  byType: Record<string, number>;
  byTier: Record<string, number>;
};
export type RewardClaimStats = {
  total: number;
  pending: number;
  claimed: number;
  expired: number;
  cancelled: number;
  totalClaimedAmount: number;
};
export type MessagingStats = {
  totalThreads: number;
  activeThreads: number;
  totalMessages: number;
  supportThreads: number;
  messagesThisMonth: number;
};
export type NewsStats = {
  total: number;
  totalViewsThisMonth: number;
};
export type SubscriptionPlanStats = {
  total: number;
  active: number;
  inactive: number;
  byPeriod: Record<string, number>;
  totalSubscriptions: number;
};
export type ContentPostStats = {
  total: number;
  byType: Record<string, number>;
  boostedCount: number;
  withEventCount: number;
};

// ==================== Analytics API Functions ====================

export async function fetchUserGrowthAnalytics(): Promise<ApiResponse<UserGrowthAnalytics>> {
  return get<UserGrowthAnalytics>('/admin/analytics/users');
}

export async function fetchContentTrends(): Promise<ApiResponse<ContentTrendsAnalytics>> {
  return get<ContentTrendsAnalytics>('/admin/analytics/content');
}

export async function fetchEngagementAnalytics(): Promise<ApiResponse<EngagementAnalytics>> {
  return get<EngagementAnalytics>('/admin/analytics/engagement');
}

export async function fetchRevenueAnalyticsData(): Promise<ApiResponse<RevenueAnalytics>> {
  return get<RevenueAnalytics>('/admin/analytics/revenue');
}

export async function fetchPlatformHealth(): Promise<ApiResponse<PlatformHealthAnalytics>> {
  return get<PlatformHealthAnalytics>('/admin/analytics/platform');
}

// ==================== Module Stats API Functions ====================

export async function fetchEventStats(): Promise<ApiResponse<EventStats>> {
  return get<EventStats>('/admin/events/stats');
}

export async function fetchNftStats(): Promise<ApiResponse<NftStats>> {
  return get<NftStats>('/admin/nft/stats');
}

export async function fetchBadgeStats(): Promise<ApiResponse<BadgeStats>> {
  return get<BadgeStats>('/admin/badges/stats');
}

export async function fetchCollectionStats(): Promise<ApiResponse<CollectionStats>> {
  return get<CollectionStats>('/admin/badges/collections/stats');
}

export async function fetchProductStats(): Promise<ApiResponse<ProductStats>> {
  return get<ProductStats>('/admin/products/stats');
}

export async function fetchBrandStats(): Promise<ApiResponse<BrandStats>> {
  return get<BrandStats>('/admin/brands/stats');
}

export async function fetchWalletStats(): Promise<ApiResponse<WalletStats>> {
  return get<WalletStats>('/admin/wallets/stats');
}

export async function fetchUserReportStats(): Promise<ApiResponse<UserReportStats>> {
  return get<UserReportStats>('/admin/user-reports/stats');
}

export async function fetchLootboxStats(): Promise<ApiResponse<LootboxStats>> {
  return get<LootboxStats>('/admin/lootboxes/stats');
}

export async function fetchRewardClaimStats(): Promise<ApiResponse<RewardClaimStats>> {
  return get<RewardClaimStats>('/admin/reward-claims/stats');
}

export async function fetchMessagingStats(): Promise<ApiResponse<MessagingStats>> {
  return get<MessagingStats>('/admin/messaging/stats');
}

export async function fetchNewsStats(): Promise<ApiResponse<NewsStats>> {
  return get<NewsStats>('/admin/news/stats');
}

export async function fetchSubscriptionPlanStats(): Promise<ApiResponse<SubscriptionPlanStats>> {
  return get<SubscriptionPlanStats>('/admin/subscription-plans/stats');
}

export async function fetchContentPostStats(): Promise<ApiResponse<ContentPostStats>> {
  return get<ContentPostStats>('/admin/content/posts/stats');
}
