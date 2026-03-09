import { get, post } from './client';

const prefix = '/admin/feed-management';

// ==================== Types ====================

export interface FeedManagementStats {
  overview: {
    totalFeeds: number;
    totalUnseenFeeds: number;
    totalActiveUsers: number;
    usersWithFeeds: number;
    usersWithEmptyFeeds: number;
    feedCoverage: number;
  };
  scores: {
    average: number;
    min: number;
    max: number;
  };
  scoreDistribution: {
    low: number;
    medium: number;
    high: number;
    veryHigh: number;
  };
  sourceDistribution: Array<{
    source: string;
    count: number;
    avgScore: number;
  }>;
  activity: {
    feedsLast24h: number;
    feedsOlderThan7d: number;
  };
}

export interface QueueStats {
  distribution: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  cleanup: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
}

export interface EmptyFeedUser {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  createdAt: string;
  trustCount: number;
  inventoryCount: number;
  hasPreferences: boolean;
}

export interface CleanupStatus {
  cleanupEnabled: boolean;
}

export interface JobHistoryItem {
  id: string | null;
  name: string;
  postId: string | null;
  scoringType: string | null;
  processedAt: string | null;
  finishedAt: string | null;
  duration: number | null;
  attempts: number;
  failedReason: string | null;
}

export interface JobHistory {
  completed: JobHistoryItem[];
  failed: JobHistoryItem[];
}

export interface UserFeedLookupResult {
  user: {
    id: string;
    email: string;
    status: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    createdAt: string;
  };
  feedHealth: {
    totalFeeds: number;
    unseenFeeds: number;
    denormalizedUnseenCount: number;
    avgScore: number;
    minScore: number;
    maxScore: number;
    lastFeedAt: string | null;
    sourceDistribution: Array<{ source: string; count: number }>;
  };
  context: {
    trustCount: number;
    inventoryCount: number;
    hasPreferences: boolean;
    preferredCategories: string | null;
  };
}

// ==================== API Functions ====================

export async function fetchFeedManagementStats() {
  return get<FeedManagementStats>(`${prefix}/stats`);
}

export async function fetchQueueStats() {
  return get<QueueStats>(`${prefix}/queue-stats`);
}

export async function fetchEmptyFeedUsers(params?: { limit?: number; offset?: number }) {
  return get<EmptyFeedUser[]>(`${prefix}/empty-feed-users`, {
    limit: params?.limit ?? 50,
    offset: params?.offset ?? 0,
  });
}

export async function fetchJobHistory() {
  return get<JobHistory>(`${prefix}/job-history`);
}

export async function fetchUserFeedLookup(search: string) {
  return get<UserFeedLookupResult | null>(`${prefix}/user-feed-lookup`, { search });
}

export async function triggerCleanup() {
  return post<{ success: boolean; message: string }>(`${prefix}/trigger-cleanup`, {});
}

export async function triggerDistribution(postId: string, scoringType: 'full' | 'fast' = 'fast') {
  return post<{ success: boolean; message: string }>(`${prefix}/trigger-distribution`, {
    postId,
    scoringType,
  });
}

export async function triggerFullRedistribution() {
  return post<{ success: boolean; message: string; data: { queuedCount: number } }>(
    `${prefix}/trigger-full-redistribution`,
    {},
  );
}

export async function refreshUserFeed(userId: string) {
  return post<{
    success: boolean;
    message: string;
    data: { deletedFeeds: number; queuedPosts: number };
  }>(`${prefix}/refresh-user-feed`, { userId });
}

export async function seedEmptyFeeds() {
  return post<{
    success: boolean;
    message: string;
    data: { usersProcessed: number; postsQueued: number };
  }>(`${prefix}/seed-empty-feeds`, {});
}

export async function cleanQueue() {
  return post<{ success: boolean; message: string }>(`${prefix}/clean-queue`, {});
}

export async function fetchCleanupStatus() {
  return get<CleanupStatus>(`${prefix}/cleanup-status`);
}

export async function toggleCleanup(enabled: boolean) {
  return post<{ cleanupEnabled: boolean }>(`${prefix}/toggle-cleanup`, { enabled });
}
