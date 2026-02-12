import { get, post, patch, del } from './client';
import type { ApiResponse } from './client';

// ==================== Type Interfaces ====================

/* ========== System Settings ========== */

export type AdminSystemSettingListItem = {
  id: string;
  key: string;
  value: string;
  description: string | null;
  category: string | null;
  isPublic: boolean;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminSystemSettingDetailResponse = AdminSystemSettingListItem & {
  metadata: Record<string, unknown> | null;
};

export type CreateSystemSettingInput = {
  key: string;
  value: string;
  description?: string | null;
  category?: string | null;
  isPublic?: boolean;
  metadata?: Record<string, unknown>;
};

export type UpdateSystemSettingInput = Partial<Omit<CreateSystemSettingInput, 'key'>>;

/* ========== Feature Flags ========== */

export type AdminFeatureFlagListItem = {
  id: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  rolloutPercentage: number;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpdateFeatureFlagInput = {
  isEnabled?: boolean;
  rolloutPercentage?: number;
};

/* ========== Moderation Actions ========== */

export type AdminModerationActionStatsResponse = {
  total: number;
  thisWeek: number;
  byType: Record<string, number>;
  byModerator: {
    moderatorId: string;
    moderatorEmail: string | null;
    actionCount: number;
  }[];
};

export type AdminModerationActionListItem = {
  id: string;
  moderatorId: string;
  moderatorEmail: string | null;
  targetUserId: string;
  targetUserEmail: string | null;
  targetUsername: string | null;
  actionType: string;
  reason: string;
  contentType: string | null;
  contentId: number | null;
  createdAt: string;
};

export type AdminModerationActionDetailResponse = AdminModerationActionListItem & {
  metadata: Record<string, unknown> | null;
};

/* ========== Admin Logs ========== */

export type AdminLogStatsResponse = {
  total: number;
  thisWeek: number;
  byAction: Record<string, number>;
  topAdmins: {
    adminId: string;
    adminEmail: string | null;
    actionCount: number;
  }[];
};

export type AdminLogListItem = {
  id: string;
  adminId: string;
  adminEmail: string | null;
  action: string;
  description: string | null;
  entityType: string;
  entityId: number;
  createdAt: string;
};

export type AdminLogDetailResponse = AdminLogListItem & {
  metadata: Record<string, unknown> | null;
};

/* ========== Analytics ========== */

export type AdminDashboardAnalyticsResponse = {
  users: {
    total: number;
    active: number;
    newThisWeek: number;
    growthRate: number;
  };
  content: {
    totalPosts: number;
    totalComments: number;
    postsThisWeek: number;
    commentsThisWeek: number;
  };
  engagement: {
    totalLikes: number;
    totalViews: number;
    avgEngagementRate: number;
  };
  revenue: {
    totalRevenue: number;
    revenueThisMonth: number;
    activeSubscriptions: number;
  };
};

export type AdminUserGrowthResponse = {
  daily: {
    date: string;
    newUsers: number;
    activeUsers: number;
  }[];
  weekly: {
    weekStart: string;
    newUsers: number;
    activeUsers: number;
  }[];
  monthly: {
    monthStart: string;
    newUsers: number;
    activeUsers: number;
  }[];
};

export type AdminEngagementMetricsResponse = {
  posts: {
    total: number;
    thisWeek: number;
    byType: Record<string, number>;
  };
  comments: {
    total: number;
    thisWeek: number;
  };
  likes: {
    total: number;
    thisWeek: number;
  };
  avgEngagementRate: number;
  topContributors: {
    userId: string;
    username: string | null;
    postCount: number;
    commentCount: number;
    likeCount: number;
  }[];
};

export type AdminContentAnalyticsResponse = {
  byType: {
    type: string;
    count: number;
    viewCount: number;
    likeCount: number;
  }[];
  byCategory: {
    categoryId: string;
    categoryName: string;
    postCount: number;
  }[];
  trending: {
    postId: string;
    title: string;
    score: number;
  }[];
};

export type AdminRevenueAnalyticsResponse = {
  total: number;
  thisMonth: number;
  bySource: Record<string, number>;
  subscriptions: {
    active: number;
    revenue: number;
  };
  transactions: {
    count: number;
    volume: number;
  };
  monthly: {
    month: string;
    revenue: number;
    subscriptionRevenue: number;
    transactionRevenue: number;
  }[];
};

/* ========== Query Parameters ========== */

export type SystemSettingsQueryParams = {
  category?: string;
  isPublic?: boolean;
  search?: string;
};

export type FeatureFlagsQueryParams = {
  isEnabled?: boolean;
};

export type ModerationActionsQueryParams = {
  limit?: number;
  offset?: number;
  moderatorId?: string;
  targetUserId?: string;
  actionType?: string;
  contentType?: string;
  sort?: string;
  order?: 'asc' | 'desc';
};

export type AdminLogsQueryParams = {
  limit?: number;
  offset?: number;
  adminId?: string;
  action?: string;
  entityType?: string;
  sort?: string;
  order?: 'asc' | 'desc';
};

export type UserGrowthQueryParams = {
  period?: 'daily' | 'weekly' | 'monthly';
  startDate?: string;
  endDate?: string;
};

// ==================== API Functions ====================

/* ========== System Settings ========== */

export async function fetchSystemSettings(
  params: SystemSettingsQueryParams = {}
): Promise<ApiResponse<AdminSystemSettingListItem[]>> {
  const query = {
    category: params.category,
    isPublic: params.isPublic,
    search: params.search,
  };
  return get<AdminSystemSettingListItem[]>('/admin/system/settings', query);
}

export async function fetchSystemSetting(
  id: string
): Promise<ApiResponse<AdminSystemSettingDetailResponse>> {
  return get<AdminSystemSettingDetailResponse>(`/admin/system/settings/${id}`);
}

export async function createSystemSetting(
  data: CreateSystemSettingInput
): Promise<ApiResponse<AdminSystemSettingDetailResponse>> {
  return post<AdminSystemSettingDetailResponse>('/admin/system/settings', data);
}

export async function updateSystemSetting(
  id: string,
  data: UpdateSystemSettingInput
): Promise<ApiResponse<AdminSystemSettingDetailResponse>> {
  return patch<AdminSystemSettingDetailResponse>(`/admin/system/settings/${id}`, data);
}

export async function deleteSystemSetting(id: string): Promise<ApiResponse<void>> {
  return del<void>(`/admin/system/settings/${id}`);
}

/* ========== Feature Flags ========== */

export async function fetchFeatureFlags(
  params: FeatureFlagsQueryParams = {}
): Promise<ApiResponse<AdminFeatureFlagListItem[]>> {
  const query = { isEnabled: params.isEnabled };
  return get<AdminFeatureFlagListItem[]>('/admin/system/feature-flags', query);
}

export async function updateFeatureFlag(
  id: string,
  data: UpdateFeatureFlagInput
): Promise<ApiResponse<AdminFeatureFlagListItem>> {
  return patch<AdminFeatureFlagListItem>(`/admin/system/feature-flags/${id}`, data);
}

/* ========== Moderation Actions ========== */

export async function fetchModerationActionStats(): Promise<
  ApiResponse<AdminModerationActionStatsResponse>
> {
  return get<AdminModerationActionStatsResponse>('/admin/system/moderation-actions/stats');
}

export async function fetchModerationActions(
  params: ModerationActionsQueryParams = {}
): Promise<ApiResponse<AdminModerationActionListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    moderatorId: params.moderatorId,
    targetUserId: params.targetUserId,
    actionType: params.actionType,
    contentType: params.contentType,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  return get<AdminModerationActionListItem[]>('/admin/system/moderation-actions', query);
}

export async function fetchModerationAction(
  id: string
): Promise<ApiResponse<AdminModerationActionDetailResponse>> {
  return get<AdminModerationActionDetailResponse>(`/admin/system/moderation-actions/${id}`);
}

/* ========== Admin Logs ========== */

export async function fetchAdminLogStats(): Promise<ApiResponse<AdminLogStatsResponse>> {
  return get<AdminLogStatsResponse>('/admin/system/admin-logs/stats');
}

export async function fetchAdminLogs(
  params: AdminLogsQueryParams = {}
): Promise<ApiResponse<AdminLogListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    adminId: params.adminId,
    action: params.action,
    entityType: params.entityType,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  return get<AdminLogListItem[]>('/admin/system/admin-logs', query);
}

