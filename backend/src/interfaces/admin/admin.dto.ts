export type AdminStatsResponse = {
  users: number;
  posts: number;
  bannedUsers: number;
  adminLogs: number;
};

export type AdminUserListItem = {
  id: string;
  email: string | null;
  status: string | null;
  emailVerified: boolean;
  createdAt: string;
};

export type AdminUserDetailResponse = AdminUserListItem & {
  auth0Id: string | null;
  updatedAt: string;
};

export type AdminLogListItem = {
  id: string;
  adminId: string;
  action: string;
  description: string | null;
  entityType: string;
  entityId: number;
  createdAt: string;
};

export type PaginationMeta = {
  total: number;
  limit: number;
  offset: number;
};
