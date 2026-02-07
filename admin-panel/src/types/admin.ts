/** Admin API response types (backend admin.dto uyumlu) */

export type AdminUserListItem = {
  id: string;
  email: string | null;
  status: string | null;
  emailVerified: boolean;
  createdAt: string;
  displayName?: string | null;
  userName?: string | null;
};

export type AdminProfileResponse = {
  id: string;
  userId: string;
  displayName: string | null;
  userName: string | null;
  bio: string | null;
  bannerUrl: string | null;
  country: string | null;
  birthDate: string | null;
  postsCount: number;
  trustCount: number;
  trusterCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminModerationHistoryItem = {
  id: string;
  moderatorId: string;
  moderatorEmail?: string | null;
  targetUserId: string;
  actionType: string;
  reason: string;
  contentType: string | null;
  contentId: number | null;
  createdAt: string;
};

export type AdminUserDetailResponse = AdminUserListItem & {
  auth0Id: string | null;
  updatedAt: string;
  profile?: AdminProfileResponse | null;
  roles?: string[];
  lastBan?: AdminModerationHistoryItem | null;
};

export type AdminRolesResponse = { roles: string[] };

/** Genel admin istatistikleri — GET /admin/stats */
export type AdminStatsResponse = {
  users: number;
  posts: number;
  bannedUsers: number;
  adminLogs: number;
};

export type AdminUsersStatsResponse = {
  total: number;
  bannedCount: number;
  emailVerifiedCount: number;
  newThisWeek: number;
};

/** Admin işlem logu — GET /admin/logs */
export type AdminLogListItem = {
  id: string;
  adminId: string;
  action: string;
  description: string | null;
  entityType: string;
  entityId: number;
  createdAt: string;
};

export type AdminUserReportListItem = {
  id: string;
  reportedUserId: string;
  reporterId: string;
  category: string;
  description: string | null;
  createdAt: string;
  reportedUserEmail?: string | null;
  reportedUserDisplayName?: string | null;
  reporterEmail?: string | null;
  reporterDisplayName?: string | null;
  resolved?: boolean;
  resolvedAt?: string | null;
};

export type AdminUserReportDetailResponse = AdminUserReportListItem & {
  reportedUser: { id: string; email: string | null; displayName?: string | null };
  reporter: { id: string; email: string | null; displayName?: string | null };
};

export type AdminKycListItem = {
  id: string;
  userId: string;
  userEmail?: string | null;
  sumsubApplicantId: string;
  reviewStatus: string;
  reviewResult: string;
  reviewReason: string | null;
  kycLevel: string | null;
  createdAt: string;
  lastSyncedAt: string | null;
};

export type AdminKycDetailResponse = AdminKycListItem & {
  updatedAt: string;
  lastUpdatedAt: string;
};

export type AdminTrustScoreListItem = {
  id: string;
  userId: string;
  userEmail?: string | null;
  score: number;
  reason: string | null;
  calculatedAt: string;
  createdAt: string;
};

export type AdminLoginAttemptListItem = {
  id: string;
  userId: string | null;
  ipAddress: string;
  userAgent: string;
  status: string;
  attemptedAt: string;
};

export type AdminAvatarResponse = {
  id: string;
  userId: string;
  imageUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserEventListItem = {
  id: string;
  userId: string;
  eventId: string;
  eventTitle: string | null;
  eventStatus: string | null;
  eventStartDate: string | null;
  eventEndDate: string | null;
  eventPostsCount: number;
  eventLikesReceived: number;
  totalParticipated: number;
  totalComments: number;
  createdAt: string;
};

export type AdminUserBadgeListItem = {
  id: string;
  userId: string;
  badgeId: string;
  badgeName: string;
  badgeImageUrl: string | null;
  badgeRarity: string;
  badgeCategoryName: string | null;
  isVisible: boolean;
  displayOrder: number | null;
  visibility: string;
  claimed: boolean;
  claimedAt: string | null;
  createdAt: string;
};

export type AdminWalletSummaryItem = {
  id: string;
  userId: string;
  provider: string;
  publicAddress: string;
  balance: number;
  lockedBalance: number;
  isConnected: boolean;
  createdAt: string;
};

export type AdminTipsSummaryResponse = {
  totalSent: number;
  totalReceived: number;
  sentCount: number;
  receivedCount: number;
};

export type AdminTipsTransactionListItem = {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  reason: string | null;
  createdAt: string;
  fromUserEmail?: string | null;
  fromUserDisplayName?: string | null;
  toUserEmail?: string | null;
  toUserDisplayName?: string | null;
};

export type PaginationMeta = {
  total: number;
  limit: number;
  offset: number;
};

/* ========== Admin Events ========== */

export type AdminEventStatsResponse = {
  total: number;
  draft: number;
  published: number;
  closed: number;
};

export type AdminEventListItem = {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: string;
  feedType: string;
  imageUrl: string | null;
  productId: string | null;
  brandId: string | null;
  mainCategoryId: string | null;
  subCategoryId: string | null;
  createdAt: string;
  participantsCount?: number;
};

export type AdminEventDetailResponse = AdminEventListItem & {
  updatedAt: string;
  product?: { id: string; name?: string } | null;
  brand?: { id: string; name?: string } | null;
  mainCategory?: { id: string; name?: string } | null;
  subCategory?: { id: string; name?: string } | null;
};

export type AdminEventParticipantListItem = {
  id: string;
  userId: string;
  eventId: string;
  totalParticipated: number;
  totalComments: number;
  helpfulVotesReceived: number;
  eventPostsCount: number;
  eventLikesReceived: number;
  createdAt: string;
  userEmail?: string | null;
  userDisplayName?: string | null;
};

export type AdminEventAnalyticsResponse = {
  participantCount: number;
  totalPosts: number;
  totalRewardsGranted: number;
  badgesCount: number;
};

export type AdminEventBadgeListItem = {
  id: string;
  eventId: string;
  badgeId: string;
  rank: number;
  displayOrder: number | null;
  enabled: boolean;
  createdAt: string;
  badgeName: string;
  badgeImageUrl: string | null;
  badgeRarity: string;
  badgeCategoryName: string | null;
};

export type AdminEventRewardListItem = {
  id: string;
  userId: string;
  eventId: string;
  rewardType: string;
  rewardId: number;
  amount: number | null;
  awardedAt: string;
  createdAt: string;
  userEmail?: string | null;
  userDisplayName?: string | null;
};