export async function fetchAdminLog(id: string): Promise<ApiResponse<AdminLogDetailResponse>> {
  return get<AdminLogDetailResponse>(`/admin/system/admin-logs/${id}`);
}

/* ========== Analytics ========== */

export async function fetchDashboardAnalytics(): Promise<
  ApiResponse<AdminDashboardAnalyticsResponse>
> {
  return get<AdminDashboardAnalyticsResponse>('/admin/analytics/dashboard');
}

export async function fetchUserGrowth(
  params: UserGrowthQueryParams = {}
): Promise<ApiResponse<AdminUserGrowthResponse>> {
  const query = {
    period: params.period,
    startDate: params.startDate,
    endDate: params.endDate,
  };
  return get<AdminUserGrowthResponse>('/admin/analytics/user-growth', query);
}

export async function fetchEngagementMetrics(): Promise<
  ApiResponse<AdminEngagementMetricsResponse>
> {
  return get<AdminEngagementMetricsResponse>('/admin/analytics/engagement');
}

export async function fetchContentAnalytics(): Promise<
  ApiResponse<AdminContentAnalyticsResponse>
> {
  return get<AdminContentAnalyticsResponse>('/admin/analytics/content');
}

export async function fetchRevenueAnalytics(
  startDate?: string,
  endDate?: string
): Promise<ApiResponse<AdminRevenueAnalyticsResponse>> {
  const query = { startDate, endDate };
  return get<AdminRevenueAnalyticsResponse>('/admin/analytics/revenue', query);
}
