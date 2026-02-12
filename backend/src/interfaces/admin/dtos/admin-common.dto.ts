/**
 * Common pagination metadata used across all admin endpoints
 */
export type PaginationMeta = {
  total: number;
  limit: number;
  offset: number;
};

/**
 * Dashboard/general admin statistics
 */
export type AdminStatsResponse = {
  users: number;
  posts: number;
  bannedUsers: number;
  adminLogs: number;
};

/**
 * Admin log entry for audit trail
 */
export type AdminLogListItem = {
  id: string;
  adminId: string;
  action: string;
  description: string | null;
  entityType: string;
  entityId: number;
  createdAt: string;
};
